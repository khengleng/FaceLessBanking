import type { Customer360SourcesAdapter } from '../adapters/customer-360-sources.adapter.js';
import { buildEmptyCustomer360, type Customer360View } from '../domain/customer-360.js';
import type { Customer360EventsAdapter } from '../events/customer-360-events.adapter.js';

export type GetCustomer360Result =
  | { kind: 'ok'; customer360: Customer360View }
  | { kind: 'invalid'; errors: string[] };

export class Customer360Application {
  constructor(
    private readonly sources: Customer360SourcesAdapter,
    private readonly events: Customer360EventsAdapter
  ) {}

  async getCustomer360(customerId: string): Promise<GetCustomer360Result> {
    const errors = validateCustomerId(customerId);
    if (errors.length > 0) {
      return { kind: 'invalid', errors };
    }

    const [profile, onboardingStatus, accounts, loans, transactions, profitability] = await Promise.all([
      this.sources.getProfileByCustomerId(customerId),
      this.sources.getOnboardingStatusByCustomerId(customerId),
      this.sources.getAccountsByCustomerId(customerId),
      this.sources.getLoansByCustomerId(customerId),
      this.sources.getTransactionsByCustomerId(customerId),
      this.sources.getProfitabilityByCustomerId(customerId)
    ]);

    const view = buildEmptyCustomer360(customerId);
    view.profile = profile ?? view.profile;
    view.onboardingStatus = onboardingStatus ?? view.onboardingStatus;
    view.accounts = accounts;
    view.loans = loans;
    view.transactions = transactions;
    view.profitability = profitability ?? view.profitability;

    await this.events.emitCustomer360Viewed(view);

    return {
      kind: 'ok',
      customer360: view
    };
  }
}

function validateCustomerId(customerId: string): string[] {
  const errors: string[] = [];

  if (!customerId || customerId.trim().length < 3) {
    errors.push('customerId must contain at least 3 characters');
  }

  return errors;
}
