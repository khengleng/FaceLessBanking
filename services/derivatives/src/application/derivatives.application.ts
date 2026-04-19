import crypto from 'node:crypto';

import { buildEventEnvelope } from '@faceless-banking/shared-events';

import type { DerivativesEventAdapter, DerivativesPostgresAdapter } from '../adapters/derivatives.adapters.js';
import {
  shouldSettleAtMaturity,
  type CreateFXForwardInput,
  type FXForward
} from '../domain/fx-forward.js';

type Logger = {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
};

export class DerivativesApplication {
  constructor(
    private readonly postgres: DerivativesPostgresAdapter,
    private readonly events: DerivativesEventAdapter,
    private readonly logger: Logger
  ) {}

  async createFXForward(input: {
    request: CreateFXForwardInput;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<FXForward> {
    const existing = await this.postgres.getIdempotencyResult('fx-forward-create', input.idempotencyKey);
    if (existing) {
      const contract = await this.postgres.getFXForwardById(existing.contractId);
      if (contract) {
        this.logger.info({ contractId: contract.contractId }, 'Returning idempotent fx-forward create result');
        return contract;
      }
    }

    const contract = await this.postgres.createFXForward(input.request);
    await this.postgres.setIdempotencyResult('fx-forward-create', input.idempotencyKey, { contractId: contract.contractId });

    await this.events.publish(
      buildEventEnvelope({
        type: 'fx.forward.created.v1',
        version: 1,
        metadata: {
          eventId: crypto.randomUUID(),
          correlationId: input.correlationId,
          causationId: input.idempotencyKey,
          timestamp: new Date().toISOString(),
          producer: 'derivatives'
        },
        payload: {
          contractId: contract.contractId,
          baseCurrency: contract.baseCurrency,
          quoteCurrency: contract.quoteCurrency,
          notional: contract.notional,
          forwardRate: contract.forwardRate,
          maturityDate: contract.maturityDate,
          status: contract.status
        }
      })
    );

    return contract;
  }

  async getFXForwardById(contractId: string, nowIso = new Date().toISOString()): Promise<FXForward | null> {
    const contract = await this.postgres.getFXForwardById(contractId);
    if (!contract) {
      return null;
    }

    if (!shouldSettleAtMaturity(contract, nowIso)) {
      return contract;
    }

    const settled = await this.postgres.updateFXForwardStatus(contract.contractId, 'SETTLED');

    await this.events.publish(
      buildEventEnvelope({
        type: 'fx.forward.settled.v1',
        version: 1,
        metadata: {
          eventId: crypto.randomUUID(),
          correlationId: `fx-forward-${settled.contractId}`,
          causationId: settled.contractId,
          timestamp: new Date().toISOString(),
          producer: 'derivatives'
        },
        payload: {
          contractId: settled.contractId,
          status: settled.status,
          maturityDate: settled.maturityDate
        }
      })
    );

    return settled;
  }
}
