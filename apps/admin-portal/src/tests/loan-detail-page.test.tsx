import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { LoanDetailPage } from '@/pages/LoanDetailPage';
import type {
  LoanDetailBundle,
  LoanFilters,
  LoanListResponse,
  LoanReviewAction,
  LoanWorkflowCase,
  LoansClient
} from '@/lib/api/loans.client';
import { AuthProvider } from '@/features/auth/AuthProvider';
import type { AuthSession, AuthSessionAdapter } from '@/features/auth/session';

class FakeLoansClient implements LoansClient {
  public readonly actionCalls: Array<{ caseId: string; action: LoanReviewAction }> = [];

  constructor(private readonly detailLoader: () => Promise<LoanDetailBundle>) {}

  async listLoans(_filters: LoanFilters): Promise<LoanListResponse> {
    void _filters;
    return { items: [], warnings: [], meta: { limit: 25, offset: 0, filtered: false } };
  }

  async getLoanDetail(_loanId: string): Promise<LoanDetailBundle> {
    void _loanId;
    return this.detailLoader();
  }

  async applyLoanReviewAction(caseId: string, action: LoanReviewAction, _reason?: string): Promise<LoanWorkflowCase> {
    void _reason;
    this.actionCalls.push({ caseId, action });
    return {
      caseId,
      caseType: 'loan-review',
      status: action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'ON_HOLD',
      actions: [
        {
          actionId: `action-${this.actionCalls.length}`,
          actionType: action,
          newStatus: action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'ON_HOLD',
          createdAt: new Date('2026-04-18T12:00:00.000Z').toISOString()
        }
      ],
      createdAt: new Date('2026-04-18T10:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-04-18T12:00:00.000Z').toISOString(),
      entityType: 'CUSTOMER_ONBOARDING',
      entityId: 'loan-202'
    };
  }
}

class TestAuthAdapter implements AuthSessionAdapter {
  constructor(private readonly session: AuthSession | null) {}

  async getSession(): Promise<AuthSession | null> {
    return this.session;
  }

  async loginRedirect(): Promise<void> {}

  async logout(): Promise<void> {}
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('LoanDetailPage', () => {
  test('renders loan detail and placeholders', async () => {
    const client = new FakeLoansClient(async () => ({
      loan: {
        loanId: 'loan-202',
        customerId: 'cust-202',
        loanAccountId: 'loan-202',
        status: 'ACTIVE',
        currency: 'USD',
        principalCents: 300000,
        termMonths: 24,
        createdAt: new Date('2026-04-18T09:00:00.000Z').toISOString(),
        eligibilityResult: 'ELIGIBILITY_PASSED_PLACEHOLDER',
        approvalWorkflowState: 'IN_REVIEW',
        loanAccountState: 'ACTIVE',
        delinquencyStatus: 'CURRENT',
        workflowCaseId: 'case-loan-202'
      },
      workflowCase: {
        caseId: 'case-loan-202',
        caseType: 'loan-review',
        status: 'IN_REVIEW',
        actions: [],
        createdAt: new Date('2026-04-18T09:00:00.000Z').toISOString(),
        updatedAt: new Date('2026-04-18T09:00:00.000Z').toISOString(),
        entityType: 'CUSTOMER_ONBOARDING',
        entityId: 'loan-202'
      },
      repaymentSchedule: {
        status: 'PLACEHOLDER',
        message: 'Repayment schedule integration is pending in loan detail APIs.',
        entries: []
      },
      delinquency: {
        status: 'CURRENT',
        reason: 'No delinquency marker present on the current loan state.'
      },
      warnings: []
    }));

    const session: AuthSession = {
      principalId: 'ops-manager-1',
      displayName: 'Ops Manager',
      roles: ['OPS_MANAGER'],
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    };

    render(
      <MemoryRouter initialEntries={['/loans/loan-202']}>
        <AuthProvider adapter={new TestAuthAdapter(session)}>
          <Routes>
            <Route path="/loans/:loanId" element={<LoanDetailPage client={client} />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'loan-202' })).toBeInTheDocument();
    });

    expect(screen.getAllByText('cust-202').length).toBeGreaterThan(0);
    expect(screen.getByText('Repayment schedule integration is pending in loan detail APIs.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(screen.getByText('Loan review case case-loan-202 updated to APPROVED.')).toBeInTheDocument();
    });
  });

  test('renders read-only warning for OPS_USER role', async () => {
    const client = new FakeLoansClient(async () => ({
      loan: {
        loanId: 'loan-303',
        customerId: 'cust-303',
        loanAccountId: 'loan-303',
        status: 'CREATED',
        currency: 'USD',
        principalCents: 95000,
        termMonths: 6,
        createdAt: new Date('2026-04-18T09:00:00.000Z').toISOString(),
        eligibilityResult: 'PENDING_REVIEW_PLACEHOLDER',
        approvalWorkflowState: 'NOT_LINKED',
        loanAccountState: 'CREATED',
        delinquencyStatus: 'CURRENT'
      },
      workflowCase: null,
      repaymentSchedule: {
        status: 'PLACEHOLDER',
        message: 'Repayment schedule integration is pending in loan detail APIs.',
        entries: []
      },
      delinquency: {
        status: 'CURRENT',
        reason: 'No delinquency marker present on the current loan state.'
      },
      warnings: ['workflow_lookup_unavailable']
    }));

    const session: AuthSession = {
      principalId: 'ops-user-1',
      displayName: 'Ops User',
      roles: ['OPS_USER'],
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    };

    render(
      <MemoryRouter initialEntries={['/loans/loan-303']}>
        <AuthProvider adapter={new TestAuthAdapter(session)}>
          <Routes>
            <Route path="/loans/:loanId" element={<LoanDetailPage client={client} />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Your role has read-only access for loan reviews.')).toBeInTheDocument();
    });

    expect(screen.getByText(/Some loan detail sources are partial/)).toBeInTheDocument();
  });
});
