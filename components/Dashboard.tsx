
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Transaction, Category, UserPreferences, TransactionBehavior, CategoryType, RecurringFrequency } from '../types';

interface DashboardProps {
  transactions: Transaction[];
  categories: Category[];
  preferences: UserPreferences;
  onNavigateToTab: (tab: string) => void;
  onAddTransaction: (behavior: TransactionBehavior) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ transactions, categories, preferences, onNavigateToTab, onAddTransaction }) => {
  
  // Logic to calculate Upcoming Bills (Mission Radar)
  const upcomingBills = React.useMemo(() => {
    const recurring = transactions.filter(t => t.isRecurring && t.frequency);
    const today = new Date();
    
    return recurring.map(t => {
      let nextDate = new Date(t.date);
      // Advance date until it is in the future
      while (nextDate < today) {
        switch (t.frequency) {
          case RecurringFrequency.WEEKLY: nextDate.setDate(nextDate.getDate() + 7); break;
          case RecurringFrequency.BI_WEEKLY: nextDate.setDate(nextDate.getDate() + 14); break;
          case RecurringFrequency.MONTHLY: nextDate.setMonth(nextDate.getMonth() + 1); break;
          case RecurringFrequency.YEARLY: nextDate.setFullYear(nextDate.getFullYear() + 1); break;
        }
      }
      return { ...t, nextDate };
    })
    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
    .slice(0, 3); // Top 3 upcoming
  }, [transactions]);

  const stats = React.useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let totalDebt = 0;
    let totalSavings = 0;

    // Snapshot Calcs
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

    // Pie Chart Data
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

    // Trend Bar Chart Data (Last 6 Months)
    const months: Record<string, { name: string, income: number, expense: number }> = {};
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      months[key] = { 
        name: d.toLocaleDateString('default', { month: 'short' }), 
        income: 0, 
        expense: 0 
      };
    }

    transactions.forEach(t => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (months[key]) {
        const typeDef = preferences.transactionTypes.find(type => type.id === t.typeId);
        if (typeDef?.behavior === TransactionBehavior.INFLOW) months[key].income += t.amount;
        else if (typeDef?.behavior === TransactionBehavior.OUTFLOW) months[key].expense += t.amount;
      }
    });

    const trendData = Object.values(months);

    const recentTransactions = [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    return { 
      totalIncome, totalExpense, totalDebt, totalSavings, 
      netWorth: totalIncome - totalExpense + totalSavings - totalDebt,
      pieData, trendData, recentTransactions 
    };
  }, [transactions, categories, preferences.transactionTypes]);

  const SensitiveValue = ({ value, prefix = '' }: { value: number, prefix?: string }) => (
    <span className={`transition-all duration-300 ${preferences.privacyMode ? 'blur-md hover:blur-none cursor-help' : ''}`}>
      {prefix}{preferences.currency}{Math.abs(value).toFixed(2)}
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
            onClick={() => onAddTransaction(TransactionBehavior.INFLOW)}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95"
          >
            <span>💰</span> Add Income
          </button>
          <button 
            onClick={() => onAddTransaction(TransactionBehavior.OUTFLOW)}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl active:scale-95"
          >
            <span>💸</span> Add Expense
          </button>
        </div>
      </div>

      {/* Snapshot Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border-l-4 border-emerald-500 shadow-sm">
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Total Income</p>
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

      {/* Upcoming Radar */}
      {upcomingBills.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl shadow-sm">
           <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-2">
             <span className="text-lg">📡</span> Mission Radar: Upcoming
           </h4>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {upcomingBills.map(bill => (
               <div key={bill.id} className="bg-white p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
                 <div>
                   <p className="font-bold text-slate-800 text-xs">{bill.description}</p>
                   <p className="text-[9px] text-slate-400 uppercase font-black tracking-wide">
                     {bill.nextDate.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                   </p>
                 </div>
                 <span className="font-black text-slate-800 text-xs">
                   <SensitiveValue value={bill.amount} />
                 </span>
               </div>
             ))}
           </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Trend Chart */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm min-h-[300px] flex flex-col">
           <h4 className="text-[11px] font-black text-slate-800 mb-6 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-900"></span>
            Flight Path (6 Months)
          </h4>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
              <BarChart data={stats.trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} 
                  dy={10}
                />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  labelStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '4px', letterSpacing: '0.1em' }}
                />
                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="expense" fill="#cbd5e1" radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm min-h-[300px] flex flex-col">
          <h4 className="text-[11px] font-black text-slate-800 mb-6 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full af-blue"></span>
            Spending Allocation
          </h4>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
              <PieChart>
                <Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {stats.pieData.map((entry, index) => <Cell key={index} fill={entry.color} strokeWidth={0} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Recent Log
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
  );
};
