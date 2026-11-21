'use strict';
/* ===== 게임 상태와 경제 규칙 ===== */
const MODES = { std: { ql: 27, dec: 25, label: '표준 (약 20분)' }, fast: { ql: 13, dec: 18, label: '스피드 (약 10분)' }, demo: { ql: 6, dec: 12, label: '체험 (약 5분)' } };
const SPREAD = { apt: 1.4, office: 1.9, factory: 2.1, land: 2.6 };
const LTVFIX = { office: .65, factory: .65, land: .5 };
const SALARY = .15, HOUSING = .05, CREDIT_MAX = 3, CREDIT_SPREAD = 4, EMERG_RATE = 18, EMERG_MAX = 3, START_CASH = 10;
const DEV = {
  apt: { name: '아파트 분양', k: 'apt', gm: 3.3, cm: 1.7, dur: 6, speed: .15 },
  office: { name: '오피스 개발', k: 'office', gm: 3.9, cm: 2.1, dur: 8, speed: .09 },
  logis: { name: '물류센터 개발', k: 'factory', gm: 2.9, cm: 1.35, dur: 5, speed: .11 }
};
const PLV = [{ v: .92, label: '할인 분양', sp: 1.45 }, { v: 1, label: '시세 분양', sp: 1 }, { v: 1.1, label: '고가 분양', sp: .6 }];

let W = null, S = null, running = false, paused = false, popup = null, popQ = [], view = null, tab = 'asset', lastSettle = null;
const luck = Math.random;

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function won(x) { const neg = x < -1e-9 ? '-' : '', a = Math.abs(x); if (a >= .99995) return neg + a.toFixed(2) + '억'; return neg + Math.round(a * 10000).toLocaleString('en-US') + '만'; }
const sgn = x => (x > 1e-9 ? '+' : '') + won(x);
const pct = (x, d = 1) => (x > 0 ? '+' : '') + x.toFixed(d) + '%';
const cls = x => x > 5e-4 ? 'up' : x < -5e-4 ? 'down' : '';
function qLabel(q) { const i = 3 + q; return (2026 + Math.floor(i / 4)) + '년 ' + (i % 4 + 1) + '분기'; }
const yearOf = q => 2026 + Math.floor((3 + q) / 4);

function newState(cfg) {
  return {
    v: 2, name: cfg.name, seedStr: cfg.seedStr, seed: cfg.seed, init: cfg.init, mode: cfg.mode,
    q: 0, tq: 0, over: false, cash: START_CASH, usd: 0, usdCost: 0,
    own: {}, gone: {}, credit: 0, emerg: 0, projects: [], mezz: [], bets: [], due: [], dedYear: 0,
    news: [], hist: [START_CASH], rumorQ: -1,
    stats: { rent: 0, interest: 0, tAcq: 0, tCgt: 0, tHold: 0, tBiz: 0, broker: 0, housing: 0, dep: 0, salary: 0, realized: 0, jackpot: 0, pf: 0, mezz: 0, fx: 0, trades: 0, maxLev: 0, forced: 0, jackN: 0 },
    p: { x: 24, y: 9, dir: 0 }
  };
}

/* ----- 시세·금리 조회 ----- */
const price = (id, q = S.q) => W.price[id][Math.min(q, W.Q)];
const pol = (q = S.q) => POL[W.stance[Math.min(q, W.Q)]];
const ltvMax = (t, q = S.q) => t === 'apt' ? W.ltvApt[q] : LTVFIX[t];
const mortRate = (t, q = S.q) => W.r[q] + SPREAD[t];
const pfRate = (q = S.q) => W.r[q] + 4.5 + W.pfAdj[q];
const depRate = (q = S.q) => Math.max(0, W.r[q] - .5);
function rentQ(id, q = S.q) { const p = PBY[id]; if (p.type === 'land') return 0; return p.p0 * p.yield / 100 * W.rent[p.type][q] * W.occ[p.type][q] / 4; }
const sellDisc = (t, q = S.q) => clamp(-W.sent[q] * .09, 0, .1) * (t === 'land' ? 1.5 : 1);
function locNow(id) { const p = PBY[id], o = Object.assign({}, p.loc); for (const e of W.locEv) if (e.id === id && e.q <= S.q) o[e.key] = clamp(o[e.key] + e.d, 0, 10); return o; }
function devTypes(id) { const a = PBY[id].dev.slice(); if (W.devUnlock[id] != null && W.devUnlock[id] <= S.q && !a.includes('apt')) a.push('apt'); return a; }
const usdVal = () => S.usd * W.fx[S.q] / 1e8;
const houseCount = (own = S.own) => Object.keys(own).filter(id => PBY[id].type === 'apt').length;
const liveHome = () => Object.keys(S.own).find(id => S.own[id].live);
const taxDue = () => S.due.reduce((a, d) => a + d.amt, 0);
function debt() { let d = S.credit + S.emerg + taxDue(); for (const id in S.own) d += S.own[id].loan; return d; }
function assets() { let a = S.cash + usdVal(); for (const id in S.own) a += price(id); for (const p of S.projects) a += p.eqPaid; for (const m of S.mezz) a += m.amt; for (const b of S.bets) a += b.amt; return a; }
const netWorth = () => assets() - debt();
const earnsRent = o => o.kind !== 'jeonse' && !o.dev && !o.live;
function flowNow(q = S.q) { // 이번 분기 예상 현금흐름
  const f = { rent: 0, intr: 0, tax: 0, dep: Math.max(0, S.cash) * depRate(q) / 400, sal: SALARY, house: liveHome() ? 0 : HOUSING };
  for (const id in S.own) { const o = S.own[id], p = PBY[id]; if (earnsRent(o)) f.rent += rentQ(id, q); if (o.kind === 'mort') f.intr += o.loan * mortRate(p.type, q) / 400; }
  f.intr += S.credit * (W.r[q] + CREDIT_SPREAD) / 400 + S.emerg * EMERG_RATE / 400;
  for (const d of S.due) if (d.q === q) f.tax += d.amt;
  f.net = f.rent + f.dep + f.sal - f.intr - f.tax - f.house; return f;
}

/* ===== 세금: 2026년 11월 현행 세법 기준. 정부 기조(POL)에 따라 중과·공제 등이 달라진다 ===== */
/* 종합소득 기본세율 (소득세법 제55조): 과세표준 구간(억), 세율(%), 누진공제(억) */
const BRK = [.14, .5, .88, 1.5, 3, 5, 10, Infinity], BRT = [6, 15, 24, 35, 38, 40, 42, 45], BDED = [0, .0126, .0576, .1544, .1994, .2594, .3594, .6594];
function progTax(base, add = 0) { if (base <= 0) return 0; let i = 0; while (base > BRK[i]) i++; return base * (BRT[i] + add) / 100 - BDED[i]; }
const brokerRate = (p, pr) => p.type === 'apt' ? (pr < 9 ? .4 : pr < 12 ? .5 : pr < 15 ? .6 : .7) : .9;   // 중개보수 상한요율(%)

/* 취득세 (지방세법 제11조·제13조의2). 청운시는 조정대상지역, 아파트는 모두 전용 85㎡ 이하라 농어촌특별세 없음 */
function acqCalc(id, pr, q = S.q) {
  const p = PBY[id], P = pol(q); let rate, edu, rural = 0, label;
  if (p.type === 'apt') {
    const n = houseCount() + 1, m = n >= 3 ? P.acq[1] : n === 2 ? P.acq[0] : 0;
    if (m) { rate = m; edu = .4; label = `취득세 (${n >= 3 ? '3주택 이상' : '2주택'} 중과 ${m}%)`; }
    else { rate = pr <= 6 ? 1 : pr <= 9 ? pr * 2 / 3 - 3 : 3; edu = rate / 10; label = `취득세 (주택 ${rate.toFixed(2)}%)`; }
  } else if (p.style === 'farm') { rate = 3; edu = .2; rural = .2; label = '취득세 (농지 3%)'; }
  else { rate = 4; edu = .4; rural = .2; label = '취득세 (주택 외 4%)'; }
  const br = brokerRate(p, pr);
  return { rate, edu, rural, label, main: pr * rate / 100, sur: pr * (edu + rural) / 100, tax: pr * (rate + edu + rural) / 100, broker: pr * br / 100, br };
}
/* 근저당권 설정 등록면허세: 채권최고액(대출의 120%) × 0.2% + 지방교육세 20% */
const regTax = loan => loan * 1.2 * .0024;

/* 양도소득세 (소득세법 제95조·제104조). 건별 계산, 양도차손 통산은 생략 */
function cgtCalc(id, gross, fee, q = S.q) {
  const p = PBY[id], o = S.own[id], P = pol(q), hold = q - o.buyQ, yrs = Math.floor(hold / 4);
  const r = { gain: gross - fee - o.basis, hold, exempt: 0, ltd: 0, ltdRate: 0, ded: 0, base: 0, tax: 0, local: 0, total: 0, label: '', notes: [] };
  if (r.gain <= 0) { r.label = '양도차손'; r.notes.push('차익이 없어 양도소득세가 없습니다.'); return r; }
  let taxable = r.gain, add = 0, flat = 0;
  if (p.type === 'apt') {
    const n = houseCount(), liveY = Math.floor((o.liveQ || 0) / 4);
    if (n === 1 && hold >= 8 && (o.liveQ || 0) >= 8) {
      if (gross <= 12) { r.exempt = r.gain; r.label = '1세대 1주택 비과세'; r.notes.push('2년 이상 보유·거주, 양도가 12억 이하라 전액 비과세입니다.'); return r; }
      taxable = r.gain * (gross - 12) / gross; r.exempt = r.gain - taxable;
      if (yrs >= 3) r.ltdRate = Math.min(.4, yrs * .04) + Math.min(.4, liveY * .04);
      r.notes.push('1세대 1주택 고가주택: 12억 초과분만 과세하고, 보유·거주 각 연 4% 공제합니다.');
    } else {
      if (hold < 4) flat = 70; else if (hold < 8) flat = 60;
      if (n >= 2) add = P.sur[n >= 3 ? 1 : 0];
      if (!add && yrs >= 3) r.ltdRate = Math.min(.3, yrs * .02);
      if (add) r.notes.push(`조정대상지역 ${n >= 3 ? '3주택 이상' : '2주택'}: 기본세율 +${add}%p, 장기보유특별공제 배제.`);
      else if (n >= 2) r.notes.push('다주택이지만 현 정부 기조에서 중과가 배제됩니다.');
      else if (hold >= 8) r.notes.push('실거주 2년을 채우지 않아 1세대 1주택 비과세를 받지 못합니다.');
    }
  } else {
    if (hold < 4) flat = 50; else if (hold < 8) flat = 40;
    if (p.type === 'land') { add = P.landSur; if (add) r.notes.push(`비사업용 토지: 기본세율 +${add}%p.`); }
    if (yrs >= 3) r.ltdRate = Math.min(.3, yrs * .02);
  }
  r.ltd = taxable * r.ltdRate;
  r.ded = Math.min(S.dedYear === yearOf(q) ? 0 : .025, taxable - r.ltd);
  r.base = Math.max(0, taxable - r.ltd - r.ded);
  const tProg = progTax(r.base, add), tFlat = r.base * flat / 100;
  r.tax = Math.max(tProg, tFlat);
  r.label = tFlat >= tProg && flat ? `단기 보유 ${flat}%` : `기본세율 6~45%${add ? ' +' + add + '%p' : ''}`;
  if (flat) r.notes.push(hold < 4 ? `1년이 되는 ${4 - hold}분기 뒤에는 단기 세율이 ${p.type === 'apt' ? 60 : 40}%로 내려갑니다.` : `2년이 되는 ${8 - hold}분기 뒤에는 단기 세율 대신 기본세율이 적용됩니다.`);
  else if (yrs < 3 && !add) r.notes.push(`장기보유특별공제는 3년 보유부터입니다 (${12 - hold}분기 남음).`);
  r.local = r.tax * .1; r.total = r.tax + r.local; return r;
}

/* 보유세: 재산세(지방세법 제111조)와 종합부동산세(종부세법 제8조·제9조·제14조). 과세기준일 6월 1일, 공시가격은 1월 1일 시세 기준 */
function holdAssess(qb, own = S.own, P = pol(qb)) {
  const H = [], L = [], Sp = []; let farm = 0;
  for (const id in own) {
    const o = own[id], p = PBY[id], v = price(id, qb);
    if (p.type === 'apt') H.push(v * .69);
    else if (p.type === 'land') { if (o.dev) Sp.push([v * .65, 0]); else if (p.style === 'farm') farm += v * .65; else L.push(v * .65); }
    else Sp.push([v * .65 * .6, v * .65 * .4]);
  }
  const sum = a => a.reduce((x, y) => x + y, 0), one = H.length === 1;
  let prop = 0, jb = 0;
  for (const pub of H) {   // 주택분 재산세 (1세대 1주택 특례 포함)
    const b = pub * (one ? (pub <= 3 ? .43 : pub <= 6 ? .44 : .45) : .6);
    const t = one && pub <= 9 ? (b <= .6 ? b * .0005 : b <= 1.5 ? .0003 + (b - .6) * .001 : b <= 3 ? .0012 + (b - 1.5) * .002 : .0042 + (b - 3) * .0035)
      : (b <= .6 ? b * .001 : b <= 1.5 ? .0006 + (b - .6) * .0015 : b <= 3 ? .00195 + (b - 1.5) * .0025 : .0057 + (b - 3) * .004);
    prop += t * 1.2 + b * .0014;
  }
  const bL = sum(L) * .7; if (bL > 0) prop += (bL <= .5 ? bL * .002 : bL <= 1 ? .001 + (bL - .5) * .003 : .0025 + (bL - 1) * .005) * 1.2 + bL * .0014;
  const bS = sum(Sp.map(x => x[0])) * .7, bB = sum(Sp.map(x => x[1])) * .7;
  if (bS > 0) prop += (bS <= 2 ? bS * .002 : bS <= 10 ? .004 + (bS - 2) * .003 : .028 + (bS - 10) * .004) * 1.2 + bS * .0014;
  prop += bB * .0025 * 1.2 + bB * .0014 + farm * .7 * .0007 * 1.2;
  const jH = Math.max(0, sum(H) - (one ? P.ded1 : P.ded)) * P.fmv;   // 주택분 종부세
  if (jH > 0) {
    const m = H.length >= 3;
    const t = jH <= 3 ? jH * .005 : jH <= 6 ? jH * .007 - .006 : jH <= 12 ? jH * .01 - .024
      : jH <= 25 ? (m ? jH * .02 - .144 : jH * .013 - .06) : jH <= 50 ? (m ? jH * .03 - .394 : jH * .015 - .11)
      : jH <= 94 ? (m ? jH * .04 - .894 : jH * .02 - .36) : (m ? jH * .05 - 1.834 : jH * .027 - 1.018);
    jb += Math.max(0, t - jH * .6 * .004);
  }
  const jL = Math.max(0, sum(L) - 5);   // 종합합산 토지분
  if (jL > 0) jb += Math.max(0, (jL <= 15 ? jL * .01 : jL <= 45 ? jL * .02 - .15 : jL * .03 - .6) - jL * .7 * .005);
  const jS = Math.max(0, sum(Sp.map(x => x[0])) - 80);   // 별도합산 토지분
  if (jS > 0) jb += Math.max(0, (jS <= 200 ? jS * .005 : jS <= 400 ? jS * .006 - .2 : jS * .007 - .6) - jS * .7 * .004);
  return { prop, jb: jb * 1.2 };   // 종부세에는 농어촌특별세 20% 가산
}
function holdExtra(id) { const a = holdAssess(S.q, Object.assign({}, S.own, { [id]: {} })), b = holdAssess(S.q); return { prop: a.prop - b.prop, jb: a.jb - b.jb }; }

/* ----- 매매 ----- */
function buyCalc(id, mode, frac, ov, live) {
  const p = PBY[id], pr = ov ? ov.price : price(id), a = acqCalc(id, pr);
  const loan = mode === 'jeonse' ? price(id) * W.jr[S.q] : pr * frac;
  const reg = mode !== 'jeonse' && loan > 0 ? regTax(loan) : 0, basis = pr + a.tax + a.broker + (ov && ov.extra || 0);
  const rate = mode === 'jeonse' ? 0 : mortRate(p.type);
  return { pr, a, loan, reg, basis, need: basis + reg - loan, rate, intQ: loan * rate / 400, rent: mode === 'jeonse' || live ? 0 : rentQ(id) };
}
function doBuy(id, mode, frac, ov, live) {
  if (S.own[id] || S.gone[id]) return false;
  const p = PBY[id]; live = !!live && p.type === 'apt' && mode !== 'jeonse';
  if (live && liveHome()) { toast('이미 다른 집에 살고 있습니다. 먼저 전출하세요', 'bad'); return false; }
  const c = buyCalc(id, mode, frac, ov, live);
  if (c.need > S.cash + 1e-9) { toast('현금이 ' + won(c.need - S.cash) + ' 부족합니다', 'bad'); return false; }
  S.cash -= c.need;
  S.own[id] = { buyQ: S.q, buyPrice: c.pr, basis: c.basis, loan: c.loan, kind: c.loan > 0 ? (mode === 'jeonse' ? 'jeonse' : 'mort') : null, jq: S.q, cap: ltvMax(p.type), live, liveQ: 0 };
  S.stats.trades++; S.stats.tAcq += c.a.tax + c.reg; S.stats.broker += c.a.broker;
  toast(`${p.name} 매수 완료 (취득세 등 ${won(c.a.tax + c.reg)})`, 'good'); refreshAll(); return true;
}
function sellCalc(id, forced) {
  const p = PBY[id], o = S.own[id], pr = price(id), disc = forced ? .2 : sellDisc(p.type);
  const gross = pr * (1 - disc), fee = forced ? 0 : gross * brokerRate(p, gross) / 100, c = cgtCalc(id, gross, fee);
  return { pr, disc, gross, fee, c, repay: o.loan, net: gross - fee - c.total - o.loan };
}
function applySale(id, s) {
  const T = S.stats; S.cash += s.net; T.realized += s.c.gain - s.c.total; T.tCgt += s.c.total; T.broker += s.fee; T.trades++;
  if (s.c.ded > 0) S.dedYear = yearOf(S.q);
  delete S.own[id];
}
function doSell(id) {
  const o = S.own[id]; if (!o || o.dev) return;
  const s = sellCalc(id);
  if (S.cash + s.net < -1e-9) { toast('매도 대금으로 빚과 세금을 다 치르지 못합니다. 현금이 ' + won(-(S.cash + s.net)) + ' 더 필요합니다', 'bad'); return; }
  applySale(id, s);
  toast(`${PBY[id].name} 매도: 양도세 ${won(s.c.total)}, 세후 차익 ${sgn(s.c.gain - s.c.total)}`, s.c.gain >= 0 ? 'good' : 'bad'); refreshAll();
}
function setLive(id, on) {
  const o = S.own[id]; if (!o || PBY[id].type !== 'apt' || o.kind === 'jeonse') return;
  if (on && liveHome()) { toast('이미 다른 집에 살고 있습니다', 'bad'); return; }
  o.live = !!on; toast(on ? '전입했습니다. 임대수익은 없지만 주거비가 들지 않습니다' : '전출했습니다. 다시 임대를 놓습니다', 'good'); refreshAll();
}
function repayLoan(id, amt) { const o = S.own[id]; if (!o || !o.loan) return; const a = Math.min(amt, o.loan, Math.max(0, S.cash)); if (a <= 0) { toast('상환할 현금이 없습니다', 'bad'); return; } o.loan -= a; S.cash -= a; if (o.loan < 1e-6) { o.loan = 0; if (o.kind === 'mort') o.kind = null; } refreshAll(); }
function borrowMore(id) {
  const o = S.own[id], p = PBY[id]; if (!o || o.kind === 'jeonse') return;
  const add = ltvMax(p.type) * price(id) - o.loan; if (add < .01) { toast('추가 대출 한도가 없습니다', 'bad'); return; }
  const reg = regTax(add); o.loan += add; o.kind = 'mort'; o.cap = Math.max(o.cap || 0, ltvMax(p.type)); S.cash += add - reg; S.stats.tAcq += reg;
  toast(`추가 대출 ${won(add)} (등록면허세 ${won(reg)})`, 'good'); refreshAll();
}
function creditMove(d) {
  if (d > 0) { const a = Math.min(d, CREDIT_MAX - S.credit); if (a <= 0) { toast('신용대출 한도를 모두 썼습니다', 'bad'); return; } S.credit += a; S.cash += a; }
  else { const a = Math.min(-d, S.credit, Math.max(0, S.cash)); if (a <= 0) return; S.credit -= a; S.cash -= a; }
  refreshAll();
}
function emergRepay() { const a = Math.min(S.emerg, Math.max(0, S.cash)); S.emerg -= a; S.cash -= a; refreshAll(); }
function usdBuy() { if (S.cash < 1) { toast('1억 단위로 살 수 있습니다', 'bad'); return; } S.cash -= 1; S.usd += 1e8 / (W.fx[S.q] * 1.005); S.usdCost += 1; refreshAll(); }
function usdSell(all) {
  if (S.usd <= 0) return; const amt = all ? S.usd : Math.min(S.usd, 1e8 / W.fx[S.q]);
  const got = amt * W.fx[S.q] * .995 / 1e8, cost = S.usdCost * amt / S.usd;
  S.usd -= amt; S.usdCost -= cost; if (S.usd < 1) { S.usd = 0; S.usdCost = 0; }
  S.cash += got; S.stats.fx += got - cost; toast('달러 매도: 환차손익 ' + sgn(got - cost), got >= cost ? 'good' : 'bad'); refreshAll();
}

/* ----- 프로젝트 파이낸싱 ----- */
function bizTax(profit, P) { if (profit <= 0) return { charge: 0, tax: 0 }; const charge = profit * P.devCharge / 100; return { charge, tax: progTax(profit - charge) * 1.1 }; }
function pfCalc(id, typ, pli) {
  const p = PBY[id], d = DEV[typ], pl = PLV[pli], loc = locNow(id);
  let ld = 0; for (const k in loc) ld += loc[k] - p.loc[k];
  const gdvM = p.p0 * d.gm * W.idx[d.k][S.q] * (1 + .03 * ld), gdv = gdvM * pl.v;
  const cost = p.p0 * d.cm * W.cost[S.q], eq = cost * .2, loan = cost * .8, rate = pfRate();
  const fin = loan * .55 * rate / 100 * d.dur / 4, land = price(id);
  const soldEst = Math.min(1, d.speed * pl.sp * d.dur * clamp(1 + 1.6 * W.sent[S.q], .1, 2.2));
  const rev = gdv * soldEst + gdvM * (1 - soldEst) * .8, profit = rev - land - cost - fin;
  const bookProfit = rev - S.own[id].basis - cost - fin, bt = bizTax(bookProfit, pol());
  return { gdvM, gdv, cost, eq, loan, rate, fin, land, soldEst, rev, profit, bt, dur: d.dur };
}
function startPF(id, typ, pli) {
  const o = S.own[id]; if (!o || o.dev || o.kind === 'jeonse') return;
  if (W.pfFreeze[S.q]) { toast('PF 시장이 얼어붙어 신규 대출이 중단되었습니다', 'bad'); return; }
  if (!devTypes(id).includes(typ)) return;
  const c = pfCalc(id, typ, pli);
  if (S.cash < c.eq) { toast('자기자본 ' + won(c.eq) + '이 필요합니다', 'bad'); return; }
  S.cash -= c.eq; o.dev = true;
  S.projects.push({ id, typ, pli, q0: S.q, dur: c.dur, gdvM: c.gdvM, cost0: c.cost, eqPaid: c.eq, eqLeft: c.eq, loan: 0, intAcc: 0, spent: 0, sold: 0, rev: 0, el: 0 });
  toast(PBY[id].name + ' 개발 사업 착공', 'good'); refreshAll();
}
function mezzBuy(i) {
  const of = W.mezz[Math.min(9, Math.floor(S.q / 4))][i]; if (!of) return;
  if (S.cash < 1) { toast('1억 단위로 투자합니다', 'bad'); return; }
  if (S.q + of.term > W.Q) { toast('게임 종료 전에 만기가 오지 않는 상품입니다', 'bad'); return; }
  S.cash -= 1; S.mezz.push({ name: of.name, k: of.k, yield: of.yield, term: of.term, amt: 1, q0: S.q, due: S.q + of.term }); toast(of.name + '에 1억 투자', 'good'); refreshAll();
}

/* ----- 정책 기조 비교표 ----- */
function polRows(a, b) {
  const A = POL[a], B = POL[b], f = (x, y) => x === y ? x : `${x} → <b>${y}</b>`;
  const sur = P => P.sur[0] ? `2주택 +${P.sur[0]}%p · 3주택 +${P.sur[1]}%p` : '중과 배제';
  const acq = P => (P.acq[0] ? `2주택 ${P.acq[0]}%` : '2주택 일반세율') + ` · 3주택 ${P.acq[1]}%`;
  return [['다주택 양도세 중과', f(sur(A), sur(B))], ['비사업용 토지 양도세 가산', f(A.landSur ? '+' + A.landSur + '%p' : '없음', B.landSur ? '+' + B.landSur + '%p' : '없음')],
    ['다주택 취득세', f(acq(A), acq(B))], ['종부세 공정시장가액비율', f(A.fmv * 100 + '%', B.fmv * 100 + '%')], ['종부세 주택 공제 (일반 / 1주택)', f(`${A.ded}억 / ${A.ded1}억`, `${B.ded}억 / ${B.ded1}억`)],
    ['아파트 담보대출 한도', f('LTV ' + A.ltv * 100 + '%', 'LTV ' + B.ltv * 100 + '%')], ['개발부담금 (개발 이익 대비)', f(A.devCharge ? A.devCharge + '%' : '없음', B.devCharge ? B.devCharge + '%' : '없음')], ['전월세 상한제', f(A.rentCap ? '시행' : '없음', B.rentCap ? '시행' : '없음')]];
}
const polTable = (a, b) => '<table class="tb">' + polRows(a, b).map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('') + '</table>';

/* ----- 분기 결산 ----- */
function advanceQuarter() {
  const q0 = S.q, T = S.stats, st = { rent: 0, intr: 0, tax: 0, dep: 0, sal: SALARY, house: liveHome() ? 0 : HOUSING };
  for (const id in S.own) {
    const o = S.own[id], p = PBY[id];
    if (earnsRent(o)) st.rent += rentQ(id, q0);
    if (o.kind === 'mort') st.intr += o.loan * mortRate(p.type, q0) / 400;
    if (o.live) o.liveQ = (o.liveQ || 0) + 1;
  }
  st.intr += S.credit * (W.r[q0] + CREDIT_SPREAD) / 400 + S.emerg * EMERG_RATE / 400;
  st.dep = Math.max(0, S.cash) * depRate(q0) / 400;
  S.due = S.due.filter(d => { if (d.q > q0) return true; st.tax += d.amt; return false; });   // 재산세(3분기)·종부세(4분기) 납부
  st.net = st.rent + st.dep + st.sal - st.intr - st.tax - st.house;
  S.cash += st.net; lastSettle = st;
  T.rent += st.rent; T.interest += st.intr; T.tHold += st.tax; T.dep += st.dep; T.salary += st.sal; T.housing += st.house;
  if ((3 + q0) % 4 === 1) {   // 2분기 말: 6월 1일 과세기준일 보유분에 대해 재산세·종부세 확정
    const h = holdAssess(Math.max(0, q0 - 1));
    if (h.prop > 1e-5) S.due.push({ q: q0 + 1, name: yearOf(q0) + '년 재산세', amt: h.prop });
    if (h.jb > 1e-5) S.due.push({ q: q0 + 2, name: yearOf(q0) + '년 종합부동산세', amt: h.jb });
    if (h.prop + h.jb > 1e-5) toast(`6월 1일 과세기준일: 재산세 ${won(h.prop)}${h.jb > 1e-5 ? ', 종부세 ' + won(h.jb) : ''} 고지 예정`, 'bad');
  }
  S.q = q0 + 1; S.tq = 0; const q = S.q;

  /* 개발 사업 */
  S.projects = S.projects.filter(pr => {
    const d = DEV[pr.typ], pl = PLV[pr.pli]; pr.el++;
    const c = pr.cost0 / pr.dur * (W.cost[q] / W.cost[pr.q0]), fe = Math.min(pr.eqLeft, c);
    pr.eqLeft -= fe; pr.loan += c - fe; pr.spent += c;
    const it = pr.loan * pfRate(q0) / 400; pr.loan += it; pr.intAcc += it;
    const gm = pr.gdvM * W.idx[d.k][q] / W.idx[d.k][pr.q0], qoq = (W.idx[d.k][q] / W.idx[d.k][q0] - 1) * 100;
    const ns = Math.min(1 - pr.sold, d.speed * pl.sp * clamp(1 + 1.6 * W.sent[q] + .08 * qoq, .1, 2.2));
    pr.sold += ns; pr.rev += ns * gm * pl.v;
    if (pr.el < pr.dur) return true;
    const un = 1 - pr.sold, rev = pr.rev + un * gm * .8, o = S.own[pr.id], ll = o ? o.loan : 0;
    const profit = rev - pr.loan - pr.eqPaid - (o ? o.basis : 0), bt = bizTax(profit, pol(q)), net = rev - pr.loan - ll - bt.charge - bt.tax;
    S.cash += net; T.pf += profit - bt.charge - bt.tax; T.tBiz += bt.charge + bt.tax; delete S.own[pr.id]; S.gone[pr.id] = pr.typ; paintGone(pr.id);
    pushPopup({
      kind: profit >= 0 ? 'win' : 'lose', title: PBY[pr.id].name + ' ' + d.name + ' 준공',
      body: `<table class="tb"><tr><td>분양·매각 수입 (분양률 ${(pr.sold * 100).toFixed(0)}%)</td><td>${won(rev)}</td></tr><tr><td>PF 대출 상환 (이자 ${won(pr.intAcc)} 포함)</td><td>-${won(pr.loan)}</td></tr><tr><td>토지 담보대출 상환</td><td>-${won(ll)}</td></tr><tr class="tot"><td>세전 사업 이익 (토지 원가·자기자본 차감 후)</td><td class="${cls(profit)}">${sgn(profit)}</td></tr>${bt.charge ? `<tr><td>개발부담금 (${pol(q).devCharge}%)</td><td>-${won(bt.charge)}</td></tr>` : ''}<tr><td>사업소득세·지방소득세 (기본세율)</td><td>-${won(bt.tax)}</td></tr><tr class="tot"><td>통장에 들어온 돈</td><td>${sgn(net)}</td></tr></table><p class="lesson">${un > .3 ? '미분양이 많아 20% 할인 매각이 손익을 깎았습니다. 분양가와 시장 분위기가 분양률을 좌우합니다.' : '분양이 순조로워 PF를 무리 없이 갚았습니다. 시행 이익은 분양가, 공사비, 금융비의 차이에서 나옵니다.'}</p>`,
      choices: [{ label: '확인' }], timer: 12
    });
    return false;
  });

  /* 메자닌 만기 */
  S.mezz = S.mezz.filter(m => {
    if (q < m.due) return true;
    const ch = W.idx[m.k][q] / W.idx[m.k][m.q0] - 1;
    const back = ch >= -.04 ? m.amt * (1 + m.yield / 100 * m.term / 4) : ch >= -.12 ? m.amt * .9 : m.amt * .45;
    S.cash += back; T.mezz += back - m.amt;
    toast(`${m.name} 만기: ${sgn(back - m.amt)}`, back >= m.amt ? 'good' : 'bad'); return false;
  });

  /* 한탕 결과 */
  S.bets = S.bets.filter(b => { if (q < b.due) return true; resolveBet(b); return false; });

  /* 전세 재계약 */
  for (const id in S.own) {
    const o = S.own[id]; if (o.kind !== 'jeonse' || (q - o.jq) % 8 !== 0 || q === o.jq) continue;
    const nd = price(id, q) * W.jr[q], diff = nd - o.loan; o.loan = nd; S.cash += diff;
    if (diff < -.01) pushPopup({ kind: 'lose', title: '역전세 발생 · ' + PBY[id].name, body: `<p>전세 재계약 시점에 전세 시세가 내려가 보증금 차액 <b class="down">${won(-diff)}</b>을 세입자에게 돌려주었습니다.</p><p class="lesson">전세 보증금은 이자 없는 빚이지만, 시세가 내리면 현금으로 메워야 합니다.</p>`, choices: [{ label: '확인' }], timer: 10 });
    else toast(`${PBY[id].name} 전세 재계약: 보증금 ${sgn(diff)}`, 'good');
  }

  /* 담보가치 하락에 따른 상환 요구 */
  for (const id in S.own) {
    const o = S.own[id], p = PBY[id]; if (o.kind !== 'mort') continue;
    const lim = (Math.max(o.cap || 0, ltvMax(p.type, q)) + .15) * price(id, q);
    if (o.loan > lim + 1e-6) {
      const ex = o.loan - lim; o.loan -= ex; S.cash -= ex;
      pushPopup({ kind: 'lose', title: '은행의 상환 요구 · ' + p.name, body: `<p>담보 가치가 떨어져 대출 비율이 한도를 넘었습니다. 은행이 <b class="down">${won(ex)}</b>을 즉시 회수했습니다.</p><p class="lesson">값이 내릴 때 빚은 줄지 않습니다. 레버리지는 손실도 키웁니다.</p>`, choices: [{ label: '확인' }], timer: 10 });
    }
  }

  /* 현금 부족 처리 */
  if (S.cash > 0 && S.emerg > 0) { const a = Math.min(S.cash, S.emerg); S.cash -= a; S.emerg -= a; }
  if (S.cash < 0) {
    const first = S.emerg <= 0; S.emerg += -S.cash; S.cash = 0;
    if (first) pushPopup({ kind: 'lose', title: '현금이 바닥났습니다', body: `<p>부족분 ${won(S.emerg)}이 연 ${EMERG_RATE}% 긴급 대출로 넘어갔습니다. ${won(EMERG_MAX)}을 넘으면 은행이 부동산을 강제 경매에 넘깁니다.</p><p class="lesson">흑자 도산은 이익이 아닌 현금이 말라서 일어납니다. 세금 고지서도 현금으로 내야 합니다.</p>`, choices: [{ label: '확인' }], timer: 10 });
  }
  let guard = 0;
  while (S.emerg > EMERG_MAX && guard++ < 20) {
    let best = null, br = -1;
    for (const id in S.own) { const o = S.own[id]; if (o.dev) continue; const ratio = o.loan / price(id, q); if (ratio > br) { br = ratio; best = id; } }
    if (!best) break;
    const s = sellCalc(best, true); applySale(best, s); T.forced++;
    if (S.cash < 0) { S.emerg += -S.cash; S.cash = 0; } else { const a = Math.min(S.cash, S.emerg); S.cash -= a; S.emerg -= a; }
    pushPopup({ kind: 'lose', title: '강제 경매 · ' + PBY[best].name, body: `<p>긴급 대출이 한도를 넘어 은행이 담보를 경매에 넘겼습니다. 낙찰가는 시세의 80%인 ${won(s.gross)}였습니다.</p><p class="lesson">팔 시점을 내가 고르지 못하면 가장 나쁜 값에 팔게 됩니다.</p>`, choices: [{ label: '확인' }], timer: 10 });
  }

  /* 뉴스와 선거 */
  const nn = W.news[q] || [];
  for (const n of nn) S.news.unshift({ q, title: n.title, body: n.body, kind: n.kind });
  if (nn.length) showNews(nn);
  const crisis = nn.find(n => n.kind === '위기');
  if (crisis) pushPopup({ kind: 'lose', title: '속보 · ' + crisis.title, body: `<p>${crisis.body}</p><p class="lesson">위기 때는 좋은 자산도 함께 떨어집니다. 버틸 현금이 있는지가 생사를 가릅니다.</p>`, choices: [{ label: '확인' }], timer: 10 });
  const el = W.elect.find(e => e.q === q);
  if (el && q < W.Q) pushPopup({
    kind: 'jack', title: `개표 결과 · ${el.name}`, timer: MODES[S.mode].dec,
    body: `<p><b>${PARTY[el.devWin ? 'dev' : 'reg']}</b>${el.type === 'pres' ? ' 후보가 당선되었습니다' : '이 승리했습니다'}. ${PLEDGE[el.devWin ? 'dev' : 'reg']}</p>${el.from === el.to ? `<p>정부의 부동산 정책 기조는 「${POL[el.to].name}」 그대로입니다.</p>` : `<p><b>다음 분기부터</b> 정부 기조가 「${POL[el.from].name}」에서 「${POL[el.to].name}」(으)로 바뀝니다. 이번 분기 안의 거래에는 지금 제도가 적용됩니다.</p>${polTable(el.from, el.to)}`}<p class="lesson">세금과 대출 규제는 법이 바뀌면 함께 바뀝니다. 제도 변경 전후의 세후 수익을 비교해 보세요.</p>`,
    choices: [{ label: '확인' }]
  });

  const a = assets(); if (a > 0) T.maxLev = Math.max(T.maxLev, debt() / a);
  S.hist[q] = netWorth();
  if (S.hist[q] < 0) { endGame(true); return; }
  if (q >= W.Q) { endGame(false); return; }
  if (W.jack[q]) { const jp = jackPopup(W.jack[q]); if (jp) pushPopup(jp); }
  if (!view) toast(`${qLabel(q0)} 결산: 임대 ${sgn(st.rent)}, 이자 -${won(st.intr)}${st.tax > 0 ? ', 보유세 -' + won(st.tax) : ''} → ${sgn(st.net)}`, st.net >= 0 ? 'good' : 'bad');
  refreshAll();
}

/* ----- 한 탕 이벤트 ----- */
function addBet(key, label, amt, term) { S.cash -= amt; S.bets.push({ key, label, amt, due: S.q + term }); S.stats.jackN++; refreshAll(); }
function resolveBet(b) {
  const q = S.q, u = luck(); let mult, msg, lesson;
  if (b.key === 'ticket') { const ok = u < .55; mult = ok ? 2.4 : .4; msg = ok ? '관리처분인가가 났습니다. 입주권 값이 2.4배로 뛰었습니다.' : '조합 내분과 소송으로 사업이 멈췄습니다. 입주권은 0.4배에 겨우 팔렸습니다.'; lesson = '기대값이 높아도 한 번의 결과는 운입니다. 감당할 만큼만 걸었는지가 실력입니다.'; }
  else if (b.key === 'scam') { const ok = u < .08; mult = ok ? 6 : 0; msg = ok ? '기적처럼 개발제한구역이 풀렸습니다. 6배가 되었습니다.' : '업체는 사라졌고, 임야 지분은 팔 수도 쓸 수도 없습니다. 전액 손실입니다.'; lesson = '원금 보장, 고수익, 지분 쪼개기, 재촉. 기획부동산의 네 가지 신호였습니다.'; }
  else if (b.key === 'npl') { const ok = u < .6; mult = ok ? 1.55 : .65; msg = ok ? '경매 배당을 온전히 받았습니다. +55%.' : '선순위 권리에 밀려 배당이 깎였습니다. -35%.'; lesson = '부실채권은 싸게 사는 대신 권리 분석의 위험을 떠안는 투자입니다.'; }
  else if (b.key === 'hotel') { const ok = u < .35; mult = ok ? 1.2 : .3; msg = ok ? '운영사가 약속한 수익을 지급했습니다. +20%.' : '운영사가 부도를 냈습니다. 원금의 30%만 건졌습니다.'; lesson = '확정 수익은 운영사의 신용만큼만 확정입니다. 보장 주체를 먼저 보세요.'; }
  else { const bad = W.pfFreeze[q] || W.sent[q] < -.3; mult = bad ? .5 : 1.1; msg = bad ? '금융시장이 얼어붙어 본 PF 전환에 실패했습니다. 절반만 돌려받았습니다.' : '본 PF가 실행되어 원금과 이자를 받았습니다. +10%.'; lesson = '브릿지론의 성패는 차주가 아닌 그 시점의 금융시장이 정합니다.'; }
  const back = b.amt * mult, diff = back - b.amt; S.cash += back; S.stats.jackpot += diff;
  pushPopup({ kind: diff >= 0 ? 'win' : 'lose', title: b.label + ' 결과', body: `<p>${msg}</p><p class="big ${cls(diff)}">${sgn(diff)}</p><p class="lesson">${lesson}</p>`, choices: [{ label: '확인' }], timer: 12 });
}
function jackPopup(type) {
  const q = S.q, dec = MODES[S.mode].dec, pass = { label: '넘어간다', sub: '아무 일도 일어나지 않습니다' };
  if (type === 'lotto') {
    const gain = 3 * W.idx.apt[q];
    return { kind: 'jack', title: '한 탕 찬스 · 로또 청약', timer: dec, body: `<p>분양가 상한제가 적용된 「청운 르네상스」 무순위 청약 공고가 떴습니다. 당첨되면 입주 뒤 세후 시세 차익이 약 <b>${won(gain)}</b>. 당첨 확률은 15% 안팎이고, 당첨 시 계약금으로 현금 1억이 있어야 합니다.</p>`,
      choices: [{ label: '청약을 넣는다', sub: '당첨 확률 15% · 필요 현금 1억', dis: S.cash < 1, fn: () => { S.stats.jackN++; if (luck() < .15) { S.cash += gain; S.stats.jackpot += gain; pushPopup({ kind: 'win', title: '청약 당첨', body: `<p>당첨되었습니다. 입주 뒤 매도해 세후 차익을 챙겼습니다.</p><p class="big up">${sgn(gain)}</p><p class="lesson">잃을 것이 없는 기회는 잡는 것이 합리적입니다. 다만 현금이 묶여 있으면 기회 자체를 놓칩니다.</p>`, choices: [{ label: '확인' }], timer: 10 }); } else toast('청약 낙첨. 잃은 것은 없습니다', ''); refreshAll(); } }, pass] };
  }
  if (type === 'ticket') return { kind: 'jack', title: '한 탕 찬스 · 재개발 입주권', timer: dec, body: '<p>관리처분인가를 앞둔 재개발 구역의 입주권(일명 딱지)이 급매로 나왔습니다. 인가가 나면 2.4배, 조합 내분으로 사업이 멈추면 0.4배. 결과는 4분기 뒤에 나옵니다.</p>',
    choices: [{ label: '한 장 산다', sub: '2억 투자', dis: S.cash < 2, fn: () => addBet('ticket', '재개발 입주권', 2, 4) }, { label: '두 장 산다', sub: '4억 투자', dis: S.cash < 4, fn: () => addBet('ticket', '재개발 입주권', 4, 4) }, pass] };
  if (type === 'scam') return { kind: 'jack', title: '한 탕 찬스 · 걸려 온 전화', timer: dec, body: '<p>「회원님께만 알려 드리는 정보인데요, 개발제한구역 해제가 확정된 임야입니다. 3년 안에 10배, 원금 보장 각서도 써 드려요. 오늘 마감입니다.」 1억을 넣으면 임야 지분 0.3%를 등기해 준다고 합니다.</p>',
    choices: [{ label: '1억을 넣는다', sub: '결과는 3분기 뒤', dis: S.cash < 1, fn: () => addBet('scam', '임야 지분 투자', 1, 3) }, { label: '전화를 끊는다', sub: '아무 일도 일어나지 않습니다' }] };
  if (type === 'npl') return { kind: 'jack', title: '한 탕 찬스 · 부실채권 매입', timer: dec, body: '<p>저축은행이 연체된 담보대출 채권(NPL)을 할인해 팝니다. 3억에 사서 경매 배당을 온전히 받으면 +55%, 선순위 권리에 밀리면 -35%. 결과는 3분기 뒤에 나옵니다.</p>',
    choices: [{ label: '3억에 매입한다', sub: '성공 확률은 반반보다 조금 높습니다', dis: S.cash < 3, fn: () => addBet('npl', '부실채권 투자', 3, 3) }, pass] };
  if (type === 'hotel') return { kind: 'jack', title: '한 탕 찬스 · 수익 보장 분양형 호텔', timer: dec, body: '<p>「연 12% 확정 수익, 10년 임대 보장」 광고입니다. 한 구좌 2억. 운영사가 버티면 6분기 뒤 +20%, 운영사가 무너지면 원금의 30%만 건집니다. 운영사 재무제표는 공개하지 않습니다.</p>',
    choices: [{ label: '한 구좌 계약한다', sub: '2억 투자', dis: S.cash < 2, fn: () => addBet('hotel', '분양형 호텔', 2, 6) }, pass] };
  if (type === 'bridge') return { kind: 'jack', title: '한 탕 찬스 · 브릿지론 대주 참여', timer: dec, body: '<p>토지 잔금이 급한 시행사가 2분기짜리 초단기 자금을 구합니다. 3억을 빌려주면 2분기 뒤 +10%. 그사이 금융시장이 얼어붙으면 본 PF 전환에 실패해 절반만 돌려받습니다.</p>',
    choices: [{ label: '3억을 빌려준다', sub: '2분기 뒤 결과', dis: S.cash < 3, fn: () => addBet('bridge', '브릿지론', 3, 2) }, pass] };
  /* 경매·급매: 보유하지 않은 건물 하나. 취득세는 낙찰가·매매가 기준으로 그대로 붙는다 */
  const fire = type === 'fire';
  const id = W.jackProp.find(i => !S.own[i] && !S.gone[i] && (!fire || PBY[i].type === 'apt')); if (!id) return null;
  const p = PBY[id], mk = price(id), bid = mk * (fire ? .87 : .72), lf = fire ? ltvMax('apt') : .5;
  const c0 = buyCalc(id, 'mort', 0, { price: bid }), c1 = buyCalc(id, 'mort', lf, { price: bid });
  const go = frac => () => {
    S.stats.jackN++; let extra = 0;
    if (!fire && luck() < .25) extra = bid * .12;
    if (doBuy(id, 'mort', frac, { price: bid, extra })) {
      S.stats.jackpot += mk - bid - extra;
      pushPopup({ kind: extra ? 'lose' : 'win', title: (fire ? '급매 계약 · ' : '낙찰 · ') + p.name, body: `<p>시세 ${won(mk)}짜리를 ${won(bid)}에 손에 넣었습니다.${extra ? ` 다만 유치권자와 합의하느라 ${won(extra)}이 더 들었습니다.` : ''}</p><p class="lesson">싸게 살 기회는 남들이 돈이 없을 때 옵니다. 현금과 대출 여력이 곧 선택권입니다.</p>`, choices: [{ label: '확인' }], timer: 10 });
    }
  };
  return { kind: 'jack', title: (fire ? '한 탕 찬스 · 상속세 급매' : '한 탕 찬스 · 법원 경매'), timer: dec,
    body: (fire ? `<p>상속세 납부 기한에 쫓긴 집주인이 「${p.name}」을 시세 ${won(mk)}보다 13% 싼 <b>${won(bid)}</b>에 내놓았습니다. 오늘 계약해야 합니다.</p>` : `<p>감정가 ${won(mk)}인 「${p.name}」이 두 번 유찰되어 최저가 <b>${won(bid)}</b>(72%)에 나왔습니다. 유치권 신고가 한 건 있어, 네 번에 한 번꼴로 낙찰가의 12%가 추가로 듭니다.</p>`) + `<p class="muted">${c0.a.label} 등 취득 관련 세금 ${won(c0.a.tax)}이 따로 듭니다.</p>`,
    choices: [{ label: '전액 현금으로 산다', sub: '필요 현금 ' + won(c0.need), dis: S.cash < c0.need, fn: go(0) }, { label: `대출 ${(lf * 100).toFixed(0)}%를 끼고 산다`, sub: '필요 현금 ' + won(c1.need), dis: S.cash < c1.need, fn: go(lf) }, pass] };
}

/* ----- 결과 ----- */
function benchDeposit() { let c = START_CASH; const a = [c]; for (let q = 0; q < W.Q; q++) { c += c * depRate(q) / 400 + SALARY - HOUSING; a.push(c); } return a; }
function gradeOf(nw, bankrupt) {
  const B = benchDeposit()[W.Q];
  if (bankrupt || nw < START_CASH) return { g: 'F', t: bankrupt ? '파산' : '깡통 계좌', B };
  if (nw < B * .9) return { g: 'D', t: '하우스푸어', B };
  if (nw < B * 1.15) return { g: 'C', t: '예금 생활자', B };
  if (nw < B * 1.8) return { g: 'B', t: '성실한 건물주', B };
  if (nw < B * 3) return { g: 'A', t: '빌딩 부자', B };
  return { g: 'S', t: '전설의 큰손', B };
}

if (typeof module !== 'undefined') module.exports = { progTax, BRK };
