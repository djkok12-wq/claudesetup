// 피평가자 페이지 — 홈 · 목표 설정 · 실적·자기평가 · 다면평가 · 결과 · 칭찬
import { $, $$, api, avatar, bar, chip, confirmBox, dashboard, empty, fdate, formData, grade, head, html, icon, kudosView, ls, modal, mount, n1, ring, S, start, toast } from './core.js';
import { CATALOG, DEFAULTS, MENUS } from './catalog.js';
import { bindRatings, confetti, convert, rating, readRatings, SMART, smartBadges } from './evalkit.js';

const LABEL = { draft: '작성중', submitted: '제출', approved: '승인', revise: '수정 요청', rejected: '반려' };

// ── 목표 설정 ──
async function goalsView(view) {
  const d = await api('/api/me/goals');
  const total = d.goals.filter((g) => g.status !== 'rejected').reduce((a, g) => a + g.weight, 0);
  const editable = d.goals.filter((g) => g.editable);
  const tone = total === 100 ? 'var(--ok)' : total > 100 ? 'var(--bad)' : 'var(--warn)';
  mount(view, html`${head('목표 설정', '조직 KPI와 연결된 개인 목표 3~5개를 작성하고 가중치 합계 100%로 제출하세요.',
    html`${d.can_add ? html`<button class="btn" data-even ${editable.length ? '' : 'disabled'}>${icon('equal')}가중치 균등 배분</button><button class="btn" data-add>${icon('plus')}목표 추가</button>` : ''}
      <button class="btn primary" data-submit ${total === 100 && editable.length ? '' : 'disabled'}>${icon('send')}목표 제출</button>`)}
    <div class="grid g3" style="margin-bottom:16px">
      <div class="card row tilt">${ring(total, 84, tone, total + '%')}<div><div class="b">가중치 합계</div><div class="muted small">${total === 100 ? '제출 가능합니다' : `100%까지 ${100 - total}% ${total > 100 ? '초과' : '남음'}`}</div></div></div>
      <div class="card"><div class="muted small b">1차 평가자 (승인권자)</div><div class="row" style="margin-top:8px">${avatar(d.rel.first, 36)}<b>${d.rel.first?.name || '미지정'}</b><span class="muted small">${d.rel.first?.position || ''}</span></div></div>
      <div class="card"><div class="muted small b">상태 요약</div><div class="row wrap" style="margin-top:10px">${Object.entries(LABEL).map(([s, l]) => {
        const n = d.goals.filter((g) => g.status === s).length; return n ? chip(s, `${l} ${n}`) : '';
      })}</div></div>
    </div>
    ${d.phase !== 'goal' && d.phase !== 'prep' && !editable.length ? html`<div class="callout tip" style="margin-bottom:14px">${icon('info')}목표 설정 단계가 아닙니다. 반려·수정 요청된 목표만 다시 편집할 수 있습니다.</div>` : ''}
    <div class="col stagger" id="goal-list">${d.goals.length ? d.goals.map((g) => html`
      <div class="card" data-id="${g.id}" style="${g.editable ? 'cursor:grab' : ''}">
        <div class="row wrap"><span class="chip plain ${g.type === 'quant' ? 'info' : ''}">${g.type === 'quant' ? '정량' : '정성'}</span>${chip(g.status)}
          <h3 class="grow" style="font-size:16px">${g.title}</h3><span class="b num" style="font-size:20px">${g.weight}%</span>
          ${g.editable ? html`<button class="btn sm" data-edit="${g.id}">${icon('pencil')}편집</button><button class="btn sm danger" data-del="${g.id}">${icon('trash-2')}</button>` : ''}</div>
        <p class="muted" style="margin:8px 0">${g.description}</p>
        <div class="row wrap small">${g.type === 'quant' ? html`<span class="chip plain">${icon('crosshair', 'width:13px')} 목표 ${g.target}${g.unit}</span>` : ''}
          ${g.kpi_title ? html`<span class="chip plain info">${icon('link', 'width:13px')} ${g.kpi_org} · ${g.kpi_title}</span>` : html`<span class="chip plain warn">KPI 미연결</span>`}
          ${g.due ? html`<span class="chip plain">${icon('calendar', 'width:13px')} ${fdate(g.due)}</span>` : ''}<span class="right">${smartBadges(g)}</span></div>
        ${g.review_note && g.status !== 'approved' ? html`<div class="callout ${g.status === 'rejected' ? 'bad' : 'warn'}" style="margin-top:12px">${icon('message-square-warning')}<div><b>평가자 의견</b> ${g.review_note}</div></div>` : ''}
      </div>`) : html`<div class="card">${empty('target', '아직 목표가 없습니다. "목표 추가"로 시작하세요.')}</div>`}</div>`);
  const byId = Object.fromEntries(d.goals.map((g) => [g.id, g]));
  $('[data-add]', view)?.addEventListener('click', () => goalForm(d, null));
  $$('[data-edit]', view).forEach((b) => { b.onclick = () => goalForm(d, byId[b.dataset.edit]); });
  $$('[data-del]', view).forEach((b) => { b.onclick = async () => {
    if (await confirmBox('목표 삭제', `'${byId[b.dataset.del].title}' 목표를 삭제할까요?`, true)) { await api('/api/me/goals/' + b.dataset.del, { method: 'DELETE' }); toast('삭제했습니다.'); goalsView(view); }
  }; });
  $('[data-even]', view)?.addEventListener('click', async () => {
    const fixed = d.goals.filter((g) => !g.editable && g.status !== 'rejected').reduce((a, g) => a + g.weight, 0);
    const left = 100 - fixed, n = editable.length, base = Math.floor(left / n);
    for (const [i, g] of editable.entries()) await api('/api/me/goals/' + g.id, { method: 'PUT', body: { ...g, weight: base + (i < left - base * n ? 1 : 0) } });
    toast('가중치를 균등 배분했습니다.'); goalsView(view);
  });
  $('[data-submit]', view).onclick = async () => {
    if (!(await confirmBox('목표 제출', '제출 후에는 평가자가 반려·수정 요청을 하기 전까지 수정할 수 없습니다. 제출할까요?'))) return;
    const r = await api('/api/me/goals/submit', { method: 'POST' });
    toast(`목표 ${r.submitted}건을 제출했습니다.`); goalsView(view);
  };
  if (editable.length > 1) window.Sortable?.create($('#goal-list', view), { animation: 180, filter: 'button', preventOnFilter: false,
    onEnd: () => api('/api/me/goals-order', { method: 'PUT', body: { ids: $$('#goal-list [data-id]', view).map((x) => +x.dataset.id) } }) });
}

function goalForm(d, g) {
  const v = g || { title: '', description: '', type: 'quant', weight: 20, target: '', unit: '%', due: S.boot.cycle?.end_date, kpi_id: null };
  const groups = {};
  d.kpis.forEach((k) => (groups[`${k.level} · ${k.org_name}`] ||= []).push(k));
  return modal({ title: g ? '목표 편집' : '새 목표', wide: true, body: html`
    <div class="grid g2">
      <div class="col">
        <div class="field"><label>목표명</label><input class="input" name="title" value="${v.title}" maxlength="120" placeholder="예: 차세대 플랫폼 베타 출시"></div>
        <div class="field"><label>설명 (무엇을, 어떻게, 어떤 기준으로)</label><textarea class="textarea" name="description" maxlength="1000">${v.description}</textarea></div>
        <div class="field"><label>조직 KPI 연결</label><select class="select" name="kpi_id"><option value="">연결 안 함</option>
          ${Object.entries(groups).map(([gname, ks]) => html`<optgroup label="${gname}">${ks.map((k) => html`<option value="${k.id}" ${k.id === v.kpi_id ? 'selected' : ''}>${k.title}</option>`)}</optgroup>`)}</select></div>
      </div>
      <div class="col">
        <div class="field"><label>유형</label><div class="seg" id="type">${[['quant', '정량 (달성률 자동 환산)'], ['qual', '정성 (평가자 채점)']].map(([k, l]) => html`<button type="button" data-t="${k}" class="${v.type === k ? 'on' : ''}">${l}</button>`)}</div></div>
        <div class="row" id="quant"><div class="field grow"><label>목표값</label><input class="input" type="number" min="0" step="any" name="target" value="${v.target ?? ''}"></div>
          <div class="field" style="width:110px"><label>단위</label><input class="input" name="unit" value="${v.unit || ''}" maxlength="10"></div></div>
        <div class="field"><label>가중치 <b class="num" id="wv">${v.weight}%</b></label><input type="range" min="0" max="100" step="5" name="weight" value="${v.weight}" style="accent-color:var(--brand)"></div>
        <div class="field"><label>완료 기한</label><input class="input" type="date" name="due" value="${v.due || ''}"></div>
        <div class="card flat" style="padding:14px"><div class="b small" style="margin-bottom:8px">SMART 실시간 점검</div><div id="smart"></div></div>
      </div>
    </div>`,
  actions: [{ label: '취소', value: null }, { label: g ? '저장' : '추가', kind: 'primary', value: 'ok' }],
  onOpen: (el) => {
    let type = v.type;
    const read = () => { const f = formData(el); return { ...f, type, weight: +f.weight, target: f.target === '' ? null : +f.target, kpi_id: f.kpi_id ? +f.kpi_id : null, due: f.due || null }; };
    const sync = () => {
      const f = read();
      $('#quant', el).style.display = type === 'quant' ? '' : 'none';
      $('#wv', el).textContent = f.weight + '%';
      mount($('#smart', el), html`${SMART.map(([k, l, fn]) => html`<div class="row small" style="padding:3px 0">${fn(f) ? icon('circle-check', 'color:var(--ok);width:16px') : icon('circle-dashed', 'color:var(--faint);width:16px')}<b>${k}</b> ${l}</div>`)}`);
    };
    el.addEventListener('input', sync);
    $('#type', el).onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; type = b.dataset.t; $$('#type button', el).forEach((x) => x.classList.toggle('on', x === b)); sync(); };
    el._read = read; sync();
  },
  onAction: async (_, el) => {
    const body = el._read();
    if (body.type === 'quant' && !(body.target > 0)) { toast('정량 목표는 목표값이 필요합니다.', 'bad'); return false; }
    await api(g ? '/api/me/goals/' + g.id : '/api/me/goals', { method: g ? 'PUT' : 'POST', body });
    toast(g ? '목표를 저장했습니다.' : '목표를 추가했습니다.'); goalsView($('#view'));
  } });
}

// ── 실적 · 자기평가 (자동 저장) ──
async function selfView(view) {
  const d = await api('/api/me/self');
  const rv = d.review || { item_scores: {}, comment: '', status: 'none' };
  const ro = !d.self_open, w = d.weights;
  const extra = d.rel.scheme === 'leader' ? '조직관리' : '자기개발';
  mount(view, html`${head('실적·자기평가', `승인된 목표의 실적을 입력하고 자기평가를 제출하세요. 배점: 공통목표 ${w.goal}% · 개인역량 ${w.comp}% · ${extra} ${w.extra}%`,
    html`${chip(rv.status)}<span class="save-state" id="saved"></span>`)}
    ${!['self', 'review'].includes(d.phase) ? html`<div class="callout tip" style="margin-bottom:14px">${icon('info')}실적·자기평가 단계에서 작성할 수 있습니다.</div>` : ''}
    <div class="card" style="margin-bottom:16px"><div class="card-h">${icon('target')}<h3>① 목표별 실적</h3><span class="right muted small">달성률 → 환산: 110%↑ 100 · 100%↑ 90 · 90%↑ 80 · 80%↑ 70 · 미만 60</span></div>
      ${d.goals.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>목표</th><th>가중치</th><th>목표값</th><th style="width:140px">실적</th><th>달성률</th><th>환산</th><th style="width:28%">실적 설명</th></tr></thead><tbody>
      ${d.goals.map((g) => html`<tr data-g="${g.id}"><td><b>${g.title}</b><div class="muted small">${g.type === 'quant' ? '정량' : '정성 · 평가자 채점'}</div></td><td class="num">${g.weight}%</td>
        <td class="num">${g.type === 'quant' ? `${g.target}${g.unit}` : '–'}</td>
        <td>${g.type === 'quant' ? html`<input class="input sm num" type="number" step="any" min="0" name="actual" value="${g.actual ?? ''}" ${d.actual_open ? '' : 'disabled'} data-target="${g.target}">` : '–'}</td>
        <td class="num b" data-rate>${g.rate != null ? g.rate + '%' : '–'}</td><td class="num" data-conv>${g.type === 'quant' && g.rate != null ? convert(g.rate, d.conv) + '점' : '–'}</td>
        <td><input class="input sm" name="note" value="${g.actual_note || ''}" maxlength="500" placeholder="근거·산출물" ${d.actual_open ? '' : 'disabled'}></td></tr>`)}</tbody></table></div>`
        : empty('target', '승인된 목표가 없습니다')}</div>
    <div class="card" style="margin-bottom:16px"><div class="card-h">${icon('sparkles')}<h3>② 역량 자기 진단</h3><span class="right muted small">선택 · 평가자 점수와 비교용 (1 기대 크게 미달 ~ 5 탁월)</span></div>
      <div class="list">${d.items.map((it) => html`<div><div class="grow"><b>${it.name}</b> <span class="chip plain">${it.area === 'comp' ? '개인역량' : extra}</span><div class="muted small">${it.description}</div></div>
        ${rating(String(it.id), rv.item_scores[it.id], ro)}</div>`)}</div></div>
    <div class="card"><div class="card-h">${icon('message-square-text')}<h3>③ 자기평가 코멘트</h3><span class="right muted small num" id="cnt"></span></div>
      <textarea class="textarea" name="comment" style="min-height:150px" maxlength="3000" ${ro ? 'disabled' : ''} placeholder="주요 성과, 어려웠던 점, 다음 주기 계획을 구체적으로 적어 주세요. (20자 이상)">${rv.comment}</textarea></div>
    ${ro ? '' : html`<div class="sticky-bar">${icon('cloud')}<span class="muted small">입력 내용은 자동 저장됩니다.</span><button class="btn primary right" data-submit>${icon('send')}자기평가 제출</button></div>`}`);
  const ta = $('[name=comment]', view), cnt = $('#cnt', view);
  const count = () => { const n = ta.value.trim().length; cnt.textContent = `${n}자 ${n < 20 ? '(20자 이상 필요)' : '✓'}`; cnt.style.color = n < 20 ? 'var(--bad)' : 'var(--ok)'; };
  count();
  const payload = (submit) => ({
    actuals: d.actual_open ? $$('[data-g]', view).map((tr) => ({ id: +tr.dataset.g, actual: $('[name=actual]', tr)?.value ?? null, actual_note: $('[name=note]', tr).value })) : [],
    item_scores: ro ? {} : readRatings(view), comment: ro ? '' : ta.value, submit });
  let timer;
  const save = () => { clearTimeout(timer); $('#saved', view).textContent = '저장 중…'; timer = setTimeout(async () => {
    await api('/api/me/self', { method: 'PUT', body: payload(false) }); $('#saved', view).innerHTML = '✓ 자동 저장됨';
  }, 900); };
  view.addEventListener('input', (e) => {
    if (e.target.name === 'comment') count();
    const tr = e.target.closest('[data-g]');
    if (tr && e.target.name === 'actual') {
      const t = +e.target.dataset.target, a = e.target.value === '' ? null : +e.target.value;
      const rate = a == null || !t ? null : Math.min(150, Math.round((a / t) * 1000) / 10);
      $('[data-rate]', tr).textContent = rate == null ? '–' : rate + '%';
      $('[data-conv]', tr).textContent = rate == null ? '–' : convert(rate, d.conv) + '점';
    }
    if (d.actual_open || !ro) save();
  });
  bindRatings(view, () => save());
  $('[data-submit]', view)?.addEventListener('click', async () => {
    if (ta.value.trim().length < 20) return toast('자기평가 코멘트는 20자 이상이어야 제출할 수 있습니다.', 'bad');
    if (!(await confirmBox('자기평가 제출', '제출한 자기평가는 수정할 수 없습니다. 제출할까요?'))) return;
    clearTimeout(timer);
    await api('/api/me/self', { method: 'PUT', body: payload(true) });
    toast('자기평가를 제출했습니다. 수고하셨어요!'); selfView(view);
  });
}

// ── 다면평가 (리뷰어) ──
async function peerView(view) {
  const d = await api('/api/me/peer');
  const pending = d.reviews.filter((r) => r.status === 'assigned');
  mount(view, html`${head('다면평가', '동료·하급자에 대한 익명 리뷰입니다. 점수에 자동 반영되지 않고 HR 조정 단계의 참고 지표로 쓰입니다.')}
    <div class="callout tip" style="margin-bottom:16px">${icon('shield-check')}<div>리뷰어 이름은 대상자에게 절대 노출되지 않으며, 익명 요약(평균·코멘트)만 전달됩니다. 제출 후에는 수정할 수 없습니다.</div></div>
    <div class="row" style="margin-bottom:12px"><b>작성 대기 ${pending.length}건</b><span class="muted">· 완료 ${d.reviews.length - pending.length}건</span></div>
    <div class="grid g3 stagger">${d.reviews.length ? d.reviews.map((r) => html`<div class="card tilt">
      <div class="row">${avatar({ name: r.target_name, hue: r.hue }, 44)}<div class="grow"><b>${r.target_name}</b><div class="muted small">${r.org_name} · ${r.position}</div></div>
        <span class="chip plain">${r.kind === 'sub' ? '하급자 리뷰' : '동료 리뷰'}</span></div>
      <div class="row" style="margin-top:14px">${chip(r.status)}${r.status === 'assigned' && d.open ? html`<button class="btn sm primary right" data-w="${r.id}">${icon('pen-line')}작성하기</button>`
        : html`<span class="right muted small">${Object.values(r.scores).length ? '평균 ' + n1(Object.values(r.scores).reduce((a, b) => a + b, 0) / 5, 1) : ''}</span>`}</div></div>`)
      : html`<div class="card">${empty('users', '지정된 다면평가가 없습니다')}</div>`}</div>`);
  $$('[data-w]', view).forEach((b) => { b.onclick = () => {
    const r = d.reviews.find((x) => x.id === +b.dataset.w);
    modal({ title: `${r.target_name}님 다면평가`, body: html`
      <div class="list">${d.items.map((it) => html`<div><b class="grow">${it}</b>${rating(it, 0)}</div>`)}</div>
      <div class="field"><label>익명 코멘트 (선택)</label><textarea class="textarea" name="c" maxlength="1000" placeholder="구체적인 행동 중심으로 적어 주세요."></textarea></div>`,
    actions: [{ label: '취소', value: null }, { label: '제출', kind: 'primary', value: 'ok' }],
    onOpen: (el) => bindRatings(el),
    onAction: async (_, el) => {
      const scores = readRatings(el);
      if (Object.keys(scores).length < d.items.length) { toast('다섯 항목 모두 평가해 주세요.', 'bad'); return false; }
      await api('/api/me/peer/' + r.id, { method: 'PUT', body: { scores, comment: $('[name=c]', el).value.trim() } });
      toast('다면평가를 제출했습니다.'); peerView(view);
    } });
  }; });
}

// ── 결과 (3D 플립 공개 + 산정 근거) ──
async function resultsView(view, cycleId) {
  const list = await api('/api/me/results');
  if (!list.length) return mount(view, html`${head('내 평가 결과', '결과 공개 단계가 되면 확정 등급과 점수 산정 근거가 공개됩니다.')}<div class="card">${empty('lock', '아직 공개된 결과가 없습니다')}</div>`);
  const r = list.find((x) => x.cycle_id === +cycleId) || list[0], s = r.snapshot;
  const key = 'kpc-reveal-' + r.cycle_id, seen = ls.get(key) === '1';
  const gColor = { S: '#184f95', A: '#3987e5', B: '#64748b', C: '#e34948', D: '#8f2424' }[s.grade];
  const w = s.weights;
  mount(view, html`${head('내 평가 결과', `${r.cycle} · 확정 ${fdate(r.confirmed_at)}`,
    html`<select class="select" style="width:auto" data-cycle>${list.map((x) => html`<option value="${x.cycle_id}" ${x.cycle_id === r.cycle_id ? 'selected' : ''}>${x.cycle} (${x.snapshot.grade})</option>`)}</select>
      <button class="btn" data-print>${icon('printer')}인쇄</button>`)}
    <div class="grid" style="grid-template-columns:auto minmax(0,1fr);align-items:start">
      <div class="col" style="align-items:center">
        <div class="flip ${seen ? 'open' : ''}" data-flip><div class="flip-in">
          <div class="flip-f"><span class="shine"></span>${icon('gift', 'width:54px;height:54px')}<b style="font-size:20px">결과가 도착했어요</b><span style="opacity:.8">카드를 눌러 확인하세요</span></div>
          <div class="flip-b" style="--g:${gColor}"><span class="shine"></span><span style="opacity:.8;font-weight:700">${r.cycle}</span><span class="big">${s.grade}</span>
            <b style="font-size:22px" class="num">${n1(s.final)}점</b><span style="opacity:.8">${s.scheme === 'leader' ? '직책자' : '팀원'} 스킴</span></div>
        </div></div><span class="muted small">등급 기준: ${s.grades.map(([g, c]) => `${g} ${c}↑`).join(' · ')}</span>
      </div>
      <div class="col">
        <div class="card"><div class="card-h">${icon('calculator')}<h3>점수 산정 근거</h3></div>
          <div class="grid g4">${[['공통목표', s.goal, w.goal], ['개인역량', s.comp, w.comp], [s.extra_label, s.extra, w.extra]].map(([l, v, p]) => html`
            <div class="kpi"><span class="l">${l} · ${p}%</span><span class="v num"><span data-count="${v}" data-dec="1">0</span></span>${bar(v)}<span class="muted small num">기여 ${n1((v * p) / 100)}점</span></div>`)}
            <div class="kpi"><span class="l">조정 (±10/회)</span><span class="v num" style="color:${s.adj < 0 ? 'var(--bad)' : s.adj > 0 ? 'var(--ok)' : 'inherit'}">${s.adj > 0 ? '+' : ''}${n1(s.adj)}</span><span class="muted small">합산 ${n1(s.base)} → 최종 ${n1(s.final)}</span></div></div>
          <div class="table-wrap" style="margin-top:16px"><table class="table"><thead><tr><th>목표</th><th>가중치</th><th>달성률</th><th>점수</th><th>산정 방식</th></tr></thead>
            <tbody>${s.goals.map((g) => html`<tr><td>${g.title}</td><td class="num">${g.weight}%</td><td class="num">${g.rate != null ? g.rate + '%' : '–'}</td><td class="num b">${n1(g.score, 0)}</td>
              <td>${g.manual ? chip('submitted', '평가자 채점') : chip('approved', '자동 환산')}</td></tr>`)}</tbody></table></div>
          ${r.adjustments.length ? html`<div class="list" style="margin-top:12px">${r.adjustments.map((a) => html`<div>${icon('scale')}<b class="num">${a.delta > 0 ? '+' : ''}${a.delta}</b><span class="grow muted">${a.reason}</span></div>`)}</div>` : ''}
        </div>
        <div class="grid g2">
          <div class="card"><div class="card-h">${icon('message-circle')}<h3>평가자 의견</h3></div>
            <div class="col"><div><div class="muted small b">1차 평가 종합 의견</div><p style="margin:4px 0 0">${r.first_comment || '–'}</p></div>
            <div><div class="muted small b">2차 검토 의견</div><p style="margin:4px 0 0">${r.second_comment || '–'}</p></div></div></div>
          <div class="card"><div class="card-h">${icon('users')}<h3>다면평가 익명 요약</h3><span class="right muted small">${r.peer.count}/${r.peer.assigned}명 응답</span></div>
            ${r.peer.count ? html`<div class="list">${Object.entries(r.peer.avg).map(([k, v]) => html`<div><b style="width:56px">${k}</b><div class="grow">${bar((v / 5) * 100, 'var(--s3)')}</div><span class="num b">${n1(v, 2)}</span></div>`)}</div>
              ${r.peer.comments.slice(0, 4).map((c) => html`<div class="callout" style="margin-top:8px">${icon('quote')}${c}</div>`)}` : empty('users', '응답이 없습니다')}</div>
        </div>
      </div>
    </div>`);
  $('[data-cycle]', view).onchange = (e) => { location.hash = '#/results/' + e.target.value; };
  $('[data-print]', view).onclick = () => print();
  $('[data-flip]', view).onclick = (e) => {
    const f = e.currentTarget; if (f.classList.contains('open')) return;
    f.classList.add('open'); ls.set(key, '1'); setTimeout(() => confetti(['S', 'A'].includes(s.grade) ? 160 : 70), 500);
  };
}

start({ page: 'me', menu: MENUS.me, routes: {
  home: async (v) => dashboard(v, { page: 'me', catalog: CATALOG.me, defaults: DEFAULTS.me, data: await api('/api/me/dash'), title: '내 평가 홈', sub: '나의 목표, 평가 진행 상황, 결과를 한 화면에서 확인하세요.' }),
  goals: goalsView, self: selfView, peer: peerView, results: resultsView, kudos: kudosView,
} });
