// 로그인 — Three.js 3D 조직 네트워크 씬 + 인증
import * as THREE from '../vendor/three.module.min.js';

const $ = (s) => document.querySelector(s);
const DEMO_PW = 'demo1234!';
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* 차단 */ } } };

async function init() {
  window.lucide?.createIcons();
  const brand = await fetch('/api/brand').then((r) => r.json()).catch(() => ({}));
  if (brand.color) document.documentElement.style.setProperty('--brand', brand.color);
  $('#brandName').textContent = `${brand.company || 'KPC'} ${brand.product || 'HR SYSTEM'}`;
  if (brand.loginTitle) $('#title').textContent = brand.loginTitle;
  if (brand.loginSub) $('#sub').textContent = brand.loginSub;
  if (!brand.demo) $('#demoBox').remove();
  const saved = store.get('kpc-login');
  if (saved) { $('#login').value = saved; $('#remember').checked = true; $('#password').focus(); } else $('#login').focus();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || brand.motion === false;
  scene(brand.color || '#3b5bfd', reduce);
  tiltPanel();
}

async function login(id, pw) {
  const btn = $('#submit'), err = $('#err');
  btn.disabled = true; btn.innerHTML = '<span class="pulse" style="background:#fff"></span> 확인 중…'; err.textContent = '';
  try {
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: id, password: pw }) });
    const data = await res.json();
    if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : '입력값을 확인해 주세요.');
    store.set('kpc-login', $('#remember').checked ? id : null);
    const next = new URLSearchParams(location.search).get('next');
    document.body.style.transition = 'opacity .4s'; document.body.style.opacity = '0';
    setTimeout(() => { location.href = next && next.startsWith('/app/') ? next : data.home; }, 350);
  } catch (e) {
    err.textContent = e.message;
    const p = $('#panel'); p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake');
    btn.disabled = false; btn.innerHTML = '<i data-lucide="log-in"></i>로그인'; window.lucide?.createIcons();
  }
}

$('#form').addEventListener('submit', (e) => { e.preventDefault(); login($('#login').value.trim(), $('#password').value); });
$('#eye').addEventListener('click', () => { const p = $('#password'); p.type = p.type === 'password' ? 'text' : 'password'; });
$('#password').addEventListener('keyup', (e) => { $('#caps').hidden = !e.getModifierState?.('CapsLock'); });
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-demo]');
  if (!b) return;
  $('#login').value = `${b.dataset.demo}@kpc.demo`; $('#password').value = DEMO_PW;
  login($('#login').value, DEMO_PW);
});

function tiltPanel() {
  const p = $('#panel');
  addEventListener('mousemove', (e) => {
    const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
    p.style.transform = `perspective(1200px) rotateY(${x * -5}deg) rotateX(${y * 5}deg)`;
  });
}

// ── 3D 씬: 조직 네트워크 지구 + 궤도 링(평가 흐름) + 별 입자 ──
function scene(hex, reduce) {
  const canvas = $('#scene');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { return; } // WebGL 미지원 → 오로라 배경만
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const sc = new THREE.Scene();
  sc.fog = new THREE.FogExp2(0x070a1a, 0.06);
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  cam.position.set(0, 0, 9);
  const brand = new THREE.Color(hex), cyan = new THREE.Color('#67e8f9'), violet = new THREE.Color('#a78bfa');

  const world = new THREE.Group();
  world.position.x = innerWidth > 900 ? 0.6 : 0;
  sc.add(world);
  const ico = new THREE.IcosahedronGeometry(2.4, 3);
  const nodes = new THREE.Points(ico, new THREE.PointsMaterial({ color: cyan, size: 0.07, transparent: true, opacity: 0.95 }));
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(ico), new THREE.LineBasicMaterial({ color: brand, transparent: true, opacity: 0.28 }));
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 1), new THREE.MeshBasicMaterial({ color: violet, wireframe: true, transparent: true, opacity: 0.35 }));
  const glow = new THREE.Mesh(new THREE.SphereGeometry(2.3, 48, 48), new THREE.MeshBasicMaterial({ color: brand, transparent: true, opacity: 0.08 }));
  world.add(nodes, wire, core, glow);

  const rings = [0, 1, 2].map((i) => {
    const g = new THREE.Group();
    const r = 3.1 + i * 0.45;
    g.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 8, 160), new THREE.MeshBasicMaterial({ color: i === 1 ? violet : cyan, transparent: true, opacity: 0.5 })));
    const sat = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    g.add(sat);
    g.rotation.set(Math.PI / 2.4 + i * 0.5, i * 0.8, i * 0.3);
    g.userData = { r, sat, speed: 0.5 - i * 0.12, phase: i * 2 };
    world.add(g);
    return g;
  });

  const N = 1400, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 8 + Math.random() * 18, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
    pos.set([r * Math.sin(p) * Math.cos(t), r * Math.sin(p) * Math.sin(t), r * Math.cos(p)], i * 3);
  }
  const starsGeo = new THREE.BufferGeometry();
  starsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xc7d2fe, size: 0.05, transparent: true, opacity: 0.7 }));
  sc.add(stars);

  const mouse = { x: 0, y: 0 };
  addEventListener('pointermove', (e) => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; });
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
    world.position.x = innerWidth > 900 ? 0.6 : 0;
    world.scale.setScalar(innerWidth > 900 ? 1 : 0.7);
  };
  addEventListener('resize', resize); resize();

  const clock = new THREE.Clock();
  const frame = () => {
    const t = clock.getElapsedTime();
    world.rotation.y = t * 0.12; world.rotation.x = Math.sin(t * 0.2) * 0.12;
    core.rotation.y = -t * 0.3; core.rotation.z = t * 0.15;
    glow.scale.setScalar(1 + Math.sin(t * 1.6) * 0.03);
    nodes.material.size = 0.065 + Math.sin(t * 2) * 0.015;
    rings.forEach((g) => { const { r, sat, speed, phase } = g.userData; const a = t * speed + phase; sat.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); });
    stars.rotation.y = t * 0.01;
    cam.position.x += (mouse.x * 1.4 - cam.position.x) * 0.04;
    cam.position.y += (-mouse.y * 1.0 - cam.position.y) * 0.04;
    cam.lookAt(world.position.x * 0.5, 0, 0);
    renderer.render(sc, cam);
    if (!reduce) requestAnimationFrame(frame);
  };
  frame();
}

init();
