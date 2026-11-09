import { ResponseError } from "../error/response-error.js";

const REQUIRED = ["BREVO_API_KEY", "MAIL_FROM"];
const ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const TIMEOUT_MS = 15000;

const parseSender = (value) => {
  const match = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);

  if (match) {
    const name = match[1].trim();
    return name ? { name, email: match[2].trim() } : { email: match[2].trim() };
  }

  return { email: value.trim() };
};

export const sendMail = async ({ to, subject, text }) => {
  if (!REQUIRED.every((name) => process.env[name])) {
    if (process.env.NODE_ENV === "production") {
      throw new ResponseError(500, "MAIL_NOT_CONFIGURED");
    }

    console.log(`[mail:dev] to=${to}\nsubject=${subject}\n${text}`);
    return;
  }

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: parseSender(process.env.MAIL_FROM),
      to: [{ email: to }],
      subject,
      textContent: text,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Brevo ${response.status}: ${detail.slice(0, 300)}`);
  }
};
