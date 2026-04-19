import type { GatewayRoute } from '../application/gateway.application.js';

export type DownstreamServiceName =
  | 'customer-service'
  | 'account-service'
  | 'loan-orchestration'
  | 'payment-orchestration'
  | 'ekyc-orchestration'
  | 'support-crm-service';

export type DownstreamRequest = {
  route: GatewayRoute;
  method: string;
  path: string;
  queryString?: string;
  body?: unknown;
  correlationId: string;
  headers?: {
    authorization?: string;
    contentType?: string;
    accept?: string;
  };
};

export type DownstreamResult = {
  statusCode: number;
  data: Record<string, unknown>;
};

export type RetryPolicy = {
  maxAttempts: number;
};

export type TimeoutPolicy = {
  requestTimeoutMs: number;
};

export type DownstreamClientConfig = {
  serviceName: DownstreamServiceName;
  baseUrl: string;
  retryPolicy: RetryPolicy;
  timeoutPolicy: TimeoutPolicy;
};

export type TransportRequest = {
  method: string;
  url: string;
  body?: unknown;
  headers: Record<string, string>;
  timeoutMs: number;
  attempt: number;
};

export type TransportResponse = {
  statusCode: number;
  data: Record<string, unknown>;
};

export interface DownstreamTransport {
  execute(request: TransportRequest): Promise<TransportResponse>;
}
