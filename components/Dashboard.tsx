
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, CartesianGrid } from 'recharts';
import { Transaction, Category, UserPreferences, TransactionBehavior, CategoryType, RecurringFrequency, Bill, BillStatus } from '../types';

interface DashboardProps {
  transactions: Transaction[];
  categories: Category[];
  preferences: UserPreferences;
  bills?: Bill[];
  onNavigateToTab: (tab: string) => void;
  onAddTransaction: (behavior: TransactionBehavior) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ transactions, categories, preferences, bills = [], onNavigateToTab, onAddTransaction }) => {

  // Logic to calculate Upcoming Bills
  const upcomingBills = React.useMemo(() => {
    const recurring = transactions.filter(t => t.isRecurring && t.frequency);
    const today = new Date();

    return recurring.map(t => {
      let nextDate = new Date(t.date);
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
    .slice(0, 3);
  }, [transactions]);

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
      return { name: cat?.name || 'Other', value: parseFloat(amount.toFixed(2)), color: cat?.color || '#cbd5e1' };
    });

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

    const trendData = Object.values(months).map(m => ({
      ...m,
      income: parseFloat(m.income.toFixed(2)),
      expense: parseFloat(m.expense.toFixed(2))
    }));

    const recentTransactions = [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    return {
      totalIncome: parseFloat(totalIncome.toFixed(2)),
      totalExpense: parseFloat(totalExpense.toFixed(2)),
      totalDebt: parseFloat(totalDebt.toFixed(2)),
      totalSavings: parseFloat(totalSavings.toFixed(2)),
      netWorth: parseFloat((totalIncome - totalExpense + totalSavings - totalDebt).toFixed(2)),
      pieData, trendData, recentTransactions
    };
  }, [transactions, categories, preferences.transactionTypes]);

  // Safe-to-Spend calculation
  const safeToSpend = React.useMemo(() => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    let monthIncome = 0;
    let monthExpense = 0;

    transactions.forEach(t => {
      const d = new Date(t.date);
      if (d >= monthStart && d <= monthEnd) {
        const typeDef = preferences.transactionTypes.find(type => type.id === t.typeId);
        if (!typeDef) return;
        if (typeDef.behavior === TransactionBehavior.INFLOW) monthIncome += t.amount;
        else if (typeDef.behavior === TransactionBehavior.OUTFLOW) monthExpense += t.amount;
      }
    });

    // Calculate remaining unpaid bills this month
    let upcomingBillsTotal = 0;
    bills.forEach(bill => {
      if (bill.status === BillStatus.PAID) return;
      const dueDate = new Date(bill.dueDate);
      if (dueDate >= today && dueDate <= monthEnd) {
        upcomingBillsTotal += bill.amount;
      }
    });

    const remaining = monthIncome - monthExpense - upcomingBillsTotal;
    const daysLeft = monthEnd.getDate() - today.getDate() + 1;
    const dailyBudget = daysLeft > 0 ? remaining / daysLeft : 0;

    return {
      amount: parseFloat(remaining.toFixed(2)),
      dailyBudget: parseFloat(dailyBudget.toFixed(2)),
      monthIncome: parseFloat(monthIncome.toFixed(2)),
      monthExpense: parseFloat(monthExpense.toFixed(2)),
      upcomingBills: parseFloat(upcomingBillsTotal.toFixed(2)),
      daysLeft
    };
  }, [transactions, bills, preferences.transactionTypes]);

  // Weekly Recap calculation
  const weeklyRecap = React.useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(weekStart);
    lastWeekEnd.setMilliseconds(-1);

    let thisWeekSpent = 0;
    let thisWeekIncome = 0;
    let thisWeekCount = 0;
    let lastWeekSpent = 0;
    const thisWeekCategories: Record<string, number> = {};

    transactions.forEach(t => {
      const d = new Date(t.date);
      const typeDef = preferences.transactionTypes.find(type => type.id === t.typeId);
      if (!typeDef) return;

      if (d >= weekStart && d <= today) {
        thisWeekCount++;
        if (typeDef.behavior === TransactionBehavior.OUTFLOW) {
          thisWeekSpent += t.amount;
          thisWeekCategories[t.categoryId] = (thisWeekCategories[t.categoryId] || 0) + t.amount;
        }
        if (typeDef.behavior === TransactionBehavior.INFLOW) thisWeekIncome += t.amount;
      } else if (d >= lastWeekStart && d <= lastWeekEnd) {
        if (typeDef.behavior === TransactionBehavior.OUTFLOW) lastWeekSpent += t.amount;
      }
    });

    // Top category this week
    let topCategoryId = '';
    let topCategoryAmount = 0;
    Object.entries(thisWeekCategories).forEach(([id, amount]) => {
      if (amount > topCategoryAmount) {
        topCategoryId = id;
        topCategoryAmount = amount;
      }
    });
    const topCategory = categories.find(c => c.id === topCategoryId);

    const changePercent = lastWeekSpent > 0
      ? ((thisWeekSpent - lastWeekSpent) / lastWeekSpent) * 100
      : 0;

    return {
      spent: parseFloat(thisWeekSpent.toFixed(2)),
      income: parseFloat(thisWeekIncome.toFixed(2)),
      count: thisWeekCount,
      lastWeekSpent: parseFloat(lastWeekSpent.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(1)),
      topCategory: topCategory ? { name: topCategory.name, icon: topCategory.icon, amount: parseFloat(topCategoryAmount.toFixed(2)) } : null
    };
  }, [transactions, categories, preferences.transactionTypes]);

  const SensitiveValue = ({ value, prefix = '' }: { value: number, prefix?: string }) => (
    <span className={`tabular-nums transition-all duration-300 ${preferences.privacyMode ? 'blur-md hover:blur-none cursor-help' : ''}`}>
      {prefix}{preferences.currency}{Math.abs(value).toFixed(2)}
    </span>
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Overview</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Your financial snapshot</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onAddTransaction(TransactionBehavior.INFLOW)}
            className="flex-1 min-w-[130px] flex items-center justify-center gap-2 text-white px-5 py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-all active:scale-95"
            style={{ backgroundColor: 'var(--color-bg-sidebar)' }}
          >
            <span>💰</span> Add Income
          </button>
          <button
            onClick={() => onAddTransaction(TransactionBehavior.OUTFLOW)}
            className="flex-1 min-w-[130px] flex items-center justify-center gap-2 text-white px-5 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            <span>💸</span> Add Expense
          </button>
        </div>
      </div>

      {/* Snapshot Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="p-5 rounded-xl" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderLeft: '3px solid #10b981' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-tertiary)' }}>Total Income</p>
          <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
            <SensitiveValue value={stats.totalIncome} />
          </h3>
        </div>
        <div className="p-5 rounded-xl" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderLeft: '3px solid var(--color-accent)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-tertiary)' }}>Savings</p>
          <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
            <SensitiveValue value={stats.totalSavings} />
          </h3>
        </div>
        <div className="p-5 rounded-xl" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', borderLeft: '3px solid #ef4444' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-tertiary)' }}>Total Debt</p>
          <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
            <SensitiveValue value={stats.totalDebt} />
          </h3>
        </div>
        <div className="p-5 rounded-xl col-span-2 lg:col-span-1" style={{ backgroundColor: 'var(--color-bg-sidebar)', color: 'white' }}>
          <p className="text-xs font-medium mb-2 opacity-70">Net Worth</p>
          <h3 className="text-lg font-bold">
            <SensitiveValue value={stats.netWorth} />
          </h3>
        </div>
      </div>

      {/* Safe-to-Spend + Weekly Recap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Safe-to-Spend */}
        <div className="p-5 rounded-xl" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)' }}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Safe to Spend
            </h4>
            <span className="text-xs px-2 py-1 rounded-md" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
              This Month
            </span>
          </div>
          <div className="mb-4">
            <h3 className={`text-2xl font-bold ${safeToSpend.amount < 0 ? 'text-rose-500' : ''}`}
              style={safeToSpend.amount >= 0 ? { color: 'var(--color-text-primary)' } : {}}>
              <SensitiveValue value={safeToSpend.amount} />
            </h3>
            {safeToSpend.daysLeft > 0 && safeToSpend.amount > 0 && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                ~<SensitiveValue value={safeToSpend.dailyBudget} />/day for {safeToSpend.daysLeft} days
              </p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--color-text-tertiary)' }}>Income</span>
              <span className="font-medium text-emerald-600">+<SensitiveValue value={safeToSpend.monthIncome} /></span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--color-text-tertiary)' }}>Spent</span>
              <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>-<SensitiveValue value={safeToSpend.monthExpense} /></span>
            </div>
            {safeToSpend.upcomingBills > 0 && (
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--color-text-tertiary)' }}>Upcoming Bills</span>
                <span className="font-medium text-amber-600">-<SensitiveValue value={safeToSpend.upcomingBills} /></span>
              </div>
            )}
          </div>
        </div>

        {/* Weekly Recap */}
        <div className="p-5 rounded-xl" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)' }}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }}></span>
              Weekly Recap
            </h4>
            <span className="text-xs px-2 py-1 rounded-md" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
              This Week
            </span>
          </div>

          {weeklyRecap.count > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Spent</p>
                  <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    <SensitiveValue value={weeklyRecap.spent} />
                  </p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Earned</p>
                  <p className="text-lg font-bold text-emerald-600">
                    <SensitiveValue value={weeklyRecap.income} />
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--color-text-tertiary)' }}>Transactions</span>
                  <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{weeklyRecap.count}</span>
                </div>
                {weeklyRecap.lastWeekSpent > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--color-text-tertiary)' }}>vs Last Week</span>
                    <span className={`font-semibold ${weeklyRecap.changePercent > 0 ? 'text-rose-500' : weeklyRecap.changePercent < 0 ? 'text-emerald-600' : ''}`}
                      style={weeklyRecap.changePercent === 0 ? { color: 'var(--color-text-tertiary)' } : {}}>
                      {weeklyRecap.changePercent > 0 ? '+' : ''}{weeklyRecap.changePercent}%
                    </span>
                  </div>
                )}
                {weeklyRecap.topCategory && (
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--color-text-tertiary)' }}>Top Category</span>
                    <span className="font-medium flex items-center gap-1" style={{ color: 'var(--color-text-primary)' }}>
                      {weeklyRecap.topCategory.icon} {weeklyRecap.topCategory.name}
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm py-6 text-center" style={{ color: 'var(--color-text-tertiary)' }}>No transactions this week yet.</p>
          )}
        </div>
      </div>

      {/* Upcoming Bills */}
      {upcomingBills.length > 0 && (
        <div className="p-5 rounded-xl" style={{ backgroundColor: 'var(--color-accent-light)', border: '1px solid var(--color-border-card)' }}>
           <h4 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-accent)' }}>
             <span className="text-base">📅</span> Upcoming Bills
           </h4>
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
             {upcomingBills.map(bill => (
               <div key={bill.id} className="p-3 rounded-lg flex items-center justify-between"
                 style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)' }}>
                 <div>
                   <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>{bill.description}</p>
                   <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                     {bill.nextDate.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                   </p>
                 </div>
                 <span className="font-semibold text-sm tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                   <SensitiveValue value={bill.amount} />
                 </span>
               </div>
             ))}
           </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Trend Chart */}
        <div className="p-6 rounded-xl min-h-[300px] flex flex-col"
          style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)' }}>
           <h4 className="text-sm font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-text-primary)' }}></span>
            Income vs Expenses
          </h4>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
              <BarChart data={stats.trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-secondary)" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{fontSize: 12, fill: 'var(--color-text-tertiary)', fontWeight: 500}}
                  dy={10}
                />
                <Tooltip
                  cursor={{fill: 'var(--color-bg-tertiary)'}}
                  contentStyle={{ borderRadius: '0.75rem', border: '1px solid var(--color-border-card)', boxShadow: 'var(--shadow-md)', backgroundColor: 'var(--color-bg-card)' }}
                  labelStyle={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}
                />
                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="expense" fill="#94a3b8" radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="p-6 rounded-xl min-h-[300px] flex flex-col"
          style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)' }}>
          <h4 className="text-sm font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }}></span>
            Spending Breakdown
          </h4>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
              <PieChart>
                <Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {stats.pieData.map((entry, index) => <Cell key={index} fill={entry.color} strokeWidth={0} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid var(--color-border-card)', boxShadow: 'var(--shadow-md)', backgroundColor: 'var(--color-bg-card)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="p-6 rounded-xl" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)' }}>
        <div className="flex items-center justify-between mb-5">
          <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Recent Transactions
          </h4>
        </div>
        <div className="space-y-1">
          {stats.recentTransactions.length > 0 ? (
            stats.recentTransactions.map(t => {
              const cat = categories.find(c => c.id === t.categoryId);
              const typeDef = preferences.transactionTypes.find(type => type.id === t.typeId);
              const isIncome = typeDef?.behavior === TransactionBehavior.INFLOW;

              return (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg transition-all"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-card-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base"
                      style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                      {cat?.icon || '📦'}
                    </div>
                    <div>
                      <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>{t.description}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{cat?.name}</p>
                    </div>
                  </div>
                  <span className={`font-semibold text-sm tabular-nums ${isIncome ? 'text-emerald-600' : ''}`}
                    style={isIncome ? {} : { color: 'var(--color-text-primary)' }}>
                    <SensitiveValue value={t.amount} prefix={isIncome ? '+' : '-'} />
                  </span>
                </div>
              );
            })
          ) : (
            <p className="text-center py-10 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>No transactions recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};
