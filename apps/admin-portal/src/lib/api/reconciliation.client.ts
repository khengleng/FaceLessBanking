import { apiClient, type ApiClient } from './client';

export type ReconciliationJobType =
  | 'PAYMENT_STATUS_RECON'
  | 'BALANCE_SNAPSHOT_RECON'
  | 'LOAN_STATUS_RECON';

export type ReconciliationJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | string;

export type ReconciliationMismatch = {
  mismatchId: string;
  jobId: string;
  entityType: string;
  entityId: string;
  expectedValue: string;
  actualValue: string;
  mismatchType: string;
  createdAt: string;
};

export type ReconciliationJob = {
  jobId: string;
  jobType: ReconciliationJobType;
  status: ReconciliationJobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  mismatchCount?: number;
};

export type ReconciliationJobDetail = {
  job: ReconciliationJob;
  mismatchCount: number;
  mismatches: ReconciliationMismatch[];
};

export type ReconciliationJobsListResponse = {
  items: ReconciliationJob[];
  warnings: string[];
  meta: {
    limit: number;
    offset: number;
    filtered: boolean;
  };
};

export interface ReconciliationClient {
  listJobs(limit?: number, offset?: number): Promise<ReconciliationJobsListResponse>;
  createJob(jobType: ReconciliationJobType): Promise<ReconciliationJob>;
  getJobDetail(jobId: string): Promise<ReconciliationJobDetail>;
  runJob(jobId: string): Promise<{ status: string }>;
}

export class HttpReconciliationClient implements ReconciliationClient {
  constructor(private readonly client: ApiClient = apiClient) {}

  async listJobs(limit = 25, offset = 0): Promise<ReconciliationJobsListResponse> {
    try {
      const response = await this.client.request<unknown>(`/reconciliation/jobs?limit=${limit}&offset=${offset}`);
      const items = extractArray(response, ['data.items', 'items', 'data']).map(mapJob);

      return {
        items,
        warnings: [],
        meta: {
          limit,
          offset,
          filtered: false
        }
      };
    } catch (error: unknown) {
      if (isApiNotFoundError(error)) {
        return {
          items: [],
          warnings: ['reconciliation_list_endpoint_unavailable'],
          meta: { limit, offset, filtered: false }
        };
      }

      throw error;
    }
  }

  async createJob(jobType: ReconciliationJobType): Promise<ReconciliationJob> {
    const response = await this.client.request<unknown>('/reconciliation/jobs', {
      method: 'POST',
      body: { jobType }
    });

    return mapJob(response);
  }

  async getJobDetail(jobId: string): Promise<ReconciliationJobDetail> {
    const response = await this.client.request<unknown>(`/reconciliation/jobs/${encodeURIComponent(jobId)}`);
    const data = selectDataNode(response);

    const job = mapJob(readUnknown(data, ['job']) ?? data);
    const mismatches = extractArray(data, ['mismatches']).map(mapMismatch);
    const mismatchCount = readNumber(data, ['mismatchCount']) ?? mismatches.length;

    return {
      job,
      mismatchCount,
      mismatches
    };
  }

  async runJob(jobId: string): Promise<{ status: string }> {
    const response = await this.client.request<unknown>(`/reconciliation/jobs/${encodeURIComponent(jobId)}/run`, {
      method: 'POST'
    });

    const data = selectDataNode(response);
    return {
      status: readString(data, ['status']) ?? 'ACCEPTED'
    };
  }
}

function mapJob(value: unknown): ReconciliationJob {
  const node = selectDataNode(value);

  return {
    jobId: readString(node, ['jobId']) ?? 'unknown-job',
    jobType: (readString(node, ['jobType']) as ReconciliationJobType | undefined) ?? 'PAYMENT_STATUS_RECON',
    status: readString(node, ['status']) ?? 'PENDING',
    createdAt: readString(node, ['createdAt']) ?? new Date(0).toISOString(),
    startedAt: readString(node, ['startedAt']),
    completedAt: readString(node, ['completedAt']),
    errorMessage: readString(node, ['errorMessage']),
    mismatchCount: readNumber(node, ['mismatchCount'])
  };
}

function mapMismatch(value: unknown): ReconciliationMismatch {
  const node = selectDataNode(value);

  return {
    mismatchId: readString(node, ['mismatchId']) ?? 'unknown-mismatch',
    jobId: readString(node, ['jobId']) ?? 'unknown-job',
    entityType: readString(node, ['entityType']) ?? 'unknown-entity-type',
    entityId: readString(node, ['entityId']) ?? 'unknown-entity-id',
    expectedValue: readString(node, ['expectedValue']) ?? '-',
    actualValue: readString(node, ['actualValue']) ?? '-',
    mismatchType: readString(node, ['mismatchType']) ?? 'DATA_MISMATCH',
    createdAt: readString(node, ['createdAt']) ?? new Date(0).toISOString()
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
