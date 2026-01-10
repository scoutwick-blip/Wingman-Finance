import React, { useState, useMemo } from 'react';
import { Transaction, Category, ForecastScenario, ForecastResult, CategoryType, TransactionBehavior, UserPreferences } from '../types';
import { TrendingUp, DollarSign, Calendar, Target, Zap, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart } from 'recharts';

interface IncomeForecastProps {
  transactions: Transaction[];
  categories: Category[];
  preferences: UserPreferences;
  currency: string;
}

export default function IncomeForecast({
  transactions,
  categories,
  preferences,
  currency
}: IncomeForecastProps) {
  const [forecastMonths, setForecastMonths] = useState(6);
  const [customScenario, setCustomScenario] = useState<ForecastScenario>({
    name: 'Custom',
    monthlyAdditionalSavings: 0,
    monthlyAdditionalIncome: 0,
    monthlyExpenseReduction: 0
  });

  // Calculate current balance
  const currentBalance = useMemo(() => {
    let balance = 0;
    transactions.forEach(txn => {
      const txnType = preferences.transactionTypes.find(t => t.id === txn.typeId);
      if (txnType?.behavior === TransactionBehavior.INFLOW) {
        balance += txn.amount;
      } else if (txnType?.behavior === TransactionBehavior.OUTFLOW) {
        balance -= txn.amount;
      }
    });
    return balance;
  }, [transactions, preferences]);

  // Calculate average monthly income and expenses from last 3 months
  const { avgMonthlyIncome, avgMonthlyExpenses, recurringIncome, recurringExpenses } = useMemo(() => {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    let totalIncome = 0;
    let totalExpenses = 0;
    let recIncome = 0;
    let recExpenses = 0;

    transactions.forEach(txn => {
      const txnDate = new Date(txn.date);
      if (txnDate >= threeMonthsAgo) {
        const txnType = preferences.transactionTypes.find(t => t.id === txn.typeId);

        if (txnType?.behavior === TransactionBehavior.INFLOW) {
          totalIncome += txn.amount;
          if (txn.isRecurring) recIncome += txn.amount;
        } else if (txnType?.behavior === TransactionBehavior.OUTFLOW) {
          totalExpenses += txn.amount;
          if (txn.isRecurring) recExpenses += txn.amount;
        }
      }
    });

    return {
      avgMonthlyIncome: totalIncome / 3,
      avgMonthlyExpenses: totalExpenses / 3,
      recurringIncome: recIncome,
      recurringExpenses: recExpenses
    };
  }, [transactions, preferences]);

  // Generate forecast
  const generateForecast = (scenario?: ForecastScenario): ForecastResult => {
    const projectedBalances = [];
    let balance = currentBalance;

    const baseIncome = avgMonthlyIncome + (scenario?.monthlyAdditionalIncome || 0);
    const baseExpenses = avgMonthlyExpenses - (scenario?.monthlyExpenseReduction || 0);
    const additionalSavings = scenario?.monthlyAdditionalSavings || 0;

    for (let i = 0; i <= forecastMonths; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i);

      const monthIncome = i === 0 ? 0 : baseIncome;
      const monthExpenses = i === 0 ? 0 : baseExpenses + additionalSavings;
      const monthlyNet = monthIncome - monthExpenses;

      balance += monthlyNet;

      projectedBalances.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        balance: parseFloat(balance.toFixed(2)),
        income: parseFloat(monthIncome.toFixed(2)),
        expenses: parseFloat(monthExpenses.toFixed(2))
      });
    }

    return {
      currentBalance,
      projectedBalances,
      scenario
    };
  };

  const baselineForecast = useMemo(() => generateForecast(), [currentBalance, avgMonthlyIncome, avgMonthlyExpenses, forecastMonths]);

  const conservativeForecast = useMemo(() => generateForecast({
    name: 'Conservative',
    monthlyAdditionalSavings: avgMonthlyExpenses * 0.1, // Save 10% more
    monthlyAdditionalIncome: 0,
    monthlyExpenseReduction: 0
  }), [avgMonthlyExpenses, forecastMonths]);

  const aggressiveForecast = useMemo(() => generateForecast({
    name: 'Aggressive',
    monthlyAdditionalSavings: avgMonthlyExpenses * 0.2, // Save 20% more
    monthlyAdditionalIncome: avgMonthlyIncome * 0.1, // 10% income increase
    monthlyExpenseReduction: avgMonthlyExpenses * 0.15 // Reduce expenses 15%
  }), [avgMonthlyIncome, avgMonthlyExpenses, forecastMonths]);

  const customForecast = useMemo(() => generateForecast(customScenario), [customScenario, forecastMonths]);

  const [selectedScenario, setSelectedScenario] = useState<'baseline' | 'conservative' | 'aggressive' | 'custom'>('baseline');

  const getSelectedForecast = () => {
    switch (selectedScenario) {
      case 'baseline': return baselineForecast;
      case 'conservative': return conservativeForecast;
      case 'aggressive': return aggressiveForecast;
      case 'custom': return customForecast;
    }
  };

  const selectedForecast = getSelectedForecast();
  const finalBalance = selectedForecast.projectedBalances[selectedForecast.projectedBalances.length - 1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-wide">INCOME FORECAST</h2>
        <p className="text-sm text-gray-600 mt-1">Project your financial future based on current trends</p>
      </div>

      {/* Current Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium uppercase">Current Balance</p>
              <p className="text-2xl font-bold text-blue-700">{currency}{currentBalance.toFixed(2)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium uppercase">Avg Monthly Income</p>
              <p className="text-2xl font-bold text-green-700">{currency}{avgMonthlyIncome.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium uppercase">Avg Monthly Expenses</p>
              <p className="text-2xl font-bold text-red-700">{currency}{avgMonthlyExpenses.toFixed(2)}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 font-medium uppercase">Projected ({forecastMonths}mo)</p>
              <p className="text-2xl font-bold text-purple-700">{currency}{finalBalance.balance.toFixed(2)}</p>
            </div>
            <Target className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Forecast Controls */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200">
        <h3 className="text-xl font-bold mb-4">FORECAST SETTINGS</h3>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Forecast Period</label>
          <select
            value={forecastMonths}
            onChange={(e) => setForecastMonths(parseInt(e.target.value))}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={3}>3 Months</option>
            <option value={6}>6 Months</option>
            <option value={12}>12 Months</option>
            <option value={24}>24 Months</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <button
            onClick={() => setSelectedScenario('baseline')}
            className={`p-4 rounded-xl border-2 transition-all ${
              selectedScenario === 'baseline'
                ? 'border-blue-500 bg-blue-50 shadow-md'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <h4 className="font-bold text-sm mb-1">Baseline</h4>
            <p className="text-xs text-gray-600">Current spending continues</p>
          </button>
          <button
            onClick={() => setSelectedScenario('conservative')}
            className={`p-4 rounded-xl border-2 transition-all ${
              selectedScenario === 'conservative'
                ? 'border-green-500 bg-green-50 shadow-md'
                : 'border-gray-200 hover:border-green-300'
            }`}
          >
            <h4 className="font-bold text-sm mb-1">Conservative</h4>
            <p className="text-xs text-gray-600">+10% savings</p>
          </button>
          <button
            onClick={() => setSelectedScenario('aggressive')}
            className={`p-4 rounded-xl border-2 transition-all ${
              selectedScenario === 'aggressive'
                ? 'border-purple-500 bg-purple-50 shadow-md'
                : 'border-gray-200 hover:border-purple-300'
            }`}
          >
            <h4 className="font-bold text-sm mb-1">Aggressive</h4>
            <p className="text-xs text-gray-600">+20% savings, -15% expenses</p>
          </button>
          <button
            onClick={() => setSelectedScenario('custom')}
            className={`p-4 rounded-xl border-2 transition-all ${
              selectedScenario === 'custom'
                ? 'border-orange-500 bg-orange-50 shadow-md'
                : 'border-gray-200 hover:border-orange-300'
            }`}
          >
            <h4 className="font-bold text-sm mb-1">Custom</h4>
            <p className="text-xs text-gray-600">Set your own values</p>
          </button>
        </div>

        {selectedScenario === 'custom' && (
          <div className="mt-4 bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
            <h4 className="font-bold text-sm mb-3">CUSTOM SCENARIO</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Savings/Month</label>
                <input
                  type="number"
                  value={customScenario.monthlyAdditionalSavings}
                  onChange={(e) => setCustomScenario({ ...customScenario, monthlyAdditionalSavings: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Income/Month</label>
                <input
                  type="number"
                  value={customScenario.monthlyAdditionalIncome}
                  onChange={(e) => setCustomScenario({ ...customScenario, monthlyAdditionalIncome: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expense Reduction/Month</label>
                <input
                  type="number"
                  value={customScenario.monthlyExpenseReduction}
                  onChange={(e) => setCustomScenario({ ...customScenario, monthlyExpenseReduction: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="150"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200">
        <h3 className="text-xl font-bold mb-4">BALANCE PROJECTION</h3>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={selectedForecast.projectedBalances}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip
              formatter={(value: number) => `${currency}${value.toFixed(2)}`}
              contentStyle={{ backgroundColor: '#fff', border: '2px solid #e5e7eb', borderRadius: '8px' }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="balance"
              fill="#3b82f6"
              stroke="#2563eb"
              fillOpacity={0.3}
              name="Projected Balance"
            />
            <Line
              type="monotone"
              dataKey="income"
              stroke="#10b981"
              strokeWidth={2}
              name="Monthly Income"
            />
            <Line
              type="monotone"
              dataKey="expenses"
              stroke="#ef4444"
              strokeWidth={2}
              name="Monthly Expenses"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Insights */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Zap className="w-6 h-6" />
          FORECAST INSIGHTS
        </h3>
        <div className="space-y-3">
          <div className="bg-white bg-opacity-10 rounded-lg p-3">
            <p className="font-bold mb-1">In {forecastMonths} months:</p>
            <p className="text-lg">
              You'll have <span className="font-black text-2xl">{currency}{finalBalance.balance.toFixed(2)}</span>
            </p>
          </div>
          <div className="bg-white bg-opacity-10 rounded-lg p-3">
            <p className="font-bold mb-1">Net Change:</p>
            <p className="text-lg">
              <span className={`font-black text-2xl ${finalBalance.balance >= currentBalance ? 'text-green-300' : 'text-red-300'}`}>
                {finalBalance.balance >= currentBalance ? '+' : ''}{currency}{(finalBalance.balance - currentBalance).toFixed(2)}
              </span>
            </p>
          </div>
          <div className="bg-white bg-opacity-10 rounded-lg p-3">
            <p className="font-bold mb-1">Monthly Net:</p>
            <p className="text-lg">
              <span className="font-black text-2xl">
                {currency}{((finalBalance.balance - currentBalance) / forecastMonths).toFixed(2)}/month
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Warning if negative trend */}
      {finalBalance.balance < currentBalance && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div className="text-red-800">
            <p className="font-bold mb-1">Warning: Negative Trend</p>
            <p>Your current spending patterns show a decline in balance. Consider reducing expenses or increasing income to improve your financial trajectory.</p>
          </div>
        </div>
      )}
    </div>
  );
}
