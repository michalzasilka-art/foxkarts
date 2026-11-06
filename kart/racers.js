/* =====================================================================================================
   FOXKARTS · the other four drivers, built from shapes, already sitting in the kart
   (kart space: the kart faces +z, the seat is at z ≈ −0.3, the steering wheel at (0, 0.41, 0.24)).
   Each one keeps the fixed traits from the vault's "Character Creation Rules":
     Stella  orange fox girl, purple streak, long side braid, blue overalls with a yellow star, white T-shirt
     Pix     green elf technician; her eyes are ALWAYS under her long lime-green bangs (here: under the helmet's
             dark visor, with her bangs showing below it); pointed ears, purple top, tool belt with a wrench
     Gummy   tall thin pink-and-blue gummy alien, curly antennae, big purple eyes (under the visor), buck teeth
     Rob     round cyan robot, black screen face with smiling eyes, antenna with a red heart, orange battery window
   Foxino himself is the Higgsfield model (foxino-seated.glb).
   ===================================================================================================== */
import * as THREE from 'three';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .7, ...o });
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function mesh(parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.rotation.set(...r); m.scale.set(...s); m.castShadow = true; parent.add(m); return m;
}
const ball = (parent, r, mat, p, s = [1, 1, 1], seg = 20) => mesh(parent, new THREE.SphereGeometry(r, seg, Math.round(seg * .7)), mat, p, [0, 0, 0], s);
// a rounded limb from a to b
function limb(parent, a, b, r, mat, r2 = r) {
  const d = b.clone().sub(a), len = d.length(), g = r === r2 ? new THREE.CapsuleGeometry(r, len, 4, 12) : new THREE.CylinderGeometry(r2, r, len, 12);
  const m = new THREE.Mesh(g, mat); m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); m.castShadow = true; parent.add(m);
  if (r !== r2) { ball(parent, r, mat, a.toArray(), [1, 1, 1], 12); ball(parent, r2, mat, b.toArray(), [1, 1, 1], 12); }
  return m;
}
// an F1-style helmet: painted shell (top colour, a centre stripe, a band, lower colour), a dark visor, a chin opening
function helmet(parent, c, center = V(0, .84, -.33), R = .25) {
  const tex = (() => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d');
    x.fillStyle = c.top; x.fillRect(0, 0, 256, 128); x.fillStyle = c.lower; x.fillRect(0, 62, 256, 66);
    x.fillStyle = c.band; x.fillRect(0, 52, 256, 12); x.fillStyle = c.pin || '#f0c040'; x.fillRect(0, 50, 256, 2); x.fillRect(0, 64, 256, 2);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const g = new THREE.Group(); g.position.copy(center); parent.add(g);
  const shell = mesh(g, new THREE.SphereGeometry(R, 32, 20, 0, Math.PI * 2, 0, 2.35), new THREE.MeshStandardMaterial({ map: tex, roughness: .25, metalness: .05 }), [0, 0, 0], [0, -Math.PI / 2, 0], [1, 1.02, 1.1]);
  shell.material.side = THREE.DoubleSide;
  // the visor: a dark band across the front at eye level
  mesh(g, new THREE.SphereGeometry(R * 1.035, 32, 12, Math.PI / 2 - .95, 1.9, 1.08, .55), M('#100a20', { roughness: .08, metalness: .6 }), [0, 0, 0], [0, 0, 0], [1, 1.02, 1.1]);
  // a little rear spoiler
  mesh(g, new THREE.BoxGeometry(.2, .025, .07), M('#16161a', { roughness: .4 }), [0, R * .98, -R * .55], [-.25, 0, 0]);
  return g;
}
// the seated body shared by the furry/human drivers: torso, arms reaching to the wheel, legs forward to the pedals
function body(g, c) {
  const shirt = M(c.shirt), skin = M(c.skin), legs = M(c.legs), feet = M(c.feet || '#2a2e38');
  mesh(g, new THREE.CapsuleGeometry(c.torsoR || .15, .24, 6, 16), shirt, [0, .44, -.34], [-.12, 0, 0], [1.05, 1, .82]);
  for (const s of [-1, 1]) {
    const sh = V(s * .17, .58, -.33), el = V(s * .25, .47, -.08), ha = V(s * .13, .45, .19);
    limb(g, sh, el, .052, c.sleeves === 'long' ? shirt : skin); limb(g, el, ha, .045, skin);
    ball(g, .058, M(c.hand || c.skin), ha.toArray(), [1, .8, 1.1], 14);
    if (c.sleeves !== 'long') ball(g, .07, shirt, sh.toArray(), [1, 1, 1], 14);
    const hip = V(s * .09, .27, -.27), kn = V(s * .13, .33, .06), ft = V(s * .1, .21, .45);
    limb(g, hip, kn, .07, legs); limb(g, kn, ft, .055, legs, .05); ball(g, .075, feet, [s * .1, .2, .5], [1, .8, 1.4], 14);
  }
  ball(g, .09, skin, [0, .64, -.34], [1, .8, 1], 14);   // neck
}
// a fox muzzle under the visor: snout, nose, smile
function muzzle(g, color, center) {
  const m = ball(g, .1, M(color), [center.x, center.y - .09, center.z + .19], [.9, .7, 1.1], 18);
  ball(g, .025, M('#2a1418', { roughness: .3 }), [center.x, center.y - .07, center.z + .3], [1, .8, 1], 10);
  mesh(g, new THREE.TorusGeometry(.04, .008, 6, 16, Math.PI), M('#5a1a22'), [center.x, center.y - .14, center.z + .27], [0, 0, Math.PI]);
  return m;
}
function curve(points, r, mat, parent) { const c = new THREE.CatmullRomCurve3(points); const m = new THREE.Mesh(new THREE.TubeGeometry(c, points.length * 10, r, 8), mat); m.castShadow = true; parent.add(m); return m; }

export function buildStella() {
  const g = new THREE.Group(), fur = M('#ff8a2a'), cream = M('#fff0dc'), purple = M('#8a4ec8'), C = V(0, .84, -.33);
  body(g, { shirt: '#ffffff', skin: '#ff8a2a', legs: '#3c6ae0', hand: '#ff9a3a', feet: '#fff0dc' });
  // blue overalls: a bib over the white T-shirt, two straps and a yellow star
  mesh(g, new THREE.BoxGeometry(.24, .2, .06), M('#3c6ae0'), [0, .44, -.21], [-.12, 0, 0]);
  for (const s of [-1, 1]) mesh(g, new THREE.BoxGeometry(.04, .2, .04), M('#3c6ae0'), [s * .09, .56, -.25], [-.4, 0, 0]);
  const st = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? .02 : .045; (k ? st.lineTo : st.moveTo).call(st, Math.cos(a) * r, -Math.sin(a) * r); }
  mesh(g, new THREE.ExtrudeGeometry(st, { depth: .01, bevelEnabled: false }), M('#ffd23a', { roughness: .4 }), [0, .46, -.175], [-.12, 0, 0]);
  helmet(g, { top: '#ffffff', band: '#3c8cf0', lower: '#ff8a2a', stripe: '#8a4ec8' }, C);
  muzzle(g, '#fff0dc', C);
  // fox ears through the helmet: orange with cream insides and a purple streak on one
  for (const s of [-1, 1]) { const e = mesh(g, new THREE.ConeGeometry(.07, .17, 12), s < 0 ? purple : fur, [C.x + s * .13, C.y + .25, C.z - .02], [0, 0, s * -.35]); mesh(e, new THREE.ConeGeometry(.04, .11, 10), cream, [0, -.01, .03]); }
  // the long side braid: orange with a purple streak, down over her right shoulder
  const pts = [V(-.14, .82, -.48), V(-.2, .7, -.45), V(-.22, .58, -.36), V(-.22, .46, -.27)];
  pts.forEach((p, i) => ball(g, .055 - i * .006, i % 2 ? purple : fur, p.toArray(), [1, 1.15, 1], 14));
  ball(g, .03, M('#3c8cf0'), [-.22, .4, -.25]);
  // her fox tail behind the seat
  curve([V(0, .3, -.55), V(0, .42, -.72), V(.05, .62, -.78)], .08, fur, g); ball(g, .085, cream, [.05, .66, -.78], [1, 1.2, 1]);
  return g;
}
export function buildPix() {
  const g = new THREE.Group(), skin = M('#7ad86a'), hair = M('#b8f040', { roughness: .6 }), C = V(0, .84, -.33);
  body(g, { shirt: '#8a4ae8', skin: '#7ad86a', legs: '#8a909c', sleeves: 'long', hand: '#7ad86a', feet: '#3a3e48', torsoR: .14 });
  mesh(g, new THREE.BoxGeometry(.2, .06, .05), M('#ffffff'), [0, .56, -.22], [-.12, 0, 0]);   // white crop top showing at the collar
  // tool belt with a wrench
  mesh(g, new THREE.TorusGeometry(.15, .025, 8, 24), M('#8a5a2a'), [0, .32, -.33], [Math.PI / 2, 0, 0], [1, .85, 1]);
  mesh(g, new THREE.BoxGeometry(.03, .14, .015), M('#c8ccd4', { metalness: .8, roughness: .3 }), [.15, .26, -.25], [0, 0, .3]);
  // helmet in her cap colours: purple with an orange band
  helmet(g, { top: '#8a4ae8', band: '#ff8a1e', lower: '#6a36a8', stripe: '#ff8a1e' }, C);
  // her lime-green bangs come down under the front of the helmet, over the dark visor's lower edge (eyes always hidden)
  // (a soft fringe over the upper half of the visor, with rounded strand tips along its edge)
  mesh(g, new THREE.SphereGeometry(.25 * 1.07, 32, 12, Math.PI / 2 - 1.15, 2.3, .55, .82), hair, [C.x, C.y, C.z], [0, 0, 0], [1, 1.02, 1.1]).material.side = THREE.DoubleSide;
  // a small nose, mouth and chin below
  ball(g, .075, skin, [C.x, C.y - .13, C.z + .17], [1, .9, .9], 16); ball(g, .016, M('#5aa850'), [C.x, C.y - .1, C.z + .245]);
  mesh(g, new THREE.TorusGeometry(.028, .006, 6, 14, Math.PI), M('#a0303a'), [C.x, C.y - .155, C.z + .23], [0, 0, Math.PI]);
  // long hair down her back, and pointed elf ears out of the sides
  for (let k = 0; k < 5; k++) ball(g, .1 - k * .008, hair, [0, .8 - k * .08, -.5 + k * .01], [1.3, 1, .7], 14);
  for (const s of [-1, 1]) mesh(g, new THREE.ConeGeometry(.04, .16, 10), skin, [C.x + s * .27, C.y - .02, C.z], [0, 0, s * 1.2]);
  return g;
}
export function buildGummy() {
  const g = new THREE.Group(), pink = M('#ff6ab8', { roughness: .25, metalness: .05 }), blue = M('#5ab0ff', { roughness: .25 }), C = V(0, .96, -.33);
  // tall and thin: a long gummy neck under a higher helmet
  body(g, { shirt: '#ff6ab8', skin: '#ff6ab8', legs: '#5ab0ff', hand: '#ff8ac8', feet: '#5ab0ff', torsoR: .12 });
  mesh(g, new THREE.CapsuleGeometry(.08, .1, 4, 12), blue, [0, .44, -.24], [-.12, 0, 0], [1, 1, .6]);   // blue belly
  limb(g, V(0, .6, -.34), V(0, .8, -.34), .06, pink);
  helmet(g, { top: '#ffffff', band: '#ff5db1', lower: '#5ab0ff', stripe: '#ff5db1' }, C, .24);
  // pink face below the visor with two big buck teeth
  ball(g, .1, pink, [C.x, C.y - .1, C.z + .14], [1, .8, 1], 16);
  for (const s of [-1, 1]) mesh(g, new THREE.BoxGeometry(.035, .045, .015), M('#ffffff', { roughness: .3 }), [C.x + s * .02, C.y - .15, C.z + .24]);
  // two curly antennae out of the top, with balls on the ends
  for (const s of [-1, 1]) {
    const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16, a = t * Math.PI * 3; pts.push(V(C.x + s * (.08 + t * .06 + Math.cos(a) * .03 * t), C.y + .2 + t * .26, C.z - .02 + Math.sin(a) * .03 * t)); }
    curve(pts, .012, pink, g); ball(g, .04, blue, pts[pts.length - 1].toArray(), [1, 1, 1], 12);
  }
  return g;
}
function robFace() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160; const x = cv.getContext('2d');
  x.fillStyle = '#0c1018'; x.beginPath(); x.roundRect(0, 0, 256, 160, 36); x.fill();
  x.strokeStyle = '#7af8ff'; x.lineWidth = 16; x.lineCap = 'round';
  for (const cx of [78, 178]) { x.beginPath(); x.arc(cx, 82, 24, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); }   // happy closed-arc eyes
  x.beginPath(); x.arc(128, 104, 30, Math.PI * .15, Math.PI * .85); x.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function buildRob() {
  const g = new THREE.Group(), cyan = M('#3ad8e8', { roughness: .3, metalness: .2 }), dark = M('#2a3040', { roughness: .4, metalness: .4 }), C = V(0, .82, -.32);
  // round body with a glowing orange battery window
  ball(g, .2, cyan, [0, .44, -.33], [1, 1.05, .95], 24);
  mesh(g, new THREE.BoxGeometry(.13, .09, .02), M('#ffa23a', { emissive: '#ff7a00', emissiveIntensity: .8 }), [0, .46, -.14]);
  for (let k = 0; k < 3; k++) mesh(g, new THREE.BoxGeometry(.025, .06, .022), M('#ffe14a', { emissive: '#ffc800', emissiveIntensity: .6 }), [-.04 + k * .04, .46, -.128]);
  limb(g, V(0, .58, -.33), V(0, .66, -.33), .05, dark);
  // round head with a black screen face showing smiling eyes
  ball(g, .2, cyan, C.toArray(), [1.1, 1, 1], 24);
  mesh(g, new THREE.PlaneGeometry(.3, .19), new THREE.MeshStandardMaterial({ map: robFace(), roughness: .2 }), [C.x, C.y, C.z + .205]);
  for (const s of [-1, 1]) mesh(g, new THREE.CylinderGeometry(.045, .045, .04, 16), dark, [C.x + s * .22, C.y, C.z], [0, 0, Math.PI / 2]);
  // antenna with a red heart
  limb(g, V(C.x, C.y + .19, C.z), V(C.x, C.y + .33, C.z), .012, dark);
  const red = M('#ff3a5a', { roughness: .3 }); ball(g, .03, red, [C.x - .02, C.y + .37, C.z]); ball(g, .03, red, [C.x + .02, C.y + .37, C.z]);
  mesh(g, new THREE.ConeGeometry(.042, .05, 12), red, [C.x, C.y + .335, C.z], [Math.PI, 0, 0]);
  // jointed arms to the wheel, little legs to the pedals
  for (const s of [-1, 1]) {
    const sh = V(s * .2, .52, -.33), el = V(s * .26, .44, -.08), ha = V(s * .13, .45, .19);
    ball(g, .05, dark, sh.toArray()); limb(g, sh, el, .035, cyan); ball(g, .04, dark, el.toArray()); limb(g, el, ha, .032, cyan);
    ball(g, .05, dark, ha.toArray(), [1, .8, 1.1], 12);
    const hip = V(s * .09, .3, -.25), kn = V(s * .12, .32, .06), ft = V(s * .1, .21, .45);
    limb(g, hip, kn, .045, dark); limb(g, kn, ft, .04, cyan); ball(g, .06, dark, [s * .1, .2, .5], [1, .7, 1.4], 12);
  }
  return g;
}
export const BUILDERS = { stella: buildStella, pix: buildPix, gummy: buildGummy, rob: buildRob };
