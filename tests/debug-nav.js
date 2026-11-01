// 调试 shiftMonth 后 rpNav 消失问题
const { createEnv } = require('./harness');
const { window, T } = createEnv();
const { Store: S, App, ViewsReport } = T;
const doc = window.document;
S.reset(); S.boot();
ViewsReport.range = { mode: 'month', month: '2026-11', year: null, start: null, end: null };
ViewsReport.render(doc.getElementById('pageHeader'), doc.getElementById('pageMain'));
console.log('page:', App.page);
App.shiftMonth(-1);
console.log('shiftMonth 后 page:', App.page);
console.log('pageMain 前 150:', doc.getElementById('pageMain').innerHTML.slice(0, 150));
process.exit(0);
