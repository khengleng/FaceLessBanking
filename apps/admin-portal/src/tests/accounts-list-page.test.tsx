import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';

import { AccountsListPage } from '@/pages/AccountsListPage';
import type { AccountDetailBundle, AccountFilters, AccountListResponse, AccountsClient } from '@/lib/api/accounts.client';

class FakeAccountsClient implements AccountsClient {
  constructor(private readonly listLoader: () => Promise<AccountListResponse>) {}

  async listAccounts(_filters: AccountFilters): Promise<AccountListResponse> {
    void _filters;
    return this.listLoader();
  }

  async getAccountDetail(_accountId: string): Promise<AccountDetailBundle> {
    void _accountId;
    throw new Error('not_used');
  }
}

describe('AccountsListPage', () => {
  test('renders accounts table rows', async () => {
    const client = new FakeAccountsClient(async () => ({
      items: [
        {
          accountId: 'acc-900',
          customerId: 'cust-901',
          productCode: 'SV',
          currency: 'USD',
          status: 'ACTIVE',
          createdAt: new Date('2026-04-18T08:00:00.000Z').toISOString()
        }
      ],
      meta: {
        limit: 25,
        offset: 0,
        filtered: false
      }
    }));

    render(
      <MemoryRouter>
        <AccountsListPage client={client} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Accounts Investigation')).toBeInTheDocument();
    });

    expect(screen.getByText('acc-900')).toBeInTheDocument();
    expect(screen.getByText('cust-901')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Investigate' })).toHaveAttribute('href', '/accounts/acc-900');
  });

  test('renders empty state safely', async () => {
    const client = new FakeAccountsClient(async () => ({
      items: [],
      meta: { limit: 25, offset: 0, filtered: true }
    }));

    render(
      <MemoryRouter>
        <AccountsListPage client={client} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No accounts found')).toBeInTheDocument();
    });
  });
});
