import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../lib/db";
import { attendanceTable, usersTable } from "@workspace/db/schema";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

// GET /api/attendance
router.get("/attendance", requireAuth, async (req, res) => {
  const { userId, schoolId, coachId } = req.query as Record<string, string>;
  const session = req.session;

  const conditions = [];

  if (session.role === "player") {
    conditions.push(eq(attendanceTable.userId, session.userId!));
  } else if (session.role === "coach") {
    conditions.push(eq(attendanceTable.coachId, session.userId!));
    if (userId) conditions.push(eq(attendanceTable.userId, parseInt(userId)));
  } else {
    if (userId) conditions.push(eq(attendanceTable.userId, parseInt(userId)));
    if (coachId) conditions.push(eq(attendanceTable.coachId, parseInt(coachId)));
    const targetSchool = schoolId
      ? parseInt(schoolId)
      : session.role !== "superadmin"
        ? session.schoolId ?? undefined
        : undefined;
    if (targetSchool) conditions.push(eq(attendanceTable.schoolId, targetSchool));
  }

  const records = await db
    .select({
      id: attendanceTable.id,
      userId: attendanceTable.userId,
      schoolId: attendanceTable.schoolId,
      coachId: attendanceTable.coachId,
      attDate: attendanceTable.attDate,
      status: attendanceTable.status,
      sessionType: attendanceTable.sessionType,
      notes: attendanceTable.notes,
      createdAt: attendanceTable.createdAt,
      userName: usersTable.name,
    })
    .from(attendanceTable)
    .leftJoin(usersTable, eq(usersTable.id, attendanceTable.userId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(attendanceTable.attDate);

  res.json(records);
});

// POST /api/attendance
router.post("/attendance", requireRole("coach", "school_admin", "superadmin"), async (req, res) => {
  const session = req.session;
  const body = req.body as {
    schoolId: number;
    attDate: string;
    sessionType?: string;
    records: Array<{ userId: number; status: string; notes?: string }>;
  };

  if (!body.schoolId || !body.attDate || !body.records?.length) {
    res.status(400).json({ error: "schoolId, attDate and records are required" });
    return;
  }

  const insertRows = body.records.map((r) => ({
    userId: r.userId,
    schoolId: body.schoolId,
    coachId: session.role === "coach" ? session.userId! : null,
    attDate: body.attDate,
    status: r.status,
    sessionType: body.sessionType ?? "Training",
    notes: r.notes ?? "",
  }));

  await db.insert(attendanceTable).values(insertRows);
  res.status(201).json({ message: `Attendance marked for ${insertRows.length} player(s)` });
});

export default router;
