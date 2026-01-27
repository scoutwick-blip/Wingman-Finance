
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

// Account Management
export enum AccountType {
  CHECKING = 'CHECKING',
  SAVINGS = 'SAVINGS',
  CREDIT_CARD = 'CREDIT_CARD',
  CASH = 'CASH',
  INVESTMENT = 'INVESTMENT',
  LOAN = 'LOAN',
  OTHER = 'OTHER'
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency?: string;
  color?: string;
  icon?: string;
  isDefault?: boolean;
  isHidden?: boolean;
  creditLimit?: number; // For credit cards
  interestRate?: number; // For loans/credit cards
  notes?: string;
  lastUpdated: string;
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
  accountId?: string; // Which account this transaction belongs to
  isRecurring?: boolean;
  frequency?: RecurringFrequency;
  recurringEndDate?: string;
  receiptImage?: string; // Base64 encoded image
  merchant?: string; // Extracted merchant name
  tags?: string[]; // Custom tags
  isSplit?: boolean; // Is this a split transaction
  splitTransactionId?: string; // Parent split transaction ID
  linkedSubscriptionId?: string; // Link to auto-created subscription
}

// Split Transactions
export interface TransactionSplit {
  id: string;
  categoryId: string;
  amount: number;
  percentage: number;
  notes?: string;
}

export interface SplitTransaction {
  id: string;
  date: string;
  description: string;
  totalAmount: number;
  merchant?: string;
  receiptImage?: string;
  splits: TransactionSplit[];
  typeId: string;
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
  authMode?: 'local' | 'cloud'; // 'local' = no cloud sync, 'cloud' = use authentication
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
  accountId?: string; // Which account this bill is paid from
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

// Subscriptions
export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  TRIAL = 'TRIAL',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

export interface Subscription {
  id: string;
  name: string;
  cost: number;
  billingCycle: RecurringFrequency;
  categoryId: string;
  accountId?: string; // Which account this subscription is charged to
  startDate: string;
  nextBillingDate: string;
  status: SubscriptionStatus;
  trialEndDate?: string;
  cancellationUrl?: string;
  notes?: string;
  linkedBillId?: string;
}

// Financial Goals
export enum GoalType {
  SAVINGS = 'SAVINGS',
  DEBT_PAYOFF = 'DEBT_PAYOFF',
  PURCHASE = 'PURCHASE',
  INVESTMENT = 'INVESTMENT'
}

export enum GoalStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED'
}

export interface GoalMilestone {
  percentage: number;
  label: string;
  achieved: boolean;
  achievedDate?: string;
}

export interface Goal {
  id: string;
  name: string;
  description?: string;
  type: GoalType;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  status: GoalStatus;
  categoryId?: string;
  accountId?: string; // For savings goals - which account holds the funds
  monthlyContribution?: number;
  icon?: string;
  color?: string;
  milestones: GoalMilestone[];
  createdDate: string;
}

// CSV Import & Reconciliation
export interface ImportedTransaction {
  date: string;
  description: string;
  amount: number;
  balance?: number;
  merchant?: string;
  category?: string;
  type?: string; // 'income' or 'expense' (detected)
  originalAmount?: string; // Original amount string from CSV for better type detection
  originalType?: string; // Original type column value from CSV (e.g., "Debit", "Credit")
  rawData: string; // Original CSV row
}

export enum ReconciliationStatus {
  NEW = 'NEW',
  MATCHED = 'MATCHED',
  DUPLICATE = 'DUPLICATE',
  CONFLICT = 'CONFLICT'
}

export interface ReconciliationMatch {
  importedTransaction: ImportedTransaction;
  existingTransaction?: Transaction;
  status: ReconciliationStatus;
  confidence: number; // 0-1
  suggestedCategoryId?: string;
  matchedKeywordGroup?: string; // For debugging: which keyword group matched (e.g., "shopping", "dining")
}
