export type LoadMoreState = 'idle' | 'loading' | 'finished' | 'error';

Component({
  options: {
    styleIsolation: 'isolated',
  },
  externalClasses: ['custom-class'],
  properties: {
    state: { type: String, value: 'idle' as LoadMoreState },
    idleText: { type: String, value: '' },
    loadingText: { type: String, value: '加载中' },
    finishedText: { type: String, value: '没有更多了' },
    errorText: { type: String, value: '加载失败' },
    retryText: { type: String, value: '重试' },
  },
  methods: {
    onRetry(): void {
      if (this.data.state === 'error') {
        this.triggerEvent('retry');
      }
    },
  },
});
