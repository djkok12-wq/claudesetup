// ============================================================
//  FURNITURE : 가구 라이브러리 (실제 치수 mm) · 모델 생성 · 기본 배치
//  로컬 좌표: 바닥 중심 (0,0,0), 정면 = +z, 폭 w = x축, 깊이 d = z축
// ============================================================

const FCOL = {
  fabric: [
    { id: 'cream', name: '부클레 크림', color: '#E3DCCF', tex: 'boucle' },
    { id: 'oat', name: '오트밀 린넨', color: '#CBBDA6', tex: 'linen' },
    { id: 'sage', name: '세이지', color: '#98A28D', tex: 'linen' },
    { id: 'terra', name: '테라코타', color: '#B2694C', tex: 'boucle' },
    { id: 'char', name: '차콜', color: '#4B4947', tex: 'linen' },
    { id: 'camel', name: '카멜 가죽', color: '#A06A3C', tex: 'leather' },
  ],
  wood: [
    { id: 'oak', name: '내추럴 오크', color: '#B88E60' },
    { id: 'walnut', name: '월넛', color: '#5E412E' },
    { id: 'white', name: '화이트 무광', color: '#EDEAE4' },
    { id: 'black', name: '블랙 애쉬', color: '#2A2826' },
  ],
  rug: [
    { id: 'ivory', name: '아이보리', color: '#DCD3C4' },
    { id: 'oat', name: '오트밀', color: '#BFAE95' },
    { id: 'grey', name: '웜그레이', color: '#9D9891' },
    { id: 'terra', name: '테라코타', color: '#B88466' },
  ],
};

// ---------- 재질 ----------
const FMC = {};
function fabricMat(cid) {
  const c = FCOL.fabric.find(x => x.id === cid) || FCOL.fabric[0], key = 'fab_' + c.id;
  if (FMC[key]) return FMC[key];
  const t = new THREE.CanvasTexture(fabricCanvas(c.tex, hashStr(c.id)));
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.colorSpace = THREE.SRGBColorSpace;
  const leather = c.tex === 'leather';
  return (FMC[key] = new THREE.MeshPhysicalMaterial({
    color: c.color, map: t, roughness: leather ? .48 : .96, metalness: 0,
    sheen: leather ? 0 : 1, sheenRoughness: .75, sheenColor: new THREE.Color(c.color).lerp(new THREE.Color('#ffffff'), .45),
    clearcoat: leather ? .25 : 0, clearcoatRoughness: .6,
  }));
}
function woodMat(cid) {
  const c = FCOL.wood.find(x => x.id === cid) || FCOL.wood[0], key = 'wood_' + c.id;
  if (FMC[key]) return FMC[key];
  let map = null;
  if (c.id === 'oak' || c.id === 'walnut') {
    const r = TEX.veneer({ w: 600 }, c.color, hashStr('fw' + c.id));
    map = new THREE.CanvasTexture(r.canvas); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping;
  }
  return (FMC[key] = new THREE.MeshStandardMaterial({ color: map ? '#fff' : c.color, map, roughness: c.id === 'white' ? .5 : .55 }));
}
function rugMat(cid) {
  const c = FCOL.rug.find(x => x.id === cid) || FCOL.rug[0], key = 'rug_' + c.id;
  if (FMC[key]) return FMC[key];
  const t = new THREE.CanvasTexture(fabricCanvas('rug', hashStr(c.id))); t.colorSpace = THREE.SRGBColorSpace;
  return (FMC[key] = new THREE.MeshPhysicalMaterial({ color: c.color, map: t, roughness: 1, sheen: .8, sheenRoughness: .9, sheenColor: '#ffffff' }));
}
const FM2 = (k, o) => FMC[k] || (FMC[k] = new THREE.MeshStandardMaterial(o));
const fmBlack = () => FM2('fblack', { color: '#1d1d1d', roughness: .4, metalness: .6 });
const fmBrass = () => FM2('fbrass', { color: '#B8975A', roughness: .3, metalness: 1 });
const fmStone = () => FM2('fstone', { color: '#EDEBE6', roughness: .25 });
const fmLinen = () => FM2('flinen', { color: '#F2EFE9', roughness: .95 });
const fmShade = () => FM2('lampshade', { color: '#EFE8DA', roughness: .8, emissive: '#ffd9a8', emissiveIntensity: 0, side: THREE.DoubleSide });
const fmLeaf = () => FM2('leaf', { color: '#5F7451', roughness: .75, flatShading: true });
const fmLeaf2 = () => FM2('leaf2', { color: '#7C8F64', roughness: .75, flatShading: true });
const fmPot = () => FM2('pot', { color: '#C9BBA7', roughness: .9 });
const fmScreen = () => FM2('screen', { color: '#0a0a0b', roughness: .15, metalness: .4 });

// ---------- 지오메트리 헬퍼 (mm 입력) ----------
function rb(g, mat, w, h, d, x = 0, y = 0, z = 0, r = 20, rx = 0) {
  const rr = Math.max(1, Math.min(r, w / 2 - 1, h / 2 - 1, d / 2 - 1));
  const m = new THREE.Mesh(new RoundedBoxGeometry(w / 1000, h / 1000, d / 1000, 3, rr / 1000), mat);
  m.position.set(x / 1000, (y + h / 2) / 1000, z / 1000); m.rotation.x = rx;
  m.castShadow = m.receiveShadow = true; g.add(m); return m;
}
function cy(g, mat, r, h, x = 0, y = 0, z = 0, seg = 20, r2) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r / 1000, (r2 ?? r) / 1000, h / 1000, seg), mat);
  m.position.set(x / 1000, (y + h / 2) / 1000, z / 1000); m.castShadow = m.receiveShadow = true; g.add(m); return m;
}
function legs4(g, mat, w, d, h, inset = 60, r = 18, y = 0) { for (const sx of [-1, 1]) for (const sz of [-1, 1]) cy(g, mat, r, h, sx * (w / 2 - inset), y, sz * (d / 2 - inset), 10, r * .7); }

// ---------- 모델 ----------
function mkSofa(g, w, d, f, chaise = 0) {
  const arm = 170, back = 200, seatH = 420, baseH = 300, legH = 70;
  legs4(g, fmBlack(), w, d, legH, 80, 14);
  rb(g, f, w, baseH - legH, d, 0, legH, 0, 30);                                           // 베이스
  rb(g, f, arm, 620 - legH, d, -w / 2 + arm / 2, legH, 0, 60);                            // 팔걸이
  rb(g, f, arm, 620 - legH, d, w / 2 - arm / 2, legH, 0, 60);
  rb(g, f, w - 2 * arm + 20, 760 - legH, back, 0, legH, -d / 2 + back / 2, 60);            // 등판
  const n = w > 2000 ? 3 : 2, cw = (w - 2 * arm) / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + arm + cw * (i + .5);
    rb(g, f, cw - 10, seatH - baseH + 40, d - back - 20, x, baseH - 20, back / 2, 70);    // 좌방석
    rb(g, f, cw - 30, 420, 190, x, seatH, -d / 2 + back + 60, 80, -.18);                  // 등쿠션
  }
  if (chaise) {
    const cxw = 900, x = w / 2 - cxw / 2, zc = d / 2 + chaise / 2;
    rb(g, f, cxw, baseH - legH, chaise + 40, x, legH, zc - 20, 30);
    rb(g, f, cxw - 30, seatH - baseH + 40, chaise + 20, x - 10, baseH - 20, zc - 10, 70);
    cy(g, fmBlack(), 14, legH, x + cxw / 2 - 80, 0, zc + chaise / 2 - 80, 8);
    cy(g, fmBlack(), 14, legH, x - cxw / 2 + 80, 0, zc + chaise / 2 - 80, 8);
  }
  const p = fabricMat('terra');
  rb(g, p, 420, 420, 140, -w / 2 + arm + 260, seatH, -d / 2 + back + 170, 70, -.25).rotation.z = .12;
  rb(g, fabricMat('oat'), 400, 400, 130, w / 2 - arm - 260, seatH, -d / 2 + back + 170, 70, -.25).rotation.z = -.1;
}
function mkLounge(g, f, wd) {
  for (const [x, z] of [[-300, -320], [300, -320], [-300, 320], [300, 320]]) cy(g, wd, 18, 380, x, 0, z, 10, 14);
  rb(g, wd, 720, 40, 740, 0, 340, 20, 10);
  rb(g, f, 700, 130, 680, 0, 370, 40, 55);
  const b = rb(g, f, 700, 560, 140, 0, 420, -300, 60); b.rotation.x = -.32;
  rb(g, wd, 60, 40, 700, -360, 560, 0, 10); rb(g, wd, 60, 40, 700, 360, 560, 0, 10);
}
function mkBed(g, w, d, f, wd) {
  const hb = 120;
  rb(g, f, w + 40, 1100, hb, 0, 0, -d / 2 + hb / 2, 50);                                   // 헤드보드
  rb(g, wd, w, 260, d - hb, 0, 40, hb / 2, 20);                                             // 프레임
  cy(g, fmBlack(), 20, 40, -w / 2 + 80, 0, d / 2 - 80); cy(g, fmBlack(), 20, 40, w / 2 - 80, 0, d / 2 - 80);
  rb(g, fmLinen(), w - 40, 240, d - hb - 40, 0, 290, hb / 2, 60);                           // 매트리스
  rb(g, FM2('duvet', { color: '#F4F1EB', roughness: 1 }), w + 30, 70, (d - hb) * .72, 0, 500, d / 2 - (d - hb) * .36 + 10, 35);
  rb(g, fabricMat('oat'), w + 40, 40, 520, 0, 560, d / 2 - 380, 20);                       // 베드스로우
  const pw = w > 1300 ? (w - 160) / 2 : w - 160;
  for (const x of w > 1300 ? [-pw / 2 - 30, pw / 2 + 30] : [0]) rb(g, fmLinen(), pw - 40, 150, 380, x, 520, -d / 2 + hb + 230, 70, -.3);
}
function mkTable(g, w, d, h, wd, round = false) {
  if (round) { cy(g, wd, w / 2, 30, 0, h - 30, 0, 48); cy(g, wd, 120, h - 30, 0, 0, 0, 24, 160); return; }
  rb(g, wd, w, 30, d, 0, h - 30, 0, 8);
  legs4(g, wd, w, d, h - 30, 70, 22);
}
function mkChair(g, wd, f, x, z, rot) {
  const c = new THREE.Group(); c.position.set(x / 1000, 0, z / 1000); c.rotation.y = rot; g.add(c);
  for (const [lx, lz] of [[-180, -170], [180, -170], [-180, 180], [180, 180]]) cy(c, wd, 14, 450, lx, 0, lz, 8, 11);
  rb(c, f, 440, 70, 430, 0, 440, 10, 25);
  const b = rb(c, wd, 420, 230, 30, 0, 600, -200, 12); b.rotation.x = .12;
}
function mkPendant(g, y = 1500, n = 2, span = 700) {
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : -span / 2 + span * i / (n - 1);
    cy(g, fmBlack(), 3, H - y - 200, x, y + 200, 0, 6);
    const s = new THREE.Mesh(new THREE.SphereGeometry(.16, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), fmShade());
    s.position.set(x / 1000, (y + 200) / 1000, 0); s.castShadow = true; g.add(s);
    g.userData.lights = (g.userData.lights || []).concat([[x, y + 120, 0]]);
  }
}
function mkPlant(g, s) {
  cy(g, fmPot(), 190 * s, 420 * s, 0, 0, 0, 28, 150 * s);
  cy(g, FM2('soil', { color: '#3b3128', roughness: 1 }), 178 * s, 10, 0, 410 * s, 0, 24);
  const R = rng(Math.round(s * 100)), trunk = FM2('trunk', { color: '#6b5a48', roughness: .9 });
  cy(g, trunk, 16 * s, 800 * s, 0, 420 * s, 0, 8, 22 * s);
  const leafGeo = new THREE.SphereGeometry(.05 * s, 6, 4); leafGeo.scale(1, .35, 2.2);
  for (let b = 0; b < 5; b++) {
    const a = b / 5 * 6.28 + R(), y0 = (950 + R() * 500) * s / 1000, len = (.18 + R() * .16) * s;
    const br = new THREE.Mesh(new THREE.CylinderGeometry(.006 * s, .009 * s, len, 5), trunk);
    br.position.set(Math.cos(a) * len / 2, y0 + len * .3, Math.sin(a) * len / 2); br.rotation.set(Math.sin(a) * .9, 0, -Math.cos(a) * .9); g.add(br);
    const cx = Math.cos(a) * len, cz = Math.sin(a) * len, cyy = y0 + len * .55;
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(leafGeo, R() < .55 ? fmLeaf() : fmLeaf2());
      const rr = .05 + R() * .17 * s;
      m.position.set(cx + (R() - .5) * rr * 2, cyy + (R() - .3) * rr * 1.6, cz + (R() - .5) * rr * 2);
      m.rotation.set(R() * 3, R() * 6.28, R() * 3); m.castShadow = true; g.add(m);
    }
  }
}
function mkShelf(g, w, d, h, wd) {
  rb(g, wd, 25, h, d, -w / 2 + 12, 0, 0, 3); rb(g, wd, 25, h, d, w / 2 - 12, 0, 0, 3);
  const R = rng(w + h), cols = ['#8C3B2E', '#2F3A4A', '#D8CFC0', '#7C8F64', '#B88E60', '#3A3632', '#C9A86A'];
  for (let i = 0; i < 5; i++) {
    const y = i * (h - 25) / 4; rb(g, wd, w - 50, 25, d, 0, y, 0, 3);
    if (i < 4) { let x = -w / 2 + 50; while (x < w / 2 - 120 && R() < .93) { const bw = 25 + R() * 30, bh = 200 + R() * 120; rb(g, FM2('book' + (R() * 7 | 0), { color: cols[R() * 7 | 0], roughness: .8 }), bw, bh, d - 80, x + bw / 2, y + 25, 0, 2); x += bw + 2; if (R() < .12) x += 120; } }
  }
}
function mkLamp(g, h, wd) {
  cy(g, fmBlack(), 150, 20, 0, 0, 0, 28); cy(g, fmBlack(), 10, h - 300, 0, 20, 0, 8);
  cy(g, fmShade(), 190, 280, 0, h - 300, 0, 32, 220);
  g.userData.lights = [[0, h - 200, 0]];
}

// ---------- 라이브러리 ----------
const FURN_LIB = [
  { id: 'sofa3', name: '3인 소파', cat: '거실', w: 2400, d: 950, price: 1800000, pal: 'fabric', def: 'cream', make: (g, f) => mkSofa(g, 2400, 950, fabricMat(f.c)) },
  { id: 'sofa4', name: '4인 소파', cat: '거실', w: 2800, d: 1000, price: 2300000, pal: 'fabric', def: 'oat', make: (g, f) => mkSofa(g, 2800, 1000, fabricMat(f.c)) },
  { id: 'sofaL', name: 'L자 카우치 소파', cat: '거실', w: 2800, d: 1650, price: 2800000, pal: 'fabric', def: 'cream', make: (g, f) => { const s = new THREE.Group(); s.position.z = -.35; g.add(s); mkSofa(s, 2800, 950, fabricMat(f.c), 700); } },
  { id: 'sofa2', name: '2인 소파', cat: '거실', w: 1700, d: 900, price: 1200000, pal: 'fabric', def: 'sage', make: (g, f) => mkSofa(g, 1700, 900, fabricMat(f.c)) },
  { id: 'lounge', name: '라운지 체어', cat: '거실', w: 760, d: 820, price: 650000, pal: 'fabric', def: 'camel', make: (g, f) => mkLounge(g, fabricMat(f.c), woodMat('walnut')) },
  { id: 'coffeeR', name: '원형 커피테이블 Ø900', cat: '거실', w: 900, d: 900, price: 380000, pal: 'wood', def: 'oak', make: (g, f) => mkTable(g, 900, 900, 340, woodMat(f.c), true) },
  { id: 'coffeeS', name: '사각 커피테이블 1200', cat: '거실', w: 1200, d: 600, price: 320000, pal: 'wood', def: 'walnut', make: (g, f) => { rb(g, woodMat(f.c), 1200, 60, 600, 0, 280, 0, 25); rb(g, woodMat(f.c), 1100, 280, 500, 0, 0, 0, 20); } },
  { id: 'tvc', name: '플로팅 TV장 2400', cat: '거실', w: 2400, d: 420, price: 550000, pal: 'wood', def: 'walnut', make: (g, f) => { const m = woodMat(f.c); rb(g, m, 2400, 300, 420, 0, 180, 0, 6); for (const x of [-600, 0, 600]) rb(g, FM2('gap', { color: '#1a1816' }), 6, 260, 4, x, 200, 210, 1); } },
  { id: 'tv75', name: '75인치 TV (벽걸이)', cat: '거실', w: 1680, d: 60, price: 2200000, wall: true, make: g => { rb(g, fmScreen(), 1680, 965, 30, 0, 950, 15, 6); rb(g, fmBlack(), 600, 400, 25, 0, 1200, -12, 4); } },
  { id: 'rug', name: '러그 3000×2000', cat: '거실', w: 3000, d: 2000, price: 450000, flat: true, pal: 'rug', def: 'ivory', make: (g, f) => rb(g, rugMat(f.c), 3000, 10, 2000, 0, 0, 0, 4) },
  { id: 'rugS', name: '러그 2000×1400', cat: '거실', w: 2000, d: 1400, price: 250000, flat: true, pal: 'rug', def: 'oat', make: (g, f) => rb(g, rugMat(f.c), 2000, 10, 1400, 0, 0, 0, 4) },
  { id: 'flamp', name: '플로어 램프', cat: '거실', w: 440, d: 440, price: 280000, make: g => mkLamp(g, 1600) },
  { id: 'dining4', name: '4인 식탁 세트 + 펜던트', cat: '다이닝', w: 1600, d: 1900, price: 1500000, pal: 'wood', def: 'oak', make: (g, f) => { const wd = woodMat(f.c); mkTable(g, 1600, 900, 740, wd); for (const x of [-400, 400]) { mkChair(g, wd, fabricMat('oat'), x, -650, 0); mkChair(g, wd, fabricMat('oat'), x, 650, Math.PI); } mkPendant(g, 1450, 2, 800); } },
  { id: 'dining6', name: '6인 식탁 세트 + 펜던트', cat: '다이닝', w: 2000, d: 2000, price: 2100000, pal: 'wood', def: 'walnut', make: (g, f) => { const wd = woodMat(f.c); mkTable(g, 2000, 1000, 740, wd); for (const x of [-600, 0, 600]) { mkChair(g, wd, fabricMat('char'), x, -700, 0); mkChair(g, wd, fabricMat('char'), x, 700, Math.PI); } mkPendant(g, 1450, 3, 1100); } },
  { id: 'island', name: '아일랜드 식탁 2000', cat: '다이닝', w: 2000, d: 1300, price: 1800000, pal: 'wood', def: 'white', make: (g, f) => { rb(g, woodMat(f.c), 1960, 870, 860, 0, 0, -220, 6); rb(g, fmStone(), 2000, 30, 900, 0, 870, -200, 4); for (const x of [-600, 0, 600]) { cy(g, fmBlack(), 12, 650, x, 0, 380, 8); cy(g, fabricMat('camel'), 190, 50, x, 650, 380, 24); } mkPendant(g, 1500, 3, 1200); } },
  { id: 'bedK', name: '킹 침대 (매트리스 포함)', cat: '침실', w: 1800, d: 2150, price: 2600000, pal: 'fabric', def: 'oat', make: (g, f) => mkBed(g, 1800, 2150, fabricMat(f.c), woodMat('oak')) },
  { id: 'bedQ', name: '퀸 침대 (매트리스 포함)', cat: '침실', w: 1600, d: 2150, price: 2100000, pal: 'fabric', def: 'oat', make: (g, f) => mkBed(g, 1600, 2150, fabricMat(f.c), woodMat('oak')) },
  { id: 'bedSS', name: '슈퍼싱글 침대', cat: '침실', w: 1100, d: 2050, price: 1300000, pal: 'fabric', def: 'sage', make: (g, f) => mkBed(g, 1100, 2050, fabricMat(f.c), woodMat('oak')) },
  { id: 'night', name: '협탁 + 스탠드', cat: '침실', w: 450, d: 400, price: 260000, pal: 'wood', def: 'oak', make: (g, f) => { rb(g, woodMat(f.c), 450, 450, 400, 0, 80, 0, 12); legs4(g, fmBlack(), 450, 400, 80, 40, 10); rb(g, FM2('gap', { color: '#1a1816' }), 380, 4, 4, 0, 300, 201, 1); cy(g, fmStone(), 60, 220, 0, 530, 0, 16, 80); cy(g, fmShade(), 120, 160, 0, 740, 0, 24, 150); g.userData.lights = [[0, 800, 0]]; } },
  { id: 'vanity', name: '화장대 1000 + 거울', cat: '침실', w: 1000, d: 450, price: 480000, pal: 'wood', def: 'white', make: (g, f) => { const wd = woodMat(f.c); rb(g, wd, 1000, 40, 450, 0, 720, 0, 8); legs4(g, wd, 1000, 450, 720, 40, 16); rb(g, wd, 1000, 160, 430, 0, 560, 0, 8); cy(g, FM2('mirror2', { color: '#dfe6e8', roughness: .02, metalness: 1 }), 320, 20, 0, 1050, -200, 40).rotation.x = Math.PI / 2; } },
  { id: 'desk', name: '책상 1200 + 의자', cat: '서재·수납', w: 1200, d: 650, price: 520000, pal: 'wood', def: 'oak', make: (g, f) => { const wd = woodMat(f.c); mkTable(g, 1200, 650, 730, wd); rb(g, fmScreen(), 600, 350, 25, 0, 900, -200, 6); cy(g, fmBlack(), 8, 160, 0, 740, -220, 8); mkChair(g, fmBlack(), fabricMat('char'), 0, 500, Math.PI); } },
  { id: 'shelf', name: '오픈 책장 1200', cat: '서재·수납', w: 1200, d: 350, price: 380000, pal: 'wood', def: 'oak', make: (g, f) => mkShelf(g, 1200, 350, 1800, woodMat(f.c)) },
  { id: 'wardrobe', name: '이동식 옷장 1200', cat: '서재·수납', w: 1200, d: 600, price: 750000, pal: 'wood', def: 'white', make: (g, f) => { rb(g, woodMat(f.c), 1200, 2050, 600, 0, 50, 0, 6); for (const x of [-300, 300]) rb(g, FM2('gap', { color: '#1a1816' }), 4, 1950, 4, x, 100, 301, 1); legs4(g, fmBlack(), 1200, 600, 50, 50, 14); } },
  { id: 'daybed', name: '데이베드', cat: '서재·수납', w: 1900, d: 800, price: 850000, pal: 'fabric', def: 'oat', make: (g, f) => { const m = fabricMat(f.c); legs4(g, woodMat('oak'), 1900, 800, 120, 60, 18); rb(g, m, 1900, 280, 800, 0, 120, 0, 40); rb(g, m, 1880, 400, 160, 0, 380, -320, 60); for (const x of [-500, 500]) rb(g, fabricMat('cream'), 450, 420, 140, x, 400, -200, 70, -.2); } },
  { id: 'bistro', name: '발코니 티테이블 세트', cat: '소품·발코니', w: 1300, d: 700, price: 320000, pal: 'wood', def: 'oak', make: (g, f) => { const wd = woodMat(f.c); mkTable(g, 600, 600, 700, wd, true); for (const x of [-480, 480]) { const c = new THREE.Group(); c.position.x = x / 1000; c.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; c.scale.setScalar(.82); g.add(c); mkLounge(c, fabricMat('oat'), wd); } } },
  { id: 'plantL', name: '대형 화분 (올리브)', cat: '소품·발코니', w: 600, d: 600, price: 220000, make: g => mkPlant(g, 1.2) },
  { id: 'plantS', name: '소형 화분', cat: '소품·발코니', w: 380, d: 380, price: 70000, make: g => mkPlant(g, .7) },
  { id: 'bench', name: '벤치 900', cat: '소품·발코니', w: 900, d: 350, price: 240000, pal: 'wood', def: 'oak', make: (g, f) => { const wd = woodMat(f.c); rb(g, wd, 900, 40, 350, 0, 410, 0, 8); for (const x of [-400, 400]) rb(g, wd, 40, 410, 330, x, 0, 0, 4); } },
];
const FURN_BY = Object.fromEntries(FURN_LIB.map(f => [f.id, f]));
const FURN_CATS = ['거실', '다이닝', '침실', '서재·수납', '소품·발코니'];

const P2 = Math.PI / 2;
const DEFAULT_FURN = [
  { t: 'tvc', x: 4400, z: 11550, r: P2, c: 'walnut' }, { t: 'tv75', x: 4225, z: 11550, r: P2 },
  { t: 'rug', x: 6650, z: 11850, r: 0, c: 'ivory' }, { t: 'sofa3', x: 8195, z: 11850, r: -P2, c: 'cream' },
  { t: 'coffeeR', x: 6650, z: 11850, r: 0, c: 'oak' }, { t: 'lounge', x: 5450, z: 13050, r: 2.4, c: 'camel' },
  { t: 'flamp', x: 8420, z: 10400, r: 0 }, { t: 'plantL', x: 4600, z: 9950, r: 0 },
  { t: 'dining4', x: 6100, z: 7720, r: 0, c: 'oak' },
  { t: 'bedQ', x: 1175, z: 11700, r: P2, c: 'oat' }, { t: 'night', x: 300, z: 10620, r: P2, c: 'oak' }, { t: 'night', x: 300, z: 12780, r: P2, c: 'oak' },
  { t: 'lounge', x: 2800, z: 12780, r: 2.6, c: 'oat' },
  { t: 'bedSS', x: 10845, z: 11780, r: -P2, c: 'sage' }, { t: 'desk', x: 9205, z: 12750, r: P2, c: 'white' },
  { t: 'desk', x: 2170, z: 6350, r: P2, c: 'oak' }, { t: 'shelf', x: 3815, z: 5900, r: -P2, c: 'oak' },
  { t: 'bistro', x: 7300, z: 14250, r: 0, c: 'oak' }, { t: 'plantL', x: 4700, z: 14450, r: 0 },
  { t: 'plantS', x: 900, z: 14600, r: 0 }, { t: 'plantS', x: 11550, z: 14350, r: 0 },
];
let _fuid = 1;
function newFurn(o) { return { u: 'f' + (Date.now() % 1e7) + '_' + (_fuid++), c: FURN_BY[o.t].def, r: 0, ...o }; }
function defaultFurniture() { return DEFAULT_FURN.map(o => newFurn(o)); }

// ---------- 충돌 (OBB · SAT) ----------
function fpOf(f) { const L = FURN_BY[f.t]; return { cx: f.x, cz: f.z, hw: L.w / 2 - 5, hd: L.d / 2 - 5, a: f.r || 0 }; }
function corners(fp) {
  const c = Math.cos(fp.a), s = Math.sin(fp.a);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [fp.cx + u * fp.hw * c + v * fp.hd * s, fp.cz - u * fp.hw * s + v * fp.hd * c]);
}
function rectPoly(r) { return [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]]; }
function polysOverlap(A, B) {
  for (const P of [A, B]) for (let i = 0; i < 4; i++) {
    const [x1, z1] = P[i], [x2, z2] = P[(i + 1) % 4], nx = z1 - z2, nz = x2 - x1;
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (const [x, z] of A) { const p = x * nx + z * nz; a0 = Math.min(a0, p); a1 = Math.max(a1, p); }
    for (const [x, z] of B) { const p = x * nx + z * nz; b0 = Math.min(b0, p); b1 = Math.max(b1, p); }
    if (a1 <= b0 || b1 <= a0) return false;
  }
  return true;
}
