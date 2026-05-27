import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../lib/db";
import { usersTable, parentPlayerLinksTable } from "@workspace/db/schema";
import { requireAuth, requireRole } from "../middlewares/requireAuth";
import { hashPassword } from "../lib/auth";

const router: IRouter = Router();

async function generateUniqueCode(prefix: string, column: typeof usersTable.playerCode | typeof usersTable.coachCode): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const n = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${prefix}${n}`;
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(column, candidate))
      .limit(1);
    if (!existing.length) return candidate;
  }
  return `${prefix}${Date.now().toString().slice(-6)}`;
}

// GET /api/users
router.get("/users", requireAuth, async (req, res) => {
  const { role, schoolId, status } = req.query as Record<string, string>;
  const session = req.session;

  let targetSchoolId: number | undefined;

  if (session.role === "superadmin") {
    targetSchoolId = schoolId ? parseInt(schoolId) : undefined;
  } else {
    targetSchoolId = session.schoolId ?? undefined;
  }

  const conditions = [];
  if (role) conditions.push(eq(usersTable.role, role as "player" | "coach" | "school_admin" | "sub_admin" | "superadmin"));
  if (targetSchoolId) conditions.push(eq(usersTable.schoolId, targetSchoolId));
  if (status) conditions.push(eq(usersTable.status, status as "pending" | "approved" | "rejected" | "suspended"));

  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      username: usersTable.username,
      role: usersTable.role,
      sport: usersTable.sport,
      status: usersTable.status,
      fitnessStatus: usersTable.fitnessStatus,
      schoolId: usersTable.schoolId,
      admissionNumber: usersTable.admissionNumber,
      playerCode: usersTable.playerCode,
      coachCode: usersTable.coachCode,
      designation: usersTable.designation,
      className: usersTable.className,
      section: usersTable.section,
      rollNumber: usersTable.rollNumber,
      createdAt: usersTable.createdAt,
      email: usersTable.email,
      phone: usersTable.phone,
      whatsappNumber: usersTable.whatsappNumber,
    })
    .from(usersTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(usersTable.createdAt);

  res.json(users);
});

// GET /api/users/:id
router.get("/users/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params["id"]));
  const session = req.session;

  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!user.length) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const u = user[0]!;

  if (
    session.role !== "superadmin" &&
    session.userId !== id &&
    session.schoolId !== u.schoolId
  ) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const { password: _password, ...safe } = u;
  res.json(safe);
});

// PUT /api/users/:id
router.put("/users/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params["id"]));
  const session = req.session;
  const body = req.body as Partial<typeof usersTable.$inferInsert> & { password?: string };

  if (session.userId !== id && !["superadmin", "school_admin", "sub_admin"].includes(session.role ?? "")) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  // Same-school restriction for non-superadmins
  if (session.userId !== id && session.role !== "superadmin") {
    const target = await db
      .select({ schoolId: usersTable.schoolId, isOwner: usersTable.isOwner, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    if (!target.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (target[0]!.isOwner || target[0]!.role === "superadmin") {
      res.status(403).json({ error: "Cannot modify the owner superadmin" });
      return;
    }
    if (target[0]!.schoolId !== session.schoolId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  }

  const updateData: Partial<typeof usersTable.$inferInsert> = {};
  const ALLOWED: (keyof typeof usersTable.$inferInsert)[] = [
    "name", "email", "phone", "whatsappNumber", "address", "sport",
    "age", "dateOfBirth", "gender", "className", "section", "rollNumber",
    "designation", "parentName", "parentPhone", "parentWhatsapp", "parentEmail",
    "photoUrl", "fitnessStatus",
  ];
  for (const key of ALLOWED) {
    if (body[key] !== undefined) (updateData as Record<string, unknown>)[key] = body[key];
  }
  // Self-update password allowed; admin password resets go through /reset-password
  if (body.password && session.userId === id) {
    updateData.password = await hashPassword(body.password);
  }

  const [updated] = await db
    .update(usersTable)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(usersTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { password: _password, ...safe } = updated;
  res.json(safe);
});

// DELETE /api/users/:id
router.delete("/users/:id", requireRole("superadmin", "school_admin"), async (req, res) => {
  const id = parseInt(String(req.params["id"]));
  const target = await db
    .select({ isOwner: usersTable.isOwner, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  if (target.length && (target[0]!.isOwner || target[0]!.role === "superadmin")) {
    res.status(403).json({ error: "Cannot delete the owner superadmin" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.json({ message: "User deleted" });
});

// PATCH /api/users/:id/status
router.patch("/users/:id/status", requireRole("superadmin", "school_admin", "coach"), async (req, res) => {
  const id = parseInt(String(req.params["id"]));
  const { status } = req.body as { status: "pending" | "approved" | "rejected" | "suspended" };

  const user = await db
    .select({ schoolId: usersTable.schoolId, role: usersTable.role, isOwner: usersTable.isOwner })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!user.length) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if ((user[0]!.isOwner || user[0]!.role === "superadmin") && status !== "approved") {
    res.status(403).json({ error: "Cannot change status of the owner superadmin" });
    return;
  }

  const session = req.session;
  if (session.role === "coach" && user[0]!.role !== "player") {
    res.status(403).json({ error: "Coaches can only manage players" });
    return;
  }
  // Same-school enforcement for non-superadmins
  if (session.role !== "superadmin" && user[0]!.schoolId !== session.schoolId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(usersTable.id, id))
    .returning({
      id: usersTable.id,
      name: usersTable.name,
      username: usersTable.username,
      role: usersTable.role,
      sport: usersTable.sport,
      status: usersTable.status,
    });

  res.json(updated);
});

// POST /api/users/:id/reset-password
// Matrix:
//   superadmin  -> any user
//   school_admin/sub_admin -> users in same school (not superadmin, not owner)
//   coach -> players in same school only
//   player -> nobody (forbidden by role gate)
router.post("/users/:id/reset-password", requireRole("superadmin", "school_admin"), async (req, res) => {
  const id = parseInt(String(req.params["id"]));
  const { newPassword } = req.body as { newPassword?: string };

  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }

  const target = await db
    .select({ id: usersTable.id, role: usersTable.role, schoolId: usersTable.schoolId, isOwner: usersTable.isOwner })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!target.length) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const t = target[0]!;
  const session = req.session;

  const ALLOWED_RESET: Record<string, string[]> = {
    superadmin: ["school_admin"],
    school_admin: ["coach", "player"],
  };
  const allowed = ALLOWED_RESET[session.role ?? ""] ?? [];
  if (!allowed.includes(t.role)) {
    res.status(403).json({ error: `Your role cannot reset a ${t.role}'s password` });
    return;
  }
  if (t.isOwner) {
    res.status(403).json({ error: "Cannot reset the owner superadmin's password" });
    return;
  }
  // Same-school restriction for non-superadmins
  if (session.role !== "superadmin" && session.schoolId !== t.schoolId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const hashed = await hashPassword(newPassword);
  await db
    .update(usersTable)
    .set({ password: hashed, updatedAt: new Date() })
    .where(eq(usersTable.id, id));

  res.json({ message: "Password reset successfully" });
});

// PATCH /api/users/:id/fitness
router.patch("/users/:id/fitness", requireRole("coach", "school_admin", "superadmin"), async (req, res) => {
  const id = parseInt(String(req.params["id"]));
  const { fitnessStatus } = req.body as { fitnessStatus: "fit" | "injured" | "recovering" | "resting" };

  await db
    .update(usersTable)
    .set({ fitnessStatus, updatedAt: new Date() })
    .where(eq(usersTable.id, id));

  res.json({ message: "Fitness status updated" });
});

// POST /api/users — create user (admin)
router.post("/users", requireRole("superadmin", "school_admin", "sub_admin", "coach"), async (req, res) => {
  const session = req.session;
  const body = req.body as {
    schoolId?: number;
    role?: string;
    username?: string;
    password?: string;
    name?: string;
    email?: string;
    phone?: string;
    whatsappNumber?: string;
    sport?: string;
    address?: string;
    designation?: string;
    admissionNumber?: string;
    age?: number;
    dateOfBirth?: string;
    gender?: string;
    className?: string;
    section?: string;
    rollNumber?: string;
    parentName?: string;
    parentPhone?: string;
    parentWhatsapp?: string;
    parentEmail?: string;
    createParentAccount?: boolean;
    parentUsername?: string;
    parentPassword?: string;
  };

  if (!body.username || !body.password || !body.name || !body.role) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  if (body.password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const ALLOWED_TO_CREATE: Record<string, string[]> = {
    superadmin: ["superadmin", "school_admin", "sub_admin", "coach", "player"],
    school_admin: ["sub_admin", "coach", "player"],
    sub_admin: ["coach", "player"],
    coach: ["player"],
  };
  const allowed = ALLOWED_TO_CREATE[session.role ?? ""] ?? [];
  if (!allowed.includes(body.role)) {
    res.status(403).json({ error: `Your role cannot create a ${body.role}` });
    return;
  }

  // Sport required for coach/player
  if ((body.role === "coach" || body.role === "player") && !body.sport?.trim()) {
    res.status(400).json({ error: "Sport is required for coaches and players" });
    return;
  }

  const schoolId = session.role === "superadmin" ? body.schoolId : session.schoolId;
  if (!schoolId && body.role !== "superadmin") {
    res.status(400).json({ error: "School ID required" });
    return;
  }

  // Auto-generate unique player/coach code
  let playerCode: string | undefined;
  let coachCode: string | undefined;
  if (body.role === "player") playerCode = await generateUniqueCode("PLR", usersTable.playerCode);
  if (body.role === "coach") coachCode = await generateUniqueCode("CCH", usersTable.coachCode);

  const hashed = await hashPassword(body.password);
  const [user] = await db
    .insert(usersTable)
    .values({
      schoolId: schoolId ?? null,
      role: body.role as "player" | "coach" | "school_admin" | "sub_admin" | "superadmin",
      username: body.username.trim(),
      password: hashed,
      name: body.name.trim(),
      email: body.email ?? "",
      phone: body.phone ?? "",
      whatsappNumber: body.whatsappNumber ?? "",
      sport: body.sport ?? "",
      address: body.address ?? "",
      designation: body.designation ?? "",
      admissionNumber: body.admissionNumber,
      age: body.age,
      dateOfBirth: body.dateOfBirth,
      gender: body.gender ?? "",
      className: body.className ?? "",
      section: body.section ?? "",
      rollNumber: body.rollNumber ?? "",
      parentName: body.parentName ?? "",
      parentPhone: body.parentPhone ?? "",
      parentWhatsapp: body.parentWhatsapp ?? "",
      parentEmail: body.parentEmail ?? "",
      playerCode,
      coachCode,
      status: "approved",
    })
    .returning();

  const { password: _password, ...safe } = user!;

  // Optionally create linked parent account when creating a player
  if (body.role === "player" && body.createParentAccount && body.parentUsername?.trim() && body.parentPassword && body.parentPassword.length >= 6) {
    try {
      const parentHashed = await hashPassword(body.parentPassword);
      const [parentUser] = await db
        .insert(usersTable)
        .values({
          schoolId: schoolId ?? null,
          role: "parent",
          username: body.parentUsername.trim(),
          password: parentHashed,
          name: body.parentName?.trim() || `${body.name?.trim() ?? ""} Parent`,
          email: body.parentEmail ?? "",
          phone: body.parentPhone ?? "",
          whatsappNumber: body.parentWhatsapp ?? "",
          status: "approved",
        })
        .returning();
      if (parentUser && schoolId) {
        await db
          .insert(parentPlayerLinksTable)
          .values({
            parentId: parentUser.id,
            playerId: user!.id,
            schoolId,
          })
          .onConflictDoNothing();
      }
    } catch (err) {
      // Parent creation is best-effort; player already created successfully
      const msg = err instanceof Error ? err.message : String(err);
      req.log.warn({ msg }, "Parent account creation failed (non-fatal)");
    }
  }

  res.status(201).json(safe);
});

export default router;
