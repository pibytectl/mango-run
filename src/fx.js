import * as THREE from '../vendor/three.module.min.js';
import { dotTex } from './gfx.js';

// Pooled quads: dust puffs, juice, sparkles, splashes. Simulated in the fixed step, drawn interpolated.
export class FX {
  constructor(scene) {
    this.scene = scene;
    this.dot = dotTex();
    this.pool = [];
    this.live = [];
    const geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 160; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.dot, transparent: true, depthWrite: false, depthTest: false }));
      m.visible = false; scene.add(m); this.pool.push(m);
    }
    // ambient dust motes drifting through the light
    const N = 90, pos = new Float32Array(N * 3);
    this.motes = { N, pos, vel: new Float32Array(N * 2) };
    for (let i = 0; i < N; i++) { pos[i * 3] = Math.random() * 30; pos[i * 3 + 1] = Math.random() * 12; this.motes.vel[i * 2] = (Math.random() - 0.3) * 0.3; this.motes.vel[i * 2 + 1] = (Math.random() - 0.5) * 0.15; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.moteMesh = new THREE.Points(g, new THREE.PointsMaterial({ map: this.dot, size: 0.09, color: 0xffd9a0, transparent: true, opacity: 0.7,
      depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    this.moteMesh.renderOrder = 95; this.moteMesh.frustumCulled = false;
    scene.add(this.moteMesh);
  }
  spawn(o) {
    const m = this.pool.pop(); if (!m) return;
    m.visible = true;
    m.material.color.set(o.color || 0xd9b38a);
    m.material.blending = o.add ? THREE.AdditiveBlending : THREE.NormalBlending;
    m.renderOrder = o.order || 90;
    this.live.push({ m, x: o.x, y: o.y, px: o.x, py: o.y, vx: o.vx || 0, vy: o.vy || 0, g: o.g || 0, drag: o.drag || 0,
      life: o.life || 0.6, t: 0, s0: o.s0 || 0.3, s1: o.s1 !== undefined ? o.s1 : (o.s0 || 0.3) * 2, a0: o.a !== undefined ? o.a : 0.6 });
  }
  dust(x, y, n = 6, k = 1) {
    for (let i = 0; i < n; i++) this.spawn({ x: x + (Math.random() - 0.5) * 0.5, y: y + 0.05, vx: (Math.random() - 0.5) * 3 * k, vy: Math.random() * 1.4 * k,
      drag: 3, life: 0.45 + Math.random() * 0.35, s0: 0.25 * k, s1: 0.8 * k, a: 0.45, color: 0xcfa679 });
  }
  juice(x, y, n = 8) {
    for (let i = 0; i < n; i++) this.spawn({ x, y, vx: (Math.random() - 0.5) * 6, vy: Math.random() * 5, g: 14, life: 0.5, s0: 0.12, s1: 0.04, a: 0.95, color: 0xffb020 });
  }
  sparkle(x, y, n = 8, color = 0xffe08a) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 2.5;
      this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 2.5, life: 0.5, s0: 0.22, s1: 0.02, a: 1, color, add: true, order: 96 });
    }
  }
  splash(x, y) {
    for (let i = 0; i < 26; i++) this.spawn({ x: x + (Math.random() - 0.5), y, vx: (Math.random() - 0.5) * 5, vy: 4 + Math.random() * 7, g: 20, life: 0.9, s0: 0.22, s1: 0.1, a: 0.9, color: 0xc8e0e8 });
  }
  feathers(x, y) {
    for (let i = 0; i < 6; i++) this.spawn({ x, y, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 1.5, g: 1.2, drag: 1.5, life: 1.6, s0: 0.12, s1: 0.1, a: 0.9, color: 0xeeeeee });
  }
  step(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.t += dt; p.px = p.x; p.py = p.y;
      p.vy -= p.g * dt; p.vx *= Math.exp(-p.drag * dt); p.vy *= Math.exp(-p.drag * dt * 0.5);
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t >= p.life) { p.m.visible = false; this.pool.push(p.m); this.live.splice(i, 1); }
    }
  }
  render(alpha, camX, camY, viewW, viewH, dt) {
    for (const p of this.live) {
      const k = p.t / p.life, s = p.s0 + (p.s1 - p.s0) * k;
      p.m.position.set(p.px + (p.x - p.px) * alpha, p.py + (p.y - p.py) * alpha, 0);
      p.m.scale.set(s, s, 1);
      p.m.material.opacity = p.a0 * (1 - k * k);
    }
    const { N, pos, vel } = this.motes;
    const x0 = camX - viewW / 2, y0 = camY - viewH / 2;
    for (let i = 0; i < N; i++) {
      let x = pos[i * 3] + vel[i * 2] * dt, y = pos[i * 3 + 1] + vel[i * 2 + 1] * dt + Math.sin((x + i) * 0.7) * 0.002;
      if (x < x0 - 1) x += viewW + 2; if (x > x0 + viewW + 1) x -= viewW + 2;
      if (y < y0 - 1) y += viewH + 2; if (y > y0 + viewH + 1) y -= viewH + 2;
      pos[i * 3] = x; pos[i * 3 + 1] = y;
    }
    this.moteMesh.geometry.attributes.position.needsUpdate = true;
  }
}
