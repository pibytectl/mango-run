// Static geometry is accumulated per (material, chunk) and merged into one mesh each, so the whole town is a
// few dozen draw calls and far chunks are still frustum-culled. Atlas tiles: a name in `virt` maps to a tile
// of an atlas material ({mat, tile: [u0, v0, su, sv]}); its quads go into the atlas material's bucket with a
// per-vertex `atl` attribute, and the atlas shader tiles inside that rectangle (see atlasMaterial).
import * as THREE from '../../vendor/three.module.min.js';

const CHUNK = 60;
const _n = new THREE.Vector3();

export class Builder {
  constructor(mats, virt = {}) { this.mats = mats; this.virt = virt; this.buckets = new Map(); }
  bucket(mat, x, z) {
    const v = this.virt[mat], real = v ? v.mat : mat;
    const key = real + '|' + Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK);
    let b = this.buckets.get(key);
    if (!b) this.buckets.set(key, (b = { mat: real, pos: [], nrm: [], uv: [], col: [], atl: [] }));
    b.tile = v ? v.tile : null;
    return b;
  }
  // p: 4 corners (counter-clockwise seen from the front), uv: 4 [u,v], color [r,g,b] optional
  quad(mat, p, uv, color) {
    const cx = (p[0][0] + p[2][0]) / 2, cz = (p[0][2] + p[2][2]) / 2;
    const b = this.bucket(mat, cx, cz);
    const e1 = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], e2 = [p[3][0] - p[0][0], p[3][1] - p[0][1], p[3][2] - p[0][2]];
    _n.set(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]).normalize();
    const t = b.tile;
    for (const i of [0, 1, 2, 0, 2, 3]) {
      b.pos.push(p[i][0], p[i][1], p[i][2]); b.nrm.push(_n.x, _n.y, _n.z); b.uv.push(uv[i][0], uv[i][1]);
      const c = color || [1, 1, 1]; b.col.push(c[0], c[1], c[2]);
      if (t) b.atl.push(t[0], t[1], t[2], t[3]);
    }
  }
  // a single triangle (umbrella canopies)
  tri(mat, p, color) {
    const b = this.bucket(mat, p[0][0], p[0][2]);
    const e1 = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], e2 = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
    _n.set(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]).normalize();
    const c = color || [1, 1, 1];
    for (let i = 0; i < 3; i++) { b.pos.push(p[i][0], p[i][1], p[i][2]); b.nrm.push(_n.x, _n.y, _n.z); b.uv.push(0, 0); b.col.push(c[0], c[1], c[2]); }
  }
  // a square-section beam from point a to point b (poles, braces, rails, rebar), 4 sides, no caps
  beam(mat, a, b, t, color) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(d[0], d[1], d[2]) || 1; d[0] /= l; d[1] /= l; d[2] /= l;
    const up = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let u = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]];
    const ul = Math.hypot(u[0], u[1], u[2]); u = u.map((x) => x / ul * t / 2);
    let v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
    const vl = Math.hypot(v[0], v[1], v[2]); v = v.map((x) => x / vl * t / 2);
    const P = (o, su, sv) => [o[0] + u[0] * su + v[0] * sv, o[1] + u[1] * su + v[1] * sv, o[2] + u[2] * su + v[2] * sv];
    const uv = [[0, 0], [1, 0], [1, l], [0, l]];
    this.quad(mat, [P(a, 1, -1), P(a, 1, 1), P(b, 1, 1), P(b, 1, -1)], uv, color);
    this.quad(mat, [P(a, -1, 1), P(a, -1, -1), P(b, -1, -1), P(b, -1, 1)], uv, color);
    this.quad(mat, [P(a, 1, 1), P(a, -1, 1), P(b, -1, 1), P(b, 1, 1)], uv, color);
    this.quad(mat, [P(a, -1, -1), P(a, 1, -1), P(b, 1, -1), P(b, -1, -1)], uv, color);
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
      if (m.userData.atlas) g.setAttribute('atl', new THREE.Float32BufferAttribute(b.atl, 4));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, m);
      mesh.castShadow = !m.userData.noCast; mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      mesh.userData.chunk = true;
      parent.add(mesh); meshes.push(mesh);
    }
    this.buckets.clear();
    return meshes;
  }
}

// A Lambert material whose map is an atlas: each vertex carries its tile (u0, v0, su, sv); the UV is wrapped
// inside the tile (fract), or clamped when su < 0 (signs), with explicit gradients so mip selection does not
// jump at the wrap seam. A small inset keeps neighbouring tiles from bleeding in at low mips.
export function atlasMaterial(map) {
  const m = new THREE.MeshLambertMaterial({ map });
  m.userData.atlas = true;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute vec4 atl;\nvarying vec4 vAtl;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n  vAtl = atl;');
    sh.fragmentShader = 'varying vec4 vAtl;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
      {
        vec2 sz = abs(vAtl.zw);
        vec2 tuv = vAtl.z < 0.0 ? clamp(vMapUv, 0.0, 1.0) : fract(vMapUv);
        tuv = tuv * 0.992 + 0.004;
        vec4 sampledDiffuseColor = textureGrad(map, vAtl.xy + tuv * sz, dFdx(vMapUv) * sz, dFdy(vMapUv) * sz);
        diffuseColor *= sampledDiffuseColor;
      }`);
  };
  m.customProgramCacheKey = () => 'atlas';
  return m;
}

// small deterministic RNG so the town is the same every run
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
