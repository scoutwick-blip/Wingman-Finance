
import React, { useState, useEffect, useCallback } from 'react';
import LZString from 'lz-string';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Transactions } from './components/Transactions';
import { Budgets } from './components/Budgets';
import { AIAdvisor } from './components/AIAdvisor';
import { Settings } from './components/Settings';
import { SetupWizard } from './components/SetupWizard';
import { ProfileSelector } from './components/ProfileSelector';
import Auth from './components/Auth';
import { Transaction, Category, UserPreferences, Notification, NotificationType, TransactionBehavior, UserProfile, Bill, BillStatus, MerchantMapping, Subscription, Goal, GoalStatus, SplitTransaction, Account, AccountType, SubscriptionStatus, RecurringFrequency } from './types';
import { initSupabase, signIn, signUp, signInWithOAuth, signOut, getCurrentUser, onAuthStateChange, uploadAuthData, downloadAuthData, fetchUserProfiles } from './services/supabaseService';
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
    let subscription: any = null;

    const initAuth = async () => {
      try {
        // Check for Supabase configuration from environment variables
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
          try {
            initSupabase(supabaseUrl, supabaseKey);

            // Check for existing session
            const currentUser = await getCurrentUser();
            if (currentUser) {
              setUser(currentUser);
              setShowAuthScreen(false);
            } else {
              // No session - check if user has chosen local-only mode before
              const storedPrefs = localStorage.getItem(STORAGE_KEY_PREFERENCES);
              if (storedPrefs) {
                const prefs = JSON.parse(storedPrefs);
                if (prefs.authMode === 'local') {
                  setShowAuthScreen(false);
                } else if (prefs.authMode === 'cloud') {
                  setShowAuthScreen(true);
                } else {
                  // User has data but hasn't chosen auth mode yet - show auth screen
                  setShowAuthScreen(true);
                }
              } else {
                // New user with no data - show auth screen by default
                setShowAuthScreen(true);
              }
            }

            // Listen for auth state changes
            const { data } = onAuthStateChange((session, user) => {
              setUser(user);
              if (user) {
                setShowAuthScreen(false);
              }
            });
            subscription = data.subscription;

          } catch (error) {
            console.error('Failed to initialize Supabase:', error);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
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
            name: parsedPrefs.name || 'Pilot',
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
               } catch (e) {
                  console.error("Storage limit reached during import", e);
                  alert("Cannot import data: Not enough storage space available.");
               }
            }
          }
        } catch (e) {
          console.error("Import failed", e);
          alert("Failed to read QR code data.");
        }
      }

      // Check cloud for existing profiles if user is authenticated and no local profiles
      if (user && loadedProfiles.length === 0) {
        try {
          console.log('No local profiles found, checking cloud for user:', user.email);
          const cloudProfiles = await fetchUserProfiles();
          console.log('Cloud profiles found:', cloudProfiles.length);

          if (cloudProfiles.length > 0) {
            // Use the most recent cloud profile
            const mostRecent = cloudProfiles[0];
            const profileId = `user-${user.id}`;
            console.log('Loading cloud profile:', profileId);

            // Create local profile from cloud data
            const cloudData = mostRecent.data;
            const newProfile: UserProfile = {
              id: profileId,
              name: cloudData.preferences?.name || 'User',
              avatar: cloudData.preferences?.profileImage,
              pin: cloudData.preferences?.pin,
              lastActive: new Date().toISOString()
            };

            // Save profile
            loadedProfiles = [newProfile];
            setProfiles(loadedProfiles);
            localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(loadedProfiles));

            // Restore data from cloud
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

            // Auto-select this profile
            setActiveProfileId(profileId);
            console.log('✅ Cloud profile loaded and activated');
          }
        } catch (error) {
          console.error('Failed to check cloud profiles:', error);
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

  // Load Profile Data when activeProfileId changes
  useEffect(() => {
    if (!activeProfileId) return;

    const t = localStorage.getItem(`${STORAGE_KEY_TRANSACTIONS}_${activeProfileId}`);
    const c = localStorage.getItem(`${STORAGE_KEY_CATEGORIES}_${activeProfileId}`);
    const p = localStorage.getItem(`${STORAGE_KEY_PREFERENCES}_${activeProfileId}`);
    const n = localStorage.getItem(`${STORAGE_KEY_NOTIFICATIONS}_${activeProfileId}`);
    const b = localStorage.getItem(`${STORAGE_KEY_BILLS}_${activeProfileId}`);
    const m = localStorage.getItem(`${STORAGE_KEY_MERCHANT_MAPPINGS}_${activeProfileId}`);
    const s = localStorage.getItem(`${STORAGE_KEY_SUBSCRIPTIONS}_${activeProfileId}`);
    const g = localStorage.getItem(`${STORAGE_KEY_GOALS}_${activeProfileId}`);
    const st = localStorage.getItem(`${STORAGE_KEY_SPLIT_TRANSACTIONS}_${activeProfileId}`);
    const a = localStorage.getItem(`${STORAGE_KEY_ACCOUNTS}_${activeProfileId}`);

    setTransactions(t ? JSON.parse(t) : []);

    // If loading categories, use them. If not (shouldn't happen for new profiles), use INITIAL.
    setCategories(c ? JSON.parse(c) : INITIAL_CATEGORIES);

    setNotifications(n ? JSON.parse(n) : []);
    setBills(b ? JSON.parse(b) : []);
    setMerchantMappings(m ? JSON.parse(m) : []);
    setSubscriptions(s ? JSON.parse(s) : []);
    setGoals(g ? JSON.parse(g) : []);
    setSplitTransactions(st ? JSON.parse(st) : []);
    setAccounts(a ? JSON.parse(a) : DEFAULT_ACCOUNTS);

    if (p) {
      const parsed = JSON.parse(p);
      setPreferences({
        ...DEFAULT_PREFERENCES,
        ...parsed,
        notificationSettings: {
          ...DEFAULT_PREFERENCES.notificationSettings,
          ...(parsed.notificationSettings || {})
        },
        billReminderSettings: {
          ...DEFAULT_PREFERENCES.billReminderSettings,
          ...(parsed.billReminderSettings || {})
        }
      });
    } else {
      setPreferences(DEFAULT_PREFERENCES);
    }
  }, [activeProfileId]);

  // Persistent Storage for Active Profile
  useEffect(() => {
    if (!activeProfileId || isLoading) return;
    try {
      localStorage.setItem(`${STORAGE_KEY_TRANSACTIONS}_${activeProfileId}`, JSON.stringify(transactions));
    } catch (e) {
      console.error("Failed to save transactions to storage", e);
    }
  }, [transactions, activeProfileId, isLoading]);

  useEffect(() => {
    if (!activeProfileId || isLoading) return;
    try {
      localStorage.setItem(`${STORAGE_KEY_CATEGORIES}_${activeProfileId}`, JSON.stringify(categories));
    } catch (e) {
      console.error("Failed to save categories to storage", e);
    }
  }, [categories, activeProfileId, isLoading]);

  useEffect(() => {
    if (!activeProfileId || isLoading) return;
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFERENCES}_${activeProfileId}`, JSON.stringify(preferences));
      
      // Update profile list metadata (name/avatar update)
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
      // Only write if changed to avoid loop? Simple compare
      const currentP = profiles.find(p => p.id === activeProfileId);
      if (currentP && (currentP.name !== preferences.name || currentP.avatar !== preferences.profileImage || currentP.pin !== preferences.pin)) {
        setProfiles(updatedProfiles);
        localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(updatedProfiles));
      }
    } catch (e) {
      console.error("Failed to save preferences to storage", e);
    }
  }, [preferences, activeProfileId, isLoading]);

  useEffect(() => {
    if (!activeProfileId || isLoading) return;
    try {
      localStorage.setItem(`${STORAGE_KEY_NOTIFICATIONS}_${activeProfileId}`, JSON.stringify(notifications));
    } catch (e) {
      console.error("Failed to save notifications to storage", e);
    }
  }, [notifications, activeProfileId, isLoading]);

  useEffect(() => {
    if (!activeProfileId || isLoading) return;
    try {
      localStorage.setItem(`${STORAGE_KEY_BILLS}_${activeProfileId}`, JSON.stringify(bills));
    } catch (e) {
      console.error("Failed to save bills to storage", e);
    }
  }, [bills, activeProfileId, isLoading]);

  useEffect(() => {
    if (!activeProfileId || isLoading) return;
    try {
      localStorage.setItem(`${STORAGE_KEY_MERCHANT_MAPPINGS}_${activeProfileId}`, JSON.stringify(merchantMappings));
    } catch (e) {
      console.error("Failed to save merchant mappings to storage", e);
    }
  }, [merchantMappings, activeProfileId, isLoading]);

  useEffect(() => {
    if (!activeProfileId || isLoading) return;
    try {
      localStorage.setItem(`${STORAGE_KEY_SUBSCRIPTIONS}_${activeProfileId}`, JSON.stringify(subscriptions));
    } catch (e) {
      console.error("Failed to save subscriptions to storage", e);
    }
  }, [subscriptions, activeProfileId, isLoading]);

  useEffect(() => {
    if (!activeProfileId || isLoading) return;
    try {
      localStorage.setItem(`${STORAGE_KEY_GOALS}_${activeProfileId}`, JSON.stringify(goals));
    } catch (e) {
      console.error("Failed to save goals to storage", e);
    }
  }, [goals, activeProfileId, isLoading]);

  useEffect(() => {
    if (!activeProfileId || isLoading) return;
    try {
      localStorage.setItem(`${STORAGE_KEY_SPLIT_TRANSACTIONS}_${activeProfileId}`, JSON.stringify(splitTransactions));
    } catch (e) {
      console.error("Failed to save split transactions to storage", e);
    }
  }, [splitTransactions, activeProfileId, isLoading]);

  useEffect(() => {
    if (!activeProfileId || isLoading) return;
    try {
      localStorage.setItem(`${STORAGE_KEY_ACCOUNTS}_${activeProfileId}`, JSON.stringify(accounts));
    } catch (e) {
      console.error("Failed to save accounts to storage", e);
    }
  }, [accounts, activeProfileId, isLoading]);

  // Auto-sync to cloud when authenticated (debounced)
  useEffect(() => {
    if (!user || !activeProfileId || isLoading || isCheckingAuth) {
      console.log('Auto-sync skipped:', { user: !!user, activeProfileId, isLoading, isCheckingAuth });
      return;
    }

    // Debounce: only sync if 5 seconds have passed since last sync
    const now = Date.now();
    if (now - lastSyncTime < 5000) {
      console.log('Auto-sync debounced (too soon since last sync)');
      return;
    }

    if (isSyncing) {
      console.log('Auto-sync skipped (already syncing)');
      return;
    }

    const syncToCloud = async () => {
      try {
        console.log('Starting auto-sync to cloud...');
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
        console.log('✅ Auto-synced to cloud successfully');
      } catch (error) {
        console.error('❌ Auto-sync failed:', error);
      } finally {
        setIsSyncing(false);
      }
    };

    // Debounce with a timeout
    const timeoutId = setTimeout(syncToCloud, 2000);
    return () => clearTimeout(timeoutId);
    // Only sync when actual data changes, not when sync state changes
  }, [user, activeProfileId, transactions, categories, bills, merchantMappings, subscriptions, goals, splitTransactions, accounts, isLoading, isCheckingAuth]);

  // Load cloud data on first sign in (only runs once when user signs in)
  useEffect(() => {
    if (!user || !activeProfileId) {
      console.log('Cloud data load skipped:', { user: !!user, activeProfileId });
      return;
    }

    let hasLoaded = false; // Prevent multiple loads

    const loadCloudData = async () => {
      if (hasLoaded) return;
      hasLoaded = true;

      try {
        console.log('Attempting to load cloud data for profile:', activeProfileId);
        const cloudData = await downloadAuthData(activeProfileId);
        console.log('Cloud data response:', cloudData);

        if (cloudData && cloudData.content) {
          console.log('Cloud data found, checking timestamps...');
          // Check if cloud data is newer than local data
          const cloudTime = new Date(cloudData.updatedAt).getTime();
          const localPrefs = localStorage.getItem(`${STORAGE_KEY_PREFERENCES}_${activeProfileId}`);

          if (localPrefs) {
            const parsed = JSON.parse(localPrefs);
            const localTime = parsed.supabaseConfig?.lastSynced
              ? new Date(parsed.supabaseConfig.lastSynced).getTime()
              : 0;

            console.log('Cloud time:', new Date(cloudTime), 'Local time:', new Date(localTime));

            if (cloudTime > localTime) {
              // Cloud data is newer, load it automatically
              console.log('Cloud data is newer, loading automatically...');
              restoreFullState(cloudData.content, false);
              console.log('✅ Cloud data loaded successfully');
            } else {
              console.log('Local data is newer or same, skipping cloud load');
            }
          } else {
            // No local data, load cloud data automatically
            console.log('No local data found, loading cloud data automatically...');
            restoreFullState(cloudData.content, false);
            console.log('✅ Cloud data loaded successfully');
          }
        } else {
          console.log('No cloud data found for this profile');
        }
      } catch (error) {
        console.error('❌ Failed to load cloud data:', error);
      }
    };

    loadCloudData();
  }, [user, activeProfileId]); // Only run when user or profile changes

  // Profile Management Methods
  const handleProfileSelect = (id: string) => {
    setActiveProfileId(id);
    setIsSetupMode(false);
    // Update last active
    const updatedProfiles = profiles.map(p => p.id === id ? { ...p, lastActive: new Date().toISOString() } : p);
    setProfiles(updatedProfiles);
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(updatedProfiles));
  };

  const handleCreateProfile = (prefs: UserPreferences) => {
    // Use user.id if authenticated, otherwise timestamp
    const newId = user ? `user-${user.id}` : 'user-' + Date.now();
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

      // Initialize Data for new user
      localStorage.setItem(`${STORAGE_KEY_PREFERENCES}_${newId}`, JSON.stringify(prefs));

      // ZERO OUT DEFAULT CATEGORIES for fresh start
      const zeroedCategories = INITIAL_CATEGORIES.map(c => ({
        ...c,
        budget: 0,
        initialBalance: 0
      }));
      localStorage.setItem(`${STORAGE_KEY_CATEGORIES}_${newId}`, JSON.stringify(zeroedCategories));

      // Empty transaction and notification history
      localStorage.setItem(`${STORAGE_KEY_TRANSACTIONS}_${newId}`, JSON.stringify([]));
      localStorage.setItem(`${STORAGE_KEY_NOTIFICATIONS}_${newId}`, JSON.stringify([]));

      setActiveProfileId(newId);
      setIsSetupMode(false);
    } catch (e) {
      alert("Failed to create profile: Storage full.");
    }
  };

  const handleDeleteProfile = (id: string) => {
    const updatedProfiles = profiles.filter(p => p.id !== id);
    setProfiles(updatedProfiles);
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(updatedProfiles));
    
    // Clean data
    localStorage.removeItem(`${STORAGE_KEY_TRANSACTIONS}_${id}`);
    localStorage.removeItem(`${STORAGE_KEY_CATEGORIES}_${id}`);
    localStorage.removeItem(`${STORAGE_KEY_PREFERENCES}_${id}`);
    localStorage.removeItem(`${STORAGE_KEY_NOTIFICATIONS}_${id}`);

    if (activeProfileId === id) {
      setActiveProfileId(null);
    }
  };


  // Notification Engine
  const checkFinancialHealth = useCallback(() => {
    if (!preferences.notificationSettings?.budgetWarnings) return;

    const newNotifications: Notification[] = [];
    const timestamp = new Date().toISOString();
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
        if (!notifications.some(n => n.title === title && new Date(n.timestamp).toDateString() === new Date().toDateString())) {
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
        if (!notifications.some(n => n.title === title && new Date(n.timestamp).toDateString() === new Date().toDateString())) {
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

    if (newNotifications.length > 0) {
      setNotifications(prev => [...newNotifications, ...prev].slice(0, 50));
    }
  }, [transactions, categories, preferences, notifications]);

  useEffect(() => {
    if (!isLoading && activeProfileId && transactions.length > 0) {
      checkFinancialHealth();
    }
  }, [transactions, categories, isLoading, activeProfileId]);

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

    // Auto-create subscription if transaction is recurring and categorized as subscription
    const category = categories.find(c => c.id === transaction.categoryId);
    if (transaction.isRecurring && transaction.frequency && (category?.name === 'Subscriptions' || transaction.categoryId === '14')) {
      // Check if subscription doesn't already exist for this transaction
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
          startDate: transaction.date,
          nextBillingDate: nextBillingDate.toISOString().split('T')[0],
          status: SubscriptionStatus.ACTIVE,
          notes: 'Auto-created from transaction'
        };

        setSubscriptions(prev => [...prev, newSubscription]);

        // Link subscription to transaction
        transaction.linkedSubscriptionId = newSubscription.id;

        console.log('✅ Auto-created subscription:', newSubscription.name);
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
    setTransactions(prev => [...transactionsWithIds, ...prev]);
    const note: Notification = {
      id: Math.random().toString(36).substring(2, 9),
      type: NotificationType.SUCCESS,
      title: 'Import Successful',
      message: `Successfully imported ${transactionsWithIds.length} records to your history.`,
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
  
  const restoreFullState = (data: { preferences: UserPreferences; categories: Category[]; transactions: Transaction[] }, showNotification: boolean = true) => {
    if (data.preferences) setPreferences(data.preferences);
    if (data.categories) setCategories(data.categories);
    if (data.transactions) setTransactions(data.transactions);

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
    } catch (error: any) {
      throw new Error(error.message || 'Failed to sign in');
    }
  };

  const handleSignUp = async (email: string, password: string) => {
    try {
      console.log('Attempting sign up for:', email);
      const result = await signUp(email, password);
      console.log('Sign up result:', result);

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
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw new Error(error.message || 'Failed to create account');
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    try {
      console.log('Attempting OAuth sign in with:', provider);
      const result = await signInWithOAuth(provider);
      console.log('OAuth result:', result);

      // Redirect to OAuth provider's auth page
      if (result.url) {
        window.location.href = result.url;
      }

      // Set auth mode to cloud
      setPreferences(prev => ({ ...prev, authMode: 'cloud' }));
    } catch (error: any) {
      console.error('OAuth error:', error);
      throw new Error(error.message || 'Failed to sign in with OAuth');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      addNotification(
        NotificationType.INFO,
        'Signed Out',
        'You have been signed out successfully.'
      );
    } catch (error: any) {
      console.error('Sign out failed:', error);
    }
  };

  const handleSkipAuth = () => {
    setShowAuthScreen(false);
    setPreferences(prev => ({ ...prev, authMode: 'local' }));
  };

  if (isLoading || isCheckingAuth) {
    return null;
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
            <Dashboard 
                transactions={transactions} 
                categories={categories} 
                preferences={preferences} 
                onNavigateToTab={setActiveTab}
                onAddTransaction={handleNavigateToTransactionEntry}
            />
        );
      case 'transactions':
        return (
          <Transactions
            transactions={transactions}
            categories={categories}
            onAdd={addTransaction}
            onUpdate={updateTransaction}
            onDelete={deleteTransaction}
            onBulkDelete={bulkDeleteTransactions}
            onBulkCategoryUpdate={bulkUpdateCategory}
            onNavigateToCategory={(id) => setActiveTab('budgets')}
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
            onUpdateCategory={updateCategory}
            onAddCategory={addCategory}
            onDeleteCategory={deleteCategory}
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
      case 'settings':
        return (
          <Settings
            preferences={preferences}
            categories={categories}
            transactions={transactions}
            activeProfileId={activeProfileId}
            user={user}
            lastSyncTime={lastSyncTime}
            onUpdatePreferences={(updates) => setPreferences(prev => ({...prev, ...updates}))}
            onImportTransactions={importTransactions}
            onFullRestore={restoreFullState}
            onClearData={handleClearData}
            onSignOut={handleSignOut}
            onShowAuth={() => setShowAuthScreen(true)}
          />
        );
      default:
        return (
            <Dashboard 
                transactions={transactions} 
                categories={categories} 
                preferences={preferences} 
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
          onImport={importTransactions}
          onClose={() => setShowCSVImport(false)}
          currency={preferences.currency}
        />
      )}
    </>
  );
};

export default App;
