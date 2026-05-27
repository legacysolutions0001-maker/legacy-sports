import { logger } from "./logger";

export type LetterType =
  | "notice"
  | "warning"
  | "congratulatory"
  | "recommendation"
  | "custom";

export interface LetterGenInput {
  type: LetterType;
  prompt: string;
  recipient: string;
  schoolName: string;
  senderName: string;
  senderDesignation: string;
}

export interface LetterGenOutput {
  subject: string;
  body: string;
}

export type CertificateTemplate =
  | "participation"
  | "achievement"
  | "sport-specific";

export interface CertificateGenInput {
  template: CertificateTemplate;
  playerName: string;
  sport: string;
  eventName: string;
  score: string;
  schoolName: string;
}

export interface CertificateGenOutput {
  citation: string;
}

function typeBlurb(t: LetterType): string {
  switch (t) {
    case "notice":
      return "an official notice (informational, neutral tone, 3-5 paragraphs)";
    case "warning":
      return "a formal warning letter (firm, respectful, references the issue, states expected corrective action)";
    case "congratulatory":
      return "a warm congratulatory letter celebrating the recipient's achievement";
    case "recommendation":
      return "a glowing recommendation / character letter highlighting the recipient's strengths";
    case "custom":
    default:
      return "a professionally-worded letter as described by the prompt";
  }
}

function templateLetter(input: LetterGenInput): LetterGenOutput {
  const { type, prompt, recipient, schoolName, senderName, senderDesignation } = input;
  const subjectMap: Record<LetterType, string> = {
    notice: "Official Notice",
    warning: "Formal Warning",
    congratulatory: "Congratulations",
    recommendation: "Letter of Recommendation",
    custom: prompt ? prompt.slice(0, 60) : "Letter from " + schoolName,
  };
  const greeting = recipient ? `Dear ${recipient},` : "To whom it may concern,";
  const body = `${greeting}

${prompt || "Please consider the following matter on behalf of " + schoolName + "."}

This letter is issued in our capacity as ${senderDesignation || "representatives"} of ${schoolName}. Please do not hesitate to contact us should you require any clarification regarding the contents of this letter.

Sincerely,
${senderName}
${senderDesignation}
${schoolName}`;
  return { subject: subjectMap[type], body };
}

async function aiLetter(input: LetterGenInput): Promise<LetterGenOutput | null> {
  const baseUrl = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseUrl || !apiKey) return null;
  const { type, prompt, recipient, schoolName, senderName, senderDesignation } = input;
  const sys =
    "You are a professional administrative assistant who writes polished, contextually appropriate letters on behalf of sports academy staff. Return strict JSON.";
  const user = `Draft ${typeBlurb(type)} on behalf of "${schoolName}".

Recipient: ${recipient || "(unspecified — use a generic salutation)"}
Sender name: ${senderName}
Sender designation: ${senderDesignation}
Specific instructions from the sender: ${prompt || "(none — infer reasonable content from the letter type)"}

Guidelines:
- Plain text, no markdown.
- 3-6 short paragraphs.
- Open with an appropriate salutation. Close with "Sincerely," then the sender's name, designation, and school on separate lines.
- Do not invent specific dates, amounts, names, or events that were not provided.
- Tone must match the letter type.

Return strict JSON: {"subject": string, "body": string}.`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 1200,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      logger.warn({ status: res.status }, "AI letter generation failed");
      return null;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as { subject?: string; body?: string };
    if (!parsed.body) return null;
    return {
      subject: (parsed.subject || "").trim() || "Letter from " + schoolName,
      body: parsed.body.trim(),
    };
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : err },
      "AI letter error",
    );
    return null;
  }
}

export async function generateLetter(
  input: LetterGenInput,
): Promise<LetterGenOutput> {
  const ai = await aiLetter(input);
  return ai ?? templateLetter(input);
}

function templateCitation(input: CertificateGenInput): CertificateGenOutput {
  const { template, playerName, sport, eventName, score, schoolName } = input;
  const subject = sport || "the program";
  if (template === "achievement") {
    return {
      citation: `This certificate is proudly awarded to ${playerName} in recognition of an outstanding achievement${eventName ? ` at ${eventName}` : ""}${score ? ` (${score})` : ""}. Your dedication, discipline, and excellence in ${subject} bring great pride to ${schoolName}. Keep raising the bar.`,
    };
  }
  if (template === "sport-specific") {
    return {
      citation: `Presented to ${playerName} for exemplary performance and commitment in ${subject}${eventName ? ` during ${eventName}` : ""}${score ? ` — ${score}` : ""}. ${schoolName} celebrates your skill, sportsmanship, and continued growth as an athlete.`,
    };
  }
  return {
    citation: `This certificate is awarded to ${playerName} for active participation${eventName ? ` in ${eventName}` : ""}${sport ? ` (${sport})` : ""} organised by ${schoolName}. We appreciate your enthusiasm, teamwork, and sporting spirit.`,
  };
}

async function aiCitation(
  input: CertificateGenInput,
): Promise<CertificateGenOutput | null> {
  const baseUrl = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseUrl || !apiKey) return null;
  const { template, playerName, sport, eventName, score, schoolName } = input;
  const sys =
    "You write short, elegant certificate citations for a sports academy. Return strict JSON.";
  const user = `Write a single-paragraph certificate citation (60-90 words, no markdown) for the following:

Template: ${template}
Recipient: ${playerName}
Sport: ${sport || "(unspecified)"}
Event: ${eventName || "(unspecified)"}
Result / score: ${score || "(unspecified)"}
Awarding institution: ${schoolName}

Guidelines:
- Warm, dignified, formal tone.
- Do not invent specific dates, places, or rankings that were not provided.
- Begin with "This certificate is awarded to..." or "Presented to...".
- End with a forward-looking sentence.

Return strict JSON: {"citation": string}.`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 600,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      logger.warn({ status: res.status }, "AI citation generation failed");
      return null;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as { citation?: string };
    if (!parsed.citation) return null;
    return { citation: parsed.citation.trim() };
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : err },
      "AI citation error",
    );
    return null;
  }
}

export async function generateCitation(
  input: CertificateGenInput,
): Promise<CertificateGenOutput> {
  const ai = await aiCitation(input);
  return ai ?? templateCitation(input);
}
