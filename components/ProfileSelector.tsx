
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
        setTimeout(() => {
            onSelectProfile(profile.id);
        }, 100);
      } else {
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
        <div className="text-center mb-12 space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white text-2xl font-semibold shadow-2xl shadow-indigo-900/50 mb-2">
            W
          </div>
          <h1 className="text-3xl font-semibold text-white tracking-tight">Wingman Finance</h1>
          <p className="text-sm text-slate-400">Who's using Wingman?</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 max-w-3xl mx-auto">
          {profiles.map((profile, i) => (
            <div
              key={profile.id}
              className="group relative bg-slate-800/80 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <button
                onClick={() => handleProfileClick(profile)}
                className="w-full h-full bg-slate-800 rounded-2xl p-6 flex flex-col items-center gap-3 border border-slate-700/80 group-hover:border-indigo-500/40 transition-colors"
              >
                <div className="w-16 h-16 rounded-full bg-slate-700 overflow-hidden flex items-center justify-center text-xl border-2 border-slate-600 group-hover:border-indigo-500 transition-colors relative">
                  {profile.avatar ? (
                    <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-semibold text-slate-400 group-hover:text-white transition-colors">
                      {profile.name[0]?.toUpperCase() || 'U'}
                    </span>
                  )}
                  {profile.pin && (
                    <div className="absolute bottom-0 right-0 w-5 h-5 bg-slate-600 rounded-full flex items-center justify-center border-2 border-slate-800">
                      <span className="text-[10px]">🔒</span>
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <h3 className="text-base font-semibold text-white tracking-tight group-hover:text-indigo-400 transition-colors">
                    {profile.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(profile.lastActive).toLocaleDateString()}
                  </p>
                </div>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDeleteId(profile.id);
                }}
                className="absolute top-3 right-3 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-lg hover:bg-slate-700/50"
                title="Delete Profile"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}

          {/* Add Profile */}
          <button
            onClick={onCreateProfile}
            className="flex flex-col items-center justify-center gap-3 bg-slate-800/30 rounded-2xl p-6 border-2 border-dashed border-slate-700/60 hover:border-indigo-500/40 hover:bg-slate-800/60 transition-all group"
          >
            <div className="w-14 h-14 rounded-full bg-slate-700/30 flex items-center justify-center text-slate-500 group-hover:text-indigo-400 group-hover:bg-indigo-950/30 transition-colors">
              <span className="text-2xl font-light">+</span>
            </div>
            <span className="text-xs font-medium text-slate-500 group-hover:text-indigo-300 transition-colors">New Profile</span>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full border border-slate-700 shadow-2xl">
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center text-xl mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3,6 5,6 21,6" /><path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Delete Profile?</h3>
              <p className="text-sm text-slate-400 mt-1">This will remove the profile and all its data permanently.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteProfile(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="flex-1 py-3 rounded-xl bg-rose-600 text-white text-sm font-medium hover:bg-rose-500 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Entry Modal */}
      {lockedProfileId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className={`bg-slate-800 rounded-2xl p-8 max-w-sm w-full border border-slate-700 shadow-2xl ${error ? 'animate-shake' : ''}`}>
             <div className="text-center mb-6">
                <div className="w-14 h-14 bg-indigo-500/10 rounded-full flex items-center justify-center text-2xl mb-3 mx-auto">
                    🔒
                </div>
                <h3 className="text-lg font-semibold text-white">Enter PIN</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {profiles.find(p => p.id === lockedProfileId)?.name}
                </p>
             </div>

             <div className="flex gap-3 justify-center mb-6">
                {[0, 1, 2, 3].map(i => (
                <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${pinInput.length > i ? 'bg-indigo-500 border-indigo-500 scale-110' : 'border-slate-500'}`} />
                ))}
             </div>

             {error && (
                 <p className="text-center text-rose-400 text-sm font-medium mb-4">Incorrect PIN, try again</p>
             )}

            <div className="grid grid-cols-3 gap-2.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                    key={num}
                    onClick={() => handlePinEntry(num.toString())}
                    className="h-14 rounded-xl bg-slate-700/80 text-white font-medium text-lg hover:bg-slate-600 active:scale-95 transition-all"
                    >
                    {num}
                    </button>
                ))}
                <div />
                <button
                    onClick={() => handlePinEntry('0')}
                    className="h-14 rounded-xl bg-slate-700/80 text-white font-medium text-lg hover:bg-slate-600 active:scale-95 transition-all"
                >
                    0
                </button>
                <button
                    onClick={() => handlePinEntry('back')}
                    className="h-14 rounded-xl bg-slate-700/40 text-slate-400 font-medium text-lg hover:bg-slate-600 hover:text-white active:scale-95 transition-all flex items-center justify-center"
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
                className="w-full mt-5 py-2.5 text-slate-400 hover:text-white text-sm font-medium transition-colors"
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
