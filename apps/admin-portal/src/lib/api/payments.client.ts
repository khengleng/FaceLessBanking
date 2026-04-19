import { apiClient, type ApiClient } from './client';

export type PaymentStatus =
  | 'ACCEPTED'
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REJECTED'
  | string;

export type PaymentItem = {
  paymentId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
};

export type PaymentTimelineEvent = {
  id: string;
  label: string;
  status: string;
  timestamp: string;
  source: 'payment' | 'audit' | 'search' | 'placeholder';
  details?: string;
};

export type PaymentDetailBundle = {
  payment: PaymentItem;
  timeline: PaymentTimelineEvent[];
  warnings: string[];
};

export type PaymentFilters = {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  accountId?: string;
  correlationId?: string;
  limit?: number;
  offset?: number;
};

export type PaymentListResponse = {
  items: PaymentItem[];
  meta: {
    limit: number;
    offset: number;
    filtered: boolean;
  };
};

export interface PaymentsClient {
  listPayments(filters: PaymentFilters): Promise<PaymentListResponse>;
  getPaymentDetail(paymentId: string): Promise<PaymentDetailBundle>;
}

export class HttpPaymentsClient implements PaymentsClient {
  constructor(private readonly client: ApiClient = apiClient) {}

  async listPayments(filters: PaymentFilters): Promise<PaymentListResponse> {
    const params = new URLSearchParams();

    if (filters.status && filters.status !== 'ALL') {
      params.set('status', filters.status);
    }

    if (filters.accountId) {
      params.set('accountId', filters.accountId);
    }

    if (filters.correlationId) {
      params.set('correlationId', filters.correlationId);
    }

    params.set('limit', String(filters.limit ?? 25));
    params.set('offset', String(filters.offset ?? 0));

    const response = await this.client.request<unknown>(`/payments?${params.toString()}`);
    let items = extractArray(response, ['data.items', 'items', 'data']).map(toPayment);

    if (filters.dateFrom || filters.dateTo) {
      const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : null;
      const dateTo = filters.dateTo ? new Date(filters.dateTo) : null;

      items = items.filter((item) => {
        const createdAt = new Date(item.createdAt);
        if (dateFrom && createdAt < dateFrom) {
          return false;
        }

        if (dateTo) {
          const endOfDay = new Date(dateTo);
          endOfDay.setHours(23, 59, 59, 999);
          if (createdAt > endOfDay) {
            return false;
          }
        }

        return true;
      });
    }

    return {
      items,
      meta: {
        limit: readNumber(response, ['meta', 'limit']) ?? filters.limit ?? 25,
        offset: readNumber(response, ['meta', 'offset']) ?? filters.offset ?? 0,
        filtered: Boolean(filters.status || filters.dateFrom || filters.dateTo || filters.accountId || filters.correlationId)
      }
    };
  }

  async getPaymentDetail(paymentId: string): Promise<PaymentDetailBundle> {
    const warnings: string[] = [];

    const paymentResponse = await this.client.request<unknown>(`/payments/${encodeURIComponent(paymentId)}`);
    const payment = toPayment(selectDataNode(paymentResponse));

    const timeline: PaymentTimelineEvent[] = [
      {
        id: `payment-${payment.paymentId}`,
        label: 'Payment record created',
        status: payment.status,
        timestamp: payment.createdAt,
        source: 'payment',
        details: `Current status: ${payment.status}`
      }
    ];

    const [auditResult, searchResult] = await Promise.allSettled([
      this.client.request<unknown>(`/audit/events?entityType=PAYMENT&entityId=${encodeURIComponent(payment.paymentId)}`),
      this.client.request<unknown>(`/search?paymentId=${encodeURIComponent(payment.paymentId)}&limit=10&offset=0`)
    ]);

    if (auditResult.status === 'fulfilled') {
      const events = extractArray(auditResult.value, ['items', 'data.items', 'data']);
      for (const rawEvent of events) {
        const event = selectDataNode(rawEvent);
        timeline.push({
          id: readString(event, ['auditId']) ?? readString(event, ['eventId']) ?? `audit-${timeline.length + 1}`,
          label: readString(event, ['eventType']) ?? 'audit.event',
          status: readString(event, ['eventType']) ?? 'AUDIT',
          timestamp: readString(event, ['createdAt']) ?? new Date(0).toISOString(),
          source: 'audit',
          details: readString(event, ['sourceEventId'])
        });
      }
    } else {
      warnings.push('audit_timeline_unavailable');
    }

    if (searchResult.status === 'fulfilled') {
      const items = extractArray(searchResult.value, ['data.items', 'items', 'data']);
      for (const rawItem of items) {
        const item = selectDataNode(rawItem);
        timeline.push({
          id: readString(item, ['indexId']) ?? `search-${timeline.length + 1}`,
          label: readString(item, ['entityType']) ?? 'search.record',
          status: readString(item, ['status']) ?? 'INDEXED',
          timestamp: readString(item, ['updatedAt']) ?? new Date(0).toISOString(),
          source: 'search',
          details: readString(item, ['sourceEventId'])
        });
      }
    } else {
      warnings.push('search_timeline_unavailable');
    }

    if (timeline.length === 1) {
      timeline.push({
        id: `placeholder-${payment.paymentId}`,
        label: 'Lifecycle timeline placeholder',
        status: payment.status,
        timestamp: payment.updatedAt,
        source: 'placeholder',
        details: 'Additional lifecycle events will appear once audit/search feeds are connected.'
      });
    }

    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      payment,
      timeline,
      warnings
    };
  }
}

function toPayment(value: unknown): PaymentItem {
  const node = selectDataNode(value);

  return {
    paymentId: readString(node, ['paymentId']) ?? 'unknown-payment',
    sourceAccountId: readString(node, ['sourceAccountId']) ?? 'unknown-source',
    destinationAccountId: readString(node, ['destinationAccountId']) ?? 'unknown-destination',
    amount: readNumber(node, ['amount']) ?? 0,
    currency: readString(node, ['currency']) ?? 'USD',
    status: readString(node, ['status']) ?? 'UNKNOWN',
    correlationId: readString(node, ['correlationId']) ?? 'N/A',
    createdAt: readString(node, ['createdAt']) ?? new Date(0).toISOString(),
    updatedAt: readString(node, ['updatedAt']) ?? new Date(0).toISOString()
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
