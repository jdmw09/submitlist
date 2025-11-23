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
  status: 'in_progress' | 'submitted' | 'completed' | 'overdue';
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

export interface TaskComment {
  id: number;
  task_id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  content: string;
  parent_id?: number;
  is_edited: boolean;
  edited_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  type: 'task_assigned' | 'task_due_soon' | 'task_completed' | 'task_overdue' | 'task_comment';
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
