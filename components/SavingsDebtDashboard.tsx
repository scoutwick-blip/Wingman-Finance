import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Target, Zap, Calculator, Calendar, Award, AlertCircle, CheckCircle, DollarSign, PiggyBank } from 'lucide-react';
import { Transaction, Category, CategoryType, Goal, GoalStatus, UserPreferences, TransactionBehavior, Account, AccountType } from '../types';

interface SavingsDebtDashboardProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  goals: Goal[];
  preferences: UserPreferences;
  onNavigateToGoals: () => void;
  onNavigateToBudgets: () => void;
}

interface DebtAccount {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
  color: string;
  icon: string;
}

type PayoffStrategy = 'snowball' | 'avalanche' | 'custom';

export default function SavingsDebtDashboard({
  transactions,
  categories,
  accounts,
  goals,
  preferences,
  onNavigateToGoals,
  onNavigateToBudgets
}: SavingsDebtDashboardProps) {
  const [payoffStrategy, setPayoffStrategy] = useState<PayoffStrategy>('avalanche');
  const [extraPayment, setExtraPayment] = useState('200');
  const [emergencyFundMonths, setEmergencyFundMonths] = useState(6);

  // Calculate savings and debt metrics
  const metrics = useMemo(() => {
    // Get debt categories
    const debtCategories = categories.filter(c => c.type === CategoryType.DEBT);
    const savingsCategories = categories.filter(c => c.type === CategoryType.SAVINGS);

    // Calculate total debt from initial balances and payments
    let totalDebt = 0;
    const debtAccounts: DebtAccount[] = [];

    debtCategories.forEach(cat => {
      const payments = transactions
        .filter(t => t.categoryId === cat.id)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const remainingBalance = Math.max(0, (cat.initialBalance || 0) - payments);

      if (remainingBalance > 0) {
        debtAccounts.push({
          id: cat.id,
          name: cat.name,
          balance: remainingBalance,
          interestRate: 0.18, // Default 18% APR, could be customized
          minimumPayment: Math.max(25, remainingBalance * 0.02), // 2% or $25 minimum
          color: cat.color,
          icon: cat.icon
        });
        totalDebt += remainingBalance;
      }
    });

    // Add debt from credit card and loan accounts
    const debtAccountsFromAccounts = accounts.filter(a =>
      a.type === AccountType.CREDIT_CARD || a.type === AccountType.LOAN
    );
    debtAccountsFromAccounts.forEach(acc => {
      // Credit cards have negative balance = debt
      // Loans have positive balance = remaining loan
      const debtAmount = acc.type === AccountType.CREDIT_CARD
        ? Math.abs(Math.min(0, acc.balance))
        : acc.balance;

      if (debtAmount > 0) {
        debtAccounts.push({
          id: acc.id,
          name: acc.name,
          balance: debtAmount,
          interestRate: acc.interestRate || 0.18,
          minimumPayment: Math.max(25, debtAmount * 0.02),
          color: acc.color || '#ef4444',
          icon: acc.icon || '💳'
        });
        totalDebt += debtAmount;
      }
    });

    // Calculate total savings from categories
    let totalSavings = 0;
    savingsCategories.forEach(cat => {
      const contributions = transactions
        .filter(t => t.categoryId === cat.id)
        .reduce((sum, t) => sum + t.amount, 0);
      totalSavings += contributions;
    });

    // Add savings from actual savings/checking accounts
    const savingsAccounts = accounts.filter(a =>
      a.type === AccountType.SAVINGS || a.type === AccountType.CHECKING
    );
    savingsAccounts.forEach(acc => {
      totalSavings += acc.balance;
    });

    // Calculate savings from goals
    const savingsGoals = goals.filter(g => g.type === 'savings');
    const goalProgress = savingsGoals.reduce((sum, g) => sum + g.currentAmount, 0);
    // Don't double-count if goal is already tracked in account balance
    // totalSavings += goalProgress;

    // Calculate income and expenses for savings rate
    let totalIncome = 0;
    let totalExpenses = 0;

    const lastThreeMonths = new Date();
    lastThreeMonths.setMonth(lastThreeMonths.getMonth() - 3);

    transactions
      .filter(t => new Date(t.date) >= lastThreeMonths)
      .forEach(t => {
        const typeDef = preferences.transactionTypes.find(type => type.id === t.typeId);
        if (typeDef?.behavior === TransactionBehavior.INFLOW) {
          totalIncome += t.amount;
        } else if (typeDef?.behavior === TransactionBehavior.OUTFLOW) {
          totalExpenses += t.amount;
        }
      });

    const monthlySavings = (totalIncome - totalExpenses) / 3;
    const savingsRate = totalIncome > 0 ? (monthlySavings / (totalIncome / 3)) * 100 : 0;

    // Calculate net worth
    const netWorth = totalSavings - totalDebt;

    // Calculate emergency fund recommendation
    const monthlyExpenses = totalExpenses / 3;
    const emergencyFundTarget = monthlyExpenses * emergencyFundMonths;
    const emergencyFundProgress = (totalSavings / emergencyFundTarget) * 100;

    return {
      totalDebt,
      totalSavings,
      netWorth,
      debtAccounts,
      savingsRate,
      monthlySavings,
      monthlyExpenses,
      emergencyFundTarget,
      emergencyFundProgress,
      totalIncome: totalIncome / 3, // Average monthly
      totalExpenses: totalExpenses / 3 // Average monthly
    };
  }, [transactions, categories, goals, preferences, emergencyFundMonths]);

  // Calculate debt payoff timeline
  const debtPayoffPlan = useMemo(() => {
    if (metrics.debtAccounts.length === 0) return null;

    const extra = parseFloat(extraPayment) || 0;
    const accounts = [...metrics.debtAccounts];

    // Sort based on strategy
    if (payoffStrategy === 'snowball') {
      accounts.sort((a, b) => a.balance - b.balance); // Smallest balance first
    } else if (payoffStrategy === 'avalanche') {
      accounts.sort((a, b) => b.interestRate - a.interestRate); // Highest interest first
    }

    let monthsToPayoff = 0;
    let totalInterestPaid = 0;
    const timeline: Array<{ month: number; accounts: Array<{ name: string; balance: number }> }> = [];

    // Simulate payoff
    let remainingAccounts = accounts.map(a => ({ ...a }));
    let availableExtra = extra;

    while (remainingAccounts.length > 0 && monthsToPayoff < 360) { // Cap at 30 years
      monthsToPayoff++;

      remainingAccounts.forEach((account, idx) => {
        // Add interest
        const monthlyInterest = (account.balance * account.interestRate) / 12;
        account.balance += monthlyInterest;
        totalInterestPaid += monthlyInterest;

        // Apply minimum payment
        let payment = Math.min(account.minimumPayment, account.balance);
        account.balance -= payment;

        // Apply extra payment to first account
        if (idx === 0 && availableExtra > 0) {
          const extraApplied = Math.min(availableExtra, account.balance);
          account.balance -= extraApplied;
          availableExtra -= extraApplied;
        }

        // If paid off, redistribute extra payments
        if (account.balance <= 0) {
          availableExtra += account.minimumPayment;
        }
      });

      // Remove paid off accounts
      remainingAccounts = remainingAccounts.filter(a => a.balance > 0);

      // Store snapshot every 6 months
      if (monthsToPayoff % 6 === 0) {
        timeline.push({
          month: monthsToPayoff,
          accounts: remainingAccounts.map(a => ({
            name: a.name,
            balance: Math.round(a.balance)
          }))
        });
      }
    }

    const debtFreeDate = new Date();
    debtFreeDate.setMonth(debtFreeDate.getMonth() + monthsToPayoff);

    // Calculate interest saved vs minimum payments only
    let minPaymentInterest = 0;
    let minPaymentMonths = 0;
    const minAccounts = accounts.map(a => ({ ...a }));

    while (minAccounts.some(a => a.balance > 0) && minPaymentMonths < 360) {
      minPaymentMonths++;
      minAccounts.forEach(account => {
        const monthlyInterest = (account.balance * account.interestRate) / 12;
        account.balance += monthlyInterest;
        minPaymentInterest += monthlyInterest;
        account.balance -= Math.min(account.minimumPayment, account.balance);
      });
    }

    const interestSaved = minPaymentInterest - totalInterestPaid;

    return {
      monthsToPayoff,
      debtFreeDate,
      totalInterestPaid: Math.round(totalInterestPaid),
      interestSaved: Math.round(interestSaved),
      timeline,
      monthsSaved: minPaymentMonths - monthsToPayoff
    };
  }, [metrics.debtAccounts, payoffStrategy, extraPayment]);

  const SensitiveValue = ({ value, prefix = '' }: { value: number; prefix?: string }) => (
    <span className={`transition-all duration-300 ${preferences.privacyMode ? 'blur-md hover:blur-none cursor-help' : ''}`}>
      {prefix}{preferences.currency}{Math.abs(value).toFixed(0)}
    </span>
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h3 className="text-3xl font-semibold text-slate-900 tracking-tighter uppercase">Financial Health</h3>
          <p className="text-slate-500 font-bold uppercase text-xs tracking-wide">Savings & Debt Overview</p>
        </div>
      </div>

      {/* Net Worth Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-3 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-white/80">Net Worth</p>
              <p className="text-3xl font-semibold">
                <SensitiveValue value={metrics.netWorth} />
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-white/80">Savings Rate</p>
            <p className="text-2xl font-semibold">{metrics.savingsRate.toFixed(1)}%</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-xs font-bold text-white/70">Total Savings</p>
            <p className="text-xl font-semibold">
              <SensitiveValue value={metrics.totalSavings} />
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-xs font-bold text-white/70">Total Debt</p>
            <p className="text-xl font-semibold">
              <SensitiveValue value={metrics.totalDebt} />
            </p>
          </div>
        </div>
      </div>

      {/* Emergency Fund Progress */}
      <div className="bg-white border-2 border-amber-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-3 rounded-xl">
              <PiggyBank className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-slate-900">Emergency Fund</h4>
              <p className="text-sm text-slate-600">
                Target: {emergencyFundMonths} months of expenses
              </p>
            </div>
          </div>
          <select
            value={emergencyFundMonths}
            onChange={(e) => setEmergencyFundMonths(parseInt(e.target.value))}
            className="px-3 py-2 border-2 border-slate-200 rounded-lg text-sm font-bold"
          >
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
            <option value={9}>9 months</option>
            <option value={12}>12 months</option>
          </select>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm font-bold mb-2">
            <span className="text-slate-600">
              <SensitiveValue value={metrics.totalSavings} /> saved
            </span>
            <span className="text-slate-600">
              <SensitiveValue value={metrics.emergencyFundTarget} /> target
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden border-2 border-slate-200">
            <div
              className={`h-full transition-all duration-500 ${
                metrics.emergencyFundProgress >= 100
                  ? 'bg-green-500'
                  : metrics.emergencyFundProgress >= 50
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, metrics.emergencyFundProgress)}%` }}
            />
          </div>
          <p className="text-center text-sm font-bold text-slate-700 mt-2">
            {metrics.emergencyFundProgress.toFixed(0)}% Complete
          </p>
        </div>

        {metrics.emergencyFundProgress < 100 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-900">
                  Save <SensitiveValue value={metrics.emergencyFundTarget - metrics.totalSavings} /> more to reach your goal
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  At {preferences.currency}{metrics.monthlySavings.toFixed(0)}/month, you'll reach your target in{' '}
                  {Math.ceil((metrics.emergencyFundTarget - metrics.totalSavings) / metrics.monthlySavings)} months
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-sm font-bold text-green-900">
                Great job! Your emergency fund is fully funded 🎉
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Debt Payoff Calculator */}
      {metrics.debtAccounts.length > 0 && debtPayoffPlan && (
        <div className="bg-white border-2 border-red-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-red-100 p-3 rounded-xl">
              <Calculator className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-slate-900">Debt Payoff Plan</h4>
              <p className="text-sm text-slate-600">Optimize your debt elimination strategy</p>
            </div>
          </div>

          {/* Strategy Selector */}
          <div className="mb-6">
            <label className="text-sm font-bold text-slate-700 mb-2 block">Payoff Strategy</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => setPayoffStrategy('avalanche')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  payoffStrategy === 'avalanche'
                    ? 'border-red-500 bg-red-50'
                    : 'border-slate-200 hover:border-red-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">Avalanche</span>
                  <Zap className="w-4 h-4 text-red-600" />
                </div>
                <p className="text-xs text-slate-600">Highest interest first (saves most money)</p>
              </button>

              <button
                onClick={() => setPayoffStrategy('snowball')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  payoffStrategy === 'snowball'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">Snowball</span>
                  <Target className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-xs text-slate-600">Smallest balance first (quick wins)</p>
              </button>

              <button
                onClick={() => setPayoffStrategy('custom')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  payoffStrategy === 'custom'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-slate-200 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">Custom</span>
                  <DollarSign className="w-4 h-4 text-purple-600" />
                </div>
                <p className="text-xs text-slate-600">Your own priority order</p>
              </button>
            </div>
          </div>

          {/* Extra Payment Input */}
          <div className="mb-6">
            <label className="text-sm font-bold text-slate-700 mb-2 block">
              Extra Monthly Payment
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  value={extraPayment}
                  onChange={(e) => setExtraPayment(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-bold"
                  placeholder="200"
                />
              </div>
              <div className="text-sm text-slate-600">
                per month towards debt
              </div>
            </div>
          </div>

          {/* Payoff Results */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-50 rounded-xl p-4 border-2 border-slate-200">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-slate-600" />
                <p className="text-xs font-bold text-slate-600">Debt-Free Date</p>
              </div>
              <p className="text-xl font-semibold text-slate-900">
                {debtPayoffPlan.debtFreeDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {debtPayoffPlan.monthsToPayoff} months ({(debtPayoffPlan.monthsToPayoff / 12).toFixed(1)} years)
              </p>
            </div>

            <div className="bg-green-50 rounded-xl p-4 border-2 border-green-200">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-4 h-4 text-green-600" />
                <p className="text-xs font-bold text-green-600">Interest Saved</p>
              </div>
              <p className="text-xl font-semibold text-green-900">
                <SensitiveValue value={debtPayoffPlan.interestSaved} />
              </p>
              <p className="text-xs text-green-600 mt-1">
                vs. minimum payments only
              </p>
            </div>

            <div className="bg-red-50 rounded-xl p-4 border-2 border-red-200">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-600" />
                <p className="text-xs font-bold text-red-600">Total Interest</p>
              </div>
              <p className="text-xl font-semibold text-red-900">
                <SensitiveValue value={debtPayoffPlan.totalInterestPaid} />
              </p>
              <p className="text-xs text-red-600 mt-1">
                {debtPayoffPlan.monthsSaved} months faster
              </p>
            </div>
          </div>

          {/* Current Debts */}
          <div>
            <h5 className="text-sm font-semibold text-slate-700 mb-3">Current Debts</h5>
            <div className="space-y-2">
              {metrics.debtAccounts.map((account, idx) => (
                <div key={account.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{account.icon}</span>
                    <div>
                      <p className="font-bold text-sm text-slate-900">{account.name}</p>
                      <p className="text-xs text-slate-500">
                        {(account.interestRate * 100).toFixed(1)}% APR · Min: {preferences.currency}{account.minimumPayment.toFixed(0)}/mo
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">
                      <SensitiveValue value={account.balance} />
                    </p>
                    {payoffStrategy !== 'custom' && idx === 0 && (
                      <p className="text-xs text-red-600 font-bold">Focus here first</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={onNavigateToGoals}
          className="bg-green-600 text-white p-6 rounded-2xl hover:bg-green-700 transition-all shadow-lg hover:shadow-xl group"
        >
          <div className="flex items-center justify-between mb-2">
            <Target className="w-8 h-8 group-hover:scale-110 transition-transform" />
            <span className="text-3xl font-semibold">{goals.filter(g => g.status === GoalStatus.IN_PROGRESS).length}</span>
          </div>
          <p className="font-semibold text-sm uppercase tracking-wide">Manage Savings Goals</p>
          <p className="text-xs text-green-100 mt-1">Set targets and track progress</p>
        </button>

        <button
          onClick={onNavigateToBudgets}
          className="bg-blue-600 text-white p-6 rounded-2xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl group"
        >
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 group-hover:scale-110 transition-transform" />
            <span className="text-3xl font-semibold">{categories.filter(c => c.type === CategoryType.DEBT || c.type === CategoryType.SAVINGS).length}</span>
          </div>
          <p className="font-semibold text-sm uppercase tracking-wide">Adjust Categories</p>
          <p className="text-xs text-blue-100 mt-1">Update savings & debt budgets</p>
        </button>
      </div>

      {/* No Debt Message */}
      {metrics.debtAccounts.length === 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h4 className="text-2xl font-semibold text-green-900 mb-2">Debt Free! 🎉</h4>
          <p className="text-slate-600 max-w-md mx-auto">
            You have no debt! Focus on building your savings and reaching your financial goals.
          </p>
        </div>
      )}
    </div>
  );
}
