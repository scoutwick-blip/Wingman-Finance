
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
  onOpenTemplates?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  preferences,
  notifications,
  onMarkRead,
  onClearNotifications,
  onSwitchProfile,
  onOpenTemplates
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0, isMobile: false });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'transactions', label: 'Transactions', icon: '📝' },
    { id: 'budgets', label: 'Budgets', icon: '📅' },
    { id: 'bills', label: 'Bills', icon: '💳' },
    { id: 'subscriptions', label: 'Subscriptions', icon: '⚡' },
    { id: 'goals', label: 'Goals', icon: '🎯' },
    { id: 'savings-debt', label: 'Wealth', icon: '💎' },
    { id: 'forecast', label: 'Forecast', icon: '📈' },
    { id: 'advisor', label: 'Advisor', icon: '🤖' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (showNotifications && notificationRef.current) {
      const updatePos = () => {
        const rect = notificationRef.current?.getBoundingClientRect();
        if (rect) {
          setDropdownPos({
            top: rect.bottom + 12,
            right: window.innerWidth - rect.right,
            isMobile: window.innerWidth < 768
          });
        }
      };

      updatePos();
      window.addEventListener('resize', updatePos);
      window.addEventListener('scroll', updatePos, true);

      return () => {
        window.removeEventListener('resize', updatePos);
        window.removeEventListener('scroll', updatePos, true);
      };
    }
  }, [showNotifications]);

  const getInitials = (name: string) => {
    return name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const Avatar = ({ size = '8' }: { size?: string }) => {
    const sizeClasses: Record<string, string> = {
      '6': 'w-6 h-6',
      '8': 'w-8 h-8',
      '10': 'w-10 h-10',
      '12': 'w-12 h-12',
      '14': 'w-14 h-14',
      '16': 'w-16 h-16'
    };
    const dimensions = sizeClasses[size] || 'w-8 h-8';

    return (
      <div className={`${dimensions} rounded-full overflow-hidden border-2 flex items-center justify-center shrink-0`}
        style={{ borderColor: 'var(--color-border-primary)', backgroundColor: 'var(--color-bg-sidebar)' }}>
        {preferences.profileImage ? (
          <img src={preferences.profileImage} alt="Profile" className="w-full h-full object-cover block" />
        ) : (
          <span className="text-xs font-bold text-white">
            {getInitials(preferences.name || 'User')}
          </span>
        )}
      </div>
    );
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case NotificationType.DANGER: return '🚨';
      case NotificationType.WARNING: return '⚠️';
      case NotificationType.SUCCESS: return '✅';
      default: return '📢';
    }
  };

  const formatTabLabel = (tab: string) => {
    return tab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      {/* Sidebar */}
      <aside className="w-full md:w-60 flex flex-col shrink-0 z-40"
        style={{ backgroundColor: 'var(--color-bg-sidebar)', borderRight: '1px solid var(--color-border-primary)' }}>
        <div className="px-5 py-5 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm overflow-hidden"
            style={{ backgroundColor: preferences.accentColor }}
          >
            {preferences.profileImage ? (
              <img src={preferences.profileImage} alt="Logo" className="w-full h-full object-cover block" />
            ) : (
              'W'
            )}
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-none">Wingman</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-sidebar)' }}>Finance</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-3 flex md:flex-col gap-0.5 overflow-x-auto md:overflow-x-visible scrollbar-hide">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 whitespace-nowrap group ${
                activeTab === item.id
                  ? 'text-white font-semibold'
                  : 'hover:text-white'
              }`}
              style={{
                backgroundColor: activeTab === item.id ? 'var(--color-bg-sidebar-active)' : 'transparent',
                color: activeTab === item.id ? 'var(--color-text-sidebar-active)' : 'var(--color-text-sidebar)',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== item.id) {
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-sidebar-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== item.id) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span className="text-base">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="px-4 py-4 hidden md:block space-y-3" style={{ borderTop: 'rgba(255,255,255,0.08) 1px solid' }}>
          {onOpenTemplates && (
            <button
              onClick={onOpenTemplates}
              className="w-full text-white font-semibold py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
              style={{ backgroundColor: 'var(--color-accent)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent)'}
            >
              <span>⚡</span>
              Templates
            </button>
          )}
          <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-sidebar-hover)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs" style={{ color: 'var(--color-text-sidebar)' }}>Profile</p>
            <p className="text-sm font-semibold text-white truncate mt-0.5">{preferences.name || 'Guest'}</p>
          </div>
          <button
            onClick={onSwitchProfile}
            className="w-full text-center text-xs font-medium transition-colors py-1.5 hover:text-white"
            style={{ color: 'var(--color-text-sidebar)' }}
          >
            Switch Profile
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-14 flex items-center justify-between px-4 md:px-8 shrink-0 z-30 relative"
          style={{ backgroundColor: 'var(--color-bg-header)', borderBottom: '1px solid var(--color-border-primary)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            {formatTabLabel(activeTab)}
          </h2>
          <div className="flex items-center gap-2 md:gap-3">
            {onOpenTemplates && (
              <button
                onClick={onOpenTemplates}
                className="md:hidden text-white font-semibold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1"
                style={{ backgroundColor: 'var(--color-accent)' }}
                title="Budget Templates"
              >
                <span>⚡</span>
                <span className="hidden xs:inline">Templates</span>
              </button>
            )}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) onMarkRead();
                }}
                className="p-2 rounded-lg transition-colors relative"
                style={{
                  backgroundColor: showNotifications ? 'var(--color-bg-tertiary)' : 'transparent',
                  color: 'var(--color-text-tertiary)'
                }}
              >
                <span className="text-lg">🔔</span>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border-2"
                    style={{ borderColor: 'var(--color-bg-header)' }} />
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div
                  className="rounded-2xl overflow-hidden flex flex-col z-[100] fixed max-h-[70vh] md:max-h-[500px] md:w-80"
                  style={{
                    top: dropdownPos.top,
                    right: dropdownPos.isMobile ? '1rem' : dropdownPos.right,
                    left: dropdownPos.isMobile ? '1rem' : 'auto',
                    maxWidth: dropdownPos.isMobile ? 'calc(100vw - 2rem)' : 'none',
                    backgroundColor: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border-card)',
                    boxShadow: 'var(--shadow-lg)'
                  }}
                >
                  <div className="px-5 py-4 flex items-center justify-between shrink-0"
                    style={{ borderBottom: '1px solid var(--color-border-primary)', backgroundColor: 'var(--color-bg-sidebar)' }}>
                    <h3 className="font-semibold text-white text-sm">Notifications</h3>
                    <button
                      onClick={onClearNotifications}
                      className="text-xs font-medium"
                      style={{ color: 'var(--color-accent)' }}
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {notifications.length > 0 ? (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          className={`p-3 rounded-xl transition-all ${n.isRead ? 'opacity-50' : 'opacity-100'}`}
                          style={{
                            border: n.isRead ? '1px solid var(--color-border-secondary)' : '1px solid var(--color-accent-light)',
                            backgroundColor: n.isRead ? 'transparent' : 'var(--color-bg-notification)'
                          }}
                        >
                          <div className="flex gap-3">
                            <span className="text-base shrink-0">{getNotificationIcon(n.type)}</span>
                            <div className="space-y-0.5">
                              <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{n.title}</p>
                              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{n.message}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-10 text-center">
                        <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>No notifications</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
               className="md:hidden text-lg ml-1"
               style={{ color: 'var(--color-text-tertiary)' }}
               title="Switch Profile"
            >
              🚪
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
          <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
