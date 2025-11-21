import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from './ThemeToggle';
import EmailVerificationBanner from './EmailVerificationBanner';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
      navigate('/login');
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path ? 'active' : '';
  };

  return (
    <div className="layout">
      <nav className="navbar" role="navigation" aria-label="Main navigation">
        <div className="navbar-content">
          <div className="navbar-brand">
            <Link to="/">Task Manager</Link>
          </div>

          <div className="navbar-links">
            <Link to="/" className={isActive('/')} aria-current={location.pathname === '/' ? 'page' : undefined}>
              Tasks
            </Link>
            <Link to="/organizations" className={isActive('/organizations')} aria-current={location.pathname === '/organizations' ? 'page' : undefined}>
              Organizations
            </Link>
            <Link to="/organizations/settings" className={isActive('/organizations/settings')} aria-current={location.pathname === '/organizations/settings' ? 'page' : undefined}>
              Settings
            </Link>
            <Link to="/notifications" className={isActive('/notifications')} aria-current={location.pathname === '/notifications' ? 'page' : undefined}>
              Notifications
            </Link>
            {(user?.role === 'admin' || user?.role === 'super_admin') && (
              <Link to="/admin" className={isActive('/admin')} aria-current={location.pathname === '/admin' ? 'page' : undefined}>
                Admin
              </Link>
            )}
          </div>

          <div className="navbar-user">
            <ThemeToggle />
            <span className="user-name">{user?.name}</span>
            <button onClick={handleLogout} className="btn btn-secondary btn-sm" aria-label="Sign out of your account">
              Logout
            </button>
          </div>
        </div>
      </nav>

      {user && !user.email_verified && (
        <EmailVerificationBanner email={user.email} />
      )}

      <main className="main-content" role="main">{children}</main>
    </div>
  );
};

export default Layout;
