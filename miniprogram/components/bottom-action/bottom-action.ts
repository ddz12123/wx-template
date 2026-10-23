Component({
  options: {
    styleIsolation: 'isolated',
    pureDataPattern: /^_/,
  },
  externalClasses: ['custom-class', 'content-class'],
  properties: {
    safeAreaBottom: { type: Boolean, value: true },
    // 插槽变化后递增；图片等异步布局变化后调用 refresh()。
    layoutKey: { type: Number, value: 0 },
  },
  data: {
    height: 0,
    _ready: false,
    _queued: false,
    _dirty: false,
  },
  observers: {
    'safeAreaBottom, layoutKey'(): void {
      this.refresh();
    },
  },
  lifetimes: {
    ready(): void {
      this.data._ready = true;
      this.refresh();
    },
    detached(): void {
      this.data._ready = false;
    },
  },
  pageLifetimes: {
    show(): void {
      this.refresh();
    },
    resize(): void {
      this.refresh();
    },
  },
  methods: {
    // 小程序无 ResizeObserver：实测面板高度并撑起占位，避免内容被遮挡。
    // 测量期间再次变化时标脏，测量结束后再补一次，避免漏掉异步图片等布局变化。
    refresh(): void {
      if (!this.data._ready) return;
      if (this.data._queued) {
        this.data._dirty = true;
        return;
      }
      this.data._queued = true;
      this.data._dirty = false;
      wx.nextTick(() => {
        if (!this.data._ready) {
          this.data._queued = false;
          return;
        }
        this.createSelectorQuery()
          .select('.bottom-action__panel')
          .boundingClientRect((rect: WechatMiniprogram.BoundingClientRectCallbackResult) => {
            this.data._queued = false;
            if (!this.data._ready || !rect || !Number.isFinite(rect.height)) return;
            if (rect.height !== this.data.height) {
              this.setData({ height: rect.height });
              this.triggerEvent('resize', { height: rect.height });
            }
            if (this.data._dirty) this.refresh();
          })
          .exec();
      });
    },
  },
});
