import { initializeUpdates, reportAppError } from './utils/lifecycle';
import { relaunch } from './utils/router';

App({
  onLaunch() {
    initializeUpdates();
  },
  onError(message: string) {
    reportAppError('runtime', message);
  },
  onUnhandledRejection(event: WechatMiniprogram.OnUnhandledRejectionListenerResult) {
    reportAppError('unhandled-rejection', event.reason);
  },
  onPageNotFound(result: WechatMiniprogram.App.PageNotFoundOption) {
    reportAppError('page-not-found', result.path);
    // 扫码/分享进入已下线页面时兜底回首页；reLaunch 再失败则交给微信原生兜底页。
    void relaunch('home').catch(() => {});
  },
});
