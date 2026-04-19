import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { ReconciliationJobDetailPage } from '@/pages/ReconciliationJobDetailPage';
import type {
  ReconciliationClient,
  ReconciliationJob,
  ReconciliationJobDetail,
  ReconciliationJobType
} from '@/lib/api/reconciliation.client';

class FakeReconciliationClient implements ReconciliationClient {
  constructor(private readonly detailLoader: () => Promise<ReconciliationJobDetail>) {}

  async listJobs(): Promise<{ items: ReconciliationJob[]; warnings: string[]; meta: { limit: number; offset: number; filtered: boolean } }> {
    return { items: [], warnings: [], meta: { limit: 25, offset: 0, filtered: false } };
  }

  async createJob(jobType: ReconciliationJobType): Promise<ReconciliationJob> {
    return {
      jobId: 'job-1',
      jobType,
      status: 'PENDING',
      createdAt: new Date('2026-04-18T10:00:00.000Z').toISOString()
    };
  }

  async getJobDetail(_jobId: string): Promise<ReconciliationJobDetail> {
    void _jobId;
    return this.detailLoader();
  }

  async runJob(_jobId: string): Promise<{ status: string }> {
    void _jobId;
    return { status: 'ACCEPTED' };
  }
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ReconciliationJobDetailPage', () => {
  test('renders mismatch summary and details', async () => {
    const client = new FakeReconciliationClient(async () => ({
      job: {
        jobId: 'job-202',
        jobType: 'LOAN_STATUS_RECON',
        status: 'COMPLETED',
        createdAt: new Date('2026-04-18T10:00:00.000Z').toISOString()
      },
      mismatchCount: 1,
      mismatches: [
        {
          mismatchId: 'mm-1',
          jobId: 'job-202',
          entityType: 'loan',
          entityId: 'loan-9',
          expectedValue: 'ACTIVE',
          actualValue: 'DELINQUENT',
          mismatchType: 'DATA_MISMATCH',
          createdAt: new Date('2026-04-18T10:15:00.000Z').toISOString()
        }
      ]
    }));

    render(
      <MemoryRouter initialEntries={['/reconciliation/job-202']}>
        <Routes>
          <Route path="/reconciliation/:jobId" element={<ReconciliationJobDetailPage client={client} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'job-202' })).toBeInTheDocument();
    });

    expect(screen.getByText('Mismatch Count')).toBeInTheDocument();
    expect(screen.getByText('loan-9')).toBeInTheDocument();
    expect(screen.getByText('DATA_MISMATCH')).toBeInTheDocument();
  });

  test('run action shows success state', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const client = new FakeReconciliationClient(async () => ({
      job: {
        jobId: 'job-303',
        jobType: 'PAYMENT_STATUS_RECON',
        status: 'PENDING',
        createdAt: new Date('2026-04-18T10:00:00.000Z').toISOString()
      },
      mismatchCount: 0,
      mismatches: []
    }));

    render(
      <MemoryRouter initialEntries={['/reconciliation/job-303']}>
        <Routes>
          <Route path="/reconciliation/:jobId" element={<ReconciliationJobDetailPage client={client} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Run Job' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Run Job' }));

    await waitFor(() => {
      expect(screen.getByText('Reconciliation run accepted: ACCEPTED.')).toBeInTheDocument();
    });
  });
});
