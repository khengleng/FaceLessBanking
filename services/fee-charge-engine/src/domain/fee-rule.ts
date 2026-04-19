export type FeeRuleType = 'FIXED' | 'PERCENTAGE';
export type FeeRuleStatus = 'ACTIVE' | 'INACTIVE';

export interface FeeRule {
  ruleId: string;
  ruleType: FeeRuleType;
  triggerEventType: string;
  fixedAmountCents?: number;
  percentage?: number; // e.g., 0.01 for 1%
  currency: string;
  status: FeeRuleStatus;
  createdAt: string;
}

export function calculateFeeCents(rule: FeeRule, amountCents: number): number {
  if (rule.ruleType === 'FIXED') {
    return rule.fixedAmountCents ?? 0;
  }
  
  if (rule.ruleType === 'PERCENTAGE') {
    const rate = rule.percentage ?? 0;
    return Math.round(amountCents * rate);
  }

  return 0;
}
