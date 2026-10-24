import logger from "./application/logging.js";
import { web } from "./application/web.js";

web.listen(3500, () => {
  logger.info("App API started on port 3000");
});
