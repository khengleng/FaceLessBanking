export type UserRole =
  | 'OPS_USER'
  | 'OPS_MANAGER'
  | 'RISK_USER'
  | 'TREASURY_USER'
  | 'ADMIN_USER';

export type AuthSession = {
  principalId: string;
  displayName: string;
  roles: UserRole[];
  expiresAt: string;
};

export interface AuthSessionAdapter {
  getSession(): Promise<AuthSession | null>;
  loginRedirect(returnTo: string): Promise<void>;
  logout(): Promise<void>;
}

type SessionResponse = {
  principalId: string;
  displayName: string;
  roles: UserRole[];
  expiresAt: string;
};

export class KeycloakSessionAdapter implements AuthSessionAdapter {
  private getBaseUrl(): string {
    return (import.meta as any).env?.VITE_API_URL || '';
  }

  async getSession(): Promise<AuthSession | null> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/auth/session`, {
        method: 'GET',
        credentials: 'include'
      });


      if (response.status === 401) {
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as SessionResponse;
      if (!isSessionPayload(payload)) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  async loginRedirect(returnTo: string): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    const encoded = encodeURIComponent(returnTo);
    window.location.assign(`${this.getBaseUrl()}/auth/login?returnTo=${encoded}`);
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${this.getBaseUrl()}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } finally {
      if (typeof window !== 'undefined') {
        window.location.assign('/login');
      }
    }
  }
}

function isSessionPayload(value: SessionResponse): value is AuthSession {
  return (
    typeof value === 'object' &&
    typeof value.principalId === 'string' &&
    typeof value.displayName === 'string' &&
    Array.isArray(value.roles) &&
    typeof value.expiresAt === 'string'
  );
}
