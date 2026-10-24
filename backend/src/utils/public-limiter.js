import rateLimit from "express-rate-limit";

// Endpoint katalog terbuka untuk siapa saja, jadi dibatasi per IP.
// 120 request per menit cukup longgar untuk browsing dan prefetch halaman.
// skip: dimatikan saat test supaya ratusan request test nggak kena batas
export const createPublicLimiter = ({
  limit = 120,
  windowMs = 60 * 1000,
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

export const publicLimiter = createPublicLimiter();
