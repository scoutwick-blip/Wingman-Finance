
export enum TransactionBehavior {
  INFLOW = 'INFLOW',
  OUTFLOW = 'OUTFLOW',
  NEUTRAL = 'NEUTRAL'
}

export interface TransactionTypeDefinition {
  id: string;
  label: string;
  behavior: TransactionBehavior;
}

export enum RecurringFrequency {
  WEEKLY = 'Weekly',
  BI_WEEKLY = 'Bi-Weekly',
  MONTHLY = 'Monthly',
  YEARLY = 'Yearly'
}

export enum CategoryType {
  SPENDING = 'SPENDING',
  INCOME = 'INCOME',
  DEBT = 'DEBT',
  SAVINGS = 'SAVINGS'
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  budget: number; // For spending: Monthly limit. For debt/savings: Total goal.
  type: CategoryType;
  initialBalance?: number; // Primarily for Debts
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  categoryId: string;
  typeId: string;
  isRecurring?: boolean;
  frequency?: RecurringFrequency;
  recurringEndDate?: string;
}

export enum NotificationType {
  WARNING = 'warning',
  DANGER = 'danger',
  INFO = 'info',
  SUCCESS = 'success'
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
}

export interface UserPreferences {
  name: string;
  currency: string;
  privacyMode: boolean;
  accentColor: string;
  setupComplete: boolean;
  transactionTypes: TransactionTypeDefinition[];
  profileImage?: string;
  notificationSettings: {
    budgetWarnings: boolean;
    budgetWarningThreshold: number;
    largeTransactions: boolean;
    largeTransactionThreshold: number;
  };
}

export interface UserProfile {
  id: string;
  name: string;
  avatar?: string;
  lastActive: string;
}

export interface AIAdvice {
  summary: string;
  tips: string[];
  alerts: string[];
}

export interface BudgetSuggestion {
  categoryId: string;
  suggestedAmount: number;
  reason: string;
}
