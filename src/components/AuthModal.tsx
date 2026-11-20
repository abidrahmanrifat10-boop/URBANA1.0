import { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, User, UserPlus, X } from 'lucide-react';
import { AuthUser, loginAccount, registerAccount } from '../services/authClient';
import { GlassIcon } from './GlassIcon';

interface AuthModalProps {
  open: boolean;
  initialMode?: 'login' | 'register';
  adminClaimed: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser, mode: 'login' | 'register') => void;
}

export function AuthModal({
  open,
  initialMode = 'register',
  adminClaimed,
  onClose,
  onSuccess,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError('');
    }
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (mode === 'register') {
      if (name.trim().length < 2) {
        setError('Full name must be at least 2 characters.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    } else if (!password) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      const user =
        mode === 'register'
          ? await registerAccount(name.trim(), trimmedEmail, password)
          : await loginAccount(trimmedEmail, password);
      setPassword('');
      setConfirmPassword('');
      onSuccess(user, mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white dark:bg-[#111316] border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <GlassIcon tone="emerald" size="md">
              {mode === 'login' ? (
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              ) : (
                <UserPlus className="w-4 h-4" aria-hidden="true" />
              )}
            </GlassIcon>
            <div>
              <h2 id="auth-modal-title" className="text-base font-semibold text-slate-900 dark:text-zinc-100">
                {mode === 'register' ? 'Create Customer Account' : 'Sign In to URBANA'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                {mode === 'register'
                  ? 'Register to submit & track civic reports and pickups'
                  : 'Sign in to access your URBANA account'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 rounded-md"
            aria-label="Close account dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200/70 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            className={`py-2 text-xs font-medium rounded-lg transition-colors ${
              mode === 'register'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            Customer Sign Up
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            className={`py-2 text-xs font-medium rounded-lg transition-colors ${
              mode === 'login'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            Sign In
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-name" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-3" aria-hidden="true" />
                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  className="w-full h-10 pl-9 pr-3 text-sm bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 border border-slate-300 dark:border-zinc-700 rounded-lg"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-3" aria-hidden="true" />
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full h-10 pl-9 pr-3 text-sm bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 border border-slate-300 dark:border-zinc-700 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label htmlFor="auth-pass" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
              Password {mode === 'register' && <span className="text-slate-400 dark:text-zinc-500 font-normal">(min 6 chars)</span>}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-3" aria-hidden="true" />
              <input
                id="auth-pass"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                className="w-full h-10 pl-9 pr-10 text-sm bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 border border-slate-300 dark:border-zinc-700 rounded-lg"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-2.5 p-1 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label htmlFor="auth-confirm" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-3" aria-hidden="true" />
                <input
                  id="auth-confirm"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  className="w-full h-10 pl-9 pr-3 text-sm bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 border border-slate-300 dark:border-zinc-700 rounded-lg"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2" role="alert">
              {error}
            </p>
          )}

          <div className="pt-1 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-55 rounded-lg transition-colors"
            >
              {submitting
                ? 'Please wait...'
                : mode === 'register'
                  ? 'Create Customer Account'
                  : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
