// The default FoxKarts kart and Foxino's racing helmet (both made with Higgsfield Meshy 7 from the user's turnaround
// sheets) and their paint shop: colours, always-on lights and the LED logo.
//
// kart-default.glb: Y up, faces +Z, floor y = 0, metres (about 2.1 m long). Nodes: Body · WheelFrontLeft /
// WheelFrontRight / WheelRearLeft / WheelRearRight (groups at the hub; dressKart builds a wheel in each as its only
// child 'Spin': spin that about X, steer the group about Y) · SteeringWheel (group at the wheel's centre) · Seat
// (the driver's hip point) · LogoAnchor (the front panel: +Z of the node points out of it, scale = plate size).
// helmet.glb: faces +Z, Y up, centred, 0.6 m wide (the same size and axes as models.js buildHelmet). Nodes: Shell ·
// LogoAnchor (the fox plate above the visor).
// Each model has one painted material with an emissive light mask. The lights are always on: solid emissive,
// no blending, no transparency (the logo plates cut their rounded corners with alphaTest).
//
//   import * as KS from './kart-skin.js';
//   const kart = await KS.loadDefaultKart(THREE, GLTFLoader);      // once (kart-default.glb)
//   const k = kart.clone(); KS.dressKart(THREE, k, { body, light, logo, logoColor });
//   const helmet = await KS.loadHelmet(THREE, GLTFLoader);          // once (helmet.glb)
//   const h = helmet.clone(); KS.dressHelmet(THREE, h, { main, accent, light, logo, logoColor });

export const DEFAULT_SKIN = { body: '#7a28dc', light: '#ffa424', logo: 'fox', logoColor: '#ffa424' };
export const DEFAULT_HELMET = { main: '#6a2ad0', accent: '#ff9a1e', light: '#ff7a3a', logo: 'fox', logoColor: '#ff7a3a' };
export const BODY_COLORS = [
  { name: 'Metal Red', color: '#df0707' }, { name: 'Coral', color: '#ff6b52' }, { name: 'Sunset Orange', color: '#ff7a1e' }, { name: 'Amber', color: '#ffa32b' }, { name: 'Gold', color: '#f0b428' },
  { name: 'Sunshine', color: '#ffe14a' }, { name: 'Chartreuse', color: '#b6e02a' }, { name: 'Metal Green', color: '#2b8e72' }, { name: 'Forest', color: '#2f9e4f' }, { name: 'Mint', color: '#7fe3c0' },
  { name: 'Teal', color: '#16b8a8' }, { name: 'Cyan', color: '#22c9e8' }, { name: 'Sky Blue', color: '#2a8cff' }, { name: 'Metal Blue', color: '#1853a0' }, { name: 'Indigo', color: '#4426b8' },
  { name: 'Foxino Purple', color: '#7a28dc' }, { name: 'Violet', color: '#a84ae8' }, { name: 'Lavender', color: '#c9a6f5' }, { name: 'Bubblegum', color: '#ff5db1' }, { name: 'Magenta', color: '#e8238c' },
  { name: 'Snow White', color: '#e8ecf4' }, { name: 'Stone Grey', color: '#9aa0aa' }, { name: 'Gunmetal', color: '#5a6372' }, { name: 'Midnight', color: '#2a2e5a' }, { name: 'Chocolate', color: '#8a5a32' },
];
export const LIGHT_COLORS = [
  { name: 'Amber', color: '#ffa424' }, { name: 'Ice', color: '#7af8ff' }, { name: 'Pink', color: '#ff5db1' }, { name: 'Lime', color: '#9cff3a' },
  { name: 'Red', color: '#ff3a3a' }, { name: 'Violet', color: '#b77aff' }, { name: 'White', color: '#ffffff' }, { name: 'Gold', color: '#ffe14a' },
];
export const LOGOS = [
  { id: 'fox', name: 'Fox' }, { id: 'star', name: 'Star' }, { id: 'heart', name: 'Heart' }, { id: 'bolt', name: 'Lightning' },
  { id: 'paw', name: 'Paw' }, { id: 'crown', name: 'Crown' }, { id: 'none', name: 'No logo' },
];

// ---- colours ----
const hex = (c) => { const v = parseInt(c.replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
function rgb2hsl(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; if (!d) return [0, 0, l]; const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; if (h < 0) h += 1; return [h, Math.min(1, s), l]; }
function hsl2rgb(h, s, l) { const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h * 6) % 2) - 1)), m = l - c / 2, k = Math.floor(h * 6) % 6; const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][k]; return [r + m, g + m, b + m]; }
const hueOf = (r, g, b) => { const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); if (!d) return -1; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; return h < 0 ? h + 360 : h; };

// read a loaded model's painted texture once and sort its pixels: kind 1 = the purple paint, kind 2 = the orange
// paint (helmet only); light = how much a pixel is a light (from the emissive mask)
function study(scene, { orange = false, minL = 0, pale = true } = {}) {
  let mat = null; scene.traverse((o) => { if (o.isMesh) { mat = o.material; o.castShadow = true; } });
  const img = mat.map.image, w = img.width, h = img.height, n = w * h;
  const px = (im) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h); return x.getImageData(0, 0, w, h).data; };
  const src = px(img), em = px(mat.emissiveMap.image), mr = mat.metalnessMap ? px(mat.metalnessMap.image) : null, kind = new Uint8Array(n), light = new Uint8Array(n);
  const ref = { 1: [0, 0, 0], 2: [0, 0, 0] };
  for (let i = 0, o = 0; i < n; i++, o += 4) {
    if (em[o + 1] > 60) { light[i] = Math.min(255, (em[o + 1] - 60) * 1.4); if (light[i] > 140) continue; }
    const r = src[o] / 255, g = src[o + 1] / 255, b = src[o + 2] / 255, hu = hueOf(r, g, b), [, s, l] = rgb2hsl(r, g, b);
    // the purple paint, on the kart including the pale smudges in it (they are what made it look worn)
    if (hu > 235 && hu < 325 && l > minL && (s > .3 || (pale && s > .08 && l > .55))) kind[i] = 1;   // (minL keeps the helmet's dark visor and lining as they are)
    else if (orange && hu > 22 && hu < 52 && s > .45 && l > .3) kind[i] = 2;
    else continue;
    const R = ref[kind[i]]; R[0] += s; R[1] += l; R[2]++;
  }
  for (const k of [1, 2]) { const R = ref[k]; if (R[2]) { R[0] /= R[2]; R[1] /= R[2]; } }
  return { scene, mat, w, h, src, mr, kind, light, ref };
}
// paint a studied model: kind 1 → c1, kind 2 → c2, the lights → the light colour (painted and lit).
// matte = true gives kind 1 a flat, even, non-shiny colour (the kart body); otherwise it's a glossy paint (the helmet)
function paint(THREE, B, c1, c2, light, matte = false) {
  const n = B.w * B.h, cv = document.createElement('canvas'), ev = document.createElement('canvas'); cv.width = ev.width = B.w; cv.height = ev.height = B.h;
  const cx = cv.getContext('2d'), ex = ev.getContext('2d'), ci = cx.createImageData(B.w, B.h), ei = ex.createImageData(B.w, B.h), d = ci.data, e = ei.data;
  const T = { 1: c1 && rgb2hsl(...hex(c1).map((v) => v / 255)), 2: c2 && rgb2hsl(...hex(c2).map((v) => v / 255)) }, [lr, lg, lb] = hex(light);
  for (let i = 0, o = 0; i < n; i++, o += 4) {
    let r = B.src[o], g = B.src[o + 1], b = B.src[o + 2]; const k = B.kind[i];
    if (k && T[k]) {
      // new, even paint: the target colour, keeping only a little of the old light-and-shade (a factory-fresh finish)
      const [th, ts, tl] = T[k], [, ps, pl] = rgb2hsl(r / 255, g / 255, b / 255), R = B.ref[k];
      const q = matte
        // matte: just the chosen colour, with only a hint of the old shading
        ? hsl2rgb(th, ts, Math.max(.03, Math.min(.95, tl + (pl - R[1]) * .2)))
        : hsl2rgb(th, Math.min(1, ts * (.85 + .15 * ps / (R[0] || 1))), Math.max(.03, Math.min(.95, tl + (pl - R[1]) * .45)));
      r = q[0] * 255; g = q[1] * 255; b = q[2] * 255;
    }
    const li = B.light[i] / 255;
    if (li) { r += (lr - r) * li; g += (lg - g) * li; b += (lb - b) * li; e[o] = lr * li; e[o + 1] = lg * li; e[o + 2] = lb * li; }
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255; e[o + 3] = 255;
  }
  cx.putImageData(ci, 0, 0); ex.putImageData(ei, 0, 0);
  const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); t.flipY = false; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const m = B.mat.clone(); m.map = tex(cv); m.emissiveMap = tex(ev); m.emissive = new THREE.Color(1, 1, 1); m.emissiveIntensity = 1.0;
  if (matte && B.mr) {
    // a roughness/metalness map (glTF: G = roughness, B = metalness): the body is flat matte paint, no metal;
    // everything else (seat, trim, lights) keeps its own finish
    const mv = document.createElement('canvas'); mv.width = B.w; mv.height = B.h; const mx = mv.getContext('2d'), mi = mx.createImageData(B.w, B.h), q = mi.data;
    for (let i = 0, o = 0; i < n; i++, o += 4) {
      if (B.kind[i] === 1) { q[o + 1] = 215; q[o + 2] = 0; } else { q[o + 1] = B.mr[o + 1]; q[o + 2] = B.mr[o + 2]; }
      q[o + 3] = 255;
    }
    mx.putImageData(mi, 0, 0); m.roughnessMap = m.metalnessMap = tex(mv, false); m.roughness = 1; m.metalness = 1; m.envMapIntensity = .8;
    if (m.normalScale) m.normalScale.set(.3, .3);
  } else {
    // glossy new paint: smoother, a touch of metal flake, softer dents from the normal map
    m.roughness = .45; m.metalness = .25; m.envMapIntensity = 1.25; if (m.normalScale) m.normalScale.set(.45, .45);
  }
  return m;
}
// ---- the clean repaint (v5) ----
// parts: 0 paint (main colour) · 1 dark carbon · 2 metal trim · 3 accent (light colour / helmet accent) · 4 white · 5 light
const PART = { P: 0, D: 1, G: 2, A: 3, W: 4, L: 5 };
function partOf(B, u, v) {
  const x = Math.min(B.w - 1, Math.max(0, Math.round(u * B.w))), y = Math.min(B.h - 1, Math.max(0, Math.round(v * B.h))), i = y * B.w + x, o = i * 4;
  if (B.light[i] > 140) return PART.L;
  const r = B.src[o] / 255, g = B.src[o + 1] / 255, b = B.src[o + 2] / 255, hu = hueOf(r, g, b), [, sat, l] = rgb2hsl(r, g, b);
  if (hu > 230 && hu < 330 && sat > .22 && l > .1) return PART.P;
  if (hu > 15 && hu < 65 && sat > .4 && l > .28) return PART.A;
  if (l < .17) return PART.D;
  if (sat < .2 && l > .78) return PART.W;
  return PART.G;
}
// sort one mesh's triangles into parts and return a fresh geometry with one group per part (sorted by part)
function cleanGeometry(THREE, mesh, B, { keepLights = true, minIsland = 30 } = {}) {
  const src = mesh.geometry, idx = src.index, pos = src.attributes.position, uv = src.attributes.uv, nT = (idx ? idx.count : pos.count) / 3;
  const vi = (t, k) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
  // 1. vote: the three corners and the middle of every triangle
  const cls = new Uint8Array(nT), votes = new Uint8Array(6);
  for (let t = 0; t < nT; t++) {
    votes.fill(0); let mu = 0, mv = 0;
    for (let k = 0; k < 3; k++) { const a = vi(t, k), u = uv.getX(a), v = uv.getY(a); mu += u; mv += v; votes[partOf(B, u, v)]++; }
    votes[partOf(B, mu / 3, mv / 3)] += 2;
    let best = 0; for (let c = 1; c < 6; c++) if (votes[c] > votes[best]) best = c; cls[t] = best;
  }
  // 2. neighbours: triangles sharing an edge (positions welded, UV seams ignored)
  const key = (a) => Math.round(pos.getX(a) * 1e4) + ',' + Math.round(pos.getY(a) * 1e4) + ',' + Math.round(pos.getZ(a) * 1e4), pid = new Map(), P = new Int32Array(nT * 3);
  for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) { const kk = key(vi(t, k)); let id = pid.get(kk); if (id === undefined) { id = pid.size; pid.set(kk, id); } P[t * 3 + k] = id; }
  const edges = new Map(), nb = Array.from({ length: nT }, () => []);
  for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) { const a = P[t * 3 + k], b = P[t * 3 + (k + 1) % 3], e = a < b ? a + '_' + b : b + '_' + a, o = edges.get(e); if (o === undefined) edges.set(e, t); else { nb[t].push(o); nb[o].push(t); } }
  // 3. smooth: a triangle takes the part most of its neighbours have (a few passes)
  const cnt = new Uint8Array(6);
  for (let pass = 0; pass < 5; pass++) for (let t = 0; t < nT; t++) { cnt.fill(0); for (const o of nb[t]) cnt[cls[o]]++; let best = cls[t]; for (let c = 0; c < 6; c++) if (cnt[c] >= 2 && cnt[c] > cnt[best]) best = c; cls[t] = best; }
  // 4. islands: a patch smaller than minIsland triangles joins the part around it; the old texture lights go too
  for (let round = 0; round < 3; round++) {
    const seen = new Int32Array(nT).fill(-1);
    for (let t0 = 0; t0 < nT; t0++) {
      if (seen[t0] >= 0) continue; const c = cls[t0], comp = [t0]; seen[t0] = t0;
      for (let q = 0; q < comp.length; q++) for (const o of nb[comp[q]]) if (seen[o] < 0 && cls[o] === c) { seen[o] = t0; comp.push(o); }
      if (comp.length >= minIsland && (keepLights || c !== PART.L)) continue;
      cnt.fill(0); for (const t of comp) for (const o of nb[t]) if (cls[o] !== c) cnt[cls[o]]++;
      let best = c === PART.L ? PART.D : c, bn = 0; for (let k = 0; k < 6; k++) if (k !== PART.L && cnt[k] > bn) { bn = cnt[k]; best = k; }
      for (const t of comp) cls[t] = best;
    }
  }
  // 5. a new geometry, triangles sorted by part, one group per part; the old normals are kept, no texture
  const order = Array.from({ length: nT }, (_, t) => t).sort((a, b) => cls[a] - cls[b]), out = new Float32Array(nT * 9), nor = new Float32Array(nT * 9), nrm = src.attributes.normal;
  // smooth normals: every corner takes the average of the faces round its welded point that bend less than 40° from its
  // own face (so curved panels shade smoothly like fresh paint, sharp creases stay sharp)
  const fn = new Float32Array(nT * 3), byP = new Map(), A = new THREE.Vector3(), Bv = new THREE.Vector3(), C = new THREE.Vector3();
  for (let t = 0; t < nT; t++) { A.fromBufferAttribute(pos, vi(t, 0)); Bv.fromBufferAttribute(pos, vi(t, 1)); C.fromBufferAttribute(pos, vi(t, 2)); const n = Bv.sub(A).cross(C.sub(A)); const l = n.length() || 1; fn.set([n.x, n.y, n.z], t * 3); for (let k = 0; k < 3; k++) { const p = P[t * 3 + k]; (byP.get(p) || byP.set(p, []).get(p)).push(t); } void l; }
  const cosT = Math.cos(40 * Math.PI / 180), unit = (t) => { const x = fn[t * 3], y = fn[t * 3 + 1], z = fn[t * 3 + 2], l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  order.forEach((t, j) => { const ft = unit(t); for (let k = 0; k < 3; k++) { const a = vi(t, k); out.set([pos.getX(a), pos.getY(a), pos.getZ(a)], j * 9 + k * 3); let sx = 0, sy = 0, sz = 0; for (const o of byP.get(P[t * 3 + k])) { const fo = unit(o); if (fo[0] * ft[0] + fo[1] * ft[1] + fo[2] * ft[2] >= cosT) { sx += fn[o * 3]; sy += fn[o * 3 + 1]; sz += fn[o * 3 + 2]; } } const l = Math.hypot(sx, sy, sz) || 1; nor.set([sx / l, sy / l, sz / l], j * 9 + k * 3); } });
  void nrm;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(out, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  let start = 0; for (let c = 0; c < 6; c++) { let n = 0; for (const t of order) if (cls[t] === c) n++; if (n) g.addGroup(start * 3, n * 3, c); start += n; }
  g.computeBoundingBox(); g.computeBoundingSphere(); g.userData.parts = Array.from({ length: 6 }, (_, c) => order.filter((t) => cls[t] === c).length);
  return g;
}
const cleanMats = new Map();
// ---- (v283, the user: "make the green, red and blue this metal style, exact colour, so it has contrast") ----
// BRUSHED METAL PAINTS. Each takes its colours straight from the user's brushed-metal picture (sampled: the darkest 1 %,
// the middle, the brightest 10 % and the top 0.5 % highlight). The shader keeps the game's lighting only as a hint
// and paints every pixel from that palette: dark where the panel faces the floor or sits in shadow, the middle tone,
// and bright bands + highlights where it "reflects" a studio of long light strips (a horizon strip, a softer upper
// strip and two tall soft boxes, so the bands slide over the bodywork as the kart turns). Fine brushed lines run front
// to back (they depend on the model's x and y only), fading out when they would be smaller than a pixel. No tone
// mapping, so the colours on screen are the picture's. (v281's flat #ff0000 red became Metal Red.)
export const METALS = {
  '#df0707': { name: 'Metal Red',   stops: ['#640101', '#900302', '#df0707', '#e85959'] },
  '#1853a0': { name: 'Metal Blue',  stops: ['#030b1e', '#092963', '#1853a0', '#2873bc'] },
  '#2b8e72': { name: 'Metal Green', stops: ['#052414', '#0f4e36', '#2b8e72', '#55baa0'] },
};
export const metalOf = (c) => METALS[String(c || '').toLowerCase()] || null;
// a swatch for the paint pickers: the metal as a brushed gradient, any other paint as its flat colour
export const swatchCSS = (c) => { const M = metalOf(c); if (!M) return c; const [d, m, b, h] = M.stops;
  return `repeating-linear-gradient(0deg,rgba(255,255,255,.07) 0 1px,rgba(0,0,0,.08) 1px 2px,transparent 2px 4px),linear-gradient(165deg,${d} 0%,${m} 26%,${b} 44%,${h} 50%,${b} 56%,${m} 74%,${d} 100%)`; };
const METAL_VERT = '#include <begin_vertex>\nvMtlPos = transformed * vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));';
const METAL_FRAG = `
  {
    // the studio: what this pixel would reflect (world space)
    vec3 mV = normalize(vViewPosition), mR = inverseTransformDirection(reflect(-mV, normal), viewMatrix);
    float my = mR.y, maz = atan(mR.x, mR.z);
    float band = .16 + .08 * my
      + 1.05 * exp(-pow((my - .06) / .085, 2.))
      + .42 * exp(-pow((my - .52) / .15, 2.))
      + .6 * pow(max(0., cos(2. * maz + .7)), 14.) * smoothstep(-.15, .3, my);
    band *= mix(.4, 1., smoothstep(-.3, .02, my));
    // the game's own light on a white surface: shadows and the sun's side still count
    float mLum = dot(outgoingLight, vec3(.2126, .7152, .0722)), shade = 1. - exp(-mLum * .9);
    float t = clamp(band * .78 + shade * .42 - .2, 0., 1.);
    vec3 mc = t < .45 ? mix(uMtl0, uMtl1, t / .45) : t < .82 ? mix(uMtl1, uMtl2, (t - .45) / .37) : mix(uMtl2, uMtl3, (t - .82) / .18);
    // brushed lines along the kart (front to back), fading out below a pixel
    vec2 mp = vMtlPos.xy;
    float f1 = 150., fw = max(length(fwidth(mp)) * f1, 1e-4), fade = clamp(1.7 - fw, 0., 1.);
    float s = 1. + .34 * fade * (mtlNoise(mp * f1) - .5) + .18 * (mtlNoise(vec2(mp.x * 30., mp.y * 30.) + 7.3) - .5);
    outgoingLight = mc * s;
  }
  #include <opaque_fragment>`;
const METAL_HEAD = `varying vec3 vMtlPos; uniform vec3 uMtl0; uniform vec3 uMtl1; uniform vec3 uMtl2; uniform vec3 uMtl3;
float mtlHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mtlNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mtlHash(i), mtlHash(i + vec2(1., 0.)), f.x), mix(mtlHash(i + vec2(0., 1.)), mtlHash(i + vec2(1., 1.)), f.x), f.y); }
`;
// turn a material into a brushed-metal paint (in place): white, matte, no tone mapping, the palette in the shader
export function makeMetal(THREE, mat, c) {
  const M = metalOf(c); if (!M) return mat;
  const U = M.stops.map((h) => ({ value: new THREE.Color(h) }));   // (sRGB in, linear for the shader; the output turns it back)
  mat.color = new THREE.Color('#ffffff'); mat.map = null; mat.roughness = 1; mat.metalness = 0; mat.toneMapped = false;
  if ('clearcoat' in mat) mat.clearcoat = 0; if ('specularIntensity' in mat) mat.specularIntensity = 0;
  mat.envMapIntensity = .6;
  mat.onBeforeCompile = (sh) => {
    U.forEach((u, i) => { sh.uniforms['uMtl' + i] = u; });
    sh.vertexShader = 'varying vec3 vMtlPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', METAL_VERT);
    sh.fragmentShader = METAL_HEAD + sh.fragmentShader.replace('#include <opaque_fragment>', METAL_FRAG);
  };
  mat.customProgramCacheKey = () => 'fk-metal-1';
  // a copy stays metal (three.js copies drop onBeforeCompile; the lobby clones the driver's helmet to clip the feet)
  mat.userData.metal = c; mat.clone = function () { return makeMetal(THREE, THREE.Material.prototype.clone.call(this), c); };
  mat.needsUpdate = true; return mat;
}
// the six materials of a clean model: [paint, carbon, trim, accent, white, light]
function cleanMaterials(THREE, main, accent, light, { gloss = false } = {}) {
  const k = main + accent + light + gloss; if (cleanMats.has(k)) return cleanMats.get(k);
  const S = (o) => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...o });
  const m = [
    metalOf(main) ? makeMetal(THREE, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }), main)
    : gloss ? new THREE.MeshPhysicalMaterial({ color: main, roughness: .32, metalness: .1, clearcoat: 1, clearcoatRoughness: .12, side: THREE.DoubleSide }) : new THREE.MeshPhysicalMaterial({ color: main, roughness: .5, metalness: .05, clearcoat: .35, clearcoatRoughness: .45, side: THREE.DoubleSide }),
    S({ color: '#16171e', roughness: .62, metalness: .25 }),
    S({ color: '#5a6070', roughness: .3, metalness: .75 }),
    S({ color: accent, roughness: .35, metalness: .45 }),
    S({ color: '#eef0f6', roughness: .4, metalness: .05 }),
    S({ color: light, emissive: light, emissiveIntensity: 1.2, roughness: .4 }),
  ];
  cleanMats.set(k, m); return m;
}
function withNodes(k) {
  k.nodes = {}; k.traverse((o) => { if (o.name) k.nodes[o.name] = o; });
  k.clone = function () { return withNodes(Object.getPrototypeOf(this).clone.call(this, true)); };
  return k;
}

/* ---------- the kart ---------- */
let KART = null;
// the wheels are built here, so their turning shows clearly: tread blocks with one yellow mark, five silver spokes,
// a hub cap in the body colour and a glowing ring in the light colour. [tyre radius, width, side (+1 = left)]
// (v5: smaller wheels — the groups are lowered so the tyres still touch the ground)
export const WHEEL_SIZE = { WheelFrontLeft: [.215, .24, 1], WheelFrontRight: [.215, .24, -1], WheelRearLeft: [.225, .28, 1], WheelRearRight: [.225, .28, -1] };
let wheelParts = null;
function wheelGeos(THREE) {
  if (wheelParts) return wheelParts;
  const tread = document.createElement('canvas'); tread.width = 512; tread.height = 64; const x = tread.getContext('2d');
  x.fillStyle = '#1c1c22'; x.fillRect(0, 0, 512, 64); x.fillStyle = '#3a3a44';
  for (let i = 0; i < 16; i++) { const u = i * 32; x.beginPath(); x.moveTo(u, 4); x.lineTo(u + 18, 4); x.lineTo(u + 26, 32); x.lineTo(u + 18, 60); x.lineTo(u, 60); x.lineTo(u + 8, 32); x.closePath(); x.fill(); }
  x.fillStyle = '#ffd23a'; x.fillRect(0, 0, 22, 64);   // one bright mark on the tread, so even a blur shows the turn
  const tt = new THREE.CanvasTexture(tread); tt.colorSpace = THREE.SRGBColorSpace;
  const side = document.createElement('canvas'); side.width = side.height = 256; const y = side.getContext('2d');
  y.fillStyle = '#18181e'; y.fillRect(0, 0, 256, 256); y.strokeStyle = '#40404a'; y.lineWidth = 12;
  for (let i = 0; i < 4; i++) { y.beginPath(); y.arc(128, 128, 108, i * Math.PI / 2 + .25, i * Math.PI / 2 + 1.15); y.stroke(); }   // raised arcs on the sidewall
  const st = new THREE.CanvasTexture(side); st.colorSpace = THREE.SRGBColorSpace;
  wheelParts = {
    tyre: new THREE.CylinderGeometry(1, 1, 1, 48, 1, true).rotateZ(Math.PI / 2),
    wall: new THREE.RingGeometry(.6, 1, 48, 1).rotateY(Math.PI / 2),
    rimDisc: new THREE.CylinderGeometry(.6, .6, .9, 36).rotateZ(Math.PI / 2),
    spoke: new THREE.BoxGeometry(1, 1, 1),
    hub: new THREE.CylinderGeometry(.2, .24, .3, 24).rotateZ(Math.PI / 2),
    ring: new THREE.TorusGeometry(.64, .05, 10, 64).rotateY(Math.PI / 2),
    mats: {
      tyre: new THREE.MeshStandardMaterial({ map: tt, roughness: .85 }),
      wall: new THREE.MeshStandardMaterial({ map: st, roughness: .8, side: THREE.DoubleSide }),
      rim: new THREE.MeshStandardMaterial({ color: '#d0d4de', roughness: .22, metalness: .85 }),
      rimDark: new THREE.MeshStandardMaterial({ color: '#2a2c34', roughness: .5, metalness: .5 }),
    },
  };
  return wheelParts;
}
const glowMats = new Map(), capMats = new Map();
const glowMat = (THREE, c) => glowMats.get(c) || glowMats.set(c, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1, roughness: .4 })).get(c);
const capMat = (THREE, c) => capMats.get(c) || capMats.set(c, (metalOf(c) ? makeMetal(THREE, new THREE.MeshStandardMaterial(), c) : new THREE.MeshStandardMaterial({ color: c, roughness: .3, metalness: .3 }))).get(c);   // (v283: a metal paint's hub caps are brushed metal too)
// (v5) a detailed wheel: a rounded tyre with 24 raised tread blocks and a yellow mark, a sidewall ring, a dark dished
// rim with six split spokes, five lug nuts and a centre cap in the body colour, a glowing ring in the light colour; the
// brake disc and the calliper (light colour) sit on the group, so they steer but do not spin
let wheelParts5 = null;
function wheelGeos5(THREE) {
  if (wheelParts5) return wheelParts5;
  // the tyre: a rounded profile turned round the axle (a lathe), the axle along X; unit radius, unit width
  const prof = [[.6, -.5], [.86, -.5], [.95, -.46], [.99, -.36], [1, -.2], [1, .2], [.99, .36], [.95, .46], [.86, .5], [.6, .5]].map(([r, y]) => new THREE.Vector2(r, y));
  const tyre = new THREE.LatheGeometry(prof, 56).rotateZ(Math.PI / 2); tyre.computeVertexNormals();
  wheelParts5 = {
    tyre, band: new THREE.CylinderGeometry(.98, .98, .7, 48, 1, true).rotateZ(Math.PI / 2), block: new THREE.BoxGeometry(.66, .09, .16),
    dish: new THREE.CylinderGeometry(.62, .56, .5, 36).rotateZ(Math.PI / 2), spoke: new THREE.BoxGeometry(.08, .5, .07), nut: new THREE.CylinderGeometry(.045, .045, .06, 6).rotateZ(Math.PI / 2),
    cap: new THREE.CylinderGeometry(.16, .19, .14, 24).rotateZ(Math.PI / 2), ring: new THREE.TorusGeometry(.6, .035, 8, 56).rotateY(Math.PI / 2),
    disc: new THREE.CylinderGeometry(.5, .5, .05, 32).rotateZ(Math.PI / 2), cal: new THREE.BoxGeometry(.2, .3, .26), mark: new THREE.BoxGeometry(.67, .1, .2),
    mats: {
      tyre: new THREE.MeshStandardMaterial({ color: '#1d1e24', roughness: .88, side: THREE.DoubleSide }), block: new THREE.MeshStandardMaterial({ color: '#2b2c34', roughness: .9 }),
      rim: new THREE.MeshStandardMaterial({ color: '#2a2d36', roughness: .35, metalness: .7 }), spoke: new THREE.MeshStandardMaterial({ color: '#c8ccd8', roughness: .22, metalness: .9 }),
      nut: new THREE.MeshStandardMaterial({ color: '#e0e4ee', roughness: .2, metalness: .95 }), disc: new THREE.MeshStandardMaterial({ color: '#8a8e98', roughness: .3, metalness: .85 }),
      mark: new THREE.MeshStandardMaterial({ color: '#ffd23a', roughness: .5 }),
    },
  };
  return wheelParts5;
}
function buildWheel(THREE, r, wdt, side, skin) {
  const W = wheelGeos5(THREE), M = W.mats, spin = new THREE.Group(); spin.name = 'Spin';
  const add = (geo, mat, sx, sy, sz, px = 0, name, parent = spin) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.x = px; m.castShadow = true; if (name) m.name = name; parent.add(m); return m; };
  add(W.tyre, M.tyre, wdt, r, r);
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, b = add(W.block, i ? M.block : M.mark, wdt * 1.18, r, r); b.position.y = Math.cos(a) * r * .99; b.position.z = Math.sin(a) * r * .99; b.rotation.x = -a; }
  const o = side * wdt * .08;
  add(W.dish, M.rim, wdt * .9, r, r, o);
  for (let i = 0; i < 12; i++) { const a = Math.floor(i / 2) * Math.PI / 3 + (i % 2 ? .1 : -.1), sp = add(W.spoke, M.spoke, wdt, r, r, o + side * wdt * .34); sp.position.y = Math.cos(a) * r * .34; sp.position.z = Math.sin(a) * r * .34; sp.rotation.x = -a; }
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, n = add(W.nut, M.nut, wdt, r, r, o + side * wdt * .46); n.position.y = Math.cos(a) * r * .1; n.position.z = Math.sin(a) * r * .1; }
  add(W.cap, capMat(THREE, skin.body), wdt, r, r, o + side * wdt * .4, 'HubCap');
  add(W.ring, glowMat(THREE, skin.light), .3, r * 1.05, r * 1.05, o + side * wdt * .46, 'RimLight');   // (a thin glowing line round the rim)
  return spin;
}
// the parts on the wheel's group that steer with it but do not spin: the brake disc and the calliper
function buildBrake(THREE, r, wdt, side, skin) {
  const W = wheelGeos5(THREE), g = new THREE.Group(); g.name = 'Brake';
  const d = new THREE.Mesh(W.disc, W.mats.disc); d.scale.set(wdt, r, r); d.position.x = -side * wdt * .12; g.add(d);
  const c = new THREE.Mesh(W.cal, glowMat(THREE, skin.light)); c.scale.set(wdt, r, r); c.position.set(-side * wdt * .12, r * .32, -r * .28); c.rotation.x = .5; g.add(c);
  return g;
}
export async function loadDefaultKart(THREE, GLTFLoader, url = 'kart-default.glb', upgrade = false) {   // (v277: upgrade swaps the low-res start-up model for the full one, in one step)
  if (!KART || upgrade) {
    const next = study((await new GLTFLoader().loadAsync(url)).scene);
    // the clean repaint: the body and the steering wheel get sorted geometry (the texture lights are folded in: the neon
    // strips replace them), then straight neon strips are traced along the body
    const N = {}; next.scene.traverse((o) => { if (o.name) N[o.name] = o; });
    for (const o of [N.Body, N.SteeringWheelMesh]) if (o && o.isMesh) o.geometry = cleanGeometry(THREE, o, next, { keepLights: false, minIsland: o === N.Body ? 40 : 12 });
    next.strips = neonStrips(THREE, N.Body);
    KART = next; kartMats.clear(); cleanMats.clear();
  }
  return withNodes(KART.scene.clone(true));
}
// straight neon strips that hug the body (measured on the Meshy kart): rays are cast at the body along straight lines
// — the front lip, the nose, the tail, the side pods and their top edges — and the longest unbroken run of hits on each
// line becomes a thin tube 1.4 cm off the surface
function neonStrips(THREE, body) {
  body.updateMatrixWorld(true); const rc = new THREE.Raycaster(), inv = body.matrixWorld.clone().invert(), lines = [], V = (x, y, z) => new THREE.Vector3(x, y, z);
  // (v11, the user: "flatter, more to the car") the strips now lie 3 mm off the body as flat LED tape, not round tubes
  const cast = (o, d) => { rc.set(o, d); const h = rc.intersectObject(body, false)[0]; return h ? h.point.clone().addScaledVector(d, -.003) : null; };
  const trace = (n, from, dir) => {
    let run = [], best = [];
    for (let i = 0; i < n; i++) { const p = cast(from(i / (n - 1)), dir); if (p && (!run.length || p.distanceTo(run[run.length - 1]) < .12)) run.push(p); else { if (run.length > best.length) best = run; run = p ? [p] : []; } }
    if (run.length > best.length) best = run; if (best.length >= 5) lines.push({ p: best, n: dir.clone().negate() });
  };
  trace(22, (t) => V(-.55 + 1.1 * t, .2, 2), V(0, 0, -1));      // the front lip
  trace(10, (t) => V(-.18 + .36 * t, .45, 2), V(0, 0, -1));     // the nose
  trace(14, (t) => V(-.28 + .56 * t, .22, -2), V(0, 0, 1));     // the tail
  for (const sd of [-1, 1]) { trace(16, (t) => V(sd * 2, .28, -.26 + .38 * t), V(-sd, 0, 0)); trace(16, (t) => V(sd * .56, 2, -.24 + .36 * t), V(0, -1, 0)); }   // the side pods: the flank and the top edge
  // each strip: the tape itself, and a wider soft glow round it (index: tape, glow, tape, glow, ...)
  return lines.flatMap(({ p, n }) => { const c = new THREE.CatmullRomCurve3(p); return [ledTape(THREE, c, n, p.length * 3, .024, inv), ledTape(THREE, c, n, p.length * 3, .075, inv, .0015)]; });
}
// a flat LED tape along a curve on the body: a thin strip facing out (n), slightly rounded at the edges by a lower
// outer row, built in world units and moved into the body's own frame
function ledTape(THREE, curve, n, segs, width, inv, under = 0) {
  const pos = [], idx = [], N = segs + 1, half = width / 2, across = [-1, -.6, .6, 1], lift = [0, .0025, .0025, 0].map((v) => v - under);
  for (let i = 0; i < N; i++) {
    const t = i / segs, P = curve.getPointAt(t), T = curve.getTangentAt(t), A = new THREE.Vector3().crossVectors(T, n).normalize();
    for (let k = 0; k < 4; k++) { const v = P.clone().addScaledVector(A, across[k] * half).addScaledVector(n, lift[k]).applyMatrix4(inv); pos.push(v.x, v.y, v.z); }
  }
  for (let i = 0; i < segs; i++) for (let k = 0; k < 3; k++) { const a = i * 4 + k, b = a + 4; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// the LED tape glows at full strength: not dulled by the tone mapping, a touch paler at the core like a real LED
const ledMats = new Map();
const ledMat = (THREE, c, glow = false) => { const k = c + glow; return ledMats.get(k) || ledMats.set(k, glow
  ? new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: true, opacity: .32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 })
  : new THREE.MeshBasicMaterial({ color: new THREE.Color(c).lerp(new THREE.Color('#ffffff'), .14), toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })).get(k); };

const kartMats = new Map();
export function skinMaterial(THREE, skin = DEFAULT_SKIN) {
  const s = { ...DEFAULT_SKIN, ...skin }, key = s.body + s.light;
  if (!kartMats.has(key)) kartMats.set(key, paint(THREE, KART, s.body, null, s.light, true));
  return kartMats.get(key);
}

/* ---------- the helmet ---------- */
let HELMET = null;
export async function loadHelmet(THREE, GLTFLoader, url = 'helmet.glb', upgrade = false) {
  if (!HELMET || upgrade) { const prev = HELMET; HELMET = study((await new GLTFLoader().loadAsync(url)).scene, { orange: true, minL: .17, pale: false }); if (prev) helmMats.clear(); const sh = HELMET.scene.getObjectByName('Shell'); sh.traverse((o) => { if (o.isMesh) o.geometry = cleanGeometry(THREE, o, HELMET, { keepLights: true, minIsland: 24 }); }); }
  return withNodes(HELMET.scene.clone(true));
}
const helmMats = new Map();
export function helmetMaterial(THREE, skin = DEFAULT_HELMET) {
  const s = { ...DEFAULT_HELMET, ...skin }, key = s.main + s.accent + s.light;
  if (!helmMats.has(key)) helmMats.set(key, paint(THREE, HELMET, s.main, s.accent, s.light));
  return helmMats.get(key);
}

/* ---------- the LED logo plates ---------- */
function drawLogo(x, id, S) {
  const c = S / 2, k = S / 256;
  x.beginPath();
  if (id === 'fox') { const p = [[-62, -58], [-30, -22], [30, -22], [62, -58], [70, 6], [40, 40], [0, 66], [-40, 40], [-70, 6]]; p.forEach(([a, b], i) => (i ? x.lineTo : x.moveTo).call(x, c + a * k, c + b * k)); x.closePath(); x.moveTo(c - 30 * k, c + 8 * k); x.lineTo(c - 14 * k, c + 14 * k); x.moveTo(c + 30 * k, c + 8 * k); x.lineTo(c + 14 * k, c + 14 * k); x.moveTo(c - 8 * k, c + 44 * k); x.lineTo(c, c + 50 * k); x.lineTo(c + 8 * k, c + 44 * k); }
  else if (id === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? 32 : 76) * k; (i ? x.lineTo : x.moveTo).call(x, c + Math.cos(a) * r, c + 6 * k + Math.sin(a) * r); } x.closePath(); }
  else if (id === 'heart') { x.moveTo(c, c + 62 * k); x.bezierCurveTo(c - 90 * k, c, c - 60 * k, c - 70 * k, c, c - 30 * k); x.bezierCurveTo(c + 60 * k, c - 70 * k, c + 90 * k, c, c, c + 62 * k); x.closePath(); }
  else if (id === 'bolt') { const p = [[12, -76], [-44, 10], [-4, 10], [-16, 76], [44, -10], [4, -10]]; p.forEach(([a, b], i) => (i ? x.lineTo : x.moveTo).call(x, c + a * k, c + b * k)); x.closePath(); }
  else if (id === 'paw') { x.moveTo(c + 40 * k, c + 30 * k); x.ellipse(c, c + 30 * k, 40 * k, 32 * k, 0, 0, Math.PI * 2); for (const [a, b] of [[-50, -14], [-18, -46], [18, -46], [50, -14]]) { x.moveTo(c + (a + 16) * k, c + b * k); x.ellipse(c + a * k, c + b * k, 16 * k, 20 * k, 0, 0, Math.PI * 2); } }
  else if (id === 'crown') { const p = [[-70, 50], [-70, -30], [-35, 10], [0, -56], [35, 10], [70, -30], [70, 50]]; p.forEach(([a, b], i) => (i ? x.lineTo : x.moveTo).call(x, c + a * k, c + b * k)); x.closePath(); }
}
export function logoCanvas(id, logoColor, body, S = 256, plate = true) {
  const cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d');
  if (plate) { const [h, s, l] = rgb2hsl(...hex(body).map((v) => v / 255)), q = hsl2rgb(h, Math.min(1, s * .9), Math.min(.16, l * .3)); x.fillStyle = `rgb(${q.map((v) => v * 255 | 0)})`; x.beginPath(); x.roundRect(4, 4, S - 8, S - 8, S * .2); x.fill(); }
  if (id !== 'none') {
    x.lineJoin = x.lineCap = 'round'; drawLogo(x, id, S);
    x.strokeStyle = logoColor; x.lineWidth = S * .07; x.shadowColor = logoColor; x.shadowBlur = plate ? S * .06 : 0; x.stroke();
    x.shadowBlur = 0; x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = S * .022; x.stroke();
  }
  return cv;
}
const plateCache = new Map(); let plateGeo = null;
// logoPlate(THREE, skin) or logoPlate(THREE, logo, logoColor, plateColor): a 1 × 1 plate for a LogoAnchor
export function logoPlate(THREE, logo, logoColor, plateColor) {
  if (typeof logo === 'object') { const s = { ...DEFAULT_SKIN, ...logo }; [logo, logoColor, plateColor] = [s.logo, s.logoColor, s.body]; }
  const key = logo + logoColor + plateColor;
  if (!plateCache.has(key)) {
    const t = new THREE.CanvasTexture(logoCanvas(logo, logoColor, plateColor)); t.colorSpace = THREE.SRGBColorSpace;
    plateCache.set(key, new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: .9, roughness: .35, alphaTest: .5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
  }
  plateGeo = plateGeo || new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.Mesh(plateGeo, plateCache.get(key)); mesh.name = 'LogoPlate'; return mesh;
}
function setPlate(anchor, plate) { const old = anchor.getObjectByName('LogoPlate'); if (old) anchor.remove(old); anchor.add(plate); return plate; }

/* ---------- dressing ---------- */
// put a look on a loaded (or cloned) kart: paint, lights, logo and the wheels
export function dressKart(THREE, kart, skin = DEFAULT_SKIN) {
  const s = { ...DEFAULT_SKIN, ...skin }, mats = cleanMaterials(THREE, s.body, s.light, s.light);
  kart.nodes.Body.material = mats;
  const sw = kart.nodes.SteeringWheelMesh; if (sw) sw.material = [mats[1], mats[1], mats[2], mats[3], mats[4], mats[5]];   // (a dark grip: the wheel's paint parts go carbon)
  // the neon strips along the body, in the light colour
  if (!kart.nodes.Body.getObjectByName('Neon') && KART.strips) { const g = new THREE.Group(); g.name = 'Neon'; KART.strips.forEach((geo, i) => { const m = new THREE.Mesh(geo, ledMat(THREE, s.light, i % 2 === 1)); m.userData.glow = i % 2 === 1; m.renderOrder = m.userData.glow ? 2 : 1; g.add(m); }); kart.nodes.Body.add(g); }
  else if (kart.nodes.Body.getObjectByName('Neon')) kart.nodes.Body.getObjectByName('Neon').traverse((o) => { if (o.isMesh) o.material = ledMat(THREE, s.light, !!o.userData.glow); });
  for (const [name, [r, w, side]] of Object.entries(WHEEL_SIZE)) {
    const g = kart.nodes[name]; for (const n of ['Spin', 'Brake']) { const old = g.getObjectByName(n); if (old) g.remove(old); }
    if (g.userData.y0 === undefined) g.userData.y0 = g.position.y; g.position.y = r;   // (the smaller tyre still touches the ground)
    g.add(buildWheel(THREE, r, w, side, s)); g.add(buildBrake(THREE, r, w, side, s));
  }
  const p = setPlate(kart.nodes.LogoAnchor, logoPlate(THREE, s.logo, s.logoColor, s.body));
  p.position.y = -.08; p.scale.setScalar(1.22);   // a bit bigger and further forward, so it covers the panel's painted fox
  return kart;
}
// the helmet is closed underneath (the driver's head is cut off at the neck): a dark padded cap that fills the
// opening, its outline measured inside the shell 0.185 m below the centre (distances every 22.5°, from the front)
let capMesh = null;
function neckCap(THREE) {
  if (!capMesh) {
    const d = [.335, .307, .26, .232, .225, .239, .265, .287, .294, .286, .264, .239, .224, .232, .26, .307], sh = new THREE.Shape();
    d.forEach((r, k) => { const a = k / 16 * Math.PI * 2, x = Math.sin(a) * r * .99, z = Math.cos(a) * r * .99; k ? sh.lineTo(x, z) : sh.moveTo(x, z); });
    const g = new THREE.ShapeGeometry(sh, 8).rotateX(Math.PI / 2);
    capMesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#1c1626', roughness: .9, side: THREE.DoubleSide })); capMesh.position.y = -.185; capMesh.name = 'NeckCap';
  }
  return capMesh.clone();
}
// put a look on a loaded (or cloned) helmet: main + accent colours, lights and the logo above the visor
export function dressHelmet(THREE, helmet, skin = DEFAULT_HELMET) {
  const s = { ...DEFAULT_HELMET, ...skin }, m = cleanMaterials(THREE, s.main, s.accent, s.light, { gloss: true });
  helmet.nodes.Shell.traverse((o) => { if (o.isMesh) o.material = m; });
  setPlate(helmet.nodes.LogoAnchor, logoPlate(THREE, s.logo, s.logoColor, s.main)).scale.setScalar(1.25);
  if (!helmet.getObjectByName('NeckCap')) helmet.add(neckCap(THREE));
  return helmet;
}
// a small picture of a logo for the garage buttons
export const logoIconURL = (id, color = DEFAULT_SKIN.logoColor) => logoCanvas(id, color, '#1b1440', 96).toDataURL();
