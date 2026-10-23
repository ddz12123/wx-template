/** 不包含业务状态码；HTTP 成功仅指 2xx。 */
export type ErrorKind = 'config' | 'network' | 'timeout' | 'abort' | 'http' | 'parse';

export interface ErrorDetail {
  statusCode?: number;
  header?: Record<string, unknown>;
  data?: unknown;
  cause?: unknown;
}

export class HttpClientError extends Error {
  readonly kind: ErrorKind;
  readonly detail: ErrorDetail;

  constructor(kind: ErrorKind, message: string, detail: ErrorDetail = {}) {
    super(message);
    this.name = 'HttpClientError';
    this.kind = kind;
    this.detail = detail;
  }
}

export function isHttpClientError(value: unknown): value is HttpClientError {
  return value instanceof HttpClientError;
}

/** 微信不同端错误码并不统一，保留原始错误并通过 errMsg 区分超时和中止。 */
export function networkError(cause: unknown): HttpClientError {
  if (isHttpClientError(cause)) return cause;
  let message = 'Network operation failed';
  try {
    if (typeof cause === 'object' && cause !== null && 'errMsg' in cause) {
      message = String(cause.errMsg);
    } else if (cause instanceof Error) {
      message = cause.message;
    } else if (typeof cause === 'string') {
      message = cause;
    }
  } catch {
    /* 不可信错误对象的 getter 也不能令 promise 悬空。 */
  }
  const kind: ErrorKind = /abort/i.test(message)
    ? 'abort'
    : /timeout|timed\s*out/i.test(message)
      ? 'timeout'
      : 'network';
  return new HttpClientError(kind, message, { cause });
}

export function checkHttpStatus(response: {
  statusCode: number;
  header?: Record<string, unknown>;
  data?: unknown;
}): void {
  if (response.statusCode >= 200 && response.statusCode < 300) return;
  throw new HttpClientError('http', `HTTP ${response.statusCode}`, {
    statusCode: response.statusCode,
    header: response.header,
    data: response.data,
  });
}
