import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('vinay@example.com');
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError('Please enter your access key.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await login(passcode.trim(), email.trim(), rememberMe);
    setIsSubmitting(false);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error || 'Invalid credentials. Access is restricted.');
    }
  };

  return (
    <div className="auth-viewport">
      <div className="auth-ambient-blur"></div>

      <div className="auth-card">
        {/* Brand Header */}
        <div className="auth-header">
          <div className="auth-emblem">
            <img className="auth-emblem-image" src="/brand/evo-mark.png" alt="EVO" />
          </div>
          <h1 className="auth-title">EVO</h1>
          <p className="auth-subtitle">A calm place to plan what matters.</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="auth-alert" role="alert">
            <svg className="auth-alert-icon" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Sign In Form */}
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-email">
              Account
            </label>
            <input
              id="auth-email"
              type="email"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@domain.com"
              autoComplete="username"
              disabled={isSubmitting}
            />
          </div>

          <div className="auth-field">
            <div className="auth-field-header">
              <label className="auth-label" htmlFor="auth-passcode">
                Access Key / Passcode
              </label>
            </div>
            <div className="auth-input-group">
              <input
                id="auth-passcode"
                type={showPasscode ? 'text' : 'password'}
                className="auth-input"
                placeholder="Enter access key"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                autoFocus
                autoComplete="current-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="auth-input-action"
                onClick={() => setShowPasscode(!showPasscode)}
                tabIndex={-1}
                aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
              >
                {showPasscode ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="auth-options">
            <label className="auth-checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="auth-checkbox"
              />
              <span>Keep terminal unlocked on this device</span>
            </label>
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="auth-spinner-wrapper">
                <span className="auth-spinner"></span>
                <span>Authenticating...</span>
              </span>
            ) : (
            <span>Open EVO</span>
            )}
          </button>
        </form>

        {/* Footer Security Badge */}
        <div className="auth-footer">
          <div className="auth-security-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Private personal workspace</span>
          </div>
        </div>
      </div>
    </div>
  );
}
