import { Session } from '@supabase/supabase-js';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient, isSupabaseAuthConfigured } from '../lib/supabaseClient';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'configuration-missing';

type AuthContextValue = {
  accessToken: string | null;
  isConfigured: boolean;
  isPasswordRecovery: boolean;
  resetPasswordForEmail: (email: string, intent?: 'forgot' | 'create', portal?: 'admin' | 'student') => Promise<void>;
  session: Session | null;
  signUpGuest: (payload: GuestSignUpPayload) => Promise<{ needsEmailVerification: boolean }>;
  signInWithPassword: (email: string, password: string) => Promise<Session | null>;
  signOut: () => Promise<void>;
  status: AuthStatus;
  updatePassword: (password: string) => Promise<void>;
  verifyPasswordOtpAndUpdatePassword: (email: string, token: string, preferredType: 'invite' | 'recovery', password: string) => Promise<Session | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const passwordActionSessionKey = 'skilled-sapiens-password-action-session';
const emailDeliveryDisabledMessage = 'Email delivery is temporarily disabled from Feature Control. Re-enable Email Delivery before sending emails.';

export type GuestSignUpPayload = {
  audienceType: 'student' | 'working_professional' | 'other';
  collegeName?: string;
  companyName?: string;
  currentCity?: string;
  currentRole?: string;
  currentStatus: string;
  educationYear?: string;
  fullName: string;
  interestedProgram?: string;
  interestedRoles: string[];
  mentorAllocationInterest: 'yes_urgently' | 'maybe_later' | 'no';
  officialEmail?: string;
  password: string;
  personalEmail: string;
  whatsappNumber: string;
};

type AuthProviderProps = {
  children: ReactNode;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasPasswordActionRoute() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('mode') === 'recovery';
}

function hasPasswordActionTokenSignal() {
  if (typeof window === 'undefined' || !hasPasswordActionRoute()) return false;
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return ['access_token', 'refresh_token', 'token_hash', 'code'].some((key) => searchParams.has(key) || hashParams.has(key));
}

function passwordActionCode() {
  if (typeof window === 'undefined' || !hasPasswordActionRoute()) return null;
  return new URLSearchParams(window.location.search).get('code');
}

function cleanPasswordActionUrl() {
  if (typeof window === 'undefined' || !hasPasswordActionRoute()) return;
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.delete('code');
  nextUrl.searchParams.delete('token_hash');
  nextUrl.searchParams.delete('type');
  window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
}

function rememberPasswordActionSession() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(passwordActionSessionKey, 'true');
}

function forgetPasswordActionSession() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(passwordActionSessionKey);
}

function hasRememberedPasswordActionSession() {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(passwordActionSessionKey) === 'true';
}

async function passwordEmailErrorMessage(data: unknown, error: unknown) {
  if (isRecord(data)) {
    if (typeof data.error === 'string' && data.error.trim()) return data.error.trim();
    if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
  }

  const context = isRecord(error) ? error.context : null;
  if (context instanceof Response) {
    const bodyText = await context.clone().text().catch(() => '');
    if (bodyText) {
      try {
        const body = JSON.parse(bodyText);
        if (isRecord(body)) {
          if (typeof body.error === 'string' && body.error.trim()) return body.error.trim();
          if (typeof body.message === 'string' && body.message.trim()) return body.message.trim();
        }
      } catch (_err) {
        return bodyText.slice(0, 300);
      }
    }
  }

  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Unable to send password email.';
}

async function assertLmsEmailDeliveryEnabled(supabase: ReturnType<typeof getSupabaseClient>) {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('feature_controls')
    .select('status')
    .eq('module_id', 'email-service')
    .maybeSingle();

  if (error) {
    console.warn('Email delivery feature control check failed', error.message);
    return;
  }

  if (isRecord(data) && typeof data.status === 'string' && data.status !== 'show') {
    throw new Error(emailDeliveryDisabledMessage);
  }
}

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

    const authClient = supabase;
    let active = true;
    const hasActionToken = hasPasswordActionTokenSignal();
    if (hasActionToken) rememberPasswordActionSession();

    const code = passwordActionCode();

    async function initializeSession() {
      let nextSession: Session | null = null;

      if (code) {
        const { data, error } = await authClient.auth.exchangeCodeForSession(code);
        if (!error) {
          nextSession = data.session;
          cleanPasswordActionUrl();
        }
      }

      if (!nextSession) {
        const { data } = await authClient.auth.getSession();
        nextSession = data.session;
      }

      if (!active) {
        return;
      }

      setSession(nextSession);
      setStatus(nextSession ? 'authenticated' : 'unauthenticated');
      setIsPasswordRecovery(Boolean(nextSession && hasPasswordActionRoute() && (hasActionToken || hasRememberedPasswordActionSession())));
    }

    void initializeSession();

    const {
      data: { subscription }
    } = authClient.auth.onAuthStateChange((event: AuthChangeEvent, nextSession) => {
      const isPasswordActionEvent = event === 'PASSWORD_RECOVERY' || Boolean(nextSession && hasPasswordActionRoute() && hasRememberedPasswordActionSession());
      if (isPasswordActionEvent) rememberPasswordActionSession();
      setSession(nextSession);
      setStatus(nextSession ? 'authenticated' : 'unauthenticated');
      setIsPasswordRecovery(Boolean(nextSession && isPasswordActionEvent));
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

      forgetPasswordActionSession();
      setIsPasswordRecovery(false);
      setSession(data.session);
      setStatus(data.session ? 'authenticated' : 'unauthenticated');
      return data.session;
    },
    [supabase]
  );

  const resetPasswordForEmail = useCallback(
    async (email: string, intent: 'forgot' | 'create' = 'forgot', portal: 'admin' | 'student' = 'student') => {
      if (!supabase) {
        throw new Error('Portal authentication is not configured for this environment.');
      }

      const redirectParams = new URLSearchParams({
        mode: 'recovery',
        intent,
        portal,
        email: email.trim().toLowerCase()
      });
      const redirectTo = `${window.location.origin}/login?${redirectParams.toString()}`;
      await assertLmsEmailDeliveryEnabled(supabase);

      if (portal === 'student') {
        const { data, error } = await supabase.functions.invoke('transactional-email', {
          body: {
            action: 'sendSupabaseStudentPasswordSetup',
            email,
            intent,
            redirect_url: redirectTo
          }
        });

        if (error) {
          throw new Error(await passwordEmailErrorMessage(data, error));
        }

        if (isRecord(data) && typeof data.error === 'string') {
          throw new Error(String(data.error));
        }

        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

      if (error) {
        throw error;
      }
    },
    [supabase]
  );

  const signUpGuest = useCallback(
    async (payload: GuestSignUpPayload) => {
      if (!supabase) {
        throw new Error('Portal authentication is not configured for this environment.');
      }

      const personalEmail = payload.personalEmail.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email: personalEmail,
        password: payload.password,
        options: {
          emailRedirectTo: `${window.location.origin}/guest`,
          data: {
            audience_type: payload.audienceType,
            college_name: payload.collegeName?.trim() || null,
            company_name: payload.companyName?.trim() || null,
            current_city: payload.currentCity?.trim() || null,
            current_role: payload.currentRole?.trim() || null,
            current_status: payload.currentStatus,
            education_year: payload.educationYear?.trim() || null,
            full_name: payload.fullName.trim(),
            interested_program: payload.interestedProgram?.trim() || null,
            interested_roles: payload.interestedRoles,
            lms_signup_type: 'guest',
            mentor_allocation_interest: payload.mentorAllocationInterest,
            official_email: payload.officialEmail?.trim().toLowerCase() || null,
            personal_email: personalEmail,
            whatsapp_number: payload.whatsappNumber.replace(/[^\d]/g, '')
          }
        }
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        setSession(data.session);
        setStatus('authenticated');
      }

      return { needsEmailVerification: !data.session };
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
      forgetPasswordActionSession();
    },
    [supabase]
  );

  const verifyPasswordOtpAndUpdatePassword = useCallback(
    async (email: string, token: string, preferredType: 'invite' | 'recovery', password: string) => {
      if (!supabase) {
        throw new Error('Portal authentication is not configured for this environment.');
      }

      const types: Array<'invite' | 'recovery'> = preferredType === 'invite' ? ['invite', 'recovery'] : ['recovery', 'invite'];
      let lastError: unknown = null;
      let nextSession: Session | null = null;

      for (const type of types) {
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token,
          type
        });

        if (!error) {
          nextSession = data.session;
          break;
        }

        lastError = error;
      }

      if (!nextSession) {
        throw lastError instanceof Error ? lastError : new Error('The email code is invalid or expired. Request a fresh password email and try again.');
      }

      setSession(nextSession);
      setStatus('authenticated');
      setIsPasswordRecovery(true);

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        throw updateError;
      }

      setIsPasswordRecovery(false);
      forgetPasswordActionSession();
      return nextSession;
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setIsPasswordRecovery(false);
    forgetPasswordActionSession();
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken: session?.access_token ?? null,
      isConfigured,
      isPasswordRecovery,
      resetPasswordForEmail,
      session,
      signUpGuest,
      signInWithPassword,
      signOut,
      status,
      updatePassword,
      verifyPasswordOtpAndUpdatePassword
    }),
    [isConfigured, isPasswordRecovery, resetPasswordForEmail, session, signInWithPassword, signOut, signUpGuest, status, updatePassword, verifyPasswordOtpAndUpdatePassword]
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
