import { describe, expect, it } from 'vitest';
import {
  checkHttpStatus,
  HttpClientError,
  isHttpClientError,
  networkError,
} from '../../miniprogram/services/errors';

describe('networkError', () => {
  it('保留已有的 HttpClientError', () => {
    const original = new HttpClientError('http', 'HTTP 500');
    expect(networkError(original)).toBe(original);
  });

  it('从 errMsg 识别 abort', () => {
    const error = networkError({ errMsg: 'request:fail abort' });
    expect(error.kind).toBe('abort');
    expect(error.message).toBe('request:fail abort');
  });

  it('从 errMsg 识别 timeout', () => {
    expect(networkError({ errMsg: 'request:fail timeout' }).kind).toBe('timeout');
    expect(networkError({ errMsg: 'request:fail timed out' }).kind).toBe('timeout');
  });

  it('其他 errMsg 归类为 network', () => {
    expect(networkError({ errMsg: 'request:fail ' }).kind).toBe('network');
  });

  it('Error 实例取 message，字符串直接使用', () => {
    expect(networkError(new Error('boom')).kind).toBe('network');
    expect(networkError('boom').message).toBe('boom');
  });

  it('异常的 cause 对象不会令构造悬空', () => {
    const hostile = {
      get errMsg(): string {
        throw new Error('getter');
      },
    };
    const error = networkError(hostile);
    expect(error.kind).toBe('network');
    expect(error.detail.cause).toBe(hostile);
  });
});

describe('checkHttpStatus', () => {
  it('2xx 通过', () => {
    expect(() => checkHttpStatus({ statusCode: 200 })).not.toThrow();
    expect(() => checkHttpStatus({ statusCode: 299 })).not.toThrow();
  });

  it('非 2xx 抛出携带状态码的 http 错误', () => {
    try {
      checkHttpStatus({ statusCode: 404, data: 'missing' });
      expect.unreachable();
    } catch (cause) {
      expect(isHttpClientError(cause)).toBe(true);
      if (isHttpClientError(cause)) {
        expect(cause.kind).toBe('http');
        expect(cause.message).toBe('HTTP 404');
        expect(cause.detail.statusCode).toBe(404);
        expect(cause.detail.data).toBe('missing');
      }
    }
  });
});

describe('isHttpClientError', () => {
  it('仅识别 HttpClientError 实例', () => {
    expect(isHttpClientError(new Error('x'))).toBe(false);
    expect(isHttpClientError(new HttpClientError('abort', 'x'))).toBe(true);
  });
});
