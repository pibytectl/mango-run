// ?debug=auto3d: a scripted player that completes every segment through the normal inputs (move vector,
// sprint, jump, slide, attack, block, steer, boost). It reads the world to decide; it never moves Radwan
// directly, except a logged nudge if it is stuck for several seconds.
const W = (x, z, o = {}) => ({ x, z, ...o });
// rooftop route (from the alley to the corniche): act = action when this waypoint is reached
const ROOF_ROUTE = [
  W(-1.5, -906), W(-3.9, -910.5), W(-3.9, -912.4), W(-3.9, -914.3, { jumpAt: 1.0 }), W(-3.6, -915.6, { jumpAt: 0.9 }), W(-3.0, -917.2), W(-2.8, -919.5),
  W(0, -925), W(0, -936, { sprint: true }), W(0, -940.3, { jump: true, sprint: true }), W(0, -955.5, { sprint: true }),
  W(0, -963, { sprint: true }), W(0, -970, { sprint: true }), W(0, -976, { sprint: true }), W(0, -984.6, { jump: true, sprint: true }), W(0, -990, { sprint: true }),
  W(0.4, -996.2), W(-0.6, -996.6, { wall: true }), W(2.6, -997.0), W(2.6, -1002.5), W(2.6, -1012), W(2.6, -1031), W(0, -1037, { sprint: true }), W(0, -1043.5, { sprint: true }),
  W(0, -1050), W(0, -1056),
];

export class Bot {
  constructor(game) { this.g = game; this.inp = { world: null }; this.stuckT = 0; this.lastPos = null; this.t = 0; this.atkT = 0; this.ri = 0; this.wallStep = 0; }
  press(k) { this.inp[k + 'Pressed'] = true; }
  go(x, z, sprint = true) {
    const p = this.g.hero.pos, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    this.inp.world = d > 0.05 ? { x: dx / d, z: dz / d } : { x: 0, z: 0 };
    this.inp.sprint = sprint;
    return d;
  }
  step(dt) {
    const g = this.g, h = g.hero, I = this.inp;
    this.t += dt;
    I.blockHeld = false; I.jumpHeld = I.jumpHeld && h.state === 'air';
    const seg = g.seg;
    if (seg === 'street') this.street(dt);
    else if (seg === 'market') this.market(dt);
    else if (seg === 'chase') this.chase(dt);
    else if (seg === 'fight') this.fight(dt);
    else if (seg === 'roofs') this.roofs(dt);
    else if (seg === 'jetty') this.jetty(dt);
    // stuck detection (on foot)
    if (seg !== 'chase' && seg !== 'fight') {
      const p = h.pos;
      if (this.lastPos && Math.hypot(p.x - this.lastPos.x, p.z - this.lastPos.z) < 0.02 && (I.world && Math.hypot(I.world.x, I.world.z) > 0.5)) this.stuckT += dt; else this.stuckT = 0;
      this.lastPos = { x: p.x, z: p.z };
      if (this.stuckT > 1.2 && this.stuckT < 1.25) this.press('jump');
      if (this.stuckT > 4) {
        this.stuckT = 0; g.stats.botNudges++;
        const w = I.world || { x: 0, z: -1 };
        h.body.pos.x += w.x * 1.5; h.body.pos.z += w.z * 1.5; h.body.pos.y += 0.5;
        g.log('bot nudge', { seg, x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1) });
      }
    }
  }
  street() {
    const g = this.g, h = g.hero, p = h.pos;
    let tx = 0, go = true;
    // dodge oncoming tok-toks
    for (const t of g.streetToks) {
      if (t.vz > 0 && t.z < p.z && p.z - t.z < 16 && Math.abs(t.x - p.x) < 2.2) tx = t.x > 0 ? t.x - 2.9 : t.x + 2.9;
      if (t.vx !== 0 && p.z < -88 && p.z > -104) {
        const tTok = (t.x - p.x) / -t.vx, tHero = (p.z + 103) / 8.5;
        if (tTok > -0.3 && tHero > tTok - 0.6 && tHero < tTok + 1.6 && p.z > -96) go = false;
      }
    }
    if (!go) { this.inp.world = { x: 0, z: 0 }; return; }
    this.go(tx, p.z - 6, true);
    for (const L of g.level.laundry) if (p.z - L.z > 1.2 && p.z - L.z < 3.3 && h.state === 'move') this.press('slide');
    if (p.z < -77 && p.z > -78.6 && h.state === 'move') this.press('jump');
    if (g.ball.live && g.ball.kicked && !g.ball.scored && g.ball.p.distanceTo(p) < 2.3 && this.t - this.atkT > 0.4) { this.atkT = this.t; this.press('attack'); }
  }
  market() {
    const g = this.g, h = g.hero, p = h.pos, T = g.npc.thief, R = g.thiefRun;
    if (!R) return;
    if (this.mPath !== R) { this.mPath = R; this.mi = 1; }
    const d = T.pos.distanceTo(p);
    let w = R.path[Math.min(this.mi, R.path.length - 1)];
    if (Math.hypot(w.x - p.x, w.z - p.z) < 1.4 && this.mi < R.path.length - 1) { this.mi++; w = R.path[this.mi]; }
    // close and on the same stretch: go straight for him, otherwise follow his route
    if (d < 4 && this.mi >= R.i - 1) this.go(T.pos.x, T.pos.z, true); else this.go(w.x, w.z, true);
    if (d < 2.3 && R.stun <= -0.9 && this.t - this.atkT > 0.35) { this.atkT = this.t; this.press('attack'); }
  }
  chase() {
    const g = this.g, C = g.chase, P = C.player, T = C.thief, I = this.inp;
    if (!C.active) return;
    let want = T.d;
    const clear = (d) => { let c = 60; for (const o of C.traffic) { const ds = o.s - P.s; if (ds > -1 && ds < 30 && Math.abs(o.d - d) < 1.9) c = Math.min(c, ds); } return c; };
    if (clear(want) < 26) { let bd = want, bc = -1; for (const d of [-4.6, -2.3, 0, 2.3, 4.6]) { const c = clear(d) - Math.abs(d - P.d) * 0.4; if (c > bc) { bc = c; bd = d; } } want = bd; }
    I.steer = Math.max(-1, Math.min(1, (want - P.d) * 0.45 - P.a * 2.2));
    I.throttle = 1;
    const gap = T.s - P.s;
    if (P.boost > 40 && gap < 16 && gap > 1.5 && clear(P.d) > 12) this.boosting = true;
    if (P.boost < 4 || gap < 0.5) this.boosting = false;
    I.boost = !!this.boosting;
  }
  fight() {
    const g = this.g, h = g.hero, p = h.pos;
    const foes = g.fight.list.filter((f) => !f.ko);
    if (!foes.length) { this.inp.world = { x: 0, z: 0 }; return; }
    let tgt = null, td = 1e9;
    for (const f of foes) { const d = f.pos.distanceTo(p); if (d < td) { td = d; tgt = f; } }
    const threat = foes.find((f) => (f.state === 'windup' && f.t > 0.25) || (f.state === 'punch' && f.t < 0.45)) ;
    if (threat && threat.pos.distanceTo(p) < 2.4 && h.state !== 'attack') { this.inp.blockHeld = true; this.inp.world = { x: 0, z: 0 }; return; }
    if (td > 1.9) this.go(tgt.pos.x, tgt.pos.z, false);
    else { this.inp.world = { x: 0, z: 0 }; if (this.t - this.atkT > 0.18) { this.atkT = this.t; this.press('attack'); } }
  }
  roofs() {
    const g = this.g, h = g.hero, p = h.pos;
    if (this.ri >= ROOF_ROUTE.length) return;
    // resync after a respawn
    if (this.lastY !== undefined && Math.abs(p.y - this.lastY) > 2.5 && h.state === 'move') {
      let best = 0, bd = 1e9; ROOF_ROUTE.forEach((w, i) => { const d = Math.hypot(w.x - p.x, w.z - p.z); if (d < bd && w.z < p.z + 3) { bd = d; best = i; } }); this.ri = best; this.wallStep = 0;
    }
    this.lastY = p.y;
    // back on the alley floor (respawn or a slip): start the climb route again
    if (p.y < 0.3 && p.z > -918 && this.ri > 4) { this.ri = 0; this.wallStep = 0; }
    const w = ROOF_ROUTE[this.ri];
    if (w.wall) return this.wallJump(w);
    const d = this.go(w.x, w.z, !!w.sprint);
    for (const L of g.level.laundry) if (p.z - L.z > 1.0 && p.z - L.z < 3.2 && L.bottom > p.y && L.bottom < p.y + 1.7 && h.state === 'move') { this.inp.sprint = true; this.press('slide'); }
    if (w.jumpAt && d < w.jumpAt && h.body.onGround) { this.press('jump'); this.inp.jumpHeld = true; }
    if (w.slideAt && d < w.slideAt && h.state === 'move') this.press('slide');
    if (w.jump && d < 0.8 && h.body.onGround) { this.press('jump'); this.inp.jumpHeld = true; }
    if (d < (w.jump ? 0.5 : 0.9) || (w.jump && h.state === 'air')) this.ri++;
  }
  wallJump(w) {
    const g = this.g, h = g.hero, p = h.pos, I = this.inp;
    // jump at tower A (west), kick off it toward block B (east) and grab its top
    if (this.wallStep === 0) { this.go(w.x, w.z, false); if (Math.abs(p.x - w.x) < 0.25) { this.wallStep = 1; this.press('jump'); I.jumpHeld = true; this.wt = this.t; } return; }
    if (this.wallStep === 1) { I.world = { x: -1, z: 0 }; I.jumpHeld = true; if (h.wallT > 0 && this.t - this.wt > 0.12) { this.press('jump'); this.wallStep = 2; this.wt = this.t; } if (h.body.onGround && this.t - this.wt > 0.5) this.wallStep = 0; return; }
    if (this.wallStep === 2) {
      I.world = { x: 1, z: -0.15 };
      if (p.y > 6.4 && h.body.onGround) { this.wallStep = 0; this.ri++; }
      else if (h.body.onGround && this.t - this.wt > 0.4) { this.wallStep = 0; }
      else if (h.state === 'walljump' && h.wallT > 0 && h.st > 0.25 && p.y < 6) { this.press('jump'); }
    }
  }
  jetty() {
    const g = this.g, h = g.hero, p = h.pos, L = g.level.spawns;
    this.go(0, L.jettyEnd - 20, true);
    if (p.z < L.jettyEnd + 1.3 && p.z > L.jettyEnd - 0.5 && h.body.onGround) { this.press('jump'); this.inp.jumpHeld = true; }
  }
}
