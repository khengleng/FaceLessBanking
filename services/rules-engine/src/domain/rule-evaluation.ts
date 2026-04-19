import type { RuleCategory } from './rule-definition.js';

export type RuleDecision = 'allow' | 'deny' | 'review';

export type RuleEvaluation = {
  evaluationId: string;
  ruleId: string;
  category: RuleCategory;
  decision: RuleDecision;
  reason: string;
  evaluatedAt: string;
};

export function buildRuleEvaluation(input: {
  evaluationId: string;
  ruleId: string;
  category: RuleCategory;
  decision: RuleDecision;
  reason: string;
  evaluatedAt: string;
}): RuleEvaluation {
  return {
    evaluationId: input.evaluationId,
    ruleId: input.ruleId,
    category: input.category,
    decision: input.decision,
    reason: input.reason,
    evaluatedAt: input.evaluatedAt
  };
}
