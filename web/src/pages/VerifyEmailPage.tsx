import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import './AuthPages.css';

const VerifyEmailPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    verifyEmail();
  }, [token]);

  const verifyEmail = async () => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    try {
      const response = await authAPI.verifyEmail(token);
      setStatus('success');
      setMessage(response.data.message || 'Email verified successfully!');

      // Redirect to home after 3 seconds
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (error: any) {
      setStatus('error');
      setMessage(
        error.response?.data?.error || 'Failed to verify email. The link may be invalid or expired.'
      );
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Email Verification</h1>

        {status === 'verifying' && (
          <div className="verification-status">
            <div className="spinner"></div>
            <p>Verifying your email address...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="verification-status success">
            <div className="success-icon">✓</div>
            <p className="success-message">{message}</p>
            <p className="redirect-message">Redirecting to home page...</p>
            <Link to="/" className="btn btn-primary">
              Go to Home
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="verification-status error">
            <div className="error-icon">✗</div>
            <p className="error-message">{message}</p>
            <div className="auth-link">
              <Link to="/login">Return to Login</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;
