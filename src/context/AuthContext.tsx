import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiRequest } from '@/lib/api';

export type AuthUser = {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
};

type Session = { user: AuthUser } | null;
type AuthContextValue = {
  session: Session | null;
  user: AuthUser | null;
  loading: boolean;
  acceptUser: (user: AuthUser) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiRequest<{ ok: boolean }>('auth/signout', { method: 'POST', body: {} })
      .catch((error) => {
        console.error('Could not clear the previous marketplace session.', error);
      })
      .finally(() => {
        if (active) {
          setSession(null);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const signOut = async () => {
    await apiRequest<{ ok: boolean }>('auth/signout', { method: 'POST', body: {} });
    setSession(null);
  };

  const acceptUser = (user: AuthUser) => setSession({ user });

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    acceptUser,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
