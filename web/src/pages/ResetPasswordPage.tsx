import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import './AuthPages.css';

const ResetPasswordPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      setValidatingToken(false);
      setTokenValid(false);
      setError('No reset token provided');
      return;
    }

    try {
      const response = await authAPI.validateResetToken(token);
      setTokenValid(true);
      setEmail(response.data.email);
    } catch (error: any) {
      setTokenValid(false);
      setError(error.response?.data?.error || 'Invalid or expired reset token');
    } finally {
      setValidatingToken(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!token) {
      setError('No reset token provided');
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword(token, newPassword);
      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (validatingToken) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>Reset Password</h1>
          <div className="verification-status">
            <div className="spinner"></div>
            <p>Validating reset token...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>Reset Password</h1>
          <div className="verification-status error">
            <div className="error-icon">✗</div>
            <p className="error-message">{error}</p>
            <p className="redirect-message">
              The reset link may have expired or is invalid. Please request a new one.
            </p>
            <div className="auth-link">
              <Link to="/forgot-password">Request New Reset Link</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>Password Reset</h1>
          <div className="verification-status success">
            <div className="success-icon">✓</div>
            <p className="success-message">Your password has been reset successfully!</p>
            <p className="redirect-message">Redirecting to login page...</p>
            <Link to="/login" className="btn btn-primary">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Reset Password</h1>
        <p className="auth-subtitle">Enter your new password for {email}</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              autoComplete="new-password"
              aria-required="true"
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "reset-password-error" : undefined}
            />
          </div>

          <div className="input-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              aria-required="true"
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "reset-password-error" : undefined}
            />
          </div>

          {error && (
            <div
              id="reset-password-error"
              className="error"
              role="alert"
              aria-live="polite"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            aria-label="Reset password"
            aria-busy={loading}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>

          <div className="auth-link">
            <Link to="/login">Return to Login</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
