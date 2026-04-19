export type AmlRequest = {
  customerId: string;
  countryCode: string;
};

export type AmlResult = {
  status: 'clear';
};

export interface AmlProviderAdapter {
  screenCustomer(request: AmlRequest): Promise<AmlResult>;
}

export class AmlProviderAdapterStub implements AmlProviderAdapter {
  async screenCustomer(request: AmlRequest): Promise<AmlResult> {
    void request;
    return { status: 'clear' };
  }
}
