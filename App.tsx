
import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Transactions } from './components/Transactions';
import { Budgets } from './components/Budgets';
import { AIAdvisor } from './components/AIAdvisor';
import { Settings } from './components/Settings';
import { SetupWizard } from './components/SetupWizard';
import { Transaction, Category, UserPreferences, Notification, NotificationType, TransactionBehavior } from './types';
import { 
  INITIAL_CATEGORIES, 
  STORAGE_KEY_TRANSACTIONS, 
  STORAGE_KEY_CATEGORIES, 
  STORAGE_KEY_PREFERENCES, 
  STORAGE_KEY_NOTIFICATIONS,
  DEFAULT_PREFERENCES 
} from './constants';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    const storedTransactions = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
    const storedCategories = localStorage.getItem(STORAGE_KEY_CATEGORIES);
    const storedPrefs = localStorage.getItem(STORAGE_KEY_PREFERENCES);
    const storedNotes = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
    
    if (storedTransactions) setTransactions(JSON.parse(storedTransactions));
    if (storedCategories) setCategories(JSON.parse(storedCategories));
    
    if (storedPrefs) {
      const parsed = JSON.parse(storedPrefs);
      // Deep merge with defaults to handle version updates
      setPreferences({
        ...DEFAULT_PREFERENCES,
        ...parsed,
        notificationSettings: {
          ...DEFAULT_PREFERENCES.notificationSettings,
          ...(parsed.notificationSettings || {})
        }
      });
    }
    
    if (storedNotes) setNotifications(JSON.parse(storedNotes));
    
    setIsLoading(false);
  }, []);

  // Persistent storage updates
  useEffect(() => {
    if (!isLoading) localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
  }, [transactions, isLoading]);

  useEffect(() => {
    if (!isLoading) localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(categories));
  }, [categories, isLoading]);

  useEffect(() => {
    if (!isLoading) localStorage.setItem(STORAGE_KEY_PREFERENCES, JSON.stringify(preferences));
  }, [preferences, isLoading]);

  useEffect(() => {
    if (!isLoading) localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(notifications));
  }, [notifications, isLoading]);

  // Notification Engine
  const checkFinancialHealth = useCallback(() => {
    // Check if budget warnings are enabled
    if (!preferences.notificationSettings?.budgetWarnings) return;

    const newNotifications: Notification[] = [];
    const timestamp = new Date().toISOString();

    // Check category budgets
    categories.forEach(cat => {
      if (cat.name === 'Income') return;

      const spent = transactions
        .filter(t => t.categoryId === cat.id)
        .filter(t => preferences.transactionTypes.find(type => type.id === t.typeId)?.behavior === TransactionBehavior.OUTFLOW)
        .reduce((sum, t) => sum + t.amount, 0);

      const budget = cat.budget;
      if (budget <= 0) return;

      const ratio = spent / budget;

      // 100%+ Over budget
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
      } 
      // 80% Warning
      else if (ratio >= 0.8) {
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

  // Run health check when data changes
  useEffect(() => {
    if (!isLoading && transactions.length > 0) {
      checkFinancialHealth();
    }
  }, [transactions, categories, isLoading]);

  const addTransaction = (newT: Omit<Transaction, 'id'>) => {
    const transaction: Transaction = {
      ...newT,
      id: Math.random().toString(36).substring(2, 9)
    };
    
    // Check for large transaction alert based on user preference
    if (preferences.notificationSettings?.largeTransactions && transaction.amount > 500) {
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

  const navigateToCategory = (categoryId: string) => {
    setActiveTab('budgets');
  };

  const handleClearData = () => {
    localStorage.clear();
    window.location.reload();
  };

  const markNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  if (isLoading) return null;

  if (!preferences.setupComplete) {
    return <SetupWizard onComplete={setPreferences} />;
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
            onNavigateToCategory={navigateToCategory}
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
            onUpdatePreferences={(updates) => setPreferences(prev => ({...prev, ...updates}))} 
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
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
