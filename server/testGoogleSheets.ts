// Test script to verify Google Sheets connection
async function testGoogleSheetsConnection() {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  console.log("=== Google Sheets Connection Test ===");
  console.log("API Key exists:", !!apiKey);
  console.log("API Key length:", apiKey?.length || 0);
  console.log("Spreadsheet ID:", spreadsheetId);

  if (!apiKey || !spreadsheetId) {
    console.error("Missing required environment variables!");
    return;
  }

  const testUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}`;
  
  try {
    console.log("Testing basic spreadsheet access...");
    const response = await fetch(testUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error accessing spreadsheet:", response.status, errorText);
      return;
    }

    const data = await response.json();
    console.log("✅ Spreadsheet found:", data.properties?.title);
    console.log("Sheets available:", data.sheets?.map((s: any) => s.properties.title) || []);

    // Test data retrieval
    console.log("\nTesting data retrieval...");
    const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:AB10?key=${apiKey}`;
    const dataResponse = await fetch(dataUrl);
    
    if (!dataResponse.ok) {
      const errorText = await dataResponse.text();
      console.error("Error retrieving data:", dataResponse.status, errorText);
      return;
    }

    const dataResult = await dataResponse.json();
    console.log("✅ Data retrieved successfully");
    console.log("Rows found:", dataResult.values?.length || 0);
    
    if (dataResult.values && dataResult.values.length > 0) {
      console.log("Header row:", dataResult.values[0]);
      if (dataResult.values.length > 1) {
        console.log("First data row:", dataResult.values[1]);
      }
    }

  } catch (error) {
    console.error("Connection test failed:", error);
  }
}

// Only run if called directly
if (require.main === module) {
  testGoogleSheetsConnection();
}

export { testGoogleSheetsConnection };