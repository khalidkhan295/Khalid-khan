import React, { useState, useEffect, useCallback } from 'react';
import {
  Home,
  ListChecks,
  Users,
  ArrowDownToLine,
  User,
  Bell,
  Wallet,
  Lock,
  Loader2,
  X,
  CheckCheck,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { apiRequest, setUserToken } from './api';
import { MeResponse, TaskItem, TaskSubmission, UserTab } from './types';
import { AuthScreen } from './components/AuthScreen';
import { HomeView } from './components/HomeView';
import { TasksView } from './components/TasksView';
import { ReferView } from './components/ReferView';
import { WithdrawView } from './components/WithdrawView';
import { ProfileView } from './components/ProfileView';
import { AdminPanel } from './components/AdminPanel';
import { ToastContainer, ToastItem, UserAvatar, formatBDT, formatBanglaDate } from './components/ToastAndUtils';

const NAV_ITEMS: Array<{ id: UserTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'home', label: 'হোম', icon: Home },
  { id: 'tasks', label: 'Earn', icon: ListChecks },
  { id: 'refer', label: 'রেফার', icon: Users },
  { id: 'withdraw', label: 'উত্তোলন', icon: ArrowDownToLine },
  { id: 'profile', label: 'প্রোফাইল', icon: User },
];

export default function App() {
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('admin') === '1' || window.location.pathname === '/admin';
  });

  const [initialRefCode] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('ref') || '';
  });

  const [booting, setBooting] = useState(true);
  const [meData, setMeData] = useState<MeResponse | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [activeTab, setActiveTab] = useState<UserTab>('home');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchUserWorkspace = useCallback(async () => {
    try {
      const [meRes, tasksRes] = await Promise.all([
        apiRequest<MeResponse>('/api/auth/me'),
        apiRequest<{ tasks: TaskItem[]; submissions: TaskSubmission[] }>('/api/tasks'),
      ]);
      setMeData(meRes);
      setTasks(tasksRes.tasks);
      setSubmissions(tasksRes.submissions);
    } catch {
      setMeData(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchUserWorkspace().finally(() => {
      if (active) setBooting(false);
    });
    return () => {
      active = false;
    };
  }, [fetchUserWorkspace]);

  async function handleAuthenticated(data: MeResponse) {
    setMeData(data);
    try {
      const tasksRes = await apiRequest<{ tasks: TaskItem[]; submissions: TaskSubmission[] }>('/api/tasks');
      setTasks(tasksRes.tasks);
      setSubmissions(tasksRes.submissions);
    } catch {
      // handled silently
    }
  }

  async function handleLogout() {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUserToken(null);
    setMeData(null);
    setTasks([]);
    setSubmissions([]);
    setActiveTab('home');
    addToast('সফলভাবে লগআউট সম্পন্ন হয়েছে।', 'info');
  }

  async function handleOpenNotifications() {
    setShowNotifDrawer(true);
    if (meData && meData.unreadNotifications > 0) {
      await apiRequest('/api/notifications/read', { method: 'POST' }).catch(() => {});
      setMeData((prev) =>
        prev
          ? {
              ...prev,
              unreadNotifications: 0,
              notifications: prev.notifications.map((n) => ({ ...n, is_read: 1 })),
            }
          : null
      );
    }
  }

  function switchAdminMode(enable: boolean) {
    setIsAdminRoute(enable);
    const url = new URL(window.location.href);
    if (enable) {
      url.searchParams.set('admin', '1');
    } else {
      url.searchParams.delete('admin');
      if (url.pathname === '/admin') url.pathname = '/';
    }
    window.history.replaceState({}, '', url.toString());
    if (!enable && meData) {
      fetchUserWorkspace();
    }
  }

  if (isAdminRoute) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <AdminPanel onBackToApp={() => switchAdminMode(false)} onToast={addToast} />
      </>
    );
  }

  if (booting) {
    return (
      <div className="min-h-screen bg-[#060B18] flex flex-col items-center justify-center gap-3 text-slate-300">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm font-medium">Task Money BD লোড হচ্ছে...</p>
      </div>
    );
  }

  if (!meData) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <AuthScreen
          initialRefCode={initialRefCode}
          onAuthenticated={handleAuthenticated}
          onOpenAdmin={() => switchAdminMode(true)}
          onToast={addToast}
        />
      </>
    );
  }

  const { user, settings, unreadNotifications, notifications } = meData;

  return (
    <div className="min-h-screen bg-[#060B18] text-slate-100 flex flex-col lg:flex-row">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#080F21] border-r border-blue-950/80 z-30">
        <div className="h-16 px-6 flex items-center gap-2.5 border-b border-blue-950/80">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight truncate">{settings.appName || 'Task Money BD'}</span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full min-h-[46px] px-4 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-[#0E1835]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-blue-950/80 space-y-3">
          <div className="p-3.5 rounded-xl bg-[#0D1730] border border-blue-900/40">
            <p className="text-xs text-slate-400">বর্তমান ব্যালেন্স</p>
            <p className="text-xl font-bold text-emerald-400 tabular-nums mt-0.5">{formatBDT(user.balance)}</p>
          </div>
          <button
            type="button"
            onClick={() => switchAdminMode(true)}
            className="w-full min-h-[40px] px-3 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-[#0D1730] flex items-center gap-2 transition-colors"
          >
            <Lock className="w-3.5 h-3.5 text-blue-400" />
            <span>অ্যাডমিন প্যানেল</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Compact Sticky Top Bar with live Balance display */}
        <header className="sticky top-0 z-30 h-[52px] lg:h-16 bg-[#080F21]/90 backdrop-blur-md border-b border-blue-950/80 px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 lg:hidden min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0">
              <Wallet className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-white truncate">{settings.appName || 'Task Money BD'}</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-sm text-slate-300">
            <span className="font-semibold text-white">
              {NAV_ITEMS.find((i) => i.id === activeTab)?.label}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-xs font-mono text-blue-300">{user.id}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('withdraw')}
              title="ব্যালেন্স দেখুন ও উত্তোলন করুন"
              className="min-h-[38px] px-3 rounded-lg bg-[#0D1730] hover:bg-[#132042] border border-emerald-500/35 flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-emerald-400 tabular-nums">
                {formatBDT(user.balance)}
              </span>
            </button>

            <button
              type="button"
              onClick={handleOpenNotifications}
              aria-label="নোটিফিকেশন"
              className="relative min-h-[40px] min-w-[40px] rounded-lg bg-[#0D1730] hover:bg-[#132042] border border-blue-900/40 flex items-center justify-center text-slate-200 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-[10px] font-bold text-white flex items-center justify-center tabular-nums">
                  {unreadNotifications}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              aria-label="প্রোফাইল"
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-[#0D1730] transition-colors"
            >
              <UserAvatar src={user.avatarUrl} name={user.name} sizeClass="w-8 h-8 text-xs" />
              <span className="hidden sm:inline text-xs font-semibold text-slate-200 max-w-[110px] truncate">
                {user.name}
              </span>
            </button>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 pb-24 lg:pb-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              {activeTab === 'home' && (
                <HomeView
                  user={user}
                  settings={settings}
                  tasks={tasks}
                  onNavigate={setActiveTab}
                  onSelectTask={(taskId) => {
                    setSelectedTaskId(taskId);
                    setActiveTab('tasks');
                  }}
                />
              )}

              {activeTab === 'tasks' && (
                <TasksView
                  tasks={tasks}
                  submissions={submissions}
                  tasksEnabled={settings.tasksEnabled}
                  defaultReward={settings.taskReward}
                  earnTitle={settings.earnTitle}
                  selectedTaskId={selectedTaskId}
                  onSelectTaskId={setSelectedTaskId}
                  onSubmitted={fetchUserWorkspace}
                  onToast={addToast}
                />
              )}

              {activeTab === 'refer' && (
                <ReferView
                  referralCode={user.referralCode}
                  invitedUsersCount={user.invitedUsers}
                  onToast={addToast}
                />
              )}

              {activeTab === 'withdraw' && (
                <WithdrawView
                  balance={user.balance}
                  availableBalance={user.availableBalance}
                  minWithdrawal={settings.minWithdrawal}
                  withdrawMethodLabel={settings.withdrawMethodLabel}
                  hasActiveWithdrawal={user.hasActiveWithdrawal}
                  onWithdrawn={fetchUserWorkspace}
                  onToast={addToast}
                />
              )}

              {activeTab === 'profile' && (
                <ProfileView
                  user={user}
                  onUpdated={(updated) => setMeData(updated)}
                  onLogout={handleLogout}
                  onOpenAdmin={() => switchAdminMode(true)}
                  onToast={addToast}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Fixed Bottom Navigation for Mobile (5 tabs, compact 60px height) */}
      <nav
        aria-label="প্রধান নেভিগেশন"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#080F21]/95 backdrop-blur-md border-t border-blue-950 pb-safe"
      >
        <div className="grid grid-cols-5 h-[58px] items-center">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Notifications Drawer */}
      <AnimatePresence>
        {showNotifDrawer && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotifDrawer(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md bg-[#091126] border-l border-blue-900/50 h-full flex flex-col z-10"
            >
              <div className="px-5 py-4 border-b border-blue-900/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-400" />
                  <h2 className="text-base font-bold text-white">নোটিফিকেশন</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNotifDrawer(false)}
                  aria-label="বন্ধ করুন"
                  className="w-10 h-10 rounded-lg hover:bg-[#0D1730] flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-blue-900/30">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-400">
                    কোনো নতুন নোটিফিকেশন নেই।
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="p-4 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white">{n.title}</p>
                        <CheckCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{n.message}</p>
                      <p className="text-[11px] text-slate-500">{formatBanglaDate(n.created_at)}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
