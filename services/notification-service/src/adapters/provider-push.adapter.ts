export type PushProviderRequest = {
  recipient: string;
  message: string;
};

export type ProviderDeliveryResult = {
  providerMessageId: string;
};

export interface PushProviderAdapter {
  sendPush(request: PushProviderRequest): Promise<ProviderDeliveryResult>;
}

export class PushProviderAdapterStub implements PushProviderAdapter {
  async sendPush(request: PushProviderRequest): Promise<ProviderDeliveryResult> {
    return { providerMessageId: `push-${request.recipient}` };
  }
}
