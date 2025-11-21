import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminAuditLogsPage from './pages/AdminAuditLogsPage';
import AdminUserDetailPage from './pages/AdminUserDetailPage';
import TasksPage from './pages/TasksPage';
import TaskDetailPage from './pages/TaskDetailPage';
import TaskCompletionsPage from './pages/TaskCompletionsPage';
import TaskAuditLogPage from './pages/TaskAuditLogPage';
import CreateTaskPage from './pages/CreateTaskPage';
import ImportTasksPage from './pages/ImportTasksPage';
import OrganizationsPage from './pages/OrganizationsPage';
import OrganizationSettingsPage from './pages/OrganizationSettingsPage';
import NotificationsPage from './pages/NotificationsPage';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return user ? <>{children}</> : <Navigate to="/login" />;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return !user ? <>{children}</> : <Navigate to="/" />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={<RegisterPage />}
      />
      <Route
        path="/verify-email/:token"
        element={<VerifyEmailPage />}
      />
      <Route
        path="/forgot-password"
        element={<ForgotPasswordPage />}
      />
      <Route
        path="/reset-password/:token"
        element={<ResetPasswordPage />}
      />
      <Route
        path="/admin"
        element={
          <PrivateRoute>
            <AdminDashboardPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <PrivateRoute>
            <AdminAuditLogsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/users/:id"
        element={
          <PrivateRoute>
            <AdminUserDetailPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <TasksPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/tasks/create"
        element={
          <PrivateRoute>
            <CreateTaskPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/tasks/import"
        element={
          <PrivateRoute>
            <ImportTasksPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/tasks/:id"
        element={
          <PrivateRoute>
            <TaskDetailPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/tasks/:id/completions"
        element={
          <PrivateRoute>
            <TaskCompletionsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/tasks/:id/audit-log"
        element={
          <PrivateRoute>
            <TaskAuditLogPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/organizations"
        element={
          <PrivateRoute>
            <OrganizationsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/organizations/settings"
        element={
          <PrivateRoute>
            <OrganizationSettingsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <PrivateRoute>
            <NotificationsPage />
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
