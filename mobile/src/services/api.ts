import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// API URL configuration:
// - For development: http://localhost:3000/api (iOS simulator)
// - For development: http://10.0.2.2:3000/api (Android emulator)
// - For production: https://submitlist.space/api
const API_URL = Constants.expoConfig?.extra?.apiUrl || 'https://submitlist.space/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests and handle FormData properly
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData - let the browser/native handle it
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

  // Organization settings
  getSettings: (organizationId: number) =>
    api.get(`/organizations/${organizationId}/settings`),

  updateSettings: (
    organizationId: number,
    settings: {
      defaultTaskSort?: 'due_date' | 'priority';
      hideCompletedTasks?: boolean;
      autoArchiveEnabled?: boolean;
      autoArchiveAfterDays?: number;
      archiveSchedule?: 'daily' | 'weekly_sunday' | 'weekly_monday';
    }
  ) => api.put(`/organizations/${organizationId}/settings`, settings),
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

  // Task copy and archive
  copy: (taskId: number, data?: { title?: string; endDate?: string; assignedUserIds?: number[]; groupId?: number }) =>
    api.post(`/tasks/${taskId}/copy`, data),

  archive: (taskId: number) =>
    api.post(`/tasks/${taskId}/archive`),

  unarchive: (taskId: number) =>
    api.post(`/tasks/${taskId}/unarchive`),

  getArchived: (organizationId: number) =>
    api.get(`/tasks/organization/${organizationId}/archived`),
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

// Billing API
export const billingAPI = {
  // Get billing status for current organization
  getStatus: (organizationId: number) =>
    api.get('/billing/status', { params: { organizationId } }),

  // Get available subscription plans
  getPlans: () => api.get('/billing/plans'),

  // Get storage breakdown by user (admin only)
  getStorageBreakdown: (organizationId: number) =>
    api.get('/billing/storage/breakdown', { params: { organizationId } }),

  // Check if upload is allowed
  checkUploadAllowed: (organizationId: number, fileSize: number) =>
    api.post('/billing/storage/check-upload', { organizationId, fileSize }),
};

// In-App Purchase API
export const iapAPI = {
  // Verify Apple App Store receipt
  verifyAppleReceipt: (transactionId: string, productId: string, receipt?: string) =>
    api.post('/iap/verify/apple', { transactionId, productId, receipt }),

  // Verify Google Play purchase
  verifyGooglePurchase: (purchaseToken: string, productId: string) =>
    api.post('/iap/verify/google', { purchaseToken, productId }),

  // Restore purchases from app stores
  restorePurchases: (platform: 'apple' | 'google', receipts?: any[]) =>
    api.post('/iap/restore', { platform, receipts }),

  // Get subscription management URL
  getManagementUrl: () => api.get('/iap/management-url'),

  // Get detailed subscription info
  getSubscriptionDetails: () => api.get('/iap/subscription'),
};

// Comment API
export const commentAPI = {
  getComments: (taskId: number) =>
    api.get(`/tasks/${taskId}/comments`),

  addComment: (taskId: number, content: string, parentId?: number) =>
    api.post(`/tasks/${taskId}/comments`, { content, parentId }),

  updateComment: (commentId: number, content: string) =>
    api.put(`/comments/${commentId}`, { content }),

  deleteComment: (commentId: number) =>
    api.delete(`/comments/${commentId}`),
};

export default api;
