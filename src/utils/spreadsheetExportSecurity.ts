export type SpreadsheetExportCell = string | number | boolean | null | undefined;

export const SPREADSHEET_TEXT_ESCAPE_PREFIX = '\t';

const FORMULA_PREFIXES = new Set(['=', '+', '-', '@']);
const LEADING_SPACES = /^[ \u00a0]*/u;

export const isPotentialSpreadsheetFormula = (value: string) => {
  const withoutLeadingSpaces = value.replace(LEADING_SPACES, '');
  if (!withoutLeadingSpaces) return false;

  const firstCharacter = withoutLeadingSpaces[0];
  return firstCharacter === '\t'
    || firstCharacter === '\r'
    || firstCharacter === '\n'
    || FORMULA_PREFIXES.has(firstCharacter);
};

export const sanitizeSpreadsheetExportCell = (
  value: SpreadsheetExportCell,
): SpreadsheetExportCell => {
  if (typeof value !== 'string' || !isPotentialSpreadsheetFormula(value)) return value;
  if (value.startsWith(SPREADSHEET_TEXT_ESCAPE_PREFIX)) return value;
  return `${SPREADSHEET_TEXT_ESCAPE_PREFIX}${value}`;
};

export const sanitizeSpreadsheetExportRows = (
  rows: readonly (readonly SpreadsheetExportCell[])[],
): SpreadsheetExportCell[][] => rows.map((row) => row.map(sanitizeSpreadsheetExportCell));

const quoteCsvText = (value: string) => `"${value.replace(/"/g, '""')}"`;

export const serializeSafeSpreadsheetCsv = (
  rows: readonly (readonly SpreadsheetExportCell[])[],
  delimiter = ';',
) => sanitizeSpreadsheetExportRows(rows)
  .map((row) => row.map((cell) => {
    if (typeof cell === 'string') return quoteCsvText(cell);
    if (cell === null || cell === undefined) return '""';
    return String(cell);
  }).join(delimiter))
  .join('\r\n');
