export interface NetworkFailure {
  type: 'network';
  message: string;
}

export interface ServerFailure {
  type: 'server';
  statusCode: number;
  message: string;
  errorCode?: string;
}

export interface ParseFailure {
  type: 'parse';
  message: string;
}

export interface CancelledFailure {
  type: 'cancelled';
}

export type AppFailure =
  | NetworkFailure
  | ServerFailure
  | ParseFailure
  | CancelledFailure;

export const Failure = {
  network: (message: string): NetworkFailure => ({
    type: 'network',
    message,
  }),

  server: (
    statusCode: number,
    message: string,
    errorCode?: string,
  ): ServerFailure => ({
    type: 'server',
    statusCode,
    message,
    ...(errorCode !== undefined && { errorCode }),
  }),

  parse: (message: string): ParseFailure => ({
    type: 'parse',
    message,
  }),

  cancelled: (): CancelledFailure => ({
    type: 'cancelled',
  }),
} as const;

interface Ok<T> {
  ok: true;
  data: T;
}

interface Err {
  ok: false;
  failure: AppFailure;
}

export type Result<T> = Ok<T> | Err;

export const ResultHelper = {
  ok: <T>(data: T): Result<T> => ({ ok: true, data }),
  error: <T>(failure: AppFailure): Result<T> => ({ ok: false, failure }),
} as const;

export interface ApiEnvelope<T> {
  meta: {
    code: number;
    message?: string;
  };
  data: T;
}

export interface ConditionalResult<T> {
  data: T | null;
  etag: string | null;
  notModified: boolean;
}
