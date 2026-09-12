/* ============================================================
   物料借还管理 · 界面层
   ============================================================ */
(function () {
  'use strict';

  var W = window.WLCore;
  var STORE_KEY = 'wl-mgr-db-v2';
  var SNAP_KEY = 'wl-mgr-snapshots-v2';
  var BACKUP_FLAG = 'wl-mgr-last-backup';

  var db = null;
  var state = {
    tab: 'ledger',
    f: { keyword: '', status: '全部', openOnly: false, from: '', to: '' },
    parse: null,
    dirty: false
  };

  /* ================= 小工具 ================= */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function p2(n) { return n < 10 ? '0' + n : '' + n; }
  function toInput(t) {
    var d = W.parseTime(t); if (!d) return '';
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) +
      'T' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  function fromInput(v) {
    if (!v) return W.fmtTime();
    return String(v).replace('T', ' ').slice(0, 16);
  }
  function num(n) { return W.round3(n); }

  /* ================= 图标（Lucide 线性图标，内联 SVG） ================= */

  var ICONS = {
    box: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    warehouse: '<path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    bullseye: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    chart: '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
    list: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    undo: '<path d="M9 14 5 10l4-4"/><path d="M5 10h11a4 4 0 0 1 0 8h-4"/>',
    inbound: '<path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/>',
    outbound: '<path d="m18 9-6-6-6 6"/><path d="M12 3v14"/><path d="M5 21h14"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
    sparkle: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>'
  };

  function icon(name, cls) {
    var d = ICONS[name];
    if (!d) return '';
    return '<svg' + (cls ? ' class="' + cls + '"' : '') +
      ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }

  /* ================= 主题（light / dark） ================= */

  var THEME_KEY = 'wl-mgr-theme';

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) { }
  }

  function toggleTheme() {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    render();
  }

  /* ================= 通知（右下角堆叠，可点掉） ================= */

  var TOAST_ICON = { ok: 'check', err: 'alert', warn: 'alert', info: 'info' };

  function toast(msg, kind) {
    kind = kind || 'info';
    var box = $('#toasts');
    if (!box) return;

    var el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = '<span class="ico">' + icon(TOAST_ICON[kind] || 'info') + '</span>' +
                   '<span class="msg">' + esc(msg) + '</span>';
    box.appendChild(el);

    var timer = setTimeout(dismiss, kind === 'err' ? 4600 : 2800);
    function dismiss() {
      clearTimeout(timer);
      if (!el.parentNode) return;
      el.classList.add('leaving');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
    }
    el.addEventListener('click', dismiss);

    while (box.children.length > 4) box.removeChild(box.firstChild);
  }

  /* ================= 存储 ================= */

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (e) { raw = null; }
    if (raw) {
      try { db = W.migrate(JSON.parse(raw)); } catch (e) { db = W.emptyDB(); }
    } else {
      db = W.emptyDB();
    }
    if (!Array.isArray(db.logs)) db.logs = [];
  }

  function save(silent) {
    db.updatedAt = W.fmtTime();
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(db));
      if (!silent) paintSaved();
    } catch (e) {
      toast('保存失败：浏览器存储空间已满，请先导出备份并清理历史记录', 'err');
    }
  }

  function pushSnapshot(label) {
    try {
      var arr = [];
      try { arr = JSON.parse(localStorage.getItem(SNAP_KEY) || '[]'); } catch (e) { arr = []; }
      arr.unshift({ t: W.fmtTime(), label: label || '', data: JSON.stringify(db) });
      arr = arr.slice(0, 3);
      localStorage.setItem(SNAP_KEY, JSON.stringify(arr));
    } catch (e) { /* 快照失败不影响主流程 */ }
  }

  function log(action, detail) {
    db.logs.unshift({ t: W.fmtTime(), action: action, detail: detail || '' });
    if (db.logs.length > 500) db.logs.length = 500;
  }

  /* ================= 弹窗 ================= */

  var dialogStack = [];

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function openDialog(opt) {
    var mask = document.createElement('div');
    mask.className = 'mask';
    mask.setAttribute('role', 'dialog');
    mask.setAttribute('aria-modal', 'true');
    mask.innerHTML =
      '<div class="dialog' + (opt.wide ? ' wide' : '') + '">' +
        '<div class="dialog-head">' +
          '<h3>' + esc(opt.title || '') + '</h3>' +
          '<button class="x" type="button" data-close="1" aria-label="关闭" title="关闭（Esc）">' + icon('close') + '</button>' +
        '</div>' +
        '<div class="dialog-body">' + (opt.body || '') + '</div>' +
        '<div class="dialog-foot">' + (opt.foot || '<button class="btn" type="button" data-close="1">关闭</button>') + '</div>' +
      '</div>';
    document.body.appendChild(mask);
    dialogStack.push(mask);

    mask.addEventListener('click', function (e) {
      if (e.target === mask) { closeDialog(); return; }
      var c = e.target.closest ? e.target.closest('[data-close]') : null;
      if (c) closeDialog();
    });

    // Esc 关闭；Tab 在弹窗内循环，不会跑到背后的页面上
    mask.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeDialog(); return; }
      if (e.key !== 'Tab') return;
      var list = $$(FOCUSABLE, mask).filter(function (n) { return n.offsetParent !== null; });
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    if (opt.onMount) opt.onMount(mask);
    var firstEl = mask.querySelector('input, select, textarea');
    if (firstEl && opt.autofocus !== false) setTimeout(function () { firstEl.focus(); }, 40);
    return mask;
  }

  function closeDialog() {
    var m = dialogStack.pop();
    if (m && m.parentNode) m.parentNode.removeChild(m);
  }

  function closeAllDialogs() {
    while (dialogStack.length) closeDialog();
  }

  function confirmBox(title, message, onOk, okText) {
    openDialog({
      title: title,
      autofocus: false,
      body: '<div class="help">' + message + '</div>',
      foot: '<button class="btn" type="button" data-close="1" id="cfmCancel">取消</button>' +
            '<button class="btn danger" type="button" id="cfmOk">' + esc(okText || '确定') + '</button>',
      onMount: function (m) {
        m.querySelector('#cfmOk').addEventListener('click', function () {
          closeDialog();
          onOk();
        });
        // 危险操作的默认焦点放在「取消」上，避免手快直接回车
        setTimeout(function () {
          var c = m.querySelector('#cfmCancel');
          if (c) c.focus();
        }, 40);
      }
    });
  }

  /* ================= 通用选择器 ================= */

  /**
   * 通用选择器
   * @param {Function} [searchFields] 取「可搜字段」的函数，不给就只按 getName 过滤
   */
  function pickDialog(title, list, getName, onPick, emptyTip, searchFields) {
    var html = '';
    if (!list.length) {
      html = '<div class="empty">' +
               '<span class="ico">' + icon('inbox') + '</span>' +
               '<span class="t">' + esc(emptyTip || '列表还是空的') + '</span>' +
             '</div>';
    } else {
      html = '<div class="picker-search"><input type="text" id="pickSearch" class="input" ' +
               'placeholder="输入关键字过滤…" style="width:100%" autocomplete="off"></div>' +
             '<div id="pickList" class="picker-list"></div>';
    }
    openDialog({
      title: title,
      body: html,
      onMount: function (m) {
        var box = m.querySelector('#pickList');
        if (!box) return;
        var input = m.querySelector('#pickSearch');

        function draw(kw) {
          var k = String(kw || '').trim();
          var arr;
          if (!k) {
            arr = list.slice();
          } else {
            // 模糊查找：精确命中在前，相近的在后，错一个字也找得到
            arr = [];
            list.forEach(function (x) {
              var m = W.scoreKeyword(k, searchFields ? searchFields(x) : [getName(x)]);
              if (m.score) arr.push({ x: x, score: m.score });
            });
            arr.sort(function (a, b) { return b.score - a.score; });
            arr = arr.map(function (o) { return o.x; });
          }
          if (!arr.length) {
            box.innerHTML = '<div class="empty" style="padding:26px">' +
              '<span class="t">没有匹配项</span>' +
              '<span class="d">换个关键字试试；只记得一半也可以，会按相近的先列出来。</span></div>';
            return;
          }
          box.innerHTML = arr.slice(0, 300).map(function (x) {
            var meta = '';
            if (x.spec) meta += '<span>' + esc(x.spec) + '</span>';
            if (x.unit) meta += '<span>单位 ' + esc(x.unit) + '</span>';
            if (x.stock != null) meta += '<span>库存 ' + num(x.stock) + '</span>';
            return '<div data-i="' + list.indexOf(x) + '" class="picker-item">' +
              '<span class="nm">' + esc(getName(x)) + '</span>' +
              '<span class="meta">' + meta + '</span>' +
            '</div>';
          }).join('');
          Array.prototype.forEach.call(box.querySelectorAll('.picker-item'), function (row) {
            row.addEventListener('click', function () {
              closeDialog();
              onPick(list[+row.getAttribute('data-i')]);
            });
          });
        }
        draw('');
        input.addEventListener('input', function () { draw(input.value); });
      }
    });
  }

  /* ================= 主渲染 ================= */

  function render() {
    $('#app').innerHTML =
      topbarHTML() +
      '<main class="container" style="flex:1 1 auto">' +
        smartHTML() + tabsHTML() + tabBodyHTML() +
      '</main>' +
      footerHTML();
    bindTop();
    paintSaved();
  }

  function paintSaved() {
    var el = $('#savedAt');
    if (el) el.innerHTML = '<span class="dot"></span>已保存 ' + esc((db.updatedAt || '').slice(11));
  }

  function topbarHTML() {
    var lastBk = '';
    try { lastBk = localStorage.getItem(BACKUP_FLAG) || ''; } catch (e) { }

    var backupChip = '';
    if (!lastBk) {
      backupChip = '<button class="chip-btn warn" type="button" data-act="goto-data" ' +
        'title="还没有导出过备份，点这里去导出">' + icon('alert') + '尚未备份</button>';
    } else {
      var days = (Date.now() - (W.parseTime(lastBk) || new Date(0)).getTime()) / 86400000;
      if (days > 7) {
        backupChip = '<button class="chip-btn warn" type="button" data-act="goto-data" ' +
          'title="上次备份：' + esc(lastBk) + '，点这里去导出">' + icon('alert') + '已 ' + Math.floor(days) + ' 天未备份</button>';
      }
    }

    var isDark = currentTheme() === 'dark';
    return '<header class="topbar">' +
      '<div class="container topbar-inner">' +
        '<div class="brand">' +
          '<span class="logo">' + icon('box') + '</span>' +
          '<span class="title">物料借还管理</span>' +
        '</div>' +
        '<button class="chip-btn" type="button" data-act="set-warehouse" title="点击修改仓库名">' +
          icon('warehouse') + esc(db.warehouse || '设置仓库名') +
        '</button>' +
        backupChip +
        '<div class="spacer"></div>' +
        '<span class="save-state" id="savedAt"></span>' +
        '<button class="btn sm" type="button" data-act="export-json" title="导出完整数据文件（建议每周一次）">' +
          icon('download') + '备份</button>' +
        '<button class="icon-btn" type="button" data-act="toggle-theme" ' +
          'title="切换到' + (isDark ? '浅色' : '深色') + '模式（Ctrl+Shift+L）" aria-label="切换主题">' +
          icon(isDark ? 'sun' : 'moon') + '</button>' +
        '<button class="icon-btn" type="button" data-act="print" title="打印台账（Ctrl+P）" aria-label="打印">' +
          icon('printer') + '</button>' +
      '</div>' +
    '</header>';
  }

  function smartHTML() {
    var ex = ['张三借了2个M6螺丝', '李四归还了5箱A4纸', '小张借了一把扳手', '王五拿了三把活动扳手'];
    return '<section class="command no-print">' +
      '<div class="command-box">' +
        icon('sparkle', 'lead-ico') +
        '<input type="text" id="smartInput" autocomplete="off" spellcheck="false" ' +
          'placeholder="说一句话就行，例如：张三借了2个M6螺丝">' +
        '<div class="actions">' +
          '<button class="btn primary" type="button" data-act="parse">' + icon('zap') + '解析</button>' +
          '<button class="btn" type="button" data-act="manual-borrow">' + icon('pencil') + '手工录入</button>' +
        '</div>' +
      '</div>' +
      '<div class="command-meta">' +
        '<span>试试</span>' +
        ex.map(function (t) {
          return '<button class="example" type="button" data-act="ex" data-t="' + esc(t) + '">' + esc(t) + '</button>';
        }).join('') +
        '<span class="push">按 <kbd>/</kbd> 聚焦输入框 · 人名没打全会自动找最相近的让你确认</span>' +
      '</div>' +
    '</section>';
  }

  function tabsHTML() {
    var openCnt = W.filterRecords(db, { openOnly: true }).length;
    var tabs = [
      ['ledger', '借还台账', db.records.length],
      ['stock', '物料库存', db.items.length],
      ['staff', '人员名单', db.staff.length],
      ['stats', '统计概览', ''],
      ['sys', '数据管理', '']
    ];
    return '<nav class="tabs no-print">' + tabs.map(function (t) {
      var active = state.tab === t[0];
      return '<button type="button" data-act="tab" data-tab="' + t[0] + '"' +
        ' class="' + (active ? 'active' : '') + '"' + (active ? ' aria-current="page"' : '') + '>' +
        esc(t[1]) +
        (t[2] !== '' ? '<span class="count">' + t[2] + '</span>' : '') +
        (t[0] === 'ledger' && openCnt ? '<span class="count alert">未还 ' + openCnt + '</span>' : '') +
      '</button>';
    }).join('') + '</nav>';
  }

  function tabBodyHTML() {
    if (state.tab === 'ledger') return ledgerHTML();
    if (state.tab === 'stock') return stockHTML();
    if (state.tab === 'staff') return staffHTML();
    if (state.tab === 'stats') return statsHTML();
    return sysHTML();
  }

  function footerHTML() {
    return '<footer class="footer no-print">' +
      '<div class="container"><div class="row">' +
        '<span>数据保存在本机浏览器，不上传网络</span>' +
        '<span class="sep">·</span>' +
        '<span>请定期点「备份」导出文件保存</span>' +
        '<span class="sep">·</span>' +
        '<span>最后更新 ' + esc(db.updatedAt || '—') + '</span>' +
      '</div></div>' +
    '</footer>';
  }

  /* ---------------- 台账 ---------------- */

  function ledgerHTML() {
    var kw = (state.f.keyword || '').trim();
    var found = W.searchRecords(db, {
      keyword: kw, status: state.f.status,
      openOnly: state.f.openOnly, from: state.f.from, to: state.f.to
    });
    // 有关键词：按匹配度排（精确命中在前、相近的在后，searchRecords 已排好）
    // 没关键词：维持原来的「新的在前」
    var list = found.records;
    if (!kw) {
      list = list.slice().sort(function (a, b) {
        var x = W.parseTime(a.borrowTime), y = W.parseTime(b.borrowTime);
        return (y ? y.getTime() : 0) - (x ? x.getTime() : 0);
      });
    }

    var rows = list.map(function (r, i) {
      var item = W.findById(db.items, r.itemId);
      var remain = W.remainOf(r);
      var done = r.status === '已归还';

      var badge = done
        ? '<span class="badge done">已归还</span>'
        : (r.status === '部分归还'
          ? '<span class="badge part">部分归还 ' + num(r.returnedQty) + '/' + num(r.qty) + '</span>'
          : '<span class="badge out">未归还</span>');

      var stockCell;
      if (!item) stockCell = '<span class="text-dim">—</span>';
      else if (item.stock <= 0) stockCell = '<span class="pill-zero">' + num(item.stock) + '</span>';
      else stockCell = num(item.stock);

      var dim = function (v) {
        return v ? esc(v) : '<span class="text-dim">—</span>';
      };

      var ops = '<span class="row-ops">' +
        (remain > 0
          ? '<button class="btn sm ok" type="button" data-act="return" data-id="' + r.id + '" title="登记归还">' + icon('inbound') + '归还</button>'
          : '') +
        '<button class="btn sm" type="button" data-act="edit-rec" data-id="' + r.id + '" title="编辑这条记录">' + icon('pencil') + '</button>' +
        '<button class="btn sm danger" type="button" data-act="del-rec" data-id="' + r.id + '" title="删除这条记录">' + icon('trash') + '</button>' +
      '</span>';

      return '<tr' + (done ? ' class="muted"' : '') + '>' +
        '<td class="idx">' + (i + 1) + '</td>' +
        '<td data-label="物料"><span class="cell-main">' + esc(r.itemName) + '</span>' +
          (found.fuzzyIds[r.id] ? '<span class="badge gray" title="不是完全匹配，按相近找出来的">相近</span>' : '') +
          (r.itemSpec ? '<span class="cell-sub">' + esc(r.itemSpec) + '</span>' : '') + '</td>' +
        '<td class="num" data-label="借出数量"><span class="qty-strong">' + num(r.qty) + '</span>' +
          (r.unit ? '<span class="unit-dim">' + esc(r.unit) + '</span>' : '') + '</td>' +
        '<td class="num" data-label="当前库存">' + stockCell + '</td>' +
        '<td data-label="借出人">' + dim(r.borrowName) + '</td>' +
        '<td class="num" data-label="借出时间">' + dim(r.borrowTime) + '</td>' +
        '<td data-label="归还人">' + dim(r.returnName) + '</td>' +
        '<td class="num" data-label="归还时间">' + dim(r.returnTime) + '</td>' +
        '<td data-label="状态">' + badge + '</td>' +
        '<td class="ops no-print">' + ops + '</td>' +
      '</tr>';
    }).join('');

    var body = list.length
      ? '<div class="table-wrap"><table class="grid responsive">' +
          '<thead><tr>' +
            '<th>#</th><th>物料</th><th class="right">借出数量</th><th class="right">当前库存</th>' +
            '<th>借出人</th><th>借出时间</th><th>归还人</th><th>归还时间</th><th>状态</th>' +
            '<th class="no-print right">操作</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<div class="empty">' +
          '<span class="ico">' + icon('list') + '</span>' +
          '<span class="t">还没有借还记录</span>' +
          '<span class="d">在上面输入一句话，比如「张三借了2个M6螺丝」，或者点「手工录入」。</span>' +
          '<span class="act"><button class="btn primary" type="button" data-act="focus-input">' +
            icon('zap') + '去输入</button></span>' +
        '</div>';

    return '<div class="panel">' +
      '<div class="panel-head no-print">' +
        '<h3>借还台账</h3>' +
        '<span class="meta">共 ' + list.length + ' 条' +
          (found.fuzzyCount ? ' · 含 ' + found.fuzzyCount + ' 条相近' : '') + '</span>' +
        '<div class="spacer"></div>' +
        '<div class="filters">' +
          '<span class="search-wrap">' + icon('search') +
            '<input type="text" id="fKw" class="input" autocomplete="off" placeholder="搜物料 / 人名 / 备注" value="' + esc(state.f.keyword) + '">' +
          '</span>' +
          '<select id="fStatus" class="select">' +
            ['全部', '借出', '部分归还', '已归还'].map(function (s) {
              return '<option' + (state.f.status === s ? ' selected' : '') + '>' + s + '</option>';
            }).join('') +
          '</select>' +
          '<input type="date" id="fFrom" class="input" value="' + esc(state.f.from) + '" title="借出起始日">' +
          '<span class="text-dim">~</span>' +
          '<input type="date" id="fTo" class="input" value="' + esc(state.f.to) + '" title="借出截止日">' +
          '<label class="check' + (state.f.openOnly ? ' on' : '') + '">' +
            '<input type="checkbox" id="fOpen"' + (state.f.openOnly ? ' checked' : '') + '> 只看未还</label>' +
          '<button class="btn sm" type="button" data-act="clear-filter">清空筛选</button>' +
          '<button class="btn sm" type="button" data-act="export-ledger">' + icon('download') + '导出</button>' +
        '</div>' +
      '</div>' +
      fuzzyNote(found) +
      '<div class="panel-body flush">' + body + '</div>' +
    '</div>';
  }

  /** 有「相近」结果时，在表格上方说明一句，免得用户以为搜索不准 */
  function fuzzyNote(found) {
    if (!found.fuzzyCount) return '';
    var msg = found.exactCount
      ? '另外有 ' + found.fuzzyCount + ' 条是<b>相近</b>结果，已经排在后面并标了「相近」。'
      : '没有完全对得上的，下面 ' + found.fuzzyCount + ' 条是<b>相近</b>结果，标了「相近」。';
    return '<div class="panel-note"><div class="note info">' + icon('search') +
      '<div>' + msg + '搜错一个字也能找到。</div></div></div>';
  }

  /* ---------------- 库存 ---------------- */

  function stockHTML() {
    var kw = (state.f.keyword || '').trim();
    var list = db.items.slice().sort(function (a, b) {
      return W.norm(a.name).localeCompare(W.norm(b.name), 'zh');
    });
    var found = { fuzzyIds: {}, fuzzyCount: 0, exactCount: list.length };
    if (kw) {
      // 有关键词：按匹配度排（精确命中在前、相近的在后）
      var hits = W.searchItems(db, kw);
      list = hits.map(function (h) { return h.item; });
      hits.forEach(function (h) {
        if (h.fuzzy) { found.fuzzyIds[h.item.id] = 1; found.fuzzyCount++; }
      });
      found.exactCount = hits.length - found.fuzzyCount;
    }

    var rows = list.map(function (it, i) {
      var out = 0;
      W.filterRecords(db, { itemId: it.id, openOnly: true }).forEach(function (r) { out += W.remainOf(r); });
      var low = it.stock <= 0;

      var ops = '<span class="row-ops">' +
        '<button class="btn sm" type="button" data-act="stock-in" data-id="' + it.id + '" title="入库 / 盘点校正">' + icon('inbound') + '入库</button>' +
        '<button class="btn sm" type="button" data-act="edit-item" data-id="' + it.id + '" title="编辑物料">' + icon('pencil') + '</button>' +
        '<button class="btn sm danger" type="button" data-act="del-item" data-id="' + it.id + '" title="删除物料">' + icon('trash') + '</button>' +
      '</span>';

      return '<tr>' +
        '<td class="idx">' + (i + 1) + '</td>' +
        '<td data-label="物料">' +
          (it.code ? '<span class="cell-sub" style="margin:0 0 1px">' + esc(it.code) + '</span>' : '') +
          '<span class="cell-main">' + esc(it.name) + '</span>' +
          (found.fuzzyIds[it.id] ? '<span class="badge gray" title="不是完全匹配，按相近找出来的">相近</span>' : '') +
          (it.alias ? '<span class="cell-sub">别名：' + esc(it.alias) + '</span>' : '') +
        '</td>' +
        '<td data-label="规格">' + (it.spec ? esc(it.spec) : '<span class="text-dim">—</span>') + '</td>' +
        '<td data-label="单位">' + (it.unit ? esc(it.unit) : '<span class="text-dim">—</span>') + '</td>' +
        '<td class="num" data-label="当前库存">' +
          (low ? '<span class="pill-zero">' + num(it.stock) + '</span>' : '<span class="qty-strong">' + num(it.stock) + '</span>') +
        '</td>' +
        '<td class="num" data-label="借出在外">' +
          (out ? '<span class="text-warn">' + num(out) + '</span>' : '<span class="text-dim">0</span>') +
        '</td>' +
        '<td class="num" data-label="账面合计">' + num(it.stock + out) + '</td>' +
        '<td class="ops no-print">' + ops + '</td>' +
      '</tr>';
    }).join('');

    var body = list.length
      ? '<div class="table-wrap"><table class="grid responsive">' +
          '<thead><tr>' +
            '<th>#</th><th>物料名称</th><th>规格</th><th>单位</th>' +
            '<th class="right">当前库存</th><th class="right">借出在外</th><th class="right">账面合计</th>' +
            '<th class="no-print right">操作</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<div class="empty">' +
          '<span class="ico">' + icon('box') + '</span>' +
          '<span class="t">还没有物料</span>' +
          '<span class="d">可以从 Excel 里复制几列直接粘贴导入，一行一个物料。</span>' +
          '<span class="act">' +
            '<button class="btn primary" type="button" data-act="bulk-import">' + icon('upload') + '批量导入</button>' +
            '<button class="btn" type="button" data-act="add-item">' + icon('plus') + '新增物料</button>' +
          '</span>' +
        '</div>';

    return '<div class="panel">' +
      '<div class="panel-head no-print">' +
        '<h3>物料库存</h3>' +
        '<span class="meta">共 ' + list.length + ' 种' +
          (found.fuzzyCount ? ' · 含 ' + found.fuzzyCount + ' 种相近' : '') + '</span>' +
        '<div class="spacer"></div>' +
        '<div class="filters">' +
          '<span class="search-wrap">' + icon('search') +
            '<input type="text" id="fKw" class="input" autocomplete="off" placeholder="搜名称 / 编码 / 规格 / 别名" value="' + esc(state.f.keyword) + '">' +
          '</span>' +
          '<button class="btn sm primary" type="button" data-act="add-item">' + icon('plus') + '新增物料</button>' +
          '<button class="btn sm" type="button" data-act="bulk-import">' + icon('upload') + '批量导入</button>' +
          '<button class="btn sm" type="button" data-act="export-stock">' + icon('download') + '导出</button>' +
        '</div>' +
      '</div>' +
      fuzzyNote(found) +
      '<div class="panel-body flush">' + body + '</div>' +
    '</div>';
  }

  /* ---------------- 人员 ---------------- */

  function staffHTML() {
    var rows = db.staff.map(function (s, i) {
      var cnt = 0, outCnt = 0, outQty = 0;
      db.records.forEach(function (r) {
        if (W.similarity(s.name, r.borrowName) === 1) {
          cnt++;
          if (W.isOpen(r)) { outCnt++; outQty += W.remainOf(r); }
        }
      });
      var ops = '<span class="row-ops">' +
        '<button class="btn sm" type="button" data-act="edit-staff" data-id="' + s.id + '" title="编辑">' + icon('pencil') + '</button>' +
        '<button class="btn sm danger" type="button" data-act="del-staff" data-id="' + s.id + '" title="移除">' + icon('trash') + '</button>' +
      '</span>';

      return '<tr>' +
        '<td class="idx">' + (i + 1) + '</td>' +
        '<td data-label="姓名"><span class="cell-main">' + esc(s.name) + '</span></td>' +
        '<td data-label="部门">' + (s.dept ? esc(s.dept) : '<span class="text-dim">—</span>') + '</td>' +
        '<td data-label="电话">' + (s.phone ? '<span class="mono">' + esc(s.phone) + '</span>' : '<span class="text-dim">—</span>') + '</td>' +
        '<td class="num" data-label="累计借出">' + cnt + '</td>' +
        '<td class="num" data-label="当前未还">' +
          (outCnt ? '<span class="text-danger">' + outCnt + ' 笔 / ' + num(outQty) + '</span>' : '<span class="text-dim">无</span>') +
        '</td>' +
        '<td data-label="备注">' + (s.note ? esc(s.note) : '<span class="text-dim">—</span>') + '</td>' +
        '<td class="ops no-print">' + ops + '</td>' +
      '</tr>';
    }).join('');

    var body = db.staff.length
      ? '<div class="table-wrap"><table class="grid responsive">' +
          '<thead><tr>' +
            '<th>#</th><th>姓名</th><th>部门</th><th>电话</th>' +
            '<th class="right">累计借出</th><th class="right">当前未还</th><th>备注</th>' +
            '<th class="no-print right">操作</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<div class="empty">' +
          '<span class="ico">' + icon('users') + '</span>' +
          '<span class="t">还没有人员名单</span>' +
          '<span class="d">把常来借东西的同事加进来，「人名打不全」时才找得到人。</span>' +
          '<span class="act">' +
            '<button class="btn primary" type="button" data-act="bulk-staff">' + icon('upload') + '批量导入</button>' +
            '<button class="btn" type="button" data-act="add-staff">' + icon('plus') + '新增人员</button>' +
          '</span>' +
        '</div>';

    return '<div class="panel">' +
      '<div class="panel-head no-print">' +
        '<h3>人员名单</h3>' +
        '<span class="meta">共 ' + db.staff.length + ' 人</span>' +
        '<div class="spacer"></div>' +
        '<div class="filters">' +
          '<button class="btn sm primary" type="button" data-act="add-staff">' + icon('plus') + '新增人员</button>' +
          '<button class="btn sm" type="button" data-act="bulk-staff">' + icon('upload') + '批量导入</button>' +
        '</div>' +
      '</div>' +
      '<div class="panel-body flush">' + body + '</div>' +
      '<div class="panel-body" style="border-top:1px solid var(--border-soft)">' +
        '<div class="note info" style="margin:0">' + icon('info') +
          '<span><b>名单越全，识别越准。</b>同事只要在记录里出现过就会被自动记住，' +
          '但主动把全车间的人加进来，遇到「小王」「老李」这种叫法时才能准确找到人。</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---------------- 统计 ---------------- */

  function statsHTML() {
    var st = W.computeStats(db);
    var openList = W.filterRecords(db, { openOnly: true });
    openList.sort(function (a, b) {
      return (W.parseTime(a.borrowTime) || 0) - (W.parseTime(b.borrowTime) || 0);
    });
    var now = Date.now();

    var rows = openList.map(function (r, i) {
      var days = Math.floor((now - (W.parseTime(r.borrowTime) || now)) / 86400000);
      var hot = days > st.overdueDays;
      return '<tr>' +
        '<td class="idx">' + (i + 1) + '</td>' +
        '<td data-label="物料"><span class="cell-main">' + esc(r.itemName) + '</span></td>' +
        '<td class="num" data-label="未还数量"><span class="qty-strong">' + num(W.remainOf(r)) + '</span>' +
          (r.unit ? '<span class="unit-dim">' + esc(r.unit) + '</span>' : '') + '</td>' +
        '<td data-label="借出人">' + esc(r.borrowName) + '</td>' +
        '<td class="num" data-label="借出时间">' + esc(r.borrowTime) + '</td>' +
        '<td class="num" data-label="已借天数">' +
          (hot ? '<span class="badge out">已 ' + days + ' 天</span>' : '<span class="text-dim">' + days + ' 天</span>') +
        '</td>' +
        '<td data-label="备注">' + (r.note ? esc(r.note) : '<span class="text-dim">—</span>') + '</td>' +
      '</tr>';
    }).join('');

    var byPerson = st.topPerson.slice(0, 12).map(function (p) {
      return '<tr>' +
        '<td data-label="借出人"><span class="cell-main">' + esc(p.name) + '</span></td>' +
        '<td class="num right" data-label="未还数量合计">' + num(p.qty) + '</td>' +
      '</tr>';
    }).join('');

    return '<div class="cards" style="margin-bottom:16px">' +
        card('物料种类', st.itemKinds, '种', 'box') +
        card('库存合计', st.totalStock, '', 'database') +
        card('借出在外', st.totalOut, '', 'outbound', st.totalOut ? 'alert' : '') +
        card('未归还笔数', st.openCount, '', 'clock', st.openCount ? 'alert' : '') +
        card('超 ' + st.overdueDays + ' 天未还', st.overdueCount, '', 'alert', st.overdueCount ? 'danger' : '') +
        card('累计记录', st.totalRecords, '条', 'list') +
      '</div>' +

      '<div class="panel">' +
        '<div class="panel-head">' +
          '<h3>未归还明细</h3>' +
          '<span class="meta">' + openList.length + ' 笔</span>' +
          '<div class="spacer"></div>' +
          '<button class="btn sm no-print" type="button" data-act="export-open">' + icon('download') + '导出清单</button>' +
        '</div>' +
        '<div class="panel-body flush">' +
          (openList.length
            ? '<div class="table-wrap"><table class="grid responsive">' +
                '<thead><tr><th>#</th><th>物料</th><th class="right">未还数量</th><th>借出人</th>' +
                '<th>借出时间</th><th>已借天数</th><th>备注</th></tr></thead>' +
                '<tbody>' + rows + '</tbody></table></div>'
            : '<div class="empty">' +
                '<span class="ico">' + icon('check') + '</span>' +
                '<span class="t">所有借出的东西都已归还</span>' +
                '<span class="d">台账是干净的，不用催任何人。</span>' +
              '</div>') +
        '</div>' +
      '</div>' +

      (byPerson
        ? '<div class="panel">' +
            '<div class="panel-head"><h3>谁手上东西最多</h3>' +
            '<span class="meta">按未还数量排序</span></div>' +
            '<div class="panel-body flush"><div class="table-wrap"><table class="grid responsive">' +
            '<thead><tr><th>借出人</th><th class="right">未还数量合计</th></tr></thead>' +
            '<tbody>' + byPerson + '</tbody></table></div></div></div>'
        : '');
  }

  function card(label, value, unit, iconName, cls) {
    return '<div class="card' + (cls ? ' ' + cls : '') + '">' +
      '<div class="k">' + (iconName ? icon(iconName) : '') + esc(label) + '</div>' +
      '<div class="v">' + esc(value) + (unit ? '<span class="u">' + esc(unit) + '</span>' : '') + '</div>' +
    '</div>';
  }

  /* ---------------- 数据管理 ---------------- */

  function getSnapshots() {
    try { return JSON.parse(localStorage.getItem(SNAP_KEY) || '[]') || []; }
    catch (e) { return []; }
  }

  function snapshotsHTML() {
    var arr = getSnapshots();
    if (!arr.length) return '';
    var rows = arr.map(function (s, i) {
      var d = null;
      try { d = JSON.parse(s.data); } catch (e) { d = null; }
      var cnt = d ? ((d.items || []).length + ' 种物料 / ' + (d.records || []).length + ' 条记录') : '已损坏';
      return '<tr>' +
        '<td class="idx">' + (i + 1) + '</td>' +
        '<td class="num" data-label="时间">' + esc(s.t) + '</td>' +
        '<td data-label="这次操作">' + esc(s.label || '—') + '</td>' +
        '<td data-label="当时的数据量">' + esc(cnt) + '</td>' +
        '<td class="ops no-print"><span class="row-ops">' +
          '<button class="btn sm" type="button" data-act="restore-snap" data-id="' + i + '">' +
            icon('undo') + '退回这时候</button>' +
        '</span></td>' +
      '</tr>';
    }).join('');

    return '<div class="panel">' +
      '<div class="panel-head">' +
        '<h3>最近操作快照</h3>' +
        '<span class="meta">每次改动前自动留存，最多 3 份</span>' +
      '</div>' +
      '<div class="panel-body flush"><div class="table-wrap"><table class="grid responsive">' +
      '<thead><tr><th>#</th><th>时间</th><th>这次操作</th><th>当时的数据量</th>' +
      '<th class="no-print right">操作</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div></div>';
  }

  function sysHTML() {
    var size = 0;
    try { size = (localStorage.getItem(STORE_KEY) || '').length; } catch (e) { }
    var lastBk = '';
    try { lastBk = localStorage.getItem(BACKUP_FLAG) || ''; } catch (e) { }

    return snapshotsHTML() +

    '<div class="panel">' +
      '<div class="panel-head"><h3>数据概览与设置</h3></div>' +
      '<div class="panel-body">' +
        '<div class="note info">' + icon('shield') +
          '<span>数据保存在<b>本机浏览器</b>里，不上传任何服务器。换电脑、重装系统、清理浏览器数据都会导致丢失，' +
          '请养成<b>每周导出一次备份</b>的习惯。</span>' +
        '</div>' +

        '<div class="cards" style="margin-bottom:18px">' +
          card('物料', db.items.length, '种', 'box') +
          card('人员', db.staff.length, '人', 'users') +
          card('记录', db.records.length, '条', 'list') +
          card('占用空间', (size / 1024).toFixed(1), 'KB', 'database') +
        '</div>' +

        '<div class="form-grid">' +
          '<div class="field"><label>仓库 / 班组名称</label>' +
            '<input type="text" id="whInput" value="' + esc(db.warehouse || '') + '" placeholder="例如：一号车间工具库">' +
            '<span class="tip">会显示在标题栏和导出的表格里</span></div>' +
          '<div class="field"><label>逾期提醒天数</label>' +
            '<input type="number" id="odInput" min="1" max="365" value="' + (db.settings.overdueDays || 30) + '">' +
            '<span class="tip">借出超过这么多天，统计页会标红</span></div>' +
        '</div>' +
        '<div style="margin-top:14px">' +
          '<button class="btn primary" type="button" data-act="save-settings">' + icon('check') + '保存设置</button>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="panel">' +
      '<div class="panel-head">' +
        '<h3>备份与导出</h3>' +
        '<span class="meta">' + (lastBk ? '上次备份：' + esc(lastBk) : '还没有备份过') + '</span>' +
      '</div>' +
      '<div class="panel-body">' +
        '<div class="cards">' +

          '<div class="card plain">' +
            '<div class="card-title">① 完整备份</div>' +
            '<div class="desc">生成一个 <code>.json</code> 文件，包含全部数据。' +
            '换电脑时用它「恢复备份」即可原样还原。</div>' +
            '<button class="btn primary" type="button" data-act="export-json">' + icon('download') + '导出完整备份</button>' +
          '</div>' +

          '<div class="card plain">' +
            '<div class="card-title">② 恢复备份</div>' +
            '<div class="desc">选择之前导出的 <code>.json</code> 文件还原数据。' +
            '<b style="color:var(--danger)">会覆盖当前全部数据</b>。</div>' +
            '<button class="btn" type="button" data-act="import-json">' + icon('upload') + '选择备份文件</button>' +
          '</div>' +

          '<div class="card plain">' +
            '<div class="card-title">③ 导出 Excel</div>' +
            '<div class="desc">导出成 <code>.csv</code>，用 Excel 或 WPS 双击即可打开，可直接打印上报。</div>' +
            '<div class="row-flex">' +
              '<button class="btn sm" type="button" data-act="export-ledger">台账</button>' +
              '<button class="btn sm" type="button" data-act="export-stock">库存</button>' +
              '<button class="btn sm" type="button" data-act="export-open">未还清单</button>' +
            '</div>' +
          '</div>' +

          '<div class="card plain">' +
            '<div class="card-title">④ 打印</div>' +
            '<div class="desc">直接打印当前台账，用于现场核对或贴墙公示。</div>' +
            '<button class="btn" type="button" data-act="print">' + icon('printer') + '打印台账</button>' +
          '</div>' +

        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="panel">' +
      '<div class="panel-head"><h3>搬运与维护</h3></div>' +
      '<div class="panel-body">' +
        '<div class="help">' +
          '<b>怎么把工具搬到另一台电脑？</b>' +
          '<ol>' +
            '<li>在这台电脑点「导出完整备份」，得到一个 <code>.json</code> 文件</li>' +
            '<li>把整个文件夹（含 <code>物料借还管理.html</code>）连同 json 一起拷到 U 盘</li>' +
            '<li>在新电脑双击 html 打开，点「选择备份文件」还原即可</li>' +
          '</ol>' +
        '</div>' +
        '<div class="row-flex" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border-soft)">' +
          '<button class="btn" type="button" data-act="load-demo">' + icon('sparkle') + '载入示例数据</button>' +
          '<button class="btn danger" type="button" data-act="clear-data">' + icon('trash') + '清空全部数据</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ================= 事件绑定 ================= */

  function bindTop() {
    var inp = $('#smartInput');
    if (inp) {
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); doParse(inp.value); }
      });
    }

    var kw = $('#fKw');
    if (kw) {
      var t = null;
      kw.addEventListener('input', function () {
        clearTimeout(t);
        var v = kw.value;
        t = setTimeout(function () {
          state.f.keyword = v;
          var pos = kw.selectionStart;
          render();
          var el = $('#fKw');
          if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) { } }
        }, 260);
      });
    }
    var st = $('#fStatus');
    if (st) st.addEventListener('change', function () { state.f.status = st.value; render(); });
    var ff = $('#fFrom');
    if (ff) ff.addEventListener('change', function () { state.f.from = ff.value; render(); });
    var ft = $('#fTo');
    if (ft) ft.addEventListener('change', function () { state.f.to = ft.value; render(); });
    var fo = $('#fOpen');
    if (fo) {
      fo.addEventListener('change', function () {
        state.f.openOnly = fo.checked;
        render();
        var again = $('#fOpen');
        if (again) again.focus();
      });
    }
  }

  /* 全局快捷键：不打扰正在输入的人，弹窗打开时也自动让位 */
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName || '').toLowerCase();
    var typing = tag === 'input' || tag === 'textarea' || tag === 'select' ||
                 (e.target && e.target.isContentEditable);

    // Ctrl/Cmd + Shift + L —— 切换明暗主题
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      toggleTheme();
      return;
    }

    if (document.querySelector('.mask') || typing) return;

    // "/" —— 聚焦到命令输入框
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      var inp = $('#smartInput');
      if (inp) inp.focus();
      return;
    }

    // 1~5 —— 快速切换标签页
    if (/^[1-5]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      var order = ['ledger', 'stock', 'staff', 'stats', 'sys'];
      var next = order[parseInt(e.key, 10) - 1];
      if (next && next !== state.tab) {
        e.preventDefault();
        state.tab = next;
        state.f.keyword = '';
        render();
      }
    }
  });

  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el) return;
    var act = el.getAttribute('data-act');
    var id = el.getAttribute('data-id');
    var handlers = {
      'tab': function () { state.tab = el.getAttribute('data-tab'); state.f.keyword = ''; render(); },
      'goto-data': function () { state.tab = 'sys'; render(); },
      'toggle-theme': toggleTheme,
      'focus-input': function () { var i = $('#smartInput'); if (i) i.focus(); },
      'ex': function () { var i = $('#smartInput'); i.value = el.getAttribute('data-t'); i.focus(); },
      'parse': function () { doParse($('#smartInput').value); },
      'manual-borrow': manualEntry,
      'set-warehouse': setWarehouse,
      'clear-filter': function () { state.f = { keyword: '', status: '全部', openOnly: false, from: '', to: '' }; render(); },
      'return': function () { returnDialog(id); },
      'edit-rec': function () { editRecordDialog(id); },
      'del-rec': function () { delRecord(id); },
      'add-item': function () { itemDialog(null); },
      'edit-item': function () { itemDialog(id); },
      'del-item': function () { delItem(id); },
      'stock-in': function () { stockInDialog(id); },
      'bulk-import': bulkImportItems,
      'add-staff': function () { staffDialog(null); },
      'edit-staff': function () { staffDialog(id); },
      'del-staff': function () { delStaff(id); },
      'bulk-staff': bulkImportStaff,
      'save-settings': saveSettings,
      'restore-snap': function () { restoreSnapshot(parseInt(id, 10)); },
      'load-demo': loadDemo,
      'clear-data': clearData,
      'print': function () { state.tab = 'ledger'; render(); setTimeout(function () { window.print(); }, 120); },
      'export-json': exportJSON,
      'import-json': importJSON,
      'export-ledger': function () { exportCSV('台账', ledgerCSV()); },
      'export-stock': function () { exportCSV('库存', stockCSV()); },
      'export-open': function () { exportCSV('未还清单', openCSV()); }
    };
    if (handlers[act]) { e.preventDefault(); handlers[act](); }
  });

  /* ================= 智能录入 ================= */

  function doParse(text) {
    text = String(text || '').trim();
    if (!text) { toast('先输入一句话'); return; }
    if (!db.items.length && !db.staff.length) {
      confirmBox('提示', '还没有物料和人员名单，解析会很吃力。<br>要不要先载入一些示例数据熟悉一下？',
        function () { loadDemo(function () { doParse(text); }); }, '载入示例');
      return;
    }
    var res = W.parseCommand(text, db);
    state.parse = {
      raw: text,
      action: res.action,
      item: res.item,
      itemText: res.itemText,
      itemCandidates: res.itemCandidates,
      itemConfidence: res.itemConfidence,
      person: res.person,
      personText: res.personText,
      personCandidates: res.personCandidates,
      personConfidence: res.personConfidence,
      qty: res.qty,
      unit: res.unit || (res.item && res.item.unit) || '',
      unitFromItem: !res.unit && !!(res.item && res.item.unit),
      time: W.fmtTime(),
      recordId: null,
      note: '',
      warnings: res.warnings.slice()
    };
    if (res.action === 'return') pickReturnTarget();
    renderConfirm();
  }

  /** 归还时，找出可能对应的未还记录 */
  function pickReturnTarget() {
    var p = state.parse;
    var cands = W.findOpenRecords(db, {
      itemId: p.item ? p.item.id : null,
      personKeyword: p.person ? p.person.name : p.personText
    });
    if (cands.length === 1) p.recordId = cands[0].id;
    else if (cands.length > 1) {
      // 多条时优先取「人名+物料」都吻合的
      var exact = cands.filter(function (r) {
        return (!p.item || r.itemId === p.item.id) &&
          (!p.person || W.norm(r.borrowName) === W.norm(p.person.name));
      });
      p.recordId = exact.length ? exact[0].id : null;
    } else p.recordId = null;
    p.returnCandidates = cands;
  }

  function renderConfirm() {
    closeAllDialogs();
    openDialog({
      title: '确认一下，没问题就写入',
      wide: true,
      body: confirmBodyHTML(),
      foot: '<span class="left" id="cfmTip"></span>' +
            '<button class="btn" data-close="1">取消</button>' +
            '<button class="btn primary" id="cfmGo">确认写入</button>',
      onMount: function (m) { bindConfirm(m); }
    });
  }

  function confirmBodyHTML() {
    var p = state.parse;
    var isRet = p.action === 'return';

    /* --- 警告 --- */
    var warnHtml = '';
    if (p.personConfidence === 'medium') {
      warnHtml += '<div class="note warn">' + icon('search') +
        '<div><b>姓名没打全</b>：你说的「' + esc(p.personText) +
        '」我理解为 <b>' + esc(p.person ? p.person.name : '') +
        '</b>。不对的话，点下面的人名换一个。</div></div>';
    }
    if (p.itemConfidence === 'medium') {
      warnHtml += '<div class="note warn">' + icon('search') +
        '<div><b>物料名不完全一致</b>：你说的「' + esc(p.itemText) +
        '」我理解为 <b>' + esc(p.item ? p.item.name : '') +
        '</b>。不对的话，点下面的物料换一个。</div></div>';
    }
    // 警告分两级：没找到的用红条，有歧义（多个候选）的用黄条。
    // 「不完全一致 / 没打全」已经由上面两个专属提示条表达，这里不再重复。
    var severe = p.warnings.filter(function (w) { return !/不完全一致|没打全/.test(w); });
    var mild = severe.filter(function (w) { return /多个物料|多个人名|出现了多个/.test(w); });
    severe = severe.filter(function (w) { return mild.indexOf(w) === -1; });

    if (severe.length) {
      warnHtml += '<div class="note danger">' + icon('alert') +
        '<div>' + severe.map(esc).join('<br>') + '</div></div>';
    }
    if (mild.length) {
      warnHtml += '<div class="note warn">' + icon('info') +
        '<div>' + mild.map(esc).join('<br>') + '</div></div>';
    }

    /* --- 动作 --- */
    var actionHtml = '<div class="chips">' +
      '<button type="button" class="chip' + (!isRet ? ' on' : '') + '" data-p="action" data-v="borrow">' +
        icon('outbound') + '借出（扣库存）</button>' +
      '<button type="button" class="chip' + (isRet ? ' on' : '') + '" data-p="action" data-v="return">' +
        icon('inbound') + '归还（加库存）</button>' +
    '</div>';

    /* --- 借出人 --- */
    var pChips = '';
    if (p.person) {
      pChips += '<button type="button" class="chip on" data-p="person" data-v="' + p.person.id + '">' +
        esc(p.person.name) + '</button>';
    }
    p.personCandidates.forEach(function (c) {
      if (p.person && c.value.id === p.person.id) return;
      var pct = Math.round(c.score * 100);
      pChips += '<button type="button" class="chip" data-p="person" data-v="' + c.value.id + '" title="相似度 ' + pct + '%">' +
        esc(c.name) + (pct >= 30 && pct < 100 ? '<span class="score">' + pct + '%</span>' : '') + '</button>';
    });
    pChips += '<button type="button" class="chip add" data-p="new-person">' + icon('plus') + '新同事</button>';
    pChips += '<button type="button" class="chip" data-p="pick-person">' + icon('users') + '从名单里选</button>';

    /* --- 物料 --- */
    var iChips = '';
    if (p.item) {
      iChips += '<button type="button" class="chip on" data-p="item" data-v="' + p.item.id + '">' +
        esc(p.item.name) + '</button>';
    }
    p.itemCandidates.forEach(function (c) {
      if (p.item && c.value.id === p.item.id) return;
      var pct = Math.round(c.score * 100);
      iChips += '<button type="button" class="chip" data-p="item" data-v="' + c.value.id + '" title="相似度 ' + pct + '%">' +
        esc(c.name) + (pct >= 30 && pct < 100 ? '<span class="score">' + pct + '%</span>' : '') + '</button>';
    });
    if (p.itemText && (!p.item || W.norm(p.itemText) !== W.norm(p.item.name))) {
      iChips += '<button type="button" class="chip new" data-p="new-item" data-v="' + esc(p.itemText) + '">' +
        icon('plus') + '新建「' + esc(p.itemText) + '」</button>';
    } else {
      iChips += '<button type="button" class="chip add" data-p="new-item">' + icon('plus') + '新建物料</button>';
    }
    iChips += '<button type="button" class="chip" data-p="pick-item">' + icon('box') + '从库存里选</button>';

    /* --- 归还目标 --- */
    var retHtml = '';
    if (isRet) {
      var cands = W.findOpenRecords(db, {
        itemId: p.item ? p.item.id : null,
        personKeyword: p.person ? p.person.name : p.personText
      });
      if (!cands.length) {
        retHtml = '<div class="note danger">' + icon('alert') +
          '<div>没找到对应的未还记录。换个人名或物料再看看，或者去台账页直接点「归还」。</div></div>';
      } else {
        retHtml = '<div class="p-row"><div class="lbl">归还哪笔</div><div class="val">' +
          cands.map(function (r) {
            var on = p.recordId === r.id;
            return '<button type="button" class="record-option' + (on ? ' on' : '') + '" data-p="record" data-v="' + r.id + '">' +
              '<span class="mark"></span>' +
              '<span class="body">' +
                '<span class="t">' + esc(r.borrowName) + ' 借的 ' + esc(r.itemName) + '</span>' +
                '<span class="d">未还 ' + num(W.remainOf(r)) + ' ' + esc(r.unit || '') +
                  ' · ' + esc((r.borrowTime || '').slice(0, 16)) + '</span>' +
              '</span></button>';
          }).join('') + '</div></div>';
      }
      if (p.recordId) {
        var rc = W.findById(db.records, p.recordId);
        if (rc) p.qty = Math.min(p.qty, W.remainOf(rc)) || W.remainOf(rc);
      }
    }

    return warnHtml +
      '<div class="echo">你说的是：<b>' + esc(p.raw) + '</b></div>' +
      '<div class="p-row"><div class="lbl">动作</div><div class="val">' + actionHtml + '</div></div>' +
      '<div class="p-row"><div class="lbl">' + (isRet ? '归还人' : '借出人') + '</div><div class="val"><div class="chips">' + pChips + '</div></div></div>' +
      '<div class="p-row"><div class="lbl">物料</div><div class="val"><div class="chips">' + iChips + '</div></div></div>' +
      '<div class="p-row"><div class="lbl">数量</div><div class="val"><div class="stepper">' +
        '<button type="button" class="step" data-p="qty-" title="减 1" aria-label="减 1">' + icon('minus') + '</button>' +
        '<input type="number" id="pq" min="0.01" step="1" value="' + p.qty + '" aria-label="数量">' +
        '<input type="text" id="pu" class="unit-input" placeholder="单位" value="' + esc(p.unit) + '" aria-label="单位">' +
        '<button type="button" class="step" data-p="qty+" title="加 1" aria-label="加 1">' + icon('plus') + '</button>' +
      '</div></div></div>' +
      '<div class="p-row"><div class="lbl">时间</div><div class="val">' +
        '<input type="datetime-local" id="ptime" class="input" value="' + toInput(p.time) + '">' +
      '</div></div>' +
      '<div class="p-row"><div class="lbl">备注</div><div class="val">' +
        '<input type="text" id="pnote" class="input" placeholder="可不填，例如：用于3号线检修" value="' + esc(p.note) + '">' +
      '</div></div>' +
      retHtml;
  }

  function bindConfirm(mask) {
    var p = state.parse;

    mask.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-p]') : null;
      if (!el) return;
      var key = el.getAttribute('data-p');
      var v = el.getAttribute('data-v');
      e.preventDefault();
      readConfirmInputs(mask);

      if (key === 'action') {
        p.action = v;
        if (v === 'return') pickReturnTarget();
        else p.recordId = null;
      } else if (key === 'qty-') {
        p.qty = Math.max(0.01, num((p.qty || 1) - 1));
      } else if (key === 'qty+') {
        p.qty = num((p.qty || 0) + 1);
      } else if (key === 'person') {
        p.person = W.findById(db.staff, v);
        p.personConfidence = 'high';
        p.personText = p.person ? p.person.name : '';
        if (p.action === 'return') pickReturnTarget();
      } else if (key === 'item') {
        p.item = W.findById(db.items, v);
        p.itemConfidence = 'high';
        p.itemText = p.item ? p.item.name : '';
        if (p.item && p.item.unit) p.unit = p.item.unit;
        if (p.action === 'return') pickReturnTarget();
      } else if (key === 'record') {
        p.recordId = v;
      } else if (key === 'new-person') {
        return inputDialog('新增同事', '姓名', function (name) {
          var s = W.ensureStaff(db, name);
          save();
          p.person = s; p.personText = s.name; p.personConfidence = 'high';
          if (p.action === 'return') pickReturnTarget();
          renderConfirm();
        });
      } else if (key === 'new-item') {
        return inputDialog('新建物料', '物料名称', function (name) {
          var it = W.ensureItem(db, name, p.unit);
          save();
          p.item = it; p.itemText = it.name; p.itemConfidence = 'high';
          if (p.action === 'return') pickReturnTarget();
          renderConfirm();
        }, v || '');
      } else if (key === 'pick-person') {
        return pickDialog('选择人员', db.staff, function (s) { return s.name; }, function (s) {
          p.person = s; p.personText = s.name; p.personConfidence = 'high';
          if (p.action === 'return') pickReturnTarget();
          renderConfirm();
        }, '名单还是空的，先新增同事');
      } else if (key === 'pick-item') {
        return pickDialog('选择物料', db.items, function (it) { return it.name; }, function (it) {
          p.item = it; p.itemText = it.name; p.itemConfidence = 'high';
          if (it.unit) p.unit = it.unit;
          if (p.action === 'return') pickReturnTarget();
          renderConfirm();
        }, '还没有物料，先新增物料', W.itemSearchFields);
      }
      renderConfirm();
    });

    mask.querySelector('#cfmGo').addEventListener('click', function () {
      readConfirmInputs(mask);
      commitParse();
    });

    var tip = mask.querySelector('#cfmTip');
    function updateTip() {
      readConfirmInputs(mask);
      var msgs = [];
      if (!p.person) msgs.push('还没确定借出人');
      if (!p.item) msgs.push('还没确定物料');
      if (p.action === 'return' && !p.recordId) msgs.push('请选择要归还的记录');
      tip.innerHTML = msgs.length ? '<span style="color:var(--danger)">' + msgs.join('、') + '</span>' : '检查无误后点右边确认';
    }
    mask.querySelector('#pq').addEventListener('input', updateTip);
    mask.addEventListener('input', function () { updateTip(); });
    setTimeout(updateTip, 0);
  }

  function readConfirmInputs(mask) {
    var p = state.parse;
    var q = mask.querySelector('#pq');
    var u = mask.querySelector('#pu');
    var t = mask.querySelector('#ptime');
    var n = mask.querySelector('#pnote');
    if (q) { var v = parseFloat(q.value); if (!isNaN(v) && v > 0) p.qty = v; }
    if (u) p.unit = u.value.trim();
    if (t) p.time = fromInput(t.value);
    if (n) p.note = n.value.trim();
  }

  function commitParse() {
    var p = state.parse;
    if (!p.person) { toast('请先确定借出人/归还人'); return; }
    if (!p.item) { toast('请先确定物料'); return; }

    // 人名/物料可能是新建的临时对象，确保入库
    var staff = W.ensureStaff(db, p.person.name);
    var item = W.findById(db.items, p.item.id) || W.ensureItem(db, p.item.name, p.unit);
    if (p.unit && !item.unit) item.unit = p.unit;

    pushSnapshot(p.action === 'return' ? '归还登记前' : '借出登记前');
    var out;
    if (p.action === 'return') {
      if (!p.recordId) { toast('请选择要归还的记录'); return; }
      out = W.applyReturn(db, {
        recordId: p.recordId, qty: p.qty, personName: staff.name, time: p.time, note: p.note
      });
    } else {
      out = W.applyBorrow(db, {
        itemId: item.id, qty: p.qty, personName: staff.name, time: p.time, note: p.note
      });
    }

    if (!out.ok) {
      if (/库存不足/.test(out.error)) {
        closeAllDialogs();
        confirmBox('库存不足', esc(out.error) + '<br><br>如果确实是账面数不准（实物比账上多），可以选择「照样记」。',
          function () {
            var r = W.applyBorrow(db, { itemId: item.id, qty: p.qty, personName: staff.name, time: p.time, note: p.note, allowNegative: true });
            if (r.ok) { log('借出', staff.name + ' 借 ' + item.name + ' x' + p.qty); save(); toast('已记录', 'ok'); state.tab = 'ledger'; render(); }
          }, '照样记（库存记为负数）');
        return;
      }
      toast(out.error, 'err');
      return;
    }

    log(p.action === 'return' ? '归还' : '借出',
      staff.name + ' ' + (p.action === 'return' ? '归还 ' : '借 ') + item.name + ' x' + p.qty);
    save();
    closeAllDialogs();
    var el = $('#smartInput'); if (el) el.value = '';
    state.tab = 'ledger';
    render();
    var msg = p.action === 'return'
      ? '已登记：' + staff.name + ' 归还 ' + item.name + ' ' + p.qty + (p.unit || '') + '，库存 ' + num(item.stock)
      : '已登记：' + staff.name + ' 借走 ' + item.name + ' ' + p.qty + (p.unit || '') + '，剩余库存 ' + num(item.stock);
    toast(msg, 'ok');
  }

  /* ================= 手工录入 ================= */

  function manualEntry() {
    if (!db.items.length) { toast('先去「物料库存」添加物料'); state.tab = 'stock'; render(); return; }
    var p = {
      raw: '（手工录入）', action: 'borrow', item: null, itemText: '', itemCandidates: [],
      itemConfidence: 'low', person: null, personText: '', personCandidates: [],
      personConfidence: 'low', qty: 1, unit: '', time: W.fmtTime(), recordId: null, note: '', warnings: []
    };
    state.parse = p;
    renderConfirm();
  }

  /* ================= 归还弹窗 ================= */

  function returnDialog(recordId) {
    var r = W.findById(db.records, recordId);
    if (!r) return;
    var remain = W.remainOf(r);
    var html =
      '<div class="note info">' + icon('info') +
      '<div>' + esc(r.borrowName) + ' 借走的 <b>' + esc(r.itemName) + '</b>，' +
      '借出 ' + num(r.qty) + ' ' + esc(r.unit || '') + '，已还 ' + num(r.returnedQty) + '，' +
      '还能还 <b>' + num(remain) + '</b>。</div></div>' +
      '<div class="form-grid">' +
        '<div class="field"><label>本次归还数量</label>' +
          '<input type="number" id="rq" value="' + remain + '" min="0.01" max="' + remain + '" step="1"></div>' +
        '<div class="field"><label>归还人</label>' +
          '<input type="text" id="rn" value="' + esc(r.borrowName) + '" list="staffList">' +
          '<datalist id="staffList">' + db.staff.map(function (s) { return '<option value="' + esc(s.name) + '">'; }).join('') + '</datalist>' +
          '<span class="tip">默认是借出人本人；别人代还就改这里</span></div>' +
        '<div class="field full"><label>归还时间</label>' +
          '<input type="datetime-local" id="rt" value="' + toInput(W.fmtTime()) + '"></div>' +
      '</div>';

    openDialog({
      title: '登记归还',
      body: html,
      foot: '<button class="btn" data-close="1">取消</button>' +
            '<button class="btn ok" id="okRet">确认归还</button>',
      onMount: function (m) {
        m.querySelector('#okRet').addEventListener('click', function () {
          var qty = parseFloat(m.querySelector('#rq').value);
          var name = m.querySelector('#rn').value.trim() || r.borrowName;
          var time = fromInput(m.querySelector('#rt').value);
          if (!(qty > 0)) { toast('归还数量要大于 0'); return; }
          pushSnapshot('归还前');
          var out = W.applyReturn(db, { recordId: recordId, qty: qty, personName: name, time: time });
          if (!out.ok) { toast(out.error, 'err'); return; }
          W.ensureStaff(db, name);
          log('归还', name + ' 归还 ' + r.itemName + ' x' + qty);
          save(); closeDialog(); render();
          toast('已归还 ' + qty + ' ' + (r.unit || '') + '，库存 ' + num(out.item ? out.item.stock : 0), 'ok');
        });
      }
    });
  }

  /* ================= 编辑记录 ================= */

  function editRecordDialog(recordId) {
    var r = W.findById(db.records, recordId);
    if (!r) return;
    var item = W.findById(db.items, r.itemId);
    var html = '<div class="note plain">' + icon('info') +
      '<div>直接改这里可以订正记错的数，改完库存会自动跟着调整。</div></div>' +
      '<div class="form-grid">' +
        '<div class="field full"><label>物料</label>' +
          '<input type="text" id="erItem" value="' + esc(r.itemName) + '" readonly></div>' +
        '<div class="field"><label>借出数量</label>' +
          '<input type="number" id="erQty" value="' + num(r.qty) + '" min="' + num(r.returnedQty) + '" step="1">' +
          '<span class="tip">不能小于已归还的 ' + num(r.returnedQty) + '</span></div>' +
        '<div class="field"><label>单位</label><input type="text" id="erUnit" value="' + esc(r.unit || '') + '"></div>' +
        '<div class="field"><label>借出人</label><input type="text" id="erBn" value="' + esc(r.borrowName) + '"></div>' +
        '<div class="field"><label>借出时间</label><input type="datetime-local" id="erBt" value="' + toInput(r.borrowTime) + '"></div>' +
        '<div class="field"><label>归还人</label><input type="text" id="erRn" value="' + esc(r.returnName || '') + '"></div>' +
        '<div class="field"><label>归还时间</label><input type="datetime-local" id="erRt" value="' + toInput(r.returnTime) + '"></div>' +
        '<div class="field full"><label>备注</label><input type="text" id="erNote" value="' + esc(r.note || '') + '"></div>' +
      '</div>';

    openDialog({
      title: '编辑记录',
      body: html,
      foot: '<button class="btn" data-close="1">取消</button><button class="btn primary" id="okEdit">保存</button>',
      onMount: function (m) {
        m.querySelector('#okEdit').addEventListener('click', function () {
          var newQty = parseFloat(m.querySelector('#erQty').value);
          if (!(newQty > 0)) { toast('数量要大于 0'); return; }
          if (newQty < r.returnedQty - 1e-9) { toast('不能小于已归还数量 ' + num(r.returnedQty)); return; }

          pushSnapshot('编辑前');
          var oldRemain = W.remainOf(r);
          r.qty = num(newQty);
          r.unit = m.querySelector('#erUnit').value.trim();
          r.borrowName = m.querySelector('#erBn').value.trim();
          r.borrowTime = fromInput(m.querySelector('#erBt').value);
          r.returnName = m.querySelector('#erRn').value.trim();
          r.returnTime = m.querySelector('#erRt').value ? fromInput(m.querySelector('#erRt').value) : '';
          r.note = m.querySelector('#erNote').value.trim();

          var newRemain = W.remainOf(r);
          r.status = newRemain <= 1e-9 ? '已归还' : (r.returnedQty > 0 ? '部分归还' : '借出');
          if (item) item.stock = num(item.stock + oldRemain - newRemain);

          if (r.borrowName) W.ensureStaff(db, r.borrowName);
          log('编辑记录', r.itemName + ' 改为 ' + r.qty + (r.unit || ''));
          save(); closeDialog(); render(); toast('已保存', 'ok');
        });
      }
    });
  }

  function delRecord(recordId) {
    var r = W.findById(db.records, recordId);
    if (!r) return;
    var remain = W.remainOf(r);
    var extra = remain > 0 ? '<br><br>这条还没还完，删除后 <b>' + num(remain) + ' ' + esc(r.unit || '') + '</b> 会自动加回库存。' : '';
    confirmBox('删除这条记录？', '将删除：<b>' + esc(r.borrowName) + '</b> 借 <b>' + esc(r.itemName) + '</b> ' + num(r.qty) + ' ' + esc(r.unit || '') + extra,
      function () {
        pushSnapshot('删除前');
        W.removeRecord(db, recordId);
        log('删除记录', r.itemName);
        save(); render(); toast('已删除');
      }, '确认删除');
  }

  /* ================= 物料 ================= */

  function itemDialog(id) {
    var it = id ? W.findById(db.items, id) : null;
    var isNew = !it;
    it = it || { id: '', code: '', name: '', alias: '', spec: '', unit: '', stock: 0, note: '' };

    var html = '<div class="form-grid">' +
      '<div class="field"><label>物料编码</label><input type="text" id="itCode" value="' + esc(it.code) + '" placeholder="可留空，如 WL-001"></div>' +
      '<div class="field"><label>物料名称 *</label><input type="text" id="itName" value="' + esc(it.name) + '" placeholder="如 M6螺丝"></div>' +
      '<div class="field"><label>规格型号</label><input type="text" id="itSpec" value="' + esc(it.spec) + '" placeholder="如 不锈钢 304"></div>' +
      '<div class="field"><label>单位</label><input type="text" id="itUnit" value="' + esc(it.unit) + '" placeholder="如 个 / 箱 / 把"></div>' +
      '<div class="field full"><label>别名 / 俗称</label><input type="text" id="itAlias" value="' + esc(it.alias) + '" placeholder="用逗号分隔，如：螺栓,内六角,内六角螺栓">' +
        '<span class="tip">同事平时怎么叫它，都写上，这样别人说「螺栓」也能找到它</span></div>' +
      '<div class="field"><label>' + (isNew ? '期初库存' : '当前库存') + '</label><input type="number" id="itStock" value="' + num(it.stock) + '" step="1"></div>' +
      '<div class="field full"><label>备注</label><input type="text" id="itNote" value="' + esc(it.note) + '"></div>' +
    '</div>';

    openDialog({
      title: isNew ? '新增物料' : '编辑物料',
      body: html,
      foot: '<button class="btn" data-close="1">取消</button><button class="btn primary" id="okItem">保存</button>',
      onMount: function (m) {
        m.querySelector('#okItem').addEventListener('click', function () {
          var name = m.querySelector('#itName').value.trim();
          if (!name) { toast('物料名称不能为空'); return; }
          // 重名检查
          var dup = db.items.filter(function (x) {
            return W.norm(x.name) === W.norm(name) && x.id !== it.id;
          });
          if (dup.length) { toast('已经有叫「' + name + '」的物料了', 'err'); return; }

          var data = {
            code: m.querySelector('#itCode').value.trim(),
            name: name,
            spec: m.querySelector('#itSpec').value.trim(),
            unit: m.querySelector('#itUnit').value.trim(),
            alias: m.querySelector('#itAlias').value.trim(),
            stock: num(m.querySelector('#itStock').value),
            note: m.querySelector('#itNote').value.trim()
          };
          pushSnapshot(isNew ? '新增物料前' : '编辑物料前');
          if (isNew) {
            data.id = W.makeId('i');
            data.createdAt = W.fmtTime();
            db.items.push(data);
            log('新增物料', name);
          } else {
            Object.assign(it, data);
            log('编辑物料', name);
          }
          save(); closeDialog(); render(); toast(isNew ? '已新增物料「' + name + '」' : '已保存', 'ok');
        });
      }
    });
  }

  function delItem(id) {
    var it = W.findById(db.items, id);
    if (!it) return;
    var openRecs = W.filterRecords(db, { itemId: id, openOnly: true });
    if (openRecs.length) {
      toast('「' + it.name + '」还有 ' + openRecs.length + ' 笔没归还，先处理完再删除', 'err');
      return;
    }
    var hist = db.records.filter(function (r) { return r.itemId === id; }).length;
    confirmBox('删除物料？', '将删除物料 <b>' + esc(it.name) + '</b>。' +
      (hist ? '<br><br>它名下还有 <b>' + hist + '</b> 条历史记录，删除物料后这些记录仍会保留在台账里。' : ''),
      function () {
        pushSnapshot('删除物料前');
        db.items = db.items.filter(function (x) { return x.id !== id; });
        log('删除物料', it.name);
        save(); render(); toast('已删除');
      }, '确认删除');
  }

  function stockInDialog(id) {
    var it = W.findById(db.items, id);
    if (!it) return;
    openDialog({
      title: '入库 / 盘点「' + it.name + '」',
      body: '<div class="note info">' + icon('info') +
        '<div>当前库存：<b>' + num(it.stock) + ' ' + esc(it.unit || '') + '</b></div></div>' +
        '<div class="form-grid">' +
          '<div class="field"><label>本次入库数量</label><input type="number" id="siQty" value="" placeholder="填正数" step="1"><span class="tip">在现有库存上增加</span></div>' +
          '<div class="field"><label>直接盘点为</label><input type="number" id="siSet" value="" placeholder="填实际盘点数" step="1"><span class="tip">按实物数直接改，用于对不上账时</span></div>' +
        '</div>',
      foot: '<button class="btn" data-close="1">取消</button>' +
            '<button class="btn" id="okIn">入库</button>' +
            '<button class="btn primary" id="okSet">盘点校正</button>',
      onMount: function (m) {
        m.querySelector('#okIn').addEventListener('click', function () {
          var q = parseFloat(m.querySelector('#siQty').value);
          if (!(q > 0)) { toast('填一个正数'); return; }
          pushSnapshot('入库前');
          var out = W.applyStockIn(db, { itemId: id, qty: q });
          log('入库', it.name + ' +' + q);
          save(); closeDialog(); render(); toast('已入库，当前库存 ' + num(out.item.stock), 'ok');
        });
        m.querySelector('#okSet').addEventListener('click', function () {
          var v = m.querySelector('#siSet').value;
          if (v === '') { toast('填写实际盘点数'); return; }
          pushSnapshot('盘点前');
          var out = W.applyStockSet(db, { itemId: id, qty: parseFloat(v) });
          if (!out.ok) { toast(out.error, 'err'); return; }
          log('盘点校正', it.name + ' → ' + out.item.stock);
          save(); closeDialog(); render(); toast('已校正为 ' + num(out.item.stock), 'ok');
        });
      }
    });
  }

  function bulkImportItems() {
    openDialog({
      title: '批量导入物料',
      wide: true,
      body: '<div class="note plain">' + icon('info') +
        '<div>从 Excel 里直接复制几列粘进来就行，每行一个物料。<br>' +
        '格式：<code>名称, 规格, 单位, 库存, 别名</code>（后面的可以省略，中文逗号也认）</div></div>' +
        '<div class="field"><textarea id="bulkText" rows="12" class="mono-input" placeholder="M6螺丝, 不锈钢304, 个, 100, 内六角螺栓&#10;M8螺丝, 镀锌, 个, 50&#10;活动扳手, 8寸, 把, 10, 扳手"></textarea></div>',
      foot: '<button class="btn" data-close="1">取消</button><button class="btn primary" id="okBulk">导入</button>',
      onMount: function (m) {
        m.querySelector('#okBulk').addEventListener('click', function () {
          var txt = m.querySelector('#bulkText').value;
          var lines = txt.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
          if (!lines.length) { toast('还没有内容'); return; }
          pushSnapshot('批量导入前');
          var added = 0, skipped = 0;
          lines.forEach(function (line) {
            var parts = line.split(/[,，\t;；|]+/).map(function (x) { return x.trim(); });
            if (/^(名称|物料|物料名称|name)$/i.test(parts[0])) return; // 跳过表头
            var name = parts[0];
            if (!name) return;
            if (db.items.some(function (x) { return W.norm(x.name) === W.norm(name); })) { skipped++; return; }
            db.items.push({
              id: W.makeId('i'), code: '', name: name,
              spec: parts[1] || '', unit: parts[2] || '',
              stock: parseFloat(parts[3]) || 0,
              alias: parts[4] || '', note: '', createdAt: W.fmtTime()
            });
            added++;
          });
          log('批量导入物料', '新增 ' + added + ' 种');
          save(); closeDialog(); state.tab = 'stock'; render();
          toast('导入完成：新增 ' + added + ' 种' + (skipped ? '，跳过 ' + skipped + ' 个重名' : ''), 'ok');
        });
      }
    });
  }

  /* ================= 人员 ================= */

  function staffDialog(id) {
    var s = id ? W.findById(db.staff, id) : null;
    var isNew = !s;
    s = s || { id: '', name: '', dept: '', phone: '', note: '' };
    openDialog({
      title: isNew ? '新增人员' : '编辑人员',
      body: '<div class="form-grid">' +
        '<div class="field"><label>姓名 *</label><input type="text" id="stName" value="' + esc(s.name) + '"></div>' +
        '<div class="field"><label>部门 / 班组</label><input type="text" id="stDept" value="' + esc(s.dept || '') + '"></div>' +
        '<div class="field"><label>电话</label><input type="text" id="stPhone" value="' + esc(s.phone || '') + '"></div>' +
        '<div class="field"><label>备注</label><input type="text" id="stNote" value="' + esc(s.note || '') + '"></div>' +
      '</div>',
      foot: '<button class="btn" data-close="1">取消</button><button class="btn primary" id="okStaff">保存</button>',
      onMount: function (m) {
        m.querySelector('#okStaff').addEventListener('click', function () {
          var name = m.querySelector('#stName').value.trim();
          if (!name) { toast('姓名不能为空'); return; }
          var dup = db.staff.filter(function (x) { return W.norm(x.name) === W.norm(name) && x.id !== s.id; });
          if (dup.length) { toast('名单里已经有「' + name + '」了', 'err'); return; }
          var data = {
            name: name,
            dept: m.querySelector('#stDept').value.trim(),
            phone: m.querySelector('#stPhone').value.trim(),
            note: m.querySelector('#stNote').value.trim()
          };
          if (isNew) {
            data.id = W.makeId('s'); data.createdAt = W.fmtTime();
            db.staff.push(data);
          } else {
            Object.assign(s, data);
          }
          save(); closeDialog(); render(); toast('已保存', 'ok');
        });
      }
    });
  }

  function delStaff(id) {
    var s = W.findById(db.staff, id);
    if (!s) return;
    var open = db.records.filter(function (r) { return W.isOpen(r) && W.norm(r.borrowName) === W.norm(s.name); });
    var msg = '将把 <b>' + esc(s.name) + '</b> 从名单里移除。' +
      (open.length ? '<br><br><span style="color:var(--danger)">注意：TA 还有 ' + open.length + ' 笔东西没还。</span>台账里的历史记录不会受影响。' : '<br><br>台账里的历史记录不会受影响。');
    confirmBox('移除人员？', msg, function () {
      db.staff = db.staff.filter(function (x) { return x.id !== id; });
      save(); render(); toast('已移除');
    }, '确认移除');
  }

  function bulkImportStaff() {
    openDialog({
      title: '批量导入人员',
      body: '<div class="note plain">' + icon('info') +
        '<div>每行一个人。格式：<code>姓名, 部门, 电话</code>，后面的可以省略。</div></div>' +
        '<div class="field"><textarea id="bsText" rows="10" class="mono-input" placeholder="张三, 装配一车间, 13800000000&#10;李四, 装配一车间&#10;王五, 库房"></textarea></div>',
      foot: '<button class="btn" data-close="1">取消</button><button class="btn primary" id="okBS">导入</button>',
      onMount: function (m) {
        m.querySelector('#okBS').addEventListener('click', function () {
          var lines = m.querySelector('#bsText').value.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
          var added = 0, skipped = 0;
          lines.forEach(function (line) {
            var parts = line.split(/[,，\t;；|]+/).map(function (x) { return x.trim(); });
            var name = parts[0];
            if (!name || /^(姓名|名字|name)$/i.test(name)) return;
            if (db.staff.some(function (x) { return W.norm(x.name) === W.norm(name); })) { skipped++; return; }
            db.staff.push({
              id: W.makeId('s'), name: name, dept: parts[1] || '',
              phone: parts[2] || '', note: '', createdAt: W.fmtTime()
            });
            added++;
          });
          save(); closeDialog(); state.tab = 'staff'; render();
          toast('导入完成：新增 ' + added + ' 人' + (skipped ? '，跳过 ' + skipped + ' 个重名' : ''), 'ok');
        });
      }
    });
  }

  /* ================= 设置 / 数据 ================= */

  function setWarehouse() {
    inputDialog('仓库 / 班组名称', '名称', function (v) {
      db.warehouse = v;
      save(); render(); toast('已更新');
    }, db.warehouse || '');
  }

  function saveSettings() {
    var wh = $('#whInput'), od = $('#odInput');
    db.warehouse = wh ? wh.value.trim() : db.warehouse;
    db.settings.overdueDays = Math.max(1, parseInt(od ? od.value : 30, 10) || 30);
    save(); render(); toast('设置已保存', 'ok');
  }

  function inputDialog(title, label, onOk, initial) {
    openDialog({
      title: title,
      body: '<div class="field"><label>' + esc(label) + '</label>' +
        '<input type="text" id="inpVal" value="' + esc(initial || '') + '"></div>',
      foot: '<button class="btn" data-close="1">取消</button><button class="btn primary" id="okInp">确定</button>',
      onMount: function (m) {
        var inp = m.querySelector('#inpVal');
        function go() {
          var v = inp.value.trim();
          if (!v) { toast('不能为空'); return; }
          closeDialog(); onOk(v);
        }
        m.querySelector('#okInp').addEventListener('click', go);
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      }
    });
  }

  /* ---- 导出 ---- */

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
  }

  function stamp() {
    var d = new Date();
    return d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '_' + p2(d.getHours()) + p2(d.getMinutes());
  }

  function exportJSON() {
    var payload = JSON.stringify(db, null, 2);
    download('物料备份_' + (db.warehouse ? db.warehouse + '_' : '') + stamp() + '.json', payload, 'application/json');
    var now = W.fmtTime();
    try { localStorage.setItem(BACKUP_FLAG, now); } catch (e) { }
    toast('备份已导出，请妥善保存这个文件', 'ok');
    if (state.tab === 'sys') render();
  }

  function importJSON() {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var parsed = null;
        try { parsed = JSON.parse(rd.result); } catch (e) { toast('文件内容不是有效的备份', 'err'); return; }
        var n = (parsed.items || []).length, m = (parsed.records || []).length;
        confirmBox('恢复备份？',
          '这个备份包含 <b>' + n + ' 种物料</b>、<b>' + m + ' 条记录</b>。<br><br>' +
          '<span style="color:var(--danger)">恢复后会覆盖当前的全部数据</span>，建议先把当前数据导出留底。',
          function () {
            pushSnapshot('恢复前');
            db = W.migrate(parsed);
            if (!Array.isArray(db.logs)) db.logs = [];
            log('恢复备份', f.name);
            save(); state.tab = 'ledger'; render();
            toast('恢复完成：' + db.items.length + ' 种物料、' + db.records.length + ' 条记录', 'ok');
          }, '确认覆盖');
      };
      rd.readAsText(f, 'utf-8');
    });
    inp.click();
  }

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function toCSV(headers, rows) {
    var lines = [headers.map(csvCell).join(',')];
    rows.forEach(function (r) { lines.push(r.map(csvCell).join(',')); });
    return '\ufeff' + lines.join('\r\n');   // BOM 让 Excel 正确识别中文
  }
  function exportCSV(name, csv) {
    var title = db.warehouse ? db.warehouse + '_' : '';
    download(title + name + '_' + stamp() + '.csv', csv, 'text/csv');
    toast('已导出「' + name + '」', 'ok');
  }

  function ledgerCSV() {
    // 用和界面同一套查找逻辑，导出的就是屏幕上看到的那批
    var kw = (state.f.keyword || '').trim();
    var found = W.searchRecords(db, {
      keyword: kw, status: state.f.status,
      openOnly: state.f.openOnly, from: state.f.from, to: state.f.to
    });
    var list = found.records;
    if (!kw) {
      list = list.slice().sort(function (a, b) { return (W.parseTime(b.borrowTime) || 0) - (W.parseTime(a.borrowTime) || 0); });
    }
    return toCSV(
      ['序号', '物料', '规格', '借出数量', '单位', '当前库存', '借出人', '借出时间', '归还人', '归还时间', '状态', '已还数量', '备注'],
      list.map(function (r, i) {
        var it = W.findById(db.items, r.itemId);
        return [i + 1, r.itemName, r.itemSpec, num(r.qty), r.unit, it ? num(it.stock) : '',
          r.borrowName, r.borrowTime, r.returnName, r.returnTime, r.status, num(r.returnedQty), r.note];
      })
    );
  }

  function stockCSV() {
    return toCSV(['序号', '编码', '物料名称', '规格', '单位', '当前库存', '借出在外', '别名', '备注'],
      db.items.slice().sort(function (a, b) { return W.norm(a.name).localeCompare(W.norm(b.name), 'zh'); })
        .map(function (it, i) {
          var out = 0;
          W.filterRecords(db, { itemId: it.id, openOnly: true }).forEach(function (r) { out += W.remainOf(r); });
          return [i + 1, it.code, it.name, it.spec, it.unit, num(it.stock), num(out), it.alias, it.note];
        }));
  }

  function openCSV() {
    var list = W.filterRecords(db, { openOnly: true });
    list.sort(function (a, b) { return (W.parseTime(a.borrowTime) || 0) - (W.parseTime(b.borrowTime) || 0); });
    var now = Date.now();
    return toCSV(['序号', '物料', '未还数量', '单位', '借出人', '借出时间', '已借天数', '备注'],
      list.map(function (r, i) {
        return [i + 1, r.itemName, num(W.remainOf(r)), r.unit, r.borrowName, r.borrowTime,
          Math.floor((now - (W.parseTime(r.borrowTime) || now)) / 86400000), r.note];
      }));
  }

  /* ---- 示例数据 / 清空 ---- */

  function loadDemo(after) {
    confirmBox('载入示例数据？', '会加入几种常见物料和几位同事，方便先体验一下。' +
      '<b>如果已经有真实数据，建议不要载入</b>（会混在一起，之后可以单独删掉）。',
      function () {
        pushSnapshot('载入示例前');
        var demoItems = [
          ['M6螺丝', '不锈钢304', '个', 200, '内六角螺栓,螺栓'],
          ['M8螺丝', '镀锌', '个', 150, ''],
          ['活动扳手', '8寸', '把', 12, '扳手,开口扳手'],
          ['A4纸', '70g', '箱', 20, '打印纸'],
          ['轴承6204', '', '个', 30, '轴承'],
          ['生料带', '白色', '卷', 50, '防水胶带'],
          ['劳保手套', 'L码', '双', 80, '手套']
        ];
        demoItems.forEach(function (d) {
          if (db.items.some(function (x) { return W.norm(x.name) === W.norm(d[0]); })) return;
          db.items.push({
            id: W.makeId('i'), code: '', name: d[0], spec: d[1], unit: d[2],
            stock: d[3], alias: d[4], note: '', createdAt: W.fmtTime()
          });
        });
        ['张三', '李四', '王五', '陈建国', '赵敏', '刘工'].forEach(function (n) { W.ensureStaff(db, n); });
        db.warehouse = db.warehouse || '示例仓库';
        save(); render();
        toast('示例数据已载入，可以试试上面的输入框', 'ok');
        if (after) setTimeout(after, 300);
      }, '载入示例');
  }

  function restoreSnapshot(idx) {
    var arr = getSnapshots();
    var s = arr[idx];
    if (!s) { toast('这个快照已经失效了', 'err'); return; }
    var d = null;
    try { d = JSON.parse(s.data); } catch (e) { toast('快照已损坏，无法恢复', 'err'); return; }
    var n = (d.items || []).length, m = (d.records || []).length;

    confirmBox('退回这次操作之前？',
      '将回到 <b>' + esc(s.t) + '</b> 的状态，也就是「' + esc(s.label || '上一次操作') + '」还没发生的时候。<br><br>' +
      '那时的数据：<b>' + n + ' 种物料</b>、<b>' + m + ' 条记录</b>。<br>' +
      '<span style="color:var(--danger)">当前的改动会被覆盖。</span>',
      function () {
        pushSnapshot('退回快照前');
        db = W.migrate(d);
        if (!Array.isArray(db.logs)) db.logs = [];
        log('退回快照', s.t + ' / ' + (s.label || ''));
        save(); render(); toast('已退回到 ' + s.t, 'ok');
      }, '确认退回');
  }

  function clearData() {
    confirmBox('清空全部数据？',
      '<span style="color:var(--danger);font-weight:700">此操作不可撤销。</span><br><br>' +
      '会把所有物料、人员、借还记录全部删除。<br>如果只是想重来，<b>请务必先导出备份</b>。',
      function () {
        pushSnapshot('清空前');
        db = W.emptyDB();
        save(); state.tab = 'ledger';
        state.f = { keyword: '', status: '全部', openOnly: false, from: '', to: '' };
        render(); toast('已清空');
      }, '我确定，全部清空');
  }

  /* ================= 启动 ================= */

  function boot() {
    load();
    // 恢复上次选的主题（head 里的内联脚本已提前设过一次，这里兜底）
    try {
      var savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme);
    } catch (e) { /* 读不到就沿用当前 */ }
    render();
    var el = $('#savedAt');
    if (el) el.textContent = '已保存 ' + (db.updatedAt || '').slice(11);

    window.addEventListener('beforeunload', function () {
      // 数据是实时保存的，这里只在有弹窗未提交时提醒一下
      if (dialogStack.length && $('#cfmGo')) { /* 不拦截 */ }
    });

    // 首次使用引导
    if (!db.items.length && !db.records.length && !db.staff.length) {
      setTimeout(function () {
        openDialog({
          title: '先花 1 分钟设置一下',
          body: '<div class="help">' +
            '<p>这个工具是<b>单机离线</b>的，数据存在这台电脑的浏览器里，不上传网络。</p>' +
            '<p><b>建议顺序：</b></p><ol>' +
            '<li>先去「物料库存」把库里的东西登记进去（支持从 Excel 批量粘贴）</li>' +
            '<li>再去「人员名单」把常来借东西的同事加上</li>' +
            '<li>以后有人来借，直接在最上面的框里打一句话，例如：<br><code>张三借了2个M6螺丝</code></li>' +
            '</ol>' +
            '</div>' +
            '<div class="note warn">' + icon('alert') +
            '<div><b>最重要的一条：</b>数据只在这台电脑上。请每周点一次「备份」导出文件保存。</div></div>',
          foot: '<button class="btn" data-close="1">我知道了</button>' +
                '<button class="btn primary" id="bootDemo">先载入示例看看</button>',
          onMount: function (m) {
            m.querySelector('#bootDemo').addEventListener('click', function () { closeDialog(); loadDemo(); });
          }
        });
      }, 400);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
