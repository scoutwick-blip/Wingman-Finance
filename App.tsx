
import React, { useState, useEffect, useCallback } from 'react';
import LZString from 'lz-string';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Transactions } from './components/Transactions';
import { Budgets } from './components/Budgets';
import { AIAdvisor } from './components/AIAdvisor';
import { Settings } from './components/Settings';
import AutomationDashboard from './components/AutomationDashboard';
import { SetupWizard } from './components/SetupWizard';
import { ProfileSelector } from './components/ProfileSelector';
import Auth from './components/Auth';
import { Transaction, Category, CategoryType, UserPreferences, Notification, NotificationType, TransactionBehavior, UserProfile, Bill, BillStatus, MerchantMapping, Subscription, Goal, GoalStatus, SplitTransaction, Account, AccountType, SubscriptionStatus, RecurringFrequency } from './types';
import { initSupabase, signIn, signUp, signInWithOAuth, signOut, getCurrentUser, onAuthStateChange, uploadAuthData, downloadAuthData, deleteAuthData, fetchUserProfiles } from './services/supabaseService';
import { User } from '@supabase/supabase-js';
import {
  INITIAL_CATEGORIES,
  STORAGE_KEY_TRANSACTIONS,
  STORAGE_KEY_CATEGORIES,
  STORAGE_KEY_PREFERENCES,
  STORAGE_KEY_NOTIFICATIONS,
  STORAGE_KEY_PROFILES,
  STORAGE_KEY_BILLS,
  STORAGE_KEY_MERCHANT_MAPPINGS,
  STORAGE_KEY_SUBSCRIPTIONS,
  STORAGE_KEY_GOALS,
  STORAGE_KEY_SPLIT_TRANSACTIONS,
  STORAGE_KEY_ACCOUNTS,
  DEFAULT_PREFERENCES,
  DEFAULT_ACCOUNTS
} from './constants';
import Bills from './components/Bills';
import IncomeForecast from './components/IncomeForecast';
import BudgetTemplates from './components/BudgetTemplates';
import Subscriptions from './components/Subscriptions';
import Goals from './components/Goals';
import SavingsDebtDashboard from './components/SavingsDebtDashboard';
import CSVImport from './components/CSVImport';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isSetupMode, setIsSetupMode] = useState(false);

  // Transaction View Config (for defaulting to Add Income/Expense)
  const [transactionConfig, setTransactionConfig] = useState<{ mode: 'add', behavior: TransactionBehavior } | null>(null);

  // Per-profile state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [merchantMappings, setMerchantMappings] = useState<MerchantMapping[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [splitTransactions, setSplitTransactions] = useState<SplitTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>(DEFAULT_ACCOUNTS);

  const [isLoading, setIsLoading] = useState(true);
  const [showBudgetTemplates, setShowBudgetTemplates] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);

  // Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize Supabase and Check Auth (runs first)
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    // Timeout helper: resolves with fallback if promise takes too long
    const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
      Promise.race([promise, new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))]);

    const initAuth = async () => {
      try {
        // Check for Supabase configuration from environment variables
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
          try {
            initSupabase(supabaseUrl, supabaseKey);

            // Check if returning from OAuth callback (hash fragments or query params)
            const isOAuthCallback = window.location.hash.includes('access_token') ||
                                   window.location.search.includes('code=');

            // ALWAYS require explicit sign-in - no auto sign-in
            // BUT: Don't sign out if returning from OAuth callback
            // Use 2s timeout to prevent slow/unreachable Supabase from blocking render
            if (!isOAuthCallback) {
              const currentUser = await withTimeout(getCurrentUser(), 2000, null);
              if (currentUser) {
                await withTimeout(signOut(), 2000, undefined);
              }
            }

            // Check if user has chosen local-only mode before
            const storedPrefs = localStorage.getItem(STORAGE_KEY_PREFERENCES);
            if (storedPrefs) {
              const prefs = JSON.parse(storedPrefs);
              if (prefs.authMode === 'local') {
                setShowAuthScreen(false);
              } else {
                // Show auth screen for cloud mode or undecided
                setShowAuthScreen(true);
              }
            } else {
              // New user with no data - show auth screen by default
              setShowAuthScreen(true);
            }

            // Listen for auth state changes
            const { data } = onAuthStateChange((session, user) => {
              setUser(user);
              if (user) {
                setShowAuthScreen(false);
              }
            });
            subscription = data.subscription;

          } catch {
            // Supabase initialization failed - continue without cloud sync
          }
        }
      } catch {
        // Auth initialization failed
      } finally {
        setIsCheckingAuth(false);
      }
    };

    initAuth();

    // Cleanup
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Initial Boot: Load Profiles and Check for Legacy Data
  useEffect(() => {
    if (isCheckingAuth) return; // Wait for auth check to complete

    const initializeProfiles = async () => {
      const storedProfiles = localStorage.getItem(STORAGE_KEY_PROFILES);
      let loadedProfiles: UserProfile[] = storedProfiles ? JSON.parse(storedProfiles) : [];

      // Legacy Migration
      if (loadedProfiles.length === 0) {
        const legacyPrefs = localStorage.getItem(STORAGE_KEY_PREFERENCES);
        if (legacyPrefs) {
          // We have legacy data but no profile system. Create a profile for the legacy user.
          const parsedPrefs = JSON.parse(legacyPrefs);
          const legacyId = 'user-' + Date.now();
          const legacyProfile: UserProfile = {
            id: legacyId,
            name: parsedPrefs.name || 'User',
            avatar: parsedPrefs.profileImage,
            lastActive: new Date().toISOString()
          };
          loadedProfiles = [legacyProfile];
          localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(loadedProfiles));

          // Migrate Data keys
          const t = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
          const c = localStorage.getItem(STORAGE_KEY_CATEGORIES);
          const n = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);

          if(t) localStorage.setItem(`${STORAGE_KEY_TRANSACTIONS}_${legacyId}`, t);
          if(c) localStorage.setItem(`${STORAGE_KEY_CATEGORIES}_${legacyId}`, c);
          if(n) localStorage.setItem(`${STORAGE_KEY_NOTIFICATIONS}_${legacyId}`, n);
          localStorage.setItem(`${STORAGE_KEY_PREFERENCES}_${legacyId}`, legacyPrefs);
        }
      }

      // MAGIC QR CODE IMPORT LISTENER
      const params = new URLSearchParams(window.location.search);
      const importData = params.get('import');

      if (importData) {
        try {
          const jsonString = LZString.decompressFromEncodedURIComponent(importData);
          if (jsonString) {
            const data = JSON.parse(jsonString);
            if (confirm(`Import data from '${data.preferences?.name || 'Unknown'}'? This will CREATE A NEW PROFILE.`)) {

               // Create a new profile for this imported data
               const newId = 'user-import-' + Date.now();
               const newProfile: UserProfile = {
                  id: newId,
                  name: (data.preferences?.name || 'Imported User') + ' (Imported)',
                  avatar: data.preferences?.profileImage,
                  lastActive: new Date().toISOString(),
                  pin: data.preferences?.pin
               };

               // Save to storage immediately
               try {
                  const updatedProfiles = [...loadedProfiles, newProfile];
                  loadedProfiles = updatedProfiles;
                  setProfiles(updatedProfiles);
                  localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(updatedProfiles));

                  localStorage.setItem(`${STORAGE_KEY_PREFERENCES}_${newId}`, JSON.stringify(data.preferences));
                  localStorage.setItem(`${STORAGE_KEY_CATEGORIES}_${newId}`, JSON.stringify(data.categories));
                  localStorage.setItem(`${STORAGE_KEY_TRANSACTIONS}_${newId}`, JSON.stringify(data.transactions));
                  localStorage.setItem(`${STORAGE_KEY_NOTIFICATIONS}_${newId}`, JSON.stringify([]));

                  // Clean URL
                  window.history.replaceState({}, document.title, window.location.pathname);

                  alert('Import successful! Please select the new profile.');
               } catch {
                  alert("Cannot import data: Not enough storage space available.");
               }
            }
          }
        } catch {
          alert("Failed to read QR code data.");
        }
      }

      // Check cloud for existing profiles if user is authenticated and no local profiles
      if (user && loadedProfiles.length === 0) {
        try {
          const cloudProfiles = await fetchUserProfiles();

          if (cloudProfiles.length > 0) {
            // Load ALL cloud profiles for this user
            const restoredProfiles: UserProfile[] = [];

            for (const cloudProfile of cloudProfiles) {
              const profileId = cloudProfile.id; // Use the actual profile ID from cloud
              const cloudData = cloudProfile.data;

              // Create local profile from cloud data
              const newProfile: UserProfile = {
                id: profileId,
                name: cloudData.preferences?.name || 'User',
                avatar: cloudData.preferences?.profileImage,
                pin: cloudData.preferences?.pin,
                lastActive: cloudProfile.updated_at
              };

              restoredProfiles.push(newProfile);

              // Restore all data from cloud for this profile
              if (cloudData.preferences) {
                localStorage.setItem(`${STORAGE_KEY_PREFERENCES}_${profileId}`, JSON.stringify(cloudData.preferences));
              }
              if (cloudData.categories) {
                localStorage.setItem(`${STORAGE_KEY_CATEGORIES}_${profileId}`, JSON.stringify(cloudData.categories));
              }
              if (cloudData.transactions) {
                localStorage.setItem(`${STORAGE_KEY_TRANSACTIONS}_${profileId}`, JSON.stringify(cloudData.transactions));
              }
              if (cloudData.bills) {
                localStorage.setItem(`${STORAGE_KEY_BILLS}_${profileId}`, JSON.stringify(cloudData.bills));
              }
              if (cloudData.merchantMappings) {
                localStorage.setItem(`${STORAGE_KEY_MERCHANT_MAPPINGS}_${profileId}`, JSON.stringify(cloudData.merchantMappings));
              }
              if (cloudData.subscriptions) {
                localStorage.setItem(`${STORAGE_KEY_SUBSCRIPTIONS}_${profileId}`, JSON.stringify(cloudData.subscriptions));
              }
              if (cloudData.goals) {
                localStorage.setItem(`${STORAGE_KEY_GOALS}_${profileId}`, JSON.stringify(cloudData.goals));
              }
              if (cloudData.splitTransactions) {
                localStorage.setItem(`${STORAGE_KEY_SPLIT_TRANSACTIONS}_${profileId}`, JSON.stringify(cloudData.splitTransactions));
              }
              if (cloudData.accounts) {
                localStorage.setItem(`${STORAGE_KEY_ACCOUNTS}_${profileId}`, JSON.stringify(cloudData.accounts));
              }
              localStorage.setItem(`${STORAGE_KEY_NOTIFICATIONS}_${profileId}`, JSON.stringify([]));
            }

            // Save all restored profiles
            loadedProfiles = restoredProfiles;
            setProfiles(loadedProfiles);
            localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(loadedProfiles));
          }
        } catch {
          // Cloud profile check failed - continue with local data
        }
      }

      setProfiles(loadedProfiles);

      if (loadedProfiles.length > 0) {
        // Don't auto-login, show selector (unless we just auto-selected from cloud)
      } else {
        setIsSetupMode(true);
      }
      setIsLoading(false);
    };

    initializeProfiles();
  }, [isCheckingAuth, user]); // Run again when auth check completes or user changes

  // Load Profile Data when activeProfileId changes (from cloud only)
  useEffect(() => {
    if (!activeProfileId || !user) return;

    const loadProfileData = async () => {
      try {
        setIsLoading(true);
        const cloudData = await downloadAuthData(activeProfileId);

        if (cloudData && cloudData.content) {
          restoreFullState(cloudData.content, false);
        } else {
          // Initialize with defaults for new profile
          setTransactions([]);
          setCategories(INITIAL_CATEGORIES);
          setNotifications([]);
          setBills([]);
          setMerchantMappings([]);
          setSubscriptions([]);
          setGoals([]);
          setSplitTransactions([]);
          setAccounts(DEFAULT_ACCOUNTS);
          setPreferences(DEFAULT_PREFERENCES);
        }
      } catch {
        // Fall back to defaults on error
        setTransactions([]);
        setCategories(INITIAL_CATEGORIES);
        setNotifications([]);
        setBills([]);
        setMerchantMappings([]);
        setSubscriptions([]);
        setGoals([]);
        setSplitTransactions([]);
        setAccounts(DEFAULT_ACCOUNTS);
        setPreferences(DEFAULT_PREFERENCES);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfileData();
  }, [activeProfileId, user]);

  // Update profile metadata when preferences change (name/avatar/pin)
  useEffect(() => {
    if (!activeProfileId || isLoading) return;

    const currentP = profiles.find(p => p.id === activeProfileId);
    if (currentP && (currentP.name !== preferences.name || currentP.avatar !== preferences.profileImage || currentP.pin !== preferences.pin)) {
      const updatedProfiles = profiles.map(p =>
        p.id === activeProfileId
          ? {
              ...p,
              name: preferences.name,
              avatar: preferences.profileImage,
              pin: preferences.pin,
              lastActive: new Date().toISOString()
            }
          : p
      );
      setProfiles(updatedProfiles);
      localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(updatedProfiles));
    }
  }, [preferences.name, preferences.profileImage, preferences.pin, activeProfileId, isLoading]);

  // Apply theme (dark mode)
  useEffect(() => {
    const applyTheme = (theme: string) => {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    const themePref = preferences.theme || 'system';
    if (themePref === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mq.matches ? 'dark' : 'light');
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      applyTheme(themePref);
    }
  }, [preferences.theme]);

  // Auto-sync to cloud when authenticated (debounced)
  useEffect(() => {
    if (!user || !activeProfileId || isLoading || isCheckingAuth) {
      return;
    }

    // Debounce: only sync if 5 seconds have passed since last sync
    const now = Date.now();
    if (now - lastSyncTime < 5000) {
      return;
    }

    if (isSyncing) {
      return;
    }

    const syncToCloud = async () => {
      try {
        setIsSyncing(true);
        const backupData = {
          version: '1.0',
          timestamp: new Date().toISOString(),
          preferences,
          categories,
          transactions,
          bills,
          merchantMappings,
          subscriptions,
          goals,
          splitTransactions,
          accounts
        };

        await uploadAuthData(activeProfileId, backupData);
        setLastSyncTime(now);
      } catch {
        // Auto-sync failed silently - will retry on next data change
      } finally {
        setIsSyncing(false);
      }
    };

    // Debounce with a timeout
    const timeoutId = setTimeout(syncToCloud, 2000);
    return () => clearTimeout(timeoutId);
    // Only sync when actual data changes, not when sync state changes
  }, [user, activeProfileId, transactions, categories, bills, merchantMappings, subscriptions, goals, splitTransactions, accounts, isLoading, isCheckingAuth]);

  // Note: Cloud data loading is now handled in the profile data loading useEffect above
  // No separate cloud data loading needed since all data comes from cloud

  // Profile Management Methods
  const handleProfileSelect = (id: string) => {
    setActiveProfileId(id);
    setIsSetupMode(false);
    // Update last active
    const updatedProfiles = profiles.map(p => p.id === id ? { ...p, lastActive: new Date().toISOString() } : p);
    setProfiles(updatedProfiles);
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(updatedProfiles));
  };

  const handleCreateProfile = async (prefs: UserPreferences) => {
    // Generate unique profile ID for each profile
    // If authenticated: user-{userId}-profile-{timestamp} for multiple profiles per account
    // If local: user-{timestamp}
    const timestamp = Date.now();
    const newId = user ? `user-${user.id}-profile-${timestamp}` : `user-${timestamp}`;
    const newProfile: UserProfile = {
      id: newId,
      name: prefs.name,
      avatar: prefs.profileImage,
      pin: prefs.pin,
      lastActive: new Date().toISOString()
    };

    try {
      const updatedProfiles = [...profiles, newProfile];
      setProfiles(updatedProfiles);
      localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(updatedProfiles));

      // Initialize in-memory state with defaults for new profile
      setPreferences(prefs);
      const zeroedCategories = INITIAL_CATEGORIES.map(c => ({
        ...c,
        budget: 0,
        initialBalance: 0
      }));
      setCategories(zeroedCategories);
      setTransactions([]);
      setNotifications([]);
      setBills([]);
      setMerchantMappings([]);
      setSubscriptions([]);
      setGoals([]);
      setSplitTransactions([]);
      setAccounts(DEFAULT_ACCOUNTS);

      setActiveProfileId(newId);
      setIsSetupMode(false);

      // If authenticated, save initial state to cloud
      if (user) {
        await uploadAuthData(newId, {
          version: '1.0',
          timestamp: new Date().toISOString(),
          preferences: prefs,
          categories: zeroedCategories,
          transactions: [],
          bills: [],
          merchantMappings: [],
          subscriptions: [],
          goals: [],
          splitTransactions: [],
          accounts: DEFAULT_ACCOUNTS
        });
      }
    } catch {
      alert("Failed to create profile. Please try again.");
    }
  };

  const handleDeleteProfile = async (id: string) => {
    const updatedProfiles = profiles.filter(p => p.id !== id);
    setProfiles(updatedProfiles);
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(updatedProfiles));

    // If authenticated, delete from cloud as well
    if (user) {
      try {
        await deleteAuthData(id);
      } catch {
        // Cloud deletion failed - local deletion still succeeded
      }
    }

    if (activeProfileId === id) {
      setActiveProfileId(null);
    }
  };


  // Notification Engine
  const checkFinancialHealth = useCallback(() => {
    const newNotifications: Notification[] = [];
    const timestamp = new Date().toISOString();
    const today = new Date();
    const todayStr = today.toDateString();

    // Helper to check if notification already exists today
    const alreadyNotified = (title: string) =>
      notifications.some(n => n.title === title && new Date(n.timestamp).toDateString() === todayStr);

    // 1. Budget warnings
    if (preferences.notificationSettings?.budgetWarnings) {
      const warningThreshold = (preferences.notificationSettings?.budgetWarningThreshold ?? 80) / 100;

      categories.forEach(cat => {
        if (cat.name === 'Income') return;

        const spent = transactions
          .filter(t => t.categoryId === cat.id)
          .filter(t => preferences.transactionTypes.find(type => type.id === t.typeId)?.behavior === TransactionBehavior.OUTFLOW)
          .reduce((sum, t) => sum + t.amount, 0);

        const budget = cat.budget;
        if (budget <= 0) return;

        const ratio = spent / budget;

        if (ratio >= 1.0) {
          const title = `Over Budget: ${cat.name}`;
          if (!alreadyNotified(title)) {
            newNotifications.push({
              id: Math.random().toString(36).substring(2, 9),
              type: NotificationType.DANGER,
              title,
              message: `You've exceeded your ${preferences.currency}${budget.toFixed(2)} budget for ${cat.name}. Currently at ${preferences.currency}${spent.toFixed(2)}.`,
              timestamp,
              isRead: false
            });
          }
        } else if (ratio >= warningThreshold) {
          const title = `Budget Warning: ${cat.name}`;
          if (!alreadyNotified(title)) {
            newNotifications.push({
              id: Math.random().toString(36).substring(2, 9),
              type: NotificationType.WARNING,
              title,
              message: `You've used ${Math.round(ratio * 100)}% of your ${cat.name} budget. Time to slow down!`,
              timestamp,
              isRead: false
            });
          }
        }
      });
    }

    // 2. Bill reminders — notify for bills due within 3 days
    if (preferences.billReminderSettings?.enabled !== false) {
      const reminderDays = preferences.billReminderSettings?.daysBeforeDue || [3, 1];
      const maxDays = Math.max(...reminderDays);

      bills.forEach(bill => {
        if (bill.status === BillStatus.PAID) return;
        const dueDate = new Date(bill.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntil < 0 && (preferences.billReminderSettings?.overduReminders !== false)) {
          const title = `Overdue Bill: ${bill.name}`;
          if (!alreadyNotified(title)) {
            newNotifications.push({
              id: Math.random().toString(36).substring(2, 9),
              type: NotificationType.DANGER,
              title,
              message: `${bill.name} was due ${Math.abs(daysUntil)} days ago (${preferences.currency}${bill.amount.toFixed(2)}).`,
              timestamp,
              isRead: false
            });
          }
        } else if (daysUntil >= 0 && daysUntil <= maxDays) {
          const title = `Bill Due${daysUntil === 0 ? ' Today' : ' Soon'}: ${bill.name}`;
          if (!alreadyNotified(title)) {
            newNotifications.push({
              id: Math.random().toString(36).substring(2, 9),
              type: daysUntil === 0 ? NotificationType.WARNING : NotificationType.INFO,
              title,
              message: `${bill.name} (${preferences.currency}${bill.amount.toFixed(2)}) is due ${daysUntil === 0 ? 'today' : `in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`}.`,
              timestamp,
              isRead: false
            });
          }
        }
      });
    }

    // 3. Goal milestone celebrations
    goals.forEach(goal => {
      if (goal.status !== GoalStatus.IN_PROGRESS || goal.targetAmount <= 0) return;
      const progress = goal.currentAmount / goal.targetAmount;

      goal.milestones.forEach(milestone => {
        if (milestone.achieved) return;
        const threshold = milestone.percentage / 100;
        if (progress >= threshold) {
          const title = `Goal Milestone: ${goal.name}`;
          const milestoneTitle = `${milestone.label} — ${goal.name}`;
          if (!alreadyNotified(milestoneTitle)) {
            newNotifications.push({
              id: Math.random().toString(36).substring(2, 9),
              type: milestone.percentage === 100 ? NotificationType.SUCCESS : NotificationType.INFO,
              title: milestoneTitle,
              message: milestone.percentage === 100
                ? `Congratulations! You've reached your ${goal.name} goal of ${preferences.currency}${goal.targetAmount.toFixed(2)}!`
                : `${milestone.label} for ${goal.name}! You've saved ${preferences.currency}${goal.currentAmount.toFixed(2)} of ${preferences.currency}${goal.targetAmount.toFixed(2)}.`,
              timestamp,
              isRead: false
            });

            // Mark milestone as achieved
            milestone.achieved = true;
            milestone.achievedDate = timestamp;
          }
        }
      });
    });

    if (newNotifications.length > 0) {
      setNotifications(prev => [...newNotifications, ...prev].slice(0, 50));
    }
  }, [transactions, categories, preferences, notifications, bills, goals]);

  useEffect(() => {
    if (!isLoading && activeProfileId) {
      checkFinancialHealth();
    }
  }, [transactions, categories, bills, goals, isLoading, activeProfileId]);

  const addTransaction = (newT: Omit<Transaction, 'id'>) => {
    const transaction: Transaction = {
      ...newT,
      id: Math.random().toString(36).substring(2, 9)
    };

    const largeThreshold = preferences.notificationSettings?.largeTransactionThreshold ?? 500;

    if (preferences.notificationSettings?.largeTransactions && transaction.amount > largeThreshold) {
      const note: Notification = {
        id: Math.random().toString(36).substring(2, 9),
        type: NotificationType.INFO,
        title: 'Significant Activity',
        message: `A large transaction of ${preferences.currency}${transaction.amount.toFixed(2)} for "${transaction.description}" was recorded.`,
        timestamp: new Date().toISOString(),
        isRead: false
      };
      setNotifications(prev => [note, ...prev]);
    }

    // Auto-create subscription or bill if transaction is recurring
    const category = categories.find(c => c.id === transaction.categoryId);

    if (transaction.isRecurring && transaction.frequency && category) {
      // Auto-create SUBSCRIPTION if categorized as Subscriptions
      if (category.name === 'Subscriptions' || transaction.categoryId === '14') {
        const existingSubscription = subscriptions.find(s =>
          s.name === transaction.description &&
          s.cost === transaction.amount &&
          s.categoryId === transaction.categoryId
        );

        if (!existingSubscription) {
          // Calculate next billing date based on frequency
          const nextBillingDate = new Date(transaction.date);
          switch (transaction.frequency) {
            case RecurringFrequency.WEEKLY:
              nextBillingDate.setDate(nextBillingDate.getDate() + 7);
              break;
            case RecurringFrequency.BI_WEEKLY:
              nextBillingDate.setDate(nextBillingDate.getDate() + 14);
              break;
            case RecurringFrequency.MONTHLY:
              nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
              break;
            case RecurringFrequency.YEARLY:
              nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
              break;
          }

          const newSubscription: Subscription = {
            id: `sub-${Date.now()}`,
            name: transaction.description,
            cost: transaction.amount,
            billingCycle: transaction.frequency,
            categoryId: transaction.categoryId,
            accountId: transaction.accountId,
            startDate: transaction.date,
            nextBillingDate: nextBillingDate.toISOString().split('T')[0],
            status: SubscriptionStatus.ACTIVE,
            notes: 'Auto-created from transaction'
          };

          setSubscriptions(prev => [...prev, newSubscription]);
          transaction.linkedSubscriptionId = newSubscription.id;
        }
      }
      // Auto-create BILL for any recurring spending/debt transaction
      else if (category.type === CategoryType.SPENDING || category.type === CategoryType.DEBT) {
        const existingBill = bills.find(b =>
          b.name === transaction.description &&
          b.amount === transaction.amount &&
          b.categoryId === transaction.categoryId &&
          b.isRecurring
        );

        if (!existingBill) {
          // Calculate next due date
          const nextDueDate = new Date(transaction.date);
          switch (transaction.frequency) {
            case RecurringFrequency.WEEKLY:
              nextDueDate.setDate(nextDueDate.getDate() + 7);
              break;
            case RecurringFrequency.BI_WEEKLY:
              nextDueDate.setDate(nextDueDate.getDate() + 14);
              break;
            case RecurringFrequency.MONTHLY:
              nextDueDate.setMonth(nextDueDate.getMonth() + 1);
              break;
            case RecurringFrequency.YEARLY:
              nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
              break;
          }

          const newBill: Bill = {
            id: `bill-${Date.now()}`,
            name: transaction.description,
            amount: transaction.amount,
            dueDate: nextDueDate.toISOString().split('T')[0],
            categoryId: transaction.categoryId,
            accountId: transaction.accountId,
            isRecurring: true,
            frequency: transaction.frequency,
            status: BillStatus.UPCOMING,
            notes: 'Auto-created from transaction'
          };

          setBills(prev => [...prev, newBill]);
        }
      }
    }

    // Update account balance if transaction has an account
    if (transaction.accountId) {
      setAccounts(prev => prev.map(account => {
        if (account.id === transaction.accountId) {
          const txnType = preferences.transactionTypes.find(type => type.id === transaction.typeId);
          const isInflow = txnType?.behavior === TransactionBehavior.INFLOW;
          const newBalance = isInflow
            ? account.balance + transaction.amount
            : account.balance - transaction.amount;

          return {
            ...account,
            balance: newBalance,
            lastUpdated: new Date().toISOString()
          };
        }
        return account;
      }));

      // Auto-update debt budget if transaction is from credit card account
      const account = accounts.find(a => a.id === transaction.accountId);
      if (account && account.type === AccountType.CREDIT_CARD) {
        const debtCategory = categories.find(c => c.type === CategoryType.DEBT);
        if (debtCategory) {
          setCategories(prev => prev.map(cat => {
            if (cat.id === debtCategory.id) {
              return {
                ...cat,
                initialBalance: Math.abs(account.balance) // Credit card balance is debt
              };
            }
            return cat;
          }));
        }
      }
    }

    setTransactions(prev => [transaction, ...prev]);
  };

  const updateTransaction = (id: string, updates: Partial<Transaction>) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const importTransactions = (newTransactions: Omit<Transaction, 'id'>[]) => {
    const transactionsWithIds = newTransactions.map(t => ({
      ...t,
      id: Math.random().toString(36).substring(2, 9)
    }));

    // Auto-create bills and subscriptions for recurring transactions
    const newBills: Bill[] = [];
    const newSubscriptions: Subscription[] = [];

    transactionsWithIds.forEach(transaction => {
      if (transaction.isRecurring && transaction.frequency) {
        const category = categories.find(c => c.id === transaction.categoryId);
        if (!category) return;

        // Auto-create SUBSCRIPTION if categorized as Subscriptions
        if (category.name === 'Subscriptions' || transaction.categoryId === '14') {
          const existingSubscription = subscriptions.find(s =>
            s.name === transaction.description &&
            s.cost === transaction.amount &&
            s.categoryId === transaction.categoryId
          );

          if (!existingSubscription) {
            const nextBillingDate = new Date(transaction.date);
            switch (transaction.frequency) {
              case RecurringFrequency.WEEKLY:
                nextBillingDate.setDate(nextBillingDate.getDate() + 7);
                break;
              case RecurringFrequency.BI_WEEKLY:
                nextBillingDate.setDate(nextBillingDate.getDate() + 14);
                break;
              case RecurringFrequency.MONTHLY:
                nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
                break;
              case RecurringFrequency.YEARLY:
                nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
                break;
            }

            newSubscriptions.push({
              id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              name: transaction.description,
              cost: transaction.amount,
              billingCycle: transaction.frequency,
              categoryId: transaction.categoryId,
              accountId: transaction.accountId,
              startDate: transaction.date,
              nextBillingDate: nextBillingDate.toISOString().split('T')[0],
              status: SubscriptionStatus.ACTIVE,
              notes: 'Auto-created from import'
            });
          }
        }
        // Auto-create BILL for recurring spending/debt transactions
        else if (category.type === CategoryType.SPENDING || category.type === CategoryType.DEBT) {
          const existingBill = bills.find(b =>
            b.name === transaction.description &&
            b.amount === transaction.amount &&
            b.categoryId === transaction.categoryId &&
            b.isRecurring
          );

          if (!existingBill) {
            const nextDueDate = new Date(transaction.date);
            switch (transaction.frequency) {
              case RecurringFrequency.WEEKLY:
                nextDueDate.setDate(nextDueDate.getDate() + 7);
                break;
              case RecurringFrequency.BI_WEEKLY:
                nextDueDate.setDate(nextDueDate.getDate() + 14);
                break;
              case RecurringFrequency.MONTHLY:
                nextDueDate.setMonth(nextDueDate.getMonth() + 1);
                break;
              case RecurringFrequency.YEARLY:
                nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
                break;
            }

            newBills.push({
              id: `bill-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              name: transaction.description,
              amount: transaction.amount,
              dueDate: nextDueDate.toISOString().split('T')[0],
              categoryId: transaction.categoryId,
              accountId: transaction.accountId,
              isRecurring: true,
              frequency: transaction.frequency,
              status: BillStatus.UPCOMING,
              notes: 'Auto-created from import'
            });
          }
        }
      }
    });

    // Add all new items
    setTransactions(prev => [...transactionsWithIds, ...prev]);
    if (newBills.length > 0) {
      setBills(prev => [...newBills, ...prev]);
    }
    if (newSubscriptions.length > 0) {
      setSubscriptions(prev => [...newSubscriptions, ...prev]);
    }

    const note: Notification = {
      id: Math.random().toString(36).substring(2, 9),
      type: NotificationType.SUCCESS,
      title: 'Import Successful',
      message: `Successfully imported ${transactionsWithIds.length} records${newBills.length + newSubscriptions.length > 0 ? ` and auto-created ${newBills.length} bill(s) and ${newSubscriptions.length} subscription(s)` : ''}.`,
      timestamp: new Date().toISOString(),
      isRead: false
    };
    setNotifications(prev => [note, ...prev]);
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const bulkDeleteTransactions = (ids: string[]) => {
    if (confirm(`Are you sure you want to delete ${ids.length} transactions?`)) {
      setTransactions(prev => prev.filter(t => !ids.includes(t.id)));
    }
  };

  const bulkUpdateCategory = (ids: string[], categoryId: string) => {
    setTransactions(prev => prev.map(t => ids.includes(t.id) ? { ...t, categoryId } : t));
  };

  const updateCategory = (id: string, updates: Partial<Category>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const addCategory = (newCat: Omit<Category, 'id'>) => {
    const category: Category = {
      ...newCat,
      id: Math.random().toString(36).substring(2, 9)
    };
    setCategories(prev => [...prev, category]);
  };

  const deleteCategory = (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  const handleClearData = () => {
    if (!activeProfileId) return;
    localStorage.removeItem(`${STORAGE_KEY_TRANSACTIONS}_${activeProfileId}`);
    localStorage.removeItem(`${STORAGE_KEY_CATEGORIES}_${activeProfileId}`);
    localStorage.removeItem(`${STORAGE_KEY_PREFERENCES}_${activeProfileId}`);
    localStorage.removeItem(`${STORAGE_KEY_NOTIFICATIONS}_${activeProfileId}`);
    
    // Also remove from profile list
    handleDeleteProfile(activeProfileId);
  };
  
  const restoreFullState = (data: Partial<{
    preferences: UserPreferences;
    categories: Category[];
    transactions: Transaction[];
    bills: Bill[];
    merchantMappings: MerchantMapping[];
    subscriptions: Subscription[];
    goals: Goal[];
    splitTransactions: SplitTransaction[];
    accounts: Account[];
  }>, showNotification: boolean = true) => {
    // Restore all data fields from cloud backup
    if (data.preferences) {
      setPreferences({
        ...DEFAULT_PREFERENCES,
        ...data.preferences,
        notificationSettings: {
          ...DEFAULT_PREFERENCES.notificationSettings,
          ...(data.preferences.notificationSettings || {})
        },
        billReminderSettings: data.preferences.billReminderSettings
          ? { ...DEFAULT_PREFERENCES.billReminderSettings, ...data.preferences.billReminderSettings }
          : DEFAULT_PREFERENCES.billReminderSettings
      });
    }
    if (data.categories) setCategories(data.categories);
    if (data.transactions) setTransactions(data.transactions);
    if (data.bills) setBills(data.bills);
    if (data.merchantMappings) setMerchantMappings(data.merchantMappings);
    if (data.subscriptions) setSubscriptions(data.subscriptions);
    if (data.goals) setGoals(data.goals);
    if (data.splitTransactions) setSplitTransactions(data.splitTransactions);
    if (data.accounts) setAccounts(data.accounts);
    // Note: notifications are not restored from cloud as they are transient

    // Add notification about restore (only if requested)
    if (showNotification) {
      const note: Notification = {
        id: Math.random().toString(36).substring(2, 9),
        type: NotificationType.SUCCESS,
        title: 'Data Restored',
        message: 'Your data has been successfully restored from backup.',
        timestamp: new Date().toISOString(),
        isRead: false
      };
      setNotifications(prev => [note, ...prev]);
    }
  };

  const markNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const handleNavigateToTransactionEntry = (behavior: TransactionBehavior) => {
    setTransactionConfig({ mode: 'add', behavior });
    setActiveTab('transactions');
  };

  // Bill Management
  const addBill = (bill: Bill) => {
    setBills(prev => [...prev, bill]);
  };

  const updateBill = (bill: Bill) => {
    setBills(prev => prev.map(b => b.id === bill.id ? bill : b));
  };

  const deleteBill = (billId: string) => {
    setBills(prev => prev.filter(b => b.id !== billId));
  };

  const handlePayBill = (bill: Bill, transactionId: string) => {
    // Mark bill as paid and link to transaction
    const paidBill: Bill = {
      ...bill,
      status: BillStatus.PAID,
      lastPaidDate: new Date().toISOString(),
      linkedTransactionId: transactionId
    };
    updateBill(paidBill);

    // Create the transaction
    addTransaction({
      date: new Date().toISOString().split('T')[0],
      description: `Bill Payment: ${bill.name}`,
      amount: bill.amount,
      categoryId: bill.categoryId,
      typeId: 'type-expense',
      isRecurring: false
    });

    // If recurring, create next bill
    if (bill.isRecurring && bill.frequency) {
      const nextDueDate = new Date(bill.dueDate);
      switch (bill.frequency) {
        case 'Weekly':
          nextDueDate.setDate(nextDueDate.getDate() + 7);
          break;
        case 'Bi-Weekly':
          nextDueDate.setDate(nextDueDate.getDate() + 14);
          break;
        case 'Monthly':
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
          break;
        case 'Yearly':
          nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
          break;
      }

      const nextBill: Bill = {
        ...bill,
        id: `bill-${Date.now()}`,
        dueDate: nextDueDate.toISOString().split('T')[0],
        status: BillStatus.UPCOMING,
        lastPaidDate: undefined,
        linkedTransactionId: undefined
      };
      addBill(nextBill);
    }
  };

  const addNotification = (type: NotificationType, title: string, message: string) => {
    const notification: Notification = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      isRead: false
    };
    setNotifications(prev => [notification, ...prev]);
  };

  // Budget Templates
  const handleApplyTemplate = (newCategories: Category[]) => {
    setCategories(newCategories);
    setShowBudgetTemplates(false);
    addNotification(NotificationType.SUCCESS, 'Template Applied', `Budget template applied successfully with ${newCategories.length} categories`);
  };

  // Calculate monthly income for templates
  const calculateMonthlyIncome = () => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const incomeTransactions = transactions.filter(t => {
      const txnType = preferences.transactionTypes.find(type => type.id === t.typeId);
      return txnType?.behavior === TransactionBehavior.INFLOW && new Date(t.date) >= threeMonthsAgo;
    });

    const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    return totalIncome / 3; // Average monthly income
  };

  // Subscription Management
  const addSubscription = (subscription: Subscription) => {
    setSubscriptions(prev => [...prev, subscription]);
  };

  const updateSubscription = (subscription: Subscription) => {
    setSubscriptions(prev => prev.map(s => s.id === subscription.id ? subscription : s));
  };

  const deleteSubscription = (subscriptionId: string) => {
    setSubscriptions(prev => prev.filter(s => s.id !== subscriptionId));
  };

  // Account Management
  const addAccount = (account: Account) => {
    setAccounts(prev => [...prev, account]);
  };

  const updateAccount = (account: Account) => {
    setAccounts(prev => prev.map(a => a.id === account.id ? account : a));
  };

  const deleteAccount = (accountId: string) => {
    // Don't delete if it's the only account or if it has transactions
    const hasTransactions = transactions.some(t => t.accountId === accountId);
    if (accounts.length === 1) {
      addNotification(
        NotificationType.WARNING,
        'Cannot Delete',
        'You must have at least one account.'
      );
      return;
    }
    if (hasTransactions) {
      if (!confirm('This account has transactions. Deleting it will remove the account link from those transactions. Continue?')) {
        return;
      }
      // Remove account link from transactions
      setTransactions(prev => prev.map(t =>
        t.accountId === accountId ? { ...t, accountId: undefined } : t
      ));
    }
    setAccounts(prev => prev.filter(a => a.id !== accountId));
  };

  // Goal Management
  const addGoal = (goal: Goal) => {
    setGoals(prev => [...prev, goal]);
  };

  const updateGoal = (goal: Goal) => {
    setGoals(prev => prev.map(g => g.id === goal.id ? goal : g));
  };

  const deleteGoal = (goalId: string) => {
    setGoals(prev => prev.filter(g => g.id !== goalId));
  };

  const updateGoalProgress = (goalId: string, amount: number) => {
    setGoals(prev => prev.map(goal => {
      if (goal.id !== goalId) return goal;

      const newAmount = goal.currentAmount + amount;
      const percentComplete = (newAmount / goal.targetAmount) * 100;

      // Update milestones
      const updatedMilestones = goal.milestones.map(m => {
        if (!m.achieved && percentComplete >= m.percentage) {
          return {
            ...m,
            achieved: true,
            achievedDate: new Date().toISOString()
          };
        }
        return m;
      });

      // Check if goal is complete
      const isComplete = newAmount >= goal.targetAmount;

      return {
        ...goal,
        currentAmount: newAmount,
        milestones: updatedMilestones,
        status: isComplete ? GoalStatus.COMPLETED : goal.status
      };
    }));
  };

  // Authentication Handlers
  const handleSignIn = async (email: string, password: string) => {
    try {
      await signIn(email, password);
      // Set auth mode to cloud
      setPreferences(prev => ({ ...prev, authMode: 'cloud' }));
      // User state will be updated by onAuthStateChange listener
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : 'Failed to sign in');
    }
  };

  const handleSignUp = async (email: string, password: string) => {
    try {
      const result = await signUp(email, password);

      // Set auth mode to cloud
      setPreferences(prev => ({ ...prev, authMode: 'cloud' }));

      // Check if email confirmation is required
      if (result.user && !result.session) {
        addNotification(
          NotificationType.SUCCESS,
          'Account Created!',
          'Please check your email to verify your account before signing in.'
        );
      } else if (result.session) {
        // Email confirmation disabled, user is signed in immediately
        addNotification(
          NotificationType.SUCCESS,
          'Welcome!',
          'Your account has been created successfully.'
        );
      }
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : 'Failed to create account');
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    try {
      const result = await signInWithOAuth(provider);

      // Redirect to OAuth provider's auth page
      if (result.url) {
        window.location.href = result.url;
      }

      // Set auth mode to cloud
      setPreferences(prev => ({ ...prev, authMode: 'cloud' }));
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : 'Failed to sign in with OAuth');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      setActiveProfileId(null); // Clear active profile on sign out
      setShowAuthScreen(true); // Return to auth screen
      addNotification(
        NotificationType.INFO,
        'Signed Out',
        'You have been signed out successfully. Please sign in again to access cloud-synced profiles.'
      );
    } catch {
      // Sign out failed
    }
  };

  const handleSkipAuth = () => {
    setShowAuthScreen(false);
    setPreferences(prev => ({ ...prev, authMode: 'local' }));
  };

  if (isLoading || isCheckingAuth) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--color-bg-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--color-border-primary)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 14, fontWeight: 500 }}>Loading...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  // Show Auth Screen if user needs to sign in
  if (showAuthScreen && !user) {
    return (
      <Auth
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        onOAuthSignIn={handleOAuthSignIn}
        onSkip={handleSkipAuth}
      />
    );
  }

  // View Routing
  if (isSetupMode) {
    return (
      <SetupWizard 
        onComplete={handleCreateProfile} 
        onCancel={profiles.length > 0 ? () => setIsSetupMode(false) : undefined}
        canCancel={profiles.length > 0}
      />
    );
  }

  if (!activeProfileId) {
    return (
      <ProfileSelector 
        profiles={profiles} 
        onSelectProfile={handleProfileSelect} 
        onCreateProfile={() => setIsSetupMode(true)}
        onDeleteProfile={handleDeleteProfile}
      />
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <>
            <AutomationDashboard
              transactions={transactions}
              categories={categories}
              accounts={accounts}
              bills={bills}
              subscriptions={subscriptions}
              merchantMappings={merchantMappings}
              onCreateBill={addBill}
              onUpdateCategoryBudget={(categoryId, newBudget) => {
                const category = categories.find(c => c.id === categoryId);
                if (category) {
                  updateCategory(categoryId, { budget: newBudget });
                }
              }}
              onCreateMerchantMapping={(mapping) => {
                setMerchantMappings(prev => [...prev, mapping]);
              }}
              currency={preferences.currency}
            />
            <Dashboard
                transactions={transactions}
                categories={categories}
                preferences={preferences}
                bills={bills}
                goals={goals}
                onNavigateToTab={setActiveTab}
                onAddTransaction={handleNavigateToTransactionEntry}
            />
          </>
        );
      case 'transactions':
        return (
          <Transactions
            transactions={transactions}
            categories={categories}
            accounts={accounts}
            onAdd={addTransaction}
            onUpdate={updateTransaction}
            onDelete={deleteTransaction}
            onBulkDelete={bulkDeleteTransactions}
            onBulkCategoryUpdate={bulkUpdateCategory}
            preferences={preferences}
            initialConfig={transactionConfig}
            onClearConfig={() => setTransactionConfig(null)}
            onOpenCSVImport={() => setShowCSVImport(true)}
          />
        );
      case 'budgets':
        return (
          <Budgets
            categories={categories}
            transactions={transactions}
            accounts={accounts}
            onUpdateCategory={updateCategory}
            onAddCategory={addCategory}
            onDeleteCategory={deleteCategory}
            onUpdatePreferences={(updates) => setPreferences(prev => ({...prev, ...updates}))}
            preferences={preferences}
          />
        );
      case 'advisor':
        return <AIAdvisor transactions={transactions} categories={categories} />;
      case 'bills':
        return (
          <Bills
            bills={bills}
            categories={categories}
            accounts={accounts}
            transactions={transactions}
            currency={preferences.currency}
            onAddBill={addBill}
            onEditBill={updateBill}
            onDeleteBill={deleteBill}
            onPayBill={handlePayBill}
            onAddNotification={addNotification}
          />
        );
      case 'forecast':
        return (
          <IncomeForecast
            transactions={transactions}
            categories={categories}
            preferences={preferences}
            currency={preferences.currency}
          />
        );
      case 'subscriptions':
        return (
          <Subscriptions
            subscriptions={subscriptions}
            categories={categories}
            accounts={accounts}
            currency={preferences.currency}
            onAddSubscription={addSubscription}
            onEditSubscription={updateSubscription}
            onDeleteSubscription={deleteSubscription}
            onAddNotification={addNotification}
          />
        );
      case 'goals':
        return (
          <Goals
            goals={goals}
            categories={categories}
            accounts={accounts}
            transactions={transactions}
            preferences={preferences}
            currency={preferences.currency}
            onAddGoal={addGoal}
            onEditGoal={updateGoal}
            onDeleteGoal={deleteGoal}
            onUpdateGoalProgress={updateGoalProgress}
            onAddNotification={addNotification}
          />
        );
      case 'savings-debt':
        return (
          <SavingsDebtDashboard
            transactions={transactions}
            categories={categories}
            accounts={accounts}
            goals={goals}
            preferences={preferences}
            onNavigateToGoals={() => setActiveTab('goals')}
            onNavigateToBudgets={() => setActiveTab('budgets')}
          />
        );
      case 'settings':
        return (
          <Settings
            preferences={preferences}
            categories={categories}
            transactions={transactions}
            accounts={accounts}
            activeProfileId={activeProfileId}
            user={user}
            lastSyncTime={lastSyncTime}
            onUpdatePreferences={(updates) => setPreferences(prev => ({...prev, ...updates}))}
            onImportTransactions={importTransactions}
            onFullRestore={restoreFullState}
            onClearData={handleClearData}
            onSignOut={handleSignOut}
            onShowAuth={() => setShowAuthScreen(true)}
            onAddAccount={addAccount}
            onUpdateAccount={updateAccount}
            onDeleteAccount={deleteAccount}
          />
        );
      default:
        return (
            <Dashboard
                transactions={transactions}
                categories={categories}
                preferences={preferences}
                bills={bills}
                goals={goals}
                onNavigateToTab={setActiveTab}
                onAddTransaction={handleNavigateToTransactionEntry}
            />
        );
    }
  };

  return (
    <>
      <Layout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        preferences={preferences}
        notifications={notifications}
        onMarkRead={markNotificationsRead}
        onClearNotifications={clearNotifications}
        onSwitchProfile={() => setActiveProfileId(null)}
        onOpenTemplates={() => setShowBudgetTemplates(true)}
      >
        {renderContent()}
      </Layout>

      {showBudgetTemplates && (
        <BudgetTemplates
          categories={categories}
          monthlyIncome={calculateMonthlyIncome()}
          onApplyTemplate={handleApplyTemplate}
          onClose={() => setShowBudgetTemplates(false)}
        />
      )}

      {showCSVImport && (
        <CSVImport
          transactions={transactions}
          categories={categories}
          accounts={accounts}
          merchantMappings={merchantMappings}
          onImport={importTransactions}
          onUpdateMerchantMappings={setMerchantMappings}
          onClose={() => setShowCSVImport(false)}
          currency={preferences.currency}
        />
      )}
    </>
  );
};

export default App;
