import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../lib/db";
import { performancesTable, usersTable } from "@workspace/db/schema";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

// GET /api/performances
router.get("/performances", requireAuth, async (req, res) => {
  const { playerId, coachId } = req.query as Record<string, string>;
  const session = req.auth!;

  const conditions = [];

  if (session.role === "player") {
    conditions.push(eq(performancesTable.playerId, session.userId!));
  } else if (session.role === "coach") {
    if (coachId) {
      conditions.push(eq(performancesTable.coachId, parseInt(coachId)));
    } else {
      conditions.push(eq(performancesTable.coachId, session.userId!));
    }
    if (playerId) conditions.push(eq(performancesTable.playerId, parseInt(playerId)));
  } else if (session.role !== "superadmin" && session.schoolId) {
    // school_admin, sub_admin — restrict to their own school's players via join
    if (playerId) conditions.push(eq(performancesTable.playerId, parseInt(playerId)));
    if (coachId) conditions.push(eq(performancesTable.coachId, parseInt(coachId)));

    const performances = await db
      .select({
        id: performancesTable.id,
        playerId: performancesTable.playerId,
        coachId: performancesTable.coachId,
        sport: performancesTable.sport,
        sessionType: performancesTable.sessionType,
        sessionNotes: performancesTable.sessionNotes,
        customData: performancesTable.customData,
        recordedAt: performancesTable.recordedAt,
      })
      .from(performancesTable)
      .innerJoin(usersTable, eq(performancesTable.playerId, usersTable.id))
      .where(
        and(
          eq(usersTable.schoolId, session.schoolId),
          conditions.length ? and(...conditions) : undefined,
        ),
      )
      .orderBy(performancesTable.recordedAt);

    res.json(performances);
    return;
  } else {
    // superadmin — optional filters only
    if (playerId) conditions.push(eq(performancesTable.playerId, parseInt(playerId)));
    if (coachId) conditions.push(eq(performancesTable.coachId, parseInt(coachId)));
  }

  const performances = await db
    .select()
    .from(performancesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(performancesTable.recordedAt);

  res.json(performances);
});

// POST /api/performances
router.post("/performances", requireRole("coach", "school_admin", "superadmin"), async (req, res) => {
  const session = req.auth!;
  const body = req.body as {
    playerId: number;
    sport: string;
    sessionType?: string;
    sessionNotes?: string;
    customData?: Record<string, string | number>;
    recordedAt?: string;
  };

  if (!body.playerId || !body.sport) {
    res.status(400).json({ error: "playerId and sport are required" });
    return;
  }

  // Enforce school isolation: non-superadmins can only record for their own school's players
  if (session.role !== "superadmin" && session.schoolId) {
    const player = await db
      .select({ schoolId: usersTable.schoolId })
      .from(usersTable)
      .where(eq(usersTable.id, body.playerId))
      .limit(1);
    if (!player.length) {
      res.status(404).json({ error: "Player not found" });
      return;
    }
    if (player[0]!.schoolId !== session.schoolId) {
      res.status(403).json({ error: "Cannot record performance for a player in another school" });
      return;
    }
  }

  const [perf] = await db
    .insert(performancesTable)
    .values({
      playerId: body.playerId,
      coachId: session.role === "coach" ? session.userId! : null,
      sport: body.sport,
      sessionType: body.sessionType ?? "Training",
      sessionNotes: body.sessionNotes ?? "",
      customData: body.customData ?? {},
      recordedAt: body.recordedAt ? new Date(body.recordedAt) : new Date(),
    })
    .returning();

  res.status(201).json(perf);
});

// DELETE /api/performances/:id
router.delete("/performances/:id", requireRole("coach", "school_admin", "superadmin"), async (req, res) => {
  const id = parseInt(String(req.params["id"]));
  const session = req.auth!;

  // Non-superadmins can only delete performances of their own school's players
  if (session.role !== "superadmin" && session.schoolId) {
    const perf = await db
      .select({ playerId: performancesTable.playerId })
      .from(performancesTable)
      .where(eq(performancesTable.id, id))
      .limit(1);
    if (perf.length) {
      const player = await db
        .select({ schoolId: usersTable.schoolId })
        .from(usersTable)
        .where(eq(usersTable.id, perf[0]!.playerId))
        .limit(1);
      if (player.length && player[0]!.schoolId !== session.schoolId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
    }
  }

  await db.delete(performancesTable).where(eq(performancesTable.id, id));
  res.json({ message: "Performance record deleted" });
});

export default router;
