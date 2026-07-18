import * as XLSX from 'xlsx';
import { parseMarginCatalogFromWorkbook } from '../utils/takeRateMarginParser.js';

type SpreadsheetWorkerRequest = {
  operation: 'to-csv' | 'margin-catalog';
  buffer: ArrayBuffer;
};

self.onmessage = (event: MessageEvent<SpreadsheetWorkerRequest>) => {
  try {
    const { operation, buffer } = event.data;
    const workbook = XLSX.read(buffer, {
      type: 'array',
      cellFormula: operation === 'margin-catalog',
      cellText: true,
      cellNF: false,
    });

    if (operation === 'to-csv') {
      const firstSheetName = workbook.SheetNames[0];
      const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
      if (!firstSheet) throw new Error('Classeur vide');
      self.postMessage({ ok: true, result: XLSX.utils.sheet_to_csv(firstSheet) });
      return;
    }

    self.postMessage({
      ok: true,
      result: parseMarginCatalogFromWorkbook(workbook, XLSX),
    });
  } catch {
    self.postMessage({ ok: false });
  }
};
