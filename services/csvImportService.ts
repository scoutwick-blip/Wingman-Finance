import { ImportedTransaction, ReconciliationMatch, ReconciliationStatus, Transaction, Category } from '../types';

// Common CSV formats from major banks
export interface CSVMapping {
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  balanceColumn?: string;
  typeColumn?: string;
}

export const BANK_PRESETS: Record<string, CSVMapping> = {
  chase: {
    dateColumn: 'Posting Date',
    descriptionColumn: 'Description',
    amountColumn: 'Amount'
  },
  bofa: {
    dateColumn: 'Date',
    descriptionColumn: 'Description',
    amountColumn: 'Amount',
    balanceColumn: 'Running Balance'
  },
  wells: {
    dateColumn: 'Date',
    descriptionColumn: 'Description',
    amountColumn: 'Amount'
  },
  usaa: {
    dateColumn: 'Date',
    descriptionColumn: 'Description',
    amountColumn: 'Amount',
    typeColumn: 'Type'
  },
  generic: {
    dateColumn: 'date',
    descriptionColumn: 'description',
    amountColumn: 'amount'
  }
};

export function parseCSV(csvText: string): string[][] {
  const lines = csvText.trim().split('\n');
  const rows: string[][] = [];

  for (const line of lines) {
    // Simple CSV parsing (handles quoted fields)
    const row: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    row.push(currentField.trim());
    rows.push(row);
  }

  return rows;
}

export function detectDateFormat(dateStr: string): string {
  // Common date formats
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return 'MM/DD/YYYY';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'YYYY-MM-DD';
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return 'MM-DD-YYYY';
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(dateStr)) return 'MM/DD/YY';
  return 'UNKNOWN';
}

export function parseDate(dateStr: string, format: string): string {
  try {
    if (format === 'YYYY-MM-DD') {
      return dateStr;
    }

    const parts = dateStr.split(/[\/\-]/);
    let year: number, month: number, day: number;

    switch (format) {
      case 'MM/DD/YYYY':
      case 'MM-DD-YYYY':
        month = parseInt(parts[0], 10);
        day = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
        break;
      case 'MM/DD/YY':
        month = parseInt(parts[0], 10);
        day = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10) + 2000;
        break;
      default:
        return new Date().toISOString().split('T')[0];
    }

    const date = new Date(year, month - 1, day);
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error parsing date:', error);
    return new Date().toISOString().split('T')[0];
  }
}

export function importCSVTransactions(
  csvText: string,
  mapping: CSVMapping
): ImportedTransaction[] {
  const rows = parseCSV(csvText);
  if (rows.length === 0) return [];

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const dataRows = rows.slice(1);

  const imported: ImportedTransaction[] = [];

  for (const row of dataRows) {
    if (row.length === 0 || row.every(cell => !cell)) continue;

    const rowData: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowData[header] = row[index] || '';
    });

    // Find matching columns (case-insensitive)
    const dateCol = Object.keys(rowData).find(k => k.includes(mapping.dateColumn.toLowerCase()));
    const descCol = Object.keys(rowData).find(k => k.includes(mapping.descriptionColumn.toLowerCase()));
    const amountCol = Object.keys(rowData).find(k => k.includes(mapping.amountColumn.toLowerCase()));
    const balanceCol = mapping.balanceColumn
      ? Object.keys(rowData).find(k => k.includes(mapping.balanceColumn.toLowerCase()))
      : undefined;

    if (!dateCol || !descCol || !amountCol) continue;

    const dateStr = rowData[dateCol];
    const description = rowData[descCol];
    const amountStr = rowData[amountCol];

    if (!dateStr || !description || !amountStr) continue;

    const dateFormat = detectDateFormat(dateStr);
    const date = parseDate(dateStr, dateFormat);

    // Parse amount (handle currency symbols, commas, negatives)
    const cleanAmount = amountStr.replace(/[$,\s]/g, '').trim();
    const amount = Math.abs(parseFloat(cleanAmount));

    if (isNaN(amount)) continue;

    const balance = balanceCol && rowData[balanceCol]
      ? parseFloat(rowData[balanceCol].replace(/[$,\s]/g, ''))
      : undefined;

    imported.push({
      date,
      description: description.trim(),
      amount,
      balance,
      merchant: extractMerchant(description),
      rawData: row.join(',')
    });
  }

  return imported;
}

function extractMerchant(description: string): string {
  // Try to extract merchant name from transaction description
  // Common patterns: "PURCHASE AUTHORIZED ON XX/XX MERCHANT NAME"
  // "POS PURCHASE - MERCHANT NAME"
  // "MERCHANT NAME #1234"

  let merchant = description.trim();

  // Remove common prefixes
  merchant = merchant.replace(/^(PURCHASE AUTHORIZED ON \d{2}\/\d{2}\s+)/i, '');
  merchant = merchant.replace(/^(POS PURCHASE -\s+)/i, '');
  merchant = merchant.replace(/^(DEBIT CARD PURCHASE -\s+)/i, '');
  merchant = merchant.replace(/^(ACH\s+)/i, '');

  // Remove trailing location/reference numbers
  merchant = merchant.replace(/\s+#\d+.*$/i, '');
  merchant = merchant.replace(/\s+\d{4,}.*$/i, '');

  return merchant.trim().substring(0, 50);
}

export function reconcileTransactions(
  imported: ImportedTransaction[],
  existing: Transaction[],
  categories: Category[]
): ReconciliationMatch[] {
  const matches: ReconciliationMatch[] = [];

  for (const importedTx of imported) {
    // Try to find exact match
    const exactMatch = existing.find(
      ex =>
        ex.date === importedTx.date &&
        ex.description.toLowerCase() === importedTx.description.toLowerCase() &&
        Math.abs(ex.amount - importedTx.amount) < 0.01
    );

    if (exactMatch) {
      matches.push({
        importedTransaction: importedTx,
        existingTransaction: exactMatch,
        status: ReconciliationStatus.DUPLICATE,
        confidence: 1.0
      });
      continue;
    }

    // Try fuzzy match (same date, similar amount)
    const fuzzyMatch = existing.find(
      ex =>
        ex.date === importedTx.date &&
        Math.abs(ex.amount - importedTx.amount) < 1.0 && // Within $1
        similarity(ex.description.toLowerCase(), importedTx.description.toLowerCase()) > 0.6
    );

    if (fuzzyMatch) {
      matches.push({
        importedTransaction: importedTx,
        existingTransaction: fuzzyMatch,
        status: ReconciliationStatus.MATCHED,
        confidence: 0.8
      });
      continue;
    }

    // No match - new transaction
    const suggestedCategoryId = suggestCategoryFromDescription(
      importedTx.description,
      importedTx.merchant,
      categories,
      existing
    );

    matches.push({
      importedTransaction: importedTx,
      status: ReconciliationStatus.NEW,
      confidence: 0.0,
      suggestedCategoryId
    });
  }

  return matches;
}

function similarity(s1: string, s2: string): number {
  // Simple Levenshtein-based similarity
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshtein(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshtein(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s2.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s1.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(j - 1) !== s2.charAt(i - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s1.length] = lastValue;
  }
  return costs[s1.length];
}

function suggestCategoryFromDescription(
  description: string,
  merchant: string | undefined,
  categories: Category[],
  existingTransactions: Transaction[]
): string | undefined {
  const desc = description.toLowerCase();
  const merch = merchant?.toLowerCase() || '';

  // Look for similar transactions in history
  const similar = existingTransactions.find(tx => {
    const txDesc = tx.description.toLowerCase();
    const txMerch = tx.merchant?.toLowerCase() || '';

    return (
      similarity(txDesc, desc) > 0.7 ||
      (merchant && txMerch && similarity(txMerch, merch) > 0.8)
    );
  });

  if (similar) return similar.categoryId;

  // Keyword-based suggestions
  const keywords: Record<string, string[]> = {
    groceries: ['grocery', 'safeway', 'kroger', 'whole foods', 'trader joe', 'walmart', 'target'],
    dining: ['restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'starbucks', 'mcdonalds'],
    gas: ['gas', 'fuel', 'shell', 'chevron', 'exxon', 'bp'],
    shopping: ['amazon', 'ebay', 'store', 'shop', 'mall'],
    utilities: ['electric', 'gas company', 'water', 'internet', 'phone', 'at&t', 'verizon'],
    transport: ['uber', 'lyft', 'taxi', 'parking', 'toll']
  };

  for (const [categoryName, terms] of Object.entries(keywords)) {
    if (terms.some(term => desc.includes(term) || merch.includes(term))) {
      const category = categories.find(c => c.name.toLowerCase().includes(categoryName));
      if (category) return category.id;
    }
  }

  return categories[0]?.id; // Default to first category
}
