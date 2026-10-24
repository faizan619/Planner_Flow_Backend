import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

// Sends email through Gmail SMTP (MAIL_MODE=smtp, the default in production),
// or writes each message as a JSON file into MAIL_OUTBOX_DIR (MAIL_MODE=file)
// so development and the test suite can read codes without a real inbox.

const globalForMail = globalThis;

function transport() {
  globalForMail.__plannerMailer ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return globalForMail.__plannerMailer;
}

function mode() {
  if (process.env.NODE_ENV === "production") return "smtp";
  return process.env.MAIL_MODE === "smtp" ? "smtp" : "file";
}

export async function sendMail({ to, subject, text }) {
  if (mode() === "file") {
    const dir = process.env.MAIL_OUTBOX_DIR || path.join(process.cwd(), ".mail-outbox");
    await mkdir(dir, { recursive: true });
    const file = `${Date.now()}-${to.replace(/[^a-z0-9@._-]/gi, "_")}.json`;
    await writeFile(path.join(dir, file), JSON.stringify({ to, subject, text }, null, 2));
    return;
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP_USER / SMTP_PASS are not set");
  }
  await transport().sendMail({
    from: process.env.MAIL_FROM || `Planner Flow <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
  });
}
