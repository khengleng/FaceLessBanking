import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { OnboardingReviewPage } from '@/pages/OnboardingReviewPage';
import type {
  OnboardingCaseAction,
  OnboardingCaseDetail,
  OnboardingCaseFilters,
  OnboardingCasesPage,
  WorkflowCasesClient
} from '@/lib/api/workflow-cases.client';

class FakeWorkflowCasesClient implements WorkflowCasesClient {
  public actionCalls: Array<{ caseId: string; action: OnboardingCaseAction; reason?: string }> = [];
  private readonly page: OnboardingCasesPage;
  private detail: OnboardingCaseDetail;

  constructor(page: OnboardingCasesPage, detail: OnboardingCaseDetail) {
    this.page = page;
    this.detail = detail;
  }

  async listOnboardingCases(_filters: OnboardingCaseFilters): Promise<OnboardingCasesPage> {
    void _filters;
    return this.page;
  }

  async getCaseById(caseId: string): Promise<OnboardingCaseDetail> {
    if (caseId !== this.detail.caseId) {
      throw new Error('case_not_found');
    }

    return this.detail;
  }

  async applyCaseAction(
    caseId: string,
    actionType: OnboardingCaseAction,
    reason?: string
  ): Promise<OnboardingCaseDetail> {
    this.actionCalls.push({ caseId, action: actionType, reason });
    this.detail = {
      ...this.detail,
      status:
        actionType === 'APPROVE'
          ? 'APPROVED'
          : actionType === 'REJECT'
            ? 'REJECTED'
            : actionType === 'HOLD'
              ? 'ON_HOLD'
              : 'IN_REVIEW',
      updatedAt: new Date('2026-04-18T14:00:00.000Z').toISOString(),
      actions: [
        ...this.detail.actions,
        {
          actionId: `a-${this.actionCalls.length}`,
          actionType,
          newStatus:
            actionType === 'APPROVE'
              ? 'APPROVED'
              : actionType === 'REJECT'
                ? 'REJECTED'
                : actionType === 'HOLD'
                  ? 'ON_HOLD'
                  : 'IN_REVIEW',
          createdAt: new Date('2026-04-18T14:00:00.000Z').toISOString()
        }
      ]
    };

    return this.detail;
  }
}

const basePage: OnboardingCasesPage = {
  items: [
    {
      caseId: 'case-1',
      caseType: 'ONBOARDING_REVIEW',
      entityId: 'onboarding-ref-11',
      entityType: 'EKYC_SESSION',
      status: 'IN_REVIEW',
      createdAt: new Date('2026-04-18T08:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-04-18T09:00:00.000Z').toISOString(),
      correlationId: 'corr-1'
    }
  ],
  meta: {
    totalItems: 1,
    limit: 25,
    offset: 0
  }
};

const baseDetail: OnboardingCaseDetail = {
  ...basePage.items[0],
  actions: []
};

describe('OnboardingReviewPage', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test('lists onboarding review cases and shows case details', async () => {
    const client = new FakeWorkflowCasesClient(basePage, baseDetail);

    render(<OnboardingReviewPage client={client} />);

    await waitFor(() => {
      expect(screen.getByText('Onboarding Review Queue')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('No recorded actions yet.')).toBeInTheDocument();
    });

    expect(screen.getAllByText('case-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('onboarding-ref-11').length).toBeGreaterThan(0);
  });

  test('shows empty state when no cases match filters', async () => {
    const client = new FakeWorkflowCasesClient(
      {
        items: [],
        meta: { totalItems: 0, limit: 25, offset: 0 }
      },
      baseDetail
    );

    render(<OnboardingReviewPage client={client} />);

    await waitFor(() => {
      expect(screen.getByText('No onboarding cases found')).toBeInTheDocument();
    });
  });

  test('approve action updates case with success state', async () => {
    const client = new FakeWorkflowCasesClient(basePage, baseDetail);

    render(<OnboardingReviewPage client={client} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(screen.getByText('Case case-1 updated to APPROVED.')).toBeInTheDocument();
    });

    expect(client.actionCalls).toEqual([{ caseId: 'case-1', action: 'APPROVE', reason: undefined }]);
  });

  test('reject action asks for confirmation before applying', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const client = new FakeWorkflowCasesClient(basePage, baseDetail);

    render(<OnboardingReviewPage client={client} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(client.actionCalls).toHaveLength(0);
  });

  test('shows error state when queue load fails', async () => {
    const client: WorkflowCasesClient = {
      listOnboardingCases: async () => {
        throw new Error('queue_down');
      },
      getCaseById: async () => baseDetail,
      applyCaseAction: async () => baseDetail
    };

    render(<OnboardingReviewPage client={client} />);

    await waitFor(() => {
      expect(screen.getByText('Onboarding queue unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText(/queue_down/)).toBeInTheDocument();
  });
});
