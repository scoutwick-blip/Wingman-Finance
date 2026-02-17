import { ImportedTransaction } from '../types';
import { extractMerchant } from './csvImportService';

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

  // Find where the actual OFX data starts (after headers)
  const ofxStart = data.indexOf('<OFX>');
  if (ofxStart === -1) {
    throw new Error('Invalid OFX file: Missing <OFX> tag');
  }

  // Extract just the OFX portion
  data = data.substring(ofxStart);

  // First pass: identify which tags are containers (have explicit closing tags)
  const containerTags = new Set<string>();
  const closingTagPattern = /<\/([A-Z0-9_]+)>/g;
  let match;
  while ((match = closingTagPattern.exec(data)) !== null) {
    containerTags.add(match[1]);
  }

  // Check if conversion is needed
  const testPattern = /<([A-Z0-9_]+)>([^<\n]+)/;
  const testMatch = data.match(testPattern);
  const needsConversion = testMatch && !containerTags.has(testMatch[1]);

  if (!needsConversion) {
    return data;
  }

  // Second pass: process line by line and add closing tags to non-containers
  const lines = data.split(/\r?\n/);
  const result: string[] = [];

  for (const line of lines) {
    const indent = line.match(/^[\t ]*/)?.[0] || '';
    const trimmedLine = line.trim();

    // Skip empty lines or XML declarations
    if (!trimmedLine || trimmedLine.startsWith('<?')) {
      result.push(line);
      continue;
    }

    // Check if it's a closing tag (keep as-is)
    if (trimmedLine.match(/^<\/[A-Z0-9_]+>$/)) {
      result.push(line);
      continue;
    }

    // Check for opening tag with value on same line: <TAG>value
    const leafMatch = trimmedLine.match(/^<([A-Z0-9_]+)>(.+)$/);
    if (leafMatch) {
      const [, tagName, value] = leafMatch;
      const trimmedValue = value.trim();

      // Only add closing tag if:
      // 1. This tag is NOT a container (doesn't have explicit closing tags in file)
      // 2. The value is not empty and doesn't start with a tag
      if (!containerTags.has(tagName) && trimmedValue && !trimmedValue.startsWith('<')) {
        result.push(`${indent}<${tagName}>${trimmedValue}</${tagName}>`);
      } else {
        // It's a container opening tag, keep as-is
        result.push(line);
      }
      continue;
    }

    // Any other line (opening tag without value, plain text, etc.)
    result.push(line);
  }

  const converted = result.join('\n');
  return converted;
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
      const errorText = parserError.textContent || 'Unknown XML parsing error';
      throw new Error(`XML parsing failed: ${errorText}`);
    }

    // Find all transaction elements (STMTTRN)
    let transactions = xmlDoc.getElementsByTagName('STMTTRN');

    if (transactions.length === 0) {
      // Try alternative tag names
      transactions = xmlDoc.getElementsByTagName('TRANSACTION');

      if (transactions.length === 0) {
        throw new Error('No transaction elements found. The file may not contain transaction data in the expected format.');
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

      // Extract merchant using the same logic as CSV imports for consistency
      const merchant = name ? extractMerchant(name) : undefined;

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
