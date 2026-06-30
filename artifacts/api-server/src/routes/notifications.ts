import { Router, type IRouter } from "express";
import { eq, and, or } from "drizzle-orm";
import { db } from "../lib/db";
import { notificationsTable } from "@workspace/db/schema";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// GET /api/notifications
router.get("/notifications", requireAuth, async (req, res) => {
  const session = req.auth!;
  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.receiverId, session.userId!),
        eq(notificationsTable.receiverRole, session.role!),
      ),
    )
    .orderBy(notificationsTable.createdAt);

  res.json(notifications);
});

// POST /api/notifications
router.post("/notifications", requireAuth, async (req, res) => {
  const session = req.auth!;
  const body = req.body as {
    receiverId: number;
    receiverRole: string;
    message: string;
  };

  if (!body.receiverId || !body.receiverRole || !body.message?.trim()) {
    res.status(400).json({ error: "receiverId, receiverRole and message are required" });
    return;
  }

  const [notif] = await db
    .insert(notificationsTable)
    .values({
      senderId: session.userId!,
      senderRole: session.role!,
      senderName: session.name ?? "Unknown",
      receiverId: body.receiverId,
      receiverRole: body.receiverRole,
      message: body.message.trim(),
    })
    .returning();

  res.status(201).json(notif);
});

// PATCH /api/notifications/:id/read
router.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params["id"]));
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(
      and(
        eq(notificationsTable.id, id),
        eq(notificationsTable.receiverId, req.auth!.userId!),
      ),
    );
  res.json({ message: "Marked as read" });
});

export default router;
