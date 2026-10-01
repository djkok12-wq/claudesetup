// UI 스튜디오 — 관리자가 역할별 대시보드·메뉴·브랜드를 드래그앤드롭으로 구성 (코드 수정 없이 즉시 게시)
import { $, $$, api, applyBrand, confirmBox, formData, head, html, icon, mount, S, toast } from './core.js';
import { CATALOG, DEFAULTS, MENUS } from './catalog.js';

const PAGES = [['me', '피평가자'], ['review', '평가자'], ['admin', '관리자']];
const SWATCH = ['#3b5bfd', '#2563eb', '#0ea5e9', '#0d9488', '#16a34a', '#7c3aed', '#db2777', '#ea580c', '#0f172a'];
let page = 'me', tab = 'layout';

export async function studioView(view) {
  mount(view, html`${head('UI 스튜디오', '코드 수정 없이 역할별 대시보드 위젯 배치, 사이드 메뉴 순서·이름·노출, 브랜드를 바꾸고 바로 게시합니다.',
    html`<div class="seg" data-pages>${PAGES.map(([k, l]) => html`<button data-p="${k}" class="${k === page ? 'on' : ''}">${l} 화면</button>`)}</div>`)}
    <div class="tabs">${[['layout', '대시보드 레이아웃', 'layout-grid'], ['menu', '메뉴 구성', 'menu'], ['brand', '브랜드·시스템', 'palette']].map(([k, l, ic]) => html`
      <button data-t="${k}" class="${k === tab ? 'on' : ''}">${icon(ic, 'width:15px;vertical-align:-3px')} ${l}</button>`)}</div><div id="st"></div>`);
  $('[data-pages]', view).onclick = (e) => { const b = e.target.closest('[data-p]'); if (b) { page = b.dataset.p; studioView(view); } };
  $$('.tabs [data-t]', view).forEach((b) => { b.onclick = () => { tab = b.dataset.t; studioView(view); }; });
  const box = $('#st', view);
  if (tab === 'brand') return brandTab(box);
  const saved = await api('/api/ad/layout/' + page);
  const state = { widgets: saved?.widgets || DEFAULTS[page], menu: saved?.menu?.length ? saved.menu : MENUS[page].map(({ key, label }) => ({ key, label, hidden: false })), personalize: saved?.personalize !== false };
  const publish = async () => {
    await api('/api/ad/layout/' + page, { method: 'PUT', body: state });
    if (page === S.page) Object.assign(S.boot, { layout: state });
    toast(`${PAGES.find(([k]) => k === page)[1]} 화면에 게시했습니다. 사용자가 새로고침하면 적용됩니다.`);
  };
  const reset = async () => { if (await confirmBox('기본값 복원', '이 화면의 레이아웃·메뉴를 기본값으로 되돌립니다.')) { await api('/api/ad/layout/' + page, { method: 'DELETE' }); toast('기본값으로 복원했습니다.'); studioView(view); } };
  if (tab === 'layout') layoutTab(box, state, publish, reset); else menuTab(box, state, publish, reset);
}

function layoutTab(box, state, publish, reset) {
  const cat = CATALOG[page];
  const valid = state.widgets.filter((w) => cat[w.id]);
  mount(box, html`<div class="grid" style="grid-template-columns:260px minmax(0,1fr);align-items:start">
    <div class="col" style="position:sticky;top:84px">
      <div class="card"><div class="card-h">${icon('blocks')}<h3>위젯 팔레트</h3></div><p class="muted small" style="margin:0 0 10px">캔버스로 끌어 놓으세요.</p><div class="col" id="pal" style="gap:8px"></div></div>
      <div class="card col"><label class="row"><input type="checkbox" data-personal ${state.personalize ? 'checked' : ''} style="accent-color:var(--brand)"><b>사용자 개인화 허용</b></label>
        <p class="muted small" style="margin:0">허용하면 각 사용자가 '대시보드 편집'으로 자신만의 배치를 저장할 수 있습니다.</p></div>
      <div class="col"><button class="btn primary" data-pub>${icon('rocket')}게시하기</button><button class="btn" data-reset>${icon('rotate-ccw')}기본값 복원</button>
        <a class="btn ghost" href="/app/${page}" target="_blank">${icon('external-link')}새 탭에서 확인</a></div>
    </div>
    <div class="card" style="background:var(--surface-2);min-height:640px"><div class="card-h">${icon('monitor')}<h3>캔버스 · 12열 그리드</h3><span class="right muted small">끌어서 이동 · 모서리로 크기 조절 · ✕로 제거</span></div>
      <div class="grid-stack" id="canvas"></div></div></div>`);
  const grid = window.GridStack.init({ column: 12, cellHeight: 64, margin: 0, float: true, acceptWidgets: true, removable: false }, $('#canvas', box));
  const fill = (el, id) => {
    const w = cat[id], c = $('.grid-stack-item-content', el);
    mount(c, html`<button class="icon-btn" data-rm style="position:absolute;top:8px;right:8px;z-index:3;width:30px;height:30px" aria-label="제거">${icon('x')}</button>
      <div class="w-card" style="align-items:center;justify-content:center;text-align:center;gap:6px;background:linear-gradient(135deg,var(--surface),var(--surface-2));cursor:move">
        <span class="todo-ic" style="background:var(--brand-soft);color:var(--brand)">${icon(w.icon)}</span><b>${w.title}</b><span class="muted small">${w.desc}</span></div>`);
    $('[data-rm]', c).onclick = () => { grid.removeWidget(el); sync(); };
  };
  const sync = () => {
    state.widgets = grid.save(false).map(({ id, x, y, w, h }) => ({ id, x, y, w, h }));
    const used = new Set(state.widgets.map((w) => w.id));
    mount($('#pal', box), html`${Object.entries(cat).filter(([id]) => !used.has(id)).map(([id, w]) => html`
      <div class="grid-stack-item" gs-id="${id}" gs-w="${w.w}" gs-h="${w.h}"><div class="grid-stack-item-content palette-item">${icon(w.icon)}${w.title}<span class="faint small right">${w.w}×${w.h}</span></div></div>`)}
      ${used.size === Object.keys(cat).length ? html`<span class="muted small">모든 위젯이 배치되었습니다.</span>` : ''}`);
    window.GridStack.setupDragIn('#pal .grid-stack-item', { appendTo: 'body', helper: 'clone' });
  };
  grid.batchUpdate();
  valid.forEach((w) => fill(grid.addWidget({ id: w.id, x: w.x, y: w.y, w: w.w, h: w.h }), w.id));
  grid.batchUpdate(false);
  grid.on('dropped', (_, __, node) => { const id = node.el.getAttribute('gs-id') || node.id; node.id = id; fill(node.el, id); sync(); });
  grid.on('change', sync);
  sync();
  $('[data-personal]', box).onchange = (e) => { state.personalize = e.target.checked; };
  $('[data-pub]', box).onclick = () => { sync(); publish(); };
  $('[data-reset]', box).onclick = reset;
}

function menuTab(box, state, publish, reset) {
  const defs = Object.fromEntries(MENUS[page].map((m) => [m.key, m]));
  const items = state.menu.filter((m) => defs[m.key]).concat(MENUS[page].filter((d) => !state.menu.some((m) => m.key === d.key)).map(({ key, label }) => ({ key, label, hidden: false })));
  mount(box, html`<div class="grid g2" style="align-items:start">
    <div class="card"><div class="card-h">${icon('menu')}<h3>사이드 메뉴</h3><span class="right muted small">끌어서 순서 변경 · 이름 수정 · 눈 아이콘으로 숨김</span></div>
      <div class="col" id="menu" style="gap:8px">${items.map((m) => html`<div class="pcard" data-key="${m.key}" style="cursor:default">
        <span data-handle style="cursor:grab;color:var(--faint)">${icon('grip-vertical')}</span>${icon(defs[m.key].icon, 'color:var(--brand)')}
        <input class="input sm grow" value="${m.label}" data-label maxlength="20">
        <button class="btn sm ghost" data-eye ${m.key === 'home' ? 'disabled title="홈은 숨길 수 없습니다"' : ''}>${icon(m.hidden ? 'eye-off' : 'eye')}</button></div>`)}</div>
      <div class="row" style="margin-top:14px"><button class="btn" data-reset>${icon('rotate-ccw')}기본값</button><button class="btn primary right" data-pub>${icon('rocket')}게시하기</button></div></div>
    <div class="card"><div class="card-h">${icon('eye')}<h3>미리보기</h3></div><div class="sidebar" style="position:static;height:auto;border:1px solid var(--line);border-radius:16px" id="pv"></div></div></div>`);
  const read = () => $$('#menu [data-key]', box).map((r) => ({ key: r.dataset.key, label: $('[data-label]', r).value.trim() || defs[r.dataset.key].label, hidden: r.dataset.hidden === '1' }));
  $$('#menu [data-key]', box).forEach((r, i) => { r.dataset.hidden = items[i].hidden ? '1' : '0'; });
  const preview = () => { state.menu = read(); mount($('#pv', box), html`<div class="brand"><span class="orb"></span><span>${S.boot.brand.company || 'KPC'}<small>${PAGES.find(([k]) => k === page)[1]}</small></span></div>
    <nav class="nav">${state.menu.filter((m) => !m.hidden).map((m, i) => html`<a class="${i ? '' : 'on'}">${icon(defs[m.key].icon)}<span>${m.label}</span></a>`)}</nav>`); };
  window.Sortable.create($('#menu', box), { handle: '[data-handle]', animation: 180, onEnd: preview });
  box.oninput = preview;
  box.onclick = (e) => { const b = e.target.closest('[data-eye]'); if (!b) return; const r = b.closest('[data-key]'); r.dataset.hidden = r.dataset.hidden === '1' ? '0' : '1';
    mount(b, icon(r.dataset.hidden === '1' ? 'eye-off' : 'eye')); r.style.opacity = r.dataset.hidden === '1' ? 0.5 : 1; preview(); };
  $$('#menu [data-key]', box).forEach((r) => { r.style.opacity = r.dataset.hidden === '1' ? 0.5 : 1; });
  $('[data-pub]', box).onclick = () => { preview(); publish(); };
  $('[data-reset]', box).onclick = reset;
  preview();
}

async function brandTab(box) {
  const b = await api('/api/brand');
  mount(box, html`<div class="grid g2" style="align-items:start">
    <form class="card col" id="bf"><div class="card-h">${icon('palette')}<h3>브랜드</h3></div>
      <div class="row"><div class="field grow"><label>회사명</label><input class="input" name="company" value="${b.company || ''}"></div><div class="field grow"><label>제품명</label><input class="input" name="product" value="${b.product || ''}"></div></div>
      <div class="field"><label>브랜드 컬러</label><div class="row wrap">${SWATCH.map((c) => html`<button type="button" data-sw="${c}" style="width:30px;height:30px;border-radius:9px;border:2px solid ${c === b.color ? 'var(--ink)' : 'transparent'};background:${c};cursor:pointer" aria-label="${c}"></button>`)}
        <input type="color" name="color" value="${b.color || '#3b5bfd'}" style="width:44px;height:32px;border:0;background:none"></div></div>
      <div class="field"><label>로그인 헤드라인</label><input class="input" name="loginTitle" value="${b.loginTitle || ''}"></div>
      <div class="field"><label>로그인 설명</label><input class="input" name="loginSub" value="${b.loginSub || ''}"></div>
      <label class="row"><input type="checkbox" name="motion" ${b.motion !== false ? 'checked' : ''} style="accent-color:var(--brand)"><b>3D 모션 사용</b><span class="muted small">로그인 3D 씬 애니메이션</span></label>
      <label class="row"><input type="checkbox" name="demo" ${b.demo ? 'checked' : ''} style="accent-color:var(--brand)"><b>데모 모드</b><span class="muted small">로그인 화면 데모 계정 버튼 · 데이터 초기화 허용</span></label>
      <div class="row"><button class="btn primary">${icon('save')}브랜드 저장</button><a class="btn ghost" href="/login" target="_blank">${icon('external-link')}로그인 화면 보기</a></div></form>
    <div class="col"><div class="card"><div class="card-h">${icon('eye')}<h3>미리보기</h3></div><div class="hero" id="bp" style="min-height:190px;border-radius:16px"></div></div>
      <div class="card col"><div class="card-h">${icon('database')}<h3>데모 데이터</h3></div><p class="muted small" style="margin:0">구성원 56명·3개 주기의 예시 DB로 초기화합니다. 데모 모드에서만 가능하며 모든 변경 사항이 사라집니다.</p>
        <button class="btn danger" data-demo-reset ${b.demo ? '' : 'disabled'}>${icon('database-zap')}데모 데이터 초기화</button></div></div></div>`);
  const f = $('#bf', box);
  const pv = () => { const v = formData(f); document.documentElement.style.setProperty('--brand', v.color);
    mount($('#bp', box), html`<div><div class="small" style="opacity:.8;font-weight:700">${v.company} ${v.product}</div><h2>${v.loginTitle || '성과가 연결되는 순간,'}</h2><p>${v.loginSub}</p></div><div class="row"><span class="btn primary">${icon('log-in')}로그인</span></div>`); };
  f.oninput = pv;
  f.onclick = (e) => { const s = e.target.closest('[data-sw]'); if (!s) return; $('[name=color]', f).value = s.dataset.sw; $$('[data-sw]', f).forEach((x) => { x.style.borderColor = x === s ? 'var(--ink)' : 'transparent'; }); pv(); };
  f.onsubmit = async (e) => { e.preventDefault(); const v = await api('/api/ad/brand', { method: 'PUT', body: formData(f) }); S.boot.brand = v; applyBrand(v); toast('브랜드를 저장했습니다.'); };
  $('[data-demo-reset]', box).onclick = async () => {
    if (!(await confirmBox('데모 데이터 초기화', '모든 데이터를 예시 DB로 되돌립니다. 계속할까요?', true))) return;
    await api('/api/ad/demo-reset', { method: 'POST' }); location.href = '/login';
  };
  pv();
}
