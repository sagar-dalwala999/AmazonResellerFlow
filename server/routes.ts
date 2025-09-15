import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import fs from "fs";
import path from "path";
import aws4 from "aws4";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertSourcingSchema, insertPurchasingPlanSchema, insertListingSchema, insertSourcingFileSchema } from "@shared/schema";
import { googleSheetsService, parseMoneySmart, parsePercentMaybe, parseNumericValue, readSourcingSheet } from "./googleSheetsService";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure multer for file uploads
  const uploadStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = 'uploads/sourcing';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname);
      cb(null, file.fieldname + '-' + uniqueSuffix + extension);
    }
  });

  const upload = multer({
    storage: uploadStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('Invalid file type'));
      }
    }
  });

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

  // Sourcing routes (Google Sheets Integration)
  app.post('/api/sourcing', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sourcingData = insertSourcingSchema.parse(req.body);

      // Calculate profit and margin
      const costPrice = Number(sourcingData.costPrice);
      const salePrice = Number(sourcingData.salePrice);
      const profit = salePrice - costPrice;
      const profitMargin = salePrice > 0 ? (profit / salePrice) * 100 : 0;
      const roi = costPrice > 0 ? (profit / costPrice) * 100 : 0;

      const sourcing = await storage.createSourcing({
        ...sourcingData,
        submittedBy: userId,
        profit: profit.toString(),
        profitMargin: profitMargin.toString(),
        roi: roi.toString(),
      });

      // Log activity
      await storage.logActivity({
        userId,
        action: 'sourcing_submitted',
        entityType: 'sourcing',
        entityId: sourcing.id,
        description: `Sourcing für "${sourcingData.productName}" eingereicht`,
      });

      res.json(sourcing);
    } catch (error) {
      console.error("Error creating sourcing:", error);
      res.status(400).json({ message: "Failed to create sourcing item" });
    }
  });

  app.get('/api/sourcing', isAuthenticated, async (req: any, res) => {
    try {
      const { status, limit } = req.query;
      const userId = req.user.claims.sub;
      const userRole = req.user.claims.role || 'va';

      const options: any = {};
      if (status) options.status = status;
      if (limit) options.limit = parseInt(limit);
      
      // VAs can only see their own sourcing
      if (userRole === 'va') {
        options.submittedBy = userId;
      }

      const sourcing = await storage.getSourcing(options);
      res.json(sourcing);
    } catch (error) {
      console.error("Error fetching sourcing:", error);
      res.status(500).json({ message: "Failed to fetch sourcing items" });
    }
  });

  app.patch('/api/sourcing/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userRole = req.user.claims.role || 'va';
      
      // Only admins can update sourcing status
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { status, reviewNotes } = req.body;
      const sourcingId = req.params.id;

      await storage.updateSourcingStatus(sourcingId, status, userId, reviewNotes);

      // Log activity
      await storage.logActivity({
        userId,
        action: 'sourcing_status_updated',
        entityType: 'sourcing',
        entityId: sourcingId,
        description: `Sourcing Status zu "${status}" geändert`,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating sourcing status:", error);
      res.status(500).json({ message: "Failed to update sourcing status" });
    }
  });

  // Purchasing routes
  app.post('/api/purchasing', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userRole = req.user.claims.role || 'va';
      
      // Only admins can create purchasing plans
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const planData = insertPurchasingPlanSchema.parse(req.body);
      
      // Calculate expected revenue and profit
      const quantity = planData.plannedQuantity;
      const costPerUnit = Number(planData.costPerUnit);
      const plannedBudget = Number(planData.plannedBudget);
      
      // Get sourcing item to calculate sale price
      const sourcingItem = await storage.getSourcingItem(planData.sourcingId);
      if (!sourcingItem) {
        return res.status(404).json({ message: "Sourcing item not found" });
      }

      const salePrice = Number(sourcingItem.salePrice);
      const expectedRevenue = quantity * salePrice;
      const expectedProfit = expectedRevenue - plannedBudget;
      
      // Check margin warning (if profit margin < 15%)
      const marginWarning = (expectedProfit / expectedRevenue) < 0.15;

      const plan = await storage.createPurchasingPlan({
        ...planData,
        expectedRevenue: expectedRevenue.toString(),
        expectedProfit: expectedProfit.toString(),
        marginWarning,
      });

      // Log activity
      await storage.logActivity({
        userId,
        action: 'purchasing_plan_created',
        entityType: 'purchasing',
        entityId: plan.id,
        description: `Einkaufsplan für ${quantity} Einheiten erstellt`,
      });

      res.json(plan);
    } catch (error) {
      console.error("Error creating purchasing plan:", error);
      res.status(400).json({ message: "Failed to create purchasing plan" });
    }
  });

  app.get('/api/purchasing', isAuthenticated, async (req: any, res) => {
    try {
      const { status, limit } = req.query;
      const options: any = {};
      if (status) options.status = status;
      if (limit) options.limit = parseInt(limit);

      const plans = await storage.getPurchasingPlans(options);
      res.json(plans);
    } catch (error) {
      console.error("Error fetching purchasing plans:", error);
      res.status(500).json({ message: "Failed to fetch purchasing plans" });
    }
  });

  app.patch('/api/purchasing/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userRole = req.user.claims.role || 'va';
      
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const planId = req.params.id;
      const updates = req.body;

      await storage.updatePurchasingPlan(planId, updates);

      await storage.logActivity({
        userId,
        action: 'purchasing_plan_updated',
        entityType: 'purchasing',
        entityId: planId,
        description: `Einkaufsplan aktualisiert`,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating purchasing plan:", error);
      res.status(500).json({ message: "Failed to update purchasing plan" });
    }
  });

  // Listing routes (SKU Management)
  app.post('/api/listings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userRole = req.user.claims.role || 'va';
      
      // Only admins can create listings
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { sourcingId, purchasingId } = req.body;
      
      // Get sourcing item for SKU generation
      const sourcingItem = await storage.getSourcingItem(sourcingId);
      if (!sourcingItem) {
        return res.status(404).json({ message: "Sourcing item not found" });
      }

      // Generate SKU
      const skuCode = storage.generateSKU(
        sourcingItem.brand || 'UNKNOWN',
        Number(sourcingItem.costPrice),
        sourcingItem.asin
      );

      const date = new Date();
      const generatedDate = date.toISOString().slice(2, 10).replace(/-/g, '').slice(0, 6);

      const listing = await storage.createListing({
        sourcingId,
        purchasingId,
        skuCode,
        brand: sourcingItem.brand || 'UNKNOWN',
        buyPrice: sourcingItem.costPrice,
        asin: sourcingItem.asin,
        generatedDate,
      });

      // Log activity
      await storage.logActivity({
        userId,
        action: 'listing_created',
        entityType: 'listing',
        entityId: listing.id,
        description: `Listing ${skuCode} erstellt`,
      });

      res.json(listing);
    } catch (error) {
      console.error("Error creating listing:", error);
      res.status(500).json({ message: "Failed to create listing" });
    }
  });

  app.get('/api/listings', isAuthenticated, async (req: any, res) => {
    try {
      const { status, limit } = req.query;
      const options: any = {};
      if (status) options.status = status;
      if (limit) options.limit = parseInt(limit);

      const listings = await storage.getListings(options);
      res.json(listings);
    } catch (error) {
      console.error("Error fetching listings:", error);
      res.status(500).json({ message: "Failed to fetch listings" });
    }
  });

  app.patch('/api/listings/:id/sync', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userRole = req.user.claims.role || 'va';
      
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const listingId = req.params.id;
      const { amazonStatus, prepMyBusinessStatus } = req.body;

      await storage.updateListingStatus(listingId, amazonStatus, prepMyBusinessStatus);

      await storage.logActivity({
        userId,
        action: 'listing_sync_updated',
        entityType: 'listing',
        entityId: listingId,
        description: `Listing Sync-Status aktualisiert`,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating listing sync status:", error);
      res.status(500).json({ message: "Failed to update listing sync status" });
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
      const pipeline = await storage.getSourcingStats();
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

  // VA Performance routes
  app.get('/api/va/performance/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.params.userId;
      const userRole = req.user.claims.role || 'va';
      const currentUserId = req.user.claims.sub;
      
      // VAs can only see their own performance, admins can see any
      if (userRole === 'va' && userId !== currentUserId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { weeks } = req.query;
      const performance = await storage.getVAPerformance(userId, weeks ? parseInt(weeks as string) : 4);
      res.json(performance);
    } catch (error) {
      console.error("Error fetching VA performance:", error);
      res.status(500).json({ message: "Failed to fetch VA performance" });
    }
  });

  // Mock API integration endpoints
  app.post('/api/integrations/amazon/sync', isAuthenticated, async (req: any, res) => {
    try {
      const userRole = req.user.claims.role || 'va';
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Mock Amazon SP-API sync
      setTimeout(() => {
        res.json({ 
          success: true, 
          message: "Amazon SP-API sync completed",
          syncedListings: Math.floor(Math.random() * 50) + 10
        });
      }, 2000);
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
          syncedJobs: Math.floor(Math.random() * 20) + 5
        });
      }, 1500);
    } catch (error) {
      res.status(500).json({ message: "PrepMyBusiness sync failed" });
    }
  });

  // Google Sheets connection test endpoint
  app.get('/api/integrations/google-sheets/test', async (req, res) => {
    const spreadsheetId = "1S06m7tQuejVvVpStS-gNKZMzrvdEsRCPuipxv1vEiTM";
    try {
      console.log("🔍 Starting Google Sheets connection test...");
      console.log("📋 Environment check:", {
        hasSpreadsheetId: true,
        hasGoogleCredentials: !!process.env.GOOGLE_CREDENTIALS,
        hasServiceAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
        spreadsheetId: spreadsheetId
      });
      
      const result = await googleSheetsService.testConnection();
      
      console.log("📊 Test result:", JSON.stringify(result, null, 2));
      
      if (result.success) {
        res.json({
          ...result,
          debugInfo: {
            timestamp: new Date().toISOString(),
            environment: {
              hasSpreadsheetId: true,
              hasGoogleCredentials: !!process.env.GOOGLE_CREDENTIALS,
              hasServiceAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
              spreadsheetId: spreadsheetId
            }
          }
        });
      } else {
        res.status(400).json({
          ...result,
          debugInfo: {
            timestamp: new Date().toISOString(),
            environment: {
              hasSpreadsheetId: true,
              hasGoogleCredentials: !!process.env.GOOGLE_CREDENTIALS,
              hasServiceAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
              spreadsheetId: spreadsheetId
            }
          }
        });
      }

    } catch (error) {
      console.error("❌ Google Sheets test error:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        code: (error as any)?.code,
        library: (error as any)?.library,
        reason: (error as any)?.reason
      });
      
      res.status(500).json({
        success: false,
        error: `Verbindungstest fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        debugInfo: {
          timestamp: new Date().toISOString(),
          errorDetails: {
            message: error instanceof Error ? error.message : 'Unknown error',
            name: error instanceof Error ? error.name : undefined,
            code: (error as any)?.code,
            library: (error as any)?.library,
            reason: (error as any)?.reason
          },
          environment: {
            hasSpreadsheetId: true,
            hasServiceAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
            spreadsheetId: spreadsheetId
          }
        }
      });
    }
  });

  // New endpoint to fetch sourcing data directly from Google Sheets
  app.get('/api/sourcing/sheets', isAuthenticated, async (req, res) => {
    try {
      console.log("🔍 Fetching sourcing data directly from Google Sheets...");
      const { headers, items } = await readSourcingSheet();
      
      console.log(`📊 Found ${items.length} rows with headers: ${headers.join(', ')}`);
      
      // Get archived items from database to filter them out
      const archivedItems = await storage.getSourcingItems(true); // showArchived = true
      const archivedAsins = new Set(archivedItems.map(item => item.asin));
      
      // Filter out archived items based on ASIN
      const filteredItems = items.filter((item: any) => {
        const asin = item['ASIN']?.trim();
        return !archivedAsins.has(asin);
      });
      
      console.log(`🔍 Filtered out ${items.length - filteredItems.length} archived items (${archivedAsins.size} total archived)`);
      
      res.json({
        success: true,
        headers,
        items: filteredItems,
        totalRows: filteredItems.length,
        lastUpdated: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("❌ Error fetching from Google Sheets:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        headers: [],
        items: []
      });
    }
  });

  // Sourcing Items database operations
  app.post('/api/sourcing/items/save', isAuthenticated, async (req, res) => {
    try {
      const items = req.body;
      await storage.upsertSourcingItems(items);
      res.json({ success: true, message: 'Items saved successfully' });
    } catch (error) {
      console.error('Error saving sourcing items:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to save items',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/sourcing/items', isAuthenticated, async (req, res) => {
    try {
      const showArchived = req.query.archived === 'true';
      const items = await storage.getSourcingItems(showArchived);
      res.json({ success: true, items });
    } catch (error) {
      console.error('Error fetching sourcing items:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch items',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/sourcing/items/:rowIndex/archive', isAuthenticated, async (req, res) => {
    try {
      const rowIndex = parseInt(req.params.rowIndex);
      await storage.archiveSourcingItem(rowIndex);
      res.json({ success: true, message: 'Item archived successfully' });
    } catch (error) {
      console.error('Error archiving sourcing item:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to archive item',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.delete('/api/sourcing/items/:rowIndex', isAuthenticated, async (req, res) => {
    try {
      const rowIndex = parseInt(req.params.rowIndex);
      
      // Delete from Google Sheets first
      await googleSheetsService.deleteRow(rowIndex);
      
      // Then delete from database
      await storage.deleteSourcingItem(rowIndex);
      
      res.json({ success: true, message: 'Item deleted successfully' });
    } catch (error) {
      console.error('Error deleting sourcing item:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to delete item',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // New endpoint to fetch purchasing data directly from Google Sheets  
  app.get('/api/purchasing/sheets', isAuthenticated, async (req, res) => {
    try {
      console.log("🔍 Fetching purchasing data directly from Google Sheets...");
      const { headers, items } = await googleSheetsService.readPurchasingSheet();
      
      console.log(`📦 Found ${items.length} items in Purchasing sheet with headers: ${headers.join(', ')}`);
      
      // Return raw data directly from sheets
      res.json({
        success: true,
        headers,
        items,
        totalRows: items.length,
        lastUpdated: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error("❌ Error reading Purchasing Sheet:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to read purchasing data from Google Sheets" 
      });
    }
  });

  // Purchasing Sheet Update Endpoints
  app.post('/api/purchasing/update-product-review', isAuthenticated, async (req, res) => {
    try {
      const { rowIndex, productReview } = req.body;

      if (typeof rowIndex !== 'number' || rowIndex < 0) {
        return res.status(400).json({ message: "Invalid row index" });
      }

      if (!productReview || productReview.trim() === '') {
        return res.status(400).json({ message: "Product review is required" });
      }

      console.log(`🔄 Updating Purchasing Product Review for row ${rowIndex} to "${productReview}"`);
      
      const result = await googleSheetsService.updatePurchasingProductReview(rowIndex, productReview);
      
      res.json({
        success: true,
        message: `Product review updated to "${productReview}"`,
        data: result
      });
    } catch (error) {
      console.error("❌ Error updating Purchasing Product Review:", error);
      res.status(500).json({ 
        message: "Failed to update product review"
      });
    }
  });

  app.post('/api/purchasing/update-sourcing-method', isAuthenticated, async (req, res) => {
    try {
      const { rowIndex, sourcingMethod } = req.body;

      if (typeof rowIndex !== 'number' || rowIndex < 0) {
        return res.status(400).json({ message: "Invalid row index" });
      }

      if (!sourcingMethod || sourcingMethod.trim() === '') {
        return res.status(400).json({ message: "Sourcing method is required" });
      }

      console.log(`🔄 Updating Purchasing Sourcing Method for row ${rowIndex} to "${sourcingMethod}"`);
      
      const result = await googleSheetsService.updatePurchasingSourcingMethod(rowIndex, sourcingMethod);
      
      res.json({
        success: true,
        message: `Sourcing method updated to "${sourcingMethod}"`,
        data: result
      });
    } catch (error) {
      console.error("❌ Error updating Purchasing Sourcing Method:", error);
      res.status(500).json({ 
        message: "Failed to update sourcing method"
      });
    }
  });

  app.post('/api/purchasing/update-notes', isAuthenticated, async (req, res) => {
    try {
      const { rowIndex, notes } = req.body;

      if (typeof rowIndex !== 'number' || rowIndex < 0) {
        return res.status(400).json({ message: "Invalid row index" });
      }

      console.log(`🔄 Updating Purchasing Notes for row ${rowIndex}`);
      
      const result = await googleSheetsService.updatePurchasingNotes(rowIndex, notes || '');
      
      res.json({
        success: true,
        message: "Notes updated successfully",
        data: result
      });
    } catch (error) {
      console.error("❌ Error updating Purchasing Notes:", error);
      res.status(500).json({ 
        message: "Failed to update notes"
      });
    }
  });

  app.post('/api/purchasing/update-status', isAuthenticated, async (req, res) => {
    try {
      const { rowIndex, status } = req.body;

      if (typeof rowIndex !== 'number' || rowIndex < 0) {
        return res.status(400).json({ message: "Invalid row index" });
      }

      if (!status || status.trim() === '') {
        return res.status(400).json({ message: "Status is required" });
      }

      console.log(`🔄 Updating Purchasing Status for row ${rowIndex} to "${status}"`);
      
      const result = await googleSheetsService.updatePurchasingStatus(rowIndex, status);
      
      res.json({
        success: true,
        message: `Status updated to "${status}"`,
        data: result
      });
    } catch (error) {
      console.error("❌ Error updating Purchasing Status:", error);
      res.status(500).json({ 
        message: "Failed to update status"
      });
    }
  });

  // === PrepMyBusiness API Routes ===
  
  // Test PrepMyBusiness API connection
  app.get('/api/purchasing/test-prepmybusiness', isAuthenticated, async (req, res) => {
    try {
      const apiUrl = "https://portal.beeprep.de/api";
      const apiKey = process.env.PREPMYBUSINESS_API_KEY;
      const merchantId = process.env.PREPMYBUSINESS_MERCHANT_ID;

      if (!apiKey || !merchantId) {
        return res.status(500).json({ 
          message: 'PrepMyBusiness API credentials not configured' 
        });
      }

      // Test different endpoints to see what's available
      const testEndpoints = [
        `${apiUrl}/health`,
        `${apiUrl}/status`, 
        `${apiUrl}/v1`,
        `${apiUrl}/merchants`,
        `${apiUrl}/products`,
        `${apiUrl}/shipments`,
      ];

      const results = [];
      
      for (const endpoint of testEndpoints) {
        try {
          console.log(`🔍 Testing endpoint: ${endpoint}`);
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'X-Merchant-ID': merchantId,
              'Accept': 'application/json',
            },
          });

          results.push({
            endpoint,
            status: response.status,
            ok: response.ok,
            contentType: response.headers.get('content-type')
          });
        } catch (error) {
          results.push({
            endpoint,
            error: error.message
          });
        }
      }

      res.json({ 
        success: true,
        message: 'API endpoint test completed',
        results,
        credentials: {
          apiUrl,
          hasApiKey: !!apiKey,
          hasMerchantId: !!merchantId,
        }
      });

    } catch (error) {
      console.error('Error testing PrepMyBusiness API:', error);
      res.status(500).json({ 
        message: 'Failed to test API connection',
        error: error.message 
      });
    }
  });
  
  // Create shipment via PrepMyBusiness API (3-step process)
  app.post('/api/purchasing/create-shipment', isAuthenticated, async (req, res) => {
    try {
      const { asin, productName, quantity } = req.body;
      
      if (!asin || !productName || !quantity) {
        return res.status(400).json({ 
          message: 'ASIN, product name, and quantity are required' 
        });
      }

      const apiUrl = "https://portal.beeprep.de/api";
      const apiKey = process.env.PREPMYBUSINESS_API_KEY;
      const merchantId = process.env.PREPMYBUSINESS_MERCHANT_ID;

      if (!apiKey || !merchantId) {
        return res.status(500).json({ 
          message: 'PrepMyBusiness API credentials not configured' 
        });
      }

      console.log('🚛 Starting PrepMyBusiness shipment creation for:', { asin, productName, quantity });

      // STEP 1: Create inventory item
      const merchantSku = `SKU-${asin}-${Date.now()}`;
      const inventoryPayload = {
        merchant_sku: merchantSku,
        title: productName,
        condition: "new"
      };

      console.log('📦 Step 1: Creating inventory item:', inventoryPayload);

      const inventoryResponse = await fetch(`${apiUrl}/inventory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
          'X-Selected-Client-Id': merchantId,
        },
        body: JSON.stringify(inventoryPayload),
      });

      if (!inventoryResponse.ok) {
        const errorText = await inventoryResponse.text();
        console.error('❌ Failed to create inventory item:', inventoryResponse.status, errorText);
        return res.status(inventoryResponse.status).json({ 
          message: `Failed to create inventory item: ${inventoryResponse.status}`,
          details: errorText 
        });
      }

      const inventoryResult = await inventoryResponse.json();
      console.log('📝 Step 1: Full inventory API response:', JSON.stringify(inventoryResult, null, 2));
      
      // Handle different possible response structures
      let itemId;
      if (inventoryResult.item_details?.id) {
        itemId = inventoryResult.item_details.id;
      } else if (inventoryResult.id) {
        itemId = inventoryResult.id;
      } else if (inventoryResult.data?.id) {
        itemId = inventoryResult.data.id;
      } else {
        console.error('❌ Unexpected inventory response structure:', inventoryResult);
        return res.status(500).json({ 
          message: 'Unexpected inventory API response structure',
          details: 'Could not find item ID in response',
          response: inventoryResult
        });
      }
      
      console.log('✅ Step 1: Inventory item created successfully with ID:', itemId);

      // STEP 2: Create shipment
      const shipmentPayload = {
        name: productName,
        notes: `Automated shipment for ASIN: ${asin}`,
        warehouse_id: '477'
      };

      console.log('🚢 Step 2: Creating shipment:', shipmentPayload);

      const shipmentResponse = await fetch(`${apiUrl}/shipments/inbound?api_token=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Selected-Client-Id': merchantId,
        },
        body: JSON.stringify(shipmentPayload),
      });

      if (!shipmentResponse.ok) {
        const errorText = await shipmentResponse.text();
        console.error('❌ Failed to create shipment:', shipmentResponse.status, errorText);
        return res.status(shipmentResponse.status).json({ 
          message: `Failed to create shipment: ${shipmentResponse.status}`,
          details: errorText 
        });
      }

      const shipmentResult = await shipmentResponse.json();
      console.log('📝 Step 2: Full shipment API response:', JSON.stringify(shipmentResult, null, 2));
      
      // Handle different possible response structures
      let shipmentId;
      if (shipmentResult.id) {
        shipmentId = shipmentResult.id;
      } else if (shipmentResult.data?.id) {
        shipmentId = shipmentResult.data.id;
      } else if (shipmentResult.shipment?.id) {
        shipmentId = shipmentResult.shipment.id;
      } else if (shipmentResult.shipment_id) {  // Add this block
        shipmentId = shipmentResult.shipment_id;
      } else {
        console.error('❌ Unexpected shipment response structure:', shipmentResult);
        return res.status(500).json({ 
          message: 'Unexpected shipment API response structure',
          details: 'Could not find shipment ID in response',
          response: shipmentResult
        });
      }

      
      console.log('✅ Step 2: Shipment created successfully with ID:', shipmentId);

      // STEP 3: Add item to shipment
      const addItemPayload = {
        item_id: itemId,
        quantity: parseInt(quantity)
      };

      console.log('➕ Step 3: Adding item to shipment:', addItemPayload);

      const addItemResponse = await fetch(`${apiUrl}/shipments/inbound/${shipmentId}/add-item?api_token=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Selected-Client-Id': merchantId,
        },
        body: JSON.stringify(addItemPayload),
      });

      if (!addItemResponse.ok) {
        const errorText = await addItemResponse.text();
        console.error('❌ Failed to add item to shipment:', addItemResponse.status, errorText);
        return res.status(addItemResponse.status).json({ 
          message: `Failed to add item to shipment: ${addItemResponse.status}`,
          details: errorText 
        });
      }

      const addItemResult = await addItemResponse.json();
      console.log('✅ Step 3: Item added to shipment successfully:', addItemResult);

      res.json({ 
        success: true, 
        message: 'Shipment created successfully via PrepMyBusiness',
        data: {
          inventoryItem: {
            id: itemId,
            merchantSku: merchantSku
          },
          shipment: {
            id: shipmentId,
            name: productName
          },
          quantity: parseInt(quantity)
        }
      });

    } catch (error) {
      console.error('❌ Error creating PrepMyBusiness shipment:', error);
      res.status(500).json({ 
        message: 'Failed to create shipment',
        error: error.message 
      });
    }
  });

  // Purchasing Files Endpoints
  app.post('/api/purchasing/files/upload', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const { rowIndex, asin } = req.body;
      const userId = req.user.claims.sub;

      if (!rowIndex || !asin) {
        return res.status(400).json({ message: 'Row index and ASIN are required' });
      }

      const fileData = {
        userId,
        rowIndex: parseInt(rowIndex),
        asin,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: req.file.path
      };

      const file = await storage.createPurchasingFile(fileData);
      res.json({ success: true, file });

    } catch (error) {
      console.error('Error uploading purchasing file:', error);
      res.status(500).json({ message: 'Failed to upload file' });
    }
  });

  app.get('/api/purchasing/files/:rowIndex', isAuthenticated, async (req, res) => {
    try {
      const rowIndex = parseInt(req.params.rowIndex);
      const files = await storage.getPurchasingFilesByRow(rowIndex);
      res.json({ files });
    } catch (error) {
      console.error('Error fetching purchasing files:', error);
      res.status(500).json({ message: 'Failed to fetch files' });
    }
  });

  app.delete('/api/purchasing/files/:fileId', isAuthenticated, async (req, res) => {
    try {
      const fileId = req.params.fileId;
      await storage.deletePurchasingFile(fileId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting purchasing file:', error);
      res.status(500).json({ message: 'Failed to delete file' });
    }
  });

  app.get('/api/purchasing/files/download/:fileId', async (req, res) => {
    try {
      const fileId = req.params.fileId;
      const file = await storage.getPurchasingFile(fileId);
      
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }

      res.download(file.filePath, file.originalName);
    } catch (error) {
      console.error('Error downloading purchasing file:', error);
      res.status(500).json({ message: 'Failed to download file' });
    }
  });

  // Purchasing Items Endpoints
  app.post('/api/purchasing/items/save', isAuthenticated, async (req: any, res) => {
    try {
      const items = req.body;
      const userId = req.user.claims.sub;

      if (!Array.isArray(items)) {
        return res.status(400).json({ message: 'Items must be an array' });
      }

      // Sanitize all numeric fields to prevent database parsing errors
      const sanitizeNumericValue = (value: any): string | null => {
        if (value === null || value === undefined) return null;
        
        const str = String(value).trim();
        if (str === '') return null;
        
        // Remove currency symbols, percentages, spaces
        let cleaned = str.replace(/[€$£¥₹%]/g, "").replace(/\s/g, "");
        
        // Convert European decimal comma to dot
        cleaned = cleaned.replace(/,/g, ".");
        
        return cleaned || null;
      };

      let failedCount = 0;
      const failedItems: any[] = [];
      
      const cleanedItems = items.map((item, index) => {
        try {
          const cleanedItem: any = { ...item };
          
          // Sanitize all potentially numeric fields
          const numericFields = ['costPrice', 'salePrice', 'profit', 'profitMargin', 'roi', 
                                'buyBoxAverage90Days', 'revenue', 'spent', 'transfer', 'woVat',
                                'estimatedSales', 'fbaSellerCount', 'fbmSellerCount',
                                'Cost Price', 'Sale Price', 'Profit', 'Profit Margin', 'R.O.I.',
                                'Buy Box (Average Last 90 Days)', 'Revenue', 'Spent', 'Transfer', 'wo VAT',
                                'Estimated Sales', 'FBA Seller Count', 'FBM Seller Count'];
          
          numericFields.forEach(field => {
            if (cleanedItem[field] !== undefined) {
              cleanedItem[field] = sanitizeNumericValue(cleanedItem[field]);
            }
          });
          
          return cleanedItem;
        } catch (error) {
          console.error(`❌ Error sanitizing item ${index}:`, error);
          failedCount++;
          failedItems.push({ index, error: error.message });
          return item; // Return original on sanitization error
        }
      });


      try {
        await storage.savePurchasingItems(cleanedItems, userId);
        console.log(`✅ Successfully saved all ${cleanedItems.length} purchasing items`);
        res.json({ success: true, saved: cleanedItems.length, failed: failedCount });
      } catch (error) {
        console.error(`❌ Database save failed:`, error);
        failedCount = cleanedItems.length; // All failed if database error
        res.status(400).json({ 
          success: false, 
          message: 'Failed to save items to database',
          saved: 0,
          failed: failedCount,
          error: error.message
        });
      }

    } catch (error) {
      console.error('Error saving purchasing items:', error);
      res.status(500).json({ message: 'Failed to save items' });
    }
  });

  app.post('/api/purchasing/items/:rowIndex/archive', isAuthenticated, async (req: any, res) => {
    try {
      const rowIndex = parseInt(req.params.rowIndex);
      const userId = req.user.claims.sub;

      await storage.archivePurchasingItem(rowIndex, userId);
      res.json({ success: true });

    } catch (error) {
      console.error('Error archiving purchasing item:', error);
      res.status(500).json({ message: 'Failed to archive item' });
    }
  });

  app.delete('/api/purchasing/items/:rowIndex', isAuthenticated, async (req: any, res) => {
    try {
      const rowIndex = parseInt(req.params.rowIndex);
      
      await storage.deletePurchasingItem(rowIndex);
      res.json({ success: true });

    } catch (error) {
      console.error('Error deleting purchasing item:', error);
      res.status(500).json({ message: 'Failed to delete item' });
    }
  });

  app.get('/api/purchasing/items', isAuthenticated, async (req, res) => {
    try {
      const { archived } = req.query;
      const options: any = {};
      
      if (archived === 'true') {
        options.archived = true;
      }

      const items = await storage.getPurchasingItems(options);
      res.json(items);

    } catch (error) {
      console.error('Error fetching purchasing items:', error);
      res.status(500).json({ message: 'Failed to fetch items' });
    }
  });

  // New endpoint to update Product Review in Google Sheets
  app.patch('/api/sourcing/sheets/:rowIndex/product-review', isAuthenticated, async (req, res) => {
    try {
      const rowIndex = parseInt(req.params.rowIndex);
      const { productReview } = req.body;

      if (isNaN(rowIndex) || rowIndex < 0) {
        return res.status(400).json({ success: false, message: "Invalid row index" });
      }

      if (!productReview || productReview.trim() === '') {
        return res.status(400).json({ success: false, message: "Product review value is required" });
      }

      console.log(`🔄 Updating Product Review for row ${rowIndex} to "${productReview}"`);
      
      const result = await googleSheetsService.updateProductReview(rowIndex, productReview);
      
      res.json({
        success: true,
        message: `Product review updated to "${productReview}" for row ${rowIndex + 1}`,
        rowIndex,
        newValue: productReview
      });
    } catch (error) {
      console.error("❌ Error updating Product Review:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to update Product Review in Google Sheets",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // New endpoint to update Notes in Google Sheets
  app.patch('/api/sourcing/sheets/:rowIndex/notes', isAuthenticated, async (req, res) => {
    try {
      const rowIndex = parseInt(req.params.rowIndex);
      const { notes } = req.body;

      if (isNaN(rowIndex) || rowIndex < 0) {
        return res.status(400).json({ success: false, message: "Invalid row index" });
      }

      if (notes === undefined || notes === null) {
        return res.status(400).json({ success: false, message: "Notes value is required" });
      }

      console.log(`🔄 Updating Notes for row ${rowIndex} to "${notes}"`);
      
      const result = await googleSheetsService.updateNotes(rowIndex, notes);
      
      res.json({
        success: true,
        message: `Notes updated for row ${rowIndex + 1}`,
        rowIndex,
        newValue: notes
      });
    } catch (error) {
      console.error("❌ Error updating Notes:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to update Notes in Google Sheets",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // New endpoint to update Sourcing Method in Google Sheets
  app.patch('/api/sourcing/sheets/:rowIndex/sourcing-method', isAuthenticated, async (req, res) => {
    try {
      const rowIndex = parseInt(req.params.rowIndex);
      const { sourcingMethod } = req.body;

      if (isNaN(rowIndex) || rowIndex < 0) {
        return res.status(400).json({ success: false, message: "Invalid row index" });
      }

      if (!sourcingMethod || sourcingMethod.trim() === '') {
        return res.status(400).json({ success: false, message: "Sourcing method value is required" });
      }

      console.log(`🔄 Updating Sourcing Method for row ${rowIndex} to "${sourcingMethod}"`);
      
      const result = await googleSheetsService.updateSourcingMethod(rowIndex, sourcingMethod);
      
      res.json({
        success: true,
        message: `Sourcing method updated to "${sourcingMethod}" for row ${rowIndex + 1}`,
        rowIndex,
        newValue: sourcingMethod
      });
    } catch (error) {
      console.error("❌ Error updating Sourcing Method:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to update Sourcing Method in Google Sheets",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/integrations/google-sheets/import', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub; // Use authenticated user
      const { headers, items } = await readSourcingSheet();

      console.log(`🔍 Found ${items.length} total rows in Google Sheets`);

      // Header-Normalisierung (trim + lower)
      const norm = (s: any) => String(s || "").trim();
      const pick = (row: Record<string,string>, ...aliases: string[]) => {
        for (const a of aliases) {
          const key = Object.keys(row).find(k => norm(k).toLowerCase() === norm(a).toLowerCase());
          if (key) return row[key];
        }
        return "";
      };

      const cleaned = items
        .map((raw, index) => {
          // New simplified column mapping
          const date         = pick(raw, "Export Date (UTC yyyy-mm-dd)");
          const asin         = pick(raw, "ASIN");
          const quantity     = pick(raw, "Quantity");
          const sourceUrl    = pick(raw, "Source URL");
          const tags         = pick(raw, "Tags");
          const notes        = pick(raw, "All Notes");
          const costPrice    = parseMoneySmart(pick(raw, "Cost Price"));
          const salePrice    = parseMoneySmart(pick(raw, "Sale Price"));
          const marketplace  = pick(raw, "Sales Marketplace");
          const estimatedSalesStr = pick(raw, "Estimated Sales");

          // Skip completely empty rows
          const allEmpty = [asin, sourceUrl, costPrice, salePrice].every(v => !String(v || "").trim());
          if (allEmpty) return null;

          // ASIN is required
          if (!String(asin || "").trim()) {
            console.log(`⚠️ Row ${index + 2}: Skipping - no ASIN`);
            return null;
          }

          // Parse numeric values safely
          const estimatedSalesNum = parseNumericValue(estimatedSalesStr);
          const profit = salePrice - costPrice;

          // Generate a simple product name from ASIN if not available
          const productName = `Product ${String(asin).trim()}`;

          return {
            datum: date ? new Date(date) : new Date(),
            imageUrl: null,
            brand: null, // Not available in simplified format
            productName: productName,
            asin: String(asin).trim(),
            eanBarcode: null,
            sourceUrl: sourceUrl || null,
            amazonUrl: null,
            costPrice: costPrice.toString(),
            salePrice: salePrice.toString(),
            profit: profit.toString(),
            profitMargin: salePrice > 0 ? ((profit / salePrice) * 100).toString() : "0",
            roi: costPrice > 0 ? ((profit / costPrice) * 100).toString() : "0",
            estimatedSales: estimatedSalesNum?.toString() || null,
            fbaSellerCount: null,
            fbmSellerCount: null,
            productReview: null,
            notes: [
              notes,
              quantity ? `Menge: ${quantity}` : null,
              tags ? `Tags: ${tags}` : null, 
              marketplace ? `Marktplatz: ${marketplace}` : null
            ].filter(Boolean).join(' | ') || null,
            sourcingMethod: 'google-sheets-simplified',
            submittedBy: userId,
            status: 'new'
          };
        })
        .filter(Boolean) as any[];

      console.log(`✅ Processed ${cleaned.length} valid rows`);

      let importedCount = 0;
      const errors: string[] = [];

      // Save each item to database
      for (let i = 0; i < cleaned.length; i++) {
        const item = cleaned[i];
        const rowNumber = i + 2; // +2 because we skipped header and are 1-indexed

        try {
          // Check if ASIN already exists to avoid duplicates
          const existingSourcing = await storage.getSourcingByAsin(item.asin);
          if (existingSourcing) {
            console.log(`⚠️ Row ${rowNumber}: Skipping duplicate ASIN ${item.asin}`);
            continue;
          }

          // Save to database
          await storage.createSourcing(item);
          importedCount++;
          console.log(`✅ Row ${rowNumber}: Imported ${item.productName} (${item.asin})`);

        } catch (error) {
          console.error(`❌ Row ${rowNumber}: Error saving ${item.productName}:`, error);
          errors.push(`Zeile ${rowNumber}: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
        }
      }

      // Log activity
      await storage.logActivity({
        userId,
        action: 'google_sheets_import',
        entityType: 'sourcing',
        entityId: 'bulk_import',
        description: `Google Sheets Import: ${importedCount} Deals importiert`,
      });

      console.log(`🎉 Import completed: ${importedCount}/${cleaned.length} items saved`);

      // Verify data was saved
      const allSourcing = await storage.getSourcing({ limit: 100 });
      console.log(`📊 Database now contains ${allSourcing.length} sourcing items`);

      res.json({
        success: true,
        message: `Import abgeschlossen: ${importedCount} von ${cleaned.length} Zeilen importiert`,
        importedRows: importedCount,
        totalRows: cleaned.length,
        skippedDuplicates: cleaned.length - importedCount - errors.length,
        databaseCount: allSourcing.length,
        errors: errors.slice(0, 10) // Limit errors to first 10
      });

    } catch (e: any) {
      console.error("❌ Google Sheets import error:", e);
      res.status(500).json({
        success: false,
        message: `Google Sheets Import fehlgeschlagen: ${e?.message || e}`,
        errors: [String(e?.message || e)],
      });
    }
  });

  app.post('/api/integrations/keepa/buybox', isAuthenticated, async (req: any, res) => {
    try {
      const { asin } = req.body;
      
      // Mock Keepa API call for BuyBox data
      setTimeout(() => {
        res.json({
          success: true,
          asin,
          buyBox: {
            current: (Math.random() * 100 + 50).toFixed(2),
            avg90Days: (Math.random() * 100 + 50).toFixed(2),
            currency: 'EUR'
          },
          lastUpdated: new Date().toISOString()
        });
      }, 1000);
    } catch (error) {
      res.status(500).json({ message: "Keepa API call failed" });
    }
  });

  // File upload endpoints for sourcing items
  app.post('/api/sourcing/files/upload', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      const { rowIndex, asin } = req.body;
      const userId = req.user.claims.sub;

      if (!rowIndex || !asin) {
        return res.status(400).json({ success: false, message: 'Row index and ASIN are required' });
      }

      const fileInfo = {
        rowIndex: parseInt(rowIndex),
        asin,
        originalName: req.file.originalname,
        fileName: req.file.filename,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: userId,
      };

      const savedFile = await storage.saveFileInfo(fileInfo);

      res.json({
        success: true,
        message: 'File uploaded successfully',
        file: savedFile,
      });
    } catch (error) {
      console.error('❌ Error uploading file:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload file',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get files for a specific row
  app.get('/api/sourcing/files/:rowIndex', isAuthenticated, async (req: any, res) => {
    try {
      const rowIndex = parseInt(req.params.rowIndex);
      const userId = req.user.claims.sub;
      
      if (isNaN(rowIndex)) {
        return res.status(400).json({ success: false, message: 'Invalid row index' });
      }

      // Get all files for this row
      const files = await storage.getFilesByRowIndex(rowIndex);
      
      // Filter files to only include those uploaded by the current user
      const userFiles = files.filter(file => file.uploadedBy === userId);

      res.json({
        success: true,
        files: userFiles,
      });
    } catch (error) {
      console.error('❌ Error fetching files:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch files',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Download file
  app.get('/api/sourcing/files/download/:fileId', isAuthenticated, async (req: any, res) => {
    try {
      const fileId = req.params.fileId;
      const userId = req.user.claims.sub;
      const file = await storage.getFileById(fileId);

      if (!file) {
        return res.status(404).json({ success: false, message: 'File not found' });
      }

      // Check if user owns this file
      if (file.uploadedBy !== userId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      if (!fs.existsSync(file.filePath)) {
        return res.status(404).json({ success: false, message: 'File not found on disk' });
      }

      res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
      res.setHeader('Content-Type', file.mimeType);
      res.sendFile(path.resolve(file.filePath));
    } catch (error) {
      console.error('❌ Error downloading file:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to download file',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Delete file
  app.delete('/api/sourcing/files/:fileId', isAuthenticated, async (req: any, res) => {
    try {
      const fileId = req.params.fileId;
      const userId = req.user.claims.sub;
      const file = await storage.getFileById(fileId);

      if (!file) {
        return res.status(404).json({ success: false, message: 'File not found' });
      }

      // Check if user owns this file
      if (file.uploadedBy !== userId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      // Delete file record from database first
      await storage.deleteFile(fileId);

      // Delete file from disk (safe to do after DB delete)
      try {
        if (fs.existsSync(file.filePath)) {
          fs.unlinkSync(file.filePath);
        }
      } catch (diskError) {
        // Log but don't fail the request - file record is already deleted
        console.warn('⚠️ Warning: Failed to delete file from disk:', diskError);
      }

      res.json({
        success: true,
        message: 'File deleted successfully',
      });
    } catch (error) {
      console.error('❌ Error deleting file:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete file',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Amazon SP-API Listing Creation (using only LWA tokens, no AWS credentials needed)
  app.post('/api/purchasing/create-amazon-listing', isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin (only admins can create Amazon listings)
      const userRole = req.user?.claims?.role;
      // if (userRole !== 'admin') {
      //   return res.status(403).json({ 
      //     message: 'Access denied. Admin role required to create Amazon listings.' 
      //   });
      // }

      const { asin, productName, price, brand } = req.body;

      if (!asin || !productName) {
        return res.status(400).json({ 
          message: 'ASIN and product name are required' 
        });
      }

      if (!brand) {
        return res.status(400).json({ 
          message: 'Brand is required for SKU generation' 
        });
      }

      if (!price) {
        return res.status(400).json({ 
          message: 'Price is required for SKU generation' 
        });
      }

      // Generate SKU using pattern: Brand_BuyPrice_DATE_ASIN
      const today = new Date();
      const dateString = today.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD format
      const cleanBrand = brand.replace(/[^a-zA-Z0-9]/g, ''); // Remove special characters
      const cleanPrice = parseFloat(price.toString().replace(/[€,$]/g, '')).toFixed(2).replace('.', ''); // Remove currency and decimal
      const generatedSku = `${cleanBrand}_${cleanPrice}_${dateString}_${asin}`;

      console.log('🌐 Starting Amazon SP-API listing creation for:', {
        asin,
        brand,
        productName: productName.substring(0, 50) + '...',
        price,
        generatedSku,
      });

      console.log('📝 Generated SKU:', generatedSku);

      // Step 1: Get access token using refresh token
      const tokenResponse = await fetch('https://api.amazon.co.uk/auth/o2/token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: process.env.AMAZON_SP_REFRESH_TOKEN!,
          client_id: process.env.AMAZON_SP_CLIENT_ID!,
          client_secret: process.env.AMAZON_SP_CLIENT_SECRET!,
        }),
      });
      if (!tokenResponse.ok) {
        console.error('❌ Amazon token request failed with status:', tokenResponse.status);
        return res.status(500).json({
          message: 'Failed to get Amazon access token',
          status: tokenResponse.status,
        });
      }

      const tokenResult = await tokenResponse.json();
      console.log("Token Response : ", tokenResult);

      const accessToken = tokenResult.access_token;
      console.log('✅ Step 1: Access token obtained successfully', accessToken);

      // Step 2: Create the listing using Listings API (no AWS SigV4 signing needed)
      const listingSku = generatedSku;
      const marketplaceId = 'A1PA6795UKMFR9'; // Germany marketplace

      // Simplified listing data structure
      const listingData: any = {
        productType: 'PRODUCT',
        requirements: 'LISTING',
        attributes: {
          condition_type: [{
            value: 'new_new',
            marketplace_id: marketplaceId,
          }],
          item_name: [{
            value: productName,
            marketplace_id: marketplaceId,
          }],
        },
      };

      // Add price if provided
      const priceValue = parseFloat(price.toString().replace(/[€,$]/g, ''));
      if (!isNaN(priceValue)) {
        listingData.attributes.list_price = [{
          value: { Amount: priceValue, CurrencyCode: 'EUR' },
          marketplace_id: marketplaceId,
        }];
      }

      const endpoint = `https://sellingpartnerapi-eu.amazon.com/listings/2021-08-01/items/${process.env.AMAZON_SP_SELLER_ID}/${listingSku}`;
      const url = new URL(endpoint);
      url.searchParams.append('marketplaceIds', marketplaceId);

      console.log('📡 Making SP-API request to:', url.toString());
      console.log('📦 Request payload:', JSON.stringify(listingData, null, 2));

      // Make direct request using only LWA access token
      const listingResponse = await fetch(url.toString(), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-amz-access-token': accessToken,
          'Accept': 'application/json',
        },
        body: JSON.stringify(listingData),
      });

      let listingResult;
      try {
        listingResult = await listingResponse.json();
      } catch (e) {
        listingResult = await listingResponse.text();
      }

      console.log('📝 Step 2: Amazon listing API response status:', listingResponse.status);
      console.log('📝 Step 2: Amazon listing API response:', JSON.stringify(listingResult, null, 2));

      if (!listingResponse.ok) {
        console.error('❌ Amazon listing creation failed with status:', listingResponse.status);
        return res.status(500).json({
          message: 'Failed to create Amazon listing',
          status: listingResponse.status,
          details: typeof listingResult === 'object' ? listingResult : 'Invalid response format',
        });
      }

      console.log('✅ Step 2: Amazon listing created successfully');
      res.json({
        success: true,
        message: 'Amazon listing created successfully',
        sku: listingSku,
        marketplace: marketplaceId,
        response: listingResult,
      });

    } catch (error) {
      console.error('❌ Error creating Amazon listing:', error);
      res.status(500).json({
        message: 'Failed to create Amazon listing',
        error: error.message,
      });
    }
  });


  const httpServer = createServer(app);
  return httpServer;
}