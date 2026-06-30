import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { schoolSettingsTable } from "@workspace/db/schema";
import { recomputePendingInvoice } from "../lib/billing";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

const ALLOWED_KEYS = [
  "enabledSports",
  "attendanceEnabled",
  "registrationEnabled",
  "performanceEnabled",
  "analyticsEnabled",
  "leaderboardEnabled",
  "notificationsEnabled",
  "calendarEnabled",
  "messagingEnabled",
  "photosEnabled",
  "feesEnabled",
  "aiEnabled",
  "websiteEnabled",
  "customMessage",
] as const;

async function getOrCreate(schoolId: number) {
  const rows = await db
    .select()
    .from(schoolSettingsTable)
    .where(eq(schoolSettingsTable.schoolId, schoolId))
    .limit(1);
  if (rows.length) return rows[0]!;
  const [created] = await db
    .insert(schoolSettingsTable)
    .values({ schoolId })
    .returning();
  return created!;
}

function canRead(sessionRole: string | undefined, sessionSchoolId: number | null | undefined, targetSchoolId: number) {
  if (sessionRole === "superadmin") return true;
  return sessionSchoolId === targetSchoolId;
}

function canWrite(sessionRole: string | undefined, sessionSchoolId: number | null | undefined, targetSchoolId: number) {
  if (sessionRole === "superadmin") return true;
  if (sessionRole !== "school_admin" && sessionRole !== "sub_admin") return false;
  return sessionSchoolId === targetSchoolId;
}

// GET /api/school-settings — for the caller's own school
router.get("/school-settings", requireAuth, async (req, res) => {
  const s = req.auth!;
  if (s.role === "superadmin") {
    res.json({ schoolId: 0, ...defaultFlags() });
    return;
  }
  if (!s.schoolId) {
    res.status(400).json({ error: "No school context" });
    return;
  }
  res.json(await getOrCreate(s.schoolId));
});

// PATCH /api/school-settings — update caller's own school
router.patch("/school-settings", requireRole("school_admin", "sub_admin", "superadmin"), async (req, res) => {
  const s = req.auth!;
  const targetId = s.role === "superadmin"
    ? Number((req.body as Record<string, unknown>)?.["schoolId"]) || 0
    : s.schoolId!;
  if (!targetId) {
    res.status(400).json({ error: "schoolId required" });
    return;
  }
  if (!canWrite(s.role, s.schoolId, targetId)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  await getOrCreate(targetId);
  const body = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of ALLOWED_KEYS) if (k in body) patch[k] = body[k];
  const [updated] = await db
    .update(schoolSettingsTable)
    .set(patch)
    .where(eq(schoolSettingsTable.schoolId, targetId))
    .returning();
  recomputePendingInvoice(targetId).catch(() => {});
  res.json(updated);
});

// GET /api/schools/:id/settings — superadmin or same-school user
router.get("/schools/:id/settings", requireAuth, async (req, res) => {
  const s = req.auth!;
  const id = parseInt(String(req.params["id"]));
  if (!canRead(s.role, s.schoolId, id)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  res.json(await getOrCreate(id));
});

// PATCH /api/schools/:id/settings — superadmin or school admin of THAT school
router.patch("/schools/:id/settings", requireRole("superadmin", "school_admin", "sub_admin"), async (req, res) => {
  const s = req.auth!;
  const id = parseInt(String(req.params["id"]));
  if (!canWrite(s.role, s.schoolId, id)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  await getOrCreate(id);
  const body = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of ALLOWED_KEYS) if (k in body) patch[k] = body[k];
  const [updated] = await db
    .update(schoolSettingsTable)
    .set(patch)
    .where(eq(schoolSettingsTable.schoolId, id))
    .returning();
  recomputePendingInvoice(id).catch(() => {});
  res.json(updated);
});

function defaultFlags() {
  return {
    attendanceEnabled: true,
    registrationEnabled: true,
    performanceEnabled: true,
    analyticsEnabled: true,
    leaderboardEnabled: true,
    notificationsEnabled: true,
    calendarEnabled: true,
    messagingEnabled: true,
    photosEnabled: true,
    feesEnabled: true,
    customMessage: null as string | null,
  };
}

export default router;
