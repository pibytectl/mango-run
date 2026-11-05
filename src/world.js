import * as THREE from '../vendor/three.module.min.js';
import { tex, sprite, regionQuad, tiledQuad, aspect, matFor, applyGrade, glowTex, sunTex, raysTex, vignetteTex, shadowTex, waterTex, gradTex } from './gfx.js';
import { Hero, MAXV } from './hero.js';
import { FX } from './fx.js';
import { sfx } from './audio.js';
import { input } from './input.js';
import { LINES, HINTS, SEGMENTS } from './strings.js';

export const TIME_LIMIT = 270;
const SEG_X = [-100, 162, 287, 466];
const ROOF_X0 = 287.6, ROOF_X1 = 466, WATER_X = 492.5, JETTY_X1 = 528;

const O = { sky: 0, sun: 1, rays: 2, skyline: 4, nile: 6, mid: 8, alley: 12, wall: 14, back: 20, npc: 26, prop: 30, ground: 40, pickup: 50, hero: 60, front: 80, water: 85, fg: 90, over: 98 };

export class World {
  constructor(scene, camera, ui, opts = {}) {
    this.scene = scene; this.camera = camera; this.ui = ui; this.opts = opts;
    this.lines = LINES;
    this.solids = []; this.oneways = []; this.triggers = []; this.anims = [];
    this.pickups = []; this.toks = []; this.balls = []; this.kickers = []; this.npcs = []; this.laundry = []; this.puddles = [];
    this.pigeons = []; this.checkpoints = []; this.layers = []; this.bubbles = [];
    this.fx = new FX(scene);
    this.cam = { x: 0, y: 2.4, px: 0, py: 2.4, look: 2.5, trauma: 0 };
    this.view = { w: 18, h: 8.4 };
    this.t = 0; this.hitstopT = 0;
    this.hero = new Hero(this);
    scene.add(this.hero.root);
    this.hero.setRigOrder(O.hero);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, depthTest: false }));
    this.shadow.renderOrder = O.hero - 1; scene.add(this.shadow);
    this.build();
    this.resetRun();
  }

  // ---------------------------------------------------------------- level construction
  add(m, x, y, order) { m.position.set(x, y, 0); if (order !== undefined) m.renderOrder = order; this.scene.add(m); return m; }
  layer(f, fy) { const g = new THREE.Group(); g.userData = { f, fy }; this.scene.add(g); this.layers.push(g); return g; }
  solid(x0, x1, y0, y1, extra = {}) { const s = { x0, x1, y0, y1, ...extra }; this.solids.push(s); return s; }
  oneway(x0, x1, y1, extra = {}) { const p = { x0, x1, y1, ...extra }; this.oneways.push(p); return p; }

  ground(x0, x1, top, name, extra) {
    this.solid(x0, x1, top - 8, top, extra);
    this.add(tiledQuad(name, x1 - x0, 5.5, 3.0, { vReps: 5.5 / 3.0, order: O.ground }), x0, top);
  }
  prop(name, h, x, y, opts = {}) {
    const m = sprite(name, h, { ax: opts.ax !== undefined ? opts.ax : 0.5, ay: opts.ay || 0, color: opts.color, tintK: opts.tintK });
    if (opts.flip) m.scale.x *= -1;
    return this.add(m, x, y, opts.order !== undefined ? opts.order : O.prop);
  }
  cart(x) { const m = this.prop('cart', 1.3, x, 0); this.solid(x - 0.75, x + 1.15, 0, 1.12, { kind: 'cart' }); return m; }
  barrel(x) { this.prop('barrel', 0.95, x, 0); this.solid(x - 0.27, x + 0.27, 0, 0.92); }
  crates(x, n, w = 0.93) {
    for (let i = 0; i < n; i++) this.prop('crates', 1.4, x + w / 2, i * 1.4);
    return this.solid(x, x + w, 0, n * 1.4);
  }
  stall(x, opts = {}) {
    this.prop('stall', 2.6, x, 0, { order: O.back });
    this.oneway(x - 1.05, x + 1.05, 1.12);
    this.oneway(x - 1.15, x + 1.15, 2.42);
  }
  lamp(x, y = 0) { return this.prop('lamp', 2.9, x, y, { order: O.back }); }
  npc(name, h, x, y, line, opts = {}) {
    const m = this.prop(name, h, x, y, { flip: opts.flip, order: O.npc });
    const n = { m, x, y, h, line, said: false, base: m.scale.y, r: opts.r || 4.5, flipX: m.scale.x, sayOnce: opts.sayOnce !== false };
    this.npcs.push(n); return n;
  }
  mangoAt(x, y) {
    const m = sprite('mango', 0.42, { ax: 0.5, ay: 0.5, order: O.pickup });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: this.glow, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, color: 0xffb040, opacity: 0.5 }));
    glow.renderOrder = O.pickup - 1; m.add(glow); glow.scale.set(1 / 0.33, 1 / 0.42, 1);
    this.add(m, x, y);
    const p = { m, x, y, px: x, py: y, vx: 0, vy: 0, static: true, life: Infinity, home: { x, y } };
    this.pickups.push(p); return p;
  }
  laundryLine(x0, x1) {
    const w = x1 - x0;
    const m = sprite('laundry', 1.05, { width: w, ax: 0, ay: 1, order: O.front });
    this.add(m, x0, 2.4);
    for (const px of [x0 - 0.15, x1 + 0.15]) {
      const pole = sprite('plank', 0.12, { width: 2.7, ax: 0, ay: 0.5, order: O.back });
      pole.rotation.z = Math.PI / 2; this.add(pole, px, -0.1);
    }
    this.laundry.push({ x0: x0 + 0.2, x1: x1 - 0.2, y0: 1.38, y1: 2.4, m, cd: 0, wave: 0 });
  }
  puddle(x0, x1) {
    this.add(sprite('puddle', 0.32, { width: x1 - x0 + 0.6, ax: 0, ay: 0.35, order: O.ground + 1 }), x0 - 0.3, 0);
    this.puddles.push({ x0, x1 });
  }
  toktok(trigX, speed) {
    const m = sprite('tuktuk', 1.95, { ax: 0.5, ay: 0, order: O.front - 2 });
    m.visible = false; this.scene.add(m);
    const t = { m, x: -999, px: -999, y: 0, vx: -speed, active: false, done: false, trigX, w: m.userData.w };
    t.top = this.oneway(0, 0, 1.85, { off: true, bouncy: 13.5, onBounce: () => { sfx.bounce(); this.fx.dust(this.hero.x, this.hero.y, 6, 0.8); this.ui.bump('jump'); this.shake(0.15); } });
    this.toks.push(t);
  }
  kicker(x, from, to) {
    const n = this.npc('npc_kid1', 1.3, x, 0, LINES.kidSorry, { flip: true, sayOnce: true, r: 0 });
    this.kickers.push({ n, x, from, to, cd: 0.8, kicks: 0 });
  }
  roof(x0, x1, top, opts = {}) {
    this.solid(x0, x1, -8, top);
    const w = x1 - x0;
    const u0 = opts.u0 !== undefined ? opts.u0 : 0;
    const uw = Math.min(1 - u0, w / 20.6);
    const wallH = top + 0.3;
    this.add(regionQuad('street', w, wallH, u0, u0 + uw, 0.02, 0.6 * Math.min(1.15, wallH / 6.2), { order: O.wall, color: 0xfff0e0 }), x0, -0.3);
    this.add(tiledQuad('g_slab', w, 0.38, 3, { order: O.wall + 1 }), x0, top + 0.02);
    this.prop('parapet', 0.5, x0 + 0.75, top - 0.05, { order: O.wall + 2 });
    this.prop('parapet', 0.5, x1 - 0.75, top - 0.05, { order: O.wall + 2, flip: true });
  }
  alley(x0, x1, top) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, top + 1), new THREE.MeshBasicMaterial({ map: this.alleyTex, transparent: true, depthWrite: false, depthTest: false }));
    m.geometry.translate((x1 - x0) / 2, (top + 1) / 2, 0);
    this.add(m, x0, -1, O.alley);
  }
  dish(x, top) {
    const d = this.prop('dish', 1.5, x, top - 1.25, { order: O.prop });
    const pole = new THREE.Mesh(new THREE.PlaneGeometry(0.14, top - 1.0), new THREE.MeshBasicMaterial({ color: 0x3a2a22, depthWrite: false, depthTest: false }));
    pole.geometry.translate(0, (top - 1.0) / 2, 0); this.add(pole, x + 0.05, -1.0 + 0.0, O.prop - 1);
    this.oneway(x - 0.8, x + 0.8, top);
    return d;
  }
  pigeon(x, y, white = false) {
    const m = sprite('pigeon_sit', 0.36, { ax: 0.5, ay: 0, order: O.prop + 2, color: white ? new THREE.Color(1.7, 1.7, 1.75) : 0xffffff, tintK: white ? 0.3 : 1 });
    this.add(m, x, y);
    this.pigeons.push({ m, x, y, px: x, py: y, vx: 0, vy: 0, state: 'sit', white, t: Math.random() * 3, home: x, homeY: y });
  }
  checkpoint(x, y, seg) {
    const lamp = this.lamp(x, y);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: this.glow, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, color: 0xffb050, opacity: 0 }));
    this.add(glow, x, y + 2.62, O.back + 1);
    lamp.material.color.setRGB(0.55, 0.5, 0.5);
    this.checkpoints.push({ x, y, seg, lamp, glow, lit: false });
  }
  trigger(x, fn) { this.triggers.push({ x, fn, fired: false }); }

  build() {
    this.glow = glowTex();
    this.alleyTex = gradTex([[0, 'rgba(40,18,8,0)'], [0.45, 'rgba(30,12,6,0.75)'], [1, 'rgba(14,6,3,1)']]);
    const S = this.scene;
    // sky, sun, rays (camera-locked)
    this.sky = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matFor(tex.sky, { tint: false }));
    this.sky.renderOrder = O.sky; S.add(this.sky);
    this.sun = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: sunTex(), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    this.sun.renderOrder = O.sun; S.add(this.sun);
    this.rays = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: raysTex(), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
    this.rays.renderOrder = O.over - 3; S.add(this.rays);
    this.warm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: gradTex([[0, 'rgba(255,170,80,0.0)'], [0.55, 'rgba(255,150,60,0.06)'], [1, 'rgba(255,120,40,0.16)']]), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    this.warm.renderOrder = O.over - 2; S.add(this.warm);
    this.haze1 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: gradTex([[0, 'rgba(255,190,140,0)'], [0.5, 'rgba(255,175,120,0.3)'], [1, 'rgba(255,160,100,0.42)']]), transparent: true, depthWrite: false, depthTest: false }));
    this.haze1.renderOrder = O.skyline + 1; S.add(this.haze1);
    this.haze2 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: gradTex([[0, 'rgba(255,185,130,0.05)'], [0.6, 'rgba(250,165,110,0.2)'], [1, 'rgba(230,140,90,0.28)']]), transparent: true, depthWrite: false, depthTest: false }));
    this.haze2.renderOrder = O.mid + 1; S.add(this.haze2);
    this.vig = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: vignetteTex(), transparent: true, depthWrite: false, depthTest: false }));
    this.vig.renderOrder = O.over; S.add(this.vig);

    // far skyline
    const sky = this.layer(0.12, 0.41);
        const skH = 4.0;
    const sk = tiledQuad('skyline', 600 * 0.12 + 120, skH, skH * aspect('skyline'), { order: O.skyline, color: 0xf2d0bc, tintK: 0.6, opacity: 0.82 });
    sk.position.set(-60, 1.2 + skH, 0); sky.add(sk);

    // mid layers per segment
    const mid = this.layer(0.45, 0.55);
    const segs = [
      { a: -40, b: SEG_X[1], name: 'street', h: 5.0, y: -1.65 },
      { a: SEG_X[1], b: SEG_X[2], name: 'market', h: 4.8, y: -1.6 },
      { a: SEG_X[2], b: SEG_X[3], name: 'roofs', h: 5.0, y: 0.1 },
    ];
    for (const s of segs) {
      const w = s.h * aspect(s.name);
      const lx0 = s.a * 0.45 - 14, lx1 = s.b * 0.45 + (s.name === 'roofs' ? 2 : 0);
      for (let x = lx0; x < lx1; x += w) {
        const cw = Math.min(w, lx1 - x);
        const q = regionQuad(s.name, cw, s.h, 0, cw / w, 0, 1, { order: O.mid, color: 0xd6bcae, tintK: 0.9 });
        q.position.set(x, s.y, 0); mid.add(q);
      }
    }
    // the Nile backdrop barely moves (f = 0.08) so one painting covers the whole jetty run
    const nl = this.layer(0.08, 0.3);
    const nh = 10;
    const nq = sprite('nile', nh, { ax: 0, ay: 0, order: O.nile, tintK: 0.5 });
    nq.position.set(28.5, -2.75, 0); nl.add(nq); this.nileMat = nq.material;
    this.nileLayer = nl;

    // foreground silhouettes (fast parallax, bottom of screen)
    const fg = this.layer(1.22, 1.0);
    const fgItems = ['barrel', 'sack', 'post', 'melons', 'crates'];
    for (let x = 14, i = 0; x < 560 * 1.22; x += 17 + (i * 7) % 11, i++) {
      const n = fgItems[i % fgItems.length];
      const m = sprite(n, n === 'crates' ? 1.5 : 1.1, { ax: 0.5, ay: 0, order: O.fg, color: 0x2a160c, tintK: 0.2 });
      m.position.set(x, -2.35, 0); m.material.opacity = 0.92; fg.add(m);
    }
    this.fgLayer = fg;

    // ===== 1. STREET =====
    this.ground(-14, SEG_X[1], 0, 'g_cobble');
    this.checkpoint(1.5, 0, 0);
    this.npc('npc_tea', 1.72, 6.6, 0, LINES.tea, { flip: true });
    this.barrel(13);
    this.cart(20);
    this.lamp(24);
    this.laundryLine(28, 32);
    this.trigger(22, () => this.hint(HINTS.laundry, 'down'));
    this.cart(44);
    this.toktok(38, 5.5);
    this.crates(51.6, 1);
    this.lamp(57);
    this.kicker(66, 50, 63);
    this.npc('npc_kid2', 1.3, 68.6, 0, LINES.kidGoal, { r: 0 });
    this.cart(74);
    this.crates(78.4, 1); this.crates(79.33, 2);
    this.mangoAt(79.8, 3.35);
    this.laundryLine(86, 90);
    this.lamp(93);
    this.toktok(94, 6.2);
    this.cart(101);
    this.barrel(107);
    this.laundryLine(114, 118);
    this.laundryLine(120.5, 124.5);
    this.toktok(128, 6.8);
    this.cart(135);
    this.lamp(140);
    this.kicker(152, 137, 149);
    this.prop('melons', 0.75, 158, 0, { order: O.back }); this.prop('sack', 0.8, 160, 0, { order: O.back });

    // ===== 2. MARKET =====
    this.ground(SEG_X[1], 300, 0, 'g_dirt');
    this.checkpoint(164.5, 0, 1);
    this.stall(171);
    this.npc('npc_vendor', 1.65, 175.5, 0, null, { r: 3.2 }).gift = true;
    this.stall(181); this.stall(184.5);
    this.mangoAt(182.75, 3.9);
    this.prop('melons', 0.75, 189, 0); this.solid(188.3, 189.7, 0, 0.7);
    this.prop('sack', 0.85, 193, 0); this.solid(192.6, 193.4, 0, 0.8);
    this.prop('lantern', 0.7, 196, 2.6, { order: O.back });
    this.puddle(199, 203.5);
    this.trigger(194, () => this.hint(HINTS.puddle, 'jump'));
    // the goat lane: a low tarp so nobody hops over the goat
    const tarp = regionQuad('stall', 12.6, 0.75, 0.02, 0.98, 0.8, 0.99, { order: O.front - 1 });
    this.add(tarp, 209.7, 1.95);
    this.solid(209.7, 222.3, 2.0, 2.7);
    for (const px of [209.9, 222.1]) { const pole = sprite('plank', 0.12, { width: 2.2, ax: 0, ay: 0.5, order: O.back }); pole.rotation.z = Math.PI / 2; this.add(pole, px, -0.1); }
    this.goat = { x: 216, y: 0, state: 'block', t: 0, m: this.prop('goat', 1.05, 216, 0, { order: O.prop + 3 }) };
    this.goat.solid = this.solid(215.45, 216.55, 0, 1.15);
    this.goatman = this.npc('npc_goatman', 1.75, 220.6, 0, LINES.goatman, { flip: true, r: 7 });
    this.trigger(206, () => this.hint(HINTS.goat, 'act'));
    this.stall(228); this.stall(233);
    this.prop('lantern', 0.7, 236.5, 2.7, { order: O.back });
    this.stall(239);
    this.puddle(241.5, 245.5);
    this.prop('melons', 0.75, 252, 0); this.solid(251.3, 252.7, 0, 0.7);
    this.barrel(256);
    this.cart(262);
    this.stall(268);
    this.prop('sack', 0.85, 273, 0, { order: O.back });
    this.lamp(277);
    // crate stairs up to the roofs
    this.crates(282, 1, 0.93); this.crates(282.93, 1, 0.93);
    this.crates(283.86, 2, 0.93); this.crates(284.79, 2, 0.93);
    this.crates(285.72, 3, 0.93); this.crates(286.65, 3, 0.93);
    this.trigger(279, () => this.heroSay(LINES.heroRoof));

    // ===== 3. ROOFTOPS =====
    this.roof(ROOF_X0, 310, 6.0, { u0: 0 });
    this.checkpoint(291.5, 6.0, 2);
    this.prop('tank', 1.9, 300, 6.0, { order: O.back });
    this.pigeon(304, 6.0); this.pigeon(305, 6.0);
    this.alley(310, 314, 6.0);
    this.roof(314, 332, 6.3, { u0: 0.2 });
    this.prop('dish', 1.3, 320, 6.3, { order: O.back });
    this.trigger(326, () => this.hint(HINTS.vault, 'act'));
    this.alley(332, 338.5, 6.0);
    this.roof(338.5, 356, 6.0, { u0: 0.1 });
    this.pigeon(345, 6.0); this.pigeon(346.2, 6.0); this.pigeon(352, 6.0);
    this.alley(356, 374.6, 5.6);
    this.dish(360.2, 6.4); this.dish(365.5, 6.9); this.dish(371.35, 6.4);
    this.mangoAt(365.5, 8.3);
    this.roof(374.6, 392, 5.6, { u0: 0.05 });
    this.prop('tank', 1.9, 377, 5.6, { order: O.prop }); this.oneway(376.3, 377.7, 7.45);
    this.prop('tower', 4.0, 383, 5.6, { order: O.prop }); this.oneway(382.1, 383.9, 9.55);
    this.mangoAt(383, 10.1);
    this.pigeon(388.5, 5.6, true);
    this.pigeon(386.5, 5.6);
    this.trigger(384.5, () => this.whitePigeon());
    this.alley(392, 399, 5.2);
    this.roof(399, 416, 5.2, { u0: 0.3 });
    this.add(sprite('plank', 0.3, { width: 5.4, ax: 0, ay: 1, order: O.prop }), 415.8, 5.25);
    this.oneway(416, 421, 5.2);
    this.alley(416, 421, 5.2);
    this.roof(421, 438, 5.6, { u0: 0.15 });
    this.pigeon(427, 5.6); this.pigeon(428, 5.6); this.pigeon(433, 5.6);
    this.alley(438, 442, 4.8);
    this.roof(442, SEG_X[3], 4.8, { u0: 0.25 });
    this.prop('tank', 1.9, 450, 4.8, { order: O.back });

    // ===== 4. JETTY =====
    this.ground(SEG_X[3], WATER_X + 0.5, 0, 'g_dirt');
    this.checkpoint(470.5, 0, 3);
    this.lamp(482); this.prop('post', 0.9, 488, 0, { order: O.prop }); this.prop('post', 0.9, 491.5, 0, { order: O.prop });
    // water
    const wt = waterTex(); wt.wrapS = THREE.RepeatWrapping;
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(220, 7), new THREE.MeshBasicMaterial({ map: wt, depthWrite: false, depthTest: false, transparent: true }));
    this.water.geometry.translate(110, -3.5, 0); wt.repeat.set(12, 1);
    this.add(this.water, WATER_X, -0.15, O.prop - 5);
    this.waterFront = new THREE.Mesh(new THREE.PlaneGeometry(220, 7), new THREE.MeshBasicMaterial({ map: wt, depthWrite: false, depthTest: false, transparent: true, opacity: 0.88 }));
    this.waterFront.geometry.translate(110, -3.5, 0);
    this.add(this.waterFront, WATER_X, -0.42, O.water);
    for (let x = 493; x < JETTY_X1 - 1; x += 7.3) this.add(sprite('jetty', 1.55, { ax: 0, ay: 1, order: O.prop + 1 }), x, 0.7);
    this.solid(493, JETTY_X1, 0.3, 0.6);
    this.prop('post', 1.1, JETTY_X1 - 0.4, 0.45, { order: O.prop + 2 });
    // ferry
    const fm = sprite('ferry', 11 / aspect('ferry'), { width: 11, ax: 0, ay: 0, order: O.prop + 3 });
    this.ferry = { m: fm, x0: JETTY_X1 + 1.2, x: JETTY_X1 + 1.2, px: JETTY_X1 + 1.2, v: 0, moving: false, bob: 0 };
    this.add(fm, this.ferry.x, -0.62);
    this.ferry.deck = this.oneway(0, 0, 0.68);
    this.captain = this.npc('npc_captain', 1.75, 0, 0.68, LINES.captain, { r: 0 });
    this.captain.m.renderOrder = O.prop + 4;
    this.trigger(476, () => { this.say(this.captain, LINES.captain, 3.2); sfx.ferryHorn(); });
    this.trigger(485, () => { this.ferry.moving = true; this.hint(HINTS.ferry, 'act'); sfx.ferryHorn(); });
    this.positionFerry();
  }

  positionFerry() {
    const f = this.ferry;
    f.m.position.x = f.x;
    f.deck.x0 = f.x + 0.9; f.deck.x1 = f.x + 10.2;
    this.captain.x = f.x + 9.0; this.captain.m.position.x = this.captain.x;
  }

  // ---------------------------------------------------------------- run state
  resetRun() {
    this.mangoes = 12; this.hearts = 3; this.timeLeft = TIME_LIMIT; this.segment = 0;
    this.cp = { x: 3, y: 0, mangoes: 12, time: TIME_LIMIT, seg: 0 };
    this.lastSafe = { x: 3, y: 0 };
    this.done = false; this.paused = false; this.elapsed = 0; this.mangoStreak = 0;
    for (const c of this.checkpoints) { c.lit = false; c.glow.material.opacity = 0; c.lamp.material.color.setRGB(0.55, 0.5, 0.5); }
    for (const tr of this.triggers) tr.fired = false;
    for (const n of this.npcs) n.said = false;
    for (const p of this.pickups) if (!p.static) { this.scene.remove(p.m); }
    this.pickups = this.pickups.filter((p) => p.static);
    for (const p of this.pickups) { p.collected = false; p.m.visible = true; p.x = p.home.x; p.y = p.home.y; }
    for (const pg of this.pigeons) this.resetPigeon(pg);
    this.resetGoat(); this.resetToks(); this.resetFerry();
    for (const k of this.kickers) { k.kicks = 0; k.cd = 0.8; }
    this.respawnAt(this.cp.x, this.cp.y, true);
    this.syncHud();
  }
  resetPigeon(pg) {
    pg.state = 'sit'; pg.x = pg.px = pg.home; pg.y = pg.py = pg.homeY; pg.vx = pg.vy = 0;
    pg.m.material.map = tex.pigeon_sit; pg.m.scale.set(0.36 * aspect('pigeon_sit'), 0.36, 1);
    pg.m.position.set(pg.x, pg.y, 0); pg.m.visible = true;
  }
  resetGoat() {
    const g = this.goat; g.state = 'block'; g.x = 216; g.t = 0;
    g.m.position.set(216, 0, 0); g.m.scale.set(Math.abs(g.m.userData.w), 1.05, 1); g.m.renderOrder = O.prop + 3;
    g.m.material.map = tex.goat; g.solid.y1 = 1.15; g.solid.x0 = 215.45; g.solid.x1 = 216.55;
    this.goatman.line = LINES.goatman; this.goatman.said = false;
  }
  resetToks() { for (const t of this.toks) { t.active = false; t.done = false; t.m.visible = false; t.top.off = true; } for (const b of this.balls) this.scene.remove(b.m); this.balls = []; }
  resetFerry() { const f = this.ferry; f.x = f.px = f.x0; f.moving = false; f.v = 0; f.deck.dx = 0; this.waitSaid = false; this.positionFerry(); }
  respawnAt(x, y, full) {
    const h = this.hero;
    h.reset(x, y + 0.02);
    h.invuln = full ? 0 : 1.2;
    this.cam.x = this.cam.px = x + 2.5; this.cam.y = this.cam.py = y + 2.4;
    this.cam.look = 2.5;
  }
  restartFromCheckpoint(reason) {
    const c = this.cp;
    // remove loose mangoes, rearm everything after the checkpoint
    for (const p of this.pickups) if (!p.static) this.scene.remove(p.m);
    this.pickups = this.pickups.filter((p) => p.static);
    this.mangoes = c.mangoes; this.hearts = 3;
    this.timeLeft = Math.max(c.time, reason === 'time' ? 75 : c.time);
    for (const tr of this.triggers) if (tr.x > c.x) tr.fired = false;
    for (const n of this.npcs) if (n.x > c.x) n.said = false;
    for (const p of this.pickups) if (p.home.x > c.x) { p.collected = false; p.m.visible = true; }
    this.resetToks();
    for (const t of this.toks) if (t.trigX < c.x) t.done = true;
    if (this.goat.x > c.x || this.goat.state !== 'block') { if (c.x < 216) this.resetGoat(); }
    if (c.seg >= 3 || c.x < this.ferry.x0) this.resetFerry();
    for (const k of this.kickers) if (k.x > c.x) { k.kicks = 0; k.cd = 0.8; }
    for (const pg of this.pigeons) if (pg.home > c.x) this.resetPigeon(pg);
    this.respawnAt(c.x, c.y, true);
    this.done = false;
    this.syncHud();
  }
  syncHud() { this.ui.setHearts(this.hearts); this.ui.setMangoes(this.mangoes); this.ui.setTime(this.timeLeft, TIME_LIMIT); }

  // ---------------------------------------------------------------- events
  pick(k) { const a = LINES[k]; return a[Math.floor(Math.random() * a.length)]; }
  heroSay(line, dur = 2.2) { if (line) this.ui.bubble(this.hero, line, dur, true); }
  say(npc, line, dur = 3) { if (line) this.ui.bubble(npc, line, dur, false); }
  hint(h, btn) { this.ui.toast(h, 3.2); if (btn) this.ui.hintBtn(btn, 2.8); }
  shake(a) { this.cam.trauma = Math.min(1, this.cam.trauma + a); }
  hitstop(t) { this.hitstopT = Math.max(this.hitstopT, t); }
  flash(a = 1) { this.flashT = Math.max(this.flashT || 0, a); }
  loseHeart() {
    this.hearts = Math.max(0, this.hearts - 1); this.ui.setHearts(this.hearts, true);
    if (this.hearts === 0) setTimeout(() => this.onOutOfHearts && this.onOutOfHearts(), 650);
  }
  spillMangoes(n, x, y) {
    n = Math.min(n, this.mangoes);
    if (n <= 0) return;
    this.mangoes -= n; this.ui.setMangoes(this.mangoes, true); sfx.spill();
    for (let i = 0; i < n; i++) {
      const m = sprite('mango', 0.4, { ax: 0.5, ay: 0.5, order: O.pickup });
      this.scene.add(m);
      const vx = (Math.random() - 0.5) * 5 - this.hero.facing * 1.5, vy = 6 + Math.random() * 3.5;
      this.pickups.push({ m, x, y, px: x, py: y, vx, vy, static: false, life: 6.5, spin: (Math.random() - 0.5) * 12 });
    }
    this.fx.juice(x, y, 6);
  }
  collect(p) {
    if (this.mangoes >= 12) { if (!p.static) { p.life = Math.min(p.life, 0.01); } return false; }
    this.mangoes++; this.ui.setMangoes(this.mangoes, true);
    sfx.mango(this.mangoStreak++); this.fx.sparkle(p.x, p.y, 10);
    this.ui.floatText(p.x, p.y + 0.4, '+١');
    return true;
  }
  actContext(h) {
    const ahead = (x) => (x - h.x) * h.facing;
    const g = this.goat;
    if (g.state === 'block' && ahead(g.x) > -0.3 && ahead(g.x) < 2.6 && Math.abs(h.y - g.y) < 1) return 'goat';
    for (const b of this.balls) if (b.active && ahead(b.x) > -0.6 && ahead(b.x) < 3.2 && b.y - h.y < 2.6) return 'ball';
    return null;
  }
  onNudge(h) {
    const g = this.goat;
    if (g.state !== 'block') return;
    g.state = 'moving'; g.t = 0; g.solid.y1 = -10;
    setTimeout(() => sfx.bleat(), 120);
    this.fx.sparkle(g.x, 1.3, 8, 0xff8a9a);
    this.heroSay(LINES.heroGoat, 2.4);
    this.goatman.line = LINES.goatmanThanks;
    setTimeout(() => this.say(this.goatman, LINES.goatmanThanks, 2.6), 900);
  }
  whitePigeon() {
    const p = this.pigeons.find((q) => q.white);
    if (!p || p.state !== 'sit') return;
    p.state = 'fly'; p.vx = 2.6; p.vy = 2.2; sfx.coo();
    setTimeout(() => sfx.flap(), 200);
    this.heroSay(LINES.heroPigeon, 3.2);
  }

  // ---------------------------------------------------------------- simulation
  step(dt) {
    if (this.done) { this.hero.frozen = true; }
    this.t += dt;
    if (this.hitstopT > 0) { this.hitstopT -= dt; return; }
    const h = this.hero;
    if (input.bot) this.botThink(dt);
    if (!this.done && !h.frozen) { this.timeLeft -= dt; this.elapsed += dt; }
    if (this.timeLeft <= 0 && !this.done && !h.frozen) { this.timeLeft = 0; this.onTimeout && this.onTimeout(); }

    // moving platforms first (ferry carries the hero)
    const f = this.ferry;
    f.px = f.x;
    if (f.moving) {
      const gap = f.deck.x0 - JETTY_X1;
      const target = gap > 5.6 && !(h.ground === f.deck) ? 0 : 1.15;
      if (gap > 5.6 && f.v > 0.1 && !this.waitSaid) { this.waitSaid = true; this.say(this.captain, LINES.captainWait, 2.5); }
      f.v += (target - f.v) * Math.min(1, dt * 4);
      if (h.ground === f.deck) f.v = Math.min(f.v + dt, 1.6);
    }
    const ox = f.x; f.x += f.v * dt; f.deck.dx = f.x - ox; this.positionFerry();

    // tok-toks
    for (const t of this.toks) {
      if (!t.active && !t.done && h.x > t.trigX && h.x < t.trigX + 25) {
        t.active = true; t.x = Math.max(this.cam.x + this.view.w / 2 + 3, h.x + 22); t.px = t.x; t.m.visible = true; t.top.off = false;
        sfx.horn(); this.ui.edgeWarn(1.4, 1.0);
        this.hint(HINTS.toktok, 'jump');
        this.ui.bubble(t, LINES.toktok, 1.8, false, 2.2);
      }
      if (!t.active) continue;
      t.px = t.x; t.x += t.vx * dt;
      t.top.x0 = t.x - 1.0; t.top.x1 = t.x + 0.95; t.top.dy = 0;
      if (Math.random() < dt * 8) this.fx.dust(t.x + 1.1, 0.05, 1, 0.5);
      const hb = h.box();
      if (hb.x1 > t.x - 1.15 && hb.x0 < t.x + 1.15 && hb.y0 < 1.55 && hb.y1 > 0.1) {
        if (h.hurt(t.x, { heart: true, spill: 2, kb: 6 })) this.fx.dust(h.x, h.y, 8, 1);
      }
      if (t.x < this.cam.x - this.view.w / 2 - 4) { t.active = false; t.done = true; t.m.visible = false; t.top.off = true; }
    }
    // football kids
    for (const k of this.kickers) {
      k.cd -= dt;
      if (h.x > k.from && h.x < k.to && k.cd <= 0 && k.kicks < 3 && !h.frozen) {
        k.cd = 2.0; k.kicks++;
        const m = sprite('ball', 0.42, { ax: 0.5, ay: 0.5, order: O.pickup + 1 }); this.scene.add(m);
        const b = { m, x: k.x - 0.5, y: 0.35, px: k.x - 0.5, py: 0.35, vx: -7.5 - Math.random(), vy: 4.5 + Math.random() * 2, active: true, life: 4, hit: false, kicker: k, rot: 0 };
        this.balls.push(b); sfx.kick(); k.n.m.scale.y = k.n.base * 0.9;
        if (k.kicks === 1) this.hint(HINTS.ball, 'act');
      }
    }
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.px = b.x; b.py = b.y; b.life -= dt;
      b.vy -= 22 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot -= b.vx * dt * 2.4;
      if (b.y < 0.21) { b.y = 0.21; b.vy = Math.abs(b.vy) * 0.62; if (b.vy > 1.5) sfx.kick(); }
      if (b.active) {
        // staff swing bats it back
        if (h.swingT > 0.04 && h.swingT < 0.27) {
          const dx = (b.x - h.x) * h.facing;
          if (dx > -0.4 && dx < 2.6 && b.y > h.y - 0.2 && b.y < h.y + 2.4) {
            b.vx = 13 * h.facing; b.vy = 7; b.active = false; sfx.whack(); this.shake(0.2); this.hitstop(0.06);
            this.fx.sparkle(b.x, b.y, 12); this.say(b.kicker.n, LINES.kidGoal, 2.2); this.ui.floatText(b.x, b.y + 0.5, 'جووون!');
          }
        }
        const hb = h.box();
        if (b.active && b.x + 0.2 > hb.x0 && b.x - 0.2 < hb.x1 && b.y + 0.2 > hb.y0 && b.y - 0.2 < hb.y1) {
          if (h.hurt(b.x, { heart: true, spill: 2, kb: 4 })) { b.vx = -b.vx * 0.4; b.vy = 5; b.active = false; this.say(b.kicker.n, LINES.kidSorry, 2.2); }
        }
      }
      if (b.life <= 0 || Math.abs(b.x - h.x) > 30) { this.scene.remove(b.m); this.balls.splice(i, 1); }
    }
    // laundry: duck or get a wet sheet in the face
    for (const L of this.laundry) {
      L.cd -= dt; L.wave *= Math.exp(-dt * 3);
      const hb = h.box();
      if (hb.x1 > L.x0 && hb.x0 < L.x1 && hb.y1 > L.y0 && hb.y0 < L.y1 && L.cd <= 0) {
        L.cd = 1.2; L.wave = 1;
        if (h.hurt(h.x - h.facing, { heart: false, spill: 1, kb: 3.5, line: LINES.laundry })) h.vy = 2;
      }
    }
    // puddles
    for (const p of this.puddles) {
      if (h.onGround && h.x > p.x0 && h.x < p.x1 && Math.abs(h.vx) > 3.2 && h.slipT <= 0 && h.invuln <= 0) h.slip();
    }
    // goat
    const g = this.goat;
    if (g.state === 'block') {
      g.t += dt;
      g.m.scale.y = 1.05 * (1 + Math.sin(g.t * 2.4) * 0.015);
      if (Math.abs(h.x - g.x) < 1.2 && h.onGround && Math.random() < dt * 0.6) sfx.bleat();
    } else if (g.state === 'moving') {
      g.t += dt;
      const k = Math.min(1, g.t / 0.9), e = k * k * (3 - 2 * k);
      g.m.position.set(216 + e * 1.6, e * 0.5, 0);
      const s = 1 - e * 0.18; g.m.scale.set(g.m.userData.w * s, 1.05 * s, 1);
      g.m.renderOrder = O.back + 1;
      if (k >= 1) { g.state = 'aside'; g.m.material.map = tex.goat_eat; g.m.scale.set(1.05 * s * aspect('goat_eat'), 1.05 * s, 1); }
    }
    // pigeons scatter
    for (const p of this.pigeons) {
      p.px = p.x; p.py = p.y; p.t += dt;
      if (p.state === 'sit') {
        if (!p.white && Math.abs(h.x - p.x) < 3.2 && Math.abs(h.y - p.y) < 3) {
          p.state = 'fly'; p.vx = (p.x > h.x ? 1 : -1) * (2 + Math.random() * 2); p.vy = 4 + Math.random() * 2; sfx.flap(); this.fx.feathers(p.x, p.y + 0.2);
        }
      } else {
        p.vy += (p.white ? 0.3 : 1.2) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.y > this.cam.y + 8) p.m.visible = false;
      }
    }
    // npc chatter
    for (const n of this.npcs) {
      if (n.said || !n.r) continue;
      if (Math.abs(h.x - n.x) < n.r && Math.abs(h.y - n.y) < 3) {
        n.said = true;
        if (n.gift) {
          if (this.mangoes < 12) {
            this.say(n, LINES.vendorGift, 3);
            const m = sprite('mango', 0.4, { ax: 0.5, ay: 0.5, order: O.pickup }); this.scene.add(m);
            this.pickups.push({ m, x: n.x, y: 1.6, px: n.x, py: 1.6, vx: -2.2, vy: 4.5, static: false, life: 8, spin: 6 });
          } else this.say(n, LINES.vendorFull, 3);
        } else this.say(n, n.line, 3);
      }
    }
    // triggers
    for (const tr of this.triggers) if (!tr.fired && h.x > tr.x) { tr.fired = true; tr.fn(); }
    // segments and checkpoints
    for (let i = this.segment + 1; i < SEG_X.length; i++) if (h.x > SEG_X[i] + 1) { this.segment = i; this.ui.banner(SEGMENTS[i]); }
    for (const c of this.checkpoints) {
      if (!c.lit && h.x > c.x - 0.5 && h.onGround && Math.abs(h.y - c.y) < 1 && c.x + 0.6 >= this.cp.x - 0.01) {
        c.lit = true; c.lamp.material.color.setRGB(1.2, 1.1, 0.95);
        if (c.x > 3) { sfx.checkpoint(); this.ui.toast(HINTS.checkpoint, 1.6); this.fx.sparkle(c.x, c.y + 2.6, 14); }
        this.cp = { x: c.x + 0.6, y: c.y, mangoes: this.mangoes, time: this.timeLeft, seg: c.seg };
      }
    }

    h.step(dt);

    // pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (p.collected) continue;
      p.px = p.x; p.py = p.y;
      if (!p.static) {
        p.life -= dt;
        p.vy -= 22 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        const top = this.groundTop(p.x, p.py + 0.05);
        if (top !== null && p.y < top + 0.2 && p.vy < 0) { p.y = top + 0.2; p.vy = Math.abs(p.vy) > 2 ? -p.vy * 0.45 : 0; p.vx *= 0.7; }
        if (p.life <= 0 || p.y < -6) { this.scene.remove(p.m); this.pickups.splice(i, 1); continue; }
      }
      const hb = h.box();
      if (p.x + 0.3 > hb.x0 && p.x - 0.3 < hb.x1 && p.y + 0.3 > hb.y0 && p.y - 0.3 < hb.y1 + 0.2) {
        if (this.collect(p)) {
          if (p.static) { p.collected = true; p.m.visible = false; }
          else { this.scene.remove(p.m); this.pickups.splice(i, 1); }
        }
      }
    }
    if (this.mangoStreak && Math.random() < dt) this.mangoStreak = 0;

    // safe spot + falls
    if (h.onGround && h.ground && !h.ground.dx && !h.ground.bouncy && h.slipT <= 0) {
      const s = h.ground;
      if (h.x - s.x0 > 1.0 && s.x1 - h.x > 1.0 && !this.puddles.some((p) => h.x > p.x0 - 1 && h.x < p.x1 + 1)) this.lastSafe = { x: h.x, y: h.y };
    }
    const fellRoof = h.x > ROOF_X0 + 0.5 && h.x < SEG_X[3] && h.y < 2.6;
    const fellWater = h.x > WATER_X + 0.3 && h.y < -0.75;
    if ((fellRoof || fellWater || h.y < -8) && !h.frozen) this.fall(fellWater);

    // finale: standing on the ferry deck
    if (!this.done && h.onGround && h.ground === f.deck) {
      this.done = true; h.celebrate = true; h.vx = 0;
      sfx.cheer(); this.fx.sparkle(h.x, h.y + 1.5, 24); this.shake(0.3);
      setTimeout(() => this.onFinish && this.onFinish(), 1300);
    }

    this.fx.step(dt);
    this.updateCamera(dt);
  }

  fall(water) {
    const h = this.hero;
    console.log('[saidi] fall', JSON.stringify({ water, x: +h.x.toFixed(1), y: +h.y.toFixed(1), safe: this.lastSafe, hearts: this.hearts, trace: input.bot && input.bot.trace ? input.bot.trace.slice(-4) : null }));
    h.frozen = true;
    if (water) { sfx.splash(); this.fx.splash(h.x, -0.3); this.heroSay(LINES.splash, 2.6); }
    else { sfx.hurt(); this.heroSay(LINES.fall, 2.0); }
    this.shake(0.35);
    const lost = Math.min(1, this.mangoes);
    this.mangoes -= lost; this.ui.setMangoes(this.mangoes, true);
    this.hearts = Math.max(0, this.hearts - 1); this.ui.setHearts(this.hearts, true);
    setTimeout(() => {
      if (this.hearts <= 0) { this.onOutOfHearts && this.onOutOfHearts(); return; }
      if (water) { this.resetFerry(); for (const tr of this.triggers) if (tr.x >= 476) tr.fired = false; this.respawnAt(this.cp.x, this.cp.y, false); }
      else this.respawnAt(this.lastSafe.x - 0.4 * Math.sign(h.facing || 1), this.lastSafe.y, false);
    }, water ? 1100 : 750);
  }

  groundTop(x, y) {
    let best = null;
    for (const s of this.solids) if (x > s.x0 && x < s.x1 && s.y1 <= y + 0.01 && (best === null || s.y1 > best)) best = s.y1;
    for (const p of this.oneways) if (!p.off && !p.bouncy && x > p.x0 && x < p.x1 && p.y1 <= y + 0.01 && (best === null || p.y1 > best)) best = p.y1;
    return best;
  }
  overlapsSolid(b) {
    for (const s of this.solids) if (b.x1 > s.x0 && b.x0 < s.x1 && b.y1 > s.y0 && b.y0 < s.y1) return true;
    return false;
  }

  updateCamera(dt) {
    const c = this.cam, h = this.hero;
    c.px = c.x; c.py = c.y;
    const lookT = h.facing * 2.6 + h.vx * 0.22;
    c.look += (lookT - c.look) * Math.min(1, dt * 2.2);
    const tx = h.x + c.look;
    const off = this.view.h * 0.2;
    let ty = h.y + off;
    if (h.x > ROOF_X0 - 3 && h.x < SEG_X[3] + 2 && !h.onGround && h.vy < 0) ty = Math.max(ty, c.y - 0.02);
    ty = Math.max(ty, off);
    c.x += (tx - c.x) * Math.min(1, dt * 5.5);
    const vk = h.vy < -12 ? 7 : 3.2;
    c.y += (ty - c.y) * Math.min(1, dt * vk);
    c.trauma = Math.max(0, c.trauma - dt * 1.6);
  }

  // ---------------------------------------------------------------- autoplay bot (?debug=auto)
  botThink() {
    const h = this.hero, b = input.bot;
    b.right = true; b.left = false; b.down = false; b.jump = b.jumpHold > 0; b.jumpHold = (b.jumpHold || 0) - 1 / 60;
    const press = (k) => { if (k === 'jump') { if (h.onGround) { b.jumpPressed = true; b.jumpHold = 0.4; b.jump = true; } } else if (!b.actCd || b.actCd <= 0) { b.actPressed = true; b.actCd = 0.5; } };
    b.actCd = (b.actCd || 0) - 1 / 60;
    if (h.frozen) return;
    if (!h.onGround && b.target && h.vaultT <= 0) {
      const T = b.target, g = 34, disc = h.vy * h.vy + 2 * g * (h.y - T.y);
      if (disc > 0) { const t = (h.vy + Math.sqrt(disc)) / g, land = h.x + h.vx * t; if (land > T.x1 + 0.2 && T.x1 - T.x0 < 3) b.right = false; }
    }
    if (h.onGround) b.target = null;
    // laundry: duck under
    for (const L of this.laundry) if (h.x > L.x0 - 1.6 && h.x < L.x1 + 0.6) b.down = true;
    if (b.down) return;
    // tok-tok: jump to land on its roof
    for (const t of this.toks) if (t.active) { const d = t.x - 1.1 - h.x; if (d > 0 && d < 5.2 + Math.abs(h.vx) * 0.2 && h.onGround) press('jump'); }
    // ball: bat it
    for (const ball of this.balls) if (ball.active) { const d = ball.x - h.x; if (d > 0.3 && d < 2.6) press('act'); }
    // goat: nudge
    if (this.goat.state === 'block' && this.goat.x - h.x < 2.2 && this.goat.x - h.x > 0) { b.right = h.x < this.goat.x - 1.2; press('act'); return; }
    // puddles: jump
    for (const p of this.puddles) { const d = p.x0 - h.x; if (d > 0.4 && d < 1.6) press('jump'); }
    // walls / props ahead: jump
    for (const s of this.solids) {
      const d = s.x0 - (h.x + 0.3);
      if (d > -0.05 && d < 1.1 && s.y1 - h.y > 0.6 && s.y1 - h.y < 2.4 && s.y0 < h.y + 1.7 && h.y < s.y1) press('jump');
    }
    // gaps ahead: plan the take-off from the predicted landing point
    if (h.onGround && h.ground && h.ground !== this.ferry.deck) {
      const edge = h.ground.x1, d = edge - h.x;
      const T = this.nextTarget(edge, h.y);
      if (T && d < 2.4 && d > -0.3) {
        const gap = T.x0 - edge;
        const flight = (vy, dy) => { const g = 33; const disc = vy * vy - 2 * g * dy; return disc < 0 ? -1 : (vy + Math.sqrt(disc)) / g; };
        if (gap > 0.2) {
          const lo = T.x0 + 0.35, hi = Math.min(T.x1 - 0.35, T.x0 + 4);
          const tj = flight(12.4, T.y - h.y), landJ = h.x + 7.3 * tj;
          const tv = flight(13.6, T.y - h.y), landV = h.x + 10.8 * tv;
          const big = gap >= 4.4;
          if (!big && tj > 0 && landJ >= lo && landJ <= hi + 0.6) { press('jump'); b.target = T; }
          else if (!big && tj > 0 && landJ > hi + 0.6 && d < 1.2 && d > 0.35) { b.right = false; }
          else if (big && tv > 0 && landV >= lo && landV <= hi + 2 && Math.abs(h.vx) > 3 && h.stamina >= 28) { press('act'); b.target = T; }
          else if (d < 0.35) { if (big) press('act'); else press('jump'); b.target = T; }
          if (b.trace) b.trace.push([+h.x.toFixed(1), +d.toFixed(2), +gap.toFixed(1), +landJ.toFixed(1), +landV.toFixed(1), lo, hi]);
        }
      }
    }
    // ferry: vault from the end of the jetty
    if (h.x > JETTY_X1 - 1.0 && h.x < JETTY_X1 && h.onGround) press('act');
  }
  nextTarget(edge, y) {
    let best = null;
    const consider = (x0, x1, top) => { if (x0 >= edge - 0.01 && x0 < edge + 12 && top <= y + 1.6 && top > y - 3.5 && (best === null || x0 < best.x0)) best = { x0, x1, y: top }; };
    for (const s of this.solids) consider(s.x0, s.x1, s.y1);
    for (const p of this.oneways) if (!p.off && !p.bouncy) consider(p.x0, p.x1, p.y1);
    return best;
  }
  nextLanding(edge, y) {
    let best = null;
    for (const s of this.solids) if (s.x0 >= edge - 0.01 && s.x0 < edge + 12 && s.y1 <= y + 1.0 && s.y1 > y - 3 && (best === null || s.x0 < best)) best = s.x0;
    for (const p of this.oneways) if (!p.off && !p.bouncy && p.x0 >= edge - 0.01 && p.x0 < edge + 12 && p.y1 <= y + 1.5 && p.y1 > y - 3 && (best === null || p.x0 < best)) best = p.x0;
    return best;
  }

  // ---------------------------------------------------------------- rendering
  resize(aspectRatio) {
    const vh = (aspectRatio > 1.9 ? 7.2 : aspectRatio > 1.5 ? 7.5 : 9.0) / (this.zoom || 1);
    this.view.h = vh; this.view.w = vh * aspectRatio;
    const cam = this.camera;
    cam.left = -this.view.w / 2; cam.right = this.view.w / 2; cam.top = vh / 2; cam.bottom = -vh / 2;
    cam.updateProjectionMatrix();
  }
  render(alpha, frameDt) {
    const c = this.cam, V = this.view;
    const shake = c.trauma * c.trauma;
    const sx = (Math.sin(this.t * 47.3) + Math.sin(this.t * 31.1)) * 0.18 * shake;
    const sy = (Math.sin(this.t * 41.7) + Math.sin(this.t * 23.9)) * 0.14 * shake;
    const cx = c.px + (c.x - c.px) * alpha + sx, cy = c.py + (c.y - c.py) * alpha + sy;
    this.camera.position.set(cx, cy, 10);
    for (const L of this.layers) L.position.set(cx * (1 - L.userData.f), cy * (1 - L.userData.fy), 0);
    const nileK = Math.max(0, Math.min(1, (cx - (SEG_X[3] - 6)) / 10));
    this.nileLayer.visible = nileK > 0;
    if (this.nileMat) this.nileMat.opacity = nileK;

    const p = 1 - this.timeLeft / TIME_LIMIT; // sunset progress
    const k = Math.pow(Math.min(1, p), 1.2);
    this.sky.position.set(cx, cy, 0); this.sky.scale.set(V.w * 1.04, V.h * 1.04, 1);
    this.sky.material.color.setRGB(1 - 0.12 * k, 1 - 0.36 * k, 1 - 0.28 * k);
    const sunS = V.h * 0.75;
    const inJetty = cx > SEG_X[3] + 4;
    this.sunFade = (this.sunFade === undefined ? 1 : this.sunFade) + ((inJetty ? 0 : 1) - (this.sunFade === undefined ? 1 : this.sunFade)) * Math.min(1, frameDt * 2);
    const sunX = cx + V.w * 0.2, sunY = cy + V.h * (0.34 - 0.7 * k);
    this.sun.position.set(sunX, sunY, 0); this.sun.scale.set(sunS, sunS, 1);
    this.sun.material.opacity = this.sunFade;
    this.sun.material.color.setRGB(1, 1 - 0.25 * k, 1 - 0.45 * k);
    this.rays.position.set(inJetty ? cx + V.w * 0.08 : sunX, inJetty ? cy - V.h * 0.05 : sunY, 0);
    this.rays.scale.set(V.h * 1.9, V.h * 1.9, 1); this.rays.rotation.z = this.t * 0.012;
    this.rays.material.opacity = 0.28 + 0.06 * Math.sin(this.t * 0.7) + 0.12 * k;
    this.warm.position.set(cx, cy, 0); this.warm.scale.set(V.w, V.h, 1);
    this.vig.position.set(cx, cy, 0); this.vig.scale.set(V.w * 1.02, V.h * 1.02, 1);
    if (this.flashT > 0) { this.flashT = Math.max(0, this.flashT - frameDt * 2.5); }
    const fl = this.flashT || 0;
    this.vig.material.color.setRGB(1 + fl * 6, 1 - fl * 0.6, 1 - fl * 0.6);
    this.vig.scale.multiplyScalar(1 - fl * 0.12);
    this.haze1.position.set(cx, cy, 0); this.haze1.scale.set(V.w, V.h, 1);
    this.haze2.position.set(cx, cy, 0); this.haze2.scale.set(V.w, V.h, 1);
    applyGrade({ r: 1.0, g: 0.97 - 0.22 * k, b: 0.92 - 0.3 * k });

    // hero
    const h = this.hero;
    h.updateRig(alpha, this.t);
    const hx = h.root.position.x;
    const gt = this.groundTop(hx, h.root.position.y + 0.05);
    if (gt !== null && !h.frozen) {
      const dist = h.root.position.y - gt;
      const s = Math.max(0.3, 1 - dist * 0.12);
      this.shadow.visible = true; this.shadow.position.set(hx, gt + 0.02, 0); this.shadow.scale.set(1.25 * s, 0.32 * s, 1);
    } else this.shadow.visible = false;

    // entities
    const lerp = (a, b2) => a + (b2 - a) * alpha;
    for (const t of this.toks) if (t.active) { t.m.position.set(lerp(t.px, t.x), Math.abs(Math.sin(this.t * 18)) * 0.03, 0); t.m.rotation.z = Math.sin(this.t * 9) * 0.01; }
    for (const b of this.balls) { b.m.position.set(lerp(b.px, b.x), lerp(b.py, b.y), 0); b.m.rotation.z = b.rot; }
    for (const pk of this.pickups) {
      if (pk.collected) continue;
      if (pk.static) { pk.m.position.set(pk.x, pk.y + Math.sin(this.t * 3 + pk.x) * 0.1, 0); pk.m.rotation.z = Math.sin(this.t * 2 + pk.x) * 0.15; }
      else {
        pk.m.position.set(lerp(pk.px, pk.x), lerp(pk.py, pk.y), 0); pk.m.rotation.z += (pk.spin || 0) * frameDt;
        pk.m.visible = pk.life > 2 || Math.floor(this.t * 10) % 2 === 0;
      }
    }
    for (const pg of this.pigeons) {
      if (pg.state === 'sit') { pg.m.position.set(pg.x, pg.y + (Math.sin(pg.t * 5) > 0.95 ? 0.03 : 0), 0); continue; }
      const up = Math.floor(this.t * 12 + pg.x) % 2 === 0;
      pg.m.material.map = up ? tex.pigeon_up : tex.pigeon_down;
      const hh = up ? 0.5 : 0.24;
      pg.m.scale.set((pg.vx > 0 ? -1 : 1) * hh * aspect(up ? 'pigeon_up' : 'pigeon_down'), hh, 1);
      pg.m.position.set(lerp(pg.px, pg.x), lerp(pg.py, pg.y), 0);
    }
    for (const n of this.npcs) n.m.scale.y = n.base * (1 + Math.sin(this.t * 2 + n.x) * 0.012) * (n.m.scale.y < n.base * 0.95 ? 1.05 : 1);
    for (const L of this.laundry) { L.m.rotation.z = Math.sin(this.t * 1.3 + L.x0) * 0.004 + L.wave * Math.sin(this.t * 20) * 0.02; }
    const f = this.ferry;
    const fx = lerp(f.px, f.x);
    f.bob = Math.sin(this.t * 1.6) * 0.04;
    f.m.position.set(fx, -0.62 + f.bob, 0); this.captain.m.position.set(fx + 9.0, 0.68 + f.bob, 0);
    this.water.material.map.offset.x = this.t * 0.01;
    for (const cpt of this.checkpoints) if (cpt.lit) cpt.glow.material.opacity = 0.55 + Math.sin(this.t * 6 + cpt.x) * 0.08;

    this.fx.render(alpha, cx, cy, V.w, V.h, frameDt);
    this.ui.updateWorldUI(this, cx, cy, V.w, V.h, frameDt);
  }
}
