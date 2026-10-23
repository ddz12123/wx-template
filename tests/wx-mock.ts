import { vi } from 'vitest';

/**
 * wx API 的最小可测替身：每个工厂只 stub 当前被测模块用到的 API，
 * 未覆盖的调用会以 undefined 形式暴露，帮助测试及时暴露遗漏。
 */

export interface WxStorageMock {
  store: Map<string, unknown>;
}

/** 内存版同步存储；keys 快照由 getStorageInfoSync 返回。 */
export function installWxStorageMock(): WxStorageMock {
  const store = new Map<string, unknown>();
  vi.stubGlobal('wx', {
    getStorageSync: (key: string): unknown => store.get(key),
    setStorageSync: (key: string, value: unknown): void => {
      store.set(key, value);
    },
    removeStorageSync: (key: string): void => {
      store.delete(key);
    },
    getStorageInfoSync: (): { keys: string[] } => ({ keys: Array.from(store.keys()) }),
  } as unknown as typeof wx);
  return { store };
}

export interface WxRequestMock {
  /** 已捕获的 wx.request 调用，按发起顺序排列。 */
  requests: WechatMiniprogram.RequestOption[];
  /** 模拟微信 success 回调；data 为响应体文本。 */
  respond(index: number, result: { data?: unknown; statusCode: number }): void;
  /** 模拟微信 fail 回调。 */
  fail(index: number, errMsg: string): void;
  /** 第 index 个请求的底层 task 是否收到 abort()。 */
  aborted(index: number): boolean;
}

export function installWxRequestMock(): WxRequestMock {
  const requests: WechatMiniprogram.RequestOption[] = [];
  const abortSpies: Array<ReturnType<typeof vi.fn>> = [];
  vi.stubGlobal('wx', {
    request(option: WechatMiniprogram.RequestOption): WechatMiniprogram.RequestTask {
      const abort = vi.fn();
      requests.push(option);
      abortSpies.push(abort);
      return {
        abort: () => abort(),
        onHeadersReceived: () => {},
        offHeadersReceived: () => {},
        onChunkReceived: () => {},
        offChunkReceived: () => {},
      };
    },
  } as unknown as typeof wx);
  return {
    requests,
    respond(index, result) {
      const option = requests[index];
      if (!option?.success) return;
      option.success({
        data: (result.data ?? '') as never,
        statusCode: result.statusCode,
        header: {} as never,
        cookies: [],
        exception: {},
        profile: {},
        errMsg: 'request:ok',
      } as unknown as WechatMiniprogram.RequestSuccessCallbackResult);
    },
    fail(index, errMsg) {
      const option = requests[index];
      if (!option?.fail) return;
      option.fail({ errMsg } as unknown as WechatMiniprogram.RequestFailCallbackErr);
    },
    aborted(index) {
      return (abortSpies[index]?.mock.calls.length ?? 0) > 0;
    },
  };
}

export interface WxNavigatorMock {
  navigateTo: ReturnType<typeof vi.fn>;
  redirectTo: ReturnType<typeof vi.fn>;
  reLaunch: ReturnType<typeof vi.fn>;
  switchTab: ReturnType<typeof vi.fn>;
  navigateBack: ReturnType<typeof vi.fn>;
  /** 模拟页面栈，back() 的栈深校验以此为准。 */
  stack: string[];
}

/** 所有导航调用立即 success；需要失败场景时直接对 mock.calls 断言或重写实现。 */
export function installWxNavigatorMock(
  initialStack: string[] = ['/pages/index/index'],
): WxNavigatorMock {
  // 参数用 never：任何具体回调类型都逆变兼容，可直接以 as never 触发 success。
  const succeed = <T extends { success?: (res: never) => void }>(option: T): T => {
    option.success?.({} as never);
    return option;
  };
  const navigateTo = vi.fn((option: WechatMiniprogram.NavigateToOption) => succeed(option));
  const redirectTo = vi.fn((option: WechatMiniprogram.RedirectToOption) => succeed(option));
  const reLaunch = vi.fn((option: WechatMiniprogram.ReLaunchOption) => succeed(option));
  const switchTab = vi.fn((option: WechatMiniprogram.SwitchTabOption) => succeed(option));
  const navigateBack = vi.fn((option: WechatMiniprogram.NavigateBackOption) => succeed(option));
  const stack = [...initialStack];
  vi.stubGlobal('wx', {
    navigateTo,
    redirectTo,
    reLaunch,
    switchTab,
    navigateBack,
  } as unknown as typeof wx);
  type FakePage = WechatMiniprogram.Page.Instance<Record<string, unknown>, Record<string, unknown>>;
  vi.stubGlobal('getCurrentPages', () => stack.map(() => ({}) as unknown as FakePage));
  return { navigateTo, redirectTo, reLaunch, switchTab, navigateBack, stack };
}

/** 刷新 request.ts 内部 async 回调链的全部微任务。 */
export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
