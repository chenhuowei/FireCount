# 小伙记账 · FirCount

对 **口袋记账**（`com.qeeniao.mobile.kdjz` v4.5.0）APK 静态逆向分析后，在浏览器端 1:1 复刻其核心记账功能的单页应用，并打包为 Android APK。

> 逆向分析过程与证据 → 见 [ANALYSIS.md](ANALYSIS.md) · APK 构建指南 → 见 [android/BUILD.md](android/BUILD.md)

## 项目信息

| 项 | 值 |
|---|---|
| 项目代号 | FirCount |
| 应用名 | 小伙记账 |
| Android 包名 | `com.fircount` |
| 当前版本 | v1.3（versionCode 4） |
| 技术栈 | 原生 JavaScript SPA（零框架、零构建）+ WebView 壳（单 Activity） |
| 环境 | minSdk 24 / targetSdk 34 |
| 网络权限 | `INTERNET`（仅 WebDAV 同步使用）、`USE_FINGERPRINT` |
| 第三方库 | SheetJS mini 0.20.3（XLSX 解析，Apache-2.0）——唯一的运行时依赖 |

## 运行方式

零依赖、无需构建，任选其一：

```bash
# 方式一：直接双击 index.html（file:// 即可运行）

# 方式二：本地服务（推荐，避免个别浏览器对 file:// 的限制）
npx http-server <本目录> -p 8765 -c-1
# 打开 http://127.0.0.1:8765
```

**Android APK**：见 [android/BUILD.md](android/BUILD.md)（一键构建脚本 + 工具下载说明）。产物 `小伙记账-v*.apk`。

APK 内数据持久化使用**原生 SQLite**（经 JS 桥，无 localStorage 容量限制）；支持**边缘滑动/返回键逐级返回**（关弹层 → 回上级 → 退出）；文件选择器直拉系统选择器。

首次打开为空账本，可点击"**载入演示数据**"生成近 3 个月的示例账单与预算，直接体验全部功能。

> ⚠️ 声明：本项目为个人学习研究用途的逆向分析复刻，未使用原应用的任何代码或资源；请勿用于商业用途。

## 功能清单（↔ 原 App 证据）

### 基础记账

| 功能 | 说明 | 原App证据 |
|---|---|---|
| 记一笔 · 三模式 | 支出 / 收入 / 转账 切换 | `add_new_record.xml`：jiyibi_btn_zhichu/shouru/zhuanzhang |
| 计算器键盘 | 4×4 键盘，公式实时计算 | `keyboard_number.xml` 完整复刻 |
| 分类宫格 | 多页滑动 + 指示点 + 选中高亮 + 添加自定义分类 | `jyb_gridview_viewpager` |
| 默认分类 | 支出 17 项 + 收入 9 项（餐饮/购物/交通/工资/红包…） | drawable `icon_zhichu_type_*` / `icon_shouru_type_*` |
| 分类图标 | 55+ 手绘线性 SVG（Tabler 风格，免费商用），按分类色着色；自定义分类可选图标或 emoji | 自绘（规避原 App 美术版权） |
| 账单明细 | 按天分组（今天/昨天/日期+周几）、日小计、月收支结余、账本切换、账户筛选 | `records_line_layout.xml` |
| 账单操作 | 点击编辑、左滑呼出编辑/删除、删除二次确认 | `bill_list_btn_bianji/shanchu` |
| 多账本 | 新建/切换/重命名/删除（账单随账本隔离） | `Books` 模块 |
| 账户钱包 | 现金/储蓄卡/信用卡/网络账户/虚拟卡/投资/负债 7 类，净资产总览 | `Account` 模块 |
| 信用卡 | 额度 / 账单日 / 还款日 / 欠款统计 | `credit_add_activity.xml` |
| 账户转账 | 转出/转入账户选择，余额双向变动 | `AccountTransferActivity` |
| 报表统计 | 分类环形饼图+图例、近6月收支趋势折线、分类排行、KPI（笔数/最高单笔/记账天数） | `Report` 模块 |
| 预算 | 月总预算 + 分类预算；日/周/月三个进度环 + 日均可用 | `budget_v3.xml` 三环 |
| 日历视图 | 月历每日收支标记，点日查看当日账单 | `CalendarRecord` 模块 |
| 搜索 | 备注/分类/账户/金额全文搜索 | `SearchRecordActivity` |
| 成员记账 | 多成员管理，记一笔时选择 | `jiyibi_btn_chenyuan` |
| 多币种 | ¥ $ € £ ₩ 符号切换 | `CurrencySelectActivity` |
| 深色模式 | 全套深色变量主题 | `assets/Default_deep/config.json` |
| 标签记账 | 可复用标签：多选、新增、删除（自动从账单剥离），账单显示 #标签，可按标签搜索 | `RecordTagDetailsAtivity` |
| 账单附件 | 最多 3 张图片（自动压缩至 ~720px），缩略图、全屏查看、编辑可删 | `modules.album.*` |

### 数据导入导出

| 功能 | 说明 |
|---|---|
| CSV 导出 | 当前账本，Excel 可直接打开（UTF-8 BOM） |
| JSON 完整备份导出 | 全部账本/账户/预算/设置 |
| **CSV 导入** | 支持**口袋记账导出格式**（时间/账目分类/金额）与本应用自身格式；分类名自动映射+自动建分类（带图标）；合并去重或覆盖当前账本；导入前预览统计 |
| **XLSX 导入** | SheetJS 解析，自动按 ZIP 魔数识别（不依赖文件名扩展，兼容安卓文件选择器）；多工作表自动选行数最多的表；Excel 序列日期自动转换 |
| 导入诊断 | 失败时 toast 显示文件名/字节数/首行内容，便于定位问题 |

### 应用锁（PIN + 指纹）

- 4~6 位 PIN，SHA-256 加盐存储，纯 JS 实现无环境依赖
- **指纹快速解锁**（APK）：`FingerprintManager` 零依赖实现，锁屏一键指纹验证；未录入/失败自动回退 PIN
- 忘记 PIN → 安全问题验证 → 重置（数据保留）
- 自动锁定策略：启动必验 + 切后台按配置时长重验（立即/1分钟/5分钟/仅启动时）

### 云同步（坚果云 WebDAV）

| 能力 | 说明 |
|---|---|
| 服务商 | 预设**坚果云** / 123网盘 / 自定义（仅支持 https） |
| 测试连接 | HEAD 标准方法验证连通+凭证，失败分场景提示（401 应用密码 / 403 设备并发或流量超限 / 网络不通） |
| 手动备份 | 时间戳命名，`latest.json` 固定指向最近一次 |
| **自动备份** | ① 记账后 N 秒自动推送（1~3600 秒可配置，默认 3 秒，连续记账去抖合并）② 每 6 小时检查补推 |
| 恢复 | 云端备份列表（PROPFIND，501 时降级 GET 解析），一键覆盖恢复（二次确认） |
| 版本管理 | 保留 N 份滚动清理（5/10/20 可配） |
| 兼容性保障 | 原生层 `HttpURLConnection` 白名单不含 WebDAV 方法 → 反射注入 method；回调经严格 JSON 转义 |

> 仅 APK 版可用（浏览器 CORS 限制）。坚果云需在网页版「账户信息 → 安全选项」生成**应用密码**（非登录密码）。

### 桌面快捷方式

长按应用图标：「**记一笔**」（受应用锁保护，解锁后自动打开）、「**立即同步备份**」（未配置坚果云时引导配置）。

## 目录结构

```
firecount/
├── index.html              # 入口，按依赖顺序加载全部脚本
├── css/style.css           # 全部样式（含深色模式变量主题、WebDAV 密码框）
├── js/
│   ├── icons.js            # 55+ 分类/账户线性 SVG 图标库 + IconUI 统一渲染（emoji 兼容回退）
│   ├── xlsx.mini.min.js    # SheetJS mini 0.20.3（XLSX 导入解析）
│   ├── data.js             # 静态数据：默认分类/账户类型/币种/图标选择器
│   ├── store.js            # 数据层：状态管理、SQLite/localStorage 持久化、导入导出引擎
│   ├── ui.js               # UI 基础：弹层/toast/确认框/SVG 图标/密码可见切换
│   ├── lock.js             # 应用锁：PIN(SHA-256) + 指纹 + 安全问题找回
│   ├── webdav.js           # WebDAV：坚果云同步、测试连接、自动备份策略
│   ├── charts.js           # 纯 JS 图表：饼图/折线/进度环
│   ├── views-*.js          # 页面：账单/记一笔/报表/钱包/更多
│   └── app.js              # 路由、底部 Tab、页面栈、快捷方式分发
├── android/
│   ├── BUILD.md            # 构建指南
│   ├── build.sh            # 一键构建（aapt2/d8/zipalign/apksigner）
│   └── app/
│       ├── AndroidManifest.xml
│       ├── res/xml/shortcuts.xml   # 长按图标快捷方式
│       └── java/com/fircount/MainActivity.java  # WebView 壳（~640 行）
│           · SQLite 桥（dbLoad/dbSave/dbClear，异步单线程写入队列）
│           · 指纹认证桥（FingerprintManager + CancellationSignal）
│           · WebDAV HTTP 代理（反射支持 PROPFIND/MKCOL，标准 UA）
│           · 快捷方式分发（延迟到页面加载完成后执行）
└── ANALYSIS.md             # 口袋记账逆向分析报告（证据链）
```

## 数据安全

- **纯本地运行**：所有数据存于设备本地 SQLite（APK）或 localStorage（浏览器）
- 云同步仅在你主动配置坚果云后启用，凭证仅存本地
- 卸载 APK 不会删除「下载」目录里的导出备份
- 建议开启自动备份（记账后 N 秒推送坚果云），换机/重装可从云端一键恢复

## 版本历史（要点）

- **v1.3**：包名改为 `com.fircount`；自动云备份（记账后 N 秒可配）；移除周期记账；XLSX/CSV 导入（口袋记账格式）；应用锁 PIN+指纹；坚果云 WebDAV 全链路修复（回调引号/方法白名单反射/501 降级）；分类线性图标体系
- **v1.2**：口袋记账功能复刻完整版（记账/账本/账户/报表/预算/搜索/标签/附件/深色模式）
