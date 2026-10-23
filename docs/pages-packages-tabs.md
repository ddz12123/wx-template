# 页面 / 分包 / TabBar 接入说明（纯架构，不含业务）

> 路由真相源是 `miniprogram/config/routes.ts`，页面注册真相源是
> `miniprogram/app.json`。两处必须同步，`utils/router.ts` 只做类型约束。

## 1. 新增普通页面

1. 新建目录 `miniprogram/pages/<name>/`，包含 `index.ts/json/wxml/scss`。
2. 页面 JSON 按需注册 `app-page`（布局容器，不内置导航/鉴权）：

```json
{
  "usingComponents": {
    "app-page": "/components/app-page/app-page"
  }
}
```

3. `app.json.pages` 追加 `pages/<name>/index`。
4. `config/routes.ts` 追加：

```ts
export const routes = {
  home: { path: '/pages/index/index', tabBar: false },
  demo: { path: '/pages/demo/index', tabBar: false },
} as const;
```

## 2. 新增 TabBar 页面

1. 同上新建页面。
2. `app.json` 追加 `tabBar` 配置：

```json
"tabBar": {
  "color": "#666666",
  "selectedColor": "#0052d9",
  "backgroundColor": "#ffffff",
  "borderStyle": "black",
  "list": [
    { "pagePath": "pages/index/index", "text": "首页" },
    { "pagePath": "pages/mine/index", "text": "我的" }
  ]
}
```

3. `routes.ts` 对应路由 `tabBar: true`，`path` 必须与
   `tabBar.list[].pagePath` 指向同一页面（`router` 会统一补前导 `/`）。
4. Tab 路由禁止 `query`：`navigate/redirect` 在类型层拒绝，只能
   `switchTab/relaunch`。

## 3. 新增分包

1. 新建 `miniprogram/package-<name>/pages/...`。
2. `app.json` 追加：

```json
"subpackages": [{ "root": "package-demo/", "pages": ["pages/detail/index"] }]
```

3. `routes.ts` 使用完整包内路径：

```ts
detail: { path: '/package-demo/pages/detail/index', tabBar: false },
```

4. 分包不能放 `tabBar` 页面；分包名即 `root` 前缀，改名需同步三处。
5. 主包只保留 `app-page/page-state/load-more/bottom-action` 四个原语，其他组件按分包就近放。

## 4. 自检清单

- `app.json.pages + routes.ts` 双登记完成。
- Tab 页 `tabBar.list` 与 `routes` 一致。
- 分包路径以 `/<root>/` 开头且与 `app.json.subpackages` 一致。
- `npm run check` 通过。
