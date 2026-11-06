// Mission 2, "The Runaway Pigeon" (الحمامة الهربانة). Late afternoon on the Imbaba roofs: Sukkara, the white
// pigeon that followed Radwan onto the ferry at the end of Mission 1, bursts out of her box when the rival
// keeper Zaghloul whistles, and Radwan chases her roof to roof to her tower on Hajja Nefisa's house.
//   Sukkara lands, waits and flies on when he gets close; if he is too slow (her patience runs out, shown over
//   her) she goes to Zaghloul's tower: a fail. Zaghloul's whistles pull her off course in flight unless Radwan
//   calls her back (the staff button, in the window).
//   Three neighbours, each a fast action beat that opens a shortcut: catch Umm Nadia's falling laundry basket
//   (her roof door), chase off Zaghloul's son Sika before his net reaches Sukkara (his plank over the alley),
//   carry a gas cylinder up the stairs past the chained dog for the hajja's grandson (his ladder up the tower,
//   and corn). Each also gives a handful of corn, which makes the finale easier.
//   Finale: on top of her tower, call her down from Zaghloul's pole: press when she looks his way, never while
//   Zaghloul whistles.
import * as THREE from '../../vendor/three.module.min.js';
import { Npc } from './npc.js';
import { Bird, Flock } from './pigeon.js';
import { Dog } from './dog.js';
import { R2 } from './level2.js';
import { I3 } from './input3d.js';
import { sfx3 } from './sfx3d.js';
import { sfx } from '../audio.js';
import { num } from '../strings.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const $ = (id) => document.getElementById(id);
// the bot plays the course clean in ~52 s; her patience at each perch is the real clock, the sun is the whole run
export const LIMIT2 = 95, STAR_SUN2 = 30;
export const SEG2 = {
  m2a: { ar: '١ · ورا الحمامة', en: 'After the Pigeon', oar: 'خليك ورا سُكّرة... ما تسيبهاش تستنى كتير', oen: 'Stay on Sukkara... do not keep her waiting' },
  m2b: { ar: '٢ · سطوح الجيران', en: "The Neighbours' Roofs", oar: 'ساعد الجيران... هيفتحوا لك سكة أقصر', oen: 'Help the neighbours: they open shorter ways' },
  m2c: { ar: '٣ · السطوح البايظة', en: 'The Rotten Roofs', oar: 'السطح هنا بايظ... والكلب صاحي', oen: 'Rotten roofs here... and the dog is awake' },
  m2e: { ar: '٤ · السطوح العالية', en: 'The High Roofs', oar: 'اطلع فوق، والسقف اللي مش متشطّب بيقع', oen: 'Climb up; the unfinished roof gives way' },
  m2d: { ar: '٥ · البرج', en: 'The Tower', oar: 'ساعد الواد بالأنبوبة، واطلع فوق برجها ونادي سُكّرة', oen: 'Help the boy with the cylinder, then climb her tower and call Sukkara' },
};
// where Sukkara is and how long she waits there (s) once she has landed
const PATIENCE = { P1: 14, P2: 12, P3: 12, P4: 12, P5: 12, P6: 11, P7: 11, P8: 12 };
const NEXT = { P1: 'P2', P2: 'P3', P3: 'P4', P4: 'P5', P5: 'P6', P6: 'P7', P7: 'P8', P8: 'pole' };
const WHISTLED = { P3: true, P5: true, P7: true };   // Zaghloul whistles as she leaves these perches
const FLUSH = 6.5;          // she takes off when he is this close (or once he has run past her)
// checkpoints in course order: the section they belong to and the perch Sukkara is on when he gets there
const CPS = { start: ['m2a', 'P1'], B: ['m2b', 'P2'], C: ['m2b', 'P3'], E: ['m2c', 'P4'], F: ['m2c', 'P5'], J: ['m2e', 'P6'], K: ['m2e', 'P7'], L: ['m2d', 'P8'], G: ['m2d', 'pole'] };

export class Mission2 {
  constructor(g) {
    this.g = g; const S = g.scene, P = g.phys, M = this.M = g.level.spawns.m2;
    this.hajja = new Npc(S, P, { name: 'hajjaNefisa' });
    this.umm = new Npc(S, P, { name: 'ummNadia' });
    this.boy = new Npc(S, P, { name: 'grandson' });
    this.girl = new Npc(S, P, { name: 'granddaughter' });
    this.sika = new Npc(S, P, { name: 'sika' });
    this.zag = new Npc(S, P, { robe: 0x6a4a3a, head: 'kufi', hair: 0x3a3330, beard: 1, build: [1.12, 0.97], name: 'zaghloul' });
    this.npcs = [this.hajja, this.umm, this.boy, this.girl, this.sika, this.zag];
    for (const n of this.npcs) n.show(false);
    this.suk = new Bird(S, 'pigeon', 1.6); this.suk.speed = 10.5;
    this.flock = new Flock(S, M.flock, 6);
    this.dog = new Dog(g, M.dog.kennel, M.dog.r);
    this.makeProps();
    this.t1 = this.t2 = this.t3 = null;    // null: not resolved, true: helped, false: missed
  }
  makeProps() {
    const S = this.g.scene, P = this.g.phys, M = this.M;
    const wood = new THREE.MeshLambertMaterial({ color: 0x7a5236 }), woodL = new THREE.MeshLambertMaterial({ color: 0x9a7048 });
    // Umm Nadia's roof door (a hinged wooden door in the stair block's corridor)
    const D = M.door;
    this.doorPivot = new THREE.Group(); this.doorPivot.position.set(D.x0, D.y0, (D.z0 + D.z1) / 2); S.add(this.doorPivot);
    const door = new THREE.Mesh(new THREE.BoxGeometry(D.x1 - D.x0, D.y1 - D.y0 - 0.05, 0.08), wood);
    door.position.set((D.x1 - D.x0) / 2, (D.y1 - D.y0) / 2, 0); door.castShadow = true; this.doorPivot.add(door);
    this.doorBox = P.add(D.x0, D.y0, D.z0, D.x1, D.y1, D.z1, { kind: 'door', noClimb: true, noVault: true });
    // the laundry basket and the ring where it will land
    const bk = new THREE.Group();
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.27, 0.32, 14, 1, true), new THREE.MeshLambertMaterial({ color: 0xb08850, side: THREE.DoubleSide }));
    const cloth = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 7), new THREE.MeshLambertMaterial({ color: 0xe8e0d4 })); cloth.scale.set(1, 0.45, 1); cloth.position.y = 0.14;
    bk.add(wick, cloth); bk.visible = false; S.add(bk); this.basket = bk;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.1, 32), new THREE.MeshBasicMaterial({ color: 0x9fffb0, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; S.add(this.ring);
    // Sika's plank over the alley (the shortcut once he has run off over it)
    const K = M.plank;
    this.plank = new THREE.Mesh(new THREE.BoxGeometry(K.x1 - K.x0, 0.1, K.z1 - K.z0), woodL); this.plank.castShadow = true;
    this.plank.position.set((K.x0 + K.x1) / 2, K.y - 0.05, (K.z0 + K.z1) / 2); this.plank.visible = false; S.add(this.plank);
    this.plankBox = P.add(K.x0, K.y - 0.1, K.z0, K.x1, K.y, K.z1, { kind: 'plank', noClimb: true }); this.plankBox.on = false;
    // the gas cylinder (on the roof, or on Radwan's shoulder in place of the mango crate)
    const cyl = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.62, 14), new THREE.MeshLambertMaterial({ color: 0x3a6ea8 }));
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.12, 8), new THREE.MeshLambertMaterial({ color: 0x8a8a84 })); top.position.y = 0.37;
    body.castShadow = true; cyl.add(body, top); this.cylWorld = cyl; S.add(cyl);
    this.cylHeld = cyl.clone(); this.cylHeld.scale.setScalar(1 / 0.82); this.cylHeld.rotation.z = Math.PI / 2; this.cylHeld.position.set(0, 0.05, 0);
    this.cylHeld.userData.carryItem = true; this.g.hero.crate.add(this.cylHeld); this.cylHeld.visible = false;
    // the boy's ladder against the tower (the shortcut up)
    const L = M.ladder, lad = new THREE.Group(), rail = new THREE.BoxGeometry(0.06, 2.3, 0.06), rung = new THREE.BoxGeometry(0.5, 0.04, 0.04);
    for (const x of [-0.25, 0.25]) { const r = new THREE.Mesh(rail, woodL); r.position.set(x, 1.15, 0); lad.add(r); }
    for (let y = 0.3; y < 2.2; y += 0.35) { const r = new THREE.Mesh(rung, woodL); r.position.set(0, y, 0); lad.add(r); }
    lad.position.set((L.x0 + L.x1) / 2, L.y0, (L.z0 + L.z1) / 2); lad.rotation.set(0, Math.PI / 2, -0.25); lad.visible = false; S.add(lad); this.ladder = lad;
    this.ladderBox = P.add(L.x0, L.y0, L.z0, L.x1, L.y1, L.z1, { kind: 'ladder' }); this.ladderBox.on = false;
    // Sika's net: a pole with a hoop, in his right hand
    const net = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 6), new THREE.MeshLambertMaterial({ color: 0x6a5030 }));
    pole.position.y = 0.8; const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.015, 5, 16), new THREE.MeshLambertMaterial({ color: 0x2a2a2a })); hoop.position.y = 1.75; net.add(pole, hoop);
    let hand = null; this.sika.model.traverse((x) => { if (x.isBone && x.name === 'HandR') hand = x; });
    if (hand) { hand.add(net); net.rotation.x = Math.PI / 2; net.scale.setScalar(1 / (this.sika.model.scale.x || 1)); }
    // the lure bar
    this.lureEl = $('lure3d');
  }

  // ------------------------------------------------------------------ flow
  defaultCp(seg) {
    const sub = CPS[seg] ? seg : 'start', used = { start: 0, B: 4, C: 7, E: 14, F: 18, J: 22, K: 26, L: 30, G: 34 }[sub];
    return { seg: CPS[sub][0], sub, pos: this.M.cps[sub].clone(), yaw: Math.PI, mangoes: 0, stolen: 0, time: LIMIT2 - used };
  }
  async cutIntro() {
    const g = this.g, h = g.hero, M = this.M, P = M.start;
    g.seg = 'intro';
    h.setCarry(true); h.cine = true; h.place(P.x + 0.4, P.y, P.z + 3.4, Math.PI);
    this.hajja.show(true); this.hajja.place(-2.4, R2.H, -895.2, Math.PI / 2 + 0.4);
    this.boy.show(true); this.boy.place(2.6, R2.H, -895.8, -Math.PI / 2 - 0.3);
    this.girl.show(true); this.girl.place(3.3, R2.H, -893.6, -Math.PI / 2);
    this.zag.show(true); this.zag.place(M.zaghloul.x, M.zaghloul.y, M.zaghloul.z, Math.PI * 0.9);
    this.suk.show(false);
    g.mover(h, P.x + 0.3, P.z + 0.6, 1.4, { face: Math.PI });
    g.shot({ pos: V(4.5, R2.H + 2.6, -891), pos2: V(3.2, R2.H + 2.1, -892.8), look: V(-0.5, R2.H + 1.2, -896.5), fov: 48, dur: 6 });
    await g.say('p1');
    g.faceTo(h, this.hajja.pos.x, this.hajja.pos.z);
    g.shot({ pos: V(-1.2, R2.H + 1.65, -897.8), look: g.headOf(h, 1.5), fov: 40, blend: 0.6 });
    await g.say('p2');
    // Zaghloul's whistle from the far end of the street
    g.shot({ pos: V(1.2, R2.H + 2.2, -898), look: V(14, R2.R + 6, M.towerTop.z + 3), fov: 34, blend: 0.8 });
    this.flock.whistle(true); this.whistleSound();
    await g.say('p3');
    // she bursts out of the box and flies off west
    const sp = h.crate.getWorldPosition(new THREE.Vector3());
    this.suk.show(true); this.suk.root.position.copy(sp); this.suk.state = 'perch';
    this.suk.flyTo(M.perch.P1, { up: 2.5 }); sfx3.flap();
    g.shot({ pos: V(2.8, R2.H + 1.9, -894.5), look: () => this.suk.pos.clone(), fov: 50, blend: 0.3 });
    await g.say('p4');
    this.flock.whistle(false);
    g.shot({ pos: V(-1.6, R2.H + 1.7, -893.6), look: g.headOf(this.hajja, 1.3), fov: 40, blend: 0.6 });
    await g.say('p5');
    g.faceTo(h, 0, -930);
    g.shot({ pos: V(0.9, R2.H + 2.3, -893.2), pos2: V(0.4, R2.H + 2.1, -894.6), look: V(0, R2.H + 1.6, -930), fov: 56, blend: 0.8, dur: 3 });
    await g.say('p6');
    h.setCarry(false); h.cine = false;
    // the hajja goes home down the stairs (she is on her roof at the end, for the finale)
    this.hajja.place(M.hajja.x, M.hajja.y, M.hajja.z, Math.PI / 4);
    this.start('start', false);
  }
  // (re)start at a checkpoint: everything after it is put back as it was when he got there
  start(sub, fromCp) {
    const g = this.g, h = g.hero, M = this.M, c = g.cp;
    this.sub = sub; h.cine = false; h.setCarry(false); h.ride = false; this.carrying = false; this.cylHeld.visible = false;
    if (fromCp) { h.place(c.pos.x, c.pos.y, c.pos.z, c.yaw); g.cam.snapBehind(h.pos, c.yaw); }
    else g.cam.release(h.pos, Math.PI);
    // the cast
    this.girl.show(sub === 'start'); this.girl.place(3.3, R2.H, -893.6, -Math.PI / 2);
    this.boy.show(true);
    if (this.t3) this.boy.place(-2.6, R2.G, M.towerTop.z + 1.6, Math.PI / 2); else this.boy.place(M.kid3.x + 0.8, M.kid3.y, M.kid3.z + 0.4, -Math.PI / 2);
    this.hajja.show(true); this.hajja.place(M.hajja.x, M.hajja.y, M.hajja.z, Math.PI / 4);
    this.umm.show(true); this.umm.place(M.umm.x, M.umm.y, M.umm.z, 0);
    this.zag.show(true); this.zag.place(M.zaghloul.x, M.zaghloul.y, M.zaghloul.z, -Math.PI * 0.7);
    this.sika.show(false); this.sikaS = null;
    for (const n of this.npcs) n.anim.play('idle', { loop: true });
    // tasks: done stays done, an open one is set up again
    this.setDoor(this.t1 === true); this.basket.visible = false; this.ring.visible = false; this.bk = null;
    if (this.t1 === null && ['start', 'B'].includes(sub)) this.t1armed = true;
    this.setPlank(this.t2 === true);
    this.ladder.visible = this.ladderBox.on = this.t3 === true;
    this.cylWorld.visible = this.t3 !== true; this.cylWorld.position.copy(M.cyl); this.cylWorld.rotation.set(0, 0, 0);
    this.dog.reset(); this.dog.show(true);
    this.flock.whistle(false); this.whistle = null; this.lure = null; this.showLure(false);
    // where Sukkara is
    const [seg, at] = CPS[sub];
    this.suk.show(true); this.perchAt(at);
    if (sub === 'C' && this.t2 === null) this.startSika();
    if (!g.cp || g.cp.sub !== sub) g.saveCp(seg, g.cp && !fromCp ? h.pos : this.M.cps[sub], Math.PI, sub);
    g.play(seg);
    g.traps.show(true);
  }
  perchAt(name) {
    this.stage = name; this.patience = PATIENCE[name] || 0;
    const p = this.M.perch[name === 'pole' ? 'pole' : name];
    this.suk.perchAt(p, Math.atan2(this.g.hero.pos.x - p.x, this.g.hero.pos.z - p.z));
    if (name === 'pole') this.startFinale();
  }
  // she takes off for the next perch; `whistle`: Zaghloul tries to pull her off course on the way
  flyOn(whistle) {
    const g = this.g, from = this.stage, to = NEXT[from];
    if (!to) return;
    this.stage = 'fly'; this.flyTarget = to;
    sfx3.flap(); g.voice.bark(['q1', 'q2'], 'sukfly', 6, 1);
    const go = () => this.suk.flyTo(this.M.perch[to], { onLand: () => this.landed(to) });
    if (whistle) this.startWhistle(go); else go();
    this.g.log('sukkara', from, '->', to);
  }
  landed(name) { this.stage = name; this.patience = PATIENCE[name] || 0; if (name === 'P3' && this.t2 === null) this.startSika(); if (name === 'pole') this.startFinale(); }
  // ---- Zaghloul's whistle in flight: a 1.8 s window to call her back with the staff button
  startWhistle(then) {
    const g = this.g;
    this.flock.whistle(true); this.whistleSound(); g.voice.say('q3', 2);
    this.whistle = { t: 0, then, answered: false };
    this.suk.flyTo(V(this.suk.pos.x + 2, this.suk.pos.y + 2.5, this.suk.pos.z - 3), { up: 1 });
    g.stickyHint('callback', { ar: 'زغلول بيصفّر! نادي سُكّرة دلوقتي (زرار النبّوت)', en: I3.touch ? 'Zaghloul is whistling! Call Sukkara now (staff button)' : 'Zaghloul is whistling! Call Sukkara now (J or click)' }, 'attack');
  }
  whistleSound() { const s = () => { sfx3.telegraph(); }; s(); setTimeout(s, 180); setTimeout(() => sfx.timeTick(), 420); }
  stepWhistle(dt, I) {
    const W = this.whistle, g = this.g; if (!W) return;
    W.t += dt;
    if (W.t < 1.8) {
      g.stickyHint('callback', { ar: 'زغلول بيصفّر! نادي سُكّرة دلوقتي (زرار النبّوت)', en: 'Zaghloul is whistling! Call Sukkara now (staff button)' }, 'attack');
      if (I.attackPressed) { W.answered = true; g.voice.say('q4', 2); g.clearSticky(); this.flock.whistle(false); this.whistle = null; g.log('whistle answered'); W.then(); g.stats.callbacks = (g.stats.callbacks || 0) + 1; }
      return;
    }
    // missed: she circles over Zaghloul's tower with his flock for a while, then goes on
    g.clearSticky(); this.whistle = null; g.log('whistle missed');
    this.suk.circle(this.M.flock.clone().add(V(0, 1, 0)), 5.5, 1.3);
    setTimeout(() => { if (this.stage === 'fly' && this.suk.state === 'circle') { this.flock.whistle(false); W.then(); } }, 5000);
    g.toast({ ar: 'راحت تلف مع حمام زغلول...', en: 'She went circling with Zaghloul\'s flock...' }, 2.4);
  }

  // ------------------------------------------------------------------ the main step
  step(dt, I) {
    const g = this.g, h = g.hero, p = h.pos, M = this.M;
    // carrying the gas cylinder: no sprint, no jump, no slide, no staff
    for (const n of this.npcs) if (n.active) n.update(dt);
    this.suk.update(dt); this.flock.update(dt); this.dog.update(dt);
    this.stepWhistle(dt, I);
    // the checkpoints along the course (each saves where he is and the state of the tasks)
    const onY = (y) => h.body.onGround && Math.abs(p.y - y) < 0.4;
    if (this.sub === 'start' && onY(R2.B) && p.z < -918.4) { this.sub = 'B'; g.saveCp('m2b', V(p.x, p.y, p.z), Math.PI, 'B'); g.play('m2b'); }
    if (this.sub === 'B' && onY(R2.C) && p.z < -935.2) { this.sub = 'C'; g.saveCp('m2b', V(p.x, p.y, p.z), Math.PI, 'C'); }
    if (this.sub === 'C' && onY(R2.E) && p.z < -957 && p.x < 6) { this.sub = 'E'; g.saveCp('m2c', V(p.x, p.y, p.z), Math.PI, 'E'); g.play('m2c'); }
    if (this.sub === 'E' && onY(R2.F) && p.z < -978.4) { this.sub = 'F'; g.saveCp('m2c', V(p.x, p.y, p.z), Math.PI, 'F'); }
    if (this.sub === 'F' && onY(R2.J) && p.z < -996.6) { this.sub = 'J'; g.saveCp('m2e', V(p.x, p.y, p.z), Math.PI, 'J'); g.play('m2e'); }
    if (this.sub === 'J' && onY(R2.K) && p.z < -1019.8) { this.sub = 'K'; g.saveCp('m2e', V(p.x, p.y, p.z), Math.PI, 'K'); }
    if (this.sub === 'K' && onY(R2.L) && p.z < -1038.4) { this.sub = 'L'; g.saveCp('m2d', V(p.x, p.y, p.z), Math.PI, 'L'); g.play('m2d'); }
    if (this.sub === 'L' && onY(R2.G) && p.z < -1056.4) { this.sub = 'G'; g.saveCp('m2d', V(p.x, p.y, p.z), Math.PI, 'G'); }
    // Sukkara: flush when he is close, patience while she waits
    if (PATIENCE[this.stage] !== undefined && this.suk.state === 'perch') {
      const d = this.suk.pos.distanceTo(p);
      const blocked = this.stage === 'P3' && this.sikaS && (this.sikaS.st === 'sneak' || this.sikaS.st === 'stun');
      // she always leads: close to her, or already past her perch (after a whistle detour), and she is off
      if ((d < FLUSH || p.z < this.suk.pos.z - 0.5) && !blocked) this.flyOn(!!WHISTLED[this.stage]);
      else if (!blocked) {
        this.patience -= dt;
        if (this.patience <= 0) { this.lost(); return; }
      }
      g.thiefPill(this.suk.pos, d, 0, 99, this.patience < 4 ? 1 : 0, 'سُكّرة');
    } else if (this.stage === 'fly' || this.stage === 'pole') g.thiefPill(this.suk.pos, this.suk.pos.distanceTo(p), 0, 99, 0, 'سُكّرة');
    this.stepBasket(dt);
    this.stepSika(dt);
    this.stepCylinder(dt);
    if (this.lure) this.stepLure(dt, I);
    // falls into the alleys: a heart, the last checkpoint, the traps put back
    if (p.y < 1.2 && h.body.onGround && g.mode === 'play') {
      g.voice.say('u3', 2); sfx3.thump(); g.hp = Math.max(0, g.hp - 2); g.cam.shake(0.5); g.deaths++;
      if (this.carrying) this.dropCylinder(true);
      if (g.hp > 0) { const c = g.cp; h.place(c.pos.x, c.pos.y, c.pos.z, c.yaw); g.cam.snapBehind(h.pos, c.yaw); g.traps.reset(); this.dog.reset(); if (PATIENCE[this.stage]) this.patience = PATIENCE[this.stage]; g.log('roof fall', { hp: g.hp, z: Math.round(p.z) }); }
    }
    // hints
    if (p.z < -948 && p.z > -950.5 && p.y > 6.5 && !this.plankBox.on) g.hint('alley', { ar: 'الحارة واسعة أوي... لف من السطح اللي على اليمين', en: 'The alley is too wide... go round by the roof on the right' }, 3);
    if (p.z < -959 && p.z > -963 && p.y > 6.5) g.hint('tin2', { ar: 'الصاج ده بايظ! عدّي جري أو نُط', en: 'That tin is rotten! Run over fast or jump it' }, 2.6, 'jump');
    if (p.z < -974 && p.z > -975.5 && p.y > 6.5) g.hint('gapF', { ar: 'مسافة كبيرة! اجري على آخرك ونُط من الحرف', en: 'A wide gap! Sprint and jump from the edge' }, 2.6, 'jump');
    if (p.z < -990 && p.z > -993 && Math.abs(p.y - R2.F) < 0.5) g.hint('junk', { ar: 'اطلع على الكراكيب: الصناديق، وبعدين الحيطة، وبعدين السطح', en: 'Climb the junk: the crates, the wall, then the roof' }, 2.8, 'jump');
    if (p.z < -1014 && p.z > -1016 && p.y > 11) g.hint('gapK', { ar: 'نُط على السطح اللي جاي... اجري على آخرك', en: 'Jump to the next roof... sprint' }, 2.4, 'jump');
    if (p.z < -1023.5 && p.z > -1026 && p.y > 11) g.hint('planks', { ar: 'لوحين خشب بس... عدّي جري ومتقفش', en: 'Just two planks... run across and don\'t stop' }, 2.6);
  }
  lost() {
    const g = this.g; this.stage = 'lost';
    this.suk.flyTo(this.M.perch.zag, { up: 3 });
    g.voice.say('x3', 2); g.log('pigeon lost');
    setTimeout(() => g.fail('pigeon'), 900);
  }
  // the gas cylinder, Sika and the dog all take hits from the staff
  heroImpact(atk, hero) {
    let hits = 0;
    const p = hero.pos;
    const S = this.sikaS;
    if (S && (S.st === 'sneak' || S.st === 'stun') && this.sika.pos.distanceTo(p) < atk.range + 0.5 && S.cool <= 0) { hits++; this.hitSika(); }
    if (this.dog.root.visible && this.dog.state !== 'sleep' && Math.hypot(this.dog.pos.x - p.x, this.dog.pos.z - p.z) < atk.range + 0.4 && Math.abs(this.dog.pos.y - p.y) < 1.2) { if (this.dog.stun()) hits++; }
    return hits;
  }
  filterInput(I) {
    if (this.carrying) { I.sprint = false; I.autoSprint = false; I.jumpPressed = false; I.slidePressed = false; I.attackPressed = false; I.jumpHeld = false; }
  }

  // ------------------------------------------------------------------ task 1: the laundry basket
  setDoor(open) { this.doorBox.on = !open; this.doorPivot.rotation.y = open ? -Math.PI * 0.55 : 0; }
  stepBasket(dt) {
    const g = this.g, h = g.hero, p = h.pos, M = this.M;
    if (this.t1armed && this.t1 === null && h.body.onGround && Math.abs(p.y - R2.B) < 0.4 && p.z < -918.4 && p.z > -929) {
      this.t1armed = false;
      this.bk = { t: 0, dur: 1.95, from: V(M.umm.x - 0.4, M.umm.y + 1.3, M.umm.z - 0.2), to: M.basketLand.clone() };
      this.basket.visible = true; this.ring.visible = true; this.ring.position.set(this.bk.to.x, this.bk.to.y + 0.04, this.bk.to.z);
      this.umm.anim.play('wave', { fade: 0.1 });
      g.voice.say('n1', 2); g.log('basket');
      g.hint('basket', { ar: 'السبت هيقع! اجري للدايرة الخضرا وامسكه', en: 'The basket is falling! Run into the green ring and catch it' }, 2.4);
    }
    const B = this.bk; if (!B) return;
    B.t += dt; const u = Math.min(1, B.t / B.dur);
    this.basket.position.set(B.from.x + (B.to.x - B.from.x) * u, B.from.y + (B.to.y + 0.9 - B.from.y) * u + Math.sin(u * Math.PI) * 1.2, B.from.z + (B.to.z - B.from.z) * u);
    this.basket.rotation.z = u * 2.5;
    const k = 1 + 0.15 * Math.sin(B.t * 12); this.ring.scale.set(k, k, k);
    if (u >= 1) {
      const caught = Math.hypot(p.x - B.to.x, p.z - B.to.z) < 1.3 && Math.abs(p.y - B.to.y) < 1.2;
      this.bk = null; this.ring.visible = false;
      if (caught) {
        this.t1 = true; this.basket.visible = false; sfx.mango(4); this.corn(1);
        g.voice.say('n2', 2); this.setDoor(true); sfx3.wall();
        g.toast({ ar: 'مسكته! باب السطح اتفتح (سكة أقصر) + درة', en: 'Caught! The roof door is open (a shortcut) + corn' }, 2.6);
      } else {
        this.t1 = false; this.basket.position.copy(B.to).y += 0.15; this.basket.rotation.z = Math.PI / 2;
        g.fx.emit(B.to.x, B.to.y + 0.2, B.to.z, 14, { color: 0xf2ece0, speed: 2.5, up: 1.2, life: 0.8, size: 0.2 });
        g.voice.say('n3', 2); sfx3.thump();
      }
      g.log('basket result', { caught });
    }
  }
  corn(n) { const g = this.g; g.mangoes = Math.min(9, g.mangoes + n); g.syncHud(); }

  // ------------------------------------------------------------------ task 2: Sika and his net
  startSika() {
    const M = this.M, s = this.sika;
    s.show(true); s.place(M.sikaUp.x, M.sikaUp.y, M.sikaUp.z, -Math.PI / 2);
    this.sikaS = { st: 'sneak', t: 0, hits: 0, cool: 0, stun: 0 };
    this.g.voice.say('k1', 2); this.g.log('sika');
    this.g.hint('sika', { ar: 'سيكا عايز يصطاد سُكّرة بالشبكة! اضربه ٣ مرات قبل ما يوصلها', en: 'Sika wants to net Sukkara! Hit him 3 times before he gets to her' }, 3, 'attack');
  }
  hitSika() {
    const S = this.sikaS, s = this.sika, h = this.g.hero;
    S.hits++; S.cool = 0.35; S.stun = 0.75; S.st = 'stun';
    s.anim.play('hit_react', { fade: 0.04, restart: true });
    const dx = s.pos.x - h.pos.x, dz = s.pos.z - h.pos.z, d = Math.hypot(dx, dz) || 1;
    s.body.vel.set(dx / d * 3.5, 0, dz / d * 3.5);
    if (S.hits === 1) this.g.voice.say('k2', 2); else this.g.voice.bark(['f6'], 'sikahit', 2, 1);
    this.g.log('sika hit', { hits: S.hits });
    if (S.hits >= 3) { S.st = 'flee'; S.t = 0; this.g.voice.say('k3', 2); }
  }
  stepSika(dt) {
    const S = this.sikaS; if (!S) return;
    const g = this.g, s = this.sika, M = this.M, coop = M.perch.P3;
    S.t += dt; S.cool -= dt;
    const target = V(coop.x + 1.75, R2.C, coop.z);
    if (S.st === 'sneak') {
      const rem = s.steer(dt, target.x, target.z, 1.15, 6); s.move(dt, false); s.locoAnim(1.15);
      if (rem < 0.25) {
        // he reaches her: a swing of the net, she is off (via Zaghloul's flock), no plank for Radwan
        S.st = 'gone'; s.anim.play('punch', { fade: 0.05 }); this.t2 = false; g.voice.say('k4', 2); g.log('sika netted');
        if (this.stage === 'P3') { this.stage = 'P3'; this.flyOn(true); }
        setTimeout(() => { if (this.sikaS === S) { S.st = 'leave'; S.t = 0; } }, 900);
      }
    } else if (S.st === 'stun') {
      s.body.vel.multiplyScalar(Math.max(0, 1 - 6 * dt)); s.move(dt, false);
      if ((S.stun -= dt) <= 0) { S.st = 'sneak'; }
    } else if (S.st === 'flee') {
      // off over his plank to E and away: the plank stays (the shortcut)
      const K = M.plank, way = S.t < 1.2 ? V(0, R2.C, -949.6) : V(0, R2.C, -958);
      if (S.t > 1.0 && !this.plankBox.on) { this.setPlank(true); sfx3.thump(); this.t2 = true; this.corn(1); g.toast({ ar: 'سيكا هرب على اللوح... واللوح فضل! (سكة أقصر) + درة', en: 'Sika fled over his plank... and left it! (a shortcut) + corn' }, 2.8); }
      s.steer(dt, way.x, way.z, 5.5, 10); s.move(dt, false); s.body.pos.y = R2.C + 0.06; s.locoAnim(5.5);
      if (S.t > 3.2) { S.st = 'gone'; s.show(false); }
      void K;
    } else if (S.st === 'leave') {
      s.steer(dt, M.sikaUp.x, M.sikaUp.z, 3, 8); s.move(dt, false); s.locoAnim(3);
      if (S.t > 2.5) { s.show(false); S.st = 'gone'; }
    }
  }
  setPlank(on) { this.plank.visible = on; this.plankBox.on = on; }

  // ------------------------------------------------------------------ task 3: the gas cylinder
  stepCylinder(dt) {
    const g = this.g, h = g.hero, p = h.pos, M = this.M;
    if (this.t3 !== null) return;
    if (!this.g1said && p.distanceTo(this.boy.pos) < 7) { this.g1said = true; g.voice.say('g1', 2); g.hint('cyl', { ar: 'شيل الأنبوبة وطلّعها على السلم لحد باب المطبخ (من غير جري ولا نط)', en: 'Carry the cylinder up the stairs to the kitchen door (no running, no jumping)' }, 3); }
    if (!this.carrying && this.cylWorld.visible && h.body.onGround && Math.hypot(p.x - this.cylWorld.position.x, p.z - this.cylWorld.position.z) < 1.0 && Math.abs(p.y - this.cylWorld.position.y) < 0.8 && h.state === 'move') {
      this.carrying = true; this.cylWorld.visible = false; this.cylHeld.visible = true; h.setCarry(true, this.cylHeld); sfx.land(false); g.log('cylinder up');
    }
    if (this.carrying) {
      g.stickyHint('carry', { ar: 'شايل الأنبوبة... على السلم لحد باب المطبخ', en: 'Carrying the cylinder... up the stairs to the kitchen door' });
      if (h.state === 'hit' || h.state === 'down') this.dropCylinder(false);
      else if (Math.hypot(p.x - M.kitchen.x, p.z - M.kitchen.z) < 1.4 && Math.abs(p.y - M.kitchen.y) < 0.5) {
        this.carrying = false; this.cylHeld.visible = false; h.setCarry(false); this.t3 = true; g.clearSticky();
        this.cylWorld.visible = true; this.cylWorld.position.set(M.kitchen.x + 0.5, M.kitchen.y, M.kitchen.z - 0.3);
        this.ladder.visible = true; this.ladderBox.on = true; this.corn(1);
        this.boy.place(-2.6, R2.G, -1006.4, Math.PI / 2);
        g.voice.say('g2', 2); sfx.win();
        g.toast({ ar: 'الأنبوبة وصلت! سلم على البرج + درة', en: 'Cylinder delivered! A ladder up the tower + corn' }, 2.8);
        g.log('cylinder delivered');
      }
    }
  }
  dropCylinder(reset) {
    const h = this.g.hero, M = this.M;
    this.carrying = false; this.cylHeld.visible = false; h.setCarry(false); this.g.clearSticky();
    this.cylWorld.visible = true;
    if (reset || h.pos.y < R2.F - 0.5) this.cylWorld.position.copy(M.cyl); else this.cylWorld.position.set(h.pos.x, h.pos.y, h.pos.z);
    sfx3.bump(); this.g.log('cylinder dropped');
  }

  // ------------------------------------------------------------------ finale: call her down to her tower
  startFinale() {
    if (this.lure) return;
    this.lure = { on: false, meter: 0, t: 0, look: 0, nextLook: 1.6, wt: 0, nextWhistle: 3.2, whistling: 0, presses: 0 };
    this.flock.whistle(true);
  }
  showLure(on) { if (this.lureEl) this.lureEl.classList.toggle('hidden', !on); }
  stepLure(dt, I) {
    const g = this.g, h = g.hero, p = h.pos, M = this.M, L = this.lure, T = M.towerTop;
    const onTop = p.y > T.y - 0.25 && Math.hypot(p.x - T.x, p.z - T.z) < 1.9;
    if (!onTop) {
      this.showLure(false);
      if (p.y > R2.G - 0.3 && p.z < M.towerTop.z + 11) g.stickyHint('climb', this.t3 ? { ar: 'اطلع على السلم وبعدين فوق البرج', en: 'Up the ladder, then onto the tower' } : { ar: 'اطلع فوق البرج: الصناديق، وبعدين الخزان، وبعدين فوق', en: 'Climb the tower: the crates, the tank, then the top' }, 'jump');
      L.meter = Math.max(0, L.meter - 4 * dt);
      return;
    }
    if (!L.on) { L.on = true; g.voice.say('f21', 2); g.clearSticky(); g.log('lure start', { corn: g.mangoes }); }
    this.showLure(true);
    L.t += dt;
    // Zaghloul whistles every few seconds: 0.8 s of warning (his arm up, the bar goes red), 1.0 s of whistle
    L.nextWhistle -= dt;
    if (L.nextWhistle <= 0 && L.whistling <= 0) { L.whistling = 1.8; L.nextWhistle = 3.4 + Math.random() * 1.6; this.zag.anim.play('wave', { fade: 0.1, restart: true }); if (Math.random() < 0.5) g.voice.bark('z1', 'z1', 6, 1); }
    if (L.whistling > 0) { const before = L.whistling; L.whistling -= dt; if (before > 1.0 && L.whistling <= 1.0) this.whistleSound(); }
    // she looks at him for 0.75 s every 1.4-2 s (never during a whistle)
    L.nextLook -= dt;
    if (L.look > 0) L.look -= dt;
    else if (L.nextLook <= 0 && L.whistling <= 0) { L.look = 0.75; L.nextLook = 1.4 + Math.random() * 0.6; sfx.coo(); }
    const sp = this.suk.pos; this.suk.yaw += (Math.atan2((L.look > 0 ? p.x : M.flock.x) - sp.x, (L.look > 0 ? p.z : M.flock.z) - sp.z) - this.suk.yaw) * Math.min(1, 6 * dt);
    if (I.attackPressed) {
      L.presses++;
      if (L.whistling > 0) { L.meter = Math.max(0, L.meter - 20); g.cam.shake(0.1); sfx3.clack(); }
      else if (L.look > 0) { L.meter += 25 + 7 * Math.min(3, g.mangoes); L.look = 0; sfx.mango(6); g.fx.emit(p.x, p.y + 1.4, p.z, 6, { color: 0xffe08a, speed: 1.5, up: 1, life: 0.6, size: 0.08 }); }
      else { L.meter = Math.max(0, L.meter - 8); }
    }
    L.meter = Math.max(0, L.meter - 2 * dt);
    this.drawLure(L);
    if (L.meter >= 100) { this.showLure(false); this.lure = null; g.log('lured', { presses: L.presses, t: +L.t.toFixed(1) }); g.run(() => this.cutOutro()); }
  }
  drawLure(L) {
    const el = this.lureEl; if (!el) return;
    el.querySelector('i').style.width = Math.min(100, L.meter) + '%';
    const state = L.whistling > 0 ? 'red' : L.look > 0 ? 'go' : '';
    if (el._s !== state) {
      el._s = state; el.className = state;
      const t = state === 'red' ? ['زغلول بيصفّر... استنى!', 'Zaghloul is whistling... wait!'] : state === 'go' ? ['دلوقتي! نادي عليها', 'Now! Call her'] : ['استنى لما تبص لك', 'Wait until she looks at you'];
      el.querySelector('.ar').textContent = t[0]; el.querySelector('.en').textContent = t[1];
    }
  }
  async cutOutro() {
    const g = this.g, h = g.hero, M = this.M;
    g.seg = 'finale'; h.cine = true; h.body.vel.set(0, 0, 0);
    this.flock.whistle(false);
    this.suk.flyTo(M.perch.home, { up: 1.5, speed: 6 });
    const tz = M.towerTop.z;
    g.shot({ pos: V(-3.8, R2.G + 4.6, tz + 4), look: () => this.suk.pos.clone(), fov: 46, blend: 0.6 });
    await g.wait(1.8);
    sfx.win(); sfx3.cheer();
    g.closeSection();
    g.result = { mission: 2, helped: [this.t1 === true, this.t2 === true, this.t3 === true], corn: g.mangoes, timeLeft: Math.max(0, g.timeLeft), elapsed: g.elapsed, hpLost: g.hpLost || 0, deaths: g.deaths, fails: g.fails, cleanBonus: g.cleanBonus };
    g.log('finish', g.result);
    this.hajja.place(-1.6, R2.G, tz + 3.8, Math.PI);
    g.shot({ pos: V(-2.6, R2.G + 1.7, tz + 6.8), look: g.headOf(this.hajja, 1.3), fov: 42, blend: 0.6 });
    await g.say('e1');
    g.shot({ pos: V(1.8, T(M) + 1.4, tz + 2.6), look: g.headOf(h, 1.5), fov: 42, blend: 0.6 });
    await g.say('e2');
    g.shot({ pos: V(10, R2.R + 5.6, tz + 6), look: g.headOf(this.zag, 1.4), fov: 40, blend: 0.8 });
    await g.say('e3');
    await g.wait(0.6);
    this.end();
  }
  end() {
    const g = this.g, r = g.result;
    const stars = [r.helped.every(Boolean), r.timeLeft >= STAR_SUN2, r.fails === 0 && r.hpLost <= 2];
    const rows = [
      [stars[0], 'ساعدت الجيران التلاتة (السبت، سيكا، الأنبوبة)', 'Helped all three neighbours (basket, Sika, cylinder)'],
      [stars[1], 'سُكّرة رجعت والشمس لسه فاضل لها ' + num(STAR_SUN2) + ' ثانية', 'Sukkara home with ' + STAR_SUN2 + ' s of sun to spare'],
      [stars[2], 'المشوار كله من غير ولا إعادة، ومن غير ما تخسر أكتر من قلب', 'The whole run without a retry, losing at most one heart'],
    ];
    g.showEnd(2, stars, rows, { countText: num(r.corn), countLabel: ['درة', 'Corn'], elapsed: r.elapsed, fails: r.fails });
  }
  // the dog's events (dog.js): sounds, the warning, the bite
  onDog(e) {
    const g = this.g, d = this.dog;
    if (e === 'wake') { g.voice.bark('d1', 'dog', 20, 2); g.hint('dog', { ar: 'كلب مربوط! خليك بعيد عن سلسلته، أو اضربه بالنبّوت يرجع', en: 'A chained dog! Keep clear of its chain, or a whack sends it back' }, 2.8, 'attack'); }
    if (e === 'bark') { sfx3.bump(); sfx3.telegraph(); }
    if (e === 'growl') sfx3.hurt();
    if (e === 'yelp') { sfx3.clack(); g.log('dog whacked'); }
    if (e === 'bite') { const r = g.hurt(2, d.pos.x, d.pos.z, false); if (r !== 'dodged' && r !== 'blocked') { g.log('dog bite', { hp: g.hp }); if (this.carrying) this.dropCylinder(false); } }
  }
}
function T(M) { return M.towerTop.y; }
