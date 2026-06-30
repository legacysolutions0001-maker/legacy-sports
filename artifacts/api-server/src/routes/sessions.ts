import { Router, type IRouter } from "express";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "../lib/db";
import { sessionsTable } from "@workspace/db/schema";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

// GET /api/sessions?schoolId=&from=&to=
router.get("/sessions", requireAuth, async (req, res) => {
  const session = req.auth!;
  const schoolIdRaw = req.query["schoolId"];
  const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
  const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

  const targetSchoolId =
    session.role === "superadmin" && schoolIdRaw
      ? parseInt(String(schoolIdRaw))
      : session.schoolId;

  if (!targetSchoolId) {
    res.json([]);
    return;
  }

  const conditions = [eq(sessionsTable.schoolId, targetSchoolId)];
  if (from) conditions.push(gte(sessionsTable.startsAt, from));
  if (to) conditions.push(lte(sessionsTable.startsAt, to));

  const rows = await db
    .select()
    .from(sessionsTable)
    .where(and(...conditions))
    .orderBy(sessionsTable.startsAt);
  res.json(rows);
});

// POST /api/sessions
router.post(
  "/sessions",
  requireRole("superadmin", "school_admin", "sub_admin", "coach"),
  async (req, res) => {
    const session = req.auth!;
    const body = req.body as {
      title?: string;
      sport?: string;
      description?: string;
      location?: string;
      startsAt?: string;
      endsAt?: string;
      schoolId?: number;
      coachId?: number;
    };
    if (!body.title?.trim() || !body.startsAt || !body.endsAt) {
      res.status(400).json({ error: "title, startsAt, endsAt are required" });
      return;
    }
    const schoolId =
      session.role === "superadmin" && body.schoolId
        ? body.schoolId
        : (session.schoolId ?? 0);
    if (!schoolId) {
      res.status(400).json({ error: "schoolId required" });
      return;
    }
    const [created] = await db
      .insert(sessionsTable)
      .values({
        schoolId,
        coachId: body.coachId ?? session.userId!,
        title: body.title.trim(),
        sport: body.sport ?? "",
        description: body.description ?? "",
        location: body.location ?? "",
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
      })
      .returning();
    res.status(201).json(created);
  },
);

// PATCH /api/sessions/:id
router.patch(
  "/sessions/:id",
  requireRole("superadmin", "school_admin", "sub_admin", "coach"),
  async (req, res) => {
    const session = req.auth!;
    const id = parseInt(String(req.params["id"]));
    const existing = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, id))
      .limit(1);
    if (!existing.length) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    if (
      session.role !== "superadmin" &&
      existing[0]!.schoolId !== session.schoolId
    ) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of [
      "title",
      "sport",
      "description",
      "location",
      "coachId",
    ] as const) {
      if (k in body) patch[k] = body[k];
    }
    if (body["startsAt"]) patch["startsAt"] = new Date(String(body["startsAt"]));
    if (body["endsAt"]) patch["endsAt"] = new Date(String(body["endsAt"]));
    const [updated] = await db
      .update(sessionsTable)
      .set(patch)
      .where(eq(sessionsTable.id, id))
      .returning();
    res.json(updated);
  },
);

// DELETE /api/sessions/:id
router.delete(
  "/sessions/:id",
  requireRole("superadmin", "school_admin", "sub_admin", "coach"),
  async (req, res) => {
    const session = req.auth!;
    const id = parseInt(String(req.params["id"]));
    const existing = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, id))
      .limit(1);
    if (!existing.length) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    if (
      session.role !== "superadmin" &&
      existing[0]!.schoolId !== session.schoolId
    ) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    await db.delete(sessionsTable).where(eq(sessionsTable.id, id));
    res.json({ message: "Session deleted" });
  },
);

export default router;
