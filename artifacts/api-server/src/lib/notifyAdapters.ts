import { logger } from "./logger";

export type Channel = "email" | "sms" | "whatsapp" | "inbox";
export interface SendResult {
  ok: boolean;
  provider: string;
  error?: string;
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
): Promise<SendResult> {
  logger.info(
    { to, subject, preview: body.slice(0, 140) },
    "[email-stub] would deliver",
  );
  if (!to) return { ok: false, provider: "stub-email", error: "no recipient" };
  return { ok: true, provider: "stub-email" };
}

export async function sendSms(to: string, body: string): Promise<SendResult> {
  logger.info({ to, preview: body.slice(0, 140) }, "[sms-stub] would deliver");
  if (!to) return { ok: false, provider: "stub-sms", error: "no recipient" };
  return { ok: true, provider: "stub-sms" };
}

export async function sendWhatsapp(
  to: string,
  body: string,
): Promise<SendResult> {
  logger.info(
    { to, preview: body.slice(0, 140) },
    "[whatsapp-stub] would deliver",
  );
  if (!to)
    return { ok: false, provider: "stub-whatsapp", error: "no recipient" };
  return { ok: true, provider: "stub-whatsapp" };
}
