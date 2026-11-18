// ============================================================
//  SCENE : 평면 데이터 → 3D (벽·바닥·개구부·붙박이·가구·조명·실외)
// ============================================================

const H = PLAN_META.ceiling, DOOR_H = PLAN_META.doorH, T = PLAN_META.wallT, HALF = T / 2;
const CX = 5985, CZ = 9100;
const WX = x => (x - CX) / 1000, WZ = z => (z - CZ) / 1000;
const MX = x => x * 1000 + CX, MZ = z => z * 1000 + CZ;
const IS_MOBILE = matchMedia('(pointer:coarse)').matches || innerWidth < 900;

const state = {
  sel: { ...CONCEPTS[0].pick }, concept: 'warm',
  exp: { living: false, master: false, bed2: false, bed3: false }, dress: true,
  cutaway: false, ceiling: false, sash: true, cove: true, vat: false,
  light: 'day', kelvin: 3000, hour: 14, season: 'equinox', quality: !IS_MOBILE,
  view: 'orbit', furniture: null,
};
try {
  const s = JSON.parse(localStorage.getItem('sim33-state') || 'null');
  if (s && s.sel) {
    if (s.expand !== undefined) { s.exp = { ...state.exp, living: !!s.expand }; delete s.expand; }
    Object.assign(state, s, { view: 'orbit' });
    for (const k in CATALOG) if (!CATALOG[k].items.some(i => i.id === state.sel[k])) state.sel[k] = CONCEPTS[0].pick[k];
  }
} catch (e) { }
if (!Array.isArray(state.furniture)) state.furniture = defaultFurniture();
state.furniture = state.furniture.filter(f => FURN_BY[f.t]);
let compare = { on: false, split: .5 };
function saveState() { try { localStorage.setItem('sim33-state', JSON.stringify(state)); } catch (e) { } }

// ---------- 렌더러 ----------
const viewport = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.75 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.prepend(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 900);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = .08;
controls.maxPolarAngle = Math.PI * .495; controls.minDistance = 2.5; controls.maxDistance = 45;
controls.screenSpacePanning = true;
function setOrbitHome() { const a = Math.max(viewport.clientWidth, 1) / Math.max(viewport.clientHeight, 1), k = a < 1.2 ? Math.min(1.9, 1.2 / a * .95) : 1; camera.fov = 40; camera.position.set(7.5 * k, 15.5 * k, 15 * k); controls.target.set(0, 0, .3); camera.updateProjectionMatrix(); controls.update(); }
setOrbitHome();

// 후처리: GTAO (앰비언트 오클루전) — 구석·가구 밑 접촉 그림자
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, 800, 600);
gtao.updateGtaoMaterial({ radius: .45, distanceExponent: 1.4, thickness: 1, scale: 1.1, samples: 16 });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
gtao.blendIntensity = .9;
composer.addPass(gtao);
composer.addPass(new OutputPass());

// ---------- 조명 ----------
const hemi = new THREE.HemisphereLight('#fdfbf7', '#c9bfb1', .9); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff4e5', 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(IS_MOBILE ? 2048 : 4096, IS_MOBILE ? 2048 : 4096); sun.shadow.bias = -.0003; sun.shadow.normalBias = .025;
Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 80 });
scene.add(sun); scene.add(sun.target);

function kelvinRGB(k) {
  const t = k / 100; let r, g, b;
  r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -.1332);
  g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -.0755);
  b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  const c = v => Math.max(0, Math.min(255, v)) / 255;
  return new THREE.Color(c(r), c(g), c(b));
}
// 태양 위치: 위도 36°N, 남향 세대 가정. +x=동, +z=남
const LAT = 36 * Math.PI / 180, DECL = { summer: 23.44, equinox: 0, winter: -23.44 };
function sunVector(hour, season) {
  const d = DECL[season] * Math.PI / 180, h = (hour - 12) * 15 * Math.PI / 180;
  const alt = Math.asin(Math.sin(LAT) * Math.sin(d) + Math.cos(LAT) * Math.cos(d) * Math.cos(h));
  const az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(LAT) - Math.tan(d) * Math.cos(LAT)); // 남=0, 서=+
  return { alt, az, v: new THREE.Vector3(-Math.sin(az) * Math.cos(alt), Math.sin(alt), Math.cos(az) * Math.cos(alt)) };
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

const FM = {};
function fm(key, color, rough = .8, metal = 0, extra = {}) { return FM[key] || (FM[key] = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra })); }
const MAT = {
  ext: () => fm('ext', '#d7d3cc', .95), cap: () => fm('cap', '#34312e', .9), plaster: () => fm('plaster', '#e4e0da', .95),
  ceiling: () => fm('ceil', '#f7f6f3', .95), sash: () => fm('sash', '#eeeeec', .45), sashDark: () => fm('sash2', '#d9d9d6', .45),
  glass: () => fm('glass', '#d6e2e6', .03, 0, { transparent: true, opacity: .12, depthWrite: false, envMapIntensity: 2.2 }),
  carcass: () => fm('carc', '#2c2926', .9), oakF: () => fm('oakF', '#b48a5e', .55), black: () => fm('blk', '#1c1c1c', .45, .4),
  tv: () => fm('tv', '#0b0b0c', .25, .2), ceramic: () => fm('cer', '#f6f5f2', .12), steel: () => fm('steel', '#c9cbcc', .3, 1),
  entryDoor: () => fm('edoor', '#3d3f42', .5, .3), appliance: () => fm('app', '#ecebe8', .35), plate: () => fm('plate', '#f5f4f1', .4),
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
function box(parent, x1, z1, x2, z2, y1, y2, mat, o = {}) {
  const [ax, bx] = x1 < x2 ? [x1, x2] : [x2, x1], [az, bz] = z1 < z2 ? [z1, z2] : [z2, z1];
  const g = new THREE.BoxGeometry(Math.max(1, bx - ax) / 1000, Math.max(1, y2 - y1) / 1000, Math.max(1, bz - az) / 1000);
  g.translate(WX((ax + bx) / 2), (y1 + y2) / 2000, WZ((az + bz) / 2));
  worldUV(g);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = o.cast ?? true; m.receiveShadow = true;
  if (o.slot) m.userData.slot = o.slot; if (o.room) m.userData.room = o.room; if (o.nopick) m.userData.nopick = true;
  if (o.obst) V.obst.push({ r: [ax, az, bx, bz], k: o.obst });
  parent.add(m); return m;
}
function cyl(parent, x, z, r, y1, y2, mat, seg = 24, o = {}) {
  const g = new THREE.CylinderGeometry(r / 1000, (o.r2 ?? r) / 1000, (y2 - y1) / 1000, seg);
  g.translate(WX(x), (y1 + y2) / 2000, WZ(z));
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
  if (o.slot) m.userData.slot = o.slot; parent.add(m); return m;
}
function subtract(segs, a, b) { const out = []; for (const [s, t] of segs) { if (b <= s || a >= t) { out.push([s, t]); continue; } if (a > s) out.push([s, a]); if (b < t) out.push([b, t]); } return out; }

// ---------- 빌드 컨텍스트 (현재안 / 비교용 확장 전) ----------
// V: 현재 빌드 중인 변형. MAIN: 화면 기본, BEFORE: 비교 모드의 '확장 전'
let V = null, MAIN = null, BEFORE = null;
function newVariant(st) {
  const root = new THREE.Group(), v = {
    st, root, vertical: new THREE.Group(), ceil: new THREE.Group(), uppers: new THREE.Group(), fixed: new THREE.Group(), furn: new THREE.Group(),
    rooms: getRooms(st), open: getOpenings(st), lights: [], furnLights: [], walls: [], obst: [], swings: [], furnObjs: {},
    qty: { floor: {}, wall: {}, base: 0, doors: 0, ceiling: 0, klower: 0, kupper: 0, ctop: 0, closet: 0, shoe: 0, baths: 0, curtain: 0 },
  };
  root.add(v.vertical, v.ceil, v.uppers, v.fixed, v.furn);
  return v;
}
function roomAt(x, z, rooms = V.rooms) { return rooms.find(r => x > r.x1 && x < r.x2 && z > r.z1 && z < r.z2); }

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
  box(V.vertical, x1, z1, x2, z2, yA, yB, mats, { slot, room: room.id });
  V.qty.wall[slot] = (V.qty.wall[slot] || 0) + (t - s) / 1000 * (yB - yA) / 1000;
  if (yA <= 0 && yB - yA > 300) V.walls.push([Math.min(x1, x2), Math.min(z1, z2), Math.max(x1, x2), Math.max(z1, z2)]);
  const mid = (s + t) / 2, probe = e.line === 'h' ? [mid, e.at - e.inward * 150] : [e.at - e.inward * 150, mid];
  if (!roomAt(probe[0], probe[1])) {
    const ex = MAT.ext(), m2 = [ex, ex, MAT.cap(), ex, ex, ex];
    if (e.line === 'h') box(V.vertical, s, e.at, t, e.at - e.inward * (HALF + 40), yA, yB, m2, { nopick: true });
    else box(V.vertical, e.at, s, e.at - e.inward * (HALF + 40), t, yA, yB, m2, { nopick: true });
  }
  if (solid && room.kind === 'dry' && yA <= 0) {
    const bb = itemOf('baseboard');
    const bm = bb.color === 'wall' ? getMat(slot) : bb.color === 'floor' ? getMat('floor_main') : fm('bb_' + bb.id, bb.color, bb.rough);
    const pr = bb.inset ? 1 : 10, f = HALF;
    if (e.line === 'h') box(V.vertical, s, e.at + e.inward * f, t, e.at + e.inward * (f + pr), 0, bb.h, bm, { slot: 'baseboard', cast: false });
    else box(V.vertical, e.at + e.inward * f, s, e.at + e.inward * (f + pr), t, 0, bb.h, bm, { slot: 'baseboard', cast: false });
    V.qty.base += (t - s) / 1000;
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
    const ops = V.open.filter(o => o.line === e.line && Math.abs(o.at - e.at) < 3 && o.a < e.b && o.b > e.a);
    let segs = [[e.a, e.b]];
    for (const o of ops) segs = subtract(segs, o.a, o.b);
    for (const [s, t] of segs) wallPiece(room, e, s, t, y0, H, slot, true);
    for (const o of ops) {
      const s = Math.max(o.a, e.a), t = Math.min(o.b, e.b);
      if (o.type === 'open') { if (o.beam) wallPiece(room, e, s, t, H - 150, H, slot); continue; }
      if (['door', 'arch', 'entry', 'slide'].includes(o.type)) wallPiece(room, e, s, t, DOOR_H, H, slot);
      else { if (o.sill > 0) wallPiece(room, e, s, t, y0, o.sill, slot); if (o.head < H) wallPiece(room, e, s, t, o.head, H, slot); }
    }
  }
}

// ---------- 개구부 ----------
function along(o, s, t, off1, off2, y1, y2, mat, parent = V.vertical, opt = {}) {
  return o.line === 'h' ? box(parent, s, o.at + off1, t, o.at + off2, y1, y2, mat, opt) : box(parent, o.at + off1, s, o.at + off2, t, y1, y2, mat, opt);
}
function glassPanel(o, s, t, y1, y2, off, frameMat, glassMat, prof = 40, dep = 40, parent = V.vertical, slot = 'jungmun') {
  const op = { slot, nopick: !slot };
  along(o, s, s + prof, off - dep / 2, off + dep / 2, y1, y2, frameMat, parent, op);
  along(o, t - prof, t, off - dep / 2, off + dep / 2, y1, y2, frameMat, parent, op);
  along(o, s, t, off - dep / 2, off + dep / 2, y1, y1 + prof, frameMat, parent, op);
  along(o, s, t, off - dep / 2, off + dep / 2, y2 - prof, y2, frameMat, parent, op);
  along(o, s + prof, t - prof, off - 3, off + 3, y1 + prof, y2 - prof, glassMat, parent, { nopick: true, cast: false });
}
function buildOpening(o) {
  const dm = getMat('door');
  if (o.type === 'door') {
    const di = itemOf('door'), fw = 30;
    V.qty.doors++;
    along(o, o.a, o.a + fw, -HALF, HALF, 0, DOOR_H, dm, V.vertical, { slot: 'door' });
    along(o, o.b - fw, o.b, -HALF, HALF, 0, DOOR_H, dm, V.vertical, { slot: 'door' });
    along(o, o.a, o.b, -HALF, HALF, DOOR_H - fw, DOOR_H, dm, V.vertical, { slot: 'door' });
    if (!di.hidden) for (const sg of [-1, 1]) {
      const f1 = sg * HALF, f2 = sg * (HALF + 12);
      along(o, o.a - 55, o.a, f1, f2, 0, DOOR_H + 55, dm, V.vertical, { slot: 'door' });
      along(o, o.b, o.b + 55, f1, f2, 0, DOOR_H + 55, dm, V.vertical, { slot: 'door' });
      along(o, o.a - 55, o.b + 55, f1, f2, DOOR_H, DOOR_H + 55, dm, V.vertical, { slot: 'door' });
    }
    const w = o.b - o.a - 2 * fw, hx = o.hinge === 'a' ? o.a + fw : o.b - fw, sd = o.hinge === 'a' ? 1 : -1;
    const f0 = o.swing * HALF, f1 = o.swing * (HALF + w);
    const leafX1 = hx, leafX2 = hx + sd * 38;
    const hm = fm('handle_' + di.id, di.handle || '#888', .3, .9);
    if (o.line === 'h') {
      box(V.vertical, leafX1, o.at + f0, leafX2, o.at + f1, 5, DOOR_H - fw - 3, dm, { slot: 'door' });
      box(V.vertical, leafX1 - sd * 25, o.at + o.swing * (HALF + w - 90), leafX2 + sd * 25, o.at + o.swing * (HALF + w - 70), 980, 1000, hm);
      V.swings.push([o.a, Math.min(o.at + f0, o.at + f0 + o.swing * w), o.b, Math.max(o.at + f0, o.at + f0 + o.swing * w)]);
      // 스위치 플레이트
      const px = o.hinge === 'a' ? o.b + 90 : o.a - 160;
      box(V.vertical, px, o.at + o.swing * HALF, px + 70, o.at + o.swing * (HALF + 8), 1150, 1270, MAT.plate(), { nopick: true, cast: false });
    } else {
      box(V.vertical, o.at + f0, leafX1, o.at + f1, leafX2, 5, DOOR_H - fw - 3, dm, { slot: 'door' });
      box(V.vertical, o.at + o.swing * (HALF + w - 90), leafX1 - sd * 25, o.at + o.swing * (HALF + w - 70), leafX2 + sd * 25, 980, 1000, hm);
      V.swings.push([Math.min(o.at + f0, o.at + f0 + o.swing * w), o.a, Math.max(o.at + f0, o.at + f0 + o.swing * w), o.b]);
      const pz = o.hinge === 'a' ? o.b + 90 : o.a - 160;
      box(V.vertical, o.at + o.swing * HALF, pz, o.at + o.swing * (HALF + 8), pz + 70, 1150, 1270, MAT.plate(), { nopick: true, cast: false });
    }
  } else if (o.type === 'arch') {
    along(o, o.a, o.a + 25, -HALF, HALF, 0, DOOR_H, dm, V.vertical, { slot: 'door' });
    along(o, o.b - 25, o.b, -HALF, HALF, 0, DOOR_H, dm, V.vertical, { slot: 'door' });
    along(o, o.a, o.b, -HALF, HALF, DOOR_H - 25, DOOR_H, dm, V.vertical, { slot: 'door' });
  } else if (o.type === 'entry') {
    const ed = MAT.entryDoor();
    along(o, o.a, o.b, -HALF, HALF, -120, -60, ed);
    along(o, o.a, o.a + 50, -HALF, HALF, -120, DOOR_H, ed); along(o, o.b - 50, o.b, -HALF, HALF, -120, DOOR_H, ed);
    along(o, o.a, o.b, -HALF, HALF, DOOR_H - 50, DOOR_H, ed);
    along(o, o.a + 50, o.b - 50, -25, 25, -60, DOOR_H - 50, ed);
    along(o, o.a + 120, o.a + 160, -60, -25, 900, 1200, MAT.steel());
    along(o, o.a + 110, o.a + 170, -70, -25, 1250, 1450, MAT.tv()); // 도어락
  } else if (o.type === 'slide') {
    const j = itemOf('jungmun');
    if (!j.panels) return;
    const frame = fm('jf_' + j.id, j.color, .45, .6);
    const gl = fm('jg_' + j.id, j.glass, j.fluted ? .35 : .05, 0, { transparent: true, opacity: j.fluted ? .55 : .3, depthWrite: false });
    along(o, o.a, o.b, -55, 55, DOOR_H - 40, DOOR_H, frame, V.vertical, { slot: 'jungmun' });
    const W = o.b - o.a;
    if (j.panels === 3) { const pw = W / 3 + 25; for (let i = 0; i < 3; i++) glassPanel(o, o.a + i * 70, o.a + i * 70 + pw, 0, DOOR_H - 40, -40 + i * 40, frame, gl, 25, 30); }
    else if (j.panels === 1) { glassPanel(o, o.a + 20, o.a + 20 + W * .62, 0, DOOR_H - 40, 0, frame, gl, 35, 40); }
    else {
      glassPanel(o, o.b - 420, o.b, 0, DOOR_H - 40, 0, frame, gl, 45, 45);
      const w = W - 440, leaf = { line: o.line === 'h' ? 'v' : 'h', at: o.a + 30 };
      glassPanel(leaf, o.at + 30, o.at + 30 + w, 0, DOOR_H - 45, 0, frame, gl, 45, 45);
    }
  } else if (o.type === 'window' || o.type === 'slidewin') {
    // 이중 미닫이 샷시 (외창/내창 2겹)
    const y1 = o.sill + (o.sill === 0 ? 0 : 0), y2 = o.head, mid = (o.a + o.b) / 2, gm = MAT.glass();
    along(o, o.a, o.b, -70, 70, y1, y1 + 30, MAT.sashDark(), V.vertical, { nopick: true });
    for (const [off, s, t] of [[-35, o.a, mid + 40], [35, mid - 40, o.b]]) glassPanel(o, s, t, y1 + 30, y2, off, MAT.sash(), gm, 48, 36, V.vertical, null);
    if (o.ext && o.sill >= 450) for (const [off, s, t] of [[-80, o.a, mid + 40], [-110, mid - 40, o.b]]) glassPanel(o, s, t, y1 + 30, y2, off, MAT.sash(), gm, 40, 28, V.vertical, null);
  }
}

// ---------- 붙박이·설비 (고정) ----------
function cabinetRun(o, s, t, f1, f2, y1, y2, mat, slot, door = 600) {
  const F = V.fixed;
  along(o, s, t, f1 * .99, f2 * .99, y1, y2, mat, F, { slot });
  along(o, s, t, f1 + (f2 - f1) * .9, f2 - (f2 - f1) * .003, y1 + 1, y2 - 1, MAT.carcass(), F, { slot });
  const n = Math.max(1, Math.round((t - s) / door)), w = (t - s) / n, front = Math.abs(f2) > Math.abs(f1) ? f2 : f1, sg = Math.sign(front);
  for (let i = 0; i < n; i++) along(o, s + i * w + 2, s + (i + 1) * w - 2, front - sg * 2, front + sg * 18, y1 + 2, y2 - 2, mat, F, { slot });
  if (y1 < 500) { const r = o.line === 'h' ? [s, o.at + f1, t, o.at + f2] : [o.at + f1, s, o.at + f2, t]; V.obst.push({ r: [Math.min(r[0], r[2]), Math.min(r[1], r[3]), Math.max(r[0], r[2]), Math.max(r[1], r[3])], k: slot }); }
}
function buildFixed() {
  const F = V.fixed, st = V.st;
  const kl = getMat('kitchen_lower'), ku = getMat('kitchen_upper'), ct = getMat('countertop'), bs = getMat('backsplash');
  const cl = getMat('closet'), sh = getMat('shoe'), fx = getMat('bath_fixture');
  // 주방
  const kTop = { line: 'h', at: 5085 }, kR = { line: 'v', at: 8010 }, kLeft = { line: 'v', at: 4090 };
  along(kTop, 5250, 7910, HALF, HALF + 580, 0, 100, MAT.carcass(), F);
  cabinetRun(kTop, 5250, 7910, HALF, HALF + 580, 100, 870, kl, 'kitchen_lower');
  along(kTop, 5250, 7910, HALF, HALF + 620, 870, 900, ct, F, { slot: 'countertop' });
  along(kR, 5785, 7100, -HALF, -HALF - 580, 0, 100, MAT.carcass(), F);
  cabinetRun(kR, 5805, 7100, -HALF, -HALF - 580, 100, 870, kl, 'kitchen_lower');
  along(kR, 5785, 7100, -HALF, -HALF - 620, 870, 900, ct, F, { slot: 'countertop' });
  box(F, 7370, 6150, 7850, 6750, 900, 904, MAT.tv());
  for (const [x, z] of [[7500, 6300], [7720, 6300], [7500, 6600], [7720, 6600]]) cyl(F, x, z, 75, 904, 905, fm('ring', '#333', .3), 24);
  box(F, 6150, 5330, 6950, 5730, 860, 901, MAT.steel());
  const fau = cyl(F, 6550, 5270, 14, 900, 1230, MAT.steel(), 12); box(F, 6540, 5270, 6560, 5450, 1210, 1230, MAT.steel());
  along(kR, 5185, 7100, -HALF, -HALF - 8, 900, 1450, bs, F, { slot: 'backsplash' });
  along(kTop, 7400, 7910, HALF, HALF + 8, 900, 1450, bs, F, { slot: 'backsplash' });
  along(kTop, 5250, 7400, HALF, HALF + 8, 900, 1000, bs, F, { slot: 'backsplash' });
  V.qty.wall.backsplash = (1.915 * .55 + .51 * .55 + 2.15 * .1);
  cabinetRun(kR, 5185, 7100, -HALF, -HALF - 350, 1450, 2280, ku, 'kitchen_upper', 480);
  // 후드 (상부장 하단 매립)
  along(kR, 6150, 6750, -HALF - 20, -HALF - 380, 1400, 1450, MAT.steel(), V.uppers);
  const led = along(kR, 5185, 7100, -HALF - 300, -HALF - 340, 1440, 1450, MAT.led(), V.uppers); led.userData.led = true;
  cabinetRun(kLeft, 5950, 7650, HALF, HALF + 650, 0, 2280, ku, 'kitchen_upper', 850);
  V.qty.klower = (7910 - 5250 + 7100 - 5785) / 1000; V.qty.kupper = (7100 - 5185 + 7650 - 5950) / 1000; V.qty.ctop = V.qty.klower;
  // 현관 신발장
  const eL = { line: 'v', at: 8010 };
  cabinetRun(eL, 4900, 7100, HALF, HALF + 400, 150, 1000, sh, 'shoe', 450);
  cabinetRun(eL, 4900, 7100, HALF, HALF + 400, 1380, 2280, sh, 'shoe', 450);
  along(eL, 4900, 7100, HALF, HALF + 400, 1000, 1010, sh, F, { slot: 'shoe' });
  along(eL, 4900, 7100, HALF + 20, HALF + 380, 1370, 1380, MAT.led(), F).userData.led = true;
  V.obst.push({ r: [8110, 4900, 8510, 7100], k: 'shoe' });
  V.qty.shoe = 2.2;
  // 안방 붙박이장 · 헤드 간접조명
  cabinetRun({ line: 'v', at: 4090 }, 10700, 13350, -HALF, -HALF - 600, 0, 2280, cl, 'closet', 500);
  V.qty.closet = 2.65;
  if (st.dress) {
    cabinetRun({ line: 'v', at: 2600 }, 7855, 9590, -HALF, -HALF - 600, 0, 2280, cl, 'closet', 450);
    cabinetRun({ line: 'h', at: 7755 }, 1350, 1900, HALF, HALF + 600, 0, 2280, cl, 'closet', 550);
    V.qty.closet += 1.735 + .55;
  }
  cabinetRun({ line: 'h', at: 10280 }, 9800, 11870, HALF, HALF + 600, 0, 2280, cl, 'closet', 520);
  cabinetRun({ line: 'h', at: 9620 }, 10000, 11870, HALF, HALF + 400, 0, 2280, cl, 'closet', 470);
  V.qty.closet += 2.07 + 1.87;
  // 욕실1 (샤워부스)
  const gl = MAT.glass();
  box(F, 100, 6250, 900, 6260, 0, 2000, gl, { nopick: true, cast: false });
  box(F, 895, 6248, 905, 6262, 0, 2000, fx, { slot: 'bath_fixture' });
  box(F, 100, 5185, 1645, 6250, 0, 30, getMat('bath_floor'), { slot: 'bath_floor', cast: false });
  cyl(F, 400, 5420, 120, 2040, 2052, fx, 32, { slot: 'bath_fixture' });
  box(F, 110, 5410, 400, 5430, 2052, 2070, fx, { slot: 'bath_fixture' });
  box(F, 102, 5680, 112, 5780, 1050, 1150, fx, { slot: 'bath_fixture' });
  box(F, 100, 5700, 160, 6100, 1100, 1400, MAT.led()).userData.led = true;
  box(F, 100, 6450, 620, 6850, 380, 720, MAT.ceramic(), { slot: 'bath_fixture', obst: 'bath' });
  box(F, 100, 6420, 140, 6880, 720, 1100, MAT.ceramic());
  box(F, 1145, 6250, 1645, 6950, 450, 850, MAT.oakF(), { obst: 'bath' });
  box(F, 1145, 6250, 1645, 6950, 850, 870, MAT.ceramic());
  box(F, 1630, 6300, 1645, 6900, 1050, 1850, fm('mirror', '#dfe6e8', .02, 1));
  box(F, 1580, 6585, 1645, 6615, 870, 1050, fx, { slot: 'bath_fixture' });
  // 욕실2 (욕조)
  box(F, 11120, 7325, 11870, 9025, 0, 560, MAT.ceramic(), { obst: 'bath' });
  box(F, 11190, 7395, 11800, 8955, 380, 561, fm('water', '#d7e3e6', .05, 0));
  box(F, 11850, 7600, 11870, 8800, 1100, 1350, MAT.led()).userData.led = true;
  box(F, 11850, 8110, 11870, 8130, 900, 1900, fx, { slot: 'bath_fixture' });
  box(F, 11780, 8095, 11870, 8145, 1880, 1900, fx, { slot: 'bath_fixture' });
  box(F, 10100, 8920, 10500, 9520, 380, 720, MAT.ceramic(), { slot: 'bath_fixture', obst: 'bath' });
  box(F, 10080, 9480, 10520, 9520, 720, 1100, MAT.ceramic());
  box(F, 10000, 7325, 10900, 7805, 450, 850, MAT.oakF(), { obst: 'bath' });
  box(F, 10000, 7325, 10900, 7805, 850, 870, MAT.ceramic());
  box(F, 10050, 7325, 10850, 7340, 1050, 1850, fm('mirror', '#dfe6e8', .02, 1));
  V.qty.baths = 2;
  // 다용도실
  box(F, 7150, 3285, 7850, 3985, -60, 790, MAT.appliance(), { obst: 'util' }); box(F, 7150, 3285, 7850, 3985, 800, 1650, MAT.appliance());
  for (const y of [400, 1220]) { const g = new THREE.CylinderGeometry(.19, .19, .012, 32); g.rotateX(Math.PI / 2); g.translate(WX(7500), y / 1000, WZ(3990)); F.add(new THREE.Mesh(g, MAT.tv())); }
  box(F, 4190, 3285, 4790, 3785, -60, 850, MAT.ceramic(), { obst: 'util' });
  buildCurtains();
}

// ---------- 커튼 ----------
function curtainGeo(w, h, folds, amp) {
  const g = new THREE.PlaneGeometry(w / 1000, h / 1000, Math.max(8, folds * 6), 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) / (w / 1000) * folds * Math.PI * 2) * amp / 1000);
  g.computeVertexNormals(); return g;
}
function buildCurtains() {
  const cu = itemOf('curtain'); if (cu.none) return;
  const E = V.st.exp;
  const spots = [
    E.living ? { x1: 4190, x2: 8680, z: 14915 - 160 } : { x1: 4190, x2: 8680, z: 13415 - 160 },
    E.master ? { x1: 100, x2: 3990, z: 14915 - 160 } : { x1: 100, x2: 3290, z: 13415 - 160 },
    E.bed2 ? { x1: 8880, x2: 11870, z: 14600 - 160 } : { x1: 8880, x2: 11870, z: 13415 - 160 },
  ];
  const sheerM = fm('sheer_' + cu.id, cu.sheer || '#fff', .9, 0, { transparent: true, opacity: .62, side: THREE.DoubleSide, depthWrite: false });
  const blackM = fm('black_' + cu.id, cu.color, .95, 0, { side: THREE.DoubleSide });
  for (const s of spots) {
    const w = s.x2 - s.x1, hh = H - 30;
    V.qty.curtain += w / 1000;
    box(V.ceil, s.x1, s.z - 60, s.x2, s.z + 60, H - 25, H, fm('rail', '#d8d6d2', .5), { nopick: true, cast: false });
    if (cu.blind) {
      const g = new THREE.Group(); g.position.set(WX((s.x1 + s.x2) / 2), 0, WZ(s.z)); V.fixed.add(g);
      const slat = fm('slat_' + cu.id, cu.color, .6);
      for (let y = H - 60; y > 900; y -= 45) { const m = new THREE.Mesh(new THREE.BoxGeometry(w / 1000, .004, .05), slat); m.position.y = y / 1000; m.rotation.x = .5; m.castShadow = true; m.userData.slot = 'curtain'; g.add(m); }
      continue;
    }
    {
      const sm = new THREE.Mesh(curtainGeo(w - 40, hh - 20, Math.round(w / 220), 25), sheerM);
      sm.position.set(WX((s.x1 + s.x2) / 2), (hh - 20) / 2000 + .01, WZ(s.z + 30)); sm.userData.slot = 'curtain'; V.fixed.add(sm);
    }
    if (cu.only !== 'sheer') for (const side of [-1, 1]) {
      const pw = 520, cxp = side < 0 ? s.x1 + pw / 2 + 20 : s.x2 - pw / 2 - 20;
      const m = new THREE.Mesh(curtainGeo(pw, hh, 5, 45), blackM);
      m.position.set(WX(cxp), hh / 2000, WZ(s.z - 40)); m.castShadow = true; m.userData.slot = 'curtain'; V.fixed.add(m);
    }
  }
}

// ---------- 이동형 가구 ----------
function floorAt(x, z, v = V) { const r = roomAt(x, z, v.rooms); return r ? (r.floorY || 0) : 0; }
function makeFurnObj(f, v = V) {
  const L = FURN_BY[f.t], g = new THREE.Group();
  L.make(g, f);
  g.position.set(WX(f.x), floorAt(f.x, f.z, v) / 1000, WZ(f.z)); g.rotation.y = f.r || 0;
  g.userData.furn = f.u;
  g.traverse(m => { if (m.isMesh) { m.userData.furn = f.u; } });
  for (const [x, y, z] of g.userData.lights || []) {
    const pl = new THREE.PointLight('#ffd9a8', 0, 5, 2); pl.position.set(x / 1000, y / 1000, z / 1000); g.add(pl); v.furnLights.push(pl);
  }
  v.furn.add(g); v.furnObjs[f.u] = g;
  return g;
}
function removeFurnObj(u, v = MAIN) {
  const g = v.furnObjs[u]; if (!g) return;
  g.traverse(o => { if (o.isPointLight) v.furnLights.splice(v.furnLights.indexOf(o), 1); if (o.geometry) o.geometry.dispose(); });
  v.furn.remove(g); delete v.furnObjs[u];
}
function checkFurn(f, v = MAIN) {
  const L = FURN_BY[f.t], P = corners(fpOf(f)), issues = [];
  const inside = ([x, z]) => v.rooms.some(r => x > r.x1 + HALF - 15 && x < r.x2 - HALF + 15 && z > r.z1 + HALF - 15 && z < r.z2 - HALF + 15);
  if (!P.every(inside) || !inside([f.x, f.z])) issues.push('실 밖으로 나감');
  if (L.flat) return issues;
  if (v.walls.some(r => polysOverlap(P, rectPoly(r)))) issues.push('벽과 겹침');
  if (L.wall) return issues;
  if (v.obst.some(o => polysOverlap(P, rectPoly(o.r)))) issues.push('붙박이·설비와 겹침');
  if (v.swings.some(r => polysOverlap(P, rectPoly(r)))) issues.push('문 열림 반경 침범');
  for (const g of state.furniture) {
    if (g.u === f.u) continue; const G = FURN_BY[g.t]; if (G.flat || G.wall) continue;
    if (polysOverlap(P, corners(fpOf(g)))) { issues.push(`'${G.name}'와 겹침`); break; }
  }
  return issues;
}

// ---------- 천장·조명 ----------
function buildCeilingAndLights() {
  const C = V.ceil;
  for (const r of V.rooms) {
    box(C, r.x1, r.z1, r.x2, r.z2, H, H + 20, MAT.ceiling(), { cast: true, nopick: true });
    V.qty.ceiling += (r.x2 - r.x1) * (r.z2 - r.z1) / 1e6;
    const n = r.lights || 1, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (i * rows + j >= n) continue;
      const x = r.x1 + (r.x2 - r.x1) * (i + .5) / cols, z = r.z1 + (r.z2 - r.z1) * (j + .5) / rows;
      const d = cyl(C, x, z, 45, H - 4, H, MAT.led(), 20); d.castShadow = false; d.userData.led = true;
      cyl(C, x, z, 55, H - 2, H - 1, fm('dlring', '#e9e7e2', .4), 20).castShadow = false;
    }
    if (r.kind === 'bal') continue;
    const pl = new THREE.PointLight('#ffd9a8', 0, 9, 1.6);
    pl.position.set(WX((r.x1 + r.x2) / 2), 1.75, WZ((r.z1 + r.z2) / 2));
    pl.userData.power = (r.x2 - r.x1) * (r.z2 - r.z1) / 1e6;
    V.root.add(pl); V.lights.push(pl);
  }
  if (V.st.cove) {
    // 거실 우물천장: 둘레 300mm 내림천장 + 안쪽 간접조명
    const lv = V.rooms.find(r => r.id === 'living'), i = 320, d = 120, x1 = lv.x1 + HALF, x2 = lv.x2 - HALF, z1 = lv.z1 + HALF, z2 = (V.st.exp.living ? 15015 : lv.z2) - HALF;
    const cm = MAT.ceiling();
    for (const [a, b, c, e] of [[x1, z1, x2, z1 + i], [x1, z2 - i, x2, z2], [x1, z1, x1 + i, z2], [x2 - i, z1, x2, z2]]) box(C, a, b, c, e, H - d, H, cm, { nopick: true });
    for (const [a, b, c, e] of [[x1 + i, z1 + i, x2 - i, z1 + i + 15], [x1 + i, z2 - i - 15, x2 - i, z2 - i], [x1 + i, z1 + i, x1 + i + 15, z2 - i], [x2 - i - 15, z1 + i, x2 - i, z2 - i]]) {
      const m = box(C, a, b, c, e, H - 30, H - 10, MAT.led(), { cast: false, nopick: true }); m.userData.led = true;
    }
    for (const [a, b, c, e] of [[8835, 7300, 8865, 10200], [9700, 9935, 11800, 9965], [3330, 7800, 3360, 9600]]) { const m = box(C, a, b, c, e, H - 8, H, MAT.led(), { cast: false, nopick: true }); m.userData.led = true; }
  }
}

// ---------- 실외 환경 (워크스루 창밖 풍경) ----------
const outdoor = new THREE.Group(); scene.add(outdoor);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color('#8fb6dc') }, hor: { value: new THREE.Color('#e8edf0') }, gnd: { value: new THREE.Color('#b8b4aa') } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 gnd; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(hor, top, pow(min(1.0, h*1.6), .7)) : mix(hor, gnd, min(1.0, -h*6.0)); gl_FragColor = vec4(c,1.0); }',
});
(function buildOutdoor() {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), skyMat); outdoor.add(sky);
  const GY = -9.2; // 3층 가정
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: '#8c9873', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = GY; outdoor.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(900, 14), new THREE.MeshStandardMaterial({ color: '#8a8782', roughness: .9 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, GY + .02, 32); outdoor.add(road);
  const facT = new THREE.CanvasTexture(facadeCanvas(7, false)); facT.colorSpace = THREE.SRGBColorSpace;
  const litT = new THREE.CanvasTexture(facadeCanvas(7, true)); litT.colorSpace = THREE.SRGBColorSpace;
  const fac = new THREE.MeshStandardMaterial({ map: facT, roughness: .9, emissiveMap: litT, emissive: '#ffffff', emissiveIntensity: 0 });
  outdoor.userData.facade = fac;
  const blocks = [[-30, 62, 58], [32, 66, 58], [-34, -48, 58], [30, -52, 58], [-82, 8, 50], [86, 4, 50]];
  for (const [x, z, h] of blocks) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(46, h, 13), fac); b.position.set(x, GY + h / 2, z); outdoor.add(b);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(46.4, .6, 13.4), new THREE.MeshStandardMaterial({ color: '#c9c4bb' })); roof.position.set(x, GY + h + .3, z); outdoor.add(roof);
  }
  // 자기 동 (좌우 세대·상하층 외벽)
  const own = new THREE.MeshStandardMaterial({ color: '#e7e3dc', roughness: .95 });
  for (const [x, w] of [[-12.5, 13], [12.6, 13]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 40, 16), own); m.position.set(x, GY + 20, 0); outdoor.add(m); }
  const R = rng(42), treeM = new THREE.MeshStandardMaterial({ color: '#5d7a4a', roughness: .9, flatShading: true }), trunkM = new THREE.MeshStandardMaterial({ color: '#6b5a48' });
  for (let i = 0; i < 70; i++) {
    const x = (R() - .5) * 160, z = (R() < .5 ? 1 : -1) * (14 + R() * 26);
    const s = 2 + R() * 2.5, t = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), treeM); t.position.set(x, GY + 3 + s, z); outdoor.add(t);
    const k = new THREE.Mesh(new THREE.CylinderGeometry(.15, .2, 3), trunkM); k.position.set(x, GY + 1.5, z); outdoor.add(k);
  }
  outdoor.visible = false;
})();

// ---------- 빌드 ----------
function disposeGroup(g) { g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
function buildVariant(st) {
  const prev = V; V = newVariant(st);
  for (const r of V.rooms) {
    const y0 = r.floorY || 0;
    box(V.root, r.x1, r.z1, r.x2, r.z2, -200, y0, getMat(r.floor), { slot: r.floor, room: r.id, cast: false });
    V.qty.floor[r.floor] = (V.qty.floor[r.floor] || 0) + (r.x2 - r.x1) * (r.z2 - r.z1) / 1e6;
    buildWalls(r);
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: .12 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.201; ground.receiveShadow = true; ground.userData.nopick = true; ground.userData.dollhouse = true; V.root.add(ground);
  for (const o of V.open) buildOpening(o);
  buildFixed();
  for (const f of state.furniture) makeFurnObj(f);
  buildCeilingAndLights();
  const v = V; V = prev; return v;
}
function build() {
  for (const v of [MAIN, BEFORE]) if (v) { scene.remove(v.root); disposeGroup(v.root); }
  MAIN = buildVariant(state); scene.add(MAIN.root); V = MAIN;
  BEFORE = null;
  if (compare.on) { BEFORE = buildVariant({ ...state, exp: { living: false, master: false, bed2: false, bed3: false } }); scene.add(BEFORE.root); BEFORE.root.visible = false; }
  buildLabels(); applyView(); applyLighting();
  if (selected && !MAIN.furnObjs[selected]) selectFurn(null); else if (selected) selectFurn(selected);
  if (window.onBuilt) window.onBuilt();
}
const qtyProxy = () => MAIN.qty;
Object.defineProperty(window, 'qty', { get: qtyProxy, configurable: true });
function variants() { return [MAIN, BEFORE].filter(Boolean); }

// ---------- 조명 모드 ----------
let sunInfo = null;
function applyLighting() {
  const k = kelvinRGB(state.kelvin), mode = state.light;
  const day = mode === 'day', eve = mode === 'evening';
  if (day) {
    sunInfo = sunVector(state.hour, state.season);
    const alt = Math.max(0, sunInfo.alt), lowF = Math.min(1, alt / .5);
    sun.position.copy(sunInfo.v).multiplyScalar(30); sun.intensity = sunInfo.alt > 0 ? 1.2 + 2.2 * Math.sin(alt) : 0;
    sun.color.set('#ffd2a0').lerp(new THREE.Color('#fff6ea'), lowF);
    const wk = state.view === 'walk';
    hemi.intensity = (.45 + .45 * lowF) * (wk ? .4 : 1); scene.environmentIntensity = (.35 + .25 * lowF) * (wk ? .7 : 1);
    if (wk) sun.intensity *= 2.4;
    skyMat.uniforms.top.value.set('#f2b48a').lerp(new THREE.Color('#86b0da'), lowF); skyMat.uniforms.hor.value.set('#f6d2b0').lerp(new THREE.Color('#e6ecef'), lowF);
  } else {
    sun.position.set(-20, 5, 20); sun.intensity = eve ? .7 : 0; sun.color.set('#ff9f6a');
    hemi.intensity = eve ? .28 : .08; scene.environmentIntensity = eve ? .2 : .08;
    skyMat.uniforms.top.value.set(eve ? '#2d3552' : '#070a12'); skyMat.uniforms.hor.value.set(eve ? '#e59a72' : '#1a2233');
  }
  scene.background = new THREE.Color(day ? '#e8e5df' : eve ? '#3a3940' : '#14161b');
  if (outdoor.userData.facade) outdoor.userData.facade.emissiveIntensity = day ? 0 : eve ? .5 : 1.1;
  renderer.toneMappingExposure = day ? 1.05 : .95;
  for (const v of variants()) {
    for (const l of v.lights) { l.color.copy(k); l.intensity = day ? 0 : (eve ? 2.6 : 3.4) * Math.min(3, .8 + l.userData.power / 7); }
    for (const l of v.furnLights) { l.color.copy(k); l.intensity = day ? 0 : 1.6; }
  }
  const led = MAT.led(); led.emissive.copy(k); led.emissiveIntensity = day ? .05 : 3;
  const sh = FMC.lampshade; if (sh) { sh.emissive.copy(k); sh.emissiveIntensity = day ? 0 : 1.1; }
}

// ---------- 뷰 ----------
const walk = { yaw: 0, pitch: 0, pos: new THREE.Vector3(), keys: {}, drag: null };
const SPOTS = {
  living: [7900, 9300, 4500, 12300], kitchen: [6400, 9900, 6400, 5085], entry: [8850, 8500, 8850, 4800], master: [3000, 10250, 300, 12900],
  dress: [600, 9500, 2200, 7900], bed2: [9250, 10650, 11600, 13200], bed3: [3700, 7400, 1900, 5300], mbath: [850, 7600, 900, 5200],
  cbath: [9950, 9350, 11600, 7500], lbal: [5000, 13700, 8500, 14900], utility: [4600, 4900, 7600, 3300], hallC: [9200, 9950, 11800, 9950],
};
function applyView() {
  const w = state.view === 'walk', top = state.view === 'top', cut = !w && state.cutaway;
  for (const v of variants()) {
    v.ceil.visible = w || state.ceiling;
    v.ceil.traverse(m => { if (m.isMesh) m.castShadow = w; });
    v.vertical.scale.y = cut ? .42 : 1; v.uppers.visible = !cut;
    v.root.traverse(o => { if (o.userData.dollhouse) o.visible = !w; });
  }
  outdoor.visible = w;
  scene.fog = w ? new THREE.Fog('#dfe5e8', 80, 520) : null;
  controls.enabled = !w;
  document.body.classList.toggle('walking', w);
  if (w) { camera.fov = 68; camera.updateProjectionMatrix(); }
  if (top) { camera.fov = 40; camera.updateProjectionMatrix(); camera.position.set(0, 27, .01); controls.target.set(0, 0, 0); controls.update(); }
}
function setView(v, roomId) {
  state.view = v;
  if (v === 'orbit') setOrbitHome();
  if (v === 'walk') { goSpot(roomId || 'living'); selectFurn(null); }
  applyView(); applyLighting(); updateLabels();
  if (window.onViewChange) window.onViewChange();
}
function goSpot(id) {
  const s = SPOTS[id] || (() => { const r = MAIN.rooms.find(r => r.id === id); return [(r.x1 + r.x2) / 2, (r.z1 + r.z2) / 2 + 300, (r.x1 + r.x2) / 2, r.z1]; })();
  walk.pos.set(WX(s[0]), 1.55, WZ(s[1]));
  const dx = WX(s[2]) - walk.pos.x, dz = WZ(s[3]) - walk.pos.z;
  walk.yaw = Math.atan2(-dx, -dz); walk.pitch = -.08;
  const sel = document.getElementById('roomSel'); if (sel && SPOTS[id]) sel.value = id;
}
function canWalk(x, z) {
  const xm = MX(x), zm = MZ(z), m = 230;
  if (MAIN.rooms.some(r => xm > r.x1 + m && xm < r.x2 - m && zm > r.z1 + m && zm < r.z2 - m)) return true;
  return MAIN.open.some(o => {
    if (!['open', 'door', 'arch', 'slide', 'slidewin'].includes(o.type)) return false;
    const [u, v] = o.line === 'h' ? [xm, zm] : [zm, xm];
    return u > o.a + 120 && u < o.b - 120 && Math.abs(v - o.at) < 420;
  });
}
function focusRoom(id) {
  const r = MAIN.rooms.find(r => r.id === id); if (!r || state.view !== 'orbit') return;
  const t = new THREE.Vector3(WX((r.x1 + r.x2) / 2), 0, WZ((r.z1 + r.z2) / 2));
  tween = { from: controls.target.clone(), to: t, fromP: camera.position.clone(), toP: t.clone().add(new THREE.Vector3(3.6, 7.2, 6.4)), t: 0 };
}
let tween = null;

// ---------- 확장 전/후 비교 ----------
const cmpEl = document.getElementById('cmp');
function setCompare(on) {
  compare.on = on;
  if (on && !Object.values(state.exp).some(Boolean)) { state.exp.living = true; state.exp.master = true; state.exp.bed2 = true; if (window.toast) toast('비교를 위해 거실·안방·침실2 확장을 켰어요'); }
  selectFurn(null); build();
  cmpEl.classList.toggle('on', on);
  if (on) updateCmpLabel();
  if (window.onCompareChange) window.onCompareChange();
}
function updateCmpLabel() {
  const add = MAIN.rooms.filter(r => r.expanded).reduce((s, r) => s + (r.x2 - r.x1) * (r.z2 - r.z1) / 1e6, 0);
  document.getElementById('cmpAfter').innerHTML = `확장 후 <b>+${add.toFixed(1)}㎡ (${(add / 3.3058).toFixed(1)}평)</b>`;
  cmpEl.querySelector('.bar').style.left = compare.split * 100 + '%';
}
(function () {
  const bar = cmpEl.querySelector('.bar'); let drag = false;
  bar.addEventListener('pointerdown', e => { drag = true; bar.setPointerCapture(e.pointerId); e.stopPropagation(); });
  bar.addEventListener('pointermove', e => { if (!drag) return; const r = viewport.getBoundingClientRect(); compare.split = Math.max(.08, Math.min(.92, (e.clientX - r.left) / r.width)); updateCmpLabel(); });
  bar.addEventListener('pointerup', () => drag = false);
})();

// ---------- 라벨 ----------
const labelLayer = document.getElementById('labels');
let labels = [];
function buildLabels() {
  labelLayer.innerHTML = ''; labels = [];
  for (const r of MAIN.rooms) {
    if (r.nolabel) continue;
    const a = (r.x2 - r.x1) * (r.z2 - r.z1) / 1e6;
    const d = document.createElement('div'); d.className = 'rlabel' + (r.expanded ? ' exp' : '');
    d.innerHTML = `<b>${r.name}</b><span>${r.expanded ? '+' : ''}${a.toFixed(1)}㎡ · ${(a / 3.3058).toFixed(1)}평</span>`;
    d.onclick = () => { focusRoom(r.id); window.onRoomPick && window.onRoomPick(r.id); };
    labelLayer.appendChild(d);
    labels.push({ el: d, p: new THREE.Vector3(WX((r.x1 + r.x2) / 2), .05, WZ((r.z1 + r.z2) / 2)) });
  }
  updateLabels();
}
const _v = new THREE.Vector3();
function updateLabels() {
  const show = state.view !== 'walk' && !compare.on && !dragging, w = viewport.clientWidth, h = viewport.clientHeight;
  labelLayer.style.display = show ? '' : 'none';
  if (show) for (const l of labels) {
    _v.copy(l.p).project(camera);
    l.el.style.transform = `translate(-50%,-50%) translate(${(_v.x * .5 + .5) * w}px,${(-_v.y * .5 + .5) * h}px)`;
    l.el.style.opacity = _v.z < 1 ? 1 : 0;
  }
  updateSelHud();
}

// ---------- 가구 선택·드래그 ----------
let selected = null, dragging = null;
const selGroup = new THREE.Group(); scene.add(selGroup);
const selLineMat = new THREE.LineBasicMaterial({ color: '#2f9e7f', depthTest: false, transparent: true });
const selFillMat = new THREE.MeshBasicMaterial({ color: '#2f9e7f', transparent: true, opacity: .13, depthWrite: false, depthTest: false });
let selIssues = [];
function drawSel() {
  selGroup.clear();
  const f = selected && state.furniture.find(x => x.u === selected); if (!f) return;
  const P = corners(fpOf(f)), y = floorAt(f.x, f.z, MAIN) / 1000 + .015;
  selIssues = checkFurn(f);
  const col = selIssues.length ? '#d9534f' : '#2f9e7f';
  selLineMat.color.set(col); selFillMat.color.set(col);
  const pts = P.concat([P[0]]).map(([x, z]) => new THREE.Vector3(WX(x), y, WZ(z)));
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), selLineMat); line.renderOrder = 10; selGroup.add(line);
  const shp = new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(WX(x), -WZ(z))));
  const fill = new THREE.Mesh(new THREE.ShapeGeometry(shp), selFillMat); fill.rotation.x = -Math.PI / 2; fill.position.y = y; fill.renderOrder = 9; selGroup.add(fill);
}
function selectFurn(u) {
  selected = u; drawSel();
  if (window.onFurnSelect) window.onFurnSelect(u);
}
const selHud = document.getElementById('selHud');
function updateSelHud() {
  const f = selected && state.view !== 'walk' && !compare.on && state.furniture.find(x => x.u === selected);
  selHud.classList.toggle('on', !!f); if (!f) return;
  _v.set(WX(f.x), (floorAt(f.x, f.z, MAIN) + 50) / 1000, WZ(f.z)).project(camera);
  const w = viewport.clientWidth, h = viewport.clientHeight;
  const tag = document.getElementById('selTag');
  const tx = Math.max(110, Math.min(w - 110, (_v.x * .5 + .5) * w)), ty = Math.max(70, (-_v.y * .5 + .5) * h);
  tag.style.transform = `translate(-50%,-140%) translate(${tx}px,${ty}px)`;
}
function furnPatch(u, patch, rebuildObj = false) {
  const f = state.furniture.find(x => x.u === u); if (!f) return;
  Object.assign(f, patch);
  if (rebuildObj) { for (const v of variants()) { removeFurnObj(u, v); const pv = V; V = v; makeFurnObj(f, v); V = pv; } applyLighting(); }
  else for (const v of variants()) { const g = v.furnObjs[u]; if (g) { g.position.set(WX(f.x), floorAt(f.x, f.z, v) / 1000, WZ(f.z)); g.rotation.y = f.r || 0; } }
  drawSel();
}
function addFurn(t, at) {
  const L = FURN_BY[t];
  const x = at ? at[0] : Math.round(MX(controls.target.x) / 50) * 50, z = at ? at[1] : Math.round(MZ(controls.target.z) / 50) * 50;
  const f = newFurn({ t, x, z, r: 0, c: L.def });
  state.furniture.push(f);
  for (const v of variants()) { const pv = V; V = v; makeFurnObj(f, v); V = pv; }
  applyLighting(); selectFurn(f.u); saveState(); return f;
}
function deleteFurn(u) {
  state.furniture = state.furniture.filter(f => f.u !== u);
  for (const v of variants()) removeFurnObj(u, v);
  if (selected === u) selectFurn(null); saveState();
}
function resetFurniture(empty) {
  for (const f of state.furniture) for (const v of variants()) removeFurnObj(f.u, v);
  state.furniture = empty ? [] : defaultFurniture();
  for (const f of state.furniture) for (const v of variants()) { const pv = V; V = v; makeFurnObj(f, v); V = pv; }
  applyLighting(); selectFurn(null); saveState();
}

// ---------- 포인터 ----------
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _hit = new THREE.Vector3();
let downAt = null;
function setPtr(e) { const rc = renderer.domElement.getBoundingClientRect(); ptr.set((e.clientX - rc.left) / rc.width * 2 - 1, -(e.clientY - rc.top) / rc.height * 2 + 1); ray.setFromCamera(ptr, camera); }
function visibleHits(obj) { return ray.intersectObject(obj, true).filter(h => { if (h.object.userData.nopick) return false; let o = h.object; while (o) { if (!o.visible) return false; o = o.parent; } return true; }); }
renderer.domElement.addEventListener('pointerdown', e => {
  downAt = [e.clientX, e.clientY];
  if (state.view === 'walk') { walk.drag = [e.clientX, e.clientY]; renderer.domElement.setPointerCapture(e.pointerId); return; }
  if (compare.on || !selected) return;
  setPtr(e);
  const h = visibleHits(MAIN.root)[0];
  if (h && h.object.userData.furn === selected) {
    const f = state.furniture.find(x => x.u === selected);
    floorPlane.constant = -floorAt(f.x, f.z, MAIN) / 1000;
    if (ray.ray.intersectPlane(floorPlane, _hit)) {
      dragging = { off: [MX(_hit.x) - f.x, MZ(_hit.z) - f.z] };
      controls.enabled = false; renderer.domElement.setPointerCapture(e.pointerId);
    }
  }
}, true);
renderer.domElement.addEventListener('pointermove', e => {
  if (state.view === 'walk' && walk.drag) {
    walk.yaw -= (e.clientX - walk.drag[0]) * .005; walk.pitch = Math.max(-1.2, Math.min(1.2, walk.pitch - (e.clientY - walk.drag[1]) * .004));
    walk.drag = [e.clientX, e.clientY]; return;
  }
  if (dragging) {
    setPtr(e);
    if (ray.ray.intersectPlane(floorPlane, _hit)) {
      const g = e.shiftKey ? 10 : 50;
      furnPatch(selected, { x: Math.round((MX(_hit.x) - dragging.off[0]) / g) * g, z: Math.round((MZ(_hit.z) - dragging.off[1]) / g) * g });
    }
  }
});
renderer.domElement.addEventListener('pointerup', e => {
  walk.drag = null;
  if (dragging) { dragging = null; controls.enabled = true; saveState(); if (window.onFurnChange) window.onFurnChange(); return; }
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  setPtr(e);
  const hits = visibleHits(MAIN.root);
  const fh = state.view !== 'walk' && !compare.on && hits[0] && hits[0].object.userData.furn;
  if (fh) { selectFurn(fh); return; }
  if (selected) selectFurn(null);
  const hit = hits.find(h => h.object.userData.slot);
  if (hit && window.onSlotPick) window.onSlotPick(hit.object.userData.slot, hit.object.userData.room);
});
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const k = e.key.toLowerCase();
  if (selected && state.view !== 'walk') {
    const f = state.furniture.find(x => x.u === selected);
    if (k === 'r') { furnPatch(selected, { r: ((f.r || 0) + Math.PI / 2) % (Math.PI * 2) }); saveState(); return; }
    if (k === 'delete' || k === 'backspace') { deleteFurn(selected); window.onFurnChange && window.onFurnChange(); return; }
    const d = { arrowleft: [-50, 0], arrowright: [50, 0], arrowup: [0, -50], arrowdown: [0, 50] }[k];
    if (d) { e.preventDefault(); furnPatch(selected, { x: f.x + d[0], z: f.z + d[1] }); saveState(); return; }
    if (k === 'escape') { selectFurn(null); return; }
  }
  walk.keys[k] = true;
});
window.addEventListener('keyup', e => { walk.keys[e.key.toLowerCase()] = false; });

let flash = null;
function flashSlot(slot) {
  const m = slotMat[slot]; if (!m) return;
  if (flash && flash.m !== m) { flash.m.emissive.set('#000'); }
  flash = { m, t: 0 };
}

// ---------- 루프 ----------
function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
}
let homed = false;
new ResizeObserver(() => { resize(); if (!homed && viewport.clientWidth) { homed = true; setOrbitHome(); } }).observe(viewport);
function renderFrame() {
  if (compare.on && BEFORE) {
    const w = viewport.clientWidth, h = viewport.clientHeight, sx = Math.round(w * compare.split);
    renderer.setScissorTest(true);
    MAIN.root.visible = false; BEFORE.root.visible = true; renderer.setScissor(0, 0, sx, h); renderer.render(scene, camera);
    MAIN.root.visible = true; BEFORE.root.visible = false; renderer.setScissor(sx, 0, w - sx, h); renderer.render(scene, camera);
    renderer.setScissorTest(false);
  } else if (state.quality) composer.render();
  else renderer.render(scene, camera);
}
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
  renderFrame();
  updateLabels();
  requestAnimationFrame(loop);
}
function snapshot() { selGroup.visible = false; renderFrame(); const u = renderer.domElement.toDataURL('image/jpeg', .92); selGroup.visible = true; return u; }
