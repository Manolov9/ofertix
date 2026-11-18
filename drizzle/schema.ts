import { double, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const catalogStores = mysqlTable("catalog_stores", {
  id: varchar("id", { length: 32 }).primaryKey(),
  displayOrder: int("displayOrder").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  logo: text("logo").notNull(),
  active: int("active").notNull().default(1),
});

export const catalogBrochures = mysqlTable("catalog_brochures", {
  id: varchar("id", { length: 80 }).primaryKey(),
  storeId: varchar("storeId", { length: 32 }).notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  period: mysqlEnum("period", ["this-week", "next-week", "ended"]).notNull(),
  rawDate: text("rawDate").notNull(),
  thumbnailUrl: text("thumbnailUrl"),
  pageUrls: text("pageUrls").notNull(),
});

export const catalogSync = mysqlTable("catalog_sync", {
  id: int("id").primaryKey(),
  activeRunId: varchar("activeRunId", { length: 64 }),
  status: mysqlEnum("status", ["idle", "running", "success", "error"]).notNull(),
  stage: text("stage").notNull(),
  startedAt: timestamp("startedAt"),
  finishedAt: timestamp("finishedAt"),
  storesProcessed: int("storesProcessed").notNull().default(0),
  brochuresProcessed: int("brochuresProcessed").notNull().default(0),
  offersProcessed: int("offersProcessed").notNull().default(0),
  message: text("message").notNull(),
});

export const catalogOffers = mysqlTable("catalog_offers", {
  id: varchar("id", { length: 180 }).primaryKey(),
  runId: varchar("runId", { length: 64 }).notNull(),
  product: text("product").notNull(),
  searchText: text("searchText").notNull(),
  storeId: varchar("storeId", { length: 32 }).notNull(),
  storeName: text("storeName").notNull(),
  price: double("price"),
  currency: varchar("currency", { length: 3 }),
  priceLabel: text("priceLabel").notNull(),
  unit: varchar("unit", { length: 32 }).notNull(),
  period: mysqlEnum("period", ["this-week", "next-week", "ended"]).notNull(),
  validLabel: text("validLabel").notNull(),
  brochureUrl: text("brochureUrl").notNull(),
  pageUrl: text("pageUrl").notNull(),
  source: text("source").notNull(),
  imageUrl: text("imageUrl"),
});
