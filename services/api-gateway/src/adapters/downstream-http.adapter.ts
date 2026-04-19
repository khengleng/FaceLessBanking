import type {
  DownstreamTransport,
  TransportRequest,
  TransportResponse
} from './downstream-client.types.js';

export class PlaceholderDownstreamTransport implements DownstreamTransport {
  async execute(request: TransportRequest): Promise<TransportResponse> {
    return {
      statusCode: 501,
      data: {
        message: 'Gateway route placeholder',
        todo: 'Implement real downstream HTTP integration',
        forwardedCorrelationId: request.headers['x-correlation-id'],
        requestTimeoutMs: request.timeoutMs,
        attempt: request.attempt,
        targetUrl: request.url,
        method: request.method
      }
    };
  }
}
