/* 用本机 Edge 无头渲染，验证界面真实表现并截图
 * 用法：node test/browser.js
 *
 * 每个场景都是独立自足的：先在 <head> 里清空 localStorage，
 * 再按需载入示例数据，所以场景之间不会互相串数据、串主题。
 *
 * 截图文件名用 ASCII（01-first-open.png 这种），中文说明放在 label 里：
 * 仓库要开源，中文路径在网页里的引用容易出岔子。
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = path.join(__dirname, '..');
const sandbox = 'D:\\WorkBuddyMemory\\ZZH\\_browsertest';   // 纯 ASCII 路径，避免 file:// 中文转义问题
const profile = path.join(sandbox, '_profile');
const shotDir = path.join(root, 'test', 'shots');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const APP = fs.readFileSync(path.join(root, '物料借还管理.html'), 'utf8');

fs.mkdirSync(sandbox, { recursive: true });
fs.mkdirSync(shotDir, { recursive: true });

/* 场景脚本里共用的一段：关掉首次引导 + 载入示例数据 */
const HELPERS = `
  var click = function (sel) { var el = document.querySelector(sel); if (!el) throw new Error('找不到 ' + sel); el.click(); return el; };
  var later = function (fn, ms) { setTimeout(fn, ms || 80); };
  var dismiss = function () { var x = document.querySelector('.mask [data-close]'); if (x) x.click(); };
  var seedDemo = function (cb) {
    click('[data-tab="sys"]');
    later(function () {
      click('[data-act="load-demo"]');
      later(function () {
        var ok = document.querySelector('#cfmOk'); if (ok) ok.click();
        later(cb, 240);
      }, 170);
    }, 80);
  };
  var ask = function (text, cb) {
    var inp = document.querySelector('#smartInput');
    inp.value = text;
    click('[data-act="parse"]');
    later(cb, 320);            // 只弹确认框，不落库
  };
  var feed = function (text, cb) {
    var inp = document.querySelector('#smartInput');
    inp.value = text;
    click('[data-act="parse"]');
    later(function () {
      var go = document.querySelector('#cfmGo');
      if (go) go.click();
      later(cb, 200);
    }, 260);
  };
  var start = function (cb) { later(function () { dismiss(); later(cb, 220); }, 700); };
`;

const scenes = [];

/* ---------- 场景 1：首次打开（引导弹窗 + 空状态） ---------- */
scenes.push({ name: '01-first-open', label: '首次打开', w: 1500, h: 1000, script: '' });

/* ---------- 场景 2：载入示例后的主界面 ---------- */
scenes.push({
  name: '02-main', label: '主界面', w: 1500, h: 1100,
  script: `
  (function(){ ${HELPERS}
    start(function(){ seedDemo(function(){}); });
  })();`
});

/* ---------- 场景 3：智能录入 → 解析确认弹窗（核心） ---------- */
scenes.push({
  name: '03-parse-confirm', label: '智能录入确认', w: 780, h: 880,
  script: `
  (function(){ ${HELPERS}
    start(function(){
      seedDemo(function(){
        ask('张三借了2个M6螺丝', function(){});
      });
    });
  })();`
});

/* ---------- 场景 4：确认写入后的台账 ---------- */
scenes.push({
  name: '04-ledger', label: '写入后台账', w: 1500, h: 900,
  script: `
  (function(){ ${HELPERS}
    start(function(){
      seedDemo(function(){
        feed('张三借了2个M6螺丝', function(){});
      });
    });
  })();`
});

/* ---------- 场景 5：人名打不全 → 模糊匹配提示 ---------- */
scenes.push({
  name: '05-fuzzy-person', label: '人名打不全', w: 1100, h: 1000,
  script: `
  (function(){ ${HELPERS}
    start(function(){
      seedDemo(function(){
        ask('小张借了一把扳手', function(){});
      });
    });
  })();`
});

/* ---------- 场景 6：连续录入后的台账列表 ---------- */
scenes.push({
  name: '06-ledger-multi', label: '连续录入后台账', w: 1500, h: 1100,
  script: `
  (function(){ ${HELPERS}
    start(function(){
      seedDemo(function(){
        feed('李四借了5箱A4纸', function(){
          feed('王五拿了三把活动扳手', function(){
            feed('陈建国借20个轴承6204', function(){});
          });
        });
      });
    });
  })();`
});

/* ---------- 场景 7：数据管理（含操作快照） ---------- */
scenes.push({
  name: '07-data-snapshots', label: '数据管理与快照', w: 1500, h: 1100,
  script: `
  (function(){ ${HELPERS}
    start(function(){
      seedDemo(function(){
        feed('刘工借了1个M8螺丝', function(){
          feed('赵敏借了2卷生料带', function(){
            click('[data-tab="sys"]');
          });
        });
      });
    });
  })();`
});

/* ---------- 场景 8：深色模式（顶栏按钮切换） ---------- */
scenes.push({
  name: '08-dark', label: '深色模式', w: 1500, h: 1100,
  script: `
  (function(){ ${HELPERS}
    start(function(){
      seedDemo(function(){
        feed('张三借了2个M6螺丝', function(){
          click('[data-act="toggle-theme"]');
        });
      });
    });
  })();`
});

/* ---------- 场景 9：手机窄屏（表格转卡片）
 * 注：Edge 无头窗口有最小宽度限制（约 492px），窗口给太小会被钳住、
 * 截图却仍是设定宽度，看起来就像内容被裁掉。所以这里用 492px，
 * 既在 720px 断点内触发窄屏样式，又不会出现假裁切。 ---------- */
scenes.push({
  name: '09-mobile', label: '手机窄屏', w: 492, h: 1600,
  script: `
  (function(){ ${HELPERS}
    start(function(){
      seedDemo(function(){
        // 录一条再回到台账，验证窄屏下的表格卡堆叠
        feed('张三借了2个M6螺丝', function(){
          click('[data-tab="ledger"]');
        });
      });
    });
  })();`
});

/* ---------- 场景 10：模糊查找（错字也找得到，相近的带标签） ---------- */
scenes.push({
  name: '10-fuzzy-search', label: '模糊查找', w: 1500, h: 900,
  script: `
  (function(){ ${HELPERS}
    start(function(){
      seedDemo(function(){
        click('[data-tab="stock"]');
        later(function(){
          var kw = document.querySelector('#fKw');
          kw.value = '罗丝';                       // 故意打错「螺」字
          kw.dispatchEvent(new Event('input', { bubbles: true }));
        }, 120);
      });
    });
  })();`
});

function runScene(s, i) {
  const file = path.join(sandbox, 's' + (i + 1) + '.html');
  // 每个场景先清空本机存储，保证互不影响（主题、示例数据都不会串场）
  const html = APP
    .replace('<head>', '<head>\n<script>try{localStorage.clear();}catch(e){}</script>')
    .replace('</body>', '<script>' + s.script + '<\/script>\n</body>');
  fs.writeFileSync(file, html, 'utf8');

  const shot = path.join(shotDir, s.name + '.png');
  const args = [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--hide-scrollbars',
    '--allow-file-access-from-files',
    '--user-data-dir=' + profile,
    '--window-size=' + (s.w || 1500) + ',' + (s.h || 1500),
    '--force-device-scale-factor=' + (s.scale || 1),
    '--virtual-time-budget=8000',
    '--screenshot=' + shot,
    'file:///' + file.replace(/\\/g, '/')
  ];

  try {
    cp.execFileSync(EDGE, args, { timeout: 90000, stdio: 'ignore' });
    const ok = fs.existsSync(shot);
    return { name: s.name, label: s.label, ok: ok, size: ok ? (fs.statSync(shot).size / 1024).toFixed(0) + 'KB' : '-', shot: shot };
  } catch (e) {
    return { name: s.name, label: s.label, ok: false, err: String(e.message).split('\n')[0].slice(0, 200) };
  }
}

const log = [];
scenes.forEach((s, i) => {
  const r = runScene(s, i);
  log.push((r.ok ? 'OK   ' : 'FAIL ') + s.name.padEnd(20) + (r.label || '') + '  ' + (r.ok ? r.size : r.err));
});

fs.writeFileSync(path.join(__dirname, 'browser.txt'), log.join('\n'), 'utf8');
