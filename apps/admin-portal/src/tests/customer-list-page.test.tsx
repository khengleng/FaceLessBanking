import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';

import { CustomerListPage } from '@/pages/CustomerListPage';
import type { Customer360Bundle, CustomerFilters, CustomerListResponse, CustomersClient } from '@/lib/api/customers.client';

class FakeCustomersClient implements CustomersClient {
  constructor(private readonly responder: () => Promise<CustomerListResponse>) {}

  async listCustomers(_filters: CustomerFilters): Promise<CustomerListResponse> {
    void _filters;
    return this.responder();
  }

  async getCustomer360Bundle(_customerId: string): Promise<Customer360Bundle> {
    void _customerId;
    throw new Error('not_used');
  }
}

describe('CustomerListPage', () => {
  test('renders list rows and open 360 links', async () => {
    const client = new FakeCustomersClient(async () => ({
      items: [
        {
          customerId: 'cust-101',
          firstName: 'Mina',
          lastName: 'Sok',
          email: 'mina.sok@example.com',
          status: 'ACTIVE',
          createdAt: new Date('2026-04-18T10:00:00.000Z').toISOString()
        }
      ],
      meta: { limit: 25, offset: 0, filtered: false }
    }));

    render(
      <MemoryRouter>
        <CustomerListPage client={client} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Customers')).toBeInTheDocument();
    });

    expect(screen.getByText('Mina Sok')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open 360' })).toHaveAttribute('href', '/customers/cust-101');
  });

  test('renders empty state safely', async () => {
    const client = new FakeCustomersClient(async () => ({
      items: [],
      meta: { limit: 25, offset: 0, filtered: true }
    }));

    render(
      <MemoryRouter>
        <CustomerListPage client={client} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No customers found')).toBeInTheDocument();
    });
  });

  test('renders error state on load failure', async () => {
    const client = new FakeCustomersClient(async () => {
      throw new Error('customer_search_down');
    });

    render(
      <MemoryRouter>
        <CustomerListPage client={client} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Customer list unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText(/customer_search_down/)).toBeInTheDocument();
  });
});
