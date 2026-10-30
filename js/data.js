/* ============================================================
 * 静态数据（证据来源：APK drawable 命名 icon_zhichu_type_* / icon_shouru_type_*）
 * 默认分类与口袋记账 v4.5.0 一致：支出 17 项 / 收入 9 项
 * ============================================================ */
"use strict";

const DATA = {
  appName: "小伙记账",
  expenseCategories: [
    { key: "canyin", name: "餐饮", icon: "svg:canyin", color: "#FF8A3C" },
    { key: "gouwu", name: "购物", icon: "svg:gouwu", color: "#F5588A" },
    { key: "jiaotong", name: "交通", icon: "svg:jiaotong", color: "#3B82F6" },
    { key: "fushi", name: "服饰", icon: "svg:fushi", color: "#8B5CF6" },
    { key: "jujia", name: "居家", icon: "svg:jujia", color: "#14B8A6" },
    { key: "yiliaojiaoyu", name: "医疗教育", icon: "svg:yiliaojiaoyu", color: "#EF4444" },
    { key: "yule", name: "娱乐", icon: "svg:yule", color: "#A855F7" },
    { key: "shoujitongxun", name: "手机通讯", icon: "svg:shoujitongxun", color: "#0EA5E9" },
    { key: "yanjiuyinliao", name: "烟酒饮料", icon: "svg:yanjiuyinliao", color: "#D97706" },
    { key: "shuiguolingshi", name: "水果零食", icon: "svg:shuiguolingshi", color: "#22C55E" },
    { key: "meirongjianshen", name: "美容健身", icon: "svg:meirongjianshen", color: "#EC4899" },
    { key: "renqingsongli", name: "人情送礼", icon: "svg:renqingsongli", color: "#F43F5E" },
    { key: "shuji", name: "书籍", icon: "svg:shuji", color: "#6366F1" },
    { key: "chongwu", name: "宠物", icon: "svg:chongwu", color: "#F97316" },
    { key: "taobao", name: "淘宝", icon: "svg:taobao", color: "#FF6A00" },
    { key: "baoxiaozhang", name: "报销账", icon: "svg:baoxiaozhang", color: "#64748B" },
    { key: "yiban", name: "一般支出", icon: "svg:yiban", color: "#94A3B8" }
  ],
  incomeCategories: [
    { key: "gongzi", name: "工资", icon: "svg:gongzi", color: "#2BB673" },
    { key: "jiangjin", name: "奖金", icon: "svg:jiangjin", color: "#F59E0B" },
    { key: "jianzhiwaikuai", name: "兼职外快", icon: "svg:jianzhiwaikuai", color: "#10B981" },
    { key: "touzishouru", name: "投资收入", icon: "svg:touzishouru", color: "#0EA5E9" },
    { key: "hongbao", name: "红包", icon: "svg:hongbao", color: "#EF4444" },
    { key: "linghuaqian", name: "零花钱", icon: "svg:linghuaqian", color: "#F472B6" },
    { key: "shenghuofei", name: "生活费", icon: "svg:shenghuofei", color: "#8B5CF6" },
    { key: "jieru", name: "借入", icon: "svg:jieru", color: "#64748B" },
    { key: "qita", name: "其他", icon: "svg:qita", color: "#94A3B8" }
  ],
  /* 账户类型（证据：xianjin / bank_* / credit / wangluozhanghu / fanka / touzizhanghu / 负债账户） */
  accountTypes: [
    { type: "cash", name: "现金", icon: "svg:cash", color: "#F59E0B", desc: "钱包现金" },
    { type: "bank", name: "储蓄卡", icon: "svg:bank", color: "#3B82F6", desc: "银行卡" },
    { type: "credit", name: "信用卡", icon: "svg:credit", color: "#8B5CF6", desc: "额度 / 账单日 / 还款日" },
    { type: "virtual", name: "网络账户", icon: "svg:virtual", color: "#0EA5E9", desc: "支付宝、微信等" },
    { type: "card", name: "虚拟卡", icon: "svg:card", color: "#14B8A6", desc: "饭卡、公交卡" },
    { type: "invest", name: "投资账户", icon: "svg:invest", color: "#22C55E", desc: "基金、股票等" },
    { type: "debt", name: "负债账户", icon: "svg:debt", color: "#EF4444", desc: "欠款、房贷等" }
  ],
  /* 银行图标清单证据（bank_gongshang / bank_jianshe / bank_jiaotong ...） */
  banks: ["工商银行", "建设银行", "农业银行", "中国银行", "交通银行", "招商银行", "邮储银行",
          "浦发银行", "中信银行", "光大银行", "华夏银行", "民生银行", "兴业银行", "广发银行",
          "平安银行", "北京银行", "上海银行", "宁波银行", "南京银行", "江苏银行", "其他银行"],
  virtualPresets: [
    { name: "支付宝",   icon: "🔷" },
    { name: "微信支付", icon: "💬" },
    { name: "QQ钱包",   icon: "🐧" },
    { name: "百度钱包", icon: "🐼" },
    { name: "京东金融", icon: "🐕" }
  ],
  cardPresets: [
    { name: "饭卡",   icon: "🍚" },
    { name: "公交卡", icon: "🚌" },
    { name: "会员卡", icon: "🎫" }
  ],
  currencies: ["¥", "$", "€", "£", "₩"],
  /* 线性图标选择器（新建/编辑分类时可选，与 emoji 双轨） */
  iconChoices: Object.keys(ICONS).filter(k => !['cash','bank','credit','virtual','card','invest','debt'].includes(k)),
  emojiChoices: [
    "🍜","🛍️","🚌","👕","🏠","🏥","🎮","📱","🍺","🍎","💪","🎁","📖","🐱","🛒","🧾","💸",
    "💼","🏆","💵","📈","🧧","🐷","👛","🤝","✨","☕","🍰","🎬","✈️","🚕","🚇","🚗","⛽","🅿️",
    "💧","⚡","🧹","🧴","💊","🏥","🎓","🏀","⚽","🎮","🎵","🎨","🧸","💐","💍","🍼","🐕","🌻"
  ],
  colorChoices: [
    "#FF8A3C","#F5588A","#3B82F6","#8B5CF6","#14B8A6","#EF4444","#A855F7","#0EA5E9",
    "#D97706","#22C55E","#EC4899","#F43F5E","#6366F1","#F97316","#FF6A00","#64748B","#94A3B8"
  ],
  months: ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"],
  weeks: ["日","一","二","三","四","五","六"]
};
