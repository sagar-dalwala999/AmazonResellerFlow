import {
  users,
  products,
  deals,
  purchasingPlans,
  skus,
  activityLog,
  type User,
  type UpsertUser,
  type Product,
  type Deal,
  type DealWithRelations,
  type PurchasingPlan,
  type Sku,
  type ActivityLog,
  type InsertProduct,
  type InsertDeal,
  type InsertPurchasingPlan,
  type InsertSku,
  type InsertActivityLog,
  type UserWithStats,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, count, and, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUserStats(userId: string): Promise<UserWithStats | undefined>;

  // Product operations
  getProduct(id: string): Promise<Product | undefined>;
  getProductByAsin(asin: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;

  // Deal operations
  createDeal(deal: InsertDeal): Promise<Deal>;
  getDeals(options?: { status?: string; submittedBy?: string; limit?: number }): Promise<DealWithRelations[]>;
  getDeal(id: string): Promise<DealWithRelations | undefined>;
  updateDealStatus(id: string, status: string, reviewedBy?: string, reviewNotes?: string): Promise<void>;
  getDealStats(): Promise<{
    total: number;
    submitted: number;
    reviewing: number;
    approved: number;
    winner: number;
  }>;

  // Purchasing operations
  createPurchasingPlan(plan: InsertPurchasingPlan): Promise<PurchasingPlan>;
  getPurchasingPlans(options?: { status?: string; limit?: number }): Promise<PurchasingPlan[]>;

  // SKU operations
  createSku(sku: InsertSku): Promise<Sku>;
  getSkus(options?: { limit?: number }): Promise<Sku[]>;
  updateSkuSyncStatus(id: string, amazonStatus?: boolean, prepMyBusinessStatus?: boolean): Promise<void>;

  // Activity log operations
  logActivity(activity: InsertActivityLog): Promise<void>;
  getRecentActivities(limit?: number): Promise<ActivityLog[]>;

  // Dashboard data
  getKpiData(): Promise<{
    activeDeals: number;
    winnerProducts: number;
    monthlyProfit: number;
    availableBudget: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUserStats(userId: string): Promise<UserWithStats | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;

    const dealStats = await db
      .select({
        total: count(),
        approved: count(sql`CASE WHEN ${deals.status} = 'approved' THEN 1 END`),
        winner: count(sql`CASE WHEN ${deals.status} = 'winner' THEN 1 END`),
      })
      .from(deals)
      .where(eq(deals.submittedBy, userId));

    return {
      ...user,
      totalDeals: dealStats[0]?.total || 0,
      approvedDeals: dealStats[0]?.approved || 0,
      winnerDeals: dealStats[0]?.winner || 0,
    };
  }

  // Product operations
  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProductByAsin(asin: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.asin, asin));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  // Deal operations
  async createDeal(deal: InsertDeal): Promise<Deal> {
    const [newDeal] = await db.insert(deals).values(deal).returning();
    return newDeal;
  }

  async getDeals(options: { status?: string; submittedBy?: string; limit?: number } = {}): Promise<DealWithRelations[]> {
    const { status, submittedBy, limit = 50 } = options;

    let query = db
      .select()
      .from(deals)
      .leftJoin(products, eq(deals.productId, products.id))
      .leftJoin(users, eq(deals.submittedBy, users.id))
      .orderBy(desc(deals.createdAt))
      .limit(limit);

    if (status) {
      query = query.where(eq(deals.status, status as any));
    }

    if (submittedBy) {
      query = query.where(eq(deals.submittedBy, submittedBy));
    }

    const results = await query;

    return results.map(row => ({
      ...row.deals,
      product: row.products || undefined,
      submitter: row.users || undefined,
    }));
  }

  async getDeal(id: string): Promise<DealWithRelations | undefined> {
    const [result] = await db
      .select()
      .from(deals)
      .leftJoin(products, eq(deals.productId, products.id))
      .leftJoin(users, eq(deals.submittedBy, users.id))
      .where(eq(deals.id, id));

    if (!result) return undefined;

    return {
      ...result.deals,
      product: result.products || undefined,
      submitter: result.users || undefined,
    };
  }

  async updateDealStatus(id: string, status: string, reviewedBy?: string, reviewNotes?: string): Promise<void> {
    await db
      .update(deals)
      .set({
        status: status as any,
        reviewedBy,
        reviewNotes,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(deals.id, id));
  }

  async getDealStats(): Promise<{
    total: number;
    submitted: number;
    reviewing: number;
    approved: number;
    winner: number;
  }> {
    const stats = await db
      .select({
        total: count(),
        submitted: count(sql`CASE WHEN ${deals.status} = 'submitted' THEN 1 END`),
        reviewing: count(sql`CASE WHEN ${deals.status} = 'reviewing' THEN 1 END`),
        approved: count(sql`CASE WHEN ${deals.status} = 'approved' THEN 1 END`),
        winner: count(sql`CASE WHEN ${deals.status} = 'winner' THEN 1 END`),
      })
      .from(deals);

    return stats[0] || { total: 0, submitted: 0, reviewing: 0, approved: 0, winner: 0 };
  }

  // Purchasing operations
  async createPurchasingPlan(plan: InsertPurchasingPlan): Promise<PurchasingPlan> {
    const [newPlan] = await db.insert(purchasingPlans).values(plan).returning();
    return newPlan;
  }

  async getPurchasingPlans(options: { status?: string; limit?: number } = {}): Promise<PurchasingPlan[]> {
    const { status, limit = 50 } = options;

    let query = db
      .select()
      .from(purchasingPlans)
      .orderBy(desc(purchasingPlans.createdAt))
      .limit(limit);

    if (status) {
      query = query.where(eq(purchasingPlans.status, status as any));
    }

    return await query;
  }

  // SKU operations
  async createSku(sku: InsertSku): Promise<Sku> {
    const [newSku] = await db.insert(skus).values(sku).returning();
    return newSku;
  }

  async getSkus(options: { limit?: number } = {}): Promise<Sku[]> {
    const { limit = 50 } = options;
    return await db
      .select()
      .from(skus)
      .orderBy(desc(skus.createdAt))
      .limit(limit);
  }

  async updateSkuSyncStatus(id: string, amazonStatus?: boolean, prepMyBusinessStatus?: boolean): Promise<void> {
    const updates: any = { updatedAt: new Date() };
    
    if (amazonStatus !== undefined) {
      updates.amazonSyncStatus = amazonStatus;
    }
    
    if (prepMyBusinessStatus !== undefined) {
      updates.prepMyBusinessSyncStatus = prepMyBusinessStatus;
    }
    
    if (amazonStatus || prepMyBusinessStatus) {
      updates.lastSyncAt = new Date();
    }

    await db.update(skus).set(updates).where(eq(skus.id, id));
  }

  // Activity log operations
  async logActivity(activity: InsertActivityLog): Promise<void> {
    await db.insert(activityLog).values(activity);
  }

  async getRecentActivities(limit: number = 20): Promise<ActivityLog[]> {
    return await db
      .select()
      .from(activityLog)
      .orderBy(desc(activityLog.createdAt))
      .limit(limit);
  }

  // Dashboard data
  async getKpiData(): Promise<{
    activeDeals: number;
    winnerProducts: number;
    monthlyProfit: number;
    availableBudget: number;
  }> {
    const dealStats = await this.getDealStats();
    
    // Calculate monthly profit (simplified calculation)
    const winnerDeals = await db
      .select({
        profit: sql<number>`SUM(CAST(${deals.sellPrice} - ${deals.buyPrice} AS NUMERIC))`,
      })
      .from(deals)
      .where(and(
        eq(deals.status, 'winner'),
        sql`${deals.createdAt} >= date_trunc('month', current_date)`
      ));

    const monthlyProfit = winnerDeals[0]?.profit || 0;

    return {
      activeDeals: dealStats.submitted + dealStats.reviewing,
      winnerProducts: dealStats.winner,
      monthlyProfit: Number(monthlyProfit),
      availableBudget: 156750, // This could be calculated based on actual budget tracking
    };
  }
}

export const storage = new DatabaseStorage();
