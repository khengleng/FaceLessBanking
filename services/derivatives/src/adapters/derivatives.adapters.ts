import crypto from 'node:crypto';

import type { EventEnvelope } from '@faceless-banking/shared-events';

import type { CreateFXForwardInput, FXForward, FXForwardStatus } from '../domain/fx-forward.js';

export interface DerivativesPostgresAdapter {
  createFXForward(input: CreateFXForwardInput): Promise<FXForward>;
  getFXForwardById(contractId: string): Promise<FXForward | null>;
  updateFXForwardStatus(contractId: string, status: FXForwardStatus): Promise<FXForward>;
  getIdempotencyResult(scope: string, idempotencyKey: string): Promise<{ contractId: string } | null>;
  setIdempotencyResult(scope: string, idempotencyKey: string, result: { contractId: string }): Promise<void>;
}

export interface DerivativesEventAdapter {
  publish(event: EventEnvelope<string, Record<string, unknown>>): Promise<void>;
}

export class InMemoryDerivativesPostgresAdapter implements DerivativesPostgresAdapter {
  private readonly contracts = new Map<string, FXForward>();

  private readonly idempotency = new Map<string, { contractId: string }>();

  async createFXForward(input: CreateFXForwardInput): Promise<FXForward> {
    const contract: FXForward = {
      contractId: crypto.randomUUID(),
      baseCurrency: input.baseCurrency,
      quoteCurrency: input.quoteCurrency,
      notional: input.notional,
      forwardRate: input.forwardRate,
      maturityDate: input.maturityDate,
      status: 'OPEN',
      createdAt: new Date().toISOString()
    };

    this.contracts.set(contract.contractId, contract);
    return contract;
  }

  async getFXForwardById(contractId: string): Promise<FXForward | null> {
    return this.contracts.get(contractId) ?? null;
  }

  async updateFXForwardStatus(contractId: string, status: FXForwardStatus): Promise<FXForward> {
    const existing = this.contracts.get(contractId);
    if (!existing) {
      throw new Error('contract_not_found');
    }

    const updated: FXForward = {
      ...existing,
      status
    };

    this.contracts.set(contractId, updated);
    return updated;
  }

  async getIdempotencyResult(scope: string, idempotencyKey: string): Promise<{ contractId: string } | null> {
    return this.idempotency.get(`${scope}:${idempotencyKey}`) ?? null;
  }

  async setIdempotencyResult(scope: string, idempotencyKey: string, result: { contractId: string }): Promise<void> {
    this.idempotency.set(`${scope}:${idempotencyKey}`, result);
  }
}

export class InMemoryDerivativesEventAdapter implements DerivativesEventAdapter {
  readonly events: EventEnvelope<string, Record<string, unknown>>[] = [];

  async publish(event: EventEnvelope<string, Record<string, unknown>>): Promise<void> {
    this.events.push(event);
  }
}
