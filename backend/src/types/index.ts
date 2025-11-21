export interface User {
  id: number;
  email: string;
  username?: string;
  password_hash?: string;
  name: string;
  role: 'member' | 'admin' | 'super_admin';
  email_verified: boolean;
  email_verified_at?: Date;
  force_password_change: boolean;
  last_password_change: Date;
  account_status: 'active' | 'suspended' | 'deleted';
  created_at: Date;
}

export interface Organization {
  id: number;
  name: string;
  created_at: Date;
}

export interface OrganizationMember {
  id: number;
  organization_id: number;
  user_id: number;
  role: 'admin' | 'member';
  joined_at: Date;
}

export interface Task {
  id: number;
  organization_id: number;
  title: string;
  details?: string;
  assigned_user_id?: number;
  created_by_id: number;
  start_date?: Date;
  end_date?: Date;
  schedule_type: 'one_time' | 'daily' | 'weekly' | 'monthly';
  schedule_frequency: number;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  parent_template_id?: number;
  created_at: Date;
  updated_at: Date;
}

export interface TaskRequirement {
  id: number;
  task_id: number;
  description: string;
  order_index: number;
  completed: boolean;
  completed_at?: Date;
  created_at: Date;
}

export interface TaskCompletion {
  id: number;
  task_id: number;
  requirement_id?: number;
  user_id: number;
  completion_type: 'text' | 'image' | 'video';
  text_content?: string;
  file_path?: string;
  completed_at: Date;
}

export interface Notification {
  id: number;
  user_id: number;
  type: 'task_assigned' | 'task_due_soon' | 'task_completed' | 'task_overdue';
  title: string;
  message?: string;
  task_id?: number;
  read: boolean;
  created_at: Date;
}

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

export interface JWTPayload {
  userId: number;
  email: string;
  role?: 'member' | 'admin' | 'super_admin';
}

export interface EmailVerificationToken {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
  created_at: Date;
  used_at?: Date;
  is_valid: boolean;
}

export interface PasswordResetToken {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
  created_at: Date;
  used_at?: Date;
  is_valid: boolean;
  created_by_admin_id?: number;
  ip_address?: string;
}

export interface AdminAuditLog {
  id: number;
  admin_id: number;
  action: string;
  target_user_id?: number;
  target_organization_id?: number;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}
