import { randomUUID } from 'node:crypto';

import type { PostgresRiskAdapter } from '../adapters/postgres-risk.adapter.js';
import type {
  CreateRiskAlertRequestDto,
  RiskScoreRequestDto
} from '../controllers/dtos/risk.dto.js';
import { buildRiskAlert, type RiskAlert } from '../domain/risk-alert.js';
import { buildRiskScore, isRiskType, type RiskScore, type RiskType } from '../domain/risk-score.js';
import type { RiskEventsPublisher } from '../events/risk.events.js';

export type ScoreRiskResult =
  | { kind: 'scored'; score: RiskScore }
  | { kind: 'invalid_payload'; errors: string[] };

export type CreateAlertResult =
  | { kind: 'created'; alert: RiskAlert }
  | { kind: 'invalid_payload'; errors: string[] };

export type GetAlertResult =
  | { kind: 'found'; alert: RiskAlert }
  | { kind: 'not_found' };

export class FraudRiskEngineApplication {
  constructor(
    private readonly postgresAdapter: PostgresRiskAdapter,
    private readonly eventsPublisher: RiskEventsPublisher
  ) {}

  async scoreRisk(payload: RiskScoreRequestDto): Promise<ScoreRiskResult> {
    const errors = validateScorePayload(payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    const riskType = payload.riskType as RiskType;
    const scoreValue = computeRiskScore(riskType, payload.context);

    const score = buildRiskScore({
      scoreId: randomUUID(),
      riskType,
      score: scoreValue.score,
      reasons: scoreValue.reasons,
      evaluatedAt: new Date().toISOString()
    });

    await this.eventsPublisher.emitRiskScored(score);

    return { kind: 'scored', score };
  }

  async createAlert(payload: CreateRiskAlertRequestDto): Promise<CreateAlertResult> {
    const errors = validateAlertPayload(payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    const alert = buildRiskAlert({
      alertId: randomUUID(),
      riskType: payload.riskType as RiskType,
      entityId: payload.entityId,
      severity: payload.severity,
      reason: payload.reason,
      createdAt: new Date().toISOString()
    });

    await this.postgresAdapter.insertAlert(alert);
    await this.eventsPublisher.emitRiskAlertCreated(alert);

    return { kind: 'created', alert };
  }

  async getAlert(alertId: string): Promise<GetAlertResult> {
    const alert = await this.postgresAdapter.findAlertById(alertId);
    if (!alert) {
      return { kind: 'not_found' };
    }

    return { kind: 'found', alert };
  }
}

function validateScorePayload(payload: RiskScoreRequestDto): string[] {
  const errors: string[] = [];

  if (!payload.riskType || !isRiskType(payload.riskType)) {
    errors.push('riskType must be one of transfer, onboarding, loan');
  }

  if (!payload.context || typeof payload.context !== 'object' || Array.isArray(payload.context)) {
    errors.push('context must be an object');
  }

  return errors;
}

function validateAlertPayload(payload: CreateRiskAlertRequestDto): string[] {
  const errors: string[] = [];

  if (!payload.riskType || !isRiskType(payload.riskType)) {
    errors.push('riskType must be one of transfer, onboarding, loan');
  }

  if (!payload.entityId || payload.entityId.trim().length < 3) {
    errors.push('entityId must contain at least 3 characters');
  }

  if (!payload.severity || !['low', 'medium', 'high'].includes(payload.severity)) {
    errors.push('severity must be one of low, medium, high');
  }

  if (!payload.reason || payload.reason.trim().length < 3) {
    errors.push('reason must contain at least 3 characters');
  }

  return errors;
}

function computeRiskScore(
  riskType: RiskType,
  context: Record<string, unknown>
): { score: number; reasons: string[] } {
  if (riskType === 'transfer') {
    const amount = typeof context.amount === 'number' ? context.amount : 0;
    const highVelocity = context.highVelocity === true;

    if (amount > 5000 || highVelocity) {
      return { score: 78, reasons: ['high_amount_or_velocity_detected'] };
    }

    return { score: 32, reasons: ['transfer_pattern_within_baseline'] };
  }

  if (riskType === 'onboarding') {
    const documentMismatch = context.documentMismatch === true;
    const locationAnomaly = context.locationAnomaly === true;

    if (documentMismatch || locationAnomaly) {
      return { score: 72, reasons: ['onboarding_identity_anomaly_detected'] };
    }

    return { score: 28, reasons: ['onboarding_signals_normal'] };
  }

  const debtToIncome = typeof context.debtToIncome === 'number' ? context.debtToIncome : 0;
  const recentDelinquency = context.recentDelinquency === true;

  if (debtToIncome > 0.5 || recentDelinquency) {
    return { score: 69, reasons: ['loan_repayment_risk_signals_detected'] };
  }

  return { score: 35, reasons: ['loan_profile_within_policy_placeholder'] };
}
