export interface ToastOptions {
  icon?: 'success' | 'error' | 'loading' | 'none';
  duration?: number;
  mask?: boolean;
}

export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
}

export interface LoadingOptions {
  mask?: boolean;
}

export type ReleaseLoading = () => void;

export function toast(title: string, options: ToastOptions = {}): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    wx.showToast({
      title,
      icon: options.icon ?? 'none',
      duration: options.duration ?? 1500,
      mask: options.mask ?? false,
      success: () => resolve(),
      fail: reject,
    });
  });
}

export function confirm(content: string, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    wx.showModal({
      title: options.title ?? '提示',
      content,
      showCancel: true,
      confirmText: options.confirmText ?? '确定',
      cancelText: options.cancelText ?? '取消',
      success: (result) => resolve(result.confirm),
      fail: reject,
    });
  });
}

interface LoadingEntry {
  title: string;
  mask: boolean;
}

const activeLoadings = new Map<symbol, LoadingEntry>();

/** Latest acquisition controls the display; release in finally. Use this helper for all loaders. */
export function loading(title = '加载中', options: LoadingOptions = {}): ReleaseLoading {
  const token = Symbol('loading');
  const entry = { title, mask: options.mask ?? true };
  activeLoadings.set(token, entry);
  try {
    wx.showLoading(entry);
  } catch (error: unknown) {
    activeLoadings.delete(token);
    throw error;
  }

  let released = false;
  return (): void => {
    if (released) return;
    released = true;
    let latest: symbol | undefined;
    for (const key of activeLoadings.keys()) latest = key;
    activeLoadings.delete(token);
    if (latest !== token) return;
    let remaining: LoadingEntry | undefined;
    for (const value of activeLoadings.values()) remaining = value;
    if (remaining === undefined) wx.hideLoading();
    else wx.showLoading(remaining);
  };
}
