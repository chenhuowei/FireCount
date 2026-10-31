#!/usr/bin/env node
/**
 * 一键全量测试：静态审查 + 4 套自动化测试
 * 用法：node tests/run-all.js
 */
const { execFileSync } = require('child_process');
const path = require('path');

const suites = [
  { name: '静态审查（缺失方法/图标/死代码）', file: 'static-audit.js' },
  { name: '核心逻辑（数据/记账/导入导出/统计）', file: '01-core.js' },
  { name: 'UI 交互（页面/Tab/快捷条/选择器/清空）', file: '02-ui.js' },
  { name: 'APK 环境（SQLite/指纹/WebDAV/自动备份）', file: '03-apk.js' },
  { name: '资源与样式（文件/图标/CSS/主题）', file: '04-assets.js' }
];

let failed = [];
console.log('\n' + '#'.repeat(70));
console.log('# 小伙记账 · FirCount 全量自动化测试');
console.log('# ' + new Date().toLocaleString('zh-CN'));
console.log('#'.repeat(70));

for (const s of suites) {
  console.log('\n\n' + '█'.repeat(70));
  console.log('█ ' + s.name);
  console.log('█'.repeat(70));
  try {
    const out = execFileSync(process.execPath, [path.join(__dirname, s.file)], { encoding: 'utf8', stdio: 'pipe' });
    process.stdout.write(out);
  } catch (e) {
    process.stdout.write(e.stdout || '');
    if (e.stderr) process.stderr.write(e.stderr);
    failed.push(s.name);
  }
}

console.log('\n\n' + '#'.repeat(70));
if (failed.length === 0) {
  console.log('# ✅ 全部测试通过');
  console.log('#'.repeat(70));
  process.exit(0);
} else {
  console.log('# ❌ 失败套件：' + failed.join(' | '));
  console.log('#'.repeat(70));
  process.exit(1);
}
