// Static geometry is accumulated per (material, chunk) and merged into one mesh each, so the whole town is a
// few dozen draw calls and far chunks are still frustum-culled.
import * as THREE from '../../vendor/three.module.min.js';

const CHUNK = 60;
const _n = new THREE.Vector3();

export class Builder {
  constructor(mats) { this.mats = mats; this.buckets = new Map(); }
  bucket(mat, x, z) {
    const key = mat + '|' + Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK);
    let b = this.buckets.get(key);
    if (!b) this.buckets.set(key, (b = { mat, pos: [], nrm: [], uv: [], col: [] }));
    return b;
  }
  // p: 4 corners (counter-clockwise seen from the front), uv: 4 [u,v], color [r,g,b] optional
  quad(mat, p, uv, color) {
    const cx = (p[0][0] + p[2][0]) / 2, cz = (p[0][2] + p[2][2]) / 2;
    const b = this.bucket(mat, cx, cz);
    const e1 = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], e2 = [p[3][0] - p[0][0], p[3][1] - p[0][1], p[3][2] - p[0][2]];
    _n.set(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]).normalize();
    for (const i of [0, 1, 2, 0, 2, 3]) {
      b.pos.push(p[i][0], p[i][1], p[i][2]); b.nrm.push(_n.x, _n.y, _n.z); b.uv.push(uv[i][0], uv[i][1]);
      const c = color || [1, 1, 1]; b.col.push(c[0], c[1], c[2]);
    }
  }
  // Oriented box: centre (cx, cz), yaw (rotation about Y; 0 = axis aligned), size w (local x) d (local z),
  // from y0 to y1. sides: {mat, uv: fn(face, a0, a1, y0, y1) -> uvs} per face name or one for all.
  obox(cx, cz, yaw, w, d, y0, y1, faces) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const P = (lx, y, lz) => [cx + lx * c + lz * s, y, cz - lx * s + lz * c];
    const hw = w / 2, hd = d / 2;
    const F = {
      // name: corners bottom-left, bottom-right, top-right, top-left seen from outside; length along face
      front: [P(-hw, y0, hd), P(hw, y0, hd), P(hw, y1, hd), P(-hw, y1, hd), w],
      back: [P(hw, y0, -hd), P(-hw, y0, -hd), P(-hw, y1, -hd), P(hw, y1, -hd), w],
      right: [P(hw, y0, hd), P(hw, y0, -hd), P(hw, y1, -hd), P(hw, y1, hd), d],
      left: [P(-hw, y0, -hd), P(-hw, y0, hd), P(-hw, y1, hd), P(-hw, y1, -hd), d],
      top: [P(-hw, y1, hd), P(hw, y1, hd), P(hw, y1, -hd), P(-hw, y1, -hd), w],
      bottom: [P(-hw, y0, -hd), P(hw, y0, -hd), P(hw, y0, hd), P(-hw, y0, hd), w],
    };
    for (const name of Object.keys(F)) {
      const f = faces[name] !== undefined ? faces[name] : faces.all;
      if (!f) continue;
      const [a, b, cc, dd, len] = F[name];
      let uv;
      if (f.uv) uv = f.uv(name, len, y0, y1, a, b, cc, dd);
      else if (name === 'top' || name === 'bottom') { const k = f.scale || 1; uv = [a, b, cc, dd].map((q) => [q[0] / k, q[2] / k]); }
      else { const k = f.scale || 1, o = f.off || 0; uv = [[o, y0 / k], [o + len / k, y0 / k], [o + len / k, y1 / k], [o, y1 / k]]; }
      this.quad(f.mat, [a, b, cc, dd], uv, f.color);
    }
  }
  box(x0, y0, z0, x1, y1, z1, faces) { this.obox((x0 + x1) / 2, (z0 + z1) / 2, 0, Math.abs(x1 - x0), Math.abs(z1 - z0), Math.min(y0, y1), Math.max(y0, y1), faces); }
  finish(parent) {
    const meshes = [];
    for (const b of this.buckets.values()) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      const m = this.mats[b.mat];
      if (m.vertexColors) g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, m);
      mesh.castShadow = !m.userData.noCast; mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      parent.add(mesh); meshes.push(mesh);
    }
    this.buckets.clear();
    return meshes;
  }
}

// small deterministic RNG so the town is the same every run
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
