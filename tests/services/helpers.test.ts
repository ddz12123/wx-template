import { describe, expect, it, vi } from 'vitest';
import { HttpClientError } from '../../miniprogram/services/errors';
import { createOperation, prepareNetworkOptions } from '../../miniprogram/services/helpers';
import { flush } from '../wx-mock';

describe('prepareNetworkOptions', () => {
  it('拼接 baseUrl 与相对路径（容忍两侧多余斜杠）', () => {
    const a = prepareNetworkOptions({ url: 'v1/ping' }, { baseUrl: 'https://api.example.com/' });
    const b = prepareNetworkOptions({ url: '/v1/ping' }, { baseUrl: 'https://api.example.com' });
    expect(a.url).toBe('https://api.example.com/v1/ping');
    expect(b.url).toBe('https://api.example.com/v1/ping');
  });

  it('绝对 HTTPS URL 直接放行', () => {
    const result = prepareNetworkOptions({ url: 'https://other.example.com/x' });
    expect(result.url).toBe('https://other.example.com/x');
  });

  it('相对路径缺少 baseUrl 时抛 config 错误', () => {
    expect(() => prepareNetworkOptions({ url: 'v1/ping' })).toThrowError(HttpClientError);
  });

  it('拒绝非 https 协议', () => {
    expect(() => prepareNetworkOptions({ url: 'http://api.example.com' })).toThrowError(
      HttpClientError,
    );
  });

  it('编码 query 并跳过 null/undefined', () => {
    const result = prepareNetworkOptions({
      url: 'https://api.example.com/v1',
      query: { a: 1, b: null, c: undefined, 'k&y': 'v v' },
    });
    expect(result.url).toBe('https://api.example.com/v1?a=1&k%26y=v%20v');
  });

  it('数组 query 展开为重复键，已有 ? 时用 & 续接', () => {
    const result = prepareNetworkOptions({
      url: 'https://api.example.com/v1?page=2',
      query: { id: ['1', '2'] },
    });
    expect(result.url).toBe('https://api.example.com/v1?page=2&id=1&id=2');
  });

  it('非法 timeout 抛 config 错误', () => {
    expect(() => prepareNetworkOptions({ url: 'https://a.b/c', timeout: 0 })).toThrowError(
      HttpClientError,
    );
    expect(() =>
      prepareNetworkOptions({ url: 'https://a.b/c', timeout: Number.POSITIVE_INFINITY }),
    ).toThrowError(HttpClientError);
  });
});

describe('createOperation', () => {
  it('首次 settle 生效，后续 resolve/reject 被忽略', async () => {
    const op = createOperation<number>((control) => {
      control.resolve(1);
      control.resolve(2);
      control.reject(new HttpClientError('abort', 'later'));
    });
    await expect(op.promise).resolves.toBe(1);
  });

  it('reject 通知 onError 观察者，观察者异常被吞掉', async () => {
    const observer = vi.fn(() => {
      throw new Error('observer boom');
    });
    const op = createOperation<void>((control) => {
      control.reject(new HttpClientError('http', 'HTTP 500'));
    }, observer);
    await expect(op.promise).rejects.toMatchObject({ kind: 'http' });
    await flush();
    expect(observer).toHaveBeenCalledTimes(1);
  });

  it('start 同步抛错时以 networkError 包装拒绝', async () => {
    const op = createOperation<void>(() => {
      throw new Error('boom');
    });
    await expect(op.promise).rejects.toMatchObject({ kind: 'network' });
  });

  it('start 抛出的 HttpClientError 原样保留', async () => {
    const config = new HttpClientError('config', 'bad options');
    const op = createOperation<void>(() => {
      throw config;
    });
    await expect(op.promise).rejects.toBe(config);
  });

  it('abort 在 start 执行前发生时不运行 start', async () => {
    let started = false;
    const op = createOperation<void>(() => {
      started = true;
    });
    op.abort();
    await expect(op.promise).rejects.toMatchObject({ kind: 'abort' });
    await flush();
    expect(started).toBe(false);
  });

  it('attach 之后 abort 会调用底层 task', async () => {
    const abort = vi.fn();
    const op = createOperation<void>((control) => {
      control.attach({ abort });
    });
    await flush();
    op.abort();
    await expect(op.promise).rejects.toMatchObject({ kind: 'abort' });
    expect(abort).toHaveBeenCalledTimes(1);
  });

  it('settle 之后 abort 是 no-op', async () => {
    const op = createOperation<string>((control) => {
      control.resolve('done');
    });
    await expect(op.promise).resolves.toBe('done');
    expect(() => op.abort()).not.toThrow();
  });

  it('onSettled 清理在 settle 后执行且异常被吞', async () => {
    const cleanup = vi.fn(() => {
      throw new Error('cleanup boom');
    });
    const op = createOperation<number>((control) => {
      control.onSettled(cleanup);
      control.resolve(42);
    });
    await expect(op.promise).resolves.toBe(42);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
