import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../lib/db";
import {
  invoicesTable,
  pricingConfigTable,
  reminderLogTable,
  schoolsTable,
  subscriptionsTable,
} from "@workspace/db/schema";
import { requireRole } from "../middlewares/requireAuth";
import {
  computeInvoiceForSchool,
  createInvoiceForSchool,
  ensureSubscription,
  getPricing,
  markOverdueInvoices,
  runBillingCycle,
  sendRemindersForInvoice,
  suspendPastDueSchools,
  type Channel,
} from "../lib/billing";
import { renderInvoicePdf } from "../lib/pdfDocs";

const router: IRouter = Router();

// ── PRICING (superadmin only — config is platform-level) ───────────────────
router.get("/pricing", requireRole("superadmin"), async (_req, res) => {
  res.json(await getPricing());
});

// ── PAYMENT METHODS (all authenticated roles — returns only payment fields) ─
router.get(
  "/payment-methods",
  requireRole("superadmin", "school_admin", "sub_admin", "coach", "player"),
  async (_req, res) => {
    const p = await getPricing();
    res.json({
      upiId:                  p.upiId                  ?? null,
      qrCodeUrl:              p.qrCodeUrl              ?? null,
      account1BankName:       p.account1BankName       ?? null,
      account1AccountNumber:  p.account1AccountNumber  ?? null,
      account1IfscCode:       p.account1IfscCode       ?? null,
      account1HolderName:     p.account1HolderName     ?? null,
      account2BankName:       p.account2BankName       ?? null,
      account2AccountNumber:  p.account2AccountNumber  ?? null,
      account2IfscCode:       p.account2IfscCode       ?? null,
      account2HolderName:     p.account2HolderName     ?? null,
    });
  },
);

router.put("/pricing", requireRole("superadmin"), async (req, res) => {
  const pricing = await getPricing();
  const body = req.body as Partial<typeof pricingConfigTable.$inferInsert>;
  const [updated] = await db
    .update(pricingConfigTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(pricingConfigTable.id, pricing.id))
    .returning();
  res.json(updated);
});

// ── SUBSCRIPTIONS ──────────────────────────────────────────────────────────
router.get("/subscriptions", requireRole("superadmin", "school_admin", "sub_admin"), async (req, res) => {
  if (req.session.role === "superadmin") {
    const rows = await db
      .select()
      .from(subscriptionsTable)
      .orderBy(desc(subscriptionsTable.updatedAt));
    res.json(rows);
    return;
  }
  const schoolId = req.session.schoolId;
  if (!schoolId) {
    res.json([]);
    return;
  }
  res.json([await ensureSubscription(schoolId)]);
});

router.patch(
  "/subscriptions/:schoolId",
  requireRole("superadmin"),
  async (req, res) => {
    const schoolId = parseInt(String(req.params["schoolId"]));
    await ensureSubscription(schoolId);
    const body = req.body as Partial<
      typeof subscriptionsTable.$inferInsert
    >;
    const [updated] = await db
      .update(subscriptionsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(subscriptionsTable.schoolId, schoolId))
      .returning();
    res.json(updated);
  },
);

router.get(
  "/subscriptions/:schoolId/preview",
  requireRole("superadmin", "school_admin", "sub_admin"),
  async (req, res) => {
    const schoolId = parseInt(String(req.params["schoolId"]));
    if (
      req.session.role !== "superadmin" &&
      req.session.schoolId !== schoolId
    ) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const calc = await computeInvoiceForSchool(schoolId);
    // Surface currency at top-level so the UI can render it without
    // having to dig into nested pricing object.
    res.json({ ...calc, currency: calc.pricing.currency });
  },
);

router.post(
  "/subscriptions/:schoolId/invoice",
  requireRole("superadmin"),
  async (req, res) => {
    const schoolId = parseInt(String(req.params["schoolId"]));
    const inv = await createInvoiceForSchool(schoolId);
    res.status(201).json(inv);
  },
);

// ── INVOICE PDF DOWNLOAD ───────────────────────────────────────────────────
router.get(
  "/invoices/:id/pdf",
  requireRole("superadmin", "school_admin", "sub_admin"),
  async (req, res) => {
    const id = parseInt(String(req.params["id"]));
    const [inv] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, id))
      .limit(1);
    if (!inv) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    // School admins can only download their own invoices
    if (req.session.role !== "superadmin" && req.session.schoolId !== inv.schoolId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const [school] = await db
      .select()
      .from(schoolsTable)
      .where(eq(schoolsTable.id, inv.schoolId))
      .limit(1);
    const payment = await getPricing();
    const pdfBytes = await renderInvoicePdf(
      {
        ...inv,
        lineItems: (inv.lineItems ?? []) as Array<{ label: string; qty: number; unit: number; total: number }>,
      },
      school ?? null,
      payment,
    );
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${inv.invoiceNumber}.pdf"`,
      "Content-Length": String(pdfBytes.length),
    });
    res.end(Buffer.from(pdfBytes));
  },
);

// ── INVOICES ───────────────────────────────────────────────────────────────
router.get("/invoices", requireRole("superadmin", "school_admin", "sub_admin"), async (req, res) => {
  const conds = [];
  if (req.session.role !== "superadmin") {
    if (!req.session.schoolId) {
      res.json([]);
      return;
    }
    conds.push(eq(invoicesTable.schoolId, req.session.schoolId));
  } else if (req.query["schoolId"]) {
    conds.push(
      eq(invoicesTable.schoolId, parseInt(String(req.query["schoolId"]))),
    );
  }
  if (req.query["status"]) {
    conds.push(eq(invoicesTable.status, String(req.query["status"])));
  }
  const rows = conds.length
    ? await db
        .select()
        .from(invoicesTable)
        .where(and(...conds))
        .orderBy(desc(invoicesTable.createdAt))
    : await db
        .select()
        .from(invoicesTable)
        .orderBy(desc(invoicesTable.createdAt));
  res.json(rows);
});

// Per-school override: superadmin can edit total / dueDate / notes / status
router.patch("/invoices/:id", requireRole("superadmin"), async (req, res) => {
  const id = parseInt(String(req.params["id"]));
  const body = req.body as Partial<typeof invoicesTable.$inferInsert>;
  const patch: Record<string, unknown> = {};
  if (body.total !== undefined) patch["total"] = body.total;
  if (body.subtotal !== undefined) patch["subtotal"] = body.subtotal;
  if (body.dueDate !== undefined) patch["dueDate"] = body.dueDate;
  if (body.notes !== undefined) patch["notes"] = body.notes;
  if (body.status !== undefined) patch["status"] = body.status;
  const [updated] = await db
    .update(invoicesTable)
    .set(patch)
    .where(eq(invoicesTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  res.json(updated);
});

router.post(
  "/invoices/:id/pay",
  requireRole("superadmin"),
  async (req, res) => {
    const id = parseInt(String(req.params["id"]));
    const body = req.body as { method?: string };
    const [updated] = await db
      .update(invoicesTable)
      .set({
        status: "paid",
        paidAt: new Date(),
        paidMethod: body.method ?? "manual",
      })
      .where(eq(invoicesTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    const overdue = await db
      .select({ id: invoicesTable.id })
      .from(invoicesTable)
      .where(
        and(
          eq(invoicesTable.schoolId, updated.schoolId),
          eq(invoicesTable.status, "overdue"),
        ),
      )
      .limit(1);
    if (!overdue.length) {
      await db
        .update(subscriptionsTable)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(subscriptionsTable.schoolId, updated.schoolId));
      const [school] = await db
        .select()
        .from(schoolsTable)
        .where(eq(schoolsTable.id, updated.schoolId))
        .limit(1);
      if (school?.isPaused) {
        await db
          .update(schoolsTable)
          .set({ isPaused: false, pauseMessage: "" })
          .where(eq(schoolsTable.id, updated.schoolId));
      }
    }
    res.json(updated);
  },
);

// Mark a previously-paid invoice as unpaid (e.g. payment bounced / refunded)
router.post(
  "/invoices/:id/unpay",
  requireRole("superadmin"),
  async (req, res) => {
    const id = parseInt(String(req.params["id"]));
    const [inv] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, id))
      .limit(1);
    if (!inv) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const newStatus = inv.dueDate < today ? "overdue" : "pending";
    const [updated] = await db
      .update(invoicesTable)
      .set({ status: newStatus, paidAt: null, paidMethod: "" })
      .where(eq(invoicesTable.id, id))
      .returning();
    res.json(updated);
  },
);

router.post(
  "/invoices/:id/void",
  requireRole("superadmin"),
  async (req, res) => {
    const id = parseInt(String(req.params["id"]));
    const [updated] = await db
      .update(invoicesTable)
      .set({ status: "void" })
      .where(eq(invoicesTable.id, id))
      .returning();
    res.json(updated);
  },
);

router.post(
  "/invoices/:id/remind",
  requireRole("superadmin"),
  async (req, res) => {
    const id = parseInt(String(req.params["id"]));
    const channels =
      (req.body?.channels as Channel[] | undefined) ??
      (["email", "sms", "whatsapp", "inbox"] as Channel[]);
    try {
      const logs = await sendRemindersForInvoice(id, channels);
      res.status(201).json(logs);
    } catch (err) {
      res
        .status(404)
        .json({ error: err instanceof Error ? err.message : "Failed" });
    }
  },
);

router.get("/reminders", requireRole("superadmin", "school_admin", "sub_admin"), async (req, res) => {
  const conds = [];
  if (req.session.role !== "superadmin") {
    if (!req.session.schoolId) {
      res.json([]);
      return;
    }
    conds.push(eq(reminderLogTable.schoolId, req.session.schoolId));
  }
  if (req.query["invoiceId"]) {
    conds.push(
      eq(reminderLogTable.invoiceId, parseInt(String(req.query["invoiceId"]))),
    );
  }
  const rows = conds.length
    ? await db
        .select()
        .from(reminderLogTable)
        .where(and(...conds))
        .orderBy(desc(reminderLogTable.createdAt))
    : await db
        .select()
        .from(reminderLogTable)
        .orderBy(desc(reminderLogTable.createdAt));
  res.json(rows);
});

// ── BILLING CYCLE (manual triggers) ────────────────────────────────────────
router.post(
  "/billing/run-cycle",
  requireRole("superadmin"),
  async (_req, res) => {
    res.json(await runBillingCycle());
  },
);

router.post(
  "/billing/mark-overdue",
  requireRole("superadmin"),
  async (_req, res) => {
    await markOverdueInvoices();
    const suspended = await suspendPastDueSchools();
    res.json({ ok: true, suspended });
  },
);

export default router;
