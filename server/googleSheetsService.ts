import { google } from 'googleapis';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GoogleSheetsRow {
  datum?: string;
  imageUrl?: string;
  brand?: string;
  productName: string;
  asin: string;
  eanBarcode?: string;
  sourceUrl?: string;
  amazonUrl?: string;
  costPrice: string;
  salePrice: string;
  buyBoxAverage90Days?: string;
  estimatedSales?: string;
  fbaSellerCount?: string;
  fbmSellerCount?: string;
  productReview?: string;
  notes?: string;
  sourcingMethod?: string;
}

export class GoogleSheetsService {
  private sheets: any;
  private spreadsheetId: string;

  constructor() {
    // Use the new simplified spreadsheet
    this.spreadsheetId = "1oyMW2kEXEifC5KkN_kX7KmiMoC_oKSZQqEU7r_YUdTc";
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

      // Second test - try to read headers and data from Sheet1 (simplified format)
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A1:P1', // Headers (simplified to 16 columns)
      });
      
      const dataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A2:P20', // Data rows 2-20
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
          sourcingTabFound: spreadsheet.sheets?.some((s: any) => s.properties?.title === 'Sheet1') || false
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
    // Column mapping for 28-field structure
    const columnMapping: Record<number, keyof GoogleSheetsRow> = {
      0: 'datum',            // A: Datum
      1: 'imageUrl',         // B: Image URL
      2: 'brand',            // C: Brand
      3: 'productName',      // D: Product Name
      4: 'asin',             // E: ASIN
      5: 'eanBarcode',       // F: EAN/Barcode
      6: 'sourceUrl',        // G: Source URL
      7: 'amazonUrl',        // H: Amazon URL
      8: 'costPrice',        // I: Cost Price
      9: 'salePrice',        // J: Sale Price
      10: 'buyBoxAverage90Days', // K: BuyBox Average 90 Days
      11: 'estimatedSales',  // L: Estimated Sales
      12: 'fbaSellerCount',  // M: FBA Seller Count
      13: 'fbmSellerCount',  // N: FBM Seller Count
      14: 'productReview',   // O: Product Review
      15: 'notes',           // P: Notes
      16: 'sourcingMethod',  // Q: Sourcing Method
      // Columns R-AB (17-27) are available for future expansion
    };

    const result: any = {};

    for (let i = 0; i < row.length && i < 28; i++) {
      const fieldName = columnMapping[i];
      if (fieldName && row[i] && row[i].trim() !== '') {
        result[fieldName] = row[i].trim();
      }
    }

    // Ensure required fields have values
    if (!result.productName) {
      throw new Error("Product Name is required (Column D)");
    }
    if (!result.asin) {
      throw new Error("ASIN is required (Column E)");
    }
    if (!result.costPrice) {
      throw new Error("Cost Price is required (Column I)");
    }
    if (!result.salePrice) {
      throw new Error("Sale Price is required (Column J)");
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
    if (!row.salePrice || row.salePrice.trim() === '') {
      errors.push("Sale Price ist erforderlich");
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
    if (row.productReview && (isNaN(parseFloat(row.productReview)) || parseFloat(row.productReview) < 1 || parseFloat(row.productReview) > 5)) {
      errors.push("Product Review muss zwischen 1 und 5 liegen");
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
    const salePrice = parseFloat(row.salePrice);
    const profit = salePrice - costPrice;
    const profitMargin = salePrice > 0 ? (profit / salePrice) * 100 : 0;
    const roi = costPrice > 0 ? (profit / costPrice) * 100 : 0;

    return {
      datum: row.datum ? new Date(row.datum) : new Date(),
      imageUrl: row.imageUrl || null,
      brand: row.brand || null,
      productName: row.productName,
      asin: row.asin,
      eanBarcode: row.eanBarcode || null,
      sourceUrl: row.sourceUrl || null,
      amazonUrl: row.amazonUrl || null,
      costPrice: costPrice.toString(),
      salePrice: salePrice.toString(),
      buyBoxAverage90Days: row.buyBoxAverage90Days ? parseFloat(row.buyBoxAverage90Days).toString() : null,
      profit: profit.toString(),
      profitMargin: profitMargin.toString(),
      roi: roi.toString(),
      estimatedSales: row.estimatedSales ? parseInt(row.estimatedSales) : null,
      fbaSellerCount: row.fbaSellerCount ? parseInt(row.fbaSellerCount) : null,
      fbmSellerCount: row.fbmSellerCount ? parseInt(row.fbmSellerCount) : null,
      productReview: row.productReview ? parseFloat(row.productReview).toString() : null,
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
      
      // Get headers from simplified sheet
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A1:P1',
      });
      
      // Get data from simplified sheet
      const dataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A2:P',
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