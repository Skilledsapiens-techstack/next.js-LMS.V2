import { Session } from '@supabase/supabase-js';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient, isSupabaseAuthConfigured } from '../lib/supabaseClient';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'configuration-missing';

type AuthContextValue = {
  accessToken: string | null;
  isConfigured: boolean;
  isPasswordRecovery: boolean;
  resetPasswordForEmail: (email: string, intent?: 'forgot' | 'create') => Promise<void>;
  session: Session | null;
  signInWithPassword: (email: string, password: string) => Promise<Session | null>;
  signOut: () => Promise<void>;
  status: AuthStatus;
  updatePassword: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const isConfigured = isSupabaseAuthConfigured();
  const supabase = getSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
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
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, nextSession) => {
      setSession(nextSession);
      setStatus(nextSession ? 'authenticated' : 'unauthenticated');
      setIsPasswordRecovery(event === 'PASSWORD_RECOVERY');
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

  const resetPasswordForEmail = useCallback(
    async (email: string, intent: 'forgot' | 'create' = 'forgot') => {
      if (!supabase) {
        throw new Error('Portal authentication is not configured for this environment.');
      }

      const redirectTo = `${window.location.origin}/login?mode=recovery&intent=${intent}`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

      if (error) {
        throw error;
      }
    },
    [supabase]
  );

  const updatePassword = useCallback(
    async (password: string) => {
      if (!supabase) {
        throw new Error('Portal authentication is not configured for this environment.');
      }

      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      setIsPasswordRecovery(false);
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setIsPasswordRecovery(false);
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken: session?.access_token ?? null,
      isConfigured,
      isPasswordRecovery,
      resetPasswordForEmail,
      session,
      signInWithPassword,
      signOut,
      status,
      updatePassword
    }),
    [isConfigured, isPasswordRecovery, resetPasswordForEmail, session, signInWithPassword, signOut, status, updatePassword]
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
