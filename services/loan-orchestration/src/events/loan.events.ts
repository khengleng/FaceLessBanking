import { randomUUID } from 'node:crypto';

import type { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import type { Loan } from '../domain/loan.js';
import type { Repayment } from '../domain/repayment.js';
import type { LoanInterestAccrual } from '../domain/interest-accrual.js';

export class LoanEventsPublisher {
  constructor(private readonly kafkaProducer: KafkaProducerAdapter) {}

  async emitLoanCreated(loan: Loan): Promise<void> {
    await this.kafkaProducer.publish({
      type: 'loan.created.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: `loan-${loan.loanId}`,
        causationId: `loan-created-${loan.loanId}`,
        timestamp: new Date().toISOString()
      },
      payload: {
        loanId: loan.loanId,
        customerId: loan.customerId,
        amount: loan.principalCents,
        currency: loan.currency,
        status: loan.status
      }
    });
  }

  async emitRepaymentInitiated(repayment: Repayment, correlationId: string): Promise<void> {
    await this.kafkaProducer.publish({
      type: 'loan.repayment.initiated.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId,
        causationId: `repayment-initiated-${repayment.repaymentId}`,
        timestamp: new Date().toISOString()
      },
      payload: {
        repaymentId: repayment.repaymentId,
        loanAccountId: repayment.loanAccountId,
        amount: repayment.amountCents,
        currency: repayment.currency,
        status: repayment.status,
        paymentId: repayment.paymentId
      }
    });
  }

  async emitLoanDisbursementInitiated(input: {
    loanId: string;
    paymentId: string;
    sourceAccountId: string;
    destinationAccountId: string;
    amountCents: number;
    currency: string;
    correlationId: string;
    sourceEventId: string;
  }): Promise<void> {
    await this.kafkaProducer.publish({
      type: 'loan.disbursement.initiated.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: input.correlationId,
        causationId: input.sourceEventId,
        timestamp: new Date().toISOString()
      },
      payload: {
        loanId: input.loanId,
        paymentId: input.paymentId,
        sourceAccountId: input.sourceAccountId,
        destinationAccountId: input.destinationAccountId,
        amountCents: input.amountCents,
        currency: input.currency,
        status: 'DISBURSEMENT_PENDING'
      }
    });
  }

  async emitLoanDelinquent(input: {
    loanAccountId: string;
    customerId: string;
    correlationId: string;
    reason: string;
  }): Promise<void> {
    await this.kafkaProducer.publish({
      type: 'loan.delinquent.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: input.correlationId,
        causationId: `loan-delinquency-${input.loanAccountId}`,
        timestamp: new Date().toISOString()
      },
      payload: {
        loanAccountId: input.loanAccountId,
        customerId: input.customerId,
        status: 'DELINQUENT',
        reason: input.reason
      }
    });
  }

  async emitLoanScheduleGenerated(input: {
    loanAccountId: string;
    scheduleId: string;
    numberOfInstallments: number;
    scheduleType: 'FIXED_INSTALLMENT_V1';
    correlationId: string;
  }): Promise<void> {
    await this.kafkaProducer.publish({
      type: 'loan.schedule.generated.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: input.correlationId,
        causationId: `loan-schedule-${input.loanAccountId}`,
        timestamp: new Date().toISOString()
      },
      payload: {
        loanAccountId: input.loanAccountId,
        scheduleId: input.scheduleId,
        numberOfInstallments: input.numberOfInstallments,
        scheduleType: input.scheduleType
      }
    });
  }

  async emitLoanInterestAccrued(input: {
    accrual: LoanInterestAccrual;
    correlationId?: string;
  }): Promise<void> {
    await this.kafkaProducer.publish({
      type: 'loan.interest.accrued.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: input.correlationId ?? `loan-interest-${input.accrual.loanAccountId}`,
        causationId: `loan-interest-accrual-${input.accrual.accrualId}`,
        timestamp: new Date().toISOString()
      },
      payload: {
        loanAccountId: input.accrual.loanAccountId,
        accrualId: input.accrual.accrualId,
        accrualDate: input.accrual.accrualDate,
        accrualMode: input.accrual.accrualMode,
        accruedInterest: input.accrual.accruedInterest
      }
    });
  }
}
