import { useState, type FormEvent } from 'react';
import { AlertCircle, Loader2, Lock, Mail, Store, User as UserIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Mode = 'signin' | 'signup' | 'forgot';

type AuthErrorLike = { message: string; code?: string };

function describeAuthError({ message, code }: AuthErrorLike): string {
  const lower = message.toLowerCase();
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || lower.includes('rate limit')) {
    return 'Too many sign-up attempts right now. Please wait about an hour and try again.';
  }
  if (code === 'weak_password' || lower.includes('pwned') || lower.includes('breach') || lower.includes('weak')) {
    return 'That password is too common or was found in a data breach. Choose a stronger one.';
  }
  if (code === 'email_address_invalid' || (lower.includes('email address') && lower.includes('invalid'))) {
    return 'This email address was rejected. Try a different address.';
  }
  if (code === 'user_already_exists' || lower.includes('already registered') || lower.includes('already exists')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (code === 'invalid_credentials' || lower.includes('invalid login credentials')) {
    return 'Email or password is incorrect.';
  }
  if (code === 'email_not_confirmed' || lower.includes('email not confirmed')) {
    return 'This account has not confirmed its email yet. Turn off email confirmation in your database authentication settings.';
  }
  if (lower.includes('password should be at least')) return 'Password must be at least 6 characters.';
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Network error. Check your connection and try again.';
  }
  return `Sign-up failed: ${message}`;
}

export const inputClass =
  'w-full rounded-xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';

  const changeMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setResetSent(false);
  };

  const switchMode = () => changeMode(isSignup ? 'signin' : 'signup');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || (!isForgot && !password)) {
      setError(isForgot ? 'Please enter your email.' : 'Please enter your email and password.');
      return;
    }
    if (isSignup && !fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (isForgot) {
      setSubmitting(true);
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: window.location.origin,
      });
      setSubmitting(false);
      if (resetError) {
        setError('We could not send the reset email. Please try again in a little while.');
        return;
      }
      setResetSent(true);
      return;
    }

    setSubmitting(true);
    const result = isSignup
      ? await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: { data: { full_name: fullName.trim() } },
        })
      : await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
    setSubmitting(false);

    if (result.error) {
      setError(describeAuthError(result.error));
      return;
    }
    if (isSignup && !result.data.session) {
      setError('Account created, but email confirmation is still required. Turn it off in your database authentication settings, then sign in.');
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 lg:grid lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-orange-600 via-orange-600 to-rose-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
            <Store className="h-6 w-6" aria-hidden="true" />
          </div>
          <span className="text-xl font-bold tracking-tight">Lapak Kita</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight">Shop local, sell easy, pay simply.</h1>
          <p className="mt-4 text-base leading-relaxed text-orange-50">
            Browse thousands of products from sellers near you. Every order is metered and billed
            transparently, from item units to shipping weight.
          </p>
        </div>
        <p className="text-sm text-orange-100">Simulated checkout. No real payments are processed.</p>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white">
              <Store className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="text-lg font-bold text-stone-900">Lapak Kita</span>
          </div>

          <h2 className="text-3xl font-extrabold text-stone-900">
            {isForgot ? 'Reset your password' : isSignup ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="mt-2 text-stone-600">
            {isForgot
              ? 'Enter your email and we will send you a link to choose a new password.'
              : isSignup
                ? 'Sign up to start shopping and selling.'
                : 'Sign in to continue to your marketplace.'}
          </p>

          {resetSent ? (
            <div role="status" className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-800">
              We sent a password reset link to {email.trim()}. Open it on this device to choose a new password.
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
            {isSignup && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">Full name</span>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dayan Singasatia"
                    className={inputClass}
                  />
                </div>
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-stone-700">Email</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </div>
            </label>

            {!isForgot && (
              <div>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">Password</span>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                    <input
                      type="password"
                      autoComplete={isSignup ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className={inputClass}
                    />
                  </div>
                </label>
                {mode === 'signin' && (
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => changeMode('forgot')}
                      className="text-sm font-medium text-orange-600 hover:text-orange-700"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 font-semibold text-white shadow-sm transition hover:bg-orange-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isForgot ? 'Send reset link' : isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>
          )}

          <p className="mt-6 text-center text-sm text-stone-600">
            {isForgot ? 'Remembered it?' : isSignup ? 'Already have an account?' : "Don't have an account yet?"}{' '}
            <button
              type="button"
              onClick={isForgot ? () => changeMode('signin') : switchMode}
              className="font-semibold text-orange-600 hover:text-orange-700"
            >
              {isForgot ? 'Back to sign in' : isSignup ? 'Sign in' : 'Create one'}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
