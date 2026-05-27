import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── ENUMS ─────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", [
  "superadmin",
  "school_admin",
  "sub_admin",
  "coach",
  "player",
  "parent",
]);

export const userStatusEnum = pgEnum("user_status", [
  "pending",
  "approved",
  "rejected",
  "suspended",
]);

export const fitnessEnum = pgEnum("fitness_status", [
  "fit",
  "injured",
  "recovering",
  "resting",
]);

// ─── SITE SETTINGS ─────────────────────────────────────────────────────────

export const siteSettingsTable = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  gatePassword: text("gate_password").notNull().default("Legacy2026"),
  availableSports: text("available_sports")
    .notNull()
    .default(
      "Cricket,Basketball,Volleyball,Football,Swimming,Athletics,Boxing,Badminton,Tennis,Kabaddi,Hockey,Weightlifting,Gymnastics,Archery,Cycling,Wrestling",
    ),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── SCHOOLS ───────────────────────────────────────────────────────────────

export const schoolsTable = pgTable("schools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  phone: text("phone").default(""),
  whatsappNumber: text("whatsapp_number").default(""),
  address: text("address").default(""),
  email: text("email").default(""),
  ownerName: text("owner_name").default(""),
  ownerPhone: text("owner_phone").default(""),
  ownerWhatsapp: text("owner_whatsapp").default(""),
  ownerEmail: text("owner_email").default(""),
  principalName: text("principal_name").default(""),
  logoUrl: text("logo_url").default(""),
  primaryColor: text("primary_color").default("#1a3a5c"),
  isPaused: boolean("is_paused").default(false),
  pauseMessage: text("pause_message").default(""),
  pausedAt: timestamp("paused_at"),
  isDemo: boolean("is_demo").default(false),
  demoMessage: text("demo_message").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSchoolSchema = createInsertSchema(schoolsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type School = typeof schoolsTable.$inferSelect;

// ─── SCHOOL SETTINGS ───────────────────────────────────────────────────────

export const schoolSettingsTable = pgTable("school_settings", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id")
    .notNull()
    .unique()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  enabledSports: text("enabled_sports").default(""),
  attendanceEnabled: boolean("attendance_enabled").default(true),
  registrationEnabled: boolean("registration_enabled").default(true),
  performanceEnabled: boolean("performance_enabled").default(true),
  analyticsEnabled: boolean("analytics_enabled").default(true),
  leaderboardEnabled: boolean("leaderboard_enabled").default(true),
  notificationsEnabled: boolean("notifications_enabled").default(true),
  calendarEnabled: boolean("calendar_enabled").default(true),
  messagingEnabled: boolean("messaging_enabled").default(true),
  photosEnabled: boolean("photos_enabled").default(true),
  feesEnabled: boolean("fees_enabled").default(false),
  aiEnabled: boolean("ai_enabled").default(true),
  websiteEnabled: boolean("website_enabled").default(true),
  customMessage: text("custom_message").default(""),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSchoolSettingsSchema = createInsertSchema(
  schoolSettingsTable,
).omit({ id: true, updatedAt: true });
export type InsertSchoolSettings = z.infer<typeof insertSchoolSettingsSchema>;
export type SchoolSettings = typeof schoolSettingsTable.$inferSelect;

// ─── USERS (unified) ───────────────────────────────────────────────────────

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id").references(() => schoolsTable.id, {
      onDelete: "cascade",
    }),
    role: roleEnum("role").notNull(),
    username: text("username").notNull(),
    password: text("password").notNull(),
    name: text("name").notNull(),
    email: text("email").default(""),
    phone: text("phone").default(""),
    whatsappNumber: text("whatsapp_number").default(""),
    address: text("address").default(""),
    sport: text("sport").default(""),
    status: userStatusEnum("status").default("pending"),
    admissionNumber: text("admission_number"),
    age: integer("age"),
    dateOfBirth: date("date_of_birth"),
    gender: text("gender").default(""),
    className: text("class_name").default(""),
    section: text("section").default(""),
    rollNumber: text("roll_number").default(""),
    designation: text("designation").default(""),
    playerCode: text("player_code"),
    coachCode: text("coach_code"),
    fitnessStatus: fitnessEnum("fitness_status").default("fit"),
    parentName: text("parent_name").default(""),
    parentPhone: text("parent_phone").default(""),
    parentWhatsapp: text("parent_whatsapp").default(""),
    parentEmail: text("parent_email").default(""),
    isOwner: boolean("is_owner").default(false),
    photoUrl: text("photo_url").default(""),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("users_school_username_uniq").on(table.schoolId, table.username),
    unique("users_player_code_uniq").on(table.playerCode),
    unique("users_coach_code_uniq").on(table.coachCode),
  ],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

// ─── SUB-ADMIN PERMISSIONS ─────────────────────────────────────────────────

export const subAdminPermissionsTable = pgTable("sub_admin_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  canManageCoaches: boolean("can_manage_coaches").default(false),
  canManagePlayers: boolean("can_manage_players").default(false),
  canMarkAttendance: boolean("can_mark_attendance").default(false),
  canViewReports: boolean("can_view_reports").default(false),
  canExportData: boolean("can_export_data").default(false),
  canManageSettings: boolean("can_manage_settings").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── SUPERADMIN PERMISSIONS ────────────────────────────────────────────────

export const superAdminPermissionsTable = pgTable("superadmin_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  permAnalytics: boolean("perm_analytics").default(true),
  permCertificates: boolean("perm_certificates").default(true),
  permAttendance: boolean("perm_attendance").default(true),
  permTournaments: boolean("perm_tournaments").default(true),
  permPayments: boolean("perm_payments").default(true),
  permNotifications: boolean("perm_notifications").default(true),
  permSports: boolean("perm_sports").default(true),
  permAi: boolean("perm_ai").default(true),
  permSchools: boolean("perm_schools").default(true),
  permAddSuperadmin: boolean("perm_add_superadmin").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── SPORT CONFIGS ─────────────────────────────────────────────────────────

export interface SportField {
  key: string;
  label: string;
  type: "int" | "float" | "text";
  section?: string;
  min?: number;
  auto?: boolean;
  placeholder?: string;
}

export const sportConfigsTable = pgTable("sport_configs", {
  id: serial("id").primaryKey(),
  sportName: text("sport_name").notNull().unique(),
  icon: text("icon").default("trophy"),
  fieldsJson: jsonb("fields_json").$type<SportField[]>().default([]),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SportConfig = typeof sportConfigsTable.$inferSelect;

// ─── PERFORMANCES ──────────────────────────────────────────────────────────

export const performancesTable = pgTable("performances", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  coachId: integer("coach_id").references(() => usersTable.id),
  sport: text("sport").notNull(),
  sessionType: text("session_type").default("Training"),
  sessionNotes: text("session_notes").default(""),
  customData: jsonb("custom_data")
    .$type<Record<string, string | number>>()
    .default({}),
  recordedAt: timestamp("recorded_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPerformanceSchema = createInsertSchema(
  performancesTable,
).omit({ id: true, createdAt: true });
export type InsertPerformance = z.infer<typeof insertPerformanceSchema>;
export type Performance = typeof performancesTable.$inferSelect;

// ─── ATTENDANCE ────────────────────────────────────────────────────────────

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  coachId: integer("coach_id").references(() => usersTable.id),
  attDate: date("att_date").notNull(),
  status: text("status").notNull().default("present"),
  sessionType: text("session_type").default("Training"),
  notes: text("notes").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────────

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  senderRole: text("sender_role").notNull(),
  senderId: integer("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  receiverRole: text("receiver_role").notNull(),
  receiverId: integer("receiver_id").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── SUPER ADMIN NOTES ─────────────────────────────────────────────────────

export const superAdminNotesTable = pgTable("superadmin_notes", {
  id: serial("id").primaryKey(),
  title: text("title").default(""),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── ACTIVITY LOG ──────────────────────────────────────────────────────────

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  details: text("details").default(""),
  performedBy: text("performed_by").default("system"),
  userId: integer("user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── SITE VISITS ──────────────────────────────────────────────────────────

export const siteVisitsTable = pgTable("site_visits", {
  id: serial("id").primaryKey(),
  ipAddress: text("ip_address").default(""),
  userAgent: text("user_agent").default(""),
  page: text("page").default("/"),
  role: text("role").default("guest"),
  visitedAt: timestamp("visited_at").defaultNow(),
});

// ─── TRAINING SESSIONS / CALENDAR ──────────────────────────────────────────

export const sessionsTable = pgTable("training_sessions", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  coachId: integer("coach_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  sport: text("sport").default(""),
  description: text("description").default(""),
  location: text("location").default(""),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type TrainingSession = typeof sessionsTable.$inferSelect;

// ─── MESSAGES (in-app) ─────────────────────────────────────────────────────

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schoolsTable.id, {
    onDelete: "cascade",
  }),
  senderId: integer("sender_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  receiverId: integer("receiver_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({
  id: true,
  createdAt: true,
  isRead: true,
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;

// ─── FEES / PAYMENTS ───────────────────────────────────────────────────────

export const feesTable = pgTable("fees", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  playerId: integer("player_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  currency: text("currency").default("INR"),
  description: text("description").default(""),
  dueDate: date("due_date"),
  paidAt: timestamp("paid_at"),
  status: text("status").notNull().default("pending"), // pending | paid | overdue | waived
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFeeSchema = createInsertSchema(feesTable).omit({
  id: true,
  createdAt: true,
  paidAt: true,
});
export type InsertFee = z.infer<typeof insertFeeSchema>;
export type Fee = typeof feesTable.$inferSelect;

// ─── PLATFORM SUBSCRIPTION / BILLING ───────────────────────────────────────

export const pricingConfigTable = pgTable("pricing_config", {
  id: serial("id").primaryKey(),
  baseFee: integer("base_fee").notNull().default(999),
  perPlayerFee: integer("per_player_fee").notNull().default(5),
  modAttendance: integer("mod_attendance").notNull().default(99),
  modPerformance: integer("mod_performance").notNull().default(99),
  modAnalytics: integer("mod_analytics").notNull().default(149),
  modLeaderboard: integer("mod_leaderboard").notNull().default(99),
  modCalendar: integer("mod_calendar").notNull().default(99),
  modMessaging: integer("mod_messaging").notNull().default(149),
  modPhotos: integer("mod_photos").notNull().default(99),
  modNotifications: integer("mod_notifications").notNull().default(49),
  modFees: integer("mod_fees").notNull().default(99),
  modRegistration: integer("mod_registration").notNull().default(49),
  modAi: integer("mod_ai").notNull().default(199),
  modWebsite: integer("mod_website").notNull().default(149),
  perSportFee: integer("per_sport_fee").notNull().default(29),
  currency: text("currency").notNull().default("INR"),
  gracePeriodDays: integer("grace_period_days").notNull().default(7),
  reminderDaysBefore: integer("reminder_days_before").notNull().default(3),
  autoSuspendAfterDays: integer("auto_suspend_after_days").notNull().default(15),
  upiId: text("upi_id").default(""),
  qrCodeUrl: text("qr_code_url").default(""),
  account1BankName: text("account1_bank_name").default(""),
  account1AccountNumber: text("account1_account_number").default(""),
  account1IfscCode: text("account1_ifsc_code").default(""),
  account1HolderName: text("account1_holder_name").default(""),
  account2BankName: text("account2_bank_name").default(""),
  account2AccountNumber: text("account2_account_number").default(""),
  account2IfscCode: text("account2_ifsc_code").default(""),
  account2HolderName: text("account2_holder_name").default(""),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type PricingConfig = typeof pricingConfigTable.$inferSelect;

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id")
    .notNull()
    .unique()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  planName: text("plan_name").notNull().default("Standard"),
  billingCycleDay: integer("billing_cycle_day").notNull().default(1),
  status: text("status").notNull().default("active"),
  autoBill: boolean("auto_bill").notNull().default(true),
  nextInvoiceDate: date("next_invoice_date"),
  lastInvoicedAt: timestamp("last_invoiced_at"),
  notes: text("notes").default(""),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type Subscription = typeof subscriptionsTable.$inferSelect;

export interface InvoiceLineItem {
  label: string;
  qty: number;
  unit: number;
  total: number;
}

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  invoiceNumber: text("invoice_number").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  dueDate: date("due_date").notNull(),
  lineItems: jsonb("line_items").$type<InvoiceLineItem[]>().default([]),
  subtotal: integer("subtotal").notNull().default(0),
  total: integer("total").notNull().default(0),
  currency: text("currency").notNull().default("INR"),
  status: text("status").notNull().default("pending"),
  paidAt: timestamp("paid_at"),
  paidMethod: text("paid_method").default(""),
  notes: text("notes").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});
export type Invoice = typeof invoicesTable.$inferSelect;

export const reminderLogTable = pgTable("reminder_log", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoicesTable.id, {
    onDelete: "cascade",
  }),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  recipient: text("recipient").default(""),
  subject: text("subject").default(""),
  body: text("body").notNull(),
  status: text("status").notNull().default("sent"),
  provider: text("provider").default("stub"),
  error: text("error").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});
export type ReminderLog = typeof reminderLogTable.$inferSelect;

// ─── AI DOCUMENTS (Letters + Certificates) ─────────────────────────────────

export const lettersTable = pgTable("letters", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schoolsTable.id, {
    onDelete: "cascade",
  }),
  authorId: integer("author_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  letterType: text("letter_type").notNull().default("custom"),
  prompt: text("prompt").notNull().default(""),
  recipient: text("recipient").notNull().default(""),
  subject: text("subject").notNull().default(""),
  body: text("body").notNull(),
  senderName: text("sender_name").notNull().default(""),
  senderDesignation: text("sender_designation").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
});
export type Letter = typeof lettersTable.$inferSelect;

export const certificatesTable = pgTable("certificates", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schoolsTable.id, {
    onDelete: "cascade",
  }),
  authorId: integer("author_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  playerId: integer("player_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  playerName: text("player_name").notNull().default(""),
  template: text("template").notNull().default("participation"),
  eventName: text("event_name").notNull().default(""),
  score: text("score").notNull().default(""),
  sport: text("sport").notNull().default(""),
  citation: text("citation").notNull(),
  signatoryName: text("signatory_name").notNull().default(""),
  signatoryDesignation: text("signatory_designation").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
});
export type Certificate = typeof certificatesTable.$inferSelect;

// ─── PARENT-PLAYER LINKS ────────────────────────────────────────────────────

export const parentPlayerLinksTable = pgTable(
  "parent_player_links",
  {
    id: serial("id").primaryKey(),
    parentId: integer("parent_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    playerId: integer("player_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    schoolId: integer("school_id")
      .notNull()
      .references(() => schoolsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [unique().on(t.parentId, t.playerId)],
);
export type ParentPlayerLink = typeof parentPlayerLinksTable.$inferSelect;
