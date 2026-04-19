import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, test } from 'vitest';

import { Customer360Page } from '@/pages/Customer360Page';
import type { Customer360Bundle, CustomerFilters, CustomerListResponse, CustomersClient } from '@/lib/api/customers.client';

class FakeCustomersClient implements CustomersClient {
  constructor(private readonly bundleLoader: () => Promise<Customer360Bundle>) {}

  async listCustomers(_filters: CustomerFilters): Promise<CustomerListResponse> {
    void _filters;
    return {
      items: [],
      meta: { limit: 25, offset: 0, filtered: false }
    };
  }

  async getCustomer360Bundle(_customerId: string): Promise<Customer360Bundle> {
    void _customerId;
    return this.bundleLoader();
  }
}

const baseBundle: Customer360Bundle = {
  customer: {
    customerId: 'cust-201',
    firstName: 'Dara',
    lastName: 'Ly',
    email: 'dara.ly@example.com',
    status: 'ACTIVE',
    createdAt: new Date('2026-04-18T08:00:00.000Z').toISOString()
  },
  profile: {
    customerId: 'cust-201',
    displayName: 'Dara Ly',
    onboardingReference: 'onboarding-201',
    verificationStatus: 'APPROVED',
    riskLevel: 'LOW',
    countryCode: 'KH',
    contactStatus: 'CONFIRMED',
    createdAt: new Date('2026-04-18T08:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-04-18T09:00:00.000Z').toISOString()
  },
  accounts: [
    {
      accountId: 'acc-1',
      customerId: 'cust-201',
      productCode: 'SV',
      currency: 'USD',
      status: 'ACTIVE',
      createdAt: new Date('2026-04-18T08:05:00.000Z').toISOString()
    }
  ],
  loans: [
    {
      loanId: 'loan-1',
      customerId: 'cust-201',
      status: 'IN_REVIEW',
      principalAmountCents: 120000,
      currency: 'USD',
      createdAt: new Date('2026-04-18T09:10:00.000Z').toISOString()
    }
  ],
  profitability: {
    entityId: 'cust-201',
    totalRevenue: 100,
    totalCost: 40,
    netProfit: 60,
    currency: 'USD'
  },
  warnings: []
};

function renderAtCustomerRoute(client: CustomersClient) {
  render(
    <MemoryRouter initialEntries={['/customers/cust-201']}>
      <Routes>
        <Route path="/customers/:customerId" element={<Customer360Page client={client} />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Customer360Page', () => {
  afterEach(() => {
    cleanup();
  });

  test('renders summary and tabs with loaded data', async () => {
    const client = new FakeCustomersClient(async () => baseBundle);

    renderAtCustomerRoute(client);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dara Ly' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Accounts' }));
    expect(screen.getByText('acc-1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Loans' }));
    expect(screen.getByText('loan-1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Profitability' }));
    expect(screen.getByText('Net Profit')).toBeInTheDocument();
  });

  test('renders placeholders when partial data is missing', async () => {
    const client = new FakeCustomersClient(async () => ({
      ...baseBundle,
      profile: null,
      accounts: [],
      loans: [],
      profitability: null,
      warnings: ['customer_loans_unavailable']
    }));

    renderAtCustomerRoute(client);

    await waitFor(() => {
      expect(screen.getByText(/Some sections are partial/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Accounts' }));
    expect(screen.getByText('No accounts')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Profitability' }));
    expect(screen.getByText('Profitability placeholder')).toBeInTheDocument();
  });

  test('renders safe error state when load fails', async () => {
    const client = new FakeCustomersClient(async () => {
      throw new Error('customer_360_down');
    });

    renderAtCustomerRoute(client);

    await waitFor(() => {
      expect(screen.getByText('Customer 360 unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText(/customer_360_down/)).toBeInTheDocument();
  });
});
