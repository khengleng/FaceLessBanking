import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';

import { TreasuryOverviewPage } from '@/pages/TreasuryOverviewPage';
import type { TreasuryClient, TreasuryOverview } from '@/lib/api/treasury.client';

class FakeTreasuryClient implements TreasuryClient {
  constructor(private readonly loader: () => Promise<TreasuryOverview>) {}

  async getOverview(_currency?: string): Promise<TreasuryOverview> {
    void _currency;
    return this.loader();
  }
}

describe('TreasuryOverviewPage', () => {
  test('renders liquidity, ALM, maturity, and repricing sections', async () => {
    const client = new FakeTreasuryClient(async () => ({
      liquidityPositions: [
        {
          currency: 'USD',
          availableCashCents: 1200000n,
          reservedCashCents: 100000n,
          outgoingPendingCents: 50000n,
          incomingPendingCents: 25000n,
          updatedAt: new Date('2026-04-18T10:00:00.000Z').toISOString()
        }
      ],
      treasuryAccounts: [
        {
          accountId: 'treasury-usd-1',
          currency: 'USD',
          balanceCents: 2200000n,
          type: 'SETTLEMENT'
        }
      ],
      almSummary: {
        totalAssetsCents: 6000000n,
        totalLiabilitiesCents: 4100000n,
        netPositionCents: 1900000n,
        currenciesCount: 1
      },
      maturityBuckets: [
        {
          bucketKey: '0_7_DAYS',
          inflowCents: 120000n,
          outflowCents: 80000n,
          netGapCents: 40000n,
          currency: 'USD'
        }
      ],
      repricingGaps: [
        {
          bucketCode: '0_1_MONTH',
          repricingAssetsCents: 2000000n,
          repricingLiabilitiesCents: 1500000n,
          gapCents: 500000n,
          cumulativeGapCents: 500000n
        }
      ],
      warnings: []
    }));

    render(
      <MemoryRouter>
        <TreasuryOverviewPage client={client} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Treasury / Liquidity / ALM' })).toBeInTheDocument();
    });

    expect(screen.getByText('Liquidity Positions')).toBeInTheDocument();
    expect(screen.getByText('ALM Summary')).toBeInTheDocument();
    expect(screen.getByText('Maturity Buckets')).toBeInTheDocument();
    expect(screen.getByText('Repricing Gaps')).toBeInTheDocument();
    expect(screen.getAllByText('USD').length).toBeGreaterThan(0);
  });

  test('renders empty state safely', async () => {
    const client = new FakeTreasuryClient(async () => ({
      liquidityPositions: [],
      treasuryAccounts: [],
      almSummary: null,
      maturityBuckets: [],
      repricingGaps: [],
      warnings: []
    }));

    render(
      <MemoryRouter>
        <TreasuryOverviewPage client={client} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No treasury data found')).toBeInTheDocument();
    });
  });
});
