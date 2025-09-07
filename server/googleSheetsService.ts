import { google } from 'googleapis';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GoogleSheetsRow {
  datum?: string;                    // A: Datum
  imageUrl?: string;                 // B: Image URL
  image?: string;                    // C: Image
  brand?: string;                    // D: Brand
  productName: string;               // E: Product Name
  asin: string;                      // F: ASIN
  eanBarcode?: string;               // G: EAN Barcode
  sourceUrl?: string;                // H: Source URL
  amazonUrl?: string;                // I: Amazon URL
  costPrice: string;                 // J: Cost Price
  salePrice?: string;                // K: Sale Price
  buyBoxAverage90Days?: string;      // L: Buy Box (Average Last 90 Days)
  profit?: string;                   // M: Profit
  profitMargin?: string;             // N: Profit Margin
  roi?: string;                      // O: R.O.I.
  estimatedSales?: string;           // P: Estimated Sales
  fbaSellerCount?: string;           // Q: FBA Seller Count
  fbmSellerCount?: string;           // R: FBM Seller Count
  productReview?: string;            // S: Product Review
  notes?: string;                    // T: Notes
  sourcingMethod?: string;           // U: Sourcing Method
}

export class GoogleSheetsService {
  private sheets: any;
  private spreadsheetId: string;

  constructor() {
    // Use environment variable for spreadsheet ID
    this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "1S06m7tQuejVvVpStS-gNKZMzrvdEsRCPuipxv1vEiTM";
    console.log(`🔧 GoogleSheetsService initialized with ID: ${this.spreadsheetId}`);
    this.sheets = null; // Initialize later
  }

  private async getGoogleAuth() {
    const raw = process.env.GOOGLE_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
      throw new Error("GOOGLE_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON environment variable is required");
    }

    const creds = JSON.parse(raw);
    
    // WICHTIG: Newlines im Private Key korrekt einsetzen
    if (creds.private_key && creds.private_key.includes("\\n")) {
      creds.private_key = creds.private_key.replace(/\\n/g, "\n");
    }

    return new google.auth.GoogleAuth({
      credentials: {
        client_email: creds.client_email,
        private_key: creds.private_key,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
  }

  private async getSheets() {
    if (!this.sheets) {
      const auth = await this.getGoogleAuth();
      this.sheets = google.sheets({ version: "v4", auth });
    }
    return this.sheets;
  }


  async testConnection(): Promise<{ success: boolean; spreadsheet?: any; error?: string }> {
    try {
      const sheets = await this.getSheets();
      
      // First test - get spreadsheet metadata
      const metadataResponse = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const spreadsheet = metadataResponse.data;

      // Get all sheet names to find the correct one
      const sheetNames = spreadsheet.sheets?.map((s: any) => s.properties?.title) || [];
      console.log(`📋 Available sheet names: ${sheetNames.join(", ")}`);
      
      // Try to find the correct sheet name - could be "Sourcing Sheet" or first sheet
      let sheetName = sheetNames.find((name: string) => 
        name.toLowerCase().includes('sourcing')
      ) || sheetNames[0] || 'Sheet1';
      
      console.log(`🎯 Using sheet: "${sheetName}"`);

      // Second test - try to read headers and data from correct sheet
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `'${sheetName}'!A1:U1`, // Headers (21 columns A-U)
      });
      
      const dataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `'${sheetName}'!A2:U10`, // Data rows 2-10 (21 columns A-U)
      });

      return {
        success: true,
        spreadsheet: {
          title: spreadsheet.properties?.title,
          sheets: spreadsheet.sheets?.map((s: any) => s.properties?.title) || [],
          rowCount: dataResponse.data.values?.length || 0,
          hasData: dataResponse.data.values && dataResponse.data.values.length > 0,
          headers: headerResponse.data.values?.[0] || [],
          firstRow: dataResponse.data.values?.[0] || [],
          sourcingTabFound: spreadsheet.sheets?.some((s: any) => s.properties?.title === 'Sourcing') || false
        }
      };
    } catch (error: any) {
      console.error("Google Sheets connection test failed:", error);
      return {
        success: false,
        error: error.message || 'Unknown connection error'
      };
    }
  }

  async fetchSheetData(range: string = "Sourcing!A2:AB"): Promise<GoogleSheetsRow[]> {
    try {
      const sheets = await this.getSheets();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
      });

      const data = response.data;
      
      if (!data.values || data.values.length === 0) {
        return [];
      }

      // First row is headers, skip it
      const headers = data.values[0];
      const rows = data.values.slice(1);

      return rows.map((row: string[]) => this.mapRowToObject(headers, row));
    } catch (error) {
      console.error("Error fetching Google Sheets data:", error);
      throw error;
    }
  }

  private mapRowToObject(headers: string[], row: string[]): GoogleSheetsRow {
    // Column mapping for new 21-field CSV structure (A-U)
    const columnMapping: Record<number, keyof GoogleSheetsRow> = {
      0: 'datum',                    // A: Datum
      1: 'imageUrl',                 // B: Image URL
      2: 'image',                    // C: Image
      3: 'brand',                    // D: Brand
      4: 'productName',              // E: Product Name
      5: 'asin',                     // F: ASIN
      6: 'eanBarcode',               // G: EAN Barcode
      7: 'sourceUrl',                // H: Source URL
      8: 'amazonUrl',                // I: Amazon URL
      9: 'costPrice',                // J: Cost Price
      10: 'salePrice',               // K: Sale Price
      11: 'buyBoxAverage90Days',     // L: Buy Box (Average Last 90 Days)
      12: 'profit',                  // M: Profit
      13: 'profitMargin',            // N: Profit Margin
      14: 'roi',                     // O: R.O.I.
      15: 'estimatedSales',          // P: Estimated Sales
      16: 'fbaSellerCount',          // Q: FBA Seller Count
      17: 'fbmSellerCount',          // R: FBM Seller Count
      18: 'productReview',           // S: Product Review
      19: 'notes',                   // T: Notes
      20: 'sourcingMethod',          // U: Sourcing Method
    };

    const result: any = {};

    for (let i = 0; i < row.length && i < 21; i++) {
      const fieldName = columnMapping[i];
      if (fieldName && row[i] && row[i].trim() !== '') {
        result[fieldName] = row[i].trim();
      }
    }

    // Ensure required fields have values
    if (!result.productName) {
      throw new Error("Product Name is required (Column E)");
    }
    if (!result.asin) {
      throw new Error("ASIN is required (Column F)");
    }
    if (!result.costPrice) {
      throw new Error("Cost Price is required (Column J)");
    }

    return result as GoogleSheetsRow;
  }

  validateRow(row: GoogleSheetsRow): string[] {
    const errors: string[] = [];

    // Validate required fields
    if (!row.productName || row.productName.trim() === '') {
      errors.push("Product Name ist erforderlich");
    }
    if (!row.asin || row.asin.trim() === '') {
      errors.push("ASIN ist erforderlich");
    }
    if (!row.costPrice || row.costPrice.trim() === '') {
      errors.push("Cost Price ist erforderlich");
    }
    // Validate numeric fields
    if (row.costPrice && isNaN(parseFloat(row.costPrice))) {
      errors.push("Cost Price muss eine gültige Zahl sein");
    }
    if (row.salePrice && isNaN(parseFloat(row.salePrice))) {
      errors.push("Sale Price muss eine gültige Zahl sein");
    }
    if (row.buyBoxAverage90Days && isNaN(parseFloat(row.buyBoxAverage90Days))) {
      errors.push("BuyBox Average muss eine gültige Zahl sein");
    }
    if (row.estimatedSales && isNaN(parseInt(row.estimatedSales))) {
      errors.push("Estimated Sales muss eine ganze Zahl sein");
    }
    if (row.profit && isNaN(parseFloat(row.profit))) {
      errors.push("Profit muss eine gültige Zahl sein");
    }
    if (row.profitMargin && isNaN(parseFloat(row.profitMargin))) {
      errors.push("Profit Margin muss eine gültige Zahl sein");
    }
    if (row.roi && isNaN(parseFloat(row.roi))) {
      errors.push("ROI muss eine gültige Zahl sein");
    }

    // Validate URLs
    if (row.imageUrl && !this.isValidUrl(row.imageUrl)) {
      errors.push("Image URL ist nicht gültig");
    }
    if (row.sourceUrl && !this.isValidUrl(row.sourceUrl)) {
      errors.push("Source URL ist nicht gültig");
    }
    if (row.amazonUrl && !this.isValidUrl(row.amazonUrl)) {
      errors.push("Amazon URL ist nicht gültig");
    }

    return errors;
  }

  private isValidUrl(urlString: string): boolean {
    try {
      new URL(urlString);
      return true;
    } catch {
      return false;
    }
  }

  transformRowForDatabase(row: GoogleSheetsRow, submittedBy: string) {
    const costPrice = parseFloat(row.costPrice);
    
    // Direkt aus Spreadsheet übernehmen - KEINE Berechnung
    const profit = row.profit ? parseFloat(row.profit) : null;
    const profitMargin = row.profitMargin ? parseFloat(row.profitMargin) : null; 
    const roi = row.roi ? parseFloat(row.roi) : null;
    
    // Sale Price direkt aus Spreadsheet verwenden
    const salePrice = row.salePrice ? parseFloat(row.salePrice) : 
                      (row.buyBoxAverage90Days ? parseFloat(row.buyBoxAverage90Days) : costPrice);

    return {
      datum: row.datum ? new Date(row.datum) : new Date(),
      imageUrl: row.imageUrl || null,
      image: row.image || null,
      brand: row.brand || null,
      productName: row.productName,
      asin: row.asin,
      eanBarcode: row.eanBarcode || null,
      sourceUrl: row.sourceUrl || null,
      amazonUrl: row.amazonUrl || null,
      costPrice: costPrice.toString(),
      salePrice: salePrice.toString(),
      buyBoxCurrent: null, // Not in new CSV structure
      buyBoxAverage90Days: row.buyBoxAverage90Days ? parseFloat(row.buyBoxAverage90Days).toString() : null,
      profit: profit !== null ? profit.toString() : null,
      profitMargin: profitMargin !== null ? profitMargin.toString() : null,
      roi: roi !== null ? roi.toString() : null,
      estimatedSales: row.estimatedSales ? parseInt(row.estimatedSales) : null,
      fbaSellerCount: row.fbaSellerCount ? parseInt(row.fbaSellerCount) : null,
      fbmSellerCount: row.fbmSellerCount ? parseInt(row.fbmSellerCount) : null,
      productReview: row.productReview ? parseFloat(row.productReview) : null,
      notes: row.notes || null,
      sourcingMethod: row.sourcingMethod || 'google-sheets',
      submittedBy,
    };
  }
  // Utility functions for parsing
  parseMoneySmart(value: string): number {
    if (!value) return 0;
    // Remove currency symbols, spaces, and convert German decimal separators
    const cleanValue = String(value)
      .replace(/[€$£¥₹]/g, '')
      .replace(/\s/g, '')
      .replace(/,/g, '.');
    
    return parseFloat(cleanValue) || 0;
  }

  parsePercentMaybe(value: string): number | null {
    if (!value) return null;
    // Remove % symbol and spaces, convert German decimal separators
    const cleanValue = String(value)
      .replace(/%/g, '')
      .replace(/\s/g, '')
      .replace(/,/g, '.');
    
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? null : parsed;
  }

  async readSourcingSheet(): Promise<{ headers: string[], items: Record<string, string>[] }> {
    try {
      const sheets = await this.getSheets();
      
      // Get sheet metadata to find correct sheet name
      const metadataResponse = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
      
      const sheetNames = metadataResponse.data.sheets?.map((s: any) => s.properties?.title) || [];
      console.log(`📋 Available sheets: ${sheetNames.join(", ")}`);
      
      // Find the correct sheet name
      let sheetName = sheetNames.find((name: string) => 
        name.toLowerCase().includes('sourcing')
      ) || sheetNames[0] || 'Sheet1';
      
      console.log(`🎯 Reading from sheet: "${sheetName}"`);

      // Get headers (21 columns: A-U)
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `'${sheetName}'!A1:U1`,
      });
      
      // Get data (21 columns: A-U)
      const dataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `'${sheetName}'!A2:U`,
      });

      const headers = headerResponse.data.values?.[0] || [];
      const rows = dataResponse.data.values || [];

      // Convert rows to objects with header keys
      const items = rows.map((row: string[]) => {
        const item: Record<string, string> = {};
        headers.forEach((header: string, index: number) => {
          item[header] = row[index] || '';
        });
        return item;
      });

      return { headers, items };
    } catch (error) {
      console.error("Error reading sourcing sheet:", error);
      throw error;
    }
  }
}

// Export utility functions for external use
export function parseMoneySmart(value: string): number {
  return googleSheetsService.parseMoneySmart(value);
}

export function parsePercentMaybe(value: string): number | null {
  return googleSheetsService.parsePercentMaybe(value);
}

export function parseNumericValue(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  
  const str = String(value).trim();
  if (!str) return null;
  
  // Handle special cases like "> 29", "< 5", etc.
  const numericStr = str.replace(/[^\d,-]/g, "");
  if (!numericStr) return null;
  
  // Handle German decimal comma
  const normalized = numericStr.replace(',', '.');
  const parsed = parseFloat(normalized);
  
  return isNaN(parsed) ? null : parsed;
}

export async function readSourcingSheet() {
  return googleSheetsService.readSourcingSheet();
}

export const googleSheetsService = new GoogleSheetsService();