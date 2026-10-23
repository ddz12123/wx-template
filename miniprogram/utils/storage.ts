export interface StorageOptions {
  namespace: string;
  version?: number;
  /** Default lifetime in milliseconds. Omit to retain values indefinitely. */
  ttlMs?: number;
}

export interface StorageWriteOptions {
  /** Overrides the default lifetime; null disables expiry for this value. */
  ttlMs?: number | null;
}

export interface Storage<Schema extends object> {
  get<Key extends Extract<keyof Schema, string>>(key: Key): Schema[Key] | undefined;
  set<Key extends Extract<keyof Schema, string>>(
    key: Key,
    value: Schema[Key],
    options?: StorageWriteOptions,
  ): void;
  remove(key: Extract<keyof Schema, string>): void;
  clear(): void;
}

interface StoredValue {
  version: number;
  expiresAt: number | null;
  value: unknown;
}

function isStoredValue(value: unknown): value is StoredValue {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.version === 'number' &&
    (record.expiresAt === null ||
      (typeof record.expiresAt === 'number' && Number.isFinite(record.expiresAt))) &&
    Object.prototype.hasOwnProperty.call(record, 'value')
  );
}

function validateTtl(ttlMs: number | null | undefined): void {
  if (ttlMs !== undefined && ttlMs !== null && (!Number.isFinite(ttlMs) || ttlMs < 0)) {
    throw new RangeError('Storage TTL must be a finite, non-negative number');
  }
}

/** Values must be supported by wx.setStorageSync. Storage errors are not swallowed. */
export function createStorage<Schema extends object>(options: StorageOptions): Storage<Schema> {
  if (options.namespace.length === 0) throw new Error('Storage namespace must not be empty');
  const version = options.version ?? 1;
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new RangeError('Storage version must be a positive safe integer');
  }
  const defaultTtl = options.ttlMs;
  validateTtl(defaultTtl);
  const prefix = `storage:${encodeURIComponent(options.namespace)}:`;
  const storageKey = (key: string): string => prefix + encodeURIComponent(key);

  return {
    get<Key extends Extract<keyof Schema, string>>(key: Key): Schema[Key] | undefined {
      const fullKey = storageKey(key);
      const stored: unknown = wx.getStorageSync(fullKey);
      if (!isStoredValue(stored)) return undefined;
      if (
        stored.version !== version ||
        (stored.expiresAt !== null && stored.expiresAt <= Date.now())
      ) {
        wx.removeStorageSync(fullKey);
        return undefined;
      }
      return stored.value as Schema[Key];
    },
    set(key, value, writeOptions = {}): void {
      const ttl = writeOptions.ttlMs === undefined ? defaultTtl : writeOptions.ttlMs;
      validateTtl(ttl);
      const expiresAt = ttl === undefined || ttl === null ? null : Date.now() + ttl;
      if (
        expiresAt !== null &&
        (!Number.isFinite(expiresAt) || expiresAt > Number.MAX_SAFE_INTEGER)
      ) {
        throw new RangeError('Storage expiry exceeds the supported timestamp range');
      }
      wx.setStorageSync(storageKey(key), { version, expiresAt, value });
    },
    remove(key): void {
      wx.removeStorageSync(storageKey(key));
    },
    clear(): void {
      for (const key of wx.getStorageInfoSync().keys) {
        if (key.startsWith(prefix)) wx.removeStorageSync(key);
      }
    },
  };
}
