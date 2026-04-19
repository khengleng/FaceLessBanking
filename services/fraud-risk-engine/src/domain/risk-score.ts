export const RISK_TYPES = ['transfer', 'onboarding', 'loan'] as const;

export type RiskType = (typeof RISK_TYPES)[number];

export type RiskScore = {
  scoreId: string;
  riskType: RiskType;
  score: number;
  level: 'low' | 'medium' | 'high';
  reasons: string[];
  evaluatedAt: string;
};

export function isRiskType(value: string): value is RiskType {
  return RISK_TYPES.includes(value as RiskType);
}

export function buildRiskScore(input: {
  scoreId: string;
  riskType: RiskType;
  score: number;
  reasons: string[];
  evaluatedAt: string;
}): RiskScore {
  const level = input.score >= 70 ? 'high' : input.score >= 40 ? 'medium' : 'low';

  return {
    scoreId: input.scoreId,
    riskType: input.riskType,
    score: input.score,
    level,
    reasons: input.reasons,
    evaluatedAt: input.evaluatedAt
  };
}
