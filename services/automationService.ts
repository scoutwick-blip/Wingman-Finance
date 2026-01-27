// Automation service for intelligent financial management
// Auto-detects patterns, suggests budgets, and identifies recurring transactions

import { Transaction, Category, CategoryType, Bill, Subscription, MerchantMapping } from '../types';

export interface RecurringTransactionSuggestion {
  merchant: string;
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  categoryId: string;
  transactions: Transaction[];
  confidence: number;
  suggestedBillName: string;
  nextDueDate?: Date;
}

export interface BudgetSuggestion {
  categoryId: string;
  categoryName: string;
  currentBudget: number;
  suggestedBudget: number;
  averageSpending: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  reason: string;
}

export interface AutoCategorizationSuggestion {
  merchant: string;
  categoryId: string;
  confidence: number;
  timesUsed: number;
  shouldCreateMapping: boolean;
}

/**
 * Detects recurring transactions that could be bills or subscriptions
 */
export function detectRecurringTransactions(
  transactions: Transaction[],
  categories: Category[],
  existingBills: Bill[],
  existingSubscriptions: Subscription[]
): RecurringTransactionSuggestion[] {
  const suggestions: RecurringTransactionSuggestion[] = [];

  // Group transactions by merchant
  const merchantGroups = new Map<string, Transaction[]>();

  transactions.forEach(tx => {
    // CRITICAL: Only process transactions from SPENDING or DEBT categories
    const txCategory = categories.find(c => c.id === tx.categoryId);

    // Skip if no category, or if it's income/savings
    if (!txCategory ||
        txCategory.type === CategoryType.INCOME ||
        txCategory.type === CategoryType.SAVINGS) {
      return;
    }

    // Skip if already marked as recurring
    if (tx.isRecurring) {
      return;
    }

    const merchant = (tx.merchant || tx.description).toLowerCase().trim();
    if (!merchantGroups.has(merchant)) {
      merchantGroups.set(merchant, []);
    }
    merchantGroups.get(merchant)!.push(tx);
  });

  // Analyze each merchant for recurring patterns
  merchantGroups.forEach((txs, merchant) => {
    // Need at least 3 transactions to detect a pattern
    if (txs.length < 3) return;

    // Sort by date
    const sorted = [...txs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Get the category for this transaction group
    const firstTxCategory = categories.find(c => c.id === sorted[0].categoryId);

    // IMPORTANT: Only detect bills for SPENDING and DEBT categories
    // Skip income, savings, and investment categories
    if (!firstTxCategory ||
        firstTxCategory.type === CategoryType.INCOME ||
        firstTxCategory.type === CategoryType.SAVINGS) {
      return;
    }

    // Skip if transactions are already marked as recurring (already set up as bills)
    if (sorted.some(tx => tx.isRecurring)) {
      return;
    }

    // Check if amounts are consistent (within 5%)
    const amounts = sorted.map(tx => Math.abs(tx.amount));
    const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const isConsistentAmount = amounts.every(amt =>
      Math.abs(amt - avgAmount) / avgAmount < 0.05
    );

    if (!isConsistentAmount) return;

    // Calculate intervals between transactions
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const days = Math.round(
        (new Date(sorted[i].date).getTime() - new Date(sorted[i-1].date).getTime()) / (1000 * 60 * 60 * 24)
      );
      intervals.push(days);
    }

    // Determine frequency based on average interval
    const avgInterval = intervals.reduce((sum, int) => sum + int, 0) / intervals.length;
    let frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | null = null;
    let confidence = 0;

    // Check if intervals are consistent (within 7 days variance)
    const isConsistentInterval = intervals.every(int => Math.abs(int - avgInterval) < 7);

    if (isConsistentInterval) {
      if (avgInterval >= 5 && avgInterval <= 9) {
        frequency = 'weekly';
        confidence = 0.9;
      } else if (avgInterval >= 12 && avgInterval <= 16) {
        frequency = 'biweekly';
        confidence = 0.9;
      } else if (avgInterval >= 28 && avgInterval <= 33) {
        frequency = 'monthly';
        confidence = 0.95;
      } else if (avgInterval >= 88 && avgInterval <= 95) {
        frequency = 'quarterly';
        confidence = 0.9;
      } else if (avgInterval >= 360 && avgInterval <= 370) {
        frequency = 'yearly';
        confidence = 0.85;
      }
    }

    if (!frequency) return;

    // Check if this merchant already has a bill or subscription
    const existingBill = existingBills.find(b =>
      b.name.toLowerCase().includes(merchant) || merchant.includes(b.name.toLowerCase())
    );
    const existingSub = existingSubscriptions.find(s =>
      s.name.toLowerCase().includes(merchant) || merchant.includes(s.name.toLowerCase())
    );

    if (existingBill || existingSub) return;

    // Calculate next due date
    const lastTransaction = sorted[sorted.length - 1];
    const lastDate = new Date(lastTransaction.date);
    const nextDueDate = new Date(lastDate);

    switch (frequency) {
      case 'weekly':
        nextDueDate.setDate(nextDueDate.getDate() + 7);
        break;
      case 'biweekly':
        nextDueDate.setDate(nextDueDate.getDate() + 14);
        break;
      case 'monthly':
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDueDate.setMonth(nextDueDate.getMonth() + 3);
        break;
      case 'yearly':
        nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
        break;
    }

    // Determine if this is more likely a subscription or a bill
    // Subscriptions are typically entertainment/tech services, bills are utilities/housing
    const categoryName = firstTxCategory?.name.toLowerCase() || '';
    const isLikelySubscription = categoryName.includes('subscription') ||
                                  categoryName.includes('entertainment') ||
                                  categoryName.includes('streaming');

    // Create suggestion
    suggestions.push({
      merchant: sorted[0].merchant || sorted[0].description,
      amount: avgAmount,
      frequency,
      categoryId: sorted[0].categoryId,
      transactions: sorted,
      confidence,
      suggestedBillName: sorted[0].merchant || sorted[0].description,
      nextDueDate
    });
  });

  // Sort by confidence and number of transactions
  return suggestions.sort((a, b) => {
    const scoreA = a.confidence * a.transactions.length;
    const scoreB = b.confidence * b.transactions.length;
    return scoreB - scoreA;
  });
}

/**
 * Suggests budget adjustments based on spending patterns
 */
export function suggestBudgetAdjustments(
  transactions: Transaction[],
  categories: Category[],
  lookbackMonths: number = 3
): BudgetSuggestion[] {
  const suggestions: BudgetSuggestion[] = [];
  const now = new Date();
  const cutoffDate = new Date(now.getFullYear(), now.getMonth() - lookbackMonths, 1);

  // Filter to recent transactions
  const recentTransactions = transactions.filter(tx =>
    new Date(tx.date) >= cutoffDate
  );

  categories.forEach(category => {
    // Skip income, savings, and debt categories
    if (category.type !== 'spending') return;

    // Get transactions for this category
    const categoryTxs = recentTransactions.filter(tx => tx.categoryId === category.id);

    if (categoryTxs.length === 0) return;

    // Calculate monthly spending
    const monthlySpending = new Map<string, number>();
    categoryTxs.forEach(tx => {
      const date = new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      const current = monthlySpending.get(monthKey) || 0;
      monthlySpending.set(monthKey, current + Math.abs(tx.amount));
    });

    // Calculate average monthly spending
    const months = Array.from(monthlySpending.values());
    const avgSpending = months.reduce((sum, amt) => sum + amt, 0) / Math.max(months.length, 1);

    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (months.length >= 2) {
      const firstHalf = months.slice(0, Math.floor(months.length / 2));
      const secondHalf = months.slice(Math.floor(months.length / 2));
      const firstAvg = firstHalf.reduce((sum, amt) => sum + amt, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, amt) => sum + amt, 0) / secondHalf.length;

      if (secondAvg > firstAvg * 1.15) trend = 'increasing';
      else if (secondAvg < firstAvg * 0.85) trend = 'decreasing';
    }

    // Calculate suggested budget
    let suggestedBudget = avgSpending;
    let reason = '';

    if (avgSpending > category.budget * 1.2) {
      // Spending 20%+ over budget
      suggestedBudget = Math.ceil(avgSpending * 1.1); // Add 10% buffer
      reason = `You're averaging $${avgSpending.toFixed(0)}/month, which is ${Math.round((avgSpending / category.budget - 1) * 100)}% over your $${category.budget} budget`;
    } else if (avgSpending < category.budget * 0.5 && category.budget > 50) {
      // Spending less than 50% of budget (and budget is meaningful)
      suggestedBudget = Math.ceil(avgSpending * 1.2); // Add 20% buffer
      reason = `You're only spending $${avgSpending.toFixed(0)}/month. Consider reducing from $${category.budget}`;
    } else if (trend === 'increasing') {
      suggestedBudget = Math.ceil(avgSpending * 1.15); // Add 15% buffer for increasing trend
      reason = `Spending is trending up. Average: $${avgSpending.toFixed(0)}/month`;
    } else if (trend === 'decreasing' && avgSpending < category.budget * 0.8) {
      suggestedBudget = Math.ceil(avgSpending * 1.1);
      reason = `Spending is trending down. Average: $${avgSpending.toFixed(0)}/month`;
    } else {
      // Budget is reasonable, no suggestion needed
      return;
    }

    suggestions.push({
      categoryId: category.id,
      categoryName: category.name,
      currentBudget: category.budget,
      suggestedBudget,
      averageSpending: Math.round(avgSpending),
      trend,
      reason
    });
  });

  return suggestions;
}

/**
 * Identifies merchants that should have automatic categorization mappings
 */
export function suggestMerchantMappings(
  transactions: Transaction[],
  categories: Category[],
  existingMappings: MerchantMapping[]
): AutoCategorizationSuggestion[] {
  const suggestions: AutoCategorizationSuggestion[] = [];

  // Group transactions by merchant
  const merchantCategoryMap = new Map<string, Map<string, Transaction[]>>();

  transactions.forEach(tx => {
    if (!tx.merchant) return;

    const merchant = tx.merchant.toLowerCase().trim();
    if (!merchantCategoryMap.has(merchant)) {
      merchantCategoryMap.set(merchant, new Map());
    }

    const categoryMap = merchantCategoryMap.get(merchant)!;
    if (!categoryMap.has(tx.categoryId)) {
      categoryMap.set(tx.categoryId, []);
    }
    categoryMap.get(tx.categoryId)!.push(tx);
  });

  // Analyze each merchant
  merchantCategoryMap.forEach((categoryMap, merchant) => {
    // Check if mapping already exists
    const existingMapping = existingMappings.find(m =>
      m.merchant.toLowerCase() === merchant
    );

    // Get the most common category for this merchant
    let mostCommonCategory = '';
    let maxCount = 0;
    let totalCount = 0;

    categoryMap.forEach((txs, categoryId) => {
      totalCount += txs.length;
      if (txs.length > maxCount) {
        maxCount = txs.length;
        mostCommonCategory = categoryId;
      }
    });

    // Calculate confidence (percentage of transactions in the most common category)
    const confidence = maxCount / totalCount;

    // Only suggest if:
    // 1. No existing mapping OR existing mapping is for different category
    // 2. At least 3 transactions with this merchant
    // 3. At least 80% of transactions are in the same category
    if (totalCount >= 3 && confidence >= 0.8) {
      if (!existingMapping || existingMapping.categoryId !== mostCommonCategory) {
        suggestions.push({
          merchant: categoryMap.get(mostCommonCategory)![0].merchant!,
          categoryId: mostCommonCategory,
          confidence,
          timesUsed: totalCount,
          shouldCreateMapping: true
        });
      }
    }
  });

  // Sort by number of transactions (most impact first)
  return suggestions.sort((a, b) => b.timesUsed - a.timesUsed);
}
