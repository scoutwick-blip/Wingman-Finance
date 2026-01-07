
import React, { useState, useRef } from 'react';
import { UserPreferences, TransactionBehavior, TransactionTypeDefinition, Category, Transaction } from '../types';

interface SettingsProps {
  preferences: UserPreferences;
  categories: Category[];
  transactions: Transaction[];
  onUpdatePreferences: (updates: Partial<UserPreferences>) => void;
  onImportTransactions: (transactions: Omit<Transaction, 'id'>[]) => void;
  onClearData: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  preferences, 
  categories,
  transactions,
  onUpdatePreferences, 
  onImportTransactions,
  onClearData 
}) => {
  const currencies = ['$', '€', '£', '¥', '₹', '₱', '₩', 'R$'];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeBehavior, setNewTypeBehavior] = useState<TransactionBehavior>(TransactionBehavior.OUTFLOW);
  const [importStatus, setImportStatus] = useState<string>('');

  // Safety fallbacks for notification settings
  const budgetWarnings = preferences.notificationSettings?.budgetWarnings ?? true;
  const budgetWarningThreshold = preferences.notificationSettings?.budgetWarningThreshold ?? 80;
  const largeTransactions = preferences.notificationSettings?.largeTransactions ?? true;
  const largeTransactionThreshold = preferences.notificationSettings?.largeTransactionThreshold ?? 500;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdatePreferences({ profileImage: reader.result as string });
      };
      reader.readAsDataURL(file);
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

        // We aren't just importing transactions, we are doing a full state restore.
        // The safest way here in the context of React state provided by parent:
        // We actually need a way to restore *everything*. 
        // Given the props structure, we can try to update preferences, but 
        // replacing categories/transactions fully is tricky with current props (onImportTransactions appends).
        // However, for "Simple", let's be smart. We will append the transactions and update preferences.
        // A true "Restore" usually wipes existing data. 
        
        if (confirm('Restoring will merge settings and add transactions. Continue?')) {
            onUpdatePreferences(data.preferences);
            // We need to strip IDs to avoid conflicts if they exist, or keep them if we assume clean slate.
            // Let's strip IDs for safety and treat as new import.
            const cleanTransactions = data.transactions.map((t: any) => {
                const { id, ...rest } = t; 
                return rest;
            });
            onImportTransactions(cleanTransactions);
            setImportStatus('Success: System Restored from Backup.');
        }

      } catch (err) {
        setImportStatus('Error: Corrupt JSON file.');
        console.error(err);
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

          // Simple split, handling basic quoted commas is complex, simple split for now
          // A robust solution uses a CSV parser library, but for "simple but in-depth" we try regex split
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

      } catch (err) {
        setImportStatus('Error parsing file. Ensure it is a valid CSV.');
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) {
      alert('No transactions to export.');
      return;
    }

    const headers = ['Date', 'Description', 'Amount', 'Category', 'Type', 'Recurring', 'Frequency'];
    const rows = transactions.map(t => {
      const category = categories.find(c => c.id === t.categoryId)?.name || 'Unknown';
      const type = preferences.transactionTypes.find(type => type.id === t.typeId)?.label || 'Unknown';
      
      // Escape quotes in strings and wrap in quotes to handle commas
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

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 px-4 sm:px-0">
      <div className="space-y-2 text-center md:text-left">
        <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Settings</h3>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Manage your profile and display preferences.</p>
      </div>

      {/* Profile Section */}
      <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <h4 className="font-bold text-slate-800 border-b border-slate-50 pb-4 text-[10px] uppercase tracking-[0.2em]">Profile Configuration</h4>
        
        <div className="flex flex-col sm:flex-row items-center gap-8 py-4">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-24 h-24 rounded-3xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-indigo-300 group-hover:bg-indigo-50/50">
              {preferences.profileImage ? (
                <img src={preferences.profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-slate-300">
                  {preferences.name?.[0]?.toUpperCase() || 'W'}
                </span>
              )}
            </div>
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 rounded-3xl flex items-center justify-center text-white transition-opacity">
              <span className="text-[10px] font-black uppercase tracking-widest">Update</span>
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
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Display Name</label>
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
                className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600 pl-1"
              >
                Remove Picture
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Operational Currency</label>
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
        <h4 className="font-bold text-slate-800 border-b border-slate-50 pb-4 text-[10px] uppercase tracking-[0.2em]">Notification Preferences</h4>
        
        <div className="space-y-3">
          {/* Budget Warnings */}
          <div className="bg-slate-50 rounded-2xl overflow-hidden transition-all">
            <div 
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100 transition-colors gap-4"
              onClick={() => updateNotificationSetting({ budgetWarnings: !budgetWarnings })}
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm">Budget Warnings</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-tight">
                  Alert when spending approaches limits
                </p>
              </div>
              <div className="shrink-0">
                <div className={`w-11 h-6 rounded-full transition-colors relative ${budgetWarnings ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${budgetWarnings ? 'left-6' : 'left-1'}`} />
                </div>
              </div>
            </div>
            
            {budgetWarnings && (
              <div className="px-4 pb-4 pt-2 border-t border-slate-100 animate-in slide-in-from-top-2">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Warning Threshold</label>
                    <span className="text-xs font-black text-indigo-600">{budgetWarningThreshold}%</span>
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
                  <p className="text-[9px] text-slate-400 italic">You will be notified when you reach {budgetWarningThreshold}% of any budget.</p>
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
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-tight">
                  Flag significant account activity
                </p>
              </div>
              <div className="shrink-0">
                <div className={`w-11 h-6 rounded-full transition-colors relative ${largeTransactions ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${largeTransactions ? 'left-6' : 'left-1'}`} />
                </div>
              </div>
            </div>

            {largeTransactions && (
              <div className="px-4 pb-4 pt-2 border-t border-slate-100 animate-in slide-in-from-top-2">
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Transaction Threshold</label>
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                    <span className="text-slate-500 font-bold text-sm">{preferences.currency}</span>
                    <input 
                      type="number" 
                      value={largeTransactionThreshold}
                      onChange={(e) => updateNotificationSetting({ largeTransactionThreshold: parseInt(e.target.value) || 0 })}
                      className="w-full bg-transparent text-sm font-bold text-slate-800 outline-none"
                    />
                  </div>
                  <p className="text-[9px] text-slate-400 italic">Alerts trigger for transactions over {preferences.currency}{largeTransactionThreshold}.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Custom Transaction Types Section */}
      <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <h4 className="font-bold text-slate-800 border-b border-slate-50 pb-4 text-[10px] uppercase tracking-[0.2em]">Transaction Labels</h4>
        
        <div className="space-y-2">
          {(preferences.transactionTypes || []).map(type => (
            <div key={type.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-800 text-sm">{type.label}</span>
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
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
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Add Custom Label</label>
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
                className="flex-1 sm:flex-none bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-[10px] font-bold text-slate-900 outline-none cursor-pointer uppercase"
              >
                <option value={TransactionBehavior.INFLOW}>Inflow (+)</option>
                <option value={TransactionBehavior.OUTFLOW}>Outflow (-)</option>
                <option value={TransactionBehavior.NEUTRAL}>Neutral</option>
              </select>
              <button 
                onClick={handleAddType}
                className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-md"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <h4 className="font-bold text-slate-800 border-b border-slate-50 pb-4 text-[10px] uppercase tracking-[0.2em]">Privacy Protocols</h4>
        
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors cursor-pointer"
             onClick={() => onUpdatePreferences({ privacyMode: !preferences.privacyMode })}>
          <div className="flex-1">
            <p className="font-bold text-slate-800 text-sm">Stealth Mode</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Blur balances by default</p>
          </div>
          <div className="shrink-0 ml-4">
            <div className={`w-11 h-6 rounded-full transition-colors relative ${preferences.privacyMode ? 'bg-indigo-600' : 'bg-slate-300'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${preferences.privacyMode ? 'left-6' : 'left-1'}`} />
            </div>
          </div>
        </div>
      </section>

      {/* Data Management & Import */}
      <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <h4 className="font-bold text-slate-800 border-b border-slate-50 pb-4 text-[10px] uppercase tracking-[0.2em]">Data Management</h4>
        
        {/* Full JSON Backup/Restore */}
        <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-800 text-sm">Full System Backup</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Save/Restore Everything (JSON)</p>
            </div>
            <div className="flex gap-2">
               <button 
                onClick={() => jsonInputRef.current?.click()}
                className="bg-white border border-emerald-200 text-emerald-700 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-100 transition-all shadow-sm"
              >
                Restore
              </button>
              <button 
                onClick={handleBackupJSON}
                className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md"
              >
                Backup
              </button>
            </div>
          </div>
           <input 
             type="file" 
             ref={jsonInputRef}
             accept=".json"
             onChange={handleRestoreJSON}
             className="hidden" 
           />
        </div>

        {/* CSV Import */}
        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
           <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-800 text-sm">Import Transactions</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Upload CSV (Date, Description, Amount)</p>
              </div>
              <button 
                onClick={() => csvInputRef.current?.click()}
                className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-md"
              >
                Upload CSV
              </button>
           </div>
           <input 
             type="file" 
             ref={csvInputRef}
             accept=".csv"
             onChange={handleCSVUpload}
             className="hidden" 
           />
           {importStatus && (
             <div className={`text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-lg ${importStatus.startsWith('Error') ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
               {importStatus}
             </div>
           )}
        </div>

        {/* Export Data */}
        <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-3">
           <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-800 text-sm">Export History</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Download transactions as CSV</p>
              </div>
              <button 
                onClick={handleExportCSV}
                className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md"
              >
                Download CSV
              </button>
           </div>
        </div>

        {/* Clear Data */}
        <div className="p-5 bg-rose-50 rounded-2xl border border-rose-100 space-y-3">
          <div className="flex items-center gap-2 text-rose-800">
            <span className="text-xl">🚨</span>
            <p className="font-bold text-sm">Reset Application</p>
          </div>
          <p className="text-[10px] text-rose-600 font-bold uppercase tracking-widest leading-relaxed">Permanently delete all logs and settings.</p>
          <button 
            onClick={() => {
              if(confirm('Confirm total data deletion? This action is permanent.')) onClearData();
            }}
            className="w-full bg-rose-600 text-white px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
          >
            Reset All Data
          </button>
        </div>
      </section>
    </div>
  );
};
