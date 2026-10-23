import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  back,
  navigate,
  NavigationError,
  redirect,
  relaunch,
} from '../../miniprogram/utils/router';
import { installWxNavigatorMock, type WxNavigatorMock } from '../wx-mock';

let mock: WxNavigatorMock;

beforeEach(() => {
  mock = installWxNavigatorMock();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('router', () => {
  it('navigate 以 / 开头的完整路径跳转', async () => {
    await navigate('home', { from: 'share', id: 7, flag: true });
    expect(mock.navigateTo.mock.calls[0]?.[0].url).toBe(
      '/pages/index/index?from=share&id=7&flag=true',
    );
  });

  it('query 编码特殊字符并跳过 null/undefined', async () => {
    await navigate('home', { q: 'a b&c', skip: null, gone: undefined });
    expect(mock.navigateTo.mock.calls[0]?.[0].url).toBe('/pages/index/index?q=a%20b%26c');
  });

  it('非有限数字的 query 被拒绝', () => {
    expect(() => navigate('home', { id: Number.NaN })).toThrowError(NavigationError);
    expect(() => navigate('home', { id: Number.POSITIVE_INFINITY })).toThrowError(NavigationError);
  });

  it('redirect 与 relaunch 走对应微信 API', async () => {
    await redirect('home');
    expect(mock.redirectTo.mock.calls[0]?.[0].url).toBe('/pages/index/index');
    await relaunch('home', { reset: 1 });
    expect(mock.reLaunch.mock.calls[0]?.[0].url).toBe('/pages/index/index?reset=1');
    await relaunch('home');
    expect(mock.reLaunch.mock.calls[1]?.[0].url).toBe('/pages/index/index');
  });

  it('back 校验栈深并在栈不足时抛错', async () => {
    mock.stack.push('/pages/second/index');
    await back(1);
    expect(mock.navigateBack.mock.calls[0]?.[0].delta).toBe(1);
    expect(() => back(2)).toThrowError(NavigationError);
    expect(() => back(0)).toThrowError(NavigationError);
  });

  it('微信导航失败时 reject', async () => {
    mock.navigateTo.mockImplementationOnce((option) => {
      option.fail?.({ errMsg: 'navigateTo:fail' } as never);
      return option;
    });
    await expect(navigate('home')).rejects.toMatchObject({ errMsg: 'navigateTo:fail' });
  });
});
