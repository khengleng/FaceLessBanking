import { createHmac } from 'node:crypto';

export type SignatureVerificationResult =
  | { valid: true }
  | { valid: false; reason: string };

export interface SumsubWebhookVerifierAdapter {
  verifySignature(headers: Record<string, string | string[] | undefined>, rawBody: string): SignatureVerificationResult;
}

/**
 * Real Sumsub Signature Verification
 */
export class SumsubWebhookVerifierAdapterReal implements SumsubWebhookVerifierAdapter {
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
      console.warn('SUMSUB_WEBHOOK_SECRET not configured, rejecting all webhooks');
      return { valid: false, reason: 'missing_webhook_secret' };
    }

    const digest = createHmac('sha256', secret).update(rawBody).digest('hex');

    if (digest !== signatureHeader) {
      return { valid: false, reason: 'invalid_signature' };
    }

    return { valid: true };
  }
}

/**
 * Stub implementation for development/testing.
 * Clearly marked as PLACEHOLDER.
 * Uses deterministic verification based on a magic header.
 */
export class SumsubWebhookVerifierAdapterStub implements SumsubWebhookVerifierAdapter {
  verifySignature(
    headers: Record<string, string | string[] | undefined>,
    _rawBody: string
  ): SignatureVerificationResult {
    const stubAuth = getHeader(headers, 'x-ekyc-stub-auth');
    if (stubAuth === 'allow-all-stubs') {
      return { valid: true };
    }
    
    // Default to failing if secret is not set, even in stub mode, unless header is present
    return { valid: false, reason: 'stub_verification_failed_missing_header' };
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
