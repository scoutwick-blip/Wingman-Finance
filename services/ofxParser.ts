import { ImportedTransaction } from '../types';

/**
 * Parse OFX/QFX/QBO files to extract transactions
 * These formats are XML-based financial data exchange formats used by banks
 */

interface OFXTransaction {
  type: string;
  date: string;
  amount: number;
  fitId: string;
  name?: string;
  memo?: string;
  checkNum?: string;
}

/**
 * Clean OFX SGML format to valid XML
 * OFX files often use SGML format which needs conversion
 */
const cleanOFXData = (data: string): string => {
  // Remove any BOM or whitespace before XML declaration
  data = data.trim();

  // If it's already XML (has <?xml), return as is
  if (data.startsWith('<?xml') || data.startsWith('<OFX>')) {
    return data;
  }

  // Find where the actual OFX data starts (after headers)
  const ofxStart = data.indexOf('<OFX>');
  if (ofxStart === -1) {
    throw new Error('Invalid OFX file: Missing <OFX> tag');
  }

  // Extract just the OFX portion
  data = data.substring(ofxStart);

  // Convert SGML to XML by adding closing tags
  // OFX SGML uses tags like <TAG>value without closing </TAG>
  data = data.replace(/<([A-Z0-9]+)>([^<]+)/g, '<$1>$2</$1>');

  return data;
};

/**
 * Parse date from OFX format (YYYYMMDDHHMMSS or YYYYMMDD)
 */
const parseOFXDate = (dateStr: string): string => {
  // OFX dates are like: 20240115120000 or 20240115
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);

  return `${year}-${month}-${day}`;
};

/**
 * Parse OFX amount (can be negative for debits)
 */
const parseOFXAmount = (amount: string): number => {
  return Math.abs(parseFloat(amount));
};

/**
 * Determine transaction type from OFX TRNTYPE
 */
const getTransactionType = (trnType: string): 'income' | 'expense' => {
  const incomeTypes = ['CREDIT', 'DEP', 'INT', 'DIV', 'DIRECTDEP', 'REPEATPMT'];
  return incomeTypes.includes(trnType.toUpperCase()) ? 'income' : 'expense';
};

/**
 * Extract text content from XML element
 */
const getElementText = (parent: Element, tagName: string): string | null => {
  const element = parent.getElementsByTagName(tagName)[0];
  return element?.textContent?.trim() || null;
};

/**
 * Parse OFX/QFX/QBO file content
 */
export const parseOFXFile = (content: string): ImportedTransaction[] => {
  try {
    // Clean and prepare the data
    const cleanedData = cleanOFXData(content);

    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(cleanedData, 'text/xml');

    // Check for parsing errors
    const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
    if (parserError) {
      throw new Error('Failed to parse OFX file: Invalid XML structure');
    }

    // Find all transaction elements (STMTTRN)
    const transactions = xmlDoc.getElementsByTagName('STMTTRN');

    if (transactions.length === 0) {
      // Try alternative tag names
      const altTransactions = xmlDoc.getElementsByTagName('TRANSACTION');
      if (altTransactions.length === 0) {
        throw new Error('No transactions found in OFX file');
      }
    }

    const importedTransactions: ImportedTransaction[] = [];

    // Process each transaction
    for (let i = 0; i < transactions.length; i++) {
      const txn = transactions[i];

      // Extract transaction data
      const trnType = getElementText(txn, 'TRNTYPE');
      const dtPosted = getElementText(txn, 'DTPOSTED');
      const trnAmt = getElementText(txn, 'TRNAMT');
      const fitId = getElementText(txn, 'FITID');
      const name = getElementText(txn, 'NAME');
      const memo = getElementText(txn, 'MEMO');
      const checkNum = getElementText(txn, 'CHECKNUM');

      // Skip if missing required fields
      if (!dtPosted || !trnAmt || !fitId) {
        console.warn('Skipping transaction with missing required fields', {
          dtPosted,
          trnAmt,
          fitId
        });
        continue;
      }

      // Parse amount (OFX uses negative for debits, positive for credits)
      const rawAmount = parseFloat(trnAmt);
      const amount = Math.abs(rawAmount);

      // Determine if it's income or expense
      let type: 'income' | 'expense';
      if (trnType) {
        type = getTransactionType(trnType);
      } else {
        // If no type, use amount sign (positive = income, negative = expense)
        type = rawAmount >= 0 ? 'income' : 'expense';
      }

      // Build description from available fields
      let description = name || memo || 'Transaction';
      if (checkNum) {
        description = `Check #${checkNum} - ${description}`;
      }

      const merchant = name || undefined;

      // Parse date
      const date = parseOFXDate(dtPosted);

      importedTransactions.push({
        date,
        description: description.trim(),
        amount,
        type,
        merchant,
        originalAmount: trnAmt,
        originalType: trnType || 'UNKNOWN'
      });
    }

    return importedTransactions;
  } catch (error) {
    console.error('OFX parsing error:', error);
    throw new Error(`Failed to parse OFX file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Detect if file content is OFX format
 */
export const isOFXFormat = (content: string): boolean => {
  const trimmed = content.trim();
  return (
    trimmed.includes('<OFX>') ||
    trimmed.includes('OFXHEADER:') ||
    trimmed.includes('DATA:OFXSGML') ||
    trimmed.startsWith('<?xml') && trimmed.includes('<OFX>')
  );
};
