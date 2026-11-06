// Round 4 rooftop traps (Andy: "still not difficult"), all readable before they hurt:
//   crumble: concrete cornice pieces and rotten tin sheets that crack the moment he lands on one (dust, a shake,
//            a crack sound) and drop 0.5 s later: keep moving or fall into the alley (a heart, a mango, the
//            last checkpoint). One instanced mesh, one draw call.
//   plank:   a neighbour's board that slides across a 7.5 m gap, rests there for a moment and slides back: the
//            gap is crossed only while it is out (once on it he rides it safely).
//   jug:     the one refill of the mission, a clay water jug (qulla) a little off the line on the first roof.
import * as THREE from '../../vendor/three.module.min.js';
import { mergeGeometries } from '../../vendor/addons/BufferGeometryUtils.js';

const CRACK = 0.5;                                  // seconds from the first step to the drop
const PLANK = { out: 1.0, hold: 1.7, back: 1.0, rest: 1.5 };   // the plank's beat (s)

export class RoofTraps {
  constructor(game) {
    this.g = game;
    const L = game.level.spawns, P = game.phys, S = game.scene;
    // ---- crumbling pieces
    this.pieces = L.crumble.map((c) => ({ ...c, box: P.add(c.x0, c.y - c.th, c.z0, c.x1, c.y, c.z1, { kind: 'crumble', noClimb: true }), t: -1, drop: 0, vy: 0, off: 0, rot: 0 }));
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, this.pieces.length);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    const cCornice = new THREE.Color(0x8e877c), cCornice2 = new THREE.Color(0x7b7368), cTin = new THREE.Color(0x7a5f48);
    this.pieces.forEach((p, i) => this.mesh.setColorAt(i, p.kind === 'tin' ? cTin : i % 2 ? cCornice : cCornice2));
    S.add(this.mesh);
    // dark crack lines drawn over each cornice piece (merged into the same instance via a second thin box would
    // cost a call; the alternating tones and the rusty tin read as "different, weak" well enough)
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3();
    // ---- the plank and the jug (Mission 1 only; Mission 2 uses the crumbling pieces)
    if (!L.plank) { this.plank = null; this.jug = null; this.reset(); this.show(false); return; }
    const K = this.plankDef = L.plank;
    const wood = new THREE.MeshLambertMaterial({ color: 0x8a6a46 });
    // the board and two cross battens under it (so it reads as a board, not a slab): one mesh
    const parts = [new THREE.BoxGeometry(K.hw * 2, 0.1, K.len)];
    for (const dz of [-K.len * 0.3, K.len * 0.3]) { const b = new THREE.BoxGeometry(K.hw * 2 + 0.06, 0.05, 0.14); b.translate(0, -0.06, dz); parts.push(b); }
    this.plank = new THREE.Mesh(mergeGeometries(parts), wood); this.plank.castShadow = true; this.plank.receiveShadow = true; S.add(this.plank);
    this.plankBox = P.add(-K.hw, K.y - 0.1, -1, K.hw, K.y, 1, { dynamic: true, kind: 'plank', noClimb: true });
    // ---- the water jug
    const pts = [[0, 0], [0.09, 0.01], [0.15, 0.08], [0.17, 0.2], [0.14, 0.31], [0.07, 0.38], [0.05, 0.46], [0.065, 0.5], [0, 0.5]].map(([x, y]) => new THREE.Vector2(x, y));
    this.jug = new THREE.Mesh(new THREE.LatheGeometry(pts, 12), new THREE.MeshLambertMaterial({ color: 0xb4683c }));
    this.jug.castShadow = true; this.jug.scale.setScalar(1.25); S.add(this.jug);
    this.jugRing = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.52, 24), new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    this.jugRing.rotation.x = -Math.PI / 2; S.add(this.jugRing);
    this.mesh.visible = false; this.reset(); this.show(false);
  }
  // drawn only on the rooftops (elsewhere they would only cost draw calls far down the view)
  show(on) {
    this.mesh.visible = on;
    if (this.plank) { this.plank.visible = on; this.jug.visible = this.jugRing.visible = on && !this.g.jugTaken; }
  }
  reset() {
    for (const p of this.pieces) { p.t = -1; p.drop = 0; p.vy = 0; p.off = 0; p.rot = 0; p.box.on = true; }
    this.pieces.forEach((p, i) => this.place(p, i));
    this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    if (!this.plank) return;
    this.pt = 0.4; this.placePlank(0);
    const J = this.g.level.spawns.jug;
    this.jug.visible = this.jugRing.visible = this.mesh.visible && !this.g.jugTaken;
    this.jug.position.set(J.x, J.y, J.z); this.jugRing.position.set(J.x, J.y + 0.03, J.z);
  }
  place(p, i) {
    const sx = p.x1 - p.x0, sz = p.z1 - p.z0;
    const shake = p.t >= 0 && p.t < CRACK ? (Math.random() - 0.5) * 0.05 * (0.4 + p.t / CRACK) : 0;
    this._v.set((p.x0 + p.x1) / 2 + shake, p.y - p.th / 2 - p.off, (p.z0 + p.z1) / 2 + shake);
    this._q.setFromEuler(this._e.set(p.rot * 0.7, 0, p.rot));
    this._s.set(p.drop > 2.2 ? 0.0001 : sx, p.th, sz);
    this._m.compose(this._v, this._q, this._s);
    this.mesh.setMatrixAt(i, this._m);
  }
  // 0..1 along the beat: 0 retracted, 1 out across the gap
  plankOut(t) {
    const B = PLANK, T = B.out + B.hold + B.back + B.rest, u = ((t % T) + T) % T;
    if (u < B.out) return u / B.out;
    if (u < B.out + B.hold) return 1;
    if (u < B.out + B.hold + B.back) return 1 - (u - B.out - B.hold) / B.back;
    return 0;
  }
  // seconds the plank stays fully out from now (0 when it is not out), for the bot and the hint
  plankHoldLeft() {
    if (!this.plank) return 0;
    const B = PLANK, T = B.out + B.hold + B.back + B.rest, u = ((this.pt % T) + T) % T;
    return u >= B.out && u < B.out + B.hold ? B.out + B.hold - u : 0;
  }
  placePlank(dt) {
    const K = this.plankDef, prev = this.plankZ;
    const k = this.plankOut(this.pt), s = k * k * (3 - 2 * k);
    const tip = K.zRet + (K.zExt - K.zRet) * s;          // the end toward R3 (larger z)
    const cz = tip - K.len / 2;
    this.plankZ = cz;
    this.plank.position.set(0, K.y - 0.05, cz);
    Object.assign(this.plankBox, { x0: -K.hw, x1: K.hw, z0: cz - K.len / 2, z1: cz + K.len / 2, y0: K.y - 0.1, y1: K.y, vx: 0, vz: dt > 0 && prev !== undefined ? (cz - prev) / dt : 0 });
  }
  step(dt) {
    const g = this.g, h = g.hero, b = h.body;
    // crumbling pieces
    let dirty = false;
    this.pieces.forEach((p, i) => {
      if (p.t < 0 && b.onGround && b.platform === p.box) {
        p.t = 0; g.onTrap('crack', p);
      }
      if (p.t >= 0) {
        p.t += dt;
        if (p.t >= CRACK && p.box.on) { p.box.on = false; g.onTrap('drop', p); }
        if (!p.box.on) { p.vy += 18 * dt; p.off += p.vy * dt; p.rot += dt * (i % 2 ? 1.2 : -1.4); p.drop += dt; }
        if (p.drop < 2.5) { this.place(p, i); dirty = true; }
      }
    });
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
    if (!this.plank) return;
    // the plank
    this.pt += dt; this.placePlank(dt);
    // the jug
    if (this.jug.visible) {
      const J = this.jug.position, k = 1 + 0.12 * Math.sin(g.elapsed * 5);
      this.jugRing.scale.set(k, k, k);
      if (Math.hypot(h.pos.x - J.x, h.pos.z - J.z) < 0.95 && Math.abs(h.pos.y - J.y) < 1 && g.hp < 6) {
        this.jug.visible = this.jugRing.visible = false; g.onTrap('jug');
      }
    }
  }
}
