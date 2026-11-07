/* =====================================================================================================
   FOXKARTS · rear wings for the Gummy Kart (kart-default.glb space: faces +Z, Y up, floor y = 0, metres)
   ─────────────────────────────────────────────────────────────────────────────────────────────────────
   Nine add-ons, slowest to fastest, all built in code and all LOW: nothing rises above the seat back (0.84 m),
   so the chase camera still sees the road over them.
   Every one is bolted to the real kart: the rear deck was scanned (DECK_T below, 2.5 cm × 2 cm grid) and every
   foot, fin base and moulded lip sits on that surface. The deck is flat (0.43 m) just behind the seat
   (z -0.82…-0.90 in the middle, -0.78…-0.92 beside the seat at |x| 0.18…0.35) and then falls to 0.21 m at the
   tail, so the feet go on the flat band and the posts lean back to the blade.
     import { buildRearWing, REAR_WINGS } from './rear-wings.js';
     kart.add(buildRearWing(THREE, 'comet', { body, light, logo, logoColor }, { logoCanvas }));
   G.userData.check lists every foot and every post end (used by the attachment test).
   No additive blending and nothing see-through (the phone rule): LEDs are solid unlit colour, logos are alphaTest.
   ===================================================================================================== */
export const REAR_WINGS = [
  { id: 'ducktail', name: 'Duck Tail', speed: 1, line: 'A little lip moulded into the tail.',
    parts: ['Moulded into the tail in the body colour', 'Black kick-up face at the back', 'Two small black side fences', 'LED tape along the lip'] },
  { id: 'rookie', name: 'Rookie', speed: 2, line: 'A flat plank on two square posts.',
    parts: ['Flat blade in the body colour', 'Two square black posts bolted to the deck', 'Small square black endplates', 'One light stripe down the middle'] },
  { id: 'arrow', name: 'Arrow', speed: 3, line: 'A swept blade that points forward like an arrow.',
    parts: ['Blade swept back 8 cm at the tips', 'Twin swan-neck pylons', 'Raked endplates with two speed slots', 'LED tape on the endplate tops'] },
  { id: 'hoop', name: 'Hoop', speed: 4, line: 'A blade resting on one bent black tube.',
    parts: ['One black tube bent into a hoop', 'Blade sits on the hoop with four clamps', 'Black winglets bent down at the tips', 'Twin racing stripes on top'] },
  { id: 'stingray', name: 'Stingray', speed: 5, line: 'A wide ray-shaped blade on one shark fin.',
    parts: ['Ray-shaped blade, tips swept back and down', 'Black shark-fin pylon on the tail', 'Black ray markings on top', 'LED tape on the fin edge'] },
  { id: 'twinjet', name: 'Twin Jet', speed: 6, line: 'Two blades with an air gap, like a real race car.',
    parts: ['Main plane + steep flap with a slot gap', 'Centre pylon with a DRS pod and push-rod', 'Endplates with five slanted louvres', 'LED tape on the flap edge'] },
  { id: 'stacker', name: 'Stacker', speed: 7, line: 'Three black slats stacked like a ladder.',
    parts: ['Three staggered carbon slats', 'Body-colour endplates hold them', 'V-posts bolted to the deck', 'An LED line on every slat'] },
  { id: 'razor', name: 'Razor', speed: 8, line: 'A thin black blade hung from two swan necks.',
    parts: ['Thin carbon blade, tips swept forward', 'Body-colour swan necks hold it from above', 'Dagger endplates with LED edges', 'A body-colour slash across the top'] },
  { id: 'comet', name: 'Comet', speed: 9, line: 'An arched blade that flows into two comet-tail fins.',
    parts: ['One arched blade that bends into the fins', 'Comet-tail fins with three shrinking holes', 'Glowing LED channel along the front edge', 'V-struts on ball joints'] },
];
const DEF = { body: '#7a28dc', light: '#ffa424', logo: 'fox', logoColor: '#ffa424' };

/* ---------- the scanned rear deck ---------- */
// DECK_T[i][j]: the body's top at |x| = i × 0.025 and z = -0.70 - j × 0.02 (raycast straight down; the seat shows as
// 0.8 near the middle). Past the tail end the values carry the slope on, so a lip can hang just over the edge.
const DECK_T = [[0.822,0.83,0.838,0.834,0.83,0.825,0.801,0.435,0.434,0.432,0.426,0.414,0.401,0.381,0.348,0.303,0.251,0.209,0.167,0.125,0.083],
  [0.82,0.829,0.838,0.834,0.83,0.826,0.435,0.435,0.434,0.432,0.426,0.414,0.401,0.38,0.348,0.303,0.251,0.209,0.167,0.125,0.083],
  [0.819,0.83,0.836,0.834,0.83,0.825,0.434,0.435,0.435,0.432,0.426,0.414,0.401,0.38,0.348,0.303,0.251,0.208,0.165,0.122,0.079],
  [0.818,0.831,0.833,0.832,0.829,0.82,0.434,0.435,0.435,0.432,0.426,0.415,0.401,0.38,0.348,0.303,0.252,0.207,0.162,0.117,0.072],
  [0.813,0.831,0.829,0.828,0.825,0.813,0.434,0.436,0.435,0.432,0.426,0.415,0.401,0.379,0.348,0.303,0.252,0.204,0.156,0.108,0.06],
  [0.808,0.822,0.822,0.82,0.816,0.797,0.434,0.436,0.435,0.432,0.426,0.415,0.401,0.379,0.348,0.303,0.252,0.201,0.15,0.099,0.048],
  [0.799,0.798,0.801,0.8,0.787,0.431,0.434,0.435,0.435,0.432,0.426,0.415,0.401,0.379,0.348,0.303,0.252,0.199,0.146,0.093,0.04],
  [0.733,0.734,0.739,0.731,0.427,0.431,0.433,0.434,0.435,0.432,0.426,0.415,0.401,0.379,0.348,0.303,0.252,0.201,0.15,0.099,0.048],
  [0.676,0.673,0.671,0.648,0.424,0.425,0.427,0.429,0.429,0.427,0.42,0.41,0.394,0.369,0.337,0.282,0.256,0.23,0.204,0.178,0.152],
  [0.657,0.655,0.65,0.62,0.426,0.43,0.434,0.435,0.436,0.435,0.431,0.423,0.414,0.395,0.372,0.323,0.262,0.201,0.14,0.079,0.018],
  [0.638,0.636,0.628,0.421,0.427,0.433,0.436,0.438,0.438,0.437,0.432,0.426,0.417,0.402,0.377,0.337,0.28,0.223,0.166,0.109,0.052],
  [0.602,0.588,0.411,0.422,0.428,0.434,0.436,0.437,0.438,0.437,0.432,0.426,0.417,0.401,0.376,0.332,0.277,0.222,0.167,0.112,0.057],
  [0.358,0.366,0.412,0.424,0.429,0.433,0.435,0.437,0.438,0.436,0.432,0.425,0.417,0.4,0.374,0.328,0.27,0.212,0.154,0.096,0.038],
  [0.355,0.358,0.412,0.424,0.43,0.433,0.435,0.437,0.438,0.435,0.431,0.425,0.416,0.399,0.373,0.328,0.261,0.194,0.127,0.06,-0.007],
  [0.36,0.32,0.28,0.422,0.427,0.431,0.434,0.436,0.437,0.434,0.43,0.424,0.416,0.398,0.372,0.327,0.253,0.179,0.105,0.031,-0.043]];
export function deckY(x, z) {
  const fi = Math.min(14, Math.max(0, Math.abs(x) / .025)), fj = Math.min(20, Math.max(0, (-.7 - z) / .02)), i = Math.min(13, Math.floor(fi)), j = Math.min(19, Math.floor(fj)), u = fi - i, v = fj - j, T = DECK_T;
  return (T[i][j] * (1 - u) + T[i + 1][j] * u) * (1 - v) + (T[i][j + 1] * (1 - u) + T[i + 1][j + 1] * u) * v;
}

/* ---------- shared textures ---------- */
let carbonTex = null;
function carbon(THREE) {
  if (carbonTex) return carbonTex;
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  x.fillStyle = '#121318'; x.fillRect(0, 0, S, S);
  // a 2×2 twill: every cell a soft band, alternating direction, offset each row
  for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) {
    const hz = (r + q) % 2 === 0, gx = q * 16, gy = r * 16, g = hz ? x.createLinearGradient(gx, gy, gx, gy + 16) : x.createLinearGradient(gx, gy, gx + 16, gy);
    g.addColorStop(0, '#1a1c24'); g.addColorStop(.5, hz ? '#3a3e4c' : '#2c2f3a'); g.addColorStop(1, '#16171e');
    x.fillStyle = g; x.fillRect(gx + 1, gy + 1, 14, 14);
  }
  carbonTex = new THREE.CanvasTexture(c); carbonTex.wrapS = carbonTex.wrapT = THREE.RepeatWrapping; carbonTex.colorSpace = THREE.SRGBColorSpace; carbonTex.anisotropy = 4;
  return carbonTex;
}
// the paint on top of each blade: a base (the body colour, or black carbon for the Razor) and a pattern in the light
// colour (which also glows) and the body colour. Canvas: x across the span, y = H at the leading edge, 0 at the trailing edge.
function livery(THREE, id, s) {
  const W = 1024, H = 256, mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')]; };
  const [pc, p] = mk(), [ec, e] = mk();
  p.fillStyle = id === 'razor' ? '#15161c' : s.body; p.fillRect(0, 0, W, H); e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  const both = (fn) => { fn(p, s.light); fn(e, s.light); };
  const pin = (ctx, y, col, w = 3) => { ctx.fillStyle = col; ctx.fillRect(0, y, W, w); };
  const text = (t, y, size, col) => { p.save(); p.fillStyle = col; p.font = `900 ${size}px Arial Black, Arial, sans-serif`; p.textAlign = 'center'; p.textBaseline = 'middle'; p.translate(W / 2, y); p.rotate(Math.PI); p.fillText(t, 0, 0); p.restore(); };
  if (id === 'rookie') { both((c, col) => { c.fillStyle = col; c.fillRect(W / 2 - 22, 0, 44, H); }); pin(p, H * .12, '#f4f2ff', 2); }
  else if (id === 'arrow') {
    const chev = (ctx, col, cx, sz, th) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx, H * .86); ctx.lineTo(cx + sz, H * .2); ctx.lineTo(cx + sz - th, H * .2); ctx.lineTo(cx, H * .86 - th * 1.6); ctx.lineTo(cx - sz + th, H * .2); ctx.lineTo(cx - sz, H * .2); ctx.closePath(); ctx.fill(); };
    both((c, col) => { chev(c, col, W / 2, 120, 34); for (let i = 1; i <= 3; i++) for (const sd of [-1, 1]) chev(c, col, W / 2 + sd * (150 + i * 70), 46 - i * 8, 14 - i * 2); });
    pin(p, H * .1, '#f4f2ff'); pin(p, H * .93, '#f4f2ff', 2);
  } else if (id === 'hoop') {
    p.fillStyle = '#15161c'; p.fillRect(W / 2 - 92, 0, 60, H); p.fillRect(W / 2 + 32, 0, 60, H);
    both((c, col) => { c.fillStyle = col; c.fillRect(W / 2 - 26, 0, 8, H); c.fillRect(W / 2 + 18, 0, 8, H); });
  } else if (id === 'stingray') {
    p.fillStyle = '#15161c';
    for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) { const x = W / 2 + sd * (90 + i * 95); p.beginPath(); p.moveTo(x, H * .9); p.lineTo(x + sd * 60, H * .15); p.lineTo(x + sd * 36, H * .15); p.lineTo(x - sd * 16, H * .9); p.closePath(); p.fill(); }
    both((c, col) => { c.fillStyle = col; c.beginPath(); c.arc(W / 2, H * .7, 18, 0, 7); c.fill(); });
  } else if (id === 'twinjet') {
    both((c, col) => { c.fillStyle = col; for (let i = 0; i < 4; i++) { const y = H * (.22 + i * .17), h = 16 - i * 2, len = W * (.34 - i * .05); c.fillRect(0, y, len, h); c.fillRect(W - len, y, len, h); } });
    text('FOXKARTS', H * .55, 64, '#f4f2ff'); pin(p, H * .08, '#f4f2ff', 2);
  } else if (id === 'razor') {
    p.fillStyle = s.body; p.beginPath(); p.moveTo(W * .18, H); p.lineTo(W * .42, H); p.lineTo(W * .82, 0); p.lineTo(W * .58, 0); p.closePath(); p.fill();
    both((c, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(W * .44, H); c.lineTo(W * .47, H); c.lineTo(W * .87, 0); c.lineTo(W * .84, 0); c.closePath(); c.fill(); });
    // carbon weave hint on the black
    p.globalAlpha = .12; p.fillStyle = '#ffffff'; for (let x = 0; x < W; x += 16) for (let y = (x / 16) % 2 ? 0 : 8; y < H; y += 16) p.fillRect(x, y, 8, 8); p.globalAlpha = 1;
  } else if (id === 'comet') {
    for (const ctx of [p, e]) {
      const g = ctx.createRadialGradient(W / 2, H * .82, 4, W / 2, H * .82, 120); g.addColorStop(0, '#ffffff'); g.addColorStop(.25, s.light); g.addColorStop(1, 'rgba(0,0,0,0)');
      for (const sd of [-1, 1]) {
        const t = ctx.createLinearGradient(W / 2, 0, W / 2 + sd * W / 2, 0); t.addColorStop(0, s.light); t.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = t; ctx.beginPath(); ctx.moveTo(W / 2, H * .62); ctx.quadraticCurveTo(W / 2 + sd * W * .25, H * .55, W / 2 + sd * W * .5, H * .2); ctx.lineTo(W / 2 + sd * W * .5, H * .1); ctx.quadraticCurveTo(W / 2 + sd * W * .22, H * .42, W / 2, H * .98); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = ctx === p ? '#ffffff' : s.light; let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 26; i++) { const x = rnd() * W, y = H * (.15 + rnd() * .7), r = 1.5 + rnd() * 3; if (Math.abs(x - W / 2) > 70) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); } }
    }
  }
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return { map: tex(pc), emissiveMap: tex(ec) };
}

/* ---------- materials ---------- */
function mats(THREE, id, s) {
  const cb = carbon(THREE), L = livery(THREE, id, s);
  const P = (o) => new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, ...o });
  return {
    top: P({ color: '#ffffff', map: L.map, emissiveMap: L.emissiveMap, emissive: new THREE.Color('#ffffff'), emissiveIntensity: .75, roughness: .42, metalness: .05, clearcoat: .6, clearcoatRoughness: .25 }),
    paint: P({ color: s.body, roughness: .5, metalness: .05, clearcoat: .35, clearcoatRoughness: .45 }),
    carbon: P({ color: '#ffffff', map: cb, roughness: .45, metalness: .2, clearcoat: .5, clearcoatRoughness: .25, envMapIntensity: .55 }),
    metal: new THREE.MeshStandardMaterial({ color: '#c8ccd8', roughness: .22, metalness: .9, side: THREE.DoubleSide }),
    dark: new THREE.MeshStandardMaterial({ color: '#23252e', roughness: .45, metalness: .6, side: THREE.DoubleSide }),
    accent: P({ color: s.light, emissive: new THREE.Color(s.light), emissiveIntensity: .22, roughness: .3, metalness: .45, clearcoat: .5 }),
    led: new THREE.MeshBasicMaterial({ color: new THREE.Color(s.light).lerp(new THREE.Color('#ffffff'), .14), toneMapped: false, side: THREE.DoubleSide }),
  };
}

/* ---------- geometry helpers ---------- */
// an inverted NACA 4-digit section (it pushes DOWN, like a race wing): a closed loop from the trailing edge, round the
// leading edge and back; u = 0 at the leading edge, 1 at the trailing edge; top = the upper (painted) side
function section(m = .06, p = .4, t = .12, n = 26) {
  const yc = (x) => x < p ? m / (p * p) * (2 * p * x - x * x) : m / ((1 - p) * (1 - p)) * (1 - 2 * p + 2 * p * x - x * x);
  const dy = (x) => x < p ? 2 * m / (p * p) * (p - x) : 2 * m / ((1 - p) * (1 - p)) * (p - x);
  const yt = (x) => 5 * t * (.2969 * Math.sqrt(x) - .126 * x - .3516 * x * x + .2843 * x ** 3 - .1036 * x ** 4);
  const xs = Array.from({ length: n + 1 }, (_, i) => (1 - Math.cos(Math.PI * i / n)) / 2), out = [];
  for (let i = n; i >= 0; i--) { const x = xs[i], a = Math.atan(dy(x)); out.push({ u: x - yt(x) * Math.sin(a), y: -(yc(x) + yt(x) * Math.cos(a)), top: i === n || i === 0 }); }
  for (let i = 1; i < n; i++) { const x = xs[i], a = Math.atan(dy(x)); out.push({ u: x + yt(x) * Math.sin(a), y: -(yc(x) - yt(x) * Math.cos(a)), top: true }); }
  return out;
}
// loft a section along span stations {x, y, z (leading edge), c (chord), a (angle, + lifts the trailing edge),
// b (bank: the section tilts with the blade's slope), t (0..1 along the span)} → one geometry, groups 0 top · 1 under
function loft(THREE, prof, st, { caps = true, vRep = 1 } = {}) {
  const M = prof.length, pos = [], uv = [], top = [], bot = [];
  const put = (s, q) => {
    const ca = Math.cos(s.a), sa = Math.sin(s.a), cb = Math.cos(s.b || 0), sb = Math.sin(s.b || 0), A = q.u * s.c, B = q.y * s.c;
    const a2 = A * ca - B * sa, b2 = A * sa + B * ca; pos.push(s.x - b2 * sb, s.y + b2 * cb, s.z - a2); uv.push(s.t, q.u * vRep);
  };
  for (const s of st) for (const q of prof) put(s, q);
  for (let i = 0; i < st.length - 1; i++) for (let j = 0; j < M; j++) {
    const k = (j + 1) % M, A = i * M + j, B = i * M + k, C = (i + 1) * M + j, D = (i + 1) * M + k;
    (prof[j].top && prof[k].top && j !== 0 ? top : bot).push(A, B, C, B, D, C);
  }
  if (caps) for (const i of [0, st.length - 1]) {   // the two tip faces: a fan from the middle of the section
    const base = pos.length / 3; let cx = 0, cy = 0, cz = 0;
    for (const q of prof) put(st[i], q);
    for (let j = 0; j < M; j++) { cx += pos[(base + j) * 3]; cy += pos[(base + j) * 3 + 1]; cz += pos[(base + j) * 3 + 2]; }
    pos.push(cx / M, cy / M, cz / M); uv.push(0, 0); const mid = base + M;
    for (let j = 0; j < M; j++) { const k = (j + 1) % M; if (i === 0) bot.push(base + j, mid, base + k); else bot.push(base + j, base + k, mid); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([...top, ...bot]); g.addGroup(0, top.length, 0); g.addGroup(top.length, bot.length, 1); g.computeVertexNormals();
  // make sure the painted side's normals face up (the winding depends on which way the stations run)
  const n = g.attributes.normal, mi = Math.floor(st.length / 2) * M + Math.floor(M * .75);
  if (n.getY(mi) < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
  return g;
}
// span stations from functions of s (-1 … 1 across the span); dense near the middle and the tips
function stations(n, f) { return Array.from({ length: n }, (_, i) => { const u = i / (n - 1), s = Math.sign(u * 2 - 1) * Math.pow(Math.abs(u * 2 - 1), .9); return { ...f(s), t: u }; }); }
// a flat plate in the z-y plane (outline [[z, y]...], holes [[[z, y]...]...]) extruded across x, centred on x0;
// material groups: 0 the two faces · 1 the edge all round
function plate(THREE, outline, holes, thick, x0, bevel = .003) {
  const V = (p) => new THREE.Vector2(p[0], p[1]), sh = new THREE.Shape(outline.map(V));
  for (const h of holes || []) sh.holes.push(new THREE.Path(h.map(V)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 });
  g.rotateY(-Math.PI / 2); g.translate(x0 + thick / 2 - bevel, 0, 0); g.computeVertexNormals(); return g;
}
// a smooth closed outline from a few control points (Catmull-Rom through them)
function smooth(THREE, pts, n = 60, closed = true) { const c = new THREE.CatmullRomCurve3(pts.map(([a, b]) => new THREE.Vector3(a, b, 0)), closed, 'centripetal'); return c.getSpacedPoints(n).slice(0, closed ? n : n + 1).map((v) => [v.x, v.y]); }
const ring = (cz, cy, rz, ry, n = 24, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + i / n * Math.PI * 2; return [cz + Math.cos(a) * rz, cy + Math.sin(a) * ry]; }).reverse();
const slot = (z1, z2, y, h, n = 10) => { const r = h / 2, lo = Math.min(z1, z2) + r, hi = Math.max(z1, z2) - r, o = []; for (let i = 0; i <= n; i++) { const a = Math.PI / 2 + i / n * Math.PI; o.push([lo + Math.cos(a) * r, y + Math.sin(a) * r]); } for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + i / n * Math.PI; o.push([hi + Math.cos(a) * r, y + Math.sin(a) * r]); } return o; };
// a blade-shaped pylon: a centre line [[z, y]...] with a width at each end, extruded thin across x
function pylon(THREE, line, w0, w1, thick, x0, holes) {
  const c = new THREE.CatmullRomCurve3(line.map(([a, b]) => new THREE.Vector3(a, b, 0))), N = 28, L = [], R = [];
  for (let i = 0; i <= N; i++) { const t = i / N, p = c.getPointAt(t), d = c.getTangentAt(t), w = (w0 + (w1 - w0) * t) / 2; L.push([p.x - d.y * w, p.y + d.x * w]); R.push([p.x + d.y * w, p.y - d.x * w]); }
  return plate(THREE, [...L, ...R.reverse()], holes, thick, x0, .004);
}
// a thin flat strip (LED tape, Gurney lip) along a list of points: width along `up`, thickness along `out`
function strip(THREE, pts, up, out, w, th) {
  const pos = [], idx = [], n = pts.length, cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  pts.forEach((p, i) => { const U = Array.isArray(up) ? up[i] : up, O = Array.isArray(out) ? out[i] : out; for (const [a, b] of cs) pos.push(p.x + U.x * a * w / 2 + O.x * b * th / 2, p.y + U.y * a * w / 2 + O.y * b * th / 2, p.z + U.z * a * w / 2 + O.z * b * th / 2); });
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < 4; k++) { const a = i * 4 + k, b = i * 4 + (k + 1) % 4; idx.push(a, b, a + 4, b, b + 4, a + 4); }
  idx.push(0, 1, 2, 0, 2, 3); const e = (n - 1) * 4; idx.push(e, e + 2, e + 1, e, e + 3, e + 2);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// a point on a lofted blade: the section point at chord fraction u (top side) of station s
function onBlade(s, u, lift = 0) { const A = u * s.c, a2 = A * Math.cos(s.a), b2 = A * Math.sin(s.a) + lift; return { x: s.x - b2 * Math.sin(s.b || 0), y: s.y + b2 * Math.cos(s.b || 0), z: s.z - a2 }; }
// approximate top-surface height of an inverted section at chord fraction u (in chords)
function topY(prof, u) { let best = null; for (const q of prof) if (q.top && (!best || Math.abs(q.u - u) < Math.abs(best.u - u))) best = q; return best.y; }

// the inverted camber line (the middle of the section's thickness) at chord fraction u, in chords
const camber = (m, p, u) => -(u < p ? m / (p * p) * (2 * p * u - u * u) : m / ((1 - p) * (1 - p)) * (1 - 2 * p + 2 * p * u - u * u));
const thick = (t, u) => 5 * t * (.2969 * Math.sqrt(u) - .126 * u - .3516 * u * u + .2843 * u ** 3 - .1036 * u ** 4);
// the station at span position x (lerped between the two nearest)
function stAt(st, x) {
  let i = 0; while (i < st.length - 2 && st[i + 1].x < x) i++;
  const A = st[i], B = st[i + 1], f = Math.max(0, Math.min(1, (x - A.x) / ((B.x - A.x) || 1))), L = (k) => (A[k] || 0) + ((B[k] || 0) - (A[k] || 0)) * f;
  return { x: L('x'), y: L('y'), z: L('z'), c: L('c'), a: L('a'), b: L('b'), m: A.m, p: A.p, th: A.th };
}
// a point inside a blade (on its camber line) at span x, chord fraction u: where a post or strut ends
function inside(st, x, u) { const s = stAt(st, x), P = onBlade(s, u, camber(s.m, s.p, u) * s.c); return { x: P.x, y: P.y, z: P.z }; }
// the underside of a blade at span x, chord fraction u (with an extra offset below it)
function under(st, x, u, off = 0) { const s = stAt(st, x), P = onBlade(s, u, (camber(s.m, s.p, u) - thick(s.th, u)) * s.c - off); return { x: P.x, y: P.y, z: P.z }; }
function over(st, x, u, off = 0) { const s = stAt(st, x), P = onBlade(s, u, (camber(s.m, s.p, u) + thick(s.th, u)) * s.c + off); return { x: P.x, y: P.y, z: P.z }; }
// loft any list of closed rings (same point count) into one mesh; flags[j] true = that segment uses material 0
function loftRings(THREE, rings, flags) {
  const M = rings[0].length, pos = [], A0 = [], A1 = [];
  for (const r of rings) for (const p of r) pos.push(p[0], p[1], p[2]);
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < M; j++) { const k = (j + 1) % M, a = i * M + j, b = i * M + k, c = a + M, d = b + M; (flags[j] ? A0 : A1).push(a, b, c, b, d, c); }
  for (const i of [0, rings.length - 1]) { const r = rings[i], base = pos.length / 3; let cx = 0, cy = 0, cz = 0; for (const p of r) { pos.push(...p); cx += p[0]; cy += p[1]; cz += p[2]; } pos.push(cx / M, cy / M, cz / M); for (let j = 0; j < M; j++) A1.push(base + j, base + (j + 1) % M, base + M); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex([...A0, ...A1]); g.addGroup(0, A0.length, 0); g.addGroup(A0.length, A1.length, 1); g.computeVertexNormals(); return g;
}

/* ---------- the nine wings ---------- */
export function buildRearWing(THREE, id, skin = {}, opts = {}) {
  const s = { ...DEF, ...skin }, M = mats(THREE, id, s), G = new THREE.Group(); G.name = 'RearWing'; G.userData.wing = id;
  const CK = G.userData.check = { feet: [], ends: [] };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const add = (geo, mat, part = '') => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.userData.part = part; G.add(m); return m; };
  const bolt = (x, y, z, axis = 'x', r = .0075) => { const g = new THREE.CylinderGeometry(r, r, .006, 6); if (axis === 'x') g.rotateZ(Math.PI / 2); if (axis === 'z') g.rotateX(Math.PI / 2); g.translate(x, y, z); add(g, M.metal, 'bolt'); };
  // a foot plate lying on the scanned deck, four bolts; returns the height of its top
  const foot = (x, z, w = .06, d = .06) => {
    const y = deckY(x, z) - .002; add(new THREE.BoxGeometry(w, .012, d).translate(x, y + .006, z), M.dark, 'foot');
    for (const a of [-1, 1]) for (const b of [-1, 1]) bolt(x + a * w * .32, y + .014, z + b * d * .32, 'y');
    CK.feet.push({ x, z, y }); return y + .012;
  };
  // a round tube between two points (tapered from r0 to r1); a square post with w × d
  const cyl = (a, b, r0, r1, mat, part = 'post', seg = 12) => { const A = V(a.x, a.y, a.z), B = V(b.x, b.y, b.z), d = B.clone().sub(A), m = add(new THREE.CylinderGeometry(r1, r0, d.length(), seg), mat, part); m.position.copy(A).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); return m; };
  const post = (a, b, w, d, mat) => { const A = V(a.x, a.y, a.z), B = V(b.x, b.y, b.z), D = B.clone().sub(A), m = add(new THREE.BoxGeometry(w, D.length(), d), mat, 'post'); m.position.copy(A).addScaledVector(D, .5); m.quaternion.setFromUnitVectors(V(0, 1, 0), D.normalize()); return m; };
  const end = (p) => CK.ends.push({ x: p.x, y: p.y, z: p.z });
  const logo = (x, y, z, size, side) => {
    if (!opts.logoCanvas || s.logo === 'none') return;
    const t = new THREE.CanvasTexture(opts.logoCanvas(s.logo, s.logoColor, s.body, 256, false)); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: new THREE.Color('#ffffff'), emissiveIntensity: .9, alphaTest: .5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(x, y, z); m.rotation.y = side * Math.PI / 2; m.userData.part = 'logo'; G.add(m);
  };
  const ledLine = (pts, up, out, w = .014) => add(strip(THREE, pts, up, out, w, .003), M.led, 'led');
  const ledRod = (pts, r = .005) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V(p.x, p.y, p.z))), Math.max(16, pts.length * 4), r, 8, false), M.led, 'led');
  const blade = (prof, st, mats) => add(loft(THREE, prof, st), mats, 'blade');
  const endplate = (outline, holes, th, x, mats) => add(plate(THREE, outline, holes, th, x), mats, 'plate');

  if (id === 'ducktail') {
    // moulded onto the tail: a body-colour shell whose front half lies on the scanned deck, kicking up into a lip
    // that overhangs the tail end; up to 2.5 cm thick, black underneath where it lifts off
    const X = .31, rings = [], NT = 18, zf = -.85, zt = -1.075, tip = .485;
    const topAt = (x, z) => { const e = 1 - .5 * Math.pow(Math.abs(x) / X, 6), y0 = deckY(x, -.93) + .005; return z >= -.93 ? deckY(x, z) + .005 : y0 + Math.pow((-.93 - z) / (-.93 - zt), 1.8) * (tip - y0) * e; };
    for (let i = 0; i < 25; i++) {
      const x = -X + 2 * X * i / 24, r = [];
      for (let k = 0; k < NT; k++) { const z = zf + (zt - zf) * k / (NT - 1); r.push([x, topAt(x, z), z]); }
      for (let k = NT - 1; k >= 0; k--) { const z = zf + (zt - zf) * k / (NT - 1), t = topAt(x, z); r.push([x, Math.max(deckY(x, Math.max(z, -1.0)) + .001, t - .025 * Math.min(1, (-.9 - z) / .06 + .2)), z + (k === NT - 1 ? .004 : 0)]); }
      rings.push(r);
    }
    const flags = rings[0].map((_, j) => j < NT);
    add(loftRings(THREE, rings, flags), [M.paint, M.carbon], 'lip');
    ledRod(rings.slice(1, -1).map((r) => ({ x: r[NT - 1][0], y: r[NT - 1][1] + .001, z: r[NT - 1][2] + .002 })), .0045);
    // a black strip across the lip just before its edge, and two small black side fences
    add(strip(THREE, rings.map((r) => { const q = r[NT - 3]; return V(q[0], q[1] + .002, q[2]); }), V(0, .4, -1).normalize(), V(0, 1, .4).normalize(), .018, .002), M.carbon, 'lip');
    for (const sd of [-1, 1]) {
      const x = sd * (X - .01), o = [];
      for (let k = 0; k <= 12; k++) { const z = -.9 + (zt + .008 + .9) * k / 12; o.push([z, topAt(x, z) + .018]); }
      for (let k = 12; k >= 0; k--) { const z = -.9 + (zt + .008 + .9) * k / 12; o.push([z, Math.max(deckY(x, Math.max(z, -1.0)) + .002, topAt(x, z) - .02)]); }
      add(plate(THREE, o, [], .008, x, .002), [M.carbon, M.carbon], 'plate');
    }
    for (const x of [-.2, 0, .2]) bolt(x, deckY(x, -.88) + .008, -.88, 'y');
    CK.feet.push({ x: 0, z: -.88, y: deckY(0, -.88) + .002 });
  }

  if (id === 'rookie') {
    const H = .48, pr = section(.03, .4, .1), st = stations(21, (q) => ({ x: q * H, y: .7, z: -.955, c: .17, a: .05, m: .03, p: .4, th: .1 }));
    blade(pr, st, [M.top, M.carbon]);
    for (const sd of [-1, 1]) {
      const x = sd * (H + .005);
      endplate(smooth(THREE, [[-.935, .645], [-.94, .77], [-1.0, .778], [-1.14, .776], [-1.152, .7], [-1.148, .648], [-1.08, .638], [-.99, .638]], 48), [], .01, x, [M.carbon, M.carbon]);
      for (const [z, y] of [[-.97, .66], [-1.13, .66]]) bolt(x + sd * .0065, y, z);
      const px = sd * .22, fy = foot(px, -.87), e = inside(st, px, .45);
      post({ x: px, y: fy - .002, z: -.87 }, e, .026, .026, M.carbon); end(e);
      const u = under(st, px, .45, .004); add(new THREE.BoxGeometry(.05, .008, .07).translate(u.x, u.y, u.z), M.dark, 'post');
      bolt(px - .018, u.y - .004, u.z, 'y'); bolt(px + .018, u.y - .004, u.z, 'y');
    }
  }

  if (id === 'arrow') {
    const H = .55, prof = section(.06, .4, .12),
      st = stations(25, (q) => ({ x: q * H, y: .735 + .012 * q * q, z: -.95 - .08 * Math.pow(Math.abs(q), 1.25), c: .25 - .05 * Math.abs(q), a: .157, m: .06, p: .4, th: .12 }));
    blade(prof, st, [M.top, M.carbon]);
    const te = st.map((q) => { const p = onBlade(q, 1); return V(p.x, p.y + .006, p.z + .002); });
    add(strip(THREE, te, V(0, 1, 0), V(0, 0, 1), .014, .004), M.carbon, 'lip');
    for (const sd of [-1, 1]) {
      const x = sd * (H + .007);
      const out = smooth(THREE, [[-.925, .815], [-1.1, .806], [-1.235, .792], [-1.272, .762], [-1.27, .66], [-1.235, .612], [-1.12, .6], [-1.02, .615], [-.985, .66]], 64);
      endplate(out, [slot(-1.06, -1.215, .7, .018), slot(-1.09, -1.2, .664, .013)], .012, x, [M.paint, M.carbon]);
      const topPts = smooth(THREE, [[-.932, .809], [-1.1, .8], [-1.228, .786]], 30, false).map(([z, y]) => V(x, y - .006, z));
      for (const f of [-1, 1]) ledLine(topPts.map((p) => V(p.x + f * .0075, p.y, p.z)), V(0, 1, 0), V(1, 0, 0), .01);
      for (const [z, y] of [[-1.0, .705], [-1.235, .72], [-1.05, .64], [-1.2, .635]]) bolt(x + sd * .008, y, z);
      logo(x + sd * .0085, .76, -1.11, .07, sd);
      // swan-neck pylon: from a foot on the flat deck, leaning back into the blade; a clamp on the blade's top
      const px = sd * .2, fy = foot(px, -.87), e = inside(st, px, .5);
      add(pylon(THREE, [[-.87, fy - .003], [-.885, .57], [-.94, .67], [e.z, e.y]], .07, .05, .016, px, [ring(-.885, .52, .014, .026, 18)]), [M.carbon, M.accent], 'post'); end(e);
      const c = over(st, px, .5, .002); add(new THREE.BoxGeometry(.03, .006, .06).translate(c.x, c.y, c.z), M.dark, 'post');
    }
  }

  if (id === 'hoop') {
    const H = .52, pr = section(.05, .4, .11), st = stations(25, (q) => ({ x: q * H, y: .745, z: -.955, c: .2, a: .09, m: .05, p: .4, th: .11 }));
    blade(pr, st, [M.top, M.carbon]);
    const U = under(st, 0, .4), r = .014, yc = U.y - r + .003, zc = U.z;
    const path = [];
    for (const sd of [-1, 1]) {
      const fx = sd * .28, fy = deckY(fx, -.87);
      add(new THREE.CylinderGeometry(.026, .03, .012, 20).translate(fx, fy + .006, -.87), M.dark, 'foot'); CK.feet.push({ x: fx, z: -.87, y: fy });
      for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; bolt(fx + Math.cos(a) * .02, fy + .014, -.87 + Math.sin(a) * .02, 'y', .005); }
      add(new THREE.SphereGeometry(.02, 14, 10).translate(fx, fy + .016, -.87), M.metal, 'post');
      const side = [[fx, fy + .012, -.87], [sd * .285, fy + .1, -.885], [sd * .272, yc - .08, zc + .035], [sd * .235, yc - .012, zc + .004], [sd * .19, yc, zc]];
      if (sd < 0) path.push(...side); else path.push(...side.reverse());
      if (sd < 0) path.push([-.08, yc, zc], [.08, yc, zc]);
    }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path.map((p) => V(...p))), 160, r, 14, false), M.carbon, 'post');
    for (const x of [-.18, -.06, .06, .18]) {
      const t = new THREE.TorusGeometry(r + .004, .004, 8, 20); t.rotateY(Math.PI / 2); t.translate(x, yc, zc); add(t, M.metal, 'post');
      const u = under(st, x, .4, -.004); add(new THREE.BoxGeometry(.03, u.y - yc, .03).translate(x, (u.y + yc) / 2, zc), M.paint, 'post'); end(u);
    }
    for (const sd of [-1, 1]) {
      // a black winglet at each tip, canted down and out
      const g = plate(THREE, smooth(THREE, [[-.945, .762], [-1.06, .775], [-1.17, .77], [-1.19, .7], [-1.12, .67], [-1.0, .68], [-.95, .715]], 40), [], .008, 0, .002);
      g.translate(0, -.745, 0); g.rotateZ(-sd * .45); g.translate(sd * (H + .002), .745, 0); add(g, [M.carbon, M.accent], 'plate');
    }
  }

  if (id === 'stingray') {
    const H = .55, pr = section(.05, .4, .09);
    const st = stations(31, (q) => ({ x: q * H, y: .745 - .045 * q * q, z: -.93 - .15 * Math.pow(Math.abs(q), 1.6), c: .3 - .19 * Math.pow(Math.abs(q), 1.3), a: .08, b: Math.atan(-.09 * q / H), m: .05, p: .4, th: .09 }));
    blade(pr, st, [M.top, M.carbon]);
    // the shark fin: its base IS the deck's centre line (scanned), its top runs inside the blade
    const base = []; for (let k = 0; k <= 12; k++) { const z = -.845 + (-1.02 + .845) * k / 12; base.push([z, deckY(0, z)]); }
    const R = inside(st, 0, .86), top = []; for (let k = 0; k <= 8; k++) { const p = inside(st, 0, .86 - .74 * k / 8); top.push([p.z, p.y]); }
    const rear = smooth(THREE, [[-1.02, deckY(0, -1.02)], [-1.06, .45], [-1.12, .62], [R.z, R.y]], 12, false).slice(1, -1);
    const front = smooth(THREE, [top[top.length - 1], [-.9, .63], [-.862, .52], [-.846, deckY(0, -.846) + .01]], 12, false).slice(1, -1);
    add(plate(THREE, [...base, ...rear, ...top, ...front], [ring(-.95, .55, .03, .045, 22)], .018, 0, .004), [M.carbon, M.accent], 'fin');
    add(strip(THREE, base.map(([z, y]) => V(0, y + .003, z)), V(1, 0, 0), V(0, 1, 0), .05, .006), M.dark, 'foot');
    for (const z of [-.86, -.93, -.99]) for (const sd of [-1, 1]) bolt(sd * .018, deckY(0, z) + .008, z, 'y', .005);
    CK.feet.push({ x: 0, z: -.88, y: deckY(0, -.88) }); end(inside(st, .016, .5)); end(inside(st, -.016, .3)); end(inside(st, .016, .8));
    for (const sd of [-1, 1]) ledRod(rear.map(([z, y]) => ({ x: sd * .0105, y, z })), .0035);
  }

  if (id === 'twinjet') {
    const H = .56, pm = section(.05, .4, .13), pf = section(.08, .35, .1),
      main = stations(25, (q) => ({ x: q * H, y: .718 + .014 * q * q, z: -.955 - .025 * q * q, c: .21, a: .09, m: .05, p: .4, th: .13 })),
      flap = stations(25, (q) => ({ x: q * H, y: .748 + .014 * q * q, z: -1.148 - .025 * q * q, c: .118, a: .4, m: .08, p: .35, th: .1 }));
    blade(pm, main, [M.top, M.carbon]); blade(pf, flap, [M.accent, M.accent]);
    ledLine(flap.map((q) => { const p = onBlade(q, .985, .004); return V(p.x, p.y, p.z); }), V(0, Math.sin(.4), -Math.cos(.4)), V(0, Math.cos(.4), Math.sin(.4)), .012);
    for (const sd of [-1, 1]) {
      const x = sd * (H + .007);
      const out = smooth(THREE, [[-.93, .8], [-1.0, .818], [-1.2, .82], [-1.29, .81], [-1.302, .77], [-1.29, .64], [-1.24, .6], [-1.0, .598], [-.94, .62], [-.925, .72]], 70);
      const louv = Array.from({ length: 5 }, (_, i) => { const z = -.985 - i * .03; return [[z, .615], [z - .012, .615], [z - .034, .7], [z - .022, .7]].reverse(); });
      endplate(out, louv, .012, x, [M.carbon, M.accent]);
      add(new THREE.BoxGeometry(.05, .008, .26).translate(x + sd * .022, .602, -1.12), M.carbon, 'plate');
      ledLine(smooth(THREE, [[-1.296, .8], [-1.302, .74], [-1.296, .66]], 20, false).map(([z, y]) => V(x + sd * .0075, y, z)), V(0, 0, 1), V(1, 0, 0), .011);
      for (const [z, y] of [[-.97, .74], [-1.1, .735], [-1.25, .79], [-1.2, .63]]) bolt(x + sd * .008, y, z);
      logo(x + sd * .0085, .775, -1.11, .07, sd);
    }
    // one centre pylon on the flat deck, leaning back into the main plane; a DRS pod and push-rod up to the flap
    const fy = foot(0, -.872, .08, .05), e = inside(main, 0, .55);
    add(pylon(THREE, [[-.875, fy - .003], [-.895, .57], [-.97, .665], [e.z, e.y]], .085, .065, .022, 0, [ring(-.895, .52, .018, .032, 18)]), [M.carbon, M.accent], 'post'); end(e);
    const P1 = { x: 0, y: .6, z: -.94 }, P2 = under(flap, 0, .3, -.003), mid = { x: 0, y: P1.y + (P2.y - P1.y) * .55, z: P1.z + (P2.z - P1.z) * .55 };
    cyl(P1, mid, .016, .016, M.metal); cyl(mid, P2, .0045, .0045, M.metal); add(new THREE.SphereGeometry(.008, 10, 8).translate(P2.x, P2.y, P2.z), M.accent, 'post'); end(P2);
  }

  if (id === 'stacker') {
    const H = .46, pr = section(.04, .4, .1), slats = [0, 1, 2].map((i) => stations(19, (q) => ({ x: q * H, y: .655 + .057 * i, z: -.95 - .04 * i, c: .12, a: .1 + .09 * i, m: .04, p: .4, th: .1 })));
    for (const st of slats) { blade(pr, st, [M.carbon, M.carbon]); ledLine(st.map((q) => { const p = onBlade(q, .97, .003); return V(p.x, p.y, p.z); }), V(0, 0, 1), V(0, 1, 0), .008); }
    for (const sd of [-1, 1]) {
      const x = sd * (H + .006);
      endplate(smooth(THREE, [[-.928, .64], [-1.0, .618], [-1.09, .622], [-1.145, .66], [-1.18, .76], [-1.172, .82], [-1.1, .826], [-1.0, .795], [-.945, .72]], 64), [slot(-1.0, -1.1, .64, .012)], .012, x, [M.paint, M.accent]);
      for (const [z, y] of [[-.97, .69], [-1.15, .8], [-1.1, .66]]) bolt(x + sd * .008, y, z);
      logo(x + sd * .0085, .76, -1.07, .06, sd);
      const px = sd * .24, fy = foot(px, -.87, .06, .07), a = inside(slats[0], px, .25), b = inside(slats[0], px, .75);
      post({ x: px, y: fy - .002, z: -.85 }, a, .02, .02, M.dark); post({ x: px, y: fy - .002, z: -.89 }, b, .02, .02, M.dark); end(a); end(b);
    }
    for (const x of [-.24, 0, .24]) for (let i = 0; i < 2; i++) { const a = inside(slats[i], x, .55), b = inside(slats[i + 1], x, .3); cyl(a, b, .006, .006, M.metal); end(a); end(b); }
  }

  if (id === 'razor') {
    const H = .54, pr = section(.045, .4, .085),
      st = stations(25, (q) => ({ x: q * H, y: .685 + .006 * q * q, z: -.975 + .045 * Math.pow(Math.abs(q), 1.5), c: .2 - .04 * Math.abs(q), a: .1, m: .045, p: .4, th: .085 }));
    blade(pr, st, [M.top, M.carbon]);
    ledLine(st.map((q) => { const p = onBlade(q, .99, .003); return V(p.x, p.y, p.z); }), V(0, 0, 1), V(0, 1, 0), .008);
    for (const sd of [-1, 1]) {
      const x = sd * (H + .005);
      endplate(smooth(THREE, [[-.895, .69], [-.97, .735], [-1.08, .755], [-1.2, .742], [-1.295, .7], [-1.2, .648], [-1.08, .628], [-.97, .645]], 64), [slot(-1.12, -1.22, .69, .01)], .01, x, [M.carbon, M.led]);
      bolt(x + sd * .007, .7, -1.03); bolt(x + sd * .007, .7, -1.1);
      // swan neck: up from a foot on the flat deck, over the top, and down onto the blade (it hangs the wing)
      const px = sd * .2, fy = foot(px, -.86), e = over(st, px, .5, -.004);
      add(pylon(THREE, [[-.86, fy - .003], [-.872, .6], [-.91, .73], [-.97, .79], [-1.03, .805], [e.z + .012, e.y + .05], [e.z, e.y]], .055, .032, .016, px), [M.paint, M.carbon], 'post'); end(e);
      add(new THREE.BoxGeometry(.03, .006, .05).translate(e.x, e.y + .005, e.z), M.dark, 'post');
    }
  }

  if (id === 'comet') {
    const H = .565, prof = section(.065, .4, .125);
    const yA = (q) => .775 - .075 * Math.pow(Math.abs(q), 4), dY = (q) => -.3 * Math.sign(q) * Math.pow(Math.abs(q), 3) / H, cq = (q) => .235 - .045 * q * q, aq = (q) => .13 - .05 * q * q;
    const st = stations(41, (q) => { const b = Math.atan(dY(q)); return { x: q * H - Math.sign(q) * cq(q) * (Math.sin(aq(q)) + .13) * Math.abs(Math.sin(b)), y: yA(q), z: -.945 - .085 * q * q, c: cq(q), a: aq(q), b, m: .065, p: .4, th: .125 }; });
    blade(prof, st, [M.top, M.paint]);
    ledRod(st.slice(2, -2).map((q) => { const p = onBlade(q, 0); return { x: p.x, y: p.y - .006 * Math.cos(q.b), z: p.z + .004 }; }), .0055);
    for (let i = -3; i <= 3; i++) { if (!i) continue; const q = st[Math.round((i / 4 * .5 + .5) * (st.length - 1))], p = onBlade(q, .45, -.03); const f = new THREE.BoxGeometry(.003, .016, .05); f.rotateY(i * .06); f.translate(p.x, p.y - .006, p.z); add(f, M.carbon, 'vg'); }
    for (const sd of [-1, 1]) {
      const x = sd * (H + .006);
      const out = smooth(THREE, [[-.99, .7], [-1.02, .755], [-1.1, .778], [-1.2, .77], [-1.3, .748], [-1.37, .73], [-1.41, .724], [-1.35, .7], [-1.26, .66], [-1.16, .6], [-1.06, .598], [-1.0, .635]], 80);
      endplate(out, [ring(-1.255, .712, .024, .016, 20), ring(-1.31, .72, .015, .0105, 18), ring(-1.355, .722, .009, .0065, 14)], .014, x, [M.paint, M.led]);
      add(plate(THREE, smooth(THREE, [[-1.12, .628], [-1.22, .648], [-1.32, .676], [-1.39, .698], [-1.3, .664], [-1.2, .636]], 50), [], .005, x + sd * .0115, .0015), [M.accent, M.accent], 'plate');
      ledLine(smooth(THREE, [[-1.03, .758], [-1.15, .776], [-1.3, .752], [-1.39, .729]], 40, false).map(([z, y]) => V(x + sd * .0085, y - .007, z)), V(0, 1, 0), V(1, 0, 0), .009);
      for (const [z, y] of [[-1.07, .65], [-1.17, .63]]) bolt(x + sd * .0095, y, z);
      logo(x + sd * .0095, .7, -1.1, .07, sd);
      // V-strut: from a foot on the flat deck out and up to the blade, ball joints at both ends
      const fy = foot(sd * .2, -.87), a = { x: sd * .2, y: fy + .01, z: -.87 }, b = under(st, sd * .34, .45, -.004);
      cyl(a, b, .013, .009, M.carbon).scale.set(1, 1, 1);
      for (const p of [a, b]) add(new THREE.SphereGeometry(.016, 14, 10).translate(p.x, p.y, p.z), M.metal, 'post');
      end(b);
    }
  }
  G.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return G;
}
