// Micro Voladora Valpo — prototipo en primera persona (pseudo 3D)
// Vas al volante de una micro bajando los cerros de Valparaíso.

const W = 800;
const H = 600;
const SEG = 200; // largo de cada franja de calle
const RW = 1700; // medio ancho de la calle
const CAMH = 1000; // altura del ojo del chofer
const DEPTH = 0.84; // 1/tan(fov/2), fov ~100°
const DRAW = 110; // franjas visibles
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
// Casas de Valpo: corridas de 2 a 5 franjas por fila, 4 filas por lado subiendo el cerro
const HC = [0xe8c547, 0xc8553d, 0x3a8fb7, 0x4fa38a, 0xe07a5f, 0x8e6bb8, 0xf2e6c9, 0x2f7f9e, 0xd94f70, 0x9bc53d, 0xf29e4c, 0x6fc2d0];
const ROWS = [
  [1.3, 0, 1700, 1500], // [desplazamiento lateral, base, alto mín, alto extra]
  [2.4, 2700, 1400, 1500],
  [3.5, 5200, 1300, 1400],
  [4.6, 7600, 1200, 1400],
];
for (let i = 0; i < N; i++) S[i].w = [];
for (let sd = 0; sd < 2; sd++) {
  for (let r = 0; r < 4; r++) {
    let i = 0;
    while (i < N) {
      const len = 2 + Math.floor(rnd() * 4);
      const gap = rnd() < (r ? 0.04 : 0.1);
      const h = ROWS[r][2] + rnd() * ROWS[r][3];
      const c = HC[Math.floor(rnd() * HC.length)];
      for (let k = 0; k < len && i < N; k++, i++) S[i].w[sd * 4 + r] = gap ? null : [c, h, k];
    }
  }
}
const hash = (k) => {
  const v = Math.sin(k * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};
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
  makeTextures(sc);
  sc.p = { z: 0, x: 0, v: 0, y: 0, vy: 0, air: false, airT: 0, roll: 0, rv: 0, steer: 0, pax: 12 };
  sc.parts = [];
  sc.at = {};
  const put = (o) => ((sc.at[o.i] = sc.at[o.i] || []).push(o), o);
  sc.stops = [0.1, 0.42, 0.75].map((f) => put({ t: 'stop', i: Math.floor(N * f), n: 4, refill: 0 }));
  sc.dogs = [0.22, 0.55, 0.88].map((f, k) => put({ t: 'dog', i: Math.floor(N * f), x: 0, ph: k * 2, gone: 0 }));
  sc.curaos = [0.33, 0.66].map((f) => put({ t: 'curao', i: Math.floor(N * f), gone: 0, cd: 0 }));
  sc.doorT = 0;
  const hint = sc.ho(sc.add.text(W / 2, 110, 'JOYSTICK: ▲ ACELERA  ▼ FRENA  ◄ ► GIRA\nB1 BOCINA   B2 PUERTA (frena en el paradero)', { fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color: '#f2efe6', stroke: '#1b2733', strokeThickness: 5, align: 'center' }).setOrigin(0.5));
  sc.tweens.add({ targets: hint, alpha: 0, delay: 7000, duration: 800 });
  sc.pitch = 0;
  sc.bgX = 0;
  createDash(sc);
}

function update(time, delta) {
  const sc = this;
  const dt = Math.min(delta / 1000, 0.033);
  const pr = sc.controls.pressed;
  updatePlayer(sc, dt, time);
  updateStuff(sc, time);
  sc.cameras.main.setRotation(sc.p.roll);
  render(sc);
  updateParts(sc, dt);
  refreshDash(sc, dt);
  engine(sc);
  for (const k in pr) pr[k] = false;
}

// ---------- Física ----------
// ---------- Paradero, perros y curaos ----------
function updateStuff(sc, t) {
  const p = sc.p;
  const pr = sc.controls.pressed;
  const pi = Math.floor(p.z / SEG);
  const ahead = (i) => ((i - pi) % N + N) % N;
  const sp = p.v / MAXV;
  // bocina
  if (pr.P1_1) {
    sfx(sc, 'horn');
    say(sc, '¡PIIIII!', '#f2efe6');
    for (const d of sc.dogs) if (ahead(d.i) < 35 && t > d.gone) d.gone = t + 8000;
    for (const c of sc.curaos)
      if (ahead(c.i) < 35 && t > c.gone) {
        c.gone = t + 12000;
        p.pax++;
        say(sc, '¡CHUTA! SE SUBIÓ DE VERGÜENZA +1', '#9bc53d');
      }
  }
  // puerta
  p.door = !!sc.controls.held.P1_2;
  if (p.door && !p.air && t > sc.doorT) {
    if (sp > 0.35 && p.pax > 0) {
      sc.doorT = t + 500;
      losePax(sc, 1, '¡CIERRA LA PUERTA!');
    } else if (sp < 0.15) {
      const st = sc.stops.find((o) => (ahead(o.i) < 8 || ahead(o.i) > N - 3) && o.n > 0);
      if (st && p.x > 0.15) {
        st.n--;
        p.pax++;
        sc.doorT = t + 280;
        st.refill = t + 6000;
        sfx(sc, 'pick');
        if (!st.n) say(sc, '¡SUBIERON TODOS!', '#9bc53d');
      }
    }
  }
  for (const st of sc.stops) if (st.n < 4 && t > st.refill) (st.n++, (st.refill = t + 6000));
  // perros cruzando
  for (const d of sc.dogs) {
    d.x = Math.sin(t * 0.0011 + d.ph) * 0.95 * RW;
    if (!p.air && t > d.gone && ahead(d.i) === 0 && Math.abs(p.x * RW - d.x) < 650) {
      d.gone = t + 8000;
      p.v *= 0.45;
      sfx(sc, 'yelp');
      sc.cameras.main.shake(150, 0.01);
      losePax(sc, 1, '¡GUAU! FRENAZO');
    }
  }
  // curao meando: la poza llega a la calle
  for (const c of sc.curaos) {
    const a = ahead(c.i);
    if (!p.air && t > c.gone && t > c.cd && (a < 2 || a > N - 2) && p.x < -0.62) {
      c.cd = t + 3000;
      sfx(sc, 'splash');
      losePax(sc, 1, p.x < -1 ? '¡CASI LO ATROPELLAS!' : '¡PASASTE POR LA POZA!');
    }
  }
  sc.tStop.setText(sc.stops.some((o) => ahead(o.i) < 45 && o.n > 0) ? 'PARADERO ▶ frena y abre la puerta' : '');
}

function updatePlayer(sc, dt) {
  const p = sc.p;
  const hd = sc.controls.held;
  const seg = S[Math.floor(p.z / SEG) % N];
  const sp = p.v / MAXV;
  const st = (hd.P1_R ? 1 : 0) - (hd.P1_L ? 1 : 0);
  p.steer += (st - p.steer) * Math.min(1, dt * 8);

  if (!p.air) {
    if (hd.P1_U) p.v += (MAXV / 3.5) * dt;
    else if (hd.P1_D) p.v -= MAXV * dt;
    else p.v -= (MAXV / 6) * dt;
    // la pendiente ayuda o frena
    const sl = (groundY(p.z + 50) - groundY(p.z - 50)) / 100;
    p.v -= sl * 2200 * dt;
    p.x += p.steer * dt * 2.2 * Math.min(1, sp * 1.6 + 0.15) * (p.v > 30 ? 1 : 0);
    p.x -= sp * sp * seg.c * dt * 0.35; // fuerza centrífuga
    if (Math.abs(p.x) > 1.05) p.v -= p.v * 1.6 * dt; // por la vereda
  }
  p.x = Phaser.Math.Clamp(p.x, -1.25, 1.25);
  p.v = Phaser.Math.Clamp(p.v, 0, MAXV);
  p.z += p.v * dt;

  // vertical: la micro sigue el suelo hasta que el suelo cae más rápido que la gravedad
  const gy = groundY(p.z);
  if (p.air) {
    p.airT += dt;
    p.vy -= GRAV * dt;
    p.y += p.vy * dt;
    p.rv += (Math.random() - 0.5) * 4 * dt;
    p.roll += (p.rv + p.steer * 1.4) * dt;
    p.x += p.steer * dt * 0.5;
    p.roll = Phaser.Math.Clamp(p.roll, -0.7, 0.7);
    if (p.y <= gy) land(sc, p, gy);
  } else {
    const by = p.y + p.vy * dt - GRAV * dt * dt;
    if (gy < by - 5 && p.v > MAXV * 0.3) {
      p.air = true;
      p.airT = 0;
      p.y = by;
      p.vy -= GRAV * dt;
      p.rv = (Math.random() - 0.5) * 0.9 - seg.c * 0.12 - p.steer * 0.3;
      sfx(sc, 'whoosh');
    } else {
      p.vy = dt > 0 ? (gy - p.y) / dt : 0;
      p.y = gy;
      p.roll += (-seg.c * sp * 0.03 - p.roll) * Math.min(1, dt * 6);
    }
  }
  // el horizonte cae al despegar y la nariz baja al caer
  const tp = p.air ? Phaser.Math.Clamp(45 + p.vy * 0.004, -50, 110) : 0;
  sc.pitch += (tp - sc.pitch) * Math.min(1, dt * 5);
}

function land(sc, p, gy) {
  const hit = Math.max(0, -p.vy);
  const r = Math.abs(p.roll);
  p.air = false;
  p.y = gy;
  p.vy = 0;
  const k = Math.min(0.035, 0.006 + hit / 400000);
  sc.cameras.main.shake(260, k);
  sc.hud.shake(260, k * 0.5);
  sc.pitch -= Math.min(70, hit * 0.005);
  sfx(sc, 'thud');
  if (r > 0.42) {
    p.v *= 0.35;
    losePax(sc, Math.max(2, Math.ceil(p.pax * 0.4)), '¡CASI SE DA VUELTA!');
  } else if (r > 0.17) {
    p.v *= 0.75;
    losePax(sc, Math.max(1, Math.ceil(p.pax * 0.15)), '¡PUCHA, ATERRIZÓ CHUECO!');
  } else if (Math.abs(p.x) > 1.05) {
    losePax(sc, 1, '¡A LA VEREDA!');
  } else if (p.airT > 0.5) {
    say(sc, '¡VOLANDO! ' + p.airT.toFixed(1) + ' s', '#e8c547');
    sfx(sc, 'pick');
  }
  p.roll *= 0.3;
}

function losePax(sc, n, msg) {
  const p = sc.p;
  const k = Math.min(n, p.pax);
  p.pax -= k;
  say(sc, msg + (k ? '  -' + k : ''), '#ff7b5c');
  if (k) sfx(sc, 'scream');
  for (let j = 0; j < k; j++) {
    const s = sc.ho(sc.add.image(200 + Math.random() * 400, 470, 'pax' + (j % 3)).setScale(2.2).setDepth(5));
    sc.parts.push({ s, vx: (Math.random() - 0.5) * 500, vy: -500 - Math.random() * 300, vr: (Math.random() - 0.5) * 10, life: 1.6 });
  }
}

function updateParts(sc, dt) {
  sc.parts = sc.parts.filter((o) => {
    o.life -= dt;
    o.vy += 1400 * dt;
    o.s.x += o.vx * dt;
    o.s.y += o.vy * dt;
    o.s.rotation += o.vr * dt;
    if (o.life > 0) return true;
    o.s.destroy();
    return false;
  });
}

function say(sc, txt, col) {
  const t = sc.ho(sc.add.text(W / 2, 150, txt, { fontFamily: 'monospace', fontSize: '28px', fontStyle: 'bold', color: col, stroke: '#1b2733', strokeThickness: 6 }).setOrigin(0.5).setDepth(6));
  sc.tweens.add({ targets: t, y: 90, alpha: 0, delay: 500, duration: 1100, onComplete: () => t.destroy() });
}

function makeTextures(sc) {
  const g = sc.make.graphics({ add: false });
  [0x3a6ea5, 0xc8553d, 0x4f9d69].forEach((c, i) => {
    g.clear();
    g.fillStyle(0xe0b48a).fillCircle(6, 5, 5);
    g.fillStyle(c).fillRect(1, 10, 10, 10);
    g.fillStyle(0x2a2a2a).fillRect(1, 20, 4, 6).fillRect(7, 20, 4, 6);
    g.generateTexture('pax' + i, 12, 26);
  });
  g.destroy();
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

  drawBay(g, cy, sc.bgX);

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
  let pr = null;
  let pl = null;
  for (let k = L.length - 1; k >= 1; k--) {
    const { i, a, b } = L[k];
    const alt = i & 1;
    if (b.y < a.y) {
      g.fillStyle(0x6f6a5e).fillRect(-300, b.y, W + 600, a.y - b.y + 1);
      quad(g, a, b, 1.3, (i >> 1) & 1 ? 0x9c968c : 0xa8a297); // vereda
      quad(g, a, b, 1.07, (i >> 1) & 1 ? 0xe8c547 : 0x46423e); // solera pintada
      quad(g, a, b, 1, alt ? 0x5b5650 : 0x67615a); // adoquines
    }
    // casas: de la fila más alta a la de la vereda
    for (let r = 3; r >= 0; r--) {
      for (let sd = 0; sd < 2; sd++) {
        const hs = S[i].w[sd * 4 + r];
        if (hs) wall(g, a, b, (sd ? -1 : 1) * ROWS[r][0] * RW, ROWS[r][1], hs, r);
      }
    }
    for (const o of sc.at[i] || []) drawObj(g, a, o, sc.time.now);
    // postes con cables, cada 5 franjas
    if (i % 5 === 0) {
      const tr = post(g, a, 1.17 * RW);
      const tl = post(g, a, -1.17 * RW);
      const lw = Math.max(1, a.s * 14);
      g.lineStyle(lw, 0x1d1f22, 0.9);
      if (pr) g.lineBetween(tr.x, tr.y, pr.x, pr.y).lineBetween(tr.x, tr.y + a.s * 260, pr.x, pr.y + pr.s * 260);
      if (pl) g.lineBetween(tl.x, tl.y, pl.x, pl.y).lineBetween(tl.x, tl.y + a.s * 180, pl.x, pl.y + pl.s * 380);
      const my = (tr.y + tl.y) / 2 + a.s * 500;
      g.lineBetween(tr.x, tr.y, W / 2 + (tr.x + tl.x - W) / 2, my).lineBetween(W / 2 + (tr.x + tl.x - W) / 2, my, tl.x, tl.y);
      if (i % 10 === 0 && pl) g.lineBetween(tr.x, tr.y + a.s * 120, pl.x, pl.y + pl.s * 300);
      pr = tr;
      pl = tl;
    }
  }
}

function person(g, a, ox, col) {
  const x = a.x + a.s * ox;
  g.fillStyle(0x2a2a2a).fillRect(x - a.s * 45, a.y - a.s * 260, a.s * 90, a.s * 260);
  g.fillStyle(col).fillRect(x - a.s * 60, a.y - a.s * 560, a.s * 120, a.s * 320);
  g.fillStyle(0xe0b48a).fillCircle(x, a.y - a.s * 640, a.s * 75);
}

function drawObj(g, a, o, t) {
  const s = a.s;
  if (o.t === 'stop') {
    const x = a.x + s * 1.06 * RW;
    g.fillStyle(0x3d4247).fillRect(x, a.y - s * 1500, s * 50, s * 1500).fillRect(x + s * 700, a.y - s * 1500, s * 50, s * 1500);
    g.fillStyle(0x2f7f9e).fillRect(x - s * 80, a.y - s * 1600, s * 900, s * 140);
    g.fillStyle(0x1565c0).fillRect(x - s * 380, a.y - s * 2100, s * 320, s * 320);
    g.fillStyle(0xffffff).fillRect(x - s * 300, a.y - s * 2000, s * 160, s * 40).fillRect(x - s * 300, a.y - s * 1920, s * 110, s * 40);
    for (let k = 0; k < o.n; k++) person(g, a, 1.12 * RW + k * 170, HC[k * 3 % HC.length]);
  } else if (o.t === 'dog' && t > o.gone) {
    const x = a.x + s * o.x;
    g.fillStyle(0x8b5a2b).fillEllipse(x, a.y - s * 230, s * 420, s * 170);
    g.fillCircle(x + s * 230 * Math.sign(Math.cos(t * 0.0011 + o.ph)), a.y - s * 330, s * 85);
    g.fillStyle(0x5a3a1a).fillRect(x - s * 150, a.y - s * 200, s * 40, s * 200).fillRect(x + s * 110, a.y - s * 200, s * 40, s * 200);
  } else if (o.t === 'curao' && t > o.gone) {
    g.fillStyle(0xf2d43a, 0.85).fillEllipse(a.x - s * 0.98 * RW, a.y, s * 900, s * 90);
    person(g, a, -1.18 * RW, 0x6d6d6d);
    const x = a.x - s * 1.15 * RW;
    g.lineStyle(Math.max(1, s * 30), 0xf2d43a).lineBetween(x, a.y - s * 300, x + s * 120 + Math.sin(t * 0.03) * s * 15, a.y);
  }
}

// Fachada pegada a la calle (paralela), con techo de zinc y ventanas en la primera fila
function wall(g, a, b, ox, by, hs, r) {
  const [c, h, k] = hs;
  const x1 = a.x + a.s * ox;
  const x2 = b.x + b.s * ox;
  if ((x1 < -300 && x2 < -300) || (x1 > W + 300 && x2 > W + 300)) return;
  const y1 = a.y - a.s * by;
  const y2 = b.y - b.s * by;
  const t1 = y1 - a.s * h;
  const t2 = y2 - b.s * h;
  g.fillStyle(c);
  g.fillPoints([{ x: x1, y: y1 }, { x: x2, y: y2 }, { x: x2, y: t2 }, { x: x1, y: t1 }], true);
  const rf = 0.12;
  g.fillStyle(0x50565c);
  g.fillPoints([{ x: x1, y: t1 + (y1 - t1) * rf }, { x: x2, y: t2 + (y2 - t2) * rf }, { x: x2, y: t2 }, { x: x1, y: t1 }], true);
  if (r === 0 && k % 2 === 0 && a.s > 0.02) {
    const lx = (u) => x1 + (x2 - x1) * u;
    const ly = (u, v) => t1 + (t2 - t1) * u + ((y1 + (y2 - y1) * u) - (t1 + (t2 - t1) * u)) * v;
    g.fillStyle(0x243746);
    g.fillPoints([{ x: lx(0.25), y: ly(0.25, 0.3) }, { x: lx(0.75), y: ly(0.75, 0.3) }, { x: lx(0.75), y: ly(0.75, 0.55) }, { x: lx(0.25), y: ly(0.25, 0.55) }], true);
  }
}

function post(g, a, ox) {
  const x = a.x + a.s * ox;
  const hgt = a.s * 2900;
  g.fillStyle(0x5a4632).fillRect(x - a.s * 35, a.y - hgt, a.s * 70, hgt);
  g.fillStyle(0x2b2b2b).fillRect(x - a.s * 160, a.y - hgt, a.s * 320, a.s * 40);
  return { x, y: a.y - hgt, s: a.s };
}

// La bahía: cielo gris celeste, mar, grúas del puerto, barcos y los cerros del frente llenos de casas
function drawBay(g, cy, bx) {
  g.fillGradientStyle(0x93aabb, 0x93aabb, 0xdde5ea, 0xdde5ea).fillRect(-300, -300, W + 600, cy + 300);
  g.fillStyle(0x2d6f9e).fillRect(-300, cy, W + 600, H + 300 - cy);
  g.fillStyle(0x6a9cbf).fillRect(-300, cy, W + 600, 4);
  // barcos y grúas
  for (let k = 0; k < 5; k++) {
    const x = ((k * 230 - bx * 0.6) % 1150 + 1150) % 1150 - 175;
    g.fillStyle(0x3b3f45).fillRect(x, cy + 6, 46, 7);
    g.fillStyle(k % 2 ? 0xc8553d : 0x3a8fb7).fillRect(x + 6, cy + 1, 26, 5);
    g.lineStyle(2, 0xd9772b).lineBetween(x + 60, cy + 12, x + 60, cy - 26).lineBetween(x + 50, cy - 24, x + 84, cy - 24);
  }
  // cerros del frente
  const hy = (x) => cy + 10 - Math.max(0, 62 * Math.sin(x / 190) + 38 * Math.sin(x / 71) + 28);
  g.fillStyle(0x7d7a6e);
  g.beginPath();
  g.moveTo(-300, cy + 12);
  for (let x = -300; x <= W + 300; x += 12) g.lineTo(x, hy(x + bx));
  g.lineTo(W + 300, cy + 12);
  g.closePath();
  g.fillPath();
  for (let x = -300; x <= W + 300; x += 7) {
    const q = Math.floor((x + bx) / 7);
    const top = hy(q * 7);
    for (let j = 0; j < 4; j++) {
      const hh = hash(q * 7.13 + j);
      const y = top + 2 + hh * (cy + 8 - top);
      if (y < cy + 6 && hash(q + j * 31.7) < 0.75) g.fillStyle(HC[Math.floor(hh * 1000) % HC.length]).fillRect(q * 7 - bx, y, 5, 4);
    }
  }
  g.fillStyle(0xffffff, 0.18).fillRect(-300, cy - 70, W + 600, 50);
}

// ---------- Tablero ----------
function createDash(sc) {
  const d = sc.ho(sc.add.graphics());
  // marco del parabrisas
  d.fillStyle(0x1f2226);
  d.fillRect(0, 0, W, 22);
  sc.ho(sc.add.text(W / 2, 11, '612  PLAYA ANCHA - CERRO ALEGRE', { fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: '#ffb000' }).setOrigin(0.5));
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
  sc.door = sc.ho(sc.add.graphics());
  sc.ho(sc.add.text(470, 560, 'PUERTA', st('11px', '#9aa3ad')).setOrigin(0.5));
  sc.tStop = sc.ho(sc.add.text(W / 2, 92, '', st('16px', '#e8c547')).setOrigin(0.5));
  sc.tTop = sc.ho(sc.add.text(W / 2, 52, '', st('20px', '#f2efe6')).setOrigin(0.5));
}

function refreshDash(sc) {
  const p = sc.p;
  const sp = p.v / MAXV;
  sc.wheel.setRotation(p.steer * 1.1);
  sc.door.clear().fillStyle(p.door ? 0x7cfc00 : 0x3a3e45).fillCircle(470, 535, 13);
  const an = Math.PI * (0.8 + sp * 1.4);
  sc.needle.clear().lineStyle(4, 0xe25c3b).lineBetween(0, 0, Math.cos(an) * 44, Math.sin(an) * 44);
  sc.tSpeed.setText(Math.round(sp * 90));
  sc.tTop.setText('PASAJEROS ' + p.pax + '     ' + Math.floor(p.z / 100) + ' m');
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
    else if (type === 'thud') tone(140, 35, 0.3, 'sine', 0.35);
    else if (type === 'whoosh') tone(300, 900, 0.4, 'triangle', 0.05);
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
