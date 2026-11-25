import React, { useState } from 'react';
import { Edit3, LogOut, Copy, Check, Save, X, Loader2, Upload, Lock, ChevronRight } from 'lucide-react';
import { apiRequest } from '../api';
import { MeResponse, UserProfile } from '../types';
import { formatBDT, formatBanglaDateOnly, UserAvatar } from './ToastAndUtils';

interface ProfileViewProps {
  user: UserProfile;
  onUpdated: (data: MeResponse) => void;
  onLogout: () => Promise<void>;
  onOpenAdmin: () => void;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export function ProfileView({
  user,
  onUpdated,
  onLogout,
  onOpenAdmin,
  onToast,
}: ProfileViewProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [copied, setCopied] = useState(false);

  const referralLink = `${window.location.origin}/?ref=${encodeURIComponent(user.referralCode)}`;

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      onToast('রেফারেল লিংক কপি করা হয়েছে!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onToast('লিংক কপি করা যায়নি।', 'error');
    }
  }

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onToast('শুধুমাত্র ছবি ফাইল আপলোড করুন।', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const compressed = canvas.toDataURL('image/jpeg', 0.82);
        setAvatarUrl(compressed);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const updated = await apiRequest<MeResponse>('/api/profile', {
        method: 'PATCH',
        body: { name: name.trim(), avatarUrl },
      });
      onUpdated(updated);
      setEditing(false);
      onToast('প্রোফাইল সফলভাবে আপডেট হয়েছে!', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'প্রোফাইল আপডেট করা যায়নি।', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoutClick() {
    if (loggingOut) return;
    setLoggingOut(true);
    await onLogout();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-white">আমার প্রোফাইল</h1>
        <button
          type="button"
          onClick={handleLogoutClick}
          disabled={loggingOut}
          className="min-h-[42px] px-4 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
        >
          <LogOut className="w-4 h-4" />
          <span>{loggingOut ? 'লগআউট হচ্ছে...' : 'লগআউট'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Profile Header & Edit Card */}
        <div className="lg:col-span-6 rounded-2xl bg-[#0D1730] border border-blue-900/40 p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <UserAvatar src={user.avatarUrl} name={user.name} sizeClass="w-16 h-16 sm:w-20 sm:h-20 text-2xl" />
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white">{user.name}</h2>
                <p className="text-xs sm:text-sm text-slate-400">{user.email}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-blue-300 mt-1">
                  <span className="font-mono">আইডি: {user.id}</span>
                  <span aria-hidden="true">·</span>
                  <span>যোগদান: {formatBanglaDateOnly(user.createdAt)}</span>
                </div>
              </div>
            </div>

            {!editing && (
              <button
                type="button"
                onClick={() => {
                  setName(user.name);
                  setAvatarUrl(user.avatarUrl);
                  setEditing(true);
                }}
                className="min-h-[42px] px-4 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <Edit3 className="w-4 h-4" />
                <span>প্রোফাইল এডিট</span>
              </button>
            )}
          </div>

          {editing && (
            <form onSubmit={handleSaveProfile} className="pt-4 border-t border-blue-900/40 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">প্রোফাইল ছবি পরিবর্তন</label>
                <div className="flex items-center gap-4">
                  <UserAvatar src={avatarUrl} name={name || user.name} sizeClass="w-14 h-14 text-lg" />
                  <label className="min-h-[42px] px-4 rounded-xl bg-[#070D1D] hover:bg-[#0E1835] border border-blue-900/60 text-xs font-semibold text-slate-200 inline-flex items-center gap-2 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-blue-400" />
                    <span>গ্যালারি থেকে ছবি নিন</span>
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">আপনার নাম</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[46px] px-4 rounded-xl bg-[#070D1D] border border-blue-900/60 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>সংরক্ষণ করুন</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="min-h-[44px] px-4 rounded-xl bg-[#070D1D] border border-blue-900/60 text-slate-300 hover:text-white text-sm font-medium inline-flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  <span>বাতিল</span>
                </button>
              </div>
            </form>
          )}

          {/* Referral Link Box */}
          <div className="pt-4 border-t border-blue-900/40 space-y-2">
            <p className="text-xs font-medium text-slate-400">আপনার রেফারেল লিংক</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={referralLink}
                className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-[#070D1D] border border-blue-950 text-xs font-mono text-slate-300"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'কপিড' : 'কপি'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Account Statistics */}
        <div className="lg:col-span-6 grid grid-cols-2 gap-3 sm:gap-4">
          <div className="p-5 rounded-2xl bg-[#0D1730] border border-blue-900/40">
            <p className="text-xs text-slate-400">মোট সম্পন্ন টাস্ক</p>
            <p className="text-2xl font-bold text-white tabular-nums mt-1">{user.completedTasks}টি</p>
          </div>
          <div className="p-5 rounded-2xl bg-[#0D1730] border border-blue-900/40">
            <p className="text-xs text-slate-400">মোট উপার্জন</p>
            <p className="text-2xl font-bold text-emerald-400 tabular-nums mt-1">{formatBDT(user.totalEarnings)}</p>
          </div>
          <div className="p-5 rounded-2xl bg-[#0D1730] border border-blue-900/40">
            <p className="text-xs text-slate-400">মোট উত্তোলন</p>
            <p className="text-2xl font-bold text-blue-400 tabular-nums mt-1">{formatBDT(user.totalWithdrawn)}</p>
          </div>
          <div className="p-5 rounded-2xl bg-[#0D1730] border border-blue-900/40">
            <p className="text-xs text-slate-400">বর্তমান ব্যালেন্স</p>
            <p className="text-2xl font-bold text-white tabular-nums mt-1">{formatBDT(user.balance)}</p>
          </div>

          {/* Locked Admin Access Option inside Profile */}
          <div className="col-span-2">
            <button
              type="button"
              onClick={onOpenAdmin}
              className="w-full p-4 sm:p-5 rounded-2xl bg-[#0B142B] hover:bg-[#111E3E] border border-blue-800/50 flex items-center justify-between gap-3 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm sm:text-base font-bold text-white">অ্যাডমিন প্যানেল (লক করা)</p>
                  <p className="text-xs text-slate-400">পাসওয়ার্ড দিয়ে আনলক করে টাস্ক ও উত্তোলন পরিচালনা করুন</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
