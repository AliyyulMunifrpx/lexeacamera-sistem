import express from "express";
import userController from "../controller/user-controller.js";
import bannerController from "../controller/owner/banner-controller.js";
import { orderLimiter } from "../middleware/order-limiter.js";
import orderController from "../controller/public/order-controller.js";
import { publicLimiter } from "../utils/public-limiter.js";
import publicController from "../controller/public/public-controller.js";
import attendanceController from "../controller/public/attendance-controller.js";
import publicEmployeeController from "../controller/public/employee-controller.js";
import authController from "../controller/public/auth-controller.js";

const publicRouter = express.Router();

publicRouter.post("/users/register", userController.register);
publicRouter.post("/users/login", userController.login);
publicRouter.get("/banners", bannerController.getAllBanner);
publicRouter.post("/orders", orderLimiter, orderController.createOrder);
publicRouter.get("/public/store", publicLimiter, publicController.getStore);
publicRouter.get(
  "/public/cameras",
  publicLimiter,
  publicController.getAllCamera,
);
publicRouter.get(
  "/public/cameras/:id",
  publicLimiter,
  publicController.getCamera,
);
publicRouter.get("/public/home", publicLimiter, publicController.getHome);
publicRouter.get("/public/my-ip", publicLimiter, attendanceController.myIp);
publicRouter.get(
  "/public/attendance/employees",
  publicLimiter,
  attendanceController.getEmployees,
);
publicRouter.post(
  "/public/attendance/check-in",
  publicLimiter,
  attendanceController.checkIn,
);
publicRouter.post(
  "/public/attendance/check-out",
  publicLimiter,
  attendanceController.checkOut,
);
publicRouter.post(
  "/public/employees/token-info",
  publicLimiter,
  publicEmployeeController.tokenInfo,
);
publicRouter.post(
  "/public/employees/set-pin",
  publicLimiter,
  publicEmployeeController.setPin,
);
publicRouter.post(
  "/public/auth/set-password",
  publicLimiter,
  authController.setPassword,
);
publicRouter.post(
  "/public/auth/forgot-password",
  publicLimiter,
  authController.forgotPassword,
);
publicRouter.get(
  "/public/attendance/today",
  publicLimiter,
  attendanceController.getToday,
);
publicRouter.post(
  "/public/attendance/history",
  publicLimiter,
  attendanceController.getHistory,
);
export default publicRouter;
