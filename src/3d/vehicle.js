// The tok-tok chase. Everything lives in road coordinates (s along the spline, d to the right of it), so the
// curvy road needs no collision mesh: the kerbs are |d| limits, traffic and the thief are boxes in (s, d).
import * as THREE from '../../vendor/three.module.min.js';
import { A } from './assets3d.js';

const MAXV = 12.5, BOOSTV = 17.5, ACC = 6.5, STEER = 1.9;
export const TOK_LEN = 2.7, TOK_WID = 1.36;

export function makeTok(scene, tint) {
  const m = A.glb.tuktuk.scene.clone();
  const bb = new THREE.Box3().setFromObject(m);
  m.position.y = -bb.min.y;
  m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (tint) { o.material = o.material.clone(); o.material.color.set(tint); } } });
  const root = new THREE.Group(); const lean = new THREE.Group(); lean.add(m); root.add(lean);
  m.rotation.y = -Math.PI / 2; // nose (+X) to +Z
  scene.add(root);
  return { root, lean, m };
}

export class Chase {
  constructor(game) {
    this.g = game; this.road = game.level.roadInfo;
    this.player = { s: 6, d: -2, a: 0, v: 0, boost: 100, boosting: false, tok: makeTok(game.scene), bumpT: 0, wallT: 0, roll: 0 };
    this.thief = { s: 22, d: 2, a: 0, v: 0, tok: makeTok(game.scene, 0xc8d4ff), wob: 0, wantD: 2, drops: 0 };
    this.traffic = [];
    this.active = false;
    this.tmp = {};
    this.hide();
  }
  hide() { this.player.tok.root.visible = false; this.thief.tok.root.visible = false; for (const t of this.traffic) t.tok.root.visible = false; }
  // parked positions before the chase (at the market exit)
  park() {
    const P = this.player, T = this.thief;
    P.s = 6; P.d = -2.4; P.a = 0; P.v = 0; T.s = 6; T.d = 2; T.v = 0; T.a = 0;
    P.tok.root.visible = T.tok.root.visible = true;
    this.place(P); this.place(T);
  }
  start(fromCp) {
    const P = this.player, T = this.thief;
    this.active = true; this.t = 0; this.escapeT = 0; this.ended = false;
    P.s = 6; P.d = -2; P.a = 0; P.v = fromCp ? 6 : 3; P.boost = 100;
    T.s = fromCp ? 26 : 20; T.d = 2; T.a = 0; T.v = 9; T.drops = 0; T.wob = 0;
    P.tok.root.visible = T.tok.root.visible = true;
    // traffic: same-direction (d > 0, slower) and oncoming (d < 0)
    for (const t of this.traffic) this.g.scene.remove(t.tok.root);
    this.traffic = [];
    const R = this.g.level.R;
    const tints = [null, 0x88ccaa, 0xffc87a, 0xb0a0ff, 0xff9a9a];
    for (let s = 60; s < this.road.len - 60; s += 17 + R() * 15) {
      const onc = R() < 0.42;
      const kind = R() < 0.18 ? 'cart' : 'tok';
      const t = { s, d: onc ? -2.4 - R() * 2.2 : 1.6 + R() * 3, v: onc ? -(6 + R() * 4) : (kind === 'cart' ? 1.5 : 5 + R() * 4), kind, len: kind === 'cart' ? 2.4 : TOK_LEN, wid: kind === 'cart' ? 1.2 : TOK_WID };
      if (kind === 'cart') {
        const m = A.glb.cart.scene.clone(); m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        const root = new THREE.Group(), lean = new THREE.Group(); m.rotation.y = -Math.PI / 2; lean.add(m); root.add(lean); this.g.scene.add(root);
        t.tok = { root, lean, m };
      } else t.tok = makeTok(this.g.scene, tints[Math.floor(R() * tints.length)]);
      this.traffic.push(t);
    }
    this.mangoT = 0;
  }
  stop() {
    this.active = false;
    for (const t of this.traffic) this.g.scene.remove(t.tok.root);
    this.traffic = [];
  }
  place(o, extraRoll = 0) {
    const p = this.road.at(o.s, o.d, this.tmp);
    const fx = p.tx * Math.cos(o.a) + -p.tz * Math.sin(o.a), fz = p.tz * Math.cos(o.a) + p.tx * Math.sin(o.a);
    o.x = p.x; o.z = p.z; o.yaw = Math.atan2(fx, fz);
    o.tok.root.position.set(p.x, 0, p.z);
    o.tok.root.rotation.y = o.yaw;
    o.tok.lean.rotation.z = (o.roll || 0) + extraRoll;
    o.tok.lean.position.y = Math.abs(Math.sin((o.s || 0) * 1.7)) * 0.025 * Math.min(1, Math.abs(o.v || 0) / 8);
  }
  overlap(a, b, la = TOK_LEN, wa = TOK_WID, lb = TOK_LEN, wb = TOK_WID) {
    return Math.abs(a.s - b.s) < (la + lb) * 0.45 && Math.abs(a.d - b.d) < (wa + wb) * 0.5;
  }
  step(dt, I) {
    if (!this.active) return;
    const g = this.g, P = this.player, T = this.thief, W = this.road.W - 0.85;
    this.t += dt;
    // --- player
    const boosting = I.boost && P.boost > 3;
    P.boosting = boosting;
    if (boosting) P.boost = Math.max(0, P.boost - 34 * dt); else P.boost = Math.min(100, P.boost + 11 * dt);
    const top = (boosting ? BOOSTV : MAXV) * (I.throttle < 0 ? 0.25 : 1);
    P.v += Math.sign(top - P.v) * Math.min(Math.abs(top - P.v), (top > P.v ? (boosting ? ACC * 1.6 : ACC) : 10) * dt);
    const steer = THREE.MathUtils.clamp(I.steer, -1, 1);
    P.a += steer * STEER * dt * Math.min(1, 0.35 + P.v / 10);
    P.a *= Math.max(0, 1 - (Math.abs(steer) < 0.1 ? 3.5 : 1.0) * dt);
    P.a = THREE.MathUtils.clamp(P.a, -0.55, 0.55);
    P.roll += (-steer * 0.09 * Math.min(1, P.v / 10) - P.roll) * Math.min(1, 6 * dt);
    P.s += P.v * Math.cos(P.a) * dt; P.d += P.v * Math.sin(P.a) * dt;
    P.wallT -= dt; P.bumpT -= dt;
    if (Math.abs(P.d) > W) {
      P.d = Math.sign(P.d) * W; P.a *= -0.3; P.v *= Math.max(0.7, 1 - 2.2 * dt * 10);
      if (P.wallT <= 0) { P.wallT = 0.4; g.onChase('wall', P); }
    }
    // --- thief AI: pick the clearest lane ahead, rubber-banded speed
    const gap = T.s - P.s;
    // rubber band: ahead he cruises a touch under your top speed; up close he floors it, so the boost is
    // what lets you ram him
    let want = MAXV * 0.92;
    if (gap > 30) want = MAXV * 0.78; else if (gap > 20) want = MAXV * 0.86; else if (gap < 6) want = MAXV * 1.04;
    if (T.s > this.road.len - 60) want = Math.min(want, MAXV * 0.85);
    T.v += Math.sign(want - T.v) * Math.min(Math.abs(want - T.v), 6 * dt);
    if (this.t % 0.25 < dt) {
      let best = T.wantD, bestScore = -1e9;
      for (const d of [-4.5, -2.2, 0, 2.2, 4.5]) {
        let clear = 40;
        for (const o of this.traffic) { const ds = o.s - T.s; if (ds > -2 && ds < 40 && Math.abs(o.d - d) < 1.8) clear = Math.min(clear, ds); }
        const score = clear * 2 - Math.abs(d - T.d) * 1.5 + Math.sin(this.t * 0.7 + d) * 2;
        if (score > bestScore) { bestScore = score; best = d; }
      }
      T.wantD = best;
    }
    if (T.s > this.road.len - 50) T.wantD = 1.4; // heading for the alley
    T.wob *= Math.max(0, 1 - 3 * dt);
    T.a = THREE.MathUtils.clamp((T.wantD - T.d) * 0.12, -0.35, 0.35) + Math.sin(this.t * 9) * T.wob;
    T.roll = -T.a * 0.15;
    T.s += T.v * Math.cos(T.a) * dt; T.d = THREE.MathUtils.clamp(T.d + T.v * Math.sin(T.a) * dt, -W, W);
    // --- traffic
    for (const o of this.traffic) {
      o.s += o.v * dt;
      o.bumpV = (o.bumpV || 0) * Math.max(0, 1 - 4 * dt);
      o.d = THREE.MathUtils.clamp(o.d + (o.bumpV || 0) * dt, -W, W);
      o.a = o.v < 0 ? Math.PI : 0;
      this.place(o);
      o.tok.root.visible = Math.abs(o.s - P.s) < 160;
      if (this.overlap(P, o, TOK_LEN, TOK_WID, o.len, o.wid) && P.bumpT <= 0) {
        P.bumpT = 0.7;
        const rel = P.v - o.v;
        P.v = Math.max(2, P.v - Math.abs(rel) * 0.55 - 2);
        const side = Math.sign(P.d - o.d) || 1;
        P.d += side * 0.4; P.a = side * 0.25; o.bumpV = -side * 3;
        g.onChase('crash', P, o);
      }
      if (this.overlap(T, o, TOK_LEN, TOK_WID, o.len, o.wid)) { T.d += Math.sign(T.d - o.d || 1) * 1.5 * dt * 10; T.v *= 0.97; }
    }
    // --- player vs thief
    if (this.overlap(P, T) && P.bumpT <= 0) {
      P.bumpT = 0.6;
      const side = Math.sign(T.d - P.d) || 1;
      T.d += side * 0.6; T.wob = 0.35; P.v = Math.max(P.v * 0.8, T.v * 0.9); P.a = -side * 0.12;
      g.onChase('bump', P, T);
    }
    if (P.s > T.s - 0.5 && Math.abs(P.d - T.d) < TOK_WID) { P.s = T.s - 0.6; P.v = Math.min(P.v, T.v); }
    this.place(P); this.place(T);
    // escape check / end
    if (gap > 75) this.escapeT += dt; else this.escapeT = 0;
    if (this.escapeT > 4) { this.ended = true; g.onChase('escaped'); }
    else if (T.s > this.road.len - 34 && !this.ended) { this.ended = true; g.onChase(gap < 45 ? 'end' : 'escaped'); }
  }
  // world position helper for seats
  seat(o, fwd, up, side = 0) {
    const sy = Math.sin(o.yaw), cy = Math.cos(o.yaw);
    return new THREE.Vector3(o.x + sy * fwd + cy * side, up, o.z + cy * fwd - sy * side);
  }
}
