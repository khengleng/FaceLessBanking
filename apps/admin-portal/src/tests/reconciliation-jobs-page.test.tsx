import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test } from 'vitest';

import { ReconciliationJobsPage } from '@/pages/ReconciliationJobsPage';
import type {
  ReconciliationClient,
  ReconciliationJob,
  ReconciliationJobDetail,
  ReconciliationJobType
} from '@/lib/api/reconciliation.client';

class FakeReconciliationClient implements ReconciliationClient {
  constructor(
    private readonly listLoader: () => Promise<{ items: ReconciliationJob[]; warnings: string[]; meta: { limit: number; offset: number; filtered: boolean } }> =
      async () => ({ items: [], warnings: [], meta: { limit: 25, offset: 0, filtered: false } })
  ) {}

  async listJobs(): Promise<{ items: ReconciliationJob[]; warnings: string[]; meta: { limit: number; offset: number; filtered: boolean } }> {
    return this.listLoader();
  }

  async createJob(jobType: ReconciliationJobType): Promise<ReconciliationJob> {
    return {
      jobId: 'job-new-1',
      jobType,
      status: 'PENDING',
      createdAt: new Date('2026-04-18T10:00:00.000Z').toISOString()
    };
  }

  async getJobDetail(_jobId: string): Promise<ReconciliationJobDetail> {
    void _jobId;
    throw new Error('not_used');
  }

  async runJob(_jobId: string): Promise<{ status: string }> {
    void _jobId;
    throw new Error('not_used');
  }
}

afterEach(() => {
  cleanup();
});

describe('ReconciliationJobsPage', () => {
  test('renders reconciliation jobs table', async () => {
    const client = new FakeReconciliationClient(async () => ({
      items: [
        {
          jobId: 'job-101',
          jobType: 'PAYMENT_STATUS_RECON',
          status: 'COMPLETED',
          createdAt: new Date('2026-04-18T10:00:00.000Z').toISOString(),
          mismatchCount: 2
        }
      ],
      warnings: [],
      meta: { limit: 25, offset: 0, filtered: false }
    }));

    render(
      <MemoryRouter>
        <ReconciliationJobsPage client={client} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Reconciliation Jobs')).toBeInTheDocument();
    });

    expect(screen.getByText('job-101')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/reconciliation/job-101');
  });

  test('creates reconciliation job from form action', async () => {
    const client = new FakeReconciliationClient(async () => ({
      items: [],
      warnings: [],
      meta: { limit: 25, offset: 0, filtered: false }
    }));

    render(
      <MemoryRouter>
        <ReconciliationJobsPage client={client} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create Job' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Job' }));

    await waitFor(() => {
      expect(screen.getByText(/Reconciliation job job-new-1 created/)).toBeInTheDocument();
    });
  });
});
