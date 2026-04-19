import type { PostgresAccountAdapter } from '../adapters/postgres-account.adapter.js';
import type { InterestEventsPublisher } from '../events/interest.events.js';
import { DepositInterestAccrualApplication } from './deposit-interest-accrual.application.js';

type InterestLogger = {
  info: (payload: Record<string, unknown>, message: string) => void;
  warn: (payload: Record<string, unknown>, message: string) => void;
  error: (payload: Record<string, unknown>, message: string) => void;
};

export function buildDepositInterestAccrualApplication(params: {
  postgresAdapter: PostgresAccountAdapter;
  interestEvents: InterestEventsPublisher;
}) {
  const logger: InterestLogger = {
    info: (payload, message) => {
      console.info(message, payload);
    },
    warn: (payload, message) => {
      console.warn(message, payload);
    },
    error: (payload, message) => {
      console.error(message, payload);
    }
  };

  const application = new DepositInterestAccrualApplication(
    params.postgresAdapter,
    params.interestEvents,
    logger
  );

  return { application };
}
