// The Japan map for the race: the scenery of the "Japan" map from the FoxKarts Maps artifact (buildJapan in its
// maps.js), adapted to the game. The game draws the road, kerbs, walls, start gantry, ? boxes, ramps and pit stop
// itself, on a centre line that is the same spline (TRACK_DEFS.japan.points), so this file builds only what is
// round the road: the terrain, the lake and the sea, the temples, the town, the trees, torii, lanterns and Mount Fuji.
// Left out for the race: the road split (the game has one road), the artifact's own road, barriers, start canopy,
// garages and checkpoints, and every point light (lamps glow by an emissive head instead, which phones draw cheaply).
import * as THREE from 'three';
import { Track, buildTerrain, scatter, Instancer, G, fbm, smoothstep, mulberry32, makeWater, makeTextPlane } from './engine.js';
import { Kit, FLAT } from './kit.js';

// the track's control points (x, y = height, z), exactly as in the artifact; the game's road follows the spline through them
export const JAPAN_POINTS = [
  [0, 2, -210], [110, 2, -215], [185, 4, -175], [165, 9, -110], [215, 15, -45], [185, 25, 25], [125, 33, 55], [150, 42, 125], [75, 46, 185],
  [-30, 36, 150], [-75, 24, 200], [-170, 16, 190], [-210, 10, 110], [-150, 8, 50], [-205, 6, -25], [-165, 4, -105], [-215, 3, -170], [-120, 2, -215],
];
export const JAPAN_WIDTH = 13, WATER = -13.5;
// the centre line, sampled every ~2 m (the game builds its road from these)
export function japanSpline() { const t = new Track(JAPAN_POINTS, { width: JAPAN_WIDTH, samples: 760 }); return t.pts.map((p) => [p.x, p.y, p.z]); }

const inst = (geo, max, opts = {}) => new Instancer(geo, FLAT(opts.mat), max, { castShadow: opts.shadow ?? false });
const rnd = (r, a, b) => a + r() * (b - a);
// a street lamp with a glowing head and no light of its own
const lampMat = new THREE.MeshStandardMaterial({ color: 0x2a2d3a, roughness: 0.6 }), lampHead = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0c8, emissiveIntensity: 1.2 });
function lamp(world, x, y, z, ry) {
  const g = new THREE.Group(); const pole = new THREE.Mesh(G.cyl(0.12, 0.16, 7, 6), lampMat); pole.position.y = 3.5; g.add(pole);
  const arm = new THREE.Mesh(G.box(2.2, 0.15, 0.15), lampMat); arm.position.set(1, 6.9, 0); g.add(arm);
  const head = new THREE.Mesh(G.box(0.9, 0.2, 0.5), lampHead); head.position.set(2, 6.85, 0); g.add(head);
  g.position.set(x, y, z); g.rotation.y = ry; world.add(g);
}

// density: 1 = the artifact's own; lower for slow phones. Returns the world group and the ground height function.
export function buildJapanWorld({ seed = 7, density = 1 } = {}) {
  const rng = mulberry32(seed), width = JAPAN_WIDTH;
  const track = new Track(JAPAN_POINTS, { width, samples: 760 });
  const world = new THREE.Group(); world.name = 'Japan';
  const heightFn = (x, z) => {
    let h = fbm(x / 420 + 3, z / 420 - 1, 4) * 38 + fbm(x / 120, z / 120, 3) * 8;
    const lake = smoothstep(120, 40, Math.hypot(x + 125, z - 245)); h -= lake * 22;   // the lake basin under the bridge
    h += smoothstep(170, 60, Math.hypot(x - 300, z - 40)) * 70;                       // the ridge behind the torii hill
    return h;
  };
  const colorFn = (c, x, z, h, slope, d) => {
    const grass = new THREE.Color(0x86d46e), grass2 = new THREE.Color(0x5db85e), rock = new THREE.Color(0x8b8ea0), sand = new THREE.Color(0xe8d9a8), dirt = new THREE.Color(0xb48a5a);
    c.copy(grass).lerp(grass2, smoothstep(10, 40, h) * 0.7 + fbm(x / 60, z / 60, 2) * 0.3);
    if (h < -8) c.lerp(sand, smoothstep(-8, -16, h));
    c.lerp(rock, smoothstep(0.25, 0.55, slope)); c.lerp(dirt, smoothstep(26, 9, d) * 0.6);
  };
  const terrain = buildTerrain({ size: 1100, seg: 170, track, heightFn, colorFn, blendMargin: 28 });
  terrain.material.flatShading = true; terrain.material.needsUpdate = true; world.add(terrain);
  const ground = (x, z) => Math.max(terrain.userData.sample(x, z), WATER - 0.5);
  // water: the lake and the sea, and a wide sea beyond the island so the horizon is never empty
  world.add(makeWater(1100, WATER, 0x3fc1d6));
  const far = new THREE.Mesh(new THREE.RingGeometry(540, 2600, 48, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3fb4cc, roughness: 0.3 })); far.position.y = WATER - 0.05; world.add(far);
  // Mount Fuji, distant ridges, clouds (pulled in from the artifact's distances so the race camera, which sees 1.5 km, has them)
  const fuji = new THREE.Mesh(Kit.fuji(), FLAT()); fuji.position.set(420, -30, -1080); fuji.scale.setScalar(0.85); world.add(fuji);
  const mtn = inst(Kit.mountain(0x5f7ea3, 0xf4f7fb, 300, 220), 14);
  for (let k = 0; k < 14; k++) { const a = Math.PI * 0.55 + k * 0.17; const r = 980 + rnd(rng, -60, 80); mtn.add(Math.cos(a) * r, -60, Math.sin(a) * r - 200, { rotY: rng() * 6, scale: rnd(rng, 0.7, 1.2) }); } world.add(mtn.finish());
  const clouds = inst(Kit.cloud(), 26, { mat: { roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.55 } }); for (let k = 0; k < 26; k++) clouds.add(rnd(rng, -1000, 1000), rnd(rng, 220, 340), rnd(rng, -1100, 700), { scale: rnd(rng, 1.5, 3.5), rotY: rng() * 6 }); world.add(clouds.finish());
  // scenery
  const C = density;
  const cherry = inst(Kit.cherry(), Math.round(2000 * C)), cherry2 = inst(Kit.cherry(0xffc1dc, 0xffa0c8), Math.round(1200 * C)), jp = inst(Kit.jpine(), Math.round(1600 * C)), bamboo = inst(Kit.bamboo(), Math.round(900 * C)), bush = inst(Kit.bush(0x58b85a), Math.round(1800 * C)), rock = inst(Kit.rock(), Math.round(500 * C));
  const lanternP = inst(Kit.lanternPaper(), 400, { mat: { emissive: 0xff7a1a, emissiveIntensity: 0.25 } }), lanternS = inst(Kit.lanternStone(), 200), house = inst(Kit.machiya({ floors: 2 }), 90), bld = [];
  const paletteBld = [[0xf7f3ea, 0xff4fa3], [0xe9f1ff, 0x2bb0e8], [0xfff2d9, 0xff8a1a], [0xf1e9ff, 0x8d4fd6], [0xe8ffef, 0x5fc53a]];
  const tilePal = [0x4f5664, 0x3d5a8c, 0x3f6e4e, 0x7c3b3b, 0x4a3f6e]; paletteBld.forEach(([w, a], k) => bld.push(inst(Kit.machiya({ floors: 2 + Math.floor(rng() * 2), noren: a, cream: w, lantern: a === 0xff8a1a ? 0xffd34a : 0xff6a2a, tile: tilePal[k % tilePal.length], ridge: 0x9aa3b0 }), 40)));
  // the temple precinct on the shrine hill: a two-tier hall (kondo) and pagodas on the highest ground well clear of the road
  const landmarks = [];
  const hill = []; for (let x = -80; x <= 240; x += 5) for (let z = 40; z <= 290; z += 5) { const nr = track.nearest(x, z); const y = ground(x, z); if (nr.d > 26 && y > nr.y - 4 && y > WATER + 3) hill.push({ x, z, d: nr.d, score: Math.min(nr.d, 45) + 0.6 * Math.max(0, y - nr.y) }); }
  hill.sort((a, b) => b.score - a.score);
  const pick = (minGap) => hill.find((h) => landmarks.every((l) => Math.hypot(h.x - l.x, h.z - l.z) > minGap)) || null;
  const temple = (geo, spot, scale, r) => { if (!spot) return; const nr = track.nearest(spot.x, spot.z); const f = track.frames[nr.i]; const m = new THREE.Mesh(geo, FLAT()); m.position.set(spot.x, ground(spot.x, spot.z) - 0.5, spot.z); m.rotation.y = Math.atan2(f.p.x - spot.x, f.p.z - spot.z); m.scale.setScalar(scale); m.name = 'Temple'; world.add(m); landmarks.push({ x: spot.x, z: spot.z, r: r * scale }); };
  temple(Kit.kondo(), pick(0) || { x: 115, z: 200 }, 1.1, 20);
  temple(Kit.pagoda(), pick(52) || { x: 60, z: 215 }, 1.25, 13);
  temple(Kit.pagoda({ tiers: 3, roof: 0x3b6f9e, roofEdge: 0x27507a, red: 0xc23a1a }), pick(40), 1.0, 11);
  const nearLandmark = (x, z) => landmarks.some((l) => Math.hypot(x - l.x, z - l.z) < l.r);
  // zones by track index: town 0..120 (the start) & 640..760, cherry avenue 120..260, torii climb 260..380, shrine 380..430, lake 430..560, bamboo 560..640
  const zoneOf = (i) => (i < 120 || i > 640) ? 'town' : i < 260 ? 'cherry' : i < 380 ? 'torii' : i < 430 ? 'shrine' : i < 560 ? 'lake' : 'bamboo';
  // more temple buildings round the lap: outside the bends, on ground near road height
  { const n0 = track.pts.length; const kinds = [() => Kit.pagoda(), () => Kit.kondo(), () => Kit.pagoda({ tiers: 3, roof: 0x3b6f9e, roofEdge: 0x27507a, red: 0xc23a1a }), () => Kit.pagoda({ roof: 0x3f7f3a, roofEdge: 0x2d5f2a }), () => Kit.kondo({ tile: 0x3a4a6a, ridge: 0x6a7a9a, cream: 0xf7f0e2 }), () => Kit.pagoda({ tiers: 4, roof: 0x8a3a6a, roofEdge: 0x5a2446 })];
    [[60, 1], [120, -1], [170, 1], [220, -1], [270, 1], [330, -1], [400, 1], [450, -1], [500, 1], [560, -1], [620, 1], [680, -1]].forEach(([i0, s0], k) => {
      for (const [i, s, dist] of [[i0, s0, 32], [i0, -s0, 32], [i0 + 15, s0, 40], [i0 + 15, -s0, 40], [i0 - 15, s0, 48], [i0 - 15, -s0, 48], [i0, s0, 58], [i0, -s0, 58]]) {
        const f = track.frames[(i + n0) % n0]; const x = f.p.x + f.side.x * s * (width / 2 + dist), z = f.p.z + f.side.z * s * (width / 2 + dist); const nr = track.nearest(x, z); const y = ground(x, z);
        if (nr.d < 24 || y < nr.y - 8 || y < -8 || nearLandmark(x, z)) continue;
        temple(kinds[k % kinds.length](), { x, z }, 0.9 + 0.1 * (k % 3), (k % 6 === 1 || k % 6 === 4) ? 20 : 12); break;
      }
    }); }
  scatter({ rng, count: Math.round(2600 * C), area: 760, track, terrain, minRoad: 6, place: (x, y, z, nr) => {
    if (y < -11 || nearLandmark(x, z)) return; const zone = zoneOf(nr.i); const r = rng(); const s = rnd(rng, 0.8, 1.35); const rotY = rng() * 6.3;
    if (zone === 'cherry' && nr.d < 60) { (r < 0.6 ? cherry : cherry2).add(x, y, z, { rotY, scale: s }); return; }
    if (zone === 'town' && nr.d < 70) { if (nr.d < 16) { bush.add(x, y, z, { rotY, scale: s }); return; } if (r < 0.35) bld[Math.floor(rng() * bld.length)].add(x, y, z, { rotY: Math.round(rotY / 1.5708) * 1.5708, scale: rnd(rng, 0.8, 1.2) }); else if (r < 0.5) house.add(x, y, z, { rotY, scale: s }); else if (r < 0.7) cherry.add(x, y, z, { rotY, scale: s * 0.9 }); else bush.add(x, y, z, { rotY, scale: s }); return; }
    if (zone === 'bamboo' && nr.d < 50) { (r < 0.75 ? bamboo : jp).add(x, y, z, { rotY, scale: s }); return; }
    if (zone === 'torii' || zone === 'shrine') { if (r < 0.5) jp.add(x, y, z, { rotY, scale: s }); else if (r < 0.7) cherry.add(x, y, z, { rotY, scale: s }); else if (r < 0.8) rock.add(x, y, z, { rotY, scale: s }); else bush.add(x, y, z, { rotY, scale: s }); return; }
    if (y > 30 && r < 0.6) jp.add(x, y, z, { rotY, scale: s }); else if (r < 0.45) cherry.add(x, y, z, { rotY, scale: s }); else if (r < 0.75) bush.add(x, y, z, { rotY, scale: s }); else if (r < 0.85) rock.add(x, y, z, { rotY, scale: s }); else jp.add(x, y, z, { rotY, scale: s });
  } });
  // trackside: paper lanterns on the cherry avenue, torii over the road on the climb, stone lanterns at the shrine, lamps in the town and on the lake
  const n = track.pts.length, toriiGeo = Kit.torii(), toriiMat = FLAT(), torii = [];
  for (let i = 0; i < n; i += 6) {
    const f = track.frames[i]; const zone = zoneOf(i); const side = (i % 12 === 0) ? 1 : -1; const p = f.p.clone().addScaledVector(f.side, side * (width / 2 + 5));
    if (zone === 'cherry') lanternP.add(p.x, ground(p.x, p.z), p.z, { rotY: rng() * 6 });
    if (zone === 'torii' && i % 18 === 0) torii.push(f);
    if (zone === 'shrine' && i % 12 === 0) lanternS.add(p.x, ground(p.x, p.z), p.z, { rotY: Math.atan2(f.t.x, f.t.z) });
    if ((zone === 'town' && i % 24 === 0) || (zone === 'lake' && i % 30 === 0)) lamp(world, p.x, ground(p.x, p.z), p.z, Math.atan2(f.side.x, f.side.z) + (side > 0 ? Math.PI / 2 : -Math.PI / 2));
  }
  // (the arches stand wider than the artifact's so their posts clear the game's walls: 2.4 × 3.2 m = 7.7 m out)
  for (const f of torii) { const t = new THREE.Mesh(toriiGeo, toriiMat); t.position.set(f.p.x, f.p.y - 0.2, f.p.z); t.rotation.y = Math.atan2(f.t.x, f.t.z); t.scale.setScalar(2.4); t.castShadow = true; world.add(t); }
  // the lake bridge: concrete piers under the road and a red rail outside the game's wall (track samples 440..530 cross the basin)
  const railMat = new THREE.MeshStandardMaterial({ color: 0xd9341f, roughness: 0.6 }); const rails = new Instancer(G.box(0.3, 1.4, 2.4), railMat, 400);
  for (let i = 440; i < 530; i += 2) { const f = track.frames[i]; for (const s of [-1, 1]) { const p = f.p.clone().addScaledVector(f.side, s * (width / 2 + 2.2)); rails.add(p.x, p.y + 0.4, p.z, { rotY: Math.atan2(f.t.x, f.t.z) }); } }
  world.add(rails.finish());
  const piers = new Instancer(G.cyl(1.2, 1.6, 30, 8), new THREE.MeshStandardMaterial({ color: 0x9a9ca8 }), 40); for (let i = 445; i < 530; i += 10) { const f = track.frames[i]; piers.add(f.p.x, f.p.y - 15.3, f.p.z); } world.add(piers.finish());
  // neon signs in the town (an opaque dark board with bright letters)
  const neonTexts = ['フォックス', 'KART', 'ラーメン', 'NEON', '東京', 'GO!', 'カフェ', 'FOX']; const neonCols = ['#ff2d9b', '#2bf0ff', '#ffe600', '#7a5cff', '#ff8a1a', '#5fff8a'];
  for (let k = 0; k < 28; k++) { const i = (k * 5 + 3) % 120; const f = track.frames[i < 60 ? i : 640 + (i - 60) * 2]; const side = k % 2 ? 1 : -1; const p = f.p.clone().addScaledVector(f.side, side * (width / 2 + rnd(rng, 18, 30))); const gy = ground(p.x, p.z), y = gy + rnd(rng, 7, 14);
    const sign = makeTextPlane(neonTexts[k % neonTexts.length], { w: 7, h: 2, bg: '#121226', fg: neonCols[k % neonCols.length], emissive: true }); sign.material.emissiveIntensity = 0.7; sign.position.set(p.x, y, p.z); sign.rotation.y = Math.atan2(f.side.x, f.side.z) + (side > 0 ? Math.PI : 0); world.add(sign);
    const pole = new THREE.Mesh(G.cyl(0.15, 0.15, y - gy, 6), lampMat); pole.position.set(p.x, (y + gy) / 2 - 1, p.z); world.add(pole); }
  for (const im of [cherry, cherry2, jp, bamboo, bush, rock, lanternP, lanternS, house, ...bld]) world.add(im.finish());
  // nothing here moves: freeze the matrices
  world.traverse((o) => { o.updateMatrix(); o.matrixAutoUpdate = false; }); world.updateMatrixWorld(true);
  return { world, ground, track, water: WATER };
}
