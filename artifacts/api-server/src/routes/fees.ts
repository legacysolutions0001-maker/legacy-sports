import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { feesTable, usersTable } from "@workspace/db/schema";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

// GET /api/fees?schoolId=&playerId=
router.get("/fees", requireAuth, async (req, res) => {
  const session = req.auth!;
  const playerIdRaw = req.query["playerId"];
  const schoolIdRaw = req.query["schoolId"];

  const conditions = [];
  if (session.role === "player") {
    conditions.push(eq(feesTable.playerId, session.userId!));
    if (session.schoolId) conditions.push(eq(feesTable.schoolId, session.schoolId));
  } else if (session.role !== "superadmin") {
    conditions.push(eq(feesTable.schoolId, session.schoolId!));
  } else if (schoolIdRaw) {
    conditions.push(eq(feesTable.schoolId, parseInt(String(schoolIdRaw))));
  }
  if (playerIdRaw) {
    conditions.push(eq(feesTable.playerId, parseInt(String(playerIdRaw))));
  }

  const rows = conditions.length
    ? await db
        .select()
        .from(feesTable)
        .where(and(...conditions))
        .orderBy(feesTable.dueDate)
    : await db.select().from(feesTable).orderBy(feesTable.dueDate);
  res.json(rows);
});

// POST /api/fees
router.post(
  "/fees",
  requireRole("superadmin", "school_admin", "sub_admin"),
  async (req, res) => {
    const session = req.auth!;
    const body = req.body as {
      playerId?: number;
      amount?: number;
      currency?: string;
      description?: string;
      dueDate?: string;
      status?: string;
      schoolId?: number;
    };
    if (!body.playerId || !body.amount) {
      res.status(400).json({ error: "playerId and amount are required" });
      return;
    }
    // Verify the player exists and (for non-superadmin) belongs to caller's school
    const player = await db
      .select({ id: usersTable.id, role: usersTable.role, schoolId: usersTable.schoolId })
      .from(usersTable)
      .where(eq(usersTable.id, body.playerId))
      .limit(1);
    if (!player.length) {
      res.status(404).json({ error: "Player not found" });
      return;
    }
    if (player[0]!.role !== "player") {
      res.status(400).json({ error: "Target user is not a player" });
      return;
    }
    if (session.role !== "superadmin" && player[0]!.schoolId !== session.schoolId) {
      res.status(403).json({ error: "Cannot create fees for players in another school" });
      return;
    }
    const schoolId =
      session.role === "superadmin"
        ? (player[0]!.schoolId ?? body.schoolId ?? 0)
        : (session.schoolId ?? 0);
    if (!schoolId) {
      res.status(400).json({ error: "schoolId could not be determined" });
      return;
    }
    const [created] = await db
      .insert(feesTable)
      .values({
        schoolId,
        playerId: body.playerId,
        amount: body.amount,
        currency: body.currency ?? "INR",
        description: body.description ?? "",
        dueDate: body.dueDate ?? null,
        status: body.status ?? "pending",
      })
      .returning();
    res.status(201).json(created);
  },
);

// PATCH /api/fees/:id — update status / mark paid
router.patch(
  "/fees/:id",
  requireRole("superadmin", "school_admin", "sub_admin"),
  async (req, res) => {
    const session = req.auth!;
    const id = parseInt(String(req.params["id"]));
    const existing = await db
      .select()
      .from(feesTable)
      .where(eq(feesTable.id, id))
      .limit(1);
    if (!existing.length) {
      res.status(404).json({ error: "Fee not found" });
      return;
    }
    if (
      session.role !== "superadmin" &&
      existing[0]!.schoolId !== session.schoolId
    ) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const body = req.body as {
      status?: string;
      amount?: number;
      description?: string;
      dueDate?: string;
    };
    const patch: Record<string, unknown> = {};
    if (body.status) {
      patch["status"] = body.status;
      if (body.status === "paid") patch["paidAt"] = new Date();
    }
    if (body.amount !== undefined) patch["amount"] = body.amount;
    if (body.description !== undefined) patch["description"] = body.description;
    if (body.dueDate !== undefined) patch["dueDate"] = body.dueDate;
    const [updated] = await db
      .update(feesTable)
      .set(patch)
      .where(eq(feesTable.id, id))
      .returning();
    res.json(updated);
  },
);

// DELETE /api/fees/:id
router.delete(
  "/fees/:id",
  requireRole("superadmin", "school_admin"),
  async (req, res) => {
    const session = req.auth!;
    const id = parseInt(String(req.params["id"]));
    const existing = await db
      .select()
      .from(feesTable)
      .where(eq(feesTable.id, id))
      .limit(1);
    if (!existing.length) {
      res.status(404).json({ error: "Fee not found" });
      return;
    }
    if (
      session.role !== "superadmin" &&
      existing[0]!.schoolId !== session.schoolId
    ) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    await db.delete(feesTable).where(eq(feesTable.id, id));
    res.json({ message: "Fee deleted" });
  },
);

export default router;
