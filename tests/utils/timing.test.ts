import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce, throttle } from '../../miniprogram/utils/timing';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('debounce', () => {
  it('只在静止后执行最后一次调用', () => {
    const calls: number[] = [];
    const debounced = debounce((value: number) => calls.push(value), 100);
    debounced(1);
    debounced(2);
    debounced(3);
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(99);
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(calls).toEqual([3]);
  });

  it('cancel 阻止待执行调用', () => {
    const calls: number[] = [];
    const debounced = debounce((value: number) => calls.push(value), 100);
    debounced(1);
    debounced.cancel();
    vi.advanceTimersByTime(200);
    expect(calls).toEqual([]);
  });

  it('非法等待时间抛 RangeError', () => {
    const callback = (): void => {};
    expect(() => debounce(callback, -1)).toThrowError(RangeError);
    expect(() => debounce(callback, Number.POSITIVE_INFINITY)).toThrowError(RangeError);
  });
});

describe('throttle', () => {
  it('leading 立即执行，trailing 取最新参数', () => {
    const calls: number[] = [];
    const throttled = throttle((value: number) => calls.push(value), 100);
    throttled(1);
    throttled(2);
    throttled(3);
    expect(calls).toEqual([1]);
    vi.advanceTimersByTime(100);
    expect(calls).toEqual([1, 3]);
    vi.advanceTimersByTime(500);
    expect(calls).toEqual([1, 3]);
  });

  it('冷却结束后再次 leading 执行', () => {
    const calls: number[] = [];
    const throttled = throttle((value: number) => calls.push(value), 100);
    throttled(1);
    vi.advanceTimersByTime(100);
    throttled(2);
    expect(calls).toEqual([1, 2]);
  });

  it('cancel 丢弃 pending 调用', () => {
    const calls: number[] = [];
    const throttled = throttle((value: number) => calls.push(value), 100);
    throttled(1);
    throttled(2);
    throttled.cancel();
    vi.advanceTimersByTime(300);
    expect(calls).toEqual([1]);
  });
});
