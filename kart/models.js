// Foxino in a racing helmet, and a grey racing go-kart, built from smooth shapes.
// Both face +z, stand on y = 0, in metres (Foxino is about 1.45 m to the ear tips; the kart is about 1.8 m long).
import * as THREE from 'three';

const R = Math.random;
// detail level: 1 = full (for the model files), lower = lighter (for the game on phones)
export const Q = { lod: 1, tex: 1 };
export function setDetail(lod, tex = lod) { Q.lod = lod; Q.tex = tex; }
const L = (n, min = 6) => Math.max(min, Math.round(n * Q.lod));
const SphG = (r, w = 32, h = 16, ...rest) => new THREE.SphereGeometry(r, L(w, 8), L(h, 6), ...rest);
const CapG = (r, len, cap = 4, rad = 8) => new THREE.CapsuleGeometry(r, len, L(cap, 3), L(rad, 8));
const CylG = (rt, rb, h, rad = 32, hs = 1, ...rest) => new THREE.CylinderGeometry(rt, rb, h, L(rad, 6), hs, ...rest);
const TorG = (r, t, rs = 12, ts = 48, ...rest) => new THREE.TorusGeometry(r, t, L(rs, 5), L(ts, 10), ...rest);
const TubeG = (c, tub = 64, r = 1, rad = 8, closed = false) => new THREE.TubeGeometry(c, L(tub, 12), r, L(rad, 5), closed);
const ExtG = (shape, o) => new THREE.ExtrudeGeometry(shape, { ...o, curveSegments: L(o.curveSegments || 12, 4), bevelSegments: o.bevelEnabled ? L(o.bevelSegments || 3, 1) : 0 });

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, metalness: 0, ...o });
// fur: a soft velvety sheen on the edges, like animated-film fur
const FUR = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: .78, metalness: 0, sheen: 1, sheenRoughness: .45, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), .45), ...o });
function mesh(parent, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, name) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz);
  m.castShadow = true; m.receiveShadow = true; if (name) m.name = name; parent.add(m); return m;
}
const sphere = (seg = 40) => SphG(1, seg, Math.round(seg * .7));
const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), L(seg, 8));
const hex = (c) => new THREE.Color(c);
const mix = (a, b, k) => a.clone().lerp(b, Math.max(0, Math.min(1, k)));
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// paint a texture for a sphere: fn(direction) → THREE.Color, plus a little fur noise
function paintSphere(fn, w = 1024, h = 512, fur = .07) {
  w = Math.max(64, Math.round(w * Q.tex)); h = Math.max(32, Math.round(h * Q.tex));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), img = x.createImageData(w, h), d = new THREE.Vector3();
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const phi = (i + .5) / w * Math.PI * 2, th = (j + .5) / h * Math.PI;
    d.set(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
    const col = fn(d), n = 1 + (R() - .5) * fur + Math.sin(i * .9 + j * 2.3) * fur * .3, o = (j * w + i) * 4;
    img.data[o] = Math.min(255, col.r * 255 * n); img.data[o + 1] = Math.min(255, col.g * 255 * n); img.data[o + 2] = Math.min(255, col.b * 255 * n); img.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/* =========================================================== FOXINO =========================================================== */
const PURPLE = hex('#8a4ec8'), PURPLE_D = hex('#6a36a8'), ORANGE = hex('#ff7a1e'), CREAM = hex('#f8e6cc'), YELLOW = hex('#f2b40c');

// --- fur: a smooth value noise, used to push the surface out into soft clumps and tufts ---
function hash3(x, y, z, s) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y, z, s = 0) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), fx = x - X, fy = y - Y, fz = z - Z, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t, h = (i, j, k) => hash3(X + i, Y + j, Z + k, s);
  return L(L(L(h(0, 0, 0), h(1, 0, 0), u), L(h(0, 1, 0), h(1, 1, 0), u), v), L(L(h(0, 0, 1), h(1, 0, 1), u), L(h(0, 1, 1), h(1, 1, 1), u), v), w);
}
// furify: push each vertex out along its normal by fur clumps; `droop` bends the tufts (e.g. down or towards a tail tip);
// `mask(p, n)` says how furry each spot is (0…1). Works in the geometry's own (already scaled) space, so tufts stay the same size.
function furify(geo, { freq = 38, amp = .014, tuft = 1, droop = new THREE.Vector3(0, -1, 0), mask = null, seed = 1 } = {}) {
  geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, P = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    P.fromBufferAttribute(p, i); N.fromBufferAttribute(n, i);
    const w = mask ? mask(P, N) : 1; if (w <= 0) continue;
    const base = vnoise(P.x * freq * .35, P.y * freq * .35, P.z * freq * .35, seed);
    const c = vnoise(P.x * freq, P.y * freq, P.z * freq, seed + 7), clump = smooth(.3, .85, c);
    const d = amp * w * (.4 + .4 * base + tuft * clump * .9);
    p.setXYZ(i, P.x + N.x * d + droop.x * d * 1.1 * clump, P.y + N.y * d + droop.y * d * 1.1 * clump, P.z + N.z * d + droop.z * d * 1.1 * clump);
  }
  geo.computeVertexNormals(); return geo;
}
const furSphere = (r, sx, sy, sz, opts, seg = 96) => furify(SphG(r, seg, Math.round(seg * .66)).scale(sx, sy, sz), opts);
const furCapsule = (r, len, opts) => furify(CapG(r, len, 24, 64), opts);
// cloth: very gentle low folds
function cloth(geo, amp = .006, freq = 9, seed = 3) {
  geo.computeVertexNormals(); const p = geo.attributes.position, n = geo.attributes.normal, P = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { P.fromBufferAttribute(p, i); N.fromBufferAttribute(n, i); const d = (vnoise(P.x * freq, P.y * freq * 2.2, P.z * freq, seed) - .5) * amp * 2; p.setXYZ(i, P.x + N.x * d, P.y + N.y * d, P.z + N.z * d); }
  geo.computeVertexNormals(); return geo;
}

export function buildFoxino() {
  const fox = new THREE.Group(); fox.name = 'Foxino';
  const fur = FUR(PURPLE), cream = FUR(CREAM), orangeFur = FUR(ORANGE), pad = FUR('#d8b8f0', { sheen: .3, roughness: .6 });

  /* ---- head (centre at y 1.06): inside the helmet, only the snout, the ears and a fur ruff show ---- */
  const head = new THREE.Group(); head.name = 'Head'; head.position.set(0, 1.06, 0); fox.add(head);
  const headTex = paintSphere((d) => {
    let c = PURPLE.clone();
    const a = Math.atan2(d.x, d.z), jag = .05 * Math.sin(a * 16) + .03 * Math.sin(a * 37);
    const cx = .17 - d.y * .12, patch = d.z > .15 && d.y > -.3 && Math.abs(d.x - cx) < .17 + .05 * Math.sin(d.y * 20);
    if (patch) c = mix(c, ORANGE, smooth(.17, .1, Math.abs(d.x - cx)) * smooth(.15, .3, d.z));
    if (d.y < -.08 + jag && d.z > -.3) c = mix(c, CREAM, smooth(-.08 + jag, -.16 + jag, d.y));
    return c;
  });
  mesh(head, furSphere(1, .25, .235, .245, { amp: .008, freq: 60 }), FUR(0xffffff, { map: headTex }), 0, 0, 0, 1, 1, 1, 0, 0, 0, 'Skull');
  const muzTex = paintSphere((d) => { let c = CREAM.clone(); if (d.y > .25 && d.x > -.25 && d.z > -.2) c = mix(c, ORANGE, smooth(.25, .45, d.y) * smooth(-.25, -.05, d.x)); return c; }, 512, 256);
  const muzG = SphG(1, 64, 40).scale(.115, .09, .2);
  // a fox snout: pinched a little towards the nose, with soft fur on the cheeks
  { const p = muzG.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i), k = 1 - Math.max(0, z / .2) * .22; p.setX(i, p.getX(i) * k); p.setY(i, p.getY(i) * (1 - Math.max(0, z / .2) * .1)); } }
  furify(muzG, { amp: .005, freq: 70, mask: (P) => smooth(.05, -.05, P.z) });
  mesh(head, muzG, FUR(0xffffff, { map: muzTex }), 0, -.07, .2, 1, 1, 1, -.12, 0, 0, 'Muzzle');
  mesh(head, SphG(1, 40, 28).scale(.046, .034, .036), new THREE.MeshPhysicalMaterial({ color: '#3a1a1c', roughness: .3, clearcoat: 1 }), 0, -.02, .393, 1, 1, 1, 0, 0, 0, 'Nose');
  const mouth = new THREE.Group(); mouth.position.set(.025, -.12, .315); mouth.rotation.set(-.35, .12, -.1); head.add(mouth);
  mesh(mouth, SphG(1, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M('#4a1420', { roughness: .6, side: THREE.DoubleSide }), 0, .012, 0, .08, .05, .045);
  mesh(mouth, sphere(24), M('#ff6a80', { roughness: .5 }), .008, -.02, .012, .048, .016, .028);
  for (const x of [-.048, .05]) mesh(mouth, new THREE.ConeGeometry(1, 1, 12), M('#ffffff', { roughness: .3 }), x, .0, .03, .012, .028, .012, Math.PI);
  mesh(mouth, new THREE.BoxGeometry(1, 1, 1), M('#ffffff', { roughness: .3 }), 0, .008, .03, .1, .014, .02);
  // eyes (behind the dark visor now; kept for when the visor is up)
  for (const [x, iris] of [[-.1, '#25a060'], [.1, '#2468d8']]) {
    const e = new THREE.Group(); e.name = x < 0 ? 'EyeRight' : 'EyeLeft'; e.position.set(x, .035, .19); e.rotation.y = x * 2.2; head.add(e);
    mesh(e, sphere(32), M('#ffffff', { roughness: .2 }), 0, 0, 0, .072, .082, .055);
    mesh(e, sphere(24), M(iris, { roughness: .2 }), 0, -.006, .036, .046, .05, .025);
    mesh(e, sphere(16), M('#0a0a12', { roughness: .1 }), 0, -.008, .052, .024, .027, .008);
  }
  // ears: rounder and fluffy: a thick rounded leaf shape, purple, with an orange inside and cream fluff at the bottom
  const earShape = new THREE.Shape(); earShape.moveTo(-.085, 0); earShape.bezierCurveTo(-.11, .12, -.07, .25, 0, .3); earShape.bezierCurveTo(.07, .25, .11, .12, .085, 0); earShape.quadraticCurveTo(0, -.02, -.085, 0);
  const innerShape = new THREE.Shape(); innerShape.moveTo(-.055, .03); innerShape.bezierCurveTo(-.07, .12, -.045, .2, 0, .24); innerShape.bezierCurveTo(.045, .2, .07, .12, .055, .03); innerShape.quadraticCurveTo(0, .02, -.055, .03);
  for (const s of [-1, 1]) {
    const ear = new THREE.Group(); ear.name = s < 0 ? 'EarRight' : 'EarLeft'; ear.position.set(s * .15, .2, -.03); ear.rotation.set(-.12, s * .25, -s * .36); head.add(ear);
    const eg = ExtG(earShape, { depth: .03, bevelEnabled: true, bevelThickness: .022, bevelSize: .016, bevelSegments: 6, curveSegments: 32 }); eg.translate(0, 0, -.015);
    furify(eg, { amp: .01, freq: 26, droop: new THREE.Vector3(0, 1, 0), mask: (P) => smooth(.02, .1, P.y) });
    mesh(ear, eg, fur, 0, 0, 0, 1, 1, 1, 0, 0, 0, 'EarOuter');
    const ig = ExtG(innerShape, { depth: .008, bevelEnabled: true, bevelThickness: .008, bevelSize: .008, bevelSegments: 4, curveSegments: 24 });
    mesh(ear, ig, orangeFur, 0, 0, .032, 1, 1, 1, 0, 0, 0, 'EarInner');
    const fluff = SphG(1, 40, 28).scale(.055, .06, .03); furify(fluff, { amp: .016, freq: 34, droop: new THREE.Vector3(0, 1, .3) });
    mesh(ear, fluff, cream, 0, .06, .045, 1, 1, 1, 0, 0, 0, 'EarFluff');
  }
  // a fluffy cream ruff round the neck, poking out under the helmet
  mesh(fox, furSphere(1, .17, .07, .15, { amp: .022, freq: 22, droop: new THREE.Vector3(0, -1, 0) }), cream, 0, .885, .005, 1, 1, 1, 0, 0, 0, 'NeckRuff');

  /* ---- the helmet ---- */
  const helmet = buildHelmet(); helmet.position.set(0, .015, -.02); head.add(helmet);

  /* ---- T-shirt: soft folds, a ribbed collar, a hem and short sleeves with cuffs ---- */
  const shirt = M(YELLOW, { roughness: .85 }), shirtD = M('#e09e08', { roughness: .85 });
  const torso = cloth(lathe([[0, .49], [.18, .49], [.195, .53], [.205, .62], [.203, .72], [.192, .79], [.155, .845], [.09, .868], [0, .872]], 96), .007);
  mesh(fox, torso, shirt, 0, 0, 0, 1, 1, .8, 0, 0, 0, 'Shirt');
  mesh(fox, TorG(.183, .011, 10, 64), shirt, 0, .495, 0, 1, 1, .8, Math.PI / 2, 0, 0, 'ShirtHem');
  mesh(fox, TorG(.09, .014, 10, 48), shirtD, 0, .866, .005, 1, 1, .82, Math.PI / 2, 0, 0, 'Collar');

  /* ---- shorts: waistband with belt loops, roomy legs with rolled hems, cargo pockets with flaps and buttons ---- */
  const sh = M('#ec4e12', { roughness: .85 }), shD = M('#c8400c', { roughness: .85 }), btn = M('#2a2a30', { roughness: .4, metalness: .3 });
  mesh(fox, cloth(lathe([[0, .38], [.185, .4], [.196, .45], [.19, .505], [0, .505]], 96), .005), sh, 0, 0, 0, 1, 1, .8, 0, 0, 0, 'Shorts');
  mesh(fox, CylG(.19, .19, .035, 64, 1, true), shD, 0, .51, 0, 1, 1, .8, 0, 0, 0, 'Waistband').material.side = THREE.DoubleSide;
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + .3; mesh(fox, new THREE.BoxGeometry(1, 1, 1), shD, Math.sin(a) * .193, .51, Math.cos(a) * .155, .014, .04, .008, 0, a, 0, 'BeltLoop'); }
  mesh(fox, new THREE.BoxGeometry(1, 1, 1), shD, 0, .45, .155, .006, .06, .004, 0, 0, 0, 'Fly');
  for (const s of [-1, 1]) {
    const leg = cloth(CylG(.098, .108, .18, 48, 6, true), .006, 12, s + 5);
    mesh(fox, leg, sh, s * .095, .335, 0, 1, 1, 1, 0, 0, s * .06, 'ShortsLeg').material.side = THREE.DoubleSide;
    mesh(fox, TorG(.106, .011, 10, 48), shD, s * .1, .248, 0, 1, 1, 1, Math.PI / 2, 0, 0, 'ShortsHem');
    // the cargo pocket on the outside of each leg
    mesh(fox, roundBox(.03, .085, .075, .01), shD, s * .195, .335, .005, 1, 1, 1, 0, 0, s * .06, 'CargoPocket');
    mesh(fox, roundBox(.036, .026, .082, .008), sh, s * .2, .382, .005, 1, 1, 1, 0, 0, s * .06, 'PocketFlap');
    mesh(fox, SphG(.007, 12, 8), btn, s * .219, .372, .005, 1, 1, 1, 0, 0, 0, 'PocketButton');
  }

  /* ---- legs and feet: fluffy purple legs, big cream paws with toes and pink beans underneath ---- */
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.name = s < 0 ? 'LegRight' : 'LegLeft'; leg.position.set(s * .095, .26, 0); fox.add(leg);
    mesh(leg, furCapsule(.056, .15, { amp: .01, freq: 22 }), fur, 0, -.1, 0);
    mesh(leg, furSphere(1, .066, .03, .066, { amp: .014, freq: 26 }), cream, 0, -.17, 0, 1, 1, 1, 0, 0, 0, 'AnkleFluff');
    const foot = new THREE.Group(); foot.position.set(s * .008, -.215, .045); leg.add(foot);
    mesh(foot, furSphere(1, .085, .058, .12, { amp: .006, freq: 60 }), cream, 0, 0, 0, 1, 1, 1, 0, 0, 0, 'Paw');
    for (let k = 0; k < 4; k++) mesh(foot, SphG(1, 24, 16).scale(.024, .026, .03), cream, (k - 1.5) * .034, -.004, .105 - Math.abs(k - 1.5) * .012);
    mesh(foot, SphG(1, 24, 12).scale(.035, .01, .03), M('#ff9ab0', { roughness: .5 }), 0, -.055, .02, 1, 1, 1, 0, 0, 0, 'PawPad');
  }

  /* ---- arms and hands: fluffy arms, cartoon hands with four rounded fingers and a thumb, lilac pads ---- */
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.name = s < 0 ? 'ArmRight' : 'ArmLeft'; arm.position.set(s * .19, .79, 0); arm.rotation.z = s * .42; fox.add(arm);
    mesh(arm, cloth(CylG(.072, .086, .15, 48, 4, true), .006), shirt, 0, -.05, 0, 1, 1, 1, 0, 0, 0, 'Sleeve').material.side = THREE.DoubleSide;
    mesh(arm, TorG(.084, .01, 10, 48), shirtD, 0, -.125, 0, 1, 1, 1, Math.PI / 2, 0, 0, 'SleeveCuff');
    mesh(arm, furCapsule(.043, .2, { amp: .009, freq: 24 }), fur, 0, -.2, 0, 1, 1, 1, 0, 0, 0, 'ArmFur');
    mesh(arm, furSphere(1, .05, .025, .05, { amp: .012, freq: 28 }), fur, 0, -.315, 0, 1, 1, 1, 0, 0, 0, 'WristFluff');
    const hand = new THREE.Group(); hand.name = s < 0 ? 'HandRight' : 'HandLeft'; hand.position.set(0, -.37, .008); arm.add(hand);
    mesh(hand, furSphere(1, .052, .056, .038, { amp: .005, freq: 70 }), fur, 0, 0, 0, 1, 1, 1, 0, 0, 0, 'Palm');
    mesh(hand, SphG(1, 24, 16).scale(.032, .03, .012), pad, 0, -.006, .03, 1, 1, 1, 0, 0, 0, 'PalmPad');
    // four fingers, each two rounded segments, gently curled, with a pad at the tip
    for (let k = 0; k < 4; k++) {
      const f = new THREE.Group(); f.position.set((k - 1.5) * .024, -.045, .006); f.rotation.set(.25, 0, (k - 1.5) * -.1); hand.add(f);
      mesh(f, CapG(.0125, .03, 8, 16), fur, 0, -.018, 0);
      const tip = new THREE.Group(); tip.position.set(0, -.04, 0); tip.rotation.x = .45; f.add(tip);
      mesh(tip, CapG(.0118, .022, 8, 16), fur, 0, -.014, 0);
      mesh(tip, SphG(1, 16, 12).scale(.009, .009, .005), pad, 0, -.022, .009);
    }
    const th = new THREE.Group(); th.position.set(-s * .045, -.012, .016); th.rotation.set(.5, 0, -s * .9); hand.add(th);
    mesh(th, CapG(.013, .03, 8, 16), fur, 0, -.018, 0); mesh(th, SphG(1, 16, 12).scale(.009, .009, .005), pad, 0, -.034, .009);
    if (s < 0) { // his teal watch, on the right wrist
      mesh(arm, TorG(.047, .012, 12, 36), M('#2ac8b0', { roughness: .45 }), 0, -.3, 0, 1, 1, 1.12, Math.PI / 2);
      mesh(arm, CylG(.026, .026, .014, 32), new THREE.MeshPhysicalMaterial({ color: '#111111', roughness: .1, metalness: .4, clearcoat: 1 }), -.048, -.3, 0, 1, 1, 1, 0, 0, Math.PI / 2, 'WatchFace');
    }
  }
  fox.add(buildTail());
  return fox;
}

// a modern F1-style full-face helmet: a long glossy shell with a flowing livery, a clear iridium visor over the eyes,
// a black sun strip, a top air vent, a rear spoiler blade and a chin bar. The snout comes out under the visor
// (he's a fox), and the ears come out through rubber-ringed holes.
// the F1 helmet. Options: main / accent colours (the livery), earHoles (the old shape-built Foxino's ears poke
// through), ears (fox ears ON the helmet), antenna (a robot's), blackVisor (a solid black visor, no see-through),
// closed (a full chin bar: no snout hole, so no mouth shows), earScale (size of the fox ears, 1 = full size).
export function buildHelmet(o = {}) {
  const g = new THREE.Group(); g.name = 'F1Helmet';
  const MAIN = hex(o.main || '#8a4ec8'), ACC = hex(o.accent || '#ff7a1e'), ACC_D = ACC.clone().multiplyScalar(.8), earHoles = o.earHoles ?? true;
  const Rh = .3, S = new THREE.Vector3(1.0, 1.02, 1.1), GOLD = hex('#f0c040'), DEEP = MAIN.clone().multiplyScalar(.55), WHITE = hex('#fbfbfd');
  // livery: white crown with an orange swoosh sweeping back and down, deep purple lower half, gold pinstripes, a
  // purple top stripe, an orange chin, and small chequers low at the back
  const tex = paintSphere((d) => {
    const a = Math.abs(Math.atan2(d.x, d.z)) / Math.PI, y = d.y, ax = Math.abs(d.x);
    const purpleTop = .02 - .38 * a + .05 * Math.sin(a * 9), swooshLo = .1 - .34 * a, swooshHi = .34 - .3 * a;
    if (y < purpleTop - .55 && a > .55) { const k = (Math.floor(Math.atan2(d.x, d.z) * 12) + Math.floor(y * 20)) % 2; if (y > purpleTop - .7) return k ? hex('#111111') : WHITE.clone(); }
    if (Math.abs(y - purpleTop) < .018) return GOLD.clone();
    if (y < purpleTop) return mix(DEEP, MAIN, (y - purpleTop + .9) * .6);
    if (y > swooshLo && y < swooshHi) { const k = (y - swooshLo) / (swooshHi - swooshLo); return Math.abs(k - .5) > .44 ? GOLD.clone() : mix(ACC_D, ACC, k); }
    if (y > .55 && ax < .07) return mix(MAIN, DEEP, .3);
    if (y > .55 && ax < .095) return GOLD.clone();
    return WHITE.clone();
  }, 1024, 512, 0);
  const shellMat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: .28, metalness: .05, clearcoat: 1, clearcoatRoughness: .06 });
  // the shell: everything except the eye port, the snout hole, the ear holes and the bottom
  const ears = [new THREE.Vector3(-.57, .81, -.12).normalize(), new THREE.Vector3(.57, .81, -.12).normalize()];
  const eyePort = (d) => d.z > .25 && d.y > -.2 && d.y < .48 && Math.abs(d.x) < .8;
  const snout = (d) => !o.closed && d.z > .4 && d.y >= -.6 && d.y <= -.2 && Math.abs(d.x) < .44;
  const keep = (d) => !eyePort(d) && !snout(d) && d.y > -.74 && !(earHoles && ears.some((e) => d.angleTo(e) < .27));
  const shell = (radius, mat, name) => {
    const geo = SphG(radius, 128, 80).toNonIndexed(), p = geo.attributes.position, uv = geo.attributes.uv, n = geo.attributes.normal;
    const pos = [], uvs = [], nor = [], d = new THREE.Vector3();
    for (let t = 0; t < p.count; t += 3) {
      d.set(0, 0, 0); for (let k = 0; k < 3; k++) d.x += p.getX(t + k), d.y += p.getY(t + k), d.z += p.getZ(t + k); d.normalize();
      if (!keep(d)) continue;
      for (let k = 0; k < 3; k++) {
        // the lower back flares out a little, like a real helmet
        const vx = p.getX(t + k), vy = p.getY(t + k), vz = p.getZ(t + k), f = vy < 0 && vz < 0 ? 1 + (-vy / radius) * (-vz / radius) * .08 : 1;
        pos.push(vx * f, vy, vz * f); uvs.push(uv.getX(t + k), uv.getY(t + k)); nor.push(n.getX(t + k), n.getY(t + k), n.getZ(t + k));
      }
    }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return mesh(g, out, mat, 0, 0, 0, S.x, S.y, S.z, 0, 0, 0, name);
  };
  shell(Rh, shellMat, 'Shell');
  shell(Rh * .955, M('#1e1e24', { roughness: .9, side: THREE.BackSide }), 'Lining');
  // black rubber seals round the snout hole and the bottom edge, and grommets round the ears
  const onShell = (x, y) => new THREE.Vector3(x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y))).normalize().multiplyScalar(Rh * .99).multiply(S);
  const loop = (x0, y0, y1) => { const P = []; for (let i = 0; i <= 12; i++) P.push(onShell(-x0 + 2 * x0 * i / 12, y1)); for (let i = 1; i <= 10; i++) P.push(onShell(x0, y1 + (y0 - y1) * i / 10)); for (let i = 1; i < 12; i++) P.push(onShell(x0 - 2 * x0 * i / 12, y0)); for (let i = 0; i < 10; i++) P.push(onShell(-x0, y0 + (y1 - y0) * i / 10)); return P; };
  const seal = M('#16161a', { roughness: .6 });
  if (!o.closed) g.add(Object.assign(new THREE.Mesh(TubeG(new THREE.CatmullRomCurve3(loop(.44, -.6, -.2), true), 160, .01, 8, true), seal), { name: 'SnoutSeal' }));
  const bottom = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2, y = -.74, r = Math.sqrt(1 - y * y); const v = new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r).multiplyScalar(Rh).multiply(S); if (v.z < 0) { v.x *= 1.02; v.z *= 1.02; } bottom.push(v); }
  g.add(Object.assign(new THREE.Mesh(TubeG(new THREE.CatmullRomCurve3(bottom, true), 128, .02, 10, true), seal), { name: 'NeckRoll' }));
  if (earHoles) for (const e of ears) { const r = new THREE.Mesh(TorG(.088, .016, 10, 40), seal); r.position.copy(e.clone().multiplyScalar(Rh).multiply(S)); r.lookAt(r.position.clone().multiplyScalar(2)); r.name = 'EarGrommet'; g.add(r); }
  // the visor: a clear, purple-to-gold iridium shield over the eye port, with a black sun strip along the top
  const t0 = Math.acos(.5), t1 = Math.acos(-.22), ph = Math.asin(.83);
  const visorMat = o.blackVisor ? new THREE.MeshPhysicalMaterial({ color: '#040408', roughness: .12, metalness: .3, clearcoat: 1, clearcoatRoughness: .05, side: THREE.DoubleSide })   // solid black: nothing shows through
    : new THREE.MeshPhysicalMaterial({ color: '#120c22', roughness: .03, metalness: .65, transparent: true, opacity: .94, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [200, 600], clearcoat: 1, side: THREE.DoubleSide });
  const visor = new THREE.Mesh(SphG(Rh * 1.025, 96, 32, Math.PI / 2 - ph, ph * 2, t0, t1 - t0), visorMat);
  visor.scale.copy(S); visor.name = 'Visor'; g.add(visor);
  if (!o.blackVisor) { const strip = new THREE.Mesh(SphG(Rh * 1.03, 96, 6, Math.PI / 2 - ph, ph * 2, t0 - .02, .13), M('#101014', { roughness: .4, side: THREE.DoubleSide })); strip.scale.copy(S); strip.name = 'SunStrip'; g.add(strip); }
  // fox ears on top of the helmet (the foxes), or a robot antenna (Rob)
  if (o.ears) {
    // the fox ears: the same rounded, fluffy leaf ears the shape-built Foxino had — fur in the helmet colour, the
    // inside in the accent colour, cream fluff at the base — standing on top of the helmet
    const fur = FUR(MAIN), inner = FUR(ACC), creamF = FUR(CREAM);
    const earShape = new THREE.Shape(); earShape.moveTo(-.085, 0); earShape.bezierCurveTo(-.11, .12, -.07, .25, 0, .3); earShape.bezierCurveTo(.07, .25, .11, .12, .085, 0); earShape.quadraticCurveTo(0, -.02, -.085, 0);
    const innerShape = new THREE.Shape(); innerShape.moveTo(-.055, .03); innerShape.bezierCurveTo(-.07, .12, -.045, .2, 0, .24); innerShape.bezierCurveTo(.045, .2, .07, .12, .055, .03); innerShape.quadraticCurveTo(0, .02, -.055, .03);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Group(); ear.name = 'HelmetEar'; const es = o.earScale ?? 1; ear.position.set(sx * .15, .2 + (1 - es) * .03, -.04); ear.rotation.set(-.12, sx * .25, -sx * .36); ear.scale.setScalar(es); g.add(ear);
      const eg = ExtG(earShape, { depth: .03, bevelEnabled: true, bevelThickness: .022, bevelSize: .016, bevelSegments: 6, curveSegments: 32 }); eg.translate(0, 0, -.015);
      furify(eg, { amp: .01, freq: 26, droop: new THREE.Vector3(0, 1, 0), mask: (P) => smooth(.02, .1, P.y) });
      mesh(ear, eg, fur, 0, 0, 0, 1, 1, 1, 0, 0, 0, 'EarOuter');
      const ig = ExtG(innerShape, { depth: .008, bevelEnabled: true, bevelThickness: .008, bevelSize: .008, bevelSegments: 4, curveSegments: 24 });
      mesh(ear, ig, inner, 0, 0, .032, 1, 1, 1, 0, 0, 0, 'EarInner');
      const fluff = SphG(1, 40, 28).scale(.055, .06, .03); furify(fluff, { amp: .016, freq: 34, droop: new THREE.Vector3(0, 1, .3) });
      mesh(ear, fluff, creamF, 0, .06, .045, 1, 1, 1, 0, 0, 0, 'EarFluff');
    }
  }
  if (o.antenna) {
    const rod = new THREE.Mesh(CylG(.012, .016, .17, 10), M('#c8ccd4', { roughness: .3, metalness: .85 })); rod.position.set(0, .37, -.02); g.add(rod);
    const base = new THREE.Mesh(CylG(.045, .05, .03, 16), M('#2a2c32', { roughness: .5 })); base.position.set(0, .295, -.02); g.add(base);
    const ball = new THREE.Mesh(SphG(.04, 16, 12), new THREE.MeshStandardMaterial({ color: ACC, emissive: ACC, emissiveIntensity: .6, roughness: .4 })); ball.position.set(0, .47, -.02); ball.name = 'AntennaBall'; g.add(ball);
  }
  for (const s of [-1, 1]) {
    const pivot = mesh(g, CylG(.03, .03, .022, 32), M('#16161a', { roughness: .35, metalness: .4 }), 0, 0, 0, 1, 1, 1, 0, 0, Math.PI / 2, 'VisorPivot');
    pivot.position.copy(onShell(s * .86, .16)).multiplyScalar(1.01); pivot.lookAt(pivot.position.clone().multiplyScalar(2)); pivot.rotateX(Math.PI / 2);
  }
  { const tab = mesh(g, new THREE.BoxGeometry(1, 1, 1), M('#ff6a1e', { roughness: .5 }), 0, 0, 0, .008, .04, .025, 0, 0, 0, 'TearOffTab'); tab.position.copy(onShell(-.82, -.05)).multiplyScalar(1.03); tab.lookAt(tab.position.clone().multiplyScalar(2)); }
  // top air vent and the rear spoiler blade ("gurney")
  mesh(g, CapG(.02, .1, 6, 12), M('#16161a', { roughness: .5 }), 0, .292, .07, 1, 1, 1, 0, 0, Math.PI / 2, 'TopVent');
  mesh(g, CapG(.012, .1, 6, 12), M('#3a3a42', { roughness: .4 }), 0, .3, .07, 1, 1, 1, 0, 0, Math.PI / 2);
  const bl = new THREE.Shape(); bl.moveTo(-.13, 0); bl.quadraticCurveTo(0, .03, .13, 0); bl.lineTo(.12, .012); bl.quadraticCurveTo(0, .045, -.12, .012); bl.lineTo(-.13, 0);
  // a small lip spoiler on the crown, at the back
  mesh(g, ExtG(bl, { depth: .05, bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 2 }), new THREE.MeshPhysicalMaterial({ color: '#16161a', roughness: .3, clearcoat: 1 }), 0, .27, -.2, .85, 1, 1, -.55, 0, 0, 'RearSpoiler');
  return g;
}

function buildTail() {
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .44, -.13), new THREE.Vector3(.0, .38, -.3), new THREE.Vector3(.04, .46, -.5), new THREE.Vector3(.09, .7, -.58), new THREE.Vector3(.09, .94, -.48), new THREE.Vector3(.05, 1.06, -.32)]);
  const TS = L(160, 24), RS = L(48, 10), geo = new THREE.TubeGeometry(curve, TS, 1, RS, false), p = geo.attributes.position;
  for (let i = 0; i <= TS; i++) {
    const t = i / TS, c = curve.getPointAt(t), r = .03 + .15 * Math.pow(Math.sin(Math.PI * Math.min(1, t * .9 + .06)), .7) * (t > .9 ? 1 - Math.pow((t - .9) / .1, 1.5) * .9 : 1);
    for (let j = 0; j <= RS; j++) { const k = i * (RS + 1) + j; p.setXYZ(k, c.x + (p.getX(k) - c.x) * r, c.y + (p.getY(k) - c.y) * r, c.z + (p.getZ(k) - c.z) * r); }
  }
  // fur clumps, combed along the tail towards the tip
  geo.computeVertexNormals();
  const tan = []; for (let i = 0; i <= TS; i++) tan.push(curve.getTangentAt(i / TS));
  { const n = geo.attributes.normal, P = new THREE.Vector3(), N = new THREE.Vector3();
    for (let i = 0; i <= TS; i++) for (let j = 0; j <= RS; j++) {
      const k = i * (RS + 1) + j; P.fromBufferAttribute(p, k); N.fromBufferAttribute(n, k);
      const c = vnoise(P.x * 16, P.y * 16, P.z * 16, 11), clump = smooth(.3, .85, c), d = .022 * (.4 + clump) * Math.min(1, i / 10), T = tan[i];
      p.setXYZ(k, P.x + N.x * d + T.x * d * 1.6 * clump, P.y + N.y * d + T.y * d * 1.6 * clump, P.z + N.z * d + T.z * d * 1.6 * clump);
    } }
  geo.computeVertexNormals();
  const w = Math.max(128, Math.round(1024 * Q.tex)), h = Math.max(32, Math.round(128 * Q.tex)), cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'), img = x.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const t = i / w, a = j / h * Math.PI * 2, zig = .04 * Math.sin(a * 9) + .022 * Math.sin(a * 23);
    let c = PURPLE.clone(); if (t < .2) c = mix(PURPLE_D, PURPLE, t / .2);
    if (t > .48 + zig) c = mix(c, ORANGE, smooth(.48 + zig, .52 + zig, t));
    if (t > .72 + zig) c = mix(c, CREAM, smooth(.72 + zig, .78 + zig, t));
    const nn = 1 + (R() - .5) * .1 + Math.sin(j * 1.7 + i * .3) * .05, o = (j * w + i) * 4;
    img.data[o] = Math.min(255, c.r * 255 * nn); img.data[o + 1] = Math.min(255, c.g * 255 * nn); img.data[o + 2] = Math.min(255, c.b * 255 * nn); img.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const tail = new THREE.Mesh(geo, FUR(0xffffff, { map: tex })); tail.name = 'Tail'; tail.castShadow = true;
  const tip = new THREE.Mesh(furSphere(1, .032, .032, .032, { amp: .01, freq: 30 }), FUR(CREAM)); tip.position.copy(curve.getPointAt(1)); tail.add(tip);
  return tail;
}

/* =========================================================== GO-KART =========================================================== */
// a rounded box (a box whose corners are pushed out to a radius)
function roundBox(w, h, d, r = .03, seg = 6) {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg), p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3();
  const ix = w / 2 - r, iy = h / 2 - r, iz = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); c.set(Math.max(-ix, Math.min(ix, v.x)), Math.max(-iy, Math.min(iy, v.y)), Math.max(-iz, Math.min(iz, v.z)));
    const o = v.clone().sub(c); if (o.lengthSq() > 0) { o.setLength(r); v.copy(c).add(o); } p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}
const tube = (pts, r, mat, parent, name, closed = false) => { const m = new THREE.Mesh(TubeG(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed, 'catmullrom', .1), pts.length * 16, r, 12, closed), mat); m.castShadow = true; if (name) m.name = name; parent.add(m); return m; };

export function buildKart() {
  const kart = new THREE.Group(); kart.name = 'GoKart';
  // drawn from a photo of a real racing go-kart: an open frame of bright steel tubes, a red engine with a black air box
  // on the left, alloy rims, a grey seat, and smooth plastic bodywork (nose, side pods, rear bumper) over the top.
  // Only that plastic is painted in the garage — see PLASTIC / PLASTIC_D / PANEL in game.js.
  const body = M('#525a66', { roughness: .32, metalness: .05 }), bodyD = M('#3e444e', { roughness: .4 });
  const frame = M('#b9c0cc', { roughness: .28, metalness: .85 });   // the frame: polished steel, never painted
  const steel = M('#c8ccd4', { roughness: .25, metalness: .9 }), black = M('#1e2026', { roughness: .6 }), rubber = M('#16171b', { roughness: .92 });

  // the chassis: steel tubes
  for (const s of [-1, 1]) {
    tube([[s * .3, .1, -.78], [s * .32, .1, -.3], [s * .3, .1, .2], [s * .22, .11, .62], [s * .14, .13, .82]], .019, frame, kart, 'ChassisRail');
    tube([[s * .3, .1, -.3], [s * .5, .12, -.3], [s * .62, .14, -.62]], .015, frame, kart, 'ChassisBrace');
    tube([[s * .22, .11, .55], [s * .45, .12, .55], [s * .56, .13, .55]], .015, frame, kart, 'FrontAxleArm');
  }
  for (const z of [-.6, -.15, .3]) tube([[-.31, .1, z], [.31, .1, z]], .016, frame, kart, 'CrossMember');
  // floor tray and seat
  mesh(kart, roundBox(.5, .012, .7, .005, 2), M('#5a5f68', { roughness: .4, metalness: .5 }), 0, .085, .12, 1, 1, 1, 0, 0, 0, 'FloorTray');
  const seat = new THREE.Group(); seat.name = 'Seat'; seat.position.set(0, .115, -.26); kart.add(seat);
  const seatM = new THREE.MeshPhysicalMaterial({ color: '#8d93a0', roughness: .92, clearcoat: .05, sheen: .6, sheenColor: new THREE.Color('#aeb4c0') });   // grey padded seat
  // a moulded kart seat seen from the side: a base that sweeps up into a reclined back, given thickness, then pushed out across the seat's width
  const side = (pts) => { const sh = new THREE.Shape(); pts.forEach(([z, y], i) => (i ? sh.lineTo(-z, y) : sh.moveTo(-z, y))); return sh; };
  const outer = [[.15, .035], [.04, 0], [-.08, 0], [-.15, .04], [-.2, .15], [-.25, .3], [-.28, .4]], inner = [[-.255, .405], [-.225, .3], [-.175, .16], [-.13, .065], [-.07, .028], [.04, .028], [.15, .06]];
  const bodyG = ExtG(side(outer.concat(inner)), { depth: .3, bevelEnabled: true, bevelThickness: .012, bevelSize: .01, bevelSegments: 3, curveSegments: 12 });
  bodyG.rotateY(Math.PI / 2); bodyG.translate(-.15, 0, 0);
  mesh(seat, bodyG, seatM, 0, 0, 0, 1, 1, 1, 0, 0, 0, 'SeatShell');
  // side wings that hug the hips
  const wingG = ExtG(side([[.08, .02], [-.16, .02], [-.25, .33], [-.22, .36], [-.12, .2], [-.02, .12], [.08, .09]]), { depth: .012, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 2 });
  wingG.rotateY(Math.PI / 2);
  for (const sx of [-1, 1]) mesh(seat, wingG, seatM, sx * .165 - .006, 0, 0, 1, 1, 1, 0, 0, sx * -.12, 'SeatWing');
  // seat stays down to the chassis
  for (const sx of [-1, 1]) tube([[sx * .12, .0, -.02], [sx * .13, .2, -.2]], .008, M('#b9c0cc', { roughness: .28, metalness: .85 }), seat, 'SeatStay');
  // the grey plastic bodywork that protects the kart (shapes drawn from above, then given height with rounded edges):
  // a wide front fairing, big side pods between the wheels, and a rear bumper that wraps round behind the back wheels
  // THE ONLY PAINTED PARTS (game.js tints exactly these three colours): nose fairing, side pods, rear bumper, front panel
  const plastic = new THREE.MeshPhysicalMaterial({ color: '#66707c', roughness: .55, clearcoat: .25, clearcoatRoughness: .4 }), plasticD = M('#4e555f', { roughness: .6 });
  const fromAbove = (pts, h, bevel = .03) => { const sh = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z))); const g = ExtG(sh, { depth: h, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 16 }); g.rotateX(-Math.PI / 2); return g; };
  const smoothPts = (pts, n = 10) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal').getPoints(pts.length * n).map((v) => [v.x, v.z]);
  // front fairing: spans both front wheels, rounded nose, with a raised centre
  mesh(kart, fromAbove(smoothPts([[-.64, .66], [-.72, .8], [-.6, .96], [0, 1.03], [.6, .96], [.72, .8], [.64, .66], [.3, .7], [0, .72], [-.3, .7]]), .07), plastic, 0, .08, 0, 1, 1, 1, 0, 0, 0, 'FrontFairing');
  mesh(kart, fromAbove(smoothPts([[-.32, .74], [-.36, .86], [0, .96], [.36, .86], [.32, .74], [0, .76]]), .05, .025), plasticD, 0, .18, 0, 1, 1, 1, 0, 0, 0, 'FairingTop');
  // side pods: from behind the front wheels to the back wheels, out to the line of the wheels
  for (const s of [-1, 1]) {
    const pts = smoothPts([[.4, -.38], [.6, -.42], [.72, -.3], [.73, .2], [.66, .36], [.46, .4], [.38, .3], [.37, -.25]].map(([x, z]) => [x * s, z]));
    mesh(kart, fromAbove(pts, .09), plastic, 0, .09, 0, 1, 1, 1, 0, 0, 0, 'SidePod');
    mesh(kart, fromAbove(smoothPts([[.47, -.3], [.66, -.28], [.67, .18], [.5, .28], [.45, .2]].map(([x, z]) => [x * s, z])), .02, .012), plasticD, 0, .205, 0, 1, 1, 1, 0, 0, 0, 'SidePodStripe');
  }
  mesh(kart, roundBox(.36, .26, .05, .03), body, 0, .33, .5, 1, 1, 1, -.45, 0, 0, 'FrontPanel');
  mesh(kart, roundBox(.22, .14, .015, .012), M('#f6f6f8', { roughness: .4 }), 0, .345, .523, 1, 1, 1, -.45, 0, 0, 'NumberPlate');
  // fuel tank, pedals
  mesh(kart, roundBox(.16, .1, .14, .04), M('#e8e8ec', { roughness: .3, transparent: true, opacity: .9 }), 0, .17, .28, 1, 1, 1, 0, 0, 0, 'FuelTank');
  mesh(kart, CylG(.025, .025, .03, 16), black, 0, .235, .28, 1, 1, 1, 0, 0, 0);
  for (const x of [-.07, .07]) mesh(kart, roundBox(.05, .08, .015, .006), steel, x, .16, .66, 1, 1, 1, -.5, 0, 0, 'Pedal');
  // steering column and wheel
  tube([[0, .13, .55], [0, .3, .38], [0, .4, .24]], .014, steel, kart, 'SteeringColumn');
  const wheel = new THREE.Group(); wheel.name = 'SteeringWheel'; wheel.position.set(0, .405, .235); kart.add(wheel);
  wheel.rotation.x = -2.42;   // its face points back up the column, towards the driver
  const grip = M('#18191d', { roughness: .85 }), alu = M('#c8ccd4', { roughness: .3, metalness: .85 });
  mesh(wheel, TorG(.13, .012, 12, 64), M('#2a2c32', { roughness: .4, metalness: .3 }), 0, 0, 0, 1, .86, 1, 0, 0, 0, 'WheelRim');
  for (const a of [Math.PI * .82, -Math.PI * .18]) { const g2 = new THREE.Mesh(TorG(.13, .022, 14, 32, 1.2), grip); g2.rotation.z = a; g2.scale.set(1, .86, 1); g2.castShadow = true; wheel.add(g2); } // padded hand grips left and right
  mesh(wheel, roundBox(.1, .075, .02, .018), alu, 0, 0, -.01, 1, 1, 1, 0, 0, 0, 'WheelHub');
  for (const a of [Math.PI / 2 + .95, Math.PI / 2 - .95, -Math.PI / 2]) { const sp2 = mesh(wheel, roundBox(.09, .022, .01, .005), alu, Math.cos(a) * .075, Math.sin(a) * .066, -.01, 1, 1, 1, 0, 0, a); sp2.name = 'Spoke'; }
  mesh(wheel, CylG(.022, .022, .03, 24), M('#ff6a1e', { roughness: .4 }), 0, 0, .002, 1, 1, 1, Math.PI / 2, 0, 0, 'HornButton');
  // the engine beside the seat, copied from the photo: a red block with cooling fins and a pull-start, a black air box
  // on top with a yellow label, and a chrome exhaust. Never painted.
  const eng = new THREE.Group(); eng.name = 'Engine'; eng.position.set(-.3, .17, -.42); kart.add(eng);
  const engRed = M('#c42a22', { roughness: .35, metalness: .35 }), engBlack = M('#232529', { roughness: .55 }), engSilver = M('#aeb4c0', { roughness: .3, metalness: .8 });
  mesh(eng, roundBox(.17, .17, .21, .025), engRed, 0, .08, 0, 1, 1, 1, 0, 0, 0, 'EngineBlock');
  mesh(eng, CylG(.075, .075, .035, 28), engRed, .095, .07, .02, 1, 1, 1, 0, 0, Math.PI / 2, 'PullStart');       // the round pull-start cover
  for (let k = 0; k < 7; k++) mesh(eng, roundBox(.175, .01, .2, .004), engRed, 0, .035 + k * .019, 0, 1, 1, 1, 0, 0, 0, 'CoolingFin');
  mesh(eng, roundBox(.19, .1, .2, .022), engBlack, 0, .215, .01, 1, 1, 1, 0, 0, 0, 'AirBox');                   // the black box on top
  mesh(eng, roundBox(.1, .055, .016, .008), M('#e8c53a', { roughness: .5 }), 0, .215, .115, 1, 1, 1, 0, 0, 0, 'EngineLabel');
  mesh(eng, CylG(.055, .055, .1, 24), engBlack, -.03, .19, .16, 1, 1, 1, Math.PI / 2, 0, 0, 'AirFilter');
  mesh(eng, roundBox(.07, .07, .09, .02), engSilver, .085, .13, -.07, 1, 1, 1, 0, 0, 0, 'Carb');
  tube([[.06, .1, -.08], [.1, .12, -.2], [.1, .2, -.35], [.05, .25, -.42]], .022, steel, eng, 'Exhaust');
  mesh(eng, CylG(.04, .04, .14, 24), steel, .05, .27, -.45, 1, 1, 1, Math.PI / 2 - .4);
  // rear axle and bumper
  mesh(kart, CylG(.022, .022, 1.24, 20), steel, 0, .14, -.62, 1, 1, 1, 0, 0, Math.PI / 2, 'RearAxle');
  tube([[-.55, .14, -.86], [-.3, .16, -.92], [.3, .16, -.92], [.55, .14, -.86]], .02, frame, kart, 'RearBumperBar');
  mesh(kart, fromAbove(smoothPts([[-.82, -.52], [-.84, -.86], [-.7, -1.0], [.7, -1.0], [.84, -.86], [.82, -.52], [.76, -.5], [.76, -.8], [0, -.84], [-.76, -.8], [-.76, -.5]]), .1), plastic, 0, .08, 0, 1, 1, 1, 0, 0, 0, 'RearBumper');
  // wheels: slicks on light rims
  const wheelAt = (x, z, r, w, name) => {
    const g = new THREE.Group(); g.name = name; g.position.set(x, r, z); kart.add(g);
    const tire = lathe([[r * .62, -w / 2], [r * .9, -w / 2], [r * .98, -w * .42], [r, -w * .2], [r, w * .2], [r * .98, w * .42], [r * .9, w / 2], [r * .62, w / 2]], 48);
    mesh(g, tire, rubber, 0, 0, 0, 1, 1, 1, 0, 0, Math.PI / 2, 'Tire');
    const side = Math.sign(x);
    // the rim: polished alloy, like the photo. Fixed: the garage colour never reaches it.
    const plastic = M('#cfd4dc', { roughness: .22, metalness: .95 }), plasticD = M('#9aa1ab', { roughness: .3, metalness: .9 });
    mesh(g, CylG(r * .63, r * .63, w * .92, 40, 1, true), plasticD, 0, 0, 0, 1, 1, 1, 0, 0, Math.PI / 2, 'RimBarrel').material.side = THREE.DoubleSide;
    const face = new THREE.Group(); face.position.x = side * w * .4; g.add(face);
    mesh(face, TorG(r * .6, r * .05, 10, 40), plastic, 0, 0, 0, 1, 1, 1, 0, Math.PI / 2, 0, 'RimLip');
    mesh(face, CylG(r * .58, r * .58, .012, 36), plasticD, side * -.004, 0, 0, 1, 1, 1, 0, 0, Math.PI / 2, 'RimDish');
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; mesh(face, roundBox(.012, r * .5, r * .13, .005), plastic, 0, Math.sin(a) * r * .33, Math.cos(a) * r * .33, 1, 1, 1, a, 0, 0, 'RimSpoke'); }
    mesh(face, CylG(r * .2, r * .24, .02, 28), plastic, side * .002, 0, 0, 1, 1, 1, 0, 0, Math.PI / 2, 'RimHub');
    mesh(face, CylG(r * .09, r * .09, .03, 6), M('#c8ccd4', { roughness: .3, metalness: .85 }), side * .008, 0, 0, 1, 1, 1, 0, 0, Math.PI / 2, 'WheelNut');
    return g;
  };
  wheelAt(-.62, -.62, .14, .21, 'WheelRearRight'); wheelAt(.62, -.62, .14, .21, 'WheelRearLeft');
  wheelAt(-.6, .55, .125, .14, 'WheelFrontRight'); wheelAt(.6, .55, .125, .14, 'WheelFrontLeft');
  for (const s of [-1, 1]) tube([[s * .56, .13, .55], [s * .52, .2, .55]], .014, frame, kart, 'Kingpin');
  return kart;
}
