// Imbaba, built procedurally. Forward is -Z (west, toward the Nile and the sunset).
//   plaza (microbus stand)  z -52..-86   street run   z -86..-188    market (foot chase)  z -188..-312
//   road (tok-tok chase)    z -315..-880 along a spline               alley fight          z -884..-918
//   rooftops                z -918..-1040                             corniche + jetty     z -1040..-1106, Nile beyond
import * as THREE from '../../vendor/three.module.min.js';
import { mergeGeometries } from '../../vendor/addons/BufferGeometryUtils.js';
import { Builder, rng, atlasMaterial } from './builder.js';
import { A } from './assets3d.js';
import { donkeyCart, CART_FOOT } from './hazards.js';

const FLOOR0 = 3.4, FLOOR = 3.2, TILE = 6.4, SHOP_W = 5.1;
// Round 2 (pacing): the microbus stand moved 86 m down the street, so the run to the market (and the theft)
// is ~100 m instead of ~190 m. Everything in the plaza and the intro is placed relative to it.
export const PLAZA_Z = -86;
export const ROOF = { // heights of the rooftop route
  r1: 4.8, r2: 4.8, r3: 2.6, r4: 3.2, b: 6.6, a: 9.5, r5: 7.0,
};

export function makeMaterials() {
  const T = A.tex;
  const L = (o) => new THREE.MeshLambertMaterial(o);
  // Imbaba facades (round 2): bare red brick in a grey concrete frame (three layouts) and faded Cairo plaster.
  // Facades, shopfronts, props, coops, roofs and the Arabic shop signs live in two atlases (see ATLAS), so a
  // town chunk is ~6 draw calls instead of one per texture.
  T.atlas_facades.anisotropy = T.ground_r2.anisotropy;
  const m = {
    facades: atlasMaterial(T.atlas_facades), town: atlasMaterial(townAtlas(T.atlas_town.image, T.ground_r2.anisotropy)),
    street: L({ map: T.ground_r2 }), market: L({ map: T.ground_market }),
    wood: L({ map: T.wood_planks }), khay: L({ map: T.khayamiya, side: THREE.DoubleSide }), produce: L({ map: T.produce }),
    kgoods: L({ map: T.kiosk_goods }), katlas: L({ map: kioskAtlas(T.fridge.image) }), prices: L({ map: priceCards(), side: THREE.DoubleSide }),
    paint: L({ vertexColors: true }),
    laundry: L({ map: T.laundry, alphaTest: 0.45, side: THREE.DoubleSide }),
    // round 3: grime and water streaks (four variants in one canvas), drawn just off the wall
    grime: L({ map: grimeTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
  };
  m.grime.userData.noCast = true;
  m.laundry.userData.noCast = true;
  T.laundry.wrapS = THREE.RepeatWrapping;
  T.produce.wrapS = THREE.RepeatWrapping;
  return m;
}

// atlas tiles in pixels (origin top-left of the 2048 image); layout written by tools/tex3d.py atlas
const ATLAS = {
  f_brick_a: ['facades', 0, 0, 1024, 1024], f_brick_b: ['facades', 1024, 0, 1024, 1024], f_brick_c: ['facades', 0, 1024, 1024, 1024], f_ochre: ['facades', 1024, 1024, 1024, 1024],
  f_pale: ['town', 0, 0, 1024, 1024], brickwall: ['town', 1024, 0, 512, 512], crate: ['town', 1536, 0, 512, 512], burlap: ['town', 1024, 512, 512, 512], barrier: ['town', 1536, 512, 512, 512],
  shop: ['town', 0, 1024, 1024, 512], shut: ['town', 1024, 1024, 1024, 512], coop: ['town', 0, 1536, 512, 512], roof: ['town', 512, 1536, 512, 512], signs: ['town', 1024, 1536, 1024, 512, true],
};
const VIRT = Object.fromEntries(Object.entries(ATLAS).map(([k, [mat, x, y, w, h, clamp]]) => [k, { mat, tile: [x / 2048, 1 - (y + h) / 2048, (clamp ? -w : w) / 2048, h / 2048] }]));
const SILHOUETTE = new THREE.MeshBasicMaterial({ color: 0x5a3a3c, fog: false });
const FACADES = ['f_brick_a', 'f_brick_b', 'f_brick_c', 'f_brick_a', 'f_ochre', 'f_pale'];
// round 3: painted ground floors (a multiply on the shopfront texture): teal, yellow, pink, sky blue
const PAINTED = [[0.5, 0.98, 0.92], [1.18, 1.02, 0.5], [1.18, 0.74, 0.84], [0.66, 0.86, 1.18]];
// a tint per building so the same facade tile never repeats exactly: brick a little warmer or greyer, darker
// or sun-bleached; plaster in the faded Cairo colours (rose, mint, sky, sand)
function facadeTint(fac, R) {
  if (fac === 'f_pale' || fac === 'f_ochre') {
    const P = [[1.06, 0.93, 0.86], [0.9, 1.02, 0.92], [0.9, 0.95, 1.06], [1.05, 0.98, 0.82], [1, 1, 1], [0.84, 0.82, 0.8]];
    const p = P[Math.floor(R() * P.length)], k = 0.9 + R() * 0.16; return p.map((v) => v * k);
  }
  const k = 0.84 + R() * 0.26; return [k * (0.97 + R() * 0.08), k * (0.95 + R() * 0.07), k * (0.93 + R() * 0.08)];
}
const C = {
  plaster: [0.86, 0.74, 0.58], plasterDark: [0.62, 0.5, 0.38], concrete: [0.66, 0.64, 0.6], wood: [0.5, 0.33, 0.2], woodDark: [0.33, 0.21, 0.13],
  iron: [0.16, 0.15, 0.15], tank: [0.12, 0.13, 0.16], tankBlue: [0.2, 0.32, 0.55], ac: [0.86, 0.86, 0.82], sand: [0.8, 0.68, 0.48],
  brick: [0.62, 0.32, 0.22], rope: [0.85, 0.8, 0.7], white: [0.95, 0.94, 0.9], blue: [0.18, 0.36, 0.66], glass: [0.12, 0.14, 0.18], tyre: [0.08, 0.08, 0.08],
  brass: [0.85, 0.62, 0.25], red: [0.7, 0.16, 0.12], green: [0.2, 0.45, 0.25], sack: [0.78, 0.7, 0.52],
  pole: [0.3, 0.21, 0.14], pole2: [0.4, 0.29, 0.18], rust: [0.36, 0.2, 0.12], kred: [0.78, 0.1, 0.1], kblue: [0.1, 0.27, 0.68], carton: [0.72, 0.58, 0.4],
};

export class Level {
  constructor(scene, phys) {
    this.scene = scene; this.phys = phys;
    this.mats = makeMaterials();
    this.B = new Builder(this.mats, VIRT);
    this.R = rng(1405);
    this.root = new THREE.Group(); scene.add(this.root);
    this.tanks = []; this.dishes = []; this.acs = [];
    this.laundry = []; this.props = []; this.wires = [];
    this.spawns = {};
    this.carts = []; this.stalls = []; this.fruit = []; this.melons = []; this.bulbs = [];
  }

  build() {
    this.ground();
    this.plaza();
    this.street();
    this.market();
    this.road();
    this.alley();
    this.rooftops();
    this.jetty();
    this.distant();
    this.meshes = this.B.finish(this.root);
    // the far Nile bank (~300 m off) as a dark sunset silhouette, not fog-white blocks
    for (const m of this.meshes) if (m.geometry.boundingSphere.center.z < -1300) { m.material = SILHOUETTE; m.castShadow = m.receiveShadow = false; }
    this.instanced();
    this.marketInstances();
    this.wiresMesh();
    return this;
  }

  // ------------------------------------------------------------------ helpers
  col(x0, y0, z0, x1, y1, z1, flags) { return this.phys.add(x0, y0, z0, x1, y1, z1, flags); }
  paintBox(x0, y0, z0, x1, y1, z1, color, collide, flags) {
    this.B.box(x0, y0, z0, x1, y1, z1, { all: { mat: 'paint', color }, bottom: null });
    if (collide) this.col(x0, y0, z0, x1, y1, z1, flags);
  }
  // a box with one tiling texture on every side (scale = metres per repeat)
  texBox(x0, y0, z0, x1, y1, z1, mat, scale, collide, flags) {
    this.B.box(x0, y0, z0, x1, y1, z1, { all: { mat, scale }, bottom: null });
    if (collide) this.col(x0, y0, z0, x1, y1, z1, flags);
  }
  // the outside frame of one face of an oriented box: start corner a, end corner b (left to right seen from
  // outside) and the outward normal
  faceFrame(cx, cz, yaw, w, d, face) {
    const c = Math.cos(yaw), s = Math.sin(yaw), P = (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
    const hw = w / 2, hd = d / 2;
    const f = { front: [P(-hw, hd), P(hw, hd), [s, c]], back: [P(hw, -hd), P(-hw, -hd), [-s, -c]], right: [P(hw, hd), P(hw, -hd), [c, -s]], left: [P(-hw, -hd), P(-hw, hd), [-c, s]] }[face];
    return { a: f[0], b: f[1], n: f[2], len: Math.hypot(f[1][0] - f[0][0], f[1][1] - f[0][1]) };
  }
  // round 3: signs hang crooked (tilted in the wall plane, some leaning out at the top) and a few blade signs
  // stick out from the wall on an iron bracket
  shopSign(cx, cz, yaw, w, d, face, rich) {
    const R = this.R, F = this.faceFrame(cx, cz, yaw, w, d, face);
    const sw = Math.min(6.2, F.len * (0.55 + R() * 0.3)), t0 = 0.5 - sw / F.len / 2 + (R() - 0.5) * (1 - sw / F.len) * 0.8, t1 = t0 + sw / F.len;
    const y0 = 2.72 + R() * 0.08, y1 = y0 + 0.56, off = 0.17 + 0.03;
    const tilt = rich ? (R() - 0.5) * (R() < 0.3 ? 0.16 : 0.06) : 0, lean = rich && R() < 0.3 ? 0.06 + R() * 0.16 : 0;
    const ac = (t0 + t1) / 2 * F.len, yc = (y0 + y1) / 2;
    // a corner of the board: along the wall (metres from a), height, how far out; rotated by `tilt` in the wall plane
    const pt = (t, y, o = off) => {
      const al = t * F.len - ac, yy = y - yc, ca = Math.cos(tilt), sa = Math.sin(tilt);
      const A = ac + al * ca - yy * sa, Y = yc + al * sa + yy * ca, out = o + (Y > yc ? lean * (Y - yc) / 0.3 : 0);
      return [F.a[0] + (F.b[0] - F.a[0]) * A / F.len + F.n[0] * out, Y, F.a[1] + (F.b[1] - F.a[1]) * A / F.len + F.n[1] * out];
    };
    const k = Math.floor(R() * SIGN_N), u0 = (k % 2) / 2, v1 = 1 - Math.floor(k / 2) / 8, v0 = v1 - 1 / 8;
    this.B.quad('signs', [pt(t0, y0), pt(t1, y0), pt(t1, y1), pt(t0, y1)], [[u0, v0], [u0 + 0.5, v0], [u0 + 0.5, v1], [u0, v1]]);
    // the board's edge, so it reads as a sign and not a decal
    const e = (t, y) => pt(t, y, 0.02);
    this.B.quad('paint', [e(t0, y0 - 0.03), pt(t0, y0 - 0.03), pt(t0, y1 + 0.03), e(t0, y1 + 0.03)], [[0, 0], [1, 0], [1, 1], [0, 1]], C.iron);
    this.B.quad('paint', [pt(t1, y0 - 0.03), e(t1, y0 - 0.03), e(t1, y1 + 0.03), pt(t1, y1 + 0.03)], [[0, 0], [1, 0], [1, 1], [0, 1]], C.iron);
    if (rich && R() < 0.22) {
      // blade sign: a board standing out from the wall above the slab, lettering on both faces
      const tb = R() < 0.5 ? 0.12 : 0.88, by = 3.9 + R() * 0.7, bl = 0.95, bh = 0.42;
      const base = [F.a[0] + (F.b[0] - F.a[0]) * tb, F.a[1] + (F.b[1] - F.a[1]) * tb], q = (o, y) => [base[0] + F.n[0] * o, y, base[1] + F.n[1] * o];
      const kb = Math.floor(R() * SIGN_N), bu = (kb % 2) / 2, bv1 = 1 - Math.floor(kb / 2) / 8, bv0 = bv1 - 1 / 8;
      const ux = (F.b[0] - F.a[0]) / F.len * 0.015, uz = (F.b[1] - F.a[1]) / F.len * 0.015, sh = (p, k2) => [p[0] + ux * k2, p[1], p[2] + uz * k2];
      this.B.quad('signs', [sh(q(0.25, by), -1), sh(q(0.25 + bl, by), -1), sh(q(0.25 + bl, by + bh), -1), sh(q(0.25, by + bh), -1)], [[bu, bv0], [bu + 0.5, bv0], [bu + 0.5, bv1], [bu, bv1]]);
      this.B.quad('signs', [sh(q(0.25 + bl, by), 1), sh(q(0.25, by), 1), sh(q(0.25, by + bh), 1), sh(q(0.25 + bl, by + bh), 1)], [[bu, bv0], [bu + 0.5, bv0], [bu + 0.5, bv1], [bu, bv1]]);
      this.B.beam('paint', q(0, by + bh + 0.08), q(0.25 + bl + 0.05, by + bh + 0.08), 0.035, C.iron);
      this.B.beam('paint', q(0, by + 0.02), q(0.3, by + bh + 0.06), 0.03, C.iron);
    }
  }
  balcony(cx, cz, yaw, w, d, face, along, y, o = {}) {
    const R = this.R, F = this.faceFrame(cx, cz, yaw, w, d, face);
    const bw = o.bw || 2.3, hb = bw / 2 - 0.03, dp = o.dp || 0.85, FLh = o.fl || FLOOR;
    const t = 0.5 + along / F.len;
    const ux = (F.b[0] - F.a[0]) / F.len, uz = (F.b[1] - F.a[1]) / F.len, nx = F.n[0], nz = F.n[1];
    const mx = F.a[0] + (F.b[0] - F.a[0]) * t, mz = F.a[1] + (F.b[1] - F.a[1]) * t;
    const yawF = Math.atan2(nx, nz);
    this.B.obox(mx + nx * dp / 2, mz + nz * dp / 2, yawF, bw, dp, y + FLh, y + FLh + 0.13, { all: { mat: 'paint', color: C.concrete }, bottom: { mat: 'paint', color: C.plasterDark } });
    const top = y + FLh + 1.05, base = y + FLh + 0.13;
    const c0 = [mx - ux * hb + nx * (dp - 0.05), mz - uz * hb + nz * (dp - 0.05)], c1 = [mx + ux * hb + nx * (dp - 0.05), mz + uz * hb + nz * (dp - 0.05)];
    if (o.closed) {
      // closed in: a low plastered wall all round (a different colour from the building), sometimes a shutter
      const col = [[0.86, 0.8, 0.68], [0.72, 0.78, 0.74], [0.8, 0.7, 0.66], [0.9, 0.88, 0.82]][Math.floor(R() * 4)];
      this.B.obox((c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2, yawF, bw, 0.1, base, top, { all: { mat: 'paint', color: col }, bottom: null });
      for (const cc of [c0, c1]) this.B.obox(cc[0] - nx * (dp - 0.1) / 2, cc[1] - nz * (dp - 0.1) / 2, yawF, 0.1, dp - 0.1, base, top, { all: { mat: 'paint', color: col }, bottom: null });
      if (R() < 0.5) this.B.obox((c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2, yawF, bw * 0.8, 0.06, top, top + 1.2, { all: { mat: 'shut', uv: () => [[0, 0], [0.6, 0], [0.6, 1], [0, 1]] }, bottom: null });
    } else {
      const rail = (ax, az, bx, bz) => this.B.beam('paint', [ax, top, az], [bx, top, bz], 0.05, C.iron);
      rail(c0[0], c0[1], c1[0], c1[1]);
      rail(c0[0], c0[1], c0[0] - nx * (dp - 0.1), c0[1] - nz * (dp - 0.1)); rail(c1[0], c1[1], c1[0] - nx * (dp - 0.1), c1[1] - nz * (dp - 0.1));
      const nb = Math.max(4, Math.round(bw * 3.5));
      for (let i = 0; i <= nb; i++) { const k = i / nb; this.B.beam('paint', [c0[0] + (c1[0] - c0[0]) * k, base, c0[1] + (c1[1] - c0[1]) * k], [c0[0] + (c1[0] - c0[0]) * k, top, c0[1] + (c1[1] - c0[1]) * k], 0.03, C.iron); }
      // washing over the rail
      if (R() < 0.6) {
        const u = Math.floor(R() * 3) * 0.33, p = (k, yy) => [c0[0] + (c1[0] - c0[0]) * k + nx * 0.03, yy, c0[1] + (c1[1] - c0[1]) * k + nz * 0.03];
        this.B.quad('laundry', [p(0.08, top - 0.85), p(0.92, top - 0.85), p(0.92, top + 0.02), p(0.08, top + 0.02)], [[u, 0], [u + 0.6 * bw / 2.3, 0], [u + 0.6 * bw / 2.3, 0.75], [u, 0.75]]);
      }
    }
    // a damp streak down the wall under the slab
    if (o.fl && R() < 0.6) this.streakAt(cx, cz, yaw, w, d, face, along + (R() - 0.5) * bw * 0.6, y + FLh - 0.02, 0.8 + R() * 1.4, 0.4 + R() * 0.6);
  }
  // rooftop clutter on top of the instanced tanks and dishes: unfinished column stubs with rebar (very
  // Imbaba), a roof room, a TV antenna, a leaning ladder, and sometimes a pigeon tower
  roofExtras(cx, cz, yaw, w, d, H, fac, towerP) {
    const R = this.R, B = this.B, c = Math.cos(yaw), s = Math.sin(yaw);
    const at = (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
    if (fac && fac.startsWith('f_brick') && R() < 0.45) {
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const [x, z] = at(sx * (w / 2 - 0.2), sz * (d / 2 - 0.2)), h = 0.5 + R() * 0.6;
        B.obox(x, z, yaw, 0.3, 0.3, H, H + h, { all: { mat: 'paint', color: C.concrete }, bottom: null });
        for (const [rx, rz] of [[-0.08, -0.08], [0.08, 0.08], [0.08, -0.08]]) B.beam('paint', [x + rx, H + h, z + rz], [x + rx * 2.2, H + h + 0.6 + R() * 0.4, z + rz * 2.2], 0.025, C.rust);
      }
    }
    if (R() < 0.3 && w > 6 && d > 6) {
      const [x, z] = at((R() - 0.5) * (w - 4), (R() - 0.5) * (d - 4));
      B.obox(x, z, yaw, 2.6, 2.4, H, H + 2.3, { all: { mat: 'brickwall', scale: 1.4 }, top: { mat: 'roof', scale: 4 }, bottom: null });
      if (R() < 0.5) this.ladder(x + c * 1.6, H, z - s * 1.6, H + 2.3, yaw);
    }
    if (R() < 0.3) { const [x, z] = at((R() - 0.5) * (w - 1.5), (R() - 0.5) * (d - 1.5)), h = 2.2 + R() * 1.5; B.beam('paint', [x, H, z], [x, H + h, z], 0.05, C.iron); for (let i = 0; i < 3; i++) { const y = H + h - 0.25 - i * 0.35, l = 0.5 - i * 0.1; B.beam('paint', [x - c * l, y, z + s * l], [x + c * l, y, z - s * l], 0.025, C.iron); } }
    if (towerP && R() < towerP && w > 5 && d > 5) { const [x, z] = at((R() - 0.5) * (w - 4), (R() - 0.5) * (d - 4)); this.pigeonTower(x, H, z, 3.6 + R() * 3.4, 0.85 + R() * 0.3, R() * 3, R() < 0.3); }
  }
  // date palm: a slightly bent trunk and a crown of drooping fronds (double-sided triangles), merged
  palm(x, z, h = 7) {
    const B = this.B, R = this.R, bx = (R() - 0.5) * 0.9, bz = (R() - 0.5) * 0.9;
    let p = [x, 0, z];
    for (let i = 1; i <= 5; i++) { const t = i / 5, q = [x + bx * t * t * h * 0.22, h * t, z + bz * t * t * h * 0.22]; B.beam('paint', p, q, 0.34 - 0.13 * t, [0.42, 0.33, 0.24]); p = q; }
    const green = [0.2, 0.36, 0.14], green2 = [0.16, 0.28, 0.11];
    for (let k = 0; k < 10; k++) {
      const a = k / 10 * 6.283 + R() * 0.4, L = 2.3 + R() * 0.8, ca = Math.cos(a), sa = Math.sin(a);
      const tip = [p[0] + ca * L, p[1] - 0.7 - R() * 0.9, p[2] + sa * L], mid = [p[0] + ca * L * 0.5, p[1] + 0.3, p[2] + sa * L * 0.5];
      const l = [mid[0] - sa * 0.38, mid[1], mid[2] + ca * 0.38], r = [mid[0] + sa * 0.38, mid[1], mid[2] - ca * 0.38];
      B.tri('paint', [p, l, tip], green); B.tri('paint', [p, tip, l], green2);
      B.tri('paint', [p, tip, r], green); B.tri('paint', [p, r, tip], green2);
    }
  }
  ladder(x, y0, z, y1, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw), lean = 0.6;
    for (const k of [-0.22, 0.22]) this.B.beam('paint', [x + s * k, y0, z + c * k], [x + s * k - c * lean, y1, z + c * k + s * lean], 0.05, C.wood);
    for (let y = y0 + 0.3; y < y1; y += 0.35) { const f = (y - y0) / (y1 - y0); this.B.beam('paint', [x - s * 0.22 - c * lean * f, y, z - c * 0.22 + s * lean * f], [x + s * 0.22 - c * lean * f, y, z + c * 0.22 + s * lean * f], 0.035, C.wood); }
  }
  // Imbaba pigeon tower: splayed wooden (or rusty steel) legs with X bracing, a big painted coop box on top
  // with rows of dark openings, a plank roof with a rail. All merged into the town meshes (no extra draw calls).
  pigeonTower(x, y, z, h = 5, k = 1, yaw = 0, metal = false) {
    const B = this.B, R = this.R, c = Math.cos(yaw), s = Math.sin(yaw);
    const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
    const L = 0.95 * k, col = metal ? C.rust : C.pole, col2 = metal ? [0.3, 0.18, 0.12] : C.pole2, t = (metal ? 0.07 : 0.1) * k;
    const sp = (i, n) => 1.25 - 0.25 * i / n;
    const n = Math.max(2, Math.round(h / 1.5));
    const cor = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [a, b] of cor) B.beam('paint', P(a * L * 1.25, 0, b * L * 1.25), P(a * L, h, b * L), t, col);
    for (let i = 0; i <= n; i++) {
      const y0 = h * i / n, k0 = sp(i, n) * L;
      for (let j = 0; j < 4; j++) { const [a0, b0] = cor[j], [a1, b1] = cor[(j + 1) % 4]; B.beam('paint', P(a0 * k0, y0, b0 * k0), P(a1 * k0, y0, b1 * k0), t * 0.8, col2); }
      if (i === n) break;
      const y1 = h * (i + 1) / n, k1 = sp(i + 1, n) * L;
      for (let j = 0; j < 4; j++) {
        const [a0, b0] = cor[j], [a1, b1] = cor[(j + 1) % 4];
        B.beam('paint', P(a0 * k0, y0, b0 * k0), P(a1 * k1, y1, b1 * k1), t * 0.7, col2);
        if ((i + j) % 2 === 0) B.beam('paint', P(a1 * k0, y0, b1 * k0), P(a0 * k1, y1, b0 * k1), t * 0.7, col2);
      }
    }
    // the coop: wider than the legs, painted panels on all four sides
    const W = 2.9 * k, Hc = 1.55 * k, cy = y + h;
    const uvC = (nm, len) => [[0, 0], [len / (2.4 * k), 0], [len / (2.4 * k), 1], [0, 1]];
    B.obox(x, z, yaw, W, W, cy, cy + Hc, { all: { mat: 'coop', uv: uvC }, top: { mat: 'paint', color: C.woodDark }, bottom: { mat: 'paint', color: C.woodDark } });
    B.obox(x, z, yaw, W + 0.5, W + 0.5, cy + Hc, cy + Hc + 0.1, { all: { mat: 'paint', color: col }, bottom: { mat: 'paint', color: C.woodDark } });
    // rail on the roof (the keeper stands up there waving his flag)
    const rt = cy + Hc + 0.1, rl = (W + 0.4) / 2;
    for (const [a, b] of cor) B.beam('paint', P(a * rl, h + Hc + 0.1, b * rl), P(a * rl, h + Hc + 0.85, b * rl), 0.05, col2);
    for (let j = 0; j < 4; j++) { const [a0, b0] = cor[j], [a1, b1] = cor[(j + 1) % 4]; B.beam('paint', P(a0 * rl, h + Hc + 0.8, b0 * rl), P(a1 * rl, h + Hc + 0.8, b1 * rl), 0.04, col2); }
    if (R() < 0.5) { const [fx, , fz] = P(rl, 0, rl); B.beam('paint', [fx, rt, fz], [fx, rt + 2.4, fz], 0.035, C.woodDark); }
    void rt;
  }
  // the koshk: a street kiosk with two drink fridges (red and blue, invented brands), a goods display,
  // banners, crates of bottles, an ice-cream chest and a striped umbrella. Front faces -x (the street).
  kiosk(fx, cz) {
    const B = this.B, Y = -Math.PI / 2;            // local +z (front) -> world -x, local +x -> world +z
    // box(lx, lz, ...): lx along the street (world +z), lz = how far its front stands out into the street
    const box = (lx, lz, w, d, y0, y1, faces) => B.obox(fx - lz + d / 2, cz + lx, Y, w, d, y0, y1, faces);
    const paint = (col) => ({ mat: 'paint', color: col });
    const K = (x0, y0, w, h) => [[x0 / 1024, 1 - (y0 + h) / 1024], [(x0 + w) / 1024, 1 - (y0 + h) / 1024], [(x0 + w) / 1024, 1 - y0 / 1024], [x0 / 1024, 1 - y0 / 1024]];
    const kuv = (r) => () => K(...r);
    const green = [0.16, 0.36, 0.3], white = [0.92, 0.92, 0.9];
    // booth (1.9 wide, 1.15 deep): counter, goods display, frame, roof with the koshk banner, brand box on top
    box(0, 0, 1.9, 1.15, 0, 0.82, { all: paint(green), front: paint([0.75, 0.62, 0.2]), bottom: null });
    box(0, 0, 1.9, 1.15, 0.82, 2.08, { all: paint(green), front: { mat: 'kgoods', uv: () => [[0.02, 0.02], [0.98, 0.02], [0.98, 0.98], [0.02, 0.98]] }, bottom: null, top: null });
    box(0, 0.3, 2.5, 1.45, 2.08, 2.42, { all: paint(C.kblue), front: { mat: 'katlas', uv: kuv([0, 896, 1024, 128]) }, bottom: paint([0.1, 0.18, 0.4]) });
    box(0, 0.1, 1.8, 0.3, 2.42, 2.9, { all: paint(C.kred), front: { mat: 'katlas', uv: kuv([0, 768, 1024, 128]) }, bottom: null });
    // the two fridges, flush with the booth front
    box(-1.42, 0, 0.82, 0.74, 0, 1.96, { all: paint(C.kred), front: { mat: 'katlas', uv: kuv([0, 0, 512, 768]) }, top: paint([0.6, 0.08, 0.08]), bottom: null });
    box(1.42, 0, 0.82, 0.74, 0, 1.96, { all: paint(C.kblue), front: { mat: 'katlas', uv: kuv([512, 0, 512, 768]) }, top: paint([0.08, 0.2, 0.5]), bottom: null });
    // crates of bottles and cartons on and beside the fridges
    for (const [lx, lz, y, col] of [[-1.42, 0.05, 1.96, C.kred], [-1.42, 0.05, 2.28, C.kblue], [1.42, 0.05, 1.96, C.kblue], [-2.3, 0.1, 0, C.kred], [-2.3, 0.1, 0.32, C.kred], [-2.3, 0.1, 0.64, C.kblue]]) box(lx, lz, 0.62, 0.45, y, y + 0.31, { all: paint(col), bottom: null });
    for (const [lx, lz, y] of [[1.42, 0.0, 2.27], [1.2, -0.1, 2.6], [-2.28, 0.15, 0.96]]) box(lx, lz, 0.6, 0.5, y, y + 0.34, { all: paint(C.carton), bottom: null });
    // ice-cream chest in front and a stool
    box(-0.55, 0.8, 0.95, 0.6, 0, 0.82, { all: paint(white), top: paint([0.7, 0.85, 0.95]), front: paint(C.kblue), bottom: null });
    box(0.75, 0.75, 0.38, 0.38, 0, 0.45, { all: paint([0.85, 0.85, 0.82]), bottom: null });
    // striped umbrella over the stool
    const [ux, uz] = [fx - 1.45, cz + 0.9];
    B.beam('paint', [ux, 0, uz], [ux, 2.55, uz], 0.05, [0.85, 0.85, 0.85]);
    const N = 10, r = 1.25;
    for (let i = 0; i < N; i++) {
      const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2;
      const p0 = [ux + Math.cos(a0) * r, 2.42, uz + Math.sin(a0) * r], p1 = [ux + Math.cos(a1) * r, 2.42, uz + Math.sin(a1) * r];
      B.tri('paint', [[ux, 2.85, uz], p1, p0], i % 2 ? white : C.kred);
      B.tri('paint', [[ux, 2.84, uz], p0, p1], i % 2 ? [0.7, 0.68, 0.64] : [0.55, 0.08, 0.06]);
    }
    this.col(fx, 0, cz - 2.65, 5.2, 2.0, cz + 1.9, { kind: 'kiosk' });
    this.col(fx - 0.8, 0, cz - 1.03, fx - 0.2, 0.82, cz - 0.08, { kind: 'kiosk', vault: true });
    this.spawns.kiosk = new THREE.Vector3(fx, 0, cz);
  }
  // A building block. Faces listed in `shop` get shopfronts on the ground floor.
  // Round 3 (Mzee: "still very organised boxes on top of boxes"): every "rich" building (the ones the route
  // passes) gets its own storey height, facade tile width and tint; some have the upper floors cantilevered
  // over the street, an unfinished top storey (bare columns, rebar, a half-built brick wall), a painted ground
  // floor; balconies, AC units and dishes sit at uneven places on the street face, every roof has tanks and
  // junk, and grime and water streaks run down the walls. All of it merges into the existing chunk meshes
  // (the streaks are one more material).
  building(cx, cz, w, d, floors, opts = {}) {
    const R = this.R, B = this.B;
    const yaw = opts.yaw || 0, c = Math.cos(yaw), s = Math.sin(yaw);
    const rich = !opts.h && !opts.far && !opts.plain && opts.roofProps !== false && floors >= 1;
    const fk = rich ? 0.93 + R() * 0.15 : 1, FL = FLOOR * fk;
    const H = opts.h ?? (FLOOR0 + floors * FL);
    const fac = opts.facade || FACADES[Math.floor(R() * FACADES.length)];
    const tw = rich ? TILE * (0.88 + R() * 0.3) : TILE, th = TILE * fk;
    const off = rich ? R() : Math.floor(R() * 4) * 0.5;
    const tint = rich ? facadeTint(fac, R) : null;
    const shop = opts.shop || [];
    const shopMat = opts.shopMat || (R() < 0.3 ? 'shut' : 'shop');
    const street = opts.acFace || shop[0] || null;
    const facadeUV = (o) => (name, len, y0, y1) => [[o, (y0 - FLOOR0) / th], [o + len / tw, (y0 - FLOOR0) / th], [o + len / tw, (y1 - FLOOR0) / th], [o, (y1 - FLOOR0) / th]];
    const faces = { all: { mat: fac, uv: facadeUV(off), color: tint }, top: { mat: 'roof', scale: 5 }, bottom: null };
    if (opts.plain) faces.all = { mat: 'paint', color: opts.plain };
    // the upper floors may hang out over the street (0.45-0.9 m); everything above the ground floor uses U
    const ov = rich && street && floors >= 2 && R() < 0.4 ? 0.45 + R() * 0.45 : 0;
    const N = { right: [1, 0], left: [-1, 0], front: [0, 1], back: [0, -1] }[street] || [0, 0];
    const U = { x: cx + (N[0] * c + N[1] * s) * ov / 2, z: cz + (-N[0] * s + N[1] * c) * ov / 2, w: w + Math.abs(N[0]) * ov, d: d + Math.abs(N[1]) * ov };
    // an unfinished top storey: the solid block stops one storey short
    const unfinished = rich && floors >= 2 && R() < 0.36;
    const Hs = unfinished ? H - FL : H;
    const painted = rich && shop.length && R() < 0.2 ? PAINTED[Math.floor(R() * PAINTED.length)] : null;
    if (H <= FLOOR0 + 0.01 || opts.noShop) {
      B.obox(cx, cz, yaw, w, d, 0, Hs, faces);
    } else {
      // ground floor
      const g = { bottom: null, top: null, all: { mat: fac, uv: facadeUV(off), color: painted || tint } };
      for (const f of shop) g[f] = { mat: shopMat, uv: (n, len, y0, y1) => { const o = R(); return [[o, 0], [o + len / SHOP_W, 0], [o + len / SHOP_W, 1], [o, 1]]; }, color: painted };
      B.obox(cx, cz, yaw, w, d, 0, FLOOR0, g);
      B.obox(U.x, U.z, yaw, U.w, U.d, FLOOR0, Hs, { ...faces, bottom: ov ? { mat: 'paint', color: C.plasterDark } : null });
      // slab lip over the shops
      if (shop.length) B.obox(cx, cz, yaw, w + 0.3, d + 0.3, FLOOR0 - 0.05, FLOOR0 + 0.25, { all: { mat: 'paint', color: painted ? painted.map((v) => Math.min(1, v * 0.62)) : C.concrete }, bottom: { mat: 'paint', color: C.plasterDark } });
      // painted shop signs in Arabic over the openings (invented names, drawn in the game font)
      if (shopMat === 'shop' || R() < 0.5) for (const f of shop) this.shopSign(cx, cz, yaw, w, d, f, rich);
    }
    if (unfinished) this.unfinishedStorey(U.x, U.z, yaw, U.w, U.d, Hs, H, street);
    if (rich && street) {
      // balconies at uneven places and sizes, some closed in; under each, a water streak
      const along = street === 'front' || street === 'back' ? U.w : U.d;
      for (let fl = 1; fl < floors - (unfinished ? 1 : 0); fl++) if (R() < 0.42) {
        const bw = 1.5 + R() * 1.6, a2 = (R() - 0.5) * Math.max(0, along - bw - 0.8);
        this.balcony(U.x, U.z, yaw, U.w, U.d, street, a2, FLOOR0 + (fl - 1) * FL + 0.02 + (R() - 0.5) * 0.12, { bw, dp: 0.55 + R() * 0.55, closed: R() < 0.35, fl: FL });
      }
      this.streaks(U.x, U.z, yaw, U.w, U.d, street, Hs, 2 + Math.floor(R() * 3));
      // satellite dishes on brackets on the wall
      if (R() < 0.35) for (let i = 0, n = 1 + Math.floor(R() * 2); i < n; i++) {
        const F = this.faceFrame(U.x, U.z, yaw, U.w, U.d, street), t = 0.1 + R() * 0.8, y = FLOOR0 + 1 + R() * Math.max(0.5, Hs - FLOOR0 - 2);
        this.dishes.push([F.a[0] + (F.b[0] - F.a[0]) * t + F.n[0] * 0.45, y, F.a[1] + (F.b[1] - F.a[1]) * t + F.n[1] * 0.45, Math.atan2(F.n[0], F.n[1]) + (R() - 0.5) * 1.2, 0.6 + R() * 0.25]);
      }
    } else if (opts.acFace && !opts.plain && H > 7 && (fac === 'f_brick_a' || fac === 'f_brick_c' || fac === 'f_pale')) {
      for (let fl = 1; fl < floors; fl++) if (R() < 0.3) this.balcony(cx, cz, yaw, w, d, opts.acFace, (R() - 0.5) * (Math.max(0, (opts.acFace === 'front' ? w : d) - 3.2)), FLOOR0 + (fl - 1) * FLOOR + 0.02);
    }
    // parapet (not on an unfinished storey: its columns stand at the edge)
    if (opts.parapet !== false && !unfinished) {
      const t = 0.22, ph = rich ? 0.5 + R() * 0.5 : 0.7;
      const pc = opts.parapetColor || (rich && R() < 0.5 ? C.plasterDark : C.plaster);
      const PX = rich ? U.x : cx, PZ = rich ? U.z : cz, PW = rich ? U.w : w, PD = rich ? U.d : d;
      const seg = (lx, lz, ww, dd) => B.obox(PX + lx * c + lz * s, PZ - lx * s + lz * c, yaw, ww, dd, H, H + ph, { all: { mat: 'paint', color: pc }, bottom: null });
      const sides = opts.parapetSides || ['front', 'back', 'left', 'right'];
      if (sides.includes('front')) seg(0, PD / 2 - t / 2, PW, t);
      if (sides.includes('back')) seg(0, -PD / 2 + t / 2, PW, t);
      if (sides.includes('left')) seg(-PW / 2 + t / 2, 0, t, PD - 2 * t);
      if (sides.includes('right')) seg(PW / 2 - t / 2, 0, t, PD - 2 * t);
      if (yaw === 0 && opts.collideParapet) for (const sd of sides) {
        const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
        if (sd === 'left') this.col(x0, H, z0, x0 + t, H + ph, z1, { vault: true });
        if (sd === 'right') this.col(x1 - t, H, z0, x1, H + ph, z1, { vault: true });
        if (sd === 'front') this.col(x0, H, z1 - t, x1, H + ph, z1, { vault: true });
        if (sd === 'back') this.col(x0, H, z0, x1, H + ph, z0 + t, { vault: true });
      }
    }
    if (yaw === 0 && opts.collide !== false) this.col(cx - w / 2, -1, cz - d / 2, cx + w / 2, H, cz + d / 2, { building: true });
    // roof clutter: rich roofs always get a tank and a junk pile
    if (opts.roofProps !== false) {
      const RX = rich ? U.x : cx, RZ = rich ? U.z : cz, RW = rich ? U.w : w, RD = rich ? U.d : d;
      const at = (lx, lz) => [RX + lx * c + lz * s, RZ - lx * s + lz * c];
      if (rich || R() < 0.75) { const [x, z] = at((R() - 0.5) * (RW - 2.5), (R() - 0.5) * (RD - 2.5)); this.tanks.push([x, Hs, z, R() < 0.3 ? 1 : 0, 0.9 + R() * 0.4]); }
      if (R() < 0.5) { const [x, z] = at((R() - 0.5) * (RW - 2), (R() - 0.5) * (RD - 2)); this.tanks.push([x, Hs, z, 0, 0.8 + R() * 0.3]); }
      if (rich || R() < 0.7) { const [x, z] = at((R() - 0.5) * (RW - 1.5), (R() - 0.5) * (RD - 1.5)); this.dishes.push([x, Hs, z, R() * 6.28, 0.8 + R() * 0.4]); }
      if (R() < 0.35) { const [x, z] = at((R() - 0.5) * (RW - 1.5), (R() - 0.5) * (RD - 1.5)); this.dishes.push([x, Hs, z, R() * 6.28, 0.7 + R() * 0.3]); }
      if (rich) this.junk(RX, RZ, yaw, RW, RD, Hs);
      this.roofExtras(RX, RZ, yaw, RW, RD, Hs, unfinished ? 'unfinished' : fac, opts.towerP || 0);
    }
    // AC units on the street face: more of them, at uneven heights, some out on brackets, a drip streak under most
    if (opts.acFace && H > 7) {
      const n = rich ? 2 + Math.floor(R() * 4) : 1 + Math.floor(R() * 3);
      for (let i = 0; i < n; i++) {
        const fl = Math.floor(R() * Math.max(1, floors - (unfinished ? 1 : 0))), y = FLOOR0 + fl * FL + (rich ? 0.3 + R() * 1.1 : 0.6);
        const aw = (rich ? this.faceFrame(U.x, U.z, yaw, U.w, U.d, opts.acFace) : this.faceFrame(cx, cz, yaw, w, d, opts.acFace)).len, along = (R() - 0.5) * (aw - 1.4);
        const a = { cx: rich ? U.x : cx, cz: rich ? U.z : cz, yaw, w: rich ? U.w : w, d: rich ? U.d : d, face: opts.acFace, along, y, out: rich && R() < 0.3 ? 0.12 + R() * 0.3 : 0, tilt: rich ? (R() - 0.5) * 0.12 : 0 };
        this.acs.push(a);
        if (rich && R() < 0.65) this.streakAt(a.cx, a.cz, yaw, a.w, a.d, a.face, along, y - 0.3, 0.9 + R() * 1.6, 0.5);
      }
    }
    return H;
  }
  // bare concrete columns with rebar sticking out, a half-built brick wall on the street side, bricks on the slab
  unfinishedStorey(cx, cz, yaw, w, d, y0, y1, street) {
    const R = this.R, B = this.B, c = Math.cos(yaw), s = Math.sin(yaw);
    const at = (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
    const pts = [];
    const edge = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / (3.2 + R() * 0.8))); for (let i = 0; i <= n; i++) pts.push([x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n]); };
    const hw = w / 2 - 0.15, hd = d / 2 - 0.15;
    edge(-hw, -hd, -hw, hd); edge(hw, -hd, hw, hd); edge(-hw, -hd, hw, -hd); edge(-hw, hd, hw, hd);
    const seen = new Set();
    for (const [lx, lz] of pts) {
      const k = lx.toFixed(1) + ',' + lz.toFixed(1); if (seen.has(k)) continue; seen.add(k);
      const [x, z] = at(lx, lz), top = y1 - 0.15 - R() * (R() < 0.3 ? 1.6 : 0.4);
      B.obox(x, z, yaw, 0.3, 0.3, y0, top, { all: { mat: 'paint', color: C.concrete }, bottom: null });
      for (const [rx, rz] of [[-0.08, -0.08], [0.08, 0.08], [0.08, -0.08], [-0.08, 0.08]]) if (R() < 0.85) B.beam('paint', [x + rx, top, z + rz], [x + rx * (1.6 + R() * 2), top + 0.5 + R() * 0.7, z + rz * (1.6 + R() * 2)], 0.022, C.rust);
    }
    // the half-built brick wall: part of the street face, waist to head high
    if (street) {
      const F = this.faceFrame(cx, cz, yaw, w, d, street), t0 = R() * 0.4, t1 = t0 + 0.3 + R() * 0.5, h = 0.8 + R() * 1.8;
      const p0 = [F.a[0] + (F.b[0] - F.a[0]) * t0 - F.n[0] * 0.12, F.a[1] + (F.b[1] - F.a[1]) * t0 - F.n[1] * 0.12], p1 = [F.a[0] + (F.b[0] - F.a[0]) * Math.min(1, t1) - F.n[0] * 0.12, F.a[1] + (F.b[1] - F.a[1]) * Math.min(1, t1) - F.n[1] * 0.12];
      const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      B.obox((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, Math.atan2(F.n[0], F.n[1]), L, 0.2, y0, y0 + h, { all: { mat: 'brickwall', scale: 1.4 }, bottom: null });
    }
    for (let i = 0; i < 3; i++) { const [x, z] = at((R() - 0.5) * (w - 2), (R() - 0.5) * (d - 2)); B.obox(x, z, R() * 3, 0.9, 0.6, y0, y0 + 0.25 + R() * 0.35, { all: { mat: 'paint', color: C.brick }, bottom: null }); }
  }
  // a pile of roof junk: crates, sacks, a blue barrel, bricks, old tyres, a broken chair, all at odd angles
  junk(cx, cz, yaw, w, d, y) {
    const R = this.R, B = this.B, c = Math.cos(yaw), s = Math.sin(yaw);
    const [jx, jz] = [(R() - 0.5) * Math.max(0, w - 3), (R() - 0.5) * Math.max(0, d - 3)];
    const n = 3 + Math.floor(R() * 5);
    for (let i = 0; i < n; i++) {
      const lx = jx + (R() - 0.5) * 2.2, lz = jz + (R() - 0.5) * 2.2, x = cx + lx * c + lz * s, z = cz - lx * s + lz * c, ry = R() * 3.14, k = R();
      if (k < 0.25) B.obox(x, z, ry, 0.55 + R() * 0.3, 0.45 + R() * 0.2, y, y + 0.4 + R() * 0.3, { all: { mat: 'crate', scale: 0.6 }, bottom: null });
      else if (k < 0.42) B.obox(x, z, ry, 0.7, 0.45, y, y + 0.28, { all: { mat: 'burlap', scale: 0.6 }, bottom: null });
      else if (k < 0.55) B.obox(x, z, ry, 0.5, 0.5, y, y + 0.85, { all: { mat: 'paint', color: [0.15, 0.32, 0.62] }, bottom: null });
      else if (k < 0.7) B.obox(x, z, ry, 1.0, 0.5, y, y + 0.2 + R() * 0.3, { all: { mat: 'paint', color: C.brick }, bottom: null });
      else if (k < 0.85) for (let t = 0, m = 1 + Math.floor(R() * 3); t < m; t++) B.obox(x, z, ry + t * 0.4, 0.62, 0.62, y + t * 0.2, y + t * 0.2 + 0.19, { all: { mat: 'paint', color: C.tyre }, bottom: null });
      else { // a broken chair: seat and two legs and a back, tipped over
        B.obox(x, z, ry, 0.45, 0.45, y + 0.05, y + 0.09, { all: { mat: 'paint', color: C.wood }, bottom: null });
        B.beam('paint', [x, y, z], [x + 0.35, y + 0.45, z + 0.1], 0.04, C.woodDark); B.beam('paint', [x + 0.2, y, z - 0.2], [x - 0.15, y + 0.5, z - 0.1], 0.04, C.woodDark);
      }
    }
  }
  // grime and water streaks down a face: from the roof line, 1.5-3.5 m long, at random places
  streaks(cx, cz, yaw, w, d, face, top, n) {
    const R = this.R, F = this.faceFrame(cx, cz, yaw, w, d, face);
    for (let i = 0; i < n; i++) this.streakAt(cx, cz, yaw, w, d, face, (R() - 0.5) * (F.len - 1.4), top - 0.02, 1.5 + R() * 2.2, 0.7 + R() * 1.3);
  }
  streakAt(cx, cz, yaw, w, d, face, along, yTop, len, width) {
    const R = this.R, F = this.faceFrame(cx, cz, yaw, w, d, face);
    const t = 0.5 + along / F.len, hw = width / F.len / 2, o = 0.025;
    const P = (tt, y) => [F.a[0] + (F.b[0] - F.a[0]) * tt + F.n[0] * o, y, F.a[1] + (F.b[1] - F.a[1]) * tt + F.n[1] * o];
    const u = Math.floor(R() * 4) * 0.25, y0 = Math.max(0.3, yTop - len);
    this.B.quad('grime', [P(t - hw, y0), P(t + hw, y0), P(t + hw, yTop), P(t - hw, yTop)], [[u, 0], [u + 0.25, 0], [u + 0.25, 1], [u, 1]]);
  }
  // a row of buildings along a z range on one side of an axis-aligned street (side -1 = west/left x<, +1 = right)
  row(side, xEdge, z0, z1, opts = {}) {
    const R = this.R;
    let z = z0;
    while (z > z1 + 3) {
      // round 3: no repeating rhythm (lots were 7-12 m in whole metres): slivers of 3.8-6 m, wide ones up to 12.5
      let w = opts.lot ? opts.lot : (R() < 0.16 ? 3.8 + R() * 2.2 : 6 + R() * 6.5);
      if (z - w < z1) w = z - z1;
      if (opts.gaps && opts.gaps.some(([g0, g1]) => z - w < g0 && z > g1)) {
        // skip through the gap (side alley)
        const g = opts.gaps.find(([g0, g1]) => z - w < g0 && z > g1);
        if (z > g[0]) { w = z - g[0]; } else { z = g[1]; continue; }
      }
      const d = opts.depth || 10;
      // round 2: slight setbacks and much more height variety (low older houses next to 6-8 storey towers)
      const set = opts.setback === false ? 0 : (R() < 0.7 ? 0.1 + R() * 0.95 : 0);
      const cx = xEdge + side * (d / 2 + set);
      const floors = opts.floors ? opts.floors(z) : (R() < 0.2 ? 5 + Math.floor(R() * 3) : 1 + Math.floor(R() * 4));
      this.building(cx, z - w / 2, d, w, floors, { shop: [side < 0 ? 'right' : 'left'], acFace: side < 0 ? 'right' : 'left', towerP: opts.towerP, ...opts.b });
      if (set > 0) this.col(xEdge + (side < 0 ? -set : 0), -1, z - w, xEdge + (side < 0 ? 0 : set), 0.02, z, { ground: true });
      z -= w;
    }
  }
  donkeyCartAt(x, z, yaw) {
    const m = donkeyCart(this.root); m.position.set(x, 0, z); m.rotation.y = yaw;
    // its footprint, as a vaultable box (local z from the tail board to the donkey's nose)
    const c = Math.cos(yaw), s = Math.sin(yaw), P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const pts = [P(-CART_FOOT.hx, CART_FOOT.z0), P(CART_FOOT.hx, CART_FOOT.z0), P(-CART_FOOT.hx, CART_FOOT.z1), P(CART_FOOT.hx, CART_FOOT.z1)];
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    this.col(Math.min(...xs), 0, Math.min(...zs), Math.max(...xs), 1.05, Math.max(...zs), { vault: true, kind: 'cart' });
    return m;
  }
  groundBox(x0, z0, x1, z1, mat, y = 0, scale = 6) {
    this.B.box(x0, y - 0.3, z0, x1, y, z1, { top: { mat, scale }, all: null });
    this.col(x0, y - 2, z0, x1, y, z1, { ground: true });
  }
  wire(a, b, sag = 0.6) { this.wires.push([a, b, sag]); }
  cartAt(x, z, yaw, opts = {}) {
    const m = A.glb.cart.scene.clone();
    m.position.set(x, 0, z); m.rotation.y = yaw;
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.root.add(m);
    const along = Math.abs(Math.sin(yaw)) > 0.7; // long axis along Z
    const hx = along ? 0.6 : 1.15, hz = along ? 1.15 : 0.6;
    const b = opts.collide !== false ? this.col(x - hx, 0, z - hz, x + hx, 1.05, z + hz, { vault: true, kind: 'cart' }) : null;
    this.carts.push({ m, b });
    return m;
  }

  // ------------------------------------------------------------------ regions
  ground() {
    // one big dirt ground under the on-foot areas (the road gets its own ribbon)
    this.groundBox(-30, 40 + PLAZA_Z, 30, -5 + PLAZA_Z, 'street');
    this.groundBox(-12, -5 + PLAZA_Z, 12, -186, 'street');
    this.groundBox(-18, -186, 18, -316, 'market', 0, 4);
    this.groundBox(-12, -876, 12, -935, 'street');
    this.groundBox(-60, -1036, 60, -1062, 'market', 0, 4); // corniche
  }

  plaza() {
    const R = this.R, Z = PLAZA_Z;
    // surrounding buildings
    this.building(-21, 20 + Z, 10, 28, 3, { shop: ['right'], acFace: 'right' });
    this.building(21, 22 + Z, 10, 24, 4, { shop: ['left'], acFace: 'left' });
    this.building(0, 41 + Z, 32, 10, 5, { shop: ['back'] });
    this.building(-19, 3 + Z, 14, 6, 2, { shop: ['front', 'right'] });
    this.building(19, 3 + Z, 14, 6, 3, { shop: ['front', 'left'] });
    // microbuses (one we arrived in, two waiting)
    this.microbus(5.2, 22 + Z, 0, [0.95, 0.94, 0.9]);
    this.microbus(9.6, 27 + Z, 0.12, [0.9, 0.88, 0.8]);
    this.microbus(-9, 26 + Z, -0.08, [0.92, 0.92, 0.88]);
    this.teaCart(-1.2, 14.6 + Z);
    this.spawns.start = new THREE.Vector3(3.6, 0, 20.5 + Z);
    this.spawns.driver = new THREE.Vector3(3.4, 0, 23.6 + Z);
    this.spawns.tea = new THREE.Vector3(-2.3, 0, 14.1 + Z);
    // a bench and stools
    this.texBox(-8.5, 0, 9 + Z, -7.1, 0.45, 9.6 + Z, 'crate', 0.8, true, { vault: true });
    this.paintBox(-3.4, 0, 15.2 + Z, -2.9, 0.42, 15.7 + Z, C.woodDark, true);
    this.paintBox(-0.2, 0, 12.9 + Z, 0.3, 0.42, 13.4 + Z, C.woodDark, true);
    // wires over the plaza
    this.wire([-16, 7.5, 18 + Z], [16, 8, 24 + Z]); this.wire([-16, 7, 10 + Z], [16, 7.5, 6 + Z], 0.8);
    R();
  }

  street() {
    const Z0 = PLAZA_Z;
    // ~100 m to the market gate, one of each obstacle: the crossing tok-tok (z -100), a cart, the kids' ball,
    // a low wall (vault), one laundry line (slide or duck), a barrier (climb), a last cart, the gate
    this.row(-1, -5.2, Z0, -188, { gaps: [[-97, -103]], towerP: 0.16 });
    this.row(1, 5.2, Z0, -188, { gaps: [[-97, -103], [-112, -128]], towerP: 0.16 });
    // kids' square (east side, z -112..-128) with a low building behind
    this.groundBox(5, -112, 15, -128, 'market', 0.01, 4);
    this.building(18, -120, 6, 18, 2, { shop: ['left'], towerP: 1 });
    this.spawns.kids = [new THREE.Vector3(9, 0, -117), new THREE.Vector3(12, 0, -124), new THREE.Vector3(8, 0, -126)];
    this.spawns.ball = new THREE.Vector3(10.5, 0.17, -121);
    this.spawns.goal = new THREE.Vector3(14, 0, -124);
    // side alley crossing at z -97..-103 (both sides)
    this.groundBox(-30, -97, -5, -103, 'street', 0.005); this.groundBox(5, -97, 30, -103, 'street', 0.005);
    this.building(-24, -100, 10, 12, 3, { collide: true, shop: ['right'] });
    this.building(24, -100, 10, 12, 3, { collide: true, shop: ['left'] });
    this.microbus(-12.5, -98.05, Math.PI / 2 + 0.04, [0.93, 0.92, 0.88]);   // parked in the side alley, clear of the crossing tok-tok
    // the kiosk (koshk) at the street mouth, right side
    this.kiosk(4.05, -91.6);
    // hazards
    // round 3: the cart at z -109 is now a moving donkey cart (hazards.js, placed by the game); its lane is x -3.4
    // low brick wall with a parked tok-tok in the gap
    this.texBox(-5, 0, -134.5, 2.1, 0.95, -133.6, 'brickwall', 1.4, true, { vault: true, kind: 'wall' });
    this.paintBox(-4.6, 0.95, -134.4, 1.8, 1.05, -133.7, C.concrete, false);
    this.spawns.parkedTok = new THREE.Vector3(3.6, 0, -134);
    this.col(2.2, 0, -135.3, 5, 1.7, -132.7, { kind: 'tok' });
    this.laundryLine(-147, 1.08);
    // painted metal barrier you must climb, sandbags at its foot
    this.texBox(-5, 0, -161.6, 5, 1.8, -160.6, 'barrier', 1.6, true, { climb: true, kind: 'barrier' });
    this.paintBox(-5, 1.8, -161.5, 5, 1.95, -160.7, C.rust, false);
    for (const x of [-3.9, -2.1, 2.1, 3.9]) this.texBox(x - 0.3, 0, -160.5, x + 0.3, 0.5, -160.0, 'burlap', 0.7, true);
    // the last cart before the gate: a donkey cart loaded with greens, parked (Mzee's alley photos)
    this.donkeyCartAt(2.6, -176, Math.PI + 0.12);
    // market gate arch
    this.texBox(-6, 0, -188.6, -4.8, 5.2, -187.4, 'brickwall', 1.4, true);
    this.texBox(4.8, 0, -188.6, 6, 5.2, -187.4, 'brickwall', 1.4, true);
    this.paintBox(-6, 5.2, -188.6, 6, 6.0, -187.4, C.plasterDark, false);
    this.B.quad('khay', [[-4.8, 3.9, -187.35], [4.8, 3.9, -187.35], [4.8, 5.2, -187.35], [-4.8, 5.2, -187.35]], [[0, 0], [4, 0], [4, 0.55], [0, 0.55]]);
    // wires
    // tangled overhead wires: bundles across the street at odd angles, cables along the facades, washing lines
    // strung high between the upper floors
    const R = this.R;
    for (let z = Z0 - 3; z > -186; z -= 5 + R() * 5) { const n = 1 + Math.floor(R() * 3); for (let k = 0; k < n; k++) this.wire([-5.2, 5 + R() * 3.5, z + (R() - 0.5) * 2], [5.2, 5 + R() * 3.5, z + (R() - 0.5) * 7], 0.25 + R() * 0.9); }
    for (const sx of [-5.12, 5.12]) for (let z = Z0; z > -186; z -= 8 + R() * 4) this.wire([sx, 4.3 + R() * 0.7, z], [sx, 4.3 + R() * 0.7, z - 8], 0.3);
    // round 3: heavy cables slung between buildings high up, with deep sags, often two or three together, some
    // running at a slant to a building further down; and cables dropping down the walls to the shops
    for (let z = Z0 - 6; z > -184; z -= 7 + R() * 9) {
      const n = 1 + Math.floor(R() * 3), y0 = 7 + R() * 5, y1 = 6 + R() * 6, dz = (R() - 0.5) * 14, sag = 0.9 + R() * 1.4;
      for (let k = 0; k < n; k++) this.wire([-5.4, y0 - k * 0.25, z + k * 0.3], [5.4, y1 - k * 0.2, z + dz + k * 0.3], sag + k * 0.15);
    }
    for (const sx of [-5.2, 5.2]) for (let z = Z0 - 4; z > -184; z -= 9 + R() * 10) { const yt = 5.5 + R() * 4; this.wire([sx, yt, z], [sx * 0.995, 3.3, z - 0.6 - R()], 0.15 + R() * 0.25); }
    for (const z of [Z0 - 14, -118, -141, -170]) {
      const y = 6.4 + R() * 1.4, o = Math.floor(R() * 3) * 0.33;
      this.B.quad('laundry', [[-5.2, y - 1.0, z], [5.2, y - 1.15, z], [5.2, y, z], [-5.2, y, z]], [[o, 0], [o + 3, 0], [o + 3, 1], [o, 1]]);
      this.wire([-5.2, y, z], [5.2, y, z], 0.05);
    }
    this.spawns.street = new THREE.Vector3(0, 0, Z0 - 4);
    this.spawns.cpMarket = new THREE.Vector3(0, 0, -182);
    this.spawns.marks = { cross: -100, wall: -134, laundry: -147, barrier: -161 };
  }

  laundryLine(z, bottom) {
    const top = 2.35;
    this.paintBox(-5.15, 0, z - 0.08, -4.95, 2.6, z + 0.08, C.iron, false);
    this.paintBox(4.95, 0, z - 0.08, 5.15, 2.6, z + 0.08, C.iron, false);
    this.B.quad('laundry', [[-5, bottom, z], [5, bottom, z], [5, top, z], [-5, top, z]], [[0, 0], [3, 0], [3, 1], [0, 1]]);
    this.paintBox(-5, top - 0.02, z - 0.015, 5, top + 0.02, z + 0.015, C.rope, false);
    const b = this.col(-5, bottom, z - 0.15, 5, top, z + 0.15, { kind: 'laundry', noCam: true });
    this.laundry.push({ z, bottom, b });
  }

  market() {
    const R = this.R;
    // perimeter buildings
    this.row(-1, -18, -186, -316, { b: {}, floors: () => 1 + Math.floor(R() * 5), towerP: 0.2 });
    this.row(1, 18, -186, -316, { b: {}, floors: () => 1 + Math.floor(R() * 5), towerP: 0.2 });
    // back wall with an opening onto the main road
    this.building(-11.5, -320, 13, 8, 3, { shop: ['front'] });
    this.building(11.5, -320, 13, 8, 3, { shop: ['front'] });
    // stall columns: x = -9, -3 | 3, 9 ; z rows with crossing gaps
    const rowsZ = [];
    for (let z = -196; z > -300; z -= 2.8) rowsZ.push(z);
    for (const x of [-9.5, -3.2, 3.2, 9.5]) {
      rowsZ.forEach((z, i) => {
        const gapEvery = x === -3.2 || x === 3.2 ? 4 : 5;
        if (i % gapEvery === gapEvery - 1) return; // crossing gap
        if ((x === -9.5 || x === 9.5) && R() < 0.15) return;
        this.stall(x, z, R);
      });
    }
    // crates and sacks in the lanes
    for (const [x, z] of [[1.3, -221], [-7.6, -236], [7.6, -238.6], [-1.2, -262], [6.6, -282], [-6.2, -296]]) {
      this.crateStack(x, z, R);
    }
    this.cartAt(-12.8, -205, Math.PI / 2, {}); this.cartAt(12.8, -262, Math.PI / 2);
    this.spawns.vendor = new THREE.Vector3(-1.6, 0, -192);
    this.spawns.goat = new THREE.Vector3(-7, 0, -238);
    // the thief's route: weave lanes through the gaps
    // gaps between stall rows: centre columns at z -204.4, -215.6, -226.8, -238, -249.2, -260.4, -271.6 ...
    this.thiefPath = [
      // round 3: on the three lanes with a donkey cart the route keeps to the side away from it
      [-6.3, -201], [-6.3, -215.6], [0, -215.6], [0, -226.8], [5.7, -226.8], [5.7, -249.2], [0, -249.2], [-5.7, -249.2], [-5.7, -271.6],
      [-0.9, -271.6], [-0.9, -296], [0, -306], [1.6, -314],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z));
    for (let z = -196; z > -312; z -= 11 + R() * 9) { this.wire([-18, 7 + R() * 4, z], [18, 7 + R() * 4, z - 6 + R() * 12], 1.0 + R() * 1.8); if (R() < 0.6) this.wire([-18, 6.2, z - 3], [18, 6.6 + R(), z - 1 - R() * 6], 0.9 + R()); }
    // strings of bare bulbs along the lanes, from stall pole to stall pole
    for (const lx of [-6.35, 0, 6.35]) for (let z = -196; z > -300; z -= 1.6) this.bulbs.push([lx + Math.sin(z) * 0.2, 2.85 + Math.sin(z * 0.7) * 0.12, z]);
    for (const lx of [-6.35, 0, 6.35]) this.wire([lx, 3.0, -196], [lx, 3.0, -300], 0.3);
    // strings of khayamiya bunting
    this.spawns.cpChase = new THREE.Vector3(0, 0, -200);
  }
  stall(x, z, R) {
    const w = 2.4, d = 1.3, top = 0.95;
    this.texBox(x - w / 2, 0, z - d / 2, x + w / 2, top - 0.05, z + d / 2, 'crate', 0.9, false);
    this.col(x - w / 2, 0, z - d / 2, x + w / 2, top, z + d / 2, { vault: true, kind: 'stall' });
    const o = Math.floor(R() * 3) / 3;
    this.B.quad('produce', [[x - w / 2, top - 0.05, z + d / 2], [x + w / 2, top - 0.05, z + d / 2], [x + w / 2, top + 0.22, z], [x - w / 2, top + 0.22, z]], [[o, 0], [o + 0.33, 0], [o + 0.33, 0.55], [o, 0.55]]);
    this.B.quad('produce', [[x + w / 2, top - 0.05, z - d / 2], [x - w / 2, top - 0.05, z - d / 2], [x - w / 2, top + 0.22, z], [x + w / 2, top + 0.22, z]], [[o, 0.45], [o + 0.33, 0.45], [o + 0.33, 1], [o, 1]]);
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.paintBox(x + px * (w / 2 - 0.05) - 0.04, 0, z + pz * (d / 2 - 0.05) - 0.04, x + px * (w / 2 - 0.05) + 0.04, 2.35, z + pz * (d / 2 - 0.05) + 0.04, C.woodDark, false);
    // awning, tilted
    const u = Math.floor(R() * 4) * 0.25;
    this.B.quad('khay', [[x - w / 2 - 0.1, 2.2, z + d / 2 + 0.3], [x + w / 2 + 0.1, 2.2, z + d / 2 + 0.3], [x + w / 2 + 0.1, 2.5, z - d / 2 - 0.3], [x - w / 2 - 0.1, 2.5, z - d / 2 - 0.3]], [[u, 0], [u + 0.6, 0], [u + 0.6, 0.45], [u, 0.45]]);
    this.stalls.push([x, z]);
    // Round 2, from Mzee's market photos: fruit stacked in pyramids on both faces, a hand-written price card in
    // each pile, banana bunches hanging from the awning, a bare bulb on a wire, cardboard boxes underneath.
    const FR = [[0.95, 0.62, 0.12], [0.96, 0.46, 0.06], [0.8, 0.12, 0.08], [0.86, 0.82, 0.24], [0.48, 0.64, 0.18], [0.72, 0.12, 0.14]];
    // piles on the face the player sees while running (-Z is forward): ~12 fruit a stall, all one draw call
    for (const side of [1]) {
      for (const px of [-0.62, 0.62]) {
        const col = FR[Math.floor(R() * FR.length)], cz = z + side * d / 4 + side * 0.02, base = top + 0.02;
        const r = 0.075;
        for (let i = 0; i < 4; i++) this.fruit.push([x + px + (i - 1.5) * r * 2.05, base + r, cz + (i % 2 ? 0.01 : -0.01), col]);
        for (let i = 0; i < 2; i++) this.fruit.push([x + px + (i - 0.5) * r * 2.05, base + r * 2.7, cz - side * 0.06, col]);
        // price card on a stick
        const k = Math.floor(R() * 8), cx = x + px + 0.18, cy = base + 0.32, sz = cz + side * 0.04, cu = (k % 4) / 4, cv = 1 - Math.floor(k / 4) / 2;
        this.B.quad('prices', [[cx - 0.1, cy - 0.065, sz], [cx + 0.1, cy - 0.065, sz], [cx + 0.1, cy + 0.065, sz], [cx - 0.1, cy + 0.065, sz]], side > 0 ? [[cu, cv - 0.5], [cu + 0.25, cv - 0.5], [cu + 0.25, cv], [cu, cv]] : [[cu + 0.25, cv - 0.5], [cu, cv - 0.5], [cu, cv], [cu + 0.25, cv]]);
        this.B.beam('paint', [cx, base, sz], [cx, cy - 0.06, sz], 0.012, C.wood);
      }
      if (R() < 0.4) this.melons.push([x + (R() - 0.5) * 1.6, 0.17, z + side * (d / 2 + 0.25)]);
    }
    if (R() < 0.45) for (const bx of [-0.7, 0.55]) {                 // banana bunches hanging from the awning
      const hx = x + bx, hz = z + d / 2 + 0.22, hy = 2.18;
      this.B.beam('paint', [hx, hy, hz], [hx, hy - 0.35, hz], 0.02, C.woodDark);
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, y0 = hy - 0.32 - (i % 3) * 0.07; this.B.beam('paint', [hx + Math.cos(a) * 0.04, y0, hz + Math.sin(a) * 0.04], [hx + Math.cos(a) * 0.13, y0 - 0.18, hz + Math.sin(a) * 0.13], 0.045, i % 2 ? [0.9, 0.78, 0.18] : [0.82, 0.72, 0.16]); }
    }
    this.bulbs.push([x + (R() - 0.5) * 0.6, 2.02, z]);
    this.wires.push([[x, 2.2, z], [x + 0.001, 2.08, z], 0]);
    for (let i = 0; i < 2; i++) if (R() < 0.6) { const bx = x + (i ? 0.7 : -0.7); this.paintBox(bx - 0.28, 0, z - 0.25, bx + 0.28, 0.32 + (i ? 0.3 : 0), z + 0.25, C.carton, false); }
  }
  crateStack(x, z, R) {
    this.texBox(x - 0.6, 0, z - 0.45, x + 0.6, 0.55, z + 0.45, 'crate', 0.55, false);
    this.texBox(x - 0.45, 0.55, z - 0.35, x + 0.35, 1.05, z + 0.35, 'burlap', 0.6, false);
    this.col(x - 0.6, 0, z - 0.45, x + 0.6, 1.05, z + 0.45, { vault: true, kind: 'crates' });
    const m = A.glb.mango_crate.scene.clone(); m.position.set(x + 0.1, 0, z + 0.85); m.rotation.y = R() * 2; m.scale.setScalar(1.3);
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    this.root.add(m);
  }

  road() {
    // the main road: a Catmull-Rom spline sampled every metre into (s -> point, tangent) tables
    const pts = [[0, -312], [0, -380], [12, -440], [32, -500], [34, -560], [12, -622], [-22, -680], [-33, -748], [-15, -808], [0, -846], [0, -884]]
      .map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const len = curve.getLength();
    const N = Math.ceil(len);
    const px = new Float32Array(N + 1), pz = new Float32Array(N + 1), tx = new Float32Array(N + 1), tz = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const u = Math.min(1, i / len), p = curve.getPointAt(u), t = curve.getTangentAt(u);
      px[i] = p.x; pz[i] = p.z; const l = Math.hypot(t.x, t.z); tx[i] = t.x / l; tz[i] = t.z / l;
    }
    const W = 6.5, SW = 2.4;
    const road = this.roadInfo = {
      len: N, W,
      at(s, d = 0, out) {
        s = Math.max(0, Math.min(N - 0.001, s)); const i = Math.floor(s), f = s - i;
        const x = px[i] + (px[i + 1] - px[i]) * f, z = pz[i] + (pz[i + 1] - pz[i]) * f;
        let ax = tx[i] + (tx[i + 1] - tx[i]) * f, az = tz[i] + (tz[i + 1] - tz[i]) * f; const l = Math.hypot(ax, az); ax /= l; az /= l;
        out = out || {}; out.x = x + -az * d; out.z = z + ax * d; out.tx = ax; out.tz = az; out.yaw = Math.atan2(ax, az); return out;
      },
    };
    // invisible ground under the whole road region (pickups and dropped things land on it)
    this.col(-80, -2, -886, 80, 0, -312, { ground: true });
    // ribbon: asphalt + raised sidewalks
    const tmp = {}, tmp2 = {};
    for (let s = 0; s < N; s += 2) {
      const s2 = Math.min(N, s + 2);
      const ring = (d, y, o) => { road.at(s, d, tmp); road.at(s2, d, tmp2); return [[tmp.x, y, tmp.z], [tmp2.x, y, tmp2.z]]; };
      const strip = (d0, d1, y, mat, k) => {
        const [a0, a1] = ring(d0, y), [b0, b1] = ring(d1, y);
        this.B.quad(mat, [a0, b0, b1, a1], [[d0 / k, s / k], [d1 / k, s / k], [d1 / k, s2 / k], [d0 / k, s2 / k]]);
      };
      strip(-W, W, 0.0, 'street', 7);
      strip(W, W + SW, 0.15, 'market', 3); strip(-W - SW, -W, 0.15, 'market', 3);
    }
    // buildings along both sides
    const R = this.R;
    for (const side of [-1, 1]) {
      let s = 6;
      while (s < N - 8) {
        const w = 8 + Math.floor(R() * 5), d = 10;
        const off = W + SW + d / 2 + 0.2;
        road.at(s + w / 2, side * off, tmp);
        // face the road: normal = -side * right
        const nx = -side * -tmp.tz, nz = -side * tmp.tx;
        const floors = 2 + Math.floor(R() * 4);
        this.building(tmp.x, tmp.z, w, d, floors, { yaw: Math.atan2(nx, nz), shop: ['front'], collide: false, parapet: R() < 0.7, towerP: 0.1 });
        s += w + (R() < 0.15 ? 5 : 0.3);
      }
    }
    // power wires across the road every so often
    for (let s = 10; s < N; s += 28) { road.at(s, -W - SW, tmp); road.at(s + 5, W + SW, tmp2); this.wire([tmp.x, 7.5, tmp.z], [tmp2.x, 8, tmp2.z], 0.9); }
    // the fruit cart at the alley mouth (the crash)
    this.spawns.crashCart = new THREE.Vector3(1.2, 0, -880.5);
    this.spawns.tokPlayer = new THREE.Vector3(-2.6, 0, -318);
    this.spawns.tokThief = new THREE.Vector3(1.8, 0, -318);
  }

  alley() {
    // walls of the alley x -4.5..4.5, z -884..-918, end building is roof R1
    this.building(-9.5, -901, 10, 34, 2, { shop: ['right'], acFace: 'right', roofProps: false, h: ROOF.r1 + 1.6 });
    this.building(9.5, -901, 10, 34, 2, { shop: ['left'], acFace: 'left', roofProps: false, h: ROOF.r1 + 1.6 });
    // corners of the road junction
    this.building(-12, -880, 12, 6, 3, { shop: ['front', 'right'] });
    this.building(12, -880, 12, 6, 3, { shop: ['front', 'left'] });
    // climb route at the end of the alley: crates (1.2) -> balcony slab (3.0) -> roof (4.8)
    this.texBox(-4.4, 0, -918, -2.6, 1.2, -914.8, 'crate', 0.6, true, { noVault: true, climb: true, kind: 'crates' });
    this.texBox(-4.45, 0, -914.8, -3.4, 0.6, -913.9, 'crate', 0.6, true, { noVault: true, kind: 'crates' });
    this.texBox(-4.5, 2.82, -918, -1.2, 3.0, -916.9, 'roof', 1.5, true, { climb: true, kind: 'balcony' });
    this.paintBox(-4.5, 3.0, -917.0, -1.2, 3.25, -916.9, C.iron, false);
    // doorways the buddies come out of
    this.spawns.buddyA = new THREE.Vector3(-3.6, 0, -906);
    this.spawns.buddyB = new THREE.Vector3(3.6, 0, -912);
    this.spawns.fight = new THREE.Vector3(0, 0, -889);
    this.spawns.crateDrop = new THREE.Vector3(3.2, 0, -888.6);
    // trash bins / boxes for flavour (vaultable)
    this.texBox(3.4, 0, -897, 4.4, 0.55, -895.6, 'crate', 0.55, true, { vault: true });
    this.texBox(3.5, 0.55, -896.9, 4.3, 0.9, -895.9, 'burlap', 0.6, false);
    this.wire([-4.5, 6.5, -893], [4.5, 6.2, -899], 0.5);
  }

  rooftops() {
    const H = ROOF;
    const roof = (x0, z0, x1, z1, h, opts = {}) => this.building((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z0 - z1, 0, { h, shop: [], noShop: true, parapetSides: opts.parapet || ['left', 'right'], collideParapet: true, roofProps: false, facade: opts.facade, ...opts.b });
    roof(-10, -918, 10, -940, H.r1, { facade: 'f_ochre' });     // R1 (alley end building)
    // round 3: the two gaps need a real (sprint) jump: 4.4 m level (a run jump reaches ~4.0, a sprint ~5.6) and
    // 3.8 m up 0.6 m onto R4 (run ~3.5, sprint ~4.9); a short jump can still catch the ledge and mantle
    roof(-10, -944.4, 10, -962, H.r2, { facade: 'f_brick_b' }); // R2 after a 4.4 m gap
    roof(-10, -962, 10, -985, H.r3, { facade: 'f_pale' });      // R3, lower
    roof(-10, -988.8, 10, -1000, H.r4, { facade: 'f_brick_c' }); // R4 after a 3.8 m gap
    roof(-10, -1000, 10, -1040, H.r5, { facade: 'f_brick_a', parapet: ['left', 'right'] }); // R5, tall
    // the chimney: tower A (tall, west) and block B (east) on R4 against R5's face
    this.building(-3.6, -996.5, 4.6, 7, 0, { h: H.a, noShop: true, facade: 'f_brick_a', roofProps: false, parapet: false });
    this.building(3.6, -996.5, 4.6, 7, 0, { h: H.b, noShop: true, facade: 'f_ochre', roofProps: false, parapet: false });
    for (const b of this.phys.boxes.slice(-2)) b.wall = true;
    // alleys below the gaps get a floor so a fall lands somewhere
    this.groundBox(-12, -940, 12, -944.4, 'street');
    this.groundBox(-12, -985, 12, -988.8, 'street');
    // side buildings beyond the route (visual)
    for (const z of [-930, -960, -990, -1020]) { this.building(-16, z, 12, 26, 1 + Math.floor(this.R() * 3), { towerP: 0.6 }); this.building(16, z, 12, 26, 1 + Math.floor(this.R() * 3), { towerP: 0.6 }); }
    // pigeon towers right beside the route (wooden lattice legs, painted coop on top)
    this.pigeonTower(-7.2, H.r2, -953, 4.6, 1, 0.3);
    this.pigeonTower(7.4, H.r5, -1024, 5.4, 1.1, -0.4, true);
    // R1 props: water tank, dishes, pigeon coop (all collide, vaultable)
    this.roofTank(5.5, H.r1, -929); this.roofDish(-6, H.r1, -925); this.roofDish(-7.2, H.r1, -935);
    this.coop(-4.5, H.r1, -931);
    this.spawns.pigeonsR1 = [[-4.5, H.r1 + 1.9, -931], [5.5, H.r1 + 2.1, -929], [2, H.r1 + 0.05, -926]];
    this.spawns.whitePigeon = new THREE.Vector3(5.5, H.r1 + 2.1, -929);
    // R2: low laundry line on the roof, AC box to vault
    this.roofLaundry(-950, H.r2);
    this.texBox(-2.5, H.r2, -957.5, 2.5, H.r2 + 0.95, -956.6, 'brickwall', 1.4, true, { vault: true });
    this.roofDish(7, H.r2, -945); this.roofTank(-7, H.r2, -959);
    // R3: parapet wall across to vault
    this.texBox(-10, H.r3, -972.4, 10, H.r3 + 1.0, -971.6, 'brickwall', 1.4, true, { vault: true });
    this.roofTank(6, H.r3, -980); this.roofDish(-6.5, H.r3, -966);
    // R5: tanks, dishes, pigeons, the view
    for (const [x, z] of [[-6, -1008], [6.5, -1016], [-5.5, -1027], [5, -1034]]) this.roofTank(x, H.r5, z);
    for (const [x, z] of [[7, -1005], [-7.5, -1019], [7.5, -1029]]) this.roofDish(x, H.r5, z);
    this.coop(0, H.r5, -1021.5);
    this.spawns.pigeonsR5 = [[0, H.r5 + 1.9, -1021.5], [-6, H.r5 + 2.1, -1008], [6.5, H.r5 + 2.1, -1016], [-2, H.r5 + 0.05, -1012]];
    // descent: awning slab then the corniche
    this.paintBox(-6, 3.4, -1046, 6, 3.6, -1040, C.concrete, true, { kind: 'awning' });
    this.B.quad('khay', [[-6, 3.62, -1040], [6, 3.62, -1040], [6, 3.62, -1046], [-6, 3.62, -1046]], [[0, 0], [3, 0], [3, 1.5], [0, 1.5]]);
    for (const x of [-5.8, 5.6]) this.paintBox(x, 0, -1045.9, x + 0.2, 3.4, -1045.7, C.iron, false);
    this.spawns.cpRoof1 = new THREE.Vector3(0, H.r1, -921);
    this.spawns.cpRoof2 = new THREE.Vector3(0, H.r5, -1003);
  }
  roofTank(x, y, z) { this.tanks.push([x, y, z, 1, 1.15]); this.col(x - 0.7, y, z - 0.7, x + 0.7, y + 1.8, z + 0.7, { kind: 'tank' }); }
  roofDish(x, y, z) { this.dishes.push([x, y, z, 2.6 + this.R(), 1.0]); this.col(x - 0.3, y, z - 0.3, x + 0.3, y + 1.4, z + 0.3, { kind: 'dish' }); }
  coop(x, y, z) {
    // wooden pigeon loft on legs
    for (const [dx, dz] of [[-1, -0.7], [1, -0.7], [-1, 0.7], [1, 0.7]]) this.paintBox(x + dx - 0.05, y, z + dz - 0.05, x + dx + 0.05, y + 1.0, z + dz + 0.05, C.woodDark, false);
    this.B.box(x - 1.1, y + 1.0, z - 0.8, x + 1.1, y + 1.85, z + 0.8, { all: { mat: 'coop', uv: (n, len) => [[0, 0], [len / 2.4, 0], [len / 2.4, 1], [0, 1]] }, top: { mat: 'paint', color: C.wood }, bottom: { mat: 'paint', color: C.woodDark } });
    this.paintBox(x - 1.2, y + 1.85, z - 0.9, x + 1.2, y + 1.95, z + 0.9, C.woodDark, false);
    this.col(x - 1.1, y, z - 0.8, x + 1.1, y + 1.95, z + 0.8, { kind: 'coop' });
  }
  roofLaundry(z, y) {
    this.paintBox(-6.1, y, z - 0.06, -5.95, y + 2.4, z + 0.06, C.iron, false);
    this.paintBox(5.95, y, z - 0.06, 6.1, y + 2.4, z + 0.06, C.iron, false);
    this.B.quad('laundry', [[-6, y + 1.06, z], [6, y + 1.06, z], [6, y + 2.3, z], [-6, y + 2.3, z]], [[0.2, 0], [2.6, 0], [2.6, 1], [0.2, 1]]);
    const b = this.col(-6, y + 1.06, z - 0.15, 6, y + 2.3, z + 0.15, { kind: 'laundry', noCam: true });
    this.laundry.push({ z, bottom: y + 1.06, b });
    // roof edges beside the line are blocked by parapets already
  }

  jetty() {
    // corniche buildings behind (east side of the river walk)
    this.building(-40, -1046, 20, 12, 3, { shop: ['back'] });
    this.building(40, -1046, 20, 12, 4, { shop: ['back'] });
    // river wall
    this.paintBox(-60, -1.5, -1062.6, -1.8, 0.0, -1062, C.concrete, false);
    this.paintBox(1.8, -1.5, -1062.6, 60, 0.0, -1062, C.concrete, false);
    // railings along the corniche edge
    for (let x = -58; x < 58; x += 2.5) if (Math.abs(x) > 2.4) this.paintBox(x, 0, -1061.9, x + 0.08, 1.0, -1061.8, C.iron, false);
    this.paintBox(-58, 0.95, -1061.95, -2.2, 1.02, -1061.75, C.iron, true);
    this.paintBox(2.2, 0.95, -1061.95, 58, 1.02, -1061.75, C.iron, true);
    this.col(-58, 0, -1062.6, -2.2, 1.0, -1061.7, {}); this.col(2.2, 0, -1062.6, 58, 1.0, -1061.7, {});
    // wooden jetty on posts
    const J0 = -1062, J1 = -1106;
    this.B.box(-1.6, 0.2, J1, 1.6, 0.4, J0, { top: { mat: 'wood', scale: 3.2 }, all: { mat: 'paint', color: C.woodDark }, bottom: null });
    this.col(-1.6, -3, J1, 1.6, 0.4, J0, { kind: 'jetty' });
    for (let z = J0 - 2; z > J1; z -= 4) for (const x of [-1.5, 1.4]) this.paintBox(x, -2.5, z, x + 0.14, 0.9, z + 0.14, C.woodDark, false);
    this.paintBox(-1.6, 0.85, J0, -1.5, 0.95, J1 + 4, C.woodDark, false);
    this.paintBox(1.5, 0.85, J0, 1.6, 0.95, J1 + 4, C.woodDark, false);
    this.microbus(-11, -1049, Math.PI / 2 - 0.08, [0.92, 0.91, 0.86]); this.microbus(-17.5, -1048.2, Math.PI / 2 + 0.05, [0.95, 0.94, 0.9]);
    for (let x = -56; x < 58; x += 8.5 + this.R() * 3) if (Math.abs(x) > 6 && (x < -22 || x > -8)) this.palm(x, -1060.5, 6.5 + this.R() * 2.5);
    this.spawns.cpJetty = new THREE.Vector3(0, 0, -1052);
    this.spawns.jettyEnd = J1;
    this.spawns.ferry = new THREE.Vector3(0, 0, J1 - 5.2);
    // the Nile
    this.nile = makeNile();
    this.root.add(this.nile);
  }

  distant() {
    // Mamluk minarets and ribbed domes as silhouettes over the roofs (two instanced draws), placed where the
    // route looks: down the street, over the market, along the road, from the rooftops, on the far Nile bank
    const MIN = [[-38, -222, 1.0], [52, -262, 0.9], [-62, -380, 1.1], [48, -425, 1.0], [-80, -560, 1.0], [70, -700, 1.2], [-90, -860, 1.0], [58, -962, 1.1],
      [-50, -1002, 1.15], [50, -1030, 0.9], [-60, -40, 1.1], [-40, -1432, 1.2], [92, -1440, 1.1], [-150, -1428, 1.25]];
    const DOME = [[-47, -230, 1.0], [60, -272, 0.8], [-58, -1012, 1.1], [70, -712, 0.9], [-30, -1440, 1.3], [105, -1446, 0.9]];
    const inst = (geo, list, mat) => {
      const im = new THREE.InstancedMesh(geo, mat || this.mats.paint, list.length), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S3 = new THREE.Vector3(), P3 = new THREE.Vector3();
      list.forEach(([x, z, k], i) => { M4.compose(P3.set(x, 0, z), Q.setFromAxisAngle(S3.set(0, 1, 0), i * 0.7), S3.set(k, k, k)); im.setMatrixAt(i, M4); });
      im.computeBoundingSphere(); im.frustumCulled = false; this.root.add(im);
    };
    const near = (l) => l.filter((e) => e[1] > -1300), far = (l) => l.filter((e) => e[1] <= -1300);
    inst(makeMinaretGeo(), near(MIN)); inst(makeDomeGeo(), near(DOME));
    inst(makeMinaretGeo(), far(MIN), SILHOUETTE); inst(makeDomeGeo(), far(DOME), SILHOUETTE);
    // filler blocks so the far view is not empty
    const R = this.R;
    for (let i = 0; i < 90; i++) {
      const z = 30 - R() * 1060, side = R() < 0.5 ? -1 : 1, x = side * (30 + R() * 70);
      if (z < -312 && z > -890) continue; // the road region has its own
      this.building(x, z, 10 + R() * 8, 10 + R() * 8, 1 + Math.floor(R() * 6), { collide: false, parapet: false, noShop: true, facade: R() < 0.65 ? 'f_brick_a' : 'f_ochre', towerP: 0.22, far: true });
    }
    // far bank of the Nile: a low strip of palms and blocks
    for (let x = -300; x < 300; x += 14 + R() * 10) this.building(x, -1420 - R() * 30, 12, 10, 1 + Math.floor(R() * 4), { collide: false, parapet: false, noShop: true, roofProps: false });
    for (let x = -260; x < 260; x += 6 + R() * 9) this.palm(x, -1405 - R() * 8, 7 + R() * 4);
  }

  // Cairo microbus (round 2, from Mzee's photos): a boxy white Hiace-style van, blue lower half and belt
  // stripe, dark window band, the sliding door open on the right (a dark doorway, the door slid back over the
  // rear window), roof rack with luggage, dust low on the body, Arabic route text painted on both sides.
  microbus(x, z, yaw, body) {
    const parts = [];
    const add = (w, h, d, cx, cy, cz, col) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(cx, cy, cz); paintGeo(g, col); parts.push(g.toNonIndexed()); };
    const cyl = (r, l, cx, cy, cz, col, axis = 'z', seg = 10) => { const g = new THREE.CylinderGeometry(r, r, l, seg); if (axis === 'z') g.rotateZ(Math.PI / 2); else if (axis === 'x') g.rotateX(Math.PI / 2); g.translate(cx, cy, cz); paintGeo(g, col); parts.push(g.toNonIndexed()); };
    const white = body, blue = [0.16, 0.33, 0.62], dust = [0.62, 0.55, 0.45], dark = [0.06, 0.06, 0.07], trim = [0.75, 0.74, 0.7], glass = [0.1, 0.12, 0.15];
    const L = 4.8, W = 1.86, hl = L / 2;
    // round 3 (Mzee: the microbus right behind Radwan in the opening shot was plain boxes): the body is a rounded
    // extrusion (rounded roof edges, rounded nose and tail), with the blue skirt, the belt stripe and the dark
    // window band wrapped round it as slightly larger rounded bands
    const slab = (w, y0, y1, len, rT, rB, bev, col) => {
      rT = Math.max(0.015, rT); rB = Math.max(0.015, rB);   // a zero radius makes a degenerate curve (a spike)
      const sw = w - 2 * bev, sh = y1 - y0 - 2 * bev, x0 = -sw / 2, yb = y0 + bev, S = new THREE.Shape();
      S.moveTo(x0 + rB, yb); S.lineTo(x0 + sw - rB, yb); S.quadraticCurveTo(x0 + sw, yb, x0 + sw, yb + rB);
      S.lineTo(x0 + sw, yb + sh - rT); S.quadraticCurveTo(x0 + sw, yb + sh, x0 + sw - rT, yb + sh);
      S.lineTo(x0 + rT, yb + sh); S.quadraticCurveTo(x0, yb + sh, x0, yb + sh - rT);
      S.lineTo(x0, yb + rB); S.quadraticCurveTo(x0, yb, x0 + rB, yb);
      const g = new THREE.ExtrudeGeometry(S, { depth: len - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 4 });
      g.translate(0, 0, -(len - 2 * bev) / 2); g.deleteAttribute('uv'); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      paintGeo(g, col); parts.push(g.index ? g.toNonIndexed() : g);
    };
    slab(W, 0.28, 2.0, L, 0.26, 0.05, 0.12, white);                 // the body
    slab(W + 0.014, 0.3, 0.83, L + 0.014, 0.0, 0.05, 0.1, blue);      // blue lower half
    slab(W + 0.02, 0.44, 0.52, L + 0.02, 0, 0, 0.03, dust);           // dusty sill
    slab(W + 0.016, 1.13, 1.21, L + 0.016, 0, 0, 0.03, blue);         // belt stripe
    slab(W + 0.012, 1.27, 1.84, L + 0.012, 0.06, 0.02, 0.1, glass);   // window band, windscreen and rear window
    for (const pz of [-1.45, -0.62, 0.2, 0.95]) add(W + 0.03, 0.57, 0.1, 0, 1.555, pz, white); // pillars
    add(W - 0.2, 0.2, 0.05, 0, 0.82, hl + 0.01, [0.2, 0.2, 0.22]);
    for (const hx of [-0.68, 0.68]) add(0.3, 0.16, 0.05, hx, 0.98, hl + 0.01, [1, 0.95, 0.78]);
    add(W + 0.06, 0.16, 0.18, 0, 0.42, hl + 0.06, [0.22, 0.22, 0.22]); add(W + 0.06, 0.16, 0.18, 0, 0.42, -hl - 0.06, [0.22, 0.22, 0.22]);
    add(0.5, 0.14, 0.03, 0, 0.62, hl + 0.03, [0.95, 0.95, 0.95]); add(0.5, 0.04, 0.031, 0, 0.67, hl + 0.031, blue);
    for (const sx of [-1, 1]) { add(0.05, 0.05, 0.25, sx * (W / 2 + 0.12), 1.45, hl - 0.4, dark); add(0.06, 0.2, 0.12, sx * (W / 2 + 0.24), 1.45, hl - 0.3, dark); } // mirrors
    for (const hx of [-0.8, 0.8]) add(0.14, 0.3, 0.05, hx, 0.98, -hl - 0.01, [0.75, 0.12, 0.08]);
    // open sliding door on the right (+x): a dark doorway, the door panel slid back outside the body
    add(0.04, 1.3, 0.95, W / 2 + 0.005, 1.0, 0.75, dark);
    add(0.05, 1.32, 0.98, W / 2 + 0.08, 1.02, -0.3, white); add(0.051, 0.42, 0.98, W / 2 + 0.081, 0.62, -0.3, blue);
    add(0.5, 0.12, 0.9, W / 2 - 0.1, 0.32, 0.75, [0.3, 0.3, 0.3]); // step
    // wheels with dark arches
    for (const [wx, wz] of [[-0.86, 1.5], [0.86, 1.5], [-0.86, -1.55], [0.86, -1.55]]) {
      add(0.1, 0.5, 0.9, wx * 1.04, 0.62, wz, dark);
      cyl(0.34, 0.24, wx, 0.34, wz, [0.07, 0.07, 0.07], 'z', 14); cyl(0.15, 0.26, wx, 0.34, wz, [0.66, 0.66, 0.64], 'z', 8);
    }
    // roof rack + luggage
    add(1.66, 0.06, 3.1, 0, 2.05, -0.5, dark);
    for (const rx of [-0.8, 0.8]) add(0.05, 0.16, 3.1, rx, 2.13, -0.5, dark);
    for (const rz of [-1.9, -0.9, 0.1, 0.9]) add(1.66, 0.04, 0.05, 0, 2.16, rz, dark);
    add(0.62, 0.32, 0.5, -0.3, 2.24, -1.0, C.sack); add(0.5, 0.3, 0.62, 0.38, 2.23, 0.15, [0.42, 0.32, 0.5]); add(0.4, 0.22, 0.4, 0.25, 2.19, -1.55, [0.7, 0.2, 0.15]);
    const m = new THREE.Mesh(mergeGeometries(parts), this.mats.paint);
    m.position.set(x, 0, z); m.rotation.y = yaw; m.castShadow = m.receiveShadow = true;
    // route text on both sides (canvas, game font) and the destination board on the rack
    const i = (this.signDest = (this.signDest || 0) + 1);
    const side = sideMat(i);
    for (const sx of [-1, 1]) { const q = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.3), side); q.position.set(sx * (W / 2 + 0.012), 0.98, -0.95); q.rotation.y = sx * Math.PI / 2; m.add(q); }
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.36, 0.06), [this.mats.paint, this.mats.paint, this.mats.paint, this.mats.paint, signMat(i), this.mats.paint]);
    paintGeo(sign.geometry, [0.25, 0.2, 0.15]);
    sign.position.set(0, 2.5, 0.9); m.add(sign);
    this.root.add(m);
    const c = Math.abs(Math.cos(yaw)), hx = 0.95 * c + 2.45 * (1 - c), hz = 2.45 * c + 0.95 * (1 - c);
    this.col(x - hx, 0, z - hz - 0.15, x + hx, 2.3, z + hz + 0.15, { kind: 'bus' });
    return m;
  }
  teaCart(x, z) {
    const parts = [];
    const add = (w, h, d, cx, cy, cz, col) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(cx, cy, cz); paintGeo(g, col); parts.push(g); };
    add(1.6, 0.8, 0.8, 0, 0.55, 0, C.blue); add(1.7, 0.06, 0.9, 0, 0.98, 0, C.iron);
    const k = new THREE.CylinderGeometry(0.16, 0.22, 0.42, 12); k.translate(0.4, 1.22, 0); paintGeo(k, C.brass); parts.push(k);
    const k2 = new THREE.ConeGeometry(0.16, 0.18, 12); k2.translate(0.4, 1.52, 0); paintGeo(k2, C.brass); parts.push(k2);
    for (let i = 0; i < 5; i++) { const gl = new THREE.CylinderGeometry(0.035, 0.03, 0.09, 6); gl.translate(-0.5 + i * 0.12, 1.06, 0.15); paintGeo(gl, [0.7, 0.25, 0.1]); parts.push(gl); }
    for (const wx of [-0.7, 0.7]) { const g = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 12); g.rotateX(Math.PI / 2); g.translate(wx, 0.3, 0.45); paintGeo(g, C.tyre); parts.push(g); }
    const m = new THREE.Mesh(mergeGeometries(parts), this.mats.paint);
    m.position.set(x, 0, z); m.castShadow = true; this.root.add(m);
    this.col(x - 0.85, 0, z - 0.45, x + 0.85, 1.0, z + 0.55, { kind: 'teacart', vault: true });
  }

  instanced() {
    // water tanks
    const tg = new THREE.CylinderGeometry(0.62, 0.62, 1.2, 14); tg.translate(0, 1.0, 0);
    const legs = new THREE.BoxGeometry(1.1, 0.4, 1.1); legs.translate(0, 0.2, 0);
    const tankGeo = mergeGeometries([tg, legs]);
    const tankMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const tm = new THREE.InstancedMesh(tankGeo, tankMat, this.tanks.length);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), col = new THREE.Color();
    this.tanks.forEach(([x, y, z, blue, s], i) => {
      M.compose(P.set(x, y, z), Q.identity(), S.set(s, s, s)); tm.setMatrixAt(i, M);
      tm.setColorAt(i, col.setRGB(...(blue ? C.tankBlue : C.tank)));
    });
    tm.castShadow = true; tm.receiveShadow = true; tm.computeBoundingSphere();
    this.root.add(tm);
    // satellite dishes
    const dishMesh = [];
    A.glb.satellite_dish.scene.traverse((o) => { if (o.isMesh) dishMesh.push(o); });
    for (const src of dishMesh) {
      src.updateWorldMatrix(true, false);
      const g = src.geometry.clone(); g.applyMatrix4(src.matrixWorld);
      const dm = new THREE.InstancedMesh(g, src.material, this.dishes.length);
      this.dishes.forEach(([x, y, z, r, s], i) => { M.compose(P.set(x, y, z), Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r), S.set(s, s, s)); dm.setMatrixAt(i, M); });
      dm.castShadow = true; dm.computeBoundingSphere(); this.root.add(dm);
    }
    // AC units
    const acGeo = new THREE.BoxGeometry(0.85, 0.55, 0.42); acGeo.translate(0, 0, 0.21);
    const am = new THREE.InstancedMesh(acGeo, new THREE.MeshLambertMaterial({ color: 0xdedbd2 }), this.acs.length);
    this.acs.forEach((a, i) => {
      const c = Math.cos(a.yaw), s = Math.sin(a.yaw);
      let lx, lz, r;
      const o = a.out || 0;   // round 3: some on brackets, standing off the wall, and not all square to it
      if (a.face === 'right') { lx = a.w / 2 + o; lz = a.along; r = a.yaw + Math.PI / 2; }
      else if (a.face === 'left') { lx = -a.w / 2 - o; lz = a.along; r = a.yaw - Math.PI / 2; }
      else if (a.face === 'back') { lx = a.along; lz = -a.d / 2 - o; r = a.yaw + Math.PI; }
      else { lx = a.along; lz = a.d / 2 + o; r = a.yaw; }
      r += a.tilt || 0;
      M.compose(P.set(a.cx + lx * c + lz * s, a.y, a.cz - lx * s + lz * c), Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r), S.set(1, 1, 1));
      am.setMatrixAt(i, M);
    });
    am.castShadow = true; am.computeBoundingSphere(); this.root.add(am);
  }
  // market fruit (one instanced draw for every fruit), watermelons, bare bulbs (unlit, warm)
  marketInstances() {
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), col = new THREE.Color();
    const fg = new THREE.IcosahedronGeometry(0.078, 0);
    const fm = new THREE.InstancedMesh(fg, new THREE.MeshLambertMaterial({ color: 0xffffff }), this.fruit.length);
    this.fruit.forEach(([x, y, z, c], i) => { const k = 0.9 + ((i * 37) % 10) / 50; M.compose(P.set(x, y, z), Q.identity(), S.set(k, k * 0.92, k)); fm.setMatrixAt(i, M); fm.setColorAt(i, col.setRGB(c[0] * k, c[1] * k, c[2] * k)); });
    fm.castShadow = false; fm.receiveShadow = true; fm.computeBoundingSphere(); this.root.add(fm);
    if (this.melons.length) {
      const mm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 10, 7), new THREE.MeshLambertMaterial({ color: 0x2f6a24 }), this.melons.length);
      this.melons.forEach(([x, y, z], i) => { M.compose(P.set(x, y, z), Q.setFromAxisAngle(S.set(0, 1, 0), i), S.set(1.35, 0.85, 1)); mm.setMatrixAt(i, M); });
      mm.castShadow = true; mm.computeBoundingSphere(); this.root.add(mm);
    }
    const bm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe2a0 }), this.bulbs.length);
    this.bulbs.forEach(([x, y, z], i) => { M.compose(P.set(x, y, z), Q.identity(), S.set(1, 1.2, 1)); bm.setMatrixAt(i, M); });
    bm.computeBoundingSphere(); this.root.add(bm);
  }
  wiresMesh() {
    const pos = [];
    for (const [a, b, sag] of this.wires) {
      const n = 10;
      for (let i = 0; i < n; i++) {
        for (const t of [i / n, (i + 1) / n]) {
          pos.push(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t);
        }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x1a1210 }));
    this.root.add(l);
  }
}

// Shop signs: 16 painted boards in Arabic with invented shop names, drawn once into a canvas atlas
// (2 columns x 8 rows of 512x64) in the game font, so the lettering is real Arabic and not image-model text.
const SIGN_N = 16;
const SIGNS = [
  ['بقالة الأمل', '#c8241c', '#fff6e0'], ['حلاق النجمة', '#1f4f9a', '#ffffff'], ['عصير الصعيدي', '#f0c419', '#3a1a08'], ['خردوات الحاج سعيد', '#2e7d4f', '#fff6e0'],
  ['مكوجي البركة', '#f2efe6', '#b3261e'], ['فول وطعمية أم علي', '#e8701a', '#ffffff'], ['أدوات منزلية الصفا', '#1d6f8a', '#ffe9a8'], ['موبايلات الشروق', '#111111', '#ffd23f'],
  ['ترزي الأناقة', '#7a2d6b', '#ffffff'], ['عطارة الشفا', '#5b3a1c', '#ffe7b0'], ['مخبز العيش البلدي', '#d9c9a3', '#7a1d12'], ['ورشة عجل حمادة', '#2b2b2b', '#f2f2f2'],
  ['صيدلية د. منى', '#ffffff', '#1a7f3c'], ['جزارة الأمانة', '#9c1b1b', '#ffffff'], ['بويات ودهانات النيل', '#2457c5', '#ffffff'], ['كشري وحلويات الهنا', '#f7d046', '#b0201a'],
];
// the town atlas image plus the sign boards drawn into its empty corner
function townAtlas(img, aniso) {
  const c = document.createElement('canvas'); c.width = c.height = 2048; const x = c.getContext('2d');
  x.drawImage(img, 0, 0, 2048, 2048);
  x.drawImage(signCanvas(), 1024, 1536);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso || 1;
  return t;
}
function signCanvas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d');
  SIGNS.forEach(([name, bg, fg], i) => {
    const X = (i % 2) * 512, Yp = Math.floor(i / 2) * 64;
    x.fillStyle = bg; x.fillRect(X, Yp, 512, 64);
    x.fillStyle = fg; x.globalAlpha = 0.85; x.fillRect(X, Yp + 3, 512, 3); x.fillRect(X, Yp + 58, 512, 3); x.globalAlpha = 1;
    x.font = '800 36px CairoGame, "Noto Naskh Arabic", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
    x.fillStyle = fg; x.fillText(name, X + 256, Yp + 34, 480);
    // sun and dust: a little fade and grime so they do not look printed yesterday
    const g = x.createLinearGradient(X, Yp, X, Yp + 64); g.addColorStop(0, 'rgba(255,240,210,0.10)'); g.addColorStop(1, 'rgba(60,40,20,0.22)');
    x.fillStyle = g; x.fillRect(X, Yp, 512, 64);
  });
  return c;
}
// Kiosk atlas (1024x1024): red fridge door [0,0,512,768], blue fridge door [512,0,512,768], red brand banner
// [0,768,1024,128], blue koshk banner [0,896,1024,128]. Brands are invented (Shams Cola, Nesma): the colours of
// the cola fridges in every Cairo kiosk, no real names or logos. The bottles behind the glass are a
// gpt-image-2 texture with plain labels.
function kioskAtlas(fridgeImg) {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
  const font = (px) => `900 ${px}px CairoGame, "Noto Naskh Arabic", sans-serif`;
  const sun = (cx, cy, r) => { x.fillStyle = '#ffcf33'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); x.strokeStyle = '#ffcf33'; x.lineWidth = r * 0.22; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; x.beginPath(); x.moveTo(cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r * 1.3); x.lineTo(cx + Math.cos(a) * r * 1.75, cy + Math.sin(a) * r * 1.75); x.stroke(); } };
  const door = (X, frame, dark, brand, sub) => {
    x.fillStyle = frame; x.fillRect(X, 0, 512, 768);
    x.fillStyle = dark; x.fillRect(X, 0, 512, 120);
    x.font = font(66); x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl'; x.fillStyle = '#fff';
    x.fillText(brand, X + 256 + 30, 58, 380);
    if (sub) sub(X + 70, 60);
    x.fillStyle = '#1a1d22'; x.fillRect(X + 34, 136, 444, 560);
    if (fridgeImg) x.drawImage(fridgeImg, X + 40, 142, 432, 548);
    const g = x.createLinearGradient(X + 40, 142, X + 472, 690); g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(0.35, 'rgba(255,255,255,0.02)'); g.addColorStop(0.6, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(X + 40, 142, 432, 548);
    x.fillStyle = 'rgba(230,230,230,0.9)'; x.fillRect(X + 448, 300, 14, 220);
    x.fillStyle = dark; x.fillRect(X, 708, 512, 60);
    x.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 0; i < 14; i++) x.fillRect(X + 40 + i * 31, 722, 18, 32);
  };
  door(0, '#c4161c', '#8f0f12', 'شمس كولا', (cx, cy) => sun(cx, cy, 22));
  door(512, '#1546a8', '#0d2f74', 'نَسمة', (cx, cy) => { x.strokeStyle = '#9fd6ff'; x.lineWidth = 7; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(cx, cy + 18 - i * 14, 26 - i * 4, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); } });
  // banners
  x.fillStyle = '#c4161c'; x.fillRect(0, 768, 1024, 128); sun(90, 832, 26); sun(934, 832, 26);
  x.font = font(70); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl'; x.fillText('شمس كولا · اشرب ساقع', 512, 836, 760);
  x.fillStyle = '#1546a8'; x.fillRect(0, 896, 1024, 128); x.fillStyle = '#f4f4f4'; x.fillRect(0, 900, 1024, 6); x.fillRect(0, 1014, 1024, 6);
  x.font = font(66); x.fillStyle = '#fff'; x.fillText('كشك الحاج رمضان', 512, 962, 900);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// grime streaks: 4 tiles of 128 x 256, dark brown, alpha only where the water ran (soft vertical runs from the
// top, a stain band at the top edge), so every streak fades out downward
function grimeTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
  let seed = 4242; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 4; k++) {
    const X = k * 128;
    const g = x.createLinearGradient(0, 0, 0, 40); g.addColorStop(0, 'rgba(38,28,18,0.55)'); g.addColorStop(1, 'rgba(38,28,18,0)');
    x.fillStyle = g; x.fillRect(X + 4, 0, 120, 40);
    for (let i = 0; i < 9 + k * 3; i++) {
      const sx = X + 8 + R() * 112, w = 2 + R() * (k === 2 ? 16 : 9), len = 60 + R() * 196, a = 0.18 + R() * 0.32;
      const gg = x.createLinearGradient(0, 0, 0, len); gg.addColorStop(0, `rgba(34,25,16,${a})`); gg.addColorStop(0.6, `rgba(34,25,16,${a * 0.6})`); gg.addColorStop(1, 'rgba(34,25,16,0)');
      x.fillStyle = gg; x.beginPath(); x.moveTo(sx, 0); x.lineTo(sx + w, 0); x.lineTo(sx + w * 0.6 + (R() - 0.5) * 4, len); x.lineTo(sx + w * 0.3, len); x.closePath(); x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// hand-written price cards on cardboard (512x128: 4 x 2 cards), Arabic numerals in the game font
function priceCards() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  const T = ['الكيلو ١٠', '٣ بـ ١٠', 'الكيلو ٢٠', 'بـ ١٥', 'الكيلو ٨', 'عرض! ٥', 'الكيلو ٢٥', 'بلدي ١٢'];
  T.forEach((t, i) => {
    const X = (i % 4) * 128, Y = Math.floor(i / 4) * 64;
    x.fillStyle = i % 3 ? '#d8b98a' : '#efe6d2'; x.fillRect(X + 3, Y + 3, 122, 58);
    x.fillStyle = i % 2 ? '#1a1a8a' : '#a01414'; x.font = '800 30px CairoGame, "Noto Naskh Arabic", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
    x.fillText(t, X + 64, Y + 34, 116);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// microbus route text along the side panel (white body, dark blue lettering, a little dust)
const ROUTES = ['إمبابة ـ الكيت كات ـ الكورنيش', 'إمبابة ـ المنيرة ـ الوراق', 'الكيت كات ـ إمبابة ـ المطار'];
const sideMats = {};
function sideMat(i) {
  const k = (i - 1) % ROUTES.length; if (sideMats[k]) return sideMats[k];
  const c = document.createElement('canvas'); c.width = 512; c.height = 90; const x = c.getContext('2d');
  x.fillStyle = '#ecebe6'; x.fillRect(0, 0, 512, 90);
  x.fillStyle = '#1f3f86'; x.font = '800 44px CairoGame, "Noto Naskh Arabic", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
  x.fillText(ROUTES[k], 256, 48, 490);
  const g = x.createLinearGradient(0, 0, 0, 90); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(120,95,60,0.25)'); x.fillStyle = g; x.fillRect(0, 0, 512, 90);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (sideMats[k] = new THREE.MeshLambertMaterial({ map: t }));
}
// microbus destination board (canvas text in the game's Arabic font)
const DESTS = ['إمبابة', 'الكيت كات', 'المنيرة'];
function signMat(i) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#f3ead2'; x.fillRect(0, 0, 256, 64); x.strokeStyle = '#3a2a1a'; x.lineWidth = 4; x.strokeRect(2, 2, 252, 60);
  x.fillStyle = '#1d1a16'; x.font = '800 38px CairoGame, "Noto Naskh Arabic", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
  x.fillText(DESTS[(i - 1) % DESTS.length], 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({ map: t });
}

function paintGeo(g, c) {
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

// Mamluk minaret: square base, octagonal shaft, carved balcony, a slimmer round stage, a second balcony, an
// open pavilion of posts and a bulb top with a finial
function makeMinaretGeo() {
  const parts = [];
  const col = (g, c) => { paintGeo(g, c); parts.push(g.index ? g.toNonIndexed() : g); };
  const stone = [0.78, 0.66, 0.52], dark = [0.5, 0.41, 0.33];
  let g = new THREE.BoxGeometry(4.2, 15, 4.2); g.translate(0, 7.5, 0); col(g, stone);
  g = new THREE.BoxGeometry(4.6, 0.6, 4.6); g.translate(0, 15.2, 0); col(g, dark);
  g = new THREE.CylinderGeometry(1.75, 1.95, 11, 8); g.translate(0, 21, 0); col(g, stone);
  g = new THREE.CylinderGeometry(2.6, 2.0, 1.0, 8); g.translate(0, 27, 0); col(g, dark);
  g = new THREE.CylinderGeometry(2.55, 2.55, 0.9, 8, 1, true); g.translate(0, 28, 0); col(g, dark);
  g = new THREE.CylinderGeometry(1.25, 1.4, 7, 12); g.translate(0, 31.5, 0); col(g, stone);
  g = new THREE.CylinderGeometry(1.95, 1.4, 0.8, 12); g.translate(0, 35.3, 0); col(g, dark);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g = new THREE.BoxGeometry(0.22, 2.4, 0.22); g.translate(Math.cos(a) * 0.95, 36.9, Math.sin(a) * 0.95); col(g, stone); }
  g = new THREE.CylinderGeometry(1.25, 1.25, 0.4, 12); g.translate(0, 38.2, 0); col(g, dark);
  g = new THREE.SphereGeometry(1.05, 12, 8); g.scale(1, 1.45, 1); g.translate(0, 39.6, 0); col(g, stone);
  g = new THREE.CylinderGeometry(0.08, 0.08, 2.0, 5); g.translate(0, 41.9, 0); col(g, [0.75, 0.62, 0.3]);
  g = new THREE.SphereGeometry(0.25, 6, 4); g.translate(0, 42.6, 0); col(g, [0.85, 0.7, 0.3]);
  return mergeGeometries(parts);
}
// mosque dome on a drum, with the ribs suggested by alternating colours, and a crescent finial
function makeDomeGeo() {
  const parts = [];
  const col = (g, c) => { paintGeo(g, c); parts.push(g.index ? g.toNonIndexed() : g); };
  let g = new THREE.BoxGeometry(14, 9, 14); g.translate(0, 4.5, 0); col(g, [0.74, 0.62, 0.48]);
  g = new THREE.CylinderGeometry(5.4, 5.6, 3.2, 16); g.translate(0, 10.6, 0); col(g, [0.7, 0.58, 0.45]);
  g = new THREE.SphereGeometry(5.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, 1.18, 1); g.translate(0, 12.2, 0);
  g = g.toNonIndexed(); paintGeo(g, [0.66, 0.55, 0.43]);
  { const c = g.attributes.color, p = g.attributes.position; for (let i = 0; i < p.count; i += 3) { const a = Math.atan2(p.getZ(i), p.getX(i)); if (Math.floor((a + Math.PI) / (Math.PI / 8)) % 2) for (let k = 0; k < 3; k++) c.setXYZ(i + k, 0.58, 0.48, 0.37); } }
  parts.push(g);
  g = new THREE.CylinderGeometry(0.1, 0.1, 2.4, 5); g.translate(0, 19.8, 0); col(g, [0.75, 0.62, 0.3]);
  g = new THREE.SphereGeometry(0.35, 6, 4); g.translate(0, 21, 0); col(g, [0.85, 0.7, 0.3]);
  return mergeGeometries(parts);
}

// The Nile: a large plane with a cheap animated shader (colour bands, ripples, a sun glitter path).
function makeNile() {
  const g = new THREE.PlaneGeometry(1600, 900, 1, 1); g.rotateX(-Math.PI / 2); g.translate(0, -0.45, -1062 - 450);
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSun: { value: new THREE.Vector3(0.3, 0.2, -1).normalize() }, uSunCol: { value: new THREE.Color(1, 0.6, 0.3) },
      uDeep: { value: new THREE.Color(0.05, 0.1, 0.13) }, uSky: { value: new THREE.Color(0.95, 0.55, 0.35) }, uFogCol: { value: new THREE.Color() }, uFogD: { value: 0.006 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uFogCol; uniform float uFogD; varying vec3 vW;
      float h(vec2 p){ return sin(p.x*0.9+uTime*1.3)*0.5+sin(p.y*1.3-uTime*1.1+p.x*0.3)*0.5+sin((p.x+p.y)*2.7+uTime*2.3)*0.25; }
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        vec2 p = vW.xz;
        float e = 0.15; vec3 n = normalize(vec3(-(h(p+vec2(e,0.))-h(p))/e*0.08, 1.0, -(h(p+vec2(0.,e))-h(p))/e*0.08));
        float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        vec3 R = reflect(-V, n);
        float spec = pow(max(dot(R, uSun), 0.0), 220.0) * 2.2 + pow(max(dot(R, uSun), 0.0), 24.0) * 0.12;
        vec3 col = mix(uDeep, uSky * 0.55, 0.12 + fres * 0.55) + uSunCol * spec;
        float d = length(cameraPosition - vW); float f = 1.0 - exp(-uFogD*uFogD*d*d);
        gl_FragColor = vec4(mix(col, uFogCol, f*0.85), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = false;
  return mesh;
}
