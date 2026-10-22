import sharp from "sharp";
import { ResponseError } from "../error/response-error.js";

const ALLOWED_FORMATS = ["jpeg", "png", "webp"];

export const processImage = async (
  buffer,
  { width = 1600, height = 1600, quality = 80, fit = "inside" } = {},
) => {
  const image = sharp(buffer, {
    failOn: "error",
    limitInputPixels: 20_000_000,
    animated: false,
  });

  const metadata = await image.metadata();

  // Jangan hanya mengandalkan MIME type dari request.
  if (!ALLOWED_FORMATS.includes(metadata.format)) {
    throw new ResponseError(400, "INVALID_IMAGE_FORMAT");
  }

  return image
    .rotate()
    .resize(width, height, {
      fit,
      withoutEnlargement: true,
    })
    .webp({
      quality,
    })
    .toBuffer();
};
