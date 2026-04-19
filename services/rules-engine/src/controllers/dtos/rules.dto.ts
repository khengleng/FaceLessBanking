import type { RuleEvaluation } from '../../domain/rule-evaluation.js';

export type CreateRuleDefinitionRequestDto = {
  category: string;
  name: string;
  config?: Record<string, unknown>;
};

export type EvaluateRuleRequestDto = {
  category: string;
  ruleId?: string;
  facts: Record<string, unknown>;
};

export type RuleDefinitionResponseDto = {
  ruleId: string;
  category: string;
  name: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export function toRuleDefinitionResponseDto(input: {
  ruleId: string;
  category: string;
  name: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}): RuleDefinitionResponseDto {
  return {
    ruleId: input.ruleId,
    category: input.category,
    name: input.name,
    config: input.config,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  };
}

export type RuleEvaluationResponseDto = RuleEvaluation;
