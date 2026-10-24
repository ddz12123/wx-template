# wx-template

微信小程序空白模板：TypeScript strict + TDesign，不含任何业务实现，只提供骨架。

## 技术栈

- 原生小程序（WebView 渲染，glass-easel 组件框架）
- TypeScript strict（`miniprogram-api-typings@5` 官方类型）
- SCSS + CSS 变量设计令牌（`tokens.scss` 单点对接 TDesign 主题变量）
- TDesign 组件库（按需 JSON 注册）
- ESLint（typescript-eslint flat config）+ Prettier（含 WXML）
- Vitest 单元测试（纯逻辑模块全覆盖，wx API 用内存替身，不依赖开发者工具）
- husky + lint-staged（提交前自动格式化；`npm run check` 做全量校验）
- GitHub Actions CI（手动触发：Actions 页面点 Run workflow，跑 `npm run check`）

## 快速开始

1. 安装 Node.js `>=22.22.1`（ESLint 10 / lint-staged 17 的最低要求）
2. `npm install`（`prepare` 会自动安装 husky 钩子）
3. 将本目录导入微信开发者工具
4. 工具菜单 → 构建 npm（生成 `miniprogram/miniprogram_npm`）
5. 复制 `miniprogram/config/env.example` 的地址，填入 `miniprogram/config/env.ts`
6. 小程序后台配置 request/uploadFile/downloadFile 合法域名
7. 将 `project.config.json` 的 `appid` 替换为你自己的 AppID（模板内为占位）

> `project.private.config.json` 为本地文件，不入库，团队各自本地生成，详见 `project.private.config.example.json`。

## 命令

```bash
npm run check       # typecheck + eslint + prettier + vitest（提交前 / CI 全量）
npm run typecheck   # tsc 双 project：tsconfig.json（小程序）+ tsconfig.test.json（测试）
npm run lint
npm run lint:fix
npm run format        # 全量格式化（含 WXML）
npm run format:check  # 只检查不写入
npm run test          # vitest 单次运行
npm run test:watch    # vitest watch 模式（本地开发）
```

提交时 husky 会执行 `lint-staged`：暂存文件先 Prettier 格式化，`miniprogram/**/*.ts` 再跑 ESLint 自动修复。CI 或提交前完整检查仍以 `npm run check` 为准。

## 目录结构

```
miniprogram/
├─ config/          # 环境地址、路由表（纯配置）
│  ├─ env.ts        # dev/trial/release 按 envVersion 区分
│  ├─ env.example   # 地址清单示例，不含密钥
│  └─ routes.ts     # 路由表：{path, tabBar}
├─ services/        # 网络层：只认 HTTPS，不预设业务协议
│  ├─ request.ts    # createHttpClient{request,get,post,put,delete}；默认用微信超时
│  ├─ transfer.ts   # uploadFile/downloadFile
│  ├─ errors.ts     # config/network/timeout/abort/http/parse
│  └─ helpers.ts    # 一次性 settle/取消状态机 + URL/查询编码
├─ utils/           # 通用方法（相互零依赖，仅 router 依赖 config/routes）
│  ├─ storage.ts    # createStorage：命名空间/版本/TTL
│  ├─ router.ts     # 类型约束导航，path 统一补前导 /
│  ├─ feedback.ts   # toast / confirm / 并发安全 loading
│  ├─ timing.ts     # debounce / throttle（带 cancel）
│  ├─ date.ts       # formatDate
│  ├─ system.ts     # 窗口/设备/胶囊/安全区
│  ├─ events.ts     # 类型安全事件总线
│  └─ lifecycle.ts  # 版本更新提示 + 全局错误入口（setErrorReporter）
├─ components/      # 公共组件：不发请求、不读用户信息、不内置路由跳转
│  ├─ app-page/     # 页面容器：back 事件由页面处理
│  ├─ page-state/   # loading/empty/error/content + keepAlive 可选保活
│  ├─ load-more/    # idle/loading/finished/error（idle 默认不占位）
│  └─ bottom-action/# 底部操作栏：插槽变化后调 refresh() 或递增 layout-key
├─ pages/index/     # 模板自检首页：验证 page-state + 基础渲染
└─ styles/          # tokens.scss（设计令牌+z-index）、utilities.scss（工具类）
tests/              # Vitest 单元测试（目录结构与 miniprogram 镜像）
├─ wx-mock.ts       # wx API 最小替身：storage / request / 导航
├─ services/        # request、helpers、errors 的行为测试
└─ utils/           # storage、router、timing、date、events 的行为测试
docs/
└─ pages-packages-tabs.md # 新增页面/分包/TabBar 操作手册
.github/workflows/ci.yml  # CI：手动触发跑 npm run check
.husky/
└─ pre-commit       # 提交前由 lint-staged 格式化暂存文件
```

## 约定

- **网络实例**：业务侧按需 `createHttpClient({ baseUrl, timeout, beforeRequest })`，
  鉴权头与响应适配写在业务侧；`services/` 不预设 `{code,data,message}`、
  不自动跳登录、不重试。相对路径需要 `baseUrl`，绝对 HTTPS URL 可直调。
  快捷方法 `get/post/put/delete`；微信 `wx.request` 不支持 PATCH。
- **超时**：默认不设（用微信默认），需要时实例 `timeout` 或单请求 `timeout` 显式传。
- **本地调试**：模板只接受 `https`；本地 `http` 调试请在开发者工具中关闭域名校验，仅限开发。
- **组件注册**：TDesign 组件在页面/组件 JSON 里按需注册，改完后重新构建 npm。
- **主题**：改 `styles/tokens.scss` 的 `--app-*` 变量即可，TDesign 变量已映射，不要散落覆盖组件样式。
- **错误上报**：`utils/lifecycle.ts` 的 `setErrorReporter` 是监控接入口；默认不上报网络。
- **新增页面**：见 `docs/pages-packages-tabs.md`：`app.json` 登记 → `config/routes.ts` 加路由 → 页面 JSON 引 `app-page`。`query` 中 `undefined`/`null` 键会被省略。
- **单元测试**：`tests/` 目录与 `miniprogram/` 镜像；wx API 用
  `tests/wx-mock.ts` 的内存替身，不依赖开发者工具。改 `services/`、`utils/`
  或新增纯逻辑模块时同步补测试，`npm run check` 会一并跑。
  测试类型走独立的 `tsconfig.test.json`（skipLibCheck，不引入 node 全局），
  小程序源码的类型环境保持纯净。
- **样式分层**：组件内部样式隔离；跨页面样式进 `utilities.scss`；插槽内容样式归页面。
- **代码风格**：Prettier 统一 JS/TS/JSON/MD/SCSS/WXML；WXML 由 `@tofrankie/prettier-plugin-wxml` 处理，提交前自动格式化。

## 已内置的平台配置

- `app.json`：无 `style: v2`、显式 `renderer: webview`、`componentFramework: glass-easel` + `glassEaselWebview`、`lazyCodeLoading: requiredComponents`；`tabBar/subpackages` 示例见文档，默认不启用。
- `project.config.json`：npm 构建映射、es6/enhance/minified；`appid` 为占位；`libVersion` 为 `3.12.0`（WebView 启用 glass-easel 至少需要基础库 `3.8.12`）。
- 版本更新检测（`onUpdateReady` 提示重启，不强制）
- `onPageNotFound` 兜底：扫码/分享进入已下线页面时 relaunch 回首页
- 提交前钩子：husky + lint-staged（暂存文件格式化 + 小程序 TS 自动 lint 修复）

## 已知边界

- 底栏 `bottom-action` 高度实测：插槽内容异步变化（如图片加载）在图片 `bindload` 后调 `selectComponent('#id').refresh()` 或递增 `layout-key`。
- `page-state` 默认切 `content` 才挂载 slot；需要保表单状态时开 `keep-alive`（用 `hidden` 保活，注意隐藏节点仍在树中）。
- `app-page` 的返回只触发 `back` 事件，页面监听后自行 `router.back()` 或自定义。
