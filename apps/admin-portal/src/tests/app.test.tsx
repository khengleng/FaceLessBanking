import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { test, expect } from 'vitest';

import { App } from '@/app/App';
import type { AuthSession, AuthSessionAdapter } from '@/features/auth/session';

class TestAuthAdapter implements AuthSessionAdapter {
  constructor(private readonly session: AuthSession | null) {}

  async getSession(): Promise<AuthSession | null> {
    return this.session;
  }

  async loginRedirect(): Promise<void> {}

  async logout(): Promise<void> {}
}

test('unauthenticated user is redirected to login page for protected routes', async () => {
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <App authAdapter={new TestAuthAdapter(null)} />
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(screen.getByText('Admin / Ops Portal Login')).toBeInTheDocument();
  });
});

test('role-aware navigation hides unauthorized sections', async () => {
  const session: AuthSession = {
    principalId: 'ops-user-1',
    displayName: 'Ops User',
    roles: ['OPS_USER'],
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
  };

  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <App authAdapter={new TestAuthAdapter(session)} />
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
  });

  expect(screen.getByRole('link', { name: 'Customers' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Administration' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Treasury' })).not.toBeInTheDocument();
});

test('unauthorized protected page access is blocked safely', async () => {
  const session: AuthSession = {
    principalId: 'ops-user-2',
    displayName: 'Ops User',
    roles: ['OPS_USER'],
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
  };

  render(
    <MemoryRouter initialEntries={['/administration']}>
      <App authAdapter={new TestAuthAdapter(session)} />
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(screen.getByText('Access blocked')).toBeInTheDocument();
  });
});
