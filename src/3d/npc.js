// Townspeople built from the mango-thief rig: clones with a shirt-colour tint (driver, tea seller, kids,
// thieves, captain), each with its own mixer. Plus goat and pigeons.
import * as THREE from '../../vendor/three.module.min.js';
import * as SkeletonUtils from '../../vendor/addons/SkeletonUtils.js';
import { A } from './assets3d.js';
import { Anim } from './anim.js';
import { moveBody } from './physics.js';
import { patchRimFill } from './shade.js';

const tintCache = new Map();
// Clothing tint. Round 2: muted galabeya colours (charcoal, navy, olive, grey-brown, off-white) instead of
// saturated blue and green, and the cloth keeps its folds (luminance kept), so it reads as a robe and not as
// a body painted one colour. Every townsperson also gets the character fill + rim light.
function tintedMaterial(src, color, skinDark) {
  const key = color + '|' + (skinDark || 0);
  if (tintCache.has(key)) return tintCache.get(key);
  const m = src.clone();
  const c = new THREE.Color(color || 0xffffff);
  m.onBeforeCompile = (sh) => {
    patchRimFill(sh, { fill: 0.1, rimK: 0.2 });
    if (!color) return;
    sh.uniforms.uTint = { value: new THREE.Vector3(c.r, c.g, c.b) };
    sh.uniforms.uSkin = { value: skinDark || 0 };
    sh.fragmentShader = 'uniform vec3 uTint; uniform float uSkin;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec3 c = diffuseColor.rgb;
        float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
        float sat = (mx - mn) / (mx + 1e-4);
        float ratio = c.g / (c.r + 1e-4);
        float m = smoothstep(0.66, 0.52, ratio) * smoothstep(0.42, 0.6, sat) * step(c.b, c.g);
        float lum = dot(c, vec3(0.3, 0.55, 0.15));
        diffuseColor.rgb = mix(c, uTint * (lum * 2.0 + 0.04) * (0.75 + 0.5 * smoothstep(0.05, 0.4, lum)), m);
      }`);
  };
  // same shader code for every colour (the colour is a uniform): one program, not one per colour
  m.customProgramCacheKey = () => 'tint' + (color ? 1 : 0);
  tintCache.set(key, m);
  return m;
}

// Townspeople in galabeyas: the hero's own model (he wears one), so in round 2 they read as Radwan's clones
// (Mzee: "the NPC at the start looks like the main character"; they even carried his crate). Round 3, same rig,
// no new models: never the staff or the crate, a body of their own (shorter or taller, thinner or heavier), no
// white turban (a white kufi cap, a dark scarf wrap, or a bare head of grey or black hair), robes away from his
// brown (blues, greys, white, pin stripes) and a beard of their own (grey, or a moustache only).
// The robe is recoloured below the neck by bind-pose height and darkness (so the tan hands do not change).
const galCache = new Map();
// head: 'scarf' (the wrap, dark), 'kufi' (a low white cap), 'hair' (bare head, uHair colour)
// beard: 0 his own, 1 grey, 2 moustache only (the chin shaved)
function galabeyaMaterial(src, o, H) {
  const key = [o.robe, o.wrap || 0, o.head || 'scarf', o.hair || 0, o.beard || 0, o.stripe || 0].join('|');
  if (galCache.has(key)) return galCache.get(key);
  const m = src.clone();
  const r = new THREE.Color(o.robe), w = new THREE.Color(o.wrap || 0x2c2723), hair = new THREE.Color(o.hair || 0x1c1814), st = new THREE.Color(o.stripe || 0xffffff);
  const mode = { scarf: 0, kufi: 1, hair: 2 }[o.head || 'scarf'];
  m.onBeforeCompile = (sh) => {
    patchRimFill(sh, { fill: 0.1, rimK: 0.2 });
    sh.uniforms.uRobe = { value: new THREE.Vector3(r.r, r.g, r.b) };
    sh.uniforms.uWrap = { value: new THREE.Vector3(w.r, w.g, w.b) };
    sh.uniforms.uHair = { value: new THREE.Vector3(hair.r, hair.g, hair.b) };
    sh.uniforms.uStripe = { value: new THREE.Vector4(st.r, st.g, st.b, o.stripe ? 1 : 0) };
    sh.uniforms.uHead = { value: new THREE.Vector4(mode, o.beard || 0, H.capY, H.mouthY) };
    sh.uniforms.uNeck = { value: H.neckY };
    sh.vertexShader = 'attribute float aTurb;\nvarying float vObjY; varying float vObjX; varying float vTurb;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vObjY = position.y; vObjX = position.x; vTurb = aTurb;');
    sh.fragmentShader = 'uniform vec3 uRobe; uniform vec3 uWrap; uniform vec3 uHair; uniform vec4 uStripe; uniform vec4 uHead; uniform float uNeck; varying float vObjY; varying float vObjX; varying float vTurb;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec3 c = diffuseColor.rgb;
        float lum = dot(c, vec3(0.3, 0.55, 0.15));
        float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), sat = (mx - mn) / (mx + 1e-4);
        float body = step(vObjY, uNeck);
        float robe = body * smoothstep(0.15, 0.07, lum);
        // pin stripes down the robe (anti-aliased, fading out when they get thinner than a pixel)
        vec3 rc = uRobe;
        if (uStripe.w > 0.5) {
          float f = vObjX * 34.0, fw = fwidth(f), e = fract(f);
          float sm = smoothstep(0.78 - fw, 0.78 + fw, e) * (1.0 - smoothstep(0.93 - fw, 0.93 + fw, e));
          rc = mix(rc, uStripe.rgb, mix(sm, 0.15, smoothstep(0.25, 0.6, fw)));
        }
        diffuseColor.rgb = mix(c, rc * (0.32 + lum * 9.0), robe);
        // Radwan's grey shawl over the shoulder (light, unsaturated, below the neck) melts into the robe, so his
        // silhouette stays his own (the colour test runs on linear values: skin is far more saturated)
        float shawl = body * smoothstep(0.07, 0.11, lum) * smoothstep(0.3, 0.16, sat);
        diffuseColor.rgb = mix(diffuseColor.rgb, rc * (0.62 + lum * 1.6), shawl);
        // head: the turban cloth (vTurb, from the vertices) becomes a dark wrap, a white cap over hair, or hair
        float head = (1.0 - body) * clamp(vTurb, 0.0, 1.0);
        float folds = clamp(lum * 1.6, 0.35, 1.2);
        vec3 hc = uHead.x < 0.5 ? uWrap * folds * 1.1
          : uHead.x < 1.5 ? mix(uHair * (0.6 + 0.5 * lum), vec3(0.93, 0.92, 0.88) * folds, step(uHead.z, vObjY))
          : uHair * (0.55 + 0.6 * lum);
        diffuseColor.rgb = mix(diffuseColor.rgb, hc, head);
        // beard: dark, unsaturated texels of the face
        float face = (1.0 - body) * (1.0 - clamp(vTurb * 2.0, 0.0, 1.0));
        // beard and eyebrows: the darkest texels of the face (linear lum under ~0.05; skin is above ~0.1)
        float beard = face * smoothstep(0.075, 0.035, lum);
        if (uHead.y > 0.5 && uHead.y < 1.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.41, 0.39) * (0.7 + lum * 6.0), beard * 0.9);
        if (uHead.y > 1.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.17, 0.09) * (0.8 + lum * 3.0), beard * step(vObjY, uHead.w));
      }`);
  };
  m.customProgramCacheKey = () => 'gal3';
  galCache.set(key, m);
  return m;
}

// Head analysis of the hero mesh, once: which vertices are the turban (aTurb, 0..1), and a second geometry
// for the cap and bare-head variants with the turban pulled down and in to the skull (the vertices are moved
// in the bind pose, so the skinning still holds; nothing at the turban's lower edge moves, so no seams open).
let headCache = null;
function headInfo(mesh) {
  if (headCache) return headCache;
  const geo = mesh.geometry, pos = geo.attributes.position, uv = geo.attributes.uv, n = pos.count;
  geo.computeBoundingBox();
  const bb = geo.boundingBox, top = bb.max.y, neckY = bb.min.y + (top - bb.min.y) * 0.835, hh = top - neckY;
  // the texture, small, to tell the cream turban cloth from skin where the two meet
  let px = null; const W = 256;
  try { const c = document.createElement('canvas'); c.width = c.height = W; const x = c.getContext('2d'); x.drawImage(mesh.material.map.image, 0, 0, W, W); px = x.getImageData(0, 0, W, W).data; } catch (e) {}
  const yl = neckY + hh * 0.5, yt = neckY + hh * 0.66;   // below yl never turban; above yt always
  const turb = new Float32Array(n);
  let cx = 0, cz = 0, k = 0;
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i); if (y < yl) continue;
    let t = y > yt ? 1 : 0;
    if (!t && px) {
      let u = uv.getX(i), v = uv.getY(i); u -= Math.floor(u); v -= Math.floor(v);
      const q = (Math.min(W - 1, Math.floor(v * W)) * W + Math.min(W - 1, Math.floor(u * W))) * 4;
      const r = px[q] / 255, g = px[q + 1] / 255, b = px[q + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if ((0.3 * r + 0.55 * g + 0.15 * b) > 0.36 && (mx - mn) / (mx + 1e-4) < 0.36) t = 1;
    }
    turb[i] = t;
    if (y > yt) { cx += pos.getX(i); cz += pos.getZ(i); k++; }
  }
  geo.setAttribute('aTurb', new THREE.BufferAttribute(turb, 1));
  cx /= k || 1; cz /= k || 1;
  // the low variant: everything above the brow line squashed to 40% height and pulled 22% toward the centre
  const flat = geo.clone(), fp = flat.attributes.position;
  for (let i = 0; i < n; i++) {
    const y = fp.getY(i); if (y <= yl) continue;
    const w = Math.min(1, (y - yl) / (top - yl));
    fp.setY(i, yl + (y - yl) * (1 - 0.6 * w));
    const s = 1 - 0.22 * w; fp.setX(i, cx + (fp.getX(i) - cx) * s); fp.setZ(i, cz + (fp.getZ(i) - cz) * s);
  }
  fp.needsUpdate = true; flat.computeBoundingBox(); flat.computeBoundingSphere();
  // the cap line (after squashing): the top ~40% of the head is the white kufi
  // the kufi: the top 45% of the squashed head; under it, hair
  headCache = { neckY, flat, capY: yl + (top - yl) * 0.4 * 0.55, mouthY: neckY + hh * 0.22 };
  return headCache;
}

export class Npc {
  constructor(scene, phys, o = {}) {
    this.phys = phys;
    const gal = !!o.robe;
    this.model = SkeletonUtils.clone((gal ? A.glb.hero : A.glb.mango_thief).scene);
    let H = null;
    this.model.traverse((x) => {
      if (!x.isMesh) return;
      // only the body: never the staff or the mango crate (Hero parents the crate to his shoulder bone, and the
      // clone copied it: round 2's townspeople walked around with Radwan's crate)
      if (gal && (!x.isSkinnedMesh || x.name === 'Staff')) { x.visible = false; return; }
      x.castShadow = true; x.receiveShadow = true; x.frustumCulled = false;
      if (gal) {
        H = headInfo(x);
        if (o.head === 'kufi' || o.head === 'hair') x.geometry = H.flat;
        x.material = galabeyaMaterial(x.material, o, H);
      } else x.material = tintedMaterial(x.material, o.tint || 0, o.skin);
    });
    this.root = new THREE.Group(); this.root.add(this.model); scene.add(this.root);
    // build: o.scale overall, o.build [width, height] on top (heavier = wider, taller = longer)
    const sc = o.scale || 1, bw = o.build ? o.build[0] : 1, bh = o.build ? o.build[1] : 1;
    this.model.scale.set(sc * bw, sc * bh, sc * bw);
    this.anim = new Anim(this.model, gal ? A.clips.hero : A.clips.mango_thief);
    this.anim.play('idle', { loop: true });
    this.anim.actions.idle.time = Math.random() * 2;
    this.body = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), r: 0.3 * sc * bw, h: 1.7 * sc * bh, onGround: true, walls: [] };
    this.yaw = 0; this.active = true; this.name = o.name || 'npc';
    this.head = null; this.model.traverse((x) => { if (x.isBone && x.name === 'Head') this.head = x; });
  }
  place(x, y, z, yaw) { this.body.pos.set(x, y, z); this.body.vel.set(0, 0, 0); if (yaw !== undefined) this.yaw = yaw; this.sync(); }
  show(on) { this.root.visible = on; this.active = on; }
  // walk/run toward a point on the ground; returns remaining distance
  steer(dt, tx, tz, speed, turn = 10) {
    const p = this.body.pos, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d > 0.05) {
      const want = Math.atan2(dx, dz);
      let a = want - this.yaw; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI;
      this.yaw += a * Math.min(1, turn * dt);
      const s = Math.min(speed, d / dt);
      this.body.vel.x = dx / d * s; this.body.vel.z = dz / d * s;
    } else { this.body.vel.x = 0; this.body.vel.z = 0; }
    return d;
  }
  move(dt, collide = true) {
    const b = this.body;
    if (collide) { b.vel.y -= 25 * dt; moveBody(this.phys, b, dt); }
    else { b.pos.x += b.vel.x * dt; b.pos.z += b.vel.z * dt; }
  }
  locoAnim(sp) {
    if (sp < 0.3) this.anim.play('idle', { loop: true, fade: 0.2 });
    else if (sp < 3) this.anim.play('walk', { loop: true, speed: Math.max(0.7, sp / 1.5), fade: 0.2 });
    else this.anim.play('run', { loop: true, speed: Math.min(1.5, Math.max(0.8, sp / 5.5)), fade: 0.15 });
  }
  update(dt) { if (!this.active) return; this.anim.update(dt); this.sync(); }
  sync() { this.root.position.copy(this.body.pos); this.root.rotation.y = this.yaw; }
  get pos() { return this.body.pos; }
}

// ------------------------------------------------------------------ goat (static GLB, procedural trot)
export class Goat {
  constructor(scene) {
    this.m = A.glb.goat.scene.clone();
    this.m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const bb = new THREE.Box3().setFromObject(this.m); this.m.position.y = -bb.min.y;
    this.root = new THREE.Group(); this.root.add(this.m); scene.add(this.root);
    this.pos = new THREE.Vector3(); this.yaw = 0; this.t = 0; this.speed = 0;
  }
  update(dt) {
    this.t += dt * (1 + this.speed * 2);
    this.root.position.set(this.pos.x, this.pos.y + Math.abs(Math.sin(this.t * 6)) * 0.04 * Math.min(1, this.speed), this.pos.z);
    this.root.rotation.set(0, this.yaw - Math.PI / 2, Math.sin(this.t * 6) * 0.04 * Math.min(1, this.speed));
  }
}

// ------------------------------------------------------------------ pigeons
const pigeonGeo = (() => {
  const body = new THREE.SphereGeometry(0.11, 8, 6); body.scale(1, 0.9, 1.6);
  const head = new THREE.SphereGeometry(0.065, 8, 6); head.translate(0, 0.1, 0.16);
  const beak = new THREE.ConeGeometry(0.02, 0.05, 5); beak.rotateX(Math.PI / 2); beak.translate(0, 0.09, 0.24);
  const tail = new THREE.BoxGeometry(0.1, 0.02, 0.14); tail.translate(0, 0.0, -0.22);
  return [body, head, beak, tail];
})();
const wingGeo = (() => { const g = new THREE.BoxGeometry(0.28, 0.015, 0.14); g.translate(0.14, 0, 0); return g; })();

export class Pigeons {
  constructor(scene) { this.list = []; this.scene = scene; this.g = new THREE.Group(); scene.add(this.g); }
  add(x, y, z, white) {
    const col = white ? 0xf4f2ec : [0x8a8f99, 0x6f7480, 0x9a9488][this.list.length % 3];
    const mat = new THREE.MeshLambertMaterial({ color: col });
    const root = new THREE.Group();
    for (const g of pigeonGeo) root.add(new THREE.Mesh(g, g === pigeonGeo[2] ? new THREE.MeshLambertMaterial({ color: 0xd08a3a }) : mat));
    const wl = new THREE.Mesh(wingGeo, mat), wr = new THREE.Mesh(wingGeo, mat); wr.scale.x = -1;
    wl.position.set(0.06, 0.04, 0); wr.position.set(-0.06, 0.04, 0);
    root.add(wl, wr);
    root.position.set(x, y, z); root.rotation.y = Math.random() * 6.28;
    if (white) root.scale.setScalar(1.25);
    this.g.add(root);
    const p = { root, wl, wr, home: new THREE.Vector3(x, y, z), state: 'sit', t: Math.random() * 3, v: new THREE.Vector3(), white };
    this.list.push(p);
    return p;
  }
  clear() { for (const p of this.list) this.g.remove(p.root); this.list = []; }
  update(dt, hero, onFlush) {
    for (const p of this.list) {
      p.t += dt;
      const d = hero ? p.root.position.distanceTo(hero) : 99;
      if (p.state === 'sit') {
        p.root.position.y = p.home.y + Math.abs(Math.sin(p.t * 3)) * 0.01;
        if (Math.sin(p.t * 1.7) > 0.98) p.root.rotation.y += 0.05;
        p.wl.rotation.z = 0.15; p.wr.rotation.z = -0.15;
        if (d < (p.white ? 3.2 : 4.5)) {
          p.state = 'fly'; p.t = 0;
          const away = p.root.position.clone().sub(hero); away.y = 0; away.normalize();
          p.v.set(away.x * 4 + (Math.random() - 0.5) * 3, 4 + Math.random() * 2, away.z * 4 + (Math.random() - 0.5) * 3);
          if (p.white) p.v.set(-6, 3.2, -5); // the white one heads for the river
          p.root.rotation.y = Math.atan2(p.v.x, p.v.z);
          onFlush && onFlush(p);
        }
      } else if (p.state === 'fly') {
        p.root.position.addScaledVector(p.v, dt);
        p.v.y += (p.t < 1 ? 1 : -0.5) * dt;
        const f = Math.sin(p.t * 28);
        p.wl.rotation.z = f * 1.1; p.wr.rotation.z = -f * 1.1;
        if (p.t > 7) { p.state = 'gone'; p.root.visible = false; }
      }
    }
  }
}
