import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../../miniprogram/utils/events';

interface Events {
  ping: number;
  pong: string;
}

describe('createEventBus', () => {
  it('on/emit/off 基础流程', () => {
    const bus = createEventBus<Events>();
    const listener = vi.fn();
    const off = bus.on('ping', listener);
    bus.emit('ping', 1);
    expect(listener).toHaveBeenCalledWith(1);
    off();
    bus.emit('ping', 2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('off 移除该监听器的全部注册', () => {
    const bus = createEventBus<Events>();
    const listener = vi.fn();
    bus.on('ping', listener);
    bus.on('ping', listener);
    bus.emit('ping', 1);
    expect(listener).toHaveBeenCalledTimes(2);
    bus.off('ping', listener);
    bus.emit('ping', 2);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('不同事件互不干扰，emit 无订阅者为 no-op', () => {
    const bus = createEventBus<Events>();
    const pongOnly = vi.fn();
    bus.on('pong', pongOnly);
    expect(() => bus.emit('ping', 1)).not.toThrow();
    expect(pongOnly).not.toHaveBeenCalled();
  });

  it('emit 期间取消订阅立即生效，新增订阅下一轮生效', () => {
    const bus = createEventBus<Events>();
    const calls: string[] = [];
    const offFirst = bus.on('ping', () => {
      calls.push('first');
      offFirst();
      bus.on('ping', () => calls.push('second'));
    });
    bus.emit('ping', 1);
    expect(calls).toEqual(['first']);
    bus.emit('ping', 2);
    expect(calls).toEqual(['first', 'second']);
  });

  it('监听器异常向上传播并中断本次 emit 的后续监听器', () => {
    const bus = createEventBus<Events>();
    const after = vi.fn();
    bus.on('ping', () => {
      throw new Error('boom');
    });
    bus.on('ping', after);
    expect(() => bus.emit('ping', 1)).toThrowError('boom');
    expect(after).not.toHaveBeenCalled();
  });

  it('dispose 后 on 抛错、emit 静默', () => {
    const bus = createEventBus<Events>();
    bus.dispose();
    expect(() => bus.on('ping', () => {})).toThrowError();
    expect(() => bus.emit('ping', 1)).not.toThrow();
  });
});
