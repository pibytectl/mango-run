// Mission 3, "A Week at Uncle's Kiosk" (أسبوع في كشك عمه): one Imbaba street round uncle Fathy's kiosk, used
// for all five days. Built with Mission 1's helpers and atlases (no new textures); the kiosk is round 2's
// koshk (red and blue fridges, invented brands) grown into a little business across the street.
//
//   Street   x -5.2..5.2, z -870..-996   the kiosk on the right at z -900; tok-toks down the middle
//   Across   the freezer (-3.6, -893) and the goods table (-3.6, -907.5): the uncle's extension
//   A        z -912..-918.4  an outdoor stair up to a first-floor landing (2.8 m), left side
//   B        z -927..-941    a courtyard on the left: the chained dog, a stair up to a roof room (3.2 m)
//   C        z -941..-964    on the right: a stair up a 3.6 m shed, a plank over an alley, a door on the next roof
//   Market   z -962..-992    stalls, a low line of washing, crates (Day 3's chase)
//   End      z -996          a 1.7 m wall, crates, two shed roofs (3.0 / 2.6) with a 3.2 m gap, then the Nile road
//
// Metrics (hero3d.js, round-4 measurement): run jump ~4.0 m, sprint jump ~5.6 m, mantle 1.3-2.05 m, steps up
// to 0.42 m. Every required gap is inside 0.8 of the run jump (the shed gap is 3.2 m); the stairs rise 0.35-0.4
// a step so he can carry a gas cylinder up them (no jump while carrying).
import * as THREE from '../../vendor/three.module.min.js';
import { C } from './level.js';

export const K3 = { fx: 4.05, cz: -900 };

export function buildKioskStreet(L) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const R = L.R;
  L.groundBox(-40, -866, 40, -1046, 'street');
  // the two rows of houses (gaps: the courtyard B on the left, the sheds C on the right)
  L.row(-1, -5.2, -868, -996, { gaps: [[-927, -941]], towerP: 0.2 });
  L.row(1, 5.2, -868, -996, { gaps: [[-941, -964]], towerP: 0.2 });
  // ---- the kiosk, grown: its booth and fridges, a second awning over a freezer and a goods table across the
  // street, a cage of gas cylinders, the generator, a string of bulbs over the street
  const { fx, cz } = K3;
  L.kiosk(fx, cz);
  L.paintBox(-4.2, 0, -893.6, -3.0, 0.9, -892.3, C.white, true, { kind: 'freezer', vault: true });
  L.paintBox(-4.25, 0.9, -893.65, -2.95, 0.95, -892.25, [0.6, 0.78, 0.9], false);
  L.texBox(-4.4, 0, -908.4, -2.9, 0.86, -906.6, 'crate', 0.6, true, { kind: 'goods', vault: true });
  for (let i = 0; i < 6; i++) L.paintBox(-4.3 + i * 0.24, 0.86, -908.2, -4.12 + i * 0.24, 1.0 + (i % 3) * 0.04, -906.9, i % 2 ? [0.86, 0.7, 0.42] : [0.95, 0.94, 0.86], false);
  for (const [z0, z1] of [[-894.2, -891.7], [-909, -906]]) {
    L.paintBox(-5.15, 0, z0 - 0.05, -5.05, 2.5, z0 + 0.05, C.woodDark, false); L.paintBox(-2.75, 0, z0 - 0.05, -2.65, 2.5, z0 + 0.05, C.woodDark, false);
    L.B.quad('khay', [[-2.6, 2.3, z1], [-2.6, 2.3, z0], [-5.2, 2.6, z0], [-5.2, 2.6, z1]], [[0, 0], [1.2, 0], [1.2, 0.5], [0, 0.5]]);
  }
  L.paintBox(4.0, 0, -906.6, 5.2, 0.1, -904.1, C.concrete, true, { kind: 'cage' });
  L.paintBox(3.95, 0, -906.65, 4.0, 1.3, -904.05, C.iron, false);
  L.paintBox(3.95, 1.25, -906.65, 5.2, 1.3, -904.05, C.iron, false);
  L.col(3.95, 0, -906.65, 5.2, 1.3, -904.05, { kind: 'cage', noVault: true, noClimb: true });
  // generator: a squat yellow box with an exhaust pipe, under a scrap of tin
  L.paintBox(4.0, 0, -896.4, 5.0, 0.75, -895.2, [0.86, 0.66, 0.12], true, { kind: 'gen', noClimb: true });
  L.paintBox(4.1, 0.75, -896.3, 4.9, 0.8, -895.3, C.iron, false);
  L.B.beam('paint', [4.85, 0.75, -895.4], [4.85, 1.35, -895.4], 0.04, C.rust);
  for (let z = -890; z > -912; z -= 1.2) L.bulbs.push([Math.sin(z * 3) * 0.3 - 0.4, 3.6 + Math.sin(z * 0.9) * 0.15, z]);
  L.wire([-5.2, 3.8, -890], [5.2, 3.8, -911], 0.5);
  L.wire([-5.2, 4.1, -903], [5.2, 4.2, -898], 0.6);
  // Barai's rival kiosk across the way, up the street: a dark booth, shutter down, his own faded banner
  L.paintBox(-5.2, 0, -887.8, -3.7, 2.2, -884.2, [0.16, 0.22, 0.2], true, { kind: 'kiosk' });
  L.paintBox(-3.72, 0.1, -887.5, -3.68, 2.0, -884.5, [0.42, 0.42, 0.4], false);
  L.paintBox(-5.25, 2.2, -888.1, -3.4, 2.5, -883.9, [0.5, 0.42, 0.12], false);
  // ---- A: an outdoor stair up to a first-floor landing (8 steps of 0.35 m), against the left houses
  for (let i = 0; i < 8; i++) L.paintBox(-5.2, 0, -912 - i * 0.45 - 0.45, -3.9, (i + 1) * 0.35, -912 - i * 0.45, C.concrete, true, { kind: 'stairs' });
  L.paintBox(-5.2, 0, -918.4, -3.6, 2.8, -915.6, C.plaster, true, { kind: 'landing', noClimb: true });
  L.paintBox(-3.65, 2.8, -918.4, -3.55, 3.75, -915.6, C.iron, true, { noVault: true, noClimb: true });
  // ---- B: the courtyard, the dog's kennel, a stair up to the roof room
  L.groundBox(-18, -927, -5.2, -941, 'market', 0.005, 4);
  L.building(-21, -934, 6, 14, 2, { shop: [], acFace: 'right' });
  L.building(-16, -934, 2.2, 14, 0, { h: 3.2, noShop: true, facade: 'f_pale', roofProps: false, parapet: false });
  for (let i = 0; i < 8; i++) L.paintBox(-10.6 - i * 0.5 - 0.5, 0, -940.6, -10.6 - i * 0.5, (i + 1) * 0.4, -938.4, C.concrete, true, { kind: 'stairs' });
  L.paintBox(-14.9, 0, -940.6, -14.6, 3.2, -938.4, C.concrete, true, { kind: 'stairs' });
  L.texBox(-10.25, 0, -936.4, -8.95, 0.9, -934.8, 'crate', 0.7, true, { kind: 'kennel' });
  // ---- C: a stair up the street face of a shed (9 steps of 0.4 m), its roof, a plank over the alley, the
  // next roof and its roof room (the door)
  L.building(10, -948, 6, 8, 0, { h: 3.6, noShop: true, facade: 'f_brick_b', roofProps: false, parapetSides: ['right'], collideParapet: true });
  for (let i = 0; i < 9; i++) L.paintBox(5.4, 0, -941.6 - i * 0.5 - 0.5, 6.95, (i + 1) * 0.4, -941.6 - i * 0.5, C.concrete, true, { kind: 'stairs' });
  L.paintBox(5.4, 0, -948.2, 7.0, 3.6, -946.1, C.concrete, true, { kind: 'landing', noClimb: true });
  L.building(10, -959.25, 6, 5.5, 0, { h: 3.6, noShop: true, facade: 'f_brick_c', roofProps: false, parapetSides: ['right', 'back'], collideParapet: true });
  L.B.obox(10.5, -960.9, 0, 2.6, 2.2, 3.6, 5.8, { all: { mat: 'brickwall', scale: 1.4 }, top: { mat: 'roof', scale: 4 }, bottom: null });
  L.col(9.2, 3.6, -962, 11.8, 5.8, -959.8, { kind: 'roofroom', noClimb: true });
  L.groundBox(5.2, -952, 13, -956.5, 'street', 0.004);
  L.building(10, -969, 6, 9, 2, { shop: ['left'], acFace: 'left' });
  // ---- the market (Day 3's chase runs through it)
  for (const x of [-3.4, 3.4]) for (let z = -965; z > -991; z -= 2.8) { if (Math.round((z + 965) / 2.8) % 4 === 3) continue; L.stall(x, z, R); }
  L.laundryLine(-922, 1.05);
  L.laundryLine(-978.5, 1.0);
  L.crateStack(0.2, -971, R); L.crateStack(-1.3, -986, R);
  // ---- the low wall at the street's end, crates, two shed roofs, the drop to the Nile road
  L.texBox(-5.2, 0, -996.6, 5.2, 1.7, -996, 'brickwall', 1.4, true, { kind: 'wall' });
  L.texBox(-1.2, 0, -998.8, 1.2, 1.4, -997.5, 'crate', 0.55, true, { kind: 'crates' });
  L.building(0, -1003, 10.4, 8, 0, { h: 3.0, noShop: true, facade: 'f_pale', roofProps: false, parapetSides: ['left', 'right'], collideParapet: true });
  L.building(0, -1014.1, 10.4, 7.8, 0, { h: 2.6, noShop: true, facade: 'f_ochre', roofProps: false, parapetSides: ['left', 'right'], collideParapet: true });
  L.building(-11.5, -1006, 12, 16, 3, { collide: true, shop: ['right'] });
  L.building(11.5, -1006, 12, 16, 4, { collide: true, shop: ['left'] });
  L.roofTank(-3.4, 3.0, -1004.6); L.roofDish(3.6, 2.6, -1016.2);
  for (const z of [-917, -951, -962, -975, -993]) L.wire([-5.2, 5 + R() * 2, z], [5.2, 5.5 + R() * 2, z + (R() - 0.5) * 3], 0.7 + R());
  for (let z = -965; z > -991; z -= 1.6) L.bulbs.push([Math.sin(z) * 0.2, 2.9 + Math.sin(z * 0.7) * 0.1, z]);

  L.spawns.crumble = [];   // no crumbling roofs (RoofTraps reads it)
  L.spawns.marks = { barrier: -1e9 };   // game3d's street tok-toks read it (Mission 1's barrier)
  L.spawns.m3 = {
    start: V(1.4, 0, -897),
    // Day 1/5: where Radwan stands to take each item, and where customers queue (the counter first)
    stations: { red: V(3.25, 0, -901.42), blue: V(3.25, 0, -898.58), ice: V(-2.45, 0, -892.95), goods: V(-2.4, 0, -907.5) },
    counter: V(2.35, 0, -900), queue: [V(2.35, 0, -900), V(2.25, 0, -902.5), V(2.15, 0, -904.4), V(2.05, 0, -906.9)],
    tokLane: 0,
    // Day 2: the cylinder cage and the three doors
    rack: V(3.5, 0, -905.3),
    doors: [{ id: 'A', p: V(-4.4, 2.8, -917.4), foot: V(-3.4, 0, -911.4) }, { id: 'C', p: V(10.3, 3.6, -958.9), foot: V(6.2, 0, -940.8) }, { id: 'B', p: V(-15.8, 3.2, -939.5), foot: V(-8.6, 0, -939.5) }],
    dog: { kennel: V(-9.6, 0, -935.6), r: 4.9 },
    plank: { x0: 9.55, x1: 10.55, z0: -956.55, z1: -951.95, y: 3.6 },
    // Day 3: the crate thief's route (x, y, z, speed m/s; hop = he hops an obstacle there)
    kidPath: [
      [1.0, 0, -903, 6.6], [0.6, 0, -914, 7.0], [0.2, 0, -921, 6.6, 'duck'], [-0.6, 0, -934, 7.0], [1.2, 0, -950, 7.0], [0, 0, -962, 6.8],
      [0, 0, -969.5, 6.4], [1.6, 0, -972.5, 6.4], [0, 0, -978, 6.4, 'duck'], [0, 0, -984, 6.8], [0.2, 0, -995.6, 5.4], [0.3, 1.7, -996.3, 4, 'hop'],
      [0.3, 0, -997.2, 5], [0.1, 1.4, -998.1, 4, 'hop'], [0, 3.0, -999.4, 4, 'hop'], [0, 3.0, -1006.6, 6.8], [0, 2.6, -1010.6, 6, 'hop'],
      [0, 2.6, -1017.6, 6.8], [0, 0, -1019.4, 5, 'hop'], [0, 0, -1034, 7.0],
    ],
    buckets: [-940, -987],
    // Day 4: the fight in front of the kiosk; the spot a raider smashes
    arena: V(0.5, 0, -900), smash: V(2.6, 0, -900.4),
    // Day 5: the generator, and the neighbours who ask for something in the blackout
    gen: V(3.4, 0, -895.8),
    requests: [{ who: 'reqWoman', at: V(-4.4, 2.8, -917.2), item: 'goods', line: 'n1' }, { who: 'reqHajja', at: V(-5.8, 0, -931.5), item: 'blue', line: 'n2' }, { who: 'reqTea', at: V(-3.4, 0, -883.5), item: 'ice', line: 'n3' }],
    lantern: V(1, 3.4, -900),
  };
  return L;
}
