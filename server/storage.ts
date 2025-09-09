import {
  users,
  sourcing,
  sourcingItems,
  purchasingPlans,
  listings,
  activityLog,
  type User,
  type UpsertUser,
  type Sourcing,
  type SourcingWithRelations,
  type SourcingItem,
  type InsertSourcingItem,
  type PurchasingPlan,
  type PurchasingPlanWithRelations,
  type Listing,
  type ListingWithRelations,
  type ActivityLog,
  type InsertSourcing,
  type InsertPurchasingPlan,
  type InsertListing,
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

  // Sourcing operations (Google Sheets data)
  createSourcing(sourcing: InsertSourcing): Promise<Sourcing>;
  getSourcing(options?: { status?: string; submittedBy?: string; limit?: number }): Promise<SourcingWithRelations[]>;
  getSourcingItem(id: string): Promise<SourcingWithRelations | undefined>;
  getSourcingByAsin(asin: string): Promise<SourcingWithRelations | undefined>;
  updateSourcingStatus(id: string, status: string, reviewedBy?: string, reviewNotes?: string): Promise<void>;
  getSourcingStats(): Promise<{
    total: number;
    new: number;
    under_review: number;
    winner: number;
    no_go: number;
  }>;

  // Purchasing operations
  createPurchasingPlan(plan: InsertPurchasingPlan): Promise<PurchasingPlan>;
  getPurchasingPlans(options?: { status?: string; limit?: number }): Promise<PurchasingPlanWithRelations[]>;
  updatePurchasingPlan(id: string, updates: Partial<PurchasingPlan>): Promise<void>;

  // Listing operations (SKU management)
  createListing(listing: InsertListing): Promise<Listing>;
  getListings(options?: { status?: string; limit?: number }): Promise<ListingWithRelations[]>;
  updateListingStatus(id: string, amazonStatus?: string, prepMyBusinessStatus?: string): Promise<void>;
  generateSKU(brand: string, buyPrice: number, asin: string): string;

  // Activity log operations
  logActivity(activity: InsertActivityLog): Promise<void>;
  getRecentActivities(limit?: number): Promise<ActivityLog[]>;

  // Sourcing Items operations (database storage with archive)
  saveSourcingItem(item: InsertSourcingItem): Promise<SourcingItem>;
  getSourcingItems(showArchived?: boolean): Promise<SourcingItem[]>;
  archiveSourcingItem(rowIndex: number): Promise<void>;
  deleteSourcingItem(rowIndex: number): Promise<void>;
  upsertSourcingItems(items: InsertSourcingItem[]): Promise<void>;

  // Dashboard data
  getKpiData(): Promise<{
    activeSourcing: number;
    winnerProducts: number;
    monthlyProfit: number;
    availableBudget: number;
  }>;

  // VA Performance data
  getVAPerformance(userId: string, weeks?: number): Promise<{
    weeklyStats: Array<{
      week: string;
      avgProfit: number;
      deals: number;
      winners: number;
      successRate: number;
      profit: number;
    }>;
    totalStats: {
      avgProfit: number;
      totalDeals: number;
      totalWinners: number;
      successRate: number;
      totalProfit: number;
    };
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

    const sourcingStats = await db
      .select({
        total: count(),
        winners: count(sql`CASE WHEN ${sourcing.status} = 'winner' THEN 1 END`),
      })
      .from(sourcing)
      .where(eq(sourcing.submittedBy, userId));

    const avgProfitResult = await db
      .select({
        avgProfit: sql<number>`AVG(CAST(${sourcing.profit} AS NUMERIC))`,
      })
      .from(sourcing)
      .where(and(
        eq(sourcing.submittedBy, userId),
        eq(sourcing.status, 'winner')
      ));

    const totalSourcing = sourcingStats[0]?.total || 0;
    const winnerSourcing = sourcingStats[0]?.winners || 0;
    const successRate = totalSourcing > 0 ? (winnerSourcing / totalSourcing) * 100 : 0;
    const avgProfit = avgProfitResult[0]?.avgProfit || 0;

    return {
      ...user,
      totalSourcing,
      winnerSourcing,
      successRate,
      avgProfit: Number(avgProfit),
    };
  }

  // Sourcing operations
  async createSourcing(sourcingData: InsertSourcing): Promise<Sourcing> {
    const [newSourcing] = await db.insert(sourcing).values(sourcingData).returning();
    return newSourcing;
  }

  async getSourcing(options: { status?: string; submittedBy?: string; limit?: number } = {}): Promise<SourcingWithRelations[]> {
    const { status, submittedBy, limit = 50 } = options;

    const conditions = [];
    if (status) {
      conditions.push(eq(sourcing.status, status as any));
    }
    if (submittedBy) {
      conditions.push(eq(sourcing.submittedBy, submittedBy));
    }

    const baseQuery = db
      .select()
      .from(sourcing)
      .leftJoin(users, eq(sourcing.submittedBy, users.id))
      .orderBy(desc(sourcing.createdAt))
      .limit(limit);
    
    const results = conditions.length > 0 
      ? await baseQuery.where(and(...conditions))
      : await baseQuery;

    return results.map(row => ({
      ...row.sourcing,
      submitter: row.users || undefined,
    }));
  }

  async getSourcingItem(id: string): Promise<SourcingWithRelations | undefined> {
    const [result] = await db
      .select()
      .from(sourcing)
      .leftJoin(users, eq(sourcing.submittedBy, users.id))
      .where(eq(sourcing.id, id));

    if (!result) return undefined;

    return {
      ...result.sourcing,
      submitter: result.users || undefined,
    };
  }

  async getSourcingByAsin(asin: string): Promise<SourcingWithRelations | undefined> {
    const [result] = await db
      .select()
      .from(sourcing)
      .leftJoin(users, eq(sourcing.submittedBy, users.id))
      .where(eq(sourcing.asin, asin));

    if (!result) return undefined;

    return {
      ...result.sourcing,
      submitter: result.users || undefined,
    };
  }

  async updateSourcingStatus(id: string, status: string, reviewedBy?: string, reviewNotes?: string): Promise<void> {
    await db
      .update(sourcing)
      .set({
        status: status as any,
        reviewedBy,
        reviewNotes,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sourcing.id, id));
  }

  async getSourcingStats(): Promise<{
    total: number;
    new: number;
    under_review: number;
    winner: number;
    no_go: number;
  }> {
    const stats = await db
      .select({
        total: count(),
        new: count(sql`CASE WHEN ${sourcing.status} = 'new' THEN 1 END`),
        under_review: count(sql`CASE WHEN ${sourcing.status} = 'under_review' THEN 1 END`),
        winner: count(sql`CASE WHEN ${sourcing.status} = 'winner' THEN 1 END`),
        no_go: count(sql`CASE WHEN ${sourcing.status} = 'no_go' THEN 1 END`),
      })
      .from(sourcing);

    return stats[0] || { total: 0, new: 0, under_review: 0, winner: 0, no_go: 0 };
  }

  // Purchasing operations
  async createPurchasingPlan(plan: InsertPurchasingPlan): Promise<PurchasingPlan> {
    const [newPlan] = await db.insert(purchasingPlans).values(plan).returning();
    return newPlan;
  }

  async getPurchasingPlans(options: { status?: string; limit?: number } = {}): Promise<PurchasingPlanWithRelations[]> {
    const { status, limit = 50 } = options;

    const baseQuery = db
      .select()
      .from(purchasingPlans)
      .leftJoin(sourcing, eq(purchasingPlans.sourcingId, sourcing.id))
      .orderBy(desc(purchasingPlans.createdAt))
      .limit(limit);

    const results = status 
      ? await baseQuery.where(eq(purchasingPlans.status, status as any))
      : await baseQuery;

    return results.map(row => ({
      ...row.purchasing_plans,
      sourcing: row.sourcing || undefined,
    }));
  }

  async updatePurchasingPlan(id: string, updates: Partial<PurchasingPlan>): Promise<void> {
    await db
      .update(purchasingPlans)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(purchasingPlans.id, id));
  }

  // Listing operations
  async createListing(listingData: InsertListing): Promise<Listing> {
    const [newListing] = await db.insert(listings).values(listingData).returning();
    return newListing;
  }

  async getListings(options: { status?: string; limit?: number } = {}): Promise<ListingWithRelations[]> {
    const { limit = 50 } = options;

    const results = await db
      .select()
      .from(listings)
      .leftJoin(sourcing, eq(listings.sourcingId, sourcing.id))
      .leftJoin(purchasingPlans, eq(listings.purchasingId, purchasingPlans.id))
      .orderBy(desc(listings.createdAt))
      .limit(limit);

    return results.map(row => ({
      ...row.listings,
      sourcing: row.sourcing || undefined,
      purchasing: row.purchasing_plans || undefined,
    }));
  }

  async updateListingStatus(id: string, amazonStatus?: string, prepMyBusinessStatus?: string): Promise<void> {
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

    await db.update(listings).set(updates).where(eq(listings.id, id));
  }

  generateSKU(brand: string, buyPrice: number, asin: string): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '').slice(0, 6); // DDMMYY format
    const formattedPrice = buyPrice.toFixed(2);
    
    let truncatedBrand = brand.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    
    // Calculate max brand length to stay under 40 chars total
    const baseLength = formattedPrice.length + 1 + dateStr.length + 1 + asin.length + 2; // +2 for underscores
    const maxBrandLength = 40 - baseLength;
    
    if (truncatedBrand.length > maxBrandLength) {
      truncatedBrand = truncatedBrand.substring(0, maxBrandLength);
    }
    
    return `${truncatedBrand}_${formattedPrice}_${dateStr}_${asin}`;
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
    activeSourcing: number;
    winnerProducts: number;
    monthlyProfit: number;
    availableBudget: number;
  }> {
    const sourcingStats = await this.getSourcingStats();
    
    // Calculate monthly profit from winner sourcing items
    const winnerProfit = await db
      .select({
        profit: sql<number>`SUM(CAST(${sourcing.profit} AS NUMERIC))`,
      })
      .from(sourcing)
      .where(and(
        eq(sourcing.status, 'winner'),
        sql`${sourcing.createdAt} >= date_trunc('month', current_date)`
      ));

    const monthlyProfit = winnerProfit[0]?.profit || 0;

    return {
      activeSourcing: sourcingStats.new + sourcingStats.under_review,
      winnerProducts: sourcingStats.winner,
      monthlyProfit: Number(monthlyProfit),
      availableBudget: 156750, // This could be calculated based on actual budget tracking
    };
  }

  // VA Performance data
  async getVAPerformance(userId: string, weeks: number = 4): Promise<{
    weeklyStats: Array<{
      week: string;
      avgProfit: number;
      deals: number;
      winners: number;
      successRate: number;
      profit: number;
    }>;
    totalStats: {
      avgProfit: number;
      totalDeals: number;
      totalWinners: number;
      successRate: number;
      totalProfit: number;
    };
  }> {
    // Get weekly stats for the last N weeks
    const weeklyStats = [];
    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i * 7));
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const weekData = await db
        .select({
          deals: count(),
          winners: count(sql`CASE WHEN ${sourcing.status} = 'winner' THEN 1 END`),
          profit: sql<number>`SUM(CAST(${sourcing.profit} AS NUMERIC))`,
          avgProfit: sql<number>`AVG(CAST(${sourcing.profit} AS NUMERIC))`,
        })
        .from(sourcing)
        .where(and(
          eq(sourcing.submittedBy, userId),
          sql`${sourcing.createdAt} >= ${weekStart.toISOString()}`,
          sql`${sourcing.createdAt} <= ${weekEnd.toISOString()}`
        ));

      const deals = weekData[0]?.deals || 0;
      const winners = weekData[0]?.winners || 0;
      const profit = weekData[0]?.profit || 0;
      const avgProfit = weekData[0]?.avgProfit || 0;
      const successRate = deals > 0 ? (winners / deals) * 100 : 0;

      weeklyStats.push({
        week: `KW ${Math.ceil((weekStart.getDate()) / 7)}`,
        avgProfit: Number(avgProfit),
        deals,
        winners,
        successRate,
        profit: Number(profit),
      });
    }

    // Get total stats
    const totalData = await db
      .select({
        deals: count(),
        winners: count(sql`CASE WHEN ${sourcing.status} = 'winner' THEN 1 END`),
        profit: sql<number>`SUM(CAST(${sourcing.profit} AS NUMERIC))`,
        avgProfit: sql<number>`AVG(CAST(${sourcing.profit} AS NUMERIC))`,
      })
      .from(sourcing)
      .where(eq(sourcing.submittedBy, userId));

    const totalDeals = totalData[0]?.deals || 0;
    const totalWinners = totalData[0]?.winners || 0;
    const totalProfit = totalData[0]?.profit || 0;
    const avgProfit = totalData[0]?.avgProfit || 0;
    const successRate = totalDeals > 0 ? (totalWinners / totalDeals) * 100 : 0;

    return {
      weeklyStats: weeklyStats.reverse(), // Most recent first
      totalStats: {
        avgProfit: Number(avgProfit),
        totalDeals,
        totalWinners,
        successRate,
        totalProfit: Number(totalProfit),
      },
    };
  }

  // Sourcing Items operations (database storage with archive)
  async saveSourcingItem(item: InsertSourcingItem): Promise<SourcingItem> {
    try {
      const [sourcingItem] = await db
        .insert(sourcingItems)
        .values(item)
        .onConflictDoUpdate({
          target: [sourcingItems.rowIndex],
          set: {
            ...item,
            updatedAt: new Date(),
          },
        })
        .returning();
      return sourcingItem;
    } catch (error) {
      // If conflict handling fails, try a simple insert
      console.log('Conflict handling failed, trying simple insert:', error);
      const [sourcingItem] = await db
        .insert(sourcingItems)
        .values(item)
        .returning();
      return sourcingItem;
    }
  }

  async getSourcingItems(showArchived = false): Promise<SourcingItem[]> {
    return await db
      .select()
      .from(sourcingItems)
      .where(eq(sourcingItems.archived, showArchived))
      .orderBy(desc(sourcingItems.createdAt));
  }

  async archiveSourcingItem(rowIndex: number): Promise<void> {
    await db
      .update(sourcingItems)
      .set({ archived: true, updatedAt: new Date() })
      .where(eq(sourcingItems.rowIndex, rowIndex));
  }

  async deleteSourcingItem(rowIndex: number): Promise<void> {
    await db
      .delete(sourcingItems)
      .where(eq(sourcingItems.rowIndex, rowIndex));
  }

  async upsertSourcingItems(items: InsertSourcingItem[]): Promise<void> {
    if (items.length === 0) return;
    
    console.log(`💾 Upserting ${items.length} sourcing items to database`);
    
    // Clear existing entries and insert new ones for simplicity
    await db.delete(sourcingItems).where(eq(sourcingItems.archived, false));
    
    for (const item of items) {
      try {
        await db.insert(sourcingItems).values(item);
      } catch (error) {
        console.error(`Error inserting item with ASIN ${item.asin}:`, error);
      }
    }
    
    console.log(`✅ Successfully upserted ${items.length} items`);
  }
}

export const storage = new DatabaseStorage();