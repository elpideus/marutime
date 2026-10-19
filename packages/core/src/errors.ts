export type AppErrorCode =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'unavailable'
  | 'internal';

const STATUS: Record<AppErrorCode, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  unavailable: 503,
  internal: 500,
};

export class AppError extends Error {
  readonly status: number;
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
    this.status = STATUS[code];
  }

  toJSON() {
    return { error: { code: this.code, message: this.message, details: this.details } };
  }
}

export const errors = {
  validation: (message = 'Invalid input', details?: Record<string, string[]>) => new AppError('validation', message, details),
  unauthorized: (message = 'You need to sign in') => new AppError('unauthorized', message),
  forbidden: (message = 'You are not allowed to do that') => new AppError('forbidden', message),
  notFound: (what = 'Resource') => new AppError('not_found', `${what} not found`),
  conflict: (message: string) => new AppError('conflict', message),
  rateLimited: (message = 'Too many attempts. Try again later.') => new AppError('rate_limited', message),
  unavailable: (message = 'Service temporarily unavailable') => new AppError('unavailable', message),
};

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
