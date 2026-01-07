
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, Category, TransactionBehavior, RecurringFrequency, UserPreferences, CategoryType } from '../types';

interface TransactionsProps {
  transactions: Transaction[];
  categories: Category[];
  onAdd: (transaction: Omit<Transaction, 'id'>) => void;
  onDelete: (id: string) => void;
  onNavigateToCategory: (categoryId: string) => void;
  preferences: UserPreferences;
}

export const Transactions: React.FC<TransactionsProps> = ({ 
  transactions, 
  categories, 
  onAdd, 
  onDelete,
  onNavigateToCategory,
  preferences
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Default to first transaction type behavior
  const initialType = preferences.transactionTypes[0];

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    categoryId: categories[0]?.id || '',
    typeId: initialType?.id || '',
    date: new Date().toISOString().split('T')[0],
    isRecurring: false,
    frequency: RecurringFrequency.MONTHLY,
    recurringEndDate: ''
  });

  // Auto-switch type behavior when category changes
  useEffect(() => {
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
  }, [formData.categoryId, categories, preferences.transactionTypes]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount || !formData.typeId) return;
    onAdd({
      description: formData.description,
      amount: parseFloat(formData.amount),
      categoryId: formData.categoryId,
      typeId: formData.typeId,
      date: formData.date,
      isRecurring: formData.isRecurring,
      frequency: formData.isRecurring ? formData.frequency : undefined,
      recurringEndDate: formData.isRecurring && formData.recurringEndDate ? formData.recurringEndDate : undefined
    });
    setFormData({ 
      ...formData, 
      description: '', 
      amount: '', 
      isRecurring: false,
      recurringEndDate: ''
    });
    setIsAdding(false);
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

  return (
    <div className="space-y-6 pb-20">
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
            onClick={() => setIsAdding(!isAdding)}
            className="text-white px-8 py-3 rounded-2xl font-bold shadow-xl transition-all hover:scale-105 active:scale-95"
            style={{ backgroundColor: preferences.accentColor }}
          >
            {isAdding ? 'Close' : '+ Add Transaction'}
          </button>
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300 space-y-6">
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
                className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 ring-indigo-500/20"
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
                className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 ring-indigo-500/20"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Category</label>
              <select 
                value={formData.categoryId}
                onChange={e => setFormData({...formData, categoryId: e.target.value})}
                className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 ring-indigo-500/20"
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
                className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 ring-indigo-500/20"
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
                      className="bg-slate-100 border-none rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-widest outline-none focus:ring-2 ring-indigo-500/10"
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
                      className="bg-slate-100 border-none rounded-xl px-4 py-2.5 text-[11px] font-black outline-none focus:ring-2 ring-indigo-500/10"
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
            
            <div className="flex justify-end pt-2">
              <button type="submit" className="w-full sm:w-auto bg-slate-900 text-white px-12 py-4 rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl active:scale-95">
                {currentTypeBehavior === TransactionBehavior.INFLOW ? 'Confirm Recurring Earnings' : 'Confirm Transaction Execution'}
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
            className="w-full bg-white border border-slate-200 rounded-[2rem] py-4 pl-14 pr-14 outline-none focus:ring-4 ring-indigo-500/10 transition-all shadow-sm"
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
              className="bg-white border border-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">To</label>
            <input 
              type="date" 
              value={filters.endDate}
              onChange={e => setFilters({...filters, endDate: e.target.value})}
              className="bg-white border border-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Category</label>
            <select 
              value={filters.categoryId}
              onChange={e => setFilters({...filters, categoryId: e.target.value})}
              className="bg-white border border-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
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
              className="bg-white border border-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
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
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Date</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Description</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Category</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Type</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Amount</th>
                <th className="px-8 py-5 text-right"></th>
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

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-4 text-xs font-bold text-slate-400">{new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                      <td className="px-8 py-4">
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
                      <td className="px-8 py-4">
                        <button 
                          onClick={() => onNavigateToCategory(t.categoryId)}
                          className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-110 active:scale-95"
                          style={{ backgroundColor: (cat?.color || '#94a3b8') + '15', color: cat?.color || '#94a3b8' }}
                        >
                          {cat?.icon || '📦'} {cat?.name || 'Uncategorized'}
                        </button>
                      </td>
                      <td className="px-8 py-4">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-lg">
                          {typeDef?.label || 'Unknown'}
                        </span>
                      </td>
                      <td className={`px-8 py-4 text-sm font-black ${behaviorColor} ${preferences.privacyMode ? 'blur-sm hover:blur-none' : ''}`}>
                        {behaviorIcon}{preferences.currency}{t.amount.toLocaleString()}
                      </td>
                      <td className="px-8 py-4 text-right">
                        <button onClick={() => onDelete(t.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-2 rounded-lg hover:bg-rose-50">🗑️</button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-slate-400 italic font-medium">
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
    </div>
  );
};
