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
// [entrada, tramo, salida, curva, desnivel]
[
  [10, 40, 10, 0, 0],
  [25, 25, 25, -2, 1600],
  [10, 8, 6, 0, 3200],
  [3, 3, 3, 0, -2600],
  [20, 30, 20, 3, -1500],
  [10, 30, 10, 0, 0],
  [15, 15, 10, -3, 2800],
  [3, 4, 3, 2, -2400],
  [10, 6, 5, 0, 2600],
  [3, 3, 3, 0, -2200],
  [20, 20, 20, -4, 900],
  [20, 40, 20, 4, -1200],
  [10, 8, 6, 0, 3400],
  [3, 3, 3, -1, -2800],
  [8, 6, 5, 2, 2400],
  [3, 3, 3, 0, -2400],
  [25, 25, 25, 2, -400],
  [10, 30, 10, 0, 0],
  [10, 8, 4, 0, 1600],
  ['MAR', 9], // mirador: la calle se corta sobre el mar
  [10, 20, 10, 0, -800],
].forEach((r) => (r[0] === 'MAR' ? addGap(r[1]) : addRoad(...r)));
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
  sc.p = { z: 3000, x: 0, v: 0, y: 0, vy: 0, air: false, airT: 0, roll: 0, rv: 0, steer: 0, pax: 25 };
  sc.parts = [];
  sc.at = {};
  const put = (o) => ((sc.at[o.i] = sc.at[o.i] || []).push(o), o);
  sc.stops = [0.1, 0.42, 0.75].map((f) => put({ t: 'stop', i: Math.floor(N * f), n: 6, refill: 0 }));
  sc.dogs = [0.22, 0.55, 0.82].map((f, k) => put({ t: 'dog', i: Math.floor(N * f), x: 0, ph: k * 2, gone: 0 }));
  sc.curaos = [0.33, 0.66].map((f) => put({ t: 'curao', i: Math.floor(N * f), gone: 0, cd: 0 }));
  sc.dogs.push(...[0.06, 0.38, 0.92].map((f, k) => put({ t: 'dog', i: Math.floor(N * f), x: 0, ph: k * 3 + 1, gone: 0 })));
  sc.drunks = [0.16, 0.29, 0.49, 0.61, 0.71, 0.86].map((f, k) => put({ t: 'drunk', i: Math.floor(N * f), x: 0, ph: k * 1.7, gone: 0 }));
  // monedas: filas en una pista de la calle, y en el aire sobre el mar y las bajadas fuertes
  sc.coins = [];
  for (let i = 20; i < N - 5; i += 19) {
    const x = [-0.6, 0, 0.6][Math.floor(hash(i) * 3)];
    for (let k = 0; k < 5; k++) if (!S[i + k].sea) sc.coins.push(put({ t: 'coin', i: i + k, x, h: 450, l: -1 }));
  }
  for (let i = 1; i < N - 1; i++) if (S[i].sea || (S[i + 1].y - S[i].y < -150 && i % 2)) sc.coins.push(put({ t: 'coin', i, x: 0, h: S[i].sea ? 2200 : 1600, l: -1, air: 1 }));
  sc.paco = { d: 24000 };
  sc.cash = 0;
  sc.over = 0;
  sc.lap = 0;
  sc.doorK = 0;
  sc.t0 = 0;
  sc.doorT = 0;
  sc.req = null;
  sc.reqT = 0;
  const hint = sc.ho(sc.add.text(W / 2, 110, 'JOYSTICK: ▲ ACELERA  ▼ FRENA  ◄ ► GIRA\nB1 BOCINA  B2 PUERTA  B3 VISTA\n¡ARRANCA DE LOS PACOS Y JUNTA LUCAS!', { fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color: '#f2efe6', stroke: '#1b2733', strokeThickness: 5, align: 'center' }).setOrigin(0.5));
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
  const pr = sc.controls.pressed;
  if (sc.over) {
    if (time > sc.over + 1500 && (pr.START1 || pr.P1_1)) sc.scene.restart();
  } else {
    updatePlayer(sc, dt, time);
    updateStuff(sc, time, dt);
  }
  sc.doorK += ((sc.p.door ? 1 : 0) - sc.doorK) * Math.min(1, dt * 9);
  if (pr.P1_3) setView(sc, !sc.chase);
  sc.cameras.main.setRotation(sc.p.roll * (sc.chase ? 0.25 : 1));
  render(sc);
  updateParts(sc, dt);
  refreshDash(sc, dt);
  engine(sc);
  for (const k in pr) pr[k] = false;
}

// ---------- Física ----------
// ---------- Paradero, perros y curaos ----------
function updateStuff(sc, t, dt) {
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
  if (pr.P1_2) {
    p.door = !p.door;
    sfx(sc, 'door');
  }
  if (p.door && !p.air && t > sc.doorT) {
    if (sp > 0.35 && p.pax > 0) {
      sc.doorT = t + 500;
      losePax(sc, 1, '¡CIERRA LA PUERTA!');
    } else if (sp < 0.15) {
      const st = sc.stops.find((o) => (ahead(o.i) < 8 || ahead(o.i) > N - 3) && o.n > 0);
      if (st && p.x > 0.15) {
        st.n--;
        p.pax++;
        sc.cash += 700;
        sc.doorT = t + 280;
        st.refill = t + 6000;
        sfx(sc, 'pick');
        if (!st.n) say(sc, '¡SUBIERON TODOS!', '#9bc53d');
      }
    }
  }
  for (const st of sc.stops) if (st.n < 6 && t > st.refill) (st.n++, (st.refill = t + 3000));
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
  // curaos cruzando a lo loco
  for (const d of sc.drunks) {
    d.x = Math.sin(t * 0.0005 + d.ph) * 0.85 * RW + Math.sin(t * 0.004 + d.ph) * 0.12 * RW;
    if (!p.air && t > d.gone && ahead(d.i) === 0 && Math.abs(p.x * RW - d.x) < 600) {
      d.gone = t + 9000;
      p.v *= 0.35;
      sfx(sc, 'crash');
      sc.cameras.main.shake(200, 0.015);
      losePax(sc, 2, '¡EL CURAO SE TIRÓ AL CAPÓ!');
    }
  }
  // monedas
  const lap = Math.floor(p.z / (N * SEG));
  for (const c of sc.coins) {
    if (c.l !== lap && ahead(c.i) === 0 && Math.abs(p.x - c.x) < 0.35 && Math.abs(p.y + 500 - S[c.i].y - c.h) < 1200) {
      c.l = lap;
      sc.cash += c.air ? 300 : 100;
      sfx(sc, 'coin');
    }
  }
  sc.lap = lap;
  // los pacos: cada vez más rápidos; te alcanzan si frenas, chocas o caes al mar
  if (!sc.t0) {
    if (p.v < MAXV * 0.3) return;
    sc.t0 = t; // los pacos parten cuando la micro arranca
    say(sc, '¡LOS PACOS TE VIERON VOLAR!', '#ff5e5b');
  }
  const pv = MAXV * Math.min(0.86, 0.45 + (t - sc.t0) * 0.000004);
  sc.paco.d = Math.min(30000, sc.paco.d + (p.v - pv) * dt);
  if (sc.paco.d < 14000 && t > (sc.sirT || 0)) {
    sc.sirT = t + 450;
    sc.sirH = !sc.sirH;
    sfx(sc, sc.sirH ? 'sirA' : 'sirB');
  }
  if (sc.paco.d <= 0) gameOver(sc, t);
  // timbre: alguien pide bajarse más adelante
  if (!sc.reqT) sc.reqT = t + 8000;
  if (!sc.req && t > sc.reqT && p.pax > 0) {
    let i = (pi + 45) % N;
    while (S[i].sea || S[(i + 1) % N].sea || S[(i + N - 1) % N].sea) i = (i + 5) % N;
    sc.req = { i, n: Math.min(p.pax, 1 + Math.floor(Math.random() * 3)) };
    sfx(sc, 'bell');
    say(sc, '¡RIIING! SE BAJAN ' + sc.req.n, '#ffd23f');
  }
  if (sc.req) {
    const a = ahead(sc.req.i);
    if ((a < 6 || a > N - 4) && p.door && sp < 0.15 && !p.air && t > sc.doorT) {
      sc.req.n--;
      p.pax--;
      sc.cash += 500;
      sc.doorT = t + 320;
      sfx(sc, 'pick');
      say(sc, '¡GRACIAS, TÍO! +$500', '#9bc53d');
    } else if (a > N - 30 && a <= N - 4) {
      losePax(sc, sc.req.n, '¡ME PASÓ, CHOFER! SE TIRARON');
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
    if (!p.air && t > c.gone && t > c.cd && (a < 2 || a > N - 2) && p.x < -0.62) {
      c.cd = t + 3000;
      sfx(sc, 'splash');
      losePax(sc, 1, p.x < -1 ? '¡CASI LO ATROPELLAS!' : '¡PASASTE POR LA POZA!');
    }
  }
  sc.tStop.setText(
    sc.req
      ? '¡TIMBRE! BAJAN ' + sc.req.n + ' en ' + Math.max(0, Math.round((ahead(sc.req.i) % (N - 4)) * SEG / 100)) + ' m: frena y abre (B2)'
      : sc.stops.some((o) => ahead(o.i) < 45 && o.n > 0)
        ? 'PARADERO ▶ frena y abre la puerta (B2)'
        : ''
  );
}

function updatePlayer(sc, dt) {
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
      else land(sc, p, gy);
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

function gameOver(sc, t) {
  sc.over = t;
  sc.p.v = 0;
  sfx(sc, 'crash');
  const st = (sz, c) => ({ fontFamily: 'monospace', fontSize: sz, fontStyle: 'bold', color: c, stroke: '#1b2733', strokeThickness: 7, align: 'center' });
  sc.ho(sc.add.rectangle(W / 2, H / 2, W, H, 0x10141a, 0.78).setDepth(8));
  drawPaco(sc.ho(sc.add.graphics().setDepth(9)), t);
  sc.ho(sc.add.text(205, 92, '¿Así que andaba\nvolando, caballero?', { ...st('17px', '#1b2733'), strokeThickness: 0 }).setOrigin(0.5).setDepth(10));
  sc.ho(sc.add.text(560, 170, '¡TE PILLARON\nLOS PACOS!', st('46px', '#ff5e5b')).setOrigin(0.5).setDepth(9));
  sc.ho(sc.add.text(560, 310, 'Recaudaste\n$ ' + sc.cash.toLocaleString('es-CL') + '\nLlevabas ' + sc.p.pax + ' pasajeros', st('24px', '#ffd23f')).setOrigin(0.5).setDepth(9));
  const pr = sc.ho(sc.add.text(560, 440, 'START o B1\npara otra vuelta', st('20px', '#9bc53d')).setOrigin(0.5).setDepth(9));
  sc.tweens.add({ targets: pr, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
}

// Carabinero asomado a la ventana del chofer: uniforme verde, gorra con visera e insignia,
// bigote, guante blanco y la libreta de partes.
function drawPaco(g) {
  const V = 0x2e5e3a;
  const P = 0xd9a77c;
  // globo de diálogo
  g.fillStyle(0xf2efe6).fillRoundedRect(85, 55, 240, 74, 14).fillTriangle(180, 128, 215, 128, 205, 160);
  // radiopatrulla atrás con baliza
  g.fillStyle(0xf2efe6).fillRect(300, 420, 230, 120);
  g.fillStyle(0x1f7a3c).fillRect(300, 480, 230, 26);
  g.fillStyle(0xff2d2d).fillRect(340, 400, 60, 20);
  g.fillStyle(0x2d6bff).fillRect(420, 400, 60, 20);
  // cuerpo
  g.fillStyle(V).fillRoundedRect(70, 400, 270, 230, 40);
  g.fillStyle(0x9cb38a).fillTriangle(170, 400, 240, 400, 205, 470);
  g.fillStyle(0x1f3d27).fillRect(197, 420, 16, 90);
  g.fillStyle(0xd4af37).fillCircle(120, 450, 13).fillRect(270, 440, 40, 10);
  g.lineStyle(6, 0x1f3d27).lineBetween(70, 420, 140, 405).lineBetween(340, 420, 270, 405);
  // cuello y cabeza
  g.fillStyle(P).fillRect(180, 350, 50, 60);
  g.fillEllipse(205, 300, 130, 150);
  g.fillCircle(140, 305, 16).fillCircle(270, 305, 16);
  // cara seria
  g.fillStyle(0x1b1b1b).fillCircle(180, 298, 7).fillCircle(230, 298, 7);
  g.lineStyle(5, 0x3b2a1a).lineBetween(163, 280, 195, 287).lineBetween(247, 280, 215, 287);
  g.fillStyle(0x3b2a1a).fillEllipse(205, 340, 70, 18);
  g.lineStyle(3, 0x7a4b3a).lineBetween(190, 358, 220, 358);
  // gorra verde con visera negra e insignia dorada
  g.fillStyle(V).fillEllipse(205, 225, 170, 60);
  g.fillRect(140, 225, 130, 34);
  g.fillStyle(0x0f0f0f).fillEllipse(205, 262, 150, 22);
  g.fillStyle(0xd4af37).fillCircle(205, 238, 14);
  g.fillStyle(V).fillCircle(205, 238, 6);
  // brazo con guante blanco y libreta de partes
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
  losePax(sc, Math.max(5, Math.ceil(p.pax * 0.5)), '¡AL MAR!');
}

function land(sc, p, gy) {
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
  if (r > 0.42) {
    p.v *= 0.35;
    losePax(sc, Math.max(4, Math.ceil(p.pax * 0.6)), '¡CASI SE DA VUELTA!');
  } else if (r > 0.17) {
    p.v *= 0.75;
    losePax(sc, Math.max(2, Math.ceil(p.pax * 0.3)), '¡PUCHA, ATERRIZÓ CHUECO!');
  } else if (Math.abs(p.x) > 1.05) {
    losePax(sc, 2, '¡A LA VEREDA!');
  } else if (p.airT > 1) {
    losePax(sc, Math.ceil(p.airT), '¡VOLANDO ' + p.airT.toFixed(1) + ' s! SE SOLTARON');
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
  const ch = sc.chase;
  const cz = p.z - (ch ? BACK : 0);
  const cy = HOR + sc.pitch * (ch ? 0.4 : 1);
  const base = Math.floor(cz / SEG);
  const pct = (cz % SEG) / SEG;
  sc.camY += (Math.max(p.y, groundY(cz)) + 1800 - sc.camY) * (ch ? 0.12 : 1);
  const camY = ch ? sc.camY : p.y + CAMH;
  let bx = W / 2;
  sc.bgX += S[base % N].c * p.v * 0.00004;

  drawBay(g, cy, sc.bgX);

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
  let pr = null;
  let pl = null;
  for (let k = L.length - 1; k >= 1; k--) {
    const { i, a, b } = L[k];
    const alt = i & 1;
    if (S[i].sea) {
      // olas abajo, en el corte
      const wy = proj(0, S[i].y - 6000 - p.y - CAMH, (base + L[k].n) * SEG - cz, cy).y;
      if (wy < H + 300) g.fillStyle(0x2d6f9e).fillRect(-300, wy, W + 600, H + 300 - wy).fillStyle(0xdde5ea, 0.6).fillRect(-300, wy, W + 600, Math.max(1, a.s * 60));
      continue;
    }
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
    scLap = sc.lap + (base + L[k].n >= (sc.lap + 1) * N ? 1 : 0);
    for (const o of sc.at[i] || []) drawObj(g, a, o, sc.time.now);
    if (sc.req && i === sc.req.i) {
      const x = a.x + a.s * 1.12 * RW;
      const fl = Math.floor(sc.time.now / 250) % 2;
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

function person(g, a, ox, col) {
  const x = a.x + a.s * ox;
  g.fillStyle(0x2a2a2a).fillRect(x - a.s * 45, a.y - a.s * 260, a.s * 90, a.s * 260);
  g.fillStyle(col).fillRect(x - a.s * 60, a.y - a.s * 560, a.s * 120, a.s * 320);
  g.fillStyle(0xe0b48a).fillCircle(x, a.y - a.s * 640, a.s * 75);
}

let scLap = 0;
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
  } else if (o.t === 'coin' && o.l !== scLap) {
    const y = a.y - s * (o.h + 300);
    const x = a.x + s * o.x * RW;
    const sw = Math.abs(Math.cos(t * 0.006 + o.i));
    g.fillStyle(0xb8860b).fillEllipse(x, y, s * 520 * sw + 2, s * 520);
    g.fillStyle(0xffd23f).fillEllipse(x, y, s * 400 * sw + 1, s * 400);
  } else if (o.t === 'drunk' && t > o.gone) {
    person(g, a, o.x, 0x7a6a8c);
    const x = a.x + s * o.x;
    g.fillStyle(0x4f9d69).fillRect(x + s * 70, a.y - s * 520, s * 50, s * 140);
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
  const tb = sc.ho(sc.add.graphics());
  // marco del parabrisas
  d.fillStyle(0x1f2226);
  d.fillRect(0, 0, W, 22);
  sc.route = sc.ho(sc.add.text(W / 2, 11, '612  PLAYA ANCHA - CERRO ALEGRE', { fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: '#ffb000' }).setOrigin(0.5));
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
  sc.doorG = sc.ho(sc.add.graphics());
  sc.tSpeed = sc.ho(sc.add.text(590, 560, '0', st('18px', '#f2efe6')).setOrigin(0.5));
  sc.kmh = sc.ho(sc.add.text(590, 578, 'km/h', st('11px', '#9aa3ad')).setOrigin(0.5));
  sc.tFast = sc.ho(sc.add.text(W - 20, H - 16, '', st('24px', '#f2efe6')).setOrigin(1, 1));
  sc.ho(sc.add.text(20, H - 14, 'B3: CAMBIAR VISTA', st('12px', '#9aa3ad')).setOrigin(0, 1));
  sc.water = sc.ho(sc.add.rectangle(W / 2, H / 2, W, H, 0x1f5f8b, 1).setAlpha(0).setDepth(4));
  sc.door = sc.ho(sc.add.graphics());
  sc.lblDoor = sc.ho(sc.add.text(470, 560, 'B2 PUERTA', st('11px', '#9aa3ad')).setOrigin(0.5));
  sc.cock = [d, sc.route, sc.needle, sc.wheel, sc.tSpeed, sc.kmh, sc.lblDoor, sc.door, sc.doorG];
  sc.tStop = sc.ho(sc.add.text(W / 2, 92, '', st('16px', '#e8c547')).setOrigin(0.5));
  sc.tTop = sc.ho(sc.add.text(197, 52, '', st('18px', '#f2efe6')).setOrigin(0.5));
  sc.tCash = sc.ho(sc.add.text(W - 197, 52, '', st('20px', '#ffd23f')).setOrigin(0.5));
  sc.tPaco = sc.ho(sc.add.text(W / 2, 84, '', st('14px', '#ff5e5b')).setOrigin(0.5));
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
  sc.tTop.setText('PASAJEROS ' + p.pax);
  sc.tCash.setText('$ ' + sc.cash.toLocaleString('es-CL'));
  const d = sc.paco.d;
  sc.tPaco.setText('PACOS A ' + Math.max(0, Math.round(d / 100)) + ' m').setColor(d < 9000 ? '#ff5e5b' : '#f2efe6');
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
  const fl = Math.floor(sc.time.now / 160) % 2;
  m.fillStyle(fl ? 0xff2d2d : 0x2d6bff).fillRect(W / 2 - cw * 0.3, by - ch - 4 - 4 * k, cw * 0.28, 4 + 4 * k);
  m.fillStyle(fl ? 0x2d6bff : 0xff2d2d).fillRect(W / 2 + cw * 0.02, by - ch - 4 - 4 * k, cw * 0.28, 4 + 4 * k);
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
