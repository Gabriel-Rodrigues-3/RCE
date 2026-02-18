const XLSX = require('xlsx');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) {
    console.error('Please provide a file path');
    process.exit(1);
}

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const datasheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(datasheet, { header: 1 });

    // Output first 5 rows to see headers and structure
    console.log(JSON.stringify(data.slice(0, 5), null, 2));
} catch (err) {
    console.error('Error reading file:', err.message);
}
