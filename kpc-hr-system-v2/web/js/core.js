// KPC HR SYSTEM — 공통 코어: 안전한 템플릿, API, 셸·라우터, 모달·토스트, 대시보드 그리드, 차트 헬퍼
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ── 자동 이스케이프 템플릿 (XSS 방지: 보간 값은 raw()/html`` 결과가 아니면 모두 이스케이프) ──
class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
export const raw = (s) => new Safe(String(s ?? ''));
const part = (v) => v instanceof Safe ? v.s : Array.isArray(v) ? v.map(part).join('') : v == null || v === false ? '' : esc(v);
export const html = (str, ...vals) => new Safe(str.reduce((a, s, i) => a + s + (i < vals.length ? part(vals[i]) : ''), ''));
export const icon = (name, style = '') => raw(`<i data-lucide="${esc(name)}" style="${esc(style)}"></i>`);
export const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* 저장소 차단 환경 */ } },
};

export function mount(el, tpl) { el.innerHTML = String(tpl); paint(el); return el; }
export function paint(root = document) {
  window.lucide?.createIcons({ attrs: { 'stroke-width': 1.8 } });
  requestAnimationFrame(() => {
    $$('[data-w]', root).forEach((b) => { b.style.width = b.dataset.w + '%'; });
    $$('[data-off]', root).forEach((c) => { c.style.strokeDashoffset = c.dataset.off; });
    $$('[data-count]', root).forEach(countUp);
    $$('.tilt', root).forEach(tilt);
  });
}
function countUp(el) {
  const to = +el.dataset.count, dec = +(el.dataset.dec || 0), t0 = performance.now();
  delete el.dataset.count;
  const step = (t) => { const p = Math.min(1, (t - t0) / 900); el.textContent = (to * (1 - (1 - p) ** 3)).toFixed(dec); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function tilt(el) {
  if (el._tilt) return; el._tilt = 1;
  el.addEventListener('mousemove', (e) => {
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${x * 7}deg) rotateX(${-y * 7}deg) translateY(-2px)`;
  });
  el.addEventListener('mouseleave', () => { el.style.transform = ''; });
}

// ── API ──
export async function api(path, { method = 'GET', body, blob } = {}) {
  const res = await fetch(path, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401 && !path.startsWith('/api/auth')) { location.href = '/login?next=' + encodeURIComponent(location.pathname + location.hash); throw Object.assign(new Error('401'), { status: 401 }); }
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = typeof j.detail === 'string' ? j.detail : `입력값을 확인해 주세요 (${(j.detail?.[0]?.loc || []).slice(-1)[0] || ''}: ${j.detail?.[0]?.msg || ''})`; } catch { /* 비 JSON */ }
    toast(msg, 'bad');
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return blob ? res.blob() : res.json();
}
export function download(blob, name) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// ── 토스트 · 모달 ──
export function toast(msg, kind = 'ok') {
  const box = $('.toasts') || document.body.appendChild(Object.assign(document.createElement('div'), { className: 'toasts' }));
  const t = mount(Object.assign(document.createElement('div'), { className: 'toast ' + kind }), html`${icon(kind === 'bad' ? 'circle-alert' : 'circle-check')}<span>${msg}</span>`);
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3400);
}
export function modal({ title, body, wide, actions = [{ label: '닫기', value: null }], onOpen, onAction }) {
  return new Promise((resolve) => {
    const ov = mount(Object.assign(document.createElement('div'), { className: 'overlay' }), html`
      <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="modal-h"><h3>${title}</h3><button class="icon-btn" data-x aria-label="닫기">${icon('x')}</button></div>
        <div class="modal-b">${body}</div>
        ${actions.length ? html`<div class="modal-f">${actions.map((a, i) => html`<button class="btn ${a.kind || ''}" data-i="${i}">${a.label}</button>`)}</div>` : ''}
      </div>`);
    document.body.appendChild(ov);
    const onKey = (e) => e.key === 'Escape' && close(null);
    const close = (v) => { ov.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('mousedown', (e) => e.target === ov && close(null));
    $('[data-x]', ov).onclick = () => close(null);
    $$('[data-i]', ov).forEach((b) => { b.onclick = async () => {
      const a = actions[+b.dataset.i];
      if (a.value == null || !onAction) return close(a.value ?? null);
      b.disabled = true;
      try { const r = await onAction(a.value, ov); if (r !== false) close(r ?? a.value); } catch { /* 오류 토스트 후 유지 */ } finally { b.disabled = false; }
    }; });
    onOpen?.(ov);
    $('input:not([type=hidden]),textarea,select', ov)?.focus();
  });
}
export const confirmBox = (title, msg, danger) => modal({ title, body: html`<p style="margin:0;white-space:pre-line">${msg}</p>`,
  actions: [{ label: '취소', value: null }, { label: '확인', kind: danger ? 'danger' : 'primary', value: true }] });
export const askText = (title, { label = '사유', min = 5, value = '' } = {}) => modal({
  title, body: html`<div class="field"><label>${label}${min ? ` (${min}자 이상)` : ''}</label><textarea class="textarea" name="t">${value}</textarea></div>`,
  actions: [{ label: '취소', value: null }, { label: '확인', kind: 'primary', value: 'ok' }],
  onAction: (_, el) => { const t = $('[name=t]', el).value.trim(); if (t.length < min) { toast(`${min}자 이상 입력해 주세요.`, 'bad'); return false; } return t; } });
export const formData = (el) => Object.fromEntries($$('[name]', el).map((i) => [i.name, i.type === 'checkbox' ? i.checked : i.value]));

// ── 표시 헬퍼 ──
const ST = { draft: ['작성중', 'muted'], submitted: ['제출', 'info'], approved: ['승인', 'ok'], rejected: ['반려', 'bad'], revise: ['수정 요청', 'warn'],
  none: ['미작성', 'muted'], assigned: ['작성 대기', 'warn'], open: ['처리 대기', 'warn'], done: ['승인 처리', 'ok'] };
export const chip = (s, label) => { const [l, k] = ST[s] || [s, 'muted']; return html`<span class="chip ${k}">${label || l}</span>`; };
export const grade = (g, lg) => html`<span class="grade ${g || ''} ${lg ? 'lg' : ''}">${g || '–'}</span>`;
export const avatar = (u, size = 32) => html`<span class="avatar" style="--h:${+u.hue || 220};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.36)}px">${(u.name || '?').slice(-2)}</span>`;
export const n1 = (v, d = 1) => (v == null ? '–' : Number(v).toFixed(d));
export const fdate = (s) => (s ? String(s).slice(0, 10).replaceAll('-', '.') : '–');
export function ago(s) {
  if (!s) return '';
  const d = (Date.now() - new Date(String(s).replace(' ', 'T') + (String(s).includes('T') ? '' : 'Z'))) / 1000;
  return d < 60 ? '방금' : d < 3600 ? `${Math.floor(d / 60)}분 전` : d < 86400 ? `${Math.floor(d / 3600)}시간 전` : d < 86400 * 30 ? `${Math.floor(d / 86400)}일 전` : fdate(s);
}
export const dday = (due) => { if (!due) return null; const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((new Date(due + 'T00:00:00') - t) / 86400000); };
export const bar = (pct, color) => html`<div class="progress"><i data-w="${Math.max(0, Math.min(100, pct || 0))}" ${color ? raw(`style="background:${esc(color)}"`) : ''}></i></div>`;
export function ring(pct, size = 76, color = 'var(--brand)', label) {
  const r = size / 2 - 7, c = 2 * Math.PI * r, off = c * (1 - Math.min(100, Math.max(0, pct || 0)) / 100), h = size / 2;
  return html`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${label ?? Math.round(pct) + '%'}">
    <circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="8"/>
    <circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}"
      data-off="${off}" transform="rotate(-90 ${h} ${h})" style="transition:stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-weight="800" font-size="${size * 0.22}" fill="var(--ink)">${label ?? Math.round(pct || 0) + '%'}</text></svg>`;
}
export const head = (title, sub, actions = '') => html`<div class="page-head"><div><h1>${title}</h1>${sub ? html`<p>${sub}</p>` : ''}</div><div class="row wrap">${actions}</div></div>`;
export const empty = (ic, text) => html`<div class="empty">${icon(ic)}<span>${text}</span></div>`;

// ── 차트 (dataviz 팔레트: 시리즈 고정 순서, 단일 축, 2개 이상 시리즈만 범례) ──
const charts = new Set();
export const cssv = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
export function chart(canvas, cfg) {
  const C = window.Chart;
  C.defaults.font.family = getComputedStyle(document.body).fontFamily;
  C.defaults.color = cssv('--muted');
  C.defaults.borderColor = cssv('--line');
  const c = new C(canvas, cfg); charts.add(c); return c;
}
export const baseOpts = ({ legend = false, suffix = '', y = 'x', max } = {}) => ({
  responsive: true, maintainAspectRatio: false, indexAxis: y, animation: { duration: 900, easing: 'easeOutQuart' },
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { display: legend, position: 'top', align: 'end', labels: { boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 3 } },
    tooltip: { padding: 10, cornerRadius: 10, callbacks: { label: (c) => ` ${c.dataset.label}: ${c.formattedValue}${suffix}` } } },
  scales: { x: { grid: { display: y === 'y' }, beginAtZero: true, ...(y === 'y' && max ? { max } : {}) },
    y: { grid: { display: y !== 'y' }, beginAtZero: true, ...(y !== 'y' && max ? { max } : {}) } },
});
export function distChart(canvas, dist, guide) {
  const keys = Object.keys(dist), total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  return chart(canvas, { type: 'bar', data: { labels: keys, datasets: [
    { label: '실제 분포', data: keys.map((k) => Math.round((dist[k] / total) * 100)), backgroundColor: cssv('--s1'), borderRadius: 4, maxBarThickness: 28 },
    { label: '배분 가이드', data: keys.map((k) => guide[k] ?? 0), backgroundColor: cssv('--gB'), borderRadius: 4, maxBarThickness: 28 }] },
    options: baseOpts({ legend: true, suffix: '%' }) });
}

// ── 셸 · 라우터 ──
export const S = { boot: null, page: '', routes: {}, menu: [] };
const PAGE_LABEL = { me: '피평가자', review: '평가자', admin: '관리자' };

export function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
export function applyBrand(b = {}) {
  if (b.color) document.documentElement.style.setProperty('--brand', b.color);
  document.title = `${b.company || 'KPC'} ${b.product || 'HR SYSTEM'}`;
}
export function mergeMenu(defs, override) {
  if (!override?.length) return defs;
  const by = Object.fromEntries(defs.map((m) => [m.key, m]));
  const out = override.filter((o) => by[o.key]).map((o) => ({ ...by[o.key], label: o.label || by[o.key].label, hidden: o.key !== 'home' && !!o.hidden }));
  return out.concat(defs.filter((d) => !override.some((o) => o.key === d.key)));
}

export async function start({ page, menu, routes }) {
  applyTheme(ls.get('kpc-theme'));
  S.boot = await api('/api/boot?page=' + page);
  Object.assign(S, { page, routes, menu: mergeMenu(menu, S.boot.layout?.menu) });
  applyBrand(S.boot.brand);
  renderShell();
  addEventListener('hashchange', route);
  addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); cmdk(); } });
  await route();
  if (S.boot.me.must_change) changePassword(true);
}

function renderShell() {
  const { me, pages, cycle, brand, unread } = S.boot;
  mount(document.body, html`<div class="shell ${ls.get('kpc-collapsed') === '1' ? 'collapsed' : ''}">
    <aside class="sidebar">
      <a class="brand" href="#/home"><span class="orb"></span><span>${brand.company || 'KPC'}<small>${brand.product || 'HR SYSTEM'} · ${PAGE_LABEL[S.page]}</small></span></a>
      <nav class="nav">${S.menu.filter((m) => !m.hidden).map((m) => html`<a href="#/${m.key}" data-key="${m.key}" title="${m.label}">${icon(m.icon)}<span>${m.label}</span></a>`)}</nav>
      <div class="side-foot">
        <a href="/manual?role=${S.page}" target="_blank" rel="noopener">${icon('book-open')}<span>사용 매뉴얼</span></a>
        <button data-act="collapse">${icon('panel-left')}<span>사이드바 접기</span></button>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn menu-toggle" data-act="mobile" aria-label="메뉴">${icon('menu')}</button>
        <h2 id="title"></h2>
        ${cycle ? html`<span class="cycle-chip" title="현재 평가 주기"><span class="pulse"></span>${cycle.name} · ${cycle.phase_label}</span>` : ''}
        <div class="right row">
          <button class="search-btn" data-act="cmdk">${icon('search')}<span>빠른 이동</span><kbd>Ctrl K</kbd></button>
          ${pages.length > 1 ? html`<div class="seg pages">${pages.map((p) => html`<a href="/app/${p}" class="${p === S.page ? 'on' : ''}">${PAGE_LABEL[p]}</a>`)}</div>` : ''}
          <button class="icon-btn" data-act="theme" title="라이트/다크 전환" aria-label="테마 전환">${icon('sun-moon')}</button>
          <div style="position:relative"><button class="icon-btn" data-act="notif" aria-label="알림">${icon('bell')}${unread ? html`<span class="dot-badge">${unread}</span>` : ''}</button></div>
          <div style="position:relative"><button data-act="user" style="border:0;background:none;cursor:pointer;padding:0" aria-label="내 계정">${avatar(me, 38)}</button></div>
        </div>
      </header>
      <main class="view" id="view"></main>
    </div></div>`);
  document.body.addEventListener('click', onShellClick);
}

function closeFloating() { $$('.dropdown').forEach((d) => d.remove()); }
async function onShellClick(e) {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!e.target.closest('.dropdown') && act !== 'notif' && act !== 'user') closeFloating();
  if (!act) return;
  const shell = $('.shell');
  if (act === 'collapse') { shell.classList.toggle('collapsed'); ls.set('kpc-collapsed', shell.classList.contains('collapsed') ? '1' : '0'); }
  if (act === 'mobile') shell.classList.toggle('mobile-open');
  if (act === 'cmdk') cmdk();
  if (act === 'theme') toggleTheme();
  if (act === 'notif') {
    const host = e.target.closest('[data-act]').parentElement;
    if ($('.dropdown', host)) return closeFloating();
    closeFloating();
    const list = await api('/api/notifications');
    host.appendChild(mount(Object.assign(document.createElement('div'), { className: 'dropdown' }), html`
      <div class="row between" style="padding:8px 12px"><b>알림</b><span class="muted small">${list.length}건</span></div>
      ${list.length ? list.map((n) => html`<a href="${n.link || '#'}" class="${n.read ? '' : 'unread'}">${icon('bell-dot', 'color:var(--brand);margin-top:2px')}
        <span class="grow"><span style="display:block;font-weight:600">${n.text}</span><span class="muted small">${ago(n.created_at)}</span></span></a>`) : empty('bell-off', '새 알림이 없습니다')}`));
    $('.dot-badge', host)?.remove();
    api('/api/notifications/read', { method: 'POST' });
  }
  if (act === 'user') {
    const host = e.target.closest('[data-act]').parentElement;
    if ($('.dropdown', host)) return closeFloating();
    const me = S.boot.me;
    host.appendChild(mount(Object.assign(document.createElement('div'), { className: 'dropdown', style: 'width:260px' }), html`
      <div class="row" style="padding:10px 12px">${avatar(me, 40)}<div><b>${me.name}</b><div class="muted small">${me.org_name} · ${me.position}${me.duty ? ' · ' + me.duty : ''}</div></div></div>
      <button data-pw>${icon('key-round')}비밀번호 변경</button>
      <a href="/manual" target="_blank">${icon('book-open')}사용 매뉴얼</a>
      <button data-logout>${icon('log-out')}로그아웃</button>`));
    $('[data-pw]', host).onclick = () => { closeFloating(); changePassword(false); };
    $('[data-logout]', host).onclick = logout;
  }
}
export async function logout() { await api('/api/auth/logout', { method: 'POST' }); location.href = '/login'; }
function toggleTheme() {
  const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const t = cur === 'dark' ? 'light' : 'dark';
  ls.set('kpc-theme', t); applyTheme(t); route();
}
export function changePassword(force) {
  return modal({
    title: force ? '임시 비밀번호를 변경해 주세요' : '비밀번호 변경',
    body: html`${force ? html`<div class="callout tip">${icon('shield-check')}처음 로그인하셨습니다. 보안을 위해 새 비밀번호를 설정해 주세요.</div>` : ''}
      <div class="field"><label>현재 비밀번호</label><input class="input" type="password" name="cur" autocomplete="current-password"></div>
      <div class="field"><label>새 비밀번호 (8자 이상)</label><input class="input" type="password" name="nw" autocomplete="new-password"></div>
      <div class="field"><label>새 비밀번호 확인</label><input class="input" type="password" name="nw2" autocomplete="new-password"></div>`,
    actions: [...(force ? [] : [{ label: '취소', value: null }]), { label: '변경', kind: 'primary', value: 'ok' }],
    onAction: async (_, el) => {
      const f = formData(el);
      if (f.nw !== f.nw2) { toast('새 비밀번호가 일치하지 않습니다.', 'bad'); return false; }
      await api('/api/me/password', { method: 'PUT', body: { current: f.cur, new: f.nw } });
      toast('비밀번호가 변경되었습니다.');
    },
  });
}

function cmdk() {
  if ($('.cmdk')) return;
  const items = [
    ...S.menu.filter((m) => !m.hidden).map((m) => ({ label: m.label, icon: m.icon, href: '#/' + m.key, sub: '메뉴' })),
    ...S.boot.pages.filter((p) => p !== S.page).map((p) => ({ label: `${PAGE_LABEL[p]} 페이지`, icon: 'arrow-right-left', href: '/app/' + p, sub: '페이지 전환' })),
    { label: '사용 매뉴얼', icon: 'book-open', href: '/manual', sub: '도움말' },
    { label: '라이트/다크 테마 전환', icon: 'sun-moon', run: toggleTheme, sub: '설정' },
    { label: '비밀번호 변경', icon: 'key-round', run: () => changePassword(false), sub: '계정' },
    { label: '로그아웃', icon: 'log-out', run: logout, sub: '계정' },
  ];
  const ov = mount(Object.assign(document.createElement('div'), { className: 'overlay' }), html`<div class="cmdk"><input placeholder="메뉴·기능 검색 (예: 목표, 결과, 테마)" aria-label="검색"><div class="cmdk-list"></div></div>`);
  document.body.appendChild(ov);
  const input = $('input', ov), list = $('.cmdk-list', ov);
  let sel = 0, shown = items;
  const close = () => ov.remove();
  const exec = (it) => { close(); if (it.run) it.run(); else location.href = it.href; };
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    shown = items.filter((i) => !q || i.label.toLowerCase().includes(q) || i.sub.includes(q));
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    mount(list, shown.length ? html`${shown.map((i, k) => html`<a href="#" data-k="${k}" class="${k === sel ? 'on' : ''}">${icon(i.icon)}<span class="grow">${i.label}</span><span class="muted small">${i.sub}</span></a>`)}` : empty('search-x', '결과가 없습니다'));
  };
  input.oninput = () => { sel = 0; draw(); };
  input.onkeydown = (e) => {
    if (e.key === 'ArrowDown') { sel = (sel + 1) % shown.length; draw(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { sel = (sel - 1 + shown.length) % shown.length; draw(); e.preventDefault(); }
    if (e.key === 'Enter' && shown[sel]) exec(shown[sel]);
    if (e.key === 'Escape') close();
  };
  list.onclick = (e) => { const a = e.target.closest('[data-k]'); if (a) { e.preventDefault(); exec(shown[+a.dataset.k]); } };
  ov.addEventListener('mousedown', (e) => e.target === ov && close());
  draw(); input.focus();
}

export async function route() {
  const [key = 'home', ...params] = location.hash.replace(/^#\/?/, '').split('/');
  const m = S.menu.find((x) => x.key === key);
  const fn = S.routes[key] || S.routes.home;
  charts.forEach((c) => c.destroy()); charts.clear(); closeFloating();
  $$('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.key === key));
  $('#title').textContent = m?.label || S.menu[0].label;
  $('.shell').classList.remove('mobile-open');
  const view = $('#view');
  view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');
  mount(view, html`<div class="skeleton" style="height:60px;width:40%;margin-bottom:20px"></div><div class="grid g3"><div class="skeleton" style="height:160px"></div><div class="skeleton" style="height:160px"></div><div class="skeleton" style="height:160px"></div></div>`);
  try { await fn(view, ...params.map(decodeURIComponent)); } catch (e) {
    console.error(e);
    if (e.status !== 401) mount(view, html`<div class="card">${empty('triangle-alert', '화면을 불러오지 못했습니다 — ' + e.message)}</div>`);
  }
}
export const go = (h) => { if (location.hash === h) route(); else location.hash = h; };

// ── 위젯 카드 · 드래그앤드롭 대시보드 (GridStack) ──
export function wcard(el, title, ic, body, actions = '') {
  mount(el, html`<div class="card-h">${icon(ic)}<h3>${title}</h3><div class="right row">${actions}</div></div><div class="w-body">${body}</div>`);
  return $('.w-body', el);
}
export function dashboard(view, { page, catalog, defaults, data, title, sub }) {
  const role = S.boot.layout, allow = role?.personalize !== false;
  const pick = (allow && S.boot.mylayout?.widgets) || role?.widgets || defaults;
  const layout = pick.filter((w) => catalog[w.id]);
  mount(view, html`${head(title, sub, allow && !matchMedia('(max-width: 900px)').matches ? html`<button class="btn" data-edit>${icon('layout-grid')}대시보드 편집</button>` : '')}<div id="editbar"></div><div class="grid-stack"></div>`);
  const grid = window.GridStack.init({ column: 12, cellHeight: 76, margin: 0, staticGrid: true, float: false, animate: true,
    columnOpts: { breakpoints: [{ w: 900, c: 1 }] } }, $('.grid-stack', view));
  const fill = (el, id) => {
    const box = $('.grid-stack-item-content', el);
    mount(box, html`<button class="icon-btn w-remove" data-rm aria-label="위젯 제거">${icon('x')}</button><div class="w-card"></div>`);
    $('[data-rm]', box).onclick = () => { grid.removeWidget(el); drawBar(); };
    try { catalog[id].render($('.w-card', box), data); } catch (err) { console.error(id, err); }
  };
  const narrow = matchMedia('(max-width: 900px)').matches;  // 1열(모바일): 위→아래, 왼→오 순서로 쌓기
  grid.batchUpdate();
  (narrow ? [...layout].sort((a, b) => a.y - b.y || a.x - b.x) : layout)
    .forEach((w) => fill(grid.addWidget(narrow ? { id: w.id, h: w.id === 'hero' ? w.h + 2 : w.h, autoPosition: true } : { id: w.id, x: w.x, y: w.y, w: w.w, h: w.h }), w.id));
  grid.batchUpdate(false);
  const drawBar = () => {
    const bar = $('#editbar', view);
    if (!view.classList.contains('editing')) return mount(bar, '');
    const used = new Set(grid.save(false).map((w) => w.id));
    mount(bar, html`<div class="edit-bar wrap">${icon('move')}<b>편집 모드</b><span class="muted small">위젯을 끌어 옮기고, 모서리로 크기를 바꾸세요.</span>
      <div class="palette">${Object.entries(catalog).filter(([id]) => !used.has(id)).map(([id, w]) => html`<button class="palette-item" data-add="${id}">${icon('plus')}${w.title}</button>`)}</div>
      <div class="right row"><button class="btn sm ghost" data-reset>기본값</button><button class="btn sm" data-cancel>취소</button><button class="btn sm primary" data-save>저장</button></div></div>`);
    $$('[data-add]', bar).forEach((b) => { b.onclick = () => { const w = catalog[b.dataset.add]; fill(grid.addWidget({ id: b.dataset.add, w: w.w, h: w.h, autoPosition: true }), b.dataset.add); drawBar(); }; });
    $('[data-cancel]', bar).onclick = () => route();
    $('[data-reset]', bar).onclick = async () => { await api('/api/me/layout/' + page, { method: 'DELETE' }); S.boot.mylayout = null; toast('기본 레이아웃으로 복원했습니다.'); route(); };
    $('[data-save]', bar).onclick = async () => {
      const widgets = grid.save(false).map(({ id, x, y, w, h }) => ({ id, x, y, w, h }));
      await api('/api/me/layout/' + page, { method: 'PUT', body: { widgets } });
      S.boot.mylayout = { widgets }; toast('나만의 대시보드를 저장했습니다.'); route();
    };
  };
  $('[data-edit]', view)?.addEventListener('click', () => { view.classList.add('editing'); grid.setStatic(false); drawBar(); });
  return grid;
}

// ── 칭찬·피드백 (피평가자/평가자 공용) ──
const TAGS = ['전문성', '협업·소통', '책임감', '도전·혁신', '고객지향'];
export async function kudosView(view) {
  let scope = 'all';
  const draw = async () => {
    const list = await api('/api/kudos?scope=' + scope);
    mount(view, html`${head('칭찬·피드백', '동료의 기여를 바로 인정하세요. 평가 점수와는 별개로 성장 기록에 남습니다.', html`<button class="btn primary" data-send>${icon('send')}칭찬 보내기</button>`)}
      <div class="tabs"><button class="${scope === 'all' ? 'on' : ''}" data-s="all">전사 피드</button><button class="${scope === 'me' ? 'on' : ''}" data-s="me">나와 관련된</button></div>
      <div class="grid g3 stagger">${list.length ? list.map((k) => html`<div class="card tilt">
        <div class="row">${avatar({ name: k.from_name, hue: k.from_hue }, 34)}${icon('arrow-right', 'color:var(--faint)')}${avatar({ name: k.to_name, hue: k.to_hue }, 34)}
          <div class="grow small"><b>${k.from_name}</b> → <b>${k.to_name}</b><div class="muted">${ago(k.created_at)}</div></div></div>
        <p style="margin:12px 0 10px">${k.message}</p><span class="chip info plain">#${k.tag}</span></div>`) : html`<div class="card">${empty('heart', '아직 칭찬이 없습니다')}</div>`}</div>`);
    $$('[data-s]', view).forEach((b) => { b.onclick = () => { scope = b.dataset.s; draw(); }; });
    $('[data-send]', view).onclick = sendKudos;
  };
  const sendKudos = () => {
    let target = null;
    return modal({ title: '칭찬 보내기', body: html`
      <div class="field"><label>받는 사람</label><input class="input" name="q" placeholder="이름 또는 조직 검색" autocomplete="off"><div class="list" id="ppl"></div></div>
      <div class="field"><label>핵심 가치</label><div class="seg" id="tags">${TAGS.map((t, i) => html`<button type="button" class="${i ? '' : 'on'}" data-t="${t}">${t}</button>`)}</div></div>
      <div class="field"><label>메시지 (5자 이상)</label><textarea class="textarea" name="msg" placeholder="구체적인 행동과 영향을 적어 주세요."></textarea></div>`,
    actions: [{ label: '취소', value: null }, { label: '보내기', kind: 'primary', value: 'ok' }],
    onOpen: (el) => {
      const q = $('[name=q]', el), box = $('#ppl', el);
      let timer;
      q.oninput = () => { clearTimeout(timer); timer = setTimeout(async () => {
        if (!q.value.trim()) return mount(box, '');
        const ppl = (await api('/api/people?q=' + encodeURIComponent(q.value))).filter((p) => p.id !== S.boot.me.id).slice(0, 5);
        mount(box, html`${ppl.map((p) => html`<a href="#" data-id="${p.id}" data-name="${p.name}">${avatar(p, 28)}<b>${p.name}</b><span class="muted small">${p.org_name} · ${p.position}</span></a>`)}`);
      }, 200); };
      box.onclick = (e) => { const a = e.target.closest('[data-id]'); if (!a) return; e.preventDefault(); target = +a.dataset.id; q.value = a.dataset.name; mount(box, ''); };
      $('#tags', el).onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; $$('#tags button', el).forEach((x) => x.classList.toggle('on', x === b)); };
    },
    onAction: async (_, el) => {
      if (!target) { toast('받는 사람을 목록에서 선택해 주세요.', 'bad'); return false; }
      await api('/api/kudos', { method: 'POST', body: { to_id: target, tag: $('#tags .on', el).dataset.t, message: $('[name=msg]', el).value.trim() } });
      toast('칭찬을 보냈습니다 🎉'); draw();
    } });
  };
  await draw();
}
