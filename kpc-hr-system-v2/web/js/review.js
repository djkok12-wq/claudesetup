// 평가자 페이지 — 홈 · 목표 승인 · 평가 리뷰(1차 작성 / 2차 검토·조정) · 팀 분포 · 칭찬
import { $, $$, api, askText, avatar, bar, chip, confirmBox, dashboard, distChart, empty, go, grade, head, html, icon, kudosView, mount, n1, ring, start, toast } from './core.js';
import { CATALOG, DEFAULTS, MENUS } from './catalog.js';
import { bindRatings, convert, rating, readRatings, smartBadges } from './evalkit.js';

// ── 목표 승인 ──
async function approvalsView(view) {
  const d = await api('/api/rv/goals');
  const pending = d.people.reduce((a, p) => a + p.pending, 0);
  mount(view, html`${head('목표 승인', `담당 피평가자가 제출한 목표를 검토하세요. 반려·수정 요청에는 5자 이상의 사유가 필요합니다. · 대기 ${pending}건`)}
    <div class="col stagger">${d.people.length ? d.people.map((p) => {
      const sum = p.goals.filter((g) => g.status !== 'rejected').reduce((a, g) => a + g.weight, 0);
      return html`<details class="card" ${p.pending ? 'open' : ''}><summary class="row" style="cursor:pointer;list-style:none">${avatar(p, 40)}
        <div class="grow"><b>${p.name}</b> <span class="muted small">${p.org_name} · ${p.position}</span><div class="small muted">목표 ${p.goals.length}개 · 가중치 합계 <b style="color:${sum === 100 ? 'var(--ok)' : 'var(--bad)'}">${sum}%</b></div></div>
        ${p.pending ? html`<span class="chip warn">승인 대기 ${p.pending}</span><button class="btn sm primary" data-all="${p.id}">${icon('check-check')}전체 승인</button>` : html`<span class="chip ok">처리 완료</span>`}${icon('chevron-down', 'color:var(--faint)')}</summary>
        <div class="table-wrap" style="margin-top:14px"><table class="table"><thead><tr><th>목표</th><th>유형</th><th>가중치</th><th>목표값</th><th>KPI 연결</th><th>SMART</th><th>상태</th><th></th></tr></thead><tbody>
        ${p.goals.map((g) => html`<tr><td><b>${g.title}</b><div class="muted small">${g.description}</div></td><td>${g.type === 'quant' ? '정량' : '정성'}</td><td class="num">${g.weight}%</td>
          <td class="num">${g.type === 'quant' ? `${g.target}${g.unit}` : '–'}</td><td class="small">${g.kpi_title || html`<span class="chip warn plain">미연결</span>`}</td><td>${smartBadges(g)}</td><td>${chip(g.status)}</td>
          <td>${g.status === 'submitted' ? html`<div class="row" style="gap:4px"><button class="btn sm primary" data-act="approve" data-g="${g.id}">승인</button>
            <button class="btn sm" data-act="revise" data-g="${g.id}">수정 요청</button><button class="btn sm danger" data-act="reject" data-g="${g.id}">반려</button></div>` : ''}</td></tr>`)}
        </tbody></table></div></details>`;
    }) : html`<div class="card">${empty('users', '1차 평가 대상자가 없습니다')}</div>`}</div>`);
  view.onclick = async (e) => {
    const all = e.target.closest('[data-all]'), act = e.target.closest('[data-act]');
    if (all) { e.preventDefault(); const r = await api('/api/rv/goals-approve-all/' + all.dataset.all, { method: 'POST' }); toast(`${r.approved}건 승인했습니다.`); return approvalsView(view); }
    if (!act) return;
    let note = '';
    if (act.dataset.act !== 'approve') { note = await askText(act.dataset.act === 'reject' ? '목표 반려' : '수정 요청', { label: '피평가자에게 전달할 사유' }); if (!note) return; }
    await api('/api/rv/goals/' + act.dataset.g, { method: 'POST', body: { action: act.dataset.act, note } });
    toast('처리했습니다.'); approvalsView(view);
  };
}

// ── 평가 리뷰 목록 ──
async function evaluateView(view, uid) {
  if (uid) return workspace(view, +uid);
  const d = await api('/api/rv/team');
  let tab = 'first', q = '';
  const draw = () => {
    const list = d.team.filter((p) => p.role === tab && (!q || p.name.includes(q) || (p.org_name || '').includes(q)));
    const cnt = (r) => d.team.filter((p) => p.role === r).length;
    mount($('#list', view), html`<div class="table-wrap"><table class="table"><thead><tr><th>피평가자</th><th>스킴</th><th>목표</th><th>자기평가</th><th>1차</th><th>2차</th><th>산정</th><th>점수·등급</th><th></th></tr></thead><tbody>
      ${list.map((p) => html`<tr><td><div class="row">${avatar(p, 32)}<div><b>${p.name}</b><div class="muted small">${p.org_name} · ${p.position}</div></div></div></td>
        <td><span class="chip plain">${p.scheme === 'leader' ? '직책자' : '팀원'}</span></td>
        <td class="small">${p.goals.approved}/${p.goals.count}건 승인 ${p.goals.submitted ? chip('submitted', '대기 ' + p.goals.submitted) : ''}</td>
        <td>${chip(p.self)}</td><td>${chip(p.first)}</td><td>${chip(p.second)}</td>
        <td>${p.complete ? chip('approved', '완료') : html`<span class="chip warn" title="${p.missing.join(' · ')}">미완 ${p.missing.length}</span>`}</td>
        <td class="num"><b>${n1(p.final)}</b> ${p.grade ? grade(p.grade) : ''}</td>
        <td><a class="btn sm ${tab === 'first' && p.first !== 'submitted' ? 'primary' : ''}" href="#/evaluate/${p.id}">${tab === 'first' && p.first !== 'submitted' ? '평가하기' : '열기'}</a></td></tr>`)}
      </tbody></table>${list.length ? '' : empty('inbox', '대상자가 없습니다')}</div>`);
    $$('.tabs button', view).forEach((b) => { b.classList.toggle('on', b.dataset.t === tab); b.querySelector('.badge').textContent = cnt(b.dataset.t); });
  };
  mount(view, html`${head('평가 리뷰', d.phase === 'review' ? '평가 진행 단계입니다. 1차 평가를 작성·제출하고, 2차 평가자는 검토·조정하세요.' : '1차 평가 작성은 평가 진행 단계에서 가능합니다.',
    html`<input class="input" style="width:220px" placeholder="이름·조직 검색" data-q>`)}
    <div class="tabs"><button data-t="first">1차 평가 <span class="badge" style="background:var(--brand)"></span></button><button data-t="second">2차 검토 <span class="badge" style="background:var(--ink)"></span></button></div><div id="list"></div>`);
  $$('.tabs button', view).forEach((b) => { b.onclick = () => { tab = b.dataset.t; draw(); }; });
  $('[data-q]', view).oninput = (e) => { q = e.target.value.trim(); draw(); };
  draw();
}

// ── 평가 워크스페이스 ──
function preview(ws, gs, isc) {
  const goals = ws.goals.map((g) => {
    const m = gs[g.id];
    return { ...g, score: m !== undefined && m !== '' && m !== null ? +m : g.type === 'quant' ? convert(g.rate, ws.conv) : null };
  });
  const wsum = goals.reduce((a, g) => a + g.weight, 0), missing = [];
  if (wsum !== 100) missing.push(`가중치 합계 ${wsum}%`);
  goals.filter((g) => g.score == null).forEach((g) => missing.push(`'${g.title}' 점수 없음`));
  const goal = wsum === 100 && !goals.some((g) => g.score == null) ? goals.reduce((a, g) => a + g.score * g.weight, 0) / 100 : null;
  const area = (filter) => { const its = ws.items.filter(filter); return its.length && its.every((i) => isc[i.id]) ? (its.reduce((a, i) => a + isc[i.id], 0) / its.length) * 20 : null; };
  const comp = area((i) => i.area === 'comp'), extra = area((i) => i.area !== 'comp');
  if (comp == null) missing.push('개인역량 미평가');
  if (extra == null) missing.push(`${ws.scheme === 'leader' ? '조직관리' : '자기개발'} 미평가`);
  const w = ws.weights, adj = ws.adjustments.reduce((a, x) => a + x.delta, 0);
  const base = [goal, comp, extra].includes(null) ? null : (goal * w.goal + comp * w.comp + extra * w.extra) / 100;
  const final = base == null ? null : Math.max(0, Math.min(100, base + adj));
  const g = final == null ? null : ws.grades.find(([, c]) => final >= c)?.[0];
  return { goals, goal, comp, extra, base, adj, final, grade: g, missing };
}

async function workspace(view, uid) {
  const ws = await api('/api/rv/eval/' + uid);
  const f = ws.first || { goal_scores: {}, item_scores: {}, comment: '', status: 'none' };
  const selfS = ws.self?.item_scores || {};
  const edit = ws.first_open, extraLabel = ws.scheme === 'leader' ? '조직관리' : '자기개발';
  const u = ws.user;
  mount(view, html`
    <a href="#/evaluate" class="btn ghost sm" style="margin-bottom:10px">${icon('arrow-left')}목록으로</a>
    <div class="card row wrap" style="margin-bottom:16px">${avatar(u, 56)}
      <div class="grow"><h1 style="font-size:22px">${u.name} <span class="muted" style="font-size:14px;font-weight:600">${u.org_name} · ${u.position}${u.duty ? ' · ' + u.duty : ''}</span></h1>
        <div class="row wrap small" style="margin-top:6px"><span class="chip info plain">${ws.role === 'first' ? '내가 1차 평가자' : ws.role === 'second' ? '내가 2차 평가자' : 'HR 열람'}</span>
          <span class="chip plain">${ws.scheme === 'leader' ? '직책자' : '팀원'} 스킴 ${ws.weights.goal}/${ws.weights.comp}/${ws.weights.extra}</span>
          <span>자기평가 ${chip(ws.self?.status || 'none')}</span><span>1차 ${chip(f.status)} <span class="muted">${ws.first_name || ''}</span></span>
          <span>2차 ${chip(ws.second?.status || 'none')} <span class="muted">${ws.second_name || ''}</span></span>${ws.confirmed ? chip('approved', '확정됨') : ''}</div></div>
      <div class="row">${ws.history.map((h) => html`<div style="text-align:center" title="${h.cycle} ${n1(h.final)}점">${grade(h.grade)}<div class="faint small">${h.cycle.slice(2, 4)}${h.cycle.includes('상반기') ? 'H1' : 'H2'}</div></div>`)}
        ${ws.rewrite_open ? html`<button class="btn sm" data-rewrite>${icon('rotate-ccw')}재작성 요청</button>` : ''}</div></div>
    <div class="grid" style="grid-template-columns:minmax(0,1fr) 340px;align-items:start">
      <div class="col">
        <div class="card"><div class="card-h">${icon('target')}<h3>① 공통목표 · ${ws.weights.goal}%</h3><span class="right muted small">수기 점수(0~100)가 있으면 자동 환산보다 우선합니다</span></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>목표</th><th>가중치</th><th>목표/실적</th><th>달성률</th><th>자동 환산</th><th style="width:120px">평가자 점수</th></tr></thead><tbody>
          ${ws.goals.map((g) => html`<tr><td><b>${g.title}</b><div class="muted small">${g.actual_note || (g.type === 'qual' ? '정성 목표 · 평가자 채점 필수' : '')}</div></td><td class="num">${g.weight}%</td>
            <td class="num small">${g.type === 'quant' ? html`${g.target}${g.unit} / <b>${g.actual ?? '미입력'}</b>` : '–'}</td><td class="num">${g.rate != null ? g.rate + '%' : '–'}</td>
            <td class="num">${g.auto != null ? g.auto + '점' : '–'}</td>
            <td><input class="input sm num" type="number" min="0" max="100" data-gs="${g.id}" value="${f.goal_scores[g.id] ?? ''}" placeholder="${g.type === 'qual' ? '필수' : '선택'}" ${edit ? '' : 'disabled'}></td></tr>`)}
          </tbody></table></div></div>
        ${[['comp', `② 개인역량 · ${ws.weights.comp}%`, 'sparkles'], ['extra', `③ ${extraLabel} · ${ws.weights.extra}%`, 'sprout']].map(([a, t, ic]) => html`
          <div class="card"><div class="card-h">${icon(ic)}<h3>${t}</h3><span class="right muted small">5점 척도 · 평균 × 20 · 회색 표시는 본인 자기 진단</span></div>
          <div class="list">${ws.items.filter((i) => (a === 'comp' ? i.area === 'comp' : i.area !== 'comp')).map((it) => html`<div>
            <div class="grow"><b>${it.name}</b><div class="muted small">${it.description}</div></div>
            ${selfS[it.id] ? html`<span class="chip plain" title="본인 자기 진단">본인 ${selfS[it.id]}</span>` : ''}${rating(String(it.id), f.item_scores[it.id], !edit)}</div>`)}</div></div>`)}
        <div class="card"><div class="card-h">${icon('message-square-text')}<h3>④ 종합 의견</h3><span class="right small num" id="cnt"></span></div>
          ${ws.self?.comment ? html`<div class="callout" style="margin-bottom:10px">${icon('user-round')}<div><b>피평가자 자기평가</b><div>${ws.self.comment}</div></div></div>` : ''}
          <textarea class="textarea" data-comment style="min-height:120px" maxlength="3000" ${edit ? '' : 'disabled'} placeholder="강점, 개선점, 다음 주기 기대 사항 (10자 이상)">${f.comment}</textarea></div>
        ${ws.role === 'second' || ws.adjust_open ? secondPanel(ws) : ''}
      </div>
      <div class="col" style="position:sticky;top:84px">
        <div class="card" id="score"></div>
        <div class="card"><div class="card-h">${icon('users')}<h3>다면평가 (익명·참고)</h3><span class="right muted small">${ws.peer.count}/${ws.peer.assigned}</span></div>
          ${ws.peer.count ? html`<div class="list">${Object.entries(ws.peer.avg).map(([k, v]) => html`<div><b style="width:52px" class="small">${k}</b><div class="grow">${bar((v / 5) * 100, 'var(--s3)')}</div><span class="num small b">${n1(v, 1)}</span></div>`)}</div>` : empty('users', '응답 없음')}</div>
      </div>
    </div>
    ${edit ? html`<div class="sticky-bar"><span class="save-state" id="saved">${icon('cloud')}자동 저장</span><button class="btn right" data-save>임시 저장</button><button class="btn primary" data-submit>${icon('send')}1차 평가 제출</button></div>` : ''}`);

  const collect = () => ({ goal_scores: Object.fromEntries($$('[data-gs]', view).map((i) => [i.dataset.gs, i.value === '' ? null : +i.value])), item_scores: readRatings(view), comment: $('[data-comment]', view).value });
  const drawScore = () => {
    const c = collect(), p = preview(ws, Object.fromEntries(Object.entries(c.goal_scores).filter(([, v]) => v != null)), c.item_scores);
    const n = $('[data-comment]', view).value.trim().length, cnt = $('#cnt', view);
    cnt.textContent = `${n}자 ${n < 10 ? '(10자 이상)' : '✓'}`; cnt.style.color = n < 10 ? 'var(--bad)' : 'var(--ok)';
    mount($('#score', view), html`<div class="card-h">${icon('calculator')}<h3>실시간 산정</h3><span class="right">${grade(p.grade, true)}</span></div>
      <div class="row" style="justify-content:center;margin-bottom:12px">${ring(p.final ?? 0, 120, p.final == null ? 'var(--faint)' : 'var(--brand)', p.final == null ? '미완' : n1(p.final))}</div>
      <div class="list small">${[['공통목표', p.goal, ws.weights.goal], ['개인역량', p.comp, ws.weights.comp], [extraLabel, p.extra, ws.weights.extra]].map(([l, v, w]) => html`
        <div><span class="grow">${l} <span class="faint">×${w}%</span></span><b class="num">${n1(v)}</b></div>`)}
        <div><span class="grow">조정 합계</span><b class="num">${p.adj > 0 ? '+' : ''}${n1(p.adj)}</b></div></div>
      ${p.missing.length ? html`<div class="callout warn" style="margin-top:10px">${icon('triangle-alert')}<div><b>산정 미완</b><div class="small">${p.missing.join(' · ')}</div></div></div>`
        : html`<div class="callout tip" style="margin-top:10px">${icon('circle-check')}산정 완료 — 제출 가능합니다.</div>`}`);
  };
  drawScore();
  let timer;
  const autosave = () => { if (!edit) return; clearTimeout(timer); $('#saved', view).textContent = '저장 중…'; timer = setTimeout(async () => {
    await api('/api/rv/eval/' + uid, { method: 'PUT', body: { ...collect(), submit: false } }); $('#saved', view).textContent = '✓ 자동 저장됨';
  }, 1000); };
  view.oninput = (e) => { if (e.target.closest('[data-gs],[data-comment]')) { drawScore(); autosave(); } };
  bindRatings(view, () => { drawScore(); autosave(); });
  $('[data-save]', view)?.addEventListener('click', async () => { clearTimeout(timer); await api('/api/rv/eval/' + uid, { method: 'PUT', body: { ...collect(), submit: false } }); toast('임시 저장했습니다.'); });
  $('[data-submit]', view)?.addEventListener('click', async () => {
    if (!(await confirmBox('1차 평가 제출', '제출한 평가는 수정할 수 없습니다. 수정이 필요하면 HR에 재작성 요청을 해야 합니다.\n제출할까요?'))) return;
    clearTimeout(timer);
    await api('/api/rv/eval/' + uid, { method: 'PUT', body: { ...collect(), submit: true } });
    toast(`${u.name}님 1차 평가를 제출했습니다.`); go('#/evaluate');
  });
  $('[data-rewrite]', view)?.addEventListener('click', async () => {
    const reason = await askText('재작성 요청', { label: 'HR에 전달할 사유' });
    if (reason) { await api('/api/rv/rewrite/' + uid, { method: 'POST', body: { reason } }); toast('재작성 요청을 접수했습니다.'); }
  });
  bindSecond(view, ws, uid);
}

function secondPanel(ws) {
  const s = ws.second || { comment: '', status: 'none' };
  return html`<div class="card" style="border-color:color-mix(in oklab,var(--brand) 40%,transparent)"><div class="card-h">${icon('scale')}<h3>${ws.role === 'admin' ? 'HR 조정' : '2차 검토 · 조정'}</h3>
    <span class="right muted small">1회 ±10점 · 사유 5자 이상 · 확정 전까지 누적</span></div>
    ${ws.adjustments.length ? html`<div class="list" style="margin-bottom:12px">${ws.adjustments.map((a) => html`<div>${chip(a.by_role === 'hr' ? 'submitted' : 'draft', a.by_role === 'hr' ? 'HR' : '2차')}
      <b class="num" style="color:${a.delta < 0 ? 'var(--bad)' : 'var(--ok)'}">${a.delta > 0 ? '+' : ''}${a.delta}</b><span class="grow">${a.reason}</span><span class="faint small">${a.by_name}</span></div>`)}</div>` : ''}
    ${ws.adjust_open ? html`<div class="row wrap"><div class="field" style="width:240px"><label>조정 점수 <b class="num" id="dv">0</b></label><input type="range" min="-10" max="10" step="0.5" value="0" data-delta style="accent-color:var(--brand)"></div>
      <input class="input grow" data-reason placeholder="조정 사유 (5자 이상)" maxlength="500"><button class="btn" data-adjust>${icon('plus')}조정 등록</button></div>`
      : html`<p class="muted small" style="margin:0">${ws.first?.status !== 'submitted' ? '1차 평가 제출 후 조정할 수 있습니다.' : '조정 가능한 상태가 아닙니다.'}</p>`}
    ${ws.role === 'second' ? html`<div class="field" style="margin-top:14px"><label>2차 검토 의견</label><textarea class="textarea" data-second ${ws.second_open ? '' : 'disabled'}>${s.comment}</textarea></div>
      ${ws.second_open ? html`<div class="row" style="margin-top:10px"><span class="right"></span><button class="btn" data-second-save>임시 저장</button><button class="btn primary" data-second-submit>${icon('check')}검토 완료</button></div>` : ''}` : ''}</div>`;
}
function bindSecond(view, ws, uid) {
  const dr = $('[data-delta]', view);
  if (dr) dr.oninput = () => { $('#dv', view).textContent = (dr.value > 0 ? '+' : '') + dr.value; };
  $('[data-adjust]', view)?.addEventListener('click', async () => {
    const delta = +dr.value, reason = $('[data-reason]', view).value.trim();
    if (!delta) return toast('조정 점수를 선택해 주세요.', 'bad');
    if (reason.length < 5) return toast('사유는 5자 이상 입력해 주세요.', 'bad');
    await api('/api/rv/adjust/' + uid, { method: 'POST', body: { delta, reason } });
    toast('조정을 등록했습니다.'); workspace(view, uid);
  });
  const saveSecond = async (submit) => {
    await api('/api/rv/second/' + uid, { method: 'PUT', body: { comment: $('[data-second]', view).value, submit } });
    toast(submit ? '2차 검토를 완료했습니다.' : '임시 저장했습니다.'); if (submit) workspace(view, uid);
  };
  $('[data-second-save]', view)?.addEventListener('click', () => saveSecond(false));
  $('[data-second-submit]', view)?.addEventListener('click', () => saveSecond(true));
}

// ── 팀 분포 · 현황 ──
async function teamView(view) {
  const d = await api('/api/rv/team');
  const mine = d.team.filter((p) => p.role === 'first');
  const dist = Object.fromEntries(d.grades.map(([g]) => [g, mine.filter((p) => p.grade === g).length]));
  const done = mine.filter((p) => p.final != null).sort((a, b) => b.final - a.final);
  mount(view, html`${head('팀 분포·현황', '1차 평가 담당 구성원의 예상 등급 분포를 배분 가이드와 비교합니다. (확정 전 참고용)')}
    <div class="grid g4" style="margin-bottom:16px">${[['담당 인원', mine.length, 'users'], ['산정 완료', done.length, 'calculator'], ['평균 점수', done.length ? (done.reduce((a, p) => a + p.final, 0) / done.length).toFixed(1) : '–', 'sigma'],
      ['1차 제출', mine.filter((p) => p.first === 'submitted').length, 'send']].map(([l, v, ic]) => html`<div class="card tilt kpi"><div class="row between"><span class="l">${l}</span>${icon(ic, 'color:var(--brand)')}</div><span class="v">${v}</span></div>`)}</div>
    <div class="grid g2"><div class="card"><div class="card-h">${icon('chart-column')}<h3>예상 등급 분포 vs 가이드</h3></div><div style="position:relative;height:300px"><canvas></canvas></div></div>
      <div class="card"><div class="card-h">${icon('list-ordered')}<h3>점수 순위 (산정 완료)</h3></div>
        ${done.length ? html`<div class="list">${done.map((p, i) => html`<a href="#/evaluate/${p.id}"><span class="num faint b" style="width:22px">${i + 1}</span>${avatar(p, 30)}<b class="grow">${p.name}</b>
          <div style="width:140px">${bar(p.final)}</div><span class="num b" style="width:44px;text-align:right">${n1(p.final)}</span>${grade(p.grade)}</a>`)}</div>` : empty('calculator', '산정 완료 인원이 없습니다')}</div></div>`);
  distChart($('canvas', view), dist, d.guide);
}

start({ page: 'review', menu: MENUS.review, routes: {
  home: async (v) => dashboard(v, { page: 'review', catalog: CATALOG.review, defaults: DEFAULTS.review, data: await api('/api/rv/dash'), title: '평가자 홈', sub: '승인·평가·검토할 일을 우선순위대로 보여드려요.' }),
  approvals: approvalsView, evaluate: evaluateView, team: teamView, kudos: kudosView,
} });
