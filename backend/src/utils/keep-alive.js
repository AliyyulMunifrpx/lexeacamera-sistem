const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;
const MIN_INTERVAL_MS = 60 * 1000;
const TIMEOUT_MS = 15 * 1000;

export const healthHandler = (req, res) => {
  res.status(200).json({ status: "ok" });
};

export const startKeepAlive = ({
  baseUrl = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL,
  intervalMs = Number(process.env.KEEP_ALIVE_INTERVAL_MS) ||
    DEFAULT_INTERVAL_MS,
} = {}) => {
  if (process.env.NODE_ENV === "test") return null;
  if (process.env.KEEP_ALIVE === "false") return null;
  if (!baseUrl) return null;

  const target = new URL("/health", baseUrl).toString();
  const delay = Math.max(MIN_INTERVAL_MS, intervalMs);

  const ping = async () => {
    try {
      const res = await fetch(target, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) console.warn(`[keep-alive] ${target} -> ${res.status}`);
    } catch (error) {
      console.warn(`[keep-alive] gagal: ${error.message}`);
    }
  };

  const timer = setInterval(ping, delay);
  timer.unref();
  return timer;
};
