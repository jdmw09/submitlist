import React, { useState } from 'react';
import { authAPI } from '../services/api';
import './EmailVerificationBanner.css';

interface EmailVerificationBannerProps {
  email: string;
}

const EmailVerificationBanner: React.FC<EmailVerificationBannerProps> = ({ email }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const handleResend = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await authAPI.resendVerificationEmail();
      setMessage(response.data.message || 'Verification email sent! Please check your inbox.');
    } catch (error: any) {
      setMessage(
        error.response?.data?.error || 'Failed to send verification email. Please try again later.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (dismissed) {
    return null;
  }

  return (
    <div className="verification-banner" role="alert" aria-live="polite">
      <div className="verification-banner-content">
        <div className="verification-banner-icon">⚠️</div>
        <div className="verification-banner-text">
          <strong>Email not verified</strong>
          <span>
            Please verify your email address ({email}) to access all features.
          </span>
        </div>
        <div className="verification-banner-actions">
          <button
            onClick={handleResend}
            disabled={loading}
            className="btn btn-sm btn-primary-outline"
            aria-label="Resend verification email"
          >
            {loading ? 'Sending...' : 'Resend Email'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="btn btn-sm btn-text"
            aria-label="Dismiss verification banner"
          >
            Dismiss
          </button>
        </div>
      </div>
      {message && (
        <div className={`verification-banner-message ${message.includes('Failed') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default EmailVerificationBanner;
