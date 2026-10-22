import express from "express";
import cors from "cors";
import publicRouter from "../route/public-route.js";
import { errorMiddleware } from "../middleware/error-middleware.js";
import { authMiddleware } from "../middleware/auth-middleware.js";
import privateRouter from "../route/route.js";

export const web = express();
web.use(express.json());
web.use(
  cors({
    origin: process.env.FRONTEND_URL, // Alamat frontend Vite lu
    exposedHeaders: ["x-new-access-token", "x-new-refresh-token"],
  }),
);
web.use(publicRouter);
web.use(authMiddleware);
web.use(privateRouter);
web.use(errorMiddleware);
