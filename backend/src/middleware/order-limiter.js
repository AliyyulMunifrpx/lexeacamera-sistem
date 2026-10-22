import rateLimit from "express-rate-limit";

// skip: dimatikan saat test supaya ratusan request test nggak kena batas
export const createOrderLimiter = ({
  limit = 10,
  windowMs = 15 * 60 * 1000,
  skip = () => process.env.NODE_ENV === "test",
} = {}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip,
    handler: (req, res) => {
      res.status(429).json({ errors: "TOO_MANY_REQUESTS" });
    },
  });

export const orderLimiter = createOrderLimiter();
