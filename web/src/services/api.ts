import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://submitlist.space/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests and handle FormData properly
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData - let the browser handle it
  // This ensures the correct boundary is included for multipart/form-data
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  return config;
});

// Auth API
export const authAPI = {
  register: (email: string, username: string, password: string, name: string) =>
    api.post('/auth/register', { email, username, password, name }),

  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  getProfile: () => api.get('/auth/profile'),

  // Email verification
  resendVerificationEmail: () => api.post('/auth/resend-verification'),

  verifyEmail: (token: string) => api.get(`/auth/verify-email/${token}`),

  getVerificationStatus: () => api.get('/auth/verification-status'),

  // Password reset
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),

  validateResetToken: (token: string) => api.get(`/auth/validate-reset-token/${token}`),

  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }),
};

// Admin API
export const adminAPI = {
  // User management
  getAllUsers: (params?: { search?: string; role?: string; status?: string; page?: number; limit?: number }) =>
    api.get('/admin/users', { params }),

  getUserById: (userId: number) => api.get(`/admin/users/${userId}`),

  updateUserRole: (userId: number, role: 'member' | 'admin' | 'super_admin') =>
    api.put(`/admin/users/${userId}/role`, { role }),

  updateUserStatus: (userId: number, status: 'active' | 'suspended') =>
    api.put(`/admin/users/${userId}/status`, { status }),

  deleteUser: (userId: number) => api.delete(`/admin/users/${userId}`),

  forcePasswordReset: (userId: number) => api.post(`/admin/users/${userId}/force-password-reset`),

  // Audit logs
  getAuditLogs: (params?: { page?: number; limit?: number; adminId?: number; targetUserId?: number; action?: string }) =>
    api.get('/admin/audit-logs', { params }),

  // Organization management
  getAllOrganizations: () => api.get('/admin/organizations'),

  getUserOrganizations: (userId: number) => api.get(`/admin/users/${userId}/organizations`),

  addUserToOrganization: (userId: number, organizationId: number, role?: 'member' | 'admin') =>
    api.post(`/admin/users/${userId}/organizations`, { organizationId, role }),

  removeUserFromOrganization: (userId: number, orgId: number) =>
    api.delete(`/admin/users/${userId}/organizations/${orgId}`),

  updateUserOrganizationRole: (userId: number, orgId: number, role: 'member' | 'admin') =>
    api.put(`/admin/users/${userId}/organizations/${orgId}/role`, { role }),
};

// Organization API
export const organizationAPI = {
  create: (name: string, description?: string, allowJoinRequests?: boolean, isPublic?: boolean) =>
    api.post('/organizations', { name, description, allowJoinRequests, isPublic }),

  getAll: () => api.get('/organizations'),

  getDetails: (organizationId: number) =>
    api.get(`/organizations/${organizationId}`),

  getMembers: (organizationId: number) =>
    api.get(`/organizations/${organizationId}/members`),

  addMember: (organizationId: number, email: string, role?: string) =>
    api.post(`/organizations/${organizationId}/members`, { email, role }),

  updateMemberRole: (organizationId: number, memberId: number, role: string) =>
    api.put(`/organizations/${organizationId}/members/${memberId}`, { role }),

  removeMember: (organizationId: number, memberId: number) =>
    api.delete(`/organizations/${organizationId}/members/${memberId}`),

  // Phase 0: Invite management
  createInvite: (
    organizationId: number,
    data: {
      email?: string;
      role?: string;
      expiresInDays?: number;
      maxUses?: number;
    }
  ) => api.post(`/organizations/${organizationId}/invites`, data),

  getInviteDetails: (inviteCode: string) =>
    api.get(`/organizations/invites/${inviteCode}`),

  acceptInvite: (inviteCode: string) =>
    api.post(`/organizations/invites/${inviteCode}/accept`),

  // Phase 0: Join requests
  createJoinRequest: (organizationId: number, message: string) =>
    api.post(`/organizations/${organizationId}/join-requests`, { message }),

  getJoinRequests: (organizationId: number, status?: string) =>
    api.get(`/organizations/${organizationId}/join-requests`, { params: { status } }),

  reviewJoinRequest: (
    requestId: number,
    action: 'approved' | 'rejected',
    responseMessage?: string
  ) => api.put(`/organizations/join-requests/${requestId}`, { action, responseMessage }),

  // Phase 0: Public organizations
  getPublicOrganizations: (search?: string) =>
    api.get('/organizations/public', { params: { search } }),

  // Phase 1: Task groups
  createGroup: (organizationId: number, name: string, description?: string) =>
    api.post(`/organizations/${organizationId}/groups`, { name, description }),

  getGroups: (organizationId: number) =>
    api.get(`/organizations/${organizationId}/groups`),
};

// Task API
export const taskAPI = {
  create: (taskData: any) => api.post('/tasks', taskData),

  getAll: (organizationId: number, params?: any) =>
    api.get(`/tasks/organization/${organizationId}`, { params }),

  getById: (taskId: number) => api.get(`/tasks/${taskId}`),

  update: (taskId: number, updates: any) =>
    api.put(`/tasks/${taskId}`, updates),

  delete: (taskId: number, deleteFiles?: boolean) =>
    api.delete(`/tasks/${taskId}`, { data: { deleteFiles } }),

  updateRequirement: (requirementId: number, completed: boolean) =>
    api.put(`/tasks/requirements/${requirementId}`, { completed }),

  addCompletion: (taskId: number, formData: FormData) =>
    // Don't set Content-Type manually - axios will set it with correct boundary for FormData
    api.post(`/tasks/${taskId}/completions`, formData),

  getCompletions: (taskId: number) =>
    api.get(`/tasks/${taskId}/completions`),

  deleteCompletion: (completionId: number) =>
    api.delete(`/tasks/completions/${completionId}`),

  submit: (taskId: number) =>
    api.post(`/tasks/${taskId}/submit`),

  review: (taskId: number, action: 'approved' | 'rejected', comments?: string) =>
    api.post(`/tasks/${taskId}/review`, { action, comments }),

  getAuditLogs: (taskId: number) =>
    api.get(`/tasks/${taskId}/audit-logs`),
};

// Notification API
export const notificationAPI = {
  getAll: (unreadOnly?: boolean) =>
    api.get('/notifications', { params: { unreadOnly } }),

  markAsRead: (notificationId: number) =>
    api.put(`/notifications/${notificationId}/read`),

  markAllAsRead: () => api.put('/notifications/read-all'),

  delete: (notificationId: number) =>
    api.delete(`/notifications/${notificationId}`),
};

export default api;
