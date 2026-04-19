import type { AuthSession } from '@/features/auth/session';

export type TopBarProps = {
  session: AuthSession;
};

export function TopBar({ session }: TopBarProps) {
  return (
    <header className="top-bar">
      <div>
        <h1>FaceLessBanking Ops Portal</h1>
        <p>Secure internal operations workspace</p>
      </div>
      <div className="top-bar-user">
        <span>{session.displayName}</span>
        <small>{session.roles.join(', ')}</small>
      </div>
    </header>
  );
}
