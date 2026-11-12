/* Persimmon: a snake game on a small floating garden, drawn on one 2D canvas. */
(() => {
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const easeOutBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- projection ----------
   Axonometric: the board is turned YAW and seen from PITCH above the horizon.
   It is orthographic, so a sphere of radius r is always a circle of r * S pixels,
   and "up" on the keyboard still reads as up on screen. */
const YAW = 20 * Math.PI / 180, PITCH = 50 * Math.PI / 180;
const AX = Math.cos(YAW), AY = Math.sin(YAW) * Math.sin(PITCH);
const BX = -Math.sin(YAW), BY = Math.cos(YAW) * Math.sin(PITCH);
const ZC = Math.cos(PITCH);
const CAM = [Math.sin(YAW) * ZC, Math.cos(YAW) * ZC, Math.sin(PITCH)];
const DEPX = Math.sin(YAW), DEPY = Math.cos(YAW);

const PORTRAIT = innerHeight > innerWidth * 1.1;
const COLS = PORTRAIT ? 9 : 15, ROWS = PORTRAIT ? 13 : 11;
const HC = COLS / 2, HR = ROWS / 2, NT = COLS * ROWS;

const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d', { alpha: false });
const V = { W: 0, H: 0, dpr: 1, baseS: 40, S: 40, ox: 0, oy: 0 };

const px = (x, y) => V.ox + ((x - HC) * AX + (y - HR) * BX) * V.S;
const py = (x, y, z) => V.oy + ((x - HC) * AY + (y - HR) * BY - z * ZC) * V.S;
const inBoard = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;

function screenT() {
  ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
}
// Maps board coordinates straight onto the tile plane, so circles drawn in
// world units come out as correctly skewed ellipses lying on the ground.
function groundT(z) {
  const d = V.dpr, s = V.S;
  ctx.setTransform(d * AX * s, d * AY * s, d * BX * s, d * BY * s,
    d * (V.ox - (HC * AX + HR * BX) * s),
    d * (V.oy - (HC * AY + HR * BY + z * ZC) * s));
}

function resize() {
  V.dpr = Math.min(2, window.devicePixelRatio || 1);
  V.W = innerWidth;
  V.H = innerHeight;
  canvas.width = Math.round(V.W * V.dpr);
  canvas.height = Math.round(V.H * V.dpr);
  const wExt = COLS * AX - ROWS * BX, hExt = COLS * AY + ROWS * BY + 2.6;
  V.baseS = Math.min(V.W * 0.92 / wExt, V.H * 0.78 / hExt);
}

/* ---------- the four lights ---------- */
const PAL_SRC = [
  { // morning
    skyTop: '#f8ecdc', skyBot: '#f1cfb5', sun: '#fffaf0', cloud: '#fffaf2',
    tileA: '#c9d4a6', tileB: '#bac896', tileHi: '#f4f6d6', grout: '#93a678',
    turfF: '#9aad7b', turfR: '#84986a', soilF: '#bd8a6b', soilR: '#a27358',
    midF: '#9c6a56', midR: '#845848', deepF: '#7a4f47', deepR: '#673f3b',
    creamShade: '#c7b594', cream: '#f7efdc', creamHi: '#fffdf6',
    bandShade: '#1a2138', band: '#2d3958', bandHi: '#4a587c', eye: '#1c2134',
    fruitShade: '#c45c14', fruit: '#f28c1f', fruitHi: '#ffc063', leaf: '#5d7c3a',
    plumShade: '#473060', plum: '#6c4b8f', plumHi: '#aa8dd1',
    shadow: '#3c4a34', ink: '#3d302a',
    shadowA: 0.24, cloudA: 0.75, dusk: 0, night: 0,
  },
  { // noon
    skyTop: '#bfe2e8', skyBot: '#eaf4e2', sun: '#fffef4', cloud: '#ffffff',
    tileA: '#aad290', tileB: '#9bc582', tileHi: '#ecf8cc', grout: '#71a064',
    turfF: '#7dab69', turfR: '#67955c', soilF: '#c49264', soilR: '#a67751',
    midF: '#a2714f', midR: '#885d42', deepF: '#825640', deepR: '#6b4535',
    creamShade: '#c9bd9f', cream: '#fcf6e8', creamHi: '#ffffff',
    bandShade: '#182039', band: '#2a3a5e', bandHi: '#485c86', eye: '#1c2134',
    fruitShade: '#c95f12', fruit: '#f58f1d', fruitHi: '#ffc76a', leaf: '#557f38',
    plumShade: '#473060', plum: '#6c4b8f', plumHi: '#aa8dd1',
    shadow: '#2f4a36', ink: '#234443',
    shadowA: 0.27, cloudA: 0.85, dusk: 0, night: 0,
  },
  { // dusk
    skyTop: '#8b5a86', skyBot: '#f6a86c', sun: '#ffd89a', cloud: '#f9bfa0',
    tileA: '#bcad7b', tileB: '#ae9f6f', tileHi: '#fbe6ad', grout: '#7f7652',
    turfF: '#93885a', turfR: '#756b4b', soilF: '#ab6851', soilR: '#874f44',
    midF: '#864a4a', midR: '#6b3a40', deepF: '#623645', deepR: '#4c2a3a',
    creamShade: '#c99f85', cream: '#fbe3c4', creamHi: '#fff6e2',
    bandShade: '#231a35', band: '#3c2e52', bandHi: '#5d4a76', eye: '#201830',
    fruitShade: '#b84a12', fruit: '#f07f1c', fruitHi: '#ffb85a', leaf: '#5a6e30',
    plumShade: '#402a55', plum: '#65457f', plumHi: '#a384c2',
    shadow: '#4a2444', ink: '#fff2e2',
    shadowA: 0.3, cloudA: 0.42, dusk: 1, night: 0,
  },
  { // night
    skyTop: '#0e1530', skyBot: '#27335f', sun: '#ffd89a', cloud: '#34416f',
    tileA: '#3d667a', tileB: '#365c70', tileHi: '#a5dcdc', grout: '#203d4f',
    turfF: '#2c4d63', turfR: '#223f55', soilF: '#3d3759', soilR: '#302b49',
    midF: '#2e2a48', midR: '#25213c', deepF: '#231f3b', deepR: '#1b1831',
    creamShade: '#8fa0bf', cream: '#dfe8f6', creamHi: '#ffffff',
    bandShade: '#0d1228', band: '#1b2447', bandHi: '#34427a', eye: '#0c1022',
    fruitShade: '#c0531a', fruit: '#ff9838', fruitHi: '#ffd08a', leaf: '#4c7a52',
    plumShade: '#3a2a66', plum: '#6a56a8', plumHi: '#b3a4ee',
    shadow: '#060b1e', ink: '#e7edfb',
    shadowA: 0.4, cloudA: 0.5, dusk: 0, night: 1,
  },
];
const PHASES = ['morning', 'noon', 'dusk', 'night'];
const WHEN = ['in the morning', 'at noon', 'at dusk', 'at night'];
const SUN_U = [[0.2, 0.5], [0.5, 0.83], [0.83, 1.28], [-0.28, 0.2]];
const MOON_U = [[1.28, 1.28], [-0.28, -0.28], [-0.28, 0.34], [0.34, 1.28]];
const TONGUE = '#e2573f', STEM = '#6b4a2e', MOON = '#e9edf7', CRATER = '#d3d9ea';
const SERIF = '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif';

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const css = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const PALS = PAL_SRC.map((p) => {
  const o = {};
  for (const k in p) o[k] = typeof p[k] === 'string' ? hex(p[k]) : p[k];
  return o;
});
const pal = {}, col = {};
const STRATA_KEYS = { F: ['turfF', 'soilF', 'midF', 'deepF'], R: ['turfR', 'soilR', 'midR', 'deepR'] };
const STRATA = { F: [[], [], [], []], R: [[], [], [], []] };
const TONES = [0.94, 1, 1.055];
let palAt = -1;

function updatePalette() {
  if (G.dayT === palAt) return;
  palAt = G.dayT;
  const i = Math.floor(G.dayT), f = smooth(G.dayT - i);
  const a = PALS[i % 4], b = PALS[(i + 1) % 4];
  for (const k in a) {
    if (typeof a[k] === 'number') { pal[k] = lerp(a[k], b[k], f); continue; }
    const m = pal[k] || (pal[k] = [0, 0, 0]);
    m[0] = lerp(a[k][0], b[k][0], f);
    m[1] = lerp(a[k][1], b[k][1], f);
    m[2] = lerp(a[k][2], b[k][2], f);
    col[k] = css(m);
  }
  for (const side in STRATA_KEYS) {
    STRATA_KEYS[side].forEach((key, l) => {
      const c = pal[key];
      TONES.forEach((t, v) => { STRATA[side][l][v] = css([Math.min(255, c[0] * t), Math.min(255, c[1] * t), Math.min(255, c[2] * t)]); });
    });
  }
  document.documentElement.style.setProperty('--ink', col.ink);
}

/* ---------- the island ---------- */
const DEPTH = new Float32Array(NT), TONE = new Float32Array(NT), DELAY = new Float32Array(NT);
const VARIANT = new Uint8Array(NT), FRONT = new Uint8Array(NT), RIGHT = new Uint8Array(NT);
const TH = new Float32Array(NT), IO = new Float32Array(NT), IA = new Float32Array(NT);
const GLOW = new Float32Array(NT), PRESS = new Float32Array(NT);
const occ = new Uint8Array(NT), occ2 = new Uint8Array(NT);
const LAYERS = [0, 0.3, 1.1, 1.95, 99];
const INTRO_LEN = 1.5;
{
  const r = seeded(11);
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    const k = j * COLS + i;
    const u = (i + 0.5 - HC) / HC, v = (j + 0.5 - HR) / HR;
    const q = Math.min(1, Math.hypot(u, v) / 1.25);
    DEPTH[k] = Math.round((0.6 + 2.3 * Math.pow(1 - q, 1.25) + r() * 0.6) * 4) / 4;
    VARIANT[k] = (r() * 3) | 0;
    TONE[k] = 0.972 + r() * 0.056;
    DELAY[k] = Math.hypot(i + 0.5 - HC, j + 0.5 - HR) * 0.052 + r() * 0.07;
  }
  // A column's face only needs drawing where it hangs lower than its neighbour in front.
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    const k = j * COLS + i;
    FRONT[k] = j === ROWS - 1 || DEPTH[k] > DEPTH[k + COLS] ? 1 : 0;
    RIGHT[k] = i === COLS - 1 || DEPTH[k] > DEPTH[k + 1] ? 1 : 0;
  }
}

/* ---------- state ---------- */
const DIRS = { U: { x: 0, y: -1 }, R: { x: 1, y: 0 }, D: { x: 0, y: 1 }, L: { x: -1, y: 0 } };
const DIR_LIST = [DIRS.U, DIRS.R, DIRS.D, DIRS.L];
const KEYS = {
  ArrowUp: DIRS.U, ArrowRight: DIRS.R, ArrowDown: DIRS.D, ArrowLeft: DIRS.L,
  KeyW: DIRS.U, KeyD: DIRS.R, KeyS: DIRS.D, KeyA: DIRS.L,
};
const CAMERA = { title: [0.84, 0.06], playing: [1, 0.02], paused: [1, 0.02], dying: [0.95, 0.025], over: [0.86, 0.06] };
const TOUCH = matchMedia('(pointer: coarse)').matches;
const PROMPTS = TOUCH
  ? { title: 'tap to begin', over: 'tap to go again', paused: 'tap to resume' }
  : { title: 'press space to begin', over: 'space to go again', paused: 'space to resume' };
const QUERY = new URLSearchParams(location.search);
const ATTRACT_TICK = 0.135;

const G = {
  state: 'title', time: 0, timers: [],
  snake: [], prevTail: { x: 0, y: 0 }, dir: DIRS.R, queue: [], acc: 0, tickDur: ATTRACT_TICK, holdUntil: 0, auto: true,
  score: 0, eaten: 0, best: 0,
  fruit: null, plum: null, ghosts: [],
  bulges: [], ripples: [], parts: [], pops: [], rings: [],
  mode: null, dieT: 0, doneAt: 0, overT: 0, lunge: 0,
  visLen: Infinity, popNext: 0, popRate: 0, popCount: 0, popSound: 0, snakeGone: false,
  spawnT0: 0, headAng: 0, blinkAt: 3, tongueAt: 2.5,
  dayT: 0, dayTarget: 0, zoom: 0.78, zoomTo: 0.84, lift: 0.06, liftTo: 0.06, shake: 0, introT0: 0.2,
};
try { G.best = +localStorage.getItem('persimmon.best') || 0; } catch (e) {}

const el = {};
for (const id of ['score', 'pips', 'phase', 'prompt', 'overTitle', 'overScore', 'overDay', 'overBest', 'best', 'bestWrap', 'mute', 'plane']) {
  el[id] = document.getElementById(id);
}

const live = () => G.state !== 'title';
function after(delay, fn) {
  G.timers.push({ at: G.time + delay, fn });
}
function setState(s) {
  G.state = s;
  document.body.dataset.state = s;
  [G.zoomTo, G.liftTo] = CAMERA[s];
  if (PROMPTS[s]) el.prompt.textContent = PROMPTS[s];
}

/* ---------- rules ---------- */
function freeCell() {
  occ2.fill(0);
  for (const c of G.snake) if (inBoard(c.x, c.y)) occ2[c.y * COLS + c.x] = 1;
  if (G.fruit) occ2[G.fruit.y * COLS + G.fruit.x] = 1;
  if (G.plum) occ2[G.plum.y * COLS + G.plum.x] = 1;
  const h = G.snake[0];
  for (let s = 1; s <= 2; s++) {
    const x = h.x + G.dir.x * s, y = h.y + G.dir.y * s;
    if (inBoard(x, y)) occ2[y * COLS + x] = 1;
  }
  const free = [];
  for (let k = 0; k < NT; k++) if (!occ2[k]) free.push(k);
  if (!free.length) return null;
  const k = free[(Math.random() * free.length) | 0];
  return { x: k % COLS, y: (k / COLS) | 0, born: 0, dies: Infinity, seed: rand(TAU) };
}

function announce(c, slot) {
  after(c.born - G.time, () => {
    if (G[slot] !== c) return;
    G.rings.push({ x: c.x + 0.5, y: c.y + 0.5, t0: G.time, life: 0.6, r: 0.8 });
    if (live()) Snd.plip();
  });
}

function spawnFruit(born) {
  const c = freeCell();
  if (!c) return null;
  c.born = born;
  G.fruit = c;
  announce(c, 'fruit');
  return c;
}

function resetRound(delay) {
  const len = 4, y = ROWS >> 1, hx = Math.min(COLS - 4, len + 1);
  G.snake = [];
  for (let i = 0; i < len; i++) G.snake.push({ x: hx - i, y });
  G.prevTail = { x: hx - len, y };
  G.dir = DIRS.R;
  G.queue.length = 0;
  G.acc = 0;
  G.score = 0;
  G.eaten = 0;
  G.mode = null;
  G.doneAt = 0;
  G.lunge = 0;
  G.visLen = Infinity;
  G.snakeGone = false;
  G.bulges.length = 0;
  G.ghosts.length = 0;
  G.fruit = null;
  G.plum = null;
  G.spawnT0 = G.time + delay;
  G.holdUntil = G.time + delay + 0.55;
  G.headAng = 0;
  spawnFruit(G.time + delay + 0.3);
}

function startGame() {
  setState('playing');
  G.auto = QUERY.has('auto');
  G.timers.length = 0;
  resetRound(0.05);
  G.tickDur = speedFor(0);
  G.dayTarget = Math.ceil(G.dayT / 4 - 1e-6) * 4;
  G.ripples.push({ x: G.snake[0].x + 0.5, y: G.snake[0].y + 0.5, t0: G.time, amp: 0.26, speed: 9, width: 1.2, life: 1.8, glow: 2 });
  Snd.phase(0, false);
  Snd.start();
  showScore(false);
  showPhase(false);
}

const speedFor = (n) => Math.max(0.078, 0.155 - n * 0.0022);

function steer(d) {
  if (G.state !== 'playing' || G.auto) return;
  const last = G.queue.length ? G.queue[G.queue.length - 1] : G.dir;
  if ((d.x === last.x && d.y === last.y) || (d.x === -last.x && d.y === -last.y)) return;
  if (G.queue.length >= 2) return;
  G.queue.push(d);
  Snd.turn(DIR_LIST.indexOf(d));
}

// Attract mode and ?auto: head for the fruit along the shortest open route,
// and when there is none, stall in whichever direction has the most room.
const aiDist = new Int16Array(NT), aiQ = new Int16Array(NT);
function aiDir() {
  const s = G.snake, h = s[0];
  occ2.fill(0);
  for (let i = 0; i < s.length - 1; i++) occ2[s[i].y * COLS + s[i].x] = 1;
  const tgt = G.plum && G.time >= G.plum.born ? G.plum : G.fruit;
  aiDist.fill(-1);
  if (tgt) {
    let qh = 0, qt = 0;
    const k0 = tgt.y * COLS + tgt.x;
    aiDist[k0] = 0;
    aiQ[qt++] = k0;
    while (qh < qt) {
      const k = aiQ[qh++], x = k % COLS, y = (k / COLS) | 0;
      for (const d of DIR_LIST) {
        const X = x + d.x, Y = y + d.y;
        if (!inBoard(X, Y)) continue;
        const K = Y * COLS + X;
        if (occ2[K] || aiDist[K] >= 0) continue;
        aiDist[K] = aiDist[k] + 1;
        aiQ[qt++] = K;
      }
    }
  }
  let best = null, bv = 1e9;
  for (const d of DIR_LIST) {
    if (d.x === -G.dir.x && d.y === -G.dir.y) continue;
    const x = h.x + d.x, y = h.y + d.y;
    if (!inBoard(x, y) || occ2[y * COLS + x]) continue;
    let v = aiDist[y * COLS + x];
    if (v < 0) {
      v = 400;
      for (const e of DIR_LIST) if (inBoard(x + e.x, y + e.y) && !occ2[(y + e.y) * COLS + x + e.x]) v--;
    }
    if (d === G.dir) v -= 0.2;
    if (v < bv) { bv = v; best = d; }
  }
  return best;
}

function step() {
  if (G.mode === 'fall') {
    const h = G.snake[0];
    G.prevTail = G.snake.pop();
    G.snake.unshift({ x: h.x + G.dir.x, y: h.y + G.dir.y });
    G.tickDur = Math.max(0.036, G.tickDur * 0.9);
    return;
  }
  if (G.auto) {
    const d = aiDir();
    if (d) G.dir = d;
  } else {
    while (G.queue.length) {
      const d = G.queue.shift();
      if (d.x !== -G.dir.x || d.y !== -G.dir.y) { G.dir = d; break; }
    }
  }
  const s = G.snake, nx = s[0].x + G.dir.x, ny = s[0].y + G.dir.y;
  if (!inBoard(nx, ny)) {
    G.prevTail = s.pop();
    s.unshift({ x: nx, y: ny });
    die('fall');
    return;
  }
  const f = G.fruit, p = G.plum;
  const gotFruit = f && f.x === nx && f.y === ny;
  const gotPlum = !gotFruit && p && p.x === nx && p.y === ny && G.time >= p.born;
  const grow = gotFruit || gotPlum;
  // The tail cell is safe to enter when it is about to move out of the way.
  for (let i = 0, n = s.length - (grow ? 0 : 1); i < n; i++) {
    if (s[i].x === nx && s[i].y === ny) { die('bite'); return; }
  }
  s.unshift({ x: nx, y: ny });
  if (grow) {
    G.prevTail = s[s.length - 1];
    eat(gotFruit ? f : p, gotFruit ? 'fruit' : 'plum');
  } else {
    G.prevTail = s.pop();
  }
}

// The rules resolve a move the instant it starts, but on screen the head is
// still a cell away. Everything you see and hear waits for it to arrive.
function eat(f, kind) {
  const delay = G.tickDur * 0.4, at = G.time + delay;
  G.ghosts.push({ x: f.x + 0.5, y: f.y + 0.5, kind, seed: f.seed, t0: G.time, until: at });
  if (kind === 'fruit') {
    G.eaten++;
    G.score++;
    spawnFruit(at + 0.18);
    if (live()) G.tickDur = speedFor(G.eaten);
    if (G.eaten % 5 === 0) {
      G.dayTarget++;
      after(delay, turnDay);
    }
    if (G.eaten % 6 === 4 && !G.plum) {
      const c = freeCell();
      if (c) {
        c.born = at + 0.9;
        c.dies = c.born + 7.5;
        G.plum = c;
        announce(c, 'plum');
      }
    }
  } else {
    G.score += 3;
    G.plum = null;
  }
  const n = G.eaten, pts = kind === 'fruit' ? 1 : 3;
  after(delay, () => eatFx(f.x + 0.5, f.y + 0.5, kind, n, pts));
}

function eatFx(x, y, kind, n, pts) {
  const c = kind === 'fruit' ? [col.fruit, col.fruitHi, col.fruitShade] : [col.plum, col.plumHi, col.plumShade];
  for (let i = 0; i < 15; i++) {
    const a = rand(TAU), sp = rand(1.2, 4.4);
    G.parts.push({
      kind: i < 3 ? 'leaf' : 'chip', x, y, z: 0.35,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rand(3, 7.5),
      age: 0, life: rand(0.7, 1.3), size: rand(0.035, 0.08),
      c: i < 3 ? col.leaf : c[i % 3], rot: rand(TAU), vr: rand(-9, 9),
    });
  }
  G.ripples.push({ x, y, t0: G.time, amp: kind === 'fruit' ? 0.2 : 0.28, speed: 8.5, width: 1, life: 1.7, glow: 2.2 });
  G.bulges.push({ u: 0 });
  G.pops.push({ x, y, text: '+' + pts, age: 0 });
  G.shake = Math.max(G.shake, 0.12);
  if (!live()) return;
  if (kind === 'fruit') Snd.eat(n - 1); else Snd.plum();
  showScore(true);
}

function turnDay() {
  G.ripples.push({ x: HC, y: HR, t0: G.time + 0.15, amp: 0.3, speed: 6, width: 1.6, life: 2.6, glow: 2 });
  if (!live()) return;
  Snd.phase(G.dayTarget % 4, true);
  showPhase(true);
}

function puff(x, y, r, band) {
  const c = band ? col.band : col.cream;
  for (let i = 0; i < 4; i++) {
    const a = rand(TAU), sp = rand(0.6, 2.4);
    G.parts.push({
      kind: 'chip', x, y, z: r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rand(2, 5),
      age: 0, life: rand(0.45, 0.8), size: rand(0.04, 0.085) * (r / 0.33), c, rot: 0, vr: 0,
    });
  }
  G.parts.push({ kind: 'puff', x, y, z: r, vx: 0, vy: 0, vz: 0, age: 0, life: 0.34, size: r * 1.7, c: col.creamHi, rot: 0, vr: 0 });
}

function die(mode) {
  if (G.state === 'title') {
    // The demo snake just bows out and tries again.
    for (const c of G.snake) if (inBoard(c.x, c.y)) puff(c.x + 0.5, c.y + 0.5, 0.3, 0);
    resetRound(0.5);
    return;
  }
  G.mode = mode;
  G.dieT = G.time;
  G.doneAt = 0;
  G.queue.length = 0;
  setState('dying');
  if (mode === 'bite') {
    G.acc = G.tickDur;
    G.visLen = pathLen;
    G.popNext = Math.floor(pathLen);
    G.popRate = Math.max(14, pathLen);
    G.popCount = 0;
    G.shake = 0.6;
    Snd.bonk();
  } else {
    G.shake = 0.22;
    Snd.fall();
  }
}

function gameOver() {
  const best = G.score > G.best;
  if (best) {
    G.best = G.score;
    try { localStorage.setItem('persimmon.best', G.best); } catch (e) {}
  }
  el.overTitle.textContent = G.mode === 'fall' ? 'Over the edge.' : 'Tangled.';
  el.overScore.textContent = `${G.score} ${G.score === 1 ? 'point' : 'points'}`;
  el.overDay.textContent = `ended ${WHEN[G.dayTarget % 4]}`;
  el.overBest.textContent = best ? 'a new best' : `best ${G.best}`;
  el.overBest.classList.toggle('new', best);
  showBest();
  G.snakeGone = true;
  G.plum = null;
  G.overT = G.time;
  setState('over');
  Snd.over(best);
}

function togglePause() {
  if (G.state === 'playing') {
    setState('paused');
    Snd.hold(true);
  } else if (G.state === 'paused') {
    setState('playing');
    Snd.hold(false);
  }
}

function primary() {
  if (G.state === 'title') startGame();
  else if (G.state === 'over' && G.time - G.overT > 0.4) startGame();
  else if (G.state === 'paused') togglePause();
}

/* ---------- readout ---------- */
function showScore(bump) {
  el.score.textContent = G.score;
  const on = G.eaten % 5;
  for (let i = 0; i < 5; i++) el.pips.children[i].classList.toggle('on', i < on);
  if (!bump) return;
  el.score.classList.remove('bump');
  void el.score.offsetWidth;
  el.score.classList.add('bump');
}
function showPhase(anim) {
  el.phase.textContent = PHASES[G.dayTarget % 4];
  el.phase.classList.remove('turn');
  if (!anim) return;
  void el.phase.offsetWidth;
  el.phase.classList.add('turn');
}
function showBest() {
  el.best.textContent = G.best;
  el.bestWrap.hidden = G.best <= 0;
}
function showMute() {
  el.mute.textContent = Snd.muted ? 'sound off' : 'sound on';
}

/* ---------- simulation ---------- */
function update(dt) {
  G.time += dt;
  const t = G.time;

  for (let i = G.timers.length - 1; i >= 0; i--) {
    if (t >= G.timers[i].at) G.timers.splice(i, 1)[0].fn();
  }

  const k = 1 - Math.exp(-dt * 3);
  G.zoom += (G.zoomTo - G.zoom) * k;
  G.lift += (G.liftTo - G.lift) * k;
  G.shake = Math.max(0, G.shake - dt * 1.6);

  // The day only ever runs forward; a new game winds it round to morning.
  const ahead = G.dayTarget - G.dayT;
  if (ahead > 0) G.dayT = Math.min(G.dayTarget, G.dayT + dt * Math.max(0.42, ahead * 1.3));

  if (G.state === 'playing' || G.state === 'title') {
    if (t >= G.holdUntil) {
      G.acc += dt;
      while (G.acc >= G.tickDur && (G.state === 'playing' || G.state === 'title')) {
        G.acc -= G.tickDur;
        step();
      }
    }
  } else if (G.state === 'dying') {
    updateDying(dt);
  }

  let da = Math.atan2(G.dir.y, G.dir.x) - G.headAng;
  da -= Math.round(da / TAU) * TAU;
  G.headAng += da * (1 - Math.exp(-dt * 20));
  if (t > G.blinkAt + 0.13) G.blinkAt = t + rand(2.2, 6);
  if (t > G.tongueAt + 0.36) G.tongueAt = t + rand(1.6, 4.5);

  for (let i = G.bulges.length - 1; i >= 0; i--) {
    G.bulges[i].u += dt * 10;
    if (G.bulges[i].u > pathLen + 2) G.bulges.splice(i, 1);
  }
  for (let i = G.ghosts.length - 1; i >= 0; i--) if (t >= G.ghosts[i].until) G.ghosts.splice(i, 1);
  for (let i = G.ripples.length - 1; i >= 0; i--) if (t - G.ripples[i].t0 > G.ripples[i].life) G.ripples.splice(i, 1);
  for (let i = G.rings.length - 1; i >= 0; i--) if (t - G.rings[i].t0 > G.rings[i].life) G.rings.splice(i, 1);
  if (G.plum && t > G.plum.dies) {
    puff(G.plum.x + 0.5, G.plum.y + 0.5, 0.3, 1);
    G.plum = null;
    if (live()) Snd.plumGone();
  }

  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i];
    p.age += dt;
    if (p.age > p.life) { G.parts.splice(i, 1); continue; }
    if (p.kind === 'puff') continue;
    p.vz -= 19 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.rot += p.vr * dt;
    if (p.z < 0 && p.vz < 0 && inBoard(Math.floor(p.x), Math.floor(p.y)) && p.z > -0.4) {
      p.z = 0;
      p.vz *= -0.38;
      p.vx *= 0.6;
      p.vy *= 0.6;
      p.vr *= 0.5;
    }
  }
  for (let i = G.pops.length - 1; i >= 0; i--) {
    G.pops[i].age += dt;
    if (G.pops[i].age > 0.95) G.pops.splice(i, 1);
  }

  for (const c of CLOUDS) {
    c.x += c.v * dt;
    if (c.x > 1.3) c.x = -0.3;
  }
  for (const m of MOTES) {
    m.x += (m.vx + Math.sin(t * m.f + m.p) * 0.012) * dt;
    m.y += (m.vy + Math.cos(t * m.f * 0.8 + m.p) * 0.012) * dt;
    if (m.x < -0.05) m.x = 1.05; else if (m.x > 1.05) m.x = -0.05;
    if (m.y < -0.05) m.y = 1.05; else if (m.y > 1.05) m.y = -0.05;
  }

  computeTiles(dt);
}

function updateDying(dt) {
  const age = G.time - G.dieT;
  if (G.mode === 'bite') {
    // A short lunge into whatever was hit, then the body pops away tail first.
    G.lunge = age < 0.26 ? 0.3 * Math.sin(Math.PI * age / 0.26) : 0;
    if (age > 0.55 && !G.snakeGone) {
      G.visLen -= dt * G.popRate;
      while (G.popNext > G.visLen && G.popNext > 0) {
        const i = Math.min(sN - 1, Math.round(G.popNext / DU));
        if (i >= 0) puff(sX[i], sY[i], 0.3, sBand[i]);
        if (G.time - G.popSound > 0.05) {
          G.popSound = G.time;
          Snd.pop(G.popCount++);
        }
        G.popNext--;
      }
      if (G.visLen <= 0.2) {
        puff(sX[0], sY[0], 0.42, 0);
        puff(sX[0], sY[0], 0.36, 0);
        G.snakeGone = true;
        G.doneAt = G.time + 0.55;
      }
    }
  } else {
    G.acc += dt;
    while (G.acc >= G.tickDur) {
      G.acc -= G.tickDur;
      step();
    }
    const tail = G.snake[G.snake.length - 1];
    const gone = tail.x < -2 || tail.y < -2 || tail.x > COLS + 1 || tail.y > ROWS + 1;
    if (!G.doneAt && (gone || age > 2.1)) G.doneAt = G.time + 0.2;
  }
  if (G.doneAt && G.time >= G.doneAt) gameOver();
}

const RP = [];
function computeTiles(dt) {
  const t = G.time, kp = 1 - Math.exp(-dt * 14);
  occ.fill(0);
  if (!G.snakeGone && t > G.spawnT0) for (const c of G.snake) if (inBoard(c.x, c.y)) occ[c.y * COLS + c.x] = 1;
  const it = t - G.introT0, intro = it < INTRO_LEN;
  RP.length = 0;
  for (const r of G.ripples) {
    const age = t - r.t0;
    if (age < 0 || age > r.life) continue;
    r.front = age * r.speed;
    r.now = r.amp * (1 - age / r.life);
    RP.push(r);
  }
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    const k = j * COLS + i;
    PRESS[k] += ((occ[k] ? 0.05 : 0) - PRESS[k]) * kp;
    let h = Math.sin(t * 1.1 + i * 0.55 + j * 0.8) * 0.012 - PRESS[k], gl = 0;
    for (const r of RP) {
      const e = (Math.hypot(i + 0.5 - r.x, j + 0.5 - r.y) - r.front) / r.width;
      if (e > -3 && e < 3) {
        const w = r.now * Math.exp(-e * e);
        h += w;
        gl += w * r.glow;
      }
    }
    let io = 0, ia = 1;
    if (intro) {
      const p = clamp((it - DELAY[k]) / 0.8);
      io = -(1 - easeOutBack(p)) * 2.6;
      ia = clamp(p * 3);
    }
    IO[k] = io;
    IA[k] = ia;
    TH[k] = io + h;
    GLOW[k] = clamp(gl, 0, 0.75);
  }
}

// Tile heights are per tile; blend between centres so things resting on the
// board ride a ripple instead of stepping over it.
function heightAt(x, y) {
  const fx = clamp(x - 0.5, 0, COLS - 1), fy = clamp(y - 0.5, 0, ROWS - 1);
  const i = Math.min(COLS - 2, fx | 0), j = Math.min(ROWS - 2, fy | 0);
  const u = fx - i, v = fy - j, k = j * COLS + i;
  return lerp(lerp(TH[k], TH[k + 1], u), lerp(TH[k + COLS], TH[k + COLS + 1], u), v);
}

/* ---------- the snake's body ----------
   The cells give a path of right angles. The body follows it with rounded
   corners and is sampled into closely spaced discs, each tagged with `u`, its
   distance from the head measured along the un-rounded path. Markings and
   swallowed-fruit bulges are placed by `u`, so they stay fixed to the body
   while corners form and dissolve underneath them. */
const MAXS = 4096, DU = 0.085, R0 = 0.335;
const sX = new Float32Array(MAXS), sY = new Float32Array(MAXS), sZ = new Float32Array(MAXS);
const sU = new Float32Array(MAXS), sR = new Float32Array(MAXS);
const sPX = new Float32Array(MAXS), sPY = new Float32Array(MAXS), sPR = new Float32Array(MAXS);
const sBand = new Uint8Array(MAXS), sOut = new Uint8Array(MAXS), sGrp = new Int8Array(MAXS);
const PT = [], segL = [], segU = [], segDX = [], segDY = [], cornR = [];
const HIDDEN = 99, BEHIND = -1;
let sN = 0, pathLen = 0;

function buildPath(t) {
  const s = G.snake, n = s.length;
  PT.length = 0;
  sN = 0;
  const add = (x, y) => {
    const m = PT.length;
    if (m && Math.abs(PT[m - 2] - x) + Math.abs(PT[m - 1] - y) < 1e-3) return;
    PT.push(x, y);
  };
  add(lerp(s[1].x, s[0].x, t) + 0.5 + G.dir.x * G.lunge, lerp(s[1].y, s[0].y, t) + 0.5 + G.dir.y * G.lunge);
  for (let i = 1; i < n; i++) add(s[i].x + 0.5, s[i].y + 0.5);
  add(lerp(G.prevTail.x, s[n - 1].x, t) + 0.5, lerp(G.prevTail.y, s[n - 1].y, t) + 0.5);

  const m = PT.length / 2 - 1;
  if (m < 1) return;
  let U = 0;
  for (let k = 0; k < m; k++) {
    const dx = PT[k * 2 + 2] - PT[k * 2], dy = PT[k * 2 + 3] - PT[k * 2 + 1], L = Math.hypot(dx, dy);
    segL[k] = L;
    segU[k] = U;
    segDX[k] = dx / L;
    segDY[k] = dy / L;
    U += L;
  }
  pathLen = U;
  // End segments can give their whole length to a corner; inner ones are shared.
  cornR[0] = cornR[m] = 0;
  for (let k = 1; k < m; k++) {
    cornR[k] = Math.min(0.5, k === 1 ? segL[0] : segL[k - 1] / 2, k === m - 1 ? segL[k] : segL[k] / 2);
  }

  const count = Math.min(MAXS - 1, Math.ceil(U / DU));
  let k = 0;
  for (let i = 0; i <= count; i++) {
    const u = Math.min(U, i * DU);
    while (k < m - 1 && u > segU[k] + segL[k]) k++;
    const a = u - segU[k], L = segL[k];
    let c = -1, tau = 0;
    if (k > 0 && a < cornR[k]) {
      c = k;
      tau = (a + cornR[k]) / (2 * cornR[k]);
    } else if (k < m - 1 && a > L - cornR[k + 1]) {
      c = k + 1;
      tau = (a - (L - cornR[k + 1])) / (2 * cornR[k + 1]);
    }
    if (c < 0) {
      sX[i] = PT[k * 2] + segDX[k] * a;
      sY[i] = PT[k * 2 + 1] + segDY[k] * a;
    } else {
      const r = cornR[c], vx = PT[c * 2], vy = PT[c * 2 + 1], q = 1 - tau;
      const w0 = q * q, w2 = tau * tau;
      sX[i] = vx + (w2 * segDX[c] - w0 * segDX[c - 1]) * r;
      sY[i] = vy + (w2 * segDY[c] - w0 * segDY[c - 1]) * r;
    }
    sU[i] = u;
  }
  sN = count + 1;
}

function shapeSnake() {
  const sp = clamp((G.time - G.spawnT0) / 0.45), sc = sp <= 0 ? 0 : easeOutBack(sp);
  const vis = Math.min(pathLen, G.visLen), ni = ITEMS.length;
  for (let i = 0; i < sN; i++) {
    const u = sU[i];
    if (u > vis || sc <= 0) { sGrp[i] = HIDDEN; continue; }
    let r = R0 * (1 + 0.2 * Math.exp(-(u * u) / 0.18));
    const e = vis - u;
    if (e < 2.4) r *= 0.4 + 0.6 * smooth(e / 2.4);
    for (const b of G.bulges) {
      const q = (u - b.u) / 0.5;
      if (q > -3 && q < 3) r *= 1 + 0.3 * Math.exp(-q * q);
    }
    r *= sc;
    const x = sX[i], y = sY[i], out = Math.max(0, -x, x - COLS, -y, y - ROWS);
    const z = r + (out > 0 ? -0.55 * out * out : heightAt(x, y));
    sR[i] = r;
    sZ[i] = z;
    sOut[i] = out > 0 ? 1 : 0;
    sPX[i] = px(x, y);
    sPY[i] = py(x, y, z);
    sPR[i] = r * V.S;
    sBand[i] = (u + 0.7) % 1.7 < 0.5 ? 1 : 0;
    if (out > 0 && (x < -0.35 || y < -0.35)) {
      sGrp[i] = BEHIND;
    } else {
      const dk = x * DEPX + y * DEPY;
      let g = 0;
      while (g < ni && ITEMS[g].d < dk) g++;
      sGrp[i] = g;
    }
  }
}

// Each pass is a union of flat discs, so the body reads as one soft tube:
// a shade underneath, the colour nudged toward the light, then a thin sheen.
function snakePass(g, ox, oy, rs, c0, c1) {
  let cur = -1;
  for (let i = sN - 1; i >= 0; i--) {
    if (sGrp[i] !== g) continue;
    if (sBand[i] !== cur) {
      if (cur !== -1) ctx.fill();
      cur = sBand[i];
      ctx.fillStyle = cur ? c1 : c0;
      ctx.beginPath();
    }
    const r = sPR[i], x = sPX[i] + ox * r, y = sPY[i] + oy * r;
    ctx.moveTo(x + r * rs, y);
    ctx.arc(x, y, r * rs, 0, TAU);
  }
  if (cur !== -1) ctx.fill();
}

function drawSnake(g) {
  if (!sN) return;
  const head = sGrp[0] === g;
  const fx = Math.cos(G.headAng), fy = Math.sin(G.headAng);
  const toward = fx * DEPX + fy * DEPY > 0;
  const flick = G.state !== 'dying' ? clamp((G.time - G.tongueAt) / 0.36) : 0;
  if (head && flick > 0 && flick < 1 && !toward) drawTongue(fx, fy, flick);
  snakePass(g, 0, 0, 1, col.creamShade, col.bandShade);
  snakePass(g, -0.075, -0.1, 0.88, col.cream, col.band);
  snakePass(g, -0.26, -0.4, 0.3, col.creamHi, col.bandHi);
  if (!head) return;
  if (flick > 0 && flick < 1 && toward) drawTongue(fx, fy, flick);
  drawFace(fx, fy);
}

function drawTongue(fx, fy, p) {
  const x = sX[0], y = sY[0], R = sR[0], z = sZ[0] - R * 0.2;
  const len = 0.5 * Math.sin(Math.PI * p), wag = Math.sin(p * 40) * 0.05 * len;
  const lx = -fy, ly = fx;
  const bx = x + fx * R * 0.8, by = y + fy * R * 0.8;
  const tx = bx + fx * len + lx * wag, ty = by + fy * len + ly * wag;
  ctx.strokeStyle = TONGUE;
  ctx.lineWidth = V.S * 0.055;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(px(bx, by), py(bx, by, z));
  ctx.lineTo(px(tx, ty), py(tx, ty, z));
  const f = Math.min(0.14, len * 0.5);
  for (const s of [-1, 1]) {
    const ex = tx + fx * f + lx * f * 0.7 * s, ey = ty + fy * f + ly * f * 0.7 * s;
    ctx.moveTo(px(tx, ty), py(tx, ty, z));
    ctx.lineTo(px(ex, ey), py(ex, ey, z));
  }
  ctx.stroke();
}

function drawFace(fx, fy) {
  const x = sX[0], y = sY[0], R = sR[0], zc = sZ[0];
  const lx = -fy, ly = fx;
  const dead = G.state === 'dying' && G.mode === 'bite';
  const blink = G.time > G.blinkAt && !dead;
  // Eyes widen a little when the fruit is close.
  let wide = 1;
  if (G.fruit && !dead) wide += 0.3 * clamp(1 - Math.hypot(G.fruit.x + 0.5 - x, G.fruit.y + 0.5 - y) / 2.6);
  for (const s of [-1, 1]) {
    let nx = fx * 0.5 + lx * 0.54 * s, ny = fy * 0.5 + ly * 0.54 * s, nz = 0.62;
    const nl = Math.hypot(nx, ny, nz);
    nx /= nl; ny /= nl; nz /= nl;
    const facing = nx * CAM[0] + ny * CAM[1] + nz * CAM[2];
    if (facing < 0.06) continue;
    const ex = px(x + nx * R, y + ny * R), ey = py(x + nx * R, y + ny * R, zc + nz * R);
    const er = R * V.S * 0.17 * Math.min(1, 0.5 + facing * 0.8) * wide;
    if (dead) {
      ctx.strokeStyle = col.eye;
      ctx.lineWidth = er * 0.55;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - er, ey - er); ctx.lineTo(ex + er, ey + er);
      ctx.moveTo(ex + er, ey - er); ctx.lineTo(ex - er, ey + er);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = col.eye;
    ctx.beginPath();
    ctx.ellipse(ex, ey, er, blink ? er * 0.16 : er, 0, 0, TAU);
    ctx.fill();
    if (blink) continue;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex - er * 0.32, ey - er * 0.36, er * 0.3, 0, TAU);
    ctx.fill();
  }
}

/* ---------- drawing ---------- */
const SPARK = document.createElement('canvas');
{
  SPARK.width = SPARK.height = 64;
  const c = SPARK.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,240,180,1)');
  g.addColorStop(0.25, 'rgba(255,225,140,.55)');
  g.addColorStop(1, 'rgba(255,210,110,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
}
const STARS = [], CLOUDS = [], MOTES = [];
{
  const r = seeded(4);
  for (let i = 0; i < 90; i++) STARS.push({ x: r(), y: r() * 0.8, s: 0.6 + r() * 1.1, f: 0.6 + r() * 2, p: r() * TAU, a: 0.35 + r() * 0.65 });
  for (let i = 0; i < 7; i++) CLOUDS.push({ x: r() * 1.6 - 0.3, y: 0.07 + r() * 0.72, w: 0.14 + r() * 0.2, h: 0.016 + r() * 0.016, v: 0.004 + r() * 0.007, a: 0.55 + r() * 0.45, k: r() });
  for (let i = 0; i < 26; i++) MOTES.push({ x: r(), y: r(), vx: (r() - 0.5) * 0.012, vy: -0.004 - r() * 0.008, f: 0.4 + r() * 0.9, p: r() * TAU, s: 1 + r() * 1.6 });
}

function disc(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}
function capsule(x, y, w, h) {
  const r = h / 2;
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5);
}

function celestial(u, r) {
  const a = clamp(Math.sin(Math.PI * u) * 3 + 0.45);
  if (a <= 0) return null;
  return { x: V.W * (0.5 - 0.42 * Math.cos(Math.PI * u)), y: V.H * (0.64 - 0.52 * Math.sin(Math.PI * u)), r, a };
}

function drawSky() {
  const W = V.W, H = V.H, t = G.time;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, col.skyTop);
  g.addColorStop(1, col.skyBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (pal.night > 0.02) {
    ctx.fillStyle = '#fff';
    for (const s of STARS) {
      ctx.globalAlpha = pal.night * s.a * (0.6 + 0.4 * Math.sin(t * s.f + s.p));
      disc(s.x * W, s.y * H, s.s);
    }
  }

  const seg = Math.floor(G.dayT) % 4, f = smooth(G.dayT - Math.floor(G.dayT));
  const base = Math.min(W, H) * 0.125;
  const sun = celestial(lerp(SUN_U[seg][0], SUN_U[seg][1], f), base * (1 + 0.3 * pal.dusk));
  if (sun) {
    ctx.fillStyle = col.sun;
    ctx.globalAlpha = sun.a * 0.13;
    disc(sun.x, sun.y, sun.r * 2.35);
    ctx.globalAlpha = sun.a * 0.2;
    disc(sun.x, sun.y, sun.r * 1.55);
    ctx.globalAlpha = sun.a;
    disc(sun.x, sun.y, sun.r);
  }
  const moon = celestial(lerp(MOON_U[seg][0], MOON_U[seg][1], f), base * 0.8);
  if (moon) {
    ctx.fillStyle = MOON;
    ctx.globalAlpha = moon.a * 0.07;
    disc(moon.x, moon.y, moon.r * 2.1);
    ctx.globalAlpha = moon.a;
    disc(moon.x, moon.y, moon.r);
    ctx.fillStyle = CRATER;
    disc(moon.x - moon.r * 0.3, moon.y - moon.r * 0.22, moon.r * 0.2);
    disc(moon.x + moon.r * 0.36, moon.y + moon.r * 0.1, moon.r * 0.13);
    disc(moon.x - moon.r * 0.05, moon.y + moon.r * 0.46, moon.r * 0.16);
  }

  ctx.fillStyle = col.cloud;
  for (const c of CLOUDS) {
    const w = c.w * W, h = Math.max(8, c.h * H), x = c.x * W, y = c.y * H;
    ctx.globalAlpha = pal.cloudA * c.a;
    ctx.beginPath();
    capsule(x, y, w, h);
    capsule(x + w * (0.12 + c.k * 0.2), y - h * 0.72, w * 0.5, h);
    capsule(x - w * 0.14 + c.k * w * 0.5, y + h * 0.72, w * 0.62, h);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function face(xa, ya, xb, yb, zt, zb) {
  const x0 = px(xa, ya), x1 = px(xb, yb);
  ctx.beginPath();
  ctx.moveTo(x0, py(xa, ya, zt));
  ctx.lineTo(x1, py(xb, yb, zt));
  ctx.lineTo(x1, py(xb, yb, zb));
  ctx.lineTo(x0, py(xa, ya, zb));
  ctx.fill();
}
function top(x0, y0, x1, y1, z) {
  ctx.beginPath();
  ctx.moveTo(px(x0, y0), py(x0, y0, z));
  ctx.lineTo(px(x1, y0), py(x1, y0, z));
  ctx.lineTo(px(x1, y1), py(x1, y1, z));
  ctx.lineTo(px(x0, y1), py(x0, y1, z));
  ctx.fill();
}
// Strata are painted top-down over each other rather than butted together,
// which keeps hairline seams out of the earth.
function strata(xa, ya, xb, yb, base, depth, cols, v) {
  for (let l = 0; l < 4 && depth > LAYERS[l]; l++) {
    ctx.fillStyle = cols[l][v];
    face(xa, ya, xb, yb, base - LAYERS[l], base - depth);
  }
}

function drawBoard() {
  const g = 0.045, e = 0.012;
  const A = pal.tileA, B = pal.tileB, HI = pal.tileHi;
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    const k = j * COLS + i, a = IA[k];
    if (a <= 0) continue;
    if (a < 1) ctx.globalAlpha = a;
    const io = IO[k], h = TH[k], v = VARIANT[k];
    if (FRONT[k]) strata(i - e, j + 1, i + 1 + e, j + 1, io, DEPTH[k], STRATA.F, v);
    if (RIGHT[k]) strata(i + 1, j - e, i + 1, j + 1 + e, io, DEPTH[k], STRATA.R, v);
    ctx.fillStyle = col.grout;
    top(i - e, j - e, i + 1 + e, j + 1 + e, io);
    if (h > io + 0.004) {
      ctx.fillStyle = col.turfF;
      face(i + g, j + 1 - g, i + 1 - g, j + 1 - g, h, io);
      ctx.fillStyle = col.turfR;
      face(i + 1 - g, j + g, i + 1 - g, j + 1 - g, h, io);
    }
    const c = (i + j) & 1 ? B : A, tn = TONE[k], gl = GLOW[k];
    ctx.fillStyle = `rgb(${lerp(c[0] * tn, HI[0], gl) | 0},${lerp(c[1] * tn, HI[1], gl) | 0},${lerp(c[2] * tn, HI[2], gl) | 0})`;
    top(i + g, j + g, i + 1 - g, j + 1 - g, h);
    if (a < 1) ctx.globalAlpha = 1;
  }
}

function drawGround() {
  ctx.save();
  groundT(0.01);
  for (const r of G.rings) {
    const p = (G.time - r.t0) / r.life;
    if (p < 0 || p > 1) continue;
    ctx.globalAlpha = (1 - p) * 0.8;
    ctx.lineWidth = 0.07 * (1 - p) + 0.015;
    ctx.strokeStyle = col.tileHi;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r * easeOutCubic(p), 0, TAU);
    ctx.stroke();
  }
  const p = G.plum;
  if (p && G.time > p.born) {
    const left = clamp((p.dies - G.time) / (p.dies - p.born));
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 0.07;
    ctx.lineCap = 'round';
    ctx.strokeStyle = col.plumHi;
    ctx.beginPath();
    ctx.arc(p.x + 0.5, p.y + 0.5, 0.43, -Math.PI / 2, -Math.PI / 2 + TAU * left);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.rect(0, 0, COLS, ROWS);
  ctx.clip();
  ctx.beginPath();
  for (let i = 0; i < sN; i += 2) {
    if (sGrp[i] === HIDDEN || sOut[i]) continue;
    const r = sR[i] * 0.97, x = sX[i] + 0.12, y = sY[i] + 0.085;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, TAU);
  }
  for (const it of ITEMS) {
    const r = 0.27 * it.sc * (1 - it.bob * 0.22), x = it.x + 0.13, y = it.y + 0.09;
    if (r <= 0) continue;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, TAU);
  }
  ctx.fillStyle = rgba(pal.shadow, pal.shadowA);
  ctx.fill();
  ctx.restore();
}

function drawFruit(it) {
  const t = G.time, sc = it.sc;
  if (sc <= 0) return;
  const plum = it.kind === 'plum';
  const z = heightAt(it.x, it.y) + (0.09 + it.bob * 0.1 + 0.29) * sc;
  const R = V.S * 0.31 * sc, cx = px(it.x, it.y), cy = py(it.x, it.y, z);
  const sq = 1 + Math.sin(t * 2.6 + it.seed + 1.3) * 0.045;
  const rx = R * (plum ? 0.86 : 1) / sq, ry = R * (plum ? 0.96 : 0.87) * sq;

  if (pal.night > 0.02) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = pal.night * 0.55;
    ctx.drawImage(SPARK, cx - R * 3.2, cy - R * 3.2, R * 6.4, R * 6.4);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = plum ? col.plumShade : col.fruitShade;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = plum ? col.plum : col.fruit;
  ctx.beginPath(); ctx.ellipse(cx - rx * 0.07, cy - ry * 0.1, rx * 0.9, ry * 0.87, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = plum ? col.plumHi : col.fruitHi;
  ctx.beginPath(); ctx.ellipse(cx - rx * 0.44, cy - ry * 0.36, rx * 0.24, ry * 0.13, -0.65, 0, TAU); ctx.fill();

  if (plum) {
    const sx = cx + rx * 0.05, sy = cy - ry * 0.82;
    ctx.strokeStyle = STEM;
    ctx.lineWidth = R * 0.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + rx * 0.05, sy - ry * 0.3, sx + rx * 0.22, sy - ry * 0.42);
    ctx.stroke();
    ctx.fillStyle = col.leaf;
    ctx.beginPath();
    ctx.ellipse(sx + rx * 0.5, sy - ry * 0.22, rx * 0.36, ry * 0.15, -0.5 + Math.sin(t * 2 + it.seed) * 0.12, 0, TAU);
    ctx.fill();
    return;
  }
  // The calyx: a four-pointed leaf star seen from above, so squashed.
  const ky = cy - ry * 0.55, kr = rx * 0.56, rot = Math.PI / 4 + Math.sin(t * 1.7 + it.seed) * 0.14;
  ctx.fillStyle = col.leaf;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = rot + i * TAU / 8, rr = i % 2 ? kr * 0.34 : kr;
    const X = cx + Math.cos(a) * rr, Y = ky + Math.sin(a) * rr * 0.52;
    if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = STEM;
  ctx.beginPath(); ctx.ellipse(cx, ky - ry * 0.05, rx * 0.1, ry * 0.085, 0, 0, TAU); ctx.fill();
}

function drawParticles() {
  const S = V.S;
  for (const p of G.parts) {
    const k = p.age / p.life, x = px(p.x, p.y), y = py(p.x, p.y, p.z);
    if (p.kind === 'puff') {
      ctx.globalAlpha = (1 - k) * 0.7;
      ctx.strokeStyle = p.c;
      ctx.lineWidth = S * 0.07 * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.arc(x, y, p.size * S * (0.45 + 0.75 * easeOutCubic(k)), 0, TAU);
      ctx.stroke();
      continue;
    }
    ctx.globalAlpha = clamp((1 - k) / 0.3);
    ctx.fillStyle = p.c;
    ctx.beginPath();
    if (p.kind === 'leaf') ctx.ellipse(x, y, p.size * S * 1.7, p.size * S * 0.7, p.rot, 0, TAU);
    else ctx.arc(x, y, p.size * S, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.font = `italic ${Math.round(S * 0.62)}px ${SERIF}`;
  for (const p of G.pops) {
    const k = p.age / 0.95, z = 0.95 + easeOutCubic(k) * 0.9;
    const x = px(p.x, p.y), y = py(p.x, p.y, z);
    ctx.globalAlpha = clamp((1 - k) / 0.35);
    ctx.lineWidth = S * 0.1;
    ctx.strokeStyle = col.bandShade;
    ctx.strokeText(p.text, x, y);
    ctx.fillStyle = col.creamHi;
    ctx.fillText(p.text, x, y);
  }
  ctx.globalAlpha = 1;
}

// Pollen by day; by night the same drifting specks light up as fireflies.
function drawMotes() {
  const W = V.W, H = V.H, t = G.time, n = pal.night;
  if (n < 0.98) {
    ctx.fillStyle = col.creamHi;
    for (const m of MOTES) {
      ctx.globalAlpha = (1 - n) * 0.42 * (0.6 + 0.4 * Math.sin(t * m.f + m.p));
      disc(m.x * W, m.y * H, m.s);
    }
  }
  if (n > 0.02) {
    ctx.globalCompositeOperation = 'lighter';
    for (const m of MOTES) {
      const b = Math.max(0, Math.sin(t * m.f * 1.6 + m.p * 3));
      ctx.globalAlpha = n * b * b;
      const s = m.s * 9;
      ctx.drawImage(SPARK, m.x * W - s, m.y * H - s, s * 2, s * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
}

const ITEMS = [];
function collectItems() {
  const t = G.time;
  ITEMS.length = 0;
  const put = (x, y, kind, sc, seed) => ITEMS.push({ x, y, kind, sc, seed, d: x * DEPX + y * DEPY, bob: 0.5 + 0.5 * Math.sin(t * 2.6 + seed) });
  const f = G.fruit, p = G.plum;
  if (f && t > f.born) put(f.x + 0.5, f.y + 0.5, 'fruit', easeOutBack(clamp((t - f.born) / 0.42)), f.seed);
  if (p && t > p.born) {
    const left = p.dies - t;
    // In its last seconds the plum shivers, then shrinks away.
    const hurry = left < 2.2 ? 1 + Math.sin(t * 22) * 0.05 : 1;
    put(p.x + 0.5, p.y + 0.5, 'plum', easeOutBack(clamp((t - p.born) / 0.42)) * clamp(left / 0.25) * hurry, p.seed);
  }
  for (const g of G.ghosts) {
    const k = clamp((t - g.t0) / (g.until - g.t0)), kk = k * k;
    const hx = sN ? sX[0] : g.x, hy = sN ? sY[0] : g.y;
    put(lerp(g.x, hx, kk * 0.7), lerp(g.y, hy, kk * 0.7), g.kind, 1 - 0.4 * kk, g.seed);
  }
  ITEMS.sort((a, b) => a.d - b.d);
}

function render() {
  updatePalette();
  screenT();
  const sh = G.shake * G.shake * 30;
  V.S = V.baseS * G.zoom;
  V.ox = V.W / 2 + Math.sin(G.time * 97) * sh;
  V.oy = V.H * (0.5 + G.lift) - 0.3 * V.S + Math.sin(G.time * 0.9) * V.S * 0.05 + Math.cos(G.time * 83) * sh;

  drawSky();

  if (G.snakeGone || !G.snake.length) sN = 0;
  else buildPath(G.state === 'dying' && G.mode === 'bite' ? 1 : clamp(G.acc / G.tickDur));
  collectItems();
  shapeSnake();

  drawSnake(BEHIND);
  drawBoard();
  drawGround();
  for (let g = 0; g <= ITEMS.length; g++) {
    drawSnake(g);
    if (g < ITEMS.length) drawFruit(ITEMS[g]);
  }
  drawParticles();
  drawMotes();
}

/* ---------- input ---------- */
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  Snd.unlock();
  const d = KEYS[e.code];
  if (d) {
    e.preventDefault();
    if (!e.repeat) steer(d);
    return;
  }
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    primary();
  } else if (e.code === 'KeyP' || e.code === 'Escape') {
    togglePause();
  } else if (e.code === 'KeyM') {
    Snd.toggleMute();
    showMute();
  }
});

// Swipes are matched against the board's own axes as they appear on screen.
let ptr = null;
const AL = Math.hypot(AX, AY), BL = Math.hypot(BX, BY);
addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  Snd.unlock();
  ptr = { x: e.clientX, y: e.clientY, moved: false };
});
addEventListener('pointermove', (e) => {
  if (!ptr) return;
  const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
  if (Math.hypot(dx, dy) < 26) return;
  const a = (dx * AX + dy * AY) / AL, b = (dx * BX + dy * BY) / BL;
  steer(Math.abs(a) > Math.abs(b) ? (a > 0 ? DIRS.R : DIRS.L) : (b > 0 ? DIRS.D : DIRS.U));
  ptr.x = e.clientX;
  ptr.y = e.clientY;
  ptr.moved = true;
});
addEventListener('pointerup', () => {
  if (ptr && !ptr.moved) primary();
  ptr = null;
});
addEventListener('pointercancel', () => { ptr = null; });

el.mute.addEventListener('click', () => {
  Snd.unlock();
  Snd.toggleMute();
  showMute();
  el.mute.blur();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (G.state === 'playing') togglePause();
    else Snd.hold(true);
  } else if (G.state !== 'paused') {
    Snd.hold(false);
  }
});
addEventListener('resize', resize);

/* ---------- go ---------- */
let last = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  if (G.state !== 'paused') update(dt);
  render();
  requestAnimationFrame(frame);
}

el.plane.style.transform = `matrix(${AX.toFixed(4)},${AY.toFixed(4)},${BX.toFixed(4)},${BY.toFixed(4)},0,0)`;
resize();
setState('title');
showBest();
showMute();
resetRound(G.introT0 + INTRO_LEN - 0.2);
computeTiles(0);
if (QUERY.has('debug')) window.__persimmon = { G, startGame, gameOver, die, step };
requestAnimationFrame(frame);
})();
