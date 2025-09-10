import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertSourcingSchema, insertPurchasingPlanSchema, insertListingSchema } from "@shared/schema";
import { googleSheetsService, parseMoneySmart, parsePercentMaybe, parseNumericValue, readSourcingSheet } from "./googleSheetsService";
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

  const httpServer = createServer(app);
  return httpServer;
}