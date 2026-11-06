// Loads everything the 3D mode needs (GLBs with meshopt, textures, voice lines) with one progress callback.
import * as THREE from '../../vendor/three.module.min.js';
import { GLTFLoader } from '../../vendor/addons/GLTFLoader.js';
import { MeshoptDecoder } from '../../vendor/addons/meshopt_decoder.module.js';
import { LINES } from './lines.js';

const BASE = 'assets/3d/';
export const A = { glb: {}, tex: {}, voice: {}, clips: {} };

const MODELS = ['hero', 'mango_thief', 'cart', 'goat', 'mango_crate', 'mango', 'satellite_dish']; // tok-toks and the ferry are built in code (vehicle.js)
// 1 = tiling (repeat wrap + anisotropy), 0 = clamped. All WebP, mipmapped by three.js on upload.
const TEX = {
  atlas_facades: 0, atlas_town: 0, ground_r2: 1, ground_market: 1, wood_planks: 1, khayamiya: 1, produce: 1,
  kiosk_goods: 0, fridge: 0, sky: 0, skyline: 0, laundry: 0,
};

export async function loadAssets3D(onProgress, maxAniso = 4) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const tl = new THREE.TextureLoader();
  const total = MODELS.length + Object.keys(TEX).length;
  let done = 0;
  const tick = () => { done++; onProgress && onProgress(done / total); };
  const jobs = [];
  for (const m of MODELS) {
    jobs.push(loader.loadAsync(BASE + m + '.glb').then((g) => { A.glb[m] = g; tick(); }));
  }
  for (const [t, repeat] of Object.entries(TEX)) {
    jobs.push(tl.loadAsync(BASE + 'tex/' + t + '.webp').then((tx) => {
      tx.colorSpace = THREE.SRGBColorSpace;
      if (repeat) { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = maxAniso; }
      A.tex[t] = tx; tick();
    }));
  }
  await Promise.all(jobs);
  for (const name of ['hero', 'mango_thief']) {
    const map = {};
    for (const c of A.glb[name].animations) map[c.name] = c;
    A.clips[name] = map;
  }
  return A;
}

// Voice lines are fetched in the background after the level is up; each decodes on first use.
const voiceRaw = {};
export function prefetchVoices() {
  for (const id of Object.keys(LINES)) {
    if (voiceRaw[id]) continue;
    voiceRaw[id] = fetch(BASE + 'voice/' + id + '.mp3').then((r) => { if (!r.ok) throw new Error('voice ' + id + ' ' + r.status); return r.arrayBuffer(); })
      .catch((e) => { console.warn(e.message); return null; });
  }
}
export async function voiceBuffer(ctx, id) {
  if (A.voice[id]) return A.voice[id];
  if (!voiceRaw[id]) prefetchVoices();
  const ab = await voiceRaw[id];
  if (!ab || !ctx) return null;
  try {
    A.voice[id] = await new Promise((res, rej) => ctx.decodeAudioData(ab.slice(0), res, rej));
  } catch (e) { console.warn('voice decode', id, e && e.message); return null; }
  return A.voice[id];
}
