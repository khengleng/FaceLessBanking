export type EmailProviderRequest = {
  recipient: string;
  message: string;
};

export type ProviderDeliveryResult = {
  providerMessageId: string;
};

export interface EmailProviderAdapter {
  sendEmail(request: EmailProviderRequest): Promise<ProviderDeliveryResult>;
}

export class EmailProviderAdapterStub implements EmailProviderAdapter {
  async sendEmail(request: EmailProviderRequest): Promise<ProviderDeliveryResult> {
    return { providerMessageId: `email-${request.recipient}` };
  }
}
