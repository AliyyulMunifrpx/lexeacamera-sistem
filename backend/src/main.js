import logger from "./application/logging.js";
import { web } from "./application/web.js";
import { startKeepAlive } from "./utils/keep-alive.js";

// Ambil port dari environment variable Render, atau fallback ke 3500 untuk lokal
const PORT = process.env.PORT || 3500;

web.listen(PORT, "0.0.0.0", () => {
  startKeepAlive();

  logger.info(`App API started on port ${PORT}`);
});
