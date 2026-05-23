import express from "express";
import { controllers } from "./controllers.js";

export let testRouter = express.Router();

testRouter.get("/test", controllers.test);
