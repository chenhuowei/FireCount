/* ============================================================
 * 分类/账户 SVG 线性图标库（Tabler Icons 风格重绘，MIT 免费商用）
 *   UI.catIcon(obj, cls, size)  → 统一渲染入口
 *     obj.icon 为 "svg:name" 时渲染线性图标，否则按 emoji 渲染（兼容旧数据）
 *   DATA 图标字段命名规范：icon: "svg:canyin"（svg: 前缀 + 图标键名）
 * ============================================================ */
"use strict";

const ICONS = {
  /* ---- 支出分类 ---- */
  canyin:      '<path d="M6 3v8a2.5 2.5 0 005 0V3M8.5 11v10M15 3c-1.5 2-2 4.5-2 7h4c0-2.5-.5-5-2-7zM15 10v11M18.5 13c-1.2 0-1.5 1.2-1.5 3v5h3v-5c0-1.8-.3-3-1.5-3z"/>',
  gouwu:       '<path d="M6 8h12l1.5 12.5a1 1 0 01-1 1.1H5.5a1 1 0 01-1-1.1L6 8z"/><path d="M9 10V6a3 3 0 016 0v4"/>',
  jiaotong:    '<rect x="4" y="4" width="16" height="13" rx="3"/><path d="M4 10h16M8 20l1.5-3M16 20l-1.5-3M8 17h8"/><circle cx="8" cy="14" r="0.6"/><circle cx="16" cy="14" r="0.6"/>',
  fushi:       '<path d="M8 4l4 2.5L16 4l4 3-2.5 3L16 9v11H8V9l-1.5 1L4 7l4-3z"/>',
  jujia:       '<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-6h4v6"/>',
  yiliaojiaoyu:'<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 9v6M9 12h6"/>',
  yule:        '<path d="M7 9a5 5 0 0110 0v1a3 3 0 01-3 3h-1v2"/><circle cx="12" cy="12" r="9"/><path d="M12 18.5v0.01"/>',
  shoujitongxun:'<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>',
  yanjiuyinliao:'<path d="M6 4h10v4a5 5 0 01-10 0V4z"/><path d="M16 5h2a2 2 0 010 4h-2M8 13v8h6v-8"/>',
  shuiguolingshi:'<path d="M12 7c-4 0-7 2.8-7 6.5S8 21 12 21s7-3.8 7-7.5S16 7 12 7z"/><path d="M12 7c0-2 1-3.5 3-4M12 7c0-2-1-3.5-3-4"/>',
  meirongjianshen:'<path d="M6.5 6.5v11M17.5 6.5v11M4 9v6M20 9v6M6.5 12h11"/>',
  renqingsongli:'<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M12 9v11M4 13h16M8.5 9C7 9 6 7.8 6 6.5 6 5 7 4 8.5 4 10 4 12 5.5 12 9c0-3.5 2-5 3.5-5C17 4 18 5 18 6.5 18 7.8 17 9 15.5 9"/>',
  shuji:       '<path d="M4 5a2 2 0 012-2h14v18H6a2 2 0 01-2-2V5z"/><path d="M20 17H6a2 2 0 00-2 2M9 7h7"/>',
  chongwu:     '<circle cx="7" cy="9" r="1.8"/><circle cx="12" cy="6.5" r="1.8"/><circle cx="17" cy="9" r="1.8"/><path d="M12 11c-3.5 0-6 2.4-6 5.2 0 1.6 1.2 2.8 2.8 2.8h6.4c1.6 0 2.8-1.2 2.8-2.8 0-2.8-2.5-5.2-6-5.2z"/>',
  taobao:      '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 8V6a3 3 0 016 0v2M9 13l3 3 3-3"/>',
  baoxiaozhang:'<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  yiban:       '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5a3 3 0 00-5 2.2c0 2.3 5 1.8 5 4a3 3 0 01-5 2.2M12 7v10"/>',
  /* ---- 收入分类 ---- */
  gongzi:      '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/><circle cx="16.5" cy="14.5" r="1"/>',
  jiangjin:    '<path d="M8 4h8v5a4 4 0 01-8 0V4z"/><path d="M8 5H5a3 3 0 003 5M16 5h3a3 3 0 01-3 5M10 13h4l-.5 4h-3l-.5-4zM9 21h6M12 17v4"/>',
  jianzhiwaikuai:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M12 10v7M8.8 13.6L12 10l3.2 3.6M16 7l-2-3M8 7l2-3"/>',
  touzishouru: '<path d="M4 19L9 13l3.5 3L20 8"/><path d="M15 8h5v5"/>',
  hongbao:     '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 9.5c2.5 1.5 5 2.3 8 2.3s5.5-.8 8-2.3M12 12v9"/>',
  linghuaqian: '<path d="M16 7a3.5 3.5 0 013 5c0 2-1.5 3-3 4l-4 5-4-5c-1.5-1-3-2-3-4a3.5 3.5 0 013-5c1.5 0 3 1 4 2.5C13 8 14.5 7 16 7z"/><circle cx="12" cy="14.5" r="1"/>',
  shenghuofei: '<path d="M17 8a5 5 0 10-10 0c0 2.5 2 3.5 2 5.5V16h6v-2.5c0-2 2-3 2-5.5z"/><path d="M10 19h4M10.5 21h3"/>',
  jieru:       '<path d="M6 9h9M15 9l-2.5-2.5M15 9l-2.5 2.5"/><path d="M18 15H9M9 15l2.5-2.5M9 15l2.5 2.5"/>',
  qita:        '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z"/>',
  /* ---- 账户类型 ---- */
  cash:        '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v.01M18 14.5v.01"/>',
  bank:        '<path d="M3 9l9-5 9 5M4 9.5h16M6 9.5V17M10 9.5V17M14 9.5V17M18 9.5V17M4 17h16M3 20h18"/>',
  credit:      '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18M6.5 15h4"/>',
  virtual:     '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.2a3.5 3.5 0 00-5.6 2.8c0 2.8 4 2.2 4 4.6a3.5 3.5 0 01-6 2.4M12 6.5v11"/>',
  card:        '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M9 4v16M13 8h4M13 11h4"/>',
  invest:      '<circle cx="12" cy="12" r="9"/><path d="M8 14l2.5-3 2 1.8L16 9M16 9h-2.8M16 9v2.8"/>',
  debt:        '<path d="M12 3L2.5 20h19L12 3z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  /* ---- 其他 ---- */
  coffee:      '<path d="M4 8h13v6a5 5 0 01-5 5H9a5 5 0 01-5-5V8z"/><path d="M17 9h2a2 2 0 010 4h-2M7 3v2M11 3v2"/>',
  cake:        '<path d="M5 20h14v-6a2 2 0 00-2-2H7a2 2 0 00-2 2v6z"/><path d="M12 9v3M12 6.5c-.8-.5-1.2-1.2-1.2-2 0-.8.4-1.5 1.2-2 .8.5 1.2 1.2 1.2 2 0 .8-.4 1.5-1.2 2z"/>',
  movie:       '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4M7 12h10"/>',
  plane:       '<path d="M10.5 20.5l1.5-6 5.5 2c1.5.5 3-.5 3.5-2l.5-1.5-9.5-4.5-1-6-1.5-.5-1 6.5-5 2 .5 2 5.5.5-1 6 2.5 1.5z"/>',
  taxi:        '<path d="M4 17v-4l2-5h12l2 5v4M4 17h16M4 17v2M20 17v2"/><path d="M9 8V6h6v2"/><rect x="7" y="13" width="2.5" height="2" rx="0.8"/><rect x="14.5" y="13" width="2.5" height="2" rx="0.8"/>',
  car:         '<path d="M5 16v-4l1.8-4.5A2 2 0 018.7 6h6.6a2 2 0 011.9 1.5L19 12v4"/><rect x="3" y="12" width="18" height="5" rx="2"/><circle cx="7.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/>',
  gas:         '<path d="M5 21V5a2 2 0 012-2h6a2 2 0 012 2v16M3 21h14M15 9h2a2 2 0 012 2v6a1.5 1.5 0 003 0V9l-2.5-2.5"/><path d="M8 7h4"/>',
  parking:     '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M10 17V7h3a3 3 0 010 6h-3"/>',
  water:       '<path d="M12 3c-3.5 4.5-6 7.7-6 11a6 6 0 0012 0c0-3.3-2.5-6.5-6-11z"/>',
  electric:    '<path d="M13 3L5 13h5l-1 8 8-10h-5l1-8z"/>',
  clean:       '<path d="M15 4l5 5-8.5 8.5c-1.5 1.5-3.5 2.5-5.5 2L4 18c-.5-2 .5-4 2-5.5L15 4z"/><path d="M14 7l3 3M8 13.5L10.5 16"/>',
  medical:     '<path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5V4z"/>',
  study:       '<path d="M3 9l9-4 9 4-9 4-9-4z"/><path d="M7 11v4c0 1.5 2.2 3 5 3s5-1.5 5-3v-4M21 9v5"/>',
  basketball:  '<circle cx="12" cy="12" r="9"/><path d="M3.5 9c3 1.5 5 1.5 8.5 0s5.5-1.5 8.5 0M12 3c-2 2.5-3 5.5-3 9s1 6.5 3 9M12 3c2 2.5 3 5.5 3 9s-1 6.5-3 9"/>',
  football:    '<circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 4.5h-5L8 10l4-3zM12 3v4M19.8 9.5L16 10M19.8 15l-3.3-1M12 21l-2.5-3.5M8.7 14.5L4.2 15M4.2 9.5L8 10"/>',
  music:       '<circle cx="6.5" cy="17.5" r="3"/><circle cx="17.5" cy="15.5" r="3"/><path d="M9.5 17.5V6l11-2.5v12"/>',
  art:         '<path d="M12 3a9 9 0 000 18c1.5 0 2-1 2-2s-.8-1.6-.8-2.6c0-1.2 1-2.4 2.3-2.4H18a3 3 0 003-3C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  toy:         '<path d="M12 6a4 4 0 10-4 4H5a2 2 0 00-2 2v7h18v-7a2 2 0 00-2-2h-3a4 4 0 10-4-4z"/><path d="M9 15v2M15 15v2"/>',
  flower:      '<circle cx="12" cy="9" r="2"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="11.5" r="2"/><circle cx="15" cy="11.5" r="2"/><path d="M12 13.5c-1.5 2-2.5 4.5-2.5 7.5h5c0-3-1-5.5-2.5-7.5z"/>',
  ring:        '<circle cx="12" cy="14" r="6"/><path d="M9 8l1.5-4h3L15 8M9 8l3 2 3-2"/>',
  baby:        '<circle cx="12" cy="9" r="4.5"/><path d="M9.5 8.5v.01M14.5 8.5v.01M10.5 11c.9.7 2.1.7 3 0M12 14.5V17M8.5 19c1 1.5 2 2.5 3.5 2.5s2.5-1 3.5-2.5"/>',
  dog:         '<path d="M5 8a3 3 0 013-3h8a3 3 0 013 3v2l1.5 4-2.5 1v3a2 2 0 01-2 2H8a2 2 0 01-2-2v-4L4.5 12 5 10V8z"/><circle cx="14" cy="11" r="0.6"/><path d="M11 16h2"/>',
  /* ---- 导入常见分类补充（口袋记账导出高频分类） ---- */
  maicai:      '<path d="M4 10h16l-1.5 9.5a1.5 1.5 0 01-1.5 1.3H7a1.5 1.5 0 01-1.5-1.3L4 10z"/><path d="M8.5 13v5M12 13v5M15.5 13v5"/><path d="M7 10V7a5 5 0 0110 0v3"/>',
  yaopin:      '<rect x="9" y="2.5" width="6" height="19" rx="3" transform="rotate(45 12 12)"/><path d="M9.5 14.5l5-5"/>',
  hufu:        '<rect x="9" y="9" width="6" height="12" rx="2"/><path d="M10.5 9V5a1.5 1.5 0 011.5-1.5 1.5 1.5 0 011.5 1.5v4"/><path d="M9.5 3.5c-.8-.4-1.5-.4-2.3 0"/><path d="M12 12v6"/>',
  shuma:       '<rect x="3.5" y="5" width="17" height="11" rx="2"/><path d="M8 19h8M12 16v3"/><path d="M9 8.5l-1.5 2.5L9 13.5M15 8.5l1.5 2.5L15 13.5"/>',
  lifa:        '<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8.2 8.5L20 19M8.2 15.5L20 5M13 12h0"/>',
  juhui:       '<path d="M6 3h4v5a2 2 0 01-4 0V3zM14 3h4v5a2 2 0 01-4 0V3z"/><path d="M6 13v7M14 13v7M4 20h4M12 20h4M8 8h8"/>',
  lvyou:       '<rect x="4" y="7" width="16" height="13" rx="2.5"/><path d="M9 7V4.5A1.5 1.5 0 0110.5 3h3A1.5 1.5 0 0115 4.5V7M8 7v13M16 7v13M12 7v13"/>',
  liwu:        '<rect x="4" y="10" width="16" height="10" rx="1.5"/><path d="M3 7h18v3H3zM12 7v13M12 7c-2 0-4.5-.8-4.5-2.7C7.5 3 8.5 2 10 2c1.4 0 2 1.5 2 5 0-3.5.6-5 2-5 1.5 0 2.5 1 2.5 2.3C16.5 6.2 14 7 12 7z"/>',
  jiazhuang:   '<rect x="5" y="9" width="14" height="12" rx="1.5"/><path d="M12 9v12M5 13h14"/><path d="M12 3v6M9.5 3h5"/>',
  gupiao:      '<path d="M3 20V4M3 20h18"/><path d="M6 15l3.5-4 3 2.5L18 7"/><path d="M14.5 7H18v3.5"/><path d="M7.5 17.5h2M11.5 17.5h2M15.5 17.5h2"/>',
  sport:       '<path d="M8 3h8l-1 5.5a3.5 3.5 0 01-6 0L8 3z"/><path d="M10 8.5L9 21h6l-1-12.5"/><path d="M9 12h6M9 15.5h6"/>'
};

const IconUI = {
  has(key) { return Object.prototype.hasOwnProperty.call(ICONS, key); },
  /** 渲染单个图标为 SVG path 集合（不含外框） */
  svg(key, size, color) {
    const p = ICONS[key];
    if (!p) return "";
    return '<svg width="' + (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" stroke="' +
      (color || "currentColor") + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + p + "</svg>";
  },
  /**
   * 统一渲染入口：分类/账户对象的 icon 字段
   *  - "svg:xxx" → 线性图标（按 cls 容器着色 currentColor）
   *  - 其他值    → 按 emoji 渲染（兼容旧数据与自定义分类）
   */
  catIcon(obj, cls, size) {
    const icon = (obj && obj.icon) || "";
    const m = /^svg:(\w+)$/.exec(icon);
    if (m && ICONS[m[1]]) {
      const color = obj.color || "";
      return '<div class="' + (cls || "bi-icon") + '"' + (color ? ' style="color:' + color + '"' : "") + ">" +
        IconUI.svg(m[1], size, "currentColor") + "</div>";
    }
    return '<div class="' + (cls || "bi-icon") + '">' + icon + "</div>";
  },
  /** 记一笔分类宫格用：纯图标 HTML（外层已有 .ci 容器） */
  raw(obj, size) {
    const m = /^svg:(\w+)$/.exec((obj && obj.icon) || "");
    if (m && ICONS[m[1]]) return IconUI.svg(m[1], size || 24);
    return (obj && obj.icon) || "";
  }
};
