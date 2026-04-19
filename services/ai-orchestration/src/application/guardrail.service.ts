import { defaultPromptPolicy, type PromptPolicy } from '../domain/ai-request.js';

export type GuardrailResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export class GuardrailService {
  constructor(private readonly policy: PromptPolicy = defaultPromptPolicy) {}

  evaluate(input: string): GuardrailResult {
    if (!input || input.trim().length === 0) {
      return { allowed: false, reason: 'input_required' };
    }

    if (input.length > this.policy.maxInputLength) {
      return { allowed: false, reason: 'input_too_long' };
    }

    const normalized = input.toLowerCase();
    for (const keyword of this.policy.blockedKeywords) {
      if (normalized.includes(keyword)) {
        return { allowed: false, reason: 'blocked_unsafe_request' };
      }
    }

    return { allowed: true };
  }
}
