import type { Invoice, School } from "@workspace/db/schema";
import { logger } from "./logger";

const GREETS = ["Hi", "Hello", "Dear", "Greetings"];
const CLOSINGS = ["Thank you", "Appreciated", "Warm regards", "Best regards"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

export interface ReminderInput {
  school: School;
  invoice: Invoice;
  daysUntilDue: number;
  channel: "email" | "sms" | "whatsapp";
}

export interface ReminderOutput {
  subject: string;
  body: string;
  tone: "friendly" | "firm" | "final";
}

function toneFor(daysUntilDue: number): "friendly" | "firm" | "final" {
  if (daysUntilDue > 0) return "friendly";
  if (daysUntilDue >= -7) return "firm";
  return "final";
}

function templateReminder(input: ReminderInput): ReminderOutput {
  const { school, invoice, daysUntilDue, channel } = input;
  const owner =
    school.ownerName?.trim() ||
    school.principalName?.trim() ||
    `${school.name} team`;
  const amount = `${invoice.currency} ${invoice.total.toLocaleString()}`;
  const due = new Date(invoice.dueDate).toLocaleDateString();
  const tone = toneFor(daysUntilDue);
  const subjectPrefix =
    tone === "final" ? "FINAL NOTICE" : tone === "firm" ? "Action required" : "Reminder";
  const subject = `Legacy Sports invoice ${invoice.invoiceNumber} — ${subjectPrefix}`;

  if (channel !== "email") {
    const short =
      tone === "final"
        ? `[FINAL NOTICE] Invoice ${invoice.invoiceNumber} (${amount}) is ${Math.abs(daysUntilDue)} days overdue. Service will be suspended within 48 hours unless paid.`
        : tone === "firm"
          ? `Invoice ${invoice.invoiceNumber} (${amount}) was due ${due} and is now ${Math.abs(daysUntilDue)} day(s) past due. Please settle to avoid interruption.`
          : `Reminder: invoice ${invoice.invoiceNumber} (${amount}) is due on ${due} (${daysUntilDue} day(s) away).`;
    return { subject, body: short, tone };
  }

  let intro: string;
  if (tone === "friendly") {
    intro = `${pick(GREETS)} ${owner},\n\nThis is a friendly reminder that invoice ${invoice.invoiceNumber} for ${amount} is scheduled for payment on ${due} — that's ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"} from today.`;
  } else if (tone === "firm") {
    intro = `${pick(GREETS)} ${owner},\n\nOur records show that invoice ${invoice.invoiceNumber} for ${amount} was due on ${due} and is now ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? "" : "s"} past due. Please settle it at your earliest convenience to avoid any interruption in service.`;
  } else {
    intro = `${pick(GREETS)} ${owner},\n\nFINAL NOTICE: invoice ${invoice.invoiceNumber} for ${amount} is now ${Math.abs(daysUntilDue)} days overdue. Per our terms, your Legacy Sports access will be suspended automatically within 48 hours if payment is not received.`;
  }
  const cta = `You can review and settle this invoice from your school's billing dashboard inside Legacy Sports at any time.`;
  const close = `${pick(CLOSINGS)},\nLegacy Sports Billing`;
  return { subject, body: `${intro}\n\n${cta}\n\n${close}`, tone };
}

async function aiReminder(input: ReminderInput): Promise<ReminderOutput | null> {
  const baseUrl = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseUrl || !apiKey) return null;
  const { school, invoice, daysUntilDue, channel } = input;
  const tone = toneFor(daysUntilDue);
  const owner =
    school.ownerName?.trim() ||
    school.principalName?.trim() ||
    `${school.name} team`;
  const amount = `${invoice.currency} ${invoice.total.toLocaleString()}`;
  const due = new Date(invoice.dueDate).toLocaleDateString();
  const lengthHint =
    channel === "email"
      ? "Write a 4-7 sentence professional email body."
      : "Write a single short line under 280 characters, no greetings or closings.";
  const toneHint =
    tone === "friendly"
      ? "Warm, polite, low-pressure."
      : tone === "firm"
        ? "Polite but unambiguous; convey urgency without being aggressive."
        : "Direct and serious. Make clear that automatic suspension is imminent; stay professional and respectful.";
  const prompt = `You are the billing assistant for "Legacy Sports", a SaaS for sports academies. Write a payment-reminder message for the school owner.\n\nContext:\n- Recipient name: ${owner}\n- School: ${school.name}\n- Invoice number: ${invoice.invoiceNumber}\n- Amount: ${amount}\n- Due date: ${due}\n- Days until due: ${daysUntilDue} (negative means past due)\n- Tone: ${tone}\n- Channel: ${channel}\n\nGuidelines:\n- ${lengthHint}\n- ${toneHint}\n- Reference the invoice number and amount.\n- ${channel === "email" ? "Sign off as 'Legacy Sports Billing'." : "No signature."}\n- Plain text only, no markdown.\n\nReturn STRICT JSON: {"subject": string, "body": string}. For non-email channels, set subject to an empty string.`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You write concise billing reminder messages and return strict JSON." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 600,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      logger.warn({ status: res.status }, "AI reminder generation failed, falling back to template");
      return null;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as { subject?: string; body?: string };
    if (!parsed.body) return null;
    const fallbackSubject = `Legacy Sports invoice ${invoice.invoiceNumber} — ${tone === "final" ? "FINAL NOTICE" : tone === "firm" ? "Action required" : "Reminder"}`;
    const subject = channel === "email" ? (parsed.subject?.trim() || fallbackSubject) : fallbackSubject;
    return { subject, body: parsed.body.trim(), tone };
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err }, "AI reminder error, falling back to template");
    return null;
  }
}

/**
 * AI-powered reminder generator. Uses the Replit-managed OpenAI proxy when
 * AI_INTEGRATIONS_OPENAI_* env vars are present; otherwise falls back to
 * a deterministic template. Either way the public shape is the same.
 *
 * NOTE: callers (auto-reminder scheduler + manual /remind route) already
 * await this, so the LLM call is non-blocking for end-users.
 */
export async function generateReminderAsync(
  input: ReminderInput,
): Promise<ReminderOutput> {
  const ai = await aiReminder(input);
  return ai ?? templateReminder(input);
}

// Kept for backward compatibility — sync template only.
export function generateReminder(input: ReminderInput): ReminderOutput {
  return templateReminder(input);
}
