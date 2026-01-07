
import React, { useState, useRef, useEffect } from 'react';
import { UserPreferences, Notification, NotificationType } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  preferences: UserPreferences;
  notifications: Notification[];
  onMarkRead: () => void;
  onClearNotifications: () => void;
  onSwitchProfile: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  setActiveTab, 
  preferences,
  notifications,
  onMarkRead,
  onClearNotifications,
  onSwitchProfile
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'transactions', label: 'Transactions', icon: '📝' },
    { id: 'budgets', label: 'Budgets', icon: '📅' },
    { id: 'advisor', label: 'Advisor', icon: '🤖' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside both the button (notificationRef) and the dropdown (dropdownRef)
      if (
        notificationRef.current && 
        !notificationRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    return name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const Avatar = ({ size = '8' }: { size?: string }) => (
    <div className={`w-${size} h-${size} rounded-full overflow-hidden border-2 border-slate-200 bg-slate-800 flex items-center justify-center shrink-0`}>
      {preferences.profileImage ? (
        <img src={preferences.profileImage} alt="Profile" className="w-full h-full object-cover" />
      ) : (
        <span className="text-[10px] font-black text-white uppercase tracking-tighter">
          {getInitials(preferences.name || 'User')}
        </span>
      )}
    </div>
  );

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case NotificationType.DANGER: return '🚨';
      case NotificationType.WARNING: return '⚠️';
      case NotificationType.SUCCESS: return '✅';
      default: return '📢';
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 z-40">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-black overflow-hidden shadow-lg"
            style={{ backgroundColor: preferences.accentColor }}
          >
            {preferences.profileImage ? (
              <img src={preferences.profileImage} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              'W'
            )}
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tighter leading-none">WINGMAN</h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase">Finance</p>
          </div>
        </div>
        <nav className="flex-1 p-4 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible scrollbar-hide">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 whitespace-nowrap group ${
                activeTab === item.id
                  ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-900/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-xs font-bold uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-6 border-t border-slate-800 hidden md:block space-y-4">
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <p className="text-[10px] text-slate-400 mb-1 uppercase tracking-widest font-black">Profile</p>
            <p className="text-xs font-bold text-white uppercase truncate">{preferences.name || 'GUEST'}</p>
          </div>
          <button 
            onClick={onSwitchProfile}
            className="w-full text-center text-[9px] font-bold text-slate-500 hover:text-white uppercase tracking-widest transition-colors py-2"
          >
            Switch Profile
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 z-30 relative">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">{activeTab}</h2>
          </div>
          <div className="flex items-center gap-3 md:gap-4">
            <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) onMarkRead();
                }}
                className={`p-2 rounded-xl transition-colors relative ${showNotifications ? 'bg-slate-100' : 'text-slate-400 hover:bg-slate-50'}`}
              >
                <span className="text-xl">🔔</span>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white" />
                )}
              </button>
            </div>

            <button 
              onClick={() => setActiveTab('settings')}
              className="hover:scale-105 active:scale-95 transition-transform cursor-pointer"
              title="Go to Settings"
            >
              <Avatar size="8" />
            </button>
            <button
               onClick={onSwitchProfile}
               className="md:hidden text-xl text-slate-400 ml-1"
               title="Switch Profile"
            >
              🚪
            </button>
          </div>
        </header>

        {/* Notification Dropdown - Moved to Fixed Position to escape overflow clipping */}
        {showNotifications && (
          <div 
            ref={dropdownRef}
            className={`
              bg-white rounded-[2rem] border border-slate-200 shadow-2xl overflow-hidden flex flex-col z-[100] animate-in fade-in slide-in-from-top-4 duration-200
              
              /* Mobile: Fixed at top with margins */
              fixed top-[4.5rem] left-4 right-4 max-h-[60vh]
              
              /* Desktop: Fixed top right aligned with header padding */
              md:absolute md:top-[4.5rem] md:right-8 md:left-auto md:w-80 md:max-h-[500px]
            `}
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-900 shrink-0">
              <h3 className="font-black text-white text-xs tracking-[0.2em] uppercase">Notifications</h3>
              <button 
                onClick={onClearNotifications}
                className="text-[10px] font-black uppercase text-indigo-400 hover:text-indigo-300 tracking-widest"
              >
                Clear All
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.length > 0 ? (
                notifications.map(n => (
                  <div 
                    key={n.id} 
                    className={`p-4 rounded-2xl border transition-all ${n.isRead ? 'opacity-50' : 'opacity-100 border-indigo-100 bg-indigo-50/20'}`}
                  >
                    <div className="flex gap-3">
                      <span className="text-lg shrink-0">{getNotificationIcon(n.type)}</span>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black tracking-tight text-slate-800 uppercase">{n.title}</p>
                        <p className="text-[11px] leading-relaxed font-medium text-slate-600">{n.message}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No notifications.</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-slate-50">
          <div className="p-4 md:p-10 max-w-6xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
