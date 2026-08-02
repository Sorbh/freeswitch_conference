#!/usr/bin/env node
/**
 * Static pre-rendering — generates complete HTML files for all SEO pages.
 *
 * Runs AFTER `cd client && npm run build` so dist-client/index.html exists.
 * Reads blog-ssr-data.json, features-ssr-data.json, regions-ssr-data.json
 * and produces one .html per route in dist-client/prerender/.
 *
 * Express serves these static files before the SPA catch-all, so Googlebot
 * (and AI crawlers like Perplexity/ChatGPT) get complete HTML without
 * executing any JavaScript.
 *
 * Run: node scripts/prerender.mjs
 * Runs automatically as part of: npm run build / npm run deploy
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST_CLIENT = path.join(ROOT, 'dist-client');
const PRERENDER_DIR = path.join(DIST_CLIENT, 'prerender');
const INDEX_PATH = path.join(DIST_CLIENT, 'index.html');

const BASE_URL = 'https://hotlinehq.online';
const OG_IMAGE = `${BASE_URL}/og-default.png`;

// ── SSR helpers (same logic as index.js) ────────────────────────────

const SSR_STYLE = `<style id="ssr-s">:root{--ink:#16181d;--red:#d92d20;--bg:#fbfaf8;--muted:#5d6370;--line:#e7e4dd;--mono:ui-monospace,"SF Mono","Cascadia Mono",monospace;--body:system-ui,-apple-system,"Segoe UI",sans-serif}#ssr-shell{font-family:var(--body);background:var(--bg);color:var(--ink);min-height:100vh}.ssr-nav{display:flex;justify-content:space-between;align-items:center;padding:14px 32px;max-width:1200px;margin:0 auto}.ssr-logo{font-weight:900;font-size:21px;letter-spacing:-.01em}.ssr-logo em{font-style:normal;color:var(--red)}.ssr-hero{text-align:center;padding:140px 24px 60px;max-width:800px;margin:0 auto}.ssr-kicker{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--red);margin:0 0 18px}.ssr-hero h1{font-size:clamp(32px,5vw,56px);font-weight:700;line-height:1.08;letter-spacing:-.02em;margin:0 0 20px}.ssr-hero h1 em{font-style:normal;color:var(--red)}.ssr-sub{font-size:18px;color:var(--muted);line-height:1.6;margin:0 auto 32px;max-width:600px}.ssr-sub strong{color:var(--ink)}.ssr-cta{display:inline-block;background:var(--red);color:#fff;font-weight:600;font-size:15px;padding:14px 28px;border-radius:11px;text-decoration:none}.ssr-stats{display:flex;justify-content:center;gap:clamp(28px,6vw,80px);flex-wrap:wrap;padding:32px 0 48px}.ssr-stat{display:flex;flex-direction:column;align-items:center;gap:4px}.ssr-stat strong{font-size:36px;font-weight:700;line-height:1}.ssr-stat span{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}@media(max-width:640px){.ssr-hero{padding:100px 16px 40px}.ssr-hero h1{font-size:clamp(24px,7vw,36px)}.ssr-sub{font-size:15px}.ssr-stat strong{font-size:26px}.ssr-nav{padding:10px 16px}}.ssr-faq-section{max-width:800px;margin:0 auto;padding:48px 24px 64px}.ssr-faq-section h2{font-size:clamp(24px,3.5vw,36px);font-weight:700;letter-spacing:-.02em;margin:0 0 32px;text-align:center}.ssr-faq{background:#fff;border:1px solid var(--line);border-radius:12px;padding:24px 28px;margin-bottom:16px}.ssr-faq h3{font-size:17px;font-weight:700;margin:0 0 10px;color:var(--ink)}.ssr-faq p{font-size:15px;line-height:1.65;color:var(--muted);margin:0}</style>`;

function ssrShell(kicker, h1, sub, ctaText, ctaHref, stats) {
  const statsHtml = stats ? stats.map(s => `<div class="ssr-stat"><strong>${s[0]}</strong><span>${s[1]}</span></div>`).join('') : '';
  return `<div id="ssr-shell"><nav class="ssr-nav"><span class="ssr-logo">Hotline <em>HQ</em></span></nav><div class="ssr-hero"><p class="ssr-kicker">${kicker}</p><h1>${h1}</h1><p class="ssr-sub">${sub}</p><a class="ssr-cta" href="${ctaHref}">${ctaText}</a></div>${statsHtml ? `<div class="ssr-stats">${statsHtml}</div>` : ''}</div>`;
}

function injectSeoMeta(base, { title, description, url, keywords, jsonLd, ogType = 'website', shell = '', robots, ogImage, ssrData, preloadChunks }) {
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
    html = html.replace(/<div id="root">[\s\S]*?<\/div>\s*<script/, `<div id="root">${shell}</div>\n<script`);
  }
  return html;
}

// ── Load template and data ──────────────────────────────────────────

if (!fs.existsSync(INDEX_PATH)) {
  console.error('[prerender] dist-client/index.html not found — run client build first');
  process.exit(1);
}

let templateHtml = fs.readFileSync(INDEX_PATH, 'utf8');

// Inline CSS (same as Express does at runtime)
const cssLinkMatch = templateHtml.match(/<link[^>]+href="(\/assets\/[^"]+\.css)"[^>]*>/);
if (cssLinkMatch) {
  const cssPath = path.join(DIST_CLIENT, cssLinkMatch[1].replace(/^\//, ''));
  if (fs.existsSync(cssPath)) {
    const css = fs.readFileSync(cssPath, 'utf8');
    templateHtml = templateHtml.replace(cssLinkMatch[0], `<style>${css}</style>`);
  }
}

function loadJson(filename) {
  const p = path.join(ROOT, 'data', filename);
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

const blogData = loadJson('blog-ssr-data.json') || { posts: [], categories: {} };
const featuresData = loadJson('features-ssr-data.json')?.features || {};
const regionsData = loadJson('regions-ssr-data.json') || {};
const pagesData = loadJson('pages-ssr-data.json')?.pages || {};

const assetDir = path.join(DIST_CLIENT, 'assets');
const prerenderChunkMap = {};
if (fs.existsSync(assetDir)) {
  for (const f of fs.readdirSync(assetDir).filter(f => f.endsWith('.js'))) {
    prerenderChunkMap[f.replace(/-[A-Za-z0-9_-]+\.js$/, '')] = `/assets/${f}`;
  }
}
const blogPostChunks = [prerenderChunkMap['BlogPostPage'], prerenderChunkMap['site']].filter(Boolean);

// ── Collect all pages ───────────────────────────────────────────────

const pages = [];

function addPage(route, seo) {
  pages.push({ route, seo });
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
  sameAs: ["https://www.linkedin.com/showcase/hotline-hq"]
};

// ── Homepage ────────────────────────────────────────────────────────

const homeBlogCats = { guides: 'Industry Guides', news: 'Network Updates', market: 'Parts Market' };
const homeBlogHtml = blogData.posts.slice(0, 3).map(p => {
  const catLabel = homeBlogCats[p.category] || p.category;
  return `<div class="ssr-faq"><h3><a href="${BASE_URL}/blog/${p.category}/${p.slug}">${p.title}</a></h3><p>${catLabel} · ${p.readTime} — ${p.description}</p></div>`;
}).join('');

const homeCompareHtml = `<article style="max-width:900px;margin:0 auto;padding:0 24px 48px">
<h2>How long does it take you to find a part? 30 minutes? An hour?</h2>
<p>Our network average is <strong>2 seconds.</strong></p>
<table><thead><tr><th>Method</th><th>Avg Response</th><th>The Problem</th></tr></thead><tbody>
<tr><td>Inventory databases</td><td>30–60 min</td><td>Stale listings, and you're result #38 of 40. The part shows in stock — until you drive out and it's already gone.</td></tr>
<tr><td>Calling around</td><td>40+ min</td><td>Forty minutes of hold music to check five yards. Your customer already bought the part somewhere else.</td></tr>
<tr><td>Facebook groups</td><td>Hours — if ever</td><td>Your post is buried within the hour, and nobody who can actually sell the part is watching the feed.</td></tr>
<tr><td><strong>The Hotline HQ network</strong></td><td><strong>2 seconds</strong></td><td>One voice broadcast. Every counter in your region hears it right now, and the yard that has it answers you back in seconds.</td></tr>
</tbody></table>
</article>`;

const homeRoomsHtml = `<article style="max-width:900px;margin:0 auto;padding:0 24px 48px">
<h2>Twelve rooms. Every major market.</h2>
<p>Your yard lives in its home room and is profiled into nearby regions — and you can switch rooms straight from the phone when the hunt goes wide.</p>
<ul style="columns:3;list-style:none;padding:0">${['California', 'Texas', 'Florida', 'Mexico', 'ENS', 'Arizona', 'Ohio', 'New York', 'Georgia', 'Indiana', 'Michigan', 'Carolinas'].map(r => `<li>${r}</li>`).join('')}</ul>
</article>`;

const homeFeaturesHtml = `<article style="max-width:900px;margin:0 auto;padding:0 24px 48px">
<h2>A phone that pays for itself on the first sale.</h2>
<p>We ship you a preconfigured desk phone. Plug it in, and your yard is live on the network — no setup, no IT, no screens to babysit.</p>
<ul>
<li><strong>Always on.</strong> If the line ever drops, it reconnects on its own. Your phone stays in the room day and night without anyone touching it.</li>
<li><strong>Hands-free listening.</strong> The room plays quietly at your counter. Pick up the handset to talk, put it down to go quiet. No apps, no logins, no screens.</li>
<li><strong>Desk phone first.</strong> We ship you a desk phone that's ready to go — plug it in and you're on the air. Need to listen on the road? It works in your browser too.</li>
<li><strong>Every call on record.</strong> Every request is saved and recorded, along with who answered it. You can always go back and hear exactly what was said.</li>
<li><strong>Reach beyond your region.</strong> You're not boxed into your own area. Your yard also reaches nearby regions, and you can switch rooms right from the phone.</li>
<li><strong>We watch your line 24/7.</strong> If your phone goes offline or your connection drops, our system alerts us and reconnects automatically.</li>
</ul>
</article>`;

const homeIndustriesHtml = `<article style="max-width:900px;margin:0 auto;padding:0 24px 48px">
<h2>The hotline model works in more than one industry</h2>
<p>500+ yards and 15,000+ broadcasts have proven that a live voice network beats databases and phone trees. We're expanding to industries where the same pain exists: fragmented supply, urgent demand, and too many phone calls. See how it works for auto parts: <a href="${BASE_URL}/sell-used-auto-parts">sell parts on the network</a> or learn <a href="${BASE_URL}/blog/guides/how-auto-parts-hotlines-work">how auto parts hotlines work</a>.</p>
<ul>
<li><a href="${BASE_URL}/use-case/heavy-equipment-parts-hotline"><strong>Heavy Equipment</strong></a> — CAT, Deere, Komatsu</li>
<li><a href="${BASE_URL}/use-case/farm-equipment-parts-hotline"><strong>Farm Equipment</strong></a> — Tractors, Combines</li>
<li><a href="${BASE_URL}/use-case/aviation-parts-hotline"><strong>Aviation / AOG</strong></a> — Aircraft Parts</li>
<li><a href="${BASE_URL}/use-case/mining-equipment-parts"><strong>Mining</strong></a> — Haul Trucks, Crushers</li>
<li><a href="${BASE_URL}/use-case/marine-boat-parts"><strong>Marine &amp; Boat</strong></a> — Engines, Outdrives</li>
<li><a href="${BASE_URL}/use-case/railroad-parts-hotline"><strong>Railroad</strong></a> — Locomotives, Rolling Stock</li>
</ul>
</article>`;

const homeCopperHtml = `<article style="max-width:900px;margin:0 auto;padding:0 24px 48px">
<h2>Already on a hotline?</h2>
<p>If your group is on a copper line, a radio network, or any legacy hotline — bring them to HQ. Same group. Better line.</p>
<ul>
<li><strong>Same desk phone.</strong> A dedicated Yealink on your counter, just like the copper phone on your wall.</li>
<li><strong>HD digital audio.</strong> Crystal-clear voice over internet — no static, no line noise.</li>
<li><strong>12 rooms, not just one.</strong> Reach yards across every major market, not just your local area.</li>
</ul>
<p><a href="${BASE_URL}/use-case/replace-copper-hotline">Bring Your Group to HQ →</a></p>
</article>`;

const homeJoinHtml = `<article style="max-width:900px;margin:0 auto;padding:0 24px 48px">
<h2>One flat membership. Your whole region on the line.</h2>
<ul>
<li>Flat monthly fee per yard — no per-call charges</li>
<li>Preconfigured desk phone or browser client included</li>
<li>Live in your regional room the day the phone arrives</li>
<li>Call recordings and answer-rate reporting included</li>
</ul>
<p>No credit card required. Set up your yard in minutes.</p>
<p><a href="${BASE_URL}/client/signup">Sign Up Free</a></p>
</article>`;

const homeFullContent = homeCompareHtml + homeRoomsHtml + homeFeaturesHtml
  + `<div class="ssr-faq-section"><h2>From the Blog</h2>${homeBlogHtml}<p style="text-align:center;margin-top:24px"><a href="${BASE_URL}/blog">All articles</a></p></div>`
  + homeIndustriesHtml + homeCopperHtml + homeJoinHtml;

addPage('/', {
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
  ) + homeFullContent,
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
});

// ── /find-used-auto-parts ───────────────────────────────────────────

const findFaqItems = [
  { q: "What is an auto parts hotline?", a: "An auto parts hotline is a live voice network that connects salvage yards and auto dismantlers. Instead of calling yards one by one, you broadcast what you need to every yard in your region simultaneously and get answers in seconds. Hotline HQ operates the largest voice-based parts network in the US with 500+ member yards across 12 regional rooms." },
  { q: "How do I find a used auto part on Hotline HQ?", a: "Sign up free and select your regional room (California, Texas, Florida, Arizona, or any of our 12 markets). Key up on your desk phone or web client and describe the part you need — year, make, model, and what you're looking for. Your request goes out live to every yard in the room. Yards that have your part respond immediately on the line." },
  { q: "How fast do yards respond?", a: "The average response time on Hotline HQ is approximately 2 seconds. Because every yard in your regional room hears your request live, the first yard that has the part simply keys up and responds. There is no hold music, no voicemail, and no waiting for someone to check a database." },
  { q: "Is Hotline HQ free to use?", a: "Joining the network is free. Hotline HQ charges a flat monthly membership fee with no per-call costs and no commissions on sales. A preconfigured desk phone is included with membership and shipped directly to your location." },
  { q: "What parts can I find on Hotline HQ?", a: "Any used auto part that dismantler yards carry. The most-requested parts on the network are bumpers, transmissions, fenders, motors, doors, headlights, and AC compressors. The most-requested makes are Ford, Toyota, Honda, Chevrolet, and Nissan, spanning model years from the 1990s through 2025." },
  { q: "How is this different from online parts databases?", a: "Online parts databases go stale — inventory changes daily. On Hotline HQ, you are asking real people who can walk the yard and check right now. One broadcast reaches 100+ yards simultaneously, replacing what used to take an hour of phone calls." },
];
addPage('/find-used-auto-parts', {
  title: 'Find Used Auto Parts — Search 500+ Yards Instantly | Hotline HQ',
  description: 'Find used auto parts from 500+ dismantler yards in seconds. Broadcast what you need on the Hotline HQ voice network and get live answers — no databases, no waiting.',
  url: `${BASE_URL}/find-used-auto-parts`,
  keywords: 'find used auto parts, used auto parts near me, used car parts, salvage auto parts, junkyard parts, auto parts search, auto parts hotline, how to find used car parts',
  shell: ssrShell(
    'FIND PARTS FASTER',
    'Find used auto parts from <em>500+ yards</em> in seconds',
    'Stop calling yard after yard. Broadcast what you need on Hotline HQ and every dismantler in your region hears it live. Average answer time: <strong>2 seconds</strong>.',
    'Start Finding Parts — Free', `${BASE_URL}/client/signup`
  ) + `<div class="ssr-faq-section"><h2>Frequently Asked Questions</h2>${findFaqItems.map(f => `<div class="ssr-faq"><h3>${f.q}</h3><p>${f.a}</p></div>`).join('')}</div>`,
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service", name: "Hotline HQ — Find Used Auto Parts",
        serviceType: "Used Auto Parts Search Network",
        provider: { "@type": "Organization", name: "Hotline HQ", url: `${BASE_URL}/` },
        areaServed: { "@type": "Country", name: "US" },
        description: "Live voice network connecting auto dismantlers. Broadcast what part you need and get answers from 500+ yards in seconds.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free to join" }
      },
      { "@type": "FAQPage", mainEntity: findFaqItems.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }
    ]
  }
});

// ── /sell-used-auto-parts ───────────────────────────────────────────

const sellFaqItems = [
  { q: "What is the best way to sell used auto parts online?", a: "It depends on volume. For salvage yards selling dozens of parts daily, voice hotline networks like Hotline HQ offer the fastest turnaround — one broadcast reaches 100+ yards and responses arrive in about 2 seconds. For individual sellers moving one or two parts, eBay Motors or Facebook Marketplace provide the widest buyer reach. Most profitable yards combine two to three channels rather than relying on just one." },
  { q: "How much does it cost to sell auto parts on eBay?", a: "eBay Motors charges an insertion fee (often waived for the first 250 listings per month) plus a final value fee of approximately 13.25% of the sale price. For a $200 transmission, that's roughly $26.50 in fees. eBay also charges payment processing fees. Compare that to Hotline HQ, which charges a flat monthly membership with no per-sale fees or commissions." },
  { q: "Can I sell used auto parts without listing inventory online?", a: "Yes. On voice hotline networks, you listen for live part requests and respond when you have what someone needs. There is no inventory database to maintain. This works especially well for yards with large, uncataloged inventory — the network surfaces demand you would never find through listings alone." },
  { q: "How do I sell used auto parts on Facebook Marketplace?", a: "Create a listing with clear photos (multiple angles), accurate part details (year, make, model, OEM part number), condition description, and a competitive price. Use keywords buyers actually search — 'Ford F-150 headlight assembly' performs better than 'truck headlight.' Respond to messages quickly; buyers on Facebook expect answers within an hour. Ship via USPS, UPS, or FedEx, or offer local pickup." },
  { q: "What used auto parts sell the fastest?", a: "On the Hotline HQ network, the most-requested parts are bumpers, transmissions, fenders, motors, doors, headlights, and AC compressors. The most-requested makes are Ford, Toyota, Honda, Chevrolet, and Nissan. Parts from common vehicles in the 5–15 year old range sell fastest because demand is highest and supply keeps pace." },
  { q: "Is it legal to sell used auto parts?", a: "Yes. Selling used auto parts is legal in all 50 US states. Salvage yards need a state-issued dismantler or auto recycler license (requirements vary by state). Individual sellers can sell parts from their own vehicles without a license in most states. Certain regulated parts like catalytic converters and airbags have additional federal and state requirements — check your state's rules before listing those." },
  { q: "How do I price used auto parts?", a: "Start with Car-Part.com to check what other yards charge for the same part. Price by condition: Grade A (low mileage, excellent) commands 60–70% of new OEM price, Grade B (average wear) 40–50%, and Grade C (functional but cosmetically imperfect) 25–35%. High-demand parts from common vehicles can be priced higher. Parts from rare or discontinued vehicles carry a premium when demand exists." },
];

const sellGuideHtml = `<article style="max-width:800px;margin:0 auto;padding:0 24px 64px">
<p>The used auto parts market in the US generates roughly $32 billion in annual revenue across more than 9,000 yards. If you run a salvage yard or have parts to move, your choice of sales channel determines whether a part sits on a shelf for months or sells within hours.</p>
<p>This guide compares seven ways to sell used auto parts online — from high-volume platforms like eBay Motors to yard-to-yard voice networks. Each has different fees, speed, and reach. We cover all of them honestly, including the trade-offs of our own network.</p>
<p><em>Disclosure: Hotline HQ publishes this guide and operates a voice hotline network (Method 5 below). We have ranked all seven methods by their actual strengths and weaknesses.</em></p>

<blockquote><strong>Key Takeaways</strong><br>
Voice hotline networks deliver the fastest yard-to-yard sales — about 2 seconds per broadcast. eBay Motors offers the widest national reach but takes 13% in fees. Facebook Marketplace is free but time-intensive. Most profitable yards stack two to three channels, not just one.</blockquote>

<h2>Method 1: eBay Motors</h2>
<p>eBay Motors is the largest online marketplace for used auto parts with over 80 million live part listings at any given time. Sellers range from individual car owners to large salvage operations running thousands of SKUs.</p>
<p><strong>How it works:</strong> Create a listing with photos, part compatibility data (year, make, model, engine), condition description, and price. Buyers search, purchase, and you ship. eBay handles payment processing.</p>
<p><strong>Fees:</strong> Final value fee of approximately 13.25% of the total sale price (including shipping), plus a $0.30 per-order fee. Insertion fees apply after your monthly free listing allotment (typically 250). For a $300 part, expect to pay roughly $40 in total fees.</p>
<p><strong>Speed:</strong> Parts can take days to weeks to sell. High-demand items (common Honda, Toyota, Ford parts) move faster. Niche or rare parts may sit for months. Shipping adds 3–7 business days before the buyer receives the part.</p>
<p><strong>Best for:</strong> Yards with cataloged inventory and the staff to photograph, list, pack, and ship individual parts. Good for reaching individual consumers and repair shops nationwide.</p>

<h2>Method 2: Facebook Marketplace</h2>
<p>Facebook Marketplace reaches 1.1 billion users worldwide. For auto parts, it is especially strong for local pickup sales where buyers can inspect parts before paying.</p>
<p><strong>How it works:</strong> Create a listing in the auto parts category with photos, description, and price. Buyers message you through Facebook Messenger. Sales are typically cash at pickup or through Facebook's shipping option.</p>
<p><strong>Fees:</strong> Free for local pickup listings. Shipped orders incur a 6% selling fee or $0.40 minimum. No listing fees, no monthly subscription.</p>
<p><strong>Speed:</strong> Local sales can happen same day. Shipped parts take 2–5 days. You will spend significant time answering messages — many inquiries don't convert.</p>
<p><strong>Best for:</strong> Individual sellers and small yards selling locally. Effective for large, heavy parts (engines, transmissions, body panels) where shipping cost is prohibitive.</p>

<h2>Method 3: Car-Part.com</h2>
<p>Car-Part.com is the industry's standard parts locating platform, connecting professional buyers with recycler inventory. Over 200 million parts are listed from thousands of yards.</p>
<p><strong>How it works:</strong> Yards upload their inventory database (typically from yard management software like Checkmate, Pinnacle, or Hollander). Buyers search by part, and Car-Part.com shows matching inventory with pricing and yard contact info.</p>
<p><strong>Fees:</strong> Monthly subscription fee (varies by yard size and features). No per-transaction fees. Requires compatible yard management software for inventory integration.</p>
<p><strong>Speed:</strong> Depends on buyer activity. Your parts are passively listed — someone has to search for what you have. Response time depends on how quickly you answer calls and emails from buyers.</p>
<p><strong>Best for:</strong> Established yards with inventory management systems already in place. Essential for yards wanting visibility among professional parts locators and body shops.</p>

<h2>Method 4: Craigslist</h2>
<p>Craigslist remains popular for local auto parts sales despite its age. The platform is free and attracts price-conscious buyers.</p>
<p><strong>How it works:</strong> Post a listing in the auto parts section for your city or region. Include photos, part details, and price. Buyers contact you via email or phone. All sales are typically in-person, cash transactions.</p>
<p><strong>Fees:</strong> Free in most categories and most cities.</p>
<p><strong>Speed:</strong> Varies widely. Common parts in major metro areas can sell within a day. Rural areas or niche parts may get no responses. No built-in payment or shipping — strictly local.</p>
<p><strong>Best for:</strong> Occasional sellers and yards clearing out low-value or bulk parts. Zero cost, zero commitment.</p>

<h2>Method 5: Voice Hotline Networks (Hotline HQ)</h2>
<p>Voice hotline networks connect yards in real-time through a shared audio channel. When one yard needs a part, they broadcast the request to every yard in the room. Any yard with that part responds instantly.</p>
<p><strong>How it works:</strong> Join a regional room (California, Texas, Florida, Arizona, or any of 12 US markets). A preconfigured desk phone or web client connects you to the live channel. When you hear a request for a part you stock, press a button and respond. The buyer contacts you directly to finalize the sale. You keep 100% — no middleman, no commission.</p>
<p><strong>Fees:</strong> Flat monthly membership fee. No per-call charges, no listing fees, no sales commissions. Desk phone included with membership.</p>
<p><strong>Speed:</strong> The fastest method on this list. One broadcast reaches 100+ yards, and the average response time is approximately 2 seconds. Parts that would take hours to sell through listings can sell in seconds through a live broadcast.</p>
<p><strong>Best for:</strong> Salvage yards selling to other yards and to repair shops. Especially effective for yards with large, uncataloged inventory — you don't need to list anything. Just listen and respond.</p>

<h2>Method 6: PartCycle</h2>
<p>PartCycle is a B2B marketplace focused on connecting recyclers with repair shops, insurance companies, and fleet operators. It positions itself as a premium alternative to consumer-facing platforms.</p>
<p><strong>How it works:</strong> Yards list parts on the PartCycle platform. Verified buyers (shops, fleets, insurers) search and purchase with standardized grading and warranties. The platform handles some logistics coordination.</p>
<p><strong>Fees:</strong> Subscription-based with transaction fees. Pricing varies by yard volume and features.</p>
<p><strong>Speed:</strong> Similar to Car-Part.com — passive listing with buyer-initiated contact. The professional buyer base can mean faster decisions but lower volume than consumer platforms.</p>
<p><strong>Best for:</strong> Yards focused on B2B sales to repair shops and insurance companies. Good for yards that want to sell graded, warrantied parts at professional pricing.</p>

<h2>Method 7: Your Own Website</h2>
<p>Some larger yards build their own e-commerce sites using platforms like Shopify, WooCommerce, or custom solutions. This gives you full control over branding, pricing, and customer relationships.</p>
<p><strong>How it works:</strong> List parts on your own site with photos, compatibility data, and pricing. Handle your own SEO, advertising, payment processing, and shipping.</p>
<p><strong>Fees:</strong> Platform subscription ($29–$299/month depending on features), payment processing (typically 2.9% + $0.30 per transaction), plus hosting, domain, and any advertising costs.</p>
<p><strong>Speed:</strong> Entirely dependent on your traffic. New sites can take months to gain search visibility. Established yards with repeat customers see steady sales.</p>
<p><strong>Best for:</strong> Larger operations with marketing resources and a brand to build. Works best as a complement to other channels, not as a sole sales method.</p>

<h2>Which Method Should You Use?</h2>
<p>The answer depends on what you sell, how fast you need to sell it, and how much time you can invest per sale.</p>
<ul>
<li><strong>High-volume yard-to-yard sales:</strong> Voice hotline network (fastest turnaround, no per-sale fees)</li>
<li><strong>National reach to individual buyers:</strong> eBay Motors (widest audience, highest fees)</li>
<li><strong>Local sales of large parts:</strong> Facebook Marketplace or Craigslist (free, buyer inspects before buying)</li>
<li><strong>Professional B2B channel:</strong> Car-Part.com + PartCycle (industry standard for shops and insurers)</li>
<li><strong>Building your own brand:</strong> Your own website (long-term investment)</li>
</ul>
<p>Most profitable yards run two to three channels simultaneously. A common stack: Car-Part.com for passive online visibility, a voice hotline for same-day yard-to-yard sales, and eBay Motors for individual consumer reach. <a href="${BASE_URL}/blog/guides/how-salvage-yards-sell-more-parts">Read our full guide on stacking sales channels</a>.</p>

<h2>Tips for Selling More Parts, Faster</h2>
<ol>
<li><strong>Photograph every part from multiple angles.</strong> Clear photos reduce buyer questions and returns. Include close-ups of connectors, mounting points, and any damage.</li>
<li><strong>Use OEM part numbers.</strong> Buyers search by part number more than description. Include the OEM number in your title and description.</li>
<li><strong>Price competitively.</strong> Check <a href="${BASE_URL}/blog/market/used-auto-parts-pricing-guide">current market pricing</a> on Car-Part.com before listing. Grade A parts command 60–70% of new OEM. Grade B: 40–50%. Grade C: 25–35%.</li>
<li><strong>Respond fast.</strong> On every platform, the first yard to respond gets the sale. Whether it is a Facebook message or a hotline broadcast, speed wins.</li>
<li><strong>Stock what sells.</strong> Focus on pulling the <a href="${BASE_URL}/blog/market/most-requested-used-auto-parts">most-requested parts</a> first — bumpers, transmissions, headlights, and motors from Ford, Toyota, Honda, and Chevrolet.</li>
</ol>
</article>`;

addPage('/sell-used-auto-parts', {
  title: 'How to Sell Used Auto Parts Online — 7 Methods Compared (2026)',
  description: 'Compare eBay, Facebook Marketplace, Car-Part.com, and 4 more ways to sell used auto parts online. See which channel sells fastest with real data.',
  url: `${BASE_URL}/sell-used-auto-parts`,
  keywords: 'sell used auto parts online, how to sell used auto parts, best place to sell used auto parts, sell auto parts, where to sell used auto parts',
  shell: ssrShell(
    'SELL PARTS FASTER',
    'How to sell used auto parts online — <em>7 methods compared</em>',
    "Compare eBay, Facebook Marketplace, Car-Part.com, voice hotlines, and more. See real fees, speed, and reach for each channel so you pick the right ones for your yard.",
    'Join the Network — Free', `${BASE_URL}/client/signup`,
    [['500+', 'Yards on network'], ['12', 'Regional rooms'], ['~115', 'Listeners per call'], ['24/7', 'Always on']]
  ) + sellGuideHtml + `<div class="ssr-faq-section"><h2>Frequently Asked Questions</h2>${sellFaqItems.map(f => `<div class="ssr-faq"><h3>${f.q}</h3><p>${f.a}</p></div>`).join('')}</div>`,
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: "How to Sell Used Auto Parts Online — 7 Methods Compared (2026)",
        description: "Compare eBay, Facebook Marketplace, Car-Part.com, and 4 more ways to sell used auto parts online. See which channel sells fastest with real data.",
        url: `${BASE_URL}/sell-used-auto-parts`,
        publisher: { "@type": "Organization", name: "Hotline HQ", url: `${BASE_URL}/` },
        datePublished: "2026-07-28",
        dateModified: "2026-07-28",
        mainEntityOfPage: `${BASE_URL}/sell-used-auto-parts`,
      },
      { "@type": "FAQPage", mainEntity: sellFaqItems.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }
    ]
  }
});

// ── /marketplace ────────────────────────────────────────────────────

const marketplaceContentHtml = `<article style="max-width:800px;margin:0 auto;padding:0 24px 64px">
<h2>How the marketplace works</h2>
<p>The Hotline HQ Marketplace is the public face of every unanswered broadcast on the voice network. When a yard broadcasts a part request on the hotline and nobody responds within the session, the request is automatically captured, transcribed, and posted here — with year, make, model, and part parsed out.</p>
<p>Any yard — member or not — can browse these open requests and respond directly. It's a second chance at every sale the live line missed.</p>

<h3>Live requests, not stale listings</h3>
<p>Unlike traditional parts marketplaces where sellers list inventory, Hotline HQ flips the model: <strong>buyers post what they need</strong>. Every listing is a real request from a real yard or shop. You're not browsing inventory — you're browsing demand. If you have the part, you respond and close the sale.</p>

<h3>Filtered by region, make, year</h3>
<p>Search by regional room (California, Texas, Florida, Arizona), vehicle make, or model year. The most active rooms see 40+ new requests per day. Requests include Ford, Toyota, Honda, Chevrolet, Nissan, and Dodge across model years from the 1990s through 2025.</p>

<h3>From broadcast to listing in seconds</h3>
<p>When a broadcast goes unanswered on the live hotline, Hotline HQ automatically transcribes the audio, extracts part details, and creates a searchable listing. No manual data entry. The marketplace is always current because it's fed by the live network — not by sellers updating inventory.</p>

<h2>Why this is different from Car-Part.com or eBay</h2>
<h3>Demand-side, not supply-side</h3>
<p>Car-Part.com and eBay show what sellers have listed. Hotline HQ's marketplace shows what buyers actually need right now. For a yard owner, this is the most valuable signal: real-time demand you can fill.</p>

<h3>No listing fees, no photos, no data entry</h3>
<p>Sellers don't list parts here. They respond to requests. That means you don't need to photograph, catalog, or price anything. Just browse what people need and respond if you have it. <a href="${BASE_URL}/sell-used-auto-parts">Learn more about selling on the network</a>.</p>

<h3>Connected to the live voice network</h3>
<p>The marketplace is the fallback channel. The fastest way to buy and sell is the <a href="${BASE_URL}/used-auto-parts-hotline">live voice hotline</a> — 2-second average response time. The marketplace catches everything the live line misses and gives it a longer shelf life.</p>
</article>`;

const marketplaceFaqItems = [
  { q: "Who posts requests on the marketplace?", a: "Requests come from the live Hotline HQ voice network. When a yard or shop broadcasts a part request on the hotline and it goes unanswered, the system automatically transcribes it and posts it to the marketplace. Every listing is a real request from a real business." },
  { q: "How do I respond to a marketplace request?", a: "Click on any listing to see the full details — year, make, model, part needed, and which regional room it came from. If you have the part, use the contact info to reach the requester directly. No middleman, no fees." },
  { q: "Is the marketplace free to browse?", a: "Yes. Anyone can browse the marketplace and see what parts buyers are looking for. To respond to requests or post your own broadcasts on the live hotline, you need a Hotline HQ membership." },
  { q: "How often are new requests posted?", a: "New requests are posted throughout the day as unanswered broadcasts come in from the live network. Active rooms like California see 40+ broadcasts per day. The marketplace is always refreshing with new demand." },
  { q: "What's the difference between the marketplace and the live hotline?", a: "The live hotline is real-time voice — you broadcast and get answers in 2 seconds. The marketplace is the async fallback — unanswered requests are posted here for yards to browse and respond to later. Most yards use both: the live line for speed, the marketplace for coverage." },
];

const marketplaceFaqHtml = `<div class="ssr-faq-section"><h2>Marketplace FAQ</h2>${marketplaceFaqItems.map(f => `<div class="ssr-faq"><h3>${f.q}</h3><p>${f.a}</p></div>`).join('')}</div>`;

addPage('/marketplace', {
  title: 'Used Auto Parts Marketplace — Live Requests from 500+ Yards',
  description: 'Browse live part requests from 500+ salvage yards. See what buyers need right now — respond if you have the part. No listing fees.',
  url: `${BASE_URL}/marketplace`,
  keywords: 'used auto parts marketplace, auto parts listings, buy used auto parts, salvage parts for sale, used car parts marketplace, parts wanted',
  shell: ssrShell(
    'MARKETPLACE',
    'Used auto parts — <em>live demand</em> from the network',
    'Every listing is a real request from a real yard. Browse what buyers need right now — if you have the part, respond and close the sale.',
    'Sign Up Free', `${BASE_URL}/client/signup`
  ) + marketplaceContentHtml + marketplaceFaqHtml,
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage", name: "Used Auto Parts Marketplace — Hotline HQ",
        url: `${BASE_URL}/marketplace`,
        description: "Live used auto parts requests from 500+ dismantler yards. Browse demand, respond if you have the part.",
        publisher: orgJsonLd,
      },
      {
        "@type": "FAQPage",
        mainEntity: marketplaceFaqItems.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ]
  }
});

// ── /own-a-hotline ──────────────────────────────────────────────────

const ownContentHtml = `<article style="max-width:800px;margin:0 auto;padding:0 24px 64px">
<h2>Why an auto parts hotline still wins</h2>
<p>Used auto parts yards need a live answer, not another stale database. When a counterperson can say the request once and reach a whole region instantly, more customer jobs stay alive and more member yards close sales they would have missed.</p>

<h2>The model is simple</h2>
<h3>1. You bring the community</h3>
<p>You know your trade — the dealers, yards, or wholesalers who call each other all day looking for inventory. They're your members.</p>
<h3>2. We run the network</h3>
<p>Hotline HQ runs the lines, the regional rooms, the recordings, the preconfigured phones, and the 24/7 monitoring. No telecom knowledge needed on your side.</p>
<h3>3. You own the revenue</h3>
<p>Members pay a flat monthly fee for their line. It's your network and your brand — the membership revenue is yours, month after month.</p>

<h2>Built first for used auto parts, adaptable to other trades</h2>
<p>The playbook starts with the used auto parts hotline already live today. If businesses in your industry already call each other asking "who has one?", the same network model can be adapted.</p>
<ul>
<li><strong>Used auto parts</strong> — Live today — 500+ salvage yards across 12 regional rooms</li>
<li><strong><a href="${BASE_URL}/heavy-equipment-parts-hotline">Heavy truck & trailer parts</a></strong> — Same hunt, bigger inventory, fewer players per region</li>
<li><strong><a href="${BASE_URL}/farm-equipment-parts-hotline">Equipment & machinery dealers</a></strong> — Attachments, parts, and whole units traded dealer to dealer</li>
<li><strong>Building material suppliers</strong> — Sourcing odd-lot and discontinued stock across a region</li>
<li><strong>Wholesale & surplus dealers</strong> — Any trade where "who has one?" is asked out loud every day</li>
</ul>

<h2>What we run for you</h2>
<ul>
<li>Regional voice rooms with always-on member lines</li>
<li>Preconfigured desk phones and a browser client for members</li>
<li>Every broadcast logged and recorded automatically</li>
<li>Auto-reconnect and 24/7 line monitoring with alerts</li>
<li>Answer-rate and activity reporting for you and your members</li>
<li>Member onboarding — a new line is live the day the phone arrives</li>
</ul>

<h2>Platform features — everything included</h2>
<p>Your members get all of this from day one — desk phone or mobile:</p>
<ul>
<li><strong><a href="${BASE_URL}/features/always-on-voice-network">Always-On Voice Network</a></strong> — Live voice hotline running 24/7</li>
<li><strong><a href="${BASE_URL}/features/caller-id">Real-Time Caller ID</a></strong> — See who's talking — company name, rep name, phone, city</li>
<li><strong><a href="${BASE_URL}/features/any-device">Works On Any Device</a></strong> — Preconfigured desk phone or web app</li>
<li><strong><a href="${BASE_URL}/features/direct-calls">Private Direct Calls</a></strong> — Every member gets a 3-digit extension</li>
<li><strong><a href="${BASE_URL}/features/broadcast-recording">Broadcast Recording</a></strong> — Every broadcast recorded automatically</li>
<li><strong><a href="${BASE_URL}/features/notifications">Smart Notifications</a></strong> — Push notifications, Telegram alerts, lock screen controls</li>
<li><strong><a href="${BASE_URL}/features/unanswered-capture">Unanswered Broadcast Capture</a></strong> — No request goes to waste</li>
<li><strong><a href="${BASE_URL}/features/parts-marketplace">Parts Marketplace</a></strong> — Every captured broadcast becomes a searchable listing</li>
<li><strong><a href="${BASE_URL}/features/admin-dashboard">Admin Dashboard</a></strong> — Real-time analytics and room management</li>
</ul>
</article>`;

const ownFaqItems = [
  { q: "What is an auto parts hotline?", a: "An auto parts hotline is a live voice network where salvage yards and auto recyclers stay connected to the same regional room. A member broadcasts a part request once, and yards that have the part answer immediately." },
  { q: "Can I own the auto parts hotline while Hotline HQ runs the technology?", a: "Yes. You own the member relationships, local brand, and recurring revenue. Hotline HQ runs the phones, browser lines, recordings, monitoring, and day-to-day network operations behind the scenes." },
  { q: "Is this built for used auto parts yards first?", a: "Yes. The model is already proven with a live used auto parts hotline spanning 500+ salvage yards across 12 regional rooms, and that operating playbook can be launched in additional markets or adapted to similar dealer networks." },
  { q: "What does an owner actually do?", a: "You sign up yards in your area, set the membership price, and collect monthly dues. Hotline HQ handles all the technology — phones, network, monitoring — so you focus on relationships and growth." },
  { q: "Do I need technical skills?", a: "No. Hotline HQ provides all the infrastructure. Phones are preconfigured and ship directly to your members. You manage your network through a simple web dashboard." },
  { q: "What industries can use a hotline?", a: "Any industry where businesses need to locate inventory across a network of peers — auto dismantlers, heavy truck parts, building materials, wholesale distribution, and more." },
];

const ownFaqHtml = `<div class="ssr-faq-section"><h2>Auto Parts Hotline FAQ</h2>${ownFaqItems.map(f => `<div class="ssr-faq"><h3>${f.q}</h3><p>${f.a}</p></div>`).join('')}</div>`;

// ── /auto-parts-interchange-network ──────────────────────────────────

const interchangeFaqItems = [
  { q: "What is auto parts interchange?", a: "Auto parts interchange is the practice of identifying which parts fit across different vehicles — different makes, models, and years. A 2016 Honda Civic bumper might be identical to a 2017 or 2018. Interchange data maps these cross-references so yards and buyers can find compatible parts faster. On Hotline HQ, interchange happens naturally: you describe what you need, and yards with compatible parts respond." },
  { q: "How does a parts interchange network work?", a: "A parts interchange network connects salvage yards so they can match parts across their combined inventory. On Hotline HQ, this happens by voice in real time. You broadcast what you need and any yard with a compatible part responds in seconds. No searching databases, no cross-referencing part numbers." },
  { q: "Do I need interchange software to use Hotline HQ?", a: "No. Experienced yard operators already know their interchange from working with vehicles daily. When a buyer broadcasts a request, yards respond based on what they know fits — no software lookup required. Many yards also use Hollander or Car-Part interchange data alongside the hotline." },
  { q: "How is this different from Hollander or Car-Part.com interchange?", a: "Hollander and Car-Part.com are interchange databases — they tell you which parts cross-reference. Hotline HQ is a live voice network — you ask for a part and real people with real inventory respond in seconds. The two are complementary." },
  { q: "Is this free to join?", a: "Hotline HQ charges a flat monthly membership fee — no per-call charges, no commissions, no interchange lookup fees. A preconfigured Yealink desk phone is included and shipped to your location." },
];

addPage('/auto-parts-interchange-network', {
  title: 'Auto Parts Interchange Network — 500+ Yards, Live Matching | Hotline HQ',
  description: 'Auto parts interchange network connecting 500+ salvage yards. Broadcast what you need — yards with interchange-compatible parts respond in 2 seconds.',
  url: `${BASE_URL}/auto-parts-interchange-network`,
  keywords: 'auto parts interchange, car parts interchange, parts interchange network, interchange lookup, auto parts interchange network, hollander interchange, salvage parts interchange',
  shell: ssrShell(
    'INTERCHANGE NETWORK',
    'The auto parts interchange network that <em>responds in 2 seconds</em>',
    'Stop searching interchange databases. Broadcast what you need and 97 yards with compatible parts respond live. Over 15,000 parts located across <strong>500+ member yards</strong>.',
    'Join the Network — Free', `${BASE_URL}/client/signup`
  ) + `<div class="ssr-faq-section"><h2>Auto Parts Interchange FAQ</h2>${interchangeFaqItems.map(f => `<div class="ssr-faq"><h3>${f.q}</h3><p>${f.a}</p></div>`).join('')}</div>`,
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service", name: "Auto Parts Interchange Network — Hotline HQ",
        serviceType: "Auto Parts Interchange Network",
        provider: { "@type": "Organization", name: "Hotline HQ", url: `${BASE_URL}/` },
        areaServed: { "@type": "Country", name: "US" },
        description: "Live voice interchange network connecting 500+ salvage yards. Broadcast a part request and yards with interchange-compatible parts respond in 2 seconds.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free to join" }
      },
      { "@type": "FAQPage", mainEntity: interchangeFaqItems.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }
    ]
  }
});

addPage('/own-a-hotline', {
  title: 'Own an Auto Parts Hotline — Launch Your Network',
  description: 'Launch your own voice hotline network. Platform, phones, and support included — you collect the membership revenue. Proven with 500+ yards.',
  url: `${BASE_URL}/own-a-hotline`,
  keywords: 'own a hotline, start a hotline business, auto parts hotline, used auto parts hotline, start auto parts business, voice hotline franchise, hotline network owner',
  shell: ssrShell(
    'AUTO PARTS HOTLINE',
    'Own the used auto parts hotline for <em>your market.</em>',
    'Hotline HQ replaces the phone tree with one always-on regional voice room where members broadcast a part request once and somebody who has it answers in seconds. You own the network and revenue. We run the system.',
    'Talk to Us About Launching', `mailto:hello@hotlinehq.online`,
    [['500+', 'Member yards'], ['12', 'Regional rooms'], ['2s', 'Typical answer'], ['24/7', 'Always on']]
  ) + ownContentHtml + ownFaqHtml,
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service", name: "Auto Parts Hotline Network — Hotline HQ",
        serviceType: "Turnkey Voice Hotline Network",
        provider: { "@type": "Organization", name: "Hotline HQ", url: `${BASE_URL}/`, email: "hello@hotlinehq.online" },
        areaServed: "US",
        description: "Launch and own a used auto parts hotline for salvage yards and auto recyclers. Hotline HQ runs the lines, rooms, recordings, and equipment — you keep the member revenue.",
      },
      {
        "@type": "FAQPage",
        mainEntity: ownFaqItems.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      {
        "@type": "HowTo",
        name: "How to Launch Your Own Auto Parts Hotline",
        description: "Three steps to owning a voice hotline network for your market.",
        step: [
          { "@type": "HowToStep", position: 1, name: "You bring the community", text: "You know your trade — the dealers, yards, or wholesalers who call each other all day looking for inventory. They're your members." },
          { "@type": "HowToStep", position: 2, name: "We run the network", text: "Hotline HQ runs the lines, the regional rooms, the recordings, the preconfigured phones, and the 24/7 monitoring. No telecom knowledge needed on your side." },
          { "@type": "HowToStep", position: 3, name: "You own the revenue", text: "Members pay a flat monthly fee for their line. It's your network and your brand — the membership revenue is yours, month after month." },
        ],
      },
    ]
  }
});

// ── /use-case/replace-copper-hotline ───────────────────────────────

const copperComparisonHtml = `<article style="max-width:800px;margin:0 auto;padding:0 24px 64px">
<h2>Copper Hotline vs Hotline HQ</h2>
<table><thead><tr><th>Feature</th><th>Copper</th><th>Hotline HQ</th></tr></thead><tbody>
<tr><td>Reach</td><td>Local only</td><td>Switch between any region</td></tr>
<tr><td>Voice quality</td><td>Analog</td><td>HD digital</td></tr>
<tr><td>Recordings</td><td>None</td><td>Recordings available to settle disputes</td></tr>
<tr><td>Caller ID</td><td>No display</td><td>Name, location, and phone number on screen</td></tr>
<tr><td>Private calls</td><td>Not possible</td><td>One-to-one yard-to-yard calling off the room</td></tr>
<tr><td>Portability</td><td>Stuck at the wall</td><td>Desk, wall, home — web and mobile access</td></tr>
<tr><td>Cost per yard</td><td>Rising (telco sunset)</td><td>Flat monthly</td></tr>
<tr><td>Reliability</td><td>Declining infrastructure</td><td>99.9% uptime</td></tr>
<tr><td>Scalability</td><td>Fixed capacity</td><td>Add yards anytime</td></tr>
<tr><td>Cross-room</td><td>Not possible</td><td>Yes</td></tr>
<tr><td>Support</td><td>3–6 months to resolve</td><td>Less than 24 hours</td></tr>
</tbody></table>

<h2>Why switch now?</h2>
<h3>Copper lines are dying</h3>
<p>Telcos across the country are sunsetting POTS (Plain Old Telephone Service). Maintenance crews are shrinking, prices are rising, and some areas can't get copper service at all anymore. The infrastructure your hotline depends on is being retired — not next decade, now.</p>
<h3>One region isn't enough</h3>
<p>A copper hotline covers one local area — the yards within your telco's reach. HQ connects 12 regional rooms across the US. A yard in Texas can broadcast to California, Florida, or Arizona with a single button press.</p>
<h3>No recordings, no accountability</h3>
<p>Copper is a black box. You don't know who called, what was said, or whether anyone answered. HQ records every broadcast, shows who's connected, tracks response times, and logs broadcast history.</p>
</article>`;

const copperFaqItems = [
  { q: "Is this a phone or a computer thing?", a: "It's a phone. A Yealink T31P desk phone ships to each yard. Plug in one ethernet cable and you're live. There's also a browser option for when you're on the road, but the desk phone is what sits on your counter." },
  { q: "Do all yards need to switch at once?", a: "We'll work with you on the best approach for your group. The important thing is that your group stays together." },
  { q: "What does each yard get?", a: "A preconfigured Yealink T31P desk phone, ready to go. Plug it in, and you're connected to your room. No setup, no IT department needed." },
  { q: "What happens to our copper line?", a: "That's between you and your telco. Many groups keep the copper line running briefly during transition, then cancel it once everyone's on HQ." },
  { q: "Can one yard try it first?", a: "Yes. Any yard can sign up and try the web client immediately, or request a phone. But the real value is when your whole group is on the line together." },
];

addPage('/use-case/replace-copper-hotline', {
  title: 'Replace Your Copper Hotline | Hotline HQ',
  description: 'Upgrade your copper wire hotline to Hotline HQ. Same dedicated desk phone on the counter, same always-on connection. Now with HD digital audio, 12 regional rooms, and every call recorded.',
  url: `${BASE_URL}/use-case/replace-copper-hotline`,
  keywords: 'replace copper hotline, copper hotline upgrade, POTS replacement, salvage yard hotline, auto parts hotline, copper wire hotline alternative, digital hotline',
  shell: ssrShell(
    'COPPER HOTLINE UPGRADE',
    'Your hotline group deserves <em>a better line.</em>',
    'Same dedicated phone on the counter. Same always-on connection. Now with HD digital audio, every call recorded, private calling, and full transcription so you can review everything later.',
    'Bring Your Group to HQ', `${BASE_URL}/client/signup`
  ) + copperComparisonHtml + `<div class="ssr-faq-section"><h2>Frequently Asked Questions</h2>${copperFaqItems.map(f => `<div class="ssr-faq"><h3>${f.q}</h3><p>${f.a}</p></div>`).join('')}</div>`,
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: "Hotline HQ — Replace Your Copper Hotline",
        serviceType: "Copper Hotline Replacement",
        provider: { "@type": "Organization", name: "Hotline HQ", url: `${BASE_URL}/` },
        areaServed: { "@type": "Country", name: "US" },
        description: "Replace your copper wire hotline with Hotline HQ. Same dedicated desk phone, same always-on connection. HD digital audio, 12 regional rooms, every call recorded.",
      },
      { "@type": "FAQPage", mainEntity: copperFaqItems.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }
    ]
  }
});

// ── /features/desk-phone (override generic feature entry with rich content) ──

const dpFaqItems = [
  { q: "Do I have to buy the phone from you?", a: "No. You can order a Yealink T31P from Amazon, B&H Photo, VoIP Supply, or any retailer. We'll send you the configuration file, or ship one preconfigured — your choice." },
  { q: "What if my internet goes down?", a: "The phone reconnects automatically when your internet comes back. No manual steps needed." },
  { q: "Can I use both the desk phone and the web app?", a: "Yes. Many members listen on the desk phone at the counter and switch to the web app when they're on the road." },
  { q: "Is there a monthly fee for the phone?", a: "The desk phone is included with your Hotline HQ membership. No extra hardware fees." },
  { q: "Can I use it with a headset?", a: "Yes. Standard RJ9 headset port. Plug in any compatible wired headset." },
  { q: "Does it work with my existing internet?", a: "If you have an ethernet port, yes. Uses about 100 Kbps — less than streaming a single song." },
];

const dpContentHtml = `<article style="max-width:900px;margin:0 auto;padding:0 24px 48px">
<h2>Browser calling has limits. A desk phone doesn't.</h2>
<p>Mic permissions get blocked. Tabs get closed. Batteries die. Notifications get missed. A dedicated desk phone sits on your counter, always on, always connected — like a landline that plugs you into every yard in the state.</p>

<h2>Why salvage yards are ditching browser calling</h2>
<p>Chrome pushes an update overnight and resets your microphone permissions. An employee closes "that weird tab with the speaker icon." The screen lock kicks in during a slow afternoon and you miss three broadcasts.</p>
<p>A desk phone doesn't have tabs. It doesn't run Chrome. It doesn't need a login, a password, or a Windows update. It sits on the counter like a landline — except this one connects you to every yard in the state.</p>
<table><thead><tr><th>Browser Problem</th><th>What Happens</th></tr></thead><tbody>
<tr><td>Microphone</td><td>Permissions silently revoked</td></tr>
<tr><td>Browser Tabs</td><td>Employee closed "the noisy tab"</td></tr>
<tr><td>Screen Lock</td><td>Missed 3 broadcasts</td></tr>
<tr><td>Shared Computer</td><td>Someone else logged in</td></tr>
<tr><td>Wi-Fi</td><td>10-second drop — call gone</td></tr>
<tr><td>Battery</td><td>Died mid-broadcast</td></tr>
</tbody></table>

<h2>Why yards are leaving copper hotlines behind</h2>
<p>Telcos are sunsetting POTS (Plain Old Telephone Service) lines across the country. Maintenance crews are shrinking, prices are climbing every year, and some areas can't get copper service at all anymore. The infrastructure your hotline runs on is being retired.</p>
<p>The HQ desk phone delivers the exact same experience — a dedicated phone on the counter, always on, pick up and your room hears you. But now with HD digital audio, caller ID showing who's talking, every call recorded and transcribed, and the ability to switch between any region instead of being stuck in one local area.</p>
<p>Your group doesn't lose anything in the switch. Same workflow, same muscle memory. Just better tools underneath. See the full <a href="${BASE_URL}/use-case/replace-copper-hotline">copper-to-HQ comparison</a> for everything your old line is missing.</p>

<h2>What you get with Hotline HQ</h2>
<p>Everything a browser and copper line can't do — built into one desk phone.</p>
<ul>
<li><strong>HD Audio</strong> — Crystal-clear wideband voice</li>
<li><strong>Caller ID</strong> — See who's talking before you pick up</li>
<li><strong>Recordings</strong> — Every call recorded automatically</li>
<li><strong>Transcription</strong> — Full text of every broadcast, searchable</li>
<li><strong>Reach</strong> — Switch between any region</li>
<li><strong>Portability</strong> — Desk phone + web panel on the go</li>
<li><strong>Always On</strong> — 24/7 connection, no browser needed</li>
<li><strong>Private Calls</strong> — Direct yard-to-yard calls off the room</li>
<li><strong>Cost</strong> — Flat monthly — phone included</li>
</ul>

<h2>Three steps. Thirty seconds.</h2>
<ol>
<li><strong>Order your phone.</strong> We ship a preconfigured Yealink T31P to your yard — or grab one from Amazon, B&H, or any VoIP retailer and we'll send the config.</li>
<li><strong>Plug in one cable.</strong> Ethernet into your router. The phone boots, finds the hotline, and connects itself. No passwords, no SIP settings.</li>
<li><strong>You're live.</strong> Within 30 seconds you hear the network. When someone asks for a part you have, pick up and respond.</li>
</ol>

<h2>What you actually hear on the hotline</h2>
<p>The phone sits on your counter with the speaker on low. All day, you hear yards broadcasting requests:</p>
<blockquote><strong>Mike's Auto — Phoenix, AZ:</strong> "Looking for a 2019 Camry driver's side fender, any color. Who's got one?"</blockquote>
<blockquote><strong>Valley Salvage — Houston, TX:</strong> "Need a transmission for an '18 F-150, 3.5 EcoBoost. Preferably under 80k miles."</blockquote>
<blockquote><strong>Tri-State Parts — Newark, NJ:</strong> "Customer waiting on a 2020 Accord headlight assembly, passenger side. Anyone close?"</blockquote>
<p>When you hear a part you have, you pick up the handset and respond. Caller ID shows exactly who's asking — no guessing. The conversation is recorded and transcribed automatically, so you can review every deal later.</p>

<h2>Why a desk phone</h2>
<ul>
<li><strong>No mic permission issues.</strong> The #1 browser problem — blocked microphone — doesn't exist with a desk phone.</li>
<li><strong>Always on, always connected.</strong> 24/7 connection. No browser tab, no battery, no screen lock to manage.</li>
<li><strong>Crystal-clear HD voice.</strong> Wideband audio codecs. Every part number, VIN digit, and dollar amount comes through clearly.</li>
<li><strong>Caller ID on every broadcast.</strong> See who's talking before you pick up. Know exactly which yard is asking.</li>
<li><strong>No computer required.</strong> Standalone device — just needs ethernet and power. Perfect for any counter.</li>
<li><strong>Headset ready.</strong> Standard RJ9 port for any compatible wired headset. Go hands-free all day.</li>
</ul>

<h2>Desk phone vs web client</h2>
<p>Every Hotline HQ membership includes both. Here's when to use each.</p>
<table><thead><tr><th></th><th>Desk Phone</th><th>Web Client</th></tr></thead><tbody>
<tr><td>Best for</td><td>The shop floor — where the work gets done</td><td>The road — when you're away from the counter</td></tr>
<tr><td>Connection</td><td>Always on, always listening — never misses a broadcast</td><td>Works in any browser on any device</td></tr>
<tr><td>Audio</td><td>HD audio through a real speaker and handset</td><td>Depends on device speakers/mic</td></tr>
<tr><td>Setup</td><td>No computer, no browser, no login needed</td><td>Available the minute you sign up</td></tr>
<tr><td>Durability</td><td>Survives dust, heat, and a busy counter</td><td>Good backup if your phone needs service</td></tr>
</tbody></table>
<p>This is how 90% of yards use the hotline every day — desk phone at the counter, web client on the road.</p>

<h2>Specifications</h2>
<table><thead><tr><th>Spec</th><th>Detail</th></tr></thead><tbody>
<tr><td>Model</td><td>Yealink SIP-T31P</td></tr>
<tr><td>Display</td><td>2.3" 132×64 backlit LCD</td></tr>
<tr><td>Lines</td><td>2 SIP accounts</td></tr>
<tr><td>Audio</td><td>HD Voice, hands-free speakerphone</td></tr>
<tr><td>Network</td><td>10/100 Ethernet, PoE</td></tr>
<tr><td>Ports</td><td>RJ9 headset, RJ45 LAN + PC</td></tr>
<tr><td>Power</td><td>PoE (802.3af) or AC adapter</td></tr>
<tr><td>Setup</td><td>Zero-touch — preconfigured</td></tr>
</tbody></table>
</article>`;

addPage('/features/desk-phone', {
  title: 'Hotline HQ Desk Phone — Yealink T31P for Auto Parts Yards',
  description: 'A preconfigured Yealink T31P desk phone that connects your yard to 500+ dismantlers. Always on, HD audio, caller ID, every call recorded. Plug in and you\'re live.',
  url: `${BASE_URL}/features/desk-phone`,
  keywords: 'hotline desk phone, yealink t31p, auto parts phone, salvage yard phone, voip desk phone, hotline hq phone',
  shell: ssrShell(
    'THE DESK PHONE',
    'A real phone on the counter. <em>Not another browser tab.</em>',
    'The Yealink T31P desk phone connects your yard to the Hotline HQ network 24/7. Always on, HD audio, caller ID on every broadcast. Plug in one ethernet cable and you\'re live in 30 seconds.',
    'Sign Up Free', `${BASE_URL}/client/signup`
  ) + dpContentHtml + `<div class="ssr-faq-section"><h2>Frequently Asked Questions</h2>${dpFaqItems.map(f => `<div class="ssr-faq"><h3>${f.q}</h3><p>${f.a}</p></div>`).join('')}</div>`,
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Features", item: `${BASE_URL}/own-a-hotline` },
          { "@type": "ListItem", position: 3, name: "Desk Phone", item: `${BASE_URL}/features/desk-phone` },
        ],
      },
      {
        "@type": "Product",
        name: "Hotline HQ Desk Phone — Yealink T31P",
        description: "Preconfigured Yealink T31P IP desk phone for the Hotline HQ auto parts voice network.",
        brand: { "@type": "Brand", name: "Yealink" },
        model: "SIP-T31P",
        image: `${BASE_URL}/images/t31p-desk-phone.webp`,
      },
      { "@type": "FAQPage", mainEntity: dpFaqItems.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }
    ]
  }
});

// ── /about ──────────────────────────────────────────────────────────

addPage('/about', {
  title: 'About Hotline HQ — Built by Dismantlers, for Dismantlers Since 2011',
  description: 'Started as a single phone line between two California salvage yards in 2011. Today Hotline HQ connects 500+ yards across 12 rooms — the largest voice parts network in the US.',
  url: `${BASE_URL}/about`,
  shell: ssrShell(
    'COMPANY',
    'About Hotline HQ',
    "Hotline HQ is an always-on voice network that connects salvage yards and auto recyclers so they can locate and sell used parts for each other's customers — in seconds, not hours.",
    'Home', `${BASE_URL}/`
  ),
  jsonLd: { "@context": "https://schema.org", "@type": "AboutPage", name: "About Hotline HQ", url: `${BASE_URL}/about`, mainEntity: { "@id": `${BASE_URL}/#org` } }
});

// ── Legal pages ─────────────────────────────────────────────────────

addPage('/privacy-policy', {
  title: 'Privacy Policy | Hotline HQ',
  description: 'How Hotline HQ collects, uses, and protects member information — including call recordings, account data, and your choices.',
  url: `${BASE_URL}/privacy-policy`
});

addPage('/terms-and-conditions', {
  title: 'Terms & Conditions | Hotline HQ',
  description: 'Membership terms for the Hotline HQ voice network: billing, acceptable use, member-to-member deals, equipment, and recordings.',
  url: `${BASE_URL}/terms-and-conditions`
});

addPage('/disclaimer', {
  title: 'Disclaimer | Hotline HQ',
  description: 'What the figures and demos on this site represent, and what Hotline HQ does and does not guarantee about member-to-member deals.',
  url: `${BASE_URL}/disclaimer`
});

// ── Blog index ──────────────────────────────────────────────────────

addPage('/blog', {
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
    "@type": "Blog", name: "Hotline HQ Blog",
    description: "Industry guides, network updates, and parts market insights from Hotline HQ.",
    url: `${BASE_URL}/blog`,
    publisher: { "@type": "Organization", name: "Hotline HQ", url: `${BASE_URL}/` }
  }
});

// ── Blog categories ─────────────────────────────────────────────────

const BLOG_CATS = {
  guides: { label: 'Industry Guides', desc: 'How-to guides and explainers for the auto dismantler industry' },
  news: { label: 'Network Updates', desc: 'New rooms, milestones, and member stories from the Hotline HQ network' },
  market: { label: 'Parts Market', desc: 'Popular parts, seasonal trends, and pricing insights from 500+ yards' },
};

for (const [catKey, cat] of Object.entries(BLOG_CATS)) {
  addPage(`/blog/${catKey}`, {
    title: `${cat.label} — Hotline HQ Blog`,
    description: cat.desc,
    url: `${BASE_URL}/blog/${catKey}`,
    keywords: `${cat.label.toLowerCase()}, auto parts blog, hotline hq`,
    shell: ssrShell('BLOG', cat.label, cat.desc, 'Browse Posts', `${BASE_URL}/blog`),
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${cat.label} — Hotline HQ Blog`,
      description: cat.desc,
      url: `${BASE_URL}/blog/${catKey}`,
      isPartOf: { "@type": "Blog", name: "Hotline HQ Blog", url: `${BASE_URL}/blog` }
    }
  });
}

// ── Blog posts ──────────────────────────────────────────────────────

for (const post of blogData.posts) {
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
        "@type": "Question", name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a }
      }))
    });
  }

  addPage(`/blog/${post.category}/${post.slug}`, {
    title: `${post.title} — ${catLabel} | Hotline HQ`,
    description: post.description,
    url: postUrl,
    keywords: post.keywords || '',
    ogImage: post.ogImage ? `${BASE_URL}${post.ogImage}` : null,
    shell,
    ssrData: post,
    preloadChunks: blogPostChunks,
    jsonLd: { "@context": "https://schema.org", "@graph": jsonLdGraph }
  });
}

// ── Feature pages ───────────────────────────────────────────────────

for (const [slug, f] of Object.entries(featuresData)) {
  if (slug === 'desk-phone') continue;
  const seo = f.seo || {};
  const faqJsonLd = f.faqs?.length ? [{ "@type": "FAQPage", mainEntity: f.faqs.map(item => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) }] : [];

  const stepsHtml = f.steps?.length ? `<h2>How It Works</h2><ol>${f.steps.map(s => `<li><strong>${s.title}.</strong> ${s.desc}</li>`).join('')}</ol>` : '';
  const benefitsHtml = f.benefits?.length ? `<h2>Key Benefits</h2><ul>${f.benefits.map(b => `<li><strong>${b.title}.</strong> ${b.desc}</li>`).join('')}</ul>` : '';
  const problemHtml = f.problem?.text ? `<h2>${f.problem.heading || 'The Problem'}</h2><p>${f.problem.text}</p>` : '';
  const scenarioHtml = f.scenario?.text ? `<h2>${f.scenario.heading || 'Real-World Scenario'}</h2><p>${f.scenario.text}</p>` : '';
  const featFaqHtml = f.faqs?.length ? `<div class="ssr-faq-section"><h2>Frequently Asked Questions</h2>${f.faqs.map(item => `<div class="ssr-faq"><h3>${item.q}</h3><p>${item.a}</p></div>`).join('')}</div>` : '';
  const featResourcesHtml = f.resources?.length ? `<h2>Keep Exploring</h2><ul>${f.resources.map(r => `<li><a href="${BASE_URL}${r.href}">${r.label}</a></li>`).join('')}</ul>` : '';
  const featContentHtml = `<article style="max-width:800px;margin:0 auto;padding:0 24px 40px">${problemHtml}${stepsHtml}${benefitsHtml}${scenarioHtml}${featResourcesHtml}</article>${featFaqHtml}`;

  addPage(`/features/${slug}`, {
    title: seo.title || `${f.title} | Hotline HQ`,
    description: seo.description || '',
    keywords: seo.keywords || '',
    url: `${BASE_URL}/features/${slug}`,
    shell: ssrShell(f.hero?.kicker || 'FEATURE', f.hero?.heading || f.title, f.hero?.lede || '', 'Sign Up Free', `${BASE_URL}/client/signup`) + featContentHtml,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Features", item: `${BASE_URL}/own-a-hotline` },
          { "@type": "ListItem", position: 3, name: f.title, item: `${BASE_URL}/features/${slug}` },
        ]},
        { "@type": "Service", name: `${f.title} — Hotline HQ`, serviceType: "Voice Hotline Network Feature", provider: { "@type": "Organization", name: "Hotline HQ", url: `${BASE_URL}/` }, description: seo.description || '' },
        ...faqJsonLd,
      ]
    }
  });
}

// ── Regional pages ──────────────────────────────────────────────────

const ACTIVE_REGIONS = new Set(['california', 'texas', 'florida', 'arizona']);
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

for (const [stateKey, region] of Object.entries(REGIONS)) {
  const yardText = 'dismantler yards';
  const title = `Used Auto Parts in ${region.name} — ${region.abbr} Dismantler Network | Hotline HQ`;
  const description = `Find and sell used auto parts in ${region.name}. ${yardText} on a live voice network. Broadcast what you need and get answers in seconds.`;

  const rc = ACTIVE_REGIONS.has(stateKey) ? regionsData[stateKey] : null;
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
        { "@type": "ListItem", position: 3, name: `Used Auto Parts in ${region.name}`, item: `${BASE_URL}/used-auto-parts/${stateKey}` },
      ]
    },
  ];
  if (rc?.faqs?.length) {
    jsonLdGraph.push({
      "@type": "FAQPage",
      mainEntity: rc.faqs.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
    });
  }

  addPage(`/used-auto-parts/${stateKey}`, {
    title,
    description,
    url: `${BASE_URL}/used-auto-parts/${stateKey}`,
    keywords: `used auto parts ${region.name}, ${region.abbr} auto parts, ${region.name} dismantler, junkyard parts ${region.name}, salvage auto parts ${region.abbr}`,
    robots: ACTIVE_REGIONS.has(stateKey) ? undefined : 'noindex, follow',
    shell: ssrShell(
      `${region.abbr} NETWORK`,
      `Used auto parts in <em>${region.name}</em>`,
      `Hotline HQ's ${region.name} room connects ${yardText} on a live voice hotline. Broadcast what you need — every yard in ${region.name} hears it instantly.`,
      `Join ${region.name} Room — Free`, `${BASE_URL}/client/signup?room=${encodeURIComponent(region.name)}`
    ) + contentHtml,
    jsonLd: { "@context": "https://schema.org", "@graph": jsonLdGraph }
  });
}

// ── SEO pages (keyword + industry) — driven by content/pages/*.md ──

for (const [slug, p] of Object.entries(pagesData)) {
  const seo = p.seo || {};
  const hero = p.hero || {};
  const isIndustry = p.type === 'industry';

  // Build section content HTML
  const sectionsHtml = (p.sections || []).map(s => {
    const cardsHtml = (s.cards || []).map(c =>
      `<h3>${c.title}</h3>\n<p>${c.copy}</p>`
    ).join('\n');
    return `<h2>${s.heading}</h2>\n${s.lede ? `<p>${s.lede}</p>` : ''}\n${cardsHtml}`;
  }).join('\n\n');

  // Parts list
  const partsHtml = (p.parts || []).length
    ? `<h2>Parts in Demand</h2>\n<p>${p.parts.join(' · ')}</p>`
    : '';

  // Steps
  const stepsHtml = (p.steps || []).length
    ? `<h2>How It Works</h2>\n<ol>${p.steps.map(s => `<li><strong>${s.title}.</strong> ${s.desc}</li>`).join('')}</ol>`
    : '';

  // Full article content
  const contentHtml = `<article style="max-width:800px;margin:0 auto;padding:0 24px 64px">\n${sectionsHtml}\n${stepsHtml}\n${partsHtml}\n</article>`;

  // FAQ HTML
  const faqItems = p.faqs || [];
  const faqHtml = faqItems.length
    ? `<div class="ssr-faq-section"><h2>Frequently Asked Questions</h2>${faqItems.map(f => `<div class="ssr-faq"><h3>${f.q}</h3><p>${f.a}</p></div>`).join('')}</div>`
    : '';

  // Resources / cross-links
  const resourcesHtml = (p.resources || []).length
    ? `<div class="ssr-faq-section"><h2>Keep Exploring</h2><ul>${p.resources.map(r => `<li><a href="${BASE_URL}${r.href}">${r.label}</a></li>`).join('')}</ul></div>`
    : '';

  // Shell
  const ctaHref = isIndustry ? `mailto:hello@hotlinehq.online` : `${BASE_URL}/client/signup`;
  const ctaText = isIndustry ? 'Join the Waitlist' : 'Sign Up Free';
  const shell = ssrShell(
    hero.kicker || slug.toUpperCase(),
    hero.heading || p.title,
    hero.lede || seo.description || '',
    ctaText, ctaHref
  ) + contentHtml + faqHtml + resourcesHtml;

  // JSON-LD graph
  const jsonLdGraph = [
    {
      "@type": "Service",
      name: `${p.title} — Hotline HQ`,
      serviceType: seo.serviceType || "Parts Locating Network",
      provider: orgJsonLd,
      areaServed: "US",
      description: seo.description || '',
    },
  ];
  if (faqItems.length) {
    jsonLdGraph.push({
      "@type": "FAQPage",
      mainEntity: faqItems.map(f => ({
        "@type": "Question", name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }
  if ((p.steps || []).length) {
    jsonLdGraph.push({
      "@type": "HowTo",
      name: `How to use ${p.title}`,
      description: seo.description || '',
      step: p.steps.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.title,
        text: s.desc,
      })),
    });
  }

  const routePrefix = isIndustry ? '/use-case' : '';
  addPage(`${routePrefix}/${slug}`, {
    title: seo.title || `${p.title} | Hotline HQ`,
    description: seo.description || '',
    url: `${BASE_URL}${routePrefix}/${slug}`,
    keywords: seo.keywords || '',
    ogImage: hero.image ? `${BASE_URL}${hero.image}` : undefined,
    shell,
    jsonLd: { "@context": "https://schema.org", "@graph": jsonLdGraph },
  });
}

// ── (Old hardcoded entries removed — now driven by content/pages/*.md via data-driven loop above) ──
// REMOVAL_START
// ── Generate all pages ──────────────────────────────────────────────

if (fs.existsSync(PRERENDER_DIR)) {
  fs.rmSync(PRERENDER_DIR, { recursive: true });
}
fs.mkdirSync(PRERENDER_DIR, { recursive: true });

let count = 0;
for (const { route, seo } of pages) {
  const html = injectSeoMeta(templateHtml, seo);

  // Convert route to file path: / → index.html, /blog → blog.html, /blog/guides/slug → blog/guides/slug.html
  let filePath;
  if (route === '/') {
    filePath = path.join(PRERENDER_DIR, 'index.html');
  } else {
    filePath = path.join(PRERENDER_DIR, `${route.slice(1)}.html`);
  }

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, html);

  // Pre-compress gzip version for Express to serve directly
  const gz = zlib.gzipSync(html);
  fs.writeFileSync(`${filePath}.gz`, gz);

  count++;
}

console.log(`[prerender] Generated ${count} static HTML pages in dist-client/prerender/`);

// ── Generate sitemap.xml from prerendered routes ──────────────────

const today = new Date().toISOString().split('T')[0];
const sitemapEntries = pages
  .filter(p => !p.seo.robots?.includes('noindex'))
  .map(p => {
    const url = p.seo.url || `${BASE_URL}${p.route}`;
    const lastmod = p.seo.ssrData?.date || today;
    return `  <url>\n    <loc>${url}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
  });

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.join('\n')}
</urlset>`;

const sitemapPath = path.join(ROOT, 'public', 'sitemap.xml');
fs.writeFileSync(sitemapPath, sitemapXml);
console.log(`[prerender] Generated sitemap.xml with ${sitemapEntries.length} URLs (${today})`);
console.log('[prerender] Done');
