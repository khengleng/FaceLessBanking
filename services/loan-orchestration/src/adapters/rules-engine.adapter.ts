export type LoanEligibilityRequest = {
  customerId: string;
  productCode: string;
  principalCents: number;
  currency: string;
  termMonths: number;
};

export type LoanEligibilityResult = {
  eligible: boolean;
  reason: string;
};

export interface RulesEngineAdapter {
  evaluateLoanEligibility(request: LoanEligibilityRequest): Promise<LoanEligibilityResult>;
}

export class RulesEngineAdapterStub implements RulesEngineAdapter {
  async evaluateLoanEligibility(request: LoanEligibilityRequest): Promise<LoanEligibilityResult> {
    if (request.principalCents > 1_000_000) {
      return {
        eligible: false,
        reason: 'principal_exceeds_placeholder_threshold'
      };
    }

    return {
      eligible: true,
      reason: 'eligible_by_placeholder_rules'
    };
  }
}
