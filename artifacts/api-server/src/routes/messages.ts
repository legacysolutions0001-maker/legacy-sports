import { Router, type IRouter } from "express";
import { and, desc, eq, or } from "drizzle-orm";
import { db } from "../lib/db";
import { messagesTable, usersTable } from "@workspace/db/schema";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// GET /api/messages — list conversations (latest message per peer)
router.get("/messages", requireAuth, async (req, res) => {
  const session = req.auth!;
  const userId = session.userId!;
  const rows = await db
    .select()
    .from(messagesTable)
    .where(
      or(
        eq(messagesTable.senderId, userId),
        eq(messagesTable.receiverId, userId),
      ),
    )
    .orderBy(desc(messagesTable.createdAt));
  res.json(rows);
});

// GET /api/messages/:peerId — full thread with a peer
router.get("/messages/:peerId", requireAuth, async (req, res) => {
  const session = req.auth!;
  const userId = session.userId!;
  const peerId = parseInt(String(req.params["peerId"]));
  const rows = await db
    .select()
    .from(messagesTable)
    .where(
      or(
        and(
          eq(messagesTable.senderId, userId),
          eq(messagesTable.receiverId, peerId),
        ),
        and(
          eq(messagesTable.senderId, peerId),
          eq(messagesTable.receiverId, userId),
        ),
      ),
    )
    .orderBy(messagesTable.createdAt);

  // Mark inbound as read
  await db
    .update(messagesTable)
    .set({ isRead: true })
    .where(
      and(
        eq(messagesTable.senderId, peerId),
        eq(messagesTable.receiverId, userId),
        eq(messagesTable.isRead, false),
      ),
    );

  res.json(rows);
});

// POST /api/messages — send a message
router.post("/messages", requireAuth, async (req, res) => {
  const session = req.auth!;
  const userId = session.userId!;
  const { receiverId, body } = req.body as {
    receiverId?: number;
    body?: string;
  };
  if (!receiverId || !body?.trim()) {
    res.status(400).json({ error: "receiverId and body are required" });
    return;
  }
  const peer = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, receiverId))
    .limit(1);
  if (!peer.length) {
    res.status(404).json({ error: "Receiver not found" });
    return;
  }
  if (session.role !== "superadmin" && peer[0]!.schoolId !== session.schoolId) {
    res.status(403).json({ error: "Cannot message users in other schools" });
    return;
  }
  const [created] = await db
    .insert(messagesTable)
    .values({
      schoolId: session.schoolId ?? peer[0]!.schoolId ?? null,
      senderId: userId,
      receiverId,
      body: body.trim(),
    })
    .returning();
  res.status(201).json(created);
});

export default router;
