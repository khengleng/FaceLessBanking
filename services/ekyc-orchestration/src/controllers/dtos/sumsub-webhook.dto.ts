export type SumsubWebhookPayloadDto = {
  applicantId?: string;
  inspectionId?: string;
  type?: string;
  reviewStatus?: string;
  reviewResult?: {
    reviewAnswer?: string;
    reviewRejectType?: string;
    moderationComment?: string;
  };
  externalUserId?: string;
  createdAtMs?: number;
};

export type SumsubWebhookRequestDto = {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
  payload: SumsubWebhookPayloadDto;
};
