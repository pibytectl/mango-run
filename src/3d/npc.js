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
    patchRimFill(sh, { fill: 0.2, rimK: 0.45 });
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

// Townspeople in galabeyas (round 2): the hero's own model (he wears one) without the staff. The dark robe is
// recoloured below the neck, chosen by bind-pose height (so the face and beard never change) and by darkness
// (so the tan hands do not); the light head wrap can take a second colour. Folds are kept.
const galCache = new Map();
function galabeyaMaterial(src, robe, wrap, neckY) {
  const key = robe + '|' + (wrap || 0);
  if (galCache.has(key)) return galCache.get(key);
  const m = src.clone();
  const r = new THREE.Color(robe), w = new THREE.Color(wrap || 0xffffff);
  m.onBeforeCompile = (sh) => {
    patchRimFill(sh, { fill: 0.2, rimK: 0.45 });
    sh.uniforms.uRobe = { value: new THREE.Vector3(r.r, r.g, r.b) };
    sh.uniforms.uWrap = { value: new THREE.Vector4(w.r, w.g, w.b, wrap ? 1 : 0) };
    sh.uniforms.uNeck = { value: neckY };
    sh.vertexShader = 'varying float vObjY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vObjY = position.y;');
    sh.fragmentShader = 'uniform vec3 uRobe; uniform vec4 uWrap; uniform float uNeck; varying float vObjY;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec3 c = diffuseColor.rgb;
        float lum = dot(c, vec3(0.3, 0.55, 0.15));
        float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), sat = (mx - mn) / (mx + 1e-4);
        float body = step(vObjY, uNeck);
        float robe = body * smoothstep(0.15, 0.07, lum);
        diffuseColor.rgb = mix(c, uRobe * (0.32 + lum * 9.0), robe);
        float wrapM = (1.0 - body) * uWrap.w * smoothstep(0.22, 0.4, lum) * smoothstep(0.3, 0.12, sat);
        diffuseColor.rgb = mix(diffuseColor.rgb, uWrap.rgb * (0.4 + lum * 0.9), wrapM);
      }`);
  };
  m.customProgramCacheKey = () => 'gal';
  galCache.set(key, m);
  return m;
}

export class Npc {
  constructor(scene, phys, o = {}) {
    this.phys = phys;
    const gal = !!o.robe;
    this.model = SkeletonUtils.clone((gal ? A.glb.hero : A.glb.mango_thief).scene);
    let neckY = 0;
    if (gal) {
      const staff = this.model.getObjectByName('Staff'); if (staff) staff.visible = false;
      this.model.traverse((x) => { if (x.isSkinnedMesh && x.name !== 'Staff') { x.geometry.computeBoundingBox(); const b = x.geometry.boundingBox; neckY = b.min.y + (b.max.y - b.min.y) * 0.835; } });
    }
    this.model.traverse((x) => {
      if (x.isMesh) {
        x.castShadow = true; x.receiveShadow = true; x.frustumCulled = false;
        x.material = gal ? galabeyaMaterial(x.material, o.robe, o.wrap, neckY) : tintedMaterial(x.material, o.tint || 0, o.skin);
      }
    });
    this.root = new THREE.Group(); this.root.add(this.model); scene.add(this.root);
    if (o.scale) this.model.scale.setScalar(o.scale);
    this.anim = new Anim(this.model, gal ? A.clips.hero : A.clips.mango_thief);
    this.anim.play('idle', { loop: true });
    this.anim.actions.idle.time = Math.random() * 2;
    this.body = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), r: 0.3 * (o.scale || 1), h: 1.7 * (o.scale || 1), onGround: true, walls: [] };
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
