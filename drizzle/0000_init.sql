CREATE TYPE "public"."asset_kind" AS ENUM('email', 'domain');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"kind" "asset_kind" NOT NULL,
	"value" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_scanned_on" date
);
--> statement-breakpoint
CREATE TABLE "breaches" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"domain" text,
	"breach_date" date NOT NULL,
	"added_date" date NOT NULL,
	"pwn_count" bigint NOT NULL,
	"data_classes" text[] NOT NULL,
	"description" text NOT NULL,
	"severity" "severity" NOT NULL,
	CONSTRAINT "breaches_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "exposures" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"asset_id" integer NOT NULL,
	"breach_id" integer NOT NULL,
	"email_hash" text NOT NULL,
	"email_masked" text NOT NULL,
	"severity" "severity" NOT NULL,
	"detected_on" date NOT NULL,
	"due_on" date NOT NULL,
	"resolved_on" date,
	"steps_done" text[] DEFAULT '{}' NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leak_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"email_hash" text NOT NULL,
	"email_masked" text NOT NULL,
	"email_domain" text NOT NULL,
	"breach_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"ran_on" date NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assets_checked" integer NOT NULL,
	"records_matched" integer NOT NULL,
	"new_exposures" integer NOT NULL,
	"used_live_api" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exposures" ADD CONSTRAINT "exposures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exposures" ADD CONSTRAINT "exposures_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exposures" ADD CONSTRAINT "exposures_breach_id_breaches_id_fk" FOREIGN KEY ("breach_id") REFERENCES "public"."breaches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leak_records" ADD CONSTRAINT "leak_records_breach_id_breaches_id_fk" FOREIGN KEY ("breach_id") REFERENCES "public"."breaches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_user_kind_value" ON "assets" USING btree ("user_id","kind","value");--> statement-breakpoint
CREATE UNIQUE INDEX "exposures_user_breach_email" ON "exposures" USING btree ("user_id","breach_id","email_hash");--> statement-breakpoint
CREATE INDEX "exposures_user" ON "exposures" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leak_records_hash_breach" ON "leak_records" USING btree ("email_hash","breach_id");--> statement-breakpoint
CREATE INDEX "leak_records_domain" ON "leak_records" USING btree ("email_domain");