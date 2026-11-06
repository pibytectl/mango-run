// Loads everything the 3D mode needs (GLBs with meshopt, textures, voice lines) with one progress callback.
import * as THREE from '../../vendor/three.module.min.js';
import { GLTFLoader } from '../../vendor/addons/GLTFLoader.js';
import { MeshoptDecoder } from '../../vendor/addons/meshopt_decoder.module.js';
import { LINES } from './lines.js';

const BASE = 'assets/3d/';
export const A = { glb: {}, tex: {}, voice: {}, clips: {} };

const MODELS = ['hero', 'mango_thief', 'cart', 'goat', 'mango_crate', 'mango', 'satellite_dish']; // tok-toks and the ferry are built in code (vehicle.js)
// what each mission loads (Mission 2 has no thief rig, carts or goat: 2 MB less to download before it starts)
// Mission 3 keeps the thief rig (the rival kiosk's man, Barai) and the crates, no carts or goat
const MODELS_FOR = { 1: MODELS, 2: ['hero', 'mango_crate', 'mango', 'satellite_dish'], 3: ['hero', 'mango_thief', 'mango_crate', 'mango', 'satellite_dish'] };

// THE character map (round 4, the character pack: ~/claudy-media-out/saidi-game/3d/chars). Every townsperson,
// thug and animal model the game draws is named here once: its file under assets/3d/ and the facts from its
// <name>_clips.json (walk/run: the ground speed in m/s at which the planted foot does not slide; the clips play
// faster or slower by wanted / speed). Each model plays its OWN clips (same 19 bone names as the thief, but
// the thief's clips would float a kid and sink a tall man). Swapping a model = changing one line here.
// `m` lists the missions that load it.
export const CHARS = {
  tea_seller: { file: 'chars/tea_seller.glb', walk: 0.6, run: 1.31, h: 1.68, m: [1, 3] },
  microbus_driver: { file: 'chars/microbus_driver.glb', walk: 1.09, run: 2.71, h: 1.74, m: [1, 3] },
  ferry_captain: { file: 'chars/ferry_captain.glb', walk: 1.12, run: 2.78, h: 1.77, m: [1] },
  thug_big: { file: 'chars/thug_big.glb', walk: 0.84, run: 2.03, h: 1.9, wide: 1.25, m: [1, 3] },
  thug_skinny: { file: 'chars/thug_skinny.glb', walk: 1.22, run: 3.02, h: 1.8, m: [1, 2, 3] },
  thug_jacket: { file: 'chars/thug_jacket.glb', walk: 0.97, run: 2.39, h: 1.73, m: [1, 3] },
  kid_boy: { file: 'chars/kid_boy.glb', walk: 0.98, run: 2.27, h: 1.36, kid: true, m: [1, 2, 3] },
  kid_girl: { file: 'chars/kid_girl.glb', walk: 1.04, run: 2.43, h: 1.3, kid: true, m: [1, 2, 3] },
  hajja: { file: 'chars/hajja.glb', walk: 0.55, run: 1.21, h: 1.52, m: [1, 2, 3] },
  neighbour_woman: { file: 'chars/neighbour_woman.glb', walk: 1.06, run: 2.6, h: 1.62, m: [1, 2, 3] },
  // Mission 2's birds: Radwan's white Sukkara, and the rival keeper's flock in rock-grey and red-brown chequer
  // (one mesh, rig and clip set; the clips are in place: the game flies the bird)
  // Mission 3: the uncle (heavy, bald, a slight hunch; uncle_fathy_clips.json)
  uncle_fathy: { file: 'chars/uncle_fathy.glb', walk: 0.65, run: 1.59, h: 1.65, wide: 1.15, m: [3] },
  pigeon: { file: 'chars/pigeon.glb', bird: true, walk: 0.35, h: 0.23, m: [2] },
  pigeon_grey: { file: 'chars/pigeon_grey.glb', bird: true, walk: 0.35, h: 0.23, m: [2] },
  pigeon_brown: { file: 'chars/pigeon_brown.glb', bird: true, walk: 0.35, h: 0.23, m: [2] },
};
// who plays whom in Mission 1 (roles are the names game3d.js gives its townspeople). The thief, the tok-tok
// driver and the market shoppers keep the round-3 rigs.
export const ROLES = {
  tea: 'tea_seller', driver: 'microbus_driver', captain: 'ferry_captain',
  buddyA: 'thug_big', buddyB: 'thug_skinny', buddyC: 'thug_jacket',
  kid1: 'kid_boy', kid2: 'kid_girl', kid3: 'kid_boy', pass1: 'neighbour_woman', pass2: 'hajja',
  // Mission 2
  hajjaNefisa: 'hajja', ummNadia: 'neighbour_woman', grandson: 'kid_boy', granddaughter: 'kid_girl', sika: 'thug_skinny',
  // Mission 3 (Barai, the rival kiosk's man, keeps the thief rig): the uncle, the customers, the crate thief,
  // Barai's three heavies, the neighbours who need something in the blackout
  fathy: 'uncle_fathy', cust1: 'kid_girl', cust2: 'neighbour_woman', cust3: 'hajja', cust4: 'tea_seller', cust5: 'microbus_driver', cust6: 'kid_boy',
  crateKid: 'kid_boy', heavyBig: 'thug_big', heavySkinny: 'thug_skinny', heavyJacket: 'thug_jacket',
  reqWoman: 'neighbour_woman', reqHajja: 'hajja', reqTea: 'tea_seller',
};
// 1 = tiling (repeat wrap + anisotropy), 0 = clamped. All WebP, mipmapped by three.js on upload.
const TEX = {
  atlas_facades: 0, atlas_town: 0, ground_r2: 1, ground_market: 1, wood_planks: 1, khayamiya: 1, produce: 1,
  kiosk_goods: 0, fridge: 0, sky: 0, skyline: 0, laundry: 0,
};

export async function loadAssets3D(onProgress, maxAniso = 4, mission = 1) {
  const models = MODELS_FOR[mission] || MODELS, chars = Object.entries(CHARS).filter(([, c]) => !c.m || c.m.includes(mission));
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const tl = new THREE.TextureLoader();
  const total = models.length + chars.length + Object.keys(TEX).length;
  let done = 0;
  const tick = () => { done++; onProgress && onProgress(done / total); };
  const jobs = [];
  for (const m of models) {
    jobs.push(loader.loadAsync(BASE + m + '.glb').then((g) => { A.glb[m] = g; tick(); }));
  }
  for (const [name, c] of chars) {
    jobs.push(loader.loadAsync(BASE + c.file).then((g) => { A.glb[name] = g; tick(); }));
  }
  for (const [t, repeat] of Object.entries(TEX)) {
    jobs.push(tl.loadAsync(BASE + 'tex/' + t + '.webp').then((tx) => {
      tx.colorSpace = THREE.SRGBColorSpace;
      if (repeat) { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = maxAniso; }
      A.tex[t] = tx; tick();
    }));
  }
  await Promise.all(jobs);
  for (const name of ['hero', 'mango_thief', ...Object.keys(CHARS)]) {
    if (!A.glb[name]) continue;
    const map = {};
    for (const c of A.glb[name].animations) map[c.name] = c;
    A.clips[name] = map;
  }
  return A;
}

// Voice lines are fetched in the background after the level is up; each decodes on first use.
const voiceRaw = {};
export function prefetchVoices(mission = 1) {
  for (const id of Object.keys(LINES)) {
    if (![].concat(LINES[id].m || 1).includes(mission)) continue;   // m: a mission, or the missions a line is used in
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
