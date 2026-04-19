import type {
  DownstreamClientConfig,
  DownstreamRequest,
  DownstreamResult,
  DownstreamTransport,
  TransportRequest
} from './downstream-client.types.js';

export class ServiceClient {
  constructor(
    private readonly config: DownstreamClientConfig,
    private readonly transport: DownstreamTransport
  ) {}

  async call(request: DownstreamRequest): Promise<DownstreamResult> {
    const requestUrl = buildDownstreamUrl(this.config.baseUrl, request.path, request.queryString);

    const baseTransportRequest: Omit<TransportRequest, 'attempt'> = {
      method: request.method,
      url: requestUrl,
      body: request.body,
      timeoutMs: this.config.timeoutPolicy.requestTimeoutMs,
      headers: {
        'x-correlation-id': request.correlationId,
        ...(request.headers?.authorization ? { authorization: request.headers.authorization } : {}),
        ...(request.headers?.contentType ? { 'content-type': request.headers.contentType } : {}),
        ...(request.headers?.accept ? { accept: request.headers.accept } : {})
      }
    };

    let lastError: unknown;

    for (let attempt = 1; attempt <= this.config.retryPolicy.maxAttempts; attempt += 1) {
      try {
        const response = await this.transport.execute({
          ...baseTransportRequest,
          attempt
        });

        return {
          statusCode: response.statusCode,
          data: {
            route: request.route,
            service: this.config.serviceName,
            retryMaxAttempts: this.config.retryPolicy.maxAttempts,
            requestTimeoutMs: this.config.timeoutPolicy.requestTimeoutMs,
            ...response.data
          }
        };
      } catch (error: unknown) {
        lastError = error;
      }
    }

    return {
      statusCode: 502,
      data: {
        error: 'downstream_unavailable',
        details: ['Failed to call downstream service after retry attempts'],
        route: request.route,
        service: this.config.serviceName,
        retryMaxAttempts: this.config.retryPolicy.maxAttempts,
        requestTimeoutMs: this.config.timeoutPolicy.requestTimeoutMs,
        reason: normalizeErrorMessage(lastError)
      }
    };
  }
}

function buildDownstreamUrl(baseUrl: string, path: string, queryString?: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (!queryString || queryString.length === 0) {
    return `${normalizedBase}${normalizedPath}`;
  }

  return `${normalizedBase}${normalizedPath}?${queryString}`;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'unknown_downstream_error';
}
