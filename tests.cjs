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
t('60 個月 → older', () => assert.equal(E({ ageMo: 60 }).key, 'older'));
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
t('癲癇家族史計入', () => assert.ok(E({ famEpilepsy: true }).epi.factors.includes('癲癇家族史')));

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
t('lorazepam cap 4', () => assert.equal(FS.rescueDoses(70).lorazepamIV, 4));
t('無體重 → null', () => assert.equal(FS.rescueDoses(null), null));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
