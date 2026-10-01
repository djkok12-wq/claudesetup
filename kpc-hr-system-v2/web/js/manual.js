// 매뉴얼 — 역할 필터 · 검색 · 목차 스크롤스파이 · 점수 시뮬레이터 (로그인 불필요)
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* 차단 */ } } };
const setTheme = (t) => { if (t) document.documentElement.dataset.theme = t; };
setTheme(store.get('kpc-theme'));
fetch('/api/brand').then((r) => r.json()).then((b) => { if (b.color) document.documentElement.style.setProperty('--brand', b.color); }).catch(() => {});

const secs = $$('.m-sec');
$('#toc').innerHTML = secs.map((s) => `<a href="#${s.id}" data-id="${s.id}">${s.querySelector('h2').textContent.replace(/^\d+/, '').trim()}</a>`).join('');
let role = new URLSearchParams(location.search).get('role') || 'all', query = '';
const apply = () => {
  secs.forEach((s) => {
    const roleOk = role === 'all' || s.dataset.roles === 'all' || s.dataset.roles.split(' ').includes(role);
    const textOk = !query || s.textContent.toLowerCase().includes(query);
    s.hidden = !(roleOk && textOk);
    $(`#toc [data-id="${s.id}"]`).hidden = s.hidden;
  });
  $$('#roleSeg button').forEach((b) => b.classList.toggle('on', b.dataset.r === role));
};
$('#roleSeg').onclick = (e) => { const b = e.target.closest('[data-r]'); if (b) { role = b.dataset.r; apply(); } };
$('#q').oninput = (e) => { query = e.target.value.trim().toLowerCase(); apply(); };
$('#printBtn').onclick = () => print();
$('#theme').onclick = () => {
  const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const t = cur === 'dark' ? 'light' : 'dark'; store.set('kpc-theme', t); setTheme(t);
};
const io = new IntersectionObserver((es) => es.forEach((e) => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in');
  $$('#toc a').forEach((a) => a.classList.toggle('on', a.dataset.id === e.target.id));
}), { rootMargin: '-20% 0px -60% 0px' });
secs.forEach((s) => io.observe(s));
setTimeout(() => secs.slice(0, 2).forEach((s) => s.classList.add('in')), 50);

// 점수 시뮬레이터 — 서버 scoring.compute와 같은 규칙
const W = { member: [40, 40, 20], leader: [50, 30, 20] }, CONV = [[110, 100], [100, 90], [90, 80], [80, 70], [0, 60]];
const GR = [['S', 95, '#184f95'], ['A', 85, '#3987e5'], ['B', 75, '#64748b'], ['C', 65, '#e34948'], ['D', 0, '#8f2424']];
let scheme = 'member';
const sim = () => {
  const v = (id) => +$('#' + id).value, rate = v('rate'), comp = v('comp'), extra = v('extra'), adj = v('adj');
  const g = CONV.find(([t]) => rate >= t)[1], [wg, wc, we] = W[scheme];
  const base = (g * wg + comp * 20 * wc + extra * 20 * we) / 100, final = Math.max(0, Math.min(100, base + adj));
  const [gr, , col] = GR.find(([, c]) => final >= c);
  $('#vRate').textContent = rate + '%'; $('#vComp').textContent = comp.toFixed(1); $('#vExtra').textContent = extra.toFixed(1); $('#vAdj').textContent = (adj > 0 ? '+' : '') + adj;
  $('#simOut').innerHTML = `<div style="text-align:center"><div style="width:120px;height:120px;border-radius:28px;display:grid;place-items:center;margin:0 auto 12px;font-size:64px;font-weight:900;color:#fff;background:linear-gradient(160deg,${col},#0f172a);box-shadow:0 20px 40px -16px ${col};transition:all .3s">${gr}</div>
    <div style="font-size:28px;font-weight:900" class="num">${final.toFixed(1)}점</div>
    <div class="muted small">목표 ${g}×${wg}% + 역량 ${(comp * 20).toFixed(0)}×${wc}% + ${scheme === 'leader' ? '조직관리' : '자기개발'} ${(extra * 20).toFixed(0)}×${we}% ${adj ? (adj > 0 ? '+ ' : '− ') + Math.abs(adj) : ''}</div></div>`;
};
$('#sim').addEventListener('input', sim);
$('#simScheme').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; scheme = b.dataset.s; $$('#simScheme button').forEach((x) => x.classList.toggle('on', x === b)); sim(); };
sim(); apply();
addEventListener('load', () => window.lucide?.createIcons());
