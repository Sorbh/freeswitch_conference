import express from "express";
import { freeswitchRouter } from "../modules/freeswitch/routesApi.js";
import { adminRouter } from "../modules/admin/routesApi.js";
import { eventsRouter } from "../modules/admin/events.js";
import { clientRouter } from "../modules/client/routesApi.js";
import { publicRouter } from "../modules/public/routesApi.js";
import { marketplaceRouter } from "../modules/marketplace/routesApi.js";
import { yealinkRouter } from "../modules/yealink/routesApi.js";
import { authRouter } from "../modules/auth/routesApi.js";
import {
    requireAuth,
    requireSSEAuth,
    requireLocalhost,
    requireRole,
} from "../service/auth/middleware.js";

export default class ApiRouter {
    apiRouter;
    constructor() {
        this.apiRouter = express.Router();

        this.apiRouter.use("/auth", authRouter);
        this.apiRouter.use("/public", publicRouter);
        this.apiRouter.use("/marketplace", marketplaceRouter);
        this.apiRouter.use("/client", clientRouter);
        this.apiRouter.use("/yealink", yealinkRouter);
        this.apiRouter.use("/freeswitch", requireLocalhost, freeswitchRouter);

        // Admin: SSE event endpoints use cookie auth, everything else uses Bearer
        this.apiRouter.use("/admin/events", requireSSEAuth, eventsRouter);
        this.apiRouter.use("/admin", requireAuth, _adminRoleGuard, adminRouter);
    }
}

function _adminRoleGuard(req, res, next) {
    const path = req.path.replace(/^\//, '');
    const method = req.method;

    // Skip SSE event paths (handled by cookie auth above)
    if (path.startsWith('events')) return next();

    // Admin-only: accounts, YMCS, system, whatsapp, auth management
    if (path.startsWith('accounts') || path.startsWith('ymcs/') ||
        path === 'system' || path.startsWith('whatsapp/')) {
        return requireRole('admin')(req, res, next);
    }

    // Settings: admin-only
    if (path.startsWith('settings')) {
        return requireRole('admin')(req, res, next);
    }

    // Write operations (POST/PUT/DELETE) on users, rooms, notifications, audio-ads, transcribe: admin + editor
    if (method !== 'GET') {
        if (path.startsWith('users/') || path.startsWith('rooms') ||
            path.startsWith('notifications') || path.startsWith('audio-ads') ||
            path.match(/broadcasts\/\d+\/transcribe/)) {
            return requireRole('admin', 'editor')(req, res, next);
        }
    }

    // All GET endpoints: any authenticated role can read
    next();
}
