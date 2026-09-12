/* 模糊查找的量化验证 —— node test/probe.js
 *
 * 不看截图看数据：用本机 Edge 无头渲染真实页面，模拟真人输入关键词，
 * 然后直接把 DOM 里的行数、相近标签数、提示条是否存在读出来。
 * 结果通过 --dump-dom 回传，避免"看着像对了"的误判。
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = path.join(__dirname, '..');
const sandbox = 'D:\\WorkBuddyMemory\\ZZH\\_browsertest';
const profile = path.join(sandbox, '_profile_probe');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const APP = fs.readFileSync(path.join(root, '物料借还管理.html'), 'utf8');

fs.mkdirSync(sandbox, { recursive: true });

/* 场景脚本：全部通过 DOM 交互，不碰应用内部变量 —— 模拟真人操作 */
const SCENE = `
(function () {
  var later = function (fn, ms) { setTimeout(fn, ms || 80); };
  var q = function (sel) { return document.querySelector(sel); };
  var qa = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  var click = function (sel) { var el = q(sel); if (!el) throw new Error('找不到 ' + sel); el.click(); return el; };

  var lines = [];
  var say = function (s) { lines.push(s); };

  /* 搜索框是 260ms 防抖 + 整体重渲染，所以要重新取元素并等够时间 */
  var search = function (kw, cb) {
    var el = q('#fKw');
    if (!el) { say('ERR 当前页没有搜索框'); cb(); return; }
    el.value = kw;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    later(function () { cb(); }, 480);
  };

  var measure = function (label, kw, expect) {
    var rows = qa('#app .grid tbody tr').length;
    var near = qa('#app .badge.gray').filter(function (b) {
      return /相近/.test(b.textContent || '');
    }).length;
    var note = !!q('.panel-note .note.info');
    var meta = q('#app .panel-head .meta');
    var overflow = document.body.scrollWidth - document.documentElement.clientWidth;
    var ok = (rows === expect[0]) && (near === expect[1]) && (note === expect[2]) && (overflow === 0);
    say((ok ? 'OK  ' : 'BAD ') + label +
        ' | 关键词=' + kw + ' | 行数=' + rows + '(期望' + expect[0] + ')' +
        ' | 相近标签=' + near + '(期望' + expect[1] + ')' +
        ' | 提示条=' + note + '(期望' + expect[2] + ')' +
        ' | 计数=' + (meta ? meta.textContent.trim() : '无') +
        ' | 横向溢出=' + overflow + 'px');
  };

  var tab = function (name, cb) { click('[data-tab="' + name + '"]'); later(cb, 220); };

  var record = function (text, cb) {
    q('#smartInput').value = text;
    click('[data-act="parse"]');
    later(function () { var go = q('#cfmGo'); if (go) go.click(); later(cb, 260); }, 320);
  };

  var finish = function () {
    var pre = document.createElement('pre');
    pre.id = 'zzh-probe';
    pre.textContent = lines.join('\\n');
    document.body.appendChild(pre);
  };

  var caseIndex = 0;
  var runCase = function () { finish(); };

  var CASES = [
    /* --- 物料库存 --- */
    { tab: 'stock',  label: '错字：罗丝 → M6/M8螺丝', kw: '罗丝', expect: [2, 2, true] },
    { tab: 'stock',  label: '简称：劳保 → 劳保手套',   kw: '劳保', expect: [1, 0, false] },
    { tab: 'stock',  label: '别名：防水 → 生料带',     kw: '防水', expect: [1, 0, false] },
    { tab: 'stock',  label: '别名：手套 → 劳保手套',   kw: '手套', expect: [1, 0, false] },
    { tab: 'stock',  label: '单字：扳 → 活动扳手',     kw: '扳',   expect: [1, 0, false] },
    { tab: 'stock',  label: '无关词：zzzz 查不到',     kw: 'zzzz', expect: [0, 0, false] },
    { tab: 'stock',  label: '清空关键词恢复全量',      kw: '',     expect: [7, 0, false] },
    /* --- 借还台账（先录一条） --- */
    { tab: 'ledger', label: '精确：张三',              kw: '张三', expect: [1, 0, false] },
    { tab: 'ledger', label: '错字：张四 → 张三',       kw: '张四', expect: [1, 1, true] },
    { tab: 'ledger', label: '错字：罗丝 → M6螺丝',     kw: '罗丝', expect: [1, 1, true] },
    { tab: 'ledger', label: '无关词：zzzz 查不到',     kw: 'zzzz', expect: [0, 0, false] }
  ];

  var step = function (i) {
    if (i >= CASES.length) { finish(); return; }
    var c = CASES[i];
    tab(c.tab, function () {
      search(c.kw, function () {
        measure(c.label, c.kw, c.expect);
        step(i + 1);
      });
    });
  };

  later(function () {
    var x = q('.mask [data-close]'); if (x) x.click();
    later(function () {
      tab('sys', function () {
        click('[data-act="load-demo"]');
        later(function () {
          var ok = q('#cfmOk'); if (ok) ok.click();
          later(function () {
            record('张三借了2个M6螺丝', function () { step(0); });
          }, 300);
        }, 200);
      });
    }, 260);
  }, 700);
})();
`;

const html = APP
  .replace('<head>', '<head>\n<script>try{localStorage.clear();}catch(e){}</script>')
  .replace('</body>', '<script>' + SCENE + '<\/script>\n</body>');

const file = path.join(sandbox, 'probe.html');
fs.writeFileSync(file, html, 'utf8');

const args = [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--hide-scrollbars', '--allow-file-access-from-files',
  '--user-data-dir=' + profile,
  '--window-size=1500,1200',
  '--virtual-time-budget=20000',
  '--dump-dom',
  'file:///' + file.replace(/\\/g, '/')
];

let dom = '';
try {
  dom = cp.execFileSync(EDGE, args, { maxBuffer: 1024 * 1024 * 128, encoding: 'utf8' });
} catch (e) {
  dom = (e.stdout || '') + '';
  if (!dom) { console.error('Edge 执行失败：' + e.message); process.exit(1); }
}

const m = dom.match(/<pre id="zzh-probe">([\s\S]*?)<\/pre>/);
const out = m
  ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  : '（没拿到探针输出，页面脚本可能报错了）';

const lines = out.trim().split('\n').filter(Boolean);
const bad = lines.filter(l => /^BAD|^ERR/.test(l)).length;

fs.writeFileSync(path.join(__dirname, 'probe.txt'), out, 'utf8');
console.log(out);
console.log('\n' + '='.repeat(56));
console.log('共 ' + lines.length + ' 项，异常 ' + bad + ' 项');
process.exit(bad ? 1 : 0);
