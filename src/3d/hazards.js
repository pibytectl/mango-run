// Round 3 difficulty (Andy: "too easy, it needs to be a bit harder"): moving hazards that cost hearts.
//   carts:   donkey carts loaded with greens (from Mzee's alley photos) that cross the street or work up and down a
//            market lane on a fixed back-and-forth beat: a hit is a heart and a mango out of the crate.
//   buckets: a neighbour empties a bucket of water from a balcony: a wet ring on the ground marks the spot for
//            0.9 s (aimed where he is heading), then the splash: half a heart and a slip if he is still in it.
// Everything is readable before it hurts (the ring, the donkey's bell, the cart in plain view) and the
// bot reads the same state to dodge.
import * as THREE from '../../vendor/three.module.min.js';
import { mergeGeometries } from '../../vendor/addons/BufferGeometryUtils.js';

function paint(g, c) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g.index ? g.toNonIndexed() : g; }
let cartGeo = null;
// Donkey cart (local frame: travelling toward +Z, the donkey in front). Two big spoked-look wheels, a plank bed
// with low side boards piled with greens (bunches of parsley and jarjeer, lettuces, cabbages, a few radishes),
// shafts to a grey donkey with a harness and a red tassel. One merged, vertex-coloured mesh: one draw call.
export function donkeyCartGeometry() {
  if (cartGeo) return cartGeo;
  const P = [];
  let seed = 77; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const box = (w, h, d, x, y, z, c, rx = 0, ry = 0, rz = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); P.push(paint(g, c)); };
  const cyl = (r0, r1, l, x, y, z, c, seg = 10, axis = 'y', rx = 0) => { const g = new THREE.CylinderGeometry(r0, r1, l, seg); if (axis === 'x') g.rotateZ(Math.PI / 2); if (axis === 'z') g.rotateX(Math.PI / 2); if (rx) g.rotateX(rx); g.translate(x, y, z); P.push(paint(g, c)); };
  const blob = (r, x, y, z, c, sy = 1) => { const g = new THREE.IcosahedronGeometry(r, 1); g.scale(1, sy, 1); g.translate(x, y, z); P.push(paint(g, c)); };
  const wood = [0.42, 0.29, 0.17], woodD = [0.27, 0.18, 0.11], iron = [0.16, 0.15, 0.14], tyre = [0.08, 0.08, 0.08];
  // bed, side boards, tail board
  box(1.34, 0.1, 1.9, 0, 0.66, -0.75, wood);
  for (const sx of [-1, 1]) box(0.05, 0.22, 1.9, sx * 0.66, 0.82, -0.75, woodD);
  box(1.34, 0.22, 0.05, 0, 0.82, -1.69, woodD);
  // wheels (rim, hub, a few spokes) on an axle
  for (const sx of [-1, 1]) {
    const g = new THREE.TorusGeometry(0.44, 0.045, 6, 18); g.rotateY(Math.PI / 2); g.translate(sx * 0.74, 0.46, -0.7); P.push(paint(g, tyre));
    cyl(0.07, 0.07, 0.14, sx * 0.74, 0.46, -0.7, iron, 8, 'x');
    for (let k = 0; k < 6; k++) box(0.03, 0.84, 0.035, sx * 0.74, 0.46, -0.7, woodD, k * Math.PI / 6);
  }
  cyl(0.035, 0.035, 1.5, 0, 0.46, -0.7, iron, 6, 'x');
  // shafts from the bed to the donkey's flanks
  for (const sx of [-1, 1]) box(0.06, 0.06, 2.0, sx * 0.36, 0.86, 0.85, woodD, -0.12);
  // greens: bunches standing in rows, round lettuces and cabbages, a few red radishes
  const G = [[0.16, 0.38, 0.12], [0.22, 0.46, 0.14], [0.3, 0.55, 0.2], [0.42, 0.62, 0.24], [0.12, 0.3, 0.1]];
  for (let i = 0; i < 26; i++) {
    const x = (R() - 0.5) * 1.12, z = -1.58 + R() * 1.66, c = G[Math.floor(R() * G.length)], kind = R();
    if (kind < 0.55) { cyl(0.025, 0.06, 0.32, x, 0.86, z, [0.5, 0.62, 0.3], 5); blob(0.13 + R() * 0.04, x, 1.04 + R() * 0.06, z, c, 1.25); }
    else if (kind < 0.85) blob(0.15 + R() * 0.05, x, 0.86 + R() * 0.06, z, c[1] > 0.5 ? [0.55, 0.7, 0.35] : c, 0.8);
    else blob(0.07, x, 0.82, z, [0.68, 0.12, 0.2], 1.1);
  }
  blob(0.2, 0.15, 1.18, -0.9, G[2], 0.9); blob(0.18, -0.25, 1.16, -0.4, G[1], 0.9);
  // the donkey: barrel body, legs, neck, head with a pale muzzle and long ears, tail, harness
  const grey = [0.47, 0.43, 0.39], pale = [0.78, 0.75, 0.7], dark = [0.2, 0.17, 0.15], strap = [0.3, 0.16, 0.09];
  { const g = new THREE.CapsuleGeometry(0.24, 0.62, 4, 10); g.rotateX(Math.PI / 2); g.translate(0, 1.0, 1.95); P.push(paint(g, grey)); }
  for (const [lx, lz] of [[-0.14, 2.28], [0.14, 2.28], [-0.14, 1.62], [0.14, 1.62]]) { cyl(0.05, 0.04, 0.82, lx, 0.47, lz, grey, 6); cyl(0.05, 0.05, 0.08, lx, 0.05, lz, dark, 6); }
  { const g = new THREE.CylinderGeometry(0.11, 0.16, 0.6, 8); g.rotateX(0.7); g.translate(0, 1.32, 2.42); P.push(paint(g, grey)); }
  box(0.04, 0.22, 0.5, 0, 1.48, 2.36, dark, 0.7);                                  // mane
  { const g = new THREE.CylinderGeometry(0.08, 0.13, 0.46, 8); g.rotateX(1.25); g.translate(0, 1.5, 2.78); P.push(paint(g, grey)); }
  blob(0.085, 0, 1.4, 2.98, pale, 1.0);
  for (const sx of [-1, 1]) { const g = new THREE.ConeGeometry(0.05, 0.36, 5); g.rotateZ(sx * -0.35); g.translate(sx * 0.1, 1.82, 2.66); P.push(paint(g, grey)); }
  box(0.03, 0.4, 0.03, 0, 0.9, 1.38, dark, 0.35);                                   // tail
  box(0.52, 0.08, 0.1, 0, 1.12, 2.3, strap); box(0.5, 0.36, 0.06, 0, 1.0, 2.36, strap);  // collar
  box(0.5, 0.06, 0.08, 0, 1.2, 1.9, strap);
  cyl(0.05, 0.02, 0.18, 0.12, 1.62, 2.6, [0.85, 0.12, 0.1], 5);                     // red tassel
  cartGeo = mergeGeometries(P);
  cartGeo.computeBoundingSphere();
  return cartGeo;
}
let cartMat = null;
export function donkeyCart(scene) {
  cartMat = cartMat || new THREE.MeshLambertMaterial({ vertexColors: true });
  const m = new THREE.Mesh(donkeyCartGeometry(), cartMat);
  m.castShadow = true; m.receiveShadow = true;
  const root = new THREE.Group(); root.add(m); scene.add(root);
  return root;
}
// footprint of the donkey cart in its local frame (z from the tail board to the donkey's nose)
export const CART_FOOT = { hx: 0.78, z0: -1.72, z1: 3.05 };

export class Hazards {
  constructor(game) {
    this.g = game; this.carts = []; this.buckets = [];
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.0, depthWrite: false });
    this.ringGeo = new THREE.RingGeometry(1.05, 1.3, 32); this.ringMat = ringMat;
  }
  clear() {
    for (const c of this.carts) this.g.scene.remove(c.root);
    for (const b of this.buckets) this.g.scene.remove(b.ring);
    this.carts = []; this.buckets = [];
  }
  // a cart on a back-and-forth beat along one axis ('x' or 'z') between a and b at speed v, starting at phase 0..1
  addCart(axis, fixed, a, b, v, phase = 0) {
    const root = donkeyCart(this.g.scene);
    const c = { root, axis, fixed, a, b, v, t: phase * 2 * Math.abs(b - a) / v, hit: 0, pos: new THREE.Vector3(), dir: 1 };
    this.carts.push(c); this.placeCart(c, 0); return c;
  }
  placeCart(c, dt) {
    c.t += dt;
    const L = Math.abs(c.b - c.a), per = 2 * L / c.v, u = (c.t % per) / per;
    const k = u < 0.5 ? u * 2 : 2 - u * 2;                      // 0 -> 1 -> 0
    const val = c.a + (c.b - c.a) * k, dir = (u < 0.5 ? 1 : -1) * Math.sign(c.b - c.a);
    c.dir = dir;
    if (c.axis === 'x') { c.pos.set(val, 0, c.fixed); c.root.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { c.pos.set(c.fixed, 0, val); c.root.rotation.y = dir > 0 ? 0 : Math.PI; }
    c.root.position.set(c.pos.x, Math.abs(Math.sin(c.t * 7)) * 0.015, c.pos.z);
  }
  // world-space footprint test against the hero (cylinder r) and the time until the cart reaches point p
  cartHits(c, p, r) {
    const yaw = c.root.rotation.y, s = Math.sin(yaw), co = Math.cos(yaw);
    const dx = p.x - c.pos.x, dz = p.z - c.pos.z, lx = dx * co - dz * s, lz = dx * s + dz * co;
    return Math.abs(lx) < CART_FOOT.hx + r && lz > CART_FOOT.z0 - r && lz < CART_FOOT.z1 + r;
  }
  // water from a balcony at a point ahead of him; telegraphed for `warn` seconds
  bucket(x, z, warn = 0.9) {
    const ring = new THREE.Mesh(this.ringGeo, this.ringMat.clone()); ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.04, z);
    this.g.scene.add(ring);
    const b = { ring, x, z, t: 0, warn, done: false, r: 1.3 };
    this.buckets.push(b); return b;
  }
  step(dt) {
    const g = this.g, h = g.hero, p = h.pos;
    for (const c of this.carts) {
      this.placeCart(c, dt);
      c.hit = Math.max(0, c.hit - dt);
      if (c.hit <= 0 && p.y < 1.3 && h.state !== 'vault' && this.cartHits(c, p, 0.3)) {
        c.hit = 1.6;
        const yaw = c.root.rotation.y;
        g.hurt(2, c.pos.x - Math.sin(yaw) * 0.2, c.pos.z - Math.cos(yaw) * 0.2, true);
        g.dropMango(p.x, p.y + 1.6, p.z);
        g.fx.emit(p.x, 0.5, p.z, 12, { speed: 3, up: 1.5 });
        g.log('cart hit', { hp: g.hp, z: Math.round(p.z) });
        g.hint('cart', { ar: 'خلّي بالك من عربيات الكارو!', en: 'Watch out for the donkey carts!' }, 2);
      }
    }
    for (let i = this.buckets.length - 1; i >= 0; i--) {
      const b = this.buckets[i];
      b.t += dt;
      if (b.t < b.warn) {
        const k = b.t / b.warn; b.ring.material.opacity = 0.35 + 0.5 * Math.abs(Math.sin(b.t * 14)); b.ring.scale.setScalar(1.35 - 0.35 * k);
      } else if (!b.done) {
        b.done = true; b.ring.material.opacity = 0;
        g.fx.emit(b.x, 2.6, b.z, 26, { color: 0xd8f0ff, speed: 2.2, up: -2, life: 0.7, size: 0.16, alpha: 0.85, g: 14 });
        g.fx.emit(b.x, 0.1, b.z, 16, { color: 0xbfe6ff, speed: 3.2, up: 1.4, life: 0.5, size: 0.12, alpha: 0.8 });
        g.sfxSplash && g.sfxSplash();
        if (Math.hypot(p.x - b.x, p.z - b.z) < b.r && p.y < 1.5) {
          g.hurt(1, b.x, b.z, false);
          h.body.vel.x *= 0.3; h.body.vel.z *= 0.3;
          g.log('bucket hit', { hp: g.hp, z: Math.round(p.z) });
        }
      } else if (b.t > b.warn + 0.8) { g.scene.remove(b.ring); this.buckets.splice(i, 1); }
    }
  }
}
