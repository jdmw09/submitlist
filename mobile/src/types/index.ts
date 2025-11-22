export interface User {
  id: number;
  email: string;
  username?: string;
  name: string;
  role?: 'member' | 'admin' | 'super_admin';
  email_verified?: boolean;
  email_verified_at?: string;
  created_at: string;
}

// Billing types
export interface SubscriptionPlan {
  name: string;
  slug: 'free' | 'paid' | 'premium';
  price_cents: number;
  billing_interval: string | null;
  max_storage_bytes: number;
  file_retention_days: number | null;
}

export interface BillingStatus {
  plan: SubscriptionPlan;
  status: string;
  trial_ends?: string;
  period_ends?: string;
  payment_platform?: 'stripe' | 'apple' | 'google';
  storage: {
    used_bytes: number;
    max_bytes: number;
    percentage: number;
  };
}

export interface SubscriptionDetails {
  subscription: {
    plan: SubscriptionPlan;
    status: string;
    payment_platform?: string;
    current_period_start?: string;
    current_period_end?: string;
    trial_end?: string;
    canceled_at?: string;
    auto_renew: boolean;
  } | null;
  message?: string;
}

export interface Organization {
  id: number;
  name: string;
  role: 'admin' | 'member';
  created_at: string;
}

export interface Task {
  id: number;
  organization_id: number;
  title: string;
  details?: string;
  assigned_user_id?: number;
  assigned_user_name?: string;
  created_by_id: number;
  created_by_name?: string;
  start_date?: string;
  end_date?: string;
  schedule_type: 'one_time' | 'daily' | 'weekly' | 'monthly';
  schedule_frequency: number;
  status: 'pending' | 'in_progress' | 'submitted' | 'completed' | 'overdue';
  requirements?: TaskRequirement[];
  completions?: TaskCompletion[];
  total_requirements?: number;
  completed_requirements?: number;
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskRequirement {
  id: number;
  task_id: number;
  description: string;
  order_index: number;
  completed: boolean;
  completed_at?: string;
  created_at: string;
}

export interface TaskCompletion {
  id: number;
  task_id: number;
  requirement_id?: number;
  user_id: number;
  user_name?: string;
  completion_type: 'text' | 'image' | 'video' | 'document';
  text_content?: string;
  file_path?: string;
  requirement_description?: string;
  completed_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  type: 'task_assigned' | 'task_due_soon' | 'task_completed' | 'task_overdue';
  title: string;
  message?: string;
  task_id?: number;
  task_title?: string;
  read: boolean;
  created_at: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}
