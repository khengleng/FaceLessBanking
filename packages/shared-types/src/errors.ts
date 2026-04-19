export type ErrorCode =
  | 'validation_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'internal_error'
  | (string & {});

export type FieldErrorMap = Record<string, string[]>;

export type ApiErrorDetails = {
  code: ErrorCode;
  message: string;
  details?: string[];
  fieldErrors?: FieldErrorMap;
  retriable?: boolean;
};

export type ValidationErrorDetails = ApiErrorDetails & {
  code: 'validation_failed';
};

export type NotFoundErrorDetails = ApiErrorDetails & {
  code: 'not_found';
};

export function buildValidationError(input: {
  message?: string;
  details?: string[];
  fieldErrors?: FieldErrorMap;
}): ValidationErrorDetails {
  return {
    code: 'validation_failed',
    message: input.message ?? 'Validation failed',
    details: input.details,
    fieldErrors: input.fieldErrors,
    retriable: false
  };
}

export function buildNotFoundError(message = 'Resource not found'): NotFoundErrorDetails {
  return {
    code: 'not_found',
    message,
    retriable: false
  };
}
