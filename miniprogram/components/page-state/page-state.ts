export type PageState = 'loading' | 'empty' | 'error' | 'content';

Component({
  options: {
    styleIsolation: 'isolated',
  },
  externalClasses: ['custom-class'],
  properties: {
    state: { type: String, value: 'content' as PageState },
    loadingText: { type: String, value: '加载中' },
    emptyText: { type: String, value: '暂无内容' },
    errorTitle: { type: String, value: '加载失败' },
    errorDescription: { type: String, value: '请稍后重试' },
    retryText: { type: String, value: '重试' },
    // 为 true 时内容常驻、仅 hidden 切换，保留表单状态；默认切 content 才挂载。
    keepAlive: { type: Boolean, value: false },
  },
  methods: {
    onRetry(): void {
      if (this.data.state === 'error') {
        this.triggerEvent('retry');
      }
    },
  },
});
