// 메뉴 · 위젯 카탈로그 · 기본 레이아웃 — 각 페이지와 UI 스튜디오가 공유한다.
import { $, ago, avatar, bar, baseOpts, chart, chip, cssv, dday, distChart, empty, fdate, grade, html, icon, n1, ring, S, wcard } from './core.js';

export const MENUS = {
  me: [
    { key: 'home', label: '내 평가 홈', icon: 'layout-dashboard' }, { key: 'goals', label: '목표 설정', icon: 'target' },
    { key: 'self', label: '실적·자기평가', icon: 'pen-line' }, { key: 'peer', label: '다면평가', icon: 'users' },
    { key: 'results', label: '내 평가 결과', icon: 'award' }, { key: 'kudos', label: '칭찬·피드백', icon: 'heart-handshake' },
  ],
  review: [
    { key: 'home', label: '평가자 홈', icon: 'layout-dashboard' }, { key: 'approvals', label: '목표 승인', icon: 'check-check' },
    { key: 'evaluate', label: '평가 리뷰', icon: 'clipboard-pen' }, { key: 'team', label: '팀 분포·현황', icon: 'chart-column' },
    { key: 'kudos', label: '칭찬·피드백', icon: 'heart-handshake' },
  ],
  admin: [
    { key: 'home', label: '성과 홈', icon: 'layout-dashboard' }, { key: 'cycles', label: '평가 주기', icon: 'calendar-cog' },
    { key: 'relations', label: '평가 관계', icon: 'git-fork' }, { key: 'orgs', label: '조직·KPI', icon: 'network' },
    { key: 'peer', label: '다면평가 관리', icon: 'users-round' }, { key: 'calib', label: '조정·확정', icon: 'scale' },
    { key: 'stats', label: '집계현황', icon: 'chart-pie' }, { key: 'users', label: '사용자·권한', icon: 'user-cog' },
    { key: 'rewrites', label: '재작성 요청', icon: 'rotate-ccw' }, { key: 'studio', label: 'UI 스튜디오', icon: 'layout-template' },
    { key: 'notices', label: '공지사항', icon: 'megaphone' }, { key: 'audit', label: '감사 로그', icon: 'scroll-text' },
  ],
};

// ── 공용 위젯 ──
function phaseW(el) {
  const ph = S.boot.phases, cur = S.boot.cycle?.phase, idx = ph.findIndex((p) => p.key === cur);
  wcard(el, '평가 단계', 'milestone', html`<div class="stepper">${ph.map((p, i) => html`
    <div class="step ${i < idx ? 'done' : i === idx ? 'now' : ''}"><i>${i < idx ? icon('check', 'width:14px;height:14px') : i + 1}</i>${p.label}</div>`)}</div>`);
}
function todoW(el, d) {
  wcard(el, '지금 할 일', 'list-checks', d.todo.length ? html`<div class="list stagger">${d.todo.map((t) => html`
    <a class="todo-item lv-${t.level}" href="${t.link}"><span class="todo-ic">${icon(t.icon)}</span><span class="grow b">${t.text}</span>${icon('chevron-right', 'color:var(--faint)')}</a>`)}</div>`
    : empty('party-popper', '할 일을 모두 마쳤어요!'));
}
function noticesW(el, d) {
  wcard(el, '공지사항', 'megaphone', html`<div class="list">${(d.notices || []).map((n) => html`<div>
    ${n.pinned ? html`<span class="chip bad plain">필독</span>` : html`<span class="chip plain">공지</span>`}<div class="grow"><b>${n.title}</b><div class="muted small ellipsis">${n.body}</div></div>
    <span class="faint small">${fdate(n.created_at)}</span></div>`)}</div>`);
}
function heroW(kind) {
  return (el, d) => {
    const me = S.boot.me, c = S.boot.cycle, due = d.due ?? d.cycle?.due, left = dday(due);
    const top = d.todo?.[0] || d.actions?.[0];
    const sub = { me: '목표부터 결과까지, 지금 해야 할 일을 한눈에 확인하세요.', review: '구성원의 성장을 공정하게 기록하는 시간입니다.', admin: '전사 평가 흐름을 실시간으로 관리합니다.' }[kind];
    el.classList.add('hero'); el.classList.remove('w-card');
    el.innerHTML = String(html`
      <span class="hero-blob" style="width:220px;height:220px;right:-40px;top:-60px;background:#22d3ee"></span>
      <span class="hero-blob" style="width:160px;height:160px;right:180px;bottom:-80px;background:#a78bfa;animation-delay:-3s"></span>
      <div class="cube-wrap"><div class="cube"><div>S</div><div>A</div><div>B</div><div>C</div><div>D</div><div>★</div></div></div>
      <div class="hero-txt"><div class="small" style="opacity:.8;font-weight:700;letter-spacing:.08em">${c ? `${c.name} · ${c.phase_label}` : '진행 중인 주기 없음'}</div>
        <h2>안녕하세요, ${me.name}님 👋</h2><p>${sub}</p></div>
      <div class="row wrap" style="position:relative;gap:18px">
        ${left != null ? html`<div><div class="small" style="opacity:.8">단계 마감까지</div><div class="dday">D${left >= 0 ? '-' : '+'}${Math.abs(left)}</div></div>` : ''}
        ${top ? html`<a class="btn primary" href="${top.link}">${icon(top.icon)}${top.text || top.title}</a>` : ''}
        <a class="btn" href="/manual" target="_blank">${icon('book-open')}매뉴얼</a>
      </div>`);
    window.lucide?.createIcons();
  };
}
function kudosW(el, d) {
  wcard(el, `받은 칭찬 ${d.kudos_count ?? ''}`, 'heart', d.kudos?.length ? html`<div class="list">${d.kudos.map((k) => html`<div>
    ${avatar({ name: k.from_name, hue: k.from_hue }, 30)}<div class="grow"><div class="small"><b>${k.from_name}</b> <span class="chip info plain">#${k.tag}</span></div>
    <div class="ellipsis">${k.message}</div></div><span class="faint small">${ago(k.created_at)}</span></div>`)}</div>` : empty('heart', '아직 받은 칭찬이 없어요'),
  html`<a class="btn sm ghost" href="#/kudos">전체</a>`);
}

// ── 피평가자 위젯 ──
function goalsW(el, d) {
  wcard(el, '내 목표 현황', 'target', d.goals.length ? html`<div class="list">${d.goals.map((g) => html`<div>
    <div class="grow"><div class="row"><b class="ellipsis grow">${g.title}</b>${chip(g.status)}</div>
    <div class="row small muted" style="margin:6px 0 4px"><span>가중치 ${g.weight}%</span>${g.kpi_title ? html`<span>· ${icon('link', 'width:12px;height:12px')} ${g.kpi_title}</span>` : ''}
      <span class="right b num" style="color:var(--ink)">${g.type === 'quant' ? (g.rate != null ? `${g.rate}%` : '실적 미입력') : '정성'}</span></div>
    ${g.type === 'quant' ? bar(Math.min(100, g.rate || 0)) : ''}</div></div>`)}</div>` : empty('target', '등록된 목표가 없습니다'),
  html`<a class="btn sm ghost" href="#/goals">관리</a>`);
}
function relW(el, d) {
  const r = d.rel;
  wcard(el, '나의 평가자', 'git-fork', r ? html`<div class="col">
    <div class="row">${avatar(r.first, 34)}<div><div class="small muted">1차 평가자</div><b>${r.first?.name || '미지정'}</b> <span class="muted small">${r.first?.position || ''}</span></div></div>
    <div class="row">${avatar(r.second, 34)}<div><div class="small muted">2차 평가자</div><b>${r.second?.name || '없음'}</b> <span class="muted small">${r.second?.position || ''}</span></div></div>
    <span class="chip info plain">${r.scheme === 'leader' ? '직책자 스킴 50/30/20' : '팀원 스킴 40/40/20'}</span></div>` : empty('user-x', '평가 관계 없음'));
}
function historyW(el, d) {
  const body = wcard(el, '점수 추이', 'trending-up', d.history.length ? html`<div style="position:relative;height:100%"><canvas></canvas></div>` : empty('chart-line', '공개된 결과가 없습니다'));
  if (!d.history.length) return;
  chart($('canvas', body), { type: 'line', data: { labels: d.history.map((h) => `${h.cycle.replace(' 성과평가', '')} (${h.grade})`),
    datasets: [{ label: '최종 점수', data: d.history.map((h) => h.final), borderColor: cssv('--s1'), backgroundColor: cssv('--s1'), borderWidth: 2, pointRadius: 5, tension: 0.35 }] },
  options: baseOpts({ suffix: '점', max: 100 }) });
}
function areasW(el, d) {
  const h = d.history.at(-1);
  const body = wcard(el, '최근 영역별 점수', 'chart-bar-big', h ? html`<div style="position:relative;height:100%"><canvas></canvas></div>` : empty('chart-bar', '공개된 결과가 없습니다'), h ? grade(h.grade) : '');
  if (!h) return;
  chart($('canvas', body), { type: 'bar', data: { labels: ['공통목표', '개인역량', '자기개발/조직관리'],
    datasets: [{ label: h.cycle, data: [h.goal, h.comp, h.extra], backgroundColor: cssv('--s1'), borderRadius: 4, maxBarThickness: 22 }] },
  options: baseOpts({ y: 'y', suffix: '점', max: 100 }) });
}

// ── 평가자 위젯 ──
function progressW(el, d) {
  const c = d.counts, f = c.first || 1;
  const it = [['목표 승인 완료', c.goals_ok / f * 100, `${c.goals_ok}/${c.first}`], ['자기평가 제출', c.self_done / f * 100, `${c.self_done}/${c.first}`],
    ['1차 평가 제출', c.first_done / f * 100, `${c.first_done}/${c.first}`], ['2차 검토 완료', c.second ? c.second_done / c.second * 100 : 0, `${c.second_done}/${c.second}`]];
  wcard(el, '팀 진행률', 'gauge', html`<div class="row between wrap" style="height:100%">${it.map(([l, p, t]) => html`
    <div class="row">${ring(p, 64)}<div><div class="b">${l}</div><div class="muted small num">${t}명</div></div></div>`)}</div>`);
}
function teamDistW(el, d) {
  const body = wcard(el, '예상 등급 분포 (1차 담당)', 'chart-column', html`<div style="position:relative;height:100%"><canvas></canvas></div>`);
  distChart($('canvas', body), d.dist, d.guide);
}
function teamW(el, d) {
  const t = d.team.filter((p) => p.role === 'first').concat(d.team.filter((p) => p.role === 'second'));
  wcard(el, '담당 구성원', 'users', t.length ? html`<table class="table"><thead><tr><th>이름</th><th>구분</th><th>자기평가</th><th>1차</th><th>점수</th><th></th></tr></thead>
    <tbody>${t.map((p) => html`<tr><td><div class="row">${avatar(p, 28)}<div><b>${p.name}</b><div class="muted small">${p.org_name} · ${p.position}</div></div></div></td>
    <td>${p.role === 'first' ? chip('submitted', '1차') : chip('draft', '2차')}</td><td>${chip(p.self)}</td><td>${chip(p.first)}</td>
    <td class="num"><b>${n1(p.final)}</b> ${p.grade ? grade(p.grade) : ''}</td><td><a class="btn sm" href="#/evaluate/${p.id}">열기</a></td></tr>`)}</tbody></table>`
    : empty('users', '담당 구성원이 없습니다'));
}

// ── 관리자 위젯 ──
function kpisW(el, d) {
  const k = d.kpis;
  const tiles = [['평가 대상', k.people, '명', 'users'], ['자기평가', k.self, '%', 'pen-line'], ['1차 평가', k.first, '%', 'clipboard-pen'],
    ['2차 검토', k.second, '%', 'scale'], ['확정', k.confirmed, '%', 'badge-check'], ['KPI 정렬도', k.align, '%', 'link'],
    ['다면평가 회수', k.peer, '%', 'users-round'], ['평균 점수(산정)', k.avg, '점', 'sigma']];
  wcard(el, '전사 핵심 지표', 'activity', html`<div class="grid g4" style="gap:10px">${tiles.map(([l, v, u, ic]) => html`
    <div class="card flat tilt" style="padding:14px"><div class="row between"><span class="kpi l" style="font-size:12px;color:var(--muted);font-weight:700">${l}</span>${icon(ic, 'color:var(--brand);width:16px;height:16px')}</div>
    <div class="kpi"><span class="v"><span data-count="${v}" data-dec="${u === '점' ? 1 : 0}">0</span><small style="font-size:14px;color:var(--muted);margin-left:2px">${u}</small></span></div></div>`)}</div>`);
}
function actionsW(el, d) {
  wcard(el, '조치 필요', 'siren', d.actions.length ? html`<div class="list stagger">${d.actions.map((a) => html`
    <a class="todo-item lv-${a.level}" href="${a.link}"><span class="todo-ic">${icon(a.icon)}</span><span class="grow"><b>${a.title}</b><div class="muted small ellipsis">${a.hint}</div></span>
    <span class="badge" style="background:var(--ink)">${a.count}</span></a>`)}</div>` : empty('shield-check', '조치가 필요한 항목이 없습니다'));
}
function funnelW(el, d) {
  const body = wcard(el, '단계별 완료 인원', 'filter', html`<div style="position:relative;height:100%"><canvas></canvas></div>`);
  chart($('canvas', body), { type: 'bar', data: { labels: d.funnel.map((f) => f.label),
    datasets: [{ label: '완료 인원', data: d.funnel.map((f) => f.n), backgroundColor: cssv('--s1'), borderRadius: 4, maxBarThickness: 22 }] },
  options: baseOpts({ y: 'y', suffix: '명', max: d.kpis.people }) });
}
function distW(el, d) {
  const body = wcard(el, '전사 등급 분포 vs 가이드', 'chart-column', html`<div style="position:relative;height:100%"><canvas></canvas></div>`);
  distChart($('canvas', body), d.dist, d.guide);
}
function orgsW(el, d) {
  wcard(el, '조직별 1차 평가 진행률', 'building-2', html`<div class="list">${d.orgs.map((o) => html`<div>
    <b style="width:96px" class="ellipsis">${o.org}</b><div class="grow">${bar(o.first / o.n * 100)}</div><span class="num small b" style="width:60px;text-align:right">${o.first}/${o.n}명</span></div>`)}</div>`);
}
function auditW(el, d) {
  wcard(el, '최근 활동', 'history', html`<div class="list">${d.audit.map((a) => html`<div>${icon('dot', 'color:var(--brand)')}<div class="grow small"><b>${a.user_name || '시스템'}</b> · ${a.action}
    <div class="muted ellipsis">${a.detail}</div></div><span class="faint small">${ago(a.created_at)}</span></div>`)}</div>`, html`<a class="btn sm ghost" href="#/audit">전체</a>`);
}

const W = (title, ic, desc, w, h, render) => ({ title, icon: ic, desc, w, h, render });
export const CATALOG = {
  me: {
    hero: W('환영 배너', 'sparkles', '인사말·단계·D-day·다음 행동', 8, 3, heroW('me')), rel: W('나의 평가자', 'git-fork', '1·2차 평가자와 배점 스킴', 4, 3, relW),
    phase: W('평가 단계', 'milestone', '주기 단계 스테퍼', 12, 2, phaseW), todo: W('지금 할 일', 'list-checks', '단계별 해야 할 일', 5, 4, todoW),
    goals: W('내 목표 현황', 'target', '목표별 달성률·상태', 7, 4, goalsW), history: W('점수 추이', 'trending-up', '주기별 최종 점수', 4, 4, historyW),
    areas: W('영역별 점수', 'chart-bar-big', '최근 결과 3영역', 4, 4, areasW), kudos: W('받은 칭찬', 'heart', '최근 칭찬 피드', 4, 4, kudosW),
    notices: W('공지사항', 'megaphone', 'HR 공지', 12, 3, noticesW),
  },
  review: {
    hero: W('환영 배너', 'sparkles', '인사말·단계·D-day', 8, 3, heroW('review')), todo: W('지금 할 일', 'list-checks', '승인·평가 대기', 4, 3, todoW),
    phase: W('평가 단계', 'milestone', '주기 단계 스테퍼', 12, 2, phaseW), progress: W('팀 진행률', 'gauge', '단계별 완료율 링', 12, 2, progressW),
    dist: W('예상 등급 분포', 'chart-column', '실제 vs 가이드', 5, 5, teamDistW), team: W('담당 구성원', 'users', '상태·점수 표', 7, 5, teamW),
    notices: W('공지사항', 'megaphone', 'HR 공지', 12, 3, noticesW),
  },
  admin: {
    hero: W('환영 배너', 'sparkles', '주기·단계·D-day', 8, 3, heroW('admin')), actions: W('조치 필요', 'siren', '미지정·확정 대기 등', 4, 7, actionsW),
    kpis: W('핵심 지표', 'activity', '참여율·완료율 타일', 8, 4, kpisW), phase: W('평가 단계', 'milestone', '주기 단계 스테퍼', 12, 2, phaseW),
    funnel: W('단계별 완료', 'filter', '퍼널 막대', 6, 4, funnelW), dist: W('등급 분포', 'chart-column', '전사 분포 vs 가이드', 6, 4, distW),
    orgs: W('조직별 진행률', 'building-2', '1차 평가 진행 막대', 6, 5, orgsW), audit: W('최근 활동', 'history', '감사 로그 요약', 6, 5, auditW),
    notices: W('공지사항', 'megaphone', 'HR 공지', 12, 3, noticesW),
  },
};

const L = (id, x, y, w, h) => ({ id, x, y, w, h });
export const DEFAULTS = {
  me: [L('hero', 0, 0, 8, 3), L('rel', 8, 0, 4, 3), L('phase', 0, 3, 12, 2), L('todo', 0, 5, 5, 4), L('goals', 5, 5, 7, 4),
    L('history', 0, 9, 4, 4), L('areas', 4, 9, 4, 4), L('kudos', 8, 9, 4, 4), L('notices', 0, 13, 12, 3)],
  review: [L('hero', 0, 0, 8, 3), L('todo', 8, 0, 4, 3), L('phase', 0, 3, 12, 2), L('progress', 0, 5, 12, 2),
    L('dist', 0, 7, 5, 5), L('team', 5, 7, 7, 5), L('notices', 0, 12, 12, 3)],
  admin: [L('hero', 0, 0, 8, 3), L('actions', 8, 0, 4, 7), L('kpis', 0, 3, 8, 4), L('phase', 0, 7, 12, 2),
    L('funnel', 0, 9, 6, 4), L('dist', 6, 9, 6, 4), L('orgs', 0, 13, 6, 5), L('audit', 6, 13, 6, 5), L('notices', 0, 18, 12, 3)],
};
