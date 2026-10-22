import multer from "multer";
import { ResponseError } from "../error/response-error.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 12;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
  fileFilter: (req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return callback(new ResponseError(400, "INVALID_IMAGE_FORMAT"));
    }

    callback(null, true);
  },
});

const MULTER_ERRORS = {
  LIMIT_FILE_SIZE: "IMAGE_TOO_LARGE",
  LIMIT_FILE_COUNT: "TOO_MANY_CAMERA_IMAGES",
  LIMIT_UNEXPECTED_FILE: "INVALID_IMAGE_FIELD", // nama field salah, atau file kelebihan
};

const handle = (middleware) => (req, res, next) => {
  middleware(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      return next(
        new ResponseError(400, MULTER_ERRORS[error.code] ?? "INVALID_UPLOAD"),
      );
    }

    next(error); // ResponseError dari fileFilter lanjut ke error handler
  });
};

export const uploadImages = (fieldName = "images") =>
  handle(upload.array(fieldName));

export const uploadLogo = (fieldName = "logo") =>
  handle(upload.single(fieldName));
export const uploadBanner = (fieldName = "banner") =>
  handle(upload.single(fieldName));
export const uploadStoreImages = () =>
  handle(
    upload.fields([
      { name: "logo", maxCount: 1 },
      { name: "main_banner", maxCount: 1 },
    ]),
  );
