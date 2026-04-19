export const RULE_CATEGORIES = [
  'transfer-limit',
  'ekyc-eligibility',
  'loan-eligibility',
  'notification-routing'
] as const;

export type RuleCategory = (typeof RULE_CATEGORIES)[number];

export type RuleDefinition = {
  ruleId: string;
  category: RuleCategory;
  name: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export function isRuleCategory(value: string): value is RuleCategory {
  return RULE_CATEGORIES.includes(value as RuleCategory);
}

export function buildRuleDefinition(input: {
  ruleId: string;
  category: RuleCategory;
  name: string;
  config?: Record<string, unknown>;
  createdAt: string;
}): RuleDefinition {
  return {
    ruleId: input.ruleId,
    category: input.category,
    name: input.name,
    config: input.config ?? {},
    createdAt: input.createdAt,
    updatedAt: input.createdAt
  };
}
