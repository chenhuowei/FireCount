# 小伙记账 · 功能复刻版

对 **口袋记账**（`com.qeeniao.mobile.kdjz` v4.5.0）APK 进行静态逆向分析后，在浏览器端 1:1 复刻其核心记账功能的单页应用，可打包为 Android APK。

> 逆向分析过程与证据 → 见 [ANALYSIS.md](ANALYSIS.md) · 自动化测试报告 → 见 [TEST_REPORT.md](TEST_REPORT.md)

## 运行方式

零依赖、无需构建，任选其一：

```bash
# 方式一：直接双击打开 index.html（file:// 即可运行）

# 方式二：本地服务（推荐，避免个别浏览器对 file:// 的限制）
npx http-server <本目录> -p 8765 -c-1
# 打开 http://127.0.0.1:8765
```

**Android APK**：见 [android/BUILD.md](android/BUILD.md)（一键构建脚本 + 工具下载说明）。当前产物 v1.2（建议挂到 GitHub Releases，不入库）。
APK 内数据持久化使用**原生 SQLite**（经 JS 桥，无 localStorage 容量限制）；支持**边缘滑动/返回键逐级返回**（关弹层 → 回上级 → 退出）；文件选择器直拉系统选择器。

首次打开为空账本，可点击"**载入演示数据**"生成近 3 个月的示例账单、预算与周期记账，直接体验全部功能。纯本地运行、零联网权限。

> ⚠️ 声明：本项目为个人学习研究用途的逆向分析复刻，未使用原应用的任何代码或资源；请勿用于商业用途。

## 复刻功能清单（↔ 原 App 证据）

| 复刻功能 | 说明 | 原App证据 |
|---|---|---|
| 记一笔 · 三模式 | 支出 / 收入 / 转账 切换 | `add_new_record.xml`：jiyibi_btn_zhichu/shouru/zhuanzhang |
| 计算器键盘 | 4×4 键盘 `7 8 9 ⌫ / 4 5 6 + / 1 2 3 − / C 0 . OK`，公式实时计算 | `keyboard_number.xml` 完整复刻 |
| 分类宫格 | 多页滑动 + 指示点 + 选中高亮 + 添加自定义分类 | `jyb_gridview_viewpager` |
| 默认分类 | 支出 17 项 + 收入 9 项（餐饮/购物/交通/工资/红包…） | drawable `icon_zhichu_type_*` / `icon_shouru_type_*` |
| 账单明细 | 按天分组（今天/昨天/日期+周几）、日小计、月收支结余、账本切换、账户筛选 | `records_line_layout.xml` |
| 账单操作 | 点击编辑、左滑呼出编辑/删除、删除二次确认 | `bill_list_btn_bianji/shanchu` |
| 多账本 | 新建/切换/重命名/删除（账单随账本隔离） | `Books` 模块 |
| 账户钱包 | 现金/储蓄卡/信用卡/网络账户/虚拟卡/投资/负债 7 类，净资产总览 | `Account` 模块 + drawable 账户类型 |
| 信用卡 | 额度 / 账单日 / 还款日 / 欠款统计 | `credit_add_activity.xml` |
| 账户转账 | 转出/转入账户选择，余额双向变动 | `AccountTransferActivity` |
| 报表统计 | 分类环形饼图+图例、近6月收支趋势折线、分类排行、KPI（笔数/最高单笔/记账天数） | `Report` 模块 |
| 预算 | 月总预算 + 分类预算；日/周/月三个进度环 + 日均可用 | `budget_v3.xml` 三环 |
| 周期记账 | 每天/每周/每月/每年，到期自动补记（如工资、房租） | `Notice` 模块 |
| 日历视图 | 月历每日收支标记，点日查看当日账单 | `CalendarRecord` 模块 |
| 搜索 | 备注/分类/账户/金额全文搜索 | `SearchRecordActivity` |
| 成员记账 | 多成员管理，记一笔时选择 | `jiyibi_btn_chenyuan` |
| 多币种 | ¥ $ € £ ₩ 符号切换 | `CurrencySelectActivity` |
| 深色模式 | 全套深色变量主题 | `assets/Default_deep/config.json` |
| 数据导出 | CSV（Excel 可开）/ JSON 完整备份；JSON 导入恢复 | `DeriveData` / `DataBackUps` |
| 标签记账 | 可复用标签：记一笔多选、新增、删除（删除自动从账单剥离），账单列表显示 #标签 徽章，可按标签搜索 | `RecordTagDetailsAtivity`（原App标签详情页） |
| 账单附件 | 记一笔可附最多 3 张图片（本地自动压缩至 ~720px），列表缩略图、点击全屏查看、编辑可删 | `modules.album.*` 相册/裁剪、`UploadPhotoService`、`bill_list_units_bzimg` 备注图片位 |

**未复刻**（依赖服务端或系统权限）：社区/IM、商城导购、理财超市、红包邀请、VIP、广告 SDK、云同步账号、无障碍自动记账（支付宝/微信账单导入）、扫码、情侣记账。

## 技术实现

- 纯原生 HTML/CSS/JS，无框架无依赖；`file://` 直开可用
- localStorage 持久化（键 `kdjz_clone_state_v1`），数据模型：账本 / 账户 / 分类 / 记录 / 预算 / 周期任务 / 设置
- 图表手绘 Canvas（环形饼图、双折线、进度环），随主题色变化
- 移动端优先布局：底部 Tab（明细/报表/钱包/我的）+ 中央"记一笔"，桌面端自动呈现手机壳视窗
- 交互复刻：触摸左滑、底部弹层堆叠、物理键盘输入（数字/加减/Backspace/Enter）、账户/成员/标签平铺横滑直选

## 文件结构

```
├── index.html              # Web 应用入口
├── css/style.css           # 全部样式（浅色+深色双主题）
├── js/
│   ├── data.js             # 默认分类/账户类型/银行清单（逆向证据）
│   ├── store.js            # 数据层：CRUD、余额计算、报表聚合、周期补记、导入导出、SQLite 适配
│   ├── ui.js               # Toast/确认框/弹层堆叠/日期选择/图片压缩/附件查看/SVG 图标
│   ├── charts.js           # Canvas 饼图/折线/进度环
│   ├── views-bills.js      # 明细 / 日历 / 搜索
│   ├── views-add.js        # 记一笔（计算器键盘+分类宫格+平铺直选）/ 分类·标签编辑器
│   ├── views-report.js     # 报表
│   ├── views-wallet.js     # 钱包 / 账户详情 / 转账
│   ├── views-mine.js       # 我的 / 账本 / 预算 / 周期 / 分类管理 / 设置
│   └── app.js              # 路由 / Tab 栏 / 启动 / 边缘滑动返回
├── android/                # APK 壳工程（WebView + SQLite 桥），见 android/BUILD.md
├── ANALYSIS.md             # 逆向分析报告（证据 → 功能映射）
├── TEST_REPORT.md          # 自动化测试报告（66 用例）
└── README.md
```
