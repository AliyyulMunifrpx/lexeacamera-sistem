import express from "express";
import cors from "cors";
import publicRouter from "../route/public-route.js";
import adminRouter from "../route/admin-route.js";
import ownerRouter from "../route/owner-router.js";
import { errorMiddleware } from "../middleware/error-middleware.js";
import { authMiddleware, requireRole } from "../middleware/auth-middleware.js";
import { getAllowedOrigins } from "../utils/auth-cookies.js";
import { healthHandler } from "../utils/keep-alive.js";

export const web = express();
web.get("/health", healthHandler);

web.use(cors({ origin: getAllowedOrigins(), credentials: true }));
web.use(express.json());
web.set("trust proxy", 3);
web.use(publicRouter);
web.use(authMiddleware);
web.use(adminRouter);
web.use(requireRole("OWNER"));
web.use(ownerRouter);
web.use(errorMiddleware);
