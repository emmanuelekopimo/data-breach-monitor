import { relations } from "drizzle-orm";
import { bigint, boolean, date, index, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const severityEnum = pgEnum("severity", ["critical", "high", "medium", "low"]);
export const assetKindEnum = pgEnum("asset_kind", ["email", "domain"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Public breach catalog (from the Have I Been Pwned breach list). Shared by all users. */
export const breaches = pgTable("breaches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  title: text("title").notNull(),
  domain: text("domain"),
  breachDate: date("breach_date", { mode: "string" }).notNull(),
  addedDate: date("added_date", { mode: "string" }).notNull(),
  pwnCount: bigint("pwn_count", { mode: "number" }).notNull(),
  dataClasses: text("data_classes").array().notNull(),
  description: text("description").notNull(),
  severity: severityEnum("severity").notNull(),
});

/**
 * Threat intel leak index: which (hashed) email addresses appear in which breach.
 * Only a SHA-256 hash and a masked form of each address are stored.
 */
export const leakRecords = pgTable(
  "leak_records",
  {
    id: serial("id").primaryKey(),
    emailHash: text("email_hash").notNull(),
    emailMasked: text("email_masked").notNull(),
    emailDomain: text("email_domain").notNull(),
    breachId: integer("breach_id")
      .notNull()
      .references(() => breaches.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("leak_records_hash_breach").on(t.emailHash, t.breachId), index("leak_records_domain").on(t.emailDomain)],
);

/** An email address or domain a user monitors. */
export const assets = pgTable(
  "assets",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: assetKindEnum("kind").notNull(),
    value: text("value").notNull(),
    label: text("label").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastScannedOn: date("last_scanned_on", { mode: "string" }),
  },
  (t) => [uniqueIndex("assets_user_kind_value").on(t.userId, t.kind, t.value)],
);

/** A finding: one monitored identity found in one breach, with a remediation deadline. */
export const exposures = pgTable(
  "exposures",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assetId: integer("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    breachId: integer("breach_id")
      .notNull()
      .references(() => breaches.id, { onDelete: "cascade" }),
    emailHash: text("email_hash").notNull(),
    emailMasked: text("email_masked").notNull(),
    severity: severityEnum("severity").notNull(),
    detectedOn: date("detected_on", { mode: "string" }).notNull(),
    dueOn: date("due_on", { mode: "string" }).notNull(),
    resolvedOn: date("resolved_on", { mode: "string" }),
    stepsDone: text("steps_done").array().notNull().default([]),
    notes: text("notes").notNull().default(""),
  },
  (t) => [uniqueIndex("exposures_user_breach_email").on(t.userId, t.breachId, t.emailHash), index("exposures_user").on(t.userId)],
);

/** Audit log of scans. */
export const scans = pgTable("scans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  ranOn: date("ran_on", { mode: "string" }).notNull(),
  ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
  assetsChecked: integer("assets_checked").notNull(),
  recordsMatched: integer("records_matched").notNull(),
  newExposures: integer("new_exposures").notNull(),
  usedLiveApi: boolean("used_live_api").notNull().default(false),
});

export const assetsRelations = relations(assets, ({ many, one }) => ({
  exposures: many(exposures),
  user: one(users, { fields: [assets.userId], references: [users.id] }),
}));

export const exposuresRelations = relations(exposures, ({ one }) => ({
  asset: one(assets, { fields: [exposures.assetId], references: [assets.id] }),
  breach: one(breaches, { fields: [exposures.breachId], references: [breaches.id] }),
}));

export type User = typeof users.$inferSelect;
export type Breach = typeof breaches.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Exposure = typeof exposures.$inferSelect;
export type Scan = typeof scans.$inferSelect;
