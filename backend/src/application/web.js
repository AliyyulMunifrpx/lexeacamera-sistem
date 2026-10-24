import express from "express";
import cors from "cors";
import publicRouter from "../route/public-route.js";
import { errorMiddleware } from "../middleware/error-middleware.js";
import { authMiddleware } from "../middleware/auth-middleware.js";
import privateRouter from "../route/route.js";

export const web = express();

const allowedOrigins = [
  process.env.FRONTEND_URL, // Tetap baca dari env Render buat fleksibilitas
  "https://wavcamera.id", // Hardcode domain utama jaga-jaga kalau env kosong
  "https://www.wavcamera.id", // Hardcode versi www
  "http://localhost:3000", // Buat testing lokal
  "http://localhost:5173", // Buat Vite (jaga-jaga)
].filter(Boolean); // Buang nilai kalau ada yang undefined

web.use(
  cors({
    origin: function (origin, callback) {
      // Izinkan request tanpa origin (seperti Postman atau server-to-server)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Blocked by CORS policy: " + origin));
      }
    },
    credentials: true,
    exposedHeaders: ["x-new-access-token", "x-new-refresh-token"],
  }),
);

web.use(express.json());

web.use(publicRouter);
web.use(authMiddleware);
web.use(privateRouter);
web.use(errorMiddleware);
