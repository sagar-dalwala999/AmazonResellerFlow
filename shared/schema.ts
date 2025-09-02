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
export const dealStatusEnum = pgEnum('deal_status', ['submitted', 'reviewing', 'approved', 'rejected', 'winner']);
export const purchaseStatusEnum = pgEnum('purchase_status', ['planned', 'ordered', 'received', 'shipped']);

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

// Products table
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  asin: varchar("asin").unique().notNull(),
  productName: text("product_name").notNull(),
  category: varchar("category"),
  currentPrice: decimal("current_price", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Deals table
export const deals = pgTable("deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id),
  submittedBy: varchar("submitted_by").references(() => users.id).notNull(),
  buyPrice: decimal("buy_price", { precision: 10, scale: 2 }).notNull(),
  sellPrice: decimal("sell_price", { precision: 10, scale: 2 }).notNull(),
  profitMargin: decimal("profit_margin", { precision: 5, scale: 2 }),
  status: dealStatusEnum("status").default('submitted').notNull(),
  notes: text("notes"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Purchasing plans table
export const purchasingPlans = pgTable("purchasing_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id).notNull(),
  plannedQuantity: integer("planned_quantity").notNull(),
  plannedBudget: decimal("planned_budget", { precision: 12, scale: 2 }).notNull(),
  expectedProfit: decimal("expected_profit", { precision: 12, scale: 2 }),
  status: purchaseStatusEnum("status").default('planned').notNull(),
  orderDate: timestamp("order_date"),
  receivedDate: timestamp("received_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// SKUs table
export const skus = pgTable("skus", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id).notNull(),
  skuCode: varchar("sku_code").unique().notNull(),
  amazonSyncStatus: boolean("amazon_sync_status").default(false),
  prepMyBusinessSyncStatus: boolean("prep_my_business_sync_status").default(false),
  lastSyncAt: timestamp("last_sync_at"),
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
  dealsSubmitted: many(deals, { relationName: "submittedDeals" }),
  dealsReviewed: many(deals, { relationName: "reviewedDeals" }),
  activities: many(activityLog),
}));

export const productsRelations = relations(products, ({ many }) => ({
  deals: many(deals),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  product: one(products, {
    fields: [deals.productId],
    references: [products.id],
  }),
  submitter: one(users, {
    fields: [deals.submittedBy],
    references: [users.id],
    relationName: "submittedDeals",
  }),
  reviewer: one(users, {
    fields: [deals.reviewedBy],
    references: [users.id],
    relationName: "reviewedDeals",
  }),
  purchasingPlans: many(purchasingPlans),
  skus: many(skus),
}));

export const purchasingPlansRelations = relations(purchasingPlans, ({ one }) => ({
  deal: one(deals, {
    fields: [purchasingPlans.dealId],
    references: [deals.id],
  }),
}));

export const skusRelations = relations(skus, ({ one }) => ({
  deal: one(deals, {
    fields: [skus.dealId],
    references: [deals.id],
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

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDealSchema = createInsertSchema(deals).omit({
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

export const insertSkuSchema = createInsertSchema(skus).omit({
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
export type Product = typeof products.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type PurchasingPlan = typeof purchasingPlans.$inferSelect;
export type Sku = typeof skus.$inferSelect;
export type ActivityLog = typeof activityLog.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type InsertPurchasingPlan = z.infer<typeof insertPurchasingPlanSchema>;
export type InsertSku = z.infer<typeof insertSkuSchema>;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

// Extended types with relations
export type DealWithRelations = Deal & {
  product?: Product;
  submitter?: User;
  reviewer?: User;
  purchasingPlans?: PurchasingPlan[];
  skus?: Sku[];
};

export type UserWithStats = User & {
  totalDeals?: number;
  approvedDeals?: number;
  winnerDeals?: number;
};
