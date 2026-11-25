import React, { useState, useEffect } from 'react';
import { ShieldAlert, Send, Loader2, ClipboardList, Mail } from 'lucide-react';
import { apiRequest } from '../api';
import { TaskItem, TaskSubmission } from '../types';
import { formatBDT, formatBanglaDate, StatusLabel } from './ToastAndUtils';

interface TasksViewProps {
  tasks: TaskItem[];
  submissions: TaskSubmission[];
  tasksEnabled: boolean;
  defaultReward: number;
  earnTitle?: string;
  selectedTaskId: string;
  onSelectTaskId: (id: string) => void;
  onSubmitted: () => Promise<void>;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export function TasksView({
  tasks,
  submissions,
  tasksEnabled,
  defaultReward,
  earnTitle = 'Earn — জিমেইল টাস্ক ও আয়',
  selectedTaskId,
  onSelectTaskId,
  onSubmitted,
  onToast,
}: TasksViewProps) {
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [proofText, setProofText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const availableTasks = tasks.filter((t) => !t.alreadySubmitted);

  useEffect(() => {
    if (selectedTaskId && tasks.some((t) => t.id === selectedTaskId && !t.alreadySubmitted)) {
      return;
    }
    if (availableTasks.length > 0) {
      onSelectTaskId(availableTasks[0].id);
    }
  }, [tasks, selectedTaskId]);

  const activeTask = tasks.find((t) => t.id === selectedTaskId) || availableTasks[0] || null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !tasksEnabled) return;

    setSubmitting(true);
    try {
      const res = await apiRequest<{ ok: boolean; message: string }>('/api/tasks/submit', {
        method: 'POST',
        body: {
          taskId: activeTask?.id || 'TASK-EARN',
          submittedEmail: submittedEmail.trim(),
          proofText: proofText.trim() || 'জিমেইল টাস্ক সম্পন্ন হয়েছে',
        },
      });
      onToast(res.message, 'success');
      setSubmittedEmail('');
      setProofText('');
      await onSubmitted();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'জমা দিতে ব্যর্থ হয়েছে।', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">{earnTitle}</h1>
          <p className="text-sm text-slate-400">
            প্রতিটি অনুমোদিত কাজের জন্য <span className="text-emerald-400 font-semibold tabular-nums">{formatBDT(activeTask?.reward ?? defaultReward)}</span> আপনার ব্যালেন্সে যোগ হবে।
          </p>
        </div>
      </div>

      {/* Security Notice - Never collect Gmail passwords */}
      <div className="p-4 rounded-2xl bg-[#0D1A38] border border-blue-500/35 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-slate-200 leading-relaxed">
          <p className="font-semibold text-white mb-0.5">নিরাপত্তা নির্দেশিকা</p>
          <p className="text-slate-300">
            আপনার অ্যাকাউন্টের নিরাপত্তার জন্য কখনোই জিমেইলের পাসওয়ার্ড, OTP বা রিকভারি কোড দেবেন না। শুধুমাত্র আপনার জিমেইল ঠিকানা এবং কাজের প্রমাণ/বিবরণ জমা দিন।
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Earn Submission Form */}
        <div className="lg:col-span-6">
          <div className="rounded-2xl bg-[#0D1730] border border-blue-900/40 p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-blue-900/40 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Earn টাস্ক জমা ফর্ম</h2>
                  <p className="text-xs text-slate-400">অ্যাডমিন Done করলে ব্যালেন্স যুক্ত হবে</p>
                </div>
              </div>
              <span className="text-sm font-bold text-emerald-400 tabular-nums">
                {formatBDT(activeTask?.reward ?? defaultReward)}
              </span>
            </div>

            {!tasksEnabled ? (
              <div className="p-4 rounded-xl bg-[#070D1D] border border-blue-950 text-sm text-amber-300">
                বর্তমানে নতুন টাস্ক জমা নেওয়া সাময়িকভাবে বন্ধ আছে।
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {tasks.length > 1 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">টাস্ক নির্বাচন করুন</label>
                    <select
                      value={activeTask?.id || 'TASK-EARN'}
                      onChange={(e) => onSelectTaskId(e.target.value)}
                      className="w-full min-h-[46px] px-4 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white focus:outline-none focus:border-blue-500"
                    >
                      {tasks.map((t) => (
                        <option key={t.id} value={t.id} disabled={t.alreadySubmitted}>
                          {t.title} ({formatBDT(t.reward)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    জিমেইল ঠিকানা (Gmail Address)
                  </label>
                  <input
                    type="email"
                    required
                    value={submittedEmail}
                    onChange={(e) => setSubmittedEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className="w-full min-h-[48px] px-4 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    কাজের প্রমাণ / নোট <span className="text-slate-500 font-normal">(পাসওয়ার্ড ছাড়া)</span>
                  </label>
                  <textarea
                    rows={3}
                    maxLength={800}
                    value={proofText}
                    onChange={(e) => setProofText(e.target.value)}
                    placeholder="কাজটি সম্পন্ন করার বিবরণ বা সময় লিখুন..."
                    className="w-full p-4 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-y"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[48px] rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-950/40"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>জমা দেওয়া হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>সাবমিট করুন ({formatBDT(activeTask?.reward ?? defaultReward)})</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Submission History */}
        <div className="lg:col-span-6 rounded-2xl bg-[#0D1730] border border-blue-900/40 overflow-hidden">
          <div className="px-5 py-4 border-b border-blue-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-blue-400" />
              <h2 className="text-base font-bold text-white">জমা দেওয়া কাজের তালিকা</h2>
            </div>
            <span className="text-xs text-slate-400 tabular-nums">{submissions.length}টি</span>
          </div>

          {submissions.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              আপনি এখনো কোনো জিমেইল জমা দেননি। পাশের ফর্ম থেকে জমা দিন।
            </div>
          ) : (
            <div className="divide-y divide-blue-900/30">
              {submissions.map((sub) => (
                <div key={sub.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-slate-400 tabular-nums">{sub.id}</span>
                    <StatusLabel status={sub.status} context="task" />
                  </div>
                  <p className="text-sm font-semibold text-white font-mono">{sub.submitted_email}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                    <span className="text-emerald-400 font-semibold tabular-nums">{formatBDT(sub.reward_amount)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatBanglaDate(sub.created_at)}</span>
                  </div>
                  {sub.admin_note && (
                    <p className="text-xs text-amber-300 bg-[#070D1D] px-3 py-2 rounded-lg border border-blue-950">
                      অ্যাডমিন নোট: {sub.admin_note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
