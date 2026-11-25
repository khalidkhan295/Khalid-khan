export type UserTab = 'home' | 'tasks' | 'refer' | 'withdraw' | 'profile';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  referralCode: string;
  balance: number;
  availableBalance: number;
  heldWithdrawals: number;
  hasActiveWithdrawal: boolean;
  completedTasks: number;
  pendingTasks: number;
  totalEarnings: number;
  totalWithdrawn: number;
  invitedUsers: number;
  availableTasksCount: number;
  createdAt: string;
}

export interface PlatformSettings {
  taskReward: number;
  tasksEnabled: boolean;
  minWithdrawal: number;
  referralReward: number;
  appName: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  announcementText: string;
  earnTitle: string;
  withdrawMethodLabel: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  is_read: number;
  created_at: string;
}

export interface MeResponse {
  user: UserProfile;
  settings: PlatformSettings;
  unreadNotifications: number;
  notifications: AppNotification[];
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  instructions: string;
  reward: number;
  alreadySubmitted: boolean;
}

export interface TaskSubmission {
  id: string;
  task_id: string;
  task_title: string;
  submitted_email: string;
  proof_text: string;
  reward_amount: number;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string;
  created_at: string;
  reviewed_at: string | null;
}

export interface InvitedUser {
  id: string;
  name: string;
  joinedAt: string;
}

export interface WithdrawalItem {
  id: string;
  bkash_number: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  admin_note: string;
  created_at: string;
  updated_at: string;
}

export interface AdminOverview {
  stats: {
    totalUsers: number;
    totalUserBalance: number;
    totalSubmissions: number;
    pendingSubmissions: number;
    approvedSubmissions: number;
    rejectedSubmissions: number;
    totalWithdrawals: number;
    pendingWithdrawals: number;
    approvedWithdrawals: number;
    paidWithdrawals: number;
    totalPaidAmount: number;
  };
  settings: PlatformSettings;
  usingEnvPasscode: boolean;
  telegramConfigured: boolean;
  telegramAdminIds: string[];
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
  referral_code: string;
  referred_by: string | null;
  balance: number;
  created_at: string;
  completed_tasks: number;
  total_withdrawn: number;
  invited_count: number;
}

export interface AdminSubmissionRow {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  task_id: string;
  task_title: string;
  submitted_email: string;
  proof_text: string;
  reward_amount: number;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string;
  created_at: string;
  reviewed_at: string | null;
}

export interface AdminWithdrawalRow {
  id: string;
  user_id: string;
  user_name: string;
  user_balance: number;
  bkash_number: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  balance_deducted: number;
  admin_note: string;
  created_at: string;
  updated_at: string;
}

export interface AdminTaskRow {
  id: string;
  title: string;
  description: string;
  instructions: string;
  reward: number;
  is_active: number;
  created_at: string;
}
