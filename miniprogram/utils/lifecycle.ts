type ErrorSource = 'runtime' | 'unhandled-rejection' | 'page-not-found';
type ErrorReporter = (source: ErrorSource, error: unknown) => void;

let reporter: ErrorReporter | undefined;

/** 默认不输出敏感异常正文、不上报网络；需要监控时显式注入脱敏后的处理器。 */
export function setErrorReporter(next: ErrorReporter | undefined): void {
  reporter = next;
}

export function reportAppError(source: ErrorSource, error: unknown): void {
  if (!reporter) {
    console.error(`[app] ${source}`);
    return;
  }
  try {
    reporter(source, error);
  } catch {
    console.error('[app] error reporter failed');
  }
}

let updatesInitialized = false;

export function initializeUpdates(): void {
  if (updatesInitialized || !wx.canIUse('getUpdateManager')) return;
  updatesInitialized = true;
  const manager = wx.getUpdateManager();
  manager.onUpdateReady(() => {
    wx.showModal({
      title: '更新提示',
      content: '新版本已准备好，是否重启应用？',
      confirmText: '立即重启',
      cancelText: '稍后',
      success(result) {
        if (result.confirm) manager.applyUpdate();
      },
    });
  });
  manager.onUpdateFailed(() => {
    wx.showModal({
      title: '更新未完成',
      content: '新版本下载失败，请稍后重新打开小程序。',
      showCancel: false,
    });
  });
}
