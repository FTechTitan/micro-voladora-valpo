// Micro Voladora Valpo — versión LATERAL con física real (Matter.js, incluido en Phaser)
// 1 o 2 jugadores: cada micro es un chasis con dos ruedas con suspensión y 20 pasajeros que son
// cuerpos físicos. En 2 jugadores la pantalla se parte: P1 arriba, P2 abajo, carrera a Reñaca.

const W = 800;
const H = 600;
const TL = 2600; // largo de cada tramo en píxeles
const END = 7 * TL; // la meta: Sector 5 de Reñaca
const BASE = 430; // altura base del suelo
const HORY = 330; // altura del horizonte en el mundo
const M = Phaser.Physics.Matter.Matter;
const CAT = [1, 2, 4]; // categorías de colisión: suelo, jugador 1, jugador 2

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

// ---------- Colores y ruta ----------
const mix = (a, b, f) => {
  const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * f;
  const g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * f;
  const bl = (a & 255) + ((b & 255) - (a & 255)) * f;
  return ((r | 0) << 16) | ((g | 0) << 8) | (bl | 0);
};
const NIGHT = 0x121a2a;
const HC = [0xe8c547, 0xc8553d, 0x3a8fb7, 0x4fa38a, 0xe07a5f, 0x8e6bb8, 0xf2e6c9, 0x2f7f9e, 0xd94f70, 0x9bc53d, 0xf29e4c, 0x6fc2d0];
const VC = [0xf2efe6, 0xe8e2d4, 0xdfe6ea, 0xf6f1e3, 0xcfd8dd];
// [nombre, cielo arriba, cielo abajo, mar, noche 0..1]
const T = [
  ['CONGRESO NACIONAL', 0x93aabb, 0xdde5ea, 0x2d6f9e, 0],
  ['CALETA PORTALES', 0x93aabb, 0xdde5ea, 0x2d6f9e, 0],
  ['U. SANTA MARÍA', 0x8db4cc, 0xe3ecf1, 0x2d6f9e, 0],
  ['CALETA ABARCA', 0x7fb2d6, 0xeaf2f6, 0x2a7fb0, 0],
  ['SHERATON MIRAMAR', 0xd98a5a, 0xf2c27a, 0x3a5f8a, 0.45],
  ['QUINTA VERGARA', 0x0b1230, 0x22365a, 0x0f2a44, 0.85],
  ['REÑACA · SECTOR 5', 0x070b1e, 0x1a2648, 0x0c2238, 1],
];
const trOf = (x) => Math.max(0, Math.min(6, Math.floor(x / TL)));
const hash = (k) => {
  const v = Math.sin(k * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};
// Cimas: subida suave y caída brusca después de la cresta, para despegar. Cada tramo más altas.
const RAMPS = [];
for (let k = 0; k < 7; k++) {
  RAMPS.push({ c: k * TL + 1000, h: 110 + k * 20, w: 420 });
  RAMPS.push({ c: k * TL + 1900, h: 160 + k * 24, w: 500 });
}
// Recreo: la calle se corta sobre el mar, después de la Santa María
const SEA0 = 3 * TL - 760;
const SEA1 = SEA0 + 380;
function gy(x) {
  let y = BASE + 60 * Math.sin(x / 430) + 30 * Math.sin(x / 150 + 1);
  for (const r of RAMPS) y -= r.h * Math.exp(-(((x - r.c) / (x < r.c ? r.w : r.w * 0.3)) ** 2));
  if (x > END - 1200) y = BASE + 40; // la playa: plana hasta la meta
  return y;
}

// ---------- Phaser ----------
new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game-root',
  backgroundColor: '#9fb8c8',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
  physics: { default: 'matter', matter: { gravity: { y: 1.15 }, positionIterations: 8, constraintIterations: 4, debug: false } },
  scene: { create, update },
});

function create(data) {
  const sc = this;
  createControls(sc);
  makeTextures(sc);
  sc.np = (data && data.np) | 0; // 0 = portada, 1 o 2 jugadores
  sc.now = 0;
  sc.ended = 0;
  sc.wobj = []; // objetos del mundo (los ignoran las cámaras del tablero)
  sc.wadd = (o) => (sc.wobj.push(o), o);
  buildWorld(sc);
  const n = Math.max(1, sc.np);
  sc.P = [];
  for (let k = 0; k < n; k++) sc.P.push(makePlayer(sc, k, 240, gy(240) - 90));
  setupCameras(sc);
  sc.ov = sc.add.container(0, 0).setScrollFactor(0).setDepth(30); // capa de portada y resultados
  for (const c of sc.cams) c.ignore(sc.ov);
  if (!sc.np) title(sc);
  // choques: suelo (para saber si hay ruedas apoyadas), mar y golpes fuertes
  const who = (l) => sc.P[+l.slice(-1) - 1];
  sc.matter.world.on('collisionactive', (ev) => {
    for (const pr of ev.pairs) {
      for (const b of [pr.bodyA, pr.bodyB]) if (b.label.startsWith('wheel') && (pr.bodyA.label === 'ground' || pr.bodyB.label === 'ground')) who(b.label).gnd = sc.now;
    }
  });
  sc.matter.world.on('collisionstart', (ev) => {
    for (const pr of ev.pairs) {
      const a = pr.bodyA;
      const b = pr.bodyB;
      const o = a.label === 'ground' || a.label === 'sea' ? b : a;
      const g = o === a ? b : a;
      if (!(o.label.startsWith('bus') || o.label.startsWith('wheel'))) continue;
      const P = who(o.label);
      if (g.label === 'sea' && !P.sea) toSea(sc, P);
      if (g.label === 'ground') {
        const v = Math.abs(o.velocity.y);
        if (v > 9 && sc.now > P.thudT) {
          P.thudT = sc.now + 300;
          sfx(sc, 'thud');
          P.cam.shake(200, Math.min(0.02, v * 0.0012));
        }
      }
    }
  });
}

function update(time, delta) {
  const sc = this;
  const dt = Math.min(delta / 1000, 0.033);
  sc.now = time;
  const pr = sc.controls.pressed;
  const hd = sc.controls.held;
  if (!sc.np) {
    if (pr.START1 || pr.P1_1) sc.scene.restart({ np: 1 });
    if (pr.START2 || pr.P2_1) sc.scene.restart({ np: 2 });
  } else if (sc.ended) {
    if (time > sc.ended + 1500 && (pr.START1 || pr.START2 || pr.P1_1 || pr.P2_1)) sc.scene.restart({ np: 0 });
  }
  for (const P of sc.P) {
    if (sc.np && !P.done && !sc.ended) {
      drive(sc, P, hd, pr, dt);
      updatePax(sc, P, dt);
      updatePacos(sc, P, dt);
      const tr = trOf(P.B.position.x);
      if (tr !== P.tr) {
        P.tr = tr;
        if (tr > 0) {
          sfx(sc, 'bell');
          say(sc, P, '▶ ' + T[tr][0], '#6fc2d0');
          P.cash += 500;
        }
      }
      if (P.B.position.x > END) finish(sc, P, 1);
      if (P.B.position.y > 1500) toSea(sc, P); // se cayó a un hoyo: lo tratamos como al mar
    }
    P.bus.setPosition(P.B.position.x, P.B.position.y).setRotation(P.B.angle);
    updateSky(sc, P, dt, time);
    drawBg(sc, P);
    refreshHud(sc, P);
  }
  if (sc.np && !sc.ended) checkEnd(sc, time);
  engine(sc);
  for (const k in pr) pr[k] = false;
}

// ---------- Jugadores y cámaras ----------
function makePlayer(sc, k, x, y) {
  const P = { k, key: 'P' + (k + 1) + '_', B: null, wheels: [], pax: [], paco: { x: -700 }, inside: 20, t0: 0, lostN: 0, flipT: 0, jumpT: 0, sirT: 0, fwT: 0, thudT: 0, gnd: 0, sea: 0, done: 0, win: 0, cash: 0, tr: -1, fw: [], sky: { a: T[0][1], b: T[0][2], m: T[0][3], n: 0 } };
  const Bd = M.Body;
  const Bo = sc.matter.bodies;
  const cf = { category: CAT[k + 1], mask: CAT[0] | CAT[k + 1] };
  const lab = (s) => s + (k + 1);
  const o = { friction: 0.4, density: 0.0025, label: lab('bus'), collisionFilter: cf };
  // chasis: piso, paredes delantera y trasera y techo con una escotilla al medio
  const parts = [
    Bo.rectangle(0, 20, 150, 10, o),
    Bo.rectangle(-72, -4, 10, 56, o),
    Bo.rectangle(72, -4, 10, 56, o),
    Bo.rectangle(-48, -30, 52, 6, o),
    Bo.rectangle(48, -30, 52, 6, o),
  ];
  const body = Bd.create({ parts, friction: 0.4, restitution: 0.1, label: lab('bus'), collisionFilter: cf });
  Bd.setPosition(body, { x, y });
  sc.matter.world.add(body);
  P.B = body;
  // la imagen se sincroniza a mano con el cuerpo (el compuesto descoloca el origen automático)
  P.bus = sc.wadd(sc.add.image(x, y, 'bus' + k).setDepth(3));
  P.wheels = [-50, 50].map((ox) => {
    const w = sc.matter.add.image(x + ox, y + 34, 'wheel', null, { shape: { type: 'circle', radius: 20 }, friction: 1.1, density: 0.004, restitution: 0.05, label: lab('wheel'), collisionFilter: cf });
    sc.wadd(w.setDepth(4));
    // suspensión: dos resortes en triángulo por rueda, para que la rueda suba y baje sin pendulear
    sc.matter.add.constraint(body, w.body, 34, 0.2, { pointA: { x: ox, y: 0 }, damping: 0.12 });
    sc.matter.add.constraint(body, w.body, 52, 0.2, { pointA: { x: ox - Math.sign(ox) * 40, y: 0 }, damping: 0.12 });
    return w;
  });
  // pasajeros: 20 cuerpos chicos adentro
  for (let j = 0; j < 20; j++) {
    const p = sc.matter.add.image(x - 55 + (j % 10) * 12, y - 6 - Math.floor(j / 10) * 13, 'pax' + (j % 3), null, { shape: { type: 'circle', radius: 6 }, density: 0.0006, friction: 0.2, frictionAir: 0.01, restitution: 0.35, label: lab('pax'), collisionFilter: cf });
    sc.wadd(p.setDepth(2));
    p.out = 0;
    p.lost = 0;
    P.pax.push(p);
  }
  P.pacoCar = sc.wadd(sc.add.image(-700, 0, 'paco').setDepth(3).setVisible(false));
  P.bg = sc.wadd(sc.add.graphics().setDepth(-10));
  return P;
}

// 1 jugador: una cámara a pantalla completa. 2 jugadores: mitad arriba y mitad abajo.
// Cada jugador tiene una cámara del mundo y una del tablero (sin zoom); una más dibuja la portada.
function setupCameras(sc) {
  const n = sc.P.length;
  const hh = n > 1 ? H / 2 : H;
  const zoom = n > 1 ? 0.72 : 1;
  sc.cams = [];
  sc.P.forEach((P, k) => {
    const y0 = k * hh;
    P.cam = k ? sc.cameras.add(0, y0, W, hh) : sc.cameras.main.setViewport(0, y0, W, hh);
    P.cam.setZoom(zoom).startFollow(P.bus, true, 0.12, 0.12).setFollowOffset(n > 1 ? -140 : -180, n > 1 ? 40 : 80);
    P.hud = sc.add.container(0, 0).setScrollFactor(0).setDepth(20);
    P.hudH = hh;
    P.hcam = sc.cameras.add(0, y0, W, hh);
    createHud(sc, P);
    sc.cams.push(P.cam, P.hcam);
  });
  sc.ucam = sc.cameras.add(0, 0, W, H);
  sc.cams.push(sc.ucam);
  for (const P of sc.P) {
    for (const Q of sc.P) {
      if (Q !== P) (P.cam.ignore(Q.bg), P.cam.ignore(Q.hud));
      P.hcam.ignore(Q.bg);
      if (Q !== P) P.hcam.ignore(Q.hud);
    }
    P.cam.ignore(P.hud);
    P.hcam.ignore(sc.wobj);
    sc.ucam.ignore(P.hud);
  }
  sc.ucam.ignore(sc.wobj);
}

function drive(sc, P, hd, pr, dt) {
  const Bd = M.Body;
  const B = P.B;
  const K = P.key;
  const grounded = sc.now - P.gnd < 80;
  const gas = hd[K + 'R'] || hd[K + 'U'];
  const brake = hd[K + 'L'] || hd[K + 'D'];
  for (const w of P.wheels) {
    const av = w.body.angularVelocity;
    if (gas) Bd.setAngularVelocity(w.body, Math.min(av + 0.1, 1.1));
    else if (brake) Bd.setAngularVelocity(w.body, Math.max(av - 0.06, -0.3));
    else Bd.setAngularVelocity(w.body, av * 0.985);
  }
  // el motor empuja el chasis mientras hay ruedas en el suelo (si no, no sube los cerros)
  if (gas && grounded) Bd.applyForce(B, B.position, { x: 0.018, y: 0 });
  if (brake && grounded) Bd.applyForce(B, B.position, { x: -0.012, y: 0 });
  // en el aire, el acelerador levanta la nariz y el freno la baja (como en Hill Climb)
  if (!grounded) {
    if (gas) Bd.setAngularVelocity(B, B.angularVelocity - 0.0035);
    if (brake) Bd.setAngularVelocity(B, B.angularVelocity + 0.0035);
  }
  // B1: brinco, solo con las ruedas apoyadas
  if (pr[K + '1'] && grounded && sc.now > P.jumpT) {
    P.jumpT = sc.now + 900;
    Bd.applyForce(B, B.position, { x: 0.02, y: -0.26 });
    sfx(sc, 'whoosh');
  }
  if (pr[K + '2']) {
    sfx(sc, 'horn');
    say(sc, P, '¡PIIIII!', '#f2efe6');
  }
  if (P.sea > 0) {
    P.sea -= dt;
    if (P.sea <= 0) respawn(sc, P, SEA1 + 160, true);
  }
  // de cabeza más de 2 s: la enderezan los pasajeros, pero se arrancan dos
  const up = Math.abs(((B.angle % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) < 0.9;
  if (up && Math.abs(B.velocity.x) < 2) {
    P.flipT += dt;
    if (P.flipT > 2) {
      P.flipT = 0;
      respawn(sc, P, B.position.x + 30, false);
      let n = 0;
      for (const p of P.pax) if (!p.lost && n < 2) (p.lost = 1, p.destroy(), n++);
      P.lostN += n;
      say(sc, P, '¡SE DIO VUELTA! LA ENDEREZARON  -' + n, '#ff7b5c');
      sfx(sc, 'crash');
    }
  } else P.flipT = 0;
}

// un pasajero está adentro si su centro cae dentro de la cabina
function updatePax(sc, P, dt) {
  const B = P.B;
  let inside = 0;
  for (const p of P.pax) {
    if (p.lost) continue;
    const dx = p.x - B.position.x;
    const dy = p.y - B.position.y;
    const c = Math.cos(-B.angle);
    const s = Math.sin(-B.angle);
    const lx = dx * c - dy * s;
    const ly = dx * s + dy * c;
    if (Math.abs(lx) < 80 && Math.abs(ly) < 40) {
      p.out = 0;
      inside++;
    } else {
      p.out += dt;
      if (p.out > 1.3 || p.y > B.position.y + 500) {
        p.lost = 1;
        p.setTint(0x888888);
        P.lostN++;
        sfx(sc, 'scream');
        say(sc, P, ['¡SE CAYÓ UNO!', '¡CHAO, CABALLERO!', '¡SE FUE VOLANDO!', '¡AY, MI ABUELITA!'][P.lostN % 4], '#ff7b5c');
        sc.time.delayedCall(4000, () => p.destroy());
      }
    }
  }
  P.inside = inside;
  if (inside === 0) finish(sc, P, 0, 1);
}

function updatePacos(sc, P, dt) {
  const B = P.B;
  if (!P.t0) {
    if (B.velocity.x < 3) return;
    P.t0 = sc.now;
    say(sc, P, '¡LOS PACOS TE VIERON VOLAR!', '#ff5e5b');
  }
  const pv = 230 + P.tr * 22 + (sc.now - P.t0) * 0.004;
  P.paco.x += pv * dt;
  const d = B.position.x - P.paco.x;
  if (d > 1600) P.paco.x = B.position.x - 1600;
  if (d < 900 && sc.now > P.sirT) {
    P.sirT = sc.now + 450;
    sc.sirH = !sc.sirH;
    sfx(sc, sc.sirH ? 'sirA' : 'sirB');
  }
  if (d <= 90) finish(sc, P, 0, 0);
  P.pacoCar.setPosition(P.paco.x, gy(P.paco.x) - 26).setVisible(P.t0 > 0);
}

function toSea(sc, P) {
  if (P.sea > 0) return;
  P.sea = 1.5;
  sfx(sc, 'splash');
  P.cam.shake(400, 0.02);
  P.cam.flash(300, 30, 95, 140);
  say(sc, P, '¡AL MAR!', '#6fc2d0');
  P.paco.x -= 300;
}

function respawn(sc, P, x, drown) {
  const Bd = M.Body;
  const y = gy(x) - 90;
  Bd.setPosition(P.B, { x, y });
  Bd.setVelocity(P.B, { x: 2, y: 0 });
  Bd.setAngle(P.B, 0);
  Bd.setAngularVelocity(P.B, 0);
  P.wheels.forEach((w, k) => {
    Bd.setPosition(w.body, { x: x + (k ? 50 : -50), y: y + 34 });
    Bd.setVelocity(w.body, { x: 2, y: 0 });
  });
  let k = 0;
  for (const p of P.pax) {
    if (p.lost) continue;
    if (drown && k++ % 2) {
      p.lost = 1;
      P.lostN++;
      p.destroy();
    } else {
      Bd.setPosition(p.body, { x: x - 55 + (k % 10) * 12, y: y - 10 });
      Bd.setVelocity(p.body, { x: 2, y: 0 });
    }
  }
  if (drown) say(sc, P, 'SE AHOGARON LA MITAD', '#ff7b5c');
}

// ---------- Mundo: suelo, casas, lugares ----------
function buildWorld(sc) {
  const g = sc.wadd(sc.add.graphics().setDepth(-3)); // suelo
  const hg = sc.wadd(sc.add.graphics().setDepth(-6)); // casas
  const lg = sc.wadd(sc.add.graphics().setDepth(-4)); // lugares
  const STEP = 36;
  // cuerpos del suelo: cadena de rectángulos inclinados
  let pts = [];
  const flush = () => {
    if (pts.length < 2) return (pts = []);
    const poly = pts.concat([{ x: pts[pts.length - 1].x, y: 1400 }, { x: pts[0].x, y: 1400 }]);
    g.fillStyle(0x5b5650).fillPoints(poly, true);
    g.lineStyle(6, 0x8a847a).strokePoints(pts, false, false);
    g.lineStyle(2, 0xe8c547, 0.8);
    for (let k = 0; k < pts.length - 1; k += 2) g.lineBetween(pts[k].x, pts[k].y + 10, pts[k + 1].x, pts[k + 1].y + 10);
    pts = [];
  };
  for (let x = -400; x < END + 1400; x += STEP) {
    if (x >= SEA0 && x < SEA1) {
      flush();
      continue;
    }
    const a = { x, y: gy(x) };
    const b = { x: x + STEP, y: gy(x + STEP) };
    pts.push(a);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const len = Math.hypot(b.x - a.x, b.y - a.y) + 6;
    sc.matter.add.rectangle((a.x + b.x) / 2 + Math.sin(ang) * 13, (a.y + b.y) / 2 + Math.cos(ang) * 13, len, 26, { isStatic: true, angle: ang, friction: 1, label: 'ground' });
  }
  pts.push({ x: END + 1400, y: gy(END + 1400) });
  flush();
  // el mar en el corte de Recreo
  sc.matter.add.rectangle((SEA0 + SEA1) / 2, 760, SEA1 - SEA0 + 400, 300, { isStatic: true, isSensor: true, label: 'sea' });
  g.fillStyle(0x2d6f9e).fillRect(SEA0 - 60, 520, SEA1 - SEA0 + 120, 900);
  g.fillStyle(0xdde5ea, 0.7).fillRect(SEA0 - 60, 520, SEA1 - SEA0 + 120, 6);
  // casas de Valpo subiendo el cerro detrás de la calle (de Viña, más altas y blancas; de noche, con luces)
  for (let x = -300; x < END + 1000; x += 46) {
    const tr = T[trOf(x)];
    const vina = trOf(x) >= 3;
    const beach = (x > TL * 1.5 && x < TL * 2 - 300) || (x > TL * 3.4 && x < TL * 4) || (x > TL * 4.5 && x < TL * 5) || x > TL * 6.4;
    if (beach) {
      hg.fillStyle(mix(0xe8d9a8, NIGHT, tr[4] * 0.6)).fillRect(x, gy(x) - 6, 46, 30);
      continue;
    }
    for (let r = 0; r < 3; r++) {
      if (hash(x * 0.37 + r) < 0.12) continue;
      const h = (40 + hash(x * 1.3 + r * 7) * 50) * (vina ? 1.6 : 1);
      const c = mix(vina ? VC[Math.floor(hash(x + r) * 5)] : HC[Math.floor(hash(x * 0.7 + r) * 12)], NIGHT, tr[4] * 0.8);
      const yb = gy(x + 23) - 8 - r * 48 - hash(x + 99 * r) * 20;
      hg.fillStyle(c).fillRect(x + (r % 2) * 20, yb - h, 42, h);
      hg.fillStyle(0x50565c).fillRect(x + (r % 2) * 20, yb - h, 42, 7);
      hg.fillStyle(tr[4] > 0.4 ? 0xffd27a : 0x243746).fillRect(x + (r % 2) * 20 + 12, yb - h + 16, 10, 12);
    }
  }
  // lugares icónicos al final de cada tramo, y la Aduana al partir
  drawLand(lg, 0, 60);
  for (let k = 0; k < 7; k++) drawLand(lg, k + 1, k * TL + TL - 520 - (k === 2 ? 560 : 0));
  for (let x = 6 * TL + 600; x < END - 600; x += 520) drawLand(lg, 8, x);
  // arco de meta
  const mx = END;
  lg.fillStyle(0xf2efe6).fillRect(mx - 8, gy(mx) - 220, 12, 220).fillRect(mx + 120, gy(mx) - 220, 12, 220);
  lg.fillStyle(0xffd23f).fillRect(mx - 20, gy(mx) - 250, 160, 44);
  for (let k = 0; k < 7; k++) lg.fillStyle(k % 2 ? 0x1b2733 : 0xd62828).fillRect(mx - 12 + k * 20, gy(mx) - 244, 12, 32);
}

// Cada lugar, dibujado con pocas formas, apoyado en el suelo en x
function drawLand(g, id, x) {
  const y0 = gy(x) - 4;
  const nt = T[trOf(x)][4];
  const dk = (c) => mix(c, NIGHT, nt * 0.6);
  const wl = nt > 0.4 ? 0xffd27a : 0x3b4a5a;
  const R = (ox, by, w, h, c) => g.fillStyle(c).fillRect(x + ox - w / 2, y0 - by - h, w, h);
  const Tr = (ox, by, w, h, c) => g.fillStyle(c).fillTriangle(x + ox - w / 2, y0 - by, x + ox + w / 2, y0 - by, x + ox, y0 - by - h);
  const Ci = (ox, by, r, c) => g.fillStyle(c).fillCircle(x + ox, y0 - by, r);
  if (id === 0) {
    // Aduana y el ascensor Artillería
    Tr(260, 0, 700, 420, 0x7d7a6e);
    R(0, 0, 300, 110, 0xf2e6c9);
    R(0, 110, 310, 14, 0xa0432f);
    for (let k = -3; k <= 3; k++) (R(k * 40, 20, 18, 30, wl), R(k * 40, 64, 18, 30, wl), Ci(k * 40, 94, 9, wl));
    g.lineStyle(5, 0x3b3f45).lineBetween(x + 170, y0 - 110, x + 420, y0 - 400);
    R(260, 215, 30, 26, 0xc8553d);
    R(470, 400, 120, 50, 0x9aa3ad);
  } else if (id === 1) {
    // Congreso
    R(0, 0, 360, 170, dk(0xb9b2a6));
    R(0, 0, 120, 460, dk(0xc9c2b4));
    for (let k = 0; k < 8; k++) for (let j = -1; j <= 1; j += 2) R(j * 30, 50 + k * 48, 14, 24, wl);
    R(-120, 0, 50, 80, 0x7a4b1e);
    R(-120, 26, 22, 34, 0xd9a77c);
    R(0, 460, 5, 80, 0x3b3f45);
    R(32, 510, 60, 16, 0xffffff);
    R(32, 494, 60, 16, 0xd62828);
    R(17, 510, 30, 16, 0x1b4aa0);
  } else if (id === 2) {
    // Caleta Portales: galpón, botes, lobos marinos
    R(90, 0, 280, 90, dk(0xd0d4d8));
    Tr(90, 90, 290, 50, dk(0xb0b6bb));
    [0xe8c547, 0x3a8fb7, 0xd62828, 0x4fa38a].forEach((c, k) => {
      g.fillStyle(c).fillEllipse(x - 240 + k * 80, y0 - 16, 70, 36);
      R(-240 + k * 80, 30, 5, 50, 0x5a3a1a);
    });
    g.fillStyle(0x6b4a2b).fillEllipse(x - 330, y0 - 14, 90, 34);
    Ci(-290, 26, 15, 0x7d5a36);
    R(-40, 0, 20, 60, 0x7d7a6e);
    R(-40, 60, 14, 30, 0xe8c547);
    Ci(-40, 98, 8, 0xe0b48a);
  } else if (id === 3) {
    // Santa María: castillo neogótico con torre y alas
    R(0, 0, 560, 70, dk(0x9c968c));
    R(-200, 70, 180, 190, dk(0xcfc6b2));
    R(200, 70, 180, 190, dk(0xcfc6b2));
    R(0, 70, 130, 500, dk(0xd8d0bc));
    for (let k = -1; k <= 1; k++) (Tr(k * 45, 570, 32, 80, dk(0xb0aa9e)), R(k * 34, 440, 12, 50, wl), R(k * 34, 300, 12, 50, wl));
    for (let k = -2; k <= 2; k++) for (const sd of [-200, 200]) (R(sd + k * 32, 130, 11, 60, wl), Tr(sd + k * 32, 190, 11, 14, wl));
    R(0, 70, 40, 80, 0x3b2a1a);
  } else if (id === 4) {
    // Reloj de Flores y palmeras
    Tr(0, 0, 700, 360, dk(0x6f8f5a));
    g.fillStyle(0xf2efe6).fillEllipse(x, y0 - 110, 200, 100);
    g.fillStyle(0x3e7a3a).fillEllipse(x, y0 - 110, 176, 80);
    for (let k = 0; k < 12; k++) Ci(Math.cos((k / 12) * 6.28) * 74, 110 + Math.sin((k / 12) * 6.28) * 32, 7, [0xff3b3b, 0xffd23f, 0xffffff, 0xff8ad6][k % 4]);
    g.lineStyle(5, 0x1b1b1b).lineBetween(x, y0 - 110, x + 60, y0 - 130).lineBetween(x, y0 - 110, x - 20, y0 - 150);
    for (const ox of [-260, 260]) {
      R(ox, 0, 12, 280, 0x7a5a3a);
      for (let k = 0; k < 6; k++) Tr(ox + Math.cos(k) * 40, 250 + Math.sin(k) * 22, 34, 70, 0x3e8a3a);
    }
    R(0, 360, 200, 90, dk(0xf2efe6));
  } else if (id === 5) {
    // Sheraton sobre el roquerío, con piscina
    R(0, 0, 420, 60, dk(0x55504a));
    R(60, 60, 200, 14, 0x2ad4d0);
    R(-110, 60, 190, 400, dk(0x6fa8d0));
    R(100, 60, 240, 300, dk(0x7fb6da));
    for (let k = 0; k < 7; k++) (R(-110, 80 + k * 54, 170, 12, nt > 0.4 ? 0xffd27a : 0xdff2fb), k < 5 && R(100, 80 + k * 54, 220, 12, nt > 0.4 ? 0xffd27a : 0xdff2fb));
    R(-110, 460, 210, 12, 0xf2efe6);
    g.fillStyle(0xffffff, 0.8).fillEllipse(x - 300, y0 - 20, 120, 40);
  } else if (id === 6) {
    // Quinta Vergara: portón, árboles, palacio y la Concha Acústica
    for (let k = -4; k <= 4; k++) R(k * 24, 0, 4, 110, 0x1b1b1b);
    R(0, 110, 200, 8, 0x1b1b1b);
    for (const [ox, r] of [[-260, 90], [-150, 70], [180, 80], [300, 100]]) (R(ox, 0, 18, 180, 0x3b2a1a), Ci(ox, 230, r, dk(0x1f4a2a)));
    R(0, 120, 230, 170, dk(0xf2efe6));
    for (let k = -2; k <= 2; k++) (R(k * 40, 160, 16, 60, wl), Tr(k * 40, 220, 16, 20, wl));
    Tr(-100, 290, 40, 70, dk(0xd9d2c0));
    Tr(100, 290, 40, 70, dk(0xd9d2c0));
    g.fillStyle(dk(0xf2efe6)).fillEllipse(x + 90, y0 - 400, 330, 220);
    R(90, 290, 330, 110, 0x1b2733);
    for (let k = 0; k < 3; k++) g.lineStyle(10, [0xff5e5b, 0x6fc2d0, 0xffd23f][k], 0.45).lineBetween(x + 90 + (k - 1) * 90, y0 - 400, x + 90 + (k - 1) * 260, y0 - 1100);
  } else if (id === 7) {
    // Reñaca: gaviota de flores y edificios escalonados
    Tr(50, 0, 700, 420, dk(0xb8a77a));
    g.lineStyle(9, 0xf2efe6).lineBetween(x - 120, y0 - 300, x - 50, y0 - 360).lineBetween(x - 50, y0 - 360, x + 20, y0 - 300);
    for (let k = 0; k < 6; k++) (R(100 + k * 32, k * 52, 200 - k * 32, 52, dk(k % 2 ? 0xf2efe6 : 0xe4ded0)), R(100 + k * 32, 16 + k * 52, 140 - k * 22, 16, nt > 0.4 ? 0xffd27a : 0x9fd3f0));
  } else if (id === 8) {
    for (let k = 0; k < 7; k++) (R(k * 30, k * 48, 190 - k * 24, 48, dk(k % 2 ? 0xf2efe6 : 0xdcd6c8)), R(k * 30, 14 + k * 48, 130 - k * 18, 16, nt > 0.4 ? 0xffd27a : 0x9fd3f0));
  }
}

// ---------- Fondo por jugador: cielo, bahía, cerros del frente, fuegos ----------
function updateSky(sc, P, dt, t) {
  const tr = T[trOf(P.B.position.x)];
  const f = Math.min(1, dt * 0.7);
  const k = P.sky;
  k.a = mix(k.a, tr[1], f);
  k.b = mix(k.b, tr[2], f);
  k.m = mix(k.m, tr[3], f);
  k.n += (tr[4] - k.n) * f;
  const fire = P.win ? 220 : trOf(P.B.position.x) === 6 ? 900 : 0;
  if (fire && t > P.fwT) {
    P.fwT = t + fire;
    P.fw.push({ x: 0.1 + Math.random() * 0.8, y: 0.5, vy: -(0.55 + Math.random() * 0.3), ty: 0.07 + Math.random() * 0.22, c: [0xff3b3b, 0xffd23f, 0x7cfc00, 0xffffff, 0xc86bff, 0x3ad0ff][Math.floor(Math.random() * 6)], sp: null });
  }
  P.fw = P.fw.filter((r) => {
    if (!r.sp) {
      r.y += r.vy * dt;
      if (r.y < r.ty) {
        r.sp = [];
        for (let j = 0; j < 22; j++) {
          const an = (j / 22) * Math.PI * 2;
          const sp = 0.15 + Math.random() * 0.15;
          r.sp.push({ x: r.x, y: r.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, l: 1 });
        }
        if (Math.random() < 0.5) sfx(sc, 'boom');
      }
      return true;
    }
    let alive = false;
    for (const s of r.sp) {
      s.l -= dt * 0.8;
      s.vy += 0.1 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.l > 0) alive = true;
    }
    return alive;
  });
}

// se dibuja en coordenadas del mundo sobre lo que ve la cámara del jugador
function drawBg(sc, P) {
  const g = P.bg;
  const sky = P.sky;
  const v = P.cam.worldView;
  const x0 = v.x - 40;
  const x1 = v.right + 40;
  const y0 = v.y - 40;
  const y1 = v.bottom + 40;
  const cy = HORY;
  g.clear();
  g.fillGradientStyle(sky.a, sky.a, sky.b, sky.b).fillRect(x0, y0, x1 - x0, Math.max(0, cy - y0));
  g.fillStyle(sky.m).fillRect(x0, cy, x1 - x0, Math.max(0, y1 - cy));
  if (sky.n > 0.5) for (let k = 0; k < 40; k++) g.fillStyle(0xffffff, (sky.n - 0.5) * 2 * hash(k * 3.1)).fillRect(x0 + ((hash(k) * 1400 - v.x * 0.02) % 1400 + 1400) % 1400 - 300, y0 + hash(k + 50) * (cy - y0 - 60), 2, 2);
  // barcos
  for (let k = 0; k < 5; k++) {
    const x = x0 + ((k * 230 - v.x * 0.08) % 1150 + 1150) % 1150 - 175;
    g.fillStyle(0x3b3f45).fillRect(x, cy + 6, 46, 7);
    g.fillStyle(sky.n > 0.5 ? 0xffd27a : k % 2 ? 0xc8553d : 0x3a8fb7).fillRect(x + 6, cy + 1, 26, 5);
  }
  // cerros del frente con casitas (lucecitas de noche), con parallax
  const hy = (x) => cy + 10 - Math.max(0, 62 * Math.sin(x / 190) + 38 * Math.sin(x / 71) + 28);
  const px = -v.x * 0.85;
  g.fillStyle(mix(0x7d7a6e, 0x0a0f1c, sky.n));
  g.beginPath();
  g.moveTo(x0, cy + 12);
  for (let x = x0; x <= x1; x += 12) g.lineTo(x, hy(x + px));
  g.lineTo(x1, cy + 12);
  g.closePath();
  g.fillPath();
  for (let x = x0; x <= x1; x += 7) {
    const q = Math.floor((x + px) / 7);
    const top = hy(q * 7);
    for (let j = 0; j < 4; j++) {
      const hh = hash(q * 7.13 + j);
      const y = top + 2 + hh * (cy + 8 - top);
      if (y < cy + 6 && hash(q + j * 31.7) < 0.75) g.fillStyle(sky.n > 0.5 ? 0xffd27a : HC[Math.floor(hh * 1000) % 12]).fillRect(q * 7 - px, y, sky.n > 0.5 ? 2 : 5, sky.n > 0.5 ? 2 : 4);
    }
  }
  g.fillStyle(sky.m, 0.5).fillRect(x0, cy + 14, x1 - x0, Math.max(0, y1 - cy - 14));
  // fuegos artificiales, en fracciones de lo que ve la cámara
  const fx = (r) => v.x + r * v.width;
  const fy = (r) => v.y + r * v.height;
  for (const r of P.fw) {
    if (!r.sp) {
      g.fillStyle(0xfff2b0).fillRect(fx(r.x) - 1.5, fy(r.y), 3, 10);
      continue;
    }
    for (const s of r.sp) if (s.l > 0) g.fillStyle(r.c, s.l).fillCircle(fx(s.x), fy(s.y), 2.6);
  }
}

// ---------- Portada, fin de partida y resultados ----------
const ST = (sz, c) => ({ fontFamily: 'monospace', fontSize: sz, fontStyle: 'bold', color: c, stroke: '#1b2733', strokeThickness: 7, align: 'center' });
const mmss = (ms) => Math.floor(ms / 60000) + ':' + ('0' + Math.floor((ms % 60000) / 1000)).slice(-2);
const money = (n) => '$ ' + n.toLocaleString('es-CL');

function title(sc) {
  const ov = sc.ov;
  ov.add(sc.add.rectangle(W / 2, H / 2, W, H, 0x10141a, 0.55));
  ov.add(sc.add.text(W / 2, 110, 'MICRO VOLADORA\nVALPO', ST('56px', '#ffd23f')).setOrigin(0.5));
  ov.add(sc.add.text(W / 2, 235, 'De la Aduana a Reñaca antes que te pillen los pacos.\nSi se da vuelta, los pasajeros se van.', ST('18px', '#f2efe6')).setOrigin(0.5));
  ov.add(sc.add.text(W / 2, 330, '► o ▲ ACELERA   ◄ o ▼ FRENA\nEN EL AIRE: ▲ LEVANTA LA NARIZ, ▼ LA BAJA\nB1 BRINCO   B2 BOCINA', ST('16px', '#9aa3ad')).setOrigin(0.5));
  const p1 = ov.add(sc.add.text(W / 2 - 190, 470, 'START 1\n1 JUGADOR', ST('26px', '#9bc53d')).setOrigin(0.5));
  const p2 = ov.add(sc.add.text(W / 2 + 190, 470, 'START 2\n2 JUGADORES\ncarrera a Reñaca', ST('26px', '#6fc2d0')).setOrigin(0.5));
  sc.tweens.add({ targets: [p1, p2], alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });
}

// why: 0 pacos, 1 sin pasajeros; win: llegó a Reñaca
function finish(sc, P, win, why) {
  if (P.done) return;
  P.done = sc.now;
  P.win = win;
  if (win) {
    // propina por pasajero vivo y bono por llegar: el primero gana el doble
    const first = !sc.P.some((Q) => Q !== P && Q.win);
    P.tip = P.inside * 1000;
    P.bono = first ? 10000 : 5000;
    P.cash += P.tip + P.bono;
    sfx(sc, 'bell');
    for (let k = 0; k < 6; k++) sc.time.delayedCall(600 + k * 500, () => sfx(sc, k % 2 ? 'sirA' : 'sirB'));
    say(sc, P, '¡LLEGASTE A REÑACA! +' + money(P.tip + P.bono), '#ffd23f');
    if (first && sc.P.length > 1) {
      sc.closeT = sc.now + 15000;
      for (const Q of sc.P) if (Q !== P && !Q.done) say(sc, Q, '¡LLEGÓ EL OTRO! TIENES 15 s', '#ff5e5b');
    }
  } else {
    P.why = why;
    sfx(sc, 'crash');
    say(sc, P, why ? '¡SIN PASAJEROS!' : '¡TE PILLARON LOS PACOS!', '#ff5e5b');
  }
}

function checkEnd(sc, t) {
  const Ps = sc.P;
  const n = Ps.length;
  const allDone = Ps.every((P) => P.done);
  const someWin = Ps.some((P) => P.win);
  // en carrera, cuando llega el primero el otro tiene 15 s; después se comparan las platas
  if (!(allDone || (n > 1 && someWin && t > sc.closeT))) return;
  for (const P of Ps) if (!P.done) finish(sc, P, 0, 2);
  sc.ended = t;
  const ov = sc.ov;
  ov.add(sc.add.rectangle(W / 2, H / 2, W, H, 0x10141a, 0.78));
  const line = (P) => (P.win ? 'Llegó a Reñaca en ' + mmss(P.done - P.t0) + ' con ' + P.inside + ' pasajeros\npropina ' + money(P.tip) + ' + bono ' + money(P.bono) : (P.why === 2 ? 'No alcanzó a llegar' : P.why ? 'Se quedó sin pasajeros' : 'Lo pillaron los pacos') + ' en ' + T[Math.max(0, P.tr)][0] + '\n' + P.inside + ' pasajeros vivos') + '\nRECAUDÓ ' + money(P.cash);
  if (n === 1) {
    const P = Ps[0];
    ov.add(sc.add.text(W / 2, 150, P.win ? '¡LLEGASTE A REÑACA!\n¡FELIZ AÑO NUEVO!' : P.why ? '¡TE QUEDASTE\nSIN PASAJEROS!' : '¡TE PILLARON\nLOS PACOS!', ST('44px', P.win ? '#ffd23f' : '#ff5e5b')).setOrigin(0.5));
    ov.add(sc.add.text(W / 2, 300, line(P), ST('20px', '#f2efe6')).setOrigin(0.5));
  } else {
    // gana el que recaudó más: llegar primero y traer pasajeros vivos es lo que paga
    const w = Ps[0].cash === Ps[1].cash ? null : Ps[0].cash > Ps[1].cash ? Ps[0] : Ps[1];
    ov.add(sc.add.text(W / 2, 100, w ? '¡GANA EL JUGADOR ' + (w.k + 1) + '!' : '¡EMPATE!', ST('48px', w && w.k ? '#6fc2d0' : '#ffd23f')).setOrigin(0.5));
    Ps.forEach((P, k) => ov.add(sc.add.text(W / 2, 215 + k * 135, 'JUGADOR ' + (k + 1) + '\n' + line(P), ST('17px', k ? '#6fc2d0' : '#9bc53d')).setOrigin(0.5)));
  }
  const pr = ov.add(sc.add.text(W / 2, 500, 'START para otro turno', ST('20px', '#9bc53d')).setOrigin(0.5));
  sc.tweens.add({ targets: pr, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
}

function say(sc, P, txt, col) {
  const y = P.hudH * 0.42;
  const t = sc.add.text(W / 2, y + 40, txt, { fontFamily: 'monospace', fontSize: P.hudH < H ? '22px' : '26px', fontStyle: 'bold', color: col, stroke: '#1b2733', strokeThickness: 6, align: 'center' }).setOrigin(0.5);
  P.hud.add(t);
  sc.tweens.add({ targets: t, y: y - 10, alpha: 0, delay: 600, duration: 1100, onComplete: () => t.destroy() });
}

// ---------- Texturas: las micros, las ruedas, los pasajeros, el radiopatrulla ----------
function makeTextures(sc) {
  const g = sc.make.graphics({ add: false });
  // micro de 150x64, centro en (75,32): blanca con franjas, ventanas transparentes y escotilla
  [[0xc8553d, 0x2f7f9e], [0xe8c547, 0x1b4aa0]].forEach((cs, k) => {
    g.clear();
    g.fillStyle(0xf2efe6).fillRoundedRect(0, 4, 150, 56, 8);
    g.fillStyle(cs[0]).fillRect(0, 40, 150, 8);
    g.fillStyle(cs[1]).fillRect(0, 48, 150, 4);
    g.fillStyle(0x1f2b36, 0.35);
    for (let j = 0; j < 4; j++) g.fillRect(14 + j * 30, 12, 22, 20);
    g.fillStyle(0x1f2b36, 0.5).fillRect(128, 10, 18, 26); // parabrisas
    g.fillStyle(0x111111).fillRect(0, 0, 150, 5);
    g.fillStyle(0xffb000).fillRect(60, 1, 30, 3);
    g.fillStyle(0xd62828).fillRect(0, 22, 5, 14);
    g.fillStyle(0xffd23f).fillRect(145, 22, 5, 14);
    g.generateTexture('bus' + k, 150, 64);
  });
  g.clear();
  g.fillStyle(0x111111).fillCircle(20, 20, 20);
  g.fillStyle(0x8a8a8a).fillCircle(20, 20, 9);
  g.fillStyle(0xdddddd).fillRect(18, 2, 4, 12);
  g.generateTexture('wheel', 40, 40);
  [0x3a6ea5, 0xc8553d, 0x4f9d69].forEach((c, i) => {
    g.clear();
    g.fillStyle(c).fillCircle(6, 6, 6);
    g.fillStyle(0xe0b48a).fillCircle(6, 4, 3.5);
    g.generateTexture('pax' + i, 12, 12);
  });
  g.clear();
  g.fillStyle(0xf2efe6).fillRoundedRect(0, 14, 90, 36, 6);
  g.fillStyle(0x1f7a3c).fillRect(0, 36, 90, 8);
  g.fillStyle(0x243746).fillRect(14, 18, 50, 14);
  g.fillStyle(0xff2d2d).fillRect(30, 6, 14, 8);
  g.fillStyle(0x2d6bff).fillRect(46, 6, 14, 8);
  g.fillStyle(0x111111).fillCircle(20, 50, 9).fillCircle(70, 50, 9);
  g.generateTexture('paco', 90, 60);
  g.destroy();
}

// ---------- Tablero por jugador (en su propia cámara, sin zoom) ----------
function createHud(sc, P) {
  const st = (sz, col) => ({ fontFamily: 'monospace', fontSize: sz, fontStyle: 'bold', color: col });
  const hud = P.hud;
  const add = (o) => (hud.add(o), o);
  const col = P.k ? '#6fc2d0' : '#9bc53d';
  const tb = add(sc.add.graphics());
  tb.fillStyle(0x1b2733, 0.92).fillRoundedRect(20, 14, 190, 40, 10).fillRoundedRect(W - 210, 14, 190, 40, 10);
  if (sc.np > 1) add(sc.add.text(W / 2, 14, 'JUGADOR ' + (P.k + 1), st('13px', col)).setOrigin(0.5, 0));
  P.tTop = add(sc.add.text(115, 34, '', st('17px', '#f2efe6')).setOrigin(0.5));
  P.tCash = add(sc.add.text(W - 115, 34, '', st('19px', '#ffd23f')).setOrigin(0.5));
  P.tPaco = add(sc.add.text(W / 2, 34, '', st('13px', '#ff5e5b')).setOrigin(0.5));
  P.tTramo = add(sc.add.text(W / 2, 84, '', st('12px', '#6fc2d0')).setOrigin(0.5));
  P.tSpeed = add(sc.add.text(W - 20, P.hudH - 12, '', st('20px', '#f2efe6')).setOrigin(1, 1));
  P.prog = add(sc.add.graphics());
}

function refreshHud(sc, P) {
  const B = P.B;
  P.tTop.setText('PASAJEROS ' + P.inside).setColor(P.inside <= 4 ? '#ff5e5b' : '#f2efe6');
  P.tCash.setText(money(P.cash));
  const d = B.position.x - P.paco.x;
  P.tPaco.setText(P.done || !P.t0 ? '' : 'PACOS A ' + Math.max(0, Math.round(d / 10)) + ' m').setColor(d < 500 ? '#ff5e5b' : '#f2efe6');
  P.tSpeed.setText(Math.round(Math.abs(B.velocity.x) * 6) + ' km/h');
  const pg = P.prog.clear();
  const x0 = 150;
  const x1 = W - 150;
  const zx = (x) => x0 + (x1 - x0) * Phaser.Math.Clamp(x / END, 0, 1);
  pg.lineStyle(3, 0x1b2733).lineBetween(x0, 70, x1, 70);
  pg.lineStyle(3, 0x6fc2d0).lineBetween(x0, 70, zx(B.position.x), 70);
  pg.fillStyle(0xf2efe6).fillCircle(x0, 70, 5);
  for (let k = 0; k < 7; k++) pg.fillStyle(B.position.x >= (k + 1) * TL ? 0x6fc2d0 : 0xf2efe6).fillCircle(zx((k + 1) * TL), 70, k === 6 ? 7 : 5);
  pg.fillStyle(0xffd23f).fillRect(zx(B.position.x) - 7, 63, 14, 9);
  // en carrera, el rival también va en la barra
  for (const Q of sc.P) if (Q !== P) pg.fillStyle(0x6fc2d0, 0.8).fillRect(zx(Q.B.position.x) - 5, 64, 10, 7);
  P.tTramo.setText(P.done || !sc.np ? '' : '▶ ' + T[Math.max(0, P.tr)][0] + '   ' + (P.tr + 1) + '/7');
  if (d < 400 && P.t0 && !P.done) pg.fillStyle(Math.floor(sc.now / 160) % 2 ? 0xff2d2d : 0x2d6bff, 0.12 * (1 - d / 400)).fillRect(0, 0, W, P.hudH);
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
      sc.events.once('shutdown', () => {
        o.stop();
        sc.eng = null;
      });
    }
    let sp = 0;
    for (const P of sc.P) sp = Math.max(sp, Math.min(1, Math.abs(P.wheels[0].body.angularVelocity) / 0.6));
    sc.eng.frequency.setTargetAtTime(45 + sp * 130, ctx.currentTime, 0.1);
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
    else if (type === 'splash') tone(900, 120, 0.25, 'sawtooth', 0.1);
    else if (type === 'bell') (tone(1568, 1560, 0.3, 'sine', 0.18), tone(1319, 1310, 0.4, 'sine', 0.18, 0.32));
    else if (type === 'sirA') tone(720, 960, 0.42, 'triangle', 0.07);
    else if (type === 'sirB') tone(960, 720, 0.42, 'triangle', 0.07);
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
