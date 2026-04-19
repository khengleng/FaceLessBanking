import { createHmac } from 'node:crypto';

export type SignatureVerificationResult =
  | { valid: true }
  | { valid: false; reason: string };

export interface SumsubWebhookVerifierAdapter {
  verifySignature(headers: Record<string, string | string[] | undefined>, rawBody: string): SignatureVerificationResult;
}

export class SumsubWebhookVerifierAdapterPlaceholder implements SumsubWebhookVerifierAdapter {
  verifySignature(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): SignatureVerificationResult {
    const signatureHeader = getHeader(headers, 'x-sumsub-signature');
    if (!signatureHeader) {
      return { valid: false, reason: 'missing_signature_header' };
    }

    const secret = process.env.SUMSUB_WEBHOOK_SECRET;
    if (!secret) {
      return { valid: false, reason: 'missing_webhook_secret' };
    }

    const digest = createHmac('sha256', secret).update(rawBody).digest('hex');

    if (digest !== signatureHeader) {
      return { valid: false, reason: 'invalid_signature' };
    }

    return { valid: true };
  }
}

function getHeader(
  headers: Record<string, string | string[] | undefined>,
  key: string
): string | null {
  const header = headers[key] ?? headers[key.toLowerCase()];

  if (Array.isArray(header)) {
    return header[0] ?? null;
  }

  return typeof header === 'string' ? header : null;
}
