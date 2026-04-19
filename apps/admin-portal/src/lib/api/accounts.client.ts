import { apiClient, type ApiClient } from './client';

export type AccountStatus = 'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | string;

export type AccountListItem = {
  accountId: string;
  customerId: string;
  productCode: string;
  currency: string;
  status: AccountStatus;
  createdAt: string;
};

export type AccountBalanceSnapshot = {
  accountId: string;
  availableBalanceCents: number;
  ledgerBalanceCents: number;
  currency: string;
  source: 'account-service' | 'balance-service' | 'placeholder';
};

export type AccountDetailBundle = {
  account: AccountListItem;
  accountType: string;
  activationState: 'ACTIVE' | 'PENDING_ACTIVATION' | 'INACTIVE';
  balanceSnapshot: AccountBalanceSnapshot | null;
  warnings: string[];
};

export type AccountFilters = {
  status?: string;
  accountType?: string;
  customerId?: string;
  limit?: number;
  offset?: number;
};

export type AccountListResponse = {
  items: AccountListItem[];
  meta: {
    limit: number;
    offset: number;
    filtered: boolean;
  };
};

export interface AccountsClient {
  listAccounts(filters: AccountFilters): Promise<AccountListResponse>;
  getAccountDetail(accountId: string): Promise<AccountDetailBundle>;
}

export class HttpAccountsClient implements AccountsClient {
  constructor(private readonly client: ApiClient = apiClient) {}

  async listAccounts(filters: AccountFilters): Promise<AccountListResponse> {
    const params = new URLSearchParams();

    if (filters.customerId) {
      params.set('customerId', filters.customerId);
    }

    params.set('limit', String(filters.limit ?? 25));
    params.set('offset', String(filters.offset ?? 0));

    const response = await this.client.request<unknown>(`/accounts?${params.toString()}`);
    let items = extractArray(response, ['data.items', 'items', 'data']).map(mapAccount);

    if (filters.status && filters.status !== 'ALL') {
      items = items.filter((item) => item.status === filters.status);
    }

    if (filters.accountType && filters.accountType !== 'ALL') {
      items = items.filter((item) => toAccountType(item.productCode) === filters.accountType);
    }

    return {
      items,
      meta: {
        limit: readNumber(response, ['meta', 'limit']) ?? filters.limit ?? 25,
        offset: readNumber(response, ['meta', 'offset']) ?? filters.offset ?? 0,
        filtered: Boolean(filters.status || filters.accountType || filters.customerId)
      }
    };
  }

  async getAccountDetail(accountId: string): Promise<AccountDetailBundle> {
    const warnings: string[] = [];
    const accountResponse = await this.client.request<unknown>(`/accounts/${encodeURIComponent(accountId)}`);
    const account = mapAccount(selectDataNode(accountResponse));

    const balance = await this.resolveBalance(account.accountId, warnings);

    return {
      account,
      accountType: toAccountType(account.productCode),
      activationState: toActivationState(account.status),
      balanceSnapshot: balance,
      warnings
    };
  }

  private async resolveBalance(accountId: string, warnings: string[]): Promise<AccountBalanceSnapshot | null> {
    try {
      const accountBalanceResponse = await this.client.request<unknown>(`/accounts/${encodeURIComponent(accountId)}/balance`);
      return mapBalance(selectDataNode(accountBalanceResponse), 'account-service');
    } catch (error: unknown) {
      if (!isNotFound(error)) {
        warnings.push('account_balance_lookup_failed');
      }
    }

    try {
      const balanceServiceResponse = await this.client.request<unknown>(`/balances/${encodeURIComponent(accountId)}`);
      return mapBalance(selectDataNode(balanceServiceResponse), 'balance-service');
    } catch (error: unknown) {
      if (!isNotFound(error)) {
        warnings.push('balance_projection_lookup_failed');
      }
    }

    return null;
  }
}

export function toAccountType(productCode: string): string {
  const normalized = productCode.toUpperCase();

  if (normalized === 'SV') {
    return 'SAVINGS';
  }

  if (normalized === 'CR') {
    return 'CURRENT';
  }

  return normalized;
}

function toActivationState(status: string): 'ACTIVE' | 'PENDING_ACTIVATION' | 'INACTIVE' {
  if (status === 'ACTIVE') {
    return 'ACTIVE';
  }

  if (status === 'PENDING_ACTIVATION') {
    return 'PENDING_ACTIVATION';
  }

  return 'INACTIVE';
}

function mapAccount(value: unknown): AccountListItem {
  const node = selectDataNode(value);

  return {
    accountId: readString(node, ['accountId']) ?? 'unknown-account',
    customerId: readString(node, ['customerId']) ?? 'unknown-customer',
    productCode: readString(node, ['productCode']) ?? 'N/A',
    currency: readString(node, ['currency']) ?? 'USD',
    status: readString(node, ['status']) ?? 'UNKNOWN',
    createdAt: readString(node, ['createdAt']) ?? new Date(0).toISOString()
  };
}

function mapBalance(value: unknown, source: AccountBalanceSnapshot['source']): AccountBalanceSnapshot {
  const node = selectDataNode(value);

  return {
    accountId: readString(node, ['accountId']) ?? 'unknown-account',
    availableBalanceCents:
      readNumber(node, ['availableBalanceCents'])
      ?? readNumber(node, ['availableBalance'])
      ?? 0,
    ledgerBalanceCents:
      readNumber(node, ['ledgerBalanceCents'])
      ?? readNumber(node, ['ledgerBalance'])
      ?? 0,
    currency: readString(node, ['currency']) ?? 'USD',
    source
  };
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && error.message.includes('api_request_failed:404');
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
