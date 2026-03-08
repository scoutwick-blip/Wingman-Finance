
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, Category, TransactionBehavior, RecurringFrequency, UserPreferences, CategoryType, CategorySuggestion, Account } from '../types';
import ReceiptScanner from './ReceiptScanner';
import { suggestCategory } from '../services/geminiService';

interface TransactionsProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  onAdd: (transaction: Omit<Transaction, 'id'>) => void;
  onUpdate: (id: string, updates: Partial<Transaction>) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkCategoryUpdate: (ids: string[], categoryId: string) => void;
  preferences: UserPreferences;
  initialConfig?: { mode: 'add', behavior: TransactionBehavior } | null;
  onClearConfig: () => void;
  onOpenCSVImport?: () => void;
}

export const Transactions: React.FC<TransactionsProps> = ({
  transactions,
  categories,
  accounts,
  onAdd,
  onUpdate,
  onDelete,
  onBulkDelete,
  onBulkCategoryUpdate,
  preferences,
  initialConfig,
  onClearConfig,
  onOpenCSVImport
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const [categorySuggestions, setCategorySuggestions] = useState<CategorySuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [targetCategory, setTargetCategory] = useState(categories[0]?.id || '');

  // Quick category edit modal
  const [showCategoryEditModal, setShowCategoryEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Default to first transaction type behavior
  const initialType = preferences.transactionTypes[0];

  const defaultFormState = {
    description: '',
    amount: '',
    categoryId: categories[0]?.id || '',
    typeId: initialType?.id || '',
    accountId: accounts.find(a => a.isDefault)?.id || accounts[0]?.id || '',
    date: new Date().toISOString().split('T')[0],
    isRecurring: false,
    frequency: RecurringFrequency.MONTHLY,
    recurringEndDate: '',
    transferToAccountId: ''
  };

  const [formData, setFormData] = useState(defaultFormState);

  // Effect to handle external open requests (Add Income/Expense)
  useEffect(() => {
    if (initialConfig?.mode === 'add') {
      setIsAdding(true);
      setEditingId(null);
      const matchedType = preferences.transactionTypes.find(t => t.behavior === initialConfig.behavior);
      if (matchedType) {
        setFormData(prev => ({ ...prev, typeId: matchedType.id }));
      }
      onClearConfig();
    }
  }, [initialConfig, preferences.transactionTypes, onClearConfig]);

  // Auto-switch type behavior when category changes in form (only for new transactions)
  useEffect(() => {
    if (editingId) return; // Don't auto-switch type when editing

    const selectedCat = categories.find(c => c.id === formData.categoryId);
    if (selectedCat) {
      if (selectedCat.type === CategoryType.INCOME) {
        const incomeType = preferences.transactionTypes.find(t => t.behavior === TransactionBehavior.INFLOW);
        if (incomeType) setFormData(prev => ({ ...prev, typeId: incomeType.id }));
      } else {
        const expenseType = preferences.transactionTypes.find(t => t.behavior === TransactionBehavior.OUTFLOW);
        if (expenseType) setFormData(prev => ({ ...prev, typeId: expenseType.id }));
      }
    }
  }, [formData.categoryId, categories, preferences.transactionTypes, editingId]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    categoryId: 'all',
    typeId: 'all',
    accountId: 'all'
  });

  const calculateNextDate = (dateStr: string, freq: RecurringFrequency) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid Date';

    switch (freq) {
      case RecurringFrequency.WEEKLY:
        date.setDate(date.getDate() + 7);
        break;
      case RecurringFrequency.BI_WEEKLY:
        date.setDate(date.getDate() + 14);
        break;
      case RecurringFrequency.MONTHLY:
        date.setMonth(date.getMonth() + 1);
        break;
      case RecurringFrequency.YEARLY:
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const startEdit = (t: Transaction) => {
    setEditingId(t.id);
    setFormData({
      description: t.description,
      amount: t.amount.toString(),
      categoryId: t.categoryId,
      typeId: t.typeId,
      accountId: t.accountId || '',
      date: t.date,
      isRecurring: t.isRecurring || false,
      frequency: t.frequency || RecurringFrequency.MONTHLY,
      recurringEndDate: t.recurringEndDate || '',
      transferToAccountId: t.transferToAccountId || ''
    });
    setIsAdding(true);
    // Scroll to top to see form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData(defaultFormState);
  };

  const handleReceiptScanned = async (receiptData: {
    merchant?: string;
    amount?: number;
    date?: string;
    description?: string;
    receiptImage: string;
    category?: string;
    lineItems?: Array<{ name: string; quantity: number; price: number }>;
    subtotal?: number;
    tax?: number;
    tip?: number;
    paymentMethod?: string;
  }) => {
    setShowReceiptScanner(false);
    setIsAdding(true);

    // Auto-populate form with receipt data
    setFormData(prev => ({
      ...prev,
      description: receiptData.description || receiptData.merchant || '',
      amount: receiptData.amount?.toString() || '',
      date: receiptData.date || new Date().toISOString().split('T')[0]
    }));

    // Try to auto-match category from receipt's AI suggestion
    if (receiptData.category) {
      const matchedCategory = categories.find(c =>
        c.name.toLowerCase() === receiptData.category!.toLowerCase()
      );
      if (matchedCategory) {
        setFormData(prev => ({ ...prev, categoryId: matchedCategory.id }));
        setCategorySuggestions([{
          categoryId: matchedCategory.id,
          confidence: 0.9,
          reason: `Receipt AI: Detected as ${receiptData.category}`
        }]);
        return; // Skip additional AI call since receipt already categorized
      }
    }

    // Fall back to AI category suggestions if smart categorization is enabled
    if (preferences.smartCategorizationEnabled && receiptData.description) {
      setIsLoadingSuggestions(true);
      try {
        const suggestions = await suggestCategory(
          receiptData.description || '',
          receiptData.merchant,
          receiptData.amount || 0,
          categories,
          transactions
        );
        setCategorySuggestions(suggestions);

        // Auto-apply highest confidence suggestion
        if (suggestions.length > 0 && suggestions[0].confidence > 0.7) {
          setFormData(prev => ({ ...prev, categoryId: suggestions[0].categoryId }));
        }
      } catch {
        // Category suggestion fetch failed
      } finally {
        setIsLoadingSuggestions(false);
      }
    }
  };

  const handleSmartCategorization = async () => {
    if (!formData.description || !preferences.smartCategorizationEnabled) return;

    setIsLoadingSuggestions(true);
    try {
      const suggestions = await suggestCategory(
        formData.description,
        undefined,
        parseFloat(formData.amount) || 0,
        categories,
        transactions
      );
      setCategorySuggestions(suggestions);

      // Auto-apply highest confidence suggestion
      if (suggestions.length > 0 && suggestions[0].confidence > 0.7) {
        setFormData(prev => ({ ...prev, categoryId: suggestions[0].categoryId }));
      }
    } catch {
      // Category suggestion fetch failed
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount || !formData.typeId) return;

    const isTransfer = formData.typeId === 'type-transfer';
    const payload = {
      description: isTransfer && !formData.description
        ? `Transfer to ${accounts.find(a => a.id === formData.transferToAccountId)?.name || 'account'}`
        : formData.description,
      amount: Math.abs(parseFloat(formData.amount)),
      categoryId: formData.categoryId,
      typeId: formData.typeId,
      accountId: formData.accountId || undefined,
      date: formData.date,
      isRecurring: formData.isRecurring,
      frequency: formData.isRecurring ? formData.frequency : undefined,
      recurringEndDate: formData.isRecurring && formData.recurringEndDate ? formData.recurringEndDate : undefined,
      transferToAccountId: isTransfer ? formData.transferToAccountId || undefined : undefined
    };

    if (editingId) {
      onUpdate(editingId, payload);
    } else {
      onAdd(payload);
    }

    setFormData(defaultFormState);
    setIsAdding(false);
    setEditingId(null);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filters.typeId === 'all' || t.typeId === filters.typeId;
      const matchesCategory = filters.categoryId === 'all' || t.categoryId === filters.categoryId;
      const matchesAccount = filters.accountId === 'all' || t.accountId === filters.accountId;
      const matchesStartDate = !filters.startDate || t.date >= filters.startDate;
      const matchesEndDate = !filters.endDate || t.date <= filters.endDate;
      return matchesSearch && matchesType && matchesCategory && matchesAccount && matchesStartDate && matchesEndDate;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filters, searchQuery]);

  // Date grouping logic
  const groupedTransactions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const groups: { label: string; transactions: Transaction[] }[] = [];
    const todayItems: Transaction[] = [];
    const yesterdayItems: Transaction[] = [];
    const thisWeekItems: Transaction[] = [];
    const thisMonthItems: Transaction[] = [];
    const olderItems: Transaction[] = [];

    for (const t of filteredTransactions) {
      const d = new Date(t.date);
      d.setHours(0, 0, 0, 0);
      if (d.getTime() >= today.getTime()) {
        todayItems.push(t);
      } else if (d.getTime() >= yesterday.getTime()) {
        yesterdayItems.push(t);
      } else if (d.getTime() >= weekAgo.getTime()) {
        thisWeekItems.push(t);
      } else if (d.getTime() >= monthAgo.getTime()) {
        thisMonthItems.push(t);
      } else {
        olderItems.push(t);
      }
    }

    if (todayItems.length > 0) groups.push({ label: 'Today', transactions: todayItems });
    if (yesterdayItems.length > 0) groups.push({ label: 'Yesterday', transactions: yesterdayItems });
    if (thisWeekItems.length > 0) groups.push({ label: 'This Week', transactions: thisWeekItems });
    if (thisMonthItems.length > 0) groups.push({ label: 'This Month', transactions: thisMonthItems });
    if (olderItems.length > 0) groups.push({ label: 'Older', transactions: olderItems });

    return groups;
  }, [filteredTransactions]);

  // Bulk Selection Logic
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(filteredTransactions.map(t => t.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const executeBulkDelete = () => {
    onBulkDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const executeBulkMove = () => {
    onBulkCategoryUpdate(Array.from(selectedIds), targetCategory);
    setSelectedIds(new Set());
    setShowMoveModal(false);
  };

  const handleCategoryClick = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setTargetCategory(transaction.categoryId);
    setShowCategoryEditModal(true);
  };

  const handleCategoryUpdate = () => {
    if (editingTransaction && targetCategory) {
      onUpdate(editingTransaction.id, { categoryId: targetCategory });
      setShowCategoryEditModal(false);
      setEditingTransaction(null);
    }
  };

  const resetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      categoryId: 'all',
      typeId: 'all',
      accountId: 'all'
    });
    setSearchQuery('');
  };

  const hasActiveFilters = !!(filters.startDate || filters.endDate || filters.categoryId !== 'all' || filters.typeId !== 'all' || filters.accountId !== 'all' || searchQuery);
  const currentTypeBehavior = preferences.transactionTypes.find(t => t.id === formData.typeId)?.behavior;
  const allSelected = filteredTransactions.length > 0 && selectedIds.size === filteredTransactions.length;

  return (
    <div className="space-y-6 pb-20 relative min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--color-text-secondary)' }}>Financial History</h3>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Tracking {transactions.length} records in {preferences.currency}.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-3 rounded-2xl font-bold transition-all ${showFilters ? 'scale-[1.02]' : ''}`}
            style={showFilters
              ? { backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-card)', color: 'var(--color-text-secondary)' }
              : { backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', color: 'var(--color-text-tertiary)' }
            }
          >
            {showFilters ? '✕ Close Advanced' : '🔍 Advanced Filters'}
          </button>
          <button
            onClick={() => setShowReceiptScanner(true)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-6 py-3 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 shadow-lg flex items-center gap-2"
          >
            📸 Scan Receipt
          </button>
          {onOpenCSVImport && (
            <button
              onClick={onOpenCSVImport}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 shadow-lg flex items-center gap-2"
            >
              📁 Import CSV
            </button>
          )}
          <button
            onClick={() => {
              if (isAdding) cancelEdit();
              else {
                setEditingId(null);
                setFormData(defaultFormState);
                setIsAdding(true);
              }
            }}
            className="text-white px-8 py-3 rounded-2xl font-bold shadow-xl transition-all hover:scale-105 active:scale-95"
            style={{ backgroundColor: preferences.accentColor }}
          >
            {isAdding ? 'Close Form' : '+ Add Transaction'}
          </button>
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="p-6 md:p-8 rounded-[2rem] shadow-xl animate-in fade-in slide-in-from-top-4 duration-300 space-y-6" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)' }}>
          <div className="flex justify-between items-center mb-2">
             <h4 className="text-lg font-semibold uppercase tracking-tight" style={{ color: 'var(--color-text-secondary)' }}>
               {editingId ? 'Edit Transaction' : 'New Transaction'}
             </h4>
             {editingId && (
               <button type="button" onClick={cancelEdit} className="text-xs font-bold uppercase text-rose-500 tracking-wide">
                 Cancel Edit
               </button>
             )}
          </div>

          {/* Behavior Toggle */}
          <div className="flex flex-wrap items-center justify-center p-1.5 rounded-[1.5rem] w-full max-w-2xl mx-auto mb-4 gap-1" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
            {preferences.transactionTypes.map(type => (
              <button
                key={type.id}
                type="button"
                onClick={() => setFormData({...formData, typeId: type.id})}
                className={`flex-1 min-w-[110px] sm:min-w-[130px] px-3 py-2.5 rounded-xl text-xs sm:text-xs font-semibold uppercase tracking-wide transition-all ${
                  formData.typeId === type.id
                    ? 'shadow-sm scale-[1.02]'
                    : ''
                }`}
                style={formData.typeId === type.id
                  ? { backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }
                  : { color: 'var(--color-text-tertiary)' }
                }
              >
                {type.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wide px-2" style={{ color: 'var(--color-text-tertiary)' }}>Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="What was this for?"
                className="border-none rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2"
                style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wide px-2" style={{ color: 'var(--color-text-tertiary)' }}>Amount ({preferences.currency})</label>
              <input
                type="number"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
                placeholder="0.00"
                className="border-none rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2"
                style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wide px-2" style={{ color: 'var(--color-text-tertiary)' }}>Category</label>
              <select
                value={formData.categoryId}
                onChange={e => setFormData({...formData, categoryId: e.target.value})}
                className="border-none rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2"
                style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
              >
                <optgroup label="Income Streams">
                  {categories.filter(c => c.type === CategoryType.INCOME).map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </optgroup>
                <optgroup label="Spending & Goals">
                  {categories.filter(c => c.type !== CategoryType.INCOME).map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </optgroup>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wide px-2" style={{ color: 'var(--color-text-tertiary)' }}>Account</label>
              <select
                value={formData.accountId || ''}
                onChange={e => setFormData({...formData, accountId: e.target.value})}
                className="border-none rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2"
                style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
              >
                <option value="">No Account</option>
                {accounts.filter(a => !a.isHidden).map(a => (
                  <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
                ))}
              </select>
            </div>

            {/* Transfer destination account - only shown when type is Transfer */}
            {formData.typeId === 'type-transfer' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase tracking-wide px-2" style={{ color: 'var(--color-text-tertiary)' }}>To Account</label>
                <select
                  value={formData.transferToAccountId || ''}
                  onChange={e => setFormData({...formData, transferToAccountId: e.target.value})}
                  className="border-none rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
                  required
                >
                  <option value="">Select destination...</option>
                  {accounts.filter(a => !a.isHidden && a.id !== formData.accountId).map(a => (
                    <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wide px-2" style={{ color: 'var(--color-text-tertiary)' }}>
                {formData.isRecurring ? 'Start Date' : 'Date'}
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="border-none rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2"
                style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
              />
            </div>
          </div>

          <div className="pt-4 space-y-6" style={{ borderTop: '1px solid var(--color-bg-tertiary)' }}>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-3 cursor-pointer group px-5 py-3.5 rounded-2xl transition-all" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                <input
                  type="checkbox"
                  checked={formData.isRecurring}
                  onChange={e => setFormData({...formData, isRecurring: e.target.checked})}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 transition-all"
                  style={{ borderColor: 'var(--color-border-card)' }}
                />
                <span className="text-sm font-semibold uppercase tracking-tight" style={{ color: 'var(--color-text-secondary)' }}>Set as Recurring</span>
              </label>

              {formData.isRecurring && (
                <div className="flex flex-wrap items-center gap-4 animate-in slide-in-from-left-4 duration-500">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold uppercase tracking-wide px-1" style={{ color: 'var(--color-text-tertiary)' }}>Frequency</label>
                    <select
                      value={formData.frequency}
                      onChange={e => setFormData({...formData, frequency: e.target.value as RecurringFrequency})}
                      className="border-none rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wide outline-none focus:ring-2"
                      style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
                    >
                      {Object.values(RecurringFrequency).map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold uppercase tracking-wide px-1" style={{ color: 'var(--color-text-tertiary)' }}>End Date (Optional)</label>
                    <input
                      type="date"
                      value={formData.recurringEndDate}
                      onChange={e => setFormData({...formData, recurringEndDate: e.target.value})}
                      className="border-none rounded-xl px-4 py-2.5 text-xs font-semibold outline-none focus:ring-2"
                      style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
                    />
                  </div>

                  <div className="bg-indigo-50/50 border border-indigo-100 px-5 py-3 rounded-2xl flex flex-col justify-center">
                    <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide leading-none mb-1">Schedule Outlook</p>
                    <p className="text-xs font-bold text-indigo-700">
                      Next payment: <span className="font-semibold underline underline-offset-2">{calculateNextDate(formData.date, formData.frequency)}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 gap-3">
              {editingId && (
                <button type="button" onClick={cancelEdit} className="px-8 py-4 rounded-[1.5rem] font-semibold text-xs uppercase tracking-wide transition-all" style={{ color: 'var(--color-text-tertiary)' }}>
                    Cancel
                </button>
              )}
              <button type="submit" className="w-full sm:w-auto text-white px-12 py-4 rounded-[1.5rem] font-semibold text-xs uppercase tracking-wide transition-all shadow-xl active:scale-95" style={{ backgroundColor: 'var(--color-bg-sidebar)' }}>
                {editingId
                  ? 'Update Transaction'
                  : formData.isRecurring
                    ? (currentTypeBehavior === TransactionBehavior.INFLOW ? 'Confirm Recurring Earnings' : 'Confirm Recurring Payment')
                    : (currentTypeBehavior === TransactionBehavior.INFLOW ? 'Confirm Income Deposit' : 'Confirm Transaction Execution')
                }
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Persistent Search Bar & Clear Action */}
      <div className="flex flex-col gap-4">
        <div className="relative group flex-1">
          <span className="absolute left-6 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-tertiary)' }}>🔍</span>
          <input
            type="text"
            placeholder="Search by description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full rounded-[2rem] py-4 pl-14 pr-14 outline-none focus:ring-4 transition-all shadow-sm"
            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', color: 'var(--color-text-primary)' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-6 top-1/2 -translate-y-1/2 p-1"
              style={{ color: 'var(--color-text-tertiary)' }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2">
            <button
              onClick={resetFilters}
              className="flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-100 rounded-xl text-xs font-semibold uppercase text-rose-600 hover:bg-rose-100 transition-all tracking-wide"
            >
              <span>✕</span> Clear All Filters
            </button>
            <span className="text-xs font-bold italic" style={{ color: 'var(--color-text-tertiary)' }}>Showing filtered results</span>
          </div>
        )}
      </div>

      {/* Collapsible Advanced Filters Strip */}
      <div className={`space-y-4 animate-in fade-in duration-300 ${showFilters ? 'block' : 'hidden'}`}>
        <div className="flex flex-wrap items-center gap-4 p-4 rounded-[2rem] shadow-sm" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)' }}>
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-xs font-semibold uppercase tracking-wide px-2" style={{ color: 'var(--color-text-tertiary)' }}>From</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={e => setFilters({...filters, startDate: e.target.value})}
              className="rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
              style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
            />
          </div>
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-xs font-semibold uppercase tracking-wide px-2" style={{ color: 'var(--color-text-tertiary)' }}>To</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={e => setFilters({...filters, endDate: e.target.value})}
              className="rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
              style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
            />
          </div>
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-xs font-semibold uppercase tracking-wide px-2" style={{ color: 'var(--color-text-tertiary)' }}>Category</label>
            <select
              value={filters.categoryId}
              onChange={e => setFilters({...filters, categoryId: e.target.value})}
              className="rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
              style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
            >
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 min-w-[100px]">
            <label className="text-xs font-semibold uppercase tracking-wide px-2" style={{ color: 'var(--color-text-tertiary)' }}>Type</label>
            <select
              value={filters.typeId}
              onChange={e => setFilters({...filters, typeId: e.target.value})}
              className="rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
              style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
            >
              <option value="all">All Types</option>
              {preferences.transactionTypes.map(type => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-xs font-semibold uppercase tracking-wide px-2" style={{ color: 'var(--color-text-tertiary)' }}>Account</label>
            <select
              value={filters.accountId}
              onChange={e => setFilters({...filters, accountId: e.target.value})}
              className="rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
              style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
            >
              <option value="all">All Accounts</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.icon} {acc.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] shadow-sm overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead style={{ backgroundColor: 'var(--color-bg-tertiary)', borderBottom: '1px solid var(--color-border-card)' }}>
              <tr>
                <th className="px-6 py-5 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                      style={{ borderColor: 'var(--color-border-card)' }}
                    />
                </th>
                <th className="px-4 py-5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Date</th>
                <th className="px-4 py-5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Description</th>
                <th className="px-4 py-5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Account</th>
                <th className="px-4 py-5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Category</th>
                <th className="px-4 py-5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Type</th>
                <th className="px-4 py-5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Amount</th>
                <th className="px-4 py-5 text-right"></th>
              </tr>
            </thead>
            <tbody style={{ borderColor: 'var(--color-bg-tertiary)' }}>
              {groupedTransactions.length > 0 ? (
                groupedTransactions.map(group => (
                  <React.Fragment key={group.label}>
                    <tr>
                      <td colSpan={8} className="px-6 py-3" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                            {group.label}
                          </span>
                          <span className="text-xs font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>
                            {group.transactions.length} {group.transactions.length === 1 ? 'transaction' : 'transactions'}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {group.transactions.map(t => {
                      const cat = categories.find(c => c.id === t.categoryId);
                      const acc = accounts.find(a => a.id === t.accountId);
                      const typeDef = preferences.transactionTypes.find(type => type.id === t.typeId);
                      const behaviorIcon = typeDef?.behavior === TransactionBehavior.INFLOW ? '+' :
                                         typeDef?.behavior === TransactionBehavior.OUTFLOW ? '-' : '';
                      const behaviorColor = typeDef?.behavior === TransactionBehavior.INFLOW ? 'text-emerald-600' :
                                          typeDef?.behavior === TransactionBehavior.OUTFLOW ? '' : '';
                      const isSelected = selectedIds.has(t.id);
                      const isEditing = editingId === t.id;

                      return (
                        <tr
                          key={t.id}
                          className={`transition-colors group ${isSelected || isEditing ? 'bg-indigo-50/50' : ''}`}
                          style={{ borderBottom: '1px solid var(--color-bg-tertiary)' }}
                        >
                          <td className="px-6 py-4 text-center">
                             <input
                               type="checkbox"
                               checked={isSelected}
                               onChange={() => handleSelectOne(t.id)}
                               className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                               style={{ borderColor: 'var(--color-border-card)' }}
                             />
                          </td>
                          <td className="px-4 py-4 text-xs font-bold whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>{new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold" style={{ color: 'var(--color-text-secondary)' }}>{t.description}</span>
                              {t.isRecurring && (
                                <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full border border-indigo-100 shadow-sm">
                                  <span className="text-[8px] font-semibold uppercase tracking-wide">Recurring</span>
                                  <span className="text-[8px] font-bold opacity-60">({t.frequency})</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {acc ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{acc.icon}</span>
                                <span className="text-xs font-bold" style={{ color: 'var(--color-text-tertiary)' }}>{acc.name}</span>
                              </div>
                            ) : (
                              <span className="text-xs italic" style={{ color: 'var(--color-text-tertiary)' }}>No account</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => handleCategoryClick(t)}
                              className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide flex items-center gap-2 transition-all hover:scale-110 active:scale-95 whitespace-nowrap"
                              style={{ backgroundColor: cat?.color ? cat.color + '15' : 'var(--color-bg-tertiary)', color: cat?.color || 'var(--color-text-tertiary)' }}
                              title="Click to change category"
                            >
                              {cat?.icon || '📦'} {cat?.name || 'Uncategorized'}
                            </button>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded-lg whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)', backgroundColor: 'var(--color-bg-tertiary)' }}>
                              {typeDef?.label || 'Unknown'}
                            </span>
                          </td>
                          <td className={`px-4 py-4 text-sm font-semibold ${behaviorColor} ${preferences.privacyMode ? 'blur-sm hover:blur-none' : ''}`} style={typeDef?.behavior !== TransactionBehavior.INFLOW && typeDef?.behavior !== TransactionBehavior.OUTFLOW ? { color: 'var(--color-text-tertiary)' } : typeDef?.behavior === TransactionBehavior.OUTFLOW ? { color: 'var(--color-text-secondary)' } : undefined}>
                            {behaviorIcon}{preferences.currency}{Math.abs(t.amount).toFixed(2)}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                <button
                                    onClick={() => startEdit(t)}
                                    className="p-2 rounded-lg hover:bg-indigo-50"
                                    style={{ color: 'var(--color-text-tertiary)' }}
                                    title="Edit"
                                >
                                    ✏️
                                </button>
                                <button
                                    onClick={() => onDelete(t.id)}
                                    className="p-2 rounded-lg hover:bg-rose-50 hover:text-rose-500"
                                    style={{ color: 'var(--color-text-tertiary)' }}
                                    title="Delete"
                                >
                                    🗑️
                                </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-8 py-20 text-center italic font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                    No transactions found for these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Result Count Badge */}
      <div className="flex justify-end pr-4">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
          Results: {filteredTransactions.length}
        </span>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
         <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-6">
            <div className="text-white rounded-2xl shadow-2xl p-2 pl-6 flex items-center gap-4" style={{ backgroundColor: 'var(--color-bg-sidebar)', border: '1px solid var(--color-border-card)' }}>
               <div className="flex flex-col">
                  <span className="text-xs font-semibold uppercase tracking-wide text-indigo-400">Selection</span>
                  <span className="text-sm font-bold">{selectedIds.size} Records</span>
               </div>
               <div className="h-8 w-px" style={{ backgroundColor: 'var(--color-border-card)' }}></div>
               <div className="flex gap-2">
                  <button
                     onClick={() => setShowMoveModal(true)}
                     className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-semibold text-xs uppercase tracking-wide transition-all active:scale-95"
                  >
                     Move Category
                  </button>
                  <button
                     onClick={executeBulkDelete}
                     className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2.5 rounded-xl font-semibold text-xs uppercase tracking-wide transition-all active:scale-95"
                  >
                     Delete
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* MOVE CATEGORY MODAL */}
      {showMoveModal && (
         <div className="fixed inset-0 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
             <div className="rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                 <div className="text-center space-y-2">
                    <h4 className="text-lg font-semibold uppercase tracking-tight" style={{ color: 'var(--color-text-primary)' }}>Reassign Category</h4>
                    <p className="text-xs font-bold" style={{ color: 'var(--color-text-tertiary)' }}>Move {selectedIds.size} transactions to a new group.</p>
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wide px-2" style={{ color: 'var(--color-text-tertiary)' }}>Target Category</label>
                    <select
                        value={targetCategory}
                        onChange={e => setTargetCategory(e.target.value)}
                        className="w-full rounded-xl px-4 py-3 text-sm font-bold outline-none"
                        style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
                    >
                        {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                 </div>

                 <div className="flex gap-3 pt-2">
                    <button
                       onClick={() => setShowMoveModal(false)}
                       className="flex-1 py-3 font-bold text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}
                    >
                       Cancel
                    </button>
                    <button
                       onClick={executeBulkMove}
                       className="flex-1 text-white rounded-xl font-bold text-xs uppercase tracking-wide"
                       style={{ backgroundColor: 'var(--color-bg-sidebar)' }}
                    >
                       Confirm Move
                    </button>
                 </div>
             </div>
         </div>
      )}

      {/* QUICK CATEGORY EDIT MODAL */}
      {showCategoryEditModal && editingTransaction && (
        <div className="fixed inset-0 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <div className="text-center space-y-2">
              <h4 className="text-lg font-semibold uppercase tracking-tight" style={{ color: 'var(--color-text-primary)' }}>Change Category</h4>
              <p className="text-xs font-bold" style={{ color: 'var(--color-text-tertiary)' }}>
                Update category for: <span style={{ color: 'var(--color-text-primary)' }}>{editingTransaction.description}</span>
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wide px-2" style={{ color: 'var(--color-text-tertiary)' }}>Select Category</label>
              <select
                value={targetCategory}
                onChange={e => setTargetCategory(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm font-bold outline-none"
                style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
              >
                {categories.map(c => {
                  const isCurrent = c.id === editingTransaction.categoryId;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name} {isCurrent ? '(current)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Show selected category details */}
            {(() => {
              const selectedCat = categories.find(c => c.id === targetCategory);
              if (!selectedCat) return null;

              return (
                <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-card)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{selectedCat.icon}</span>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{selectedCat.name}</p>
                        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
                          {selectedCat.type}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold" style={{ color: 'var(--color-text-tertiary)' }}>Budget</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{preferences.currency}{selectedCat.budget}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowCategoryEditModal(false);
                  setEditingTransaction(null);
                }}
                className="flex-1 py-3 font-bold text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCategoryUpdate}
                className="flex-1 text-white rounded-xl py-3 font-bold text-xs uppercase tracking-wide"
                style={{ backgroundColor: 'var(--color-bg-sidebar)' }}
              >
                Update Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Scanner Modal */}
      {showReceiptScanner && (
        <ReceiptScanner
          onReceiptScanned={handleReceiptScanned}
          onCancel={() => setShowReceiptScanner(false)}
        />
      )}
    </div>
  );
};
