// Micro Voladora Valpo — prototipo en primera persona (pseudo 3D)
// Vas al volante de una micro bajando los cerros de Valparaíso.

const W = 800;
const H = 600;
const SEG = 200; // largo de cada franja de calle
const RW = 2000; // medio ancho de la calle
const CAMH = 1000; // altura del ojo del chofer
const DEPTH = 0.84; // 1/tan(fov/2), fov ~100°
const DRAW = 130; // franjas visibles
const HOR = 250; // altura del horizonte en pantalla
const MAXV = SEG * 60;
const GRAV = 25000;

// DO NOT replace existing keys — they match the physical arcade cabinet wiring.
// To add local testing shortcuts, append extra keys to any array.
const CABINET_KEYS = {
  P1_U: ['w'],
  P1_D: ['s'],
  P1_L: ['a'],
  P1_R: ['d'],
  P1_1: ['u'],
  P1_2: ['i'],
  P1_3: ['o'],
  P1_4: ['j'],
  P1_5: ['k'],
  P1_6: ['l'],
  P2_U: ['ArrowUp'],
  P2_D: ['ArrowDown'],
  P2_L: ['ArrowLeft'],
  P2_R: ['ArrowRight'],
  P2_1: ['r'],
  P2_2: ['t'],
  P2_3: ['y'],
  P2_4: ['f'],
  P2_5: ['g'],
  P2_6: ['h'],
  START1: ['Enter'],
  START2: ['2'],
};

const KEYBOARD_TO_ARCADE = {};
for (const [arcadeCode, keys] of Object.entries(CABINET_KEYS)) {
  for (const key of keys) {
    KEYBOARD_TO_ARCADE[normalizeIncomingKey(key)] = arcadeCode;
  }
}

// ---------- Pista ----------
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const S = [];
let lastY = 0;
const ease = (a, b, p) => a + (b - a) * (0.5 - Math.cos(p * Math.PI) / 2);
function addRoad(e, h, l, c, dy) {
  const y0 = lastY;
  const tot = e + h + l;
  for (let i = 0; i < tot; i++) {
    const cv = i < e ? c * (i / e) ** 2 : i < e + h ? c : c * (1 - ((i - e - h) / l) ** 2);
    S.push({ c: cv, y: ease(y0, y0 + dy, i / tot) });
  }
  lastY = y0 + dy;
}
// [entrada, tramo, salida, curva, desnivel]
[
  [10, 40, 10, 0, 0],
  [25, 25, 25, -2, 1600],
  [15, 10, 15, 0, 2400],
  [5, 5, 5, 0, -1700],
  [20, 30, 20, 3, -1500],
  [10, 30, 10, 0, 0],
  [20, 20, 20, -3, 2200],
  [5, 5, 5, 2, -1900],
  [20, 20, 20, -4, 900],
  [20, 40, 20, 4, -1200],
  [15, 10, 15, 0, 2600],
  [4, 6, 4, -1, -1800],
  [25, 25, 25, 2, -400],
  [10, 30, 10, 0, 0],
].forEach((r) => addRoad(...r));
addRoad(20, 20, 20, 0, -lastY);
const N = S.length;
const groundY = (z) => {
  const i = Math.floor(z / SEG);
  const a = S[((i % N) + N) % N].y;
  const b = S[(((i + 1) % N) + N) % N].y;
  return a + (b - a) * ((z % SEG) / SEG);
};

// ---------- Phaser ----------
new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game-root',
  backgroundColor: '#9fb8c8',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
  scene: { create, update },
});

function create() {
  const sc = this;
  createControls(sc);
  sc.g = sc.add.graphics();
  sc.hud = sc.cameras.add(0, 0, W, H);
  sc.hud.ignore(sc.g);
  sc.ho = (o) => (sc.cameras.main.ignore(o), o);
  sc.p = { z: 0, x: 0, v: 0, y: 0, vy: 0, air: false, roll: 0, steer: 0 };
  sc.pitch = 0;
  sc.bgX = 0;
  createDash(sc);
}

function update(time, delta) {
  const sc = this;
  const dt = Math.min(delta / 1000, 0.033);
  const pr = sc.controls.pressed;
  updatePlayer(sc, dt, time);
  render(sc);
  refreshDash(sc, dt);
  engine(sc);
  for (const k in pr) pr[k] = false;
}

// ---------- Física ----------
function updatePlayer(sc, dt) {
  const p = sc.p;
  const hd = sc.controls.held;
  const seg = S[Math.floor(p.z / SEG) % N];
  const sp = p.v / MAXV;
  const st = (hd.P1_R ? 1 : 0) - (hd.P1_L ? 1 : 0);
  p.steer += (st - p.steer) * Math.min(1, dt * 8);

  if (!p.air) {
    if (hd.P1_U) p.v += (MAXV / 5) * dt;
    else if (hd.P1_D) p.v -= MAXV * dt;
    else p.v -= (MAXV / 6) * dt;
    // la pendiente ayuda o frena
    const sl = (groundY(p.z + 50) - groundY(p.z - 50)) / 100;
    p.v -= sl * 2200 * dt;
    p.x += p.steer * dt * 2.2 * Math.min(1, sp * 1.6 + 0.15) * (p.v > 30 ? 1 : 0);
    p.x -= sp * sp * seg.c * dt * 0.9; // fuerza centrífuga
    if (Math.abs(p.x) > 1.05) p.v -= p.v * 1.6 * dt; // por la vereda
  }
  p.x = Phaser.Math.Clamp(p.x, -1.25, 1.25);
  p.v = Phaser.Math.Clamp(p.v, 0, MAXV);
  p.z += p.v * dt;

  // vertical
  const gy = groundY(p.z);
  p.y = gy;
  p.vy = 0;
}

// ---------- Dibujo ----------
function proj(wx, wy, z, cy) {
  const s = (DEPTH / Math.max(z, 1)) * (W / 2);
  return { x: W / 2 + s * wx, y: cy - s * wy, s };
}

function quad(g, a, b, k, col) {
  g.fillStyle(col);
  g.beginPath();
  g.moveTo(a.x - a.s * RW * k, a.y);
  g.lineTo(a.x + a.s * RW * k, a.y);
  g.lineTo(b.x + b.s * RW * k, b.y);
  g.lineTo(b.x - b.s * RW * k, b.y);
  g.closePath();
  g.fillPath();
}

function render(sc) {
  const g = sc.g;
  const p = sc.p;
  g.clear();
  const cy = HOR + sc.pitch;
  const base = Math.floor(p.z / SEG);
  const pct = (p.z % SEG) / SEG;
  const camY = p.y + CAMH;
  sc.bgX += S[base % N].c * p.v * 0.00004;

  // cielo gris celeste y mar
  g.fillGradientStyle(0x8fa9bd, 0x8fa9bd, 0xd9e3e8, 0xd9e3e8).fillRect(-300, -300, W + 600, cy + 300);
  g.fillStyle(0x2d6f9e).fillRect(-300, cy, W + 600, H + 300 - cy);
  g.fillStyle(0x5d93b8).fillRect(-300, cy, W + 600, 6);

  // franjas, de lejos a cerca
  const L = [];
  let x = 0;
  let dx = -S[base % N].c * pct;
  for (let n = 0; n <= DRAW; n++) {
    const i = (base + n) % N;
    const z1 = (base + n) * SEG - p.z;
    const cx = p.x * RW;
    const a = proj(x - cx, S[i].y - camY, z1, cy);
    const b = proj(x + dx - cx, S[(i + 1) % N].y - camY, z1 + SEG, cy);
    L.push({ i, a, b, n });
    x += dx;
    dx += S[i].c;
  }
  for (let k = L.length - 1; k >= 1; k--) {
    const { i, a, b } = L[k];
    if (b.y >= a.y) continue;
    const alt = (i >> 2) & 1;
    g.fillStyle(alt ? 0xb98a5e : 0xc49668).fillRect(-300, b.y, W + 600, a.y - b.y + 1);
    quad(g, a, b, 1.3, alt ? 0xa9a39a : 0xb4aea4); // vereda
    quad(g, a, b, 1.06, alt ? 0xe8c547 : 0x6b6660); // solera
    quad(g, a, b, 1, alt ? 0x55524f : 0x5d5a56); // calle
    if (alt) quad(g, a, b, 0.025, 0xf2efe6);
  }
}

// ---------- Tablero ----------
function createDash(sc) {
  const d = sc.ho(sc.add.graphics());
  // marco del parabrisas
  d.fillStyle(0x1f2226);
  d.fillRect(0, 0, W, 22);
  d.fillPoints([{ x: 0, y: 0 }, { x: 46, y: 0 }, { x: 96, y: 470 }, { x: 0, y: 480 }], true);
  d.fillPoints([{ x: W, y: 0 }, { x: W - 46, y: 0 }, { x: W - 96, y: 470 }, { x: W, y: 480 }], true);
  // tablero
  d.fillStyle(0x2c2f34).fillRoundedRect(-20, 468, W + 40, 160, 26);
  d.fillStyle(0x3a3e45).fillRect(0, 468, W, 8);
  // velocímetro
  d.fillStyle(0x15171a).fillCircle(590, 540, 52);
  d.lineStyle(3, 0xd9d2c0);
  for (let k = 0; k <= 8; k++) {
    const an = Math.PI * (0.8 + (k / 8) * 1.4);
    d.lineBetween(590 + Math.cos(an) * 40, 540 + Math.sin(an) * 40, 590 + Math.cos(an) * 48, 540 + Math.sin(an) * 48);
  }
  sc.needle = sc.ho(sc.add.graphics().setPosition(590, 540));
  // volante
  const wh = sc.ho(sc.add.graphics().setPosition(250, 590));
  wh.lineStyle(20, 0x141414).strokeCircle(0, 0, 118);
  wh.lineStyle(14, 0x141414).lineBetween(-112, 0, 112, 0).lineBetween(0, 0, 0, 112);
  wh.fillStyle(0x26292d).fillCircle(0, 0, 30);
  wh.fillStyle(0xe8c547).fillCircle(0, 0, 12);
  sc.wheel = wh;
  // barra de datos arriba
  const st = (sz, col) => ({ fontFamily: 'monospace', fontSize: sz, fontStyle: 'bold', color: col });
  d.fillStyle(0x1b2733, 0.92).fillRoundedRect(110, 30, 580, 44, 10);
  sc.tSpeed = sc.ho(sc.add.text(590, 560, '0', st('18px', '#f2efe6')).setOrigin(0.5));
  sc.ho(sc.add.text(590, 578, 'km/h', st('11px', '#9aa3ad')).setOrigin(0.5));
  sc.tTop = sc.ho(sc.add.text(W / 2, 52, '', st('20px', '#f2efe6')).setOrigin(0.5));
}

function refreshDash(sc) {
  const p = sc.p;
  const sp = p.v / MAXV;
  sc.wheel.setRotation(p.steer * 1.1);
  const an = Math.PI * (0.8 + sp * 1.4);
  sc.needle.clear().lineStyle(4, 0xe25c3b).lineBetween(0, 0, Math.cos(an) * 44, Math.sin(an) * 44);
  sc.tSpeed.setText(Math.round(sp * 90));
  sc.tTop.setText('612  PLAYA ANCHA');
}

// ---------- Sonido ----------
function audio(sc) {
  const ctx = sc.sound.context;
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function engine(sc) {
  try {
    const ctx = audio(sc);
    if (!ctx || ctx.state !== 'running') return;
    if (!sc.eng) {
      const o = ctx.createOscillator();
      const gn = ctx.createGain();
      o.type = 'sawtooth';
      gn.gain.value = 0.035;
      o.connect(gn);
      gn.connect(ctx.destination);
      o.start();
      sc.eng = o;
      sc.events.once('shutdown', () => o.stop());
    }
    const sp = sc.p.v / MAXV;
    sc.eng.frequency.setTargetAtTime(sc.p.air ? 120 + sp * 160 : 45 + sp * 110, ctx.currentTime, 0.1);
  } catch (e) {
    // sin audio
  }
}

function sfx(sc, type) {
  try {
    const ctx = audio(sc);
    if (!ctx) return;
    const now = ctx.currentTime;
    const tone = (f1, f2, dur, wave, vol, t0 = 0) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = wave;
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.setValueAtTime(f1, now + t0);
      o.frequency.exponentialRampToValueAtTime(f2, now + t0 + dur);
      g.gain.setValueAtTime(vol, now + t0);
      g.gain.exponentialRampToValueAtTime(0.001, now + t0 + dur);
      o.start(now + t0);
      o.stop(now + t0 + dur + 0.02);
    };
    if (type === 'horn') {
      tone(370, 360, 0.35, 'square', 0.08);
      tone(466, 455, 0.35, 'square', 0.08);
    } else if (type === 'pick') tone(660, 1320, 0.09, 'sine', 0.15);
    else if (type === 'crash') tone(220, 40, 0.35, 'sawtooth', 0.2);
    else if (type === 'yelp') tone(1400, 600, 0.15, 'triangle', 0.18);
    else if (type === 'splash') tone(900, 120, 0.25, 'sawtooth', 0.1);
    else if (type === 'scream') [880, 700, 990].forEach((f, i) => tone(f, f * 0.6, 0.18, 'triangle', 0.1, i * 0.07));
  } catch (e) {
    // sin audio disponible
  }
}

// ---------- Controles (del starter) ----------
function createControls(scene) {
  scene.controls = { held: Object.create(null), pressed: Object.create(null) };
  const onKeyDown = (event) => {
    const code = KEYBOARD_TO_ARCADE[normalizeIncomingKey(event.key)];
    if (!code) return;
    if (!scene.controls.held[code]) scene.controls.pressed[code] = true;
    scene.controls.held[code] = true;
  };
  const onKeyUp = (event) => {
    const code = KEYBOARD_TO_ARCADE[normalizeIncomingKey(event.key)];
    if (code) scene.controls.held[code] = false;
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  scene.events.once('shutdown', () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  });
}

function normalizeIncomingKey(key) {
  if (typeof key !== 'string' || key.length === 0) return '';
  if (key === ' ') return 'space';
  return key.toLowerCase();
}
