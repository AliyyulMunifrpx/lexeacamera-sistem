import logger from "../application/logging.js";
import { ResponseError } from "../error/response-error.js";

const errorMiddleware = (error, req, res, next) => {
  if (!error) {
    return next();
  }
  logger.error(error);
  logger.error("code:", error.code);
  logger.error("field:", error.field);
  // Handle Custom Error (400, 401, 403, 404, dll)
  if (error instanceof ResponseError) {
    return res.status(error.status).json({
      errors: error.message,
      ...(error.details !== undefined && { details: error.details }),
    });
  }
  // Handle Server Error (500)
  const isProduction = process.env.NODE_ENV === "production";
  return res.status(500).json({
    errors: isProduction ? "INTERNAL_SERVER_ERROR" : error.message,
  });
};

export { errorMiddleware };
