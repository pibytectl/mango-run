// The Mango Run, 3D mode: Mission 1 as an in-engine, voiced, third-person action run.
// Loaded lazily by main.js when the player picks 3D. Fixed 60 Hz simulation (render-rate independent),
// hit-stop and slow motion on top of it.
import * as THREE from '../../vendor/three.module.min.js';
import { loadAssets3D, prefetchVoices, A } from './assets3d.js';
import { PhysWorld } from './physics.js';
import { Level, ROOF, PLAZA_Z } from './level.js';
import { Hero, ATTACKS } from './hero3d.js';
import { Npc, Goat, Pigeons } from './npc.js';
import { Sky, Particles, Mangoes } from './fx3d.js';
import { ChaseCam } from './camera3d.js';
import { I3, initInput3D, readInput3D, takeLook, clearInput3D, updateLockHint } from './input3d.js';
import { Voice } from './voice.js';
import { sfx3, Engine } from './sfx3d.js';
import { Chase, makeTok, makeFerry, ESCAPE_GAP, END_GAP } from './vehicle.js';
import { Fight, Fighter } from './fight.js';
import { Bot } from './bot.js';
import { Hazards } from './hazards.js';
import { RoofTraps } from './traps.js';
import { Mission2, LIMIT2, SEG2 } from './mission2.js';
import { Mission3, LIMIT3, SEG3 } from './mission3.js';
import { sfx, playMusic, setMusicRate, loadMusic, audioInit, loadAmbient, setAmbient } from '../audio.js';
import { num, clock } from '../strings.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const $ = (id) => document.getElementById(id);
// Round 3 (Andy: "too easy"): the sun sets in 4:20 instead of 7:30. Round 4 (Andy, after round 3: "still not
// difficult"): 3:30, a clean section (no heart and no mango lost in it) gives sun back, a fail costs 10 s of sun
// (a retry restores at least 60 s), and hearts no longer come back with each new stretch.
const LIMIT = 210, CLEAN_BONUS = 7, FAIL_COST = 10, STAR_SUN = 75;
const STEP = 1 / 60;
const SEG = {
  street: { ar: '١ · الشارع', en: 'The Street', oar: 'اجري ناحية النيل... المعدية مستنياك', oen: 'Run toward the Nile... the ferry is waiting' },
  market: { ar: '٢ · السوق', en: 'The Market', oar: 'الحق الحرامي واضربه بالنبّوت', oen: 'Catch the thief and whack him with the staff' },
  chase: { ar: '٣ · مطاردة التوكتوك', en: 'Tok-tok Chase', oar: 'خبّط في توكتوك الحرامي ولِم المانجا', oen: 'Ram the thief\'s tok-tok and grab the mangoes' },
  fight: { ar: '٤ · الحارة', en: 'The Alley', oar: 'اضرب، صدّ، واتفادى', oen: 'Strike, block, dodge' },
  roofs: { ar: '٥ · السطوح', en: 'The Rooftops', oar: 'السطوح أقصر سكة للنيل', oen: 'The rooftops are the shortest way to the Nile' },
  jetty: { ar: '٦ · المرسى', en: 'The Jetty', oar: 'اجري ونُط على المعدية!', oen: 'Run and jump onto the ferry!' },
  ...SEG2,
  ...SEG3,
};

export async function start3D(env) {
  const g = new Game3D(env);
  await g.load();
  g.begin();
  return g;
}

class Game3D {
  constructor(env) {
    this.env = env; this.ui = env.ui; this.renderer = env.renderer; this.isTouch = env.isTouch;
    this.auto = !!env.auto; this.active = true; this.state = 'loading'; this.mode = 'play';
    // which mission (1: The Mango Run, 2: The Runaway Pigeon); the engine is shared, the flow is per mission
    this.mission = [2, 3].includes(env.mission) ? env.mission : 1; this.limit = this.mission === 2 ? LIMIT2 : this.mission === 3 ? LIMIT3 : LIMIT;
    // Mission 2 is short and dense: a smaller clean-section bonus, a smaller retry cost and floor. Mission 3: every
    // day has its own clock (mission3.js sets the limit and the floor per day), no clean-section bonus
    this.tune = this.mission === 2 ? { clean: 4, failCost: 8, minRestore: 35 } : this.mission === 3 ? { clean: 0, failCost: 8, minRestore: 50 } : { clean: CLEAN_BONUS, failCost: FAIL_COST, minRestore: 60 };
    this.stats = { fps: [], log: [], segTimes: {}, botNudges: 0, voices: 0 };
    this.waits = []; this.movers = [];
    this.log = (...a) => { const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); this.stats.log.push(s); console.log('[saidi3d]', s); };
    window.__saidi3d = this;
    this.simSpeed = Math.max(1, Math.min(4, +new URLSearchParams(location.search).get('speed') || 1));
  }

  async load() {
    const ui = this.ui;
    ui.screen('screen-loading'); ui.setLoad(0.02);
    document.body.classList.add('mode3d'); document.body.classList.toggle('m2', this.mission === 2); document.body.classList.toggle('m3', this.mission === 3);
    const r = this.renderer;
    this.saved = { tm: r.toneMapping, exp: r.toneMappingExposure, sh: r.shadowMap.enabled };
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = this.isTouch ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    await loadAssets3D((p) => ui.setLoad(0.05 + p * 0.85), r.capabilities.getMaxAnisotropy ? Math.min(4, r.capabilities.getMaxAnisotropy()) : 1, this.mission);
    this.quality = this.isTouch ? { shadow: 1024, shadowRange: 26 } : { shadow: 2048, shadowRange: 32 };
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1400);
    this.phys = new PhysWorld();
    // the shop signs and kiosk banners are drawn into canvases in the game font: make sure it is ready
    try { await Promise.race([document.fonts.load('900 40px CairoGame'), new Promise((r) => setTimeout(r, 3000))]); } catch (e) {}
    this.level = new Level(this.scene, this.phys).build(this.mission);
    ui.setLoad(0.93);
    this.sky = new Sky(this.scene, r, this.quality);
    this.fx = new Particles(this.scene);
    this.mangoesFx = new Mangoes(this.scene);
    this.hero = new Hero(this.scene, this.phys, (e, d) => this.onHero(e, d));
    this.cam = new ChaseCam(this.camera, this.phys);
    this.voice = new Voice();
    this.engine = new Engine();
    this.haz = new Hazards(this); this.sfxSplash = () => sfx3.splash();
    this.jugTaken = false; this.traps = new RoofTraps(this);
    this.pigeons = new Pigeons(this.scene);
    this.fight = new Fight(this);
    if (this.mission === 1) {
      this.goat = new Goat(this.scene); this.goat.pos.set(-7, 0, -238); this.goat.yaw = 0;
      this.chase = new Chase(this);
      this.makeCast();
      this.makeProps();
    } else if (this.mission === 2) {
      this.makeLockRing(); this.elapsed = 0; this.npc = {};
      this.m2 = new Mission2(this); this.allNpcs = this.m2.npcs;
    } else {
      this.makeLockRing(); this.elapsed = 0; this.npc = {}; this.streetToks = [];
      this.m3 = new Mission3(this); this.allNpcs = this.m3.npcs;
    }
    initInput3D(this.isTouch, r.domElement);
    this.inp = {};
    addEventListener('resize', this._onResize = () => this.resize());
    this.resize();
    // compile shaders up front so the first frames do not hitch
    if (this.m2) this.hero.place(this.level.spawns.m2.start.x, this.level.spawns.m2.start.y, this.level.spawns.m2.start.z, Math.PI);
    else if (this.m3) this.hero.place(this.level.spawns.m3.start.x, 0, this.level.spawns.m3.start.z, Math.PI);
    else this.hero.place(3.6, 0, 20.5 + PLAZA_Z, Math.PI);
    this.cam.snapBehind(this.hero.pos, Math.PI);
    this.cam.update(0.016, { focus: this.hero.pos, look: { x: 0, y: 0 } });
    // compile every shader now, hidden things included (townspeople, chase tok-toks...): compile() skips
    // invisible objects, and their first appearance used to stall the opening shot while shaders built
    const hidden = []; this.scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    r.compile(this.scene, this.camera);
    for (const o of hidden) o.visible = false;
    ui.setLoad(1);
    prefetchVoices(this.mission);
    // Mzee's own recordings: street traffic (low-passed into a distant hum) and the city heard from a rooftop
    loadAmbient('street', 'assets/3d/amb_traffic.mp3'); loadAmbient('roof', 'assets/3d/amb_roof.mp3');
    this.log('loaded', { boxes: this.phys.boxes.length, calls: 0 });
  }

  makeCast() {
    const S = this.scene, P = this.phys;
    // townspeople wear galabeyas on the hero's rig, each with a body, head and beard of his own so none reads as
    // Radwan (round 3, Mzee): heavier or thinner, shorter or taller; a white kufi, a dark scarf wrap or bare
    // grey/black hair; grey beards and moustache-only faces; robes in blues, greys, white and pin stripes. The
    // thief and his pals keep the thief model; kids in t-shirt colours.
    this.npc = {
      driver: new Npc(S, P, { robe: 0x46566e, head: 'hair', hair: 0x24201c, beard: 2, build: [1.14, 0.97], name: 'driver' }),
      tea: new Npc(S, P, { robe: 0xd9d4c6, stripe: 0x5b78a8, head: 'kufi', hair: 0x8e8a84, beard: 1, build: [0.9, 0.94], name: 'tea' }),
      kids: [new Npc(S, P, { tint: 0x3f7a55, scale: 0.62, name: 'kid1' }), new Npc(S, P, { tint: 0xc0943c, scale: 0.6, name: 'kid2' }), new Npc(S, P, { tint: 0x40609a, scale: 0.66, name: 'kid3' })],
      thief: new Npc(S, P, { name: 'thief' }),
      buddyA: new Npc(S, P, { tint: 0x2a3552, name: 'buddyA' }),
      buddyB: new Npc(S, P, { tint: 0x66654a, name: 'buddyB' }),
      // round 4 (the character pack): the third of the thief's pals, the one in the fake-leather jacket
      buddyC: new Npc(S, P, { tint: 0x3a3a3a, name: 'buddyC' }),
      captain: new Npc(S, P, { robe: 0x25304a, head: 'scarf', wrap: 0x3a2e26, beard: 1, build: [1.16, 1.0], name: 'captain' }),
      tokDriver: new Npc(S, P, { robe: 0x6d7276, head: 'hair', hair: 0x17130f, beard: 2, build: [0.93, 1.04], name: 'tokDriver' }),
      extras: [new Npc(S, P, { robe: 0x2b2a2e, stripe: 0x8a8d94, head: 'scarf', wrap: 0x45403a, build: [0.94, 1.06], name: 'pass1' }),
        new Npc(S, P, { robe: 0x3c6496, head: 'kufi', hair: 0x2a2520, beard: 2, build: [1.1, 0.93], name: 'pass2' })],
      // round 4: shoppers for the market crowd (the two passers-by and two of the kids join them there)
      shoppers: [new Npc(S, P, { robe: 0x5a4636, head: 'scarf', wrap: 0x26282c, beard: 1, build: [1.12, 0.95], name: 'shop1' }),
        new Npc(S, P, { robe: 0x7d8a8f, head: 'kufi', hair: 0x2b2622, beard: 2, build: [0.92, 1.03], name: 'shop2' }),
        new Npc(S, P, { robe: 0x3d4a3a, stripe: 0xb8b2a0, head: 'hair', hair: 0x9a958c, beard: 1, build: [1.0, 0.97], name: 'shop3' })],
    };
    this.allNpcs = [...this.npc.extras, ...this.npc.shoppers, this.npc.driver, this.npc.tea, ...this.npc.kids, this.npc.thief, this.npc.buddyA, this.npc.buddyB, this.npc.buddyC, this.npc.captain, this.npc.tokDriver];
    for (const n of this.allNpcs) n.show(false);
  }
  makeProps() {
    // football
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#1b1b1b';
    for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(10 + i * 22, 16 + (i % 2) * 30, 7, 0, 7); x.fill(); }
    const bt = new THREE.CanvasTexture(c); bt.colorSpace = THREE.SRGBColorSpace;
    this.ball = { m: new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), new THREE.MeshLambertMaterial({ map: bt })), p: V(10, 0.17, -60), v: V(), live: false };
    this.ball.m.castShadow = true; this.scene.add(this.ball.m); this.ball.m.visible = false;
    // ferry: the Imbaba river ferry built in code (round 2, from Mzee's photos): white hull with a blue band and
    // tyre fenders, plank deck, side benches and rails, a canopy on posts at standing height with a rail on the
    // roof, a small teal wheelhouse at the bow, the flag at the stern, its name board in Arabic
    const fr = new THREE.Group(); fr.add(makeFerry()); this.scene.add(fr);
    this.ferryDeckLocal = 0;
    this.ferry = { root: fr, z: 0, v: 0, moving: false, deck: this.phys.add(-1.5, -2, -4.3, 1.5, 0.35, 4.3, { dynamic: true, kind: 'ferry' }) };
    this.elapsed = 0; this.resetFerry();
    // crash cart + a world crate for when Radwan sets his down
    this.crashCart = A.glb.cart.scene.clone(); this.crashCart.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.crashCart.position.copy(this.level.spawns.crashCart); this.crashCart.rotation.y = 0.3; this.scene.add(this.crashCart);
    this.worldCrate = A.glb.mango_crate.scene.clone(); this.worldCrate.scale.setScalar(0.82); this.worldCrate.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.worldCrate.visible = false; this.scene.add(this.worldCrate);
    // street tok-toks pool
    this.streetToks = [];
    this.parkedTok = makeTok(this.scene, 0x9fd0ff); const pt = this.level.spawns.parkedTok;
    this.parkedTok.root.position.set(pt.x, 0, pt.z); this.parkedTok.root.rotation.y = Math.PI / 2 + 0.05;
    this.makeLockRing();
    // rooftop start cue: a chalk arrow on the wall over the crates and a pulsing ring on top of them
    {
      const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d');
      x.strokeStyle = '#ffe27a'; x.fillStyle = '#ffe27a'; x.lineWidth = 18; x.lineCap = 'round'; x.lineJoin = 'round';
      x.beginPath(); x.moveTo(64, 236); x.lineTo(64, 70); x.stroke();
      x.beginPath(); x.moveTo(14, 96); x.lineTo(64, 20); x.lineTo(114, 96); x.stroke();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const arrow = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.5), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
      arrow.position.set(-3.5, 2.6, -917.95);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 28), new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(-3.5, 1.23, -916.4);
      this.roofCue = new THREE.Group(); this.roofCue.add(arrow, ring); this.roofCue.visible = false; this.scene.add(this.roofCue);
      this.roofCueRing = ring;
    }
  }
  makeLockRing() {
    this.lockRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 32), new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.85, depthWrite: false }));
    this.lockRing.rotation.x = -Math.PI / 2; this.lockRing.visible = false; this.scene.add(this.lockRing);
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.applyDpr();
  }
  applyPendingDpr() { this.dprScale = this.pendingDpr; this.pendingDpr = null; this.applyDpr(); }
  applyDpr() {
    const max = Math.min(window.devicePixelRatio || 1, this.isTouch ? 1.5 : 1.35);
    this.dprScale = this.dprScale || 1;
    this.renderer.setPixelRatio(Math.max(0.75, max * this.dprScale));
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.fx.mat.uniforms.uScale.value = innerHeight * this.renderer.getPixelRatio() * 0.9;
  }

  // ================================================================== flow
  begin() {
    const Q = new URLSearchParams(location.search);
    this.resetRun();
    this.ui.screen(null);
    this.state = 'play';
    $('bars3d').onclick = () => this.advance();
    $('skip3d').onclick = (e) => { e.stopPropagation(); this.skipCut(); };
    audioInit('3d'); playMusic('title', 0.45); setAmbient(0.16);
    this.raf = requestAnimationFrame((t) => this.frame(t));
    if (this.auto) { this.bot = new Bot(this); I3.bot = this.bot.inp; }
    const seg = Q.get('seg3d');
    if (seg) { this.cp = this.defaultCp(seg); this.restoreCp(); return; }
    if (this.m2) this.run(() => this.m2.cutIntro());
    else if (this.m3) this.run(() => this.m3.cutIntro());
    else this.run(() => this.cutIntro());
  }
  resetRun() {
    this.timeLeft = this.limit; this.mangoes = this.m2 || this.m3 ? 0 : 12; this.stolen = 0; this.hp = 6; this.lost = 0; this.hpLost = 0;
    this.fightTries = 0; this.fightWon = false; this.elapsed = 0; this.deaths = 0; this.fails = 0; this.cleanBonus = 0;
    this.cp = null; this.seg = 'intro'; this.lastCpSeg = null; this.sec = null; this.jugTaken = false;
    this.syncHud(true);
  }
  defaultCp(seg) {
    if (this.m2) return this.m2.defaultCp(seg);
    if (this.m3) return this.m3.defaultCp(seg);
    const L = this.level.spawns;
    const base = { street: [L.street, Math.PI, 12, 0, LIMIT - 5], market: [L.cpMarket, Math.PI, 12, 0, LIMIT - 20], chase: [L.tokPlayer, Math.PI, 6, 6, LIMIT - 42],
      fight: [L.fight, Math.PI, 8, 4, LIMIT - 90], roofs: [V(-1.5, 0, -912), Math.PI, 12, 0, LIMIT - 108], jetty: [L.cpJetty, Math.PI, 12, 0, LIMIT - 140], roofs2: [L.cpRoof2, Math.PI, 12, 0, LIMIT - 125] }[seg];
    return { seg: seg === 'roofs2' ? 'roofs' : seg, sub: seg === 'roofs2' ? 'r5' : null, pos: base[0].clone(), yaw: base[1], mangoes: base[2], stolen: base[3], time: base[4] };
  }
  saveCp(seg, pos, yaw, sub) {
    this.cp = { seg, sub, pos: pos.clone(), yaw, mangoes: this.mangoes, stolen: this.stolen, time: this.timeLeft };
    // round 4: no heart back per stretch any more (round 3 gave one); the only refill is the water jug on the roofs
    this.lastCpSeg = seg;
    this.log('checkpoint', seg, sub || '', { t: +this.elapsed.toFixed(1), mangoes: this.mangoes });
    if (this.elapsed > 1) this.toast({ ar: 'اتحفظ مكانك', en: 'Checkpoint' }, 1.6);
  }
  restoreCp(penalty = false) {
    const c = this.cp;
    // round 4: a retry costs sun (was free: the clock went back to the checkpoint's time)
    if (penalty) c.time = Math.max(c.time - this.tune.failCost, this.tune.minRestore);   // cumulative: every retry of a stretch costs more
    this.mangoes = c.mangoes; this.stolen = c.stolen; this.timeLeft = c.time; this.hp = 6; this.haz.clear();
    this.sec = null; this.traps.reset();
    this.voice.stop(); this.voice.hide(); this.mangoesFx.clear(); this.clearWorldUi(); this.ui.hideToast(); this.clearSticky();
    this.hero.cine = false; this.hero.ride = false; this.hero.body.h = 1.75; this.hero.lockTarget = null; this.hero.targets = [];
    this.fight.stop(); this.engine.stop();
    if (this.chase) { this.chase.stop(); this.chase.hide(); this.endCrowd(); this.npc.thief.body.h = 1.7; }
    for (const n of this.allNpcs) n.show(false);
    for (const t of this.streetToks || []) this.scene.remove(t.tok.root);
    this.streetToks = []; this.timeScale = 1; this.hitStop = 0; this.movers = [];
    this.cam.shot = null;
    this.enterSeg(c.seg, true);
  }
  // run a cutscene (async fn); gameplay resumes after
  async run(fn) {
    this.mode = 'cut'; this.skip = false;
    $('bars3d').classList.remove('hidden'); this.showControls(false); $('toast').classList.add('hidden'); this.ui.toastT = 0;
    try { await fn(); } catch (e) { console.error(e); this.log('cutscene error', e.message); }
    $('bars3d').classList.add('hidden');
    // a skip resolves the waits at once, so the cutscene ends before the next frame's stepMovers can snap its
    // walks: finish them here, while skip is still set. A walk of the hero's own that outlived the cutscene
    // would keep steering him in play (Andy: "the character is drifting" at the street start), so it ends too.
    if (this.skip) this.stepMovers(0);
    if (this.movers) for (const m of this.movers) if (m.who === this.hero) { const b = m.who.body; b.pos.x = m.x; b.pos.z = m.z; if (m.face !== undefined) m.who.yaw = m.face; m.who.anim.play('idle', { loop: true, fade: 0.25 }); m.done = true; m.res && m.res(); }
    if (this.movers) this.movers = this.movers.filter((m) => !m.done);
    this.skip = false;
  }
  wait(sec) { if (this.skip) return Promise.resolve(); return new Promise((res) => this.waits.push({ t: sec, res })); }
  async say(id) { if (this.skip) return; this.stats.voices++; await this.voice.say(id, 3); if (!this.skip) await this.wait(0.12); }
  skipCut() { if (this.mode !== 'cut') return; this.skip = true; this.voice.stop(); for (const w of this.waits) w.res(); this.waits = []; }
  advance() { if (this.mode === 'cut' && this.voice.busy()) this.voice.stop(); }
  play(seg) {
    this.mode = 'play'; this.seg = seg; this.cam.shot = null; if (this.roofCue) this.roofCue.visible = false;
    this.traps.show(seg === 'roofs' || !!this.m2);
    this.showControls(true); clearInput3D(); this.setButtons(seg);
    this.segStart = this.elapsed;
    this.closeSection(); this.sec = { seg, lost: this.hpLost || 0, m: this.mangoes, dirty: false };
    this.stats.segTimes[seg] = +this.elapsed.toFixed(1);
    this.log('segment', seg, { t: +this.elapsed.toFixed(1), mangoes: this.mangoes, hp: this.hp });
    const s = SEG[seg]; this.ui.banner({ ar: s.ar, en: s.en });
    setTimeout(() => { if (this.seg === seg && this.mode === 'play' && !this.stickyOn()) this.toast({ ar: s.oar, en: s.oen }, 3.2, 'obj'); }, 2300);
    playMusic('run', 0.5); setMusicRate(seg === 'chase' || seg === 'fight' ? 1.05 : 1);
    if (this.m2) setAmbient(0.3, 'roof');
    else if (this.m3) setAmbient(seg === 'd5' ? 0.12 : 0.24, 'street');
    else if (seg === 'roofs' || seg === 'jetty') setAmbient(seg === 'roofs' ? 0.32 : 0.2, 'roof');
    else setAmbient(seg === 'chase' ? 0.34 : seg === 'street' || seg === 'market' ? 0.24 : 0, 'street');
  }
  // a section played clean (no heart, no mango lost, no retry) gives sun back when the next one starts
  closeSection() {
    const S = this.sec; this.sec = null;
    if (!S || S.dirty || (this.hpLost || 0) > S.lost || this.mangoes < S.m) return;
    const B = this.tune.clean;
    this.timeLeft = Math.min(this.limit, this.timeLeft + B); this.cleanBonus += B;
    this.log('clean section', S.seg, { bonus: B });
    setTimeout(() => { if (this.mode === 'play' && this.state === 'play') this.toast({ ar: 'مرحلة نضيفة! +' + num(B) + ' ثواني شمس', en: 'Clean section! +' + B + ' s of sun' }, 2.2); }, 900);
  }
  showControls(on) { this.ui.show('hud', on); $('c3d').classList.toggle('hidden', !on); I3.enabled = on; updateLockHint(); }
  setButtons(seg) {
    const c = $('c3d');
    c.classList.toggle('veh', seg === 'chase'); c.classList.toggle('fight', seg === 'fight' || seg === 'd4');
  }

  // ================================================================== main loop
  frame(now) {
    if (!this.active) return;
    this.raf = requestAnimationFrame((t) => this.frame(t));
    let dt = (now - (this.last || now)) / 1000; this.last = now;
    if (dt > 0.25) dt = 0.25;
    // a resolution change is applied here, right before this frame renders: resizing the canvas clears it, and
    // round 2 resized after the render (in perf), so the browser showed one blank frame at every step
    if (this.pendingDpr) this.applyPendingDpr();
    if (this.state === 'play') {
      if (this.hitStop > 0) { this.hitStop -= dt; }
      else {
        // ?speed=N (tests only) runs the fixed-step simulation N times faster than the wall clock
        this.acc = (this.acc || 0) + dt * (this.timeScale || 1) * this.simSpeed;
        const cap = 15 * this.simSpeed;
        let n = 0;
        while (this.acc >= STEP && n < cap) { this.step(STEP); this.acc -= STEP; n++; }
        if (n === cap) this.acc = 0;
      }
      this.updateCamera(dt);
      this.renderFrame(dt);
    } else if (this.state === 'paused' || this.state === 'fail') {
      this.renderer.render(this.scene, this.camera);
    }
    this.perf(dt);
  }
  step(dt) {
    this.waits = this.waits || [];
    if (this.waits.length) { for (const w of this.waits) w.t -= dt; const done = this.waits.filter((w) => w.t <= 0); this.waits = this.waits.filter((w) => w.t > 0); for (const w of done) w.res(); }
    const I = readInput3D(this.inp);
    if (this.m2 && this.mode === 'play') this.m2.filterInput(I);
    if (this.m3 && this.mode === 'play') this.m3.filterInput(I);
    if (this.bot && this.mode === 'play') this.bot.step(dt);
    if (this.mode === 'play') {
      this.elapsed += dt;
      this.timeLeft -= dt;
      if (I.lockPressed) this.toggleLock();
    }
    // movers (cutscene walking)
    this.stepMovers(dt);
    const hero = this.hero;
    hero.inCombat = this.inFight() && this.mode === 'play';
    if (this.seg === 'chase' && this.chase.active) {
      this.chase.step(dt, this.mode === 'play' ? I : { steer: 0, throttle: 1, boost: false }); this.seatRiders();
      // round 4: how far ahead he is, over his tok-tok; a warning before the alley if Radwan is too far back
      const C = this.chase, gap = C.gapNow || 0;
      if (this.mode === 'play') {
        this.thiefPill({ x: C.thief.x, y: 0.2, z: C.thief.z }, gap, 0, ESCAPE_GAP, C.escapeT);
        if (C.thief.s > C.road.len - 150 && gap > END_GAP - 2) this.stickyHint('alleygap', { ar: 'قرّب منه قبل ما يوصل الحارة! (أقل من ' + num(END_GAP) + ' متر)', en: 'Close in before he reaches the alley! (under ' + END_GAP + ' m)' }, 'attack');
      }
    }
    // the tok-tok engine follows the ride's speed (into the crash too, where it brakes to idle)
    if (this.engine.want) this.engine.set(this.chase.player.v, this.chase.player.boosting && this.chase.active);
    hero.update(dt, this.mode === 'play' ? I : {}, this.cam.yaw);
    if (this.mode === 'play') this.segStep(dt, I);
    else if (this.cutStep) this.cutStep(dt);
    this.fight.step(dt);
    for (const n of this.allNpcs) if (n.active && !n.fighting) n.update(dt);
    if (this.goat) this.goat.update(dt);
    this.pigeons.update(dt, hero.pos.clone().setY(hero.pos.y + 1), (p) => { sfx3.flap(); if (p.white && !this.voice.played.has('u2')) setTimeout(() => this.voice.say('u2', 2), 500); });
    this.mangoesFx.update(dt, (x, z, y) => { const g = this.phys.groundAt(x, z, 0.1, y); return g ? g.y : -0.4; },
      this.seg === 'chase' ? { x: this.chase.player.x, y: 0, z: this.chase.player.z } : hero.pos, this.seg === 'chase' ? 2.4 : 1.5, () => this.gainMango());
    if (this.ferry) this.updateFerry(dt);
    if (this.ball) this.updateBall(dt);
    if ((this.seg === 'roofs' || this.m2) && this.mode === 'play') this.traps.step(dt);
    this.fx.update(dt);
    this.voice.update(dt);
    if (!this.m3) this.sky.setSun(Math.max(0, this.timeLeft / this.limit));
    if (this.mode === 'play') {
      if (this.hp <= 0) this.fail('hearts');
      else if (this.timeLeft <= 0) this.fail('time');
    }
    if (hero.pos.y < -30) { hero.place(this.cp.pos.x, this.cp.pos.y, this.cp.pos.z, this.cp.yaw); }
  }
  updateCamera(dt) {
    const h = this.hero, look = takeLook();
    if (this.mode === 'cut' && this.cam.shot) { this.cam.update(dt, {}); return; }
    if (this.seg === 'chase' && this.chase.active) {
      const P = this.chase.player;
      this.cam.update(dt, { mode: 'vehicle', focus: V(P.x, 0, P.z), heading: P.yaw, speed: P.v, look });
      return;
    }
    const fighting = this.inFight();
    const lock = this.hero.lockTarget || (fighting ? this.nearestFoe() : null);
    const foes = fighting && this.fight.active ? this.fight.list.filter((f) => !f.ko && f.state !== 'lurk' && f.npc.root.visible).map((f) => f.pos) : null;
    this.cam.update(dt, {
      mode: fighting && this.mode === 'play' ? 'fight' : 'foot', focus: h.pos, lock: lock ? lock.pos : null, foes,
      heading: h.yaw, speed: Math.hypot(h.body.vel.x, h.body.vel.z), sprint: h.sprinting, slide: h.state === 'slide', look, touch: I3.touch || !!this.bot,
      // every on-foot stretch of the mission runs down -Z (west, to the Nile): on touch the camera lines up with
      // the route, not with the hero's heading, so an off-angle stick no longer curls "forward" into a wall
      route: (I3.touch || this.bot) && (!this.m3 || this.seg === 'd3') ? Math.PI : undefined,
      high: this.seg === 'roofs' || !!this.m2,
    });
  }
  renderFrame(dt) {
    const focus = this.seg === 'chase' && this.chase.active ? V(this.chase.player.x, 0, this.chase.player.z) : this.hero.pos;
    this.sky.update(this.camera.position, focus);
    // static town chunks beyond ~340 m are fully fogged (FogExp2 0.0062 is ~97% fog at 300 m): skip them
    const cp = this.camera.position;
    for (const m of this.level.meshes) { const b = m.geometry.boundingSphere; m.visible = Math.hypot(b.center.x - cp.x, b.center.z - cp.z) - b.radius < 340; }
    this.level.nile.material.uniforms.uTime.value += dt;
    this.level.nile.material.uniforms.uSun.value.copy(this.sky.dir);
    this.level.nile.material.uniforms.uFogCol.value.copy(this.sky.fog.color);
    this.renderer.render(this.scene, this.camera);
    this.ui.tickToast(dt);
    this.updateWorldUi(dt);
    this.syncHud();
  }
  perf(dt) {
    this.fpsAcc = (this.fpsAcc || 0) + dt; this.fpsN = (this.fpsN || 0) + 1;
    if (this.fpsAcc < 1) return;
    const fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0;
    if (this.state !== 'play') return;
    this.stats.fps.push(Math.round(fps));
    this.stats.calls = this.renderer.info.render.calls; this.stats.tris = this.renderer.info.render.triangles;
    if (fps < 45) { this.slow = (this.slow || 0) + 1; this.fast = 0; } else if (fps > 57) { this.fast = (this.fast || 0) + 1; this.slow = 0; }
    // never below 0.75 of the device ratio cap: lower than that the picture turns to mush (Low Power Mode runs at 30 fps).
    // Round 3: with fps hovering around the thresholds the scaler went down and up every few seconds (each step a
    // resize); now a step up waits 20 s after the last change, and after 4 changes the scale stays where it is.
    const now = this.elapsed, cool = now - (this.dprAt ?? -99), cur = this.pendingDpr || this.dprScale;
    this.dprChanges = this.dprChanges || 0;
    if (this.dprChanges < 4) {
      if (this.slow >= 2 && cur > 0.75 && cool > 3) { this.pendingDpr = Math.max(0.75, cur - 0.08); this.slow = 0; this.dprAt = now; this.dprChanges++; }
      else if (this.fast >= 6 && cur < 1 && cool > 20) { this.pendingDpr = Math.min(1, cur + 0.08); this.fast = 0; this.dprAt = now; this.dprChanges++; }
    }
    const f = $('fps');
    if (this.auto || new URLSearchParams(location.search).has('fps')) { f.classList.remove('hidden'); f.textContent = `${Math.round(fps)} fps · dpr ${this.renderer.getPixelRatio().toFixed(2)} · ${this.seg} · z ${this.hero.pos.z.toFixed(0)} · calls ${this.stats.calls}`; }
  }

  // ================================================================== HUD + world UI
  syncHud(force) {
    const ui = this.ui;
    if (force || this._hp !== this.hp) {
      if (this._hp !== undefined && this.hp < this._hp && this.state === 'play') this.hpLost = (this.hpLost || 0) + (this._hp - this.hp);
      const pop = this._hp !== undefined && this.hp < this._hp ? Math.floor(this.hp / 2) : -1;
      this._hp = this.hp;
      ui.setHalfHearts(this.hp, pop);
    }
    if (force || this._m !== this.mangoes) { const up = this._m !== undefined && this.mangoes > this._m; this._m = this.mangoes; ui.setMangoes(this.mangoes, !force); if (!force) $('slot-crate').classList.toggle('gain', up); }
    ui.setStamina(this.seg === 'chase' ? this.chase.player.boost : this.hero.stamina);
    ui.setTime(this.timeLeft, this.limit);
    if (this.m3) this.m3.hud();
  }
  toast(t, dur = 2.6, key) { this.ui.toast(t, dur, key); }
  // An obstacle hint that stays up while the obstacle is ahead: refreshed every step it is wanted, cleared
  // as soon as it is not (passed, or the segment changed). A short warning may cover it; it comes back after.
  stickyHint(key, t, btn) {
    const ui = this.ui;
    if (ui.toastKey === key || ui.toastT <= 0.05 || ui.toastKey === 'obj') ui.toast(t, 0.4, key);
    if (this._sticky && this._sticky.key !== key) this.clearSticky();
    if (!this._sticky) {
      const el = btn ? document.querySelector(`#c3d [data-b="${btn}"]`) : null;
      if (el) el.classList.add('hint');
      this._sticky = { key, el };
    }
    this._sticky.seen = this.elapsed;
  }
  stickyOn() { return !!this._sticky; }
  stickyTick() { if (this._sticky && this.elapsed - this._sticky.seen > 0.05) this.clearSticky(); }
  clearSticky() { const S = this._sticky; if (!S) return; this._sticky = null; if (S.el) S.el.classList.remove('hint'); this.ui.hideToast(S.key); }
  hint(key, t, dur = 3, btn) {
    this.hinted = this.hinted || {};
    const n = this.hinted[key] || 0;
    if (n >= 2) return;
    this.hinted[key] = n + 1;
    this.toast(t, dur);
    if (btn) { const el = document.querySelector(`#c3d [data-b="${btn}"]`); if (el) { el.classList.add('hint'); setTimeout(() => el.classList.remove('hint'), dur * 1000); } }
  }
  clearWorldUi() { for (const el of document.querySelectorAll('#world-ui .ehp')) el.remove(); if (this._pill) this._pill.classList.add('hidden'); this.lockRing.visible = false; for (const e of this._warnEls || []) e.className = 'offwarn hidden'; $('toast').classList.remove('low'); }
  updateWorldUi() {
    const W = innerWidth, H = innerHeight, v = new THREE.Vector3();
    if (this.fight.active) {
      for (const f of this.fight.list) {
        if (!f.bar) { f.bar = document.createElement('div'); f.bar.className = 'ehp'; f.bar.innerHTML = '<i></i>'; $('world-ui').appendChild(f.bar); }
        v.copy(f.pos); v.y += 2.05; v.project(this.camera);
        const vis = !f.ko && v.z < 1 && f.npc.root.visible;
        f.bar.style.display = vis ? 'block' : 'none';
        if (vis) { f.bar.style.left = ((v.x + 1) / 2 * W) + 'px'; f.bar.style.top = ((1 - v.y) / 2 * H) + 'px'; f.bar.firstChild.style.width = (100 * f.hp / f.maxHp) + '%'; f.bar.classList.toggle('warn', f.state === 'windup'); f.bar.classList.toggle('red', f.state === 'windup' && f.kind === 'heavy'); }
      }
    }
    this.offscreenWarn();
    this.drawPill();
    this.toastDodge();
    const lt = this.hero.lockTarget || (this.inFight() && this.mode === 'play' ? this.nearestFoe() : null);
    this.lockRing.visible = !!lt && this.mode === 'play';
    if (lt) { this.lockRing.position.set(lt.pos.x, lt.pos.y + 0.05, lt.pos.z); this.lockRing.material.opacity = this.hero.lockTarget ? 0.9 : 0.45; }
  }
  // a thug about to punch from outside the picture gets a pulsing "!" arrow on that screen edge
  offscreenWarn() {
    const els = this._warnEls || (this._warnEls = [0, 1].map(() => { const e = document.createElement('div'); e.className = 'offwarn hidden'; e.innerHTML = '<b>!</b><i></i>'; $('world-ui').appendChild(e); return e; }));
    let n = 0;
    if (this.fight.active && this.mode === 'play') {
      const inv = this.camera.matrixWorldInverse, v = new THREE.Vector3(), W = innerWidth, H = innerHeight;
      for (const f of this.fight.list) {
        if (f.ko || n >= 2) continue;
        const threat = f.state === 'windup' || f.state === 'punch' || ((this.fight.token === f || this.fight.flank === f) && f.pos.distanceTo(this.hero.pos) < 3.2);
        if (!threat) continue;
        v.copy(f.pos); v.y += 1.2; v.applyMatrix4(inv);                // camera space: -z is ahead
        const behind = v.z > -0.2, k = this.camera.projectionMatrix.elements;
        const px = behind ? (v.x >= 0 ? 2 : -2) : (v.x * k[0]) / -v.z;
        if (!behind && Math.abs(px) < 0.9) continue;                   // on screen: the glow ring is enough
        const e = els[n++], side = behind && Math.abs(v.x) < 0.6 ? 'b' : px > 0 ? 'r' : 'l';
        e.className = 'offwarn ' + side + (f.state === 'windup' || f.state === 'punch' ? ' hot' : '');
        e.style.top = side === 'b' ? '' : Math.round(H * 0.5) + 'px'; e.style.left = side === 'b' ? Math.round(W * 0.5) + 'px' : '';
      }
    }
    for (let i = n; i < els.length; i++) els[i].className = 'offwarn hidden';
  }
  // keep a toast off the enemy health bars: if it would cover one, move it down to a lower slot
  toastDodge() {
    const t = $('toast');
    let low = false;
    if (this.fight.active && !t.classList.contains('hidden')) {
      const r = t.getBoundingClientRect(), h = r.height || 40, top = 58;
      for (const f of this.fight.list) {
        if (!f.bar || f.bar.style.display === 'none') continue;
        const b = f.bar.getBoundingClientRect();
        if (b.right > r.left - 6 && b.left < r.right + 6 && b.bottom > top - 6 && b.top < top + h + 6) { low = true; break; }
      }
    }
    t.classList.toggle('low', low);
  }
  nearestFoe() {
    let best = null, bd = 1e9;
    for (const f of this.fight.list) { if (f.ko) continue; const d = f.pos.distanceTo(this.hero.pos); if (d < bd) { bd = d; best = f; } }
    return bd < 9 ? best : null;
  }
  toggleLock() {
    if (this.hero.lockTarget) { this.hero.lockTarget = null; return; }
    const t = this.nearestFoe(); if (t) this.hero.lockTarget = t;
  }

  // ================================================================== shared events
  onHero(e, d) {
    const h = this.hero, p = h.pos;
    switch (e) {
      case 'jump': sfx.jump(); break;
      case 'land': sfx.land(d); this.fx.emit(p.x, p.y + 0.05, p.z, d ? 10 : 4, { speed: 2, up: 0.5, life: 0.5 }); if (d) this.cam.shake(0.25); break;
      case 'roll': sfx.land(true); this.fx.emit(p.x, p.y + 0.05, p.z, 12, { speed: 2.5, up: 0.6 }); this.cam.shake(0.2); break;
      case 'step': if (Math.random() < 0.8) sfx.step(); if (d > 7 && Math.random() < 0.4) this.fx.emit(p.x, p.y + 0.05, p.z, 1, { speed: 0.6, up: 0.3, size: 0.3, life: 0.5, alpha: 0.4 }); break;
      case 'vault': sfx.vault(); if (Math.random() < 0.45) this.voice.bark(['r1', 'r2'], 'parkour', 9); break;
      case 'climb': sfx.cloth(); break;
      case 'walljump': sfx3.wall(); this.fx.emit(p.x, p.y + 1, p.z, 6, { speed: 1.5, up: 0.3 }); this.cam.shake(0.12); break;
      case 'duck': sfx.cloth(); break;
      case 'slide': sfx3.slide(); this.fx.emit(p.x, p.y + 0.05, p.z, 8, { speed: 1.4, up: 0.4, life: 0.7 }); break;
      case 'dodge': sfx.swing(); break;
      case 'swing': sfx3.whoosh(d); break;
      case 'impact': this.heroImpact(d.attack, d.index); break;
    }
  }
  heroImpact(atk, idx) {
    const h = this.hero;
    let hits = 0;
    if (this.fight.active) hits = this.fight.heroImpact(atk, h, idx);
    // the fleeing thief in the market
    if (this.seg === 'market' && this.thiefRun && !this.thiefRun.done) {
      const t = this.npc.thief, d = t.pos.distanceTo(h.pos);
      if (d < atk.range + 0.4 && this.thiefRun.stun <= -0.9) { hits++; this.thiefHit(); }
    }
    // the football
    if (this.ball && this.ball.live && this.ball.p.distanceTo(h.pos.clone().setY(h.pos.y + 0.4)) < 2.6) { hits++; this.kickBall(); }
    if (this.m2) hits += this.m2.heroImpact(atk, h);
    if (this.m3) hits += this.m3.heroImpact(atk, h);
    if (hits) {
      const fin = !!atk.finisher;
      this.hitStop = fin ? 0.11 : 0.065;
      this.cam.shake(fin ? 0.45 : 0.28);
      sfx3.staffHit(fin);
      const f = h.pos, fy = Math.sin(h.yaw), fz = Math.cos(h.yaw);
      this.fx.emit(f.x + fy * 1.3, f.y + 1.35, f.z + fz * 1.3, fin ? 16 : 9, { color: 0xffe2a0, speed: 4.5, up: 2, life: 0.35, size: 0.14, g: 3, alpha: 1, grow: 0.2 });
      if (navigator.vibrate) try { navigator.vibrate(fin ? 30 : 15); } catch (e) {}
    }
  }
  gainMango() {
    this.mangoes = Math.min(12, this.mangoes + 1);
    if (this.stolen > 0) this.stolen--;
    sfx.mango(this.mangoes);
    this.syncHud();
  }
  dropMango(fromX, fromY, fromZ, toward, ttl = 8, spread = 2.2) {
    // a mango tumbles out of the crate and can be picked up again
    if (this.mangoes <= 0) return;
    this.mangoes--; sfx.spill();
    const a = Math.random() * 6.28;
    this.mangoesFx.spawn(fromX, fromY, fromZ, Math.cos(a) * spread + (toward ? toward.x : 0), 5, Math.sin(a) * spread + (toward ? toward.z : 0), ttl);
  }
  // round 4: every street/market hazard costs a whole heart AND spills mangoes, wider and for less time (4.5 s
  // to pick them back up, was 8): a hit is a heart, a detour and usually a mango
  hazardHit(fromX, fromZ, n = 2, heavy = true) {
    const p = this.hero.pos;
    const r = this.hurt(2, fromX, fromZ, heavy);
    if (r === 'dodged' || r === 'blocked') return r;
    for (let i = 0; i < n; i++) this.dropMango(p.x, p.y + 1.6, p.z, null, 4.5, 3.4);
    return r;
  }
  hurt(dmg, fromX, fromZ, heavy) {
    const r = this.hero.takeHit(dmg, fromX, fromZ, heavy);
    if (r === 'blocked') { sfx3.clack(); this.cam.shake(0.15); this.fx.emit(this.hero.pos.x, this.hero.pos.y + 1.9, this.hero.pos.z, 6, { color: 0xfff0c0, speed: 3, up: 1, life: 0.25, size: 0.1, alpha: 1 }); return r; }
    if (r === 'dodged') return r;
    this.hp = Math.max(0, this.hp - dmg);
    sfx3.hurt(); this.cam.shake(heavy ? 0.6 : 0.35);
    $('vig3d').classList.remove('flash'); void $('vig3d').offsetWidth; $('vig3d').classList.add('flash');
    if (Math.random() < 0.6) this.voice.bark(this.m3 ? ['r3'] : ['r3', 'r4'], 'hurt', 5);
    if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) {}
    return r;
  }

  // ================================================================== cutscene helpers
  mover(who, x, z, speed, o = {}) {
    this.movers = this.movers || [];
    this.movers = this.movers.filter((m) => m.who !== who);
    const m = { who, x, z, speed, ...o, done: false };
    this.movers.push(m);
    return new Promise((res) => { m.res = res; });
  }
  stepMovers(dt) {
    if (!this.movers || !this.movers.length) return;
    for (const m of this.movers) {
      const b = m.who.body, dx = m.x - b.pos.x, dz = m.z - b.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.05 || this.skip) {
        b.pos.x = m.x; b.pos.z = m.z; m.done = true;
        if (m.face !== undefined) m.who.yaw = m.face;
        if (!m.keep) m.who.anim.play(m.idle || (m.who === this.hero ? 'idle' : 'idle'), { loop: true, fade: 0.25 });
        m.res && m.res(); continue;
      }
      const s = Math.min(m.speed * dt, d);
      b.pos.x += dx / d * s; b.pos.z += dz / d * s;
      if (m.ground !== false) { const g = this.phys.groundAt(b.pos.x, b.pos.z, 0.2, b.pos.y + 0.5); if (g) b.pos.y = g.y; }
      const want = Math.atan2(dx, dz); let a = want - m.who.yaw; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI;
      m.who.yaw += a * Math.min(1, 10 * dt);
      const clip = m.anim || (m.speed > (m.who.gait ? m.who.gait.walk * 1.8 : 3) ? 'run' : 'walk');
      // pack characters walk at their own no-slide speed (gaitScale), the old rigs as before
      const sp = m.who === this.hero ? Math.max(0.7, Math.min(1.4, clip === 'run' ? m.speed / 6 : m.speed / 1.7)) : m.who.gaitScale ? (m.who.gait ? m.who.gaitScale(clip, m.speed) : Math.max(0.7, Math.min(1.4, m.who.gaitScale(clip, m.speed)))) : 1;
      m.who.anim.play(clip, { loop: true, speed: sp, fade: 0.2 });
      if (m.who.sync) m.who.sync();
    }
    this.movers = this.movers.filter((m) => !m.done);
  }
  faceTo(who, x, z) { who.yaw = Math.atan2(x - who.body.pos.x, z - who.body.pos.z); }
  fade(on) { $('fade3d').classList.toggle('on', on); return this.wait(on ? 0.35 : 0.1); }
  shot(o) { this.cam.setShot(o); }
  headOf(who, up = 1.6) { return () => V(who.body.pos.x, who.body.pos.y + up, who.body.pos.z); }

  // ================================================================== 1. intro
  async cutIntro() {
    const h = this.hero, N = this.npc, L = this.level.spawns, Z = PLAZA_Z, P = (x, y, z) => V(x, y, z + Z);
    this.seg = 'intro';
    h.setCarry(true); h.cine = true;
    h.place(4.05, 0, 21.2 + Z, -Math.PI / 2);
    N.driver.show(true); N.driver.place(3.2, 0, 24.6 + Z, Math.PI * 0.8);
    N.tea.show(true); N.tea.place(L.tea.x, 0, L.tea.z, 0.7);
    N.kids[0].show(true); N.kids[0].place(-12, 0, 18 + Z, 1.4);
    N.extras[0].show(true); N.extras[0].place(8.3, 0, 24 + Z, -1.2);
    N.extras[1].show(true); N.extras[1].place(-7.6, 0, 22.4 + Z, 2.0);
    this.mover(N.kids[0], 6, 8 + Z, 2.2);
    this.shot({ pos: P(-9, 6.5, 1), pos2: P(-6, 4, 8.5), look: P(3.5, 1.5, 21), look2: P(3, 1.4, 20), fov: 50, dur: 9 });
    this.mover(h, 2.8, 19.6 + Z, 1.4);
    await this.say('i1');
    this.shot({ pos: P(1.5, 1.68, 17.2), look: this.headOf(h, 1.55), fov: 40, blend: 0.6 });
    this.faceTo(h, 1.5, 17.2 + Z);
    await this.say('i2');
    this.faceTo(N.tea, h.pos.x, h.pos.z);
    this.shot({ pos: P(3.9, 2.0, 20.9), pos2: P(3.2, 1.9, 19.6), look: V(L.tea.x, 1.35, L.tea.z), fov: 44, blend: 0.8, dur: 6 });
    this.mover(h, 0.5, 16.6 + Z, 1.3);
    await this.say('i3');
    this.faceTo(N.tea, h.pos.x, h.pos.z);
    this.shot({ pos: P(-1.0, 1.62, 15.2), look: this.headOf(h, 1.55), fov: 40, blend: 0.7 });
    await this.say('i4');
    this.shot({ pos: P(-2.2, 1.68, 16.5), look: this.headOf(N.tea, 1.45), fov: 40, blend: 0.7 });
    await this.say('i5');
    // he turns to the street: the camera swings behind him, the whole street and the sunset in view
    this.mover(h, 0.6, 12.5 + Z, 1.6, { face: Math.PI });
    this.shot({ pos: P(1.6, 2.3, 19.5), pos2: P(0.6, 2.05, 16.5), look: P(0, 2.4, -60), look2: P(0.6, 2.2, -60), fov: 58, blend: 1.4, dur: 5 });
    await this.say('i6');
    await this.wait(0.3);
    N.driver.show(false); N.kids[0].show(false); N.extras[0].show(false); N.extras[1].show(false);
    this.startStreet(false);
  }

  // ================================================================== 2. street
  enterSeg(seg, fromCp) {
    const c = this.cp;
    if (this.m2) { this.m2.start(c.sub || 'start', true); return; }
    if (this.m3) { this.m3.start(c.sub || 'd1', true); return; }
    if (seg === 'street') this.startStreet(true);
    else if (seg === 'market') { this.hero.setCarry(true); this.hero.place(c.pos.x, c.pos.y, c.pos.z, c.yaw); this.cam.snapBehind(this.hero.pos, c.yaw); this.run(() => this.cutSnatch()); }
    else if (seg === 'chase') this.run(() => this.cutTokStart(true));
    else if (seg === 'fight') this.run(() => this.cutFightIntro(true));
    else if (seg === 'roofs') this.startRoofs(c.sub || 'alley');
    else if (seg === 'jetty') this.startJetty(true);
    void fromCp;
  }
  startStreet(fromCp) {
    const h = this.hero, L = this.level.spawns;
    h.cine = false; h.setCarry(true);
    if (fromCp) { h.place(L.street.x, 0, L.street.z, Math.PI); this.cam.snapBehind(h.pos, Math.PI); }
    else this.cam.release(h.pos, Math.PI);   // hand the camera back looking straight down the street
    this.npc.tea.show(true); this.npc.tea.place(L.tea.x, 0, L.tea.z, 0.7);
    if (!this.cp || this.cp.seg !== 'street') this.saveCp('street', V(L.street.x, 0, L.street.z), Math.PI);
    // round 4: five buckets (was three)
    this.street = { toks: [false, false, false, false, false], ballDone: false, kidsOn: false, thief: 0, buckets: [-110, -124, -154, -172, -181] };
    // a donkey cart working up and down the left side of the street (round 3: it was a parked cart)
    this.haz.clear(); this.haz.addCart('z', -3.4, -104, -128, 1.6, 0.05);
    for (const [i, k] of this.npc.kids.entries()) { k.show(true); k.place(L.kids[i].x, 0, L.kids[i].z, -1.2 + i); }
    this.ball.p.copy(L.ball); this.ball.v.set(0, 0, 0); this.ball.live = true; this.ball.m.visible = true; this.ball.kicked = false;
    this.play('street');
    if (!fromCp) this.toast(I3.touch ? { ar: 'الإبهام الشمال للمشي (زقّه للآخر تجري)، واسحب على اليمين للكاميرا', en: 'Left thumb moves (push it all the way to sprint), drag the right side to look' } : { ar: 'WASD للمشي، الماوس للكاميرا، Shift للجري، Space للنط، J للنبّوت', en: 'WASD move, mouse look, Shift sprint, Space jump, J or click: staff' }, 4.5);
  }
  spawnStreetTok(x, z, vx, vz, tint) {
    const t = { tok: makeTok(this.scene, tint), x, z, vx, vz, honk: false, hit: false };
    t.tok.root.rotation.y = Math.atan2(vx, vz);
    this.streetToks.push(t); return t;
  }
  stepStreetToks(dt) {
    const h = this.hero, hp = h.pos;
    for (let i = this.streetToks.length - 1; i >= 0; i--) {
      const t = this.streetToks[i];
      const d = Math.hypot(t.x - hp.x, t.z - hp.z);
      // round 4: drivers no longer slow down for him (round 3: 0.92 inside 10 m); the horn and the hint still warn
      const k = 1;
      t.x += t.vx * dt * k; t.z += t.vz * dt * k;
      if (t.turn && t.z <= t.turn.z) { t.vx = t.turn.vx; t.vz = 0; t.xEnd = t.turn.xEnd; t.turn = null; t.tok.root.rotation.y = Math.atan2(t.vx, t.vz); }
      t.tok.root.position.set(t.x, 0, t.z);
      t.tok.lean.position.y = Math.abs(Math.sin(t.z * 1.7 + t.x)) * 0.03;
      if (!t.honk && d < 16) { t.honk = true; sfx.horn(); this.voice.bark(['s1', 's2'], 'tok', 6); if (this.streetHint !== 'tok' && !this.stickyOn()) { this.streetHint = 'tok'; this.hint('tok', { ar: 'توك توك جاي! اتفادى على جنب', en: 'Tok-tok coming! Step aside' }, 2.2); } }
      // collision: oriented box vs the hero cylinder
      const yaw = Math.atan2(t.vx, t.vz), c = Math.cos(yaw), s = Math.sin(yaw);
      const lx = (hp.x - t.x) * c - (hp.z - t.z) * s, lz = (hp.x - t.x) * s + (hp.z - t.z) * c;
      if (!t.hit && Math.abs(lx) < 0.68 + 0.3 && Math.abs(lz) < 1.35 + 0.3 && hp.y < 1.5 && h.state !== 'vault') {
        t.hit = true;
        this.hazardHit(t.x, t.z, 2); this.log('tok hit', { hp: this.hp, z: Math.round(hp.z) });
        this.fx.emit(hp.x, 0.5, hp.z, 14, { speed: 3, up: 1.5 });
        sfx3.bump();
      }
      const bz = this.level.spawns.marks.barrier - 1.2; // a tok-tok coming up from the market stops at the barrier
      if ((t.vz < 0 && t.z < hp.z - 30) || (t.vz >= 0 && t.z > hp.z + 30) || Math.abs(t.x) > 40 || (t.xEnd && t.x > t.xEnd) || t.z > PLAZA_Z - 2 && t.vz > 0 && t.z > hp.z + 10 || (t.vz > 0 && t.z > bz && t.z0 < bz)) { this.scene.remove(t.tok.root); this.streetToks.splice(i, 1); }
    }
  }
  segStep(dt, I) {
    if (this.m2) { this.m2.step(dt, I); this.stickyTick(); return; }
    if (this.m3) { this.m3.step(dt, I); return; }
    const h = this.hero, z = h.pos.z;
    if (this.seg === 'street') {
      const S = this.street, M = this.level.spawns.marks;
      // one head-on tok-tok, one crossing at the side alley, one coming out of the market after the barrier
      if (!S.toks[0] && z < PLAZA_Z - 6) { S.toks[0] = true; this.spawnStreetTok(-0.6, M.wall + 6, 0, 6.5); }
      if (!S.toks[1] && z < PLAZA_Z + 6) { S.toks[1] = true; const t = this.spawnStreetTok(30, M.cross, -9, 0, 0xffd07a); t.z0 = M.cross; }
      if (!S.toks[2] && z < M.barrier - 1.5) { S.toks[2] = true; const t = this.spawnStreetTok(-1.2, -205, 0, 7, 0xa0e0a0); t.z0 = -205; }
      // round 3: a second tok-tok through the side-alley crossing right behind the first (other lane), and one
      // that comes up fast from behind (he hears it honk) and turns off into the kids' square
      if (S.toks[1] && !S.toks[3] && (S.crossT = (S.crossT || 0) + dt) > 2.3) { S.toks[3] = true; const t = this.spawnStreetTok(30, M.cross - 1.6, -8.5, 0, 0xb0a0ff); t.z0 = M.cross; }
      if (!S.toks[4] && z < M.cross + 3) { S.toks[4] = true; const t = this.spawnStreetTok(1.5, z + 9, 0, -12, 0xff9a9a); t.turn = { z: -113.5, vx: 8, xEnd: 14 }; }
      // water from a balcony: a ring where he is heading, then the splash
      if (S.buckets.length && z < S.buckets[0]) {
        S.buckets.shift();
        // aimed where he will be (at most 5 m ahead), 1.05 s of warning
        const v = h.body.vel, lead = Math.min(1, 5 / (Math.hypot(v.x, v.z) * 1.05 + 1e-3)) * 1.05;
        this.haz.bucket(THREE.MathUtils.clamp(h.pos.x + v.x * lead, -4.3, 4.3), h.pos.z + v.z * lead, 1.05);
        this.hint('bucket', { ar: 'حاسب! حد بيدلق مية من البلكونة', en: 'Look out! Someone is emptying a bucket from a balcony' }, 2);
      }
      this.haz.step(dt);
      this.stepStreetToks(dt);
      this.kidsStep(dt);
      this.thiefGlimpse(dt);
      // obstacle hints stay up from 9 m before the obstacle until he is past it
      for (const L of this.level.laundry) if (L.z < PLAZA_Z && L.z > -190 && z - L.z < 9 && z - L.z > -0.4 && h.pos.y < 1) this.stickyHint('laundry', { ar: 'غسيل واطي! اتزحلق تحته (أو امشي عليه وهتوطّي)', en: I3.touch ? 'Low laundry! Slide button, or just walk into it and he ducks' : 'Low laundry! Slide (Ctrl or C), or just walk into it and he ducks' }, 'slide');
      for (const w of h.body.walls) if (w.box.kind === 'laundry' && !w.box.barked) { w.box.barked = true; this.voice.bark('s5', 'laundry', 10); }
      if (z < M.wall + 9 && z > M.wall + 0.5 && h.pos.y < 0.5) this.stickyHint('vault', { ar: 'اجري ونُط عشان تعدّي من فوق السور الواطي', en: 'Run and jump to vault the low wall' }, 'jump');
      if (z < M.barrier + 9 && z > M.barrier + 0.5 && h.pos.y < 1.5) this.stickyHint('climb', { ar: 'اجري على الحاجز ونُط... هتطلع عليه', en: 'Run at the barrier and jump to climb it' }, 'jump');
      if (z < -186) { this.street = null; this.clearSticky(); this.haz.clear(); for (const t of this.streetToks) this.scene.remove(t.tok.root); this.streetToks = []; for (const k of this.npc.kids) k.show(false); this.ball.live = false; this.ball.m.visible = false; this.npc.tea.show(false); this.npc.thief.show(false); this.run(() => this.cutSnatch()); }
    } else if (this.seg === 'market') this.marketStep(dt);
    else if (this.seg === 'roofs') this.roofsStep(dt);
    else if (this.seg === 'jetty') this.jettyStep(dt);
    else if (this.seg === 'fight') { /* driven by Fight + onFight */ }
    this.stickyTick();
  }
  // the thief, seen early: he watches Radwan's crate from the side alley, then slips away (pays off at the gate)
  thiefGlimpse() {
    const S = this.street, T = this.npc.thief, h = this.hero, M = this.level.spawns.marks;
    if (S.thief === 0 && h.pos.z < PLAZA_Z + 4) { S.thief = 1; T.show(true); T.place(-8.4, 0, M.cross + 2.3, Math.PI / 2); T.anim.play('idle', { loop: true }); }
    if (S.thief === 1 && h.pos.z < M.cross + 5) { S.thief = 2; this.mover(T, -27, M.cross + 2.3, 6.2).then(() => { if (this.seg === 'street') T.show(false); }); }
  }
  kidsStep(dt) {
    const S = this.street, h = this.hero, b = this.ball, K = this.npc.kids;
    // kids jog around the ball
    K.forEach((k, i) => {
      if (!k.active) return;
      const tx = b.live && !b.kicked ? b.p.x + Math.cos(i * 2.1 + this.elapsed) * 1.6 : 9 + i * 1.5, tz = b.live && !b.kicked ? b.p.z + Math.sin(i * 2.1 + this.elapsed) * 1.6 : this.level.spawns.kids[0].z - 1 - i * 3;
      const d = k.steer(dt, tx, tz, 2.2);
      k.move(dt, false); k.locoAnim(d > 0.3 ? 2 : 0);
      if (d < 0.3 || b.kicked) k.yaw += ((Math.atan2(h.pos.x - k.pos.x, h.pos.z - k.pos.z) - k.yaw + 9.42) % 6.28 - 3.14) * Math.min(1, 3 * dt);
    });
    // they kick the ball to him when he passes
    const L = this.level.spawns;
    if (b.live && !b.kicked && h.pos.z < L.ball.z + 11 && h.pos.z > L.ball.z - 3) {
      b.kicked = true;
      const dx = h.pos.x - b.p.x + 0.5, dz = h.pos.z - 4 - b.p.z, d = Math.hypot(dx, dz);
      b.v.set(dx / d * 9, 3.2, dz / d * 9);
      sfx.kick(); this.voice.say('s3', 2);
      this.hint('ball', { ar: 'الكورة جاية! اضربها بالنبّوت', en: 'Here comes the ball! Whack it with the staff' }, 2.4, 'attack');
    }
  }
  kickBall() {
    const b = this.ball; if (b.scored) return;
    b.scored = true;
    // back to the kids' goal (two stones)
    const G = this.level.spawns.goal, dx = G.x - b.p.x, dz = G.z - b.p.z, d = Math.hypot(dx, dz);
    b.v.set(dx / d * 13, 4.2, dz / d * 13);
    sfx.kick();
    setTimeout(() => { if (this.seg === 'street') { this.voice.say('s4', 2); sfx3.cheer(); } }, 650);
  }
  updateBall(dt) {
    const b = this.ball;
    if (!b.live) return;
    b.v.y -= 16 * dt; b.p.addScaledVector(b.v, dt);
    if (b.p.y < 0.17) { b.p.y = 0.17; if (Math.abs(b.v.y) > 1.5) { b.v.y = -b.v.y * 0.55; sfx.bump(); } else b.v.y = 0; b.v.x *= 0.985; b.v.z *= 0.985; }
    // bounce off the hero
    const h = this.hero.pos;
    if (Math.hypot(b.p.x - h.x, b.p.z - h.z) < 0.55 && b.p.y < h.y + 1.8) { const dx = b.p.x - h.x, dz = b.p.z - h.z, d = Math.hypot(dx, dz) || 1; b.v.x = dx / d * 3; b.v.z = dz / d * 3; b.v.y = 2; }
    b.m.position.copy(b.p); b.m.rotation.x += b.v.z * dt * 5; b.m.rotation.z -= b.v.x * dt * 5;
    if (Math.abs(b.p.x) > 16) b.v.x *= -0.5;
  }

  // ================================================================== 3. snatch + market chase
  async cutSnatch() {
    const h = this.hero, T = this.npc.thief, L = this.level;
    this.seg = 'snatch';
    h.cine = true; h.setCarry(true);
    if (h.pos.z > -186) h.place(0, 0, -186.5, Math.PI);
    h.body.vel.set(0, 0, 0);
    this.saveCp('market', V(0, 0, -183), Math.PI);
    this.mangoes = this.cp.mangoes = Math.max(this.mangoes, 1);
    this.mover(h, 0.2, -191, 2.2, { face: Math.PI });
    T.show(true); T.place(-6.6, 0, -199, 0.6);
    this.shot({ pos: V(2.6, 1.6, -194.5), look: this.headOf(h, 1.5), fov: 44, blend: 0.6 });
    await this.say('m1');
    // the thief sprints in from the left lane and grabs from the crate
    this.shot({ pos: V(-3.5, 1.2, -189.2), look: V(-0.6, 1.3, -192.5), fov: 46, blend: 0.4 });
    await this.mover(T, -0.75, -191.6, 7.5, { face: Math.PI / 2 });
    T.anim.play('punch', { fade: 0.05, speed: 1.4 });
    await this.wait(0.35);
    const before = this.mangoes, take = Math.max(0, Math.min(8, this.mangoes - 2));
    this.stolen = take; this.mangoes -= take;
    this.log('snatch', { took: take, left: this.mangoes });
    sfx.spill(); this.fx.emit(h.pos.x - 0.4, 2.0, h.pos.z, 12, { color: 0xffb030, speed: 2, up: 2, size: 0.18, life: 0.6 });
    this.cam.shake(0.3);
    void before;
    const run = this.mover(T, -6.3, -201, 7.2);
    this.voice.say('m2', 3);
    this.faceTo(h, -6.3, -201);
    await this.wait(0.6);
    this.shot({ pos: V(1.2, 2.0, -187.5), look: V(-5, 1.2, -201), fov: 52, blend: 0.4 });
    await run;
    if (!this.skip) await this.wait(0.3);
    await this.say('m3');
    T.place(-6.3, 0, -201, Math.PI);
    h.cine = false;
    this.startMarket();
  }
  startMarket() {
    const T = this.npc.thief, L = this.level, h = this.hero;
    this.cam.release(h.pos, h.yaw);
    const path = [V(T.pos.x, 0, T.pos.z), ...L.thiefPath.slice(1)];
    this.thiefRun = { path, i: 1, stun: -1, done: false, hits: 0, taunt: 0, drops: 0, farT: 0, shouts: 0 };
    T.body.h = 0.95;   // he ducks under the hanging cloths of the cut-throughs without slowing down
    this.makeCrowd();
    this.goat.pos.copy(L.spawns.goat); this.goat.yaw = 0; this.goat.speed = 0; this.goatState = 'wait';
    this.goatBox = this.goatBox || this.phys.add(0, 0, 0, 0.1, 0.1, 0.1, { dynamic: true, kind: 'goat', vault: true });
    this.goatBox.on = true;
    this.hero.targets = [{ pos: T.pos, hittable: () => !this.thiefRun.done }];
    // round 3: donkey carts working the lanes on the thief's route, on the side of the lane he does not use
    this.haz.clear();
    this.haz.addCart('z', 7.55, -229, -247, 1.5, 0.35); this.haz.addCart('z', -7.55, -251, -269, 1.5, 0.7); this.haz.addCart('z', 1.2, -275, -294, 1.7, 0.15);
    this.play('market');
    setTimeout(() => this.voice.say('m4', 2), 400);
  }
  thiefHit() {
    const R = this.thiefRun, T = this.npc.thief;
    R.stun = 0.6; R.hits++; R.limp = 1.6;
    T.anim.play('hit_react', { fade: 0.04, restart: true });
    // the first two good hits shake two mangoes each out of his bag; after that he just stumbles and runs
    const n = R.drops < 2 ? Math.min(2, this.stolen) : 0;
    if (n) { R.drops++; this.voice.bark(R.drops === 1 ? 'c2' : ['c2', 'c4'], 'thiefhit', 1.5, 2); }
    else this.voice.bark(['c4', 'c3'], 'thiefhit', 3, 1);
    for (let i = 0; i < n; i++) {
      const dx = this.hero.pos.x - T.pos.x, dz = this.hero.pos.z - T.pos.z, d = Math.hypot(dx, dz) || 1;
      this.mangoesFx.spawn(T.pos.x, 1.4, T.pos.z, dx / d * 1.5 + (i ? 1.2 : -1.2), 5, dz / d * 1.5, 9);
    }
    this.log('thief hit', { hits: R.hits, stolen: this.stolen });
  }
  marketStep(dt) {
    const R = this.thiefRun, T = this.npc.thief, h = this.hero;
    if (!R || R.done) return;
    const d = T.pos.distanceTo(h.pos);
    R.stun -= dt;
    if (d < 4.5 && R.stun <= 0) this.hint('hitThief', { ar: 'قرّبت! اضربه بالنبّوت', en: 'Close! Whack him with the staff' }, 2, 'attack');
    for (const c of this.level.cloths) if (Math.abs(h.pos.z - c.z) < 2.2 && Math.abs(h.pos.x - c.x) < 5 && Math.abs(h.pos.x - c.x) > 0.3 && h.body.vel.x * (c.x - h.pos.x) > 0) this.stickyHint('cloth', { ar: 'قماشة واطية! اتزحلق تحتها', en: 'Low cloth! Slide under it' }, 'slide');
    if (R.stun > 0) { T.body.vel.x *= 0.85; T.body.vel.z *= 0.85; T.move(dt, true); }
    else {
      const tgt = R.path[R.i];
      // he looks back and taunts when far, bursts when you are on him, limps for a while after a hit
      // round 3: faster, and less waiting for a slow Radwan (was 6.3 / 4.4 far / 7.0 close / limp 5.2 for 2.5 s)
      // round 4: he never waits; faster than Radwan's run (6.2), slower than his sprint (8.8), so it takes the
      // sprint and a clean line through the crowd to stay on him
      let sp = 7.0;
      if (d > 14) { if ((R.taunt -= dt) <= 0) { R.taunt = 6; this.voice.bark('c1', 'taunt', 5); } }
      else if (d < 4) sp = 7.8;
      R.limp = Math.max(0, (R.limp || 0) - dt);
      if (R.limp > 0) sp = Math.min(sp, 5.8);
      if (R.drops >= 2 && R.limp <= 0) sp = Math.max(sp, 7.3);
      const rem = T.steer(dt, tgt.x, tgt.z, sp, 12);
      T.move(dt, true);
      T.locoAnim(sp);
      if (rem < 1.0) { R.i++; if (R.i % 4 === 0 && d < 9) this.voice.bark('c3', 'make way', 6); }
      if (R.i >= R.path.length) { R.done = true; this.goatBox.on = false; this.haz.clear(); this.endCrowd(); T.body.h = 1.7; this.clearWorldUi(); this.run(() => this.cutTokStart(false)); return; }
    }
    this.haz.step(dt);
    this.crowdStep(dt, d);
    // round 4: he loses you in the crowd: more than 20 m behind him for 3 s and he is gone
    if (!R.done) {
      R.farT = d > 20 ? R.farT + dt : Math.max(0, R.farT - dt * 2);
      this.thiefPill(T.pos, d, 14, 20, R.farT / 3);
      if (R.farT > 3) { this.voice.say('x2', 2); this.fail('lost'); return; }
    }
    // the goat strolls across the middle lane as he gets close
    if (this.goatState === 'wait' && h.pos.z < -226) { this.goatState = 'walk'; this.goat.speed = 1; sfx.bleat(); }
    if (this.goatState === 'walk') {
      const G = this.goat; G.pos.x += 1.3 * dt; G.yaw = Math.PI / 2;
      if (G.pos.x > 7) { this.goatState = 'stand'; G.speed = 0; }
      this.goatBox.x0 = G.pos.x - 0.55; this.goatBox.x1 = G.pos.x + 0.55; this.goatBox.z0 = G.pos.z - 0.3; this.goatBox.z1 = G.pos.z + 0.3; this.goatBox.y0 = 0; this.goatBox.y1 = 0.95;
    }
    if (h.body.walls.some((w) => w.box.kind === 'goat') || (h.state === 'vault' && h.vault.box.kind === 'goat')) { this.voice.bark('c5', 'goat', 12, 2); sfx.bleat(); }
  }

  // ------------------------------------------------------------------ round 4: the market crowd
  // Shoppers stand in the lanes on the thief's route. He gets through (they step aside for him and step back
  // into the lane after him); Radwan shoulders into them and stumbles. Twice, when Radwan is right behind him,
  // the thief shouts "thief!" at Radwan and the next shoppers ahead step into the middle of the lane.
  makeCrowd() {
    const S = this.npc.shoppers, E = this.npc.extras, K = this.npc.kids;
    const spots = [[S[0], -5.5, -208.0, -6.35], [S[1], -7.25, -210.8, -6.35], [E[0], -0.95, -219.2, 0], [E[1], 0.2, -224.0, 0],
      [S[2], 5.0, -236.5, 6.35], [K[1], -4.95, -258.5, -6.35], [K[2], -1.75, -283, 0]];
    this.crowd = spots.map(([n, x, z, lane], i) => {
      n.show(true); const side = Math.sign(x - lane) || 1;
      n.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });   // mobile budget: no shadow pass for the crowd
      n.place(x, 0, z, side > 0 ? Math.PI / 2 : -Math.PI / 2); n.fighting = true;   // stepped here, not by the shared loop
      return { n, hx: x, hz: z, lane, side, st: 'idle', t: Math.random() * 3, bumpT: 0, i };
    });
  }
  endCrowd() { for (const c of this.crowd || []) { c.n.fighting = false; c.n.show(false); c.n.root.traverse((o) => { if (o.isMesh) o.castShadow = true; }); } this.crowd = null; }
  crowdStep(dt, dThief) {
    const C = this.crowd; if (!C) return;
    const h = this.hero, hp = h.pos, T = this.npc.thief, R = this.thiefRun;
    // the thief points at Radwan and shouts when Radwan is on his heels (twice, a few seconds apart)
    if (R && dThief < 5 && R.shouts < 2 && this.elapsed - (R.shoutAt || -99) > 6) {
      R.shouts++; R.shoutAt = this.elapsed; this.voice.say('c6', 2);
      for (const c of C) if (c.hz < hp.z - 4 && c.hz > hp.z - 26 && c.st === 'idle') { c.st = 'block'; c.t = 0; }
    }
    for (const c of C) {
      const n = c.n; c.t += dt; c.bumpT -= dt;
      // mobile budget: only the shoppers near him are drawn (each is a full skinned townsperson)
      const near = n.pos.z > hp.z - 40 && n.pos.z < hp.z + 8;
      if (n.root.visible !== near) n.root.visible = near;
      let tx = c.hx + Math.sin(c.t * 0.7 + c.i) * 0.22, tz = c.hz + Math.cos(c.t * 0.5 + c.i * 2) * 0.3, sp = 0.6;
      if (c.st === 'idle' && T.pos.distanceTo(n.pos) < 3.2 && T.pos.z > n.pos.z - 1) { c.st = 'aside'; c.t = 0; }
      if (c.st === 'aside') { tx = c.hx + c.side * 1.05; sp = 2.6; if (c.t > 1.1) { c.st = 'idle'; c.t = 0; } }
      if (c.st === 'block') { tx = c.lane + c.side * 0.35; tz = c.hz; sp = 1.9; if (c.t > 3.2) { c.st = 'idle'; c.t = 0; } }
      if (c.st === 'idle' && Math.abs(n.pos.x - c.hx) > 0.4) sp = 1.5;   // stepping back into his spot
      if (c.st === 'bumped') { sp = 0; if (c.t > 0.5) { c.st = 'idle'; c.t = 0; } }
      const rem = c.st === 'bumped' ? 0 : n.steer(dt, tx, tz, sp, 6);
      if (c.st !== 'bumped') n.move(dt, false);
      else { n.body.vel.multiplyScalar(Math.max(0, 1 - 6 * dt)); n.move(dt, false); }
      if (rem < 0.15 && c.st !== 'bumped') { const want = c.side > 0 ? Math.PI / 2 : -Math.PI / 2; let a = want - n.yaw; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; n.yaw += a * Math.min(1, 3 * dt); }
      if (c.st !== 'bumped') n.locoAnim(rem > 0.15 ? sp : 0);
      n.update(dt);
      // Radwan shoulders into a shopper: no damage, but he stumbles (a slide gets under and past)
      const dx = hp.x - n.pos.x, dz = hp.z - n.pos.z, dd = Math.hypot(dx, dz);
      if (c.bumpT <= 0 && dd < 0.32 + n.body.r && hp.y < 1 && Math.hypot(h.body.vel.x, h.body.vel.z) > 2.5 && h.stumble(0.55)) {
        c.bumpT = 1.4; c.st = 'bumped'; c.t = 0;
        n.body.vel.set(-dx / (dd || 1) * 1.6, 0, -dz / (dd || 1) * 1.6);
        n.anim.play('hit_react', { fade: 0.05, restart: true });
        sfx3.bump(); this.cam.shake(0.12); this.voice.bark(['r5'], 'crowd', 3.5, 1);
        this.stats.bumps = (this.stats.bumps || 0) + 1;
        this.hint('crowd', { ar: 'الزحمة بتعطّلك! لف من جنبهم أو اتزحلق', en: 'The crowd slows you down! Go round them, or slide' }, 2.4, 'slide');
      }
    }
  }
  // a tag over the thief: how far ahead he is, red and pulsing when he is about to get away
  // (the simulation asks for it every step; it is drawn once per rendered frame in drawPill)
  thiefPill(pos, d, showAt, maxAt, danger, label) { this._pillWant = { pos: { x: pos.x, y: pos.y || 0, z: pos.z }, d, showAt, maxAt, danger, label, at: this.elapsed }; }
  drawPill() {
    let el = this._pill;
    if (!el) { el = this._pill = document.createElement('div'); el.className = 'tpill hidden'; $('world-ui').appendChild(el); }
    const P = this._pillWant;
    if (!P || this.elapsed - P.at > 0.1 || P.d < P.showAt || this.mode !== 'play') { el.classList.add('hidden'); return; }
    const { pos, d, maxAt, danger, label } = P;
    const v = new THREE.Vector3(pos.x, (pos.y || 0) + 2.3, pos.z).project(this.camera);
    const W = innerWidth, H = innerHeight, behind = v.z > 1;
    const x = THREE.MathUtils.clamp(((behind ? -v.x : v.x) + 1) / 2 * W, 40, W - 40), y = THREE.MathUtils.clamp((1 - v.y) / 2 * H, 70, H - 90);
    el.style.left = x + 'px'; el.style.top = (behind ? 70 : y) + 'px';
    el.className = 'tpill' + (label ? ' bird' : '') + (d > maxAt * 0.85 ? ' far' : '') + (danger > 0 ? ' hot' : '');
    const txt = (label ? label + ' · ' : '') + num(Math.round(d)) + ' م' + (danger > 0 ? (this.m3 ? ' · بسرعة!' : label ? ' · هتطير!' : ' · هيهرب!') : '');
    if (el._t !== txt) { el._t = txt; el.textContent = txt; }
  }

  // ================================================================== 4. tok-tok chase
  async cutTokStart(fromCp) {
    const h = this.hero, T = this.npc.thief, D = this.npc.tokDriver, C = this.chase, L = this.level.spawns;
    this.seg = 'tokstart';
    C.park();
    T.show(true); D.show(true);
    if (fromCp) { T.place(1.6, 0, -314, Math.PI); h.place(-2, 0, -309, Math.PI); }
    h.cine = true; h.setCarry(true);
    // the thief hops into the tok-tok and roars off
    this.shot({ pos: V(-4.5, 2.2, -306), look: V(1.8, 1, -318), fov: 50, blend: 0.6 });
    await this.mover(T, 1.9, -317.2, 6);
    T.anim.play('idle', { loop: true });
    this.thiefSeated = true;
    C.thief.v = 0.1;
    this.cutStep = (dt) => { C.thief.v = Math.min(9, C.thief.v + 6 * dt); C.thief.s += C.thief.v * dt; C.place(C.thief); this.seatRiders(); };
    await this.say('t1');
    await this.fade(true);
    this.cutStep = null;
    C.thief.s = 26; C.place(C.thief); this.seatRiders();
    h.place(-3.9, 0, -315.5, Math.PI);
    D.place(-3.4, 0, -319.2, -0.4);
    this.saveCp('chase', V(-3.9, 0, -315.5), Math.PI);
    this.shot({ pos: V(-6.5, 1.65, -313), look: V(-3.6, 1.45, -317), fov: 44, blend: 0 });
    await this.fade(false);
    this.faceTo(h, D.pos.x, D.pos.z);
    await this.say('t2');
    this.shot({ pos: V(-1.6, 1.6, -318), look: this.headOf(D, 1.45), fov: 40, blend: 0.5 });
    await this.say('t3');
    // into the tok-tok
    h.ride = true; this.driverSeated = true;
    C.start(fromCp);
    C.thief.s = 26;
    this.seatRiders();
    this.cam.shot = null;
    this.cam.snapBehind(V(C.player.x, 0, C.player.z), C.player.yaw);
    this.cam.mode = 'vehicle';
    this.engine.start();
    this.play('chase');
    this.hint('boost', { ar: 'خبّط في توكتوك الحرامي... زرار النبّوت = بوست', en: I3.touch ? 'Ram his tok-tok! Staff button = boost' : 'Ram his tok-tok! Shift or Space = boost' }, 3.2, 'attack');
  }
  seatRiders() {
    const C = this.chase, h = this.hero, P = C.player, T = C.thief;
    if (h.ride) { const s = C.seat(P, 0.25, -0.62); h.body.pos.copy(s); h.yaw = P.yaw; h.anim.play('idle', { loop: true }); }
    if (this.thiefSeated) { const s = C.seat(T, 0.25, -0.58); const n = this.npc.thief; n.body.pos.copy(s); n.yaw = T.yaw; n.sync(); }
    if (this.driverSeated) { const s = C.seat(P, -0.75, -0.55, 0.25); const n = this.npc.tokDriver; n.body.pos.copy(s); n.yaw = P.yaw; n.sync(); }
  }
  onChase(e, P, o) {
    const C = this.chase;
    if (e === 'wall') { sfx3.scrape(); this.cam.shake(0.2); this.fx.emit(P.x, 0.3, P.z, 6, { color: 0xffd080, speed: 3, up: 1, size: 0.08, life: 0.3, alpha: 1 }); }
    // round 3: a crash cost half a heart and maybe a mango; round 4: a whole heart and a mango onto the road,
    // every time (at chase speed it is gone)
    if (e === 'crash') {
      sfx3.crash(); this.cam.shake(0.6); this.fx.emit(P.x, 0.6, P.z, 16, { speed: 3, up: 1.5 }); this.voice.bark(['t6'], 'tokcrash', 7, 2);
      this.hp = Math.max(0, this.hp - 2); $('vig3d').classList.remove('flash'); void $('vig3d').offsetWidth; $('vig3d').classList.add('flash');
      if (this.mangoes > 0) { this.mangoes--; sfx.spill(); this.mangoesFx.spawn(P.x, 1.4, P.z, (Math.random() - 0.5) * 3, 4, (Math.random() - 0.5) * 3, 3); }
      this.stats.crashes = (this.stats.crashes || 0) + 1;
      this.log('chase crash', { s: Math.round(P.s), hp: this.hp });
    }
    if (e === 'brake') { sfx.horn(); this.hint('brake', { ar: 'بيدوس فرامل! خبطه من الجنب، مش من ورا', en: 'He brakes! Ram him from the side, not from behind' }, 2.4); }
    if (e === 'rear') this.voice.bark('t5', 'rear', 4, 1);
    if (e === 'bump') {
      sfx3.bump(); this.cam.shake(0.4); this.hitStop = 0.05;
      const T = C.thief;
      if (this.stolen > 0 && T.drops < 4) {
        T.drops++;
        // a mango pops out of his bag and lands in Radwan's tok-tok
        const m = this.mangoesFx.spawn(T.x, 1.7, T.z, (P.x - T.x) * 1.6, 5.5, (P.z - T.z) * 1.6, 0.75);
        m.noCollect = true;
        setTimeout(() => { if (this.seg === 'chase') this.gainMango(); }, 600);
      }
      this.voice.bark(T.drops === 1 ? 't5' : ['t4', 't5'], 'bump', 3.5, 2);
      this.log('bump', { drops: T.drops, stolen: this.stolen });
    }
    if (e === 'end') this.run(() => this.cutCrash());
    if (e === 'escaped') { this.voice.say('x1', 2); this.fail('escaped'); }
  }
  async cutCrash() {
    const C = this.chase, T = C.thief, P = C.player, h = this.hero, N = this.npc, L = this.level.spawns;
    this.seg = 'crash';
    // freeze player control, keep both rolling: thief swerves into the fruit cart at the alley mouth
    const cart = this.crashCart, cp = L.crashCart;
    this.shot({ pos: V(-5.5, 1.4, -873), look: V(cp.x, 0.8, cp.z), fov: 50, blend: 0.4 });
    let hit = false, roll = 0, tSince = 0;
    this.cutStep = (dt) => {
      // thief: straight at the cart
      if (!hit) {
        const dx = cp.x - T.x, dz = cp.z - T.z, d = Math.hypot(dx, dz);
        T.yaw = Math.atan2(dx, dz); T.x += dx / d * 13 * dt; T.z += dz / d * 13 * dt;
        T.tok.root.position.set(T.x, 0, T.z); T.tok.root.rotation.y = T.yaw;
        if (d < 1.6) {
          hit = true; sfx3.crash(); this.cam.shake(0.8); this.hitStop = 0.12;
          this.fx.emit(cp.x, 0.9, cp.z, 40, { color: 0xffa020, speed: 6, up: 5, size: 0.2, life: 1.2, g: 12, drag: 0.5, alpha: 1 });
          this.fx.emit(cp.x, 0.6, cp.z, 20, { speed: 3, up: 2, life: 1.0 });
        }
      } else {
        tSince += dt;
        roll = Math.min(1.45, roll + dt * 4);
        T.tok.lean.rotation.z = roll;
        T.x += Math.sin(T.yaw) * Math.max(0, 4 - tSince * 6) * dt; T.z += Math.cos(T.yaw) * Math.max(0, 4 - tSince * 6) * dt;
        T.tok.root.position.set(T.x, 0, T.z);
        cart.rotation.z = Math.min(1.5, cart.rotation.z + dt * 5); cart.position.y = Math.sin(Math.min(1, tSince * 3) * Math.PI) * 0.4;
      }
      // the player tok-tok brakes
      P.v = Math.max(0, P.v - 9 * dt); P.s += P.v * dt; C.place(P); this.seatRiders();
      if (this.thiefSeated) { const n = N.thief; n.body.pos.set(T.x, 0.2, T.z); n.yaw = T.yaw; n.sync(); }
    };
    this.voice.say('t7', 3);
    await this.wait(1.6);
    // he crawls out and legs it into the alley
    this.thiefSeated = false;
    N.thief.place(T.x - 0.8, 0, T.z - 0.6, Math.PI);
    this.mover(N.thief, 0, -899, 6.5);
    await this.wait(1.4);
    this.cutStep = null;
    this.engine.stop();
    await this.fade(true);
    C.stop(); C.hide(); T.tok.root.visible = true; P.tok.root.visible = true;
    h.ride = false; this.driverSeated = false; N.tokDriver.show(false);
    this.cutFightIntro(false, true);
  }

  // ================================================================== 5. alley fight
  async cutFightIntro(fromCp, chained) {
    const h = this.hero, N = this.npc, L = this.level.spawns;
    if (!chained) { this.mode = 'cut'; }
    this.seg = 'fightintro';
    h.cine = true; h.ride = false; h.setCarry(true); h.body.h = 1.75;
    this.crashCart.rotation.z = 1.5; this.crashCart.position.y = 0;
    h.place(0.6, 0, -884, Math.PI);
    this.saveCp('fight', V(0.6, 0, -884), Math.PI);
    this.cp.mangoes = this.mangoes; this.cp.stolen = this.stolen;
    N.thief.show(true); N.thief.place(0, 0, -899, 0);
    N.buddyA.show(true); N.buddyA.place(L.buddyA.x - 1.2, 0, L.buddyA.z, Math.PI / 2);
    N.buddyB.show(true); N.buddyB.place(L.buddyB.x + 1.2, 0, L.buddyB.z, -Math.PI / 2);
    N.buddyC.show(true); N.buddyC.place(-0.6, 0, -907.5, 0); N.buddyC.anim.play('idle', { loop: true });
    this.shot({ pos: V(1.6, 1.7, -885), look: V(0, 1.3, -899), fov: 46, blend: 0 });
    if (chained) await this.fade(false);
    this.mover(h, 0.2, -889.5, 1.6, { face: Math.PI });
    this.mover(N.thief, 0, -897, 1.2, { face: 0 });
    await this.say('f1');
    this.mover(N.buddyA, -1.8, -896, 1.6, { face: 0.4 });
    this.mover(N.buddyB, 1.9, -897.5, 1.6, { face: -0.4 });
    this.shot({ pos: V(-2.2, 1.3, -892.4), look: this.headOf(N.buddyA, 1.45), fov: 42, blend: 0.6 });
    N.buddyC.anim.play('taunt', { fade: 0.15 });
    await this.say('f2');
    // Radwan sets the crate down against the wall and squares up
    this.shot({ pos: V(0, 1.75, -893.5), look: this.headOf(h, 1.5), fov: 44, blend: 0.6 });
    await this.mover(h, 2.6, -889.2, 1.6);
    h.setCarry(false);
    this.worldCrate.position.set(L.crateDrop.x, 0, L.crateDrop.z); this.worldCrate.rotation.y = 0.4; this.worldCrate.visible = true;
    await this.mover(h, 0.4, -891.2, 1.6, { face: Math.PI });
    h.anim.play('tahtib_ready', { loop: true, fade: 0.2 });
    await this.say('f3');
    h.cine = false;
    this.cam.release(h.pos, h.yaw);
    this.fightTries++; this.fightHurt = 0;
    const F = this.fight;
    // round 4: 14/11/11 hits (round 3: 12/9/9), and a third pal (9 hits) who waits at the back of the alley and
    // steps in when the first of the others goes down (never more than three on their feet)
    if (!this.fighters) { this.fighters = [new Fighter(N.thief, 14, 'thief'), new Fighter(N.buddyA, 11, 'buddyA'), new Fighter(N.buddyB, 11, 'buddyB'), new Fighter(N.buddyC, 9, 'buddyC')]; this.fighters[3].late = true; }
    for (const f of this.fighters) f.npc.fighting = true;
    F.start(this.fighters);
    h.targets = this.fighters;
    this.play('fight');
    this.hint('fight', { ar: 'برتقاني: صدّ أو اتفادى. أحمر: اتفادى بس!', en: I3.touch ? 'Orange glow: block or dodge. Red: dodge only!' : 'Orange glow: block (K / right click) or dodge (Ctrl). Red: dodge only!' }, 3.5, 'block');
  }
  onFight(e, f, dmg = 1) {
    if (e === 'telegraph') {
      sfx3.telegraph();
      if (f.kind === 'heavy') { this.voice.bark('f10', 'f10', 6); this.hint('heavy', { ar: 'التوهّج الأحمر ما يتصدّش! اتفادى', en: 'A RED glow cannot be blocked: dodge!' }, 2.6, 'slide'); }
      else if (this.fight.flank === f) { this.voice.bark('f7', 'f7', 8); this.hint('flank', { ar: 'واحد جاي من وراك! اتفادى، الصدّ بيحمي قدّام بس', en: 'One is coming from behind! Dodge: a block only covers the front' }, 2.6, 'slide'); }
      else if (Math.random() < 0.3) this.voice.bark('f7', 'f7', 10);
    }
    if (e === 'hit' || e === 'down') { if (f.name !== 'thief' && Math.random() < 0.5) this.voice.bark('f6', 'f6', 6); else if (Math.random() < 0.35) this.voice.bark(['f4', 'f5'], 'radwanHit', 7); if (e === 'down') sfx3.thump(); }
    if (e === 'ko') { sfx3.thump(); this.cam.shake(0.5); this.hitStop = 0.16; this.fx.emit(f.pos.x, 0.2, f.pos.z, 16, { speed: 2.5, up: 0.8 }); this.voice.bark(['f4', 'f5'], 'radwanHit', 4); this.log('ko', f.name); }
    if (e === 'heroHit') { this.hp = Math.max(0, this.hp - dmg); this.fightHurt = (this.fightHurt || 0) + dmg; this.log('hero hit', { by: f.name, kind: f.kind, flank: !!f.flanked, dmg, hp: this.hp, hero: this.hero.state }); sfx3.punch(); sfx3.hurt(); this.cam.shake(0.4); $('vig3d').classList.remove('flash'); void $('vig3d').offsetWidth; $('vig3d').classList.add('flash'); if (Math.random() < 0.5) this.voice.bark(['r3'], 'hurt', 6); }
    if (e === 'blocked') { sfx3.clack(); this.cam.shake(0.15); const h = this.hero.pos; this.fx.emit(h.x, h.y + 1.9, h.z, 8, { color: 0xfff0c0, speed: 3, up: 1, life: 0.25, size: 0.1, alpha: 1 }); this.stats.blocks = (this.stats.blocks || 0) + 1; }
    if (e === 'dodged') { this.stats.dodges = (this.stats.dodges || 0) + 1; }
    if (e === 'armor') { sfx3.clack(); this.hint('armor', { ar: 'وهو بيضرب، الضرب الخفيف مش هيوقفه... صدّ أو اتفادى!', en: 'Mid-punch, light hits will not stop him: block or dodge!' }, 2.6, 'block'); }
    if (e === 'evade') { sfx.swing(); }
    if (e === 'join') { this.voice.bark('f10', 'f10', 4, 2); this.toast({ ar: 'واحد كمان جاي من آخر الحارة!', en: 'Another one is coming from the end of the alley!' }, 2.2); }
    if (e === 'won' && this.m3) { this.m3.fightWon(); return; }
    if (e === 'won') { this.fightWon = this.fightTries === 1; this.log('fight won', { tries: this.fightTries }); setTimeout(() => this.run(() => this.cutFightEnd()), 900); }
  }
  async cutFightEnd() {
    const h = this.hero, N = this.npc, L = this.level.spawns;
    this.seg = 'fightend';
    this.fight.stop(); this.clearWorldUi(); h.targets = []; h.lockTarget = null;
    for (const f of this.fighters) f.npc.fighting = false;
    h.cine = true; h.anim.play('idle', { loop: true, fade: 0.3 });
    const T = N.thief;
    T.anim.play('get_up', { fade: 0.1 });
    this.shot({ pos: V(T.pos.x + 1.8, 1.25, T.pos.z + 2.4), look: this.headOf(T, 1.2), fov: 44, blend: 0.6 });
    await this.wait(1.2);
    T.anim.play('idle', { loop: true, fade: 0.3 });
    this.faceTo(T, h.pos.x, h.pos.z);
    await this.say('f8');
    // he hands back every mango still in his bag
    const n = this.stolen;
    for (let i = 0; i < n; i++) {
      const dx = h.pos.x - T.pos.x, dz = h.pos.z - T.pos.z, d = Math.hypot(dx, dz) || 1;
      this.mangoesFx.spawn(T.pos.x, 1.3, T.pos.z, dx / d * d * 0.9 + (i - n / 2) * 0.2, 4.5, dz / d * d * 0.9, 6);
    }
    this.shot({ pos: V(h.pos.x - 1.4, 1.6, h.pos.z - 2.2), look: this.headOf(h, 1.5), fov: 42, blend: 0.6 });
    await this.wait(0.6);
    await this.say('f9');
    // pick up the crate
    this.mover(T, 0, -884, 3.5);
    await this.mover(h, L.crateDrop.x - 0.6, L.crateDrop.z - 0.3, 2.4);
    this.worldCrate.visible = false; h.setCarry(true);
    // anything not collected yet is handed over
    for (const p of this.mangoesFx.list) p.ttl = Math.min(p.ttl, 0.01);
    while (this.stolen > 0) this.gainMango();
    T.show(false); N.buddyA.anim.play('idle', { loop: true }); N.buddyB.anim.play('idle', { loop: true });
    N.buddyA.show(false); N.buddyB.show(false); N.buddyC.show(false);
    h.cine = false;
    this.startRoofs('alley');
  }

  // ================================================================== 6. rooftops
  startRoofs(sub) {
    const h = this.hero, L = this.level.spawns;
    h.cine = false; h.setCarry(true); h.ride = false;
    this.pigeons.clear();
    for (const [i, p] of L.pigeonsR1.entries()) this.pigeons.add(p[0], p[1], p[2], i === 1);
    this.pigeons.add(-3.6, L.pigeonsR1[0][1], -930.4); this.pigeons.add(-5.2, L.pigeonsR1[0][1], -931.3);
    for (const p of L.pigeonsR5) this.pigeons.add(p[0], p[1], p[2], false);
    if (sub === 'r5') { h.place(L.cpRoof2.x, L.cpRoof2.y, L.cpRoof2.z, Math.PI); this.cam.snapBehind(h.pos, Math.PI); }
    else if (sub === 'r1') { h.place(L.cpRoof1.x, L.cpRoof1.y, L.cpRoof1.z, Math.PI); this.cam.snapBehind(h.pos, Math.PI); }
    else { if (this.cp && this.cp.seg === 'roofs') { h.place(this.cp.pos.x, this.cp.pos.y, this.cp.pos.z, this.cp.yaw); this.cam.snapBehind(h.pos, this.cp.yaw); } else this.cam.release(h.pos, h.yaw); }
    this.roofCp = sub;
    if (!this.cp || this.cp.seg !== 'roofs' || (this.cp.sub || 'alley') !== sub) this.saveCp('roofs', h.pos, h.yaw, sub);
    this.play('roofs');
    setTimeout(() => { if (this.seg === 'roofs') this.voice.say('u1', 2); }, 1200);
  }
  roofsStep(dt) {
    const h = this.hero, p = h.pos, L = this.level.spawns;
    // the way up is the crates on the left: arrow + ring + a hint that stays until he is up on the balcony
    const atStart = this.roofCp === 'alley' && p.z > -919 && p.y < 2.7;
    this.roofCue.visible = atStart;
    if (atStart) {
      const k = 1 + 0.15 * Math.sin(this.elapsed * 6); this.roofCueRing.scale.set(k, k, k); this.roofCueRing.material.opacity = p.y > 1 ? 0.25 : 0.85;
      if (this.elapsed - this.segStart > 2.2) this.stickyHint('crates', { ar: 'الطريق لفوق: الصناديق اللي على الشمال، وبعدين البلكونة، وبعدين السطح', en: 'The way up: the crates on the left, then the balcony, then the roof' }, 'jump');
    }
    if (this.roofCp !== 'r1' && this.roofCp !== 'r5' && p.y > ROOF.r1 - 0.1 && p.z < -918) { this.roofCp = 'r1'; this.saveCp('roofs', V(p.x, p.y, p.z), h.yaw, 'r1'); }
    if (this.roofCp === 'r1' && p.y > ROOF.r5 - 0.2 && p.z < -1000.5) { this.roofCp = 'r5'; this.saveCp('roofs', V(p.x, p.y, p.z), h.yaw, 'r5'); }
    if (p.z < -994 && p.z > -1000 && Math.abs(p.x) < 1.4 && p.y < ROOF.b) this.hint('walljump', { ar: 'نُط على الحيطة، ونُط تاني وانت لازق فيها', en: 'Jump at a wall, then jump again off it' }, 3, 'jump');
    if (p.z < -933 && p.z > -940.5 && p.y > 4) this.hint('gap', { ar: 'المسافة كبيرة! اجري على آخرك ونُط من الحرف', en: I3.touch ? 'A wide gap! Stick all the way (sprint), jump from the edge' : 'A wide gap! Sprint (Shift) and jump from the edge' }, 2.6, 'jump');
    if (p.z < -943 && p.z > -948 && p.y > 4) this.hint('laundry2', { ar: 'غسيل تاني! اتزحلق', en: 'More laundry! Slide' }, 2, 'slide');
    // round 4 traps
    if (p.z < -950 && p.z > -955 && p.y > 4) this.hint('cornice', { ar: 'امشي على الحرف لازق في الحيطة... ومتقفش، الحرف بيقع!', en: 'Along the ledge, hugging the wall... and keep moving, it crumbles!' }, 3);
    if (p.z < -975 && p.z > -981.4 && p.y > 2.4 && p.y < 3.4) this.stickyHint('plank', this.traps.plankHoldLeft() > 0.4 ? { ar: 'دلوقتي! اعدّي على اللوح', en: 'Now! Run across the plank' } : { ar: 'استنّى اللوح يتمد، وبعدين اعدّي عليه', en: 'Wait for the plank to slide across, then cross' });
    if (p.z < -1007 && p.z > -1012 && p.y > 6.5) this.hint('tin', { ar: 'الصاج ده مصدّي... عدّي بسرعة أو نُط', en: 'That tin is rotten... run over fast or jump it' }, 2.6, 'jump');
    // a fall into the alleys between the roofs
    const onRoute = p.z < -918.5 && p.z > -1040;
    if (onRoute && p.y < 1.2 && h.body.onGround && this.roofCp !== 'alley') {
      this.voice.say('u3', 2); sfx3.thump(); this.hp = Math.max(0, this.hp - 2); this.cam.shake(0.5);
      this.dropMango(p.x, 1.5, p.z);
      this.deaths++;
      if (this.hp > 0) { const c = this.cp; h.place(c.pos.x, c.pos.y, c.pos.z, c.yaw); this.cam.snapBehind(h.pos, c.yaw); this.traps.reset(); this.log('roof fall', { hp: this.hp, z: Math.round(p.z) }); }
    }
    if (p.z < -1047 && p.y < 0.6) this.startJetty(false);
  }

  onTrap(e, p) {
    const h = this.hero.pos;
    if (e === 'crack') {
      sfx3.scrape(); this.cam.shake(0.08);
      this.fx.emit((p.x0 + p.x1) / 2, p.y + 0.1, Math.min(Math.max(h.z, p.z0), p.z1), 10, { color: 0xd8cfc0, speed: 1.6, up: 0.8, life: 0.7, size: 0.18, alpha: 0.7 });
      this.voice.bark('u4', 'crumble', 9, 1);
    }
    if (e === 'drop') { sfx3.thump(); this.fx.emit((p.x0 + p.x1) / 2, p.y - 0.3, (p.z0 + p.z1) / 2, 14, { color: 0xbfb6a8, speed: 2, up: -0.5, life: 1.0, size: 0.22, alpha: 0.6 }); }
    if (e === 'jug') {
      this.jugTaken = true; this.hp = Math.min(6, this.hp + 2); sfx.mango(12);
      this.voice.say('u5', 2); this.toast({ ar: 'قُلّة مية ساقعة: قلب زيادة (مرة واحدة بس)', en: 'A jug of cold water: one heart back (only once)' }, 2.4);
      this.log('jug', { hp: this.hp });
    }
  }

  // ================================================================== 7. jetty + finale
  startJetty(fromCp) {
    const h = this.hero, L = this.level.spawns, N = this.npc;
    h.cine = false; h.setCarry(true);
    if (fromCp) { h.place(L.cpJetty.x, 0, L.cpJetty.z, Math.PI); this.cam.snapBehind(h.pos, Math.PI); }
    if (!this.cp || this.cp.seg !== 'jetty') this.saveCp('jetty', V(L.cpJetty.x, 0, L.cpJetty.z), Math.PI);
    this.resetFerry();
    N.captain.show(true);
    this.jetty = { departed: false, jumped: false, told: false };
    this.play('jetty');
    this.voice.say('j1', 2); sfx.ferryHorn();
  }
  resetFerry() {
    const F = this.ferry, L = this.level.spawns;
    F.z = L.ferry.z; F.v = 0; F.moving = false;
    this.placeFerry(0);
  }
  placeFerry(dt) {
    const F = this.ferry;
    F.root.position.set(0, Math.sin(this.elapsed * 1.3) * 0.04, F.z);
    F.root.rotation.z = Math.sin(this.elapsed * 0.9) * 0.012;
    Object.assign(F.deck, { x0: -1.45, x1: 1.45, z0: F.z - 4.2, z1: F.z + 4.2, y0: -2, y1: 0.35, vx: 0, vz: -F.v });
    const cap = this.npc.captain;
    if (cap.active && this.seg !== 'finale') { cap.body.pos.set(0.5, 0.35, F.z - 2.5); cap.yaw = 0; cap.sync(); }
    void dt;
  }
  updateFerry(dt) {
    const F = this.ferry;
    if (F.moving) { F.v = Math.min(F.maxV || 2.0, F.v + (this.seg === 'finale' ? 1.1 : 0.7) * dt); F.z -= F.v * dt; }
    this.placeFerry(dt);
  }
  jettyStep(dt) {
    const h = this.hero, p = h.pos, J = this.jetty, F = this.ferry, L = this.level.spawns;
    if (!J.departed && p.z < -1090) { J.departed = true; F.moving = true; F.maxV = 2.0; sfx.ferryHorn(); this.voice.say('j2', 2); this.hint('ferry', { ar: 'اجري ونُط من آخر المرسى!', en: 'Sprint and jump off the end of the jetty!' }, 2.5, 'jump'); }
    // a jump off the far end of the jetty gets a little extra and slow motion
    if (!J.jumped && h.state === 'air' && p.z < L.jettyEnd + 4.5 && p.z > L.jettyEnd - 1 && h.body.vel.y > 3) {
      J.jumped = true; h.body.vel.y = 8.8; h.body.vel.x *= 0.3; h.body.vel.z = Math.min(h.body.vel.z, -8.6) * 1.25;
      this.timeScale = 0.42; setTimeout(() => { this.timeScale = 1; }, 650);
      this.cam.shake(0.1); this.log('ferry jump', { gap: +(L.jettyEnd - (F.z + 4.2)).toFixed(2) });
    }
    if ((h.body.onGround && h.body.platform === F.deck) || (h.state === 'climb' && h.climb.box === F.deck && h.st > h.climb.dur * 0.6)) { this.timeScale = 1; this.run(() => this.cutFinale()); return; }
    if (p.y < -0.5 && p.z < -1062) {
      sfx3.splash(); this.fx.emit(p.x, -0.3, p.z, 30, { color: 0xffffff, speed: 3, up: 5, life: 0.9, alpha: 0.9 });
      this.hp = Math.max(0, this.hp - 2); this.deaths++; this.timeScale = 1;
      this.log('splash', { hp: this.hp });
      if (this.hp > 0) { h.place(L.cpJetty.x, 0, L.cpJetty.z, Math.PI); this.cam.snapBehind(h.pos, Math.PI); this.resetFerry(); J.departed = false; J.jumped = false; this.voice.say('j1', 2); }
    }
  }
  async cutFinale() {
    const h = this.hero, F = this.ferry, N = this.npc;
    this.seg = 'finale';
    this.closeSection();
    this.result = { mangoes: this.mangoes, timeLeft: Math.max(0, this.timeLeft), elapsed: this.elapsed, fightFirstTry: this.fightWon, fightHurt: this.fightHurt || 0, hpLost: this.hpLost || 0, deaths: this.deaths, fails: this.fails, cleanBonus: this.cleanBonus };
    this.log('finish', this.result, { deaths: this.deaths });
    h.cine = true; h.body.vel.set(0, 0, 0);
    sfx.win(); playMusic('title', 0.55); sfx3.cheer();
    F.maxV = 3.2;
    h.body.pos.set(0, 0.35, F.z + 3.7); h.yaw = Math.PI;
    const follow = (dt) => { h.body.pos.z -= F.v * dt; h.body.pos.y = 0.35; };
    this.cutStep = follow;
    h.anim.play('idle', { loop: true });
    const cap = N.captain;
    this.shot({ pos: () => V(7.5, 2.0, F.z + 3), look: () => V(0, 1.2, F.z - 0.5), fov: 46, blend: 0.8 });
    await this.say('j3');
    this.shot({ pos: () => V(h.pos.x - 1.5, 1.85, h.pos.z - 2.6), look: () => V(h.pos.x, h.pos.y + 1.5, h.pos.z), fov: 40, blend: 0.6 });
    await this.say(this.mangoes >= 12 ? 'j4' : 'j5');
    // the white pigeon lands on the canopy
    const pg = this.pigeons.add(0.6, 2.8, F.z + 0.5, true);
    pg.state = 'perch';
    this.cutStep = (dt) => { follow(dt); pg.root.position.set(0.6, 2.8, F.z + 0.5); };
    this.shot({ pos: () => V(3.4, 3.6, F.z + 4.2), look: () => V(0.6, 2.85, F.z + 0.5), fov: 38, blend: 0.6 });
    await this.say('j6');
    this.shot({ pos: () => V(-14, 3, F.z + 22), pos2: () => V(-20, 9, F.z + 34), look: () => V(0, 1, F.z - 8), fov: 50, blend: 1.2, dur: 5 });
    await this.wait(2.4);
    this.cutStep = null;
    this.end();
  }
  end() {
    const r = this.result;
    // round 3: stars that take skill (were: 10 mangoes, a minute of sun, the fight on the first try)
    // round 4: near-perfect play: all 12, a minute and a quarter of sun (clean sections give sun back), and the
    // whole run without a single retry, losing at most one heart
    const stars = [r.mangoes >= 12, r.timeLeft >= STAR_SUN, r.fails === 0 && r.hpLost <= 2];
    const rows = [
      [stars[0], 'وصّلت الاتناشر مانجاية كلهم', 'Delivered all twelve mangoes'],
      [stars[1], 'وصلت والشمس لسه فاضل لها دقيقة وربع', 'Made it with a minute and a quarter of sun to spare'],
      [stars[2], 'المشوار كله من غير ولا إعادة، ومن غير ما تخسر أكتر من قلب', 'The whole run without a retry, losing at most one heart'],
    ];
    this.showEnd(1, stars, rows, { countText: num(r.mangoes) + ' من ' + num(12), countLabel: ['مانجا', 'Mangoes'], elapsed: r.elapsed, fails: r.fails });
  }
  // the end screen of either mission: stars, what each one was for, the stats, a rank; finishing a mission
  // unlocks the next (localStorage, with a safe fallback when storage is blocked)
  showEnd(mission, stars, rows, o) {
    this.state = 'end';
    this.showControls(false); this.ui.show('hud', false); this.clearWorldUi();
    this.ui.screen('screen-end');
    const n = stars.filter(Boolean).length;
    [...document.querySelectorAll('#stars span')].forEach((s, i) => s.classList.toggle('on', i < n));
    $('end-title').textContent = ['', 'المهمة الأولى خلصت!', 'المهمة التانية خلصت!', 'المهمة التالتة خلصت!'][mission];
    $('end-title-en').textContent = 'Mission ' + mission + ' complete!';
    $('end-mangoes').textContent = o.countText; $('end-count-ar').textContent = o.countLabel[0]; $('end-count-en').textContent = o.countLabel[1];
    $('end-time').textContent = clock(o.elapsed);
    $('end-fights').textContent = o.fails === 0 ? 'ولا مرة' : num(o.fails) + (o.fails > 2 ? ' مرات' : o.fails === 2 ? ' مرتين' : ' مرة');
    $('end-checks').innerHTML = rows.map(([ok, a, e]) => `<div class="chk${ok ? ' ok' : ''}"><b>${ok ? '★' : '☆'}</b><span class="ar">${a}</span><em class="en" dir="ltr">${e}</em></div>`).join('');
    const ranks = mission === 3 ? [
      { ar: 'الكشك لسه واقف، والأسبوع عدّى.', en: 'The kiosk is still standing, and the week is done.' },
      { ar: 'عمك فتحي فخور بيك!', en: 'Uncle Fathy is proud of you!' },
      { ar: 'برعي نفسه بيعمل لك حساب!', en: 'Even Barai respects you now!' },
      { ar: 'كبير الشارع! ولا غلطة.', en: 'Boss of the street! Flawless.' },
    ] : mission === 2 ? [
      { ar: 'سُكّرة رجعت بيتها، وده الأهم.', en: 'Sukkara is home, that\'s what counts.' },
      { ar: 'شغل محترم يا رضوان!', en: 'Solid work, Radwan!' },
      { ar: 'زغلول نفسه انبسط منك!', en: 'Even Zaghloul is impressed!' },
      { ar: 'سلطان السطوح! ولا غلطة.', en: 'King of the rooftops! Flawless.' },
    ] : [
      { ar: 'وصلت، وده الأهم. المرة الجاية النجوم كلها!', en: 'You made it, that\'s what counts. Next time, every star!' },
      { ar: 'شغل محترم يا رضوان!', en: 'Solid work, Radwan!' },
      { ar: 'جدع والله! قريب من الكمال.', en: 'Well done! Nearly perfect.' },
      { ar: 'أسطورة إمبابة! ولا غلطة.', en: 'Legend of Imbaba! Flawless.' },
    ];
    $('end-rank').textContent = ranks[n].ar; $('end-rank-en').textContent = ranks[n].en;
    for (let i = 0; i < n; i++) setTimeout(() => sfx.star(i), 350 * i + 200);
    let unlocked = 1;
    try { unlocked = Math.max(+localStorage.getItem('saidi.unlocked') || 1, mission + 1); localStorage.setItem('saidi.unlocked', String(unlocked)); } catch (e) { unlocked = mission + 1; }
    document.body.dataset.endm = String(mission);
    $('btn-next').classList.toggle('hidden', !(mission < 3 && unlocked >= mission + 1));
    $('btn-next').textContent = 'العب المهمة ' + num(mission + 1);
    this.log('end-screen', { mission, stars: n, ...(this.result || {}) });
  }

  // ================================================================== fail / pause / exit
  fail(kind) {
    if (this.state !== 'play' || this.mode !== 'play') return;
    this.state = 'fail'; this.deaths++; this.fails++;
    this.engine.stop();
    this.log('fail', kind, { seg: this.seg, z: Math.round(this.hero.pos.z) });
    this.showControls(false);
    const T = {
      time: [{ ar: 'الشمس غابت... والمعدية مشيت!', en: 'The sun has set... and the ferry left!' }, { ar: 'ولا يهمك، نرجع لآخر نقطة واجري أسرع.', en: 'Never mind. Back to the last checkpoint, and run faster.' }],
      hearts: [{ ar: 'رضوان محتاج ياخد نفسه', en: 'Radwan needs to catch his breath' }, { ar: 'نرجع لآخر نقطة، والمانجا اللي كانت معاك هناك ترجع لك.', en: 'Back to the last checkpoint, with the mangoes you had there.' }],
      escaped: [{ ar: 'الحرامي هرب!', en: 'The thief got away!' }, { ar: 'خليك لازق فيه واستعمل البوست.', en: 'Stay on his tail and use the boost.' }],
      pigeon: [{ ar: 'سُكّرة راحت على برج زغلول!', en: 'Sukkara flew to Zaghloul\'s tower!' }, { ar: 'ما تسيبهاش تستنى كتير... ولما زغلول يصفّر، ناديها بزرار النبّوت.', en: 'Don\'t keep her waiting... and when Zaghloul whistles, call her with the staff button.' }],
      lost: [{ ar: 'الحرامي ضاع في الزحمة!', en: 'The thief lost you in the crowd!' }, { ar: 'اجري على آخرك، ولف من جنب الناس أو اتزحلق.', en: 'Sprint, and go round the shoppers or slide.' }],
      // Mission 3
      m3time: [{ ar: 'اليوم خلص والشغل ما خلصش!', en: 'The day is over and the work is not!' }, { ar: 'نعيد اليوم ده... وأسرع شوية.', en: 'Let\'s redo this day... a bit faster.' }],
      m3hearts: [{ ar: 'رضوان محتاج ياخد نفسه', en: 'Radwan needs to catch his breath' }, { ar: 'نعيد اليوم ده من أوله.', en: 'Let\'s redo this day from the start.' }],
      angry: [{ ar: 'تلات زباين مشيوا زعلانين!', en: 'Three customers walked off angry!' }, { ar: 'ابدأ بالزبون اللي صبره قرّب يخلص، والحاجات البعيدة الأول.', en: 'Mind whose patience is running out; fetch the far items first.' }],
      rush: [{ ar: 'زباين كتير راحوا لبرعي!', en: 'Too many customers went to Barai!' }, { ar: 'لازم تخدم أغلب الطابور.', en: 'You have to serve most of the queue.' }],
      kid: [{ ar: 'بندق هرب بالصندوق!', en: 'Bondo got away with the crate!' }, { ar: 'اجري على آخرك، اتزحلق تحت الغسيل، واضربه بالنبّوت لما تقرّب.', en: 'Sprint, slide under the washing, and swing the staff when you are close.' }],
      smashed: [{ ar: 'رجالة برعي كسّروا الكشك!', en: 'Barai\'s men smashed the kiosk!' }, { ar: 'اللي يروح للكشك، سيب الباقي واضربه هو.', en: 'Whoever heads for the kiosk: leave the rest and hit him.' }],
      night: [{ ar: 'الجيران زهقوا من الاستنا!', en: 'The neighbours gave up waiting!' }, { ar: 'شوف مين طالب إيه، وهات الحاجة على طول.', en: 'See who wants what, and bring it straight away.' }],
    }[this.m3 && (kind === 'time' || kind === 'hearts') ? 'm3' + kind : kind];
    $('fail-title').textContent = T[0].ar; $('fail-title-en').textContent = T[0].en;
    $('fail-body').textContent = T[1].ar; $('fail-body-en').textContent = T[1].en;
    this.ui.screen('screen-fail');
    if (this.auto) setTimeout(() => this.retry(), 800);
  }
  retry() { this.ui.screen(null); this.state = 'play'; this.restoreCp(true); }
  pause() { if (this.state !== 'play') return; this.state = 'paused'; this.ui.screen('screen-pause'); clearInput3D(); I3.enabled = false; this.voice.stop(); this.engine.mute(true); }
  resume() { if (this.state !== 'paused') return; audioInit('resume'); this.engine.mute(false); this.ui.screen(null); this.state = 'play'; I3.enabled = this.mode === 'play'; clearInput3D(); this.last = performance.now(); }
  restartCp() { this.ui.screen(null); this.state = 'play'; this.fails++; this.restoreCp(true); }
  again() { this.ui.screen(null); this.state = 'play'; this.resetRun(); if (this.m2) { this.m2.t1 = this.m2.t2 = this.m2.t3 = null; } if (this.m3) this.m3.resetWeek(); this.cp = this.defaultCp(this.m2 ? 'start' : this.m3 ? 'd1' : 'street'); this.restoreCp(); }
  onDog(e) { if (this.m2) this.m2.onDog(e); if (this.m3) this.m3.onDog(e); }
  // the tahtib fight: Mission 1's alley, or Mission 3's Day 4 at the kiosk
  inFight() { return this.seg === 'fight' || !!(this.m3 && this.m3.fighting); }
  exit() {
    this.active = false; cancelAnimationFrame(this.raf);
    this.voice.stop(); this.voice.hide(); this.engine.stop(); setAmbient(0); clearInput3D(); I3.enabled = false; I3.bot = null;
    $('c3d').classList.add('hidden'); $('bars3d').classList.add('hidden'); this.clearWorldUi(); if ($('lure3d')) $('lure3d').classList.add('hidden');
    document.body.classList.remove('m2', 'm3'); if ($('m3hud')) $('m3hud').classList.add('hidden');
    removeEventListener('resize', this._onResize);
    document.body.classList.remove('mode3d');
    const r = this.renderer; r.toneMapping = this.saved.tm; r.toneMappingExposure = this.saved.exp; r.shadowMap.enabled = this.saved.sh;
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
  }
}

export { STEP, ATTACKS };
