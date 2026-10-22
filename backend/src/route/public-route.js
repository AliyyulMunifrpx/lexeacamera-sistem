import express from "express";
import userController from "../controller/user-controller.js";
import bannerController from "../controller/banner-controller.js";
import { orderLimiter } from "../middleware/order-limiter.js";
import orderController from "../controller/order-controller.js";

const publicRouter = express.Router();

publicRouter.post("/users/register", userController.register);
publicRouter.post("/users/login", userController.login);
publicRouter.get("/banners", bannerController.getAllBanner);
publicRouter.post("/orders", orderLimiter, orderController.createOrder);

export default publicRouter;
