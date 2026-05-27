import { and, desc, eq, or, sql } from "drizzle-orm";
import { db, pool } from "./db";
import {
  invoicesTable,
  notificationsTable,
  pricingConfigTable,
  reminderLogTable,
  schoolSettingsTable,
  schoolsTable,
  subscriptionsTable,
  usersTable,
  type Invoice,
  type InvoiceLineItem,
} from "@workspace/db/schema";
import { logger } from "./logger";
import { generateReminderAsync } from "./aiReminder";
import { sendEmail, sendSms, sendWhatsapp } from "./notifyAdapters";

export type Channel = "email" | "sms" | "whatsapp" | "inbox";

export async function getPricing() {
  const rows = await db.select().from(pricingConfigTable).limit(1);
  if (rows.length) return rows[0]!;
  const [inserted] = await db
    .insert(pricingConfigTable)
    .values({})
    .returning();
  return inserted!;
}

export async function computeInvoiceForSchool(schoolId: number) {
  const pricing = await getPricing();
  const [school] = await db
    .select()
    .from(schoolsTable)
    .where(eq(schoolsTable.id, schoolId))
    .limit(1);
  if (!school) throw new Error("School not found");
  const [settings] = await db
    .select()
    .from(schoolSettingsTable)
    .where(eq(schoolSettingsTable.schoolId, schoolId))
    .limit(1);
  const ss = settings ?? ({} as Partial<typeof schoolSettingsTable.$inferSelect>);
  const countRows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(and(eq(usersTable.schoolId, schoolId), eq(usersTable.role, "player")));
  const playerCount = Number(countRows[0]?.c ?? 0);

  const enabledSports = (ss.enabledSports ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const sportCount = enabledSports.length;

  const items: InvoiceLineItem[] = [];
  items.push({
    label: "Base platform subscription",
    qty: 1,
    unit: pricing.baseFee,
    total: pricing.baseFee,
  });
  // Per spec: AI and branded-website modules are only charged when the
  // school has them enabled. Default-on for new schools.
  const websiteOn = ss.websiteEnabled !== false;
  const aiOn = ss.aiEnabled !== false;
  if (websiteOn) {
    items.push({
      label: "Branded school website",
      qty: 1,
      unit: pricing.modWebsite,
      total: pricing.modWebsite,
    });
  }
  if (aiOn) {
    items.push({
      label: "AI assistant & insights",
      qty: 1,
      unit: pricing.modAi,
      total: pricing.modAi,
    });
  }
  if (playerCount > 0) {
    items.push({
      label: `Active players (${playerCount} × ${pricing.perPlayerFee})`,
      qty: playerCount,
      unit: pricing.perPlayerFee,
      total: playerCount * pricing.perPlayerFee,
    });
  }
  if (sportCount > 0) {
    items.push({
      label: `Enabled sports (${sportCount} × ${pricing.perSportFee})`,
      qty: sportCount,
      unit: pricing.perSportFee,
      total: sportCount * pricing.perSportFee,
    });
  }
  const mods: Array<[unknown, string, number]> = [
    [ss.attendanceEnabled, "Attendance module", pricing.modAttendance],
    [ss.performanceEnabled, "Performance tracking", pricing.modPerformance],
    [ss.analyticsEnabled, "Analytics dashboard", pricing.modAnalytics],
    [ss.leaderboardEnabled, "Leaderboard", pricing.modLeaderboard],
    [ss.calendarEnabled, "Calendar", pricing.modCalendar],
    [ss.messagingEnabled, "Messaging", pricing.modMessaging],
    [ss.photosEnabled, "Photos", pricing.modPhotos],
    [ss.notificationsEnabled, "Notifications", pricing.modNotifications],
    [ss.feesEnabled, "Student fees collection module", pricing.modFees],
    [ss.registrationEnabled, "Open registration", pricing.modRegistration],
  ];
  for (const [enabled, label, amt] of mods) {
    if (enabled) items.push({ label, qty: 1, unit: amt, total: amt });
  }
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  return { school, pricing, items, subtotal, total: subtotal, playerCount, sportCount };
}

function makeInvoiceNumber(schoolCode: string, d: Date) {
  return `INV-${schoolCode}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${Math.floor(
    Math.random() * 9000 + 1000,
  )}`;
}

function nextCycleDate(from: Date): string {
  return new Date(from.getFullYear(), from.getMonth() + 1, 1)
    .toISOString()
    .slice(0, 10);
}

export async function ensureSubscription(schoolId: number) {
  const [existing] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.schoolId, schoolId))
    .limit(1);
  if (existing) return existing;
  const [sub] = await db
    .insert(subscriptionsTable)
    .values({ schoolId, nextInvoiceDate: nextCycleDate(new Date()) })
    .returning();
  return sub!;
}

export async function ensureAllSubscriptions() {
  const schools = await db.select({ id: schoolsTable.id }).from(schoolsTable);
  for (const s of schools) await ensureSubscription(s.id);
}

export async function createInvoiceForSchool(schoolId: number) {
  const calc = await computeInvoiceForSchool(schoolId);
  const today = new Date();
  const periodStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
  const dueDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    Math.min(28, today.getDate() + 7),
  )
    .toISOString()
    .slice(0, 10);
  const [inv] = await db
    .insert(invoicesTable)
    .values({
      schoolId,
      invoiceNumber: makeInvoiceNumber(calc.school.code, today),
      periodStart,
      periodEnd,
      dueDate,
      lineItems: calc.items,
      subtotal: calc.subtotal,
      total: calc.total,
      currency: calc.pricing.currency,
    })
    .returning();
  await ensureSubscription(schoolId);
  await db
    .update(subscriptionsTable)
    .set({
      lastInvoicedAt: new Date(),
      nextInvoiceDate: nextCycleDate(today),
      updatedAt: new Date(),
    })
    .where(eq(subscriptionsTable.schoolId, schoolId));
  return inv!;
}

/**
 * Recompute line items + total for the school's most recent PENDING invoice.
 * Called from school-settings PATCH so a freshly-toggled module or sport
 * is reflected immediately on the open bill (paid / void / overdue invoices
 * are left untouched on purpose).
 */
export async function recomputePendingInvoice(schoolId: number) {
  const [latest] = await db
    .select()
    .from(invoicesTable)
    .where(
      and(eq(invoicesTable.schoolId, schoolId), eq(invoicesTable.status, "pending")),
    )
    .orderBy(desc(invoicesTable.createdAt))
    .limit(1);
  if (!latest) return null;
  const calc = await computeInvoiceForSchool(schoolId);
  const [updated] = await db
    .update(invoicesTable)
    .set({
      lineItems: calc.items,
      subtotal: calc.subtotal,
      total: calc.total,
      currency: calc.pricing.currency,
    })
    .where(eq(invoicesTable.id, latest.id))
    .returning();
  await db
    .update(subscriptionsTable)
    .set({ updatedAt: new Date() })
    .where(eq(subscriptionsTable.schoolId, schoolId));
  logger.info(
    { schoolId, invoiceId: latest.id, total: calc.total },
    "pending invoice recomputed after school settings change",
  );
  return updated;
}

/**
 * Mark invoices overdue only AFTER the configured grace period has elapsed.
 * `gracePeriodDays` is a tolerance window after `due_date` during which
 * the invoice is still considered "pending" (no overdue badge, no auto
 * reminder escalation to "firm/final"). Past the grace window it flips
 * to "overdue".
 */
export async function markOverdueInvoices() {
  const pricing = await getPricing();
  const grace = Math.max(0, pricing.gracePeriodDays ?? 0);
  await pool.query(
    `UPDATE invoices
        SET status='overdue'
      WHERE status='pending'
        AND due_date + ($1 || ' days')::interval < CURRENT_DATE`,
    [String(grace)],
  );
}

/**
 * Auto-suspend schools whose overdue invoice has been past due for longer
 * than `gracePeriodDays + autoSuspendAfterDays`. The grace period is the
 * cushion after the due date; auto-suspend is then measured from the end
 * of the grace window, matching the spec ("suspended only after grace
 * period elapses and customer remains unpaid for N more days").
 */
export async function suspendPastDueSchools(): Promise<number> {
  const pricing = await getPricing();
  const grace = Math.max(0, pricing.gracePeriodDays ?? 0);
  const cutoff = pricing.autoSuspendAfterDays;
  const totalDays = grace + cutoff;
  const res = await pool.query<{ school_id: number; name: string }>(
    `SELECT DISTINCT i.school_id, s.name FROM invoices i
       JOIN schools s ON s.id = i.school_id
      WHERE i.status='overdue'
        AND i.due_date <= CURRENT_DATE - ($1 || ' days')::interval
        AND s.is_paused = false`,
    [String(totalDays)],
  );
  for (const row of res.rows) {
    await db
      .update(schoolsTable)
      .set({
        isPaused: true,
        pauseMessage: `Subscription past due by more than ${totalDays} days (grace ${grace} + ${cutoff}). Please clear the latest invoice to restore access.`,
        pausedAt: new Date(),
      })
      .where(eq(schoolsTable.id, row.school_id));
    await db
      .update(subscriptionsTable)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(subscriptionsTable.schoolId, row.school_id));
    logger.warn(
      { schoolId: row.school_id, name: row.name },
      "School auto-suspended for past-due subscription",
    );
  }
  return res.rowCount ?? 0;
}

// ── Shared reminder dispatch ────────────────────────────────────────────────
export async function sendRemindersForInvoice(
  invoiceId: number,
  channels: Channel[],
  opts: { autoStage?: "friendly" | "firm" | "final" } = {},
) {
  const [inv] = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.id, invoiceId))
    .limit(1);
  if (!inv) throw new Error("Invoice not found");
  const [school] = await db
    .select()
    .from(schoolsTable)
    .where(eq(schoolsTable.id, inv.schoolId))
    .limit(1);
  if (!school) throw new Error("School not found");

  const today = new Date();
  const due = new Date(inv.dueDate);
  const daysUntilDue = Math.round(
    (due.getTime() - today.getTime()) / 86_400_000,
  );
  const stageMarker = opts.autoStage ? `[auto:${opts.autoStage}] ` : "";

  const logs: unknown[] = [];
  for (const channel of channels) {
    const msgChannel = channel === "inbox" ? "email" : channel;
    const msg = await generateReminderAsync({
      school,
      invoice: inv,
      daysUntilDue,
      channel: msgChannel,
    });
    let recipient = "";
    let ok = true;
    let provider = "inbox";
    let error: string | undefined;
    if (channel === "email") {
      recipient = school.ownerEmail || school.email || "";
      const r = await sendEmail(recipient, msg.subject, msg.body);
      ok = r.ok;
      provider = r.provider;
      error = r.error;
    } else if (channel === "sms") {
      recipient = school.ownerPhone || school.phone || "";
      const r = await sendSms(recipient, msg.body);
      ok = r.ok;
      provider = r.provider;
      error = r.error;
    } else if (channel === "whatsapp") {
      recipient = school.ownerWhatsapp || school.whatsappNumber || "";
      const r = await sendWhatsapp(recipient, msg.body);
      ok = r.ok;
      provider = r.provider;
      error = r.error;
    } else if (channel === "inbox") {
      const [owner] = await db
        .select()
        .from(usersTable)
        .where(
          and(
            eq(usersTable.schoolId, school.id),
            eq(usersTable.role, "school_admin"),
          ),
        )
        .limit(1);
      if (owner) {
        await db.insert(notificationsTable).values({
          senderRole: "superadmin",
          senderId: 0,
          senderName: "Legacy Billing",
          receiverRole: "school_admin",
          receiverId: owner.id,
          message: `${msg.subject}\n\n${msg.body}`,
        });
        recipient = owner.username;
      } else {
        ok = false;
        error = "no school_admin found";
      }
    }
    const [log] = await db
      .insert(reminderLogTable)
      .values({
        invoiceId: inv.id,
        schoolId: school.id,
        channel,
        recipient,
        subject: stageMarker + msg.subject,
        body: msg.body,
        status: ok ? "sent" : "failed",
        provider,
        error: error ?? "",
      })
      .returning();
    logs.push(log);
  }
  return logs;
}

// ── Auto-reminder pipeline (called by scheduler) ────────────────────────────
async function alreadySentStage(
  invoiceId: number,
  stage: "friendly" | "firm" | "final",
): Promise<boolean> {
  const sql =
    stage === "firm"
      ? `SELECT 1 FROM reminder_log WHERE invoice_id=$1 AND subject LIKE '[auto:firm]%' AND created_at > NOW() - INTERVAL '7 days' LIMIT 1`
      : `SELECT 1 FROM reminder_log WHERE invoice_id=$1 AND subject LIKE $2 LIMIT 1`;
  const r =
    stage === "firm"
      ? await pool.query(sql, [invoiceId])
      : await pool.query(sql, [invoiceId, `[auto:${stage}]%`]);
  return (r.rowCount ?? 0) > 0;
}

export async function runAutoReminders(): Promise<{
  sent: number;
  scanned: number;
}> {
  const pricing = await getPricing();
  const rows = await db
    .select()
    .from(invoicesTable)
    .where(or(eq(invoicesTable.status, "pending"), eq(invoicesTable.status, "overdue")))
    .orderBy(desc(invoicesTable.dueDate));
  const today = new Date();
  const grace = Math.max(0, pricing.gracePeriodDays ?? 0);
  let sent = 0;
  for (const inv of rows as Invoice[]) {
    const due = new Date(inv.dueDate);
    const daysUntilDue = Math.round(
      (due.getTime() - today.getTime()) / 86_400_000,
    );
    // Grace-aware staging: during [due, due+grace] we stay "friendly"
    // because the invoice has not actually breached its tolerance window
    // yet (markOverdueInvoices won't flip status until then either).
    // "firm" kicks in once we're past grace, and "final" only after
    // grace + autoSuspendAfterDays — matching the suspension trigger.
    let stage: "friendly" | "firm" | "final" | null = null;
    if (daysUntilDue > 0 && daysUntilDue <= pricing.reminderDaysBefore)
      stage = "friendly";
    else if (daysUntilDue <= 0 && daysUntilDue >= -grace) stage = "friendly";
    else if (
      daysUntilDue < -grace &&
      daysUntilDue > -(grace + pricing.autoSuspendAfterDays)
    )
      stage = "firm";
    else if (daysUntilDue <= -(grace + pricing.autoSuspendAfterDays))
      stage = "final";
    if (!stage) continue;
    if (await alreadySentStage(inv.id, stage)) continue;
    try {
      await sendRemindersForInvoice(
        inv.id,
        ["email", "sms", "whatsapp", "inbox"],
        { autoStage: stage },
      );
      sent += 1;
      logger.info(
        { invoiceId: inv.id, schoolId: inv.schoolId, stage, daysUntilDue },
        "auto reminder dispatched",
      );
    } catch (err) {
      logger.error(
        { err, invoiceId: inv.id },
        "auto reminder dispatch failed",
      );
    }
  }
  return { sent, scanned: rows.length };
}

export async function runBillingCycle(): Promise<{
  invoices: number;
  suspended: number;
  reminders: number;
}> {
  await ensureAllSubscriptions();
  await markOverdueInvoices();
  const dueRes = await pool.query<{ school_id: number }>(
    `SELECT school_id FROM subscriptions
      WHERE next_invoice_date <= CURRENT_DATE AND status != 'suspended'`,
  );
  let created = 0;
  for (const row of dueRes.rows) {
    try {
      await createInvoiceForSchool(row.school_id);
      created += 1;
    } catch (err) {
      logger.error({ err, schoolId: row.school_id }, "invoice create failed");
    }
  }
  const reminders = await runAutoReminders();
  const suspended = await suspendPastDueSchools();
  logger.info(
    { created, suspended, reminders: reminders.sent },
    "billing cycle complete",
  );
  return { invoices: created, suspended, reminders: reminders.sent };
}

export function startBillingScheduler() {
  const run = async () => {
    try {
      await runBillingCycle();
    } catch (err) {
      logger.error({ err }, "billing cycle failed");
    }
  };
  setTimeout(run, 15_000);
  setInterval(run, 6 * 60 * 60 * 1000);
}
