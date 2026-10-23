import { describe, expect, it } from 'vitest';
import { formatDate } from '../../miniprogram/utils/date';

describe('formatDate', () => {
  it('完整格式 YYYY-MM-DD HH:mm:ss', () => {
    expect(formatDate(new Date(2026, 0, 2, 3, 4, 5))).toBe('2026-01-02 03:04:05');
  });

  it('仅日期与仅时间格式', () => {
    const input = new Date(2026, 11, 31, 23, 59, 59);
    expect(formatDate(input, 'YYYY-MM-DD')).toBe('2026-12-31');
    expect(formatDate(input, 'HH:mm:ss')).toBe('23:59:59');
  });

  it('毫秒时间戳与 Date 等价', () => {
    const date = new Date(2026, 5, 15, 10, 30, 0);
    expect(formatDate(date.getTime())).toBe(formatDate(date));
  });

  it('年份补齐四位（0-99 需 setFullYear 绕过 1900 映射）', () => {
    const input = new Date(2026, 0, 2, 3, 4, 5);
    input.setFullYear(5, 0, 1);
    expect(formatDate(input, 'YYYY-MM-DD')).toBe('0005-01-01');
  });

  it('非法输入抛错', () => {
    expect(() => formatDate(Number.NaN)).toThrowError(RangeError);
    expect(() => formatDate(new Date('invalid'))).toThrowError(RangeError);
    expect(() => formatDate('2026-01-01' as unknown as Date)).toThrowError(TypeError);
  });
});
