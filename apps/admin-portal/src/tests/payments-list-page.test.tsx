import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';

import { PaymentsListPage } from '@/pages/PaymentsListPage';
import type { PaymentDetailBundle, PaymentFilters, PaymentListResponse, PaymentsClient } from '@/lib/api/payments.client';

class FakePaymentsClient implements PaymentsClient {
  constructor(private readonly listLoader: () => Promise<PaymentListResponse>) {}

  async listPayments(_filters: PaymentFilters): Promise<PaymentListResponse> {
    void _filters;
    return this.listLoader();
  }

  async getPaymentDetail(_paymentId: string): Promise<PaymentDetailBundle> {
    void _paymentId;
    throw new Error('not_used');
  }
}

describe('PaymentsListPage', () => {
  test('renders payments table rows', async () => {
    const client = new FakePaymentsClient(async () => ({
      items: [
        {
          paymentId: 'pay-101',
          sourceAccountId: 'acc-source-1',
          destinationAccountId: 'acc-dest-2',
          amount: 12500,
          currency: 'USD',
          status: 'FAILED',
          correlationId: 'corr-pay-101',
          createdAt: new Date('2026-04-18T10:00:00.000Z').toISOString(),
          updatedAt: new Date('2026-04-18T10:10:00.000Z').toISOString()
        }
      ],
      meta: { limit: 25, offset: 0, filtered: false }
    }));

    render(
      <MemoryRouter>
        <PaymentsListPage client={client} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Payments Investigation')).toBeInTheDocument();
    });

    expect(screen.getByText('pay-101')).toBeInTheDocument();
    expect(screen.getByText('corr-pay-101')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Investigate' })).toHaveAttribute('href', '/payments/pay-101');
  });

  test('renders empty state safely', async () => {
    const client = new FakePaymentsClient(async () => ({
      items: [],
      meta: { limit: 25, offset: 0, filtered: true }
    }));

    render(
      <MemoryRouter>
        <PaymentsListPage client={client} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No payments found')).toBeInTheDocument();
    });
  });
});
