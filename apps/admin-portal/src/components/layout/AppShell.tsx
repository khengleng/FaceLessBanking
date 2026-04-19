import type { PropsWithChildren } from 'react';

import type { AuthSession } from '@/features/auth/session';
import type { NavItem } from '@/features/navigation/navigation';

import { SideNav } from './SideNav';
import { TopBar } from './TopBar';

export type AppShellProps = PropsWithChildren<{
  session: AuthSession;
  navItems: NavItem[];
}>;

export function AppShell({ session, navItems, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <TopBar session={session} />
      <div className="shell-body">
        <SideNav items={navItems} />
        <main className="content-area">{children}</main>
      </div>
    </div>
  );
}
