# 自动化测试

零依赖测试套件（除 jsdom），覆盖静态审查、核心逻辑、UI 交互、APK 环境与资源校验。

## 运行

```bash
npm install          # 首次：安装 jsdom（仅测试用）
npm test             # 全量：静态审查 + 4 套测试，共 132 项
```

单独运行：

```bash
npm run test:static   # 静态审查：缺失方法/图标/死代码/调试残留
npm run test:core     # 核心逻辑：数据层/记账/导入导出/统计（35 项）
npm run test:ui       # UI 交互：页面/Tab/快捷条/选择器/清空/安全（47 项）
npm run test:apk      # APK 环境：SQLite/指纹/WebDAV/自动备份（30 项）
npm run test:assets   # 资源与样式：文件/图标/CSS/主题（20 项）
```

## 结构

```
tests/
├── run-all.js        # 总入口，依次执行全部套件
├── harness.js        # jsdom 环境 + 迷你断言框架
├── static-audit.js   # 静态代码审查
├── 01-core.js        # 核心逻辑
├── 02-ui.js          # UI 交互 + 安全边界
├── 03-apk.js         # APK 环境（mock AndroidBridge）
├── 04-assets.js      # 资源与样式
└── serve.js          # 本地预览服务器（npm run serve）
```

## harness 说明

用 **jsdom** 加载真实 `index.html`，通过注入 `<script>` 标签还原浏览器全局词法作用域（顶层 `const` 才能共享），并桥接导出 `window.__T`：

```js
const { createEnv, suite, test, eq, ok } = require('./harness');
const { window, T } = createEnv({ android: true });  // android:true 启用原生桥 mock
const { Store: S, App } = T;
```

**已 stub 的浏览器能力**（jsdom 不提供）：Canvas 2D、`clientWidth/offsetWidth`、`scrollTo`、`requestAnimationFrame`。

**原生桥 mock**（`android: true`）：
- `dbLoad/dbSave/dbClear` → 内存对象，可断言落库内容
- `biometricAvailable/showBiometric` → 可控指纹回调
- `webdavRequest` → 可注入 `webdavHandler(method, url)` 自定义响应，用于测 401/403/501 降级等场景

**用例隔离**：`onCleanup()` 在每个 `test()` 前清空 `#sheetHost/#modalHost/#toastHost`（弹层 DOM 有 240ms 延迟移除，不清理会串用例）。

## 已覆盖的回归点

测试中固化了历史 Bug，防止复发：

| Bug | 覆盖用例 |
|---|---|
| `index.html` 漏引 `lock.js`/`webdav.js` 致功能失效 | 资源完整性 |
| `icons.js` 晚于 `data.js` 加载导致白屏 | 加载顺序 |
| WebDAV 回调 JS 引号缺失致请求无响应 | WebDAV 套件 |
| `PROPFIND/MKCOL` 被 `HttpURLConnection` 白名单拒绝 | 测试连接用 HEAD |
| `PROPFIND` 返回 501 未降级 | 降级 GET 解析 |
| 转账记录图标空白（`IconUI.svg("swap")` 不存在） | 账单页图标 |
| 左右箭头图标方向颠倒 | 图标方向 |
| Excel 序列日期未转换（`parseLine` 提前转字符串） | 导入 XLSX |
| 报表除零产生 NaN（0 元账单） | 安全边界 |
| 附件无法查看/删除 | 附件弹层 |
| 移除周期记账残留 `+ +` 致 NaN | 页面渲染无 NaN |
