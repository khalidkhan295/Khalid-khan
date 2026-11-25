import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const TELEGRAM_ADMIN_IDS = ['8340427143', '8499775384'];

// Session signing secret kept in memory if not provided via environment
const SESSION_SECRET = process.env.SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

// Ensure data directory exists
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'task_money_bd.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    avatar_url TEXT NOT NULL,
    referral_code TEXT NOT NULL UNIQUE,
    referred_by TEXT,
    balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    instructions TEXT NOT NULL,
    reward REAL NOT NULL DEFAULT 10,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS task_submissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    submitted_email TEXT NOT NULL,
    proof_text TEXT NOT NULL,
    reward_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    reviewed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS withdrawals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    bkash_number TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    balance_deducted INTEGER NOT NULL DEFAULT 0,
    admin_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Migrate older task_submissions table if it still carries UNIQUE(user_id, task_id)
const subIndexes = db.prepare("PRAGMA index_list('task_submissions')").all() as Array<{ name: string; unique: number }>;
const hasAutoUnique = subIndexes.some((idx) => idx.unique === 1 && idx.name.startsWith('sqlite_autoindex_task_submissions'));
if (hasAutoUnique) {
  db.exec(`
    BEGIN TRANSACTION;
    CREATE TABLE task_submissions_new (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      submitted_email TEXT NOT NULL,
      proof_text TEXT NOT NULL,
      reward_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      reviewed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
    INSERT INTO task_submissions_new SELECT * FROM task_submissions;
    DROP TABLE task_submissions;
    ALTER TABLE task_submissions_new RENAME TO task_submissions;
    COMMIT;
  `);
}

// Seed default settings
const insertSetting = db.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)');
insertSetting.run('task_reward', '10');
insertSetting.run('tasks_enabled', 'true');
insertSetting.run('min_withdrawal', '20');
insertSetting.run('app_name', 'Task Money BD');
insertSetting.run('welcome_title', 'আপনার প্রতিদিনের টাস্ক ও আয়ের ড্যাশবোর্ড');
insertSetting.run('welcome_subtitle', 'সক্রিয় টাস্ক সম্পন্ন করে জমা দিন। অ্যাডমিন অনুমোদনের সাথে সাথেই আপনার ব্যালেন্সে টাকা যুক্ত হবে।');
insertSetting.run('announcement_text', '');
insertSetting.run('earn_title', 'Earn — জিমেইল টাস্ক ও আয়');
insertSetting.run('withdraw_method_label', 'বিকাশ (bKash Personal)');

// Deactivate old preset tasks (TASK-01, TASK-02, TASK-03) and ensure unified Earn task exists
db.prepare("UPDATE tasks SET is_active = 0 WHERE id IN ('TASK-01', 'TASK-02', 'TASK-03')").run();
const earnTaskExists = db.prepare("SELECT id FROM tasks WHERE id = 'TASK-EARN'").get();
if (!earnTaskExists) {
  db.prepare(`
    INSERT INTO tasks (id, title, description, instructions, reward, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'TASK-EARN',
    'Earn টাস্ক — জিমেইল জমা ও আয়',
    'আপনার সচল জিমেইল ঠিকানা এবং টাস্ক সম্পন্ন করার প্রমাণ জমা দিয়ে আয় করুন।',
    '১. আপনার একটি সচল জিমেইল ঠিকানা লিখুন।\n২. টাস্ক সম্পন্নের সংক্ষিপ্ত বিবরণ বা নোট দিন।\n৩. নিরাপত্তার জন্য কখনোই কোনো পাসওয়ার্ড বা ওটিপি দেবেন না।',
    Number((db.prepare("SELECT value FROM app_settings WHERE key = 'task_reward'").get() as { value: string } | undefined)?.value || 10),
    1,
    new Date().toISOString()
  );
}

// Helper functions
function getSetting(key: string, fallback = ''): string {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : fallback;
}

function setSetting(key: string, value: string): void {
  db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

function getPlatformSettings() {
  return {
    taskReward: Number(getSetting('task_reward', '10')),
    tasksEnabled: getSetting('tasks_enabled', 'true') === 'true',
    minWithdrawal: Number(getSetting('min_withdrawal', '20')),
    referralReward: 0,
    appName: getSetting('app_name', 'Task Money BD'),
    welcomeTitle: getSetting('welcome_title', 'আপনার প্রতিদিনের টাস্ক ও আয়ের ড্যাশবোর্ড'),
    welcomeSubtitle: getSetting('welcome_subtitle', 'সক্রিয় টাস্ক সম্পন্ন করে জমা দিন। অ্যাডমিন অনুমোদনের সাথে সাথেই আপনার ব্যালেন্সে টাকা যুক্ত হবে।'),
    announcementText: getSetting('announcement_text', ''),
    earnTitle: getSetting('earn_title', 'Earn — জিমেইল টাস্ক ও আয়'),
    withdrawMethodLabel: getSetting('withdraw_method_label', 'বিকাশ (bKash Personal)'),
  };
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

interface SessionPayload {
  sub: string;
  role: 'user' | 'admin';
  exp: number;
}

function signToken(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [data, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
    if (!timingSafeStringEqual(sig, expectedSig)) return null;
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed || typeof parsed.sub !== 'string' || typeof parsed.exp !== 'number') return null;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = decodeURIComponent(part.slice(idx + 1).trim());
    cookies[k] = v;
  }
  return cookies;
}

function setAuthCookie(req: Request, res: Response, name: string, token: string, maxAgeSeconds: number): void {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [
    `${name}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAgeSeconds}`,
    isSecure ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (isSecure) {
    parts.push('Secure');
    parts.push('Partitioned');
  }
  res.append('Set-Cookie', parts.join('; '));
}

function clearAuthCookie(req: Request, res: Response, name: string): void {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [
    `${name}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    isSecure ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (isSecure) {
    parts.push('Secure');
    parts.push('Partitioned');
  }
  res.append('Set-Cookie', parts.join('; '));
}

function extractToken(req: Request, cookieName: string): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[cookieName] || null;
}

function verifyMutationOrigin(req: Request): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  if (req.headers.authorization?.startsWith('Bearer ')) return true;
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') return true;
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }
  return false;
}

function generateUniqueUserId(): string {
  for (let i = 0; i < 10; i++) {
    const num = crypto.randomInt(100000, 999999);
    const id = `TM-${num}`;
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!existing) return id;
  }
  return `TM-${Date.now().toString().slice(-6)}`;
}

function addNotification(userId: string, title: string, message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info'): void {
  const id = `NTF-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).run(id, userId, title, message, type, new Date().toISOString());
}

function validateSafeAvatar(avatarUrl: unknown): string | null {
  if (typeof avatarUrl !== 'string') return null;
  const trimmed = avatarUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/src/assets/')) return trimmed;
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length <= 280000) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') return trimmed;
  } catch {
    return null;
  }
  return null;
}

function formatDhakaDateTime(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

async function sendTelegramWithdrawalAlert(params: {
  userName: string;
  userId: string;
  bkashNumber: string;
  amount: number;
  requestId: string;
  createdAt: string;
}): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN is not configured; skipping alert for', params.requestId);
    return;
  }

  const text = [
    '🔔 <b>নতুন বিকাশ উত্তোলন অনুরোধ (Task Money BD)</b>',
    '',
    `👤 <b>User Name:</b> ${escapeHtml(params.userName)}`,
    `🆔 <b>User ID:</b> <code>${escapeHtml(params.userId)}</code>`,
    `📱 <b>bKash Number:</b> <code>${escapeHtml(params.bkashNumber)}</code>`,
    `💰 <b>Withdrawal Amount:</b> ৳${params.amount}`,
    `🧾 <b>Request ID:</b> <code>${escapeHtml(params.requestId)}</code>`,
    `🕒 <b>Date & Time:</b> ${escapeHtml(formatDhakaDateTime(params.createdAt))} (BDT)`,
  ].join('\n');

  await Promise.allSettled(
    TELEGRAM_ADMIN_IDS.map(async (chatId) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '✅ Done (উইথড্র সাকসেস)',
                    callback_data: `wdr_done:${params.requestId}`,
                  },
                ],
              ],
            },
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const errText = await res.text();
          console.error(`[Telegram] Failed to notify admin ${chatId}:`, res.status, errText);
        }
      } catch (err) {
        console.error(`[Telegram] Error notifying admin ${chatId}:`, err);
      } finally {
        clearTimeout(timeout);
      }
    })
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function processWithdrawalStatusUpdate(
  withdrawalId: string,
  status: 'approved' | 'rejected' | 'paid',
  note: string
): { status: 200; amount: number; bkashNumber: string } | { error: string; status: 400 | 404 | 409 } {
  const updateTx = db.transaction(() => {
    const withdrawal = db.prepare(`
      SELECT id, user_id, bkash_number, amount, status, balance_deducted
      FROM withdrawals
      WHERE id = ?
    `).get(withdrawalId) as {
      id: string;
      user_id: string;
      bkash_number: string;
      amount: number;
      status: string;
      balance_deducted: number;
    } | undefined;

    if (!withdrawal) {
      return { error: 'উত্তোলন অনুরোধ খুঁজে পাওয়া যায়নি।', status: 404 as const };
    }
    if (withdrawal.status === 'paid' || withdrawal.status === 'rejected') {
      return { error: 'এই উত্তোলন অনুরোধটি ইতিমধ্যেই চূড়ান্ত করা হয়েছে।', status: 409 as const };
    }
    if (withdrawal.status === status) {
      return { error: 'অনুরোধটি ইতিমধ্যেই এই অবস্থায় রয়েছে।', status: 409 as const };
    }

    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(withdrawal.user_id) as { balance: number } | undefined;
    if (!user) {
      return { error: 'ইউজার পাওয়া যায়নি।', status: 404 as const };
    }

    let balanceDeducted = withdrawal.balance_deducted;

    // Deduct balance ONLY during verified approval or payment, and never twice
    if ((status === 'approved' || status === 'paid') && balanceDeducted === 0) {
      if (Number(user.balance) < Number(withdrawal.amount)) {
        return { error: 'ইউজারের অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই।', status: 400 as const };
      }
      db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(Number(withdrawal.amount), withdrawal.user_id);
      balanceDeducted = 1;
    }

    // Refund if an already-deducted approved withdrawal is subsequently rejected
    if (status === 'rejected' && balanceDeducted === 1) {
      db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(Number(withdrawal.amount), withdrawal.user_id);
      balanceDeducted = 0;
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE withdrawals
      SET status = ?, balance_deducted = ?, admin_note = ?, updated_at = ?
      WHERE id = ?
    `).run(status, balanceDeducted, note, now, withdrawal.id);

    if (status === 'approved') {
      addNotification(
        withdrawal.user_id,
        'উত্তোলন অনুমোদিত হয়েছে',
        `আপনার ৳${withdrawal.amount} উত্তোলন অনুরোধ (${withdrawal.id}) অনুমোদিত হয়েছে ও ব্যালেন্স সমন্বয় করা হয়েছে। শীঘ্রই পেমেন্ট পাঠানো হবে।`,
        'info'
      );
    } else if (status === 'paid') {
      addNotification(
        withdrawal.user_id,
        'উইথড্র সাকসেস!',
        `আপনার বিকাশ নম্বর ${withdrawal.bkash_number}-এ ৳${withdrawal.amount} সফলভাবে পরিশোধ করা হয়েছে। (${withdrawal.id})`,
        'success'
      );
    } else if (status === 'rejected') {
      addNotification(
        withdrawal.user_id,
        'উত্তোলন অনুরোধ বাতিল হয়েছে',
        `আপনার ৳${withdrawal.amount} উত্তোলন অনুরোধ (${withdrawal.id}) বাতিল করা হয়েছে।${note ? ` কারণ: ${note}` : ''}`,
        'error'
      );
    }

    return { status: 200 as const, amount: Number(withdrawal.amount), bkashNumber: withdrawal.bkash_number };
  });

  return updateTx();
}

let telegramPollOffset = 0;
function startTelegramCallbackPoller(): void {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) return;

  const poll = async () => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?offset=${telegramPollOffset}&timeout=25&allowed_updates=${encodeURIComponent('["callback_query"]')}`);
      if (!res.ok) return;
      const payload = (await res.json()) as {
        ok?: boolean;
        result?: Array<{
          update_id: number;
          callback_query?: {
            id: string;
            from?: { id?: number };
            data?: string;
            message?: { chat?: { id?: number }; message_id?: number; text?: string };
          };
        }>;
      };
      if (!payload.ok || !Array.isArray(payload.result)) return;

      for (const update of payload.result) {
        telegramPollOffset = Math.max(telegramPollOffset, update.update_id + 1);
        const cb = update.callback_query;
        if (!cb || !cb.data?.startsWith('wdr_done:')) continue;
        const senderId = String(cb.from?.id ?? '');
        if (!TELEGRAM_ADMIN_IDS.includes(senderId)) {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cb.id, text: 'অননুমোদিত অ্যাক্সেস!', show_alert: true }),
          }).catch(() => {});
          continue;
        }

        const requestId = cb.data.slice('wdr_done:'.length).trim();
        const result = processWithdrawalStatusUpdate(requestId, 'paid', 'Telegram Admin Done');

        if ('error' in result) {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cb.id, text: result.error, show_alert: true }),
          }).catch(() => {});
        } else {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cb.id, text: `✅ ${requestId} উইথড্র সাকসেস সম্পন্ন হয়েছে!` }),
          }).catch(() => {});

          if (cb.message?.chat?.id && cb.message?.message_id) {
            const updatedText = `${cb.message.text || ''}\n\n✅ স্ট্যাটাস: উইথড্র সাকসেস (Done by Admin ${senderId})`;
            await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: cb.message.chat.id,
                message_id: cb.message.message_id,
                text: updatedText,
              }),
            }).catch(() => {});
          }
        }
      }
    } catch {
      // ignore transient network errors and retry
    } finally {
      setTimeout(poll, 3000);
    }
  };

  setTimeout(poll, 2000);
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  avatar_url: string;
  referral_code: string;
  referred_by: string | null;
  balance: number;
  created_at: string;
}

interface AuthedRequest extends Request {
  userId?: string;
}

function requireUser(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!verifyMutationOrigin(req)) {
    res.status(403).json({ error: 'অননুমোদিত রিকোয়েস্ট উৎস।' });
    return;
  }
  const token = extractToken(req, 'tmbd_user_session');
  if (!token) {
    res.status(401).json({ error: 'অনুগ্রহ করে লগইন করুন।' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'user') {
    res.status(401).json({ error: 'সেশন মেয়াদোত্তীর্ণ হয়েছে, আবার লগইন করুন।' });
    return;
  }
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(payload.sub) as { id: string } | undefined;
  if (!user) {
    res.status(401).json({ error: 'অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।' });
    return;
  }
  req.userId = user.id;
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!verifyMutationOrigin(req)) {
    res.status(403).json({ error: 'অননুমোদিত রিকোয়েস্ট উৎস।' });
    return;
  }
  const token = extractToken(req, 'tmbd_admin_session');
  if (!token) {
    res.status(401).json({ error: 'অ্যাডমিন লগইন প্রয়োজন।' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'admin') {
    res.status(401).json({ error: 'অ্যাডমিন সেশন মেয়াদোত্তীর্ণ হয়েছে।' });
    return;
  }
  next();
}

function buildUserSummary(userId: string) {
  const user = db.prepare('SELECT id, name, email, avatar_url, referral_code, referred_by, balance, created_at FROM users WHERE id = ?').get(userId) as Omit<UserRow, 'password_hash'> | undefined;
  if (!user) return null;

  const taskStats = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as completedCount,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingCount,
      COALESCE(SUM(CASE WHEN status = 'approved' THEN reward_amount ELSE 0 END), 0) as totalEarnings
    FROM task_submissions
    WHERE user_id = ?
  `).get(userId) as { completedCount: number | null; pendingCount: number | null; totalEarnings: number };

  const withdrawStats = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status IN ('pending', 'approved') AND balance_deducted = 0 THEN amount ELSE 0 END), 0) as heldAmount,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as totalPaid,
      SUM(CASE WHEN status IN ('pending', 'approved') THEN 1 ELSE 0 END) as activeCount
    FROM withdrawals
    WHERE user_id = ?
  `).get(userId) as { heldAmount: number; totalPaid: number; activeCount: number | null };

  const invitedRow = db.prepare('SELECT COUNT(*) as count FROM users WHERE referred_by = ?').get(userId) as { count: number };
  const availableTasksRow = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE is_active = 1').get() as { count: number };
  const unreadNotifRow = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(userId) as { count: number };
  const notifications = db.prepare('SELECT id, title, message, type, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(userId);

  const availableBalance = Math.max(0, Number(user.balance) - Number(withdrawStats.heldAmount));

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
      referralCode: user.referral_code,
      balance: Number(user.balance),
      availableBalance,
      heldWithdrawals: Number(withdrawStats.heldAmount),
      hasActiveWithdrawal: Number(withdrawStats.activeCount || 0) > 0,
      completedTasks: Number(taskStats.completedCount || 0),
      pendingTasks: Number(taskStats.pendingCount || 0),
      totalEarnings: Number(taskStats.totalEarnings || 0),
      totalWithdrawn: Number(withdrawStats.totalPaid || 0),
      invitedUsers: Number(invitedRow.count || 0),
      availableTasksCount: getSetting('tasks_enabled', 'true') === 'true' ? Number(availableTasksRow.count || 0) : 0,
      createdAt: user.created_at,
    },
    settings: getPlatformSettings(),
    unreadNotifications: Number(unreadNotifRow.count || 0),
    notifications,
  };
}

const DEFAULT_AVATAR_URL = '/src/assets/images/default_user_avatar_1795593807094.jpg';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const BKASH_REGEX = /^01[3-9]\d{8}$/;

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '512kb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'Task Money BD' });
  });

  // Public platform configuration for landing/auth screens
  app.get('/api/public/config', (_req, res) => {
    const activeTasksCount = (db.prepare('SELECT COUNT(*) as count FROM tasks WHERE is_active = 1').get() as { count: number }).count;
    const settings = getPlatformSettings();
    res.json({
      ...settings,
      activeTasksCount: settings.tasksEnabled ? activeTasksCount : 0,
    });
  });

  // --- USER AUTH ROUTES ---
  app.post('/api/auth/register', (req, res) => {
    const { name, email, password, referralCode } = req.body ?? {};
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60) {
      res.status(400).json({ error: 'অনুগ্রহ করে ২ থেকে ৬০ অক্ষরের মধ্যে সঠিক নাম লিখুন।' });
      return;
    }
    if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim().toLowerCase()) || email.trim().length > 120) {
      res.status(400).json({ error: 'অনুগ্রহ করে একটি সঠিক ইমেইল ঠিকানা লিখুন।' });
      return;
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 100) {
      res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' });
      return;
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      res.status(409).json({ error: 'এই ইমেইল দিয়ে ইতিমধ্যেই একটি অ্যাকাউন্ট তৈরি করা আছে।' });
      return;
    }

    let referredByUserId: string | null = null;
    if (typeof referralCode === 'string' && referralCode.trim()) {
      const code = referralCode.trim().toUpperCase();
      const referrer = db.prepare('SELECT id FROM users WHERE referral_code = ? OR id = ?').get(code, code) as { id: string } | undefined;
      if (referrer) {
        referredByUserId = referrer.id;
      }
    }

    const userId = generateUniqueUserId();
    const userRefCode = userId.replace('-', '');
    const passwordHash = hashPassword(password);
    const createdAt = new Date().toISOString();

    const registerTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, avatar_url, referral_code, referred_by, balance, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(userId, cleanName, cleanEmail, passwordHash, DEFAULT_AVATAR_URL, userRefCode, referredByUserId, createdAt);

      addNotification(
        userId,
        'Task Money BD-তে স্বাগতম!',
        'আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে। টাস্ক সম্পন্ন করে আয় শুরু করুন।',
        'success'
      );

      if (referredByUserId) {
        addNotification(
          referredByUserId,
          'নতুন রেফারেল যুক্ত হয়েছে',
          `${cleanName} আপনার রেফারেল লিংকের মাধ্যমে নিবন্ধন করেছেন। (রেফারেল বোনাস ৳0)`,
          'info'
        );
      }
    });

    registerTx();

    const token = signToken({
      sub: userId,
      role: 'user',
      exp: Date.now() + 1000 * 60 * 60 * 24 * 14,
    });
    setAuthCookie(req, res, 'tmbd_user_session', token, 60 * 60 * 24 * 14);
    const summary = buildUserSummary(userId);
    res.status(201).json({ token, ...summary });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'ইমেইল এবং পাসওয়ার্ড দিন।' });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(cleanEmail) as { id: string; password_hash: string } | undefined;
    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: 'ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।' });
      return;
    }

    const token = signToken({
      sub: user.id,
      role: 'user',
      exp: Date.now() + 1000 * 60 * 60 * 24 * 14,
    });
    setAuthCookie(req, res, 'tmbd_user_session', token, 60 * 60 * 24 * 14);
    const summary = buildUserSummary(user.id);
    res.json({ token, ...summary });
  });

  app.post('/api/auth/logout', (req, res) => {
    clearAuthCookie(req, res, 'tmbd_user_session');
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireUser, (req: AuthedRequest, res) => {
    const summary = buildUserSummary(req.userId!);
    if (!summary) {
      res.status(404).json({ error: 'ইউজার পাওয়া যায়নি।' });
      return;
    }
    res.json(summary);
  });

  app.patch('/api/profile', requireUser, (req: AuthedRequest, res) => {
    const { name, avatarUrl } = req.body ?? {};
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60) {
      res.status(400).json({ error: 'নাম ২ থেকে ৬০ অক্ষরের মধ্যে হতে হবে।' });
      return;
    }
    const cleanName = name.trim();
    const validAvatar = avatarUrl ? validateSafeAvatar(avatarUrl) : DEFAULT_AVATAR_URL;
    if (avatarUrl && !validAvatar) {
      res.status(400).json({ error: 'অবৈধ প্রোফাইল ছবির লিংক বা ফরম্যাট।' });
      return;
    }

    db.prepare('UPDATE users SET name = ?, avatar_url = ? WHERE id = ?').run(cleanName, validAvatar || DEFAULT_AVATAR_URL, req.userId!);
    addNotification(req.userId!, 'প্রোফাইল আপডেট হয়েছে', 'আপনার প্রোফাইলের তথ্য সফলভাবে সংরক্ষণ করা হয়েছে।', 'info');
    const summary = buildUserSummary(req.userId!);
    res.json(summary);
  });

  app.post('/api/notifications/read', requireUser, (req: AuthedRequest, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.userId!);
    res.json({ ok: true });
  });

  // --- TASK SYSTEM ROUTES ---
  app.get('/api/tasks', requireUser, (req: AuthedRequest, res) => {
    const tasksEnabled = getSetting('tasks_enabled', 'true') === 'true';
    const defaultReward = Number(getSetting('task_reward', '10'));
    const tasks = db.prepare('SELECT id, title, description, instructions, reward, is_active, created_at FROM tasks ORDER BY created_at ASC').all() as Array<{
      id: string;
      title: string;
      description: string;
      instructions: string;
      reward: number;
      is_active: number;
      created_at: string;
    }>;

    const submissions = db.prepare(`
      SELECT s.id, s.task_id, t.title as task_title, s.submitted_email, s.proof_text, s.reward_amount, s.status, s.admin_note, s.created_at, s.reviewed_at
      FROM task_submissions s
      JOIN tasks t ON t.id = s.task_id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
    `).all(req.userId!);

    const submittedTaskIds = new Set(
      (submissions as Array<{ task_id: string }>).map((s) => s.task_id)
    );

    res.json({
      tasksEnabled,
      defaultReward,
      tasks: tasks
        .filter((t) => t.is_active === 1)
        .map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          instructions: t.instructions,
          reward: Number(t.reward),
          alreadySubmitted: t.id === 'TASK-EARN' ? false : submittedTaskIds.has(t.id),
        })),
      submissions,
    });
  });

  app.post('/api/tasks/submit', requireUser, (req: AuthedRequest, res) => {
    if (getSetting('tasks_enabled', 'true') !== 'true') {
      res.status(403).json({ error: 'এই মুহূর্তে নতুন টাস্ক জমা নেওয়া সাময়িকভাবে বন্ধ আছে।' });
      return;
    }

    const { taskId, submittedEmail, proofText } = req.body ?? {};
    const resolvedTaskId = typeof taskId === 'string' && taskId.trim() ? taskId.trim() : 'TASK-EARN';
    if (typeof submittedEmail !== 'string' || !EMAIL_REGEX.test(submittedEmail.trim().toLowerCase()) || submittedEmail.trim().length > 120) {
      res.status(400).json({ error: 'অনুগ্রহ করে একটি সঠিক জিমেইল / ইমেইল ঠিকানা লিখুন।' });
      return;
    }
    const cleanProof = typeof proofText === 'string' && proofText.trim().length >= 3
      ? proofText.trim().slice(0, 800)
      : 'টাস্ক সম্পন্ন করা হয়েছে';

    const cleanEmail = submittedEmail.trim().toLowerCase();

    // Prevent users from submitting passwords/OTPs/recovery codes
    if (/(password|passcode|পাসওয়ার্ড|পাসওয়ার্ড|recovery\s*code|otp\s*[:=])/i.test(cleanProof)) {
      res.status(400).json({ error: 'নিরাপত্তার কারণে কোনো পাসওয়ার্ড, ওটিপি বা রিকভারি কোড জমা দেবেন না।' });
      return;
    }

    const task = db.prepare('SELECT id, title, reward, is_active FROM tasks WHERE id = ?').get(resolvedTaskId) as {
      id: string;
      title: string;
      reward: number;
      is_active: number;
    } | undefined;

    if (!task || task.is_active !== 1) {
      res.status(404).json({ error: 'নির্বাচিত টাস্কটি বর্তমানে সক্রিয় নেই।' });
      return;
    }

    const submitTx = db.transaction(() => {
      if (task.id !== 'TASK-EARN') {
        const dupUserTask = db.prepare('SELECT id FROM task_submissions WHERE user_id = ? AND task_id = ?').get(req.userId!, task.id);
        if (dupUserTask) {
          return { error: 'আপনি ইতিমধ্যেই এই টাস্কটি একবার জমা দিয়েছেন। ডুপ্লিকেট জমা গ্রহণযোগ্য নয়।', status: 409 as const };
        }
      }

      const dupEmailTask = db.prepare("SELECT id FROM task_submissions WHERE lower(submitted_email) = ? AND status != 'rejected'").get(cleanEmail);
      if (dupEmailTask) {
        return { error: 'এই জিমেইল ঠিকানাটি ইতিমধ্যেই জমা দেওয়া হয়েছে। ডুপ্লিকেট জমা গ্রহণযোগ্য নয়।', status: 409 as const };
      }

      const submissionId = `TSK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO task_submissions (id, user_id, task_id, submitted_email, proof_text, reward_amount, status, admin_note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', '', ?)
      `).run(submissionId, req.userId!, task.id, cleanEmail, cleanProof, Number(task.reward), now);

      addNotification(
        req.userId!,
        'টাস্ক জমা সফল হয়েছে',
        `আপনার জিমেইল (${cleanEmail}) রিভিউয়ের জন্য জমা দেওয়া হয়েছে। অ্যাডমিন Done করলে ৳${task.reward} ব্যালেন্সে যুক্ত হবে।`,
        'info'
      );

      return { submissionId, status: 201 as const };
    });

    const result = submitTx();
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.status(201).json({
      ok: true,
      submissionId: result.submissionId,
      message: `জমা সফল হয়েছে! অ্যাডমিন Done করলে আপনার ব্যালেন্সে ৳${task.reward} যোগ হবে।`,
    });
  });

  // --- REFERRAL ROUTES ---
  app.get('/api/referrals', requireUser, (req: AuthedRequest, res) => {
    const user = db.prepare('SELECT referral_code FROM users WHERE id = ?').get(req.userId!) as { referral_code: string };
    const invitedUsers = db.prepare('SELECT id, name, created_at FROM users WHERE referred_by = ? ORDER BY created_at DESC').all(req.userId!) as Array<{
      id: string;
      name: string;
      created_at: string;
    }>;

    res.json({
      referralCode: user.referral_code,
      referralReward: 0,
      totalInvited: invitedUsers.length,
      invitedUsers: invitedUsers.map((u) => ({
        id: u.id,
        name: u.name,
        joinedAt: u.created_at,
      })),
    });
  });

  // --- WITHDRAWAL ROUTES ---
  app.get('/api/withdrawals', requireUser, (req: AuthedRequest, res) => {
    const summary = buildUserSummary(req.userId!);
    const withdrawals = db.prepare(`
      SELECT id, bkash_number, amount, status, admin_note, created_at, updated_at
      FROM withdrawals
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(req.userId!);

    res.json({
      balance: summary?.user.balance ?? 0,
      availableBalance: summary?.user.availableBalance ?? 0,
      hasActiveWithdrawal: summary?.user.hasActiveWithdrawal ?? false,
      minWithdrawal: Number(getSetting('min_withdrawal', '20')),
      withdrawals,
    });
  });

  app.post('/api/withdrawals', requireUser, async (req: AuthedRequest, res) => {
    const { bkashNumber, amount } = req.body ?? {};
    const minWithdrawal = Number(getSetting('min_withdrawal', '20'));

    if (typeof bkashNumber !== 'string' || !BKASH_REGEX.test(bkashNumber.trim())) {
      res.status(400).json({ error: 'অনুগ্রহ করে ১১ সংখ্যার সঠিক বিকাশ নম্বর দিন (যেমন: 017XXXXXXXX)।' });
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < minWithdrawal || !Number.isInteger(numericAmount)) {
      res.status(400).json({ error: `সর্বনিম্ন উত্তোলন ৳${minWithdrawal} এবং পূর্ণসংখ্যা হতে হবে।` });
      return;
    }

    const cleanBkash = bkashNumber.trim();

    const withdrawTx = db.transaction(() => {
      const user = db.prepare('SELECT id, name, balance FROM users WHERE id = ?').get(req.userId!) as {
        id: string;
        name: string;
        balance: number;
      } | undefined;
      if (!user) {
        return { error: 'ইউজার অ্যাকাউন্ট পাওয়া যায়নি।', status: 404 as const };
      }

      const activeReq = db.prepare("SELECT id FROM withdrawals WHERE user_id = ? AND status IN ('pending', 'approved')").get(user.id);
      if (activeReq) {
        return { error: 'আপনার একটি উত্তোলনের অনুরোধ ইতিমধ্যেই প্রক্রিয়াধীন রয়েছে। সেটি সম্পন্ন হওয়ার পর নতুন অনুরোধ করুন।', status: 409 as const };
      }

      const heldRow = db.prepare("SELECT COALESCE(SUM(amount), 0) as held FROM withdrawals WHERE user_id = ? AND status IN ('pending', 'approved') AND balance_deducted = 0").get(user.id) as { held: number };
      const availableBalance = Number(user.balance) - Number(heldRow.held);

      if (availableBalance < numericAmount) {
        return { error: `অপর্যাপ্ত ব্যালেন্স! আপনার বর্তমান উপলব্ধ ব্যালেন্স ৳${availableBalance}।`, status: 400 as const };
      }

      const requestId = `WDR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO withdrawals (id, user_id, bkash_number, amount, status, balance_deducted, admin_note, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'pending', 0, '', ?, ?)
      `).run(requestId, user.id, cleanBkash, numericAmount, now, now);

      addNotification(
        user.id,
        'উত্তোলনের অনুরোধ গৃহীত হয়েছে',
        `বিকাশ নম্বর ${cleanBkash}-এ ৳${numericAmount} উত্তোলনের অনুরোধ (${requestId}) জমা হয়েছে। যাচাই-বাছাই শেষে পেমেন্ট প্রক্রিয়া করা হবে।`,
        'info'
      );

      return {
        status: 201 as const,
        requestId,
        createdAt: now,
        userName: user.name,
        userId: user.id,
      };
    });

    const result = withdrawTx();
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    // Fire Telegram alert asynchronously to both Admin IDs (8340427143, 8499775384)
    void sendTelegramWithdrawalAlert({
      userName: result.userName,
      userId: result.userId,
      bkashNumber: cleanBkash,
      amount: numericAmount,
      requestId: result.requestId,
      createdAt: result.createdAt,
    });

    res.status(201).json({
      ok: true,
      requestId: result.requestId,
      message: `উত্তোলনের অনুরোধ (${result.requestId}) সফলভাবে জমা হয়েছে। অ্যাডমিন যাচাই করার পর পেমেন্ট সম্পন্ন হবে।`,
    });
  });

  // --- SEPARATE ADMIN AUTH & MANAGEMENT ROUTES ---
  app.get('/api/admin/auth-status', (req, res) => {
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    const claimedHash = getSetting('admin_password_hash', '');
    const configured = Boolean(envPasscode || claimedHash);
    const token = extractToken(req, 'tmbd_admin_session');
    const payload = token ? verifyToken(token) : null;
    res.json({
      configured,
      usingEnvPasscode: Boolean(envPasscode),
      authenticated: Boolean(payload && payload.role === 'admin'),
    });
  });

  app.post('/api/admin/bootstrap', (req, res) => {
    if (!verifyMutationOrigin(req)) {
      res.status(403).json({ error: 'অননুমোদিত রিকোয়েস্ট উৎস।' });
      return;
    }
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    const existingHash = getSetting('admin_password_hash', '');
    if (envPasscode || existingHash) {
      res.status(403).json({ error: 'অ্যাডমিন পাসওয়ার্ড ইতিমধ্যেই নির্ধারিত আছে।' });
      return;
    }

    const { passcode } = req.body ?? {};
    if (typeof passcode !== 'string' || passcode.trim().length < 6 || passcode.trim().length > 100) {
      res.status(400).json({ error: 'অ্যাডমিন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' });
      return;
    }

    const hash = hashPassword(passcode.trim());
    setSetting('admin_password_hash', hash);

    const token = signToken({
      sub: 'admin',
      role: 'admin',
      exp: Date.now() + 1000 * 60 * 60 * 12,
    });
    setAuthCookie(req, res, 'tmbd_admin_session', token, 60 * 60 * 12);
    res.status(201).json({ ok: true, token });
  });

  app.post('/api/admin/login', (req, res) => {
    if (!verifyMutationOrigin(req)) {
      res.status(403).json({ error: 'অননুমোদিত রিকোয়েস্ট উৎস।' });
      return;
    }
    const { passcode } = req.body ?? {};
    if (typeof passcode !== 'string' || !passcode) {
      res.status(400).json({ error: 'অ্যাডমিন পাসওয়ার্ড দিন।' });
      return;
    }

    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    const storedHash = getSetting('admin_password_hash', '');

    let valid = false;
    if (envPasscode) {
      valid = timingSafeStringEqual(passcode.trim(), envPasscode);
    } else if (storedHash) {
      valid = verifyPassword(passcode.trim(), storedHash);
    } else {
      res.status(400).json({ error: 'প্রথমে অ্যাডমিন পাসওয়ার্ড সেটআপ করুন।' });
      return;
    }

    if (!valid) {
      res.status(401).json({ error: 'অ্যাডমিন পাসওয়ার্ড সঠিক নয়।' });
      return;
    }

    const token = signToken({
      sub: 'admin',
      role: 'admin',
      exp: Date.now() + 1000 * 60 * 60 * 12,
    });
    setAuthCookie(req, res, 'tmbd_admin_session', token, 60 * 60 * 12);
    res.json({ ok: true, token });
  });

  app.post('/api/admin/logout', (req, res) => {
    clearAuthCookie(req, res, 'tmbd_admin_session');
    res.json({ ok: true });
  });

  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const userStats = db.prepare('SELECT COUNT(*) as totalUsers, COALESCE(SUM(balance), 0) as totalUserBalance FROM users').get() as {
      totalUsers: number;
      totalUserBalance: number;
    };
    const subStats = db.prepare(`
      SELECT
        COUNT(*) as totalSubmissions,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingSubmissions,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approvedSubmissions,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejectedSubmissions
      FROM task_submissions
    `).get() as {
      totalSubmissions: number;
      pendingSubmissions: number | null;
      approvedSubmissions: number | null;
      rejectedSubmissions: number | null;
    };
    const wdrStats = db.prepare(`
      SELECT
        COUNT(*) as totalWithdrawals,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingWithdrawals,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approvedWithdrawals,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paidWithdrawals,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as totalPaidAmount
      FROM withdrawals
    `).get() as {
      totalWithdrawals: number;
      pendingWithdrawals: number | null;
      approvedWithdrawals: number | null;
      paidWithdrawals: number | null;
      totalPaidAmount: number;
    };

    res.json({
      stats: {
        totalUsers: userStats.totalUsers,
        totalUserBalance: Number(userStats.totalUserBalance || 0),
        totalSubmissions: subStats.totalSubmissions,
        pendingSubmissions: Number(subStats.pendingSubmissions || 0),
        approvedSubmissions: Number(subStats.approvedSubmissions || 0),
        rejectedSubmissions: Number(subStats.rejectedSubmissions || 0),
        totalWithdrawals: wdrStats.totalWithdrawals,
        pendingWithdrawals: Number(wdrStats.pendingWithdrawals || 0),
        approvedWithdrawals: Number(wdrStats.approvedWithdrawals || 0),
        paidWithdrawals: Number(wdrStats.paidWithdrawals || 0),
        totalPaidAmount: Number(wdrStats.totalPaidAmount || 0),
      },
      settings: getPlatformSettings(),
      usingEnvPasscode: Boolean(process.env.ADMIN_PASSCODE?.trim()),
      telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
      telegramAdminIds: TELEGRAM_ADMIN_IDS,
    });
  });

  app.get('/api/admin/users', requireAdmin, (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const like = `%${q}%`;
    const users = q
      ? db.prepare(`
          SELECT u.id, u.name, u.email, u.avatar_url, u.referral_code, u.referred_by, u.balance, u.created_at,
            (SELECT COUNT(*) FROM task_submissions s WHERE s.user_id = u.id AND s.status = 'approved') as completed_tasks,
            (SELECT COALESCE(SUM(amount), 0) FROM withdrawals w WHERE w.user_id = u.id AND w.status = 'paid') as total_withdrawn,
            (SELECT COUNT(*) FROM users r WHERE r.referred_by = u.id) as invited_count
          FROM users u
          WHERE u.id LIKE ? OR u.name LIKE ? OR u.email LIKE ?
          ORDER BY u.created_at DESC
        `).all(like, like, like)
      : db.prepare(`
          SELECT u.id, u.name, u.email, u.avatar_url, u.referral_code, u.referred_by, u.balance, u.created_at,
            (SELECT COUNT(*) FROM task_submissions s WHERE s.user_id = u.id AND s.status = 'approved') as completed_tasks,
            (SELECT COALESCE(SUM(amount), 0) FROM withdrawals w WHERE w.user_id = u.id AND w.status = 'paid') as total_withdrawn,
            (SELECT COUNT(*) FROM users r WHERE r.referred_by = u.id) as invited_count
          FROM users u
          ORDER BY u.created_at DESC
        `).all();

    res.json({ users });
  });

  app.patch('/api/admin/users/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const user = db.prepare('SELECT id, name, email, balance FROM users WHERE id = ?').get(id) as {
      id: string;
      name: string;
      email: string;
      balance: number;
    } | undefined;

    if (!user) {
      res.status(404).json({ error: 'ইউজার খুঁজে পাওয়া যায়নি।' });
      return;
    }

    const { name, email, balance } = req.body ?? {};
    const nextName = typeof name === 'string' && name.trim().length >= 2 && name.trim().length <= 60
      ? name.trim()
      : user.name;
    let nextEmail = user.email;
    if (typeof email === 'string' && email.trim()) {
      const clean = email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(clean)) {
        res.status(400).json({ error: 'সঠিক ইমেইল ঠিকানা দিন।' });
        return;
      }
      const dup = db.prepare('SELECT id FROM users WHERE lower(email) = ? AND id != ?').get(clean, id);
      if (dup) {
        res.status(409).json({ error: 'এই ইমেইল অন্য ইউজারের সাথে যুক্ত আছে।' });
        return;
      }
      nextEmail = clean;
    }

    let nextBalance = Number(user.balance);
    if (balance !== undefined) {
      const numBal = Number(balance);
      if (!Number.isFinite(numBal) || numBal < 0 || numBal > 1000000) {
        res.status(400).json({ error: 'ব্যালেন্স ০ থেকে ১০,০০,০০০ এর মধ্যে হতে হবে।' });
        return;
      }
      nextBalance = Math.round(numBal);
    }

    db.prepare('UPDATE users SET name = ?, email = ?, balance = ? WHERE id = ?').run(nextName, nextEmail, nextBalance, id);
    if (nextBalance !== Number(user.balance)) {
      addNotification(
        id,
        'ব্যালেন্স আপডেট হয়েছে',
        `অ্যাডমিন কর্তৃক আপনার অ্যাকাউন্টের ব্যালেন্স ৳${nextBalance} নির্ধারণ করা হয়েছে।`,
        'info'
      );
    }
    res.json({ ok: true });
  });

  app.get('/api/admin/submissions', requireAdmin, (_req, res) => {
    const submissions = db.prepare(`
      SELECT s.id, s.user_id, u.name as user_name, u.email as user_email, s.task_id, t.title as task_title,
             s.submitted_email, s.proof_text, s.reward_amount, s.status, s.admin_note, s.created_at, s.reviewed_at
      FROM task_submissions s
      JOIN users u ON u.id = s.user_id
      JOIN tasks t ON t.id = s.task_id
      ORDER BY CASE WHEN s.status = 'pending' THEN 0 ELSE 1 END, s.created_at DESC
    `).all();
    res.json({ submissions });
  });

  app.post('/api/admin/submissions/:id/review', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { action, adminNote } = req.body ?? {};
    if (action !== 'approve' && action !== 'reject') {
      res.status(400).json({ error: 'সঠিক অ্যাকশন দিন (approve বা reject)।' });
      return;
    }

    const note = typeof adminNote === 'string' ? adminNote.trim().slice(0, 300) : '';

    const reviewTx = db.transaction(() => {
      const submission = db.prepare(`
        SELECT s.id, s.user_id, s.reward_amount, s.status, t.title as task_title
        FROM task_submissions s
        JOIN tasks t ON t.id = s.task_id
        WHERE s.id = ?
      `).get(id) as {
        id: string;
        user_id: string;
        reward_amount: number;
        status: string;
        task_title: string;
      } | undefined;

      if (!submission) {
        return { error: 'টাস্ক জমা খুঁজে পাওয়া যায়নি।', status: 404 as const };
      }
      if (submission.status !== 'pending') {
        return { error: 'এই টাস্কটি ইতিমধ্যেই রিভিউ করা হয়েছে। ডুপ্লিকেট পুরস্কার প্রদান সম্ভব নয়।', status: 409 as const };
      }

      const now = new Date().toISOString();
      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      db.prepare(`
        UPDATE task_submissions
        SET status = ?, admin_note = ?, reviewed_at = ?
        WHERE id = ? AND status = 'pending'
      `).run(newStatus, note, now, submission.id);

      if (action === 'approve') {
        db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(Number(submission.reward_amount), submission.user_id);
        addNotification(
          submission.user_id,
          'কাজটি সম্পূর্ণভাবে হয়েছে!',
          `আপনার টাস্কটি (${submission.task_title}) Done করা হয়েছে এবং ব্যালেন্সে ৳${submission.reward_amount} যোগ হয়েছে।`,
          'success'
        );
      } else {
        addNotification(
          submission.user_id,
          'টাস্ক বাতিল করা হয়েছে',
          `আপনার "${submission.task_title}" টাস্কটি বাতিল করা হয়েছে।${note ? ` কারণ: ${note}` : ''}`,
          'error'
        );
      }

      return { status: 200 as const, newStatus };
    });

    const result = reviewTx();
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ ok: true, status: result.newStatus });
  });

  app.get('/api/admin/withdrawals', requireAdmin, (_req, res) => {
    const withdrawals = db.prepare(`
      SELECT w.id, w.user_id, u.name as user_name, u.balance as user_balance, w.bkash_number, w.amount,
             w.status, w.balance_deducted, w.admin_note, w.created_at, w.updated_at
      FROM withdrawals w
      JOIN users u ON u.id = w.user_id
      ORDER BY CASE WHEN w.status = 'pending' THEN 0 WHEN w.status = 'approved' THEN 1 ELSE 2 END, w.created_at DESC
    `).all();
    res.json({ withdrawals });
  });

  app.post('/api/admin/withdrawals/:id/status', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { status, adminNote } = req.body ?? {};
    if (status !== 'approved' && status !== 'rejected' && status !== 'paid') {
      res.status(400).json({ error: 'সঠিক স্ট্যাটাস দিন (approved, rejected, বা paid)।' });
      return;
    }

    const note = typeof adminNote === 'string' ? adminNote.trim().slice(0, 300) : '';
    const result = processWithdrawalStatusUpdate(id, status, note);
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/admin/tasks', requireAdmin, (_req, res) => {
    const tasks = db.prepare('SELECT id, title, description, instructions, reward, is_active, created_at FROM tasks ORDER BY created_at ASC').all();
    res.json({ tasks });
  });

  app.post('/api/admin/tasks', requireAdmin, (req, res) => {
    const { title, description, instructions, reward } = req.body ?? {};
    if (typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 120) {
      res.status(400).json({ error: 'টাস্কের শিরোনাম ৩ থেকে ১২০ অক্ষরের মধ্যে দিন।' });
      return;
    }
    if (typeof description !== 'string' || description.trim().length < 5 || description.trim().length > 400) {
      res.status(400).json({ error: 'টাস্কের বিবরণ ৫ থেকে ৪০০ অক্ষরের মধ্যে দিন।' });
      return;
    }
    if (typeof instructions !== 'string' || instructions.trim().length < 5 || instructions.trim().length > 800) {
      res.status(400).json({ error: 'নির্দেশনা ৫ থেকে ৮০০ অক্ষরের মধ্যে দিন।' });
      return;
    }
    const numReward = Number(reward);
    if (!Number.isFinite(numReward) || numReward < 1 || numReward > 5000) {
      res.status(400).json({ error: 'টাস্ক পুরস্কার ৳1 থেকে ৳5000 এর মধ্যে হতে হবে।' });
      return;
    }

    const id = `TASK-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    db.prepare(`
      INSERT INTO tasks (id, title, description, instructions, reward, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(id, title.trim(), description.trim(), instructions.trim(), numReward, new Date().toISOString());

    res.status(201).json({ ok: true, id });
  });

  app.patch('/api/admin/tasks/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const task = db.prepare('SELECT id, title, description, instructions, reward, is_active FROM tasks WHERE id = ?').get(id) as {
      id: string;
      title: string;
      description: string;
      instructions: string;
      reward: number;
      is_active: number;
    } | undefined;

    if (!task) {
      res.status(404).json({ error: 'টাস্ক খুঁজে পাওয়া যায়নি।' });
      return;
    }

    const { title, description, instructions, reward, isActive } = req.body ?? {};
    const nextTitle = typeof title === 'string' && title.trim().length >= 3 ? title.trim().slice(0, 120) : task.title;
    const nextDesc = typeof description === 'string' && description.trim().length >= 5 ? description.trim().slice(0, 400) : task.description;
    const nextInst = typeof instructions === 'string' && instructions.trim().length >= 5 ? instructions.trim().slice(0, 800) : task.instructions;
    const nextReward = reward !== undefined && Number.isFinite(Number(reward)) && Number(reward) >= 1 && Number(reward) <= 5000
      ? Number(reward)
      : Number(task.reward);
    const nextActive = typeof isActive === 'boolean' ? (isActive ? 1 : 0) : task.is_active;

    db.prepare(`
      UPDATE tasks
      SET title = ?, description = ?, instructions = ?, reward = ?, is_active = ?
      WHERE id = ?
    `).run(nextTitle, nextDesc, nextInst, nextReward, nextActive, id);

    res.json({ ok: true });
  });

  app.delete('/api/admin/tasks/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'টাস্ক খুঁজে পাওয়া যায়নি।' });
      return;
    }
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    res.json({ ok: true });
  });

  app.post('/api/admin/notifications/broadcast', requireAdmin, (req, res) => {
    const { title, message, targetUserId } = req.body ?? {};
    if (typeof title !== 'string' || title.trim().length < 2 || title.trim().length > 100) {
      res.status(400).json({ error: 'নোটিশের শিরোনাম ২ থেকে ১০০ অক্ষরের মধ্যে দিন।' });
      return;
    }
    if (typeof message !== 'string' || message.trim().length < 3 || message.trim().length > 500) {
      res.status(400).json({ error: 'নোটিশের বার্তা ৩ থেকে ৫০০ অক্ষরের মধ্যে দিন।' });
      return;
    }

    const cleanTitle = title.trim();
    const cleanMsg = message.trim();

    if (typeof targetUserId === 'string' && targetUserId.trim()) {
      const target = db.prepare('SELECT id FROM users WHERE id = ?').get(targetUserId.trim()) as { id: string } | undefined;
      if (!target) {
        res.status(404).json({ error: 'নির্বাচিত ইউজার আইডি পাওয়া যায়নি।' });
        return;
      }
      addNotification(target.id, cleanTitle, cleanMsg, 'info');
      res.json({ ok: true, sentCount: 1 });
      return;
    }

    const allUsers = db.prepare('SELECT id FROM users').all() as Array<{ id: string }>;
    const tx = db.transaction(() => {
      for (const u of allUsers) {
        addNotification(u.id, cleanTitle, cleanMsg, 'info');
      }
    });
    tx();
    res.json({ ok: true, sentCount: allUsers.length });
  });

  app.post('/api/admin/change-passcode', requireAdmin, (req, res) => {
    if (process.env.ADMIN_PASSCODE?.trim()) {
      res.status(400).json({ error: 'ADMIN_PASSCODE এনভায়রনমেন্ট থেকে সেট করা আছে; Secrets প্যানেল থেকে পরিবর্তন করুন।' });
      return;
    }
    const { currentPasscode, newPasscode } = req.body ?? {};
    if (typeof currentPasscode !== 'string' || typeof newPasscode !== 'string' || newPasscode.trim().length < 6 || newPasscode.trim().length > 100) {
      res.status(400).json({ error: 'নতুন অ্যাডমিন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' });
      return;
    }
    const storedHash = getSetting('admin_password_hash', '');
    if (storedHash && !verifyPassword(currentPasscode.trim(), storedHash)) {
      res.status(401).json({ error: 'বর্তমান অ্যাডমিন পাসওয়ার্ড সঠিক নয়।' });
      return;
    }
    setSetting('admin_password_hash', hashPassword(newPasscode.trim()));
    res.json({ ok: true });
  });

  app.patch('/api/admin/settings', requireAdmin, (req, res) => {
    const {
      taskReward,
      tasksEnabled,
      minWithdrawal,
      applyRewardToAllTasks,
      appName,
      welcomeTitle,
      welcomeSubtitle,
      announcementText,
      earnTitle,
      withdrawMethodLabel,
    } = req.body ?? {};

    if (taskReward !== undefined) {
      const r = Number(taskReward);
      if (!Number.isFinite(r) || r < 1 || r > 5000) {
        res.status(400).json({ error: 'টাস্ক পুরস্কার ৳1 থেকে ৳5000 এর মধ্যে হতে হবে।' });
        return;
      }
      setSetting('task_reward', String(r));
      if (applyRewardToAllTasks === true) {
        db.prepare('UPDATE tasks SET reward = ?').run(r);
      }
    }
    if (typeof tasksEnabled === 'boolean') {
      setSetting('tasks_enabled', tasksEnabled ? 'true' : 'false');
    }
    if (minWithdrawal !== undefined) {
      const m = Number(minWithdrawal);
      if (!Number.isFinite(m) || m < 10 || m > 10000) {
        res.status(400).json({ error: 'সর্বনিম্ন উত্তোলন ৳10 থেকে ৳10000 এর মধ্যে হতে হবে।' });
        return;
      }
      setSetting('min_withdrawal', String(m));
    }
    if (typeof appName === 'string' && appName.trim().length >= 2) {
      setSetting('app_name', appName.trim().slice(0, 50));
    }
    if (typeof welcomeTitle === 'string' && welcomeTitle.trim().length >= 3) {
      setSetting('welcome_title', welcomeTitle.trim().slice(0, 140));
    }
    if (typeof welcomeSubtitle === 'string' && welcomeSubtitle.trim().length >= 3) {
      setSetting('welcome_subtitle', welcomeSubtitle.trim().slice(0, 300));
    }
    if (typeof announcementText === 'string') {
      setSetting('announcement_text', announcementText.trim().slice(0, 300));
    }
    if (typeof earnTitle === 'string' && earnTitle.trim().length >= 2) {
      setSetting('earn_title', earnTitle.trim().slice(0, 80));
    }
    if (typeof withdrawMethodLabel === 'string' && withdrawMethodLabel.trim().length >= 2) {
      setSetting('withdraw_method_label', withdrawMethodLabel.trim().slice(0, 80));
    }

    res.json({
      ok: true,
      settings: getPlatformSettings(),
    });
  });

  // Frontend serving (Vite dev middleware or static dist/)
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Task Money BD server listening on http://0.0.0.0:${PORT}`);
    startTelegramCallbackPoller();
  });
}

startServer().catch((err) => {
  console.error('Failed to start Task Money BD server:', err);
  process.exit(1);
});
