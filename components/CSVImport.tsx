import React, { useState } from 'react';
import { Upload, Check, X, AlertCircle, FileText, Download } from 'lucide-react';
import { importCSVTransactions, reconcileTransactions, BANK_PRESETS, CSVMapping } from '../services/csvImportService';
import { ImportedTransaction, ReconciliationMatch, ReconciliationStatus, Transaction, Category } from '../types';

interface CSVImportProps {
  transactions: Transaction[];
  categories: Category[];
  onImport: (transactions: Omit<Transaction, 'id'>[]) => void;
  onClose: () => void;
  currency: string;
}

export default function CSVImport({
  transactions,
  categories,
  onImport,
  onClose,
  currency
}: CSVImportProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'reconcile'>('upload');
  const [csvText, setCsvText] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('generic');
  const [importedTransactions, setImportedTransactions] = useState<ImportedTransaction[]>([]);
  const [reconciliationMatches, setReconciliationMatches] = useState<ReconciliationMatch[]>([]);
  const [selectedMatches, setSelectedMatches] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string>('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);

      // Auto-parse with selected preset
      handleParse(text, selectedPreset);
    };
    reader.onerror = () => {
      setError('Failed to read file. Please try again.');
    };
    reader.readAsText(file);
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

  const handleReconcile = () => {
    const matches = reconcileTransactions(importedTransactions, transactions, categories);
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

    selectedMatches.forEach(index => {
      const match = reconciliationMatches[index];
      if (!match || match.status === ReconciliationStatus.DUPLICATE) return;

      const imported = match.importedTransaction;

      toImport.push({
        date: imported.date,
        description: imported.description,
        amount: imported.amount,
        categoryId: match.suggestedCategoryId || categories[0]?.id || '',
        typeId: 'type-expense', // Default to expense
        merchant: imported.merchant,
        isRecurring: false
      });
    });

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
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-wide">CSV IMPORT</h2>
              <p className="text-sm text-gray-600 mt-1">
                {step === 'upload' && 'Upload and parse your bank CSV file'}
                {step === 'preview' && `Preview ${importedTransactions.length} imported transactions`}
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
              {/* Bank Preset Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Bank Format</label>
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

              {/* File Upload */}
              <div className="border-4 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept=".csv"
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
                    <p className="font-bold text-lg text-gray-900 mb-1">Upload CSV File</p>
                    <p className="text-sm text-gray-600">
                      Click to browse or drag and drop
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
                  CSV Format Requirements
                </h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>File must contain headers in the first row</li>
                  <li>Required columns: Date, Description, Amount</li>
                  <li>Date formats supported: MM/DD/YYYY, YYYY-MM-DD, MM-DD-YYYY</li>
                  <li>Amounts can include currency symbols ($) and commas</li>
                  <li>Select the correct bank preset for best results</li>
                </ul>
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
                  onClick={handleReconcile}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors font-bold"
                >
                  Continue to Reconciliation
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

          {/* Step 3: Reconcile */}
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

                        <div className="flex items-center justify-between">
                          <span className={`text-xs px-2 py-1 rounded-full border font-bold flex items-center gap-1 ${getStatusColor(match.status)}`}>
                            {getStatusIcon(match.status)}
                            {match.status}
                            {match.status !== ReconciliationStatus.DUPLICATE && match.confidence > 0 && (
                              <span className="ml-1">({(match.confidence * 100).toFixed(0)}%)</span>
                            )}
                          </span>
                          {match.suggestedCategoryId && (
                            <span className="text-xs text-gray-600">
                              Suggested: {categories.find(c => c.id === match.suggestedCategoryId)?.name}
                            </span>
                          )}
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
                  onClick={() => setStep('preview')}
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
