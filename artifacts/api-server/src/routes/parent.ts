import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, desc, gte } from "drizzle-orm";
import { db } from "../lib/db";
import {
  usersTable,
  schoolsTable,
  attendanceTable,
  performancesTable,
  feesTable,
  sessionsTable,
  notificationsTable,
  parentPlayerLinksTable,
} from "@workspace/db/schema";

const router: IRouter = Router();

// ── Middleware ─────────────────────────────────────────────────────────────
function requireParentAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId || req.session.role !== "parent") {
    res.status(401).json({ error: "Not authenticated as parent" });
    return;
  }
  next();
}

// ── Helper: get linked player ID for this parent ──────────────────────────
async function getLinkedPlayerId(parentUserId: number): Promise<number | null> {
  const link = await db
    .select({ playerId: parentPlayerLinksTable.playerId })
    .from(parentPlayerLinksTable)
    .where(eq(parentPlayerLinksTable.parentId, parentUserId))
    .limit(1);
  return link[0]?.playerId ?? null;
}

// ── GET /api/parent/me ─────────────────────────────────────────────────────
router.get("/parent/me", requireParentAuth, async (req, res) => {
  const parentId = req.session.userId!;

  const parent = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      phone: usersTable.phone,
      schoolId: usersTable.schoolId,
    })
    .from(usersTable)
    .where(eq(usersTable.id, parentId))
    .limit(1);

  if (!parent.length) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Session invalid" });
    return;
  }

  const p = parent[0]!;
  const playerId = await getLinkedPlayerId(parentId);

  let player = null;
  if (playerId) {
    const rows = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        sport: usersTable.sport,
        playerCode: usersTable.playerCode,
        className: usersTable.className,
        section: usersTable.section,
        status: usersTable.status,
        fitnessStatus: usersTable.fitnessStatus,
        photoUrl: usersTable.photoUrl,
      })
      .from(usersTable)
      .where(eq(usersTable.id, playerId))
      .limit(1);
    if (rows.length) player = rows[0]!;
  }

  let school = null;
  if (p.schoolId) {
    const rows = await db
      .select({
        id: schoolsTable.id,
        name: schoolsTable.name,
        code: schoolsTable.code,
        logoUrl: schoolsTable.logoUrl,
        primaryColor: schoolsTable.primaryColor,
        isDemo: schoolsTable.isDemo,
        demoMessage: schoolsTable.demoMessage,
      })
      .from(schoolsTable)
      .where(eq(schoolsTable.id, p.schoolId))
      .limit(1);
    if (rows.length) school = rows[0]!;
  }

  res.json({
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    schoolId: p.schoolId,
    role: "parent",
    player,
    school,
  });
});

// ── GET /api/parent/child ──────────────────────────────────────────────────
router.get("/parent/child", requireParentAuth, async (req, res) => {
  const parentId = req.session.userId!;
  const playerId = await getLinkedPlayerId(parentId);

  if (!playerId) {
    res.json(null);
    return;
  }

  const rows = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      sport: usersTable.sport,
      playerCode: usersTable.playerCode,
      admissionNumber: usersTable.admissionNumber,
      age: usersTable.age,
      gender: usersTable.gender,
      className: usersTable.className,
      section: usersTable.section,
      rollNumber: usersTable.rollNumber,
      status: usersTable.status,
      fitnessStatus: usersTable.fitnessStatus,
      photoUrl: usersTable.photoUrl,
      parentName: usersTable.parentName,
      parentPhone: usersTable.parentPhone,
      email: usersTable.email,
      phone: usersTable.phone,
    })
    .from(usersTable)
    .where(eq(usersTable.id, playerId))
    .limit(1);

  res.json(rows[0] ?? null);
});

// ── GET /api/parent/attendance ─────────────────────────────────────────────
router.get("/parent/attendance", requireParentAuth, async (req, res) => {
  const parentId = req.session.userId!;
  const playerId = await getLinkedPlayerId(parentId);

  if (!playerId) {
    res.json({ records: [], summary: { total: 0, present: 0, absent: 0, late: 0, rate: 0 } });
    return;
  }

  const lim = Math.min(parseInt(String(req.query["limit"] ?? "30")) || 30, 90);
  const records = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.userId, playerId))
    .orderBy(desc(attendanceTable.attDate))
    .limit(lim);

  const total = records.length;
  const present = records.filter((r) => r.status === "present").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const late = records.filter((r) => r.status === "late").length;

  res.json({
    records,
    summary: { total, present, absent, late, rate: total ? Math.round((present / total) * 100) : 0 },
  });
});

// ── GET /api/parent/performances ──────────────────────────────────────────
router.get("/parent/performances", requireParentAuth, async (req, res) => {
  const parentId = req.session.userId!;
  const playerId = await getLinkedPlayerId(parentId);

  if (!playerId) { res.json([]); return; }

  const lim = Math.min(parseInt(String(req.query["limit"] ?? "20")) || 20, 50);
  const records = await db
    .select()
    .from(performancesTable)
    .where(eq(performancesTable.playerId, playerId))
    .orderBy(desc(performancesTable.recordedAt))
    .limit(lim);

  res.json(records);
});

// ── GET /api/parent/fees ───────────────────────────────────────────────────
router.get("/parent/fees", requireParentAuth, async (req, res) => {
  const parentId = req.session.userId!;
  const playerId = await getLinkedPlayerId(parentId);

  if (!playerId) { res.json({ records: [], summary: { totalDue: 0, totalPaid: 0 } }); return; }

  const records = await db
    .select()
    .from(feesTable)
    .where(eq(feesTable.playerId, playerId))
    .orderBy(desc(feesTable.createdAt))
    .limit(50);

  const totalDue = records.filter((f) => f.status === "pending" || f.status === "overdue").reduce((s, f) => s + f.amount, 0);
  const totalPaid = records.filter((f) => f.status === "paid").reduce((s, f) => s + f.amount, 0);

  res.json({ records, summary: { totalDue, totalPaid } });
});

// ── GET /api/parent/sessions ───────────────────────────────────────────────
router.get("/parent/sessions", requireParentAuth, async (req, res) => {
  const schoolId = req.session.schoolId;
  if (!schoolId) { res.json([]); return; }

  const now = new Date();
  const upcoming = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.schoolId, schoolId), gte(sessionsTable.startsAt, now)))
    .orderBy(sessionsTable.startsAt)
    .limit(10);

  res.json(upcoming);
});

// ── GET /api/parent/notifications ─────────────────────────────────────────
router.get("/parent/notifications", requireParentAuth, async (req, res) => {
  const parentId = req.session.userId!;
  const playerId = await getLinkedPlayerId(parentId);

  const receiverId = playerId ?? parentId;
  const notes = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.receiverId, receiverId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(20);

  res.json(notes);
});

export default router;
