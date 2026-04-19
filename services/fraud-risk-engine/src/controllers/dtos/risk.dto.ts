import type { RiskAlert } from '../../domain/risk-alert.js';
import type { RiskScore } from '../../domain/risk-score.js';

export type RiskScoreRequestDto = {
  riskType: string;
  context: Record<string, unknown>;
};

export type CreateRiskAlertRequestDto = {
  riskType: string;
  entityId: string;
  severity: 'low' | 'medium' | 'high';
  reason: string;
};

export type RiskScoreResponseDto = RiskScore;
export type RiskAlertResponseDto = RiskAlert;
