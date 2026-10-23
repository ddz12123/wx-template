Component({
  options: {
    styleIsolation: 'isolated',
  },
  externalClasses: ['custom-class', 'content-class'],
  properties: {
    title: { type: String, value: '' },
    showNavbar: { type: Boolean, value: true },
    showTitle: { type: Boolean, value: true },
    showBack: { type: Boolean, value: false },
    fixed: { type: Boolean, value: false },
    safeAreaBottom: { type: Boolean, value: true },
  },
  methods: {
    // 返回由页面决定：监听 back 事件后调用 router.back() 或自定义逻辑。
    onBack(): void {
      this.triggerEvent('back');
    },
  },
});
