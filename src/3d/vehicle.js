// The tok-tok chase. Everything lives in road coordinates (s along the spline, d to the right of it), so the
// curvy road needs no collision mesh: the kerbs are |d| limits, traffic and the thief are boxes in (s, d).
import * as THREE from '../../vendor/three.module.min.js';
import { A } from './assets3d.js';
import { mergeGeometries } from '../../vendor/addons/BufferGeometryUtils.js';

const MAXV = 12.5, BOOSTV = 17.5, ACC = 6.5, STEER = 1.9;
export const TOK_LEN = 2.7, TOK_WID = 1.36;

// Tok-tok (round 2, from Mzee's photos): built in code instead of the boxy generated model. Bajaj-style
// silhouette: one front wheel under a rounded nose cowl with a headlight, sloped windscreen, open driver cab,
// passenger box with closed lower sides, a canopy roof with coloured fringe all round, bright body colour,
// invented Arabic stickers (no brands), LED dot strings. Same footprint as before (2.7 x 1.36 m, nose to +Z). Three draw calls;
// the geometry is cached per colour.
const BODY = { red: 0xc8202a, blue: 0x1f4fb0, teal: 0x15828a, yellow: 0xe0a81c, green: 0x1f8a4a, maroon: 0x7a1c2a, purple: 0x5a2a8a, black: 0x1c1c1e };
const TINT2BODY = { 0xc8d4ff: 'blue', 0x9fd0ff: 'teal', 0xffd07a: 'yellow', 0xa0e0a0: 'green', 0x88ccaa: 'green', 0xffc87a: 'yellow', 0xb0a0ff: 'purple', 0xff9a9a: 'maroon' };
const tokGeo = {};
let tokDecalMat = null;
function paint(g, c) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g.index ? g.toNonIndexed() : g; }
function tokGeometry(name) {
  if (tokGeo[name]) return tokGeo[name];
  const body = new THREE.Color(BODY[name]), dark = new THREE.Color(0x141416), chrome = new THREE.Color(0xc9c9c4), seat = new THREE.Color(0x3a2a22),
    glass = new THREE.Color(0x1d2630), roof = new THREE.Color(name === 'black' ? 0x8a1c1c : 0x18181a), lamp = new THREE.Color(0xfff2c0), red = new THREE.Color(0xd02010);
  const P = [];
  const box = (w, h, d, x, y, z, c, rx = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); g.translate(x, y, z); P.push(paint(g, c)); };
  const cyl = (r, l, x, y, z, c, seg = 12, axis = 'x') => { const g = new THREE.CylinderGeometry(r, r, l, seg); if (axis === 'x') g.rotateZ(Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2); g.translate(x, y, z); P.push(paint(g, c)); };
  // wheels: one in front, two at the back
  cyl(0.22, 0.12, 0, 0.22, 1.02, dark, 14); cyl(0.1, 0.13, 0, 0.22, 1.02, chrome, 8);
  for (const sx of [-0.6, 0.6]) { cyl(0.23, 0.16, sx, 0.23, -0.82, dark, 14); cyl(0.1, 0.17, sx, 0.23, -0.82, chrome, 8); }
  box(0.08, 0.5, 0.08, 0, 0.42, 1.0, chrome);                       // front fork
  // rounded nose cowl (a squashed half sphere) with the headlight and a chrome bumper
  { const g = new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1.05, 1.15, 0.9); g.rotateX(Math.PI / 2); g.translate(0, 0.72, 0.82); P.push(paint(g, body)); }
  box(1.0, 0.62, 0.3, 0, 0.62, 0.72, body);
  cyl(0.09, 0.1, 0, 0.98, 1.24, lamp, 10, 'z'); cyl(0.11, 0.05, 0, 0.98, 1.2, chrome, 10, 'z');
  box(1.06, 0.06, 0.06, 0, 0.42, 1.18, chrome);
  // floor + passenger box: closed lower sides, rear panel with a small window and tail lights
  box(1.3, 0.3, 2.1, 0, 0.4, -0.25, body);
  for (const sx of [-1, 1]) box(0.05, 0.5, 1.15, sx * 0.64, 0.8, -0.72, body);
  box(1.3, 1.35, 0.06, 0, 0.95, -1.32, body);
  box(0.8, 0.32, 0.02, 0, 1.38, -1.355, glass);
  for (const sx of [-0.5, 0.5]) box(0.16, 0.12, 0.03, sx, 0.62, -1.36, red);
  box(1.2, 0.18, 0.5, 0, 0.72, -1.0, seat); box(1.2, 0.45, 0.1, 0, 0.98, -1.22, seat);   // bench
  box(0.5, 0.14, 0.45, 0, 0.84, 0.15, seat);                                           // driver seat
  // windscreen (sloped) and the handlebar
  box(1.02, 0.68, 0.04, 0, 1.38, 0.86, glass, -0.3);
  box(0.6, 0.04, 0.04, 0, 1.06, 0.62, dark);
  // pillars and the canopy roof with rounded edges
  for (const [x, z] of [[-0.6, 0.74], [0.6, 0.74], [-0.62, -1.28], [0.62, -1.28], [-0.62, -0.18], [0.62, -0.18]]) box(0.05, 0.75, 0.05, x, 1.42, z, chrome);
  box(1.36, 0.06, 2.2, 0, 1.8, -0.25, roof);
  for (const sx of [-1, 1]) cyl(0.06, 2.2, sx * 0.66, 1.79, -0.25, roof, 8, 'z');
  box(1.38, 0.1, 0.08, 0, 1.78, 0.85, roof);
  const g = mergeGeometries(P);
  return (tokGeo[name] = g);
}
function decalMaterial() {
  if (tokDecalMat) return tokDecalMat;
  // 512x256: top half the fringe strip, bottom half two stickers (invented, no brands)
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
  const cols = ['#e8c21c', '#d0202a', '#1f8a4a', '#2a5ad0', '#ffffff', '#e86a1c'];
  x.fillStyle = '#e8c21c'; x.fillRect(0, 0, 512, 14);
  for (let i = 0; i < 64; i++) { x.fillStyle = cols[i % cols.length]; x.beginPath(); x.moveTo(i * 8, 14); x.lineTo(i * 8 + 8, 14); x.lineTo(i * 8 + 4, 70 + (i % 3) * 14); x.fill(); x.beginPath(); x.arc(i * 8 + 4, 74 + (i % 3) * 14, 3, 0, 7); x.fill(); }
  const sticker = (X, txt, bg, fg) => { x.fillStyle = bg; x.beginPath(); x.roundRect(X + 6, 140, 244, 100, 22); x.fill(); x.strokeStyle = fg; x.lineWidth = 5; x.stroke();
    x.fillStyle = fg; x.font = '900 42px CairoGame, "Noto Naskh Arabic", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl'; x.fillText(txt, X + 128, 192, 220); };
  sticker(0, 'متبصليش بعين ردية', '#ffd23f', '#a01010');
  sticker(256, 'يا رب سترك', '#ffffff', '#1f4fb0');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (tokDecalMat = new THREE.MeshLambertMaterial({ map: t, transparent: false, alphaTest: 0.5, side: THREE.DoubleSide }));
}
let tokDecalGeo = null;
function decalGeometry() {
  if (tokDecalGeo) return tokDecalGeo;
  const parts = [];
  const quad = (w, h, x, y, z, ry, u0, v0, u1, v1) => { const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv; uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0); g.rotateY(ry); g.translate(x, y, z); parts.push(g); };
  // fringe on all four roof edges (0.3 m deep), stickers on the back and on both sides of the cowl
  for (const sx of [-1, 1]) quad(2.2, 0.3, sx * 0.69, 1.62, -0.25, Math.PI / 2, 0, 0.72, 1, 1);
  quad(1.36, 0.3, 0, 1.62, 0.9, 0, 0, 0.72, 1, 1); quad(1.36, 0.3, 0, 1.62, -1.37, 0, 0, 0.72, 1, 1);
  quad(0.62, 0.25, 0, 0.98, -1.37, Math.PI, 0, 0.04, 0.5, 0.45);
  for (const sx of [-1, 1]) quad(0.48, 0.2, sx * 0.53, 0.75, 0.72, sx * Math.PI / 2, 0.5, 0.04, 1, 0.45);
  return (tokDecalGeo = mergeGeometries(parts));
}
// strings of coloured LED dots along the roof edge and round the nose (Cairo night decoration), unlit
let ledGeo = null, ledMat = null;
function ledMesh() {
  if (!ledGeo) {
    const P = [], cols = [0x2a7bff, 0x22e070, 0xff2a3a, 0xffd23a].map((h) => new THREE.Color(h));
    const dot = (x, y, z, i) => { const g = new THREE.BoxGeometry(0.035, 0.035, 0.035); g.translate(x, y, z); P.push(paint(g, cols[i % 4])); };
    let i = 0;
    for (const sx of [-1, 1]) for (let z = -1.3; z <= 0.84; z += 0.14) dot(sx * 0.7, 1.74, z, i++);
    for (let x = -0.62; x <= 0.62; x += 0.14) { dot(x, 1.74, 0.9, i++); dot(x, 1.74, -1.36, i++); }
    for (let k = 0; k <= 10; k++) { const a = Math.PI * (0.1 + 0.8 * k / 10); dot(Math.cos(a) * 0.53, 0.72 + Math.sin(a) * 0.5, 1.02, i++); }
    ledGeo = mergeGeometries(P); ledMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  }
  return new THREE.Mesh(ledGeo, ledMat);
}
export function makeTok(scene, tint) {
  const name = tint ? (TINT2BODY[tint] || 'yellow') : 'red';
  const m = new THREE.Group();
  const body = new THREE.Mesh(tokGeometry(name), tokMat()); body.castShadow = true; body.receiveShadow = true;
  const dec = new THREE.Mesh(decalGeometry(), decalMaterial());
  m.add(body, dec, ledMesh());
  const root = new THREE.Group(); const lean = new THREE.Group(); lean.add(m); root.add(lean);
  scene.add(root);
  return { root, lean, m };
}
// The Imbaba ferry (local frame: bow to -Z, deck top at y 0.35, the walkable deck is x +-1.45, z +-4.2)
export function makeFerry() {
  const P = [];
  const C = (h) => new THREE.Color(h);
  const box = (w, h, d, x, y, z, c, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); P.push(paint(g, C(c))); };
  const post = (x, z, y0, y1, c, t = 0.07) => box(t, y1 - y0, t, x, (y0 + y1) / 2, z, c);
  const white = 0xe9e6dc, blue = 0x2456a8, hull = 0x2a2f33, teal = 0x1f8a8a, wood = 0x7a5a3a, rust = 0x7a4a2a;
  // hull: dark below the water line, white topsides, blue band, a tapered bow
  box(3.0, 0.7, 7.6, 0, -0.25, 0.4, hull); box(3.04, 0.42, 7.64, 0, 0.17, 0.4, white); box(3.06, 0.1, 7.66, 0, 0.0, 0.4, blue);
  for (let i = 0; i < 4; i++) { const w = 2.7 - i * 0.62, z = -3.55 - i * 0.28; box(w, 1.05, 0.3, 0, -0.08, z, i % 2 ? white : 0xdcd8cc); }
  box(2.9, 0.06, 8.4, 0, 0.33, 0, wood);                                    // plank deck
  for (let z = -3.9; z < 4.2; z += 0.42) box(2.9, 0.012, 0.03, 0, 0.365, z, 0x5a4028);
  // tyre fenders along both sides
  for (const sx of [-1, 1]) for (let z = -2.6; z <= 3.6; z += 1.24) { const g = new THREE.TorusGeometry(0.2, 0.08, 6, 12); g.rotateY(Math.PI / 2); g.translate(sx * 1.6, 0.05, z); P.push(paint(g, C(0x111111))); }
  // side benches and the rails
  for (const sx of [-1, 1]) { box(0.4, 0.08, 6.4, sx * 1.2, 0.72, -0.3, wood); box(0.36, 0.38, 0.05, sx * 1.2, 0.53, -0.3, 0x5a4028); }
  for (const sx of [-1, 1]) { box(0.05, 0.05, 7.6, sx * 1.47, 1.15, -0.2, white); box(0.04, 0.04, 7.6, sx * 1.47, 0.78, -0.2, white); for (let z = -3.9; z <= 3.7; z += 0.95) post(sx * 1.47, z, 0.35, 1.15, white, 0.05); }
  // canopy on posts (roof at 2.6 m, well above head height) with a decorative rail on top
  for (const sx of [-1, 1]) for (const z of [-3.3, -1.6, 0.1, 1.8, 3.5]) post(sx * 1.38, z, 0.35, 2.6, white, 0.08);
  box(3.2, 0.1, 7.6, 0, 2.65, 0.1, 0xf2efe6); box(3.24, 0.18, 7.64, 0, 2.55, 0.1, blue);
  for (const sx of [-1, 1]) { box(0.05, 0.05, 7.4, sx * 1.55, 3.05, 0.1, white); for (let z = -3.5; z <= 3.7; z += 0.6) post(sx * 1.55, z, 2.7, 3.05, white, 0.04); }
  for (const zz of [-3.6, 3.8]) box(3.1, 0.05, 0.05, 0, 3.05, zz, white);
  // wheelhouse at the bow end of the canopy (teal, dark windows) and a life ring
  box(1.4, 0.95, 1.1, -0.5, 3.15, -2.9, teal); box(1.3, 0.38, 1.12, -0.5, 3.3, -2.9, 0x14202a); box(1.6, 0.08, 1.3, -0.5, 3.66, -2.9, white);
  { const g = new THREE.TorusGeometry(0.26, 0.07, 6, 14); g.translate(1.5, 0.95, 2.6); g.rotateY(0); P.push(paint(g, C(0xe8641c))); }
  { const g = new THREE.TorusGeometry(0.26, 0.07, 6, 14); g.rotateY(Math.PI / 2); g.translate(1.52, 0.95, 2.4); P.push(paint(g, C(0xe8641c))); }
  // flag at the stern: red / white / black
  post(1.35, 4.0, 0.35, 3.6, rust, 0.05);
  box(0.02, 0.22, 0.72, 1.35, 3.42, 3.62, 0xc8202a); box(0.02, 0.22, 0.72, 1.35, 3.2, 3.62, 0xf2f2f2); box(0.02, 0.22, 0.72, 1.35, 2.98, 3.62, 0x161616);
  const m = new THREE.Mesh(mergeGeometries(P), tokMat()); m.castShadow = true; m.receiveShadow = true;
  // name board on both sides of the canopy edge
  const c = document.createElement('canvas'); c.width = 512; c.height = 80; const x = c.getContext('2d');
  x.fillStyle = '#f2efe6'; x.fillRect(0, 0, 512, 80); x.fillStyle = '#1d3f8a'; x.font = '900 46px CairoGame, "Noto Naskh Arabic", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
  x.fillText('معدية إمبابة ـ الوراق', 256, 44, 490);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const nm = new THREE.MeshLambertMaterial({ map: t });
  const g = new THREE.Group(); g.add(m);
  for (const sx of [-1, 1]) { const q = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.17), nm); q.position.set(sx * 1.633, 2.55, 0.4); q.rotation.y = sx * Math.PI / 2; g.add(q); }
  return g;
}
let _tokMat = null;
function tokMat() { return _tokMat || (_tokMat = new THREE.MeshLambertMaterial({ vertexColors: true })); }

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
