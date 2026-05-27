import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { sportConfigsTable } from "@workspace/db/schema";
import type { SportField } from "@workspace/db/schema";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

// GET /api/sports
router.get("/sports", requireAuth, async (_req, res) => {
  const sports = await db
    .select()
    .from(sportConfigsTable)
    .orderBy(sportConfigsTable.sportName);
  res.json(sports);
});

// POST /api/sports (upsert)
router.post("/sports", requireRole("superadmin"), async (req, res) => {
  const body = req.body as {
    sportName?: string;
    icon?: string;
    fields?: SportField[];
  };

  if (!body.sportName?.trim()) {
    res.status(400).json({ error: "sportName is required" });
    return;
  }

  const existing = await db
    .select({ id: sportConfigsTable.id })
    .from(sportConfigsTable)
    .where(eq(sportConfigsTable.sportName, body.sportName.trim()))
    .limit(1);

  if (existing.length) {
    const [updated] = await db
      .update(sportConfigsTable)
      .set({
        icon: body.icon ?? "trophy",
        fieldsJson: body.fields ?? [],
        updatedAt: new Date(),
      })
      .where(eq(sportConfigsTable.id, existing[0]!.id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(sportConfigsTable)
      .values({
        sportName: body.sportName.trim(),
        icon: body.icon ?? "trophy",
        fieldsJson: body.fields ?? [],
      })
      .returning();
    res.json(created);
  }
});

// DELETE /api/sports/:id
router.delete("/sports/:id", requireRole("superadmin"), async (req, res) => {
  const id = parseInt(String(req.params["id"]));
  await db.delete(sportConfigsTable).where(eq(sportConfigsTable.id, id));
  res.json({ message: "Sport deleted" });
});

export default router;
