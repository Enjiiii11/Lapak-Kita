import { useState, type FormEvent } from 'react';
import { AlertCircle, Loader2, Lock, Mail, Store, User as UserIcon } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useAuth, type AuthUser } from '@/context/AuthContext';

type Mode = 'signin' | 'signup';

export const inputClass =
  'w-full rounded-xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100';

export default function AuthScreen() {
  const { acceptUser } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === 'signup';

  const changeMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const switchMode = () => changeMode(isSignup ? 'signin' : 'signup');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }
    if (isSignup && !fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    setSubmitting(true);
    try {
      const { user } = await apiRequest<{ user: AuthUser }>(`auth/${isSignup ? 'signup' : 'signin'}`, {
        method: 'POST',
        body: { email: trimmedEmail, password, full_name: fullName.trim() },
      });
      acceptUser(user);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
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
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="mt-2 text-stone-600">
            {isSignup ? 'Sign up to start shopping and selling.' : 'Sign in to continue to your marketplace.'}
          </p>

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

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-stone-700">Password</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                <input
                  type="password"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className={inputClass}
                />
              </div>
            </label>

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
              {isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone-600">
            {isSignup ? 'Already have an account?' : "Don't have an account yet?"}{' '}
            <button
              type="button"
              onClick={switchMode}
              className="font-semibold text-orange-600 hover:text-orange-700"
            >
              {isSignup ? 'Sign in' : 'Create one'}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
