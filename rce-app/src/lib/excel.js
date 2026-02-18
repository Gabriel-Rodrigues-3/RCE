const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

/**
 * Populates the RCE SOMAS standard template with edital items.
 * @param {Array} items - List of items to write
 * @returns {Promise<string>} - Path to the generated file
 */
async function populateBiddingTemplate(items) {
    const templatePath = "C:\\Users\\Usuario\\Downloads\\RCE\\SOMAS\\SOMAS PADRÃO.xlsx";

    if (!fs.existsSync(templatePath)) {
        throw new Error("Template de Excel não encontrado no caminho especificado.");
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    // Get the first worksheet
    const worksheet = workbook.worksheets[0];

    // Starting row (assuming Row 2 for data)
    // We specify columns A through F as per user request
    items.forEach((item, index) => {
        const rowIndex = index + 3;
        const row = worksheet.getRow(rowIndex);

        row.getCell(1).value = item.item_number; // Column A
        row.getCell(2).value = Number(item.quantity) || 0; // Column B
        row.getCell(3).value = item.unit || 'UN'; // Column C
        row.getCell(4).value = item.selection_name; // Column D
        row.getCell(5).value = item.brand || ''; // Column E
        row.getCell(6).value = Number(item.unit_price) || 0; // Column F

        // We don't touch other columns to preserve formulas
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
}

module.exports = { populateBiddingTemplate };
