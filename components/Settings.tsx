
import React, { useState, useRef } from 'react';
import { UserPreferences, TransactionBehavior, TransactionTypeDefinition } from '../types';

interface SettingsProps {
  preferences: UserPreferences;
  onUpdatePreferences: (updates: Partial<UserPreferences>) => void;
  onClearData: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ preferences, onUpdatePreferences, onClearData }) => {
  const currencies = ['$', '€', '£', '¥', '₹', '₱', '₩', 'R$'];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeBehavior, setNewTypeBehavior] = useState<TransactionBehavior>(TransactionBehavior.OUTFLOW);

  // Safety fallbacks for notification settings
  const budgetWarnings = preferences.notificationSettings?.budgetWarnings ?? true;
  const largeTransactions = preferences.notificationSettings?.largeTransactions ?? true;

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

  const toggleNotification = (key: keyof UserPreferences['notificationSettings']) => {
    const currentSettings = preferences.notificationSettings || { budgetWarnings: true, largeTransactions: true };
    onUpdatePreferences({
      notificationSettings: {
        ...currentSettings,
        [key]: !currentSettings[key]
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
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 ring-indigo-500/10"
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
          <div 
            className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors cursor-pointer group gap-4"
            onClick={() => toggleNotification('budgetWarnings')}
          >
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-sm">Budget Warnings</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-tight">Alert me when I reach 80% or 100% of a budget</p>
            </div>
            <div className="shrink-0">
              <div 
                className={`w-11 h-6 rounded-full transition-colors relative ${budgetWarnings ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${budgetWarnings ? 'left-6' : 'left-1'}`} />
              </div>
            </div>
          </div>

          <div 
            className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors cursor-pointer group gap-4"
            onClick={() => toggleNotification('largeTransactions')}
          >
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-sm">Large Transactions</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-tight">Notify me for transactions over {preferences.currency}500</p>
            </div>
            <div className="shrink-0">
              <div 
                className={`w-11 h-6 rounded-full transition-colors relative ${largeTransactions ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${largeTransactions ? 'left-6' : 'left-1'}`} />
              </div>
            </div>
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
              className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none"
            />
            <div className="flex gap-2">
              <select 
                value={newTypeBehavior}
                onChange={e => setNewTypeBehavior(e.target.value as TransactionBehavior)}
                className="flex-1 sm:flex-none bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none cursor-pointer uppercase"
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

      {/* Data Management */}
      <section className="bg-rose-50 p-6 rounded-3xl border border-rose-100 space-y-4">
        <div className="flex items-center gap-2 text-rose-800">
          <span className="text-xl">🚨</span>
          <h4 className="font-black text-xs uppercase tracking-widest">Clear Data</h4>
        </div>
        <p className="text-[10px] text-rose-600 font-bold uppercase tracking-widest leading-relaxed">This will permanently delete all logs and settings from this device. This action cannot be reversed.</p>
        <button 
          onClick={() => {
            if(confirm('Confirm total data deletion? This action is permanent.')) onClearData();
          }}
          className="bg-rose-600 text-white px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
        >
          Reset All Data
        </button>
      </section>
    </div>
  );
};
