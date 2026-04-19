import type { FastifyReply, FastifyRequest } from 'fastify';

import type { FraudRiskEngineApplication } from '../application/fraud-risk-engine.application.js';
import type { CreateRiskAlertRequestDto, RiskScoreRequestDto } from './dtos/risk.dto.js';

type ScoreRiskRequest = FastifyRequest<{ Body: RiskScoreRequestDto }>;
type CreateAlertRequest = FastifyRequest<{ Body: CreateRiskAlertRequestDto }>;
type GetAlertRequest = FastifyRequest<{ Params: { alertId: string } }>;

export function buildFraudRiskEngineController(application: FraudRiskEngineApplication) {
  async function scoreRisk(request: ScoreRiskRequest, reply: FastifyReply): Promise<void> {
    const result = await application.scoreRisk(request.body);

    if (result.kind === 'invalid_payload') {
      reply.code(400).send({ error: 'validation_failed', details: result.errors });
      return;
    }

    reply.code(200).send(result.score);
  }

  async function createAlert(request: CreateAlertRequest, reply: FastifyReply): Promise<void> {
    const result = await application.createAlert(request.body);

    if (result.kind === 'invalid_payload') {
      reply.code(400).send({ error: 'validation_failed', details: result.errors });
      return;
    }

    reply.code(201).send(result.alert);
  }

  async function getAlert(request: GetAlertRequest, reply: FastifyReply): Promise<void> {
    const result = await application.getAlert(request.params.alertId);

    if (result.kind === 'not_found') {
      reply.code(404).send({ error: 'risk_alert_not_found' });
      return;
    }

    reply.code(200).send(result.alert);
  }

  return {
    scoreRisk,
    createAlert,
    getAlert
  };
}
