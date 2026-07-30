// The context's paired hook (useAuth) belongs next to its provider, not
// split into a separate file just to satisfy fast-refresh's component-only
// heuristic — a common, accepted pattern for context+hook pairs.
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { type User } from '@supabase/supabase-js';
import { supabase } from './db';

interface AuthContextValue {
  user: User | null;
  authLoading: boolean;
  // Set when Supabase reports the PASSWORD_RECOVERY event — i.e. the user
  // just landed here from an "esqueci minha senha" email link.
  passwordRecovery: boolean;
  // AUD-026: lets App.tsx clear the recovery signal once the new password
  // is actually saved, instead of it only ever resetting via page reload.
  clearPasswordRecovery: () => void;
  // AUD-026: a recovery link that's expired or already been used redirects
  // back here with an error in the URL fragment instead of establishing a
  // session — previously left unhandled, landing on a plain login screen
  // with a raw error hash and no explanation.
  authLinkError: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseAuthErrorFromHash(): string | null {
  const hash = window.location.hash;
  if (!hash || !hash.includes('error=')) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (params.get('error_code') === 'otp_expired') {
    return 'Esse link de redefinição de senha expirou ou já foi usado. Peça um novo link de recuperação.';
  }
  // URLSearchParams already decodes both %XX escapes and '+' as spaces per
  // the application/x-www-form-urlencoded spec it implements.
  return params.get('error_description') || 'Não foi possível concluir a ação a partir do link. Tente novamente.';
}

// S2-08 (AUD-009 area): the single source of truth for the Supabase auth
// session. useDayState and useItems used to each run their own independent
// getSession()/onAuthStateChange subscription — harmless in practice since
// both just mirror the same session, but two listeners doing the same job
// is duplicated surface for no benefit, and the plan calls for one.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [authLinkError] = useState<string | null>(() => parseAuthErrorFromHash());

  useEffect(() => {
    // Strip the error out of the URL once captured above so it doesn't
    // linger (and resurface, or get shared/bookmarked) after this render.
    if (authLinkError) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [authLinkError]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const clearPasswordRecovery = useCallback(() => setPasswordRecovery(false), []);

  return (
    <AuthContext.Provider value={{ user, authLoading, passwordRecovery, clearPasswordRecovery, authLinkError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
