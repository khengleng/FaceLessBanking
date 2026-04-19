import type { RiskType } from './risk-score.js';

export type RiskAlert = {
  alertId: string;
  riskType: RiskType;
  entityId: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'under_review' | 'closed';
  reason: string;
  createdAt: string;
};

export function buildRiskAlert(input: {
  alertId: string;
  riskType: RiskType;
  entityId: string;
  severity: 'low' | 'medium' | 'high';
  reason: string;
  createdAt: string;
}): RiskAlert {
  return {
    alertId: input.alertId,
    riskType: input.riskType,
    entityId: input.entityId,
    severity: input.severity,
    status: 'open',
    reason: input.reason,
    createdAt: input.createdAt
  };
}
