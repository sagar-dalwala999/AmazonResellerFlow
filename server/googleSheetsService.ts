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
    if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
      throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID environment variable is required");
    }
    
    this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    
    // Try environment variable first, fallback to file
    let auth;
    
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      // Use service account from environment variable
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    } else {
      // Fallback to file-based credentials
      const credentialsPath = path.join(__dirname, 'googleSheetsCredentials.json');
      auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    }

    this.sheets = google.sheets({ version: 'v4', auth });
  }

  async testConnection(): Promise<{ success: boolean; spreadsheet?: any; error?: string }> {
    try {
      // First test - get spreadsheet metadata
      const metadataResponse = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const spreadsheet = metadataResponse.data;

      // Second test - try to read headers and data from Sourcing tab
      const headerResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Sourcing!A1:AB1', // Headers
      });
      
      const dataResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Sourcing!A2:AB10', // Data rows 2-10
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
      const response = await this.sheets.spreadsheets.values.get({
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
}

export const googleSheetsService = new GoogleSheetsService();