import { Router, type IRouter } from "express";
import { eq, count, and, gte } from "drizzle-orm";
import { db } from "../lib/db";
import {
  usersTable,
  schoolsTable,
  performancesTable,
  attendanceTable,
} from "@workspace/db/schema";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

// GET /api/analytics/summary
router.get("/analytics/summary", requireRole("superadmin", "school_admin", "sub_admin"), async (req, res) => {
  const session = req.auth!;
  const isSuperadmin = session.role === "superadmin";
  const schoolId = session.schoolId ?? null;

  const [totalSchools] = await db
    .select({ count: count() })
    .from(schoolsTable);

  const playerCondition = !isSuperadmin && schoolId
    ? and(eq(usersTable.role, "player"), eq(usersTable.schoolId, schoolId))
    : eq(usersTable.role, "player");

  const coachCondition = !isSuperadmin && schoolId
    ? and(eq(usersTable.role, "coach"), eq(usersTable.schoolId, schoolId))
    : eq(usersTable.role, "coach");

  const [totalPlayers] = await db.select({ count: count() }).from(usersTable).where(playerCondition);
  const [totalCoaches] = await db.select({ count: count() }).from(usersTable).where(coachCondition);

  // totalPerformances: filter by school via player join for non-superadmins
  const [totalPerformances] = !isSuperadmin && schoolId
    ? await db
        .select({ count: count() })
        .from(performancesTable)
        .innerJoin(usersTable, eq(performancesTable.playerId, usersTable.id))
        .where(eq(usersTable.schoolId, schoolId))
    : await db.select({ count: count() }).from(performancesTable);

  // totalAttendance: filter by school for non-superadmins
  const [totalAttendance] = !isSuperadmin && schoolId
    ? await db
        .select({ count: count() })
        .from(attendanceTable)
        .where(eq(attendanceTable.schoolId, schoolId))
    : await db.select({ count: count() }).from(attendanceTable);

  // sportCounts: filter by school for non-superadmins
  const sportCountsBase = !isSuperadmin && schoolId
    ? and(eq(usersTable.role, "player"), eq(usersTable.status, "approved"), eq(usersTable.schoolId, schoolId))
    : and(eq(usersTable.role, "player"), eq(usersTable.status, "approved"));

  const sportCounts = await db
    .select({ sport: usersTable.sport, count: count() })
    .from(usersTable)
    .where(sportCountsBase)
    .groupBy(usersTable.sport);

  // schoolCounts: filter by school for non-superadmins (will return only own school)
  const schoolCountsBase = !isSuperadmin && schoolId
    ? and(eq(usersTable.role, "player"), eq(usersTable.status, "approved"), eq(usersTable.schoolId, schoolId))
    : and(eq(usersTable.role, "player"), eq(usersTable.status, "approved"));

  const schoolCounts = await db
    .select({ schoolId: usersTable.schoolId, count: count() })
    .from(usersTable)
    .where(schoolCountsBase)
    .groupBy(usersTable.schoolId);

  // Get school names for counts
  const schools = await db.select({ id: schoolsTable.id, name: schoolsTable.name }).from(schoolsTable);
  const schoolMap = Object.fromEntries(schools.map((s) => [s.id, s.name]));

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // attendanceTrend: filter by school for non-superadmins
  const trendConditions = !isSuperadmin && schoolId
    ? and(
        gte(attendanceTable.attDate, thirtyDaysAgo.toISOString().split("T")[0]!),
        eq(attendanceTable.schoolId, schoolId),
      )
    : gte(attendanceTable.attDate, thirtyDaysAgo.toISOString().split("T")[0]!);

  const attTrend = await db
    .select({ attDate: attendanceTable.attDate, count: count() })
    .from(attendanceTable)
    .where(trendConditions)
    .groupBy(attendanceTable.attDate)
    .orderBy(attendanceTable.attDate);

  res.json({
    totalSchools: totalSchools?.count ?? 0,
    totalPlayers: totalPlayers?.count ?? 0,
    totalCoaches: totalCoaches?.count ?? 0,
    totalPerformances: totalPerformances?.count ?? 0,
    totalAttendance: totalAttendance?.count ?? 0,
    sportCounts: sportCounts
      .filter((s) => s.sport)
      .map((s) => ({ sport: s.sport!, count: s.count })),
    schoolCounts: schoolCounts.map((s) => ({
      schoolName: schoolMap[s.schoolId ?? 0] ?? "Unknown",
      count: s.count,
    })),
    attendanceTrend: attTrend.map((a) => ({ date: a.attDate, count: a.count })),
  });
});

// GET /api/analytics/leaderboard
router.get("/analytics/leaderboard", requireAuth, async (req, res) => {
  const session = req.auth!;
  const { sport } = req.query as Record<string, string>;
  const schoolIdQuery = req.query["schoolId"] as string | undefined;

  // Non-superadmins can only see their own school's leaderboard
  const effectiveSchoolId = session.role === "superadmin"
    ? (schoolIdQuery ? parseInt(schoolIdQuery) : undefined)
    : (session.schoolId ?? undefined);

  const playerConditions = [
    eq(usersTable.role, "player"),
    eq(usersTable.status, "approved"),
  ];
  if (effectiveSchoolId) playerConditions.push(eq(usersTable.schoolId, effectiveSchoolId));
  if (sport) playerConditions.push(eq(usersTable.sport, sport));

  const players = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      sport: usersTable.sport,
      schoolId: usersTable.schoolId,
    })
    .from(usersTable)
    .where(and(...playerConditions));

  const leaderboard: Array<{
    schoolName: string;
    sport: string;
    icon: string;
    players: Array<{ id: number; name: string; total: number; sessions: number }>;
  }> = [];

  const schools = await db.select({ id: schoolsTable.id, name: schoolsTable.name }).from(schoolsTable);
  const schoolMap = Object.fromEntries(schools.map((s) => [s.id, s.name]));

  const sportGroups = new Map<string, typeof players>();
  for (const p of players) {
    const key = `${p.schoolId}-${p.sport}`;
    if (!sportGroups.has(key)) sportGroups.set(key, []);
    sportGroups.get(key)!.push(p);
  }

  for (const [key, groupPlayers] of sportGroups) {
    const playerStats: Array<{ id: number; name: string; total: number; sessions: number }> = [];

    for (const p of groupPlayers) {
      const perfs = await db
        .select({ customData: performancesTable.customData })
        .from(performancesTable)
        .where(eq(performancesTable.playerId, p.id));

      let total = 0;
      for (const perf of perfs) {
        const data = (perf.customData as Record<string, number | string>) ?? {};
        for (const val of Object.values(data)) {
          if (typeof val === "number") total += val;
          else if (typeof val === "string") {
            const n = parseFloat(val);
            if (!isNaN(n)) total += n;
          }
        }
      }
      playerStats.push({ id: p.id, name: p.name, total, sessions: perfs.length });
    }

    playerStats.sort((a, b) => b.total - a.total);
    const [schId] = key.split("-");
    const sp = groupPlayers[0]!.sport ?? "";
    leaderboard.push({
      schoolName: schoolMap[parseInt(schId ?? "0")] ?? "Unknown",
      sport: sp,
      icon: "trophy",
      players: playerStats.slice(0, 3).map((ps) => ({
        id: ps.id,
        name: ps.name,
        total: ps.total,
        sessions: ps.sessions,
      })),
    });
  }

  res.json(leaderboard);
});

export default router;
