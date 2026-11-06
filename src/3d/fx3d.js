// Sky dome (panorama + sun disc + far skyline ring), sunset lighting that lowers with the timer, a pooled
// particle system (dust, hit sparks, juice, splashes) and mango pickups.
import * as THREE from '../../vendor/three.module.min.js';
import { A } from './assets3d.js';

export class Sky {
  constructor(scene, renderer, quality) {
    this.scene = scene;
    this.group = new THREE.Group(); scene.add(this.group);
    // panorama dome
    const sky = A.tex.sky; sky.wrapS = THREE.MirroredRepeatWrapping;
    const domeGeo = new THREE.SphereGeometry(900, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.62);
    // remap uv: u wraps twice (mirrored), v from horizon (0) to zenith (1)
    const uv = domeGeo.attributes.uv, pos = domeGeo.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      const y = pos.getY(i) / 900;
      uv.setXY(i, uv.getX(i) * 2, Math.max(0.0, Math.min(1, 0.04 + y * 1.25)));
    }
    this.domeMat = new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, fog: false, depthWrite: false });
    this.dome = new THREE.Mesh(domeGeo, this.domeMat);
    this.dome.renderOrder = -10;
    this.dome.rotation.y = Math.PI * 0.5;
    this.group.add(this.dome);
    // a band of haze at the horizon to blend into the fog colour
    const bandGeo = new THREE.CylinderGeometry(880, 880, 160, 32, 1, true); bandGeo.translate(0, 20, 0);
    this.bandMat = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: new THREE.Color() } }, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
      vertexShader: 'varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'uniform vec3 uCol; varying float vY; void main(){ float a = smoothstep(100., -40., vY); gl_FragColor = vec4(uCol, a*0.95);\n#include <colorspace_fragment>\n}',
    });
    this.band = new THREE.Mesh(bandGeo, this.bandMat); this.band.renderOrder = -8; this.group.add(this.band);
    // skyline ring (alpha-tested silhouettes)
    const sl = A.tex.skyline; sl.wrapS = THREE.RepeatWrapping;
    const ringGeo = new THREE.CylinderGeometry(760, 760, 140, 48, 1, true); ringGeo.translate(0, 38, 0);
    const ruv = ringGeo.attributes.uv; for (let i = 0; i < ruv.count; i++) ruv.setX(i, ruv.getX(i) * 5);
    this.ringMat = new THREE.MeshBasicMaterial({ map: sl, side: THREE.BackSide, alphaTest: 0.5, fog: false, color: 0xd9b59a, depthWrite: true });
    this.ring = new THREE.Mesh(ringGeo, this.ringMat); this.ring.renderOrder = -7;
    this.group.add(this.ring);
    // sun disc + glow
    const glowTex = radialTex();
    this.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb070, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
    this.sunGlow.scale.setScalar(380); this.sunGlow.renderOrder = -6;
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff1c8, fog: false, depthWrite: false, transparent: true }));
    this.sunDisc.scale.setScalar(60); this.sunDisc.renderOrder = -5;
    this.group.add(this.sunGlow, this.sunDisc);

    // lights
    this.hemi = new THREE.HemisphereLight(0xffd2a8, 0x5a4636, 1.25);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffb27a, 3.1);
    this.sun.castShadow = true;
    const sz = quality.shadow;
    this.sun.shadow.mapSize.set(sz, sz);
    const S = quality.shadowRange;
    Object.assign(this.sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 260 });
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);
    this.fill = new THREE.DirectionalLight(0x8fa7d8, 0.55); // cool bounce from the east
    this.fill.position.set(-0.3, 0.6, 1); scene.add(this.fill);
    this.fog = new THREE.FogExp2(0xe39a68, 0.0062);
    scene.fog = this.fog;
    this.dir = new THREE.Vector3();
    this.setSun(1);
  }
  // k: 1 = start of the mission (sun ~15 deg up), 0 = sunset
  setSun(k) {
    const elev = THREE.MathUtils.degToRad(1.5 + 14 * k);
    const az = THREE.MathUtils.degToRad(17); // a little right of straight down the road (-Z)
    this.dir.set(Math.sin(az) * Math.cos(elev), Math.sin(elev), -Math.cos(az) * Math.cos(elev));
    const warm = 1 - k;
    this.sun.color.setRGB(1, 0.72 - 0.16 * warm, 0.48 - 0.22 * warm);
    this.sun.intensity = 2.7 + 0.6 * k;
    this.hemi.intensity = 1.05 + 0.3 * k;
    this.hemi.color.setRGB(1, 0.8 - 0.1 * warm, 0.66 - 0.16 * warm);
    this.fog.color.setRGB(0.9, 0.6 - 0.08 * warm, 0.42 - 0.1 * warm);
    this.bandMat.uniforms.uCol.value.copy(this.fog.color);
    this.sunDisc.material.color.setRGB(1, 0.93 - 0.2 * warm, 0.75 - 0.35 * warm);
    this.domeMat.color.setRGB(1, 1 - 0.1 * warm, 1 - 0.2 * warm);
  }
  update(camPos, focus) {
    this.group.position.set(camPos.x, 0, camPos.z);
    this.sunGlow.position.copy(this.dir).multiplyScalar(700);
    this.sunDisc.position.copy(this.dir).multiplyScalar(690);
    // The shadow camera follows the focus, snapped to whole shadow-map texels IN LIGHT SPACE (round 3). Round 2
    // rounded the world x and z, but the shadow map's axes are the light's (the sun is low and 17 degrees off the
    // road), so every step of a walk moved the map by a fraction of a texel and every shadow edge in view
    // shimmered: the "flicker while I'm walking". The basis is the one the shadow camera's lookAt builds
    // (z toward the sun, x = up x z, y = z x x); only the across-light coordinates are rounded.
    const S = this.sun.shadow.camera.right, texel = (2 * S) / this.sun.shadow.mapSize.x;
    const z = this.dir, x = _lx.set(z.z, 0, -z.x).normalize(), y = _ly.crossVectors(z, x);
    let lx = focus.x * x.x + focus.y * x.y + focus.z * x.z, ly = focus.x * y.x + focus.y * y.y + focus.z * y.z;
    const lz = focus.x * z.x + focus.y * z.y + focus.z * z.z;
    if (!this.noSnap) { lx = Math.round(lx / texel) * texel; ly = Math.round(ly / texel) * texel; }
    const t = _lt.set(0, 0, 0).addScaledVector(x, lx).addScaledVector(y, ly).addScaledVector(z, lz);
    this.sun.target.position.copy(t);
    this.sun.position.set(t.x + z.x * 120, t.y + z.y * 120, t.z + z.z * 120);
  }
}

const _lx = new THREE.Vector3(), _ly = new THREE.Vector3(), _lt = new THREE.Vector3();
function radialTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.35)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ------------------------------------------------------------------ particles
const MAXP = 420;
export class Particles {
  constructor(scene) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAXP * 3); this.col = new Float32Array(MAXP * 4); this.size = new Float32Array(MAXP);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } }, transparent: true, depthWrite: false,
      vertexShader: 'attribute float size; attribute vec4 color; varying vec4 vC; uniform float uScale; void main(){ vC = color; vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'varying vec4 vC; void main(){ vec2 d = gl_PointCoord-0.5; float r = dot(d,d); if (r > 0.25) discard; gl_FragColor = vec4(vC.rgb, vC.a*smoothstep(0.25, 0.05, r)); }',
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = 5;
    scene.add(this.pts);
    this.p = []; for (let i = 0; i < MAXP; i++) this.p.push({ life: 0 });
    this.n = 0;
  }
  emit(x, y, z, n, o = {}) {
    const c = new THREE.Color(o.color ?? 0xd8b48a);
    for (let k = 0; k < n; k++) {
      const p = this.p[this.n]; this.n = (this.n + 1) % MAXP;
      const a = Math.random() * Math.PI * 2, s = (o.speed ?? 2) * (0.4 + Math.random() * 0.8);
      p.x = x + (Math.random() - 0.5) * (o.spread ?? 0.3); p.y = y + Math.random() * (o.spreadY ?? 0.1); p.z = z + (Math.random() - 0.5) * (o.spread ?? 0.3);
      p.vx = Math.cos(a) * s + (o.vx || 0); p.vz = Math.sin(a) * s + (o.vz || 0); p.vy = (o.up ?? 1.5) * (0.5 + Math.random());
      p.g = o.g ?? 6; p.life = p.max = (o.life ?? 0.6) * (0.6 + Math.random() * 0.7);
      p.s = (o.size ?? 0.25) * (0.6 + Math.random() * 0.8); p.grow = o.grow ?? 1.5; p.r = c.r; p.gg = c.g; p.b = c.b; p.a = o.alpha ?? 0.8; p.drag = o.drag ?? 2;
    }
  }
  update(dt) {
    let alive = 0;
    for (let i = 0; i < MAXP; i++) {
      const p = this.p[i];
      if (p.life <= 0) { this.size[i] = 0; continue; }
      p.life -= dt; alive++;
      const f = Math.max(0, 1 - p.drag * dt);
      p.vx *= f; p.vz *= f; p.vy = p.vy * f - p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const k = Math.max(0, p.life / p.max);
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      this.col[i * 4] = p.r; this.col[i * 4 + 1] = p.gg; this.col[i * 4 + 2] = p.b; this.col[i * 4 + 3] = p.a * Math.min(1, k * 2);
      this.size[i] = p.s * (1 + (1 - k) * p.grow);
    }
    const g = this.pts.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.size.needsUpdate = true;
    return alive;
  }
}

// ------------------------------------------------------------------ mango pickups
export class Mangoes {
  constructor(scene) {
    this.scene = scene; this.list = [];
    this.src = A.glb.mango.scene;
    this.glow = new THREE.SpriteMaterial({ map: radialTex(), color: 0xffc040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 });
  }
  spawn(x, y, z, vx = 0, vy = 4, vz = 0, ttl = 9) {
    const m = this.src.clone(); m.scale.setScalar(2.2);
    m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const s = new THREE.Sprite(this.glow); s.scale.setScalar(0.9); s.position.y = 0.2; m.add(s);
    this.scene.add(m);
    const p = { m, x, y, z, vx, vy, vz, ttl, t: 0, ground: null };
    this.list.push(p); return p;
  }
  clear() { for (const p of this.list) this.scene.remove(p.m); this.list = []; }
  // groundFn(x, z, y) -> ground height under; collect(p) when within reach of the collector
  update(dt, groundFn, collector, reach, onCollect) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt; p.ttl -= dt;
      if (p.vy !== 0 || p.y > (p.ground ?? -99) + 0.01) {
        p.vy -= 18 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const gy = groundFn(p.x, p.z, p.y + 0.3);
        if (p.y <= gy) { p.y = gy; p.ground = gy; if (Math.abs(p.vy) > 3) { p.vy = -p.vy * 0.35; p.vx *= 0.6; p.vz *= 0.6; } else { p.vy = 0; p.vx = 0; p.vz = 0; } }
      }
      p.m.position.set(p.x, p.y + 0.15 + Math.sin(p.t * 4) * 0.06, p.z);
      p.m.rotation.y = p.t * 2.5;
      if (p.ttl < 2) p.m.visible = Math.sin(p.t * 25) > -0.3;
      if (collector && p.t > 0.35 && !p.noCollect) {
        const d = Math.hypot(collector.x - p.x, collector.z - p.z), dy = Math.abs(collector.y + 0.8 - p.y);
        if (d < reach && dy < 2.2) { this.scene.remove(p.m); this.list.splice(i, 1); onCollect && onCollect(p); continue; }
      }
      if (p.ttl <= 0) { this.scene.remove(p.m); this.list.splice(i, 1); }
    }
  }
}
