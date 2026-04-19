import { apiClient, type ApiClient } from './client';

export type CustomerListItem = {
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  createdAt: string;
};

export type CustomerProfile = {
  customerId: string;
  displayName?: string;
  onboardingReference?: string;
  verificationStatus: string;
  riskLevel: string;
  countryCode?: string;
  contactStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type AccountListItem = {
  accountId: string;
  customerId: string;
  productCode: string;
  currency: string;
  status: string;
  createdAt: string;
};

export type LoanListItem = {
  loanId: string;
  customerId?: string;
  status: string;
  principalAmountCents?: number;
  currency?: string;
  createdAt?: string;
};

export type CustomerProfitability = {
  entityId: string;
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  currency: string;
};

export type CustomerFilters = {
  customerId?: string;
  onboardingReference?: string;
  limit?: number;
  offset?: number;
};

export type CustomerListResponse = {
  items: CustomerListItem[];
  meta: {
    limit: number;
    offset: number;
    filtered: boolean;
  };
};

export type Customer360Bundle = {
  customer: CustomerListItem;
  profile: CustomerProfile | null;
  accounts: AccountListItem[];
  loans: LoanListItem[];
  profitability: CustomerProfitability | null;
  warnings: string[];
};

export interface CustomersClient {
  listCustomers(filters: CustomerFilters): Promise<CustomerListResponse>;
  getCustomer360Bundle(customerId: string): Promise<Customer360Bundle>;
}

export class HttpCustomersClient implements CustomersClient {
  constructor(private readonly client: ApiClient = apiClient) {}

  async listCustomers(filters: CustomerFilters): Promise<CustomerListResponse> {
    const params = new URLSearchParams();

    if (filters.customerId) {
      params.set('customerId', filters.customerId);
    }

    if (filters.onboardingReference) {
      params.set('onboardingReference', filters.onboardingReference);
    }

    params.set('limit', String(filters.limit ?? 25));
    params.set('offset', String(filters.offset ?? 0));

    const response = await this.client.request<unknown>(`/customers?${params.toString()}`);
    const items = extractArray(response, ['data.items', 'items', 'data']).map(toCustomer);

    return {
      items,
      meta: {
        limit: readNumber(response, ['meta', 'limit']) ?? filters.limit ?? 25,
        offset: readNumber(response, ['meta', 'offset']) ?? filters.offset ?? 0,
        filtered: readBoolean(response, ['meta', 'filtered'])
          ?? Boolean(filters.customerId || filters.onboardingReference)
      }
    };
  }

  async getCustomer360Bundle(customerId: string): Promise<Customer360Bundle> {
    const warnings: string[] = [];

    const customer = await this.client.request<unknown>(`/customers/${customerId}`);

    const [profileResult, accountsResult, loansResult, profitabilityResult] = await Promise.allSettled([
      this.client.request<unknown>(`/customers/${customerId}/profile`),
      this.client.request<unknown>(`/accounts?customerId=${encodeURIComponent(customerId)}&limit=25&offset=0`),
      this.client.request<unknown>(`/loans?customerId=${encodeURIComponent(customerId)}&limit=25&offset=0`),
      this.client.request<unknown>(`/profitability/customers/${encodeURIComponent(customerId)}`)
    ]);

    let profile: CustomerProfile | null = null;
    if (profileResult.status === 'fulfilled') {
      profile = toProfile(selectDataNode(profileResult.value));
    } else if (!isNotFoundError(profileResult.reason)) {
      warnings.push('customer_profile_unavailable');
    }

    const accounts =
      accountsResult.status === 'fulfilled'
        ? extractArray(accountsResult.value, ['data.items', 'items', 'data']).map(toAccount)
        : [];
    if (accountsResult.status === 'rejected') {
      warnings.push('customer_accounts_unavailable');
    }

    const loans =
      loansResult.status === 'fulfilled'
        ? extractArray(loansResult.value, ['data.items', 'items', 'data']).map(toLoan)
        : [];
    if (loansResult.status === 'rejected') {
      warnings.push('customer_loans_unavailable');
    }

    let profitability: CustomerProfitability | null = null;
    if (profitabilityResult.status === 'fulfilled') {
      profitability = toProfitability(selectDataNode(profitabilityResult.value));
    } else if (!isNotFoundError(profitabilityResult.reason)) {
      warnings.push('customer_profitability_unavailable');
    }

    return {
      customer: toCustomer(selectDataNode(customer)),
      profile,
      accounts,
      loans,
      profitability,
      warnings
    };
  }
}

function toCustomer(value: unknown): CustomerListItem {
  const node = selectDataNode(value);

  return {
    customerId: readString(node, ['customerId']) ?? 'unknown-customer',
    firstName: readString(node, ['firstName']) ?? '-',
    lastName: readString(node, ['lastName']) ?? '-',
    email: readString(node, ['email']) ?? '-',
    status: readString(node, ['status']) ?? 'UNKNOWN',
    createdAt: readString(node, ['createdAt']) ?? new Date(0).toISOString()
  };
}

function toProfile(value: unknown): CustomerProfile {
  const node = selectDataNode(value);

  return {
    customerId: readString(node, ['customerId']) ?? 'unknown-customer',
    displayName: readString(node, ['displayName']),
    onboardingReference: readString(node, ['onboardingReference']),
    verificationStatus: readString(node, ['verificationStatus']) ?? 'UNVERIFIED',
    riskLevel: readString(node, ['riskLevel']) ?? 'UNKNOWN',
    countryCode: readString(node, ['countryCode']),
    contactStatus: readString(node, ['contactStatus']) ?? 'UNKNOWN',
    createdAt: readString(node, ['createdAt']) ?? new Date(0).toISOString(),
    updatedAt: readString(node, ['updatedAt']) ?? new Date(0).toISOString()
  };
}

function toAccount(value: unknown): AccountListItem {
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

function toLoan(value: unknown): LoanListItem {
  const node = selectDataNode(value);

  return {
    loanId: readString(node, ['loanId']) ?? 'unknown-loan',
    customerId: readString(node, ['customerId']),
    status: readString(node, ['status']) ?? 'UNKNOWN',
    principalAmountCents: readNumber(node, ['principalCents']) ?? readNumber(node, ['principalAmountCents']),
    currency: readString(node, ['currency']),
    createdAt: readString(node, ['createdAt'])
  };
}

function toProfitability(value: unknown): CustomerProfitability {
  const node = selectDataNode(value);

  return {
    entityId: readString(node, ['entityId']) ?? 'unknown-customer',
    totalRevenue: readNumber(node, ['totalRevenue']) ?? 0,
    totalCost: readNumber(node, ['totalCost']) ?? 0,
    netProfit: readNumber(node, ['netProfit']) ?? 0,
    currency: readString(node, ['currency']) ?? 'USD'
  };
}

function selectDataNode(value: unknown): unknown {
  const data = readUnknown(value, ['data']);
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data;
  }

  return value;
}

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes('api_request_failed:404');
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

function readBoolean(value: unknown, path: string[]): boolean | undefined {
  const found = readUnknown(value, path);
  return typeof found === 'boolean' ? found : undefined;
}
