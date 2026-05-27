import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../lib/db";
import { usersTable, attendanceTable, schoolsTable } from "@workspace/db/schema";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCSV(headers: string[], rows: Record<string, unknown>[]): string {
  const head = headers.map(escapeCSV).join(",");
  const body = rows
    .map((row) => headers.map((h) => escapeCSV(row[h])).join(","))
    .join("\n");
  return head + "\n" + body;
}

function sendCSV(res: import("express").Response, csv: string, filename: string): void {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

// GET /api/export/users?type=players|coaches
// Roles: superadmin, school_admin, sub_admin, coach
router.get(
  "/export/users",
  requireRole("superadmin", "school_admin", "sub_admin", "coach"),
  async (req, res) => {
    const session = req.session;
    const type = String(req.query["type"] ?? "players");
    const role = type === "coaches" ? "coach" : "player";

    const conditions: ReturnType<typeof eq>[] = [
      eq(usersTable.role, role as "player" | "coach"),
    ];
    if (session.role !== "superadmin" && session.schoolId) {
      conditions.push(eq(usersTable.schoolId, session.schoolId));
    }

    const rows = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        username: usersTable.username,
        email: usersTable.email,
        phone: usersTable.phone,
        whatsappNumber: usersTable.whatsappNumber,
        sport: usersTable.sport,
        status: usersTable.status,
        fitnessStatus: usersTable.fitnessStatus,
        gender: usersTable.gender,
        dateOfBirth: usersTable.dateOfBirth,
        className: usersTable.className,
        section: usersTable.section,
        rollNumber: usersTable.rollNumber,
        admissionNumber: usersTable.admissionNumber,
        address: usersTable.address,
        parentName: usersTable.parentName,
        parentPhone: usersTable.parentPhone,
        designation: usersTable.designation,
        playerCode: usersTable.playerCode,
        coachCode: usersTable.coachCode,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(and(...conditions))
      .orderBy(usersTable.name);

    const playerHeaders = [
      "id", "name", "username", "email", "phone", "whatsappNumber",
      "sport", "status", "fitnessStatus", "gender", "dateOfBirth",
      "className", "section", "rollNumber", "admissionNumber",
      "parentName", "parentPhone", "address", "playerCode", "createdAt",
    ];
    const coachHeaders = [
      "id", "name", "username", "email", "phone", "whatsappNumber",
      "sport", "status", "designation", "coachCode", "createdAt",
    ];

    const headers = role === "player" ? playerHeaders : coachHeaders;
    const csv = toCSV(headers, rows as unknown as Record<string, unknown>[]);
    const filename = `${type}-${new Date().toISOString().split("T")[0]}.csv`;
    sendCSV(res, csv, filename);
  },
);

// GET /api/export/attendance
// Roles: superadmin, school_admin, sub_admin, coach
router.get(
  "/export/attendance",
  requireRole("superadmin", "school_admin", "sub_admin", "coach"),
  async (req, res) => {
    const session = req.session;
    const conditions: ReturnType<typeof eq>[] = [];

    if (session.role === "coach") {
      conditions.push(eq(attendanceTable.coachId, session.userId!));
    } else if (session.role !== "superadmin" && session.schoolId) {
      conditions.push(eq(attendanceTable.schoolId, session.schoolId));
    }

    const rows = await db
      .select({
        id: attendanceTable.id,
        playerName: usersTable.name,
        attDate: attendanceTable.attDate,
        status: attendanceTable.status,
        sessionType: attendanceTable.sessionType,
        notes: attendanceTable.notes,
        createdAt: attendanceTable.createdAt,
      })
      .from(attendanceTable)
      .leftJoin(usersTable, eq(usersTable.id, attendanceTable.userId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(attendanceTable.attDate);

    const headers = ["id", "playerName", "attDate", "status", "sessionType", "notes", "createdAt"];
    const csv = toCSV(headers, rows as unknown as Record<string, unknown>[]);
    const filename = `attendance-${new Date().toISOString().split("T")[0]}.csv`;
    sendCSV(res, csv, filename);
  },
);

// GET /api/export/schools
// Roles: superadmin only
router.get(
  "/export/schools",
  requireRole("superadmin"),
  async (_req, res) => {
    const rows = await db
      .select({
        id: schoolsTable.id,
        name: schoolsTable.name,
        code: schoolsTable.code,
        email: schoolsTable.email,
        phone: schoolsTable.phone,
        whatsappNumber: schoolsTable.whatsappNumber,
        address: schoolsTable.address,
        ownerName: schoolsTable.ownerName,
        ownerEmail: schoolsTable.ownerEmail,
        ownerPhone: schoolsTable.ownerPhone,
        principalName: schoolsTable.principalName,
        isPaused: schoolsTable.isPaused,
        isDemo: schoolsTable.isDemo,
        createdAt: schoolsTable.createdAt,
      })
      .from(schoolsTable)
      .orderBy(schoolsTable.name);

    const headers = [
      "id", "name", "code", "email", "phone", "whatsappNumber",
      "address", "ownerName", "ownerEmail", "ownerPhone",
      "principalName", "isPaused", "isDemo", "createdAt",
    ];
    const csv = toCSV(headers, rows as unknown as Record<string, unknown>[]);
    const filename = `schools-${new Date().toISOString().split("T")[0]}.csv`;
    sendCSV(res, csv, filename);
  },
);

export default router;
