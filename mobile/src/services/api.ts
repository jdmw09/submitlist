import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
    api.post(`/tasks/${taskId}/completions`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

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
