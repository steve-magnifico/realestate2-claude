'use strict';
/* ===== 시장 세계 생성기: 시드가 같으면 금리·환율·시세·뉴스가 모두 같다 ===== */
const REAL = { asOf: '2026.11.26', rate: 3.25, fx: 1342.7, us: 4.00 };
const TYPES = ['land', 'apt', 'office', 'factory'];
const TKO = { land: '토지', apt: '아파트', office: '오피스', factory: '공장' };

/* 정부의 부동산 정책 기조: 0이 2026년 11월 현행 제도. 음수는 규제 강화, 양수는 규제 완화 (가상의 시나리오) */
const POL = {
  '-2': { name: '규제 대폭 강화', short: '강화++', sur: [30, 40], landSur: 20, acq: [8, 12], fmv: 1.0, ded: 6, ded1: 9, ltv: .4, devCharge: 25, rentCap: true },
  '-1': { name: '규제 강화', short: '강화', sur: [20, 30], landSur: 10, acq: [8, 12], fmv: .8, ded: 9, ded1: 12, ltv: .5, devCharge: 20, rentCap: true },
  '0': { name: '현행 유지', short: '현행', sur: [20, 30], landSur: 10, acq: [8, 12], fmv: .6, ded: 9, ded1: 12, ltv: .6, devCharge: 0, rentCap: false },
  '1': { name: '규제 완화', short: '완화', sur: [0, 0], landSur: 10, acq: [8, 12], fmv: .6, ded: 9, ded1: 12, ltv: .7, devCharge: 0, rentCap: false },
  '2': { name: '규제 대폭 완화', short: '완화++', sur: [0, 0], landSur: 0, acq: [0, 8], fmv: .6, ded: 12, ded1: 15, ltv: .7, devCharge: 0, rentCap: false }
};
const ELECT = [
  { q: 6, type: 'gen', name: '제23대 국회의원 선거' }, { q: 13, type: 'pres', name: '제22대 대통령 선거' },
  { q: 22, type: 'gen', name: '제24대 국회의원 선거' }, { q: 33, type: 'pres', name: '제23대 대통령 선거' }
];
const PARTY = { dev: '성장연합', reg: '안정연대' };
const PLEDGE = { dev: '성장연합은 공급 확대와 거래 규제 완화로 시장을 정상화하겠다고 약속했습니다.', reg: '안정연대는 투기 수요 억제와 보유세 강화로 주거 안정을 이루겠다고 약속했습니다.' };

const COEF = {
  BR:   { land: 5.0, apt: 4.5, office: 3.5, factory: 2.5 },   // 금리 변동 민감도 (%/1%p)
  LAM:  { land: .50, apt: .40, office: .35, factory: .25 },   // 금리 수준 부담 (%/분기, 3% 초과 1%p당)
  BG:   { land: .60, apt: .40, office: .70, factory: .60 },   // 경기 민감도
  BFX:  { land: -.03, apt: -.04, office: -.02, factory: .12 },// 환율 민감도
  GAM:  { land: 2.8, apt: 2.3, office: 1.4, factory: 1.0 },    // 심리 민감도
  MOM:  { land: .25, apt: .35, office: .20, factory: .15 },   // 추세 추종
  SIG:  { land: 1.4, apt: .9, office: .8, factory: .8 },
  IDIO: { land: 1.5, apt: .8, office: .8, factory: .8 }
};

const PROPS = [
  { id: 'L1', type: 'land', name: '외곽 농지', p0: 3.0, yield: 0, zone: '농림지역', dev: [], loc: { transit: 2, school: 2, jobs: 2, amenity: 6 }, bx: 1, by: 27, w: 5, h: 4, style: 'farm' },
  { id: 'L2', type: 'land', name: '역세권 예정지', p0: 6.5, yield: 0, zone: '준주거지역', dev: ['apt', 'office'], loc: { transit: 5, school: 4, jobs: 5, amenity: 4 }, bx: 9, by: 21, w: 5, h: 3, style: 'lot' },
  { id: 'L3', type: 'land', name: '강변 나대지', p0: 9.0, yield: 0, zone: '일반주거지역', dev: ['apt'], loc: { transit: 6, school: 6, jobs: 5, amenity: 7 }, bx: 39, by: 10, w: 4, h: 4, style: 'lot' },
  { id: 'L4', type: 'land', name: '산단 인접 부지', p0: 5.0, yield: 0, zone: '일반공업지역', dev: ['logis'], loc: { transit: 4, school: 2, jobs: 6, amenity: 3 }, bx: 28, by: 27, w: 6, h: 4, style: 'lot' },
  { id: 'A1', type: 'apt', name: '청운 센트럴파크 84㎡', p0: 14.0, yield: 2.4, loc: { transit: 8, school: 7, jobs: 8, amenity: 7 }, bx: 9, by: 2, w: 5, h: 6, style: 'apt', hue: 0 },
  { id: 'A2', type: 'apt', name: '강변 리버뷰 59㎡', p0: 9.5, yield: 2.6, loc: { transit: 6, school: 6, jobs: 6, amenity: 8 }, bx: 9, by: 10, w: 4, h: 4, style: 'apt', hue: 1 },
  { id: 'A3', type: 'apt', name: '새솔 신도시 1단지 84㎡', p0: 7.0, yield: 3.0, loc: { transit: 4, school: 5, jobs: 4, amenity: 6 }, bx: 1, by: 3, w: 4, h: 5, style: 'apt', hue: 2 },
  { id: 'A4', type: 'apt', name: '은하 주공 5단지 49㎡', p0: 5.2, yield: 2.2, loc: { transit: 6, school: 5, jobs: 6, amenity: 3 }, bx: 1, by: 10, w: 4, h: 4, style: 'oldapt' },
  { id: 'F1', type: 'factory', name: '제1산단 금속가공 공장', p0: 12.0, yield: 6.8, loc: { transit: 4, school: 2, jobs: 6, amenity: 2 }, bx: 38, by: 21, w: 5, h: 3, style: 'factory' },
  { id: 'F2', type: 'factory', name: '스마트 물류센터', p0: 24.0, yield: 5.8, loc: { transit: 6, school: 2, jobs: 6, amenity: 2 }, bx: 38, by: 26, w: 6, h: 5, style: 'logis' },
  { id: 'F3', type: 'factory', name: '지식산업센터 1개 층', p0: 8.0, yield: 6.2, loc: { transit: 5, school: 3, jobs: 6, amenity: 3 }, bx: 28, by: 21, w: 4, h: 3, style: 'kic' },
  { id: 'O1', type: 'office', name: '중앙로 꼬마빌딩', p0: 28.0, yield: 4.2, loc: { transit: 8, school: 5, jobs: 9, amenity: 6 }, bx: 32, by: 4, w: 3, h: 4, style: 'office', hue: 1 },
  { id: 'O2', type: 'office', name: '시청앞 오피스 A동', p0: 46.0, yield: 4.6, loc: { transit: 9, school: 5, jobs: 9, amenity: 6 }, bx: 28, by: 2, w: 4, h: 6, style: 'office', hue: 0 },
  { id: 'O3', type: 'office', name: '테크밸리 오피스', p0: 35.0, yield: 5.0, loc: { transit: 6, school: 4, jobs: 8, amenity: 5 }, bx: 46, by: 3, w: 3, h: 5, style: 'office', hue: 2 }
];
const PBY = {}; PROPS.forEach(p => PBY[p.id] = p);
const LOCKO = { transit: '교통', school: '학군', jobs: '일자리', amenity: '환경' };

const NEWS = [
  { key: 'gtx', tag: '교통', title: '광역급행철도 청운역 노선 확정', body: '역세권 예정지와 새솔 신도시에서 서울까지 걸리는 시간이 절반으로 줄어듭니다.',
    rumor: '역세권 예정지 쪽으로 급행철도 노선이 확정된다더라고.',
    fx: [['prop', 'L2', 24, 2], ['prop', 'A3', 9, 2], ['loc', 'L2', 'transit', 4], ['loc', 'A3', 'transit', 2]] },
  { key: 'chip', tag: '산업', title: '글로벌 반도체 기업, 청운 산단에 10조 원 투자', body: '협력업체 입주 수요로 산단 일대 공장과 부지의 몸값이 뜁니다.',
    rumor: '산단에 반도체 대기업이 들어온다는 얘기가 돌아.',
    fx: [['prop', 'L4', 22, 2], ['prop', 'F1', 9, 2], ['prop', 'F3', 10, 2], ['prop', 'F2', 6, 2], ['loc', 'L4', 'jobs', 2], ['loc', 'F1', 'jobs', 2], ['loc', 'F3', 'jobs', 2], ['typ', 'policy', 'apt', .5, 2]] },
  { key: 'supplyApt', tag: '수급', title: '새솔 신도시 2만 세대 동시 입주', body: '입주 물량이 쏟아지면서 아파트 매매가와 전세가가 함께 눌립니다.',
    rumor: '새솔 신도시 입주가 한꺼번에 몰린다던데. 물량 앞에 장사 없어.',
    fx: [['typ', 'supply', 'apt', 1.1, 4], ['prop', 'A3', -5, 2]] },
  { key: 'wfh', tag: '수급', title: '재택·거점 근무 확산, 오피스 공실률 급등', body: '기업들이 임차 면적을 줄이면서 오피스 임대수익이 줄어듭니다.',
    fx: [['typ', 'policy', 'office', -1.3, 3], ['vac', 'office', .08, 6]] },
  { key: 'ecom', tag: '산업', title: '이커머스 물류 수요 폭증, 물류센터 품귀', body: '창고를 구하지 못한 기업들이 웃돈을 얹어 임차 경쟁을 벌입니다.',
    rumor: '요즘 물류센터 구하는 회사가 줄을 섰대.',
    fx: [['prop', 'F2', 12, 2], ['typ', 'policy', 'factory', .7, 3]] },
  { key: 'school', tag: '입지', title: '청운 센트럴파크 인근에 대형 학원가와 자사고 조성', body: '학군 수요가 몰리면서 호가가 뜁니다.',
    rumor: '센트럴파크 앞으로 유명 학원가가 통째로 옮겨 온대.',
    fx: [['prop', 'A1', 10, 2], ['loc', 'A1', 'school', 2]] },
  { key: 'redev', tag: '정비', title: '은하 주공 5단지 재건축 정비구역 지정', body: '낡은 저층 단지가 새 아파트로 바뀐다는 기대에 값이 치솟습니다.',
    rumor: '은하 주공이 곧 재건축 구역으로 지정된대.',
    fx: [['pre', 'A4', 5], ['prop', 'A4', 26, 2], ['loc', 'A4', 'amenity', 2]] },
  { key: 'redevFail', tag: '정비', title: '은하 주공 5단지 재건축 안전진단 탈락', body: '재건축 기대감으로 올랐던 호가가 급히 빠집니다.',
    rumor: '은하 주공이 곧 재건축 구역으로 지정된대.', bust: true,
    fx: [['pre', 'A4', 5], ['prop', 'A4', -13, 1]] },
  { key: 'rawMat', tag: '원가', title: '원자재·인건비 급등, 건설 공사비 지수 사상 최고', body: '개발 사업의 공사비가 늘어 사업성이 나빠집니다.',
    fx: [['cost', 10], ['typ', 'policy', 'land', -1.0, 2]] },
  { key: 'newtown', tag: '개발', title: '외곽 농지 일대, 4기 신도시 후보지로 확정', body: '농림지역이 주거지역으로 바뀌어 아파트 개발이 가능해집니다.',
    rumor: '외곽 농지가 신도시 후보지로 찍혔다는 말이 있어.',
    fx: [['pre', 'L1', 7], ['prop', 'L1', 48, 2], ['unlock', 'L1'], ['loc', 'L1', 'transit', 3], ['loc', 'L1', 'jobs', 1]] },
  { key: 'newtownFail', tag: '개발', title: '4기 신도시 후보지 발표, 외곽 농지 일대는 제외', body: '기대감에 올랐던 땅값이 제자리로 돌아갑니다.',
    rumor: '외곽 농지가 신도시 후보지로 찍혔다는 말이 있어.', bust: true,
    fx: [['pre', 'L1', 7], ['prop', 'L1', -15, 1]] },
  { key: 'river', tag: '입지', title: '강변 수변공원·보행교 조성 사업 착공', body: '강변 조망과 산책로의 가치가 가격에 반영됩니다.',
    rumor: '강변에 큰 공원이랑 보행교가 생긴대.',
    fx: [['prop', 'A2', 9, 2], ['prop', 'L3', 16, 2], ['loc', 'A2', 'amenity', 2], ['loc', 'L3', 'amenity', 2]] },
  { key: 'foreign', tag: '자본', title: '외국계 리츠, 청운 오피스 매입 경쟁', body: '해외 자금이 몰리면서 오피스 매매가가 오릅니다.',
    rumor: '외국계 펀드가 시내 빌딩을 쓸어 담으려 한대.',
    fx: [['typ', 'policy', 'office', 1.3, 3]] },
  { key: 'landfill', tag: '입지', title: '산단 인접 부지 옆에 폐기물 처리시설 입지 선정', body: '기피 시설이 들어서면서 주변 땅값이 떨어집니다.',
    rumor: '산단 옆 부지 근처에 기피 시설이 들어온다는 소문이야.',
    fx: [['prop', 'L4', -16, 1], ['loc', 'L4', 'amenity', -3]] },
  { key: 'convention', tag: '산업', title: '도심 컨벤션센터·호텔 복합개발 확정', body: '국제회의와 관광 수요가 도심 오피스 임대료를 끌어올립니다.',
    rumor: '시청 앞에 컨벤션센터가 들어선다는 얘기가 있어.',
    fx: [['prop', 'O1', 7, 2], ['prop', 'O2', 6, 2], ['loc', 'O1', 'jobs', 1], ['loc', 'O2', 'amenity', 2]] },
  { key: 'univ', tag: '산업', title: '청운대학교 산학융합캠퍼스, 테크밸리에 조성', body: '연구소와 스타트업이 모여들면서 테크밸리 일대 임차 수요가 늘어납니다.',
    rumor: '청운대가 테크밸리에 산학 캠퍼스를 짓는다더라고.',
    fx: [['prop', 'O3', 9, 2], ['prop', 'F3', 5, 2], ['loc', 'O3', 'jobs', 1], ['loc', 'O3', 'school', 2]] },
  { key: 'jeonse', tag: '수급', title: '전세 사기 여파로 전세 기피, 월세 선호 확산', body: '전세 보증금 시세가 내려가 갭투자자의 자금 부담이 커집니다.',
    fx: [['jr', -.07, 6], ['typ', 'policy', 'apt', -.5, 2]] }
];
const SRC_STRONG = ['시청 도시계획과 다니는 조카가 그러는데,', '설계사무소 소장님이 도면을 직접 봤다는데,', '구의원 사모님한테 직접 들었는데,'];
const SRC_WEAK = ['유튜브 부동산 채널에서 그러던데,', '단톡방에 찌라시가 돌던데,', '미용실에서 누가 그러던데,'];
const JACK_TYPES = ['lotto', 'ticket', 'auction', 'scam', 'npl', 'hotel', 'bridge', 'fire', 'lotto'];

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function gauss(R) { let u = 0; while (u === 0) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()); }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function shuffle(a, R) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function genWorld(seed, init) {
  const R = mulberry32(seed), N = () => gauss(R), Q = 40, n = Q + 1;
  const Z = () => new Array(n).fill(0);
  const put = (arr, t, v) => { if (t >= 0 && t < n) arr[t] += v; };
  const W = { Q, seed, init };
  const r = Z(), fx = Z(), us = Z(), g = Z(), pi = Z(), sent = Z();
  r[0] = init.rate; fx[0] = init.fx; us[0] = init.us; g[0] = 3.0; pi[0] = 2.9; sent[0] = .35;

  const qc = 15 + Math.floor(R() * 12);
  const period = 22 + R() * 10, phase = R() * 6.2832, amp = 1.4 + R() * .8;
  const sg = Z(), sfx = Z(), ssent = Z(), emerg = Z();
  put(sg, qc, -2.5); put(sg, qc + 1, -1.5); put(sg, qc + 3, 1.3); put(sg, qc + 4, 1.3);
  put(sfx, qc, 9); put(sfx, qc + 1, 4); put(sfx, qc + 3, -4); put(sfx, qc + 4, -3);
  put(ssent, qc, -.9); put(ssent, qc + 1, -.3); put(ssent, qc + 3, .25); put(ssent, qc + 4, .25); put(ssent, qc + 5, .2);
  put(emerg, qc + 1, -.5); put(emerg, qc + 2, -.25);

  const direct = {}, policy = {}, supply = {}, vacAdj = {};
  TYPES.forEach(k => { direct[k] = Z(); policy[k] = Z(); supply[k] = Z(); vacAdj[k] = Z(); });
  put(direct.land, qc, -6); put(direct.land, qc + 1, -4);
  put(direct.apt, qc, -4); put(direct.apt, qc + 1, -3);
  put(direct.office, qc, -4); put(direct.office, qc + 1, -3);
  put(direct.factory, qc, -3); put(direct.factory, qc + 1, -2);

  const propEvt = {}; PROPS.forEach(p => propEvt[p.id] = Z());
  const stance = new Array(n).fill(0), poll = new Array(n).fill(null), elect = [];
  const costShock = Z(), jrAdj = Z(), pfAdj = Z(), pfFreeze = new Array(n).fill(false);
  const news = []; for (let i = 0; i < n; i++) news.push([]);
  const rumor = new Array(n).fill(null), notice = new Array(n).fill(null);
  const locEv = [], devUnlock = {}, sched = [];

  /* --- 지역·정책 뉴스 일정 --- */
  const byKey = {}; NEWS.forEach(e => byKey[e.key] = e);
  const forced = [R() < .5 ? 'newtown' : 'newtownFail', R() < .6 ? 'redev' : 'redevFail'];
  const rest = shuffle(NEWS.map(e => e.key).filter(k => !/newtown|redev/.test(k)), R);
  const chosen = shuffle(forced.concat(rest.slice(0, 8)), R);
  const unused = rest.slice(8);
  let prev = 1;
  chosen.forEach((key, i) => {
    let q = Math.round(3 + i * 3.4) + Math.floor(R() * 3) - 1;
    q = clamp(Math.max(q, prev + 1), 2, Q - 2); prev = q;
    sched.push({ q, key });
    const ev = byKey[key];
    for (const f of ev.fx) {
      if (f[0] === 'prop') for (let u = 0; u < f[3]; u++) put(propEvt[f[1]], q + u, f[2] / f[3]);
      else if (f[0] === 'pre') put(propEvt[f[1]], q - 1, f[2]);
      else if (f[0] === 'typ') { const B = f[1] === 'supply' ? supply : policy; for (let u = 0; u < f[4]; u++) put(B[f[2]], q + u, f[1] === 'supply' ? f[3] : f[3]); }
      else if (f[0] === 'loc') locEv.push({ q, id: f[1], key: f[2], d: f[3] });
      else if (f[0] === 'cost') put(costShock, q, f[1]);
      else if (f[0] === 'jr') for (let u = 0; u < f[2]; u++) put(jrAdj, q + u, f[1]);
      else if (f[0] === 'vac') for (let u = 0; u < f[3]; u++) put(vacAdj[f[1]], q + u, f[2]);
      else if (f[0] === 'unlock') devUnlock[f[1]] = q;
    }
    news[q].push({ title: ev.title, body: ev.body, kind: ev.tag });
    if (ev.rumor) {
      const strong = ev.bust ? R() < .3 : R() < .7;
      const src = (strong ? SRC_STRONG : SRC_WEAK)[Math.floor(R() * 3)];
      for (const t of [q - 2, q - 1]) if (t >= 0 && !rumor[t]) rumor[t] = { text: ev.rumor, src, real: !ev.bust };
    }
  });
  const fakes = unused.map(k => byKey[k]).filter(e => e.rumor);
  for (let t = 1; t < Q - 2; t++) {
    if (!rumor[t] && fakes.length && R() < .28) {
      const e = fakes[Math.floor(R() * fakes.length)];
      const src = (R() < .3 ? SRC_STRONG : SRC_WEAK)[Math.floor(R() * 3)];
      rumor[t] = { text: e.rumor, src, real: false };
    }
  }

  /* --- 거시 경로와 유형별 가격지수 --- */
  const idx = {}, fac = {}, rent = {}, occ = {}, prevTot = {};
  TYPES.forEach(k => { idx[k] = Z(); idx[k][0] = 1; fac[k] = new Array(n).fill(null); rent[k] = Z(); rent[k][0] = 1; occ[k] = Z(); prevTot[k] = 0; });
  const RG = { land: 0, apt: .3, office: .8, factory: .8 };
  const occOf = (k, t) => k === 'land' ? 0 : k === 'apt' ? .97
    : k === 'office' ? clamp(.93 + .025 * (g[t] - 2.5) - vacAdj.office[t], .6, .98)
    : clamp(.94 + .02 * (g[t] - 2.5) + .2 * (fx[t] / init.fx - 1) - vacAdj.factory[t], .6, .99);
  TYPES.forEach(k => occ[k][0] = occOf(k, 0));
  const cost = Z(); cost[0] = 1;
  const jr = Z(); jr[0] = clamp(.62 - .05 * (r[0] - 3), .42, .75);
  const price = {}; PROPS.forEach(p => { price[p.id] = Z(); price[p.id][0] = p.p0; });

  for (let t = 1; t <= Q; t++) {
    const gT = 2.5 + amp * Math.sin(6.2832 * t / period + phase);
    g[t] = clamp(g[t - 1] + .35 * (gT - g[t - 1]) + .3 * N() + sg[t], -4, 7);
    const fxPrev = t > 1 ? (fx[t - 1] / fx[t - 2] - 1) * 100 : 0;
    pi[t] = clamp(pi[t - 1] + .25 * (2.3 + .5 * (g[t - 1] - 2.5) - pi[t - 1]) + .03 * fxPrev + .15 * N(), -.5, 8);
    const target = 2.5 + 1.3 * (pi[t] - 2) + .5 * (g[t] - 2.5);
    const d = target - r[t - 1];
    let step = d > .3 ? (d > 1.2 ? .5 : .25) : d < -.3 ? (d < -1.2 ? -.5 : -.25) : 0;
    step += emerg[t];
    r[t] = clamp(r[t - 1] + step, 1, 7);
    const uT = 3.25 + .8 * Math.sin(6.2832 * t / period + phase + .6), dU = uT - us[t - 1];
    us[t] = clamp(us[t - 1] + (dU > .3 ? .25 : dU < -.3 ? -.25 : 0) + (t === qc + 1 ? -.5 : 0), .25, 7);
    const dd = (r[t] - us[t]) - (r[t - 1] - us[t - 1]);
    const fxPct = clamp(-2.2 * dd + 2.2 * N() + 5 * (init.fx - fx[t - 1]) / init.fx + sfx[t], -9, 14);
    fx[t] = clamp(fx[t - 1] * (1 + fxPct / 100), 900, 2000);
    sent[t] = clamp(.7 * sent[t - 1] + .13 * (g[t] - 2.5) - .35 * (r[t] - r[t - 1]) + .05 * clamp(prevTot.apt, -5, 5) + .04 + .12 * N() + ssent[t], -1, 1);
    cost[t] = cost[t - 1] * (1 + (pi[t] / 4 + .1 * fxPct + costShock[t]) / 100);
    jr[t] = clamp(.62 - .05 * (r[t] - 3) + jrAdj[t] + (POL[stance[t]].rentCap ? .02 : 0), .42, .75);
    pfFreeze[t] = t >= qc && t <= qc + 3;
    pfAdj[t] = t >= qc && t <= qc + 3 ? 4 : t > qc + 3 && t <= qc + 6 ? 2 : 0;

    for (const k of TYPES) {
      const f = {
        rate: -COEF.BR[k] * (r[t] - r[t - 1]) - COEF.LAM[k] * (r[t] - 3.0),
        growth: COEF.BG[k] * (g[t] - 2.5),
        fx: COEF.BFX[k] * fxPct,
        infl: .3 * pi[t],
        supply: -supply[k][t],
        policy: policy[k][t],
        sent: COEF.GAM[k] * sent[t] + COEF.MOM[k] * clamp(prevTot[k], -6, 6),
        credit: direct[k][t],
        noise: COEF.SIG[k] * N()
      };
      f.tot = f.rate + f.growth + f.fx + f.infl + f.supply + f.policy + f.sent + f.credit + f.noise;
      fac[k][t] = f; prevTot[k] = f.tot - f.noise;
      idx[k][t] = idx[k][t - 1] * (1 + f.tot / 100);
      rent[k][t] = rent[k][t - 1] * (1 + (pi[t] / 4 + RG[k] * (g[t] - 2.5) / 4) / 100 * (k === 'apt' && POL[stance[t]].rentCap ? .5 : 1));
      occ[k][t] = occOf(k, t);
      if (k !== 'land' && t >= 4 && t + 8 < n && idx[k][t] / idx[k][t - 4] > 1.14 && supply[k][t + 8] < .5) {
        for (let u = 8; u < 12; u++) put(supply[k], t + u, .7);
        news[t + 8].push({ title: TKO[k] + ' 신규 공급 급증', body: '2년 전 호황기에 착공한 물량이 한꺼번에 준공되면서 가격을 누릅니다.', kind: '수급' });
      }
    }
    for (const p of PROPS) {
      const ch = fac[p.type][t].tot + propEvt[p.id][t] + COEF.IDIO[p.type] * N();
      price[p.id][t] = Math.max(p.p0 * .2, price[p.id][t - 1] * (1 + ch / 100));
    }
    /* 선거: 집값이 급등한 뒤에는 규제 강화 공약이, 침체기에는 완화·부양 공약이 유리해진다 */
    for (const e of ELECT) {
      if (t < e.q - 2 || t > e.q) continue;
      const boom = idx.apt[t] / idx.apt[Math.max(0, t - 8)] - 1;
      const pDev = clamp(.5 - 1.5 * (boom - .1) + .08 * (2.5 - g[t]), .15, .85);
      if (t < e.q) { poll[t] = { name: e.name, dev: clamp(Math.round((pDev + .07 * N()) * 100), 5, 95), left: e.q - t }; notice[t] = e.name + ' ' + (e.q - t) + '분기 전'; continue; }
      const devWin = R() < pDev, cur = stance[t]; let nw;
      if (e.type === 'pres') nw = devWin ? Math.max(1, cur) : Math.min(-1, cur);
      else { const sg = cur === 0 ? (devWin ? 1 : -1) : Math.sign(cur), govWin = cur === 0 || devWin === (cur > 0); nw = clamp(govWin ? cur + sg : cur - sg, -2, 2); }
      for (let u = t + 1; u < n; u++) stance[u] = nw;
      const dl = nw - cur;
      for (let u = 1; u <= 4; u++) { put(policy.apt, t + u, .9 * dl); put(policy.land, t + u, 1.0 * dl); put(policy.office, t + u, .2 * dl); }
      put(ssent, t + 1, .15 * dl); put(propEvt.A4, t + 1, 3 * dl);
      if (dl > 0) for (let u = 9; u <= 12; u++) put(supply.apt, t + u, .35 * dl);
      elect.push({ q: t, type: e.type, name: e.name, devWin, from: cur, to: nw });
      news[t].unshift({ title: `${e.name}: ${PARTY[devWin ? 'dev' : 'reg']} ${e.type === 'pres' ? '후보 당선' : '승리'}`, body: PLEDGE[devWin ? 'dev' : 'reg'] + (dl === 0 ? ` 정부 기조는 「${POL[cur].name}」 그대로입니다.` : ` 다음 분기부터 정부 기조가 「${POL[cur].name}」에서 「${POL[nw].name}」(으)로 바뀝니다.`), kind: '선거' });
    }
    /* 거시 뉴스 */
    const dr = r[t] - r[t - 1];
    if (Math.abs(dr) > .01) news[t].unshift({ title: `한국은행, 기준금리 ${dr > 0 ? '인상' : '인하'} (${r[t - 1].toFixed(2)}% → ${r[t].toFixed(2)}%)`, body: dr > 0 ? '대출 이자가 오르고, 자산 가격에는 내리누르는 힘이 생깁니다.' : '대출 이자가 내려가고, 자산 가격에는 떠받치는 힘이 생깁니다.', kind: '금리' });
    if (Math.abs(fxPct) >= 4) news[t].push({ title: `원/달러 환율 ${fxPct > 0 ? '급등' : '급락'}, ${Math.round(fx[t]).toLocaleString('en-US')}원`, body: fxPct > 0 ? '수출 제조업에는 호재, 수입 원자재와 공사비에는 부담입니다.' : '수입 물가가 안정되고, 수출 공장의 채산성은 나빠집니다.', kind: '환율' });
    if (g[t] < 1 && g[t - 1] >= 1) news[t].push({ title: '성장률 0%대로 추락, 경기 침체 진입', body: '오피스와 공장의 공실이 늘어납니다.', kind: '경기' });
    if (g[t] > 4 && g[t - 1] <= 4) news[t].push({ title: '성장률 4% 돌파, 경기 과열 논란', body: '임대 수요가 늘지만 금리 인상 압력도 커집니다.', kind: '경기' });
  }
  if (qc - 2 >= 1) news[qc - 2].push({ title: '장단기 금리 역전 심화, 경기 침체 경고음', body: '과거 위기 직전에 자주 나타났던 신호입니다. 빚이 많다면 점검할 때입니다.', kind: '경고' });
  if (qc - 1 >= 1) news[qc - 1].push({ title: '중소 건설사 연쇄 부도설, PF 연체율 급등', body: '금융권이 부동산 대출 창구를 조이기 시작했습니다.', kind: '경고' });
  news[qc].unshift({ title: '글로벌 신용경색 발생, 금융시장 패닉', body: '자산 가격이 급락하고 PF 신규 대출이 전면 중단됩니다. 급매가 아니면 팔리지 않습니다.', kind: '위기' });
  if (qc + 4 <= Q) news[qc + 4].push({ title: 'PF 시장 정상화, 신규 대출 재개', body: '위기 때 현금을 지킨 투자자에게 기회가 열립니다.', kind: '금융' });

  /* 한탕 이벤트 일정 */
  const jack = new Array(n).fill(null);
  const jt = shuffle(JACK_TYPES.slice(), R);
  [2, 6, 10, 14, 18, 22, 27, 31, 35].forEach((b, i) => { const q = clamp(b + Math.floor(R() * 3) - 1, 1, Q - 3); if (!jack[q]) jack[q] = jt[i]; });
  const jackProp = shuffle(PROPS.filter(p => p.type !== 'land').map(p => p.id), R);

  /* 메자닌 상품 (4분기마다 교체) */
  const MZ = [['apt', '주상복합 분양 사업'], ['office', '도심 오피스 개발'], ['factory', '물류센터 개발'], ['apt', '재개발 정비사업'], ['factory', '지식산업센터 개발']];
  const mezz = [];
  for (let b = 0; b < 10; b++) {
    const a = shuffle(MZ.slice(), R).slice(0, 2);
    mezz.push(a.map((m, i) => ({ k: m[0], name: m[1] + ' ' + (b + 1) + '-' + (i + 1) + '호', yield: Math.round((10 + R() * 7) * 2) / 2, term: 4 + Math.floor(R() * 3) })));
  }
  const ltvApt = stance.map(s => POL[s].ltv);
  return Object.assign(W, { r, fx, us, g, pi, sent, idx, fac, rent, occ, cost, jr, price, propEvt, ltvApt, stance, poll, elect, pfAdj, pfFreeze, news, rumor, notice, locEv, devUnlock, sched, jack, jackProp, mezz, qc });
}

if (typeof module !== 'undefined') module.exports = { genWorld, PROPS, TYPES, REAL, POL, ELECT, hashStr, mulberry32 };
