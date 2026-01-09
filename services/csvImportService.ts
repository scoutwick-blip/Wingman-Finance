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

  const headers = rows[0].map(h => h.trim());
  const dataRows = rows.slice(1);

  const imported: ImportedTransaction[] = [];

  // Helper function to find column by name (case-insensitive, partial match)
  const findColumn = (columnName: string): string | undefined => {
    const searchTerm = columnName.toLowerCase();
    // First try exact match
    let match = headers.find(h => h.toLowerCase() === searchTerm);
    if (match) return match;

    // Then try if header includes the search term
    match = headers.find(h => h.toLowerCase().includes(searchTerm));
    if (match) return match;

    // Finally try if search term includes the header
    match = headers.find(h => searchTerm.includes(h.toLowerCase()));
    return match;
  };

  for (const row of dataRows) {
    if (row.length === 0 || row.every(cell => !cell)) continue;

    const rowData: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowData[header] = row[index] || '';
    });

    // Find matching columns (case-insensitive)
    const dateCol = findColumn(mapping.dateColumn);
    const descCol = findColumn(mapping.descriptionColumn);
    const amountCol = findColumn(mapping.amountColumn);
    const balanceCol = mapping.balanceColumn ? findColumn(mapping.balanceColumn) : undefined;

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

    const merchant = extractMerchant(description);
    const transactionType = detectTransactionType(description, merchant, amount, amountStr);

    imported.push({
      date,
      description: description.trim(),
      amount,
      balance,
      merchant,
      type: transactionType,
      originalAmount: amountStr,
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

  // Keyword-based suggestions with flexible category name matching
  const keywordMap: Record<string, { keywords: string[], categoryNames: string[] }> = {
    income: {
      keywords: ['salary', 'paycheck', 'direct deposit', 'payment received', 'income', 'wages', 'payroll', 'bonus', 'commission', 'reimbursement', 'refund', 'tax refund', 'dividend', 'interest income'],
      categoryNames: ['income', 'salary', 'wage', 'pay', 'earning']
    },
    groceries: {
      keywords: ['grocery', 'safeway', 'kroger', 'whole foods', 'trader joe', 'walmart', 'target', 'costco', 'market', 'supermarket', 'food lion', 'albertsons', 'publix', 'aldi'],
      categoryNames: ['groceries', 'grocery', 'food', 'supermarket']
    },
    dining: {
      keywords: ['restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'starbucks', 'mcdonalds', 'chipotle', 'subway', 'taco bell', 'wendy', 'kfc', 'dining', 'fast food', 'doordash', 'grubhub', 'uber eats'],
      categoryNames: ['dining', 'restaurant', 'eating out', 'food & dining', 'meals', 'eat']
    },
    gas: {
      keywords: ['gas station', 'fuel', 'shell', 'chevron', 'exxon', 'bp', 'mobil', 'arco', 'circle k', '76', 'sunoco', 'marathon'],
      categoryNames: ['gas', 'fuel', 'gasoline', 'petrol']
    },
    transport: {
      keywords: ['uber', 'lyft', 'taxi', 'parking', 'toll', 'bus', 'metro', 'transit', 'train', 'subway', 'railway'],
      categoryNames: ['transport', 'transportation', 'transit', 'travel', 'commute']
    },
    auto: {
      keywords: ['car payment', 'auto insurance', 'car insurance', 'vehicle', 'mechanic', 'oil change', 'car wash', 'repair', 'auto', 'jiffy lube', 'tire'],
      categoryNames: ['auto', 'car', 'vehicle', 'automotive']
    },
    utilities: {
      keywords: ['electric', 'electricity', 'power company', 'gas company', 'water', 'sewer', 'trash', 'waste management', 'utility', 'pge', 'duke energy'],
      categoryNames: ['utilities', 'utility', 'bills']
    },
    internet: {
      keywords: ['internet', 'cable', 'comcast', 'xfinity', 'at&t', 'verizon', 'spectrum', 'cox', 'wifi', 'broadband'],
      categoryNames: ['internet', 'cable', 'broadband', 'isp']
    },
    phone: {
      keywords: ['phone bill', 'mobile', 'cell phone', 't-mobile', 'sprint', 'wireless', 'cellular', 'verizon wireless'],
      categoryNames: ['phone', 'mobile', 'cell', 'wireless']
    },
    entertainment: {
      keywords: ['movie', 'cinema', 'theater', 'concert', 'ticket', 'event', 'amusement', 'netflix', 'spotify', 'hulu', 'disney', 'hbo', 'prime video', 'apple music', 'youtube premium', 'streaming'],
      categoryNames: ['entertainment', 'fun', 'leisure', 'recreation', 'subscription']
    },
    shopping: {
      keywords: ['amazon', 'ebay', 'store', 'shop', 'mall', 'retail', 'purchase', 'best buy', 'macys'],
      categoryNames: ['shopping', 'retail', 'purchases', 'merchandise']
    },
    healthcare: {
      keywords: ['doctor', 'hospital', 'pharmacy', 'medical', 'dental', 'vision', 'cvs', 'walgreens', 'prescription', 'health insurance', 'clinic', 'urgent care', 'dr.'],
      categoryNames: ['healthcare', 'health', 'medical', 'doctor', 'pharmacy']
    },
    personal: {
      keywords: ['salon', 'haircut', 'spa', 'gym', 'fitness', 'barber', 'massage', 'planet fitness', 'la fitness'],
      categoryNames: ['personal', 'personal care', 'self care', 'beauty', 'fitness', 'gym']
    },
    education: {
      keywords: ['tuition', 'school', 'university', 'college', 'textbook', 'course', 'class', 'student'],
      categoryNames: ['education', 'school', 'learning', 'tuition']
    },
    pets: {
      keywords: ['vet', 'veterinary', 'pet', 'petsmart', 'petco', 'dog', 'cat', 'animal hospital'],
      categoryNames: ['pets', 'pet', 'animal']
    },
    insurance: {
      keywords: ['insurance premium', 'life insurance', 'health insurance', 'insurance payment', 'allstate', 'geico', 'state farm'],
      categoryNames: ['insurance']
    },
    housing: {
      keywords: ['rent payment', 'mortgage payment', 'hoa fee', 'property tax', 'home insurance', 'apartment rent', 'landlord'],
      categoryNames: ['housing', 'house', 'home', 'rent', 'mortgage']
    }
  };

  // Try to match transaction keywords to category (order matters - more specific first)
  for (const [key, data] of Object.entries(keywordMap)) {
    // Check if ANY keyword matches in description or merchant
    const hasKeywordMatch = data.keywords.some(term =>
      desc.includes(term.toLowerCase()) || merch.includes(term.toLowerCase())
    );

    if (hasKeywordMatch) {
      console.log(`[Category Suggestion] Transaction "${description}" matched keyword group: ${key}`);

      // Try to find a category that matches any of the category name patterns
      const category = categories.find(c => {
        const catName = c.name.toLowerCase();
        return data.categoryNames.some(name => catName.includes(name) || name.includes(catName));
      });

      if (category) {
        console.log(`[Category Suggestion] Found matching category: ${category.name}`);
        return category.id;
      } else {
        console.log(`[Category Suggestion] No matching category found for keyword group: ${key}`);
      }
    }
  }

  console.log(`[Category Suggestion] No category match found for: "${description}"`);
  // Don't force a category if we can't find a good match
  return undefined;
}

export function detectTransactionType(
  description: string,
  merchant: string | undefined,
  amount: number,
  originalAmount?: string
): 'income' | 'expense' {
  const desc = description.toLowerCase();
  const merch = merchant?.toLowerCase() || '';

  // Income keywords
  const incomeKeywords = [
    'salary', 'paycheck', 'direct deposit', 'payment received', 'deposit',
    'wages', 'payroll', 'bonus', 'commission', 'reimbursement', 'refund',
    'tax refund', 'dividend', 'interest income', 'credit', 'transfer from',
    'ach credit', 'mobile deposit', 'check deposit', 'income', 'pay'
  ];

  // Check if description/merchant contains income keywords
  if (incomeKeywords.some(keyword => desc.includes(keyword) || merch.includes(keyword))) {
    return 'income';
  }

  // Check original amount string for positive/credit indicators
  if (originalAmount) {
    const clean = originalAmount.toLowerCase().trim();
    // Some banks mark income as positive without minus sign, expenses with minus
    // Or use CR/DR indicators
    if (clean.includes('cr') || clean.includes('credit')) {
      return 'income';
    }
  }

  // Default to expense
  return 'expense';
}
