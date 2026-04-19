import type { AMLAlertCandidate } from './aml-alert.js';

export type PaymentEventContext = {
  sourceEventId: string;
  correlationId: string;
  paymentId: string;
  sourceAccountId: string;
  customerId: string;
  amount: number;
  currency: string;
  countryCode?: string;
  eventType: 'payment.initiated.v1' | 'payment.status.updated.v1';
};

export type AMLRuleConfig = {
  largeAmountThreshold: number;
  repeatedTxnThreshold: number;
  defaultCurrency: string;
  defaultCountryCode: string;
};

export const DEFAULT_AML_RULE_CONFIG: AMLRuleConfig = {
  largeAmountThreshold: 10000,
  repeatedTxnThreshold: 3,
  defaultCurrency: 'USD',
  defaultCountryCode: 'US'
};

export function evaluateAmlRules(input: {
  context: PaymentEventContext;
  recentTransactionCountForEntity: number;
  config?: AMLRuleConfig;
}): AMLAlertCandidate[] {
  const cfg = input.config ?? DEFAULT_AML_RULE_CONFIG;
  const context = input.context;
  const alerts: AMLAlertCandidate[] = [];

  if (context.amount >= cfg.largeAmountThreshold) {
    alerts.push({
      sourceEventId: context.sourceEventId,
      entityType: 'PAYMENT',
      entityId: context.paymentId,
      ruleName: 'LARGE_TRANSACTION_THRESHOLD',
      severity: 'HIGH',
      reason: `Amount ${context.amount} is greater than threshold ${cfg.largeAmountThreshold}`
    });
  }

  if (input.recentTransactionCountForEntity >= cfg.repeatedTxnThreshold) {
    alerts.push({
      sourceEventId: context.sourceEventId,
      entityType: 'PAYMENT',
      entityId: context.paymentId,
      ruleName: 'UNUSUAL_REPEATED_TRANSACTIONS',
      severity: 'MEDIUM',
      reason: `Detected ${input.recentTransactionCountForEntity} repeated transactions from source account in short window`
    });
  }

  const hasCrossCurrency = context.currency !== cfg.defaultCurrency;
  const hasCrossBorder = context.countryCode !== undefined && context.countryCode !== cfg.defaultCountryCode;
  if (hasCrossCurrency || hasCrossBorder) {
    alerts.push({
      sourceEventId: context.sourceEventId,
      entityType: 'PAYMENT',
      entityId: context.paymentId,
      ruleName: 'UNUSUAL_CROSS_CURRENCY_OR_BORDER',
      severity: 'MEDIUM',
      reason: hasCrossCurrency
        ? `Currency ${context.currency} differs from baseline ${cfg.defaultCurrency}`
        : `Country ${context.countryCode} differs from baseline ${cfg.defaultCountryCode}`
    });
  }

  return alerts;
}
