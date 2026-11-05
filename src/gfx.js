import * as THREE from '../vendor/three.module.min.js';

export const tex = {};      // name -> THREE.Texture
export let manifest = {};   // name -> [w, h]
const tinted = [];          // materials that follow the time-of-day grade: { mat, base: Color, k }

export async function loadAll(onProgress) {
  manifest = await (await fetch('assets/img/manifest.json')).json();
  const names = Object.keys(manifest);
  const loader = new THREE.TextureLoader();
  let done = 0;
  const total = names.length + 1;
  const fontP = document.fonts && document.fonts.load ? Promise.all([
    document.fonts.load('700 20px CairoGame', 'مانجا'), document.fonts.load('900 20px CairoGame', 'مانجا')]).catch(() => {}) : Promise.resolve();
  fontP.then(() => onProgress(++done / total));
  await Promise.all(names.map((n) => new Promise((res) => {
    loader.load(`assets/img/${n}.webp`, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 1;
      tex[n] = t; onProgress(++done / total); res();
    }, undefined, () => { console.error('texture failed', n); onProgress(++done / total); res(); });
  })));
  await fontP;
  for (const n of ['g_cobble', 'g_slab', 'g_planks', 'g_dirt', 'skyline']) {
    if (tex[n]) { tex[n].wrapS = THREE.RepeatWrapping; tex[n].needsUpdate = true; }
  }
}

export function aspect(name) { const m = manifest[name]; return m ? m[0] / m[1] : 1; }

export function matFor(map, opts = {}) {
  const m = new THREE.MeshBasicMaterial({
    map, transparent: true, depthWrite: false, depthTest: false,
    color: opts.color !== undefined ? opts.color : 0xffffff, opacity: opts.opacity !== undefined ? opts.opacity : 1,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  if (opts.tint !== false) tinted.push({ mat: m, base: m.color.clone(), k: opts.tintK !== undefined ? opts.tintK : 1 });
  return m;
}

const planeCache = new Map();
function unitPlane(ax, ay) {
  const key = ax + ',' + ay;
  if (!planeCache.has(key)) {
    const g = new THREE.PlaneGeometry(1, 1);
    g.translate(0.5 - ax, 0.5 - ay, 0);
    planeCache.set(key, g);
  }
  return planeCache.get(key);
}

// A textured quad sized in world metres. anchor (ax, ay) in 0..1 of the quad (0,0 = bottom-left).
export function sprite(name, height, opts = {}) {
  const t = tex[name];
  const w = opts.width !== undefined ? opts.width : height * aspect(name);
  const mesh = new THREE.Mesh(unitPlane(opts.ax !== undefined ? opts.ax : 0.5, opts.ay !== undefined ? opts.ay : 0), matFor(t, opts));
  mesh.scale.set(w, height, 1);
  mesh.renderOrder = opts.order || 0;
  mesh.userData.w = w; mesh.userData.h = height;
  return mesh;
}

// Quad showing a sub-rectangle (u0..u1, v0..v1, v from bottom) of a texture.
export function regionQuad(name, w, h, u0, u1, v0, v1, opts = {}) {
  const g = new THREE.PlaneGeometry(w, h);
  g.translate(w / 2, h / 2, 0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
  }
  const m = new THREE.Mesh(g, matFor(tex[name], opts));
  m.renderOrder = opts.order || 0;
  return m;
}

// Horizontally repeating strip (ground fronts).
export function tiledQuad(name, w, h, tileW, opts = {}) {
  const g = new THREE.PlaneGeometry(w, h);
  g.translate(w / 2, -h / 2, 0); // anchored at top-left
  const uv = g.attributes.uv;
  const reps = w / tileW;
  const vReps = opts.vReps || 1;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * reps, 1 - (1 - uv.getY(i)) * vReps);
  const t = tex[name];
  if (vReps !== 1) { t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; }
  const m = new THREE.Mesh(g, matFor(t, opts));
  m.renderOrder = opts.order || 0;
  return m;
}

export function applyGrade(c) {
  for (const t of tinted) {
    t.mat.color.setRGB(
      t.base.r * (1 + (c.r - 1) * t.k), t.base.g * (1 + (c.g - 1) * t.k), t.base.b * (1 + (c.b - 1) * t.k));
  }
}

// ---------- procedural canvas textures ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export const glowTex = () => canvasTex(128, 128, (g, w) => {
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  r.addColorStop(0.6, 'rgba(255,255,255,0.12)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});
export const dotTex = () => canvasTex(32, 32, (g) => {
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.5, 'rgba(255,255,255,0.6)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 32, 32);
});
export const sunTex = () => canvasTex(256, 256, (g) => {
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(255,252,230,1)'); r.addColorStop(0.16, 'rgba(255,236,170,1)'); r.addColorStop(0.2, 'rgba(255,190,90,0.75)');
  r.addColorStop(0.42, 'rgba(255,140,50,0.25)'); r.addColorStop(1, 'rgba(255,110,40,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
});
export const raysTex = () => canvasTex(512, 512, (g) => {
  g.translate(256, 256);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + Math.random() * 0.2, wdt = 0.03 + Math.random() * 0.07;
    const grd = g.createLinearGradient(0, 0, Math.cos(a) * 256, Math.sin(a) * 256);
    const al = 0.12 + Math.random() * 0.22;
    grd.addColorStop(0, `rgba(255,220,150,${al})`); grd.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = grd; g.beginPath(); g.moveTo(0, 0);
    g.arc(0, 0, 256, a - wdt, a + wdt); g.closePath(); g.fill();
  }
});
export const vignetteTex = () => canvasTex(256, 256, (g) => {
  const r = g.createRadialGradient(128, 118, 60, 128, 128, 190);
  r.addColorStop(0, 'rgba(20,6,0,0)'); r.addColorStop(0.7, 'rgba(30,8,0,0.25)'); r.addColorStop(1, 'rgba(18,4,0,0.72)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
});
export const shadowTex = () => canvasTex(64, 32, (g) => {
  const r = g.createRadialGradient(32, 16, 0, 32, 16, 32);
  r.addColorStop(0, 'rgba(25,10,4,0.55)'); r.addColorStop(1, 'rgba(25,10,4,0)');
  g.setTransform(1, 0, 0, 0.5, 0, 8); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
});
export const waterTex = () => canvasTex(256, 256, (g, w, h) => {
  const lg = g.createLinearGradient(0, 0, 0, h);
  lg.addColorStop(0, '#d9813a'); lg.addColorStop(0.15, '#8a4a3a'); lg.addColorStop(0.6, '#3c2a3a'); lg.addColorStop(1, '#1e1626');
  g.fillStyle = lg; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 220; i++) {
    const y = Math.pow(Math.random(), 1.6) * h, x = Math.random() * w, l = 6 + Math.random() * 30;
    g.fillStyle = `rgba(255,${190 + Math.random() * 50 | 0},120,${0.15 + Math.random() * 0.35 * (1 - y / h)})`;
    g.fillRect(x, y, l, 1.5);
  }
});
export const gradTex = (stops, vertical = true) => canvasTex(4, 256, (g, w, h) => {
  const lg = vertical ? g.createLinearGradient(0, 0, 0, h) : g.createLinearGradient(0, 0, w, 0);
  for (const [o, c] of stops) lg.addColorStop(o, c);
  g.fillStyle = lg; g.fillRect(0, 0, w, h);
});
