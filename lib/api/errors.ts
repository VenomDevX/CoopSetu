export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export class ApiError extends Error {
  code: ApiErrorCode;
  status: number;
  details?: unknown;

  constructor(code: ApiErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const Errors = {
  unauthenticated: (msg = 'You must be signed in.') =>
    new ApiError('UNAUTHENTICATED', msg, 401),
  forbidden: (msg = 'You do not have permission to perform this action.') =>
    new ApiError('FORBIDDEN', msg, 403),
  notFound: (msg = 'Resource not found.') => new ApiError('NOT_FOUND', msg, 404),
  validation: (msg = 'Invalid request.', details?: unknown) =>
    new ApiError('VALIDATION_ERROR', msg, 422, details),
  conflict: (msg = 'Conflict.') => new ApiError('CONFLICT', msg, 409),
  internal: (msg = 'Something went wrong.') => new ApiError('INTERNAL', msg, 500),
};
