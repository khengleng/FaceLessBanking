import type { AuditLogAdapter } from '../adapters/audit-log.adapter.js';
import type { OpenAiAdapter } from '../adapters/openai.adapter.js';
import type {
  ClassifyRequestDto,
  ChatRequestDto,
  SummarizeRequestDto
} from '../controllers/dtos/ai.dto.js';
import type { AiAction } from '../domain/ai-request.js';
import type { GuardrailService } from './guardrail.service.js';

export type AiRequestResult =
  | { kind: 'ok'; output: string; model: string }
  | { kind: 'invalid_payload'; errors: string[] }
  | { kind: 'blocked'; reason: string };

export class AiApplication {
  constructor(
    private readonly guardrailService: GuardrailService,
    private readonly openAiAdapter: OpenAiAdapter,
    private readonly auditLogAdapter: AuditLogAdapter
  ) {}

  async chat(payload: ChatRequestDto): Promise<AiRequestResult> {
    const errors = validateChatPayload(payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    return this.processGuardedRequest('chat', payload.message, async () => {
      const output = await this.openAiAdapter.chat({
        message: payload.message,
        context: payload.context
      });

      return { output, model: 'openai-stub-v1' };
    });
  }

  async summarize(payload: SummarizeRequestDto): Promise<AiRequestResult> {
    const errors = validateSummarizePayload(payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    return this.processGuardedRequest('summarize', payload.text, async () => {
      const output = await this.openAiAdapter.summarize({ text: payload.text });

      return { output, model: 'openai-stub-v1' };
    });
  }

  async classify(payload: ClassifyRequestDto): Promise<AiRequestResult> {
    const errors = validateClassifyPayload(payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    return this.processGuardedRequest('classify', payload.text, async () => {
      const output = await this.openAiAdapter.classify({
        text: payload.text,
        labels: payload.labels
      });

      return { output, model: 'openai-stub-v1' };
    });
  }

  private async processGuardedRequest(
    action: AiAction,
    input: string,
    handler: () => Promise<{ output: string; model: string }>
  ): Promise<AiRequestResult> {
    const guardrail = this.guardrailService.evaluate(input);

    if (!guardrail.allowed) {
      await this.auditLogAdapter.append({
        action,
        status: 'blocked',
        inputLength: input.length,
        timestamp: new Date().toISOString()
      });

      return { kind: 'blocked', reason: guardrail.reason };
    }

    const response = await handler();

    await this.auditLogAdapter.append({
      action,
      status: 'allowed',
      inputLength: input.length,
      timestamp: new Date().toISOString()
    });

    return { kind: 'ok', output: response.output, model: response.model };
  }
}

function validateChatPayload(payload: ChatRequestDto): string[] {
  const errors: string[] = [];

  if (!payload.message || payload.message.trim().length < 2) {
    errors.push('message must contain at least 2 characters');
  }

  return errors;
}

function validateSummarizePayload(payload: SummarizeRequestDto): string[] {
  const errors: string[] = [];

  if (!payload.text || payload.text.trim().length < 5) {
    errors.push('text must contain at least 5 characters');
  }

  return errors;
}

function validateClassifyPayload(payload: ClassifyRequestDto): string[] {
  const errors: string[] = [];

  if (!payload.text || payload.text.trim().length < 3) {
    errors.push('text must contain at least 3 characters');
  }

  if (!Array.isArray(payload.labels) || payload.labels.length === 0) {
    errors.push('labels must include at least one label');
  }

  return errors;
}
