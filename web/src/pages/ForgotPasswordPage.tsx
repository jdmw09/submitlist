import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import './AuthPages.css';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      setSubmitted(true);
    } catch (err: any) {
      // Even if there's an error, show success message (security best practice)
      // This prevents email enumeration attacks
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>Check Your Email</h1>
          <div className="verification-status success">
            <div className="success-icon">✓</div>
            <p className="success-message">
              If an account exists with this email, you will receive a password reset link shortly.
            </p>
            <p className="redirect-message" style={{ marginTop: '16px' }}>
              Please check your inbox and follow the instructions to reset your password.
            </p>
            <div className="auth-link" style={{ marginTop: '24px' }}>
              <Link to="/login">Return to Login</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Forgot Password</h1>
        <p className="auth-subtitle">Enter your email to reset your password</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
              aria-required="true"
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "forgot-password-error" : undefined}
            />
          </div>

          {error && (
            <div
              id="forgot-password-error"
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
            aria-label="Send password reset email"
            aria-busy={loading}
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>

          <div className="auth-link">
            Remember your password? <Link to="/login">Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
