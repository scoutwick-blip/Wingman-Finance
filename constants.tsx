
import { Category, UserPreferences, TransactionBehavior, CategoryType, BudgetTemplate } from './types';

export const INITIAL_CATEGORIES: Category[] = [
  { id: '1', name: 'Housing', color: '#003087', icon: '🏠', budget: 1800, type: CategoryType.SPENDING },
  { id: '2', name: 'Groceries', color: '#1d4e89', icon: '🍽️', budget: 400, type: CategoryType.SPENDING },
  { id: '3', name: 'Transport', color: '#475569', icon: '🚗', budget: 250, type: CategoryType.SPENDING },
  { id: '4', name: 'Income', color: '#10b981', icon: '💰', budget: 0, type: CategoryType.INCOME },
  { id: '5', name: 'Personal', color: '#334155', icon: '📦', budget: 50, type: CategoryType.SPENDING },
  { id: '6', name: 'Debt', color: '#ef4444', icon: '💳', budget: 2000, type: CategoryType.DEBT, initialBalance: 2000 },
  { id: '7', name: 'Savings', color: '#fbbf24', icon: '🏦', budget: 5000, type: CategoryType.SAVINGS },
  { id: '8', name: 'Utilities', color: '#1e40af', icon: '💡', budget: 150, type: CategoryType.SPENDING },
  { id: '9', name: 'Entertainment', color: '#8b5cf6', icon: '🎮', budget: 200, type: CategoryType.SPENDING },
  { id: '10', name: 'Dining Out', color: '#f59e0b', icon: '🍔', budget: 150, type: CategoryType.SPENDING },
  { id: '11', name: 'Shopping', color: '#ec4899', icon: '🛍️', budget: 100, type: CategoryType.SPENDING },
  { id: '12', name: 'Healthcare', color: '#06b6d4', icon: '🏥', budget: 100, type: CategoryType.SPENDING },
  { id: '13', name: 'Insurance', color: '#64748b', icon: '🛡️', budget: 200, type: CategoryType.SPENDING },
  { id: '14', name: 'Subscriptions', color: '#a855f7', icon: '📱', budget: 50, type: CategoryType.SPENDING },
  { id: '15', name: 'Education', color: '#0ea5e9', icon: '📚', budget: 100, type: CategoryType.SPENDING },
  { id: '16', name: 'Unassigned', color: '#94a3b8', icon: '❓', budget: 0, type: CategoryType.SPENDING },
];

export const DEFAULT_TRANSACTION_TYPES = [
  { id: 'type-expense', label: 'Expense', behavior: TransactionBehavior.OUTFLOW },
  { id: 'type-income', label: 'Income', behavior: TransactionBehavior.INFLOW },
  { id: 'type-transfer', label: 'Transfer', behavior: TransactionBehavior.OUTFLOW },
  { id: 'type-debt-pmt', label: 'Debt Payment', behavior: TransactionBehavior.OUTFLOW },
];

export const DEFAULT_PREFERENCES: UserPreferences = {
  name: '',
  currency: '$',
  privacyMode: false,
  accentColor: '#003087',
  setupComplete: false,
  transactionTypes: DEFAULT_TRANSACTION_TYPES,
  profileImage: undefined,
  notificationSettings: {
    budgetWarnings: true,
    budgetWarningThreshold: 80,
    largeTransactions: true,
    largeTransactionThreshold: 500
  },
  billReminderSettings: {
    enabled: true,
    daysBeforeDue: [3, 1],
    overduReminders: true
  },
  smartCategorizationEnabled: true
};

export const STORAGE_KEY_TRANSACTIONS = 'wingman_transactions';
export const STORAGE_KEY_CATEGORIES = 'wingman_categories';
export const STORAGE_KEY_PREFERENCES = 'wingman_preferences';
export const STORAGE_KEY_NOTIFICATIONS = 'wingman_notifications';
export const STORAGE_KEY_PROFILES = 'wingman_profiles';
export const STORAGE_KEY_BILLS = 'wingman_bills';
export const STORAGE_KEY_MERCHANT_MAPPINGS = 'wingman_merchant_mappings';
export const STORAGE_KEY_SPLIT_TRANSACTIONS = 'wingman_split_transactions';
export const STORAGE_KEY_SUBSCRIPTIONS = 'wingman_subscriptions';
export const STORAGE_KEY_GOALS = 'wingman_goals';

// Budget Templates
export const BUDGET_TEMPLATES: BudgetTemplate[] = [
  {
    id: 'template-50-30-20',
    name: '50/30/20 Rule',
    description: 'Classic balanced budget: 50% needs, 30% wants, 20% savings',
    categories: [
      { name: 'Housing', icon: '🏠', color: '#003087', percentage: 30, type: CategoryType.SPENDING },
      { name: 'Groceries', icon: '🍽️', color: '#1d4e89', percentage: 10, type: CategoryType.SPENDING },
      { name: 'Transport', icon: '🚗', color: '#475569', percentage: 10, type: CategoryType.SPENDING },
      { name: 'Entertainment', icon: '🎮', color: '#8b5cf6', percentage: 15, type: CategoryType.SPENDING },
      { name: 'Shopping', icon: '🛍️', color: '#ec4899', percentage: 10, type: CategoryType.SPENDING },
      { name: 'Dining Out', icon: '🍔', color: '#f59e0b', percentage: 5, type: CategoryType.SPENDING },
      { name: 'Savings', icon: '🏦', color: '#10b981', percentage: 20, type: CategoryType.SAVINGS },
    ],
    targetAudience: 'General'
  },
  {
    id: 'template-military',
    name: 'Military Budget',
    description: 'Optimized for service members with BAH/BAS considerations',
    categories: [
      { name: 'Base Pay', icon: '💰', color: '#10b981', percentage: 100, type: CategoryType.INCOME },
      { name: 'BAH', icon: '🏠', color: '#059669', percentage: 0, type: CategoryType.INCOME },
      { name: 'BAS', icon: '🍽️', color: '#047857', percentage: 0, type: CategoryType.INCOME },
      { name: 'Housing', icon: '🏠', color: '#003087', percentage: 30, type: CategoryType.SPENDING },
      { name: 'Groceries', icon: '🍽️', color: '#1d4e89', percentage: 8, type: CategoryType.SPENDING },
      { name: 'Vehicle', icon: '🚗', color: '#475569', percentage: 12, type: CategoryType.SPENDING },
      { name: 'Insurance', icon: '🛡️', color: '#64748b', percentage: 5, type: CategoryType.SPENDING },
      { name: 'TSP Contribution', icon: '📈', color: '#10b981', percentage: 15, type: CategoryType.SAVINGS },
      { name: 'Emergency Fund', icon: '🏦', color: '#fbbf24', percentage: 10, type: CategoryType.SAVINGS },
      { name: 'Personal', icon: '📦', color: '#334155', percentage: 20, type: CategoryType.SPENDING },
    ],
    targetAudience: 'Military'
  },
  {
    id: 'template-zero-based',
    name: 'Zero-Based Budget',
    description: 'Every dollar has a purpose. Allocate 100% of income to categories',
    categories: [
      { name: 'Housing', icon: '🏠', color: '#003087', percentage: 28, type: CategoryType.SPENDING },
      { name: 'Utilities', icon: '💡', color: '#1e40af', percentage: 5, type: CategoryType.SPENDING },
      { name: 'Groceries', icon: '🍽️', color: '#1d4e89', percentage: 12, type: CategoryType.SPENDING },
      { name: 'Transport', icon: '🚗', color: '#475569', percentage: 10, type: CategoryType.SPENDING },
      { name: 'Insurance', icon: '🛡️', color: '#64748b', percentage: 8, type: CategoryType.SPENDING },
      { name: 'Debt Payment', icon: '💳', color: '#ef4444', percentage: 15, type: CategoryType.DEBT },
      { name: 'Retirement', icon: '📈', color: '#10b981', percentage: 10, type: CategoryType.SAVINGS },
      { name: 'Emergency Fund', icon: '🏦', color: '#fbbf24', percentage: 5, type: CategoryType.SAVINGS },
      { name: 'Entertainment', icon: '🎮', color: '#8b5cf6', percentage: 5, type: CategoryType.SPENDING },
      { name: 'Miscellaneous', icon: '📦', color: '#334155', percentage: 2, type: CategoryType.SPENDING },
    ],
    targetAudience: 'General'
  },
  {
    id: 'template-aggressive-saver',
    name: 'Aggressive Saver',
    description: 'Maximum savings: 40% to savings/investments, minimalist lifestyle',
    categories: [
      { name: 'Housing', icon: '🏠', color: '#003087', percentage: 25, type: CategoryType.SPENDING },
      { name: 'Groceries', icon: '🍽️', color: '#1d4e89', percentage: 10, type: CategoryType.SPENDING },
      { name: 'Transport', icon: '🚗', color: '#475569', percentage: 8, type: CategoryType.SPENDING },
      { name: 'Utilities', icon: '💡', color: '#1e40af', percentage: 5, type: CategoryType.SPENDING },
      { name: 'Insurance', icon: '🛡️', color: '#64748b', percentage: 7, type: CategoryType.SPENDING },
      { name: 'Personal', icon: '📦', color: '#334155', percentage: 5, type: CategoryType.SPENDING },
      { name: 'Retirement', icon: '📈', color: '#10b981', percentage: 20, type: CategoryType.SAVINGS },
      { name: 'Investments', icon: '📊', color: '#059669', percentage: 15, type: CategoryType.SAVINGS },
      { name: 'Emergency Fund', icon: '🏦', color: '#fbbf24', percentage: 5, type: CategoryType.SAVINGS },
    ],
    targetAudience: 'Saver'
  },
  {
    id: 'template-debt-crusher',
    name: 'Debt Crusher',
    description: 'Aggressive debt payoff: 40% to debt elimination',
    categories: [
      { name: 'Housing', icon: '🏠', color: '#003087', percentage: 25, type: CategoryType.SPENDING },
      { name: 'Groceries', icon: '🍽️', color: '#1d4e89', percentage: 10, type: CategoryType.SPENDING },
      { name: 'Transport', icon: '🚗', color: '#475569', percentage: 8, type: CategoryType.SPENDING },
      { name: 'Utilities', icon: '💡', color: '#1e40af', percentage: 5, type: CategoryType.SPENDING },
      { name: 'Insurance', icon: '🛡️', color: '#64748b', percentage: 5, type: CategoryType.SPENDING },
      { name: 'Debt Payment', icon: '💳', color: '#ef4444', percentage: 40, type: CategoryType.DEBT },
      { name: 'Emergency Fund', icon: '🏦', color: '#fbbf24', percentage: 5, type: CategoryType.SAVINGS },
      { name: 'Personal', icon: '📦', color: '#334155', percentage: 2, type: CategoryType.SPENDING },
    ],
    targetAudience: 'Debt Payoff'
  }
];
