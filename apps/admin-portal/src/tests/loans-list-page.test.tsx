import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';

import { LoansListPage } from '@/pages/LoansListPage';
import type {
  LoanDetailBundle,
  LoanFilters,
  LoanListResponse,
  LoanReviewAction,
  LoanWorkflowCase,
  LoansClient
} from '@/lib/api/loans.client';

class FakeLoansClient implements LoansClient {
  constructor(private readonly listLoader: () => Promise<LoanListResponse>) {}

  async listLoans(_filters: LoanFilters): Promise<LoanListResponse> {
    void _filters;
    return this.listLoader();
  }

  async getLoanDetail(_loanId: string): Promise<LoanDetailBundle> {
    void _loanId;
    throw new Error('not_used');
  }

  async applyLoanReviewAction(_caseId: string, _action: LoanReviewAction, _reason?: string): Promise<LoanWorkflowCase> {
    void _caseId;
    void _action;
    void _reason;
    throw new Error('not_used');
  }
}

describe('LoansListPage', () => {
  test('renders loans table rows', async () => {
    const client = new FakeLoansClient(async () => ({
      items: [
        {
          loanId: 'loan-101',
          customerId: 'cust-101',
          loanAccountId: 'loan-101',
          status: 'CREATED',
          currency: 'USD',
          principalCents: 150000,
          termMonths: 12,
          createdAt: new Date('2026-04-18T10:00:00.000Z').toISOString(),
          eligibilityResult: 'PENDING_REVIEW_PLACEHOLDER',
          approvalWorkflowState: 'IN_REVIEW',
          loanAccountState: 'CREATED',
          delinquencyStatus: 'CURRENT',
          workflowCaseId: 'case-loan-101'
        }
      ],
      warnings: [],
      meta: { limit: 25, offset: 0, filtered: false }
    }));

    render(
      <MemoryRouter>
        <LoansListPage client={client} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Loans Review & Investigation')).toBeInTheDocument();
    });

    expect(screen.getByText('loan-101')).toBeInTheDocument();
    expect(screen.getByText('cust-101')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Investigate' })).toHaveAttribute('href', '/loans/loan-101');
  });

  test('renders empty state safely', async () => {
    const client = new FakeLoansClient(async () => ({
      items: [],
      warnings: ['loan_list_endpoint_unavailable_use_loanAccountId_filter'],
      meta: { limit: 25, offset: 0, filtered: true }
    }));

    render(
      <MemoryRouter>
        <LoansListPage client={client} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No loans found')).toBeInTheDocument();
    });

    expect(screen.getByText(/Some loan list sources are partial/)).toBeInTheDocument();
  });
});
