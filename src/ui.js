'use strict';
/* ===== 화면: 알림, 팝업, 거래 창, 사이드 패널, 결산 ===== */
function toast(msg, kind) {
  const box = $('toasts'), t = document.createElement('div');
  t.className = 'toast ' + (kind || ''); t.textContent = msg; box.appendChild(t);
  while (box.children.length > 2) box.firstChild.remove();
  setTimeout(() => t.remove(), 4000);
}
let newsTimer = 0;
function showNews(list) {
  const n = list[0], b = $('newsbar');
  b.innerHTML = `<span class="tag">${esc(n.kind)}</span><b>${esc(n.title)}</b><span>${esc(n.body)}</span>` + (list.length > 1 ? `<em>외 ${list.length - 1}건 · 뉴스 탭</em>` : '');
  b.hidden = false; clearTimeout(newsTimer); newsTimer = setTimeout(() => { b.hidden = true; }, 9000);
}
function spark(arr, w, h, color) {
  if (arr.length < 2) return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"></svg>`;
  const mn = Math.min(...arr), mx = Math.max(...arr), sp = (mx - mn) || 1;
  const X = i => 2 + i * (w - 6) / (arr.length - 1), Y = v => h - 3 - (v - mn) / sp * (h - 6);
  const pts = arr.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ');
  const c = color || (arr[arr.length - 1] >= arr[0] ? 'var(--up)' : 'var(--down)');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${c}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="${X(arr.length - 1).toFixed(1)}" cy="${Y(arr[arr.length - 1]).toFixed(1)}" r="2.4" fill="${c}"/></svg>`;
}

/* ----- 시계를 멈추는 팝업 ----- */
function pushPopup(p) { popQ.push(p); if (!popup) nextPopup(); }
function nextPopup() {
  popup = popQ.shift() || null; const el = $('pop');
  if (!popup) { el.hidden = true; el.innerHTML = ''; return; }
  popup.left = popup.total = popup.timer || 0;
  el.innerHTML = `<div class="rpg popcard ${popup.kind || ''}" role="dialog" aria-label="${esc(popup.title)}"><h2>${esc(popup.title)}</h2><div class="pbody">${popup.body}</div><div class="choices">${popup.choices.map((c, i) => `<button type="button" class="btn ${i === 0 ? 'primary' : ''}" data-a="choice" data-v="${i}" ${c.dis ? 'disabled' : ''}><b>${popup.choices.length > 1 ? (i + 1) + '. ' : ''}${esc(c.label)}</b>${c.sub ? `<small>${esc(c.sub)}${c.dis ? ' · 현금 부족' : ''}</small>` : ''}</button>`).join('')}</div>${popup.total ? '<div class="cd" aria-hidden="true"><i id="cdfill"></i></div>' : ''}</div>`;
  el.hidden = false;
}
function choose(i) {
  const p = popup; if (!p) return; const c = p.choices[i]; if (!c || c.dis) return;
  popup = null; $('pop').hidden = true;
  if (c.fn) c.fn();
  if (!popup) nextPopup();
}

/* ----- 거래 창 ----- */
function openView(v) { view = v; renderView(); }
function closeView() { view = null; $('win').hidden = true; $('stage').classList.remove('has-win'); }
function renderView() {
  const el = $('win'); if (!view) { el.hidden = true; return; }
  const old = el.querySelector('.wbody'), st = old ? old.scrollTop : 0;
  const [title, html] = VIEWS[view.t](view);
  el.innerHTML = `<header><h2>${title}</h2><button type="button" class="x" data-a="close">닫기 (Esc)</button></header><div class="wbody">${html}</div>`;
  el.hidden = false; el.querySelector('.wbody').scrollTop = st; $('stage').classList.add('has-win');
}
function facRows(id) {
  const p = PBY[id], q = S.q;
  if (q === 0) return '<p class="muted">한 분기가 지나면 가격 변동이 요인별로 분해되어 나타납니다.</p>';
  const f = W.fac[p.type][q], ch = (price(id) / price(id, q - 1) - 1) * 100;
  const rows = [['금리', f.rate], ['경기', f.growth], ['환율', f.fx], ['물가', f.infl], ['수급', f.supply], ['정책', f.policy], ['심리·추세', f.sent]];
  if (Math.abs(f.credit) > .01) rows.push(['신용경색', f.credit]);
  const ev = W.propEvt[id][q]; if (Math.abs(ev) > .01) rows.push(['개별 호재·악재', ev]);
  rows.push(['그 밖의 요인', ch - rows.reduce((a, r) => a + r[1], 0)]);
  return rows.map(([n, v]) => `<div class="fr"><span>${n}</span><div class="fb"><i class="${cls(v)}" style="width:${Math.min(50, Math.abs(v) * 9).toFixed(1)}%;${v >= 0 ? 'left:50%' : 'right:50%'}"></i></div><b class="${cls(v)}">${pct(v)}</b></div>`).join('') + `<div class="fr tot"><span>합계</span><div></div><b class="${cls(ch)}">${pct(ch)}</b></div>`;
}
function projRow(pr) {
  const d = DEV[pr.typ];
  return `<div class="card"><b>${esc(PBY[pr.id].name)} · ${d.name} (${PLV[pr.pli].label})</b><div class="lr"><span>공정</span><div class="lb"><i style="width:${pr.el / pr.dur * 100}%"></i></div><b>${pr.el}/${pr.dur}</b></div><div class="lr"><span>분양률</span><div class="lb"><i class="gold" style="width:${pr.sold * 100}%"></i></div><b>${(pr.sold * 100).toFixed(0)}%</b></div><p class="muted">PF 잔액 ${won(pr.loan)} (연 ${pfRate().toFixed(2)}%) · 분양 확정 수입 ${won(pr.rev)} · 준공 때 일괄 정산</p></div>`;
}
const VIEWS = {
  prop(v) {
    const id = v.id, p = PBY[id], o = S.own[id], q = S.q, pr = price(id);
    if (S.gone[id]) return [esc(p.name), `<p>이 부지는 ${DEV[S.gone[id]].name} 사업으로 분양을 마쳤습니다. 더는 거래할 수 없습니다.</p>`];
    const ch1 = q > 0 ? (pr / price(id, q - 1) - 1) * 100 : 0, ch4 = q >= 4 ? (pr / price(id, q - 4) - 1) * 100 : null;
    const loc = locNow(id), rentY = rentQ(id) * 4, dt = p.type === 'land' ? devTypes(id) : [];
    let h = `<div class="phead"><div><span class="badge t-${p.type}">${TKO[p.type]}</span>${o ? '<span class="badge own">보유 중</span>' : ''}${o && o.live ? '<span class="badge">실거주</span>' : ''}<div class="pprice"><b>${won(pr)}</b><span class="${cls(ch1)}">전분기 ${pct(ch1)}</span>${ch4 != null ? `<span class="${cls(ch4)}">1년 ${pct(ch4)}</span>` : ''}</div></div>${spark(W.price[id].slice(0, q + 1), 160, 44)}</div>`;
    h += `<div class="cols"><div><h3>입지</h3>${Object.keys(LOCKO).map(k => `<div class="lr"><span>${LOCKO[k]}</span><div class="lb"><i style="width:${loc[k] * 10}%"></i></div><b>${loc[k]}</b></div>`).join('')}${p.type === 'land' ? `<p class="muted">용도지역: ${p.zone}<br>${dt.length ? '개발 가능: ' + dt.map(t => DEV[t].name).join(', ') : '지금은 개발할 수 없습니다'}</p>` : `<p class="muted">연 임대수익 ${won(rentY)} (수익률 ${(rentY / pr * 100).toFixed(1)}%)<br>임대율 ${(W.occ[p.type][q] * 100).toFixed(0)}%</p>`}</div><div><h3>이번 분기 가격을 움직인 힘</h3>${facRows(id)}</div></div>`;
    h += o ? ownPanel(v) : buyPanel(v);
    return [esc(p.name), h];
  },
  bank() {
    const q = S.q, cr = W.r[q] + CREDIT_SPREAD, fxn = W.fx[q], uv = usdVal();
    let h = `<p class="say">「청운은행입니다. 기준금리는 연 ${W.r[q].toFixed(2)}%, 통장에 둔 현금에는 연 ${depRate().toFixed(2)}% 이자가 매 분기 붙습니다.」</p>`;
    h += `<h3>신용대출 <small>연 ${cr.toFixed(2)}% · 한도 ${won(CREDIT_MAX)}</small></h3><table class="tb"><tr><td>잔액</td><td>${won(S.credit)}</td></tr></table><div class="acts"><button type="button" class="btn" data-a="credit" data-v="0.5">5,000만 빌린다</button><button type="button" class="btn" data-a="credit" data-v="-0.5">5,000만 갚는다</button><button type="button" class="btn" data-a="credit" data-v="-9">모두 갚는다</button></div>`;
    if (S.emerg > 0) h += `<h3>긴급 대출 <small>연 ${EMERG_RATE}%</small></h3><table class="tb"><tr><td>잔액</td><td class="down">${won(S.emerg)}</td></tr></table><div class="acts"><button type="button" class="btn" data-a="emerg">가진 현금으로 갚는다</button></div>`;
    h += `<h3>달러 예금 <small>현재 1달러 = ${fxn.toFixed(1)}원 · 환전 수수료 0.5%</small></h3><table class="tb"><tr><td>보유</td><td>$${Math.round(S.usd).toLocaleString('en-US')}</td></tr><tr><td>원화 평가액</td><td>${won(uv)}</td></tr><tr><td>평가손익</td><td class="${cls(uv - S.usdCost)}">${sgn(uv - S.usdCost)}</td></tr></table><div class="acts"><button type="button" class="btn" data-a="usdBuy">1억어치 산다</button><button type="button" class="btn" data-a="usdSell" data-v="one">1억어치 판다</button><button type="button" class="btn" data-a="usdSell" data-v="all">모두 판다</button></div><p class="muted">위기 때 원화 값은 떨어지고 달러 값은 오르는 경향이 있습니다.</p>`;
    const loans = Object.keys(S.own).filter(id => S.own[id].kind === 'mort');
    h += '<h3>담보대출 목록</h3>' + (loans.length ? '<table class="tb">' + loans.map(id => `<tr><td>${esc(PBY[id].name)} <small>연 ${mortRate(PBY[id].type).toFixed(2)}% · LTV ${(S.own[id].loan / price(id) * 100).toFixed(0)}%</small></td><td>${won(S.own[id].loan)}</td><td><button type="button" class="btn sm" data-a="repayId" data-v="${id}">1억 상환</button></td></tr>`).join('') + '</table>' : '<p class="muted">담보대출이 없습니다. 대출은 건물 앞에서 매수할 때 함께 받습니다.</p>');
    return ['청운은행', h];
  },
  pf(v) {
    const q = S.q; let h = '<p class="say">「청운증권 PF센터입니다. 땅을 가져오시면 사업비를 대 드리고, 현금만 있으시면 남의 사업에 태워 드립니다.」</p>';
    if (W.pfFreeze[q]) h += '<p class="warn">PF 시장이 얼어붙었습니다. 신규 대출은 중단되었고, 진행 중인 사업의 금리는 4%p 뛰었습니다.</p>';
    h += '<h3>진행 중인 내 사업</h3>' + (S.projects.length ? S.projects.map(projRow).join('') : '<p class="muted">없습니다.</p>');
    const lands = Object.keys(S.own).filter(id => PBY[id].type === 'land' && !S.own[id].dev && S.own[id].kind !== 'jeonse');
    h += '<h3>내 땅 개발하기 (시행)</h3>';
    if (!lands.length) h += '<p class="muted">개발할 수 있는 보유 토지가 없습니다. 먼저 토지를 매수하세요. 토지는 강변, 역세권 예정지, 산단 옆, 외곽에 있습니다.</p>';
    else {
      if (!lands.includes(v.land)) { v.land = lands[0]; v.typ = null; }
      const types = devTypes(v.land);
      h += `<div class="segs">${lands.map(id => `<button type="button" class="seg ${id === v.land ? 'on' : ''}" data-a="pfLand" data-v="${id}">${esc(PBY[id].name)}</button>`).join('')}</div>`;
      if (!types.length) h += `<p class="muted">이 땅은 ${PBY[v.land].zone}이라 지금은 개발할 수 없습니다. 용도지역이 바뀌어야 합니다.</p>`;
      else {
        if (!types.includes(v.typ)) v.typ = types[0]; if (v.pli == null) v.pli = 1;
        const c = pfCalc(v.land, v.typ, v.pli);
        h += `<div class="segs">${types.map(t => `<button type="button" class="seg ${t === v.typ ? 'on' : ''}" data-a="pfTyp" data-v="${t}">${DEV[t].name}</button>`).join('')}</div><div class="segs">${PLV.map((p, i) => `<button type="button" class="seg ${i === v.pli ? 'on' : ''}" data-a="pfPl" data-v="${i}">${p.label}</button>`).join('')}</div>`;
        h += `<table class="tb"><caption>사업수지표 (예상)</caption><tr><td>분양·매각 수입 (예상 분양률 ${(c.soldEst * 100).toFixed(0)}%, 미분양은 20% 할인)</td><td>${won(c.rev)}</td></tr><tr><td>토지비 (현재 시세)</td><td>-${won(c.land)}</td></tr><tr><td>공사비</td><td>-${won(c.cost)}</td></tr><tr><td>금융비 (PF 연 ${c.rate.toFixed(2)}%, 공사 ${c.dur}분기)</td><td>-${won(c.fin)}</td></tr><tr class="tot"><td>예상 사업 이익</td><td class="${cls(c.profit)}">${sgn(c.profit)}</td></tr><tr><td>PF 대출 (공사비의 80%, 이자는 준공 때 일괄 상환)</td><td>${won(c.loan)}</td></tr><tr class="tot"><td>지금 낼 자기자본 (공사비의 20%)</td><td>${won(c.eq)}</td></tr></table><p class="muted">분양가는 분양 시점의 시세를 따르고, 공사비는 물가와 환율을 따라 변합니다. 예상은 지금 시장이 그대로일 때의 값입니다.</p><div class="acts"><button type="button" class="btn primary" data-a="pfGo" ${S.cash < c.eq || W.pfFreeze[q] ? 'disabled' : ''}>${W.pfFreeze[q] ? '신규 PF 중단' : S.cash < c.eq ? '자기자본 부족' : '사업을 착공한다'}</button><span class="muted">보유 현금 ${won(S.cash)}</span></div>`;
      }
    }
    const offers = W.mezz[Math.min(9, Math.floor(q / 4))];
    h += '<h3>남의 사업에 투자하기 (메자닌)</h3><table class="tb">' + offers.map((o, i) => `<tr><td>${esc(o.name)} <small>${TKO[o.k]} 시장 연동</small></td><td>연 ${o.yield.toFixed(1)}% · ${o.term}분기</td><td><button type="button" class="btn sm" data-a="mezz" data-v="${i}" ${S.cash < 1 || q + o.term > W.Q ? 'disabled' : ''}>1억 투자</button></td></tr>`).join('') + '</table><p class="muted">만기까지 해당 시장 지수가 4% 넘게 내리면 이자 없이 원금의 90%, 12% 넘게 내리면 45%만 돌려받습니다.</p>';
    if (S.mezz.length) h += '<table class="tb">' + S.mezz.map(m => `<tr><td>${esc(m.name)}</td><td>${won(m.amt)}</td><td>만기 ${qLabel(m.due)}</td></tr>`).join('') + '</table>';
    return ['청운증권 PF센터', h];
  },
  agent() {
    const q = S.q, r = W.rumor[q];
    const tips = ['금리가 오르면 이자 부담은 늘고 집값은 눌려. 빚내서 산 사람이 제일 먼저 아프지.', '환율이 오르면 수출하는 공장은 웃고, 자재를 수입하는 공사 현장은 울어.', '전세 끼고 사면 내 돈은 적게 들어. 대신 2년 뒤 전세가가 떨어지면 차액은 현금으로 돌려줘야 해.', '땅은 임대료가 안 나와. 호재 하나에 뛰지만, 안 팔리면 세금만 내는 거야.', '급할 때 팔면 제값을 못 받아. 시장 분위기가 나쁘면 급매 할인이 붙거든.', '집은 1년 안에 팔면 차익의 70%, 2년 안이면 60%가 양도세야. 지방소득세는 별도고.', '두 채째부터는 취득세가 8%, 세 채째는 12%야. 팔 때 양도세도 중과되니 주택 수를 세어 봐.', '6월 1일에 들고 있는 사람이 그해 재산세랑 종부세를 내. 팔 거면 그 전에 팔아야지.', '선거 결과에 따라 세금이랑 대출 한도가 바뀌어. 여론조사는 신문 가판대에 나와.', '오피스는 경기를 따라가. 회사들이 잘돼야 공실이 줄지.', '2년 전에 값이 많이 올랐으면 지금쯤 입주 물량이 쏟아질 때야.'];
    S.rumorQ = q;
    const h = `<div class="talk"><div class="face kim" aria-hidden="true"></div><div><p class="say">${r ? `「자기야, 이건 어디 가서 말하면 안 돼. ${esc(r.src)} ${esc(r.text)}」` : `「오늘은 들은 소문이 없네. 대신 하나 알려 줄게. ${tips[q % tips.length]}」`}</p>${r ? '<p class="muted">소문은 사실일 수도, 헛소문일 수도 있습니다. 누가 한 말인지를 따져 보세요. 사실이라면 한두 분기 안에 뉴스로 나옵니다.</p>' : ''}</div></div><div class="acts"><button type="button" class="btn" data-a="tab" data-v="market">매물 시세 보기</button></div>`;
    return ['김여사 복덕방', h];
  },
  paper() {
    const q = S.q, d = q < W.Q ? W.r[q + 1] - W.r[q] : 0, g2 = W.g[Math.min(q + 2, W.Q)] - W.g[q], si = Math.round(100 + W.sent[q] * 40);
    const h = `<div class="talk"><div class="face boy" aria-hidden="true"></div><div><p class="say">「호외요, 호외! 오늘 자 청운경제신문 전망 면입니다.」</p><ul class="list"><li>채권시장은 다음 분기 기준금리 <b>${d > 0 ? '인상' : d < 0 ? '인하' : '동결'}</b>에 무게를 싣고 있습니다.</li><li>경기선행지수는 <b>${g2 > .4 ? '오르는 중' : g2 < -.4 ? '꺾이는 중' : '제자리걸음'}</b>입니다. 반년 뒤 경기를 미리 보여 줍니다.</li><li>부동산 소비심리지수 <b>${si}</b> (100 이상이면 낙관, 115 이상이면 과열).</li><li>건설 공사비 지수 <b>${(W.cost[q] * 100).toFixed(0)}</b> (게임 시작 시점 = 100).</li>${W.poll[q] ? `<li>${W.poll[q].name} 여론조사 (${W.poll[q].left}분기 전): 성장연합 <b>${W.poll[q].dev}%</b> · 안정연대 <b>${100 - W.poll[q].dev}%</b>. 오차가 있습니다.</li>` : ''}</ul></div></div>`;
    return ['신문 가판대', h];
  },
  hall() {
    const q = S.q, P = pol(), nt = W.notice[q], nx = ELECT.find(e => e.q >= q), row = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
    let h = `<p class="say">「청운시청 세무민원실입니다. 청운시는 조정대상지역이고, 지금 정부의 부동산 정책 기조는 <b>${P.name}</b>입니다.」</p>`;
    h += '<h3>살 때</h3><table class="tb wrap">' + row('주택 취득세', '6억 이하 1% · 6~9억 1~3% · 9억 초과 3%<br>+ 지방교육세 0.1~0.3%') + row('다주택 취득세 중과', (P.acq[0] ? `2주택 ${P.acq[0]}%` : '2주택 일반세율') + ` · 3주택 이상 ${P.acq[1]}%<br>+ 지방교육세 0.4%`) + row('토지·오피스·공장', '4.6% (취득세 4 + 지방교육세 0.4 + 농특세 0.2)<br>농지는 3.4%') + row('등록세', '2011년 취득세에 통합되어 따로 없음.<br>대출 시 근저당 설정 등록면허세: 채권최고액(대출의 120%) × 0.24%') + row('아파트 담보대출 한도', 'LTV ' + P.ltv * 100 + '%') + '</table>';
    h += '<h3>팔 때 (양도소득세)</h3><table class="tb wrap">' + row('2년 미만 보유', '주택 1년 미만 70% · 2년 미만 60%<br>토지·건물 1년 미만 50% · 2년 미만 40%') + row('2년 이상 보유', '기본세율 6~45% (누진) + 지방소득세 10%') + row('조정대상지역 다주택 중과', P.sur[0] ? `2주택 +${P.sur[0]}%p · 3주택 이상 +${P.sur[1]}%p<br>장기보유특별공제 배제` : '중과 배제 (기본세율)') + row('비사업용 토지', P.landSur ? `기본세율 +${P.landSur}%p` : '가산 없음') + row('장기보유특별공제', '3년부터 연 2%, 최대 30%') + row('1세대 1주택', '2년 보유·거주 시 양도가 12억까지 비과세<br>초과분은 보유·거주 각 연 4% 공제') + row('기본공제', '연 250만') + '</table>';
    h += '<h3>들고 있을 때 (보유세)</h3><table class="tb wrap">' + row('과세기준일', '매년 6월 1일 보유자<br>재산세 3분기, 종부세 4분기 납부') + row('공시가격', '주택은 시세의 69%, 토지·건물은 65%로 가정') + row('재산세', '주택 0.1~0.4% (공시가격 × 60%)<br>토지 0.2~0.5% · 건물 0.25% (× 70%)') + row('종부세 (주택)', `(공시가격 합계 - ${P.ded}억) × ${P.fmv * 100}%<br>1세대 1주택은 ${P.ded1}억 공제<br>세율 0.5~2.7%, 3주택 이상 최고 5.0%`) + row('종부세 (토지)', '나대지: 5억 공제 후 1~3%<br>건물 부속토지: 80억 공제 후 0.5~0.7%') + (P.devCharge ? row('개발부담금', `개발 사업 이익의 ${P.devCharge}%`) : '') + (P.rentCap ? row('전월세 상한제', '아파트 임대료 인상 폭 제한') : '') + '</table>';
    h += '<h3>선거 일정</h3>' + (nx ? `<p class="${nt ? 'warn' : 'muted'}">다음 선거: ${nx.name} (${qLabel(nx.q)}). 결과에 따라 다음 분기부터 세율과 대출 한도가 바뀔 수 있습니다.</p>` : '<p class="muted">남은 선거가 없습니다.</p>');
    h += '<h3>토지 용도지역</h3><table class="tb">' + PROPS.filter(p => p.type === 'land').map(p => `<tr><td>${esc(p.name)}</td><td>${p.zone}</td><td>${S.gone[p.id] ? '개발 완료' : devTypes(p.id).length ? devTypes(p.id).map(t => DEV[t].name).join(', ') : '개발 불가'}</td></tr>`).join('') + '</table>';
    h += '<p class="muted">현행 유지 기조의 세율은 2026년 11월 세법 기준입니다. 국회에서 심의 중인 2026년 세제개편안은 반영하지 않았고, 세액은 거래 건별로 계산하며 일시적 2주택 같은 특례는 생략했습니다. 정당과 정책 기조는 가상입니다.</p>';
    return ['청운시청', h];
  },
  station() { return ['청운역 공사장', '<p class="say">「공사 관계자 외 출입 금지」 팻말이 붙어 있습니다. 급행철도가 정말 들어올지는 뉴스를 지켜봐야 합니다.</p>']; }
};
function buyPanel(v) {
  const id = v.id, p = PBY[id], lm = ltvMax(p.type), apt = p.type === 'apt';
  const fr = [0, .2, .4, lm].filter((x, i, a) => x <= lm + 1e-9 && a.indexOf(x) === i);
  if (v.mode == null) { v.mode = 'mort'; v.frac = fr.includes(.4) ? .4 : lm; }
  if (v.mode === 'mort' && v.frac > lm) v.frac = lm;
  if (v.mode === 'jeonse' || liveHome()) v.live = false;
  const c = buyCalc(id, v.mode, v.frac, null, v.live), flow = c.rent - c.intQ, hx = holdExtra(id), n = houseCount() + 1;
  const opts = fr.map(x => `<button type="button" class="seg ${v.mode === 'mort' && Math.abs(v.frac - x) < 1e-9 ? 'on' : ''}" data-a="fin" data-v="${x}">${x === 0 ? '전액 현금' : '대출 ' + (x * 100).toFixed(0) + '%' + (x === lm ? ' (한도)' : '')}</button>`).join('') + (apt ? `<button type="button" class="seg ${v.mode === 'jeonse' ? 'on' : ''}" data-a="fin" data-v="jeonse">전세 끼고 매수</button>` : '');
  const liveRow = apt ? `<div class="segs"><button type="button" class="seg ${!v.live ? 'on' : ''}" data-a="liveSel" data-v="0">임대 놓기</button><button type="button" class="seg ${v.live ? 'on' : ''}" data-a="liveSel" data-v="1" ${v.mode === 'jeonse' || liveHome() ? 'disabled' : ''}>실거주 (전입)</button></div>` : '';
  let note = '';
  if (v.mode === 'jeonse') note += '<p class="muted">전세를 끼면 임대수익도 이자도 없습니다. 2년(8분기)마다 재계약하며, 전세 시세가 내리면 차액을 현금으로 돌려줘야 합니다.</p>';
  if (v.live) note += '<p class="muted">실거주하면 임대수익은 없지만 주거비(분기 500만)가 들지 않습니다. 이 집 한 채만 가진 채 2년 보유·거주하면 양도가 12억까지 양도소득세가 비과세입니다.</p>';
  if (apt && n >= 2 && c.a.rate >= 8) note += `<p class="warn">이 집을 사면 ${n}주택이 됩니다. 조정대상지역 다주택 취득세 중과(${c.a.rate}%)가 적용되고, 팔 때 양도세 중과와 종부세 부담도 커집니다.</p>`;
  return `<h3>매수</h3><div class="segs">${opts}</div>${liveRow}<table class="tb"><tr><td>매매가</td><td>${won(c.pr)}</td></tr><tr><td>${c.a.label}</td><td>${won(c.a.main)}</td></tr><tr><td>지방교육세${c.a.rural ? '·농어촌특별세' : ''} (${(c.a.edu + c.a.rural).toFixed(2)}%)</td><td>${won(c.a.sur)}</td></tr><tr><td>중개보수 (${c.a.br}%)</td><td>${won(c.a.broker)}</td></tr>${c.reg ? `<tr><td>근저당 설정 등록면허세 (채권최고액의 0.24%)</td><td>${won(c.reg)}</td></tr>` : ''}<tr><td>${v.mode === 'jeonse' ? `전세 보증금 승계 (전세가율 ${(W.jr[S.q] * 100).toFixed(0)}%)` : `담보대출 (연 ${c.rate.toFixed(2)}%, 변동금리)`}</td><td>-${won(c.loan)}</td></tr><tr class="tot"><td>필요한 내 돈</td><td>${won(c.need)}</td></tr><tr><td>분기 현금흐름 (임대 - 이자)</td><td class="${cls(flow)}">${sgn(flow)}</td></tr><tr><td>늘어나는 보유세 (연간, 재산세 + 종부세)</td><td>${won(hx.prop)} + ${won(hx.jb)}</td></tr></table>${note}<div class="acts"><button type="button" class="btn primary" data-a="buy" ${c.need > S.cash ? 'disabled' : ''}>${c.need > S.cash ? '현금 부족' : '매수한다'}</button><span class="muted">보유 현금 ${won(S.cash)}</span></div>`;
}
function ownPanel(v) {
  const id = v.id, p = PBY[id], o = S.own[id], pr = price(id), pj = S.projects.find(x => x.id === id);
  let h = `<h3>내 보유 현황</h3><table class="tb"><tr><td>매입가 (${qLabel(o.buyQ)})</td><td>${won(o.buyPrice)}</td></tr><tr><td>취득가액 (취득세·중개보수 포함)</td><td>${won(o.basis)}</td></tr><tr><td>${o.kind === 'jeonse' ? '전세 보증금 (재계약까지 ' + (8 - ((S.q - o.jq) % 8)) + '분기)' : o.kind === 'mort' ? `담보대출 (연 ${mortRate(p.type).toFixed(2)}%, LTV ${(o.loan / pr * 100).toFixed(0)}%)` : '대출'}</td><td>${o.loan ? won(o.loan) : '없음'}</td></tr>${p.type === 'apt' ? `<tr><td>사용 현황</td><td>${o.kind === 'jeonse' ? '전세 임대' : o.live ? '실거주 중' : '월세 임대'} · 거주 ${o.liveQ || 0}분기</td></tr>` : ''}</table>`;
  if (pj) return h + '<h3>개발 사업 진행 중</h3>' + projRow(pj) + '<p class="muted">준공 전에는 팔 수 없습니다.</p>';
  const s = sellCalc(id), c = s.c;
  h += `<h3>지금 팔면</h3><table class="tb"><tr><td>매도가${s.disc > 0 ? ` (급매 할인 ${(s.disc * 100).toFixed(1)}%)` : ''}</td><td>${won(s.gross)}</td></tr><tr><td>중개보수 (${brokerRate(p, s.gross)}%)</td><td>-${won(s.fee)}</td></tr><tr><td>양도차익 (보유 ${c.hold}분기)</td><td class="${cls(c.gain)}">${sgn(c.gain)}</td></tr>${c.exempt > 0 ? `<tr><td>비과세 양도차익</td><td>-${won(c.exempt)}</td></tr>` : ''}${c.ltd > 0 ? `<tr><td>장기보유특별공제 (${(c.ltdRate * 100).toFixed(0)}%)</td><td>-${won(c.ltd)}</td></tr>` : ''}${c.ded > 0 ? `<tr><td>양도소득 기본공제</td><td>-${won(c.ded)}</td></tr>` : ''}<tr><td>과세표준</td><td>${won(c.base)}</td></tr><tr><td>양도소득세 (${c.label})</td><td>-${won(c.tax)}</td></tr><tr><td>지방소득세 (양도세의 10%)</td><td>-${won(c.local)}</td></tr><tr><td>${o.kind === 'jeonse' ? '전세 보증금 반환' : '대출 상환'}</td><td>-${won(s.repay)}</td></tr><tr class="tot"><td>손에 쥐는 돈</td><td>${won(s.net)}</td></tr></table>${c.notes.map(x => `<p class="muted">${x}</p>`).join('')}<div class="acts"><button type="button" class="btn primary" data-a="sell">매도한다</button>${o.kind !== 'jeonse' ? '<button type="button" class="btn" data-a="more">한도까지 추가 대출</button>' : ''}${o.kind === 'mort' ? '<button type="button" class="btn" data-a="repay" data-v="1">1억 상환</button><button type="button" class="btn" data-a="repay" data-v="99">전액 상환</button>' : ''}${p.type === 'apt' && o.kind !== 'jeonse' ? (o.live ? '<button type="button" class="btn" data-a="live" data-v="0">전출하고 임대 놓기</button>' : `<button type="button" class="btn" data-a="live" data-v="1" ${liveHome() ? 'disabled' : ''}>전입해 실거주</button>`) : ''}</div>`;
  if (p.type === 'land') h += `<p class="muted">${devTypes(id).length ? '청운증권 PF센터(도심 동쪽)에 가면 이 땅으로 개발 사업을 시작할 수 있습니다.' : '용도지역이 바뀌기 전에는 개발할 수 없습니다.'}</p>`;
  return h;
}

/* ----- 사이드 패널 ----- */
function renderPanel() {
  document.querySelectorAll('#tabs button, #mnav button[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === tab));
  const q = S.q, el = $('panel'); let h = '';
  if (tab === 'asset') {
    const A = assets(), D = debt(), f = flowNow(); let mort = 0, jeon = 0, re = '';
    for (const id in S.own) { const o = S.own[id]; if (o.kind === 'jeonse') jeon += o.loan; else mort += o.loan; re += `<tr class="sub"><td><button type="button" class="lnk" data-a="guide" data-v="${id}">${esc(PBY[id].name)}</button>${o.dev ? ' <small>개발 중</small>' : ''}</td><td>${won(price(id))}</td></tr>`; }
    const pe = S.projects.reduce((a, p) => a + p.eqPaid, 0), inv = S.mezz.reduce((a, m) => a + m.amt, 0) + S.bets.reduce((a, b) => a + b.amt, 0);
    h += `<h3>재무상태표 <small>부동산은 시세(공정가치) 평가</small></h3><table class="tb bs"><tr class="hd"><td>자산</td><td>${won(A)}</td></tr><tr><td>현금·예금 <small>연 ${depRate().toFixed(2)}%</small></td><td>${won(S.cash)}</td></tr>${S.usd > 0 ? `<tr><td>달러 예금</td><td>${won(usdVal())}</td></tr>` : ''}${re || '<tr class="sub"><td class="muted">보유 부동산 없음</td><td></td></tr>'}${pe ? `<tr><td>개발 사업 자기자본</td><td>${won(pe)}</td></tr>` : ''}${inv ? `<tr><td>메자닌·기타 투자 <small>원가</small></td><td>${won(inv)}</td></tr>` : ''}<tr class="hd"><td>부채</td><td>${won(D)}</td></tr>${mort ? `<tr><td>담보대출</td><td>${won(mort)}</td></tr>` : ''}${jeon ? `<tr><td>전세 보증금</td><td>${won(jeon)}</td></tr>` : ''}${S.credit ? `<tr><td>신용대출</td><td>${won(S.credit)}</td></tr>` : ''}${S.emerg ? `<tr><td>긴급 대출</td><td class="down">${won(S.emerg)}</td></tr>` : ''}${S.due.map(d => `<tr><td>미지급 세금 <small>${esc(d.name)} · ${qLabel(d.q)} 납부</small></td><td>${won(d.amt)}</td></tr>`).join('')}<tr class="hd eq"><td>순자산 (자본)</td><td>${won(A - D)}</td></tr></table>`;
    h += `<h3>이번 분기 예상 손익</h3><table class="tb"><tr><td>임대수익</td><td>${sgn(f.rent)}</td></tr><tr><td>예금 이자</td><td>${sgn(f.dep)}</td></tr><tr><td>근로소득</td><td>${sgn(f.sal)}</td></tr><tr><td>이자비용</td><td>${sgn(-f.intr)}</td></tr><tr><td>주거비 <small>${f.house ? '남의 집 월세' : '내 집 거주'}</small></td><td>${sgn(-f.house)}</td></tr><tr><td>재산세·종부세 납부</td><td>${sgn(-f.tax)}</td></tr><tr class="tot"><td>순현금흐름</td><td class="${cls(f.net)}">${sgn(f.net)}</td></tr></table>`;
    h += `<div class="kpis"><div><span>보유 주택 수 <small>세율을 가름</small></span><b>${houseCount()}채</b></div><div><span>정부 기조</span><b>${pol().name}</b></div><div><span>부채비율 <small>부채÷자산</small></span><b>${A > 0 ? (D / A * 100).toFixed(0) : 0}%</b></div><div><span>이자보상배율 <small>임대÷이자</small></span><b>${f.intr > 0 ? (f.rent / f.intr).toFixed(1) + '배' : '-'}</b></div></div>`;
    if (S.bets.length) h += '<h3>결과를 기다리는 한 탕</h3><table class="tb">' + S.bets.map(b => `<tr><td>${esc(b.label)}</td><td>${won(b.amt)}</td><td>${qLabel(b.due)}</td></tr>`).join('') + '</table>';
  } else if (tab === 'market') {
    h += '<p class="muted">빨강은 상승, 파랑은 하락입니다. 이름을 누르면 그곳까지 걸어갑니다.</p>';
    for (const t of TYPES) {
      const i4 = q >= 4 ? (W.idx[t][q] / W.idx[t][q - 4] - 1) * 100 : (W.idx[t][q] - 1) * 100;
      h += `<h3>${TKO[t]} <small class="${cls(i4)}">지수 ${q >= 4 ? '1년' : '누적'} ${pct(i4)}</small></h3><table class="tb mk">` + PROPS.filter(p => p.type === t).map(p => {
        const pr = price(p.id), ch = q > 0 ? (pr / price(p.id, q - 1) - 1) * 100 : 0;
        return `<tr><td><button type="button" class="lnk" data-a="guide" data-v="${p.id}">${S.own[p.id] ? '<i class="star" aria-label="보유"></i>' : ''}${esc(p.name)}</button></td><td>${S.gone[p.id] ? '분양 완료' : won(pr)}</td><td class="${cls(ch)}">${S.gone[p.id] ? '' : pct(ch)}</td></tr>`;
      }).join('') + '</table>';
    }
  } else if (tab === 'news') {
    h += S.news.length ? S.news.slice(0, 40).map(n => `<article class="nw"><div><span class="tag">${esc(n.kind)}</span><time>${qLabel(n.q)}</time></div><b>${esc(n.title)}</b><p>${esc(n.body)}</p></article>`).join('') : '<p class="muted">아직 뉴스가 없습니다. 분기가 바뀔 때마다 금리 결정과 지역 소식이 들어옵니다.</p>';
  } else {
    const sl = a => a.slice(0, q + 1), row = (n, v, a, c, note) => `<div class="mrow"><div><span>${n}</span><b>${v}</b>${note ? `<small>${note}</small>` : ''}</div>${spark(sl(a), 130, 34, c)}</div>`;
    h += '<h3>거시경제 지표</h3>' + row('한국은행 기준금리', W.r[q].toFixed(2) + '%', W.r, 'var(--gold)', '시작값은 ' + REAL.asOf + ' 실제') + row('원/달러 환율', W.fx[q].toFixed(1) + '원', W.fx, 'var(--gold)', '시작값은 ' + REAL.asOf + ' 실제') + row('미국 기준금리(상단)', W.us[q].toFixed(2) + '%', W.us, 'var(--muted)') + row('경제성장률', W.g[q].toFixed(1) + '%', W.g, 'var(--ok)') + row('물가상승률', W.pi[q].toFixed(1) + '%', W.pi, 'var(--ok)') + row('부동산 소비심리', String(Math.round(100 + W.sent[q] * 40)), W.sent, 'var(--text)');
    h += '<h3>유형별 가격지수 <small>시작 = 100</small></h3>' + TYPES.map(t => row(TKO[t], (W.idx[t][q] * 100).toFixed(1), W.idx[t])).join('');
    h += `<h3>금융 조건</h3><table class="tb"><tr><td>정부의 부동산 정책 기조</td><td>${pol().name}</td></tr><tr><td>아파트 담보대출</td><td>연 ${mortRate('apt').toFixed(2)}% · LTV ${(W.ltvApt[q] * 100).toFixed(0)}%</td></tr><tr><td>PF 대출</td><td>${W.pfFreeze[q] ? '신규 중단' : '연 ' + pfRate().toFixed(2) + '%'}</td></tr><tr><td>전세가율</td><td>${(W.jr[q] * 100).toFixed(0)}%</td></tr><tr><td>공사비 지수</td><td>${(W.cost[q] * 100).toFixed(0)}</td></tr></table>`;
  }
  el.innerHTML = h;
}
function renderHud() {
  const q = S.q, left = W.Q - q, nw = netWorth();
  $('hDate').textContent = qLabel(Math.min(q, W.Q));
  $('hLeft').textContent = left > 0 ? `남은 기간 ${Math.floor(left / 4)}년 ${left % 4}분기` : '게임 종료';
  $('hCash').textContent = won(S.cash); $('hNW').textContent = won(nw);
  const rt = (nw / START_CASH - 1) * 100, hr = $('hRet'); hr.textContent = pct(rt); hr.className = cls(rt);
  const ar = (a, d = 2) => { const dv = q > 0 ? a[q] - a[q - 1] : 0; return Math.abs(dv) < Math.pow(10, -d) / 2 ? '' : dv > 0 ? '<i class="up">▲</i>' : '<i class="down">▼</i>'; };
  const s = W.sent[q], mood = s > .45 ? '과열' : s > .15 ? '낙관' : s > -.15 ? '보합' : s > -.45 ? '위축' : '공포';
  $('hMacro').innerHTML = `<div class="chip"><span>기준금리</span><b>${W.r[q].toFixed(2)}%${ar(W.r)}</b></div><div class="chip"><span>원/달러</span><b>${Math.round(W.fx[q]).toLocaleString('en-US')}${ar(W.fx, 0)}</b></div><div class="chip"><span>성장률</span><b>${W.g[q].toFixed(1)}%${ar(W.g, 1)}</b></div><div class="chip"><span>물가</span><b>${W.pi[q].toFixed(1)}%${ar(W.pi, 1)}</b></div><div class="chip"><span>시장 심리</span><b class="${s > .15 ? 'up' : s < -.15 ? 'down' : ''}">${mood}</b></div><div class="chip"><span>정부 기조</span><b>${pol().short}</b></div>`;
}
function refreshAll() { if (!S || !W) return; renderHud(); renderPanel(); if (view) renderView(); }

/* ----- 시작과 끝 ----- */
function startGame(cfg) {
  S = newState(cfg); W = genWorld(S.seed, S.init);
  $('title').hidden = true; $('report').hidden = true; popQ = []; popup = null; $('pop').hidden = true; closeView(); lastSettle = null;
  resetWorldView(); running = true; paused = false; refreshAll();
  const next = { label: '다음' };
  pushPopup({ kind: 'tut', title: '청운시에 오신 것을 환영합니다', body: `<p>${esc(S.name)} 님의 종잣돈은 <b>10억</b>, 주어진 시간은 <b>10년(40분기)</b>입니다. 한 분기는 약 ${MODES[S.mode].ql}초이고, 시장은 창을 열어 둔 동안에도 흘러갑니다.</p><p>목표는 10년 뒤 <b>순자산</b>을 최대로 불리는 것입니다. 파산하면 그 자리에서 끝납니다.</p>`, choices: [next] });
  pushPopup({ kind: 'tut', title: '움직이고, 말 걸고, 거래하기', body: '<p><b>방향키·WASD</b>로 걷거나 지도에서 가고 싶은 곳을 누르세요. 건물 정문 앞에서 <b>Space</b>를 누르면 매물을 살펴보고 사고팔 수 있습니다.</p><ul class="list"><li><b>청운은행</b>: 신용대출, 달러 예금, 대출 상환</li><li><b>청운증권 PF센터</b>: 내 땅 개발(프로젝트 파이낸싱), 메자닌 투자</li><li><b>김여사 복덕방</b>: 개발 소문 / <b>신문 가판대</b>: 금리·경기 전망과 선거 여론조사 / <b>시청</b>: 현행 세제와 선거 일정</li></ul>', choices: [next] });
  pushPopup({ kind: 'tut', title: '가격은 이유가 있어서 움직입니다', body: `<p>지금 기준금리는 연 ${S.init.rate.toFixed(2)}%, 환율은 1달러 ${S.init.fx.toFixed(1)}원입니다. 금리, 경기, 환율, 물가, 수급, 정책, 심리가 매 분기 가격을 밀고 당기며, 매물 창에서 그 내역을 볼 수 있습니다.</p><p>세금은 2026년 11월 현행 세법을 따릅니다. 살 때 <b>취득세</b>, 들고 있으면 <b>재산세·종합부동산세</b>, 팔 때 <b>양도소득세</b>가 붙고, 10년 사이 네 번의 <b>선거</b>가 세율과 대출 규제를 바꿀 수 있습니다. 자세한 내용은 시청에서 확인하세요.</p><p>가끔 <b>한 탕 찬스</b>가 찾아옵니다. 제한 시간 안에 결정하세요. 대박도 있고 사기도 있습니다.</p>`, choices: [{ label: '시작한다' }] });
}
function endGame(bankrupt) {
  running = false; S.over = true; popQ = []; popup = null; $('pop').hidden = true; closeView();
  const q = Math.min(S.q, W.Q), nw = netWorth(), G = gradeOf(nw, bankrupt), T = S.stats, yrs = Math.max(.25, q / 4);
  const cagr = nw > 0 ? (Math.pow(nw / START_CASH, 1 / yrs) - 1) * 100 : -100, bench = benchDeposit();
  const hist = S.hist.slice(0, q + 1), all = hist.concat(bench.slice(0, q + 1)), mn = Math.min(0, ...all), mx = Math.max(...all) * 1.08;
  const w = 640, hh = 220, L = 46, B = 24, X = i => L + i * (w - L - 96) / W.Q, Y = v => hh - B - (v - mn) / (mx - mn) * (hh - B - 12);
  const line = a => a.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ');
  const ticks = [mn, (mn + mx) / 2, mx].map(v => `<line x1="${L}" x2="${w - 96}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v.toFixed(0)}억</text>`).join('');
  const yrsT = [0, 8, 16, 24, 32, 40].map(i => `<text x="${X(i)}" y="${hh - 6}" text-anchor="middle">${2026 + Math.floor((3 + i) / 4)}</text>`).join('');
  const chart = `<svg class="chart" viewBox="0 0 ${w} ${hh}" role="img" aria-label="순자산 추이">${ticks}${yrsT}${W.qc <= q ? `<line x1="${X(W.qc)}" x2="${X(W.qc)}" y1="12" y2="${hh - B}" class="crisis"/><text x="${X(W.qc) + 4}" y="20" class="cr">신용경색</text>` : ''}${W.elect.filter(e => e.q <= q && e.from !== e.to).map(e => `<line x1="${X(e.q)}" x2="${X(e.q)}" y1="${hh - B - 8}" y2="${hh - B}" class="el"/><text x="${X(e.q)}" y="${hh - B - 11}" text-anchor="middle" class="elt">${POL[e.to].short}</text>`).join('')}<polyline points="${line(bench.slice(0, q + 1))}" class="l2"/><polyline points="${line(hist)}" class="l1"/><circle cx="${X(q)}" cy="${Y(hist[q])}" r="4" class="d1"/><text x="${X(q) + 8}" y="${Y(hist[q]) + 4}" class="t1">나 ${won(hist[q])}</text><text x="${X(q) + 8}" y="${Y(bench[q]) + 4}" class="t2">예금만 ${won(bench[q])}</text></svg>`;
  const qs = [];
  if (T.forced > 0 || bankrupt) qs.push('강제 경매나 파산에 이르기 전, 어떤 신호(뉴스, 금리, 부채비율)를 보고 빚을 줄였어야 했을까요?');
  if (T.tCgt + T.tAcq > .3) qs.push('같은 차익이라도 보유 기간과 주택 수에 따라 세후 수익이 어떻게 달라졌나요? 세금을 줄일 수 있었던 선택은 무엇이었나요?');
  if (W.elect.some(e => e.from !== e.to && e.q <= q)) qs.push('선거로 바뀐 제도 가운데 내 의사결정을 가장 크게 바꾼 것은 무엇이었나요? 제도 변경은 예측할 수 있었나요?');
  if (T.interest > T.rent) qs.push('이자비용이 임대수익보다 컸습니다. 이 빚은 언제 이익을 키웠고 언제 손실을 키웠나요?');
  if (T.pf !== 0) qs.push('개발 사업의 손익은 분양가, 공사비, 금융비 가운데 무엇에 가장 민감했나요?');
  if (T.jackN > 0) qs.push('한 탕 이벤트 가운데 기대값이 양(+)인 것과 음(-)인 것을 어떻게 구분할 수 있었을까요?');
  qs.push('금리가 오른 분기에 토지, 아파트, 오피스, 공장 중 무엇이 가장 크게 내렸나요? 이유는 무엇일까요?');
  qs.push('부동산을 시세(공정가치)로 평가한 순자산과 실제로 손에 쥘 수 있는 현금은 왜 다를까요?');
  qs.push('김여사의 소문 가운데 진짜와 가짜를 가르는 단서는 무엇이었나요?');
  const code = `${S.seedStr || '무작위'} · ${S.name} · ${nw.toFixed(2)}억 · ${G.g}`;
  const row = (n, v, c) => `<tr><td>${n}</td><td class="${c ? cls(v) : ''}">${c ? sgn(v) : v}</td></tr>`;
  $('report').innerHTML = `<div class="rpg rcard"><p class="eyebrow">${bankrupt ? qLabel(q) + ' · 순자산이 0 아래로 내려갔습니다' : '2036년 4분기 · 10년의 결산'}</p><h1><span class="grade g-${G.g}">${G.g}</span>${G.t}</h1><p class="lead">${esc(S.name)} 님의 최종 순자산은 <b>${won(nw)}</b>입니다. 연평균 ${pct(cagr)} 불어났고, 예금만 했다면 ${won(G.B)}이 되었을 시장이었습니다. 10년간 아파트 지수는 ${pct((W.idx.apt[q] - 1) * 100)}, 토지 지수는 ${pct((W.idx.land[q] - 1) * 100)} 움직였고, 최고 부채비율은 ${(T.maxLev * 100).toFixed(0)}%, 강제 경매는 ${T.forced}회였습니다.</p>${chart}<div class="cols"><table class="tb"><caption>벌어들인 돈</caption>${row('임대수익', T.rent, 1)}${row('매매 차익 (세후)', T.realized, 1)}${row('개발 사업 손익', T.pf, 1)}${row('메자닌 손익', T.mezz, 1)}${row('한 탕 손익', T.jackpot, 1)}${row('환차손익', T.fx, 1)}${row('근로소득·예금이자', T.salary + T.dep, 1)}</table><table class="tb"><caption>치른 값</caption>${row('이자비용', -T.interest, 1)}${row('취득세·등록면허세', -T.tAcq, 1)}${row('양도소득세 (지방소득세 포함)', -T.tCgt, 1)}${row('재산세·종합부동산세', -T.tHold, 1)}${row('사업소득세·개발부담금', -T.tBiz, 1)}${row('중개보수', -T.broker, 1)}${row('주거비', -T.housing, 1)}</table></div><h3>함께 이야기해 볼 질문</h3><ol class="list">${qs.slice(0, 4).map(x => `<li>${x}</li>`).join('')}</ol><div class="codebox"><span>결과 코드</span><code id="rcode">${esc(code)}</code><button type="button" class="btn sm" data-a="copy">복사</button></div><div class="acts"><button type="button" class="btn primary" data-a="again">같은 시장에서 다시 도전</button><button type="button" class="btn" data-a="fresh">처음 화면으로</button></div></div>`;
  $('report').hidden = false; $('report').scrollTop = 0; renderHud(); renderPanel();
  try { const b = +localStorage.getItem('hb_best') || 0; if (nw > b) localStorage.setItem('hb_best', nw.toFixed(2)); } catch (e) { /* 저장 불가 환경 */ }
}
function showTitle() {
  running = false; $('report').hidden = true; $('title').hidden = false;
  $('inRate').value = REAL.rate.toFixed(2); $('inFx').value = REAL.fx.toFixed(1); $('inUs').value = REAL.us.toFixed(2);
  try { const n = localStorage.getItem('hb_name'); if (n) $('inName').value = n; const b = localStorage.getItem('hb_best'); if (b) $('best').textContent = '내 최고 기록 ' + b + '억'; } catch (e) { /* 저장 불가 환경 */ }
}
function readTitle() {
  const name = $('inName').value.trim() || '무명 투자자', seedStr = $('inCode').value.trim();
  const mode = (document.querySelector('input[name="mode"]:checked') || {}).value || 'std';
  const num = (id, d, a, b) => { const v = parseFloat($(id).value); return isFinite(v) ? clamp(v, a, b) : d; };
  const init = { rate: num('inRate', REAL.rate, .5, 7), fx: num('inFx', REAL.fx, 900, 2000), us: num('inUs', REAL.us, .25, 7) };
  try { localStorage.setItem('hb_name', name); } catch (e) { /* 저장 불가 환경 */ }
  return { name, seedStr, seed: seedStr ? hashStr(seedStr) : (Math.random() * 4294967296) >>> 0, mode, init };
}

/* ----- 버튼 동작 ----- */
const ACT = {
  close: closeView, pause: () => togglePause(), interact: () => tryInteract(),
  choice: v => choose(+v),
  tab: v => { tab = v; renderPanel(); $('side').classList.add('open'); if (view && view.t === 'agent') closeView(); },
  sideClose: () => $('side').classList.remove('open'),
  guide: v => { $('side').classList.remove('open'); guideTo(v); },
  fin: v => { if (v === 'jeonse') view.mode = 'jeonse'; else { view.mode = 'mort'; view.frac = +v; } renderView(); },
  buy: () => doBuy(view.id, view.mode, view.frac, null, view.live),
  liveSel: v => { view.live = v === '1'; renderView(); }, live: v => setLive(view.id, v === '1'),
  sell: () => doSell(view.id), more: () => borrowMore(view.id),
  repay: v => repayLoan(view.id, +v), repayId: v => repayLoan(v, 1),
  credit: v => creditMove(+v), emerg: emergRepay, usdBuy, usdSell: v => usdSell(v === 'all'),
  pfLand: v => { view.land = v; view.typ = null; renderView(); }, pfTyp: v => { view.typ = v; renderView(); }, pfPl: v => { view.pli = +v; renderView(); },
  pfGo: () => startPF(view.land, view.typ, view.pli), mezz: v => mezzBuy(+v),
  again: () => startGame({ name: S.name, seedStr: S.seedStr, seed: S.seed, mode: S.mode, init: S.init }),
  fresh: showTitle,
  copy: () => { const t = $('rcode').textContent; try { navigator.clipboard.writeText(t).then(() => toast('결과 코드를 복사했습니다', 'good'), () => toast('복사하지 못했습니다. 코드를 직접 선택해 복사하세요', 'bad')); } catch (e) { toast('복사하지 못했습니다. 코드를 직접 선택해 복사하세요', 'bad'); } }
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
  const f = ACT[b.dataset.a]; if (f) f(b.dataset.v);
});
