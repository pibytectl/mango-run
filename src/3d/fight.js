// The alley brawl: up to three thieves. One attacker at a time (token), a readable telegraph before every
// punch (lean back + glow + "!" marker + a rising tone), jab then cross. Radwan's hits stagger, the
// finisher knocks down; at zero health a thief stays down and gives up.
// Round 2 easing (a normal player went from 6 to 1 health in 19 s): a longer telegraph (longer still when the
// thug is off screen, who also gets an edge warning), a pause between attackers, light hits can still cancel
// the first half of a wind-up, longer cooldowns.
// Round 3 (Andy: "too easy"): real pressure back, the off-screen warning kept. The telegraph is shorter on
// screen (0.75 -> 0.6 s; off screen 1.15 -> 1.0 s with the edge arrow), the next thug may start his wind-up
// while the first is still punching, the waiting thugs circle round to his back, cooldowns are shorter, a
// light hit only cancels the first 30% of a wind-up, and they take more hits. (After the first bot run, where
// the fight was the one place it died, eased a notch: a longer gap between attackers, slower circling, 12/9/9 hits.)
// Round 4 (Andy: "still not difficult"): they flank and combo. Two can attack at once, but the second only from
// Radwan's side or back (a flanker, with the off-screen telegraph and the edge arrow); the thief and his first pal
// mix in a three-hit combo whose last blow knocks him down if it lands; the second pal mixes in a heavy swing with
// a RED glow that a block does not stop (dodge it). Telegraphs 0.55 s on screen, 0.95 s off screen (heavy +0.25 s),
// light hits only cancel the first 20% of a wind-up, they take 14/11/11 hits.
const WINDUP = 0.55, WINDUP_OFFSCREEN = 0.95, HEAVY_EXTRA = 0.25, TOKEN_GAP = 0.45, FLANK_GAP = 2.0;
const ORANGE = 0xff6a2a, RED = 0xff1a1a;
const _v = new THREE.Vector3();
import * as THREE from '../../vendor/three.module.min.js';

export class Fighter {
  constructor(npc, hp, name) {
    this.npc = npc; this.hp = this.maxHp = hp; this.name = name;
    this.state = 'idle'; this.t = 0; this.cool = 1 + Math.random(); this.circleDir = Math.random() < 0.5 ? -1 : 1;
    this.ko = false; this.hitsTaken = 0;
    const glow = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.62, 28), new THREE.MeshBasicMaterial({ color: 0xff6a2a, transparent: true, opacity: 0, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.04; npc.root.add(glow); this.glow = glow;
  }
  get pos() { return this.npc.pos; }
  hittable() { return !this.ko && this.state !== 'down' && this.state !== 'getup' && this.state !== 'evade' && this.state !== 'lurk'; }
}

export class Fight {
  constructor(game) { this.g = game; this.list = []; this.active = false; }
  start(fighters) {
    this.list = fighters; this.active = true; this.token = null; this.flank = null; this.t = 0; this.won = false; this.gap = 1.2; this.flankGap = 3;
    for (const f of fighters) { f.state = f.late ? 'lurk' : 'approach'; f.t = 0; f.cool = 0.5 + Math.random() * 1.0; f.hp = f.maxHp; f.ko = false; f.recent = []; f.n = 0; f.kind = 'jab2'; f.npc.show(true); }
  }
  // the next attack of this thug: the thief and buddyA mix in a 3-hit combo, buddyB a heavy (unblockable) swing
  nextKind(f) {
    f.n = (f.n || 0) + 1;
    if (f.name === 'buddyB') return f.n % 3 === 0 ? 'heavy' : 'jab2';
    if (f.name === 'thief') return f.n % 2 === 0 ? 'combo3' : 'jab2';
    if (f.name === 'buddyC') return f.n % 2 === 1 ? 'combo3' : 'jab2';
    return f.n % 3 === 2 ? 'combo3' : 'jab2';
  }
  // behind or to the side of Radwan (more than ~100 degrees from where he faces)
  isFlank(f) {
    const h = this.g.hero, dx = f.pos.x - h.pos.x, dz = f.pos.z - h.pos.z, d = Math.hypot(dx, dz) || 1;
    return (dx * Math.sin(h.yaw) + dz * Math.cos(h.yaw)) / d < -0.17;
  }
  stop() { this.active = false; for (const f of this.list) f.glow.material.opacity = 0; }
  alive() { return this.list.filter((f) => !f.ko); }
  // the hero's swing connects (called at the impact frame)
  heroImpact(atk, hero, index) {
    // the swing lands on its primary target; only the sweeping side strike also catches a second thug
    const hp = hero.pos, fy = Math.sin(hero.yaw), fz = Math.cos(hero.yaw);
    const cands = [];
    for (const f of this.list) {
      if (!f.hittable()) continue;
      const dx = f.pos.x - hp.x, dz = f.pos.z - hp.z, d = Math.hypot(dx, dz);
      if (d > atk.range) continue;
      const ang = Math.acos(THREE.MathUtils.clamp((dx * fy + dz * fz) / (d || 1), -1, 1));
      if (ang > atk.arc && d > 0.9) continue;
      cands.push({ f, d, dx, dz, score: d + ang * 1.5 });
    }
    cands.sort((a, b) => a.score - b.score);
    const n = index === 1 ? 2 : 1;
    let hits = 0;
    for (const c of cands.slice(0, n)) { hits++; this.hitFighter(c.f, atk, c.dx / (c.d || 1), c.dz / (c.d || 1)); }
    return hits;
  }
  hitFighter(f, atk, nx, nz) {
    const g = this.g;
    f.hp -= atk.dmg; f.hitsTaken++;
    const b = f.npc.body;
    // committed to a punch: light hits do not stop it (block or dodge instead); the finisher does
    if (((f.state === 'windup' && f.t > f.windup * 0.2) || f.state === 'punch') && !atk.finisher && f.hp > 0) { g.onFight('armor', f); return; }
    if (this.token === f) { this.token = null; this.gap = TOKEN_GAP * 0.6; }
    if (this.flank === f) { this.flank = null; this.flankGap = FLANK_GAP; }
    f.glow.material.opacity = 0;
    // too many hits in a row: he hops back out of the combo
    f.recent = (f.recent || []).filter((t) => this.t - t < 2.2); f.recent.push(this.t);
    if (f.recent.length >= 3 && !atk.finisher && f.hp > 0) {
      f.recent = []; f.state = 'evade'; f.t = 0;
      f.npc.anim.play('walk', { loop: true, speed: -1.6, fade: 0.05 });
      b.vel.set(nx * 6.5, 0, nz * 6.5);
      g.onFight('evade', f);
      return;
    }
    if (f.hp <= 0) {
      f.ko = true; f.state = 'down'; f.t = 0;
      f.npc.anim.play('knockdown', { fade: 0.05 });
      b.vel.set(nx * 6, 0, nz * 6);
      f.npc.yaw = Math.atan2(-nx, -nz);
      g.onFight('ko', f);
    } else if (atk.finisher) {
      f.state = 'down'; f.t = 0;
      f.npc.anim.play('knockdown', { fade: 0.05, speed: 1.3 });
      b.vel.set(nx * 7, 0, nz * 7);
      f.npc.yaw = Math.atan2(-nx, -nz);
      g.onFight('down', f);
    } else {
      f.state = 'hit'; f.t = 0;
      f.npc.anim.play('hit_react', { fade: 0.04, restart: true });
      b.vel.set(nx * 3.2, 0, nz * 3.2);
      f.npc.yaw = Math.atan2(-nx, -nz);
      g.onFight('hit', f);
    }
  }
  step(dt) {
    if (!this.active) return;
    const g = this.g, hero = g.hero, hp = hero.pos;
    this.t += dt; this.gap = Math.max(0, this.gap - dt); this.flankGap = Math.max(0, this.flankGap - dt);
    if (this.flank && (this.flank.ko || !['approach', 'circle', 'windup', 'punch'].includes(this.flank.state))) { this.flank = null; this.flankGap = FLANK_GAP * 0.5; }
    const alive = this.alive();
    if (!alive.length) { if (!this.won) { this.won = true; g.onFight('won'); } }
    // separation + face/approach
    for (const f of this.list) {
      const n = f.npc, b = n.body, p = n.pos;
      f.t += dt;
      const dx = hp.x - p.x, dz = hp.z - p.z, d = Math.hypot(dx, dz) || 1;
      const faceHero = () => { const want = Math.atan2(dx, dz); let a = want - n.yaw; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; n.yaw += a * Math.min(1, 8 * dt); };
      let vx = 0, vz = 0;
      switch (f.state) {
        case 'approach': case 'circle': {
          faceHero();
          const mine = this.token === f || this.flank === f;
          const ring = mine ? 1.25 : 2.3 + (this.list.indexOf(f) % 2) * 0.5;
          const radial = (d - ring);
          const sp = Math.abs(radial) > 0.4 ? Math.min(3.6, Math.abs(radial) * 2.5) * Math.sign(radial) : 0;
          vx = dx / d * sp; vz = dz / d * sp;
          // strafe around the hero while waiting
          if (!mine) {
            // circle toward his back: pick the way round that increases the angle from where he faces
            const hy = hero.yaw, fx = Math.sin(hy), fz = Math.cos(hy), side = (-dx) * fz - (-dz) * fx;
            if (Math.random() < dt * 1.5) f.circleDir = side >= 0 ? 1 : -1;
            const s = 1.25 * f.circleDir; vx += -dz / d * s; vz += dx / d * s;
          }
          f.cool -= dt;
          const free = hero.state !== 'down' && hero.state !== 'getup';
          // never more than two swinging or winding up at once
          const busy = this.list.filter((o) => o !== f && (o.state === 'windup' || o.state === 'punch')).length;
          if (!this.token && this.flank !== f && this.gap <= 0 && f.cool <= 0 && free && d < 4.5 && busy < 2) { this.token = f; }
          // a second attacker at the same time, but only from his side or back
          else if (!this.flank && this.token && this.token !== f && this.flankGap <= 0 && f.cool <= 0 && free && d < 4.0 && busy < 2 && this.isFlank(f)) { this.flank = f; }
          if (mine && d < 1.7) {
            f.state = 'windup'; f.t = 0; f.kind = this.nextKind(f); f.flanked = this.flank === f;
            f.windup = (this.onScreen(f) ? WINDUP : WINDUP_OFFSCREEN) + (f.kind === 'heavy' ? HEAVY_EXTRA : 0);
            f.glow.material.color.setHex(f.kind === 'heavy' ? RED : ORANGE);
            n.anim.play('punch', { fade: 0.1, speed: 0.0001, at: 0.12 }); g.onFight('telegraph', f);
          }
          const sp2 = Math.hypot(vx, vz); n.locoAnim(sp2);
          break;
        }
        case 'windup': {
          faceHero();
          f.glow.material.opacity = 0.35 + 0.45 * Math.abs(Math.sin(f.t * 18));
          if (f.t > f.windup) {
            f.state = 'punch'; f.t = 0; f.p1 = f.p2 = f.p3 = false; n.anim.play('punch', { fade: 0.03, speed: f.kind === 'heavy' ? 0.8 : 1.0, restart: true }); f.glow.material.opacity = f.kind === 'heavy' ? 0.5 : 0;
            // the token passes on as the punch starts: the next thug can be winding up while this one swings
            if (this.token === f) { this.token = null; this.gap = TOKEN_GAP; }
            if (this.flank === f) { this.flank = null; this.flankGap = FLANK_GAP; }
          }
          break;
        }
        case 'punch': {
          const K = f.kind;
          if (f.t < 0.2 || (K === 'combo3' && f.t > 0.55 && f.t < 0.7)) faceHero();
          const lunge = (f.t < 0.45 || (K === 'combo3' && f.t > 0.6 && f.t < 0.85)) && d > 1.15 ? (K === 'heavy' ? 3.0 : 2.2) : 0;
          vx = Math.sin(n.yaw) * lunge; vz = Math.cos(n.yaw) * lunge;
          if (K === 'heavy') {
            // the blow lands 0.25 s after the red glow stops pulsing: a dodge on the glow's end always clears it
            if (!f.p1 && f.t >= 0.25) { f.p1 = true; f.glow.material.opacity = 0; this.punchCheck(f, 2, 'heavy'); }
            if (f.t > 1.05) this.endPunch(f);
          } else {
            if (!f.p1 && f.t >= 0.27) { f.p1 = true; this.punchCheck(f, 1); }
            if (!f.p2 && f.t >= 0.5) { f.p2 = true; this.punchCheck(f, 1); }
            // the combo's third blow: the swing again, harder; it knocks him down if it lands (a block stops it)
            if (K === 'combo3' && !f.p3 && f.t >= 0.6 && !f.re) { f.re = true; n.anim.play('punch', { fade: 0.03, speed: 1.25, restart: true, at: 0.1 }); }
            if (K === 'combo3' && !f.p3 && f.t >= 0.86) { f.p3 = true; this.punchCheck(f, 2, 'knock'); }
            if (f.t > (K === 'combo3' ? 1.25 : 0.93)) this.endPunch(f);
          }
          break;
        }
        case 'hit': {
          b.vel.x *= Math.max(0, 1 - 8 * dt); b.vel.z *= Math.max(0, 1 - 8 * dt); vx = b.vel.x; vz = b.vel.z;
          if (f.t > 0.45) { f.state = 'circle'; f.t = 0; f.cool = Math.min(f.cool, 0.35); }
          break;
        }
        case 'down': {
          b.vel.x *= Math.max(0, 1 - 5 * dt); b.vel.z *= Math.max(0, 1 - 5 * dt); vx = b.vel.x; vz = b.vel.z;
          if (!f.ko && f.t > 1.4) { f.state = 'getup'; f.t = 0; n.anim.play('get_up', { fade: 0.08, speed: 1.15 }); }
          break;
        }
        // Mission 3: a thug sent to smash the kiosk; the mission steers him (and he stays hittable: a hit stops him)
        case 'raid': { const v = g.m3 ? g.m3.raidStep(f, dt) : null; if (v) { vx = v[0]; vz = v[1]; } break; }
        case 'getup': if (f.t > 1.15) { f.state = 'circle'; f.t = 0; f.cool = 0.4; } break;
        case 'evade': {
          b.vel.x *= Math.max(0, 1 - 5 * dt); b.vel.z *= Math.max(0, 1 - 5 * dt); vx = b.vel.x; vz = b.vel.z; faceHero();
          if (f.t > 0.45) { f.state = 'circle'; f.t = 0; f.cool = 0.25; }
          break;
        }
        case 'idle': n.locoAnim(0); break;
        // the late pal: watches from the back of the alley (a taunt now and then) until one of the others is down
        case 'lurk': {
          faceHero();
          if (n.anim.name === 'taunt' ? f.t > 1.95 : n.anim.name !== 'idle') n.anim.play('idle', { loop: true, fade: 0.3 });
          if (f.t > 4.5 && n.anim.actions.taunt) { f.t = 0; n.anim.play('taunt', { fade: 0.15 }); }
          if (this.list.some((o) => o !== f && o.ko) || d < 3) { f.state = 'approach'; f.t = 0; f.cool = 1.2; g.onFight('join', f); }
          break;
        }
      }
      // keep a little space from each other and from the hero
      for (const o of this.list) {
        if (o === f || o.ko) continue;
        const ex = p.x - o.pos.x, ez = p.z - o.pos.z, e = Math.hypot(ex, ez);
        if (e < 1.1 && e > 0.001) { vx += ex / e * 2.5; vz += ez / e * 2.5; }
      }
      if (d < 0.95 && !f.ko) { vx -= dx / d * 3; vz -= dz / d * 3; }
      b.vel.x = vx; b.vel.z = vz;
      n.move(dt);
      n.update(dt);
    }
  }
  endPunch(f) {
    f.state = 'circle'; f.t = 0; f.re = false; f.cool = 0.7 + Math.random() * 0.6; f.glow.material.opacity = 0;
    if (this.token === f) { this.token = null; this.gap = TOKEN_GAP; }
    if (this.flank === f) { this.flank = null; this.flankGap = FLANK_GAP; }
  }
  onScreen(f) {
    const cam = this.g.camera; if (!cam) return true;
    _v.copy(f.pos); _v.y += 1.1; _v.project(cam);
    return _v.z < 1 && Math.abs(_v.x) < 0.92 && Math.abs(_v.y) < 1;
  }
  // dmg in half hearts; how: undefined (a jab), 'knock' (blockable, knocks him down if it lands), 'heavy'
  // (cannot be blocked, knocks him down)
  punchCheck(f, dmg = 1, how) {
    const g = this.g, hero = g.hero, n = f.npc;
    const dx = hero.pos.x - n.pos.x, dz = hero.pos.z - n.pos.z, d = Math.hypot(dx, dz);
    const facing = (dx * Math.sin(n.yaw) + dz * Math.cos(n.yaw)) / (d || 1);
    if (d > (how === 'heavy' ? 2.0 : 1.75) || facing < 0.5) { g.onFight('whiff', f); return; }
    const r = hero.takeHit(dmg, n.pos.x, n.pos.z, how === 'heavy', how === 'knock');
    g.onFight(r === 'blocked' ? 'blocked' : r === 'dodged' ? 'dodged' : 'heroHit', f, r === 'blocked' || r === 'dodged' ? 0 : dmg);
  }
}
