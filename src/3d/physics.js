// Axis-aligned box world on a uniform XZ grid, a vertical-cylinder character mover (slide along walls, step up
// curbs, ground snap, ceilings) and a ray cast for the camera. Moving platforms are "dynamic" boxes that are
// tested every step without the grid.
const CELL = 4;

export class PhysWorld {
  constructor() {
    this.boxes = [];
    this.grid = new Map();
    this.dynamic = [];
    this.stamp = 0;
    this._out = [];
  }
  // flags: vault (low obstacle you can hop over), climb (ledge you can mantle), ghost (no collision),
  // noCam (camera ignores it), kind (string, for gameplay)
  add(x0, y0, z0, x1, y1, z1, flags = {}) {
    const b = { x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1), _s: 0, on: true, ...flags };
    this.boxes.push(b);
    if (flags.dynamic) { this.dynamic.push(b); return b; }
    for (let gx = Math.floor(b.x0 / CELL); gx <= Math.floor(b.x1 / CELL); gx++)
      for (let gz = Math.floor(b.z0 / CELL); gz <= Math.floor(b.z1 / CELL); gz++) {
        const k = gx * 73856093 ^ gz * 19349663;
        let c = this.grid.get(k); if (!c) this.grid.set(k, (c = [])); c.push(b);
      }
    return b;
  }
  query(x0, z0, x1, z1) {
    const out = this._out; out.length = 0;
    const s = ++this.stamp;
    for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++)
      for (let gz = Math.floor(z0 / CELL); gz <= Math.floor(z1 / CELL); gz++) {
        const c = this.grid.get(gx * 73856093 ^ gz * 19349663);
        if (!c) continue;
        for (const b of c) if (b._s !== s && b.on) { b._s = s; if (b.x1 >= x0 && b.x0 <= x1 && b.z1 >= z0 && b.z0 <= z1) out.push(b); }
      }
    for (const b of this.dynamic) if (b.on && b.x1 >= x0 && b.x0 <= x1 && b.z1 >= z0 && b.z0 <= z1) out.push(b);
    return out;
  }
  // highest box top under a circle, at most maxY
  groundAt(x, z, r, maxY) {
    let best = -Infinity, bb = null;
    for (const b of this.query(x - r, z - r, x + r, z + r)) {
      if (b.ghost || b.y1 > maxY) continue;
      const cx = Math.max(b.x0, Math.min(x, b.x1)), cz = Math.max(b.z0, Math.min(z, b.z1));
      if ((x - cx) ** 2 + (z - cz) ** 2 > r * r) continue;
      if (b.y1 > best) { best = b.y1; bb = b; }
    }
    return bb ? { y: best, box: bb } : null;
  }
  // first box hit by a segment (slab test); returns distance or Infinity
  raycast(ox, oy, oz, dx, dy, dz, maxD, filter) {
    const ex = ox + dx * maxD, ez = oz + dz * maxD;
    let best = maxD;
    for (const b of this.query(Math.min(ox, ex), Math.min(oz, ez), Math.max(ox, ex), Math.max(oz, ez))) {
      if (b.ghost || (filter && !filter(b))) continue;
      let t0 = 0, t1 = best;
      let ok = true;
      for (const [o, d, lo, hi] of [[ox, dx, b.x0, b.x1], [oy, dy, b.y0, b.y1], [oz, dz, b.z0, b.z1]]) {
        if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { ok = false; break; } continue; }
        let a = (lo - o) / d, c = (hi - o) / d;
        if (a > c) { const t = a; a = c; c = t; }
        if (a > t0) t0 = a; if (c < t1) t1 = c;
        if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 < best) best = t0;
    }
    return best;
  }
}

// Moves a cylinder body {pos:{x,y,z}, vel:{x,y,z}, r, h, onGround} for dt seconds.
// Returns contacts (walls touched) in body.walls. ignore: a Set of boxes to skip (vault target).
export function moveBody(world, body, dt, opts = {}) {
  const STEP = opts.step ?? 0.42;
  const p = body.pos, v = body.vel, r = body.r, h = body.h;
  const prevY = p.y;
  body.walls = body.walls || []; body.walls.length = 0;
  // platform carry
  if (body.platform && body.onGround && body.platform.vx !== undefined) { p.x += body.platform.vx * dt; p.z += body.platform.vz * dt; }
  p.x += v.x * dt; p.z += v.z * dt;
  for (let it = 0; it < 3; it++) {
    let moved = false;
    for (const b of world.query(p.x - r - 0.05, p.z - r - 0.05, p.x + r + 0.05, p.z + r + 0.05)) {
      if (b.ghost || (opts.ignore && opts.ignore.has(b))) continue;
      const stepable = body.onGround || opts.airStep ? b.y1 <= p.y + STEP : b.y1 <= p.y + 0.05;
      if (stepable || b.y0 >= p.y + h) continue;
      const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
      let dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      let nx, nz, push;
      if (d2 > 1e-10) { const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; push = r - d; }
      else {
        const pen = [[p.x - b.x0 + r, -1, 0], [b.x1 - p.x + r, 1, 0], [p.z - b.z0 + r, 0, -1], [b.z1 - p.z + r, 0, 1]];
        pen.sort((a, c) => a[0] - c[0]);
        [push, nx, nz] = pen[0];
      }
      p.x += nx * push; p.z += nz * push;
      const vn = v.x * nx + v.z * nz;
      if (vn < 0) { v.x -= vn * nx; v.z -= vn * nz; }
      body.walls.push({ box: b, nx, nz, vn });
      moved = true;
    }
    if (!moved) break;
  }
  // vertical
  p.y += v.y * dt;
  const wasGround = body.onGround;
  body.onGround = false; body.platform = null;
  if (v.y <= 0.01) {
    const reach = Math.max(prevY, p.y) + (wasGround ? STEP : 0.12);
    const g = world.groundAt(p.x, p.z, r * 0.85, reach);
    const snap = wasGround ? STEP : 0.0;
    if (g && p.y <= g.y + snap + 1e-4) {
      // only snap down when we were grounded (walk down stairs), otherwise land when crossing
      if (p.y < g.y || wasGround) { p.y = g.y; v.y = 0; body.onGround = true; body.platform = g.box; }
    }
  } else {
    for (const b of world.query(p.x - r, p.z - r, p.x + r, p.z + r)) {
      if (b.ghost) continue;
      if (b.y0 >= prevY + h - 0.01 && b.y0 < p.y + h) {
        const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
        if ((p.x - cx) ** 2 + (p.z - cz) ** 2 < r * r * 0.7) { p.y = b.y0 - h; v.y = 0; body.bonk = true; }
      }
    }
  }
  return body;
}

// Free space test for a cylinder at a position (used before mantles and vault landings).
export function fits(world, x, y, z, r, h, ignore) {
  for (const b of world.query(x - r, z - r, x + r, z + r)) {
    if (b.ghost || (ignore && ignore.has(b))) continue;
    if (b.y1 <= y + 0.02 || b.y0 >= y + h) continue;
    const cx = Math.max(b.x0, Math.min(x, b.x1)), cz = Math.max(b.z0, Math.min(z, b.z1));
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return false;
  }
  return true;
}
