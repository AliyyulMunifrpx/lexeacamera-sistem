import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Output,
  Quality,
  WebMOutputFormat,
} from "mediabunny";

const MAX_SHORT_SIDE = 720;
const MAX_FPS = 30;

const even = (value) => Math.max(2, Math.round(value / 2) * 2);

export const canCompressVideo = () =>
  typeof window !== "undefined" &&
  typeof VideoEncoder !== "undefined" &&
  typeof VideoDecoder !== "undefined";

const original = (file, reason) => ({ file, compressed: false, reason });

const webmName = (name) => `${name.replace(/\.[^.]+$/, "") || "video"}.webm`;

const readFps = async (track) => {
  try {
    const stats = await track.computePacketStats(60);
    return stats.averagePacketRate;
  } catch {
    return 0;
  }
};

export async function compressVideo(
  file,
  {
    maxShortSide = MAX_SHORT_SIDE,
    quality = "medium",
    keepAudio = true,
    onProgress,
    signal,
  } = {},
) {
  if (!canCompressVideo()) return original(file, "UNSUPPORTED_BROWSER");

  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });
  let conversion;

  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return original(file, "NO_VIDEO_TRACK");

    const video = { codec: "vp9", quality: new Quality(quality) };

    const width = track.displayWidth;
    const height = track.displayHeight;
    const shortSide = Math.min(width, height);
    if (shortSide > maxShortSide) {
      const scale = maxShortSide / shortSide;
      video.width = even(width * scale);
      video.height = even(height * scale);
      video.fit = "fill";
    }

    if ((await readFps(track)) > MAX_FPS + 1) video.frameRate = MAX_FPS;

    const output = new Output({
      format: new WebMOutputFormat(),
      target: new BufferTarget(),
    });

    conversion = await Conversion.init({
      input,
      output,
      video,
      audio: keepAudio ? { codec: "opus" } : { discard: true },
    });

    if (!conversion.isValid) return original(file, "NOT_CONVERTIBLE");
    if (conversion.discardedTracks.some((d) => d.track.isVideoTrack())) {
      return original(file, "NOT_CONVERTIBLE");
    }

    if (onProgress) conversion.onProgress = (value) => onProgress(value);
    if (signal) {
      signal.addEventListener("abort", () => conversion.cancel(), {
        once: true,
      });
    }

    await conversion.execute();

    const buffer = output.target.buffer;
    if (!buffer || buffer.byteLength === 0 || buffer.byteLength >= file.size) {
      return original(file, "NOT_SMALLER");
    }

    return {
      file: new File([buffer], webmName(file.name), { type: "video/webm" }),
      compressed: true,
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    console.error("Video compression failed:", error);
    return original(file, "FAILED");
  } finally {
    input.dispose?.();
  }
}
