// ============================================================
//  TEXTURES : 캔버스 절차적 텍스처 (외부 이미지 없이 생성)
//  반환: { canvas, size:[u_m, v_m] }  — 텍스처 1장이 덮는 실제 크기(m)
// ============================================================

function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgbStr(r, g, b, a = 1) { return `rgba(${r | 0},${g | 0},${b | 0},${a})`; }
function shade(hex, f) { // f: -1..1 밝기 조절
  const [r, g, b] = hexToRgb(hex);
  const t = f < 0 ? 0 : 255, p = Math.abs(f);
  return rgbStr(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
}
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function noise(ctx, w, h, amt, R, scale = 1) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (R() - .5) * amt * scale; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
}

// 나뭇결 한 판 그리기 (x,y,w,h, 결 방향: 'v' 세로 / 'h' 가로)
function drawPlank(ctx, x, y, w, h, base, v, R, dir = 'v') {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = shade(base, (R() - .5) * 2 * v); ctx.fillRect(x, y, w, h);
  const along = dir === 'v' ? h : w, across = dir === 'v' ? w : h;
  const lines = 10 + (R() * 10 | 0);
  for (let i = 0; i < lines; i++) {
    const off = R() * across, amp = 1 + R() * across * .06, freq = (1 + R() * 3) / along * Math.PI * 2, ph = R() * 6;
    ctx.strokeStyle = R() < .5 ? 'rgba(60,35,15,' + (.04 + R() * .08) + ')' : 'rgba(255,240,220,' + (.03 + R() * .05) + ')';
    ctx.lineWidth = .5 + R() * 1.6; ctx.beginPath();
    for (let s = 0; s <= along; s += 6) {
      const o = off + Math.sin(s * freq + ph) * amp;
      if (dir === 'v') { s === 0 ? ctx.moveTo(x + o, y + s) : ctx.lineTo(x + o, y + s); }
      else { s === 0 ? ctx.moveTo(x + s, y + o) : ctx.lineTo(x + s, y + o); }
    }
    ctx.stroke();
  }
  // 옹이 (드물게)
  if (R() < .25) {
    const kx = dir === 'v' ? x + R() * w : x + R() * w, ky = dir === 'v' ? y + R() * h : y + R() * h;
    const g = ctx.createRadialGradient(kx, ky, 0, kx, ky, across * .18);
    g.addColorStop(0, 'rgba(70,40,20,.35)'); g.addColorStop(1, 'rgba(70,40,20,0)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

const TEX = {
  wood(t, color, seed) {
    const R = rng(seed);
    const cols = 4, pxPerM = 640;
    const W = Math.round(cols * t.w / 1000 * pxPerM), H = Math.round(t.l / 1000 * pxPerM);
    const c = mkCanvas(W, H), ctx = c.getContext('2d');
    const pw = W / cols, offs = [0, .5, .25, .75];
    for (let i = 0; i < cols; i++) {
      const o = offs[i] * H;
      for (const y0 of [o - H, o]) drawPlank(ctx, i * pw, y0, pw, H, color, t.v, R, 'v');
      ctx.fillStyle = 'rgba(40,25,10,.45)';
      ctx.fillRect(i * pw, 0, t.gap ? t.gap : 1.4, H);
      ctx.fillRect(i * pw, o, pw, t.gap ? t.gap : 1.4);
    }
    noise(ctx, W, H, 10, R);
    return { canvas: c, size: [cols * t.w / 1000, t.l / 1000] };
  },
  herring(t, color, seed) {
    const R = rng(seed);
    const L = t.l, w = t.w, k = Math.round(L / w), P = 2 * L, S = 1024 / P;
    const c = mkCanvas(1024, 1024), ctx = c.getContext('2d');
    ctx.fillStyle = color; ctx.fillRect(0, 0, 1024, 1024);
    const pieceCol = {};
    for (let b = -4; b <= 4; b++) for (let n = -4 * k; n <= 4 * k; n++) {
      const ox = (n * w + b * L) * S, oy = (n * w - b * L) * S;
      if (ox > 1100 || oy > 1100 || ox + (L + w) * S < -50 || oy + (L + w) * S < -50) continue;
      const key = ((n - k * b) % (2 * k) + 2 * k) % (2 * k);
      const R2 = rng(seed + key * 131);
      drawPlank(ctx, ox, oy, L * S, w * S, color, t.v, R2, 'h');
      const R3 = rng(seed + key * 131 + 77);
      drawPlank(ctx, ox, oy + w * S, w * S, L * S, color, t.v, R3, 'v');
      ctx.strokeStyle = 'rgba(40,25,10,.5)'; ctx.lineWidth = 1.2;
      ctx.strokeRect(ox, oy, L * S, w * S); ctx.strokeRect(ox, oy + w * S, w * S, L * S);
    }
    noise(ctx, 1024, 1024, 8, R);
    return { canvas: c, size: [P / 1000, P / 1000], rotate: Math.PI / 4 };
  },
  tile(t, color, seed) {
    const R = rng(seed);
    const nx = t.nogrout ? 1 : 2, ny = t.nogrout ? 1 : 2;
    const sizeU = nx * t.w / 1000, sizeV = ny * t.h / 1000;
    const pxPerM = Math.min(1024 / sizeU, 1024 / sizeV, 900);
    const W = Math.round(sizeU * pxPerM), H = Math.round(sizeV * pxPerM);
    const c = mkCanvas(W, H), ctx = c.getContext('2d');
    const tw = W / nx, th = H / ny;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const x = i * tw, y = j * th;
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, tw, th); ctx.clip();
      ctx.fillStyle = shade(color, (R() - .5) * .04); ctx.fillRect(x, y, tw, th);
      VEIN[t.vein || 'stone'](ctx, x, y, tw, th, color, R);
      ctx.restore();
    }
    noise(ctx, W, H, t.vein === 'concrete' ? 14 : 6, R);
    if (!t.nogrout) {
      ctx.fillStyle = t.g; const gw = Math.max(1.5, 2.5 * pxPerM / 1000);
      for (let i = 0; i < nx; i++) ctx.fillRect(i * tw, 0, gw, H);
      for (let j = 0; j < ny; j++) ctx.fillRect(0, j * th, W, gw);
    }
    return { canvas: c, size: [sizeU, sizeV] };
  },
  hex(t, color, seed) {
    const R = rng(seed);
    const r = t.r, pxPerM = 1400;
    const Wm = Math.sqrt(3) * r / 1000 * 2, Hm = 3 * r / 1000;
    const W = Math.round(Wm * pxPerM), H = Math.round(Hm * pxPerM), rp = r / 1000 * pxPerM;
    const c = mkCanvas(W, H), ctx = c.getContext('2d');
    ctx.fillStyle = t.g; ctx.fillRect(0, 0, W, H);
    const dx = Math.sqrt(3) * rp, gw = Math.max(1.5, rp * .04);
    for (let j = -1; j <= 3; j++) for (let i = -1; i <= 3; i++) {
      const cx = i * dx + (j % 2 ? dx / 2 : 0), cy = j * 1.5 * rp;
      ctx.beginPath();
      for (let a = 0; a < 6; a++) { const ang = Math.PI / 6 + a * Math.PI / 3; const px = cx + Math.cos(ang) * (rp - gw), py = cy + Math.sin(ang) * (rp - gw); a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath(); ctx.fillStyle = shade(color, (R() - .5) * .06); ctx.fill();
    }
    noise(ctx, W, H, 6, R);
    return { canvas: c, size: [Wm, Hm] };
  },
  brick(t, color, seed) { // 서브웨이·젤리지 (가로로 긴 타일)
    const R = rng(seed);
    const tw = t.h, th = t.w; // 가로 길이 h, 세로 높이 w
    const cols = 2, rows = 6, pxPerM = 1600;
    const Wm = cols * tw / 1000, Hm = rows * th / 1000;
    const W = Math.round(Wm * pxPerM), H = Math.round(Hm * pxPerM);
    const c = mkCanvas(W, H), ctx = c.getContext('2d');
    ctx.fillStyle = t.g; ctx.fillRect(0, 0, W, H);
    const pw = W / cols, ph = H / rows, gw = 2.5;
    for (let r = 0; r < rows; r++) {
      const off = t.stack ? 0 : (r % 2) * pw / 2;
      for (let i = -1; i <= cols; i++) {
        const x = i * pw + off, y = r * ph;
        const g = ctx.createLinearGradient(x, y, x, y + ph);
        const base = shade(color, (R() - .5) * (t.stack ? .05 : .14));
        g.addColorStop(0, base); g.addColorStop(.5, shade(color, (R() - .3) * .1)); g.addColorStop(1, base);
        ctx.fillStyle = g; ctx.fillRect(x + gw, y + gw, pw - gw, ph - gw);
      }
    }
    noise(ctx, W, H, 8, R);
    return { canvas: c, size: [Wm, Hm] };
  },
  paper(t, color, seed) {
    const R = rng(seed), S = 256;
    const c = mkCanvas(S, S), ctx = c.getContext('2d');
    ctx.fillStyle = color; ctx.fillRect(0, 0, S, S);
    if (t.p === 'linen') {
      for (let i = 0; i < S; i += 2) {
        ctx.fillStyle = `rgba(0,0,0,${R() * .05})`; ctx.fillRect(0, i, S, 1);
        ctx.fillStyle = `rgba(255,255,255,${R() * .05})`; ctx.fillRect(i, 0, 1, S);
      }
      noise(ctx, S, S, 10, R);
    } else if (t.p === 'orange') noise(ctx, S, S, 16, R);
    else noise(ctx, S, S, 5, R);
    return { canvas: c, size: [.25, .25] };
  },
  lime(t, color, seed) {
    const R = rng(seed), S = 512;
    const c = mkCanvas(S, S), ctx = c.getContext('2d');
    ctx.fillStyle = color; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 140; i++) {
      const x = R() * S, y = R() * S, rr = 40 + R() * 120;
      for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
        const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rr);
        const a = R() * .07, l = R() < .5;
        g.addColorStop(0, l ? `rgba(255,255,255,${a})` : `rgba(80,60,40,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      }
    }
    noise(ctx, S, S, 6, R);
    return { canvas: c, size: [1.6, 1.6] };
  },
  tambour(t, color, seed) {
    const R = rng(seed), W = 512, H = 1024;
    const c = mkCanvas(W, H), ctx = c.getContext('2d');
    drawPlank(ctx, 0, 0, W, H, color, .03, R, 'v');
    const n = 16, rw = W / n;
    for (let i = 0; i < n; i++) {
      const g = ctx.createLinearGradient(i * rw, 0, (i + 1) * rw, 0);
      g.addColorStop(0, 'rgba(0,0,0,.38)'); g.addColorStop(.18, 'rgba(255,255,255,.10)');
      g.addColorStop(.5, 'rgba(255,255,255,.16)'); g.addColorStop(.85, 'rgba(0,0,0,.06)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
      ctx.fillStyle = g; ctx.fillRect(i * rw, 0, rw, H);
    }
    return { canvas: c, size: [n * t.r / 1000, n * t.r / 1000 * 2] };
  },
  veneer(t, color, seed) {
    const R = rng(seed), W = 512, H = 1024;
    const c = mkCanvas(W, H), ctx = c.getContext('2d');
    drawPlank(ctx, 0, 0, W, H, color, .04, R, 'v');
    // 플랫컷 무늬 (산형)
    for (let i = 0; i < 9; i++) {
      ctx.strokeStyle = `rgba(60,35,15,${.05 + R() * .07})`; ctx.lineWidth = 1 + R() * 2;
      const cx = W * (.3 + R() * .4), top = H * (.1 + i * .1);
      ctx.beginPath(); ctx.moveTo(cx - W * .45, H); ctx.quadraticCurveTo(cx, top - 300, cx + W * .45, H); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(30,20,10,.5)'; ctx.fillRect(0, 0, 2, H);
    noise(ctx, W, H, 8, R);
    return { canvas: c, size: [t.w / 1000, t.w / 1000 * 2] };
  },
};

// ---------- 석재 무늬 ----------
const VEIN = {
  stone(ctx, x, y, w, h, color, R) {
    for (let i = 0; i < 60; i++) {
      const px = x + R() * w, py = y + R() * h, rr = 10 + R() * w * .2;
      const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
      const a = R() * .022; g.addColorStop(0, R() < .5 ? `rgba(255,255,255,${a})` : `rgba(90,75,60,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    }
  },
  concrete(ctx, x, y, w, h, color, R) {
    VEIN.stone(ctx, x, y, w, h, color, R);
    for (let i = 0; i < 120; i++) { ctx.fillStyle = `rgba(40,40,40,${R() * .25})`; const s = R() * 2.5; ctx.beginPath(); ctx.arc(x + R() * w, y + R() * h, s, 0, 7); ctx.fill(); }
  },
  marble(ctx, x, y, w, h, color, R) {
    VEIN.stone(ctx, x, y, w, h, color, R);
    const veins = 3 + (R() * 4 | 0);
    for (let v = 0; v < veins; v++) {
      let px = x + R() * w, py = y - 20, ang = Math.PI / 2 + (R() - .5) * 1.2;
      const main = R() < .45, pts = [[px, py]];
      while (py < y + h + 20 && pts.length < 400) { ang += (R() - .5) * .5; px += Math.cos(ang) * 8; py += Math.abs(Math.sin(ang)) * 8 + 1; pts.push([px, py]); }
      for (const [lw, a] of main ? [[7, .05], [3, .12], [1.2, .35]] : [[3, .05], [1, .2]]) {
        ctx.strokeStyle = `rgba(120,110,100,${a})`; ctx.lineWidth = lw; ctx.beginPath();
        pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      }
      if (main) { ctx.strokeStyle = 'rgba(170,140,90,.25)'; ctx.lineWidth = 1; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0] + 3, p[1]) : ctx.moveTo(p[0] + 3, p[1])); ctx.stroke(); }
    }
  },
  trav(ctx, x, y, w, h, color, R) {
    VEIN.stone(ctx, x, y, w, h, color, R);
    for (let i = 0; i < 70; i++) {
      const yy = y + R() * h, a = R() * .09;
      ctx.fillStyle = R() < .5 ? `rgba(255,250,240,${a})` : `rgba(120,95,65,${a})`;
      ctx.fillRect(x, yy, w, 1 + R() * 6);
    }
    for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(110,90,65,${.15 + R() * .2})`; ctx.beginPath(); ctx.ellipse(x + R() * w, y + R() * h, 1 + R() * 5, .6 + R() * 1.5, 0, 0, 7); ctx.fill(); }
  },
  terrazzo(ctx, x, y, w, h, color, R) {
    const chips = ['#8C8378', '#B9A58C', '#6E6A66', '#E9E4DC', '#A88F77', '#C9C1B5', '#7E7468'];
    for (let i = 0; i < w * h / 160; i++) {
      ctx.fillStyle = chips[R() * chips.length | 0];
      const cx = x + R() * w, cy = y + R() * h, s = 1.5 + R() * R() * 14, n = 4 + (R() * 3 | 0);
      ctx.beginPath();
      for (let k = 0; k < n; k++) { const a = k / n * 6.28 + R() * .6, rr = s * (.6 + R() * .5); k ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    }
  },
  speck(ctx, x, y, w, h, color, R) {
    for (let i = 0; i < w * h / 90; i++) { ctx.fillStyle = `rgba(${R() < .5 ? '90,90,90' : '200,200,200'},${R() * .5})`; ctx.fillRect(x + R() * w, y + R() * h, 1.5, 1.5); }
  },
};

function makeTexCanvas(item) {
  if (!item.tex || item.tex.k === 'paint') return null;
  const seed = hashStr(item.id);
  return TEX[item.tex.k](item.tex, item.color, seed);
}

// ---------- 패브릭 (직조 질감, 그레이스케일 → 색상 곱) ----------
function fabricCanvas(kind, seed) {
  const R = rng(seed), S = 256, c = mkCanvas(S, S), ctx = c.getContext('2d');
  ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, 0, S, S);
  if (kind === 'boucle') {
    for (let i = 0; i < 2600; i++) { const x = R() * S, y = R() * S, r = 1 + R() * 2.4; ctx.fillStyle = `rgba(${R() < .5 ? '255,255,255' : '120,120,120'},${.25 + R() * .3})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  } else if (kind === 'leather') {
    for (let i = 0; i < 400; i++) { const x = R() * S, y = R() * S; ctx.strokeStyle = `rgba(90,90,90,${R() * .12})`; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (R() - .5) * 14, y + (R() - .5) * 14); ctx.stroke(); }
  } else if (kind === 'rug') {
    for (let y = 0; y < S; y += 3) for (let x = 0; x < S; x += 3) { ctx.fillStyle = `rgba(${R() < .5 ? '255,255,255' : '90,90,90'},${R() * .25})`; ctx.fillRect(x, y, 3, 3); }
    ctx.strokeStyle = 'rgba(80,80,80,.18)'; ctx.lineWidth = 6; ctx.strokeRect(20, 20, S - 40, S - 40);
  } else { // linen weave
    for (let i = 0; i < S; i += 2) { ctx.fillStyle = `rgba(0,0,0,${R() * .09})`; ctx.fillRect(0, i, S, 1); ctx.fillStyle = `rgba(255,255,255,${R() * .1})`; ctx.fillRect(i, 0, 1, S); }
  }
  noise(ctx, S, S, 14, R);
  return c;
}

// ---------- 아파트 입면 (주변 단지) ----------
function facadeCanvas(seed, lit) {
  const R = rng(seed), W = 512, Hh = 1024, c = mkCanvas(W, Hh), ctx = c.getContext('2d');
  ctx.fillStyle = lit ? '#1c1f26' : '#e9e6df'; ctx.fillRect(0, 0, W, Hh);
  const cols = 8, rows = 19, cw = W / cols, rh = Hh / rows;
  for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
    const x = i * cw + cw * .12, y = r * rh + rh * .22, w = cw * .76, h = rh * .55;
    if (lit) { ctx.fillStyle = R() < .45 ? `rgba(255,${190 + R() * 40 | 0},${120 + R() * 50 | 0},${.6 + R() * .4})` : 'rgba(30,34,44,1)'; }
    else { ctx.fillStyle = R() < .15 ? '#9aa6ad' : '#7d8a93'; }
    ctx.fillRect(x, y, w, h);
    if (!lit) { ctx.fillStyle = '#f4f2ee'; ctx.fillRect(i * cw, r * rh + rh * .8, cw, rh * .08); }
  }
  return c;
}
