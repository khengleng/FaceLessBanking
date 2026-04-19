import type { SearchAdapter } from '../domain/dashboard.js';

export class DashboardApplication {
  constructor(private readonly searchAdapter: SearchAdapter) {}

  async getSummary() {
    return this.searchAdapter.getSummaryMetrics();
  }

  async getPayments(filters: { status?: string; customerId?: string; limit?: number; offset?: number }) {
    return this.searchAdapter.searchPayments({
      limit: filters.limit ?? 50,
      offset: filters.offset ?? 0,
      status: filters.status,
      customerId: filters.customerId
    });
  }

  async getLoans(filters: { status?: string; limit?: number; offset?: number }) {
    return this.searchAdapter.searchLoans({
      limit: filters.limit ?? 50,
      offset: filters.offset ?? 0,
       status: filters.status
    });
  }

  async getOnboarding(filters: { status?: string; limit?: number; offset?: number }) {
    return this.searchAdapter.searchOnboarding({
      limit: filters.limit ?? 50,
      offset: filters.offset ?? 0,
      status: filters.status
    });
  }

  async getDisputes(filters: { status?: string; limit?: number; offset?: number }) {
    return this.searchAdapter.searchDisputes({
      limit: filters.limit ?? 50,
      offset: filters.offset ?? 0,
      status: filters.status
    });
  }
}
