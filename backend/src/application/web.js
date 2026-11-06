import express from "express";
import cors from "cors";
import publicRouter from "../route/public-route.js";
import adminRouter from "../route/admin-route.js";
import ownerRouter from "../route/owner-router.js";
import { errorMiddleware } from "../middleware/error-middleware.js";
import { authMiddleware, requireRole } from "../middleware/auth-middleware.js";
import { getAllowedOrigins } from "../utils/auth-cookies.js";

export const web = express();

web.use(cors({ origin: getAllowedOrigins(), credentials: true }));
web.use(express.json());
web.set("trust proxy", 1);
web.use(publicRouter);
web.use(authMiddleware);
web.use(adminRouter);
web.use(requireRole("OWNER"));
web.use(ownerRouter);
web.use(errorMiddleware);
