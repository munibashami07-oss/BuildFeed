import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Search, Bell, Plus, Menu, X,
  User as UserIcon, Settings, LogOut, ChevronDown,
  Layers, Command, Gift,
} from 'lucide-react';
import { useAuth }  from '../../features/auth/AuthContext';
import { Button }   from '../ui/Button';
import { notificationApi } from '../../services/api/notificationApi';
import { NotificationItem } from '../../types/notification';

interface NavbarProps {
  onOpenMobileSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenMobileSidebar }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [notifications, setNotifications]         = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount]             = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen]           = useState(false);
  const [toasts, setToasts]                       = useState<NotificationItem[]>([]);
  const [leavingToastIds, setLeavingToastIds]     = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery]             = useState('');

  const knownIdsRef    = useRef<Set<string>>(new Set());
  const hasLoadedOnce  = useRef(false);
  const searchRef      = useRef<HTMLInputElement>(null);

  const dismissToast = React.useCallback((id: string) => {
    setLeavingToastIds(prev => { const n = new Set(prev); n.add(id); return n; });
    window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      setLeavingToastIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }, 320);
  }, []);

  const pushToasts = React.useCallback((items: NotificationItem[]) => {
    if (!items.length) return;
    setToasts(prev => [...items, ...prev].slice(0, 3));
    items.forEach(item => window.setTimeout(() => dismissToast(item.id), 6000));
  }, [dismissToast]);

  const refreshNotifications = React.useCallback(async () => {
    if (!isAuthenticated) { setNotifications([]); setUnreadCount(0); return; }
    try {
      const data = await notificationApi.getNotifications(30, 0);
      setNotifications(data.items);
      setUnreadCount(data.unread_count);
      if (!hasLoadedOnce.current) {
        data.items.forEach(i => knownIdsRef.current.add(i.id));
        hasLoadedOnce.current = true;
      } else {
        const fresh = data.items.filter(i => !knownIdsRef.current.has(i.id));
        if (fresh.length) { fresh.forEach(i => knownIdsRef.current.add(i.id)); pushToasts(fresh); }
      }
    } catch { /* silent */ }
  }, [isAuthenticated, pushToasts]);

  useEffect(() => {
    refreshNotifications();
    window.addEventListener('buildfeed:notifications-updated', refreshNotifications);
    const iv = window.setInterval(refreshNotifications, 15000);
    return () => {
      window.removeEventListener('buildfeed:notifications-updated', refreshNotifications);
      window.clearInterval(iv);
    };
  }, [refreshNotifications, location.pathname]);

  // Keyboard shortcut: / or Cmd+K → focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isAuthenticated) return;
      const tag = (e.target as HTMLElement).tagName;
      if ((e.key === '/' && !['INPUT', 'TEXTAREA'].includes(tag)) ||
          (e.key === 'k' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isAuthenticated]);

  const toggleNotifications = async () => {
    const next = !notificationsOpen;
    setNotificationsOpen(next);
    if (next) {
      await refreshNotifications();
      try {
        await notificationApi.markAllRead();
        setUnreadCount(0);
        setNotifications(items => items.map(i => ({ ...i, is_read: true })));
      } catch { /* silent */ }
    }
  };

  const handleNotificationClick = async (n: NotificationItem) => {
    setToasts(prev => prev.filter(t => t.id !== n.id));
    try {
      if (!n.is_read) {
        await notificationApi.markRead(n.id);
        setUnreadCount(c => Math.max(0, c - 1));
        setNotifications(items => items.map(i => i.id === n.id ? { ...i, is_read: true } : i));
      }
    } catch { /* silent */ }
    setNotificationsOpen(false);
    if (n.link) navigate(n.link);
  };

  const relativeTime = (ts: string) => {
    const secs = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
    if (secs < 60)   return 'Just now';
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400)return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
    navigate('/');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-borderPaper bg-surface/95 backdrop-blur-md transition-colors duration-200">

      {/* ── Notification toasts ───────────────────────────────────────── */}
      {toasts.length > 0 && (
        <div className="notif-toast-viewport fixed top-[72px] right-4 sm:right-6 z-[100] flex flex-col gap-2.5 w-[min(340px,calc(100vw-2rem))]">
          {toasts.map(toast => (
            <div
              key={toast.id}
              role="button"
              tabIndex={0}
              onClick={() => handleNotificationClick(toast)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleNotificationClick(toast); }}
              className={`notif-toast-3d ${leavingToastIds.has(toast.id) ? 'notif-toast-3d-out' : ''} cursor-pointer rounded-2xl border border-borderPaper bg-surface shadow-elevated px-4 py-3 flex items-start gap-3`}
            >
              <div className="mt-0.5 w-7 h-7 rounded-full bg-accentLight text-accent flex items-center justify-center flex-shrink-0 text-[11px] font-bold">
                <Bell size={13} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-primary">{toast.title}</p>
                <p className="text-xs text-secondary mt-0.5 leading-relaxed line-clamp-2">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); dismissToast(toast.id); }}
                className="text-muted hover:text-primary flex-shrink-0 mt-0.5"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Main bar ─────────────────────────────────────────────────── */}
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-5 h-[60px] flex items-center gap-4">

        {/* Mobile: hamburger + logo */}
        <div className="flex items-center gap-2.5 lg:hidden flex-shrink-0">
          {onOpenMobileSidebar && (
            <button
              onClick={onOpenMobileSidebar}
              className="p-2 rounded-lg text-secondary hover:text-primary hover:bg-raised transition-colors"
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
          )}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
              <Layers size={16} className="text-white" />
            </div>
            <span className="font-heading text-base font-bold text-primary tracking-tight">BuildFeed</span>
          </Link>
        </div>

        {/* Desktop: logo + tagline (hidden on mobile — sidebar shows logo) */}
        <div className="hidden lg:flex items-center gap-3 flex-shrink-0 mr-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shadow-purple">
              <Layers size={15} className="text-white" />
            </div>
            <span className="font-heading text-base font-bold text-primary tracking-tight">BuildFeed</span>
          </div>
          <span className="text-borderPaper select-none">|</span>
          <span className="text-xs text-muted font-medium hidden xl:block whitespace-nowrap">
            From Scrolling to Building
          </span>
        </div>

        {/* Search bar */}
        {isAuthenticated ? (
          <form
            onSubmit={handleSearch}
            className="flex-1 min-w-0 max-w-[520px] search-bar flex items-center relative"
          >
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none flex-shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search articles, repos, videos, topics..."
              className="w-full bg-transparent pl-10 pr-14 py-2 text-sm text-primary placeholder:text-muted focus:outline-none"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 text-[10px] font-mono text-muted bg-raised px-1.5 py-0.5 rounded-md border border-borderPaper pointer-events-none">
              <Command size={9} /><span>K</span>
            </div>
          </form>
        ) : (
          <div className="flex-1" />
        )}

        {/* Right actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isAuthenticated ? (
            <>
              {/* Create CTA */}
              <Link
                to="/saved"
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accentHover shadow-purple transition-all hover:shadow-purpleHover hover:scale-[1.02] active:scale-[0.99]"
              >
                <Plus size={14} strokeWidth={2.5} />
                <span>New Project</span>
              </Link>

              {/* Theme toggle removed — BuildFeed is dark-only */}

              {/* Notification bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={toggleNotifications}
                  aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
                  className={`relative p-2 rounded-lg text-secondary hover:text-primary hover:bg-raised border border-transparent hover:border-borderPaper transition-all duration-150 ${notificationsOpen ? 'bg-raised text-primary border-borderPaper' : ''}`}
                >
                  <Bell size={17} />
                  {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-accent text-white text-[8px] font-bold leading-[15px] text-center border border-surface">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 top-11 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-borderPaper bg-surface shadow-overlay overflow-hidden z-50 animate-fade-in-up">
                    <div className="px-4 py-3 border-b border-borderPaper flex items-center justify-between">
                      <div>
                        <h3 className="font-heading font-bold text-primary text-sm">Notifications</h3>
                        <p className="text-[11px] text-muted">Updates from your build journey</p>
                      </div>
                      <button onClick={() => setNotificationsOpen(false)} className="p-1 text-muted hover:text-primary rounded-lg">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="px-5 py-8 text-center">
                          <Bell size={20} className="mx-auto mb-2 text-muted" />
                          <p className="text-sm font-semibold text-primary">You're all caught up</p>
                          <p className="text-xs text-muted mt-1">We'll let you know when something meaningful happens.</p>
                        </div>
                      ) : notifications.map(n => (
                        <div
                          key={n.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleNotificationClick(n)}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleNotificationClick(n); }}
                          className={`w-full text-left px-4 py-3 border-b border-borderPaper last:border-0 hover:bg-raised transition-colors cursor-pointer ${n.is_read ? 'opacity-60' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${n.is_read ? 'bg-borderPaper' : 'bg-accent'}`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-semibold text-primary">{n.title}</p>
                                <span className="text-[10px] text-muted whitespace-nowrap">{relativeTime(n.created_at)}</span>
                              </div>
                              <p className="text-xs text-secondary mt-0.5 leading-relaxed">{n.message}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* User avatar */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(v => !v)}
                  className="flex items-center gap-1 p-0.5 rounded-full hover:bg-raised border border-transparent hover:border-borderPaper transition-all"
                >
                  <div className="w-7 h-7 rounded-full bg-accentLight border border-accent/20 text-accent font-bold flex items-center justify-center text-[11px] overflow-hidden">
                    {user?.avatar_url
                      ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                      : user?.username?.substring(0, 2).toUpperCase() || <UserIcon size={13} />
                    }
                  </div>
                  <ChevronDown size={12} className="text-muted" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-11 w-44 rounded-2xl border border-borderPaper bg-surface shadow-overlay p-1.5 z-50 animate-scale-in">
                    <div className="px-3 py-2 border-b border-borderPaper mb-1">
                      <div className="font-semibold text-xs text-primary truncate">{user?.username}</div>
                      <div className="text-[10px] text-muted truncate">@{user?.username}</div>
                    </div>
                    {[
                      { to: '/rewards', icon: <Gift size={14} />,     label: 'Rewards & Levels' },
                      { to: '/profile', icon: <UserIcon size={14} />, label: 'Profile'           },
                      { to: '/settings',icon: <Settings size={14} />, label: 'Settings'          },
                    ].map(item => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-secondary hover:text-primary hover:bg-raised transition-colors"
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </Link>
                    ))}
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left"
                    >
                      <LogOut size={14} />
                      <span>Log Out</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link to="/register">
                <Button variant="accent" size="sm">Get Started</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
