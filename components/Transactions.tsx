
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, Category, TransactionBehavior, RecurringFrequency, UserPreferences, CategoryType } from '../types';

interface TransactionsProps {
  transactions: Transaction[];
  categories: Category[];
  onAdd: (transaction: Omit<Transaction, 'id'>) => void;
  onUpdate: (id: string, updates: Partial<Transaction>) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkCategoryUpdate: (ids: string[], categoryId: string) => void;
  onNavigateToCategory: (categoryId: string) => void;
  preferences: UserPreferences;
  initialConfig?: { mode: 'add', behavior: TransactionBehavior } | null;
  onClearConfig: () => void;
}

export const Transactions: React.FC<TransactionsProps> = ({ 
  transactions, 
  categories, 
  onAdd,
  onUpdate,
  onDelete,
  onBulkDelete,
  onBulkCategoryUpdate,
  onNavigateToCategory,
  preferences,
  initialConfig,
  onClearConfig
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [targetCategory, setTargetCategory] = useState(categories[0]?.id || '');

  // Default to first transaction type behavior
  const initialType = preferences.transactionTypes[0];

  const defaultFormState = {
    description: '',
    amount: '',
    categoryId: categories[0]?.id || '',
    typeId: initialType?.id || '',
    date: new Date().toISOString().split('T')[0],
    isRecurring: false,
    frequency: RecurringFrequency.MONTHLY,
    recurringEndDate: ''
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
    typeId: 'all'
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
      date: t.date,
      isRecurring: t.isRecurring || false,
      frequency: t.frequency || RecurringFrequency.MONTHLY,
      recurringEndDate: t.recurringEndDate || ''
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount || !formData.typeId) return;
    
    const payload = {
      description: formData.description,
      amount: parseFloat(formData.amount),
      categoryId: formData.categoryId,
      typeId: formData.typeId,
      date: formData.date,
      isRecurring: formData.isRecurring,
      frequency: formData.isRecurring ? formData.frequency : undefined,
      recurringEndDate: formData.isRecurring && formData.recurringEndDate ? formData.recurringEndDate : undefined
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
      const matchesStartDate = !filters.startDate || t.date >= filters.startDate;
      const matchesEndDate = !filters.endDate || t.date <= filters.endDate;
      return matchesSearch && matchesType && matchesCategory && matchesStartDate && matchesEndDate;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filters, searchQuery]);

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

  const resetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      categoryId: 'all',
      typeId: 'all'
    });
    setSearchQuery('');
  };

  const hasActiveFilters = !!(filters.startDate || filters.endDate || filters.categoryId !== 'all' || filters.typeId !== 'all' || searchQuery);
  const currentTypeBehavior = preferences.transactionTypes.find(t => t.id === formData.typeId)?.behavior;
  const allSelected = filteredTransactions.length > 0 && selectedIds.size === filteredTransactions.length;

  return (
    <div className="space-y-6 pb-20 relative min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Financial History</h3>
          <p className="text-sm text-slate-500 font-medium">Tracking {transactions.length} records in {preferences.currency}.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-3 rounded-2xl font-bold transition-all border ${showFilters ? 'bg-slate-200 border-slate-300 text-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200'}`}
          >
            {showFilters ? '✕ Close Advanced' : '🔍 Advanced Filters'}
          </button>
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
        <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300 space-y-6">
          <div className="flex justify-between items-center mb-2">
             <h4 className="text-lg font-black uppercase text-slate-800 tracking-tight">
               {editingId ? 'Edit Transaction' : 'New Transaction'}
             </h4>
             {editingId && (
               <button type="button" onClick={cancelEdit} className="text-[10px] font-bold uppercase text-rose-500 tracking-widest">
                 Cancel Edit
               </button>
             )}
          </div>

          {/* Behavior Toggle */}
          <div className="flex flex-wrap items-center justify-center bg-slate-100 p-1.5 rounded-[1.5rem] w-full max-w-2xl mx-auto mb-4 gap-1">
            {preferences.transactionTypes.map(type => (
              <button
                key={type.id}
                type="button"
                onClick={() => setFormData({...formData, typeId: type.id})}
                className={`flex-1 min-w-[110px] sm:min-w-[130px] px-3 py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${
                  formData.typeId === type.id 
                    ? 'bg-white text-slate-900 shadow-sm scale-[1.02]' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Description</label>
              <input 
                type="text" 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="What was this for?" 
                className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 ring-indigo-500/20"
                required
              />
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Amount ({preferences.currency})</label>
              <input 
                type="number" 
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
                placeholder="0.00" 
                className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 ring-indigo-500/20"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Category</label>
              <select 
                value={formData.categoryId}
                onChange={e => setFormData({...formData, categoryId: e.target.value})}
                className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 ring-indigo-500/20"
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
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
                {formData.isRecurring ? 'Start Date' : 'Date'}
              </label>
              <input 
                type="date" 
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-50 space-y-6">
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-3 cursor-pointer group bg-slate-50 px-5 py-3.5 rounded-2xl transition-all hover:bg-slate-100">
                <input 
                  type="checkbox"
                  checked={formData.isRecurring}
                  onChange={e => setFormData({...formData, isRecurring: e.target.checked})}
                  className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 transition-all"
                />
                <span className="text-sm font-black text-slate-700 uppercase tracking-tight">Set as Recurring</span>
              </label>

              {formData.isRecurring && (
                <div className="flex flex-wrap items-center gap-4 animate-in slide-in-from-left-4 duration-500">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Frequency</label>
                    <select 
                      value={formData.frequency}
                      onChange={e => setFormData({...formData, frequency: e.target.value as RecurringFrequency})}
                      className="bg-slate-100 border-none rounded-xl px-4 py-2.5 text-[11px] font-black text-slate-900 uppercase tracking-widest outline-none focus:ring-2 ring-indigo-500/10"
                    >
                      {Object.values(RecurringFrequency).map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">End Date (Optional)</label>
                    <input 
                      type="date" 
                      value={formData.recurringEndDate}
                      onChange={e => setFormData({...formData, recurringEndDate: e.target.value})}
                      className="bg-slate-100 border-none rounded-xl px-4 py-2.5 text-[11px] font-black text-slate-900 outline-none focus:ring-2 ring-indigo-500/10"
                    />
                  </div>

                  <div className="bg-indigo-50/50 border border-indigo-100 px-5 py-3 rounded-2xl flex flex-col justify-center">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] leading-none mb-1">Schedule Outlook</p>
                    <p className="text-[11px] font-bold text-indigo-700">
                      Next payment: <span className="font-black underline underline-offset-2">{calculateNextDate(formData.date, formData.frequency)}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end pt-2 gap-3">
              {editingId && (
                <button type="button" onClick={cancelEdit} className="px-8 py-4 rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] text-slate-500 hover:text-slate-800 transition-all">
                    Cancel
                </button>
              )}
              <button type="submit" className="w-full sm:w-auto bg-slate-900 text-white px-12 py-4 rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl active:scale-95">
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
          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input 
            type="text"
            placeholder="Search by description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-[2rem] py-4 pl-14 pr-14 text-slate-900 outline-none focus:ring-4 ring-indigo-500/10 transition-all shadow-sm"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 p-1"
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
              className="flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-100 rounded-xl text-[10px] font-black uppercase text-rose-600 hover:bg-rose-100 transition-all tracking-widest"
            >
              <span>✕</span> Clear All Filters
            </button>
            <span className="text-[10px] font-bold text-slate-400 italic">Showing filtered results</span>
          </div>
        )}
      </div>

      {/* Collapsible Advanced Filters Strip */}
      <div className={`space-y-4 animate-in fade-in duration-300 ${showFilters ? 'block' : 'hidden'}`}>
        <div className="flex flex-wrap items-center gap-4 bg-white/50 border border-slate-200 p-4 rounded-[2rem] shadow-sm">
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">From</label>
            <input 
              type="date" 
              value={filters.startDate}
              onChange={e => setFilters({...filters, startDate: e.target.value})}
              className="bg-white border border-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 outline-none"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">To</label>
            <input 
              type="date" 
              value={filters.endDate}
              onChange={e => setFilters({...filters, endDate: e.target.value})}
              className="bg-white border border-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 outline-none"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Category</label>
            <select 
              value={filters.categoryId}
              onChange={e => setFilters({...filters, categoryId: e.target.value})}
              className="bg-white border border-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 min-w-[100px]">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Type</label>
            <select 
              value={filters.typeId}
              onChange={e => setFilters({...filters, typeId: e.target.value})}
              className="bg-white border border-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 outline-none"
            >
              <option value="all">All Types</option>
              {preferences.transactionTypes.map(type => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 w-12 text-center">
                    <input 
                      type="checkbox" 
                      checked={allSelected} 
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                    />
                </th>
                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Date</th>
                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Description</th>
                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Category</th>
                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Type</th>
                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Amount</th>
                <th className="px-4 py-5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map(t => {
                  const cat = categories.find(c => c.id === t.categoryId);
                  const typeDef = preferences.transactionTypes.find(type => type.id === t.typeId);
                  const behaviorIcon = typeDef?.behavior === TransactionBehavior.INFLOW ? '+' : 
                                     typeDef?.behavior === TransactionBehavior.OUTFLOW ? '-' : '';
                  const behaviorColor = typeDef?.behavior === TransactionBehavior.INFLOW ? 'text-emerald-600' : 
                                      typeDef?.behavior === TransactionBehavior.OUTFLOW ? 'text-slate-800' : 'text-slate-400';
                  const isSelected = selectedIds.has(t.id);
                  const isEditing = editingId === t.id;

                  return (
                    <tr 
                      key={t.id} 
                      className={`transition-colors group ${isSelected || isEditing ? 'bg-indigo-50/50' : 'hover:bg-slate-50/50'}`}
                    >
                      <td className="px-6 py-4 text-center">
                         <input 
                           type="checkbox" 
                           checked={isSelected}
                           onChange={() => handleSelectOne(t.id)}
                           className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                         />
                      </td>
                      <td className="px-4 py-4 text-xs font-bold text-slate-400 whitespace-nowrap">{new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800">{t.description}</span>
                          {t.isRecurring && (
                            <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full border border-indigo-100 shadow-sm">
                              <span className="text-[8px] font-black uppercase tracking-widest">Recurring</span>
                              <span className="text-[8px] font-bold opacity-60">({t.frequency})</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <button 
                          onClick={() => onNavigateToCategory(t.categoryId)}
                          className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-110 active:scale-95 whitespace-nowrap"
                          style={{ backgroundColor: (cat?.color || '#94a3b8') + '15', color: cat?.color || '#94a3b8' }}
                        >
                          {cat?.icon || '📦'} {cat?.name || 'Uncategorized'}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-lg whitespace-nowrap">
                          {typeDef?.label || 'Unknown'}
                        </span>
                      </td>
                      <td className={`px-4 py-4 text-sm font-black ${behaviorColor} ${preferences.privacyMode ? 'blur-sm hover:blur-none' : ''}`}>
                        {behaviorIcon}{preferences.currency}{t.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button 
                                onClick={() => startEdit(t)} 
                                className="text-slate-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50"
                                title="Edit"
                            >
                                ✏️
                            </button>
                            <button 
                                onClick={() => onDelete(t.id)} 
                                className="text-slate-300 hover:text-rose-500 p-2 rounded-lg hover:bg-rose-50"
                                title="Delete"
                            >
                                🗑️
                            </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center text-slate-400 italic font-medium">
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
        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
          Results: {filteredTransactions.length}
        </span>
      </div>

      {/* TACTICAL BULK ACTION BAR */}
      {selectedIds.size > 0 && (
         <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-6">
            <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-2 pl-6 flex items-center gap-4 border border-slate-700">
               <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Selection</span>
                  <span className="text-sm font-bold">{selectedIds.size} Records</span>
               </div>
               <div className="h-8 w-px bg-slate-700"></div>
               <div className="flex gap-2">
                  <button 
                     onClick={() => setShowMoveModal(true)}
                     className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                  >
                     Move Category
                  </button>
                  <button 
                     onClick={executeBulkDelete}
                     className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                  >
                     Delete
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* MOVE CATEGORY MODAL */}
      {showMoveModal && (
         <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in">
             <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
                 <div className="text-center space-y-2">
                    <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Reassign Category</h4>
                    <p className="text-xs text-slate-500 font-bold">Move {selectedIds.size} transactions to a new group.</p>
                 </div>
                 
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Target Category</label>
                    <select 
                        value={targetCategory}
                        onChange={e => setTargetCategory(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none"
                    >
                        {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                 </div>

                 <div className="flex gap-3 pt-2">
                    <button 
                       onClick={() => setShowMoveModal(false)}
                       className="flex-1 py-3 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600"
                    >
                       Cancel
                    </button>
                    <button 
                       onClick={executeBulkMove}
                       className="flex-1 bg-slate-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-800"
                    >
                       Confirm Move
                    </button>
                 </div>
             </div>
         </div>
      )}
    </div>
  );
};
