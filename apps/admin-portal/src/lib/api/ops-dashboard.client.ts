import { apiClient, type ApiClient } from './client';

export type DashboardSnapshot = {
  onboardingPending: number;
  paymentsFailed: number;
  loansInReview: number;
  openDisputes: number;
  reconciliationMismatches: number;
  liquiditySummary: {
    availableLiquidity: number;
    currency: string;
    source: string;
  };
  recentActivity: Array<{
    id: string;
    title: string;
    timestamp: string;
  }>;
  alerts: Array<{
    id: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    timestamp: string;
  }>;
};

export interface OpsDashboardClient {
  loadSnapshot(): Promise<DashboardSnapshot>;
}

export class HttpOpsDashboardClient implements OpsDashboardClient {
  constructor(private readonly client: ApiClient = apiClient) {}

  async loadSnapshot(): Promise<DashboardSnapshot> {
    const [cases, payments, loans, disputes, reconciliation, liquidity, errors, services] =
      await Promise.all([
        this.client.request<unknown>('/cases/onboarding-review?status=IN_REVIEW&limit=1'),
        this.client.request<unknown>('/payments?status=FAILED&limit=1'),
        this.client.request<unknown>('/loans?status=IN_REVIEW&limit=1'),
        this.client.request<unknown>('/support/tickets?status=OPEN&limit=1'),
        this.client.request<unknown>('/reconciliation/jobs?status=MISMATCH&limit=1'),
        this.client.request<unknown>('/liquidity/summary'),
        this.client.request<unknown>('/admin/errors'),
        this.client.request<unknown>('/admin/services')
      ]);

    const alertsFromErrors = extractArray(errors, ['data', 'items', 'errors']).slice(0, 3).map((item, index) => ({
      id: String(readString(item, ['id']) ?? `alert-${index + 1}`),
      severity: mapSeverity(readString(item, ['severity'])),
      message: readString(item, ['message']) ?? 'Operational attention item',
      timestamp: readString(item, ['timestamp']) ?? new Date().toISOString()
    }));

    const activityFromServices = extractArray(services, ['data', 'items', 'services']).slice(0, 5).map((item, index) => ({
      id: String(readString(item, ['service']) ?? `activity-${index + 1}`),
      title: `${readString(item, ['service']) ?? 'Service'} status ${readString(item, ['status']) ?? 'updated'}`,
      timestamp: readString(item, ['updatedAt']) ?? new Date().toISOString()
    }));

    return {
      onboardingPending: extractTotal(cases),
      paymentsFailed: extractTotal(payments),
      loansInReview: extractTotal(loans),
      openDisputes: extractTotal(disputes),
      reconciliationMismatches: extractTotal(reconciliation),
      liquiditySummary: {
        availableLiquidity: readNumber(liquidity, ['data', 'availableLiquidity']) ?? 0,
        currency: readString(liquidity, ['data', 'currency']) ?? 'USD',
        source: 'liquidity.summary.placeholder'
      },
      recentActivity: activityFromServices,
      alerts: alertsFromErrors
    };
  }
}

function extractTotal(value: unknown): number {
  const explicitTotal = readNumber(value, ['meta', 'totalItems'])
    ?? readNumber(value, ['data', 'total'])
    ?? readNumber(value, ['total']);

  if (typeof explicitTotal === 'number') {
    return explicitTotal;
  }

  const list = extractArray(value, ['items', 'data.items', 'data']);
  return list.length;
}

function extractArray(value: unknown, pathHints: string[]): unknown[] {
  for (const hint of pathHints) {
    const segments = hint.split('.');
    const found = readUnknown(value, segments);
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

function readNumber(value: unknown, path: string[]): number | undefined {
  const found = readUnknown(value, path);
  return typeof found === 'number' ? found : undefined;
}

function readString(value: unknown, path: string[]): string | undefined {
  const found = readUnknown(value, path);
  return typeof found === 'string' ? found : undefined;
}

function mapSeverity(value: string | undefined): 'info' | 'warning' | 'critical' {
  if (!value) {
    return 'warning';
  }

  const normalized = value.toLowerCase();
  if (normalized === 'critical' || normalized === 'high') {
    return 'critical';
  }

  if (normalized === 'info' || normalized === 'low') {
    return 'info';
  }

  return 'warning';
}
