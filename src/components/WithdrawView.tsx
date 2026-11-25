import React, { useState, useEffect } from 'react';
import { Wallet, ArrowDownToLine, AlertCircle, Loader2, History } from 'lucide-react';
import { apiRequest } from '../api';
import { WithdrawalItem } from '../types';
import { formatBDT, formatBanglaDate, StatusLabel } from './ToastAndUtils';

interface WithdrawViewProps {
  balance: number;
  availableBalance: number;
  minWithdrawal: number;
  withdrawMethodLabel?: string;
  hasActiveWithdrawal: boolean;
  onWithdrawn: () => Promise<void>;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export function WithdrawView({
  balance,
  availableBalance,
  minWithdrawal,
  withdrawMethodLabel = 'বিকাশ (bKash Personal)',
  hasActiveWithdrawal,
  onWithdrawn,
  onToast,
}: WithdrawViewProps) {
  const [bkashNumber, setBkashNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  async function loadWithdrawals() {
    try {
      const res = await apiRequest<{ withdrawals: WithdrawalItem[] }>('/api/withdrawals');
      setWithdrawals(res.withdrawals);
    } catch {
      // handled silently
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    loadWithdrawals();
  }, [balance, availableBalance]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const cleanBkash = bkashNumber.trim();
    if (!/^01[3-9]\d{8}$/.test(cleanBkash)) {
      onToast('অনুগ্রহ করে ১১ সংখ্যার সঠিক বিকাশ নম্বর লিখুন (যেমন: 017XXXXXXXX)।', 'error');
      return;
    }

    const numAmount = Number(amount);
    if (!Number.isInteger(numAmount) || numAmount < minWithdrawal) {
      onToast(`সর্বনিম্ন উত্তোলন ${formatBDT(minWithdrawal)} এবং পূর্ণসংখ্যা হতে হবে।`, 'error');
      return;
    }

    if (numAmount > availableBalance) {
      onToast(`আপনার উপলব্ধ ব্যালেন্স (${formatBDT(availableBalance)}) পর্যাপ্ত নয়।`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{ ok: boolean; message: string }>('/api/withdrawals', {
        method: 'POST',
        body: { bkashNumber: cleanBkash, amount: numAmount },
      });
      onToast(res.message, 'success');
      setBkashNumber('');
      setAmount('');
      await onWithdrawn();
      await loadWithdrawals();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'উত্তোলন অনুরোধ পাঠাতে সমস্যা হয়েছে।', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">বিকাশ উত্তোলন (bKash Withdraw)</h1>
        <p className="text-sm text-slate-400">
          সর্বনিম্ন উত্তোলনের পরিমাণ <span className="text-blue-400 font-semibold tabular-nums">{formatBDT(minWithdrawal)}</span>। অ্যাডমিন যাচাইয়ের পর পেমেন্ট পাঠানো হয়।
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 space-y-4">
          {/* Balance Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-[#0D1730] border border-blue-900/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">মোট ব্যালেন্স</span>
                <Wallet className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-2xl font-bold text-white tabular-nums">{formatBDT(balance)}</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#0D1730] border border-blue-900/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">উত্তোলনযোগ্য ব্যালেন্স</span>
                <ArrowDownToLine className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-emerald-400 tabular-nums">{formatBDT(availableBalance)}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0D1730] border border-blue-900/40 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-blue-900/40 pb-3">
              <div>
                <h2 className="text-base font-bold text-white">উত্তোলন ফর্ম</h2>
                <p className="text-xs text-slate-400">পেমেন্ট মাধ্যম: {withdrawMethodLabel}</p>
              </div>
              <span className="text-xs font-bold text-pink-400">bKash</span>
            </div>

            {hasActiveWithdrawal && (
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p>আপনার একটি উত্তোলন অনুরোধ ইতিমধ্যেই প্রক্রিয়াধীন রয়েছে। সেটি সম্পন্ন না হওয়া পর্যন্ত নতুন অনুরোধ করা যাবে না।</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">বিকাশ নম্বর (Personal)</label>
                <input
                  type="tel"
                  required
                  disabled={hasActiveWithdrawal || submitting}
                  value={bkashNumber}
                  onChange={(e) => setBkashNumber(e.target.value)}
                  placeholder="017XXXXXXXX"
                  maxLength={11}
                  className="w-full min-h-[46px] px-4 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  উত্তোলনের পরিমাণ (সর্বনিম্ন {formatBDT(minWithdrawal)})
                </label>
                <input
                  type="number"
                  required
                  min={minWithdrawal}
                  step={1}
                  disabled={hasActiveWithdrawal || submitting}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`${minWithdrawal}`}
                  className="w-full min-h-[46px] px-4 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white font-mono tabular-nums placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={hasActiveWithdrawal || submitting || availableBalance < minWithdrawal}
                className="w-full min-h-[48px] rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-950/40"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>অনুরোধ পাঠানো হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="w-4 h-4" />
                    <span>উত্তোলন অনুরোধ জমা দিন</span>
                  </>
                )}
              </button>

              {availableBalance < minWithdrawal && !hasActiveWithdrawal && (
                <p className="text-xs text-slate-400 text-center">
                  উত্তোলনের জন্য আপনার উপলব্ধ ব্যালেন্স কমপক্ষে {formatBDT(minWithdrawal)} হতে হবে।
                </p>
              )}
            </form>
          </div>
        </div>

        {/* Withdrawal History */}
        <div className="lg:col-span-6 rounded-2xl bg-[#0D1730] border border-blue-900/40 overflow-hidden">
          <div className="px-5 py-4 border-b border-blue-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-blue-400" />
              <h2 className="text-base font-bold text-white">উত্তোলনের ইতিহাস</h2>
            </div>
            <span className="text-xs text-slate-400 tabular-nums">{withdrawals.length}টি</span>
          </div>

          {loadingHistory ? (
            <div className="p-6 text-center text-sm text-slate-400">লোড হচ্ছে...</div>
          ) : withdrawals.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              এখনো কোনো উত্তোলনের অনুরোধ করা হয়নি।
            </div>
          ) : (
            <div className="divide-y divide-blue-900/30">
              {withdrawals.map((w) => (
                <div key={w.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-slate-400">{w.id}</span>
                    <StatusLabel status={w.status} context="withdrawal" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white font-mono">{w.bkash_number}</p>
                    <p className="text-base font-bold text-emerald-400 tabular-nums">{formatBDT(w.amount)}</p>
                  </div>
                  <p className="text-xs text-slate-400">{formatBanglaDate(w.created_at)}</p>
                  {w.admin_note && (
                    <p className="text-xs text-amber-300 bg-[#070D1D] px-3 py-2 rounded-lg border border-blue-950">
                      অ্যাডমিন নোট: {w.admin_note}
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
