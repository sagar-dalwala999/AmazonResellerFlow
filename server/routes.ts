import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertDealSchema, insertProductSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUserStats(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Deal routes
  app.post('/api/deals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const dealData = insertDealSchema.parse(req.body);

      // Create or get product
      let product = await storage.getProductByAsin(dealData.productId || '');
      if (!product && req.body.productName && req.body.asin) {
        product = await storage.createProduct({
          asin: req.body.asin,
          productName: req.body.productName,
          category: req.body.category,
        });
      }

      // Calculate profit margin
      const buyPrice = Number(dealData.buyPrice);
      const sellPrice = Number(dealData.sellPrice);
      const profitMargin = ((sellPrice - buyPrice) / sellPrice) * 100;

      const deal = await storage.createDeal({
        ...dealData,
        productId: product?.id,
        submittedBy: userId,
        profitMargin: profitMargin.toString(),
      });

      // Log activity
      await storage.logActivity({
        userId,
        action: 'deal_submitted',
        entityType: 'deal',
        entityId: deal.id,
        description: `Deal für "${req.body.productName}" eingereicht`,
      });

      res.json(deal);
    } catch (error) {
      console.error("Error creating deal:", error);
      res.status(400).json({ message: "Failed to create deal" });
    }
  });

  app.get('/api/deals', isAuthenticated, async (req: any, res) => {
    try {
      const { status, limit } = req.query;
      const userId = req.user.claims.sub;
      const userRole = req.user.claims.role || 'va';

      const options: any = {};
      if (status) options.status = status;
      if (limit) options.limit = parseInt(limit);
      
      // VAs can only see their own deals
      if (userRole === 'va') {
        options.submittedBy = userId;
      }

      const deals = await storage.getDeals(options);
      res.json(deals);
    } catch (error) {
      console.error("Error fetching deals:", error);
      res.status(500).json({ message: "Failed to fetch deals" });
    }
  });

  app.patch('/api/deals/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userRole = req.user.claims.role || 'va';
      
      // Only admins can update deal status
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { status, reviewNotes } = req.body;
      const dealId = req.params.id;

      await storage.updateDealStatus(dealId, status, userId, reviewNotes);

      // Log activity
      await storage.logActivity({
        userId,
        action: 'deal_status_updated',
        entityType: 'deal',
        entityId: dealId,
        description: `Deal Status zu "${status}" geändert`,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating deal status:", error);
      res.status(500).json({ message: "Failed to update deal status" });
    }
  });

  // Dashboard routes
  app.get('/api/dashboard/kpis', isAuthenticated, async (req, res) => {
    try {
      const kpis = await storage.getKpiData();
      res.json(kpis);
    } catch (error) {
      console.error("Error fetching KPIs:", error);
      res.status(500).json({ message: "Failed to fetch KPIs" });
    }
  });

  app.get('/api/dashboard/pipeline', isAuthenticated, async (req, res) => {
    try {
      const pipeline = await storage.getDealStats();
      res.json(pipeline);
    } catch (error) {
      console.error("Error fetching pipeline data:", error);
      res.status(500).json({ message: "Failed to fetch pipeline data" });
    }
  });

  app.get('/api/activities', isAuthenticated, async (req, res) => {
    try {
      const { limit } = req.query;
      const activities = await storage.getRecentActivities(limit ? parseInt(limit as string) : 20);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // SKU routes
  app.post('/api/skus', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userRole = req.user.claims.role || 'va';
      
      // Only admins can create SKUs
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { dealId } = req.body;
      
      // Generate SKU code
      const timestamp = Date.now().toString().slice(-6);
      const skuCode = `AMZ-${timestamp}`;

      const sku = await storage.createSku({
        dealId,
        skuCode,
      });

      // Log activity
      await storage.logActivity({
        userId,
        action: 'sku_generated',
        entityType: 'sku',
        entityId: sku.id,
        description: `SKU ${skuCode} generiert`,
      });

      res.json(sku);
    } catch (error) {
      console.error("Error creating SKU:", error);
      res.status(500).json({ message: "Failed to create SKU" });
    }
  });

  // Mock API integration endpoints
  app.post('/api/integrations/amazon/sync', isAuthenticated, async (req: any, res) => {
    try {
      const userRole = req.user.claims.role || 'va';
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Mock Amazon API sync
      setTimeout(() => {
        res.json({ 
          success: true, 
          message: "Amazon sync completed",
          syncedProducts: Math.floor(Math.random() * 50) + 10
        });
      }, 1000);
    } catch (error) {
      res.status(500).json({ message: "Amazon sync failed" });
    }
  });

  app.post('/api/integrations/prepmybusiness/sync', isAuthenticated, async (req: any, res) => {
    try {
      const userRole = req.user.claims.role || 'va';
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Mock PrepMyBusiness API sync
      setTimeout(() => {
        res.json({ 
          success: true, 
          message: "PrepMyBusiness sync completed",
          syncedOrders: Math.floor(Math.random() * 20) + 5
        });
      }, 1500);
    } catch (error) {
      res.status(500).json({ message: "PrepMyBusiness sync failed" });
    }
  });

  app.post('/api/integrations/google-sheets/import', isAuthenticated, async (req: any, res) => {
    try {
      const userRole = req.user.claims.role || 'va';
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Mock Google Sheets import
      setTimeout(() => {
        res.json({ 
          success: true, 
          message: "Google Sheets import completed",
          importedRows: Math.floor(Math.random() * 100) + 20
        });
      }, 2000);
    } catch (error) {
      res.status(500).json({ message: "Google Sheets import failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
