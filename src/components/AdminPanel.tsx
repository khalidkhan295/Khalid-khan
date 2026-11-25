import React, { useState, useEffect } from 'react';
import {
  Shield,
  ArrowLeft,
  Users,
  ClipboardCheck,
  Wallet,
  Settings,
  Search,
  CheckCircle2,
  XCircle,
  Banknote,
  LogOut,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Edit3,
  Trash2,
  Megaphone,
  KeyRound,
  Save,
  X,
} from 'lucide-react';
import { apiRequest, setAdminToken } from '../api';
import {
  AdminOverview,
  AdminUserRow,
  AdminSubmissionRow,
  AdminWithdrawalRow,
  AdminTaskRow,
} from '../types';
import { formatBDT, formatBanglaDate, StatusLabel } from './ToastAndUtils';

interface AdminPanelProps {
  onBackToApp: () => void;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type AdminTab = 'withdrawals' | 'submissions' | 'users' | 'tasks';

export function AdminPanel({ onBackToApp, onToast }: AdminPanelProps) {
  const [authStatus, setAuthStatus] = useState<{
    loading: boolean;
    configured: boolean;
    authenticated: boolean;
  }>({ loading: true, configured: true, authenticated: false });

  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [tab, setTab] = useState<AdminTab>('withdrawals');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [submissions, setSubmissions] = useState<AdminSubmissionRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawalRow[]>([]);
  const [tasks, setTasks] = useState<AdminTaskRow[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  // User Edit state
  const [editingUser, setEditingUser] = useState<AdminUserRow | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserBalance, setEditUserBalance] = useState('');
  const [savingUser, setSavingUser] = useState(false);

  // Full App & Settings state
  const [appNameInput, setAppNameInput] = useState('Task Money BD');
  const [welcomeTitleInput, setWelcomeTitleInput] = useState('');
  const [welcomeSubtitleInput, setWelcomeSubtitleInput] = useState('');
  const [announcementInput, setAnnouncementInput] = useState('');
  const [earnTitleInput, setEarnTitleInput] = useState('');
  const [withdrawLabelInput, setWithdrawLabelInput] = useState('');
  const [taskRewardInput, setTaskRewardInput] = useState('10');
  const [tasksEnabledInput, setTasksEnabledInput] = useState(true);
  const [minWithdrawalInput, setMinWithdrawalInput] = useState('20');
  const [applyToAllTasks, setApplyToAllTasks] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // New Task state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskInst, setNewTaskInst] = useState('');
  const [newTaskReward, setNewTaskReward] = useState('10');
  const [creatingTask, setCreatingTask] = useState(false);

  // Broadcast notification state
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifTargetUserId, setNotifTargetUserId] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);

  // Change Admin Passcode state
  const [currentAdminPass, setCurrentAdminPass] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  async function checkAuthStatus() {
    try {
      const res = await apiRequest<{ configured: boolean; authenticated: boolean }>('/api/admin/auth-status', {
        scope: 'admin',
      });
      setAuthStatus({ loading: false, configured: res.configured, authenticated: res.authenticated });
    } catch {
      setAuthStatus({ loading: false, configured: true, authenticated: false });
    }
  }

  useEffect(() => {
    checkAuthStatus();
  }, []);

  async function loadAllAdminData(searchQuery = userSearch) {
    setLoadingData(true);
    try {
      const [ovRes, usrRes, subRes, wdrRes, tskRes] = await Promise.all([
        apiRequest<AdminOverview>('/api/admin/overview', { scope: 'admin' }),
        apiRequest<{ users: AdminUserRow[] }>(`/api/admin/users?q=${encodeURIComponent(searchQuery)}`, { scope: 'admin' }),
        apiRequest<{ submissions: AdminSubmissionRow[] }>('/api/admin/submissions', { scope: 'admin' }),
        apiRequest<{ withdrawals: AdminWithdrawalRow[] }>('/api/admin/withdrawals', { scope: 'admin' }),
        apiRequest<{ tasks: AdminTaskRow[] }>('/api/admin/tasks', { scope: 'admin' }),
      ]);
      setOverview(ovRes);
      setUsers(usrRes.users);
      setSubmissions(subRes.submissions);
      setWithdrawals(wdrRes.withdrawals);
      setTasks(tskRes.tasks);

      setAppNameInput(ovRes.settings.appName);
      setWelcomeTitleInput(ovRes.settings.welcomeTitle);
      setWelcomeSubtitleInput(ovRes.settings.welcomeSubtitle);
      setAnnouncementInput(ovRes.settings.announcementText);
      setEarnTitleInput(ovRes.settings.earnTitle);
      setWithdrawLabelInput(ovRes.settings.withdrawMethodLabel);
      setTaskRewardInput(String(ovRes.settings.taskReward));
      setTasksEnabledInput(ovRes.settings.tasksEnabled);
      setMinWithdrawalInput(String(ovRes.settings.minWithdrawal));
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'অ্যাডমিন ডেটা লোড করতে ব্যর্থ হয়েছে।', 'error');
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (authStatus.authenticated) {
      loadAllAdminData();
    }
  }, [authStatus.authenticated]);

  async function handleAdminAuth(e: React.FormEvent) {
    e.preventDefault();
    if (authSubmitting) return;

    if (!authStatus.configured) {
      if (passcode.trim().length < 6) {
        onToast('অ্যাডমিন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।', 'error');
        return;
      }
      if (passcode !== confirmPasscode) {
        onToast('দুইটি পাসওয়ার্ড মেলেনি।', 'error');
        return;
      }
    }

    setAuthSubmitting(true);
    try {
      const endpoint = authStatus.configured ? '/api/admin/login' : '/api/admin/bootstrap';
      const res = await apiRequest<{ ok: boolean; token?: string }>(endpoint, {
        method: 'POST',
        body: { passcode },
        scope: 'admin',
      });
      if (res.token) setAdminToken(res.token);
      setPasscode('');
      setConfirmPasscode('');
      setAuthStatus({ loading: false, configured: true, authenticated: true });
      onToast('অ্যাডমিন প্যানেলে স্বাগতম!', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'অ্যাডমিন লগইন ব্যর্থ হয়েছে।', 'error');
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleAdminLogout() {
    await apiRequest('/api/admin/logout', { method: 'POST', scope: 'admin' }).catch(() => {});
    setAdminToken(null);
    setAuthStatus((prev) => ({ ...prev, authenticated: false }));
    onToast('অ্যাডমিন সেশন লগআউট হয়েছে।', 'info');
  }

  async function handleReviewSubmission(id: string, action: 'approve' | 'reject') {
    setActionId(id);
    try {
      await apiRequest(`/api/admin/submissions/${encodeURIComponent(id)}/review`, {
        method: 'POST',
        body: { action, adminNote: adminNotes[id] || '' },
        scope: 'admin',
      });
      onToast(action === 'approve' ? 'টাস্ক Done করা হয়েছে এবং ব্যালেন্স যোগ হয়েছে!' : 'টাস্ক বাতিল করা হয়েছে।', 'success');
      await loadAllAdminData();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'টাস্ক আপডেট ব্যর্থ হয়েছে।', 'error');
    } finally {
      setActionId(null);
    }
  }

  async function handleWithdrawalStatus(id: string, status: 'approved' | 'rejected' | 'paid') {
    setActionId(id);
    try {
      await apiRequest(`/api/admin/withdrawals/${encodeURIComponent(id)}/status`, {
        method: 'POST',
        body: { status, adminNote: adminNotes[id] || '' },
        scope: 'admin',
      });
      const msg =
        status === 'approved'
          ? 'উত্তোলন অনুমোদিত হয়েছে!'
          : status === 'paid'
            ? 'উইথড্র সাকসেস (Done) সম্পন্ন হয়েছে!'
            : 'উত্তোলন অনুরোধ বাতিল করা হয়েছে।';
      onToast(msg, 'success');
      await loadAllAdminData();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'স্ট্যাটাস আপডেট ব্যর্থ হয়েছে।', 'error');
    } finally {
      setActionId(null);
    }
  }

  async function handleUserSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    await loadAllAdminData(userSearch);
  }

  function startEditUser(u: AdminUserRow) {
    setEditingUser(u);
    setEditUserName(u.name);
    setEditUserEmail(u.email);
    setEditUserBalance(String(u.balance));
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser || savingUser) return;
    setSavingUser(true);
    try {
      await apiRequest(`/api/admin/users/${encodeURIComponent(editingUser.id)}`, {
        method: 'PATCH',
        body: {
          name: editUserName.trim(),
          email: editUserEmail.trim(),
          balance: Number(editUserBalance),
        },
        scope: 'admin',
      });
      onToast('ইউজারের তথ্য ও ব্যালেন্স আপডেট করা হয়েছে!', 'success');
      setEditingUser(null);
      await loadAllAdminData();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'ইউজার আপডেট ব্যর্থ হয়েছে।', 'error');
    } finally {
      setSavingUser(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (savingSettings) return;
    setSavingSettings(true);
    try {
      await apiRequest('/api/admin/settings', {
        method: 'PATCH',
        body: {
          appName: appNameInput.trim(),
          welcomeTitle: welcomeTitleInput.trim(),
          welcomeSubtitle: welcomeSubtitleInput.trim(),
          announcementText: announcementInput.trim(),
          earnTitle: earnTitleInput.trim(),
          withdrawMethodLabel: withdrawLabelInput.trim(),
          taskReward: Number(taskRewardInput),
          tasksEnabled: tasksEnabledInput,
          minWithdrawal: Number(minWithdrawalInput),
          applyRewardToAllTasks: applyToAllTasks,
        },
        scope: 'admin',
      });
      onToast('অ্যাপের সমস্ত সেটিংস ও টেক্সট আপডেট করা হয়েছে!', 'success');
      setApplyToAllTasks(false);
      await loadAllAdminData();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'সেটিংস সংরক্ষণ ব্যর্থ হয়েছে।', 'error');
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleUpdateTaskFull(
    taskId: string,
    updates: { title?: string; description?: string; instructions?: string; reward?: number; isActive?: boolean }
  ) {
    setActionId(taskId);
    try {
      await apiRequest(`/api/admin/tasks/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        body: updates,
        scope: 'admin',
      });
      onToast('টাস্ক সফলভাবে আপডেট হয়েছে!', 'success');
      await loadAllAdminData();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'টাস্ক আপডেট ব্যর্থ হয়েছে।', 'error');
    } finally {
      setActionId(null);
    }
  }

  async function handleDeleteTask(taskId: string) {
    setActionId(taskId);
    try {
      await apiRequest(`/api/admin/tasks/${encodeURIComponent(taskId)}`, {
        method: 'DELETE',
        scope: 'admin',
      });
      onToast('টাস্ক মুছে ফেলা হয়েছে।', 'info');
      await loadAllAdminData();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'টাস্ক ডিলিট ব্যর্থ হয়েছে।', 'error');
    } finally {
      setActionId(null);
    }
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (creatingTask) return;
    setCreatingTask(true);
    try {
      await apiRequest('/api/admin/tasks', {
        method: 'POST',
        body: {
          title: newTaskTitle.trim(),
          description: newTaskDesc.trim(),
          instructions: newTaskInst.trim(),
          reward: Number(newTaskReward),
        },
        scope: 'admin',
      });
      onToast('নতুন টাস্ক তৈরি হয়েছে!', 'success');
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskInst('');
      setNewTaskReward(taskRewardInput || '10');
      await loadAllAdminData();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'নতুন টাস্ক তৈরি করা যায়নি।', 'error');
    } finally {
      setCreatingTask(false);
    }
  }

  async function handleSendNotification(e: React.FormEvent) {
    e.preventDefault();
    if (sendingNotif) return;
    setSendingNotif(true);
    try {
      const res = await apiRequest<{ ok: boolean; sentCount: number }>('/api/admin/notifications/broadcast', {
        method: 'POST',
        body: {
          title: notifTitle.trim(),
          message: notifMessage.trim(),
          targetUserId: notifTargetUserId.trim() || undefined,
        },
        scope: 'admin',
      });
      onToast(`${res.sentCount} জন ইউজারের কাছে নোটিফিকেশন পাঠানো হয়েছে!`, 'success');
      setNotifTitle('');
      setNotifMessage('');
      setNotifTargetUserId('');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'নোটিফিকেশন পাঠানো যায়নি।', 'error');
    } finally {
      setSendingNotif(false);
    }
  }

  async function handleChangeAdminPasscode(e: React.FormEvent) {
    e.preventDefault();
    if (changingPass) return;
    setChangingPass(true);
    try {
      await apiRequest('/api/admin/change-passcode', {
        method: 'POST',
        body: { currentPasscode: currentAdminPass, newPasscode: newAdminPass },
        scope: 'admin',
      });
      onToast('অ্যাডমিন পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!', 'success');
      setCurrentAdminPass('');
      setNewAdminPass('');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'পাসওয়ার্ড পরিবর্তন করা যায়নি।', 'error');
    } finally {
      setChangingPass(false);
    }
  }

  if (authStatus.loading) {
    return (
      <div className="min-h-screen bg-[#060B18] flex items-center justify-center text-slate-300">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!authStatus.authenticated) {
    return (
      <div className="min-h-screen bg-[#060B18] text-slate-100 flex flex-col">
        <header className="border-b border-blue-950/70 bg-[#080F21]">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <button
              type="button"
              onClick={onBackToApp}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white min-h-[40px]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>ইউজার অ্যাপে ফিরুন</span>
            </button>
            <span className="text-sm font-bold text-white">Task Money BD Admin</span>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#0D1730] border border-blue-900/50 p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">
                  {authStatus.configured ? 'অ্যাডমিন প্যানেল আনলক' : 'প্রথমবার অ্যাডমিন পাসওয়ার্ড সেটআপ'}
                </h1>
                <p className="text-xs text-slate-400">
                  {authStatus.configured
                    ? 'সবকিছু এডিট ও পরিচালনা করতে অ্যাডমিন পাসওয়ার্ড দিন।'
                    : 'অ্যাডমিন অ্যাক্সেস সুরক্ষিত করতে আপনার পছন্দের পাসওয়ার্ড সেট করুন।'}
                </p>
              </div>
            </div>

            <form onSubmit={handleAdminAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  {authStatus.configured ? 'অ্যাডমিন পাসওয়ার্ড' : 'নতুন অ্যাডমিন পাসওয়ার্ড'}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="কমপক্ষে ৬ অক্ষর"
                  className="w-full min-h-[46px] px-4 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {!authStatus.configured && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">পাসওয়ার্ড নিশ্চিত করুন</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPasscode}
                    onChange={(e) => setConfirmPasscode(e.target.value)}
                    placeholder="আবার লিখুন"
                    className="w-full min-h-[46px] px-4 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full min-h-[48px] rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                {authSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                <span>{authStatus.configured ? 'আনলক করুন' : 'পাসওয়ার্ড সেট করে প্রবেশ করুন'}</span>
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060B18] text-slate-100 pb-12">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-blue-950 bg-[#080F21]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBackToApp}
              className="min-h-[40px] px-3 rounded-lg bg-[#0D1730] border border-blue-900/50 text-xs font-medium text-slate-300 hover:text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>অ্যাপ</span>
            </button>
            <h1 className="text-sm sm:text-base font-bold text-white truncate">
              {overview?.settings.appName || 'Task Money BD'} অ্যাডমিন
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => loadAllAdminData()}
              disabled={loadingData}
              className="min-h-[40px] px-3 rounded-lg bg-[#0D1730] border border-blue-900/50 text-xs font-medium text-slate-300 hover:text-white inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">রিফ্রেশ</span>
            </button>
            <button
              type="button"
              onClick={handleAdminLogout}
              className="min-h-[40px] px-3 rounded-lg bg-rose-950/50 border border-rose-500/30 text-xs font-semibold text-rose-300 hover:bg-rose-900/50 inline-flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>লগআউট</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Overview Statistics */}
        {overview && (
          <section className="space-y-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 rounded-2xl bg-[#0D1730] border border-blue-900/40">
                <p className="text-xs text-slate-400">মোট নিবন্ধিত ইউজার</p>
                <p className="text-2xl font-bold text-white tabular-nums mt-1">{overview.stats.totalUsers} জন</p>
                <p className="text-xs text-slate-400 mt-1 tabular-nums">মোট ব্যালেন্স {formatBDT(overview.stats.totalUserBalance)}</p>
              </div>
              <div className="p-4 rounded-2xl bg-[#0D1730] border border-blue-900/40">
                <p className="text-xs text-slate-400">অপেক্ষমান জিমেইল রিভিউ</p>
                <p className="text-2xl font-bold text-amber-400 tabular-nums mt-1">{overview.stats.pendingSubmissions}টি</p>
                <p className="text-xs text-slate-400 mt-1 tabular-nums">Done {overview.stats.approvedSubmissions}টি · বাতিল {overview.stats.rejectedSubmissions}টি</p>
              </div>
              <div className="p-4 rounded-2xl bg-[#0D1730] border border-blue-900/40">
                <p className="text-xs text-slate-400">অপেক্ষমান উত্তোলন</p>
                <p className="text-2xl font-bold text-blue-400 tabular-nums mt-1">{overview.stats.pendingWithdrawals}টি</p>
                <p className="text-xs text-slate-400 mt-1 tabular-nums">অনুমোদিত {overview.stats.approvedWithdrawals}টি</p>
              </div>
              <div className="p-4 rounded-2xl bg-[#0D1730] border border-blue-900/40">
                <p className="text-xs text-slate-400">মোট পরিশোধিত (Done)</p>
                <p className="text-2xl font-bold text-emerald-400 tabular-nums mt-1">{formatBDT(overview.stats.totalPaidAmount)}</p>
                <p className="text-xs text-slate-400 mt-1 tabular-nums">মোট {overview.stats.paidWithdrawals}টি পেমেন্ট</p>
              </div>
            </div>

            <div className="px-4 py-3 rounded-xl bg-[#0B142B] border border-blue-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Send className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  টেলিগ্রাম অ্যাডমিন আইডি: <span className="font-mono text-white">{overview.telegramAdminIds.join(', ')}</span>
                </span>
              </div>
              <span className={overview.telegramConfigured ? 'text-emerald-400 font-semibold' : 'text-amber-300 font-semibold'}>
                {overview.telegramConfigured
                  ? 'Telegram Bot সক্রিয় (Done বাটন সহ)'
                  : 'TELEGRAM_BOT_TOKEN সেট করা হয়নি (সার্ভার Secrets-এ যোগ করুন)'}
              </span>
            </div>
          </section>
        )}

        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto gap-1.5 p-1 rounded-xl bg-[#0B142B] border border-blue-900/40">
          <button
            type="button"
            onClick={() => setTab('withdrawals')}
            className={`min-h-[44px] px-4 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
              tab === 'withdrawals' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>উত্তোলন অনুরোধ ({withdrawals.filter((w) => w.status === 'pending').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('submissions')}
            className={`min-h-[44px] px-4 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
              tab === 'submissions' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>জমাকৃত জিমেইল ({submissions.filter((s) => s.status === 'pending').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('users')}
            className={`min-h-[44px] px-4 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
              tab === 'users' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>ইউজার এডিট ({users.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('tasks')}
            className={`min-h-[44px] px-4 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
              tab === 'tasks' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>সবকিছু এডিট ও সেটিংস</span>
          </button>
        </div>

        {/* Tab 1: Withdrawals Management */}
        {tab === 'withdrawals' && (
          <section className="space-y-3">
            {withdrawals.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#0D1730] border border-blue-900/40 text-center text-sm text-slate-400">
                কোনো উত্তোলন অনুরোধ পাওয়া যায়নি।
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {withdrawals.map((w) => {
                  const isFinal = w.status === 'paid' || w.status === 'rejected';
                  return (
                    <div key={w.id} className="p-5 rounded-2xl bg-[#0D1730] border border-blue-900/40 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-slate-400">{w.id}</span>
                        <StatusLabel status={w.status} context="withdrawal" />
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-bold text-white">{w.user_name}</p>
                          <p className="text-xs font-mono text-blue-300">
                            {w.user_id} · বর্তমান ব্যালেন্স {formatBDT(w.user_balance)}
                          </p>
                          <p className="text-sm font-mono text-pink-400 mt-1">bKash: {w.bkash_number}</p>
                        </div>
                        <p className="text-2xl font-bold text-emerald-400 tabular-nums">{formatBDT(w.amount)}</p>
                      </div>
                      <p className="text-xs text-slate-400">{formatBanglaDate(w.created_at)}</p>

                      {!isFinal && (
                        <div className="pt-3 border-t border-blue-900/40 space-y-2.5">
                          <input
                            type="text"
                            placeholder="অ্যাডমিন নোট / ট্রানজেকশন আইডি (ঐচ্ছিক)"
                            value={adminNotes[w.id] ?? ''}
                            onChange={(e) => setAdminNotes((prev) => ({ ...prev, [w.id]: e.target.value }))}
                            className="w-full min-h-[40px] px-3 rounded-lg bg-[#070D1D] border border-blue-950 text-xs text-white placeholder-slate-500"
                          />
                          <div className="flex flex-wrap gap-2">
                            {w.status === 'pending' && (
                              <button
                                type="button"
                                disabled={actionId === w.id}
                                onClick={() => handleWithdrawalStatus(w.id, 'approved')}
                                className="flex-1 min-h-[42px] px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>অনুমোদন</span>
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={actionId === w.id}
                              onClick={() => handleWithdrawalStatus(w.id, 'paid')}
                              className="flex-1 min-h-[42px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              <span>Done (উইথড্র সাকসেস)</span>
                            </button>
                            <button
                              type="button"
                              disabled={actionId === w.id}
                              onClick={() => handleWithdrawalStatus(w.id, 'rejected')}
                              className="min-h-[42px] px-3 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/30 text-rose-300 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>বাতিল</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Tab 2: Task Submissions Management */}
        {tab === 'submissions' && (
          <section className="space-y-3">
            {submissions.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#0D1730] border border-blue-900/40 text-center text-sm text-slate-400">
                এখনো কোনো জিমেইল জমা হয়নি।
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {submissions.map((s) => (
                  <div key={s.id} className="p-5 rounded-2xl bg-[#0D1730] border border-blue-900/40 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono text-slate-400">{s.id} · {s.task_id}</span>
                      <StatusLabel status={s.status} context="task" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{s.task_title}</p>
                      <p className="text-xs text-blue-300 mt-0.5">
                        ইউজার: {s.user_name} ({s.user_id})
                      </p>
                      <p className="text-xs text-slate-300 mt-1">
                        জমাকৃত জিমেইল: <span className="font-mono text-white">{s.submitted_email}</span>
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#070D1D] border border-blue-950 text-xs text-slate-300 whitespace-pre-wrap">
                      {s.proof_text}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{formatBanglaDate(s.created_at)}</span>
                      <span className="text-emerald-400 font-bold tabular-nums">পুরস্কার {formatBDT(s.reward_amount)}</span>
                    </div>

                    {s.status === 'pending' && (
                      <div className="pt-3 border-t border-blue-900/40 space-y-2.5">
                        <input
                          type="text"
                          placeholder="অ্যাডমিন নোট (ঐচ্ছিক)"
                          value={adminNotes[s.id] ?? ''}
                          onChange={(e) => setAdminNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
                          className="w-full min-h-[40px] px-3 rounded-lg bg-[#070D1D] border border-blue-950 text-xs text-white placeholder-slate-500"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={actionId === s.id}
                            onClick={() => handleReviewSubmission(s.id, 'approve')}
                            className="flex-1 min-h-[42px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Done ({formatBDT(s.reward_amount)})</span>
                          </button>
                          <button
                            type="button"
                            disabled={actionId === s.id}
                            onClick={() => handleReviewSubmission(s.id, 'reject')}
                            className="flex-1 min-h-[42px] px-3 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/30 text-rose-300 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>বাতিল</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab 3: Users Management, Search & Edit */}
        {tab === 'users' && (
          <section className="space-y-4">
            <form onSubmit={handleUserSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="ইউজার আইডি (যেমন: TM-123456), নাম বা ইমেইল দিয়ে খুঁজুন..."
                  className="w-full min-h-[46px] pl-10 pr-4 rounded-xl bg-[#0D1730] border border-blue-900/50 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                className="min-h-[46px] px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold whitespace-nowrap"
              >
                খুঁজুন
              </button>
            </form>

            {editingUser && (
              <form onSubmit={handleSaveUser} className="p-5 rounded-2xl bg-[#0F1C3D] border border-blue-500/40 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    ইউজার এডিট করুন ({editingUser.id})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="w-8 h-8 rounded-lg hover:bg-blue-950 flex items-center justify-center text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">নাম</label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={editUserName}
                      onChange={(e) => setEditUserName(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-lg bg-[#070D1D] border border-blue-900/60 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">ইমেইল</label>
                    <input
                      type="email"
                      required
                      value={editUserEmail}
                      onChange={(e) => setEditUserEmail(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-lg bg-[#070D1D] border border-blue-900/60 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">ব্যালেন্স (৳)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={1000000}
                      value={editUserBalance}
                      onChange={(e) => setEditUserBalance(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-lg bg-[#070D1D] border border-blue-900/60 text-sm font-mono text-white"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={savingUser}
                    className="min-h-[42px] px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingUser ? 'সেভ হচ্ছে...' : 'পরিবর্তন সেভ করুন'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="min-h-[42px] px-4 rounded-lg bg-[#070D1D] border border-blue-900/60 text-xs text-slate-300"
                  >
                    বাতিল
                  </button>
                </div>
              </form>
            )}

            <div className="rounded-2xl bg-[#0D1730] border border-blue-900/40 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-blue-900/40 text-xs text-slate-400 bg-[#0A1328]">
                      <th className="py-3.5 px-4 font-semibold">ইউজার আইডি</th>
                      <th className="py-3.5 px-4 font-semibold">নাম ও ইমেইল</th>
                      <th className="py-3.5 px-4 font-semibold text-right">ব্যালেন্স</th>
                      <th className="py-3.5 px-4 font-semibold text-right">টাস্ক</th>
                      <th className="py-3.5 px-4 font-semibold text-right">উত্তোলন</th>
                      <th className="py-3.5 px-4 font-semibold text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-900/30 text-sm">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          কোনো ইউজার পাওয়া যায়নি।
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u.id} className="hover:bg-[#111D3D]/50">
                          <td className="py-3 px-4 font-mono text-xs text-blue-300 whitespace-nowrap">{u.id}</td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-white">{u.name}</p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-400 tabular-nums whitespace-nowrap">
                            {formatBDT(u.balance)}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-200 tabular-nums whitespace-nowrap">
                            {u.completed_tasks}টি
                          </td>
                          <td className="py-3 px-4 text-right text-slate-200 tabular-nums whitespace-nowrap">
                            {formatBDT(u.total_withdrawn)}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => startEditUser(u)}
                              className="min-h-[34px] px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-xs font-semibold text-blue-300 inline-flex items-center gap-1"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>এডিট</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Tab 4: Edit Everything in App (Branding, Texts, Rewards, Tasks, Notifications, Passcode) */}
        {tab === 'tasks' && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-6 space-y-6">
              {/* Full App Content & Settings Editor */}
              <form onSubmit={handleSaveSettings} className="p-5 rounded-2xl bg-[#0D1730] border border-blue-900/40 space-y-4">
                <h2 className="text-base font-bold text-white">অ্যাপের নাম, লেখা ও পেমেন্ট সেটিংস এডিট</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">অ্যাপের নাম</label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={appNameInput}
                      onChange={(e) => setAppNameInput(e.target.value)}
                      className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">পেমেন্ট মাধ্যম লেবেল</label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={withdrawLabelInput}
                      onChange={(e) => setWithdrawLabelInput(e.target.value)}
                      className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">হোমপেজ স্বাগতম শিরোনাম</label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={welcomeTitleInput}
                    onChange={(e) => setWelcomeTitleInput(e.target.value)}
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">হোমপেজ বিবরণ</label>
                  <textarea
                    rows={2}
                    required
                    minLength={3}
                    value={welcomeSubtitleInput}
                    onChange={(e) => setWelcomeSubtitleInput(e.target.value)}
                    className="w-full p-3 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Earn পেজের শিরোনাম</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={earnTitleInput}
                    onChange={(e) => setEarnTitleInput(e.target.value)}
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    হোমপেজ নোটিশ ব্যানার <span className="text-slate-500">(খালি রাখলে দেখাবে না)</span>
                  </label>
                  <input
                    type="text"
                    value={announcementInput}
                    onChange={(e) => setAnnouncementInput(e.target.value)}
                    placeholder="যেমন: আজকের পেমেন্ট সন্ধ্যা ৬টার মধ্যে পাঠানো হবে"
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">ডিফল্ট টাস্ক পুরস্কার (৳)</label>
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      value={taskRewardInput}
                      onChange={(e) => setTaskRewardInput(e.target.value)}
                      className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">সর্বনিম্ন উত্তোলন (৳)</label>
                    <input
                      type="number"
                      min={10}
                      max={10000}
                      value={minWithdrawalInput}
                      onChange={(e) => setMinWithdrawalInput(e.target.value)}
                      className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white font-mono"
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between p-3 rounded-xl bg-[#070D1D] border border-blue-950 cursor-pointer">
                  <span className="text-sm text-slate-200">নতুন টাস্ক / Earn জমা চালু রাখুন</span>
                  <input
                    type="checkbox"
                    checked={tasksEnabledInput}
                    onChange={(e) => setTasksEnabledInput(e.target.checked)}
                    className="w-5 h-5 accent-blue-600"
                  />
                </label>

                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToAllTasks}
                    onChange={(e) => setApplyToAllTasks(e.target.checked)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span>সব বিদ্যমান টাস্কে নতুন পুরস্কারের পরিমাণ প্রয়োগ করুন</span>
                </label>

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="w-full min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2"
                >
                  {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>সব সেটিংস সংরক্ষণ করুন</span>
                </button>
              </form>

              {/* Send Notification Broadcast */}
              <form onSubmit={handleSendNotification} className="p-5 rounded-2xl bg-[#0D1730] border border-blue-900/40 space-y-4">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-blue-400" />
                  <h2 className="text-base font-bold text-white">ইউজারদের নোটিফিকেশন পাঠান</h2>
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">টার্গেট ইউজার আইডি (সবাইকে পাঠাতে খালি রাখুন)</label>
                  <input
                    type="text"
                    value={notifTargetUserId}
                    onChange={(e) => setNotifTargetUserId(e.target.value)}
                    placeholder="TM-123456 অথবা খালি রাখুন"
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">নোটিশের শিরোনাম</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    placeholder="গুরুত্বপূর্ণ ঘোষণা"
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">বার্তা</label>
                  <textarea
                    required
                    rows={2}
                    minLength={3}
                    value={notifMessage}
                    onChange={(e) => setNotifMessage(e.target.value)}
                    placeholder="ইউজারদের উদ্দেশ্যে আপনার বার্তা লিখুন..."
                    className="w-full p-3 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={sendingNotif}
                  className="w-full min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{sendingNotif ? 'পাঠানো হচ্ছে...' : 'নোটিফিকেশন পাঠান'}</span>
                </button>
              </form>

              {/* Change Admin Passcode */}
              {overview && !overview.usingEnvPasscode && (
                <form onSubmit={handleChangeAdminPasscode} className="p-5 rounded-2xl bg-[#0D1730] border border-blue-900/40 space-y-3">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-blue-400" />
                    <h2 className="text-base font-bold text-white">অ্যাডমিন পাসওয়ার্ড পরিবর্তন</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={currentAdminPass}
                      onChange={(e) => setCurrentAdminPass(e.target.value)}
                      placeholder="বর্তমান পাসওয়ার্ড"
                      className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white text-sm"
                    />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newAdminPass}
                      onChange={(e) => setNewAdminPass(e.target.value)}
                      placeholder="নতুন পাসওয়ার্ড (৬+ অক্ষর)"
                      className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={changingPass}
                    className="min-h-[42px] px-4 rounded-xl bg-[#070D1D] hover:bg-[#111D3D] border border-blue-800/60 text-xs font-semibold text-white"
                  >
                    {changingPass ? 'আপডেট হচ্ছে...' : 'পাসওয়ার্ড আপডেট করুন'}
                  </button>
                </form>
              )}
            </div>

            {/* Tasks Management (Create + Full Edit + Delete) */}
            <div className="lg:col-span-6 space-y-6">
              <form onSubmit={handleCreateTask} className="p-5 rounded-2xl bg-[#0D1730] border border-blue-900/40 space-y-4">
                <h2 className="text-base font-bold text-white">নতুন টাস্ক / Earn আইটেম যোগ করুন</h2>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">টাস্কের শিরোনাম</label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="যেমন: নতুন জিমেইল অ্যাকাউন্ট টাস্ক"
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">সংক্ষিপ্ত বিবরণ</label>
                  <textarea
                    required
                    rows={2}
                    minLength={5}
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                    placeholder="টাস্ক সম্পর্কে সংক্ষিপ্ত বর্ণনা..."
                    className="w-full p-3 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">কাজের নির্দেশনা</label>
                  <textarea
                    required
                    rows={2}
                    minLength={5}
                    value={newTaskInst}
                    onChange={(e) => setNewTaskInst(e.target.value)}
                    placeholder="ধাপে ধাপে নির্দেশনা..."
                    className="w-full p-3 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">টাস্ক পুরস্কার (৳)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={5000}
                    value={newTaskReward}
                    onChange={(e) => setNewTaskReward(e.target.value)}
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creatingTask}
                  className="w-full min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>নতুন টাস্ক প্রকাশ করুন</span>
                </button>
              </form>

              <div className="space-y-3">
                <h2 className="text-base font-bold text-white">সব টাস্ক এডিট ও নিয়ন্ত্রণ ({tasks.length}টি)</h2>
                {tasks.map((t) => (
                  <TaskAdminRowItem
                    key={t.id}
                    task={t}
                    busy={actionId === t.id}
                    onUpdate={(updates) => handleUpdateTaskFull(t.id, updates)}
                    onDelete={() => handleDeleteTask(t.id)}
                  />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function TaskAdminRowItem({
  task,
  busy,
  onUpdate,
  onDelete,
}: {
  task: AdminTaskRow;
  busy: boolean;
  onUpdate: (updates: { title?: string; description?: string; instructions?: string; reward?: number; isActive?: boolean }) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [titleVal, setTitleVal] = useState(task.title);
  const [descVal, setDescVal] = useState(task.description);
  const [instVal, setInstVal] = useState(task.instructions);
  const [rewardVal, setRewardVal] = useState(String(task.reward));

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#0D1730] border border-blue-900/40 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-mono text-slate-400">{task.id}</span>
          <h3 className="text-sm sm:text-base font-bold text-white mt-0.5">{task.title}</h3>
          <p className="text-xs text-slate-400 mt-1">{task.description}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={() => onUpdate({ isActive: task.is_active !== 1 })}
            className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap border ${
              task.is_active === 1
                ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
          >
            {task.is_active === 1 ? 'সক্রিয়' : 'বন্ধ'}
          </button>
          <button
            type="button"
            onClick={() => setEditing((p) => !p)}
            aria-label="টাস্ক এডিট করুন"
            className="min-h-[36px] min-w-[36px] rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 flex items-center justify-center"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            aria-label="টাস্ক মুছুন"
            className="min-h-[36px] min-w-[36px] rounded-lg bg-rose-950/50 border border-rose-500/30 text-rose-300 flex items-center justify-center"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="pt-3 border-t border-blue-900/40 space-y-2.5">
          <input
            type="text"
            value={titleVal}
            onChange={(e) => setTitleVal(e.target.value)}
            placeholder="শিরোনাম"
            className="w-full min-h-[40px] px-3 rounded-lg bg-[#070D1D] border border-blue-900/60 text-xs text-white"
          />
          <textarea
            rows={2}
            value={descVal}
            onChange={(e) => setDescVal(e.target.value)}
            placeholder="বিবরণ"
            className="w-full p-2.5 rounded-lg bg-[#070D1D] border border-blue-900/60 text-xs text-white"
          />
          <textarea
            rows={2}
            value={instVal}
            onChange={(e) => setInstVal(e.target.value)}
            placeholder="নির্দেশনা"
            className="w-full p-2.5 rounded-lg bg-[#070D1D] border border-blue-900/60 text-xs text-white"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={5000}
              value={rewardVal}
              onChange={(e) => setRewardVal(e.target.value)}
              className="w-24 min-h-[38px] px-3 rounded-lg bg-[#070D1D] border border-blue-900/60 text-xs font-mono text-white"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onUpdate({
                  title: titleVal,
                  description: descVal,
                  instructions: instVal,
                  reward: Number(rewardVal),
                });
                setEditing(false);
              }}
              className="min-h-[38px] px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
            >
              সেভ করুন
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="min-h-[38px] px-3 rounded-lg bg-[#070D1D] border border-blue-900/60 text-xs text-slate-300"
            >
              বাতিল
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-blue-900/40">
          <span>পুরস্কার: <strong className="text-emerald-400 font-mono">{formatBDT(task.reward)}</strong></span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-blue-400 hover:text-blue-300 font-medium"
          >
            বিস্তারিত এডিট করুন
          </button>
        </div>
      )}
    </div>
  );
}
