
import React, { useState } from 'react';
import { LogIn, UserPlus, Mail, Lock, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

interface AuthProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onOAuthSignIn: (provider: 'google' | 'github') => Promise<void>;
  onSkip: () => void;
  onResetPassword?: (email: string) => Promise<void>;
}

export default function Auth({ onSignIn, onSignUp, onOAuthSignIn, onSkip, onResetPassword }: AuthProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (mode === 'forgot') {
      if (!email) {
        setError('Please enter your email address');
        return;
      }
      setIsLoading(true);
      try {
        if (onResetPassword) {
          await onResetPassword(email);
        }
        setSuccessMessage('Password reset email sent! Check your inbox.');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to send reset email');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (mode === 'signin') {
        await onSignIn(email, password);
      } else {
        await onSignUp(email, password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setError('');
    setSuccessMessage('');
    setIsLoading(true);
    try {
      await onOAuthSignIn(provider);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'OAuth sign in failed');
      setIsLoading(false);
    }
  };

  const switchMode = (newMode: 'signin' | 'signup' | 'forgot') => {
    setMode(newMode);
    setError('');
    setSuccessMessage('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-blue-900 to-purple-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block bg-white/10 backdrop-blur-lg rounded-3xl p-6 mb-4">
            <span className="text-6xl">💰</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Wingman Finance</h1>
          <p className="text-indigo-200 text-sm">Smart budgeting, simplified</p>
        </div>

        {/* Auth Card */}
        <div className="rounded-3xl shadow-2xl p-8 space-y-6"
          style={{ backgroundColor: 'var(--color-bg-secondary)' }}>

          {mode === 'forgot' ? (
            /* Forgot Password View */
            <>
              <div className="space-y-2">
                <button
                  onClick={() => switchMode('signin')}
                  className="flex items-center gap-1 text-sm font-medium transition-colors"
                  style={{ color: 'var(--color-accent)' }}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </button>
                <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  Reset Password
                </h2>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Enter your email and we'll send you a reset link.
                </p>
              </div>
            </>
          ) : (
            /* Sign In / Sign Up Toggle */
            <div className="flex gap-2 p-1 rounded-xl"
              style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
              <button
                onClick={() => switchMode('signin')}
                className="flex-1 py-3 rounded-lg font-bold text-sm transition-all"
                style={mode === 'signin'
                  ? { backgroundColor: 'var(--color-bg-card)', color: 'var(--color-accent)', boxShadow: 'var(--shadow-md)' }
                  : { color: 'var(--color-text-tertiary)' }
                }
              >
                <LogIn className="w-4 h-4 inline mr-2" />
                Sign In
              </button>
              <button
                onClick={() => switchMode('signup')}
                className="flex-1 py-3 rounded-lg font-bold text-sm transition-all"
                style={mode === 'signup'
                  ? { backgroundColor: 'var(--color-bg-card)', color: 'var(--color-accent)', boxShadow: 'var(--shadow-md)' }
                  : { color: 'var(--color-text-tertiary)' }
                }
              >
                <UserPlus className="w-4 h-4 inline mr-2" />
                Sign Up
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-xl p-4 flex items-start gap-3"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '2px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <p className="text-sm font-medium" style={{ color: '#ef4444' }}>{error}</p>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="rounded-xl p-4 flex items-start gap-3"
              style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '2px solid rgba(16, 185, 129, 0.2)' }}>
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#10b981' }} />
              <p className="text-sm font-medium" style={{ color: '#10b981' }}>{successMessage}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold mb-2 uppercase tracking-wider"
                style={{ color: 'var(--color-text-secondary)' }}>
                <Mail className="w-3 h-3 inline mr-1" />
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  border: '2px solid var(--color-border-card)',
                  color: 'var(--color-text-primary)',
                }}
                disabled={isLoading}
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wider"
                  style={{ color: 'var(--color-text-secondary)' }}>
                  <Lock className="w-3 h-3 inline mr-1" />
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    border: '2px solid var(--color-border-card)',
                    color: 'var(--color-text-primary)',
                  }}
                  disabled={isLoading}
                />
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wider"
                  style={{ color: 'var(--color-text-secondary)' }}>
                  <Lock className="w-3 h-3 inline mr-1" />
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    border: '2px solid var(--color-border-card)',
                    color: 'var(--color-text-primary)',
                  }}
                  disabled={isLoading}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-sm"
            >
              {isLoading
                ? 'Loading...'
                : mode === 'forgot'
                  ? 'Send Reset Link'
                  : mode === 'signin'
                    ? 'Sign In'
                    : 'Create Account'
              }
            </button>
          </form>

          {/* Forgot Password Link (only on signin) */}
          {mode === 'signin' && onResetPassword && (
            <div className="text-center">
              <button
                onClick={() => switchMode('forgot')}
                className="text-xs font-medium transition-colors hover:underline"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Forgot your password?
              </button>
            </div>
          )}

          {/* OAuth Section (only on signin/signup) */}
          {mode !== 'forgot' && (
            <>
              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full" style={{ borderTop: '1px solid var(--color-border-card)' }}></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 font-medium"
                    style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)' }}>
                    OR CONTINUE WITH
                  </span>
                </div>
              </div>

              {/* OAuth Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleOAuth('google')}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all font-medium text-sm disabled:opacity-50"
                  style={{
                    border: '2px solid var(--color-border-card)',
                    color: 'var(--color-text-secondary)',
                    backgroundColor: 'var(--color-bg-card)',
                  }}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </button>
                <button
                  onClick={() => handleOAuth('github')}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all font-medium text-sm disabled:opacity-50"
                  style={{
                    border: '2px solid var(--color-border-card)',
                    color: 'var(--color-text-secondary)',
                    backgroundColor: 'var(--color-bg-card)',
                  }}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  GitHub
                </button>
              </div>
            </>
          )}

          {/* Skip Option */}
          <div className="text-center pt-4" style={{ borderTop: '1px solid var(--color-border-card)' }}>
            <button
              onClick={onSkip}
              className="text-sm font-medium transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Continue without an account →
            </button>
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
              Use local-only mode (data stays on this device)
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-indigo-200 text-xs mt-6">
          {mode === 'signup' ?
            'By signing up, your data will be synced securely to the cloud' :
            mode === 'forgot' ?
              'Check your email for the password reset link' :
              'Sign in to access your data from any device'
          }
        </p>
      </div>
    </div>
  );
}
