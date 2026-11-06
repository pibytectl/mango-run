// Mission 2, "The Runaway Pigeon": the rooftop course. A row of Imbaba roofs running west (-Z, toward the
// Nile and the low sun), built with the same helpers as Mission 1's city so it shares its look and its
// atlases. Only the course, the houses around it and the skyline are built (not Mission 1's streets).
//
//   H  z -888..-902   h 9.6   the start (Radwan, the hajja's grandchildren, the carrier)
//   A  z -904..-916   h 9.6   laundry line                        (Sukkara's 1st perch: the water tank)
//   B  z -918..-930   h 7.2   Umm Nadia's roof: the falling basket
//   S  z -930..-935   h 11.8  her stair block: the roof door (shortcut) or over the top (the long way)
//   C  z -935..-950   h 7.2   a coop: Sika and his net; the alley after it is 6.5 m (his plank, or D)
//   D  x 7..18               h 8.4   the detour north round the alley
//   E  z -956..-974   h 7.2   a weak roof (rotten tin over a collapsed bay)
//   F  z -978..-996   h 7.2   after a 3.6 m gap: the chained dog; a pile of junk up the wall
//   J  z -996..-1016  h 11.4  three low laundry lines in a row
//   K  z -1019..-1038 h 11.4  after a 3.4 m gap: an unfinished storey, rebar columns, two cracking planks
//   L  z -1038..-1056 h 8.6   the grandson and the gas cylinder; stairs up to G
//   G  z -1056..-1074 h 11.4  the hajja's roof and Sukkara's tower; Zaghloul's roof R next door
//
// Metrics (round-4 measurement, hero3d.js): run jump ~4.0 m, sprint jump ~5.6 m, mantle 1.3-2.05 m from the
// ground and up to ~3.2 m above a jump's take-off, steps up to 0.42 m. Required gaps stay inside 0.7 of
// those (safe), the 3.6 m gap to F is the one sprint-jump skill check, the 6.5 m alley is out of reach.
import * as THREE from '../../vendor/three.module.min.js';
import { C } from './level.js';

export const R2 = { H: 9.6, A: 9.6, B: 7.2, S: 11.8, C: 7.2, D: 8.4, E: 7.2, F: 7.2, J: 11.4, K: 11.4, L: 8.6, G: 11.4, R: 10.4 };

export function buildPigeonRoofs(L) {
  const H = R2;
  const roof = (x0, z0, x1, z1, h, o = {}) => L.building((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z0 - z1, 0,
    { h, shop: [], noShop: true, parapetSides: o.parapet || ['left', 'right'], collideParapet: true, roofProps: false, facade: o.facade || 'f_brick_a', ...(o.b || {}) });
  const wall = (x0, z0, x1, z1, y, h = 0.95) => L.paintBox(x0, y, z0, x1, y + h, z1, C.plaster, true, { noVault: true });
  // the street and alleys under the whole course (a fall lands somewhere)
  L.groundBox(-40, -878, 40, -1092, 'street');

  roof(-6, -888, 6, -902, H.H, { parapet: ['left', 'right', 'front'], facade: 'f_ochre' });   // H
  roof(-6, -904.4, 6, -916, H.A, { facade: 'f_brick_b' });                                      // A
  L.roofLaundry(-910, H.A);
  L.roofTank(-4, H.A, -913.6); L.roofDish(4.6, H.A, -907.2);
  roof(-6, -917.8, 6, -930, H.B, { facade: 'f_pale' });                                          // B
  // S: Umm Nadia's stair block, a 2 m corridor through it (the roof door), its top 4.6 m above B
  L.building(-3.5, -932.3, 5, 4.6, 0, { h: H.S, noShop: true, facade: 'f_pale', roofProps: false, parapet: false });
  L.building(3.5, -932.3, 5, 4.6, 0, { h: H.S, noShop: true, facade: 'f_pale', roofProps: false, parapet: false });
  L.building(0, -932.3, 2, 4.6, 0, { h: H.B, noShop: true, facade: 'f_pale', roofProps: false, parapet: false });
  L.texBox(-1, 9.65, -934.6, 1, H.S, -930, 'brickwall', 1.4, true, { noClimb: true });
  // the long way over S: crates, then a water tank, then the top
  L.texBox(2.7, H.B, -928.4, 4.3, H.B + 1.05, -927.2, 'crate', 0.55, true, { vault: true, kind: 'crates' });
  L.roofTank(3.5, H.B, -929.1);
  roof(-6, -934.6, 6, -950, H.C, { parapet: ['left'], facade: 'f_brick_c' });                   // C
  wall(5.75, -934.6, 6, -944.4, H.C);                                                            // C's north side, open toward D at its far end
  L.coop(-3.4, H.C, -945.6);
  L.roofDish(-4.6, H.C, -937.5);
  // D: the detour north round the alley (one jump up from C, one step down onto E)
  roof(7.2, -938, 18, -966, H.D, { parapet: ['right', 'back', 'front'], facade: 'f_ochre' });
  L.roofTank(13, H.D, -945); L.roofTank(13.5, H.D, -958); L.roofDish(16, H.D, -951);
  L.pigeonTower(14.5, H.D, -962, 3.2, 0.9, 0.5);
  // E: a weak roof. Two halves and, between them, a bay roofed with rotten tin that gives way under him
  roof(-6, -956.5, 6, -963, H.E, { parapet: ['left'], facade: 'f_brick_a' });                    // E1
  roof(-6, -968, 6, -974, H.E, { parapet: ['left', 'right'], facade: 'f_brick_a' });            // E2
  wall(5.75, -962.2, 6, -963, H.E);
  L.roofDish(4, H.E, -972.4); L.roofTank(-4.3, H.E, -971.6);
  // F: the dog's roof (a kennel and a chain), two tanks to get up on; at its far end a pile of junk up the wall
  roof(-6, -977.6, 6, -996, H.F, { facade: 'f_brick_b' });
  L.texBox(-6, H.F, -988.2, -4.4, H.F + 1.0, -986.2, 'crate', 0.7, true, { kind: 'kennel' });
  L.roofTank(4.6, H.F, -983.4); L.roofTank(4.6, H.F, -990.6);
  L.texBox(-1.2, H.F, -994.6, 1.2, H.F + 1.35, -992.4, 'crate', 0.55, true, { kind: 'crates' });         // three mantles up
  L.texBox(-1.0, H.F, -996, 1.0, H.F + 2.7, -994.6, 'brickwall', 1.4, true, { kind: 'junk' });
  // J: the tall roof (4.2 m above F): three low laundry lines in a row
  roof(-6, -996, 6, -1016, H.J, { facade: 'f_ochre' });
  for (const z of [-1000.5, -1005.5, -1010.5]) L.roofLaundry(z, H.J);
  L.roofDish(-4.6, H.J, -1013.2); L.roofTank(4.4, H.J, -1002.5);
  // K: an unfinished top storey after a 3.4 m gap: bare columns with rebar, and a bay with no slab where
  // two planks are the only way over (they crack under him)
  roof(-6, -1019.4, 6, -1026, H.K, { facade: 'f_pale' });
  roof(-6, -1030.5, 6, -1038, H.K, { facade: 'f_pale' });
  for (const [x, z] of [[-2.6, -1021.6], [2.7, -1023.4], [-4.4, -1033], [2.4, -1032.4], [-2.2, -1036.2], [4.4, -1035.6]]) {
    L.paintBox(x - 0.2, H.K, z - 0.2, x + 0.2, H.K + 2.6, z + 0.2, C.concrete, true, { kind: 'column', noClimb: true });
    for (const [rx, rz] of [[-0.12, -0.12], [0.12, 0.12], [0.12, -0.12]]) L.B.beam('paint', [x + rx, H.K + 2.6, z + rz], [x + rx * 2, H.K + 3.3, z + rz * 2], 0.02, C.rust);
  }
  // L: the drop (2.8 m) onto the grandson's roof; the gas cylinder; eight 0.35 m steps up to G
  roof(-6, -1038, 6, -1056, H.L, { facade: 'f_brick_a' });
  L.roofTank(4.6, H.L, -1050.6); L.roofDish(-4.8, H.L, -1042);
  for (let i = 0; i < 8; i++) {
    const z1 = -1052.4 - i * 0.45;
    L.paintBox(2.2, H.L, z1 - 0.45, 5.2, H.L + (i + 1) * 0.35, z1, C.concrete, true, { kind: 'stairs' });
  }
  // G: the hajja's roof. Sukkara's tower (its coop roof is the platform), the kitchen roof room, the long way
  // up the tower (crates, then a tank) and where the boy's ladder goes
  const GZ = -1068;
  roof(-6, -1056, 6, -1074, H.G, { parapet: ['left', 'right', 'back'], facade: 'f_ochre' });
  L.pigeonTower(0, H.G, GZ, 2.0, 1.0, 0);
  L.col(-1.45, H.G + 2.0, GZ - 1.45, 1.45, H.G + 3.65, GZ + 1.45, { kind: 'tower', noVault: true });
  L.B.obox(3.9, GZ + 8.4, 0, 3.6, 3.2, H.G, H.G + 2.4, { all: { mat: 'brickwall', scale: 1.4 }, top: { mat: 'roof', scale: 4 }, bottom: null });
  L.col(2.1, H.G, GZ + 6.8, 5.7, H.G + 2.4, GZ + 10, { kind: 'kitchen' });
  L.texBox(2.0, H.G, GZ + 2.4, 3.2, H.G + 1.05, GZ + 3.8, 'crate', 0.55, true, { vault: true, kind: 'crates' });
  L.roofTank(2.6, H.G, GZ + 0.7);
  // R: Zaghloul's roof next door (scenery he stands on): his tower and his long bamboo pole with a flag
  roof(10, GZ + 11, 22, GZ - 9, H.R, { parapet: ['left', 'right', 'front', 'back'], facade: 'f_brick_c' });
  L.pigeonTower(16, H.R, GZ + 0.5, 3.0, 1.05, 0.3);
  L.B.beam('paint', [11.6, H.R, GZ + 4.4], [11.6, H.R + 7.6, GZ + 4.4], 0.05, C.pole2);
  L.B.quad('khay', [[11.6, H.R + 6.6, GZ + 4.4], [11.6, H.R + 6.6, GZ + 3.1], [11.6, H.R + 7.5, GZ + 3.1], [11.6, H.R + 7.5, GZ + 4.4]], [[0, 0], [0.5, 0], [0.5, 0.4], [0, 0.4]]);
  // the houses round the course (scenery only): a row each side, kept clear of D and R
  const R = L.R;
  for (let z = -884; z > -1088; z -= 10 + R() * 5) {
    L.building(-16 - R() * 3, z, 10 + R() * 5, 9 + R() * 4, 1 + Math.floor(R() * 3), { collide: false, towerP: 0.35, acFace: 'right' });
    if ((z > -934 || z < -970) && (z > -1054 || z < -1081)) L.building(16 + R() * 3, z, 10 + R() * 5, 9 + R() * 4, 1 + Math.floor(R() * 3) + (z < -995 && z > -1040 ? 2 : 0), { collide: false, towerP: 0.35, acFace: 'left' });
  }
  // wires over the alleys
  for (const z of [-903, -917, -951, -953, -976, -1017, -1037, -1055]) L.wire([-9, H.B + 1 + R() * 2, z], [9, H.B + 1.5 + R() * 2, z + (R() - 0.5) * 3], 0.7 + R());

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // the weak roof's tin sheets and the unfinished storey's two planks (RoofTraps crumbles them)
  L.spawns.crumble = [0, 1, 2].map((i) => ({ x0: -6, x1: 6, z0: -963 - (i + 1) * 5 / 3, z1: -963 - i * 5 / 3, y: H.E, th: 0.08, kind: 'tin' }))
    .concat([0, 1].map((i) => ({ x0: -0.5, x1: 0.5, z0: -1026 - (i + 1) * 2.25, z1: -1026 - i * 2.25, y: H.K, th: 0.1, kind: 'plank' })));
  L.spawns.m2 = {
    start: V(0, H.H, -896.5),
    cps: { start: V(0, H.H, -896.5), B: V(0, H.B, -919.5), C: V(0, H.C, -936.5), E: V(0, H.E, -958), F: V(0, H.F, -979.5), J: V(0, H.J, -997.5), K: V(0, H.K, -1020.5), L: V(0, H.L, -1040), G: V(0, H.G, GZ + 10.5) },
    // Sukkara's perches (where she lands; y is the top she stands on)
    perch: { P1: V(-4, H.A + 1.82, -913.6), P2: V(3.2, H.S + 0.02, -930.6), P3: V(-3.4, H.C + 1.97, -945.6),
      P4: V(4, H.E + 1.42, -972.4), P5: V(4.6, H.F + 1.82, -990.6), P6: V(-4.6, H.J + 1.42, -1013.2), P7: V(2.4, H.K + 2.62, -1032.4),
      P8: V(4.6, H.L + 1.82, -1050.6), pole: V(11.6, H.R + 7.65, GZ + 4.4), home: V(0, H.G + 3.7, GZ + 0.8), zag: V(16, H.R + 4.8, GZ + 0.5) },
    door: { x0: -1, x1: 1, z0: -930.25, z1: -930.05, y0: H.B, y1: 9.65 },
    umm: V(2.4, H.S, -930.9), basketLand: V(-1.6, H.B, -925.2),
    plank: { x0: -0.6, x1: 0.6, z0: -956.7, z1: -949.8, y: H.C + 0.06 },
    sikaUp: V(3.6, H.C, -938.6),
    dog: { kennel: V(-4.4, H.F, -987.2), r: 5.6 },
    cyl: V(3.5, H.L, -1049.2), kitchen: V(3.9, H.G, GZ + 10.4), kid3: V(2.0, H.L, -1048.4),
    ladder: { x0: -2.25, x1: -1.6, z0: GZ - 0.5, z1: GZ + 0.5, y0: H.G, y1: H.G + 1.9 },
    towerTop: V(0, H.G + 3.65, GZ), hajja: V(-3.2, H.G, GZ + 8.5), zaghloul: V(16, H.R + 4.8, GZ + 0.5), flock: V(16, H.R + 8, GZ + 0.5),
  };
  return L;
}
