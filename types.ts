
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
  receiptImage?: string; // Base64 encoded image
  merchant?: string; // Extracted merchant name
  tags?: string[]; // Custom tags
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
  pin?: string;
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
  billReminderSettings?: BillReminderSettings;
  smartCategorizationEnabled?: boolean;
  supabaseConfig?: {
    url: string;
    key: string;
    lastSynced?: string;
  };
}

export interface UserProfile {
  id: string;
  name: string;
  avatar?: string;
  pin?: string;
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

// Bill Reminders
export enum BillStatus {
  UPCOMING = 'UPCOMING',
  DUE_SOON = 'DUE_SOON',
  OVERDUE = 'OVERDUE',
  PAID = 'PAID'
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: string; // ISO date
  categoryId: string;
  isRecurring: boolean;
  frequency?: RecurringFrequency;
  status: BillStatus;
  lastPaidDate?: string;
  notes?: string;
  linkedTransactionId?: string; // If bill was paid, link to transaction
}

export interface BillReminderSettings {
  enabled: boolean;
  daysBeforeDue: number[]; // e.g., [3, 1] for 3 days and 1 day before
  overduReminders: boolean;
}

// Merchant Intelligence & Category Suggestions
export interface MerchantMapping {
  merchant: string;
  categoryId: string;
  confidence: number; // 0-1, how confident the mapping is
  timesUsed: number;
}

export interface CategorySuggestion {
  categoryId: string;
  confidence: number;
  reason: string;
}

// Budget Templates
export interface TemplateCategory {
  name: string;
  icon: string;
  color: string;
  percentage: number; // Percentage of income
  type: CategoryType;
}

export interface BudgetTemplate {
  id: string;
  name: string;
  description: string;
  categories: TemplateCategory[];
  targetAudience?: string; // e.g., "Military", "Student", "Family"
}

// Income Forecasting
export interface ForecastScenario {
  name: string;
  monthlyAdditionalSavings: number;
  monthlyAdditionalIncome: number;
  monthlyExpenseReduction: number;
}

export interface ForecastResult {
  currentBalance: number;
  projectedBalances: {
    month: string;
    balance: number;
    income: number;
    expenses: number;
  }[];
  scenario?: ForecastScenario;
}
