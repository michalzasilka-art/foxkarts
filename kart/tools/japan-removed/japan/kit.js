// FoxKarts Maps prop kit (from the "FoxKarts Maps" artifact, 2026-11-05).
import * as THREE from 'three';
import { G, vcMat, Instancer, makeTextPlane, smoothstep } from './engine.js';
const flat = (opts = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0, ...opts });
export const FLAT = flat;
export const PIT_COLORS = [0xff8a1a, 0x5fc53a, 0x8d4fd6, 0xff4fa3, 0x2bb0e8];

// ---------- pit garages: slim two-storey pit boxes (7.6 m frontage x 14 m deep), orange trim throughout.
// Ground floor = open workshop bay: two-post car lift, workbench + pegboard, red lockers + red wardrobe, tyre stacks + tyre rack,
// rolling tool chest, compressor, oil drums, jack, extinguisher, pit board, strip lights. Upper floor = bar: counter with taps and stools,
// back bar with bottles and mirror, fridge, neon sign, pendants, behind a glass wall; in front an open terrace with tables, parasol,
// planters, string lights and an orange handrail over the pit lane. The garage colour marks the number plates, flag and roof/fascia stripes.
export const GARAGE = { W: 7.6, D: 14, H1: 4.0, SLAB: 0.5, H2: 3.4 };
const C = { orange: 0xff8a1a, orangeD: 0xd96d0a, white: 0xf4f5f8, navy: 0x2d2f6b, slate: 0x343a4c, graphite: 0x262a36, dark: 0x15171f, concrete: 0x9ea3b2, concreteD: 0x6f7484, wood: 0xb98a5a, woodD: 0x8a5a3a, red: 0xd8322a, redD: 0xa32319, chrome: 0xd4d8e6, yellow: 0xffc93a, blue: 0x2bb0e8, green: 0x3fae5a, glass: 0x9fd8ff };
const BOTTLES = [0xd98a2a, 0x3f8f4a, 0xcfe8ff, 0xb53a3a, 0x8d4fd6, 0xf2c14e];
export function buildGarage(num, col, { apron = 8.4 } = {}) {
  const { W, D, H1, SLAB, H2 } = GARAGE; const F = H1 + SLAB, RT = F + H2, bz = D / 2, gz = bz - 4.6; // F = bar floor, RT = roof underside, bz = front edge, gz = glass wall
  const g = new THREE.Group(); g.name = 'PitGarage' + num;
  const L = [], ML = [], GL = [], EW = [], EO = []; const M = G.M; // matte, metal, glass, emissive white, emissive warm
  const add = (geo, c, ...m) => L.push([geo, c, M(...m)]), addM = (geo, c, ...m) => ML.push([geo, c, M(...m)]), addG = (geo, ...m) => GL.push([geo, C.glass, M(...m)]);
  // ---- ground floor shell
  add(G.box(W, 1.6, D), C.concreteD, 0, -0.8, 0); add(G.box(W, 0.3, D), 0xb4b8c4, 0, 0.15, 0);
  add(G.box(3.9, 0.02, 7.4), 0x6a7080, 0, 0.31, 1.0); add(G.box(W - 0.9, 0.02, 0.3), C.orange, 0, 0.31, bz - 0.45);
  for (let k = 0; k < 7; k++) add(G.box(0.5, 0.02, 0.16), k & 1 ? C.dark : C.yellow, -3.0 + k * 1.0, 0.31, bz - 0.14);
  add(G.box(apron, 0.6, 6.2), C.concreteD, 0, -0.2, bz + 3.1); add(G.box(W - 0.6, 0.2, 0.7), C.concrete, 0, 0.2, bz + 0.35);
  const pbw = Math.min(apron - 1.0, 6.6);
  for (const s of [-1, 1]) add(G.box(0.16, 0.02, 5.2), C.orange, s * pbw / 2, 0.11, bz + 3.2);
  add(G.box(pbw, 0.02, 0.16), C.orange, 0, 0.11, bz + 5.8); add(G.box(pbw - 0.5, 0.02, 0.3), C.yellow, 0, 0.11, bz + 3.6);
  for (const s of [-1, 1]) {
    add(G.box(0.35, H1, D), C.white, s * (W / 2 - 0.175), H1 / 2, 0); add(G.box(0.06, 1.0, D - 1.2), C.graphite, s * (W / 2 - 0.38), 0.8, -0.3);
    add(G.box(0.5, H1, 0.5), C.orange, s * (W / 2 - 0.25), H1 / 2, bz - 0.25); add(G.box(0.14, H1 - 0.7, 0.14), C.orange, s * (W / 2 - 0.5), (H1 - 0.7) / 2 + 0.3, bz - 0.62);
    add(G.cyl(0.07, 0.07, RT + 0.4, 6), C.graphite, s * (W / 2 + 0.07), (RT + 0.4) / 2, -bz + 0.6);
    add(G.cyl(0.36, 0.36, 0.12, 10), C.orange, s * (W / 2 - 0.55), H1 - 0.85, bz - 0.7, 0, 0, Math.PI / 2);
  }
  add(G.box(W, H1, 0.35), C.slate, 0, H1 / 2, -bz + 0.175); add(G.box(W, 0.55, 0.45), C.orange, 0, H1 - 0.275, bz - 0.225);
  add(G.cyl(0.3, 0.3, W - 1.1, 10), C.graphite, 0, H1 - 0.85, bz - 0.7, 0, 0, Math.PI / 2);
  for (const z of [-4.2, 0, 4.0]) add(G.box(W - 0.7, 0.22, 0.22), C.graphite, 0, H1 - 0.11, z);
  add(G.box(W + 0.1, H1 - 0.2, 0.08), C.white, 0, H1 / 2 - 0.1, -bz - 0.04); add(G.box(W + 0.12, 0.3, 0.1), C.orange, 0, H1 - 0.35, -bz - 0.05);
  add(G.box(1.0, 2.2, 0.1), C.graphite, W / 2 - 1.5, 1.1, -bz - 0.06); add(G.box(1.5, 0.9, 0.06), C.orange, -W / 2 + 1.7, 2.6, -bz - 0.08); addG(G.box(1.36, 0.76, 0.04), -W / 2 + 1.7, 2.6, -bz - 0.11);
  for (const z of [-2.0, 2.6]) for (const s of [-1, 1]) EW.push([G.box(0.16, 0.08, 3.0), 0xffffff, M(s * 1.3, H1 - 0.3, z)]);
  for (const s of [-1, 1]) EW.push([G.cyl(0.12, 0.12, 0.03, 10), 0xffffff, M(s * 2.0, H1 - 0.02, bz + 0.6)]);
  // ---- workbench + pegboard (back wall)
  const wz = -bz + 0.78;
  add(G.box(4.3, 0.12, 0.8), C.wood, 1.0, 0.96, wz); add(G.box(4.3, 0.06, 0.06), C.woodD, 1.0, 0.93, wz + 0.4);
  for (const x of [-1.05, 3.05]) for (const z of [wz - 0.32, wz + 0.32]) add(G.box(0.08, 0.9, 0.08), C.graphite, x, 0.45, z);
  add(G.box(4.1, 0.05, 0.6), C.graphite, 1.0, 0.34, wz); add(G.box(1.5, 0.78, 0.7), C.orange, -0.2, 0.5, wz);
  for (const y of [0.37, 0.63]) add(G.box(1.42, 0.015, 0.02), C.dark, -0.2, y, wz + 0.355);
  for (const y of [0.24, 0.5, 0.76]) addM(G.box(0.5, 0.045, 0.04), C.chrome, -0.2, y, wz + 0.37);
  add(G.box(0.3, 0.22, 0.28), C.graphite, 2.6, 1.13, wz + 0.1); addM(G.cyl(0.035, 0.035, 0.55, 6), C.chrome, 2.6, 1.2, wz + 0.1, 0, 0, Math.PI / 2);
  add(G.box(0.62, 0.3, 0.3), C.red, 1.5, 1.17, wz - 0.05); add(G.box(0.3, 0.04, 0.04), C.dark, 1.5, 1.34, wz - 0.05);
  add(G.cyl(0.08, 0.08, 0.3, 8), C.yellow, 0.6, 1.17, wz - 0.1); add(G.box(0.26, 0.16, 0.26), C.blue, 0.2, 1.1, wz + 0.05);
  addM(G.cyl(0.03, 0.03, 0.45, 6), C.chrome, 2.0, 1.04, wz + 0.15, 0, 0.6, Math.PI / 2);
  add(G.box(4.2, 1.5, 0.06), 0xd9c9a3, 1.0, 2.15, -bz + 0.38);
  for (let k = 0; k < 6; k++) addM(G.box(0.07, 0.48, 0.03), C.chrome, 0.3 + k * 0.4, 2.1, -bz + 0.43);
  add(G.box(0.06, 0.45, 0.03), C.wood, 2.7, 2.05, -bz + 0.43); add(G.box(0.22, 0.1, 0.07), C.graphite, 2.7, 2.3, -bz + 0.44);
  for (let k = 0; k < 3; k++) { add(G.box(0.05, 0.14, 0.04), [C.red, C.yellow, C.blue][k], -0.95 + k * 0.17, 2.4, -bz + 0.43); addM(G.cyl(0.012, 0.012, 0.25, 5), C.chrome, -0.95 + k * 0.17, 2.2, -bz + 0.43); }
  add(new THREE.TorusGeometry(0.24, 0.045, 6, 12), C.orange, -0.2, 1.85, -bz + 0.45);
  add(G.box(1.1, 0.65, 0.06), C.dark, -2.3, 2.7, -bz + 0.39); add(G.box(1.0, 0.56, 0.015), 0x3a6fa8, -2.3, 2.7, -bz + 0.425);
  // ---- red lockers (left wall) + red wardrobe (right wall)
  const lx = -(W / 2 - 0.35) + 0.26;
  add(G.box(0.56, 0.12, 2.7), C.dark, lx, 0.36, -bz + 2.85);
  for (let k = 0; k < 4; k++) { const z = -bz + 1.85 + k * 0.66;
    add(G.box(0.52, 2.0, 0.64), C.red, lx, 1.42, z); add(G.box(0.015, 1.9, 0.02), C.redD, lx + 0.27, 1.42, z + 0.33);
    for (let v = 0; v < 3; v++) add(G.box(0.012, 0.025, 0.3), C.dark, lx + 0.265, 2.2 - v * 0.07, z);
    addM(G.box(0.03, 0.16, 0.035), C.chrome, lx + 0.28, 1.45, z + 0.2); add(G.box(0.012, 0.07, 0.3), C.white, lx + 0.265, 2.33, z); }
  const rx = (W / 2 - 0.35) - 0.31;
  add(G.box(0.62, 2.2, 1.3), C.red, rx, 1.4, -bz + 2.3); add(G.box(0.66, 0.08, 1.34), C.redD, rx, 2.54, -bz + 2.3); add(G.box(0.66, 0.1, 1.34), C.dark, rx, 0.35, -bz + 2.3);
  add(G.box(0.015, 2.0, 0.02), C.redD, rx - 0.31, 1.4, -bz + 2.3); for (const s of [-1, 1]) addM(G.box(0.03, 0.2, 0.035), C.chrome, rx - 0.33, 1.4, -bz + 2.3 + s * 0.1);
  // ---- tyres: stacks + rack
  const tyre = (x, y, z, stripe, up = false) => { const r = up ? [0, 0, Math.PI / 2] : [0, 0, 0];
    add(G.cyl(0.44, 0.44, 0.36, 14), C.dark, x, y, z, ...r); add(G.cyl(0.455, 0.455, 0.07, 14), stripe, x, y, z, ...r);
    addM(G.cyl(0.26, 0.26, 0.38, 10), C.chrome, x, y, z, ...r); add(G.cyl(0.1, 0.1, 0.4, 8), C.orange, x, y, z, ...r); };
  for (let k = 0; k < 5; k++) tyre(2.8, 0.48 + k * 0.36, bz - 1.8, C.red);
  for (let k = 0; k < 4; k++) tyre(-2.8, 0.48 + k * 0.36, bz - 2.0, C.yellow);
  for (let k = 0; k < 2; k++) tyre(-2.6, 0.48 + k * 0.36, -1.9, C.white);
  const rkx = W / 2 - 0.35 - 0.34;
  for (const z of [-3.9, -1.0]) add(G.box(0.08, 2.3, 0.08), C.graphite, rkx, 1.45, z);
  for (const y of [0.5, 1.4]) { add(G.box(0.64, 0.05, 2.9), C.graphite, rkx, y, -2.45); for (let k = 0; k < 3; k++) tyre(rkx, y + 0.48, -3.4 + k * 0.95, y > 1 ? C.blue : C.white, true); }
  // ---- two-post car lift
  const lz = 1.0, a = 0.6;
  for (const s of [-1, 1]) {
    add(G.box(1.0, 0.12, 1.1), C.graphite, s * 1.75, 0.36, lz); add(G.box(0.42, 3.1, 0.55), C.orange, s * 1.75, 1.97, lz); add(G.box(0.5, 0.12, 0.62), C.graphite, s * 1.75, 3.58, lz);
    add(G.box(0.6, 0.7, 0.62), C.graphite, s * 1.55, 1.25, lz);
    for (const d of [-1, 1]) { const th = s > 0 ? Math.PI + d * a : -d * a; const px = s * 1.25, dx = -s * Math.cos(a), dz = d * Math.sin(a);
      add(G.box(1.3, 0.12, 0.2), C.graphite, px + dx * 0.65, 0.95, lz + dz * 0.65, 0, th, 0);
      add(G.cyl(0.17, 0.17, 0.08, 8), C.dark, px + dx * 1.3, 1.04, lz + dz * 1.3); add(G.cyl(0.1, 0.1, 0.14, 8), C.orange, px + dx * 1.3, 1.13, lz + dz * 1.3); }
    for (let k = 0; k < 3; k++) add(G.box(0.14, 0.05, 0.3), k & 1 ? C.dark : C.yellow, s * 2.3, 0.33, lz - 0.3 + k * 0.3);
  }
  add(G.box(3.92, 0.22, 0.3), C.orange, 0, 3.72, lz); add(G.cyl(0.025, 0.025, 3.8, 5), C.dark, 0, 3.56, lz + 0.2, 0, 0, Math.PI / 2);
  add(G.box(0.3, 0.42, 0.16), C.graphite, -2.04, 1.6, lz); add(G.cyl(0.03, 0.03, 0.04, 6), C.green, -2.21, 1.68, lz - 0.08, 0, 0, Math.PI / 2); add(G.cyl(0.03, 0.03, 0.04, 6), C.red, -2.21, 1.68, lz + 0.08, 0, 0, Math.PI / 2);
  add(G.box(0.32, 0.5, 0.36), C.orangeD, -2.05, 2.5, lz); addM(G.cyl(0.1, 0.1, 0.25, 8), C.chrome, -2.05, 2.9, lz);
  // ---- loose props: tool chest, compressor, drums, extinguisher, jack, pit board
  add(G.box(0.95, 1.0, 0.56), C.red, 2.72, 0.93, -0.3); add(G.box(0.99, 0.06, 0.6), C.dark, 2.72, 1.46, -0.3);
  for (let k = 0; k < 4; k++) { add(G.box(0.9, 0.012, 0.02), C.dark, 2.72, 0.55 + k * 0.23, -0.01); addM(G.box(0.4, 0.04, 0.04), C.chrome, 2.72, 0.66 + k * 0.23, 0.0); }
  for (const x of [-1, 1]) for (const z of [-1, 1]) add(G.cyl(0.08, 0.08, 0.06, 8), C.dark, 2.72 + x * 0.38, 0.38, -0.3 + z * 0.2, 0, 0, Math.PI / 2);
  add(G.cyl(0.3, 0.3, 1.0, 10), C.orange, -2.7, 0.72, 2.4, Math.PI / 2, 0, 0); add(G.box(0.36, 0.3, 0.34), C.graphite, -2.7, 1.15, 2.2); addM(G.cyl(0.14, 0.14, 0.3, 8), C.chrome, -2.7, 1.15, 2.55, Math.PI / 2, 0, 0);
  for (const s of [-1, 1]) add(G.cyl(0.14, 0.14, 0.06, 8), C.dark, -2.7 + s * 0.3, 0.44, 2.8, 0, 0, Math.PI / 2); add(G.box(0.08, 0.6, 0.08), C.graphite, -2.7, 0.9, 1.75, 0.5, 0, 0); add(G.box(0.08, 0.4, 0.08), C.graphite, -2.7, 0.5, 1.95);
  for (const z of [-0.7, 0.05]) { add(G.cyl(0.31, 0.31, 0.9, 10), C.orange, -2.95, 0.75, z); for (const y of [0.5, 0.75, 1.0]) add(G.cyl(0.325, 0.325, 0.04, 10), C.graphite, -2.95, y, z); }
  add(G.cyl(0.09, 0.09, 0.55, 8), C.red, 3.3, 1.3, 4.0); add(G.cyl(0.05, 0.05, 0.1, 6), C.dark, 3.3, 1.62, 4.0); add(G.box(0.1, 0.06, 0.16), C.dark, 3.38, 1.3, 4.0);
  add(G.box(0.7, 0.12, 0.3), C.orange, 1.4, 0.36, 4.3, 0, 0.3, 0); addM(G.cyl(0.02, 0.02, 0.9, 5), C.chrome, 1.0, 0.65, 4.4, 0, 0.3, 1.2);
  add(G.box(0.9, 0.75, 0.05), C.white, -2.9, 0.72, bz - 1.4, -0.18, 0, 0); add(G.box(0.9, 0.22, 0.06), C.orange, -2.9, 0.72, bz - 1.4, -0.18, 0, 0);
  // ---- upper floor: slab, fascia, enclosure, glass wall, roof
  add(G.box(W + 0.6, SLAB, D + 1.4), C.white, 0, H1 + SLAB / 2, 0.4); add(G.box(W + 0.72, 0.34, D + 1.52), C.orange, 0, H1 + 0.33, 0.4); add(G.box(W + 0.74, 0.1, D + 1.54), col, 0, H1 + 0.08, 0.4);
  add(G.box(W, H2, 0.35), C.white, 0, F + H2 / 2, -bz + 0.175);
  for (const s of [-1, 1]) add(G.box(0.35, H2, gz + bz), C.white, s * (W / 2 - 0.175), F + H2 / 2, (gz - bz) / 2);
  addG(G.box(W - 0.7, H2 - 0.35, 0.08), 0, F + (H2 - 0.35) / 2 + 0.1, gz);
  add(G.box(W - 0.7, 0.14, 0.18), C.orange, 0, F + H2 - 0.2, gz); add(G.box(W - 0.7, 0.12, 0.2), C.orange, 0, F + 0.06, gz);
  for (const x of [-2.6, -1.15, 1.15, 2.6]) add(G.box(0.1, H2 - 0.3, 0.16), C.orange, x, F + H2 / 2, gz); addM(G.box(0.03, 0.9, 0.04), C.chrome, 0.95, F + 1.1, gz + 0.06);
  for (let k = 0; k < 8; k++) { const sw = (W - 0.8) / 8; add(G.box(sw, 0.05, 1.7), k & 1 ? C.white : C.orange, -(W - 0.8) / 2 + sw * (k + 0.5), F + H2 - 0.55, gz + 0.95, 0.22, 0, 0); }
  const rl = gz + bz + 1.2, rzc = (gz - bz) / 2 + 0.1;
  add(G.box(W + 1.0, 0.45, rl), C.navy, 0, RT + 0.225, rzc); add(G.box(W + 1.1, 0.22, rl + 0.1), C.orange, 0, RT - 0.05, rzc); add(G.box(W + 0.2, 0.12, rl - 0.8), col, 0, RT + 0.5, rzc);
  add(G.box(1.0, 0.6, 0.8), 0xb8bcc8, -1.6, RT + 0.75, -bz + 3.0); add(G.cyl(0.32, 0.32, 0.06, 12), C.graphite, -1.6, RT + 1.06, -bz + 3.0);
  add(G.cyl(0.12, 0.12, 0.9, 7), C.graphite, 1.8, RT + 0.9, -bz + 1.6); add(G.cyl(0.18, 0.18, 0.1, 7), C.graphite, 1.8, RT + 1.38, -bz + 1.6);
  addM(G.cyl(0.05, 0.05, 3.4, 6), C.chrome, W / 2 - 0.7, RT + 2.1, -bz + 1.2); add(G.box(1.5, 0.9, 0.05), col, W / 2 - 0.7 + 0.78, RT + 3.3, -bz + 1.2);
  add(G.box(1.7, 1.7, 0.08), C.orange, 0, RT + 1.35, gz + 0.5); add(G.box(0.1, 0.5, 0.1), C.graphite, 0, RT + 0.6, gz + 0.3);
  // ---- terrace: deck, railing, tables, parasol, planters, string lights
  add(G.box(W - 0.8, 0.04, bz - gz + 0.9), C.wood, 0, F + 0.02, (gz + bz + 1.0) / 2);
  for (let k = 0; k < 7; k++) add(G.box(0.02, 0.045, bz - gz + 0.9), C.woodD, -(W - 0.8) / 2 + (k + 0.5) * (W - 0.8) / 7, F + 0.02, (gz + bz + 1.0) / 2);
  const rail = (x0, z0, x1, z1, n) => { for (let k = 0; k <= n; k++) { const t = k / n; addM(G.cyl(0.035, 0.035, 1.05, 6), C.chrome, x0 + (x1 - x0) * t, F + 0.525, z0 + (z1 - z0) * t); }
    const len = Math.hypot(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ry = Math.atan2(x1 - x0, z1 - z0);
    add(G.box(0.1, 0.08, len + 0.1), C.orange, cx, F + 1.08, cz, 0, ry, 0); addM(G.box(0.03, 0.03, len), C.chrome, cx, F + 0.55, cz, 0, ry, 0); addG(G.box(0.025, 0.72, len - 0.1), cx, F + 0.6, cz, 0, ry, 0); };
  rail(-W / 2 + 0.12, bz + 0.95, W / 2 - 0.12, bz + 0.95, 7); rail(-W / 2 + 0.12, gz + 0.1, -W / 2 + 0.12, bz + 0.95, 5); rail(W / 2 - 0.12, gz + 0.1, W / 2 - 0.12, bz + 0.95, 5);
  const stool = (x, z, h = 0.78) => { add(G.cyl(0.24, 0.27, 0.04, 10), C.graphite, x, F + 0.02, z); addM(G.cyl(0.028, 0.028, h - 0.08, 6), C.chrome, x, F + h / 2, z); addM(new THREE.TorusGeometry(0.16, 0.014, 5, 12), C.chrome, x, F + 0.28, z, Math.PI / 2, 0, 0); add(G.cyl(0.2, 0.22, 0.1, 12), C.orange, x, F + h, z); };
  const table = (x, z, parasol) => { add(G.cyl(0.5, 0.5, 0.06, 12), C.wood, x, F + 1.02, z); addM(G.cyl(0.035, 0.035, 0.98, 6), C.chrome, x, F + 0.5, z); add(G.cyl(0.3, 0.32, 0.04, 10), C.graphite, x, F + 0.02, z); for (const s of [-1, 1]) stool(x + s * 0.75, z + 0.1);
    if (parasol) { addM(G.cyl(0.03, 0.03, 2.4, 6), C.chrome, x, F + 1.2, z); add(G.cone(1.25, 0.5, 8), C.orange, x, F + 2.45, z); add(G.cone(1.28, 0.1, 8), C.white, x, F + 2.24, z); add(G.sphere(0.06, 6), C.orange, x, F + 2.72, z); } };
  table(-1.85, bz - 1.6, false); table(1.85, bz - 1.6, true);
  for (const s of [-1, 1]) { add(G.box(0.9, 0.42, 0.42), C.graphite, s * (W / 2 - 0.75), F + 0.23, bz + 0.55); add(G.ico(0.38, 1), C.green, s * (W / 2 - 0.95), F + 0.65, bz + 0.55); add(G.ico(0.3, 1), 0x58c46a, s * (W / 2 - 0.55), F + 0.6, bz + 0.5); }
  add(G.box(W - 0.8, 0.012, 0.012), C.dark, 0, F + 1.32, bz + 1.0); for (let k = 0; k < 9; k++) EO.push([G.sphere(0.055, 6), 0xffd9a0, M(-W / 2 + 0.4 + k * (W - 0.8) / 8, F + 1.22 - (k & 1) * 0.06, bz + 1.0)]);
  // ---- bar interior
  const cz = -bz + 2.9;
  add(G.box(5.2, 1.05, 0.65), C.orange, 0, F + 0.525, cz); add(G.box(5.5, 0.1, 0.95), C.wood, 0, F + 1.1, cz); add(G.box(5.5, 0.06, 0.06), C.woodD, 0, F + 1.06, cz + 0.47);
  for (let k = 0; k < 11; k++) add(G.box(0.06, 0.9, 0.02), C.woodD, -2.4 + k * 0.48, F + 0.5, cz + 0.335);
  addM(G.cyl(0.03, 0.03, 5.0, 6), C.chrome, 0, F + 0.25, cz + 0.45, 0, 0, Math.PI / 2);
  for (let k = 0; k < 3; k++) { const x = -0.6 + k * 0.6; addM(G.cyl(0.045, 0.045, 0.34, 8), C.chrome, x, F + 1.32, cz - 0.1); add(G.box(0.05, 0.2, 0.05), [C.orange, C.red, C.blue][k], x, F + 1.57, cz - 0.1, 0.3, 0, 0); addM(G.cyl(0.035, 0.012, 0.12, 6), C.chrome, x, F + 1.45, cz + 0.0, Math.PI / 2, 0, 0); }
  addM(G.box(1.7, 0.03, 0.26), C.chrome, 0, F + 1.165, cz + 0.12);
  for (const [x, z] of [[-2.0, 0.1], [-1.5, -0.2], [1.6, 0.15], [2.2, -0.1], [1.1, 0.25]]) add(G.cyl(0.05, 0.04, 0.15, 6), 0xcfe8ff, x, F + 1.225, cz + z);
  add(G.cyl(0.22, 0.18, 0.1, 8), C.graphite, -2.3, F + 1.2, cz - 0.15); for (let k = 0; k < 4; k++) add(G.sphere(0.05, 5), [C.orange, C.yellow, C.green, C.red][k], -2.3 + (k - 1.5) * 0.08, F + 1.28, cz - 0.15 + (k & 1) * 0.06);
  for (let k = 0; k < 4; k++) stool(-1.8 + k * 1.2, cz + 1.05);
  add(G.box(5.4, 0.9, 0.55), C.graphite, 0, F + 0.45, -bz + 0.65); add(G.box(5.5, 0.08, 0.65), C.wood, 0, F + 0.94, -bz + 0.65);
  addM(G.box(5.0, 1.5, 0.03), 0xbfd9e8, 0, F + 2.0, -bz + 0.37);
  for (const y of [1.55, 2.2]) { add(G.box(5.0, 0.06, 0.32), C.wood, 0, F + y, -bz + 0.55); for (let k = 0; k < 11; k++) { const c = BOTTLES[(k + (y > 2 ? 2 : 0)) % BOTTLES.length]; add(G.cyl(0.055, 0.055, 0.3, 6), c, -2.2 + k * 0.44, F + y + 0.18, -bz + 0.55); add(G.cyl(0.02, 0.02, 0.12, 5), c, -2.2 + k * 0.44, F + y + 0.39, -bz + 0.55); } }
  add(G.box(0.8, 1.85, 0.62), C.graphite, 2.9, F + 0.925, -bz + 0.75); addG(G.box(0.62, 1.4, 0.02), 2.9, F + 1.05, -bz + 1.07);
  for (let k = 0; k < 6; k++) add(G.cyl(0.05, 0.05, 0.14, 6), [C.orange, C.blue, C.green, C.red, C.yellow, C.white][k], 2.72 + (k % 3) * 0.18, F + 0.55 + Math.floor(k / 3) * 0.5, -bz + 0.85);
  add(G.box(0.06, 0.8, 1.4), C.dark, -(W / 2 - 0.35) + 0.03, F + 2.2, -bz + 5.5); add(G.box(0.015, 0.7, 1.3), 0x3a6fa8, -(W / 2 - 0.35) + 0.07, F + 2.2, -bz + 5.5);
  for (const x of [-1.5, 0, 1.5]) { add(G.cyl(0.012, 0.012, 1.0, 4), C.dark, x, RT - 0.5, cz); add(G.cone(0.28, 0.32, 8), C.orange, x, RT - 1.1, cz); EO.push([G.sphere(0.07, 6), 0xffe0b0, M(x, RT - 1.24, cz)]); }
  // ---- number plates, wordmark, neon, lights
  add(G.box(0.08, 0.55, 0.08), C.graphite, -W / 2 + 1.1, H1 - 0.28, bz + 0.6); add(G.box(1.4, 1.4, 0.08), C.orange, -W / 2 + 1.1, H1 - 1.25, bz + 0.6);
  const hex = '#' + col.getHexString();
  const plate = makeTextPlane(String(num), { w: 1.2, h: 1.2, bg: hex, fg: '#ffffff', emissive: true }); plate.position.set(-W / 2 + 1.1, H1 - 1.25, bz + 0.66); plate.userData.neon = true; g.add(plate);
  const roofNum = makeTextPlane(String(num), { w: 1.5, h: 1.5, bg: hex, fg: '#ffffff', emissive: true }); roofNum.position.set(0, RT + 1.35, gz + 0.56); roofNum.userData.neon = true; g.add(roofNum);
  const mark = makeTextPlane('FOXKARTS', { w: 2.4, h: 0.3, bg: '#ff8a1a', fg: '#1a0d04', double: false, emissive: true }); mark.position.set(W / 2 - 1.6, H1 + 0.33, bz + 1.17); mark.userData.neon = true; g.add(mark);
  const neon = makeTextPlane('BAR', { w: 2.0, h: 0.8, bg: '#121226', fg: '#ff8a1a', emissive: true, double: false }); neon.position.set(0, F + 2.9, -bz + 0.4); neon.userData.neon = true; g.add(neon);
  const bayLight = new THREE.PointLight(0xffe2b8, 12, 16, 2); bayLight.position.set(0, H1 - 0.5, 1.5); bayLight.userData.lamp = 40; bayLight.userData.lampDay = 12; g.add(bayLight);
  const barLight = new THREE.PointLight(0xffc890, 0, 12, 2); barLight.position.set(0, RT - 0.8, cz + 1.5); barLight.userData.lamp = 25; g.add(barLight);
  // ---- merge into a handful of meshes
  const matte = new THREE.Mesh(G.merge(L), FLAT()); matte.castShadow = true; matte.receiveShadow = true; g.add(matte);
  const metal = new THREE.Mesh(G.merge(ML), FLAT({ metalness: 0.8, roughness: 0.3 })); metal.castShadow = true; g.add(metal);
  g.add(new THREE.Mesh(G.merge(GL), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.25, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide })));
  const ew = new THREE.Mesh(G.merge(EW), new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xfff1d6, emissiveIntensity: 1.5, roughness: 0.5 })); ew.userData.neon = true; g.add(ew);
  const eo = new THREE.Mesh(G.merge(EO), new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffb060, emissiveIntensity: 1.8, roughness: 0.5 })); eo.userData.neon = true; g.add(eo);
  return g;
}
// Row of pit garages on the inside of a straight. `back` = distance from the track edge to the garage centre line; `gap` = spacing between garage centres (snapped to track samples).
export function buildPitGarages(track, startIndex, { count = 5, side = -1, back = 16, gap = 9 } = {}) {
  const grp = new THREE.Group(); grp.name = 'PitGarages'; const n = track.pts.length; const step = track.length / n; const per = Math.max(1, Math.round(gap / step)); const info = [];
  for (let b = 0; b < count; b++) {
    const i = (startIndex + (b - (count - 1) / 2) * per + n) % n; const f = track.frames[Math.round(i)]; const col = new THREE.Color(PIT_COLORS[b % PIT_COLORS.length]);
    const centre = f.p.clone().addScaledVector(f.side, side * (track.width / 2 + back));
    const g = buildGarage(b + 1, col, { apron: per * step - 0.2 }); g.position.copy(centre); g.lookAt(centre.clone().add(f.side.clone().multiplyScalar(-side))); // bay faces the track
    grp.add(g); info.push({ pos: centre.clone(), dir: f.t.clone(), color: '#' + col.getHexString(), number: b + 1, footprint: [GARAGE.W, GARAGE.D] });
  }
  grp.userData.export = info; return grp;
}
// ---------- coral canopy over the start straight (like the Alps start/finish)
export function buildCanopy(track, index, { color = 0xf2876d, length = 46 } = {}) {
  const f = track.frames[index]; const grp = new THREE.Group(); grp.position.copy(f.p); grp.lookAt(f.p.clone().add(f.t)); grp.name = 'StartCanopy';
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 }); const post = new THREE.MeshStandardMaterial({ color: 0xd9452b, roughness: 0.6 });
  const w = track.width + 10;
  const roof = new THREE.Mesh(G.box(w, 0.5, length), mat); roof.position.set(0, 8.2, 0); roof.rotation.z = 0.05; grp.add(roof);
  const roof2 = new THREE.Mesh(G.box(w * 0.55, 0.5, length * 0.7), mat); roof2.position.set(w * 0.35, 9.6, -2); roof2.rotation.z = -0.06; grp.add(roof2);
  for (const [x, z] of [[-w / 2 + 0.6, -length / 2 + 2], [-w / 2 + 0.6, length / 2 - 2], [w / 2 - 0.6, -length / 2 + 2], [w / 2 - 0.6, length / 2 - 2], [-w / 2 + 0.6, 0], [w / 2 - 0.6, 0]]) { const p = new THREE.Mesh(G.cyl(0.25, 0.25, 8.4, 8), post); p.position.set(x, 4.2, z); grp.add(p); }
  // white service building under the outer side
  const bld = new THREE.Mesh(G.box(6, 3.2, length * 0.6), new THREE.MeshStandardMaterial({ color: 0xf4f5f8 })); bld.position.set(-w / 2 - 2, 1.6, 2); grp.add(bld);
  // chequered line
  const n = 16; const cg = new THREE.PlaneGeometry(track.width, 2.2, n, 2).rotateX(-Math.PI / 2); const cc = new Float32Array(cg.attributes.position.count * 3);
  for (let i = 0; i < cg.attributes.position.count; i++) { const px = cg.attributes.position.getX(i), pz = cg.attributes.position.getZ(i); const ix = Math.floor((px / track.width + 0.5) * n), iz = pz > 0 ? 1 : 0; const v = (ix + iz) & 1 ? 1 : 0.1; cc[i * 3] = cc[i * 3 + 1] = cc[i * 3 + 2] = v; }
  cg.setAttribute('color', new THREE.BufferAttribute(cc, 3)); const line = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })); line.position.y = 0.06; grp.add(line);
  return grp;
}
// ---------- red/white barriers with sponsor boards along both edges
export function buildBarriers(track, { every = 2, offset = 1.6, stripe = [0xe8402a, 0xffffff], boards = true, skip = () => false, skipSide = () => false } = {}) {
  const n = track.pts.length; const grp = new THREE.Group(); grp.name = 'Barriers';
  const seg = new Instancer(G.box(1.0, 1.1, 2.6), new THREE.MeshStandardMaterial({ roughness: 0.8 }), Math.ceil(n / every) * 2 + 8);
  const board = boards ? new Instancer(G.box(0.08, 0.9, 2.4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), Math.ceil(n / every) * 2 + 8) : null;
  const cA = new THREE.Color(stripe[0]), cB = new THREE.Color(stripe[1]);
  for (let i = 0; i < n; i += every) {
    if (skip(i)) continue; const f = track.frames[i]; const rotY = Math.atan2(f.t.x, f.t.z);
    for (const s of [-1, 1]) { if (skipSide(i, s)) continue; const p = f.p.clone().addScaledVector(f.side, s * (track.width / 2 + offset)); seg.add(p.x, p.y + 0.55, p.z, { rotY, color: ((i / every) & 1) ? cA : cB }); if (board && ((i / every) % 3 === 0)) board.add(p.x + f.side.x * s * 0.55, p.y + 1.55, p.z + f.side.z * s * 0.55, { rotY }); }
  }
  grp.add(seg.finish()); if (board) grp.add(board.finish()); return grp;
}
// ---------- light poles (lamp at night)
export function lampPost(scene, x, y, z, color = 0xfff0c8) {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0x2a2d3a, roughness: 0.6 });
  const pole = new THREE.Mesh(G.cyl(0.12, 0.16, 7, 6), m); pole.position.y = 3.5; g.add(pole); const arm = new THREE.Mesh(G.box(2.2, 0.15, 0.15), m); arm.position.set(1, 6.9, 0); g.add(arm);
  const head = new THREE.Mesh(G.box(0.9, 0.2, 0.5), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 1.8 })); head.position.set(2, 6.85, 0); g.add(head);
  const light = new THREE.PointLight(color, 0, 26, 2); light.position.set(2, 6.6, 0); light.userData.lamp = 60; g.add(light);
  g.position.set(x, y, z); scene.add(g); return g;
}
// ---------- low-poly trees / props as merged vertex-coloured geometries
export const Kit = {
  pine(colA = 0x3fae5a, colB = 0x2f8f49, trunk = 0x7a4a2a, snow = null) {
    const list = [[G.cyl(0.25, 0.35, 2.2, 6), trunk, G.M(0, 1.1, 0)], [G.cone(2.2, 3.2, 7), colA, G.M(0, 3.4, 0)], [G.cone(1.7, 2.8, 7), colB, G.M(0, 5.3, 0)], [G.cone(1.1, 2.4, 7), colA, G.M(0, 7.0, 0)]];
    if (snow) list.push([G.cone(1.15, 0.6, 7), snow, G.M(0, 8.0, 0)], [G.cone(1.75, 0.6, 7), snow, G.M(0, 6.3, 0)], [G.cone(2.25, 0.7, 7), snow, G.M(0, 4.6, 0)]);
    return G.merge(list);
  },
  cherry(bloom = 0xffa7cc, bloom2 = 0xff7fb5, trunk = 0x5a3a2a) {
    return G.merge([[G.cyl(0.22, 0.32, 2.4, 6), trunk, G.M(0, 1.2, 0)], [G.cyl(0.12, 0.16, 1.4, 5), trunk, G.M(0.6, 2.7, 0.2, 0, 0, -0.6)], [G.cyl(0.12, 0.16, 1.4, 5), trunk, G.M(-0.5, 2.7, -0.3, 0.5, 0, 0.6)],
      [G.ico(1.9, 1), bloom, G.M(0, 3.9, 0)], [G.ico(1.4, 1), bloom2, G.M(1.3, 3.4, 0.4)], [G.ico(1.3, 1), bloom, G.M(-1.2, 3.5, -0.6)], [G.ico(1.1, 1), bloom2, G.M(0.2, 4.9, -0.8)], [G.ico(1.0, 1), bloom, G.M(-0.4, 4.6, 1.0)]]);
  },
  jpine(col = 0x2f8f49, trunk = 0x6b4a2a) { // Japanese black pine: tiered flat pads
    return G.merge([[G.cyl(0.25, 0.4, 3.5, 6), trunk, G.M(0, 1.75, 0, 0, 0, 0.12)], [G.cyl(0.3, 2.4, 0.9, 7), col, G.M(0.5, 2.6, 0)], [G.cyl(0.3, 1.9, 0.8, 7), col, G.M(-0.6, 3.6, 0.3)], [G.cyl(0.2, 1.4, 0.7, 7), col, G.M(0.3, 4.4, -0.2)]]);
  },
  bamboo(col = 0x8cc84b) { const l = []; for (let k = 0; k < 5; k++) { const a = k * 1.3; l.push([G.cyl(0.08, 0.1, 6 + (k % 3), 5), col, G.M(Math.cos(a) * 0.5, 3 + (k % 3) / 2, Math.sin(a) * 0.5, 0.05 * Math.cos(a), 0, 0.05 * Math.sin(a))]); l.push([G.ico(0.5, 0), 0x6fb53a, G.M(Math.cos(a) * 0.6, 6.2 + (k % 3), Math.sin(a) * 0.6)]); } return G.merge(l); },
  palm(leaf = 0x3fb24a, trunk = 0x9a6b3a) { const l = [[G.cyl(0.22, 0.34, 7, 6), trunk, G.M(0.3, 3.5, 0, 0, 0, -0.08)]]; for (let k = 0; k < 7; k++) { const a = k * Math.PI * 2 / 7; l.push([G.box(0.5, 0.08, 3.6), leaf, G.M(0.6 + Math.cos(a) * 1.6, 7.0 - 0.3 * k % 2, Math.sin(a) * 1.6, 0.0, -a + Math.PI / 2, 0.55)]); } l.push([G.sphere(0.5, 6), 0x7a4a2a, G.M(0.6, 6.9, 0)]); return G.merge(l); },
  broadleaf(a = 0x2e8b3d, b = 0x3fae5a, trunk = 0x6b4a2a) { return G.merge([[G.cyl(0.35, 0.5, 4, 7), trunk, G.M(0, 2, 0)], [G.ico(3.0, 1), a, G.M(0, 6.2, 0)], [G.ico(2.2, 1), b, G.M(2.2, 5.4, 0.6)], [G.ico(2.0, 1), b, G.M(-2.0, 5.6, -0.8)], [G.ico(1.8, 1), a, G.M(0.3, 8.2, -0.5)]]); },
  giantTree(a = 0x2b7f3a, b = 0x46a85a, trunk = 0x5a3a24) { return G.merge([[G.cyl(1.8, 2.8, 14, 9), trunk, G.M(0, 7, 0)], [G.cyl(0.6, 1.0, 9, 6), trunk, G.M(3.5, 12, 1, 0, 0, -0.5)], [G.cyl(0.6, 1.0, 9, 6), trunk, G.M(-3.2, 12, -1.5, 0.4, 0, 0.5)], [G.ico(9, 1), a, G.M(0, 18, 0)], [G.ico(6, 1), b, G.M(7, 15, 2)], [G.ico(6, 1), b, G.M(-6.5, 15.5, -3)], [G.ico(5, 1), a, G.M(1, 23, -2)], [G.ico(4.5, 1), b, G.M(-2, 21, 5)]]); },
  fern(col = 0x4fc35e) { const l = []; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; l.push([G.box(0.25, 0.05, 1.6), col, G.M(Math.cos(a) * 0.6, 0.5, Math.sin(a) * 0.6, 0, -a + Math.PI / 2, 0.5)]); } return G.merge(l); },
  bush(col = 0x3fae5a) { return G.merge([[G.ico(1.1, 1), col, G.M(0, 0.8, 0)], [G.ico(0.8, 1), col, G.M(0.9, 0.6, 0.3)], [G.ico(0.7, 1), col, G.M(-0.7, 0.6, -0.4)]]); },
  rock(col = 0x8d8f99) { return G.merge([[G.ico(1.4, 0), col, G.M(0, 0.8, 0, 0.3, 0.2, 0.1, 1)], [G.ico(0.9, 0), col, G.M(1.2, 0.5, 0.4, 0.5, 0.8, 0)]]); },
  torii(red = 0xd9341f, cap = 0x1b1b24) { return G.merge([[G.cyl(0.35, 0.42, 8, 8), red, G.M(-3.2, 4, 0, 0, 0, -0.04)], [G.cyl(0.35, 0.42, 8, 8), red, G.M(3.2, 4, 0, 0, 0, 0.04)], [G.box(9.6, 0.7, 0.9), cap, G.M(0, 8.4, 0)], [G.box(10.4, 0.5, 0.8), red, G.M(0, 7.8, 0)], [G.box(7.8, 0.5, 0.6), red, G.M(0, 6.4, 0)], [G.box(0.5, 1.2, 0.5), red, G.M(0, 7.1, 0)]]); },
  lanternStone(col = 0x9a9ca8) { return G.merge([[G.box(1.2, 0.4, 1.2), col, G.M(0, 0.2, 0)], [G.cyl(0.22, 0.3, 1.6, 6), col, G.M(0, 1.2, 0)], [G.box(1.0, 0.8, 1.0), 0xc9b78a, G.M(0, 2.4, 0)], [G.cone(1.1, 0.8, 4), col, G.M(0, 3.2, 0, 0, Math.PI / 4, 0)]]); },
  lanternPaper(col = 0xff8c3a) { return G.merge([[G.cyl(0.05, 0.05, 2.6, 5), 0x3a2a1a, G.M(0, 1.3, 0)], [G.sphere(0.5, 8), col, G.M(0, 2.6, 0)], [G.cyl(0.2, 0.2, 0.15, 8), 0x3a2a1a, G.M(0, 3.1, 0)]]); },
  house(wall = 0xf2e9d8, roof = 0x5a3a3a, trimc = 0x8a5a3a) { return G.merge([[G.box(8, 3.6, 7), wall, G.M(0, 1.8, 0)], [G.box(9.4, 0.5, 8.4), roof, G.M(0, 3.8, 0)], [G.cone(6.6, 2.6, 4), roof, G.M(0, 5.2, 0, 0, Math.PI / 4, 0)], [G.box(8.2, 0.4, 7.2), trimc, G.M(0, 0.2, 0)], [G.box(2.2, 2.2, 0.2), 0x3a2a24, G.M(0, 1.2, 3.55)]]); },
  pagoda(red = 0xb5302a, roof = 0x2a2a38) { const l = [[G.box(6, 1, 6), 0x9a9ca8, G.M(0, 0.5, 0)]]; for (let k = 0; k < 3; k++) { const s = 1 - k * 0.2, y = 1 + k * 4.2; l.push([G.box(4.6 * s, 3.4, 4.6 * s), red, G.M(0, y + 1.7, 0)], [G.cone(5.2 * s, 1.6, 4), roof, G.M(0, y + 4.0, 0, 0, Math.PI / 4, 0)]); } l.push([G.cyl(0.15, 0.15, 3, 6), 0xd9a441, G.M(0, 15, 0)]); return G.merge(l); },
  townBuilding(wall, accent, floors = 3) { const l = [[G.box(10, floors * 3.4, 10), wall, G.M(0, floors * 1.7, 0)], [G.box(10.6, 0.5, 10.6), accent, G.M(0, floors * 3.4 + 0.2, 0)]]; for (let f = 0; f < floors; f++) for (let w = -1; w <= 1; w++) l.push([G.box(1.6, 1.4, 0.2), 0x9fd8ff, G.M(w * 3.0, 1.9 + f * 3.4, 5.05)]); l.push([G.box(4, 0.4, 10.8), accent, G.M(0, floors * 3.4 - 0.1, 0)]); return G.merge(l); },
  ruinPillar(col = 0xa7a89a, moss = 0x4e8a3a) { return G.merge([[G.box(2.2, 0.6, 2.2), col, G.M(0, 0.3, 0)], [G.cyl(0.7, 0.85, 6.5, 7), col, G.M(0, 3.8, 0)], [G.box(2.0, 0.7, 2.0), col, G.M(0, 7.4, 0)], [G.ico(0.9, 0), moss, G.M(0.6, 1.1, 0.5)], [G.ico(0.6, 0), moss, G.M(-0.5, 5.5, 0.4)]]); },
  ruinBlock(col = 0xa7a89a, moss = 0x4e8a3a) { return G.merge([[G.box(3, 1.6, 2), col, G.M(0, 0.8, 0, 0, 0.3, 0)], [G.box(2, 1.2, 1.6), col, G.M(0.8, 2.1, 0.3, 0, -0.4, 0.1)], [G.ico(0.7, 0), moss, G.M(-0.8, 1.7, 0.5)]]); },
  tiki(wood = 0x6b4a2a) { return G.merge([[G.cyl(0.1, 0.14, 3, 5), wood, G.M(0, 1.5, 0)], [G.cyl(0.35, 0.25, 0.8, 6), 0x3a2a1a, G.M(0, 3.2, 0)], [G.ico(0.4, 0), 0xff9a2a, G.M(0, 3.9, 0)]]); },
  mushroom(cap = 0xff5a3a) { return G.merge([[G.cyl(0.25, 0.35, 1.2, 6), 0xf2e6c8, G.M(0, 0.6, 0)], [G.sphere(0.9, 8), cap, G.M(0, 1.3, 0, 0, 0, 0, 1)], [G.sphere(0.18, 5), 0xffffff, G.M(0.4, 1.9, 0.3)], [G.sphere(0.14, 5), 0xffffff, G.M(-0.4, 1.8, -0.2)]]); },
  mountain(base = 0x7fa38a, snow = 0xf4f7fb, r = 320, h = 260, snowLine = 0.62) { return G.merge([[G.cone(r, h, 7), base, G.M(0, h / 2, 0)], [G.cone(r * (1 - snowLine) * 1.02, h * (1 - snowLine) + 2, 7), snow, G.M(0, h * snowLine + (h * (1 - snowLine)) / 2, 0)]]); },
  fuji() { const l = [[G.cone(900, 520, 9), 0x6b7fb0, G.M(0, 260, 0)], [G.cone(900 * 0.42, 520 * 0.42 + 4, 9), 0xf6f8fc, G.M(0, 520 * 0.58 + (520 * 0.42) / 2, 0)]]; return G.merge(l); },
  cloud() { return G.merge([[G.ico(10, 1), 0xffffff, G.M(0, 0, 0, 0, 0, 0, 1)], [G.ico(7, 1), 0xffffff, G.M(9, -1, 2)], [G.ico(6.5, 1), 0xffffff, G.M(-8, -2, -1)], [G.ico(5, 1), 0xffffff, G.M(2, 4, -3)]]); },
};
// ---------- Japanese temple architecture (Chureito-style five-storey pagoda, Horyu-ji-style two-tier hall)
// Curved hip roof: 4 faces, concave sweep from ridge to eave, corners kick up. rev=true builds the underside (eave ceiling).
export function hipRoof({ W, D, H, over = 1.8, drop = 1.0, lift = 0.7, p = 1.9, nu = 8, nv = 6 }, rev = false) {
  const pos = [], idx = []; const half = Math.abs(W - D) / 2, alongX = W >= D;
  const face = (axis, sign) => {
    const span = axis === 'z' ? W : D, depth = axis === 'z' ? D : W; const rh = axis === 'z' ? (alongX ? half : 0) : (alongX ? 0 : half); const base = pos.length / 3;
    for (let j = 0; j <= nv; j++) { const v = j / nv, g = 1 - Math.pow(1 - v, p); for (let i = 0; i <= nu; i++) { const u = i / nu * 2 - 1; const ex = u * (span / 2 + over), ez = depth / 2 + over, ey = -drop + lift * Math.pow(Math.abs(u), 4); const x = u * rh + (ex - u * rh) * v, z = ez * v, y = H + (ey - H) * g; if (axis === 'z') pos.push(x, y, sign * z); else pos.push(sign * z, y, x); } }
    const out = ((axis === 'z') === (sign > 0)) !== rev;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = base + j * (nu + 1) + i, b = a + nu + 1; if (out) idx.push(a, b, a + 1, a + 1, b, b + 1); else idx.push(a, a + 1, b, a + 1, b + 1, b); }
  };
  face('z', 1); face('z', -1); face('x', 1); face('x', -1);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const ring4 = (w, d) => [[0, 1, w, d], [0, -1, w, d], [1, 0, w, d], [-1, 0, w, d]];
// bracket blocks (tokyo) under an eave, n per side
function brackets(L, w, d, y, col, n = 5, size = 0.9) { for (const [sx, sz] of ring4()) for (let k = 0; k < n; k++) { const o = n === 1 ? 0 : -0.82 + k * (1.64 / (n - 1)); const ox = sz ? o * w / 2 : sx * (w / 2 + 0.25), oz = sx ? o * d / 2 : sz * (d / 2 + 0.25); L.push([G.box(sz ? size * 0.55 : size, 0.45, sx ? size * 0.55 : size), col, G.M(ox, y, oz)]); } }
// balcony railing around a slab of half-size rx/rz
function railing(L, rx, rz, y, post, rail, lattice) { const nx = Math.max(3, Math.round(rx / 1.1)), nz = Math.max(3, Math.round(rz / 1.1));
  for (let i = 0; i <= nx; i++) { const t = -rx + i * (2 * rx / nx); for (const s of [-1, 1]) L.push([G.box(0.14, 0.95, 0.14), post, G.M(t, y + 0.47, s * rz)]); }
  for (let i = 0; i <= nz; i++) { const t = -rz + i * (2 * rz / nz); for (const s of [-1, 1]) L.push([G.box(0.14, 0.95, 0.14), post, G.M(s * rx, y + 0.47, t)]); }
  for (const [sx, sz] of ring4()) { const lx = sz ? 2 * rx : 0.12, lz = sx ? 2 * rz : 0.12; L.push([G.box(lx, 0.11, lz), rail, G.M(sx * rx, y + 0.95, sz * rz)], [G.box(lx, 0.09, lz), rail, G.M(sx * rx, y + 0.5, sz * rz)], [G.box(sz ? 2 * rx : 0.05, 0.3, sx ? 2 * rz : 0.05), lattice, G.M(sx * rx, y + 0.2, sz * rz)]); } }
function sorin(L, y, { bronze = 0x4f5346, gold = 0xe6b73d }) { // finial: bowl, pole, nine rings, water-flame, jewel
  L.push([G.sphere(1.0, 10), bronze, G.M(0, y + 0.1, 0)], [G.cyl(0.13, 0.17, 8.2, 8), bronze, G.M(0, y + 4.1, 0)]);
  for (let i = 0; i < 9; i++) L.push([G.cyl(0.62 - i * 0.03, 0.62 - i * 0.03, 0.13, 14), bronze, G.M(0, y + 1.5 + i * 0.58, 0)], [G.cyl(0.3, 0.3, 0.2, 8), gold, G.M(0, y + 1.79 + i * 0.58, 0)]);
  L.push([G.cone(0.55, 1.2, 6), gold, G.M(0, y + 7.1, 0)], [G.sphere(0.36, 8), gold, G.M(0, y + 8.3, 0)]);
}
// battered stone base (ishigaki): a 4-sided frustum, wider at the bottom, so buildings on slopes stand on a terrace wall rather than float
const foundation = (L, w, d, col = 0x8f8b80) => { const g = G.cyl(Math.SQRT2, Math.SQRT2 * 1.35, 9, 4).rotateY(Math.PI / 4); const m = new THREE.Matrix4().compose(new THREE.Vector3(0, -4.5, 0), new THREE.Quaternion(), new THREE.Vector3(w / 2, 1, d / 2)); L.push([g, col, m], [G.box(w + 0.6, 0.5, d + 0.6), 0xa39e92, G.M(0, -0.2, 0)]); };
Kit.pagoda = function ({ tiers = 5, red = 0xd8401b, cream = 0xf5ecd6, roof = 0x2f8f7b, roofEdge = 0x1d6a5b, under = 0xb32e18, dark = 0x3a2320, gold = 0xe6b73d, bronze = 0x4f5346 } = {}) {
  const L = [], M = G.M; foundation(L, 13, 13);
  L.push([G.box(12, 0.8, 12), 0xb8b3a4, M(0, 0.4, 0)], [G.box(10.2, 0.7, 10.2), 0xcfcabb, M(0, 1.15, 0)]);
  for (let s = 0; s < 4; s++) L.push([G.box(3.0, 0.38, 0.8), 0xbdb8aa, M(0, 0.19 + s * 0.38, 7.4 - s * 0.7)]);
  let y = 1.5;
  for (let k = 0; k < tiers; k++) {
    const w = 7.6 - k * 0.6, wh = 2.6, slabW = k ? w + 2.2 : w + 0.6;
    L.push([G.box(slabW, 0.36, slabW), red, M(0, y + 0.18, 0)]);
    L.push([G.box(w, wh, w), cream, M(0, y + 0.36 + wh / 2, 0)]);
    for (const [px, pz] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0], [-.5, 1], [.5, 1], [-.5, -1], [.5, -1], [1, -.5], [1, .5], [-1, -.5], [-1, .5]]) L.push([G.cyl(0.2, 0.2, wh + 0.2, 8), red, M(px * w / 2, y + 0.36 + wh / 2, pz * w / 2)]);
    L.push([G.box(w + 0.6, 0.4, w + 0.6), red, M(0, y + 0.36 + wh + 0.1, 0)], [G.box(w + 0.5, 0.3, w + 0.5), red, M(0, y + 0.36 + 0.9, 0)]);
    for (const [sx, sz] of ring4()) for (const o of [-1, 1]) { const ox = sz ? o * w * 0.26 : sx * w / 2, oz = sx ? o * w * 0.26 : sz * w / 2; L.push([G.box(sz ? 1.1 : 0.18, 1.2, sx ? 1.1 : 0.18), dark, M(ox, y + 0.36 + wh * 0.6, oz)]); }
    if (k === 0) { L.push([G.box(1.8, 2.1, 0.22), dark, M(0, y + 0.36 + 1.05, w / 2)]); for (const sx of [-1, 1]) L.push([G.cyl(0.05, 0.05, 1.3, 5), dark, M(sx * 1.3, y + 0.36 + 0.9, w / 2 + 0.6)], [G.sphere(0.42, 8), 0xff6a2a, M(sx * 1.3, y + 0.36 + 1.65, w / 2 + 0.6)]); }
    else railing(L, slabW / 2 - 0.15, slabW / 2 - 0.15, y + 0.36, red, cream, red);
    brackets(L, w, w, y + 0.36 + wh + 0.55, under, 5);
    const ry = y + 0.36 + wh + 0.85, over = 2.5 - k * 0.12; const rp = { W: w + 0.7, D: w + 0.7, H: 1.7 + 0.08 * (tiers - k), over, drop: 0.95, lift: 0.8 };
    L.push([hipRoof(rp), roof, M(0, ry, 0)], [hipRoof(rp, true), under, M(0, ry - 0.22, 0)]);
    const cr = w / 2 + 0.35 + over - 0.5; for (const [px, pz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.push([G.cone(0.24, 0.45, 6), gold, M(px * cr, ry - rp.drop + rp.lift - 0.5, pz * cr, Math.PI, 0, 0)]);
    y = ry + rp.H * 0.6 + 0.12;
  }
  L.push([G.box(1.6, 0.7, 1.6), roofEdge, M(0, y + 0.15, 0)]); sorin(L, y + 0.45, { bronze, gold });
  return G.merge(L);
};
Kit.kondo = function ({ wood = 0x5a3521, cream = 0xf3ecdd, tile = 0x5c6675, ridge = 0x8e98a6, under = 0x3d2518, stone = 0xbdb7a7, gold = 0xcfa64a } = {}) {
  const L = [], M = G.M, W = 15, D = 11; foundation(L, W + 10, D + 10);
  L.push([G.box(W + 9, 1.3, D + 9), stone, M(0, 0.65, 0)], [G.box(W + 5, 1.25, D + 5), 0xcbc5b5, M(0, 1.9, 0)]);
  for (const [sx, sz] of ring4()) for (let s = 0; s < 5; s++) { const d = (sz ? (D + 5) / 2 : (W + 5) / 2) + 0.3 + s * 0.55; L.push([G.box(sz ? 3.4 : 1.0, 0.5, sx ? 3.4 : 1.0), 0xb3ad9d, M(sx * d, 2.3 - s * 0.45, sz * d)]); }
  const y = 2.5, h1 = 3.9;
  L.push([G.box(W, h1, D), cream, M(0, y + h1 / 2, 0)], [G.box(W + 0.3, 0.3, D + 0.3), wood, M(0, y + 0.15, 0)], [G.box(W + 0.3, 0.36, D + 0.3), wood, M(0, y + h1 - 0.18, 0)], [G.box(W + 0.3, 0.22, D + 0.3), wood, M(0, y + 1.35, 0)]);
  for (let i = 0; i <= 5; i++) for (const sz of [-1, 1]) L.push([G.cyl(0.23, 0.23, h1, 8), wood, M(-W / 2 + i * W / 5, y + h1 / 2, sz * D / 2)]);
  for (let i = 0; i <= 4; i++) for (const sx of [-1, 1]) L.push([G.cyl(0.23, 0.23, h1, 8), wood, M(sx * W / 2, y + h1 / 2, -D / 2 + i * D / 4)]);
  for (let i = 0; i < 30; i++) { const x = -W / 2 + 0.4 + i * (W - 0.8) / 29; if (Math.abs(x) < 1.2) continue; for (const sz of [-1, 1]) L.push([G.box(0.1, 2.3, 0.14), wood, M(x, y + 1.35 + 1.25, sz * (D / 2 + 0.1))]); }
  for (let i = 0; i < 22; i++) { const z = -D / 2 + 0.4 + i * (D - 0.8) / 21; for (const sx of [-1, 1]) L.push([G.box(0.14, 2.3, 0.1), wood, M(sx * (W / 2 + 0.1), y + 1.35 + 1.25, z)]); }
  for (const sz of [-1, 1]) L.push([G.box(2.2, 2.5, 0.28), 0x26170f, M(0, y + 1.35 + 1.2, sz * D / 2)], [G.sphere(0.4, 8), 0xff6a2a, M(-1.6, y + 3.1, sz * (D / 2 + 0.5))], [G.sphere(0.4, 8), 0xff6a2a, M(1.6, y + 3.1, sz * (D / 2 + 0.5))]);
  const my = y + h1 + 0.45, m1 = { W: W + 1, D: D + 1, H: 1.7, over: 2.8, drop: 0.9, lift: 0.5 };
  brackets(L, W, D, my - 0.35, under, 6, 0.8); L.push([hipRoof(m1), tile, M(0, my, 0)], [hipRoof(m1, true), under, M(0, my - 0.2, 0)]);
  const y2 = my + m1.H * 0.78, h2 = 2.8, W2 = W - 2.6, D2 = D - 2.6;
  L.push([G.box(W2, h2, D2), cream, M(0, y2 + h2 / 2, 0)], [G.box(W2 + 0.3, 0.36, D2 + 0.3), wood, M(0, y2 + h2 - 0.18, 0)]);
  for (let i = 0; i <= 4; i++) for (const sz of [-1, 1]) L.push([G.cyl(0.22, 0.22, h2, 8), wood, M(-W2 / 2 + i * W2 / 4, y2 + h2 / 2, sz * D2 / 2)]);
  for (let i = 1; i < 3; i++) for (const sx of [-1, 1]) L.push([G.cyl(0.22, 0.22, h2, 8), wood, M(sx * W2 / 2, y2 + h2 / 2, -D2 / 2 + i * D2 / 3)]);
  brackets(L, W2, D2, y2 + h2 + 0.5, under, 5, 1.0);
  const ry1 = y2 + h2 + 0.95, r1 = { W: W2 + 1, D: D2 + 1, H: 2.9, over: 4.4, drop: 1.25, lift: 1.0, nu: 10 };
  L.push([hipRoof(r1), tile, M(0, ry1, 0)], [hipRoof(r1, true), under, M(0, ry1 - 0.24, 0)]);
  const ex1 = (W2 - D2) / 2 + 0.6; L.push([G.box(ex1 * 2 + 0.4, 0.5, 0.8), ridge, M(0, ry1 + r1.H + 0.1, 0)]);
  const y3 = ry1 + r1.H * 0.62, W3 = W2 - 3.4, D3 = D2 - 3.4, h3 = 2.7, bal = 1.4;
  L.push([G.box(W3 + 2 * bal, 0.34, D3 + 2 * bal), wood, M(0, y3 + 0.17, 0)]); railing(L, W3 / 2 + bal - 0.15, D3 / 2 + bal - 0.15, y3 + 0.34, wood, 0xe9dcc4, wood);
  L.push([G.box(W3, h3, D3), cream, M(0, y3 + 0.34 + h3 / 2, 0)], [G.box(W3 + 0.3, 0.34, D3 + 0.3), wood, M(0, y3 + 0.34 + h3 - 0.17, 0)]);
  for (let i = 0; i <= 3; i++) for (const sz of [-1, 1]) L.push([G.cyl(0.2, 0.2, h3, 8), wood, M(-W3 / 2 + i * W3 / 3, y3 + 0.34 + h3 / 2, sz * D3 / 2)]);
  for (const sx of [-1, 1]) L.push([G.cyl(0.2, 0.2, h3, 8), wood, M(sx * W3 / 2, y3 + 0.34 + h3 / 2, 0)]);
  for (const [sx, sz] of ring4()) L.push([G.box(sz ? 1.6 : 0.18, 1.3, sx ? 1.6 : 0.18), 0x26170f, M(sx * W3 / 2, y3 + 0.34 + h3 * 0.55, sz * D3 / 2)]);
  brackets(L, W3, D3, y3 + 0.34 + h3 + 0.5, under, 4, 1.0);
  const ry2 = y3 + 0.34 + h3 + 0.95, r2 = { W: W3 + 1, D: D3 + 1, H: 3.0, over: 3.8, drop: 1.15, lift: 1.0, nu: 10 };
  L.push([hipRoof(r2), tile, M(0, ry2, 0)], [hipRoof(r2, true), under, M(0, ry2 - 0.24, 0)]);
  const ex2 = (W3 - D3) / 2 + 0.8; L.push([G.box(ex2 * 2 + 0.6, 0.55, 0.9), ridge, M(0, ry2 + r2.H + 0.12, 0)]);
  for (const s of [-1, 1]) L.push([G.box(0.8, 1.5, 0.6), gold, M(s * (ex2 + 0.1), ry2 + r2.H + 1.0, 0, 0, 0, s * 0.25)]);
  for (const R of [[r1, ry1, W2, D2], [r2, ry2, W3, D3], [m1, my, W, D]]) { const [rp, ry, ww, dd] = R; for (const [px, pz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.push([G.cone(0.26, 0.5, 6), gold, M(px * (ww / 2 + 0.5 + rp.over - 0.6), ry - rp.drop + rp.lift - 0.55, pz * (dd / 2 + 0.5 + rp.over - 0.6), Math.PI, 0, 0)]); }
  return G.merge(L);
};
// Machiya townhouse: tiled hip roof, dark timber frame, cream plaster, koshi lattice, noren curtain over the door, paper lantern, upper balcony with shoji windows
Kit.machiya = function ({ floors = 2, wood = 0x4e3221, cream = 0xf1e8d6, tile = 0x4f5664, ridge = 0x7d8794, noren = 0x2a4a8a, lantern = 0xff6a2a } = {}) {
  const L = [], M = G.M, W = 9, D = 8; let y = 0.5;
  L.push([G.box(W + 1, 0.5, D + 1), 0xa8a296, M(0, 0.25, 0)]);
  for (let f = 0; f < floors; f++) {
    const h = f ? 2.9 : 3.3, wf = W - f * 0.4;
    L.push([G.box(wf, h, D), cream, M(0, y + h / 2, 0)]);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.push([G.box(0.3, h, 0.3), wood, M(sx * wf / 2, y + h / 2, sz * D / 2)]);
    L.push([G.box(wf + 0.3, 0.25, D + 0.3), wood, M(0, y + 0.12, 0)], [G.box(wf + 0.3, 0.3, D + 0.3), wood, M(0, y + h - 0.15, 0)]);
    if (f === 0) {
      for (let i = 0; i < 9; i++) L.push([G.box(0.1, 1.9, 0.12), wood, M(-wf / 2 + 0.6 + i * 0.4, y + 1.35, D / 2 + 0.08)]);
      for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) L.push([G.box(0.12, 1.9, 0.1), wood, M(sx * (wf / 2 + 0.08), y + 1.35, -D / 2 + 1 + i * 1.1)]);
      L.push([G.box(2.2, 2.4, 0.2), 0x2a1a12, M(wf / 2 - 2.2, y + 1.2, D / 2)], [G.box(2.4, 1.0, 0.1), noren, M(wf / 2 - 2.2, y + 1.95, D / 2 + 0.16)], [G.box(0.5, 0.6, 0.08), cream, M(wf / 2 - 2.2, y + 1.95, D / 2 + 0.22)]);
      L.push([G.box(0.06, 0.06, 0.7), wood, M(wf / 2 - 0.45, y + 2.6, D / 2 + 0.35)], [G.sphere(0.36, 8), lantern, M(wf / 2 - 0.45, y + 2.15, D / 2 + 0.6)]);
      L.push([G.box(wf + 0.8, 0.16, 1.5), tile, M(0, y + h - 0.3, D / 2 + 0.65, -0.28, 0, 0)], [G.box(wf + 0.8, 0.16, 1.2), tile, M(0, y + h - 0.3, -D / 2 - 0.5, 0.28, 0, 0)]);
    } else {
      for (let i = -1; i <= 1; i++) L.push([G.box(1.4, 1.3, 0.1), 0xfaf5e8, M(i * 2.4, y + 1.6, D / 2 + 0.03)], [G.box(1.5, 0.08, 0.14), wood, M(i * 2.4, y + 1.6, D / 2 + 0.05)], [G.box(0.08, 1.4, 0.14), wood, M(i * 2.4, y + 1.6, D / 2 + 0.05)], [G.box(0.1, 1.3, 1.2), 0xfaf5e8, M(wf / 2 + 0.02, y + 1.6, i * 2.2)]);
      for (let i = 0; i <= 8; i++) L.push([G.box(0.1, 0.8, 0.1), wood, M(-wf / 2 + i * wf / 8, y + 0.4, D / 2 + 0.6)]);
      L.push([G.box(wf + 0.2, 0.1, 0.12), wood, M(0, y + 0.8, D / 2 + 0.6)], [G.box(wf + 0.4, 0.15, 1.2), wood, M(0, y + 0.05, D / 2 + 0.3)]);
    }
    y += h;
  }
  const rp = { W: W - (floors - 1) * 0.4 + 0.4, D: D + 0.4, H: 2.4, over: 1.4, drop: 0.5, lift: 0.3, nu: 6, nv: 4 };
  L.push([hipRoof(rp), tile, M(0, y + 0.1, 0)], [hipRoof(rp, true), wood, M(0, y - 0.08, 0)], [G.box(W - D + 1.6, 0.4, 0.6), ridge, M(0, y + 0.1 + rp.H + 0.05, 0)]);
  return G.merge(L);
};
