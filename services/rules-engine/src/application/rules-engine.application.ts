import { randomUUID } from 'node:crypto';

import type { PostgresRulesAdapter } from '../adapters/postgres-rules.adapter.js';
import type {
  CreateRuleDefinitionRequestDto,
  EvaluateRuleRequestDto
} from '../controllers/dtos/rules.dto.js';
import {
  buildRuleDefinition,
  isRuleCategory,
  type RuleCategory,
  type RuleDefinition
} from '../domain/rule-definition.js';
import { buildRuleEvaluation, type RuleDecision, type RuleEvaluation } from '../domain/rule-evaluation.js';

export type CreateRuleDefinitionResult =
  | { kind: 'created'; definition: RuleDefinition }
  | { kind: 'invalid_payload'; errors: string[] };

export type GetRuleDefinitionResult =
  | { kind: 'found'; definition: RuleDefinition }
  | { kind: 'not_found' };

export type EvaluateRuleResult =
  | { kind: 'evaluated'; evaluation: RuleEvaluation }
  | { kind: 'invalid_payload'; errors: string[] }
  | { kind: 'rule_not_found' };

export class RulesEngineApplication {
  constructor(private readonly postgresAdapter: PostgresRulesAdapter) {}

  async createRuleDefinition(
    payload: CreateRuleDefinitionRequestDto
  ): Promise<CreateRuleDefinitionResult> {
    const errors = validateCreateDefinitionPayload(payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    const category = payload.category as RuleCategory;
    const now = new Date().toISOString();

    const definition = buildRuleDefinition({
      ruleId: randomUUID(),
      category,
      name: payload.name,
      config: payload.config,
      createdAt: now
    });

    await this.postgresAdapter.insertRuleDefinition(definition);

    return { kind: 'created', definition };
  }

  async getRuleDefinition(ruleId: string): Promise<GetRuleDefinitionResult> {
    const definition = await this.postgresAdapter.findRuleDefinitionById(ruleId);
    if (!definition) {
      return { kind: 'not_found' };
    }

    return { kind: 'found', definition };
  }

  async evaluateRule(payload: EvaluateRuleRequestDto): Promise<EvaluateRuleResult> {
    const errors = validateEvaluatePayload(payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    const category = payload.category as RuleCategory;

    const definition = payload.ruleId
      ? await this.postgresAdapter.findRuleDefinitionById(payload.ruleId)
      : await this.postgresAdapter.findLatestRuleDefinitionByCategory(category);

    if (!definition || definition.category !== category) {
      return { kind: 'rule_not_found' };
    }

    const evaluationResult = evaluatePlaceholder(definition.category, definition.config, payload.facts);

    const evaluation = buildRuleEvaluation({
      evaluationId: randomUUID(),
      ruleId: definition.ruleId,
      category: definition.category,
      decision: evaluationResult.decision,
      reason: evaluationResult.reason,
      evaluatedAt: new Date().toISOString()
    });

    return { kind: 'evaluated', evaluation };
  }
}

function validateCreateDefinitionPayload(payload: CreateRuleDefinitionRequestDto): string[] {
  const errors: string[] = [];

  if (!payload.category || !isRuleCategory(payload.category)) {
    errors.push('category must be one of transfer-limit, ekyc-eligibility, loan-eligibility, notification-routing');
  }

  if (!payload.name || payload.name.trim().length < 3) {
    errors.push('name must contain at least 3 characters');
  }

  if (payload.config !== undefined && typeof payload.config !== 'object') {
    errors.push('config must be an object when provided');
  }

  return errors;
}

function validateEvaluatePayload(payload: EvaluateRuleRequestDto): string[] {
  const errors: string[] = [];

  if (!payload.category || !isRuleCategory(payload.category)) {
    errors.push('category must be one of transfer-limit, ekyc-eligibility, loan-eligibility, notification-routing');
  }

  if (!payload.facts || typeof payload.facts !== 'object' || Array.isArray(payload.facts)) {
    errors.push('facts must be an object');
  }

  return errors;
}

function evaluatePlaceholder(
  category: RuleCategory,
  config: Record<string, unknown>,
  facts: Record<string, unknown>
): { decision: RuleDecision; reason: string } {
  if (category === 'transfer-limit') {
    const limit = typeof config.limit === 'number' ? config.limit : 1000;
    const amount = typeof facts.amount === 'number' ? facts.amount : 0;

    if (amount <= limit) {
      return { decision: 'allow', reason: 'within_transfer_limit' };
    }

    return { decision: 'deny', reason: 'exceeds_transfer_limit' };
  }

  if (category === 'ekyc-eligibility') {
    if (facts.ekycStatus === 'verified') {
      return { decision: 'allow', reason: 'ekyc_verified' };
    }

    return { decision: 'review', reason: 'ekyc_pending_or_missing' };
  }

  if (category === 'loan-eligibility') {
    const minCreditScore = typeof config.minCreditScore === 'number' ? config.minCreditScore : 650;
    const creditScore = typeof facts.creditScore === 'number' ? facts.creditScore : 0;

    if (creditScore >= minCreditScore) {
      return { decision: 'allow', reason: 'credit_score_passed' };
    }

    return { decision: 'deny', reason: 'credit_score_below_threshold' };
  }

  const preferredChannel =
    typeof facts.preferredChannel === 'string' ? facts.preferredChannel.trim().toLowerCase() : '';

  if (preferredChannel.length > 0) {
    return { decision: 'allow', reason: `route_to_${preferredChannel}` };
  }

  return { decision: 'review', reason: 'no_routing_preference' };
}
