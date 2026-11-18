// ============================================================
//  UI : 컨셉 · 마감재 · 견적 · 기획서 패널
// ============================================================

const $ = s => document.querySelector(s);
const won = n => Math.round(n).toLocaleString('ko-KR');
const man = n => (n / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 0 }) + '만';
let tab = 'concept', zone = '공용부';

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 1800); }

// ---------- 스와치 ----------
const swCache = {};
function swatch(item, slot) {
  const key = item.id;
  if (swCache[key]) return swCache[key];
  const it = item.color === 'ctop' ? itemOf('countertop') : item;
  const c = document.createElement('canvas'); c.width = c.height = 96; const ctx = c.getContext('2d');
  const t = it.tex && it.tex.k !== 'paint' ? texFor(it) : null;
  if (t) { const s = t.canvas; const cw = Math.min(s.width, s.height) * .55; ctx.drawImage(s, 0, 0, cw, cw, 0, 0, 96, 96); }
  else if (it.color === 'wall' || it.color === 'floor') { ctx.fillStyle = '#ddd'; ctx.fillRect(0, 0, 96, 96); ctx.fillStyle = '#999'; ctx.font = '600 20px sans-serif'; ctx.fillText(it.color === 'wall' ? '벽색' : '마루색', 18, 56); }
  else {
    ctx.fillStyle = it.color; ctx.fillRect(0, 0, 96, 96);
    if (it.glass) { ctx.fillStyle = it.glass; ctx.globalAlpha = .7; ctx.fillRect(16, 10, 64, 76); ctx.globalAlpha = 1; }
    if (it.metal) { const g = ctx.createLinearGradient(0, 0, 96, 96); g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.25)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 96, 96); }
  }
  return (swCache[key] = c.toDataURL('image/jpeg', .85));
}

// ---------- 견적 ----------
const CAT_OF = { floor_main: '바닥', floor_entry: '타일', floor_balcony: '타일', wall_living: '도배·도장', wall_kitchen: '도배·도장', wall_master: '도배·도장', wall_bed2: '도배·도장', wall_bed3: '도배·도장', wall_balcony: '도배·도장', wall_feature: '아트월', baseboard: '목공', door: '도어·중문', jungmun: '도어·중문', kitchen_lower: '주방', kitchen_upper: '주방', countertop: '주방', backsplash: '주방', shoe: '가구', closet: '가구', bath_wall: '욕실', bath_floor: '욕실', bath_fixture: '욕실' };
function qtyOf(slot) {
  const c = CATALOG[slot];
  switch (c.qty) {
    case 'floor': return (qty.floor[slot] || 0) * .92;
    case 'wall': return qty.wall[slot] || 0;
    case 'base': return qty.base; case 'doors': return qty.doors; case 'one': return 1; case 'baths': return qty.baths;
    default: return qty[c.qty] || 0;
  }
}
function estimate() {
  const lines = [];
  for (const slot in CATALOG) {
    const it = itemOf(slot), q = qtyOf(slot);
    if (!q) continue;
    lines.push({ cat: CAT_OF[slot] || '기타', name: CATALOG[slot].label, item: it.name, q, unit: CATALOG[slot].unit, price: it.price, amt: q * it.price, slot });
  }
  for (const f of FIXED_COSTS) {
    let amt = f.amt, q = 1, unit = '식', price = f.amt;
    if (f.perM2) { q = qty.ceiling * .92; unit = '㎡'; price = f.perM2; amt = q * price; }
    if (f.perBath) { q = qty.baths; unit = '개소'; price = f.perBath; amt = q * price; }
    lines.push({ cat: '공통', name: f.name, item: f.note, q, unit, price, amt });
  }
  for (const k of ['sash', 'expand', 'dress', 'cove']) if (state[k]) { const o = OPTION_COSTS[k]; lines.push({ cat: '옵션', name: o.name, item: o.note, q: 1, unit: '식', price: o.amt, amt: o.amt }); }
  const sub = lines.reduce((s, l) => s + l.amt, 0), mg = sub * MGMT_RATE, vat = state.vat ? (sub + mg) * .1 : 0;
  return { lines, sub, mg, vat, total: sub + mg + vat };
}

// ---------- 탭 렌더 ----------
function renderConcept() {
  const cards = CONCEPTS.map(c => {
    const chips = ['floor_main', 'wall_living', 'wall_feature', 'kitchen_lower', 'countertop', 'closet'].map(s => { const it = CATALOG[s].items.find(i => i.id === c.pick[s]); return `<i style="background:${it.color === 'ctop' ? '#ddd' : it.color}" title="${it.name}"></i>`; }).join('');
    return `<div class="concept ${state.concept === c.id ? 'on' : ''}" data-c="${c.id}">
      <div class="chips">${chips}</div>
      <h3>${c.name}<small>${c.en}</small></h3><p>${c.desc}</p>
      <div class="keys">${c.keys.map(k => `<span>${k}</span>`).join('')}</div></div>`;
  }).join('');
  const tg = (k, label, sub) => `<label class="tg"><input type="checkbox" data-k="${k}" ${state[k] ? 'checked' : ''}><span></span><div>${label}<small>${sub}</small></div></label>`;
  $('#pane').innerHTML = `
    <section><h2>디자인 컨셉 <em>2026</em></h2><div class="concepts">${cards}</div></section>
    <section><h2>공간 구성 옵션</h2>
      ${tg('dress', '안방 드레스룸 구획 (제안안)', '전실 1.9m를 드레스룸으로 바꾸고 욕실1을 안방 전용으로')}
      ${tg('expand', '거실 발코니 확장', '거실 깊이 +1.5m · 관리주체 행위허가 필요')}
      ${tg('sash', '샷시 전체 교체 견적 포함', '구축 단열·결로 개선의 핵심 공정')}
      ${tg('cove', '간접조명 패키지', '거실 우물천장 · 복도 라인조명 · 니치 LED')}
    </section>
    <section><h2>조명 시뮬레이션</h2>
      <div class="seg" id="lightSeg">${[['day', '☀ 주간'], ['evening', '◐ 저녁'], ['night', '☾ 야간']].map(([k, l]) => `<button data-l="${k}" class="${state.light === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="kel"><span>색온도</span><input type="range" id="kel" min="2700" max="5000" step="100" value="${state.kelvin}"><b id="kelv">${state.kelvin}K</b></div>
      <p class="hint">저녁·야간 모드에서 실내 조명이 켜집니다. 천장이 있는 1인칭 워크스루에서 보면 분위기를 확인하기 좋아요.</p>
    </section>
    <section><h2>보기 옵션</h2>
      ${tg('ceiling', '천장 표시', '조감도에서 천장·다운라이트 표시')}
      ${tg('cutaway', '벽 낮춰 보기 (단면)', '벽을 낮춰 가구 배치를 한눈에')}
    </section>`;
  $('#pane').querySelectorAll('.concept').forEach(el => el.onclick = () => applyConcept(el.dataset.c));
  $('#pane').querySelectorAll('.tg input').forEach(el => el.onchange = () => {
    state[el.dataset.k] = el.checked;
    if (['dress', 'expand', 'cove'].includes(el.dataset.k)) { build(); }
    else applyView();
    saveState(); updateTotal();
  });
  $('#pane').querySelectorAll('#lightSeg button').forEach(b => b.onclick = () => { state.light = b.dataset.l; applyLighting(); saveState(); renderConcept(); });
  $('#kel').oninput = e => { state.kelvin = +e.target.value; $('#kelv').textContent = state.kelvin + 'K'; applyLighting(); saveState(); };
}
function applyConcept(id) {
  const c = CONCEPTS.find(c => c.id === id);
  state.concept = id; state.sel = { ...c.pick }; state.kelvin = c.light.k;
  applyAll(); build(); saveState(); render(); updateTotal();
  toast(`'${c.name}' 컨셉을 적용했어요`);
}

function renderFinish(focusSlot) {
  const zs = ['전체', ...ZONES];
  const slots = Object.keys(CATALOG).filter(s => zone === '전체' || CATALOG[s].zone === zone);
  $('#pane').innerHTML = `<div class="zones">${zs.map(z => `<button data-z="${z}" class="${zone === z ? 'on' : ''}">${z}</button>`).join('')}</div>
    <p class="hint">3D 화면에서 벽·바닥·가구를 탭하면 해당 항목으로 바로 이동합니다.</p>` +
    slots.map(slot => {
      const c = CATALOG[slot], cur = itemOf(slot), q = qtyOf(slot);
      return `<section class="slot" id="slot-${slot}"><div class="sh"><h3>${c.label}</h3><span>${c.where}</span></div>
        <div class="qty">물량 ${q.toFixed(c.unit === '㎡' || c.unit === 'm' ? 1 : 0)}${c.unit} · 소계 <b>${won(q * cur.price)}원</b></div>
        <div class="items">${c.items.map(it => `<button class="item ${it.id === cur.id ? 'on' : ''}" data-s="${slot}" data-i="${it.id}">
          <img src="${swatch(it, slot)}" alt=""><div><b>${it.name}</b><small>${it.spec}</small>
          <span class="pr">${it.price ? won(it.price) + '원/' + c.unit : '—'}</span>${it.tag ? `<em>${it.tag}</em>` : ''}</div></button>`).join('')}</div></section>`;
    }).join('');
  $('#pane').querySelectorAll('.zones button').forEach(b => b.onclick = () => { zone = b.dataset.z; renderFinish(); });
  $('#pane').querySelectorAll('.item').forEach(b => b.onclick = () => pickItem(b.dataset.s, b.dataset.i));
  if (focusSlot) { const el = document.getElementById('slot-' + focusSlot); if (el) { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); el.classList.add('pulse'); setTimeout(() => el.classList.remove('pulse'), 1400); } }
}
function pickItem(slot, id) {
  state.sel[slot] = id; state.concept = 'custom';
  if (['baseboard', 'door', 'jungmun'].includes(slot)) build();
  applySlot(slot);
  if (slot === 'countertop') applySlot('backsplash');
  flashSlot(slot); saveState();
  const y = $('#pane').scrollTop; renderFinish(); $('#pane').scrollTop = y; updateTotal();
}

function renderEstimate() {
  const e = estimate(), py = PLAN_META.pyeong;
  const cats = {}; for (const l of e.lines) (cats[l.cat] = cats[l.cat] || []).push(l);
  const order = ['공통', '옵션', '바닥', '도배·도장', '아트월', '목공', '도어·중문', '주방', '가구', '욕실', '타일'];
  const lo = 6100e4, hi = 8500e4, mx = Math.max(e.total, 1e8) * 1.1;
  $('#pane').innerHTML = `<section class="sum">
      <div class="big"><small>예상 총 공사비 (부가세 ${state.vat ? '포함' : '별도'})</small><b>${man(e.total)}원</b><span>평당 ${man(e.total / py)}원 · ${py}평 기준</span></div>
      <div class="range"><div class="bar"><i class="mk" style="left:${lo / mx * 100}%;width:${(hi - lo) / mx * 100}%"></i><i class="me" style="left:${e.total / mx * 100}%"></i></div>
      <small>회색 띠: 34평 표준 올수리 6,100만~8,500만 원 (업체 자료 · 샷시·붙박이장 미포함 기준이 많음). 고급 자재·구조 변경 시 1억 원 이상</small></div>
      <label class="tg sm"><input type="checkbox" id="vat" ${state.vat ? 'checked' : ''}><span></span><div>부가세 10% 포함</div></label>
      <button class="btn" id="copyTsv">견적표 복사 (엑셀 붙여넣기용)</button>
    </section>
    <section><table class="est"><thead><tr><th>공정 / 항목</th><th>물량</th><th>금액</th></tr></thead><tbody>
    ${order.filter(c => cats[c]).map(c => {
      const s = cats[c].reduce((a, l) => a + l.amt, 0);
      return `<tr class="cat"><td>${c}</td><td></td><td>${man(s)}</td></tr>` + cats[c].map(l => `<tr><td>${l.name}<small>${l.item || ''}</small></td><td>${l.q.toFixed(l.unit === '식' || l.unit === '짝' || l.unit === '개소' ? 0 : 1)}${l.unit}</td><td>${won(l.amt)}</td></tr>`).join('');
    }).join('')}
    <tr class="cat"><td>소계</td><td></td><td>${won(e.sub)}</td></tr>
    <tr><td>현장관리·디자인비 (${MGMT_RATE * 100}%)</td><td></td><td>${won(e.mg)}</td></tr>
    ${state.vat ? `<tr><td>부가세 10%</td><td></td><td>${won(e.vat)}</td></tr>` : ''}
    <tr class="tot"><td>합계</td><td></td><td>${won(e.total)}</td></tr></tbody></table>
    <p class="note">※ 단가는 시공비를 포함한 2026년 개략 추정치입니다. 물량은 3D 모델에서 자동으로 산출했어요(바닥은 중심선 면적×0.92). 시스템에어컨·가전·조명기구 본체·이사비는 빠져 있습니다. 실측 견적 3곳 이상과 비교해 보세요.</p></section>`;
  $('#vat').onchange = ev => { state.vat = ev.target.checked; saveState(); renderEstimate(); updateTotal(); };
  $('#copyTsv').onclick = async () => {
    const rows = [['공정', '항목', '선택 자재/비고', '물량', '단위', '단가', '금액'], ...e.lines.map(l => [l.cat, l.name, l.item, l.q.toFixed(2), l.unit, Math.round(l.price), Math.round(l.amt)]), ['', '현장관리·디자인비', '', '', '', '', Math.round(e.mg)], ['', '부가세', '', '', '', '', Math.round(e.vat)], ['', '합계', '', '', '', '', Math.round(e.total)]];
    try { await navigator.clipboard.writeText(rows.map(r => r.join('\t')).join('\n')); toast('견적표를 복사했어요. 엑셀에 붙여넣으세요'); } catch (er) { toast('이 환경에서는 클립보드 복사가 막혀 있어요'); }
  };
}

function renderPlan() {
  const c = CONCEPTS.find(c => c.id === state.concept);
  const e = estimate();
  const rows = Object.keys(CATALOG).map(s => { const it = resolveItem(s), cc = CATALOG[s]; return `<tr><td>${cc.zone}</td><td>${cc.label}</td><td><i class="dot" style="background:${/^#/.test(it.color) ? it.color : '#ccc'}"></i>${it.name}<small>${it.spec}</small></td><td>${/^#/.test(it.color) ? it.color : '—'}</td></tr>`; }).join('');
  const area = ROOMS.filter(r => !r.nolabel).map(r => { const a = (r.x2 - r.x1) * (r.z2 - r.z1) / 1e6; return `<tr><td>${r.name}</td><td>${((r.x2 - r.x1) / 1000).toFixed(2)} × ${((r.z2 - r.z1) / 1000).toFixed(2)}m</td><td>${a.toFixed(1)}㎡</td></tr>`; }).join('');
  $('#pane').innerHTML = `<article class="doc">
    <h2>33평형 전체 리모델링 기획서</h2><p class="meta">${PLAN_META.name} · 공급 ${PLAN_META.supply}㎡ / 전용 ${PLAN_META.exclusive}㎡ · 2026.11 작성</p>
    <h3>1. 프로젝트 개요</h3>
    <table><tr><th>대상</th><td>3Bay 판상형 · 방 3 / 욕실 2 · 저층(1~6층)/19층</td></tr>
    <tr><th>범위</th><td>전체 철거 후 전 공정 리모델링 (샷시·욕실·주방·바닥·도배·조명·가구)</td></tr>
    <tr><th>현재 컨셉</th><td>${c ? c.name : '사용자 지정 조합'}</td></tr>
    <tr><th>예상 공사비</th><td>${man(e.total)}원 (평당 ${man(e.total / 33)}원, 추정)</td></tr></table>
    <div class="callout"><b>사수의 한마디</b> 매매가(2억 5,000만 원) 기준으로 이 공사비는 집값의 ${Math.round(e.total / 2.5e8 * 100)}% 수준이에요. 실거주를 5년 이상 할 계획이 아니라면 샷시와 욕실·주방 같은 '바꾸기 어려운 공정'에 예산을 몰고, 도어 필름 리폼·실크벽지·강마루처럼 단가를 낮출 수 있는 항목은 등급을 조절하는 걸 권해요.</div>
    <h3>2. 2026 트렌드 인사이트</h3>
    <ul>
      <li><b>화이트 회귀 + 웜 뉴트럴</b> — Pantone 2026은 첫 화이트 컬러 <i class="dot" style="background:#F0EEE9"></i>Cloud Dancer(11-4201). BM은 딥 브라운 <i class="dot" style="background:#57504C"></i>Silhouette, SW는 <i class="dot" style="background:#B8A992"></i>Universal Khaki를 골랐어요. 쿨 그레이에서 웜 톤으로 넘어가는 흐름입니다.</li>
      <li><b>3무 인테리어</b> — 무몰딩·무문선·무걸레받이로 선을 지우고 면을 강조합니다(세계일보 2026.06). 대신 벽과 바닥 수평이 정밀해야 해서 숙련 시공팀이 필요해요.</li>
      <li><b>광폭 우드</b> — 동화자연마루가 초광폭 강마루를 리뉴얼했고(2026.04), 한샘 165 강마루는 2분기 매출이 98% 늘었어요(2026.07). 밝은 오크에서 월넛·티크 쪽으로 옮겨가는 흐름도 일부 있습니다.</li>
      <li><b>원톤 & 빅슬랩</b> — 벽·천장·몰딩·도어 색을 맞추는 원톤(현대리바트), 세라믹 상판과 슬랩 백스플래시, 대형 포세린 욕실이 늘고 있어요.</li>
      <li><b>소프트 미니멀 & 레이어드 조명</b> — 질감 있는 마감(라임워시·패브릭·템바)과 간접조명 위주의 따뜻한 색온도가 쓰입니다.</li>
    </ul>
    <h3>3. 공간 계획</h3>
    <ul>
      <li><b>안방 존</b> — 안방 앞 전실(2.6×1.9m)을 ${state.dress ? '드레스룸으로 구획하고 아치 개구부로 안방과 연결해, 욕실1을 안방 전용(부부욕실)으로 씁니다' : '원평면대로 복도형 전실로 유지합니다'}.</li>
      <li><b>LDK</b> — 주방은 ㄱ자 하부장 + 서측 키큰장(냉장고장)으로 구성하고, 식탁 위에 펜던트 2구를 둡니다. 거실 TV벽(W 3.8m)이 아트월이에요. ${state.expand ? '거실 발코니를 확장해 거실 깊이가 6.2m가 됩니다.' : '거실 발코니는 비확장으로 두고 홈카페·화분 존으로 씁니다.'}</li>
      <li><b>현관</b> — 120mm 단차, 천장까지 닿는 신발장 + LED 오픈 니치, ${itemOf('jungmun').panels ? itemOf('jungmun').name + ' 중문' : '중문 없음'}.</li>
      <li><b>욕실</b> — 욕실1은 샤워부스(욕조 철거)와 벽걸이 변기, 욕실2는 욕조를 유지하고 니치 간접조명을 넣습니다.</li>
    </ul>
    <table class="small"><thead><tr><th>실명</th><th>치수(중심선)</th><th>면적</th></tr></thead><tbody>${area}</tbody></table>
    <h3>4. 마감재 스펙 (현재 선택)</h3>
    <table class="small"><thead><tr><th>구역</th><th>항목</th><th>자재·사양</th><th>컬러</th></tr></thead><tbody>${rows}</tbody></table>
    <h3>5. 조명 계획</h3>
    <ul><li>거실: 매립 다운라이트 6구 ${state.cove ? '+ 우물천장 간접조명' : ''}, 주방: 펜던트 2구 + 상부장 하부 LED, 복도: 라인조명, 욕실: 니치 LED.</li>
    <li>색온도: 거실·침실은 2700~3000K, 주방 작업면은 3500~4000K를 권장합니다. <small>(업계 관행 기준이며 검증된 값은 아님)</small> 현재 시뮬레이션은 ${state.kelvin}K예요.</li></ul>
    <h3>6. 공정 일정 (약 7주)</h3>
    <table class="small"><tr><th>1주</th><td>관리사무소 신고·동의서, 보양, 철거, 폐기물 반출</td></tr>
    <tr><th>2주</th><td>${state.sash ? '샷시 교체, ' : ''}설비·전기 배선, ${state.expand ? '확장부 단열·난방 연장, ' : ''}욕실 방수 + 48시간 담수 테스트</td></tr>
    <tr><th>3주</th><td>목공: 천장 평탄화, 무몰딩 디테일, 문틀, ${state.dress ? '드레스룸 가벽, ' : ''}커튼박스</td></tr>
    <tr><th>4주</th><td>타일(욕실·현관·주방 백스플래시·발코니), 아트월</td></tr>
    <tr><th>5주</th><td>도장·도배, 필름</td></tr>
    <tr><th>6주</th><td>마루 시공, 주방·붙박이장·신발장 설치, 도어·중문</td></tr>
    <tr><th>7주</th><td>조명기구·스위치, 실리콘·마감, 입주청소, 하자 점검</td></tr></table>
    <h3>7. 리스크 체크리스트</h3>
    <ul class="check"><li>공동주택 행위허가: 발코니 확장·비내력벽 철거 전에 관리주체에 확인</li><li>3무 디테일은 시공팀 포트폴리오로 미리 검증 (수평 오차 2mm 이내)</li><li>대형 포세린(600×1200 이상)은 운반·재단 할증과 덧방 가능 여부 확인</li><li>샷시 리드타임 3~4주 → 계약 즉시 발주</li><li>화면 색상은 실제와 다를 수 있으니 최종 자재는 실물 샘플로 확정</li></ul>
    <h3>출처</h3><ol class="src">${SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${t}</a></li>`).join('')}</ol>
    <p class="note">※ 평면 치수는 매물 도면(11,970 × 15,515mm)을 근거로 모델링했어요. 실 구획은 도면 판독에 따른 추정이라 실측으로 확인이 필요해요. 일부 트렌드 항목(재패니디·SPC 등)은 국내 2026 공식 근거를 찾지 못해 넣지 않았어요.</p>
  </article>`;
}

function render(focusSlot) {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
  ({ concept: renderConcept, finish: renderFinish, estimate: renderEstimate, plan: renderPlan })[tab](focusSlot);
}
function updateTotal() { const e = estimate(); $('#totalChip').innerHTML = `예상 <b>${man(e.total)}원</b>`; }

// ---------- 이벤트 연결 ----------
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); $('#pane').scrollTop = 0; });
document.querySelectorAll('#views button').forEach(b => b.onclick = () => setView(b.dataset.v));
window.onViewChange = () => {
  document.querySelectorAll('#views button').forEach(b => b.classList.toggle('on', b.dataset.v === state.view));
};
window.onSlotPick = (slot, room) => {
  tab = 'finish'; zone = CATALOG[slot].zone; render(slot); flashSlot(slot);
  const r = ROOMS.find(r => r.id === room); toast(`${r ? r.name + ' · ' : ''}${CATALOG[slot].label}`);
};
window.onRoomPick = id => { if (state.view === 'walk') goSpot(id); };
const roomSel = $('#roomSel');
roomSel.innerHTML = Object.keys(SPOTS).map(k => `<option value="${k}">${(getRooms(state).find(r => r.id === k) || {}).name || k}</option>`).join('');
roomSel.onchange = () => goSpot(roomSel.value);
document.querySelectorAll('#pad button').forEach(b => {
  const k = b.dataset.k;
  const on = e => { e.preventDefault(); walk.keys[k] = true; }, off = () => { walk.keys[k] = false; };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
});
$('#snap').onclick = () => { $('#shotImg').src = snapshot(); $('#shot').classList.add('on'); };
$('#shot').onclick = e => { if (e.target.id !== 'shotImg') $('#shot').classList.remove('on'); };

// ---------- 시작 ----------
applyAll(); build(); render(); updateTotal(); window.onViewChange();
requestAnimationFrame(loop);
setTimeout(() => $('#loading').classList.add('off'), 200);
window.SIM = { state, setView, goSpot, applyLighting, build, applyConcept, estimate };
