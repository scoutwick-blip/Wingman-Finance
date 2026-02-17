
import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import LZString from 'lz-string';
import { UserPreferences, TransactionBehavior, TransactionTypeDefinition, Category, Transaction, Account, AccountType } from '../types';
import { uploadToCloud, downloadFromCloud, testConnection } from '../services/supabaseService';
import { User } from '@supabase/supabase-js';
import { LogOut, LogIn, User as UserIcon, Wallet, Plus, Edit2, Trash2, CreditCard, PiggyBank, Banknote } from 'lucide-react';

interface SettingsProps {
  preferences: UserPreferences;
  categories: Category[];
  transactions: Transaction[];
  accounts: Account[];
  activeProfileId: string;
  user?: User | null;
  lastSyncTime?: number;
  onUpdatePreferences: (updates: Partial<UserPreferences>) => void;
  onImportTransactions: (transactions: Omit<Transaction, 'id'>[]) => void;
  onFullRestore: (data: { preferences: UserPreferences; categories: Category[]; transactions: Transaction[] }) => void;
  onClearData: () => void;
  onSignOut?: () => Promise<void>;
  onShowAuth?: () => void;
  onAddAccount: (account: Account) => void;
  onUpdateAccount: (account: Account) => void;
  onDeleteAccount: (accountId: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({
  preferences,
  categories,
  transactions,
  accounts,
  activeProfileId,
  user,
  lastSyncTime,
  onUpdatePreferences,
  onImportTransactions,
  onFullRestore,
  onClearData,
  onSignOut,
  onShowAuth,
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount
}) => {
  const currencies = ['$', '€', '£', '¥', '₹', '₱', '₩', 'R$'];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeBehavior, setNewTypeBehavior] = useState<TransactionBehavior>(TransactionBehavior.OUTFLOW);
  const [importStatus, setImportStatus] = useState<string>('');
  
  // Cloud Sync State
  const [showAdvancedSync, setShowAdvancedSync] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState(preferences.supabaseConfig?.url || '');
  const [supabaseKey, setSupabaseKey] = useState(preferences.supabaseConfig?.key || '');
  const [syncStatus, setSyncStatus] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSqlHelp, setShowSqlHelp] = useState(false);

  // QR Transfer State
  const [showQrTransfer, setShowQrTransfer] = useState(false);
  const [qrData, setQrData] = useState<string>('');
  const [qrError, setQrError] = useState<string>('');

  // Account Management State
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState({
    name: '',
    type: AccountType.CHECKING,
    balance: '',
    icon: '💳',
    color: '#3b82f6',
    creditLimit: '',
    isDefault: false
  });

  // PIN State
  const [pinMode, setPinMode] = useState<'none' | 'set' | 'change'>('none');
  const [pinInput, setPinInput] = useState('');

  // Support Ticket State
  const [showSupport, setShowSupport] = useState(false);
  const [ticketData, setTicketData] = useState({
    type: 'Bug Report',
    subject: '',
    description: ''
  });

  // Safety fallbacks for notification settings
  const budgetWarnings = preferences.notificationSettings?.budgetWarnings ?? true;
  const budgetWarningThreshold = preferences.notificationSettings?.budgetWarningThreshold ?? 80;
  const largeTransactions = preferences.notificationSettings?.largeTransactions ?? true;
  const largeTransactionThreshold = preferences.notificationSettings?.largeTransactionThreshold ?? 500;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Resize to max 256x256 to save LocalStorage space
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compress to JPEG at 0.7 quality
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          onUpdatePreferences({ profileImage: dataUrl });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Account Management Functions
  const handleSaveAccount = () => {
    if (!accountForm.name) return;

    const account: Account = {
      id: editingAccountId || `account-${Date.now()}`,
      name: accountForm.name,
      type: accountForm.type,
      balance: parseFloat(accountForm.balance) || 0,
      icon: accountForm.icon,
      color: accountForm.color,
      isDefault: accountForm.isDefault,
      isHidden: false,
      creditLimit: accountForm.creditLimit ? parseFloat(accountForm.creditLimit) : undefined,
      lastUpdated: new Date().toISOString()
    };

    if (editingAccountId) {
      onUpdateAccount(account);
    } else {
      onAddAccount(account);
    }

    // Reset form
    setAccountForm({
      name: '',
      type: AccountType.CHECKING,
      balance: '',
      icon: '💳',
      color: '#3b82f6',
      creditLimit: '',
      isDefault: false
    });
    setEditingAccountId(null);
    setShowAccountForm(false);
  };

  const handleEditAccount = (account: Account) => {
    setAccountForm({
      name: account.name,
      type: account.type,
      balance: account.balance.toString(),
      icon: account.icon || '💳',
      color: account.color || '#3b82f6',
      creditLimit: account.creditLimit?.toString() || '',
      isDefault: account.isDefault || false
    });
    setEditingAccountId(account.id);
    setShowAccountForm(true);
  };

  const getAccountIcon = (type: AccountType) => {
    switch (type) {
      case AccountType.CHECKING: return '💳';
      case AccountType.SAVINGS: return '🏦';
      case AccountType.CREDIT_CARD: return '💰';
      case AccountType.CASH: return '💵';
      case AccountType.INVESTMENT: return '📈';
      case AccountType.LOAN: return '💸';
      default: return '💼';
    }
  };

  const generateQrCode = () => {
    try {
      const backupData = {
        version: '1.0',
        preferences,
        categories,
        transactions
      };
      
      const jsonString = JSON.stringify(backupData);
      const compressed = LZString.compressToEncodedURIComponent(jsonString);
      const url = `${window.location.origin}?import=${compressed}`;
      
      if (url.length > 2000) {
        setQrError("Data is too large for a QR code (History > 2000 items). Please use 'Backup to File' instead.");
        setQrData('');
      } else {
        setQrData(url);
        setQrError('');
      }
      setShowQrTransfer(true);
    } catch (e) {
      setQrError("Could not generate transfer code.");
    }
  };

  const handleCloudSave = async () => {
    if (!supabaseUrl || !supabaseKey) {
      setSyncStatus('Error: Missing credentials');
      return;
    }
    setIsSyncing(true);
    try {
      await testConnection(supabaseUrl, supabaseKey);
      
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        preferences,
        categories,
        transactions
      };

      await uploadToCloud(supabaseUrl, supabaseKey, activeProfileId, backupData);
      
      onUpdatePreferences({
        supabaseConfig: { url: supabaseUrl, key: supabaseKey, lastSynced: new Date().toISOString() }
      });
      setSyncStatus('Success: Data saved to cloud');
    } catch (e: unknown) {
      setSyncStatus(`Error: ${e instanceof Error ? e.message : 'Connection failed'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCloudLoad = async () => {
    if (!supabaseUrl || !supabaseKey) {
      setSyncStatus('Error: Missing credentials');
      return;
    }
    setIsSyncing(true);
    try {
      const result = await downloadFromCloud(supabaseUrl, supabaseKey, activeProfileId);
      if (result && result.content) {
        onFullRestore(result.content);
        onUpdatePreferences({
            supabaseConfig: { url: supabaseUrl, key: supabaseKey, lastSynced: new Date().toISOString() }
        });
        setSyncStatus(`Success: Loaded data from ${new Date(result.updatedAt).toLocaleDateString()}`);
      } else {
        setSyncStatus('Info: No cloud data found for this profile');
      }
    } catch (e: unknown) {
      setSyncStatus(`Error: ${e instanceof Error ? e.message : 'Download failed'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // --- JSON BACKUP LOGIC ---
  const handleBackupJSON = () => {
    const backupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      preferences,
      categories,
      transactions
    };
    
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `wingman_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRestoreJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);

        if (!data.preferences || !data.categories || !data.transactions) {
          setImportStatus('Error: Invalid Backup File Format.');
          return;
        }

        if (confirm('This will OVERWRITE all current data with the backup. Continue?')) {
            onFullRestore(data);
            setImportStatus('Success: System Restored from Backup.');
        }

      } catch {
        setImportStatus('Error: Corrupt JSON file.');
      }
    };
    reader.readAsText(file);
  };
  // -------------------------

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      
      try {
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) {
          setImportStatus('Error: File appears empty or invalid.');
          return;
        }

        const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        
        // Basic column mapping
        const dateIdx = headers.findIndex(h => h.includes('date'));
        const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('memo') || h.includes('narrative'));
        const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('value'));
        const catIdx = headers.findIndex(h => h.includes('category') || h.includes('tag'));

        if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
          setImportStatus('Error: Could not identify Date, Description, or Amount columns.');
          return;
        }

        const newTransactions: Omit<Transaction, 'id'>[] = [];
        let successCount = 0;

        // Skip header, process rows
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Simple split
          const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''));
          
          if (cols.length < headers.length) continue;

          const dateStr = cols[dateIdx];
          const desc = cols[descIdx];
          const amountStr = cols[amountIdx];
          
          // Parse amount
          let amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''));
          if (isNaN(amount)) continue;

          const isExpense = amount < 0;
          amount = Math.abs(amount); // Store absolute value

          // Determine Category
          let categoryId = categories[0].id; // Default
          if (catIdx !== -1 && cols[catIdx]) {
            const catName = cols[catIdx].toLowerCase();
            const matchedCat = categories.find(c => c.name.toLowerCase() === catName);
            if (matchedCat) categoryId = matchedCat.id;
          }

          // Determine Type based on sign
          let typeId = '';
          if (isExpense) {
            const type = preferences.transactionTypes.find(t => t.behavior === TransactionBehavior.OUTFLOW);
            typeId = type ? type.id : preferences.transactionTypes[0].id;
          } else {
            const type = preferences.transactionTypes.find(t => t.behavior === TransactionBehavior.INFLOW);
            typeId = type ? type.id : preferences.transactionTypes[0].id;
          }

          // Parse Date (Attempt YYYY-MM-DD or MM/DD/YYYY)
          let dateObj = new Date(dateStr);
          if (isNaN(dateObj.getTime())) {
             dateObj = new Date(); // Fallback to today if invalid
          }
          const formattedDate = dateObj.toISOString().split('T')[0];

          newTransactions.push({
            date: formattedDate,
            description: desc,
            amount: amount,
            categoryId: categoryId,
            typeId: typeId,
            isRecurring: false
          });
          successCount++;
        }

        if (successCount > 0) {
          onImportTransactions(newTransactions);
          setImportStatus(`Success: Imported ${successCount} transactions.`);
          // Clear input
          if (csvInputRef.current) csvInputRef.current.value = '';
        } else {
          setImportStatus('Error: No valid transactions found.');
        }

      } catch {
        setImportStatus('Error parsing file. Ensure it is a valid CSV.');
      }
    };
    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) {
      setImportStatus('Error: No transactions to export.');
      return;
    }

    const headers = ['Date', 'Description', 'Amount', 'Category', 'Type', 'Recurring', 'Frequency'];
    const rows = transactions.map(t => {
      const category = categories.find(c => c.id === t.categoryId)?.name || 'Unknown';
      const type = preferences.transactionTypes.find(type => type.id === t.typeId)?.label || 'Unknown';
      
      const cleanDesc = t.description.replace(/"/g, '""');
      const cleanCat = category.replace(/"/g, '""');
      
      return [
        t.date,
        `"${cleanDesc}"`,
        t.amount,
        `"${cleanCat}"`,
        type,
        t.isRecurring ? 'Yes' : 'No',
        t.frequency || ''
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `wingman_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddType = () => {
    if (!newTypeName.trim()) return;
    const newType: TransactionTypeDefinition = {
      id: `type-${Date.now()}`,
      label: newTypeName,
      behavior: newTypeBehavior
    };
    onUpdatePreferences({
      transactionTypes: [...(preferences.transactionTypes || []), newType]
    });
    setNewTypeName('');
  };

  const handleRemoveType = (id: string) => {
    if (preferences.transactionTypes?.length <= 1) return;
    onUpdatePreferences({
      transactionTypes: preferences.transactionTypes.filter(t => t.id !== id)
    });
  };

  const updateNotificationSetting = (updates: Partial<UserPreferences['notificationSettings']>) => {
    const currentSettings = preferences.notificationSettings || { 
      budgetWarnings: true, 
      budgetWarningThreshold: 80,
      largeTransactions: true,
      largeTransactionThreshold: 500
    };
    onUpdatePreferences({
      notificationSettings: {
        ...currentSettings,
        ...updates
      }
    });
  };

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = `
Type: ${ticketData.type}
Subject: ${ticketData.subject}

Description:
${ticketData.description}

---
App Version: 1.0.0
User: ${preferences.name}
Platform: ${navigator.userAgent}
    `;
    
    const mailtoLink = `mailto:hwick57@gmail.com?subject=[Wingman ${ticketData.type}] ${encodeURIComponent(ticketData.subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
    setShowSupport(false);
    setTicketData({ type: 'Bug Report', subject: '', description: '' });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 px-4 sm:px-0">
      <div className="space-y-2 text-center md:text-left">
        <h3 className="text-2xl font-semibold text-slate-900 tracking-tighter uppercase">Settings</h3>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Manage your profile and display preferences.</p>
      </div>

      {/* Cloud Account Section */}
      {(user || onShowAuth) && (
        <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h4 className="font-bold text-slate-800 border-b border-slate-50 pb-4 text-xs uppercase tracking-wide">
            Cloud Account
          </h4>

          {user ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-100 rounded-2xl">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-green-900 text-sm">Signed In</p>
                  <p className="text-xs text-green-700 truncate">{user.email}</p>
                  {lastSyncTime && lastSyncTime > 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      Last synced: {new Date(lastSyncTime).toLocaleTimeString()}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                    {lastSyncTime && lastSyncTime > 0 ? '☁️ SYNCED' : '⏳ PENDING'}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-4 space-y-2">
                <p className="font-bold">🔒 Your data is automatically synced to the cloud</p>
                <p>Access your budget from any device by signing in with your account.</p>
              </div>

              {onSignOut && (
                <button
                  onClick={onSignOut}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-red-200 text-red-700 rounded-xl hover:bg-red-50 transition-all font-bold text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-blue-900 text-sm">Local Only Mode</p>
                  <p className="text-xs text-blue-700">Data stored on this device only</p>
                </div>
              </div>

              <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-4 space-y-2">
                <p className="font-bold">💡 Want to access your data from multiple devices?</p>
                <p>Sign in to sync your budget securely to the cloud.</p>
              </div>

              {onShowAuth && (
                <button
                  onClick={onShowAuth}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all font-bold text-sm shadow-lg"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In / Create Account
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* Account Management Section */}
      <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-50 pb-4">
          <div>
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
              Accounts
            </h4>
            <p className="text-xs text-slate-500 mt-1">Manage your checking, savings, credit cards, and more</p>
          </div>
          <button
            onClick={() => {
              setShowAccountForm(true);
              setEditingAccountId(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold text-xs"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        </div>

        {/* Account List */}
        <div className="space-y-3">
          {accounts.filter(a => !a.isHidden).map(account => (
            <div
              key={account.id}
              className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all"
            >
              <div className="flex items-center gap-4 flex-1">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                  style={{ backgroundColor: account.color + '20' }}
                >
                  {account.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h5 className="font-bold text-slate-900">{account.name}</h5>
                    {account.isDefault && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full uppercase">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 capitalize">{account.type.toLowerCase().replace('_', ' ')}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg" style={{ color: account.color }}>
                    {preferences.currency}{Math.abs(account.balance).toFixed(2)}
                  </p>
                  {account.type === AccountType.CREDIT_CARD && account.creditLimit && (
                    <p className="text-xs text-slate-400">
                      Limit: {preferences.currency}{account.creditLimit.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => handleEditAccount(account)}
                  className="p-2 hover:bg-white rounded-lg transition-all"
                  title="Edit account"
                >
                  <Edit2 className="w-4 h-4 text-slate-400 hover:text-indigo-600" />
                </button>
                <button
                  onClick={() => onDeleteAccount(account.id)}
                  className="p-2 hover:bg-white rounded-lg transition-all"
                  title="Delete account"
                >
                  <Trash2 className="w-4 h-4 text-slate-400 hover:text-rose-600" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Account Form Modal */}
        {showAccountForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-6 animate-in fade-in zoom-in-95">
              <h3 className="text-xl font-semibold text-slate-900">
                {editingAccountId ? 'Edit Account' : 'New Account'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-2">
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={accountForm.name}
                    onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
                    placeholder="e.g., Chase Checking"
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-semibold"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-2">
                    Account Type
                  </label>
                  <select
                    value={accountForm.type}
                    onChange={e => {
                      const newType = e.target.value as AccountType;
                      setAccountForm({
                        ...accountForm,
                        type: newType,
                        icon: getAccountIcon(newType)
                      });
                    }}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-semibold"
                  >
                    <option value={AccountType.CHECKING}>Checking Account</option>
                    <option value={AccountType.SAVINGS}>Savings Account</option>
                    <option value={AccountType.CREDIT_CARD}>Credit Card</option>
                    <option value={AccountType.CASH}>Cash</option>
                    <option value={AccountType.INVESTMENT}>Investment Account</option>
                    <option value={AccountType.LOAN}>Loan</option>
                    <option value={AccountType.OTHER}>Other</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-2">
                      Current Balance
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={accountForm.balance}
                      onChange={e => setAccountForm({ ...accountForm, balance: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-semibold"
                    />
                  </div>

                  {accountForm.type === AccountType.CREDIT_CARD && (
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-2">
                        Credit Limit
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={accountForm.creditLimit}
                        onChange={e => setAccountForm({ ...accountForm, creditLimit: e.target.value })}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-semibold"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={accountForm.isDefault}
                      onChange={e => setAccountForm({ ...accountForm, isDefault: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded"
                    />
                    <span className="text-sm font-bold text-slate-700">Set as default account</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAccountForm(false);
                    setEditingAccountId(null);
                  }}
                  className="flex-1 px-4 py-3 border-2 border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAccount}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold"
                >
                  {editingAccountId ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* NEW: Easy Data Transfer Section */}
      <section className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 rounded-3xl shadow-xl text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 p-12 bg-white/5 rounded-full blur-3xl transform translate-x-10 -translate-y-10"></div>
        
        <div className="relative z-10 space-y-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <h4 className="font-semibold text-xl uppercase tracking-tighter">Sync to Mobile</h4>
              <p className="text-indigo-200 text-xs font-medium max-w-xs">
                Move your data to another device instantly. No account required.
              </p>
            </div>
            <div className="bg-white/10 p-3 rounded-2xl">
              <span className="text-3xl">📲</span>
            </div>
          </div>

          {!showQrTransfer ? (
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={generateQrCode}
                className="bg-white text-indigo-900 py-3 rounded-xl font-semibold uppercase text-xs tracking-wide hover:bg-indigo-50 transition-all shadow-lg"
              >
                Show QR Code
              </button>
              <button 
                onClick={handleBackupJSON}
                className="bg-indigo-900/50 border border-indigo-400/30 text-white py-3 rounded-xl font-semibold uppercase text-xs tracking-wide hover:bg-indigo-900/70 transition-all"
              >
                Save File
              </button>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl text-center space-y-4 animate-in fade-in zoom-in-95">
              {!qrError ? (
                <>
                  <div className="bg-white p-2 rounded-xl inline-block">
                    <QRCodeSVG value={qrData} size={180} />
                  </div>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">
                    Scan with your phone camera to import data.
                  </p>
                </>
              ) : (
                <div className="py-8 space-y-4">
                  <span className="text-4xl">⚠️</span>
                  <p className="text-rose-500 text-xs font-bold px-4">{qrError}</p>
                </div>
              )}
              <button 
                onClick={() => setShowQrTransfer(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold underline"
              >
                Close Scanner
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Security Section (PIN) */}
      <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <h4 className="font-bold text-slate-800 border-b border-slate-50 pb-4 text-xs uppercase tracking-wide">Security</h4>
        
        <div className="flex items-center justify-between">
            <div className="space-y-1">
                <p className="font-bold text-slate-800 text-sm">Access PIN</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">
                    {preferences.pin ? 'Profile is secured' : 'No PIN configured'}
                </p>
            </div>
            {preferences.pin ? (
                <div className="flex gap-2">
                     <button 
                        onClick={() => {
                            if(confirm("Remove security PIN?")) onUpdatePreferences({ pin: undefined });
                        }}
                        className="bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-rose-100 transition-all"
                    >
                        Remove
                    </button>
                    <button 
                        onClick={() => { setPinMode('set'); setPinInput(''); }}
                        className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-slate-200 transition-all"
                    >
                        Change
                    </button>
                </div>
            ) : (
                <button 
                    onClick={() => { setPinMode('set'); setPinInput(''); }}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-indigo-700 transition-all"
                >
                    Set PIN
                </button>
            )}
        </div>

        {pinMode === 'set' && (
            <div className="bg-slate-50 p-6 rounded-2xl animate-in fade-in slide-in-from-top-2">
                <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">Enter 4-Digit PIN</p>
                <div className="flex justify-center gap-4 mb-6">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className={`w-3 h-3 rounded-full border-2 ${pinInput.length > i ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`} />
                    ))}
                </div>
                <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button 
                            key={num}
                            onClick={() => {
                                if (pinInput.length < 4) setPinInput(prev => prev + num);
                            }}
                            className="bg-white h-10 rounded-lg text-slate-800 font-bold text-lg shadow-sm hover:bg-slate-100"
                        >
                            {num}
                        </button>
                    ))}
                    <div />
                    <button 
                         onClick={() => {
                            if (pinInput.length < 4) setPinInput(prev => prev + '0');
                         }}
                         className="bg-white h-10 rounded-lg text-slate-800 font-bold text-lg shadow-sm hover:bg-slate-100"
                    >
                        0
                    </button>
                    <button 
                         onClick={() => setPinInput(prev => prev.slice(0, -1))}
                         className="bg-rose-50 h-10 rounded-lg text-rose-500 font-bold shadow-sm hover:bg-rose-100 flex items-center justify-center"
                    >
                        ⌫
                    </button>
                </div>
                <div className="flex gap-2 mt-6">
                    <button 
                        onClick={() => setPinMode('none')}
                        className="flex-1 py-3 text-slate-400 font-bold text-xs uppercase tracking-wide hover:text-slate-600"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={() => {
                            if (pinInput.length === 4) {
                                onUpdatePreferences({ pin: pinInput });
                                setPinMode('none');
                            }
                        }}
                        disabled={pinInput.length !== 4}
                        className="flex-1 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-wide disabled:opacity-50"
                    >
                        Save PIN
                    </button>
                </div>
            </div>
        )}
      </section>

      {/* NEW: Support & Feedback Section */}
      <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <h4 className="font-bold text-slate-800 border-b border-slate-50 pb-4 text-xs uppercase tracking-wide">Support & Feedback</h4>
        <div className="flex items-center justify-between">
           <div className="space-y-1">
             <p className="font-bold text-slate-800 text-sm">Submit Ticket</p>
             <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Report bugs or request features</p>
           </div>
           <button 
             onClick={() => setShowSupport(true)}
             className="bg-indigo-50 text-indigo-600 px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-indigo-100 transition-all border border-indigo-100"
           >
             Open Ticket
           </button>
        </div>
      </section>

      {/* Support Modal */}
      {showSupport && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 uppercase tracking-tight">Support Ticket</h3>
                <p className="text-xs text-slate-500 font-bold">Describe your issue or idea below.</p>
              </div>
              <button 
                onClick={() => setShowSupport(false)}
                className="text-slate-300 hover:text-slate-500 font-bold text-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSupportSubmit} className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">Ticket Type</label>
                <div className="flex gap-2">
                  {['Bug Report', 'Feature Request', 'General'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTicketData({ ...ticketData, type })}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wide border transition-all ${
                        ticketData.type === type 
                          ? 'bg-indigo-600 text-white border-indigo-600' 
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">Subject</label>
                <input 
                  type="text" 
                  value={ticketData.subject}
                  onChange={e => setTicketData({ ...ticketData, subject: e.target.value })}
                  placeholder="Brief summary..."
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 ring-indigo-500/10"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">Description</label>
                <textarea 
                  value={ticketData.description}
                  onChange={e => setTicketData({ ...ticketData, description: e.target.value })}
                  placeholder="Please provide details..."
                  rows={5}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 ring-indigo-500/10 resize-none"
                  required
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold uppercase text-xs tracking-wide hover:bg-slate-800 transition-all shadow-xl"
                >
                  Create & Send Email
                </button>
                <p className="text-xs text-center text-slate-400 font-bold uppercase tracking-wider mt-3">
                  This will open your default mail client with a pre-filled message.
                </p>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Data Management (Files) */}
      <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <h4 className="font-bold text-slate-800 border-b border-slate-50 pb-4 text-xs uppercase tracking-wide">Backup & Restore</h4>
        
        {/* Full JSON Backup/Restore */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={handleBackupJSON}
            className="flex items-center justify-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl hover:bg-emerald-100 transition-all group"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">💾</span>
            <div className="text-left">
              <p className="font-bold text-emerald-900 text-xs uppercase tracking-wider">Backup Data</p>
              <p className="text-xs text-emerald-600 font-medium">Save to device</p>
            </div>
          </button>

          <button 
            onClick={() => jsonInputRef.current?.click()}
            className="flex items-center justify-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl hover:bg-indigo-100 transition-all group"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">📂</span>
            <div className="text-left">
              <p className="font-bold text-indigo-900 text-xs uppercase tracking-wider">Restore File</p>
              <p className="text-xs text-indigo-600 font-medium">Load backup</p>
            </div>
          </button>
           <input 
             type="file" 
             ref={jsonInputRef}
             accept=".json"
             onChange={handleRestoreJSON}
             className="hidden" 
           />
        </div>

        {/* CSV Tools */}
        <div className="pt-4 border-t border-slate-50">
           <div className="flex items-center justify-between mb-3">
             <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">External Data</span>
           </div>
           <div className="flex gap-3">
              <button 
                onClick={() => csvInputRef.current?.click()}
                className="flex-1 bg-slate-50 text-slate-600 py-3 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-slate-100 transition-all border border-slate-100"
              >
                Import CSV
              </button>
              <button 
                onClick={handleExportCSV}
                className="flex-1 bg-slate-50 text-slate-600 py-3 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-slate-100 transition-all border border-slate-100"
              >
                Export CSV
              </button>
           </div>
           <input 
             type="file" 
             ref={csvInputRef}
             accept=".csv"
             onChange={handleCSVUpload}
             className="hidden" 
           />
        </div>
        {importStatus && (
          <div className={`text-xs font-bold uppercase tracking-wide px-3 py-2 rounded-lg text-center ${importStatus.includes('Error') ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
            {importStatus}
          </div>
        )}
      </section>

      {/* Cloud Sync Section - Hidden by default */}
      <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div 
          className="flex justify-between items-center cursor-pointer"
          onClick={() => setShowAdvancedSync(!showAdvancedSync)}
        >
          <h4 className="font-bold text-slate-400 text-xs uppercase tracking-wide flex items-center gap-2">
            <span>☁️</span> Advanced Sync (Supabase)
          </h4>
          <span className="text-slate-300 text-xl">{showAdvancedSync ? '−' : '+'}</span>
        </div>

        {showAdvancedSync && (
          <div className="space-y-4 animate-in slide-in-from-top-2 pt-2">
            <p className="text-xs text-slate-500 font-medium bg-indigo-50 p-3 rounded-xl border border-indigo-100">
              <strong className="text-indigo-700">Developer Feature:</strong> Sync your data between devices using your own database.
              <button onClick={() => setShowSqlHelp(!showSqlHelp)} className="text-indigo-600 underline ml-2 font-bold">View Instructions</button>
            </p>

            {showSqlHelp && (
              <div className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs font-mono space-y-2">
                <p>1. Create a project at <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-white underline">supabase.com</a></p>
                <p>2. Go to SQL Editor and run this query:</p>
                <div className="bg-black/50 p-2 rounded text-emerald-400 select-all">
                  create table wingman_backups (<br/>
                  &nbsp;&nbsp;id text primary key,<br/>
                  &nbsp;&nbsp;data jsonb,<br/>
                  &nbsp;&nbsp;updated_at timestamp with time zone<br/>
                  );
                </div>
                <p>3. Copy Project URL & Anon Key below.</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">Project URL</label>
                <input 
                  type="text" 
                  value={supabaseUrl}
                  onChange={e => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyz.supabase.co" 
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 ring-indigo-500/10"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">Anon Key</label>
                <input 
                  type="password" 
                  value={supabaseKey}
                  onChange={e => setSupabaseKey(e.target.value)}
                  placeholder="eyJh..." 
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 ring-indigo-500/10"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={handleCloudSave}
                disabled={isSyncing}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-semibold uppercase text-xs tracking-wide hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-md"
              >
                {isSyncing ? 'Syncing...' : 'Save to DB'}
              </button>
              <button 
                onClick={handleCloudLoad}
                disabled={isSyncing}
                className="flex-1 bg-white border border-indigo-200 text-indigo-700 py-3 rounded-xl font-semibold uppercase text-xs tracking-wide hover:bg-indigo-50 transition-all disabled:opacity-50 shadow-sm"
              >
                {isSyncing ? 'Syncing...' : 'Load from DB'}
              </button>
            </div>
            {syncStatus && (
               <div className={`text-xs font-bold uppercase tracking-wide px-3 py-2 rounded-lg text-center ${syncStatus.includes('Error') ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                 {syncStatus}
               </div>
             )}
          </div>
        )}
      </section>

      {/* Profile Section */}
      <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <h4 className="font-bold text-slate-800 border-b border-slate-50 pb-4 text-xs uppercase tracking-wide">Profile Configuration</h4>
        
        <div className="flex flex-col sm:flex-row items-center gap-8 py-4">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-24 h-24 rounded-3xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-indigo-300 group-hover:bg-indigo-50/50">
              {preferences.profileImage ? (
                <img src={preferences.profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-semibold text-slate-300">
                  {preferences.name?.[0]?.toUpperCase() || 'W'}
                </span>
              )}
            </div>
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 rounded-3xl flex items-center justify-center text-white transition-opacity">
              <span className="text-xs font-semibold uppercase tracking-wide">Update</span>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              className="hidden" 
            />
          </div>
          
          <div className="flex-1 space-y-4 w-full">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">Display Name</label>
              <input 
                type="text" 
                value={preferences.name || ''}
                onChange={e => onUpdatePreferences({ name: e.target.value })}
                placeholder="RANK / NAME" 
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 ring-indigo-500/10"
              />
            </div>
            {preferences.profileImage && (
              <button 
                onClick={() => onUpdatePreferences({ profileImage: undefined })}
                className="text-xs font-semibold uppercase tracking-wide text-rose-500 hover:text-rose-600 pl-1"
              >
                Remove Picture
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">Operational Currency</label>
            <div className="flex flex-wrap gap-2">
              {currencies.map(c => (
                <button
                  key={c}
                  onClick={() => onUpdatePreferences({ currency: c })}
                  className={`w-11 h-11 rounded-xl border-2 transition-all ${
                    preferences.currency === c 
                      ? 'bg-slate-900 border-slate-900 text-white shadow-lg' 
                      : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Notifications Section */}
      <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 overflow-hidden">
        <h4 className="font-bold text-slate-800 border-b border-slate-50 pb-4 text-xs uppercase tracking-wide">Notification Preferences</h4>
        
        <div className="space-y-3">
          {/* Budget Warnings */}
          <div className="bg-slate-50 rounded-2xl overflow-hidden transition-all">
            <div 
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100 transition-colors gap-4"
              onClick={() => updateNotificationSetting({ budgetWarnings: !budgetWarnings })}
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm">Budget Warnings</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wide leading-tight">
                  Alert when spending approaches limits
                </p>
              </div>
              <div className="shrink-0">
                <div className={`w-11 h-6 rounded-full transition-colors relative ${budgetWarnings ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 shadow-sm ${budgetWarnings ? 'left-6' : 'left-1'}`} style={{ backgroundColor: '#fff' }} />
                </div>
              </div>
            </div>
            
            {budgetWarnings && (
              <div className="px-4 pb-4 pt-2 border-t border-slate-100 animate-in slide-in-from-top-2">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Warning Threshold</label>
                    <span className="text-xs font-semibold text-indigo-600">{budgetWarningThreshold}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="50" 
                    max="100" 
                    step="5"
                    value={budgetWarningThreshold}
                    onChange={(e) => updateNotificationSetting({ budgetWarningThreshold: parseInt(e.target.value) })}
                    className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-xs text-slate-400 italic">You will be notified when you reach {budgetWarningThreshold}% of any budget.</p>
                </div>
              </div>
            )}
          </div>

          {/* Large Transactions */}
          <div className="bg-slate-50 rounded-2xl overflow-hidden transition-all">
            <div 
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100 transition-colors gap-4"
              onClick={() => updateNotificationSetting({ largeTransactions: !largeTransactions })}
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm">Large Transactions</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wide leading-tight">
                  Flag significant account activity
                </p>
              </div>
              <div className="shrink-0">
                <div className={`w-11 h-6 rounded-full transition-colors relative ${largeTransactions ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 shadow-sm ${largeTransactions ? 'left-6' : 'left-1'}`} style={{ backgroundColor: '#fff' }} />
                </div>
              </div>
            </div>

            {largeTransactions && (
              <div className="px-4 pb-4 pt-2 border-t border-slate-100 animate-in slide-in-from-top-2">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Transaction Threshold</label>
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                    <span className="text-slate-500 font-bold text-sm">{preferences.currency}</span>
                    <input 
                      type="number" 
                      value={largeTransactionThreshold}
                      onChange={(e) => updateNotificationSetting({ largeTransactionThreshold: parseInt(e.target.value) || 0 })}
                      className="w-full bg-transparent text-sm font-bold text-slate-800 outline-none"
                    />
                  </div>
                  <p className="text-xs text-slate-400 italic">Alerts trigger for transactions over {preferences.currency}{largeTransactionThreshold.toFixed(2)}.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Custom Transaction Types Section */}
      <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <h4 className="font-bold text-slate-800 border-b border-slate-50 pb-4 text-xs uppercase tracking-wide">Transaction Labels</h4>
        
        <div className="space-y-2">
          {(preferences.transactionTypes || []).map(type => (
            <div key={type.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-800 text-sm">{type.label}</span>
                <span className={`text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${
                  type.behavior === TransactionBehavior.INFLOW ? 'bg-emerald-100 text-emerald-700' :
                  type.behavior === TransactionBehavior.OUTFLOW ? 'bg-rose-100 text-rose-700' :
                  'bg-slate-200 text-slate-600'
                }`}>
                  {type.behavior}
                </span>
              </div>
              <button 
                onClick={() => handleRemoveType(type.id)}
                className="text-slate-300 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 p-5 bg-slate-100/50 rounded-2xl border border-slate-200">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">Add Custom Label</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text"
              value={newTypeName}
              onChange={e => setNewTypeName(e.target.value)}
              placeholder="e.g. Dividend"
              className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 outline-none"
            />
            <div className="flex gap-2">
              <select 
                value={newTypeBehavior}
                onChange={e => setNewTypeBehavior(e.target.value as TransactionBehavior)}
                className="flex-1 sm:flex-none bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 outline-none cursor-pointer uppercase"
              >
                <option value={TransactionBehavior.INFLOW}>Inflow (+)</option>
                <option value={TransactionBehavior.OUTFLOW}>Outflow (-)</option>
                <option value={TransactionBehavior.NEUTRAL}>Neutral</option>
              </select>
              <button 
                onClick={handleAddType}
                className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide shadow-md"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Appearance / Theme Section */}
      <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <h4 className="font-bold text-slate-800 border-b border-slate-50 pb-4 text-xs uppercase tracking-wide">Appearance</h4>

        <div className="space-y-2">
          <p className="font-semibold text-slate-800 text-sm">Theme</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'light', label: 'Light', icon: '☀️' },
              { value: 'dark', label: 'Dark', icon: '🌙' },
              { value: 'system', label: 'System', icon: '💻' }
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => onUpdatePreferences({ theme: opt.value })}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                  (preferences.theme || 'system') === opt.value
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <span>{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy Section */}
      <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <h4 className="font-bold text-slate-800 border-b border-slate-50 pb-4 text-xs uppercase tracking-wide">Privacy Settings</h4>
        
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors cursor-pointer"
             onClick={() => onUpdatePreferences({ privacyMode: !preferences.privacyMode })}>
          <div className="flex-1">
            <p className="font-bold text-slate-800 text-sm">Privacy Mode</p>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Blur balances by default</p>
          </div>
          <div className="shrink-0 ml-4">
            <div className={`w-11 h-6 rounded-full transition-colors relative ${preferences.privacyMode ? 'bg-indigo-600' : 'bg-slate-300'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 shadow-sm ${preferences.privacyMode ? 'left-6' : 'left-1'}`} style={{ backgroundColor: '#fff' }} />
            </div>
          </div>
        </div>
      </section>

      {/* Clear Data */}
      <div className="p-5 bg-rose-50 rounded-2xl border border-rose-100 space-y-3">
        <div className="flex items-center gap-2 text-rose-800">
          <span className="text-xl">🚨</span>
          <p className="font-bold text-sm">Reset Application</p>
        </div>
        <p className="text-xs text-rose-600 font-bold uppercase tracking-wide leading-relaxed">Permanently delete all logs and settings.</p>
        <button 
          onClick={() => {
            if(confirm('Confirm total data deletion? This action is permanent.')) onClearData();
          }}
          className="w-full bg-rose-600 text-white px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
        >
          Reset All Data
        </button>
      </div>
    </div>
  );
};
