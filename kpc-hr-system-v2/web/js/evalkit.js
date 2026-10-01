// 평가 입력 공용 도구 — 5점 척도 버튼, 달성률 환산, 축하 애니메이션 (피평가자·평가자 페이지 공유)
import { $, $$, html } from './core.js';

export const SCALE = ['', '기대 크게 미달', '개선 필요', '기대 충족', '기대 초과', '탁월'];
export const CONV = [[110, 100], [100, 90], [90, 80], [80, 70], [0, 60]];
export const convert = (rate, table = CONV) => (rate == null ? null : (table.find(([t]) => rate >= t) || table.at(-1))[1]);
export const rating = (name, val, ro) => html`<div class="rating ${ro ? 'ro' : ''}" data-rate="${name}">${[1, 2, 3, 4, 5].map((v) => html`
  <button type="button" class="${+val === v ? 'on' : ''}" data-v="${v}" title="${SCALE[v]}">${v}</button>`)}</div>`;
export function bindRatings(root, onChange) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rate]:not(.ro) [data-v]');
    if (!b) return;
    const box = b.parentElement;
    $$('button', box).forEach((x) => x.classList.toggle('on', x === b));
    onChange?.(box.dataset.rate, +b.dataset.v);
  });
}
export const readRatings = (root) => Object.fromEntries($$('[data-rate]', root).map((r) => [r.dataset.rate, +($('.on', r)?.dataset.v || 0)]).filter(([, v]) => v));

export function confetti(n = 120) {
  const cv = Object.assign(document.createElement('canvas'), { width: innerWidth, height: innerHeight });
  cv.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:300';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d'), colors = ['#3b5bfd', '#22d3ee', '#a78bfa', '#fab219', '#1baf7a', '#e87ba4'];
  const ps = Array.from({ length: n }, () => ({ x: innerWidth / 2, y: innerHeight / 2.2, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 4,
    s: Math.random() * 7 + 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: colors[(Math.random() * colors.length) | 0] }));
  let t = 0;
  (function tick() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ps.forEach((p) => { p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
    if (++t < 160) requestAnimationFrame(tick); else cv.remove();
  })();
}


// ── SMART 자동 점검 (매뉴얼 용어 사전) ──
export const SMART = [['S', '구체성', (g) => (g.title || '').length >= 8 && (g.description || '').length >= 15],
  ['M', '측정 가능', (g) => (g.type === 'quant' ? g.target > 0 && !!g.unit : /\d|%|건|회|점|완료/.test(g.description || ''))],
  ['A', '달성 가능', (g) => g.weight >= 10 && g.weight <= 50], ['R', '관련성', (g) => !!g.kpi_id], ['T', '시간 제한', (g) => !!g.due]];
export const smartBadges = (g) => html`<div class="row" style="gap:4px" title="SMART 점검">${SMART.map(([k, l, f]) => html`
  <span class="chip plain ${f(g) ? 'ok' : 'muted'}" title="${l}: ${f(g) ? '충족' : '보완 필요'}">${k}</span>`)}</div>`;

