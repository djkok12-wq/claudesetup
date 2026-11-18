// ============================================================
//  SCENE : Three.js 3D 모델 생성 (평면 데이터 → 벽·바닥·개구부·가구·조명)
// ============================================================

const H = PLAN_META.ceiling, DOOR_H = PLAN_META.doorH, T = PLAN_META.wallT, HALF = T / 2;
const CX = 5985, CZ = 9100;
const WX = x => (x - CX) / 1000, WZ = z => (z - CZ) / 1000;

const state = {
  sel: { ...CONCEPTS[0].pick }, concept: 'warm',
  expand: false, dress: true, cutaway: false, ceiling: false,
  sash: true, cove: true, vat: false,
  light: 'day', kelvin: 3000, view: 'orbit',
};
try { const s = JSON.parse(localStorage.getItem('sim33-state') || 'null'); if (s && s.sel) { Object.assign(state, s, { view: 'orbit' }); for (const k in CATALOG) if (!CATALOG[k].items.some(i => i.id === state.sel[k])) state.sel[k] = CONCEPTS[0].pick[k]; } } catch (e) { }
function saveState() { try { localStorage.setItem('sim33-state', JSON.stringify(state)); } catch (e) { } }

// ---------- 렌더러 ----------
const viewport = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.prepend(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 300);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = .08;
controls.maxPolarAngle = Math.PI * .495; controls.minDistance = 3; controls.maxDistance = 45;
controls.screenSpacePanning = true;
function setOrbitHome() { const a = Math.max(viewport.clientWidth, 1) / Math.max(viewport.clientHeight, 1), k = a < 1.2 ? Math.min(1.9, 1.2 / a * .95) : 1; camera.fov = 40; camera.position.set(7.5 * k, 15.5 * k, 15 * k); controls.target.set(0, 0, .3); camera.updateProjectionMatrix(); controls.update(); }
setOrbitHome();

// ---------- 조명 ----------
const hemi = new THREE.HemisphereLight('#fdfbf7', '#c9bfb1', .9); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff4e5', 2.4);
sun.position.set(5, 14, 11); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
scene.add(sun); scene.add(sun.target);

function kelvinRGB(k) {
  const t = k / 100; let r, g, b;
  r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -.1332);
  g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -.0755);
  b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  const c = v => Math.max(0, Math.min(255, v)) / 255;
  return new THREE.Color(c(r), c(g), c(b));
}

// ---------- 재질 ----------
const slotMat = {}, texCache = {};
function getMat(slot) { return slotMat[slot] || (slotMat[slot] = new THREE.MeshStandardMaterial({ color: '#fff' })); }
function itemOf(slot) { const c = CATALOG[slot]; return c.items.find(i => i.id === state.sel[slot]) || c.items[0]; }
function texFor(item) {
  if (item.id in texCache) return texCache[item.id];
  const r = makeTexCanvas(item);
  if (!r) return (texCache[item.id] = null);
  const mk = (cs) => {
    const t = new THREE.CanvasTexture(r.canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = cs;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.repeat.set(1 / r.size[0], 1 / r.size[1]);
    if (r.rotate) { t.rotation = r.rotate; }
    return t;
  };
  const bumpy = ['tile', 'tambour', 'hex', 'brick', 'herring', 'wood', 'veneer', 'lime'].includes(item.tex.k);
  return (texCache[item.id] = { map: mk(THREE.SRGBColorSpace), bump: bumpy ? mk(THREE.NoColorSpace) : null, canvas: r.canvas });
}
function resolveItem(slot) {
  const it = itemOf(slot);
  if (it.color === 'ctop') { const c = itemOf('countertop'); return { ...c, rough: it.rough }; }
  return it;
}
function applySlot(slot) {
  const it = resolveItem(slot), m = getMat(slot), t = texFor(it);
  m.map = t ? t.map : null;
  m.bumpMap = t ? t.bump : null; m.bumpScale = it.tex && it.tex.k === 'tambour' ? 3 : 1.2;
  m.color.set(t ? '#ffffff' : /^#/.test(it.color) ? it.color : '#ffffff');
  m.roughness = it.rough ?? .7; m.metalness = it.metal ?? (it.glassy ? .35 : 0);
  m.envMapIntensity = it.glassy ? 1.6 : 1;
  m.needsUpdate = true;
}
function applyAll() { for (const k in CATALOG) applySlot(k); }

const FM = {}; // 고정 재질
function fm(key, color, rough = .8, metal = 0, extra = {}) { return FM[key] || (FM[key] = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra })); }
const MAT = {
  ext: () => fm('ext', '#d7d3cc', .95), cap: () => fm('cap', '#34312e', .9), plaster: () => fm('plaster', '#e4e0da', .95),
  ceiling: () => fm('ceil', '#f7f6f3', .95), sash: () => fm('sash', '#ecebe8', .5),
  glass: () => fm('glass', '#cfdde3', .05, 0, { transparent: true, opacity: .16, depthWrite: false, envMapIntensity: 2 }),
  carcass: () => fm('carc', '#2c2926', .9),
  boucle: () => fm('boucle', '#e5dfd3', 1), fabric2: () => fm('fab2', '#b9a68e', 1), linen: () => fm('linen', '#efebe4', 1),
  oakF: () => fm('oakF', '#b48a5e', .55), walnutF: () => fm('walF', '#5e412e', .5), black: () => fm('blk', '#1c1c1c', .45, .4),
  tv: () => fm('tv', '#0b0b0c', .25, .2), ceramic: () => fm('cer', '#f6f5f2', .15), steel: () => fm('steel', '#c9cbcc', .3, 1),
  rug: () => fm('rug', '#d6ccbd', 1), plant: () => fm('plant', '#5a7150', .8), pot: () => fm('pot', '#c8bba9', .9),
  entryDoor: () => fm('edoor', '#3d3f42', .5, .3), appliance: () => fm('app', '#e9e9e6', .4),
  led: () => fm('led', '#f3f0ea', 1, 0, { emissive: '#ffd9a8', emissiveIntensity: 0 }),
};

// ---------- 지오메트리 헬퍼 ----------
function worldUV(g) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    if (nx > .5) uv.setXY(i, p.getZ(i), p.getY(i));
    else if (ny > .5) uv.setXY(i, p.getX(i), -p.getZ(i));
    else uv.setXY(i, p.getX(i), p.getY(i));
  }
  uv.needsUpdate = true;
}
// mm 좌표 박스
function box(parent, x1, z1, x2, z2, y1, y2, mat, o = {}) {
  const [ax, bx] = x1 < x2 ? [x1, x2] : [x2, x1], [az, bz] = z1 < z2 ? [z1, z2] : [z2, z1];
  const g = new THREE.BoxGeometry(Math.max(1, bx - ax) / 1000, Math.max(1, y2 - y1) / 1000, Math.max(1, bz - az) / 1000);
  g.translate(WX((ax + bx) / 2), (y1 + y2) / 2000, WZ((az + bz) / 2));
  worldUV(g);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = o.cast ?? true; m.receiveShadow = true;
  if (o.slot) m.userData.slot = o.slot; if (o.room) m.userData.room = o.room; if (o.nopick) m.userData.nopick = true;
  parent.add(m); return m;
}
function cyl(parent, x, z, r, y1, y2, mat, seg = 24, o = {}) {
  const g = new THREE.CylinderGeometry(r / 1000, (o.r2 ?? r) / 1000, (y2 - y1) / 1000, seg);
  g.translate(WX(x), (y1 + y2) / 2000, WZ(z));
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
  if (o.slot) m.userData.slot = o.slot; parent.add(m); return m;
}

let ROOMS = [], OPEN = [], root, vertical, ceilGroup, uppers, furn, ledMeshes = [], roomLights = [];
let qty = {};
function roomAt(x, z) { return ROOMS.find(r => x > r.x1 && x < r.x2 && z > r.z1 && z < r.z2); }
function subtract(segs, a, b) { const out = []; for (const [s, t] of segs) { if (b <= s || a >= t) { out.push([s, t]); continue; } if (a > s) out.push([s, a]); if (b < t) out.push([b, t]); } return out; }

// ---------- 벽 ----------
function wallPiece(room, e, s, t, yA, yB, slot, solid) {
  if (t - s < 4 || yB - yA < 4) return;
  let x1, x2, z1, z2;
  if (e.line === 'h') { x1 = s; x2 = t; z1 = e.at; z2 = e.at + e.inward * HALF; }
  else { z1 = s; z2 = t; x1 = e.at; x2 = e.at + e.inward * HALF; }
  const inner = getMat(slot), pl = MAT.plaster();
  const mats = [pl, pl, MAT.cap(), pl, pl, pl];
  if (e.line === 'h') { mats[e.inward > 0 ? 4 : 5] = inner; mats[0] = mats[1] = inner; }
  else { mats[e.inward > 0 ? 0 : 1] = inner; mats[4] = mats[5] = inner; }
  box(vertical, x1, z1, x2, z2, yA, yB, mats, { slot, room: room.id });
  qty.wall[slot] = (qty.wall[slot] || 0) + (t - s) / 1000 * (yB - yA) / 1000;
  // 외벽 판정 → 바깥쪽 절반 추가
  const mid = (s + t) / 2, probe = e.line === 'h' ? [mid, e.at - e.inward * 150] : [e.at - e.inward * 150, mid];
  if (!roomAt(probe[0], probe[1])) {
    const ex = MAT.ext(), m2 = [ex, ex, MAT.cap(), ex, ex, ex];
    if (e.line === 'h') box(vertical, s, e.at, t, e.at - e.inward * (HALF + 40), yA, yB, m2, { nopick: true });
    else box(vertical, e.at, s, e.at - e.inward * (HALF + 40), t, yA, yB, m2, { nopick: true });
  }
  // 걸레받이
  if (solid && room.kind === 'dry' && yA <= 0) {
    const bb = itemOf('baseboard');
    const bm = bb.color === 'wall' ? getMat(slot) : bb.color === 'floor' ? getMat('floor_main') : fm('bb_' + bb.id, bb.color, bb.rough);
    const pr = bb.inset ? 1 : 10, f = HALF;
    if (e.line === 'h') box(vertical, s, e.at + e.inward * f, t, e.at + e.inward * (f + pr), 0, bb.h, bm, { slot: 'baseboard', cast: false });
    else box(vertical, e.at + e.inward * f, s, e.at + e.inward * (f + pr), t, 0, bb.h, bm, { slot: 'baseboard', cast: false });
    qty.base += (t - s) / 1000;
  }
}
function buildWalls(room) {
  const y0 = room.floorY || 0;
  const edges = [
    { name: 'top', line: 'h', at: room.z1, a: room.x1, b: room.x2, inward: 1 },
    { name: 'bottom', line: 'h', at: room.z2, a: room.x1, b: room.x2, inward: -1 },
    { name: 'left', line: 'v', at: room.x1, a: room.z1, b: room.z2, inward: 1 },
    { name: 'right', line: 'v', at: room.x2, a: room.z1, b: room.z2, inward: -1 },
  ];
  for (const e of edges) {
    const slot = room.feature && room.feature.edge === e.name ? room.feature.slot : room.wall;
    const ops = OPEN.filter(o => o.line === e.line && Math.abs(o.at - e.at) < 3 && o.a < e.b && o.b > e.a);
    let segs = [[e.a, e.b]];
    for (const o of ops) segs = subtract(segs, o.a, o.b);
    for (const [s, t] of segs) wallPiece(room, e, s, t, y0, H, slot, true);
    for (const o of ops) {
      const s = Math.max(o.a, e.a), t = Math.min(o.b, e.b);
      if (o.type === 'open') continue;
      if (['door', 'arch', 'entry', 'slide'].includes(o.type)) wallPiece(room, e, s, t, DOOR_H, H, slot);
      else { if (o.sill > 0) wallPiece(room, e, s, t, y0, o.sill, slot); if (o.head < H) wallPiece(room, e, s, t, o.head, H, slot); }
    }
  }
}

// ---------- 개구부 (도어·창호) ----------
function along(o, s, t, off1, off2, y1, y2, mat, parent = vertical, opt = {}) {
  // o.line 방향으로 s..t, 선에서 off1..off2 (mm) 만큼 떨어진 박스
  return o.line === 'h' ? box(parent, s, o.at + off1, t, o.at + off2, y1, y2, mat, opt) : box(parent, o.at + off1, s, o.at + off2, t, y1, y2, mat, opt);
}
function glassPanel(o, s, t, y1, y2, off, frameMat, glassMat, prof = 40, dep = 40, parent = vertical) {
  along(o, s, s + prof, off - dep / 2, off + dep / 2, y1, y2, frameMat, parent, { slot: 'jungmun' });
  along(o, t - prof, t, off - dep / 2, off + dep / 2, y1, y2, frameMat, parent, { slot: 'jungmun' });
  along(o, s, t, off - dep / 2, off + dep / 2, y1, y1 + prof, frameMat, parent);
  along(o, s, t, off - dep / 2, off + dep / 2, y2 - prof, y2, frameMat, parent);
  const g = along(o, s + prof, t - prof, off - 4, off + 4, y1 + prof, y2 - prof, glassMat, parent, { nopick: true, cast: false });
  g.castShadow = false;
}
function buildOpening(o) {
  const dm = getMat('door');
  if (o.type === 'door') {
    const di = itemOf('door'), fw = 30;
    qty.doors++;
    along(o, o.a, o.a + fw, -HALF, HALF, 0, DOOR_H, dm, vertical, { slot: 'door' });
    along(o, o.b - fw, o.b, -HALF, HALF, 0, DOOR_H, dm, vertical, { slot: 'door' });
    along(o, o.a, o.b, -HALF, HALF, DOOR_H - fw, DOOR_H, dm, vertical, { slot: 'door' });
    if (!di.hidden) for (const sg of [-1, 1]) {
      const f1 = sg * HALF, f2 = sg * (HALF + 12);
      along(o, o.a - 55, o.a, f1, f2, 0, DOOR_H + 55, dm, vertical, { slot: 'door' });
      along(o, o.b, o.b + 55, f1, f2, 0, DOOR_H + 55, dm, vertical, { slot: 'door' });
      along(o, o.a - 55, o.b + 55, f1, f2, DOOR_H, DOOR_H + 55, dm, vertical, { slot: 'door' });
    }
    // 문짝 (90° 개방)
    const w = o.b - o.a - 2 * fw, hx = o.hinge === 'a' ? o.a + fw : o.b - fw, sd = o.hinge === 'a' ? 1 : -1;
    const f0 = o.swing * HALF, f1 = o.swing * (HALF + w);
    const leafX1 = hx, leafX2 = hx + sd * 38;
    const hm = fm('handle_' + di.id, di.handle || '#888', .3, .9);
    if (o.line === 'h') {
      box(vertical, leafX1, o.at + f0, leafX2, o.at + f1, 5, DOOR_H - fw - 3, dm, { slot: 'door' });
      box(vertical, leafX1 - sd * 25, o.at + o.swing * (HALF + w - 90), leafX2 + sd * 25, o.at + o.swing * (HALF + w - 70), 980, 1000, hm);
    } else {
      box(vertical, o.at + f0, leafX1, o.at + f1, leafX2, 5, DOOR_H - fw - 3, dm, { slot: 'door' });
      box(vertical, o.at + o.swing * (HALF + w - 90), leafX1 - sd * 25, o.at + o.swing * (HALF + w - 70), leafX2 + sd * 25, 980, 1000, hm);
    }
  } else if (o.type === 'arch') {
    along(o, o.a, o.a + 25, -HALF, HALF, 0, DOOR_H, dm, vertical, { slot: 'door' });
    along(o, o.b - 25, o.b, -HALF, HALF, 0, DOOR_H, dm, vertical, { slot: 'door' });
    along(o, o.a, o.b, -HALF, HALF, DOOR_H - 25, DOOR_H, dm, vertical, { slot: 'door' });
  } else if (o.type === 'entry') {
    const ed = MAT.entryDoor();
    along(o, o.a, o.b, -HALF, HALF, -120, -60, ed);
    along(o, o.a, o.a + 50, -HALF, HALF, -120, DOOR_H, ed); along(o, o.b - 50, o.b, -HALF, HALF, -120, DOOR_H, ed);
    along(o, o.a, o.b, -HALF, HALF, DOOR_H - 50, DOOR_H, ed);
    along(o, o.a + 50, o.b - 50, -25, 25, -60, DOOR_H - 50, ed);
    along(o, o.a + 120, o.a + 160, -60, -25, 900, 1200, MAT.steel());
  } else if (o.type === 'slide') {
    const j = itemOf('jungmun');
    if (!j.panels) return;
    const frame = fm('jf_' + j.id, j.color, .45, .6);
    const gl = fm('jg_' + j.id, j.glass, j.fluted ? .35 : .05, 0, { transparent: true, opacity: j.fluted ? .55 : .3, depthWrite: false });
    along(o, o.a, o.b, -55, 55, DOOR_H - 40, DOOR_H, frame, vertical, { slot: 'jungmun' });
    const W = o.b - o.a;
    if (j.panels === 3) { const pw = W / 3 + 25; for (let i = 0; i < 3; i++) glassPanel(o, o.a + i * 70, o.a + i * 70 + pw, 0, DOOR_H - 40, -40 + i * 40, frame, gl, 25, 30); }
    else if (j.panels === 1) { glassPanel(o, o.a + 20, o.a + 20 + W * .62, 0, DOOR_H - 40, 0, frame, gl, 35, 40); }
    else {
      glassPanel(o, o.b - 420, o.b, 0, DOOR_H - 40, 0, frame, gl, 45, 45);
      const w = W - 440, leaf = { line: o.line === 'h' ? 'v' : 'h', at: o.a + 30 };
      glassPanel(leaf, o.at + 30, o.at + 30 + w, 0, DOOR_H - 45, 0, frame, gl, 45, 45);
    }
  } else if (o.type === 'window' || o.type === 'slidewin') {
    const sm = MAT.sash(), gm = MAT.glass();
    const y1 = o.sill, y2 = o.head, p = 55, mid = (o.a + o.b) / 2;
    along(o, o.a, o.a + p, -60, 60, y1, y2, sm, vertical, { nopick: true }); along(o, o.b - p, o.b, -60, 60, y1, y2, sm, vertical, { nopick: true });
    along(o, o.a, o.b, -60, 60, y1, y1 + p, sm, vertical, { nopick: true }); along(o, o.a, o.b, -60, 60, y2 - p, y2, sm, vertical, { nopick: true });
    along(o, mid - 30, mid + 30, -60, 60, y1, y2, sm, vertical, { nopick: true });
    along(o, o.a + p, mid - 30, -24, -16, y1 + p, y2 - p, gm, vertical, { nopick: true, cast: false });
    along(o, mid + 30, o.b - p, 16, 24, y1 + p, y2 - p, gm, vertical, { nopick: true, cast: false });
  }
}

// ---------- 가구·붙박이 ----------
function cabinetRun(o, s, t, f1, f2, y1, y2, mat, slot, door = 600) {
  // o: {line, at} 기준선, s..t 길이 방향, f1..f2 깊이 방향(mm, 선 기준), 도어 분할 표현
  along(o, s, t, f1 * .99, f2 * .99, y1, y2, mat, furn, { slot });
  along(o, s, t, f1 + (f2 - f1) * .9, f2 - (f2 - f1) * .003, y1 + 1, y2 - 1, MAT.carcass(), furn, { slot });
  const n = Math.max(1, Math.round((t - s) / door)), w = (t - s) / n, front = Math.abs(f2) > Math.abs(f1) ? f2 : f1, sg = Math.sign(front);
  for (let i = 0; i < n; i++) along(o, s + i * w + 2, s + (i + 1) * w - 2, front - sg * 2, front + sg * 18, y1 + 2, y2 - 2, mat, furn, { slot });
}
function plant(x, z, s = 1) {
  cyl(furn, x, z, 170 * s, 0, 380 * s, MAT.pot(), 20, { r2: 140 * s });
  const g = new THREE.SphereGeometry(.32 * s, 14, 10); g.scale(1, 1.35, 1); g.translate(WX(x), (380 * s + 360 * s) / 1000, WZ(z));
  const m = new THREE.Mesh(g, MAT.plant()); m.castShadow = true; furn.add(m);
}
function pendant(x, z, y = 1550) {
  cyl(furn, x, z, 4, y, H, MAT.black(), 6);
  const g = new THREE.SphereGeometry(.13, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2); g.rotateX(Math.PI); g.translate(WX(x), y / 1000 + .13, WZ(z));
  const m = new THREE.Mesh(g, fm('shade', '#e8e2d6', .6, 0, { side: THREE.DoubleSide, emissive: '#ffd9a8', emissiveIntensity: 0 })); furn.add(m); ledMeshes.push(m);
}
function chair(x, z, rot) {
  const c = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(.44, .05, .44), MAT.oakF()); seat.position.y = .45;
  const back = new THREE.Mesh(new THREE.BoxGeometry(.44, .36, .04), MAT.oakF()); back.position.set(0, .68, -.2);
  c.add(seat, back);
  for (const [lx, lz] of [[-.19, -.19], [.19, -.19], [-.19, .19], [.19, .19]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .45), MAT.black()); l.position.set(lx, .225, lz); c.add(l); }
  c.traverse(m => { m.castShadow = true; }); c.position.set(WX(x), 0, WZ(z)); c.rotation.y = rot; furn.add(c);
}
function buildFurniture() {
  const kl = getMat('kitchen_lower'), ku = getMat('kitchen_upper'), ct = getMat('countertop'), bs = getMat('backsplash');
  const cl = getMat('closet'), sh = getMat('shoe'), fx = getMat('bath_fixture');
  // ── 거실
  box(furn, 4190, 10350, 4640, 12750, 180, 470, MAT.walnutF(), {}); // 플로팅 TV장
  box(furn, 4195, 10750, 4235, 12450, 950, 1900, MAT.tv());
  box(furn, 5000, 10500, 8150, 13000, 0, 8, MAT.rug(), { cast: false });
  box(furn, 7720, 10650, 8660, 13150, 0, 420, MAT.boucle()); // 소파
  box(furn, 8430, 10650, 8660, 13150, 420, 800, MAT.boucle());
  box(furn, 7720, 10650, 8660, 10850, 420, 620, MAT.boucle()); box(furn, 7720, 12950, 8660, 13150, 420, 620, MAT.boucle());
  for (const z of [10900, 11650, 12400]) box(furn, 7760, z, 8420, z + 720, 420, 520, MAT.linen());
  cyl(furn, 6500, 11900, 480, 0, 340, MAT.oakF(), 40);
  plant(4500, 13250, 1.1);
  // ── 주방 (ㄱ자: 북측벽 + 동측벽, 서측 키큰장)
  const kTop = { line: 'h', at: 5085 }, kRight = { line: 'v', at: 8010 }, kLeft = { line: 'v', at: 4090 };
  along(kTop, 5250, 7910, HALF, HALF + 580, 0, 100, MAT.carcass(), furn);
  cabinetRun(kTop, 5250, 7910, HALF, HALF + 580, 100, 870, kl, 'kitchen_lower');
  along(kTop, 5250, 7910, HALF, HALF + 620, 870, 900, ct, furn, { slot: 'countertop' });
  const kR = { line: 'v', at: 8010 };
  along(kR, 5785, 7100, -HALF, -HALF - 580, 0, 100, MAT.carcass(), furn);
  cabinetRun(kR, 5805, 7100, -HALF, -HALF - 580, 100, 870, kl, 'kitchen_lower');
  along(kR, 5785, 7100, -HALF, -HALF - 620, 870, 900, ct, furn, { slot: 'countertop' });
  box(furn, 7370, 6150, 7850, 6750, 900, 905, MAT.tv()); // 인덕션
  box(furn, 6150, 5330, 6950, 5730, 860, 901, MAT.steel()); // 싱크
  cyl(furn, 6550, 5260, 14, 900, 1250, MAT.steel(), 10);
  // 백스플래시
  along(kR, 5185, 7100, -HALF, -HALF - 8, 900, 1450, bs, furn, { slot: 'backsplash' });
  along(kTop, 7400, 7910, HALF, HALF + 8, 900, 1450, bs, furn, { slot: 'backsplash' });
  along(kTop, 5250, 7400, HALF, HALF + 8, 900, 1000, bs, furn, { slot: 'backsplash' });
  qty.wall.backsplash = (1.915 * .55 + .51 * .55 + 2.15 * .1);
  // 상부장 (동측벽)
  cabinetRun(kR, 5185, 7100, -HALF, -HALF - 350, 1450, 2280, ku, 'kitchen_upper', 480);
  along(kR, 5185, 7100, -HALF - 300, -HALF - 340, 1440, 1450, MAT.led(), uppers).userData.led = true;
  // 키큰장 (냉장고장, 서측벽)
  cabinetRun(kLeft, 5950, 7650, HALF, HALF + 650, 0, 2280, ku, 'kitchen_upper', 850);
  // 식탁
  box(furn, 5300, 7250, 6900, 8150, 720, 750, MAT.oakF());
  for (const x of [5450, 6750]) box(furn, x - 30, 7650, x + 30, 7750, 0, 720, MAT.black());
  for (const x of [5700, 6500]) { chair(x, 6950, 0); chair(x, 8450, Math.PI); }
  pendant(5750, 7700); pendant(6450, 7700);
  qty.klower = (7910 - 5250 + 7100 - 5785) / 1000; qty.kupper = (7100 - 5185 + 7650 - 5950) / 1000; qty.ctop = qty.klower;
  // ── 현관 신발장
  const eL = { line: 'v', at: 8010 };
  cabinetRun(eL, 4900, 7100, HALF, HALF + 400, 150, 1000, sh, 'shoe', 450);
  cabinetRun(eL, 4900, 7100, HALF, HALF + 400, 1380, 2280, sh, 'shoe', 450);
  along(eL, 4900, 7100, HALF, HALF + 400, 1000, 1010, sh, furn, { slot: 'shoe' });
  along(eL, 4900, 7100, HALF + 20, HALF + 380, 1370, 1380, MAT.led(), furn).userData.led = true;
  qty.shoe = 2.2;
  // ── 안방
  box(furn, 180, 10900, 2280, 12500, 0, 300, MAT.oakF());
  box(furn, 200, 10920, 2260, 12480, 300, 540, MAT.linen());
  box(furn, 1500, 10900, 2290, 12500, 520, 570, MAT.fabric2());
  box(furn, 100, 10800, 180, 12600, 0, 1150, MAT.boucle());
  for (const z of [11150, 11850]) box(furn, 220, z, 620, z + 520, 540, 680, MAT.linen());
  for (const z of [10300, 12650]) { box(furn, 120, z, 560, z + 420, 0, 480, MAT.oakF()); cyl(furn, 340, z + 210, 110, 480, 520, MAT.ceramic(), 16); }
  box(furn, 120, 10800, 160, 12600, 1150, 1165, MAT.led(), furn).userData.led = true;
  const mR = { line: 'v', at: 4090 };
  cabinetRun(mR, 10700, 13350, -HALF, -HALF - 600, 0, 2280, cl, 'closet', 500);
  qty.closet = 2.65;
  // ── 드레스룸
  if (state.dress) {
    const dR = { line: 'v', at: 2600 }, dT = { line: 'h', at: 7755 };
    cabinetRun(dR, 7855, 9590, -HALF, -HALF - 600, 0, 2280, cl, 'closet', 450);
    cabinetRun(dT, 1350, 1900, HALF, HALF + 600, 0, 2280, cl, 'closet', 550);
    qty.closet += 1.735 + .55;
  }
  // ── 침실2
  const b2T = { line: 'h', at: 10280 };
  cabinetRun(b2T, 9800, 11870, HALF, HALF + 600, 0, 2280, cl, 'closet', 520);
  qty.closet += 2.07;
  box(furn, 9850, 11500, 11790, 12650, 0, 280, MAT.oakF());
  box(furn, 9870, 11520, 11780, 12630, 280, 500, MAT.linen());
  box(furn, 9850, 11520, 10600, 12630, 480, 520, fm('throw2', '#9fb0bf', 1));
  box(furn, 11790, 11450, 11870, 12700, 0, 950, MAT.oakF());
  box(furn, 8880, 12300, 9480, 13300, 720, 750, MAT.oakF()); chair(9500, 12800, -Math.PI / 2);
  // ── 침실3 (서재)
  box(furn, 1845, 5600, 2445, 7200, 720, 750, MAT.oakF());
  box(furn, 1845, 5600, 1885, 7200, 0, 720, MAT.oakF()); box(furn, 2405, 5600, 2445, 7200, 0, 720, MAT.oakF());
  box(furn, 1845, 5700, 2145, 7100, 1400, 1420, MAT.oakF()); box(furn, 1845, 5700, 2145, 7100, 1800, 1820, MAT.oakF());
  chair(2700, 6400, -Math.PI / 2);
  box(furn, 3300, 5300, 3990, 6700, 0, 380, MAT.boucle()); box(furn, 3800, 5300, 3990, 6700, 380, 750, MAT.boucle());
  // ── 복도 수납
  const hC = { line: 'h', at: 9620 };
  cabinetRun(hC, 10000, 11870, HALF, HALF + 400, 0, 2280, cl, 'closet', 470);
  qty.closet += 1.87;
  // ── 욕실1 (샤워부스)
  const gl = MAT.glass(), fxm = fx;
  box(furn, 100, 6250, 900, 6260, 0, 2000, gl, { nopick: true, cast: false });
  box(furn, 895, 6250, 905, 6260, 0, 2000, fxm, { slot: 'bath_fixture' });
  box(furn, 100, 5185, 1645, 6250, 0, 30, getMat('bath_floor'), { slot: 'bath_floor', cast: false });
  cyl(furn, 400, 5400, 110, 2050, 2065, fxm, 24, { slot: 'bath_fixture' });
  box(furn, 120, 5380, 180, 5420, 1150, 2060, fxm, { slot: 'bath_fixture' });
  box(furn, 100, 5700, 160, 6100, 1100, 1400, MAT.led()).userData.led = true; // 니치 조명
  box(furn, 100, 6450, 650, 6850, 350, 750, MAT.ceramic(), { slot: 'bath_fixture' }); // 벽걸이 변기
  box(furn, 100, 6420, 160, 6880, 750, 1100, MAT.ceramic());
  box(furn, 1145, 6250, 1645, 6950, 450, 850, MAT.oakF());
  box(furn, 1145, 6250, 1645, 6950, 850, 870, MAT.ceramic());
  box(furn, 1630, 6300, 1645, 6900, 1050, 1850, fm('mirror', '#dfe6e8', .02, 1));
  box(furn, 1600, 6580, 1645, 6620, 900, 1050, fxm, { slot: 'bath_fixture' });
  // ── 욕실2 (욕조)
  box(furn, 11120, 7325, 11870, 9025, 0, 560, MAT.ceramic());
  box(furn, 11190, 7395, 11800, 8955, 380, 561, fm('water', '#d7e3e6', .05, 0));
  box(furn, 11850, 7600, 11870, 8800, 1100, 1350, MAT.led()).userData.led = true;
  box(furn, 11850, 8110, 11870, 8130, 900, 1900, fxm, { slot: 'bath_fixture' });
  box(furn, 11800, 8080, 11870, 8160, 1880, 1900, fxm, { slot: 'bath_fixture' });
  box(furn, 10100, 8920, 10500, 9520, 350, 750, MAT.ceramic(), { slot: 'bath_fixture' });
  box(furn, 10080, 9460, 10520, 9520, 750, 1100, MAT.ceramic());
  box(furn, 10000, 7325, 10900, 7805, 450, 850, MAT.oakF());
  box(furn, 10000, 7325, 10900, 7805, 850, 870, MAT.ceramic());
  box(furn, 10050, 7325, 10850, 7340, 1050, 1850, fm('mirror', '#dfe6e8', .02, 1));
  qty.baths = 2;
  // ── 발코니·다용도실
  box(furn, 7150, 3285, 7850, 3985, 0, 850, MAT.appliance()); box(furn, 7150, 3285, 7850, 3985, 860, 1700, MAT.appliance());
  box(furn, 7300, 3985, 7700, 3995, 250, 650, MAT.tv()); box(furn, 7300, 3985, 7700, 3995, 1100, 1500, MAT.tv());
  box(furn, 4190, 3285, 4790, 3785, 0, 850, MAT.ceramic());
  plant(1000, 14600, .9); plant(11500, 14350, .8);
  if (!state.expand) { box(furn, 7400, 14100, 8000, 14700, 0, 420, MAT.oakF()); plant(5000, 14500, 1); }
  else { box(furn, 4700, 13900, 6300, 14800, 0, 380, MAT.boucle()); plant(8300, 14650, 1); }
}

// ---------- 천장·조명 ----------
function buildCeilingAndLights() {
  for (const r of ROOMS) {
    const c = box(ceilGroup, r.x1, r.z1, r.x2, r.z2, H, H + 20, MAT.ceiling(), { cast: false, nopick: true });
    c.castShadow = false;
    qty.ceiling += (r.x2 - r.x1) * (r.z2 - r.z1) / 1e6;
    // 다운라이트
    const n = r.lights || 1, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (i * rows + j >= n) continue;
      const x = r.x1 + (r.x2 - r.x1) * (i + .5) / cols, z = r.z1 + (r.z2 - r.z1) * (j + .5) / rows;
      const d = cyl(ceilGroup, x, z, 45, H - 4, H, MAT.led(), 16); d.castShadow = false; d.userData.led = true; d.userData.nopick = true;
    }
    if (r.kind === 'bal') continue;
    const pl = new THREE.PointLight('#ffd9a8', 0, 9, 1.6);
    pl.position.set(WX((r.x1 + r.x2) / 2), 1.75, WZ((r.z1 + r.z2) / 2));
    pl.userData.power = (r.x2 - r.x1) * (r.z2 - r.z1) / 1e6;
    root.add(pl); roomLights.push(pl);
  }
  // 거실 우물천장 간접조명 + 복도 라인조명
  if (state.cove) {
    const lv = ROOMS.find(r => r.id === 'living'), i = 350;
    const s = [[lv.x1 + i, lv.z1 + i, lv.x2 - i, lv.z1 + i + 25], [lv.x1 + i, lv.z2 - i - 25, lv.x2 - i, lv.z2 - i], [lv.x1 + i, lv.z1 + i, lv.x1 + i + 25, lv.z2 - i], [lv.x2 - i - 25, lv.z1 + i, lv.x2 - i, lv.z2 - i]];
    for (const [a, b, c, d] of s) { const m = box(ceilGroup, a, b, c, d, H - 12, H, MAT.led(), { cast: false, nopick: true }); m.userData.led = true; }
    for (const [a, b, c, d] of [[8835, 7300, 8865, 10200], [9700, 9935, 11800, 9965], [3330, 7800, 3360, 9600]]) { const m = box(ceilGroup, a, b, c, d, H - 8, H, MAT.led(), { cast: false, nopick: true }); m.userData.led = true; }
  }
}

// ---------- 빌드 ----------
function disposeGroup(g) { g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
function build() {
  if (root) { scene.remove(root); disposeGroup(root); }
  root = new THREE.Group(); vertical = new THREE.Group(); ceilGroup = new THREE.Group(); uppers = new THREE.Group(); furn = new THREE.Group();
  root.add(vertical, ceilGroup, uppers, furn); scene.add(root);
  ledMeshes = []; roomLights = [];
  qty = { floor: {}, wall: {}, base: 0, doors: 0, ceiling: 0, klower: 0, kupper: 0, ctop: 0, closet: 0, shoe: 0, baths: 0 };
  ROOMS = getRooms(state); OPEN = getOpenings(state);
  for (const r of ROOMS) {
    const y0 = r.floorY || 0;
    box(root, r.x1, r.z1, r.x2, r.z2, -200, y0, getMat(r.floor), { slot: r.floor, room: r.id, cast: false });
    qty.floor[r.floor] = (qty.floor[r.floor] || 0) + (r.x2 - r.x1) * (r.z2 - r.z1) / 1e6;
    buildWalls(r);
  }
  // 슬래브 바닥 (외곽 그림자 받이)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: .12 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.201; ground.receiveShadow = true; ground.userData.nopick = true; root.add(ground);
  for (const o of OPEN) buildOpening(o);
  buildFurniture();
  buildCeilingAndLights();
  root.traverse(o => { if (o.material && o.material === FM.led) ledMeshes.push(o); });
  buildLabels();
  applyView(); applyLighting();
}

// ---------- 조명 모드 ----------
function applyLighting() {
  const k = kelvinRGB(state.kelvin), mode = state.light;
  const day = mode === 'day', eve = mode === 'evening';
  sun.intensity = day ? 2.6 : eve ? .9 : 0;
  sun.color.set(day ? '#fff4e5' : '#ffb27a');
  sun.position.set(day ? 5 : -9, day ? 14 : 4.5, 11);
  hemi.intensity = day ? .85 : eve ? .3 : .1;
  scene.environmentIntensity = day ? .55 : eve ? .22 : .1;
  scene.background = new THREE.Color(day ? '#e8e5df' : eve ? '#3a3940' : '#14161b');
  renderer.toneMappingExposure = day ? 1 : .95;
  for (const l of roomLights) { l.color.copy(k); l.intensity = day ? 0 : (eve ? 3.2 : 4) * Math.min(3, .8 + l.userData.power / 7); }
  const led = MAT.led(); led.emissive.copy(k); led.emissiveIntensity = day ? .05 : 3;
  if (FM.shade) { FM.shade.emissive.copy(k); FM.shade.emissiveIntensity = day ? 0 : .9; }
}

// ---------- 뷰 (조감·평면·워크스루) ----------
const walk = { yaw: 0, pitch: 0, pos: new THREE.Vector3(), keys: {}, drag: null };
const SPOTS = {
  living: [7900, 9300, 4500, 12300], kitchen: [6400, 9900, 6400, 5085], entry: [8850, 8500, 8850, 4800], master: [3000, 10250, 300, 12900],
  dress: [600, 9500, 2200, 7900], bed2: [9250, 10650, 11600, 13200], bed3: [3700, 7400, 1900, 5300], mbath: [850, 7600, 900, 5200],
  cbath: [9950, 9350, 11600, 7500], lbal: [5000, 13700, 8500, 14900], utility: [4600, 4900, 7600, 3300], hallC: [9200, 9950, 11800, 9950],
};
function applyView() {
  const w = state.view === 'walk', top = state.view === 'top';
  ceilGroup.visible = w || state.ceiling;
  const cut = !w && state.cutaway;
  vertical.scale.y = cut ? .42 : 1; uppers.visible = !cut;
  controls.enabled = !w;
  document.body.classList.toggle('walking', w);
  if (w) { camera.fov = 68; camera.updateProjectionMatrix(); }
  if (top) { camera.fov = 40; camera.updateProjectionMatrix(); camera.position.set(0, 27, .01); controls.target.set(0, 0, 0); controls.update(); }
}
function setView(v, roomId) {
  state.view = v;
  if (v === 'orbit') setOrbitHome();
  if (v === 'walk') goSpot(roomId || 'living');
  applyView(); updateLabels();
  if (window.onViewChange) window.onViewChange();
}
function goSpot(id) {
  const s = SPOTS[id] || (() => { const r = ROOMS.find(r => r.id === id); return [(r.x1 + r.x2) / 2, (r.z1 + r.z2) / 2 + 300, (r.x1 + r.x2) / 2, r.z1]; })();
  walk.pos.set(WX(s[0]), 1.55, WZ(s[1]));
  const dx = WX(s[2]) - walk.pos.x, dz = WZ(s[3]) - walk.pos.z;
  walk.yaw = Math.atan2(-dx, -dz); walk.pitch = -.08;
  const sel = document.getElementById('roomSel'); if (sel && SPOTS[id]) sel.value = id;
}
function canWalk(x, z) {
  const xm = x * 1000 + CX, zm = z * 1000 + CZ, m = 230;
  if (ROOMS.some(r => xm > r.x1 + m && xm < r.x2 - m && zm > r.z1 + m && zm < r.z2 - m)) return true;
  return OPEN.some(o => {
    if (!['open', 'door', 'arch', 'slide'].includes(o.type) && !(o.type === 'slidewin')) return false;
    const [u, v] = o.line === 'h' ? [xm, zm] : [zm, xm];
    return u > o.a + 120 && u < o.b - 120 && Math.abs(v - o.at) < 420;
  });
}
function focusRoom(id) {
  const r = ROOMS.find(r => r.id === id); if (!r || state.view !== 'orbit') return;
  const t = new THREE.Vector3(WX((r.x1 + r.x2) / 2), 0, WZ((r.z1 + r.z2) / 2));
  tween = { from: controls.target.clone(), to: t, fromP: camera.position.clone(), toP: t.clone().add(new THREE.Vector3(3.6, 7.2, 6.4)), t: 0 };
}
let tween = null;

// ---------- 라벨 ----------
const labelLayer = document.getElementById('labels');
let labels = [];
function buildLabels() {
  labelLayer.innerHTML = ''; labels = [];
  for (const r of ROOMS) {
    if (r.nolabel) continue;
    const a = (r.x2 - r.x1) * (r.z2 - r.z1) / 1e6;
    const d = document.createElement('div'); d.className = 'rlabel';
    d.innerHTML = `<b>${r.name}</b><span>${a.toFixed(1)}㎡ · ${(a / 3.3058).toFixed(1)}평</span>`;
    d.onclick = () => { focusRoom(r.id); window.onRoomPick && window.onRoomPick(r.id); };
    labelLayer.appendChild(d);
    labels.push({ el: d, p: new THREE.Vector3(WX((r.x1 + r.x2) / 2), .05, WZ((r.z1 + r.z2) / 2)) });
  }
  updateLabels();
}
const _v = new THREE.Vector3();
function updateLabels() {
  const show = state.view !== 'walk' && !state.hideLabels, w = viewport.clientWidth, h = viewport.clientHeight;
  labelLayer.style.display = show ? '' : 'none'; if (!show) return;
  for (const l of labels) {
    _v.copy(l.p).project(camera);
    l.el.style.transform = `translate(-50%,-50%) translate(${(_v.x * .5 + .5) * w}px,${(-_v.y * .5 + .5) * h}px)`;
    l.el.style.opacity = _v.z < 1 ? 1 : 0;
  }
}

// ---------- 피킹 ----------
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener('pointerdown', e => {
  downAt = [e.clientX, e.clientY];
  if (state.view === 'walk') { walk.drag = [e.clientX, e.clientY]; renderer.domElement.setPointerCapture(e.pointerId); }
});
renderer.domElement.addEventListener('pointermove', e => {
  if (state.view === 'walk' && walk.drag) {
    walk.yaw -= (e.clientX - walk.drag[0]) * .005; walk.pitch = Math.max(-1.2, Math.min(1.2, walk.pitch - (e.clientY - walk.drag[1]) * .004));
    walk.drag = [e.clientX, e.clientY];
  }
});
renderer.domElement.addEventListener('pointerup', e => {
  walk.drag = null;
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  const rc = renderer.domElement.getBoundingClientRect();
  ptr.set((e.clientX - rc.left) / rc.width * 2 - 1, -(e.clientY - rc.top) / rc.height * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hits = ray.intersectObject(root, true).filter(h => { if (h.object.userData.nopick) return false; let o = h.object; while (o) { if (!o.visible) return false; o = o.parent; } return true; });
  const hit = hits.find(h => h.object.userData.slot);
  if (hit && window.onSlotPick) window.onSlotPick(hit.object.userData.slot, hit.object.userData.room);
});
window.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return; walk.keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', e => { walk.keys[e.key.toLowerCase()] = false; });

// 선택 하이라이트
let flash = null;
function flashSlot(slot) {
  const m = slotMat[slot]; if (!m) return;
  if (flash && flash.m !== m) { flash.m.emissive.set('#000'); }
  flash = { m, t: 0 };
}

// ---------- 루프 ----------
function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
let homed = false;
new ResizeObserver(() => { resize(); if (!homed && viewport.clientWidth) { homed = true; setOrbitHome(); } }).observe(viewport);
let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (state.view === 'walk') {
    const k = walk.keys, sp = (k.shift ? 2.6 : 1.5) * dt;
    let f = (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0), st = (k.d ? 1 : 0) - (k.a ? 1 : 0);
    if (k.arrowleft || k.q) walk.yaw += 1.8 * dt; if (k.arrowright || k.e) walk.yaw -= 1.8 * dt;
    const fx = -Math.sin(walk.yaw), fz = -Math.cos(walk.yaw);
    const dx = (fx * f - fz * st) * sp, dz = (fz * f + fx * st) * sp;
    if (canWalk(walk.pos.x + dx, walk.pos.z)) walk.pos.x += dx;
    if (canWalk(walk.pos.x, walk.pos.z + dz)) walk.pos.z += dz;
    camera.position.copy(walk.pos); camera.rotation.set(walk.pitch, walk.yaw, 0, 'YXZ');
  } else {
    if (tween) {
      tween.t = Math.min(1, tween.t + dt * 1.8); const e = 1 - Math.pow(1 - tween.t, 3);
      controls.target.lerpVectors(tween.from, tween.to, e); camera.position.lerpVectors(tween.fromP, tween.toP, e);
      if (tween.t >= 1) tween = null;
    }
    controls.update();
  }
  if (flash) { flash.t += dt; const a = Math.max(0, Math.sin(flash.t * 9) * (1 - flash.t / 1.4)); flash.m.emissive.setRGB(a * .25, a * .45, a * .7); if (flash.t > 1.4) { flash.m.emissive.set('#000'); flash = null; } }
  renderer.render(scene, camera);
  updateLabels();
  requestAnimationFrame(loop);
}

function snapshot() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/jpeg', .92); }
