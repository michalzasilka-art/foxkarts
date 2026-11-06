// FoxKarts Maps engine (from the "FoxKarts Maps" artifact, 2026-11-05): the procedural helpers the Japan map needs.
// The viewer's App, orbit/drone controls and post-processing are left out; the game draws, lights and drives the map itself.
import * as THREE from 'three';

// ---------------------------------------------------------------- deterministic random + noise
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const P = new Uint8Array(512); { const r = mulberry32(1337); const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) P[i] = p[i & 255]; }
const fade = t => t * t * t * (t * (t * 6 - 15) + 10), lerp = (a, b, t) => a + t * (b - a);
function grad(h, x, y) { switch (h & 3) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; default: return -x - y; } }
export function noise2(x, y) { const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y); const u = fade(x), v = fade(y); const A = P[X] + Y, B = P[X + 1] + Y; return lerp(lerp(grad(P[A], x, y), grad(P[B], x - 1, y), u), lerp(grad(P[A + 1], x, y - 1), grad(P[B + 1], x - 1, y - 1), u), v); }
export function fbm(x, y, oct = 4, lac = 2, gain = 0.5) { let a = 1, f = 1, s = 0, n = 0; for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); n += a; a *= gain; f *= lac; } return s / n; }
export const smoothstep = (e0, e1, x) => { const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); };
export const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

// ---------------------------------------------------------------- track
export class Track {
  constructor(points, { width = 12, closed = true, samples = 700 } = {}) {
    this.curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed, 'centripetal', 0.5);
    this.width = width; this.samples = samples; this.closed = closed;
    this.pts = this.curve.getSpacedPoints(samples); if (closed) this.pts.pop();
    this.length = this.curve.getLength();
    this.frames = this.pts.map((p, i) => {
      const L = this.pts.length; const n = closed ? this.pts[(i + 1) % L] : this.pts[Math.min(i + 1, L - 1)], pv = closed ? this.pts[(i - 1 + L) % L] : this.pts[Math.max(i - 1, 0)];
      const t = n.clone().sub(pv).normalize(); const up = new THREE.Vector3(0, 1, 0);
      const side = new THREE.Vector3().crossVectors(up, t).normalize();
      // curvature for banking / curbs
      const t1 = n.clone().sub(p).normalize(), t0 = p.clone().sub(pv).normalize(); const curv = t1.clone().sub(t0).length() * Math.sign(new THREE.Vector3().crossVectors(t0, t1).y || 1);
      return { p, t, side, curv };
    });
  }
  nearest(x, z) { // squared-distance search on a coarse grid then refine
    let best = 1e18, bi = 0; const n = this.pts.length;
    for (let i = 0; i < n; i += 4) { const p = this.pts[i]; const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) { best = d; bi = i; } }
    for (let k = -4; k <= 4; k++) { const i = (bi + k + n) % n; const p = this.pts[i]; const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) { best = d; bi = i; } }
    return { i: bi, d: Math.sqrt(best), y: this.pts[bi].y };
  }
  // road ribbon with vertex colours (asphalt + edge lines) and separate curb strips
  buildRoad(palette) {
    const n = this.pts.length, w = this.width / 2; const pos = [], col = [], idx = [], uv = [];
    const asphalt = new THREE.Color(palette.asphalt), line = new THREE.Color(palette.line);
    const rows = this.closed ? n + 1 : n;
    for (let i = 0; i < rows; i++) {
      const f = this.frames[i % n]; const bank = clamp(-f.curv * 1.5, -0.08, 0.08);
      for (const s of [-1, -0.92, -0.86, 0.86, 0.92, 1]) {
        const p = f.p.clone().addScaledVector(f.side, s * w); p.y += 0.02 + bank * s * w;
        pos.push(p.x, p.y, p.z); uv.push(s * 0.5 + 0.5, i / 8);
        const c = (Math.abs(s) > 0.87 && Math.abs(s) < 0.93) ? line : asphalt; col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < (this.closed ? n : n - 1); i++) for (let k = 0; k < 5; k++) { const a = i * 6 + k, b = a + 6; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 })); m.receiveShadow = true; m.name = 'Road';
    // curbs on both edges where the track bends
    const cpos = [], ccol = [], cidx = []; const red = new THREE.Color(palette.curbA), white = new THREE.Color(palette.curbB); let v = 0;
    for (let i = 0; i < n; i++) {
      if (!this.closed && i === n - 1) break; const f = this.frames[i], f2 = this.frames[(i + 1) % n]; if (Math.abs(f.curv) < 0.012) continue;
      for (const s of [-1, 1]) {
        const c = ((i >> 2) & 1) ? red : white;
        const a0 = f.p.clone().addScaledVector(f.side, s * w), a1 = f.p.clone().addScaledVector(f.side, s * (w + 1.1)), b0 = f2.p.clone().addScaledVector(f2.side, s * w), b1 = f2.p.clone().addScaledVector(f2.side, s * (w + 1.1));
        for (const q of [a0, a1, b0, b1]) { cpos.push(q.x, q.y + 0.08, q.z); ccol.push(c.r, c.g, c.b); }
        cidx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3); v += 4;
      }
    }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cpos, 3)); cg.setAttribute('color', new THREE.Float32BufferAttribute(ccol, 3)); cg.setIndex(cidx); cg.computeVertexNormals();
    const curbs = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide })); curbs.name = 'Curbs';
    const grp = new THREE.Group(); grp.add(m, curbs); grp.name = 'Track'; return grp;
  }
  // centre dashes
  buildDashes(color = 0xffffff) {
    const g = new THREE.BoxGeometry(0.25, 0.02, 2.2); const n = this.pts.length; const im = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color }), Math.ceil(n / 3));
    const o = new THREE.Object3D(); let k = 0;
    for (let i = 0; i < n; i += 3) { const f = this.frames[i]; o.position.copy(f.p); o.position.y += 0.045; o.lookAt(f.p.clone().add(f.t)); o.updateMatrix(); im.setMatrixAt(k++, o.matrix); }
    im.count = k; im.name = 'Dashes'; return im;
  }
  // points for exporting
  toJSON(name, extras = {}) {
    return { name, units: 'metres', up: '+Y', handedness: 'right (three.js); for Unity negate z or x', width: this.width, lapLength: Math.round(this.length),
      spline: this.pts.filter((_, i) => i % 2 === 0).map(p => ({ x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) })), ...extras };
  }
  checkpoints(count = 9) { const n = this.pts.length; const out = []; for (let k = 0; k < count; k++) { const f = this.frames[Math.floor(k * n / count)]; out.push({ pos: f.p.clone(), dir: f.t.clone(), side: f.side.clone() }); } return out; }
}

// several tracks behave as one for terrain flattening and prop scatter
export function comboTrack(main, alt) {
  return { width: main.width, nearest(x, z) { const a = main.nearest(x, z); if (!alt) return a; const b = alt.nearest(x, z); return b.d < a.d ? { ...b, alt: true } : a; } };
}
// road split: alternate route between two sample indices of the main track
export function buildSplit(main, i0, i1, midPoints, palette, { width = main.width, color = 0xff8a1a } = {}) {
  const f0 = main.frames[i0], f1 = main.frames[i1];
  const pts = [f0.p.clone().addScaledVector(f0.t, -12), f0.p.clone(), f0.p.clone().addScaledVector(f0.t, 14), ...midPoints.map(p => new THREE.Vector3(...p)), f1.p.clone().addScaledVector(f1.t, -14), f1.p.clone(), f1.p.clone().addScaledVector(f1.t, 12)];
  const alt = new Track(pts, { width, closed: false, samples: 260 });
  const grp = new THREE.Group(); grp.name = 'SplitRoute'; const road = alt.buildRoad(palette); road.position.y += 0.012; grp.add(road, alt.buildDashes(palette.line));
  // which side of the main track the route leaves on
  const mid = new THREE.Vector3(...midPoints[0]); const side = Math.sign(mid.clone().sub(f0.p).dot(f0.side)) || 1;
  // fork / merge signs on gantries
  for (const [f, text] of [[f0, '◄ SPLIT ►'], [f1, 'MERGE']]) {
    const g = new THREE.Group(); g.position.copy(f.p); g.lookAt(f.p.clone().add(f.t)); const w = width / 2 + 2;
    const pm = new THREE.MeshStandardMaterial({ color: 0x2a2d3a, roughness: 0.6 }); for (const x of [-w, w]) { const p = new THREE.Mesh(G.box(0.4, 6.5, 0.4), pm); p.position.set(x, 3.25, 0); g.add(p); }
    const beam = new THREE.Mesh(G.box(w * 2 + 0.4, 0.4, 0.4), pm); beam.position.set(0, 6.4, 0); g.add(beam);
    const sign = makeTextPlane(text, { w: 6, h: 1.4, bg: '#' + new THREE.Color(color).getHexString(), fg: '#ffffff', emissive: true }); sign.position.set(0, 5.4, 0); g.add(sign); grp.add(g);
  }
  grp.userData.export = { forkIndex: i0, mergeIndex: i1, side, fork: f0.p.clone(), merge: f1.p.clone(), spline: alt.pts.filter((_, i) => i % 2 === 0).map(p => ({ x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) })) };
  return { alt, grp, side };
}

// ---------------------------------------------------------------- terrain heightfield
export function buildTerrain({ size = 1400, seg = 170, track, heightFn, colorFn, roadMargin = 9, blendMargin = 55 }) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position; const col = new Float32Array(pos.count * 3); const c = new THREE.Color();
  const heights = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i); let h = heightFn(x, z); const nr = track.nearest(x, z);
    const w = track.width / 2 + roadMargin; const t = smoothstep(w, w + blendMargin, nr.d);
    h = lerp(nr.y - 0.25, h, t); heights[i] = h; pos.setY(i, h);
  }
  g.computeVertexNormals();
  const nrm = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); const slope = 1 - nrm.getY(i); const nr = track.nearest(x, z); colorFn(c, x, z, heights[i], slope, nr.d); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })); m.receiveShadow = true; m.name = 'Terrain';
  m.userData.sample = (x, z) => { // bilinear height sample
    const half = size / 2; const fx = (x + half) / size * seg, fz = (z + half) / size * seg; const ix = clamp(Math.floor(fx), 0, seg - 1), iz = clamp(Math.floor(fz), 0, seg - 1);
    const id = (a, b) => b * (seg + 1) + a; const tx = fx - ix, tz = fz - iz;
    const h00 = heights[id(ix, iz)], h10 = heights[id(ix + 1, iz)], h01 = heights[id(ix, iz + 1)], h11 = heights[id(ix + 1, iz + 1)];
    return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
  };
  return m;
}

// ---------------------------------------------------------------- scatter helper (instanced props)
export function scatter({ rng, count, area, track, terrain, minRoad = 10, maxRoad = 1e9, accept = () => true, place }) {
  let placed = 0, tries = 0;
  while (placed < count && tries < count * 12) {
    tries++; const x = (rng() - 0.5) * area, z = (rng() - 0.5) * area; const nr = track.nearest(x, z);
    if (nr.d < track.width / 2 + minRoad || nr.d > maxRoad) continue; const y = terrain.userData.sample(x, z); if (!accept(x, y, z, nr)) continue;
    place(x, y, z, nr, placed); placed++;
  }
  return placed;
}
export class Instancer {
  constructor(geo, mat, max, { castShadow = false } = {}) { this.mesh = new THREE.InstancedMesh(geo, mat, max); this.mesh.castShadow = castShadow; this.mesh.receiveShadow = true; this.mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage); this.n = 0; this.o = new THREE.Object3D(); this.max = max; this.colored = false; }
  add(x, y, z, { rotY = 0, scale = 1, sx, sy, sz, tilt = 0, color } = {}) {
    if (this.n >= this.max) return; const o = this.o; o.position.set(x, y, z); o.rotation.set(tilt, rotY, 0); o.scale.set(sx ?? scale, sy ?? scale, sz ?? scale); o.updateMatrix(); this.mesh.setMatrixAt(this.n, o.matrix);
    if (color) { this.mesh.setColorAt(this.n, color); this.colored = true; } this.n++;
  }
  finish() { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; if (this.colored && this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; return this.mesh; }
}

// ---------------------------------------------------------------- common geometry kits
export const G = {
  cone: (r, h, s = 7) => new THREE.ConeGeometry(r, h, s),
  cyl: (r0, r1, h, s = 7) => new THREE.CylinderGeometry(r0, r1, h, s),
  box: (x, y, z) => new THREE.BoxGeometry(x, y, z),
  sphere: (r, s = 8) => new THREE.SphereGeometry(r, s, Math.max(5, s - 2)),
  ico: (r, d = 1) => new THREE.IcosahedronGeometry(r, d),
  merge(list) { // merge geometries with per-geometry colour -> vertex colours
    const parts = []; for (const [geo, color, matrix] of list) { const g = geo.clone(); if (matrix) g.applyMatrix4(matrix); const n = g.attributes.position.count; const c = new THREE.Color(color); const arr = new Float32Array(n * 3); for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); g.deleteAttribute('uv'); parts.push(g.index ? g.toNonIndexed() : g); }
    const total = parts.reduce((a, g) => a + g.attributes.position.count, 0); const pos = new Float32Array(total * 3), col = new Float32Array(total * 3), nor = new Float32Array(total * 3); let off = 0;
    for (const g of parts) { pos.set(g.attributes.position.array, off * 3); col.set(g.attributes.color.array, off * 3); nor.set(g.attributes.normal.array, off * 3); off += g.attributes.position.count; }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3)); return out;
  },
  M: (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s)),
};
export const vcMat = (opts = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, ...opts });

// ---------------------------------------------------------------- pit lane + pit box (FoxKarts style: outlined glowing box with canopy)
export function buildPitLane(track, { startIndex, length = 90, offset = 9, boxes = 4, ledColor = 0xff8a1a, palette }) {
  const n = track.pts.length; const grp = new THREE.Group(); grp.name = 'PitLane';
  const seg = Math.round(length / (track.length / n)); const pts = [];
  for (let k = -12; k <= seg + 12; k++) { const i = (startIndex + k + n) % n; const f = track.frames[i]; const blend = smoothstep(-12, 0, k) * smoothstep(seg + 12, seg, k); const p = f.p.clone().addScaledVector(f.side, -(track.width / 2 + offset * blend) - 0.5); p.y += 0.03; pts.push(p); }
  const lane = new THREE.CatmullRomCurve3(pts, false); const lp = lane.getSpacedPoints(80);
  const pos = [], col = [], idx = []; const c = new THREE.Color(palette.pit);
  for (let i = 0; i < lp.length; i++) { const p = lp[i], q = lp[Math.min(i + 1, lp.length - 1)], pv = lp[Math.max(i - 1, 0)]; const t = q.clone().sub(pv).normalize(); const s = new THREE.Vector3(0, 1, 0).cross(t).normalize(); for (const k of [-1, 1]) { const v = p.clone().addScaledVector(s, k * 3.6); pos.push(v.x, v.y, v.z); col.push(c.r, c.g, c.b); } }
  for (let i = 0; i < lp.length - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  grp.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })));
  // boxes along the outer side of the lane
  const led = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: new THREE.Color(ledColor), emissiveIntensity: 2.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.8 }); const wall = new THREE.MeshStandardMaterial({ color: palette.pitWall, roughness: 0.6 });
  const pitInfo = [];
  for (let b = 0; b < boxes; b++) {
    const u = 0.25 + 0.5 * (b / Math.max(1, boxes - 1)); const i = Math.round(u * (lp.length - 1)); const p = lp[i], q = lp[Math.min(i + 1, lp.length - 1)]; const t = q.clone().sub(p).normalize(); const s = new THREE.Vector3(0, 1, 0).cross(t).normalize();
    const centre = p.clone().addScaledVector(s, -7.5); const box = new THREE.Group(); box.position.copy(centre); box.lookAt(centre.clone().add(t)); box.position.y += 0.02;
    // floor outline (4 glowing edges) + faint filled slab
    const slab = new THREE.Mesh(G.box(6, 0.06, 9), new THREE.MeshStandardMaterial({ color: 0x1a1c24, roughness: 0.9, transparent: true, opacity: 0.55 })); box.add(slab);
    for (const [x, z, w, d] of [[0, 4.5, 6.2, 0.22], [0, -4.5, 6.2, 0.22], [3.1, 0, 0.22, 9.2], [-3.1, 0, 0.22, 9.2]]) { const e = new THREE.Mesh(G.box(w, 0.12, d), led); e.position.set(x, 0.08, z); box.add(e); }
    // back wall + canopy on 2 posts
    const bw = new THREE.Mesh(G.box(6.4, 3.2, 0.3), wall); bw.position.set(0, 1.6, -4.7); box.add(bw);
    const sign = new THREE.Mesh(G.box(3.2, 0.6, 0.1), led); sign.position.set(0, 2.6, -4.5); box.add(sign);
    for (const x of [-2.9, 2.9]) { const post = new THREE.Mesh(G.cyl(0.08, 0.08, 3.4, 6), dark); post.position.set(x, 1.7, 4.2); box.add(post); }
    const roof = new THREE.Mesh(G.box(6.6, 0.14, 9.6), new THREE.MeshStandardMaterial({ color: palette.pitRoof, roughness: 0.5, metalness: 0.2 })); roof.position.set(0, 3.45, -0.2); box.add(roof);
    const strip = new THREE.Mesh(G.box(6.6, 0.1, 0.2), led); strip.position.set(0, 3.36, 4.5); box.add(strip);
    // number plate
    const num = makeTextPlane(String(b + 1), { w: 1.2, h: 1.2, bg: '#111', fg: '#ff8a1a' }); num.position.set(0, 1.9, -4.5); box.add(num);
    grp.add(box); pitInfo.push({ pos: centre.clone(), dir: t.clone() });
  }
  grp.userData.export = { entry: lp[0], exit: lp[lp.length - 1], lane: lp.filter((_, i) => i % 4 === 0), boxes: pitInfo };
  return grp;
}

// ---------------------------------------------------------------- text / sign planes (canvas textures)
export function makeTextPlane(text, { w = 4, h = 1, bg = '#ffffff', fg = '#111111', font = '700 110px "Baloo 2", system-ui, sans-serif', emissive = false, double = true } = {}) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w); const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); x.fillStyle = fg; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
  let size = parseInt(font.match(/(\d+)px/)[1]); while (x.measureText(text).width > c.width * 0.88 && size > 20) { size -= 6; x.font = font.replace(/\d+px/, size + 'px'); }
  x.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = emissive ? new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.6, side: double ? THREE.DoubleSide : THREE.FrontSide }) : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, side: double ? THREE.DoubleSide : THREE.FrontSide });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

// ---------------------------------------------------------------- start gate + checkpoints
export function buildStartGate(track, index, palette) {
  const f = track.frames[index]; const grp = new THREE.Group(); grp.position.copy(f.p); grp.lookAt(f.p.clone().add(f.t)); grp.name = 'StartGate';
  const w = track.width / 2 + 2.5; const postMat = new THREE.MeshStandardMaterial({ color: palette.gate, roughness: 0.5, metalness: 0.3 });
  for (const x of [-w, w]) { const p = new THREE.Mesh(G.box(0.6, 7.5, 0.6), postMat); p.position.set(x, 3.75, 0); grp.add(p); }
  const beam = new THREE.Mesh(G.box(w * 2 + 0.6, 1.4, 0.8), postMat); beam.position.set(0, 7.6, 0); grp.add(beam);
  const banner = makeTextPlane('FOXKARTS  ·  START', { w: w * 2, h: 1.1, bg: palette.gateBanner, fg: '#fff', emissive: true }); banner.position.set(0, 7.6, 0.42); grp.add(banner);
  const banner2 = banner.clone(); banner2.rotation.y = Math.PI; banner2.position.z = -0.42; grp.add(banner2);
  // chequered line on the road
  const cols = []; const n = 16; const cg = new THREE.PlaneGeometry(track.width, 2, n, 2).rotateX(-Math.PI / 2); const cc = new Float32Array(cg.attributes.position.count * 3);
  for (let i = 0; i < cg.attributes.position.count; i++) { const px = cg.attributes.position.getX(i), pz = cg.attributes.position.getZ(i); const ix = Math.floor((px / track.width + 0.5) * n), iz = pz > 0 ? 1 : 0; const v = (ix + iz) & 1 ? 1 : 0.08; cc[i * 3] = cc[i * 3 + 1] = cc[i * 3 + 2] = v; }
  cg.setAttribute('color', new THREE.BufferAttribute(cc, 3)); const line = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })); line.position.y = 0.05; grp.add(line);
  return grp;
}
export function buildCheckpoints(track, count, color) {
  const grp = new THREE.Group(); grp.name = 'Checkpoints'; const mat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: new THREE.Color(color), emissiveIntensity: 1.8, transparent: true, opacity: 0.9 });
  const cps = track.checkpoints(count);
  cps.forEach((cp, k) => { if (k === 0) return; const g = new THREE.Group(); g.position.copy(cp.pos); g.lookAt(cp.pos.clone().add(cp.dir)); for (const x of [-1, 1]) { const post = new THREE.Mesh(G.cyl(0.18, 0.18, 4.5, 8), mat); post.position.set(x * (track.width / 2 + 1.2), 2.25, 0); g.add(post); const ball = new THREE.Mesh(G.sphere(0.45, 10), mat); ball.position.set(x * (track.width / 2 + 1.2), 4.8, 0); g.add(ball); } grp.add(g); });
  grp.userData.export = cps.map(cp => ({ pos: cp.pos, dir: cp.dir }));
  return grp;
}

// ---------------------------------------------------------------- sky + lighting + weather
export const TIMES = {
  dawn: { sun: [-0.6, 0.22, 0.5], sunColor: 0xffc090, sunI: 2.2, sky: ['#ffc9a0', '#8fb4ff', '#3b4a8f'], ambient: 0.8, fog: '#f6dcc8', exposure: 1.02 },
  day: { sun: [0.4, 0.9, 0.3], sunColor: 0xfff4e0, sunI: 2.8, sky: ['#e6f6ff', '#6fc0ff', '#2f82f0'], ambient: 0.9, fog: '#d8ecff', exposure: 1.08 },
  sunset: { sun: [0.8, 0.22, -0.3], sunColor: 0xffa060, sunI: 2.4, sky: ['#ffd9a0', '#ff9ab0', '#5b4aa0'], ambient: 0.75, fog: '#f3d2c0', exposure: 1.05 },
  night: { sun: [-0.3, 0.5, -0.6], sunColor: 0x7f93ff, sunI: 0.55, sky: ['#141a3a', '#0a0d24', '#05060f'], ambient: 0.22, fog: '#0d1030', exposure: 1.15 },
};
export function makeSky(renderer) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter;
  const geo = new THREE.SphereGeometry(2600, 24, 16); const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'Sky'; mesh.renderOrder = -10;
  mesh.userData.set = (cols) => { const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0.0, cols[2]); gr.addColorStop(0.45, cols[1]); gr.addColorStop(0.62, cols[0]); gr.addColorStop(1, cols[0]); x.fillStyle = gr; x.fillRect(0, 0, 4, 256); tex.needsUpdate = true; };
  return mesh;
}
function dotTexture() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; }
let DOT = null;
export class Weather {
  constructor(scene) { this.scene = scene; this.kind = 'clear'; this.group = new THREE.Group(); scene.add(this.group); this.parts = null; this.vel = null; this.center = new THREE.Vector3(); }
  set(kind, center, opts = {}) {
    this.kind = kind; this.group.clear(); this.parts = null;
    const count = kind === 'rain' ? 9000 : kind === 'snow' ? 5000 : kind === 'petals' ? 3500 : kind === 'fireflies' ? 1500 : kind === 'leaves' ? 2500 : 0;
    if (!count) return;
    const pos = new Float32Array(count * 3); this.vel = new Float32Array(count * 3); this.box = 220;
    for (let i = 0; i < count; i++) { pos[i * 3] = (Math.random() - 0.5) * this.box; pos[i * 3 + 1] = Math.random() * 80; pos[i * 3 + 2] = (Math.random() - 0.5) * this.box; this.vel[i * 3] = (Math.random() - 0.5) * 2; this.vel[i * 3 + 1] = kind === 'rain' ? -(28 + Math.random() * 10) : kind === 'snow' ? -(1.2 + Math.random()) : kind === 'petals' ? -(1.6 + Math.random() * 1.2) : kind === 'leaves' ? -(1.4 + Math.random()) : (Math.random() - 0.5) * 0.6; this.vel[i * 3 + 2] = (Math.random() - 0.5) * 2; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    DOT = DOT || dotTexture(); const mat = new THREE.PointsMaterial({ map: DOT, alphaTest: 0.05, size: kind === 'rain' ? 0.12 : kind === 'fireflies' ? 0.22 : 0.35, color: kind === 'rain' ? 0xbcd4ff : kind === 'snow' ? 0xffffff : kind === 'petals' ? 0xffb7d5 : kind === 'leaves' ? 0x9bd36a : 0xfff28a, transparent: true, opacity: kind === 'rain' ? 0.55 : 0.95, sizeAttenuation: true, depthWrite: false });
    if (kind === 'fireflies') { mat.blending = THREE.AdditiveBlending; }
    this.parts = new THREE.Points(g, mat); this.parts.frustumCulled = false; this.group.add(this.parts);
  }
  update(dt, center, t) {
    if (!this.parts) return; const p = this.parts.geometry.attributes.position.array; const half = this.box / 2; const sway = Math.sin(t * 0.8) * 1.5;
    for (let i = 0; i < p.length; i += 3) {
      p[i] += (this.vel[i] + (this.kind === 'petals' || this.kind === 'leaves' ? sway : 0)) * dt; p[i + 1] += this.vel[i + 1] * dt; p[i + 2] += this.vel[i + 2] * dt;
      if (this.kind === 'fireflies') { p[i + 1] += Math.sin(t * 2 + i) * 0.01; if (p[i + 1] < 1) p[i + 1] = 1; if (p[i + 1] > 12) p[i + 1] = 12; }
      if (p[i + 1] < center.y - 5) { p[i + 1] = center.y + 60 + Math.random() * 20; p[i] = center.x + (Math.random() - 0.5) * this.box; p[i + 2] = center.z + (Math.random() - 0.5) * this.box; }
      if (p[i] < center.x - half) p[i] += this.box; if (p[i] > center.x + half) p[i] -= this.box; if (p[i + 2] < center.z - half) p[i + 2] += this.box; if (p[i + 2] > center.z + half) p[i + 2] -= this.box;
    }
    this.parts.geometry.attributes.position.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- water plane with animated ripples
export function makeWater(size, level, color, opts = {}) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const img = x.createImageData(256, 256);
  for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) { const n = fbm(i / 24, j / 24, 3) * 0.5 + 0.5; const k = (j * 256 + i) * 4; img.data[k] = 128 + (fbm(i / 18 + 9, j / 18, 2)) * 60; img.data[k + 1] = 128 + (fbm(i / 18, j / 18 + 9, 2)) * 60; img.data[k + 2] = 255; img.data[k + 3] = 255; }
  x.putImageData(img, 0, 0); const nm = new THREE.CanvasTexture(c); nm.wrapS = nm.wrapT = THREE.RepeatWrapping; nm.repeat.set(size / 40, size / 40);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.1, transparent: true, opacity: opts.opacity ?? 0.86, normalMap: nm, normalScale: new THREE.Vector2(0.35, 0.35) });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), mat); m.position.y = level; m.name = 'Water'; m.userData.tick = (t) => { nm.offset.set(t * 0.012, t * 0.008); }; return m;
}

// ---------------------------------------------------------------- app shell: renderer, modes, HUD, screenshots
