
import { Category, UserPreferences, TransactionBehavior, CategoryType } from './types';

export const INITIAL_CATEGORIES: Category[] = [
  { id: '1', name: 'Housing', color: '#003087', icon: '🏠', budget: 1800, type: CategoryType.SPENDING },
  { id: '2', name: 'Groceries', color: '#1d4e89', icon: '🍽️', budget: 400, type: CategoryType.SPENDING },
  { id: '3', name: 'Transport', color: '#475569', icon: '🚗', budget: 250, type: CategoryType.SPENDING },
  { id: '4', name: 'Income', color: '#10b981', icon: '💰', budget: 0, type: CategoryType.INCOME },
  { id: '5', name: 'Personal', color: '#334155', icon: '📦', budget: 50, type: CategoryType.SPENDING },
  { id: '6', name: 'Debt', color: '#ef4444', icon: '💳', budget: 2000, type: CategoryType.DEBT, initialBalance: 2000 },
  { id: '7', name: 'Savings', color: '#fbbf24', icon: '🏦', budget: 5000, type: CategoryType.SAVINGS },
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
    largeTransactions: true
  }
};

export const STORAGE_KEY_TRANSACTIONS = 'wingman_transactions';
export const STORAGE_KEY_CATEGORIES = 'wingman_categories';
export const STORAGE_KEY_PREFERENCES = 'wingman_preferences';
export const STORAGE_KEY_NOTIFICATIONS = 'wingman_notifications';
