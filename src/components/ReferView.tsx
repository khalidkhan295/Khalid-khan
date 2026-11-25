import React, { useState, useEffect } from 'react';
import { Copy, Check, Users, Share2 } from 'lucide-react';
import { apiRequest } from '../api';
import { InvitedUser } from '../types';
import { formatBDT, formatBanglaDateOnly } from './ToastAndUtils';

interface ReferViewProps {
  referralCode: string;
  invitedUsersCount: number;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export function ReferView({
  referralCode,
  invitedUsersCount,
  onToast,
}: ReferViewProps) {
  const [copied, setCopied] = useState(false);
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const referralLink = `${window.location.origin}/?ref=${encodeURIComponent(referralCode)}`;

  useEffect(() => {
    let mounted = true;
    apiRequest<{ invitedUsers: InvitedUser[] }>('/api/referrals')
      .then((res) => {
        if (mounted) setInvitedUsers(res.invitedUsers);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [invitedUsersCount]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      onToast('রেফারেল লিংক কপি করা হয়েছে!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onToast('কপি করা যায়নি, অনুগ্রহ করে লিংকটি ম্যানুয়ালি কপি করুন।', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">রেফার করুন ও বন্ধুদের আমন্ত্রণ জানান</h1>
        <p className="text-sm text-slate-400">আপনার ব্যক্তিগত রেফারেল লিংক শেয়ার করে বন্ধুদের Task Money BD-তে আমন্ত্রণ জানান।</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-[#0E1B3B] to-[#0B142C] border border-blue-800/40 p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-blue-300">আপনার ইউনিক রেফারেল কোড</p>
                <p className="text-2xl font-bold font-mono text-white tracking-wider mt-1">{referralCode}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <Share2 className="w-5 h-5 text-blue-400" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">আপনার রেফারেল লিংক</label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  readOnly
                  value={referralLink}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 min-h-[46px] px-4 rounded-xl bg-[#070D1D] border border-blue-900/60 text-xs sm:text-sm font-mono text-slate-200 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="min-h-[46px] px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'কপি হয়েছে' : 'রেফারেল লিংক কপি করুন'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-blue-900/40">
              <div className="p-4 rounded-xl bg-[#070D1D] border border-blue-950">
                <p className="text-xs text-slate-400">মোট আমন্ত্রিত ব্যবহারকারী</p>
                <p className="text-2xl font-bold text-white tabular-nums mt-1">{invitedUsersCount} জন</p>
              </div>
              <div className="p-4 rounded-xl bg-[#070D1D] border border-blue-950">
                <p className="text-xs text-slate-400">রেফারেল পুরস্কার</p>
                <p className="text-2xl font-bold text-slate-300 tabular-nums mt-1">{formatBDT(0)}</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              বিশেষ দ্রষ্টব্য: বর্তমান নীতিমালা অনুযায়ী প্রতিটি রেফারেলে কোনো বোনাস ({formatBDT(0)}) প্রদান করা হয় না। কেবলমাত্র টাস্ক সম্পন্ন করার মাধ্যমেই আয় করা যায়।
            </p>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl bg-[#0D1730] border border-blue-900/40 overflow-hidden">
          <div className="px-5 py-4 border-b border-blue-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <h2 className="text-base font-bold text-white">আমন্ত্রিত বন্ধুদের তালিকা</h2>
            </div>
            <span className="text-xs text-slate-400 tabular-nums">{invitedUsers.length} জন</span>
          </div>

          {loading ? (
            <div className="p-6 text-center text-sm text-slate-400">লোড হচ্ছে...</div>
          ) : invitedUsers.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              এখনো কেউ আপনার রেফারেল লিংক ব্যবহার করে যোগ দেয়নি।
            </div>
          ) : (
            <div className="divide-y divide-blue-900/30">
              {invitedUsers.map((inv) => (
                <div key={inv.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{inv.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{inv.id}</p>
                  </div>
                  <p className="text-xs text-slate-400">{formatBanglaDateOnly(inv.joinedAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
