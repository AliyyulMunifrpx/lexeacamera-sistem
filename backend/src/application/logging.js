import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    // Simpan semua error ke file error.log
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    // Simpan semua log (info, error, dll) ke combined.log
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

// Kalau lagi development, tampilin juga di console terminal dengan warna biar rapi
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  );
}

export default logger;
