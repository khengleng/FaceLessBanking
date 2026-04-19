export type SmsProviderRequest = {
  recipient: string;
  message: string;
};

export type ProviderDeliveryResult = {
  providerMessageId: string;
};

export interface SmsProviderAdapter {
  sendSms(request: SmsProviderRequest): Promise<ProviderDeliveryResult>;
}

export class SmsProviderAdapterStub implements SmsProviderAdapter {
  async sendSms(request: SmsProviderRequest): Promise<ProviderDeliveryResult> {
    return { providerMessageId: `sms-${request.recipient}` };
  }
}
