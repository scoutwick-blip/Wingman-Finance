import React, { useState, useEffect } from 'react';
import { Zap, TrendingUp, Calendar, DollarSign, CheckCircle, X, Sparkles, EyeOff } from 'lucide-react';
import { Transaction, Category, Bill, BillStatus, Subscription, MerchantMapping, Account } from '../types';
import {
  detectRecurringTransactions,
  suggestBudgetAdjustments,
  suggestMerchantMappings,
  RecurringTransactionSuggestion,
  BudgetSuggestion,
  AutoCategorizationSuggestion
} from '../services/automationService';

interface AutomationDashboardProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  bills: Bill[];
  subscriptions: Subscription[];
  merchantMappings: MerchantMapping[];
  onCreateBill: (bill: Omit<Bill, 'id'>) => void;
  onUpdateCategoryBudget: (categoryId: string, newBudget: number) => void;
  onCreateMerchantMapping: (mapping: MerchantMapping) => void;
  currency: string;
}

const STORAGE_KEY_HIDDEN_SUGGESTIONS = 'wingman_hidden_suggestion_types';
const STORAGE_KEY_DISMISSED_RECURRING = 'wingman_dismissed_recurring';
const STORAGE_KEY_DISMISSED_BUDGETS = 'wingman_dismissed_budgets';
const STORAGE_KEY_DISMISSED_MAPPINGS = 'wingman_dismissed_mappings';

function loadDismissedSet(key: string): Set<string> {
  try {
    const stored = localStorage.getItem(key);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissedSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // Silently handle localStorage save failure
  }
}

export default function AutomationDashboard({
  transactions,
  categories,
  accounts,
  bills,
  subscriptions,
  merchantMappings,
  onCreateBill,
  onUpdateCategoryBudget,
  onCreateMerchantMapping,
  currency
}: AutomationDashboardProps) {
  const [recurringSuggestions, setRecurringSuggestions] = useState<RecurringTransactionSuggestion[]>([]);
  const [budgetSuggestions, setBudgetSuggestions] = useState<BudgetSuggestion[]>([]);
  const [mappingSuggestions, setMappingSuggestions] = useState<AutoCategorizationSuggestion[]>([]);
  const [dismissedRecurring, setDismissedRecurring] = useState<Set<string>>(() => loadDismissedSet(STORAGE_KEY_DISMISSED_RECURRING));
  const [dismissedBudgets, setDismissedBudgets] = useState<Set<string>>(() => loadDismissedSet(STORAGE_KEY_DISMISSED_BUDGETS));
  const [dismissedMappings, setDismissedMappings] = useState<Set<string>>(() => loadDismissedSet(STORAGE_KEY_DISMISSED_MAPPINGS));

  // Persistent hiding of entire suggestion types
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_HIDDEN_SUGGESTIONS);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Save hidden types to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HIDDEN_SUGGESTIONS, JSON.stringify(Array.from(hiddenTypes)));
    } catch {
      // Silently handle localStorage save failure
    }
  }, [hiddenTypes]);

  const hideType = (type: 'recurring' | 'budget' | 'mapping') => {
    setHiddenTypes(prev => new Set(prev).add(type));
  };

  // Analyze transactions when component mounts or data changes
  useEffect(() => {
    const recurring = detectRecurringTransactions(transactions, categories, bills, subscriptions);
    const budgets = suggestBudgetAdjustments(transactions, categories, 3);
    const mappings = suggestMerchantMappings(transactions, categories, merchantMappings);

    setRecurringSuggestions(recurring.slice(0, 5)); // Top 5
    setBudgetSuggestions(budgets.slice(0, 5)); // Top 5
    setMappingSuggestions(mappings.slice(0, 5)); // Top 5
  }, [transactions, categories, bills, subscriptions, merchantMappings]);

  const handleAcceptRecurring = (suggestion: RecurringTransactionSuggestion) => {
    // Find the most commonly used account in the transactions
    const accountCounts = new Map<string, number>();
    suggestion.transactions.forEach(tx => {
      if (tx.accountId) {
        accountCounts.set(tx.accountId, (accountCounts.get(tx.accountId) || 0) + 1);
      }
    });

    let mostCommonAccountId: string | undefined;
    let maxCount = 0;
    accountCounts.forEach((count, accountId) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonAccountId = accountId;
      }
    });

    // Calculate proper due date - use nextDueDate if available, otherwise use today + 1 month
    const dueDate = suggestion.nextDueDate
      ? suggestion.nextDueDate.toISOString().split('T')[0]
      : (() => {
          const today = new Date();
          today.setMonth(today.getMonth() + 1);
          return today.toISOString().split('T')[0];
        })();

    const newBill: Omit<Bill, 'id'> = {
      name: suggestion.suggestedBillName,
      amount: suggestion.amount,
      dueDate: dueDate,
      categoryId: suggestion.categoryId,
      accountId: mostCommonAccountId,
      isRecurring: true,
      frequency: suggestion.frequency,
      status: BillStatus.UPCOMING,
      notes: `Auto-detected from ${suggestion.transactions.length} transactions`
    };

    onCreateBill(newBill);
    setDismissedRecurring(prev => {
      const next = new Set(prev).add(suggestion.merchant);
      saveDismissedSet(STORAGE_KEY_DISMISSED_RECURRING, next);
      return next;
    });
  };

  const handleAcceptBudget = (suggestion: BudgetSuggestion) => {
    onUpdateCategoryBudget(suggestion.categoryId, suggestion.suggestedBudget);
    setDismissedBudgets(prev => {
      const next = new Set(prev).add(suggestion.categoryId);
      saveDismissedSet(STORAGE_KEY_DISMISSED_BUDGETS, next);
      return next;
    });
  };

  const handleAcceptMapping = (suggestion: AutoCategorizationSuggestion) => {
    const newMapping: MerchantMapping = {
      merchant: suggestion.merchant.toLowerCase(),
      categoryId: suggestion.categoryId,
      confidence: suggestion.confidence,
      timesUsed: suggestion.timesUsed
    };

    onCreateMerchantMapping(newMapping);
    setDismissedMappings(prev => {
      const next = new Set(prev).add(suggestion.merchant.toLowerCase());
      saveDismissedSet(STORAGE_KEY_DISMISSED_MAPPINGS, next);
      return next;
    });
  };

  const visibleRecurring = !hiddenTypes.has('recurring')
    ? recurringSuggestions.filter(s => !dismissedRecurring.has(s.merchant))
    : [];
  const visibleBudgets = !hiddenTypes.has('budget')
    ? budgetSuggestions.filter(s => !dismissedBudgets.has(s.categoryId))
    : [];
  const visibleMappings = !hiddenTypes.has('mapping')
    ? mappingSuggestions.filter(s => !dismissedMappings.has(s.merchant.toLowerCase()))
    : [];

  const totalSuggestions = visibleRecurring.length + visibleBudgets.length + visibleMappings.length;

  if (totalSuggestions === 0) {
    return (
      <div className="rounded-2xl p-6 mb-6"
        style={{ backgroundColor: 'var(--color-bg-card)', border: '2px solid var(--color-success, #10b981)33' }}>
        <div className="flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-emerald-600" />
          <div>
            <h3 className="font-bold text-emerald-600">All Caught Up!</h3>
            <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              No automation suggestions at this time. Keep tracking your transactions!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-8 h-8 animate-pulse" />
          <h2 className="text-2xl font-semibold uppercase tracking-wide">Smart Suggestions</h2>
        </div>
        <p className="text-purple-100">
          {totalSuggestions} automation {totalSuggestions === 1 ? 'suggestion' : 'suggestions'} to save you time and optimize your budget
        </p>
      </div>

      {/* Recurring Transaction Suggestions */}
      {visibleRecurring.length > 0 && (
        <div className="rounded-2xl p-4"
          style={{ backgroundColor: 'var(--color-bg-card)', border: '2px solid var(--color-info, #3b82f6)44' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-blue-600">Recurring Bills Detected</h3>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
                {visibleRecurring.length}
              </span>
            </div>
            <button
              onClick={() => hideType('recurring')}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
              title="Don't show recurring bill suggestions again"
            >
              <EyeOff className="w-3 h-3" />
              Don't show again
            </button>
          </div>

          <div className="space-y-3">
            {visibleRecurring.map((suggestion, idx) => {
              const category = categories.find(c => c.id === suggestion.categoryId);
              return (
                <div key={idx} className="rounded-xl p-4"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-card)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{category?.icon}</span>
                        <h4 className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{suggestion.merchant}</h4>
                        <span className="px-2 py-0.5 bg-blue-200 text-blue-800 rounded text-xs font-bold">
                          {Math.round(suggestion.confidence * 100)}% confident
                        </span>
                      </div>
                      <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        {currency}{suggestion.amount.toFixed(2)} · {suggestion.frequency} · {suggestion.transactions.length} transactions detected
                      </p>
                      {suggestion.nextDueDate && (
                        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                          Next due: {suggestion.nextDueDate.toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleAcceptRecurring(suggestion)}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-bold"
                      >
                        Create Bill
                      </button>
                      <button
                        onClick={() => setDismissedRecurring(prev => {
                          const next = new Set(prev).add(suggestion.merchant);
                          saveDismissedSet(STORAGE_KEY_DISMISSED_RECURRING, next);
                          return next;
                        })}
                        className="p-2 hover:bg-red-100 text-rose-500 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Budget Adjustment Suggestions */}
      {visibleBudgets.length > 0 && (
        <div className="rounded-2xl p-4"
          style={{ backgroundColor: 'var(--color-bg-card)', border: '2px solid var(--color-success, #10b981)44' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-emerald-600">Budget Adjustments</h3>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                {visibleBudgets.length}
              </span>
            </div>
            <button
              onClick={() => hideType('budget')}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
              title="Don't show budget suggestions again"
            >
              <EyeOff className="w-3 h-3" />
              Don't show again
            </button>
          </div>

          <div className="space-y-3">
            {visibleBudgets.map((suggestion, idx) => {
              const category = categories.find(c => c.id === suggestion.categoryId);
              const change = suggestion.suggestedBudget - suggestion.currentBudget;
              const changePercent = Math.round((change / suggestion.currentBudget) * 100);

              return (
                <div key={idx} className="rounded-xl p-4"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-card)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{category?.icon}</span>
                        <h4 className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{suggestion.categoryName}</h4>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          suggestion.trend === 'increasing' ? 'bg-red-100 text-red-800' :
                          suggestion.trend === 'decreasing' ? 'bg-emerald-100 text-emerald-800' :
                          ''
                        }`}
                          style={suggestion.trend !== 'increasing' && suggestion.trend !== 'decreasing'
                            ? { backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }
                            : {}
                          }>
                          {suggestion.trend}
                        </span>
                      </div>
                      <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        {suggestion.reason}
                      </p>
                      <div className="flex items-center gap-3 text-sm">
                        <span style={{ color: 'var(--color-text-tertiary)' }}>
                          Current: <span className="font-bold">{currency}{suggestion.currentBudget}</span>
                        </span>
                        <span style={{ color: 'var(--color-text-tertiary)' }}>→</span>
                        <span className={change > 0 ? 'text-rose-500' : 'text-emerald-600'}>
                          Suggested: <span className="font-bold">{currency}{suggestion.suggestedBudget}</span>
                          {' '}({change > 0 ? '+' : ''}{changePercent}%)
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleAcceptBudget(suggestion)}
                        className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-bold"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => setDismissedBudgets(prev => {
                          const next = new Set(prev).add(suggestion.categoryId);
                          saveDismissedSet(STORAGE_KEY_DISMISSED_BUDGETS, next);
                          return next;
                        })}
                        className="p-2 hover:bg-red-100 text-rose-500 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Merchant Mapping Suggestions */}
      {visibleMappings.length > 0 && (
        <div className="rounded-2xl p-4"
          style={{ backgroundColor: 'var(--color-bg-card)', border: '2px solid var(--color-accent)44' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-purple-600">Auto-Categorization</h3>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs font-bold">
                {visibleMappings.length}
              </span>
            </div>
            <button
              onClick={() => hideType('mapping')}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
              title="Don't show auto-categorization suggestions again"
            >
              <EyeOff className="w-3 h-3" />
              Don't show again
            </button>
          </div>

          <div className="space-y-3">
            {visibleMappings.map((suggestion, idx) => {
              const category = categories.find(c => c.id === suggestion.categoryId);
              return (
                <div key={idx} className="rounded-xl p-4"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-card)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{category?.icon}</span>
                        <h4 className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{suggestion.merchant}</h4>
                        <span className="px-2 py-0.5 bg-purple-200 text-purple-800 rounded text-xs font-bold">
                          {Math.round(suggestion.confidence * 100)}% match
                        </span>
                      </div>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        Automatically categorize as <span className="font-bold">{category?.name}</span> based on {suggestion.timesUsed} past transactions
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleAcceptMapping(suggestion)}
                        className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-bold"
                      >
                        Enable
                      </button>
                      <button
                        onClick={() => setDismissedMappings(prev => {
                          const next = new Set(prev).add(suggestion.merchant.toLowerCase());
                          saveDismissedSet(STORAGE_KEY_DISMISSED_MAPPINGS, next);
                          return next;
                        })}
                        className="p-2 hover:bg-red-100 text-rose-500 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
