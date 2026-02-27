
import React, { useState } from 'react';
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
  const [pin, setPin] = useState('');

  const totalSteps = 5;

  const handleNext = () => step < totalSteps ? setStep(step + 1) : handleFinish();
  const handleFinish = () => {
    onComplete({
      name, currency, privacyMode, pin,
      accentColor: '#4f46e5',
      setupComplete: true,
      transactionTypes: DEFAULT_TRANSACTION_TYPES,
      profileImage: undefined,
      notificationSettings: DEFAULT_PREFERENCES.notificationSettings
    });
  };

  const handlePinInput = (num: string) => {
    if (num === 'back') {
      setPin(prev => prev.slice(0, -1));
    } else if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <div className="max-w-lg w-full rounded-[2rem] shadow-2xl p-8 md:p-12 space-y-10 relative overflow-hidden border-t-8 animate-in zoom-in-95 duration-300"
        style={{ backgroundColor: 'var(--color-bg-secondary)', borderTopColor: 'var(--color-accent)' }}>

        {canCancel && (
          <button
            onClick={onCancel}
            className="absolute top-6 right-6 transition-colors font-bold text-sm uppercase tracking-wide"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Cancel
          </button>
        )}

        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-2xl font-semibold mx-auto mb-6 shadow-2xl"
            style={{ backgroundColor: 'var(--color-accent)' }}>
            W
          </div>
          <h2 className="text-2xl font-semibold tracking-tighter uppercase"
            style={{ color: 'var(--color-text-primary)' }}>
            {step === 1 && "Welcome"}
            {step === 2 && "Currency"}
            {step === 3 && "Privacy"}
            {step === 4 && "Secure Access"}
            {step === 5 && "You're All Set"}
          </h2>
          <p className="text-xs font-bold uppercase tracking-wide"
            style={{ color: 'var(--color-text-tertiary)' }}>
            {step === 1 && "Let's set up your profile"}
            {step === 2 && "Choose your preferred symbol"}
            {step === 3 && "Configure your display settings"}
            {step === 4 && "Set a 4-digit PIN (Optional)"}
            {step === 5 && "Quick Application Tour"}
          </p>
        </div>

        <div className="min-h-[200px] flex flex-col justify-center">
          {step === 1 && (
            <div className="space-y-6">
              <input
                type="text" autoFocus value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your Name"
                className="w-full rounded-xl px-6 py-4 text-sm font-bold outline-none transition-all uppercase"
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  border: '2px solid var(--color-border-card)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-4 gap-3">
              {['$', '€', '£', '¥', '₹', '₱', '₩', 'R$'].map(c => (
                <button
                  key={c} onClick={() => setCurrency(c)}
                  className="h-14 rounded-xl border-2 text-xl font-semibold transition-all"
                  style={currency === c
                    ? { borderColor: 'var(--color-accent)', backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)' }
                    : { borderColor: 'var(--color-border-card)', backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="p-6 rounded-2xl flex items-center justify-between cursor-pointer"
                 onClick={() => setPrivacyMode(!privacyMode)}
                 style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-card)' }}>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs uppercase tracking-wide"
                  style={{ color: 'var(--color-text-secondary)' }}>Privacy Mode</h4>
                <p className="text-xs uppercase font-bold"
                  style={{ color: 'var(--color-text-tertiary)' }}>Blur sensitive balances by default</p>
              </div>
              <div className="w-12 h-7 rounded-full transition-all relative"
                style={{ backgroundColor: privacyMode ? 'var(--color-accent)' : 'var(--color-border-primary)' }}>
                <div className={`absolute top-1 w-5 h-5 rounded-full shadow-sm transition-all ${privacyMode ? 'left-6' : 'left-1'}`}
                  style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 flex flex-col items-center">
               <div className="flex gap-4 justify-center mb-4">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="w-4 h-4 rounded-full border-2"
                      style={pin.length > i
                        ? { backgroundColor: 'var(--color-accent)', borderColor: 'var(--color-accent)' }
                        : { borderColor: 'var(--color-border-primary)' }
                      } />
                  ))}
               </div>

               <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
                 {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                   <button
                     key={num}
                     onClick={() => handlePinInput(num.toString())}
                     className="h-12 rounded-xl font-semibold text-lg active:scale-95 transition-all"
                     style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
                   >
                     {num}
                   </button>
                 ))}
                 <div />
                 <button
                   onClick={() => handlePinInput('0')}
                   className="h-12 rounded-xl font-semibold text-lg active:scale-95 transition-all"
                   style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
                 >
                   0
                 </button>
                 <button
                   onClick={() => handlePinInput('back')}
                   className="h-12 rounded-xl font-semibold text-lg active:scale-95 transition-all flex items-center justify-center"
                   style={{ backgroundColor: 'var(--color-danger-light, rgba(239,68,68,0.1))', color: 'var(--color-danger, #ef4444)' }}
                 >
                   ⌫
                 </button>
               </div>
               <p className="text-xs font-bold uppercase tracking-wide"
                 style={{ color: 'var(--color-text-tertiary)' }}>Leave empty for no security</p>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              {[
                { icon: '📊', title: 'Dashboard', desc: 'Visual overview of your net worth, spending, and recent activity.' },
                { icon: '🤖', title: 'AI Advisor', desc: 'Chat with an AI advisor that knows your finances inside and out.' },
                { icon: '⚙️', title: 'Settings', desc: 'Export data to CSV, manage multiple profiles, and customize categories.' },
              ].map(item => (
                <div key={item.title} className="p-4 rounded-xl flex gap-4 items-start"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-card)' }}>
                  <div className="text-2xl">{item.icon}</div>
                  <div>
                    <h4 className="font-semibold text-xs uppercase tracking-wide"
                      style={{ color: 'var(--color-text-primary)' }}>{item.title}</h4>
                    <p className="text-xs mt-1 font-medium"
                      style={{ color: 'var(--color-text-tertiary)' }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-4">
          {step > 1 && (
            <button onClick={() => setStep(step - 1)}
              className="flex-1 py-4 rounded-xl font-semibold uppercase text-xs tracking-wide transition-colors"
              style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
              Back
            </button>
          )}
          <button
            disabled={step === 1 && !name.trim()}
            onClick={handleNext}
            className="flex-[2] text-white py-4 rounded-xl font-semibold uppercase text-xs tracking-wide shadow-xl transition-all disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-bg-sidebar)' }}
          >
            {step === totalSteps ? "Get Started" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
};
