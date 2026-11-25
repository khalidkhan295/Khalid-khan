import React from 'react';
import { Wallet, CheckCircle2, ArrowDownToLine, ListChecks, ChevronRight, Users, Sparkles } from 'lucide-react';
import { UserProfile, PlatformSettings, TaskItem, UserTab } from '../types';
import { formatBDT } from './ToastAndUtils';

interface HomeViewProps {
  user: UserProfile;
  settings: PlatformSettings;
  tasks: TaskItem[];
  onNavigate: (tab: UserTab) => void;
  onSelectTask: (taskId: string) => void;
}

export function HomeView({
  user,
  settings,
  tasks,
  onNavigate,
  onSelectTask,
}: HomeViewProps) {
  return (
    <div className="space-y-6">
      {/* Welcome & Balance Hero Card */}
      <section className="relative rounded-2xl overflow-hidden border border-blue-800/40 bg-[#0D1730]">
        <img
          src="/src/assets/images/hero_task_wallet_1795593805865.jpg"
          alt="ব্যালেন্স ড্যাশবোর্ড"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#081026]/95 via-[#0B1738]/85 to-blue-900/60" />

        <div className="relative p-5 sm:p-7 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <p className="text-xs sm:text-sm font-medium text-blue-300">
              স্বাগতম, {user.name} · আইডি {user.id}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight [text-wrap:balance]">
              {settings.welcomeTitle}
            </h1>
            <p className="text-sm text-slate-300">
              {settings.welcomeSubtitle}
            </p>
            {settings.announcementText ? (
              <p className="mt-2 px-3.5 py-2 rounded-xl bg-blue-950/70 border border-blue-500/35 text-xs sm:text-sm text-blue-100">
                📢 {settings.announcementText}
              </p>
            ) : null}
          </div>

          <div className="p-5 rounded-2xl bg-[#070E20]/85 border border-blue-500/30 backdrop-blur-md min-w-[240px]">
            <div className="flex items-center justify-between gap-4 mb-1">
              <span className="text-xs font-medium text-slate-300">মোট ব্যালেন্স</span>
              <Wallet className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-white tabular-nums tracking-tight">
              {formatBDT(user.balance)}
            </p>
            <div className="mt-3 pt-3 border-t border-blue-900/50 flex items-center justify-between text-xs">
              <span className="text-slate-400">উত্তোলনযোগ্য ব্যালেন্স</span>
              <span className="font-semibold text-emerald-400 tabular-nums">{formatBDT(user.availableBalance)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Core Metrics Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0D1730] border border-blue-900/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-slate-400">মোট ব্যালেন্স</span>
            <Wallet className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white tabular-nums">{formatBDT(user.balance)}</p>
          <p className="text-xs text-slate-400 mt-1">মোট আয় {formatBDT(user.totalEarnings)}</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#0D1730] border border-blue-900/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-slate-400">সম্পন্ন টাস্ক</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-emerald-400 tabular-nums">{user.completedTasks}টি</p>
          <p className="text-xs text-slate-400 mt-1">অপেক্ষমান {user.pendingTasks}টি</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#0D1730] border border-blue-900/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-slate-400">মোট উত্তোলন</span>
            <ArrowDownToLine className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white tabular-nums">{formatBDT(user.totalWithdrawn)}</p>
          <p className="text-xs text-slate-400 mt-1">সর্বনিম্ন {formatBDT(settings.minWithdrawal)}</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#0D1730] border border-blue-900/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-slate-400">উপলব্ধ টাস্ক</span>
            <ListChecks className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-blue-400 tabular-nums">
            {settings.tasksEnabled ? tasks.filter((t) => !t.alreadySubmitted).length : 0}টি
          </p>
          <p className="text-xs text-slate-400 mt-1">প্রতি টাস্ক {formatBDT(settings.taskReward)}</p>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => onNavigate('tasks')}
          className="min-h-[56px] px-4 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center justify-between transition-colors shadow-md shadow-blue-950/40"
        >
          <span className="flex items-center gap-2.5">
            <ListChecks className="w-5 h-5" />
            <span>Earn — জিমেইল জমা দিন</span>
          </span>
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('withdraw')}
          className="min-h-[56px] px-4 py-3.5 rounded-xl bg-[#0D1730] hover:bg-[#132042] border border-blue-800/50 text-white font-semibold text-sm flex items-center justify-between transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <ArrowDownToLine className="w-5 h-5 text-emerald-400" />
            <span>বিকাশে টাকা উত্তোলন</span>
          </span>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('refer')}
          className="min-h-[56px] px-4 py-3.5 rounded-xl bg-[#0D1730] hover:bg-[#132042] border border-blue-800/50 text-white font-semibold text-sm flex items-center justify-between transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-blue-400" />
            <span>বন্ধুদের আমন্ত্রণ ({user.invitedUsers})</span>
          </span>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </section>

      {/* Earn Preview */}
      <section className="rounded-2xl bg-[#0D1730] border border-blue-900/40 overflow-hidden">
        <div className="px-5 py-4 border-b border-blue-900/40 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">Earn অপশন সমূহ</h2>
            <p className="text-xs text-slate-400">প্রতিটি কাজ সম্পন্ন হলে আয় করুন</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('tasks')}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 min-h-[40px] px-2 flex items-center gap-1 whitespace-nowrap"
          >
            <span>Earn পেজে যান</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {!settings.tasksEnabled ? (
          <div className="p-6 text-center text-sm text-slate-400">
            এই মুহূর্তে অ্যাডমিন কর্তৃক নতুন টাস্ক সাময়িকভাবে বন্ধ রাখা হয়েছে।
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">
            বর্তমানে কোনো সক্রিয় টাস্ক নেই। পরে আবার দেখুন।
          </div>
        ) : (
          <div className="divide-y divide-blue-900/30">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#111D3D]/60 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{task.id}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-400 font-semibold tabular-nums">পুরস্কার {formatBDT(task.reward)}</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-white">{task.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-400 line-clamp-2">{task.description}</p>
                </div>

                <div className="shrink-0">
                  {task.alreadySubmitted ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 px-3 py-2 rounded-lg bg-[#080F21] border border-blue-950">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>ইতিমধ্যে জমা দেওয়া হয়েছে</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectTask(task.id)}
                      className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>টাস্ক শুরু করুন</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
