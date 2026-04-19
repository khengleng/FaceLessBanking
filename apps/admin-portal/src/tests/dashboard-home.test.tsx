import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { DashboardHomePage } from '@/pages/DashboardHomePage';
import type { DashboardSnapshot, OpsDashboardClient } from '@/lib/api/ops-dashboard.client';

class FakeDashboardClient implements OpsDashboardClient {
  constructor(private readonly loader: () => Promise<DashboardSnapshot>) {}

  async loadSnapshot(): Promise<DashboardSnapshot> {
    return this.loader();
  }
}

const baseSnapshot: DashboardSnapshot = {
  onboardingPending: 4,
  paymentsFailed: 2,
  loansInReview: 3,
  openDisputes: 1,
  reconciliationMismatches: 5,
  liquiditySummary: {
    availableLiquidity: 120000,
    currency: 'USD',
    source: 'placeholder'
  },
  recentActivity: [
    {
      id: 'a1',
      title: 'Payment pipeline recovered',
      timestamp: new Date('2026-04-18T10:00:00.000Z').toISOString()
    }
  ],
  alerts: [
    {
      id: 'al1',
      severity: 'critical',
      message: 'Reconciliation mismatch spike',
      timestamp: new Date('2026-04-18T10:05:00.000Z').toISOString()
    }
  ]
};

describe('DashboardHomePage', () => {
  test('renders summary widgets on successful data load', async () => {
    const client = new FakeDashboardClient(async () => baseSnapshot);

    render(<DashboardHomePage client={client} />);

    await waitFor(() => {
      expect(screen.getByText('Onboarding Pending')).toBeInTheDocument();
    });

    expect(screen.getByText('Payments Failed')).toBeInTheDocument();
    expect(screen.getByText('Loans In Review')).toBeInTheDocument();
    expect(screen.getByText('Open Disputes')).toBeInTheDocument();
    expect(screen.getByText('Reconciliation Mismatches')).toBeInTheDocument();
    expect(screen.getByText('Liquidity Summary')).toBeInTheDocument();
  });

  test('shows empty state when snapshot has no data', async () => {
    const client = new FakeDashboardClient(async () => ({
      ...baseSnapshot,
      onboardingPending: 0,
      paymentsFailed: 0,
      loansInReview: 0,
      openDisputes: 0,
      reconciliationMismatches: 0,
      recentActivity: [],
      alerts: []
    }));

    render(<DashboardHomePage client={client} />);

    await waitFor(() => {
      expect(screen.getByText('No dashboard data yet')).toBeInTheDocument();
    });
  });

  test('shows error state when dashboard load fails', async () => {
    const client = new FakeDashboardClient(async () => {
      throw new Error('aggregation_unavailable');
    });

    render(<DashboardHomePage client={client} />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard data unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText(/aggregation_unavailable/)).toBeInTheDocument();
  });
});
