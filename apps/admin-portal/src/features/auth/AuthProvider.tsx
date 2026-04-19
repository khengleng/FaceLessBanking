import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';

import { KeycloakSessionAdapter, type AuthSession, type AuthSessionAdapter } from './session';

export type AuthStatus = 'bootstrapping' | 'authenticated' | 'unauthenticated';

export type AuthContextValue = {
  status: AuthStatus;
  session: AuthSession | null;
  refreshSession: () => Promise<void>;
  login: (returnTo: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export type AuthProviderProps = PropsWithChildren<{
  adapter?: AuthSessionAdapter;
}>;

export function AuthProvider({ children, adapter }: AuthProviderProps) {
  const sessionAdapter = adapter ?? new KeycloakSessionAdapter();
  const [status, setStatus] = useState<AuthStatus>('bootstrapping');
  const [session, setSession] = useState<AuthSession | null>(null);

  const refreshSession = useCallback(async () => {
    setStatus('bootstrapping');
    const next = await sessionAdapter.getSession();
    setSession(next);
    setStatus(next ? 'authenticated' : 'unauthenticated');
  }, [sessionAdapter]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(
    async (returnTo: string) => {
      await sessionAdapter.loginRedirect(returnTo);
    },
    [sessionAdapter]
  );

  const logout = useCallback(async () => {
    await sessionAdapter.logout();
    setSession(null);
    setStatus('unauthenticated');
  }, [sessionAdapter]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      refreshSession,
      login,
      logout
    }),
    [login, logout, refreshSession, session, status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
