import React, { useState } from 'react';
import { Upload, Check, X, AlertCircle, FileText, Download } from 'lucide-react';
import { importCSVTransactions, reconcileTransactions, BANK_PRESETS, CSVMapping } from '../services/csvImportService';
import { parseOFXFile, isOFXFormat } from '../services/ofxParser';
import { ImportedTransaction, ReconciliationMatch, ReconciliationStatus, Transaction, Category, MerchantMapping } from '../types';

interface CSVImportProps {
  transactions: Transaction[];
  categories: Category[];
  merchantMappings: MerchantMapping[];
  onImport: (transactions: Omit<Transaction, 'id'>[]) => void;
  onUpdateMerchantMappings: (mappings: MerchantMapping[]) => void;
  onClose: () => void;
  currency: string;
}

export default function CSVImport({
  transactions,
  categories,
  merchantMappings,
  onImport,
  onUpdateMerchantMappings,
  onClose,
  currency
}: CSVImportProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'categorize' | 'reconcile'>('upload');
  const [csvText, setCsvText] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('generic');
  const [fileType, setFileType] = useState<'csv' | 'ofx'>('csv');
  const [importedTransactions, setImportedTransactions] = useState<ImportedTransaction[]>([]);
  const [reconciliationMatches, setReconciliationMatches] = useState<ReconciliationMatch[]>([]);
  const [selectedMatches, setSelectedMatches] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string>('');
  const [transactionGroups, setTransactionGroups] = useState<Map<string, { transactions: ImportedTransaction[], categoryId?: string }>>(new Map());

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);

      // Detect file type
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const isOFX = fileExtension === 'ofx' || fileExtension === 'qfx' || fileExtension === 'qbo' || isOFXFormat(text);

      if (isOFX) {
        setFileType('ofx');
        handleParseOFX(text);
      } else {
        setFileType('csv');
        handleParse(text, selectedPreset);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file. Please try again.');
    };
    reader.readAsText(file);
  };

  const handleParseOFX = (text: string) => {
    try {
      setError('');
      const imported = parseOFXFile(text);

      if (imported.length === 0) {
        setError('No transactions found in OFX file.');
        return;
      }

      setImportedTransactions(imported);
      setStep('preview');
    } catch (error) {
      console.error('Error parsing OFX:', error);
      setError(`Failed to parse OFX file: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure the file is a valid OFX/QFX/QBO file.`);
    }
  };

  const handleParse = (text: string, preset: string) => {
    const mapping = BANK_PRESETS[preset];
    if (!mapping) {
      setError('Invalid bank preset selected.');
      return;
    }

    try {
      setError('');
      const imported = importCSVTransactions(text, mapping);

      if (imported.length === 0) {
        setError(`No transactions found. Please check that your CSV file has the correct columns: ${mapping.dateColumn}, ${mapping.descriptionColumn}, ${mapping.amountColumn}`);
        return;
      }

      setImportedTransactions(imported);
      setStep('preview');
    } catch (error) {
      console.error('Error parsing CSV:', error);
      setError(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}. Please check the file format and try a different bank preset.`);
    }
  };

  const handleCategorize = () => {
    // Group transactions by merchant/description
    const groups = new Map<string, { transactions: ImportedTransaction[], categoryId?: string }>();

    importedTransactions.forEach(tx => {
      const key = tx.merchant || tx.description;
      if (!groups.has(key)) {
        // Auto-apply merchant mapping if one exists
        const merchantName = tx.merchant?.toLowerCase() || tx.description.toLowerCase();
        const existingMapping = merchantMappings.find(m =>
          m.merchant.toLowerCase() === merchantName
        );

        groups.set(key, {
          transactions: [],
          categoryId: existingMapping?.categoryId
        });
      }
      groups.get(key)!.transactions.push(tx);
    });

    setTransactionGroups(groups);
    setStep('categorize');
  };

  const handleSetGroupCategory = (groupKey: string, categoryId: string) => {
    const newGroups = new Map(transactionGroups);
    const group = newGroups.get(groupKey);
    if (group) {
      group.categoryId = categoryId;
      newGroups.set(groupKey, group);
      setTransactionGroups(newGroups);
    }
  };

  const handleReconcile = () => {
    // Apply categories to transactions based on groups
    const updatedTransactions = importedTransactions.map(tx => {
      const key = tx.merchant || tx.description;
      const group = transactionGroups.get(key);
      if (group?.categoryId) {
        return { ...tx, category: group.categoryId };
      }
      return tx;
    });

    const matches = reconcileTransactions(updatedTransactions, transactions, categories);
    setReconciliationMatches(matches);

    // Auto-select only NEW transactions
    const newIndices = matches
      .map((match, index) => (match.status === ReconciliationStatus.NEW ? index : -1))
      .filter(i => i !== -1);
    setSelectedMatches(new Set(newIndices));

    setStep('reconcile');
  };

  const handleImport = () => {
    const toImport: Omit<Transaction, 'id'>[] = [];
    const updatedMerchantMappings = [...merchantMappings];

    selectedMatches.forEach(index => {
      const match = reconciliationMatches[index];
      if (!match || match.status === ReconciliationStatus.DUPLICATE) return;

      const imported = match.importedTransaction;

      // Use detected type, default to expense if not detected
      const typeId = imported.type === 'income' ? 'type-income' : 'type-expense';

      // Use category from group selection, then suggested, then default
      const groupKey = imported.merchant || imported.description;
      const group = transactionGroups.get(groupKey);
      let categoryId = group?.categoryId || match.suggestedCategoryId;

      if (!categoryId) {
        // For income, try to find income category
        if (imported.type === 'income') {
          const incomeCategory = categories.find(c =>
            c.name.toLowerCase().includes('income') ||
            c.name.toLowerCase().includes('salary') ||
            c.name.toLowerCase().includes('wage')
          );
          categoryId = incomeCategory?.id;
        }

        // If still no category, default to "Unassigned"
        if (!categoryId) {
          const unassignedCat = categories.find(c =>
            c.name.toLowerCase().includes('unassigned') ||
            c.name.toLowerCase().includes('uncategorized') ||
            c.name.toLowerCase().includes('other') ||
            c.name.toLowerCase().includes('misc')
          );
          categoryId = unassignedCat?.id || categories[0]?.id || '';
        }
      }

      // Update or create merchant mapping if category was selected
      if (categoryId && imported.merchant) {
        const merchantName = imported.merchant.toLowerCase();
        const existingMappingIndex = updatedMerchantMappings.findIndex(
          m => m.merchant.toLowerCase() === merchantName
        );

        if (existingMappingIndex >= 0) {
          // Update existing mapping
          const existing = updatedMerchantMappings[existingMappingIndex];
          if (existing.categoryId === categoryId) {
            // Same category - increase confidence and usage
            existing.confidence = Math.min(1, existing.confidence + 0.1);
            existing.timesUsed += 1;
          } else {
            // Different category - user changed their mind, reset with new category
            existing.categoryId = categoryId;
            existing.confidence = 0.6;
            existing.timesUsed = 1;
          }
        } else {
          // Create new mapping
          updatedMerchantMappings.push({
            merchant: imported.merchant,
            categoryId: categoryId,
            confidence: 0.7,
            timesUsed: 1
          });
        }
      }

      // Detect recurring transactions
      const merchantOrDesc = imported.merchant || imported.description;
      const similarTransactions = transactions.filter(tx => {
        const txMerchant = tx.merchant || tx.description;
        return txMerchant.toLowerCase() === merchantOrDesc.toLowerCase() &&
               Math.abs(tx.amount - imported.amount) < 0.01; // Same amount within 1 cent
      });

      // If we find 2+ similar transactions with the same merchant and amount, mark as recurring
      const isRecurring = similarTransactions.length >= 2;

      toImport.push({
        date: imported.date,
        description: imported.description,
        amount: imported.amount,
        categoryId: categoryId,
        typeId: typeId,
        merchant: imported.merchant,
        isRecurring: isRecurring
      });
    });

    // Update merchant mappings
    onUpdateMerchantMappings(updatedMerchantMappings);

    onImport(toImport);
    onClose();
  };

  const toggleSelection = (index: number) => {
    const newSelected = new Set(selectedMatches);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedMatches(newSelected);
  };

  const getStatusColor = (status: ReconciliationStatus) => {
    switch (status) {
      case ReconciliationStatus.NEW: return 'bg-green-100 text-green-800 border-green-300';
      case ReconciliationStatus.MATCHED: return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case ReconciliationStatus.DUPLICATE: return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const getStatusIcon = (status: ReconciliationStatus) => {
    switch (status) {
      case ReconciliationStatus.NEW: return <Check className="w-4 h-4" />;
      case ReconciliationStatus.DUPLICATE: return <X className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const stats = {
    total: reconciliationMatches.length,
    new: reconciliationMatches.filter(m => m.status === ReconciliationStatus.NEW).length,
    duplicates: reconciliationMatches.filter(m => m.status === ReconciliationStatus.DUPLICATE).length,
    matched: reconciliationMatches.filter(m => m.status === ReconciliationStatus.MATCHED).length,
    selected: selectedMatches.size
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-wide">TRANSACTION IMPORT</h2>
              <p className="text-sm text-gray-600 mt-1">
                {step === 'upload' && 'Upload your bank file (CSV, OFX, QFX, QBO)'}
                {step === 'preview' && `Preview ${importedTransactions.length} imported transactions`}
                {step === 'categorize' && 'Select categories for transaction groups'}
                {step === 'reconcile' && 'Review and import transactions'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all border-2 border-gray-300 hover:border-red-400 bg-white shadow-sm flex-shrink-0"
              aria-label="Close"
              title="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Bank Preset Selection - Only for CSV */}
              {fileType === 'csv' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Bank Format (CSV only)</label>
                  <select
                    value={selectedPreset}
                    onChange={(e) => {
                      setSelectedPreset(e.target.value);
                      if (csvText) handleParse(csvText, e.target.value);
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="generic">Generic (date, description, amount)</option>
                    <option value="chase">Chase Bank</option>
                    <option value="bofa">Bank of America</option>
                    <option value="wells">Wells Fargo</option>
                    <option value="usaa">USAA</option>
                  </select>
                </div>
              )}

              {/* File Upload */}
              <div className="border-4 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept=".csv,.ofx,.qfx,.qbo"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="cursor-pointer flex flex-col items-center gap-4"
                >
                  <Upload className="w-16 h-16 text-blue-600" />
                  <div>
                    <p className="font-bold text-lg text-gray-900 mb-1">Upload Bank File</p>
                    <p className="text-sm text-gray-600">
                      Supports CSV, OFX, QFX, QBO formats
                    </p>
                  </div>
                </label>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-900 mb-1">Error</p>
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Supported File Formats
                </h4>
                <div className="space-y-3 text-sm text-blue-800">
                  <div>
                    <p className="font-bold">CSV Files:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                      <li>Must contain headers in the first row</li>
                      <li>Required columns: Date, Description, Amount</li>
                      <li>Date formats: MM/DD/YYYY, YYYY-MM-DD, MM-DD-YYYY</li>
                      <li>Select the correct bank preset for best results</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-bold">OFX/QFX/QBO Files:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                      <li>Standard financial exchange format</li>
                      <li>Download from your bank's website</li>
                      <li>Automatically detects transactions</li>
                      <li>No preset selection needed</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && (
            <div className="space-y-6">
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Check className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-bold text-green-900">Successfully Parsed</p>
                    <p className="text-sm text-green-700">
                      {importedTransactions.length} transactions found
                    </p>
                  </div>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase">Description</th>
                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importedTransactions.slice(0, 10).map((tx, idx) => (
                        <tr key={idx} className="border-t border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm">{new Date(tx.date).toLocaleDateString()}</td>
                          <td className="px-4 py-2 text-sm">{tx.description}</td>
                          <td className="px-4 py-2 text-sm text-right font-medium">{currency}{tx.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importedTransactions.length > 10 && (
                  <div className="bg-gray-50 px-4 py-2 text-sm text-gray-600 text-center">
                    Showing first 10 of {importedTransactions.length} transactions
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCategorize}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors font-bold"
                >
                  Continue to Categorize
                </button>
                <button
                  onClick={() => setStep('upload')}
                  className="px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-100 transition-colors font-medium"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Categorize */}
          {step === 'categorize' && (
            <div className="space-y-6">
              {/* Debug Info Banner */}
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4">
                <h4 className="font-bold text-yellow-900 mb-2">🔍 Debug Information</h4>
                <div className="text-xs space-y-1 font-mono text-yellow-800">
                  <p><strong>Total groups:</strong> {transactionGroups.size}</p>
                  <p><strong>Total transactions:</strong> {importedTransactions.length}</p>
                  <p><strong>Sample transaction data:</strong></p>
                  {importedTransactions[0] && (
                    <div className="ml-4 space-y-1 bg-yellow-100 p-2 rounded">
                      <p>Description: "{importedTransactions[0].description}"</p>
                      <p>Amount (parsed): {importedTransactions[0].amount}</p>
                      <p>Original Amount: "{importedTransactions[0].originalAmount || 'NOT SET'}"</p>
                      <p>Original Type: "{importedTransactions[0].originalType || 'NOT SET'}"</p>
                      <p>Detected Type: "{importedTransactions[0].type || 'NOT SET'}"</p>
                      <p>Merchant: "{importedTransactions[0].merchant || 'NOT SET'}"</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-800">
                  <strong>Group similar transactions</strong> and assign categories. All transactions with the same merchant will be categorized together.
                </p>
              </div>

              {/* Transaction Groups */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {Array.from(transactionGroups.entries()).map(([groupKey, group]) => {
                  const totalAmount = group.transactions.reduce((sum, tx) => sum + tx.amount, 0);
                  const isIncome = group.transactions[0]?.type === 'income';

                  return (
                    <div
                      key={groupKey}
                      className="border-2 border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900">{groupKey}</h4>
                          <p className="text-sm text-gray-600">
                            {group.transactions.length} transaction{group.transactions.length !== 1 ? 's' : ''} · Total: {currency}{totalAmount.toFixed(2)}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${
                              isIncome
                                ? 'bg-green-100 text-green-800 border-green-300'
                                : 'bg-red-100 text-red-800 border-red-300'
                            }`}>
                              {isIncome ? '💰 Income' : '💸 Expense'}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded border border-gray-300 font-mono">
                              CSV Amt: {group.transactions[0]?.originalAmount || 'N/A'}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded border border-blue-300 font-mono">
                              CSV Type: {group.transactions[0]?.originalType || 'N/A'}
                            </span>
                          </div>
                        </div>
                        <div className="w-64">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                          <select
                            value={group.categoryId || ''}
                            onChange={(e) => handleSetGroupCategory(groupKey, e.target.value)}
                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          >
                            <option value="">Select category...</option>
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.id}>
                                {cat.icon} {cat.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Show sample transactions */}
                      {group.transactions.length > 1 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs font-medium text-gray-500 mb-2">Sample transactions:</p>
                          <div className="space-y-1">
                            {group.transactions.slice(0, 3).map((tx, idx) => (
                              <div key={idx} className="flex justify-between text-xs text-gray-600">
                                <span>{new Date(tx.date).toLocaleDateString()}</span>
                                <span>{currency}{tx.amount.toFixed(2)}</span>
                              </div>
                            ))}
                            {group.transactions.length > 3 && (
                              <p className="text-xs text-gray-500 italic">
                                +{group.transactions.length - 3} more
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleReconcile}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition-colors font-bold"
                >
                  Continue to Review
                </button>
                <button
                  onClick={() => setStep('preview')}
                  className="px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-100 transition-colors font-medium"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Reconcile */}
          {step === 'reconcile' && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-600 uppercase font-bold">Total</p>
                  <p className="text-2xl font-black text-blue-700">{stats.total}</p>
                </div>
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3">
                  <p className="text-xs text-green-600 uppercase font-bold">New</p>
                  <p className="text-2xl font-black text-green-700">{stats.new}</p>
                </div>
                <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-600 uppercase font-bold">Duplicates</p>
                  <p className="text-2xl font-black text-gray-700">{stats.duplicates}</p>
                </div>
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-3">
                  <p className="text-xs text-yellow-600 uppercase font-bold">Selected</p>
                  <p className="text-2xl font-black text-yellow-700">{stats.selected}</p>
                </div>
              </div>

              {/* Info */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-800">
                  <strong>New</strong> transactions will be imported. <strong>Duplicates</strong> are already in your system. Review and select which transactions to import.
                </p>
              </div>

              {/* Reconciliation List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {reconciliationMatches.map((match, index) => (
                  <div
                    key={index}
                    className={`border-2 rounded-xl p-4 transition-all ${
                      selectedMatches.has(index) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedMatches.has(index)}
                        onChange={() => toggleSelection(index)}
                        disabled={match.status === ReconciliationStatus.DUPLICATE}
                        className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-bold">{match.importedTransaction.description}</p>
                            {match.importedTransaction.merchant && (
                              <p className="text-sm text-gray-600">{match.importedTransaction.merchant}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">{currency}{match.importedTransaction.amount.toFixed(2)}</p>
                            <p className="text-xs text-gray-600">
                              {new Date(match.importedTransaction.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded-full border font-bold flex items-center gap-1 ${getStatusColor(match.status)}`}>
                              {getStatusIcon(match.status)}
                              {match.status}
                              {match.status !== ReconciliationStatus.DUPLICATE && match.confidence > 0 && (
                                <span className="ml-1">({(match.confidence * 100).toFixed(0)}%)</span>
                              )}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full border font-bold ${
                              match.importedTransaction.type === 'income'
                                ? 'bg-green-100 text-green-800 border-green-300'
                                : 'bg-red-100 text-red-800 border-red-300'
                            }`}>
                              {match.importedTransaction.type === 'income' ? '💰 Income' : '💸 Expense'}
                            </span>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {match.suggestedCategoryId ? (
                              <span className="text-xs text-gray-600">
                                Suggested: {categories.find(c => c.id === match.suggestedCategoryId)?.name}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500 italic">
                                No category suggestion
                              </span>
                            )}
                            {match.matchedKeywordGroup && (
                              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded border border-purple-300">
                                Detected: {match.matchedKeywordGroup}
                              </span>
                            )}
                          </div>
                        </div>

                        {match.existingTransaction && (
                          <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs">
                            <p className="font-medium text-yellow-800">
                              {match.status === ReconciliationStatus.DUPLICATE ? 'Duplicate of:' : 'Similar to:'}
                            </p>
                            <p className="text-gray-700">
                              {match.existingTransaction.description} - {currency}{match.existingTransaction.amount.toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleImport}
                  disabled={stats.selected === 0}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import {stats.selected} Transaction{stats.selected !== 1 ? 's' : ''}
                </button>
                <button
                  onClick={() => setStep('categorize')}
                  className="px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-100 transition-colors font-medium"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
