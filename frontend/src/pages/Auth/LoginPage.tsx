import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError('Please enter your master passcode');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await login(passcode.trim());
    setIsSubmitting(false);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error || 'Access denied');
    }
  };

  return (
    <div className="login-container">
      <div className="login-background-glow"></div>

      <div className="login-card animate-fade-in-up">
        <div className="login-header">
          <div className="login-badge">
            <span className="login-badge-dot"></span>
            RESTRICTED ACCESS • VINAY ONLY
          </div>

          <div className="login-logo">
            <div className="login-logo-icon">E</div>
            <h1 className="login-logo-title">EVO</h1>
          </div>
          <p className="login-subtitle">Personal AI Operating System</p>
        </div>

        <div className="login-profile-preview">
          <div className="login-avatar">V</div>
          <div className="login-user-info">
            <div className="login-user-name">Vinay</div>
            <div className="login-user-role">System Owner & Operator</div>
          </div>
          <div className="login-status-pill">
            <span className="lock-icon">🔒</span> Locked
          </div>
        </div>

        {error && (
          <div className="login-error-alert animate-fade-in-up">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label className="login-label" htmlFor="passcode-input">
              Master Access Key / Passcode
            </label>
            <div className="login-input-wrapper">
              <input
                id="passcode-input"
                type={showPasscode ? 'text' : 'password'}
                className="login-input"
                placeholder="Enter master passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                autoFocus
                autoComplete="current-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="login-toggle-visibility"
                onClick={() => setShowPasscode(!showPasscode)}
                tabIndex={-1}
                aria-label="Toggle password visibility"
              >
                {showPasscode ? '👁️' : '🙈'}
              </button>
            </div>
            <span className="login-hint">Default Master Key: <code>Vinay@2026</code></span>
          </div>

          <button
            type="submit"
            className="btn btn-primary login-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="login-loading-text">
                <span className="login-spinner"></span> Authenticating OS...
              </span>
            ) : (
              <span>Unlock Operating System →</span>
            )}
          </button>
        </form>

        <div className="login-footer">
          <div className="login-security-tag">
            <span>🛡️ End-to-End Encrypted Session</span>
            <span>•</span>
            <span>PostgreSQL + Vector Memory</span>
          </div>
        </div>
      </div>
    </div>
  );
}
