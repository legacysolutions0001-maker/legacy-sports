import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../lib/db";
import { hashPassword, verifyPassword } from "../lib/auth";
import { setLogoutAllTimestamp } from "../lib/logoutTokens";
import { requireRole } from "../middlewares/requireAuth";
import {
  usersTable,
  schoolsTable,
  activityLogTable,
  sportConfigsTable,
  parentPlayerLinksTable,
} from "@workspace/db/schema";
import { DEFAULT_SPORT_CONFIGS } from "../lib/sportDefaults";

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

const router: IRouter = Router();

// POST /api/auth/lookup-school
router.post("/auth/lookup-school", async (req, res) => {
  const { code } = req.body as { code?: string };
  if (!code?.trim()) {
    res.status(400).json({ error: "School code is required" });
    return;
  }
  const school = await db
    .select({
      id: schoolsTable.id,
      name: schoolsTable.name,
      code: schoolsTable.code,
      logoUrl: schoolsTable.logoUrl,
      primaryColor: schoolsTable.primaryColor,
      isPaused: schoolsTable.isPaused,
      pauseMessage: schoolsTable.pauseMessage,
      isDemo: schoolsTable.isDemo,
      demoMessage: schoolsTable.demoMessage,
    })
    .from(schoolsTable)
    .where(eq(schoolsTable.code, code.trim().toUpperCase()))
    .limit(1);

  if (!school.length) {
    res.status(404).json({ error: "School not found. Check your school code." });
    return;
  }
  const sc = school[0]!;
  res.json({
    id: sc.id,
    name: sc.name,
    code: sc.code,
    logoUrl: sc.logoUrl,
    primaryColor: sc.primaryColor,
    isPaused: sc.isPaused,
    pauseMessage: sc.pauseMessage,
    isDemo: sc.isDemo,
    demoMessage: sc.demoMessage,
  });
});

// POST /api/auth/login
router.post("/auth/login", async (req, res) => {
  const { schoolCode, username, password } = req.body as {
    schoolCode?: string;
    username?: string;
    password?: string;
  };

  if (!username?.trim() || !password?.trim()) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  // Superadmin login (no school code required)
  if (!schoolCode || schoolCode.trim().toUpperCase() === "SUPERADMIN") {
    const superUser = await db
      .select()
      .from(usersTable)
      .where(
        and(eq(usersTable.username, username.trim()), eq(usersTable.role, "superadmin")),
      )
      .limit(1);

    if (!superUser.length || !(await verifyPassword(password, superUser[0]!.password))) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const u = superUser[0]!;
    req.session.userId = u.id;
    req.session.role = u.role;
    req.session.schoolId = null;
    req.session.userName = u.name;
    req.session.isOwner = u.isOwner ?? false;
    req.session.loginAt = Date.now();

    res.json({
      user: {
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        schoolId: null,
        sport: u.sport,
        status: u.status,
        isOwner: u.isOwner,
      },
    });
    return;
  }

  const school = await db
    .select()
    .from(schoolsTable)
    .where(eq(schoolsTable.code, schoolCode.trim().toUpperCase()))
    .limit(1);

  if (!school.length) {
    res.status(401).json({ error: "School not found" });
    return;
  }
  const s = school[0]!;

  if (s.isPaused) {
    res.status(403).json({
      error:
        s.pauseMessage ||
        "This school account is paused. Please contact the director.",
    });
    return;
  }

  const user = await db
    .select()
    .from(usersTable)
    .where(
      and(
        eq(usersTable.username, username.trim()),
        eq(usersTable.schoolId, s.id),
      ),
    )
    .limit(1);

  if (!user.length || !(await verifyPassword(password, user[0]!.password))) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const u = user[0]!;

  if (u.status === "pending") {
    res.status(403).json({ error: "Your account is pending approval" });
    return;
  }
  if (u.status === "rejected" || u.status === "suspended") {
    res.status(403).json({ error: "Your account has been suspended" });
    return;
  }

  req.session.userId = u.id;
  req.session.role = u.role;
  req.session.schoolId = u.schoolId;
  req.session.userName = u.name;
  req.session.isOwner = false;
  req.session.loginAt = Date.now();

  res.json({
    user: {
      id: u.id,
      name: u.name,
      username: u.username,
      role: u.role,
      schoolId: u.schoolId,
      sport: u.sport,
      status: u.status,
      isOwner: false,
    },
    school: {
      id: s.id,
      name: s.name,
      code: s.code,
      logoUrl: s.logoUrl,
      primaryColor: s.primaryColor,
      isPaused: s.isPaused,
      pauseMessage: s.pauseMessage,
      isDemo: s.isDemo,
      demoMessage: s.demoMessage,
    },
  });
});

// POST /api/auth/logout
router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out successfully" });
  });
});

// POST /api/auth/logout-all — superadmin only: invalidate all sessions for this user
router.post("/auth/logout-all", requireRole("superadmin"), (req, res) => {
  const userId = req.session.userId!;
  setLogoutAllTimestamp(userId);
  req.session.destroy(() => {
    res.json({ message: "Logged out from all devices" });
  });
});

// GET /api/auth/me
router.get("/auth/me", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId))
    .limit(1);

  if (!user.length) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Session invalid" });
    return;
  }

  const u = user[0]!;
  let school = null;

  if (u.schoolId) {
    const s = await db
      .select()
      .from(schoolsTable)
      .where(eq(schoolsTable.id, u.schoolId))
      .limit(1);
    if (s.length) {
      const sc = s[0]!;
      school = {
        id: sc.id,
        name: sc.name,
        code: sc.code,
        logoUrl: sc.logoUrl,
        primaryColor: sc.primaryColor,
        isPaused: sc.isPaused,
        pauseMessage: sc.pauseMessage,
        isDemo: sc.isDemo,
        demoMessage: sc.demoMessage,
      };
    }
  }

  res.json({
    user: {
      id: u.id,
      name: u.name,
      username: u.username,
      role: u.role,
      schoolId: u.schoolId,
      sport: u.sport,
      status: u.status,
      isOwner: u.isOwner,
    },
    school,
  });
});

// POST /api/auth/register
router.post("/auth/register", async (req, res) => {
  const body = req.body as {
    schoolCode?: string;
    role?: string;
    username?: string;
    password?: string;
    name?: string;
    email?: string;
    phone?: string;
    whatsappNumber?: string;
    address?: string;
    sport?: string;
    admissionNumber?: string;
    age?: number;
    dateOfBirth?: string;
    gender?: string;
    className?: string;
    section?: string;
    rollNumber?: string;
    designation?: string;
    parentName?: string;
    parentPhone?: string;
    parentWhatsapp?: string;
    parentEmail?: string;
  };

  const { schoolCode, role, username, password, name } = body;

  if (!schoolCode || !role || !username || !password || !name) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  if (!["player", "coach"].includes(role)) {
    res.status(400).json({ error: "Invalid role for registration" });
    return;
  }

  if (!body.sport?.trim()) {
    res.status(400).json({ error: "Sport is required" });
    return;
  }

  const school = await db
    .select()
    .from(schoolsTable)
    .where(eq(schoolsTable.code, schoolCode.trim().toUpperCase()))
    .limit(1);

  if (!school.length) {
    res.status(400).json({ error: "School not found" });
    return;
  }
  const s = school[0]!;

  // Check username uniqueness in school
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.username, username.trim()), eq(usersTable.schoolId, s.id)))
    .limit(1);

  if (existing.length) {
    res.status(400).json({ error: "Username already taken in this school" });
    return;
  }

  if (role === "player" && body.admissionNumber) {
    const admExisting = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.admissionNumber, body.admissionNumber))
      .limit(1);
    if (admExisting.length) {
      res.status(400).json({ error: "Admission number already registered" });
      return;
    }
  }

  const hashed = await hashPassword(password);
  const playerCode = role === "player" ? await generateUniqueCode("PLR", usersTable.playerCode) : undefined;
  const coachCode = role === "coach" ? await generateUniqueCode("CCH", usersTable.coachCode) : undefined;
  await db.insert(usersTable).values({
    schoolId: s.id,
    role: role as "player" | "coach",
    username: username.trim(),
    password: hashed,
    name: name.trim(),
    playerCode,
    coachCode,
    email: body.email ?? "",
    phone: body.phone ?? "",
    whatsappNumber: body.whatsappNumber ?? "",
    address: body.address ?? "",
    sport: body.sport ?? "",
    admissionNumber: body.admissionNumber,
    age: body.age,
    dateOfBirth: body.dateOfBirth,
    gender: body.gender ?? "",
    className: body.className ?? "",
    section: body.section ?? "",
    rollNumber: body.rollNumber ?? "",
    designation: body.designation ?? "",
    parentName: body.parentName ?? "",
    parentPhone: body.parentPhone ?? "",
    parentWhatsapp: body.parentWhatsapp ?? "",
    parentEmail: body.parentEmail ?? "",
    status: "pending",
  });

  res.status(201).json({
    message: "Registration successful. Awaiting approval.",
  });
});

// POST /api/auth/seed — seed superadmin + sport configs
router.post("/auth/seed", async (req, res) => {
  const { masterKey } = req.body as { masterKey?: string };
  if (masterKey !== process.env["SESSION_SECRET"]) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Create owner superadmin if none exists
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "superadmin"))
    .limit(1);

  let message = "Superadmin password synced";
  const hashed = await hashPassword("Bhullar_01");
  if (!existing.length) {
    await db.insert(usersTable).values({
      role: "superadmin",
      username: "bhullar01",
      password: hashed,
      name: "Super Admin",
      isOwner: true,
      status: "approved",
    });
    message = "Superadmin created";
  } else {
    await db.update(usersTable).set({ password: hashed, status: "approved", isOwner: true }).where(eq(usersTable.username, "bhullar01"));
  }

  // Seed sport configs
  const sportCount = await db.select({ id: sportConfigsTable.id }).from(sportConfigsTable).limit(1);
  if (!sportCount.length) {
    for (const [sportName, config] of Object.entries(DEFAULT_SPORT_CONFIGS)) {
      await db.insert(sportConfigsTable).values({
        sportName,
        icon: config.icon,
        fieldsJson: config.fields,
      });
    }
    message += " + sports seeded";
  }

  res.json({ message });
});

export default router;
