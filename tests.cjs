// 決策引擎測試（載入 index.html 中 /*ENGINE-START*/…/*ENGINE-END*/ 區塊）
// Run: node tests.cjs
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/\/\*ENGINE-START\*\/([\s\S]*?)\/\*ENGINE-END\*\//);
if (!m) throw new Error('engine block not found');
const mod = { exports: {} };
new Function('module', m[1])(mod);
const FS = mod.exports;

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}
const base = { ageMo: 24, weight: 12, duration: 'lt15', type: 'gen', recurrence: 1 };
const E = o => FS.evaluate({ ...base, ...o });

console.log('輸入驗證');
t('無年齡 → invalid', () => assert.equal(E({ ageMo: null }).valid, false));
t('空字串年齡 → invalid', () => assert.equal(E({ ageMo: '' }).valid, false));
t('負年齡 → invalid', () => assert.equal(E({ ageMo: -1 }).valid, false));
t('體重 0 → invalid', () => assert.equal(E({ weight: 0 }).valid, false));
t('無體重仍可評估', () => assert.equal(E({ weight: null }).valid, true));

console.log('分類');
t('典型 → simple', () => assert.equal(E({}).key, 'simple'));
t('15–29 分 → complex', () => assert.equal(E({ duration: '15to29' }).key, 'complex'));
t('局部 → complex', () => assert.equal(E({ type: 'focal' }).key, 'complex'));
t('24h ≥2 次 → complex', () => assert.equal(E({ recurrence: 2 }).key, 'complex'));
t('Todd → complex', () => assert.equal(E({ focalDeficit: true }).key, 'complex'));
t('≥30 分 → FSE', () => assert.equal(E({ duration: 'ge30' }).key, 'fse'));
t('腦膜徵候 → cns（優先於年齡）', () => assert.equal(E({ meningeal: true, ageMo: 3 }).key, 'cns'));
t('toxic → cns', () => assert.equal(E({ toxic: true }).key, 'cns'));
t('5 個月 → infant', () => assert.equal(E({ ageMo: 5 }).key, 'infant'));
t('6 個月 → 典型', () => assert.equal(E({ ageMo: 6 }).key, 'simple'));
t('59 個月 → 典型', () => assert.equal(E({ ageMo: 59 }).key, 'simple'));
t('60 個月 → 典型（AAP：6 through 60）', () => assert.equal(E({ ageMo: 60 }).key, 'simple'));
t('61 個月 → older', () => assert.equal(E({ ageMo: 61 }).key, 'older'));
t('曾無熱發作 → notFS', () => assert.equal(E({ afebrilePrior: true }).key, 'notFS'));

console.log('腰椎穿刺（AAP 2011）');
t('單純型 → 不需', () => assert.equal(E({}).lp.level, 'no'));
t('單純型 9 月 疫苗完整 → 不需（舊版錯誤：一律考慮）', () => assert.equal(E({ ageMo: 9 }).lp.level, 'no'));
t('單純型 9 月 疫苗不全 → option', () => assert.equal(E({ ageMo: 9, vaxIncomplete: true }).lp.level, 'option'));
t('單純型 24 月 疫苗不全 → 不需（option 只限 6–12 月）', () => assert.equal(E({ vaxIncomplete: true }).lp.level, 'no'));
t('已用抗生素（任何年齡）→ option', () => assert.equal(E({ ageMo: 36, abxPretreated: true }).lp.level, 'option'));
t('腦膜徵候 → must', () => assert.equal(E({ meningeal: true }).lp.level, 'must'));
t('< 6 月 → must', () => assert.equal(E({ ageMo: 4 }).lp.level, 'must'));
t('意識未恢復 → consider', () => assert.equal(E({ notBaseline: true }).lp.level, 'consider'));
t('複雜型 24 月 → 不需', () => assert.equal(E({ type: 'focal' }).lp.level, 'no'));
t('熱性重積意識恢復 → consider（AFP 2019）', () => assert.equal(E({ duration: 'ge30' }).lp.level, 'consider'));
t('熱性重積＋已用抗生素 → 仍 consider 並列出', () => {
  const lp = E({ duration: 'ge30', abxPretreated: true }).lp;
  assert.equal(lp.level, 'consider'); assert.match(lp.text, /抗生素/);
});
t('15–29 分鐘不受影響 → 不需', () => assert.equal(E({ duration: '15to29' }).lp.level, 'no'));

console.log('EEG / 影像');
t('單純型 EEG 不需', () => assert.equal(E({}).eeg.level, 'no'));
t('複雜型（延長、全身）EEG 不需常規（舊版：一律安排）', () => assert.equal(E({ duration: '15to29' }).eeg.level, 'no'));
t('複雜型局部 EEG option', () => assert.equal(E({ type: 'focal' }).eeg.level, 'option'));
t('FSE EEG consider', () => assert.equal(E({ duration: 'ge30' }).eeg.level, 'consider'));
t('意識未恢復 → 緊急 EEG', () => assert.match(E({ notBaseline: true }).eeg.text, /NCSE/));
t('單純型影像 不需', () => assert.equal(E({}).image.level, 'no'));
t('局部缺損 → 緊急 CT', () => assert.equal(E({ focalDeficit: true }).image.level, 'must'));
t('複雜型局部 → 非緊急 MRI', () => assert.equal(E({ type: 'focal' }).image.level, 'option'));
t('≥5 歲 單純特徵不建議常規 CT', () => assert.notEqual(E({ ageMo: 72 }).image.level, 'must'));

console.log('去向');
t('單純型 → 可出院', () => assert.match(E({}).dispo, /出院/));
t('FSE → 住院', () => assert.match(E({ duration: 'ge30' }).dispo, /住院/));
t('意識未恢復 → 住院', () => assert.match(E({ notBaseline: true }).dispo, /住院/));

console.log('復發率（Berg 1997）');
t('24 月 無因子 → 13%', () => { const r = E({}).recur; assert.equal(r.n, 0); assert.equal(r.pct, 13); });
t('12 月 → 1 項 23%', () => assert.equal(E({ ageMo: 12 }).recur.pct, 23));
t('17 月 + 家族史 → 32%', () => assert.equal(E({ ageMo: 17, famFS: true }).recur.pct, 32));
t('18 月不算年齡因子', () => assert.equal(E({ ageMo: 18 }).recur.n, 0));
t('四項全 → 76%', () => assert.equal(E({ ageMo: 10, famFS: true, tempLt40: true, feverLt1h: true }).recur.pct, 76));
t('非 FS 類 → 不計復發', () => assert.equal(E({ meningeal: true }).recur, null));

console.log('癲癇風險');
t('單純無因子 1–2%', () => assert.match(E({}).epi.text, /1–2%/));
t('延長+局部+反覆 → 49%', () => assert.match(E({ duration: '15to29', type: 'focal', recurrence: 2 }).epi.text, /49%/));
t('一項複雜特徵 → 6–8%', () => ['15to29', 'ge30'].forEach(d => assert.match(E({ duration: d }).epi.text, /6–8%/)));
t('局部一項 → 6–8%', () => assert.match(E({ type: 'focal' }).epi.text, /6–8%/));
t('反覆一項 → 6–8%', () => assert.match(E({ recurrence: 2 }).epi.text, /6–8%/));
t('發作後局部缺損視同局部 → 6–8%', () => assert.match(E({ focalDeficit: true }).epi.text, /6–8%/));
t('局部型＋局部缺損只算一項', () => assert.match(E({ type: 'focal', focalDeficit: true }).epi.text, /6–8%/));
t('延長＋局部 → 17–22%', () => assert.match(E({ duration: 'ge30', type: 'focal' }).epi.text, /17–22%/));
t('癲癇家族史計入',() => assert.ok(E({ famEpilepsy: true }).epi.factors.includes('癲癇家族史')));

console.log('急救用藥');
t('單純低風險 → 不開立', () => assert.equal(E({}).rescue.offer, false));
t('延長發作 → 開立', () => assert.equal(E({ duration: '15to29' }).rescue.offer, true));
t('高復發（≥3 因子）→ 開立', () => assert.equal(E({ ageMo: 10, famFS: true, tempLt40: true }).rescue.offer, true));
t('發作進行中 → 立即給藥', () => assert.match(E({ ongoing: true }).rescue.text, /立即/));
t('12 kg diazepam PR 6 mg', () => assert.equal(FS.rescueDoses(12).diazepamPR, 6));
t('50 kg diazepam PR cap 20', () => assert.equal(FS.rescueDoses(50).diazepamPR, 20));
t('60 kg midazolam IN cap 10', () => assert.equal(FS.rescueDoses(60).midazolamIN, 10));
t('8 kg midazolam IM 1.6', () => assert.equal(FS.rescueDoses(8).midazolamIM, 1.6));
t('20 kg midazolam IM 5', () => assert.equal(FS.rescueDoses(20).midazolamIM, 5));
t('40 kg midazolam IM 5（>40 kg 才 10）', () => assert.equal(FS.rescueDoses(40).midazolamIM, 5));
t('41 kg midazolam IM 10', () => assert.equal(FS.rescueDoses(41).midazolamIM, 10));
t('居家急救藥不再引用 AAP 2008 為開立條件', () => {
  const x = E({ duration: '15to29' }).rescue.text;
  assert.match(x, /AAP 2008 未訂開立條件/); assert.doesNotMatch(x, /離醫療院所遠者可考慮/);
});
t('lorazepam cap 4',() => assert.equal(FS.rescueDoses(70).lorazepamIV, 4));
t('無體重 → null', () => assert.equal(FS.rescueDoses(null), null));

// 教學內容（/*TEACH-START*/…/*TEACH-END*/）與引擎交叉核對
const tm = html.match(/\/\*TEACH-START\*\/([\s\S]*?)\/\*TEACH-END\*\//);
if (!tm) throw new Error('teach block not found');
const tmod = { exports: {} };
new Function('module', tm[1])(tmod);
const { CASES, QUIZ, MAP, SRC } = tmod.exports;

console.log('示範病例');
t('6 例、id 不重複', () => { assert.equal(CASES.length, 6); assert.equal(new Set(CASES.map(c => c.id)).size, 6); });
CASES.forEach((c, i) => {
  t(`病例 ${i + 1} 與引擎一致：${c.title}`, () => {
    const r = FS.evaluate(c.input), x = c.expect;
    assert.ok(r.valid);
    assert.equal(r.key, x.key); assert.equal(r.lp.level, x.lp);
    assert.equal(r.eeg.level, x.eeg); assert.equal(r.image.level, x.image);
    assert.equal(r.recur ? r.recur.pct : null, x.pct); assert.equal(r.rescue.offer, x.offer);
    if (x.diazepamPR !== undefined) assert.equal(r.rescue.doses.diazepamPR, x.diazepamPR);
    if (x.midazolamIM !== undefined) assert.equal(r.rescue.doses.midazolamIM, x.midazolamIM);
  });
  t(`病例 ${i + 1} 欄位完整`, () => {
    assert.ok(c.who && c.story && c.ask && c.pitfall);
    assert.ok(c.steps.length >= 4 && c.src.length >= 1);
  });
});
t('每個分類至少涵蓋：單純、複雜、重積、中樞感染', () => {
  const keys = CASES.map(c => FS.evaluate(c.input).key);
  ['simple', 'complex', 'fse', 'cns'].forEach(k => assert.ok(keys.includes(k)));
});
t('病例 3 癲癇風險 6–8%', () => assert.match(FS.evaluate(CASES[2].input).epi.text, /6–8%/));
t('病例 4 癲癇風險 6–8%', () => assert.match(FS.evaluate(CASES[3].input).epi.text, /6–8%/));
t('病例 5 癲癇風險 17–22%', () => assert.match(FS.evaluate(CASES[4].input).epi.text, /17–22%/));
t('第 14 題與引擎一致', () => { assert.match(QUIZ[13].o[QUIZ[13].a], /17–22%/); assert.match(E({ duration: '15to29', type: 'focal' }).epi.text, /17–22%/); });

console.log('考題');
t('20 題：基礎 10、高階 10', () => {
  assert.equal(QUIZ.length, 20);
  assert.equal(QUIZ.filter(q => q.lv === 'basic').length, 10);
  assert.equal(QUIZ.filter(q => q.lv === 'adv').length, 10);
});
t('每題 4 選項、不重複、有解析與依據', () => QUIZ.forEach(q => {
  assert.equal(q.o.length, 4); assert.equal(new Set(q.o).size, 4);
  assert.ok(q.a >= 0 && q.a < 4); assert.ok(q.e && q.s);
}));
t('正解 A–D 各 5 題', () => [0, 1, 2, 3].forEach(k => assert.equal(QUIZ.filter(q => q.a === k).length, 5)));
t('正解為唯一最長選項不超過 8 題', () => {
  const n = QUIZ.filter(q => q.o.every((x, j) => j === q.a || x.length < q.o[q.a].length)).length;
  assert.ok(n <= 8, `共 ${n} 題`);
});
const ans = n => QUIZ[n - 1].o[QUIZ[n - 1].a];
t('第 3 題與引擎一致：單純型 LP 不需', () => { assert.equal(E({ ageMo: 18 }).lp.level, 'no'); assert.match(ans(3), /不需/); });
t('第 11 題與引擎一致：10 月不詳 option、24 月不適用、14 月不適用', () => {
  assert.equal(E({ ageMo: 10, vaxIncomplete: true }).lp.level, 'option');
  assert.equal(E({ ageMo: 24, vaxIncomplete: true }).lp.level, 'no');
  assert.equal(E({ ageMo: 14, vaxIncomplete: true }).lp.level, 'no');
  assert.equal(E({ ageMo: 9 }).lp.level, 'no');
  assert.match(ans(11), /10 個月/);
});
t('第 12 題與引擎一致：4 歲已用抗生素 option', () => assert.equal(E({ ageMo: 48, abxPretreated: true }).lp.level, 'option'));
t('第 13 題 32%', () => {
  const pct = E({ ageMo: 16, tempLt40: true }).recur.pct;
  assert.equal(pct, 32); assert.equal(ans(13), pct + '%');
});
t('第 20 題 12 kg 劑量', () => {
  const d = FS.rescueDoses(12);
  assert.ok(ans(20).includes(d.diazepamPR + ' mg'));
  assert.equal(d.midazolamBuccal, 6); assert.equal(d.midazolamIN, 2.4);
  assert.notEqual(d.midazolamIM, 5);
});

console.log('心智圖與來源');
t('8 個分支，葉節點格式正確', () => {
  assert.equal(MAP.branches.length, 8);
  MAP.branches.forEach(b => { assert.ok(b.h && b.c && b.leaves.length >= 3); b.leaves.forEach(l => { assert.match(l.t, /^<b>.*?<\/b>.+$/); assert.ok(l.s); }); });
});
t('來源都有網址與閱讀範圍', () => SRC.forEach(s => { assert.match(s.u, /^https:\/\//); assert.ok(s.t && s.r); }));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
