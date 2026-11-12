// Micro Voladora Valpo — versión LATERAL con física real (Matter.js, incluido en Phaser)
// La micro es un chasis con dos ruedas con suspensión y 20 pasajeros que son cuerpos físicos:
// si aterrizas chueco, se dan vuelta, rebotan y salen volando por la escotilla y las ventanas.

const W = 800;
const H = 600;
const TL = 2600; // largo de cada tramo en píxeles
const END = 7 * TL; // la meta: Sector 5 de Reñaca
const BASE = 430; // altura base del suelo
const M = Phaser.Physics.Matter.Matter;

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
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
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

function create() {
  const sc = this;
  createControls(sc);
  makeTextures(sc);
  sc.now = 0;
  sc.over = 0;
  sc.win = 0;
  sc.cash = 0;
  sc.tr = -1;
  sc.gnd = 0;
  sc.sea = 0;
  sc.paco = { x: -700 };
  sc.fw = [];
  sc.parts = [];
  sc.sky = { a: T[0][1], b: T[0][2], m: T[0][3], n: 0 };
  sc.bg = sc.add.graphics().setScrollFactor(0).setDepth(-10);
  buildWorld(sc);
  buildBus(sc, 240, gy(240) - 90);
  sc.cameras.main.startFollow(sc.bus, true, 0.12, 0.12).setFollowOffset(-180, 80);
  createHud(sc);  // choques: suelo (para saber si hay ruedas apoyadas), mar y golpes fuertes
  sc.matter.world.on('collisionactive', (ev) => {
    for (const pr of ev.pairs) {
      const l = pr.bodyA.label + pr.bodyB.label;
      if (l.includes('wheel') && l.includes('ground')) sc.gnd = sc.now;
    }
  });
  sc.matter.world.on('collisionstart', (ev) => {
    for (const pr of ev.pairs) {
      const a = pr.bodyA;
      const b = pr.bodyB;
      const l = a.label + b.label;
      if (l.includes('sea') && (l.includes('bus') || l.includes('wheel')) && !sc.sea) toSea(sc);
      if (l.includes('ground') && (l.includes('bus') || l.includes('wheel'))) {
        const v = Math.abs((a.label === 'ground' ? b : a).velocity.y);
        if (v > 9 && sc.now > (sc.thudT || 0)) {
          sc.thudT = sc.now + 300;
          sfx(sc, 'thud');
          sc.cameras.main.shake(200, Math.min(0.02, v * 0.0012));
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
  const B = sc.bus.body;
  if (sc.over || sc.win) {
    if (time > (sc.over || sc.win) + 1500 && (pr.START1 || pr.P1_1)) sc.scene.restart();
  } else {
    drive(sc, hd, pr, dt);
    updatePax(sc, dt);
    updatePacos(sc, dt);
    const tr = trOf(B.position.x);
    if (tr !== sc.tr) {
      sc.tr = tr;
      if (tr > 0) {
        sfx(sc, 'bell');
        say(sc, '▶ ' + T[tr][0], '#6fc2d0');
        sc.cash += 500;
      }
    }
    if (B.position.x > END) winGame(sc, time);
    if (B.position.y > 1500) toSea(sc); // se cayó a un hoyo: lo tratamos como al mar
  }
  sc.bus.setPosition(B.position.x, B.position.y).setRotation(B.angle);
  updateSky(sc, dt, time);
  drawBg(sc);
  updateParts(sc, dt);
  refreshHud(sc);
  engine(sc);
  for (const k in pr) pr[k] = false;
}

// ---------- La micro ----------
function buildBus(sc, x, y) {
  const Bd = M.Body;
  const Bo = sc.matter.bodies;
  const o = { friction: 0.4, density: 0.0025, label: 'bus' };
  // chasis: piso, paredes delantera y trasera y techo con una escotilla al medio
  const parts = [
    Bo.rectangle(0, 20, 150, 10, o),
    Bo.rectangle(-72, -4, 10, 56, o),
    Bo.rectangle(72, -4, 10, 56, o),
    Bo.rectangle(-48, -30, 52, 6, o),
    Bo.rectangle(48, -30, 52, 6, o),
    Bo.rectangle(0, 0, 150, 60, { ...o, isSensor: true, label: 'cabin' }),
  ];
  const body = Bd.create({ parts, friction: 0.4, restitution: 0.1, label: 'bus' });
  Bd.setPosition(body, { x, y });
  sc.matter.world.add(body);
  // la imagen se sincroniza a mano con el cuerpo (el compuesto descoloca el origen automático)
  const bus = sc.add.image(x, y, 'bus').setDepth(3);
  bus.body = body;
  sc.bus = bus;
  sc.cabin = parts[5];
  sc.wheels = [-50, 50].map((ox) => {
    const w = sc.matter.add.image(x + ox, y + 34, 'wheel', null, { shape: { type: 'circle', radius: 20 }, friction: 1.1, density: 0.004, restitution: 0.05, label: 'wheel' });
    w.setDepth(4);
    // suspensión: dos resortes en triángulo por rueda, para que la rueda suba y baje sin pendulear
    sc.matter.add.constraint(body, w.body, 34, 0.2, { pointA: { x: ox, y: 0 }, damping: 0.12 });
    sc.matter.add.constraint(body, w.body, 52, 0.2, { pointA: { x: ox - Math.sign(ox) * 40, y: 0 }, damping: 0.12 });
    return w;
  });
  // pasajeros: 20 cuerpos chicos adentro
  sc.pax = [];
  for (let k = 0; k < 20; k++) {
    const p = sc.matter.add.image(x - 55 + (k % 10) * 12, y - 10 - Math.floor(k / 10) * 14, 'pax' + (k % 3), null, { shape: { type: 'circle', radius: 6 }, density: 0.0006, friction: 0.2, frictionAir: 0.01, restitution: 0.35, label: 'pax' });
    p.setDepth(2);
    p.out = 0;
    p.lost = 0;
    sc.pax.push(p);
  }
}

function drive(sc, hd, pr, dt) {
  const Bd = M.Body;
  const B = sc.bus.body;
  const grounded = sc.now - sc.gnd < 80;
  const gas = hd.P1_R || hd.P1_U;
  const brake = hd.P1_L || hd.P1_D;
  for (const w of sc.wheels) {
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
  if (pr.P1_1 && grounded && sc.now > (sc.jumpT || 0)) {
    sc.jumpT = sc.now + 900;
    Bd.applyForce(B, B.position, { x: 0.02, y: -0.26 });
    sfx(sc, 'whoosh');
  }
  if (pr.P1_2) {
    sfx(sc, 'horn');
    say(sc, '¡PIIIII!', '#f2efe6');
  }
  if (sc.sea > 0) {
    sc.sea -= dt;
    if (sc.sea <= 0) respawn(sc, SEA1 + 160, true);
  }
  // de cabeza más de 2 s: la enderezan los pasajeros, pero se arrancan dos
  const up = Math.abs(((B.angle % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) < 0.9;
  if (up && Math.abs(B.velocity.x) < 2) {
    sc.flipT = (sc.flipT || 0) + dt;
    if (sc.flipT > 2) {
      sc.flipT = 0;
      respawn(sc, B.position.x + 30, false);
      let n = 0;
      for (const p of sc.pax) if (!p.lost && n < 2) (p.lost = 1, p.destroy(), n++);
      sc.lostN = (sc.lostN || 0) + n;
      say(sc, '¡SE DIO VUELTA! LA ENDEREZARON  -' + n, '#ff7b5c');
      sfx(sc, 'crash');
    }
  } else sc.flipT = 0;
  sc.speed = B.velocity.x;
}

// un pasajero está adentro si su centro cae dentro de la cabina
function updatePax(sc, dt) {
  const B = sc.bus.body;
  let inside = 0;
  for (const p of sc.pax) {
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
        sc.lostN = (sc.lostN || 0) + 1;
        sfx(sc, 'scream');
        say(sc, ['¡SE CAYÓ UNO!', '¡CHAO, CABALLERO!', '¡SE FUE VOLANDO!', '¡AY, MI ABUELITA!'][sc.lostN % 4], '#ff7b5c');
        sc.time.delayedCall(4000, () => p.destroy());
      }
    }
  }
  sc.inside = inside;
  if (inside === 0 && !sc.over && !sc.win) gameOver(sc, sc.now, 1);
}

function updatePacos(sc, dt) {
  const B = sc.bus.body;
  if (!sc.t0) {
    if (B.velocity.x < 3) return;
    sc.t0 = sc.now;
    say(sc, '¡LOS PACOS TE VIERON VOLAR!', '#ff5e5b');
  }
  const pv = 230 + sc.tr * 22 + (sc.now - sc.t0) * 0.004;
  sc.paco.x += pv * dt;
  const d = B.position.x - sc.paco.x;
  if (d > 1600) sc.paco.x = B.position.x - 1600;
  if (d < 900 && sc.now > (sc.sirT || 0)) {
    sc.sirT = sc.now + 450;
    sc.sirH = !sc.sirH;
    sfx(sc, sc.sirH ? 'sirA' : 'sirB');
  }
  if (d <= 90) gameOver(sc, sc.now, 0);
  sc.pacoCar.setPosition(sc.paco.x, gy(sc.paco.x) - 26).setVisible(sc.t0 > 0);
}

function toSea(sc) {
  if (sc.sea > 0) return;
  sc.sea = 1.5;
  sfx(sc, 'splash');
  sc.cameras.main.shake(400, 0.02);
  sc.cameras.main.flash(300, 30, 95, 140);
  say(sc, '¡AL MAR!', '#6fc2d0');
  sc.paco.x -= 300;
}

function respawn(sc, x, drown) {
  const Bd = M.Body;
  const y = gy(x) - 90;
  Bd.setPosition(sc.bus.body, { x, y });
  Bd.setVelocity(sc.bus.body, { x: 2, y: 0 });
  Bd.setAngle(sc.bus.body, 0);
  Bd.setAngularVelocity(sc.bus.body, 0);
  sc.wheels.forEach((w, k) => {
    Bd.setPosition(w.body, { x: x + (k ? 50 : -50), y: y + 34 });
    Bd.setVelocity(w.body, { x: 2, y: 0 });
  });
  let k = 0;
  for (const p of sc.pax) {
    if (p.lost) continue;
    if (drown && k++ % 2) {
      p.lost = 1;
      sc.lostN = (sc.lostN || 0) + 1;
      p.destroy();
    } else {
      Bd.setPosition(p.body, { x: x - 55 + (k % 10) * 12, y: y - 10 });
      Bd.setVelocity(p.body, { x: 2, y: 0 });
    }
  }
  if (drown) say(sc, 'SE AHOGARON LA MITAD', '#ff7b5c');
}

// ---------- Mundo: suelo, casas, lugares ----------
function buildWorld(sc) {
  const g = sc.add.graphics().setDepth(-3); // suelo
  const hg = sc.add.graphics().setDepth(-6); // casas
  const lg = sc.add.graphics().setDepth(-4); // lugares
  sc.lg = lg;
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
  // paraderos de cartel (decorativos por ahora)
  sc.pacoCar = sc.add.image(-700, 0, 'paco').setDepth(3).setVisible(false);
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

// ---------- Fondo: cielo, bahía, cerros del frente ----------
function updateSky(sc, dt, t) {
  const tr = T[trOf(sc.bus.body.position.x)];
  const f = Math.min(1, dt * 0.7);
  const k = sc.sky;
  k.a = mix(k.a, tr[1], f);
  k.b = mix(k.b, tr[2], f);
  k.m = mix(k.m, tr[3], f);
  k.n += (tr[4] - k.n) * f;
  const fire = sc.win ? 220 : trOf(sc.bus.body.position.x) === 6 ? 900 : 0;
  if (fire && t > (sc.fwT || 0)) {
    sc.fwT = t + fire;
    sc.fw.push({ x: 80 + Math.random() * (W - 160), y: 300, vy: -(320 + Math.random() * 200), ty: 40 + Math.random() * 130, c: [0xff3b3b, 0xffd23f, 0x7cfc00, 0xffffff, 0xc86bff, 0x3ad0ff][Math.floor(Math.random() * 6)], sp: null });
  }
  sc.fw = sc.fw.filter((r) => {
    if (!r.sp) {
      r.y += r.vy * dt;
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

function drawBg(sc) {
  const g = sc.bg;
  const sky = sc.sky;
  const bx = sc.cameras.main.scrollX;
  const cy = 300;
  g.clear();
  g.fillGradientStyle(sky.a, sky.a, sky.b, sky.b).fillRect(0, 0, W, cy);
  g.fillStyle(sky.m).fillRect(0, cy, W, H - cy);
  if (sky.n > 0.5) for (let k = 0; k < 40; k++) g.fillStyle(0xffffff, (sky.n - 0.5) * 2 * hash(k * 3.1)).fillRect(((hash(k) * 1400 - bx * 0.02) % 1400 + 1400) % 1400 - 300, hash(k + 50) * (cy - 60), 2, 2);
  // barcos
  for (let k = 0; k < 5; k++) {
    const x = ((k * 230 - bx * 0.08) % 1150 + 1150) % 1150 - 175;
    g.fillStyle(0x3b3f45).fillRect(x, cy + 6, 46, 7);
    g.fillStyle(sky.n > 0.5 ? 0xffd27a : k % 2 ? 0xc8553d : 0x3a8fb7).fillRect(x + 6, cy + 1, 26, 5);
  }
  // cerros del frente con casitas (lucecitas de noche)
  const hy = (x) => cy + 10 - Math.max(0, 62 * Math.sin(x / 190) + 38 * Math.sin(x / 71) + 28);
  const px = bx * 0.15;
  g.fillStyle(mix(0x7d7a6e, 0x0a0f1c, sky.n));
  g.beginPath();
  g.moveTo(-10, cy + 12);
  for (let x = -10; x <= W + 10; x += 12) g.lineTo(x, hy(x + px));
  g.lineTo(W + 10, cy + 12);
  g.closePath();
  g.fillPath();
  for (let x = -10; x <= W + 10; x += 7) {
    const q = Math.floor((x + px) / 7);
    const top = hy(q * 7);
    for (let j = 0; j < 4; j++) {
      const hh = hash(q * 7.13 + j);
      const y = top + 2 + hh * (cy + 8 - top);
      if (y < cy + 6 && hash(q + j * 31.7) < 0.75) g.fillStyle(sky.n > 0.5 ? 0xffd27a : HC[Math.floor(hh * 1000) % 12]).fillRect(q * 7 - px, y, sky.n > 0.5 ? 2 : 5, sky.n > 0.5 ? 2 : 4);
    }
  }
  // el mar de abajo, hasta el borde de la pantalla
  g.fillStyle(sky.m, 0.5).fillRect(0, cy + 14, W, H);
  for (const r of sc.fw) {
    if (!r.sp) {
      g.fillStyle(0xfff2b0).fillRect(r.x - 1.5, r.y, 3, 10);
      continue;
    }
    for (const s of r.sp) if (s.l > 0) g.fillStyle(r.c, s.l).fillCircle(s.x, s.y, 2.6);
  }
}

// ---------- Fin de partida ----------
const ST = (sz, c) => ({ fontFamily: 'monospace', fontSize: sz, fontStyle: 'bold', color: c, stroke: '#1b2733', strokeThickness: 7, align: 'center' });
const mmss = (ms) => Math.floor(ms / 60000) + ':' + ('0' + Math.floor((ms % 60000) / 1000)).slice(-2);

function gameOver(sc, t, why) {
  if (sc.over) return;
  sc.over = t;
  sfx(sc, 'crash');
  const ui = (o) => o.setScrollFactor(0).setDepth(20);
  ui(sc.add.rectangle(W / 2, H / 2, W, H, 0x10141a, 0.78));
  ui(sc.add.text(W / 2, 150, why ? '¡TE QUEDASTE\nSIN PASAJEROS!' : '¡TE PILLARON\nLOS PACOS!', ST('44px', '#ff5e5b')).setOrigin(0.5));
  const hito = sc.tr > 0 ? T[sc.tr - 1][0] : 'LA ADUANA';
  ui(sc.add.text(W / 2, 300, (why ? 'Nadie te paga: te echaron\nde la empresa.\n' : '') + 'Llegaste hasta ' + hito + '\nRecaudaste $ ' + sc.cash.toLocaleString('es-CL'), ST('22px', '#ffd23f')).setOrigin(0.5));
  const pr = ui(sc.add.text(W / 2, 440, 'START o B1\npara otro turno', ST('20px', '#9bc53d')).setOrigin(0.5));
  sc.tweens.add({ targets: pr, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
}

function winGame(sc, t) {
  if (sc.win) return;
  sc.win = t;
  const tip = sc.inside * 1000;
  sc.cash += tip;
  sfx(sc, 'bell');
  for (let k = 0; k < 6; k++) sc.time.delayedCall(600 + k * 500, () => sfx(sc, k % 2 ? 'sirA' : 'sirB'));
  const ui = (o) => o.setScrollFactor(0).setDepth(20);
  ui(sc.add.text(W / 2, 120, '¡LLEGASTE A REÑACA!\n¡FELIZ AÑO NUEVO!', ST('42px', '#ffd23f')).setOrigin(0.5));
  ui(sc.add.text(W / 2, 265, 'Tiempo ' + mmss(t - sc.t0) + '\n' + sc.inside + ' pasajeros llegaron vivos: propina $' + tip.toLocaleString('es-CL') + '\n\nRECAUDASTE  $ ' + sc.cash.toLocaleString('es-CL'), ST('21px', '#f2efe6')).setOrigin(0.5));
  const pr = ui(sc.add.text(W / 2, 400, 'START o B1 para otro turno', ST('18px', '#9bc53d')).setOrigin(0.5));
  sc.tweens.add({ targets: pr, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
}

function say(sc, txt, col) {
  const t = sc.add.text(W / 2, 205, txt, { fontFamily: 'monospace', fontSize: '26px', fontStyle: 'bold', color: col, stroke: '#1b2733', strokeThickness: 6, align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(12);
  sc.tweens.add({ targets: t, y: 150, alpha: 0, delay: 600, duration: 1100, onComplete: () => t.destroy() });
}

function updateParts(sc, dt) {
  sc.parts = sc.parts.filter((o) => {
    o.life -= dt;
    if (o.life > 0) return true;
    o.s.destroy();
    return false;
  });
}

// ---------- Texturas: la micro, las ruedas, los pasajeros, el radiopatrulla ----------
function makeTextures(sc) {
  const g = sc.make.graphics({ add: false });
  // micro de 150x64, centro en (75,32): blanca con franjas, ventanas transparentes y escotilla
  g.fillStyle(0xf2efe6).fillRoundedRect(0, 4, 150, 56, 8);
  g.fillStyle(0xc8553d).fillRect(0, 40, 150, 8);
  g.fillStyle(0x2f7f9e).fillRect(0, 48, 150, 4);
  g.fillStyle(0x1f2b36, 0.35);
  for (let k = 0; k < 4; k++) g.fillRect(14 + k * 30, 12, 22, 20);
  g.fillStyle(0x1f2b36, 0.5).fillRect(128, 10, 18, 26); // parabrisas
  g.fillStyle(0x111111).fillRect(0, 0, 150, 5);
  g.fillStyle(0xffb000).fillRect(60, 1, 30, 3);
  g.fillStyle(0xd62828).fillRect(0, 22, 5, 14);
  g.fillStyle(0xffd23f).fillRect(145, 22, 5, 14);
  g.generateTexture('bus', 150, 64);
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

// ---------- HUD ----------
function createHud(sc) {
  const st = (sz, col) => ({ fontFamily: 'monospace', fontSize: sz, fontStyle: 'bold', color: col });
  const ui = (o) => o.setScrollFactor(0).setDepth(10);
  const tb = ui(sc.add.graphics());
  tb.fillStyle(0x1b2733, 0.92).fillRoundedRect(20, 16, 190, 44, 10).fillRoundedRect(W - 210, 16, 190, 44, 10);
  sc.tTop = ui(sc.add.text(115, 38, '', st('18px', '#f2efe6')).setOrigin(0.5));
  sc.tCash = ui(sc.add.text(W - 115, 38, '', st('20px', '#ffd23f')).setOrigin(0.5));
  sc.tPaco = ui(sc.add.text(W / 2, 30, '', st('13px', '#ff5e5b')).setOrigin(0.5));
  sc.tTramo = ui(sc.add.text(W / 2, 92, '', st('13px', '#6fc2d0')).setOrigin(0.5));
  sc.tSpeed = ui(sc.add.text(W - 20, H - 16, '', st('22px', '#f2efe6')).setOrigin(1, 1));
  sc.prog = ui(sc.add.graphics());
  const hint = ui(sc.add.text(W / 2, 250, '► o ▲ ACELERA   ◄ o ▼ FRENA\nEN EL AIRE: ▲ LEVANTA LA NARIZ, ▼ LA BAJA\nB1 BRINCO   B2 BOCINA\n\nLLEGA A REÑACA ANTES QUE TE PILLEN LOS PACOS.\nSI SE DA VUELTA, LOS PASAJEROS SE VAN.', { ...st('15px', '#f2efe6'), stroke: '#1b2733', strokeThickness: 5, align: 'center' }).setOrigin(0.5).setDepth(12));
  sc.tweens.add({ targets: hint, alpha: 0, delay: 8000, duration: 800 });
}

function refreshHud(sc) {
  const B = sc.bus.body;
  sc.tTop.setText('PASAJEROS ' + (sc.inside || 0)).setColor((sc.inside || 0) <= 4 ? '#ff5e5b' : '#f2efe6');
  sc.tCash.setText('$ ' + sc.cash.toLocaleString('es-CL'));
  const d = B.position.x - sc.paco.x;
  sc.tPaco.setText(sc.win || !sc.t0 ? '' : 'PACOS A ' + Math.max(0, Math.round(d / 10)) + ' m').setColor(d < 500 ? '#ff5e5b' : '#f2efe6');
  sc.tSpeed.setText(Math.round(Math.abs(B.velocity.x) * 6) + ' km/h');
  const pg = sc.prog.clear();
  const x0 = 150;
  const x1 = W - 150;
  const zx = (x) => x0 + (x1 - x0) * Phaser.Math.Clamp(x / END, 0, 1);
  pg.lineStyle(3, 0x1b2733).lineBetween(x0, 76, x1, 76);
  pg.lineStyle(3, 0x6fc2d0).lineBetween(x0, 76, zx(B.position.x), 76);
  pg.fillStyle(0xf2efe6).fillCircle(x0, 76, 5);
  for (let k = 0; k < 7; k++) pg.fillStyle(B.position.x >= (k + 1) * TL ? 0x6fc2d0 : 0xf2efe6).fillCircle(zx((k + 1) * TL), 76, k === 6 ? 7 : 5);
  pg.fillStyle(0xffd23f).fillRect(zx(B.position.x) - 7, 69, 14, 9);
  sc.tTramo.setText(sc.win ? '' : '▶ ' + T[Math.max(0, sc.tr)][0] + '   ' + (sc.tr + 1) + '/7');
  if (d < 400 && sc.t0 && !sc.over && !sc.win) pg.fillStyle(Math.floor(sc.now / 160) % 2 ? 0xff2d2d : 0x2d6bff, 0.12 * (1 - d / 400)).fillRect(0, 0, W, H);
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
    const sp = Math.min(1, Math.abs(sc.wheels[0].body.angularVelocity) / 0.6);
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
