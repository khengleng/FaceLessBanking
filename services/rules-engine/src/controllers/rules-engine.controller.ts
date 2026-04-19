import type { FastifyReply, FastifyRequest } from 'fastify';

import type { RulesEngineApplication } from '../application/rules-engine.application.js';
import type {
  CreateRuleDefinitionRequestDto,
  EvaluateRuleRequestDto
} from './dtos/rules.dto.js';
import {
  toRuleDefinitionResponseDto,
  type RuleEvaluationResponseDto
} from './dtos/rules.dto.js';

type CreateRuleDefinitionRequest = FastifyRequest<{ Body: CreateRuleDefinitionRequestDto }>;
type EvaluateRuleRequest = FastifyRequest<{ Body: EvaluateRuleRequestDto }>;
type GetRuleDefinitionRequest = FastifyRequest<{ Params: { ruleId: string } }>;

export function buildRulesEngineController(rulesEngineApplication: RulesEngineApplication) {
  async function createRuleDefinition(
    request: CreateRuleDefinitionRequest,
    reply: FastifyReply
  ): Promise<void> {
    const result = await rulesEngineApplication.createRuleDefinition(request.body);

    if (result.kind === 'invalid_payload') {
      reply.code(400).send({
        error: 'validation_failed',
        details: result.errors
      });
      return;
    }

    reply.code(201).send(toRuleDefinitionResponseDto(result.definition));
  }

  async function getRuleDefinition(
    request: GetRuleDefinitionRequest,
    reply: FastifyReply
  ): Promise<void> {
    const result = await rulesEngineApplication.getRuleDefinition(request.params.ruleId);

    if (result.kind === 'not_found') {
      reply.code(404).send({ error: 'rule_definition_not_found' });
      return;
    }

    reply.code(200).send(toRuleDefinitionResponseDto(result.definition));
  }

  async function evaluateRule(request: EvaluateRuleRequest, reply: FastifyReply): Promise<void> {
    const result = await rulesEngineApplication.evaluateRule(request.body);

    if (result.kind === 'invalid_payload') {
      reply.code(400).send({
        error: 'validation_failed',
        details: result.errors
      });
      return;
    }

    if (result.kind === 'rule_not_found') {
      reply.code(404).send({ error: 'rule_definition_not_found' });
      return;
    }

    const response: RuleEvaluationResponseDto = result.evaluation;
    reply.code(200).send(response);
  }

  return {
    createRuleDefinition,
    getRuleDefinition,
    evaluateRule
  };
}
