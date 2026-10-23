import { checkHttpStatus, HttpClientError, networkError } from './errors';
import { createOperation, prepareNetworkOptions } from './helpers';
import type { AbortableOperation, ErrorObserver, NetworkOptions, ResolveContext } from './helpers';

export type {
  AbortableOperation,
  NetworkOptions,
  QueryParameters,
  QueryValue,
  RequestHeaders,
  ResolveContext,
} from './helpers';

export interface HttpResponse<T = unknown> {
  data: T;
  statusCode: number;
  header: Record<string, unknown>;
}

export interface HttpRequestOptions extends NetworkOptions {
  method?: WechatMiniprogram.RequestOption['method'];
  data?: string | Record<string, unknown> | ArrayBuffer;
  responseType?: 'json' | 'text' | 'arraybuffer';
}

export interface RequestOptions<T = unknown> extends HttpRequestOptions {
  parse?: (data: unknown) => T | Promise<T>;
}

export interface HttpClientOptions extends ResolveContext {
  /** 每次请求使用独立配置对象；抛出/拒绝归类为 config，取消时不再发送请求。 */
  beforeRequest?: (options: HttpRequestOptions) => HttpRequestOptions | Promise<HttpRequestOptions>;
  /** 在 2xx 与内置 JSON 解析之后转换 data；保留原始 HTTP 状态与响应头。 */
  transformResponse?: (response: HttpResponse<unknown>) => unknown | Promise<unknown>;
  /** 仅观察失败，不能恢复请求；观察者抛出/拒绝不覆盖原错误。 */
  onError?: ErrorObserver;
  /** 实例默认超时；省略时使用微信默认，单请求 timeout 可覆盖。 */
  timeout?: number;
}

export interface HttpClient {
  request<T = unknown>(options: RequestOptions<T>): AbortableOperation<HttpResponse<T>>;
  get<T = unknown>(
    url: string,
    extra?: Omit<RequestOptions<T>, 'url' | 'method' | 'data'>,
  ): AbortableOperation<HttpResponse<T>>;
  post<T = unknown>(
    url: string,
    data?: HttpRequestOptions['data'],
    extra?: Omit<RequestOptions<T>, 'url' | 'method' | 'data'>,
  ): AbortableOperation<HttpResponse<T>>;
  put<T = unknown>(
    url: string,
    data?: HttpRequestOptions['data'],
    extra?: Omit<RequestOptions<T>, 'url' | 'method' | 'data'>,
  ): AbortableOperation<HttpResponse<T>>;
  /** 微信 wx.request 不支持 PATCH；需要时用 request({ method: ... }) 自行确认端上行为。 */
  delete<T = unknown>(
    url: string,
    extra?: Omit<RequestOptions<T>, 'url' | 'method' | 'data'>,
  ): AbortableOperation<HttpResponse<T>>;
}

/** 实例扩展点在创建时固定；不做业务解包、鉴权、UI、重试或缓存。默认用微信超时。 */
export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const beforeRequest = options.beforeRequest;
  const transformResponse = options.transformResponse;
  const onError = options.onError;
  const baseUrl = options.baseUrl;
  const defaultTimeout = options.timeout;
  const context: ResolveContext = { baseUrl };
  const client: HttpClient = {
    request<T = unknown>(input: RequestOptions<T>): AbortableOperation<HttpResponse<T>> {
      return createOperation<HttpResponse<T>>(async (control) => {
        let prepared: HttpRequestOptions;
        let parse: RequestOptions<T>['parse'];
        try {
          const parser = input.parse;
          parse = parser;
          prepared = {
            url: input.url,
            query: input.query,
            header: input.header ? { ...input.header } : undefined,
            timeout: input.timeout,
            method: input.method,
            data: input.data,
            responseType: input.responseType,
          };
          if (beforeRequest) prepared = await beforeRequest(prepared);
          prepared.timeout = prepared.timeout ?? defaultTimeout;
        } catch (cause) {
          control.reject(new HttpClientError('config', 'Request preparation failed', { cause }));
          return;
        }
        if (!control.active()) return;
        const network = prepareNetworkOptions(prepared, context);
        const responseType = prepared.responseType ?? 'json';
        const nativeTask = wx.request<string | ArrayBuffer>({
          url: network.url,
          header: network.header,
          timeout: network.timeout,
          method: prepared.method,
          data: prepared.method === 'HEAD' ? undefined : prepared.data,
          dataType: 'text',
          responseType: responseType === 'arraybuffer' ? 'arraybuffer' : 'text',
          success(result) {
            if (!control.active()) return;
            void (async () => {
              const response: HttpResponse<unknown> = {
                data: result.data,
                statusCode: result.statusCode,
                header: result.header,
              };
              checkHttpStatus(response);
              try {
                if (
                  responseType === 'json' &&
                  prepared.method !== 'HEAD' &&
                  result.statusCode !== 204 &&
                  result.statusCode !== 205
                ) {
                  if (typeof result.data !== 'string') {
                    throw new TypeError('Expected JSON response text');
                  }
                  response.data = JSON.parse(result.data) as unknown;
                }
                let data: unknown = response.data;
                if (transformResponse) data = await transformResponse(response);
                if (!control.active()) return;
                if (parse) data = await parse(data);
                control.resolve({
                  data: data as T,
                  statusCode: result.statusCode,
                  header: result.header,
                });
              } catch (cause) {
                control.reject(
                  new HttpClientError('parse', 'Response parsing or transformation failed', {
                    statusCode: result.statusCode,
                    header: result.header,
                    data: result.data,
                    cause,
                  }),
                );
              }
            })().catch((cause: unknown) => control.reject(networkError(cause)));
          },
          fail(cause) {
            control.reject(networkError(cause));
          },
        });
        control.attach(nativeTask);
      }, onError);
    },
    get<T = unknown>(
      url: string,
      extra: Omit<RequestOptions<T>, 'url' | 'method' | 'data'> = {},
    ): AbortableOperation<HttpResponse<T>> {
      return client.request<T>({ ...extra, url, method: 'GET' });
    },
    post<T = unknown>(
      url: string,
      data?: HttpRequestOptions['data'],
      extra: Omit<RequestOptions<T>, 'url' | 'method' | 'data'> = {},
    ): AbortableOperation<HttpResponse<T>> {
      return client.request<T>({ ...extra, url, method: 'POST', data });
    },
    put<T = unknown>(
      url: string,
      data?: HttpRequestOptions['data'],
      extra: Omit<RequestOptions<T>, 'url' | 'method' | 'data'> = {},
    ): AbortableOperation<HttpResponse<T>> {
      return client.request<T>({ ...extra, url, method: 'PUT', data });
    },
    delete<T = unknown>(
      url: string,
      extra: Omit<RequestOptions<T>, 'url' | 'method' | 'data'> = {},
    ): AbortableOperation<HttpResponse<T>> {
      return client.request<T>({ ...extra, url, method: 'DELETE' });
    },
  };
  return client;
}
