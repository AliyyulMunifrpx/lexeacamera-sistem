import { ResponseError } from "../error/response-error.js";

const REQUIRED = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"];

let transporter;

export const sendMail = async ({ to, subject, text }) => {
  if (!REQUIRED.every((name) => process.env[name])) {
    if (process.env.NODE_ENV === "production") {
      throw new ResponseError(500, "MAIL_NOT_CONFIGURED");
    }

    console.log(`[mail:dev] to=${to}\nsubject=${subject}\n${text}`);
    return;
  }

  if (!transporter) {
    const { default: nodemailer } = await import("nodemailer");
    const port = Number(process.env.SMTP_PORT);

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    text,
  });
};
