Page({
  data: {
    state: 'content' as 'loading' | 'empty' | 'error' | 'content',
    now: '',
  },
  onLoad() {
    this.setData({ now: new Date().toLocaleString() });
  },
  onRetry() {
    this.setData({ state: 'content' });
  },
});
