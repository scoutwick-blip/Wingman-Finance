
import React, { useState } from 'react';
import { UserProfile } from '../types';

interface ProfileSelectorProps {
  profiles: UserProfile[];
  onSelectProfile: (id: string) => void;
  onCreateProfile: () => void;
  onDeleteProfile: (id: string) => void;
}

export const ProfileSelector: React.FC<ProfileSelectorProps> = ({ 
  profiles, 
  onSelectProfile, 
  onCreateProfile,
  onDeleteProfile
}) => {
  const [lockedProfileId, setLockedProfileId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState(false);

  const handleProfileClick = (profile: UserProfile) => {
    if (profile.pin && profile.pin.length === 4) {
      setLockedProfileId(profile.id);
      setPinInput('');
      setError(false);
    } else {
      onSelectProfile(profile.id);
    }
  };

  const handlePinEntry = (num: string) => {
    setError(false);
    let newVal = pinInput;
    
    if (num === 'back') {
      newVal = pinInput.slice(0, -1);
    } else if (pinInput.length < 4) {
      newVal = pinInput + num;
    }
    
    setPinInput(newVal);

    if (newVal.length === 4) {
      const profile = profiles.find(p => p.id === lockedProfileId);
      if (profile && profile.pin === newVal) {
        // Success
        setTimeout(() => {
            onSelectProfile(profile.id);
        }, 100);
      } else {
        // Error
        setTimeout(() => {
            setError(true);
            setPinInput('');
        }, 300);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-[100] flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-indigo-600 text-white text-3xl font-black shadow-2xl shadow-indigo-900/50 mb-4">
            W
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Wingman Finance</h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em]">Select Account to Login</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {profiles.map(profile => (
            <div 
              key={profile.id}
              className="group relative bg-slate-800 rounded-3xl p-1 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/20"
            >
              <button 
                onClick={() => handleProfileClick(profile)}
                className="w-full h-full bg-slate-800 rounded-[1.3rem] p-6 flex flex-col items-center gap-4 border border-slate-700 group-hover:border-indigo-500/50 transition-colors"
              >
                <div className="w-20 h-20 rounded-full bg-slate-700 overflow-hidden flex items-center justify-center text-2xl border-4 border-slate-600 group-hover:border-indigo-500 transition-colors relative">
                  {profile.avatar ? (
                    <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-black text-slate-400 group-hover:text-white">
                      {profile.name[0]?.toUpperCase() || 'P'}
                    </span>
                  )}
                  {profile.pin && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-xl">🔒</span>
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-black text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors">
                    {profile.name}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                    Last Active: {new Date(profile.lastActive).toLocaleDateString()}
                  </p>
                </div>
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if(confirm('Delete this account and all its data? This cannot be undone.')) onDeleteProfile(profile.id);
                }}
                className="absolute top-4 right-4 text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-2"
                title="Delete Account"
              >
                ✕
              </button>
            </div>
          ))}

          {/* Add Profile Button */}
          <button 
            onClick={onCreateProfile}
            className="flex flex-col items-center justify-center gap-4 bg-slate-800/50 rounded-3xl p-6 border-2 border-dashed border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800 transition-all group"
          >
            <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-500 group-hover:text-indigo-400 group-hover:bg-indigo-950/30 transition-colors">
              <span className="text-3xl font-light">+</span>
            </div>
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest group-hover:text-indigo-300">Create Account</span>
          </button>
        </div>
      </div>

      {/* PIN ENTRY MODAL */}
      {lockedProfileId && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in">
          <div className={`bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl ${error ? 'animate-shake' : ''}`}>
             <div className="text-center mb-6">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-3xl mb-4 mx-auto">
                    🔒
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Security Check</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Enter access PIN</p>
             </div>

             <div className="flex gap-4 justify-center mb-8">
                {[0, 1, 2, 3].map(i => (
                <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${pinInput.length > i ? 'bg-indigo-600 border-indigo-600 scale-110' : 'border-slate-300'}`} />
                ))}
             </div>

             {error && (
                 <p className="text-center text-rose-500 text-xs font-black uppercase tracking-widest mb-4">Access Denied</p>
             )}

            <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button 
                    key={num} 
                    onClick={() => handlePinEntry(num.toString())}
                    className="h-14 rounded-2xl bg-slate-50 text-slate-800 font-black text-xl hover:bg-slate-100 active:scale-95 transition-all shadow-sm"
                    >
                    {num}
                    </button>
                ))}
                <div />
                <button 
                    onClick={() => handlePinEntry('0')}
                    className="h-14 rounded-2xl bg-slate-50 text-slate-800 font-black text-xl hover:bg-slate-100 active:scale-95 transition-all shadow-sm"
                >
                    0
                </button>
                <button 
                    onClick={() => handlePinEntry('back')}
                    className="h-14 rounded-2xl bg-rose-50 text-rose-500 font-black text-xl hover:bg-rose-100 active:scale-95 transition-all shadow-sm flex items-center justify-center"
                >
                    ⌫
                </button>
            </div>
            
            <button 
                onClick={() => {
                    setLockedProfileId(null);
                    setPinInput('');
                    setError(false);
                }}
                className="w-full mt-6 py-3 text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-widest"
            >
                Cancel
            </button>
          </div>
        </div>
      )}
      <style>{`
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
            20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
            animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>
    </div>
  );
};
