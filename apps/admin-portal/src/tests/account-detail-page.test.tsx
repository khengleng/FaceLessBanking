import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AccountDetailPage } from '@/pages/AccountDetailPage';
import type { AccountDetailBundle, AccountFilters, AccountListResponse, AccountsClient } from '@/lib/api/accounts.client';

class FakeAccountsClient implements AccountsClient {
  constructor(private readonly detailLoader: () => Promise<AccountDetailBundle>) {}

  async listAccounts(_filters: AccountFilters): Promise<AccountListResponse> {
    void _filters;
    return { items: [], meta: { limit: 25, offset: 0, filtered: false } };
  }

  async getAccountDetail(_accountId: string): Promise<AccountDetailBundle> {
    void _accountId;
    return this.detailLoader();
  }
}

afterEach(() => {
  cleanup();
});

describe('AccountDetailPage', () => {
  test('renders account detail and balances', async () => {
    const client = new FakeAccountsClient(async () => ({
      account: {
        accountId: 'acc-500',
        customerId: 'cust-500',
        productCode: 'SV',
        currency: 'USD',
        status: 'ACTIVE',
        createdAt: new Date('2026-04-18T08:00:00.000Z').toISOString()
      },
      accountType: 'SAVINGS',
      activationState: 'ACTIVE',
      balanceSnapshot: {
        accountId: 'acc-500',
        availableBalanceCents: 12500,
        ledgerBalanceCents: 12400,
        currency: 'USD',
        source: 'account-service'
      },
      warnings: []
    }));

    render(
      <MemoryRouter initialEntries={['/accounts/acc-500']}>
        <Routes>
          <Route path="/accounts/:accountId" element={<AccountDetailPage client={client} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'acc-500' })).toBeInTheDocument();
    });

    expect(screen.getByText('SAVINGS')).toBeInTheDocument();
    expect(screen.getAllByText('cust-500').length).toBeGreaterThan(0);
    expect(screen.getByText(/12,500 USD/)).toBeInTheDocument();
  });

  test('renders safe error state', async () => {
    const client = new FakeAccountsClient(async () => {
      throw new Error('account_lookup_down');
    });

    render(
      <MemoryRouter initialEntries={['/accounts/acc-404']}>
        <Routes>
          <Route path="/accounts/:accountId" element={<AccountDetailPage client={client} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Account detail unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText(/account_lookup_down/)).toBeInTheDocument();
  });
});
