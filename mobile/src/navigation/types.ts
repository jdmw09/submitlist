export type RootStackParamList = {
  // Auth Stack
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
  Onboarding: undefined;

  // Organization Stack
  OrganizationsList: undefined;
  OrganizationSettings: undefined;

  // Task Stack
  TaskList: undefined;
  TaskDetail: { taskId: number };
  TaskCompletions: { taskId: number };
  TaskAuditLog: { taskId: number };
  CreateTask: undefined;

  // Tab Screens
  Organizations: undefined;
  Tasks: undefined;
  Notifications: undefined;
  Profile: undefined;
};
