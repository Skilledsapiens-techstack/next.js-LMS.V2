import { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient, isSupabaseAuthConfigured } from '../lib/supabaseClient';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'configuration-missing';

type AuthContextValue = {
  accessToken: string | null;
  isConfigured: boolean;
  session: Session | null;
  signInWithPassword: (email: string, password: string) => Promise<Session | null>;
  signOut: () => Promise<void>;
  status: AuthStatus;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const isConfigured = isSupabaseAuthConfigured();
  const supabase = getSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(isConfigured ? 'loading' : 'configuration-missing');

  useEffect(() => {
    if (!supabase) {
      setStatus('configuration-missing');
      setSession(null);
      return undefined;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) {
        return;
      }

      setSession(data.session);
      setStatus(data.session ? 'authenticated' : 'unauthenticated');
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setStatus(nextSession ? 'authenticated' : 'unauthenticated');
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      if (!supabase) {
        throw new Error('Portal authentication is not configured for this environment.');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      setSession(data.session);
      setStatus(data.session ? 'authenticated' : 'unauthenticated');
      return data.session;
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken: session?.access_token ?? null,
      isConfigured,
      session,
      signInWithPassword,
      signOut,
      status
    }),
    [isConfigured, session, signInWithPassword, signOut, status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return value;
}
