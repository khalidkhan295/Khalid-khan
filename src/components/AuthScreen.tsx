import React, { useState, useEffect } from 'react';
import { Wallet, CheckSquare, ShieldCheck, ArrowRight, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { apiRequest, setUserToken } from '../api';
import { MeResponse } from '../types';
import { formatBDT } from './ToastAndUtils';

interface AuthScreenProps {
  initialRefCode?: string;
  onAuthenticated: (data: MeResponse) => void;
  onOpenAdmin: () => void;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export function AuthScreen({
  initialRefCode = '',
  onAuthenticated,
  onOpenAdmin,
  onToast,
}: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialRefCode ? 'register' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState(initialRefCode);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [publicConfig, setPublicConfig] = useState<{
    taskReward: number;
    minWithdrawal: number;
    activeTasksCount: number;
  }>({ taskReward: 10, minWithdrawal: 20, activeTasksCount: 3 });

  useEffect(() => {
    apiRequest<{ taskReward: number; minWithdrawal: number; activeTasksCount: number }>('/api/public/config', {
      scope: 'public',
    })
      .then((data) => setPublicConfig(data))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        mode === 'login'
          ? { email, password }
          : { name, email, password, referralCode: referralCode.trim() || undefined };

      const res = await apiRequest<MeResponse & { token?: string }>(endpoint, {
        method: 'POST',
        body: payload,
        scope: 'public',
      });

      if (res.token) {
        setUserToken(res.token);
      }
      onToast(
        mode === 'login' ? 'সফলভাবে লগইন সম্পন্ন হয়েছে!' : 'অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!',
        'success'
      );
      onAuthenticated(res);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'লগইন করতে সমস্যা হয়েছে।', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#060B18] text-slate-100 flex flex-col">
      <header className="w-full border-b border-blue-950/70 bg-[#080F21]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">Task Money BD</span>
          </div>
          <button
            type="button"
            onClick={onOpenAdmin}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-blue-950/60 border border-blue-900/40 transition-colors whitespace-nowrap shrink-0"
          >
            <Lock className="w-3.5 h-3.5 text-blue-400" />
            <span>অ্যাডমিন প্যানেল</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6 space-y-6">
          <div className="relative rounded-2xl overflow-hidden border border-blue-900/40 bg-[#0B142B]">
            <img
              src="/src/assets/images/hero_task_wallet_1795593805865.jpg"
              alt="Task Money BD ডিজিটাল ওয়ালেট"
              referrerPolicy="no-referrer"
              className="w-full h-48 sm:h-56 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#060B18] via-[#060B18]/65 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
              <p className="text-xs font-medium text-blue-300 mb-1">বাংলাদেশের নির্ভরযোগ্য টাস্ক ও আর্নিং প্ল্যাটফর্ম</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight [text-wrap:balance]">
                সহজ টাস্ক সম্পন্ন করে আয় করুন এবং বিকাশে উত্তোলন করুন
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-[#0D1730] border border-blue-900/40">
              <p className="text-xs text-slate-400">প্রতি টাস্ক আয়</p>
              <p className="text-xl font-bold text-emerald-400 mt-1 tabular-nums">{formatBDT(publicConfig.taskReward)}</p>
            </div>
            <div className="p-4 rounded-xl bg-[#0D1730] border border-blue-900/40">
              <p className="text-xs text-slate-400">সর্বনিম্ন উত্তোলন</p>
              <p className="text-xl font-bold text-blue-400 mt-1 tabular-nums">{formatBDT(publicConfig.minWithdrawal)}</p>
            </div>
            <div className="p-4 rounded-xl bg-[#0D1730] border border-blue-900/40">
              <p className="text-xs text-slate-400">সক্রিয় টাস্ক</p>
              <p className="text-xl font-bold text-white mt-1 tabular-nums">{publicConfig.activeTasksCount}টি</p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-slate-300">
            <div className="flex items-start gap-3">
              <CheckSquare className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <p>শুধুমাত্র ইমেইল ও টাস্কের প্রমাণ জমা দিন — কখনোই পাসওয়ার্ড বা ওটিপি প্রয়োজন নেই।</p>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <p>অ্যাডমিন যাচাইয়ের পর ব্যালেন্স যুক্ত হয় এবং সরাসরি বিকাশে উত্তোলন করা যায়।</p>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="lg:col-span-6 bg-[#0D1730] border border-blue-900/50 rounded-2xl p-5 sm:p-8 shadow-2xl"
        >
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#070D1D] border border-blue-950 mb-6">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
                mode === 'login'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              লগইন করুন
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
                mode === 'register'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              নতুন অ্যাকাউন্ট
            </button>
          </div>

          <h2 className="text-xl font-bold text-white mb-1">
            {mode === 'login' ? 'আপনার অ্যাকাউন্টে প্রবেশ করুন' : 'নতুন অ্যাকাউন্ট তৈরি করুন'}
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            {mode === 'login'
              ? 'আপনার ইমেইল এবং পাসওয়ার্ড দিয়ে লগইন করুন।'
              : 'কয়েক সেকেন্ডেই ফ্রি অ্যাকাউন্ট খুলে টাস্ক শুরু করুন।'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">আপনার পুরো নাম</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="যেমন: তানভীর আহমেদ"
                  className="w-full min-h-[46px] px-4 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">ইমেইল ঠিকানা</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@gmail.com"
                className="w-full min-h-[46px] px-4 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">পাসওয়ার্ড</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড"
                  className="w-full min-h-[46px] pl-4 pr-12 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  রেফারেল কোড <span className="text-slate-500 font-normal">(ঐচ্ছিক)</span>
                </label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  placeholder="বন্ধুর রেফারেল কোড থাকলে লিখুন"
                  className="w-full min-h-[46px] px-4 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] mt-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-950/50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>অপেক্ষা করুন...</span>
                </>
              ) : (
                <>
                  <span>{mode === 'login' ? 'লগইন করুন' : 'রেজিস্ট্রেশন সম্পন্ন করুন'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
