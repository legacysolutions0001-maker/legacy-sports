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
  const session = req.session;

  const [totalSchools] = await db
    .select({ count: count() })
    .from(schoolsTable);

  const playerCondition = session.role !== "superadmin" && session.schoolId
    ? and(eq(usersTable.role, "player"), eq(usersTable.schoolId, session.schoolId))
    : eq(usersTable.role, "player");

  const coachCondition = session.role !== "superadmin" && session.schoolId
    ? and(eq(usersTable.role, "coach"), eq(usersTable.schoolId, session.schoolId))
    : eq(usersTable.role, "coach");

  const [totalPlayers] = await db.select({ count: count() }).from(usersTable).where(playerCondition);
  const [totalCoaches] = await db.select({ count: count() }).from(usersTable).where(coachCondition);
  const [totalPerformances] = await db.select({ count: count() }).from(performancesTable);
  const [totalAttendance] = await db.select({ count: count() }).from(attendanceTable);

  const sportCounts = await db
    .select({ sport: usersTable.sport, count: count() })
    .from(usersTable)
    .where(and(eq(usersTable.role, "player"), eq(usersTable.status, "approved")))
    .groupBy(usersTable.sport);

  const schoolCounts = await db
    .select({ schoolId: usersTable.schoolId, count: count() })
    .from(usersTable)
    .where(and(eq(usersTable.role, "player"), eq(usersTable.status, "approved")))
    .groupBy(usersTable.schoolId);

  // Get school names for counts
  const schools = await db.select({ id: schoolsTable.id, name: schoolsTable.name }).from(schoolsTable);
  const schoolMap = Object.fromEntries(schools.map((s) => [s.id, s.name]));

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const attTrend = await db
    .select({ attDate: attendanceTable.attDate, count: count() })
    .from(attendanceTable)
    .where(gte(attendanceTable.attDate, thirtyDaysAgo.toISOString().split("T")[0]!))
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
  const { schoolId, sport } = req.query as Record<string, string>;

  const playerConditions = [
    eq(usersTable.role, "player"),
    eq(usersTable.status, "approved"),
  ];
  if (schoolId) playerConditions.push(eq(usersTable.schoolId, parseInt(schoolId)));
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
