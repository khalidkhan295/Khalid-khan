import React from 'react';
import { CheckCircle2, AlertCircle, Info, Clock } from 'lucide-react';

export function formatBDT(amount: number): string {
  const formatted = new Intl.NumberFormat('bn-BD', {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  return `৳${formatted}`;
}

export function formatBanglaDate(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('bn-BD', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export function formatBanglaDateOnly(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('bn-BD', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export function StatusLabel({
  status,
  context = 'task',
}: {
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  context?: 'task' | 'withdrawal';
}) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{context === 'task' ? 'কাজটি সম্পূর্ণভাবে হয়েছে' : 'অনুমোদিত'}</span>
      </span>
    );
  }
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>উইথড্র সাকসেস</span>
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>বাতিল</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>অপেক্ষমান</span>
    </span>
  );
}

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const icon =
          t.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : t.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
          );
        const border =
          t.type === 'success'
            ? 'border-emerald-500/30 bg-[#0D1B2A]/95'
            : t.type === 'error'
              ? 'border-rose-500/30 bg-[#1B1020]/95'
              : 'border-blue-500/30 bg-[#0D1730]/95';

        return (
          <div
            key={t.id}
            role="status"
            onClick={() => onDismiss(t.id)}
            className={`pointer-events-auto cursor-pointer flex items-start gap-2.5 px-4 py-3 rounded-xl border ${border} backdrop-blur-md shadow-xl text-sm text-slate-100`}
          >
            <div className="mt-0.5">{icon}</div>
            <p className="flex-1 leading-snug">{t.message}</p>
          </div>
        );
      })}
    </div>
  );
}

export function UserAvatar({
  src,
  name,
  sizeClass = 'w-10 h-10',
}: {
  src: string;
  name: string;
  sizeClass?: string;
}) {
  const [failed, setFailed] = React.useState(false);

  if (failed || !src) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-gradient-to-br from-blue-600 to-indigo-900 border border-blue-400/30 flex items-center justify-center text-white font-bold select-none shrink-0`}
        aria-label={name}
      >
        {name.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-full object-cover border border-blue-400/30 bg-[#0F1B35] shrink-0`}
    />
  );
}
