import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'va']);
export const sourcingStatusEnum = pgEnum('sourcing_status', ['new', 'under_review', 'winner', 'no_go']);
export const purchaseStatusEnum = pgEnum('purchase_status', ['planned', 'ordered', 'received', 'shipped']);
export const listingStatusEnum = pgEnum('listing_status', ['draft', 'pending', 'live', 'error']);

// User storage table.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role").default('va').notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sourcing table (Google Sheets integration)
export const sourcing = pgTable("sourcing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  datum: timestamp("datum"),
  imageUrl: text("image_url"),
  brand: varchar("brand"),
  productName: text("product_name").notNull(),
  asin: varchar("asin").notNull(),
  eanBarcode: varchar("ean_barcode"),
  sourceUrl: text("source_url"),
  amazonUrl: text("amazon_url"),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }).notNull(),
  salePrice: decimal("sale_price", { precision: 10, scale: 2 }).notNull(),
  buyBoxAverage90Days: decimal("buy_box_average_90_days", { precision: 10, scale: 2 }),
  profit: decimal("profit", { precision: 10, scale: 2 }),
  profitMargin: decimal("profit_margin", { precision: 5, scale: 2 }),
  roi: decimal("roi", { precision: 5, scale: 2 }),
  estimatedSales: integer("estimated_sales"),
  fbaSellerCount: integer("fba_seller_count"),
  fbmSellerCount: integer("fbm_seller_count"),
  productReview: decimal("product_review", { precision: 2, scale: 1 }),
  notes: text("notes"),
  sourcingMethod: varchar("sourcing_method"),
  status: sourcingStatusEnum("status").default('new').notNull(),
  submittedBy: varchar("submitted_by").references(() => users.id).notNull(),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Purchasing plans table (for Winner sourcing items)
export const purchasingPlans = pgTable("purchasing_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourcingId: varchar("sourcing_id").references(() => sourcing.id).notNull(),
  plannedQuantity: integer("planned_quantity").notNull(),
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 2 }).notNull(),
  plannedBudget: decimal("planned_budget", { precision: 12, scale: 2 }).notNull(),
  expectedRevenue: decimal("expected_revenue", { precision: 12, scale: 2 }),
  expectedProfit: decimal("expected_profit", { precision: 12, scale: 2 }),
  actualSpent: decimal("actual_spent", { precision: 12, scale: 2 }).default('0'),
  actualRevenue: decimal("actual_revenue", { precision: 12, scale: 2 }).default('0'),
  actualProfit: decimal("actual_profit", { precision: 12, scale: 2 }).default('0'),
  status: purchaseStatusEnum("status").default('planned').notNull(),
  orderDate: timestamp("order_date"),
  receivedDate: timestamp("received_date"),
  weeklyBudgetAllocated: decimal("weekly_budget_allocated", { precision: 12, scale: 2 }),
  marginWarning: boolean("margin_warning").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Listings table (SKU Management & API Integration)
export const listings = pgTable("listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourcingId: varchar("sourcing_id").references(() => sourcing.id).notNull(),
  purchasingId: varchar("purchasing_id").references(() => purchasingPlans.id),
  skuCode: varchar("sku_code", { length: 40 }).unique().notNull(),
  brand: varchar("brand").notNull(),
  buyPrice: decimal("buy_price", { precision: 10, scale: 2 }).notNull(),
  asin: varchar("asin").notNull(),
  generatedDate: varchar("generated_date", { length: 6 }), // DDMMYY format
  amazonSyncStatus: listingStatusEnum("amazon_sync_status").default('draft'),
  prepMyBusinessSyncStatus: listingStatusEnum("prep_my_business_sync_status").default('draft'),
  amazonListingUrl: text("amazon_listing_url"),
  prepMyBusinessJobId: varchar("prep_my_business_job_id"),
  lastSyncAt: timestamp("last_sync_at"),
  csvExported: boolean("csv_exported").default(false),
  csvExportedAt: timestamp("csv_exported_at"),
  syncErrors: text("sync_errors"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Activity log table
export const activityLog = pgTable("activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  action: varchar("action").notNull(),
  entityType: varchar("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sourcingSubmitted: many(sourcing, { relationName: "submittedSourcing" }),
  sourcingReviewed: many(sourcing, { relationName: "reviewedSourcing" }),
  activities: many(activityLog),
}));

export const sourcingRelations = relations(sourcing, ({ one, many }) => ({
  submitter: one(users, {
    fields: [sourcing.submittedBy],
    references: [users.id],
    relationName: "submittedSourcing",
  }),
  reviewer: one(users, {
    fields: [sourcing.reviewedBy],
    references: [users.id],
    relationName: "reviewedSourcing",
  }),
  purchasingPlans: many(purchasingPlans),
  listings: many(listings),
}));

export const purchasingPlansRelations = relations(purchasingPlans, ({ one, many }) => ({
  sourcing: one(sourcing, {
    fields: [purchasingPlans.sourcingId],
    references: [sourcing.id],
  }),
  listings: many(listings),
}));

export const listingsRelations = relations(listings, ({ one }) => ({
  sourcing: one(sourcing, {
    fields: [listings.sourcingId],
    references: [sourcing.id],
  }),
  purchasing: one(purchasingPlans, {
    fields: [listings.purchasingId],
    references: [purchasingPlans.id],
  }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  user: one(users, {
    fields: [activityLog.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSourcingSchema = createInsertSchema(sourcing).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  reviewedAt: true,
  reviewedBy: true,
  reviewNotes: true,
});

export const insertPurchasingPlanSchema = createInsertSchema(purchasingPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertListingSchema = createInsertSchema(listings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLog).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Sourcing = typeof sourcing.$inferSelect;
export type PurchasingPlan = typeof purchasingPlans.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type ActivityLog = typeof activityLog.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertSourcing = z.infer<typeof insertSourcingSchema>;
export type InsertPurchasingPlan = z.infer<typeof insertPurchasingPlanSchema>;
export type InsertListing = z.infer<typeof insertListingSchema>;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

// Extended types with relations
export type SourcingWithRelations = Sourcing & {
  submitter?: User;
  reviewer?: User;
  purchasingPlans?: PurchasingPlan[];
  listings?: Listing[];
};

export type PurchasingPlanWithRelations = PurchasingPlan & {
  sourcing?: Sourcing;
  listings?: Listing[];
};

export type ListingWithRelations = Listing & {
  sourcing?: Sourcing;
  purchasing?: PurchasingPlan;
};

export type UserWithStats = User & {
  totalSourcing?: number;
  winnerSourcing?: number;
  successRate?: number;
  avgProfit?: number;
};
