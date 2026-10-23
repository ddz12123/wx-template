import { HttpClientError, networkError } from './errors';

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParameters = Readonly<Record<string, QueryValue | readonly QueryValue[]>>;
export type RequestHeaders = Readonly<Record<string, string>>;
export type ErrorObserver = (error: HttpClientError) => void | Promise<void>;

export interface NetworkOptions {
  url: string;
  query?: QueryParameters;
  header?: RequestHeaders;
  /** 正数毫秒；省略时使用微信默认超时。 */
  timeout?: number;
}

export interface AbortableOperation<T> {
  promise: Promise<T>;
  abort(): void;
}

interface NativeTask {
  abort(): void;
}

export interface OperationControl<T> {
  active(): boolean;
  resolve(value: T): void;
  reject(error: HttpClientError): void;
  attach(task: NativeTask): void;
  onSettled(cleanup: () => void): void;
}

export interface ResolveContext {
  /** 相对路径拼接用的基地址；绝对 HTTPS URL 不需要它。 */
  baseUrl?: string;
}

export function createOperation<T>(
  start: (control: OperationControl<T>) => void | Promise<void>,
  observeError?: ErrorObserver,
): AbortableOperation<T> {
  let settled = false;
  let aborted = false;
  let task: NativeTask | undefined;
  const cleanups: Array<() => void> = [];
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (error: HttpClientError) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  const cleanup = (): void => {
    task = undefined;
    for (const dispose of cleanups.splice(0)) {
      try {
        dispose();
      } catch {
        /* ignore */
      }
    }
  };
  const control: OperationControl<T> = {
    active: () => !settled,
    resolve(value) {
      if (settled) return;
      settled = true;
      resolvePromise(value);
      cleanup();
    },
    reject(error) {
      if (settled) return;
      settled = true;
      rejectPromise(error);
      cleanup();
      if (observeError)
        void Promise.resolve()
          .then(() => observeError(error))
          .catch(() => {});
    },
    attach(value) {
      if (aborted) {
        try {
          value.abort();
        } catch {
          /* ignore */
        }
      } else if (!settled) {
        task = value;
      }
    },
    onSettled(dispose) {
      if (settled) {
        try {
          dispose();
        } catch {
          /* ignore */
        }
      } else {
        cleanups.push(dispose);
      }
    },
  };
  void Promise.resolve()
    .then(() => {
      if (control.active()) return start(control);
      return undefined;
    })
    .catch((cause: unknown) => {
      const pendingTask = task;
      control.reject(networkError(cause));
      try {
        pendingTask?.abort();
      } catch {
        /* ignore */
      }
    });
  return {
    promise,
    abort() {
      if (settled) return;
      aborted = true;
      const pendingTask = task;
      control.reject(new HttpClientError('abort', 'Request aborted'));
      try {
        pendingTask?.abort();
      } catch {
        /* ignore */
      }
    },
  };
}

export function prepareNetworkOptions(
  options: NetworkOptions,
  context: ResolveContext = {},
): { url: string; header?: RequestHeaders; timeout?: number } {
  try {
    const url = options.url;
    const query = options.query;
    const header = options.header;
    const timeout = options.timeout;
    if (!url) throw new Error('URL must not be empty');
    if (timeout !== undefined && (!Number.isFinite(timeout) || timeout <= 0)) {
      throw new Error('timeout must be a positive number');
    }
    let resolved = url;
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(url);
    if (!hasScheme) {
      const base = (context.baseUrl ?? '').trim();
      if (!base) throw new Error('API base URL is not configured');
      const cleanBase = base.replace(/\/+$/, '');
      const cleanPath = url.replace(/^\/+/, '');
      resolved = cleanBase + '/' + cleanPath;
    }
    if (!/^https:\/\//i.test(resolved)) {
      throw new Error('Only absolute HTTPS URLs are supported');
    }
    const parts: string[] = [];
    if (query) {
      const keys = Object.keys(query);
      for (const key of keys) {
        const entry = query[key];
        const values = Array.isArray(entry) ? entry : [entry];
        for (const value of values) {
          if (value !== undefined && value !== null) {
            parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
          }
        }
      }
    }
    if (parts.length > 0) {
      const hashIndex = resolved.indexOf('#');
      const hash = hashIndex === -1 ? '' : resolved.slice(hashIndex);
      const base = hashIndex === -1 ? resolved : resolved.slice(0, hashIndex);
      resolved = base + (base.indexOf('?') === -1 ? '?' : '&') + parts.join('&') + hash;
    }
    const result: { url: string; header?: RequestHeaders; timeout?: number } = { url: resolved };
    if (header) result.header = { ...header };
    if (timeout !== undefined) result.timeout = timeout;
    return result;
  } catch (cause) {
    throw new HttpClientError('config', 'Invalid network configuration', { cause });
  }
}
