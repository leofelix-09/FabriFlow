const xlsx = require('xlsx');

try {
    const workbook = xlsx.readFile('Docs/Lead time - Projeto Diligenciamento.xlsx');
    const sheetNameList = workbook.SheetNames;
    console.log("Sheets:", sheetNameList);

    for (const sheetName of sheetNameList) {
        console.log(`\n--- Sheet: ${sheetName} ---`);
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        console.log(JSON.stringify(data.slice(0, 5), null, 2));
    }
} catch (e) {
    console.error(e);
}
