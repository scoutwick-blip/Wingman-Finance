
import React from 'react';
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
                onClick={() => onSelectProfile(profile.id)}
                className="w-full h-full bg-slate-800 rounded-[1.3rem] p-6 flex flex-col items-center gap-4 border border-slate-700 group-hover:border-indigo-500/50 transition-colors"
              >
                <div className="w-20 h-20 rounded-full bg-slate-700 overflow-hidden flex items-center justify-center text-2xl border-4 border-slate-600 group-hover:border-indigo-500 transition-colors">
                  {profile.avatar ? (
                    <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-black text-slate-400 group-hover:text-white">
                      {profile.name[0]?.toUpperCase() || 'P'}
                    </span>
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
    </div>
  );
};
