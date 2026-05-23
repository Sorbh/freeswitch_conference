import express from "express";
import ActionApiRouter from "../modules/sip-action/routesApi.js";
import { testRouter } from "../modules/test/routesApi.js";
import { debugRouter } from "../modules/debug/routesApi.js";
import { freeswitchRouter } from "../modules/freeswitch/routesApi.js";

export default class ApiRouter {
    apiRouter;
    constructor() {
        this.apiRouter = express.Router();

        this.apiRouter.use("/test", testRouter);
        this.apiRouter.use("/action", new ActionApiRouter().actionRouter);
        this.apiRouter.use("/debug", debugRouter);
        this.apiRouter.use("/freeswitch", freeswitchRouter);
    }
}
