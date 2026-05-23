import express from "express";
import Controller from "./controllers.js";

export default class ActionApiRouter {
    constructor() {
        this.actionRouter = express.Router();
        const actionController = new Controller();

        // Call control
        this.actionRouter.get("/newcall", actionController.newCall);
        this.actionRouter.get("/endcall", actionController.endCall);
        this.actionRouter.get("/status", actionController.status);

        // Mute/unmute
        this.actionRouter.get("/onhook", actionController.onHook);
        this.actionRouter.get("/offhook", actionController.offhook);

        // Auth
        this.actionRouter.get("/login", actionController.login);
        this.actionRouter.get("/logout", actionController.logout);

        // Bulk actions
        this.actionRouter.get("/allendcall", actionController.allEndCall);
        this.actionRouter.get("/allnewcall", actionController.allNewCall);
        this.actionRouter.get("/allstatus", actionController.allStatus);

        // Room management
        this.actionRouter.get("/updateroom", actionController.updateRoom);
        this.actionRouter.post("/statusupdate", actionController.statusUpdate);

        // Phone control
        this.actionRouter.get("/showmessage", actionController.showmessage);
        this.actionRouter.get("/honkRoom", actionController.honkRoom);

        // User management
        this.actionRouter.post("/delete", actionController.deleteAccount);
    }
}
