import express from 'express';
import { sendMail } from '../../service/emailSender.js';

export const marketplaceRouter = express.Router();

// ── Helpers ──

function isRealValue(v) {
    return v && v !== 'null' && v !== 'undefined' && String(v).trim() !== '';
}

function generateSlug(broadcast) {
    const parts = JSON.parse(broadcast.part_details || '{}');
    const segments = [
        parts.year, parts.make, parts.model, parts.part,
    ].filter(isRealValue).map(s =>
        String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    );

    const room = global.db.getRoom(broadcast.room);
    if (room?.short_code) segments.push(room.short_code.toLowerCase());

    segments.push(String(broadcast.id));
    return segments.join('-');
}

function extractIdFromSlug(slug) {
    const lastHyphen = slug.lastIndexOf('-');
    const idPart = lastHyphen >= 0 ? slug.substring(lastHyphen + 1) : slug;
    return parseInt(idPart, 10) || null;
}

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim().replace('::ffff:', '');
    const realIp = req.headers['x-real-ip'];
    if (realIp) return realIp.trim().replace('::ffff:', '');
    return (req.ip || '').replace('::ffff:', '');
}

const SEVEN_DAYS = 7 * 24 * 60 * 60;

// ── GET /listings ──

marketplaceRouter.get('/listings', (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));
        const room = req.query.room ? parseInt(req.query.room) : undefined;
        const year = req.query.year || undefined;
        const make = req.query.make || undefined;
        const model = req.query.model || undefined;

        const result = global.db.getMarketplaceListings({ page, pageSize, room, year, make, model });

        const now = Math.floor(Date.now() / 1000);
        result.data = result.data.map(row => {
            const responseCount = global.db.getMarketplaceResponseCountForBroadcast(row.id);
            const roomInfo = global.db.getRoom(row.room);
            return {
                ...row,
                part_details: row.part_details ? JSON.parse(row.part_details) : null,
                slug: generateSlug(row),
                room_short_code: roomInfo?.short_code || null,
                response_count: responseCount,
                is_expired: (now - row.created_at) > SEVEN_DAYS,
            };
        });

        const rooms = global.db.getAllRooms().map(r => ({ id: r.id, name: r.name, short_code: r.short_code }));

        res.json({ status: true, ...result, rooms });
    } catch (err) {
        console.error('[MARKETPLACE] listings error:', err.message);
        res.status(500).json({ status: false, error: 'Internal server error' });
    }
});

// ── GET /listings/:slug ──

marketplaceRouter.get('/listings/:slug', (req, res) => {
    try {
        const id = extractIdFromSlug(req.params.slug);
        if (!id) return res.status(400).json({ status: false, error: 'Invalid listing slug' });

        const broadcast = global.db.getMarketplaceListingById(id);
        if (!broadcast) return res.status(404).json({ status: false, error: 'Listing not found' });

        const now = Math.floor(Date.now() / 1000);
        const isExpired = (now - broadcast.created_at) > SEVEN_DAYS;

        const responseCount = global.db.getMarketplaceResponseCountForBroadcast(id);

        res.json({
            status: true,
            data: {
                ...broadcast,
                part_details: broadcast.part_details ? JSON.parse(broadcast.part_details) : null,
                slug: generateSlug(broadcast),
                is_expired: isExpired,
                response_count: responseCount,
            },
        });
    } catch (err) {
        console.error('[MARKETPLACE] listing detail error:', err.message);
        res.status(500).json({ status: false, error: 'Internal server error' });
    }
});

// ── POST /listings/:slug/respond ──

marketplaceRouter.post('/listings/:slug/respond', express.json(), (req, res) => {
    try {
        const broadcastId = extractIdFromSlug(req.params.slug);
        if (!broadcastId) return res.status(400).json({ status: false, error: 'Invalid listing slug' });

        const { name, company, phone, email, message } = req.body || {};

        // Validation
        if (!name || !String(name).trim()) {
            return res.status(400).json({ status: false, error: 'Name is required' });
        }
        if (!phone || !String(phone).trim()) {
            return res.status(400).json({ status: false, error: 'Phone is required' });
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
            return res.status(400).json({ status: false, error: 'Enter a valid email address' });
        }

        // Check listing exists
        const broadcast = global.db.getMarketplaceListingById(broadcastId);
        if (!broadcast) return res.status(404).json({ status: false, error: 'Listing not found' });

        // Rate limiting
        const ip = getClientIp(req);

        const ipCount = global.db.getIpResponseCount(ip);
        if (ipCount >= 5) {
            return res.status(429).json({ status: false, error: 'Too many responses. Please try again later.' });
        }

        const broadcastIpCount = global.db.getMarketplaceResponseCount(broadcastId, ip);
        if (broadcastIpCount >= 3) {
            return res.status(429).json({ status: false, error: 'You have already responded to this listing.' });
        }

        // Insert response
        global.db.createMarketplaceResponse({
            broadcastId,
            name: String(name).trim(),
            company: company ? String(company).trim() : null,
            phone: String(phone).trim(),
            email: String(email).trim(),
            message: message ? String(message).trim() : null,
            ip,
        });

        // Send email notification to broadcaster
        // Use getBroadcastById to get user_name (not exposed in marketplace listing)
        const fullBroadcast = global.db.getBroadcastById(broadcastId);
        const broadcasterEmail = fullBroadcast?.user_name?.replace('sip:', '');
        if (broadcasterEmail) {
            const account = global.db.getAccountByEmail(broadcasterEmail);
            const parts = JSON.parse(broadcast.part_details || '{}');
            const partDesc = [parts.year, parts.make, parts.model, parts.part].filter(Boolean).join(' ');

            sendMail({
                to: broadcasterEmail,
                subject: `Someone has your part — ${partDesc}`,
                text: [
                    `Hi ${account?.display_name || 'there'},`,
                    '',
                    `Someone on Hotline HQ Marketplace has the ${partDesc} you were looking for:`,
                    '',
                    `Name: ${String(name).trim()}`,
                    `Company: ${company ? String(company).trim() : '-'}`,
                    `Phone: ${String(phone).trim()}`,
                    `Email: ${String(email).trim()}`,
                    message ? `Message: ${String(message).trim()}` : '',
                    '',
                    'Call or email them directly to close the deal.',
                    '',
                    '— Hotline HQ',
                ].filter(Boolean).join('\n'),
            }).catch(err => {
                console.error('[MARKETPLACE] Email notification failed:', err.message);
            });
        }

        res.json({ status: true, message: 'Response submitted' });
    } catch (err) {
        console.error('[MARKETPLACE] respond error:', err.message);
        res.status(500).json({ status: false, error: 'Internal server error' });
    }
});

// ── GET /sitemap.xml ──

marketplaceRouter.get('/sitemap.xml', (req, res) => {
    try {
        const result = global.db.getMarketplaceListings({ page: 1, pageSize: 1000 });
        const baseUrl = 'https://hotlinehq.online';

        const urls = result.data.map(row => {
            const slug = generateSlug(row);
            const lastmod = new Date(row.created_at * 1000).toISOString().split('T')[0];
            return `  <url>\n    <loc>${baseUrl}/parts/${slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
        });

        const xml = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            ...urls,
            '</urlset>',
        ].join('\n');

        res.set('Content-Type', 'application/xml');
        res.send(xml);
    } catch (err) {
        console.error('[MARKETPLACE] sitemap error:', err.message);
        res.status(500).set('Content-Type', 'application/xml').send(
            '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
        );
    }
});
