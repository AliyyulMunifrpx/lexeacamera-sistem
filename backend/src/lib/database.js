import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import logger from "../application/logging.js";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
  log: [
    { emit: "event", level: "query" },
    { emit: "event", level: "error" },
    { emit: "event", level: "info" },
    { emit: "event", level: "warn" },
  ],
});

// Menghubungkan event Prisma ke Winston/Custom Logger lu
prisma.$on("error", (e) => {
  logger.error(e);
});

prisma.$on("warn", (e) => {
  logger.warn(e);
});

prisma.$on("info", (e) => {
  logger.info(e);
});

prisma.$on("query", (e) => {
  // Opsional: Ditulis biar tau query SQL apa yang lagi jalan beserta durasinya
  logger.info(`Query: ${e.query} | Duration: ${e.duration}ms`);
});
