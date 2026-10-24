# 口袋记账（com.qeeniao.mobile.kdjz）功能复刻 · 逆向分析报告

> 按 REA（Reverse Engineer Anything）工作流产出：选定目标 → 静态调查 → 证据 → 功能解释 → 复刻实现。
> 分析日期：2026-10-24 · 分析对象：`com.qeeniao.mobile.kdjz.apk`（82,355,729 字节，SHA-256 `2e92cf60…d6d6`）

## 1. 目标元数据（REA decode-android-resources / apktool 3.0.3）

| 项 | 值 |
|---|---|
| 应用 | 口袋记账 v4.5.0（versionCode 40450） |
| 包名 | com.qeeniao.mobile.kdjz |
| minSdk / targetSdk | 29 / 34 |
| 技术形态 | 原生 Android（Kotlin + View + 部分 Compose），360 加固（libjiagu_a64.so） |

## 2. 证据与限制

- **加固限制**：`classes.dex` 为 360 加固壳（仅含 `com.stub` / `com.tianyu` 加载器字符串），业务字节码在运行时解密，静态无法反编译出 Kotlin 源码。本分析未做运行时脱壳。
- **可用证据**：AndroidManifest（全部 Activity/Service 组件清单）、res/values（字符串/数组/颜色）、res/layout（1393 个布局中的业务布局）、assets/Default_deep/config.json（深色主题 67KB 颜色映射）、drawable 资源命名。

## 3. 界面结构证据

### 3.1 主界面（mainui.HomeActivity + assets/Default_deep 图标）
底部 Tab 栏（主题化、远程可配）：`zhangdan 账单`、`baobiao 报表`、`rili 日历`、`licai 理财`、`qianbao 钱包`、`community 社区`、`gengduo 更多`，中央 `jiyibi 记一笔` 大按钮。

### 3.2 记一笔（modules.AddNewRecord，布局 add_new_record.xml）
- 三模式切换：`jiyibi_btn_zhichu 支出` / `jiyibi_btn_shouru 收入` / `jiyibi_btn_zhuanzhang 转账`
- 分类宫格：`jyb_gridview_viewpager`（多页滑动），选中分类高亮 `jiyibi_icon_type_selected` + `jiyibi_txt_typename`
- 金额区：`jiyibi_txt_input`（金额）、`jiyibi_txt_input_formula`（公式）、`jiyibi_btn_huobi`（币种）
- 键盘（keyboard_number.xml，4×4）：`7 8 9 ⌫ / 4 5 6 + / 1 2 3 − / C 0 . OK` —— 内置四则计算
- 属性行：`jiyibi_btn_shijian 时间`、`jiyibi_txt_zhifufangshi 账户`、`jiyibi_btn_chenyuan 成员`、`jiyibi_btn_beizhu 备注`、`jiyibi_btn_scan 扫码`

### 3.3 账单明细（records_line_layout.xml）
- 头部：账本切换 `records_line_button_zhangbenqiehuan`、账户筛选 `zhangben_mingxi_txt_zhanghu`、日历入口 `records_line_btn_calendar`、搜索栏 `rl_search_bar`
- 列表：按天分组（`bill_list_unit_txt_day`），天头部含当日收入 `bill_list_unit_txt_in` / 支出 `bill_list_unit_txt_out` 小计；条目 = 分类图标 `img_paytype` + 备注 `beizhu` + 金额；侧滑露出 `bill_list_btn_bianji 编辑` / `bill_list_btn_shanchu 删除`（左滑手势）

### 3.4 预算（modules.Budget，budget_v3.xml）
日/周/月三档预算，`budget_v3_circle_day|week|month` 水波纹环形进度 + `budget_wai_*` 外环，配分类预算（SelectBudgetTypeActivity）。

### 3.5 账户/钱包（modules.Account）
- 账户类型图标证据：`xianjin 现金`、`bank_* 储蓄卡(30+银行)`、信用卡（credit_add：名称/金额/额度/账单日 creditdetail_date/还款提醒 creditdetail_notice/备注）、`wangluozhanghu 网络账户`（支付宝/微信）、`fanka 饭卡`、公交卡、`touzizhanghu 投资账户`、负债账户
- 转账：AccountTransferActivity；账户详情：NewAccountDetailActivity + TrendActivity（趋势）
- 账单导入（自动记账）：BillImportActivity（支付宝/微信账单导入）

### 3.6 报表（modules.Report）
分类占比饼图 + 收支趋势折线（report_linechart_layout）+ 分类排行列表 + 消费统计（expense_report_statistics：最高单笔/平均消费/记账天数）+ 冲动消费分析（ImpulseReport）。

### 3.7 其他业务模块（Manifest 证据）
多账本 Books、借还款 Borrow（借入/借出/收还款/应收应付）、周期提醒 Notice（NoticeAddActivity 定期记账/还款提醒）、日历记账 CalendarRecord、搜索 SearchRecordActivity、数据导出 DeriveData/ExportData、备份 DataBackUps、多币种 CurrencySelect、主题 Theme、手势锁 GestureLock、情侣记账 couple、成就墙、云同步 SyncService_v2。

## 4. 默认分类（drawable 命名证据 icon_zhichu_type_* / icon_shouru_type_*）

**支出（17）**：餐饮、购物、交通、服饰、居家、医疗教育、娱乐、手机通讯、烟酒饮料、水果零食、美容健身、人情送礼、书籍、宠物、淘宝、报销账、一般支出
**收入（9）**：工资、奖金、兼职外快、投资收入、红包、零花钱、生活费、借入、其他

## 5. 复刻范围

**复刻（Web 应用，localStorage 持久化）**：记一笔三模式 + 计算器键盘 + 分类宫格、账单明细（按天分组/左滑编辑删除/月切换/账户筛选/搜索）、多账本、账户钱包（6 类账户 + 净资产 + 信用卡账单日/还款日/额度 + 转账）、报表（饼图/趋势折线/分类排行/消费统计）、预算（月总 + 分类预算，环形进度）、周期记账、日历视图、数据导出 CSV/JSON + 导入、深色主题、多币种符号切换。

**不复刻（依赖服务端/系统/合规边界）**：社区/IM、商城导购、理财超市（P2P 平台列表）、红包邀请、VIP/广告、云同步账号体系、无障碍自动记账、扫码、情侣记账、成就墙。

## 6. 结论

口袋记账的核心记账闭环 = **记一笔（计算器+分类）→ 账单流水（账本/账户/日历/搜索维度）→ 账户资产（净资产/信用卡/转账）→ 报表分析（饼图/趋势）→ 预算控制（日/周/月环）**，辅以多账本、借还款、周期记账、导出备份。本复刻在浏览器端以同构数据模型 1:1 实现该闭环。
