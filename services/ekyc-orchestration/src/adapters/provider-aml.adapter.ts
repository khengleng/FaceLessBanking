export type AmlRequest = {
  customerId: string;
  countryCode: string;
};

export type AmlResult = {
  status: 'clear' | 'flagged';
};

export interface AmlProviderAdapter {
  screenCustomer(request: AmlRequest): Promise<AmlResult>;
}

/**
 * DETERMINISTIC STUB for AML screening.
 * Marked as PLACEHOLDER.
 * Logic: flags if countryCode is 'XX', else clear.
 */
export class AmlProviderAdapterStub implements AmlProviderAdapter {
  async screenCustomer(request: AmlRequest): Promise<AmlResult> {
    if (request.countryCode === 'XX') {
      return { status: 'flagged' };
    }
    return { status: 'clear' };
  }
}
