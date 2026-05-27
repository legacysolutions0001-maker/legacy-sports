import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { schoolsTable, schoolSettingsTable } from "@workspace/db/schema";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

function slugifyCode(name: string): string {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 8) || "SCHOOL";
  return base;
}

async function generateUniqueSchoolCode(name: string): Promise<string> {
  const base = slugifyCode(name);
  for (let i = 0; i < 50; i++) {
    const suffix = i === 0 ? "" : String(Math.floor(100 + Math.random() * 900));
    const candidate = (base + suffix).slice(0, 12);
    const existing = await db
      .select({ id: schoolsTable.id })
      .from(schoolsTable)
      .where(eq(schoolsTable.code, candidate))
      .limit(1);
    if (!existing.length) return candidate;
  }
  // Fallback: timestamp-based
  return (base + Date.now().toString().slice(-5)).slice(0, 12);
}

// GET /api/schools
router.get("/schools", requireRole("superadmin"), async (_req, res) => {
  const schools = await db.select().from(schoolsTable).orderBy(schoolsTable.createdAt);
  res.json(schools);
});

// POST /api/schools
router.post("/schools", requireRole("superadmin"), async (req, res) => {
  const body = req.body as {
    name?: string;
    code?: string;
    phone?: string;
    whatsappNumber?: string;
    address?: string;
    email?: string;
    ownerName?: string;
    ownerPhone?: string;
    ownerWhatsapp?: string;
    ownerEmail?: string;
    principalName?: string;
    primaryColor?: string;
    logoUrl?: string;
  };

  if (!body.name?.trim()) {
    res.status(400).json({ error: "School name is required" });
    return;
  }

  let code = body.code?.trim().toUpperCase();
  if (code) {
    const existing = await db
      .select({ id: schoolsTable.id })
      .from(schoolsTable)
      .where(eq(schoolsTable.code, code))
      .limit(1);
    if (existing.length) {
      res.status(400).json({ error: "School code already exists" });
      return;
    }
  } else {
    code = await generateUniqueSchoolCode(body.name);
  }

  const [school] = await db
    .insert(schoolsTable)
    .values({
      name: body.name.trim(),
      code,
      phone: body.phone ?? "",
      whatsappNumber: body.whatsappNumber ?? "",
      address: body.address ?? "",
      email: body.email ?? "",
      ownerName: body.ownerName ?? "",
      ownerPhone: body.ownerPhone ?? "",
      ownerWhatsapp: body.ownerWhatsapp ?? "",
      ownerEmail: body.ownerEmail ?? "",
      principalName: body.principalName ?? "",
      primaryColor: body.primaryColor ?? "#1a3a5c",
      logoUrl: body.logoUrl ?? "",
    })
    .returning();

  await db.insert(schoolSettingsTable).values({
    schoolId: school!.id,
    enabledSports: "Cricket,Basketball,Volleyball,Football,Swimming,Athletics,Boxing,Badminton,Tennis,Kabaddi,Hockey,Weightlifting,Gymnastics,Archery,Cycling,Wrestling",
    attendanceEnabled: true,
    registrationEnabled: true,
  });

  res.status(201).json(school);
});

// GET /api/schools/:id
router.get("/schools/:id", requireRole("superadmin", "school_admin"), async (req, res) => {
  const id = parseInt(String(req.params["id"]));
  if (req.session.role !== "superadmin" && req.session.schoolId !== id) {
    res.status(403).json({ error: "You can only access your own school" });
    return;
  }
  const school = await db
    .select()
    .from(schoolsTable)
    .where(eq(schoolsTable.id, id))
    .limit(1);
  if (!school.length) {
    res.status(404).json({ error: "School not found" });
    return;
  }
  res.json(school[0]);
});

// PUT /api/schools/:id
router.put("/schools/:id", requireRole("superadmin", "school_admin"), async (req, res) => {
  const id = parseInt(String(req.params["id"]));
  if (req.session.role !== "superadmin" && req.session.schoolId !== id) {
    res.status(403).json({ error: "You can only modify your own school" });
    return;
  }
  const body = req.body;
  const [updated] = await db
    .update(schoolsTable)
    .set({
      name: body.name,
      phone: body.phone,
      whatsappNumber: body.whatsappNumber,
      address: body.address,
      email: body.email,
      ownerName: body.ownerName,
      ownerPhone: body.ownerPhone,
      ownerWhatsapp: body.ownerWhatsapp,
      ownerEmail: body.ownerEmail,
      principalName: body.principalName,
      primaryColor: body.primaryColor,
      logoUrl: body.logoUrl,
      isDemo: body.isDemo,
      demoMessage: body.demoMessage,
    })
    .where(eq(schoolsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "School not found" });
    return;
  }
  res.json(updated);
});

// DELETE /api/schools/:id
router.delete("/schools/:id", requireRole("superadmin"), async (req, res) => {
  const id = parseInt(String(req.params["id"]));
  const existing = await db
    .select({ id: schoolsTable.id })
    .from(schoolsTable)
    .where(eq(schoolsTable.id, id))
    .limit(1);
  if (!existing.length) {
    res.status(404).json({ error: "School not found" });
    return;
  }
  await db.delete(schoolsTable).where(eq(schoolsTable.id, id));
  res.json({ message: "School deleted" });
});

// POST /api/schools/:id/pause
router.post("/schools/:id/pause", requireRole("superadmin"), async (req, res) => {
  const id = parseInt(String(req.params["id"]));
  const { paused, message } = req.body as { paused: boolean; message?: string };
  const [updated] = await db
    .update(schoolsTable)
    .set({
      isPaused: paused,
      pauseMessage: message ?? "",
      pausedAt: paused ? new Date() : null,
    })
    .where(eq(schoolsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "School not found" });
    return;
  }
  res.json(updated);
});

export default router;
