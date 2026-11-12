// Micro Voladora Valpo — Platanus Hack 26 Arcade
// Dos micros compiten bajando los cerros de Valparaíso. Recoge pasajeros, vuela y aterriza derecho.

const W = 800;
const H = 600;
const L = 14000; // largo de la vuelta (el recorrido se repite)
const SP = 350; // separación de los puntos del terreno
const G = 1400;
const ACC = 820;
const BRK = 1300;
const MAXV = 1300;
const ROUND_SECS = 90;
const MAX_PAX = 30;

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

// ---------- Terreno ----------
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const NPTS = L / SP;
const PTS = [];
for (let i = 0; i < NPTS; i++) {
  let h = 380 + 150 * Math.sin(i * 1.3) + (rnd() - 0.5) * 170;
  if (i < 3) h = 430;
  PTS.push(Math.max(180, Math.min(560, h)));
}

function seg(x) {
  const xi = ((x % L) + L) % L;
  const i = Math.floor(xi / SP);
  return { a: PTS[i], b: PTS[(i + 1) % NPTS], t: (xi - i * SP) / SP };
}
function th(x) {
  const s = seg(x);
  return s.a + ((s.b - s.a) * (1 - Math.cos(Math.PI * s.t))) / 2;
}
function slope(x) {
  const s = seg(x);
  return ((s.b - s.a) * Math.PI * Math.sin(Math.PI * s.t)) / (2 * SP);
}
function wrapDx(d) {
  return ((((d + L / 2) % L) + L) % L) - L / 2;
}
function wrapAng(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

// ---------- Phaser ----------
new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game-root',
  backgroundColor: '#1a1030',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
  scene: { create, update },
});

function create() {
  const sc = this;
  createControls(sc);
  makeTextures(sc);

  sc.cameras.cameras.slice(1).forEach((c) => sc.cameras.remove(c));
  sc.c1 = sc.cameras.main.setViewport(0, 0, W, 298).setZoom(0.5).setBackgroundColor('#f6b26b');
  sc.c2 = sc.cameras.add(0, 302, W, 298).setZoom(0.5).setBackgroundColor('#f6b26b');
  sc.hud = sc.cameras.add(0, 0, W, H);
  sc.wo = (o) => (sc.hud.ignore(o), o); // objeto del mundo
  sc.ho = (o) => (sc.c1.ignore(o), sc.c2.ignore(o), o); // objeto del HUD

  drawWorld(sc);
  createObjects(sc);
  createPlayers(sc);
  createHud(sc);

  sc.parts = [];
  sc.state = 'title';
  sc.timeLeft = ROUND_SECS;
}

function update(time, delta) {
  const sc = this;
  const dt = Math.min(delta / 1000, 0.033);
  const pr = sc.controls.pressed;

  if (sc.state === 'title') {
    if (pr.START1 || pr.START2 || pr.P1_1 || pr.P2_1) {
      sc.state = 'play';
      sc.overlay.setVisible(false);
      sfx(sc, 'start');
    }
  } else if (sc.state === 'play') {
    sc.timeLeft -= dt;
    if (sc.timeLeft <= 0) endRound(sc);
    sc.players.forEach((p, i) => updatePlayer(sc, p, sc.players[1 - i], dt, time));
    updateObjects(sc, time);
  } else if (sc.state === 'end') {
    if (time > sc.endAt + 1500 && (pr.START1 || pr.START2)) sc.scene.restart();
  }

  updateParts(sc, dt);
  refreshHud(sc);
  for (const k in pr) pr[k] = false;
}

// ---------- Texturas ----------
function makeTextures(sc) {
  const g = sc.make.graphics({ add: false });
  const micro = (key, col) => {
    g.clear();
    g.fillStyle(col).fillRoundedRect(2, 6, 136, 46, 10);
    g.fillStyle(0xffffff).fillRect(2, 34, 136, 6);
    g.fillStyle(0x23395d);
    for (let i = 0; i < 5; i++) g.fillRect(10 + i * 22, 12, 16, 16);
    g.fillRect(122, 12, 14, 20);
    g.fillStyle(0x111111).fillRect(100, 2, 34, 8);
    g.fillStyle(0xffe600).fillRect(104, 4, 26, 4);
    g.fillStyle(0x111111).fillCircle(30, 54, 11).fillCircle(110, 54, 11);
    g.fillStyle(0x999999).fillCircle(30, 54, 4).fillCircle(110, 54, 4);
    g.fillStyle(0xfff2a8).fillRect(134, 40, 5, 6);
    g.generateTexture(key, 140, 66);
  };
  micro('m0', 0xe1ff00);
  micro('m1', 0xff6ec7);

  [0x3355aa, 0xcc3344, 0x33aa66].forEach((c, i) => {
    g.clear();
    g.fillStyle(0xf1c27d).fillCircle(6, 5, 5);
    g.fillStyle(c).fillRect(1, 10, 10, 10);
    g.fillStyle(0x222222).fillRect(1, 20, 4, 6).fillRect(7, 20, 4, 6);
    g.generateTexture('pax' + i, 12, 26);
  });

  g.clear();
  g.fillStyle(0x8b5a2b).fillEllipse(22, 13, 34, 14);
  g.fillCircle(40, 8, 7);
  g.fillStyle(0x5a3a1a).fillRect(8, 16, 4, 10).fillRect(30, 16, 4, 10).fillTriangle(38, 2, 42, 2, 40, -4);
  g.lineStyle(3, 0x8b5a2b).lineBetween(6, 10, 0, 2);
  g.generateTexture('dog', 48, 26);

  g.clear();
  g.fillStyle(0x2b1b0e).fillCircle(13, 8, 7);
  g.fillStyle(0x6d6d6d).fillRect(4, 15, 18, 20);
  g.fillStyle(0x2f3b5c).fillRect(5, 35, 7, 15).fillRect(14, 35, 7, 15);
  g.generateTexture('curao', 26, 50);
  g.destroy();
}

// ---------- Mundo ----------
function drawWorld(sc) {
  // Cerros lejanos con casas de colores
  const far = sc.wo(sc.add.graphics().setScrollFactor(0.35, 0.7).setDepth(0));
  const fh = (x) => 330 + 90 * Math.sin(x / 520) + 50 * Math.sin(x / 190);
  far.fillStyle(0x7a6a8c);
  far.beginPath();
  far.moveTo(-1000, 1400);
  for (let x = -1000; x <= L * 0.4 + 3000; x += 60) far.lineTo(x, fh(x));
  far.lineTo(L * 0.4 + 3000, 1400);
  far.closePath().fillPath();
  const casas = [0xff5e5b, 0xffd23f, 0x3bceac, 0x0ead69, 0x5e60ce, 0xee964b, 0xf4f1de];
  for (let x = -1000; x <= L * 0.4 + 3000; x += 34) {
    if (rnd() < 0.35) continue;
    const y = fh(x) + 10 + rnd() * 120;
    far.fillStyle(casas[Math.floor(rnd() * casas.length)]).fillRect(x, y, 26, 22);
    far.fillStyle(0x3a2e4a).fillRect(x + 8, y + 8, 6, 6);
  }

  // Terreno principal
  const g = sc.wo(sc.add.graphics().setDepth(1));
  g.fillStyle(0x6b4f3a);
  g.beginPath();
  g.moveTo(-2000, 1600);
  for (let x = -2000; x <= L + 2000; x += 20) g.lineTo(x, th(x));
  g.lineTo(L + 2000, 1600);
  g.closePath().fillPath();
  g.lineStyle(12, 0x3d3d3d);
  g.beginPath();
  g.moveTo(-2000, th(-2000));
  for (let x = -2000; x <= L + 2000; x += 20) g.lineTo(x, th(x) + 4);
  g.strokePath();
  g.lineStyle(2, 0xf4f1de);
  for (let x = -2000; x <= L + 2000; x += 120) g.lineBetween(x, th(x) + 4, x + 50, th(x + 50) + 4);
}

function createObjects(sc) {
  sc.stops = [];
  sc.dogs = [];
  sc.curaos = [];
  const lo = 1800;
  const hi = L - 1800;
  for (let x = lo; x < hi; x += 1700) {
    const y = th(x);
    const sign = sc.wo(sc.add.graphics().setDepth(2));
    sign.fillStyle(0x444444).fillRect(x - 3, y - 110, 6, 110);
    sign.fillStyle(0x1565c0).fillRect(x - 26, y - 130, 52, 30);
    sign.fillStyle(0xffffff).fillRect(x - 18, y - 122, 36, 6).fillRect(x - 18, y - 112, 24, 6);
    const pax = [];
    for (let k = 0; k < 5; k++) {
      pax.push(sc.wo(sc.add.image(x + 20 + k * 16, th(x + 20 + k * 16) + 2, 'pax' + (k % 3)).setOrigin(0.5, 1).setDepth(2)));
    }
    sc.stops.push({ x, n: 4, pax, refill: 0 });
  }
  for (let x = lo + 800; x < hi; x += 3400) {
    sc.dogs.push({ x, alive: true, back: 0, s: sc.wo(sc.add.image(x, th(x) + 2, 'dog').setOrigin(0.5, 1).setDepth(3)) });
  }
  for (let x = lo + 2500; x < hi; x += 4200) {
    const y = th(x);
    const wall = sc.wo(sc.add.graphics().setDepth(1));
    wall.fillStyle(0xb5651d).fillRect(x - 40, y - 95, 90, 95);
    wall.lineStyle(2, 0x8a4b12);
    for (let r = 0; r < 5; r++) wall.lineBetween(x - 40, y - 95 + r * 19, x + 50, y - 95 + r * 19);
    const pud = sc.wo(sc.add.ellipse(x + 30, y + 4, 90, 12, 0xf2d43a, 0.85).setDepth(2));
    const man = sc.wo(sc.add.image(x, y + 2, 'curao').setOrigin(0.5, 1).setDepth(3));
    const jet = sc.wo(sc.add.graphics().setDepth(3));
    jet.lineStyle(3, 0xf2d43a).lineBetween(x, y - 22, x + 6, y - 10).lineBetween(x + 6, y - 10, x + 8, y);
    sc.tweens.add({ targets: jet, alpha: 0.3, duration: 120, yoyo: true, repeat: -1 });
    sc.curaos.push({ x, y, alive: true, back: 0, man, jet, pud, cd: [0, 0] });
  }
}

function updateObjects(sc, t) {
  for (const st of sc.stops) {
    if (t > st.refill && st.n < 5) {
      st.n++;
      st.refill = t + 6000;
    }
    st.pax.forEach((s, k) => s.setVisible(k < st.n));
  }
  for (const d of sc.dogs) {
    if (!d.alive && t > d.back) {
      d.alive = true;
      d.s.setPosition(d.x, th(d.x) + 2).setAlpha(1).setVisible(true);
    }
  }
  for (const c of sc.curaos) {
    if (!c.alive && t > c.back) {
      c.alive = true;
      c.man.setPosition(c.x, c.y + 2).setAngle(0).setAlpha(1).setVisible(true);
      c.jet.setVisible(true);
      c.pud.setVisible(true);
    }
  }
}

// ---------- Jugadores ----------
function createPlayers(sc) {
  sc.players = [0, 1].map((i) => {
    const x = i ? 250 : 420;
    const s = sc.wo(sc.add.image(x, th(x), 'm' + i).setOrigin(0.5, 1).setDepth(5));
    const p = { i, k: 'P' + (i + 1) + '_', x, y: th(x), vx: 0, vy: 0, a: 0, g: true, air: 0, pax: 0, s, hornT: 0, doorT: 0, door: false };
    const cam = i ? sc.c2 : sc.c1;
    cam.startFollow(s, false, 0.12, 0.08, -380, 90);
    p.cam = cam;
    return p;
  });
}

function updatePlayer(sc, p, q, dt, t) {
  const hd = sc.controls.held;
  const R = hd[p.k + 'R'];
  const Lf = hd[p.k + 'L'];
  const U = hd[p.k + 'U'];
  const D = hd[p.k + 'D'];

  if (p.g) {
    const s = slope(p.x);
    p.vx += ((G * s) / (1 + s * s)) * dt;
    if (R) p.vx += ACC * dt;
    else if (Lf) p.vx -= BRK * dt;
    else p.vx *= 1 - 0.5 * dt;
    p.vx = Phaser.Math.Clamp(p.vx, -260, MAXV);
    p.vy = p.vx * s;
    const nx = p.x + p.vx * dt;
    const ny = p.y + p.vy * dt + G * dt * dt;
    if (ny < th(nx) - 3 && p.vx > 250) {
      p.g = false;
      p.air = 0;
      p.x = nx;
      p.y = ny;
      p.vy += G * dt;
    } else {
      p.x = nx;
      p.y = th(nx);
    }
    p.a += wrapAng(Math.atan(slope(p.x)) - p.a) * 0.35;
  } else {
    p.air += dt;
    p.vy += G * dt;
    p.vx *= 1 - 0.04 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (U) p.a -= 3.6 * dt;
    if (D) p.a += 3.6 * dt;
    const gy = th(p.x);
    if (p.y >= gy) land(sc, p, gy);
  }

  if (p.x >= L) {
    p.x -= L;
    p.cam.scrollX -= L;
  } else if (p.x < 0) {
    p.x += L;
    p.cam.scrollX += L;
  }
  p.s.setPosition(p.x, p.y).setRotation(p.a);

  // Bocina
  if (sc.controls.pressed[p.k + '1'] && t > p.hornT) {
    p.hornT = t + 600;
    honk(sc, p, q, t);
  }

  // Puerta
  p.door = !!hd[p.k + '2'];
  if (p.door && p.g && t > p.doorT) {
    const sp = Math.abs(p.vx);
    if (sp > 450 && p.pax > 0) {
      p.doorT = t + 260;
      losePax(sc, p, 1, '¡CIERRA LA PUERTA!');
    } else if (sp < 170) {
      const st = sc.stops.find((o) => Math.abs(wrapDx(o.x + 50 - p.x)) < 120 && o.n > 0);
      if (st && p.pax < MAX_PAX) {
        st.n--;
        st.refill = Math.max(st.refill, t + 6000);
        p.pax++;
        p.doorT = t + 180;
        sfx(sc, 'pick');
        if (st.n === 0) float(sc, p.x, p.y - 90, '¡LLENA!', '#ffffff');
      }
    }
  }

  // Obstáculos
  if (p.g) {
    for (const d of sc.dogs) {
      if (d.alive && Math.abs(wrapDx(d.x - p.x)) < 55) {
        dogFlee(sc, d, t);
        p.vx *= 0.4;
        sfx(sc, 'yelp');
        losePax(sc, p, 1, '¡GUAU!');
      }
    }
    for (const c of sc.curaos) {
      const dx = wrapDx(p.x - c.x);
      if (c.alive && dx > -15 && dx < 75 && t > c.cd[p.i]) {
        c.cd[p.i] = t + 2500;
        sfx(sc, 'splash');
        splash(sc, p.x, p.y);
        losePax(sc, p, 1, '¡OYEEE, CUIDADO!');
      }
    }
  }
}

function land(sc, p, gy) {
  const s = slope(p.x);
  const ta = Math.atan(s);
  const d = Math.abs(wrapAng(p.a - ta));
  p.vx = (p.vx + p.vy * s) / (1 + s * s);
  p.y = gy;
  p.g = true;
  if (d > 2.3) {
    p.vx = 0;
    p.cam.shake(350, 0.02);
    sfx(sc, 'crash');
    losePax(sc, p, Math.max(2, Math.ceil(p.pax * 0.4)), '¡SE DIO VUELTA!');
  } else if (d > 0.75) {
    p.vx *= 0.35;
    p.cam.shake(220, 0.012);
    sfx(sc, 'crash');
    losePax(sc, p, Math.max(1, Math.ceil(p.pax * 0.2)), '¡PUCHA!');
  } else if (p.air > 0.9) {
    float(sc, p.x, p.y - 100, '¡VOLANDO!', '#ffe600');
    sfx(sc, 'pick');
  }
  p.a = ta;
}

function honk(sc, p, q, t) {
  sfx(sc, 'horn');
  float(sc, p.x + 60, p.y - 90, '¡PIIIII!', '#ffffff');
  for (const d of sc.dogs) {
    const dx = wrapDx(d.x - p.x);
    if (d.alive && dx > 0 && dx < 400) dogFlee(sc, d, t);
  }
  for (const c of sc.curaos) {
    const dx = wrapDx(c.x - p.x);
    if (c.alive && dx > 0 && dx < 380) {
      c.alive = false;
      c.back = t + 10000;
      c.jet.setVisible(false);
      c.pud.setVisible(false);
      sc.tweens.add({ targets: c.man, y: c.y - 60, angle: 200, alpha: 0, duration: 700 });
      float(sc, c.x, c.y - 80, '¡CHUTA, ME MOJÉ!', '#f2d43a');
      if (p.pax < MAX_PAX) {
        p.pax++;
        float(sc, p.x, p.y - 130, '+1 SE SUBIÓ DE VERGÜENZA', '#7CFC00');
      }
    }
  }
  if (Math.abs(wrapDx(q.x - p.x)) < 220 && q.pax > 0) {
    q.pax--;
    if (p.pax < MAX_PAX) p.pax++;
    float(sc, q.x, q.y - 110, '¡SE CAMBIÓ DE MICRO!', '#ff6ec7');
  }
}

function dogFlee(sc, d, t) {
  d.alive = false;
  d.back = t + 7000;
  sc.tweens.add({ targets: d.s, x: d.x - 300, y: th(d.x) - 120, alpha: 0, duration: 600 });
}

function losePax(sc, p, n, msg) {
  const k = Math.min(n, p.pax);
  p.pax -= k;
  float(sc, p.x, p.y - 110, msg + (k ? ' -' + k : ''), '#ff5e5b');
  for (let j = 0; j < k; j++) {
    const s = sc.wo(sc.add.image(p.x, p.y - 40, 'pax' + (j % 3)).setDepth(6));
    sc.parts.push({ s, vx: p.vx * 0.5 + (Math.random() - 0.5) * 500, vy: -500 - Math.random() * 400, vr: (Math.random() - 0.5) * 12, life: 2 });
  }
}

function splash(sc, x, y) {
  for (let j = 0; j < 10; j++) {
    const s = sc.wo(sc.add.circle(x, y - 4, 5, 0xf2d43a).setDepth(6));
    sc.parts.push({ s, vx: (Math.random() - 0.5) * 400, vy: -200 - Math.random() * 300, vr: 0, life: 0.8 });
  }
}

function updateParts(sc, dt) {
  sc.parts = sc.parts.filter((o) => {
    o.life -= dt;
    o.vy += G * dt;
    o.s.x += o.vx * dt;
    o.s.y += o.vy * dt;
    o.s.rotation += o.vr * dt;
    if (o.life <= 0) {
      o.s.destroy();
      return false;
    }
    return true;
  });
}

function float(sc, x, y, txt, col) {
  const tx = sc.wo(sc.add.text(x, y, txt, { fontFamily: 'monospace', fontSize: '30px', fontStyle: 'bold', color: col, stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(7));
  sc.tweens.add({ targets: tx, y: y - 90, alpha: 0, duration: 1300, onComplete: () => tx.destroy() });
}

// ---------- HUD ----------
function createHud(sc) {
  const st = (sz, col) => ({ fontFamily: 'monospace', fontSize: sz, fontStyle: 'bold', color: col, stroke: '#000', strokeThickness: 4 });
  sc.ho(sc.add.rectangle(W / 2, H / 2, W, 4, 0x000000));
  sc.t1 = sc.ho(sc.add.text(12, 8, '', st('20px', '#e1ff00')));
  sc.t2 = sc.ho(sc.add.text(12, 310, '', st('20px', '#ff6ec7')));
  sc.tt = sc.ho(sc.add.text(W / 2, H / 2, '', st('22px', '#ffffff')).setOrigin(0.5));
  sc.d1 = sc.ho(sc.add.text(W - 12, 8, '', st('16px', '#ffffff')).setOrigin(1, 0));
  sc.d2 = sc.ho(sc.add.text(W - 12, 310, '', st('16px', '#ffffff')).setOrigin(1, 0));

  const bg = sc.add.rectangle(W / 2, H / 2, W, H, 0x120a24, 0.82);
  const title = sc.add.text(W / 2, 150, 'MICRO VOLADORA\nVALPO', { ...st('56px', '#ffe600'), align: 'center', strokeThickness: 8 }).setOrigin(0.5);
  const help = sc.add.text(
    W / 2,
    390,
    'Joystick ► acelera   ◄ frena\nEn el aire ▲▼ inclina la micro\nBotón 1: bocina   Botón 2: abrir puerta\nFrena en el paradero y abre la puerta.\nAterriza derecho o se caen los pasajeros.\n\nGana quien lleve más pasajeros en 90 s',
    { ...st('17px', '#ffffff'), align: 'center', lineSpacing: 6 }
  ).setOrigin(0.5);
  sc.prompt = sc.add.text(W / 2, 545, 'PRESIONA START', st('26px', '#3bceac')).setOrigin(0.5);
  sc.tweens.add({ targets: sc.prompt, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
  sc.overlay = sc.ho(sc.add.container(0, 0, [bg, title, help, sc.prompt]).setDepth(10));
}

function refreshHud(sc) {
  const [a, b] = sc.players;
  sc.t1.setText('P1  PASAJEROS: ' + a.pax);
  sc.t2.setText('P2  PASAJEROS: ' + b.pax);
  sc.d1.setText(a.door ? 'PUERTA ABIERTA' : Math.round(Math.abs(a.vx) / 10) + ' km/h');
  sc.d2.setText(b.door ? 'PUERTA ABIERTA' : Math.round(Math.abs(b.vx) / 10) + ' km/h');
  sc.tt.setText(' ' + Math.max(0, Math.ceil(sc.timeLeft)) + ' ');
}

function endRound(sc) {
  sc.state = 'end';
  sc.timeLeft = 0;
  sc.endAt = sc.time.now;
  sfx(sc, 'end');
  const [a, b] = sc.players;
  const msg = a.pax === b.pax ? '¡EMPATE!' : a.pax > b.pax ? '¡GANA P1!' : '¡GANA P2!';
  const col = a.pax === b.pax ? '#ffffff' : a.pax > b.pax ? '#e1ff00' : '#ff6ec7';
  const st = (sz, c) => ({ fontFamily: 'monospace', fontSize: sz, fontStyle: 'bold', color: c, stroke: '#000', strokeThickness: 6, align: 'center' });
  sc.ho(sc.add.rectangle(W / 2, H / 2, W, H, 0x120a24, 0.8).setDepth(10));
  sc.ho(sc.add.text(W / 2, 200, msg, st('64px', col)).setOrigin(0.5).setDepth(11));
  sc.ho(sc.add.text(W / 2, 320, 'P1: ' + a.pax + ' pasajeros\nP2: ' + b.pax + ' pasajeros', st('28px', '#ffffff')).setOrigin(0.5).setDepth(11));
  const pr = sc.ho(sc.add.text(W / 2, 470, 'START para otra vuelta', st('24px', '#3bceac')).setOrigin(0.5).setDepth(11));
  sc.tweens.add({ targets: pr, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
}

// ---------- Sonido ----------
function sfx(sc, type) {
  try {
    const ctx = sc.sound.context;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
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
    else if (type === 'start') [523, 659, 784].forEach((f, i) => tone(f, f, 0.12, 'square', 0.1, i * 0.12));
    else if (type === 'end') [784, 659, 523, 1046].forEach((f, i) => tone(f, f, 0.18, 'square', 0.1, i * 0.18));
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
