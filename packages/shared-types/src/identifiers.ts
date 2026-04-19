export type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type CustomerId = Brand<string, 'CustomerId'>;
export type AccountId = Brand<string, 'AccountId'>;
export type LoanId = Brand<string, 'LoanId'>;
export type PaymentId = Brand<string, 'PaymentId'>;
export type CorrelationId = Brand<string, 'CorrelationId'>;

export function toCustomerId(value: string): CustomerId {
  return value as CustomerId;
}

export function toAccountId(value: string): AccountId {
  return value as AccountId;
}

export function toLoanId(value: string): LoanId {
  return value as LoanId;
}

export function toPaymentId(value: string): PaymentId {
  return value as PaymentId;
}

export function toCorrelationId(value: string): CorrelationId {
  return value as CorrelationId;
}
