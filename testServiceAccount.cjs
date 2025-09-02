// Test Service Account Authentication
const { google } = require('googleapis');

async function testServiceAccount() {
  console.log('=== Service Account Authentication Test ===');
  
  try {
    // Load service account credentials
    const auth = new google.auth.GoogleAuth({
      keyFile: 'server/googleSheetsCredentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    
    console.log('Spreadsheet ID:', spreadsheetId);
    console.log('Service Account Email: springsy@intense-guru-266013.iam.gserviceaccount.com');
    
    // Test metadata access
    console.log('\n1. Testing spreadsheet metadata access...');
    const metadataResponse = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });

    const spreadsheet = metadataResponse.data;
    console.log('✅ Spreadsheet gefunden:', spreadsheet.properties?.title);
    console.log('Verfügbare Sheets:', spreadsheet.sheets?.map(s => s.properties?.title) || []);

    // Test data access
    console.log('\n2. Testing data access...');
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'A1:AB100',
    });

    console.log('✅ Datenabfrage erfolgreich');
    console.log('Anzahl Zeilen:', dataResponse.data.values?.length || 0);
    
    if (dataResponse.data.values && dataResponse.data.values.length > 0) {
      console.log('Header (erste 5 Spalten):', dataResponse.data.values[0].slice(0, 5));
      if (dataResponse.data.values.length > 1) {
        console.log('Beispiel-Daten (erste 5 Spalten):', dataResponse.data.values[1].slice(0, 5));
      }
    } else {
      console.log('⚠️  Spreadsheet ist leer oder hat keine Daten');
    }

  } catch (error) {
    console.error('❌ Test fehlgeschlagen:', error.message);
    
    if (error.message.includes('permission')) {
      console.log('\n💡 Lösungsvorschlag:');
      console.log('1. Stellen Sie sicher, dass das Spreadsheet für springsy@intense-guru-266013.iam.gserviceaccount.com freigegeben ist');
      console.log('2. Oder machen Sie das Spreadsheet öffentlich lesbar');
    }
  }
}

testServiceAccount();