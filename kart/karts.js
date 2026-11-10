/* =====================================================================================================
   FOXKARTS · the garage's three chassis (v140)
   ─────────────────────────────────────────────────────────────────────────────────────────────────────
   GUMMY KART  'classic'  the old-school go-kart — the Meshy model (kart-default.glb, see kart-skin.js)
   ROB KART    'hover'    an anti-gravity kart: four fat hover pods, no wheels on the ground
   PIX KART    'flyer'    a futuristic flying car: pointed nose, swept tail fins, four ducted-fan turbines

   The two built here match the Meshy kart's space exactly, so the rest of the game needs no special case:
     faces +Z · Y up · floor y = 0 · about 1.35 m wide and 2.1 m long
   Each one is a Group with a .nodes map the same shape as the loaded GLB's:
     Body · WheelFrontLeft / WheelFrontRight / WheelRearLeft / WheelRearRight (a group at the hub whose
     only child 'Spin' turns about X) · SteeringWheel (children[0] is the disc; its geometry is already
     tilted, so the game turns it about .steerAxis) · Seat (the driver's hip point) · LogoAnchor.
   No additive blending and nothing see-through: the lights are solid emissive, the logo plate is an
   alphaTest cut-out (the user's phone draws blended "glow" as an opaque slab).
   ===================================================================================================== */
import * as THREE from './lib/three.module.min.js';
import { DEFAULT_SKIN, logoPlate } from './kart-skin.js?v=18';

export const KART_MODELS = [
  { id: 'classic', name: 'Gummy Kart', sub: 'Classic old-school kart', cost: 0, stat: 'All-rounder' },
  { id: 'hover', name: 'Rob Kart', sub: 'Hovering anti-gravity kart', cost: 300, stat: 'Glides through bends' },
  { id: 'flyer', name: 'Pix Kart', sub: 'Futuristic flying car', cost: 300, stat: 'Jet-turbine wheels' },
];

/* ---------- paint ---------- */
const matCache = new Map();
function paintOf(skin) {
  const s = { ...DEFAULT_SKIN, ...(skin || {}) }, key = s.body + '|' + s.light;
  if (matCache.has(key)) return matCache.get(key);
  const C = (c) => new THREE.Color(c);
  const body = C(s.body), deep = body.clone().multiplyScalar(.6), pale = body.clone().lerp(C('#ffffff'), .3);
  const P = {
    paint: new THREE.MeshStandardMaterial({ color: body, roughness: .34, metalness: .22 }),
    paintD: new THREE.MeshStandardMaterial({ color: deep, roughness: .42, metalness: .2 }),
    paintL: new THREE.MeshStandardMaterial({ color: pale, roughness: .3, metalness: .25 }),
    dark: new THREE.MeshStandardMaterial({ color: '#272b36', roughness: .72, metalness: .1 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#1c1f27', roughness: .9 }),
    metal: new THREE.MeshStandardMaterial({ color: '#9aa4b4', roughness: .3, metalness: .75 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#d8e0ec', roughness: .18, metalness: .9 }),
    glass: new THREE.MeshStandardMaterial({ color: '#2b3550', roughness: .14, metalness: .55 }),
    light: new THREE.MeshStandardMaterial({ color: s.light, emissive: new THREE.Color(s.light), emissiveIntensity: .95, roughness: .35 }),
    lightW: new THREE.MeshStandardMaterial({ color: '#fff6e0', emissive: new THREE.Color('#fff2d2'), emissiveIntensity: .9, roughness: .35 }),
  };
  matCache.set(key, P); return P;
}

/* ---------- geometry (built once, shared by every kart) ---------- */
const G = {};
const geo = (key, make) => G[key] || (G[key] = make());
const ball = (k, w = 14, h = 10) => geo('b' + k, () => new THREE.SphereGeometry(1, w, h));
const box = (k) => geo('x' + k, () => new THREE.BoxGeometry(1, 1, 1));
const tube = (k, seg = 14) => geo('c' + seg, () => new THREE.CylinderGeometry(1, 1, 1, seg));
function mk(parent, g, m, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  const o = new THREE.Mesh(g, m); o.position.set(...p); o.rotation.set(...r); o.scale.set(...s); o.castShadow = true; parent.add(o); return o;
}

/* ---------- the parts every chassis shares ---------- */
// a kart steering wheel: the geometry is tilted back 0.9 rad, so the game turns the mesh about STEER_AXIS
export const STEER_AXIS = new THREE.Vector3(0, Math.sin(.9), Math.cos(.9));
function steeringWheel(P) {
  const rim = geo('swRim', () => new THREE.TorusGeometry(.17, .028, 6, 18).rotateX(-.9));
  const spk = geo('swSpk', () => { const g = new THREE.BoxGeometry(.28, .022, .055); return g.rotateX(-.9); });
  const hub = geo('swHub', () => new THREE.CylinderGeometry(.05, .05, .035, 12).rotateX(Math.PI / 2 - .9));
  const g = new THREE.Group(); g.name = 'SteeringWheelMesh';
  mk(g, rim, P.dark); mk(g, spk, P.metal); mk(g, spk, P.metal, [0, 0, 0], [0, 0, 1.05]); mk(g, spk, P.metal, [0, 0, 0], [0, 0, -1.05]);
  mk(g, hub, P.light);
  return g;
}
// a bucket seat sitting at (0, y, z)
function seatShell(parent, P, y, z, w = .3) {
  mk(parent, box(1), P.dark, [0, y - .02, z], [-.06, 0, 0], [w * 2, .07, .46]);
  mk(parent, box(1), P.dark, [0, y + .21, z - .25], [.17, 0, 0], [w * 2, .46, .08]);
  mk(parent, box(1), P.paintD, [w, y + .11, z], [0, 0, -.1], [.07, .26, .4]);
  mk(parent, box(1), P.paintD, [-w, y + .11, z], [0, 0, .1], [.07, .26, .4]);
}
function anchor(parent, name, p, ry = 0, rx = 0, s = 1) {
  const o = new THREE.Object3D(); o.name = name; o.position.set(...p); o.rotation.set(rx, ry, 0); o.scale.setScalar(s); parent.add(o); return o;
}
function wheelNode(parent, name, p) {
  const g = new THREE.Group(); g.name = name; g.position.set(...p); parent.add(g);
  const spin = new THREE.Group(); spin.name = 'Spin'; g.add(spin);
  return { node: g, spin };
}

/* =====================================================================================================
   ROB KART — the hovering kart
   A smooth pebble hull riding on four fat anti-gravity discs. The discs float a hand's width off the road
   with a solid ring of light under each; nothing turns, so the 'Spin' groups stay empty (the front pair
   still steers). A thin rod with Rob's ball sits behind the seat.
   ===================================================================================================== */
function buildHover(skin) {
  const P = paintOf(skin), root = new THREE.Group(); root.name = 'Kart';
  const B = new THREE.Group(); B.name = 'Body'; root.add(B);
  // a flat pebble deck over a rounded belly (the belly closes the craft around the driver's feet)
  mk(B, ball(1), P.dark, [0, .17, 0], [0, 0, 0], [.44, .19, .84]);
  mk(B, ball(1), P.paint, [0, .36, -.04], [0, 0, 0], [.48, .16, .90]);
  mk(B, ball(1), P.paintL, [0, .48, -.12], [0, 0, 0], [.34, .08, .52]);
  mk(B, ball(1), P.paintD, [0, .34, .62], [0, 0, 0], [.40, .12, .36]);
  // front bumper and the light bar
  mk(B, geo('hvBump', () => new THREE.CapsuleGeometry(.09, .62, 4, 10).rotateZ(Math.PI / 2)), P.paintD, [0, .30, .80]);
  mk(B, box(1), P.lightW, [0, .38, .83], [0, 0, 0], [.48, .07, .07]);
  // tail lights, side strips and intake vents
  for (const s of [1, -1]) {
    mk(B, box(1), P.light, [s * .28, .42, -.86], [0, 0, 0], [.16, .07, .06]);
    mk(B, box(1), P.light, [s * .45, .32, .02], [0, 0, 0], [.04, .05, .82]);
    mk(B, box(1), P.metal, [s * .32, .48, -.5], [0, 0, s * .2], [.12, .06, .3]);
  }
  // rear deck, engine dome and the ball antenna
  mk(B, box(1), P.paintD, [0, .44, -.74], [0, 0, 0], [.54, .24, .28]);
  mk(B, ball(1, 12, 8), P.metal, [0, .53, -.76], [0, 0, 0], [.2, .1, .13]);
  mk(B, tube(1, 8), P.chrome, [0, .78, -.64], [0, 0, 0], [.013, .34, .013]);
  mk(B, ball(1, 12, 9), P.light, [0, .97, -.64], [0, 0, 0], [.062, .062, .062]);
  seatShell(B, P, .46, -.44, .26);
  // the four hover pods: a fat painted ring with a chrome hub and a solid ring of light underneath
  const pod = geo('hvPod', () => new THREE.TorusGeometry(.175, .105, 8, 16).rotateX(-Math.PI / 2));
  const hubG = geo('hvHub', () => new THREE.SphereGeometry(1, 12, 8));
  const ring = geo('hvRing', () => new THREE.TorusGeometry(.125, .035, 6, 14).rotateX(-Math.PI / 2));
  const arm = geo('hvArm', () => new THREE.BoxGeometry(.3, .09, .16));
  const nodes = { Body: B };
  for (const [name, x, z] of [['WheelFrontLeft', .55, .62], ['WheelFrontRight', -.55, .62], ['WheelRearLeft', .53, -.64], ['WheelRearRight', -.53, -.64]]) {
    const { node } = wheelNode(root, name, [x, .27, z]);
    mk(node, pod, P.dark);
    mk(node, geo('hvBand', () => new THREE.TorusGeometry(.175, .045, 6, 16).rotateX(-Math.PI / 2)), P.chrome, [0, .055, 0]);
    mk(node, hubG, P.paintL, [0, .03, 0], [0, 0, 0], [.12, .07, .12]);
    mk(node, ring, P.light, [0, -.085, 0]);
    nodes[name] = node;
    mk(B, arm, P.metal, [x * .72, .27, z * .92]);
  }
  const sw = new THREE.Group(); sw.name = 'SteeringWheel'; sw.position.set(0, .77, .17); sw.add(steeringWheel(P)); root.add(sw);
  nodes.SteeringWheel = sw; nodes.Seat = anchor(root, 'Seat', [0, .50, -.44]);
  nodes.LogoAnchor = anchor(root, 'LogoAnchor', [0, .46, .74], 0, 0, .3);
  return finish(root, nodes, skin);
}

/* =====================================================================================================
   PIX KART — the futuristic flying car
   A wide swoopy fuselage with a pointed nose, a windscreen over the cockpit, two swept delta wings at the
   back, two thrusters and four ducted-fan turbines in place of wheels. The fans sit on the road and spin.
   ===================================================================================================== */
function buildFlyer(skin) {
  const P = paintOf(skin), root = new THREE.Group(); root.name = 'Kart';
  const B = new THREE.Group(); B.name = 'Body'; root.add(B);
  // fuselage, bonnet and the long pointed nose
  mk(B, ball(1), P.paint, [0, .40, -.04], [0, 0, 0], [.40, .20, .84]);
  mk(B, ball(1), P.paint, [0, .35, .62], [0, 0, 0], [.32, .13, .46]);
  mk(B, geo('flNose', () => new THREE.ConeGeometry(1, 1, 12).rotateX(Math.PI / 2)), P.paint, [0, .33, .92], [0, 0, 0], [.24, .1, .32]);
  mk(B, ball(1), P.paintL, [0, .48, .30], [0, 0, 0], [.22, .09, .44]);
  mk(B, box(1), P.paintD, [0, .15, .04], [0, 0, 0], [.72, .38, 1.5]);
  mk(B, box(1), P.dark, [0, .04, .04], [0, 0, 0], [.74, .14, 1.46]);
  mk(B, box(1), P.paintD, [0, .27, .98], [0, 0, 0], [.52, .05, .22]);
  // cockpit tub with a windscreen
  mk(B, box(1), P.dark, [0, .45, -.08], [0, 0, 0], [.44, .12, .5]);
  mk(B, box(1), P.glass, [0, .57, .16], [-.5, 0, 0], [.34, .22, .03]);
  for (const s of [1, -1]) mk(B, box(1), P.paintD, [s * .27, .50, -.2], [0, 0, s * .1], [.11, .22, .56]);
  // side pods joining the turbines, with a light strip along each
  for (const s of [1, -1]) {
    mk(B, box(1), P.paintD, [s * .46, .33, -.04], [0, 0, 0], [.17, .18, 1.1]);
    mk(B, box(1), P.light, [s * .555, .35, -.04], [0, 0, 0], [.03, .07, .92]);
  }
  mk(B, box(1), P.lightW, [.18, .36, 1.03], [0, -.25, 0], [.16, .05, .06]);
  mk(B, box(1), P.lightW, [-.18, .36, 1.03], [0, .25, 0], [.16, .05, .06]);
  // the two swept delta wings
  const wing = geo('flWing', () => {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(.44, .04); sh.lineTo(.27, .5); sh.lineTo(.03, .38); sh.closePath();
    return new THREE.ExtrudeGeometry(sh, { depth: .045, bevelEnabled: false }).translate(0, 0, -.0225).rotateY(Math.PI / 2);
  });
  const tip = geo('flTip', () => new THREE.BoxGeometry(.055, .05, .26));
  for (const s of [1, -1]) {
    const g = new THREE.Group(); g.position.set(s * .29, .44, -.52); g.rotation.set(.26, 0, -s * .34); B.add(g);
    mk(g, wing, P.paint); mk(g, tip, P.light, [0, .48, -.2]);
  }
  // tail: deck, two thrusters with a solid glowing core
  mk(B, box(1), P.paintD, [0, .46, -.78], [0, 0, 0], [.54, .22, .3]);
  const thr = geo('flThr', () => new THREE.CylinderGeometry(.11, .13, .24, 12).rotateX(Math.PI / 2));
  const core = geo('flCore', () => new THREE.CylinderGeometry(.085, .085, .03, 12).rotateX(Math.PI / 2));
  for (const s of [1, -1]) { mk(B, thr, P.dark, [s * .2, .45, -.92]); mk(B, core, P.light, [s * .2, .45, -1.0]); }
  seatShell(B, P, .42, -.34, .24);
  // four ducted-fan turbines
  const duct = geo('flDuct', () => new THREE.TorusGeometry(.215, .055, 7, 16).rotateY(Math.PI / 2));
  const tread = geo('flTread', () => new THREE.CylinderGeometry(.26, .26, .16, 16).rotateZ(Math.PI / 2));
  const hub = geo('flHub', () => new THREE.CylinderGeometry(.075, .075, .2, 10).rotateZ(Math.PI / 2));
  const blade = geo('flBlade', () => new THREE.BoxGeometry(.06, .33, .05));
  const nodes = { Body: B };
  for (const [name, x, z] of [['WheelFrontLeft', .63, .54], ['WheelFrontRight', -.63, .54], ['WheelRearLeft', .61, -.62], ['WheelRearRight', -.61, -.62]]) {
    const { node, spin } = wheelNode(root, name, [x, .26, z]);
    mk(node, tread, P.rubber); mk(node, duct, P.metal, [Math.sign(x) * .06, 0, 0]);
    mk(spin, hub, P.chrome);
    for (let i = 0; i < 5; i++) mk(spin, blade, P.paintL, [Math.sign(x) * .05, 0, 0], [i / 5 * Math.PI * 2, 0, 0]);
    nodes[name] = node;
  }
  const sw = new THREE.Group(); sw.name = 'SteeringWheel'; sw.position.set(0, .71, .22); sw.add(steeringWheel(P)); root.add(sw);
  nodes.SteeringWheel = sw; nodes.Seat = anchor(root, 'Seat', [0, .46, -.34]);
  nodes.LogoAnchor = anchor(root, 'LogoAnchor', [0, .54, .34], 0, -1.2, .26);
  return finish(root, nodes, skin);
}

// the LED logo plate, then hand the kart back with its node map
function finish(root, nodes, skin) {
  const s = { ...DEFAULT_SKIN, ...(skin || {}) };
  nodes.LogoAnchor.add(logoPlate(THREE, s.logo, s.logoColor, s.body));
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  root.nodes = nodes; return root;
}

const BUILD = { hover: buildHover, flyer: buildFlyer };
export const isProcKart = (id) => !!BUILD[id];
// a finished chassis in a given look (nothing is cached: a kart is only a few dozen small meshes)
export function buildKartModel(id, skin) { return (BUILD[id] || buildHover)(skin); }

/* ---------- the garage buttons: a drawn side view of each kart ---------- */
export function kartIconURL(id, body = '#7a28dc', light = '#ffa424') {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  x.fillStyle = '#1b1440'; x.fillRect(0, 0, S, S);
  const wheel = (cx, cy, r, ring) => {
    x.fillStyle = '#20242e'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
    x.fillStyle = ring ? light : '#aab2c0'; x.beginPath(); x.arc(cx, cy, r * .5, 0, 7); x.fill();
  };
  x.lineJoin = x.lineCap = 'round';
  if (id === 'hover') {
    x.fillStyle = body; x.beginPath(); x.ellipse(64, 70, 44, 16, 0, 0, 7); x.fill();
    x.beginPath(); x.ellipse(60, 58, 25, 10, 0, 0, 7); x.fill();
    x.strokeStyle = '#d8e0ec'; x.lineWidth = 3; x.beginPath(); x.moveTo(42, 56); x.lineTo(38, 34); x.stroke();
    x.fillStyle = light; x.beginPath(); x.arc(38, 30, 7, 0, 7); x.fill();
    x.fillRect(102, 64, 10, 6);
    wheel(30, 80, 17, true); wheel(98, 80, 17, true);
  } else if (id === 'flyer') {
    wheel(36, 86, 16, false); wheel(96, 86, 16, false);
    x.fillStyle = body; x.beginPath(); x.moveTo(14, 78); x.lineTo(118, 70); x.lineTo(112, 52); x.lineTo(74, 44); x.lineTo(44, 50); x.lineTo(16, 66); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(90, 48); x.lineTo(118, 18); x.lineTo(124, 30); x.lineTo(104, 52); x.closePath(); x.fill();
    x.fillStyle = '#2b3550'; x.beginPath(); x.moveTo(52, 52); x.lineTo(76, 47); x.lineTo(78, 58); x.lineTo(54, 60); x.closePath(); x.fill();
    x.fillStyle = light; x.fillRect(16, 66, 10, 6); x.fillRect(104, 62, 14, 5);
  } else {
    wheel(34, 86, 16, false); wheel(96, 86, 18, false);
    x.fillStyle = body; x.fillRect(22, 68, 86, 14);
    x.beginPath(); x.moveTo(60, 70); x.lineTo(96, 70); x.lineTo(92, 46); x.lineTo(64, 48); x.closePath(); x.fill();
    x.strokeStyle = '#d8e0ec'; x.lineWidth = 4; x.beginPath(); x.moveTo(56, 70); x.lineTo(46, 50); x.stroke();
    x.beginPath(); x.arc(42, 46, 9, 0, 7); x.stroke();
    x.fillStyle = light; x.fillRect(20, 62, 12, 6);
  }
  return c.toDataURL();
}
