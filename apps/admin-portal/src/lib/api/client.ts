export type ApiClientConfig = {
  baseUrl: string;
  timeoutMs: number;
};

export type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
};

export class ApiClient {
  constructor(private readonly config: ApiClientConfig) {}

  async request<TResponse>(path: string, options: ApiRequestOptions = {}): Promise<TResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          'content-type': 'application/json',
          ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`api_request_failed:${response.status}`);
      }

      return (await response.json()) as TResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const apiClient = new ApiClient({
  baseUrl: (import.meta as any).env?.VITE_API_URL || '/api',
  timeoutMs: 8000
});

