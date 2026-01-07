
import React, { useState } from 'react';
import { Category, Transaction, UserPreferences, CategoryType } from '../types';

interface BudgetsProps {
  categories: Category[];
  transactions: Transaction[];
  onUpdateCategory: (id: string, updates: Partial<Category>) => void;
  onAddCategory: (cat: Omit<Category, 'id'>) => void;
  onDeleteCategory: (id: string) => void;
  preferences: UserPreferences;
}

export const Budgets: React.FC<BudgetsProps> = ({ 
  categories, 
  transactions, 
  onUpdateCategory,
  onAddCategory,
  onDeleteCategory,
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
    const relevantTransactions = transactions.filter(t => t.categoryId === cat.id);
    const amount = relevantTransactions.reduce((sum, t) => sum + t.amount, 0);

    switch (cat.type) {
      case CategoryType.DEBT:
        const remaining = Math.max(0, (cat.initialBalance || 0) - amount);
        const debtPaid = (cat.initialBalance || 0) - remaining;
        const debtPerc = cat.initialBalance && cat.initialBalance > 0 
          ? (debtPaid / cat.initialBalance) * 100 
          : 100;
        return { current: debtPaid, target: cat.initialBalance, percentage: debtPerc, label: 'Paid Off', isOver: false };
      
      case CategoryType.SAVINGS:
        // Allow percentage to exceed 100 for display
        const savePerc = cat.budget > 0 ? (amount / cat.budget) * 100 : 0;
        return { current: amount, target: cat.budget, percentage: savePerc, label: 'Saved', isOver: false };
      
      case CategoryType.INCOME:
        // Allow percentage to exceed 100 for display
        const incPerc = cat.budget > 0 ? (amount / cat.budget) * 100 : 0;
        return { current: amount, target: cat.budget, percentage: incPerc, label: 'Earned', isOver: false };

      default: // Spending
        const spendPerc = cat.budget > 0 ? (amount / cat.budget) * 100 : 0;
        return { current: amount, target: cat.budget, percentage: spendPerc, label: 'Spent', isOver: spendPerc > 100 };
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.name) return;
    onAddCategory(newCat);
    setNewCat({ name: '', icon: '📁', color: '#6366f1', budget: 0, type: CategoryType.SPENDING, initialBalance: 0 });
    setIsAdding(false);
  };

  const renderCategoryCard = (cat: Category) => {
    const progress = getCategoryProgress(cat);
    
    return (
      <div key={cat.id} className="group relative bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
        <div className="p-6 space-y-4 transition-all group-hover:opacity-40">
          <div className="flex items-center gap-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-inner shrink-0"
              style={{ backgroundColor: cat.color + '10', color: cat.color }}
            >
              {cat.icon}
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-slate-800 truncate text-base">{cat.name}</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                {getTargetLabel(cat.type)}: <span className="text-slate-900">{preferences.currency}{(cat.type === CategoryType.DEBT ? cat.initialBalance : cat.budget)?.toLocaleString()}</span>
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
              <span className="text-slate-400">{progress.label}: <span className={`text-slate-900 ${preferences.privacyMode ? 'blur-sm' : ''}`}>{preferences.currency}{progress.current.toLocaleString()}</span></span>
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
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-6 space-y-4">
          <div className="w-full space-y-1">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center block">
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

          <div className="flex gap-2 w-full">
            <button 
              onClick={() => setEditingNameId(cat.id)}
              className="flex-1 bg-white border border-slate-200 text-slate-600 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-slate-50"
            >
              Rename
            </button>
            <button 
              onClick={() => { if (confirm(`Delete category?`)) onDeleteCategory(cat.id); }}
              className="flex-1 bg-rose-50 text-rose-600 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-rose-100"
            >
              Delete
            </button>
          </div>
        </div>

        {editingNameId === cat.id && (
          <div className="absolute inset-0 z-20 bg-white p-6 flex flex-col justify-center animate-in fade-in zoom-in-95">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Category Name</label>
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
              className="bg-slate-900 text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest"
            >
              Save
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-12 pb-20">
      <section className="bg-white border border-slate-200 rounded-3xl p-8 relative overflow-hidden shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Budgets</h3>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Plan your monthly limits and goals</p>
          </div>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-slate-900 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 whitespace-nowrap text-xs uppercase tracking-widest"
          >
            {isAdding ? '✕ Close' : '+ New Category'}
          </button>
        </div>

        {isAdding && (
          <form onSubmit={handleAdd} className="mt-8 bg-slate-50 p-6 rounded-2xl border border-slate-200 animate-in fade-in slide-in-from-top-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Type</label>
                <div className="flex gap-1">
                  {Object.values(CategoryType).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewCat({...newCat, type})}
                      className={`flex-1 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${newCat.type === type ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-400'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Dining Out"
                  value={newCat.name}
                  onChange={e => setNewCat({...newCat, name: e.target.value})}
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold text-slate-900 outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
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
                className="bg-indigo-600 text-white font-bold py-3 px-10 rounded-xl text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all"
              >
                Add Category
              </button>
            </div>
          </form>
        )}
      </section>

      <div className="grid grid-cols-1 gap-12">
        <section className="space-y-6">
          <div className="border-l-4 border-emerald-500 pl-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Income Goals</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.filter(c => c.type === CategoryType.INCOME).map(renderCategoryCard)}
          </div>
        </section>

        <section className="space-y-6">
          <div className="border-l-4 border-af-blue pl-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Expense Limits</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.filter(c => c.type === CategoryType.SPENDING).map(renderCategoryCard)}
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="space-y-6">
                <div className="border-l-4 border-rose-500 pl-4">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Debt Reduction</h3>
                </div>
                {categories.filter(c => c.type === CategoryType.DEBT).map(renderCategoryCard)}
            </section>
            <section className="space-y-6">
                <div className="border-l-4 border-indigo-500 pl-4">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Savings Goals</h3>
                </div>
                {categories.filter(c => c.type === CategoryType.SAVINGS).map(renderCategoryCard)}
            </section>
        </div>
      </div>
    </div>
  );
};
