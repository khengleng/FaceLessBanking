import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { PaymentDetailPage } from '@/pages/PaymentDetailPage';
import type { PaymentDetailBundle, PaymentFilters, PaymentListResponse, PaymentsClient } from '@/lib/api/payments.client';

class FakePaymentsClient implements PaymentsClient {
  constructor(private readonly detailLoader: () => Promise<PaymentDetailBundle>) {}

  async listPayments(_filters: PaymentFilters): Promise<PaymentListResponse> {
    void _filters;
    return { items: [], meta: { limit: 25, offset: 0, filtered: false } };
  }

  async getPaymentDetail(_paymentId: string): Promise<PaymentDetailBundle> {
    void _paymentId;
    return this.detailLoader();
  }
}

afterEach(() => {
  cleanup();
});

describe('PaymentDetailPage', () => {
  test('renders payment detail and lifecycle timeline', async () => {
    const client = new FakePaymentsClient(async () => ({
      payment: {
        paymentId: 'pay-201',
        sourceAccountId: 'acc-source-201',
        destinationAccountId: 'acc-dest-201',
        amount: 15000,
        currency: 'USD',
        status: 'COMPLETED',
        correlationId: 'corr-201',
        createdAt: new Date('2026-04-18T09:00:00.000Z').toISOString(),
        updatedAt: new Date('2026-04-18T09:05:00.000Z').toISOString()
      },
      timeline: [
        {
          id: 't1',
          label: 'payment.initiated.v1',
          status: 'ACCEPTED',
          timestamp: new Date('2026-04-18T09:00:00.000Z').toISOString(),
          source: 'payment'
        },
        {
          id: 't2',
          label: 'payment.status.updated.v1',
          status: 'COMPLETED',
          timestamp: new Date('2026-04-18T09:05:00.000Z').toISOString(),
          source: 'audit'
        }
      ],
      warnings: []
    }));

    render(
      <MemoryRouter initialEntries={['/payments/pay-201']}>
        <Routes>
          <Route path="/payments/:paymentId" element={<PaymentDetailPage client={client} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'pay-201' })).toBeInTheDocument();
    });

    expect(screen.getByText('acc-source-201')).toBeInTheDocument();
    expect(screen.getByText('acc-dest-201')).toBeInTheDocument();
    expect(screen.getByText('payment.status.updated.v1')).toBeInTheDocument();
  });

  test('renders safe error state', async () => {
    const client = new FakePaymentsClient(async () => {
      throw new Error('payment_detail_down');
    });

    render(
      <MemoryRouter initialEntries={['/payments/pay-404']}>
        <Routes>
          <Route path="/payments/:paymentId" element={<PaymentDetailPage client={client} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Payment detail unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText(/payment_detail_down/)).toBeInTheDocument();
  });

  test('shows partial warning banner when timeline sources are unavailable', async () => {
    const client = new FakePaymentsClient(async () => ({
      payment: {
        paymentId: 'pay-301',
        sourceAccountId: 'acc-source-301',
        destinationAccountId: 'acc-dest-301',
        amount: 7000,
        currency: 'USD',
        status: 'PENDING',
        correlationId: 'corr-301',
        createdAt: new Date('2026-04-18T09:00:00.000Z').toISOString(),
        updatedAt: new Date('2026-04-18T09:01:00.000Z').toISOString()
      },
      timeline: [
        {
          id: 'placeholder',
          label: 'Lifecycle timeline placeholder',
          status: 'PENDING',
          timestamp: new Date('2026-04-18T09:01:00.000Z').toISOString(),
          source: 'placeholder'
        }
      ],
      warnings: ['audit_timeline_unavailable']
    }));

    render(
      <MemoryRouter initialEntries={['/payments/pay-301']}>
        <Routes>
          <Route path="/payments/:paymentId" element={<PaymentDetailPage client={client} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Some timeline sources are partial/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(screen.getByText('Lifecycle timeline placeholder')).toBeInTheDocument();
    });
  });
});
