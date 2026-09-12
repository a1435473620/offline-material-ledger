/* 核心逻辑单元测试 —— node test/core.test.js */
const fs = require('fs');
const path = require('path');
const W = require('../src/core.js');

const lines = [];
console.log = function () { lines.push(Array.prototype.map.call(arguments, String).join(' ')); };

let pass = 0, fail = 0;
const failures = [];

function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; }
  else { fail++; failures.push(`✗ ${label}\n    期望: ${e}\n    实际: ${a}`); }
}
function truthy(v, label) {
  if (v) pass++; else { fail++; failures.push(`✗ ${label}  (期望为真，实际 ${JSON.stringify(v)})`); }
}
function falsy(v, label) {
  if (!v) pass++; else { fail++; failures.push(`✗ ${label}  (期望为假，实际 ${JSON.stringify(v)})`); }
}
function group(name, fn) { console.log(`\n── ${name} ──`); fn(); }

/* ---------------- 造一个测试库 ---------------- */
function makeDB() {
  const db = W.emptyDB();
  db.warehouse = '中心仓';
  db.items = [
    { id: 'i1', name: 'M6螺丝', spec: '不锈钢', alias: '内六角螺栓', unit: '个', stock: 100 },
    { id: 'i2', name: 'M8螺丝', spec: '', alias: '', unit: '个', stock: 50 },
    { id: 'i3', name: '活动扳手', spec: '8寸', alias: '扳手, 开口扳手', unit: '把', stock: 10 },
    { id: 'i4', name: 'A4纸', spec: '70g', alias: '打印纸', unit: '箱', stock: 20 },
    { id: 'i5', name: '轴承', spec: '6204', alias: '', unit: '个', stock: 30 }
  ];
  db.staff = [
    { id: 's1', name: '张三' },
    { id: 's2', name: '李四' },
    { id: 's3', name: '王五' },
    { id: 's4', name: '陈建国' },
    { id: 's5', name: '赵敏' }
  ];
  return db;
}

/* ================================================================= */
group('1. 中文数字', () => {
  eq(W.cnNumToArabic('三'), 3, '三 => 3');
  eq(W.cnNumToArabic('十五'), 15, '十五 => 15');
  eq(W.cnNumToArabic('二十五'), 25, '二十五 => 25');
  eq(W.cnNumToArabic('两'), 2, '两 => 2');
  eq(W.cnNumToArabic('一百'), 100, '一百 => 100');
  eq(W.cnNumToArabic('半'), 0.5, '半 => 0.5');
  eq(W.cnNumToArabic('12'), 12, '12 => 12');
  eq(W.cnNumToArabic('abc'), null, 'abc => null');
});

group('2. 数量抽取', () => {
  eq(W.extractQuantity('了2个').qty, 2, '"了2个" => 2');
  eq(W.extractQuantity('了2个').unit, '个', '"了2个" 单位=个');
  eq(W.extractQuantity('5箱').qty, 5, '"5箱" => 5');
  eq(W.extractQuantity('两个').qty, 2, '"两个" => 2');
  eq(W.extractQuantity('三台').qty, 3, '"三台" => 3');
  eq(W.extractQuantity('随便'), null, '"随便" => 无');
});

group('3. 相似度', () => {
  eq(W.similarity('张三', '张三'), 1, '张三=张三 => 1');
  truthy(W.similarity('张', '张三') > 0.75, '"张" vs "张三" 高相似（打不全）');
  truthy(W.similarity('小张', '张三') < 0.45, '"小张" vs "张三" 低相似');
  truthy(W.similarity('李四', '张三') < 0.35, '李四 vs 张三 极低');
  truthy(W.similarity('扳手', '活动扳手') > 0.8, '扳手 vs 活动扳手 高相似');
  truthy(W.similarity('M6螺丝', 'M8螺丝') > 0.7, 'M6 vs M8 高相似（应列入候选）');
  truthy(W.similarity('A4纸', '打印纸') < 0.45, 'A4纸 vs 打印纸 低（别名另走通道）');
});

group('4. 动作识别', () => {
  eq(W.detectAction(W.norm('张三借了扳手')).action, 'borrow', '借了 => borrow');
  eq(W.detectAction(W.norm('张三归还扳手')).action, 'return', '归还 => return');
  eq(W.detectAction(W.norm('李四还回来两个')).action, 'return', '还回来 => return');
  eq(W.detectAction(W.norm('还有几个扳手')).action, 'borrow', '"还有" 不误判为归还');
  eq(W.detectAction(W.norm('还有几个扳手')).word, '', '"还有" 不产生动作词');
  eq(W.detectAction(W.norm('王五领用A4纸')).action, 'borrow', '领用 => borrow');
  eq(W.detectAction(W.norm('赵敏退回一箱纸')).action, 'return', '退回 => return');
});

/* ================================================================= */
group('5. 解析：标准句式', () => {
  const db = makeDB();

  const r1 = W.parseCommand('张三借了2个M6螺丝', db);
  eq(r1.action, 'borrow', '①动作');
  eq(r1.person && r1.person.name, '张三', '①人名');
  eq(r1.item && r1.item.name, 'M6螺丝', '①物料');
  eq(r1.qty, 2, '①数量');
  eq(r1.unit, '个', '①单位');
  eq(r1.ok, true, '①整体可用');

  const r2 = W.parseCommand('李四归还了5箱A4纸', db);
  eq(r2.action, 'return', '②动作');
  eq(r2.person.name, '李四', '②人名');
  eq(r2.item.name, 'A4纸', '②物料');
  eq(r2.qty, 5, '②数量');
  eq(r2.unit, '箱', '②单位');

  const r3 = W.parseCommand('王五拿了三把活动扳手', db);
  eq(r3.person.name, '王五', '③人名');
  eq(r3.item.name, '活动扳手', '③物料');
  eq(r3.qty, 3, '③中文数量');
  eq(r3.unit, '把', '③单位');
});

group('6. 解析：别名', () => {
  const db = makeDB();
  const r = W.parseCommand('张三借2个内六角螺栓', db);
  eq(r.item && r.item.name, 'M6螺丝', '别名"内六角螺栓" => M6螺丝');
});

group('7. 解析：人名打不全（核心需求）', () => {
  const db = makeDB();

  const r1 = W.parseCommand('张借了一把扳手', db);
  eq(r1.person && r1.person.name, '张三', '"张" 归到 张三');
  eq(r1.personConfidence, 'medium', '"张" 标为中等置信度（需人工确认）');
  truthy(r1.warnings.some(w => /姓名没打全/.test(w)), '"张" 应提示姓名没打全');

  const r1b = W.parseCommand('张三借了一把扳手', db);
  eq(r1b.personConfidence, 'high', '完整姓名 => 高置信度');

  const r2 = W.parseCommand('小张借了2个M6螺丝', db);
  eq(r2.person && r2.person.name, '张三', '「小张」按昵称匹配到 张三');
  eq(r2.personConfidence, 'medium', '昵称匹配必须标为待确认');
  truthy(r2.warnings.some(w => /没打全/.test(w)), '昵称匹配应提示确认');

  const r3 = W.parseCommand('老王借了1个轴承', db);
  eq(r3.person && r3.person.name, '王五', '「老王」按昵称匹配到 王五');

  const r4 = W.parseCommand('彻底不认识的人借了个东西', db);
  eq(r4.person, null, '完全不认识的人不应硬猜');
  truthy(r4.warnings.some(w => /没有识别出人名|名单里没有/.test(w)), '应提示人名没认出来');
});

group('8. 解析：物料打不全', () => {
  const db = makeDB();
  const r = W.parseCommand('李四借了5个螺丝', db);
  eq(r.person && r.person.name, '李四', '人名');
  truthy(r.item === null || /螺丝/.test(r.item.name), '模糊"螺丝"应给候选');
  truthy(r.itemCandidates.length >= 1, '"螺丝" 应有候选');
});

group('9. 解析：库存不足 / 未匹配提示', () => {
  const db = makeDB();
  const r = W.parseCommand('陈建国借1000个轴承', db);
  eq(r.person.name, '陈建国', '完整人名');
  eq(r.qty, 1000, '数量');
  const out = W.applyBorrow(db, { itemId: r.item.id, qty: r.qty, personName: r.person.name });
  eq(out.ok, false, '库存不足应拒绝');
  truthy(/库存不足/.test(out.error), '错误文案');
});

group('9b. 昵称与别名的置信度', () => {
  const db = makeDB();

  const r1 = W.parseCommand('李四借了2把扳手', db);
  eq(r1.item && r1.item.name, '活动扳手', '「扳手」是别名，应命中活动扳手');
  eq(r1.itemConfidence, 'high', '别名命中算准确，不必再确认');

  const r2 = W.parseCommand('李四借了5箱打印纸', db);
  eq(r2.item && r2.item.name, 'A4纸', '「打印纸」是别名');
  eq(r2.itemConfidence, 'high', '别名命中 => high');

  const r3 = W.parseCommand('张三借了2个M6螺丝', db);
  eq(r3.itemConfidence, 'high', '正式名命中 => high');
  eq(r3.personConfidence, 'high', '全名命中 => high');

  const r4 = W.parseCommand('张三借了2个螺丝', db);
  eq(r4.itemConfidence, 'medium', '只说「螺丝」有歧义 => medium');

  const r5 = W.parseCommand('李四借了2个内六角螺栓', db);
  eq(r5.item && r5.item.name, 'M6螺丝', '别名「内六角螺栓」');
  eq(r5.itemConfidence, 'high', '别名命中 => high');
});

/* ================================================================= */
group('10. 借出 / 归还 / 部分归还', () => {
  const db = makeDB();
  const item = db.items[0]; // M6螺丝 stock=100

  const b = W.applyBorrow(db, { itemId: item.id, qty: 10, personName: '张三', time: '2026-09-01 09:00' });
  eq(b.ok, true, '借出成功');
  eq(item.stock, 90, '借出后库存 90');
  eq(b.record.status, '借出', '状态=借出');
  eq(db.records.length, 1, '记录数=1');

  const p = W.applyReturn(db, { recordId: b.record.id, qty: 4, personName: '张三', time: '2026-09-05 10:00' });
  eq(p.ok, true, '部分归还成功');
  eq(item.stock, 94, '部分归还后库存 94');
  eq(db.records[0].status, '部分归还', '状态=部分归还');
  eq(W.remainOf(db.records[0]), 6, '剩余未还 6');

  const p2 = W.applyReturn(db, { recordId: b.record.id, personName: '李四', time: '2026-09-10 10:00' });
  eq(p2.ok, true, '剩余全部归还');
  eq(item.stock, 100, '全部归还后库存回到 100');
  eq(db.records[0].status, '已归还', '状态=已归还');
  eq(db.records[0].returnName, '李四', '归还人记录');

  const p3 = W.applyReturn(db, { recordId: b.record.id, personName: '张三' });
  eq(p3.ok, false, '重复归还应拒绝');
});

group('11. 删除记录回滚库存', () => {
  const db = makeDB();
  const item = db.items[0];
  W.applyBorrow(db, { itemId: item.id, qty: 7, personName: '张三' });
  eq(item.stock, 93, '借出后 93');
  W.removeRecord(db, db.records[0].id);
  eq(item.stock, 100, '删除未还记录后库存回滚到 100');
  eq(db.records.length, 0, '记录已删除');
});

group('12. 统计与筛选', () => {
  const db = makeDB();
  W.applyBorrow(db, { itemId: 'i1', qty: 10, personName: '张三', time: '2026-08-01 09:00' });
  W.applyBorrow(db, { itemId: 'i3', qty: 2, personName: '李四', time: '2026-09-11 09:00' });
  W.applyBorrow(db, { itemId: 'i4', qty: 1, personName: '张三', time: '2026-09-12 09:00' });
  eq(db.records[0].itemName, 'A4纸', '最新记录在最前');
  W.applyReturn(db, { recordId: db.records[0].id, personName: '张三', time: '2026-09-12 10:00' });

  const st = W.computeStats(db);
  eq(st.openCount, 2, '未归还条数 2');
  eq(st.totalOut, 12, '在外数量 12');
  eq(st.itemKinds, 5, '物料种类 5');

  eq(W.filterRecords(db, { status: '已归还' }).length, 1, '筛选已归还');
  eq(W.filterRecords(db, { keyword: '张三' }).length, 2, '筛选张三');
  eq(W.filterRecords(db, { openOnly: true }).length, 2, '筛选未归还');
  eq(W.filterRecords(db, { itemId: 'i1' }).length, 1, '筛选物料');
});

group('13. 时间解析', () => {
  eq(W.fmtTime(new Date(2026, 8, 12, 9, 5)), '2026-09-12 09:05', '格式化');
  eq(W.parseTime('2026/09/12 09:05').getMonth(), 8, '斜杠日期');
  eq(W.parseTime('2026-09-12').getDate(), 12, '纯日期');
  eq(W.parseTime('乱写'), null, '非法返回 null');
});

group('14. 数据迁移 / 旧数据兼容', () => {
  const old = {
    items: [{ id: 'i1', name: '螺丝', stock: 10 }],
    records: [
      { id: 'r1', itemId: 'i1', itemName: '螺丝', borrowName: '张三', borrowTime: '2026-09-01 09:00', returnName: '张三', returnTime: '2026-09-02 09:00' },
      { id: 'r2', itemId: 'i1', itemName: '螺丝', borrowName: '李四', borrowTime: '2026-09-03 09:00', returnName: '', returnTime: '' }
    ]
  };
  const db = W.migrate(old);
  eq(db.records[0].status, '已归还', '旧数据：有归还时间 => 已归还');
  eq(db.records[1].status, '借出', '旧数据：无归还时间 => 借出');
  eq(db.records[0].returnedQty, 1, '旧数据：已归还 returnedQty=1');
  eq(db.records[1].returnedQty, 0, '旧数据：未归还 returnedQty=0');
  eq(db.staff.length, 2, '旧数据：自动补出 2 名人员');
});

/* ================================================================= */
group('15. 模糊查找', () => {
  const db = makeDB();

  // ---- 打分 ----
  eq(W.scoreKeyword('螺丝', 'M6螺丝').fuzzy, false, '包含关系算精确命中');
  eq(W.scoreKeyword('罗丝', '螺丝').fuzzy, true, '错别字算模糊命中');
  truthy(W.scoreKeyword('罗丝', '螺丝').score >= W.SEARCH_FUZZY_THRESHOLD, '错别字能过入围门槛');
  truthy(W.scoreKeyword('M6螺丝', 'M8螺丝').score < W.SEARCH_EXACT_BASE, '模糊命中的分数压得比精确低');
  truthy(W.SEARCH_FUZZY_CEIL < W.SEARCH_EXACT_BASE, '两档分数不交叉：相近的永远排精确的后面');
  eq(W.scoreKeyword('', 'M6螺丝').score, 0, '空关键词不命中');
  eq(W.scoreKeyword('az', 'M6螺丝').score, 0, '不相关的词不命中');

  // ---- 容错与噪音的边界 ----
  truthy(W.fuzzyAffinity('罗丝', '螺丝') >= W.SEARCH_FUZZY_THRESHOLD, '真错字（错一个字）能过门槛');
  truthy(W.fuzzyAffinity('手套', '扳手') < W.SEARCH_FUZZY_THRESHOLD, '只碰巧撞上一个字，过不了门槛');
  truthy(W.fuzzyAffinity('手套', '活动扳手') < W.SEARCH_FUZZY_THRESHOLD, '撞一个字且位置不对，不该误报');
  truthy(W.fuzzyAffinity('罗丝', '螺丝') > W.fuzzyAffinity('手套', '扳手'), '错字的得分高于撞字的得分');
  eq(W.scoreKeyword('手套', ['劳保手套', '活动扳手']).fuzzy, false, '同一字段里精确命中优先于模糊');

  // ---- 可搜字段 ----
  const f = W.itemSearchFields(db.items[2]);   // 活动扳手，别名「扳手, 开口扳手」
  truthy(f.indexOf('活动扳手') !== -1, '正式名在可搜字段里');
  truthy(f.indexOf('扳手') !== -1, '别名被拆成独立字段');
  truthy(f.indexOf('开口扳手') !== -1, '第二个别名也在');

  // ---- 物料查找 ----
  const r1 = W.searchItems(db, '螺丝');
  eq(r1.map(x => x.name), ['M6螺丝', 'M8螺丝'], '「螺丝」命中两个螺丝');
  eq(r1.every(x => !x.fuzzy), true, '「螺丝」都是精确命中');

  const r2 = W.searchItems(db, '罗丝');   // 打错一个字
  eq(r2.map(x => x.name), ['M6螺丝', 'M8螺丝'], '错字「罗丝」也能找回螺丝');
  eq(r2.every(x => x.fuzzy), true, '错字结果是模糊命中，需要界面提示');

  eq(W.searchItems(db, '扳手').map(x => x.name), ['活动扳手'], '「扳手」走别名命中活动扳手');
  eq(W.searchItems(db, '不锈钢').map(x => x.name), ['M6螺丝'], '「不锈钢」走规格命中');
  eq(W.searchItems(db, '内六角').map(x => x.name), ['M6螺丝'], '「内六角」走别名命中');
  eq(W.searchItems(db, '纸').map(x => x.name), ['A4纸'], '单字「纸」能命中 A4纸');
  eq(W.searchItems(db, '手套', { limit: 99 }).map(x => x.name), [], '「手套」在没有手套的库里不该误报');
  eq(W.searchItems(db, '不存在的物料').length, 0, '完全无关的词查不到东西');

  // ---- 精确排在相近之前 ----
  const r3 = W.searchItems(db, 'M6螺丝');
  eq(r3.length, 2, '「M6螺丝」命中 2 条（含相近的 M8螺丝）');
  eq(r3[0].name, 'M6螺丝', '精确命中的 M6螺丝 排第一');
  eq(r3[0].fuzzy, false, '第一位是精确命中');
  eq(r3[1].name, 'M8螺丝', '相近的 M8螺丝 排第二');
  eq(r3[1].fuzzy, true, '第二位标为相近');

  eq(W.searchItems(db, '螺丝', { limit: 1 }).length, 1, 'limit 生效');

  // ---- 台账查找 ----
  const db2 = makeDB();
  W.applyBorrow(db2, { itemId: 'i1', qty: 10, personName: '张三', time: '2026-08-01 09:00' });
  W.applyBorrow(db2, { itemId: 'i2', qty: 5, personName: '王五', time: '2026-09-10 09:00' });
  W.applyBorrow(db2, { itemId: 'i3', qty: 2, personName: '李四', time: '2026-09-11 09:00' });
  W.applyBorrow(db2, { itemId: 'i4', qty: 1, personName: '张三', time: '2026-09-12 09:00' });

  const s0 = W.searchRecords(db2, {});
  eq(s0.records.length, 4, '没有关键词时返回全部');
  eq(s0.fuzzyCount, 0, '没有关键词时没有相近结果');

  const s1 = W.searchRecords(db2, { keyword: '张三' });
  eq(s1.records.length, 2, '「张三」命中 2 条');
  eq(s1.fuzzyCount, 0, '「张三」全是精确命中');
  eq(s1.exactCount, 2, 'exactCount = 2');

  const s2 = W.searchRecords(db2, { keyword: '张四' });   // 错字
  truthy(s2.fuzzyCount > 0, '错字「张四」应产出相近结果');
  truthy(s2.records.length >= 2, '错字也能找回张三/李四的记录');
  eq(Object.keys(s2.fuzzyIds).length, s2.fuzzyCount, 'fuzzyIds 与 fuzzyCount 数量一致');

  const s3 = W.searchRecords(db2, { keyword: 'M6螺丝' });
  eq(s3.records.length, 2, '「M6螺丝」命中 2 条（含相近的 M8螺丝）');
  eq(s3.fuzzyIds[s3.records[0].id], undefined, '精确命中排在相近结果之前');
  eq(s3.fuzzyIds[s3.records[1].id], 1, '后面那条被标为相近');

  const s4 = W.searchRecords(db2, { keyword: '张三', itemId: 'i1' });
  eq(s4.records.length, 1, '关键词与物料筛选同时生效');
  eq(W.searchRecords(db2, { openOnly: true }).records.length, 4, '只看未还时 4 条都没还');
});

/* ================================================================= */
console.log('\n' + '='.repeat(56));
if (fail) {
  console.log('失败用例：\n' + failures.join('\n'));
  console.log('='.repeat(56));
}
console.log(`通过 ${pass} 项，失败 ${fail} 项`);

fs.writeFileSync(path.join(__dirname, 'result.txt'), lines.join('\n'), 'utf8');
process.exit(fail ? 1 : 0);
