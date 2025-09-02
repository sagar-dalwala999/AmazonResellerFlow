import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertSourcingSchema, insertPurchasingPlanSchema, insertListingSchema } from "@shared/schema";
import { googleSheetsService } from "./googleSheetsService";
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
  app.get('/api/integrations/google-sheets/test', isAuthenticated, async (req: any, res) => {
    try {
      const userRole = req.user.claims.role || 'va';
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
      const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

      if (!apiKey || !spreadsheetId) {
        return res.status(400).json({
          success: false,
          error: "Google Sheets API-Schlüssel oder Spreadsheet ID nicht gefunden",
          details: {
            hasApiKey: !!apiKey,
            hasSpreadsheetId: !!spreadsheetId
          }
        });
      }

      // Test basic spreadsheet access
      const testUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}`;
      const response = await fetch(testUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(400).json({
          success: false,
          error: `Google Sheets API Fehler: ${response.status}`,
          details: errorText
        });
      }

      const data = await response.json();
      
      // Test data retrieval
      const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:AB10?key=${apiKey}`;
      const dataResponse = await fetch(dataUrl);
      
      if (!dataResponse.ok) {
        const errorText = await dataResponse.text();
        return res.status(400).json({
          success: false,
          error: `Fehler beim Abrufen der Daten: ${dataResponse.status}`,
          details: errorText
        });
      }

      const dataResult = await dataResponse.json();

      res.json({
        success: true,
        spreadsheet: {
          title: data.properties?.title,
          sheets: data.sheets?.map((s: any) => s.properties.title) || [],
          rowCount: dataResult.values?.length || 0,
          hasData: dataResult.values && dataResult.values.length > 1,
          headers: dataResult.values?.[0] || [],
          firstRow: dataResult.values?.[1] || []
        }
      });

    } catch (error) {
      console.error("Google Sheets test error:", error);
      res.status(500).json({
        success: false,
        error: `Verbindungstest fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      });
    }
  });

  app.post('/api/integrations/google-sheets/import', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userRole = req.user.claims.role || 'va';
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "Unauthorized" });
      }

      console.log("Starting Google Sheets import...");
      
      // Fetch data from Google Sheets
      const sheetsData = await googleSheetsService.fetchSheetData();
      
      if (sheetsData.length === 0) {
        return res.json({
          success: true,
          message: "No new data found in Google Sheets",
          importedRows: 0,
          errors: []
        });
      }

      console.log(`Found ${sheetsData.length} rows in Google Sheets`);

      let importedCount = 0;
      const errors: string[] = [];

      // Process each row
      for (let i = 0; i < sheetsData.length; i++) {
        const row = sheetsData[i];
        const rowNumber = i + 2; // +2 because we skipped header and are 1-indexed

        try {
          // Validate the row
          const validationErrors = googleSheetsService.validateRow(row);
          if (validationErrors.length > 0) {
            errors.push(`Zeile ${rowNumber}: ${validationErrors.join(', ')}`);
            continue;
          }

          // Check if ASIN already exists to avoid duplicates
          const existingSourcing = await storage.getSourcingByAsin(row.asin);
          if (existingSourcing) {
            console.log(`Skipping duplicate ASIN ${row.asin} in row ${rowNumber}`);
            continue;
          }

          // Transform and create sourcing item
          const sourcingData = googleSheetsService.transformRowForDatabase(row, userId);
          await storage.createSourcing(sourcingData);
          
          importedCount++;
          console.log(`Imported row ${rowNumber}: ${row.productName} (${row.asin})`);

        } catch (error) {
          console.error(`Error processing row ${rowNumber}:`, error);
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

      res.json({
        success: true,
        message: `Import abgeschlossen: ${importedCount} von ${sheetsData.length} Zeilen importiert`,
        importedRows: importedCount,
        totalRows: sheetsData.length,
        errors: errors.slice(0, 10) // Limit errors to first 10
      });

    } catch (error) {
      console.error("Google Sheets import error:", error);
      res.status(500).json({ 
        message: `Google Sheets Import fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        errors: [error instanceof Error ? error.message : 'Unbekannter Fehler']
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