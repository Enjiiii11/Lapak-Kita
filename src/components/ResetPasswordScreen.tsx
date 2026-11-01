import { useState, type FormEvent } from 'react';
import { AlertCircle, Loader2, Lock, Store } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { inputClass } from '@/components/AuthScreen';

export default function ResetPasswordScreen() {
  const { clearRecovery, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError('We could not update your password. The reset link may have expired, so request a new one.');
      return;
    }
    clearRecovery();
  };

  const handleCancel = () => {
    clearRecovery();
    void signOut();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white">
            <Store className="h-5 w-5" aria-hidden="true" />
          </div>
          <span className="text-lg font-bold text-stone-900">Lapak Kita</span>
        </div>

        <h2 className="text-3xl font-extrabold text-stone-900">Choose a new password</h2>
        <p className="mt-2 text-stone-600">Enter a new password for your account.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">New password</span>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className={inputClass}
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">Confirm new password</span>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Type it again"
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
            Save new password
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-600">
          <button type="button" onClick={handleCancel} className="font-semibold text-orange-600 hover:text-orange-700">
            Cancel and sign out
          </button>
        </p>
      </div>
    </div>
  );
}
