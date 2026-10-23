export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface SystemSnapshot {
  window: WechatMiniprogram.WindowInfo;
  device: WechatMiniprogram.DeviceInfo;
  menuButton: WechatMiniprogram.ClientRect;
  /** Screen coordinates, as returned by WeChat. Absent on unsupported devices. */
  safeArea: WechatMiniprogram.WindowInfo['safeArea'];
  /** Safe-area overlap with the current window, in pixels. */
  safeAreaInsets: SafeAreaInsets;
}

/** Read on demand or from a page's onResize; orientation-dependent values are never cached. */
export function getSystemSnapshot(): SystemSnapshot {
  const window = wx.getWindowInfo();
  const device = wx.getDeviceInfo();
  const menuButton = wx.getMenuButtonBoundingClientRect();
  const safeArea = window.safeArea;
  const clamp = (value: number, max: number): number => Math.min(max, Math.max(0, value));
  const safeAreaInsets: SafeAreaInsets =
    safeArea === undefined
      ? { top: 0, right: 0, bottom: 0, left: 0 }
      : {
          top: clamp(safeArea.top - window.screenTop, window.windowHeight),
          right: clamp(window.windowWidth - safeArea.right, window.windowWidth),
          bottom: clamp(
            window.screenTop + window.windowHeight - safeArea.bottom,
            window.windowHeight,
          ),
          left: clamp(safeArea.left, window.windowWidth),
        };
  return { window, device, menuButton, safeArea, safeAreaInsets };
}
