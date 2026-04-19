import { apiClient, type ApiClient } from './client';

export type LoanStatus =
  | 'CREATED'
  | 'DISBURSEMENT_PENDING'
  | 'DISBURSED'
  | 'ACTIVE'
  | 'DELINQUENT'
  | 'CLOSED'
  | string;

export type LoanWorkflowStatus =
  | 'NEW'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'ON_HOLD'
  | 'NOT_LINKED'
  | string;

export type LoanReviewAction = 'APPROVE' | 'REJECT' | 'HOLD';

export type LoanItem = {
  loanId: string;
  customerId: string;
  loanAccountId: string;
  status: LoanStatus;
  currency: string;
  principalCents: number;
  termMonths: number;
  createdAt: string;
  eligibilityResult: string;
  approvalWorkflowState: LoanWorkflowStatus;
  loanAccountState: LoanStatus;
  delinquencyStatus: string;
  workflowCaseId?: string;
};

export type LoanWorkflowCaseAction = {
  actionId: string;
  actionType: string;
  oldStatus?: string;
  newStatus: string;
  reason?: string;
  sourceEventId?: string;
  createdAt: string;
};

export type LoanWorkflowCase = {
  caseId: string;
  caseType: string;
  entityType?: string;
  entityId?: string;
  status: LoanWorkflowStatus;
  actions: LoanWorkflowCaseAction[];
  createdAt: string;
  updatedAt: string;
};

export type LoanRepaymentScheduleSummary = {
  status: 'PLACEHOLDER';
  message: string;
  entries: Array<{
    installmentNumber: number;
    dueDate: string;
    totalDueCents: number;
    status: 'PENDING';
  }>;
};

export type LoanDetailBundle = {
  loan: LoanItem;
  workflowCase: LoanWorkflowCase | null;
  repaymentSchedule: LoanRepaymentScheduleSummary;
  delinquency: {
    status: string;
    reason: string;
  };
  warnings: string[];
};

export type LoanFilters = {
  status?: string;
  customerId?: string;
  loanAccountId?: string;
  limit?: number;
  offset?: number;
};

export type LoanListResponse = {
  items: LoanItem[];
  warnings: string[];
  meta: {
    limit: number;
    offset: number;
    filtered: boolean;
  };
};

export interface LoansClient {
  listLoans(filters: LoanFilters): Promise<LoanListResponse>;
  getLoanDetail(loanId: string): Promise<LoanDetailBundle>;
  applyLoanReviewAction(caseId: string, action: LoanReviewAction, reason?: string): Promise<LoanWorkflowCase>;
}

export class HttpLoansClient implements LoansClient {
  constructor(private readonly client: ApiClient = apiClient) {}

  async listLoans(filters: LoanFilters): Promise<LoanListResponse> {
    const warnings: string[] = [];

    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'ALL') {
      params.set('status', filters.status);
    }
    if (filters.customerId) {
      params.set('customerId', filters.customerId);
    }
    if (filters.loanAccountId) {
      params.set('loanAccountId', filters.loanAccountId);
    }
    params.set('limit', String(filters.limit ?? 25));
    params.set('offset', String(filters.offset ?? 0));

    const fromListEndpoint = await this.tryListFromEndpoint(params.toString(), warnings);

    let items = fromListEndpoint;

    if (items.length === 0 && filters.loanAccountId && filters.loanAccountId.trim().length > 1) {
      const single = await this.tryGetLoanById(filters.loanAccountId.trim());
      if (single) {
        items = [single];
      }
    }

    if (items.length === 0 && !filters.loanAccountId) {
      warnings.push('loan_list_endpoint_unavailable_use_loanAccountId_filter');
    }

    const filtered = items.filter((item) => {
      if (filters.status && filters.status !== 'ALL' && item.status !== filters.status) {
        return false;
      }

      if (filters.customerId && item.customerId !== filters.customerId) {
        return false;
      }

      if (filters.loanAccountId && item.loanAccountId !== filters.loanAccountId) {
        return false;
      }

      return true;
    });

    const enriched = await Promise.all(
      filtered.map(async (item) => {
        const workflowCase = await this.findWorkflowCaseByLoanId(item.loanId);
        return {
          ...item,
          approvalWorkflowState: workflowCase?.status ?? 'NOT_LINKED',
          workflowCaseId: workflowCase?.caseId
        };
      })
    );

    return {
      items: enriched,
      warnings,
      meta: {
        limit: filters.limit ?? 25,
        offset: filters.offset ?? 0,
        filtered: Boolean(filters.status || filters.customerId || filters.loanAccountId)
      }
    };
  }

  async getLoanDetail(loanId: string): Promise<LoanDetailBundle> {
    const loan = await this.getLoanOrThrow(loanId);
    const warnings: string[] = [];

    let workflowCase: LoanWorkflowCase | null = null;

    try {
      workflowCase = await this.findWorkflowCaseByLoanId(loanId);
    } catch {
      warnings.push('workflow_lookup_unavailable');
    }

    return {
      loan: {
        ...loan,
        approvalWorkflowState: workflowCase?.status ?? 'NOT_LINKED',
        workflowCaseId: workflowCase?.caseId
      },
      workflowCase,
      repaymentSchedule: {
        status: 'PLACEHOLDER',
        message: 'Repayment schedule integration is pending in loan detail APIs.',
        entries: []
      },
      delinquency: {
        status: loan.status === 'DELINQUENT' ? 'DELINQUENT' : 'CURRENT',
        reason:
          loan.status === 'DELINQUENT'
            ? 'Loan is currently marked as delinquent by servicing state.'
            : 'No delinquency marker present on the current loan state.'
      },
      warnings
    };
  }

  async applyLoanReviewAction(
    caseId: string,
    action: LoanReviewAction,
    reason?: string
  ): Promise<LoanWorkflowCase> {
    const response = await this.client.request<unknown>(`/cases/${encodeURIComponent(caseId)}/actions`, {
      method: 'POST',
      headers: {
        'x-internal-ops-role': 'ops',
        'x-internal-ops-actor-id': 'admin-portal'
      },
      body: {
        actionType: action,
        reason: reason?.trim() ? reason.trim() : undefined
      }
    });

    return mapWorkflowCase(response);
  }

  private async tryListFromEndpoint(query: string, warnings: string[]): Promise<LoanItem[]> {
    try {
      const response = await this.client.request<unknown>(`/loans?${query}`);
      const rows = extractArray(response, ['data.items', 'items', 'data']);
      return rows.map((row) => mapLoanItem(row));
    } catch (error: unknown) {
      if (!isApiNotFoundError(error)) {
        warnings.push('loan_list_query_failed');
      }

      return [];
    }
  }

  private async tryGetLoanById(loanId: string): Promise<LoanItem | null> {
    try {
      const response = await this.client.request<unknown>(`/loans/${encodeURIComponent(loanId)}`);
      return mapLoanItem(response);
    } catch (error: unknown) {
      if (isApiNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  private async getLoanOrThrow(loanId: string): Promise<LoanItem> {
    const loan = await this.tryGetLoanById(loanId);
    if (!loan) {
      throw new Error('loan_not_found');
    }

    return loan;
  }

  private async findWorkflowCaseByLoanId(loanId: string): Promise<LoanWorkflowCase | null> {
    const entityTypes = ['CUSTOMER_ONBOARDING', 'EKYC_SESSION'] as const;

    for (const entityType of entityTypes) {
      try {
        const result = await this.client.request<unknown>(
          `/cases?entityType=${entityType}&entityId=${encodeURIComponent(loanId)}`,
          {
            headers: {
              'x-internal-ops-role': 'ops',
              'x-internal-ops-actor-id': 'admin-portal'
            }
          }
        );

        const mapped = mapWorkflowCase(result);

        if (mapped.caseType.toLowerCase() === 'loan-review') {
          return mapped;
        }
      } catch (error: unknown) {
        if (!isApiNotFoundError(error) && !isApiValidationError(error) && !isApiForbiddenError(error)) {
          throw error;
        }
      }
    }

    return null;
  }
}

function mapLoanItem(value: unknown): LoanItem {
  const node = selectDataNode(value);
  const status = readString(node, ['status']) ?? 'CREATED';

  return {
    loanId: readString(node, ['loanId']) ?? 'unknown-loan',
    customerId: readString(node, ['customerId']) ?? 'unknown-customer',
    loanAccountId: readString(node, ['loanAccountId']) ?? readString(node, ['loanId']) ?? 'unknown-loan',
    status,
    currency: readString(node, ['currency']) ?? 'USD',
    principalCents: readNumber(node, ['principalCents']) ?? 0,
    termMonths: readNumber(node, ['termMonths']) ?? 0,
    createdAt: readString(node, ['createdAt']) ?? new Date(0).toISOString(),
    eligibilityResult: status === 'CREATED' ? 'PENDING_REVIEW_PLACEHOLDER' : 'ELIGIBILITY_PASSED_PLACEHOLDER',
    approvalWorkflowState: 'NOT_LINKED',
    loanAccountState: status,
    delinquencyStatus: status === 'DELINQUENT' ? 'DELINQUENT' : 'CURRENT'
  };
}

function mapWorkflowCase(value: unknown): LoanWorkflowCase {
  const node = selectDataNode(value);
  const actions = extractArray(node, ['actions']);

  return {
    caseId: readString(node, ['caseId']) ?? 'unknown-case',
    caseType: readString(node, ['caseType']) ?? 'unknown-case-type',
    entityType: readString(node, ['entityType']),
    entityId: readString(node, ['entityId']),
    status: readString(node, ['status']) ?? 'NOT_LINKED',
    createdAt: readString(node, ['createdAt']) ?? new Date(0).toISOString(),
    updatedAt: readString(node, ['updatedAt']) ?? new Date(0).toISOString(),
    actions: actions.map((action, index) => ({
      actionId: readString(action, ['actionId']) ?? `action-${index + 1}`,
      actionType: readString(action, ['actionType']) ?? 'UNKNOWN',
      oldStatus: readString(action, ['oldStatus']),
      newStatus: readString(action, ['newStatus']) ?? readString(action, ['status']) ?? 'UNKNOWN',
      reason: readString(action, ['reason']),
      sourceEventId: readString(action, ['sourceEventId']),
      createdAt: readString(action, ['createdAt']) ?? new Date(0).toISOString()
    }))
  };
}

function selectDataNode(value: unknown): unknown {
  const data = readUnknown(value, ['data']);
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data;
  }

  return value;
}

function extractArray(value: unknown, pathHints: string[]): unknown[] {
  for (const hint of pathHints) {
    const found = readUnknown(value, hint.split('.'));
    if (Array.isArray(found)) {
      return found;
    }
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [];
}

function readUnknown(value: unknown, path: string[]): unknown {
  let current: unknown = value;

  for (const key of path) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

function readString(value: unknown, path: string[]): string | undefined {
  const found = readUnknown(value, path);
  return typeof found === 'string' ? found : undefined;
}

function readNumber(value: unknown, path: string[]): number | undefined {
  const found = readUnknown(value, path);
  return typeof found === 'number' ? found : undefined;
}

function isApiNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('api_request_failed:404');
}

function isApiValidationError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('api_request_failed:400');
}

function isApiForbiddenError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('api_request_failed:403');
}
