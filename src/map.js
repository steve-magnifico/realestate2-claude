'use strict';
/* ===== 청운시 지도, 캐릭터, 입력, 게임 루프 ===== */
const T = 16, MW = 50, MH = 34;
const FAC = [
  { id: 'hall', name: '청운시청', bx: 18, by: 4, w: 4, h: 4, style: 'hall' },
  { id: 'bank', name: '청운은행', bx: 23, by: 5, w: 3, h: 3, style: 'bank' },
  { id: 'pf', name: '청운증권 PF센터', bx: 38, by: 3, w: 4, h: 5, style: 'pf' },
  { id: 'agent', name: '김여사 복덕방', bx: 19, by: 11, w: 3, h: 3, style: 'shop' },
  { id: 'station', name: '청운역 공사장', bx: 18, by: 21, w: 4, h: 3, style: 'station' }
];
const NPCS = [{ id: 'agent', name: '김여사', x: 22, y: 13, look: 'kim' }, { id: 'paper', name: '신문 가판대', x: 25, y: 10, look: 'boy' }];
const BLD = PROPS.map(p => ({ id: p.id, name: p.name.replace(/ \d+㎡$/, ''), bx: p.bx, by: p.by, w: p.w, h: p.h, style: p.style, hue: p.hue, prop: true })).concat(FAC);
let grid = [], mapCv, mx, cv, ctx, dpr = 1, scale = 3, vw = 0, vh = 0, camX = 0, camY = 0, lastT = 0, promptId = null;
const pl = { x: 24, y: 9, px: 24 * T, py: 9 * T, dir: 0, moving: false, tx: 24, ty: 9, path: [], goal: null, anim: 0 };
const keys = {};
const hash2 = (x, y) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const R_ = (x, y, w, h, c) => { mx.fillStyle = c; mx.fillRect(x, y, w, h); };
const isRoad = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH && (grid[y][x] === 1 || grid[y][x] === 5);
const walkable = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH && [0, 1, 2, 3, 5, 8].includes(grid[y][x]);

function buildGrid() {
  grid = []; for (let y = 0; y < MH; y++) grid.push(new Array(MW).fill(0));
  const set = (x, y, v) => { if (x >= 0 && x < MW && y >= 0 && y < MH) grid[y][x] = v; };
  for (let x = 0; x < MW; x++) { for (const y of [8, 9, 24, 25]) set(x, y, 1); set(x, 14, 2); set(x, 20, 2); set(x, 31, 3); for (const y of [16, 17, 18]) set(x, y, 4); }
  for (const x of [6, 7, 26, 27, 44, 45]) { for (let y = 2; y <= 14; y++) set(x, y, 1); for (let y = 20; y <= 31; y++) set(x, y, 1); }
  for (const x of [16, 17, 36, 37]) for (let y = 2; y <= 31; y++) set(x, y, y >= 16 && y <= 18 ? 5 : 1);
  for (let y = 26; y <= 30; y++) for (let x = 9; x <= 24; x++) if (x !== 16 && x !== 17) set(x, y, 8);
  for (const b of BLD) for (let y = b.by; y < b.by + b.h; y++) for (let x = b.bx; x < b.bx + b.w; x++) set(x, y, 6);
  for (const n of NPCS) set(n.x, n.y, 9);
  set(24, 10, 9);
  const R = mulberry32(77);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (grid[y][x] !== 0) continue;
    const border = x === 0 || x === MW - 1 || y <= 1 || y >= 32, park = x >= 28 && x <= 35 && y >= 10 && y <= 13;
    if (border || R() < (park ? .22 : .06)) { if (Math.abs(x - 24) + Math.abs(y - 9) > 2 && !(x === 22 && y === 12) && !(x === 23 && y === 13)) grid[y][x] = 7; }
  }
}

/* ----- 픽셀 아트 ----- */
function paintTile(x, y) {
  const t = grid[y][x], X = x * T, Y = y * T, h = hash2(x, y);
  if (t === 1) {
    R_(X, Y, T, T, '#4A4F63'); if (h > .6) R_(X + (h * 97 | 0) % 13, Y + (h * 57 | 0) % 13, 2, 1, '#565B70');
    if (!isRoad(x, y - 1)) R_(X, Y, T, 2, '#A2A7B8'); if (!isRoad(x, y + 1)) R_(X, Y + T - 2, T, 2, '#A2A7B8');
    if (!isRoad(x - 1, y)) R_(X, Y, 2, T, '#A2A7B8'); if (!isRoad(x + 1, y)) R_(X + T - 2, Y, 2, T, '#A2A7B8');
  } else if (t === 2) { R_(X, Y, T, T, '#DCC690'); R_(X + (h * 11 | 0), Y + 4, 2, 1, '#C4AD76'); R_(X + (h * 7 | 0) + 5, Y + 11, 2, 1, '#EAD9A8'); }
  else if (t === 3) { R_(X, Y, T, T, '#B58E5C'); R_(X + (h * 12 | 0), Y + 5, 3, 1, '#9C7848'); R_(X + 2, Y + 12, 4, 1, '#C7A473'); }
  else if (t === 4) { R_(X, Y, T, T, y === 16 ? '#4C9BE0' : y === 18 ? '#3A82C8' : '#4390D6'); }
  else if (t === 5) { R_(X, Y, T, T, '#8E94A8'); R_(X, Y, T, 1, '#6F7488'); for (let i = 0; i < T; i += 4) R_(X + i, Y + 7, 2, 2, '#A9AEC0'); if (!isRoad(x - 1, y)) R_(X, Y, 2, T, '#E8E2CF'); if (!isRoad(x + 1, y)) R_(X + T - 2, Y, 2, T, '#E8E2CF'); }
  else if (t === 8) { R_(X, Y, T, T, '#7FBE5C'); for (let i = 2; i < T; i += 4) { R_(X, Y + i, T, 1, '#5E9E45'); if ((x + i) % 3 === 0) R_(X + (h * 13 | 0), Y + i - 1, 1, 1, '#E9D872'); } }
  else {
    R_(X, Y, T, T, '#62B05A'); if (h > .35) R_(X + (h * 53 | 0) % 14, Y + (h * 31 | 0) % 14, 2, 1, '#4E9B49'); if (h > .7) R_(X + (h * 71 | 0) % 13, Y + (h * 19 | 0) % 12, 1, 2, '#83C973');
    if (h > .93 && t === 0) { R_(X + 6, Y + 6, 2, 2, '#FFE27A'); R_(X + 5, Y + 7, 1, 1, '#FFF'); }
  }
}
function paintTree(x, y) { const X = x * T, Y = y * T; R_(X + 7, Y + 10, 3, 5, '#6B4A2E'); R_(X + 2, Y + 1, 12, 9, '#2F7D46'); R_(X + 1, Y + 3, 14, 5, '#2F7D46'); R_(X + 4, Y - 1, 8, 3, '#2F7D46'); R_(X + 4, Y + 1, 5, 3, '#49A35D'); R_(X + 3, Y + 4, 3, 2, '#49A35D'); R_(X + 10, Y + 7, 3, 2, '#256639'); }
function frame(X, Y, Wd, H) { mx.strokeStyle = '#23283F'; mx.lineWidth = 1; mx.strokeRect(X + .5, Y + 1.5, Wd - 1, H - 2); }
function pApt(X, Y, Wd, H, dc, hue, old) {
  const pal = old ? ['#CFC8B4', '#A9A18D', '#7A6548', '#8FB7D9'] : [['#EFE3CC', '#CDBB9C', '#B4533C', '#9FD0F5'], ['#E3ECF3', '#B6C6D4', '#3D6DB3', '#A8D8FF'], ['#F3E6D6', '#D6C2A6', '#3F8F63', '#A6DCF0']][hue || 0];
  R_(X + 1, Y + 3, Wd - 2, H - 3, pal[0]); R_(X + Wd - 4, Y + 3, 3, H - 3, pal[1]); R_(X, Y + 1, Wd, 3, pal[2]); R_(X + 4, Y - 1, 7, 2, pal[1]);
  for (let wy = Y + 7; wy < Y + H - 11; wy += 6) for (let wx = X + 4; wx < X + Wd - 6; wx += 6) { R_(wx, wy, 3, 3, !old && hash2(wx, wy) > .72 ? '#FFE9A6' : pal[3]); R_(wx - 1, wy + 3, 5, 1, pal[1]); }
  R_(X + 1, Y + H - 8, Wd - 2, 8, pal[1]); R_(dc - 5, Y + H - 9, 10, 9, '#3A3F55'); R_(dc - 4, Y + H - 8, 3, 8, '#9FD0F5'); R_(dc + 1, Y + H - 8, 3, 8, '#9FD0F5');
  if (old) { R_(X + 3, Y + 9, 1, 8, '#8C8573'); R_(X + Wd - 9, Y + 14, 1, 10, '#8C8573'); }
  frame(X, Y, Wd, H);
}
function pOffice(X, Y, Wd, H, dc, hue) {
  const g = [['#2F5D8C', '#6FB3E8', '#A9DBFF'], ['#3B4E7A', '#7F9FE0', '#C3D4FF'], ['#2E6E73', '#6CCFC7', '#B5F0E6'], ['#6B5B4B', '#E0A458', '#FFD9A0']][hue || 0];
  R_(X + 1, Y + 2, Wd - 2, H - 2, g[0]);
  for (let wx = X + 3; wx < X + Wd - 5; wx += 5) for (let wy = Y + 5; wy < Y + H - 10; wy += 4) R_(wx, wy, 4, 3, hash2(wx, wy) > .55 ? g[2] : g[1]);
  R_(X, Y + 1, Wd, 2, '#1E2B45'); R_(X + (Wd >> 1) - 1, Y - 3, 2, 4, '#C9CED8');
  R_(X + 1, Y + H - 9, Wd - 2, 9, '#1E2B45'); R_(dc - 5, Y + H - 8, 10, 8, g[2]); R_(dc, Y + H - 8, 1, 8, '#1E2B45'); frame(X, Y, Wd, H);
}
function pFactory(X, Y, Wd, H, dc) {
  R_(X + 1, Y + 9, Wd - 2, H - 9, '#9C9FA8'); R_(X + 1, Y + H - 4, Wd - 2, 4, '#7C7F8A');
  for (let sx = X + 1; sx < X + Wd - 20; sx += 12) { mx.fillStyle = '#6E7280'; mx.beginPath(); mx.moveTo(sx, Y + 9); mx.lineTo(sx + 12, Y + 9); mx.lineTo(sx + 12, Y + 2); mx.closePath(); mx.fill(); R_(sx + 8, Y + 5, 3, 3, '#BFE3FF'); }
  R_(X + Wd - 12, Y - 4, 6, 14, '#B5563E'); R_(X + Wd - 12, Y - 2, 6, 2, '#F2E9CF');
  R_(dc - 7, Y + H - 12, 14, 12, '#D9DCE3'); for (let i = 2; i < 12; i += 3) R_(dc - 7, Y + H - 12 + i, 14, 1, '#A7ABB6');
  for (let wx = X + 5; wx < X + Wd - 6; wx += 9) if (Math.abs(wx - dc) > 10) R_(wx, Y + 14, 5, 4, '#BFE3FF');
  mx.strokeStyle = '#23283F'; mx.strokeRect(X + .5, Y + 9.5, Wd - 1, H - 10);
}
function pLogis(X, Y, Wd, H) {
  R_(X + 1, Y + 4, Wd - 2, H - 4, '#E9ECF1'); R_(X + 1, Y + 4, Wd - 2, 6, '#F28C38'); R_(X + 1, Y + H - 3, Wd - 2, 3, '#B9BECA');
  for (let sx = X + 7; sx < X + Wd - 12; sx += 14) { R_(sx, Y + H - 15, 10, 12, '#5B6072'); R_(sx + 1, Y + H - 13, 8, 1, '#8A90A3'); R_(sx + 1, Y + H - 10, 8, 1, '#8A90A3'); R_(sx + 1, Y + H - 7, 8, 1, '#8A90A3'); }
  for (let sx = X + 8; sx < X + Wd - 8; sx += 18) R_(sx, Y + 1, 6, 3, '#B9BECA');
  for (let wx = X + 6; wx < X + Wd - 6; wx += 8) R_(wx, Y + 16, 4, 3, '#BFE3FF'); frame(X, Y + 2, Wd, H - 2);
}
function pLot(X, Y, Wd, H, dc, farm) {
  if (farm) { R_(X, Y, Wd, H, '#86C460'); for (let ry = Y + 5; ry < Y + H - 4; ry += 4) { R_(X + 3, ry, Wd - 6, 1, '#4E8F3E'); for (let rx = X + 4; rx < X + Wd - 4; rx += 5) R_(rx, ry - 1, 1, 1, '#EDDD7A'); } }
  else { R_(X, Y, Wd, H, '#BE9A66'); for (let i = 0; i < Wd * H / 60; i++) { const a = hash2(X + i, Y), b = hash2(Y, X + i * 3); R_(X + 3 + (a * (Wd - 8) | 0), Y + 4 + (b * (H - 10) | 0), 3, 1, i % 3 ? '#A98454' : '#6FAE55'); } }
  for (let fx = X; fx < X + Wd; fx += 4) { R_(fx, Y, 2, 3, '#7A5A3A'); R_(fx, Y + H - 3, 2, 3, '#7A5A3A'); }
  R_(X, Y + 1, Wd, 1, '#9B7650'); R_(X, Y + H - 2, Wd, 1, '#9B7650');
  for (let fy = Y; fy < Y + H; fy += 4) { R_(X, fy, 2, 3, '#7A5A3A'); R_(X + Wd - 2, fy, 2, 3, '#7A5A3A'); }
  R_(dc - 1, Y + H - 7, 2, 6, '#7A5A3A'); R_(dc - 7, Y + H - 15, 14, 9, '#FFF8E7'); R_(dc - 7, Y + H - 15, 14, 1, '#23283F'); R_(dc - 5, Y + H - 13, 10, 2, '#D93B3B'); R_(dc - 5, Y + H - 10, 7, 1, '#3A3F55');
}
function pBank(X, Y, Wd, H, dc) {
  R_(X + 1, Y + 10, Wd - 2, H - 10, '#E7DCC2'); mx.fillStyle = '#CDBF9E'; mx.beginPath(); mx.moveTo(X, Y + 11); mx.lineTo(X + Wd / 2, Y + 1); mx.lineTo(X + Wd, Y + 11); mx.closePath(); mx.fill();
  for (let c = X + 4; c < X + Wd - 4; c += 8) if (Math.abs(c + 1 - dc) > 5) R_(c, Y + 13, 3, H - 17, '#F8F1E0');
  R_(X, Y + H - 4, Wd, 4, '#BFB08C'); R_(dc - 4, Y + H - 14, 8, 10, '#4A3B2A'); R_(dc - 3, Y + 4, 6, 6, '#FFCF3F'); R_(dc - 1, Y + 5, 2, 4, '#8A6A12'); R_(dc - 2, Y + 6, 4, 1, '#8A6A12');
}
function pHall(X, Y, Wd, H, dc) {
  R_(X + 1, Y + 16, Wd - 2, H - 16, '#DDD6C8'); mx.fillStyle = '#5AA7A0'; mx.beginPath(); mx.arc(X + Wd / 2, Y + 16, 11, Math.PI, 0); mx.fill(); R_(X + Wd / 2 - 13, Y + 15, 26, 2, '#3F7F7A');
  R_(X + Wd / 2 - 1, Y - 3, 1, 9, '#C9CED8'); R_(X + Wd / 2, Y - 3, 6, 4, '#E5484D');
  for (let wx = X + 5; wx < X + Wd - 6; wx += 8) if (Math.abs(wx + 2 - dc) > 7) { R_(wx, Y + 22, 4, 6, '#9FD0F5'); R_(wx, Y + 36, 4, 6, '#9FD0F5'); }
  R_(X + 4, Y + H - 3, Wd - 8, 3, '#B9B2A2'); R_(dc - 5, Y + H - 15, 10, 12, '#5B4A36'); R_(dc - 7, Y + H - 17, 14, 2, '#B9B2A2'); mx.strokeStyle = '#23283F'; mx.strokeRect(X + .5, Y + 16.5, Wd - 1, H - 17);
}
function pPF(X, Y, Wd, H, dc) {
  R_(X + 2, Y + 2, Wd - 4, H - 2, '#1C2340'); for (let wy = Y + 6, i = 0; wy < Y + H - 12; wy += 4, i++) R_(X + 5, wy, Wd - 10, 2, i % 3 === 0 ? '#5468B5' : '#2E3A6B');
  R_(X + 2, Y + 1, Wd - 4, 3, '#FFCF3F'); R_(X + 2, Y + H - 24, Wd - 4, 3, '#FFCF3F'); R_(dc - 6, Y + H - 10, 12, 10, '#FFE9A6'); R_(dc, Y + H - 10, 1, 10, '#1C2340'); R_(dc - 9, Y + H - 12, 18, 2, '#FFCF3F'); frame(X + 1, Y, Wd - 2, H);
}
function pShop(X, Y, Wd, H, dc) {
  R_(X + 2, Y + 13, Wd - 4, H - 13, '#F3E7CF'); R_(X, Y + 7, Wd, 7, '#B5563E'); R_(X + 3, Y + 4, Wd - 6, 3, '#9A4532');
  R_(X + 6, Y + 16, Wd - 12, 8, '#FFCF3F'); R_(X + 9, Y + 18, Wd - 18, 2, '#D93B3B'); R_(X + 9, Y + 21, Wd - 24, 1, '#3A3F55');
  for (let sx = X + 2, i = 0; sx < X + Wd - 2; sx += 4, i++) R_(sx, Y + 26, 4, 4, i % 2 ? '#FFF8E7' : '#D93B3B');
  R_(dc - 4, Y + H - 14, 8, 14, '#6B4A2E'); R_(dc + 2, Y + H - 8, 1, 2, '#FFCF3F'); R_(X + 6, Y + H - 13, 9, 8, '#A8D8FF'); R_(X + Wd - 15, Y + H - 13, 9, 8, '#A8D8FF'); mx.strokeStyle = '#23283F'; mx.strokeRect(X + 2.5, Y + 13.5, Wd - 5, H - 14);
}
function pStation(X, Y, Wd, H) {
  R_(X, Y, Wd, H, '#BE9A66'); R_(X + 8, Y + 18, Wd - 16, H - 22, '#A7ABB6'); R_(X + 8, Y + 18, Wd - 16, 2, '#8A8FA3');
  for (let sx = X + 6; sx < X + Wd - 4; sx += 8) R_(sx, Y + 5, 1, H - 9, '#F28C38'); for (let sy = Y + 6; sy < Y + H - 6; sy += 8) R_(X + 4, sy, Wd - 8, 1, '#F28C38');
  for (let sx = X, i = 0; sx < X + Wd; sx += 4, i++) R_(sx, Y + H - 4, 4, 3, i % 2 ? '#23283F' : '#FFCF3F');
  R_(X + 4, Y + H - 10, 3, 5, '#F2682E'); R_(X + Wd - 8, Y + H - 10, 3, 5, '#F2682E');
}
function paintBuilding(b, as) {
  const X = b.bx * T, Y = b.by * T, Wd = b.w * T, H = b.h * T, dc = X + Math.floor(b.w / 2) * T + 8, s = as || b.style;
  if (s === 'apt') pApt(X, Y, Wd, H, dc, b.hue); else if (s === 'oldapt') pApt(X, Y, Wd, H, dc, 0, true);
  else if (s === 'office') pOffice(X, Y, Wd, H, dc, b.hue); else if (s === 'kic') pOffice(X, Y, Wd, H, dc, 3);
  else if (s === 'factory') pFactory(X, Y, Wd, H, dc); else if (s === 'logis') pLogis(X, Y, Wd, H);
  else if (s === 'lot') pLot(X, Y, Wd, H, dc); else if (s === 'farm') pLot(X, Y, Wd, H, dc, true);
  else if (s === 'bank') pBank(X, Y, Wd, H, dc); else if (s === 'hall') pHall(X, Y, Wd, H, dc);
  else if (s === 'pf') pPF(X, Y, Wd, H, dc); else if (s === 'shop') pShop(X, Y, Wd, H, dc); else pStation(X, Y, Wd, H);
}
function paintMap() {
  if (!mapCv) { mapCv = document.createElement('canvas'); mapCv.width = MW * T; mapCv.height = MH * T; mx = mapCv.getContext('2d'); }
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) paintTile(x, y);
  for (const y of [8, 24]) for (let x = 0; x < MW; x++) if (!isRoad(x, y - 1) && !isRoad(x, y + 2)) R_(x * T + 4, y * T + T - 1, 8, 2, '#E8D36A');
  for (const x of [6, 16, 26, 36, 44]) for (let y = 2; y <= 31; y++) if (isRoad(x, y) && grid[y][x] === 1 && !isRoad(x - 1, y) && !isRoad(x + 2, y)) R_(x * T + T - 1, y * T + 4, 2, 8, '#E8D36A');
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (grid[y][x] === 7) paintTree(x, y);
  for (const b of BLD) paintBuilding(b);
  const kx = 24 * T, ky = 10 * T; R_(kx + 1, ky + 5, 14, 10, '#F3E7CF'); R_(kx, ky + 1, 16, 5, '#D93B3B'); R_(kx + 2, ky + 8, 12, 4, '#FFF8E7'); R_(kx + 3, ky + 9, 6, 1, '#3A3F55'); R_(kx + 3, ky + 11, 9, 1, '#8A8FA3');
}
function paintGone(id) { const b = BLD.find(x => x.id === id); if (!b || !mx) return; const s = S.gone[id]; R_(b.bx * T, b.by * T, b.w * T, b.h * T, '#62B05A'); paintBuilding(Object.assign({}, b, { hue: 1 }), s === 'logis' ? 'logis' : s); }
function resetWorldView() {
  paintMap(); if (S) { for (const id in S.gone) paintGone(id); pl.x = pl.tx = S.p.x; pl.y = pl.ty = S.p.y; pl.px = pl.x * T; pl.py = pl.y * T; }
  pl.moving = false; pl.path = []; pl.goal = null; promptId = null;
}
function drawChar(c, x, y, look, dir, f) {
  const L = { me: ['#2B3A67', '#F2C9A0', '#3A2A1E', '#E5484D'], kim: ['#C2548B', '#F2C9A0', '#6B3FA0', '#FFCF3F'], boy: ['#3F8F63', '#F2C9A0', '#8A5A2B', '#F2E9CF'] }[look];
  const r = (a, b, w, h, col) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
  c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(x + 3, y + 14, 10, 2);
  if (f) { r(5, 12, 2, 3, '#1B1F33'); r(9, 11, 2, 3, '#1B1F33'); } else { r(5, 11, 2, 4, '#1B1F33'); r(9, 11, 2, 4, '#1B1F33'); }
  r(4, 6, 8, 6, L[0]); r(3, 7, 1, 4, L[0]); r(12, 7, 1, 4, L[0]); r(4, 0, 8, 7, L[1]);
  if (look === 'kim') { r(3, -2, 10, 4, L[2]); r(3, 2, 1, 3, L[2]); r(12, 2, 1, 3, L[2]); r(6, 8, 4, 1, L[3]); }
  else if (look === 'boy') { r(4, -1, 8, 3, L[2]); r(3, 1, 11, 1, L[2]); r(11, 8, 4, 3, L[3]); }
  else { r(4, -1, 8, 3, L[2]); if (dir === 3) r(4, 0, 8, 6, L[2]); }
  if (dir === 0) { r(6, 3, 1, 2, '#1B1F33'); r(9, 3, 1, 2, '#1B1F33'); if (look === 'me') r(7, 6, 2, 4, L[3]); }
  else if (dir === 1) r(5, 3, 1, 2, '#1B1F33'); else if (dir === 2) r(10, 3, 1, 2, '#1B1F33');
  if (look === 'me' && dir !== 3) r(dir === 1 ? 1 : 12, 9, 3, 3, '#8A5A2B');
}

/* ----- 이동과 상호작용 ----- */
function bfs(sx, sy, targets) {
  const key = (x, y) => y * MW + x, goal = new Set(targets.map(t => key(t[0], t[1]))), prev = new Map([[key(sx, sy), -1]]), q = [[sx, sy]];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    if (goal.has(key(x, y))) { const path = []; let k = key(x, y); while (prev.get(k) !== -1) { path.unshift([k % MW, Math.floor(k / MW)]); k = prev.get(k); } return path; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, nk = key(nx, ny); if (walkable(nx, ny) && !prev.has(nk)) { prev.set(nk, key(x, y)); q.push([nx, ny]); } }
  }
  return null;
}
function goTo(targets, goal) { const s = pl.moving ? [pl.tx, pl.ty] : [pl.x, pl.y], p = bfs(s[0], s[1], targets); if (p) { pl.path = p; pl.goal = goal || null; } else toast('그곳으로는 갈 수 없습니다', ''); }
function guideTo(id) { const b = BLD.find(x => x.id === id); if (!b || !running || popup) return; closeView(); goTo([[b.bx + Math.floor(b.w / 2), b.by + b.h]], b); }
function nearEntity() {
  for (const b of BLD) if (pl.y === b.by + b.h && pl.x >= b.bx && pl.x < b.bx + b.w) return b;
  for (const n of NPCS) if (Math.abs(n.x - pl.x) + Math.abs(n.y - pl.y) === 1) return n;
  return null;
}
function interact(e) { if (!e || popup || !running || paused) return; if (e.prop) openView({ t: 'prop', id: e.id }); else openView({ t: e.id }); }
function tryInteract() { const e = nearEntity(); if (e) interact(e); }
function togglePause() { if (!running) return; paused = !paused; $('pauseOv').hidden = !paused; $('btnPause').textContent = paused ? '계속하기' : '일시정지'; }
function movePlayer(dt) {
  const sp = 104 * dt;
  if (!pl.moving) {
    let d = null;
    if (!view) { if (keys.up) d = [0, -1, 3]; else if (keys.down) d = [0, 1, 0]; else if (keys.left) d = [-1, 0, 1]; else if (keys.right) d = [1, 0, 2]; }
    if (d) { pl.path = []; pl.goal = null; pl.dir = d[2]; if (walkable(pl.x + d[0], pl.y + d[1])) { pl.tx = pl.x + d[0]; pl.ty = pl.y + d[1]; pl.moving = true; } }
    else if (pl.path.length) { const n = pl.path.shift(); pl.dir = n[0] > pl.x ? 2 : n[0] < pl.x ? 1 : n[1] > pl.y ? 0 : 3; pl.tx = n[0]; pl.ty = n[1]; pl.moving = true; }
    else if (pl.goal) { const g = pl.goal; pl.goal = null; pl.dir = g.prop || g.bx != null ? 3 : (g.x > pl.x ? 2 : g.x < pl.x ? 1 : g.y > pl.y ? 0 : 3); interact(g); }
  }
  if (pl.moving) {
    const gx = pl.tx * T, gy = pl.ty * T, dx = gx - pl.px, dy = gy - pl.py;
    if (Math.abs(dx) + Math.abs(dy) <= sp) { pl.px = gx; pl.py = gy; pl.x = pl.tx; pl.y = pl.ty; pl.moving = false; if (S) { S.p.x = pl.x; S.p.y = pl.y; } }
    else { pl.px += Math.sign(dx) * sp; pl.py += Math.sign(dy) * sp; }
    pl.anim += dt;
  }
}
function updatePrompt() {
  const e = (running && !view && !popup && !paused && !pl.moving) ? nearEntity() : null, id = e ? e.id + (e.prop ? '' : '_f') : null;
  if (id === promptId) return; promptId = id; const b = $('prompt');
  if (!e) { b.hidden = true; return; }
  b.innerHTML = `<kbd>Space</kbd> ${esc(e.name)} ${e.prop ? '살펴보기' : e.look ? '에게 말 걸기' : '들어가기'}`; b.hidden = false;
}

/* ----- 그리기 ----- */
function resize() {
  const r = $('stage').getBoundingClientRect(); if (r.width < 10 || r.height < 10) return;
  dpr = Math.min(2, window.devicePixelRatio || 1); vw = r.width; vh = r.height; scale = clamp(Math.round(vw / 330), 2, 4);
  cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
}
function draw(t) {
  const s = scale * dpr, viewW = vw / scale, viewH = vh / scale, maxX = MW * T - viewW, maxY = MH * T - viewH;
  camX = maxX < 0 ? maxX / 2 : clamp(pl.px + 8 - viewW / 2, 0, maxX); camY = maxY < 0 ? maxY / 2 : clamp(pl.py + 8 - viewH / 2, 0, maxY);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#16203F'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.imageSmoothingEnabled = false; ctx.setTransform(s, 0, 0, s, -Math.round(camX * s), -Math.round(camY * s));
  ctx.drawImage(mapCv, 0, 0);
  const ph = Math.floor(t / 450);
  ctx.fillStyle = 'rgba(255,255,255,.38)'; for (let i = 0; i < 70; i++) ctx.fillRect((i * 97 + ph * 5) % (MW * T), 16 * T + 2 + (i * 53) % (3 * T - 5), 3 + i % 3, 1);
  const sm = (t / 900) % 1; ctx.fillStyle = 'rgba(240,240,245,.55)'; for (let i = 0; i < 3; i++) { const k = (sm + i / 3) % 1; ctx.fillRect(42 * T - 10 + k * 6, 21 * T - 6 - k * 14, 3 + k * 3, 3 + k * 3); }
  if (S) for (const b of BLD) {
    if (!b.prop) continue; const X = b.bx * T, Y = b.by * T, Wd = b.w * T, H = b.h * T, o = S.own[b.id];
    if (o && o.dev) {
      const pr = S.projects.find(p => p.id === b.id), k = pr ? (pr.el + (S.tq / MODES[S.mode].ql)) / pr.dur : 0, bh = Math.round((H - 10) * clamp(k, 0, 1));
      ctx.fillStyle = '#A7ABB6'; ctx.fillRect(X + 8, Y + H - 4 - bh, Wd - 22, bh); ctx.fillStyle = 'rgba(242,140,56,.8)';
      for (let sx = X + 8; sx < X + Wd - 13; sx += 6) ctx.fillRect(sx, Y + H - 4 - bh, 1, bh); for (let sy = Y + H - 6; sy > Y + H - 4 - bh; sy -= 6) ctx.fillRect(X + 8, sy, Wd - 22, 1);
      ctx.fillStyle = '#FFCF3F'; ctx.fillRect(X + Wd - 9, Y - 12, 2, H + 8); ctx.fillRect(X + 6, Y - 10, Wd - 10, 2); ctx.fillStyle = '#23283F'; ctx.fillRect(X + 12 + (ph % 6), Y - 8, 1, 8);
    }
    if (o) { ctx.fillStyle = '#23283F'; ctx.fillRect(X + 3, Y - 9, 1, 12); ctx.fillStyle = '#FFCF3F'; ctx.fillRect(X + 4, Y - 9, 6 - (ph % 2), 4); }
  }
  const ch = NPCS.map(n => ({ y: n.y * T, f: () => drawChar(ctx, n.x * T, n.y * T - 2, n.look, 0, ph % 4 === 0 ? 1 : 0) }));
  ch.push({ y: pl.py, f: () => drawChar(ctx, Math.round(pl.px), Math.round(pl.py) - 2, 'me', pl.dir, pl.moving ? Math.floor(pl.anim * 9) % 2 : 0) });
  ch.sort((a, b) => a.y - b.y).forEach(c => c.f());
  if (pl.path.length) { const g = pl.path[pl.path.length - 1]; ctx.strokeStyle = 'rgba(255,207,63,.9)'; ctx.lineWidth = 1; ctx.strokeRect(g[0] * T + 2.5, g[1] * T + 2.5, T - 5, T - 5); }

  /* 간판 */
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const fs = scale >= 3 ? 12 : 10.5; ctx.font = `600 ${fs}px "IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  for (const b of BLD) {
    const sx = (b.bx * T + b.w * T / 2 - camX) * scale, sy = (b.by * T - camY) * scale - 9; if (sx < -80 || sx > vw + 80 || sy < -20 || sy > vh + 10) continue;
    const o = S && S.own[b.id], gone = S && S.gone[b.id]; let ar = '', ac = '';
    if (S && W && b.prop && !gone && S.q > 0) { const c = price(b.id) / price(b.id, S.q - 1) - 1; if (c > .004) { ar = ' ▲'; ac = '#FF6B70'; } else if (c < -.004) { ar = ' ▼'; ac = '#6AB0FF'; } }
    const tw = ctx.measureText(b.name).width, aw = ar ? ctx.measureText(ar).width : 0, w = tw + aw + 12, x0 = clamp(sx - w / 2, 2, vw - w - 2), y0 = Math.max(sy, 10);
    ctx.fillStyle = o ? 'rgba(74,56,6,.92)' : b.prop ? 'rgba(14,19,38,.84)' : 'rgba(46,26,26,.88)'; ctx.fillRect(x0, y0 - 9, w, 18);
    ctx.strokeStyle = o ? '#FFCF3F' : b.prop ? 'rgba(242,233,207,.35)' : 'rgba(255,207,63,.55)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + .5, y0 - 8.5, w - 1, 17);
    ctx.fillStyle = o ? '#FFE9A6' : '#F4EFE0'; ctx.fillText(b.name, x0 + 6, y0 + .5); if (ar) { ctx.fillStyle = ac; ctx.fillText(ar, x0 + 6 + tw, y0 + .5); }
  }
}
function loop(t) {
  const dt = Math.min(.1, (t - lastT) / 1000 || 0); lastT = t;
  if (running && !paused && S && !S.over) {
    if (popup) { if (popup.total) { popup.left -= dt; const f = $('cdfill'); if (f) f.style.width = Math.max(0, popup.left / popup.total * 100) + '%'; if (popup.left <= 0) choose(popup.choices.length - 1); } }
    else { S.tq += dt; if (S.tq >= MODES[S.mode].ql) advanceQuarter(); if (running) movePlayer(dt); }
    if (S && running) $('qfill').style.width = Math.min(100, S.tq / MODES[S.mode].ql * 100) + '%';
  }
  updatePrompt(); draw(t); requestAnimationFrame(loop);
}

/* ----- 입력과 부팅 ----- */
const KM = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
function bindInput() {
  window.addEventListener('keydown', e => {
    if (e.target && e.target.matches && e.target.matches('input,textarea,select')) return;
    if (!running) return;
    if (popup) { if (/^Digit[1-9]$/.test(e.code)) choose(+e.code.slice(5) - 1); else if ((e.code === 'Enter' || e.code === 'Space') && popup.choices.length === 1) { e.preventDefault(); choose(0); } else if (e.code === 'Space') e.preventDefault(); return; }
    if (e.code === 'Escape') { if (view) closeView(); $('side').classList.remove('open'); return; }
    if (e.code === 'KeyP') { togglePause(); return; }
    if (paused) return;
    if (KM[e.code]) { if (!view) { keys[KM[e.code]] = true; e.preventDefault(); } return; }
    if (e.code === 'Space' || e.code === 'KeyE') { e.preventDefault(); if (!view) tryInteract(); }
  });
  window.addEventListener('keyup', e => { if (KM[e.code]) keys[KM[e.code]] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  cv.addEventListener('pointerdown', e => {
    if (!running || popup || paused) return; if (view) { closeView(); return; }
    const r = cv.getBoundingClientRect(), tx = Math.floor((camX + (e.clientX - r.left) / scale) / T), ty = Math.floor((camY + (e.clientY - r.top) / scale) / T);
    const b = BLD.find(b => tx >= b.bx && tx < b.bx + b.w && ty >= b.by && ty < b.by + b.h), n = NPCS.find(n => (n.x === tx && n.y === ty) || (n.id === 'paper' && tx === 24 && ty === 10));
    if (b) goTo([[clamp(tx, b.bx, b.bx + b.w - 1), b.by + b.h]], b);
    else if (n) goTo([[n.x + 1, n.y], [n.x - 1, n.y], [n.x, n.y + 1], [n.x, n.y - 1]].filter(p => walkable(p[0], p[1])), n);
    else if (walkable(tx, ty)) goTo([[tx, ty]], null);
  });
  document.addEventListener('click', e => { const b = e.target.closest('button'); if (b && e.detail > 0) b.blur(); });
  $('fStart').addEventListener('submit', e => { e.preventDefault(); startGame(readTitle()); });
  if (window.ResizeObserver) new ResizeObserver(resize).observe($('stage')); window.addEventListener('resize', resize);
}
function boot(data) {
  cv = $('cv'); ctx = cv.getContext('2d'); buildGrid(); paintMap(); resize(); bindInput();
  const saved = data && data.S;
  if (saved && saved.v === 2 && !saved.over) { S = saved; W = genWorld(S.seed, S.init); $('title').hidden = true; resetWorldView(); running = true; refreshAll(); }
  else showTitle();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { promptId = null; });
  requestAnimationFrame(loop);
}
const HOT = window.claude && window.claude.hot;
if (HOT && HOT.snapshot) HOT.snapshot(() => ({ S: S && !S.over ? S : null }));
if (HOT && HOT.ready) HOT.ready(boot); else boot((HOT && HOT.data) || {});
