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

  // Find where the actual OFX data starts (after headers)
  const ofxStart = data.indexOf('<OFX>');
  if (ofxStart === -1) {
    throw new Error('Invalid OFX file: Missing <OFX> tag');
  }

  // Extract just the OFX portion
  data = data.substring(ofxStart);

  // Check if it's already proper XML (has closing tags)
  const hasClosingTags = data.includes('</STMTTRN>') || data.includes('</TRANSACTION>');

  if (!hasClosingTags) {
    // This is SGML format, need to add closing tags
    // OFX SGML uses tags like <TAG>value or <TAG> without closing </TAG>

    // Split into lines and process each line
    const lines = data.split('\n');
    const processedLines: string[] = [];
    const tagStack: string[] = [];

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // Match opening tag with or without value
      const openTagMatch = line.match(/^<([A-Z0-9_]+)>(.*)$/);

      if (openTagMatch) {
        const tagName = openTagMatch[1];
        const value = openTagMatch[2].trim();

        if (value) {
          // Tag has a value on same line - this is a leaf node
          processedLines.push(`<${tagName}>${value}</${tagName}>`);
        } else {
          // Tag without value - this opens a container
          processedLines.push(`<${tagName}>`);
          tagStack.push(tagName);
        }
      } else {
        // Check for closing tag
        const closeTagMatch = line.match(/^<\/([A-Z0-9_]+)>$/);
        if (closeTagMatch) {
          const tagName = closeTagMatch[1];
          // Close any open tags until we find this one
          while (tagStack.length > 0) {
            const lastTag = tagStack.pop()!;
            if (lastTag !== tagName) {
              processedLines.push(`</${lastTag}>`);
            } else {
              processedLines.push(`</${tagName}>`);
              break;
            }
          }
        } else {
          // Plain line, keep as is
          processedLines.push(line);
        }
      }
    }

    // Close any remaining open tags
    while (tagStack.length > 0) {
      const tag = tagStack.pop()!;
      processedLines.push(`</${tag}>`);
    }

    data = processedLines.join('\n');
  }

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
    // Log first 500 chars for debugging
    console.log('OFX File Preview:', content.substring(0, 500));

    // Clean and prepare the data
    const cleanedData = cleanOFXData(content);
    console.log('Cleaned OFX Preview:', cleanedData.substring(0, 500));

    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(cleanedData, 'text/xml');

    // Check for parsing errors
    const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
    if (parserError) {
      const errorText = parserError.textContent || 'Unknown XML parsing error';
      console.error('XML Parser Error:', errorText);
      console.error('Cleaned data that failed:', cleanedData.substring(0, 1000));
      throw new Error(`XML parsing failed: ${errorText}`);
    }

    // Find all transaction elements (STMTTRN)
    let transactions = xmlDoc.getElementsByTagName('STMTTRN');
    console.log('Found STMTTRN elements:', transactions.length);

    if (transactions.length === 0) {
      // Try alternative tag names
      transactions = xmlDoc.getElementsByTagName('TRANSACTION');
      console.log('Found TRANSACTION elements:', transactions.length);

      if (transactions.length === 0) {
        // Log the structure to help debug
        console.log('Root element:', xmlDoc.documentElement?.tagName);
        console.log('All tags in document:', Array.from(xmlDoc.getElementsByTagName('*')).map(el => el.tagName).slice(0, 20));
        throw new Error('No transaction elements found. The file may not contain transaction data in the expected format.');
      }
    }

    const importedTransactions: ImportedTransaction[] = [];

    console.log(`Processing ${transactions.length} transactions...`);

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

    console.log(`✅ Successfully parsed ${importedTransactions.length} transactions`);
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
