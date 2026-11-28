#!/usr/bin/env node
/* 版本号单一来源：npm run version:bump -- 1.1.4
 * 同步 package.json / AndroidManifest / build.sh / views-mine / README / BUILD /
 * index.html 资源版本（v=N）。versionCode = 主*10000 + 次*100 + 补丁。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ver = process.argv[2];
if (!ver || !/^\d+\.\d+\.\d+$/.test(ver)) {
  console.error('用法: npm run version:bump -- 1.1.4');
  process.exit(1);
}
const [ma, mi, pa] = ver.split('.').map(Number);
// versionCode：旧值小于 100 时延续递增（13→14），否则用 主*10000+次*100+补丁
const oldCode = Number((fs.readFileSync(path.join(ROOT, 'android/app/AndroidManifest.xml'), 'utf8').match(/android:versionCode="(\d+)"/) || [])[1] || 0);
const code = oldCode < 100 ? oldCode + 1 : ma * 10000 + mi * 100 + pa;
const oldVer = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const oldRes = Number((fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/style\.css\?v=(\d+)/) || [])[1] || 0);
const newRes = oldRes + 1;

function rw(file, fn) {
  const p = path.join(ROOT, file);
  fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8')));
}
rw('package.json', s => s.replace(`"version": "${oldVer}"`, `"version": "${ver}"`));
rw('android/app/AndroidManifest.xml', s => s
  .replace(/android:versionCode="\d+"/, `android:versionCode="${code}"`)
  .replace(/android:versionName="[\d.]+"/, `android:versionName="${ver}"`));
rw('android/build.sh', s => s
  .replace(/VC="\$\{VC:-\d+\}"/, `VC="\${VC:-${code}}"`)
  .replace(/VN="\$\{VN:-[\d.]+\}"/, `VN="\${VN:-${ver}}"`));
rw('js/views-mine.js', s => s
  .replace(`版本 ${oldVer}`, `版本 ${ver}`)
  .replace(`FireCount v${oldVer}`, `FireCount v${ver}`));
rw('android/BUILD.md', s => s.replace(/VC=\d+ VN=[\d.]+/g, `VC=${code} VN=${ver}`));
rw('README.md', s => s
  .replace(/versionCode \d+ · versionName [\d.]+/, `versionCode ${code} · versionName ${ver}`)
  .replace(/小伙记账-[\d.]+\.apk/g, `小伙记账-${ver}.apk`));
rw('index.html', s => s.replace(/\?v=\d+/g, `?v=${newRes}`));

console.log(`版本升级：${oldVer} → ${ver}（versionCode ${code}，资源 v${newRes}）`);
console.log('请手动在 README 版本表追加变更说明。');
