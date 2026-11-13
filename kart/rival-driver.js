/* =====================================================================================================
   FOXKARTS · the AI rivals' driver (2026-11-13, the user: "use it and replace it in the games", the rivals become the
   racing driver; "make sure everything fits, the hands are on the steering wheel").
   models/racing-driver.glb is the Tripo model (low poly, red suit, gloves, boots, closed helmet, Mixamo skeleton, A-pose).
   Here it is posed once, sitting in the default kart: reclined a little, legs forward to the pedals, and each arm solved
   with two-bone IK so the glove closes on the rim at 10 and 2. Then the skinning is baked into a plain mesh (like the
   official characters in chars/), and game.js adds the morphs that turn the hands with the wheel.
   Each rival gets the suit in its own colour (the red parts of the texture take the rival's hue).
   ===================================================================================================== */
import * as THREE from './lib/three.module.min.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const DOWN = V(0, -1, 0);
// the pose (radians): + recline leans the back toward the seat, thigh lifts the legs forward, knee bends them down
export const DRIVER_POSE = { recline: -.12, hunch: .45, head: -.05, thigh: 1.42, spread: .1, knee: .62, ankle: -.45, grip: 1.0, elbowOut: .55, tuck: .55, palmIn: .25, palmGap: .02, palmBack: .3, curl: [.9, .8, .6], thumb: .3, dropFeet: true };

/* scene: the loaded glTF scene (it is posed in place, so pass a fresh one or one you don't draw).
   o: { S: scale model -> kart, seat: kart-space point for the hips, W: the wheel { c, a, Rc, tr } in kart space }
   returns { geo (model space, posed), hips (model space), S, reach: [left, right] (1 = arm fully stretched) } */
export function bakeSeatedDriver(scene, o) {
  const P = { ...DRIVER_POSE, ...(o.pose || {}) }, S = o.S, seat = o.seat.clone(), W = o.W;
  scene.position.set(0, 0, 0); scene.rotation.set(0, 0, 0); scene.scale.setScalar(1); scene.updateMatrixWorld(true);
  let mesh = null; scene.traverse((x) => { if (x.isSkinnedMesh) mesh = x; });
  const B = {}; for (const b of mesh.skeleton.bones) B[b.name.replace(/^mixamorig:?/, '')] = b;
  const all = []; B.Hips.traverse((b) => { if (b.isBone) all.push(b); });
  const wp = (b) => b.getWorldPosition(V(0, 0, 0)), wq = (b) => b.getWorldQuaternion(new THREE.Quaternion());
  const rest = new Map(); for (const b of all) rest.set(b, { local: b.quaternion.clone(), world: wq(b) });
  const RD = new Map(); for (const b of all) { const c = b.children.find((x) => x.isBone); if (c) RD.set(b, wp(c).sub(wp(b)).normalize()); }
  const restDir = (b) => RD.get(b).clone();   // (measured at rest, before any posing)
  const len = (b) => { const c = b.children.find((x) => x.isBone); return wp(c).distanceTo(wp(b)); };
  const hips = wp(B.Hips);
  const toK = (v) => v.clone().sub(hips).multiplyScalar(S).add(seat), toM = (k) => k.clone().sub(seat).multiplyScalar(1 / S).add(hips);
  const RX = (a) => new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), a), RZ = (a) => new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), a);
  const fixDown = (b) => new THREE.Quaternion().setFromUnitVectors(restDir(b), DOWN);   // A-pose limb -> straight down
  const armature = B.Hips.parent, armQ = wq(armature);

  // ---- 1. the body: deltas in model space (the model faces +Z like the kart) ----
  const D = new Map();   // bone -> world target rotation
  const setDelta = (b, delta, fix) => { const q = delta.clone(); if (fix) q.multiply(fix); D.set(b, q.multiply(rest.get(b).world)); };
  const dHips = RX(P.recline);
  setDelta(B.Hips, dHips);
  setDelta(B.Spine, dHips.clone().multiply(RX(P.hunch / 3)));
  setDelta(B.Spine1, dHips.clone().multiply(RX(P.hunch * 2 / 3)));
  const dChest = dHips.clone().multiply(RX(P.hunch));
  setDelta(B.Spine2, dChest);
  setDelta(B.Neck, dChest.clone().multiply(RX(-P.hunch * .5)));
  setDelta(B.Head, dHips.clone().multiply(RX(P.head)));   // eyes on the road
  for (const [side, s] of [['Left', 1], ['Right', -1]]) {
    const dThigh = dHips.clone().multiply(RZ(s * P.spread)).multiply(RX(-P.thigh));
    setDelta(B[side + 'UpLeg'], dThigh, fixDown(B[side + 'UpLeg']));
    const dShin = dThigh.clone().multiply(RX(P.knee));
    setDelta(B[side + 'Leg'], dShin, fixDown(B[side + 'Leg']));
    setDelta(B[side + 'Foot'], dShin.clone().multiply(RX(P.ankle)));
  }
  const apply = () => {
    for (const b of all) {
      const pT = b.parent && b.parent.isBone ? b.parent.getWorldQuaternion(new THREE.Quaternion()) : armQ.clone();
      const T = D.get(b) || pT.clone().multiply(rest.get(b).local);
      b.quaternion.copy(pT.invert().multiply(T)); b.updateMatrixWorld(true);
    }
  };
  apply();

  // ---- 2. the arms: two-bone IK onto the rim at 10 and 2 ----
  const up = V(0, 1, 0), e2 = up.clone().addScaledVector(W.a, -up.dot(W.a)).normalize();
  let e1 = new THREE.Vector3().crossVectors(e2, W.a).normalize(); if (e1.x < 0) e1.negate();   // e1: towards the driver's left (+X)
  const toDriver = W.a.clone().multiplyScalar(Math.sign(W.a.dot(seat.clone().sub(W.c))) || 1);
  const reach = [];
  for (const [side, s] of [['Left', 1], ['Right', -1]]) {
    const arm = B[side + 'Arm'], fore = B[side + 'ForeArm'], hand = B[side + 'Hand'], knuckle = B[side + 'HandMiddle1'] || hand.children.find((x) => x.isBone);
    const L1 = len(arm) * S, L2 = len(fore) * S, Lh = wp(knuckle).distanceTo(wp(hand)) * S;
    const ang = P.grip;   // from the top of the wheel: 1.0 rad ≈ 10 and 2 o'clock
    // u: out from the wheel's centre at the grip; fwd: away from the driver through the wheel
    const u = e2.clone().multiplyScalar(Math.cos(ang)).addScaledVector(e1, s * Math.sin(ang)).normalize(), fwd = toDriver.clone().negate();
    const rimC = W.c.clone().addScaledVector(u, W.Rc), tube = W.tr || .02;
    // the glove lies on the outside of the rim, palm in towards the hub, knuckles just past the rim: the fingers curl round it
    const h = fwd.clone().addScaledVector(u, -P.palmIn).normalize();
    const palmC = rimC.clone().addScaledVector(u, tube + P.palmGap).addScaledVector(toDriver, Lh * P.palmBack);
    const Sh = toK(wp(arm));
    let Wr = palmC.clone().addScaledVector(h, -Lh * .5);
    let d = Wr.clone().sub(Sh); const dl = d.length(); reach.push(dl / (L1 + L2));
    const dn = d.clone().normalize(), dc = Math.min(dl, (L1 + L2) * .999);
    if (dl > dc) Wr = Sh.clone().addScaledVector(dn, dc);
    const ca = clamp01((L1 * L1 + dc * dc - L2 * L2) / (2 * L1 * dc), -1, 1), a = Math.acos(ca);
    const pole = V(s * P.elbowOut, -1, -P.tuck).normalize(), pp = pole.addScaledVector(dn, -pole.dot(dn)).normalize();
    const El = Sh.clone().addScaledVector(dn, Math.cos(a) * L1).addScaledVector(pp, Math.sin(a) * L1);
    // turn each bone from its rest direction onto the solved one (model and kart space share directions)
    const aim = (b, from, to) => {
      const q = new THREE.Quaternion().setFromUnitVectors(restDir(b), to.clone().sub(from).normalize()).multiply(rest.get(b).world);
      D.set(b, q);
    };
    aim(arm, Sh, El); aim(fore, El, Wr);
    // the glove: pointing along h, the palm (which faced the leg in the A-pose) turned in towards the hub
    const q1 = new THREE.Quaternion().setFromUnitVectors(restDir(hand), h);
    const nRest = V(-s, 0, 0).addScaledVector(restDir(hand), s * restDir(hand).x).normalize();
    const n1 = nRest.applyQuaternion(q1), nd = u.clone().negate().addScaledVector(h, u.dot(h)).normalize();
    const tw = Math.atan2(new THREE.Vector3().crossVectors(n1, nd).dot(h), n1.dot(nd));
    const qHand = new THREE.Quaternion().setFromAxisAngle(h, tw).multiply(q1);
    D.set(hand, qHand.clone().multiply(rest.get(hand).world));
    // the fingers curl round the rim (about the knuckles' axis, towards the palm); the thumb a little
    const k = new THREE.Vector3().crossVectors(h, nd).normalize();
    for (const f of ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb']) {
      let cum = 0;
      for (let j = 1; j <= 3; j++) {
        const fb = B[side + 'Hand' + f + j]; if (!fb) continue;
        cum += f === 'Thumb' ? P.thumb : P.curl[j - 1];
        D.set(fb, new THREE.Quaternion().setFromAxisAngle(k, cum).multiply(qHand).multiply(rest.get(fb).world));
      }
    }
  }
  apply();
  // (v312, the user: "make the helmet twice smaller") the head bone scaled: the helmet shrinks round the neck
  if (P.headScale && P.headScale !== 1) { B.Head.scale.setScalar(P.headScale); B.Head.updateMatrixWorld(true); }

  // ---- 3. bake the skinning (positions and normals) into a plain geometry, in model space ----
  mesh.updateMatrixWorld(true); mesh.skeleton.update();
  const g = mesh.geometry, Pa = g.attributes.position, Na = g.attributes.normal, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
  const bm = mesh.skeleton.boneMatrices, n = Pa.count, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  const acc = new THREE.Matrix4(), M = new THREE.Matrix4(), full = new THREE.Matrix4(), n3 = new THREE.Matrix3(), v = V(0, 0, 0);
  for (let i = 0; i < n; i++) {
    acc.elements.fill(0);
    for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k); if (!w) continue; M.fromArray(bm, SI.getComponent(i, k) * 16); for (let e = 0; e < 16; e++) acc.elements[e] += w * M.elements[e]; }
    full.copy(mesh.matrixWorld).multiply(mesh.bindMatrixInverse).multiply(acc).multiply(mesh.bindMatrix);
    v.fromBufferAttribute(Pa, i).applyMatrix4(full); pos.set([v.x, v.y, v.z], i * 3);
    if (Na) { n3.getNormalMatrix(full); v.fromBufferAttribute(Na, i).applyMatrix3(n3).normalize(); nor.set([v.x, v.y, v.z], i * 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (Na) geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); else geo.computeVertexNormals();
  if (g.attributes.uv) geo.setAttribute('uv', g.attributes.uv.clone());
  // (v312, the user: "remove his tail") the tail hangs off the hips: hip / spine vertices further than dropTail (model
  // units) from the hips' vertical axis are tail (the torso ends at ~0.14, the tail starts at ~0.16)
  const domJ = (i) => { let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k); if (w > bw) { bw = w; best = SI.getComponent(i, k); } } return best; };
  const trunk = new Set(['Hips', 'Spine', 'Spine1'].map((nm) => B[nm] && mesh.skeleton.bones.indexOf(B[nm])).filter((x) => x >= 0));
  const isTail = (i) => P.dropTail && trunk.has(domJ(i)) && Math.hypot(Pa.getX(i) - hips.x, Pa.getZ(i) - hips.z) > P.dropTail;
  if (g.index) {
    // the boots stay down in the footwell where nobody sees them; dropped, so a toe can never poke through the nose or the floor
    const feet = new Set(['LeftFoot', 'LeftToeBase', 'LeftToe_End', 'RightFoot', 'RightToeBase', 'RightToe_End'].map((nm) => B[nm] && mesh.skeleton.bones.indexOf(B[nm])).filter((x) => x >= 0));
    const footW = (i) => { let w = 0; for (let k = 0; k < 4; k++) if (feet.has(SI.getComponent(i, k))) w += SW.getComponent(i, k); return w; };
    const idx = g.index.array, keep = [];
    for (let t = 0; t < idx.length; t += 3) { if (P.dropFeet && footW(idx[t]) + footW(idx[t + 1]) + footW(idx[t + 2]) >= 1.5) continue; if (isTail(idx[t]) || isTail(idx[t + 1]) || isTail(idx[t + 2])) continue; keep.push(idx[t], idx[t + 1], idx[t + 2]); }
    geo.setIndex(keep);
  }
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  return { geo, hips, S, reach, toK, toM, map: mesh.material.map };
}
function clamp01(x, a, b) { return Math.max(a, Math.min(b, x)); }

/* the suit in a rival's colour: the saturated red of the texture takes the rival's hue (white stripes, the black visor
   and the soles stay); drawn at 1024 px */
const RECOL = new Map();
/* (2026-11-13) the player's Foxino: his helmet's main colour is a flat bright blue in the texture (#1e7bff, used nowhere
   else on him), repainted to the colour the player picks for the kart, keeping the shading */
export function helmetPaint(map, color) { return rivalSuit(map, color, (h) => h.s > .45 && h.h > .55 && h.h < .68, 'helm', FOX_FUR); }
/* Foxino's fur: Tripo baked it bright magenta-pink (hue ~0.83); his fixed trait is the purple of the original picture
   (#8f52d9 family), so the fur is pulled to that hue and a little darker */
const FOX_FUR = (h) => h.s > .35 && h.h > .76 && h.h < .93 ? [.75, Math.min(h.s, .58), h.l * .92] : null;
export function rivalSuit(map, color, pick = null, tag = 'suit', extra = null) {
  const key = tag + color; if (RECOL.has(key)) return RECOL.get(key);
  const img = map.image, N = 1024, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, N, N);
  const d = x.getImageData(0, 0, N, N), a = d.data, target = new THREE.Color(color), th = {}; target.getHSL(th);
  const c = new THREE.Color(), hsl = {};
  for (let i = 0; i < a.length; i += 4) {
    c.setRGB(a[i] / 255, a[i + 1] / 255, a[i + 2] / 255); c.getHSL(hsl);
    const ex = extra ? extra(hsl) : null;
    if (ex) { c.setHSL(ex[0], ex[1], ex[2]); a[i] = c.r * 255; a[i + 1] = c.g * 255; a[i + 2] = c.b * 255; continue; }
    const hit = pick ? pick(hsl) : hsl.s > .35 && (hsl.h < .07 || hsl.h > .93);
    if (!hit) continue;
    // keep the shading (lightness relative to the suit's mid red), take the rival's hue and saturation
    const l = clamp01(th.l + (hsl.l - .45) * .9, .08, .9);
    c.setHSL(th.h, Math.max(.45, th.s), l);
    a[i] = c.r * 255; a[i + 1] = c.g * 255; a[i + 2] = c.b * 255;
  }
  x.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.flipY = map.flipY; t.anisotropy = 4;
  RECOL.set(key, t); return t;
}
