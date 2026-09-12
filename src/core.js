/*!
 * 物料借还管理 · 核心逻辑层
 * ---------------------------------------------------------------
 * 纯函数实现，不依赖 DOM / 浏览器 API。
 * 浏览器端挂载到 window.WLCore，Node 端可通过 require 加载用于单元测试。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WLCore = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  /* =====================================================================
   * 1. 文本工具
   * ===================================================================== */

  /** 全角转半角 */
  function toHalfWidth(str) {
    return String(str == null ? '' : str)
      .replace(/[\uFF01-\uFF5E]/g, function (ch) {
        return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
      })
      .replace(/\u3000/g, ' ');
  }

  var PUNCT_RE = /[\s()\[\]{}<>《》【】「」『』,，。.、;；:：!！?？'"`~@#$%^&*_+=|\\\/\-—–…·“”‘’*]/g;

  /** 归一化：仅用于「比较」，不用于展示 */
  function norm(str) {
    return toHalfWidth(str).replace(PUNCT_RE, '').toLowerCase();
  }

  /** 编辑距离 */
  function levenshtein(a, b) {
    a = String(a); b = String(b);
    if (a === b) return 0;
    var m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    var prev = new Array(n + 1), cur = new Array(n + 1), i, j, tmp;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      tmp = prev; prev = cur; cur = tmp;
    }
    return prev[n];
  }

  function uniqueChars(s) {
    var seen = {}, out = [];
    for (var i = 0; i < s.length; i++) {
      if (!seen[s[i]]) { seen[s[i]] = 1; out.push(s[i]); }
    }
    return out;
  }

  /**
   * 相似度打分 0 ~ 1
   * 融合三种信号：编辑距离、包含关系、字符重合度（Jaccard）
   */
  function similarity(a, b) {
    var x = norm(a), y = norm(b);
    if (!x || !y) return 0;
    if (x === y) return 1;

    var maxLen = Math.max(x.length, y.length);
    var score = 1 - levenshtein(x, y) / maxLen;

    if (x.indexOf(y) !== -1 || y.indexOf(x) !== -1) {
      var ratio = Math.min(x.length, y.length) / maxLen;
      score = Math.max(score, 0.62 + 0.38 * ratio);
    }

    var ux = uniqueChars(x), uy = uniqueChars(y), setY = {}, common = 0, i;
    for (i = 0; i < uy.length; i++) setY[uy[i]] = 1;
    for (i = 0; i < ux.length; i++) if (setY[ux[i]]) common++;
    var unionSet = {};
    for (i = 0; i < ux.length; i++) unionSet[ux[i]] = 1;
    for (i = 0; i < uy.length; i++) unionSet[uy[i]] = 1;
    var union = 0;
    for (var k in unionSet) if (unionSet.hasOwnProperty(k)) union++;
    if (union > 0) score = Math.max(score, (common / union) * 0.92);

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 候选排序
   * @param {string} query 查询串
   * @param {Array} list   候选集合
   * @param {Function} getName 取名字的函数
   * @param {number} [limit] 返回条数
   */
  function rankCandidates(query, list, getName, limit) {
    var out = [];
    if (!query || !list || !list.length) return out;
    for (var i = 0; i < list.length; i++) {
      var nm = getName(list[i]);
      if (!nm) continue;
      out.push({ value: list[i], name: nm, score: similarity(query, nm) });
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return typeof limit === 'number' ? out.slice(0, limit) : out;
  }

  /* =====================================================================
   * 2. 中文数字
   * ===================================================================== */

  var CN_DIGIT = {
    '零': 0, '〇': 0, '一': 1, '壹': 1, '二': 2, '两': 2, '贰': 2,
    '三': 3, '叁': 3, '四': 4, '肆': 4, '五': 5, '伍': 5,
    '六': 6, '陆': 6, '七': 7, '柒': 7, '八': 8, '捌': 8, '九': 9, '玖': 9
  };

  /** 中文数字转阿拉伯数字，失败返回 null */
  function cnNumToArabic(s) {
    if (!s) return null;
    if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
    if (s === '半') return 0.5;

    var total = 0, section = 0, num = 0, hasUnit = false, hasDigit = false;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (CN_DIGIT[ch] != null) { num = CN_DIGIT[ch]; hasDigit = true; }
      else if (ch === '十') { hasUnit = true; section += (num === 0 ? 1 : num) * 10; num = 0; }
      else if (ch === '百') { hasUnit = true; section += (num === 0 ? 1 : num) * 100; num = 0; }
      else if (ch === '千') { hasUnit = true; section += (num === 0 ? 1 : num) * 1000; num = 0; }
      else if (ch === '万') { hasUnit = true; total += (section + num) * 10000; section = 0; num = 0; }
      else return null;
    }
    if (!hasUnit && !hasDigit) return null;
    return total + section + num;
  }

  /* =====================================================================
   * 3. 量词 / 单位
   * ===================================================================== */

  var UNITS = [
    '个', '件', '箱', '包', '只', '把', '根', '卷', '瓶', '盒', '袋', '套', '片',
    '台', '块', '条', '张', '支', '桶', '盘', '对', '组', '副', '辆', '扇', '本',
    '册', '双', '斤', '公斤', '千克', '克', '吨', '升', '毫升', '米', '厘米',
    '毫米', '寸', '英尺', '码', '枚', '颗', '粒', '捆', '扎', '打', '串', '沓',
    '叠', '部', '座', '项', '批', '车', '托', 'kg', 'g', 't', 'l', 'ml', 'cm', 'mm', 'pcs'
  ];
  UNITS.sort(function (a, b) { return b.length - a.length; });
  var UNIT_SRC = '(?:' + UNITS.join('|') + ')';
  // 负向后顾：避免把型号里的数字（如 M12螺栓、6204轴承）当成数量
  var QTY_RE = new RegExp('(?<![A-Za-z0-9])(\\d+(?:\\.\\d+)?|(?:[零〇一壹二两贰三叁四肆五伍六陆七柒八捌九玖十百千万半]+))\\s*(' + UNIT_SRC + ')?');

  /** 从一段文本里抽取数量与单位，失败返回 null */
  function extractQuantity(segment) {
    if (!segment) return null;
    var m = String(segment).match(QTY_RE);
    if (!m) return null;
    var val = cnNumToArabic(m[1]);
    if (val == null || val <= 0) return null;
    return { qty: val, unit: m[2] || '', raw: m[0], index: m.index };
  }

  /* =====================================================================
   * 4. 扫描：在文本中定位库中已存在的条目
   * ===================================================================== */

  /**
   * 在归一化文本 T 中扫描 list 里的名字，命中后把对应区间标记为「已占用」。
   * 长名字优先，避免「M6螺丝」被「螺丝」抢走。
   */
  function scanLibrary(T, used, list, getNames) {
    var hits = [], cands = [], i, j;

    for (i = 0; i < list.length; i++) {
      var names = getNames(list[i]) || [];
      for (j = 0; j < names.length; j++) {
        var n = norm(names[j]);
        if (n.length >= 2) cands.push({ item: list[i], name: String(names[j]), n: n });
      }
    }
    cands.sort(function (a, b) { return b.n.length - a.n.length; });

    for (i = 0; i < cands.length; i++) {
      var c = cands[i];
      var idx = T.indexOf(c.n);
      while (idx !== -1) {
        var free = true;
        for (j = idx; j < idx + c.n.length; j++) { if (used[j]) { free = false; break; } }
        if (free) {
          for (j = idx; j < idx + c.n.length; j++) used[j] = true;
          hits.push({ item: c.item, name: c.name, start: idx, end: idx + c.n.length });
        }
        idx = T.indexOf(c.n, idx + 1);
      }
    }
    return hits;
  }

  /** 取出未被占用的文本片段 */
  function leftovers(T, used) {
    var out = [], cur = '';
    for (var i = 0; i < T.length; i++) {
      if (!used[i]) cur += T.charAt(i);
      else if (cur) { out.push(cur); cur = ''; }
    }
    if (cur) out.push(cur);
    return out;
  }

  /* =====================================================================
   * 5. 动作识别
   * ===================================================================== */

  var RETURN_WORDS = ['归还', '还回', '退还', '退回', '返还', '交还', '送回', '还掉', '还了', '还给', '入库', '还'];
  var BORROW_WORDS = ['借走', '借出', '借给', '借了', '借用', '借', '领取', '领用', '拿走', '拿了', '取走', '出库', '带走', '拿去', '要用', '使用'];

  var RETURN_FALSE_POSITIVE = /还(?=[有是要会需想得在好可行没未差钱])/g;

  function detectAction(T) {
    var t = String(T).replace(RETURN_FALSE_POSITIVE, '\u0001');
    var i, p;
    for (i = 0; i < RETURN_WORDS.length; i++) {
      p = t.indexOf(RETURN_WORDS[i]);
      if (p !== -1) return { action: 'return', word: RETURN_WORDS[i], pos: p };
    }
    for (i = 0; i < BORROW_WORDS.length; i++) {
      p = t.indexOf(BORROW_WORDS[i]);
      if (p !== -1) return { action: 'borrow', word: BORROW_WORDS[i], pos: p };
    }
    return { action: 'borrow', word: '', pos: -1 };
  }

  /* =====================================================================
   * 6. 自由词元提取
   * ===================================================================== */

  // 只收「功能字」。同样刻意排除量词（张/支/包/台/条/本/双/米…），
  // 因为「张」「包」「米」都是姓氏，一旦被当作停用字就会丢掉人名线索。
  var STOP_CHARS = '的了着过给把被和与跟及在到从去来还借拿取走带送入出库用要是再有就又就都也请帮下我他她你您嗯哦啊吧吗呢呀';

  function isStopToken(tk) {
    if (!tk) return true;
    if (/^\d+$/.test(tk)) return true;          // 纯数字
    for (var i = 0; i < tk.length; i++) {
      if (STOP_CHARS.indexOf(tk.charAt(i)) === -1) return false;
    }
    return true;
  }

  /**
   * 噪音词表：动作词、助词、量词、时间词等。
   * 目的：把「张借了一把」切成「张」，让「张」能去和「张三」做模糊比对。
   */
  var NOISE_WORDS = [
    // 多字：动作 / 时间 / 客套
    '归还', '还回来', '还回', '退还', '退回', '返还', '交还', '送回', '还掉', '还给', '还了',
    '借走', '借出', '借给', '借了', '借用', '领取', '领用', '拿走', '拿了', '取下', '取走',
    '出库', '入库', '带走', '拿去', '要用', '使用', '已经', '之前', '上次', '昨天', '今天',
    '明天', '早上', '上午', '中午', '下午', '晚上', '麻烦', '帮忙', '谢谢', '请问', '然后', '接着',
    // 单字：只收「功能字」。
    // 注意：量词（张/支/包/台/条/本/双…）绝不能放进来 —— 它们同时也是常见姓氏，
    // 删掉就会把「张」「小张」里的人名线索一起抹掉，量词交给数量抽取阶段消费。
    '了', '的', '着', '过', '给', '把', '被', '和', '与', '跟', '及', '在', '到', '从', '去', '来',
    '还', '借', '拿', '取', '走', '带', '送', '入', '出', '库', '用', '要', '是', '有', '再', '又',
    '就', '都', '也', '请', '帮', '下'
  ];
  NOISE_WORDS.sort(function (a, b) { return b.length - a.length; });

  /** 剔除片段中的噪音词，只留下疑似人名 / 物料名的部分 */
  function stripNoise(seg) {
    var s = String(seg == null ? '' : seg);
    for (var i = 0; i < NOISE_WORDS.length; i++) {
      if (s.indexOf(NOISE_WORDS[i]) !== -1) s = s.split(NOISE_WORDS[i]).join('\u0001');
    }
    return s;
  }

  /**
   * 提取自由词元（可能是人名或物料名）
   * 允许单字，因为「张」「李」这种没打全的姓氏正是需要救助的场景
   */
  function extractTokens(segments) {
    var out = [];
    var joined = segments.join('\u0001');
    var re = /[\u4e00-\u9fa5A-Za-z0-9]{1,8}/g, m;
    while ((m = re.exec(joined)) !== null) {
      var tk = m[0];
      if (!isStopToken(tk) && out.indexOf(tk) === -1) out.push(tk);
    }
    return out;
  }

  /* =====================================================================
   * 7. 主解析入口
   * ===================================================================== */

  /** 自动采纳为结果的相似度门槛 */
  var FUZZY_THRESHOLD = 0.45;
  /** 列为「疑似候选」供人工确认的相似度门槛（比自动采纳更宽松） */
  var CANDIDATE_SHOW_THRESHOLD = 0.28;

  function itemNames(it) {
    var arr = [];
    if (it.name) arr.push(it.name);
    if (it.code) arr.push(it.code);
    if (it.alias) arr = arr.concat(String(it.alias).split(/[,，、;；\/\s]+/));
    return arr.filter(function (x) { return !!x; });
  }

  function staffNames(s) { return s && s.name ? [s.name] : []; }

  /** 判断命中的文本是不是该条目的「正式名字之一」（含编码、别名） */
  function isSameName(obj, text, getNames) {
    if (!obj || !text) return false;
    var ns = getNames(obj) || [];
    for (var i = 0; i < ns.length; i++) {
      if (ns[i] && norm(ns[i]) === norm(text)) return true;
    }
    return false;
  }

  /**
   * 昵称变体：同事常叫「小王」「老李」「阿强」，
   * 去掉前缀后「王」「李」「强」才能和名单里的「王五」「李四」对上。
   */
  function tokenVariants(tk) {
    var out = [tk];
    var m = /^[老小大阿]([\u4e00-\u9fa5]{1,3})$/.exec(tk);
    if (m) out.push(m[1]);
    return out;
  }

  /** 多变体取最优候选 */
  function bestRank(variants, list, getName, limit) {
    var best = [], v, i, j, r, found;
    for (v = 0; v < variants.length; v++) {
      r = rankCandidates(variants[v], list, getName, limit);
      for (i = 0; i < r.length; i++) {
        found = false;
        for (j = 0; j < best.length; j++) {
          if (best[j].value === r[i].value) {
            if (r[i].score > best[j].score) best[j].score = r[i].score;
            found = true;
            break;
          }
        }
        if (!found) best.push(r[i]);
      }
    }
    best.sort(function (a, b) { return b.score - a.score; });
    return best.slice(0, limit);
  }

  /**
   * 解析一句自然语言
   * @param {string} raw 用户输入
   * @param {object} db  { items: [], staff: [], records: [] }
   * @returns {object} 解析结果
   */
  function parseCommand(raw, db) {
    db = db || {};
    var items = db.items || [];
    var staff = db.staff || [];

    var res = {
      raw: String(raw == null ? '' : raw).trim(),
      action: 'borrow',
      actionWord: '',
      qty: 1,
      qtySource: 'default',
      unit: '',
      item: null,
      itemText: '',
      itemCandidates: [],
      person: null,
      personText: '',
      personCandidates: [],
      tokens: [],
      warnings: [],
      itemConfidence: 'low',
      personConfidence: 'low',
      ok: false
    };

    var T = norm(res.raw);
    if (!T) { res.warnings.push('请输入内容'); return res; }

    var used = [], i;
    for (i = 0; i < T.length; i++) used.push(false);

    // --- 动作 ---
    var act = detectAction(T);
    res.action = act.action;
    res.actionWord = act.word;

    // --- 正向扫描库中已有条目 ---
    var itemHits = scanLibrary(T, used, items, itemNames);
    var staffHits = scanLibrary(T, used, staff, function (s) { return [s.name]; });

    // --- 先落地「库里已有的」精确命中 ---
    if (itemHits.length) {
      res.item = itemHits[0].item;
      res.itemText = itemHits[0].name;
      if (itemHits.length > 1) res.warnings.push('这句话里出现了多个物料，请确认要操作哪一个');
    }
    if (staffHits.length) {
      res.person = staffHits[0].item;
      res.personText = staffHits[0].name;
      if (staffHits.length > 1) res.warnings.push('这句话里出现了多个人名，请确认是哪一位');
    }

    // --- 剩余文本：抽数量 → 剔除噪音词 → 提取候选词元 ---
    var leftSegs = leftovers(T, used);
    var qtyHit = null, cleaned = [], seg;

    for (i = 0; i < leftSegs.length; i++) {
      seg = leftSegs[i];
      if (!qtyHit) {
        var q = extractQuantity(seg);
        if (q) {
          qtyHit = q;
          seg = seg.slice(0, q.index) + ' ' + seg.slice(q.index + q.raw.length);
        }
      }
      cleaned.push(stripNoise(seg));
    }
    if (qtyHit) { res.qty = qtyHit.qty; res.unit = qtyHit.unit; res.qtySource = 'text'; }

    var tokens = extractTokens(cleaned);

    // --- 词元归属 + 候选池 ---
    var getItemName = function (it) { return it.name; };
    var getStaffName = function (s) { return s.name; };
    var itemPool = [], staffPool = [], seenKeys = {}, unknowns = [];

    for (i = 0; i < tokens.length; i++) {
      var tk = tokens[i];
      var variants = tokenVariants(tk);
      var itemRank = bestRank(variants, items, getItemName, 4);
      var staffRank = bestRank(variants, staff, getStaffName, 4);
      var bestItem = itemRank.length ? itemRank[0].score : 0;
      var bestStaff = staffRank.length ? staffRank[0].score : 0;
      var claimed = false;

      if (!res.item && bestItem >= FUZZY_THRESHOLD && bestItem >= bestStaff) {
        res.item = itemRank[0].value;
        res.itemText = tk;
        claimed = true;
      }
      if (!res.person && bestStaff >= FUZZY_THRESHOLD) {
        res.person = staffRank[0].value;
        res.personText = tk;
        claimed = true;
      }
      if (!claimed) unknowns.push(tk);

      var a, b;
      for (a = 0; a < itemRank.length; a++) {
        if (itemRank[a].score >= CANDIDATE_SHOW_THRESHOLD && !seenKeys['i' + itemRank[a].value.id]) {
          seenKeys['i' + itemRank[a].value.id] = 1;
          itemPool.push(itemRank[a]);
        }
      }
      for (b = 0; b < staffRank.length; b++) {
        if (staffRank[b].score >= CANDIDATE_SHOW_THRESHOLD && !seenKeys['s' + staffRank[b].value.id]) {
          seenKeys['s' + staffRank[b].value.id] = 1;
          staffPool.push(staffRank[b]);
        }
      }
    }

    // 精确命中时，也把「长得像的」列出来，方便一字之差时改选
    if (res.item && !itemPool.length) {
      itemPool = rankCandidates(res.item.name, items, getItemName, 6)
        .filter(function (c) { return c.value.id !== res.item.id && c.score >= 0.6; });
    }
    if (res.person && !staffPool.length) {
      staffPool = rankCandidates(res.person.name, staff, getStaffName, 6)
        .filter(function (c) { return c.value.id !== res.person.id && c.score >= 0.5; });
    }

    itemPool.sort(function (x, y) { return y.score - x.score; });
    staffPool.sort(function (x, y) { return y.score - x.score; });

    res.itemCandidates = itemPool
      .filter(function (c) { return !res.item || c.value.id !== res.item.id; })
      .slice(0, 6);
    res.personCandidates = staffPool
      .filter(function (c) { return !res.person || c.value.id !== res.person.id; })
      .slice(0, 6);

    res.tokens = unknowns;

    // --- 置信度：界面据此决定是否需要高亮「请确认」 ---
    // high   = 输入里就是库里的完整名字，可以直接用
    // medium = 靠模糊/缩写匹配上的，建议人工扫一眼
    // low    = 完全没匹配上
    // 命中别名/编码也算「准确命中」，不必再让人确认一遍
    res.itemConfidence = !res.item ? 'low' : (isSameName(res.item, res.itemText, itemNames) ? 'high' : 'medium');
    res.personConfidence = !res.person ? 'low' : (isSameName(res.person, res.personText, staffNames) ? 'high' : 'medium');

    if (!res.item) {
      res.warnings.push(res.itemText
        ? '库存里没有「' + res.itemText + '」，请手动挑一个已有物料，或者新建它'
        : '没有识别出物料，请手动选择或新建');
    }
    if (!res.person) {
      res.warnings.push(res.personText
        ? '名单里没有「' + res.personText + '」，请从下面选一位，或点「新同事」加进去'
        : '没有识别出人名，请从名单里选一位，或点「新同事」加进去');
    }
    if (res.itemConfidence === 'medium') res.warnings.push('物料名不完全一致，已按最相近的匹配，请确认');
    if (res.personConfidence === 'medium') res.warnings.push('姓名没打全，已按最相近的人匹配，请确认');

    res.ok = !!res.item && !!res.person;
    return res;
  }

  /* =====================================================================
   * 8. 数据操作
   * ===================================================================== */

  function makeId(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  /** Date -> 'YYYY-MM-DD HH:mm' */
  function fmtTime(d) {
    d = d || new Date();
    if (typeof d === 'string') d = parseTime(d) || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /** 'YYYY-MM-DD HH:mm' -> Date */
  function parseTime(str) {
    if (!str) return null;
    if (str instanceof Date) return str;
    var s = String(str).trim().replace(/[\/\.]/g, '-');
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    if (!m) { var d = new Date(s); return isNaN(d.getTime()) ? null : d; }
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }

  function round3(n) { return Math.round((Number(n) || 0) * 1000) / 1000; }

  function findById(list, id) {
    if (!list || !id) return null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function remainOf(rec) {
    return round3((Number(rec.qty) || 0) - (Number(rec.returnedQty) || 0));
  }

  function isOpen(rec) { return remainOf(rec) > 1e-9; }

  /* ---------- 借出 ---------- */

  function applyBorrow(db, p) {
    var item = findById(db.items, p.itemId);
    if (!item) return { ok: false, error: '物料不存在' };
    var qty = Number(p.qty);
    if (!(qty > 0)) return { ok: false, error: '借出数量必须大于 0' };

    var allowNegative = !!p.allowNegative;
    if (!allowNegative && round3(item.stock) < qty - 1e-9) {
      return { ok: false, error: '库存不足：当前库存 ' + round3(item.stock) + ' ' + (item.unit || '') + '，需要 ' + qty + ' ' + (item.unit || '') };
    }

    item.stock = round3(item.stock - qty);

    var rec = {
      id: makeId('r'),
      itemId: item.id,
      itemName: item.name,
      itemSpec: item.spec || '',
      unit: item.unit || '',
      qty: qty,
      returnedQty: 0,
      stockAfter: item.stock,
      borrowName: p.personName || '',
      borrowTime: p.time || fmtTime(),
      returnName: '',
      returnTime: '',
      status: '借出',
      note: p.note || '',
      createdAt: fmtTime()
    };
    db.records.unshift(rec);
    return { ok: true, record: rec, item: item };
  }

  /* ---------- 归还 ---------- */

  function applyReturn(db, p) {
    var rec = findById(db.records, p.recordId);
    if (!rec) return { ok: false, error: '找不到这条借出记录' };
    var remain = remainOf(rec);
    if (remain <= 1e-9) return { ok: false, error: '这条记录已经全部归还过了' };

    var qty = (p.qty == null || p.qty === '') ? remain : Number(p.qty);
    if (!(qty > 0)) return { ok: false, error: '归还数量必须大于 0' };
    if (qty > remain) qty = remain;

    rec.returnedQty = round3(rec.returnedQty + qty);
    rec.returnName = p.personName || rec.borrowName || '';
    rec.returnTime = p.time || fmtTime();
    if (remainOf(rec) <= 1e-9) { rec.status = '已归还'; rec.returnedQty = rec.qty; }
    else { rec.status = '部分归还'; }
    if (p.note) rec.note = rec.note ? rec.note + ' | ' + p.note : p.note;

    var item = findById(db.items, rec.itemId);
    if (item) item.stock = round3(item.stock + qty);

    return { ok: true, record: rec, item: item, qty: qty };
  }

  /* ---------- 入库 / 盘点 ---------- */

  function applyStockIn(db, p) {
    var item = findById(db.items, p.itemId);
    if (!item) return { ok: false, error: '物料不存在' };
    var qty = Number(p.qty);
    if (!(qty > 0)) return { ok: false, error: '入库数量必须大于 0' };
    item.stock = round3(item.stock + qty);
    return { ok: true, item: item };
  }

  function applyStockSet(db, p) {
    var item = findById(db.items, p.itemId);
    if (!item) return { ok: false, error: '物料不存在' };
    var qty = Number(p.qty);
    if (isNaN(qty)) return { ok: false, error: '库存必须是数字' };
    item.stock = round3(qty);
    return { ok: true, item: item };
  }

  /* ---------- 删除记录（回滚库存） ---------- */

  function removeRecord(db, recordId) {
    var idx = -1, i;
    for (i = 0; i < db.records.length; i++) if (db.records[i].id === recordId) { idx = i; break; }
    if (idx === -1) return { ok: false, error: '记录不存在' };
    var rec = db.records[idx];
    var item = findById(db.items, rec.itemId);
    if (item) {
      // 删除未归还记录：把还没还的部分补回库存
      item.stock = round3(item.stock + remainOf(rec));
    }
    db.records.splice(idx, 1);
    return { ok: true, record: rec };
  }

  /* ---------- 查询 ---------- */

  function filterRecords(db, f) {
    f = f || {};
    var kw = f.keyword ? norm(f.keyword) : '';
    var out = [];
    for (var i = 0; i < db.records.length; i++) {
      var r = db.records[i];
      if (f.status && f.status !== '全部' && r.status !== f.status) continue;
      if (f.itemId && r.itemId !== f.itemId) continue;
      if (f.from && parseTime(r.borrowTime) && parseTime(r.borrowTime) < parseTime(f.from)) continue;
      if (f.to && parseTime(r.borrowTime) && parseTime(r.borrowTime) > parseTime(f.to)) continue;
      if (f.openOnly && !isOpen(r)) continue;
      if (kw) {
        var hay = norm([r.itemName, r.itemSpec, r.borrowName, r.returnName, r.note, r.unit].join(' '));
        if (hay.indexOf(kw) === -1) continue;
      }
      out.push(r);
    }
    return out;
  }

  function findOpenRecords(db, q) {
    q = q || {};
    var out = [];
    for (var i = 0; i < db.records.length; i++) {
      var r = db.records[i];
      if (!isOpen(r)) continue;
      if (q.itemId && r.itemId !== q.itemId) continue;
      if (q.personKeyword) {
        var s = similarity(q.personKeyword, r.borrowName);
        if (s < FUZZY_THRESHOLD) continue;
      }
      out.push(r);
    }
    return out;
  }

  /* =====================================================================
   * 9. 模糊查找
   * ---------------------------------------------------------------
   * 查找分两档：精确命中（关键词真的出现在某个字段里）永远排在前面，
   * 模糊命中（靠相似度猜的）跟着排在后面，并标记 fuzzy=true 供界面提示。
   * ===================================================================== */

  /** 精确命中的最低分（含占比加成后落在 0.82 ~ 1） */
  var SEARCH_EXACT_BASE = 0.82;
  /** 模糊命中的最高分，压到精确命中之下，保证两档不会交叉 */
  var SEARCH_FUZZY_CEIL = 0.79;
  /** 模糊查找的入围门槛 */
  var SEARCH_FUZZY_THRESHOLD = 0.34;

  /**
   * 模糊亲缘分：在字段里取一个和关键词差不多长的「最佳窗口」，再看两件事——
   *   ① 同位字符：窗口和关键词处在同一位置的字符有几个
   *   ② 共同字符：窗口和关键词一共撞上几个字
   *
   * 为什么要分两路：「罗丝 → 螺丝」是打错一个字（同位 1 个 / 共 1 个），
   * 而「手套 → 活动扳手」只是碰巧撞上「手」且位置还不对（同位 0 个）。
   * 只用共同字符的话这两者得分一样，噪音就压不下去。
   */
  function fuzzyAffinity(x, y) {
    if (!x || !y || x.length > y.length) return 0;
    var L = x.length, best = 0;

    // 窗口长度就取关键词长度：只有等长时才谈得上「第几个字对上了」。
    // 放宽到 ±1 会出岔子——「手套」比「扳手」时，单字窗口「手」白捡一个同位分。
    for (var i = 0; i + L <= y.length; i++) {
      var w = y.substr(i, L), set = {}, common = 0, samePos = 0, k;
      for (k = 0; k < L; k++) set[w.charAt(k)] = 1;
      for (k = 0; k < L; k++) {
        if (set[x.charAt(k)]) common++;
        if (x.charAt(k) === w.charAt(k)) samePos++;
      }
      var s = 0.55 * (samePos / L) + 0.45 * (common / L);
      if (s > best) best = s;
    }
    return best;
  }

  /**
   * 单个字段打分
   * @returns {{score:number, fuzzy:boolean}}
   */
  function scoreOne(nq, text) {
    var nf = norm(text);
    if (!nf) return { score: 0, fuzzy: false };
    if (nf === nq) return { score: 1, fuzzy: false };

    var idx = nf.indexOf(nq);
    if (idx !== -1) {
      // 精确包含：关键词占字段的比例越大分越高，出现在开头再补一点
      var ratio = nq.length / nf.length;
      var s = SEARCH_EXACT_BASE + (1 - SEARCH_EXACT_BASE) * ratio;
      if (idx === 0) s = Math.min(1, s + 0.05);
      return { score: s, fuzzy: false };
    }

    // 编辑距离按最长串归一，中文两字词错一个字就被压得很低
    //（罗丝 vs M6螺丝 只有 0.25），光靠它会漏掉最常见的错别字。
    // 补一路「最佳窗口亲缘分」，它在容错和噪音之间画了条线。
    var f = Math.max(similarity(nq, nf), fuzzyAffinity(nq, nf));

    return { score: Math.min(f, SEARCH_FUZZY_CEIL), fuzzy: true };
  }

  /**
   * 关键词对一个条目打分：多字段取最优，精确命中优先于模糊命中
   * @param {string} query  用户输入
   * @param {Array<string>|string} fields 字段（或字段数组）
   * @returns {{score:number, fuzzy:boolean}} score 为 0 表示不命中
   */
  function scoreKeyword(query, fields) {
    var nq = norm(query);
    if (!nq) return { score: 0, fuzzy: false };
    if (!Array.isArray(fields)) fields = [fields];

    var exact = 0, fuzzy = 0, i, m;
    for (i = 0; i < fields.length; i++) {
      if (fields[i] === null || fields[i] === undefined || fields[i] === '') continue;
      m = scoreOne(nq, String(fields[i]));
      if (m.fuzzy) { if (m.score > fuzzy) fuzzy = m.score; }
      else if (m.score > exact) exact = m.score;
    }
    if (exact) return { score: exact, fuzzy: false };
    if (fuzzy >= SEARCH_FUZZY_THRESHOLD) return { score: fuzzy, fuzzy: true };
    return { score: 0, fuzzy: false };
  }

  /** 物料的全部可搜字段（别名拆成多条逐个比，避免跨别名的假命中） */
  function itemSearchFields(it) {
    var f = [it.name, it.code, it.spec, it.unit];
    if (it.alias) f = f.concat(String(it.alias).split(/[,，、;；\/\s]+/));
    return f.filter(function (x) { return !!x; });
  }

  /** 台账记录的全部可搜字段 */
  function recordSearchFields(r) {
    return [r.itemName, r.itemSpec, r.borrowName, r.returnName, r.note, r.unit]
      .filter(function (x) { return !!x; });
  }

  /**
   * 物料模糊查找
   * @returns {Array<{item:object, name:string, score:number, fuzzy:boolean}>} 按分数降序
   */
  function searchItems(db, keyword, opts) {
    opts = opts || {};
    var items = (db && db.items) || [], out = [], i, m;
    for (i = 0; i < items.length; i++) {
      m = scoreKeyword(keyword, itemSearchFields(items[i]));
      if (!m.score) continue;
      out.push({ item: items[i], value: items[i], name: items[i].name, score: m.score, fuzzy: m.fuzzy });
    }
    out.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh');
    });
    return typeof opts.limit === 'number' ? out.slice(0, opts.limit) : out;
  }

  /**
   * 台账模糊查找
   * 先按状态/物料/日期/未还等条件筛，再按关键词打分排序（分数相同时新的在前）
   * @returns {{records:Array, fuzzyIds:object, fuzzyCount:number, exactCount:number}}
   */
  function searchRecords(db, f) {
    f = f || {};
    var kw = f.keyword == null ? '' : String(f.keyword).trim();
    var base = filterRecords(db, {
      status: f.status, itemId: f.itemId,
      from: f.from, to: f.to, openOnly: f.openOnly
    });
    if (!kw) {
      return { records: base, fuzzyIds: {}, fuzzyCount: 0, exactCount: base.length };
    }

    var scored = [], i, m;
    for (i = 0; i < base.length; i++) {
      m = scoreKeyword(kw, recordSearchFields(base[i]));
      if (!m.score) continue;
      scored.push({ r: base[i], score: m.score, fuzzy: m.fuzzy });
    }
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      var x = parseTime(a.r.borrowTime), y = parseTime(b.r.borrowTime);
      return (y ? y.getTime() : 0) - (x ? x.getTime() : 0);
    });

    var records = [], fuzzyIds = {}, fuzzyCount = 0;
    for (i = 0; i < scored.length; i++) {
      if (scored[i].fuzzy) { fuzzyIds[scored[i].r.id] = 1; fuzzyCount++; }
      records.push(scored[i].r);
    }
    return {
      records: records, fuzzyIds: fuzzyIds,
      fuzzyCount: fuzzyCount, exactCount: records.length - fuzzyCount
    };
  }

  /* ---------- 统计 ---------- */

  function computeStats(db) {
    var items = db.items || [], records = db.records || [];
    var totalStock = 0, totalOut = 0, openCount = 0, now = new Date(), overdue = 0, overdueDays = 30;
    var byItem = {}, byPerson = {}, i, r;

    for (i = 0; i < items.length; i++) totalStock = round3(totalStock + (Number(items[i].stock) || 0));

    for (i = 0; i < records.length; i++) {
      r = records[i];
      if (isOpen(r)) {
        openCount++;
        var remain = remainOf(r);
        totalOut = round3(totalOut + remain);
        byItem[r.itemId] = round3((byItem[r.itemId] || 0) + remain);
        byPerson[r.borrowName] = round3((byPerson[r.borrowName] || 0) + remain);
        var bt = parseTime(r.borrowTime);
        if (bt && (now - bt) / 86400000 > overdueDays) overdue++;
      }
    }

    var topPerson = Object.keys(byPerson).map(function (k) { return { name: k, qty: byPerson[k] }; })
      .sort(function (a, b) { return b.qty - a.qty; });

    return {
      itemKinds: items.length,
      totalStock: totalStock,
      totalOut: totalOut,
      openCount: openCount,
      totalRecords: records.length,
      overdueCount: overdue,
      overdueDays: overdueDays,
      openByItem: byItem,
      openByPerson: byPerson,
      topPerson: topPerson
    };
  }

  /* ---------- 人员名单自动补充 ---------- */

  function ensureStaff(db, name) {
    name = String(name || '').trim();
    if (!name) return null;
    for (var i = 0; i < db.staff.length; i++) {
      if (norm(db.staff[i].name) === norm(name)) return db.staff[i];
    }
    var s = { id: makeId('s'), name: name, dept: '', note: '', createdAt: fmtTime() };
    db.staff.push(s);
    return s;
  }

  function ensureItem(db, name, unit) {
    name = String(name || '').trim();
    if (!name) return null;
    for (var i = 0; i < db.items.length; i++) {
      if (norm(db.items[i].name) === norm(name)) return db.items[i];
    }
    var it = {
      id: makeId('i'), code: '', name: name, alias: '', spec: '',
      unit: unit || '', stock: 0, safeStock: 0, note: '', createdAt: fmtTime()
    };
    db.items.push(it);
    return it;
  }

  /* =====================================================================
   * 9. 备份 / 恢复 序列化
   * ===================================================================== */

  function emptyDB() {
    return {
      version: 2,
      warehouse: '',
      items: [],
      staff: [],
      records: [],
      logs: [],
      settings: { fuzzyThreshold: FUZZY_THRESHOLD, overdueDays: 30 },
      updatedAt: fmtTime()
    };
  }

  function migrate(raw) {
    var db = emptyDB();
    if (!raw || typeof raw !== 'object') return db;
    db.warehouse = raw.warehouse || '';
    db.items = Array.isArray(raw.items) ? raw.items : [];
    db.staff = Array.isArray(raw.staff) ? raw.staff : [];
    db.records = Array.isArray(raw.records) ? raw.records : [];
    db.logs = Array.isArray(raw.logs) ? raw.logs : [];
    if (raw.settings) db.settings = Object.assign(db.settings, raw.settings);

    // 兼容旧版：把 records 里的名字补进 staff
    for (var i = 0; i < db.records.length; i++) {
      var r = db.records[i];
      if (r.qty == null) r.qty = 1;
      if (r.returnedQty == null) r.returnedQty = (r.status === '已归还' || (r.returnTime && r.returnName)) ? r.qty : 0;
      if (!r.status) r.status = remainOf(r) <= 1e-9 ? '已归还' : '借出';
      if (r.borrowName) ensureStaff(db, r.borrowName);
      if (r.returnName) ensureStaff(db, r.returnName);
    }
    db.updatedAt = raw.updatedAt || fmtTime();
    return db;
  }

  /* =====================================================================
   * 导出
   * ===================================================================== */

  return {
    // 文本
    toHalfWidth: toHalfWidth,
    norm: norm,
    levenshtein: levenshtein,
    similarity: similarity,
    rankCandidates: rankCandidates,
    // 数字
    cnNumToArabic: cnNumToArabic,
    extractQuantity: extractQuantity,
    UNITS: UNITS,
    // 解析
    detectAction: detectAction,
    extractTokens: extractTokens,
    isStopToken: isStopToken,
    stripNoise: stripNoise,
    parseCommand: parseCommand,
    itemNames: itemNames,
    isSameName: isSameName,
    tokenVariants: tokenVariants,
    FUZZY_THRESHOLD: FUZZY_THRESHOLD,
    CANDIDATE_SHOW_THRESHOLD: CANDIDATE_SHOW_THRESHOLD,
    // 模糊查找
    fuzzyAffinity: fuzzyAffinity,
    scoreOne: scoreOne,
    scoreKeyword: scoreKeyword,
    itemSearchFields: itemSearchFields,
    recordSearchFields: recordSearchFields,
    searchItems: searchItems,
    searchRecords: searchRecords,
    SEARCH_EXACT_BASE: SEARCH_EXACT_BASE,
    SEARCH_FUZZY_CEIL: SEARCH_FUZZY_CEIL,
    SEARCH_FUZZY_THRESHOLD: SEARCH_FUZZY_THRESHOLD,
    // 数据
    makeId: makeId,
    fmtTime: fmtTime,
    parseTime: parseTime,
    round3: round3,
    findById: findById,
    remainOf: remainOf,
    isOpen: isOpen,
    applyBorrow: applyBorrow,
    applyReturn: applyReturn,
    applyStockIn: applyStockIn,
    applyStockSet: applyStockSet,
    removeRecord: removeRecord,
    filterRecords: filterRecords,
    findOpenRecords: findOpenRecords,
    computeStats: computeStats,
    ensureStaff: ensureStaff,
    ensureItem: ensureItem,
    emptyDB: emptyDB,
    migrate: migrate
  };
});
