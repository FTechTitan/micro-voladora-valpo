// Micro Voladora Valpo — LA RUTA: Aduana → Reñaca
// Vas al volante de una micro troncal. Llega al Sector 5 de Reñaca antes de que te pillen
// los pacos y sin quedarte sin pasajeros. Cada tramo es un lugar real de la ruta.

const W = 800;
const H = 600;
const SEG = 200; // largo de cada franja de calle
const RW = 1700; // medio ancho de la calle
const CAMH = 1000; // altura del ojo del chofer
const DEPTH = 0.84; // 1/tan(fov/2), fov ~100°
const DRAW = 110; // franjas visibles
const HOR = 250; // altura del horizonte en pantalla
const MAXV = SEG * 60;
const GRAV = 15000;
const BACK = 2400; // distancia de la cámara detrás de la micro

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

// ---------- Colores ----------
const mix = (a, b, f) => {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * f);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * f);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * f);
  return ((r | 0) << 16) | ((g | 0) << 8) | (bl | 0);
};
const NIGHT = 0x121a2a;

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
function addGap(n) {
  for (let i = 0; i < n; i++) S.push({ c: 0, y: lastY, sea: 1 });
}
// Tramos de la ruta real: cada uno termina en un lugar icónico.
// [nombre, cielo arriba, cielo abajo, mar, noche 0..1, piezas [entrada, tramo, salida, curva, desnivel]]
const T = [];
function tramo(n, sky, bot, sea, nt, pieces) {
  const i0 = S.length;
  pieces.forEach((r) => (r[0] === 'MAR' ? addGap(r[1]) : addRoad(...r)));
  for (let i = i0; i < S.length; i++) S[i].tr = T.length;
  T.push({ n, sky, bot, sea, nt, i0, i1: S.length });
}
tramo('CONGRESO NACIONAL', 0x93aabb, 0xdde5ea, 0x2d6f9e, 0, [
  [10, 50, 10, 0, 0],
  [20, 30, 20, 2, 500],
  [10, 8, 6, 0, 2200],
  [3, 3, 3, 0, -1900],
  [20, 40, 20, -3, -800],
  [10, 30, 10, 0, 0],
  [15, 15, 10, 2, 2400],
  [3, 4, 3, 0, -2200],
  [10, 30, 10, -1, -200],
]);
tramo('CALETA PORTALES', 0x93aabb, 0xdde5ea, 0x2d6f9e, 0, [
  [10, 30, 10, 0, 0],
  [25, 25, 25, -2, 1600],
  [10, 8, 6, 0, 3000],
  [3, 3, 3, 0, -2600],
  [20, 30, 20, 3, -1500],
  [10, 40, 10, 0, 0],
  [8, 6, 5, 0, 2600],
  [3, 3, 3, 0, -2400],
  [20, 30, 20, 1, -700],
]);
tramo('U. SANTA MARÍA', 0x8db4cc, 0xe3ecf1, 0x2d6f9e, 0, [
  [10, 30, 10, 0, 0],
  [15, 15, 10, -3, 2800],
  [3, 4, 3, 2, -2400],
  [10, 6, 5, 0, 2600],
  [3, 3, 3, 0, -2200],
  [20, 20, 20, -4, 900],
  [20, 30, 20, 4, -1200],
  [10, 40, 10, 0, 0],
  [10, 8, 4, 0, 1600],
  ['MAR', 9], // Recreo: el acantilado, la calle se corta sobre el mar
  [10, 20, 10, 0, -800],
]);
tramo('CALETA ABARCA', 0x7fb2d6, 0xeaf2f6, 0x2a7fb0, 0, [
  [10, 40, 10, 0, 0],
  [20, 30, 20, 2, 1200],
  [10, 8, 6, 0, 3400],
  [3, 3, 3, -1, -2800],
  [25, 25, 25, -3, -1000],
  [10, 40, 10, 0, 0],
  [8, 6, 5, 2, 2400],
  [3, 3, 3, 0, -2400],
  [15, 30, 15, 0, 200],
]);
tramo('SHERATON MIRAMAR', 0xd98a5a, 0xf2c27a, 0x3a5f8a, 0.45, [
  [10, 30, 10, 0, 0],
  [25, 25, 25, 3, 1500],
  [10, 8, 6, 0, 3600],
  [3, 3, 3, 0, -3000],
  [20, 40, 20, -3, -1200],
  [10, 30, 10, 0, 0],
  [10, 6, 5, 1, 2800],
  [3, 3, 3, 0, -2600],
  [15, 30, 15, 0, -200],
]);
tramo('QUINTA VERGARA', 0x0b1230, 0x22365a, 0x0f2a44, 0.85, [
  [10, 30, 10, 0, 0],
  [20, 30, 20, -3, 1800],
  [10, 8, 6, 0, 3800],
  [3, 3, 3, 1, -3200],
  [20, 30, 20, 4, -1600],
  [10, 30, 10, 0, 0],
  [8, 6, 5, -2, 3000],
  [3, 3, 3, 0, -2800],
  [15, 30, 15, 0, -400],
]);
tramo('REÑACA · SECTOR 5', 0x070b1e, 0x1a2648, 0x0c2238, 1, [
  [10, 30, 10, 0, 0],
  [25, 25, 25, 2, 2000],
  [10, 8, 6, 0, 4200],
  [3, 3, 3, 0, -3600],
  [20, 40, 20, -4, -1800],
  [10, 30, 10, 0, 0],
  [8, 6, 5, 3, 3200],
  [3, 3, 3, 0, -3000],
  [20, 30, 20, 0, -600],
  [10, 60, 10, 0, 0], // la playa, recta hasta la meta
]);
const FIN = S.length - 30; // meta: el letrero del Sector 5
addRoad(10, 180, 10, 0, 0); // relleno para que el horizonte no se acabe
for (let i = FIN; i < S.length; i++) S[i].tr = T.length - 1;
const N = S.length;
const trOf = (i) => T[S[Math.min(i, N - 1)].tr];
// Casas de Valpo: corridas de 2 a 5 franjas por fila, 4 filas por lado subiendo el cerro.
// En Viña son más altas y blancas; de noche, oscuras con ventanas prendidas.
const HC = [0xe8c547, 0xc8553d, 0x3a8fb7, 0x4fa38a, 0xe07a5f, 0x8e6bb8, 0xf2e6c9, 0x2f7f9e, 0xd94f70, 0x9bc53d, 0xf29e4c, 0x6fc2d0];
const VC = [0xf2efe6, 0xe8e2d4, 0xdfe6ea, 0xf6f1e3, 0xcfd8dd];
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
      const tr = trOf(i);
      const vina = S[i].tr >= 3;
      const h = (ROWS[r][2] + rnd() * ROWS[r][3]) * (vina ? 1.5 : 1);
      const c0 = vina ? VC[Math.floor(rnd() * VC.length)] : HC[Math.floor(rnd() * HC.length)];
      const c = mix(c0, NIGHT, tr.nt * 0.8);
      for (let k = 0; k < len && i < N; k++, i++) S[i].w[sd * 4 + r] = gap ? null : [c, h, k, tr.nt];
    }
  }
}
// playa a la izquierda (lado del mar) en los tramos costeros: sin casas, arena y mar
const clearSide = (i0, i1, sd, sand) => {
  for (let i = Math.max(0, i0); i < Math.min(N, i1); i++) {
    for (let r = 0; r < 4; r++) S[i].w[sd * 4 + r] = null;
    if (sand) S[i].sl = sand;
  }
};
const fr = (k, f) => Math.floor(T[k].i0 + (T[k].i1 - T[k].i0) * f);
clearSide(0, 60, 1, 2); // el puerto: grúas al lado del mar
clearSide(fr(1, 0.55), T[1].i1 + 10, 1, 1); // Portales
clearSide(fr(3, 0.5), T[3].i1 + 10, 1, 1); // Caleta Abarca
clearSide(fr(4, 0.6), T[4].i1 + 10, 1, 2); // Sheraton: roquerío
clearSide(fr(6, 0.45), N, 1, 1); // Reñaca
// el mirador: sin casas antes del corte, para ver la bahía
for (let i = 0; i < N; i++) if (S[i].sea) for (let j = i - 8; j <= i; j++) S[(j + N) % N].w = [];
const hash = (k) => {
  const v = Math.sin(k * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};
const groundY = (z) => {
  const i = Math.floor(z / SEG);
  const yy = (j) => S[j].y - (S[j].sea ? 6000 : 0);
  const a = yy(((i % N) + N) % N);
  const b = yy((((i + 1) % N) + N) % N);
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
  sc.p = { z: 3000, x: 0, v: 0, y: 0, vy: 0, air: false, airT: 0, roll: 0, rv: 0, steer: 0, pax: 25, jk: -9000 };
  sc.parts = [];
  sc.fw = [];
  sc.at = {};
  const put = (o) => ((sc.at[o.i] = sc.at[o.i] || []).push(o), o);
  // hitos al final de cada tramo (lado: 1 derecha/cerro, -1 izquierda/mar). La Aduana en la partida.
  const land = (i, id, sd) => (put({ t: 'land', i, id, sd }), clearSide(i - 14, i + 5, sd > 0 ? 0 : 1, 0));
  land(18, 0, 1);
  [1, -1, 1, 1, -1, 1, 1].forEach((sd, k) => land(T[k].i1 - (k === 2 ? 80 : 22), k + 1, sd)); // la Santa María va antes del acantilado de Recreo
  // edificios escalonados de Reñaca, repetidos
  for (let i = fr(6, 0.5); i < FIN - 30; i += 34) land(i, 8, 1);
  put({ t: 'meta', i: FIN });
  for (let i = 8; i < 60; i += 12) put({ t: 'grua', i, sd: -1 });
  // paraderos: uno por tramo, con su gente
  const stop = (k, f, n, pay, col, name) => put({ t: 'stop', i: fr(k, f), n, max: n, pay, col, name, refill: 0 });
  sc.stops = [
    stop(0, 0.42, 6, 700, HC, ''),
    stop(1, 0.3, 6, 700, HC, ''),
    stop(2, 0.5, 12, 300, [0x1b2733, 0x3a3a3a, 0x2f7f9e, 0xc8553d], '¡ESTUDIANTES! pagan $300 c/u'),
    stop(3, 0.3, 6, 700, [0xff7f50, 0x2d6bff, 0xffd23f, 0x9bc53d], ''),
    stop(4, 0.3, 1, 5000, [0x1b1b1b], '¡ARTISTA DEL FESTIVAL! paga $5.000'),
    stop(5, 0.45, 8, 700, [0xd94f70, 0xffd23f, 0x6fc2d0, 0xf29e4c], '¡FANS DEL FESTIVAL!'),
    stop(6, 0.28, 3, 700, [0xf2efe6, 0xf2efe6], 'cuicos: a lo mejor suben'),
  ];
  const many = (k, fs, mk) => fs.forEach((f, j) => put(mk(fr(k, f), j)));
  // obstáculos con identidad por tramo
  many(0, [0.2, 0.62, 0.8], (i, j) => ({ t: 'truck', i, x: [-0.55, 0.55, 0][j] * RW }));
  many(0, [0.3, 0.72], (i, j) => ({ t: 'dog', i, x: 0, ph: j * 2, gone: 0 }));
  many(1, [0.06, 0.12, 0.18], (i, j) => ({ t: 'pol', i, x: 0, ph: j * 1.3, gone: 0 }));
  many(1, [0.62, 0.74, 0.86], (i, j) => ({ t: 'lobo', i, x: [-0.5, 0.45, -0.1][j] * RW, ph: j }));
  many(1, [0.4, 0.5, 0.9], (i, j) => ({ t: 'peli', i, x: [-0.3, 0.4, 0][j] * RW, h: 1900, ph: j * 2 }));
  many(2, [0.2, 0.35, 0.8], (i, j) => ({ t: 'dog', i, x: 0, ph: j * 2.4 + 1, gone: 0 }));
  many(2, [0.62], (i) => ({ t: 'drunk', i, x: 0, ph: 1.1, gone: 0, mech: 1 }));
  many(2, [0.9], (i) => ({ t: 'peli', i, x: 0, h: 2300, ph: 1 }));
  many(3, [0.15, 0.5, 0.65, 0.85], (i, j) => ({ t: 'ban', i, x: 0, ph: j * 1.9, gone: 0 }));
  many(3, [0.4], (i) => ({ t: 'curao', i, gone: 0, cd: 0 }));
  many(4, [0.15, 0.5, 0.7], (i, j) => ({ t: 'ban', i, x: 0, ph: j * 2.2 + 0.5, gone: 0 }));
  many(4, [0.85], (i, j) => ({ t: 'dog', i, x: 0, ph: 3, gone: 0 }));
  many(5, [0.15, 0.3, 0.7, 0.85], (i, j) => ({ t: 'drunk', i, x: 0, ph: j * 1.7, gone: 0 }));
  many(5, [0.6], (i) => ({ t: 'curao', i, gone: 0, cd: 0 }));
  many(6, [0.12, 0.4, 0.55, 0.7, 0.82], (i, j) => ({ t: 'cuico', i, x: 0, ph: j * 1.4, gone: 0 }));
  many(6, [0.25], (i) => ({ t: 'dog', i, x: 0, ph: 5, gone: 0 }));
  sc.objs = Object.values(sc.at).flat();
  sc.by = (t) => sc.objs.filter((o) => o.t === t);
  sc.dogs = sc.by('dog');
  sc.curaos = sc.by('curao');
  // monedas: filas en una pista de la calle, y en el aire sobre el mar y las bajadas fuertes
  sc.coins = [];
  for (let i = 20; i < FIN - 5; i += 19) {
    const x = [-0.6, 0, 0.6][Math.floor(hash(i) * 3)];
    for (let k = 0; k < 5; k++) if (!S[i + k].sea) sc.coins.push(put({ t: 'coin', i: i + k, x, h: 450 }));
  }
  for (let i = 1; i < FIN - 1; i++) if (S[i].sea || (S[i + 1].y - S[i].y < -150 && i % 2)) sc.coins.push(put({ t: 'coin', i, x: 0, h: S[i].sea ? 2200 : 1600, air: 1 }));
  sc.paco = { d: 20000 };
  sc.cash = 0;
  sc.over = 0;
  sc.win = 0;
  sc.doorK = 0;
  sc.t0 = 0;
  sc.doorT = 0;
  sc.req = null;
  sc.reqT = 0;
  sc.tr = -1;
  sc.sky = { a: T[0].sky, b: T[0].bot, m: T[0].sea, n: 0 };
  const hint = sc.ho(sc.add.text(W / 2, 250, 'JOYSTICK: ▲ ACELERA  ▼ FRENA  ◄ ► GIRA\nB1 SALTO   B2 PUERTA   B3 BOCINA\n\nLLEGA A REÑACA ANTES QUE TE PILLEN LOS PACOS.\nSIN PASAJEROS NO HAY MICRO: ¡ATERRIZA DERECHO!', { fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color: '#f2efe6', stroke: '#1b2733', strokeThickness: 5, align: 'center' }).setOrigin(0.5).setDepth(7));
  sc.tweens.add({ targets: hint, alpha: 0, delay: 7000, duration: 800 });
  sc.pitch = 0;
  sc.bgX = 0;
  sc.camY = CAMH;
  sc.bus = makeBus(sc);
  createDash(sc);
  setView(sc, true);
}

function update(time, delta) {
  const sc = this;
  const dt = Math.min(delta / 1000, 0.033);
  sc.now = time;
  const pr = sc.controls.pressed;
  if (sc.over || sc.win) {
    if (time > (sc.over || sc.win) + 1500 && (pr.START1 || pr.P1_1)) sc.scene.restart();
    if (sc.win) {
      sc.p.v *= 1 - 1.5 * dt;
      sc.p.z += sc.p.v * dt;
      sc.p.y = groundY(sc.p.z);
    }
  } else {
    updatePlayer(sc, dt, time);
    updateStuff(sc, time, dt);
  }
  sc.doorK += ((sc.p.door ? 1 : 0) - sc.doorK) * Math.min(1, dt * 9);
  if (pr.P1_4) setView(sc, !sc.chase);
  sc.cameras.main.setRotation(sc.p.roll * (sc.chase ? 0.25 : 1));
  updateSky(sc, dt, time);
  render(sc);
  updateParts(sc, dt);
  refreshDash(sc, dt);
  engine(sc);
  for (const k in pr) pr[k] = false;
}

// cielo, mar y noche se van acercando al color del tramo en que vas
function updateSky(sc, dt, t) {
  const tr = trOf(Math.floor(sc.p.z / SEG));
  const f = Math.min(1, dt * 0.7);
  const k = sc.sky;
  k.a = mix(k.a, tr.sky, f);
  k.b = mix(k.b, tr.bot, f);
  k.m = mix(k.m, tr.sea, f);
  k.n += (tr.nt - k.n) * f;
  // fuegos artificiales: en el último tramo mientras manejas, y a lo loco al llegar
  const fire = sc.win ? 220 : S[Math.min(N - 1, Math.floor(sc.p.z / SEG))].tr === 6 ? 900 : 0;
  if (fire && t > (sc.fwT || 0)) {
    sc.fwT = t + fire;
    sc.fw.push({ x: 80 + Math.random() * (W - 160), y: HOR + 40, vy: -(320 + Math.random() * 200), ty: 40 + Math.random() * 130, c: [0xff3b3b, 0xffd23f, 0x7cfc00, 0xffffff, 0xc86bff, 0x3ad0ff][Math.floor(Math.random() * 6)], sp: null });
  }
  sc.fw = sc.fw.filter((r) => {
    if (!r.sp) {
      r.y += r.vy * dt;
      r.x += Math.sin(r.y * 0.05) * 20 * dt;
      if (r.y < r.ty) {
        r.sp = [];
        for (let j = 0; j < 22; j++) {
          const an = (j / 22) * Math.PI * 2;
          const sp = 90 + Math.random() * 90;
          r.sp.push({ x: r.x, y: r.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, l: 1 });
        }
        if (Math.random() < 0.5) sfx(sc, 'boom');
      }
      return true;
    }
    let alive = false;
    for (const s of r.sp) {
      s.l -= dt * 0.8;
      s.vy += 60 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.l > 0) alive = true;
    }
    return alive;
  });
}

// ---------- Paradero, obstáculos, pacos ----------
function updateStuff(sc, t, dt) {
  const p = sc.p;
  const pr = sc.controls.pressed;
  const pi = Math.floor(p.z / SEG);
  const ahead = (i) => i - pi;
  const sp = p.v / MAXV;
  const near = (o, w) => !p.air && ahead(o.i) === 0 && Math.abs(p.x * RW - o.x) < w;
  // entrar a un tramo nuevo
  const tr = S[Math.min(pi, N - 1)].tr;
  if (tr !== sc.tr) {
    sc.tr = tr;
    if (tr > 0) {
      sfx(sc, 'bell');
      say(sc, '▶ ' + T[tr].n, '#6fc2d0');
      sc.cash += 500;
    }
  }
  if (pi >= FIN) return winGame(sc, t);
  // bocina (B3): espanta perros, avergüenza curaos
  if (pr.P1_3) {
    sfx(sc, 'horn');
    say(sc, '¡PIIIII!', '#f2efe6');
    for (const d of sc.dogs) if (ahead(d.i) < 35 && ahead(d.i) >= 0 && t > d.gone) d.gone = t + 8000;
    for (const c of sc.curaos)
      if (ahead(c.i) < 35 && ahead(c.i) >= 0 && t > c.gone) {
        c.gone = t + 12000;
        p.pax++;
        say(sc, '¡CHUTA! SE SUBIÓ DE VERGÜENZA +1', '#9bc53d');
      }
  }
  // salto (B1): en el suelo y con velocidad, la micro pega el brinco; en el aire marca el timing del aterrizaje
  if (pr.P1_1) {
    p.jk = t;
    if (!p.air && sp > 0.22 && !S[pi % N].sea) {
      p.air = true;
      p.airT = 0;
      p.vy = 2300 + p.v * 0.16;
      p.rv = (Math.random() - 0.5) * 0.4 - p.steer * 0.3;
      sfx(sc, 'whoosh');
    }
  }
  // puerta (B2)
  if (pr.P1_2) {
    p.door = !p.door;
    sfx(sc, 'door');
  }
  if (p.door && !p.air && t > sc.doorT) {
    if (sp > 0.35 && p.pax > 0) {
      sc.doorT = t + 500;
      losePax(sc, 1, '¡CIERRA LA PUERTA!');
    } else if (sp < 0.15) {
      const st = sc.stops.find((o) => ahead(o.i) < 8 && ahead(o.i) > -3 && o.n > 0);
      if (st && p.x > 0.15) {
        st.n--;
        p.pax++;
        sc.cash += st.pay;
        sc.doorT = t + (st.pay > 1000 ? 600 : 280);
        st.refill = t + 6000;
        sfx(sc, 'pick');
        say(sc, '+$' + st.pay, '#9bc53d');
        if (!st.n) say(sc, st.pay > 1000 ? '¡SUBIÓ EL ARTISTA! ¡QUÉ FACHA!' : '¡SUBIERON TODOS!', '#9bc53d');
      }
    }
  }
  for (const st of sc.stops) if (st.n < st.max && st.max > 1 && t > st.refill) (st.n++, (st.refill = t + 3000));
  const hit = (o, vk, n, msg, snd, shake) => {
    o.gone = t + 9000;
    p.v *= vk;
    sfx(sc, snd || 'crash');
    sc.cameras.main.shake(200, shake || 0.015);
    if (n) losePax(sc, n, msg);
    else say(sc, msg, '#ff7b5c');
  };
  for (const o of sc.objs) {
    const a = ahead(o.i);
    if (a < -2 || a > 1 || t < (o.gone || 0)) continue;
    if (o.t === 'dog') {
      o.x = Math.sin(t * 0.0011 + o.ph) * 0.95 * RW;
      if (near(o, 650)) hit(o, 0.45, 1, '¡GUAU! FRENAZO', 'yelp', 0.01);
    } else if (o.t === 'drunk') {
      o.x = Math.sin(t * 0.0005 + o.ph) * 0.85 * RW + Math.sin(t * 0.004 + o.ph) * 0.12 * RW;
      if (near(o, 600)) hit(o, 0.35, 2, o.mech ? '¡EL MECHÓN SE TIRÓ AL CAPÓ!' : '¡EL CURAO SE TIRÓ AL CAPÓ!');
    } else if (o.t === 'ban') {
      o.x = Math.sin(t * 0.0016 + o.ph) * 0.9 * RW;
      if (near(o, 600)) hit(o, 0.5, 1, '¡BAÑISTA CON FLOTADOR!', 'yelp');
    } else if (o.t === 'pol') {
      o.x = Math.sin(t * 0.00035 + o.ph) * 0.7 * RW;
      if (!p.air && a === 0 && Math.abs(p.x * RW - o.x - 390) < 900) {
        hit(o, 0.5, 0, '¡DIPUTADO AL SUELO! LOS PASAJEROS APLAUDEN +2');
        p.pax += 2;
        sc.paco.d -= 5000; // los pacos no perdonan eso
      }
    } else if (o.t === 'lobo') {
      if (near(o, 750)) hit(o, 0.12, 2, '¡LOBO MARINO DE 300 KILOS!', 'thud', 0.03);
    } else if (o.t === 'truck') {
      if (near(o, 950)) hit(o, 0.25, 3, '¡CAMIÓN DEL PUERTO!', 'crash', 0.03);
    } else if (o.t === 'cuico') {
      o.x = Math.sin(t * 0.0003 + o.ph) * 0.75 * RW;
      if (!p.air && a === 0 && Math.abs(p.x * RW - o.x) < 800) {
        hit(o, 0.5, 0, '"¡OYE! ¡MI PAPÁ ES ABOGADO!"  -$1.000');
        sc.cash = Math.max(0, sc.cash - 1000);
      }
    } else if (o.t === 'peli') {
      if (p.air && a === 0 && Math.abs(p.x * RW - o.x) < 550 && Math.abs(p.y + 400 - S[o.i].y - o.h) < 800) {
        o.gone = t + 9000;
        p.rv += 1.6 * (Math.random() < 0.5 ? -1 : 1);
        sfx(sc, 'yelp');
        losePax(sc, 1, '¡PELÍCANO EN EL PARABRISAS!');
      }
    }
  }
  // monedas
  for (const c of sc.coins) {
    if (!c.got && ahead(c.i) === 0 && Math.abs(p.x - c.x) < 0.35 && Math.abs(p.y + 500 - S[c.i].y - c.h) < 1200) {
      c.got = 1;
      sc.cash += c.air ? 300 : 100;
      sfx(sc, 'coin');
    }
  }
  // los pacos: cada tramo más rápidos; te alcanzan si frenas, chocas o caes al mar
  if (!sc.t0) {
    if (p.v < MAXV * 0.3) return;
    sc.t0 = t; // los pacos parten cuando la micro arranca
    say(sc, '¡LOS PACOS TE VIERON VOLAR!', '#ff5e5b');
  }
  const pv = MAXV * Math.min(0.92, 0.58 + tr * 0.035 + (t - sc.t0) * 0.000002);
  sc.paco.d = Math.min(24000, sc.paco.d + (p.v - pv) * dt);
  if (sc.paco.d < 14000 && t > (sc.sirT || 0)) {
    sc.sirT = t + 450;
    sc.sirH = !sc.sirH;
    sfx(sc, sc.sirH ? 'sirA' : 'sirB');
  }
  if (sc.paco.d <= 0) return gameOver(sc, t, 0);
  // timbre: alguien pide bajarse más adelante
  if (!sc.reqT) sc.reqT = t + 8000;
  if (!sc.req && t > sc.reqT && p.pax > 0 && pi + 60 < FIN) {
    let i = pi + 45;
    while (S[i].sea || S[i + 1].sea || S[i - 1].sea) i += 5;
    sc.req = { i, n: Math.min(p.pax, 1 + Math.floor(Math.random() * 3)) };
    sfx(sc, 'bell');
    say(sc, '¡RIIING! SE BAJAN ' + sc.req.n, '#ffd23f');
  }
  if (sc.req) {
    const a = ahead(sc.req.i);
    if (a < 6 && a > -4 && p.door && sp < 0.15 && !p.air && t > sc.doorT) {
      sc.req.n--;
      p.pax--;
      sc.cash += 500;
      sc.doorT = t + 320;
      sfx(sc, 'pick');
      say(sc, '¡GRACIAS, TÍO! +$500', '#9bc53d');
    } else if (a <= -4) {
      losePax(sc, sc.req.n, '¡ME PASÓ, CHOFER! SE TIRARON');
      sc.paco.d -= 2500;
      sc.req.n = 0;
    }
    if (sc.req.n <= 0) {
      sc.req = null;
      sc.reqT = t + 9000 + Math.random() * 8000;
    }
  }
  // curao meando: la poza llega a la calle
  for (const c of sc.curaos) {
    const a = ahead(c.i);
    if (!p.air && t > c.gone && t > c.cd && a >= -1 && a < 2 && p.x < -0.62) {
      c.cd = t + 3000;
      sfx(sc, 'splash');
      losePax(sc, 1, p.x < -1 ? '¡CASI LO ATROPELLAS!' : '¡PASASTE POR LA POZA!');
    }
  }
  const st = sc.stops.find((o) => ahead(o.i) < 45 && ahead(o.i) >= -2 && o.n > 0);
  sc.tStop.setText(
    sc.req
      ? '¡TIMBRE! BAJAN ' + sc.req.n + ' en ' + Math.max(0, Math.round(ahead(sc.req.i) * SEG / 100)) + ' m: frena y abre (B2)'
      : st
        ? (st.name || 'PARADERO') + ' ▶ frena y abre la puerta (B2)'
        : ''
  );
}

function updatePlayer(sc, dt, t) {
  const p = sc.p;
  if (p.sea > 0) {
    // hundiéndose
    p.sea -= dt;
    p.y -= 1500 * dt;
    p.v *= 1 - 2 * dt;
    p.z += p.v * dt;
    if (p.sea <= 0) {
      let i = Math.floor(p.z / SEG);
      while (S[i % N].sea || S[(i + 1) % N].sea) i++;
      p.z = (i + 3) * SEG;
      p.y = groundY(p.z);
      p.vy = 0;
      p.x = 0;
      p.roll = 0;
      p.v = MAXV * 0.3;
      sc.tweens.add({ targets: sc.water, alpha: 0, duration: 500 });
    }
    return;
  }
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
    if (p.y <= gy) {
      if (seg.sea || gy - p.y > 500) toSea(sc, p);
      else land(sc, p, gy, t);
    }
  } else {
    const by = p.y + p.vy * dt - GRAV * dt * dt;
    if (gy < by - 5) {
      const fast = p.v > MAXV * 0.2;
      p.air = true;
      p.airT = 0;
      p.y = by;
      p.vy += (fast ? p.v * 0.22 : 0) - GRAV * dt; // rebote del lomo: sale volando
      p.rv = fast ? (Math.random() - 0.5) * 0.9 - seg.c * 0.12 - p.steer * 0.3 : 0;
      if (fast) sfx(sc, 'whoosh');
    } else {
      p.vy = Phaser.Math.Clamp(dt > 0 ? (gy - p.y) / dt : 0, -9000, 9000);
      p.y = gy;
      p.roll += (-seg.c * sp * 0.03 - p.roll) * Math.min(1, dt * 6);
    }
  }
  // el horizonte cae al despegar y la nariz baja al caer
  const tp = p.air ? Phaser.Math.Clamp(45 + p.vy * 0.004, -50, 110) : 0;
  sc.pitch += (tp - sc.pitch) * Math.min(1, dt * 5);
}

const ST = (sz, c) => ({ fontFamily: 'monospace', fontSize: sz, fontStyle: 'bold', color: c, stroke: '#1b2733', strokeThickness: 7, align: 'center' });
const mmss = (ms) => Math.floor(ms / 60000) + ':' + ('0' + Math.floor((ms % 60000) / 1000)).slice(-2);

// why = 0 pacos, 1 sin pasajeros
function gameOver(sc, t, why) {
  sc.over = t;
  sc.p.v = 0;
  sfx(sc, 'crash');
  sc.ho(sc.add.rectangle(W / 2, H / 2, W, H, 0x10141a, 0.78).setDepth(8));
  if (!why) {
    drawPaco(sc.ho(sc.add.graphics().setDepth(9)), t);
    sc.ho(sc.add.text(205, 92, '¿Así que andaba\nvolando, caballero?', { ...ST('17px', '#1b2733'), strokeThickness: 0 }).setOrigin(0.5).setDepth(10));
  }
  sc.ho(sc.add.text(why ? W / 2 : 560, 150, why ? '¡TE QUEDASTE\nSIN PASAJEROS!' : '¡TE PILLARON\nLOS PACOS!', ST('44px', '#ff5e5b')).setOrigin(0.5).setDepth(9));
  const hito = sc.tr > 0 ? T[sc.tr - 1].n : 'LA ADUANA';
  sc.ho(sc.add.text(why ? W / 2 : 560, 300, (why ? 'Nadie te paga: te echaron\nde la empresa.\n' : '') + 'Llegaste hasta ' + hito + '\nRecaudaste $ ' + sc.cash.toLocaleString('es-CL'), ST('22px', '#ffd23f')).setOrigin(0.5).setDepth(9));
  const pr = sc.ho(sc.add.text(why ? W / 2 : 560, 440, 'START o B1\npara otro turno', ST('20px', '#9bc53d')).setOrigin(0.5).setDepth(9));
  sc.tweens.add({ targets: pr, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
}

function winGame(sc, t) {
  sc.win = t;
  const tip = sc.p.pax * 1000;
  sc.cash += tip;
  sfx(sc, 'bell');
  for (let k = 0; k < 6; k++) setTimeout(() => sfx(sc, k % 2 ? 'sirA' : 'sirB'), 600 + k * 500);
  sc.ho(sc.add.text(W / 2, 120, '¡LLEGASTE A REÑACA!\n¡FELIZ AÑO NUEVO!', ST('42px', '#ffd23f')).setOrigin(0.5).setDepth(9));
  sc.ho(sc.add.text(W / 2, 265, 'Tiempo ' + mmss(t - sc.t0) + '\n' + sc.p.pax + ' pasajeros llegaron vivos: propina $' + tip.toLocaleString('es-CL') + '\n\nRECAUDASTE  $ ' + sc.cash.toLocaleString('es-CL'), ST('21px', '#f2efe6')).setOrigin(0.5).setDepth(9));
  const pr = sc.ho(sc.add.text(W / 2, 400, 'START o B1 para otro turno', ST('18px', '#9bc53d')).setOrigin(0.5).setDepth(9));
  sc.tweens.add({ targets: pr, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
  sc.tStop.setText('');
}

// Carabinero asomado a la ventana del chofer: uniforme verde, gorra con visera e insignia,
// bigote, guante blanco y la libreta de partes.
function drawPaco(g) {
  const V = 0x2e5e3a;
  const P = 0xd9a77c;
  g.fillStyle(0xf2efe6).fillRoundedRect(85, 55, 240, 74, 14).fillTriangle(180, 128, 215, 128, 205, 160);
  g.fillStyle(0xf2efe6).fillRect(300, 420, 230, 120);
  g.fillStyle(0x1f7a3c).fillRect(300, 480, 230, 26);
  g.fillStyle(0xff2d2d).fillRect(340, 400, 60, 20);
  g.fillStyle(0x2d6bff).fillRect(420, 400, 60, 20);
  g.fillStyle(V).fillRoundedRect(70, 400, 270, 230, 40);
  g.fillStyle(0x9cb38a).fillTriangle(170, 400, 240, 400, 205, 470);
  g.fillStyle(0x1f3d27).fillRect(197, 420, 16, 90);
  g.fillStyle(0xd4af37).fillCircle(120, 450, 13).fillRect(270, 440, 40, 10);
  g.lineStyle(6, 0x1f3d27).lineBetween(70, 420, 140, 405).lineBetween(340, 420, 270, 405);
  g.fillStyle(P).fillRect(180, 350, 50, 60);
  g.fillEllipse(205, 300, 130, 150);
  g.fillCircle(140, 305, 16).fillCircle(270, 305, 16);
  g.fillStyle(0x1b1b1b).fillCircle(180, 298, 7).fillCircle(230, 298, 7);
  g.lineStyle(5, 0x3b2a1a).lineBetween(163, 280, 195, 287).lineBetween(247, 280, 215, 287);
  g.fillStyle(0x3b2a1a).fillEllipse(205, 340, 70, 18);
  g.lineStyle(3, 0x7a4b3a).lineBetween(190, 358, 220, 358);
  g.fillStyle(V).fillEllipse(205, 225, 170, 60);
  g.fillRect(140, 225, 130, 34);
  g.fillStyle(0x0f0f0f).fillEllipse(205, 262, 150, 22);
  g.fillStyle(0xd4af37).fillCircle(205, 238, 14);
  g.fillStyle(V).fillCircle(205, 238, 6);
  g.fillStyle(V).fillRoundedRect(300, 470, 60, 120, 20);
  g.fillStyle(0xffffff).fillCircle(335, 470, 30);
  g.fillStyle(0xf8f4e3).fillRect(300, 395, 70, 90);
  g.lineStyle(2, 0x9aa3ad);
  for (let k = 0; k < 5; k++) g.lineBetween(308, 412 + k * 14, 362, 412 + k * 14);
}

function setView(sc, chase) {
  sc.chase = chase;
  sc.cock.forEach((o) => o.setVisible(!chase));
  sc.tDoor.setPosition(chase ? W / 2 : W - 170, chase ? 440 : 445);
}

// Micro de Valpo vista desde atrás (blanca con franjas), dibujada una vez; se escala y gira
function makeBus(sc) {
  const b = sc.add.graphics().setDepth(2);
  sc.hud.ignore(b);
  b.fillStyle(0xf2efe6).fillRoundedRect(-150, -285, 300, 270, 18);
  b.fillStyle(0x1f2b36).fillRoundedRect(-125, -262, 250, 92, 8);
  b.fillStyle(0xffffff, 0.18).fillTriangle(-110, -255, -40, -255, -110, -185);
  b.fillStyle(0x111111).fillRect(-62, -282, 124, 18);
  b.fillStyle(0xffb000).fillRect(-50, -278, 100, 9);
  b.fillStyle(0xc8553d).fillRect(-150, -150, 300, 22);
  b.fillStyle(0x2f7f9e).fillRect(-150, -122, 300, 12);
  b.fillStyle(0xe8c547).fillRect(-150, -104, 300, 8);
  b.fillStyle(0xd62828).fillRoundedRect(-142, -88, 26, 44, 5).fillRoundedRect(116, -88, 26, 44, 5);
  b.fillStyle(0xf29e4c).fillRect(-142, -40, 26, 10).fillRect(116, -40, 26, 10);
  b.fillStyle(0xffffff).fillRect(-32, -66, 64, 22);
  b.fillStyle(0x1b2733).fillRect(-26, -61, 52, 12);
  b.fillStyle(0x2b2b2b).fillRect(-156, -28, 312, 22);
  b.fillStyle(0x111111).fillRoundedRect(-140, -12, 62, 26, 8).fillRoundedRect(78, -12, 62, 26, 8);
  return b;
}

function toSea(sc, p) {
  p.air = false;
  p.sea = 1.6;
  p.vy = 0;
  sc.cameras.main.shake(400, 0.03);
  sc.hud.shake(400, 0.02);
  sfx(sc, 'splash');
  sfx(sc, 'thud');
  sc.water.setAlpha(0);
  sc.tweens.add({ targets: sc.water, alpha: 0.75, duration: 450 });
  sc.paco.d -= 4000;
  losePax(sc, Math.max(4, Math.ceil(p.pax * 0.5)), '¡AL MAR!');
}

function land(sc, p, gy, t) {
  const hit = Math.max(0, -p.vy);
  const r = Math.abs(p.roll);
  p.air = false;
  p.y = gy;
  p.vy = 0;
  if (p.airT < 0.15) return;
  const k = Math.min(0.035, 0.006 + hit / 400000);
  sc.cameras.main.shake(260, k);
  sc.hud.shake(260, k * 0.5);
  sc.pitch -= Math.min(70, hit * 0.005);
  sfx(sc, 'thud');
  if (t - p.jk < 260 && p.airT > 0.35) {
    // apretaste B1 justo al tocar el suelo: aterrizaje perfecto
    const bonus = 300 + Math.round(p.airT * 300);
    sc.cash += bonus;
    say(sc, '¡ATERRIZAJE PERFECTO! +$' + bonus, '#7cfc00');
    sfx(sc, 'pick');
    p.roll *= 0.2;
    return;
  }
  if (r > 0.45) {
    p.v *= 0.35;
    losePax(sc, Math.max(3, Math.ceil(p.pax * 0.4)), '¡CASI SE DA VUELTA!');
  } else if (r > 0.2) {
    p.v *= 0.75;
    losePax(sc, Math.max(1, Math.ceil(p.pax * 0.2)), '¡PUCHA, ATERRIZÓ CHUECO!');
  } else if (Math.abs(p.x) > 1.05) {
    losePax(sc, 2, '¡A LA VEREDA!');
  } else if (p.airT > 1.2) {
    losePax(sc, Math.min(2, Math.ceil(p.airT - 1)), '¡VOLANDO ' + p.airT.toFixed(1) + ' s! SE SOLTARON');
  } else if (p.airT > 0.4) {
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
    // unos saltan por las ventanas hacia la calle (se achican al alejarse) y otros vuelan por la cabina
    const far = j % 2;
    const [ox, oy] = sc.chase && sc.bxy ? sc.bxy : [W / 2, 480];
    const s = sc.ho(sc.add.image(ox + (Math.random() - 0.5) * (sc.chase ? 200 : 560), oy, 'pax' + (j % 3)).setScale(far ? 4 : 3.5).setDepth(5));
    sc.parts.push({ s, vx: (Math.random() - 0.5) * (far ? 500 : 900), vy: -(far ? 700 : 900) - Math.random() * 600, vr: (Math.random() - 0.5) * 14, life: 2.4, ds: far ? 1.6 : 0 });
  }
  if (p.pax <= 0 && !sc.over && !sc.win) gameOver(sc, sc.now, 1);
}

function updateParts(sc, dt) {
  sc.parts = sc.parts.filter((o) => {
    o.life -= dt;
    o.vy += 1400 * dt;
    o.s.x += o.vx * dt;
    o.s.y += o.vy * dt;
    o.s.rotation += o.vr * dt;
    if (o.ds) o.s.setScale(Math.max(0.3, o.s.scale - o.ds * dt));
    if (o.life > 0) return true;
    o.s.destroy();
    return false;
  });
}

function say(sc, txt, col) {
  const t = sc.ho(sc.add.text(W / 2, 205, txt, { fontFamily: 'monospace', fontSize: '26px', fontStyle: 'bold', color: col, stroke: '#1b2733', strokeThickness: 6, align: 'center' }).setOrigin(0.5).setDepth(6));
  sc.tweens.add({ targets: t, y: 150, alpha: 0, delay: 600, duration: 1100, onComplete: () => t.destroy() });
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
// franja lateral entre k1 y k2 (en medios anchos de calle), a ras de suelo
function side(g, a, b, k1, k2, col, al) {
  g.fillStyle(col, al === undefined ? 1 : al);
  g.fillPoints([{ x: a.x + a.s * RW * k1, y: a.y }, { x: a.x + a.s * RW * k2, y: a.y }, { x: b.x + b.s * RW * k2, y: b.y }, { x: b.x + b.s * RW * k1, y: b.y }], true);
}

function render(sc) {
  const g = sc.g;
  const p = sc.p;
  g.clear();
  const ch = sc.chase;
  const cz = p.z - (ch ? BACK : 0);
  const cy = HOR + sc.pitch * (ch ? 0.4 : 1);
  const base = Math.floor(cz / SEG);
  const pct = (cz % SEG) / SEG;
  sc.camY += (Math.max(p.y, groundY(cz)) + 1800 - sc.camY) * (ch ? 0.12 : 1);
  const camY = ch ? sc.camY : p.y + CAMH;
  let bx = W / 2;
  sc.bgX += S[base % N].c * p.v * 0.00004;
  const nt = sc.sky.n;
  const dk = (c) => mix(c, NIGHT, nt * 0.75);

  drawBay(g, cy, sc.bgX, sc.sky);
  drawFireworks(g, sc.fw);

  // franjas, de lejos a cerca
  const L = [];
  let x = 0;
  let dx = -S[base % N].c * pct;
  for (let n = 0; n <= DRAW; n++) {
    const i = (base + n) % N;
    const z1 = (base + n) * SEG - cz;
    const cx = p.x * RW;
    const a = proj(x - cx, S[i].y - camY, z1, cy);
    const b = proj(x + dx - cx, S[(i + 1) % N].y - camY, z1 + SEG, cy);
    L.push({ i, a, b, n });
    if (z1 <= BACK && z1 + SEG > BACK) bx = a.x + (b.x - a.x) * ((BACK - z1) / SEG) + a.s * p.x * RW;
    x += dx;
    dx += S[i].c;
  }
  const C = [dk(0x6f6a5e), dk(0x9c968c), dk(0xa8a297), dk(0xe8c547), dk(0x46423e), dk(0x5b5650), dk(0x67615a), dk(0xe8d9a8), sc.sky.m];
  let pr = null;
  let pl = null;
  for (let k = L.length - 1; k >= 1; k--) {
    const { i, a, b } = L[k];
    const alt = i & 1;
    if (S[i].sea) {
      // olas abajo, en el corte
      const wy = proj(0, S[i].y - 6000 - p.y - CAMH, (base + L[k].n) * SEG - cz, cy).y;
      if (wy < H + 300) g.fillStyle(sc.sky.m).fillRect(-300, wy, W + 600, H + 300 - wy).fillStyle(0xdde5ea, 0.6).fillRect(-300, wy, W + 600, Math.max(1, a.s * 60));
      continue;
    }
    if (b.y < a.y) {
      g.fillStyle(C[0]).fillRect(-300, b.y, W + 600, a.y - b.y + 1);
      if (S[i].sl) {
        // lado del mar: arena (o roquerío) y agua hasta el horizonte
        side(g, a, b, -1.3, -2.3, S[i].sl === 1 ? C[7] : dk(0x55504a));
        side(g, a, b, -2.3, -14, C[8]);
        side(g, a, b, -2.3, -2.55, 0xffffff, 0.5 + 0.3 * Math.sin(sc.now * 0.003 + i));
      }
      quad(g, a, b, 1.3, (i >> 1) & 1 ? C[1] : C[2]); // vereda
      quad(g, a, b, 1.07, (i >> 1) & 1 ? C[3] : C[4]); // solera pintada
      quad(g, a, b, 1, alt ? C[5] : C[6]); // adoquines
    }
    // casas: de la fila más alta a la de la vereda
    for (let r = 3; r >= 0; r--) {
      for (let sd = 0; sd < 2; sd++) {
        const hs = S[i].w[sd * 4 + r];
        if (hs) wall(g, a, b, (sd ? -1 : 1) * ROWS[r][0] * RW, ROWS[r][1], hs, r);
      }
    }
    for (const o of sc.at[i] || []) drawObj(g, a, o, sc.now, nt);
    if (sc.req && i === sc.req.i) {
      const x = a.x + a.s * 1.12 * RW;
      const fl = Math.floor(sc.now / 250) % 2;
      g.fillStyle(0x3d4247).fillRect(x, a.y - a.s * 2600, a.s * 60, a.s * 2600);
      g.fillStyle(fl ? 0xffd23f : 0xf29e4c).fillRect(x - a.s * 300, a.y - a.s * 3000, a.s * 660, a.s * 480);
      g.fillStyle(0x1b2733).fillTriangle(x - a.s * 150, a.y - a.s * 2860, x + a.s * 210, a.y - a.s * 2860, x + a.s * 30, a.y - a.s * 2600);
      person(g, a, 1.2 * RW + 200, 0xc8553d);
    }
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
      if (nt > 0.3) g.fillStyle(0xffd27a, nt).fillCircle(tr.x, tr.y + a.s * 150, Math.max(1.5, a.s * 70)); // farol
      pr = tr;
      pl = tl;
    }
  }
  // la micro vista desde atrás, con su sombra en el suelo
  const bus = sc.bus.setVisible(ch);
  if (ch) {
    const q = proj(0, p.y - camY, BACK, cy);
    const sh = proj(0, groundY(p.z) - camY, BACK, cy);
    const k = (q.s * 1700) / 300;
    g.fillStyle(0x000000, 0.3).fillEllipse(bx, sh.y, q.s * 2000, q.s * 260);
    bus.setPosition(bx, q.y).setScale(k).setRotation(p.roll * 0.75);
    sc.bxy = [bx, q.y - 140 * k];
  }
}

function drawFireworks(g, fw) {
  for (const r of fw) {
    if (!r.sp) {
      g.fillStyle(0xfff2b0).fillRect(r.x - 1.5, r.y, 3, 10);
      continue;
    }
    for (const s of r.sp) {
      if (s.l > 0) g.fillStyle(r.c, s.l).fillCircle(s.x, s.y, 2.6);
    }
  }
}

function person(g, a, ox, col, skin) {
  const x = a.x + a.s * ox;
  g.fillStyle(0x2a2a2a).fillRect(x - a.s * 45, a.y - a.s * 260, a.s * 90, a.s * 260);
  g.fillStyle(col).fillRect(x - a.s * 60, a.y - a.s * 560, a.s * 120, a.s * 320);
  g.fillStyle(skin || 0xe0b48a).fillCircle(x, a.y - a.s * 640, a.s * 75);
  return x;
}

function drawObj(g, a, o, t, nt) {
  const s = a.s;
  // rectángulo, triángulo y círculo apoyados en el suelo, en unidades del mundo (ox lateral, by altura base)
  const R = (ox, by, w, h, c, al) => (g.fillStyle(c, al === undefined ? 1 : al), g.fillRect(a.x + s * (ox - w / 2), a.y - s * (by + h), s * w, s * h));
  const Tr = (ox, by, w, h, c) => (g.fillStyle(c), g.fillTriangle(a.x + s * (ox - w / 2), a.y - s * by, a.x + s * (ox + w / 2), a.y - s * by, a.x + s * ox, a.y - s * (by + h)));
  const Ci = (ox, by, r, c, al) => (g.fillStyle(c, al === undefined ? 1 : al), g.fillCircle(a.x + s * ox, a.y - s * by, s * r));
  const dk = (c) => mix(c, NIGHT, nt * 0.6);
  if (o.t === 'stop') {
    const x = a.x + s * 1.06 * RW;
    g.fillStyle(0x3d4247).fillRect(x, a.y - s * 1500, s * 50, s * 1500).fillRect(x + s * 700, a.y - s * 1500, s * 50, s * 1500);
    g.fillStyle(o.pay > 1000 ? 0xd4af37 : 0x2f7f9e).fillRect(x - s * 80, a.y - s * 1600, s * 900, s * 140);
    g.fillStyle(0x1565c0).fillRect(x - s * 380, a.y - s * 2100, s * 320, s * 320);
    g.fillStyle(0xffffff).fillRect(x - s * 300, a.y - s * 2000, s * 160, s * 40).fillRect(x - s * 300, a.y - s * 1920, s * 110, s * 40);
    for (let k = 0; k < o.n; k++) {
      const px = person(g, a, 1.12 * RW + k * (o.max > 8 ? 120 : 170), o.col[(k * 3) % o.col.length]);
      if (o.pay > 1000) {
        g.fillStyle(0x111111).fillRect(px - s * 70, a.y - s * 670, s * 140, s * 40); // lentes oscuros
        person(g, a, 1.12 * RW + 260, 0x1b1b1b);
        person(g, a, 1.12 * RW - 220, 0x1b1b1b);
      }
    }
  } else if (o.t === 'dog' && t > o.gone) {
    const x = a.x + s * o.x;
    g.fillStyle(0x8b5a2b).fillEllipse(x, a.y - s * 230, s * 420, s * 170);
    g.fillCircle(x + s * 230 * Math.sign(Math.cos(t * 0.0011 + o.ph)), a.y - s * 330, s * 85);
    g.fillStyle(0x5a3a1a).fillRect(x - s * 150, a.y - s * 200, s * 40, s * 200).fillRect(x + s * 110, a.y - s * 200, s * 40, s * 200);
  } else if (o.t === 'coin' && !o.got) {
    const y = a.y - s * (o.h + 300);
    const x = a.x + s * o.x * RW;
    const sw = Math.abs(Math.cos(t * 0.006 + o.i));
    g.fillStyle(0xb8860b).fillEllipse(x, y, s * 520 * sw + 2, s * 520);
    g.fillStyle(0xffd23f).fillEllipse(x, y, s * 400 * sw + 1, s * 400);
  } else if (o.t === 'drunk' && t > o.gone) {
    person(g, a, o.x, o.mech ? 0x9bc53d : 0x7a6a8c, o.mech ? 0xd94f70 : 0);
    const x = a.x + s * o.x;
    if (!o.mech) g.fillStyle(0x4f9d69).fillRect(x + s * 70, a.y - s * 520, s * 50, s * 140);
  } else if (o.t === 'ban' && t > o.gone) {
    person(g, a, o.x, [0xff7f50, 0x2d6bff, 0xffd23f][o.ph % 3 | 0]);
    g.lineStyle(Math.max(1, s * 60), 0xff5e5b).strokeCircle(a.x + s * o.x, a.y - s * 400, s * 200);
  } else if (o.t === 'pol' && t > o.gone) {
    for (let k = 0; k < 4; k++) {
      const px = person(g, a, o.x + k * 260, 0x1b1b2b, 0xe0b48a);
      g.fillStyle(k % 2 ? 0xd62828 : 0x2d6bff).fillRect(px - s * 15, a.y - s * 560, s * 30, s * 200); // corbata
      g.fillStyle(0xf2efe6).fillRect(px + s * 60, a.y - s * 420, s * 90, s * 120); // carpeta
    }
  } else if (o.t === 'lobo') {
    const x = o.x + Math.sin(t * 0.0012 + o.ph) * 90;
    g.fillStyle(0x6b4a2b).fillEllipse(a.x + s * x, a.y - s * 220, s * 1000, s * 380);
    g.fillStyle(0x7d5a36).fillCircle(a.x + s * (x + 420), a.y - s * 380, s * 170);
    g.fillStyle(0x111111).fillCircle(a.x + s * (x + 470), a.y - s * 420, s * 30);
    g.lineStyle(Math.max(1, s * 15), 0xf2efe6).lineBetween(a.x + s * (x + 520), a.y - s * 350, a.x + s * (x + 760), a.y - s * 330);
    g.fillStyle(0x6b4a2b).fillTriangle(a.x + s * (x - 560), a.y, a.x + s * (x - 380), a.y, a.x + s * (x - 620), a.y - s * 330); // cola
  } else if (o.t === 'peli' && t > o.gone) {
    const by = o.h + Math.sin(t * 0.004 + o.ph) * 150;
    const w = Math.sin(t * 0.012 + o.ph) * 300;
    g.fillStyle(0xd0d4d8).fillEllipse(a.x + s * o.x, a.y - s * by, s * 420, s * 180);
    Tr(o.x - 300, by - 60, 600, w, 0xbfc5ca);
    Tr(o.x + 300, by - 60, 600, w, 0xbfc5ca);
    g.fillStyle(0xffb000).fillTriangle(a.x + s * (o.x + 200), a.y - s * (by + 60), a.x + s * (o.x + 200), a.y - s * (by - 40), a.x + s * (o.x + 560), a.y - s * (by - 20));
  } else if (o.t === 'truck') {
    R(o.x, 0, 1300, 300, 0x2b2b2b);
    R(o.x, 250, 1300, 1500, dk(0x8e2f2f));
    R(o.x, 1750, 1300, 120, dk(0xd9d9d9));
    R(o.x - 300, 500, 300, 400, 0x9fd3f0, 0.9);
    R(o.x + 300, 500, 300, 400, 0x9fd3f0, 0.9);
    g.fillStyle(0x111111).fillCircle(a.x + s * (o.x - 450), a.y - s * 150, s * 170).fillCircle(a.x + s * (o.x + 450), a.y - s * 150, s * 170);
  } else if (o.t === 'cuico' && t > o.gone) {
    const p1 = person(g, a, o.x - 380, 0xf2efe6, 0xd9a77c);
    const p2 = person(g, a, o.x + 380, 0xf9d6e5, 0xd9a77c);
    g.fillStyle(0x111111).fillRect(p1 - s * 70, a.y - s * 670, s * 140, s * 36).fillRect(p2 - s * 70, a.y - s * 670, s * 140, s * 36); // lentes
    g.fillStyle(0x8b5a2b).fillRect(p1 + s * 60, a.y - s * 620, s * 60, s * 220).fillRect(p2 - s * 120, a.y - s * 620, s * 60, s * 220); // paletas
    const bh = 450 + Math.abs(Math.sin(t * 0.007 + o.ph)) * 500;
    const bxx = o.x + Math.sin(t * 0.007 + o.ph) * 360;
    Ci(bxx, bh, 45, 0xff5e5b);
  } else if (o.t === 'curao' && t > o.gone) {
    g.fillStyle(0xf2d43a, 0.85).fillEllipse(a.x - s * 0.98 * RW, a.y, s * 900, s * 90);
    person(g, a, -1.18 * RW, 0x6d6d6d);
    const x = a.x - s * 1.15 * RW;
    g.lineStyle(Math.max(1, s * 30), 0xf2d43a).lineBetween(x, a.y - s * 300, x + s * 120 + Math.sin(t * 0.03) * s * 15, a.y);
  } else if (o.t === 'grua') {
    // grúa del puerto: columna, brazo y contenedores
    const ox = -2.6 * RW;
    R(ox, 0, 160, 3800, dk(0xd9772b));
    R(ox + 900, 3600, 2200, 160, dk(0xd9772b));
    R(ox + 1600, 2600, 120, 1000, 0x1d1f22);
    R(ox + 1600, 2200, 600, 400, [0xc8553d, 0x3a8fb7, 0x4fa38a][o.i % 3]);
    R(ox - 300, 0, 1400, 700, dk([0x2f7f9e, 0xc8553d, 0xe8c547][(o.i + 1) % 3]));
  } else if (o.t === 'meta') {
    // arco de meta: SECTOR 5
    R(-1.2 * RW, 0, 120, 3200, 0xf2efe6);
    R(1.2 * RW, 0, 120, 3200, 0xf2efe6);
    R(0, 3000, 2.4 * RW + 120, 700, 0xffd23f);
    for (let k = 0; k < 7; k++) R(-1.05 * RW + k * 0.35 * RW, 3100, 0.12 * RW, 500, k % 2 ? 0x1b2733 : 0xd62828);
  } else if (o.t === 'land') {
    drawLand(R, Tr, Ci, o.id, o.sd, t, nt, g, a);
  }
}

// Los lugares icónicos, a un costado de la calle. sd = 1 derecha (cerro), -1 izquierda (mar).
function drawLand(R, Tr, Ci, id, sd, t, nt, g, a) {
  const s = a.s;
  const X = sd * 4300; // centro lateral
  const dk = (c) => mix(c, NIGHT, nt * 0.6);
  const win = (ox, by, w, h, c) => R(ox, by, w, h, nt > 0.4 ? 0xffd27a : c);
  if (id === 0) {
    // Aduana: edificio compacto crema de dos pisos, techo de tejas, ventanas en arco; atrás el ascensor Artillería
    R(X, 0, 3600, 1800, 0xf2e6c9);
    R(X, 1800, 3700, 220, 0xa0432f);
    for (let k = -3; k <= 3; k++) {
      R(X + k * 480, 300, 220, 420, 0x3b4a5a);
      R(X + k * 480, 1050, 220, 420, 0x3b4a5a);
      Ci(X + k * 480, 1470, 110, 0x3b4a5a);
    }
    R(X, 0, 420, 700, 0x5a3a1a);
    // cerro Artillería y el ascensor: riel diagonal y cabina roja
    Tr(X + 900, 0, 7000, 7800, 0x7d7a6e);
    g.lineStyle(Math.max(1, s * 90), 0x3b3f45).lineBetween(a.x + s * (X - 1200), a.y - s * 1900, a.x + s * (X + 2000), a.y - s * 6800);
    const k = 0.5 + 0.5 * Math.sin(t * 0.0006);
    R(X - 1200 + k * 3200, 1900 + k * 4900, 420, 380, 0xc8553d);
    R(X + 2400, 6800, 1800, 700, 0x9aa3ad); // Museo Marítimo
  } else if (id === 1) {
    // Congreso: bloque gris posmoderno con torre, puerta con la mano, bandera
    R(X, 0, 4200, 2800, dk(0xb9b2a6));
    R(X, 0, 1500, 7600, dk(0xc9c2b4));
    R(X, 0, 1700, 300, dk(0x8e877b));
    for (let k = 0; k < 9; k++) for (let j = -2; j <= 2; j++) if (j) win(X + j * 280, 800 + k * 720, 150, 300, 0x3b4a5a);
    R(X - 1500, 0, 600, 1100, 0x7a4b1e); // la puerta de pino oregón
    R(X - 1500, 350, 260, 420, 0xd9a77c); // la mano abierta
    R(X, 7600, 60, 1300, 0x3b3f45);
    R(X + 420, 8400, 800, 250, 0xffffff);
    R(X + 420, 8150, 800, 250, 0xd62828);
    R(X + 220, 8400, 400, 250, 0x1b4aa0);
  } else if (id === 2) {
    // Caleta Portales: galpón de zinc, botes de colores en la arena, monumento al pescador
    R(X + 800, 0, 3200, 1300, dk(0xd0d4d8));
    Tr(X + 800, 1300, 3300, 700, dk(0xb0b6bb));
    [0xe8c547, 0x3a8fb7, 0xd62828, 0x4fa38a].forEach((c, k) => {
      const bxx = X - 2600 + k * 900;
      g.fillStyle(c).fillEllipse(a.x + s * bxx, a.y - s * 250, s * 800, s * 450);
      R(bxx, 400, 60, 700, 0x5a3a1a);
    });
    R(X - 400, 0, 300, 900, 0x7d7a6e);
    person(g, a, X - 400, 0xe8c547);
  } else if (id === 3) {
    // Santa María: castillo neogótico con torre central, pináculos y alas con ventanas ojivales, sobre su escalinata
    R(X, 0, 7000, 1400, dk(0x9c968c));
    R(X, 1400, 7200, 300, dk(0xb0aa9e));
    R(X - 2600, 1700, 2400, 3200, dk(0xcfc6b2));
    R(X + 2600, 1700, 2400, 3200, dk(0xcfc6b2));
    R(X, 1700, 1700, 8200, dk(0xd8d0bc));
    for (let k = -1; k <= 1; k++) {
      Tr(X + k * 600, 9900, 420, 1200, dk(0xb0aa9e));
      win(X + k * 450, 7800, 160, 700, 0x243746);
      win(X + k * 450, 5400, 160, 700, 0x243746);
    }
    for (let k = -2; k <= 2; k++) {
      win(X - 2600 + k * 420, 2600, 150, 900, 0x243746);
      win(X + 2600 + k * 420, 2600, 150, 900, 0x243746);
      Tr(X - 2600 + k * 420, 3500, 150, 200, nt > 0.4 ? 0xffd27a : 0x243746);
      Tr(X + 2600 + k * 420, 3500, 150, 200, nt > 0.4 ? 0xffd27a : 0x243746);
    }
    R(X, 1700, 500, 1100, 0x3b2a1a);
  } else if (id === 4) {
    // Reloj de Flores en el talud verde, con palmeras; atrás, el cerro Castillo
    Tr(X, 0, 9000, 5200, dk(0x6f8f5a));
    g.fillStyle(0xf2efe6).fillEllipse(a.x + s * X, a.y - s * 1500, s * 2600, s * 1300);
    g.fillStyle(0x3e7a3a).fillEllipse(a.x + s * X, a.y - s * 1500, s * 2300, s * 1050);
    for (let k = 0; k < 12; k++) {
      const an = (k / 12) * Math.PI * 2;
      Ci(X + Math.cos(an) * 950, 1500 + Math.sin(an) * 430, 90, [0xff3b3b, 0xffd23f, 0xffffff, 0xff8ad6][k % 4]);
    }
    const an = t * 0.0004;
    g.lineStyle(Math.max(1, s * 60), 0x1b1b1b).lineBetween(a.x + s * X, a.y - s * 1500, a.x + s * (X + Math.cos(an) * 800), a.y - s * (1500 + Math.sin(an) * 360));
    g.lineBetween(a.x + s * X, a.y - s * 1500, a.x + s * (X + Math.cos(an * 12) * 500), a.y - s * (1500 + Math.sin(an * 12) * 230));
    [-3400, 3400].forEach((ox) => {
      R(X + ox, 0, 160, 3800, 0x7a5a3a);
      for (let k = 0; k < 6; k++) Tr(X + ox + Math.cos((k / 6) * 6.28) * 500, 3400 + Math.sin((k / 6) * 6.28) * 300, 420, 900, 0x3e8a3a);
    });
    R(X, 5200, 2600, 1300, dk(0xf2efe6)); // palacio presidencial arriba del cerro
  } else if (id === 5) {
    // Sheraton Miramar: cilindro de vidrio y cuerpo curvo sobre el roquerío, piscina turquesa
    R(X, 0, 5200, 900, dk(0x55504a));
    R(X + 600, 900, 2600, 200, 0x2ad4d0); // la piscina
    R(X - 1500, 900, 2400, 5600, dk(0x6fa8d0));
    R(X + 1200, 900, 3200, 4200, dk(0x7fb6da));
    for (let k = 0; k < 7; k++) {
      win(X - 1500, 1200 + k * 760, 2200, 180, 0xdff2fb);
      if (k < 5) win(X + 1200, 1200 + k * 760, 3000, 180, 0xdff2fb);
    }
    R(X - 1500, 6500, 2600, 160, 0xf2efe6);
    g.fillStyle(0xffffff, 0.8).fillEllipse(a.x + s * (X - 2800), a.y - s * 300, s * 1400, s * 500); // ola rompiendo
  } else if (id === 6) {
    // Quinta Vergara: portón de fierro, árboles enormes, palacio gótico veneciano y la Concha Acústica con reflectores
    for (let k = -4; k <= 4; k++) R(X + k * 300, 0, 50, 1600, 0x1b1b1b);
    R(X, 1600, 2600, 120, 0x1b1b1b);
    [-3200, -1800, 2200, 3600].forEach((ox, k) => {
      R(X + ox, 0, 240, 2600, 0x3b2a1a);
      Ci(X + ox, 3400, 1400 + (k % 2) * 300, dk(0x1f4a2a));
    });
    R(X, 1700, 3000, 2400, dk(0xf2efe6));
    for (let k = -2; k <= 2; k++) (win(X + k * 520, 2200, 220, 900, 0x243746), Tr(X + k * 520, 3100, 220, 300, nt > 0.4 ? 0xffd27a : 0x243746));
    Tr(X - 1400, 4100, 500, 900, dk(0xd9d2c0));
    Tr(X + 1400, 4100, 500, 900, dk(0xd9d2c0));
    g.fillStyle(dk(0xf2efe6)).fillEllipse(a.x + s * (X + 1200), a.y - s * 5600, s * 4200, s * 2800); // la concha acústica
    g.fillStyle(0x1b2733).fillRect(a.x + s * (X - 900), a.y - s * 5600, s * 4200, s * 1400);
    for (let k = 0; k < 3; k++) {
      const an = Math.sin(t * 0.0012 + k * 2) * 0.8;
      g.lineStyle(Math.max(2, s * 150), [0xff5e5b, 0x6fc2d0, 0xffd23f][k], 0.5).lineBetween(a.x + s * (X + 1200 + (k - 1) * 1200), a.y - s * 5600, a.x + s * (X + 1200 + (k - 1) * 1200 + Math.sin(an) * 9000), a.y - s * (5600 + Math.cos(an) * 9000));
    }
  } else if (id === 7) {
    // Reñaca: la gaviota de flores en el cerro y los edificios escalonados
    Tr(X + 600, 0, 9000, 6000, dk(0xb8a77a));
    g.lineStyle(Math.max(2, s * 140), 0xf2efe6).lineBetween(a.x + s * (X - 1500), a.y - s * 4200, a.x + s * (X - 500), a.y - s * 5200).lineBetween(a.x + s * (X - 500), a.y - s * 5200, a.x + s * (X + 500), a.y - s * 4200);
    for (let k = 0; k < 6; k++) R(X + 1200 + k * 420, k * 700, 2600 - k * 420, 700, dk(k % 2 ? 0xf2efe6 : 0xe4ded0));
    for (let k = 0; k < 6; k++) win(X + 1200 + k * 420, 200 + k * 700, 1800 - k * 300, 220, 0x9fd3f0);
  } else if (id === 8) {
    // más edificios escalonados, blancos, subiendo la ladera
    for (let k = 0; k < 7; k++) {
      R(X + k * 380, k * 650, 2400 - k * 300, 650, dk(k % 2 ? 0xf2efe6 : 0xdcd6c8));
      win(X + k * 380, 180 + k * 650, 1700 - k * 220, 220, 0x9fd3f0);
    }
  }
}

// Fachada pegada a la calle (paralela), con techo de zinc y ventanas en la primera fila
function wall(g, a, b, ox, by, hs, r) {
  const [c, h, k, nt] = hs;
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
    g.fillStyle(nt > 0.4 ? 0xffd27a : 0x243746);
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

// La bahía: cielo (cambia con el tramo), mar, grúas del puerto, barcos y los cerros del frente llenos de casas;
// de noche las casas son lucecitas
function drawBay(g, cy, bx, sky) {
  g.fillGradientStyle(sky.a, sky.a, sky.b, sky.b).fillRect(-300, -300, W + 600, cy + 300);
  g.fillStyle(sky.m).fillRect(-300, cy, W + 600, H + 300 - cy);
  g.fillStyle(0x6a9cbf, 1 - sky.n).fillRect(-300, cy, W + 600, 4);
  if (sky.n > 0.5) for (let k = 0; k < 40; k++) g.fillStyle(0xffffff, (sky.n - 0.5) * 2 * hash(k * 3.1)).fillRect(((hash(k) * 1400 - bx * 0.1) % 1400 + 1400) % 1400 - 300, hash(k + 50) * (cy - 60), 2, 2);
  // barcos y grúas (de noche, con luces)
  for (let k = 0; k < 5; k++) {
    const x = ((k * 230 - bx * 0.6) % 1150 + 1150) % 1150 - 175;
    g.fillStyle(0x3b3f45).fillRect(x, cy + 6, 46, 7);
    g.fillStyle(sky.n > 0.5 ? 0xffd27a : k % 2 ? 0xc8553d : 0x3a8fb7).fillRect(x + 6, cy + 1, 26, 5);
    g.lineStyle(2, 0xd9772b).lineBetween(x + 60, cy + 12, x + 60, cy - 26).lineBetween(x + 50, cy - 24, x + 84, cy - 24);
  }
  // cerros del frente
  const hy = (x) => cy + 10 - Math.max(0, 62 * Math.sin(x / 190) + 38 * Math.sin(x / 71) + 28);
  g.fillStyle(mix(0x7d7a6e, 0x0a0f1c, sky.n));
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
      if (y < cy + 6 && hash(q + j * 31.7) < 0.75) g.fillStyle(sky.n > 0.5 ? 0xffd27a : HC[Math.floor(hh * 1000) % HC.length]).fillRect(q * 7 - bx, y, sky.n > 0.5 ? 2 : 5, sky.n > 0.5 ? 2 : 4);
    }
  }
  g.fillStyle(0xffffff, 0.18 * (1 - sky.n)).fillRect(-300, cy - 70, W + 600, 50);
}

// ---------- Tablero ----------
function createDash(sc) {
  const d = sc.ho(sc.add.graphics());
  const tb = sc.ho(sc.add.graphics());
  // marco del parabrisas
  d.fillStyle(0x1f2226);
  d.fillRect(0, 0, W, 22);
  sc.route = sc.ho(sc.add.text(W / 2, 11, '601  ADUANA - REÑACA', { fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: '#ffb000' }).setOrigin(0.5));
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
  tb.fillStyle(0x1b2733, 0.92).fillRoundedRect(110, 30, 175, 44, 10).fillRoundedRect(W - 285, 30, 175, 44, 10);
  sc.mir = sc.ho(sc.add.graphics());
  sc.prog = sc.ho(sc.add.graphics());
  sc.doorG = sc.ho(sc.add.graphics());
  sc.tSpeed = sc.ho(sc.add.text(590, 560, '0', st('18px', '#f2efe6')).setOrigin(0.5));
  sc.kmh = sc.ho(sc.add.text(590, 578, 'km/h', st('11px', '#9aa3ad')).setOrigin(0.5));
  sc.tFast = sc.ho(sc.add.text(W - 20, H - 16, '', st('24px', '#f2efe6')).setOrigin(1, 1));
  sc.ho(sc.add.text(20, H - 14, 'B4: CAMBIAR VISTA', st('12px', '#9aa3ad')).setOrigin(0, 1));
  sc.water = sc.ho(sc.add.rectangle(W / 2, H / 2, W, H, 0x1f5f8b, 1).setAlpha(0).setDepth(4));
  sc.door = sc.ho(sc.add.graphics());
  sc.lblDoor = sc.ho(sc.add.text(470, 560, 'B2 PUERTA', st('11px', '#9aa3ad')).setOrigin(0.5));
  sc.cock = [d, sc.route, sc.needle, sc.wheel, sc.tSpeed, sc.kmh, sc.lblDoor, sc.door, sc.doorG];
  sc.tStop = sc.ho(sc.add.text(W / 2, 134, '', st('15px', '#e8c547')).setOrigin(0.5));
  sc.tTop = sc.ho(sc.add.text(197, 52, '', st('18px', '#f2efe6')).setOrigin(0.5));
  sc.tCash = sc.ho(sc.add.text(W - 197, 52, '', st('20px', '#ffd23f')).setOrigin(0.5));
  sc.tPaco = sc.ho(sc.add.text(W / 2, 84, '', st('13px', '#ff5e5b')).setOrigin(0.5));
  sc.tTramo = sc.ho(sc.add.text(W / 2, 116, '', st('13px', '#6fc2d0')).setOrigin(0.5));
  sc.tDoor = sc.ho(sc.add.text(W - 170, 445, 'PUERTA ABIERTA', st('14px', '#7cfc00')).setOrigin(0.5).setAlpha(0));
}

function refreshDash(sc) {
  const p = sc.p;
  const sp = p.v / MAXV;
  sc.wheel.setRotation(p.steer * 1.1);
  sc.door.clear().fillStyle(p.door ? 0x7cfc00 : 0x3a3e45).fillCircle(470, 535, 13);
  const an = Math.PI * (0.8 + sp * 1.4);
  sc.needle.clear().lineStyle(4, 0xe25c3b).lineBetween(0, 0, Math.cos(an) * 44, Math.sin(an) * 44);
  sc.tSpeed.setText(Math.round(sp * 90));
  sc.tFast.setText(sc.chase ? Math.round(sp * 90) + ' km/h' : '');
  sc.tTop.setText('PASAJEROS ' + p.pax).setColor(p.pax <= 4 ? '#ff5e5b' : '#f2efe6');
  sc.tCash.setText('$ ' + sc.cash.toLocaleString('es-CL'));
  const d = sc.paco.d;
  sc.tPaco.setText(sc.win ? '' : 'PACOS A ' + Math.max(0, Math.round(d / 100)) + ' m').setColor(d < 9000 ? '#ff5e5b' : '#f2efe6');
  // progreso de la ruta: un punto por hito, la micro avanza por la línea
  const pg = sc.prog.clear();
  const x0 = 150;
  const x1 = W - 150;
  pg.lineStyle(3, 0x1b2733).lineBetween(x0, 102, x1, 102);
  const zx = (z) => x0 + (x1 - x0) * Phaser.Math.Clamp(z / (FIN * SEG), 0, 1);
  pg.lineStyle(3, 0x6fc2d0).lineBetween(x0, 102, zx(p.z), 102);
  pg.fillStyle(0xf2efe6).fillCircle(x0, 102, 5);
  T.forEach((tr, k) => pg.fillStyle(p.z >= tr.i1 * SEG ? 0x6fc2d0 : 0xf2efe6).fillCircle(zx(Math.min(FIN, tr.i1) * SEG), 102, k === 6 ? 7 : 5));
  pg.fillStyle(0xffd23f).fillRect(zx(p.z) - 7, 95, 14, 9);
  const tr = T[Math.max(0, sc.tr)];
  sc.tTramo.setText(sc.win ? '' : '▶ ' + tr.n + '   ' + (sc.tr + 1) + '/7');
  // puerta plegable a la derecha del chofer: dos hojas de vidrio que se doblan
  const dk = sc.doorK;
  const dg = sc.doorG.clear();
  const dw = 120 * (1 - dk * 0.85);
  dg.fillStyle(0x1f2226).fillRect(W - 236, 300, 8, 168);
  for (let h = 0; h < 2; h++) {
    const x0 = W - 228 + h * dw * 0.5;
    dg.fillStyle(0x8fb3c7, 0.15).fillRect(x0, 300, dw * 0.5, 168);
    dg.lineStyle(4, 0x1f2226).strokeRect(x0, 300, dw * 0.5, 168).lineBetween(x0, 384, x0 + dw * 0.5, 384);
  }
  sc.tDoor.setAlpha(dk > 0.5 ? 1 : 0);
  // espejo retrovisor: el radiopatrulla verde y blanco crece al acercarse
  const m = sc.mir.clear();
  m.fillStyle(0x111111).fillRoundedRect(W / 2 - 98, 24, 196, 52, 8);
  m.fillGradientStyle(0xc9d6de, 0xc9d6de, 0x6d6862, 0x6d6862).fillRect(W / 2 - 90, 29, 180, 42);
  const k = Phaser.Math.Clamp(1 - d / 26000, 0.08, 1);
  const cw = 26 + 120 * k;
  const ch = 10 + 30 * k;
  const by = 71;
  m.fillStyle(0xf2efe6).fillRect(W / 2 - cw / 2, by - ch, cw, ch);
  m.fillStyle(0x1f7a3c).fillRect(W / 2 - cw / 2, by - ch * 0.45, cw, ch * 0.22);
  m.fillStyle(0x243746).fillRect(W / 2 - cw * 0.36, by - ch * 0.9, cw * 0.72, ch * 0.35);
  const fl = Math.floor(sc.now / 160) % 2;
  m.fillStyle(fl ? 0xff2d2d : 0x2d6bff).fillRect(W / 2 - cw * 0.3, by - ch - 4 - 4 * k, cw * 0.28, 4 + 4 * k);
  m.fillStyle(fl ? 0x2d6bff : 0xff2d2d).fillRect(W / 2 + cw * 0.02, by - ch - 4 - 4 * k, cw * 0.28, 4 + 4 * k);
  // cuando están encima, la cabina parpadea rojo y azul
  if (d < 6000 && !sc.over && !sc.win) m.fillStyle(fl ? 0xff2d2d : 0x2d6bff, 0.12 * (1 - d / 6000)).fillRect(0, 0, W, H);
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
    else if (type === 'bell') (tone(1568, 1560, 0.3, 'sine', 0.18), tone(1319, 1310, 0.4, 'sine', 0.18, 0.32));
    else if (type === 'coin') (tone(988, 988, 0.06, 'square', 0.07), tone(1319, 1319, 0.12, 'square', 0.07, 0.06));
    else if (type === 'sirA') tone(720, 960, 0.42, 'triangle', 0.07);
    else if (type === 'sirB') tone(960, 720, 0.42, 'triangle', 0.07);
    else if (type === 'door') tone(2400, 300, 0.3, 'sawtooth', 0.05);
    else if (type === 'thud') tone(140, 35, 0.3, 'sine', 0.35);
    else if (type === 'whoosh') tone(300, 900, 0.4, 'triangle', 0.05);
    else if (type === 'boom') (tone(90, 30, 0.5, 'sine', 0.25), tone(1800, 200, 0.25, 'sawtooth', 0.03));
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
