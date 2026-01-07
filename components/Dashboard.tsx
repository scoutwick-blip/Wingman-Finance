
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Transaction, Category, UserPreferences, TransactionBehavior, CategoryType } from '../types';

interface DashboardProps {
  transactions: Transaction[];
  categories: Category[];
  preferences: UserPreferences;
  onNavigateToTab: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ transactions, categories, preferences, onNavigateToTab }) => {
  const stats = React.useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let totalDebt = 0;
    let totalSavings = 0;

    categories.filter(c => c.type === CategoryType.DEBT).forEach(debtCat => {
      const payments = transactions
        .filter(t => t.categoryId === debtCat.id)
        .reduce((sum, t) => sum + t.amount, 0);
      totalDebt += Math.max(0, (debtCat.initialBalance || 0) - payments);
    });

    categories.filter(c => c.type === CategoryType.SAVINGS).forEach(saveCat => {
      const contributions = transactions
        .filter(t => t.categoryId === saveCat.id)
        .reduce((sum, t) => sum + t.amount, 0);
      totalSavings += contributions;
    });

    transactions.forEach(t => {
      const typeDef = preferences.transactionTypes.find(type => type.id === t.typeId);
      if (!typeDef) return;
      if (typeDef.behavior === TransactionBehavior.INFLOW) totalIncome += t.amount;
      else if (typeDef.behavior === TransactionBehavior.OUTFLOW) totalExpense += t.amount;
    });

    const categoryDataMap: Record<string, number> = {};
    transactions.forEach(t => {
      const typeDef = preferences.transactionTypes.find(type => type.id === t.typeId);
      const cat = categories.find(c => c.id === t.categoryId);
      if (typeDef?.behavior === TransactionBehavior.OUTFLOW && cat?.type === CategoryType.SPENDING) {
        categoryDataMap[t.categoryId] = (categoryDataMap[t.categoryId] || 0) + t.amount;
      }
    });

    const pieData = Object.entries(categoryDataMap).map(([id, amount]) => {
      const cat = categories.find(c => c.id === id);
      return { name: cat?.name || 'Other', value: amount, color: cat?.color || '#cbd5e1' };
    });

    const recentTransactions = [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    return { 
      totalIncome, totalExpense, totalDebt, totalSavings, 
      netWorth: totalIncome - totalExpense + totalSavings - totalDebt,
      pieData, recentTransactions 
    };
  }, [transactions, categories, preferences.transactionTypes]);

  const SensitiveValue = ({ value, prefix = '' }: { value: number, prefix?: string }) => (
    <span className={`transition-all duration-300 ${preferences.privacyMode ? 'blur-md hover:blur-none cursor-help' : ''}`}>
      {prefix}{preferences.currency}{Math.abs(value).toLocaleString()}
    </span>
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Overview</h3>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Wingman Financial Status</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => onNavigateToTab('transactions')}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95"
          >
            <span>💰</span> Add Income
          </button>
          <button 
            onClick={() => onNavigateToTab('transactions')}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl active:scale-95"
          >
            <span>💸</span> Add Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border-l-4 border-emerald-500 shadow-sm">
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Monthly Income</p>
          <h3 className="text-xl font-black text-slate-800">
            <SensitiveValue value={stats.totalIncome} />
          </h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border-l-4 border-indigo-500 shadow-sm">
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Savings Goal</p>
          <h3 className="text-xl font-black text-slate-800">
            <SensitiveValue value={stats.totalSavings} />
          </h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border-l-4 border-rose-500 shadow-sm">
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Total Debt</p>
          <h3 className="text-xl font-black text-slate-800">
            <SensitiveValue value={stats.totalDebt} />
          </h3>
        </div>
        <div className="bg-slate-900 p-6 rounded-2xl shadow-xl relative overflow-hidden text-white">
          <p className="text-[9px] text-indigo-300 font-black uppercase tracking-widest mb-1">Net Worth</p>
          <h3 className="text-xl font-black">
            <SensitiveValue value={stats.netWorth} />
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h4 className="text-[11px] font-black text-slate-800 mb-6 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full af-blue"></span>
            Spending Breakdown
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={8} dataKey="value">
                  {stats.pieData.map((entry, index) => <Cell key={index} fill={entry.color} strokeWidth={0} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
               Recent Activity
            </h4>
          </div>
          <div className="space-y-1">
            {stats.recentTransactions.length > 0 ? (
              stats.recentTransactions.map(t => {
                const cat = categories.find(c => c.id === t.categoryId);
                const typeDef = preferences.transactionTypes.find(type => type.id === t.typeId);
                const color = typeDef?.behavior === TransactionBehavior.INFLOW ? 'text-emerald-600' : 'text-slate-800';

                return (
                  <div key={t.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-all border border-transparent hover:border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base bg-slate-100 text-slate-600">
                        {cat?.icon || '📦'}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-xs">{t.description}</p>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{cat?.name}</p>
                      </div>
                    </div>
                    <span className={`font-black text-xs ${color}`}>
                      <SensitiveValue value={t.amount} prefix={typeDef?.behavior === TransactionBehavior.INFLOW ? '+' : '-'} />
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-center py-10 text-xs font-bold text-slate-400 uppercase tracking-widest">No entries recorded.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
