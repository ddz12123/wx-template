import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpClientError } from '../../miniprogram/services/errors';
import { createHttpClient } from '../../miniprogram/services/request';
import { flush, installWxRequestMock, type WxRequestMock } from '../wx-mock';

let mock: WxRequestMock;

beforeEach(() => {
  mock = installWxRequestMock();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createHttpClient', () => {
  it('GET 解析 JSON 文本并保留状态码', async () => {
    const client = createHttpClient({ baseUrl: 'https://api.example.com' });
    const op = client.get<{ ok: boolean }>('/v1/ping');
    await flush();
    expect(mock.requests[0]?.url).toBe('https://api.example.com/v1/ping');
    mock.respond(0, { statusCode: 200, data: '{"ok":true}' });
    const response = await op.promise;
    expect(response.data).toEqual({ ok: true });
    expect(response.statusCode).toBe(200);
  });

  it('GET query 编码并忽略 null/undefined', async () => {
    const client = createHttpClient({ baseUrl: 'https://api.example.com' });
    const op = client.get('/v1/list', { query: { page: 2, size: null, tab: undefined } });
    await flush();
    expect(mock.requests[0]?.url).toBe('https://api.example.com/v1/list?page=2');
    mock.respond(0, { statusCode: 200, data: '[]' });
    const response = await op.promise;
    expect(response.data).toEqual([]);
  });

  it('非 2xx 归类为 http 错误', async () => {
    const client = createHttpClient({ baseUrl: 'https://api.example.com' });
    const op = client.get('/v1/missing');
    await flush();
    mock.respond(0, { statusCode: 404, data: 'missing' });
    await expect(op.promise).rejects.toMatchObject({
      kind: 'http',
      detail: { statusCode: 404 },
    });
  });

  it('204 不做 JSON 解析', async () => {
    const client = createHttpClient({ baseUrl: 'https://api.example.com' });
    const op = client.delete('/v1/items/1');
    await flush();
    expect(mock.requests[0]?.method).toBe('DELETE');
    mock.respond(0, { statusCode: 204, data: '' });
    const response = await op.promise;
    expect(response.statusCode).toBe(204);
  });

  it('POST/PUT 透传 data 与 method', async () => {
    const client = createHttpClient({ baseUrl: 'https://api.example.com' });
    const post = client.post('/v1/items', { name: 'a' });
    const put = client.put('/v1/items/1', { name: 'b' });
    await flush();
    expect(mock.requests[0]?.method).toBe('POST');
    expect(mock.requests[0]?.data).toEqual({ name: 'a' });
    expect(mock.requests[1]?.method).toBe('PUT');
    expect(mock.requests[1]?.data).toEqual({ name: 'b' });
    mock.respond(0, { statusCode: 200, data: '{"id":1}' });
    mock.respond(1, { statusCode: 200, data: '{"id":1}' });
    await expect(post.promise).resolves.toMatchObject({ statusCode: 200 });
    await expect(put.promise).resolves.toMatchObject({ statusCode: 200 });
  });

  it('beforeRequest 可改写 header，抛错归类为 config 且不发起请求', async () => {
    const client = createHttpClient({
      baseUrl: 'https://api.example.com',
      beforeRequest(options) {
        if (options.header?.token === 'deny') throw new Error('rejected');
        return { ...options, header: { ...options.header, token: 'secret' } };
      },
    });
    const ok = client.get('/v1/ping');
    await flush();
    expect(mock.requests[0]?.header).toMatchObject({ token: 'secret' });
    mock.respond(0, { statusCode: 200, data: '{}' });
    await expect(ok.promise).resolves.toMatchObject({ statusCode: 200 });

    const denied = client.get('/v1/ping', { header: { token: 'deny' } });
    // 先挂断言再 flush，避免拒绝先落定造成 unhandled rejection。
    const deniedExpectation = expect(denied.promise).rejects.toMatchObject({ kind: 'config' });
    await flush();
    expect(mock.requests.length).toBe(1);
    await deniedExpectation;
  });

  it('transformResponse 与 parse 依次应用', async () => {
    const client = createHttpClient({
      baseUrl: 'https://api.example.com',
      transformResponse(response) {
        return { wrapped: response.data };
      },
    });
    const op = client.get<{ wrapped: unknown; tagged: boolean }>('/v1/ping', {
      parse: (data) => ({ wrapped: (data as { wrapped: unknown }).wrapped, tagged: true }),
    });
    await flush();
    mock.respond(0, { statusCode: 200, data: '{"ok":true}' });
    const response = await op.promise;
    expect(response.data).toEqual({ wrapped: { ok: true }, tagged: true });
  });

  it('发出前 abort 不触发 wx.request，发出后 abort 调用底层 task', async () => {
    const client = createHttpClient({ baseUrl: 'https://api.example.com' });
    const early = client.get('/v1/ping');
    early.abort();
    await expect(early.promise).rejects.toMatchObject({ kind: 'abort' });
    await flush();
    expect(mock.requests.length).toBe(0);

    const late = client.get('/v1/ping');
    await flush();
    late.abort();
    await expect(late.promise).rejects.toMatchObject({ kind: 'abort' });
    expect(mock.aborted(0)).toBe(true);
  });

  it('网络失败由 onError 观察但不改变结果', async () => {
    const onError = vi.fn();
    const client = createHttpClient({ baseUrl: 'https://api.example.com', onError });
    const op = client.get('/v1/ping');
    await flush();
    mock.fail(0, 'request:fail timeout');
    await expect(op.promise).rejects.toMatchObject({ kind: 'timeout' });
    await flush();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(HttpClientError);
  });

  it('JSON 解析失败归类为 parse 错误', async () => {
    const client = createHttpClient({ baseUrl: 'https://api.example.com' });
    const op = client.get('/v1/broken');
    await flush();
    mock.respond(0, { statusCode: 200, data: '{"broken' });
    await expect(op.promise).rejects.toMatchObject({ kind: 'parse' });
  });
});
