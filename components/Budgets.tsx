
import React, { useState } from 'react';
import { Category, Transaction, UserPreferences, CategoryType, BudgetSuggestion, Account } from '../types';
import { getBudgetSuggestions } from '../services/geminiService';

interface BudgetsProps {
  categories: Category[];
  transactions: Transaction[];
  accounts: Account[];
  onUpdateCategory: (id: string, updates: Partial<Category>) => void;
  onAddCategory: (cat: Omit<Category, 'id'>) => void;
  onDeleteCategory: (id: string) => void;
  onUpdatePreferences: (updates: Partial<UserPreferences>) => void;
  preferences: UserPreferences;
}

const ICONS = [
  '🏠', '🍽️', '🚗', '💰', '💳', '🏦', '🏥', '✈️', '🎮', '👗', '🎓', '🎁', '🛒', '🔧', '👶', '🐾', '💻', '📱', '🏋️', '📚',
  '☕', '🍔', '🍺', '⛽', '🚕', '🚌', '🚅', '🎢', '🎬', '🎨', '🎸', '📷', '💡', '💧', '🔥', '📡', '🛡️', '💊', '🕶️', '💍'
];

export const Budgets: React.FC<BudgetsProps> = ({
  categories,
  transactions,
  accounts,
  onUpdateCategory,
  onAddCategory,
  onDeleteCategory,
  onUpdatePreferences,
  preferences
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newCat, setNewCat] = useState({
    name: '',
    icon: '📁',
    color: '#6366f1',
    budget: 0,
    type: CategoryType.SPENDING,
    initialBalance: 0
  });
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [pickingIconForId, setPickingIconForId] = useState<string | null>(null); // For editing existing
  const [pickingIconNew, setPickingIconNew] = useState(false); // For new category

  // Filter and Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<CategoryType | 'ALL'>('ALL');
  const [accountFilter, setAccountFilter] = useState<string>('all');

  // AI Suggestion State
  const [suggestions, setSuggestions] = useState<BudgetSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fetchSuggestions = async () => {
    if (showSuggestions && suggestions.length > 0) {
        setShowSuggestions(false);
        return;
    }
    
    setIsLoadingSuggestions(true);
    setShowSuggestions(true);
    try {
        const results = await getBudgetSuggestions(transactions, categories);
        setSuggestions(results);
    } catch {
        // AI suggestion fetch failed
    } finally {
        setIsLoadingSuggestions(false);
    }
  };

  const applySuggestion = (s: BudgetSuggestion) => {
    const cat = categories.find(c => c.id === s.categoryId);
    if (!cat) return;
    
    // For DEBT type, the 'budget' property is often treated as 'initialBalance' or total goal in the UI logic,
    // but for the sake of AI suggestions, we update the primary tracking number.
    // If it's spending, 'budget' is the limit.
    // If it's savings, 'budget' is the goal.
    onUpdateCategory(s.categoryId, { budget: s.suggestedAmount });
    
    setSuggestions(prev => prev.filter(item => item.categoryId !== s.categoryId));
  };

  const dismissSuggestions = () => {
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const getTargetLabel = (type: CategoryType) => {
    switch (type) {
      case CategoryType.SAVINGS:
      case CategoryType.INCOME:
        return "Goal";
      case CategoryType.DEBT:
        return "Total Debt";
      default:
        return "Budget";
    }
  };

  const getCategoryProgress = (cat: Category) => {
    let relevantTransactions = transactions.filter(t => t.categoryId === cat.id);

    // Filter by account if not 'all'
    if (accountFilter !== 'all') {
      relevantTransactions = relevantTransactions.filter(t => t.accountId === accountFilter);
    }

    // For spending categories, scope to current month and compute rollover
    if (cat.type === CategoryType.SPENDING) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const currentMonthAmount = relevantTransactions
        .filter(t => { const d = new Date(t.date); return d >= monthStart && d <= monthEnd; })
        .reduce((sum, t) => sum + t.amount, 0);

      let effectiveBudget = cat.budget;
      let rolloverAmount = 0;

      if (preferences.budgetRollover && cat.budget > 0) {
        // Calculate last month's unused budget
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        const lastMonthSpent = relevantTransactions
          .filter(t => { const d = new Date(t.date); return d >= lastMonthStart && d <= lastMonthEnd; })
          .reduce((sum, t) => sum + t.amount, 0);
        rolloverAmount = Math.max(0, cat.budget - lastMonthSpent);
        effectiveBudget = cat.budget + rolloverAmount;
      }

      const spendPerc = effectiveBudget > 0 ? (currentMonthAmount / effectiveBudget) * 100 : 0;
      return {
        current: currentMonthAmount,
        target: effectiveBudget,
        percentage: spendPerc,
        label: 'Spent',
        isOver: spendPerc > 100,
        rollover: rolloverAmount
      };
    }

    const amount = relevantTransactions.reduce((sum, t) => sum + t.amount, 0);

    switch (cat.type) {
      case CategoryType.DEBT:
        const remaining = Math.max(0, (cat.initialBalance || 0) - amount);
        const debtPaid = (cat.initialBalance || 0) - remaining;
        const debtPerc = cat.initialBalance && cat.initialBalance > 0
          ? (debtPaid / cat.initialBalance) * 100
          : 100;
        return { current: debtPaid, target: cat.initialBalance, percentage: debtPerc, label: 'Paid Off', isOver: false, rollover: 0 };

      case CategoryType.SAVINGS:
        const savePerc = cat.budget > 0 ? (amount / cat.budget) * 100 : 0;
        return { current: amount, target: cat.budget, percentage: savePerc, label: 'Saved', isOver: false, rollover: 0 };

      case CategoryType.INCOME:
        const incPerc = cat.budget > 0 ? (amount / cat.budget) * 100 : 0;
        return { current: amount, target: cat.budget, percentage: incPerc, label: 'Earned', isOver: false, rollover: 0 };

      default:
        return { current: amount, target: cat.budget, percentage: 0, label: 'Spent', isOver: false, rollover: 0 };
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.name) return;
    onAddCategory(newCat);
    setNewCat({ name: '', icon: '📁', color: '#6366f1', budget: 0, type: CategoryType.SPENDING, initialBalance: 0 });
    setIsAdding(false);
    setPickingIconNew(false);
  };

  const IconPicker = ({ onSelect, onClose }: { onSelect: (icon: string) => void, onClose: () => void }) => (
    <div className="absolute inset-0 z-50 bg-slate-900/10 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
        <div className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Select Icon</h4>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto">
                {ICONS.map(icon => (
                    <button 
                        key={icon}
                        onClick={() => onSelect(icon)}
                        className="text-2xl p-2 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        {icon}
                    </button>
                ))}
            </div>
        </div>
    </div>
  );

  const renderCategoryCard = (cat: Category) => {
    const progress = getCategoryProgress(cat);
    
    return (
      <div key={cat.id} className="group relative bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
        <div className="p-6 space-y-4 transition-all group-hover:opacity-40">
          <div className="flex items-center gap-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-inner shrink-0 cursor-pointer hover:scale-110 transition-transform"
              style={{ backgroundColor: cat.color + '10', color: cat.color }}
              onClick={(e) => { e.stopPropagation(); setPickingIconForId(cat.id); }}
            >
              {cat.icon}
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-slate-800 truncate text-base">{cat.name}</h4>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">
                {getTargetLabel(cat.type)}: <span className="text-slate-900">{preferences.currency}{(cat.type === CategoryType.DEBT ? cat.initialBalance : cat.budget)?.toFixed(2)}</span>
                {progress.rollover > 0 && (
                  <span className="text-emerald-600 ml-1">(+{preferences.currency}{progress.rollover.toFixed(0)} rollover)</span>
                )}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide">
              <span className="text-slate-400">{progress.label}: <span className={`text-slate-900 ${preferences.privacyMode ? 'blur-sm' : ''}`}>{preferences.currency}{progress.current.toFixed(2)}</span></span>
              <span className={progress.isOver ? 'text-rose-500' : (cat.type === CategoryType.SAVINGS || cat.type === CategoryType.INCOME) && progress.percentage >= 100 ? 'text-emerald-600' : 'text-slate-400'}>
                {Math.round(progress.percentage)}%
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-500 rounded-full"
                style={{ 
                  width: `${Math.min(progress.percentage, 100)}%`, 
                  backgroundColor: progress.isOver ? '#ef4444' : cat.color 
                }}
              />
            </div>
          </div>
        </div>

        {/* Overlay Controls */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-6 space-y-4 pointer-events-none">
          <div className="w-full space-y-1 pointer-events-auto">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide text-center block">
              Update {getTargetLabel(cat.type)}
            </label>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-lg">
              <span className="text-slate-400 text-xs font-bold">{preferences.currency}</span>
              <input 
                type="number"
                value={(cat.type === CategoryType.DEBT ? cat.initialBalance : cat.budget) || ''}
                placeholder="0"
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                  onUpdateCategory(cat.id, cat.type === CategoryType.DEBT ? { initialBalance: val } : { budget: val });
                }}
                className="w-full bg-transparent text-sm font-bold text-slate-800 outline-none"
              />
            </div>
          </div>

          <div className="flex gap-2 w-full pointer-events-auto">
            <button 
              onClick={() => setEditingNameId(cat.id)}
              className="flex-1 bg-white border border-slate-200 text-slate-600 py-2 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-slate-50"
            >
              Rename
            </button>
             <button 
              onClick={() => setPickingIconForId(cat.id)}
              className="flex-1 bg-white border border-slate-200 text-slate-600 py-2 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-slate-50"
            >
              Icon
            </button>
            <button 
              onClick={() => { if (confirm(`Delete category?`)) onDeleteCategory(cat.id); }}
              className="flex-1 bg-rose-50 text-rose-600 py-2 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-rose-100"
            >
              Delete
            </button>
          </div>
        </div>

        {editingNameId === cat.id && (
          <div className="absolute inset-0 z-20 bg-white p-6 flex flex-col justify-center animate-in fade-in zoom-in-95">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Category Name</label>
            <input 
              type="text"
              value={cat.name}
              autoFocus
              onChange={(e) => onUpdateCategory(cat.id, { name: e.target.value })}
              onBlur={() => setEditingNameId(null)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingNameId(null)}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-base font-bold text-slate-800 outline-none mb-4"
            />
            <button 
              onClick={() => setEditingNameId(null)}
              className="bg-slate-900 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wide"
            >
              Save
            </button>
          </div>
        )}

        {pickingIconForId === cat.id && (
            <IconPicker 
                onSelect={(icon) => {
                    onUpdateCategory(cat.id, { icon });
                    setPickingIconForId(null);
                }} 
                onClose={() => setPickingIconForId(null)} 
            />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-12 pb-20">
      <section className="bg-white border border-slate-200 rounded-3xl p-8 relative shadow-sm transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1">
            <h3 className="text-2xl font-semibold text-slate-900 tracking-tighter uppercase">Budgets</h3>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Plan your monthly limits and goals</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button 
                onClick={fetchSuggestions}
                disabled={isLoadingSuggestions}
                className={`px-6 py-3.5 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 whitespace-nowrap text-xs uppercase tracking-wide ${showSuggestions ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50'}`}
            >
                {isLoadingSuggestions ? (
                    <>
                        <span className="w-3 h-3 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></span>
                        Analyzing...
                    </>
                ) : (
                    <>
                        <span>🤖</span> Auto-Tune
                    </>
                )}
            </button>

            <button 
                onClick={() => setIsAdding(!isAdding)}
                className="bg-slate-900 text-white px-6 py-3.5 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 whitespace-nowrap text-xs uppercase tracking-wide"
            >
                {isAdding ? '✕ Close' : '+ New Category'}
            </button>
          </div>
        </div>

        {/* Budget Rollover Toggle */}
        <div className="mt-4 flex items-center justify-between p-3 bg-slate-50 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-sm">🔄</span>
            <div>
              <p className="text-xs font-semibold text-slate-700">Budget Rollover</p>
              <p className="text-[11px] text-slate-400">Carry unspent budget into the next month</p>
            </div>
          </div>
          <div
            className={`w-10 h-5.5 rounded-full cursor-pointer transition-colors relative ${preferences.budgetRollover ? 'bg-indigo-600' : 'bg-slate-300'}`}
            style={{ width: 40, height: 22 }}
            onClick={() => onUpdatePreferences({ budgetRollover: !preferences.budgetRollover })}
          >
            <div
              className="absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200"
              style={{ left: preferences.budgetRollover ? 21 : 3 }}
            />
          </div>
        </div>

        {/* AI Suggestions Panel */}
        {showSuggestions && (
            <div className="mt-8 bg-slate-900 text-white p-6 rounded-2xl shadow-xl animate-in slide-in-from-top-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 bg-indigo-500/10 rounded-full blur-3xl transform translate-x-10 -translate-y-10"></div>
                
                <div className="flex justify-between items-start mb-6 relative z-10">
                <div>
                    <h4 className="font-semibold text-lg uppercase tracking-tight flex items-center gap-2">
                        <span className="text-2xl">⚡</span> Smart Budget Tuner
                    </h4>
                    <p className="text-indigo-200 text-xs font-medium mt-1">
                        AI-optimized limits based on your actual spending history.
                    </p>
                </div>
                <button 
                    onClick={dismissSuggestions} 
                    className="text-slate-500 hover:text-white transition-colors bg-white/5 rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-wide"
                >
                    Dismiss
                </button>
                </div>

                {isLoadingSuggestions ? (
                    <div className="py-12 text-center space-y-4">
                        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mx-auto"></div>
                        <p className="text-xs font-bold uppercase tracking-wide text-indigo-300">Calibrating...</p>
                    </div>
                ) : suggestions.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                        {suggestions.map(s => {
                            const cat = categories.find(c => c.id === s.categoryId);
                            if (!cat) return null;
                            const diff = s.suggestedAmount - cat.budget;
                            const isIncrease = diff > 0;
                            
                            return (
                                <div key={s.categoryId} className="bg-white/5 rounded-xl p-5 border border-white/5 hover:bg-white/10 transition-colors group">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl bg-white/10 w-10 h-10 flex items-center justify-center rounded-lg">{cat.icon}</span>
                                            <div>
                                                <span className="font-bold text-sm block">{cat.name}</span>
                                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wide">Current: {preferences.currency}{cat.budget.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-indigo-300 font-bold uppercase tracking-wide">Proposed</div>
                                            <div className="font-semibold text-xl text-emerald-400">{preferences.currency}{s.suggestedAmount.toFixed(2)}</div>
                                        </div>
                                    </div>
                                    
                                    <p className="text-xs text-slate-300 leading-relaxed italic border-l-2 border-indigo-500/50 pl-3 mb-4 opacity-80">
                                        "{s.reason}"
                                    </p>
                                    
                                    <div className="flex items-center justify-between border-t border-white/5 pt-3">
                                        <span className={`text-xs font-bold uppercase tracking-wide ${isIncrease ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            {isIncrease ? 'Increase' : 'Decrease'} by {preferences.currency}{Math.abs(diff).toFixed(2)}
                                        </span>
                                        <button 
                                            onClick={() => applySuggestion(s)}
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all shadow-lg active:scale-95"
                                        >
                                            Apply
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-12 text-center bg-white/5 rounded-2xl border border-white/5 border-dashed">
                        <span className="text-2xl mb-2 block">🤷</span>
                        <p className="text-xs font-bold text-slate-300">No suggestions available.</p>
                        <p className="text-xs text-slate-500 mt-1">Try adding more transaction history first.</p>
                    </div>
                )}
            </div>
        )}

        {isAdding && (
          <form onSubmit={handleAdd} className="mt-8 bg-slate-50 p-6 rounded-2xl border border-slate-200 animate-in fade-in slide-in-from-top-4 relative">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">Type</label>
                <div className="flex gap-1">
                  {Object.values(CategoryType).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewCat({...newCat, type})}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${newCat.type === type ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-400'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">Name</label>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setPickingIconNew(true)}
                        className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xl hover:bg-slate-50"
                    >
                        {newCat.icon}
                    </button>
                    <input 
                    type="text"
                    placeholder="e.g. Dining Out"
                    value={newCat.name}
                    onChange={e => setNewCat({...newCat, name: e.target.value})}
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold text-slate-900 outline-none"
                    required
                    />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">
                  {newCat.type === CategoryType.SAVINGS || newCat.type === CategoryType.INCOME ? 'Goal Amount' : 
                   newCat.type === CategoryType.DEBT ? 'Total Debt Balance' : 'Budget Limit'}
                </label>
                <input 
                  type="number"
                  placeholder="0.00"
                  value={(newCat.type === CategoryType.DEBT ? newCat.initialBalance : newCat.budget) || ''}
                  onChange={e => {
                    const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                    if (newCat.type === CategoryType.DEBT) setNewCat({...newCat, initialBalance: val, budget: val});
                    else setNewCat({...newCat, budget: val});
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold text-slate-900 outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button 
                type="submit"
                className="bg-indigo-600 text-white font-bold py-3 px-10 rounded-xl text-xs uppercase tracking-wide hover:bg-indigo-700 transition-all"
              >
                Add Category
              </button>
            </div>

            {pickingIconNew && (
                <IconPicker 
                    onSelect={(icon) => {
                        setNewCat({...newCat, icon});
                        setPickingIconNew(false);
                    }} 
                    onClose={() => setPickingIconNew(false)} 
                />
            )}
          </form>
        )}
      </section>

      {/* Filter and Search Bar */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-indigo-400 focus:bg-white transition-all"
            />
          </div>

          {/* Account Filter */}
          <div>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-indigo-400 focus:bg-white transition-all"
            >
              <option value="all">All Accounts</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.icon} {acc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Type Filter */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-all ${
                filterType === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({categories.length})
            </button>
            <button
              onClick={() => setFilterType(CategoryType.SPENDING)}
              className={`px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-all ${
                filterType === CategoryType.SPENDING
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
            >
              💸 Expenses ({categories.filter(c => c.type === CategoryType.SPENDING).length})
            </button>
            <button
              onClick={() => setFilterType(CategoryType.INCOME)}
              className={`px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-all ${
                filterType === CategoryType.INCOME
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
              }`}
            >
              💰 Income ({categories.filter(c => c.type === CategoryType.INCOME).length})
            </button>
            <button
              onClick={() => setFilterType(CategoryType.SAVINGS)}
              className={`px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-all ${
                filterType === CategoryType.SAVINGS
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
              }`}
            >
              🎯 Savings ({categories.filter(c => c.type === CategoryType.SAVINGS).length})
            </button>
            <button
              onClick={() => setFilterType(CategoryType.DEBT)}
              className={`px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-all ${
                filterType === CategoryType.DEBT
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
              }`}
            >
              📉 Debt ({categories.filter(c => c.type === CategoryType.DEBT).length})
            </button>
          </div>
        </div>
      </section>

      {/* Filtered Categories Grid */}
      <section>
        {(() => {
          // Apply filters
          let filteredCategories = categories;

          // Filter by type
          if (filterType !== 'ALL') {
            filteredCategories = filteredCategories.filter(c => c.type === filterType);
          }

          // Filter by search query
          if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filteredCategories = filteredCategories.filter(c =>
              c.name.toLowerCase().includes(query) ||
              c.icon.includes(query)
            );
          }

          // Show message if no results
          if (filteredCategories.length === 0) {
            return (
              <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <span className="text-4xl mb-4 block">🔍</span>
                <p className="text-slate-600 font-bold">No categories found</p>
                <p className="text-xs text-slate-400 mt-2">
                  {searchQuery ? `No categories match "${searchQuery}"` : 'Create your first category above'}
                </p>
              </div>
            );
          }

          // Group by type for better organization when showing all
          if (filterType === 'ALL') {
            return (
              <div className="space-y-12">
                {/* Income */}
                {filteredCategories.some(c => c.type === CategoryType.INCOME) && (
                  <div className="space-y-6">
                    <div className="border-l-4 border-emerald-500 pl-4">
                      <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Income Goals</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredCategories.filter(c => c.type === CategoryType.INCOME).map(renderCategoryCard)}
                    </div>
                  </div>
                )}

                {/* Spending */}
                {filteredCategories.some(c => c.type === CategoryType.SPENDING) && (
                  <div className="space-y-6">
                    <div className="border-l-4 border-blue-500 pl-4">
                      <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Expense Limits</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredCategories.filter(c => c.type === CategoryType.SPENDING).map(renderCategoryCard)}
                    </div>
                  </div>
                )}

                {/* Debt and Savings side by side */}
                {(filteredCategories.some(c => c.type === CategoryType.DEBT) || filteredCategories.some(c => c.type === CategoryType.SAVINGS)) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {filteredCategories.some(c => c.type === CategoryType.DEBT) && (
                      <div className="space-y-6">
                        <div className="border-l-4 border-rose-500 pl-4">
                          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Debt Reduction</h3>
                        </div>
                        {filteredCategories.filter(c => c.type === CategoryType.DEBT).map(renderCategoryCard)}
                      </div>
                    )}
                    {filteredCategories.some(c => c.type === CategoryType.SAVINGS) && (
                      <div className="space-y-6">
                        <div className="border-l-4 border-indigo-500 pl-4">
                          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Savings Goals</h3>
                        </div>
                        {filteredCategories.filter(c => c.type === CategoryType.SAVINGS).map(renderCategoryCard)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }

          // Single type filter - show as grid
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCategories.map(renderCategoryCard)}
            </div>
          );
        })()}
      </section>
    </div>
  );
};
