import compression from 'compression';
import cors from "cors";
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import 'dotenv/config';
import express from "express";
import fs from 'fs';
import https from 'https';
import path from "path";
import { fileURLToPath } from 'url';
import zlib from 'zlib';
import ViteExpress from "vite-express";
ViteExpress.config({
    mode: "production",
    inlineViteConfig: { base: "/admin/" },
    ignorePaths: /\.(js|css|woff2?|ttf|eot|svg|png|jpe?g|gif|ico|webp|map|json)$/,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import config from './config/config.js';
global.config = config;
import { logStartup, logSystem } from './service/logger.js';

const _startupLines = ['Config loaded'];

// Database (SQLite)
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const { default: dbService } = await import('./service/dbService.js');
global.db = dbService.db;
global.db.init();
_startupLines.push('Database initialized');

// Seed admin account on first run
if (global.db.adminCount() === 0) {
    const { default: bcrypt } = await import('bcryptjs');
    const seedEmail = process.env.SEED_ADMIN_EMAIL || 'admin@hotlinehq.com';
    const seedPassword = process.env.SEED_ADMIN_PASSWORD || crypto.randomUUID().slice(0, 16);
    const seedName = process.env.SEED_ADMIN_NAME || 'Admin';
    const passwordHash = await bcrypt.hash(seedPassword, 12);
    global.db.createAdmin({ email: seedEmail, passwordHash, name: seedName, role: 'admin', createdBy: null });
    _startupLines.push(`Seed admin created: ${seedEmail} / ${process.env.SEED_ADMIN_PASSWORD ? '***' : seedPassword}`);
}

// Reapply SIP UA blocklist iptables rules from DB
import { reapplyBlocklist } from "./modules/admin/system.js";
reapplyBlocklist();

// Express — start HTTP servers first so FreeSWITCH xml_curl can always reach us
import ApiRouter from "./routes/api.js";
const { json, urlencoded } = express;

const app = express();

// Accept the public "/fs" prefix directly (Cloudflare Origin Rule routes
// hotlinehq.online/fs/* straight here without path rewriting). The cPanel
// reverse proxy strips "/fs" before forwarding, so this is a no-op for that
// path and both routes work during the migration.
app.use((req, res, next) => {
    if (req.url === '/fs' || req.url === '/fs/') req.url = '/';
    else if (req.url.startsWith('/fs/')) req.url = req.url.slice(3);
    next();
});

const setNoStoreHtml = (res) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
};

const sendAssetNotFound = (res) => {
    res.status(404).type("text/plain").send("Asset not found");
};
const immutableAssets = { maxAge: 365 * 24 * 60 * 60 * 1000, immutable: true };

const compressMiddleware = compression({
    filter: (req, res) => {
        if (req.headers.accept?.includes('text/event-stream')) return false;
        return compression.filter(req, res);
    }
});
app.use(compressMiddleware);
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'SAMEORIGIN');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.clarity.ms; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' wss: https:; media-src 'self' blob:; frame-src 'none'");
    next();
});
// Strip trailing slashes (except root)
// www → apex redirect
app.use((req, res, next) => {
    if (req.hostname === 'www.hotlinehq.online') {
        return res.redirect(301, `https://hotlinehq.online${req.originalUrl}`);
    }
    next();
});
// Strip trailing slashes (except root)
app.use((req, res, next) => {
    if (req.path.length > 1 && req.path.endsWith('/') && !req.path.startsWith('/api/')) {
        return res.redirect(301, req.path.slice(0, -1) + (req._parsedUrl.search || ''));
    }
    next();
});
app.use(cors({ origin: true, credentials: true }));
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(cookieParser());
// Admin app assets (dist/assets/) at /admin/
const adminDistDir = path.join(__dirname, "dist");
const adminAssets = express.static(path.join(adminDistDir, "assets"), { index: false, ...immutableAssets });
const sendAdminIndex = (req, res) => {
    setNoStoreHtml(res);
    res.sendFile(path.join(adminDistDir, "index.html"));
};
app.use("/admin/assets", adminAssets);
app.get("/admin/assets/*", (req, res) => sendAssetNotFound(res));
app.use("/admin", express.static(adminDistDir, { index: false }));

app.get("/sitemap.xml", (req, res) => {
    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.join(__dirname, "public", "sitemap.xml"));
});
app.use((req, res, next) => {
    if (req.path.endsWith('.js')) res.set('X-Robots-Tag', 'noindex');
    next();
}, express.static(path.join(__dirname, "public"), { maxAge: '7d' }));
import { requireAuth as _recAuth } from './service/auth/middleware.js';
app.use("/recordings", _recAuth, express.static(path.join(__dirname, "recordings")));

// Short URL redirect
app.get("/s/:code", (req, res) => {
    const row = global.db.getShortUrlByCode(req.params.code);
    if (!row) return res.status(404).send("Not found");
    if (row.expires_at && row.expires_at < Math.floor(Date.now() / 1000)) return res.status(410).send("Link expired");
    global.db.incrementShortUrlClicks(req.params.code);
    res.redirect(302, row.destination_url);
});

// Short URL CRUD — localhost only (no auth needed)
import shortUrlsLocalRouter from "./modules/admin/shortUrls.js";
app.use("/local", (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || '';
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return next();
    res.status(403).json({ status: false, error: "Localhost only" });
}, shortUrlsLocalRouter);

// System health — used by uptime monitors and the event-loop probe.
// Deliberately cheap: no child processes, one tiny DB read.
app.get("/api/v1/health", (req, res) => {
    let dbOk = false;
    try { global.db.getAllRooms(); dbOk = true; } catch {}
    let eslConnected = false;
    try { eslConnected = !!global.freeswitch?.isConnected?.(); } catch {}
    res.json({
        status: dbOk && eslConnected,
        uptime_s: Math.round(process.uptime()),
        esl_connected: eslConnected,
        db_ok: dbOk,
        ts: Date.now(),
    });
});

app.use("/api/v1/", new ApiRouter().apiRouter);

// Admin SPA fallback — any /admin/* that didn't match static files
app.get("/admin", sendAdminIndex);
app.get("/admin/", sendAdminIndex);
app.get("/admin/*", (req, res) => {
    if (path.extname(req.path)) return sendAssetNotFound(res);
    sendAdminIndex(req, res);
});

// Client app — serve at / (must be AFTER /api and /admin)
const clientDistDir = path.join(__dirname, "dist-client");
if (fs.existsSync(clientDistDir)) {
    const clientAssets = express.static(path.join(clientDistDir, "assets"), { index: false, ...immutableAssets });
    const clientIndexPath = path.join(clientDistDir, "index.html");

    let clientIndexHtml, routeChunks, preloadCache;
    function reloadClientIndex() {
        clientIndexHtml = fs.readFileSync(clientIndexPath, "utf8");
        const cssLinkMatch = clientIndexHtml.match(/<link[^>]+href="(\/assets\/[^"]+\.css)"[^>]*>/);
        if (cssLinkMatch) {
            const cssFileName = cssLinkMatch[1].replace(/^\//, '');
            const cssPath = path.join(clientDistDir, cssFileName);
            if (fs.existsSync(cssPath)) {
                const cssContent = fs.readFileSync(cssPath, "utf8");
                clientIndexHtml = clientIndexHtml.replace(cssLinkMatch[0], `<style>${cssContent}</style>`);
            }
        }
        const assetFiles = fs.readdirSync(path.join(clientDistDir, "assets")).filter(f => f.endsWith('.js'));
        const chunkMap = {};
        for (const f of assetFiles) {
            const name = f.replace(/-[A-Za-z0-9_-]+\.js$/, '');
            chunkMap[name] = `/assets/${f}`;
        }
        routeChunks = {
            '/client/signup': [chunkMap['SignupPage']],
            '/client/login': [chunkMap['LoginPage']],
            '/b/': [chunkMap['PublicBroadcastPage'], chunkMap['site']],
            '/': [chunkMap['Landing2Page'], chunkMap['site']],
            '/blog/post': [chunkMap['BlogPostPage'], chunkMap['site']],
        };
        preloadCache = {};
        console.log('Client index reloaded — asset hashes refreshed');
    }
    reloadClientIndex();

    // Watch for frontend rebuilds — auto-reload without pm2 restart
    // Watch the directory (not the file) because Vite delete+recreates index.html, which kills file watchers on Linux
    let reloadTimer;
    fs.watch(clientDistDir, (eventType, filename) => {
        if (filename !== 'index.html') return;
        clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => {
            try { reloadClientIndex(); } catch (e) { console.error('Client index reload failed:', e.message); }
        }, 500);
    });

    function getPreloadedHtml(routeKey) {
        if (preloadCache[routeKey]) return preloadCache[routeKey];
        const chunks = routeChunks[routeKey] || [];
        if (!chunks.length) {
            preloadCache[routeKey] = { html: clientIndexHtml, gz: zlib.gzipSync(clientIndexHtml) };
            return preloadCache[routeKey];
        }
        const hints = chunks.filter(Boolean).map(c => `<link rel="modulepreload" href="${c}">`).join('\n  ');
        const html = clientIndexHtml.replace('</head>', `  ${hints}\n</head>`);
        preloadCache[routeKey] = { html, gz: zlib.gzipSync(html) };
        return preloadCache[routeKey];
    }

    const sendClientIndex = (req, res) => {
        setNoStoreHtml(res);
        const p = req.path;
        const routeKey = p.startsWith('/b/') ? '/b/'
            : p.startsWith('/client/signup') ? '/client/signup'
            : p.startsWith('/client/login') ? '/client/login'
            : (p === '/' || p === '') ? '/'
            : null;
        const { html, gz } = getPreloadedHtml(routeKey);
        if (req.headers['accept-encoding']?.includes('gzip')) {
            res.set('Content-Encoding', 'gzip');
            res.set('Content-Type', 'text/html; charset=utf-8');
            res.end(gz);
        } else {
            res.type("html").send(html);
        }
    };

    app.use("/assets", (req, res, next) => {
        if (req.path.endsWith('.js')) res.set('X-Robots-Tag', 'noindex');
        next();
    }, clientAssets);
    app.get("/assets/*", (req, res) => sendAssetNotFound(res));
    // Service worker + manifest must never be cached long-term (browser re-checks them for updates)
    app.get("/sw.js", (req, res) => {
        res.set("Cache-Control", "no-cache");
        res.sendFile(path.join(clientDistDir, "sw.js"));
    });
    app.get("/manifest.webmanifest", (req, res) => {
        res.set("Cache-Control", "no-cache");
        res.type("application/manifest+json");
        res.sendFile(path.join(clientDistDir, "manifest.webmanifest"));
    });
    app.use(express.static(clientDistDir, { index: false }));

    // Pre-rendered static pages — serve before SPA catch-all so crawlers
    // get complete HTML without JavaScript. Falls through to Express SSR
    // routes if prerender file doesn't exist.
    const prerenderDir = path.join(clientDistDir, 'prerender');
    if (fs.existsSync(prerenderDir)) {
        app.use((req, res, next) => {
            if (req.method !== 'GET' && req.method !== 'HEAD') return next();
            if (req.path.startsWith('/api/') || req.path.startsWith('/admin/') || req.path.startsWith('/client/')) return next();
            if (path.extname(req.path) && !req.path.endsWith('.html')) return next();

            const route = req.path === '/' ? 'index' : req.path.slice(1);
            const htmlPath = path.join(prerenderDir, `${route}.html`);
            const gzPath = `${htmlPath}.gz`;

            if (!fs.existsSync(htmlPath)) return next();

            res.set('Content-Type', 'text/html; charset=utf-8');
            res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
            if (req.headers['accept-encoding']?.includes('gzip') && fs.existsSync(gzPath)) {
                res.set('Content-Encoding', 'gzip');
                res.sendFile(gzPath);
            } else {
                res.sendFile(htmlPath);
            }
        });
        console.log('Pre-rendered pages active — serving from dist-client/prerender/');
    }

    // Dynamic marketplace sitemap — all individual part listing URLs
    app.get("/sitemap-marketplace.xml", (req, res) => {
        try {
            const result = global.db.getMarketplaceListings({ page: 1, pageSize: 5000 });
            const baseUrl = 'https://hotlinehq.online';

            const generateSlug = (row) => {
                const pd = JSON.parse(row.part_details || '{}');
                const segments = [pd.year, pd.make, pd.model, pd.part]
                    .filter(v => v && v !== 'null')
                    .map(s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
                const room = global.db.getRoom(row.room);
                if (room?.short_code) segments.push(room.short_code.toLowerCase());
                segments.push(String(row.id));
                return segments.join('-');
            };

            const urls = result.data
                .filter(row => {
                    const pd = JSON.parse(row.part_details || '{}');
                    const isReal = v => v && v !== 'null' && v !== 'undefined' && String(v).trim().length > 1;
                    if (!isReal(pd.make) || !isReal(pd.model)) return false;
                    const placeholders = ['make', 'model', 'part-name', 'test', 'example', 'sample'];
                    if (placeholders.includes(String(pd.make).toLowerCase().trim())) return false;
                    const junkParts = ['kitty-cat', 'brain-box', 'kitty cat', 'brain box', 'test-part', 'asdf', 'xxx'];
                    const partLower = String(pd.part || '').toLowerCase().trim();
                    if (junkParts.some(j => partLower.includes(j))) return false;
                    return true;
                })
                .map(row => {
                    const slug = generateSlug(row);
                    const lastmod = new Date(row.created_at * 1000).toISOString().split('T')[0];
                    return `  <url>\n    <loc>${baseUrl}/parts/${slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
                });

            const xml = [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
                `  <url>\n    <loc>${baseUrl}/marketplace</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n  </url>`,
                ...urls,
                '</urlset>',
            ].join('\n');

            res.set('Content-Type', 'application/xml');
            res.set('Cache-Control', 'public, max-age=3600');
            res.send(xml);
        } catch (err) {
            console.error('[SEO] marketplace sitemap error:', err.message);
            res.status(500).set('Content-Type', 'application/xml').send(
                '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
            );
        }
    });

    // Marketplace SEO — inject meta tags for /marketplace before SPA fallback
    app.get("/marketplace", (req, res) => {
        sendSeoPage(req, res, {
            title: 'Used Auto Parts Wanted — Parts Marketplace | Hotline HQ',
            description: 'Browse unanswered used auto parts requests from 500+ dismantler yards across the US. Have the part they need? Respond and get connected directly.',
            url: `${BASE_URL}/marketplace`,
            keywords: 'used auto parts, auto parts marketplace, car parts wanted, dismantler parts, junkyard parts, salvage auto parts, used car parts near me',
            jsonLd: {
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                name: "Parts Marketplace",
                description: 'Browse unanswered used auto parts requests from 500+ dismantler yards across the US.',
                url: `${BASE_URL}/marketplace`,
                isPartOf: { "@type": "WebSite", name: "Hotline HQ", url: `${BASE_URL}/` },
                provider: { "@type": "Organization", name: "Hotline HQ" }
            }
        });
    });

    // Marketplace SEO — inject meta tags for /parts/:slug before SPA fallback
    app.get("/parts/:slug", (req, res) => {
        try {
            const slug = req.params.slug;
            const lastHyphen = slug.lastIndexOf('-');
            const id = parseInt(lastHyphen >= 0 ? slug.substring(lastHyphen + 1) : slug, 10);
            if (!id) { res.status(404); return sendClientIndex(req, res); }

            const broadcast = global.db.getMarketplaceListingById(id);
            if (!broadcast) { res.status(404); return sendClientIndex(req, res); }

            const pd = JSON.parse(broadcast.part_details || '{}');
            const isReal = v => v && v !== 'null' && String(v).trim() !== '';
            const year = isReal(pd.year) ? pd.year : '';
            const make = isReal(pd.make) ? pd.make : '';
            const model = isReal(pd.model) ? pd.model : '';
            const part = isReal(pd.part) ? pd.part : '';
            const spec = isReal(pd.specification) ? pd.specification : '';
            const vehicle = [year, make, model].filter(Boolean).join(' ');
            const partDesc = [vehicle, part].filter(Boolean).join(' ');
            const room = global.db.getRoom(broadcast.room);
            const region = room?.name || '';
            const url = `https://hotlinehq.online/parts/${slug}`;

            const title = `${partDesc || 'Part'} Needed in ${region} | Used Auto Parts | Hotline HQ`;
            const description = broadcast.answered
                ? `A ${region} dismantler needed a used ${partDesc}${spec ? ` (${spec})` : ''} — this request was filled live on the Hotline HQ network. Join to hear requests like this the moment they're broadcast.`
                : `${region} dismantler needs a used ${partDesc}${spec ? ` (${spec})` : ''}. Have this part in stock? Respond now and get connected on Hotline HQ Marketplace.`;
            const keywords = [make, model, part, 'used auto parts', 'salvage parts', region, 'car parts', 'dismantler', year].filter(Boolean).join(', ');

            const jsonLd = JSON.stringify({
                "@context": "https://schema.org",
                "@graph": [
                    {
                        "@type": "WantAction",
                        name: `Looking for ${partDesc || 'auto part'}`,
                        description: description,
                        url: url,
                        object: {
                            "@type": "Product",
                            name: `${vehicle} ${part}`.trim() || 'Auto Part',
                            category: "Used Auto Parts",
                            brand: make ? { "@type": "Brand", name: make } : undefined,
                            itemCondition: "https://schema.org/UsedCondition"
                        },
                        location: region ? { "@type": "AdministrativeArea", name: region } : undefined
                    },
                    {
                        "@type": "BreadcrumbList",
                        itemListElement: [
                            { "@type": "ListItem", position: 1, name: "Marketplace", item: `${BASE_URL}/marketplace` },
                            ...(region && ['California','Texas','Florida','Arizona'].includes(region) ? [{
                                "@type": "ListItem", position: 2,
                                name: `Used Auto Parts in ${region}`,
                                item: `${BASE_URL}/used-auto-parts/${region.toLowerCase().replace(/ /g, '-')}`
                            }] : []),
                            { "@type": "ListItem", position: region && ['California','Texas','Florida','Arizona'].includes(region) ? 3 : 2, name: title }
                        ]
                    }
                ]
            });

            sendSeoPage(req, res, {
                title,
                description,
                url,
                keywords,
                ogType: 'product',
                jsonLd: JSON.parse(jsonLd)
            });
        } catch {
            sendClientIndex(req, res);
        }
    });

    // SEO: server-side meta injection helper
    const BASE_URL = 'https://hotlinehq.online';
    const OG_IMAGE = `${BASE_URL}/og-default.png`;
    const SSR_STYLE = `<style id="ssr-s">:root{--ink:#16181d;--red:#d92d20;--bg:#fbfaf8;--muted:#5d6370;--line:#e7e4dd;--mono:ui-monospace,"SF Mono","Cascadia Mono",monospace;--body:system-ui,-apple-system,"Segoe UI",sans-serif}#ssr-shell{font-family:var(--body);background:var(--bg);color:var(--ink);min-height:100vh}.ssr-nav{display:flex;justify-content:space-between;align-items:center;padding:14px 32px;max-width:1200px;margin:0 auto}.ssr-logo{font-weight:900;font-size:21px;letter-spacing:-.01em}.ssr-logo em{font-style:normal;color:var(--red)}.ssr-hero{text-align:center;padding:140px 24px 60px;max-width:800px;margin:0 auto}.ssr-kicker{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--red);margin:0 0 18px}.ssr-hero h1{font-size:clamp(32px,5vw,56px);font-weight:700;line-height:1.08;letter-spacing:-.02em;margin:0 0 20px}.ssr-hero h1 em{font-style:normal;color:var(--red)}.ssr-sub{font-size:18px;color:var(--muted);line-height:1.6;margin:0 auto 32px;max-width:600px}.ssr-sub strong{color:var(--ink)}.ssr-cta{display:inline-block;background:var(--red);color:#fff;font-weight:600;font-size:15px;padding:14px 28px;border-radius:11px;text-decoration:none}.ssr-stats{display:flex;justify-content:center;gap:clamp(28px,6vw,80px);flex-wrap:wrap;padding:32px 0 48px}.ssr-stat{display:flex;flex-direction:column;align-items:center;gap:4px}.ssr-stat strong{font-size:36px;font-weight:700;line-height:1}.ssr-stat span{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}@media(max-width:640px){.ssr-hero{padding:100px 16px 40px}.ssr-hero h1{font-size:clamp(24px,7vw,36px)}.ssr-sub{font-size:15px}.ssr-stat strong{font-size:26px}.ssr-nav{padding:10px 16px}}.ssr-faq-section{max-width:800px;margin:0 auto;padding:48px 24px 64px}.ssr-faq-section h2{font-size:clamp(24px,3.5vw,36px);font-weight:700;letter-spacing:-.02em;margin:0 0 32px;text-align:center}.ssr-faq{background:#fff;border:1px solid var(--line);border-radius:12px;padding:24px 28px;margin-bottom:16px}.ssr-faq h3{font-size:17px;font-weight:700;margin:0 0 10px;color:var(--ink)}.ssr-faq p{font-size:15px;line-height:1.65;color:var(--muted);margin:0}</style>`;

    function ssrShell(kicker, h1, sub, ctaText, ctaHref, stats) {
        const statsHtml = stats ? stats.map(s => `<div class="ssr-stat"><strong>${s[0]}</strong><span>${s[1]}</span></div>`).join('') : '';
        return `<div id="ssr-shell"><nav class="ssr-nav"><span class="ssr-logo">Hotline <em>HQ</em></span></nav><div class="ssr-hero"><p class="ssr-kicker">${kicker}</p><h1>${h1}</h1><p class="ssr-sub">${sub}</p><a class="ssr-cta" href="${ctaHref}">${ctaText}</a></div>${statsHtml ? `<div class="ssr-stats">${statsHtml}</div>` : ''}</div>`;
    }

    function injectSeoMeta(base, { title, description, url, keywords, jsonLd, ogType = 'website', shell = '', robots, preloadChunks, ogImage, ssrData }) {
        const safeTitle = title.replace(/"/g, '&quot;');
        const safeDesc = description.replace(/"/g, '&quot;');
        const preloadHints = preloadChunks?.length
            ? preloadChunks.filter(Boolean).map(c => `<link rel="modulepreload" href="${c}">`).join('\n    ') + '\n    '
            : '';
        const metaTags = `
    ${preloadHints}${shell ? SSR_STYLE : ''}
    <meta name="description" content="${safeDesc}">
    ${keywords ? `<meta name="keywords" content="${keywords}">` : ''}
    ${robots ? `<meta name="robots" content="${robots}">` : ''}
    <link rel="canonical" href="${url}">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDesc}">
    <meta property="og:type" content="${ogType}">
    <meta property="og:url" content="${url}">
    <meta property="og:site_name" content="Hotline HQ">
    <meta property="og:image" content="${ogImage || OG_IMAGE}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${safeTitle}">
    <meta name="twitter:description" content="${safeDesc}">
    <meta name="twitter:image" content="${ogImage || OG_IMAGE}">
    ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
    ${ssrData ? `<script id="__BLOG_DATA__" type="application/json">${JSON.stringify(ssrData).replace(/<\/(script)/gi, '<\\/$1')}</script>` : ''}`;
        let html = base.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
        html = html.replace(/<meta name="description"[^>]*\/?>/, '');
        html = html.replace('</head>', `${metaTags}\n</head>`);
        if (shell) {
            html = html.replace(/<div id="root">[\s\S]*?<\/div>\s*<script/,  `<div id="root">${shell}</div>\n<script`);
        }
        return html;
    }

    function _routePreloads(routeKey) {
        return (routeChunks[routeKey] || []).filter(Boolean);
    }

    function sendSeoPage(req, res, seo, routeKey) {
        if (routeKey) seo.preloadChunks = _routePreloads(routeKey);
        const html = injectSeoMeta(clientIndexHtml, seo);
        res.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=60");
        if (req.headers['accept-encoding']?.includes('gzip')) {
            zlib.gzip(html, (err, gz) => {
                if (err || res.headersSent) { if (!res.headersSent) res.type("html").send(html); return; }
                res.set('Content-Encoding', 'gzip');
                res.set('Content-Type', 'text/html; charset=utf-8');
                res.end(gz);
            });
        } else {
            res.type("html").send(html);
        }
    }

    const orgJsonLd = {
        "@type": "Organization",
        "@id": `${BASE_URL}/#org`,
        name: "Hotline HQ",
        url: BASE_URL,
        logo: `${BASE_URL}/logo-512.png`,
        email: "hello@hotlinehq.online",
        description: "Hotline HQ builds and operates always-on voice hotline networks that connect businesses in the same industry — proven with a 500+ yard used auto parts network.",
        foundingDate: "2011",
        sameAs: [
            "https://www.linkedin.com/showcase/hotline-hq"
        ]
    };

    // SEO: Homepage
    app.get("/", (req, res) => {
        if (req.path !== '/' && req.path !== '') return sendClientIndex(req, res);
        sendSeoPage(req, res, {
            title: 'Hotline HQ — Find Used Auto Parts from 500+ Salvage Yards in Seconds',
            description: 'Broadcast what part you need to 500+ salvage yards at once. The first yard with your part answers in about 2 seconds. No fees, no commissions.',
            url: `${BASE_URL}/`,
            keywords: 'parts hotline, hotline hq, used auto parts network, salvage yard hotline, parts locating hotline',
            shell: ssrShell(
                'USED AUTO PARTS HOTLINE NETWORK',
                'One broadcast.<br>Every yard hears it.',
                'The live voice network that connects <strong>500+ auto dismantler yards</strong>. Ask for a part once — the nearest yard answers in about <strong>2 seconds</strong>.',
                'Sign Up Free', `${BASE_URL}/client/signup`,
                [['500+', 'Member yards'], ['12', 'Regional rooms'], ['2s', 'Typical answer'], ['24/7', 'Always on']]
            ),
            jsonLd: {
                "@context": "https://schema.org",
                "@graph": [
                    orgJsonLd,
                    { "@type": "WebSite", name: "Hotline HQ", url: `${BASE_URL}/`, publisher: { "@id": `${BASE_URL}/#org` } },
                    {
                        "@type": "Service",
                        name: "Hotline HQ voice hotline network",
                        serviceType: "Always-on business voice hotline network",
                        provider: { "@id": `${BASE_URL}/#org` },
                        areaServed: "US",
                        description: "An always-on voice hotline that connects member businesses by region. Members broadcast requests live and get answers in seconds.",
                        offers: { "@type": "Offer", priceCurrency: "USD", description: "Flat monthly membership per member business." }
                    }
                ]
            }
        }, '/');
    });

    // SEO: /find-used-auto-parts
    app.get("/find-used-auto-parts", (req, res) => {
        const faqItems = [
            { q: "What is an auto parts hotline?", a: "An auto parts hotline is a live voice network that connects salvage yards and auto dismantlers. Instead of calling yards one by one, you broadcast what you need to every yard in your region simultaneously and get answers in seconds. Hotline HQ operates the largest voice-based parts network in the US with 500+ member yards across 12 regional rooms." },
            { q: "How do I find a used auto part on Hotline HQ?", a: "Sign up free and select your regional room (California, Texas, Florida, Arizona, or any of our 12 markets). Key up on your desk phone or web client and describe the part you need — year, make, model, and what you're looking for. Your request goes out live to every yard in the room. Yards that have your part respond immediately on the line." },
            { q: "How fast do yards respond?", a: "The average response time on Hotline HQ is approximately 2 seconds. Because every yard in your regional room hears your request live, the first yard that has the part simply keys up and responds. There is no hold music, no voicemail, and no waiting for someone to check a database." },
            { q: "Is Hotline HQ free to use?", a: "Joining the network is free. Hotline HQ charges a flat monthly membership fee with no per-call costs and no commissions on sales. A preconfigured desk phone is included with membership and shipped directly to your location." },
            { q: "What parts can I find on Hotline HQ?", a: "Any used auto part that dismantler yards carry. The most-requested parts on the network are bumpers, transmissions, fenders, motors, doors, headlights, and AC compressors. The most-requested makes are Ford, Toyota, Honda, Chevrolet, and Nissan, spanning model years from the 1990s through 2025." },
            { q: "How is this different from online parts databases?", a: "Online parts databases go stale — inventory changes daily. On Hotline HQ, you are asking real people who can walk the yard and check right now. One broadcast reaches 100+ yards simultaneously, replacing what used to take an hour of phone calls." },
        ];
        const faqHtml = faqItems.map(f => `<div class="ssr-faq"><h3>${f.q}</h3><p>${f.a}</p></div>`).join('');
        const shell = ssrShell(
            'FIND PARTS FASTER',
            'Find used auto parts from <em>500+ yards</em> in seconds',
            'Stop calling yard after yard. Broadcast what you need on Hotline HQ and every dismantler in your region hears it live. Average answer time: <strong>2 seconds</strong>.',
            'Start Finding Parts — Free', `${BASE_URL}/client/signup`
        ) + `<div class="ssr-faq-section"><h2>Frequently Asked Questions</h2>${faqHtml}</div>`;

        sendSeoPage(req, res, {
            title: 'Find Used Auto Parts — Search 500+ Yards Instantly | Hotline HQ',
            description: 'Find used auto parts from 500+ dismantler yards in seconds. Broadcast what you need on the Hotline HQ voice network and get live answers — no databases, no waiting.',
            url: `${BASE_URL}/find-used-auto-parts`,
            keywords: 'find used auto parts, used auto parts near me, used car parts, salvage auto parts, junkyard parts, auto parts search, auto parts hotline, how to find used car parts',
            shell,
            jsonLd: {
                "@context": "https://schema.org",
                "@graph": [
                    {
                        "@type": "Service",
                        name: "Hotline HQ — Find Used Auto Parts",
                        serviceType: "Used Auto Parts Search Network",
                        provider: { "@type": "Organization", name: "Hotline HQ", url: `${BASE_URL}/` },
                        areaServed: { "@type": "Country", name: "US" },
                        description: "Live voice network connecting auto dismantlers. Broadcast what part you need and get answers from 500+ yards in seconds.",
                        offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free to join" }
                    },
                    {
                        "@type": "FAQPage",
                        mainEntity: faqItems.map(f => ({
                            "@type": "Question",
                            name: f.q,
                            acceptedAnswer: { "@type": "Answer", text: f.a }
                        }))
                    }
                ]
            }
        });
    });

    // SEO: /sell-used-auto-parts
    app.get("/sell-used-auto-parts", (req, res) => {
        const faqItems = [
            { q: "What is the best way to sell used auto parts online?", a: "It depends on volume. For salvage yards selling dozens of parts daily, voice hotline networks like Hotline HQ offer the fastest turnaround — one broadcast reaches 100+ yards and responses arrive in about 2 seconds. For individual sellers moving one or two parts, eBay Motors or Facebook Marketplace provide the widest buyer reach. Most profitable yards combine two to three channels rather than relying on just one." },
            { q: "How much does it cost to sell auto parts on eBay?", a: "eBay Motors charges an insertion fee (often waived for the first 250 listings per month) plus a final value fee of approximately 13.25% of the sale price. For a $200 transmission, that's roughly $26.50 in fees. eBay also charges payment processing fees. Compare that to Hotline HQ, which charges a flat monthly membership with no per-sale fees or commissions." },
            { q: "Can I sell used auto parts without listing inventory online?", a: "Yes. On voice hotline networks, you listen for live part requests and respond when you have what someone needs. There is no inventory database to maintain. This works especially well for yards with large, uncataloged inventory — the network surfaces demand you would never find through listings alone." },
            { q: "How do I sell used auto parts on Facebook Marketplace?", a: "Create a listing with clear photos (multiple angles), accurate part details (year, make, model, OEM part number), condition description, and a competitive price. Use keywords buyers actually search — 'Ford F-150 headlight assembly' performs better than 'truck headlight.' Respond to messages quickly; buyers on Facebook expect answers within an hour." },
            { q: "What used auto parts sell the fastest?", a: "On the Hotline HQ network, the most-requested parts are bumpers, transmissions, fenders, motors, doors, headlights, and AC compressors. The most-requested makes are Ford, Toyota, Honda, Chevrolet, and Nissan. Parts from common vehicles in the 5–15 year old range sell fastest because demand is highest and supply keeps pace." },
            { q: "Is it legal to sell used auto parts?", a: "Yes. Selling used auto parts is legal in all 50 US states. Salvage yards need a state-issued dismantler or auto recycler license (requirements vary by state). Individual sellers can sell parts from their own vehicles without a license in most states. Certain regulated parts like catalytic converters and airbags have additional requirements." },
            { q: "How do I price used auto parts?", a: "Start with Car-Part.com to check what other yards charge for the same part. Price by condition: Grade A (low mileage, excellent) commands 60–70% of new OEM price, Grade B (average wear) 40–50%, and Grade C (functional but cosmetically imperfect) 25–35%. High-demand parts from common vehicles can be priced higher." },
        ];
        const faqHtml = faqItems.map(f => `<div class="ssr-faq"><h3>${f.q}</h3><p>${f.a}</p></div>`).join('');

        const guideHtml = `<article style="max-width:800px;margin:0 auto;padding:0 24px 64px">
<p>The used auto parts market in the US generates roughly $32 billion in annual revenue across more than 9,000 yards. If you run a salvage yard or have parts to move, your choice of sales channel determines whether a part sits on a shelf for months or sells within hours.</p>
<p>This guide compares seven ways to sell used auto parts online — from high-volume platforms like eBay Motors to yard-to-yard voice networks. Each has different fees, speed, and reach.</p>
<p><em>Disclosure: Hotline HQ publishes this guide and operates a voice hotline network (Method 5 below). We have ranked all seven methods by their actual strengths and weaknesses.</em></p>
<blockquote><strong>Key Takeaways</strong><br>Voice hotline networks deliver the fastest yard-to-yard sales — about 2 seconds per broadcast. eBay Motors offers the widest national reach but takes 13% in fees. Facebook Marketplace is free but time-intensive. Most profitable yards stack two to three channels, not just one.</blockquote>
<h2>Method 1: eBay Motors</h2>
<p>eBay Motors is the largest online marketplace for used auto parts with over 80 million live part listings. Sellers range from individual car owners to large salvage operations.</p>
<p><strong>Fees:</strong> Final value fee of approximately 13.25% of the total sale price (including shipping), plus a $0.30 per-order fee. For a $300 part, expect to pay roughly $40 in total fees.</p>
<p><strong>Speed:</strong> Parts can take days to weeks to sell. High-demand items move faster. Shipping adds 3–7 business days.</p>
<p><strong>Best for:</strong> Yards with cataloged inventory and staff to photograph, list, pack, and ship individual parts.</p>
<h2>Method 2: Facebook Marketplace</h2>
<p>Facebook Marketplace reaches over 1 billion users worldwide. Especially strong for local pickup sales.</p>
<p><strong>Fees:</strong> Free for local pickup listings. Shipped orders incur a 6% selling fee.</p>
<p><strong>Speed:</strong> Local sales can happen same day. You will spend significant time answering messages — many inquiries don't convert.</p>
<p><strong>Best for:</strong> Individual sellers and small yards selling locally. Effective for large, heavy parts where shipping is prohibitive.</p>
<h2>Method 3: Car-Part.com</h2>
<p>Car-Part.com is the industry standard, connecting professional buyers with recycler inventory. Over 200 million parts listed.</p>
<p><strong>Fees:</strong> Monthly subscription (varies by yard size). No per-transaction fees. Requires compatible yard management software.</p>
<p><strong>Best for:</strong> Established yards with inventory management systems already in place.</p>
<h2>Method 4: Craigslist</h2>
<p>Free, attracts price-conscious buyers. Strictly local, cash transactions.</p>
<p><strong>Best for:</strong> Occasional sellers clearing out low-value or bulk parts.</p>
<h2>Method 5: Voice Hotline Networks (Hotline HQ)</h2>
<p>When one yard needs a part, they broadcast the request to every yard in the room. Any yard with that part responds instantly. One broadcast reaches 100+ yards, average response: 2 seconds.</p>
<p><strong>Fees:</strong> Flat monthly membership. No per-call charges, no listing fees, no commissions. Desk phone included.</p>
<p><strong>Best for:</strong> Salvage yards selling to other yards. No inventory listing needed — just listen and respond.</p>
<h2>Method 6: PartCycle</h2>
<p>B2B marketplace connecting recyclers with repair shops, insurance companies, and fleet operators.</p>
<p><strong>Best for:</strong> Yards focused on B2B sales with graded, warrantied parts.</p>
<h2>Method 7: Your Own Website</h2>
<p>Full control over branding, pricing, and customer relationships. Requires marketing investment.</p>
<p><strong>Best for:</strong> Larger operations with marketing resources, as a complement to other channels.</p>
<h2>Which Method Should You Use?</h2>
<ul>
<li><strong>High-volume yard-to-yard:</strong> Voice hotline (fastest, no per-sale fees)</li>
<li><strong>National reach:</strong> eBay Motors (widest audience, highest fees)</li>
<li><strong>Local large parts:</strong> Facebook Marketplace or Craigslist (free)</li>
<li><strong>Professional B2B:</strong> Car-Part.com + PartCycle</li>
</ul>
<p>Most profitable yards run two to three channels. <a href="${BASE_URL}/blog/guides/how-salvage-yards-sell-more-parts">Read our full guide on stacking sales channels</a>.</p>
</article>`;

        const shell = ssrShell(
            'SELL PARTS FASTER',
            'How to sell used auto parts online — <em>7 methods compared</em>',
            'Compare eBay, Facebook Marketplace, Car-Part.com, voice hotlines, and more. See real fees, speed, and reach for each channel so you pick the right ones for your yard.',
            'Join the Network — Free', `${BASE_URL}/client/signup`,
            [['500+', 'Yards on network'], ['12', 'Regional rooms'], ['~115', 'Listeners per call'], ['24/7', 'Always on']]
        ) + guideHtml + `<div class="ssr-faq-section"><h2>Frequently Asked Questions</h2>${faqHtml}</div>`;

        sendSeoPage(req, res, {
            title: 'How to Sell Used Auto Parts Online — 7 Methods Compared (2026)',
            description: 'Compare eBay, Facebook Marketplace, Car-Part.com, and 4 more ways to sell used auto parts online. See which channel sells fastest with real data.',
            url: `${BASE_URL}/sell-used-auto-parts`,
            keywords: 'sell used auto parts online, how to sell used auto parts, best place to sell used auto parts, sell auto parts, where to sell used auto parts',
            shell,
            jsonLd: {
                "@context": "https://schema.org",
                "@graph": [
                    {
                        "@type": "Article",
                        headline: "How to Sell Used Auto Parts Online — 7 Methods Compared (2026)",
                        description: "Compare eBay, Facebook Marketplace, Car-Part.com, and 4 more ways to sell used auto parts online.",
                        url: `${BASE_URL}/sell-used-auto-parts`,
                        publisher: { "@type": "Organization", name: "Hotline HQ", url: `${BASE_URL}/` },
                        datePublished: "2026-07-28",
                        dateModified: "2026-07-28",
                        mainEntityOfPage: `${BASE_URL}/sell-used-auto-parts`,
                    },
                    {
                        "@type": "FAQPage",
                        mainEntity: faqItems.map(f => ({
                            "@type": "Question",
                            name: f.q,
                            acceptedAnswer: { "@type": "Answer", text: f.a }
                        }))
                    }
                ]
            }
        });
    });

    // SEO: /blog
    app.get("/blog", (req, res) => {
        sendSeoPage(req, res, {
            title: 'Blog — Auto Parts Industry Guides & Network Updates | Hotline HQ',
            description: 'Industry guides, network updates, and parts market insights from Hotline HQ — the voice network connecting 500+ auto dismantler yards.',
            url: `${BASE_URL}/blog`,
            keywords: 'auto parts blog, dismantler industry, salvage yard tips, used auto parts guide, hotline hq blog',
            shell: ssrShell(
                'HOTLINE HQ',
                'Blog',
                'Industry guides, network updates, and parts market insights from the largest voice parts network in the US.',
                'Browse Posts', `${BASE_URL}/blog`
            ),
            jsonLd: {
                "@context": "https://schema.org",
                "@type": "Blog",
                name: "Hotline HQ Blog",
                description: "Industry guides, network updates, and parts market insights from Hotline HQ.",
                url: `${BASE_URL}/blog`,
                publisher: { "@type": "Organization", name: "Hotline HQ", url: `${BASE_URL}/` }
            }
        });
    });

    // SEO: /blog/:category
    const BLOG_CATS = {
        guides: { label: 'Industry Guides', desc: 'How-to guides and explainers for the auto dismantler industry' },
        news: { label: 'Network Updates', desc: 'New rooms, milestones, and member stories from the Hotline HQ network' },
        market: { label: 'Parts Market', desc: 'Popular parts, seasonal trends, and pricing insights from 500+ yards' },
    };
    app.get("/blog/:category", (req, res) => {
        const cat = BLOG_CATS[req.params.category];
        if (!cat) { res.status(404); return sendClientIndex(req, res); }
        sendSeoPage(req, res, {
            title: `${cat.label} — Hotline HQ Blog`,
            description: cat.desc,
            url: `${BASE_URL}/blog/${req.params.category}`,
            keywords: `${cat.label.toLowerCase()}, auto parts blog, hotline hq`,
            shell: ssrShell(
                'BLOG',
                cat.label,
                cat.desc,
                'Browse Posts', `${BASE_URL}/blog`
            ),
            jsonLd: {
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                name: `${cat.label} — Hotline HQ Blog`,
                description: cat.desc,
                url: `${BASE_URL}/blog/${req.params.category}`,
                isPartOf: { "@type": "Blog", name: "Hotline HQ Blog", url: `${BASE_URL}/blog` }
            }
        });
    });

    // 301 redirect: old pillar page URL → new blog URL
    app.get("/how-auto-parts-hotlines-work", (req, res) => {
        res.redirect(301, `${BASE_URL}/blog/guides/how-auto-parts-hotlines-work`);
    });

    // Blog post API + SSR
    const blogSsrPath = path.join(__dirname, 'data', 'blog-ssr-data.json');
    let blogSsrData = { posts: [] };
    try { blogSsrData = JSON.parse(fs.readFileSync(blogSsrPath, 'utf8')); } catch {}

    app.get("/api/v1/blog/:category/:slug", (req, res) => {
        const post = blogSsrData.posts.find(p => p.category === req.params.category && p.slug === req.params.slug);
        if (!post) return res.status(404).json({ status: false, error: 'Post not found' });
        res.json({ status: true, data: post });
    });

    app.get("/blog/:category/:slug", (req, res) => {
        const post = blogSsrData.posts.find(p => p.category === req.params.category && p.slug === req.params.slug);
        if (!post) { res.status(404); return sendClientIndex(req, res); }

        const postUrl = `${BASE_URL}/blog/${post.category}/${post.slug}`;
        const catLabel = BLOG_CATS[post.category]?.label || post.category;

        const faqHtml = post.faq.length > 0
            ? `<div class="ssr-faq-section"><h2>Frequently Asked Questions</h2>${post.faq.map(f => `<div class="ssr-faq"><h3>${f.q}</h3><p>${f.a}</p></div>`).join('')}</div>`
            : '';

        const contentHtml = `<article style="max-width:800px;margin:0 auto;padding:0 24px 64px">${post.bodyHtml}</article>`;

        const shell = ssrShell(
            catLabel.toUpperCase(),
            post.title,
            post.description,
            'Join the Network — Free', `${BASE_URL}/client/signup`
        ) + contentHtml + faqHtml;

        const jsonLdGraph = [
            {
                "@type": "Article",
                headline: post.title,
                description: post.description,
                url: postUrl,
                publisher: { "@type": "Organization", name: "Hotline HQ", url: `${BASE_URL}/` },
                datePublished: post.date,
                dateModified: post.lastUpdated || post.date,
                mainEntityOfPage: postUrl,
            },
        ];
        if (post.faq.length > 0) {
            jsonLdGraph.push({
                "@type": "FAQPage",
                mainEntity: post.faq.map(f => ({
                    "@type": "Question",
                    name: f.q,
                    acceptedAnswer: { "@type": "Answer", text: f.a }
                }))
            });
        }

        sendSeoPage(req, res, {
            title: `${post.title} — ${catLabel} | Hotline HQ`,
            description: post.description,
            url: postUrl,
            keywords: post.keywords || '',
            ogImage: post.ogImage ? `${BASE_URL}${post.ogImage}` : null,
            shell,
            ssrData: post,
            jsonLd: { "@context": "https://schema.org", "@graph": jsonLdGraph }
        }, '/blog/post');
    });

    // SEO: /own-a-hotline
    app.get("/own-a-hotline", (req, res) => {
        sendSeoPage(req, res, {
            title: 'Start an Auto Parts Hotline Business — Own a Regional Network | Hotline HQ',
            description: 'Launch your own voice hotline network for auto dismantlers. Platform, phones, and support included — you collect the membership revenue.',
            url: `${BASE_URL}/own-a-hotline`,
            keywords: 'own a hotline, start a hotline business, start auto parts business, voice hotline franchise, hotline network owner',
            shell: ssrShell(
                'OWN THE HOTLINE',
                'Launch a voice hotline network <em>in your industry</em>',
                'Hotline HQ provides the platform, phones, and support. You own the membership revenue. Proven with <strong>500+ auto dismantler yards</strong> across 12 regional rooms.',
                'Get Started', `mailto:hello@hotlinehq.online`
            ),
            jsonLd: {
                "@context": "https://schema.org",
                "@graph": [
                    {
                        "@type": "Service",
                        name: "Own a Hotline — Hotline HQ Platform",
                        serviceType: "Voice Hotline Network Platform",
                        provider: { "@type": "Organization", name: "Hotline HQ", url: `${BASE_URL}/`, email: "hello@hotlinehq.online" },
                        areaServed: "US",
                        description: "Launch and operate your own always-on voice hotline network. Platform, desk phones, and support included."
                    },
                    {
                        "@type": "FAQPage",
                        mainEntity: [
                            { "@type": "Question", name: "What does an owner actually do?", acceptedAnswer: { "@type": "Answer", text: "You sign up yards in your area, set the membership price, and collect monthly dues. Hotline HQ handles all the technology — phones, network, monitoring — so you focus on relationships and growth." } },
                            { "@type": "Question", name: "Do I need technical skills?", acceptedAnswer: { "@type": "Answer", text: "No. Hotline HQ provides all the infrastructure. Phones are preconfigured and ship directly to your members. You manage your network through a simple web dashboard." } },
                            { "@type": "Question", name: "What industries can use a hotline?", acceptedAnswer: { "@type": "Answer", text: "Any industry where businesses need to locate inventory across a network of peers — auto dismantlers, heavy truck parts, building materials, wholesale distribution, and more." } }
                        ]
                    }
                ]
            }
        });
    });

    // Feature pages — generated from content/features/*.md by build-blog.mjs
    const featuresDataPath = path.join(__dirname, 'data', 'features-ssr-data.json');
    let featuresData = {};
    try {
        featuresData = JSON.parse(fs.readFileSync(featuresDataPath, 'utf8')).features || {};
        console.log('Features data loaded —', Object.keys(featuresData).length, 'features');
    } catch (e) { console.error('Features data load failed:', e.message); }

    // API: feature content for client-side rendering
    app.get("/api/v1/features/:slug", (req, res) => {
        const f = featuresData[req.params.slug];
        if (!f) return res.status(404).json({ status: false, error: 'Feature not found' });
        res.json({ status: true, data: { slug: req.params.slug, ...f } });
    });
    app.get("/api/v1/features", (req, res) => {
        const list = Object.entries(featuresData).map(([slug, f]) => ({ slug, title: f.title, accent: f.accent, seo: f.seo, hero: f.hero }));
        res.json({ status: true, data: list });
    });

    // Industry pages — generated from content/industries/*.md by build-blog.mjs
    const industriesDataPath = path.join(__dirname, 'data', 'industry-ssr-data.json');
    let industriesData = {};
    try {
        industriesData = JSON.parse(fs.readFileSync(industriesDataPath, 'utf8')).industries || {};
        console.log('Industries data loaded —', Object.keys(industriesData).length, 'industries');
    } catch (e) { console.error('Industries data load failed:', e.message); }

    app.get("/api/v1/industries/:slug", (req, res) => {
        const p = industriesData[req.params.slug];
        if (!p) return res.status(404).json({ status: false, error: 'Industry not found' });
        res.json({ status: true, data: { slug: req.params.slug, ...p } });
    });
    app.get("/api/v1/industries", (req, res) => {
        const list = Object.entries(industriesData).map(([slug, p]) => ({ slug, title: p.title, type: p.type, seo: p.seo, hero: p.hero }));
        res.json({ status: true, data: list });
    });

    // SEO: /features/:slug
    app.get("/features/:slug", (req, res) => {
        const f = featuresData[req.params.slug];
        if (!f) { res.status(404); return sendClientIndex(req, res); }
        const seo = f.seo;
        const faqJsonLd = f.faqs?.length ? [{ "@type": "FAQPage", mainEntity: f.faqs.map(item => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) }] : [];

        // Crawler-visible content: problem, steps, benefits, scenario, FAQs, resources
        const stepsHtml = f.steps?.length ? `<h2>How It Works</h2><ol>${f.steps.map(s => `<li><strong>${s.title}.</strong> ${s.desc}</li>`).join('')}</ol>` : '';
        const benefitsHtml = f.benefits?.length ? `<h2>Key Benefits</h2><ul>${f.benefits.map(b => `<li><strong>${b.title}.</strong> ${b.desc}</li>`).join('')}</ul>` : '';
        const problemHtml = f.problem?.text ? `<h2>${f.problem.heading || 'The Problem'}</h2><p>${f.problem.text}</p>` : '';
        const scenarioHtml = f.scenario?.text ? `<h2>${f.scenario.heading || 'Real-World Scenario'}</h2><p>${f.scenario.text}</p>` : '';
        const featFaqHtml = f.faqs?.length ? `<div class="ssr-faq-section"><h2>Frequently Asked Questions</h2>${f.faqs.map(item => `<div class="ssr-faq"><h3>${item.q}</h3><p>${item.a}</p></div>`).join('')}</div>` : '';
        const featResourcesHtml = f.resources?.length ? `<h2>Keep Exploring</h2><ul>${f.resources.map(r => `<li><a href="${BASE_URL}${r.href}">${r.label}</a></li>`).join('')}</ul>` : '';
        const featContentHtml = `<article style="max-width:800px;margin:0 auto;padding:0 24px 40px">${problemHtml}${stepsHtml}${benefitsHtml}${scenarioHtml}${featResourcesHtml}</article>${featFaqHtml}`;

        sendSeoPage(req, res, {
            title: seo.title,
            description: seo.description,
            keywords: seo.keywords,
            url: `${BASE_URL}/features/${req.params.slug}`,
            ogImage: f.image ? `${BASE_URL}${f.image}` : null,
            shell: ssrShell(f.hero.kicker, f.hero.heading, f.hero.lede, 'Sign Up Free', `${BASE_URL}/client/signup`) + (f.image ? `<div style="text-align:center;padding:24px"><img src="${f.image}" alt="${f.imageAlt || f.title}" style="max-width:380px;width:100%" loading="eager"></div>` : '') + featContentHtml,
            jsonLd: {
                "@context": "https://schema.org",
                "@graph": [
                    { "@type": "BreadcrumbList", itemListElement: [
                        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
                        { "@type": "ListItem", position: 2, name: "Features", item: `${BASE_URL}/own-a-hotline` },
                        { "@type": "ListItem", position: 3, name: f.title, item: `${BASE_URL}/features/${req.params.slug}` },
                    ]},
                    { "@type": "Service", name: `${f.title} — Hotline HQ`, serviceType: "Voice Hotline Network Feature", provider: { "@type": "Organization", name: "Hotline HQ", url: `${BASE_URL}/` }, description: seo.description },
                    ...faqJsonLd,
                ]
            }
        });
    });

    // SEO: /about
    app.get("/about", (req, res) => {
        sendSeoPage(req, res, {
            title: 'About Hotline HQ — Built by Dismantlers, for Dismantlers Since 2011',
            description: 'Started as a single phone line between two California salvage yards in 2011. Today Hotline HQ connects 500+ yards across 12 rooms — the largest voice parts network in the US.',
            url: `${BASE_URL}/about`,
            shell: ssrShell(
                'COMPANY',
                'About Hotline HQ',
                'Hotline HQ is an always-on voice network that connects salvage yards and auto recyclers so they can locate and sell used parts for each other\'s customers — in seconds, not hours.',
                'Home', `${BASE_URL}/`
            ),
            jsonLd: { "@context": "https://schema.org", "@type": "AboutPage", name: "About Hotline HQ", url: `${BASE_URL}/about`, mainEntity: { "@id": `${BASE_URL}/#org` } }
        });
    });

    // SEO: Legal pages
    app.get("/privacy-policy", (req, res) => {
        sendSeoPage(req, res, {
            title: 'Privacy Policy | Hotline HQ',
            description: 'How Hotline HQ collects, uses, and protects member information — including call recordings, account data, and your choices.',
            url: `${BASE_URL}/privacy-policy`
        });
    });
    app.get("/terms-and-conditions", (req, res) => {
        sendSeoPage(req, res, {
            title: 'Terms & Conditions | Hotline HQ',
            description: 'Membership terms for the Hotline HQ voice network: billing, acceptable use, member-to-member deals, equipment, and recordings.',
            url: `${BASE_URL}/terms-and-conditions`
        });
    });
    app.get("/disclaimer", (req, res) => {
        sendSeoPage(req, res, {
            title: 'Disclaimer | Hotline HQ',
            description: 'What the figures and demos on this site represent, and what Hotline HQ does and does not guarantee about member-to-member deals.',
            url: `${BASE_URL}/disclaimer`
        });
    });

    // SEO: Regional used auto parts pages
    const ACTIVE_REGIONS = new Set(['california', 'texas', 'florida', 'arizona']);
    let regionsContent = {};
    try {
        regionsContent = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'regions-ssr-data.json'), 'utf8'));
        console.log('Regions content loaded —', Object.keys(regionsContent).length, 'regions');
    } catch (e) { console.error('Regions content load failed:', e.message); }
    const REGIONS = {
        california: { name: 'California', abbr: 'CA' },
        texas: { name: 'Texas', abbr: 'TX' },
        florida: { name: 'Florida', abbr: 'FL' },
        arizona: { name: 'Arizona', abbr: 'AZ' },
        ohio: { name: 'Ohio', abbr: 'OH' },
        'new-york': { name: 'New York', abbr: 'NY' },
        georgia: { name: 'Georgia', abbr: 'GA' },
        indiana: { name: 'Indiana', abbr: 'IN' },
        michigan: { name: 'Michigan', abbr: 'MI' },
        carolinas: { name: 'Carolinas', abbr: 'NC/SC' },
        'new-jersey': { name: 'New Jersey', abbr: 'NJ' },
        'san-diego': { name: 'San Diego', abbr: 'SD' },
        iowa: { name: 'Iowa', abbr: 'IA' },
        kentucky: { name: 'Kentucky', abbr: 'KY' },
        alberta: { name: 'Alberta', abbr: 'AB' },
        canada: { name: 'Canada', abbr: 'CA' },
        mexico: { name: 'Mexico', abbr: 'MX' },
        egypt: { name: 'Egypt', abbr: 'EG' },
        spain: { name: 'Spain', abbr: 'ES' },
        ghana: { name: 'Ghana', abbr: 'GH' },
    };
    app.get("/used-auto-parts/:state", (req, res) => {
        const region = REGIONS[req.params.state];
        if (!region) { res.status(404); return sendClientIndex(req, res); }

        // Enrich with real data from DB
        const room = global.db.getAllRooms().find(r => r.short_code === region.abbr || r.name === region.name);
        let yardCount = 0, totalBroadcasts = 0, activeBroadcasts = 0, topMakes = [];
        if (room) {
            try {
                const roomStats = global.db.getMarketplaceRoomStats(room.id);
                yardCount = roomStats.yardCount || 0;
                totalBroadcasts = roomStats.totalBroadcasts || 0;
                activeBroadcasts = roomStats.activeBroadcasts || 0;
                topMakes = (roomStats.topMakes || []).map(m => m.name).slice(0, 3);
            } catch {}
        }
        const yardText = yardCount > 0 ? `${yardCount} member yards` : 'dismantler yards';
        const recentText = activeBroadcasts > 0 ? ` with ${activeBroadcasts} part requests in the last 7 days` : '';
        const makesText = topMakes.length > 0 ? ` Top makes: ${topMakes.join(', ')}.` : '';
        const stats = yardCount > 0 ? [[String(yardCount), `${region.abbr} yards`], [String(totalBroadcasts), 'Total requests'], [String(activeBroadcasts), 'This week'], ['24/7', 'Always on']] : undefined;

        const title = `Used Auto Parts in ${region.name} — ${region.abbr} Dismantler Network | Hotline HQ`;
        const description = `Find and sell used auto parts in ${region.name}. ${yardText} on a live voice network${recentText}.${makesText} Broadcast what you need and get answers in seconds.`;

        // Crawler-visible content sections from regions-ssr-data.json
        const rc = ACTIVE_REGIONS.has(req.params.state) ? regionsContent[req.params.state] : null;
        let contentHtml = '';
        if (rc) {
            const citiesHtml = (rc.cities || []).map(c => `<div class="ssr-faq"><h3>${c.name}</h3><p>${c.blurb}</p></div>`).join('');
            const faqHtml = (rc.faqs || []).map(f => `<div class="ssr-faq"><h3>${f.q}</h3><p>${f.a}</p></div>`).join('');
            const resourcesHtml = (rc.resources || []).map(r => `<li><a href="${BASE_URL}${r.href}">${r.label}</a></li>`).join('');
            contentHtml = `<article style="max-width:800px;margin:0 auto;padding:0 24px 40px">
                <h2>Used Auto Parts in ${region.name} — How It Works</h2>
                <p>${rc.intro}</p>
                <h3>${region.name} Coverage Area</h3>
                <p>${rc.geography}</p>
                <h3>Most-Requested Parts in ${region.abbr}</h3>
                <p>${rc.popular}</p>
                ${rc.whyVoice ? `<h3>Why a Live Voice Network Beats a Parts Database</h3><p>${rc.whyVoice}</p>` : ''}
            </article>
            ${citiesHtml ? `<div class="ssr-faq-section"><h2>Used auto parts across ${region.name}</h2>${citiesHtml}</div>` : ''}
            ${faqHtml ? `<div class="ssr-faq-section"><h2>${region.name} used auto parts — common questions</h2>${faqHtml}</div>` : ''}
            ${resourcesHtml ? `<div class="ssr-faq-section"><h2>Guides and tools for ${region.name} buyers and yards</h2><ul>${resourcesHtml}</ul></div>` : ''}`;
        }

        const jsonLdGraph = [
            {
                "@type": "Service",
                name: `Hotline HQ — Used Auto Parts in ${region.name}`,
                serviceType: "Used Auto Parts Network",
                provider: { "@type": "Organization", name: "Hotline HQ", url: `${BASE_URL}/` },
                areaServed: { "@type": "AdministrativeArea", name: region.name },
                description
            },
            {
                "@type": "BreadcrumbList", itemListElement: [
                    { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
                    { "@type": "ListItem", position: 2, name: "Find Used Auto Parts", item: `${BASE_URL}/find-used-auto-parts` },
                    { "@type": "ListItem", position: 3, name: `Used Auto Parts in ${region.name}`, item: `${BASE_URL}/used-auto-parts/${req.params.state}` },
                ]
            },
        ];
        if (rc?.faqs?.length) {
            jsonLdGraph.push({
                "@type": "FAQPage",
                mainEntity: rc.faqs.map(f => ({
                    "@type": "Question",
                    name: f.q,
                    acceptedAnswer: { "@type": "Answer", text: f.a }
                }))
            });
        }

        sendSeoPage(req, res, {
            title,
            description,
            url: `${BASE_URL}/used-auto-parts/${req.params.state}`,
            keywords: `used auto parts ${region.name}, ${region.abbr} auto parts, ${region.name} dismantler, junkyard parts ${region.name}, salvage auto parts ${region.abbr}`,
            robots: ACTIVE_REGIONS.has(req.params.state) ? undefined : 'noindex, follow',
            shell: ssrShell(
                `${region.abbr} NETWORK`,
                `Used auto parts in <em>${region.name}</em>`,
                `Hotline HQ's ${region.name} room connects ${yardText} on a live voice hotline${recentText}. Broadcast what you need — every yard in ${region.name} hears it instantly.`,
                `Join ${region.name} Room — Free`, `${BASE_URL}/client/signup?room=${encodeURIComponent(region.name)}`,
                stats
            ) + contentHtml,
            jsonLd: { "@context": "https://schema.org", "@graph": jsonLdGraph }
        });
    });

    // Known client-side routes (no SEO injection needed but must return 200)
    const CLIENT_ROUTES = ['/client/login', '/client/signup', '/client/forgot-password', '/client/reset-password',
        '/client/dashboard', '/classic', '/landing_2'];
    for (const route of CLIENT_ROUTES) {
        app.get(route, sendClientIndex);
        app.get(`${route}/*`, sendClientIndex);
    }
    app.get("/b/:token", sendClientIndex);

    // SPA fallback — return 404 status for unknown routes (fixes soft 404s)
    app.get("*", (req, res, next) => {
        if (req.path.startsWith('/api/') || req.path.startsWith('/admin/') || req.path.startsWith('/recordings/')) return next();
        if (path.extname(req.path)) return next();
        setNoStoreHtml(res);
        res.status(404);
        const { html, gz } = getPreloadedHtml(null);
        if (req.headers['accept-encoding']?.includes('gzip')) {
            res.set('Content-Encoding', 'gzip');
            res.set('Content-Type', 'text/html; charset=utf-8');
            res.end(gz);
        } else {
            res.type("html").send(html);
        }
    });
}

const PORT = process.env.PORT || 4007;

const tlsDir = path.join(__dirname, 'config', 'tls');
if (fs.existsSync(path.join(tlsDir, 'key.pem')) && fs.existsSync(path.join(tlsDir, 'cert.pem'))) {
    const httpsServer = https.createServer({
        key: fs.readFileSync(path.join(tlsDir, 'key.pem')),
        cert: fs.readFileSync(path.join(tlsDir, 'cert.pem')),
    }, app);
    httpsServer.listen(PORT, () => {
        ViteExpress.bind(app, httpsServer);
        _startupLines.push(`HTTPS listening at https://localhost:${PORT}/`);
    });

    // Live stream WebSocket server
    app.listen(4070, '127.0.0.1', () => {
        _startupLines.push('Internal HTTP listening at http://127.0.0.1:4070/');
    });
} else {
    ViteExpress.listen(app, PORT, () => {
        _startupLines.push(`Server listening at http://localhost:${PORT} (no TLS certs found)`);
    });
}

// FreeSWITCH ESL
const { default: freeswitchService } = await import('./service/freeswitchService.js');
global.freeswitch = freeswitchService.freeswitch;

try {
    await global.freeswitch.connect();
    _startupLines.push('FreeSWITCH ESL connected');
} catch (err) {
    _startupLines.push(`FreeSWITCH ESL FAILED: ${err.message} — API only`);
}

// Global state constants
global.ConnectionState = { IDEAL: 'ideal', CONNECTING: 'connecting', CONNECTED: 'connected', HANGUP: 'hangup', RETRY: 'retry', ERROR: 'error' };
global.AuthState = { LOGIN: 'login', LOGOUT: 'logout' };

import { allEndCall } from './modules/admin/routesApi.js';

// Alerting service
import { checkCriticalUser, startCriticalAlert, stopCriticalAlert } from './service/alerting.js';
global.alerting = { checkCriticalUser, startCriticalAlert, stopCriticalAlert };

// WhatsApp client (auto-restores session if available)
import { initialize as initWhatsApp } from './service/whatsapp.js';
try {
    await initWhatsApp();
    _startupLines.push('WhatsApp client initialized');
} catch (err) {
    _startupLines.push(`WhatsApp client skipped: ${err.message}`);
}

// Phone events (syslog for Yealink hook detection)
import { startSyslogServer } from './service/phoneEvents.js';
startSyslogServer(global.config.SYSLOG_PORT || 515);

// Announcement scheduler
import { startScheduler } from './service/announcementScheduler.js';
startScheduler();
_startupLines.push('Announcement scheduler started');

// Redline main API socket bridge
import { initRdlSocket } from './service/rdlSocket.js';
initRdlSocket();
_startupLines.push('RDL socket bridge started');

// On startup: reset all connection states (previous server session is gone)
global.db.resetAllConnectionStates();

// Kill any leftover channels in FreeSWITCH
try {
    await new Promise((resolve) => {
        global.freeswitch.getConferenceList().then(resolve).catch(resolve);
    });
} catch { }

// Debug routes removed for security
_startupLines.push(new Date().toLocaleString());
logStartup(_startupLines);

// Keep-alive
setInterval(() => {
    fetch(`http://127.0.0.1:4070/api/v1/test/test`).catch(() => { });
}, 30000);

// Room snapshots every 5 minutes
setInterval(() => {
    try { global.db.snapshotRoomCounts(); } catch {}
}, 5 * 60 * 1000);
global.db.snapshotRoomCounts();

// Clean old snapshots + event/online history once a day
setInterval(() => {
    try { global.db.cleanOldSnapshots(14); } catch {}
    try { global.db.cleanOldEventLogs(14); } catch {}
}, 24 * 60 * 60 * 1000);

// Clean expired refresh tokens every hour
setInterval(() => {
    try { global.db.cleanExpiredRefreshTokens(); } catch {}
}, 60 * 60 * 1000);

process.stdin.resume();

process
    .on('SIGTERM', shutdown('SIGTERM'))
    .on('SIGINT', shutdown('SIGINT'))
    .on('SIGUSR1', shutdown('SIGUSR1'))
    .on('exit', shutdown('exit'))
    .on('uncaughtException', (err) => shutdown('uncaughtException', err));

function shutdown(signal) {
    return async (err) => {
        console.log(`${signal} received — shutting down`);
        if (err) console.error(err.stack || err);

        // Lock gate first — prevents _onCallHangup from re-initiating calls during shutdown
        try {
            const { lockCalls } = await import('./service/freeswitch/callGate.js');
            lockCalls('shutdown');
        } catch { }

        // End all active FreeSWITCH calls first — sends BYE to clients
        try {
            await allEndCall();
            console.log('All calls ended — BYE sent to clients');
        } catch (e) {
            console.error('Failed to end calls:', e.message);
        }

        // Close all WhatsApp sessions (keep auth)
        try {
            const { shutdownAll } = await import('./service/whatsapp.js');
            await shutdownAll();
        } catch { }

        // Then reset DB state
        try {
            global.db.resetAllConnectionStates();
        } catch { }

        setTimeout(() => {
            console.log('Exiting.');
            process.exit(err ? 1 : 0);
        }, 3000).unref();
    };
}
