// The context's paired hook (useAuth) belongs next to its provider, not
// split into a separate file just to satisfy fast-refresh's component-only
// heuristic — a common, accepted pattern for context+hook pairs.
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { type User } from '@supabase/supabase-js';
import { supabase } from './db';

interface AuthContextValue {
  user: User | null;
  authLoading: boolean;
  // Set when Supabase reports the PASSWORD_RECOVERY event — i.e. the user
  // just landed here from an "esqueci minha senha" email link. Only ever
  // moves false→true for the rest of the session (a reload naturally
  // resets it); App.tsx's own prevPasswordRecovery comparison is what
  // decides when to react to that transition.
  passwordRecovery: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// S2-08 (AUD-009 area): the single source of truth for the Supabase auth
// session. useDayState and useItems used to each run their own independent
// getSession()/onAuthStateChange subscription — harmless in practice since
// both just mirror the same session, but two listeners doing the same job
// is duplicated surface for no benefit, and the plan calls for one.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

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

  return (
    <AuthContext.Provider value={{ user, authLoading, passwordRecovery }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
