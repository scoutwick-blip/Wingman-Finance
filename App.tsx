
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
import { Transaction, Category, UserPreferences, Notification, NotificationType, TransactionBehavior, UserProfile } from './types';
import { 
  INITIAL_CATEGORIES, 
  STORAGE_KEY_TRANSACTIONS, 
  STORAGE_KEY_CATEGORIES, 
  STORAGE_KEY_PREFERENCES, 
  STORAGE_KEY_NOTIFICATIONS,
  STORAGE_KEY_PROFILES,
  DEFAULT_PREFERENCES 
} from './constants';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isSetupMode, setIsSetupMode] = useState(false);

  // Per-profile state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);

  // Initial Boot: Load Profiles and Check for Legacy Data
  useEffect(() => {
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

    setProfiles(loadedProfiles);
    
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
                lastActive: new Date().toISOString()
             };
             
             // Save to storage immediately
             const updatedProfiles = [...loadedProfiles, newProfile];
             setProfiles(updatedProfiles);
             localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(updatedProfiles));
             
             localStorage.setItem(`${STORAGE_KEY_PREFERENCES}_${newId}`, JSON.stringify(data.preferences));
             localStorage.setItem(`${STORAGE_KEY_CATEGORIES}_${newId}`, JSON.stringify(data.categories));
             localStorage.setItem(`${STORAGE_KEY_TRANSACTIONS}_${newId}`, JSON.stringify(data.transactions));
             localStorage.setItem(`${STORAGE_KEY_NOTIFICATIONS}_${newId}`, JSON.stringify([]));
             
             // Clean URL
             window.history.replaceState({}, document.title, window.location.pathname);
             
             alert('Import successful! Please select the new profile.');
          }
        }
      } catch (e) {
        console.error("Import failed", e);
        alert("Failed to read QR code data.");
      }
    }

    if (loadedProfiles.length > 0) {
      // Don't auto-login, show selector
    } else {
      setIsSetupMode(true);
    }
    setIsLoading(false);
  }, []);

  // Load Profile Data when activeProfileId changes
  useEffect(() => {
    if (!activeProfileId) return;

    const t = localStorage.getItem(`${STORAGE_KEY_TRANSACTIONS}_${activeProfileId}`);
    const c = localStorage.getItem(`${STORAGE_KEY_CATEGORIES}_${activeProfileId}`);
    const p = localStorage.getItem(`${STORAGE_KEY_PREFERENCES}_${activeProfileId}`);
    const n = localStorage.getItem(`${STORAGE_KEY_NOTIFICATIONS}_${activeProfileId}`);

    setTransactions(t ? JSON.parse(t) : []);
    
    // If loading categories, use them. If not (shouldn't happen for new profiles), use INITIAL.
    setCategories(c ? JSON.parse(c) : INITIAL_CATEGORIES);
    
    setNotifications(n ? JSON.parse(n) : []);

    if (p) {
      const parsed = JSON.parse(p);
      setPreferences({
        ...DEFAULT_PREFERENCES,
        ...parsed,
        notificationSettings: {
          ...DEFAULT_PREFERENCES.notificationSettings,
          ...(parsed.notificationSettings || {})
        }
      });
    } else {
      setPreferences(DEFAULT_PREFERENCES);
    }
  }, [activeProfileId]);

  // Persistent Storage for Active Profile
  useEffect(() => {
    if (!activeProfileId || isLoading) return;
    localStorage.setItem(`${STORAGE_KEY_TRANSACTIONS}_${activeProfileId}`, JSON.stringify(transactions));
  }, [transactions, activeProfileId, isLoading]);

  useEffect(() => {
    if (!activeProfileId || isLoading) return;
    localStorage.setItem(`${STORAGE_KEY_CATEGORIES}_${activeProfileId}`, JSON.stringify(categories));
  }, [categories, activeProfileId, isLoading]);

  useEffect(() => {
    if (!activeProfileId || isLoading) return;
    localStorage.setItem(`${STORAGE_KEY_PREFERENCES}_${activeProfileId}`, JSON.stringify(preferences));
    
    // Update profile list metadata (name/avatar update)
    const updatedProfiles = profiles.map(p => 
      p.id === activeProfileId 
        ? { ...p, name: preferences.name, avatar: preferences.profileImage, lastActive: new Date().toISOString() } 
        : p
    );
    // Only write if changed to avoid loop? Simple compare
    const currentP = profiles.find(p => p.id === activeProfileId);
    if (currentP && (currentP.name !== preferences.name || currentP.avatar !== preferences.profileImage)) {
      setProfiles(updatedProfiles);
      localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(updatedProfiles));
    }
  }, [preferences, activeProfileId, isLoading]);

  useEffect(() => {
    if (!activeProfileId || isLoading) return;
    localStorage.setItem(`${STORAGE_KEY_NOTIFICATIONS}_${activeProfileId}`, JSON.stringify(notifications));
  }, [notifications, activeProfileId, isLoading]);

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
    const newId = 'user-' + Date.now();
    const newProfile: UserProfile = {
      id: newId,
      name: prefs.name,
      avatar: prefs.profileImage,
      lastActive: new Date().toISOString()
    };
    
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
            message: `You've exceeded your ${preferences.currency}${budget} budget for ${cat.name}. Currently at ${preferences.currency}${spent.toLocaleString()}.`,
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
        message: `A large transaction of ${preferences.currency}${transaction.amount.toLocaleString()} for "${transaction.description}" was recorded.`,
        timestamp: new Date().toISOString(),
        isRead: false
      };
      setNotifications(prev => [note, ...prev]);
    }

    setTransactions(prev => [transaction, ...prev]);
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
  
  const restoreFullState = (data: { preferences: UserPreferences; categories: Category[]; transactions: Transaction[] }) => {
    if (data.preferences) setPreferences(data.preferences);
    if (data.categories) setCategories(data.categories);
    if (data.transactions) setTransactions(data.transactions);
    
    // Add notification about restore
    const note: Notification = {
      id: Math.random().toString(36).substring(2, 9),
      type: NotificationType.SUCCESS,
      title: 'Data Restored',
      message: 'Your data has been successfully restored from backup.',
      timestamp: new Date().toISOString(),
      isRead: false
    };
    setNotifications(prev => [note, ...prev]);
  };

  const markNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  if (isLoading) return null;

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
        return <Dashboard transactions={transactions} categories={categories} preferences={preferences} onNavigateToTab={setActiveTab} />;
      case 'transactions':
        return (
          <Transactions 
            transactions={transactions} 
            categories={categories} 
            onAdd={addTransaction} 
            onDelete={deleteTransaction}
            onNavigateToCategory={(id) => setActiveTab('budgets')}
            preferences={preferences}
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
      case 'settings':
        return (
          <Settings 
            preferences={preferences} 
            categories={categories}
            transactions={transactions}
            activeProfileId={activeProfileId}
            onUpdatePreferences={(updates) => setPreferences(prev => ({...prev, ...updates}))} 
            onImportTransactions={importTransactions}
            onFullRestore={restoreFullState}
            onClearData={handleClearData}
          />
        );
      default:
        return <Dashboard transactions={transactions} categories={categories} preferences={preferences} onNavigateToTab={setActiveTab} />;
    }
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      preferences={preferences}
      notifications={notifications}
      onMarkRead={markNotificationsRead}
      onClearNotifications={clearNotifications}
      onSwitchProfile={() => setActiveProfileId(null)}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
