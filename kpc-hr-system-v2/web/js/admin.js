// 관리자(HR) 페이지 — 성과 홈 · 주기/단계 · 평가 관계 · 조직·KPI · 다면평가 · 조정·확정 · 집계 · 사용자 · 재작성 · 공지 · 감사
import { $, $$, ago, api, askText, avatar, bar, chip, confirmBox, dashboard, distChart, download, empty, fdate, formData, grade, head, html, icon, modal, mount, n1, S, start, toast } from './core.js';
import { CATALOG, DEFAULTS, MENUS } from './catalog.js';
import { studioView } from './studio.js';

const sortable = (el, opts) => window.Sortable.create(el, { animation: 180, ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen', ...opts });
const opt = (v, label, sel) => html`<option value="${v ?? ''}" ${sel ? 'selected' : ''}>${label}</option>`;

// ── 평가 주기 · 단계 · 규칙 · 항목 ──
async function cyclesView(view) {
  const list = await api('/api/ad/cycles');
  const c = list.find((x) => x.active) || list[0], cfg = c.config, ph = S.boot.phases, idx = ph.findIndex((p) => p.key === c.phase);
  mount(view, html`${head('평가 주기', '주기를 만들고 비중·등급 기준·배분 가이드·평가 항목을 확정한 뒤, 단계를 수동으로 전환합니다.',
    html`<button class="btn" data-new>${icon('plus')}새 주기</button>`)}
    <div class="row wrap" style="margin-bottom:16px">${list.map((x) => html`<button class="btn ${x.id === c.id ? 'primary' : ''}" data-act-cycle="${x.id}" ${x.active ? 'disabled' : ''}>
      ${x.active ? icon('radio') : icon('archive')}${x.name} · ${x.phase_label} <span class="faint small">${x.people}명</span></button>`)}</div>
    <div class="card" style="margin-bottom:16px"><div class="card-h">${icon('milestone')}<h3>${c.name} — 단계 전환</h3><span class="right muted small">단계를 누르면 전환합니다. 자동으로 넘어가지 않습니다.</span></div>
      <div class="stepper">${ph.map((p, i) => html`<div class="step ${i < idx ? 'done' : i === idx ? 'now' : ''}" style="cursor:pointer" data-phase="${p.key}">
        <i>${i < idx ? icon('check', 'width:14px;height:14px') : i + 1}</i>${p.label}<div class="faint small">${cfg.schedule?.[p.key] ? '~' + fdate(cfg.schedule[p.key]).slice(5) : ''}</div></div>`)}</div></div>
    <form class="grid g2" id="cfg">
      <div class="card"><div class="card-h">${icon('percent')}<h3>영역 비중 (스킴)</h3><span class="right small" id="wsum"></span></div>
        <table class="table"><thead><tr><th>영역</th><th>팀원</th><th>직책자</th></tr></thead><tbody>
        ${[['goal', '공통목표 (KPI)'], ['comp', '개인역량'], ['extra', '자기개발·조직관리']].map(([k, l]) => html`<tr><td>${l}</td>
          <td><input class="input sm num" type="number" min="0" max="100" name="w.member.${k}" value="${cfg.weights.member[k]}"></td>
          <td><input class="input sm num" type="number" min="0" max="100" name="w.leader.${k}" value="${cfg.weights.leader[k]}"></td></tr>`)}</tbody></table>
        <div class="field" style="margin-top:12px"><label>직책자 판정 직책 (쉼표 구분)</label><input class="input" name="duties" value="${cfg.leader_duties.join(', ')}"></div></div>
      <div class="card"><div class="card-h">${icon('award')}<h3>등급 기준 · 배분 가이드</h3><span class="right small" id="gsum"></span></div>
        <table class="table"><thead><tr><th>등급</th><th>최소 점수</th><th>배분 가이드 %</th></tr></thead><tbody>
        ${cfg.grades.map(([g, cut], i) => html`<tr><td>${grade(g)}</td><td><input class="input sm num" type="number" min="0" max="100" name="g.${i}" value="${cut}" ${i === cfg.grades.length - 1 ? 'readonly' : ''}></td>
          <td><input class="input sm num" type="number" min="0" max="100" name="d.${g}" value="${cfg.guide[g] ?? 0}"></td></tr>`)}</tbody></table></div>
      <div class="card"><div class="card-h">${icon('arrow-right-left')}<h3>달성률 환산표</h3><span class="right muted small">정량 목표 · 상한 150%</span></div>
        <table class="table"><thead><tr><th>달성률 이상(%)</th><th>환산 점수</th></tr></thead><tbody>
        ${cfg.conv.map(([t, sc], i) => html`<tr><td><input class="input sm num" type="number" name="c.t.${i}" value="${t}" ${i === cfg.conv.length - 1 ? 'readonly' : ''}></td><td><input class="input sm num" type="number" name="c.s.${i}" value="${sc}"></td></tr>`)}</tbody></table></div>
      <div class="card"><div class="card-h">${icon('calendar-range')}<h3>기간 · 단계 마감일</h3></div>
        <div class="grid g2"><div class="field"><label>주기 이름</label><input class="input" name="name" value="${c.name}"></div>
          <div class="row"><div class="field grow"><label>시작</label><input class="input" type="date" name="start" value="${c.start_date}"></div><div class="field grow"><label>종료</label><input class="input" type="date" name="end" value="${c.end_date}"></div></div>
          ${ph.map((p) => html`<div class="field"><label>${p.label} 마감</label><input class="input sm" type="date" name="s.${p.key}" value="${cfg.schedule?.[p.key] || ''}"></div>`)}</div></div>
    </form>
    <div class="card" style="margin-top:16px"><div class="card-h">${icon('list-tree')}<h3>평가 항목</h3><span class="right muted small">끌어서 순서·영역 변경 · 평가 진행 이후에는 잠김</span></div>
      <div class="grid g3">${[['comp', '개인역량'], ['dev', '자기개발 (팀원)'], ['mgmt', '조직관리 (직책자)']].map(([a, l]) => html`<div class="lane" style="flex:auto;max-height:none">
        <div class="lane-h">${l}<button class="btn sm ghost right" data-additem="${a}">${icon('plus')}</button></div>
        <div class="lane-b" data-area="${a}">${c.items.filter((i) => i.area === a).map((i) => itemRow(i))}</div></div>`)}</div>
      <div class="row" style="margin-top:12px"><span class="right"></span><button class="btn" data-saveitems>${icon('save')}항목 저장</button></div></div>
    <div class="sticky-bar">${icon('settings-2')}<span class="muted small">비중·가이드 합계는 각각 100%여야 저장됩니다.</span><button class="btn primary right" data-savecfg>${icon('save')}규칙 저장</button></div>`);
  const sums = () => {
    const f = formData($('#cfg', view)), s = (p) => ['goal', 'comp', 'extra'].reduce((a, k) => a + +f[`w.${p}.${k}`], 0);
    const g = cfg.grades.reduce((a, [k]) => a + +f[`d.${k}`], 0);
    $('#wsum', view).innerHTML = String(html`팀원 <b style="color:${s('member') === 100 ? 'var(--ok)' : 'var(--bad)'}">${s('member')}%</b> · 직책자 <b style="color:${s('leader') === 100 ? 'var(--ok)' : 'var(--bad)'}">${s('leader')}%</b>`);
    $('#gsum', view).innerHTML = String(html`가이드 합계 <b style="color:${g === 100 ? 'var(--ok)' : 'var(--bad)'}">${g}%</b>`);
  };
  sums(); $('#cfg', view).oninput = sums;
  $$('[data-area]', view).forEach((el) => sortable(el, { group: 'items', handle: '[data-handle]' }));
  $$('[data-additem]', view).forEach((b) => { b.onclick = () => { const lane = $(`[data-area=${b.dataset.additem}]`, view); lane.insertAdjacentHTML('beforeend', String(itemRow({ name: '', description: '' }))); window.lucide.createIcons(); }; });
  view.addEventListener('click', (e) => { const d = e.target.closest('[data-delitem]'); if (d) d.closest('[data-item]').remove(); });
  $('[data-saveitems]', view).onclick = async () => {
    const items = $$('[data-area]', view).flatMap((lane) => $$('[data-item]', lane).map((r) => ({ id: +r.dataset.item || null, area: lane.dataset.area, name: $('[name=n]', r).value.trim(), description: $('[name=dsc]', r).value.trim() })));
    await api(`/api/ad/cycles/${c.id}/items`, { method: 'PUT', body: { items } }); toast('평가 항목을 저장했습니다.'); cyclesView(view);
  };
  $('[data-savecfg]', view).onclick = async () => {
    const f = formData($('#cfg', view)), n = (k) => +f[k];
    const config = {
      weights: Object.fromEntries(['member', 'leader'].map((p) => [p, { goal: n(`w.${p}.goal`), comp: n(`w.${p}.comp`), extra: n(`w.${p}.extra`) }])),
      grades: cfg.grades.map(([g], i) => [g, n(`g.${i}`)]), guide: Object.fromEntries(cfg.grades.map(([g]) => [g, n(`d.${g}`)])),
      conv: cfg.conv.map((_, i) => [n(`c.t.${i}`), n(`c.s.${i}`)]), leader_duties: f.duties.split(',').map((x) => x.trim()).filter(Boolean),
      schedule: Object.fromEntries(ph.map((p) => [p.key, f[`s.${p.key}`]]).filter(([, v]) => v)),
    };
    await api('/api/ad/cycles/' + c.id, { method: 'PUT', body: { name: f.name, start_date: f.start, end_date: f.end, config } }); toast('평가 규칙을 저장했습니다.');
  };
  $$('[data-phase]', view).forEach((s) => { s.onclick = async () => {
    const p = ph.find((x) => x.key === s.dataset.phase);
    if (p.key === c.phase || !(await confirmBox('단계 전환', `'${p.label}' 단계로 전환할까요?\n전환하면 모든 대상자에게 알림이 발송되고, 화면에서 할 수 있는 작업이 바뀝니다.`))) return;
    await api(`/api/ad/cycles/${c.id}/phase`, { method: 'POST', body: { phase: p.key } }); toast(`'${p.label}' 단계로 전환했습니다.`); location.reload();
  }; });
  $$('[data-act-cycle]', view).forEach((b) => { b.onclick = async () => {
    if (!(await confirmBox('진행 주기 변경', '이 주기를 진행 중인 주기로 지정할까요? 모든 화면이 이 주기 기준으로 바뀝니다.'))) return;
    await api(`/api/ad/cycles/${b.dataset.actCycle}/activate`, { method: 'POST' }); location.reload();
  }; });
  $('[data-new]', view).onclick = () => modal({ title: '새 평가 주기', body: html`
    <div class="field"><label>이름</label><input class="input" name="name" placeholder="2027 상반기 성과평가"></div>
    <div class="row"><div class="field grow"><label>시작일</label><input class="input" type="date" name="start_date"></div><div class="field grow"><label>종료일</label><input class="input" type="date" name="end_date"></div></div>
    <div class="field"><label>규칙·항목·평가 관계</label><select class="select" name="copy_from">${opt('', '기본값 + 조직장 기준 자동 배정')}${list.map((x) => opt(x.id, `'${x.name}'에서 복사`))}</select></div>`,
  actions: [{ label: '취소', value: null }, { label: '만들기', kind: 'primary', value: 'ok' }],
  onAction: async (_, el) => { const f = formData(el); await api('/api/ad/cycles', { method: 'POST', body: { ...f, copy_from: f.copy_from ? +f.copy_from : null } }); toast('주기를 만들었습니다. 활성화하면 진행 주기가 됩니다.'); cyclesView(view); } });
}
const itemRow = (i) => html`<div class="pcard" data-item="${i.id || ''}" style="cursor:default;flex-direction:column;align-items:stretch;gap:6px">
  <div class="row"><span data-handle style="cursor:grab;color:var(--faint)">${icon('grip-vertical')}</span><input class="input sm grow" name="n" value="${i.name}" placeholder="항목명"><button type="button" class="btn sm ghost" data-delitem>${icon('x')}</button></div>
  <input class="input sm" name="dsc" value="${i.description || ''}" placeholder="행동 지표 설명"></div>`;

// ── 평가 관계: 1차 평가자 레인 드래그앤드롭 ──
async function relationsView(view) {
  const [d, orgs] = await Promise.all([api('/api/ad/relations'), api('/api/ad/orgs')]);
  const by = Object.fromEntries(d.people.map((p) => [p.id, p]));
  const heads = new Set(orgs.map((o) => o.head_id).filter(Boolean));
  const laneIds = [...new Set([...d.people.map((p) => p.first_id).filter(Boolean), ...heads])].filter((id) => by[id]);
  let mode = 'board';
  const card = (p) => html`<div class="pcard ${p.first_status === 'submitted' ? 'locked' : ''}" data-uid="${p.id}" title="${p.first_status === 'submitted' ? '1차 평가 제출됨 · 변경 불가' : '끌어서 평가자 변경'}">
    ${avatar(p, 30)}<div class="grow" style="min-width:0"><b>${p.name}</b><div class="muted small ellipsis">${p.org_name} · ${p.position}${p.duty ? ' · ' + p.duty : ''}</div></div>
    ${p.manual ? html`<span class="chip warn plain" title="수동 지정">수동</span>` : ''}${p.scheme === 'leader' ? html`<span class="chip info plain">직책</span>` : ''}</div>`;
  const draw = () => {
    const un = d.people.filter((p) => !p.first_id && p.duty !== '대표이사');
    mount($('#rel', view), mode === 'board' ? html`<div class="board">
      ${un.length ? html`<div class="lane" style="border-color:var(--bad)"><div class="lane-h">${icon('user-x', 'color:var(--bad)')}미지정 <span class="badge">${un.length}</span></div><div class="lane-b" data-lane="">${un.map(card)}</div></div>` : ''}
      ${laneIds.map((id) => { const ev = by[id], mem = d.people.filter((p) => p.first_id === id); return html`<div class="lane"><div class="lane-h">${avatar(ev, 26)}<div class="grow" style="min-width:0"><div class="ellipsis">${ev.name}</div><div class="muted small ellipsis" style="font-weight:600">${ev.org_name} · ${ev.duty || ev.position}</div></div><span class="chip plain">${mem.length}</span></div>
        <div class="lane-b" data-lane="${id}">${mem.length ? mem.map(card) : html`<div class="drop-hint">여기로 끌어 놓기</div>`}</div></div>`; })}</div>`
      : html`<div class="table-wrap"><table class="table"><thead><tr><th>피평가자</th><th>1차 평가자</th><th>2차 평가자</th><th>평가 스킴</th><th>상태</th></tr></thead><tbody>
      ${d.people.filter((p) => p.duty !== '대표이사').map((p) => html`<tr data-row="${p.id}"><td><div class="row">${avatar(p, 28)}<div><b>${p.name}</b><div class="muted small">${p.org_name} · ${p.position}${p.duty ? ' · ' + p.duty : ''}</div></div></div></td>
        <td><select class="select sm" name="first_id" ${p.first_status === 'submitted' ? 'disabled' : ''}>${opt('', '— 선택 —')}${laneIds.filter((i) => i !== p.id).map((i) => opt(i, `${by[i].name} (${by[i].org_name})`, i === p.first_id))}</select></td>
        <td><select class="select sm" name="second_id" ${p.first_status === 'submitted' ? 'disabled' : ''}>${opt('', '없음')}${laneIds.filter((i) => i !== p.id).map((i) => opt(i, `${by[i].name} (${by[i].org_name})`, i === p.second_id))}</select></td>
        <td><select class="select sm" name="scheme" ${p.first_status === 'submitted' ? 'disabled' : ''}>${opt('member', '팀원 스킴', p.scheme === 'member')}${opt('leader', '직책자 스킴', p.scheme === 'leader')}</select>${p.scheme_manual ? html` <span class="chip warn plain">수동</span>` : ''}</td>
        <td>${p.first_status === 'submitted' ? chip('submitted', '1차 제출 · 잠김') : p.manual ? chip('revise', '수동 지정') : chip('approved', '자동')}</td></tr>`)}</tbody></table></div>`);
    $$('[data-lane]', view).forEach((lane) => sortable(lane, { group: { name: 'rel', put: lane.dataset.lane !== '' }, filter: '.locked,.drop-hint', sort: false,
      onAdd: async (e) => {
        const uid = +e.item.dataset.uid, p = by[uid], first = +e.to.dataset.lane, sec = by[first]?.first_id;
        try {
          await api('/api/ad/relations/' + uid, { method: 'PUT', body: { first_id: first, second_id: sec && sec !== uid ? sec : null, scheme: p.scheme || 'member', scheme_manual: !!p.scheme_manual } });
          toast(`${p.name} → 1차 ${by[first].name}`);
        } catch { /* 토스트 표시됨 */ }
        relationsView(view);
      } }));
  };
  mount(view, html`${head('평가 관계', '소속 조직장=1차, 상위 조직장=2차가 기본입니다. 카드를 다른 평가자 레인으로 끌어 놓으면 수동 지정됩니다.',
    html`<div class="seg"><button data-mode="board" class="on">${icon('kanban')}보드</button><button data-mode="table">${icon('table')}목록</button></div>
      <button class="btn" data-auto>${icon('wand-sparkles')}자동 배정 (수동 유지)</button><button class="btn danger" data-force>${icon('refresh-cw')}전체 재배정</button>`)}
    <div class="callout tip" style="margin-bottom:14px">${icon('shield-check')}본인 지정, 1차=2차, 순환(A→B→A) 관계는 자동으로 거부됩니다. 1차 평가가 제출된 인원은 잠깁니다.</div><div id="rel"></div>`);
  $$('[data-mode]', view).forEach((b) => { b.onclick = () => { mode = b.dataset.mode; $$('[data-mode]', view).forEach((x) => x.classList.toggle('on', x === b)); draw(); }; });
  view.onchange = async (e) => {
    const tr = e.target.closest('[data-row]'); if (!tr) return;
    const f = formData(tr), p = by[+tr.dataset.row];
    try { await api('/api/ad/relations/' + p.id, { method: 'PUT', body: { first_id: +f.first_id || null, second_id: +f.second_id || null, scheme: f.scheme, scheme_manual: e.target.name === 'scheme' || !!p.scheme_manual } }); toast('평가 관계를 저장했습니다.'); }
    catch { /* 토스트 */ }
    const fresh = await api('/api/ad/relations'); d.people = fresh.people; Object.assign(by, Object.fromEntries(d.people.map((x) => [x.id, x]))); draw();
  };
  const auto = async (force) => {
    if (force && !(await confirmBox('전체 재배정', '수동 지정을 포함해 조직도 기준으로 다시 배정합니다. (1차 제출 인원 제외)', true))) return;
    const r = await api('/api/ad/relations/auto' + (force ? '?force=true' : ''), { method: 'POST' }); toast(`${r.assigned}명 배정했습니다.`); relationsView(view);
  };
  $('[data-auto]', view).onclick = () => auto(false);
  $('[data-force]', view).onclick = () => auto(true);
  draw();
}

// ── 조직 · KPI ──
async function orgsView(view) {
  const [orgs, kpis, users] = await Promise.all([api('/api/ad/orgs'), api('/api/ad/kpis'), api('/api/ad/users')]);
  const depth = (o, n = 0) => (o.parent_id ? depth(orgs.find((x) => x.id === o.parent_id) || {}, n + 1) : n);
  const tree = [], walk = (pid) => orgs.filter((o) => (o.parent_id || null) === pid).forEach((o) => { tree.push(o); walk(o.id); });
  walk(null);
  const active = users.filter((u) => u.status === 'active');
  mount(view, html`${head('조직·KPI', '조직도(전사→본부→팀)와 조직 KPI 트리를 관리합니다. 개인 목표는 KPI에 연결되어 정렬도로 집계됩니다.',
    html`<button class="btn" data-addorg>${icon('plus')}조직 추가</button><button class="btn primary" data-addkpi>${icon('plus')}KPI 추가</button>`)}
    <div class="grid" style="grid-template-columns:minmax(0,5fr) minmax(0,7fr);align-items:start">
      <div class="card"><div class="card-h">${icon('network')}<h3>조직도</h3></div><div class="list">${tree.map((o) => html`<div style="padding-left:${depth(o) * 22 + 4}px">
        ${icon(depth(o) ? 'corner-down-right' : 'building-2', 'color:var(--faint)')}<div class="grow"><b>${o.name}</b> <span class="chip plain">${o.level}</span><div class="muted small">조직장 ${o.head_name || '미지정'} · ${o.members}명</div></div>
        <button class="btn sm ghost" data-editorg="${o.id}">${icon('pencil')}</button></div>`)}</div></div>
      <div class="card"><div class="card-h">${icon('flag')}<h3>조직 KPI</h3><span class="right muted small">연결 목표 수 · 달성률</span></div><div class="list">${tree.map((o) => kpis.filter((k) => k.org_id === o.id).map((k) => html`
        <div style="padding-left:${depth(o) * 18 + 4}px"><div class="grow"><div class="small muted">${o.name}</div><b>${k.title}</b><div style="margin-top:6px">${bar(Math.min(100, k.achievement || 0))}</div></div>
        <span class="num small" style="width:56px;text-align:right">${k.achievement != null ? k.achievement + '%' : '–'}</span><span class="chip info plain" title="연결된 개인 목표">${k.linked}</span>
        <button class="btn sm ghost" data-editkpi="${k.id}">${icon('pencil')}</button></div>`))}</div></div></div>`);
  const orgForm = (o) => modal({ title: o ? '조직 편집' : '조직 추가', body: html`
    <div class="field"><label>조직명</label><input class="input" name="name" value="${o?.name || ''}"></div>
    <div class="row"><div class="field grow"><label>상위 조직</label><select class="select" name="parent_id">${opt('', '없음 (최상위)')}${orgs.filter((x) => x.id !== o?.id).map((x) => opt(x.id, x.name, x.id === o?.parent_id))}</select></div>
      <div class="field" style="width:140px"><label>레벨</label><select class="select" name="level">${['전사', '본부', '그룹', '부서', '팀', '섹션'].map((l) => opt(l, l, l === (o?.level || '팀')))}</select></div></div>
    <div class="field"><label>조직장 (1차 평가자 자동 배정 기준)</label><select class="select" name="head_id">${opt('', '미지정')}${active.map((u) => opt(u.id, `${u.name} · ${u.org_name || ''} ${u.position}`, u.id === o?.head_id))}</select></div>
    ${o ? html`<button type="button" class="btn danger sm" data-delorg style="align-self:flex-start">${icon('trash-2')}조직 삭제</button>` : ''}`,
  actions: [{ label: '취소', value: null }, { label: '저장', kind: 'primary', value: 'ok' }],
  onOpen: (el) => { $('[data-delorg]', el)?.addEventListener('click', async () => { await api('/api/ad/orgs/' + o.id, { method: 'DELETE' }); toast('삭제했습니다.'); el.remove(); orgsView(view); }); },
  onAction: async (_, el) => { const f = formData(el); const body = { ...f, parent_id: +f.parent_id || null, head_id: +f.head_id || null };
    await api(o ? '/api/ad/orgs/' + o.id : '/api/ad/orgs', { method: o ? 'PUT' : 'POST', body }); toast('저장했습니다. 미제출 인원의 평가자가 재계산됩니다.'); orgsView(view); } });
  const kpiForm = (k) => modal({ title: k ? 'KPI 편집' : 'KPI 추가', body: html`
    <div class="field"><label>KPI</label><input class="input" name="title" value="${k?.title || ''}"></div>
    <div class="row"><div class="field grow"><label>조직</label><select class="select" name="org_id">${tree.map((o) => opt(o.id, ' '.repeat(depth(o) * 3) + o.name, o.id === k?.org_id))}</select></div>
      <div class="field grow"><label>상위 KPI</label><select class="select" name="parent_id">${opt('', '없음')}${kpis.filter((x) => x.id !== k?.id).map((x) => opt(x.id, `${x.org_name} · ${x.title}`, x.id === k?.parent_id))}</select></div></div>
    <div class="row"><div class="field grow"><label>가중치 %</label><input class="input" type="number" name="weight" value="${k?.weight ?? 0}"></div>
      <div class="field grow"><label>실제 달성률 %</label><input class="input" type="number" step="0.1" name="achievement" value="${k?.achievement ?? ''}"></div>
      <div class="field grow"><label>목표 기준</label><input class="input" name="target" value="${k?.target || ''}"></div></div>
    ${k ? html`<button type="button" class="btn danger sm" data-delkpi style="align-self:flex-start">${icon('trash-2')}KPI 삭제</button>` : ''}`,
  actions: [{ label: '취소', value: null }, { label: '저장', kind: 'primary', value: 'ok' }],
  onOpen: (el) => { $('[data-delkpi]', el)?.addEventListener('click', async () => { await api('/api/ad/kpis/' + k.id, { method: 'DELETE' }); toast('삭제했습니다.'); el.remove(); orgsView(view); }); },
  onAction: async (_, el) => { const f = formData(el);
    const body = { ...f, org_id: +f.org_id, parent_id: +f.parent_id || null, weight: +f.weight || 0, achievement: f.achievement === '' ? null : +f.achievement };
    await api(k ? '/api/ad/kpis/' + k.id : '/api/ad/kpis', { method: k ? 'PUT' : 'POST', body }); toast('저장했습니다.'); orgsView(view); } });
  $('[data-addorg]', view).onclick = () => orgForm(null);
  $('[data-addkpi]', view).onclick = () => kpiForm(null);
  $$('[data-editorg]', view).forEach((b) => { b.onclick = () => orgForm(orgs.find((o) => o.id === +b.dataset.editorg)); });
  $$('[data-editkpi]', view).forEach((b) => { b.onclick = () => kpiForm(kpis.find((k) => k.id === +b.dataset.editkpi)); });
}

// ── 다면평가 관리 ──
async function peerView(view) {
  const d = await api('/api/ad/peer');
  mount(view, html`${head('다면평가 관리', `동료(같은 조직) 최대 3명 + 하급자(조직장인 경우) 최대 3명을 자동 배정합니다. 회수율 ${d.total ? Math.round((d.submitted / d.total) * 100) : 0}% (${d.submitted}/${d.total})`,
    html`<button class="btn primary" data-auto>${icon('wand-sparkles')}리뷰어 자동 배정</button>`)}
    <div class="table-wrap"><table class="table"><thead><tr><th>대상자</th><th>리뷰어 (익명 처리됨 · HR만 열람)</th><th>응답</th><th>익명 평균</th><th></th></tr></thead><tbody>
    ${d.people.map((p) => { const done = p.reviewers.filter((r) => r.status === 'submitted').length, avg = Object.values(p.summary).filter((v) => v != null);
      return html`<tr><td><div class="row">${avatar(p, 28)}<div><b>${p.name}</b><div class="muted small">${p.org_name}</div></div></div></td>
      <td><div class="row wrap" style="gap:4px">${p.reviewers.map((r) => html`<span class="chip ${r.status === 'submitted' ? 'ok' : 'muted'}">${r.kind === 'sub' ? '하' : '동'} · ${r.reviewer_name}
        ${r.status !== 'submitted' ? html`<button class="btn sm ghost" style="height:18px;padding:0 2px" data-del="${r.id}" aria-label="삭제">${icon('x', 'width:12px;height:12px')}</button>` : ''}</span>`)}</div></td>
      <td class="num">${done}/${p.reviewers.length}</td><td class="num b">${avg.length ? n1(avg.reduce((a, b) => a + b, 0) / avg.length, 2) : '–'}</td>
      <td><button class="btn sm" data-add="${p.id}">${icon('user-plus')}추가</button></td></tr>`; })}</tbody></table></div>`);
  $('[data-auto]', view).onclick = async () => { const r = await api('/api/ad/peer/auto', { method: 'POST' }); toast(`${r.assigned}건 새로 배정했습니다. (기존 지정 유지)`); peerView(view); };
  view.onclick = async (e) => {
    const del = e.target.closest('[data-del]'), add = e.target.closest('[data-add]');
    if (del) { await api('/api/ad/peer/' + del.dataset.del, { method: 'DELETE' }); toast('삭제했습니다.'); peerView(view); }
    if (add) {
      const people = await api('/api/people');
      modal({ title: '리뷰어 수동 추가', body: html`<div class="field"><label>리뷰어</label><select class="select" name="rid">${people.filter((x) => x.id !== +add.dataset.add).map((x) => opt(x.id, `${x.name} · ${x.org_name}`))}</select></div>
        <div class="field"><label>구분</label><select class="select" name="kind">${opt('peer', '동료')}${opt('sub', '하급자')}</select></div>`,
      actions: [{ label: '취소', value: null }, { label: '추가', kind: 'primary', value: 'ok' }],
      onAction: async (_, el) => { const f = formData(el); await api('/api/ad/peer', { method: 'POST', body: { target_id: +add.dataset.add, reviewer_id: +f.rid, kind: f.kind } }); toast('추가했습니다.'); peerView(view); } });
    }
  };
}

// ── 조정 · 확정: 등급 보드 드래그 → 조정 등록 ──
async function calibView(view) {
  const d = await api('/api/ad/calib');
  const orgs = [...new Set(d.team.map((p) => p.org_name))];
  let org = '';
  const cuts = Object.fromEntries(d.grades), order = d.grades.map(([g]) => g);
  const draw = () => {
    const team = d.team.filter((p) => !org || p.org_name === org);
    const dist = Object.fromEntries(order.map((g) => [g, team.filter((p) => p.grade === g).length]));
    const ready = team.filter((p) => p.complete && !p.confirmed);
    const pc = (p) => html`<div class="pcard ${p.confirmed ? 'locked' : ''}" data-uid="${p.id}">
      ${d.phase === 'calib' && !p.confirmed ? html`<input type="checkbox" data-pick="${p.id}" style="accent-color:var(--brand)">` : ''}
      ${avatar(p, 30)}<div class="grow" style="min-width:0"><b>${p.name}</b><div class="muted small ellipsis">${p.org_name} · ${p.position}</div></div>
      <div style="text-align:right"><b class="num">${n1(p.final)}</b><div class="small ${p.adj ? '' : 'faint'} num" style="color:${p.adj < 0 ? 'var(--bad)' : p.adj > 0 ? 'var(--ok)' : ''}">${p.adj ? (p.adj > 0 ? '+' : '') + p.adj : '±0'}${p.peer_avg ? ` · 360 ${p.peer_avg}` : ''}</div></div>
      ${p.confirmed ? icon('lock', 'width:14px;color:var(--faint)') : ''}</div>`;
    mount($('#cal', view), html`
      <div class="grid g2" style="margin-bottom:16px">
        <div class="card"><div class="card-h">${icon('chart-column')}<h3>분포 vs 가이드</h3></div><div style="position:relative;height:200px"><canvas></canvas></div></div>
        <div class="card col"><div class="row"><b>확정 대기</b><span class="badge right" style="background:var(--brand)">${ready.length}</span></div>
          <p class="muted small" style="margin:0">${d.phase === 'calib' ? '체크한 인원 또는 산정 완료 전원을 확정합니다. 산정 미완은 자동 제외되며, 확정 시점 규칙이 스냅샷으로 저장됩니다.' : "확정은 '조정·확정' 단계에서 가능합니다. 조정 등록은 평가 진행 단계부터 가능합니다."}</p>
          <div class="grid g3">${order.map((g) => html`<div class="row small">${grade(g)}<span class="num"><b>${dist[g]}</b>명 · 가이드 ${Math.round((d.guide[g] / 100) * team.filter((p) => p.grade).length)}명</span></div>`)}</div>
          <div class="row" style="margin-top:auto"><button class="btn grow" data-confirm-sel ${d.phase === 'calib' ? '' : 'disabled'}>선택 확정</button><button class="btn primary grow" data-confirm-all ${d.phase === 'calib' && ready.length ? '' : 'disabled'}>${icon('badge-check')}일괄 확정</button></div></div></div>
      <div class="board fit">${order.map((g) => html`<div class="lane grade-col"><div class="lane-h">${grade(g)}<span class="grow small">${cuts[g]}점↑</span>
        <span class="chip plain">${dist[g]}명 · ${d.guide[g]}%</span></div><div class="lane-b" data-grade="${g}">${team.filter((p) => p.grade === g).sort((a, b) => b.final - a.final).map(pc)}</div></div>`)}
        <div class="lane" style="opacity:.8"><div class="lane-h">${icon('hourglass')}<span class="grow small">산정 미완</span><span class="chip plain">${team.filter((p) => !p.grade).length}명</span></div>
          <div class="lane-b">${team.filter((p) => !p.grade).map((p) => html`<div class="pcard locked" title="${p.missing.join(' · ')}">${avatar(p, 26)}<div class="grow" style="min-width:0"><b>${p.name}</b><div class="muted small ellipsis">${p.missing[0] || ''}</div></div></div>`)}</div></div></div>`);
    distChart($('canvas', view), dist, d.guide);
    $$('[data-grade]', view).forEach((lane) => sortable(lane, { group: 'calib', filter: '.locked,input', preventOnFilter: false, sort: false,
      onAdd: async (e) => {
        const p = d.team.find((x) => x.id === +e.item.dataset.uid), to = e.to.dataset.grade, i = order.indexOf(to);
        const target = order.indexOf(p.grade) > i ? cuts[to] : cuts[order[i - 1]] - 0.5;
        const delta = Math.round((target - p.final) * 10) / 10;
        if (Math.abs(delta) > 10) { toast(`${to} 등급까지 ${delta}점이 필요합니다. 1회 조정은 ±10점까지입니다.`, 'bad'); return calibView(view); }
        const reason = await askText(`${p.name}: ${p.grade} → ${to} (${delta > 0 ? '+' : ''}${delta}점 조정)`, { label: '조정 사유 (이력에 남습니다)' });
        if (reason) { try { await api('/api/rv/adjust/' + p.id, { method: 'POST', body: { delta, reason } }); toast('조정을 등록했습니다.'); } catch { /* 토스트 */ } }
        calibView(view);
      } }));
    const confirmIds = async (ids) => {
      if (!ids.length) return toast('확정할 인원을 선택해 주세요.', 'bad');
      if (!(await confirmBox('결과 확정', `${ids.length}명의 결과를 확정합니다. 확정 이후에는 재작성 요청으로만 수정할 수 있습니다.`))) return;
      const r = await api('/api/ad/confirm', { method: 'POST', body: { user_ids: ids } });
      toast(`${r.confirmed}명 확정${r.skipped.length ? ` · ${r.skipped.length}명 산정 미완 제외` : ''}`); calibView(view);
    };
    $('[data-confirm-sel]', view).onclick = () => confirmIds($$('[data-pick]:checked', view).map((c) => +c.dataset.pick));
    $('[data-confirm-all]', view).onclick = () => confirmIds(ready.map((p) => p.id));
  };
  mount(view, html`${head('조정·확정', '카드를 다른 등급 열로 끌어 놓으면 필요한 조정 점수(±10 이내)가 계산되어 사유와 함께 등록됩니다. 다면평가 평균을 참고하세요.',
    html`<select class="select" style="width:180px" data-org>${opt('', '전체 조직')}${orgs.map((o) => opt(o, o))}</select><a class="btn" href="/api/ad/export.csv">${icon('download')}CSV 내보내기</a>`)}<div id="cal"></div>`);
  $('[data-org]', view).onchange = (e) => { org = e.target.value; draw(); };
  draw();
}

// ── 집계현황 ──
async function statsView(view) {
  const list = await api('/api/ad/stats');
  const pct = (a, n) => html`<div style="min-width:90px">${bar((a / (n || 1)) * 100)}<span class="small num">${a}/${n}</span></div>`;
  mount(view, html`${head('집계현황', '조직별 진행률·정렬도(KPI 연결 비율)·평균 점수를 확인합니다. 행을 누르면 구성원별 상태가 펼쳐집니다.', html`<a class="btn" href="/api/ad/export.csv">${icon('download')}결과 CSV</a>`)}
    <div class="table-wrap"><table class="table"><thead><tr><th>조직</th><th>인원</th><th>목표 승인</th><th>자기평가</th><th>1차</th><th>2차</th><th>확정</th><th>정렬도</th><th>평균</th></tr></thead><tbody>
    ${list.map((o, i) => html`<tr data-o="${i}" style="cursor:pointer"><td><b>${o.org}</b></td><td class="num">${o.n}</td><td>${pct(o.goal, o.n)}</td><td>${pct(o.self, o.n)}</td><td>${pct(o.first, o.n)}</td>
      <td>${pct(o.second, o.n)}</td><td>${pct(o.confirmed, o.n)}</td><td class="num b">${o.align}%</td><td class="num b">${n1(o.avg)}</td></tr>
      <tr hidden data-detail="${i}"><td colspan="9" style="background:var(--surface-2)"><div class="grid g3">${o.people.map((p) => html`<div class="row small">${avatar(p, 24)}<b>${p.name}</b>
        ${p.goals.count ? '' : html`<span class="chip bad plain">목표 없음</span>`}${chip(p.self)}${chip(p.first)}<span class="right num">${n1(p.final)}</span>${p.grade ? grade(p.grade) : ''}</div>`)}</div></td></tr>`)}</tbody></table></div>`);
  view.onclick = (e) => { const tr = e.target.closest('[data-o]'); if (tr) $(`[data-detail="${tr.dataset.o}"]`, view).hidden ^= 1; };
}

// ── 사용자 · 권한 · 계정 일괄 발급 ──
async function usersView(view) {
  const [users, orgs] = await Promise.all([api('/api/ad/users'), api('/api/ad/orgs')]);
  let q = '', filter = 'all';
  const draw = () => {
    const list = users.filter((u) => (!q || `${u.name}${u.emp_no}${u.email}${u.org_name}`.includes(q)) && (filter === 'all' || (filter === 'noacc' ? !u.has_account && u.status === 'active' : filter === 'admin' ? u.is_admin : u.status === 'retired')));
    mount($('#ul', view), html`<div class="table-wrap"><table class="table"><thead><tr><th><input type="checkbox" data-all style="accent-color:var(--brand)"></th><th>사번</th><th>이름</th><th>조직</th><th>직급·직책</th><th>계정</th><th>권한</th><th>상태</th><th></th></tr></thead><tbody>
      ${list.map((u) => html`<tr><td><input type="checkbox" data-sel="${u.id}" style="accent-color:var(--brand)"></td><td class="num small">${u.emp_no}</td>
        <td><div class="row">${avatar(u, 28)}<div><b>${u.name}</b><div class="muted small">${u.email || ''}</div></div></div></td><td>${u.org_name || '–'}</td><td class="small">${u.position}${u.duty ? ' · ' + u.duty : ''}</td>
        <td>${u.has_account ? chip('approved', '발급') : chip('revise', '미발급')}</td><td>${u.is_admin ? html`<span class="chip info plain">관리자</span>` : ''}</td>
        <td>${u.status === 'active' ? chip('approved', '재직') : chip('rejected', '퇴직')}</td>
        <td><div class="row" style="gap:4px"><button class="btn sm" data-edit="${u.id}">${icon('pencil')}</button>${u.has_account ? html`<button class="btn sm" data-reset="${u.id}" title="임시 비밀번호 재발급">${icon('key-round')}</button>` : ''}</div></td></tr>`)}</tbody></table></div>`);
    $('[data-all]', view).onchange = (e) => $$('[data-sel]', view).forEach((c) => { c.checked = e.target.checked; });
  };
  mount(view, html`${head('사용자·권한', '구성원을 관리하고, 체크한 인원의 계정을 일괄 발급합니다. 이미 계정이 있는 사람과 퇴직자는 자동 제외됩니다.',
    html`<button class="btn" data-add>${icon('user-plus')}구성원 추가</button><button class="btn primary" data-issue>${icon('key-round')}계정 일괄 발급 (CSV)</button>`)}
    <div class="row wrap" style="margin-bottom:12px"><input class="input" style="width:260px" placeholder="이름·사번·조직 검색" data-q>
      <div class="seg" data-f>${[['all', '전체'], ['noacc', '계정 미발급'], ['admin', '관리자'], ['retired', '퇴직']].map(([k, l]) => html`<button data-k="${k}" class="${k === 'all' ? 'on' : ''}">${l}</button>`)}</div>
      <span class="muted small right">${users.length}명</span></div><div id="ul"></div>`);
  $('[data-q]', view).oninput = (e) => { q = e.target.value.trim(); draw(); };
  $('[data-f]', view).onclick = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; filter = b.dataset.k; $$('[data-k]', view).forEach((x) => x.classList.toggle('on', x === b)); draw(); };
  const form = (u) => modal({ title: u ? '구성원 편집' : '구성원 추가', wide: true, body: html`<div class="grid g3">
    <div class="field"><label>사번</label><input class="input" name="emp_no" value="${u?.emp_no || ''}"></div><div class="field"><label>이름</label><input class="input" name="name" value="${u?.name || ''}"></div>
    <div class="field"><label>이메일</label><input class="input" type="email" name="email" value="${u?.email || ''}"></div>
    <div class="field"><label>조직</label><select class="select" name="org_id">${orgs.map((o) => opt(o.id, o.name, o.id === u?.org_id))}</select></div>
    <div class="field"><label>직급</label><input class="input" name="position" value="${u?.position || ''}"></div>
    <div class="field"><label>직책 (직책자 스킴 판정)</label><input class="input" name="duty" value="${u?.duty || ''}" placeholder="팀장, 본부장 …"></div>
    <div class="field"><label>입사일</label><input class="input" type="date" name="hire_date" value="${u?.hire_date || ''}"></div>
    <div class="field"><label>상태</label><select class="select" name="status">${opt('active', '재직', u?.status !== 'retired')}${opt('retired', '퇴직', u?.status === 'retired')}</select></div>
    <label class="row" style="margin-top:24px"><input type="checkbox" name="is_admin" ${u?.is_admin ? 'checked' : ''} style="accent-color:var(--brand)"> 관리자(HR) 권한</label></div>
    <div class="callout tip">${icon('info')}소속·직책이 바뀌면 1차 평가 제출 전인 경우 평가자와 스킴이 자동 재계산됩니다.</div>`,
  actions: [{ label: '취소', value: null }, { label: '저장', kind: 'primary', value: 'ok' }],
  onAction: async (_, el) => { const f = formData(el); await api(u ? '/api/ad/users/' + u.id : '/api/ad/users', { method: u ? 'PUT' : 'POST', body: { ...f, org_id: +f.org_id } }); toast('저장했습니다.'); usersView(view); } });
  $('[data-add]', view).onclick = () => form(null);
  view.onclick = async (e) => {
    const ed = e.target.closest('[data-edit]'), rs = e.target.closest('[data-reset]');
    if (ed) form(users.find((u) => u.id === +ed.dataset.edit));
    if (rs && (await confirmBox('비밀번호 재발급', '임시 비밀번호를 새로 발급합니다. 기존 세션은 로그아웃됩니다.'))) {
      const r = await api(`/api/ad/users/${rs.dataset.reset}/reset`, { method: 'POST' });
      modal({ title: '임시 비밀번호', body: html`<div class="callout tip">${icon('key-round')}<b class="num" style="font-size:18px;user-select:all">${r.temp}</b></div><p class="muted small" style="margin:0">첫 로그인 시 변경을 요구합니다. 안전한 경로로 전달하세요.</p>` });
    }
  };
  $('[data-issue]', view).onclick = async () => {
    const ids = $$('[data-sel]:checked', view).map((c) => +c.dataset.sel);
    if (!ids.length) return toast('발급할 인원을 체크해 주세요. (필터: 계정 미발급)', 'bad');
    const blob = await api('/api/ad/accounts/issue', { method: 'POST', body: { user_ids: ids }, blob: true });
    download(blob, `kpc_accounts_${new Date().toISOString().slice(0, 10)}.csv`); toast('임시 비밀번호 CSV를 내려받았습니다.');
    const fresh = await api('/api/ad/users'); users.splice(0, users.length, ...fresh); draw();
  };
  draw();
}

// ── 재작성 요청 ──
async function rewritesView(view) {
  const list = await api('/api/ad/rewrites');
  const stage = { self: '자기평가', first: '1차 평가', second: '2차 검토', result: '확정 결과' };
  mount(view, html`${head('재작성 요청', '승인하면 해당 평가가 작성중 상태로 돌아가고, 확정 결과가 있으면 확정이 해제됩니다.')}
    <div class="col stagger">${list.length ? list.map((w) => html`<div class="card row wrap">${icon('rotate-ccw', 'color:var(--brand)')}
      <div class="grow"><b>${w.user_name}</b> · ${stage[w.stage] || w.stage} <span class="muted small">요청자 ${w.requester_name} · ${w.cycle_name} · ${ago(w.created_at)}</span><p style="margin:6px 0 0">${w.reason}</p></div>
      ${w.status === 'open' ? html`<button class="btn" data-w="${w.id}" data-a="reject">반려</button><button class="btn primary" data-w="${w.id}" data-a="approve">${icon('check')}승인</button>` : chip(w.status)}</div>`)
      : html`<div class="card">${empty('inbox', '요청이 없습니다')}</div>`}</div>`);
  view.onclick = async (e) => { const b = e.target.closest('[data-w]'); if (!b) return;
    await api('/api/ad/rewrites/' + b.dataset.w, { method: 'POST', body: { action: b.dataset.a } }); toast('처리했습니다.'); rewritesView(view); };
}

// ── 공지 · 감사 로그 ──
async function noticesView(view) {
  const list = await api('/api/notices');
  mount(view, html`${head('공지사항', '모든 사용자의 대시보드 공지 위젯에 표시됩니다.')}
    <div class="grid" style="grid-template-columns:minmax(0,1fr) 380px;align-items:start">
      <div class="col">${list.map((n) => html`<div class="card row">${n.pinned ? html`<span class="chip bad plain">필독</span>` : html`<span class="chip plain">공지</span>`}
        <div class="grow"><b>${n.title}</b><p class="muted" style="margin:4px 0 0">${n.body}</p></div><span class="faint small">${fdate(n.created_at)}</span><button class="btn sm danger" data-del="${n.id}">${icon('trash-2')}</button></div>`)}</div>
      <form class="card col" id="nf"><div class="card-h">${icon('megaphone')}<h3>새 공지</h3></div><div class="field"><label>제목</label><input class="input" name="title"></div>
        <div class="field"><label>내용</label><textarea class="textarea" name="body"></textarea></div><label class="row small"><input type="checkbox" name="pinned" style="accent-color:var(--brand)">필독(상단 고정)</label>
        <button class="btn primary">${icon('send')}게시</button></form></div>`);
  $('#nf', view).onsubmit = async (e) => { e.preventDefault(); await api('/api/ad/notices', { method: 'POST', body: formData(e.target) }); toast('게시했습니다.'); noticesView(view); };
  view.onclick = async (e) => { const b = e.target.closest('[data-del]'); if (b) { await api('/api/ad/notices/' + b.dataset.del, { method: 'DELETE' }); noticesView(view); } };
}
async function auditView(view) {
  const list = await api('/api/ad/audit');
  mount(view, html`${head('감사 로그', '로그인, 단계 전환, 조정, 확정, 권한·계정 변경 등 주요 행위가 기록됩니다. (최근 300건)')}
    <div class="table-wrap"><table class="table"><thead><tr><th>시각</th><th>사용자</th><th>행위</th><th>상세</th></tr></thead><tbody>
    ${list.map((a) => html`<tr><td class="small num">${String(a.created_at).slice(0, 16)}</td><td>${a.user_name || '시스템'}</td><td><span class="chip plain">${a.action}</span></td><td class="small muted">${a.detail}</td></tr>`)}</tbody></table></div>`);
}

start({ page: 'admin', menu: MENUS.admin, routes: {
  home: async (v) => dashboard(v, { page: 'admin', catalog: CATALOG.admin, defaults: DEFAULTS.admin, data: await api('/api/ad/dash'), title: '성과 홈', sub: '조치 필요 항목부터 처리하세요. 카드를 누르면 해당 화면으로 이동합니다.' }),
  cycles: cyclesView, relations: relationsView, orgs: orgsView, peer: peerView, calib: calibView, stats: statsView,
  users: usersView, rewrites: rewritesView, studio: studioView, notices: noticesView, audit: auditView,
} });
