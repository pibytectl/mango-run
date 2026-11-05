// Imbaba, built procedurally. Forward is -Z (west, toward the Nile and the sunset).
//   plaza (microbus stand)  z 34..0      street run   z 0..-188      market (foot chase)  z -188..-312
//   road (tok-tok chase)    z -315..-880 along a spline               alley fight          z -884..-918
//   rooftops                z -918..-1040                             corniche + jetty     z -1040..-1106, Nile beyond
import * as THREE from '../../vendor/three.module.min.js';
import { mergeGeometries } from '../../vendor/addons/BufferGeometryUtils.js';
import { Builder, rng } from './builder.js';
import { A } from './assets3d.js';

const FLOOR0 = 3.4, FLOOR = 3.2, TILE = 6.4, SHOP_W = 5.1;
export const ROOF = { // heights of the rooftop route
  r1: 4.8, r2: 4.8, r3: 2.6, r4: 3.2, b: 6.6, a: 9.5, r5: 7.0,
};

export function makeMaterials() {
  const T = A.tex;
  const L = (o) => new THREE.MeshLambertMaterial(o);
  const m = {
    f_plaster: L({ map: T.facade_plaster }), f_brick: L({ map: T.facade_brick }), f_pastel: L({ map: T.facade_pastel }), f_pink: L({ map: T.facade_pink }),
    shop: L({ map: T.shopfronts }), roof: L({ map: T.roof_concrete }), street: L({ map: T.ground_street }), market: L({ map: T.ground_market }),
    wood: L({ map: T.wood_planks }), khay: L({ map: T.khayamiya, side: THREE.DoubleSide }), produce: L({ map: T.produce }),
    paint: L({ vertexColors: true }),
    laundry: L({ map: T.laundry, alphaTest: 0.45, side: THREE.DoubleSide }),
  };
  m.laundry.userData.noCast = true;
  T.laundry.wrapS = THREE.RepeatWrapping;
  T.produce.wrapS = THREE.RepeatWrapping;
  T.shopfronts.wrapS = THREE.RepeatWrapping;
  return m;
}

const FACADES = ['f_plaster', 'f_brick', 'f_pastel', 'f_pink'];
const C = {
  plaster: [0.86, 0.74, 0.58], plasterDark: [0.62, 0.5, 0.38], concrete: [0.66, 0.64, 0.6], wood: [0.5, 0.33, 0.2], woodDark: [0.33, 0.21, 0.13],
  iron: [0.16, 0.15, 0.15], tank: [0.12, 0.13, 0.16], tankBlue: [0.2, 0.32, 0.55], ac: [0.86, 0.86, 0.82], sand: [0.8, 0.68, 0.48],
  brick: [0.62, 0.32, 0.22], rope: [0.85, 0.8, 0.7], white: [0.95, 0.94, 0.9], blue: [0.18, 0.36, 0.66], glass: [0.12, 0.14, 0.18], tyre: [0.08, 0.08, 0.08],
  brass: [0.85, 0.62, 0.25], red: [0.7, 0.16, 0.12], green: [0.2, 0.45, 0.25], sack: [0.78, 0.7, 0.52],
};

export class Level {
  constructor(scene, phys) {
    this.scene = scene; this.phys = phys;
    this.mats = makeMaterials();
    this.B = new Builder(this.mats);
    this.R = rng(1405);
    this.root = new THREE.Group(); scene.add(this.root);
    this.tanks = []; this.dishes = []; this.acs = [];
    this.laundry = []; this.props = []; this.wires = [];
    this.spawns = {};
    this.carts = []; this.stalls = [];
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
    this.B.finish(this.root);
    this.instanced();
    this.wiresMesh();
    return this;
  }

  // ------------------------------------------------------------------ helpers
  col(x0, y0, z0, x1, y1, z1, flags) { return this.phys.add(x0, y0, z0, x1, y1, z1, flags); }
  paintBox(x0, y0, z0, x1, y1, z1, color, collide, flags) {
    this.B.box(x0, y0, z0, x1, y1, z1, { all: { mat: 'paint', color }, bottom: null });
    if (collide) this.col(x0, y0, z0, x1, y1, z1, flags);
  }
  // A building block. Faces listed in `shop` get shopfronts on the ground floor.
  building(cx, cz, w, d, floors, opts = {}) {
    const R = this.R, B = this.B;
    const yaw = opts.yaw || 0;
    const H = opts.h ?? (FLOOR0 + floors * FLOOR);
    const fac = opts.facade || FACADES[Math.floor(R() * FACADES.length)];
    const off = Math.floor(R() * 4) * 0.5;
    const shop = opts.shop || [];
    const facadeUV = (o) => (name, len, y0, y1) => [[o, (y0 - FLOOR0) / TILE], [o + len / TILE, (y0 - FLOOR0) / TILE], [o + len / TILE, (y1 - FLOOR0) / TILE], [o, (y1 - FLOOR0) / TILE]];
    const faces = { all: { mat: fac, uv: facadeUV(off) }, top: { mat: 'roof', scale: 5 }, bottom: null };
    if (opts.plain) faces.all = { mat: 'paint', color: opts.plain };
    if (H <= FLOOR0 + 0.01 || opts.noShop) {
      B.obox(cx, cz, yaw, w, d, 0, H, faces);
    } else {
      // ground floor
      const g = { bottom: null, top: null, all: { mat: fac, uv: facadeUV(off) } };
      for (const f of shop) g[f] = { mat: 'shop', uv: (n, len, y0, y1) => { const o = R(); return [[o, 0], [o + len / SHOP_W, 0], [o + len / SHOP_W, 1], [o, 1]]; } };
      B.obox(cx, cz, yaw, w, d, 0, FLOOR0, g);
      B.obox(cx, cz, yaw, w, d, FLOOR0, H, { ...faces, bottom: null });
      // slab lip over the shops
      if (shop.length) B.obox(cx, cz, yaw, w + 0.3, d + 0.3, FLOOR0 - 0.05, FLOOR0 + 0.25, { all: { mat: 'paint', color: C.concrete }, bottom: { mat: 'paint', color: C.plasterDark } });
    }
    // parapet
    if (opts.parapet !== false) {
      const t = 0.22, ph = 0.7, c = Math.cos(yaw), s = Math.sin(yaw);
      const pc = opts.parapetColor || C.plaster;
      const seg = (lx, lz, ww, dd) => B.obox(cx + lx * c + lz * s, cz - lx * s + lz * c, yaw, ww, dd, H, H + ph, { all: { mat: 'paint', color: pc }, bottom: null });
      const sides = opts.parapetSides || ['front', 'back', 'left', 'right'];
      if (sides.includes('front')) seg(0, d / 2 - t / 2, w, t);
      if (sides.includes('back')) seg(0, -d / 2 + t / 2, w, t);
      if (sides.includes('left')) seg(-w / 2 + t / 2, 0, t, d - 2 * t);
      if (sides.includes('right')) seg(w / 2 - t / 2, 0, t, d - 2 * t);
      if (yaw === 0 && opts.collideParapet) for (const sd of sides) {
        const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
        if (sd === 'left') this.col(x0, H, z0, x0 + t, H + ph, z1, { vault: true });
        if (sd === 'right') this.col(x1 - t, H, z0, x1, H + ph, z1, { vault: true });
        if (sd === 'front') this.col(x0, H, z1 - t, x1, H + ph, z1, { vault: true });
        if (sd === 'back') this.col(x0, H, z0, x1, H + ph, z0 + t, { vault: true });
      }
    }
    if (yaw === 0 && opts.collide !== false) this.col(cx - w / 2, -1, cz - d / 2, cx + w / 2, H, cz + d / 2, { building: true });
    // roof clutter
    if (opts.roofProps !== false) {
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const at = (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
      if (R() < 0.75) { const [x, z] = at((R() - 0.5) * (w - 2.5), (R() - 0.5) * (d - 2.5)); this.tanks.push([x, H, z, R() < 0.3 ? 1 : 0, 0.9 + R() * 0.4]); }
      if (R() < 0.5) { const [x, z] = at((R() - 0.5) * (w - 2), (R() - 0.5) * (d - 2)); this.tanks.push([x, H, z, 0, 0.8 + R() * 0.3]); }
      if (R() < 0.7) { const [x, z] = at((R() - 0.5) * (w - 1.5), (R() - 0.5) * (d - 1.5)); this.dishes.push([x, H, z, R() * 6.28, 0.8 + R() * 0.4]); }
    }
    // AC units on the street face
    if (opts.acFace && H > 7) {
      const n = 1 + Math.floor(R() * 3);
      for (let i = 0; i < n; i++) {
        const fl = Math.floor(R() * floors), y = FLOOR0 + fl * FLOOR + 0.6;
        const along = (R() - 0.5) * (w - 1.4);
        this.acs.push({ cx, cz, yaw, w, d, face: opts.acFace, along, y });
      }
    }
    return H;
  }
  // a row of buildings along a z range on one side of an axis-aligned street (side -1 = west/left x<, +1 = right)
  row(side, xEdge, z0, z1, opts = {}) {
    const R = this.R;
    let z = z0;
    while (z > z1 + 3) {
      let w = opts.lot ? opts.lot : 7 + Math.floor(R() * 6);
      if (z - w < z1) w = z - z1;
      if (opts.gaps && opts.gaps.some(([g0, g1]) => z - w < g0 && z > g1)) {
        // skip through the gap (side alley)
        const g = opts.gaps.find(([g0, g1]) => z - w < g0 && z > g1);
        if (z > g[0]) { w = z - g[0]; } else { z = g[1]; continue; }
      }
      const d = opts.depth || 10;
      const cx = xEdge + side * d / 2;
      const floors = opts.floors ? opts.floors(z) : 2 + Math.floor(R() * 4);
      this.building(cx, z - w / 2, d, w, floors, { shop: [side < 0 ? 'right' : 'left'], acFace: side < 0 ? 'right' : 'left', ...opts.b });
      z -= w;
    }
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
    this.groundBox(-30, 40, 30, -5, 'street');
    this.groundBox(-12, -5, 12, -186, 'street');
    this.groundBox(-18, -186, 18, -316, 'market', 0, 4);
    this.groundBox(-12, -876, 12, -935, 'street');
    this.groundBox(-60, -1036, 60, -1062, 'market', 0, 4); // corniche
  }

  plaza() {
    const R = this.R;
    // surrounding buildings
    this.building(-21, 20, 10, 28, 3, { shop: ['right'], acFace: 'right' });
    this.building(21, 22, 10, 24, 4, { shop: ['left'], acFace: 'left' });
    this.building(0, 41, 32, 10, 5, { shop: ['back'] });
    this.building(-19, 3, 14, 6, 2, { shop: ['front', 'right'] });
    this.building(19, 3, 14, 6, 3, { shop: ['front', 'left'] });
    // microbuses (one we arrived in, two waiting)
    this.microbus(5.2, 22, 0, [0.95, 0.94, 0.9]);
    this.microbus(9.6, 27, 0.12, [0.9, 0.88, 0.8]);
    this.microbus(-9, 26, -0.08, [0.92, 0.92, 0.88]);
    this.teaCart(-1.2, 14.6);
    this.spawns.start = new THREE.Vector3(3.6, 0, 20.5);
    this.spawns.driver = new THREE.Vector3(3.4, 0, 23.6);
    this.spawns.tea = new THREE.Vector3(-2.3, 0, 14.1);
    // a bench and stools
    this.paintBox(-8.5, 0, 9, -7.1, 0.45, 9.6, C.wood, true, { vault: true });
    this.paintBox(-3.4, 0, 15.2, -2.9, 0.42, 15.7, C.woodDark, true);
    this.paintBox(-0.2, 0, 12.9, 0.3, 0.42, 13.4, C.woodDark, true);
    // wires over the plaza
    this.wire([-16, 7.5, 18], [16, 8, 24]); this.wire([-16, 7, 10], [16, 7.5, 6], 0.8);
    R();
  }

  street() {
    const gaps = [[-97, -103]];
    this.row(-1, -5.2, 0, -188, { gaps, b: {} });
    this.row(1, 5.2, 0, -188, { gaps: [[-97, -103], [-52, -70]], b: {} });
    // kids' square (east side, z -52..-70) with a low wall behind
    this.groundBox(5, -52, 15, -70, 'market', 0.01, 4);
    this.building(18, -61, 6, 18, 2, { shop: ['left'] });
    this.spawns.kids = [new THREE.Vector3(9, 0, -57), new THREE.Vector3(12, 0, -64), new THREE.Vector3(8, 0, -66)];
    // side alley crossing at z -97..-103 (both sides)
    this.groundBox(-30, -97, -5, -103, 'street', 0.005); this.groundBox(5, -97, 30, -103, 'street', 0.005);
    this.building(-24, -100, 10, 12, 3, { collide: true, shop: ['right'] });
    this.building(24, -100, 10, 12, 3, { collide: true, shop: ['left'] });
    // hazards
    this.cartAt(2.4, -24, 0);                     // vault or go round
    this.laundryLine(-48, 1.08);
    this.cartAt(-2.6, -36, 0.1);
    // low sand-and-brick wall with a parked tok-tok in the gap
    this.paintBox(-5, 0, -80.5, 2.1, 0.95, -79.6, C.brick, true, { vault: true, kind: 'wall' });
    this.paintBox(-4.6, 0.95, -80.4, 1.8, 1.05, -79.7, C.concrete, false);
    this.spawns.parkedTok = new THREE.Vector3(3.6, 0, -80);
    this.col(2.2, 0, -81.3, 5, 1.7, -78.7, { kind: 'tok' });
    this.laundryLine(-118, 1.1);
    this.cartAt(2.2, -112, 0); this.cartAt(-2.4, -124, 0);
    // construction barrier you must mantle
    this.paintBox(-5, 0, -138.6, 5, 1.8, -137.6, C.concrete, true, { climb: true, kind: 'barrier' });
    this.paintBox(-5, 1.8, -138.5, 5, 1.95, -137.7, C.sand, false);
    for (const x of [-3.9, -2.1, 2.1, 3.9]) this.paintBox(x - 0.3, 0, -137.5, x + 0.3, 0.5, -137.0, C.sack, true);
    this.laundryLine(-166, 1.06);
    this.cartAt(-2.2, -176, 0);
    // market gate arch
    this.paintBox(-6, 0, -188.6, -4.8, 5.2, -187.4, C.plaster, true);
    this.paintBox(4.8, 0, -188.6, 6, 5.2, -187.4, C.plaster, true);
    this.paintBox(-6, 5.2, -188.6, 6, 6.0, -187.4, C.plasterDark, false);
    this.B.quad('khay', [[-4.8, 3.9, -187.35], [4.8, 3.9, -187.35], [4.8, 5.2, -187.35], [-4.8, 5.2, -187.35]], [[0, 0], [4, 0], [4, 0.55], [0, 0.55]]);
    // wires
    for (let z = -12; z > -186; z -= 22) this.wire([-5.2, 7 + this.R() * 2, z], [5.2, 7 + this.R() * 2, z - 4 - this.R() * 6], 0.7);
    this.spawns.street = new THREE.Vector3(0, 0, -4);
    this.spawns.cpMarket = new THREE.Vector3(0, 0, -182);
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
    this.row(-1, -18, -186, -316, { b: {}, floors: () => 2 + Math.floor(R() * 3) });
    this.row(1, 18, -186, -316, { b: {}, floors: () => 2 + Math.floor(R() * 3) });
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
      [-6.3, -201], [-6.3, -215.6], [0, -215.6], [0, -226.8], [6.3, -226.8], [6.3, -249.2], [0, -249.2], [-6.3, -249.2], [-6.3, -271.6],
      [0, -271.6], [0, -296], [0, -306], [1.6, -314],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z));
    for (let z = -196; z > -312; z -= 18) this.wire([-18, 8, z], [18, 8.5, z - 6], 1.2);
    // strings of khayamiya bunting
    this.spawns.cpChase = new THREE.Vector3(0, 0, -200);
  }
  stall(x, z, R) {
    const w = 2.4, d = 1.3, top = 0.95;
    this.paintBox(x - w / 2, 0, z - d / 2, x + w / 2, top - 0.05, z + d / 2, C.wood, false);
    this.col(x - w / 2, 0, z - d / 2, x + w / 2, top, z + d / 2, { vault: true, kind: 'stall' });
    const o = Math.floor(R() * 3) / 3;
    this.B.quad('produce', [[x - w / 2, top - 0.05, z + d / 2], [x + w / 2, top - 0.05, z + d / 2], [x + w / 2, top + 0.22, z], [x - w / 2, top + 0.22, z]], [[o, 0], [o + 0.33, 0], [o + 0.33, 0.55], [o, 0.55]]);
    this.B.quad('produce', [[x + w / 2, top - 0.05, z - d / 2], [x - w / 2, top - 0.05, z - d / 2], [x - w / 2, top + 0.22, z], [x + w / 2, top + 0.22, z]], [[o, 0.45], [o + 0.33, 0.45], [o + 0.33, 1], [o, 1]]);
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.paintBox(x + px * (w / 2 - 0.05) - 0.04, 0, z + pz * (d / 2 - 0.05) - 0.04, x + px * (w / 2 - 0.05) + 0.04, 2.35, z + pz * (d / 2 - 0.05) + 0.04, C.woodDark, false);
    // awning, tilted
    const u = Math.floor(R() * 4) * 0.25;
    this.B.quad('khay', [[x - w / 2 - 0.1, 2.2, z + d / 2 + 0.3], [x + w / 2 + 0.1, 2.2, z + d / 2 + 0.3], [x + w / 2 + 0.1, 2.5, z - d / 2 - 0.3], [x - w / 2 - 0.1, 2.5, z - d / 2 - 0.3]], [[u, 0], [u + 0.6, 0], [u + 0.6, 0.45], [u, 0.45]]);
    this.stalls.push([x, z]);
  }
  crateStack(x, z, R) {
    this.paintBox(x - 0.6, 0, z - 0.45, x + 0.6, 0.55, z + 0.45, C.wood, false);
    this.paintBox(x - 0.45, 0.55, z - 0.35, x + 0.35, 1.05, z + 0.35, C.woodDark, false);
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
        this.building(tmp.x, tmp.z, w, d, floors, { yaw: Math.atan2(nx, nz), shop: ['front'], collide: false, parapet: R() < 0.7 });
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
    this.paintBox(-4.4, 0, -918, -2.6, 1.2, -914.8, C.wood, true, { noVault: true, climb: true, kind: 'crates' });
    this.paintBox(-4.45, 0, -914.8, -3.4, 0.6, -913.9, C.woodDark, true, { noVault: true, kind: 'crates' });
    this.paintBox(-4.5, 2.82, -918, -1.2, 3.0, -916.9, C.concrete, true, { climb: true, kind: 'balcony' });
    this.paintBox(-4.5, 3.0, -917.0, -1.2, 3.25, -916.9, C.iron, false);
    // doorways the buddies come out of
    this.spawns.buddyA = new THREE.Vector3(-3.6, 0, -906);
    this.spawns.buddyB = new THREE.Vector3(3.6, 0, -912);
    this.spawns.fight = new THREE.Vector3(0, 0, -889);
    this.spawns.crateDrop = new THREE.Vector3(3.2, 0, -888.6);
    // trash bins / boxes for flavour (vaultable)
    this.paintBox(3.4, 0, -897, 4.4, 0.9, -895.6, C.green, true, { vault: true });
    this.wire([-4.5, 6.5, -893], [4.5, 6.2, -899], 0.5);
  }

  rooftops() {
    const H = ROOF;
    const roof = (x0, z0, x1, z1, h, opts = {}) => this.building((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z0 - z1, 0, { h, shop: [], noShop: true, parapetSides: opts.parapet || ['left', 'right'], collideParapet: true, roofProps: false, facade: opts.facade, ...opts.b });
    roof(-10, -918, 10, -940, H.r1, { facade: 'f_plaster' });   // R1 (alley end building)
    roof(-10, -942.6, 10, -962, H.r2, { facade: 'f_brick' });   // R2 after a 2.6 m gap
    roof(-10, -962, 10, -985, H.r3, { facade: 'f_pastel' });    // R3, lower
    roof(-10, -988.2, 10, -1000, H.r4, { facade: 'f_pink' });   // R4 after a 3.2 m gap
    roof(-10, -1000, 10, -1040, H.r5, { facade: 'f_plaster', parapet: ['left', 'right'] }); // R5, tall
    // the chimney: tower A (tall, west) and block B (east) on R4 against R5's face
    this.building(-3.6, -996.5, 4.6, 7, 0, { h: H.a, noShop: true, facade: 'f_brick', roofProps: false, parapet: false });
    this.building(3.6, -996.5, 4.6, 7, 0, { h: H.b, noShop: true, facade: 'f_pastel', roofProps: false, parapet: false });
    for (const b of this.phys.boxes.slice(-2)) b.wall = true;
    // alleys below the gaps get a floor so a fall lands somewhere
    this.groundBox(-12, -940, 12, -942.6, 'street');
    this.groundBox(-12, -985, 12, -988.2, 'street');
    // side buildings beyond the route (visual)
    for (const z of [-930, -960, -990, -1020]) { this.building(-16, z, 12, 26, 2 + Math.floor(this.R() * 3)); this.building(16, z, 12, 26, 1 + Math.floor(this.R() * 3)); }
    // R1 props: water tank, dishes, pigeon coop (all collide, vaultable)
    this.roofTank(5.5, H.r1, -929); this.roofDish(-6, H.r1, -925); this.roofDish(-7.2, H.r1, -935);
    this.coop(-4.5, H.r1, -931);
    this.spawns.pigeonsR1 = [[-4.5, H.r1 + 1.9, -931], [5.5, H.r1 + 2.1, -929], [2, H.r1 + 0.05, -926]];
    this.spawns.whitePigeon = new THREE.Vector3(5.5, H.r1 + 2.1, -929);
    // R2: low laundry line on the roof, AC box to vault
    this.roofLaundry(-950, H.r2);
    this.paintBox(-2.5, H.r2, -957.5, 2.5, H.r2 + 0.95, -956.6, C.ac, true, { vault: true });
    this.roofDish(7, H.r2, -945); this.roofTank(-7, H.r2, -959);
    // R3: parapet wall across to vault
    this.paintBox(-10, H.r3, -972.4, 10, H.r3 + 1.0, -971.6, C.plaster, true, { vault: true });
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
    this.paintBox(x - 1.1, y + 1.0, z - 0.8, x + 1.1, y + 1.85, z + 0.8, C.wood, false);
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
    this.spawns.cpJetty = new THREE.Vector3(0, 0, -1052);
    this.spawns.jettyEnd = J1;
    this.spawns.ferry = new THREE.Vector3(0, 0, J1 - 5.2);
    // the Nile
    this.nile = makeNile();
    this.root.add(this.nile);
  }

  distant() {
    // minarets poking over the roofs, scattered off the route
    const g = makeMinaretGeo();
    const mat = this.mats.paint;
    for (const [x, z, s] of [[-60, -40, 1.1], [70, -150, 1.0], [-75, -260, 1.2], [90, -420, 1.1], [-80, -560, 1.0], [70, -700, 1.25], [-90, -860, 1.0], [60, -980, 1.15], [-45, -1130, 0.9], [120, -1250, 1.3], [-140, -1300, 1.2]]) {
      const m = new THREE.Mesh(g, mat); m.position.set(x, 0, z); m.scale.setScalar(s); m.castShadow = false; m.receiveShadow = false;
      this.root.add(m);
    }
    // filler blocks so the far view is not empty
    const R = this.R;
    for (let i = 0; i < 90; i++) {
      const z = 30 - R() * 1060, side = R() < 0.5 ? -1 : 1, x = side * (30 + R() * 70);
      if (z < -312 && z > -890) continue; // the road region has its own
      this.building(x, z, 10 + R() * 8, 10 + R() * 8, 2 + Math.floor(R() * 5), { collide: false, parapet: false, noShop: true });
    }
    // far bank of the Nile: a low strip of palms and blocks
    for (let x = -300; x < 300; x += 14 + R() * 10) this.building(x, -1420 - R() * 30, 12, 10, 1 + Math.floor(R() * 4), { collide: false, parapet: false, noShop: true, roofProps: false });
  }

  microbus(x, z, yaw, body) {
    const parts = [];
    const add = (w, h, d, cx, cy, cz, col) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(cx, cy, cz); paintGeo(g, col); parts.push(g); };
    const trim = [0.82, 0.8, 0.74];
    add(1.9, 0.92, 4.9, 0, 0.82, 0, body);              // lower body
    add(1.84, 0.74, 4.1, 0, 1.65, -0.35, C.glass);      // side windows (one band, split by pillars below)
    for (let i = 0; i < 6; i++) add(1.9, 0.74, 0.12, 0, 1.65, -2.35 + i * 0.8, body); // window pillars
    add(1.9, 0.2, 4.5, 0, 2.12, -0.2, body);            // roof
    add(1.94, 0.18, 4.92, 0, 0.62, 0, C.blue);          // stripe
    add(1.94, 0.07, 4.92, 0, 1.28, 0, trim);            // belt line
    add(1.7, 0.1, 3.0, 0, 2.3, -0.5, C.iron);           // roof rack
    for (const rx of [-0.8, 0.8]) add(0.05, 0.16, 3.0, rx, 2.4, -0.5, C.iron);
    add(1.7, 0.62, 0.12, 0, 1.62, 2.06, C.glass);       // windscreen
    add(1.9, 0.5, 0.5, 0, 1.0, 2.25, body);             // nose
    add(1.6, 0.14, 0.06, 0, 0.64, 2.5, C.iron);         // grille
    for (const hx of [-0.7, 0.7]) add(0.32, 0.18, 0.06, hx, 0.9, 2.5, [1, 0.95, 0.75]); // headlights
    add(1.96, 0.12, 0.2, 0, 0.35, 2.48, C.iron); add(1.96, 0.12, 0.2, 0, 0.35, -2.48, C.iron); // bumpers
    for (const [wx, wz] of [[-0.88, 1.5], [0.88, 1.5], [-0.88, -1.6], [0.88, -1.6]]) {
      const g = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14); g.rotateZ(Math.PI / 2); g.translate(wx, 0.36, wz); paintGeo(g, C.tyre); parts.push(g);
      const hub = new THREE.CylinderGeometry(0.16, 0.16, 0.28, 10); hub.rotateZ(Math.PI / 2); hub.translate(wx, 0.36, wz); paintGeo(hub, [0.7, 0.7, 0.68]); parts.push(hub);
    }
    // a couple of bags on the rack
    add(0.6, 0.3, 0.5, -0.3, 2.5, -0.9, C.sack); add(0.5, 0.28, 0.6, 0.35, 2.49, 0.2, [0.4, 0.3, 0.5]);
    // rounded edges: bevel strips along the roof line and the nose
    for (const sx of [-1, 1]) { const g = new THREE.CylinderGeometry(0.12, 0.12, 4.5, 8); g.rotateX(Math.PI / 2); g.translate(sx * 0.88, 2.1, -0.2); paintGeo(g, body); parts.push(g); }
    { const g = new THREE.CylinderGeometry(0.25, 0.25, 1.9, 10); g.rotateZ(Math.PI / 2); g.translate(0, 1.25, 2.27); paintGeo(g, body); parts.push(g); }
    const m = new THREE.Mesh(mergeGeometries(parts), this.mats.paint);
    m.position.set(x, 0, z); m.rotation.y = yaw; m.castShadow = m.receiveShadow = true;
    // destination board on the rack, real text
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.36, 0.06), [this.mats.paint, this.mats.paint, this.mats.paint, this.mats.paint, signMat(this.signDest = (this.signDest || 0) + 1), this.mats.paint]);
    const sg = sign.geometry; paintGeo(sg, [0.25, 0.2, 0.15]);
    sign.position.set(0, 2.62, 0.9); m.add(sign);
    this.root.add(m);
    const c = Math.abs(Math.cos(yaw));
    this.col(x - 0.95 - (1 - c) * 2, 0, z - 2.45 * c - 0.3, x + 0.95 + (1 - c) * 2, 2.3, z + 2.45 * c + 0.3, { kind: 'bus' });
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
      if (a.face === 'right') { lx = a.w / 2; lz = a.along; r = a.yaw + Math.PI / 2; }
      else if (a.face === 'left') { lx = -a.w / 2; lz = a.along; r = a.yaw - Math.PI / 2; }
      else { lx = a.along; lz = a.d / 2; r = a.yaw; }
      M.compose(P.set(a.cx + lx * c + lz * s, a.y, a.cz - lx * s + lz * c), Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r), S.set(1, 1, 1));
      am.setMatrixAt(i, M);
    });
    am.castShadow = true; am.computeBoundingSphere(); this.root.add(am);
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

function makeMinaretGeo() {
  const parts = [];
  const col = (g, c) => { paintGeo(g, c); parts.push(g); };
  const stone = [0.82, 0.7, 0.55], dark = [0.55, 0.45, 0.36];
  let g = new THREE.BoxGeometry(4, 14, 4); g.translate(0, 7, 0); col(g, stone);
  g = new THREE.CylinderGeometry(1.5, 1.8, 12, 8); g.translate(0, 20, 0); col(g, stone);
  g = new THREE.CylinderGeometry(2.3, 2.0, 0.8, 8); g.translate(0, 26.2, 0); col(g, dark);
  g = new THREE.CylinderGeometry(1.1, 1.3, 7, 8); g.translate(0, 30, 0); col(g, stone);
  g = new THREE.CylinderGeometry(1.8, 1.5, 0.6, 8); g.translate(0, 33.6, 0); col(g, dark);
  g = new THREE.CylinderGeometry(0.8, 0.9, 3, 8); g.translate(0, 35.4, 0); col(g, stone);
  g = new THREE.ConeGeometry(0.95, 3.2, 8); g.translate(0, 38.5, 0); col(g, dark);
  g = new THREE.SphereGeometry(0.3, 6, 4); g.translate(0, 40.3, 0); col(g, [0.9, 0.75, 0.3]);
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
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
