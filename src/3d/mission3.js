// Mission 3, "A Week at Uncle's Kiosk" (أسبوع في كشك عمه). Uncle Fathy goes to the village for a week and leaves
// Radwan his kiosk. Five short, hard days on one street (level3.js), each its own clock, with the street's
// respect carried across the week:
//   Day 1  the morning rush: serve the queue the right items (two fridges, a freezer and a goods table across
//          a tok-tok lane), one item in hand at a time, later customers want two things
//   Day 2  gas cylinders up stairs and roofs: no sprint, no jump while carrying; the dog in the courtyard (set
//          the cylinder down, whack the dog, pick it up), a plank over an alley, tok-toks
//   Day 3  a kid snatches a crate of drinks: a parkour chase down the street, through the market, over a wall
//          and two shed roofs; grab him before he reaches the Nile road
//   Day 4  Barai's heavies come to smash the kiosk: Mission 1's tahtib fight, tougher, and any thug who is not
//          fighting him walks off to smash the kiosk (hit him to stop it; five smashes and it is done)
//   Day 5  blackout and rain: start the generator (three timed pulls) while neighbours ask for candles, water
//          and ice, then the lights come on and the final rush
// Finale: the neighbourhood sees the uncle back, and Captain Abdo has a load of mangoes for the dawn ferry.
import * as THREE from '../../vendor/three.module.min.js';
import { Npc } from './npc.js';
import { Fighter } from './fight.js';
import { Dog } from './dog.js';
import { I3 } from './input3d.js';
import { sfx3 } from './sfx3d.js';
import { sfx } from '../audio.js';
import { num } from '../strings.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const $ = (id) => document.getElementById(id);
const PI = Math.PI;
export const SEG3 = {
  d1: { ar: 'اليوم ١ · زحمة الصبح', en: 'Day 1 · The Morning Rush', oar: 'هات لكل زبون اللي طالبه، واحد واحد، قبل ما يزهق', oen: 'Bring each customer what they ask for, one item at a time, before they lose patience' },
  d2: { ar: 'اليوم ٢ · الأنابيب', en: 'Day 2 · The Gas Cylinders', oar: 'وصّل ٣ أنابيب للأبواب المنوّرة... من غير جري ولا نط', oen: 'Deliver 3 cylinders to the lit doors... no sprinting, no jumping' },
  d3: { ar: 'اليوم ٣ · الحرامي الصغير', en: 'Day 3 · The Little Thief', oar: 'الحق بندق وامسكه (زرار النبّوت) قبل ما يوصل الكورنيش', oen: 'Catch Bondo (staff button) before he reaches the Nile road' },
  d4: { ar: 'اليوم ٤ · رجالة برعي', en: 'Day 4 · Barai\'s Men', oar: 'دافع عن الكشك! اللي يروح يكسّر، اضربه يوقف', oen: 'Defend the kiosk! Hit anyone who goes to smash it' },
  d5: { ar: 'اليوم ٥ · ليلة الضلمة', en: 'Day 5 · The Blackout', oar: 'شغّل المكنة (٣ شدّات في الأخضر) وساعد الجيران... وبعدين الزحمة', oen: 'Start the generator (3 pulls in the green), help the neighbours... then the rush' },
};
export const DAYS = { d1: 75, d2: 100, d3: 55, d4: 120, d5: 135 };
export const LIMIT3 = DAYS.d1;
const ORDER = ['d1', 'd2', 'd3', 'd4', 'd5'];
const RESPECT0 = 40, STAR_RESPECT = 85;
export const ITEMS = {
  red: { ar: 'شمس كولا', en: 'Shams Cola', c: '#d8262c', hex: 0xd8262c },
  blue: { ar: 'نسمة', en: 'Nesma', c: '#2a62d0', hex: 0x2a62d0 },
  ice: { ar: 'آيس كريم', en: 'Ice cream', c: '#e9f6ff', hex: 0xd8f0ff },
  goods: { ar: 'عيش', en: 'Bread', c: '#d9a55a', hex: 0xd9a55a },
};
const CUSTOMERS = ['cust1', 'cust2', 'cust3', 'cust4', 'cust5', 'cust6'];
const HAPPY = { cust2: 'w14', cust5: 'w13' };

export class Mission3 {
  constructor(g) {
    this.g = g; const S = g.scene, P = g.phys, M = this.M = g.level.spawns.m3;
    this.fathy = new Npc(S, P, { name: 'fathy' });
    this.cust = CUSTOMERS.map((name) => new Npc(S, P, { name }));
    this.kid = new Npc(S, P, { name: 'crateKid' });
    this.barai = new Npc(S, P, { tint: 0x6a2a24, name: 'barai' });
    this.heavies = [new Npc(S, P, { name: 'heavyBig' }), new Npc(S, P, { name: 'heavySkinny' }), new Npc(S, P, { name: 'heavyJacket' })];
    this.req = { reqWoman: new Npc(S, P, { name: 'reqWoman' }), reqHajja: new Npc(S, P, { name: 'reqHajja' }), reqTea: new Npc(S, P, { name: 'reqTea' }) };
    this.npcs = [this.fathy, ...this.cust, this.kid, this.barai, ...this.heavies, ...Object.values(this.req)];
    for (const n of this.npcs) n.show(false);
    this.dog = new Dog(g, M.dog.kennel, M.dog.r); this.dog.stunFor = 5; this.dog.show(false);
    this.makeProps();
    this.respect = RESPECT0; this.dayRespect = {}; this.week = { angry: 0, smashed: 0, missed: 0, wrong: 0, days: {} };
    this.fighting = false;
    this.hudEl = $('m3hud');
  }
  makeProps() {
    const g = this.g, S = g.scene, M = this.M, P = g.phys;
    const L = (c) => new THREE.MeshLambertMaterial({ color: c });
    // what Radwan carries (on the crate anchor, like Mission 2's cylinder): a six-pack tray of each drink, an
    // ice-cream tub, a bundle of bread, the gas cylinder, the stolen crate
    const held = (o) => { o.scale.multiplyScalar(1 / 0.82); o.position.set(0, 0.05, 0); o.userData.carryItem = true; o.visible = false; g.hero.crate.add(o); return o; };
    const tray = (c) => { const t = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.24), L(0x7a5236)); t.add(b); for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 7), L(c)); m.position.set(-0.11 + (i % 3) * 0.11, 0.14, i < 3 ? -0.05 : 0.05); t.add(m); } return t; };
    this.held = {
      red: held(tray(ITEMS.red.hex)), blue: held(tray(ITEMS.blue.hex)),
      ice: held(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.2, 12), L(0xf4f8ff))),
      goods: held(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.26), L(ITEMS.goods.hex))),
    };
    const cylGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.62, 12), cylMat = L(0x3a6ea8);
    const cyl = () => { const c = new THREE.Group(); const b = new THREE.Mesh(cylGeo, cylMat); b.castShadow = true; const t = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.12, 8), L(0x8a8a84)); t.position.y = 0.37; c.add(b, t); return c; };
    this.held.cyl = held(cyl()); this.held.cyl.rotation.z = PI / 2;
    // the cage of cylinders by the kiosk (scenery) and the one he sets down / drops
    this.cage = new THREE.Group();
    for (let i = 0; i < 5; i++) { const c = cyl(); c.position.set(4.3 + (i % 2) * 0.45, 0.42, -906.2 + i * 0.4); this.cage.add(c); }
    S.add(this.cage);
    this.cylWorld = cyl(); this.cylWorld.visible = false; S.add(this.cylWorld);
    // the stolen crate (in the kid's arms, then back in the kiosk's stack)
    this.crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.36), L(ITEMS.red.hex)); this.crate.castShadow = true; this.crate.visible = false; S.add(this.crate);
    // station rings (each item's colour on the ground where he takes it) and a target ring (doors, neighbours)
    const ringGeo = new THREE.RingGeometry(0.5, 0.72, 28);
    this.rings = {};
    for (const [k, it] of Object.entries(ITEMS)) {
      const r = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: it.hex, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
      r.rotation.x = -PI / 2; r.position.copy(M.stations[k]).y += 0.03; r.visible = false; S.add(r); this.rings[k] = r;
    }
    this.target = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.0, 32), new THREE.MeshBasicMaterial({ color: 0x9fffb0, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
    this.target.rotation.x = -PI / 2; this.target.visible = false; S.add(this.target);
    // the smash ring at the kiosk (Day 4)
    this.smashRing = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 28), new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    this.smashRing.rotation.x = -PI / 2; this.smashRing.position.copy(M.smash).y += 0.04; S.add(this.smashRing);
    // Day 2's plank over the alley
    const K = M.plank;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(K.x1 - K.x0, 0.1, K.z1 - K.z0), L(0x9a7048)); plank.castShadow = true;
    plank.position.set((K.x0 + K.x1) / 2, K.y - 0.05, (K.z0 + K.z1) / 2); S.add(plank);
    P.add(K.x0, K.y - 0.1, K.z0, K.x1, K.y, K.z1, { kind: 'plank', noClimb: true });
    // Day 5: rain (one line-segment draw round the camera), a lantern that follows him, the kiosk's light
    const N = 420, pos = new Float32Array(N * 6);
    this.rainSeed = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { this.rainSeed[i * 3] = Math.random() * 24 - 12; this.rainSeed[i * 3 + 1] = Math.random() * 14; this.rainSeed[i * 3 + 2] = Math.random() * 24 - 12; }
    this.rainGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(this.rainGeo, new THREE.LineBasicMaterial({ color: 0xaabdd8, transparent: true, opacity: 0.45, depthWrite: false }));
    this.rain.frustumCulled = false; this.rain.visible = false; S.add(this.rain);
    this.lantern = new THREE.PointLight(0xffc477, 0, 11, 1.6); S.add(this.lantern);
    this.kioskLight = new THREE.PointLight(0xffe0a0, 0, 16, 1.4); this.kioskLight.position.set(2.2, 3.0, -900); S.add(this.kioskLight);
    this.genEl = $('lure3d');
  }

  // ------------------------------------------------------------------ flow
  defaultCp(seg) {
    const d = DAYS[seg] ? seg : 'd1';
    return { seg: d, sub: d, pos: this.M.start.clone(), yaw: PI, mangoes: 0, stolen: 0, time: DAYS[d] };
  }
  async cutIntro() {
    const g = this.g, h = g.hero, F = this.fathy, M = this.M;
    g.seg = 'intro'; this.setLight('d1');
    h.cine = true; h.setCarry(false); h.place(0.6, 0, -890.5, PI);
    F.show(true); F.place(2.3, 0, -899.2, PI / 2 + 0.3); F.anim.play('idle', { loop: true });
    g.shot({ pos: V(-3.2, 2.6, -892), pos2: V(-2.2, 2.2, -894.5), look: V(3.5, 1.6, -900), fov: 50, dur: 6 });
    g.mover(h, 1.0, -897.4, 1.5, { face: PI });
    await g.say('w1');
    g.faceTo(F, h.pos.x, h.pos.z); F.anim.play('talk', { loop: true, fade: 0.2 });
    g.shot({ pos: V(-0.4, 1.7, -901.6), look: g.headOf(h, 1.55), fov: 40, blend: 0.6 });
    await g.say('w2');
    g.shot({ pos: V(0.6, 1.65, -895.6), look: g.headOf(F, 1.45), fov: 40, blend: 0.6 });
    await g.say('w3');
    // up the street: Barai's kiosk, the shuttered dark booth (we only see him on Day 4)
    g.shot({ pos: V(1.4, 2.0, -896.6), look: V(-4.4, 1.4, -886), fov: 46, blend: 0.8 });
    await g.say('w4');
    g.shot({ pos: V(-1.6, 1.8, -896.6), look: g.headOf(h, 1.5), fov: 42, blend: 0.6 });
    await g.say('w5');
    F.anim.play('wave', { fade: 0.15 });
    await g.wait(0.4);
    g.mover(F, 0.6, -872, 1.3);
    await g.wait(0.6);
    h.cine = false;
    this.start('d1', false);
  }
  // (re)start a day: everything is put back as it was when the day began
  start(sub, fromCp) {
    const g = this.g, h = g.hero, M = this.M;
    const day = DAYS[sub] ? sub : 'd1';
    this.day = day; this.dayT = 0;
    if (this.dayRespect[day] === undefined) this.dayRespect[day] = this.respect; else this.respect = this.dayRespect[day];
    this.dayMark = { angry: this.week.angry, smashed: this.week.smashed, missed: this.week.missed, wrong: this.week.wrong };
    g.hp = 6;   // a new day, a rested Radwan (a day is short and hard; the hearts do not carry over)
    g.limit = DAYS[day]; g.tune.minRestore = Math.round(DAYS[day] * 0.7);
    g.streetToks = g.streetToks || [];
    for (const n of this.npcs) { n.show(false); n.fighting = false; }
    this.fathy.show(false);
    h.cine = false; h.ride = false; h.targets = []; h.lockTarget = null; this.setHold(null); this.cylWorld.visible = false; this.crate.visible = false; this.target.visible = false;
    for (const r of Object.values(this.rings)) r.visible = day === 'd1' || day === 'd5';
    this.dog.reset(); this.dog.show(day === 'd2');
    this.rush = null; this.d2 = null; this.chase = null; this.raid = null; this.night = null; this.fighting = false; this.smashRing.material.opacity = 0;
    this.showGen(false); this.tokT = 2.5; this.hpSeen = g.hp; this.airFrom = null;
    g.haz.clear(); g.fight.stop();
    this.setLight(day);
    const start = day === 'd3' ? V(1.4, 0, -897.5) : day === 'd2' ? V(0.9, 0, -904.2) : day === 'd4' ? V(1.2, 0, -897) : M.start.clone();
    h.place(start.x, start.y, start.z, PI);
    if (fromCp) g.cam.snapBehind(h.pos, PI); else g.cam.release(h.pos, PI);
    if (!g.cp || g.cp.sub !== day) { g.saveCp(day, start, PI, day); g.cp.time = DAYS[day]; g.timeLeft = DAYS[day]; }
    if (day === 'd1') this.startRush({ total: 12, need: 9, pat: (i) => 12.5 - i * 0.4, two: (i) => i >= 5 });
    if (day === 'd2') this.startD2();
    if (day === 'd3') this.startChase();
    if (day === 'd4') { g.run(() => this.cutFight(fromCp)); return; }
    if (day === 'd5') this.startNight();
    g.play(day);
    g.voice.say({ d1: 'w6', d2: 'w7', d3: 'w9', d5: 'w12' }[day], 2);
    if (day === 'd3') setTimeout(() => { if (this.chase && this.day === 'd3') g.voice.bark('w8', 'w8', 4, 2); }, 2600);
    g.log('day', day, { respect: this.respect, t: g.timeLeft });
  }
  // a day cleared: its respect, a short card, the next day (or the farewell)
  dayDone(why) {
    const g = this.g, day = this.day;
    if (g.mode !== 'play') return;
    const gain = this.respect - this.dayRespect[day];
    this.week.days[day] = { gain, t: +(DAYS[day] - g.timeLeft).toFixed(1), left: +g.timeLeft.toFixed(1), why };
    g.log('day done', day, { respect: this.respect, gain, left: +g.timeLeft.toFixed(1), why });
    this.fighting = false; g.fight.stop(); g.clearWorldUi(); this.showGen(false); this.target.visible = false;
    this.hud();
    sfx.win();
    const i = ORDER.indexOf(day), next = ORDER[i + 1];
    g.run(async () => {
      g.hero.cine = true; g.hero.body.vel.set(0, 0, 0);
      g.toast({ ar: SEG3[day].ar + ' خلص! الاحترام ' + (gain >= 0 ? '+' : '') + num(gain), en: SEG3[day].en + ' done! Respect ' + (gain >= 0 ? '+' : '') + gain }, 2.6);
      await g.wait(2.2);
      await g.fade(true);
      for (const t of g.streetToks) g.scene.remove(t.tok.root);
      g.streetToks = [];
      if (next) { this.start(next, true); await g.fade(false); }
      else { await this.cutOutro(); }
    });
  }
  resetWeek() { this.respect = RESPECT0; this.dayRespect = {}; this.week = { angry: 0, smashed: 0, missed: 0, wrong: 0, days: {} }; }
  setRespect(d, why) {
    const before = this.respect;
    this.respect = Math.max(0, Math.min(100, this.respect + d));
    if (this.respect !== before) { this.hudPulse = d > 0 ? 'up' : 'down'; this.g.log('respect', d, why, this.respect); }
  }

  // ------------------------------------------------------------------ lighting per day, rain, lightning
  setLight(day) {
    const S = this.g.sky;
    this.lightDay = day;
    const k = { d1: 1, d2: 0.85, d3: 0.6, d4: 0.3, d5: 0 }[day] ?? 1;
    S.setSun(k);
    const night = day === 'd5';
    S.domeMat.color.setRGB(night ? 0.12 : 1, night ? 0.13 : 1, night ? 0.22 : 1);
    S.ringMat.color.setHex(night ? 0x20222c : 0xd9b59a);
    S.sunGlow.visible = S.sunDisc.visible = !night;
    S.fog.density = night ? 0.022 : 0.0062;
    this.rain.visible = night; this.lantern.intensity = night ? 9 : 0; this.kioskLight.intensity = 0;
  }
  light(dt) {
    const S = this.g.sky;
    if (this.lightDay !== 'd5') return;
    S.sun.intensity = 0.32; S.sun.color.setRGB(0.55, 0.62, 0.95);
    S.hemi.color.setRGB(0.36, 0.44, 0.66);
    S.fog.color.setRGB(0.05, 0.06, 0.1); S.bandMat.uniforms.uCol.value.copy(S.fog.color);
    const N = this.night;
    S.hemi.intensity = 0.42 + (N && N.flash > 0 ? 2.4 * N.flash / 0.14 : 0);
    if (N) { N.flash = Math.max(0, N.flash - dt); }
    const p = this.g.hero.pos; this.lantern.position.set(p.x, p.y + 2.3, p.z + 0.5);
  }
  stepRain() {
    if (!this.rain.visible) return;
    const c = this.g.camera.position, a = this.rainGeo.attributes.position.array, s = this.rainSeed, t = this.g.elapsed;
    for (let i = 0; i < s.length / 3; i++) {
      const x = c.x + s[i * 3], z = c.z + s[i * 3 + 2], y = c.y - 4 + ((s[i * 3 + 1] - t * 21) % 14 + 14) % 14;
      a[i * 6] = x; a[i * 6 + 1] = y; a[i * 6 + 2] = z; a[i * 6 + 3] = x + 0.04; a[i * 6 + 4] = y - 0.55; a[i * 6 + 5] = z;
    }
    this.rainGeo.attributes.position.needsUpdate = true;
  }

  // ------------------------------------------------------------------ the main step
  step(dt, I) {
    const g = this.g, h = g.hero;
    this.dayT += dt;
    this.light(dt); this.stepRain();
    // a heart lost while carrying something: it falls (drinks are lost, the cylinder lands at his feet)
    if (g.hp < this.hpSeen && this.hold) this.dropHeld('hit');
    this.hpSeen = g.hp;
    // tok-toks along the street (Days 1, 2, 5)
    if (this.day === 'd1' || this.day === 'd2' || (this.day === 'd5' && this.night && this.night.genOn)) this.stepToks(dt);
    g.stepStreetToks(dt);
    g.haz.step(dt);
    if (this.rush) this.stepRush(dt);
    if (this.d2) { this.dog.update(dt); this.stepD2(dt); }
    if (this.chase) this.stepChase(dt);
    if (this.day === 'd4') this.stepFight(dt);
    if (this.night) this.stepNight(dt);
    void I;
  }
  stepToks(dt) {
    const g = this.g, p = g.hero.pos;
    this.tokT -= dt;
    if (this.tokT > 0) return;
    this.tokT = (this.day === 'd1' ? 4.2 : this.day === 'd5' ? 3.6 : 5.5) + Math.random() * 3;
    const north = Math.random() < 0.5, lane = this.M.tokLane + (north ? -0.55 : 0.55);
    g.spawnStreetTok(lane, north ? p.z - 27 : p.z + 27, 0, north ? 8 + Math.random() * 2 : -(8 + Math.random() * 2), [0xffd07a, 0xa0e0a0, 0xb0a0ff, 0xff9a9a][Math.floor(Math.random() * 4)]);
  }
  // the staff button is the action button near a station, the counter, the rack, a dropped cylinder or the
  // generator (it does not swing there); carrying a cylinder: no sprint, no jump, no slide
  filterInput(I) {
    const g = this.g, h = g.hero;
    if (this.hold === 'cyl') { I.sprint = false; I.autoSprint = false; I.jumpPressed = false; I.slidePressed = false; I.jumpHeld = false; }
    if (!I.attackPressed || this.fighting) return;
    const a = this.action();
    if (a) { I.attackPressed = false; a(); }
    void h;
  }
  action() {
    const g = this.g, h = g.hero, p = h.pos, M = this.M;
    if (!h.body.onGround || h.state === 'hit' || h.state === 'down') return null;
    const near = (q, r) => Math.hypot(p.x - q.x, p.z - q.z) < r && Math.abs(p.y - q.y) < 0.8;
    // the generator
    if (this.night && !this.night.genOn && near(M.gen, 1.7)) return () => this.pull();
    // serve the front customer
    if (this.rush && this.hold && this.hold !== 'cyl' && near(M.counter, 1.75) && this.front()) return () => this.serve();
    // take an item
    if (this.rush || this.night) for (const k of Object.keys(ITEMS)) if (near(M.stations[k], 1.25)) return () => this.take(k);
    if (this.d2) {
      const D = this.d2, dog = this.dog;
      if (this.hold === 'cyl') return () => this.setDown();
      // the dog is at him: the button swings the staff (a pick-up would leave him bitten)
      if (dog.root.visible && dog.state !== 'sleep' && dog.state !== 'stun' && Math.hypot(dog.pos.x - p.x, dog.pos.z - p.z) < 2.8) return null;
      if (this.cylWorld.visible && near(this.cylWorld.position, 1.3)) return () => this.pickCyl();
      if (!this.cylWorld.visible && D.i < 3 && near(M.rack, 1.5)) return () => this.pickCyl();
    }
    return null;
  }
  setHold(k) {
    this.hold = k;
    for (const [n, o] of Object.entries(this.held)) o.visible = n === k;
    this.g.hero.setCarry(!!k, k ? this.held[k] : null);
  }
  take(k) {
    if (this.hold === k) return;
    this.setHold(k); sfx.mango(3); sfx3.whoosh(0);
    const p = this.M.stations[k]; this.g.fx.emit(p.x, 1.1, p.z, 5, { color: ITEMS[k].hex, speed: 1.2, up: 1, life: 0.4, size: 0.08 });
  }
  dropHeld(why) {
    const g = this.g, h = g.hero, k = this.hold;
    if (!k) return;
    if (k === 'cyl') { this.cylWorld.visible = true; this.cylWorld.position.set(h.pos.x, h.pos.y, h.pos.z); this.cylWorld.rotation.set(0, 0, PI / 2); if (this.d2) this.d2.drops++; sfx3.bump(); }
    else { sfx.spill(); g.fx.emit(h.pos.x, h.pos.y + 1.4, h.pos.z, 10, { color: ITEMS[k].hex, speed: 2.5, up: 1.5, life: 0.6, size: 0.1 }); }
    this.setHold(null);
    g.log('dropped', k, why);
  }

  // ------------------------------------------------------------------ Days 1 and 5: the queue
  startRush(o) {
    const M = this.M;
    this.rush = { ...o, spawned: 0, served: 0, angry: 0, wrong: 0, list: [], next: 0.8, slots: M.queue.map(() => null) };
  }
  front() { const R = this.rush; return R && R.slots[0] && R.slots[0].state === 'wait' ? R.slots[0] : null; }
  spawnCustomer() {
    const R = this.rush, g = this.g;
    const free = this.cust.filter((n) => !n.active);
    const slot = R.slots.indexOf(null);
    if (!free.length || slot < 0) return false;
    const n = free[Math.floor(Math.random() * free.length)], i = R.spawned++;
    // what they want: the far stations (across the tok-tok lane) more often than the fridges at the kiosk
    const pick = () => { const r = Math.random(); return r < 0.22 ? 'red' : r < 0.44 ? 'blue' : r < 0.72 ? 'ice' : 'goods'; };
    const want = [pick()]; if (R.two(i)) { let b = pick(); while (b === want[0]) b = pick(); want.push(b); }
    const fromN = Math.random() < 0.5;
    n.show(true); n.place(fromN ? 0.4 : 1.6, 0, fromN ? -884 : -916, fromN ? PI : 0); n.anim.play('walk', { loop: true });
    const max = R.pat(i) + (want.length > 1 ? 5 : 0);
    const c = { n, want, got: [], pat: max, max, state: 'walk', slot, i };
    R.slots[slot] = c; R.list.push(c);
    return true;
  }
  stepRush(dt) {
    const R = this.rush, g = this.g, M = this.M;
    if (R.spawned < R.total) { R.next -= dt; if (R.next <= 0 && this.spawnCustomer()) R.next = R.gap || 3.4 + Math.random() * 1.6; else if (R.next <= 0) R.next = 0.5; }
    // the queue moves up
    for (let s = 1; s < R.slots.length; s++) if (R.slots[s] && !R.slots[s - 1]) { R.slots[s - 1] = R.slots[s]; R.slots[s] = null; R.slots[s - 1].slot = s - 1; if (R.slots[s - 1].state === 'wait') R.slots[s - 1].state = 'walk'; }
    for (const c of R.list) {
      const n = c.n;
      if (c.state === 'walk') {
        const q = M.queue[c.slot], d = n.steer(dt, q.x, q.z, 2.6); n.move(dt, false); n.locoAnim(Math.hypot(n.body.vel.x, n.body.vel.z));
        if (d < 0.1) { c.state = 'wait'; n.anim.play('idle', { loop: true, fade: 0.2 }); g.faceTo(n, 4.5, n.pos.z + (c.slot ? 1.5 : 0)); }
        c.pat -= dt * 0.5;
      } else if (c.state === 'wait') {
        c.pat -= dt * (c.slot === 0 ? 1 : 0.7);
        if (c.pat <= 0) this.leave(c, false);
      } else if (c.state === 'leave') {
        n.steer(dt, c.to.x, c.to.z, c.happy ? 2.2 : 3.2); n.move(dt, false); n.locoAnim(c.happy ? 2.2 : 3.2);
        if ((c.lt += dt) > 6) { n.show(false); c.state = 'gone'; }
      }
    }
    R.list = R.list.filter((c) => c.state !== 'gone');
    // a teaching ring on the station of the front customer's next item (the first two of Day 1 only)
    const f = this.front();
    for (const [k, r] of Object.entries(this.rings)) {
      const want = f && f.want.find((w) => !f.got.includes(w)) === k;
      r.material.opacity = want && this.day === 'd1' && f.i < 2 ? 0.55 + 0.4 * Math.abs(Math.sin(this.dayT * 6)) : 0.38;
      r.scale.setScalar(want && this.day === 'd1' && f.i < 2 ? 1.15 : 1);
    }
    if (f && !this.hold && this.day === 'd1' && f.i < 2) g.stickyHint('take', { ar: 'روح للون اللي طالبه الزبون واضغط زرار النبّوت عشان تاخده', en: I3.touch ? 'Go to the colour the customer wants and press the staff button to take it' : 'Go to the colour the customer wants and press J (or click) to take it' }, 'attack');
    else if (f && this.hold && this.day === 'd1' && f.i < 2 && f.want.includes(this.hold)) g.stickyHint('give', { ar: 'ارجع للزبون عند الشبّاك واضغط زرار النبّوت', en: 'Back to the customer at the counter, press the staff button' }, 'attack');
    else g.stickyTick();
    const done = R.served + R.angry;
    if (R.angry >= 3) { g.fail('angry'); return; }
    if (done >= R.total && R.spawned >= R.total) {
      if (R.served >= R.need) { const r = R; this.rush = null; for (const c of r.list) if (c.state !== 'leave') this.leave(c, true); if (this.day === 'd1') { if (r.angry === 0) this.setRespect(4, 'nobody angry'); this.dayDone('rush'); } else this.rushDone(r); }
      else g.fail('rush');
    }
  }
  serve() {
    const g = this.g, c = this.front(), k = this.hold;
    if (!c) return;
    this.setHold(null);
    if (c.want.includes(k) && !c.got.includes(k)) {
      c.got.push(k); sfx.mango(8);
      if (c.got.length === c.want.length) {
        this.rush.served++;
        const fast = c.pat > c.max * 0.5;
        this.setRespect(fast ? 2 : 1, 'served');
        g.voice.bark(HAPPY[c.n.name] || ['w13', 'w14'], 'happy', 3);
        c.n.anim.play('wave', { fade: 0.15 });
        g.fx.emit(c.n.pos.x, 1.9, c.n.pos.z, 10, { color: 0x9fffb0, speed: 1.6, up: 1.6, life: 0.6, size: 0.1 });
        this.leave(c, true);
      } else { c.pat = Math.min(c.max, c.pat + 2); }
    } else {
      this.rush.wrong++; this.week.wrong++; this.setRespect(-2, 'wrong item');
      c.pat = Math.max(0.6, c.pat - 3); g.voice.bark('w15', 'wrong', 3); sfx3.clack(); g.cam.shake(0.12);
      g.toast({ ar: 'غلط! طالب ' + c.want.filter((w) => !c.got.includes(w)).map((w) => ITEMS[w].ar).join(' و'), en: 'Wrong! They want ' + c.want.filter((w) => !c.got.includes(w)).map((w) => ITEMS[w].en).join(' and ') }, 1.8);
    }
  }
  leave(c, happy) {
    const R = this.rush;
    if (R) R.slots[c.slot] = null;
    c.state = 'leave'; c.happy = happy; c.lt = 0; c.to = V(c.n.pos.x < 1 ? -0.4 : 0.6, 0, c.n.pos.z + (Math.random() < 0.5 ? 18 : -18));
    if (!happy) {
      if (R) R.angry++;
      this.week.angry++; this.setRespect(-5, 'angry');
      this.g.voice.bark('w16', 'angry', 2, 2); sfx3.hurt();
      this.g.toast({ ar: 'زبون مشي زعلان! (' + num(R ? R.angry : 0) + ' من ٣)', en: 'A customer walked off angry! (' + (R ? R.angry : 0) + ' of 3)' }, 2);
      this.g.log('customer angry', { angry: R && R.angry });
    }
  }

  // ------------------------------------------------------------------ Day 2: the gas cylinders
  startD2() {
    this.d2 = { i: 0, drops: 0, tripDrops: 0, said: false };
    this.cylWorld.visible = false;
    this.cage.children.forEach((c, i) => { c.visible = i < 5; });
    this.markDoor();
  }
  markDoor() {
    const D = this.d2, d = this.M.doors[D.i];
    if (!d) { this.target.visible = false; return; }
    this.target.visible = true; this.target.position.set(d.p.x, d.p.y + 0.04, d.p.z);
  }
  pickCyl() {
    const D = this.d2;
    this.cylWorld.visible = false; this.setHold('cyl'); sfx.land(false);
    if (!D.said) { D.said = true; this.g.voice.say('w18', 2); }
    this.g.log('cylinder up', { door: D.i });
  }
  setDown() { this.dropHeld('set down'); this.g.hint('setdown', { ar: 'نزّلت الأنبوبة. اضرب الكلب وارجع شيلها', en: 'Cylinder down. Whack the dog, then pick it up again' }, 2.4); }
  stepD2(dt) {
    const D = this.d2, g = this.g, h = g.hero, p = h.pos, M = this.M;
    this.target.scale.setScalar(1 + 0.12 * Math.sin(this.dayT * 6));
    const door = M.doors[D.i];
    if (!door) return;
    g.thiefPill(door.p, p.distanceTo(door.p), 0, 99, 0, 'باب ' + num(D.i + 1));
    if (!this.hold && !this.cylWorld.visible) g.stickyHint('rack', { ar: 'خد أنبوبة من القفص جنب الكشك (زرار النبّوت)', en: 'Take a cylinder from the cage by the kiosk (staff button)' }, 'attack');
    else if (this.hold === 'cyl') g.stickyHint('carryd', { ar: 'شايل الأنبوبة: للباب المنوّر (من غير جري ولا نط)', en: 'Carrying: to the lit door (no sprint, no jump)' });
    else g.stickyTick();
    // a fall with the cylinder (off the plank or the stairs): a heart, and it lands at his feet
    if (!h.body.onGround) { if (this.airFrom === null) this.airFrom = p.y; }
    else if (this.airFrom !== null) { const drop = this.airFrom - p.y; this.airFrom = null; if (drop > 2.4 && this.hold === 'cyl') { g.hurt(2, p.x, p.z + 1, true); g.log('fell with cylinder', { drop: +drop.toFixed(1) }); } }
    if (this.hold === 'cyl' && Math.hypot(p.x - door.p.x, p.z - door.p.z) < 1.3 && Math.abs(p.y - door.p.y) < 0.6) {
      this.setHold(null); D.i++;
      this.cage.children[Math.max(0, 5 - D.i)].visible = false;
      this.setRespect(D.drops === D.tripDrops ? 6 : 4, 'delivered'); D.tripDrops = D.drops;
      g.voice.say('w19', 2); sfx.win(); g.fx.emit(door.p.x, door.p.y + 1.2, door.p.z, 14, { color: 0x9fffb0, speed: 2, up: 2, life: 0.7, size: 0.12 });
      g.toast({ ar: 'وصلت! (' + num(D.i) + ' من ٣)', en: 'Delivered! (' + D.i + ' of 3)' }, 2);
      g.log('cylinder delivered', { door: door.id, t: +this.dayT.toFixed(1) });
      if (D.i >= 3) { this.d2 = null; this.target.visible = false; this.dayDone('cylinders'); return; }
      this.markDoor();
    }
    if (D.i === 1 && p.x > 5 && p.y > 3 && p.z < -949 && p.z > -952) g.hint('plank', { ar: 'لوح ضيق... امشي بالراحة في النص', en: 'A narrow plank... walk the middle' }, 2.4);
  }

  // ------------------------------------------------------------------ Day 3: the crate thief
  startChase() {
    const M = this.M, k = this.kid, P = M.kidPath[0];
    k.show(true); k.place(P[0], P[1], P[2], PI); k.anim.play('run', { loop: true });
    this.crate.visible = true;
    this.chase = { i: 0, far: 0, jukes: 2, burst: 0, side: 0, buckets: M.buckets.slice(), tok: false, said: false };
  }
  stepChase(dt) {
    const C = this.chase, g = this.g, h = g.hero, p = h.pos, M = this.M, k = this.kid, path = M.kidPath;
    const a = path[C.i], b = path[C.i + 1];
    const gap = Math.hypot(k.pos.x - p.x, k.pos.z - p.z);
    if (b) {
      // he runs his route; a burst (a juke) when Radwan is about to grab him, twice
      if (C.jukes > 0 && gap < 2.3 && C.burst <= 0 && C.i > 0) { C.jukes--; C.burst = 0.85; C.side = k.pos.x > 0 ? -1.4 : 1.4; g.voice.bark('w20', 'w20', 3, 2); sfx.swing(); }
      let sp = b[3] * (C.burst > 0 ? 1.45 : 1) * (gap > 14 ? 0.93 : 1);
      C.burst -= dt;
      const tx = b[0] + (C.burst > 0 ? C.side : 0), tz = b[2];
      const dx = tx - k.pos.x, dz = tz - k.pos.z, d = Math.hypot(dx, dz);
      const st = Math.min(sp * dt, d);
      k.body.pos.x += dx / (d || 1) * st; k.body.pos.z += dz / (d || 1) * st; k.yaw = Math.atan2(dx, dz);
      const L = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1, u = Math.max(0, Math.min(1, 1 - Math.hypot(b[0] - k.pos.x, b[2] - k.pos.z) / L));
      k.body.pos.y = a[1] + (b[1] - a[1]) * u + (b[4] === 'hop' ? Math.sin(u * PI) * 0.7 : 0);
      k.locoAnim(sp * 0.5);
      if (Math.hypot(b[0] - k.pos.x, b[2] - k.pos.z) < 0.25) C.i++;
    } else { g.fail('kid'); return; }
    this.crate.position.set(k.pos.x + Math.sin(k.yaw) * 0.25, k.pos.y + 0.95, k.pos.z + Math.cos(k.yaw) * 0.25); this.crate.rotation.y = k.yaw;
    // the crossing tok-tok out of the courtyard and two balcony buckets on Radwan's line
    if (!C.tok && k.pos.z < -928) { C.tok = true; const t = g.spawnStreetTok(-14, -934.2, 9.5, 0, 0xffd07a); t.z0 = -934; }
    if (C.buckets.length && p.z < C.buckets[0]) {
      C.buckets.shift();
      const v = h.body.vel, lead = Math.min(1, 5 / (Math.hypot(v.x, v.z) * 1.0 + 1e-3)) * 1.0;
      g.haz.bucket(THREE.MathUtils.clamp(p.x + v.x * lead, -4.3, 4.3), p.z + v.z * lead, 1.0);
      g.hint('bucket3', { ar: 'حاسب! مية من البلكونة', en: 'Look out! Water from a balcony' }, 1.8);
    }
    for (const L of g.level.laundry) if (p.z - L.z < 8 && p.z - L.z > -0.4 && p.y < 1) g.stickyHint('laundry3', { ar: 'غسيل واطي! اتزحلق تحته', en: 'Low washing! Slide under it' }, 'slide');
    if (p.z < -994 && p.z > -997 && p.y < 1.2) g.hint('wall3', { ar: 'الحيطة! نُط واطلع عليها', en: 'The wall! Jump and climb it' }, 2, 'jump');
    if (p.z < -1004 && p.z > -1006.5 && p.y > 2.5) g.hint('gap3', { ar: 'اجري ونُط على السقف اللي جاي!', en: 'Run and jump to the next roof!' }, 2, 'jump');
    g.stickyTick();
    g.thiefPill(k.pos, gap, 0, 22, C.far > 0 ? 1 : 0, 'بندق');
    if (gap > 22) { C.far += dt; if (C.far > 2.5) { g.fail('kid'); return; } } else C.far = 0;
  }
  grabKid() {
    const C = this.chase, g = this.g, k = this.kid;
    this.chase = null;
    this.setRespect(10 + (k.pos.z > -996 ? 5 : 0), 'caught the kid');
    g.voice.say('w21', 2); sfx3.thump(); g.cam.shake(0.3); g.hitStop = 0.1;
    k.anim.play('hit_react', { fade: 0.05 }); this.crate.visible = false; this.setHold('red');
    g.toast({ ar: 'مسكته! الصندوق رجع', en: 'Got him! The crate is back' }, 2);
    g.log('kid caught', { z: Math.round(k.pos.z), t: +this.dayT.toFixed(1), jukes: 2 - C.jukes });
    setTimeout(() => this.dayDone('caught'), 600);
  }
  heroImpact(atk, hero) {
    // the staff swing grabs the kid when he is within reach
    const C = this.chase;
    if (C && this.kid.pos.distanceTo(hero.pos) < 2.0) { this.grabKid(); return 1; }
    // Day 2's dog
    if (this.dog.root.visible && this.dog.state !== 'sleep' && Math.hypot(this.dog.pos.x - hero.pos.x, this.dog.pos.z - hero.pos.z) < atk.range + 0.4 && Math.abs(this.dog.pos.y - hero.pos.y) < 1.2) { if (this.dog.stun()) return 1; }
    return 0;
  }
  onDog(e) {
    const g = this.g, d = this.dog;
    if (e === 'wake') g.hint('dog3', { ar: 'كلب! نزّل الأنبوبة (زرار النبّوت) واضربه يرجع', en: 'A dog! Set the cylinder down (staff button) and whack it back' }, 2.8, 'attack');
    if (e === 'bark') { sfx3.bump(); sfx3.telegraph(); }
    if (e === 'growl') sfx3.hurt();
    if (e === 'yelp') { sfx3.clack(); g.log('dog whacked'); }
    if (e === 'bite') { const r = g.hurt(2, d.pos.x, d.pos.z, false); if (r !== 'dodged' && r !== 'blocked') g.log('dog bite', { hp: g.hp }); }
  }

  // ------------------------------------------------------------------ Day 4: Barai's men
  async cutFight(fromCp) {
    const g = this.g, h = g.hero, M = this.M, B = this.barai, [H1, H2, H3] = this.heavies;
    g.seg = 'fightintro'; h.cine = true;
    B.show(true); B.place(-0.6, 0, -912, PI * 0); H1.show(true); H1.place(-2.4, 0, -913.5, 0); H2.show(true); H2.place(1.6, 0, -913, 0); H3.show(true); H3.place(0.4, 0, -919, 0); H3.anim.play('idle', { loop: true });
    g.shot({ pos: V(2.8, 1.8, -896), look: V(0, 1.4, -910), fov: 46, blend: fromCp ? 0 : 0.4 });
    g.mover(B, -0.4, -905.5, 1.4, { face: PI }); g.mover(H1, -2.3, -906.5, 1.5); g.mover(H2, 1.7, -906.8, 1.5);
    await g.say('w10');
    g.shot({ pos: V(-0.6, 1.7, -898.8), look: g.headOf(h, 1.5), fov: 42, blend: 0.6 });
    h.anim.play('tahtib_ready', { loop: true, fade: 0.2 });
    await g.say('w11');
    h.cine = false; g.cam.release(h.pos, h.yaw);
    if (!this.fighters) { this.fighters = [new Fighter(B, 18, 'thief'), new Fighter(H1, 14, 'buddyA'), new Fighter(H2, 13, 'buddyB'), new Fighter(H3, 12, 'buddyC')]; this.fighters[3].late = true; }
    for (const f of this.fighters) f.npc.fighting = true;
    g.fight.start(this.fighters); h.targets = this.fighters;
    this.fighting = true; this.kioskHp = 5; this.raidT = 4.5; this.raid = null;
    g.play('d4');
    g.hint('fight3', { ar: 'برتقاني: صدّ أو اتفادى. أحمر: اتفادى بس! واللي يروح للكشك، الحقه', en: I3.touch ? 'Orange: block or dodge. Red: dodge only! Anyone heading for the kiosk: stop him' : 'Orange: block (K) or dodge (Ctrl). Red: dodge only! Anyone heading for the kiosk: stop him' }, 3.5, 'block');
    setTimeout(() => { if (this.fighting) g.voice.bark('w22', 'w22', 8, 1); }, 6000);
  }
  stepFight(dt) {
    const g = this.g;
    if (!this.fighting) return;
    // a thug who is not fighting him walks off to smash the kiosk every 5-7 s
    if (!this.raid) {
      this.raidT -= dt;
      if (this.raidT <= 0) {
        const F = g.fight, h = g.hero;
        const c = F.list.filter((f) => !f.ko && (f.state === 'circle' || f.state === 'approach') && F.token !== f && F.flank !== f).sort((a, b) => b.pos.distanceTo(h.pos) - a.pos.distanceTo(h.pos))[0];
        if (c) { c.state = 'raid'; c.t = 0; this.raid = { f: c, ph: 'go', t: 0 }; g.voice.bark('w23', 'w23', 4, 2); g.hint('raid', { ar: 'واحد رايح يكسّر الكشك! الحقه واضربه', en: 'One is going to smash the kiosk! Catch him and hit him' }, 2.4, 'attack'); g.log('raid', c.name); }
        this.raidT = 5 + Math.random() * 2;
      }
    } else {
      const R = this.raid, f = R.f;
      if (f.ko || f.state !== 'raid') { if (!f.ko && R.ph === 'smash') { g.voice.bark('w24', 'w24', 4, 1); g.toast({ ar: 'وقّفته!', en: 'Stopped him!' }, 1.4); } this.raid = null; this.smashRing.material.opacity = 0; this.raidT = Math.max(this.raidT, 5); }
      else g.thiefPill(f.pos, f.pos.distanceTo(g.hero.pos), 0, 99, R.ph === 'smash' ? 1 : 0, 'الكشك!');
    }
  }
  // called by Fight.step for the thug on a raid: walk to the kiosk, wind up 1.15 s (the red ring), smash
  raidStep(f, dt) {
    const R = this.raid, g = this.g, M = this.M, n = f.npc;
    if (!R || R.f !== f) { f.state = 'circle'; f.t = 0; return null; }
    if (R.ph === 'go') {
      n.steer(dt, M.smash.x, M.smash.z, 3.4, 8); const d = Math.hypot(M.smash.x - n.pos.x, M.smash.z - n.pos.z); n.locoAnim(3.4);
      if (d < 0.35) { R.ph = 'smash'; R.t = 0; n.anim.play('punch', { fade: 0.1, speed: 0.0001, at: 0.12 }); n.yaw = PI / 2; sfx3.telegraph(); }
      return [n.body.vel.x, n.body.vel.z];
    }
    R.t += dt;
    this.smashRing.material.opacity = 0.4 + 0.5 * Math.abs(Math.sin(R.t * 14));
    if (R.t > 1.15) {
      n.anim.play('punch', { fade: 0.03, restart: true });
      this.kioskHp--; this.week.smashed++; this.setRespect(-3, 'kiosk smashed');
      sfx3.thump(); sfx3.clack(); g.cam.shake(0.35);
      g.fx.emit(M.smash.x + 1.2, 1.4, M.smash.z, 22, { color: 0xcfe8ff, speed: 3.5, up: 2, life: 0.6, size: 0.09 });
      g.toast({ ar: 'كسّروا حتة من الكشك! (' + num(5 - this.kioskHp) + ' من ٥)', en: 'They smashed part of the kiosk! (' + (5 - this.kioskHp) + ' of 5)' }, 2);
      g.log('kiosk smashed', { hp: this.kioskHp });
      this.raid = null; this.smashRing.material.opacity = 0; f.state = 'circle'; f.t = 0; f.cool = 1;
      if (this.kioskHp <= 0) g.fail('smashed');
    }
    return [0, 0];
  }
  fightWon() {
    const g = this.g;
    this.fighting = false; this.raid = null; this.smashRing.material.opacity = 0;
    this.setRespect(12 + (this.week.smashed === this.dayMark.smashed ? 4 : 0), 'fight won');
    g.log('fight won');
    setTimeout(() => {
      for (const f of this.fighters) f.npc.fighting = false;
      g.voice.say('w25', 2);
      this.dayDone('fight');
    }, 900);
  }

  // ------------------------------------------------------------------ Day 5: the blackout
  startNight() {
    const M = this.M;
    this.night = { genOn: false, pulls: 0, needle: 0, dir: 1, lock: 0, flash: 0, nextFlash: 4, reqs: M.requests.map((r, i) => ({ ...r, at: r.at.clone(), t0: [2, 11, 22][i], state: 'wait', pat: 27 })), missed: 0, rushOk: false };
  }
  stepNight(dt) {
    const N = this.night, g = this.g, h = g.hero, p = h.pos;
    // lightning now and then
    N.nextFlash -= dt;
    if (N.nextFlash <= 0) { N.flash = 0.14; N.nextFlash = 7 + Math.random() * 6; setTimeout(() => sfx3.thump(), 600); }
    // the generator
    if (!N.genOn) {
      N.lock -= dt;
      const zone = [0.7 + N.pulls * 0.05, 0.9];
      N.needle += N.dir * dt * (1.15 + N.pulls * 0.25);
      if (N.needle > 1) { N.needle = 1; N.dir = -1; } else if (N.needle < 0) { N.needle = 0; N.dir = 1; }
      const near = Math.hypot(p.x - this.M.gen.x, p.z - this.M.gen.z) < 1.7;
      this.showGen(near, zone);
      if (!near && !h.cine) g.stickyHint('gen', { ar: 'المكنة جنب الكشك: شدّ لما المؤشر يبقى في الأخضر', en: 'The generator by the kiosk: pull when the needle is in the green' }, 'attack');
      else g.stickyTick();
    }
    // the neighbours' requests
    for (const r of N.reqs) {
      const n = this.req[r.who];
      if (r.state === 'wait' && this.dayT > r.t0) {
        r.state = 'on'; n.show(true); n.place(r.at.x, r.at.y, r.at.z, Math.atan2(p.x - r.at.x, p.z - r.at.z)); n.anim.play('wave', { fade: 0.1 });
        g.voice.say({ n1: 'w28', n2: 'w29', n3: 'w30' }[r.line], 2);
        g.toast({ ar: { goods: 'أم سامح عايزة شمع (من ترابيزة العيش)', blue: 'الحاجة زينب عايزة مية (نسمة الزرقا)', ice: 'عم سيد عايز تلج (من الفريزر)' }[r.item], en: { goods: 'Umm Sameh wants candles (from the bread table)', blue: 'Hajja Zeinab wants water (the blue Nesma fridge)', ice: 'Uncle Sayed wants ice (from the freezer)' }[r.item] }, 2.8);
      }
      if (r.state !== 'on') continue;
      r.pat -= dt;
      g.faceTo(n, p.x, p.z);
      if (this.hold === r.item && Math.hypot(p.x - r.at.x, p.z - r.at.z) < 1.7 && Math.abs(p.y - r.at.y) < 0.8) {
        r.state = 'done'; this.setHold(null); this.setRespect(4, 'request'); sfx.win(); g.voice.say('w14', 2);
        g.fx.emit(r.at.x, r.at.y + 1.8, r.at.z, 12, { color: 0xffe08a, speed: 1.6, up: 1.6, life: 0.6, size: 0.1 });
        setTimeout(() => n.show(false), 1500);
      } else if (r.pat <= 0) {
        r.state = 'missed'; N.missed++; this.week.missed++; this.setRespect(-6, 'request missed'); n.show(false); sfx3.hurt();
        g.toast({ ar: 'الجار زهق ومشي... (' + num(N.missed) + ' من ٢)', en: 'A neighbour gave up waiting... (' + N.missed + ' of 2)' }, 2.2);
        if (N.missed >= 2) { g.fail('night'); return; }
      }
    }
    // the final rush: once the lights are on and every neighbour has been answered (or gave up)
    if (N.genOn && !N.rushOn && N.reqs.every((r) => r.state === 'done' || r.state === 'missed')) {
      N.rushOn = true; g.voice.say('w6', 2); g.toast({ ar: 'الزحمة الأخيرة!', en: 'The final rush!' }, 2);
      this.startRush({ total: 7, need: 5, pat: (i) => 12 - i * 0.3, two: (i) => i % 3 === 2, gap: 3.0 });
    }
    const open = N.reqs.filter((r) => r.state === 'on');
    if (open.length) { const r = open.sort((a, b) => a.pat - b.pat)[0]; g.thiefPill(r.at, p.distanceTo(r.at), 0, 99, r.pat < 8 ? 1 : 0, ITEMS[r.item].ar === 'عيش' ? 'شمع' : r.item === 'blue' ? 'مية' : 'تلج'); }
    if (N.genOn && N.rushOk) { this.night = null; this.dayDone('night'); }
  }
  showGen(on, zone) {
    const el = this.genEl; if (!el) return;
    el.classList.toggle('hidden', !on); el.classList.toggle('gen', !!on);
    if (!on) return;
    const N = this.night;
    el.querySelector('i').style.marginLeft = 'calc(' + (N.needle * 100).toFixed(1) + '% - 2px)';
    el.querySelector('b').style.background = `linear-gradient(90deg, rgba(0,0,0,.5) ${zone[0] * 100}%, rgba(60,200,90,.75) ${zone[0] * 100}%, rgba(60,200,90,.75) ${zone[1] * 100}%, rgba(0,0,0,.5) ${zone[1] * 100}%)`;
    const st = N.lock > 0 ? 'red' : '';
    if (el._s !== 'gen' + st + N.pulls) {
      el._s = 'gen' + st + N.pulls; el.className = 'gen ' + st;
      el.querySelector('.ar').textContent = N.lock > 0 ? 'وقفت! استنى...' : 'شدّة ' + num(N.pulls + 1) + ' من ٣: اضغط في الأخضر';
      el.querySelector('.en').textContent = N.lock > 0 ? 'Stalled! Wait...' : 'Pull ' + (N.pulls + 1) + ' of 3: press in the green';
    }
  }
  pull() {
    const N = this.night, g = this.g, M = this.M;
    if (N.lock > 0) return;
    const zone = [0.7 + N.pulls * 0.05, 0.9];
    if (N.needle >= zone[0] && N.needle <= zone[1]) {
      N.pulls++; sfx3.thump(); g.cam.shake(0.15);
      g.fx.emit(M.gen.x + 1.3, 1.4, M.gen.z + 0.4, 10, { color: 0x555555, speed: 1, up: 2, life: 1.2, size: 0.25, alpha: 0.6 });
      g.log('gen pull', N.pulls);
      if (N.pulls >= 3) {
        N.genOn = true; this.showGen(false); this.kioskLight.intensity = 22; sfx.win(); g.voice.say('w27', 2);
        g.toast({ ar: 'النور رجع! خلّص طلبات الجيران... والزباين جايين', en: 'The lights are back! Finish the neighbours\' requests... customers are coming' }, 2.4);
      }
    } else {
      N.lock = 1.2; N.pulls = Math.max(0, N.pulls - 1); N.needle = 0; N.dir = 1; sfx3.clack(); g.voice.bark('w26', 'w26', 4, 2); g.cam.shake(0.1);
      g.log('gen stall', N.pulls);
    }
  }
  rushDone() { if (this.night) this.night.rushOk = true; this.g.toast({ ar: 'الزحمة خلصت!', en: 'Rush over!' }, 1.8); }

  // ------------------------------------------------------------------ HUD: respect, the order at the counter
  hud() {
    const el = this.hudEl; if (!el) return;
    const g = this.g, f = this.front();
    const R = this.rush;
    const key = [Math.round(this.respect), this.hold, f ? f.want.join() + f.got.join() + Math.ceil(f.pat * 4) : '', R ? R.served + '/' + R.total + '/' + R.angry : '', this.d2 ? this.d2.i : '', g.mode].join('|');
    if (key === this._hk) return; this._hk = key;
    el.classList.toggle('hidden', g.mode !== 'play' || g.state !== 'play');
    el.querySelector('.rs i').style.width = this.respect + '%';
    el.querySelector('.rs em').textContent = num(Math.round(this.respect));
    if (this.hudPulse) { el.classList.remove('up', 'down'); void el.offsetWidth; el.classList.add(this.hudPulse); this.hudPulse = null; }
    const chip = (k, ok) => `<span class="chip${ok ? ' ok' : ''}" style="--c:${ITEMS[k].c}">${ok ? '✓ ' : ''}${ITEMS[k].ar}<em>${ITEMS[k].en}</em></span>`;
    let ord = '';
    if (R) ord += `<div class="q">${f ? f.want.map((w) => chip(w, f.got.includes(w))).join('') : '<span class="wait">مستني زبون...</span>'}${f ? `<b class="pat"><i style="width:${Math.max(0, f.pat / f.max * 100)}%"></i></b>` : ''}</div><div class="cnt">${num(R.served)} / ${num(R.total)} · زعلانين ${num(R.angry)} من ٣</div>`;
    if (this.d2) ord += `<div class="cnt">الأنابيب ${num(this.d2.i)} من ٣</div>`;
    if (this.hold && this.hold !== 'cyl') ord += `<div class="hand">في إيدك: ${chip(this.hold, false)}</div>`;
    el.querySelector('.ord').innerHTML = ord;
  }

  // ------------------------------------------------------------------ the farewell and the end screen
  async cutOutro() {
    const g = this.g, h = g.hero, M = this.M, F = this.fathy;
    g.seg = 'finale'; g.mode = 'cut'; h.cine = true; this.night = null; this.rush = null;
    for (const n of this.npcs) n.show(false);
    this.setLight('d1'); this.kioskLight.intensity = 0;
    h.setCarry(false); h.place(1.2, 0, -899.2, PI / 2);
    const cast = [[F, 2.4, -897.4, -PI / 2], [this.cust[1], -0.8, -897.2, PI / 2], [this.cust[2], -0.4, -900.8, PI / 2 - 0.4], [this.kid, 0.2, -902.6, 0.5], [this.cust[3], -1.6, -899.4, PI / 2], [this.cust[4], 0.6, -895.6, PI]];
    for (const [n, x, z, y] of cast) { n.show(true); n.place(x, 0, z, y); n.anim.play('idle', { loop: true }); }
    g.closeSection();
    const stars = this.stars();
    g.result = { mission: 3, respect: Math.round(this.respect), stars, days: this.week.days, angry: this.week.angry, smashed: this.week.smashed, missed: this.week.missed, wrong: this.week.wrong, elapsed: g.elapsed, hpLost: g.hpLost || 0, deaths: g.deaths, fails: g.fails };
    g.log('finish', g.result);
    await g.fade(false);
    g.shot({ pos: V(-3.4, 2.4, -893.5), pos2: V(-2.6, 2.0, -895.5), look: V(1.2, 1.4, -899.5), fov: 48, dur: 6 });
    F.anim.play('talk', { loop: true, fade: 0.2 });
    await g.say('w31');
    g.shot({ pos: V(1.6, 1.6, -902.2), look: g.headOf(this.cust[2], 1.35), fov: 40, blend: 0.6 });
    await g.say('w32');
    g.shot({ pos: V(1.8, 1.2, -900.6), look: g.headOf(this.kid, 1.1), fov: 40, blend: 0.6 });
    await g.say('w33');
    g.shot({ pos: V(0.2, 1.7, -895.2), look: g.headOf(F, 1.45), fov: 40, blend: 0.6 });
    await g.say('w34');
    g.shot({ pos: V(-1.4, 1.7, -901.6), look: g.headOf(h, 1.5), fov: 42, blend: 0.6 });
    await g.say('w35');
    sfx.win(); sfx3.cheer();
    for (const [n] of cast) if (n.anim.actions.wave) n.anim.play('wave', { fade: 0.15 });
    g.shot({ pos: V(0.4, 3.4, -888), look: V(1, 1.2, -899), fov: 50, blend: 1.2 });
    await g.wait(1.6);
    this.end();
  }
  stars() {
    const g = this.g;
    return [this.respect >= STAR_RESPECT, g.fails === 0, this.week.smashed === 0 && this.week.angry === 0 && this.week.missed === 0];
  }
  end() {
    const g = this.g, r = g.result, stars = r.stars;
    this.hudEl && this.hudEl.classList.add('hidden');
    const rows = [
      [stars[0], 'احترام الشارع ' + num(STAR_RESPECT) + ' أو أكتر في آخر الأسبوع', 'Street respect of ' + STAR_RESPECT + ' or more at the end of the week'],
      [stars[1], 'الأسبوع كله من غير ولا إعادة', 'The whole week without a retry'],
      [stars[2], 'ولا زبون زعلان، ولا جار استنى على الفاضي، والكشك ما اتكسرش', 'No angry customer, no neighbour left waiting, the kiosk never smashed'],
    ];
    g.showEnd(3, stars, rows, { countText: num(r.respect), countLabel: ['الاحترام', 'Respect'], elapsed: r.elapsed, fails: r.fails });
  }
}
