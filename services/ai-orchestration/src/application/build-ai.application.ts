import { AuditLogAdapter } from '../adapters/audit-log.adapter.js';
import { OpenAiAdapterStub } from '../adapters/openai.adapter.js';

import { AiApplication } from './ai.application.js';
import { GuardrailService } from './guardrail.service.js';

export function buildAiApplication(): AiApplication {
  const guardrailService = new GuardrailService();
  const openAiAdapter = new OpenAiAdapterStub();
  const auditLogAdapter = new AuditLogAdapter();

  return new AiApplication(guardrailService, openAiAdapter, auditLogAdapter);
}
