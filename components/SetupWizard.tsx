
import React, { useState, useRef } from 'react';
import { UserPreferences } from '../types';
import { DEFAULT_TRANSACTION_TYPES, DEFAULT_PREFERENCES } from '../constants';

interface SetupWizardProps {
  onComplete: (prefs: UserPreferences) => void;
  onCancel?: () => void;
  canCancel?: boolean;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete, onCancel, canCancel }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('$');
  const [privacyMode, setPrivacyMode] = useState(false);
  
  const totalSteps = 4;

  const handleNext = () => step < totalSteps ? setStep(step + 1) : handleFinish();
  const handleFinish = () => {
    onComplete({
      name, currency, privacyMode,
      accentColor: '#003087',
      setupComplete: true,
      transactionTypes: DEFAULT_TRANSACTION_TYPES,
      profileImage: undefined,
      notificationSettings: DEFAULT_PREFERENCES.notificationSettings
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-[100] flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-[2rem] shadow-2xl p-8 md:p-12 space-y-10 relative overflow-hidden border-t-8 border-indigo-600 animate-in zoom-in-95 duration-300">
        
        {canCancel && (
          <button 
            onClick={onCancel}
            className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 transition-colors font-bold text-sm uppercase tracking-widest"
          >
            Cancel
          </button>
        )}

        <div className="text-center space-y-4">
          <div className="w-16 h-16 af-blue rounded-xl flex items-center justify-center text-white text-2xl font-black mx-auto mb-6 shadow-2xl shadow-indigo-900/40">
            W
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">
            {step === 1 && "Welcome"}
            {step === 2 && "Currency"}
            {step === 3 && "Privacy"}
            {step === 4 && "Ready for Takeoff"}
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
            {step === 1 && "Let's set up your profile"}
            {step === 2 && "Choose your preferred symbol"}
            {step === 3 && "Configure your display settings"}
            {step === 4 && "Quick Application Tour"}
          </p>
        </div>

        <div className="min-h-[200px] flex flex-col justify-center">
          {step === 1 && (
            <div className="space-y-6">
              <input 
                type="text" autoFocus value={name}
                onChange={e => setName(e.target.value)}
                placeholder="RANK / NAME"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-6 py-4 text-sm font-bold text-slate-900 outline-none focus:border-indigo-600 transition-all uppercase"
              />
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-4 gap-3">
              {['$', '€', '£', '¥', '₹', '₱', '₩', 'R$'].map(c => (
                <button
                  key={c} onClick={() => setCurrency(c)}
                  className={`h-14 rounded-xl border-2 text-xl font-black transition-all ${
                    currency === c ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-50 bg-slate-50 text-slate-400 hover:bg-white'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between cursor-pointer"
                 onClick={() => setPrivacyMode(!privacyMode)}>
              <div className="space-y-1">
                <h4 className="font-black text-xs text-slate-800 uppercase tracking-widest">Privacy Mode</h4>
                <p className="text-[10px] text-slate-500 uppercase font-bold">Blur sensitive balances by default</p>
              </div>
              <div className={`w-12 h-7 rounded-full transition-all relative ${privacyMode ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${privacyMode ? 'left-6' : 'left-1'}`} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-4 items-start">
                <div className="text-2xl">📊</div>
                <div>
                  <h4 className="font-black text-xs text-slate-900 uppercase tracking-widest">Dashboard</h4>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">Visual overview of your net worth, spending, and recent activity.</p>
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-4 items-start">
                <div className="text-2xl">🤖</div>
                <div>
                  <h4 className="font-black text-xs text-slate-900 uppercase tracking-widest">AI Advisor</h4>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">Get tactical insights and budget alerts powered by Google Gemini.</p>
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-4 items-start">
                <div className="text-2xl">⚙️</div>
                <div>
                  <h4 className="font-black text-xs text-slate-900 uppercase tracking-widest">Settings</h4>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">Export data to CSV, manage multiple profiles, and customize categories.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors">
              Back
            </button>
          )}
          <button 
            disabled={step === 1 && !name.trim()}
            onClick={handleNext}
            className="flex-[2] bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            {step === totalSteps ? "Launch Wingman" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
};
