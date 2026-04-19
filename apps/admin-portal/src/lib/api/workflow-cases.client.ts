import { apiClient, type ApiClient } from './client';

export const ONBOARDING_CASE_STATUSES = ['NEW', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ON_HOLD'] as const;

export type OnboardingCaseStatus = (typeof ONBOARDING_CASE_STATUSES)[number];

export const ONBOARDING_CASE_ACTIONS = ['APPROVE', 'REJECT', 'HOLD', 'REQUEST_REVIEW'] as const;

export type OnboardingCaseAction = (typeof ONBOARDING_CASE_ACTIONS)[number];

export type OnboardingCase = {
  caseId: string;
  caseType: 'ONBOARDING_REVIEW';
  entityId: string;
  entityType?: string;
  status: OnboardingCaseStatus;
  correlationId?: string;
  updatedAt: string;
  createdAt: string;
};

export type OnboardingCaseDetail = OnboardingCase & {
  actions: Array<{
    actionId: string;
    actionType: string;
    oldStatus?: OnboardingCaseStatus;
    newStatus: OnboardingCaseStatus;
    reason?: string;
    sourceEventId?: string;
    createdAt: string;
  }>;
};

export type OnboardingCaseFilters = {
  status?: OnboardingCaseStatus | 'ALL';
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
};

export type OnboardingCasesPage = {
  items: OnboardingCase[];
  meta: {
    totalItems: number;
    limit: number;
    offset: number;
  };
};

export interface WorkflowCasesClient {
  listOnboardingCases(filters: OnboardingCaseFilters): Promise<OnboardingCasesPage>;
  getCaseById(caseId: string): Promise<OnboardingCaseDetail>;
  applyCaseAction(caseId: string, actionType: OnboardingCaseAction, reason?: string): Promise<OnboardingCaseDetail>;
}

export class HttpWorkflowCasesClient implements WorkflowCasesClient {
  constructor(private readonly client: ApiClient = apiClient) {}

  async listOnboardingCases(filters: OnboardingCaseFilters): Promise<OnboardingCasesPage> {
    const params = new URLSearchParams();

    if (filters.status && filters.status !== 'ALL') {
      params.set('status', filters.status);
    }

    if (filters.entityId) {
      params.set('entityId', filters.entityId);
    }

    if (filters.dateFrom) {
      params.set('dateFrom', filters.dateFrom);
    }

    if (filters.dateTo) {
      params.set('dateTo', filters.dateTo);
    }

    params.set('limit', String(filters.limit ?? 20));
    params.set('offset', String(filters.offset ?? 0));

    const raw = await this.client.request<unknown>(`/cases/onboarding-review?${params.toString()}`);

    const items = extractArray(raw, ['data.items', 'items', 'data']).map(mapCase);
    const totalItems = readNumber(raw, ['meta', 'totalItems']) ?? readNumber(raw, ['data', 'total']) ?? items.length;

    return {
      items,
      meta: {
        totalItems,
        limit: filters.limit ?? 20,
        offset: filters.offset ?? 0
      }
    };
  }

  async getCaseById(caseId: string): Promise<OnboardingCaseDetail> {
    const raw = await this.client.request<unknown>(`/cases/${caseId}`);
    return mapCaseDetail(raw);
  }

  async applyCaseAction(
    caseId: string,
    actionType: OnboardingCaseAction,
    reason?: string
  ): Promise<OnboardingCaseDetail> {
    const raw = await this.client.request<unknown>(`/cases/${caseId}/actions`, {
      method: 'POST',
      body: {
        actionType,
        reason: reason?.trim() ? reason.trim() : undefined
      }
    });

    return mapCaseDetail(raw);
  }
}

function mapCase(input: unknown): OnboardingCase {
  const item = selectDataNode(input);

  return {
    caseId: readString(item, ['caseId']) ?? 'unknown-case',
    caseType: 'ONBOARDING_REVIEW',
    entityId: readString(item, ['entityId']) ?? 'unknown-entity',
    entityType: readString(item, ['entityType']) ?? 'EKYC_SESSION',
    status: normalizeStatus(readString(item, ['status'])),
    correlationId: readString(item, ['correlationId']),
    createdAt: readString(item, ['createdAt']) ?? new Date(0).toISOString(),
    updatedAt: readString(item, ['updatedAt']) ?? new Date(0).toISOString()
  };
}

function mapCaseDetail(input: unknown): OnboardingCaseDetail {
  const base = mapCase(input);
  const node = selectDataNode(input);

  return {
    ...base,
    actions: extractArray(node, ['actions']).map((action, index) => ({
      actionId: readString(action, ['actionId']) ?? `${base.caseId}-action-${index + 1}`,
      actionType: readString(action, ['actionType']) ?? 'UNKNOWN',
      oldStatus: normalizeStatus(readString(action, ['oldStatus']), false),
      newStatus: normalizeStatus(readString(action, ['newStatus']) ?? readString(action, ['status'])),
      reason: readString(action, ['reason']),
      sourceEventId: readString(action, ['sourceEventId']),
      createdAt: readString(action, ['createdAt']) ?? new Date(0).toISOString()
    }))
  };
}

function normalizeStatus(value: string | undefined, fallbackToInReview = true): OnboardingCaseStatus {
  if (!value) {
    return fallbackToInReview ? 'IN_REVIEW' : 'NEW';
  }

  const normalized = value.toUpperCase();
  if (ONBOARDING_CASE_STATUSES.includes(normalized as OnboardingCaseStatus)) {
    return normalized as OnboardingCaseStatus;
  }

  return fallbackToInReview ? 'IN_REVIEW' : 'NEW';
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
