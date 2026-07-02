import { Errors } from '@/lib/api/errors';

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsv(text: string, maxRows = 500): CsvParseResult {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      if (rows.length > maxRows + 1) {
        throw Errors.validation(`CSV is limited to ${maxRows} data rows.`);
      }
      continue;
    }

    field += ch;
  }

  if (inQuotes) throw Errors.validation('CSV has an unterminated quoted field.');
  row.push(field);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  if (rows.length < 2) throw Errors.validation('CSV must include a header row and at least one data row.');

  const headers = rows[0].map((h) => h.trim()).filter(Boolean);
  if (!headers.length) throw Errors.validation('CSV header row is empty.');
  if (new Set(headers.map((h) => h.toLowerCase())).size !== headers.length) {
    throw Errors.validation('CSV headers must be unique.');
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > maxRows) throw Errors.validation(`CSV is limited to ${maxRows} data rows.`);

  return {
    headers,
    rows: dataRows.map((cells) => Object.fromEntries(headers.map((header, idx) => [header, (cells[idx] ?? '').trim()]))),
  };
}

export function csvEscape(value: unknown): string {
  let text = value == null ? '' : String(value);
  // Formula/DDE injection guard: a cell starting with =, +, -, @, tab, or CR
  // can be interpreted as a formula by Excel/Sheets when the CSV is opened.
  // Prefixing with a leading apostrophe forces it to be read as plain text.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  return [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\r\n');
}
