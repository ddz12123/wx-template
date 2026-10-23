import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStorage } from '../../miniprogram/utils/storage';
import { installWxStorageMock, type WxStorageMock } from '../wx-mock';

let mock: WxStorageMock;

beforeEach(() => {
  mock = installWxStorageMock();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

interface Schema {
  token: string;
  count: number;
}

describe('createStorage', () => {
  it('读写删除基础值', () => {
    const storage = createStorage<Schema>({ namespace: 'app' });
    storage.set('token', 'abc');
    expect(storage.get('token')).toBe('abc');
    storage.remove('token');
    expect(storage.get('token')).toBeUndefined();
  });

  it('未写入或已删除的键返回 undefined', () => {
    const storage = createStorage<Schema>({ namespace: 'app' });
    expect(storage.get('count')).toBeUndefined();
  });

  it('命名空间隔离且 clear 只清本命名空间', () => {
    const a = createStorage<Schema>({ namespace: 'a' });
    const b = createStorage<Schema>({ namespace: 'b' });
    a.set('token', 'a-token');
    b.set('token', 'b-token');
    a.clear();
    expect(a.get('token')).toBeUndefined();
    expect(b.get('token')).toBe('b-token');
  });

  it('TTL 到期后返回 undefined 并清除底层键', () => {
    vi.useFakeTimers({ now: 1_000 });
    const storage = createStorage<Schema>({ namespace: 'app', ttlMs: 100 });
    storage.set('token', 'abc');
    expect(storage.get('token')).toBe('abc');
    vi.setSystemTime(1_099);
    expect(storage.get('token')).toBe('abc');
    vi.setSystemTime(1_100);
    expect(storage.get('token')).toBeUndefined();
    expect(mock.store.size).toBe(0);
  });

  it('单次写入可用 ttlMs 覆盖默认值，null 表示永不过期', () => {
    vi.useFakeTimers({ now: 1_000 });
    const storage = createStorage<Schema>({ namespace: 'app', ttlMs: 100 });
    storage.set('token', 'forever', { ttlMs: null });
    storage.set('count', 1, { ttlMs: 50 });
    vi.setSystemTime(2_000);
    expect(storage.get('token')).toBe('forever');
    expect(storage.get('count')).toBeUndefined();
  });

  it('版本不匹配视为不存在并清除', () => {
    const v1 = createStorage<Schema>({ namespace: 'app', version: 1 });
    v1.set('token', 'abc');
    const v2 = createStorage<Schema>({ namespace: 'app', version: 2 });
    expect(v2.get('token')).toBeUndefined();
    expect(mock.store.size).toBe(0);
  });

  it('非法入参直接抛错', () => {
    expect(() => createStorage<Schema>({ namespace: '' })).toThrowError();
    expect(() => createStorage<Schema>({ namespace: 'app', version: 0 })).toThrowError(RangeError);
    const storage = createStorage<Schema>({ namespace: 'app' });
    expect(() => storage.set('token', 'x', { ttlMs: -1 })).toThrowError(RangeError);
  });
});
