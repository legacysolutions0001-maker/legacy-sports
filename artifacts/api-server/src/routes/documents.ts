import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../lib/db";
import {
  lettersTable,
  certificatesTable,
  usersTable,
  schoolsTable,
} from "@workspace/db/schema";
import { requireAuth, requireRole } from "../middlewares/requireAuth";
import { generateLetter, generateCitation, type LetterType, type CertificateTemplate } from "../lib/aiDocs";
import { renderLetterPdf, renderCertificatePdf } from "../lib/pdfDocs";

const router: IRouter = Router();

const STAFF_ROLES = ["superadmin", "school_admin", "sub_admin", "coach"];
const LETTER_TYPES: LetterType[] = [
  "notice",
  "warning",
  "congratulatory",
  "recommendation",
  "custom",
];
const TEMPLATES: CertificateTemplate[] = [
  "participation",
  "achievement",
  "sport-specific",
];

async function loadSender(userId: number) {
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

async function loadSchool(schoolId: number | null | undefined) {
  if (!schoolId) return null;
  const rows = await db
    .select()
    .from(schoolsTable)
    .where(eq(schoolsTable.id, schoolId))
    .limit(1);
  return rows[0] ?? null;
}

function schoolSnapshot(s: Awaited<ReturnType<typeof loadSchool>>) {
  if (!s) return null;
  return {
    id: s.id,
    name: s.name,
    logoUrl: s.logoUrl ?? "",
    address: s.address ?? "",
    phone: s.phone ?? "",
    email: s.email ?? "",
    primaryColor: s.primaryColor ?? "#1a3a5c",
  };
}

async function attachSchools<T extends { schoolId: number | null }>(rows: T[]) {
  const ids = Array.from(
    new Set(rows.map((r) => r.schoolId).filter((x): x is number => !!x)),
  );
  if (!ids.length) return rows.map((r) => ({ ...r, school: null }));
  const schools = await db.select().from(schoolsTable);
  const byId = new Map(schools.map((s) => [s.id, schoolSnapshot(s)]));
  return rows.map((r) => ({
    ...r,
    school: r.schoolId ? (byId.get(r.schoolId) ?? null) : null,
  }));
}

// ─── LETTERS ───────────────────────────────────────────────────────────────

router.get(
  "/letters",
  requireRole(...STAFF_ROLES),
  async (req, res) => {
    const session = req.auth!;
    const conditions = [];
    if (session.role !== "superadmin") {
      if (!session.schoolId) {
        res.json([]);
        return;
      }
      conditions.push(eq(lettersTable.schoolId, session.schoolId));
    } else if (req.query["schoolId"]) {
      conditions.push(eq(lettersTable.schoolId, parseInt(String(req.query["schoolId"]))));
    }
    const q = conditions.length
      ? db.select().from(lettersTable).where(and(...conditions))
      : db.select().from(lettersTable);
    const rows = await q.orderBy(desc(lettersTable.createdAt)).limit(200);
    res.json(await attachSchools(rows));
  },
);

router.post(
  "/letters/generate",
  requireRole(...STAFF_ROLES),
  async (req, res) => {
    const session = req.auth!;
    const body = req.body as {
      type?: string;
      prompt?: string;
      recipient?: string;
      schoolId?: number;
    };
    const type = (LETTER_TYPES as string[]).includes(body.type ?? "")
      ? (body.type as LetterType)
      : "custom";
    const recipient = (body.recipient ?? "").trim();
    const prompt = (body.prompt ?? "").trim();
    if (!prompt && type === "custom") {
      res.status(400).json({ error: "Prompt is required for custom letters" });
      return;
    }
    const sender = await loadSender(session.userId!);
    if (!sender) {
      res.status(401).json({ error: "Sender not found" });
      return;
    }
    const schoolId =
      session.role === "superadmin"
        ? (body.schoolId ?? sender.schoolId ?? null)
        : (sender.schoolId ?? null);
    const school = await loadSchool(schoolId);
    const schoolName = school?.name ?? "Legacy Sports";
    const senderDesignation =
      sender.designation?.trim() ||
      (sender.role === "superadmin"
        ? "Platform Administrator"
        : sender.role === "school_admin"
          ? "School Administrator"
          : sender.role === "sub_admin"
            ? "Assistant Administrator"
            : sender.role === "coach"
              ? "Head Coach"
              : "Staff");

    const out = await generateLetter({
      type,
      prompt,
      recipient,
      schoolName,
      senderName: sender.name,
      senderDesignation,
    });

    const [created] = await db
      .insert(lettersTable)
      .values({
        schoolId,
        authorId: sender.id,
        letterType: type,
        prompt,
        recipient,
        subject: out.subject,
        body: out.body,
        senderName: sender.name,
        senderDesignation,
      })
      .returning();
    res.status(201).json({ ...created!, school: schoolSnapshot(school) });
  },
);

router.delete(
  "/letters/:id",
  requireRole(...STAFF_ROLES),
  async (req, res) => {
    const session = req.auth!;
    const id = parseInt(String(req.params["id"]));
    const existing = await db
      .select()
      .from(lettersTable)
      .where(eq(lettersTable.id, id))
      .limit(1);
    if (!existing.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (
      session.role !== "superadmin" &&
      existing[0]!.schoolId !== session.schoolId
    ) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    await db.delete(lettersTable).where(eq(lettersTable.id, id));
    res.json({ message: "Deleted" });
  },
);

router.get(
  "/letters/:id/pdf",
  requireRole(...STAFF_ROLES),
  async (req, res) => {
    const session = req.auth!;
    const id = parseInt(String(req.params["id"]));
    const rows = await db
      .select()
      .from(lettersTable)
      .where(eq(lettersTable.id, id))
      .limit(1);
    if (!rows.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const letter = rows[0]!;
    if (session.role !== "superadmin" && letter.schoolId !== session.schoolId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const school = await loadSchool(letter.schoolId);
    const pdf = await renderLetterPdf(letter, school);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="letter-${letter.id}.pdf"`,
    );
    res.send(Buffer.from(pdf));
  },
);

// ─── CERTIFICATES ──────────────────────────────────────────────────────────

router.get(
  "/certificates",
  requireRole(...STAFF_ROLES),
  async (req, res) => {
    const session = req.auth!;
    const conditions = [];
    if (session.role !== "superadmin") {
      if (!session.schoolId) {
        res.json([]);
        return;
      }
      conditions.push(eq(certificatesTable.schoolId, session.schoolId));
    } else if (req.query["schoolId"]) {
      conditions.push(
        eq(certificatesTable.schoolId, parseInt(String(req.query["schoolId"]))),
      );
    }
    if (session.role === "coach") {
      const sender = await loadSender(session.userId!);
      const coachSport = (sender?.sport ?? "").trim();
      if (!coachSport) {
        res.json([]);
        return;
      }
      conditions.push(eq(certificatesTable.sport, coachSport));
    }
    const q = conditions.length
      ? db.select().from(certificatesTable).where(and(...conditions))
      : db.select().from(certificatesTable);
    const rows = await q.orderBy(desc(certificatesTable.createdAt)).limit(200);
    res.json(await attachSchools(rows));
  },
);

router.post(
  "/certificates/generate",
  requireRole(...STAFF_ROLES),
  async (req, res) => {
    const session = req.auth!;
    const body = req.body as {
      playerId?: number;
      template?: string;
      eventName?: string;
      score?: string;
    };
    if (!body.playerId) {
      res.status(400).json({ error: "playerId is required" });
      return;
    }
    const template = (TEMPLATES as string[]).includes(body.template ?? "")
      ? (body.template as CertificateTemplate)
      : "participation";

    const sender = await loadSender(session.userId!);
    if (!sender) {
      res.status(401).json({ error: "Sender not found" });
      return;
    }

    const playerRows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, body.playerId))
      .limit(1);
    const player = playerRows[0];
    if (!player || player.role !== "player") {
      res.status(404).json({ error: "Player not found" });
      return;
    }

    // Access control
    if (session.role !== "superadmin" && player.schoolId !== session.schoolId) {
      res.status(403).json({ error: "Player not in your school" });
      return;
    }
    // Coaches restricted to their own sport (strict: deny if coach has no sport)
    if (session.role === "coach") {
      const coachSport = (sender.sport ?? "").trim();
      const playerSport = (player.sport ?? "").trim();
      if (!coachSport || coachSport !== playerSport) {
        res.status(403).json({
          error: "Coaches can only issue certificates for players in their own sport",
        });
        return;
      }
    }

    const school = await loadSchool(player.schoolId);
    const schoolName = school?.name ?? "Legacy Sports";

    const out = await generateCitation({
      template,
      playerName: player.name,
      sport: player.sport ?? "",
      eventName: (body.eventName ?? "").trim(),
      score: (body.score ?? "").trim(),
      schoolName,
    });

    const signatoryDesignation =
      sender.designation?.trim() ||
      (sender.role === "coach"
        ? "Head Coach"
        : sender.role === "superadmin"
          ? "Platform Administrator"
          : "School Administrator");

    const [created] = await db
      .insert(certificatesTable)
      .values({
        schoolId: player.schoolId,
        authorId: sender.id,
        playerId: player.id,
        playerName: player.name,
        template,
        eventName: (body.eventName ?? "").trim(),
        score: (body.score ?? "").trim(),
        sport: player.sport ?? "",
        citation: out.citation,
        signatoryName: sender.name,
        signatoryDesignation,
      })
      .returning();
    res.status(201).json({ ...created!, school: schoolSnapshot(school) });
  },
);

router.delete(
  "/certificates/:id",
  requireRole(...STAFF_ROLES),
  async (req, res) => {
    const session = req.auth!;
    const id = parseInt(String(req.params["id"]));
    const existing = await db
      .select()
      .from(certificatesTable)
      .where(eq(certificatesTable.id, id))
      .limit(1);
    if (!existing.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (
      session.role !== "superadmin" &&
      existing[0]!.schoolId !== session.schoolId
    ) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    if (session.role === "coach") {
      const sender = await loadSender(session.userId!);
      const coachSport = (sender?.sport ?? "").trim();
      if (!coachSport || coachSport !== (existing[0]!.sport ?? "").trim()) {
        res.status(403).json({ error: "Coaches can only manage certificates for their own sport" });
        return;
      }
    }
    await db.delete(certificatesTable).where(eq(certificatesTable.id, id));
    res.json({ message: "Deleted" });
  },
);

router.get(
  "/certificates/:id/pdf",
  requireRole(...STAFF_ROLES),
  async (req, res) => {
    const session = req.auth!;
    const id = parseInt(String(req.params["id"]));
    const rows = await db
      .select()
      .from(certificatesTable)
      .where(eq(certificatesTable.id, id))
      .limit(1);
    if (!rows.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const cert = rows[0]!;
    if (session.role !== "superadmin" && cert.schoolId !== session.schoolId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    if (session.role === "coach") {
      const sender = await loadSender(session.userId!);
      const coachSport = (sender?.sport ?? "").trim();
      if (!coachSport || coachSport !== (cert.sport ?? "").trim()) {
        res.status(403).json({ error: "Coaches can only access certificates for their own sport" });
        return;
      }
    }
    const school = await loadSchool(cert.schoolId);
    const pdf = await renderCertificatePdf(cert, school);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="certificate-${cert.id}.pdf"`,
    );
    res.send(Buffer.from(pdf));
  },
);

export default router;
