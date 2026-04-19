import type { CorrelationId } from './identifiers.js';
import type { ApiErrorDetails } from './errors.js';

export type ApiSuccessResponse<TData, TMeta = undefined> = {
  success: true;
  data: TData;
  meta?: TMeta;
  correlationId?: CorrelationId;
};

export type ApiErrorResponse<TError extends ApiErrorDetails = ApiErrorDetails> = {
  success: false;
  error: TError;
  correlationId?: CorrelationId;
};

export type ApiResponse<TData, TError extends ApiErrorDetails = ApiErrorDetails, TMeta = undefined> =
  | ApiSuccessResponse<TData, TMeta>
  | ApiErrorResponse<TError>;

export function buildSuccessResponse<TData, TMeta = undefined>(input: {
  data: TData;
  meta?: TMeta;
  correlationId?: CorrelationId;
}): ApiSuccessResponse<TData, TMeta> {
  return {
    success: true,
    data: input.data,
    meta: input.meta,
    correlationId: input.correlationId
  };
}

export function buildErrorResponse<TError extends ApiErrorDetails>(input: {
  error: TError;
  correlationId?: CorrelationId;
}): ApiErrorResponse<TError> {
  return {
    success: false,
    error: input.error,
    correlationId: input.correlationId
  };
}
