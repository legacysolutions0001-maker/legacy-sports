CREATE TYPE "public"."fitness_status" AS ENUM('fit', 'injured', 'recovering', 'resting');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('superadmin', 'school_admin', 'sub_admin', 'coach', 'player');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"details" text DEFAULT '',
	"performed_by" text DEFAULT 'system',
	"user_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"school_id" integer NOT NULL,
	"coach_id" integer,
	"att_date" date NOT NULL,
	"status" text DEFAULT 'present' NOT NULL,
	"session_type" text DEFAULT 'Training',
	"notes" text DEFAULT '',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fees" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'INR',
	"description" text DEFAULT '',
	"due_date" date,
	"paid_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer,
	"sender_id" integer NOT NULL,
	"receiver_id" integer NOT NULL,
	"body" text NOT NULL,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_role" text NOT NULL,
	"sender_id" integer NOT NULL,
	"sender_name" text NOT NULL,
	"receiver_role" text NOT NULL,
	"receiver_id" integer NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "performances" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"coach_id" integer,
	"sport" text NOT NULL,
	"session_type" text DEFAULT 'Training',
	"session_notes" text DEFAULT '',
	"custom_data" jsonb DEFAULT '{}'::jsonb,
	"recorded_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "school_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer NOT NULL,
	"enabled_sports" text DEFAULT '',
	"attendance_enabled" boolean DEFAULT true,
	"registration_enabled" boolean DEFAULT true,
	"performance_enabled" boolean DEFAULT true,
	"analytics_enabled" boolean DEFAULT true,
	"leaderboard_enabled" boolean DEFAULT true,
	"notifications_enabled" boolean DEFAULT true,
	"calendar_enabled" boolean DEFAULT true,
	"messaging_enabled" boolean DEFAULT true,
	"photos_enabled" boolean DEFAULT true,
	"fees_enabled" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "school_settings_school_id_unique" UNIQUE("school_id")
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"phone" text DEFAULT '',
	"address" text DEFAULT '',
	"email" text DEFAULT '',
	"owner_name" text DEFAULT '',
	"principal_name" text DEFAULT '',
	"logo_url" text DEFAULT '',
	"primary_color" text DEFAULT '#1a3a5c',
	"is_paused" boolean DEFAULT false,
	"pause_message" text DEFAULT '',
	"paused_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "schools_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer NOT NULL,
	"coach_id" integer,
	"title" text NOT NULL,
	"sport" text DEFAULT '',
	"description" text DEFAULT '',
	"location" text DEFAULT '',
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"gate_password" text DEFAULT 'Legacy2026' NOT NULL,
	"available_sports" text DEFAULT 'Cricket,Basketball,Volleyball,Football,Swimming,Athletics,Boxing,Badminton,Tennis,Kabaddi,Hockey,Weightlifting,Gymnastics,Archery,Cycling,Wrestling' NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "site_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip_address" text DEFAULT '',
	"user_agent" text DEFAULT '',
	"page" text DEFAULT '/',
	"role" text DEFAULT 'guest',
	"visited_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sport_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"sport_name" text NOT NULL,
	"icon" text DEFAULT 'trophy',
	"fields_json" jsonb DEFAULT '[]'::jsonb,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sport_configs_sport_name_unique" UNIQUE("sport_name")
);
--> statement-breakpoint
CREATE TABLE "sub_admin_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"can_manage_coaches" boolean DEFAULT false,
	"can_manage_players" boolean DEFAULT false,
	"can_mark_attendance" boolean DEFAULT false,
	"can_view_reports" boolean DEFAULT false,
	"can_export_data" boolean DEFAULT false,
	"can_manage_settings" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "superadmin_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text DEFAULT '',
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "superadmin_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"perm_analytics" boolean DEFAULT true,
	"perm_certificates" boolean DEFAULT true,
	"perm_attendance" boolean DEFAULT true,
	"perm_tournaments" boolean DEFAULT true,
	"perm_payments" boolean DEFAULT true,
	"perm_notifications" boolean DEFAULT true,
	"perm_sports" boolean DEFAULT true,
	"perm_ai" boolean DEFAULT true,
	"perm_schools" boolean DEFAULT true,
	"perm_add_superadmin" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer,
	"role" "role" NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"email" text DEFAULT '',
	"phone" text DEFAULT '',
	"address" text DEFAULT '',
	"sport" text DEFAULT '',
	"status" "user_status" DEFAULT 'pending',
	"admission_number" text,
	"age" integer,
	"class_name" text DEFAULT '',
	"fitness_status" "fitness_status" DEFAULT 'fit',
	"parent_phone" text DEFAULT '',
	"parent_email" text DEFAULT '',
	"is_owner" boolean DEFAULT false,
	"photo_url" text DEFAULT '',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_school_username_uniq" UNIQUE("school_id","username")
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fees" ADD CONSTRAINT "fees_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fees" ADD CONSTRAINT "fees_player_id_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performances" ADD CONSTRAINT "performances_player_id_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performances" ADD CONSTRAINT "performances_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_settings" ADD CONSTRAINT "school_settings_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_admin_permissions" ADD CONSTRAINT "sub_admin_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "superadmin_permissions" ADD CONSTRAINT "superadmin_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;