import { z } from 'zod';

import type { BalanceProjectionEvent } from '../../domain/balance-projection-event.js';
import type { BalanceSnapshot } from '../../domain/balance.js';

export const AccountIdSchema = z.string().min(3, 'accountId must contain at least 3 characters');

export const ApplyProjectionEventSchema = z.object({
  eventId: z.string().min(1, 'eventId is required'),
  accountId: AccountIdSchema,
  deltaAmount: z.number(),
  resultingAvailableBalance: z.number().optional(),
  resultingLedgerBalance: z.number().optional(),
  currency: z.string().length(3, 'currency must be a 3-letter currency code'),
  timestamp: z.string().datetime('timestamp must be ISO-8601 datetime'),
  correlationId: z.string().min(1, 'correlationId is required')
});

export type ApplyProjectionEventRequestDto = z.infer<typeof ApplyProjectionEventSchema>;

export type BalanceResponseDto = {
  accountId: string;
  availableBalance: number;
  ledgerBalance: number;
  currency: string;
  version: number;
  updatedAt: string;
};

export function toBalanceResponseDto(snapshot: BalanceSnapshot): BalanceResponseDto {
  return {
    accountId: snapshot.accountId,
    availableBalance: snapshot.availableBalance,
    ledgerBalance: snapshot.ledgerBalance,
    currency: snapshot.currency,
    version: snapshot.version,
    updatedAt: snapshot.updatedAt
  };
}

export function toBalanceProjectionEvent(input: ApplyProjectionEventRequestDto): BalanceProjectionEvent {
  return {
    eventId: input.eventId,
    accountId: input.accountId,
    deltaAmount: input.deltaAmount,
    resultingAvailableBalance: input.resultingAvailableBalance,
    resultingLedgerBalance: input.resultingLedgerBalance,
    currency: input.currency,
    timestamp: input.timestamp,
    correlationId: input.correlationId
  };
}
