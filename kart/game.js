/* =====================================================================================================
   FOXKARTS 3D · ALPINE CUP
   A 3D cartoon kart race for kids (6–12) that teaches English. three.js for the world, HTML for every menu.
   The racers are the Foxino and go-kart models from models.js (built from shapes in code, then "baked"
   into a few light meshes so five of them run smoothly on a phone).

   Sections:
     1. CHARACTERS · GARAGE SHOP · TUNING   ← edit these freely (the English questions are in learn.js)
     2. Save, sound, little HTML helpers
     3. Renderer, lights, sky
     4. Baking the models: recolouring, merging, stickers, the seated pose
     5. The Alpine track: road, kerbs, snowbanks, ice, ? boxes, trees, chalets, snowmen, mountains
     6. Screens: menu, garage, flash-card quizzes
     7. The race: driving, AI, laps, ? box questions, power-ups, snowballs, finish, results
   ===================================================================================================== */
import * as THREE from './lib/three.module.min.js';
import { RoomEnvironment } from './lib/RoomEnvironment.js?v=2';
import { buildFoxino, buildKart, buildHelmet, setDetail } from './models.js?v=52';
import * as L from './learn.js?v=52';
import { carbonMat, loadDefaultKart, dressKart, loadHelmet, dressHelmet, DEFAULT_SKIN, DEFAULT_HELMET, BODY_COLORS, LIGHT_COLORS, LOGOS, logoIconURL, logoCanvas, isInk, inkFromCanvas, inkLayer, WHEEL_SIZE, makeMetal, metalOf, swatchCSS } from './kart-skin.js?v=22';
import { buildRearWing, REAR_WINGS } from './rear-wings.js?v=1';   // (v270) the nine rear wings for the garage start
import { GLTFLoader } from './lib/GLTFLoader.js?v=2';
import { mergeGeometries } from './lib/BufferGeometryUtils.js?v=2';
import { BUILDERS } from './racers.js?v=2';
import { bakeSeatedDriver, rivalSuit, helmetPaint, DRIVER_POSE } from './rival-driver.js?v=4';   // (2026-11-13) the AI rivals drive as the Tripo racing driver

/* ---------- CHARACTERS: the 5 racers. Foxino is the Higgsfield 3D model; the other four are built in racers.js.
   `color` is their kart and name-tag colour; `hue` is only used if a model can't be built (then a recoloured Foxino drives). ---------- */
const CHARACTERS = [
  // each racer drives a little differently (small differences, so every racer can win): top speed, acceleration, steering, weight
  { id: 'foxino', name: 'Foxino', color: 0xff8a1e, hue: 0,    spd: 1,    acc: 1,    turn: 1,    heavy: 1,   tag: 'all-rounder' },
  { id: 'stella', name: 'Stella', color: 0x3c8cf0, hue: -.15, spd: 1.03, acc: .94,  turn: .97,  heavy: 1,   tag: 'top speed', sticker: 'star' },
  { id: 'pix',    name: 'Pix',    color: 0x4fc84a, hue: -.4,  spd: .985, acc: 1,    turn: 1.1,  heavy: 1,   tag: 'best handling', sticker: 'bolt' },
  { id: 'gummy',  name: 'Gummy',  color: 0xff5db1, hue: .17,  spd: .985, acc: 1.15, turn: 1.02, heavy: .9, tag: 'quick start', sticker: 'heart' },
  { id: 'rob',    name: 'Rob',    color: 0x2ac8c0, hue: .38,  spd: 1.015, acc: .92, turn: .95,  heavy: 1.4, tag: 'heavy: pushes others', sticker: 'stripes' },
];

/* ---------- GARAGE SHOP ---------- */
const KART_COLORS = [
  { name: 'Grey',   color: 0x9aa3b0, cost: 0 },  { name: 'Red',    color: 0xff0000, cost: 50 },   // (v281: pure red)
  { name: 'Orange', color: 0xff8a1e, cost: 50 }, { name: 'Yellow', color: 0xffd23a, cost: 50 },
  { name: 'Green',  color: 0x4fc84a, cost: 50 }, { name: 'Teal',   color: 0x2ac8c0, cost: 50 },
  { name: 'Blue',   color: 0x3c8cf0, cost: 50 }, { name: 'Purple', color: 0x8a5ae8, cost: 50 },
  { name: 'Pink',   color: 0xff6ab0, cost: 50 }, { name: 'Black',  color: 0x2a2e38, cost: 80 },
  { name: 'White',  color: 0xf4f6fa, cost: 80 }, { name: 'Gold',   color: 0xffc83a, cost: 200 },
];
const STICKERS = [
  { id: 'none', name: 'None', cost: 0 },     { id: 'stripes', name: 'Stripes', cost: 60 },
  { id: 'star', name: 'Star', cost: 60 },     { id: 'heart', name: 'Heart', cost: 60 },
  { id: 'flame', name: 'Flames', cost: 90 },  { id: 'bolt', name: 'Bolt', cost: 90 },
  { id: 'snow', name: 'Snowflake', cost: 90 },
];
const UPGRADE_COST = [120, 220, 350, 520];   // (the old per-part prices; v266: one upgrade, see LEVEL_COST)
const LEVEL_COST = (lv) => 120 + 16 * lv;   // (v266) the price of the next level when you are at lv (0..23): 120 … 488, 7 296 in all
// (v104) the garage upgrades: id, name, colour, what it does
const UPGRADES = [['speed', 'SPEED', '#ff8a1e', 'Higher top speed'], ['handling', 'HANDLING', '#4fc84a', 'Sharper steering'], ['accel', 'START', '#ff5db1', 'Quicker acceleration'], ['turbo', 'TURBO', '#5fe8ff', 'Longer drift turbos'], ['grip', 'GRIP', '#b77aff', 'Shorter spins on hazards'], ['magnet', 'MAGNET', '#ffd23a', 'Coins from further away']];

/* ---------- TUNING (metres and seconds) ---------- */
const TUNE = {
  laps: 6,                // (v183, the user: 6 rounds by default; was 5)
  baseSpeed: 26,           // player's top speed (m/s) with no upgrades: about 95 km/h, arcade fast
  aiSkill: [1.05, 1.07, 1.08, 1.1], // AI top speed × this (slightly faster than the player without power-ups, drifts or coins)
  speedPerLevel: .025,     // +2.5% top speed per speed upgrade
  handlingPerLevel: .12,   // +12% steering per handling upgrade (and shorter ice spins)
  accel: 20, turn: 2.8,
  // drifting: turn the wheel hard at speed → hop into a drift; sparks go blue → orange → purple; straighten up → mini-turbo
  driftAfter: [.55, 1.25, 2.0], turboTime: [0, .7, 1.1, 1.6], turboMul: 1.4,
  padTime: .9, padMul: 1.45,          // the glowing boost pads on the road
  boxQuestions: false,                // v60: ? boxes just give a power-up; the questions are on the jumps, the lap line and the finish
  coinSpeed: .01, maxCoins: 10,       // each coin picked up on the track: +1% top speed (up to 10), and +1 coin to keep
  coinsForPlace: [100, 70, 50, 30, 20],
  // energy: off since v41 (the user asked). true brings back the ⚡ cost per race, the pill and the ⚡ flash cards.
  energy: false, maxEnergy: 3, quizCoins: 5, energyQuizCount: 5,
  // (v151) the pit stop
  pitEvery: 3,             // a stop is due on every 3rd lap (unless pitLaps says which)
  pitLaps: [2, 4],         // (v183, the user) the pit stops are on the 2nd and the 4th round
  pitSecs: 5,              // the pit questions are swift (a Starter gets two seconds more)
  pitSpeed: .025,          // +2.5% top speed per right SPEED answer
  pitFix: .09,             // +9% steering per right MAINTENANCE answer
  pitWorn: .93,            // worn tyres: a little slower from the moment a stop is due until you take it
  maxImmune: 3,            // puddle shields a racer can hold (the user: "max 3 per racer")
  // (v269) the question sets, here so the debug hub can change them: garage start 3 sets of garageN, a pit stop 3 sets
  // of pitN (each pitSecs), the finish line finN questions of finSecs (a Starter gets 2 / 3 seconds more)
  garageN: 3, pitN: 3, finN: 3, finSecs: 6,
  finQuiz: false,   // (v302, the user: "remove the questions after crossing the finish line, whoever crosses the line first wins"; true brings them back)
  garageOff: true,   // (v302, the user: no Garage button for now while testing; the garage itself is all still here)   // (v270, the user: the garage start is 3 × 3 = 9 questions, one per rear wing)
  // (v287, the user: "make the steering in the air less sensitive") in the air (a jump off a ramp or a fall) the kart
  // turned as fast as on the road, with no grip and no assist, so it landed crooked or in the wall: now 40 % of it.
  // The little hop that starts a drift is not affected.
  airSteer: 1,   // (v292, the user: "let that you can steer normally during the airtime") back to full
};
const LAPS0 = TUNE.laps, PIT_EVERY0 = TUNE.pitEvery, PIT_LAPS0 = TUNE.pitLaps;
const STEP = .6;   // the spacing of the track's centre-line points (the road's half-width HALF is set per track)

/* ---------- 2. Save, sound, helpers ---------- */
const SAVE_KEY = 'foxino-kart-v1';
const DEFAULT_SAVE = { coins: 100, energy: 3, char: 'foxino', races: 0, wins: 0,
  kart: { color: 0x9aa3b0, colorsOwned: [0x9aa3b0], sticker: 'none', stickersOwned: ['none'], speed: 0, handling: 0,
    skin: { body: '#7a28dc', light: '#ffa424', logo: 'fox', logoColor: '#ffa424' }, bodiesOwned: ['#7a28dc'], lightsOwned: ['#ffa424'], logosOwned: ['fox', 'none'] } };
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') || {};
    return Object.assign(JSON.parse(JSON.stringify(DEFAULT_SAVE)), s, { kart: Object.assign({}, DEFAULT_SAVE.kart, s.kart || {}) });
  } catch (e) { return JSON.parse(JSON.stringify(DEFAULT_SAVE)); }
}
let save = loadSave();
// (v301, the user: "make the default way to steer tapping the sides") TAP SIDES is the default steering, and every
// player is moved to it once (Settings > Controls still offers the joystick, the line, the arrows and tilt)
if (!save.tapSides301) { save.tapSides301 = 1; save.steerL = 'follow'; save.steerP = 'follow'; }
if (save.char !== 'foxino') save.char = 'foxino';   // only Foxino for now
// (v281, the user: "the red of the kart should be this" — pure #ff0000) the old Racing Red #e8403a became #ff0000; (v283,
// the user: "make the green, red and blue this metal style") the red, Royal Blue and Lime are now the brushed METAL paints
// (kart-skin.js METALS). A save that owns or wears an old one gets its metal (colours are saved by their code).
{ const K = save.kart || {}, MAP = { '#e8403a': '#df0707', '#ff0000': '#df0707', '#2a4ae8': '#1853a0', '#5ad04a': '#2b8e72' }, to = (c) => MAP[c] || c;
  if (K.skin && K.skin.body) K.skin.body = to(K.skin.body);
  if (K.ship && K.ship.body) K.ship.body = to(K.ship.body);
  if (Array.isArray(K.bodiesOwned)) K.bodiesOwned = [...new Set(K.bodiesOwned.map(to))];
  if (K.color === 0xe8403a) K.color = 0xff0000;
  if (Array.isArray(K.colorsOwned)) K.colorsOwned = [...new Set(K.colorsOwned.map((c) => (c === 0xe8403a ? 0xff0000 : c)))]; }
L.attach(save); L.setVoice(false);   // (v225, the user) no voice in the game any more
// the curriculum packages (shared with the other Fugio games); none chosen = the game's own mix
const PACKS = window.FugioPacks ? FugioPacks.sort(window.GUMMY_PACKAGES || []) : (window.GUMMY_PACKAGES || []);
save.packs = (save.packs || []).filter((id) => PACKS.some((p) => p.id === id));
L.setPacks(PACKS, save.packs);
L.onBeep(() => Snd.tone(988, .14, 'sine', .06));
const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
// (v240, the user) THE DEVELOPER'S ACCOUNT: the player named "Michal" is a dev account. On each device it gets, once,
// 5 000 coins and the kart back to the start (every upgrade 0 = kart level 1), and a DEV badge by the name.
// (Saves live in the browser, so this is by name; add more names to DEV_NAMES.)
const DEV_NAMES = ['michal'];
const isDevAcct = () => DEV_NAMES.includes((save.name || '').trim().toLowerCase());
function devAccount() {
  if (!isDevAcct() || save.devGift) return false;
  save.devGift = 1; save.coins = 5000; save.kart = save.kart || {}; for (const [k] of UPGRADES) save.kart[k] = 0; save.kart.lv = 0; store(); return true;
}
devAccount();
// (v244, the user: "give me 10000 coins") a one-off gift of 10 000 coins for the dev account, on every device it plays on
if (isDevAcct() && !save.gift10k) { save.gift10k = 1; save.coins = (save.coins || 0) + 10000; store(); setTimeout(() => { try { toast('+10 000 COINS!', '#ffe14a', 44); } catch (e) {} }, 2500); }
const charById = (id) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
const ord = (n) => n + (['st', 'nd', 'rd'][n - 1] || 'th');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const css = (c) => '#' + c.toString(16).padStart(6, '0');

// tiny sound effects made with the Web Audio API
const Snd = {
  ctx: null,
  init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  tone(f, d = .15, type = 'sine', vol = .08, slide = 0, delay = 0) {
    const a = this.ctx; if (!a) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + .05);
  },
  // the kart's engine: a buzzy saw wave through a soft filter, its pitch follows the speed
  engine: null,
  engineOn() {
    const a = this.ctx; if (!a || this.engine) return;
    const o = a.createOscillator(), o2 = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain();
    o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 520; g.gain.value = 0;
    o.connect(f); o2.connect(f); f.connect(g).connect(a.destination); o.start(); o2.start();
    this.engine = { o, o2, g };
  },
  engineSet(v) { const e = this.engine; if (!e) return; const t = this.ctx.currentTime; e.o.frequency.setTargetAtTime(48 + v * 4.2, t, .08); e.o2.frequency.setTargetAtTime(24 + v * 2.1, t, .08); e.g.gain.setTargetAtTime(v > .5 ? .028 : .012, t, .2); },
  engineOff() { const e = this.engine; if (!e) return; this.engine = null; const t = this.ctx.currentTime; e.g.gain.setTargetAtTime(0, t, .1); e.o.stop(t + .5); e.o2.stop(t + .5); this.skid(0); },
  // the tyre squeal while drifting: looping noise through a band-pass filter; it rises as the turbo charges (level 0–3)
  sk: null,
  skid(level) {
    const a = this.ctx; if (!a) return;
    if (!this.sk && level) {
      const b = a.createBuffer(1, a.sampleRate, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); src.buffer = b; src.loop = true; f.type = 'bandpass'; f.Q.value = 6; g.gain.value = 0;
      src.connect(f).connect(g).connect(a.destination); src.start(); this.sk = { src, f, g };
    }
    if (!this.sk) return;
    const t = a.currentTime; this.sk.g.gain.setTargetAtTime(level ? .045 : 0, t, .06); this.sk.f.frequency.setTargetAtTime(900 + (level - 1) * 350, t, .1);
  },
};
const sfx = {
  click: () => Snd.tone(700, .06, 'square', .04),
  right: () => [523, 659, 784].forEach((f, i) => Snd.tone(f, .2, 'triangle', .08, 0, i * .07)),
  wrong: () => { Snd.tone(260, .25, 'sawtooth', .06, .7); },
  coin: () => { Snd.tone(1320, .08, 'square', .04); Snd.tone(1760, .12, 'square', .04, 0, .07); },
  beep: () => Snd.tone(440, .2, 'square', .06),
  go: () => Snd.tone(880, .4, 'square', .07),
  boost: () => Snd.tone(300, .6, 'sawtooth', .06, 3),
  spin: () => Snd.tone(600, .6, 'triangle', .07, .3),
  shield: () => Snd.tone(900, .3, 'sine', .08, 1.5),
  pop: () => Snd.tone(200, .2, 'square', .07, .5),
  rocket: () => Snd.tone(150, .7, 'sawtooth', .06, 4),
  boom: () => { Snd.tone(90, .5, 'sawtooth', .1, .4); },
  fanfare: () => [523, 659, 784, 1047, 1319].forEach((f, i) => Snd.tone(f, .3, 'triangle', .08, 0, i * .1)),
  power: () => [784, 988, 1175, 1568].forEach((f, i) => Snd.tone(f, .15, 'triangle', .06, 0, i * .05)),
  bump: () => Snd.tone(120, .12, 'square', .05, .6),
  hop: () => Snd.tone(520, .12, 'square', .04, 1.6),
  spark: (l) => [880, 1175, 1568].slice(0, l).forEach((f, i) => Snd.tone(f * (1 + l * .1), .08, 'triangle', .05, 0, i * .04)),
  turbo: (l) => { Snd.tone(220, .5 + l * .15, 'sawtooth', .06, 3.2); Snd.tone(660, .25, 'square', .03, 2); },
  pad: () => { Snd.tone(500, .3, 'sawtooth', .05, 2.4); Snd.tone(1000, .2, 'triangle', .04, 1.5, .05); },
  land: () => Snd.tone(110, .15, 'square', .06, .5),
  tick: () => Snd.tone(1400, .03, 'square', .025),
  trick: () => [660, 880, 1320].forEach((f, i) => Snd.tone(f, .1, 'square', .04, 0, i * .05)),
  fall: () => Snd.tone(700, 1.1, 'sine', .07, .15),
  rescue: () => [523, 784, 1047].forEach((f, i) => Snd.tone(f, .14, 'triangle', .06, 0, .2 + i * .08)),
};

// the race music: an original bouncy chiptune loop (8 bars, C – Am – F – G), made with the Web Audio API.
// It speeds up a little on the final lap.
// one tune per track: { melody (64 eighth notes, MIDI numbers, 0 = rest), bass roots per bar, tempo, lead sound }
const TUNES = [
  { mel: [76, 79, 84, 79, 76, 79, 81, 79, 76, 0, 72, 76, 81, 0, 79, 76, 77, 81, 84, 81, 77, 81, 84, 86, 86, 0, 83, 79, 74, 0, 79, 83,
    84, 0, 79, 76, 84, 0, 86, 88, 88, 86, 84, 81, 84, 0, 81, 79, 77, 79, 81, 84, 81, 79, 77, 81, 79, 83, 86, 83, 79, 0, 0, 0], bass: [48, 45, 41, 43, 48, 45, 41, 43], bpm: 150, lead: 'square' },
  { mel: [69, 0, 72, 0, 76, 74, 72, 0, 72, 0, 69, 72, 0, 77, 76, 74, 76, 0, 79, 0, 76, 74, 72, 74, 74, 0, 71, 74, 79, 0, 76, 74,
    81, 0, 79, 76, 0, 74, 76, 0, 77, 76, 74, 72, 0, 69, 72, 0, 72, 74, 76, 79, 76, 74, 72, 0, 71, 74, 79, 0, 74, 0, 0, 0], bass: [45, 41, 48, 43, 45, 41, 48, 43], bpm: 140, lead: 'sawtooth' },
  { mel: [74, 78, 81, 86, 81, 78, 74, 78, 71, 74, 78, 83, 78, 74, 71, 74, 67, 71, 74, 79, 74, 71, 67, 71, 69, 73, 76, 81, 76, 73, 69, 73,
    86, 0, 85, 0, 81, 0, 78, 0, 83, 0, 81, 0, 78, 0, 74, 0, 79, 81, 83, 86, 83, 81, 79, 0, 81, 0, 76, 0, 73, 0, 0, 0], bass: [38, 35, 43, 45, 38, 35, 43, 45], bpm: 132, lead: 'triangle' },
];
let TUNE_NOW = TUNES[0];
const Music = {
  timer: null, next: 0, step: 0, tempo: 1, noise: null,
  start() {
    const a = Snd.ctx; if (!a || this.timer || save.music === false) return;
    if (!this.noise) { const b = a.createBuffer(1, a.sampleRate * .2, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noise = b; }
    if (!this.bus) { this.bus = a.createGain(); this.bus.connect(a.destination); }
    this.next = a.currentTime + .08; this.timer = setInterval(() => this.tick(), 40);
  },
  stop() { clearInterval(this.timer); this.timer = null; },
  // quieter while a question is read aloud
  duck(on) { if (this.bus) this.bus.gain.setTargetAtTime(on ? .3 : 1, Snd.ctx.currentTime, .15); },
  tick() {
    const a = Snd.ctx, step = 60 / (TUNE_NOW.bpm * this.tempo) / 2;   // an eighth note
    while (this.next < a.currentTime + .16) { this.play(this.step, this.next, step); this.next += step; this.step = (this.step + 1) % 64; }
  },
  note(type, f, t, d, vol) {
    const a = Snd.ctx, o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(this.bus || a.destination); o.start(t); o.stop(t + d + .02);
  },
  hit(t, d, vol, hp) { const a = Snd.ctx, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = hp; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); s.connect(f).connect(g).connect(this.bus || a.destination); s.start(t); s.stop(t + d + .02); },
  play(i, t, d) {
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12), bar = Math.floor(i / 8), e = i % 8, root = TUNE_NOW.bass[bar], mel = TUNE_NOW.mel;
    if (mel[i]) this.note(TUNE_NOW.lead, hz(mel[i]), t, d * .9, TUNE_NOW.lead === 'triangle' ? .05 : TUNE_NOW.lead === 'sawtooth' ? .016 : .022);
    this.note('triangle', hz(root + (e % 2 ? 12 : 0)), t, d * .8, .07);
    if (e === 0 || e === 4) { const a = Snd.ctx, o = a.createOscillator(), g = a.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + .12); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .14); o.connect(g).connect(this.bus || a.destination); o.start(t); o.stop(t + .16); }
    if (e === 2 || e === 6) this.hit(t, .1, .06, 1500);
    if (e % 2) this.hit(t, .03, .025, 7000);
  },
};

// HTML helpers
const $ = (id) => document.getElementById(id);
const stage = $('stage');
let podT = null;   // (v278) the names and times under the three podium blocks
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const tap = (e, fn) => e.addEventListener('click', (ev) => { Snd.init(); if (Snd.ctx) L.setAudio(Snd.ctx); fn(ev); });
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
// one of the painted icons (kart/ui/icon-*.png, coin.png) inline in text: toasts, titles, buttons
const ico = (name, cls = 'ico') => `<img class="${cls}" src="ui/${name}.png?v=1" alt="">`;
/* (v209, the user: "a new font; figure out which messages matter and which don't; make tabs for them, so it feels like
   you've gained something") three kinds of message, sorted by what they say:
     GAIN  — something you got (coins, a stamp, a map, a power-up, a boost, a shield…): a reward tab slides in on the left
     EVENT — a moment of the race (final lap, finish, the pit, the formation lap, a secret path, rocks…): a big banner
     TIP   — a hint or news about a rival: a small quiet pill low on the screen, one at a time */
const GAIN_RX = /^(\+\d|NEW .*STAMP|NEW MAP|PASS LEVEL|GATES:|\+1 ENERGY|ENERGY IS FULL|ROCKET START|SUPER TURBO|FLAME RING|SHIELD SAVED|STRONG |WEAK |RESCUE DRONE|BOOST!|WARM-UP|.*\+\d+ COINS?)/;
const EVENT_RX = /(FINAL LAP|^LAP \d|FINISH|FORMATION LAP|PIT STOP|ROLL OUT|ON THE GRID|IN YOUR BOX|IN THE GARAGE|SECRET PATH|ROCKFALL|LOOK OUT|TO THE PITS|^GO!|NEW MAP!|^[A-Z ]+ PEAKS|^[A-Z ]+ ISLAND|^ROBO CITY|^GOLD MINES|^STAR LOOP)/;
const plain = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
function toastKind(s) { const t = plain(s.split('\n')[0]).toUpperCase(); if (GAIN_RX.test(t)) return 'gain'; if (EVENT_RX.test(t)) return 'event'; return 'tip'; }
function gainIcon(s) {
  const m = s.match(/<img[^>]*>/); if (m) return m[0];
  const t = plain(s).toUpperCase();
  return ico(/STAMP/.test(t) ? 'stamp-gold' : /MAP/.test(t) ? 'icon-flag' : /SHIELD|IMMUNE/.test(t) ? 'icon-shield' : /BOOST|TURBO|ROCKET/.test(t) ? 'icon-boost' : /COIN|\+\d/.test(t) ? 'coin' : 'icon-gift', 'gico');
}
function toast(s, color = '#fff', size = 30, kind) {
  if (race && race.ended && screen !== 'race') return;
  kind = kind || toastKind(s);
  const [head, ...more] = s.split('\n'), sub = more.join('<br>');
  // (v212, the user: "the pit stop, final lap… and the tabs top-left take so much space — make them small, at the top,
  // right under the leaderboard, on a background made in ChatGPT") events and gains are one small strip under the
  // leaderboard (at most two at a time); tips stay the quiet pill low on the screen
  if (kind === 'gain' || kind === 'event') {
    const box = $('msgs'); if (!box) return; box.classList.toggle('hi', !!(race && race.formation && screen === 'race'));   // (no leaderboard on the formation lap: the strip goes up into its place)
    const ic = kind === 'gain' ? gainIcon(s) : (head.match(/<img[^>]*>/) || [''])[0];
    const t = el('div', 'mstrip ' + kind, `${ic ? `<span class="mic">${ic}</span>` : ''}<span class="mtx"><b>${head.replace(/<img[^>]*>/g, '').trim()}</b>${sub ? `<small>${sub}</small>` : ''}</span>`);
    t.style.setProperty('--c', color === '#fff' ? (kind === 'gain' ? '#ffe14a' : '#ffffff') : color); box.prepend(t);
    while (box.children.length > 2) box.lastChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2300); return;
  }
  if (kind === 'gain-tab') {
    const box = $('gains'); if (!box) return;
    const t = el('div', 'gtab', `<span class="gic">${gainIcon(s)}</span><span class="gtx"><b>${head.replace(/<img[^>]*>/g, '').trim()}</b>${sub ? `<small>${sub}</small>` : ''}</span>`);
    t.style.setProperty('--c', color === '#fff' ? '#ffe14a' : color); box.prepend(t);
    while (box.children.length > 3) box.lastChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 350); }, 2400); return;
  }
  if (kind === 'tip') {
    const box = $('tips'); if (!box) return;
    box.innerHTML = ''; const t = el('div', 'ttip', `${head}${sub ? ` <small>${sub}</small>` : ''}`); box.appendChild(t);
    setTimeout(() => { if (t.isConnected) { t.classList.add('out'); setTimeout(() => t.remove(), 300); } }, 2300); return;
  }
  const t = el('div', 'toast ev', `<span>${head}</span>${sub ? `<small>${sub}</small>` : ''}`); t.style.color = color; t.style.fontSize = Math.round(size * .72) + 'px';
  $('toasts').appendChild(t); setTimeout(() => t.remove(), 1900);
}
const gapHTML = (s) => s.replace('___', '<span class="gap">&nbsp;</span>');
let GARAGE_VEH = 'kart';   // (v184) which vehicle the garage is showing and painting: 'kart' or 'ship'
function showOnly(id) {
 if (podT && id !== 'results') podT.hidden = true;  if (id !== 'garage' && GARAGE_VEH === 'ship') { GARAGE_VEH = 'kart'; if (SHOW.racer) setShowRacer(); }   // (v184) leaving the garage: the kart again
  for (const s of ['menu', 'garage', 'hud', 'results']) $(s).hidden = s !== id;
  if (id !== 'garage') { $('gspots').hidden = true; if ($('gveh')) $('gveh').hidden = true; }
  document.body.dataset.scr = id;
  setTimeout(resize, 0);   // the picture's size depends on the screen (phone mode draws the race above the pad)
  $('counters').hidden = $('ltop').hidden = !(id === 'menu' || id === 'garage');
  $('tabPlay').classList.toggle('on', id === 'menu'); $('garageBtn').classList.toggle('on', id === 'garage');
}
// DEV MODE (the settings): no questions anywhere and unlimited coins. Everything else plays normally.
const DEV = () => !!save.dev;
// (v269) THE DEBUG HUB (kart/debug.js): loaded only on a device where it is on (?debug turns it on and remembers it,
// ?debug=0 turns it off), so players never load it. QDEV = dev mode as the question code sees it: the hub can force one
// set of questions through dev mode (FK.forceQ) to jump straight to them.
const QDEV = () => DEV() && !(window.FK && window.FK.forceQ);
const DBG_KEY = 'foxkarts-debug';
const dbgOn = () => { try { return !!(JSON.parse(localStorage.getItem(DBG_KEY) || '{}') || {}).on; } catch (e) { return false; } };
{ const m = /[?&]debug(?:=([^&#]*))?(?=&|#|$)/.exec(location.search); if (m) { try { const d = JSON.parse(localStorage.getItem(DBG_KEY) || '{}') || {}; d.on = !/^(0|off|false|no)$/i.test(m[1] || ''); localStorage.setItem(DBG_KEY, JSON.stringify(d)); } catch (e) {} } }
// (v141, the user) HOW MANY QUESTIONS A ROUND: the slider on the track screen sets how many jumps a lap carry a
// question. (v151) Four a lap, always — the "questions a round" slider is gone.
// (v151) four jumps a lap, always — the "questions a round" slider is gone (the user asked for it to go),
// and the lap count went up to five, with a pit stop every third lap.
const JUMPS = 4;
const jumpCount = () => JUMPS;
// PHONE MODE (the settings): the game may be played with the phone upright (9:16). The layout follows the phone's real
// orientation: upright = the race in the top part and a joystick pad in the bottom part; sideways = as always.
const PORTRAIT_MQ = matchMedia('(orientation: portrait)');
// (v141, the user) the game plays BOTH ways round: upright gets the 9:16 layout, sideways the wide one.
// There is no "turn your phone sideways" screen and no orientation lock any more.
const isPortrait = () => PORTRAIT_MQ.matches;
function applyOrient() { document.body.classList.toggle('portrait', isPortrait()); if (typeof resize === 'function') resize(); }
PORTRAIT_MQ.addEventListener('change', applyOrient);
// the settings buttons, shared by the pause menu and the HELP card
const settingsHTML = () => `<div class="sets"><button class="btn small" id="mus" style="--c:var(--purple)"></button>${TOUCH ? '<button class="btn small" id="tilt" style="--c:var(--green)"></button>' : ''}${navigator.vibrate ? '<button class="btn small" id="buzz" style="--c:var(--purple)"></button>' : ''}<button class="btn small" id="res" style="--c:#5a6480"></button><button class="btn small" id="dev" style="--c:#5a6480"></button></div>`;
function wireSettings() {
  const ml = () => { $('mus').textContent = `MUSIC ${save.music === false ? 'OFF' : 'ON'}`; }; ml();
  tap($('mus'), () => { save.music = save.music === false; store(); ml(); });
  const tl = () => { if ($('tilt')) $('tilt').textContent = `TILT ${save.tilt ? 'ON' : 'OFF'}`; }; tl();
  if ($('tilt')) tap($('tilt'), async () => { if (!save.tilt) { const ok = await enableTilt(); if (!ok) { toast('Tilt is not available here', '#ffb0b8', 24); return; } } save.tilt = !save.tilt; store(); tl(); });
  if ($('buzz')) { const bl = () => { $('buzz').textContent = `BUZZ ${save.buzz === false ? 'OFF' : 'ON'}`; }; bl(); tap($('buzz'), () => { save.buzz = save.buzz === false; store(); bl(); buzz(40); }); }
  const rl = () => { const b = $('res'); b.textContent = `RESOLUTION ${save.res === 'high' ? 'HIGH' : 'DEFAULT'}`; b.style.setProperty('--c', save.res === 'high' ? 'var(--green)' : '#5a6480'); }; rl();
  tap($('res'), () => {
    save.res = save.res === 'high' ? 'default' : 'high'; store(); rl(); renderer.setPixelRatio(pixelRatioFor(+save.lowq || 0)); resize();
    toast(save.res === 'high' ? `RESOLUTION HIGH\n${renderer.getPixelRatio().toFixed(2)} device pixels per pixel` : 'RESOLUTION DEFAULT', '#ffe14a', 24);
  });
  const dl = () => { const b = $('dev'); b.textContent = `DEV MODE ${DEV() ? 'ON' : 'OFF'}`; b.style.setProperty('--c', DEV() ? 'var(--green)' : '#5a6480'); }; dl();
  tap($('dev'), () => {
    save.dev = !save.dev; store(); dl(); refreshCounters();
    toast(DEV() ? 'DEV MODE ON\nNo questions · unlimited coins' : 'DEV MODE OFF\nQuestions are back', DEV() ? '#4fc84a' : '#ffe14a', 26);
  });
}
// (v92) the settings panel: category tabs on the left, rows with a label, a line of help and a switch on the right;
// GRAPHICS has the LOW / DEFAULT / HIGH selector. It opens over the lobby or over the pause screen.
const STEER_ART = {
    tilt: '<svg viewBox="0 0 64 46"><g transform="rotate(-16 32 26)"><rect x="18" y="8" width="28" height="34" rx="5" fill="#2a2f66" stroke="#9fb4ff" stroke-width="2.4"/><rect x="21" y="12" width="22" height="24" rx="3" fill="#5a6ad0"/></g><path d="M12 14a24 16 0 0 1 40 0" fill="none" stroke="#ffd24a" stroke-width="3" stroke-linecap="round"/><path d="M50 9l4 6-7 1z" fill="#ffd24a"/></svg>',
    joy: '<svg viewBox="0 0 64 46"><rect x="6" y="5" width="52" height="36" rx="5" fill="#2a2f66" stroke="#9fb4ff" stroke-width="2.4"/><circle cx="18" cy="30" r="9" fill="#171b4a" stroke="#8ea4ff" stroke-width="2"/><circle cx="18" cy="30" r="4.6" fill="#ffd24a" stroke="#2a2460" stroke-width="1.6"/><circle cx="48" cy="30" r="6.5" fill="#ffd24a" stroke="#2a2460" stroke-width="1.6"/></svg>',
    follow: '<svg viewBox="0 0 64 46"><rect x="6" y="5" width="52" height="36" rx="5" fill="#2a2f66" stroke="#9fb4ff" stroke-width="2.4"/><rect x="8" y="7" width="23" height="32" rx="3" fill="#3a6ad8" opacity=".55"/><rect x="33" y="7" width="23" height="32" rx="3" fill="#ff8a1e" opacity=".55"/><path d="M24 23H13m5-6l-6 6 6 6" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 23h11m-5-6l6 6-6 6" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    line: '<svg viewBox="0 0 64 46"><rect x="6" y="5" width="52" height="36" rx="5" fill="#2a2f66" stroke="#9fb4ff" stroke-width="2.4"/><rect x="9" y="25" width="30" height="10" rx="5" fill="#171b4a" stroke="#8ea4ff" stroke-width="1.8"/><rect x="13" y="29" width="22" height="2.6" rx="1.3" fill="#6fd4ff"/><circle cx="24" cy="30" r="5" fill="#ffd24a" stroke="#2a2460" stroke-width="1.6"/><circle cx="50" cy="30" r="6" fill="#ffd24a" stroke="#2a2460" stroke-width="1.6"/></svg>',
  };
STEER_ART.arrows = '<svg viewBox="0 0 64 46"><rect x="6" y="5" width="52" height="36" rx="5" fill="#2a2f66" stroke="#9fb4ff" stroke-width="2.4"/><rect x="10" y="22" width="19" height="15" rx="4" fill="#ffd23a" stroke="#221a4e" stroke-width="1.6"/><rect x="35" y="22" width="19" height="15" rx="4" fill="#ffd23a" stroke="#221a4e" stroke-width="1.6"/><path d="M23 25l-7 4.5 7 4.5z" fill="#221a4e"/><path d="M41 25l7 4.5-7 4.5z" fill="#221a4e"/><rect x="26" y="9" width="12" height="8" rx="2" fill="#171b4a"/></svg>';
const STEER_NAME = { tilt: 'TURN DEVICE', joy: 'JOYSTICK', line: 'LINE', follow: 'TAP SIDES', arrows: 'ARROWS' };   // (v263: ARROWS = two buttons to tap)   // (v212: 'follow' is now TAP SIDES)
const SET_TABS = [['game', 'GAME'], ['controls', 'CONTROLS'], ['graphics', 'GRAPHICS'], ['audio', 'AUDIO']];
function openSettings(tab = 'game', onClose) {
  const S = $('setp'); S.hidden = false;
  const row = (k, title, help) => `<div class="srow"><div class="sl"><b>${title}</b><small>${help}</small></div><button class="tog" data-k="${k}" aria-label="${title}"><i></i></button></div>`;
  const pages = {
    game: `<div class="srow"><div class="sl"><b>Username</b><small>Shown on your kart and in parties</small></div><input id="uname" maxlength="14" autocomplete="off" spellcheck="false" placeholder="Your name" value="${(save.name || '').replace(/"/g, '&quot;')}"></div>`
      + row('dev', 'Dev mode', 'No questions anywhere and unlimited coins (for testing)')
      + (dbgOn() || isDevAcct() ? `<div class="srow"><div class="sl"><b>Debug hub</b><small>Jump anywhere, questions, race, steering, kart, graphics (developers and testers)</small></div><button class="sbtn" id="sDbg">DEBUG HUB</button></div>` : '')
      + `<div class="srow"><div class="sl"><b>How to play</b><small>The controls and the rules, with pictures</small></div><button class="sbtn" id="sHelp">OPEN</button></div>`
      + `<div class="srow"><div class="sl"><b>Intro story</b><small>Foxino finds the kart: the story and the colour again</small></div><button class="sbtn" id="sTut">PLAY</button></div>`,
    controls: (() => {
      // (v138, the user) pick how you steer, with a picture of each: sideways you can tilt the phone, use the round
      // joystick or the line; upright it is the joystick or the line.
      const ART = STEER_ART;
      const NAME = STEER_NAME;
      const cards = (grp, keys, cur) => `<div class="spick" data-g="${grp}">${keys.map((k) => `<button data-v="${k}" class="${k === cur ? 'on' : ''}">${ART[k]}<span>${NAME[k]}</span></button>`).join('')}</div>`;
      return `<div class="srow col"><div class="sl"><b>Steering · sideways</b><small>With the phone held sideways (16:9)</small></div>${cards('L', ['tilt', 'joy', 'line', 'follow', 'arrows'], save.steerL || 'follow')}</div>`
        + `<div class="srow col"><div class="sl"><b>Steering · upright</b><small>With the phone upright (9:16)</small></div>${cards('P', ['joy', 'line', 'follow', 'arrows'], save.steerP || 'follow')}</div>`
        + `<div class="srow col"><div class="sl"><b>Joystick sensitivity</b><small id="sensHelp"></small></div><div class="ssens"><span>LOW</span><input type="range" id="sens" min="50" max="150" step="5" value="${Math.round(joySens() * 100)}" aria-label="Joystick sensitivity"><span>HIGH</span><output id="sensOut"></output><button class="sbtn" id="sensReset">RESET</button></div></div>`   // (v281)
        + `<div class="srow col"><div class="sl"><b>Steering assist</b><small id="asHelp"></small></div><div class="seg" id="asSeg"><button data-v="0">OFF</button><button data-v="1">LOW</button><button data-v="2">MEDIUM</button><button data-v="3">HIGH</button></div></div>`
        + `<div class="srow col"><div class="sl"><b>Controls side</b><small id="sideHelp"></small></div><div class="seg" id="sideSeg"><button data-v="left">LEFT</button><button data-v="right">RIGHT</button></div></div>`
        + (navigator.vibrate ? row('buzz', 'Vibration', 'A short buzz on bumps, hits and turbos') : '')
        + `<div class="skeys"><b>Keyboard</b> W drive · A D steer · SHIFT drift · SPACE power-up · ESC pause<br><b>Xbox</b> RT or A gas · LT brake · stick or D-pad steer · LB/RB drift · X power-up · Menu pause · B back<br><b>PlayStation</b> R2 or ✕ gas · L2 brake · stick or D-pad steer · L1/R1 drift · □ power-up · Options pause · ○ back</div>`;
    })(),
    graphics: `<div class="srow col"><div class="sl"><b>Graphics quality</b><small id="gfxHelp"></small></div><div class="seg" id="gfxSeg"><button data-v="low">LOW</button><button data-v="default">DEFAULT</button><button data-v="high">HIGH</button></div></div>`,
    audio: row('music', 'Music', 'The music in the lobby and in races'),
  };
  S.innerHTML = `<div class="sveil"><div class="spanel art"><div class="shead"><h2 class="out">SETTINGS</h2><button class="sx" id="sClose" aria-label="Close"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 5l14 14M19 5L5 19" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/></svg></button></div>
    <div class="sbody"><nav class="stabs">${SET_TABS.map(([k, n]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('')}</nav><div class="spage">${pages[tab]}</div></div></div></div>`;
  const GET = { music: () => save.music !== false, assist: () => save.assist !== false, tilt: () => !!save.tilt, buzz: () => save.buzz !== false, dev: () => DEV() };
  const SETF = {
    music: (v) => { save.music = v; if (!v) Music.stop(); }, assist: (v) => { save.assist = v; }, buzz: (v) => { save.buzz = v; if (v) buzz(40); },
    tilt: async (v) => { if (v) { const ok = await enableTilt(); if (!ok) { toast('Tilt is not available here', '#ffb0b8', 24); return false; } } save.tilt = v; },
    dev: (v) => { save.dev = v; refreshCounters(); toast(v ? 'DEV MODE ON\nNo questions · unlimited coins' : 'DEV MODE OFF\nQuestions are back', v ? '#4fc84a' : '#ffe14a', 24); },
  };
  for (const b of S.querySelectorAll('.tog')) { const k = b.dataset.k, show = () => b.classList.toggle('on', !!GET[k]()); show(); tap(b, async () => { sfx.click(); const r = await SETF[k](!GET[k]()); store(); if (r !== false) show(); }); }
  const seg = S.querySelector('#gfxSeg');
  if (seg) { const H = { low: 'Fast on every phone. No shadows, a lower resolution, simpler light.', default: 'The balance: shadows and lantern light; a slow phone lowers it by itself.', high: 'Every pixel, sharp wide shadows, six lantern lights with shadows. For strong devices.' };
    const show = () => { const g = gfxOf(save); for (const b of seg.children) b.classList.toggle('on', b.dataset.v === g); $('gfxHelp').textContent = H[g]; }; show();
    for (const b of seg.children) tap(b, () => { sfx.click(); save.gfx = b.dataset.v; save.lowq = 0; store(); applyGfx(); show(); }); }
  const aseg = S.querySelector('#asSeg');
  if (aseg) { const H = ['No help: you steer everything yourself.', 'A little help: the kart lines up with the road when you let go.', 'More help: it follows the road and keeps you off the edges.', 'Most help: for your first races — it nearly drives the bends for you.'];
    const show = () => { const v = save.assistLvl ?? 1; for (const b of aseg.children) b.classList.toggle('on', +b.dataset.v === v); $('asHelp').textContent = H[v]; }; show();
    for (const b of aseg.children) tap(b, () => { sfx.click(); save.assistLvl = +b.dataset.v; store(); show(); }); }
  // (v281, the user) the joystick sensitivity slider: saved as you drag, used at once (also in the middle of a race)
  const sens = S.querySelector('#sens');
  if (sens) { const show = () => { const v = +sens.value; $('sensOut').textContent = `${v}%`; $('sensHelp').textContent = v < 100 ? 'Calmer: a small push turns the kart only a little (joystick, line and controller stick)' : v > 100 ? 'Quicker: a small push already turns the kart (joystick, line and controller stick)' : 'Normal: the tuned feel (joystick, line and controller stick)'; $('sensReset').style.opacity = v === 100 ? .45 : 1; };
    const set = (v) => { sens.value = v; save.joySens = v / 100; store(); show(); }; show();
    sens.addEventListener('input', () => set(+sens.value)); for (const ev of ['keydown', 'keyup']) sens.addEventListener(ev, (e) => e.stopPropagation());
    tap($('sensReset'), () => { sfx.click(); set(100); }); }
  // (v263, the user) which side the steering sits on: the joystick, line or arrows left and the power-up right, or the other way round
  const sseg = S.querySelector('#sideSeg');
  if (sseg) { const show = () => { const v = save.ctlSide === 'right' ? 'right' : 'left'; for (const b of sseg.children) b.classList.toggle('on', b.dataset.v === v); $('sideHelp').textContent = v === 'right' ? 'Steering on the right, the power-up button on the left (for left-handed players)' : 'Steering on the left, the power-up button on the right'; }; show();
    for (const b of sseg.children) tap(b, () => { sfx.click(); save.ctlSide = b.dataset.v; store(); applySide(); show(); }); }
  for (const grp of S.querySelectorAll('.spick')) {
    const g = grp.dataset.g;
    for (const b of grp.children) tap(b, async () => { sfx.click(); const v = b.dataset.v;
      if (v === 'tilt') { const ok = await enableTilt(); if (!ok) { toast('Tilt is not available here', '#ffb0b8', 24); return; } save.tilt = true; }
      if (g === 'L') save.steerL = v; else save.steerP = v;
      store(); for (const c of grp.children) c.classList.toggle('on', c === b);
      toast(v === 'tilt' ? 'TURN THE DEVICE TO STEER' : v === 'joy' ? 'JOYSTICK STEERING' : v === 'follow' ? 'TAP THE SIDES TO STEER' : v === 'arrows' ? 'ARROW BUTTONS' : 'LINE STEERING', '#ffe14a', 24); });
  }
  for (const b of S.querySelectorAll('.stabs button')) tap(b, () => { sfx.click(); openSettings(b.dataset.t, onClose); });
  const u = S.querySelector('#uname'); if (u) { u.addEventListener('keydown', (e) => e.stopPropagation()); u.addEventListener('keyup', (e) => e.stopPropagation()); u.addEventListener('input', () => { save.name = u.value.trim().slice(0, 14); store(); if (devAccount()) { refreshCounters(); toast('DEV ACCOUNT\n<small>5 000 coins · kart back to level 1</small>', '#ffe14a', 34); } racerPlate(); }); }
  if ($('sHelp')) tap($('sHelp'), () => { S.hidden = true; S.innerHTML = ''; showHelp(() => {}); });
  if ($('sTut')) tap($('sTut'), () => { sfx.click(); S.hidden = true; S.innerHTML = ''; runIntro(); });   // (v172)
  if ($('sDbg')) tap($('sDbg'), () => { sfx.click(); S.hidden = true; S.innerHTML = ''; if (onClose) onClose(); window.FK.debug(); });   // (v269)
  tap($('sClose'), () => { sfx.click(); S.hidden = true; S.innerHTML = ''; if (onClose) onClose(); });
}
function refreshCounters() {
  if ($('passT')) $('passT').textContent = `LV ${passOf().lv}`;
  $('coinsT').textContent = DEV() ? '∞' : save.coins; $('energyT').textContent = `${save.energy}/${TUNE.maxEnergy}`;
  $('coinsPlus').hidden = false;   // (v246: the + gives coins to everyone)
  $('epill').hidden = !TUNE.energy; $('playCost').hidden = !TUNE.energy;
  $('play').classList.toggle('dim', !canRace());
}

// a race costs 1 energy, the Grand Prix 2 — unless energy is off, when everything is free
const canRace = (n = 1) => !TUNE.energy || save.energy >= n;
function payRace(n = 1) { if (!TUNE.energy) return true; if (save.energy < n) { sfx.wrong(); toast(n > 1 ? 'The Grand Prix needs 2 energy' : 'Out of energy!\nTap the + to earn more', '#ffe14a', 28); return false; } save.energy -= n; store(); return true; }

/* ---------- 3. Renderer, lights, sky ---------- */
const canvas = $('cv');
// (v266, the user: "on weaker devices it stays on 0%") a weak or busy GPU can refuse the full context: try a plainer one
const renderer = (() => { for (const o of [{ antialias: true, powerPreference: 'high-performance' }, { antialias: false }, { antialias: false, powerPreference: 'low-power', precision: 'mediump' }]) { try { return new THREE.WebGLRenderer({ canvas, ...o }); } catch (e) { console.warn('WebGL context failed', o, e); } } if (window.__ldFail) window.__ldFail('This device could not start 3D graphics'); throw new Error('no WebGL'); })();
// quality 0 = full, 1 = no shadows, 2 = also a lower resolution. RESOLUTION in the settings (save.res, v69): DEFAULT draws
// at up to 1.75 device pixels per CSS pixel, HIGH at every device pixel (up to 3) — sharper on phones, more work for the GPU
// (v92) graphics quality: save.gfx = 'low' | 'default' | 'high' (older saves: save.res 'high' → 'high').
// LOW: 0.7 pixels per point, no shadows, no lantern lights — fast on any phone, plainer. DEFAULT: up to 1.75 pixels per
// point, shadows, four lantern lights; a slow phone drops shadows and resolution by itself. HIGH: every device pixel,
// sharper and wider shadows, six lantern lights (the two nearest cast shadows); the slow-phone fallback is off.
let BOOT_LOW = true;   // (v277, the user: "it automatically loads on low res and then starts loading the higher resolutions") the first picture is drawn at 1x, then upgradeAssets() raises it
const gfxOf = (sv) => (sv && sv.gfx) || (sv && sv.res === 'high' ? 'high' : 'default');
const pixelRatioFor = (q, g = gfxOf(typeof save !== 'undefined' ? save : null)) => (window.FK && window.FK.pr) || Math.min(BOOT_LOW ? 1 : 9, g === 'high' ? Math.min(window.devicePixelRatio || 1, 3) : g === 'low' ? .7 : q === 2 ? .75 : q ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setPixelRatio((() => { try { const sv = JSON.parse(localStorage.getItem('foxino-kart-v1') || '{}'); return pixelRatioFor(+sv.lowq || 0, gfxOf(sv)); } catch (e) { return pixelRatioFor(0, 'default'); } })());
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;   // (Neutral tone mapping looks brighter but runs at 1/6 the speed in Safari)
// if the phone takes the graphics away (low memory), reload: everything is saved
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault(); if (TUNE.energy && race && !race.ended) save.energy = Math.min(TUNE.maxEnergy, save.energy + 1);   // a race cut short gives its energy back
  try { localStorage.setItem('foxino-kart-v1', JSON.stringify(save)); } catch (er) {} setTimeout(() => location.reload(), 1200);
});
const pmrem = new THREE.PMREMGenerator(renderer);
const ENV = pmrem.fromScene(new RoomEnvironment(), .04).texture;

function skyTexture(stops = [['#3f8ff0', 0], ['#8cc4ff', .45], ['#d8ecff', .62], ['#f4f9ff', 1]]) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  for (const [col, at] of stops) g.addColorStop(at, col);
  x.fillStyle = g; x.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const SKY = skyTexture();
function addLights(scene, shadowSize = 1024, box = 14, def = { hemi: [0xe6f2ff, 0x9aaccc, 1.0], sun: [0xfff2dc, 2.4] }) {
  scene.add(new THREE.HemisphereLight(...def.hemi));
  const sun = new THREE.DirectionalLight(...def.sun); sun.position.set(10, 22, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize); Object.assign(sun.shadow.camera, { left: -box, right: box, top: box, bottom: -box, near: 1, far: 80 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .02; scene.add(sun, sun.target); return sun;
}

/* ---------- 4. Baking the models ---------- */
// colour helpers: turn a colour round the colour wheel; do the same to every pixel of a painted texture
const _hsl = {};
function hueColor(c, dh) { if (!dh) return c; c.getHSL(_hsl, THREE.SRGBColorSpace); return c.setHSL((_hsl.h + dh + 1) % 1, _hsl.s, _hsl.l, THREE.SRGBColorSpace); }
const hueTexCache = new Map();
function hueTex(tex, dh) {
  if (!dh || !tex || !tex.image) return tex;
  const key = tex.uuid + dh; if (hueTexCache.has(key)) return hueTexCache.get(key);
  const src = tex.image, c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0); const img = x.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx - mn < .04) continue;   // greys and white stay as they are
    const dd = mx - mn, s = l > .5 ? dd / (2 - mx - mn) : dd / (mx + mn);
    let h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; h = (h / 6 + dh + 1) % 1;
    const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    d[i] = f(h + 1 / 3) * 255; d[i + 1] = f(h) * 255; d[i + 2] = f(h - 1 / 3) * 255;
  }
  x.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.flipY = tex.flipY; hueTexCache.set(key, t); return t;
}

// shared materials for baked meshes: plain colours become vertex colours, so a whole kart is only a few draw calls
const VC = new Map();
function vcMat(metal, gloss, side) {
  const key = `${metal}${gloss}${side}`;
  if (!VC.has(key)) VC.set(key, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: gloss ? .3 : .78, metalness: metal ? .7 : 0, side, envMapIntensity: .8 }));
  return VC.get(key);
}
const MAPM = new Map();
function flipWinding(g) {
  for (const name of ['position', 'normal', 'uv']) {
    const a = g.attributes[name]; if (!a) continue; const s = a.itemSize, arr = a.array;
    for (let i = 0; i < a.count; i += 3) for (let k = 0; k < s; k++) { const t = arr[(i + 1) * s + k]; arr[(i + 1) * s + k] = arr[(i + 2) * s + k]; arr[(i + 2) * s + k] = t; }
  }
}
function mergeList(list) {
  let n = 0; for (const it of list) n += it.g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = list[0].color ? new Float32Array(n * 3) : null;
  let o = 0;
  for (const { g, color } of list) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (col) for (let i = 0; i < c; i++) { col[(o + i) * 3] = color.r; col[(o + i) * 3 + 1] = color.g; col[(o + i) * 3 + 2] = color.b; }
    o += c;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeBoundingSphere(); return geo;
}
// bake everything visible under `root` into a few meshes in root's own space.
// tint(color) may change a colour (hue shift, kart paint); tex(texture) may swap a texture.
function bake(root, { tint = (c) => c, tex = (t) => t, shadow = true } = {}) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), m4 = new THREE.Matrix4(), buckets = new Map();
  root.traverseVisible((o) => {
    if (!o.isMesh) return;
    const m = o.material; m4.multiplyMatrices(inv, o.matrixWorld);
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(m4); if (m4.determinant() < 0) flipWinding(g);
    let key, make, color = null;
    if (m.map) {
      const map = tex(m.map); key = 'map' + map.uuid + m.side;
      make = () => { const k = map.uuid + m.side + tint(m.color.clone()).getHexString(); if (!MAPM.has(k)) MAPM.set(k, new THREE.MeshStandardMaterial({ map, color: tint(m.color.clone()), roughness: m.roughness, metalness: m.metalness, side: m.side })); return MAPM.get(k); };
    } else if (m.transparent) {
      key = 'tr' + m.uuid;
      make = () => new THREE.MeshStandardMaterial({ color: tint(m.color.clone()), roughness: Math.max(.08, m.roughness), metalness: m.metalness, transparent: true, opacity: m.opacity, side: m.side, depthWrite: false });
    } else {
      const metal = m.metalness > .5, gloss = m.roughness < .5 || (m.clearcoat || 0) > .5; key = `vc${metal}${gloss}${m.side}`;
      make = () => vcMat(metal, gloss, m.side); color = tint(m.color.clone());
    }
    if (!buckets.has(key)) buckets.set(key, { make, list: [] });
    buckets.get(key).list.push({ g, color });
  });
  const out = new THREE.Group();
  for (const { make, list } of buckets.values()) {
    const mesh = new THREE.Mesh(mergeList(list), make()); mesh.castShadow = shadow; out.add(mesh);
    list.forEach((it) => it.g.dispose());
  }
  return out;
}
// one geometry with vertex colours (for instanced scenery)
function bakeOne(root) {
  const g = bake(root, { shadow: false }); if (g.children.length === 1) return g.children[0].geometry;
  // several buckets (shiny and matte parts): join them, keeping each part's own vertex colours
  const geos = g.children.map((m) => m.geometry), n = geos.reduce((a, x) => a + x.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3).fill(1); let o = 0;
  for (const x of geos) { const c = x.attributes.position.count; pos.set(x.attributes.position.array, o * 3); nor.set(x.attributes.normal.array, o * 3); if (x.attributes.uv) uv.set(x.attributes.uv.array, o * 2); if (x.attributes.color) col.set(x.attributes.color.array, o * 3); o += c; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere(); return out;
}

// stickers: drawn on a canvas, used on the kart and in the garage
function drawSticker(x, id, S = 256) {
  const c = S / 2, P = (pts, fill) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(c + a * S, c + b * S) : x.moveTo(c + a * S, c + b * S))); x.closePath(); x.fillStyle = fill; x.fill(); x.stroke(); };
  x.lineWidth = S * .045; x.strokeStyle = '#1b2a4a'; x.lineJoin = 'round';
  if (id === 'star') { const p = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? .19 : .42; p.push([Math.cos(a) * r, Math.sin(a) * r + .03]); } P(p, '#ffe14a'); }
  else if (id === 'heart') { x.beginPath(); x.moveTo(c, c + S * .36); x.bezierCurveTo(c - S * .5, c + S * .02, c - S * .32, c - S * .42, c, c - S * .14); x.bezierCurveTo(c + S * .32, c - S * .42, c + S * .5, c + S * .02, c, c + S * .36); x.fillStyle = '#ff5db1'; x.fill(); x.stroke(); }
  else if (id === 'flame') { P([[0, -.44], [.2, -.12], [.3, .1], [.22, .32], [0, .42], [-.22, .32], [-.3, .1], [-.18, -.06], [-.08, .06], [-.06, -.2]], '#ff6a1e'); P([[0, -.08], [.12, .12], [.1, .28], [0, .34], [-.1, .28], [-.12, .14]], '#ffe14a'); }
  else if (id === 'bolt') P([[.08, -.44], [-.3, .06], [-.04, .06], [-.12, .44], [.3, -.08], [.04, -.08]], '#ffe14a');
  else if (id === 'snow') { x.lineCap = 'round'; for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3, dx = Math.cos(a) * S * .38, dy = Math.sin(a) * S * .38; x.lineWidth = S * .11; x.strokeStyle = '#1b2a4a'; x.beginPath(); x.moveTo(c - dx, c - dy); x.lineTo(c + dx, c + dy); x.stroke(); x.lineWidth = S * .055; x.strokeStyle = '#a8e4ff'; x.stroke(); } }
  else if (id === 'stripes') { x.fillStyle = '#fff'; for (const sx of [-.2, .06]) { x.fillRect(c + sx * S, c - S * .46, S * .14, S * .92); x.strokeRect(c + sx * S, c - S * .46, S * .14, S * .92); } }
  else if (id === 'none') { x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = S * .06; x.beginPath(); x.arc(c, c, S * .26, 0, 7); x.moveTo(c - S * .18, c + S * .18); x.lineTo(c + S * .18, c - S * .18); x.stroke(); }
}
const stickerURL = {}, stickerTex = {};
for (const st of STICKERS) {
  const c = document.createElement('canvas'); c.width = c.height = 128; drawSticker(c.getContext('2d'), st.id, 128); stickerURL[st.id] = c.toDataURL();
  if (st.id !== 'none') { const c2 = document.createElement('canvas'); c2.width = c2.height = 256; drawSticker(c2.getContext('2d'), st.id); const t = new THREE.CanvasTexture(c2); t.colorSpace = THREE.SRGBColorSpace; stickerTex[st.id] = t; }
}

// the base models, Foxino sitting in the kart, built once at "phone" detail
const BASE = {};
function seatFoxino(fox) {
  // legs forward from the hips (the shorts' legs and pockets go with them), arms reaching for the wheel
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * .095, .42, 0); fox.add(hip); fox.updateMatrixWorld(true);
    const parts = fox.children.filter((o) => ['ShortsLeg', 'ShortsHem', 'CargoPocket', 'PocketFlap', 'PocketButton'].includes(o.name) && Math.sign(o.position.x) === s);
    parts.push(fox.getObjectByName(s < 0 ? 'LegRight' : 'LegLeft'));
    parts.forEach((p) => hip.attach(p));
    hip.rotation.set(-1.42, 0, s * .12);
  }
  for (const s of [-1, 1]) {
    const arm = fox.getObjectByName(s < 0 ? 'ArmRight' : 'ArmLeft'); arm.rotation.set(-1.0, s * -.05, s * .22);
    fox.getObjectByName(s < 0 ? 'HandRight' : 'HandLeft').rotation.set(1.35, 0, s * -.2);   // palms down onto the wheel
  }
  // the tail swings out low behind the seat, so it doesn't hide the helmet from the chase camera
  const tail = fox.getObjectByName('Tail');
  if (tail) { const piv = new THREE.Group(); piv.position.set(0, .44, -.13); fox.add(piv); fox.updateMatrixWorld(true); piv.attach(tail); piv.rotation.set(-1.0, 0, -.55); }
}
// the real Foxino: a 3D model made with Higgsfield (Meshy 7, rigged), posed sitting in the kart and baked
// (see "Foxino Kart" in the vault — the game is called FoxKarts since v144). If it can't load, the Foxino built from shapes in models.js drives instead.
const HF_PIVOT = new THREE.Vector3(0, .15, -.3);
// the official characters (Foxino_postavicky_3D, baked seated by tools/bake-seated.html into chars/*.glb)
const OFFICIAL = {"foxino":{"head":[0.035,0.616,0.031],"neck":[0.036,0.543,0.032],"hips":[0.034,0.264,0.021],"hw":0.253,"box":{"min":[-0.217,-0.06,-0.39],"max":[0.288,1.04,0.441]}},"stella":{"head":[0.1,0.363,-0.07],"neck":[0.103,0.314,-0.068],"hips":[0.099,0.143,-0.11],"hw":0.214,"box":{"min":[-0.114,-0.063,-0.296],"max":[0.298,0.647,0.28]}},"rob":{"head":[0.162,0.833,-0.185],"neck":[0.159,0.765,-0.19],"hips":[0.149,0.444,-0.273],"hw":0.288,"box":{"min":[-0.245,-0.089,-0.534],"max":[0.559,1.292,0.43]}},"pix":{"head":[0.109,0.745,-0.107],"neck":[0.111,0.697,-0.112],"hips":[0.106,0.476,-0.17],"hw":0.22,"box":{"min":[-0.129,-0.025,-0.297],"max":[0.329,0.878,0.315]}}};
// how each one sits in the kart: scale, where the hips go (kart space), what is cut off above the helmet (its own
// ears or antenna, in model space), and the helmet (radius, nudge, ears / antenna, colours)
// (since v50 the whole head is cut off at the neck — clipY is just above the neck bone — and a small helmet in human
// proportion sits on the neck: r is its radius in kart units, dy / dz nudge it)
const CHAR_FIT = {
  foxino: { s: 1.55, seat: [0, .19, -.2], clipY: .575, helm: { r: .2, dy: .0, dz: .03, ears: true, main: '#8a4ec8', accent: '#ff7a1e' } },
  stella: { s: 1.55, seat: [0, .19, -.2], clipY: .35, helm: { r: .18, dy: .0, dz: .02, ears: true, main: '#3c8cf0', accent: '#ff8a2a' } },
  pix: { s: 1.35, seat: [0, .19, -.2], clipY: .735, helm: { r: .19, dy: .0, dz: .02, main: '#4fc84a', accent: '#8a4ae8' } },
  rob: { s: 1.15, seat: [0, .19, -.24], clipY: .81, helm: { r: .22, dy: .0, dz: .0, antenna: true, main: '#2ac8c0', accent: '#ff5a5a' } },
};
// cut the head off under the helmet (model space): a triangle goes when it lies wholly above y (the back of the head)
// or when any of its corners is above y AND in front of zFront (the face and the muzzle, which hang lower than the neck)
function clipAbove(geo, y, zFront = Infinity) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone(), p = g.attributes.position, keep = [];
  for (let t = 0; t < p.count; t += 3) {
    let all = true, face = false;
    for (let k = 0; k < 3; k++) { const vy = p.getY(t + k), vz = p.getZ(t + k); if (vy <= y) all = false; if (vy > y && vz > zFront) face = true; }
    if (!all && !face) keep.push(t, t + 1, t + 2);
  }
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(g.attributes)) { const a = g.attributes[name], n = a.itemSize, arr = new Float32Array(keep.length * n); keep.forEach((i, k) => { for (let c = 0; c < n; c++) arr[k * n + c] = a.array[i * n + c]; }); out.setAttribute(name, new THREE.BufferAttribute(arr, n)); }
  return out;
}
// (v277) start-up models: small 256 px textures from low/, the full ones follow in upgradeAssets(); a download that hangs can never hold up the loading screen again
const lowGLB = (file) => `low/${file}.glb?v=1`;
const giveUp = (p, ms = 15000) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timed out')), ms))]);
const gltf = (url, ms) => giveUp(new GLTFLoader().loadAsync(url), ms);
async function loadOfficial(hi = false) {
  BASE.off = BASE.off || {};
  await Promise.all(Object.keys(CHAR_FIT).map(async (id) => {
    try { const g = await gltf(hi ? `chars/${id}.glb?v=4` : lowGLB(id)); g.scene.traverse((o) => { if (o.isMesh) { BASE.off[id] = o; o.material.envMapIntensity = .8; } }); }
    catch (e) { console.warn('official model missing', id, e); }
  }), BASE.rivalSrc ? null : gltf('models/racing-driver.glb?v=1', 20000).then((g) => { BASE.rivalSrc = g.scene; }).catch((e) => console.warn('racing driver did not load; the rivals stay themselves', e)),
    BASE.foxDrvSrc ? null : gltf('models/foxino-driver.glb?v=1', 20000).then((g) => { BASE.foxDrvSrc = g.scene; }).catch((e) => console.warn('Foxino driver did not load; the old Foxino drives', e)));
}
// the default kart: the Meshy model from the user's purple-and-gold sheet (kart-skin.js recolours it per look).
// Drivers sit at its Seat node, which is higher and further back than the old shape-built kart's seat.
const OLD_SEAT = new THREE.Vector3(0, .19, -.2);
async function loadKart(hi = false) {
  try { BASE.dk = await giveUp(loadDefaultKart(THREE, GLTFLoader, hi ? 'kart-default.glb?v=3' : lowGLB('kart-default'), hi)); BASE.seatShift = BASE.dk.nodes.Seat.position.clone().sub(OLD_SEAT).add(new THREE.Vector3(0, 0, .12)); /* a little forward of the Seat node, so the hands reach the wheel */ BASE.steerAxis = wheelNormal(BASE.dk.nodes.SteeringWheel.children[0].geometry); await giveUp(addKartDetails(BASE.dk), 15000).catch((e) => console.warn(e)); }
  catch (e) { console.warn('default kart did not load; using the shape-built one', e); if (!hi) BASE.dk = null; }
  // the Meshy racing helmet (the user's purple / white / orange sheet); the shape-built helmet stays as a fallback
  try { BASE.helmet = await giveUp(loadHelmet(THREE, GLTFLoader, hi ? 'helmet.glb?v=1' : lowGLB('helmet'), hi)); } catch (e) { console.warn('helmet did not load; using the shape-built one', e); if (!hi) BASE.helmet = null; }
  // (v184, the user) the starship (the support worker's low-poly Blender hover kart) is the only vehicle on Star Loop
  try { const g = (await gltf(hi ? 'models/hoverkart.glb?v=6' : lowGLB('hoverkart'))).scene; prepShip(g); BASE.ship = g; } catch (e) { console.warn('starship did not load; Star Loop uses the kart', e); if (!hi) BASE.ship = null; }
  if (hi) return;
  // (v187) Foxino in his space suit for the starship: loaded in the background (2 MB), the usual driver until it arrives
  new GLTFLoader().loadAsync('models/foxino-driver-posed.glb?v=4').then((g) => { g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; if (o.material && o.material.name === 'M_Visor') { const v = o.material; v.color.set('#0c1330'); v.opacity = .78; v.metalness = .85; v.roughness = .06; v.envMapIntensity = 1.6; } } });   /* (v247, the user: a darker visor, smoked and glossy, the face only faintly through it) */ BASE.foxSuit = g.scene; if (SHOW.racer && GARAGE_VEH === 'ship') setShowRacer(); }).catch((e) => console.warn('space-suit Foxino did not load', e));
}
// the steering wheel is a tilted disc: find its normal (in the Y-Z plane) so it can turn about its own axis
function wheelNormal(geo) {
  const p = geo.attributes.position, c = new THREE.Vector3(); for (let i = 0; i < p.count; i++) c.add(new THREE.Vector3().fromBufferAttribute(p, i)); c.divideScalar(p.count);
  let best = null, bv = 1e9;
  for (let a = -Math.PI / 2; a <= Math.PI / 2; a += Math.PI / 36) { const n = new THREE.Vector3(0, Math.sin(a), Math.cos(a)); let v = 0; for (let i = 0; i < p.count; i += 3) { const d = new THREE.Vector3().fromBufferAttribute(p, i).sub(c).dot(n); v += d * d; } if (v < bv) { bv = v; best = n; } }
  return best;
}
// (v115, the user's own models) the cave crystals: four faceted GLB files — blue and purple, one crystal and a
// cluster of three. Their glTF material is see-through glass, which the user's phone draws as an opaque slab, so the
// shapes are kept and given SOLID glowing materials here. Each is scaled so instance scales match the old crystals.
async function loadCrystals() {
  const want = [['blue', 'blue-crystal'], ['blueC', 'blue-crystal-cluster'], ['purple', 'purple-crystal'], ['purpleC', 'purple-crystal-cluster']], out = {};
  await Promise.all(want.map(async ([key, file]) => {
    try { const g = await new GLTFLoader().loadAsync(`models/${file}.glb?v=1`); out[key] = bakeOne(g.scene).scale(3.2, 3.2, 3.2); }
    catch (e) { console.warn('crystal model missing', file, e); }
  }));
  BASE.cry = out.blue && out.purple && out.blueC && out.purpleC ? out : null;
}
// A low-poly stand-in for a high-poly model: measure the widest radius in height bands, then lathe that outline with
// few sides. It keeps the model's silhouette, matches the game's faceted look and costs a few hundred triangles
// instead of tens of thousands (the user's stalagmites are 28 800 vertices each — far too heavy to scatter).
function lowPolyProfile(geo, bands = 7, sides = 6) {
  const p = geo.attributes.position; let y0 = Infinity, y1 = -Infinity, sx = 0, sz = 0;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; sx += p.getX(i); sz += p.getZ(i); }
  sx /= p.count; sz /= p.count; const h = Math.max(1e-4, y1 - y0), R = new Float32Array(bands);
  for (let i = 0; i < p.count; i++) { const b = clamp(Math.floor((p.getY(i) - y0) / h * bands), 0, bands - 1), r = Math.hypot(p.getX(i) - sx, p.getZ(i) - sz); if (r > R[b]) R[b] = r; }
  for (let b = bands - 2; b >= 0; b--) R[b] = Math.max(R[b], R[b + 1] * .96);   // keep the outline going outwards towards the foot
  const pts = [new THREE.Vector2(Math.max(.02, R[0]), y0)];
  for (let b = 0; b < bands; b++) pts.push(new THREE.Vector2(Math.max(.015, R[b]), y0 + (b + .5) / bands * h));
  pts.push(new THREE.Vector2(.012, y1));
  return new THREE.LatheGeometry(pts, sides).translate(sx, 0, sz);
}
// the user's three stalagmite models, rebuilt low-poly and scaled to the cave
async function loadStalagmites() {
  const out = [];
  for (const file of ['stalagmite-1', 'stalagmite-2', 'stalagmite-3']) {
    try { const g = await new GLTFLoader().loadAsync(`models/${file}.glb?v=1`); g.scene.updateMatrixWorld(true);
      const grp = new THREE.Group();
      g.scene.traverse((o) => { if (o.isMesh) { const m = new THREE.Mesh(lowPolyProfile(o.geometry), M('#ffffff')); m.applyMatrix4(o.matrixWorld); grp.add(m); } });
      if (grp.children.length) out.push(bakeOne(grp).scale(3, 3, 3));
    } catch (e) { console.warn('stalagmite model missing', file, e); }
  }
  BASE.stal = out.length === 3 ? out : null;
}
// (v157, the user's own model) the Le Mans pit garage: kart/models/pit-garage.glb, two storeys, 247 meshes
// in 80 materials. Drawn five times side by side, 247 x 5 draw calls would sink a phone, so at load the
// meshes are MERGED per material into ~80 geometries (transforms baked, quantised attributes widened to
// floats) and the five bays are drawn as instances of those. Its frame is pitGroup's: the open door at
// x = 0 facing −x (the lane), 9 m deep along +x, 10 m wide across z, floor at y = 0.
// (v159) GARAGE COLOURS (the user): every purple on a pit garage becomes the colour of the racer whose garage it is,
// in that character's own shade — Foxino purple, Stella orange, Pix green, Gummy pink, Rob blue (from his cyan
// family, so it reads as blue on a building). Each purple keeps its place in the model's light-to-dark range: it
// is re-hued to the character's colour and its saturation and lightness scaled by how that colour compares with
// the model's own mid purple. Six parts are plain purple (they stay instanced, with a per-instance colour); five
// carry purple painted into a texture (wall stripes, fascia, the sign) — each bay gets its own recoloured copy.
const GARAGE_COL = { foxino: '#8a4ae8', stella: '#ff8a1e', pix: '#4fc84a', gummy: '#ff5db1', rob: '#2a9fe6' };
const GAR_REF = new THREE.Color('#8a5cf0').getHSL({}, THREE.SRGBColorSpace);   // the model's own mid purple
const garPurple = (h, s, l, minS) => h >= 240 / 360 && h <= 305 / 360 && s > minS && l > .06 && l < .96;
function rgbHsl(r, g, b, o) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  o[0] = h; o[1] = s; o[2] = l; return o;
}
function hslRgb(h, s, l, o) {
  if (!s) { o[0] = o[1] = o[2] = l; return o; }
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  o[0] = f(h + 1 / 3); o[1] = f(h); o[2] = f(h - 1 / 3); return o;
}
// a plain purple → the character's shade of it
function garageShade(src, hex, out) {
  const a = src.getHSL({}, THREE.SRGBColorSpace), t = new THREE.Color(hex).getHSL({}, THREE.SRGBColorSpace);
  return out.setHSL(t.h, clamp(a.s * t.s / GAR_REF.s, 0, 1), clamp(a.l * t.l / GAR_REF.l, .04, .95), THREE.SRGBColorSpace);
}
// a texture with purple painted in → a copy with only its purple pixels re-hued (anti-aliased edges included)
const garTexCache = new Map();
function garageTex(src, hex) {
  const key = src.uuid + hex; if (garTexCache.has(key)) return garTexCache.get(key);
  const img = src.image, w = img.width, h = img.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const x = cv.getContext('2d'); x.drawImage(img, 0, 0); const id = x.getImageData(0, 0, w, h), d = id.data;
  const t = new THREE.Color(hex).getHSL({}, THREE.SRGBColorSpace), ks = t.s / GAR_REF.s, kl = t.l / GAR_REF.l, hs = [0, 0, 0], rgb = [0, 0, 0];
  for (let k = 0; k < d.length; k += 4) {
    rgbHsl(d[k] / 255, d[k + 1] / 255, d[k + 2] / 255, hs);
    if (!garPurple(hs[0], hs[1], hs[2], .08)) continue;
    hslRgb(t.h, Math.min(1, hs[1] * ks), clamp(hs[2] * kl, .04, .95), rgb);
    d[k] = rgb[0] * 255; d[k + 1] = rgb[1] * 255; d[k + 2] = rgb[2] * 255;
  }
  x.putImageData(id, 0, 0);
  const tex = src.clone(); tex.source = new THREE.Source(cv); tex.needsUpdate = true;   // (a NEW source: a clone shares the original's image)
  garTexCache.set(key, tex); return tex;
}
// which parts carry purple, and in what form
function garageTint(m) {
  if (m.map && m.map.image) {
    const img = m.map.image, cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); x.drawImage(img, 0, 0, 64, 64);
    const d = x.getImageData(0, 0, 64, 64).data, hs = [0, 0, 0]; let n = 0;
    for (let k = 0; k < d.length; k += 4) { rgbHsl(d[k] / 255, d[k + 1] / 255, d[k + 2] / 255, hs); if (garPurple(hs[0], hs[1], hs[2], .3)) n++; }
    return n > 40 ? 'tex' : null;   // (more than 1 % of the picture)
  }
  const c = m.color.getHSL({}, THREE.SRGBColorSpace); return garPurple(c.h, c.s, c.l, .25) ? 'col' : null;
}
// (v163, the user: "make it a lot more detailed, use Blender") the pit crew model: made in Blender by
// tools/blender/pit_crew.py — a detailed crew member on a 15-bone skeleton with looping actions (idle, walk,
// walk_carry, walk_jack, fuel, jack, kneel, look, cheer) and the props (fuel rig, nozzle, wheel gun, trolley jack with
// its saddle and handle, spare tyre). The file is parsed four times: four independent skinned figures.
// (v177, the user) the crew dress for the map: alps grey overalls, beach palm shirts and pink swim shorts, city neon
// overalls, mines miners with hard hats, space space suits (tools/blender/pit_crew.py <out> '' <outfit>)
BASE.crews = {}; const crewLoads = {};
function loadPitCrew(id = 'alps') { return crewLoads[id] || (crewLoads[id] = loadPitCrewFile(id)); }
async function loadPitCrewFile(id) {
  try {
    const buf = await (await fetch(`models/pit-crew-${id}.glb?v=2`)).arrayBuffer(), ld = new GLTFLoader();
    const parse = () => new Promise((ok, no) => ld.parse(buf.slice(0), 'models/', ok, no));
    const men = []; for (let i = 0; i < 4; i++) men.push(await parse());
    const props = {};
    for (const n of ['PropNozzle', 'PropGun', 'PropJack', 'PropJackPad', 'PropJackHandle', 'PropRig', 'PropTyre']) { const o = men[0].scene.getObjectByName(n); if (o) { o.removeFromParent(); o.position.set(0, 0, 0); o.traverse((q) => { if (q.isMesh) q.castShadow = true; }); props[n] = o; } }
    for (const gl of men) gl.scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => KEEP.add(m)); });
    for (const p of Object.values(props)) p.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => KEEP.add(m)); });
    BASE.crews[id] = { men, clips: men[0].animations, props }; if (id === 'alps') BASE.crew = BASE.crews.alps;
    console.log('pit crew: ' + men[0].animations.map((a) => a.name).join(', '));
  } catch (e) { console.warn('pit crew model missing; the simple crew stays', e); }
}
// (v179) one garage per map: the Alps keeps the user's Le Mans model; beach, city, mines and space have their own
// (made by the Fugio support worker in Blender, Foxino/3D Models/Pit Garages (Blender)/) to the same contract
BASE.garages = {};
async function loadPitGarage(id = 'alps') {
  try {
    const g = await new GLTFLoader().loadAsync(id === 'alps' ? 'models/pit-garage.glb?v=1' : `models/pit-garage-${id}.glb?v=1`); const root = g.scene; root.updateMatrixWorld(true);
    const inv = root.matrixWorld.clone().invert(), m4 = new THREE.Matrix4(), groups = new Map(), lights = [], extra = { panel: null };
    const widen = (geo) => {   // quantised (Int16/Int8) attributes → plain floats, so geometries can be merged
      const out = new THREE.BufferGeometry();
      for (const name of ['position', 'normal', 'uv']) { const a = geo.attributes[name]; if (!a) continue;
        const n = a.count, sz = a.itemSize, arr = new Float32Array(n * sz);
        for (let i = 0; i < n; i++) for (let k = 0; k < sz; k++) arr[i * sz + k] = a.getComponent(i, k);
        out.setAttribute(name, new THREE.BufferAttribute(arr, sz)); }
      if (geo.index) out.setIndex(geo.index.clone()); return out;
    };
    root.traverse((o) => {
      if (o.isLight) { lights.push(o); return; }
      if (!o.isMesh) return;
      if (o.name === 'NumberPanel') { o.updateMatrixWorld(true); extra.panel = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).applyMatrix4(inv); }
      m4.multiplyMatrices(inv, o.matrixWorld);
      let geo = widen(o.geometry); if (geo.index) geo = geo.toNonIndexed(); geo.applyMatrix4(m4); if (m4.determinant() < 0) flipWinding(geo);
      if (!geo.attributes.normal) geo.computeVertexNormals();
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      const m = o.material, structural = /^(Wall|Roof|Floor|Mezzanine|Ceiling)/.test(o.name);
      const key = m.uuid + (structural ? ':s' : '');
      if (!groups.has(key)) groups.set(key, { mat: m, structural, list: [] });
      groups.get(key).list.push(geo);
    });
    const parts = [];
    for (const { mat, structural, list } of groups.values()) {
      const geo = mergeGeometries(list, false); if (!geo) continue; geo.computeBoundingSphere();
      if (mat.isMeshStandardMaterial) { mat.envMapIntensity = .6; mat.fog = true; }
      parts.push({ geo, mat, structural, tint: garageTint(mat) });
    }
    BASE.garages[id] = { parts, lights: lights.map((l) => ({ color: l.color.clone(), intensity: l.intensity, distance: l.distance, pos: new THREE.Vector3().setFromMatrixPosition(l.matrixWorld).applyMatrix4(inv) })), panel: extra.panel || new THREE.Vector3(-.24, 3.25, 0) };
    if (id === 'alps') BASE.garage = BASE.garages.alps;
  } catch (e) { console.warn(`pit garage model (${id}) missing; the Alps one stands in`, e); if (id === 'alps') BASE.garage = null; }
}
// (v158, the user's own model) THE LED TYRE: kart/models/tyre-led.glb replaces the code-built wheels on every
// kart. Axle = local +X, the LED ring on the +X face (so the right-hand wheels are mirrored on X), 0.28 m across
// and 0.172 m wide; the kart's wheels are 0.43–0.45 m across, so it is scaled up per wheel to WHEEL_SIZE.
// It ships at 34 192 triangles — more than the whole kart — so two cheaper versions are made at load by
// VERTEX CLUSTERING (snap vertices to a grid, drop the triangles that collapse): a fine one for your kart,
// a coarse one for the rivals'. The LED ring's colour is the material's emissive, set to each kart's light.
function clusterGeo(src, cell) {
  if (!cell) return src;
  const g = src.index ? src.toNonIndexed() : src, P = g.attributes.position, U = g.attributes.uv, n = P.count;
  const map = new Map(), rep = new Int32Array(n), pos = [], uv = [], cnt = [];
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), k = `${Math.round(x / cell)},${Math.round(y / cell)},${Math.round(z / cell)}`;
    let j = map.get(k);
    if (j === undefined) { j = pos.length / 3; map.set(k, j); pos.push(x, y, z); uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0); cnt.push(1); }
    else { pos[j * 3] += x; pos[j * 3 + 1] += y; pos[j * 3 + 2] += z; cnt[j]++; }
    rep[i] = j;
  }
  for (let j = 0; j < cnt.length; j++) { pos[j * 3] /= cnt[j]; pos[j * 3 + 1] /= cnt[j]; pos[j * 3 + 2] /= cnt[j]; }
  const idx = [];
  for (let t = 0; t < n; t += 3) { const a = rep[t], b = rep[t + 1], c = rep[t + 2]; if (a !== b && b !== c && a !== c) idx.push(a, b, c); }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); out.setIndex(idx);
  out.computeVertexNormals(); out.computeBoundingSphere(); return out;
}
// grid cells (metres, on the 0.28 m tyre) per part, for the two versions; 0 = the part as it came
// measured: these give about 10 300 triangles a wheel for your kart and 2 900 for a rival's (the code-built
// wheel was 2 700), so twenty wheels cost about 87k — up from 54k, for a kart whose tyres are the user's own
const TYRE_CELLS = { hi: { Tyre_Rubber: .0105, Rim: .0065, LED_Strip: 0, Rim_Spokes: 0, Hub_Cap: 0, Lug_Nuts: 0 }, lo: { Tyre_Rubber: .024, Rim: .016, LED_Strip: .013, Rim_Spokes: .005, Hub_Cap: .005, Lug_Nuts: .008 } };
function buildTyreLods(src) {
  const lods = {};
  for (const lod of ['hi', 'lo']) {
    const g = new THREE.Group(); g.name = 'Spin'; let tris = 0;
    for (const m of src) { const geo = clusterGeo(m.geometry, TYRE_CELLS[lod][m.name] || 0); const mesh = new THREE.Mesh(geo, m.material); mesh.name = m.name; mesh.castShadow = true; g.add(mesh); tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3; }
    lods[lod] = g; lods[lod + 'Tris'] = tris;
  }
  return lods;
}
async function loadTyre(hi = false) {
  try {
    const g = await gltf(hi ? 'models/tyre-led.glb?v=1' : lowGLB('tyre-led')); g.scene.updateMatrixWorld(true);
    const src = []; g.scene.traverse((o) => { if (o.isMesh) { o.geometry.applyMatrix4(o.matrixWorld); o.material.envMapIntensity = .8; src.push(o); } });
    if (!src.find((m) => m.name === 'LED_Strip')) throw new Error('no LED_Strip in the tyre');
    BASE.tyreSrc = src; BASE.tyre = buildTyreLods(src);
    console.log(`tyre: ${BASE.tyre.hiTris} / ${BASE.tyre.loTris} triangles a wheel (hi / lo)`);
  } catch (e) { console.warn('tyre model missing; the code-built wheels stay', e); if (!hi) BASE.tyre = null; }
}
// one LED material per light colour and one spoke material per body colour, shared by every wheel of that colour
const tyreMats = new Map();
function tyreMat(kind, colour) {
  const key = kind + colour; if (tyreMats.has(key)) return tyreMats.get(key);
  const base = BASE.tyreSrc.find((m) => m.name === (kind === 'led' ? 'LED_Strip' : 'Rim_Spokes')).material, m = base.clone();
  if (kind === 'led') { m.emissive.set(colour); m.emissiveIntensity = 1.6; m.color.set(colour).multiplyScalar(.45); m.toneMapped = true; }
  else m.color.set(colour);
  tyreMats.set(key, m); return m;
}
// a wheel from the tyre model, scaled to the kart's wheel size and mirrored for the right-hand side
// (v166) the tyre styles a TYRE CRATE can give (Classic is everyone's; the others recolour the LED tyre)
const TYRE_STYLES = [
  { id: 'classic', name: 'Classic', rar: 'common' },
  // (v193, the user) only the artifact's tyres: the original LED tyre above and the six designs (the colour versions are gone)
  // (v186, the user) the six LED tyre designs from the "FoxKarts LED Tyres" artifact, made low-poly in Blender
  // (tools/blender/tyres_lowpoly.py -> models/tyre-<id>-lp.glb, 4–6k triangles a wheel, down from 10–19k); their own
  // colours stay, the LEDs glow in your kart's light colour
  { id: 'd-steelie', name: 'Retro Steelie', rar: 'rare', model: 'steelie' },
  { id: 'd-mesh', name: 'Classic Mesh', rar: 'rare', model: 'mesh' },
  { id: 'd-mudclaw', name: 'Mud Claw', rar: 'rare', model: 'mudclaw' },
  { id: 'd-solar', name: 'Solar Disc', rar: 'epic', model: 'solar' },
  { id: 'd-turbine', name: 'Turbine', rar: 'epic', model: 'turbine' },
  { id: 'd-starsplit', name: 'Star Split', rar: 'legendary', model: 'starsplit' },
  // (v274) the two new tyres for the nine tyre levels (same 0.28 × 0.18 m envelope, LED_* parts glow in your light colour)
  { id: 'd-vortex', name: 'Vortex', rar: 'epic', model: 'vortex' },
  { id: 'd-hexcore', name: 'Hex Core', rar: 'legendary', model: 'hexcore' },
];
// (v186, the user: no more crates) everything a crate used to give is bought with coins, by rarity
const RARITY_COST = { common: 0, uncommon: 80, rare: 150, epic: 250, legendary: 400 };
const PAINT_COST = { common: 50, uncommon: 80, rare: 120, epic: 180, legendary: 250 };
// a design tyre's model, loaded the first time it is needed: one 'Spin' group with every part in tyre space
BASE.tyreModels = {}; const tyreModelLoads = {};
function loadTyreModel(id) {
  return tyreModelLoads[id] || (tyreModelLoads[id] = new GLTFLoader().loadAsync(`models/tyre-${id}-lp.glb?v=1`).then((g) => {
    g.scene.updateMatrixWorld(true); const sp = new THREE.Group(); sp.name = 'Spin'; const parts = []; g.scene.traverse((o) => { if (o.isMesh) parts.push(o); });
    for (const o of parts) { const m = new THREE.Mesh(o.geometry.clone().applyMatrix4(o.matrixWorld), o.material); m.name = o.name; m.castShadow = true; o.material.envMapIntensity = .8; sp.add(m); }
    BASE.tyreModels[id] = sp; return sp;
  }).catch((e) => { console.warn('tyre design did not load', id, e); return null; }));
}
// its LEDs in a light colour (one material per original LED material and colour)
const designLedMats = new Map();
function designLed(mat, colour) {
  const key = mat.uuid + colour; if (designLedMats.has(key)) return designLedMats.get(key);
  const m = mat.clone(); m.emissive.set(colour); m.emissiveIntensity = 1.6; m.color.set(colour).multiplyScalar(.45);
  designLedMats.set(key, m); KEEP.add(m); return m;
}
const TYRE_BY_ID = Object.fromEntries(TYRE_STYLES.map((t) => [t.id, t]));
// (v166) a tyre style recolours the parts of the tyre: rubber, rim, spokes, hub cap, nuts and the LED ring
const tyreMats2 = new Map();
function tyrePartMat(name, colour, metal) {
  const key = name + colour + (metal ? 'm' : ''); if (tyreMats2.has(key)) return tyreMats2.get(key);
  const src = BASE.tyreSrc.find((m) => m.name === name); if (!src) return null; const m = src.material.clone();
  if (name === 'LED_Strip') { m.emissive.set(colour); m.emissiveIntensity = 1.6; m.color.set(colour).multiplyScalar(.45); } else { m.color.set(colour); if (metal) { m.metalness = .9; m.roughness = .22; } }
  tyreMats2.set(key, m); KEEP.add(m); return m;
}
function tyreWheel(r, w, side, skin, lod) {
  const st0 = TYRE_BY_ID[skin.tyre] || {};
  if (st0.model) {   // (v186) a design tyre: 0.28 m across, 0.18 m wide, axle +X like the classic one
    const src = BASE.tyreModels[st0.model];
    if (src) { const g = src.clone(); g.traverse((o) => { if (o.isMesh && /^LED/.test(o.name)) o.material = designLed(o.material, skin.light); }); g.scale.set(side * w / .18, r / .14, r / .14); return g; }
    loadTyreModel(st0.model).then((m) => { if (m && SHOW.racer && screen !== 'race') setShowRacer(); });   // (the classic wheel until it arrives)
  }
  const g = BASE.tyre[lod].clone(), st = st0.model ? {} : st0;
  g.traverse((o) => { if (!o.isMesh) return; const c = { LED_Strip: st.led || skin.light, Rim_Spokes: st.spokes || skin.body, Rim: st.rim, Tyre_Rubber: st.rubber, Hub_Cap: st.hub }[o.name]; const m = c && tyrePartMat(o.name, c, st.metal && o.name !== 'LED_Strip' && o.name !== 'Tyre_Rubber'); if (m) o.material = m; });
  g.scale.set(side * w / .172, r / .141, r / .141);
  return g;
}
/* (2026-11-13, the user: "try replacing the chalets … blend it into the environment and place it so it can be seen
   partly on the menu") the Alps chalets are the Tripo snowy chalet (green shutters, its own snowy yard, fences and
   bushes), cut from 1.86 M triangles to 12k (models/chalet-alps.glb: the menu) and 6k (chalet-alps-lp.glb: the ~24 on the
   track) in Blender. The source is in Foxino/3D Models/Tripo Library/Snowy Chalet. If it can't load, the shape-built
   chalets stay. CHALET_S: model units -> metres (the house about as tall as the old one, the yard round it). */
const CHALET_S = 20;
async function loadChalet() {
  const one = async (url, k = CHALET_S) => { const g = await gltf(url, 20000); g.scene.updateMatrixWorld(true); let m = null; g.scene.traverse((o) => { if (o.isMesh && !m) m = o; });
    const geo = m.geometry.clone().applyMatrix4(m.matrixWorld).scale(k, k, k); const mat = m.material; mat.envMapIntensity = .8; if (mat.map) mat.map.anisotropy = 4; return { geo, mat }; };
  // (v307, the user: "forget it, go back to the first house before the things with Tripo") the Tripo chalet is off: the
  // shape-built chalets are back on the track and the menu (BASE.chalet / BASE.chaletLP stay unset, so every chalet branch falls back)
  // (2026-11-13, the user: "also back mountains and clouds") the Tripo snowy rock peak (alps-peak.glb, 3k triangles) for the
  // ring of far mountains and the Tripo puffy cloud (alps-cloud.glb, 1.5k) for the Alps sky, both in model units (instances scale them)
  try { BASE.alpsCloud = await one('models/alps-cloud.glb?v=1', 1); const c = BASE.alpsCloud.mat; c.emissive = new THREE.Color('#ffffff'); c.emissiveIntensity = .22; c.emissiveMap = c.map; }
  catch (e) { console.warn('Alps cloud model did not load; the shape-built clouds stay', e); }
  /* (v308, the user: "make the back mountains more into the nature and less tall, make them look like the Alps, put some
     trees there") three low-poly Alpine mountains modelled in Blender on the Windows PC (forests of snowy firs, meadows,
     grey rock, snow on the top third; vertex colours, 3.9k triangles each, ~1 wide x 0.36 tall in model units) */
  try { BASE.alpsMtns = await Promise.all([1, 2, 3].map((n) => one(`models/alps-mountain-${n}.glb?v=1`, 1)));
    for (const m of BASE.alpsMtns) { m.mat.vertexColors = true; m.mat.flatShading = true; m.mat.roughness = .95; m.mat.metalness = 0; m.mat.envMapIntensity = .5; m.mat.side = THREE.FrontSide; m.mat.needsUpdate = true; } }
  catch (e) { console.warn('Alps mountain models did not load; the shape-built ones stay', e); }
}
// the menu's chalet: the Tripo one in place of the shape-built one (SHOW.chalet is the group the menu moves for portrait / landscape)
function dressLobbyChalet() {
  const g = SHOW.chalet; if (!g || !BASE.chalet || g.userData.tripo) return;
  g.clear(); const m = new THREE.Mesh(BASE.chalet.geo, BASE.chalet.mat); m.rotation.y = CHALET_FACE; m.castShadow = true; m.receiveShadow = true; g.add(m); g.userData.tripo = true;
}
const CHALET_FACE = 0;   // (the model's front, turned to face the same way as the old chalet's)
/* (v308, the user: "improve the kart, put some carbon fibre white details on the kart") add-on parts modelled in Blender on the
   Windows PC in kart-default.glb's own space (kart-details.glb: carbon splitter, sills, intake frames, diffuser; white
   number boards, pod stripes, nose stripe, seat trim). The kart itself is unchanged; the carbon is the shared twill. */
let kartDetailsLoad = null;
function addKartDetails(k) {
  if (!k) return;
  if (!kartDetailsLoad) kartDetailsLoad = gltf('models/kart-details.glb?v=1', 15000).then((g) => {
    const white = new THREE.MeshPhysicalMaterial({ color: '#f2f4f8', roughness: .35, metalness: .05, clearcoat: .6, clearcoatRoughness: .2, side: THREE.DoubleSide });
    g.scene.traverse((o) => { if (o.isMesh) { o.material = carbonMat(THREE); o.castShadow = true; } });   /* (v310, the user: "make the white carbon fibre black") every detail part is black carbon now, the white ones too */
    g.scene.name = 'KartDetails'; return g.scene;
  }).catch((e) => { console.warn('kart details did not load', e); return null; });
  return kartDetailsLoad.then((d) => { if (d && !k.getObjectByName('KartDetails')) k.add(d.clone(true)); });
}
const LDP = { on: null };   // (v266) the loading screen's progress inside the model loading
async function loadFoxino() {
  const P = (f) => { if (LDP.on) LDP.on(f); };
  let done = 0; const tick = () => P(++done / 4 * .95);   // (v277: all at once, not one after another, so one slow file costs only its own time)
  await Promise.all([loadKart().then(tick), loadOfficial().then(tick), giveUp(loadPitGarage('alps')).catch((e) => console.warn(e)).then(tick), loadTyre().then(tick), loadChalet()]);   // (the garage screen uses the Alps one)
  { const t = TYRE_BY_ID[(save.kart && save.kart.skin || {}).tyre]; if (t && t.model) await giveUp(loadTyreModel(t.model), 8000).catch((e) => console.warn(e)); }   // (v186) your design tyre, before the first race
  // (v266, the user: slow devices sat on the loading screen) what only the races need — the cave's crystals and
  // stalagmites, the other four maps' pit garages (about 6 MB) — now downloads behind the menu; a race waits for it
  BASE.later = Promise.all([loadCrystals(), loadStalagmites(), ...['beach', 'city', 'mines', 'space'].map((id) => loadPitGarage(id))]).catch((e) => console.warn(e)).then(() => { BASE.laterDone = true; });
  loadPitCrew();   // (v163) the Blender pit crew: not waited for, the stops come much later
  if (BASE.off && BASE.off.foxino) return;   // the official Foxino is in; the old Higgsfield one stays only as a fallback
  try {
    const g = await gltf('foxino-seated.glb?v=1', 10000); g.scene.updateMatrixWorld(true);
    g.scene.traverse((o) => { if (o.isMesh) BASE.hf = o; });
    if (BASE.hf) { const m = BASE.hf.material; m.envMapIntensity = .9; if (m.metalnessMap) { m.metalness = .6; } }
  } catch (e) { console.warn('Foxino model did not load; using the shape-built one', e); }
}
// (v277) once the menu is up: the screen goes to its full sharpness and the full-size models replace the small ones, one at a time and never during a race.
// A phone set to Low graphics stays on the small ones.
async function upgradeAssets() {
  BOOT_LOW = false; renderer.setPixelRatio(pixelRatioFor(+save.lowq || 0)); resize();
  if (gfxOf(save) === 'low') return;
  const calm = async () => { while (screen === 'race' || document.hidden) await wait(1500); };
  await calm(); await loadOfficial(true); await calm(); await loadKart(true); await calm(); await loadTyre(true);
  driverCache.clear(); kartCache.clear(); BASE.hires = true; await calm();
  try { setShowRacer(); renderFaces(); } catch (e) { console.warn(e); }
}
function buildBase() {
  setDetail(.3, .45);
  BASE.foxPos = HF_PIVOT; BASE.foxRot = new THREE.Euler(0, 0, 0);
  BASE.kart = buildKart();
  // parts that move on their own: the four wheels and the steering wheel
  const k = BASE.kart, names = ['WheelFrontLeft', 'WheelFrontRight', 'WheelRearLeft', 'WheelRearRight'];
  BASE.wheels = names.map((n) => { const w = k.getObjectByName(n); return { front: n.includes('Front'), pos: w.position.clone(), g: bake(w), obj: w }; });
  const sw = k.getObjectByName('SteeringWheel'); BASE.steer = { pos: sw.position.clone(), rot: sw.rotation.clone(), g: bake(sw), obj: sw };
}
const PLASTIC = new THREE.Color('#66707c'), PLASTIC_D = new THREE.Color('#4e555f'), PANEL = new THREE.Color('#525a66');
const near = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < .01;
const kartCache = new Map(), driverCache = new Map();
function kartBody(color) {
  if (kartCache.has(color)) return kartCache.get(color);
  const paint = new THREE.Color(color).multiplyScalar(.78), tint = (c) => near(c, PLASTIC) ? paint.clone() : near(c, PLASTIC_D) ? paint.clone().multiplyScalar(.62) : near(c, PANEL) ? paint.clone().multiplyScalar(.8) : c;
  for (const w of BASE.wheels) w.obj.visible = false; BASE.steer.obj.visible = false;
  const g = bake(BASE.kart, { tint });
  for (const w of BASE.wheels) w.obj.visible = true; BASE.steer.obj.visible = true;
  kartCache.set(color, g); return g;
}
// the helmet's look follows the kart's (main = body colour, lights and logo = the kart's)
// (v184) THE STARSHIP. Faces +Z, floor at y 0, 2.74 m across the wings; drawn at 85 % (the grid is 2.8 m wide a car) and
// floating a little above the road. Its paint follows a look: M_Body_Primary = the body colour, M_Body_Accent and every
// light (M_LED, the four thrusters and their glow, the seat logo, the tail engine) = the light colour. The yoke's parts
// are gathered into one group that turns about its column, like the kart's steering wheel.
const SHIP_S = .85, SHIP_LIFT = .2, SHIP_YOKE = new THREE.Vector3(0, .8, .03), SHIP_AXIS = new THREE.Vector3(0, .3, 1).normalize(), SHIP_SEAT = new THREE.Vector3(0, .07, .04);
const SHIP_LIT = { M_LED: 1.4, M_Thruster: .6, M_Thruster_Glow: .5, M_Seat_Logo: .8, M_Engine_Glow: 1.2 };
function prepShip(g) {
  const yoke = new THREE.Group(); yoke.name = 'Yoke'; yoke.position.copy(SHIP_YOKE);
  const parts = []; g.traverse((o) => { if (o.isMesh && /^Yoke_/.test(o.name)) parts.push(o); });
  for (const o of parts) { o.removeFromParent(); o.position.sub(SHIP_YOKE); yoke.add(o); }
  g.add(yoke);
  g.traverse((o) => { if (!o.isMesh) return; o.castShadow = true; const m = o.material; if (m && m.name === 'M_Thruster_Glow') { m.transparent = true; m.depthWrite = false; } });
}
const shipMats = new Map();
function dressShip(g, look) {
  const key = look.body + look.light; if (!shipMats.has(key)) shipMats.set(key, {});
  const M = shipMats.get(key);
  g.traverse((o) => {
    if (!o.isMesh || !o.material) return; const n = o.material.name;
    if (n !== 'M_Body_Primary' && n !== 'M_Body_Accent' && !(n in SHIP_LIT)) return;
    if (!M[n]) {
      const c = o.material.clone(); c.name = n;
      if (n === 'M_Body_Primary') { c.color.set(look.body); if (metalOf(look.body)) makeMetal(THREE, c, look.body); } else if (n === 'M_Body_Accent') c.color.set(look.light);
      else { c.color.set(n === 'M_Thruster_Glow' ? look.light : '#ffffff'); c.emissive.set(look.light); c.emissiveIntensity = SHIP_LIT[n]; }
      M[n] = c;
    }
    o.material = M[n];
  });
  return g;
}
// your starship's look: the kart's colours until you paint the starship on its own in the garage
const shipSkin = () => ({ ...DEFAULT_SKIN, ...(save.kart.skin || {}), ...(save.kart.ship || {}) });
const helmetLook = (skin) => { const s = { ...DEFAULT_SKIN, ...(skin || {}) }; return { ...DEFAULT_HELMET, main: s.body, light: s.light, logo: s.logo, logoColor: s.logoColor || s.light }; };
/* (v209, the user: "make the hands of the character hold the wheel — you should see they are holding it") the baked
   drivers have their hands on the rim at 10 and 2, but the wheel turns up to ±0.9 rad and the hands stayed put, so the
   wheel spun out of them. Now every hand turns WITH the rim: four morph targets (the wheel at −0.9, −0.45, +0.45, +0.9)
   rotate each vertex about the wheel's own axis by the turn × its weight — 1 on the hand at the rim, fading to 0 up the
   forearm — so the arms bend smoothly and nothing comes apart. (Between the targets the blend is piecewise linear.) */
const GRIP_A = [-.52, -.26, .26, .52];   // (the wheel turns at most ±0.52 rad ≈ 30° on screen)
function wheelInKart() {
  if (BASE.wheelK) return BASE.wheelK;
  if (!BASE.dk || !BASE.steerAxis) return null;   // (not cached: the kart may still be loading)
  const disc = BASE.dk.nodes.SteeringWheel.children[0]; BASE.dk.updateMatrixWorld(true);
  if (!disc.geometry.boundingBox) disc.geometry.computeBoundingBox();
  const bb = disc.geometry.boundingBox, c = bb.getCenter(new THREE.Vector3()).applyMatrix4(disc.matrixWorld), q = disc.getWorldQuaternion(new THREE.Quaternion());
  const a = BASE.steerAxis.clone().applyQuaternion(q).normalize(), sz = bb.getSize(new THREE.Vector3()).multiply(disc.getWorldScale(new THREE.Vector3()));
  // (v281) the rim itself: its outer radius and the thickness of the tube, so the fingers can bend round it
  const P = disc.geometry.attributes.position, v = new THREE.Vector3(), rh = [];
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(disc.matrixWorld).sub(c); const h = v.dot(a); rh.push([v.addScaledVector(a, -h).length(), h]); }
  const Rmax = Math.max(...rh.map((x) => x[0])), rim = rh.filter((x) => x[0] > Rmax - .05);
  const tr = clamp(Math.max(...rim.map((x) => Math.abs(x[1]))), .012, .06);
  return (BASE.wheelK = { c, a, R: Math.max(sz.x, sz.y, sz.z) / 2 - .03, Rc: Rmax - tr, tr });
}
/* (v297, the user: "his hands — don't make up a new model of fingers, make it as similar to the real model; don't do the
   others for now") Foxino's own paw holds the rim: his fingers, which stuck straight out past the rim, are bent round it
   (a bend about the rim's tube: each point past the top of the rim turns by the distance it has gone over the radius),
   sitting on the rim's surface. Same mesh, same texture. Only Foxino for now; the others keep their pose as it was. */
const GRIP_BEND = { foxino: { lift: .016, maxPhi: 2.4 } };
function gripWheel(geo, fit, mt, S, id) {
  const B = GRIP_BEND[id], W = wheelInKart(); if (!B || !W || !BASE.seatShift || (window.FK && window.FK.gripOff) || /[?&]grip=0/.test(location.search)) return geo;   // (FK.gripOff / ?grip=0: test switches, the paws as they were)
  const P = geo.attributes.position, NA = geo.attributes.normal, n = P.count, seat = new THREE.Vector3(...fit.seat).add(BASE.seatShift), hips = new THREE.Vector3(...mt.hips);
  const toK = (v) => v.clone().sub(hips).multiplyScalar(S).add(seat), toM = (k) => k.sub(seat).multiplyScalar(1 / S).add(hips);
  const up = new THREE.Vector3(0, 1, 0), nd = W.a.clone().multiplyScalar(Math.sign(W.a.dot(seat.clone().sub(W.c))) || 1);   // (nd: from the wheel towards the driver)
  const e2 = up.clone().addScaledVector(W.a, -up.dot(W.a)).normalize(), e1 = new THREE.Vector3().crossVectors(e2, W.a).normalize();
  const K = [], rel = new THREE.Vector3(), v = new THREE.Vector3(), Q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) K.push(toK(v.fromBufferAttribute(P, i)));
  const rimD = (k) => { rel.copy(k).sub(W.c); const h = rel.dot(W.a), r = rel.addScaledVector(W.a, -h).length(); return Math.hypot(r - W.Rc, h); };
  let bent = 0;
  for (const s of [-1, 1]) {
    // the paw: the points close to the rim on this side; G = the rim under it
    const core = []; for (let i = 0; i < n; i++) { const k = K[i]; if (k.y > W.c.y - .07 && rimD(k) < .07 && Math.sign(rel.copy(k).sub(W.c).dot(e1)) === s) core.push(i); }
    if (core.length < 20) continue;
    const u = new THREE.Vector3(); for (const i of core) u.add(rel.copy(K[i]).sub(W.c)); u.addScaledVector(W.a, -u.dot(W.a)).normalize();
    const G = W.c.clone().addScaledVector(u, W.Rc), nn = nd.clone().addScaledVector(u, -nd.dot(u)).normalize(), t = new THREE.Vector3().crossVectors(u, nn);
    // the forearm comes from the driver's side, above the grip; the fingers point the other way, across the rim
    const fa = new THREE.Vector3(); for (let i = 0; i < n; i++) { const d = rel.copy(K[i]).sub(G), dd = d.length(); if (dd > .16 && dd < .26 && d.dot(nn) > .06 && K[i].y > G.y - .05) fa.add(d.normalize()); }
    if (fa.lengthSq() < 1e-6) continue; fa.normalize();
    const dir = fa.clone().negate().addScaledVector(t, fa.dot(t)).normalize(), perp = new THREE.Vector3().crossVectors(t, dir).normalize(), axis = t.clone().negate();
    const ys = []; for (let i = 0; i < n; i++) { const d = rel.copy(K[i]).sub(G); if (d.length() > .3) continue; const x = d.dot(dir), y = d.dot(perp); if (x > .02 && y > -.03) ys.push(y); }
    if (ys.length < 20) continue; ys.sort((p, q) => p - q); const rho = ys[ys.length >> 1];
    for (let i = 0; i < n; i++) {
      const d = rel.copy(K[i]).sub(G); if (d.length() > .3) continue;
      const x = d.dot(dir), y = d.dot(perp), z = d.dot(t); if (x <= 0 || y <= -.03) continue;
      const a = x / rho, phi = Math.min(B.maxPhi, a); Q.setFromAxisAngle(axis, phi);
      const k = G.clone().addScaledVector(t, z).add(perp.clone().multiplyScalar(y + B.lift * Math.min(1, x / .03)).applyQuaternion(Q));
      if (a > B.maxPhi) k.add(dir.clone().applyQuaternion(Q).multiplyScalar((a - B.maxPhi) * rho));   // (beyond the curl: straight on)
      K[i].copy(k); bent++;
      if (NA) { v.fromBufferAttribute(NA, i).applyQuaternion(Q); NA.setXYZ(i, v.x, v.y, v.z); }   // (the scale is uniform: model-space normals turn the same way)
    }
  }
  if (!bent) return geo;
  for (let i = 0; i < n; i++) { v.copy(K[i]); toM(v); P.setXYZ(i, v.x, v.y, v.z); }
  // (v209) the paws turn with the wheel: weight 1 at the rim, fading to 0 up the forearm
  const w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = K[i].y > W.c.y - .07 ? 1 - smoothstep(.06, .15, rimD(K[i])) : 0;
  geo.morphAttributes.position = GRIP_A.map((ang) => {
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(P, i);
      if (w[i] > 0) { const k = toK(v).sub(W.c); Q.setFromAxisAngle(W.a, ang * w[i]); k.applyQuaternion(Q).add(W.c); v.copy(toM(k)); }
      arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
    }
    return new THREE.Float32BufferAttribute(arr, 3);
  });
  geo.morphTargetsRelative = false; P.needsUpdate = true; if (NA) NA.needsUpdate = true; geo.computeBoundingSphere(); geo.computeBoundingBox();
  return geo;
}
// the wheel's turn → the four morph weights (piecewise between the targets)
function gripTurn(mesh, a) {
  const I = mesh.morphTargetInfluences; if (!I) return; const M = GRIP_A[3], H = M / 2; a = clamp(a, -M, M); I.fill(0);
  if (a >= 0) { if (a <= H) I[2] = a / H; else { const t = (a - H) / H; I[2] = 1 - t; I[3] = t; } }
  else { const b = -a; if (b <= H) I[1] = b / H; else { const t = (b - H) / H; I[1] = 1 - t; I[0] = t; } }
}
/* (2026-11-13, the user: the AI rivals become the racing driver — "make sure everything fits, the hands are on the
   steering wheel") the Tripo racing driver (models/racing-driver.glb) is posed once in the default kart by
   rival-driver.js — legs to the pedals, arms solved onto the rim at 10 and 2 — and baked; the hands get the same four
   wheel-turn morphs as Foxino's paws. Each rival wears the suit in its own colour. Your own racer and the menu faces stay
   the characters. */
const RIVAL_FIT = { s: 1.85, seat: [0, .17, -.06] };
function addTurnMorphs(geo, toK, toM, W) {
  const P = geo.attributes.position, n = P.count, v = new THREE.Vector3(), Q = new THREE.Quaternion(), rel = new THREE.Vector3();
  const rimD = (k) => { rel.copy(k).sub(W.c); const h = rel.dot(W.a), r = rel.addScaledVector(W.a, -h).length(); return Math.hypot(r - W.Rc, h); };
  const w = new Float32Array(n); for (let i = 0; i < n; i++) { const k = toK(v.fromBufferAttribute(P, i)); w[i] = k.y > W.c.y - .07 ? 1 - smoothstep(.06, .15, rimD(k)) : 0; }
  geo.morphAttributes.position = GRIP_A.map((ang) => {
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(P, i);
      if (w[i] > 0) { const k = toK(v).sub(W.c); Q.setFromAxisAngle(W.a, ang * w[i]); k.applyQuaternion(Q).add(W.c); v.copy(toM(k)); }
      arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
    }
    return new THREE.Float32BufferAttribute(arr, 3);
  });
  geo.morphTargetsRelative = false;
  return geo;
}
function rivalBaked() {
  if (BASE.rivalBaked) return BASE.rivalBaked;
  const W = wheelInKart(); if (!BASE.rivalSrc || !W || !BASE.seatShift) return null;
  const seat = new THREE.Vector3(...RIVAL_FIT.seat).add(BASE.seatShift);
  const r = bakeSeatedDriver(BASE.rivalSrc, { S: RIVAL_FIT.s, seat, W, pose: RIVAL_FIT.pose });
  addTurnMorphs(r.geo, r.toK, r.toM, W);
  return (BASE.rivalBaked = r);
}
/* (v309, the user: "create Foxino, the main kart driver, through Tripo AI: one model, normal T-shirt and shorts, just a
   helmet with carbon fibre white details, a main colour that can be chosen, dark visor"; then "no ears on the helmet, the
   tail as in the picture") models/foxino-driver.glb: the Tripo model (Mixamo rig), seated by rival-driver.js like the
   rivals, paws on the rim at 10 and 2 turning with the wheel. The helmet's flat blue is repainted to the kart's body
   colour (the colour you choose in the garage). */
const FOX_FIT = { s: 1.5, seat: [0, .17, .08], pose: { dropFeet: false, hunch: .55, headScale: .5, dropTail: .15, palmGap: -.025, palmBack: 0, curl: [1.3, 1.2, 1], thumb: .9 } };   /* (v312, the user: helmet twice smaller, no tail, Foxino smaller, hands round the wheel) */
function foxBaked() {
  if (BASE.foxBaked) return BASE.foxBaked;
  const W = wheelInKart(); if (!BASE.foxDrvSrc || !W || !BASE.seatShift) return null;
  const seat = new THREE.Vector3(...FOX_FIT.seat).add(BASE.seatShift);
  const r = bakeSeatedDriver(BASE.foxDrvSrc, { S: FOX_FIT.s, seat, W, pose: FOX_FIT.pose });
  addTurnMorphs(r.geo, r.toK, r.toM, W);
  return (BASE.foxBaked = r);
}
function driverBody(ch, skin, rival = false) {
  const R = rival && BASE.rivalSrc ? rivalBaked() : null, F = !rival && ch.id === 'foxino' && BASE.foxDrvSrc ? foxBaked() : null;
  const look = helmetLook(skin), key = ch.id + '|' + look.main + look.light + look.logo + (R ? '|R' : '') + (F ? '|F' : '');
  if (driverCache.has(key)) return driverCache.get(key);
  let g;
  // every driver is a group that sits at HF_PIVOT in the kart (so they all lean round the same point)
  g = new THREE.Group();
  if (F) {
    // (v309) the player's Foxino: the Tripo driver, seated, his helmet in the chosen colour
    const mat = new THREE.MeshStandardMaterial({ map: F.map ? helmetPaint(F.map, look.main) : null, roughness: .7, metalness: 0, envMapIntensity: .8 });
    const body = new THREE.Mesh(F.geo, mat); body.castShadow = true; body.scale.setScalar(F.S); body.frustumCulled = false;
    body.position.set(FOX_FIT.seat[0] - F.hips.x * F.S, FOX_FIT.seat[1] - F.hips.y * F.S, FOX_FIT.seat[2] - F.hips.z * F.S);
    body.updateMorphTargets();
    const b = new THREE.Group(); b.add(body); b.position.sub(HF_PIVOT); g.add(b);
  } else if (R) {
    // a rival: the racing driver, already sitting with his gloves on the rim, the suit in the rival's colour
    const mat = new THREE.MeshStandardMaterial({ map: R.map ? rivalSuit(R.map, css(ch.color)) : null, roughness: .75, metalness: 0, envMapIntensity: .8 });
    const body = new THREE.Mesh(R.geo, mat); body.castShadow = true; body.scale.setScalar(R.S); body.frustumCulled = false;
    body.position.set(RIVAL_FIT.seat[0] - R.hips.x * R.S, RIVAL_FIT.seat[1] - R.hips.y * R.S, RIVAL_FIT.seat[2] - R.hips.z * R.S);
    body.updateMorphTargets();
    const b = new THREE.Group(); b.add(body); b.position.sub(HF_PIVOT); g.add(b);
  } else if (BASE.off && BASE.off[ch.id] && CHAR_FIT[ch.id]) {
    // an official character: scaled, its hips on the seat, its own ears / antenna cut away under a colour-matched helmet
    const fit = CHAR_FIT[ch.id], mt = OFFICIAL[ch.id], src = BASE.off[ch.id], S = fit.s;
    // the whole head comes off at the neck (the helmet is closed underneath): nothing of the face can show
    const body = new THREE.Mesh(clipAbove(src.geometry, mt.neck[1] - .01, mt.neck[2] - .02), src.material); body.castShadow = true; body.scale.setScalar(S);
    body.geometry = gripWheel(body.geometry, fit, mt, S, ch.id); body.updateMorphTargets();   // (v209) the hands turn with the steering wheel
    body.position.set(fit.seat[0] - mt.hips[0] * S, fit.seat[1] - mt.hips[1] * S, fit.seat[2] - mt.hips[2] * S);
    const H = fit.helm; let hm;
    if (BASE.helmet) { hm = BASE.helmet.clone(); dressHelmet(THREE, hm, look); hm.traverse((o) => { if (o.isMesh) o.castShadow = true; }); }
    else hm = bake(buildHelmet({ main: H.main, accent: H.accent, earHoles: false, ears: !!H.ears, earScale: .6, antenna: !!H.antenna, blackVisor: true, closed: true }));
    hm.scale.setScalar(H.r / .3);
    hm.position.set(body.position.x + mt.neck[0] * S, body.position.y + mt.neck[1] * S + H.r * .78 + H.dy, body.position.z + mt.neck[2] * S + H.dz);   // the helmet sits on the neck
    const b = new THREE.Group(); b.add(body, hm); b.position.sub(HF_PIVOT); g.add(b);
  } else if (ch.id === 'foxino' && BASE.hf) {
    const src = BASE.hf, mesh = new THREE.Mesh(src.geometry, src.material); mesh.castShadow = true;
    src.updateMatrixWorld(true); mesh.applyMatrix4(src.matrixWorld); mesh.position.sub(HF_PIVOT); g.add(mesh);
  } else if (BUILDERS[ch.id]) {
    const b = bake(BUILDERS[ch.id]()); b.position.sub(HF_PIVOT); g.add(b);
  } else {
    if (!BASE.fox) { setDetail(.3, .45); BASE.fox = buildFoxino(); seatFoxino(BASE.fox); }
    const b = bake(BASE.fox, { tint: (c) => hueColor(c, ch.hue), tex: (t) => hueTex(t, ch.hue) });
    b.position.set(0, -.17, -.3).sub(HF_PIVOT); b.rotation.x = -.1; g.add(b);
  }
  driverCache.set(key, g); return g;
}
const STICK_MAT = {}, STICK_GEO = {};
function stickerMat(id) { return STICK_MAT[id] || (STICK_MAT[id] = new THREE.MeshStandardMaterial({ map: stickerTex[id], transparent: true, roughness: .4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })); }
// a complete racer: kart (with spinning wheels, a turning steering wheel and a sticker) and its driver
// a rival's look on the default kart: its own colour, a light colour of its own, its sticker as the LED logo
const RIVAL_LIGHT = { foxino: '#ffa424', stella: '#7af8ff', pix: '#9cff3a', gummy: '#ff5db1', rob: '#b77aff' }, RIVAL_LOGO = { star: 'star', bolt: 'bolt', heart: 'heart', stripes: 'paw' };
function skinFor(ch, player, over) {
  if (over) return { ...DEFAULT_SKIN, ...over };
  if (player) return { ...DEFAULT_SKIN, ...(save.kart.skin || {}) };
  const light = RIVAL_LIGHT[ch.id] || '#ffa424';
  return { body: css(ch.color), light, logo: ch.id === 'foxino' ? 'fox' : RIVAL_LOGO[ch.sticker] || 'none', logoColor: light };
}
function makeRacerModel(ch, kartColor, sticker, player = false, skinOver = null, ship = false) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  if (ship && BASE.ship && BASE.dk) {
    // (v184) on Star Loop everyone flies the starship: your own paint, or each rival's colours
    const look = player && !skinOver ? shipSkin() : skinFor(ch, player, skinOver);
    const hover = new THREE.Group(); hover.position.y = SHIP_LIFT; hover.scale.setScalar(SHIP_S); body.add(hover);
    const k = dressShip(BASE.ship.clone(true), look); hover.add(k);
    let driver;
    if (ch.id === 'foxino' && BASE.foxSuit) {
      // (v187, the user via the support worker) Foxino flies in his space suit: the posed driver (hands on the yoke grips,
      // reclined 22°) is already in starship space; a pivot at his hips lets him lean into the bends
      driver = new THREE.Group(); driver.position.set(0, .7, -.3); const m = BASE.foxSuit.clone(true); m.position.set(0, -.7, .3); driver.add(m);
    } else { driver = driverBody(ch, look, !player && !skinOver).clone(); driver.position.copy(BASE.foxPos).add(BASE.seatShift).add(SHIP_SEAT); driver.rotation.copy(BASE.foxRot); }
    hover.add(driver);
    return { root, body, steer: k.getObjectByName('Yoke'), steerAxis: SHIP_AXIS, fronts: [], spins: [], driver, hover };
  }
  if (BASE.dk) {
    const k = BASE.dk.clone(), look = skinFor(ch, player, skinOver); dressKart(THREE, k, look); body.add(k);
    const N = k.nodes, wheels = [N.WheelFrontLeft, N.WheelFrontRight, N.WheelRearLeft, N.WheelRearRight];
    // (v158) the user's LED tyre in place of the code-built wheel: the fine version on your kart, the coarse one on a rival's
    if (BASE.tyre) for (const [name, [r, w, side]] of Object.entries(WHEEL_SIZE)) { const a = N[name], old = a.getObjectByName('Spin'); if (old) a.remove(old); a.add(tyreWheel(r, w, side, look, player ? 'hi' : 'lo')); }
    const fronts = [N.WheelFrontLeft, N.WheelFrontRight], spins = wheels.map((n) => n.getObjectByName('Spin') || n.children[0]);
    const driver = driverBody(ch, skinFor(ch, player, skinOver), !player && !skinOver).clone(); driver.position.copy(BASE.foxPos).add(BASE.seatShift); driver.rotation.copy(BASE.foxRot); body.add(driver);
    let dmesh = null; driver.traverse((o) => { if (o.isMesh && o.morphTargetInfluences && o.morphTargetInfluences.length === 4) dmesh = o; });
    return { root, body, steer: N.SteeringWheel.children[0], steerAxis: BASE.steerAxis, fronts, spins, driver, dmesh, kart: k, look };   // (v270: kart + look for the rear wing)
  }
  body.add(kartBody(kartColor).clone());
  const steer = BASE.steer.g.clone(); steer.position.copy(BASE.steer.pos); steer.rotation.copy(BASE.steer.rot); body.add(steer);
  const fronts = [], spins = [];
  for (const w of BASE.wheels) { const h = new THREE.Group(); h.position.copy(w.pos); const s = w.g.clone(); h.add(s); body.add(h); spins.push(s); if (w.front) fronts.push(h); }
  const driver = driverBody(ch).clone(); driver.position.copy(BASE.foxPos); driver.rotation.copy(BASE.foxRot); body.add(driver);
  if (sticker && sticker !== 'none') {
    const pl = (w, x, y, z, ry = 0) => { const k = w + ':' + ry, geo = STICK_GEO[k] || (STICK_GEO[k] = new THREE.PlaneGeometry(w, w).rotateX(-Math.PI / 2).rotateY(ry)); const m = new THREE.Mesh(geo, stickerMat(sticker)); m.position.set(x, y, z); body.add(m); };
    pl(.3, 0, .262, .86, Math.PI); pl(.24, .565, .243, -.06, Math.PI); pl(.24, -.565, .243, -.06, Math.PI);
  }
  return { root, body, steer, fronts, spins, driver };
}

/* ---------- 5. The tracks ---------- */
// Three tracks. Each one is a closed loop of corner points (Catmull-Rom smoothed), a height for every point
// along the lap (hills, bridges, floating space roads), and a look: sky, lights, road, edges, hazard, scenery and music.
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const flatStart = (f) => smoothstep(0, .06, f) * smoothstep(1, .94, f);   // 0 at the start line, so the grid is flat
// a height profile from [fraction, metres] keys, blended smoothly between them
const keyed = (f, keys) => { let i = 0; while (i < keys.length - 2 && keys[i + 1][0] <= f) i++; const [f0, y0] = keys[i], [f1, y1] = keys[i + 1]; return y0 + (y1 - y0) * smoothstep(f0, f1, f); };
// one full 360° corkscrew of the road between two fractions of the lap: a steady turn with soft starts and ends
// (a trapezoid speed profile — smoothstep would spin half as fast again in the middle)
const easeLin = (t, a = .22) => { t = clamp(t, 0, 1); const v = t < a ? t * t / (2 * a) : t <= 1 - a ? a / 2 + (t - a) : 1 - a - (1 - t) * (1 - t) / (2 * a); return v / (1 - a); };
const twist = (f, f0, f1) => Math.PI * 2 * easeLin((f - f0) / (f1 - f0));
const inRoll = (f, m = .025, thr = .25) => { if (!TRACK) return false; for (let d = -m; d <= m + 1e-9; d += .005) if (Math.abs(wrapA(tp(Math.round((((f + d) % 1) + 1) % 1 * TRACK.N)).roll)) > thr) return true; return false; };   // (the road tilts more than thr near f)
const TRACK_DEFS = {
  alps: {   // (scale .1 since v62: a third longer)
    id: 'alps', name: 'Alpine Peaks', sub: 'Snowy hills, ice and pine trees', level: 'A1', tag: 'EASY', color: '#3c8cf0',
    scale: .1, half: 6.5, edge: 'snow', gravity: 30, hazard: 'ice', banner: 'FOXKARTS · ALPINE PEAKS',
    points: [[380, 3400], [340, 2900], [440, 2400], [330, 1900], [400, 1400], [470, 950], [650, 640], [950, 600], [1130, 820],
      [1110, 1250], [960, 1650], [1080, 2100], [1000, 2550], [1100, 3000], [1060, 3420], [880, 3720], [600, 3760], [430, 3640]],
    height: (f) => flatStart(f) * (3.2 * Math.sin(f * Math.PI * 6) + 1.8 * Math.sin(f * Math.PI * 10 + .7) + 1.2),
    sky: [['#1a58d8', 0], ['#4f9cff', .38], ['#a8d4ff', .58], ['#ffe6cc', .78], ['#fff4e6', 1]], fog: ['#dbeeff', 150, 860],   // (v62: a deeper blue, a warm horizon, less haze)
    hemi: [0xeaf4ff, 0xa8b8dc, 1.15], sun: [0xfff0cc, 2.8], road: '#727a8a', line: 'rgba(255,255,255,.9)', kerb: ['#e8403a', '#ffffff'],
    pad: ['#ffffff', '#ffe14a', '#ff7a1e'], music: 0,
    pitStart: true, pitOnly: true,   // (v170, the user) start in your garage (a 4+4+4 pit stop), a formation lap, then the lights; questions only in the pit
  },
  city: {   // (scale 1.3 since v62: a third longer; clearRoad: the fog leaves the road alone)
    id: 'city', name: 'Robo City', sub: "Rob's park circuit by the sea", level: 'A1–A2', tag: 'MEDIUM', color: '#8a4ae8',
    scale: 1.3, half: 6.5, edge: 'walls', gravity: 30, clearRoad: true, hazard: 'oil', banner: 'ROBO CITY GRAND PRIX',
    // (v98) the start straight is broken by an S-bend chicane
    points: [[0, 0], [0, -36], [-14, -62], [-12, -88], [2, -112], [8, -136], [25, -148], [70, -148], [90, -140], [96, -120], [96, -95], [88, -80], [70, -74], [55, -66],
      [50, -50], [55, -34], [72, -26], [92, -18], [100, 0], [100, 30], [92, 46], [72, 52], [25, 52], [6, 44], [0, 25]],
    height: (f) => 5.5 * smoothstep(.3, .37, f) * smoothstep(.52, .45, f),   // an overpass bridge over the city
    sky: [['#1360b8', 0], ['#3f9ad8', .38], ['#8fd4ee', .66], ['#ffe6b4', 1]], fog: ['#bcd9ea', 70, 430],   // (v137: a bright Riviera afternoon; the road stays clear)
    hemi: [0xe2f2ff, 0x7a8694, 1.3], sun: [0xfff2d4, 2.9], road: '#3c4047', line: 'rgba(255,255,255,.95)', kerb: ['#e23a30', '#f2f4f7'], kerbH: .16,
    pad: ['#ffffff', '#7af8ff', '#8a4ae8'], music: 1, monaco: true,
  },
  space: {
    id: 'space', name: 'Star Loop', sub: 'A magnet rollercoaster among the planets', level: 'A2', tag: 'HARD', color: '#3a1a6a',
    scale: .95, half: 7.5, edge: 'void', gravity: 26, magnet: 2.4, hazard: 'goo', banner: 'STAR LOOP · SPACE RACE',
    // a figure of eight: the road crosses itself once (low at 6 %, on a high bridge at 52 %); the bends are banked (bank)
    points: [[0, 0], [0, -90], [-30, -150], [-90, -182], [-150, -150], [-172, -90], [-142, -40], [-92, -18], [-40, -36], [20, -72],
      [75, -90], [128, -64], [152, 0], [132, 70], [72, 112], [16, 100], [-12, 60], [-6, 22]],
    height: (f) => 14 + keyed(f, [[0, 0], [.07, 0], [.27, 0], [.34, 8], [.40, 4], [.45, 11], [.525, 11.5], [.6, 4], [.66, 7], [.72, 2], [.80, 5], [.87, 8], [.92, 3], [.97, 0], [1, 0]]),
    // no spirals any more (the user): the road BANKS instead — it tilts into every bend, the sharper the bend the
    // more, up to about 77°, like a rollercoaster; the magnets hold the karts on
    bank: true, bankMax: .45, nebula: true,   // (v100: the user — smoother, no headaches: wider bends, banked at most ~26°)
    sky: [['#04021a', 0], ['#120a3c', .45], ['#34186a', .72], ['#6a2a8a', 1]], fog: ['#1a0f3a', 260, 1100],
    hemi: [0xaab4ff, 0x2a1a4a, 1.2], sun: [0xffffff, 2.5], road: '#1c2350', line: 'rgba(122,248,255,.95)', kerb: ['#7af8ff', '#ff5db1'],
    pad: ['#ffffff', '#7af8ff', '#ff5db1'], music: 2,
    ship: true,   // (v184, the user) everyone races the starship here
    // (v194, the user) the middle of the lap splits three ways, all the same length; the open one changes every 2 laps
    routes: { f0: .36, f1: .70, extra: 16, wa: [.03, .39], wb: [.56, .97] },   // (v196, the user) a longer stretch, ten variants, a new one every lap
  },
  beach: {   // v67: a sunny island — sand dunes, palms, the sea all round; the questions use the Alps word set (words)
    id: 'beach', name: 'Beach Island', sub: 'Sand, palms and the sea', level: 'A1', tag: 'EASY', color: '#1ab8c8', words: 'alps',
    scale: .85, half: 6.5, edge: 'walls', gravity: 30, hazard: 'water', banner: 'BEACH ISLAND · SUMMER CUP', wall: 'wood',
    wide: [.56, .78], moreHazards: [.08, .37, .52, .84],   // (v70) a stretch along the beach: the road opens onto the sand with the sea as the boundary; extra puddles
    points: [[0, 0], [0, -80], [-10, -140], [-50, -185], [-110, -190], [-160, -160], [-175, -110], [-150, -70], [-100, -60], [-70, -30],
      [-80, 20], [-120, 50], [-130, 100], [-100, 140], [-40, 150], [10, 120], [20, 70], [8, 30]],
    // soft dunes, always above the sea; between 21.5 % and 34.5 % the road dives 5 m underground (the tunnel between the two sand castles)
    height: (f) => keyed(f, [[0, 1.2], [.06, 1.2], [.12, 2.4], [.19, 1.6], [.215, 1.6], [.25, -3.6], [.31, -3.6], [.345, 1.6], [.37, 1.6], [.44, 3.2], [.5, 1.4], [.6, 2.6], [.7, 1.2], [.8, 3], [.9, 1.6], [.96, 1.2], [1, 1.2]]),
    tunnel: [.215, .345, 1.6], hill: [16, 85],   // (castle A, castle B, the surface height; the hill's height and radius)
    sky: [['#3a7ad0', 0], ['#86b8e8', .3], ['#d2dfe8', .5], ['#efeee8', .72], ['#fff3e0', 1]], fog: ['#e6eef2', 150, 820],   // (v70) a cloudy day
    hemi: [0xf4fbff, 0xcdb890, .95], sun: [0xfff2cc, 2.35], envI: .6, road: '#c9a46c', line: 'rgba(255,255,255,.9)', kerb: ['#ffffff', '#1ab8c8'],
    pad: ['#ffffff', '#7af8ff', '#1ab8c8'], music: 0,
  },
  mines: {   // v67: a dark gold mine — a rock tunnel lit by lanterns, rails and minecarts beside the road; the City word set
    id: 'mines', name: 'Gold Mines', sub: 'Lanterns, rails and gold', level: 'A1–A2', tag: 'MEDIUM', color: '#b8742a', words: 'city',
    scale: .85, half: 6.5, edge: 'walls', gravity: 30, hazard: 'rocks', banner: 'GOLD MINES · DEEP RUN',   // (v192, the user: shorter — a 960 m lap, was 1.15 / 1300 m)
    moreHazards: [.1, .33, .55, .72], envI: .18, tube: true, wallOut: 2.3,   // (v72: falling rocks, 10 spots)
    // (v70) a hairpin in the middle — two legs 55 m apart — with a breakable wall and a secret path straight across it (secret)
    // (v258, the user: "make the turn smoother") the corner through the start line is spread over more points
    points: [[0, 0], [-1, -14], [2, -37], [-14, -66], [-8, -102], [-44, -134], [-84, -152], [-128, -138], [-155, -88], [-140, -40], [-100, -20], [-110, 20], [-80, 45], [-30, 40], [10, 55],
      [0, 84], [-40, 90], [-90, 88], [-120, 128], [-80, 165], [-20, 170], [40, 150], [70, 100], [62, 58], [40, 30], [18, 17], [6, 9]],
    secret: true,
    // (v139) seven jumps on this map, so seven jump questions a lap; none of them lands on the bridge
    // tunnels up and down; flat through the hairpin (40–63 %), so the secret path across it is level
    height: (f) => keyed(f, [[0, 0], [.035, 0], [.075, 3.6], [.115, .2], [.155, 3.8], [.195, .4], [.235, 2.9], [.28, 1.5], [.38, 1.5], [.527, 1.5], [.549, 4.4], [.571, 1.5], [.63, 1.5], [.70, 4.2], [.80, .3], [.88, 3], [.96, 0], [1, 0]]),
    sky: [['#070402', 0], ['#140c06', .5], ['#2a1a0c', .85], ['#3a2410', 1]], fog: ['#1d1038', 46, 300],
    hemi: [0x6a5040, 0x120a06, 1.0], sun: [0xffc880, 1.6], road: '#78492a', line: 'rgba(255,205,90,.85)', kerb: ['#ffd23a', '#1a1208'], kerbH: .2,
    pad: ['#ffffff', '#ffd23a', '#ff8a1e'], music: 1,
  },
};
// (v168, the user: "Japan isn't a map, remove it") Japan is out of the game (it stays in the FoxKarts Maps artifact;
// its v161 files are kept in kart/tools/japan-removed)
const TRACK_ORDER = ['alps', 'beach', 'city', 'mines', 'space'];
// (v177, the user) every map races like the Alps: the garage start, the formation lap with its gates, the grid box, and
// questions only in the pit
for (const id of TRACK_ORDER) Object.assign(TRACK_DEFS[id], { pitStart: true, pitOnly: true });
/* (v199, the user) THE ROAD ITSELF CHANGES on the other four maps too: two stretches of the lap (wins, lap fractions)
   take one of ten road shapes every lap — flat, no flips, gentle enough to take flat out (radius ≥ rmin), all exactly
   the same length; the road may move at most `off` metres off its usual line, and the ground, the walls, the cave and
   the scenery are built to fit every shape. Kept clear of the pit lane and the start, the beach tunnel's castles and
   its open sand, the city bridge, and the cave's hairpin with the secret path. */
const GROUND_ROUTES = {
  // (two stretches with a gap between them, where a row of ? boxes stands that every variant shares)
  alps: { wins: [[.21, .37], [.43, .61]], off: 10, extra: 9, rmin: 22 },
  beach: { wins: [[.225, .335], [.36, .535]], off: 9, extra: 9, rmin: 22 },   // (between the sand castles' gates, and up to the open sand)
  city: { wins: [[.195, .37], [.43, .645]], off: 9, extra: 9, rmin: 18 },     // (across the overpass: the deck and pillars are built under every variant)
  mines: { wins: [[.165, .39], [.635, .70]], off: 8, extra: 8, rmin: 14, keep: .75 },   // (a twisty cave: its own corners are 7 m)
};
for (const [id, R] of Object.entries(GROUND_ROUTES)) {
  const f0 = R.wins[0][0] - .006, f1 = R.wins[1][1] + .006, t = (f) => (f - f0) / (f1 - f0);
  TRACK_DEFS[id].routes = { ...R, set: 'ground', f0, f1, wa: R.wins[0].map(t), wb: R.wins[1].map(t) };
}
function buildTrack(def) {
  const P = def.points.map(([x, z, y]) => (y === undefined ? [x * def.scale, z * def.scale] : [x * def.scale, z * def.scale, y])), n = P.length, dense = [];
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    for (let k = 0; k < 50; k++) {
      const t = k / 50, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push({ x: f(p0[0], p1[0], p2[0], p3[0]), z: f(p0[1], p1[1], p2[1], p3[1]), y: p1.length > 2 ? f(p0[2], p1[2], p2[2], p3[2]) : 0 });   // (v161: a point may carry its height)
    }
  }
  // resample to an even spacing, so "index × STEP" is the distance along the track
  const pts = [{ ...dense[0] }]; let d = 0, target = STEP; const has3 = P[0].length > 2;
  for (let i = 0; i < dense.length; i++) {
    const a = dense[i], b = dense[(i + 1) % dense.length], seg = Math.hypot(b.x - a.x, b.z - a.z);
    while (d + seg >= target) { const t = (target - d) / seg; pts.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t }); target += STEP; }
    d += seg;
  }
  if (Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].z - pts[0].z) < STEP * .6) pts.pop();
  const N = pts.length;
  pts.forEach((p, i) => { const a = pts[(i - 1 + N) % N], b = pts[(i + 1) % N], l = Math.hypot(b.x - a.x, b.z - a.z); p.tx = (b.x - a.x) / l; p.tz = (b.z - a.z) / l; p.nx = -p.tz; p.nz = p.tx; p.y = has3 ? p.y : def.height(i / N); p.roll = def.rolls ? def.rolls.reduce((a, [f0, f1]) => a + twist(i / N, f0, f1), 0) % (Math.PI * 2) : 0; });
  if (def.bank) {   // banked bends: the road rolls into each bend by its curvature (how much the heading turns over 12 m), smoothed along the road, capped
    const ang = (i) => Math.atan2(pts[i].tx, -pts[i].tz), raw = pts.map((_, i) => wrapA(ang((i + 10) % N) - ang((i - 10 + N) % N)));
    // gentle bends stay almost flat, the sharp ones tilt all the way to bankMax (a left bend turns the heading negative → the right side rises)
    pts.forEach((p, i) => { let a = 0; for (let k = -18; k <= 18; k++) a += raw[(i + k + N) % N]; const c = a / 37; p.roll = -Math.sign(c) * smoothstep(.07, .3, Math.abs(c)) * def.bankMax * flatStart(i / N); });
    // (v181, the user: "make the pitstop platform horizontally stable") no banking from 60 m before the pit lane
    // leaves the road to 60 m after it rejoins: the road, the lane beside it, the garages and the box all sit level
    const PS = PIT_SPECS[def.id];
    if (PS) { const L = N * STEP; pts.forEach((p, i) => { let d = i * STEP; if (d > L / 2) d -= L; const w = smoothstep(PS.entry - 60, PS.entry - 15, d) * (1 - smoothstep(PS.exit + 15, PS.exit + 60, d)); p.roll *= 1 - w; }); }
  }
  if (def.routes) return buildRoutes(pts, N, def);
  return { pts, N, L: N * STEP };
}
/* (v196, the user) STAR LOOP'S TEN VARIANTS. From the end of the left loop, over the bridge, into the right loop
   (36–70 % of the lap, about 375 m) the road changes shape every lap: ten variants, all exactly the same length (the
   same number of points, the same metres), all smooth: rolls take a full 2.5 s, slopes stay under 30 %, only HAIRPIN S
   and SLALOM have hard turns (9–10 m). The bridge in the middle stays as it is, so nothing ever comes near the start
   straight underneath. Only one variant is drawn at a time (and one a racer is still driving on); outside the stretch
   all ten are the same points (the same objects), so a racer's variant can change there without anything moving. */
const smoothstepR = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ROUTE_WA = [.03, .39], ROUTE_WB = [.56, .97];   // the two windows either side of the bridge
const rLoc = (t, w) => (t <= w[0] || t >= w[1] ? -1 : (t - w[0]) / (w[1] - w[0]));
const rWave = (t, w, cyc) => { const u = rLoc(t, w); return u < 0 ? 0 : Math.sin(2 * Math.PI * cyc * u) * Math.sin(Math.PI * u) ** 2; };
const rBulge = (t, w) => { const u = rLoc(t, w); return u < 0 ? 0 : Math.sin(Math.PI * u) ** 2; };
const rBell = (t, c, w) => { const u = (t - c) / w; return Math.abs(u) >= 1 ? 0 : Math.cos(u * Math.PI / 2) ** 2; };
const rRot = (t, a, b) => (t <= a || t >= b ? 0 : Math.PI * 2 * easeLin((t - a) / (b - a)));
const rEnv = (t) => smoothstepR(0, .08, t) * (1 - smoothstepR(.92, 1, t));
const rEven = (t) => rWave(t, ROUTE_WA, 1) + rWave(t, ROUTE_WB, 1);   // the gentle S that evens the lengths
const ROUTE_VARIANTS = [
  { name: 'CLASSIC', up: () => 0, roll: () => 0 },
  // (v199, the user: "no headache-making flips, it is undrivable") no rolls at all any more: hills, dips and curves only
  { name: 'WAVE RIDER', up: (t) => 3 * rBell(t, .13, .08) + 3.4 * rBell(t, .3, .08) + 3.4 * rBell(t, .68, .08) + 3 * rBell(t, .86, .08), roll: () => 0 },
  { name: 'SIDEWINDER', lat: (t) => rWave(t, ROUTE_WA, 1.5) + rWave(t, ROUTE_WB, 1.5), up: (t) => 2.5 * rBell(t, .21, .15), roll: () => 0, bank: .3 },
  { name: 'BIG DIPPER', up: (t) => -9 * rBell(t, .21, .17) + 10 * rBell(t, .76, .19), roll: () => 0 },
  { name: 'CAMEL HUMPS', up: (t) => 3.6 * rBell(t, .11, .09) + 4 * rBell(t, .29, .09) + 4 * rBell(t, .66, .1) + 3.6 * rBell(t, .87, .1), roll: () => 0 },
  { name: 'HAIRPIN S', lat: (t) => rWave(t, ROUTE_WA, 2) - rWave(t, ROUTE_WB, 2), up: () => 0, roll: () => 0, bank: .3 },
  { name: 'SLALOM', lat: (t) => rWave(t, ROUTE_WA, 2.5) + rWave(t, ROUTE_WB, 2.5), up: () => 0, roll: () => 0, bank: .3 },
  { name: 'BOBSLEIGH', lat: (t) => rWave(t, ROUTE_WA, 1) - rWave(t, ROUTE_WB, 1), up: (t) => -3 * (rBulge(t, ROUTE_WA) + rBulge(t, ROUTE_WB)), roll: () => 0, bank: .3 },
  { name: 'ROLLERCOASTER', up: (t) => 6.5 * rBell(t, .12, .13) - 5 * rBell(t, .3, .11) + 5 * rBell(t, .78, .15), roll: () => 0 },
  { name: 'CRESCENT', lat: (t) => rBulge(t, ROUTE_WA) - rBulge(t, ROUTE_WB), up: (t) => 3 * rBulge(t, ROUTE_WA), roll: () => 0, bank: .3 },
];
function routeHide() { return null; }   // (v196) only one variant is drawn at a time: nothing to hide
// (v196) every variant's stretch: road, kerbs, rails, dark underside and glowing skirts, the same style as the rest; one
// group each, shown only while it is in use
function buildRouteRoads(scene, W, def, roadMat, vc, wallMat, kerbC) {
  const { i0, i1 } = TRACK.sec, inS = (i) => i >= i0 && i < i1, KH = def.kerbH || .12, skip = STRIP_SKIP; STRIP_SKIP = null;
  const under = M('#151a3a', { roughness: .5, side: THREE.DoubleSide }), sk = { '-1': new THREE.MeshBasicMaterial({ color: '#c84aff', side: THREE.DoubleSide }), '1': new THREE.MeshBasicMaterial({ color: '#3a8aff', side: THREE.DoubleSide }) };
  W.routeGroups = TRACK.routes.map((R, r) => {
    TRACK.pts = R; const g = new THREE.Group(); g.visible = r === 0;
    const road = new THREE.Mesh(strip(-HALF, HALF, .03, .03, { uvLen: 12, only: inS }), roadMat); road.receiveShadow = true; g.add(road);
    for (const s of [-1, 1]) {
      g.add(new THREE.Mesh(s > 0 ? strip(HALF, HALF + .9, .03, KH, { colour: kerbC, only: inS }) : strip(-HALF - .9, -HALF, KH, .03, { colour: kerbC, only: inS }), vc));
      g.add(new THREE.Mesh(strip(s * (HALF + .95), s * (HALF + .95), 0, 1.05, { uvLen: 2, only: inS }), wallMat));
      g.add(new THREE.Mesh(strip(s * (HALF + .9), s * (HALF + .9), -1.1, .03, { only: inS }), sk[s]));
    }
    g.add(new THREE.Mesh(strip(-HALF - .9, HALF + .9, -1.1, -1.1, { only: inS }), under));
    styleStretch(g, def, r);   // (v264) this variant's track type
    scene.add(g); return g;
  });
  TRACK.pts = TRACK.routes[0]; STRIP_SKIP = skip;
  // (v206, the user) no name gate before the changing stretch any more
}
// (v196) a hologram banner over the road where the stretch begins, with the name of this lap's variant
function buildRouteSign(scene, W) {
  const { i0 } = TRACK.sec, p = TRACK.routes[0][i0 + 8], g = new THREE.Group(); g.position.set(p.x, p.y, p.z); g.rotation.y = Math.atan2(p.tx, p.tz);
  const post = new THREE.MeshBasicMaterial({ color: '#7af8ff' }), wd = 2 * HALF + 2.4;
  for (const sd of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(.35, 7, .35), post); m.position.set(sd * wd / 2, 3.5, 0); g.add(m); }
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 160; const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(wd, wd * 160 / 1024), new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide })); pane.position.y = 6.3; g.add(pane);
  W.routeSign = { cv, tx }; scene.add(g);
}
function drawRouteSign(name) {
  const S = WORLD && WORLD.routeSign; if (!S) return; const x = S.cv.getContext('2d');
  x.fillStyle = '#10163a'; x.fillRect(0, 0, 1024, 160); x.strokeStyle = '#7af8ff'; x.lineWidth = 10; x.strokeRect(5, 5, 1014, 150);
  x.fillStyle = '#7af8ff'; x.font = '84px "Luckiest Guy", Fredoka, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(name, 512, 86); S.tx.needsUpdate = true;
}
// (v196) which variant is drawn: this lap's, and no other (v277)
function updateRouteGates() {
  const W = WORLD; if (!W || !W.routeGroups || !race) return; const open = routeFor();
  W.routeGroups.forEach((g, r) => { g.visible = r === open; });
  if (W.routeShown !== open) { W.routeShown = open; drawRouteSign(TRACK.sec.spec[open].name); miniBase = null; buildMinimap(); }   // (the minimap redrawn with this variant)
}
// (v199) the ten road shapes of the ground maps (a, b: the two stretches); lateral only, no height change, no tilt.
// Flowing shapes only (the user: "not hard to pass"): no quick zigzags. Every shape starts and ends with no offset, no
// angle and no curvature, so it joins the usual road seamlessly. gW: an S over a stretch; gP: the road eases over
// to one side, runs alongside there, and eases back (a smootherstep in, a hold, a smootherstep out).
const sm5 = (x) => { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };
const gW = (t, w, c) => rWave(t, w, c);
const gP = (t, w) => { const u = rLoc(t, w); return u < 0 ? 0 : sm5(u / .38) * sm5((1 - u) / .38); };
const GROUND_VARIANTS = [
  { name: 'CLASSIC', lat: () => 0 },
  { name: 'S-BENDS', lat: (t, a, b) => gW(t, a, 1) - gW(t, b, 1) },
  { name: 'RIGHT-LEFT', lat: (t, a, b) => gW(t, a, 1.5) + gW(t, b, 1.5) },
  { name: 'LEFT-RIGHT', lat: (t, a, b) => -gW(t, a, 1.5) - gW(t, b, 1.5) },
  { name: 'SWING WIDE', lat: (t, a, b, cf) => cf(t), corner: true },
  { name: 'BIG SWEEPS', lat: (t, a, b) => gP(t, a) - gP(t, b) },
  { name: 'WIDE RIGHT', lat: (t, a, b) => gP(t, a) + gP(t, b) },
  { name: 'WIDE LEFT', lat: (t, a, b) => -gP(t, a) - gP(t, b) },
  { name: 'SWEEP & S', lat: (t, a, b) => gP(t, a) + gW(t, b, 1) },
  { name: 'S & SWEEP', lat: (t, a, b) => gW(t, a, 1) - gP(t, b) },
];
// Every shape at the biggest size its limits allow (off the usual line ≤ off m, no new bend tighter than rmin, no bend of
// the usual road more than 20 % tighter); the wiggly shapes fade out round the usual road's tight corners, the corner
// swing does not. The lengths may differ a little (≤ 6 %): on the stretch every kart drives that much faster or slower
// on its variant (TRACK.sec.k), so every variant takes exactly the same time — and the race positions (by points along
// the lap) stay fair.
function buildGroundRoutes(pts, N, def) {
  const R = def.routes, i0 = Math.round(R.f0 * N), i1 = Math.round(R.f1 * N), M = i1 - i0, A = R.wa, B = R.wb;
  const base = Array.from({ length: M + 1 }, (_, k) => pts[i0 + k]);
  const pathOf = (o) => base.map((p, k) => ({ x: p.x + p.nx * o[k], z: p.z + p.nz * o[k] }));
  const lenOf = (q) => { let l = 0; for (let k = 1; k < q.length; k++) l += Math.hypot(q[k].x - q[k - 1].x, q[k].z - q[k - 1].z); return l; };
  const radArr = (q) => { const h = (k) => Math.atan2(q[k + 1].x - q[k].x, q[k + 1].z - q[k].z), r = new Float32Array(q.length).fill(1e9); for (let k = 4; k < q.length - 5; k++) { const d = Math.abs(wrapA(h(k + 4) - h(k - 4))); if (d > 1e-6) r[k] = 8 * STEP / d; } return r; };
  const rB = radArr(base), L0 = lenOf(base);
  const raw = base.map((_, k) => { let m = 1e9; for (let j = Math.max(0, k - 18); j <= Math.min(M, k + 18); j++) m = Math.min(m, rB[j]); return smoothstep(15, 32, m); });
  const mask = raw.map((_, k) => { let x = 0, n = 0; for (let j = Math.max(0, k - 22); j <= Math.min(M, k + 22); j++) { x += raw[j]; n++; } return x / n; });
  // the corner swing: out along the usual road's own bends, smooth, only inside the stretches
  const h = (k) => Math.atan2(base[Math.min(M, k + 1)].x - base[k].x, base[Math.min(M, k + 1)].z - base[k].z), kap = base.map((_, k) => (k < 2 || k > M - 3 ? 0 : wrapA(h(k + 1) - h(k - 1)) / (2 * STEP)));
  const sk = kap.map((_, k) => { let x = 0, n = 0; for (let j = Math.max(0, k - 20); j <= Math.min(M, k + 20); j++) { x += kap[j]; n++; } return x / n; });
  const env = base.map((_, k) => gP(k / M, A) + gP(k / M, B)), cr = sk.map((x, k) => -x * env[k]), cm = Math.max(1e-9, ...cr.map(Math.abs)), cf = (t) => cr[Math.round(t * M)] / cm;
  const ok = (o) => { if (Math.max(...o.map(Math.abs)) > R.off + 1e-6) return false; const rv = radArr(pathOf(o)); for (let k = 4; k < rv.length - 5; k++) if (rv[k] < Math.min(R.rmin, rB[k] * (R.keep || .8))) return false; const l = lenOf(pathOf(o)); return l < L0 * 1.06 && l > L0 * .94; };
  const maxBy = (f) => { let lo = 0, hi = 40; for (let it = 0; it < 26; it++) { const m = (lo + hi) / 2; if (f(m)) lo = m; else hi = m; } return lo; };
  const routes = GROUND_VARIANTS.map((v, r) => {
    // the biggest size, with the fade round tight corners or without it (whichever lets the shape be bigger)
    const sh = base.map((_, k) => v.lat(k / M, A, B, cf)), forms = v.corner ? [sh] : [sh.map((x, k) => x * mask[k]), sh];
    let o = base.map(() => 0), big = 0;
    for (const f of forms) { const a = maxBy((x) => ok(f.map((y) => y * x))), oo = f.map((y) => y * a), m = Math.max(...oo.map(Math.abs)); if (m > big) { big = m; o = oo; } }
    const path = pathOf(o), cum = [0];
    for (let k = 1; k <= M; k++) cum.push(cum[k - 1] + Math.hypot(path[k].x - path[k - 1].x, path[k].z - path[k - 1].z));
    const arr = pts.slice(); let j = 0;
    for (let k = 1; k < M; k++) {   // M even steps along its own length; the height of the road beside it (flat ground, no tilt)
      const skm = cum[M] * k / M; while (j < M - 1 && cum[j + 1] < skm) j++;
      const u = (skm - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]), b0 = pts[i0 + j], b1 = pts[i0 + j + 1];
      arr[i0 + k] = { x: path[j].x + (path[j + 1].x - path[j].x) * u, z: path[j].z + (path[j + 1].z - path[j].z) * u, y: b0.y + (b1.y - b0.y) * u, roll: 0, route: r, off: o[j] + (o[j + 1] - o[j]) * u };
    }
    for (let k = 1; k < M; k++) { const i = i0 + k, a2 = arr[i - 1], c2 = arr[i + 1], l = Math.hypot(c2.x - a2.x, c2.z - a2.z), q = arr[i]; q.tx = (c2.x - a2.x) / l; q.tz = (c2.z - a2.z) / l; q.nx = -q.tz; q.nz = q.tx; }
    return { arr, stat: { name: v.name, off: +big.toFixed(1), rad: +Math.min(...radArr(path)).toFixed(1) } };
  });
  const lens = routes.map(({ arr }) => { let l = 0; for (let i = i0; i < i1; i++) l += Math.hypot(arr[i + 1].x - arr[i].x, arr[i + 1].z - arr[i].z); return +l.toFixed(1); });
  const k = lens.map((l) => l / lens[0]);   // (the speed factor on the stretch: the same time on every variant)
  console.log(`${def.id} road variants (${M} points, base ${L0.toFixed(1)} m, base radius ${Math.min(...rB).toFixed(0)} m): ${routes.map((x, r) => `${x.stat.name} ${lens[r]} m ±${x.stat.off} R${x.stat.rad}`).join(' · ')}`);
  return { pts: routes[0].arr, N, L: N * STEP, routes: routes.map((x) => x.arr), sec: { i0, i1, M, spec: GROUND_VARIANTS, lens, k, stats: routes.map((x) => x.stat), ground: true } };
}
function buildRoutes(pts, N, def) {
  if (def.routes.set === 'ground') return buildGroundRoutes(pts, N, def);
  const R = def.routes, i0 = Math.round(R.f0 * N), i1 = Math.round(R.f1 * N), M = i1 - i0;
  const base = Array.from({ length: M + 1 }, (_, k) => pts[i0 + k]);
  const shapeOf = (v) => v.lat || rEven;
  const pathOf = (v, w) => base.map((p, k) => { const t = k / M, o = w * shapeOf(v)(t); return { x: p.x + p.nx * o, z: p.z + p.nz * o }; });
  const lenOf = (a) => { let l = 0; for (let k = 1; k < a.length; k++) l += Math.hypot(a[k].x - a[k - 1].x, a[k].z - a[k - 1].z); return l; };
  const T = lenOf(pathOf(ROUTE_VARIANTS[0], 0)) + (R.extra || 16);
  const routes = ROUTE_VARIANTS.map((v, r) => {
    let lo = 0, hi = 60; for (let it = 0; it < 50; it++) { const m = (lo + hi) / 2; if (lenOf(pathOf(v, m)) < T) lo = m; else hi = m; }   // the amplitude that makes it exactly T long
    const path = pathOf(v, (lo + hi) / 2), cum = [0];
    for (let k = 1; k <= M; k++) cum.push(cum[k - 1] + Math.hypot(path[k].x - path[k - 1].x, path[k].z - path[k - 1].z));
    const arr = pts.slice(); let j = 0;
    for (let k = 1; k < M; k++) {   // M even steps along its own length
      const sk = cum[M] * k / M; while (j < M - 1 && cum[j + 1] < sk) j++;
      const u = (sk - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]), t = k / M, b = pts[i0 + k];
      arr[i0 + k] = { x: path[j].x + (path[j + 1].x - path[j].x) * u, z: path[j].z + (path[j + 1].z - path[j].z) * u, y: b.y + v.up(t) * rEnv(t), roll: b.roll || 0, route: r };
    }
    for (let k = 1; k < M; k++) { const i = i0 + k, a = arr[i - 1], c = arr[i + 1], l = Math.hypot(c.x - a.x, c.z - a.z), q = arr[i]; q.tx = (c.x - a.x) / l; q.tz = (c.z - a.z) / l; q.nx = -q.tz; q.nz = q.tx; }
    const ang = (i) => Math.atan2(arr[i].tx, -arr[i].tz);
    for (let k = 1; k < M; k++) {
      const i = i0 + k, t = k / M, q = arr[i]; let rl = q.roll;
      if (v.bank) { const c = wrapA(ang(Math.min(i1, i + 14)) - ang(Math.max(i0, i - 14))); rl = rl * (1 - rEnv(t)) + rEnv(t) * clamp(-c * v.bank * 1.6, -.35, .35); }   // (v199: at most ~20°, was ~50°)   // tilt into its own turns
      q.roll = wrapA(rl + v.roll(t));
    }
    return arr;
  });
  const lens = routes.map((arr) => { let l = 0; for (let i = i0; i < i1; i++) l += Math.hypot(arr[i + 1].x - arr[i].x, arr[i + 1].z - arr[i].z); return +l.toFixed(1); });
  console.log(`star loop variants (${M} points each): ${ROUTE_VARIANTS.map((v, r) => `${v.name} ${lens[r]} m`).join(' · ')}`);
  return { pts: routes[0], N, L: N * STEP, routes, sec: { i0, i1, M, spec: ROUTE_VARIANTS, lens } };
}
// (v194) which route a racer drives through the section: everyone takes the route of the player's two-lap block
// (laps 1–2, 3–4, 5–6), drawn at random at the start, never the same twice in a row; the formation lap takes S-BENDS.
// A racer's route only changes outside the section, where all three are the same road.
const inRouteSec = (r) => TRACK.sec && r.idx > TRACK.sec.i0 - 4 && r.idx < TRACK.sec.i1 + 4;
function routeFor() {
  if (!TRACK.routes || !race || race.formation || !race.routeSeq || !race.player) return 0;
  const lap = Math.max(1, race.player.lap); return race.routeSeq[Math.min(race.routeSeq.length - 1, lap - 1)];   // (v196: a new one every lap)
}
// (v277, the user: "barriers inside the road and you can go through them") only ONE variant ever exists on screen: everybody drives on the
// player's. A rival still in the section when the variant changes (you are at the line then, far away) is carried across, same place on the road.
function moveToRoute(r, to) {
  const N = TRACK.N, i = ((r.idx % N) + N) % N, A = TRACK.routes[r.route || 0][i], B = TRACK.routes[to][i]; if (!A || !B) return;
  const dx = r.x - A.x, dz = r.z - A.z, lat = dx * A.nx + dz * A.nz, along = dx * A.tx + dz * A.tz;
  r.x = B.x + B.nx * lat + B.tx * along; r.z = B.z + B.nz * lat + B.tz * along; r.y += B.y - A.y; r.angle += wrapA(angleOf(B) - angleOf(A));
}
function useRoute(r) { if (!TRACK.routes) return; const to = routeFor(); if ((r.route || 0) !== to) { if (inRouteSec(r) && !r.remote) moveToRoute(r, to); r.route = to; } TRACK.pts = TRACK.routes[to]; }
function playerRoute() { if (TRACK.routes) TRACK.pts = TRACK.routes[(race && race.player && race.player.route) || 0]; }
// (v197) is a lap fraction inside one of the two windows that change? (the shared middle between them does not)
const inRoutesF = (f, def = TDEF) => { const R = def && def.routes; if (!R) return false; const t = (f - R.f0) / (R.f1 - R.f0), m = .025 / (R.f1 - R.f0), A = R.wa, B = R.wb;
  return (t > A[0] - m - .03 && t < A[1] + m) || (t > B[0] - m && t < B[1] + m + .03); };
// the current track (set by useTrack)
let TDEF, TRACK, TB, BOUNDS, MID, BUSY, RAMP_AT, PAD_AT, GATE_AT, PIT_AT, HALF = 6.5, WORLD;
const tp = (i) => TRACK.pts[((i % TRACK.N) + TRACK.N) % TRACK.N];
// the road's roll (its twist about its own direction) at a distance along the lap, and a point beside the road in that
// rolled frame: lat metres sideways and h metres up from the centre line. The roll is 0 everywhere but in a corkscrew.
const rollAt = (sd) => { const t = sd / STEP, i = Math.floor(t), a = tp(i).roll, b = tp(i + 1).roll; return a || b ? a + wrapA(b - a) * (t - i) : 0; };
const rolled = (p, lat, h) => { const c = Math.cos(p.roll), s = Math.sin(p.roll), w = lat * c - h * s; return [p.x + p.nx * w, p.y + lat * s + h * c, p.z + p.nz * w]; };
const at = (s, lateral = 0) => { const p = tp(Math.round(s / STEP)); return { x: p.x + p.nx * lateral, z: p.z + p.nz * lateral, y: p.y, p }; };
const angleOf = (p) => Math.atan2(p.tx, -p.tz);       // our heading: forward = (sin a, −cos a); 0 = towards −z
const fwd = (a) => ({ x: Math.sin(a), z: -Math.cos(a) });
// the road's height under a racer (between two centre-line points)
const trackY = (r) => { const t = (r.sc - r.s) / STEP, a = tp(r.idx).y; return t >= 0 ? a + (tp(r.idx + 1).y - a) * Math.min(1, t) : a + (tp(r.idx - 1).y - a) * Math.min(1, -t); };
const slopeAt = (i) => (tp(i + 3).y - tp(i - 3).y) / (6 * STEP);
// the road's height at any distance along the lap (used to rest the kart's nose and tail on the road, not in it)
const yAtS = (s) => { const t = s / STEP, i = Math.floor(t), a = tp(i).y; return a + (tp(i + 1).y - a) * (t - i); };
const KART_END = 1.05;     // how far the nose and the tail reach from the middle of the kart
const KART_HALF_W = .75;   // and how far its wheels stick out sideways
// where the kart's middle has to sit so that neither end dips below the road (it bridges a dip, rides over a crest)
function rideY(r, road) {
  const cosA = Math.cos(wrapA(r.angle - angleOf(tp(r.idx)))), d = KART_END * Math.abs(cosA);
  if (d < .2) return road;
  const yN = yAtS(r.sc + d), yT = yAtS(r.sc - d);
  r.endSlope = (yN - yT) / (2 * d) * Math.sign(cosA || 1);   // the slope the kart's own length sits on
  // the chassis rides on its two axles (the average); over a crest it is eased up towards the road under its middle.
  // Smooth (no kink), or the hop detector below would read the kink as a crest and bounce the kart on every hill.
  const avg = (yN + yT) / 2, dlt = road - avg;
  return avg + (dlt > 0 ? dlt * dlt / (dlt + .1) : 0);
}
// where things go on the track (as a fraction of a lap). Ramps and boost pads sit on the straightest bits that are free.
const BOX_AT = [0.07, 0.22, 0.4, 0.54, 0.69, 0.84], ICE_AT = [0.14, 0.3, 0.47, 0.61, 0.76, 0.9];
const COIN_AT = [.04, .17, .26, .35, .5, .58, .65, .74, .8, .95];
const RAMP_LEN = 4.6, RAMP_H = 1.15;
const bendAt = (s) => Math.abs(wrapA(angleOf(at(s + 14).p) - angleOf(at(s - 14).p)));
const flatScore = (s) => bendAt(s) + Math.abs(slopeAt(Math.round(s / STEP))) * 3;   // flat and straight
// (v292, the user: "make that there won't be jumps before the turn so you don't get into the wall") a jump is judged
// by the road under the flight and just after the landing. A fast jump lands ~23 m after the ramp, flying straight:
// the road's middle may drift only a little sideways from that line by then (m); and in the 20 m after the landing
// there must be no sharp turn (how much the road turns over 28 m, in radians; a gentle curve, < .35, is fine — you
// steer it). The ramp itself must be flat.
const rampDrift = (s, to = 25) => { const a = at(s), h = angleOf(a.p), dx = Math.sin(h), dz = -Math.cos(h); let off = 0; for (let k = 5; k <= to; k += 5) { const q = at(s + k); off = Math.max(off, Math.abs((q.x - a.x) * dz - (q.z - a.z) * dx)); } return off; };
const rampTurn = (s) => Math.max(bendAt(s + 30), bendAt(s + 40), bendAt(s + 50));
const rampScore = (s) => rampDrift(s) + 8 * Math.max(0, rampTurn(s) - .35) + Math.abs(slopeAt(Math.round(s / STEP))) * 6;
function straightest(f0, f1, busy, score = flatScore) {
  let best = (f0 + f1) / 2, bb = 1e9;
  for (let f = f0; f <= f1; f += .004) {
    if (busy.some((a) => Math.min(Math.abs(a - f), 1 - Math.abs(a - f)) < .028)) continue;
    const b = score(f * TRACK.L);
    if (b < bb) { bb = b; best = f; }
  }
  busy.push(best); return best;
}
function prepTrack(def) {
  if (def.prep && def.prep.nJumps === jumpCount()) return def.prep;
  TRACK = buildTrack(def); HALF = def.half;
  const tb = TRACK.pts.reduce((b, p) => ({ x0: Math.min(b.x0, p.x), x1: Math.max(b.x1, p.x), z0: Math.min(b.z0, p.z), z1: Math.max(b.z1, p.z) }), { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 });
  const busy = [0, ...BOX_AT.filter((f) => !inRoll(f)), ...ICE_AT.filter((f) => !inRoll(f))];
  const routeF = new Set();   // (v292: these keep pads and gates off the changing road; a jump may stand there, drawn on every variant)
  if (def.routes) for (let f = def.routes.f0 - .02; f <= def.routes.f1 + .021; f += .01) if (inRoutesF(f, def)) { busy.push(f); routeF.add(f); }   // (v197) the changing windows stay clear; the shared middle gets the same power-ups for every variant
  if (def.rolls || def.bank) for (let f = 0; f < 1; f += .012) if (inRoll(f, .02)) busy.push(f);   // (nothing is placed where the road tilts)
  // (v151) the pit lane: on the flattest free spot just after the start line, like a real race
  const pit = straightest(.03, .15, busy);
  // (v141) one window per jump, evenly spaced round the lap; straightest() picks the flattest free spot in each
  const nJ = jumpCount(), wJ = 1 / nJ, inJ = wJ * .18;
  // (v199) a jump or a pad never lands on a stretch whose road changes: it moves to the nearest flat spot on shared road
  const onShared = (a, b, sc) => { for (const d of [0, .04, -.04, .08, -.08, .12, -.12, .16, -.16]) { const f = straightest(a + d, b + d, busy, sc), w = ((f % 1) + 1) % 1; if (!inRoutesF(w, def) || !def.routes) return w; busy.pop(); } return straightest(a, b, busy, sc); };
  // (v292) the jumps go on the best free spots of the WHOLE lap (the old way took the best spot in each quarter, and
  // when a quarter was full of boxes, ice or changing road it fell back to its middle — often a jump into a bend):
  // every free spot is scored by its flight and landing (rampScore), then the best are taken, well apart
  const ramps = (() => {
    const PSz = PIT_SPECS[def.id], Lt = TRACK.L, gapF = (a, b) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };
    const wd = (f) => { const w = ((f % 1) + 1) % 1; return w > .5 ? w - 1 : w; };
    const pz = PSz ? [[PSz.entry - 70, PSz.tIn + 15], [PSz.tOut - 25, PSz.exit + 15]].map(([a, b]) => [a / Lt, b / Lt]) : [];
    // on the changing road a jump stands in one place and is drawn on every variant (v267), so it is judged on the
    // worst of them (each variant's distance is its nearest point, as routeSs does it)
    const RS = TRACK.routes && TRACK.sec ? TRACK.routes : null, base = TRACK.pts;
    const nearS = (s, R) => { const { i0, i1 } = TRACK.sec, B = RS[0], i = Math.round(s / STEP) % B.length; if (i < i0 || i >= i1) return s; const P = B[i]; let bd = 1e18, bi = i; for (let j = Math.max(i0, i - 60); j <= Math.min(i1, i + 60); j++) { const q = R[j], d = (q.x - P.x) ** 2 + (q.z - P.z) ** 2; if (d < bd) { bd = d; bi = j; } } return bi * STEP; };
    const score = (s) => { if (!RS) return rampScore(s); let w = 0; RS.forEach((R, r) => { TRACK.pts = R; w = Math.max(w, rampScore(r ? nearS(s, R) : s)); }); TRACK.pts = base; return w; };
    // what may not be near a jump (metres before the ramp, metres after it): ice, the start line or a tilted bit
    // from just before the ramp to ~20 m past the landing; a ? box only not ON the ramp (you can fly over one, or land
    // on it and take it)
    const boxF = new Set(BOX_AT), free = (f) => busy.every((a) => { if (routeF.has(a)) return true; const d = ((a - f) % 1 + 1) % 1, [bef, aft] = boxF.has(a) ? [6, 8] : [6, 42]; return d * Lt > aft && (1 - d) * Lt > bef; });
    const cand = [];
    for (let f = inJ; f < 1 - inJ; f += .004) {
      if (!free(f) || pz.some(([a, b]) => wd(f) > a && wd(f) < b)) continue;
      cand.push([f, score(f * Lt)]);
    }
    cand.sort((a, b) => a[1] - b[1]);
    // only good spots (≤ 6: under ~3 m of drift and no sharp turn after the landing), at least ~60 m apart, up to nJ —
    // a twisty map gets fewer jumps rather than one into a wall; always at least one
    const out = [];
    for (const [f, v] of cand) if (out.length < nJ && v <= 6 && out.every((o) => gapF(o, f) > .08)) out.push(f);
    if (!out.length && cand.length) out.push(cand[0][0]);
    out.forEach((f) => busy.push(f));
    if (!out.length) out.push(onShared(inJ, wJ - inJ, rampScore));   // (never on a sensible track)
    return out.sort((a, b) => a - b);
  })();
  const pads = [[.02, .12], [.24, .38], [.56, .68], [.86, .98], [.32, .46]].map(([a, b], i) => ({ f: onShared(a, b), lat: [0, -2.6, 2.6, 0, 2.6][i] }));
  // (v258, the user: "there shouldn't be a jump in the way to the pit stop") no ramp on the way INTO the pit lane (from
  // 70 m before its entry to 15 m past where the pit wall begins) or where it merges back (v276: from 25 m before the lane starts to rejoin, a jump's flight, to its exit, +15 m); along the walled part a
  // ramp on the main road is harmless (the wall stops a jump too). A ramp there moves to the nearest flat free spot.
  { const PS = PIT_SPECS[def.id], Lt = TRACK.L;
    if (PS) {
      const zones = [[PS.entry - 70, PS.tIn + 15], [PS.tOut - 25, PS.exit + 15]].map(([a, b]) => [a / Lt, b / Lt]);   // (a fast jump flies ~25 m)
      const wd = (f) => { const w = ((f % 1) + 1) % 1; return w > .5 ? w - 1 : w; }, wrap = (f) => ((f % 1) + 1) % 1;
      const inZone = (f) => zones.some(([a, b]) => wd(f) > a && wd(f) < b);
      const gap = (a, b) => { const d = Math.abs(wrap(a) - wrap(b)); return Math.min(d, 1 - d); };
      for (let i = 0; i < ramps.length; i++) {
        if (!inZone(ramps[i])) continue;
        const others = ramps.filter((_, j) => j !== i).concat(pads.map((p) => p.f)), f0 = ramps[i];
        const ok = (f) => !inZone(f) && others.every((o) => gap(o, f) > .05) && gap(f, 0) > .03;
        let best = null, bd = 9, bb = 1e9;
        for (let d = .004; d < .35; d += .004) for (const sg of [1, -1]) {
          const f = wrap(f0 + sg * d); if (!ok(f)) continue;
          if (best != null && d > bd + .04) continue;
          const b = rampScore(f * Lt);   // (v292: the flight and the landing count too)
          if (best == null || b < bb) { best = f; bb = b; if (bd === 9) bd = d; }
        }
        if (best != null) { const k = busy.indexOf(f0); if (k >= 0) busy.splice(k, 1); busy.push(best); ramps[i] = best; }
      }
    } }
  // answer gates: on straights, with nothing (ramp, pad, ice, box) in the 50 m before them
  const gates = [[.12, .36], [.58, .82]].map(([f0, f1]) => {
    for (const m of [.07, .05, .035, .02]) {
      let best = null, bb = 9;
      for (let f = f0; f <= f1; f += .004) {
        if (busy.some((b) => { const d = ((f - b) % 1 + 1) % 1; return d < m || d > 1 - .015; })) continue;
        const s = f * TRACK.L, k = bendAt(s) + bendAt(s - 25) + Math.abs(slopeAt(Math.round(s / STEP))) * 3; if (k < bb) { bb = k; best = f; }
      }
      if (best !== null) { busy.push(best); return best; }
    }
    return (f0 + f1) / 2;
  });
  def.prep = { nJumps: jumpCount(), GATE_AT: gates, PIT_AT: pit, TRACK, TB: tb, BOUNDS: { x0: tb.x0 - 45, x1: tb.x1 + 45, z0: tb.z0 - 45, z1: tb.z1 + 45 }, MID: { x: (tb.x0 + tb.x1) / 2, z: (tb.z0 + tb.z1) / 2 }, BUSY: busy, RAMP_AT: ramps, PAD_AT: pads, HALF: def.half };
  return def.prep;
}
function useTrack(id) {
  const def = TRACK_DEFS[id] || TRACK_DEFS.alps;
  // only one track lives in memory at a time (phones run out of graphics memory otherwise)
  for (const d of Object.values(TRACK_DEFS)) if (d !== def && d.world) { disposeWorld(d.world); d.world = null; }
  TDEF = def; ({ TRACK, TB, BOUNDS, MID, BUSY, RAMP_AT, PAD_AT, GATE_AT, PIT_AT, HALF } = prepTrack(TDEF));
  TUNE.laps = def.laps || LAPS0; TUNE.pitEvery = def.pitEvery || PIT_EVERY0; TUNE.pitLaps = def.pitLaps || (def.pitEvery ? null : PIT_LAPS0);   // (v161) a long lap (Japan) races fewer of them
  if (window.FK && window.FK.onTrack) window.FK.onTrack(def);   // (v269) the debug hub's laps / pit laps
  if (!TDEF.world) TDEF.world = buildWorld(TDEF);
  WORLD = TDEF.world; resize(); applyGfx();
  if (WORLD.secret && WORLD.secret.open) closeSecret(WORLD.secret);   // (the wall is whole again for the next race)
}
const KEEP = new Set();   // materials shared between tracks and racers: never disposed
function disposeWorld(W) {
  const mats = new Set(), geos = new Set();
  W.scene.traverse((o) => { if (o.geometry) geos.add(o.geometry); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => mats.add(x)); });
  for (const g of geos) g.dispose();
  for (const m of mats) { if (KEEP.has(m)) continue; for (const k of ['map', 'emissiveMap']) if (m[k] && m[k] !== ENV) m[k].dispose(); m.dispose(); }
  if (W.scene.background && W.scene.background.dispose) W.scene.background.dispose();
}

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } return t;
}
// a strip along the track between two sideways offsets a → b, heights ya → yb above the road (a = b makes a wall).
// colour(i) gives a vertex colour per segment, uvLen gives texture coordinates (metres per tile), only(i) skips segments.
let STRIP_SKIP = null;   // (v196) while the world is built, the Star Loop stretch is left out of every road strip
function strip(a, b, ya, yb, { colour, uvLen, only } = {}) {
  const N = TRACK.N, pos = [], uv = [], col = [], tiles = uvLen ? Math.round(TRACK.L / uvLen) : 0;
  for (let i = 0; i < N; i++) {
    if (only && !only(i)) continue; if (STRIP_SKIP && STRIP_SKIP(i)) continue;
    const p = tp(i), q = tp(i + 1), A = rolled(p, a, ya), B = rolled(p, b, yb), C = rolled(q, a, ya), D = rolled(q, b, yb);
    pos.push(...A, ...B, ...C, ...B, ...D, ...C);
    if (uvLen) { const v0 = i / N * tiles, v1 = (i + 1) / N * tiles; uv.push(0, v0, 1, v0, 0, v1, 1, v0, 1, v1, 0, v1); }
    if (colour) { const c = colour(i); for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uvLen) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); if (colour) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals(); return g;
}
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, ...o });
// (v266, the user) THE ELECTRIC FIELD: the yellow shield sphere with real 3D lightning on it — eight jagged arcs that
// crawl over the sphere, redrawn 14 times a second, and a glowing core ring; no emoji
const SPARK_N = 5, SPARK_SEG = 6, SHIELD_K = .78;   // (v268, the user: a smaller shield, calmer sparks)
function makeShield() {
  const g = new THREE.Group(); g.add(new THREE.Mesh(WORLD.shieldGeo, WORLD.shieldMat));
  const n = SPARK_N * SPARK_SEG, geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
  const arcs = new THREE.LineSegments(geo, WORLD.sparkMat); arcs.frustumCulled = false; g.add(arcs);   // the white-hot core of each bolt
  // the bolts' yellow glow: every segment is two crossed ribbons, so the lightning stays thick from any angle
  const rg = new THREE.BufferGeometry(), idx = []; rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 8 * 3), 3));
  for (let i = 0; i < n * 2; i++) { const o = i * 4; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); } rg.setIndex(idx);
  const rib = new THREE.Mesh(rg, WORLD.sparkGlow); rib.frustumCulled = false; g.add(rib);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, .035, 6, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd23a', toneMapped: false, transparent: true, opacity: .4 })); g.add(ring);
  g.userData = { arcs, rib, ring, t: 0 }; return g;
}
const _sa = new THREE.Vector3(), _sb = new THREE.Vector3(), _sp = new THREE.Vector3(), _sq = new THREE.Vector3(), _sd = new THREE.Vector3(), _s1 = new THREE.Vector3(), _s2 = new THREE.Vector3();
function sparkShield(g, t) {
  const U = g.userData; if (!U || !U.arcs) return; U.ring.rotation.z = t * 1.7; U.ring.position.y = Math.sin(t * 2.2) * .9;
  if (t - U.t < .1) return; U.t = t;
  const a = U.arcs.geometry.attributes.position, rb = U.rib.geometry.attributes.position, R = 1.47, W = .03; let k = 0, q = 0;
  const quad = (px, py, pz, side) => { rb.setXYZ(q++, px - side.x, py - side.y, pz - side.z); rb.setXYZ(q++, px + side.x, py + side.y, pz + side.z); };
  for (let n = 0; n < SPARK_N; n++) {
    _sa.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(); _sb.copy(_sa).add(_sp.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(.9)).normalize();
    _sq.copy(_sa).multiplyScalar(R);
    for (let s = 1; s <= SPARK_SEG; s++) {
      const u = s / SPARK_SEG, w = W * (1.25 - u * .8); _sp.copy(_sa).lerp(_sb, u).normalize().multiplyScalar(R + rand(-.12, .18)); _sp.x += rand(-.14, .14); _sp.y += rand(-.14, .14); _sp.z += rand(-.14, .14);
      a.setXYZ(k++, _sq.x, _sq.y, _sq.z); a.setXYZ(k++, _sp.x, _sp.y, _sp.z);
      _sd.subVectors(_sp, _sq).normalize(); _s2.copy(_sq).normalize(); _s1.crossVectors(_sd, _s2).normalize().multiplyScalar(w); _s2.multiplyScalar(w);
      quad(_sq.x, _sq.y, _sq.z, _s1); quad(_sp.x, _sp.y, _sp.z, _s1); quad(_sq.x, _sq.y, _sq.z, _s2); quad(_sp.x, _sp.y, _sp.z, _s2);
      _sq.copy(_sp);
    }
  }
  a.needsUpdate = true; rb.needsUpdate = true; const f = .3 + Math.random() * .2; U.arcs.material.opacity = f; U.rib.material.opacity = f * .8;
}
function cone(parent, r, h, y, mat, seg = 8, x = 0, z = 0) { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat); m.position.set(x, y, z); parent.add(m); return m; }
function box(parent, w, h, d, mat, x, y, z, ry = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m; }
function ball(parent, r, mat, x, y, z, seg = 16) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * .7)), mat); m.position.set(x, y, z); parent.add(m); return m; }

// scenery models (built from shapes once, then drawn many times with instancing)
function treeGeo() {
  const g = new THREE.Group(), green = M('#2f8a52'), greenD = M('#25744a'), snow = M('#ffffff'), bark = M('#7a4a2a');
  const t = new THREE.Mesh(new THREE.CylinderGeometry(.22, .3, 1.4, 7), bark); t.position.y = .7; g.add(t);
  [[2.1, 2.4, 2.0], [1.65, 2.1, 3.25], [1.15, 1.8, 4.4]].forEach(([r, h, y], i) => {
    cone(g, r, h, y, i % 2 ? greenD : green, 9);
    const s = cone(g, r * .62, h * .42, y + h * .3, snow, 9); s.rotation.y = .3;
  });
  return bakeOne(g);
}
// the lobby's fir: five tiers, each edge pushed in and out so the branches look ragged and droop a little, a snow cap
// on every tier (a touch blue in the shade), and a stout trunk. Built once, drawn many times.
function firGeo(seed = 1) {
  let r0 = seed * 7919; const rnd = () => { r0 = (r0 * 16807) % 2147483647; return r0 / 2147483647; };
  const g = new THREE.Group(), greens = [M('#2b7d4a'), M('#1f6b3e'), M('#35905a')], snow = M('#f7fbff'), snowB = M('#dfeeff'), bark = M('#6b3f22');
  const t = new THREE.Mesh(new THREE.CylinderGeometry(.2, .32, 1.6, 7), bark); t.position.y = .8; g.add(t);
  const jag = (geo, r, h, droop) => {   // rough up a cone: its base ring goes in and out, and sags
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (v.y < -h * .49 && (v.x || v.z)) { const a = Math.atan2(v.z, v.x), k = 1 + Math.sin(a * 5.3 + seed) * .11 + (rnd() - .5) * .14; v.x *= k; v.z *= k; v.y -= droop * (.6 + rnd() * .8); p.setXYZ(i, v.x, v.y, v.z); } }
    geo.computeVertexNormals(); return geo;
  };
  const tiers = [[2.3, 2.3, 2.0], [1.95, 2.2, 3.1], [1.55, 2.0, 4.2], [1.1, 1.8, 5.25], [.6, 1.4, 6.2]];
  tiers.forEach(([r, h, y], i) => {
    const m = new THREE.Mesh(jag(new THREE.ConeGeometry(r, h, 12), r, h, .18), greens[i % 3]); m.position.y = y; m.rotation.y = i * .4; g.add(m);
    const sc = new THREE.Mesh(jag(new THREE.ConeGeometry(r * .78, h * .36, 12), r * .78, h * .36, .06), i % 2 ? snowB : snow); sc.position.y = y + h * .33; sc.rotation.y = i * .4 + .25; g.add(sc);
  });
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.16, .5, 8), snow); tip.position.y = 7.05; g.add(tip);
  return bakeOne(g);
}
// snow that looks like snow: soft blue drifts, fine grain, and sparkles where the sun catches the crystals
function snowTexture(repeat = [40, 40]) {
  let r0 = 4242; const rnd = () => { r0 = (r0 * 16807) % 2147483647; return r0 / 2147483647; };
  return canvasTex(512, 512, (x) => {
    x.fillStyle = '#f3f7ff'; x.fillRect(0, 0, 512, 512);
    for (let k = 0; k < 90; k++) { x.fillStyle = `rgba(196,214,245,${.18 + rnd() * .2})`; x.beginPath(); x.ellipse(rnd() * 512, rnd() * 512, 30 + rnd() * 90, 6 + rnd() * 16, rnd() * 3.14, 0, 7); x.fill(); }   // drifts
    for (let k = 0; k < 60; k++) { x.fillStyle = `rgba(255,255,255,${.5 + rnd() * .5})`; x.beginPath(); x.ellipse(rnd() * 512, rnd() * 512, 20 + rnd() * 60, 5 + rnd() * 12, rnd() * 3.14, 0, 7); x.fill(); }   // wind-blown ridges
    for (let k = 0; k < 9000; k++) { x.fillStyle = rnd() < .5 ? 'rgba(205,220,245,.35)' : 'rgba(255,255,255,.6)'; x.fillRect(rnd() * 512, rnd() * 512, 1.3, 1.3); }   // grain
    for (let k = 0; k < 320; k++) { const px = rnd() * 512, py = rnd() * 512; x.fillStyle = 'rgba(255,255,255,.95)'; x.fillRect(px, py, 2, 2); if (k % 4 === 0) { x.fillRect(px - 2, py + .5, 6, 1); x.fillRect(px + .5, py - 2, 1, 6); } }   // sparkle
  }, repeat);
}
// an Austrian alpine house (v90): a stone plinth, a white plastered ground floor with green shutters and flower boxes,
// a dark timber upper floor with a carved balcony round the front and one side, a deep two-pitch roof with a snow
// layer, carved purlin ends under the eaves, a chimney, a stack of firewood by the door
function chaletGeo(plasterC = '#f4efe4', shutterC = '#2f7a3a') {
  const g = new THREE.Group(), plaster = M(plasterC, { roughness: .9 }), timber = M('#6a3a1c', { roughness: .85 }), timberL = M('#8a5226', { roughness: .85 }), stone = M('#8f949c', { roughness: .95 });
  const snow = M('#ffffff', { roughness: .9 }), shutter = M(shutterC, { roughness: .7 }), glass = M('#ffe9a8', { emissive: '#ffc860', emissiveIntensity: .45, roughness: .3 }), flower = M('#e8303a', { roughness: .7 }), flower2 = M('#ff6ab0', { roughness: .7 }), leaf = M('#3a8a3a', { roughness: .8 }), roofM = M('#4a2a16', { roughness: .8 });
  const W = 7, D = 6;
  box(g, W + .4, .7, D + .4, stone, 0, .35, 0);                              // the stone plinth
  box(g, W, 2.6, D, plaster, 0, 2, 0);                                         // the plastered ground floor
  box(g, W + .1, 2.6, D + .1, timber, 0, 4.6, 0);                              // the timber upper floor
  for (let k = 0; k < 9; k++) box(g, W + .16, .07, D + .16, timberL, 0, 3.45 + k * .3, 0);   // the plank lines
  // windows: the ground floor (white frames, green shutters, a flower box), the upper floor (smaller, under the balcony)
  const win = (x, y, z, ry, w, h, boxes) => { const q = new THREE.Group(); q.position.set(x, y, z); q.rotation.y = ry; g.add(q);
    box(q, w, h, .1, glass, 0, 0, 0); box(q, w + .14, .1, .14, plaster, 0, h / 2, 0); box(q, .08, h, .14, timber, 0, 0, .02); box(q, w, .08, .14, timber, 0, 0, .02);
    for (const sd of [-1, 1]) box(q, w * .5, h, .08, shutter, sd * (w * .78), 0, .02);
    if (boxes) { box(q, w + .3, .26, .32, timberL, 0, -h / 2 - .14, .14); for (let k = 0; k < 7; k++) { ball(q, .1, k % 2 ? flower : flower2, -w / 2 + k * (w / 6), -h / 2 + .06, .2, 6); ball(q, .09, leaf, -w / 2 + k * (w / 6) + .05, -h / 2 - .02, .28, 6); } } };
  for (const x of [-2.4, 2.4]) win(x, 2.1, D / 2 + .02, 0, 1.1, 1.2, true);
  for (const z of [-1.6, 1.6]) win(W / 2 + .02, 2.1, z, Math.PI / 2, 1.1, 1.2, true);
  for (const x of [-2.2, 0, 2.2]) win(x, 4.7, D / 2 + .07, 0, .9, 1, false);
  win(W / 2 + .07, 4.7, 0, Math.PI / 2, .9, 1, false);
  // the door with a little gable roof over it
  box(g, 1.2, 2, .14, timber, 0, 1.7, D / 2 + .02); box(g, 1.5, .16, .9, roofM, 0, 2.95, D / 2 + .35);
  // the balcony round the front and the right side: a floor, posts, a rail and carved boards
  const balc = (len, x, z, ry) => { const q = new THREE.Group(); q.position.set(x, 3.4, z); q.rotation.y = ry; g.add(q);
    box(q, len, .14, 1, timberL, 0, 0, .5); box(q, len, .12, .12, timber, 0, 1, 1); box(q, len, .1, .1, timber, 0, .12, 1);
    for (let k = 0, n = Math.round(len / .22); k <= n; k++) box(q, .13, .9, .05, (k % 2 ? timber : timberL), -len / 2 + k * len / n, .55, 1); };
  balc(W + 1.2, 0, D / 2, 0); balc(D + 1.2, W / 2, 0, Math.PI / 2);
  // the roof: two deep slopes, a snow layer on each, carved purlin ends, a ridge board, a chimney
  const slope = (sd, mat, lift, ov) => { const m = new THREE.Mesh(new THREE.BoxGeometry((W / 2 + 1.6) / Math.cos(.42), .32, D + 2.4 + ov), mat); m.position.set(sd * (W / 4 + .55), 6.55 + lift, 0); m.rotation.z = -sd * .42; g.add(m); };
  for (const sd of [-1, 1]) { slope(sd, roofM, 0, 0); slope(sd, snow, .26, .1); }
  box(g, .3, .3, D + 2.6, timber, 0, 7.45, 0);
  for (const z of [-1, 1]) for (const x of [-2.6, -1.2, 1.2, 2.6]) box(g, .22, .26, .9, timberL, x, 6.15 - Math.abs(x) * .32, z * (D / 2 + 1.1));
  // the gable: a triangle of timber under the roof at the front and back
  for (const z of [-1, 1]) { const sh = new THREE.Shape(); sh.moveTo(-W / 2 - .05, 0); sh.lineTo(0, 1.6); sh.lineTo(W / 2 + .05, 0); sh.lineTo(-W / 2 - .05, 0); const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), timber); m.position.set(0, 5.9, z * (D / 2 + .06)); if (z < 0) m.rotation.y = Math.PI; g.add(m); }
  box(g, .8, 1.8, .8, stone, 1.6, 7.6, -1.2); box(g, 1, .2, 1, snow, 1.6, 8.55, -1.2);
  // a stack of firewood by the door
  for (let k = 0; k < 12; k++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 1.1, 7), timberL); l.rotation.x = Math.PI / 2; l.position.set(-1.6 + (k % 4) * .26, .82 + Math.floor(k / 4) * .24, D / 2 + .5); g.add(l); }
  return bakeOne(g);
}
function snowmanGeo() {
  const g = new THREE.Group(), snow = M('#ffffff'), coal = M('#1e2026'), carrot = M('#ff7a1e'), scarf = M('#e8403a');
  ball(g, .8, snow, 0, .7, 0); ball(g, .58, snow, 0, 1.75, 0); ball(g, .42, snow, 0, 2.55, 0);
  const n = cone(g, .09, .5, 2.55, carrot, 8, 0, .62); n.rotation.x = Math.PI / 2;
  ball(g, .06, coal, -.15, 2.68, .36, 8); ball(g, .06, coal, .15, 2.68, .36, 8);
  for (const y of [1.6, 1.85, 2.1]) ball(g, .07, coal, 0, y, .55, 8);
  const sc = new THREE.Mesh(new THREE.TorusGeometry(.4, .1, 8, 20), scarf); sc.rotation.x = Math.PI / 2; sc.position.y = 2.2; g.add(sc);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .5, 16), coal); hat.position.y = 3.05; g.add(hat);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(.48, .48, .06, 16), coal); brim.position.y = 2.82; g.add(brim);
  return bakeOne(g);
}
// a little Rob-style robot fan (cyan body, black screen face, antenna with a red heart) for the Robo City crowd
function robotFanGeo() {
  const g = new THREE.Group(), cyan = M('#3ad8e8', { roughness: .35 }), dark = M('#151a24', { roughness: .3 }), white = M('#ffffff'), red = M('#ff3a5a'), orange = M('#ffa23a');
  ball(g, .7, cyan, 0, 1.05, 0, 18); box(g, .9, .55, .1, dark, 0, 1.25, .62); box(g, .16, .16, .04, white, -.2, 1.3, .68); box(g, .16, .16, .04, white, .2, 1.3, .68);
  box(g, .3, .22, .06, orange, 0, .8, .66); const a = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .5, 6), dark); a.position.y = 1.95; g.add(a); ball(g, .12, red, 0, 2.22, 0, 10);
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .7, 8), cyan); arm.position.set(s * .75, 1.45, 0); arm.rotation.z = s * -.6; g.add(arm); ball(g, .14, cyan, s * .95, 1.78, 0, 10); }
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .45, 8), dark); leg.position.set(s * .28, .23, 0); g.add(leg); }
  return bakeOne(g);
}
function cloudGeo(tint = '#ffffff') {
  const g = new THREE.Group(), w = M(tint, { roughness: 1 });
  [[0, 0, 0, 6], [5, -1, 1, 4.5], [-5, -1.2, .5, 4.2], [2.5, 2.2, -1, 4], [-2.5, 1.6, 1, 3.6], [8.5, -2, 0, 3]].forEach(([x, y, z, r]) => ball(g, r, w, x, y, z, 12));
  return bakeOne(g);
}
function mountainGeo(seed) {
  const g = new THREE.ConeGeometry(1, 1, 9, 5).toNonIndexed(), p = g.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + .5, a = Math.atan2(p.getX(i), p.getZ(i)), j = y < .98 ? (Math.sin(a * 3 + seed) * .12 + Math.sin(a * 7 + seed * 2) * .06) * (1 - y) : 0;
    p.setX(i, p.getX(i) * (1 + j)); p.setZ(i, p.getZ(i) * (1 + j)); p.setY(i, y + Math.sin(a * 5 + seed) * .03 * (1 - y));
  }
  g.computeVertexNormals();
  for (let i = 0; i < p.count; i += 3) {
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, snowy = y > .5 + Math.sin(i * .37 + seed) * .08;
    const c = new THREE.Color(snowy ? '#f6faff' : y > .25 ? '#7d8ba8' : '#5f8a74');
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
}
function addMountains(scene, cx, cz, r0, r1, count) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: true });
  for (let k = 0; k < count; k++) {
    const a = k / count * Math.PI * 2 + rand(-.08, .08), r = rand(r0, r1), h = rand(70, 150), m = new THREE.Mesh(mountainGeo(k * 1.7), mat);
    m.scale.set(h * rand(.75, 1.05), h, h * rand(.75, 1.05)); m.position.set(cx + Math.cos(a) * r, -2, cz + Math.sin(a) * r); m.rotation.y = rand(0, 6); scene.add(m);
  }
}
let PIT_CLEAR = false;   // (v177) while a map's scenery is built: nothing stands on the pit lane or its garages
function instanced(scene, geo, mat, list, shadow = true) {
  if (PIT_CLEAR && WORLD && WORLD.pitDist) list = list.filter((d) => WORLD.pitDist(d.x, d.z) > 18);
  const im = new THREE.InstancedMesh(geo, mat, list.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  list.forEach((d, i) => { e.set(0, d.ry || 0, 0); q.setFromEuler(e); m.compose(new THREE.Vector3(d.x, d.y || 0, d.z), q, new THREE.Vector3(d.sx || d.s, d.sy || d.s, d.sz || d.s)); im.setMatrixAt(i, m); if (d.c) im.setColorAt(i, new THREE.Color(d.c)); });
  im.castShadow = shadow; im.receiveShadow = false; scene.add(im); return im;
}
function questionTex() {
  return canvasTex(128, 128, (x) => {
    const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#b47cff'); g.addColorStop(1, '#6a2ad8'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = '#2a1060'; x.lineWidth = 10; x.strokeRect(5, 5, 118, 118); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(16, 14, 40, 10);
    x.font = 'bold 92px Fredoka, Arial Rounded MT Bold, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 12; x.strokeStyle = '#2a1060'; x.strokeText('?', 64, 70); x.fillStyle = '#fff'; x.fillText('?', 64, 70);
  });
}
function nameSprite(text, color) {
  const t = canvasTex(256, 72, (x) => {
    x.font = 'bold 40px Fredoka, Arial Rounded MT Bold, Arial'; const w = Math.min(240, x.measureText(text).width + 36);
    x.fillStyle = css(color); x.strokeStyle = '#1b2a4a'; x.lineWidth = 6; x.beginPath(); x.roundRect((256 - w) / 2, 8, w, 54, 27); x.fill(); x.stroke();
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 7; x.strokeText(text, 128, 37); x.fillStyle = '#fff'; x.fillText(text, 128, 37);
  });
  // the same size on screen at any distance (no giant tags right in front of the camera)
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true, sizeAttenuation: false })); s.scale.set(.15, .042, 1); return s;
}
const farFromRoad = (x, z, m, step = 4) => {
  const P = (WORLD && WORLD.roadPts) || TRACK.pts; for (let i = 0; i < P.length; i += step) if ((P[i].x - x) ** 2 + (P[i].z - z) ** 2 < (HALF + m) ** 2) return false;   // (v199: every road variant too)
  const pp = WORLD && WORLD.pitPath;   // (v152) and clear of the pit lane, garages and all
  if (pp) { const r2 = (16 + Math.max(0, m - 8) * 1.7) ** 2; for (let i = 0; i < pp.length; i++) if ((pp[i].x - x) ** 2 + (pp[i].z - z) ** 2 < r2) return false; }   // (v177: bigger things keep further off)
  return true;
};
const groundY = (x, z) => (WORLD && WORLD.groundAt ? WORLD.groundAt(x, z) : 0);

// a stretch where the road opens onto the beach: the wall on the outer side goes, you may drive 7.5 m out, the sea stops you
function prepWide(W, def) {
  const N = TRACK.N, i0 = Math.round(def.wide[0] * N), i1 = Math.round(def.wide[1] * N); let sum = 0;
  for (let i = i0; i <= i1; i++) { const p = tp(i); sum += (p.x - MID.x) * p.nx + (p.z - MID.z) * p.nz; }
  const side = sum >= 0 ? 1 : -1; for (let i = i0; i <= i1; i++) { W.openSide[i] = side; W.openLim[i] = HALF + 7.5; }
  W.wide = { i0, i1, side };
  // where a point is in relation to the open stretch: how far out on the beach side (lat, metres from the centre line) and the road height there
  W.latOut = (x, z) => { let bi = -1, bd = 1e9; for (let i = i0; i <= i1; i += 2) { const p = tp(i), d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; bi = i; } } if (bi < 0 || bd > 90 * 90) return null; const p = tp(bi); return { lat: ((x - p.x) * p.nx + (z - p.z) * p.nz) * side, y: p.y, i: bi }; };
  W.inWater = (x, z) => { const r = W.latOut(x, z); return !!r && r.lat > HALF + 5 && r.i > i0 + 4 && r.i < i1 - 4; };
}
// the secret path (Gold Mines): the pair of road points far apart along the lap but close across the ground where a
// straight path saves the most; the wall is cracked there (breakable), a dirt path crosses to the other leg
function prepSecret(scene, W, def) {
  const P = TRACK.pts, N = TRACK.N; let best = null;
  for (let i = 50; i < N - 50; i += 2) for (let j = i + 90; j < N - 50 && j - i < 400; j += 2) {   // (a hairpin: under 240 m round, under 64 m across, away from the start line)
    const dd = Math.hypot(P[i].x - P[j].x, P[i].z - P[j].z); if (dd > 64 || dd < 24) continue;
    const score = (j - i) * STEP - dd - Math.abs(P[i].y - P[j].y) * 15; if (!best || score > best.score) best = { i, j, dd, score };
  }
  if (!best) return;
  const { i, j } = best, pi = P[i], pj = P[j], side = Math.sign((pj.x - pi.x) * pi.nx + (pj.z - pi.z) * pi.nz) || 1, sideJ = Math.sign((pi.x - pj.x) * pj.nx + (pi.z - pj.z) * pj.nz) || 1;
  const WO = HALF + (def.wallOut ?? .95), A = { x: pi.x + pi.nx * side * WO, z: pi.z + pi.nz * side * WO, y: pi.y }, B = { x: pj.x + pj.nx * sideJ * WO, z: pj.z + pj.nz * sideJ * WO, y: pj.y };
  const S = W.secret = { i0: i - 9, i1: i + 9, j0: j - 9, j1: j + 9, side, sideJ, A, B, open: false, f: i / N };
  for (let k = S.i0; k <= S.i1; k++) W.secretSide[(k + N) % N] = side; for (let k = S.j0; k <= S.j1; k++) W.secretSide[(k + N) % N] = sideJ;
  const dx = B.x - A.x, dz = B.z - A.z, L2 = dx * dx + dz * dz;
  S.inside = (x, z, m = 0) => { const t = ((x - A.x) * dx + (z - A.z) * dz) / L2; if (t < -.08 || t > 1.08) return false; const px = A.x + dx * t, pz = A.z + dz * t; return Math.hypot(x - px, z - pz) < 4.5 + m; };
  // the cracked wall: one stone block per road point on both legs, with a glint of gold in the cracks
  const crack = canvasTex(64, 64, (x) => { x.fillStyle = '#6a5a70'; x.fillRect(0, 0, 64, 64); x.strokeStyle = '#2a2030'; x.lineWidth = 2; for (let k = 0; k < 7; k++) { x.beginPath(); x.moveTo(rand(0, 64), 0); x.lineTo(rand(0, 64), 64); x.stroke(); } x.fillStyle = '#ffd23a'; for (let k = 0; k < 10; k++) x.fillRect(rand(0, 60), rand(0, 60), 3, 3); });
  const g = new THREE.Group(), bm = new THREE.MeshStandardMaterial({ map: crack, roughness: .9 }), bg = def.tube ? new THREE.BoxGeometry(.5, 3.8, STEP + .08).translate(0, 1.9, 0) : new THREE.BoxGeometry(.4, 1.05, STEP + .08).translate(0, .52, 0);   // (v109: in the tunnel the cracked wall fills the whole doorway)
  for (const [k0, k1, sd] of [[S.i0, S.i1, side], [S.j0, S.j1, sideJ]]) for (let k = k0; k <= k1; k++) { const p = tp(k), m = new THREE.Mesh(bg, bm); m.position.set(p.x + p.nx * sd * WO, p.y, p.z + p.nz * sd * WO); m.rotation.y = Math.atan2(p.tx, p.tz); m.castShadow = true; g.add(m); }
  scene.add(g); S.mesh = g;
  // the dirt path across: a ribbon from one opening to the other, sloping between the two road heights
  const n = 10, pos = [], uv = [], len = Math.sqrt(L2), ux = -dz / len, uz = dx / len, dirt = canvasTex(128, 128, (x) => { x.fillStyle = '#7a5a34'; x.fillRect(0, 0, 128, 128); for (let k = 0; k < 900; k++) { x.fillStyle = Math.random() < .5 ? 'rgba(0,0,0,.2)' : 'rgba(255,220,160,.12)'; x.fillRect(rand(0, 128), rand(0, 128), rand(1, 3), rand(1, 3)); } }, [1, 6]);
  for (let k = 0; k < n; k++) {
    const t0 = k / n, t1 = (k + 1) / n, c = (t) => [A.x + dx * t, A.y + (B.y - A.y) * t + .05, A.z + dz * t];
    const [x0, y0, z0] = c(t0), [x1, y1, z1] = c(t1), w = 4.6 + Math.sin(t0 * Math.PI) * 1.2, w1 = 4.6 + Math.sin(t1 * Math.PI) * 1.2;
    pos.push(x0 - ux * w, y0, z0 - uz * w, x0 + ux * w, y0, z0 + uz * w, x1 - ux * w1, y1, z1 - uz * w1, x0 + ux * w, y0, z0 + uz * w, x1 + ux * w1, y1, z1 + uz * w1, x1 - ux * w1, y1, z1 - uz * w1);
    uv.push(0, t0, 1, t0, 0, t1, 1, t0, 1, t1, 0, t1);
  }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); pg.computeVertexNormals();
  const path = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: dirt, roughness: .95, side: THREE.DoubleSide })); path.receiveShadow = true; scene.add(path);
}
function openSecret(S) {
  const W = WORLD, N = TRACK.N; S.open = true; S.mesh.visible = false;
  for (let k = S.i0; k <= S.i1; k++) { W.openSide[(k + N) % N] = S.side; W.openLim[(k + N) % N] = 1e9; }
  for (let k = S.j0; k <= S.j1; k++) { W.openSide[(k + N) % N] = S.sideJ; W.openLim[(k + N) % N] = 1e9; }
  burst(S.A.x, S.A.y + .8, S.A.z, '#c8a070', 26); burst(S.A.x, S.A.y + .6, S.A.z, '#ffd23a', 10); sfx.boom(); if (race) race.shake = .5; buzz([40, 30, 60]);
  toast(`${ico('icon-strong')} SECRET PATH!`, '#ffe14a', 40); L.say('A secret path!');
}
function closeSecret(S) { const W = WORLD, N = TRACK.N; S.open = false; S.mesh.visible = true; for (const [k0, k1] of [[S.i0, S.i1], [S.j0, S.j1]]) for (let k = k0; k <= k1; k++) { W.openSide[(k + N) % N] = 0; W.openLim[(k + N) % N] = 0; } }
// (v199) the scenery was laid out round the usual road; whatever of it stands on (or right beside) any road variant goes:
// single instances of an instanced crowd (trees, lamps, crystals…) and small single meshes. Things high overhead stay.
function clearRoads(roots, W) {
  const M4 = new THREE.Matrix4(), v = new THREE.Vector3(), sph = new THREE.Sphere(), Z = new THREE.Matrix4().makeScale(0, 0, 0); let n = 0;
  const hit = (x, y, z, m) => { const q = W.onRoads(x, z, HALF + m); return q && y - q.y < 3.6 && y - q.y > -4; };
  for (const root of roots) root.traverse((o) => {
    if (o.isInstancedMesh) {
      o.updateMatrixWorld(true); let ch = false;
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, M4); v.setFromMatrixPosition(M4).applyMatrix4(o.matrixWorld); if (hit(v.x, v.y, v.z, 1.4)) { o.setMatrixAt(i, Z); ch = true; n++; } }
      if (ch) { o.instanceMatrix.needsUpdate = true; o.computeBoundingSphere && o.computeBoundingSphere(); }
    } else if ((o.isMesh || o.isSprite || o.isPoints) && o.geometry) {
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); o.updateMatrixWorld(true);
      sph.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld); if (sph.radius > 9) return;
      if (hit(sph.center.x, sph.center.y - Math.min(sph.radius, 2), sph.center.z, 1.2 + Math.min(sph.radius, 4))) { o.visible = false; n++; }
    }
  });
  if (n) console.log(`road variants: ${n} pieces of scenery cleared off them`);
}
function buildWorld(def) {
  if (TRACK.routes) TRACK.pts = TRACK.routes[0];   // (v194) the world is built along the first route
  STRIP_SKIP = TRACK.routes ? ((i) => i >= TRACK.sec.i0 && i < TRACK.sec.i1) : null;   // (v196) the stretch is built per variant
  const W = { def, ice: [], boxes: [], coins: [], pads: [], ramps: [], balloons: [], spin: [], anim: [], walls: new Uint8Array(TRACK.N) }; WORLD = W;
  W.rh = routeHide();
  // (v199) every road there is: the lap, plus each variant's stretch (with its neighbours, for the ground's heights)
  W.roadPts = TRACK.pts; W.roadNb = null; W.onRoads = null;
  if (TRACK.routes && TRACK.sec.ground) {
    const { i0, i1 } = TRACK.sec, N = TRACK.N, U = TRACK.pts.slice(), NB = U.map((_, i) => [(i - 1 + N) % N, (i + 1) % N]), sec = [];
    for (let r = 0; r < TRACK.routes.length; r++) { const R = TRACK.routes[r], at0 = U.length;
      for (let i = i0 + 1; i < i1; i++) { if (r) { U.push(R[i]); NB.push([i === i0 + 1 ? i0 : U.length - 2, i === i1 - 1 ? i1 : U.length]); } sec.push(R[i]); } }
    W.roadPts = U; W.roadNb = NB;
    // a grid of every variant's stretch: is (x, z) within m metres of the middle of any of those roads?
    const CELL = 8, G = new Map(), key = (x, z) => Math.floor(x / CELL) + ',' + Math.floor(z / CELL);
    for (const q of sec) { const k = key(q.x, q.z); (G.get(k) || G.set(k, []).get(k)).push(q); }
    W.onRoads = (x, z, m) => { const n = Math.ceil(m / CELL), cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) { const l = G.get((cx + a) + ',' + (cz + b)); if (l) for (const q of l) if ((q.x - x) ** 2 + (q.z - z) ** 2 < m * m) return q; } return null; };
  }
  // openings in the walls: openSide[i] = the side that is open (+1 / −1), openLim[i] how far you may go there; secretSide = a breakable wall
  W.openSide = new Int8Array(TRACK.N); W.openLim = new Float32Array(TRACK.N); W.secretSide = new Int8Array(TRACK.N); W.inWater = () => false;
  if (def.wide) prepWide(W, def);   // (before the ground, which digs the sea bed)
  prepPit(W, def);                  // (v152) the pit lane, before the walls and the scenery, which both keep clear of it
  const scene = new THREE.Scene(); W.scene = scene;
  scene.background = skyTexture(def.sky); scene.environment = ENV; scene.environmentIntensity = def.envI ?? .85;   // (v96: a little less reflected sky, so the colours are not washed out) scene.fog = new THREE.Fog(def.fog[0], def.fog[1], def.fog[2]);
  W.sun = addLights(scene, 1024, 15, def);
  const P = TRACK.pts, N = TRACK.N, space = def.edge === 'void';
  THEMES[def.id].ground(scene, W, def);
  // the road: asphalt (or a glowing space road) with speckles and a dashed centre line
  const drawRoad = (line) => (x, w, h) => {
    // (v276) a fixed seed: the road and the pit lane get the very same grain, so a lane lying on the road cannot be told from it
    let sd = 276; const rnd = () => { sd = (sd + 0x6D2B79F5) | 0; let t = Math.imul(sd ^ (sd >>> 15), 1 | sd); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }, rand = (a, b) => a + rnd() * (b - a);
    x.fillStyle = def.road; x.fillRect(0, 0, w, h);
    if (space) { x.strokeStyle = 'rgba(122,248,255,.35)'; x.lineWidth = 2; for (let k = 0; k <= 4; k++) { x.beginPath(); x.moveTo(k * w / 4, 0); x.lineTo(k * w / 4, h); x.stroke(); } for (let k = 0; k <= 8; k++) { x.beginPath(); x.moveTo(0, k * h / 8); x.lineTo(w, k * h / 8); x.stroke(); } }
    else {
      for (let k = 0; k < 2600; k++) { x.fillStyle = rnd() < .3 ? 'rgba(255,255,255,.05)' : 'rgba(30,34,44,.1)'; x.fillRect(rand(0, w), rand(0, h), rand(1, 2.5), rand(1, 2.5)); }
      x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(w * .2, 0, w * .12, h); x.fillRect(w * .68, 0, w * .12, h);   // two worn tyre lanes
    }
    if (line) { x.fillStyle = def.line; x.fillRect(w / 2 - 3, 0, 6, h * .42); }
  };
  const roadTex = canvasTex(128, 512, drawRoad(true));
  roadTex.wrapT = THREE.RepeatWrapping;
  const roadLook = (tex) => ({ map: tex, fog: !def.clearRoad, roughness: space ? .35 : .82, metalness: space ? .2 : 0, ...(space ? { emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: .35, side: THREE.DoubleSide } : {}) });
  const roadMat = new THREE.MeshStandardMaterial(roadLook(roadTex));
  // (v181, the user) the pit lane is paved with the same road (no centre line: it has its own edge lines)
  if (PITS) { const pt = canvasTex(128, 512, drawRoad(false)); pt.wrapS = pt.wrapT = THREE.RepeatWrapping; W.pitRoadMat = new THREE.MeshStandardMaterial({ ...roadLook(pt), polygonOffset: true, polygonOffsetFactor: -2 }); }
  // kerbs: two colours that alternate (they glow in space)
  const k1 = new THREE.Color(def.kerb[0]), k2 = new THREE.Color(def.kerb[1]), kerbC = (i) => (Math.floor(i / 4) % 2 ? k2 : k1);
  const vc = space ? new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7, fog: !def.clearRoad });
  const KH = def.kerbH || .12;
  // (v199) the road, its kerbs and its walls: once for the lap, then again for every road variant's stretch (its own group)
  let roadPass = 0;
  const roadMeshes = () => {
  if (roadPass && def.monaco) {   // (v199) a variant crossing the overpass: its own deck, skirts and pillars
    const deck = W.deckMat || (W.deckMat = new THREE.MeshStandardMaterial({ map: concreteTex(), roughness: .95, side: THREE.DoubleSide }));
    scene.add(new THREE.Mesh(strip(-HALF - 1.1, HALF + 1.1, -.55, -.55, { only: (i) => tp(i).y > .4 }), deck));
    for (const s of [-1, 1]) scene.add(new THREE.Mesh(strip(s * (HALF + 1.1), s * (HALF + 1.1), -.55, 0, { only: (i) => tp(i).y > .4 }), deck));
    const lowRoad = (x, z) => W.roadPts.some((q) => q.y < .4 && (q.x - x) ** 2 + (q.z - z) ** 2 < (HALF + 1.2) ** 2), pil = [];
    for (let i = 0; i < TRACK.N; i += 14) { if (STRIP_SKIP(i)) continue; const p = tp(i); if (p.y > 1.5) for (const s of [-1, 1]) { const x = p.x + p.nx * s * 4, z = p.z + p.nz * s * 4; if (!lowRoad(x, z)) pil.push({ x, z, s: 1, sy: p.y - .5, sx: 1, sz: 1 }); } }
    if (pil.length) instanced(scene, new THREE.CylinderGeometry(.6, .7, 1, 12).translate(0, .5, 0), W.pillarMat || (W.pillarMat = M('#b9b7b0', { roughness: .9 })), pil);
  }
  const road = new THREE.Mesh(strip(-HALF, HALF, .03, .03, { uvLen: 12 }), roadMat); road.receiveShadow = true; scene.add(road);
  for (const s of [-1, 1]) {
    const keep = (i) => !(W.pitMouth && PITS && s === PITS.side && W.pitMouth[i]) && !(W.rh && W.rh[0][s][i]);   // (v153) no kerb across a pit-lane mouth (v194: nor between two routes)
    const k = s > 0 ? strip(HALF, HALF + .9, .03, KH, { colour: kerbC, only: keep }) : strip(-HALF - .9, -HALF, KH, .03, { colour: kerbC, only: keep });
    const km = new THREE.Mesh(k, vc); km.receiveShadow = true; scene.add(km);
  }
  if (def.kerbH) for (const s of [-1, 1]) scene.add(new THREE.Mesh(strip(s * (HALF + .9), s * (HALF + .9), 0, def.kerbH, { colour: kerbC }), vc));
  // walls all round every track, so nobody can leave the road: striped walls in Robo City, glowing rails in space,
  // red-and-white ski-race fences in the Alps
  {
    const snow = def.edge === 'snow';
    if (!roadPass) { W.walls.fill(1); if (def.secret) prepSecret(scene, W, def); }
    const wallTex = canvasTex(64, 64, (x) => { if (snow || def.wall === 'redwhite') { x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#e8403a'; x.fillRect(0, 0, 64, 32); x.fillStyle = 'rgba(27,42,74,.35)'; x.fillRect(0, 0, 6, 64); } else if (space) { x.fillStyle = 'rgba(122,248,255,.25)'; x.fillRect(0, 0, 64, 64); x.fillStyle = 'rgba(122,248,255,.95)'; x.fillRect(0, 0, 64, 7); x.fillRect(0, 57, 64, 7); } else if (def.wall === 'wood') { x.fillStyle = '#c8955a'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#8a5a2a'; for (const y of [14, 30, 46]) x.fillRect(0, y, 64, 4); x.fillStyle = 'rgba(0,0,0,.18)'; for (let k = 0; k < 40; k++) x.fillRect(rand(0, 64), rand(0, 64), rand(1, 3), 1); x.fillStyle = '#6a4220'; x.fillRect(0, 0, 7, 64); } else { for (let k = -2; k < 4; k++) { x.fillStyle = '#ffd23a'; x.fillRect(0, 0, 64, 64); } x.fillStyle = '#1b2a4a'; for (let k = -2; k < 4; k++) { x.beginPath(); x.moveTo(k * 32, 64); x.lineTo(k * 32 + 16, 64); x.lineTo(k * 32 + 48, 0); x.lineTo(k * 32 + 32, 0); x.fill(); } } });
    wallTex.wrapT = THREE.RepeatWrapping;
    const wallMat = space ? new THREE.MeshBasicMaterial({ map: wallTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }) : new THREE.MeshStandardMaterial({ map: wallTex, roughness: .6, side: THREE.DoubleSide, fog: !def.clearRoad });
    if (def.monaco) {
      // (v293, the user: "make the environment more park-like, not in the cages — the barriers should be bushes or
      // planters") the Monaco steel barrier, its posts and the debris fence above it are gone: the road is lined by a
      // long stone planter (its face where the wall always was, so nothing changes for the karts) with a trimmed hedge
      // growing out of it, rounded on top. You look over it into the park.
      const open = (i, sd) => W.walls[i] && W.openSide[i] !== sd && W.secretSide[i] !== sd && !(STRIP_SKIP && STRIP_SKIP(i));
      const stoneT = W.parkStone || (W.parkStone = canvasTex(128, 64, (x) => {
        x.fillStyle = '#ddd3c0'; x.fillRect(0, 0, 128, 64);
        for (let k = 0; k < 500; k++) { x.fillStyle = Math.random() < .5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.12)'; x.fillRect(rand(0, 128), rand(0, 64), rand(1, 4), rand(1, 2)); }
        x.fillStyle = 'rgba(90,70,50,.28)'; x.fillRect(0, 0, 128, 3); x.fillRect(0, 61, 128, 3); x.fillRect(0, 0, 2, 64); x.fillRect(64, 0, 2, 64);   // the joints between the blocks
      }));
      stoneT.wrapS = stoneT.wrapT = THREE.RepeatWrapping;
      const hedgeT = W.parkHedge || (W.parkHedge = canvasTex(128, 128, (x) => {
        x.fillStyle = '#2f6e2c'; x.fillRect(0, 0, 128, 128);
        for (let k = 0; k < 1500; k++) { const g = rand(0, 1); x.fillStyle = g < .4 ? '#245a22' : g < .75 ? '#3c8236' : g < .95 ? '#4f9a42' : '#6bb352'; x.beginPath(); x.ellipse(rand(0, 128), rand(0, 128), rand(1.5, 3.5), rand(1, 2.4), rand(0, 3), 0, 6.3); x.fill(); }
      }));
      hedgeT.wrapS = hedgeT.wrapT = THREE.RepeatWrapping;
      const stoneM = new THREE.MeshStandardMaterial({ map: stoneT, roughness: .9, side: THREE.DoubleSide, fog: !def.clearRoad });
      const hedgeM = new THREE.MeshStandardMaterial({ map: hedgeT, roughness: 1, side: THREE.DoubleSide, fog: !def.clearRoad });
      const H = HALF + .95, Wd = 1.05, PH = .52, HH = 1.28;   // (the planter: from the wall line out 1.05 m, .52 m tall; the hedge to 1.28 m)
      for (const sd of [-1, 1]) {
        const o = { only: (i) => open(i, sd) }, L = (d) => sd * (H + d);
        const add = (m, sh) => { m.castShadow = !!sh; m.receiveShadow = true; scene.add(m); };
        add(new THREE.Mesh(strip(L(0), L(0), 0, PH, { uvLen: 2, ...o }), stoneM), true);                // the planter's face
        add(new THREE.Mesh(strip(L(0), L(.12), PH, PH, o), stoneM));                                     // its lip
        add(new THREE.Mesh(strip(L(Wd), L(Wd), 0, PH, { uvLen: 2, ...o }), stoneM));                     // its back
        add(new THREE.Mesh(strip(L(.12), L(.12), PH, HH - .14, { uvLen: 2.4, ...o }), hedgeM), true);    // the hedge
        add(new THREE.Mesh(strip(L(.12), L(.3), HH - .14, HH, { uvLen: 2.4, ...o }), hedgeM));
        add(new THREE.Mesh(strip(L(.3), L(Wd - .3), HH, HH, { uvLen: 2.4, ...o }), hedgeM));
        add(new THREE.Mesh(strip(L(Wd - .3), L(Wd - .1), HH, HH - .14, { uvLen: 2.4, ...o }), hedgeM));
        add(new THREE.Mesh(strip(L(Wd - .1), L(Wd - .1), PH, HH - .14, { uvLen: 2.4, ...o }), hedgeM));
      }
    } else if (def.wallStyles) {
      // (v98) runs of ~70 m: 0 futuristic concrete with a glowing blue line, 1 yellow/black barrier, 2 a planter with a hedge
      const style = (i) => Math.floor(i / 115) % 3, open = (i, sd) => W.walls[i] && W.openSide[i] !== sd && W.secretSide[i] !== sd && !(STRIP_SKIP && STRIP_SKIP(i));
      const conc = canvasTex(128, 64, (x) => { x.fillStyle = '#b8bcc8'; x.fillRect(0, 0, 128, 64); for (let k = 0; k < 600; k++) { x.fillStyle = Math.random() < .5 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.08)'; x.fillRect(rand(0, 128), rand(0, 64), 2, 2); } x.fillStyle = '#6a7080'; x.fillRect(0, 0, 3, 64); x.fillStyle = '#1b2a4a'; x.fillRect(0, 10, 128, 9); x.fillStyle = '#5fe8ff'; x.fillRect(0, 12, 128, 5); });
      const concE = canvasTex(128, 64, (x) => { x.fillStyle = '#000'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#5fe8ff'; x.fillRect(0, 12, 128, 5); }); conc.wrapT = concE.wrapT = THREE.RepeatWrapping;
      const concM = new THREE.MeshStandardMaterial({ map: conc, emissive: '#ffffff', emissiveMap: concE, emissiveIntensity: 1, roughness: .7, side: THREE.DoubleSide, fog: !def.clearRoad });
      for (const sd of [-1, 1]) {
        const m0 = new THREE.Mesh(strip(sd * (HALF + .95), sd * (HALF + .95), 0, 1.15, { uvLen: 3, only: (i) => open(i, sd) && style(i) === 0 }), concM); m0.castShadow = true; scene.add(m0);
        const m1 = new THREE.Mesh(strip(sd * (HALF + .95), sd * (HALF + .95), 0, 1.05, { uvLen: 2, only: (i) => open(i, sd) && style(i) === 1 }), wallMat); m1.castShadow = true; scene.add(m1);
        const m2 = new THREE.Mesh(strip(sd * (HALF + .95), sd * (HALF + .95), 0, .55, { only: (i) => open(i, sd) && style(i) === 2 }), M('#8a8e98', { roughness: .8, side: THREE.DoubleSide, fog: !def.clearRoad })); scene.add(m2);
        scene.add(new THREE.Mesh(strip(sd * (HALF + .8), sd * (HALF + 1.1), 1.15, 1.15, { only: (i) => open(i, sd) && style(i) === 0 }), M('#8a909c', { roughness: .6, fog: !def.clearRoad })));
      }
      // the hedges in the planters
      const hedge = []; for (let i = 0; i < TRACK.N; i += 2) if (style(i) === 2) for (const sd of [-1, 1]) if (open(i, sd)) { const p = tp(i); hedge.push({ x: p.x + p.nx * sd * (HALF + 1.05), y: p.y + .55, z: p.z + p.nz * sd * (HALF + 1.05), s: rand(.85, 1.1) }); }
      instanced(scene, new THREE.IcosahedronGeometry(.62, 1), M('#3a9a4a', { roughness: .9, flatShading: true }), hedge, false);
    } else if (!def.tube)
    for (const s of [-1, 1]) { const m = new THREE.Mesh(strip(s * (HALF + .95), s * (HALF + .95), 0, 1.05, { uvLen: 2, only: (i) => W.walls[i] && W.openSide[i] !== s && W.secretSide[i] !== s && !(W.rh && W.rh[0][s][i]) }), wallMat); m.castShadow = !space; scene.add(m); }
    if (TRACK.routes && space && !roadPass) buildRouteRoads(scene, W, def, roadMat, vc, wallMat, kerbC);   // (v194) the TWISTER and the SKY HILL
    if (!space && !def.wallStyles && !def.tube) { const top = M(snow || def.wall === 'redwhite' ? '#ffffff' : def.wall === 'wood' ? '#a87040' : '#2a2e3a', { roughness: .5, fog: !def.clearRoad }); for (const s of [-1, 1]) scene.add(new THREE.Mesh(strip(s * (HALF + .8), s * (HALF + 1.1), 1.05, 1.05, { only: (i) => W.walls[i] && W.openSide[i] !== s && W.secretSide[i] !== s }), top)); }
  }
  };
  roadMeshes();
  if (TRACK.routes && TRACK.sec.ground) {
    const { i0, i1 } = TRACK.sec, skip = STRIP_SKIP, add0 = scene.add;
    W.routeGroups = TRACK.routes.map((R, r) => {
      const g = new THREE.Group(); g.visible = r === 0; TRACK.pts = R; STRIP_SKIP = (i) => i < i0 || i >= i1; roadPass++;
      scene.add = function (...o) { g.add(...o); return this; };
      try { roadMeshes(); styleStretch(g, def, r); } finally { scene.add = add0; }   // (v264: and this variant's track type)
      scene.add(g); return g;
    });
    TRACK.pts = TRACK.routes[0]; STRIP_SKIP = skip;   // (v206: no name gate)
  }
  // the start / finish line and the big start gantry
  const s0 = P[0], chk = canvasTex(256, 32, (x) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i * 16, j * 16, 16, 16); } });
  {
    const pos = [], uv = [], c = (l, f) => [s0.x + s0.nx * l + s0.tx * f, s0.y + .045, s0.z + s0.nz * l + s0.tz * f];
    pos.push(...c(-HALF, 0), ...c(HALF, 0), ...c(-HALF, 1.4), ...c(HALF, 0), ...c(HALF, 1.4), ...c(-HALF, 1.4)); uv.push(0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: chk, roughness: .7, fog: !def.clearRoad })); m.receiveShadow = true; scene.add(m);
    const gantry = new THREE.Group(), post = M(def.kerb[0], { roughness: .4, emissive: space ? def.kerb[0] : '#000000', emissiveIntensity: space ? .6 : 0 }), w = HALF + 1.6;
    // (v258, the user) where the pit lane runs past the line, the post on that side would stand in it: that side has none
    const pitHere = PITS && pitEdges(0) != null;
    for (const s of [-1, 1]) { if (pitHere && s === PITS.side) continue; const p = new THREE.Mesh(new THREE.CylinderGeometry(.22, .26, 6, 12), post); p.position.set(s * w, 3, 0); p.castShadow = true; gantry.add(p); }
    const bannerTex = canvasTex(1024, 128, (x) => {
      x.fillStyle = '#1b2a4a'; x.fillRect(0, 0, 1024, 128); for (let i = 0; i < 64; i++) { x.fillStyle = i % 2 ? '#111' : '#fff'; x.fillRect(i * 16, 0, 16, 16); x.fillStyle = i % 2 ? '#fff' : '#111'; x.fillRect(i * 16, 112, 16, 16); }
      x.font = 'bold 64px Fredoka, Arial Rounded MT Bold, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 10; x.strokeStyle = '#1b2a4a'; x.strokeText(def.banner, 512, 66); x.fillStyle = '#ffe14a'; x.fillText(def.banner, 512, 66);
    });
    const bm = new THREE.MeshStandardMaterial({ map: bannerTex, emissive: '#ffffff', emissiveMap: bannerTex, emissiveIntensity: .25 });
    const ban = new THREE.Mesh(new THREE.BoxGeometry(w * 2 + .6, 1.4, .3), [M('#1b2a4a'), M('#1b2a4a'), M('#1b2a4a'), M('#1b2a4a'), bm, bm]);
    ban.position.y = 5.6; ban.castShadow = true; gantry.add(ban);
    gantry.position.set(s0.x + s0.tx * .7, s0.y, s0.z + s0.tz * .7); gantry.rotation.y = Math.atan2(-s0.nz, s0.nx); scene.add(gantry);
  }
  // (v143, the user) a HOLOGRAM WARNING SIGN hovers over every hazard, so an oil slick or a rockfall is
  // spotted from far off. It is an alphaTest cut-out with an emissive map (crisp and bright, no blending:
  // the user's phone draws additive glow as an opaque slab) on a thin projector beam.
  const warnTex = (col) => canvasTex(128, 128, (c) => {
    c.clearRect(0, 0, 128, 128);
    const tri = (inset) => { c.beginPath(); c.moveTo(64, 10 + inset); c.lineTo(119 - inset * .9, 112 - inset * .5); c.lineTo(9 + inset * .9, 112 - inset * .5); c.closePath(); };
    c.lineJoin = 'round'; c.fillStyle = col; tri(0); c.fill();
    c.fillStyle = '#10163a'; tri(13); c.fill();
    c.fillStyle = col; c.font = 'bold 66px "Luckiest Guy", Fredoka, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', 64, 78);
    // hologram scan lines, drawn solid so the alphaTest cut-out keeps them
    c.fillStyle = '#10163a'; for (let y = 24; y < 118; y += 9) c.fillRect(10, y, 108, 2);
  });
  const warnGeo = new THREE.PlaneGeometry(1.5, 1.5), beamGeo = new THREE.CylinderGeometry(.05, .05, 1, 6);
  W.warns = [];
  function warnSign(y0, x, z, col) {
    const t = W.warnT || (W.warnT = warnTex(col));
    const m = W.warnM || (W.warnM = new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: .95, roughness: .5, alphaTest: .5, side: THREE.DoubleSide }));
    const bm = W.beamM || (W.beamM = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .8, roughness: .5 }));
    const h = 1.5, sign = new THREE.Mesh(warnGeo, m), beam = new THREE.Mesh(beamGeo, bm);
    sign.position.set(x, y0 + h + .9, z); beam.position.set(x, y0 + h / 2 + .1, z); beam.scale.y = h;
    scene.add(sign, beam);
    W.warns.push({ sign, beam, y: y0 + h + .9, t: rand(0, 6) });
  }
  // hazards: icy patches (Alps), oil slicks (Robo City), sticky space goo (Star Loop)
  const HZ = { ice: ['#a8e4ff', '#2a7ad8', .06, .15], oil: ['#1a1428', '#ffe14a', .16, .5], goo: ['#ff5db1', '#ffffff', .2, 0], water: ['#4fc8ff', '#ffffff', .04, .25], mud: ['#4a2e14', '#b8905a', .95, 0], rocks: ['#6a4a2a', '#ff3a3a', .9, 0] }[def.hazard];   // (v60: a bright rim, so they are easy to see)
  const iceMat = new THREE.MeshStandardMaterial({ color: HZ[0], roughness: HZ[2], metalness: HZ[3], envMapIntensity: def.hazard === 'oil' ? .55 : 1.6, ...(def.hazard === 'goo' ? { emissive: '#ff2a9a', emissiveIntensity: .7 } : {}) }), rimMat = M(HZ[1], { roughness: .2, emissive: HZ[1], emissiveIntensity: .45 });
  // falling rocks (Gold Mines): a red warning ring on the road and a loose boulder in the ceiling above it; no puddles
  W.rockSpots = []; W.rocks = [];
  if (def.hazard === 'rocks') {
    const ringG = new THREE.RingGeometry(1.5, 2.3, 36).rotateX(-Math.PI / 2), ringM = new THREE.MeshBasicMaterial({ color: '#ff3a2a', transparent: true, opacity: .85, side: THREE.DoubleSide, depthWrite: false });
    const fillM = new THREE.MeshBasicMaterial({ color: '#ff5a3a', transparent: true, opacity: .18, side: THREE.DoubleSide, depthWrite: false }), discG = new THREE.CircleGeometry(1.5, 36).rotateX(-Math.PI / 2);
    const rockG = new THREE.IcosahedronGeometry(1, 0).scale(1, .86, 1);   // (v117: a plain angular stone — the old one read as a brown bush)
    W.rockGeo = rockG; W.rockMat = M('#75655a', { roughness: 1, flatShading: true });
    ICE_AT.concat(def.moreHazards || []).forEach((f) => { if (inRoutesF(f)) return;   // (v199) not on a stretch that changes
      const lat = rand(-2.4, 2.4), p = at(f * TRACK.L, lat), ring = new THREE.Mesh(ringG, ringM), fill = new THREE.Mesh(discG, fillM), loose = new THREE.Mesh(rockG, W.rockMat);
      ring.position.set(p.x, p.y + .06, p.z); fill.position.set(p.x, p.y + .05, p.z); loose.position.set(p.x, p.y + 6.6, p.z); loose.scale.setScalar(1.1); loose.rotation.set(rand(0, 6), rand(0, 6), 0);
      scene.add(ring, fill, loose); W.rockSpots.push({ x: p.x, z: p.z, y: p.y, ring, fill, loose, armed: true, t: rand(0, 6), s: f * TRACK.L });
      warnSign(p.y, p.x, p.z, HZ[1]);
    });
  }
  W.ice = (def.hazard === 'rocks' ? [] : ICE_AT.concat(def.moreHazards || [])).filter((f) => !inRoll(f, .025, .6) && !inRoutesF(f)).map((f, n) => {   // (the patches follow the banking, so only the steepest banks are off limits)
    const p = at(f * TRACK.L, rand(-2.6, 2.6)), rot = angleOf(p.p), ice = { x: p.x, z: p.z, rx: 2.1, ry: 1.5, rot };   // (v60: smaller patches, easier to miss)
    // every point of the patch sits on the road surface under it (its slope AND its banking): back to the centre line, then rolled()
    const surf = (x, z, y) => { const dx = x - p.p.x, dz = z - p.p.z; return rolled(at(f * TRACK.L + dx * p.p.tx + dz * p.p.tz).p, dx * p.p.nx + dz * p.p.nz, y); };
    const ring = (sc, y) => { const pos = []; for (let k = 0; k < 28; k++) { const pt = (kk) => { const a = kk / 28 * Math.PI * 2, wob = (1 + Math.sin(a * 3 + n * 9) * .08) * sc, x = p.x + (Math.cos(a) * ice.rx * Math.cos(rot) - Math.sin(a) * ice.ry * Math.sin(rot)) * wob, z = p.z + (Math.cos(a) * ice.rx * Math.sin(rot) + Math.sin(a) * ice.ry * Math.cos(rot)) * wob; return surf(x, z, y); }; pos.push(...surf(p.x, p.z, y), ...pt(k + 1), ...pt(k)); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; };
    const rim = new THREE.Mesh(ring(1.3, .05), rimMat), top = new THREE.Mesh(ring(1, .06), iceMat); rim.receiveShadow = top.receiveShadow = true; scene.add(rim, top);
    warnSign(p.y, p.x, p.z, HZ[1]);
    ice.parts = [rim, top]; ice.warn = W.warns[W.warns.length - 1];   // (v188) so the formation lap can put the puddle away
    return ice;
  });
  // ? boxes: rows of 3 spinning purple boxes
  const qTex = questionTex(), shell = new THREE.MeshStandardMaterial({ map: qTex, emissive: '#ffffff', emissiveMap: qTex, emissiveIntensity: .5, roughness: .32, metalness: .06 });
  const edge = new THREE.LineBasicMaterial({ color: '#ffe9a0' });
  const qGeo = new THREE.BoxGeometry(1.02, 1.02, 1.02), eGeo = new THREE.EdgesGeometry(qGeo);
  const makeBox = () => { const g = new THREE.Group(), m = new THREE.Mesh(qGeo, shell); m.castShadow = true; g.add(m, new THREE.LineSegments(eGeo, edge)); return g; };
  BOX_AT.filter((f) => !inRoll(f) && !inRoutesF(f)).forEach((f) => [-3.4, 0, 3.4].forEach((lat) => {
    const p = at(f * TRACK.L, lat), m = makeBox(); m.position.set(...rolled(p.p, lat, 1)); m.rotation.set(.5, rand(0, 6), .6); scene.add(m);
    W.boxes.push({ m, x: p.x, z: p.z, y: p.y + 1, on: true, t: rand(0, 6) });
  }));
  buildArcade(scene, W, def); routeSs(W);
  if (PITS) buildPitLane(scene, W, def); else buildPitBoxes(scene, W, def);
  if (def.pitStart) buildFormGates(scene, W, def);   // (v173) the formation lap's answer gates
  W.gates = [];   // (v60: the answer gates are gone — the user: "remove the gates, that's not good"; buildGates stays for reference)
  const nScen = scene.children.length;
  PIT_CLEAR = !!PITS && def.id !== 'alps'; try { THEMES[def.id].scenery(scene, W, def); } finally { PIT_CLEAR = false; }
  if (W.onRoads) clearRoads(scene.children.slice(nScen), W);   // (v199) nothing the scenery put down stands on a road variant
  // weather: snow in the Alps, twinkling star dust in space
  if (def.id !== 'city') {
    const flake = canvasTex(32, 32, (x) => { const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); });
    const n = space ? 400 : 700, sp = new Float32Array(n * 3), cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { sp[i * 3] = rand(-30, 30) + MID.x; sp[i * 3 + 1] = rand(-8, 14) + P[0].y; sp[i * 3 + 2] = rand(-30, 30) + MID.z; const c = new THREE.Color(space ? pick(['#7af8ff', '#ff9ae0', '#ffffff', '#ffe14a']) : def.petals ? pick(['#ffb3d1', '#ff8ab8', '#ffd6e6']) : '#ffffff'); cols.set([c.r, c.g, c.b], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    W.snow = new THREE.Points(sg, new THREE.PointsMaterial({ map: flake, size: space ? .3 : .22, transparent: true, depthWrite: false, opacity: .9, vertexColors: true })); W.snow.frustumCulled = false; scene.add(W.snow);
    W.snowFall = space ? .35 : def.petals ? 1.1 : 2.2;
  }
  buildTrackFx(scene, W);   // (v264) the track types' weather
  // little puffs (exhaust, boost, sparks): a pool of sprites
  const dot = canvasTex(32, 32, (x) => { const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); });
  W.puffs = [];
  for (let i = 0; i < 110; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, transparent: true, depthWrite: false })); s.visible = false; scene.add(s); W.puffs.push({ s, life: 0 }); }
  // the bazooka rocket and the AI's snowball
  const rk = new THREE.Group();
  const bodyR = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .7, 12).rotateX(Math.PI / 2), M('#e8403a', { roughness: .35 })); rk.add(bodyR);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(.13, .3, 12).rotateX(Math.PI / 2), M('#ffffff', { roughness: .3 })); nose.position.z = .5; rk.add(nose);
  for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(.02, .22, .2), M('#ffe14a')); f.position.z = -.28; f.rotation.z = k * Math.PI / 2; f.translateY(.15); rk.add(f); }
  W.rocket = rk; W.snowball = new THREE.Mesh(new THREE.SphereGeometry(.32, 16, 12), M(def.id === 'space' ? '#9af0ff' : def.id === 'city' ? '#7a8aa0' : '#ffffff', { roughness: .6 }));
  W.shieldGeo = new THREE.SphereGeometry(1.45, 24, 16); W.shieldMat = new THREE.MeshStandardMaterial({ color: '#ffe14a', emissive: '#ffb000', emissiveIntensity: .7, transparent: true, opacity: .26, roughness: .1, depthWrite: false });   // (v266, the user: an electric field — a yellow sphere with sparks)
  W.sparkMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: .95, toneMapped: false, depthWrite: false });
  W.sparkGlow = new THREE.MeshBasicMaterial({ color: '#ffd400', transparent: true, opacity: .9, toneMapped: false, depthWrite: false, side: THREE.DoubleSide });
  W.flameMat = new THREE.MeshBasicMaterial({ color: '#ffb02a', transparent: true, opacity: .9 });
  W.trapMat = iceMat; STRIP_SKIP = null;
  W.camera = new THREE.PerspectiveCamera(66, 9 / 16, .1, 1500);
  renderer.compile(scene, W.camera);
  return W;
}

/* ---------- the scenery of each track ---------- */
const THEMES = {
  alps: {
    // snowy ground that rises gently into hills away from the road, and follows the road's own hills next to it
    ground(scene, W, def) {
      const ext = 70, x0 = BOUNDS.x0 - ext, x1 = BOUNDS.x1 + ext, z0 = BOUNDS.z0 - ext, z1 = BOUNDS.z1 + ext;
      const hills = (x, z) => 1.6 + 1.4 * Math.sin(x * .045) * Math.cos(z * .04) + Math.sin(x * .021 + z * .033);
      // the snow beside the road follows the road's own height EXACTLY (every point, interpolated along the road), so it
      // never pokes up through the road on a hill. It used to take the nearest of every 4th point, which made 0.6 m stairs
      // beside the road on the steep parts and snow rising through the road surface. A grid of cells makes it fast.
      const P = W.roadPts || TRACK.pts, NB = W.roadNb, CELL = 14, cells = new Map(), ck = (x, z) => Math.floor(x / CELL) + ',' + Math.floor(z / CELL);   // (v199: and beside every road variant)
      P.forEach((p, i) => { const k = ck(p.x, p.z); (cells.get(k) || cells.set(k, []).get(k)).push(i); });
      const coarse = P.filter((_, i) => i % 8 === 0);
      W.groundAt = (x, z) => {
        // the nearest road point (nearby cells first, the whole lap as a fallback), then the height on the road segment
        let best = 1e9, bi = -1; const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const l = cells.get((cx + dx) + ',' + (cz + dz)); if (l) for (const i of l) { const p = P[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) { best = d; bi = i; } } }
        let d, hy;
        if (bi < 0) { let b2 = 1e9; for (const p of coarse) { const dd = (p.x - x) ** 2 + (p.z - z) ** 2; if (dd < b2) { b2 = dd; hy = p.y; } } d = Math.sqrt(b2); }
        else {
          const p = P[bi]; d = Math.sqrt(best); hy = p.y;
          for (const j of (NB ? NB[bi] : [bi - 1, bi + 1])) {   // project onto the two segments round the nearest point: an exact height along the road
            const q = P[((j % P.length) + P.length) % P.length], ex = q.x - p.x, ez = q.z - p.z, L2 = ex * ex + ez * ez; if (!L2) continue;
            const t = clamp(((x - p.x) * ex + (z - p.z) * ez) / L2, 0, 1), px = p.x + ex * t, pz = p.z + ez * t, dd = Math.hypot(x - px, z - pz);
            if (dd < d) { d = dd; hy = p.y + (q.y - p.y) * t; }
          }
        }
        let k = smoothstep(HALF + 4.2, HALF + 26, d);
        if (W.pitDist) k = Math.min(k, smoothstep(7.5, 24, W.pitDist(x, z)));   // (v152) flat ground over the pit lane and its garages
        const edge = Math.min(x - x0, x1 - x, z - z0, z1 - z), e = smoothstep(0, 40, edge);
        return (hy - .06 + k * Math.max(0, hills(x, z) * (.4 + Math.min(1, (d - HALF) / 50)))) * e;
      };
      const snowTex = snowTexture([60, 60]);
      const sx = Math.round((x1 - x0) / 2.2), sz = Math.round((z1 - z0) / 2.2), g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, sx, sz).rotateX(-Math.PI / 2), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i) + (x0 + x1) / 2, z = p.getZ(i) + (z0 + z1) / 2; p.setY(i, W.groundAt(x, z)); }
      g.computeVertexNormals();
      // (v94) the snow catches the sky: big soft patches of lavender, ice blue and warm sunlight in its vertex colours (Beach and Mines re-dress this mesh)
      { const col = new Float32Array(p.count * 3), c = new THREE.Color(), base = new THREE.Color('#ffffff'), T3 = [new THREE.Color('#b8c8ff'), new THREE.Color('#9fdcff'), new THREE.Color('#ffe2c0')];
        for (let i = 0; i < p.count; i++) { const x = p.getX(i) + (x0 + x1) / 2, z = p.getZ(i) + (z0 + z1) / 2, n1 = Math.sin(x * .031 + z * .017) * Math.cos(z * .027 - x * .011) + .3 * Math.sin(x * .09 - z * .07), n2 = Math.sin(x * .013 - z * .021 + 2.1); c.copy(base).lerp(T3[n2 > .3 ? 0 : n2 > -.3 ? 1 : 2], smoothstep(.15, .9, n1) * .5); col.set([c.r, c.g, c.b], i * 3); }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
      const mat = new THREE.MeshStandardMaterial({ map: snowTex, roughness: .9, vertexColors: true, color: '#dfe6f6' }), ground = new THREE.Mesh(g, mat); ground.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); ground.receiveShadow = true; scene.add(ground);
      // the snow beyond: four big flat strips round the heightfield (one plane under everything poked up through the road where it dips below zero)
      const F = 1000, strips = [[x0 - F, x1 + F, z0 - F, z0 + 1], [x0 - F, x1 + F, z1 - 1, z1 + F], [x0 - F, x0 + 1, z0, z1], [x1 - 1, x1 + F, z0, z1]];
      for (const [a, b, c, d] of strips) { const fg = new THREE.PlaneGeometry(b - a, d - c).rotateX(-Math.PI / 2), uv = fg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (b - a) / 2000, uv.getY(i) * (d - c) / 2000); const far = new THREE.Mesh(fg, mat); far.position.set((a + b) / 2, -.08, (c + d) / 2); scene.add(far); }
    },
    scenery(scene, W, def) {
      // soft snowbanks next to the road
      const sb = new THREE.Color('#e8f1fc'), sb2 = new THREE.Color('#ffffff'), bc = (i) => (i % 2 ? sb : sb2), vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7 });
      for (const s of [-1, 1]) {
        const keep = (i) => !(W.pitIdx && PITS && s === PITS.side && W.pitIdx[i]);   // (v153) no snowbank through the pit lane
        const a = s > 0 ? strip(HALF + .9, HALF + 2.4, .1, .75, { colour: bc, only: keep }) : strip(-HALF - 2.4, -HALF - .9, .75, .1, { colour: bc, only: keep });
        const b = s > 0 ? strip(HALF + 2.4, HALF + 4.4, .75, -.05, { colour: bc, only: keep }) : strip(-HALF - 4.4, -HALF - 2.4, -.05, .75, { colour: bc, only: keep });
        for (const g of [a, b]) { const m = new THREE.Mesh(g, vc); m.receiveShadow = true; scene.add(m); }
      }
      const trees = [], chalets = [], snowmen = [];
      for (let k = 0; k < 2200 && trees.length < 480; k++) { const x = rand(BOUNDS.x0 - 25, BOUNDS.x1 + 25), z = rand(BOUNDS.z0 - 25, BOUNDS.z1 + 25); if (farFromRoad(x, z, 8)) trees.push({ x, z, s: rand(.75, 1.5), ry: rand(0, 6) }); }
      // (v94) villages: three clusters of houses in three colourways, away from the road
      { const centres = []; for (let k = 0; k < 600 && centres.length < 3; k++) { const x = rand(BOUNDS.x0 + 30, BOUNDS.x1 - 30), z = rand(BOUNDS.z0 + 30, BOUNDS.z1 - 30); if (farFromRoad(x, z, 22) && !farFromRoad(x, z, 48) && centres.every((c) => (c.x - x) ** 2 + (c.z - z) ** 2 > 90 ** 2)) centres.push({ x, z }); }
        for (const c of centres) for (let k = 0; k < 60 && chalets.filter((h) => h.v === c).length < 6; k++) { const x = c.x + rand(-26, 26), z = c.z + rand(-26, 26); if (farFromRoad(x, z, BASE.chaletLP ? 16 : 12) && chalets.every((h) => (h.x - x) ** 2 + (h.z - z) ** 2 > (BASE.chaletLP ? 320 : 150))) chalets.push({ x, z, s: rand(.85, 1.1), ry: Math.atan2(MID.x - x, MID.z - z) + rand(-.4, .4), v: c }); } }
      for (let k = 0; k < 400 && chalets.length < 24; k++) { const x = rand(BOUNDS.x0 + 20, BOUNDS.x1 - 20), z = rand(BOUNDS.z0 + 30, BOUNDS.z1 - 20); if (farFromRoad(x, z, BASE.chaletLP ? 16 : 12) && chalets.every((c) => (c.x - x) ** 2 + (c.z - z) ** 2 > (BASE.chaletLP ? 520 : 400))) chalets.push({ x, z, s: rand(.9, 1.15), ry: rand(0, 6) }); }
      for (let k = 0; k < 400 && snowmen.length < 9; k++) { const x = rand(BOUNDS.x0 + 30, BOUNDS.x1 - 30), z = rand(BOUNDS.z0 + 30, BOUNDS.z1 - 30); if (farFromRoad(x, z, 4.5) && !farFromRoad(x, z, 9)) snowmen.push({ x, z, s: 1, ry: rand(0, 6) }); }
      if (W.onRoads) for (let k = chalets.length - 1; k >= 0; k--) if (W.onRoads(chalets[k].x, chalets[k].z, 40)) chalets.splice(k, 1);   // (v272, the user) no houses round the changing stretch
      const clear = trees.filter((t) => chalets.every((c) => (c.x - t.x) ** 2 + (c.z - t.z) ** 2 > (BASE.chaletLP ? 120 : 64)));   // (the Tripo chalets have a yard: no firs in it)
      for (const l of [clear, chalets, snowmen]) for (const d of l) d.y = W.groundAt(d.x, d.z) - .1;
      const vcm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, flatShading: true });
      { const firs = [firGeo(1), firGeo(2), firGeo(3)]; firs.forEach((fg, i) => instanced(scene, fg, vcm, clear.filter((_, k) => k % 3 === i), false)); }   // the detailed firs (three shapes)
      if (BASE.chaletLP) instanced(scene, BASE.chaletLP.geo, BASE.chaletLP.mat, chalets.map((c) => ({ ...c, y: c.y - .25, ry: (c.ry || 0) + CHALET_FACE })));   // (2026-11-13) the Tripo snowy chalet, its yard sunk a little into the snow
      else { const ways = [['#f4efe4', '#2f7a3a'], ['#f6e0a0', '#b8302a'], ['#f2c4bc', '#2a5a9a']]; ways.forEach(([p, sh], i) => instanced(scene, chaletGeo(p, sh), vcm, chalets.filter((_, k) => k % 3 === i))); }   // (480 trees casting shadows cost ~70k triangles a frame on phones) instanced(scene, snowmanGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 }), snowmen);
      if (BASE.alpsMtns) {   // (v308) the Blender Alpine mountains round the valley: 50–95 m tall, wide forested feet, each turned to face the track
        const lists = [[], [], []]; for (let k = 0; k < 30; k++) { const a = k / 30 * Math.PI * 2 + rand(-.06, .06), r = rand(330, 420), h = rand(50, 95), s = h / .36; lists[k % 3].push({ x: MID.x + Math.cos(a) * r, y: -2, z: MID.z + Math.sin(a) * r, sx: s * rand(.9, 1.15), sy: s, sz: s * rand(.9, 1.15), ry: -a + Math.PI / 2 + rand(-.5, .5) }); }
        BASE.alpsMtns.forEach((m, i) => instanced(scene, m.geo, m.mat, lists[i], false));
      } else addMountains(scene, MID.x, MID.z, 340, 430, 32);
      // (v94) a stretch of the road under fresh snow (34–48 % of the lap): a snow layer over the asphalt with two dark tyre
      // tracks through it, and deep white banks on both sides
      { const sTex = canvasTex(128, 512, (x) => { x.fillStyle = '#f4f8ff'; x.fillRect(0, 0, 128, 512); for (let k = 0; k < 1800; k++) { x.fillStyle = Math.random() < .5 ? 'rgba(170,190,230,.25)' : 'rgba(255,255,255,.8)'; x.fillRect(rand(0, 128), rand(0, 512), rand(1, 3), rand(1, 3)); } for (const c of [36, 92]) { const g = x.createLinearGradient(c - 14, 0, c + 14, 0); g.addColorStop(0, 'rgba(120,130,160,0)'); g.addColorStop(.5, 'rgba(110,120,150,.75)'); g.addColorStop(1, 'rgba(120,130,160,0)'); x.fillStyle = g; x.fillRect(c - 14, 0, 28, 512); } }); sTex.wrapT = THREE.RepeatWrapping;
        const i0 = Math.round(.34 * TRACK.N), i1 = Math.round(.48 * TRACK.N), only = (i) => i >= i0 && i <= i1;
        scene.add(new THREE.Mesh(strip(-HALF - .9, HALF + .9, .05, .05, { uvLen: 10, only }), new THREE.MeshStandardMaterial({ map: sTex, roughness: .95, polygonOffset: true, polygonOffsetFactor: -1 })));
        const bank = M('#ffffff', { roughness: .95 }); for (const sd of [-1, 1]) scene.add(new THREE.Mesh(sd > 0 ? strip(HALF + .9, HALF + 3.2, .06, 1.5, { only }) : strip(-HALF - 3.2, -HALF - .9, 1.5, .06, { only }), bank)); }
      // bunting across the road: a rope between two poles, little flags in every colour
      { const pole = M('#8a5a2a'), flagG = new THREE.ConeGeometry(.32, .7, 3).rotateX(Math.PI).translate(0, -.35, 0), flags = [], cols = ['#e8403a', '#ffd23a', '#3c8cf0', '#4fc84a', '#ff5db1', '#ff8a1e', '#8a4ae8'];
        for (let f = .08; f < 1; f += .135) { if (inRoll(f) || (W.pitIdx && W.pitIdx[Math.round(f * TRACK.N) % TRACK.N])) continue; const p = at(f * TRACK.L).p, A = new THREE.Vector3(p.x + p.nx * (HALF + 2.4), p.y + 6.4, p.z + p.nz * (HALF + 2.4)), B = new THREE.Vector3(p.x - p.nx * (HALF + 2.4), p.y + 6.4, p.z - p.nz * (HALF + 2.4));
          for (const E of [A, B]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, 6.6, 7), pole); m.position.set(E.x, E.y - 3.3, E.z); scene.add(m); }
          for (let k = 1; k < 16; k++) { const t = k / 16, q = A.clone().lerp(B, t); q.y -= Math.sin(t * Math.PI) * 1.1; flags.push({ x: q.x, y: q.y, z: q.z, s: 1, ry: Math.atan2(p.nx, p.nz), c: cols[k % cols.length] }); } }
        instanced(scene, flagG, new THREE.MeshStandardMaterial({ roughness: .7, side: THREE.DoubleSide }), flags, false); }
      // the painted horizon: a far ring of blue-grey ranges and white peaks (a cut-out band, no blending)
      { const tex = canvasTex(2048, 256, (x) => {
          const layer = (base, amp, col, snowC, seed) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, 256); for (let u = 0; u <= 2048; u += 8) { const y = base - amp * (.55 + .45 * Math.sin(u * .006 + seed) * Math.cos(u * .0023 + seed * 2)) - Math.abs(Math.sin(u * .019 + seed * 3)) * amp * .35; x.lineTo(u, y); } x.lineTo(2048, 256); x.fill();
            if (snowC) { x.fillStyle = snowC; for (let u = 0; u <= 2048; u += 8) { const y = base - amp * (.55 + .45 * Math.sin(u * .006 + seed) * Math.cos(u * .0023 + seed * 2)) - Math.abs(Math.sin(u * .019 + seed * 3)) * amp * .35; if (y < base - amp * .75) x.fillRect(u, y, 9, (base - amp * .75 - y) * .9 + 3); } } };
          layer(210, 150, '#9fb4dc', '#f4f8ff', 1.3); layer(236, 120, '#7d94c4', '#ffffff', 4.1); layer(256, 70, '#c8d8f0', null, 7.7);
        });
        tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(2, 1);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(780, 780, 230, 64, 1, true), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, alphaTest: .5, transparent: false, fog: false }));
        band.position.set(MID.x, 70, MID.z); scene.add(band); }
      const clouds = []; for (let k = 0; k < 16; k++) { const a = rand(0, 6.28), r = rand(150, 320); clouds.push({ x: MID.x + Math.cos(a) * r, y: rand(55, 95), z: MID.z + Math.sin(a) * r, s: rand(1.2, 2.4), ry: rand(0, 6) }); }
      if (BASE.alpsCloud) instanced(scene, BASE.alpsCloud.geo, BASE.alpsCloud.mat, clouds.map((c) => ({ ...c, s: c.s * 21 })), false);   // (2026-11-13) the Tripo puffy cloud, the size of the old ones
      else instanced(scene, cloudGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: .25 }), clouds, false);
      flagsAndBoards(scene, W, true); grandstands(scene, W, '#e8403a');
      { const sun = new THREE.Mesh(new THREE.SphereGeometry(28, 20, 14), new THREE.MeshBasicMaterial({ color: '#fff6d0', fog: false })); sun.position.set(MID.x + 430, 240, MID.z - 540); scene.add(sun); }   // the sun, low over the far peaks
      // wooden fences along the outside of the bends
      {
        const out = new Int8Array(TRACK.N); for (let i = 0; i < TRACK.N; i++) { const t = wrapA(angleOf(tp(i + 12)) - angleOf(tp(i - 12))); if (Math.abs(t) > .32) out[i] = -Math.sign(t); }
        if (W.pitIdx && PITS) for (let i = 0; i < TRACK.N; i++) if (W.pitIdx[i] && out[i] === PITS.side) out[i] = 0;   // (v152) not across the pit lane
        const wood = M('#9a5a2a', { roughness: .8 }), posts = [];
        for (const sd of [-1, 1]) {
          for (const h of [.55, .95]) scene.add(new THREE.Mesh(strip(sd * (HALF + 4.7), sd * (HALF + 4.7), h, h + .14, { only: (i) => out[i] === sd }), new THREE.MeshStandardMaterial({ color: '#b8743a', roughness: .8, side: THREE.DoubleSide })));
          for (let i = 0; i < TRACK.N; i += 5) if (out[i] === sd) { const p = tp(i), x = p.x + p.nx * sd * (HALF + 4.7), z = p.z + p.nz * sd * (HALF + 4.7); posts.push({ x, z, y: p.y, s: 1 }); }
        }
        instanced(scene, new THREE.CylinderGeometry(.08, .1, 1.25, 6).translate(0, .62, 0), wood, posts, false);
      }
      // a cable car over the valley: two pylons, a cable, and gondolas gliding along it
      {
        const A = new THREE.Vector3(BOUNDS.x0 - 10, 0, MID.z - 60), B = new THREE.Vector3(BOUNDS.x1 + 30, 0, MID.z + 90);
        A.y = W.groundAt(A.x, A.z) + 34; B.y = W.groundAt(B.x, B.z) + 58;
        const pyl = M('#5a6270', { roughness: .5, metalness: .4 });
        for (const P of [A, B]) { const h = P.y - W.groundAt(P.x, P.z) + 2, m = new THREE.Mesh(new THREE.CylinderGeometry(.5, 1.1, h, 8), pyl); m.position.set(P.x, P.y - h / 2 + 1, P.z); scene.add(m); const t = new THREE.Mesh(new THREE.BoxGeometry(6, .6, .8), pyl); t.position.set(P.x, P.y + 1, P.z); t.lookAt(A.x === P.x ? B : A); scene.add(t); }
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, A.distanceTo(B), 6), M('#2a2e3a')); cable.position.copy(A).lerp(B, .5); cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); scene.add(cable);
        const gond = new THREE.Group(); { const c = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.2), M('#e8403a', { roughness: .4 })); c.position.y = -2.4; gond.add(c); const w = new THREE.Mesh(new THREE.BoxGeometry(2.7, .9, 1.6), M('#bfe8ff', { roughness: .1, metalness: .3 })); w.position.y = -2.1; gond.add(w); const r = new THREE.Mesh(new THREE.BoxGeometry(2.8, .25, 2.4), M('#ffffff')); r.position.y = -1.2; gond.add(r); const arm = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1.3, 6), M('#2a2e3a')); arm.position.y = -.6; gond.add(arm); }
        const gs = [0, .25, .5, .75].map((f) => { const g = gond.clone(); scene.add(g); return { g, f }; });
        W.anim.push((dt) => { for (const o of gs) { o.f = (o.f + dt * .012) % 1; o.g.position.copy(A).lerp(B, o.f); } });
      }
    },
  },
  city: {
    ground(scene, W, def) {
      W.groundAt = () => 0;
      // (v293, the user: "more park-like") a mown lawn in wide light and dark stripes, not grey paving
      const tex = canvasTex(256, 256, (x) => {
        for (let k = 0; k < 4; k++) { x.fillStyle = k % 2 ? '#3f7a32' : '#4a873a'; x.fillRect(0, k * 64, 256, 64); }
        for (let k = 0; k < 2600; k++) { const r = Math.random(); x.fillStyle = r < .45 ? 'rgba(30,70,20,.16)' : r < .9 ? 'rgba(170,220,120,.14)' : 'rgba(255,240,150,.18)'; x.fillRect(rand(0, 256), rand(0, 256), rand(1, 3), rand(1, 4)); }
      }, [70, 70]);
      const g = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: .95 })); g.position.set(MID.x, -.02, MID.z); g.receiveShadow = true; scene.add(g);
    },
    scenery(scene, W, def) {
      /* ---------- (v135) Monaco street dressing: white lines, tyre stacks and palms (v301: no harbour) ---------- */
      const vcm2 = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, fog: !def.clearRoad });
      { const wl = M('#eef1f5', { roughness: .8, fog: !def.clearRoad });
        for (const sd of [-1, 1]) scene.add(new THREE.Mesh(strip(sd * (HALF - .46), sd * (HALF - .16), .035, .035), wl)); }
      { // (v293: a park now) clipped topiary balls in stone pots on the outside of every corner (they were tyre stacks)
        const topG = (() => { const g = new THREE.Group(), pot = M('#cfc3ad', { roughness: .9 }), leaf = M('#3a7a34', { roughness: 1 });
          g.add(new THREE.Mesh(new THREE.CylinderGeometry(.55, .42, .6, 10).translate(0, .3, 0), pot));
          g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.75, 1).translate(0, 1.25, 0), leaf)); return bakeOne(g); })();
        const ty = [];
        for (let i = 0; i < TRACK.N; i += 5) { if (STRIP_SKIP && STRIP_SKIP(i)) continue; const s0 = i * STEP, turn = wrapA(angleOf(at(s0 + 10).p) - angleOf(at(s0 - 10).p));
          if (Math.abs(turn) < .3) continue; const sd = -Math.sign(turn), p = tp(i); if (p.y > .4) continue;
          const x = p.x + p.nx * sd * (HALF + 2.75), z = p.z + p.nz * sd * (HALF + 2.75); if (!farFromRoad(x, z, 2.2)) continue;
          ty.push({ x, y: p.y, z, s: rand(.85, 1.1), ry: rand(0, 6) }); }
        ty.length && instanced(scene, topG, vcm2, ty, false); }
      { // palms behind the barriers, the way the Riviera does it
        const palmG = (() => { const g = new THREE.Group(), bark = M('#9a7a50', { roughness: .95 }), leaf = M('#2f8a3c', { roughness: .9 });
          const tr = new THREE.Mesh(new THREE.CylinderGeometry(.17, .33, 6.2, 7).translate(0, 3.1, 0), bark); tr.rotation.z = .07; g.add(tr);
          for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283;
            const fr = new THREE.Mesh(new THREE.ConeGeometry(.46, 3.2, 4).rotateZ(Math.PI / 2).translate(1.6, 0, 0), leaf);
            fr.position.set(0, 6.1, 0); fr.rotation.y = a; fr.rotation.z = -.4; g.add(fr); }
          return bakeOne(g); })();
        const pl = [];
        for (let d = 9; d < TRACK.L; d += 26) { const i = Math.round(d / STEP) % TRACK.N, p = tp(i); if (p.y > .4) continue;
          const sd = Math.random() < .5 ? -1 : 1, off = HALF + rand(5.2, 7.5);   // (v293: fewer, behind the promenade)
          pl.push({ x: p.x + p.nx * sd * off, y: 0, z: p.z + p.nz * sd * off, s: rand(.8, 1.3), ry: rand(0, 6) }); }
        pl.length && instanced(scene, palmG, vcm2, pl, false); }
      // (v301, the user: "this pool that is in the track — I don't want it there") the harbour basin with the yachts in the
      // middle of the circuit is gone; the park (lawn, trees, beds, fountains) fills the space. W.harbour stays unset.
      // Inside the loop of the circuit it is all park now: no houses there (inField: inside the road's outline)
      const fieldPoly = TRACK.pts.filter((_, i) => i % 3 === 0);
      const inField = (x, z) => { let c = false; for (let i = 0, j = fieldPoly.length - 1; i < fieldPoly.length; j = i++) { const a = fieldPoly[i], b = fieldPoly[j]; if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) c = !c; } return c; };
      /* ---------- (v293, the user: "redesign Robo City … make the environment more park-like … benches, luxury cars")
         The circuit runs through a seaside park: a pale stone promenade behind the hedges with benches facing the
         track, luxury cars parked on painted bays along the straights, and a belt of lawn with round trees, cypresses,
         bushes, flower beds and three fountains between the road and the houses (which stand further back now). ---------- */
      {
        const start0 = tp(0), nearStart = (x, z, r) => (x - start0.x) ** 2 + (z - start0.z) ** 2 < r * r;
        const inHarbour = (x, z, m = 6) => W.harbour && Math.abs(x - W.harbour.x) < W.harbour.w + m && Math.abs(z - W.harbour.z) < W.harbour.l + m;
        const pitHere = (i, sd) => W.pitIdx && PITS && sd === PITS.side && W.pitIdx[i];
        const flat = (i, sd) => tp(i).y < .4 && W.walls[i] && W.openSide[i] !== sd && !pitHere(i, sd) && !(STRIP_SKIP && STRIP_SKIP(i));
        // the promenade: pale stone slabs from the back of the hedge 2.7 m out
        const paveT = canvasTex(128, 128, (x) => { x.fillStyle = '#e6dccb'; x.fillRect(0, 0, 128, 128);
          for (let k = 0; k < 700; k++) { x.fillStyle = Math.random() < .5 ? 'rgba(0,0,0,.04)' : 'rgba(255,255,255,.14)'; x.fillRect(rand(0, 128), rand(0, 128), 2, 2); }
          x.fillStyle = 'rgba(110,95,75,.3)'; for (let k = 0; k <= 128; k += 32) { x.fillRect(k, 0, 2, 128); x.fillRect(0, k, 128, 2); } });
        paveT.wrapS = paveT.wrapT = THREE.RepeatWrapping;
        const paveM = new THREE.MeshStandardMaterial({ map: paveT, roughness: .95, fog: !def.clearRoad });
        for (const sd of [-1, 1]) { const [l0, l1] = sd > 0 ? [HALF + 2, HALF + 4.7] : [-HALF - 4.7, -HALF - 2]; const m = new THREE.Mesh(strip(l0, l1, .015, .015, { uvLen: 2.7, only: (i) => flat(i, sd) }), paveM); m.receiveShadow = true; scene.add(m); }   // (left to right, so it faces up)
        // benches on it, between the lamps, facing the track
        const benchG = (() => { const g = new THREE.Group(), wood = M('#a8723f', { roughness: .8 }), iron = M('#2c3036', { roughness: .5, metalness: .5 });
          for (let k = 0; k < 3; k++) box(g, 1.9, .05, .14, wood, 0, .46, .18 - k * .17);
          for (let k = 0; k < 2; k++) box(g, 1.9, .12, .04, wood, 0, .68 + k * .17, -.27);
          for (const x of [-.8, .8]) { box(g, .06, .46, .06, iron, x, .23, .16); box(g, .06, .9, .06, iron, x, .45, -.25); box(g, .06, .06, .5, iron, x, .45, -.04); }
          return bakeOne(g); })();
        const benches = [];
        for (let i = 15; i < TRACK.N; i += 30) { const sd = (Math.floor(i / 30) % 2) ? 1 : -1; if (!flat(i, sd)) continue; const p = tp(i);
          const x = p.x + p.nx * sd * (HALF + 3.25), z = p.z + p.nz * sd * (HALF + 3.25); if (nearStart(x, z, 45) || !farFromRoad(x, z, 2.6)) continue;
          benches.push({ x, y: p.y, z, s: 1, ry: Math.atan2(-sd * p.nx, -sd * p.nz) }); }
        benches.length && instanced(scene, benchG, vcm2, benches, false);
        // luxury cars: long-nosed GT coupés in rich paint, chrome wheels, parked on bays along the straights
        const carG = (paint) => { const g = new THREE.Group(), body = M(paint, { roughness: .25, metalness: .55 }), glass = M('#1a2230', { roughness: .1, metalness: .7 }),
            tyre = M('#16161a', { roughness: .9 }), chrome = M('#dfe3ea', { roughness: .15, metalness: .9 }), red = M('#d01828', { roughness: .4 }), lamp = M('#f4f7ff', { roughness: .2 }), bay = M('#3a3d44', { roughness: .95 }), line = M('#f2f2f2', { roughness: .9 });
          // a side profile (length along x, height y) made solid across the car's width, then turned so the nose points +z
          const solid = (pts, wd, mat, bev = .05) => { const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
            const ge = new THREE.ExtrudeGeometry(sh, { depth: wd - 2 * bev, bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 2, curveSegments: 4 }).rotateY(-Math.PI / 2).translate(wd / 2 - bev, 0, 0);
            g.add(new THREE.Mesh(ge, mat)); };
          box(g, 2.9, .03, 5.6, bay, 0, .015, 0); for (const x of [-1.45, 1.45]) box(g, .1, .035, 5.6, line, x, .02, 0);
          solid([[-2.2, .3], [2.15, .3], [2.32, .44], [2.22, .6], [1.6, .7], [.85, .82], [-1.5, .86], [-2.15, .82], [-2.3, .62]], 1.92, body);   // the low body, a long bonnet
          solid([[-1.35, .8], [.82, .8], [.2, 1.17], [-.62, 1.2], [-1.15, 1.02]], 1.52, glass, .04);                                              // the glass cabin, a fastback
          box(g, 1.3, .05, .78, body, 0, 1.21, -.21);                                                                                              // its roof
          for (const x of [-.7, .7]) { box(g, .38, .09, .06, lamp, x, .56, 2.3); box(g, .46, .08, .06, red, x, .66, -2.28); }
          box(g, .9, .12, .05, M('#141418'), 0, .4, 2.33);
          for (const [x, z] of [[-.9, 1.42], [.9, 1.42], [-.9, -1.38], [.9, -1.38]]) {
            const t = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .3, 18).rotateZ(Math.PI / 2), tyre); t.position.set(x, .34, z); g.add(t);
            const r = new THREE.Mesh(new THREE.CylinderGeometry(.23, .23, .32, 12).rotateZ(Math.PI / 2), chrome); r.position.set(x * 1.01, .34, z); g.add(r); }
          return bakeOne(g); };
        const paints = ['#b3121f', '#121418', '#f3f2ee', '#f2c200', '#9aa3ad', '#173f8a', '#0e4d33'], carGeos = paints.map(carG), cars = paints.map(() => []);
        { let k = 0, lastS = -1e9;
          for (let i = 0; i < TRACK.N; i += 4) { const s0 = i * STEP; if (s0 - lastS < 70) continue;
            let ok = true; for (let d = -10; d <= 10 && ok; d += 5) if (bendAt(s0 + d) > .3) ok = false; if (!ok) continue;   // (gently curving is fine: the city has few straights)
            for (const sd of k % 2 ? [1, -1] : [-1, 1]) { const run = [];
              for (let j = -2; j <= 1; j++) { const ii = (i + Math.round(j * 6.4 / STEP) + TRACK.N) % TRACK.N; if (!flat(ii, sd)) break; const p = tp(ii);
                const x = p.x + p.nx * sd * (HALF + 6.3), z = p.z + p.nz * sd * (HALF + 6.3); if (nearStart(x, z, 55) || inHarbour(x, z) || !farFromRoad(x, z, 4.6)) break;
                run.push({ x, y: p.y, z, s: 1, ry: Math.atan2(-sd * p.nx, -sd * p.nz) }); }   // (nose to the track, like a car show)
              if (run.length === 4) { run.forEach((c) => cars[Math.floor(rand(0, paints.length))].push(c)); lastS = s0; k++; break; } } } }
        cars.forEach((list, n) => list.length && instanced(scene, carGeos[n], new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: .45, fog: !def.clearRoad }), list));
        // fountains: three, out in the lawn where they can be seen from the road
        const fountains = [];
        for (let t = 0; t < 4000 && fountains.length < 3; t++) { const x = rand(BOUNDS.x0 - 30, BOUNDS.x1 + 30), z = rand(BOUNDS.z0 - 30, BOUNDS.z1 + 30);
          if (!farFromRoad(x, z, 15, 3) || farFromRoad(x, z, 26, 3) || inHarbour(x, z, 12) || nearStart(x, z, 70) || fountains.some((f) => (f.x - x) ** 2 + (f.z - z) ** 2 < 110 ** 2)) continue;
          fountains.push({ x, z }); }
        const stoneF = M('#e4dccb', { roughness: .85 }), waterF = new THREE.MeshStandardMaterial({ color: '#4ab0dc', roughness: .1, metalness: .2 }), spray = new THREE.MeshBasicMaterial({ color: '#eaf8ff', transparent: true, opacity: .55, depthWrite: false }), jets = [];
        for (const f of fountains) { const g = new THREE.Group(); g.position.set(f.x, 0, f.z); scene.add(g);
          const gravel = new THREE.Mesh(new THREE.CircleGeometry(8, 40).rotateX(-Math.PI / 2), M('#ddd0b4', { roughness: 1 })); gravel.position.y = .02; gravel.receiveShadow = true; g.add(gravel);
          g.add(new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.6, .6, 40, 1, true).translate(0, .3, 0), stoneF)); g.add(new THREE.Mesh(new THREE.TorusGeometry(4.5, .18, 6, 40).rotateX(Math.PI / 2).translate(0, .6, 0), stoneF));
          g.add(new THREE.Mesh(new THREE.CircleGeometry(4.4, 40).rotateX(-Math.PI / 2).translate(0, .45, 0), waterF));
          g.add(new THREE.Mesh(new THREE.CylinderGeometry(.3, .45, 1.8, 12).translate(0, .9, 0), stoneF)); g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.5, .5, .4, 20).translate(0, 1.9, 0), stoneF));
          g.add(new THREE.Mesh(new THREE.CylinderGeometry(.18, .25, .9, 10).translate(0, 2.5, 0), stoneF)); g.add(new THREE.Mesh(new THREE.CylinderGeometry(.7, .2, .25, 16).translate(0, 3.05, 0), stoneF));
          const jet = new THREE.Mesh(new THREE.ConeGeometry(.35, 2.2, 12, 1, true).translate(0, 1.1, 0), spray); jet.position.y = 3.15; g.add(jet);
          const fall = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 2.4, 1.5, 24, 1, true).translate(0, -.75, 0), spray); fall.position.y = 2.1; g.add(fall);
          jets.push({ jet, fall, ph: rand(0, 6) }); }
        if (jets.length) W.anim.push((dt, t) => { for (const j of jets) { const k = 1 + .12 * Math.sin(t * 7 + j.ph); j.jet.scale.set(1, k, 1); j.fall.scale.set(1 + .03 * Math.sin(t * 9 + j.ph), 1, 1 + .03 * Math.sin(t * 9 + j.ph)); } });
        // the lawn's trees, bushes and flower beds
        const treeG = (leafC) => { const g = new THREE.Group(), bark = M('#7a5a3c', { roughness: .95 }), leaf = M(leafC, { roughness: .95 });
          g.add(new THREE.Mesh(new THREE.CylinderGeometry(.2, .3, 2.6, 7).translate(0, 1.3, 0), bark));
          for (const [x, y, z, r] of [[0, 3.6, 0, 1.9], [.9, 3.1, .3, 1.35], [-.8, 3.2, -.4, 1.3], [.1, 4.5, -.2, 1.25]]) g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1).translate(x, y, z), leaf));
          return bakeOne(g); };
        const cypG = (() => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.CylinderGeometry(.15, .2, .8, 6).translate(0, .4, 0), M('#6a4a30')));
          g.add(new THREE.Mesh(new THREE.ConeGeometry(.75, 6, 8).translate(0, 3.6, 0), M('#2c5a30', { roughness: 1 }))); g.add(new THREE.Mesh(new THREE.SphereGeometry(.76, 8, 6).scale(1, 1.3, 1).translate(0, 1.2, 0), M('#2c5a30', { roughness: 1 }))); return bakeOne(g); })();
        const bushG = (() => { const g = new THREE.Group(), l = M('#3f8a3a', { roughness: 1 }); for (const [x, z, r] of [[0, 0, .8], [.8, .3, .6], [-.7, .2, .65], [.1, -.7, .55]]) g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1).translate(x, r * .75, z), l)); return bakeOne(g); })();
        const bedG = (cs) => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.8, .26, 20).translate(0, .13, 0), M('#d8cdb6', { roughness: .9 })));
          g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, .3, 20).translate(0, .16, 0), M('#5e4330', { roughness: 1 })));
          for (let k = 0; k < 22; k++) { const a = rand(0, 6.28), r = Math.sqrt(rand(0, 1)) * 1.35; g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(rand(.16, .24), 0).translate(Math.cos(a) * r, .42, Math.sin(a) * r), M(cs[k % cs.length], { roughness: .8 }))); }
          return bakeOne(g); };
        const lists = { t1: [], t2: [], cy: [], bu: [], b1: [], b2: [] };
        for (let gx = BOUNDS.x0 - 80; gx < BOUNDS.x1 + 80; gx += 8.5) for (let gz = BOUNDS.z0 - 80; gz < BOUNDS.z1 + 80; gz += 8.5) {
          const x = gx + rand(-3, 3), z = gz + rand(-3, 3);
          if (!farFromRoad(x, z, 9, 3) || inHarbour(x, z) || nearStart(x, z, 60) || fountains.some((f) => (f.x - x) ** 2 + (f.z - z) ** 2 < 11 ** 2)) continue;
          const belt = !farFromRoad(x, z, 34, 3) || inField(x, z), r = Math.random();   // (v301: the whole infield is park)
          if (!belt) { if (r < .08) lists.t1.push({ x, y: 0, z, s: rand(.9, 1.4), ry: rand(0, 6) }); continue; }   // (among the houses: a tree here and there)
          if (r < .24) lists[r < .12 ? 't1' : 't2'].push({ x, y: 0, z, s: rand(.85, 1.35), ry: rand(0, 6) });
          else if (r < .34) lists.cy.push({ x, y: 0, z, s: rand(.85, 1.2), ry: rand(0, 6) });
          else if (r < .44) lists.bu.push({ x, y: 0, z, s: rand(.8, 1.3), ry: rand(0, 6) });
          else if (r < .5) lists[r < .47 ? 'b1' : 'b2'].push({ x, y: 0, z, s: rand(.9, 1.2), ry: rand(0, 6) });
        }
        // (v299, the user: "add more taller trees around the road") a row of tall park trees (about 11-14 m) on both sides of the
        // road, behind the promenade and the parked cars, every 11 m or so
        const tallG = (leafC, leafC2) => { const g = new THREE.Group(), bark = M('#6e5038', { roughness: .95 }), leaf = M(leafC, { roughness: .95 }), leaf2 = M(leafC2, { roughness: .95 });
          g.add(new THREE.Mesh(new THREE.CylinderGeometry(.28, .45, 7, 8).translate(0, 3.5, 0), bark));
          for (const [x, z, a] of [[.9, .2, .9], [-.8, -.3, -.9]]) { const br = new THREE.Mesh(new THREE.CylinderGeometry(.1, .16, 2.4, 6).translate(0, 1.2, 0), bark); br.position.set(0, 5.2, 0); br.rotation.set(z, 0, -a * .55); g.add(br); }
          for (const [x, y, z, r, c] of [[0, 9.2, 0, 2.6, 0], [1.7, 8, .5, 1.9, 1], [-1.6, 8.2, -.5, 1.9, 0], [.4, 7.2, -1.5, 1.7, 1], [-.5, 7.4, 1.5, 1.7, 0], [.2, 10.9, .1, 1.7, 1]]) g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1).translate(x, y, z), c ? leaf2 : leaf));
          return bakeOne(g); };
        const tall = [[], []];
        // (the middle stretch has ten road variants, one a lap: a row along each of them, clear of all of them)
        const variants = (i) => (TRACK.routes && TRACK.sec && i >= TRACK.sec.i0 && i < TRACK.sec.i1 ? TRACK.routes : [TRACK.pts]), tallAll = [];
        for (const sd of [-1, 1]) for (let d = rand(0, 8); d < TRACK.L; d += rand(9.5, 12.5)) { const i = Math.round(d / STEP) % TRACK.N; if (pitHere(i, sd)) continue;
          for (const R of variants(i)) { const p = R[i], o0 = rand(9, 11);
            for (const off of [o0, o0 + 3, o0 + 6]) { const x = p.x + p.nx * sd * (HALF + off), z = p.z + p.nz * sd * (HALF + off);   // (the nearest spot clear of every road)
              if (!farFromRoad(x, z, 8, 3) || inHarbour(x, z) || nearStart(x, z, 40) || fountains.some((f) => (f.x - x) ** 2 + (f.z - z) ** 2 < 10 ** 2) || tallAll.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 8 ** 2)) continue;
              const t = { x, y: 0, z, s: rand(.95, 1.25), ry: rand(0, 6) }; tallAll.push(t); tall[Math.random() < .5 ? 0 : 1].push(t); break; } } }
        const pm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, fog: !def.clearRoad });
        if (tall[0].length) instanced(scene, tallG('#2f7d34', '#3f9440'), pm, tall[0], false);
        if (tall[1].length) instanced(scene, tallG('#4a9a3c', '#62ad48'), pm, tall[1], false);
        if (lists.t1.length) instanced(scene, treeG('#3f8f3a'), pm, lists.t1, false);
        if (lists.t2.length) instanced(scene, treeG('#5aa43e'), pm, lists.t2, false);
        if (lists.cy.length) instanced(scene, cypG, pm, lists.cy, false);
        if (lists.bu.length) instanced(scene, bushG, pm, lists.bu, false);
        if (lists.b1.length) instanced(scene, bedG(['#ff5d7a', '#ffd23a', '#ffffff', '#ff8ab8']), pm, lists.b1, false);
        if (lists.b2.length) instanced(scene, bedG(['#8a5ae8', '#ff8a1e', '#ffe680', '#e8403a']), pm, lists.b2, false);
        W.park = { fountains, cars: cars.reduce((a, l) => a + l.length, 0), carAt: cars.flat()[0] || null, benches: benches.length, trees: lists.t1.length + lists.t2.length + lists.cy.length, tall: tall[0].length + tall[1].length, tallAt: tall.flat() };   // (a test hook reads this)
      }
      // the overpass: a thick road deck with pillars where the road is up in the air
      const deck = new THREE.MeshStandardMaterial({ map: concreteTex(), roughness: .95, side: THREE.DoubleSide });   // (v293: concrete)
      scene.add(new THREE.Mesh(strip(-HALF - 1.1, HALF + 1.1, -.55, -.55, { uvLen: 4, only: (i) => tp(i).y > .4 }), deck));
      for (const s of [-1, 1]) scene.add(new THREE.Mesh(strip(s * (HALF + 1.1), s * (HALF + 1.1), -.55, 0, { uvLen: 4, only: (i) => tp(i).y > .4 }), deck));
      const lowRoad = (x, z) => (W.roadPts || TRACK.pts).some((q) => q.y < .4 && (q.x - x) ** 2 + (q.z - z) ** 2 < (HALF + 1.2) ** 2);   // (v199) no pillar on the road below
      const pillars = []; for (let i = 0; i < TRACK.N; i += 14) { if (STRIP_SKIP && STRIP_SKIP(i)) continue; const p = tp(i); if (p.y > 1.5) for (const s of [-1, 1]) { const x = p.x + p.nx * s * 4, z = p.z + p.nz * s * 4; if (!lowRoad(x, z)) pillars.push({ x, z, s: 1, sy: p.y - .5, sx: 1, sz: 1 }); } }
      instanced(scene, new THREE.CylinderGeometry(.6, .7, 1, 12).translate(0, .5, 0), M('#b9b7b0', { roughness: .9 }), pillars);
      // buildings: one merged mesh. (v293, the user: "so the buildings don't look like arc reactors") no more walls of
      // glowing coloured squares: Riviera houses — pastel walls, one floor and one window bay per 4 m tile, a framed dark
      // window with green shutters and a little balcony rail, a cream cornice round the top and a terracotta roof on
      // the lower ones; and they stand back behind the park (34 m from any road, was 15)
      const winTex = canvasTex(64, 64, (x) => {
        x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64);
        x.fillStyle = '#d9d2c6'; x.fillRect(0, 0, 64, 3);                                   // the floor line
        x.fillStyle = '#4d7a5c'; x.fillRect(11, 14, 8, 36); x.fillRect(45, 14, 8, 36);      // the shutters
        x.fillStyle = 'rgba(0,0,0,.18)'; for (let k = 0; k < 6; k++) { x.fillRect(11, 17 + k * 6, 8, 1); x.fillRect(45, 17 + k * 6, 8, 1); }
        x.fillStyle = '#f7f3ea'; x.fillRect(19, 12, 26, 40);                                // the frame
        const g = x.createLinearGradient(21, 14, 43, 50); g.addColorStop(0, '#6f8aa6'); g.addColorStop(.45, '#2f3f55'); g.addColorStop(1, '#25303f'); x.fillStyle = g; x.fillRect(22, 15, 20, 34);
        x.fillStyle = '#f7f3ea'; x.fillRect(31, 15, 2, 34); x.fillRect(22, 30, 20, 2);       // the glazing bars
        x.fillStyle = '#3a3a40'; x.fillRect(15, 52, 34, 2); for (let k = 15; k <= 47; k += 4) x.fillRect(k, 52, 1, 7); x.fillRect(15, 58, 34, 1);   // the balcony rail
      });
      winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
      const pos = [], nor = [], uv = [], col = [], pal = ['#f2d7a7', '#efb9a0', '#f6e6c8', '#e9c46a', '#f4c7b8', '#d8e3d0', '#f7efe3', '#e8a87c', '#cfe0ea', '#f3d9c4'];
      const blds = [], cornice = new THREE.Color('#f6efe0'), tiles = new THREE.Color('#b5583a'), flatRoof = new THREE.Color('#c9c4bb');
      const put = (geo, colOf, plain) => { const u = geo.attributes.uv, n = geo.attributes.normal; pos.push(...geo.attributes.position.array); nor.push(...n.array);
        for (let i = 0; i < u.count; i++) { if (plain) uv.push(.05, .02); else uv.push(u.getX(i), u.getY(i)); const c = colOf(n.getY(i)); col.push(c.r, c.g, c.b); } };
      for (let gx = BOUNDS.x0 - 70; gx < BOUNDS.x1 + 70; gx += 24) for (let gz = BOUNDS.z0 - 70; gz < BOUNDS.z1 + 70; gz += 24) {
        const x = gx + rand(-4, 4), z = gz + rand(-4, 4); if (!farFromRoad(x, z, 34, 3) || inField(x, z)) continue;   // (v301: none inside the circuit)
        if (W.harbour && Math.abs(x - W.harbour.x) < W.harbour.w + 9 && Math.abs(z - W.harbour.z) < W.harbour.l + 9) continue;
        const w = rand(10, 17), d = rand(10, 17), h = Math.round(rand(3, 9) * (farFromRoad(x, z, 60, 6) ? 1.35 : 1)) * 4; blds.push({ x, z, w, d, h });
        const bg = new THREE.BoxGeometry(w, h, d).toNonIndexed().translate(x, h / 2, z), c = new THREE.Color(pick(pal)), u = bg.attributes.uv, n = bg.attributes.normal;
        for (let i = 0; i < u.count; i++) { const ny = Math.abs(n.getY(i)) > .5; u.setXY(i, u.getX(i) * (ny ? 1 : (Math.abs(n.getX(i)) > .5 ? d : w) / 4), u.getY(i) * (ny ? 1 : h / 4)); }
        const low = h < 22; put(bg, (ny) => (ny > .5 ? (low ? tiles : flatRoof) : c), false);
        put(new THREE.BoxGeometry(w + .7, .55, d + .7).toNonIndexed().translate(x, h - .1, z), () => cornice, true);   // the cornice
        if (low) { const r = new THREE.ConeGeometry(Math.hypot(w, d) / 2 * 1.02, 3.2, 4, 1).toNonIndexed(); r.rotateY(Math.PI / 4); r.scale(w / Math.hypot(w, d) * Math.SQRT2, 1, d / Math.hypot(w, d) * Math.SQRT2); r.translate(x, h + .15 + 1.6, z); put(r, () => tiles, true); }   // a hipped tile roof
      }
      const bgeo = new THREE.BufferGeometry(); bgeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bgeo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); bgeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); bgeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const bm = new THREE.Mesh(bgeo, new THREE.MeshStandardMaterial({ map: winTex, vertexColors: true, roughness: .85 })); bm.castShadow = false; bm.receiveShadow = true; scene.add(bm);
      // neon signs on the buildings that face the road
      const words = [['ROBO CITY', '#7af8ff'], ['FOXINO', '#ff8a1e'], ['ENGLISH!', '#4fc84a'], ['FUGIO', '#ff5db1'], ['ROB RULES', '#ff3a5a'], ['SPEED!', '#ffe14a']];
      const signTex = words.map(([w, c]) => canvasTex(512, 128, (x) => { x.fillStyle = '#120a2a'; x.fillRect(0, 0, 512, 128); x.strokeStyle = c; x.lineWidth = 8; x.strokeRect(8, 8, 496, 112); x.font = 'bold 76px Fredoka, Arial Rounded MT Bold, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = c; x.shadowBlur = 18; x.fillStyle = c; x.fillText(w, 256, 68); x.fillStyle = '#fff'; x.shadowBlur = 0; x.globalAlpha = .55; x.fillText(w, 256, 68); }));
      const near = blds.filter((b) => !farFromRoad(b.x, b.z, 46, 3)).sort(() => Math.random() - .5).slice(0, 10);   // (v293: the front row, now behind the park)
      near.forEach((b, n) => {
        let best = 1e9, bp = TRACK.pts[0]; for (let i = 0; i < TRACK.N; i += 3) { const p = TRACK.pts[i], d = (p.x - b.x) ** 2 + (p.z - b.z) ** 2; if (d < best) { best = d; bp = p; } }
        const dx = bp.x - b.x, dz = bp.z - b.z, face = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
        const t = signTex[n % signTex.length], m = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: t }));
        m.position.set(b.x + face[0] * (b.w / 2 + .1), Math.min(b.h - 2, rand(7, 13)), b.z + face[1] * (b.d / 2 + .1)); m.rotation.y = Math.atan2(face[0], face[1]); scene.add(m);
      });
      // street lamps behind the walls, with glowing heads
      const lamps = []; for (let i = 0; i < TRACK.N; i += 30) for (const s of [-1, 1]) { const p = tp(i); lamps.push({ x: p.x + p.nx * s * (HALF + 2.4), z: p.z + p.nz * s * (HALF + 2.4), y: p.y > .4 ? p.y : 0, s: 1, ry: Math.atan2(-s * p.nx, -s * p.nz) }); }
      const lampG = new THREE.Group(); { const pole = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, 6, 8), M('#2a2e3a')); pole.position.y = 3; lampG.add(pole); const arm = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, 1.6), M('#2a2e3a')); arm.position.set(0, 6, .7); lampG.add(arm); }
      instanced(scene, bakeOne(lampG), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5 }), lamps, false);
      instanced(scene, new THREE.SphereGeometry(.32, 12, 8).translate(0, 5.8, 1.4), new THREE.MeshBasicMaterial({ color: '#fff0b0' }), lamps, false);
      // Rob's robot fans cheering behind the walls (off since v62, see CROWD)
      const fans = []; if (CROWD) for (let i = 0; i < TRACK.N; i += 9) { if (tp(i).y > .4 || Math.random() < .35) continue; const p = tp(i), s = pick([-1, 1]); fans.push({ x: p.x + p.nx * s * (HALF + 2.2 + rand(0, 2)), z: p.z + p.nz * s * (HALF + 2.2 + rand(0, 2)), s: rand(.8, 1.1), ry: Math.atan2(-s * p.nx, -s * p.nz) + rand(-.3, .3) }); }
      if (CROWD) { W.fans = instanced(scene, robotFanGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .4 }), fans, false); W.fanList = fans; }
      // (v293: the giant gold gears that floated by the road are gone — the user: they looked like arc reactors)
      const clouds = []; for (let k = 0; k < 14; k++) { const a = rand(0, 6.28), r = rand(220, 380); clouds.push({ x: MID.x + Math.cos(a) * r, y: rand(70, 110), z: MID.z + Math.sin(a) * r, s: rand(1.4, 2.6), ry: rand(0, 6) }); }
      instanced(scene, cloudGeo('#ffc0d8'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: '#ff9ac0', emissiveIntensity: .35 }), clouds, false);
      const moon = new THREE.Mesh(new THREE.SphereGeometry(30, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff4d8', fog: false })); moon.position.set(MID.x - 300, 190, MID.z - 420); scene.add(moon);
      flagsAndBoards(scene, W, false); grandstands(scene, W, '#8a4ae8');
      // drones buzzing round the track with spinning rotors and blinking lights, and a blimp with a banner
      {
        const body = M('#2a2e3a', { roughness: .3, metalness: .5 }), rot = M('#9aa3b0', { roughness: .3 });
        const dg = new THREE.Group(); dg.add(new THREE.Mesh(new THREE.SphereGeometry(.5, 12, 8).scale(1, .5, 1), body));
        for (const [x, z] of [[-.7, -.7], [.7, -.7], [-.7, .7], [.7, .7]]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .03, 16), rot); r.position.set(x, .22, z); dg.add(r); const a = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, .9), body); a.position.set(x / 2, .12, z / 2); a.rotation.y = Math.atan2(x, z); dg.add(a); }
        const droneGeo = bakeOne(dg), droneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .35, metalness: .4 }), lightGeo = new THREE.SphereGeometry(.16, 8, 6);
        const drones = Array.from({ length: 7 }, (_, k) => {
          const g = new THREE.Group(); g.add(new THREE.Mesh(droneGeo, droneMat));
          const light = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: pick(['#7af8ff', '#ff5db1', '#ffe14a']) })); light.position.y = -.25; g.add(light);
          scene.add(g); return { g, rotors: [], light, s: k / 7 * TRACK.L, h: rand(9, 16), lat: rand(-4, 4), v: rand(8, 14) };
        });
        const bl = new THREE.Group(); { const env = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 16).scale(2.4, 1, 1), M('#ff8a1e', { roughness: .5 })); bl.add(env); const fin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.4, .3), M('#1b2a4a')); fin.position.set(-13, 1.5, 0); bl.add(fin);
          const t = canvasTex(512, 128, (x) => { x.fillStyle = '#1b2a4a'; x.fillRect(0, 0, 512, 128); x.font = 'bold 74px Fredoka, Arial Rounded MT Bold, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffe14a'; x.fillText('FOXKARTS', 256, 68); });
          for (const sd of [-1, 1]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })); b.position.set(0, -.5, sd * 6.05); bl.add(b); } }
        scene.add(bl);
        W.anim.push((dt, t) => {
          for (const d of drones) { d.s = (d.s + d.v * dt) % TRACK.L; const p = at(d.s, d.lat); d.g.position.set(p.x, p.y + d.h + Math.sin(t * 2 + d.h) * .4, p.z); d.g.rotation.y = -angleOf(p.p); for (const r of d.rotors) r.rotation.y += dt * 40; d.light.visible = Math.sin(t * 6 + d.h) > 0; }
          const a = t * .05; bl.position.set(MID.x + Math.cos(a) * 140, 55, MID.z + Math.sin(a) * 140); bl.rotation.y = -a - Math.PI;
        });
      }
      // (v299, the user: "remove this block from the road") the v98 sky bridges are gone: their grey deck sat 8 m over the road, right where the karts fly off the jump ramps
      // flying roadsters: a low wedge body in bright paint, a dark glass canopy, red tail and white head lights, a cyan hover glow
      { const carG = (paint) => { const g = new THREE.Group(), body = M(paint, { roughness: .3, metalness: .5 }), glass = M('#141a2e', { roughness: .1, metalness: .6 }), tail = new THREE.MeshStandardMaterial({ color: '#ff2a3a', emissive: '#ff2a3a', emissiveIntensity: 1.4 }), head = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.2 }), hover = new THREE.MeshStandardMaterial({ color: '#5fe8ff', emissive: '#5fe8ff', emissiveIntensity: 1.5 });
          const b = new THREE.Mesh(new THREE.BoxGeometry(1.9, .45, 4.4), body); b.position.y = .4; g.add(b); const nose = new THREE.Mesh(new THREE.BoxGeometry(1.8, .3, 1.2), body); nose.position.set(0, .3, 2.6); nose.rotation.x = .18; g.add(nose);
          const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, .42, 1.8), glass); cab.position.set(0, .82, -.2); cab.rotation.x = -.05; g.add(cab);
          box(g, 1.7, .12, .08, tail, 0, .5, -2.22); box(g, .4, .1, .08, head, -.6, .45, 3.2); box(g, .4, .1, .08, head, .6, .45, 3.2); box(g, 1.5, .06, 3.4, hover, 0, .14, 0);
          return g; };
        const cols = ['#ff3a5a', '#2a8cff', '#ffffff', '#ffd23a', '#8a4ae8', '#3ad8a8', '#ff8a1e'], cars = [];
        for (let k = 0; k < 14; k++) { const g = carG(cols[k % cols.length]); scene.add(g); cars.push({ g, r: rand(60, 170), h: rand(16, 38), v: rand(.12, .26) * (k % 2 ? 1 : -1), a: rand(0, 6.28), e: rand(.6, 1), bob: rand(0, 6) }); }
        W.anim.push((dt, t) => { for (const c of cars) { c.a += c.v * dt; const x = MID.x + Math.cos(c.a) * c.r, z = MID.z + Math.sin(c.a) * c.r * c.e; c.g.position.set(x, c.h + Math.sin(t * 1.3 + c.bob) * .6, z); c.g.rotation.set(0, Math.atan2(-Math.sin(c.a) * c.v, Math.cos(c.a) * c.e * c.v), Math.sin(t + c.bob) * .06); } }); }
      // the sunset: a big low sun and pink-lit clouds
      { const sun = new THREE.Mesh(new THREE.SphereGeometry(40, 20, 14), new THREE.MeshBasicMaterial({ color: '#ffd28a', fog: false })); sun.position.set(MID.x + 380, 70, MID.z - 520); scene.add(sun);
        const clouds = []; for (let k = 0; k < 24; k++) { const a = rand(0, 6.28), r = rand(180, 380); clouds.push({ x: MID.x + Math.cos(a) * r, y: rand(70, 120), z: MID.z + Math.sin(a) * r, s: rand(1.6, 3), ry: rand(0, 6) }); }
        instanced(scene, cloudGeo('#ffc8d8'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: '#ff9ab8', emissiveIntensity: .35, fog: false }), clouds, false); }
    },
  },
  // Beach Island and Gold Mines borrow the Alps' heightfield ground (it follows the road exactly) and re-dress it
  beach: {
    ground(scene, W, def) {
      const n0 = scene.children.length; THEMES.alps.ground(scene, W); const added = scene.children.slice(n0);
      const sand = canvasTex(256, 256, (x) => { x.fillStyle = '#e8d2a0'; x.fillRect(0, 0, 256, 256); for (let k = 0; k < 2600; k++) { x.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.14)' : 'rgba(120,90,40,.12)'; x.fillRect(rand(0, 256), rand(0, 256), rand(1, 3), rand(1, 3)); } }, [60, 60]);
      added[0].material = new THREE.MeshStandardMaterial({ map: sand, roughness: .95 });
      // the four far planes become the sea: a little lower than the sand, glossy blue with a soft glow
      const sea = new THREE.MeshStandardMaterial({ color: '#1aa8d8', roughness: .15, metalness: .1, emissive: '#0a4a7a', emissiveIntensity: .35 });
      for (const m of added.slice(1)) { m.material = sea; m.position.y -= .35; }
      // the beach stretch: the sand drops away beyond the beach, so the sea (drawn in scenery) lies on top of it
      const g = added[0].geometry, pa = g.attributes.position, ox = added[0].position.x, oz = added[0].position.z; let dirty = false;
      if (W.wide) { for (let v = 0; v < pa.count; v++) { const r = W.latOut(pa.getX(v) + ox, pa.getZ(v) + oz); if (r && r.lat > HALF + 7) pa.setY(v, Math.min(pa.getY(v), r.y - .9 - Math.min(1, (r.lat - HALF - 7) / 4) * 1.8)); } dirty = true; }
      // a hill in the middle of the island: a smooth dome round MID that fades out near the road (the sand, groundAt, and so everything standing on it)
      if (def.hill) {
        const [H, R] = def.hill, P = TRACK.pts, RP = W.roadPts || P, distRoad = (x, z) => { let b = 1e9; for (let i = 0; i < RP.length; i += 5) { const P = RP; const d = (P[i].x - x) ** 2 + (P[i].z - z) ** 2; if (d < b) b = d; } return Math.sqrt(b); };
        // the hill stands on the spot inside the loop that is farthest from the road (the middle of the island, not of the bounding box)
        const inside = (x, z) => { let c = false; for (let i = 0, j = TRACK.N - 1; i < TRACK.N; j = i, i += 6) { const a = P[i], b = P[j]; if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) c = !c; } return c; };
        let C = { x: MID.x, z: MID.z, d: 0 }; for (let x = BOUNDS.x0; x <= BOUNDS.x1; x += 8) for (let z = BOUNDS.z0; z <= BOUNDS.z1; z += 8) { if (!inside(x, z)) continue; const d = distRoad(x, z); if (d > C.d) C = { x, z, d }; }
        const hill = (x, z) => { const d = Math.hypot(x - C.x, z - C.z); if (d > R) return 0; const k = smoothstep(R, 0, d); return H * k * k * smoothstep(HALF + 9, HALF + 36, distRoad(x, z)) * (W.pitDist ? smoothstep(20, 40, W.pitDist(x, z)) : 1); };
        W.hillAt = C;
        for (let v = 0; v < pa.count; v++) { const h = hill(pa.getX(v) + ox, pa.getZ(v) + oz); if (h) pa.setY(v, pa.getY(v) + h); }
        const g0 = W.groundAt; W.groundAt = (x, z) => g0(x, z) + hill(x, z); dirty = true;
      }
      if (dirty) { pa.needsUpdate = true; g.computeVertexNormals(); }
    },
    scenery(scene, W, def) {
      // sand banks beside the road (like the Alps' snowbanks)
      const sb = new THREE.Color('#e6cf9c'), sb2 = new THREE.Color('#f2e0b4'), bc = (i) => (i % 2 ? sb : sb2), vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 });
      for (const sd of [-1, 1]) {
        const keep = (i) => W.openSide[i] !== sd;
        const a = sd > 0 ? strip(HALF + .9, HALF + 2.4, .1, .6, { colour: bc, only: keep }) : strip(-HALF - 2.4, -HALF - .9, .6, .1, { colour: bc, only: keep });
        const b = sd > 0 ? strip(HALF + 2.4, HALF + 4.4, .6, -.05, { colour: bc, only: keep }) : strip(-HALF - 4.4, -HALF - 2.4, -.05, .6, { colour: bc, only: keep });
        for (const g of [a, b]) { const m = new THREE.Mesh(g, vc); m.receiveShadow = true; scene.add(m); }
      }
      // the beach stretch: wet sand, then the sea right beside the road (the boundary), with a soft foam line
      if (W.wide) {
        const sd = W.wide.side, only = (i) => W.openSide[i] === sd, lo = (a, b) => (sd > 0 ? [a, b] : [-b, -a]);
        scene.add(new THREE.Mesh(strip(...lo(HALF + 4.4, HALF + 7.6), .02, .02, { only }), M('#c4a070', { roughness: .95 })));
        scene.add(new THREE.Mesh(strip(...lo(HALF + 7.3, HALF + 8.6), .07, .07, { only }), new THREE.MeshStandardMaterial({ color: '#eaf8ff', roughness: .4, transparent: true, opacity: .85 })));
        scene.add(new THREE.Mesh(strip(...lo(HALF + 8.4, HALF + 70), .06, .06, { only }), new THREE.MeshStandardMaterial({ color: '#1688c4', roughness: .1, metalness: .15, emissive: '#063a66', emissiveIntensity: .3, transparent: true, opacity: .96 })));
      }
      const vcm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, flatShading: true });
      // palms: a leaning trunk, a crown of drooping leaves, coconuts
      const palmGeo = () => {
        const g = new THREE.Group(), bark = M('#9a6a3a'), leaf = M('#2f9a4a'), leaf2 = M('#3fb85a'), nut = M('#6a4a2a');
        for (let k = 0; k < 6; k++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(.16 + (5 - k) * .02, .2 + (5 - k) * .02, 1.3, 7), bark); seg.position.set(k * .12, .6 + k * 1.2, 0); seg.rotation.z = -.1; g.add(seg); }
        for (let k = 0; k < 8; k++) { const l = new THREE.Mesh(new THREE.BoxGeometry(3.4, .07, .8), k % 2 ? leaf : leaf2); const a = k / 8 * Math.PI * 2; l.position.set(.7 + Math.cos(a) * 1.4, 7.6 - .35, Math.sin(a) * 1.4); l.rotation.set(0, -a, -.5); g.add(l); }
        for (let k = 0; k < 3; k++) { const n = new THREE.Mesh(new THREE.SphereGeometry(.22, 8, 6), nut); n.position.set(.7 + rand(-.3, .3), 7.1, rand(-.3, .3)); g.add(n); }
        return bakeOne(g);
      };
      const palms = [], brollies = [], huts = [], rocks = [];
      for (let k = 0; k < 4000 && palms.length < 240; k++) { const x = rand(BOUNDS.x0 - 10, BOUNDS.x1 + 10), z = rand(BOUNDS.z0 - 10, BOUNDS.z1 + 10); if (farFromRoad(x, z, 7) && !W.inWater(x, z)) palms.push({ x, z, s: rand(.7, 1.3), ry: rand(0, 6) }); }
      for (let k = 0; k < 600 && brollies.length < 24; k++) { const x = rand(BOUNDS.x0, BOUNDS.x1), z = rand(BOUNDS.z0, BOUNDS.z1); if (farFromRoad(x, z, 5) && !farFromRoad(x, z, 10) && !W.inWater(x, z)) brollies.push({ x, z, s: rand(.9, 1.2), ry: rand(0, 6), c: pick(['#ff5db1', '#ffe14a', '#1ab8c8', '#ff8a1e', '#4fc84a']) }); }
      for (let k = 0; k < 900 && huts.length < 16; k++) { const x = rand(BOUNDS.x0 + 15, BOUNDS.x1 - 15), z = rand(BOUNDS.z0 + 15, BOUNDS.z1 - 15); if (farFromRoad(x, z, 11) && !W.inWater(x, z) && huts.every((h) => (h.x - x) ** 2 + (h.z - z) ** 2 > 500)) huts.push({ x, z, s: 1, ry: rand(0, 6) }); }
      for (let k = 0; k < 400 && rocks.length < 40; k++) { const x = rand(BOUNDS.x0 - 20, BOUNDS.x1 + 20), z = rand(BOUNDS.z0 - 20, BOUNDS.z1 + 20); if (farFromRoad(x, z, 8) && !W.inWater(x, z)) rocks.push({ x, z, s: rand(.8, 2.4), ry: rand(0, 6) }); }
      for (const l of [palms, brollies, huts, rocks]) for (const d of l) d.y = W.groundAt(d.x, d.z) - .1;
      instanced(scene, palmGeo(), vcm, palms.filter((p) => palms.indexOf(p) % 2 === 0)); instanced(scene, palmGeo(), vcm, palms.filter((p) => palms.indexOf(p) % 2 === 1), false);
      // beach umbrellas (the colour per umbrella) and small huts
      const brolly = new THREE.Group(); { const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 2.6, 6), M('#f4f4f4')); pole.position.y = 1.3; brolly.add(pole); const top = new THREE.Mesh(new THREE.ConeGeometry(1.5, .7, 10), M('#ffffff')); top.position.y = 2.6; brolly.add(top); }
      instanced(scene, bakeOne(brolly), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7 }), brollies.map((b) => ({ ...b, c: b.c })), false);
      const hut = new THREE.Group(); { const body = new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 3.4), M('#d8b070')); body.position.y = 1.3; hut.add(body); const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.8, 4), M('#7a5a2a')); roof.position.y = 3.5; roof.rotation.y = Math.PI / 4; hut.add(roof); const door = new THREE.Mesh(new THREE.BoxGeometry(.9, 1.6, .1), M('#4a3018')); door.position.set(0, .8, 1.75); hut.add(door); }
      // (v96) beach houses on short stilts: a coloured box with white trim, a porch with a rail, a striped awning, a
      // thatched roof; four colourways
      const beachHouse = (wall, stripe) => { const g = new THREE.Group(), white = M('#ffffff'), wood = M('#a87a48'), thatch = M('#d8b470', { roughness: 1 }), wallM = M(wall), glassM = M('#9fe8ff', { emissive: '#3aa8d8', emissiveIntensity: .25 });
        for (const [x, z] of [[-1.8, -1.5], [1.8, -1.5], [-1.8, 1.5], [1.8, 1.5]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, 1.2, 6), wood); p.position.set(x, .6, z); g.add(p); }
        box(g, 4.2, .2, 3.6, wood, 0, 1.25, 0); box(g, 4, 2.4, 3.2, wallM, 0, 2.55, 0); box(g, 4.1, .16, 3.3, white, 0, 3.8, 0);
        for (const x of [-1.1, 1.1]) { box(g, .9, .9, .08, glassM, x, 2.7, 1.62); box(g, 1.05, .12, .14, white, x, 2.2, 1.64); }
        box(g, .9, 1.7, .1, white, 0, 2.2, 1.62); box(g, 4.2, .14, 1.4, wood, 0, 1.25, 2.4); box(g, 4.2, .08, .08, white, 0, 1.95, 3.05);
        for (let k = 0; k < 9; k++) box(g, .06, .7, .06, white, -2 + k * .5, 1.6, 3.05);
        for (let k = 0; k < 6; k++) { const a = new THREE.Mesh(new THREE.BoxGeometry(.7, .06, 1.3), M(k % 2 ? '#ffffff' : stripe)); a.position.set(-1.75 + k * .7, 3.45, 2.3); a.rotation.x = .35; g.add(a); }
        const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.9, 4), thatch); roof.position.y = 4.85; roof.rotation.y = Math.PI / 4; g.add(roof);
        return bakeOne(g); };
      [['#4fd0c8', '#ff5a5a'], ['#ffb0a0', '#2a8cff'], ['#ffe27a', '#ff7a1e'], ['#9fd8ff', '#ff5db1']].forEach(([w, st], i) => instanced(scene, beachHouse(w, st), vcm, huts.filter((_, k) => k % 4 === i)));
      // rest spots: two sunbeds with cushions and towels under a striped umbrella, a beach ball or a surfboard, along the road
      { const sunbed = new THREE.Group(), frame = M('#ffffff'), wood = M('#c89a68');
        box(sunbed, .7, .12, 1.9, wood, 0, .35, 0); const back = box(sunbed, .7, .12, .8, wood, 0, .62, -.85); back.rotation.x = .7; for (const [x, z] of [[-.3, -.8], [.3, -.8], [-.3, .8], [.3, .8]]) box(sunbed, .06, .35, .06, frame, x, .17, z);
        const bedG = bakeOne(sunbed), cushG = new THREE.BoxGeometry(.6, .1, 1.3).translate(0, .46, .25);
        const umb = new THREE.Group(); { const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 2.6, 6), frame); pole.position.y = 1.3; umb.add(pole); for (let k = 0; k < 8; k++) { const seg = new THREE.Mesh(new THREE.ConeGeometry(1.7, .7, 8, 1, true, k * Math.PI / 4, Math.PI / 4), M(k % 2 ? '#ffffff' : '#ff5a5a', { side: THREE.DoubleSide })); seg.position.y = 2.75; umb.add(seg); } }
        const umbG = bakeOne(umb), ballG = new THREE.SphereGeometry(.32, 12, 8).translate(0, .32, 0), boardG = new THREE.CapsuleGeometry(.28, 1.8, 4, 8).scale(1, 1, .18).rotateX(-.25).translate(0, 1.05, 0);
        const beds = [], cush = [], umbs = [], balls = [], boards = [], cc = ['#ff5db1', '#2a8cff', '#ffd23a', '#4fc84a', '#ff8a1e', '#8a4ae8'];
        for (let i = 0; i < TRACK.N; i += 26) { const p = tp(i), f = i / TRACK.N; if (def.tunnel && f > def.tunnel[0] - .02 && f < def.tunnel[1] + .02) continue;
          for (const sd of [-1, 1]) { if (W.openSide[i] === sd || Math.random() < .35) continue; const lat = sd * (HALF + rand(6, 9)), x = p.x + p.nx * lat, z = p.z + p.nz * lat; if (W.inWater(x, z)) continue; const y = W.groundAt(x, z) - .05, ry = Math.atan2(-sd * p.nx, -sd * p.nz);
            for (const off of [-.6, .6]) { const ox = x + p.tx * off, oz = z + p.tz * off, c = pick(cc); beds.push({ x: ox, y, z: oz, s: 1, ry }); cush.push({ x: ox, y, z: oz, s: 1, ry, c }); }
            umbs.push({ x: x + p.tx * 1.6, y, z: z + p.tz * 1.6, s: 1, ry: rand(0, 6) });
            if (Math.random() < .5) balls.push({ x: x - p.tx * 1.7 + rand(-.5, .5), y, z: z - p.tz * 1.7, s: 1, c: pick(cc) }); else boards.push({ x: x - p.tx * 1.9, y, z: z - p.tz * 1.9, s: 1, ry, c: pick(cc) }); } }
        instanced(scene, bedG, vcm, beds); instanced(scene, cushG, new THREE.MeshStandardMaterial({ roughness: .8 }), cush, false); instanced(scene, umbG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7, side: THREE.DoubleSide }), umbs);
        instanced(scene, ballG, new THREE.MeshStandardMaterial({ roughness: .4 }), balls); instanced(scene, boardG, new THREE.MeshStandardMaterial({ roughness: .35 }), boards); }
      const rockG = new THREE.IcosahedronGeometry(1, 0); instanced(scene, rockG, M('#8a8a90', { roughness: .95, flatShading: true }), rocks);
      // a wooden pier out over the water near the start, and clouds
      { const s0 = at(TRACK.L * .5, 0).p, side = Math.sign(s0.nx) || 1, pier = new THREE.Group(), wood = M('#a87a48', { roughness: .8 });
        for (let k = 0; k < 7; k++) { const pl = new THREE.Mesh(new THREE.BoxGeometry(3, .2, 2.2), wood); pl.position.set(0, 1.4, -k * 2.3); pier.add(pl); for (const sx of [-1.2, 1.2]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(.12, .14, 2.4, 6), wood); post.position.set(sx, .2, -k * 2.3); pier.add(post); } }
        pier.position.set(s0.x + s0.nx * side * (HALF + 12), 0, s0.z + s0.nz * side * (HALF + 12)); pier.rotation.y = Math.atan2(s0.nx * side, s0.nz * side); scene.add(pier); }
      // a cloudy day: a sky full of big soft clouds, some of them grey underneath
      const clouds = []; for (let k = 0; k < 46; k++) { const a = rand(0, 6.28), r = rand(60, 360); clouds.push({ x: MID.x + Math.cos(a) * r, y: rand(50, 110), z: MID.z + Math.sin(a) * r, s: rand(1.6, 3.6), ry: rand(0, 6) }); }
      instanced(scene, cloudGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: .22 }), clouds.filter((_, k) => k % 3), false);
      instanced(scene, cloudGeo('#d8dde6'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: '#dde4ee', emissiveIntensity: .18 }), clouds.filter((_, k) => !(k % 3)), false);
      const sun = new THREE.Mesh(new THREE.SphereGeometry(30, 20, 14), new THREE.MeshBasicMaterial({ color: '#fff8d0', fog: false })); sun.position.set(MID.x - 460, 260, MID.z - 500); scene.add(sun);
      // the sand-castle tunnel: the road dips into a trench between castle A and castle B; a sand lid closes the trench at
      // the surface with a sand road running over it, sand skirts hang down its edges, lanterns light the inside
      if (def.tunnel) {
        const [fa, fb, yTop] = def.tunnel, N = TRACK.N, ia = Math.round(fa * N), ib = Math.round(fb * N), sandM = M('#e3c78e', { roughness: .95 }), darkM = M('#b89262', { roughness: .95, side: THREE.DoubleSide });
        // a flat strip at one absolute height (the road below runs at its own depth)
        const flat = (a, b, y, i0, i1, uvLen) => { const pos = [], uv = []; for (let i = i0; i < i1; i++) { const p = tp(i), q = tp(i + 1); pos.push(p.x + p.nx * a, y, p.z + p.nz * a, p.x + p.nx * b, y, p.z + p.nz * b, q.x + q.nx * a, y, q.z + q.nz * a, p.x + p.nx * b, y, p.z + p.nz * b, q.x + q.nx * b, y, q.z + q.nz * b, q.x + q.nx * a, y, q.z + q.nz * a); const v0 = (i - i0) * STEP / (uvLen || 1), v1 = (i + 1 - i0) * STEP / (uvLen || 1); uv.push(0, v0, 1, v0, 0, v1, 1, v0, 1, v1, 0, v1); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; };
        const wall = (lat, y0, y1, i0, i1) => { const pos = []; for (let i = i0; i < i1; i++) { const p = tp(i), q = tp(i + 1); pos.push(p.x + p.nx * lat, y0, p.z + p.nz * lat, p.x + p.nx * lat, y1, p.z + p.nz * lat, q.x + q.nx * lat, y0, q.z + q.nz * lat, p.x + p.nx * lat, y1, p.z + p.nz * lat, q.x + q.nx * lat, y1, q.z + q.nz * lat, q.x + q.nx * lat, y0, q.z + q.nz * lat); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; };
        const roadTop = canvasTex(128, 256, (x) => { x.fillStyle = '#d9b77a'; x.fillRect(0, 0, 128, 256); for (let k = 0; k < 500; k++) { x.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.12)' : 'rgba(120,80,30,.12)'; x.fillRect(rand(0, 128), rand(0, 256), 2, 2); } x.fillStyle = '#ffffff'; x.fillRect(4, 0, 6, 256); x.fillRect(118, 0, 6, 256); x.fillRect(61, 0, 6, 100); });
        roadTop.wrapT = THREE.RepeatWrapping;
        // (v83, the user: "remove the top layer") the sand lid over the dip is gone: the road runs down an open trench between the castles
        // scene.add(new THREE.Mesh(flat(-HALF - 15, HALF + 15, yTop - .35, ia, ib), darkM));                                         // the ceiling (seen from below)
        // scene.add(new THREE.Mesh(flat(-HALF - 15, HALF + 15, yTop, ia, ib), sandM));                                               // the surface
        // scene.add(new THREE.Mesh(flat(-HALF - 1, HALF + 1, yTop + .06, ia + 8, ib - 8, 12), new THREE.MeshStandardMaterial({ map: roadTop, roughness: .9 })));   // the sand road between the castles
        // for (const sd of [-1, 1]) scene.add(new THREE.Mesh(wall(sd * (HALF + 15), yTop - .35, -7, ia, ib), darkM));             // the skirts down the sides
        const lamps = []; for (let i = ia + 14; i < ib - 10; i += 18) { const p = tp(i); for (const sd of [-1, 1]) lamps.push({ x: p.x + p.nx * sd * (HALF + 2.6), z: p.z + p.nz * sd * (HALF + 2.6), y: p.y + 2.4, s: 1 }); }
        instanced(scene, new THREE.SphereGeometry(.32, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd890' }), lamps, false);
        instanced(scene, new THREE.SphereGeometry(1.1, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffc070', transparent: true, opacity: .16, emissive: '#ff9a30', emissiveIntensity: .6, depthWrite: false }), lamps, false);
        // the castles: a gate the road runs through, a wing and two round towers with cone roofs each side, battlements, flags
        const castleGeo = () => {
          const g = new THREE.Group(), sand = M('#ead093'), dark = M('#cfae6e'), flag = M('#e8403a'), W2 = HALF + 1.3;
          for (const sx of [-1, 1]) {
            box(g, 7, 7.5, 6, sand, sx * (W2 + 3.5), 3.75, 0);
            for (let k = -3; k <= 3; k += 2) box(g, 1.1, 1, 1.1, dark, sx * (W2 + 3.5) + k * .9, 8, 0);
            for (const z of [-2.6, 2.6]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2, 10, 12), sand); t.position.set(sx * (W2 + 6.2), 5, z); g.add(t); const r = new THREE.Mesh(new THREE.ConeGeometry(2.3, 3, 12), dark); r.position.set(sx * (W2 + 6.2), 11.5, z); g.add(r); const pole = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 2.2, 5), dark); pole.position.set(sx * (W2 + 6.2), 14, z); g.add(pole); box(g, 1.4, .8, .05, flag, sx * (W2 + 6.2) + .7, 14.6, z); }
          }
          box(g, W2 * 2 + 7, 1.8, 6, sand, 0, 8.4, 0);                                                                                // the lintel over the gate
          for (let k = -4; k <= 4; k++) box(g, 1.1, 1, 1.1, dark, k * 2, 9.8, 0);                                                     // battlements
          const keep = box(g, 5, 5, 4, sand, 0, 11.8, 0); const kr = new THREE.Mesh(new THREE.ConeGeometry(3.6, 3.4, 4), dark); kr.position.set(0, 16, 0); kr.rotation.y = Math.PI / 4; g.add(kr); void keep;
          return bakeOne(g);
        };
        const cg = castleGeo(), cm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, flatShading: true });
        for (const i of [ia, ib]) { const p = tp(i), m = new THREE.Mesh(cg, cm); m.position.set(p.x, yTop - .1, p.z); m.rotation.y = Math.atan2(p.tx, p.tz); m.castShadow = true; scene.add(m); }
      }
      flagsAndBoards(scene, W, true); grandstands(scene, W, '#1ab8c8');
    },
  },
  mines: {
    // (v112, the user's three reference pictures) the cave is three caverns in a row, blended into each other:
    //   CRYSTAL (0–36 %)  wooden supports with metal bands, hanging lanterns, big glowing crystals, violet rock
    //   WATER   (36–70 %) a turquoise lake, a stone arch bridge, a waterfall, stalactites that drip, golden spires
    //   LAVA    (70–100 %) flowing lava and a lava fall, basalt columns, stone block walls, orange light
    // Everything that glows is SOLID (MeshBasic or emissive) — never see-through, which the user's phone draws wrong.
    ground(scene, W, def) { W.groundAt = () => -40; },   // the cave is closed: there is no outside ground to draw
    scenery(scene, W, def) {
      const N = TRACK.N, L = TRACK.L, TP = .8, K = 7, RING = 4, IN = HALF + (def.wallOut ?? 4.2);
      const _ca = new THREE.Color(), _cb = new THREE.Color();
      /* ---------- the three caverns, and the cross-fade between them ---------- */
      const SEC = [
        { wl: 8.8,  wr: 8.8,  h: 8.6, rock: ['#5a3a86', '#6a4799', '#7a55ab', '#4a2e72'], floor: '#8a6240', hemi: '#b48ce4', hi: .58, fog: '#190c33', sun: .26 },
        { wl: 30,   wr: 12.6, h: 15,  rock: ['#7b8792', '#8b97a2', '#9aa6b0', '#6b7782'], floor: '#74814e', hemi: '#cfe0e8', hi: .98, fog: '#44565f', sun: .46 },
        { wl: 26,   wr: 26,   h: 13,  rock: ['#8a4529', '#9c5333', '#ad613e', '#703720'], floor: '#9c653c', hemi: '#e8834a', hi: .74, fog: '#1d0609', sun: .28 },
      ];
      const B0 = [0, .27, .66], BW = .035, wrapF = (f) => ((f % 1) + 1) % 1;
      const mixAt = (f) => { f = wrapF(f); const i = f < B0[1] ? 0 : f < B0[2] ? 1 : 2, st = B0[i], en = i === 2 ? 1 : B0[i + 1];
        if (f - st < BW) return { a: i, b: (i + 2) % 3, t: .5 - .5 * (f - st) / BW };
        if (en - f < BW) return { a: i, b: (i + 1) % 3, t: .5 - .5 * (en - f) / BW };
        return { a: i, b: i, t: 0 }; };
      const num = (f, key) => { const m = mixAt(f); return SEC[m.a][key] + (SEC[m.b][key] - SEC[m.a][key]) * m.t; };
      const colAt = (f, key, k) => { const m = mixAt(f), A = SEC[m.a][key], B = SEC[m.b][key]; return _ca.set(k === undefined ? A : A[k]).lerp(_cb.set(k === undefined ? B : B[k]), m.t); };
      // the stone bridge: for that stretch the water comes round the right-hand side too
      const BRG0 = .5355, BRG1 = .5625, brg = (f) => smoothstep(BRG0 - .006, BRG0 + .003, wrapF(f)) * (1 - smoothstep(BRG1 - .003, BRG1 + .006, wrapF(f)));
      const wR0 = (f) => num(f, 'wr') + brg(f) * 18, wL0 = (f) => num(f, 'wl'), hC = (f) => num(f, 'h');
      const secOf = (f) => { f = wrapF(f); return f < B0[1] ? 0 : f < B0[2] ? 1 : 2; };
      let wR = wR0, wL = wL0;   // (capped just below, once the room at each point is known)
      // (v117) how wide the cavern may be here. Two limits: a wall further out than the bend's own radius folds back
      // across the road (that was the "wall" at the finish line), and a cavern must never reach another leg of the lap.
      const cap = new Float32Array(N);
      { for (let i = 0; i < N; i++) { const dA = Math.abs(wrapA(angleOf(tp(i + 4)) - angleOf(tp(i - 4)))); cap[i] = dA < 1e-4 ? 1e4 : (8 * STEP) / dA * .5; }
        const S2 = 6;
        for (let i = 0; i < N; i += S2) { const a = tp(i); let best = 1e9;
          for (let j = 0; j < N; j += S2) { const sep = Math.min(Math.abs(i - j), N - Math.abs(i - j)) * STEP; if (sep < 90) continue;
            const b = tp(j), d2 = (a.x - b.x) ** 2 + (a.z - b.z) ** 2; if (d2 < best) best = d2; }
          const c = Math.sqrt(best) * .5 - 2; for (let k = 0; k < S2; k++) { const q = (i + k) % N; cap[q] = Math.min(cap[q], c); } }
        const tmp = Float32Array.from(cap), R2 = 18;
        for (let i = 0; i < N; i++) { let m = 1e9; for (let k = -R2; k <= R2; k++) m = Math.min(m, tmp[(i + k + N) % N]); cap[i] = Math.max(IN, m); } }
      const capAt = (f) => cap[(((Math.round(wrapF(f) * N)) % N) + N) % N];
      wR = (f) => Math.min(wR0(f), capAt(f)); wL = (f) => Math.min(wL0(f), capAt(f));
      // (v177) the pit lane: along it the cavern opens out on the pit side, far enough for the lane and the garages
      // (their backs go into the rock — sheds built into the cave wall)
      if (PITS) { const pw = PITS.laneU + PITS.laneW + 8.5, pk = (f) => { const ds = dsOf(wrapF(f) * L); return smoothstep(PITS.entry - 40, PITS.entry, ds) * (1 - smoothstep(PITS.exit, PITS.exit + 40, ds)); };
        const r0 = wR, l0 = wL; if (PITS.side > 0) wR = (f) => Math.max(r0(f), pw * pk(f)); else wL = (f) => Math.max(l0(f), pw * pk(f)); }
      // (v199) the road variants: the cavern opens out on each side by as far as any variant goes that way
      if (TRACK.routes && TRACK.sec.ground) {
        const eR0 = new Float32Array(N), eL0 = new Float32Array(N), R0 = TRACK.routes[0], { i0, i1 } = TRACK.sec;
        for (const Rr of TRACK.routes) for (let i = i0; i <= i1; i++) { const q = Rr[i]; let bj = i, bd = 1e9;
          for (let k = -40; k <= 40; k++) { const j = (i + k + N) % N, pp = R0[j], d = (pp.x - q.x) ** 2 + (pp.z - q.z) ** 2; if (d < bd) { bd = d; bj = j; } }
          const pp = R0[bj], lat = (q.x - pp.x) * pp.nx + (q.z - pp.z) * pp.nz; if (lat > 0) eR0[bj] = Math.max(eR0[bj], lat); else eL0[bj] = Math.max(eL0[bj], -lat); }
        const sm = (a) => { const m = new Float32Array(N), o = new Float32Array(N); for (let i = 0; i < N; i++) { let x = 0; for (let k = -16; k <= 16; k++) x = Math.max(x, a[(i + k + N) % N]); m[i] = x; }
          for (let i = 0; i < N; i++) { let x = 0; for (let k = -12; k <= 12; k++) x += m[(i + k + N) % N]; o[i] = x / 25; } return o; };
        const eR = sm(eR0), eL = sm(eL0), ix = (f) => (((Math.round(wrapF(f) * N)) % N) + N) % N, r1 = wR, l1 = wL;
        wR = (f) => r1(f) + eR[ix(f)] * 1.1; wL = (f) => l1(f) + eL[ix(f)] * 1.1;
      }
      const openL = (f) => wL(f) - IN, openR = (f) => wR(f) - IN;   // how far the cavern floor reaches past the road's shoulder
      /* ---------- the shape of the cavern wall ---------- */
      const ptAt = (a, f) => { const c = Math.cos(a), s = Math.abs(Math.sin(a)), w = c >= 0 ? wR(f) : wL(f); return [Math.sign(c) * w * Math.abs(c) ** TP, hC(f) * s ** TP]; };
      const TWO = Math.PI * 2 / L, fq = (x) => Math.max(1, Math.round(x / TWO)) * TWO, q1 = fq(.19), q2 = fq(.47), q3 = fq(1.03);
      const lump = (d, a) => Math.sin(d * q1 + a * 2.6) * .6 + Math.sin(d * q2 - a * 4.7 + 1.1) * .38 + Math.sin(d * q3 + a * 8.1 + 2.3) * .1;
      // one big rock plate every SLAB_D metres and every SLAB_A round the arch: the displacement is held flat across
      // a whole plate and snapped to steps, so the wall is made of large angular slabs with crisp edges
      const SLAB_D = L / Math.round(L / 11), SLAB_A = Math.PI / K;
      const slabAt = (d, a) => Math.round(lump(Math.round(d / SLAB_D) * SLAB_D, Math.round(a / SLAB_A) * SLAB_A) * 2.2) / 2.2;
      const slabIx = (d, k) => (Math.abs(Math.round(d / SLAB_D) * 7 + k * 13) % 4);
      const surfAt = (d, a) => { const f = d / L, c = Math.cos(a), [l, h] = ptAt(a, f), wSide = c >= 0 ? wR(f) : wL(f);
        let D = slabAt(d, a) * (.12 * wSide + .4); if (h < 2.6) D = Math.max(D, 0) * smoothstep(0, 1.8, h);
        return [l + Math.cos(a) * D, h + Math.sin(a) * D]; };
      const FLO = -.12;    // the lake and the lava sit almost level with the road, so you see them from the driving seat
      const floorY = (f, sd) => ((sd > 0 ? wR(f) : wL(f)) - IN > .4 ? FLO : -.05);
      const sideOf = (k) => (k === 0 ? 1 : k === K + 2 ? -1 : (k - 1) <= K / 2 ? 1 : -1);
      /* ---------- the cavern shell ---------- */
      const rockM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: true });
      { const nearSecret = (i) => { for (let k = -10; k <= 10; k++) if (W.secretSide[((i + k) % N + N) % N]) return true; return false; };
        const ids = []; for (let i = 0; i < N;) { ids.push(i); i += (secOf(i / N) === 0 || nearSecret(i)) ? RING : RING * 2; } ids.push(N);
        const pos = [], col = [], P1 = K + 3;
        const rings = ids.map((i) => { const j = i % N, p = tp(j), d = j * STEP, f = i / N, o = [];
          o.push({ v: rolled(p, wR(f), floorY(f, 1)), h: floorY(f, 1) });
          for (let k = 0; k <= K; k++) { const a = k / K * Math.PI, [l, h] = surfAt(d, a); o.push({ v: rolled(p, l, h), h }); }
          o.push({ v: rolled(p, -wL(f), floorY(f, -1)), h: floorY(f, -1) });
          return o; });
        // (v131) light is baked into every plate: faces that look down (the roof) go darker, faces near the ground get a
        // contact shadow, and the low rock picks up a bounce of the cavern's own colour. No extra geometry, much more depth.
        const pal = ids.map((i) => { const f = i / N; return { tone: [0, 1, 2, 3].map((k) => colAt(f, 'rock', k).clone()), fl: colAt(f, 'floor').clone(), bo: colAt(f, 'hemi').clone() }; });
        const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3(), _nv = new THREE.Vector3(), _to = new THREE.Vector3(), _cc = new THREE.Color();
        for (let r = 0; r < ids.length - 1; r++) {
          const sd = W.secretSide[ids[r] % N], pr = pal[r], pc = tp(ids[r] % N);
          for (let k = 0; k < P1 - 1; k++) {
            const A = rings[r][k], Bv = rings[r][k + 1], C = rings[r + 1][k], D = rings[r + 1][k + 1];
            if (sd && sideOf(k) === sd && sideOf(k + 1) === sd && Math.max(A.h, Bv.h) < 3.7) continue;   // the secret doorway stays open
            const s0 = slabIx(ids[r] % N * STEP, k);
            for (const [X, Y, Z, sq] of [[A, Bv, C, s0], [C, Bv, D, s0]]) {
              pos.push(...X.v, ...Y.v, ...Z.v);
              const hh = (X.h + Y.h + Z.h) / 3;
              _e1.set(Y.v[0] - X.v[0], Y.v[1] - X.v[1], Y.v[2] - X.v[2]);
              _e2.set(Z.v[0] - X.v[0], Z.v[1] - X.v[1], Z.v[2] - X.v[2]);
              _nv.crossVectors(_e1, _e2).normalize();
              _to.set(pc.x - X.v[0], pc.y + 1.2 - X.v[1], pc.z - X.v[2]);
              if (_nv.dot(_to) < 0) _nv.negate();                       // always the face as seen from the road
              const sh = (.6 + .34 * (_nv.y * .5 + .5)) * (.56 + .44 * smoothstep(-.6, 4.2, hh));
              _cc.copy(hh < 1.3 ? pr.fl : pr.tone[sq % 4]).lerp(pr.bo, Math.max(0, 1 - hh / 6.5) * .17).multiplyScalar(sh);
              for (let q = 0; q < 3; q++) col.push(_cc.r, _cc.g, _cc.b);
            }
          }
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
        const tube = new THREE.Mesh(g, rockM); tube.receiveShadow = true; scene.add(tube); W.tube = tube; }
      /* ---------- a band that follows the track between two lateral offsets that change along the lap ---------- */
      const band = (inner, outer, hgt, keep, step = 2) => {
        const pos = [], uv = []; let any = false;
        for (let i = 0; i < N; i += step) { const j2 = (i + step) % N, f0 = i / N, f1 = (i + step) / N, p0 = tp(i), p1 = tp(j2);
          if (!keep(f0) && !keep(f1)) continue;
          const a0 = inner(f0), b0 = outer(f0), a1 = inner(f1), b1 = outer(f1); if (Math.abs(b0 - a0) < .3 && Math.abs(b1 - a1) < .3) continue; any = true;
          const A = rolled(p0, a0, hgt(f0, a0)), Bv = rolled(p0, b0, hgt(f0, b0)), C = rolled(p1, a1, hgt(f1, a1)), D = rolled(p1, b1, hgt(f1, b1));
          pos.push(...A, ...Bv, ...C, ...Bv, ...D, ...C);
          const v0 = i * STEP / 7, v1 = (i + step) * STEP / 7; uv.push(0, v0, 1, v0, 0, v1, 1, v0, 1, v1, 0, v1);
        }
        if (!any) return null;
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
      };
      const glow = [];                                  // every light source, for the pool of point lights
      const addGlow = (x, y, z, c, i = 42, d = 22) => glow.push({ x, y, z, c, i, d });
      const flatM = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });
      const lit = (c) => new THREE.MeshBasicMaterial({ color: c });   // solid and always bright — never see-through
      // (v129) a dithered cut-out: the alpha is a Bayer pattern, so light fades out without ever being a blended
      // sheet — a see-through sheet draws as a solid slab on the user's phone, a cut-out does not.
      const BAY8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
                    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];
      const dither = (w, h, fn, r, g, b) => { const t = canvasTex(w, h, (x) => { const im = x.createImageData(w, h);
        for (let y = 0; y < h; y++) for (let px = 0; px < w; px++) { const v = fn(px / (w - 1), y / (h - 1));
          if (v > (BAY8[(px & 7) + (y & 7) * 8] + .5) / 64) { const o = (y * w + px) * 4; im.data[o] = r; im.data[o + 1] = g; im.data[o + 2] = b; im.data[o + 3] = 255; } }
        x.putImageData(im, 0, 0); });
        t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t; };
      // (v131) a soft gradient texture, used with plain alpha blending (NOT additive, and never a "glow" sprite): the
      // same kind of material the warning rings and item boxes already use, so it draws correctly everywhere.
      const soft = (w, h, fn, r, g, b) => { const t = canvasTex(w, h, (x) => { const im = x.createImageData(w, h);
          for (let y = 0; y < h; y++) for (let px = 0; px < w; px++) { const o = (y * w + px) * 4;
            im.data[o] = r; im.data[o + 1] = g; im.data[o + 2] = b; im.data[o + 3] = Math.round(clamp(fn(px / (w - 1), y / (h - 1)), 0, 1) * 255); }
          x.putImageData(im, 0, 0); });
        t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; return t; };
      // shafts of light down through holes in the roof, with a pool of light where they land
      const shafts = (fracs, rgb, hole) => {
        const beamT = soft(128, 256, (u, v) => (1 - v) ** 1.6 * .85 * Math.cos((u - .5) * Math.PI) ** 1.3, rgb[0], rgb[1], rgb[2]);
        const poolT = soft(128, 128, (u, v) => Math.max(0, 1 - Math.hypot(u - .5, v - .5) * 2) ** 1.7, rgb[0], rgb[1], rgb[2]);
        const beamM = new THREE.MeshBasicMaterial({ map: beamT, transparent: true, opacity: .62, depthWrite: false, side: THREE.DoubleSide, fog: false });
        const poolM = new THREE.MeshBasicMaterial({ map: poolT, transparent: true, opacity: .55, depthWrite: false, fog: false });
        const skyM = new THREE.MeshBasicMaterial({ color: hole, fog: false });
        for (const ff of fracs) { const i = Math.round(ff * N) % N, f = i / N; if (!noSec(i)) continue;
          const p = tp(i), top = hC(f) * .93, lat = rand(-2.4, 2.4), [bx, by, bz] = rolled(p, lat, top);
          const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 4.6, top, 14, 1, true), beamM); beam.position.set(bx, by - top / 2, bz); beam.renderOrder = 6; scene.add(beam);
          const hm = new THREE.Mesh(new THREE.CircleGeometry(2, 14).rotateX(Math.PI / 2), skyM); hm.position.set(bx, by - .06, bz); scene.add(hm);
          const [qx, qy, qz] = rolled(p, lat, .05);
          const lp = new THREE.Mesh(new THREE.CircleGeometry(4.8, 18).rotateX(-Math.PI / 2), poolM); lp.position.set(qx, qy, qz); lp.renderOrder = 5; scene.add(lp);
          addGlow(bx, by - top * .4, bz, hole, 62, 36); } };
      // a drifting field of tiny bright specks, for the air of one cavern
      const motes = (test, colour, count, size, lift) => {
        const pos = [], home = [];
        for (let k = 0; k < count * 8 && home.length < count * 3; k++) { const d = rand(0, L), f = d / L; if (!test(f)) continue;
          const i = Math.round(d / STEP) % N, p = tp(i), lat = rand(-1, 1) * Math.min(13, wL(f) - 1.5), [x, y, z] = rolled(p, lat, rand(.6, hC(f) * .8));
          home.push(x, y, z); pos.push(x, y, z); }
        if (!home.length) return;
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: colour, size, sizeAttenuation: true, fog: false })); pts.frustumCulled = false; scene.add(pts);
        const arr = g.attributes.position.array, ph = home.map(() => rand(0, 6.3));
        W.anim.push((dt, t) => { for (let k = 0; k < arr.length; k += 3) {
            arr[k] = home[k] + Math.sin(t * .35 + ph[k]) * 1.4;
            arr[k + 1] = home[k + 1] + Math.sin(t * .22 + ph[k + 1]) * lift;
            arr[k + 2] = home[k + 2] + Math.cos(t * .3 + ph[k + 2]) * 1.4; }
          g.attributes.position.needsUpdate = true; }); };
      // (v121) a rounded, lumpy block: a sphere pushed out towards a box so blocks still sit flush side by side and
      // make a solid wall, with a little noise and a different shade on every face — rounder and far more natural
      // than a plain box, and still cheap enough to line a whole cavern with.
      const blockBlob = (w, h, d, detail, k, noise, shades, seed = 1) => {
        const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position, v = new THREE.Vector3();
        const hs = (x, y, z) => { const t = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed) * 43758.5453; return t - Math.floor(t); };
        for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize();
          v.set(Math.sign(v.x) * Math.abs(v.x) ** k, Math.sign(v.y) * Math.abs(v.y) ** k, Math.sign(v.z) * Math.abs(v.z) ** k);
          const n = 1 + (hs(Math.round(v.x * 24), Math.round(v.y * 24), Math.round(v.z * 24)) - .5) * noise;
          p.setXYZ(i, v.x * n * w * .5, v.y * n * h * .5, v.z * n * d * .5); }
        const col = new Float32Array(p.count * 3), c = new THREE.Color();
        for (let f = 0; f < p.count; f += 3) { c.set(shades[((f / 3) | 0) % shades.length]); for (let q = 0; q < 3; q++) col.set([c.r, c.g, c.b], (f + q) * 3); }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
      };
      const noSec = (i) => !W.secretSide[((i % N) + N) % N];
      // the user's three stalagmite models (rebuilt low-poly at load): upright, and flipped to hang as stalactites
      const UP = BASE.stal, DOWN = BASE.stal && BASE.stal.map((g) => g.clone().rotateX(Math.PI));
      const putStal = (lists, geos, mats) => { if (!geos) return; for (let k = 0; k < 3; k++) if (lists[k].length) instanced(scene, geos[k], mats[k % mats.length], lists[k], false); };
      // the ground between the kerb and the rock: dirt in each cavern's own colour, stone across the bridge
      { const BW2 = IN + .6;
        for (const [c, which] of [['#6b4a32', 0], ['#6d6048', 1], ['#6a3f2a', 2]])
          for (const sd of [-1, 1]) { const g = band((f) => sd * (HALF + .85), (f) => sd * IN, () => .02, (f) => secOf(f) === which && brg(f) < .3, 2);
            if (g) { const m = new THREE.Mesh(g, flatM(c, { roughness: 1, side: THREE.DoubleSide })); m.receiveShadow = true; scene.add(m); } }
        for (const sd of [-1, 1]) { const g = band((f) => sd * (HALF + .85), (f) => sd * BW2, () => .02, (f) => brg(f) >= .3, 2);
          if (g) { const m = new THREE.Mesh(g, flatM('#9aa2ae', { roughness: .85, side: THREE.DoubleSide })); m.receiveShadow = true; scene.add(m); } } }
      /* ================= 1. THE CRYSTAL CAVERN ================= */
      // big angular crystals, in four colours, standing along the foot of the walls and set into the rock
      // (v115) the crystals are the user's faceted models: blue and purple, single and in threes
      const CRY_COL = ['#2fb4ff', '#b060ff', '#2fb4ff', '#b060ff'];
      const cryMat = [flatM('#1a8ad8', { emissive: '#0c63c0', emissiveIntensity: 1.5, roughness: .05, metalness: .3, envMapIntensity: 2.6 }),
                      flatM('#7a28c8', { emissive: '#5212a8', emissiveIntensity: 1.5, roughness: .05, metalness: .3, envMapIntensity: 2.6 })];
      const cryGeo = BASE.cry ? [BASE.cry.blueC, BASE.cry.purpleC, BASE.cry.blue, BASE.cry.purple] : null;
      const cryM = [cryMat[0], cryMat[1], cryMat[0], cryMat[1]];
      const cryPut = (lists) => { if (!cryGeo) return; for (let k = 0; k < 4; k++) if (lists[k].length) instanced(scene, cryGeo[k], cryM[k], lists[k], false); };
      { const lists = [[], [], [], []], stal = [], stalC = [];
        for (let i = 0; i < N; i += 3) { const f = i / N, s = secOf(f); if (s === 2 || !noSec(i)) continue;
          const p = tp(i), d = i * STEP, dens = s === 0 ? .44 : .12;
          for (const sd of [-1, 1]) { if (Math.random() > dens) continue; if (s === 1 && sd < 0) continue;   // the lake takes the left in the water cavern
            const base = sd > 0 ? Math.min(wR(f), IN + 1.2) : -Math.min(wL(f), IN + 1.2);
            const [x, y, z] = rolled(p, base + sd * rand(-.5, 1.4), rand(-.3, .2));
            lists[(i + (sd > 0 ? 0 : 2)) % 4].push({ x, y, z, s: (Math.random() < .62 ? rand(.22, .6) : rand(1, 2)) * (s === 0 ? 1 : .7), ry: rand(0, 6) });
            if (Math.random() < .15) addGlow(x, y + 1.6, z, CRY_COL[(i + (sd > 0 ? 0 : 2)) % 4], 30, 18);
          }
          // crystals growing out of the wall higher up, and crystal spikes on the ceiling
          if (i % 10 === 0) for (const sd of [-1, 1]) { if (s === 1 && sd < 0) continue; const a0 = rand(.5, 1.1), a = sd > 0 ? a0 : Math.PI - a0, [l, h] = surfAt(d, a), [x, y, z] = rolled(p, l - sd * .5, h);
            lists[(i + 1) % 4].push({ x, y, z, s: rand(.3, .8), ry: rand(0, 6) }); }
          if (i % 11 === 0) { const a = rand(1.2, 1.95), [l, h] = surfAt(d, a), [x, y, z] = rolled(p, l, h + .4);
            (Math.random() < .55 ? stalC : stal).push({ x, y, z, s: rand(.55, 1.1), ry: rand(0, 6) }); }
        }
        cryPut(lists);
        { const L3 = [[], [], []]; stal.forEach((d2, k) => L3[k % 3].push(d2));
          putStal(L3, DOWN, [flatM('#7a5ea8'), flatM('#8f72bd'), flatM('#6a4f98')]); }
        const cSpike = BASE.cry ? BASE.cry.purple.clone().scale(.875, .875, .875).rotateX(Math.PI) : null;
        if (stalC.length && cSpike) instanced(scene, cSpike, cryMat[1], stalC, false);
      }
      // the wooden supports: two posts with metal bands and rivets, a beam across the top, a lantern on a chain
      { const wood = flatM('#c2762c', { roughness: .85 }), iron = flatM('#55555f', { metalness: .55, roughness: .45 }), glass = lit('#ffd37a');
        const PH = 6.2, SX = IN - .35;
        const wG = new THREE.Group(), mG = new THREE.Group(), rv = [];
        for (const sx of [-1, 1]) { box(wG, .78, PH, .78, wood, sx * SX, PH / 2, 0);
          for (const y of [1.1, 3.2, 5.3]) { box(mG, .92, .42, .92, iron, sx * SX, y, 0); for (const rz of [-.48, .48]) for (const rx of [-.3, .3]) rv.push({ x: sx * SX + rx, y, z: rz }); }
          box(wG, .62, .62, .62, wood, sx * SX, PH + .3, 0); box(mG, 1.5, .5, .86, iron, sx * (SX - .5), PH - .1, 0); }
        box(wG, SX * 2 + .8, .8, .78, wood, 0, PH + .4, 0);
        for (const sx of [-1, 1]) box(mG, .5, .96, .9, iron, sx * (SX - .1), PH + .4, 0);
        const woodG = bakeOne(wG), metG = bakeOne(mG), rvG = new THREE.SphereGeometry(.09, 6, 5);
        // the lantern
        const lG = new THREE.Group();
        lG.add(new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.15, 4).translate(0, -.57, 0), iron));
        lG.add(new THREE.Mesh(new THREE.CylinderGeometry(.09, .34, .26, 8).translate(0, -1.26, 0), iron));
        lG.add(new THREE.Mesh(new THREE.CylinderGeometry(.36, .3, .12, 8).translate(0, -1.45, 0), iron));
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, b = new THREE.Mesh(new THREE.BoxGeometry(.07, .62, .07), iron); b.position.set(Math.cos(a) * .25, -1.82, Math.sin(a) * .25); lG.add(b); }
        lG.add(new THREE.Mesh(new THREE.CylinderGeometry(.32, .26, .14, 8).translate(0, -2.2, 0), iron));
        const lampG = bakeOne(lG), bulbG = new THREE.CylinderGeometry(.31, .26, .7, 8).translate(0, -1.82, 0);
        const posts = [], rivets = [], lamps = [];
        for (let d = 10; d < L - 10; d += 13) { const f = d / L; if (secOf(f) !== 0) continue; const i = Math.round(d / STEP) % N; if (!noSec(i) || BUSY.some((b) => Math.abs(b * L - d) < 8)) continue;
          const p = tp(i), ry = Math.atan2(-p.tx, -p.tz); posts.push({ x: p.x, y: p.y, z: p.z, s: 1, ry });
          for (const r of rv) { const [x, y, z] = rolled(p, r.x, r.y); rivets.push({ x: x + p.tx * r.z, y, z: z + p.tz * r.z, s: 1 }); }
          { const [x, y, z] = rolled(p, 0, PH + .4); lamps.push({ x, y, z, s: 1, ry }); addGlow(x, y - 1.8, z, '#ffbe6a', 62, 28); }
        }
        instanced(scene, woodG, wood, posts, false); instanced(scene, metG, iron, posts, false);
        instanced(scene, rvG, iron, rivets, false);
        instanced(scene, lampG, iron, lamps, false); instanced(scene, bulbG, glass, lamps, false);
      }
      /* ================= 2. THE WATER CAVERN ================= */
      const isWater = (f) => secOf(f) === 1;
      { // the lake: a turquoise surface that drifts, bright enough to light the cavern by itself
        const wTex = canvasTex(128, 128, (x) => { x.fillStyle = '#3ad6d4'; x.fillRect(0, 0, 128, 128);
          x.fillStyle = '#2bbdd2'; for (let k = 0; k < 4; k++) x.fillRect(0, k * 32, 128, 15);
          x.fillStyle = 'rgba(200,255,255,.4)'; for (let k = 0; k < 6; k++) x.fillRect(rand(0, 100), rand(0, 128), rand(22, 56), 3); }, [2, 6]);
        const wTex2 = wTex.clone(); wTex2.needsUpdate = true;
        const wMat = new THREE.MeshStandardMaterial({ map: wTex, emissive: '#1ec0c0', emissiveMap: wTex2, emissiveIntensity: .62, roughness: .18, metalness: .25, side: THREE.DoubleSide });
        W.anim.push((dt, t) => { wTex.offset.set(Math.sin(t * .07) * .05, -t * .016); wTex2.offset.set(Math.sin(t * .05 + 1) * .06, -t * .026); });
        const winner = (f) => (brg(f) > .3 ? 0 : IN);   // under the bridge the lake reaches across
        // the lake is FLAT: the bridge climbs over it, so the water keeps one level instead of riding up with the road
        const lakeY = tp(Math.round(.45 * N) % N).y;
        const flatH = (f) => lakeY - tp((((Math.round(f * N) % N) + N) % N)).y + FLO;
        const lake = (sd) => band((f) => sd * winner(f), (f) => sd * (sd > 0 ? wR(f) : wL(f)), flatH, (f) => isWater(f) && (sd < 0 || brg(f) > .3) && (sd > 0 ? openR(f) : openL(f)) > .4);
        for (const sd of [-1, 1]) { const g = lake(sd); if (g) { const m = new THREE.Mesh(g, wMat); m.renderOrder = -1; scene.add(m); } }
        // the bank: the drop from the road's shoulder down to the water
        const bankM = flatM('#848f96', { roughness: 1, side: THREE.DoubleSide });
        for (const sd of [-1, 1]) { const g = band((f) => sd * IN, (f) => sd * (IN + .5), (f, lat) => (Math.abs(lat) <= IN + .01 ? -.04 : FLO), (f) => isWater(f) && sd < 0 && brg(f) < .25 && openL(f) > .4);
          if (g) scene.add(new THREE.Mesh(g, bankM)); }
        { const foam = band((f) => -(IN + .5), (f) => -(IN + 1.2), (f) => flatH(f) + .02, (f) => isWater(f) && brg(f) < .25 && openL(f) > 1);
          if (foam) { const m = new THREE.Mesh(foam, new THREE.MeshBasicMaterial({ color: '#cdf6ff' })); m.renderOrder = 1; scene.add(m); } }
        for (let d = 0; d < L; d += 3.4) { const f = d / L; if (!isWater(f)) continue; const i = Math.round(d / STEP) % N, p = tp(i);
          for (const sd of [-1, 1]) if ((sd > 0 ? openR(f) : openL(f)) > 3) { const [x, y, z] = rolled(p, sd * (IN + rand(2, 6)), FLO + .1); if (Math.random() < .5) addGlow(x, y + 1.2, z, '#3ad8e0', 24, 20); }
        }
        // (v117, the user) the hedge is a plain block with a leaf texture on it, laid end to end so it makes a solid
        // wall you cannot see through — far cheaper than a bush built out of lumps
        const fw = flatM('#b9772f', { roughness: .85 }), fIron = flatM('#55555f', { metalness: .5, roughness: .5 });
        const bushG = blockBlob(1.95, 1.95, 2.2, 1, .62, .16, ['#3c9444', '#2f7d37', '#4aad53', '#57c062', '#276b2e', '#63cc6c', '#44a04c', '#357f3c'], 3).translate(0, .88, 0);
        const GREENS = ['#ffffff', '#e4f0e0', '#d8ecd4', '#f0fff0'];
        const fp = [], bush = [];
        for (let d = 0; d < L; d += 1.9) { const f = d / L; if (!isWater(f) || brg(f) > .25) continue; const i = Math.round(d / STEP) % N; if (!noSec(i)) continue;
          const p = tp(i), ry = Math.atan2(-p.tx, -p.tz), style = Math.floor(d / 46) % 2;
          for (const sd of [-1, 1]) { const op = sd > 0 ? openR(f) : openL(f);
            if (sd < 0 && op > 2.5) {
              if (style === 0) { const [x, y, z] = rolled(p, sd * (IN - .5), 0); fp.push({ x, y, z, s: 1, ry }); }
              else { const [x, y, z] = rolled(p, sd * (IN - .45), -.1); bush.push({ x, y, z, s: 1, ry, c: pick(GREENS) }); }
            } else if (style === 1) { const [x, y, z] = rolled(p, sd * (IN - .5), -.1); bush.push({ x, y, z, s: .9, ry, c: pick(GREENS) }); } } }
        if (fp.length) { const pG = new THREE.Group(); box(pG, .24, .95, .24, fw, 0, .48, 0); box(pG, .32, .14, .32, fIron, 0, .88, 0);
          box(pG, .18, .18, 2.6, fw, 0, .74, 0); box(pG, .18, .18, 2.6, fw, 0, .4, 0);
          instanced(scene, bakeOne(pG), fw, fp, false); }
        bush.length && instanced(scene, bushG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: true }), bush, false);
        shafts([.295, .355, .425, .50, .585, .645], [255, 246, 214], '#fff6d8');   // daylight through the roof
        // (v124, the user's lush-cave picture) the water cavern is overgrown: light green vines swinging from the roof,
        // leaf canopies, flowers and grass on the banks, moss on the low rock, and little pools along the right ledge.
        // Every leaf is a cut-out (alphaTest), never a blended see-through sheet, so phones draw it correctly.
        const GRN = ['#7cc63a', '#8fd94a', '#6bb52f', '#a3e85e', '#93e054'];
        const vineT = canvasTex(64, 128, (x) => {
          x.strokeStyle = '#5f9c2a'; x.lineWidth = 4; x.beginPath(); x.moveTo(32, 0); for (let y = 0; y <= 128; y += 16) x.lineTo(32 + Math.sin(y * .09) * 5, y); x.stroke();
          for (let y = 4; y < 128; y += 7) { const sx = 32 + Math.sin(y * .09) * 5, w = 7 + Math.sin(y * .4) * 3, sd = y % 14 < 7 ? 1 : -1;
            x.fillStyle = GRN[(y / 7 | 0) % GRN.length]; x.beginPath(); x.ellipse(sx + sd * w * .7, y, w * .8, 3.6, sd * .35, 0, 7); x.fill(); }
        });
        const flowerT = canvasTex(64, 64, (x) => {
          for (let k = 0; k < 7; k++) { const bx = 6 + k * 8, bh = 26 + (k % 3) * 12;
            x.strokeStyle = '#5f9c2a'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(bx, 64); x.lineTo(bx + (k % 2 ? 2 : -2), 64 - bh); x.stroke();
            x.fillStyle = GRN[k % GRN.length]; x.beginPath(); x.ellipse(bx - 3, 64 - bh * .45, 4, 2.2, .5, 0, 7); x.fill(); }
          for (const [fx, fy, c] of [[14, 22, '#ff5a8a'], [34, 14, '#ffd84a'], [52, 26, '#ff8ad0'], [24, 34, '#ffffff']]) {
            for (let p = 0; p < 5; p++) { const a = p / 5 * 6.283; x.fillStyle = c; x.beginPath(); x.ellipse(fx + Math.cos(a) * 3.4, fy + Math.sin(a) * 3.4, 2.6, 2.6, 0, 0, 7); x.fill(); }
            x.fillStyle = '#ffe9a0'; x.beginPath(); x.arc(fx, fy, 2, 0, 7); x.fill(); }
        });
        const cutMat = (t) => new THREE.MeshStandardMaterial({ map: t, alphaTest: .5, side: THREE.DoubleSide, roughness: .9 });
        const crossG = (w, h) => { const g = new THREE.Group(); for (const ry of [0, Math.PI / 2]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, -h / 2, 0), M('#ffffff')); m.rotation.y = ry; g.add(m); } return bakeOne(g); };
        // a mossy ledge along the right of the water cavern, with the little pools on it
        { const ledge = band((f) => IN, (f) => wR(f), () => -.06, (f) => isWater(f) && brg(f) < .3 && openR(f) > .4);
          if (ledge) scene.add(new THREE.Mesh(ledge, flatM('#6f8f4a', { roughness: 1, side: THREE.DoubleSide }))); }
        // vines hanging from the roof, swinging gently
        { const vines = [], anchors = [];
          for (let d = 1; d < L; d += 1.8) { const f = d / L; if (!isWater(f)) continue; const i = Math.round(d / STEP) % N; if (!noSec(i)) continue; const p = tp(i);
            for (let q = 0; q < 3; q++) { const a = rand(.6, 2.55), [l, h] = surfAt(d, a); if (Math.random() < .38) continue;
              const [x, y, z] = rolled(p, l * .96, h * .97); vines.push({ x, y, z, len: rand(2.4, 7), ph: rand(0, 6.3), s: rand(.8, 1.5) }); anchors.push([x, y, z]); } }
          if (vines.length) {
            const vg = crossG(1, 1), vmesh = new THREE.InstancedMesh(vg, cutMat(vineT), vines.length); vmesh.frustumCulled = false; scene.add(vmesh);
            const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3();
            W.anim.push((dt, t) => { for (let k = 0; k < vines.length; k++) { const v = vines[k];
              E.set(Math.sin(t * .7 + v.ph) * .09, v.ph, Math.cos(t * .55 + v.ph * 1.7) * .09); Q.setFromEuler(E);
              P3.set(v.x, v.y, v.z); S3.set(v.s * .9, v.len, v.s * .9); M4.compose(P3, Q, S3); vmesh.setMatrixAt(k, M4); }
              vmesh.instanceMatrix.needsUpdate = true; });
            // leafy canopies where the vines grow out of the roof
            const caps = anchors.filter((_, k) => k % 3 === 0).map(([x, y, z]) => ({ x, y: y - .25, z, s: rand(.5, 1), ry: rand(0, 6) }));
            caps.length && instanced(scene, blockBlob(2.2, 1, 2.2, 1, .6, .2, GRN, 23), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: true }), caps, false);
          } }
        // flowers and grass on both banks, moss cushions, and little pools on the right ledge
        { const flora = [], moss = [], pools = [];
          for (let d = 0; d < L; d += 1.6) { const f = d / L; if (!isWater(f)) continue; const i = Math.round(d / STEP) % N; if (!noSec(i)) continue; const p = tp(i);
            for (const sd of [-1, 1]) { const op = sd > 0 ? openR(f) : openL(f);
              if (Math.random() < .55) { const lat = sd * (IN + (op > 1.5 ? rand(.3, Math.min(op - .4, 3.4)) : rand(-1.1, -.2))), [x, y, z] = rolled(p, lat, -.04);
                flora.push({ x, y, z, s: rand(.55, 1.15), ry: rand(0, 6) }); }
              if (op > 1.5 && Math.random() < .3) { const [x, y, z] = rolled(p, sd * (IN + rand(.5, Math.min(op - .4, 3.2))), -.12);
                moss.push({ x, y, z, s: rand(.5, 1.1), ry: rand(0, 6) }); } }
            if (openR(f) > 2.6 && brg(f) < .3 && d % 17 < 1.6) { const [x, y, z] = rolled(p, IN + openR(f) * .55, -.16); pools.push({ x, y, z, s: rand(.8, 1.5), ry: rand(0, 6) }); }
          }
          flora.length && instanced(scene, crossG(1.5, 1.2).translate(0, 1.2, 0), cutMat(flowerT), flora, false);
          moss.length && instanced(scene, blockBlob(1.9, .5, 1.9, 1, .55, .22, ['#5f9c2a', '#6bb52f', '#548c24', '#7cc63a'], 31), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), moss, false);
          if (pools.length) { const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, .3, 9), flatM('#7d8f5e', { roughness: 1 })); ring.position.y = -.1;
            const pg = new THREE.Group(); pg.add(ring); instanced(scene, bakeOne(pg), flatM('#7d8f5e', { roughness: 1 }), pools, false);
            instanced(scene, new THREE.CircleGeometry(1.25, 9).rotateX(-Math.PI / 2).translate(0, .07, 0), wMat, pools, false); }
        }
        const spires = [[], [], []], shore = [[], [], [], []];
        for (let d = 0; d < L; d += 5) { const f = d / L; if (!isWater(f)) continue; const i = Math.round(d / STEP) % N, p = tp(i);
          for (const sd of [-1, 1]) { const op = sd > 0 ? openR(f) : openL(f); if (op < 6) continue;
            if (Math.random() < .5) { const [x, y, z] = rolled(p, sd * (IN + rand(5, op - 1.5)), FLO - .35); spires[(d | 0) % 3].push({ x, y, z, s: rand(.5, 1.3), ry: rand(0, 6) }); }
            if (Math.random() < .6) { const [x, y, z] = rolled(p, sd * (IN + op - rand(.5, 2.5)), FLO + .2), k = (d | 0) % 4; shore[k].push({ x, y, z, s: rand(.7, 1.6), ry: rand(0, 6) }); if (Math.random() < .25) addGlow(x, y + 1.8, z, CRY_COL[k], 30, 22); } } }
        putStal(spires, UP, [flatM('#e8d2a0', { emissive: '#8a6a22', emissiveIntensity: .22 }), flatM('#d2b483', { emissive: '#7a5a18', emissiveIntensity: .2 }), flatM('#f2e4c2', { emissive: '#8a7430', emissiveIntensity: .2 })]);
        cryPut(shore);
      }
      { // the stone arch bridge the road crosses, with arches and piers standing in the lake
        const stone = flatM('#9aa2ae', { roughness: .85 }), stoneD = flatM('#7c8591', { roughness: .9 });
        const BW2 = IN + .6, deck = band((f) => -BW2, (f) => BW2, () => -.62, (f) => brg(f) > .45);
        if (deck) scene.add(new THREE.Mesh(deck, stoneD));
        for (const sd of [-1, 1]) { const g2 = band((f) => sd * BW2, (f) => sd * (BW2 - .09), (f, lat) => (Math.abs(lat) > BW2 - .05 ? .22 : -.62), (f) => brg(f) > .45);
          if (g2) scene.add(new THREE.Mesh(g2, stone)); }
        const d0 = BRG0 * L, d1 = BRG1 * L, par = [], arches = [], piers = [];
        for (let d = d0; d <= d1; d += 1.5) { const i = Math.round(d / STEP) % N, p = tp(i), ry = Math.atan2(-p.tx, -p.tz);
          for (const sd of [-1, 1]) { const [x, y, z] = rolled(p, sd * (IN - .35), 0); par.push({ x, y, z, s: 1, ry }); } }
        // (v117) the bridge wall is the same idea: one textured stone block, laid end to end
        const rockWallG = blockBlob(.86, 1.2, 1.72, 2, .55, .2, ['#9aa2ae', '#8b94a1', '#a6aeb9', '#7f8894', '#b0b8c2', '#929ba7'], 7).translate(0, .58, 0);
        par.length && instanced(scene, rockWallG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, flatShading: true }), par, false);
        const AR = 4.4, archG = new THREE.TorusGeometry(AR, .62, 8, 18, Math.PI);
        for (let k = 0; k < 4; k++) { const d = d0 + (d1 - d0) * (k + .5) / 4, i = Math.round(d / STEP) % N, p = tp(i);
          for (const sd of [-1, 1]) { const [ax, ay, az] = rolled(p, sd * (IN + .62), -.62 - AR); const m = new THREE.Mesh(archG, stone); m.position.set(ax, ay, az); m.rotation.y = Math.atan2(-p.tz, p.tx); scene.add(m); }
          if (k) { const dd = d0 + (d1 - d0) * k / 4, j = Math.round(dd / STEP) % N, q = tp(j), ry = Math.atan2(-q.tx, -q.tz);
            piers.push({ x: q.x, y: q.y - .62, z: q.z, s: 1, ry }); } }
        const pierG = (() => { const g = new THREE.Group(); box(g, IN * 2 + 1.4, 6, 1.7, stoneD, 0, -3, 0); box(g, IN * 2 + 2, .5, 2.3, stone, 0, -.35, 0); return bakeOne(g); })();
        piers.length && instanced(scene, pierG, stoneD, piers, false);
      }
      { // the waterfall pouring down the far wall into the lake, and the stalactites that drip
        const fTex = canvasTex(128, 256, (x) => { x.fillStyle = '#5fd8e8'; x.fillRect(0, 0, 128, 256);
          for (let k = 0; k < 80; k++) { x.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.75)' : 'rgba(150,240,255,.6)'; x.fillRect(rand(0, 128), rand(0, 256), rand(2, 7), rand(20, 90)); }
          for (let k = 0; k < 40; k++) { x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(rand(0, 128), rand(0, 256), 2, rand(6, 20)); } }, [1, 2]);
        const fMat = new THREE.MeshBasicMaterial({ map: fTex, side: THREE.DoubleSide });
        W.anim.push((dt, t) => { fTex.offset.y = -t * .9; });
        for (const ff of [.30, .385, .47, .605, .655]) { const i = Math.round(ff * N) % N, p = tp(i), f = i / N; if (!isWater(f) || openL(f) < 6) continue;
          const top = hC(f) * .82, w = 5.5, m = new THREE.Mesh(new THREE.PlaneGeometry(w, top - FLO), fMat);
          const LX = -Math.min(wL(f) - 1.4, IN + 8);
          const [x, y, z] = rolled(p, LX, (top + FLO) / 2); m.position.set(x, y, z); m.rotation.y = Math.atan2(p.nx, p.nz); scene.add(m);
          const [sx, sy, sz] = rolled(p, LX, FLO + .05);
          const sp = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 2.4, .3, 18), lit('#cdf6ff')); sp.position.set(sx, sy, sz); scene.add(sp);
          addGlow(sx, sy + 2.5, sz, '#8ff0ff', 40, 26);
        }
        const dripFrom = [], stal = [], gold = [];
        for (let i = 0; i < N; i += 8) { const f = i / N; if (!isWater(f)) continue; const p = tp(i), d = i * STEP;
          const a = rand(1.05, 2.1), [l, h] = surfAt(d, a), [x, y, z] = rolled(p, l, h + .5);
          (Math.random() < .3 ? gold : stal).push({ x, y, z, s: rand(.7, 1.7), ry: rand(0, 6) });
          if (Math.random() < .2) dripFrom.push({ x, y: y - 2.4, z, g: p.y + FLO });
        }
        { const L3 = [[], [], []], G3 = [[], [], []]; stal.forEach((d2, k) => L3[k % 3].push(d2)); gold.forEach((d2, k) => G3[k % 3].push(d2));
          putStal(L3, DOWN, [flatM('#9ba7af'), flatM('#acb7bd'), flatM('#8a959d')]);
          putStal(G3, DOWN, [flatM('#e8d2a0'), flatM('#d8b981'), flatM('#f0e0bc')]); }
        if (dripFrom.length) { const DN = 20, dm = new THREE.InstancedMesh(new THREE.SphereGeometry(.14, 6, 5), lit('#bff2ff'), DN); dm.frustumCulled = false; scene.add(dm);
          const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S3 = new THREE.Vector3(), P3 = new THREE.Vector3();
          const drops = Array.from({ length: DN }, () => ({ t: rand(0, 3), src: pick(dripFrom), y: 0, v: 0 }));
          for (let k = 0; k < DN; k++) dm.setMatrixAt(k, M4.makeScale(0, 0, 0));
          W.anim.push((dt) => { let dirty = false;
            for (let k = 0; k < DN; k++) { const o = drops[k];
              if (o.t > 0) { o.t -= dt; if (o.t <= 0) { o.src = pick(dripFrom); o.y = o.src.y; o.v = 0; } M4.makeScale(0, 0, 0); }
              else { o.v -= 26 * dt; o.y += o.v * dt; if (o.y <= o.src.g) { o.t = rand(.6, 4); M4.makeScale(0, 0, 0); } else { P3.set(o.src.x, o.y, o.src.z); S3.set(1, 1 + Math.min(1.4, -o.v * .05), 1); M4.compose(P3, Q, S3); } }
              dm.setMatrixAt(k, M4); dirty = true; }
            if (dirty) dm.instanceMatrix.needsUpdate = true; });
        }
      }
      /* ================= 3. THE LAVA CAVERN ================= */
      const isLava = (f) => secOf(f) === 2;
      { const lTex = canvasTex(128, 128, (x) => { x.fillStyle = '#f85c0a'; x.fillRect(0, 0, 128, 128);
          x.fillStyle = '#5c1803'; for (let k = 0; k < 10; k++) { x.beginPath(); x.ellipse(rand(0, 128), rand(0, 128), rand(14, 34), rand(9, 22), rand(0, 3), 0, 7); x.fill(); }
          x.strokeStyle = '#ffd24a'; x.lineWidth = 4; x.lineCap = 'round'; for (let k = 0; k < 8; k++) { x.beginPath(); let px = rand(0, 128), py = rand(0, 128); x.moveTo(px, py); for (let q = 0; q < 3; q++) { px += rand(-30, 30); py += rand(-30, 30); x.lineTo(px, py); } x.stroke(); } }, [2, 5]);
        const lMat = new THREE.MeshBasicMaterial({ map: lTex, side: THREE.DoubleSide });
        W.anim.push((dt, t) => { lTex.offset.set(Math.sin(t * .05) * .03, -t * .01); });
        for (const sd of [-1, 1]) { const g = band((f) => sd * IN, (f) => sd * (sd > 0 ? wR(f) : wL(f)), () => FLO, (f) => isLava(f) && (sd > 0 ? openR(f) : openL(f)) > .4);
          if (g) { const m = new THREE.Mesh(g, lMat); m.renderOrder = -1; scene.add(m); } }
        const basalt = flatM('#3a2745', { roughness: .95, side: THREE.DoubleSide });
        for (const sd of [-1, 1]) { const g = band((f) => sd * IN, (f) => sd * (IN + 1.1), (f, lat) => (Math.abs(lat) <= IN + .01 ? -.04 : FLO), (f) => isLava(f) && (sd > 0 ? openR(f) : openL(f)) > .4);
          if (g) scene.add(new THREE.Mesh(g, basalt)); }
        // the stone block wall between the road and the lava (as in the picture), with brass studs
        const blockM = flatM('#4c3a57', { roughness: .9 }), studM = flatM('#d8a13a', { metalness: .6, roughness: .4 });
        const blocks = [], studs = [];
        for (let d = 0; d < L; d += 3.2) { const f = d / L; if (!isLava(f)) continue; const i = Math.round(d / STEP) % N; if (!noSec(i)) continue; const p = tp(i), ry = Math.atan2(-p.tx, -p.tz);
          for (const sd of [-1, 1]) { if ((sd > 0 ? openR(f) : openL(f)) < 2.5) continue; const [x, y, z] = rolled(p, sd * (IN - .6), 0); blocks.push({ x, y, z, s: 1, ry });
            const [bx, by, bz] = rolled(p, sd * (IN - .6 - .5), .66); studs.push({ x: bx, y: by, z: bz, s: 1 }); } }
        if (blocks.length) { const bG = blockBlob(1.3, .95, 2.5, 1, .55, .22, ['#4c3a57', '#574363', '#42314d', '#605070', '#4a3855'], 11).translate(0, .42, 0);
          instanced(scene, bG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, flatShading: true }), blocks, false); instanced(scene, new THREE.SphereGeometry(.14, 7, 6), studM, studs, false); }
        // basalt columns standing in the lava, and the lava fall down the far wall
        const colG = (() => { const g = new THREE.Group(); for (const [x, z, h, r] of [[0, 0, 6, 1.15], [1.7, .5, 4.2, .85], [-1.5, .9, 5, .95], [.6, -1.6, 3.2, .7]]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 6), M('#ffffff')); c.position.set(x, h / 2, z); g.add(c); } return bakeOne(g); })();
        const cols = [];
        for (let d = 0; d < L; d += 9) { const f = d / L; if (!isLava(f)) continue; const i = Math.round(d / STEP) % N, p = tp(i);
          for (const sd of [-1, 1]) { const op = sd > 0 ? openR(f) : openL(f); if (op < 10 || Math.random() < .5) continue;
            const [x, y, z] = rolled(p, sd * (IN + rand(8, op - 1.5)), FLO - .5); cols.push({ x, y, z, s: rand(.5, .95), ry: rand(0, 6) });
            if (Math.random() < .45) addGlow(x, y + 1.5, z, '#ff8a28', 34, 26); } }
        cols.length && instanced(scene, colG, basalt, cols, false);
        const fTex = canvasTex(128, 256, (x) => { x.fillStyle = '#ff8a1e'; x.fillRect(0, 0, 128, 256);
          for (let k = 0; k < 70; k++) { x.fillStyle = Math.random() < .5 ? 'rgba(255,230,120,.85)' : 'rgba(220,70,20,.6)'; x.fillRect(rand(0, 128), rand(0, 256), rand(3, 10), rand(24, 110)); } }, [1, 2]);
        const fMat = new THREE.MeshBasicMaterial({ map: fTex, side: THREE.DoubleSide });
        W.anim.push((dt, t) => { fTex.offset.y = -t * .55; });
        for (const ff of [.775, .93]) { const i = Math.round(ff * N) % N, p = tp(i), f = i / N; if (!isLava(f) || openL(f) < 6) continue;
          const top = hC(f) * .8, m = new THREE.Mesh(new THREE.PlaneGeometry(6.5, top - FLO), fMat);
          const LX = -Math.min(wL(f) - 1.6, IN + 7);
          const [x, y, z] = rolled(p, LX, (top + FLO) / 2); m.position.set(x, y, z); m.rotation.y = Math.atan2(p.nx, p.nz); scene.add(m);
          const [sx, sy, sz] = rolled(p, LX, FLO);
          const sp = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 2.8, .34, 18), lit('#ffd27a')); sp.position.set(sx, sy, sz); scene.add(sp);
          addGlow(sx, sy + 3, sz, '#ff9a3a', 52, 30); }
        // embers drifting up out of the lava
        { const EN = 26, em = new THREE.InstancedMesh(new THREE.SphereGeometry(.17, 5, 4), lit('#ffc258'), EN); em.frustumCulled = false; scene.add(em);
          const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S3 = new THREE.Vector3(), P3 = new THREE.Vector3(), spots = [];
          for (let d = 0; d < L; d += 9) { const f = d / L; if (!isLava(f)) continue; const i = Math.round(d / STEP) % N, p = tp(i);
            for (const sd of [-1, 1]) { const op = sd > 0 ? openR(f) : openL(f); if (op > 5) { const [x, y, z] = rolled(p, sd * (IN + rand(2, op - 1)), FLO); spots.push({ x, y, z }); } } }
          if (spots.length) { const es = Array.from({ length: EN }, () => ({ s: pick(spots), y: rand(0, 9), v: rand(1.4, 3), w: rand(0, 6) }));
            W.anim.push((dt, t) => { for (let k = 0; k < EN; k++) { const o = es[k]; o.y += o.v * dt; if (o.y > 11) { o.s = pick(spots); o.y = 0; o.v = rand(1.4, 3); }
              P3.set(o.s.x + Math.sin(t * 1.3 + o.w) * .7, o.s.y + o.y, o.s.z + Math.cos(t * 1.1 + o.w) * .7); const sc = Math.max(.15, 1 - o.y / 11); S3.set(sc, sc, sc); M4.compose(P3, Q, S3); em.setMatrixAt(k, M4); }
              em.instanceMatrix.needsUpdate = true; }); }
          else em.visible = false; }
      }
      /* ---------- the user's stalagmites standing on the cavern floors, in each cavern's own colours ---------- */
      if (UP) { const byS = [[[], [], []], [[], [], []], [[], [], []]];
        for (let d = 3; d < L; d += 11) { const f = d / L, sc = secOf(f), i = Math.round(d / STEP) % N; if (!noSec(i)) continue; const p = tp(i);
          for (const sd of [-1, 1]) { if (Math.random() < .55) continue;
            const op = sd > 0 ? openR(f) : openL(f), open = op > 4;
            const [x, y, z] = rolled(p, sd * (open ? IN + rand(1.4, Math.min(op - 1, 9)) : IN - .15), open ? FLO - .25 : -.06);
            byS[sc][(d | 0) % 3].push({ x, y, z, s: open ? rand(.5, 1.15) : rand(.3, .6), ry: rand(0, 6) }); } }
        const SMAT = [[flatM('#8f6fc4'), flatM('#a98ad6'), flatM('#7a5ca8')],
                      [flatM('#e8d2a0'), flatM('#9fcede'), flatM('#cdb487')],
                      [flatM('#9a6048'), flatM('#b07050'), flatM('#7c4c3a')]];
        for (let sc = 0; sc < 3; sc++) putStal(byS[sc], UP, SMAT[sc]); }
      /* ================= the fantasy pass: every cavern gets its own magic ================= */
      // CRYSTAL — a glowing grotto: light shafts, bioluminescent mushrooms, crystal spires and veins in the floor
      shafts([.035, .095, .155, .215], [222, 190, 255], '#e6d2ff');
      motes((f) => secOf(f) === 0, '#d8b8ff', 260, .16, .9);
      { const stem = flatM('#c5b2e2', { roughness: .8 }), caps = [['#2ec4e8', '#0d74a8'], ['#e04aa8', '#8a1268'], ['#8a56e0', '#4a12a0'], ['#3cc470', '#0e7034']];
        const capG = new THREE.SphereGeometry(.5, 9, 6, 0, Math.PI * 2, 0, Math.PI * .55).scale(1, .74, 1);
        const stemG = new THREE.CylinderGeometry(.13, .19, .62, 7).translate(0, .31, 0);
        const sl = [], cl = [[], [], [], []];
        for (let d = 2; d < L; d += 3.4) { const f = d / L; if (secOf(f) !== 0) continue; const i = Math.round(d / STEP) % N; if (!noSec(i)) continue; const p = tp(i);
          for (const sd of [-1, 1]) { if (Math.random() < .45) continue; const n2 = 1 + (Math.random() < .5 ? 1 : 0);
            for (let q = 0; q < n2; q++) { const s2 = rand(.5, 1.5), [x, y, z] = rolled(p, sd * (IN - rand(.1, 1.4)), -.05);
              sl.push({ x: x + rand(-.4, .4), y, z: z + rand(-.4, .4), s: s2, ry: rand(0, 6) });
              const kk = (d + q) % 4 | 0; cl[kk].push({ x: sl[sl.length - 1].x, y: y + .6 * s2, z: sl[sl.length - 1].z, s: s2, ry: rand(0, 6) }); } } }
        sl.length && instanced(scene, stemG, stem, sl, false);
        caps.forEach(([c, e], k) => cl[k].length && (instanced(scene, capG, flatM(c, { emissive: e, emissiveIntensity: 1.45, roughness: .3 }), cl[k], false),
          cl[k].filter((_, j) => j % 7 === 0).forEach((o) => addGlow(o.x, o.y + .4, o.z, c, 20, 13)))); }
      { // tall crystal spires in groups, and glowing veins running along the floor at the foot of the walls
        const spireG = (() => { const g = new THREE.Group();
          for (const [x, z, h, r] of [[0, 0, 5.4, .52], [.9, .35, 3.2, .34], [-.8, .5, 4, .4], [.3, -.85, 2.3, .28]]) {
            const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), M('#ffffff')); c.position.set(x, h / 2, z); c.rotation.set(x * .07, rand(0, 6), -x * .07); g.add(c); }
          return bakeOne(g); })();
        const sp = [[], []], vein = [];
        for (let d = 4; d < L; d += 9) { const f = d / L; if (secOf(f) !== 0) continue; const i = Math.round(d / STEP) % N; if (!noSec(i)) continue; const p = tp(i);
          for (const sd of [-1, 1]) { if (Math.random() < .45) continue; const [x, y, z] = rolled(p, sd * (IN - rand(.2, 1)), -.1); sp[(d | 0) % 2].push({ x, y, z, s: rand(.5, 1.1), ry: rand(0, 6) }); } }
        sp[0].length && instanced(scene, spireG, flatM('#1a8ad8', { emissive: '#0c63c0', emissiveIntensity: 1.3, roughness: .06, metalness: .3, envMapIntensity: 2.4 }), sp[0], false);
        sp[1].length && instanced(scene, spireG, flatM('#7a28c8', { emissive: '#5212a8', emissiveIntensity: 1.3, roughness: .06, metalness: .3, envMapIntensity: 2.4 }), sp[1], false);
        for (let d = 0; d < L; d += 1.5) { const f = d / L; if (secOf(f) !== 0) continue; const i = Math.round(d / STEP) % N; if (!noSec(i)) continue; const p = tp(i), ry = Math.atan2(-p.tx, -p.tz);
          for (const sd of [-1, 1]) { const [x, y, z] = rolled(p, sd * (IN - .22), -.02); vein.push({ x, y, z, s: 1, ry }); } }
        vein.length && instanced(scene, new THREE.BoxGeometry(.3, .05, 1.5), new THREE.MeshBasicMaterial({ color: '#7fd4ff' }), vein, false); }
      { // (v135) hanging crystal clusters in the roof of the crystal cavern
        if (BASE.cry) { const dn = [BASE.cry.blueC.clone().rotateX(Math.PI), BASE.cry.purpleC.clone().rotateX(Math.PI)];
          const hm = [flatM('#1a8ad8', { emissive: '#0c63c0', emissiveIntensity: 1.4, roughness: .06, metalness: .3, envMapIntensity: 2.4 }),
                      flatM('#7a28c8', { emissive: '#5212a8', emissiveIntensity: 1.4, roughness: .06, metalness: .3, envMapIntensity: 2.4 })];
          const hl = [[], []];
          for (let i = 0; i < N; i += 11) { const f = i / N; if (secOf(f) !== 0 || !noSec(i)) continue; const p = tp(i), d = i * STEP;
            const a = rand(1.1, 2.04), [l, h] = surfAt(d, a), [x, y, z] = rolled(p, l, h + .18);
            hl[(i / 11 | 0) % 2].push({ x, y, z, s: rand(.4, .85), ry: rand(0, 6) });
            if ((i / 11 | 0) % 6 === 0) addGlow(x, y - 1.2, z, (i / 11 | 0) % 2 ? '#a855ff' : '#2ab8ff', 22, 15); }
          for (let q = 0; q < 2; q++) hl[q].length && instanced(scene, dn[q], hm[q], hl[q], false); } }
      // WATER — a paradise: fireflies, lily pads with flowers, and arches of vines over the road
      motes(isWater, '#eaffa8', 220, .2, 1.4);
      { const padG = new THREE.CircleGeometry(.95, 9).rotateX(-Math.PI / 2);
        const padM = flatM('#4faa4a', { roughness: .9, side: THREE.DoubleSide }), budM = flatM('#ffd2ea', { emissive: '#d8508f', emissiveIntensity: .35, roughness: .6 });
        const pads = [], buds = [];
        for (let d = 0; d < L; d += 3.1) { const f = d / L; if (!isWater(f) || openL(f) < 5) continue; const i = Math.round(d / STEP) % N, p = tp(i);
          for (let q = 0; q < 3; q++) { if (Math.random() < .35) continue; const [x, y, z] = rolled(p, -(IN + rand(1.5, Math.min(openL(f) - 1, 16))), -.06);
            pads.push({ x, y, z, s: rand(.6, 1.5), ry: rand(0, 6) }); if (Math.random() < .3) buds.push({ x, y: y + .18, z, s: rand(.5, .9), ry: rand(0, 6) }); } }
        pads.length && instanced(scene, padG, padM, pads, false);
        buds.length && instanced(scene, new THREE.SphereGeometry(.22, 7, 5), budM, buds, false); }
      { // arches of leaves over the road, built at full size so the instances only turn, never stretch
        const archG = (() => { const g = new THREE.Group(), steps = 16, R = IN + .5, H = 7.2;
          for (let k = 0; k <= steps; k++) { const a2 = k / steps * Math.PI;
            const m = new THREE.Mesh(new THREE.SphereGeometry(rand(.5, .95), 7, 5), M('#ffffff'));
            m.position.set(Math.cos(a2) * R, Math.sin(a2) * H, rand(-.35, .35)); g.add(m); }
          return bakeOne(g); })();
        const arches = [];
        for (const ff of [.315, .40, .49, .62]) { const i = Math.round(ff * N) % N, f = i / N; if (!isWater(f) || !noSec(i) || brg(f) > .2) continue;
          const p = tp(i); arches.push({ x: p.x, y: p.y, z: p.z, s: 1, ry: Math.atan2(-p.tx, -p.tz) }); }
        arches.length && instanced(scene, archG, flatM('#49ad52', { roughness: .95 }), arches, false); }
      // LAVA — an ember realm: fiery shafts, cracks glowing in the ground, and geysers of flame
      shafts([.745, .825, .905], [255, 190, 110], '#ffd09a');
      motes(isLava, '#ffb259', 240, .19, 1.8);
      { const crack = [];
        for (let d = 0; d < L; d += 2.2) { const f = d / L; if (!isLava(f)) continue; const i = Math.round(d / STEP) % N; if (!noSec(i)) continue; const p = tp(i), ry = Math.atan2(-p.tx, -p.tz);
          for (const sd of [-1, 1]) { if (Math.random() < .35) continue; const [x, y, z] = rolled(p, sd * (HALF + rand(1.1, 2)), .04); crack.push({ x, y, z, s: rand(.7, 1.5), ry: ry + rand(-.4, .4) }); } }
        crack.length && instanced(scene, new THREE.BoxGeometry(.22, .04, 2.1), new THREE.MeshBasicMaterial({ color: '#ff8a1e' }), crack, false); }
      { const flameT = soft(96, 192, (u, v) => (1 - v) ** 1.15 * Math.cos((u - .5) * Math.PI) ** 1.2, 255, 170, 60);
        const flameM = new THREE.MeshBasicMaterial({ map: flameT, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide, fog: false });
        const gey = [];
        for (let d = 6; d < L; d += 23) { const f = d / L; if (!isLava(f)) continue; const i = Math.round(d / STEP) % N; if (!noSec(i)) continue; const p = tp(i);
          const sd = Math.random() < .5 ? -1 : 1, op = sd > 0 ? openR(f) : openL(f); if (op < 4) continue;
          const [x, y, z] = rolled(p, sd * (IN + rand(1.5, Math.min(op - 1, 8))), FLO);
          const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 6), flameM); m.position.set(x, y + 3, z); scene.add(m);
          const m2 = m.clone(); m2.rotation.y = Math.PI / 2; scene.add(m2);
          gey.push({ m, m2, y0: y, ph: rand(0, 6.3) }); }
        if (gey.length) W.anim.push((dt, t) => { for (const o of gey) { const k = Math.max(0, Math.sin(t * .8 + o.ph)) ** 2, h = .6 + k * 5.4;
          o.m.scale.set(.7 + k * .5, h / 6, 1); o.m2.scale.copy(o.m.scale); o.m.position.y = o.m2.position.y = o.y0 + h / 2; } }); }
      /* ---------- close-up detail: loose stones by the road, outcrops for depth, a roof over the lava ---------- */
      { const peb = [], pebG = blockBlob(.52, .36, .62, 0, .55, .34, ['#9a8f84', '#857a70', '#a89d92', '#766b63'], 41);
        for (let d = 0; d < L; d += 1.25) { const i = Math.round(d / STEP) % N; if (!noSec(i)) continue; const p = tp(i);
          for (const sd of [-1, 1]) { if (Math.random() < .55) continue;
            const [x, y, z] = rolled(p, sd * (HALF + rand(.5, 2.1)), .03); peb.push({ x, y, z, s: rand(.45, 1.5), ry: rand(0, 6) }); } }
        peb.length && instanced(scene, pebG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), peb, false); }
      { // boulders out on the open floor, so the big caverns read in layers instead of one flat wall
        const outG = [blockBlob(3.4, 4.2, 3, 1, .5, .34, ['#ffffff'], 53), blockBlob(2.2, 2.6, 2.4, 1, .55, .34, ['#ffffff'], 59)];
        const byS = [[], [], []];
        for (let d = 5; d < L; d += 11) { const f = d / L, sc = secOf(f), i = Math.round(d / STEP) % N; if (!noSec(i)) continue; const p = tp(i);
          for (const sd of [-1, 1]) { const op = sd > 0 ? openR(f) : openL(f); if (op < 5 || Math.random() < .45) continue;
            const [x, y, z] = rolled(p, sd * (IN + rand(2, Math.min(op - 1.5, 11))), FLO - .4);
            byS[sc].push({ x, y, z, s: rand(.6, 1.35), ry: rand(0, 6), g: Math.random() < .5 ? 0 : 1 }); } }
        const OMAT = [flatM('#5a3a86', { roughness: .95 }), flatM('#78848e', { roughness: .95 }), flatM('#7a3c22', { roughness: .95 })];
        for (let sc = 0; sc < 3; sc++) for (const gi of [0, 1]) { const l2 = byS[sc].filter((o) => o.g === gi); if (l2.length) instanced(scene, outG[gi], OMAT[sc], l2, false); } }
      { // the lava cavern gets a roof of hanging rock, like the other two
        if (DOWN) { const L3 = [[], [], []];
          for (let i = 0; i < N; i += 9) { const f = i / N; if (secOf(f) !== 2 || !noSec(i)) continue; const p = tp(i), d = i * STEP;
            const a = rand(1.1, 2.05), [l, h] = surfAt(d, a), [x, y, z] = rolled(p, l, h + .4);
            L3[(i / 9 | 0) % 3].push({ x, y, z, s: rand(.6, 1.2), ry: rand(0, 6) }); }
          putStal(L3, DOWN, [flatM('#6a3a22'), flatM('#7c4628'), flatM('#552c1a')]); } }
      /* ---------- the lights: a pool that follows the glow nearest the player, and the colour of each cavern ---------- */
      W.glowPts = glow; W.lanternPos = glow.map((g) => new THREE.Vector3(g.x, g.y, g.z));
      W.lampPool = Array.from({ length: 6 }, () => { const l = new THREE.PointLight('#ffb35a', 0, 24, 1.5); l.shadow.mapSize.set(256, 256); l.shadow.bias = -.004; scene.add(l); return l; });
      W.hemi = scene.children.find((o) => o.isHemisphereLight);
      if (W.hemi) { W.hemi.color.set(SEC[0].hemi); W.hemi.intensity = SEC[0].hi; W.hemi0 = SEC[0].hi; }
      W.sun.intensity = SEC[0].sun;
      { const cA = new THREE.Color(), cB = new THREE.Color();
        W.anim.push(() => { if (!race || !race.player || !W.hemi) return;
          const f = wrapF(race.player.s / L), m = mixAt(f), A = SEC[m.a], B = SEC[m.b], t = m.t;
          W.hemi0 = A.hi + (B.hi - A.hi) * t;
          W.hemi.intensity = W.hemi0 * (gfxOf(save) === 'low' ? 1.9 : 1);
          W.hemi.color.copy(cA.set(A.hemi).lerp(cB.set(B.hemi), t));
          W.sun.intensity = A.sun + (B.sun - A.sun) * t; W.sun.color.copy(cA.set(A.hemi).lerp(cB.set(B.hemi), t));
          if (scene.fog) scene.fog.color.copy(cA.set(A.fog).lerp(cB.set(B.fog), t));
        }); }
    },
  },
  space: {
    ground(scene, W, def) { W.groundAt = null; },
    scenery(scene, W, def) {
      // the road is a floating ribbon: a dark underside and glowing side skirts
      const under = M('#151a3a', { roughness: .5, side: THREE.DoubleSide });
      scene.add(new THREE.Mesh(strip(-HALF - .9, HALF + .9, -1.1, -1.1), under));
      for (const s of [-1, 1]) scene.add(new THREE.Mesh(strip(s * (HALF + .9), s * (HALF + .9), -1.1, .03, { only: (i) => !(W.rh && W.rh[0][s][i]) }), new THREE.MeshBasicMaterial({ color: s > 0 ? '#3a8aff' : '#c84aff', side: THREE.DoubleSide })));
      // (v100) a colourful nebula all round: a big painted sphere (opaque, behind everything) with soft clouds of pink,
      // violet, teal and blue on deep space, and many coloured stars on top
      if (def.nebula) { const tex = canvasTex(1024, 512, (x) => { x.fillStyle = '#070418'; x.fillRect(0, 0, 1024, 512);
          for (let k = 0; k < 46; k++) { const cx = rand(0, 1024), cy = rand(80, 440), r = rand(60, 220), c = pick(['255,93,177', '138,74,232', '58,216,200', '58,140,255', '255,138,60', '180,100,255']), g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(${c},.42)`); g.addColorStop(.5, `rgba(${c},.14)`); g.addColorStop(1, `rgba(${c},0)`); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); for (const dx of [-1024, 1024]) { x.save(); x.translate(dx, 0); x.fillRect(cx - r, cy - r, r * 2, r * 2); x.restore(); } }
          for (let k = 0; k < 1400; k++) { x.fillStyle = pick(['#ffffff', '#ffffff', '#9ad8ff', '#ffd8a0', '#ffb0f0']); const sz = Math.random() < .08 ? 2 : 1; x.fillRect(rand(0, 1024), rand(0, 512), sz, sz); } });
        const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false })); sky.position.set(MID.x, 0, MID.z); sky.renderOrder = -1; scene.add(sky); }
      // stars all round
      const n = 2600, sp = new Float32Array(n * 3), sc = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const u = rand(-1, 1), a = rand(0, 6.28), r = rand(650, 900), q = Math.sqrt(1 - u * u); sp.set([MID.x + Math.cos(a) * q * r, u * r * .8 + 40, MID.z + Math.sin(a) * q * r], i * 3); const c = new THREE.Color(pick(['#ffffff', '#ffffff', '#9ad8ff', '#ffd8a0', '#ffb0f0'])); sc.set([c.r, c.g, c.b], i * 3); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
      scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false })));
      // planets with painted bands, one with a ring
      const planet = (r, cols, x, y, z, ring) => {
        const t = canvasTex(256, 128, (c) => { cols.forEach((col, i) => { c.fillStyle = col; c.fillRect(0, i * 128 / cols.length, 256, 128 / cols.length + 1); }); for (let k = 0; k < 40; k++) { c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.ellipse(rand(0, 256), rand(0, 128), rand(10, 40), rand(2, 6), 0, 0, 7); c.fill(); } });
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 24), new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: .35, roughness: .8, fog: false })); m.position.set(x, y, z); m.rotation.z = rand(-.4, .4); scene.add(m); W.spin.push({ m, axis: 'y', v: .03 });
        if (ring) { const rg = new THREE.Mesh(new THREE.RingGeometry(r * 1.4, r * 2.1, 64), new THREE.MeshBasicMaterial({ color: ring, transparent: true, opacity: .55, side: THREE.DoubleSide, fog: false })); rg.rotation.x = Math.PI / 2 - .35; m.add(rg); }
      };
      planet(90, ['#ff9a5a', '#ffd27a', '#e86a3a', '#ffc08a', '#d8582a'], MID.x + 380, 120, MID.z - 420, '#ffe0b0');
      planet(60, ['#5ab0ff', '#3a7ae8', '#8ad8ff', '#2a5ac8'], MID.x - 460, 60, MID.z - 120);
      planet(38, ['#c86aff', '#8a4ae8', '#e8a8ff'], MID.x - 160, 170, MID.z + 520, '#c8a8ff');
      planet(24, ['#7af8a0', '#3ac878', '#b8ffd0'], MID.x + 300, -40, MID.z + 360);
      const sun = new THREE.Mesh(new THREE.SphereGeometry(45, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff2c0', fog: false })); sun.position.set(MID.x - 500, 260, MID.z - 600); scene.add(sun);
      // floating rocks that tumble slowly
      const rockG = new THREE.IcosahedronGeometry(1, 0), rp = rockG.attributes.position; for (let i = 0; i < rp.count; i++) rp.setXYZ(i, rp.getX(i) * rand(.8, 1.2), rp.getY(i) * rand(.8, 1.2), rp.getZ(i) * rand(.8, 1.2)); rockG.computeVertexNormals();
      const rockM = new THREE.MeshStandardMaterial({ color: '#8a7aa8', roughness: .9, flatShading: true });
      for (let k = 0; k < 70; k++) {
        const x = rand(BOUNDS.x0 - 80, BOUNDS.x1 + 80), z = rand(BOUNDS.z0 - 80, BOUNDS.z1 + 80); if (!farFromRoad(x, z, 12, 5)) continue;
        const m = new THREE.Mesh(rockG, rockM); m.scale.setScalar(rand(1.5, 7)); m.position.set(x, rand(-25, 45), z); m.rotation.set(rand(0, 6), rand(0, 6), 0); scene.add(m); W.spin.push({ m, axis: 'x', v: rand(-.3, .3) });
      }
      // the rescue drone that carries a fallen kart back onto the road
      {
        const g = new THREE.Group(), body = M('#ffe14a', { roughness: .35, metalness: .2 }), dark = M('#2a2e3a', { roughness: .4 });
        g.add(new THREE.Mesh(new THREE.SphereGeometry(.45, 14, 10).scale(1.3, .6, 1.3), body));
        for (const [x, z] of [[-.75, -.75], [.75, -.75], [-.75, .75], [.75, .75]]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .03, 16), new THREE.MeshBasicMaterial({ color: '#c8f0ff', transparent: true, opacity: .55 })); r.position.set(x, .2, z); g.add(r); const a = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, .9), dark); a.position.set(x / 2, .1, z / 2); a.rotation.y = Math.atan2(x, z); g.add(a); }
        for (const x of [-.5, .5]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 1.6, 6), dark); c.position.set(x, -.85, 0); c.rotation.z = x * .4; g.add(c); }
        const eye = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), new THREE.MeshBasicMaterial({ color: '#7af8ff' })); eye.position.set(0, -.05, .5); g.add(eye);
        g.visible = false; scene.add(g); W.rescue = g;
      }
      // a space station that turns slowly, and shooting stars now and then
      {
        const st = new THREE.Group(), hull = M('#d8dde8', { roughness: .35, metalness: .4 }), panel = M('#2a4aa8', { roughness: .2, metalness: .6, emissive: '#1a2a6a', emissiveIntensity: .4 });
        st.add(new THREE.Mesh(new THREE.TorusGeometry(24, 2.2, 12, 48), hull));
        for (let k = 0; k < 4; k++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, 48, 8), hull); sp.rotation.z = Math.PI / 2; sp.rotation.y = k * Math.PI / 4; st.add(sp); }
        st.add(new THREE.Mesh(new THREE.SphereGeometry(6, 20, 14), hull));
        for (const sd of [-1, 1]) { const pn = new THREE.Mesh(new THREE.BoxGeometry(30, .3, 9), panel); pn.position.set(0, 0, sd * 14); pn.rotation.x = Math.PI / 2; st.add(pn); }
        for (let k = 0; k < 16; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(.5, 6, 4), new THREE.MeshBasicMaterial({ color: k % 2 ? '#7af8ff' : '#ff5db1' })); const a = k / 16 * Math.PI * 2; l.position.set(Math.cos(a) * 24, Math.sin(a) * 24, 2.4); st.add(l); }
        st.position.set(MID.x + 120, 70, MID.z - 140); st.rotation.x = .9; scene.add(st); W.spin.push({ m: st, axis: 'z', v: .08 });
        const streak = new THREE.Mesh(new THREE.CylinderGeometry(.05, .6, 26, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .9, fog: false })); streak.visible = false; scene.add(streak);
        let shoot = 0, sv = new THREE.Vector3();
        W.anim.push((dt) => {
          if (!streak.visible && Math.random() < dt * .25) { streak.visible = true; shoot = 1; streak.position.set(MID.x + rand(-300, 300), rand(120, 220), MID.z + rand(-300, 300)); sv.set(rand(-1, 1), -.5, rand(-1, 1)).normalize(); streak.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sv.clone().negate()); }
          if (streak.visible) { shoot -= dt; streak.position.addScaledVector(sv, dt * 260); streak.material.opacity = Math.max(0, shoot); if (shoot <= 0) streak.visible = false; }
        });
      }
      // glowing ring gates over the road
      for (let f = .05; f < 1; f += .11) {
        if (inRoll(f)) continue;
        const p = at(f * TRACK.L), m = new THREE.Mesh(new THREE.TorusGeometry(HALF + 2.2, .32, 10, 48), new THREE.MeshBasicMaterial({ color: pick(['#7af8ff', '#ff5db1', '#ffe14a']) }));
        m.position.set(p.x, p.y + 1.6, p.z); m.rotation.y = Math.atan2(p.p.tx, p.p.tz); scene.add(m);
      }
    },
  },
};
// grandstands with a cheering crowd on both sides of the start (Alps and Robo City)
function grandstands(scene, W, roof) {
  const standM = M('#e8eef8', { roughness: .6 }), roofM = M(roof, { roughness: .5 }), crowd = [], heads = [], all = new THREE.Group();
  for (const side of [-1, 1]) for (let s0 = -34; s0 <= 18; s0 += 26) {
    const back = W.pitIdx && PITS && side === PITS.side && W.pitIdx[Math.round(((s0 + TRACK.L) % TRACK.L) / STEP) % TRACK.N] ? 21 : 0;   // (v152) behind the garages
    const p = at((s0 + TRACK.L) % TRACK.L, side * (HALF + 9.5 + back)), g = new THREE.Group(); g.position.set(p.x, groundY(p.x, p.z), p.z); g.rotation.y = Math.atan2(-side * p.p.nx, -side * p.p.nz); all.add(g);
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(22, .6 + k * .8, 1.6), standM); b.position.set(0, (.6 + k * .8) / 2, -k * 1.6); b.receiveShadow = true; g.add(b); }
    const r = new THREE.Mesh(new THREE.BoxGeometry(23, .25, 7.5), roofM); r.position.set(0, 6.2, -2.4); r.castShadow = true; g.add(r);
    for (const x of [-11, 0, 11]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, 6.2, 8), roofM); pl.position.set(x, 3.1, -5.4); g.add(pl); }
    g.updateMatrixWorld(true);
    if (!CROWD) continue;   // (v62: no moving fans — the user)
    for (let k = 0; k < 4; k++) for (let i = 0; i < 18; i++) {
      if (Math.random() < .15) continue;
      const v = new THREE.Vector3(-10 + i * 1.18 + rand(-.2, .2), .6 + k * .8 + .45, -k * 1.6 + rand(-.2, .2)).applyMatrix4(g.matrixWorld);
      crowd.push({ x: v.x, y: v.y, z: v.z, s: rand(.85, 1.1), ry: g.rotation.y, c: pick(['#e8403a', '#3c8cf0', '#ffd23a', '#4fc84a', '#ff5db1', '#ff8a1e', '#8a4ae8', '#2ac8c0']) });
      heads.push({ x: v.x, y: v.y + .62, z: v.z, s: 1, c: pick(['#f2c8a0', '#c8946a', '#8a5a3a', '#ffe0c0', '#7ad86a', '#3ad8e8']) });
    }
  }
  const stands = new THREE.Mesh(bakeOne(all), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6 })); stands.receiveShadow = true; scene.add(stands);   // all the stands in one draw
  if (!CROWD) { W.crowd = null; return; }
  W.crowd = instanced(scene, new THREE.CapsuleGeometry(.24, .4, 4, 8), M('#ffffff', { roughness: .7 }), crowd, false);
  W.heads = instanced(scene, new THREE.SphereGeometry(.2, 10, 8), M('#ffffff', { roughness: .6 }), heads, false);
  W.crowdList = crowd; W.headList = heads;
}
const CROWD = false;   // the bobbing crowd in the stands and Rob's robot fans: off since v62 (the user: "remove the moving fans")
// flag poles along the track and billboards on the outside of the bends (Alps and Robo City)
function flagsAndBoards(scene, W, flags) {
  const flagCols = ['#e8403a', '#ffd23a', '#3c8cf0', '#4fc84a', '#ff5db1', '#ff8a1e', '#8a4ae8'];
  if (flags) {
    const poles = [];
    for (let s0 = 6; s0 < TRACK.L; s0 += 13) for (const side of [-1, 1]) {
      if (W.pitIdx && PITS && side === PITS.side && W.pitIdx[Math.round(s0 / STEP) % TRACK.N]) continue;   // (v152) not in the pit lane
      const p = at(s0, side * (HALF + 5.2)); poles.push({ x: p.x, z: p.z, y: groundY(p.x, p.z), s: 1, ry: -angleOf(p.p) + Math.PI / 2 });
    }
    const poleGeo = new THREE.CylinderGeometry(.07, .09, 4.2, 8).translate(0, 2.1, 0);
    const flagGeo = new THREE.BufferGeometry(); flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 4.1, 0, 0, 3.0, 0, 1.4, 3.55, .15], 3)); flagGeo.computeVertexNormals();
    instanced(scene, poleGeo, M('#f4f6fa', { roughness: .4 }), poles, false);
    instanced(scene, flagGeo, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: .6 }), poles.map((p, i) => ({ ...p, c: flagCols[i % flagCols.length] })), false);
    // a bunch of balloons on each side of the start gantry
    const s0 = TRACK.pts[0], bg = new THREE.SphereGeometry(.55, 16, 12).scale(1, 1.18, 1);
    for (const side of [-1, 1]) for (let k = 0; k < 6; k++) {
      const m = new THREE.Mesh(bg, M(flagCols[(k + (side > 0 ? 3 : 0)) % flagCols.length], { roughness: .25, metalness: .05 })), l = side * (HALF + 1.6 + rand(-.6, .9));
      m.position.set(s0.x + s0.nx * l + s0.tx * rand(-.4, 1.4), 0, s0.z + s0.nz * l + s0.tz * rand(-.4, 1.4)); m.userData = { y: s0.y + 6.6 + rand(0, 1.6), p: rand(0, 6) }; m.position.y = m.userData.y; scene.add(m); W.balloons.push(m);
    }
  }
  const words = [['FUGIO', '#3c8cf0'], ['FOXKARTS', '#ff8a1e'], ['LEARN ENGLISH!', '#4fc84a'], ['ALPINE CUP', '#e8403a'], ['GO GO GO!', '#8a4ae8'], ['DRIFT!', '#ff5db1']];
  const boardTex = words.map(([w, c]) => canvasTex(512, 160, (x) => {
    x.fillStyle = c; x.fillRect(0, 0, 512, 160); x.fillStyle = 'rgba(255,255,255,.18)'; for (let i = -2; i < 12; i++) { x.beginPath(); x.moveTo(i * 60, 160); x.lineTo(i * 60 + 30, 160); x.lineTo(i * 60 + 90, 0); x.lineTo(i * 60 + 60, 0); x.fill(); }
    x.strokeStyle = '#1b2a4a'; x.lineWidth = 14; x.strokeRect(7, 7, 498, 146);
    x.font = 'bold 78px Fredoka, Arial Rounded MT Bold, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 12; x.strokeText(w, 256, 84); x.fillStyle = '#fff'; x.fillText(w, 256, 84);
  }));
  const postM = M('#1b2a4a'), boardGeo = new THREE.BoxGeometry(6, 1.9, .25);
  let last = -99, n = 0;
  for (let i = 0; i < TRACK.N; i += 5) {
    const s0 = i * STEP, turn = wrapA(angleOf(at(s0 + 12).p) - angleOf(at(s0 - 12).p)); if (Math.abs(turn) < .5 || s0 - last < 45) continue;
    const side = -Math.sign(turn);
    if (W.pitIdx && W.pitIdx[i] && PITS && side === PITS.side) continue;   // (v152) not in the pit lane
    last = s0; const p = at(s0, side * (HALF + 6.5)), g = new THREE.Group(), t = boardTex[n++ % boardTex.length];
    const b = new THREE.Mesh(boardGeo, [postM, postM, postM, postM, new THREE.MeshStandardMaterial({ map: t, roughness: .5, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: .15 }), postM]); b.position.y = 2.6; b.castShadow = true; g.add(b);
    for (const x of [-2.2, 2.2]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 2.6, 8), postM); pl.position.set(x, 1.3, 0); g.add(pl); }
    g.position.set(p.x, groundY(p.x, p.z), p.z); g.rotation.y = Math.atan2(-side * p.p.nx, -side * p.p.nz); scene.add(g);
  }
}

/* ---------- answer gates: three arches across the whole road; a voice says a word, drive through the right picture ---------- */
// The gates are solid: the arches fill the road, striped wings stand out beside them and, with only two answers, a barrier
// closes the middle arch, so every kart goes through one of the open arches (gateWalls below guides and blocks them).
function gatePanelDraw(x, txt, state) {
  x.clearRect(0, 0, 256, 256);
  x.fillStyle = state === 'ok' ? '#c8f8c0' : state === 'off' ? 'rgba(255,255,255,.55)' : '#ffffff'; x.strokeStyle = state === 'ok' ? '#2ab04a' : '#1b2a4a'; x.lineWidth = 14;
  x.beginPath(); x.roundRect(10, 10, 236, 236, 36); x.fill(); x.stroke();
  x.textAlign = 'center'; x.textBaseline = 'middle';
  if (txt === '?') { x.font = 'bold 150px Fredoka, Arial Rounded MT Bold, Arial'; x.fillStyle = '#8a94a8'; x.fillText('?', 128, 138); }
  else { x.font = '150px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; x.fillText(txt, 128, 140); }
}
function buildGates(scene, W, def, fs = GATE_AT) {
  const postM = M(def.kerb[0], { roughness: .4, emissive: def.kerb[0], emissiveIntensity: .25 }), beamM = M('#1b2a4a', { roughness: .5 });
  const blockM = [M(def.kerb[0], { roughness: .5, emissive: def.kerb[0], emissiveIntensity: .15 }), M(def.kerb[1], { roughness: .5 })];
  const GW = HALF + .4, third = GW * 2 / 3, wing = 1.6;   // short wings: the track's walls carry on beyond them
  return fs.map((f) => {
    const p = at(f * TRACK.L), g = new THREE.Group(); g.position.set(p.x, p.y, p.z); g.rotation.y = Math.atan2(-p.p.tx, -p.p.tz); scene.add(g);
    for (const x of [-GW, -GW / 3, GW / 3, GW]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.2, .26, 5.2, 10), postM); m.position.set(x, 2.6, 0); m.castShadow = true; g.add(m); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(GW * 2 + .7, .5, .5), beamM); beam.position.y = 5.2; g.add(beam);
    // the wings: red-and-white (or the track's colours) blocks out from the end posts, each sitting on the ground below it
    for (const sd of [-1, 1]) for (let k = 0, n = Math.ceil(wing / 1.25); k < n; k++) {
      const w = wing / n, lat = sd * (GW + .2 + w * (k + .5));
      const b = new THREE.Mesh(new THREE.BoxGeometry(w - .06, 2.4, .8), blockM[k % 2]); b.position.set(lat, .6, 0); b.castShadow = true; g.add(b);
    }
    const block = new THREE.Group(); block.visible = false; g.add(block);
    for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(third / 3 - .08, 1.3, .5), blockM[k % 2]); b.position.set((k - 1) * third / 3, .65, 0); b.castShadow = true; block.add(b); }
    const panels = [-third, 0, third].map((lat) => {
      const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); gatePanelDraw(x, '?');
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.9), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide })); m.position.set(lat, 3.45, 0); g.add(m);
      return { x, t, m };
    });
    return { s: f * TRACK.L, g, panels, block, lat: [-third, 0, third], GW, armed: false };
  });
}
// the open stretches of a gate, sideways (inside the arches, clear of the posts); the closed middle arch is left out
function gateSpans(g, only) {
  const open = only != null ? [only] : (g.armed || g.done) && g.lanes ? g.lanes : [0, 1, 2], h = g.GW / 3 - .65;
  return open.map((li) => [g.lat[li] - h, g.lat[li] + h]);
}
// every kart goes through an open arch: in the last 14 m the gate's rails slide a kart that is lined up with a post, the
// closed arch or the wing into the nearest arch; a kart that still hits the wing or the barrier bounces back off it.
// After a gate question the rails take you into the arch you picked (from 24 m out), wherever you are on the road.
function gateWalls(r, dt) {
  const Lt = TRACK.L, p = tp(r.idx); r.gateD = r.gateD || [];
  WORLD.gates.forEach((g, gi) => {
    const d = ((g.s - r.sc) % Lt + Lt) % Lt, was = r.gateD[gi]; r.gateD[gi] = d;
    const picked = r.player && race.steerGate === g, reach = picked ? 24 : 14;
    if (d > reach && d < Lt - 14) return;
    const near = (spans) => { let tgt = r.lat, best = Infinity; for (const [a, b] of spans) { if (r.lat >= a && r.lat <= b) return [0, r.lat]; for (const e of [a + .2, b - .2]) if (Math.abs(e - r.lat) < best) { best = Math.abs(e - r.lat); tgt = e; } } return [best, tgt]; };
    let [best, tgt] = near(gateSpans(g, picked ? race.steerLane : null));
    if (best && picked && d > Lt - 14) [best, tgt] = near(gateSpans(g));   // (just past the gate: only the real walls count)
    if (!best) return;
    if (d <= reach && (best < 4.5 || picked) && !(was > Lt - 14)) {
      const step = Math.sign(tgt - r.lat) * Math.min(best, Math.max(5, r.speed * .45) * dt); r.x += p.nx * step; r.z += p.nz * step; r.lat += step;
    } else if (was !== undefined && was < 8 && d > Lt - 8) {
      const back = Lt - d + .8; r.x -= p.tx * back; r.z -= p.tz * back; r.speed = Math.min(r.speed * .3, 5); if (r.drift) { r.drift = 0; r.driftT = 0; r.driftLvl = 0; }
      burst(r.x + p.tx * .9, r.y + .7, r.z + p.tz * .9, '#ffe14a', 8);
      if (r.player) { sfx.bump(); buzz(40); race.shake = .35; if (!race.tips.gateWall) { race.tips.gateWall = 1; toast('Drive through a gate!', '#ffe14a', 28); } }
      project(r); r.gateD[gi] = ((g.s - r.sc) % Lt + Lt) % Lt;
    }
  });
}
function setPanel(pn, txt, state) { gatePanelDraw(pn.x, txt, state); pn.t.needsUpdate = true; }
/* ---------- (v152) THE PIT LANE ---------------------------------------------------------------------
   Alpine Peaks has a real pit lane now, the way a circuit does. It leaves the track on the OUTSIDE of
   the circuit well before the start/finish line, runs its own road behind the pit wall past five garage
   bays, and rejoins the track after the line. A speed limiter holds every kart to 60 through it.
   Only YOUR bay is there to see — the other four racers' spots are unmarked, as the user asked — and
   yours lights up green on the lap a stop is due. Drive into it and the kart parks itself for the
   three sets of three questions.
   Positions are given as `ds`: metres from the start/finish line, negative BEFORE it.
   A track with no spec here keeps the simple roadside boxes instead.
--------------------------------------------------------------------------------------------------- */
const PIT_SPECS = {
  alps: {
    side: -1,                           // which side of the road the lane is on (−1 = the outside here)
    // (v276, the user: "make the road shorter, like the size of the pitstop") the lane is now just the garage row and a short
    // ramp on and off each end: 122 m instead of 290. It rejoins BEFORE the grid, so nothing is painted over the line or the grid boxes.
    entry: -140, tIn: -104,             // the mouth, and where the lane has fully pulled away
    tOut: -44, exit: -18,               // the way back on
    mouthIn: 2.0, mouthOut: 6.9,        // at the mouth the lane is the near half of the road, opening outwards
    laneU: 13.2, laneW: 4.2,            // then its own 8.4 m road, 13.2 m out from the centre line
    bays: [-94.8, -84.2, -73.6, -63, -52.4],   // five garages side by side at a 10.6 m pitch; yours is the middle one
    me: 2, bayU: 14.9,                  // you stop on the garage side of the lane
    gateFrom: -214, gateTo: -114,       // where the hologram barrier sweeps across the track
  },
  // (v177, the user) every map has a pit lane now, on the outside of the start, built the same way
  beach: { side: -1, entry: -140, tIn: -104, tOut: -44, exit: -18, mouthIn: 2.0, mouthOut: 6.9, laneU: 13.2, laneW: 4.2, bays: [-94.8, -84.2, -73.6, -63, -52.4], me: 2, bayU: 14.9, gateFrom: -214, gateTo: -114 },
  city: { side: -1, entry: -140, tIn: -104, tOut: -44, exit: -18, mouthIn: 2.0, mouthOut: 6.9, laneU: 13.2, laneW: 4.2, bays: [-94.8, -84.2, -73.6, -63, -52.4], me: 2, bayU: 14.9, gateFrom: -214, gateTo: -114 },
  mines: { side: 1, entry: -140, tIn: -104, tOut: -44, exit: -18, mouthIn: 2.0, mouthOut: 6.9, laneU: 13.2, laneW: 4.2, bays: [-94.8, -84.2, -73.6, -63, -52.4], me: 2, bayU: 14.9, gateFrom: -214, gateTo: -114 },
  // (Star Loop: the same short lane round its own garage row, which stands further back from the line)
  space: { side: -1, entry: -175, tIn: -139, tOut: -79, exit: -53, mouthIn: 2.0, mouthOut: 7.9, laneU: 14.2, laneW: 4.2, bays: [-130, -119.4, -108.8, -98.2, -87.6], me: 2, bayU: 15.9, gateFrom: -249, gateTo: -149 },
};
let PITS = null;                        // the spec for the track in play (null = no pit lane here)
// metres from the start/finish line, −L/2 … +L/2
const dsOf = (s) => { const L = TRACK.L, d = ((s % L) + L) % L; return d > L / 2 ? d - L : d; };
const pitIdxOf = (ds) => Math.round((((ds % TRACK.L) + TRACK.L) % TRACK.L) / STEP);
// the lane's two edges at a point, in metres out from the centre line on the pit side (null = off the lane)
// The INNER edge pulls away from the road at a steady, gentle angle — about three degrees, so a kart
// doing 90 can follow it without a flick of the wheel — while the OUTER edge opens out quickly, so the
// mouth is wide and forgiving. The two together make the lane split off the way a circuit's does.
function pitEdges(ds) {
  const P = PITS; if (!P || ds < P.entry || ds > P.exit) return null;
  const t = ds < P.tIn ? clamp((ds - P.entry) / (P.tIn - P.entry), 0, 1)
    : ds > P.tOut ? clamp((P.exit - ds) / (P.exit - P.tOut), 0, 1) : 1;
  const sm = t * t * (3 - 2 * t);
  return [P.mouthIn + (P.laneU - P.laneW - P.mouthIn) * t, P.mouthOut + (P.laneU + P.laneW - P.mouthOut) * sm];
}
const pitMid = (ds) => { const e = pitEdges(ds); return e ? (e[0] + e[1]) / 2 : null; };
const pitLatAt = (s) => { const u = pitMid(dsOf(s)); return u == null ? 0 : u * PITS.side; };
// a world point on the lane
const pitPt = (ds, u, h = 0) => rolled(tp(pitIdxOf(ds)), u * PITS.side, h);

// Set up before anything is built: the track's own wall gives way to the pit wall along the whole lane,
// which also keeps the scenery and the trackside fences out of it.
function prepPit(W, def) {
  const P = PIT_SPECS[def.id]; PITS = P || null; W.pitSpec = P || null; W.pitPath = null; W.pitIdx = null;
  if (!P) return;
  const N = TRACK.N;
  W.pitIdx = new Uint8Array(N); W.pitMouth = new Uint8Array(N);
  for (let ds = P.entry - 3; ds <= P.exit + 3; ds += STEP / 2) {
    const i = ((pitIdxOf(ds) % N) + N) % N, e = pitEdges(ds);
    W.pitIdx[i] = 1; W.openSide[i] = P.side; W.openLim[i] = 30;   // (the lane's own walls do the stopping)
    if (e && e[0] < HALF + 1.1) W.pitMouth[i] = 1;                // the two mouths, where the lane lies over the road's own edge
  }
  // the lane's centre line, so trees, chalets and fences keep away from it (see farFromRoad)
  W.pitPath = [];
  for (let ds = P.entry; ds <= P.exit; ds += 5) { const u = pitMid(ds); if (u != null) { const q = pitPt(ds, u); W.pitPath.push({ x: q[0], z: q[2] }); } }
  const pp = W.pitPath;
  W.pitDist = (x, z) => { let b = 1e9; for (let i = 0; i < pp.length; i++) { const d = (pp[i].x - x) ** 2 + (pp[i].z - z) ** 2; if (d < b) b = d; } return Math.sqrt(b); };
}

// a strip that follows the pit lane: a(ds) and b(ds) are the two edges in u, ya/yb the heights above the road
function pitStrip(a, b, ya, yb, opts = {}) {
  const P = PITS, pos = [], uv = [], per = opts.uvLen || 0;
  const from = opts.from ?? P.entry, to = opts.to ?? P.exit, step = opts.step ?? STEP;
  const f = (v) => (typeof v === 'function' ? v : () => v);
  const A1 = f(a), B1 = f(b), Y1 = f(ya), Y2 = f(yb);
  let v = 0;
  for (let ds = from; ds < to - 1e-6; ds += step) {
    const d2 = Math.min(ds + step, to);
    const A = pitPt(ds, A1(ds), Y1(ds)), B = pitPt(ds, B1(ds), Y2(ds)), C = pitPt(d2, A1(d2), Y1(d2)), D = pitPt(d2, B1(d2), Y2(d2));
    if (P.side > 0) pos.push(...A, ...B, ...C, ...B, ...D, ...C); else pos.push(...B, ...A, ...C, ...D, ...B, ...C);
    if (per) { const v1 = v + step / per; uv.push(0, v, 1, v, 0, v1, 1, v, 1, v1, 0, v1); v = v1; }
    if (opts.roadUv) {   // (v276, the user: "the same texture as the normal road") the road's own texture coordinates, carried on sideways past its edge: where the lane lies on the road it matches it exactly, tile for tile, and it never stretches
      const uOf = (e) => e * P.side / (2 * HALF) + .5, tiles = Math.round(TRACK.L / 12), vOf = (d) => ((d % TRACK.L) + TRACK.L) % TRACK.L / TRACK.L * tiles;
      const ua = uOf(A1(ds)), ub = uOf(B1(ds)), uc = uOf(A1(d2)), ud = uOf(B1(d2)), v0 = vOf(ds), v1 = v0 + (d2 - ds) / TRACK.L * tiles;
      if (P.side > 0) uv.push(ua, v0, ub, v0, uc, v1, ub, v0, ud, v1, uc, v1); else uv.push(ub, v0, ua, v0, uc, v1, ud, v1, ub, v0, uc, v1);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (per || opts.roadUv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals(); return g;
}
// a group standing on the lane: local +x points away from the track, +z runs along it
function pitGroup(scene, ds, u, h = 0) {
  const g = new THREE.Group(), p = tp(pitIdxOf(ds)), o = pitPt(ds, u, h);
  g.position.set(o[0], o[1], o[2]);
  const ex = new THREE.Vector3(p.nx * PITS.side, 0, p.nz * PITS.side).normalize();
  const ez = new THREE.Vector3(-ex.z, 0, ex.x);
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, new THREE.Vector3(0, 1, 0), ez));
  scene.add(g); return g;
}

/* --- the painted surfaces --- */
const pitTarTex = (col = '#464e5c') => canvasTex(128, 128, (x) => {   // (v176, the user: the same colour as the track's road)
  x.fillStyle = col; x.fillRect(0, 0, 128, 128);
  for (let k = 0; k < 900; k++) { x.fillStyle = Math.random() < .3 ? 'rgba(255,255,255,.05)' : 'rgba(30,34,44,.1)'; x.fillRect(rand(0, 128), rand(0, 128), rand(1, 2.4), rand(1, 2.4)); }
}, [1, 1]);
// your bay's paint: a green box with a white number, the only one of the five that is marked
const pitBayTex = (txt) => canvasTex(256, 256, (x) => {
  x.fillStyle = '#176a22'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = '#ffffff'; x.lineWidth = 22; x.strokeRect(17, 17, 222, 222);
  x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '158px "Luckiest Guy", Fredoka, Arial'; x.fillText(txt, 128, 148);
});
// THE HOLOGRAM BARRIER (the user): while a stop is due, a red light-fence sweeps across the track
// before the pit entry and funnels you in. Its red bars are an alphaTest CUT-OUT with an emissive map —
// solid where it is drawn, gone where it is not — so it looks see-through on every phone without any
// additive blending, and the faint pane behind it is plain alpha. Arrows along it point to the lane.
// (the strip's sideways coordinate runs UP the wall, so the bars are drawn down the canvas's x)
// (the strip's sideways coordinate runs UP the wall, so the bars are drawn down the canvas's x)
// Plain red bars and nothing else — the user asked for one colour and a simpler barrier.
const pitGateTex = () => canvasTex(256, 128, (x) => {
  x.clearRect(0, 0, 256, 128);
  for (let k = 0; k < 7; k++) { x.fillStyle = '#ff0a22'; x.fillRect(10 + k * 36, 0, 22, 128); }
});
// YOUR PIT BOX is a box of light: white bars and a white floor ring, tinted by the material's colour,
// so the whole thing changes state in one line. RED while it waits for you, YELLOW the moment you pull
// in, GREEN when the crew have finished — and it throws confetti as it turns. (The user.)
const PIT_BOX_COL = { wait: '#ff1a2e', work: '#ffc324', done: '#3ddc4a' };
// a group standing on the road at (s, lat): local +x across the road, +z along it
function trackGroup(scene, s, lat, h = 0) {
  const g = new THREE.Group(), p = tp(Math.round(s / STEP)), o = rolled(p, lat, h);
  g.position.set(o[0], o[1], o[2]);
  const ex = new THREE.Vector3(p.nx, 0, p.nz).normalize(), ez = new THREE.Vector3(-ex.z, 0, ex.x);
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, new THREE.Vector3(0, 1, 0), ez));
  scene.add(g); return g;
}
// The box is a simple block of light: its twelve EDGES are solid, so the outline reads at a glance,
// and its four sides are filled in with a wall you can barely see. Nothing else. (The user.)
function makePitBox(scene, s, lat, y) {
  const W2 = 1.95, L2 = 2.45, H = 2.25, T = .1, mats = [];
  const edge = new THREE.MeshBasicMaterial({ color: PIT_BOX_COL.wait, fog: false, toneMapped: false });
  const face = new THREE.MeshBasicMaterial({ color: PIT_BOX_COL.wait, transparent: true, opacity: .13, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });
  mats.push(edge, face);
  const g = trackGroup(scene, s, lat, y);
  for (const [w, x, z, ry] of [[L2 * 2, -W2, 0, Math.PI / 2], [L2 * 2, W2, 0, Math.PI / 2], [W2 * 2, 0, -L2, 0], [W2 * 2, 0, L2, 0]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), face); m.position.set(x, H / 2, z); m.rotation.y = ry; g.add(m);
  }
  const gx = new THREE.BoxGeometry(W2 * 2 + T, T, T), gz = new THREE.BoxGeometry(T, T, L2 * 2 + T), gy = new THREE.BoxGeometry(T, H, T);
  for (const yy of [T / 2, H]) {
    for (const z of [-L2, L2]) g.add(new THREE.Mesh(gx, edge).translateY(yy).translateZ(z));
    for (const x of [-W2, W2]) g.add(new THREE.Mesh(gz, edge).translateY(yy).translateX(x));
  }
  for (const x of [-W2, W2]) for (const z of [-L2, L2]) g.add(new THREE.Mesh(gy, edge).translateY(H / 2).translateX(x).translateZ(z));
  return { grp: g, mats };
}
const CONFETTI = ['#ffe14a', '#ff5db1', '#4fc84a', '#3c8cf0', '#ff8a1e', '#ffffff', '#8a4ae8'];
function pitConfetti(x, y, z) {
  for (let k = 0; k < 46; k++) {
    const a = Math.random() * 6.283, r = rand(0, 1.9);
    puff(x + Math.cos(a) * r, y + rand(.1, .7), z + Math.sin(a) * r, pick(CONFETTI), rand(.16, .3), rand(1.2, 2), rand(-3, 3), rand(5.5, 10), rand(-3, 3), 9);
  }
}
const pitBoardTex = (txt, bg = '#1b2a4a', fg = '#ffe14a') => canvasTex(512, 160, (x) => {
  x.fillStyle = bg; x.fillRect(0, 0, 512, 160);
  x.strokeStyle = fg; x.lineWidth = 12; x.strokeRect(10, 10, 492, 140);
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '92px "Luckiest Guy", Fredoka, Arial'; x.fillText(txt, 256, 86);
});

/* --- the lane itself --- */
function buildPitLane(scene, W, def) {
  const P = PITS; if (!P) return;
  const inner = (ds) => pitEdges(ds)[0], outer = (ds) => pitEdges(ds)[1];
  const Y = .035;
  // the barrier sweeps from the far wall right into the lane, so it does not merely point you at the
  // pits: it puts you in them, behind the pit wall, where you cannot get back out onto the track
  const G0 = -(HALF + 1.1), G1 = pitEdges(P.gateTo)[0] + 2.8;
  // 1. the tarmac
  // (v181) the lane itself in the road's own texture, at the road's scale (the road: one tile across its width, every 12 m)
  const lane = new THREE.Mesh(pitStrip(inner, outer, Y, Y, { roadUv: true }), W.pitRoadMat); lane.receiveShadow = true; scene.add(lane);
  // a white line down each edge
  const paint = M('#f2f5fa', { roughness: .6, fog: !def.clearRoad, polygonOffset: true, polygonOffsetFactor: -4 });
  scene.add(new THREE.Mesh(pitStrip((d) => inner(d) + .12, (d) => inner(d) + .42, Y + .005, Y + .005), paint));
  scene.add(new THREE.Mesh(pitStrip((d) => outer(d) - .42, (d) => outer(d) - .12, Y + .005, Y + .005), paint));
  // 2. THE PIT EXIT: a solid double YELLOW line down the inside of the lane all the way out onto the
  //    track (the user asked for yellow lines here in place of the blue-and-white hatching, which is gone).
  const yellow = M('#ffc324', { roughness: .55, fog: !def.clearRoad, polygonOffset: true, polygonOffsetFactor: -6 });
  for (const off of [.18, .78]) scene.add(new THREE.Mesh(pitStrip((d) => inner(d) + off, (d) => inner(d) + off + .32, Y + .012, Y + .012, { from: P.tOut - 26, to: P.exit }), yellow));
  // 3. THE PIT WALL: between the track and the lane, from where the two part company to where they meet again.
  //    It replaces the track's own fence along here, exactly as a circuit does.
  const wallFrom = (() => { for (let d = P.entry; d < P.tIn; d += .5) if (pitEdges(d)[0] > HALF + 1.4) return d; return P.tIn; })();
  const wallTo = (() => { for (let d = P.exit; d > P.tOut; d -= .5) if (pitEdges(d)[0] > HALF + 1.4) return d; return P.tOut; })();
  const adTex = canvasTex(512, 128, (x) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 512, 128);
    x.fillStyle = '#e8403a'; x.fillRect(0, 0, 512, 26);
    x.fillStyle = '#1b2a4a'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '62px "Luckiest Guy", Fredoka, Arial'; x.fillText('FOXKARTS', 256, 82);
  }, [1, 1]);
  const adMat = new THREE.MeshStandardMaterial({ map: adTex, roughness: .55, fog: !def.clearRoad, side: THREE.DoubleSide });
  const wallU = (d) => pitEdges(d)[0] - .45;
  scene.add(new THREE.Mesh(pitStrip(wallU, wallU, 0, 1.15, { from: wallFrom, to: wallTo, uvLen: 7 }), adMat));
  // its top rail and a flat top, so it does not read as a sheet of paper
  const rail = M('#2a3450', { roughness: .5, fog: !def.clearRoad });
  scene.add(new THREE.Mesh(pitStrip((d) => wallU(d) - .18, (d) => wallU(d) + .18, 1.15, 1.15, { from: wallFrom, to: wallTo }), rail));
  // 4. the ground. Everything between the track and the lane is PAVED, from the road's own edge out to
  //    the lane — no snow showing through at the two mouths, which is what the user was seeing — and the
  //    far side gets a low lip only along the stretch where the lane stands on its own.
  const edgeU = HALF - .5;
  const gapFrom = (() => { for (let d = P.entry; d < P.tIn; d += .5) if (pitEdges(d)[0] > edgeU) return d; return P.tIn; })();
  const gapTo = (() => { for (let d = P.exit; d > P.tOut; d -= .5) if (pitEdges(d)[0] > edgeU) return d; return P.tOut; })();
  { const gap = new THREE.Mesh(pitStrip(edgeU, inner, Y - .005, Y - .005, { from: gapFrom, to: gapTo, roadUv: true }), W.pitRoadMat); gap.receiveShadow = true; scene.add(gap); }   // (v276: the same road, not a flat grey)
  const skirt = M('#8e97a6', { roughness: .9, fog: !def.clearRoad });
  scene.add(new THREE.Mesh(pitStrip((d) => outer(d), (d) => outer(d) + 1.4, Y, -.45, { from: gapFrom, to: gapTo }), skirt));
  const guard = M('#c8d2e0', { roughness: .45, metalness: .35, fog: !def.clearRoad });
  // (the rail stops either side of the garage row: the garages stand right on the lane's edge)
  const g0 = P.bays[0] - 6.4, g1 = P.bays[P.bays.length - 1] + 6.4;
  for (const h of [.5, .95]) for (const [f0, f1] of [[P.entry + 14, g0], [g1, P.exit - 14]])
    scene.add(new THREE.Mesh(pitStrip((d) => outer(d) + .25, (d) => outer(d) + .25, h, h + .13, { from: f0, to: f1 }), guard));

  // 5. THE FIVE GARAGES (the user's own Le Mans pit-garage model), side by side along the far side of
  //    the lane, numbered 1 to 5 on their fascia panels; yours is number 3. Each bay is one instance of
  //    the merged model, so all five together cost about eighty draw calls, not twelve hundred. The two
  //    point lights the model carries are lit in your bay only — four more pairs would hurt a phone.
  const GAR = BASE.garages[def.id] || BASE.garage;
  if (GAR) {
    const bays = P.bays.map((ds, i) => {
      const frontU = pitEdges(ds)[1] + 1.0, q = pitPt(ds, frontU, 0), tpt = tp(pitIdxOf(ds));
      const exx = tpt.nx * P.side, exz = tpt.nz * P.side, ry = Math.atan2(-exz, exx);   // local +x = away from the track
      return { i, ds, frontU, x: q[0], y: q[1], z: q[2], s: 1, ry };
    });
    const paint = { col: [], tex: [], doors: [] }, gc = new THREE.Color(), mine = bays.filter((b) => b.i === P.me);
    // (v176, the user) only YOUR garage is open: the other four have their roller door down, and their insides are not drawn
    const doorTex = canvasTex(64, 128, (x) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 128); for (let y = 0; y < 128; y += 8) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, y, 64, 2); x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(0, y + 2, 64, 1); } x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 120, 64, 8); }, [6, 3]);
    const doorGeo = new THREE.BoxGeometry(.12, 3.5, 9.3);
    for (const b of bays) if (b.i !== P.me) { const d = new THREE.Mesh(doorGeo, new THREE.MeshStandardMaterial({ map: doorTex, color: '#c8ccd4', roughness: .5, metalness: .3 })); d.position.set(.32, 1.75, 0); const gp = new THREE.Group(); gp.position.set(b.x, b.y, b.z); gp.rotation.y = b.ry; gp.add(d); d.castShadow = true; d.receiveShadow = true; scene.add(gp); paint.doors.push({ mesh: d, bay: b.i }); }
    for (const { geo, mat, structural, tint } of GAR.parts) {
      if (!geo.boundingBox) geo.computeBoundingBox();
      const inside = !structural && geo.boundingBox.min.x >= .5, list = inside ? mine : bays;
      if (tint === 'tex') {   // purple painted into a texture: one mesh per bay, each with its own material to carry its own copy
        const meshes = bays.map((b) => { if (!list.includes(b)) return null; const m = new THREE.Mesh(geo, mat.clone()); m.position.set(b.x, b.y, b.z); m.rotation.y = b.ry; m.castShadow = !structural; m.receiveShadow = true; scene.add(m); return m; });
        paint.tex.push({ src: mat.map, meshes });
        continue;
      }
      const white = tint === 'col' ? mat.clone() : null; if (white) white.color.set('#ffffff');   // (the colour comes from the instance)
      const im = instanced(scene, geo, white || mat, list, !structural);
      if (structural) im.receiveShadow = true;
      if (white) { for (let i = 0; i < list.length; i++) im.setColorAt(i, gc.copy(mat.color)); im.instanceColor.needsUpdate = true; paint.col.push({ im, src: mat.color.clone(), bays: list.map((b) => b.i) }); }
    }
    W.garagePaint = paint;
    // the bay numbers, on the blank lit panel over each door
    for (const bay of bays) {
      const gp = pitGroup(scene, bay.ds, bay.frontU), t = pitBayTex(String(bay.i + 1));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(.95, .95), new THREE.MeshBasicMaterial({ map: t, fog: false, toneMapped: false }));
      m.position.set(GAR.panel.x - .04, GAR.panel.y, GAR.panel.z); m.rotation.y = -Math.PI / 2; gp.add(m);
      if (bay.i === P.me) for (const l of GAR.lights) {
        const pl = new THREE.PointLight(l.color, Math.min(l.intensity, 5), l.distance || 9, 2); pl.position.copy(l.pos); pl.castShadow = false; gp.add(pl);
      }
    }
  }
  const bayDs = P.bays[P.me];

  // 6. YOUR PIT BOX: a box of light on the lane, the only marked spot on the whole thing
  { const box = makePitBox(scene, pitIdxOf(bayDs) * STEP, P.bayU * P.side, Y + .02);
    W.pitBay = { ds: bayDs, u: P.bayU, box, t: 0, state: '', doneT: 0 }; }

  // 7. the signs: PIT and an arrow at the mouth, the limit where it starts, PIT LANE END at the far end
  const signPost = (ds, u, h, geo, mat, tilt = 0) => {
    const gp = pitGroup(scene, ds, u);
    const po = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, h, 8), M('#8e97a6', { roughness: .5, fog: !def.clearRoad }));
    po.position.y = h / 2; po.castShadow = true; gp.add(po);
    const m = new THREE.Mesh(geo, mat); m.position.set(0, h + (geo.parameters.height || 1) * .5 - .1, 0); m.rotation.y = -Math.PI / 2 + tilt; gp.add(m); return gp;
  };
  const boardMat = (txt, bg, fg) => { const t = pitBoardTex(txt, bg, fg); return new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: .25, roughness: .5, side: THREE.DoubleSide, fog: !def.clearRoad }); };
  signPost(P.entry + 6, pitEdges(P.entry + 6)[1] + 1.6, 2.1, new THREE.PlaneGeometry(3.4, 1.06), boardMat('PIT  >', '#1b2a4a', '#ffe14a'));
  signPost(P.entry - 34, HALF + 1.9, 2.1, new THREE.PlaneGeometry(3.4, 1.06), boardMat('PIT  >', '#1b2a4a', '#ffe14a'));
  signPost(P.entry + 26, pitEdges(P.entry + 26)[1] + 1.4, 2.1, new THREE.PlaneGeometry(3.4, 1.06), boardMat('PIT LANE', '#1b2a4a', '#ffe14a'));
  signPost(P.exit - 12, pitEdges(P.exit - 12)[1] + 1.6, 2.1, new THREE.PlaneGeometry(3.4, 1.06), boardMat('PIT LANE END', '#1f6a2a', '#ffffff'));
  // floodlights down the far side, so the lane reads as a built place and not a layby
  { const pole = new THREE.CylinderGeometry(.08, .11, 5.4, 8), poleM = M('#434b5a', { roughness: .5, metalness: .4, fog: !def.clearRoad });
    const head = new THREE.BoxGeometry(.5, .22, 1.3), headM = new THREE.MeshStandardMaterial({ color: '#2a3450', emissive: '#fff4d6', emissiveIntensity: .5, roughness: .6, fog: !def.clearRoad });
    for (const ds of [g0 - 2, g1 + 2]) {   // (v276: one at each end of the garage row; the lane is no longer than the row)
      const gp = pitGroup(scene, ds, pitEdges(ds)[1] + 4.6);
      const m = new THREE.Mesh(pole, poleM); m.position.y = 2.7; m.castShadow = true; gp.add(m);
      const h = new THREE.Mesh(head, headM); h.position.set(-.3, 5.3, 0); gp.add(h); } }

  // 8. THE HOLOGRAM BARRIER. A line of red light that starts at the far wall a long way before the
  //    entry and sweeps across the road to the mouth of the lane, so the only way on is through the
  //    pits. It shows only on the lap a stop is due, and a kart that runs into it is turned in, not
  //    stopped. Built along `gate(ds)`, a straight diagonal in (distance, sideways) space.
  { const gate = (d) => G0 + (G1 - G0) * clamp((d - P.gateFrom) / (P.gateTo - P.gateFrom), 0, 1);
    const grp = new THREE.Group(); grp.visible = false; scene.add(grp);
    const tex = pitGateTex(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    // unlit, so the bars read as light and draw the same on every phone; the gaps are a cut-out, not blending
    const barM = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: .45, side: THREE.DoubleSide, fog: false, toneMapped: false });
    const paneM = new THREE.MeshBasicMaterial({ color: '#ff3a4a', transparent: true, opacity: .14, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const footM = new THREE.MeshBasicMaterial({ color: '#ff0a22', fog: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -6 });
    const opt = { from: P.gateFrom, to: P.gateTo, uvLen: 2.3 };
    grp.add(new THREE.Mesh(pitStrip(gate, gate, .2, 2.85, opt), barM));
    grp.add(new THREE.Mesh(pitStrip(gate, gate, .2, 2.85, { from: P.gateFrom, to: P.gateTo }), paneM));
    grp.add(new THREE.Mesh(pitStrip((d) => gate(d) - .42, (d) => gate(d) + .42, .055, .055, { from: P.gateFrom, to: P.gateTo }), footM));
    // emitter posts along it, so the light has something to come out of
    for (let d = P.gateFrom; d <= P.gateTo; d += 9) {
      const q = pitPt(d, gate(d)), m = new THREE.Mesh(new THREE.CylinderGeometry(.15, .2, 3.05, 8), footM);
      m.position.set(q[0], q[1] + 1.52, q[2]); grp.add(m);
    }
    W.pitGate = { grp, from: P.gateFrom, to: P.gateTo, at: gate, mat: barM, pane: paneM, t: 0 };
  }
}

/* --- the roadside boxes, for a track that has no lane modelled yet (Robo City, Star Loop) --- */
function buildPitBoxes(scene, W, def) {
  const lat = Math.min(HALF - 2.2, 4.3), s0 = PIT_AT * TRACK.L, N = 5, ME = 2, LEN = 5.6;
  scene.add(new THREE.Mesh(trackQuad(s0 - (ME + .6) * LEN, s0 + (N - ME - .4) * LEN, lat - 2.4, Math.min(HALF - .15, lat + 2.4), .03, .03),
    M('#16203a', { roughness: .85, polygonOffset: true, polygonOffsetFactor: -2 })));
  const box = makePitBox(scene, s0, lat, .06);
  W.pitBay = { ds: dsOf(s0), u: null, lat, s: s0, box, t: 0, state: '', doneT: 0 };
}

/* --- where your bay is, in whichever of the two shapes this track uses --- */
const bayAhead = (r) => {   // metres still to go to your bay (big if it is behind you)
  const B = WORLD.pitBay; if (!B) return 1e9;
  const L = TRACK.L, s = B.s != null ? B.s : (((B.ds % L) + L) % L);
  return ((s - r.sc) % L + L) % L;
};
const bayLat = () => { const B = WORLD.pitBay; return B ? (B.u != null ? B.u * PITS.side : B.lat) : 0; };

/* --- every frame --- */
const _pitCol = new THREE.Color();
// the box's three states, and the confetti it throws as it turns green
// each bay in the colour of the racer it belongs to (bay i is racer i's: see bayDs in startRace)
function paintGarages() {
  const GP = WORLD && WORLD.garagePaint; if (!GP || !race) return;
  const gc = new THREE.Color();
  race.racers.forEach((r, i) => {
    const hex = GARAGE_COL[r.ch.id] || GARAGE_COL.foxino;
    for (const c of GP.col) { const k = c.bays ? c.bays.indexOf(i) : i; if (k >= 0 && k < c.im.count) c.im.setColorAt(k, garageShade(c.src, hex, gc)); }
    for (const d of GP.doors || []) if (d.bay === i) d.mesh.material.color.set(hex).lerp(new THREE.Color('#ffffff'), .25);   // (the door in the driver's colour)
    for (const t of GP.tex) if (t.meshes[i]) t.meshes[i].material.map = garageTex(t.src, hex);
  });
  for (const c of GP.col) c.im.instanceColor.needsUpdate = true;
}
function pitBoxState(st) {
  const B = WORLD.pitBay; if (!B) return;
  if (st === 'done' && B.state !== 'done') {
    const q = B.u != null ? pitPt(B.ds, B.u, .3) : (() => { const o = at(B.s, B.lat); return [o.x, o.y + .3, o.z]; })();
    pitConfetti(q[0], q[1], q[2]); sfx.fanfare();
  }
  B.state = st; B.doneT = st === 'done' ? 7 : 0;
}
/* (v277, the user: "make automatic driving into the pits faster and not that buggy… when I exit the pit it will bug my kart") the crew drives you
   along ONE smooth line, in and out: where the kart is depends only on how far it has come, so it cannot wobble, touch a wall or differ on a slow phone. */
function pitLineIn(P) { const from = Math.max(dsOf(P.sc), PITS.entry - 20); race.pitLine = { from, to: Math.max(PITS.tIn + 8, from + 25), a: null, b: bayLat() }; }
function pitLineOut() { race.pitLine = PITS ? { from: PITS.tOut - 12, to: PITS.exit + 6, a: bayLat(), b: 3 * PITS.side, out: true } : null; }
function pitLinePoint(L, s) {
  const ds = dsOf(s), lat = L.a + (L.b - L.a) * smoothstep(L.from, L.to, ds), f = s / STEP, i = Math.floor(f), u = f - i, A = tp(i), B = tp(i + 1);
  return { x: A.x + A.nx * lat + (B.x + B.nx * lat - A.x - A.nx * lat) * u, z: A.z + A.nz * lat + (B.z + B.nz * lat - A.z - A.nz * lat) * u };
}
function followPitLine(r, dt) {
  const L = race.pitLine; if (L.a == null) L.a = r.lat; if (L.s == null) L.s = r.sc;   // (its own distance: r.sc saw-tooths on a bend when the kart is far from the centre line)
  const P0 = pitLinePoint(L, L.s), P1 = pitLinePoint(L, L.s + 1.2), dx = P1.x - P0.x, dz = P1.z - P0.z, len = Math.hypot(dx, dz) || 1.2;   // (metres driven are metres on the line, not on the road's centre)
  const s = L.s += r.speed * dt * 1.2 / len, q = pitLinePoint(L, s);
  r.x = q.x; r.z = q.z; r.angle += wrapA(Math.atan2(dx, -dz) - r.angle) * Math.min(1, dt * 16);
  if (L.out && dsOf(s) >= L.to) race.pitLine = null;   // merged: yours again
}
function updatePit(dt) {
  const W = WORLD, B = W && W.pitBay; if (!W || !race) return;
  // the hologram barrier: on only while a stop is waiting, its bars scrolling downwards
  const G = W.pitGate;
  if (G) {
    const on = !!race.pitDue && race.started && !race.ended;
    G.grp.visible = false;   // (v176, the user: no barrier — the game steers you in instead)
    if (on) { G.t += dt; G.mat.map.offset.y = (G.t * .35) % 1; G.pane.opacity = .1 + Math.abs(Math.sin(G.t * 2.5)) * .11; }
  }
  if (!B) return;
  // (v199, the user: "the holographic box is still there after you start") your pit box only shows while a stop is due
  // or happening — not at the garage start, not for the rest of the race
  { const show = (!!race.pitDue || !!B.state || !!race.pitAuto) && race.started && !race.formation; if (B.box.grp.visible !== show) B.box.grp.visible = show; }
  const P = race.player, due = !!race.pitDue;
  B.t += dt;
  // the box: RED while it waits (breathing while a stop is due), YELLOW while you are standing in it,
  // GREEN when the crew have finished — then back to red a few seconds later, ready for the next stop
  if (B.doneT > 0 && (B.doneT -= dt) <= 0) B.state = '';
  const k = B.state ? 1 : due ? .6 + Math.abs(Math.sin(B.t * 3.1)) * .4 : .42;
  _pitCol.set(PIT_BOX_COL[B.state || 'wait']).multiplyScalar(k);
  for (const m of B.box.mats) m.color.copy(_pitCol);
  if (PITS && due && !race.pitAuto && !race.dialog && !race.ended && race.started && !P.finished) {
    const ds = dsOf(P.sc); if (ds > PITS.entry - 45 && ds < PITS.entry + 10) { race.pitAuto = true; pitLineIn(P); if (P.drift) endDrift(P); toast('PIT STOP\n<small>the crew is bringing you in</small>', '#4fc84a', 30); L.say('Pit stop! We bring you in.'); }
  }
  if (!due || race.ended || !race.started || race.dialog || P.finished || P.air) return;
  // the stop begins from ten metres out, if you are lined up with the box
  const d = bayAhead(P);
  // being level with your box counts wherever you are across the lane — the kart pulls into the paint
  // on its own as it brakes (the stop steers to the box's line), so hugging the pit wall is no trap
  // (v256, the user) the last 30 m in: the kart is guided onto the box's line while it still rolls forward and lines up
  // straight with the lane, so it drives into the MIDDLE of the box and stops there — no sideways shift at the end
  if (race.pitAuto && !race.pitLine && PITS && P.inPit && !race.pitHold && d < 30) {
    const p = tp(P.idx), k = Math.min(1, dt * (d < 12 ? 5 : 2.5)), dl = (bayLat() - P.lat) * k;
    P.x += p.nx * dl; P.z += p.nz * dl; P.lat += dl; P.angle += wrapA(angleOf(p) - P.angle) * Math.min(1, dt * 4);
  }
  if (race.pitAuto && PITS) { if ((d < .7 || d > TRACK.L - 2.2) && P.inPit) pitStop(); return; }   // (v256) the autopilot stops ON the middle
  if ((d < (PITS ? 16 : 10) || d > TRACK.L - 2.2) && (PITS ? P.inPit : Math.abs(P.lat - bayLat()) < 2.2)) pitStop();
}

/* ---------- (v162, the user) THE PIT CREW: four people in plain grey overalls and helmets come out to your kart
   when it stops and work while you answer — the right sets in the quiz drive what they do:
     MAINTENANCE and SPEED  → refuelling: the fuel man holds the nozzle in the filler, the hose runs to the fuel rig;
                              the two tyre men walk round the kart checking it, the jack man waits at the nose
     REPLACING TYRES        → the jack man pumps the jack and the kart rises; the tyre men kneel at the wheels
                              with wheel guns, pull each old tyre off and push a new one on, front then rear
     the board              → the kart comes down, everyone cheers
     after                  → they walk back towards the garage and are gone.
   Everything is placed in the kart's own frame (x across, z forward), with the garage side always at −x, and moves
   in real time (the race itself crawls in slow motion during the stop). Nothing here touches the race physics. --- */
const CREW_SPEED = 2.6;    // how fast they walk (m/s)
const CREW_LOOPS = { tyreR: [[1.45, 1.25], [1.45, -1.25]], tyreL: [[.75, -1.85], [-.55, -1.85]] };
const CREW_WHEEL = { x: .72, zf: .66, zr: -.7, y: .27 };   // where the wheels are round the kart's centre
let CREW_M = null;
function crewMats() {
  if (CREW_M) return CREW_M;
  CREW_M = { suit: M('#9aa0a9', { roughness: .8 }), suit2: M('#7d838c', { roughness: .8 }), helm: M('#c5cad1', { roughness: .3, metalness: .15 }), visor: M('#161b26', { roughness: .12, metalness: .5 }),
    boot: M('#3a3e46', { roughness: .9 }), glove: M('#4a4f58', { roughness: .85 }), rubber: M('#1d1f24', { roughness: .9 }), hub: M('#b8bec6', { roughness: .3, metalness: .7 }),
    steel: M('#8a9099', { roughness: .35, metalness: .6 }), rig: M('#e8403a', { roughness: .5 }), hose: M('#202228', { roughness: .7 }), jack: M('#ff8a1e', { roughness: .45 }) };
  for (const m of Object.values(CREW_M)) KEEP.add(m);
  return CREW_M;
}
// one person: a root on the ground (yaw), a body that can drop for kneeling, a spine that bends, two-part arms and legs
function crewMan(mt, G) {
  const root = new THREE.Group(), body = new THREE.Group(), spine = new THREE.Group(); root.add(body);
  const mesh = (g, m, parent, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  const joint = (parent, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };
  mesh(G.pelvis, mt.suit2, body, 0, .9, 0);
  spine.position.y = .94; body.add(spine);
  mesh(G.torso, mt.suit, spine, 0, .27, 0); mesh(G.belt, mt.suit2, spine, 0, .03, 0);
  mesh(G.neck, mt.suit2, spine, 0, .56, 0);
  const head = joint(spine, 0, .7, 0); mesh(G.helm, mt.helm, head); mesh(G.visor, mt.visor, head, 0, -.005, .1); mesh(G.chin, mt.helm, head, 0, -.1, .06);
  const arm = (s) => { const sh = joint(spine, s * .25, .5, 0); mesh(G.upper, mt.suit, sh); const el = joint(sh, 0, -.29, 0); mesh(G.fore, mt.suit, el); mesh(G.glove, mt.glove, el, 0, -.3, 0); const hand = joint(el, 0, -.33, 0); return { sh, el, hand }; };
  const leg = (s) => { const hip = joint(body, s * .1, .88, 0); mesh(G.thigh, mt.suit2, hip); const kn = joint(hip, 0, -.43, 0); mesh(G.shin, mt.suit2, kn); mesh(G.boot, mt.boot, kn, 0, -.41, .05); return { hip, kn }; };
  const L = arm(1), R = arm(-1), LL = leg(1), RL = leg(-1);   // (the model faces +z, so its left is +x)
  return { root, body, spine, head, armL: L, armR: R, legL: LL, legR: RL, pos: { x: 0, z: 0 }, yaw: 0, act: 'idle', t: Math.random() * 6, path: null, pi: 0, wait: 0 };
}
// the poses: a target angle for every joint, eased towards each frame
function crewPose(m, act, t, moving) {
  const P = { bodyY: 0, spine: 0, head: 0, hipL: 0, hipR: 0, knL: 0, knR: 0, shL: [0, .12], shR: [0, -.12], elL: 0, elR: 0 };
  if (moving) {   // walking
    const s = Math.sin(t * 9.5);
    P.hipL = s * .5; P.hipR = -s * .5; P.knL = Math.max(0, -s) * .7 + .08; P.knR = Math.max(0, s) * .7 + .08;
    P.shL = [-s * .45, .1]; P.shR = [s * .45, -.1]; P.elL = -.35; P.elR = -.35; P.bodyY = Math.abs(Math.cos(t * 9.5)) * .035; P.spine = .06;
    if (m.role === 'fuel') { P.shR = [-.7, -.1]; P.elR = -.9; }   // the fuel man carries the nozzle
    if (m.role === 'jack') { P.shL = [.2, .15]; P.shR = [.2, -.15]; P.elL = P.elR = -.1; }   // and the jack man pulls the jack behind him
    return P;
  }
  const b = Math.sin(t * 1.7) * .02;   // breathing
  if (act === 'fuel') { P.spine = .18; P.shR = [-1.05 + Math.sin(t * 2.2) * .04, -.15]; P.elR = -.55; P.shL = [-.85, .25]; P.elL = -.75; P.head = .25; P.knL = P.knR = .12; P.hipL = P.hipR = -.06; }
  else if (act === 'jack') { const pump = m.pump > 0 ? Math.sin(t * 7) : 0; P.spine = .55 + pump * .18; P.shL = [-.6 + pump * .3, .2]; P.shR = [-.6 + pump * .3, -.2]; P.elL = P.elR = -.15; P.hipL = -.35; P.hipR = .1; P.knL = .55; P.knR = .25; P.head = -.35; }
  else if (act === 'kneel') { const g = Math.sin(t * 34) * .04; P.bodyY = -.4; P.spine = .3; P.hipL = -1.45; P.knL = 1.5; P.hipR = .1; P.knR = 1.75; P.shL = [-1.25 + g, .15]; P.shR = [-1.15 - g, -.15]; P.elL = -.35; P.elR = -.45; P.head = .3; }
  else if (act === 'look') { P.spine = .45 + b; P.head = .3; P.shL = [-.2, .3]; P.shR = [-.2, -.3]; P.elL = P.elR = -.4; P.hipL = P.hipR = -.15; P.knL = P.knR = .2; }
  else if (act === 'cheer') { const w = Math.sin(t * 9); P.bodyY = Math.max(0, Math.sin(t * 6)) * .12; P.shL = [-2.9, .3 + w * .25]; P.shR = [-2.9, -.3 - w * .25]; P.elL = P.elR = -.25; P.head = -.25; }
  else { P.spine = b; P.shL = [.05, .1]; P.shR = [.05, -.1]; P.elL = P.elR = -.15; }
  return P;
}
function crewApply(m, P, k) {
  const e = (o, key, v) => { o[key] += (v - o[key]) * k; };
  e(m.body.position, 'y', P.bodyY); e(m.spine.rotation, 'x', P.spine); e(m.head.rotation, 'x', P.head);
  e(m.legL.hip.rotation, 'x', P.hipL); e(m.legR.hip.rotation, 'x', P.hipR); e(m.legL.kn.rotation, 'x', P.knL); e(m.legR.kn.rotation, 'x', P.knR);
  e(m.armL.sh.rotation, 'x', P.shL[0]); e(m.armL.sh.rotation, 'z', P.shL[1]); e(m.armR.sh.rotation, 'x', P.shR[0]); e(m.armR.sh.rotation, 'z', P.shR[1]);
  e(m.armL.el.rotation, 'x', P.elL); e(m.armR.el.rotation, 'x', P.elR);
}
function buildCrewModel(scene, D) {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const P = D.props, cl = (n) => (P[n] ? P[n].clone() : new THREE.Group()), SC = .78;
  const men = ['jack', 'fuel', 'tyreR', 'tyreL'].map((role, i) => {
    const gl = D.men[i], rigObj = gl.scene.getObjectByName('CrewRig') || gl.scene;
    rigObj.removeFromParent(); rigObj.position.set(0, 0, 0); rigObj.rotation.set(0, 0, 0);
    const root = new THREE.Group(); root.scale.setScalar(SC); root.add(rigObj); g.add(root);
    rigObj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    // (v180) four different people: their own skin tone and hair colour
    const SK = ['#f1c6a0', '#d9a07a', '#a8714a', '#7a4a2e'], HR = ['#5a3a22', '#1f150e', '#c8862e', '#2a2a2e'];
    rigObj.traverse((o) => { if (!o.isMesh) return; const mats = Array.isArray(o.material) ? o.material : [o.material];
      const re = mats.map((m) => (m && (m.name === 'Skin' || m.name === 'Hair') ? Object.assign(m.clone(), { name: m.name }) : m));
      re.forEach((m) => { if (m && m.name === 'Skin') m.color.set(SK[i % 4]); if (m && m.name === 'Hair') m.color.set(HR[i % 4]); if (m) KEEP.add(m); });
      o.material = Array.isArray(o.material) ? re : re[0]; });
    const mixer = new THREE.AnimationMixer(rigObj), acts = {}; for (const c of D.clips) acts[c.name] = mixer.clipAction(c);
    for (const n of ['walk', 'walk_carry', 'walk_jack']) if (acts[n]) acts[n].timeScale = 1.3;
    return { role, root, mixer, acts, cur: '', curA: null, pos: { x: 0, z: 0 }, yaw: 0, t: 0, path: null, pi: 0, wait: 0, handR: rigObj.getObjectByName('hand_R'), handL: rigObj.getObjectByName('hand_L') };
  });
  // a tool in the right glove: at the grip, pointing down the arm in the rest pose (so it follows the arm forwards)
  const grip = (m, obj) => {
    m.root.position.set(0, 0, 0); m.root.rotation.set(0, 0, 0); m.root.updateMatrixWorld(true);
    const h = m.handR; if (!h) return; const hq = new THREE.Quaternion(); h.getWorldQuaternion(hq);
    const want = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    obj.quaternion.copy(hq.invert().multiply(want)); obj.position.copy(h.worldToLocal(new THREE.Vector3(-.262, .875, .005).multiplyScalar(SC)));
    h.add(obj);
  };
  const F = men[1], nz = cl('PropNozzle'); grip(F, nz); F.nozzle = new THREE.Object3D(); F.nozzle.position.set(0, .01, -.08); nz.add(F.nozzle);
  for (const T of [men[2], men[3]]) grip(T, cl('PropGun'));
  // the trolley jack in front of the jack man, its saddle (it rises) and its handle (it pumps)
  const J = men[0]; { const jk = new THREE.Group(); jk.add(cl('PropJack')); const pad = cl('PropJackPad'); pad.position.set(0, .21, .3); jk.add(pad); J.jackPad = pad; J.padY = .21;
    const hd = cl('PropJackHandle'); hd.position.set(0, .17, -.3); hd.rotation.x = -1.0; jk.add(hd); J.jackHandle = hd; jk.position.set(0, 0, .72); J.root.add(jk); J.jack = jk; }
  // the spare tyres
  for (const T of [men[2], men[3]]) { T.oldTyre = cl('PropTyre'); T.newTyre = cl('PropTyre'); for (const t of [T.oldTyre, T.newTyre]) { t.visible = false; g.add(t); } }
  // the fuel rig and the hose from its reel
  const rig = cl('PropRig'); g.add(rig); const from = new THREE.Object3D(); from.position.set(0, .65, .3); rig.add(from);
  const hoseG = new THREE.CylinderGeometry(.03, .03, 1, 10).translate(0, .5, 0), hose = new THREE.Group(), mt = crewMats(), h1 = new THREE.Mesh(hoseG, mt.hose), h2 = new THREE.Mesh(hoseG, mt.hose); hose.add(h1, h2); g.add(hose);
  return { g, men, rig, hose, hoseA: h1, hoseB: h2, hoseFrom: from, on: false, phase: '', lift: 0, frame: null, t: 0, tyreT: 0, model: true };
}
function buildCrew(scene) {
  const CM = BASE.crews[TDEF.id] || BASE.crew; if (CM) { const c = buildCrewModel(scene, CM); c.outfit = BASE.crews[TDEF.id] ? TDEF.id : 'alps'; return c; }
  const mt = crewMats();
  const G = { pelvis: new THREE.BoxGeometry(.34, .2, .22), torso: new THREE.BoxGeometry(.42, .52, .25), belt: new THREE.BoxGeometry(.4, .08, .26), neck: new THREE.CylinderGeometry(.06, .07, .1, 8),
    helm: new THREE.SphereGeometry(.16, 14, 10).scale(1, 1.05, 1.12), visor: new THREE.SphereGeometry(.13, 14, 8, -1.05, 2.1, 1.05, .75).scale(1, 1, .9), chin: new THREE.BoxGeometry(.2, .07, .14),
    upper: new THREE.BoxGeometry(.12, .3, .12).translate(0, -.15, 0), fore: new THREE.BoxGeometry(.1, .3, .1).translate(0, -.15, 0), glove: new THREE.BoxGeometry(.11, .08, .12),
    thigh: new THREE.BoxGeometry(.15, .44, .16).translate(0, -.22, 0), shin: new THREE.BoxGeometry(.13, .42, .14).translate(0, -.21, 0), boot: new THREE.BoxGeometry(.14, .09, .26) };
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const men = ['jack', 'fuel', 'tyreR', 'tyreL'].map((role) => { const m = crewMan(mt, G); m.role = role; m.root.scale.setScalar(.82); g.add(m.root); return m; });   // (a touch under life size beside the little karts)
  // the fuel man's nozzle, the tyre men's wheel guns
  const F = men[1]; { const n = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(.09, .1, .2), mt.rig); b.position.z = .06; n.add(b); const p = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .32, 8).rotateX(Math.PI / 2), mt.steel); p.position.z = .3; n.add(p); n.rotation.x = Math.PI / 2; F.armR.hand.add(n); F.nozzle = p; }
  for (const T of [men[2], men[3]]) { const gun = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(.1, .14, .22), mt.jack); gun.add(b); const s = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .14, 8).rotateX(Math.PI / 2), mt.steel); s.position.z = .17; gun.add(s); gun.rotation.x = Math.PI / 2; T.armR.hand.add(gun); }
  // the jack: a low trolley that the jack man pulls along by its handle
  const J = men[0]; { const jk = new THREE.Group(); const base = new THREE.Mesh(new THREE.BoxGeometry(.32, .12, .7), mt.jack); base.position.y = .1; jk.add(base); for (const sx of [-.13, .13]) for (const sz of [-.28, .28]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .04, 10).rotateZ(Math.PI / 2), mt.rubber); w.position.set(sx, .05, sz); jk.add(w); }
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(.09, .1, .05, 12), mt.steel); pad.position.set(0, .2, .3); jk.add(pad); J.jackPad = pad;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.15, 8).translate(0, .575, 0), mt.steel); handle.position.set(0, .14, -.32); handle.rotation.x = -.95; jk.add(handle); J.jackHandle = handle;
    jk.position.set(0, 0, .7); J.root.add(jk); J.jack = jk; }
  // spare tyres: an old one comes off, a new one goes on (each tyre man has one of each)
  const tyreGeo = new THREE.CylinderGeometry(.27, .27, .22, 18).rotateZ(Math.PI / 2), hubGeo = new THREE.CylinderGeometry(.14, .14, .235, 12).rotateZ(Math.PI / 2);
  const mkTyre = () => { const t = new THREE.Group(); t.add(new THREE.Mesh(tyreGeo, mt.rubber), new THREE.Mesh(hubGeo, mt.hub)); t.traverse((o) => { o.castShadow = true; }); t.visible = false; g.add(t); return t; };
  for (const T of [men[2], men[3]]) { T.oldTyre = mkTyre(); T.newTyre = mkTyre(); }
  // the fuel rig (by the garage) and its hose
  const rig = new THREE.Group(); { const c = new THREE.Mesh(new THREE.BoxGeometry(.55, 1.5, .45), mt.rig); c.position.y = .75; rig.add(c); const t = new THREE.Mesh(new THREE.BoxGeometry(.6, .12, .5), mt.steel); t.position.y = 1.56; rig.add(t); const d = new THREE.Mesh(new THREE.BoxGeometry(.4, .3, .05), mt.visor); d.position.set(0, 1.15, .24); rig.add(d); rig.traverse((o) => { o.castShadow = true; }); }
  g.add(rig); const hoseFrom = new THREE.Object3D(); hoseFrom.position.y = 1.1; rig.add(hoseFrom);
  const hoseG = new THREE.CylinderGeometry(.035, .035, 1, 8).translate(0, .5, 0), hose = new THREE.Group(), h1 = new THREE.Mesh(hoseG, mt.hose), h2 = new THREE.Mesh(hoseG, mt.hose); hose.add(h1, h2); g.add(hose);
  return { g, men, rig, hose, hoseA: h1, hoseB: h2, hoseFrom, on: false, phase: '', lift: 0, frame: null, t: 0, tyreT: 0 };
}
// the kart's frame at the stop: where it is, which way it points, and which side the garage is on
function crewFrame(P) {
  const f = fwd(P.angle), r = { x: Math.cos(P.angle), z: Math.sin(P.angle) }, p = tp(P.idx);
  const gsW = PITS ? PITS.side : (Math.sign(P.lat) || 1);   // the garage / pit-box side across the road
  const gx = p.nx * gsW, gz = p.nz * gsW, s = (gx * r.x + gz * r.z) >= 0 ? 1 : -1;   // +1: the garage is on the kart's right
  return { x: P.x, y: P.y, z: P.z, f, r, mir: -s };   // local x is mirrored so that the garage side is always −x
}
// to cross to the other side of the kart, walk round its nose or its tail, never through it
function crewRoute(p, to) {
  const cross = Math.sign(p.x) !== Math.sign(to[0]) && Math.abs(p.x) > .3 && Math.abs(to[0]) > .3;
  if (!cross) return to;
  const zc = (p.z + to[1]) / 2 >= -.1 ? 2.6 : -2.6;
  if (Math.abs(p.z) < 2.45) return [Math.sign(p.x) * Math.max(1.35, Math.abs(p.x)), zc];
  return [to[0], zc];
}
const crewW = (F, lx, lz) => ({ x: F.x + F.r.x * lx * F.mir + F.f.x * lz, z: F.z + F.r.z * lx * F.mir + F.f.z * lz });
const crewYaw = (F, dx, dz) => { const w = { x: F.r.x * dx * F.mir + F.f.x * dz, z: F.r.z * dx * F.mir + F.f.z * dz }; return Math.atan2(w.x, w.z); };
// where each of them goes, and what they do there, in each part of the stop
function crewPlan(C, m) {
  const ph = C.phase, wx = CREW_WHEEL;
  if (ph === 'out') return { to: m.home, act: 'idle', face: [0, 1] };
  if (ph === 'board') return { to: m.slot || m.home, act: 'cheer', face: [m.slot ? -m.slot[0] : 0, m.slot ? -m.slot[1] : 1] };
  const tyres = ph === 'imm';
  if (m.role === 'jack') return { to: m.slot = [0, 1.95], act: tyres ? 'jack' : 'idle', face: [0, -1] };
  if (m.role === 'fuel') return tyres ? { to: m.slot = [-1.55, -1.9], act: 'idle', face: [1, 1] } : { to: m.slot = [-1.12, -.15], act: 'fuel', face: [1, 0] };
  const sx = m.role === 'tyreR' ? 1 : -1;
  if (tyres && C.wheels) {   // (v164) at the kart's real wheels on this side: front first, then rear; then stand back
    const mine = C.wheels.filter((w) => Math.sign(w.lx) === sx).sort((a, b) => b.lz - a.lz), w = mine[m.wi || 0];
    if (!w) { const last = mine[mine.length - 1] || { lx: sx * .7, lz: 0 }; return { to: m.slot = [last.lx + sx * .75, last.lz - .2], act: 'idle', face: [-sx, 0] }; }
    return { to: m.slot = [w.lx + sx * .58, w.lz], act: 'kneel', face: [-sx, 0], wheelRef: w };
  }
  if (tyres) { const front = (C.tyreT % 6) < 3, z = front ? wx.zf : wx.zr; return { to: m.slot = [sx * 1.22, z], act: 'kneel', face: [-sx, 0], wheel: [sx * wx.x, z] }; }
  // refuelling: they walk round the kart checking it (the right-hand man down the right side, the other round the back)
  const loop = CREW_LOOPS[m.role];
  if (m.path !== loop) { m.path = loop; m.pi = 0; m.wait = 0; }
  return { to: m.slot = loop[m.pi], act: 'look', face: sx > 0 ? [-1, 0] : [0, 1], patrol: true };
}
function crewWheelsReset(C) {
  if (!C || !C.wheels) return;
  for (const W of C.wheels) { W.s.visible = true; for (const o of [W.old, W.neu]) if (o) o.removeFromParent(); W.old = W.neu = null; W.done = false; W.rest = null; }
}
function crewStart() {
  const W = WORLD, P = race.player; if (!W) return;
  if (W.crew && (!W.crew.model || W.crew.outfit !== TDEF.id) && BASE.crews[TDEF.id]) { W.crew.g.removeFromParent(); W.crew = null; }
  const C = W.crew || (W.crew = buildCrew(W.scene));
  crewWheelsReset(C); C.wheels = null;
  const sp = P.model && P.model.spins;
  if (sp && sp.length === 4) { P.model.root.updateMatrixWorld(true); const F0 = crewFrame(P), v = new THREE.Vector3();
    C.wheels = sp.map((s) => { s.getWorldPosition(v); const dx = v.x - F0.x, dz = v.z - F0.z; return { s, lx: (dx * F0.r.x + dz * F0.r.z) * F0.mir, lz: dx * F0.f.x + dz * F0.f.z, y: v.y - F0.y, old: null, neu: null, rest: null, done: false }; }); }
  C.frame = crewFrame(P); C.player = P; race.pitPhase = null; C.on = true; C.phase = 'fix'; C.lift = 0; C.t = 0; C.tyreT = 0; C.g.visible = true;
  const homes = { jack: [-4.6, 1.6], fuel: [-4.4, .2], tyreR: [-4.8, -1.0], tyreL: [-4.3, -2.2] };
  for (const m of C.men) { m.wi = 0; m.wk = 0; m.home = homes[m.role]; m.pos = { x: m.home[0], z: m.home[1] }; m.path = null; m.slot = null; m.yaw = 0; m.pump = 0; m.root.visible = true; }
  const rp = crewW(C.frame, -3.0, -.35); C.rig.position.set(rp.x, C.frame.y, rp.z); C.rig.rotation.y = crewYaw(C.frame, 1, 0); C.rig.visible = C.hose.visible = true;
}
const _cm = new THREE.Matrix4(), _cm2 = new THREE.Matrix4(), _cax = new THREE.Vector3();
const _cw = new THREE.Vector3(), _cw2 = new THREE.Vector3(), _cw3 = new THREE.Vector3(), _cw4 = new THREE.Vector3(), _cup = new THREE.Vector3(0, 1, 0);
function updateCrew(dt) {
  glowTick(dt);   // (v253) the glow on the part being worked on
  upFxTick(dt);   // (v267) the pit upgrades on your kart
  wingTick(dt);   // (v270) the rear wing popping on
  tyreTick(dt);   // (v274) the tyres popping on
  const W = WORLD, C = W && W.crew; if (!C) return;
  if (!race || !C.on || C.player !== race.player) { crewWheelsReset(C); if (C.g.visible) C.g.visible = false; C.on = false; if (race) race.pitLift = 0; return; }
  dt = Math.min(dt, .05); C.t += dt;
  C.phase = race.pitPhase || C.phase; if (C.phase === 'imm') C.tyreT += dt;
  if (C.wheels && C.phase !== 'imm') for (const W of C.wheels) if (W.old && !W.done) { if (W.neu) { W.neu.removeFromParent(); W.neu = null; } W.s.visible = true; W.done = true; }
  const F = C.frame; let allHome = true;
  for (const m of C.men) {
    const plan = crewPlan(C, m), go = crewRoute(m.pos, plan.to), dx = go[0] - m.pos.x, dz = go[1] - m.pos.z, d = Math.hypot(dx, dz), moving = d > .06;
    m.t += dt;
    if (moving) { const st = Math.min(d, CREW_SPEED * dt); m.pos.x += dx / d * st; m.pos.z += dz / d * st; m.yaw += wrapA(crewYaw(F, dx, dz) - m.yaw) * Math.min(1, dt * 10); }
    else {
      m.yaw += wrapA(crewYaw(F, plan.face[0], plan.face[1]) - m.yaw) * Math.min(1, dt * 8);
      if (plan.patrol && (m.wait += dt) > 1.4) { m.wait = 0; m.pi = (m.pi + 1) % m.path.length; }
    }
    if (C.phase === 'out' && d > .3) allHome = false;
    m.pump = plan.act === 'jack' && !moving ? Math.max(0, (m.pump || 0) + dt) : 0;
    if (m.mixer) {
      const clip = moving ? (m.role === 'fuel' ? 'walk_carry' : m.role === 'jack' ? 'walk_jack' : 'walk') : (m.acts[plan.act] ? plan.act : 'idle');
      if (m.cur !== clip) { const a = m.acts[clip]; if (a) { a.reset().setEffectiveWeight(1).fadeIn(.22).play(); if (m.curA) m.curA.fadeOut(.22); m.curA = a; m.cur = clip; } }
      m.mixer.update(dt);
      if (m.jackHandle) m.jackHandle.rotation.x = -1.0 + (m.cur === 'jack' && m.curA ? Math.sin(m.curA.time / .9 * Math.PI * 2) * .2 : 0);
    } else crewApply(m, crewPose(m, moving ? 'walk' : plan.act, m.t, moving), Math.min(1, dt * 12));
    const w = crewW(F, m.pos.x, m.pos.z); m.root.position.set(w.x, F.y, w.z); m.root.rotation.y = m.yaw;
    // the old tyre comes off and goes down beside the man, then the new one goes on
    if (plan.wheelRef) {
      // (v164, the user) the real thing: the kart's own wheel comes off and is set down on the floor, and an exact copy
      // of it (the new set) is carried in and fitted; then the kart's wheel shows again. 3 s a wheel.
      const W = plan.wheelRef, work = plan.act === 'kneel' && !moving;
      if (work) {
        const k = (m.wk = (m.wk || 0) + dt / 3), side = { x: F.r.x * F.mir * Math.sign(W.lx), z: F.r.z * F.mir * Math.sign(W.lx) };
        const put = (obj, out, down) => { obj.matrix.copy(W.s.matrixWorld); const e = obj.matrix.elements; e[12] += side.x * out; e[13] -= down; e[14] += side.z * out; obj.matrixWorldNeedsUpdate = true; };
        if (k > .18 && !W.old) { W.old = W.s.clone(true); W.old.visible = true; W.old.matrixAutoUpdate = false; C.g.add(W.old); W.s.visible = false; }
        if (W.old && !W.rest) {
          // pulled straight out along the axle, then laid flat on the floor a little behind the tyre man
          const t = smoothstep(.42, .6, k), out = smoothstep(.18, .42, k) * .62 + t * .16, back = t * .45, M = W.old.matrix, e = W.s.matrixWorld.elements;
          const cx = e[12], cy = e[13], cz = e[14], tx = cx + side.x * out - F.f.x * back, tz = cz + side.z * out - F.f.z * back, ty = cy + (F.y + .12 - cy) * t;
          M.makeTranslation(-cx, -cy, -cz).premultiply(_cm.makeRotationAxis(_cax.set(F.f.x, 0, F.f.z).normalize(), t * Math.PI / 2 * Math.sign(W.lx))).premultiply(_cm2.makeTranslation(tx, ty, tz)).multiply(W.s.matrixWorld);
          W.old.matrixWorldNeedsUpdate = true;
          if (k >= .6) W.rest = true;   // (and there it stays, while the kart comes down)
        }
        if (k > .5 && !W.done) {
          if (!W.neu) { W.neu = W.s.clone(true); W.neu.visible = true; W.neu.matrixAutoUpdate = false; C.g.add(W.neu); }
          put(W.neu, (1 - smoothstep(.5, .8, k)) * .62, 0);
          if (k > .8) { W.neu.removeFromParent(); W.neu = null; W.s.visible = true; W.done = true; }
        }
        if (k >= 1) { m.wi = (m.wi || 0) + 1; m.wk = 0; }
      }
    } else if (m.oldTyre) {
      const work = plan.act === 'kneel' && !moving, k = (C.tyreT % 3) / 3;
      m.oldTyre.visible = work && k > .2 && k < .62; m.newTyre.visible = work && k > .5 && k < .9;
      if (work) {
        const [wxL, wzL] = plan.wheel, sx = Math.sign(wxL), out = (q) => crewW(F, wxL + sx * q, wzL), yaw = crewYaw(F, 0, 1);
        const qo = clamp((k - .2) / .2, 0, 1) * .55, po = out(qo); m.oldTyre.position.set(po.x, F.y + CREW_WHEEL.y + C.lift * .9 - clamp((k - .42) / .2, 0, 1) * .05, po.z); m.oldTyre.rotation.set(0, yaw, 0);
        const qn = (1 - clamp((k - .55) / .25, 0, 1)) * .55, pn = out(qn); m.newTyre.position.set(pn.x, F.y + CREW_WHEEL.y + C.lift * .9, pn.z); m.newTyre.rotation.set(0, yaw, 0);
      }
    }
  }
  // the jack lifts the kart while the tyres are changed (after a few pumps), and lets it down for the board
  const J = C.men[0], lifted = C.phase === 'imm' && J.pump > .7;
  C.lift += ((lifted ? .2 : 0) - C.lift) * Math.min(1, dt * 5); race.pitLift = C.lift;
  if (J.jackPad) J.jackPad.position.y = (J.padY ?? .2) + C.lift * (C.model ? 1.15 : .9);
  // the hose: from the rig to the fuel man's nozzle
  { const N = C.men[1].nozzle; N.getWorldPosition(_cw); C.hoseFrom.getWorldPosition(_cw2);
    const mid = _cw3.copy(_cw).add(_cw2).multiplyScalar(.5); mid.y = Math.max(C.frame.y + .08, Math.min(_cw.y, _cw2.y) - .45);   // (it sags in the middle)
    const seg = (h, a, b) => { const v = _cw4.copy(b).sub(a), len = v.length(); h.position.copy(a); h.scale.set(1, Math.max(.01, len), 1); h.quaternion.setFromUnitVectors(_cup, v.normalize()); };
    seg(C.hoseA, _cw2, mid); seg(C.hoseB, mid, _cw); }
  // after the stop they walk back, and then they are gone (the rig goes with them)
  if (C.phase === 'out') { C.outT = (C.outT || 0) + dt; if (allHome || C.outT > 4) { crewWheelsReset(C); C.on = false; C.g.visible = false; race.pitLift = 0; } } else C.outT = 0;
}

// the stop: the kart rolls to a halt on the paint, the race freezes, and the crew asks three sets of three
function pitStop() {
  const P = race.player, R0 = race;
  race.pitDue = false; race.dialog = 'pitstop'; race.pitBrake = true; race.slowTarget = 1;
  P.boostT = 0; P.fireT = 0; P.boostMul = 1; P.spinT = 0; P.slideT = 0;   // however you came in, you come in clean
  race.steerTo = null; race.steerGate = null; race.holdLat = bayLat(); if (P.drift) endDrift(P);
  sfx.pad(); buzz(30); toast('PIT STOP!', '#ffc324', 44); drawPitHud(); pitBoxState('work');
  const brake = () => {
    if (race !== R0) return;
    if (P.speed > .5) { setTimeout(brake, 40); return; }
    P.speed = 0; race.pitBrake = false; race.pitHold = true; race.pitLine = null; race.slowTarget = .02; Snd.skid(0);
    sfx.power(); L.say('Pit stop! Quick questions!');
    const bay = pitBayAt(); if (bay) settleInBox(P, bay.s, bay.lat, () => { if (race === R0 && race.pitHold) crewStart(); }); else crewStart();   // (v189) the exact middle of the box, then the crew come out (v162)
    runQuiz([['fix', TUNE.pitN], ['spd', TUNE.pitN], ['imm', TUNE.pitN]], 'PIT STOP', (got) => {
      if (race !== R0) return;
      race.dialog = null; race.pitHold = false; race.slowTarget = 1; race.learn.pits++; race.pitAuto = false; pitLineOut(); { const G = P.model && P.model.glow; if (G) { G.want = 0; G.k = 0; G.s.visible = false; } if (WORLD.crew) crewWheelsReset(WORLD.crew); }   /* (v278: nothing of the stop stays on the kart as it leaves) */   // (v277: the crew sends you out along the line and hands you the wheel once you have merged)
      race.pitPhase = 'out'; pitBoxState('done'); giveBoost(P, 1.5, 1.5); sfx.turbo(2); drawPitHud();
    }, kitOnAns(P, R0));   // (v271) the pit stop's right SPEED answers grow the wing too (v274: and right TYRES answers the tyres)
  };
  setTimeout(brake, 40);
}
// A run of swift questions in sets. Each set is scored as a PERCENTAGE made of PRECISION and SPEED
// (the user): a right answer is worth 60 % on its own and up to 35 % more for how much of the clock was
// still running, so a flawless, instant set is 95 % and 100 % is out of reach by design. A wrong answer,
// or one the clock beat you to, is worth nothing.
const PIT_RIGHT = .6, PIT_FAST = .35;
// (v206) a burst of paper confetti from a button or a row (the page, not the 3D world)
const CONF_COL = ['#ffe14a', '#ff5db1', '#4fd8ff', '#4fc84a', '#ff8a1e', '#b07aff'];
function confettiAt(el, n = 24, spread = 1) {
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let k = 0; k < n; k++) {
    const d = document.createElement('i'), a = -Math.PI / 2 + (Math.random() - .5) * 2.4 * spread, v = 160 + Math.random() * 260, w = 6 + Math.random() * 6;
    d.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:${w}px;height:${w * .6}px;background:${CONF_COL[k % CONF_COL.length]};border-radius:2px;z-index:9999;pointer-events:none`;
    document.body.appendChild(d);
    const dx = Math.cos(a) * v, dy = Math.sin(a) * v, rot = (Math.random() - .5) * 900;
    const an = d.animate([{ transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 }, { transform: `translate(calc(-50% + ${dx * .7}px), calc(-50% + ${dy * .7}px)) rotate(${rot * .6}deg)`, opacity: 1, offset: .55 }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 260}px)) rotate(${rot}deg)`, opacity: 0 }], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.4,1)' });
    an.onfinish = () => d.remove();
  }
}
function runQuiz(sets, tag, onDone, onAns = null) {
  const P = race.player, R0 = race, lr = race.learn, D = $('dialog'), got = {};
  if (QDEV()) {   // (v250, the user: "dev mode removes all the questions") the crew just does the job: a short stop, full marks
    // (v255, the user: "in dev mode the pit stop counts as if all 9 questions were right — all the boosts") every set is a
    // PERFECT 100 % (the most a stop can give), the parts light up as the crew works, and the board shows it before you go
    const pct = {}; sets.forEach(([k, n], i) => { pct[k] = 100; setTimeout(() => { if (race !== R0) return; race.pitPhase = k; race.quizK = k; partGlow(P, (PART_GLOW[k] || [])[0]); }, i * 700); for (let a = 0; a < n; a++) setTimeout(() => { if (race === R0) pitUpFx(P, k, a, true, !!(onAns && onAns(k, a, true))); }, i * 700 + 150 + a * 180); });
    setTimeout(() => {
      if (race !== R0) return; partGlow(P, null); race.pitPhase = 'board'; race.quizK = null; D.hidden = false;
      pitScoreCard(D, sets.map(([k]) => k), pct, tag, () => {
        if (race !== R0) return;
        closeDialog(); Music.duck(false);
        for (const k in pct) pitAward(P, k, pct[k]);
        drawPitHud(); onDone(pct);
      });
    }, sets.length * 700 + 300);
    return;
  }
  for (const [k] of sets) got[k] = { sum: 0, n: 0, res: [] };
  const flat = []; for (const [k, n] of sets) for (let i = 0; i < n; i++) flat.push({ k, i, n });
  Music.duck(true); D.hidden = false;
  const step = (j) => {
    if (race !== R0) return;
    if (j >= flat.length) {
      const pct = {}; for (const k in got) pct[k] = Math.round(got[k].sum / Math.max(1, got[k].n) * 100); race.pitPhase = 'board'; race.quizK = null;
      pitScoreCard(D, sets.map(([k]) => k), pct, tag, () => {
        if (race !== R0) return;
        closeDialog(); Music.duck(false);
        for (const k in pct) pitAward(P, k, pct[k]);
        drawPitHud(); onDone(pct);
      });
      return;
    }
    const q = flat[j], S = PIT_SETS[q.k]; race.pitPhase = q.k; race.quizK = q.k;   // (v273: quizK = what the camera shows)   // (v162) the crew work on what is being asked
    partGlow(P, (PART_GLOW[q.k] || [])[q.i % 4]);   // (v253) that part of the kart lights up yellow
    if (q.i === 0 && j) L.say(S.say);
    const it = L.pickPit(TDEF.words || TDEF.id, 1, lr)[0]; lr.asked.push(it.id); lr.askedAt[it.id] = lr.asked.length;
    D.innerHTML = '<div class="veil pit"></div>';
    questionCard(D.firstChild, `${tag} · ${S.name}`, L.makeQuestion(it), (ok, fast) => {
      const g = got[q.k]; g.n++; g.res.push(!!ok); if (ok) g.sum += PIT_RIGHT + PIT_FAST * clamp(fast || 0, 0, 1);
      pitUpFx(P, q.k, q.i, !!ok, !!(onAns && onAns(q.k, q.i, !!ok)));   // (v267) the upgrade goes onto your kart as you answer (v270: the garage's wing takes over the label)
      partGlow(P, null); step(j + 1);
    }, TUNE.pitSecs + (L.level() === 0 ? 2 : 0), null, tag !== 'GARAGE' && 'oneSec');   // (v302, the user: after a wrong pit answer only a 1 s wait, then the next one)   // (v273, the user: the start doesn't wait for the clock after a wrong answer; pit stops still do)
    // (v160) where you are in the set: three dots in the set's colour; the phone sheet slides up only on the first card
    const card = D.querySelector(".qcard"), top = card && card.querySelector(".qtop");
    if (top) top.insertAdjacentHTML("afterbegin", `<div class="qprog" style="--c:${S.col}">${Array.from({ length: q.n }, (_, k) => `<i class="${k < q.i ? (got[q.k].res[k] ? "done ok" : "done no") : k === q.i ? "now" : ""}"></i>`).join("")}</div>`);
    if (card && j === 0) card.classList.add("enter");
  };
  step(0);
}
// the board at the end of a stop: one little tab per field, each loading up to its percentage in turn,
// and then you are let go
function pitScoreCard(D, keys, pct, tag, done) {
  D.innerHTML = `<div class="veil pit"><div class="card pscore"><div class="tag">${tag} · DONE</div><div class="prows">${keys.map((k) => {
    const S = PIT_SETS[k];
    return `<div class="prow" style="--c:${S.col}">${ico(S.icon, 'pico')}<i>${S.name}</i><span class="pbar"><b></b></span><em>0%</em><u class="pv"></u></div>`;
  }).join('')}</div></div></div>`;
  const rows = [...D.querySelectorAll('.prow')];
  rows.forEach((row, i) => setTimeout(() => {
    if (!row.isConnected) return;
    const b = row.querySelector('.pbar b'), em = row.querySelector('em'), p = pct[keys[i]];
    row.classList.add('on'); b.style.width = `${p}%`; sfx.spark(Math.max(1, Math.min(3, Math.ceil(p / 34))));
    // (v206, the user: "make the loading up significant — something they notice and are proud of, or not")
    const t0 = performance.now(), run = () => { if (!em.isConnected) return; const k = Math.min(1, (performance.now() - t0) / 700); em.textContent = `${Math.round(p * k)}%`; if (k < 1) requestAnimationFrame(run);
      else { const v = row.querySelector('.pv'), lv = p >= 100 ? 'perfect' : p >= 67 ? 'great' : p >= 34 ? 'ok' : 'low';
        v.textContent = { perfect: 'PERFECT!', great: 'GREAT!', ok: 'OK', low: 'OH NO…' }[lv]; row.classList.add('done', 'lv-' + lv);
        if (lv === 'perfect') { confettiAt(row, 36, 1.4); sfx.fanfare(); } else if (lv === 'great') { confettiAt(row, 16); sfx.coin(); } else if (lv === 'low') sfx.wrong(); } };
    run();
  }, 180 + i * 900));
  setTimeout(done, 180 + keys.length * 900 + 900);
}
/* (v253, the user) THE PART BEING FIXED LIGHTS UP: while you answer a pit question, the part of your kart the crew is
   working on glows yellow (a soft pulsing light on the 3D kart, seen through the body); when the question is done it
   fades back to normal. MAINTENANCE: engine, steering, nose; SPEED: engine and exhaust; REPLACING TYRES: each wheel. */
const PART_GLOW = { fix: ['engine', 'steer', 'nose', 'engine'], spd: ['engine', 'exhaust', 'engine', 'exhaust'], imm: ['fl', 'fr', 'rl', 'rr'] };
let GLOW_TEX = null;
function partSpot(m, part) {
  const B = m.body, v = new THREE.Vector3(); B.updateMatrixWorld(true);
  const W = (m.spins || []).map((s) => B.worldToLocal(s.getWorldPosition(new THREE.Vector3())));
  if (W.length < 4) {   // the starship: no wheels, use its box
    const bx = new THREE.Box3().setFromObject(B), c = B.worldToLocal(bx.getCenter(new THREE.Vector3())), h = (bx.max.y - bx.min.y) / 2;
    return { engine: c.clone().setY(c.y + h * .3), exhaust: c.clone(), steer: c.clone().setY(c.y + h * .5), nose: c.clone() }[part] || c;
  }
  const F = (m.fronts || []).map((f) => B.worldToLocal(f.getWorldPosition(new THREE.Vector3())));
  const az = W.reduce((a, w) => a + w.z, 0) / 4, fz = F.length ? F.reduce((a, w) => a + w.z, 0) / F.length : az + 1, nz = fz >= az ? 1 : -1;
  const front = W.filter((w) => (w.z - az) * nz > 0).sort((a, b) => a.x - b.x), rear = W.filter((w) => (w.z - az) * nz <= 0).sort((a, b) => a.x - b.x);
  const y0 = W.reduce((a, w) => a + w.y, 0) / 4, zf = front.length ? front[0].z : az + nz * .7, zr = rear.length ? rear[0].z : az - nz * .7;
  switch (part) {
    case 'fl': return front[0] || v; case 'fr': return front[1] || front[0] || v;
    case 'rl': return rear[0] || v; case 'rr': return rear[1] || rear[0] || v;
    case 'engine': return v.set(0, y0 + .3, zr + (zf - zr) * .08);
    case 'exhaust': return v.set(0, y0 + .12, zr - (zf - zr) * .12);
    case 'steer': return v.set(0, y0 + .42, az + (zf - az) * .35);
    case 'nose': return v.set(0, y0 + .02, zf + (zf - zr) * .22);
  }
  return v;
}
function partGlow(P, part) {
  const m = P && P.model; if (!m || !m.body) return;
  if (!m.glow) {
    GLOW_TEX = GLOW_TEX || canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 62); r.addColorStop(0, 'rgba(255,250,200,1)'); r.addColorStop(.25, 'rgba(255,214,50,.9)'); r.addColorStop(.6, 'rgba(255,170,0,.35)'); r.addColorStop(1, 'rgba(255,150,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
    s.renderOrder = 998; s.visible = false; m.body.add(s); m.glow = { s, k: 0, want: 0, t: 0, size: .9 };
  }
  const G = m.glow; G.want = part ? 1 : 0;
  if (part) { G.s.position.copy(partSpot(m, part)); G.size = /^[fr][lr]$/.test(part) ? .85 : part === 'steer' ? .7 : 1; G.part = part; }
}
function glowTick(dt) {
  const P = race && race.player, G = P && P.model && P.model.glow; if (!G) return;
  if (!(race.dialog === 'pitstop' || race.pitHold)) G.want = 0;   // never left on after a stop
  G.k += (G.want - G.k) * Math.min(1, dt * (G.want ? 10 : 5)); G.t += dt;
  const on = G.k > .02; G.s.visible = on; if (!on) return;
  G.s.material.opacity = G.k * (.75 + .25 * Math.sin(G.t * 7)); G.s.scale.setScalar(G.size * (1 + .12 * Math.sin(G.t * 7)));
}
/* (v267, the user: "make the pit stop upgrades visible on your kart while you are answering the question, so you get
   more of the feeling") every RIGHT answer bolts its upgrade onto your 3D kart there and then, and it stays for the race:
   REPLACING TYRES — that wheel gets a glowing cyan tyre ring (the third answer does both rear wheels; a starship gets a
   shield halo); SPEED — a chrome exhaust with a flickering flame (up to three); MAINTENANCE — a rear spoiler that grows
   and turns from yellow to orange to gold. A wrong answer only puffs grey smoke off that part. */
const UPFX_MAT = {};
const upMat = (c, e = .3, glow = false) => UPFX_MAT[c + e + glow] || (UPFX_MAT[c + e + glow] = glow ? new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .95, depthWrite: false, toneMapped: false }) : new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: e, roughness: .35, metalness: .2 }));
// a little label that pops up off the part and floats away: +GRIP, +SPEED, NEW TYRE
function upLabel(m, at, text, col) {
  const cv = document.createElement('canvas'), F = '52px "Luckiest Guy", Fredoka, Arial'; let g = cv.getContext('2d'); g.font = F; const W = Math.max(256, Math.ceil(g.measureText(text).width) + 24);   // (v270: long wing names get a wider label)
  cv.width = W; cv.height = 72; g = cv.getContext('2d'); g.font = F; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = '#1b1f3a'; g.strokeText(text, W / 2, 40); g.fillStyle = col; g.fillText(text, W / 2, 40);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
  sp.renderOrder = 999; sp.scale.set(1.1 * W / 256, .31, 1); sp.position.copy(at).add(new THREE.Vector3(0, .5, 0)); m.ups.add(sp); m.ups.userData.labels.push({ sp, t: 0 });
}
function pitUpFx(P, k, i, ok, quiet = false) {
  const m = P && P.model; if (!m || !m.body) return; const B = m.body; B.updateMatrixWorld(true);
  const spot = (part) => partSpot(m, part).clone();
  if (!ok) { const w = B.localToWorld(spot((PART_GLOW[k] || [])[i % 4] || 'engine')); for (let n = 0; n < 7; n++) puff(w.x, w.y + .25, w.z, '#8a8a92', rand(.25, .45), rand(.5, .8), rand(-.7, .7), rand(.8, 1.6), rand(-.7, .7)); return; }
  upFxOf(m);
  const U = m.ups.userData, ship = (m.spins || []).length < 4, ws = B.getWorldScale(new THREE.Vector3()).y || 1;
  const pop = (o) => { o.scale.setScalar(.01); U.pops.push({ o, t: 0 }); m.ups.add(o); return o; };
  const bx = new THREE.Box3().setFromObject(B), bc = B.worldToLocal(bx.getCenter(new THREE.Vector3())), bs = bx.getSize(new THREE.Vector3()).divideScalar(ws);
  const eng = spot('engine'), ex = spot('exhaust'), back = ship ? -1 : Math.sign(ex.z - spot('nose').z) || 1;
  if (k === 'imm') {
    if (!quiet) upLabel(m, ship ? bc : spot(['fl', 'fr', 'rl'][i % 3]), 'NEW TYRE', '#59d8ff');
    U.imm++;   // (v268, the user: the tyre rings are gone for now; only the label shows)
  } else if (k === 'spd') {
    if (!quiet) upLabel(m, ship ? bc : ex, '+SPEED', '#ff8a1e');
    if (U.spd >= 3) { U.spd++; U.flameK = Math.min(1.45, 1 + (U.spd - 3) * .1); for (const q of U.flames) U.pops.push({ o: q.userData.g, t: 0, from: 1.3 }); if (!quiet) sfx.spark(3); return; }   // more than three: the flames grow
    const xs = [-.17, .17, 0], x = xs[U.spd % 3], g = new THREE.Group(), gi = new THREE.Group(); g.add(gi);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(.065, .08, .3, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c8ccd8', roughness: .2, metalness: .95 })); if (!ship) gi.add(pipe);   // (a starship's flames come out of its own engines)
    const fl = new THREE.Mesh(new THREE.ConeGeometry(.075, .42, 10).rotateX(back * Math.PI / 2).translate(0, 0, back * .34), upMat('#ff6a00', 0, true)); gi.add(fl); fl.userData.g = g;
    const core = new THREE.Mesh(new THREE.ConeGeometry(.04, .24, 8).rotateX(back * Math.PI / 2).translate(0, 0, back * .26), upMat('#ffd84a', 0, true)); gi.add(core); core.userData.g = g;
    g.position.set(ship ? bc.x + [-.43, .43, 0][U.spd % 3] * bs.x : x, ship ? bc.y - bs.y * .3 : ex.y + .02, ship ? bc.z + back * bs.z * .4 : ex.z + back * .05); pop(g); U.flames.push(fl, core); U.spd++;
  } else {
    if (!quiet) upLabel(m, ship ? bc : eng, '+GRIP', '#ffc324');
    U.fix++;   // (v268, the user: the rear wing is gone for now; only the label shows)
  }
  if (!quiet) sfx.spark(Math.min(3, (U[k] || 1)));
}
// the group on your kart that holds the pit upgrades and their floating labels
function upFxOf(m) { if (!m.ups) { m.ups = new THREE.Group(); m.body.add(m.ups); m.ups.userData = { fix: 0, spd: 0, imm: 0, flames: [], pops: [], wing: null, rings: {}, labels: [] }; } return m.ups.userData; }
/* (v270, the user: "change the start 3×4 questions to 3×3 … there are 9 rear wings; you start without the wing and each
   time you answer right to one of the 9 questions the wing will upgrade to the next one") REAR WINGS AT THE START: your
   go-kart comes to the garage with a bare rear deck; every RIGHT garage answer (any of the three sets) bolts on the next
   wing — Duck Tail → Rookie → Arrow → Hoop → Stingray → Twin Jet → Stacker → Razor → Comet — with a pop, sparks, its name
   and the spark sound. A wrong answer leaves it. It stays on for the race; the next race starts bare (a new kart).
   Only your go-kart: not the rivals, not the starship. The wings come from rear-wings.js (the other session's builder,
   in kart-default.glb space, so they go on the dressed kart `m.kart`, painted with your own look). */
function wingDispose(o, keep) {
  const tex = (t) => { if (t && !keep.has(t)) t.dispose(); };
  o.traverse((n) => { if (n.isMesh) { n.geometry.dispose(); [].concat(n.material).forEach((mt) => { tex(mt.map); tex(mt.emissiveMap); mt.dispose(); }); } });
}
// (v271, the user) the rear wing grows ONLY with right SPEED answers: 3 at the start + 3 at each of the 2 pit stops = 9 wings
const wingOnAns = (P, R0) => (k, i, ok) => (ok && k === 'spd' && race === R0 ? setWing(P, Math.min(REAR_WINGS.length, ((P.model && P.model.wingLv) || 0) + 1)) : false);
function setWing(P, lv, fx = true) {
  const m = P && P.model; if (!m || !m.kart) return false;   // (the starship and the shape-built kart: no wing)
  lv = clamp(Math.round(lv) || 0, 0, REAR_WINGS.length);
  if ((m.wingLv || 0) === lv) return false;
  const old = m.wing, keep = new Set(); m.wing = null; m.wingLv = lv; m.wingPop = null;
  if (lv) {
    const W = REAR_WINGS[lv - 1], g = buildRearWing(THREE, W.id, m.look || save.kart.skin || DEFAULT_SKIN, { logoCanvas });
    // a pivot at the wing's foot, so the pop grows out of the rear deck (not out of the kart's middle)
    g.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(g), c = new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2);
    const piv = new THREE.Group(); piv.name = 'RearWingPivot'; piv.userData.wing = W.id; piv.position.copy(c); g.position.sub(c); piv.add(g); m.kart.add(piv); m.wing = piv;
    g.traverse((n) => { if (n.isMesh) [].concat(n.material).forEach((mt) => { keep.add(mt.map); keep.add(mt.emissiveMap); }); });   // (the shared carbon texture stays)
    if (fx) {
      piv.scale.setScalar(.01); m.wingPop = { t: 0 };
      const B = m.body; B.updateMatrixWorld(true); const top = m.kart.localToWorld(new THREE.Vector3(c.x, b.max.y, c.z)), light = (m.look && m.look.light) || '#ffa424';
      upFxOf(m); upLabel(m, B.worldToLocal(top.clone()).add(new THREE.Vector3(0, -.32, 0)), `${W.name.toUpperCase()} WING`, '#ffe14a');   // (starts just over the wing: the garage camera is close and low)
      for (let n = 0; n < 14; n++) puff(top.x, top.y, top.z, n % 2 ? light : '#fff6c0', rand(.07, .16), rand(.25, .45), rand(-2.4, 2.4), rand(.8, 2.8), rand(-2.4, 2.4), 7);
      sfx.spark(Math.min(3, 1 + Math.floor((lv - 1) / 3)));
    }
  }
  // the old wing is freed a moment later, once the new one has been drawn: freeing it first would let three.js drop the
  // shared shader programs and compile them again (a 100–200 ms hitch on every swap)
  if (old) { old.removeFromParent(); setTimeout(() => wingDispose(old, keep), 600); }
  return true;
}
// the pop: 0.01 → 1.15 → 1 over 0.35 s
function wingTick(dt) {
  const m = race && race.player && race.player.model, q = m && m.wingPop; if (!q || !m.wing) return;
  q.t += dt; const k = Math.min(1, q.t / .35), s = k < .6 ? .01 + 1.14 * Math.sin(k / .6 * Math.PI / 2) : 1.15 - .15 * (k - .6) / .4;
  m.wing.scale.setScalar(Math.max(.01, s)); if (k >= 1) { m.wing.scale.setScalar(1); m.wingPop = null; }
}
/* (v274, the user: "there will be exactly 9 models of tyres in the game and, as with the wings, each question will level
   up your tyres") TYRE LEVELS: every race starts on level 1 (the Original LED tyre — a kart can't have no tyres); each
   RIGHT REPLACING TYRES answer (3 at the garage start + 3 at each of the 2 pit stops) fits the next tyre on all four wheels
   with a pop, sparks and its name; a right answer at level 9 only flashes the wheels; a wrong one keeps them. During a race
   this overrides the tyre fitted in the garage (the menu and garage kart keep that one). Only your go-kart. */
const TYRE_LEVELS = ['classic', 'd-steelie', 'd-mesh', 'd-mudclaw', 'd-solar', 'd-turbine', 'd-vortex', 'd-starsplit', 'd-hexcore'];
const TYRE_HUBS = ['WheelFrontLeft', 'WheelFrontRight', 'WheelRearLeft', 'WheelRearRight'];   // (the order of makeRacerModel's spins)
// all eight design tyres, loaded while a race sets up (so a level-up never waits or shows the classic wheel)
function preloadTyres() { return BASE.tyresAll || (BASE.tyresAll = Promise.all(TYRE_LEVELS.map((id) => TYRE_BY_ID[id].model).filter(Boolean).map((md) => loadTyreModel(md)))); }
// their shaders compiled now, in your light colour (once a race, before the questions)
function tyreWarm(P) {
  const m = P && P.model; if (!m || !m.kart || !BASE.tyre || !WORLD || m.tyreWarm) return;
  if (!TYRE_LEVELS.every((id) => !TYRE_BY_ID[id].model || BASE.tyreModels[TYRE_BY_ID[id].model])) return; m.tyreWarm = true;
  const tmp = new THREE.Group(); for (const id of TYRE_LEVELS) tmp.add(tyreWheel(.22, .25, 1, { ...(m.look || DEFAULT_SKIN), tyre: id }, 'hi'));
  tmp.position.set(P.x || 0, (P.y || 0) - 50, P.z || 0); WORLD.scene.add(tmp); try { renderer.compile(WORLD.scene, WORLD.camera); } catch (e) {} WORLD.scene.remove(tmp);
}
const tyreOnAns = (P, R0) => (k, i, ok) => {
  if (!ok || k !== 'imm' || race !== R0) return false;
  const m = P.model, lv = (m && m.kart && m.tyreLv) || 0; if (!lv) return false;   // (the starship: the old NEW TYRE label)
  return lv >= TYRE_LEVELS.length ? tyreFx(m, 'MAX TYRES!') : setTyre(P, lv + 1);
};
// the garage start and the pit stops: right SPEED answers grow the wing, right REPLACING TYRES answers the tyres
const kitOnAns = (P, R0) => { const a = wingOnAns(P, R0), b = tyreOnAns(P, R0); return (k, i, ok) => a(k, i, ok) || b(k, i, ok); };
function setTyre(P, lv, fx = true) {
  const m = P && P.model; if (!m || !m.kart || !BASE.tyre || (m.spins || []).length < 4) return false;
  lv = clamp(Math.round(lv) || 1, 1, TYRE_LEVELS.length);
  if (m.tyreLv === lv) return false;
  const id = TYRE_LEVELS[lv - 1], md = TYRE_BY_ID[id].model; m.tyreLv = lv;
  if (md && !BASE.tyreModels[md]) loadTyreModel(md).then((g) => { if (g && m.tyreLv === lv && m.tyreId !== id) tyreFit(m, id); });   // (not loaded yet: the old wheels until it is)
  else if ((m.tyreId || (m.look && m.look.tyre) || 'classic') !== id) tyreFit(m, id);
  else m.tyreId = id;
  return fx ? tyreFx(m, `${TYRE_BY_ID[id].name.toUpperCase()} TYRES`) : true;
}
// the new wheel on each hub (in place of the old 'Spin'; the brakes stay); the wheels share the cached geometry and
// materials, so nothing is freed. The racer's spins (rolling), and the pit crew's wheel swap, now use the new ones.
function tyreFit(m, id) {
  const N = m.kart.nodes, look = { ...(m.look || DEFAULT_SKIN), tyre: id }, C = WORLD && WORLD.crew, spins = [];
  for (const name of TYRE_HUBS) {
    const a = N[name], [r, w, side] = WHEEL_SIZE[name], old = a.getObjectByName('Spin'), g = tyreWheel(r, w, side, look, 'hi');
    g.userData.s0 = g.scale.clone();
    if (old) { g.rotation.x = old.rotation.x; g.visible = old.visible; a.remove(old); }
    a.add(g); a.updateMatrixWorld(true); spins.push(g);
    if (C && C.wheels) for (const W of C.wheels) if (W.s === old) {   // (a crewman may be holding this wheel: hand him the new one)
      W.s = g;
      if (W.neu) { const n = g.clone(true); n.visible = true; n.matrixAutoUpdate = false; n.matrix.copy(W.neu.matrix); n.matrixWorldNeedsUpdate = true; W.neu.parent.add(n); W.neu.removeFromParent(); W.neu = n; }
    }
  }
  if (m.spins) { m.spins.length = 0; m.spins.push(...spins); } else m.spins = spins;   // (the same array: whoever holds it sees the new wheels)
  m.tyreId = id; if (m.tyrePop) m.tyrePop.t = 0;
}
// the level-up: all four wheels pop (0.01 → 1.15 → 1 over 0.35 s), sparks off each, the tyre's name floats up
function tyreFx(m, text) {
  const B = m.body; B.updateMatrixWorld(true); const light = (m.look && m.look.light) || '#ffa424', v = new THREE.Vector3();
  for (const s of m.spins) if (!s.userData.s0) s.userData.s0 = s.scale.clone();
  m.tyrePop = { t: 0 };
  for (const s of m.spins) { s.getWorldPosition(v); for (let n = 0; n < 6; n++) puff(v.x, v.y, v.z, n % 2 ? light : '#fff6c0', rand(.05, .11), rand(.25, .4), rand(-1.8, 1.8), rand(.8, 2.4), rand(-1.8, 1.8), 7); }
  const at = B.worldToLocal(m.kart.nodes.WheelFrontRight.getWorldPosition(new THREE.Vector3()));   // (over the front wheel the tyre camera looks at)
  upFxOf(m); upLabel(m, at, text, '#59d8ff'); sfx.spark(Math.min(3, 1 + Math.floor(((m.tyreLv || 1) - 1) / 3)));
  return true;
}
function tyreTick(dt) {
  const m = race && race.player && race.player.model, q = m && m.tyrePop; if (!q) return;
  q.t += dt; const k = Math.min(1, q.t / .35), s = k < .6 ? .01 + 1.14 * Math.sin(k / .6 * Math.PI / 2) : 1.15 - .15 * (k - .6) / .4;
  for (const w of m.spins) if (w.userData.s0) w.scale.copy(w.userData.s0).multiplyScalar(k >= 1 ? 1 : Math.max(.01, s));
  if (k >= 1) m.tyrePop = null;
}
function upFxTick(dt) {
  const m = race && race.player && race.player.model, U = m && m.ups && m.ups.userData; if (!U) return;
  for (let n = U.pops.length - 1; n >= 0; n--) { const q = U.pops[n]; q.t += dt; const k = Math.min(1, q.t / .4), s = q.from ? q.from + (1 - q.from) * k : k < .7 ? k / .7 * 1.25 : 1.25 - (k - .7) / .3 * .25; q.o.scale.setScalar(Math.max(.01, s)); if (k >= 1) { q.o.scale.setScalar(1); U.pops.splice(n, 1); } }
  const sp = clamp((race.player.speed || 0) / 25, .35, 1.3);
  for (const f of U.flames) f.scale.set(1, 1, sp * (U.flameK || 1) * rand(.75, 1.25));
  for (let n = U.labels.length - 1; n >= 0; n--) { const q = U.labels[n]; q.t += dt; q.sp.position.y += dt * .9; q.sp.material.opacity = q.t < .9 ? 1 : Math.max(0, 1 - (q.t - .9) / .5); if (q.t > 1.4) { q.sp.removeFromParent(); q.sp.material.map.dispose(); q.sp.material.dispose(); U.labels.splice(n, 1); } }
}
const PIT_SETS = {
  fix: { name: 'MAINTENANCE', icon: 'icon-wrench', col: '#ffc324', say: 'Maintenance!', won: 'GRIP' },
  spd: { name: 'SPEED', icon: 'icon-rocket', col: '#ff8a1e', say: 'Speed!', won: 'SPEED' },
  imm: { name: 'REPLACING TYRES', icon: 'icon-tyre', col: '#59d8ff', say: 'Replacing tyres!', won: 'SHIELD' },   // (v162, the user: was IMMUNITY; it still buys puddle shields)
};
const pitDueLap = (lap) => lap > 0 && lap <= TUNE.laps && (TUNE.pitLaps ? TUNE.pitLaps.includes(lap) : lap % TUNE.pitEvery === 0);
const lapPill = () => { const e = $('lap'); if (e && race) e.innerHTML = `LAP ${clamp(race.player.lap, 1, TUNE.laps)}/${TUNE.laps}`; };
// what a set's percentage buys: a full set is worth three steps. Maintenance and speed stack up over
// the race; puddle shields are whole things, so they round.
function pitAward(r, k, pct) {
  const v = pct / 100 * 3;
  if (k === 'fix') r.fix = Math.min(6, (r.fix || 0) + v);
  else if (k === 'spd') r.spd = Math.min(6, (r.spd || 0) + v);
  else r.imm = Math.min(TUNE.maxImmune, (r.imm || 0) + Math.round(v));
}
// the three little gauges under the coin pill: grip, speed, shields — plus PIT and the lane limiter
function drawPitHud() {
  const e = $('pitb'); if (!e) return;
  if (!race || screen !== 'race') { e.hidden = true; return; }
  const P = race.player, v = { fix: Math.round(P.fix || 0), spd: Math.round(P.spd || 0), imm: P.imm || 0 };
  e.hidden = !race.pitDue && !v.fix && !v.spd && !v.imm && !P.inPit;
  if (e.hidden) return;
  e.innerHTML = ['fix', 'spd', 'imm'].map((k) => `<span class="pr" style="--c:${PIT_SETS[k].col}">${ico(PIT_SETS[k].icon, 'pico')}<b>${v[k]}</b></span>`).join('')
    + (race.pitDue ? '<span class="pdue">PIT</span>' : '');
}

// Running into the barrier does not stop you: it slides you along itself and turns the kart towards
// the mouth of the lane, so a child who cannot find the entry is simply carried into it.
function pitGateWall(r, dt) {
  const P = PITS, W = WORLD;
  return;   // (v176: the barrier is gone)
  if (!P || !W.pitGate || !race.pitDue || !r.player || r.air || !race.started || race.ended) return;
  const G = W.pitGate, ds = dsOf(r.sc); if (ds < G.from || ds > G.to) return;
  const u = r.lat * P.side, line = G.at(ds) + KART_HALF_W;
  if (u >= line) return;
  const d = (line - u) * P.side, p = tp(r.idx);
  r.x += p.nx * d; r.z += p.nz * d; r.lat += d;
  const tgt = at(r.idx * STEP + 18, (line + 3.5) * P.side), want = Math.atan2(tgt.x - r.x, -(tgt.z - r.z));
  r.angle += wrapA(want - r.angle) * Math.min(1, dt * 4);
  r.speed *= Math.pow(.6, dt);
  if (r.drift) endDrift(r);
  if (!r.gateT) { sfx.shield(); buzz(20); race.shake = .18; if (!race.tips.pitGate) { race.tips.pitGate = 1; toast('TO THE PITS!', '#ff5b5b', 34); } }
  r.gateT = .35;
}

/* --- the lane's own walls: the pit wall on one side, the guard rail on the other --- */
function pitWalls(r, dt) {
  const P = PITS, W = WORLD; if (!P || !W.pitIdx) return;
  const e = pitEdges(dsOf(r.sc)); if (!e) { r.laneSide = 0; return; }
  // (v258, the user: "jump fast without turning and it traps you in the pit") in the air, the pit wall still stands:
  // a kart flying from the track side is held on the track side of it
  if (r.air) {
    if (!r.laneSide && e[0] > HALF + 1.4) { const u = r.lat * P.side, wall = WALL_LAT_OF(); if (u > wall) { const p = tp(r.idx), d = wall * P.side - r.lat; r.x += p.nx * d; r.z += p.nz * d; r.lat += d; r.angle -= wrapA(r.angle - angleOf(p)) * Math.min(1, dt * 6); } }
    return;
  }
  const u = r.lat * P.side, inner = e[0] + KART_HALF_W, outer = e[1] - KART_HALF_W, wall = WALL_LAT_OF();
  if (u <= wall) r.laneSide = 0; else if (u >= inner) r.laneSide = 1;
  let want = null;
  if (u > outer) want = outer;
  else if (inner > wall && u > wall && u < inner) want = r.laneSide ? inner : wall;
  if (want == null) return;
  const p = tp(r.idx), d = want * P.side - r.lat;
  r.x += p.nx * d; r.z += p.nz * d; r.lat += d;
  const into = wrapA(r.angle - angleOf(p)); r.angle -= into * Math.min(1, dt * 6);
  if (!r.wallT) { r.speed *= .82; if (r.player) { sfx.bump(); buzz(25); race.shake = .2; } }
  r.wallT = .4;
}
const WALL_LAT_OF = () => HALF + (TDEF.wallOut ?? .95) - KART_HALF_W;

/* ---------- (v173, the user) THE FORMATION LAP GATES: ten answer gates round the lap, only on the formation lap.
   Before each gate the word stands on a sign over it and is read out, the race slows down, and you steer yourself
   through the arch with the right picture (no pop-up, no autopilot) — the formation pace leaves time to line up.
   A right gate: +3 coins and a little boost. At the end of the lap: how many you got. --------------------------- */
const FGATES = 10;
function buildFormGates(scene, W, def) {
  if (!PITS) return;
  const L0 = TRACK.L, busyM = RAMP_AT.map((f) => f * L0).concat(PAD_AT.map((p) => p.f * L0));   // (v212: on the formation lap only the jumps and the pads are in the way — no boxes or puddles then, and the road is the usual one)
  const s0 = PITS.exit + 30, s1 = L0 - 95, fs = [];   // from the pit exit to just before the grid (the pit entry is shut on the formation lap)
  // (v212, the user: "no gates in a turn") a gate only where the road is straight, or at most a gentle sweep, at the gate
  // and for the 40 m before it (where you line up your lane) — the best such spots round the lap, at least 70 m apart.
  // (The question itself shows at the top of the screen long before, so a gate needs no long view down the road.)
  const runUp = (s) => { let m = 0; for (let d = -40; d <= 12; d += 4) m = Math.max(m, bendAt(s + d)); return m; };
  const cand = []; for (let s = s0; s <= s1; s += 3) { if (busyM.some((m) => Math.abs(m - s) < 16)) continue; const v = runUp(s) + Math.abs(slopeAt(Math.round(s / STEP))) * 2; if (runUp(s) < .55) cand.push({ s, v }); }
  cand.sort((a, b) => a.v - b.v);
  for (const c of cand) { if (fs.length >= FGATES) break; if (fs.every((f) => Math.abs(f * L0 - c.s) > 70)) fs.push(c.s / L0); }
  fs.sort((a, b) => a - b);
  const gates = buildGates(scene, W, def, fs);
  for (const g of gates) {
    g.g.visible = false;
    const c = document.createElement('canvas'); c.width = 1024; c.height = 192; const x = c.getContext('2d'), t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(g.GW * 2 + .6, (g.GW * 2 + .6) * 192 / 1024), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
    sign.position.y = 6.75; g.g.add(sign); g.sign = { x, t, m: sign };
    // (v197, the user: in the cave the questions over the gates were hidden) the cave roof comes down into the sign, so
    // under the rock it hangs a little lower and is drawn over the rock; only the next gate's sign shows (no signs
    // seen through the cave walls)
    if (def.tube) { sign.position.y = 6.1; sign.material.depthTest = false; sign.material.depthWrite = false; sign.renderOrder = 8; }
  }
  W.fgates = gates;
}
function fgateSign(g, word) {
  const x = g.sign.x; x.clearRect(0, 0, 1024, 192);
  x.fillStyle = '#1b2a4a'; x.beginPath(); x.roundRect(6, 6, 1012, 180, 40); x.fill(); x.fillStyle = word ? '#ffc324' : '#3a4a7a'; x.beginPath(); x.roundRect(20, 20, 984, 152, 30); x.fill();
  x.font = 'bold 112px Fredoka, Arial Rounded MT Bold, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 14; x.strokeStyle = '#1b2a4a';
  const w = word ? word.toUpperCase() : '?'; x.strokeText(w, 512, 100); x.fillStyle = '#fff'; x.fillText(w, 512, 100); g.sign.t.needsUpdate = true;
}
function formGatesOn(on) {
  const W = WORLD; if (!W.fgates) return;
  for (const g of W.fgates) { g.g.visible = on; g.armed = false; g.done = false; g.said = false; g.block.visible = false; g.panels.forEach((pn) => setPanel(pn, '?')); fgateSign(g, null); }
  W.gates = on ? W.fgates : []; if (race) { race.fg = { right: 0, n: 0 }; race.steerGate = null; race.steerTo = null; }
  $('gp').hidden = true;
}
// (v212, the user: "on the phone I can't see the question or the answers — show them where I can see them, early enough
// to react, and better for slower players") the gate's question as a card at the top of the screen: the word and the
// pictures in their lanes (left / middle / right), your lane lit; it comes up 130–170 m before the gate (earlier for
// the youngest), the race slows more gently and for longer for them, and the card shows ✓ / ✗ as you go through
const GQ_ARM = [170, 150, 130], GQ_SLOW = [[85, .72], [65, .8], [45, .85]];
function gateCard(g, P, res) {
  const C = $('gq'); if (!C) return;
  if (!g) { C.hidden = true; C.dataset.g = ''; return; }
  const key = String(g.s);
  if (C.dataset.g !== key) { C.dataset.g = key; C.hidden = false; C.className = '';
    C.innerHTML = `<b class="gqw">${g.it.w}</b><div class="gql">${[0, 1, 2].map((li) => { const k = g.lanes.indexOf(li); return `<span class="gqt${k < 0 ? ' off' : ''}" data-li="${li}">${k < 0 ? '' : g.opts[k].e}</span>`; }).join('')}</div>`; }
  let near = -1, bd = 1e9; for (const li of g.lanes) { const dd = Math.abs(P.lat - g.lat[li]); if (dd < bd) { bd = dd; near = li; } }
  for (const t of C.querySelectorAll('.gqt')) t.classList.toggle('me', +t.dataset.li === near && !res);
  if (res) { C.classList.add(res.ok ? 'ok' : 'no'); const right = g.lanes[g.opts.indexOf(g.it)]; for (const t of C.querySelectorAll('.gqt')) { if (+t.dataset.li === right) t.classList.add('right'); else if (+t.dataset.li === res.li) t.classList.add('wrong'); } }
}
function updateFormGates() {
  const W = WORLD, P = race.player, Lt = TRACK.L; if (!W.fgates || !(race.formation || race.tutGates)) { if ($('gq') && !$('gq').hidden && !race.gqHold) gateCard(null); return; }
  const list = race.formation ? W.fgates : race.tutGates, lv = clamp(L.level(), 0, 2);
  let slow = false, next = null, nd = 1e9;
  for (const g of list) { const d = ((g.s - P.sc) % Lt + Lt) % Lt; if (!g.done && d < Lt - 10 && d < nd) { nd = d; next = g; } }   // only the next gate is armed
  for (const g of list) {
    const d = ((g.s - P.sc) % Lt + Lt) % Lt;
    if (g === next && !g.armed && !g.done && d < GQ_ARM[lv] && d > 25 && !DEV()) {
      const { it, opts } = L.pickGate(TDEF.words || TDEF.id); g.it = it; g.opts = opts; g.armed = true; g.said = false; L.prefetch([it.w, 'Yes!']);
      g.lanes = opts.length === 2 ? [0, 2] : [0, 1, 2];
      g.panels.forEach((pn, i) => setPanel(pn, g.lanes.includes(i) ? opts[g.lanes.indexOf(i)].e : '—', g.lanes.includes(i) ? '' : 'off')); g.block.visible = !g.lanes.includes(1);
      fgateSign(g, it.w);
    }
    if (g.armed && !g.said && d < GQ_ARM[lv] - 15) {
      g.said = true; L.say(g.it.w); const gp = $('gp'); gp.textContent = g.it.w; gp.classList.remove('ok', 'no'); gp.hidden = true;   // (v212: the card at the top shows the word)
      if (!race.tips.fgate) { race.tips.fgate = 1; toast('Drive through the\nright picture!', '#ffe14a', 30); }
      if (window.FK.answer === 'right' || window.FK.answer === 'wrong') { const r = g.lanes[g.opts.indexOf(g.it)], li = window.FK.answer === 'right' ? r : g.lanes.find((x) => x !== r); race.steerTo = g.lat[li]; race.steerLane = li; race.steerGate = g; }   // test hook
    }
    if (g.armed) gateCard(g, P);
    if (g.armed && d < GQ_SLOW[lv][0] && d > 1) slow = true;   // (v191: the last 40 m at 85 %; v212: longer and gentler for the youngest)
    if (g.armed && d > Lt - 8) {   // through the gate: which arch?
      g.armed = false; g.done = true; if (race.steerGate === g) { race.steerGate = null; race.steerTo = null; }
      let best = -1, bd = Infinity; g.lanes.forEach((li, k) => { const dd = Math.abs(P.lat - g.lat[li]); if (dd < bd) { bd = dd; best = k; } });
      const ok = best >= 0 && g.opts[best] === g.it, gp = $('gp'); race.fg.n++;
      gateCard(g, P, { ok, li: best >= 0 ? g.lanes[best] : -1 }); race.gqHold = true; setTimeout(() => { if ($('gq') && $('gq').dataset.g === String(g.s)) gateCard(null); race && (race.gqHold = false); }, 1300);
      L.record(g.it, ok, race.learn.queue); race.learn.practised.push({ id: g.it.id, label: `${g.it.e} ${g.it.w}`, ok });
      setPanel(g.panels[g.lanes[g.opts.indexOf(g.it)]], g.it.e, 'ok');
      if (ok) { race.fg.right++; giveBoost(P, .6, 1.15); save.coins += 3; sfx.right(); sfx.coin(); L.say(`Yes! ${g.it.w}!`); burst(P.x, P.y + 1.5, P.z, '#ffe14a', 10); gp.classList.add('ok'); gp.textContent = `${g.it.e} ${g.it.w} +3`; }
      else { Snd.tone(330, .25, 'triangle', .05, .8); L.say(g.it.w); gp.classList.add('no'); gp.textContent = `${g.it.e} ${g.it.w}`; }
      setTimeout(() => { if (gp.textContent.includes(g.it.w)) gp.hidden = true; }, 1600);
    }
  }
  if (TDEF.tube) for (const g of list) if (g.sign && g.sign.m) g.sign.m.visible = g === next && ((g.s - P.sc) % Lt + Lt) % Lt < 140;   // (v197) the cave: just the next gate's sign
  // (v191: a gentle 85 %, was 55 %; v197: the slow-down is undone after the gate, that line had slipped into the comment)
  if (slow) { race.slowTarget = GQ_SLOW[lv][1]; race.fgSlow = true; } else if (race.fgSlow) { race.slowTarget = 1; race.fgSlow = false; }   // (only undoes its own slow-down)
}
function updateGates() {
  if (race.formation) return;   // (v173) the formation gates have their own rules
  const P = race.player, Lt = TRACK.L;
  // a pit-stop question in slow motion must not carry you past a gate before it can ask its word: near one, crawl
  if (race.dialog === 'pit') { const near = WORLD.gates.some((g) => !(g.armed && g.asked) && ((g.s - P.sc) % Lt + Lt) % Lt < 80); race.slowTarget = near ? .05 : .2; }
  for (const g of WORLD.gates) {
    const d = ((g.s - P.sc) % Lt + Lt) % Lt;
    if (DEV()) continue;   // dev mode: gates are never armed, so all three arches stay open and nothing is asked
    if (!g.armed && !g.done && d > 55 && d < 150 && race.started && !race.ended && !race.dialog) {
      const { it, opts } = L.pickGate(TDEF.id); g.it = it; g.opts = opts; g.armed = true; L.prefetch([it.w, 'Yes!']);
      g.lanes = opts.length === 2 ? [0, 2] : [0, 1, 2];   // (direction gates always use all three lanes: ⬅️ left, ⬆️ middle, ➡️ right)
      g.panels.forEach((pn, i) => setPanel(pn, g.lanes.includes(i) ? opts[g.lanes.indexOf(i)].e : '—', g.lanes.includes(i) ? '' : 'off')); g.block.visible = !g.lanes.includes(1);
      g.asked = false; const gp = $('gp'); gp.textContent = it.w; gp.hidden = true; gp.classList.remove('ok', 'no');
    }
    // 50 m before the gate: the gate question (slow motion, blurred, three buttons)
    if (g.armed && !g.asked && !race.dialog && race.started && !race.ended && d < 50 && d > 14) { g.asked = true; gateQuestion(g); }
    // Starter level: time slows down a little just before the gate, so there is time to find the picture
    if (g.armed && L.level() === 0 && !race.dialog) { const want = d < 45 && d > 2 ? .6 : 1; if (race.slowTarget !== want && (race.slowTarget === 1 || race.slowTarget === .6)) race.slowTarget = want; }
    if (g.armed && d > Lt - 8) {
      g.armed = false; g.done = true; if (race.slowTarget === .6) race.slowTarget = 1;
      if (race.steerGate === g) { race.steerTo = null; race.steerGate = null; }   // through the gate: the wheel is yours again
      let best = -1, bd = Infinity; g.lanes.forEach((li, k) => { const dd = Math.abs(P.lat - g.lat[li]); if (dd < bd) { bd = dd; best = k; } });   // (the gate walls make sure it is one of the open arches)
      const ok = best >= 0 && g.opts[best] === g.it, gp = $('gp');
      L.record(g.it, ok, race.learn.queue); race.learn.gates.push(ok); race.learn.practised.push({ id: g.it.id, label: `${g.it.e} ${g.it.w}`, ok });
      const right = g.lanes[g.opts.indexOf(g.it)]; setPanel(g.panels[right], g.it.e, 'ok');
      if (ok) { giveBoost(P, .8, 1.2); sfx.right(); L.say(`Yes! ${g.it.w}!`); burst(P.x, P.y + 1.5, P.z, '#ffe14a', 10); gp.classList.add('ok'); gp.textContent = `OK ${g.it.w}`; }
      else { Snd.tone(330, .25, 'triangle', .05, .8); L.say(g.it.w); gp.classList.add('no'); }
      gp.hidden = false; setTimeout(() => { gp.hidden = true; }, 1500);
    }
    if (g.done && d > 20 && d < Lt - 30) { g.done = false; g.block.visible = false; g.panels.forEach((pn) => setPanel(pn, '?')); }
  }
}
// the gate question: just before an answer gate the race slows right down and blurs, the word is read out and shown, and
// the three arches appear as three buttons (⬅️ left · ⬆️ middle · ➡️ right) with their pictures. Tap one (or ← ↑ →,
// A W D, 1 2 3) and your kart drives itself through that arch. No choice before the clock runs out: steer there yourself.
function gateQuestion(g) {
  const P = race.player, R0 = race, D = $('dialog');
  race.dialog = 'gate'; race.slowTarget = .08; race.holdLat = clamp(P.lat, -HALF + 1.8, HALF - 1.8); if (P.drift) endDrift(P);
  stage.classList.add('blur'); Music.duck(true);
  const dirs = ['<', '^', '>'], secs = 7 + (L.level() === 0 ? 3 : 0);
  D.hidden = false;
  D.innerHTML = `<div class="veil gatev"><div class="card gcard"><div class="tag">PICK A GATE!</div><div class="qtime"><i></i></div><div class="gword" id="gword">${g.it.w}</div><div class="gopts">${[0, 1, 2].map((li) => {
    const k = g.lanes.indexOf(li);
    return k < 0 ? `<button class="gopt shut" disabled><i>${dirs[li]}</i><b>X</b></button>` : `<button class="gopt" data-li="${li}"><i>${dirs[li]}</i><b>${g.opts[k].e}</b></button>`;
  }).join('')}</div></div></div>`;
  let done = false;
  const close = (li) => {
    if (done || race !== R0) return; done = true; removeEventListener('keydown', onKey);
    if (li != null) { D.querySelector(`.gopt[data-li="${li}"]`)?.classList.add('pick'); sfx.click(); race.steerTo = g.lat[li]; race.steerLane = li; race.steerGate = g; }
    setTimeout(() => {
      if (race !== R0) return;
      closeDialog(); stage.classList.remove('blur'); race.dialog = null; race.slowTarget = 1; Music.duck(false);
      const gp = $('gp'); gp.hidden = false; if (li == null) toast('Steer to a picture!', '#ffe14a', 28);
    }, li != null ? 200 : 0);
  };
  for (const b of D.querySelectorAll('.gopt[data-li]')) tap(b, () => close(+b.dataset.li));
  const onKey = (e) => { const li = { ArrowLeft: 0, KeyA: 0, Digit1: 0, ArrowUp: 1, KeyW: 1, Digit2: 1, ArrowRight: 2, KeyD: 2, Digit3: 2 }[e.code]; if (li != null && g.lanes.includes(li)) close(li); };
  addEventListener('keydown', onKey);
  // the clock (it only runs while the game is on screen); the last three seconds tick
  const bar = D.querySelector('.qtime i'), all = secs * 1000; let left = all, last = performance.now(), beep = 4;
  const run = () => {
    if (done || race !== R0) return;
    const now = performance.now(); if (!document.hidden) left -= now - last; last = now;
    bar.style.width = `${Math.max(0, left / all) * 100}%`; bar.classList.toggle('low', left < 3000);
    const sec = Math.ceil(left / 1000); if (sec < beep && sec > 0) { beep = sec; sfx.tick(); }
    if (left <= 0) close(null); else setTimeout(run, 50);
  };
  run();
  // test hook: FK.answer = 'right' | 'wrong' picks by itself ('late' lets the clock run out)
  if (window.FK.answer && window.FK.answer !== 'late') setTimeout(() => { const right = g.lanes[g.opts.indexOf(g.it)]; close(window.FK.answer === 'right' ? right : g.lanes.find((x) => x !== right)); }, 600);
}

/* ---------- the arcade bits: jump ramps, boost pads and coins ---------- */
// a quad along the track between two distances and two sideways offsets, at a height above the road (for pads and ramp tops)
function trackQuad(s0, s1, l0, l1, y0, y1) {
  const pos = [], uv = [], n = Math.max(1, Math.round((s1 - s0) / STEP));
  for (let k = 0; k < n; k++) {
    const sa = s0 + (s1 - s0) * k / n, sb = s0 + (s1 - s0) * (k + 1) / n, A = at(sa).p, B = at(sb).p, ya = y0 + (y1 - y0) * k / n, yb = y0 + (y1 - y0) * (k + 1) / n;
    const P = (p, l, y) => rolled(p, l, y);
    pos.push(...P(A, l0, ya), ...P(A, l1, ya), ...P(B, l0, yb), ...P(A, l1, ya), ...P(B, l1, yb), ...P(B, l0, yb));
    const va = k / n, vb = (k + 1) / n; uv.push(0, va, 1, va, 0, vb, 1, va, 1, vb, 0, vb);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
}
function chevrons(c1, c2, bg) {
  return canvasTex(128, 128, (x) => {
    x.fillStyle = bg; x.fillRect(0, 0, 128, 128);
    for (const [y, c] of [[20, c1], [84, c2]]) { x.fillStyle = c; x.beginPath(); x.moveTo(14, y + 40); x.lineTo(64, y - 4); x.lineTo(114, y + 40); x.lineTo(114, y + 58); x.lineTo(64, y + 14); x.lineTo(14, y + 58); x.closePath(); x.fill(); }
  });
}
/* ---------- (v264, the user) TEN TRACK TYPES ON EVERY MAP ----------
   Every road variant of the changing stretch is a different TYPE of track, not just a different line: its own surface
   (snow, ice, planks, cobbles, dirt, metal, a neon grid, lava, gold, coral, rails…), its own kerbs, its own roadside
   (snow banks, crystals, lamps, rails, houses, pines, a lake, neon bars, palms, torches, market stalls, rocks, glowing
   mushrooms, timber frames, asteroids, warp rings, a station hall), sometimes a roof (an ice or rock tunnel, a hall,
   bunting) and its own weather while you are on it (snow, rain, sparkles, an aurora, embers, bubbles, stars, dust),
   with the world going dark for the night ones. Nothing stands on the road and the physics are untouched, so every
   type takes the same time and has the same power-ups. Type 0 is the usual road. */
const TRACK_TYPES = {
  alps: [
    { n: 'CLASSIC' },
    { n: 'SNOW ROAD', road: ['#f2f6ff', 'snow'], kerb: ['#ffffff', '#9fc4ff'], side: 'banks', c: '#ffffff', fx: 'snow' },
    { n: 'ICE ROAD', road: ['#9fdcff', 'ice'], kerb: ['#e8f8ff', '#3a8ad8'], side: 'crystals', c: ['#7af8ff', '#bff4ff', '#ffffff'], fx: 'sparkle' },
    { n: 'NIGHT RUN', road: ['#2a2e48', 'asphalt'], kerb: ['#ffe14a', '#1b1f3a'], side: 'lamps', c: '#ffd080', dark: .62, fog: '#0b1030' },
    { n: 'WOODEN BRIDGE', road: ['#a87040', 'planks'], kerb: ['#6a4020', '#c08a50'], side: 'rail', c: '#8a5a30', under: 'posts' },
    { n: 'ICE TUNNEL', road: ['#8cc8ff', 'ice'], kerb: ['#e8f8ff', '#5aa8ff'], side: 'crystals', c: ['#bff4ff', '#7af8ff'], roof: 'tunnel', rc: '#a8d8ff', dark: .3, fx: 'sparkle' },
    { n: 'VILLAGE STREET', road: ['#8a8a96', 'cobbles'], kerb: ['#e0e0e8', '#6a6a78'], c: ['#f0c0a0', '#a0c8f0', '#f0e0a0', '#c0e0b0', '#f0b0c0'], roof: 'bunting' },   // (v272, the user: no houses around the track here)
    { n: 'FOREST TRAIL', road: ['#6a4a2a', 'dirt'], kerb: ['#4a6a2a', '#2a4a1a'], side: 'pines', c: ['#2f7a3a', '#3a9a4a', '#1f6a2a'] },
    { n: 'FROZEN LAKE', road: ['#c8ecff', 'ice'], kerb: ['#ffffff', '#9fd8ff'], side: 'lake', c: ['#8fd0ff', '#ffffff'], fx: 'sparkle' },
    { n: 'AURORA GLOW', road: ['#141838', 'grid'], kerb: ['#c84aff', '#3a8aff'], side: 'neon', c: ['#7af8ff', '#c84aff', '#3cff8a'], dark: .5, fog: '#0a0a2a', fx: 'aurora' },
  ],
  beach: [
    { n: 'CLASSIC' },
    { n: 'BOARDWALK', road: ['#c08a50', 'planks'], kerb: ['#8a5a30', '#e0b080'], side: 'rail', c: '#a06a38' },
    { n: 'SAND DUNES', road: ['#f0dcb0', 'sand'], kerb: ['#e8d0a0', '#c0a070'], side: 'dunes', c: '#f0d8a8', fx: 'dust' },
    { n: 'PALM ALLEY', road: ['#b8b8c0', 'asphalt'], kerb: ['#ff8a1e', '#ffffff'], side: 'palms', c: ['#3aa84a', '#8a5a30'] },
    { n: 'THE PIER', road: ['#a87850', 'planks'], kerb: ['#6a4a30', '#d0a070'], side: 'pier', c: ['#8a5a30', '#3a9ad8'] },
    { n: 'LAVA ROCK', road: ['#2a2024', 'lava'], kerb: ['#2a2024', '#ff5a1e'], side: 'lava', c: ['#3a3038', '#ff7a1e'], dark: .3, fog: '#2a1008', fx: 'embers' },
    { n: 'NIGHT BEACH', road: ['#2a2e3a', 'asphalt'], kerb: ['#ffe14a', '#1b2a4a'], side: 'torches', c: '#ffb040', dark: .62, fog: '#0a1428', fx: 'stars' },
    { n: 'CORAL ROAD', road: ['#ff9ab0', 'coral'], kerb: ['#ff7ab8', '#ffd0e0'], side: 'coral', c: ['#ff7ab8', '#ffa070', '#ffd0e0'], fx: 'bubbles' },
    { n: 'TIDE POOLS', road: ['#c8b890', 'wet'], kerb: ['#7fd0ff', '#ffffff'], side: 'tide', c: ['#5ad0e8', '#5a5a60'], fx: 'sparkle' },
    { n: 'SURF STREET', road: ['#d0c8b8', 'cobbles'], kerb: ['#ff5db1', '#ffffff'], side: 'stalls', c: ['#ff5db1', '#5fe8ff', '#ffe14a', '#4fc84a'], roof: 'bunting' },
  ],
  city: [
    { n: 'CLASSIC' },
    { n: 'NEON TUNNEL', road: ['#0e1230', 'grid'], kerb: ['#7af8ff', '#1b1f3a'], side: 'neon', c: ['#7af8ff', '#ff3fbf', '#3cff8a'], roof: 'station', concrete: true, dark: .4 },   // (v293: a concrete tunnel)
    { n: 'WET STREET', road: ['#2a2c38', 'wet'], kerb: ['#ffffff', '#e8403a'], side: 'lamps', c: '#dff0ff', fx: 'rain' },
    { n: 'OLD TOWN', road: ['#9a9080', 'cobbles'], kerb: ['#d0c8b8', '#6a6054'], side: 'houses', c: ['#c8805a', '#e0b890', '#a06a50', '#d8c0a0'], roof: 'bunting' },
    { n: 'SKY HIGHWAY', road: ['#8a909c', 'metal'], kerb: ['#ffd23a', '#2a2e3a'], side: 'rail', c: '#c0c8d4' },
    { n: 'HOLO LANE', road: ['#7af8ff', 'glass'], kerb: ['#7af8ff', '#1b2a4a'], side: 'rings', c: ['#7af8ff', '#c84aff'], fx: 'sparkle' },
    { n: 'MARKET STREET', road: ['#5a5a66', 'asphalt'], kerb: ['#ffffff', '#e8403a'], side: 'stalls', c: ['#e8403a', '#ffe14a', '#4fc84a', '#2a9fe6'], roof: 'bunting' },
    { n: 'THE SUBWAY', road: ['#5a5a60', 'rails'], kerb: ['#ffe14a', '#3a3a44'], side: 'lamps', c: '#fff4c0', roof: 'tunnel', concrete: true, dark: .5, fog: '#101018' },
    { n: 'ROOFTOP GARDEN', road: ['#d8c8a8', 'planks'], kerb: ['#4fc84a', '#e8e0d0'], side: 'bushes', c: ['#3aa84a', '#8a5a30'], fx: 'petals' },
    { n: 'RED ALERT', road: ['#241018', 'asphalt'], kerb: ['#ff2a2a', '#1a0a0a'], side: 'neon', c: ['#ff2a2a', '#ff7a1e'], dark: .5, fog: '#200008' },
  ],
  mines: [
    { n: 'CLASSIC' },
    { n: 'CRYSTAL CAVE', road: ['#4a3a50', 'dirt'], kerb: ['#c84aff', '#2a1a30'], side: 'crystals', c: ['#7af8ff', '#c84aff', '#bff4ff'], lo: .9, h: .4, fx: 'sparkle' },
    { n: 'LAVA FLOW', road: ['#2a1a16', 'lava'], kerb: ['#3a2020', '#ff5a1e'], side: 'lava', c: ['#4a3038', '#ff7a1e'], dark: .2, fx: 'embers' },
    { n: 'WATER CAVE', road: ['#2a3a48', 'wet'], kerb: ['#5ab0ff', '#1a2a38'], side: 'tide', c: ['#2a6aa8', '#5a6070'], fx: 'drips' },
    { n: 'GOLD VAULT', road: ['#e0b040', 'gold'], kerb: ['#ffd23a', '#6a4a10'], side: 'gold', c: ['#ffd23a', '#ffe680'], fx: 'sparkle' },
    { n: 'RAIL TUNNEL', road: ['#6a5a48', 'rails'], kerb: ['#a87040', '#3a2a20'], side: 'timber', c: '#8a5a30', dark: .3 },
    { n: 'ICE CAVE', road: ['#9fdcff', 'ice'], kerb: ['#e8f8ff', '#3a8ad8'], side: 'crystals', c: ['#ffffff', '#bff4ff'], lo: .9, h: .4, fx: 'snow' },
    { n: 'MUSHROOM GROTTO', road: ['#4a4030', 'dirt'], kerb: ['#3cff8a', '#2a3020'], side: 'mushrooms', c: ['#3cff8a', '#ff5db1', '#7af8ff', '#ffe14a'], dark: .2, fx: 'sparkle' },
    { n: 'TIMBER SHAFT', road: ['#a87040', 'planks'], kerb: ['#6a4020', '#c08a50'], side: 'timber', c: '#a87040' },
    { n: 'DARK DEEP', road: ['#1a1418', 'asphalt'], kerb: ['#ff8a1e', '#1a1418'], side: 'lamps', c: '#ffb060', dark: .78, fog: '#000000' },
  ],
  space: [
    { n: 'CLASSIC' },
    { n: 'WARP TUNNEL', road: ['#101840', 'grid'], kerb: ['#7af8ff', '#1b1f5c'], side: 'rings', c: ['#7af8ff', '#3a8aff'], fx: 'stars' },
    { n: 'ASTEROID FIELD', road: ['#3a3a48', 'metal'], kerb: ['#9fb4ff', '#2a2e3a'], side: 'asteroids', c: ['#6a6478', '#8a8498', '#5a5468'], fx: 'dust' },
    { n: 'SOLAR FLARE', road: ['#3a1a08', 'lava'], kerb: ['#ffb000', '#ff5a1e'], side: 'neon', c: ['#ff8a1e', '#ffd23a'], fx: 'embers' },
    { n: 'ICE COMET', road: ['#9fdcff', 'ice'], kerb: ['#ffffff', '#5aa8ff'], side: 'crystals', c: ['#ffffff', '#bff4ff'], fx: 'snow' },
    { n: 'NEBULA', road: ['#2a1048', 'grid'], kerb: ['#c84aff', '#ff3fbf'], side: 'neon', c: ['#c84aff', '#ff3fbf', '#7a4aff'], fx: 'aurora' },
    { n: 'SPACE STATION', road: ['#8a909c', 'metal'], kerb: ['#ffd23a', '#2a2e3a'], side: 'lamps', c: '#dff0ff', roof: 'station', rc: '#2a2e40' },
    { n: 'STARLIGHT', road: ['#dff4ff', 'glass'], kerb: ['#ffffff', '#9fd8ff'], side: 'lamps', c: '#ffffff', fx: 'sparkle' },
    { n: 'RED ALERT', road: ['#241018', 'asphalt'], kerb: ['#ff2a2a', '#1a0a0a'], side: 'neon', c: ['#ff2a2a', '#ff7a1e'] },
    { n: 'GREEN GRID', road: ['#061a10', 'grid'], kerb: ['#3cff8a', '#0a2a1a'], side: 'rings', c: ['#3cff8a', '#bfffd0'], fx: 'stars' },
  ],
};
// the surfaces: one small texture each, tiled along the road (128 px across, 512 px = 12 m along)
const TT_TEX = {};
function ttTex(kind, c) {
  const key = kind + c; if (TT_TEX[key]) return TT_TEX[key];
  const col = new THREE.Color(c), shade = (k, a = 1) => { const q = col.clone().multiplyScalar(k); return `rgba(${(q.r * 255) | 0},${(q.g * 255) | 0},${(q.b * 255) | 0},${a})`; };
  const t = canvasTex(128, 512, (x) => {
    const W = 128, H = 512, spk = (n, a, b) => { for (let k = 0; k < n; k++) { x.fillStyle = Math.random() < .5 ? a : b; x.fillRect(Math.random() * W, Math.random() * H, 2, 2); } };
    const dashes = (cc) => { x.fillStyle = cc; for (let y = 0; y < H; y += 64) x.fillRect(60, y + 8, 8, 34); };
    const edges = (cc) => { x.fillStyle = cc; x.fillRect(2, 0, 3, H); x.fillRect(W - 5, 0, 3, H); };
    x.fillStyle = c; x.fillRect(0, 0, W, H);
    switch (kind) {
      case 'snow': spk(500, 'rgba(150,180,230,.22)', 'rgba(255,255,255,.5)'); x.fillStyle = 'rgba(120,150,200,.16)'; x.fillRect(30, 0, 12, H); x.fillRect(86, 0, 12, H); break;
      case 'ice': x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = 3; for (let k = 0; k < 14; k++) { const y0 = Math.random() * H; x.beginPath(); x.moveTo(0, y0); x.lineTo(W, y0 + rand(-60, 60)); x.stroke(); }
        x.strokeStyle = 'rgba(30,80,160,.5)'; x.lineWidth = 1.5; for (let k = 0; k < 8; k++) { x.beginPath(); let px = Math.random() * W, py = Math.random() * H; x.moveTo(px, py); for (let j = 0; j < 4; j++) { px += rand(-30, 30); py += rand(-30, 30); x.lineTo(px, py); } x.stroke(); } break;
      case 'asphalt': spk(1200, 'rgba(255,255,255,.07)', 'rgba(0,0,0,.2)'); dashes('#ffe14a'); edges('rgba(255,255,255,.85)'); break;
      case 'wet': spk(500, 'rgba(255,255,255,.06)', 'rgba(0,0,0,.25)'); x.fillStyle = 'rgba(255,255,255,.1)'; for (let k = 0; k < 10; k++) x.fillRect(Math.random() * W, Math.random() * H, rand(2, 6), rand(40, 160)); dashes('rgba(255,255,255,.8)'); edges('rgba(255,255,255,.7)'); break;
      case 'planks': for (let y = 0; y < H; y += 26) { x.fillStyle = shade(rand(.8, 1.15)); x.fillRect(0, y, W, 24); x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, y + 24, W, 2); x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(18, y + 11, 3, 3); x.fillRect(107, y + 11, 3, 3); x.fillStyle = 'rgba(0,0,0,.1)'; for (let k = 0; k < 3; k++) x.fillRect(Math.random() * W, y + 2, rand(10, 40), 1); } break;
      case 'cobbles': x.fillStyle = shade(.55); x.fillRect(0, 0, W, H); for (let y = 0; y < H + 8; y += 16) for (let xx = (y / 16) % 2 ? 8 : 0; xx < W + 8; xx += 16) { x.fillStyle = shade(rand(.8, 1.15)); x.beginPath(); x.ellipse(xx, y, 7, 6.5, 0, 0, 7); x.fill(); } break;
      case 'dirt': spk(900, 'rgba(0,0,0,.22)', 'rgba(255,220,160,.14)'); x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(28, 0, 16, H); x.fillRect(84, 0, 16, H); break;
      case 'sand': spk(700, 'rgba(0,0,0,.08)', 'rgba(255,255,255,.3)'); x.strokeStyle = 'rgba(0,0,0,.09)'; x.lineWidth = 2; for (let y = 6; y < H; y += 14) { x.beginPath(); for (let xx = 0; xx <= W; xx += 8) x.lineTo(xx, y + Math.sin(xx / 9 + y) * 3); x.stroke(); } break;
      case 'metal': x.fillStyle = 'rgba(255,255,255,.08)'; for (let k = -H; k < H; k += 20) { x.beginPath(); x.moveTo(0, k); x.lineTo(W, k + 60); x.lineTo(W, k + 64); x.lineTo(0, k + 4); x.fill(); } x.fillStyle = 'rgba(0,0,0,.4)'; for (let y = 8; y < H; y += 24) for (let xx = 8; xx < W; xx += 24) { x.beginPath(); x.arc(xx, y, 2, 0, 7); x.fill(); } edges('#7af8ff'); break;
      case 'grid': x.strokeStyle = 'rgba(122,248,255,.22)'; x.lineWidth = 7; for (let k = 0; k <= W; k += 32) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, H); x.stroke(); } for (let k = 0; k <= H; k += 32) { x.beginPath(); x.moveTo(0, k); x.lineTo(W, k); x.stroke(); }
        x.strokeStyle = '#7af8ff'; x.lineWidth = 2; for (let k = 0; k <= W; k += 32) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, H); x.stroke(); } for (let k = 0; k <= H; k += 32) { x.beginPath(); x.moveTo(0, k); x.lineTo(W, k); x.stroke(); } break;
      case 'lava': spk(600, 'rgba(0,0,0,.3)', 'rgba(255,255,255,.05)'); for (let k = 0; k < 9; k++) { x.beginPath(); let px = Math.random() * W, py = Math.random() * H; x.moveTo(px, py); for (let j = 0; j < 5; j++) { px += rand(-30, 30); py += rand(-40, 40); x.lineTo(px, py); } x.strokeStyle = 'rgba(255,120,30,.35)'; x.lineWidth = 8; x.stroke(); x.strokeStyle = '#ff8a1e'; x.lineWidth = 3; x.stroke(); x.strokeStyle = '#ffe14a'; x.lineWidth = 1; x.stroke(); } break;
      case 'glass': x.strokeStyle = 'rgba(255,255,255,.2)'; x.lineWidth = 1.5; for (let k = 0; k <= W; k += 16) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, H); x.stroke(); } for (let k = 0; k <= H; k += 16) { x.beginPath(); x.moveTo(0, k); x.lineTo(W, k); x.stroke(); } edges('rgba(255,255,255,.9)'); break;
      case 'gold': spk(900, 'rgba(255,255,255,.4)', 'rgba(120,80,0,.3)'); edges('rgba(80,50,0,.5)'); x.fillStyle = 'rgba(255,255,255,.18)'; for (let y = 0; y < H; y += 40) x.fillRect(0, y, W, 6); break;
      case 'coral': for (let k = 0; k < 90; k++) { x.fillStyle = pick(['rgba(255,122,184,.6)', 'rgba(255,160,112,.6)', 'rgba(255,208,224,.7)', 'rgba(255,255,255,.35)']); x.beginPath(); x.ellipse(Math.random() * W, Math.random() * H, rand(4, 12), rand(3, 9), rand(0, 3), 0, 7); x.fill(); } break;
      case 'rails': spk(600, 'rgba(0,0,0,.22)', 'rgba(255,220,160,.1)'); x.fillStyle = '#4a3a28'; for (let y = 0; y < H; y += 28) x.fillRect(14, y, 100, 10); x.fillStyle = '#aab0ba'; x.fillRect(34, 0, 7, H); x.fillRect(87, 0, 7, H); x.fillStyle = '#e8ecf2'; x.fillRect(36, 0, 2, H); x.fillRect(89, 0, 2, H); break;
    }
  }, [1, 1]);
  return (TT_TEX[key] = t);
}
const TT_GEO = {};
// (v293, the user: "that tunnel make it more concrete-like") poured concrete: pale grey panels with darker joints,
// tie holes and a few water stains; for the City tunnels and the overpass
let CONCRETE_TEX = null;
function concreteTex() {
  if (CONCRETE_TEX) return CONCRETE_TEX;
  CONCRETE_TEX = canvasTex(256, 256, (x) => {
    x.fillStyle = '#a9a8a3'; x.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 2600; k++) { const r = Math.random(); x.fillStyle = r < .5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.07)'; x.fillRect(rand(0, 256), rand(0, 256), rand(1, 3), rand(1, 3)); }
    for (let k = 0; k < 7; k++) { const sx = rand(0, 256), g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(60,55,50,.18)'); g.addColorStop(1, 'rgba(60,55,50,0)'); x.fillStyle = g; x.fillRect(sx, 0, rand(6, 22), rand(60, 200)); }
    x.fillStyle = 'rgba(55,55,55,.45)'; x.fillRect(0, 0, 256, 3); x.fillRect(0, 127, 256, 2); x.fillRect(0, 0, 3, 256); x.fillRect(127, 0, 2, 256);
    x.fillStyle = 'rgba(40,40,40,.5)'; for (const px of [32, 96, 160, 224]) for (const py of [32, 96, 160, 224]) { x.beginPath(); x.arc(px, py, 2.4, 0, 6.3); x.fill(); }
  });
  CONCRETE_TEX.wrapS = CONCRETE_TEX.wrapT = THREE.RepeatWrapping; return CONCRETE_TEX;
}
function ttGeo(k) {
  if (TT_GEO[k]) return TT_GEO[k]; let g;
  switch (k) {
    case 'bank': g = new THREE.SphereGeometry(1, 9, 6).scale(2.3, .9, 2.8); break;
    case 'crystal': g = new THREE.ConeGeometry(.55, 2.6, 5).translate(0, 1.3, 0); break;
    case 'post': g = new THREE.CylinderGeometry(.09, .11, 3.2, 8).translate(0, 1.6, 0); break;
    case 'orb': g = new THREE.SphereGeometry(.38, 10, 8).translate(0, 3.3, 0); break;
    case 'railpost': g = new THREE.BoxGeometry(.2, 1.1, .2).translate(0, .55, 0); break;
    case 'house': g = new THREE.BoxGeometry(4, 3.2, 3.6).translate(0, 1.6, 0); break;
    case 'roof': g = new THREE.ConeGeometry(3.1, 2.1, 4).translate(0, 4.2, 0); break;
    case 'pine': g = new THREE.ConeGeometry(1.7, 5, 7).translate(0, 3.3, 0); break;
    case 'trunk': g = new THREE.CylinderGeometry(.22, .3, 1.2, 6).translate(0, .6, 0); break;
    case 'bar': g = new THREE.BoxGeometry(.28, .28, 3.2); break;
    case 'palmTrunk': g = new THREE.CylinderGeometry(.22, .34, 5.5, 7).translate(0, 2.75, 0); break;
    case 'fronds': g = new THREE.SphereGeometry(1.9, 8, 6).scale(1, .45, 1).translate(0, 5.6, 0); break;
    case 'torch': g = new THREE.CylinderGeometry(.07, .1, 1.7, 6).translate(0, .85, 0); break;
    case 'flame': g = new THREE.ConeGeometry(.22, .6, 6).translate(0, 2, 0); break;
    case 'stall': g = new THREE.BoxGeometry(2.6, 1.9, 2.2).translate(0, .95, 0); break;
    case 'canopy': g = new THREE.BoxGeometry(3.2, .25, 2.8).translate(0, 2.4, 0); break;
    case 'rock': g = new THREE.DodecahedronGeometry(1.1, 0); break;
    case 'stem': g = new THREE.CylinderGeometry(.18, .26, 1.1, 7).translate(0, .55, 0); break;
    case 'cap': g = new THREE.SphereGeometry(.7, 10, 7).scale(1, .6, 1).translate(0, 1.2, 0); break;
    case 'tpost': g = new THREE.BoxGeometry(.34, 4.4, .34).translate(0, 2.2, 0); break;
    case 'beam': g = new THREE.BoxGeometry(1, .34, .34); break;
    case 'asteroid': g = new THREE.DodecahedronGeometry(1.4, 0); break;
    case 'lamp': g = new THREE.BoxGeometry(2.2, .18, .5); break;
    case 'bush': g = new THREE.SphereGeometry(.9, 8, 6).translate(0, 1.2, 0); break;
    case 'planter': g = new THREE.BoxGeometry(2, .7, 1.2).translate(0, .35, 0); break;
    case 'bunting': g = new THREE.BoxGeometry(1, .6, .04); break;
    case 'bpost': g = new THREE.CylinderGeometry(.12, .16, 5.3, 8).translate(0, 2.65, 0); break;   // (v275) the posts the flag lines hang from
    case 'goldbar': g = new THREE.BoxGeometry(.9, .4, .5).translate(0, .2, 0); break;
    case 'pierpost': g = new THREE.CylinderGeometry(.22, .22, 4, 7).translate(0, -2, 0); break;
  }
  return (TT_GEO[k] = g);
}
let TT_BUNT = null, TT_FIRS = null;
// (v293) a concrete box tunnel for a road type (City): straight walls, a flat ceiling with chamfered corners, a grimy
// base band, two rows of light strips in the ceiling and a heavy concrete portal at each end
function concreteRoof(T, add, inst, pts, inS, lit) {
  const { i0, i1 } = TRACK.sec, R = HALF + (T.roof === 'station' ? 2.4 : 1.9), Ht = 5.6, ch = 1.1;
  const cm = new THREE.MeshStandardMaterial({ map: concreteTex(), roughness: .95, side: THREE.DoubleSide, fog: !TDEF.clearRoad });
  const dirt = new THREE.MeshStandardMaterial({ map: concreteTex(), color: '#77746c', roughness: 1, side: THREE.DoubleSide, fog: !TDEF.clearRoad });
  add(new THREE.Mesh(strip(-R + ch, R - ch, Ht, Ht, { uvLen: 4, only: inS }), cm));
  for (const s of [-1, 1]) {
    add(new THREE.Mesh(strip(s * R, s * R, .8, Ht - ch, { uvLen: 4, only: inS }), cm));
    add(new THREE.Mesh(strip(s * R, s * R, -.1, .8, { uvLen: 4, only: inS }), dirt));
    add(new THREE.Mesh(strip(s * R, s * (R - ch), Ht - ch, Ht, { uvLen: 4, only: inS }), cm));
    add(new THREE.Mesh(strip(s * (R + .8), s * (R + .8), -.1, Ht + .8, { uvLen: 4, only: inS }), cm));   // the outside
  }
  add(new THREE.Mesh(strip(-R - .8, R + .8, Ht + .8, Ht + .8, { uvLen: 4, only: inS }), cm));
  const L = pts(9, 3.1, 0, Ht - .12).map((d) => ({ ...d, ry: Math.atan2(-d.p.tz, d.p.tx) }));
  inst(ttGeo('lamp'), lit('#fff3d6'), L);
  for (const ie of [i0 + 2, i1 - 3]) { const p = tp(ie), ry = Math.atan2(p.tx, p.tz), q = rolled(p, 0, Ht + .55);
    const top = add(new THREE.Mesh(new THREE.BoxGeometry(2 * R + 3.2, 1.6, 1.2), cm)); top.position.set(...q); top.rotation.y = ry;
    for (const s of [-1, 1]) { const c = rolled(p, s * (R + .8), (Ht + 1.35) / 2 - .1), m = add(new THREE.Mesh(new THREE.BoxGeometry(1.6, Ht + 1.35, 1.2), cm)); m.position.set(...c); m.rotation.y = ry; } }
}
function styleStretch(g, def, r) {
  const list = TRACK_TYPES[def.id]; if (!list || !TRACK.sec) return;
  const T = list[Math.min(r, list.length - 1)]; if (!T || !T.road) return;
  const { i0, i1 } = TRACK.sec, inS = (i) => i >= i0 && i < i1, space = def.id === 'space', KH = def.kerbH || .12, cave = !!def.tube;
  const add = (m) => { g.add(m); return m; };
  const kind = T.road[1], glossy = /ice|wet|glass|gold/.test(kind), glow = /grid|lava|glass/.test(kind) || space;
  // (v267, the user: "make the default road the same texture as the normal road… but you can make their ice or snow")
  // only SNOW and ICE lay their own surface (and kerbs) on the road; every other type keeps the map's own road and
  // changes only what is beside it, above it and in the air
  const surf = kind === 'snow' || kind === 'ice';
  const tex = ttTex(kind, T.road[0]);
  const rm = new THREE.MeshStandardMaterial({ map: tex, roughness: glossy ? .18 : .85, metalness: glossy ? .25 : 0, fog: !def.clearRoad, side: space ? THREE.DoubleSide : THREE.FrontSide,
    emissive: glow ? '#ffffff' : '#000000', emissiveMap: glow ? tex : null, emissiveIntensity: glow ? (kind === 'lava' ? .9 : .45) : 0, transparent: kind === 'glass', opacity: kind === 'glass' ? .82 : 1 });
  if (surf) add(new THREE.Mesh(strip(-HALF, HALF, .05, .05, { uvLen: 12, only: inS }), rm)).receiveShadow = true;
  if (T.kerb && surf) { const K = T.kerb.map((c) => new THREE.Color(c)), kc = (i) => K[Math.floor(i / 5) % 2], km = space ? new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7, fog: !def.clearRoad });
    for (const s of [-1, 1]) add(new THREE.Mesh(s > 0 ? strip(HALF, HALF + .9, .05, KH + .02, { colour: kc, only: inS }) : strip(-HALF - .9, -HALF, KH + .02, .05, { colour: kc, only: inS }), km)); }
  const cols = Array.isArray(T.c) ? T.c : [T.c || '#ffffff'], col = (k) => cols[((k % cols.length) + cols.length) % cols.length];
  const H0 = space ? 0 : -.08, lo = HALF + (T.lo ?? (cave ? 1.0 : 1.6)), hh = T.h ?? (cave ? .9 : H0);
  // spots along both sides of the stretch (every `step` points, from lat lo out to lo + spread)
  const pts = (step, l0, spread, h, one = false) => { const out = []; let k = 0; for (let i = i0 + 3; i < i1 - 3; i += step) { const p = tp(i); for (const s of one ? [1] : [-1, 1]) { const q = rolled(p, s * (l0 + rand(0, spread)), h); out.push({ x: q[0], y: q[1], z: q[2], p, sd: s, k: k++ }); } } return out; };
  const yawT = (p) => Math.atan2(p.tx, p.tz), yawN = (p) => Math.atan2(-p.nz, p.nx);
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .8, fog: !def.clearRoad, ...o }), lit = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, fog: false });
  const inst = (geo, mat, L, f) => { if (L.length) instanced(g, geo, mat, L.map((d) => ({ s: 1, ...d, ...(f ? f(d) : {}) })), !space); };
  const sheet = (c, y, w, from, emis) => { const m = new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: .86, roughness: .12, metalness: .15, side: THREE.DoubleSide, fog: !def.clearRoad, emissive: emis || '#000000', emissiveIntensity: emis ? 1.2 : 0 }); for (const s of [-1, 1]) add(new THREE.Mesh(strip(s * from, s * (from + w), y, y, { only: inS }), m)); };
  const rails = (c) => { const m = std(c, { roughness: .6 }); inst(ttGeo('railpost'), m, pts(5, HALF + 1.4, 0, H0)); for (const s of [-1, 1]) { add(new THREE.Mesh(strip(s * (HALF + 1.4), s * (HALF + 1.4), .96, 1.08, { only: inS }), m)); add(new THREE.Mesh(strip(s * (HALF + 1.4), s * (HALF + 1.4), .5, .58, { only: inS }), m)); } };
  const lamps = (c, step = 18, l = lo + .3) => { const P = pts(step, l, 0, hh); inst(ttGeo('post'), std('#2a2e3a', { roughness: .5 }), P); inst(ttGeo('orb'), lit(c), P); };
  const neon = (step = 7) => inst(ttGeo('bar'), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, fog: false }), pts(step, HALF + 1.25, 0, hh + .35), (d) => ({ ry: yawT(d.p), c: col(d.k) }));
  const rocks = (c, step = 7, l = lo + .6, spread = 3) => inst(ttGeo('rock'), std(c, { roughness: .95 }), pts(step, l, spread, hh), (d) => ({ s: rand(.5, 1.5), ry: rand(0, 6.3) }));
  switch (T.side) {
    case 'banks': inst(ttGeo('bank'), std(col(0)), pts(7, lo + .3, 1.4, H0), (d) => ({ s: rand(.7, 1.3), ry: rand(0, 6.3) })); break;
    case 'dunes': inst(ttGeo('bank'), std(col(0)), pts(9, HALF + 3.5, 5, H0), (d) => ({ sx: rand(1.6, 2.6), sy: rand(1.1, 1.9), sz: rand(1.6, 2.8), ry: rand(0, 6.3) })); break;
    case 'crystals': case 'coral': { const m = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: col(0), emissiveIntensity: T.side === 'coral' ? .25 : .7, roughness: .25, fog: !def.clearRoad });
      inst(ttGeo('crystal'), m, pts(4, lo, 1.6, hh), (d) => ({ s: rand(.5, 1.4), ry: rand(0, 6.3), c: col(d.k) })); if (T.side === 'coral') rocks('#8a7a80', 9); break; }
    case 'lamps': lamps(col(0)); break;
    case 'torches': { const P = pts(10, lo + .1, 0, hh); inst(ttGeo('torch'), std('#5a3a20'), P); inst(ttGeo('flame'), lit(col(0)), P, (d) => ({ s: rand(.8, 1.3) })); break; }
    case 'rail': rails(col(0)); break;
    case 'pier': rails(col(0)); inst(ttGeo('pierpost'), std('#6a4a30'), pts(6, HALF + .4, 0, 0)); sheet(col(1), -.9, 22, HALF + 1.1); break;
    case 'houses': { const P = pts(16, HALF + 4.6, .8, H0 - .2).map((d) => ({ ...d, sc: rand(.85, 1.15), ry: yawN(d.p) + (d.sd > 0 ? 0 : Math.PI) }));
      inst(ttGeo('house'), std('#ffffff'), P, (d) => ({ s: d.sc, c: col(d.k) })); inst(ttGeo('roof'), std('#a0403a'), P, (d) => ({ s: d.sc, ry: d.ry + Math.PI / 4 })); break; }
    case 'pines': if (def.id === 'alps') {   // (v272, the user) the same snowy firs as the rest of Alpine Peaks, set back from the road
        const F = TT_FIRS || (TT_FIRS = { geos: [firGeo(1), firGeo(2), firGeo(3)], mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, flatShading: true }) });
        const P = pts(6, lo + 2.6, 3.4, H0).map((d) => ({ ...d, s: rand(.55, .9), ry: rand(0, 6.3) }));
        F.geos.forEach((fg, n) => inst(fg, F.mat, P.filter((_, k) => k % 3 === n))); break;
      } else { const P = pts(6, lo + .9, 3.2, H0).map((d) => ({ ...d, sc: rand(.8, 1.35) })); inst(ttGeo('trunk'), std('#5a3a20'), P, (d) => ({ s: d.sc })); inst(ttGeo('pine'), std('#ffffff'), P, (d) => ({ s: d.sc, ry: rand(0, 6.3), c: col(d.k) })); break; }
    case 'palms': { const P = pts(11, lo + 1.2, 2.5, H0).map((d) => ({ ...d, sc: rand(.8, 1.2) })); inst(ttGeo('palmTrunk'), std(col(1)), P, (d) => ({ s: d.sc })); inst(ttGeo('fronds'), std(col(0)), P, (d) => ({ s: d.sc, ry: rand(0, 6.3) })); lamps('#ffd080', 26, lo + .2); break; }
    case 'lake': sheet(col(0), -.22, 16, HALF + 1.1); inst(ttGeo('crystal'), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#bff4ff', emissiveIntensity: .5, roughness: .25, fog: !def.clearRoad }), pts(14, HALF + 4, 8, -.2), (d) => ({ s: rand(.6, 1.6), ry: rand(0, 6.3) })); break;
    case 'tide': sheet(col(0), -.18, 14, HALF + 1.1); rocks(col(1), 8, HALF + 2.5, 6); break;
    case 'lava': sheet(col(1), -.16, 12, HALF + 1.4, '#ff6a1e'); rocks(col(0), 7); break;
    case 'neon': neon(); break;
    case 'stalls': { const P = pts(14, HALF + 3.2, .6, H0).map((d) => ({ ...d, ry: yawT(d.p) })); inst(ttGeo('stall'), std('#e8e0d0'), P, (d) => ({ c: col(d.k + 1) })); inst(ttGeo('canopy'), std('#ffffff'), P, (d) => ({ c: col(d.k) })); break; }
    case 'rocks': rocks(col(0)); break;
    case 'mushrooms': { const P = pts(5, lo, 2, hh).map((d) => ({ ...d, sc: rand(.6, 1.5) })); inst(ttGeo('stem'), std('#e8e0d0'), P, (d) => ({ s: d.sc })); inst(ttGeo('cap'), lit('#ffffff'), P, (d) => ({ s: d.sc, c: col(d.k) })); break; }
    case 'timber': { const P = pts(8, lo + .2, 0, H0, true).map((d) => ({ ...d, q: rolled(d.p, 0, H0) })); const m = std(col(0), { roughness: .9 });
      inst(ttGeo('tpost'), m, pts(8, lo + .2, 0, H0)); inst(ttGeo('beam'), m, P, (d) => ({ x: d.q[0], y: d.q[1] + 4.4, z: d.q[2], sx: 2 * (lo + .2) + .4, ry: yawN(d.p) })); lamps('#ffd080', 24, lo - .3); break; }
    case 'asteroids': inst(ttGeo('asteroid'), std('#ffffff', { roughness: .95 }), pts(5, HALF + 4, 9, 0), (d) => ({ y: d.y + rand(-4, 7), s: rand(.5, 2.2), ry: rand(0, 6.3), c: col(d.k) })); break;
    case 'rings': { const R = HALF + 2.6, geo = ttGeo('ring' + R) || (TT_GEO['ring' + R] = new THREE.TorusGeometry(R, .24, 8, 28)); inst(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, fog: false }), pts(space ? 10 : 16, 0, 0, 1.2, true), (d) => ({ ry: yawT(d.p), c: col(d.k) })); break; }
    case 'bushes': { const P = pts(8, lo + .3, 0, H0); inst(ttGeo('planter'), std(col(1)), P); inst(ttGeo('bush'), std(col(0)), P, (d) => ({ s: rand(.8, 1.3) })); break; }
    case 'gold': { const P = pts(10, lo + .2, 1.5, hh); const m = std('#ffd23a', { metalness: .8, roughness: .25 }); inst(ttGeo('goldbar'), m, P, (d) => ({ ry: rand(0, 6.3) })); inst(ttGeo('goldbar'), m, P, (d) => ({ y: d.y + .4, ry: rand(0, 6.3) })); inst(ttGeo('goldbar'), m, P, (d) => ({ y: d.y + .8, ry: rand(0, 6.3), s: .8 })); lamps('#fff0b0', 22, lo - .3); break; }
  }
  if (T.under === 'posts') inst(ttGeo('pierpost'), std('#6a4a30'), pts(6, HALF + .4, 0, 0));
  // a roof
  if (T.roof === 'tunnel' && T.concrete) concreteRoof(T, add, inst, pts, inS, lit);
  else if (T.roof === 'tunnel') { const R = HALF + 1.7, geo = TT_GEO['arch' + R] || (TT_GEO['arch' + R] = new THREE.TorusGeometry(R, .3, 7, 22, Math.PI)), m = std(T.rc || '#6a6a74', { side: THREE.DoubleSide, roughness: .9 });
    inst(geo, m, pts(8, 0, 0, 0, true), (d) => ({ ry: yawT(d.p) }));
    add(new THREE.Mesh(strip(-R, R, R - .15, R - .15, { only: inS }), m)); for (const s of [-1, 1]) add(new THREE.Mesh(strip(s * R, s * R, 0, R - .15, { only: inS }), m));
    if (!T.side || T.side === 'lamps') {} else lamps('#fff4c0', 20, R - .6); }
  if (T.roof === 'station' && T.concrete) concreteRoof(T, add, inst, pts, inS, lit);
  else if (T.roof === 'station') { const R = HALF + 2.6, m = std(T.rc || '#2a2e40', { side: THREE.DoubleSide, roughness: .5, metalness: .3 });
    add(new THREE.Mesh(strip(-R, R, 6.2, 6.2, { only: inS }), m)); for (const s of [-1, 1]) add(new THREE.Mesh(strip(s * R, s * R, -.6, 6.2, { only: inS }), m));
    inst(ttGeo('lamp'), lit('#dff0ff'), pts(10, 0, 0, 6.0, true), (d) => ({ ry: yawN(d.p) })); }
  if (T.roof === 'bunting') { if (!TT_BUNT) TT_BUNT = canvasTex(256, 64, (x) => { x.strokeStyle = '#3a3a44'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 5); x.lineTo(256, 5); x.stroke(); const cs = ['#e8403a', '#ffe14a', '#4fc84a', '#2a9fe6', '#ff5db1', '#ffffff']; for (let k = 0; k < 9; k++) { x.fillStyle = cs[k % cs.length]; x.beginPath(); x.moveTo(k * 28 + 2, 6); x.lineTo(k * 28 + 28, 6); x.lineTo(k * 28 + 15, 52); x.closePath(); x.fill(); } });
    const m = new THREE.MeshStandardMaterial({ map: TT_BUNT, alphaTest: .5, side: THREE.DoubleSide, roughness: .8, fog: !def.clearRoad });
    // (v275, the user: fewer flag lines, about 10 over the whole stretch, each hung between two posts so none floats in the air)
    const B = pts(Math.max(14, Math.ceil((i1 - i0 - 6) / 10)), 0, 0, 4.8, true), PO = [];
    for (const d of B) for (const s of [-1, 1]) { const q = rolled(d.p, s * (HALF + 1.3), H0); PO.push({ x: q[0], y: q[1], z: q[2] }); }
    inst(ttGeo('bunting'), m, B, (d) => ({ sx: 2 * HALF + 2.6, ry: yawN(d.p) }));
    inst(ttGeo('bpost'), std('#5a4030', { roughness: .7 }), PO); }
}
// the weather of a type, round the camera while you are on its stretch
const TT_FX = {
  snow: { c: ['#ffffff'], size: .24, fall: 2.2, sway: .3, lo: -8, hi: 14, n: 600, op: .9 },
  rain: { c: ['#bfe0ff'], size: .13, fall: 16, sway: 0, lo: -8, hi: 16, n: 700, op: .7 },
  drips: { c: ['#9fd8ff'], size: .15, fall: 9, sway: 0, lo: -6, hi: 8, n: 250, op: .8 },
  sparkle: { c: ['#ffffff', '#bff4ff', '#fff6b0'], size: .17, fall: .35, sway: .25, lo: -3, hi: 10, n: 450, op: 1 },
  aurora: { c: ['#3cff8a', '#c84aff', '#7af8ff'], size: 7, fall: -.15, sway: .8, lo: 9, hi: 26, n: 180, op: .22 },
  embers: { c: ['#ff8a1e', '#ffd23a', '#ff4a1e'], size: .22, fall: -1.6, sway: .9, lo: -2, hi: 12, n: 350, op: .9 },
  bubbles: { c: ['#bff4ff', '#ffffff'], size: .18, fall: -.9, sway: .5, lo: -4, hi: 10, n: 300, op: .7 },
  stars: { c: ['#ffffff', '#ffe14a', '#7af8ff'], size: .12, fall: 0, sway: .1, lo: -8, hi: 14, n: 500, op: 1 },
  dust: { c: ['#f0dcb0', '#e8d0a0'], size: .3, fall: .2, sway: 1.4, lo: -2, hi: 8, n: 300, op: .35 },
  petals: { c: ['#ffb3d1', '#ff8ab8', '#ffd6e6'], size: .22, fall: .9, sway: .8, lo: -6, hi: 12, n: 400, op: .9 },
};
function buildTrackFx(scene, W) {
  const dot = canvasTex(32, 32, (x) => { const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); });
  const n = 700, sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); sg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  W.fx = new THREE.Points(sg, new THREE.PointsMaterial({ map: dot, size: .2, transparent: true, depthWrite: false, opacity: .9, vertexColors: true })); W.fx.frustumCulled = false; W.fx.visible = false; W.fxKind = null; scene.add(W.fx);
}
const SNOW_SLOW = .92, ICE_GRIP = 3.8;   // (v267) snow: 8 % lower top speed; ice: the travel direction follows the nose at 3.8/s (AI 7.6/s)
const surfOf = (r) => { if (!inRouteSec(r) || r.idx < TRACK.sec.i0 || r.idx >= TRACK.sec.i1) return null; const T = typeOf(r.route); const k = T && T.road && T.road[1]; return k === 'snow' || k === 'ice' ? k : null; };
const typeOf = (r) => { const L = TDEF && TRACK_TYPES[TDEF.id]; return L ? L[Math.min(r || 0, L.length - 1)] : null; };
function updateTrackType(dt) {
  const W = WORLD, P = race && race.player; if (!W || !P || !TRACK.routes) return;
  const T = inRouteSec(P) ? typeOf(P.route) : null, t = performance.now() / 1000;
  // the weather
  if (W.fx) { const want = T && T.fx ? T.fx : null;
    if (want !== W.fxKind) { W.fxKind = want; W.fx.visible = !!want;
      if (want) { const F = TT_FX[want], sp = W.fx.geometry.attributes.position, cl = W.fx.geometry.attributes.color, cp = W.camera.position, cc = new THREE.Color();
        for (let i = 0; i < F.n; i++) { sp.setXYZ(i, cp.x + rand(-30, 30), cp.y + rand(F.lo, F.hi), cp.z + rand(-30, 30)); cc.set(pick(F.c)); cl.setXYZ(i, cc.r, cc.g, cc.b); }
        sp.needsUpdate = cl.needsUpdate = true; W.fx.geometry.setDrawRange(0, F.n); W.fx.material.size = F.size; W.fx.material.opacity = F.op; W.fxCfg = F; } }
    if (W.fxKind) { const F = W.fxCfg, sp = W.fx.geometry.attributes.position, cp = W.camera.position, span = F.hi - F.lo;
      for (let i = 0; i < F.n; i++) {
        let y = sp.getY(i) - dt * F.fall; if (y < cp.y + F.lo) y += span; else if (y > cp.y + F.hi) y -= span; sp.setY(i, y);
        let x = sp.getX(i) + Math.sin(t + i) * dt * F.sway; if (x < cp.x - 30) x += 60; else if (x > cp.x + 30) x -= 60; sp.setX(i, x);
        let z = sp.getZ(i) + Math.cos(t * .7 + i) * dt * F.sway * .5; if (z < cp.z - 30) z += 60; else if (z > cp.z + 30) z -= 60; sp.setZ(i, z);
      } sp.needsUpdate = true; } }
  // the dark: the night types pull the lights and the fog down while you are on them (not in space: its lights are animated)
  if (TDEF.id === 'space' || !W.scene) return;
  const want = T && T.dark ? T.dark : 0; if (T && T.dark) W.dkFog = T.fog || '#05060f';
  if (W.dk == null) { W.dk = 0; const hemi = W.scene.children.find((o) => o.isHemisphereLight); W.dkBase = { hemi, hi: hemi ? hemi.intensity : 0, sun: W.sun ? W.sun.intensity : 0, env: W.scene.environmentIntensity, fog: W.scene.fog ? { c: W.scene.fog.color.clone(), n: W.scene.fog.near, f: W.scene.fog.far } : null }; }
  if (Math.abs(want - W.dk) < .002 && !W.dk) return;
  W.dk += (want - W.dk) * Math.min(1, dt * 2); if (Math.abs(W.dk) < .002 && !want) W.dk = 0;
  const k = W.dk, B = W.dkBase, sc = W.scene;
  if (B.hemi) B.hemi.intensity = B.hi * (1 - .72 * k); if (W.sun) W.sun.intensity = B.sun * (1 - .85 * k); sc.environmentIntensity = B.env * (1 - .7 * k);
  if (B.fog && sc.fog) { sc.fog.color.copy(B.fog.c).lerp(_dkC.set(W.dkFog || '#05060f'), k); sc.fog.near = B.fog.n * (1 - .5 * k); sc.fog.far = B.fog.f * (1 - .62 * k); }
  if ('backgroundIntensity' in sc) sc.backgroundIntensity = 1 - .82 * k;
}
const _dkC = new THREE.Color();

// (v262, the user: "where the road changes, the car bugs into the jump") a variant's points are spaced along ITS OWN
// length, so in the stretch the same spot on the road has a different distance on every variant (up to 10 m on Robo
// City). A ramp or a pad stands in one place: on every variant it gets the distance of that road's nearest point.
function routeSs(W) {
  if (!TRACK.routes || !TRACK.sec) return;
  const { i0, i1 } = TRACK.sec, B = TRACK.routes[0], N = B.length;
  const near = (s, R) => {
    const i = Math.round(s / STEP) % N; if (i < i0 || i >= i1) return s;
    const P = B[i]; let best = 1e18, bi = i;
    for (let j = Math.max(i0, i - 60); j <= Math.min(i1, i + 60); j++) { const q = R[j], d = (q.x - P.x) ** 2 + (q.z - P.z) ** 2; if (d < best) { best = d; bi = j; } }
    // between that point and its neighbours: where along the segment the spot projects
    let fr = 0; for (const [a, b, sg] of [[bi, bi + 1, 1], [bi - 1, bi, -1]]) { if (a < i0 || b > i1) continue; const A = R[a], Bq = R[b], vx = Bq.x - A.x, vz = Bq.z - A.z, l2 = vx * vx + vz * vz || 1, t = ((P.x - A.x) * vx + (P.z - A.z) * vz) / l2; if (t >= 0 && t <= 1) { fr = sg > 0 ? t : t - 1; break; } }
    return (bi + fr) * STEP;
  };
  for (const o of W.ramps.concat(W.pads)) o.sr = TRACK.routes.map((R, r) => (r ? near(o.s, R) : o.s));
  rampsOnRoutes(W);
}
// (v267, the user: "on the new roads you didn't match the jumps… I go through it and I jump right after that") a ramp or
// boost pad in the changing stretch was drawn once, on the first road, while each variant jumps at its own distance:
// on a variant you drove through a ramp that wasn't on your road and took off where nothing showed. Now every one of
// them in (or touching) the stretch is drawn on EVERY variant's own road, at exactly the distance its jump uses, inside
// that variant's group, so you see the ramp where you take off
function rampsOnRoutes(W) {
  if (!W.routeGroups || !TRACK.sec) return; const { i0, i1 } = TRACK.sec, N = TRACK.routes[0].length;
  const touches = (s, len) => { const a = Math.floor(s / STEP) % N, b = Math.ceil((s + len) / STEP) % N; return b >= i0 - 4 && a <= i1 + 4; };
  for (const [list, len, mk] of [[W.ramps, RAMP_LEN, (o, r) => W.rampMesh(o.sr[r], W.routeGroups[r], o.ringLat)], [W.pads, 2, (o, r) => W.padMesh(o.sr[r], o.lat, W.routeGroups[r])]]) {
    for (const o of list) {
      if (!o.ms || !touches(o.s - 2, len + 2)) continue;
      for (const m of o.ms) { m.removeFromParent(); W.routeGroups[0].add(m); }   // the first road's own, shown with its road
      o.msr = [o.ms]; for (let r = 1; r < TRACK.routes.length; r++) { TRACK.pts = TRACK.routes[r]; o.msr[r] = mk(o, r); }
      TRACK.pts = TRACK.routes[0]; o.perRoute = true;
    }
  }
}
// (v292) the flame ring over every jump: its size, how many flame tongues, and one frame of their flicker
const RING_R = 2.1, RING_FLAMES = 46, _fq = new THREE.Quaternion(), _fz = new THREE.Vector3(0, 0, 1), _fm = new THREE.Matrix4(), _fp = new THREE.Vector3(), _fs = new THREE.Vector3();
function flameRing(g, t) {
  const U = g.userData, fl = U.fl, hot = 1 + U.flare * .8;
  for (let i = 0; i < RING_FLAMES; i++) {
    // every other tongue is a small one; each has its own length, spot and flicker, and they all rise (the top ones
    // are the tallest, the bottom ones short), so the hoop reads as fire, not a sun
    const h1 = (Math.sin((i + 1) * 12.9898 + U.ph) * 43758.5453) % 1, h = Math.abs(h1), small = i % 2 === 1;
    const a = (i + (h - .5) * .7) / RING_FLAMES * Math.PI * 2, cx = Math.cos(a), cy = Math.sin(a);
    let dx = cx * .8, dy = cy * .8 + .75; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
    const k = .5 + .5 * Math.sin(t * (9 + 5 * h) + i * 2.3 + U.ph) * Math.cos(t * (5.3 + 3 * h) + i * .9);
    const len = (small ? .5 : .75 + .7 * h) * (.6 + .7 * k) * (.5 + .7 * Math.max(0, dy)) * hot, w = (small ? .6 : .85 + .35 * h) * (.85 + .3 * k);
    _fq.setFromAxisAngle(_fz, Math.atan2(-dx, dy)); _fp.set(cx * (RING_R + (small ? -.04 : .08)), cy * (RING_R + (small ? -.04 : .08)), small ? .12 : 0); _fs.set(w, len, w);
    fl.setMatrixAt(i, _fm.compose(_fp, _fq, _fs));
  }
  fl.instanceMatrix.needsUpdate = true;
}
function buildArcade(scene, W, def) {
  // jump ramps across the whole road: an orange slope with white chevrons (v119, the user — the same on every map)
  const rampTex = chevrons('#ffffff', '#ffffff', '#ff7a18'); rampTex.wrapS = rampTex.wrapT = THREE.RepeatWrapping; rampTex.repeat.set(4, 1);
  const rampMat = new THREE.MeshStandardMaterial({ map: rampTex, emissive: '#ffffff', emissiveMap: rampTex, emissiveIntensity: .32, roughness: .45, side: THREE.DoubleSide }), sideMat = M('#1b2a4a', { roughness: .6, side: THREE.DoubleSide });
  // (v292, the user: "instead of tricks add there rings you need to jump through, 1 in each jump, it's a flame ring")
  // over every jump hangs a burning hoop (somewhere across the road since v294) where a kart at full speed reaches the top of its
  // flight: line up with it before the ramp and you fly through it (a big boost on landing). A bright hoop, a soft
  // orange glow and a crown of flickering flame tongues (one instanced mesh, animated only near the camera).
  W.rings = [];
  const RF = (() => { const v = TUNE.baseSpeed * 1.05, vy = 2.5 + v * .22, g = def.gravity || 30; return { d: v * vy / g, h: vy * vy / (2 * g) }; })();
  const ringCore = new THREE.TorusGeometry(RING_R, .17, 10, 64), ringGlow = new THREE.TorusGeometry(RING_R, .44, 10, 64);
  const coreMat = new THREE.MeshBasicMaterial({ color: '#ffd23e', toneMapped: false }), glowMat = new THREE.MeshBasicMaterial({ color: '#ff6a12', transparent: true, opacity: .32, depthWrite: false, toneMapped: false });
  const flameGeo = (() => {   // a tongue of flame: an open cone, white-yellow at its foot, orange, then red and see-through at the tip
    const g = new THREE.ConeGeometry(.34, 1, 10, 6, true).translate(0, .5, 0), P = g.attributes.position, col = new Float32Array(P.count * 4);
    const c0 = new THREE.Color('#fff2a8'), c1 = new THREE.Color('#ff9a14'), c2 = new THREE.Color('#ff3300'), c = new THREE.Color();
    for (let i = 0; i < P.count; i++) { const t = P.getY(i); if (t < .45) c.lerpColors(c0, c1, t / .45); else c.lerpColors(c1, c2, (t - .45) / .55); col.set([c.r, c.g, c.b, t < .45 ? .95 : .95 * (1 - (t - .45) / .55)], i * 4); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 4)); return g;
  })();
  const flameMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  // (v294, the user: "the flame rings should be randomly on the jump, more left or right") each ring hangs at its own
  // random spot across the road, .6–4 m to a random side of the middle (the hoop stays inside the road; new every race,
  // the same on every road variant)
  const ringAt = (s0, into, lat = 0) => {
    const sR = s0 + RAMP_LEN + RF.d, q = at(sR), y = at(s0 + RAMP_LEN).p.y + RAMP_H + RF.h + .65;   // (the kart's middle at the top of its flight)
    const ring = new THREE.Group(); ring.position.set(...rolled(q.p, lat, y - q.p.y)); ring.rotation.y = -angleOf(q.p);
    ring.add(new THREE.Mesh(ringCore, coreMat), new THREE.Mesh(ringGlow, glowMat));
    const fl = new THREE.InstancedMesh(flameGeo, flameMat, RING_FLAMES); fl.frustumCulled = false; ring.add(fl);
    ring.userData = { s: sR, y, lat, fl, ph: Math.random() * 9, flare: 0 }; into.add(ring); W.rings.push(ring); flameRing(ring, 0);
    return ring;
  };
  W.anim.push((dt, t) => { const C = W.camera && W.camera.position; for (const g of W.rings) {
    if (g.userData.flare > 0) { g.userData.flare = Math.max(0, g.userData.flare - dt * 1.6); g.scale.setScalar(1 + .35 * Math.sin(g.userData.flare * Math.PI)); }
    if (!C || !g.parent || !g.parent.visible || (g.position.x - C.x) ** 2 + (g.position.z - C.z) ** 2 > 170 ** 2) continue;
    flameRing(g, t);
  } });
  // (v267) a ramp's meshes on whichever road TRACK.pts is at the moment (rampsOnRoutes draws one on every variant)
  W.rampMesh = (s0, into, ringLat = 0) => {
    const top = new THREE.Mesh(trackQuad(s0, s0 + RAMP_LEN, -HALF - .4, HALF + .4, .03, RAMP_H), rampMat); top.castShadow = top.receiveShadow = true; into.add(top);
    const e = at(s0 + RAMP_LEN).p, a = at(s0).p, pos = [];
    const P = (p, l, y) => rolled(p, l, y), L0 = -HALF - .4, L1 = HALF + .4;
    pos.push(...P(e, L0, 0), ...P(e, L1, 0), ...P(e, L0, RAMP_H), ...P(e, L1, 0), ...P(e, L1, RAMP_H), ...P(e, L0, RAMP_H));
    for (const l of [L0, L1]) pos.push(...P(a, l, .03), ...P(e, l, 0), ...P(e, l, RAMP_H));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); const side = new THREE.Mesh(g, sideMat); into.add(side);
    return [top, side, ringAt(s0, into, ringLat)];
  };
  W.ramps = RAMP_AT.map((f) => { const s0 = f * TRACK.L, ringLat = pick([-1, 1]) * rand(.6, 4); return { s: s0, ringLat, ms: W.rampMesh(s0, scene, ringLat) }; });
  // boost pads: glowing arrows that scroll forwards
  W.padTex = chevrons(...def.pad); W.padTex.wrapT = THREE.RepeatWrapping;
  const padMat = new THREE.MeshStandardMaterial({ map: W.padTex, emissive: '#ffffff', emissiveIntensity: .55, emissiveMap: W.padTex, roughness: .35, polygonOffset: true, polygonOffsetFactor: -2 });
  W.padMesh = (s, lat, into) => { const m = new THREE.Mesh(trackQuad(s - 2, s + 2, lat - 1.6, lat + 1.6, .05, .05), padMat); into.add(m); return [m]; };
  W.pads = PAD_AT.map(({ f, lat }) => ({ s: f * TRACK.L, lat, ms: W.padMesh(f * TRACK.L, lat, scene) }));
  // gold coins in wavy lines
  // the coins are the game's own painted silver coin (ui/coin.png on both faces of a disc, a steel rim)
  if (!BASE.coinTex) { BASE.coinTex = new THREE.TextureLoader().load('ui/coin.png?v=1'); BASE.coinTex.colorSpace = THREE.SRGBColorSpace; BASE.coinTex.anisotropy = 4; }
  const coinGeo = new THREE.CylinderGeometry(.5, .5, .09, 28).rotateX(Math.PI / 2);
  const faceM = new THREE.MeshStandardMaterial({ map: BASE.coinTex, transparent: true, alphaTest: .4, metalness: .35, roughness: .35, emissive: '#ffffff', emissiveMap: BASE.coinTex, emissiveIntensity: .25 });
  const coinMat = [new THREE.MeshStandardMaterial({ color: '#c8d2e4', metalness: .85, roughness: .3 }), faceM, faceM];
  COIN_AT.forEach((f, n) => { if (inRoll(f) || BUSY.some((b) => Math.abs(b - f) < .012)) return; const lat0 = [-3, 0, 3][n % 3]; for (let k = 0; k < 5; k++) {
    const lt = lat0 + Math.sin(k * .9) * 1.2, p = at(f * TRACK.L + k * 2.6, lt), m = new THREE.Mesh(coinGeo, coinMat); m.position.set(...rolled(p.p, lt, .85)); m.castShadow = true;
    scene.add(m); W.coins.push({ m, x: p.x, z: p.z, y: p.y + .85, on: true });
  } });
}
function puff(x, y, z, color, size = .5, life = .45, vx = 0, vy = .8, vz = 0, grav = 0) {
  const p = WORLD.puffs.find((q) => q.life <= 0); if (!p) return;
  p.s.visible = true; p.s.position.set(x, y, z); p.s.material.color.set(color); p.size = size; p.life = p.max = life; p.v = [vx, vy, vz]; p.g = grav;
}
function updatePuffs(dt) {
  for (const p of WORLD.puffs) {
    if (p.life <= 0) continue; p.life -= dt;
    if (p.life <= 0) { p.s.visible = false; continue; }
    const k = p.life / p.max; if (p.g) p.v[1] -= p.g * dt;
    p.s.position.x += p.v[0] * dt; p.s.position.y += p.v[1] * dt; p.s.position.z += p.v[2] * dt;
    p.s.scale.setScalar(p.size * (1.6 - k * .6)); p.s.material.opacity = k;
  }
}

/* ---------- showroom: the menu and garage backdrop (a snowy podium in front of the Alps) ---------- */
const SHOW = {};
function buildShowroom() {
  // the lobby look: a sunset sky, the racer lit from the front and outlined by a cool light from behind
  // a bright blue winter sky with an aurora (green into violet) across the top, as in the mockup
  const sky = canvasTex(1024, 512, (g) => {
    const W = 1024, H = 512; let r0 = 12345; const rnd = () => { r0 = (r0 * 16807) % 2147483647; return r0 / 2147483647; };
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#0e2a84'); gr.addColorStop(.28, '#2a66dc'); gr.addColorStop(.6, '#7fc0f5'); gr.addColorStop(.85, '#cfe8ff'); gr.addColorStop(1, '#eaf5ff');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // stars, denser and brighter towards the top
    for (let i = 0; i < 260; i++) { const y = rnd() ** 1.8 * H * .55, x = rnd() * W, sz = .6 + rnd() * 1.6; g.fillStyle = `rgba(255,255,255,${(.35 + rnd() * .65) * (1 - y / (H * .6))})`; g.beginPath(); g.arc(x, y, sz, 0, 7); g.fill(); }
    for (let i = 0; i < 9; i++) { const x = rnd() * W, y = rnd() * H * .35; g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(x - 4, y - .6, 8, 1.2); g.fillRect(x - .6, y - 4, 1.2, 8); }
    // the aurora: curtains of many thin vertical strokes that wave along a sine, green and violet, fading downwards
    g.globalCompositeOperation = 'lighter';
    const curtain = (x0, w, top, hgt, hue, amp, ph) => {
      for (let x = x0; x < x0 + w; x += 2) {
        const t = (x - x0) / w, wave = Math.sin(t * 6.3 + ph) * amp + Math.sin(t * 17 + ph * 2) * amp * .3, y0 = top + wave, len = hgt * (.55 + .45 * Math.abs(Math.sin(t * 9 + ph)));
        const a = g.createLinearGradient(0, y0, 0, y0 + len);
        a.addColorStop(0, `hsla(${hue},100%,70%,0)`); a.addColorStop(.18, `hsla(${hue},100%,66%,${.55 * Math.sin(t * Math.PI)})`); a.addColorStop(1, `hsla(${hue + 40},100%,70%,0)`);
        g.fillStyle = a; g.fillRect(x, y0, 2.2, len);
      }
    };
    curtain(40, 420, 10, 230, 150, 18, 0); curtain(300, 520, -10, 260, 270, 24, 1.7); curtain(620, 380, 20, 210, 160, 14, 3.1); curtain(0, 260, 40, 150, 285, 10, 4.4);
    g.globalCompositeOperation = 'source-over';
    // soft clouds low in the sky
    for (let i = 0; i < 14; i++) { const x = rnd() * W, y = H * (.5 + rnd() * .22), rx = 40 + rnd() * 90, ry = 10 + rnd() * 16; const c = g.createRadialGradient(x, y, 0, x, y, rx); c.addColorStop(0, 'rgba(255,255,255,.55)'); c.addColorStop(.6, 'rgba(255,255,255,.22)'); c.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = c; g.save(); g.scale(1, ry / rx); g.beginPath(); g.arc(x, y * rx / ry, rx, 0, 7); g.fill(); g.restore(); }
  });
  sky.minFilter = THREE.LinearFilter; sky.generateMipmaps = false;
  const scene = new THREE.Scene(); SHOW.scene = scene; scene.background = sky; scene.environment = ENV; scene.fog = new THREE.Fog('#cfe3ff', 55, 340);
  const sun = addLights(scene, 1024, 4, { hemi: [0xcfe2ff, 0x8f9ad8, 1.25], sun: [0xfff0d8, 2.6] }); sun.position.set(4, 9, 6);
  const rim = new THREE.DirectionalLight(0x9fd0ff, 2.4); rim.position.set(-3, 4, -6); scene.add(rim);
  // rolling snow: flat round the stand, soft hills further out (the trees, chalet, snowman and poles stand on it)
  const LOB_H = (x, z) => { const r = Math.hypot(x, z), k = smoothstep(9, 24, r); return k * (1.2 * Math.sin(x * .13) * Math.cos(z * .11) + .8 * Math.sin(x * .07 + z * .09) + .5 * Math.sin(x * .23 - z * .17) + 1.1); };
  SHOW.groundAt = LOB_H;
  {
    const g = new THREE.PlaneGeometry(340, 340, 220, 220).rotateX(-Math.PI / 2), p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(), lo = new THREE.Color('#d9e6ff'), hi = new THREE.Color('#ffffff');
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = LOB_H(x, z); p.setY(i, y); c.copy(lo).lerp(hi, smoothstep(-.4, 2.6, y)); col.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: snowTexture([34, 34]), vertexColors: true, roughness: .95 })); ground.receiveShadow = true; scene.add(ground); SHOW.ground = ground;
    ground.material.color.set('#a4afd6');   // (v77: a lavender-blue base, so the lobby light no longer burns the snow to plain white and the shadows and sky colours show)
    const far = new THREE.Mesh(new THREE.CircleGeometry(600, 48).rotateX(-Math.PI / 2), M('#eef4ff', { roughness: .95 })); far.position.y = -.6; scene.add(far);
  }
  const pod = new THREE.Mesh(new THREE.CylinderGeometry(1.78, 1.92, .3, 52), M('#7d87ad', { roughness: .3, metalness: .65 })); pod.position.y = .15; pod.receiveShadow = true; scene.add(pod);
  const podTop = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.72, .06, 52), M('#2f3a63', { roughness: .45, metalness: .35 })); podTop.position.y = .31; scene.add(podTop);
  // THE LIGHTS ARE ALL SOLID GEOMETRY (no see-through glow materials: on the user's phone those drew as opaque slabs
  // and a big cone hid the kart). Neon = MeshBasicMaterial, which ignores the lighting and always shows its full colour.
  const neon = (c) => new THREE.MeshBasicMaterial({ color: c, fog: false });
  const flat = (r0, r1, c, y) => { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 72).rotateX(-Math.PI / 2), neon(c)); m.position.y = y; scene.add(m); return m; };
  // on the dais: three cyan neon rings (the middle one brighter) and a thin gold one at the edge
  for (const [r, c, w] of [[1.08, '#5fd8ff', .03], [1.38, '#9ff0ff', .045], [1.6, '#5fd8ff', .03]]) { const m = new THREE.Mesh(new THREE.TorusGeometry(r, w, 8, 72).rotateX(Math.PI / 2), neon(c)); m.position.y = .345; scene.add(m); }
  SHOW.ringM = new THREE.MeshStandardMaterial({ color: '#ffc324', roughness: .3, metalness: .4, emissive: '#ff9d1b', emissiveIntensity: .5 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, .05, 8, 72).rotateX(Math.PI / 2), SHOW.ringM); ring.position.y = .3; scene.add(ring);
  // the orange light strip under the dais, and its glow spilling onto the snow (flat rings, darker further out)
  const strip = new THREE.Mesh(new THREE.TorusGeometry(1.93, .035, 8, 72).rotateX(Math.PI / 2), neon('#ff9d1b')); strip.position.y = .05; scene.add(strip);
  SHOW.glowRings = [flat(1.95, 2.35, '#ffd68a', .012), flat(2.35, 2.75, '#ffe9c4', .011), flat(2.75, 3.1, '#f7f3ea', .01)];
  // a cyan ring of light on the snow further out, like the mockup's light circle
  flat(3.3, 3.42, '#8fe8ff', .012); flat(3.42, 3.7, '#d6f6ff', .011);
  // the dais rim: a dark band with chevrons (an opaque texture, safe everywhere)
  const chevTex = canvasTex(512, 64, (g) => { g.fillStyle = '#1e2550'; g.fillRect(0, 0, 512, 64); g.strokeStyle = '#ffc324'; g.lineWidth = 7; g.lineCap = 'round'; for (let x = 24; x < 512; x += 64) { g.beginPath(); g.moveTo(x, 14); g.lineTo(x + 16, 32); g.lineTo(x, 50); g.stroke(); g.beginPath(); g.moveTo(x + 22, 14); g.lineTo(x + 38, 32); g.lineTo(x + 22, 50); g.stroke(); } }, [4, 1]);
  const rimBand = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 1.95, .17, 72, 1, true), new THREE.MeshStandardMaterial({ map: chevTex, emissive: '#ffc324', emissiveMap: chevTex, emissiveIntensity: .35, roughness: .6 })); rimBand.position.y = .15; scene.add(rimBand);
  SHOW.turn = new THREE.Group(); SHOW.turn.position.y = .34; scene.add(SHOW.turn);
  // snow falling softly (small plain points: with no texture they draw everywhere; they are tiny, so squares don't show)
  const sp = []; for (let i = 0; i < 140; i++) sp.push(rand(-9, 9), rand(0, 7), rand(-9, 4));
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  SHOW.sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: .07, sizeAttenuation: true, fog: false })); scene.add(SHOW.sparks);
  SHOW.base = [pod, podTop, ring, strip, rimBand, ...SHOW.glowRings];
  // the winners' podium (hidden until a race ends): gold 1st in the middle, silver 2nd left, bronze 3rd right
  SHOW.podium = new THREE.Group(); SHOW.podium.visible = false; scene.add(SHOW.podium); SHOW.blocks = [];
  [[0, 1.3, '#ffd23a', '1'], [-2.35, .95, '#d8dde8', '2'], [2.35, .65, '#e0975a', '3']].forEach(([x, h, c, n]) => {
    const t = canvasTex(128, 128, (g) => { g.fillStyle = c; g.fillRect(0, 0, 128, 128); g.font = 'bold 96px Fredoka, Arial Rounded MT Bold, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = '#1b2a4a'; g.strokeText(n, 64, 70); g.fillStyle = '#fff'; g.fillText(n, 64, 70); });
    const side = M(c, { roughness: .35, metalness: .25 }), b = new THREE.Mesh(new THREE.BoxGeometry(2.25, h, 2.2), [side, side, side, side, new THREE.MeshStandardMaterial({ map: t, roughness: .4 }), side]);
    b.position.set(x, h / 2, 0); b.userData.h = h; b.castShadow = b.receiveShadow = true; SHOW.podium.add(b); SHOW.blocks.push(b);
  });
  const vcm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, flatShading: true }), firs = [firGeo(1), firGeo(2), firGeo(3)], lists = [[], [], []];
  // a wood behind the stand: thick far back, thinning towards the front, a few big ones close in at the sides
  for (let k = 0; k < 64; k++) { const a = rand(-2.6, -.5), r = rand(16, 52), x = Math.cos(a) * r * (k % 2 ? 1 : -1) * 1.25, z = -Math.abs(Math.sin(a) * r) - 10; if (Math.abs(x) < 7 && z > -34) continue; lists[k % 3].push({ x, y: LOB_H(x, z) - .1, z, s: rand(.55, 1.2), ry: rand(0, 6) }); }   // (an open view behind the stand, so the sky shows)
  for (const [x, z, sz] of [[-9.5, -5, 1.15], [10.2, -4.2, 1.05], [-13, 1, 1.3], [13.5, 1.5, 1.2]]) lists[(x > 0) | 0].push({ x, y: LOB_H(x, z) - .1, z, s: sz, ry: rand(0, 6) });
  lists.forEach((l, i) => instanced(scene, firs[i], vcm, l, true));
  // (v77) the snow takes the trees' shadows (long soft ovals falling away from the sun at (4, 9, 6)) and the colours of the
  // sky (big soft patches of cyan, violet, mint and pink), painted into the ground's vertex colours
  { const g = SHOW.ground.geometry, p = g.attributes.position, col = g.attributes.color, trees = lists.flat(), c = new THREE.Color(), shade = new THREE.Color('#4a5aa8');   // (strong colours: the lobby light is bright and washes pale ones out to white)
    const tints = [new THREE.Color('#3ab0ff'), new THREE.Color('#8a5cff'), new THREE.Color('#3ad8a8'), new THREE.Color('#ff6ac8')], L2 = Math.hypot(4, 6), ux = -4 / L2, uz = -6 / L2;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i); c.fromArray(col.array, i * 3); let sh = 0;
      for (const t of trees) { const h = 6.5 * t.s, cx = t.x + ux * h * .5, cz = t.z + uz * h * .5, dx = x - cx, dz = z - cz; if (Math.abs(dx) > h + 3 || Math.abs(dz) > h + 3) continue; const a = (dx * ux + dz * uz) / (h * .55), b = (dx * -uz + dz * ux) / (2.2 * t.s), d = a * a + b * b; if (d < 1) sh = Math.max(sh, (1 - d) ** .6); }
      const n1 = Math.sin(x * .061 + z * .023) * Math.cos(z * .047 - x * .015) + .35 * Math.sin(x * .13 - z * .09), n2 = Math.sin(x * .029 - z * .055 + 1.7);
      c.lerp(tints[n2 > .35 ? 0 : n2 > -.15 ? 1 : n2 > -.6 ? 2 : 3], smoothstep(.25, .9, n1) * .55).lerp(shade, sh * .62);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true; }
  // string lights on the six near trees: little coloured bulbs wound round the tiers (solid, they show on every phone)
  { const bulbs = [], cols = ['#ffd24a', '#ff5a5a', '#5fe0ff', '#7dff6a', '#ff8ae8'];
    for (const [x, z, sz] of [[-9.5, -5, 1.15], [10.2, -4.2, 1.05], [-13, 1, 1.3], [13.5, 1.5, 1.2]])
      for (let i = 0; i < 26; i++) { const t = i / 26, y = (1.6 + t * 4.9) * sz + LOB_H(x, z) - .1, rr = (2.25 - t * 1.75) * sz * .92, a = t * Math.PI * 7; bulbs.push({ x: x + Math.cos(a) * rr, y, z: z + Math.sin(a) * rr, s: .09, c: cols[i % 5] }); }
    instanced(scene, new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }), bulbs, false);
  }
  const ch = new THREE.Group(); ch.add(new THREE.Mesh(chaletGeo(), vcm)); ch.position.set(-11, LOB_H(-11, -16) - .15, -16); ch.rotation.y = .5; ch.name = 'LobbyChalet'; scene.add(ch); SHOW.chalet = ch; dressLobbyChalet();
  // purple banners on poles, as in the mockup
  {
    const bTex = canvasTex(64, 128, (g) => {
      g.fillStyle = '#6b3fd4'; g.fillRect(0, 0, 64, 128); g.fillStyle = '#8b5cf0'; g.fillRect(4, 4, 56, 120);
      g.strokeStyle = '#ffc324'; g.lineWidth = 5; g.beginPath(); g.moveTo(20, 86); g.lineTo(32, 44); g.lineTo(44, 86); g.moveTo(24, 66); g.lineTo(40, 66); g.stroke();
    });
    const bMat = new THREE.MeshStandardMaterial({ map: bTex, roughness: .85, side: THREE.DoubleSide });
    const pole = M('#9aa3b8', { roughness: .4, metalness: .6 });
    for (const [x, z, ry] of [[-6.4, -9, .5], [6.6, -9.5, -.5], [-9.5, -14, .3]]) {
      const gy = LOB_H(x, z); const p = new THREE.Mesh(new THREE.CylinderGeometry(.09, .11, 5.6, 8), pole); p.position.set(x, gy + 2.8, z); p.castShadow = true; scene.add(p);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2), bMat); fl.position.set(x + .66, gy + 3.7, z); fl.rotation.y = ry; scene.add(fl);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(.22, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffe08a', fog: false })); lamp.position.set(x, gy + 5.75, z); scene.add(lamp);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(.3, .18, 12), M('#2b2f7a', { roughness: .5 })); cap.position.set(x, gy + 6.0, z); scene.add(cap);
      const lt = new THREE.PointLight(0xffc266, 6, 7, 2); lt.position.set(x, gy + 5.6, z); scene.add(lt);
    }
  }
  const sm = new THREE.Mesh(snowmanGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 })); sm.position.set(6.2, LOB_H(6.2, -7) - .05, -7); sm.rotation.y = -.6; scene.add(sm);
  { const hills = new THREE.Group(); addMountains(hills, 0, -40, 150, 220, 22); hills.scale.y = .24; scene.add(hills); }   // low far hills, so the sky shows over them
  SHOW.camera = new THREE.PerspectiveCamera(36, 9 / 16, .1, 800);
}
function setShowRacer() {
  if (SHOW.racer) SHOW.turn.remove(SHOW.racer.root);
  SHOW.racer = makeRacerModel(charById(save.char), save.kart.color, save.kart.sticker, true, null, screen === 'garage' && GARAGE_VEH === 'ship'); SHOW.turn.add(SHOW.racer.root);
  // (v238, the user) the driver's feet poked out under the kart in the side view: cut the driver off at the kart's floor
  if (!SHOW.clip) { SHOW.clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); renderer.localClippingEnabled = true; }
  if (SHOW.racer.driver && !(screen === 'garage' && GARAGE_VEH === 'ship')) SHOW.racer.driver.traverse((o) => {
    if (!o.isMesh) return; const cl = (m) => { const c = m.clone(); c.clippingPlanes = [SHOW.clip]; return c; };
    o.material = Array.isArray(o.material) ? o.material.map(cl) : cl(o.material);
  });
}
const _clipV = new THREE.Vector3();
function showClip() { const R = SHOW.racer; if (SHOW.clip && R) { R.body.updateMatrixWorld(true); SHOW.clip.constant = -R.body.localToWorld(_clipV.set(0, .05, 0)).y; } }

/* ---------- (v228, the user) THE GARAGE: your kart stands in your own pit garage (the Le Mans model), seen from the
   side, the garage softly blurred behind it (v233). Tap the ENGINE, the WHEELS, the EXHAUST or the NOSE on the kart (or
   the chips in the panel) and that part's upgrades open in the panel beside it. The paint, lights, logo, tyres and the
   kart / starship switch sit on top of the panel.
   (v233, the user) KART LEVEL = 1 + every upgrade bought: 6 upgrades × 4 levels = 24, so the kart goes from level 1 to
   level 25, and 25 is the GOLDEN kart. The level card (in the style of the driving licence) fills its bar every time it
   is shown, and each upgrade fills it a notch further with confetti. The same card stands under the kart in the lobby. ---------- */
const UP_MAX = 4, KART_MAX = 1 + 6 * UP_MAX;
// (v241, the user) the starship has its own upgrades and its own level card (save.shipUp); the race reads the ones of
// the vehicle it is run in (the starship on Star Loop)
const upsOf = (veh) => (veh === 'ship' ? (save.shipUp = save.shipUp || {}) : save.kart);
// (v266, the user: "only one thing to upgrade, 25 levels, so it's not overcomplicated") ONE upgrade per vehicle: its
// level 0..24 (shown as 1..25); every level lifts all six things a little (speed, start, handling, grip, turbo, magnet
// — each of the old 4-step parts is worth level / 6). Old saves keep their progress: the parts bought so far add up.
const vehLv = (veh) => { const U = upsOf(veh); if (U.lv == null) U.lv = Math.min(KART_MAX - 1, UPGRADES.reduce((a, [k]) => a + Math.min(UP_MAX, U[k] || 0), 0)); return U.lv; };
function upLv(k) { return vehLv(typeof TDEF !== 'undefined' && TDEF && TDEF.ship ? 'ship' : 'kart') / 6; }
const vehLevel = (veh) => Math.min(KART_MAX, 1 + vehLv(veh));
const kartLevel = () => vehLevel('kart');
const gVeh = () => (GARAGE_VEH === 'ship' ? 'ship' : 'kart');
const PART_SVG = {
  engine: '<svg viewBox="0 0 24 24"><path d="M3 10h2V8h3l2-2h5l2 2h1v3h2V9h2v8h-2v-2h-2v3h-4l-2 2H8l-2-2H5v-2H3z" fill="currentColor"/><circle cx="11" cy="13" r="2.4" fill="#fff"/></svg>',
  wheels: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><circle cx="12" cy="12" r="5" fill="#fff"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M12 2c1.2 4 6 6.2 6 12a6 6 0 0 1-12 0c0-3 1.6-5 3-6.2 0 2 .8 3.4 2.2 3.6C11 8.5 10.6 5 12 2z" fill="currentColor"/><path d="M12 13c1.6 1.4 3 2.6 3 4.4a3 3 0 0 1-6 0c0-1.6 1.4-2.8 3-4.4z" fill="#fff"/></svg>',
  nose: '<svg viewBox="0 0 24 24"><path d="M4 3h5v9a3 3 0 0 0 6 0V3h5v9a8 8 0 0 1-16 0z" fill="currentColor"/><path d="M4 3h5v3.4H4zM15 3h5v3.4h-5z" fill="#fff"/></svg>',
};
const GPARTS = [
  { id: 'engine', name: 'ENGINE', ups: ['speed', 'accel'], c: '#ff8a1e' },
  { id: 'wheels', name: 'WHEELS', ups: ['handling', 'grip'], c: '#38b84a' },
  { id: 'back', name: 'EXHAUST', ups: ['turbo'], c: '#1fb8d8' },
  { id: 'nose', name: 'NOSE', ups: ['magnet'], c: '#e8a800' },
];
const partDone = (g) => g.ups.reduce((a, k) => a + Math.min(UP_MAX, upsOf(gVeh())[k] || 0), 0);
// the starship's parts: no wheels — a reactor, thrusters, an afterburner and a tractor beam
Object.assign(PART_SVG, {
  reactor: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" fill="currentColor"/><ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" stroke-width="2" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" stroke-width="2" transform="rotate(-60 12 12)"/></svg>',
  thrust: '<svg viewBox="0 0 24 24"><path d="M3 9h11l4-4h3v14h-3l-4-4H3z" fill="currentColor"/><path d="M3 11h6v2H3z" fill="#fff"/></svg>',
  burner: PART_SVG.back,
  beam: '<svg viewBox="0 0 24 24"><path d="M12 2l3 6h-6z" fill="currentColor"/><path d="M7 10h10l3 12H4z" fill="currentColor" opacity=".55"/><circle cx="12" cy="9" r="2.4" fill="currentColor"/></svg>',
});
const GPARTS_SHIP = [
  { id: 'reactor', name: 'REACTOR', ups: ['speed', 'accel'], c: '#ff8a1e' },
  { id: 'thrust', name: 'THRUSTERS', ups: ['handling', 'grip'], c: '#38b84a' },
  { id: 'burner', name: 'AFTERBURNER', ups: ['turbo'], c: '#1fb8d8' },
  { id: 'beam', name: 'BEAM', ups: ['magnet'], c: '#e8a800' },
];
const gParts = () => (gVeh() === 'ship' ? GPARTS_SHIP : GPARTS);
const G3 = { part: 'engine', from: null };
// where things stand in the garage's own frame (door at x = 0 looking out along -x, 9 m deep along +x, 10 m wide along z)
const G3P = { kart: [4.2, 0, .2], side: 0, sideS: 0, up: { pos: [-2.6, 1.3, .2], look: [4.2, .62, .2], fov: 28 }, style: { pos: [-1.4, 1.9, -2.4], look: [4.2, .6, .2], fov: 30 }, blur: 0 };   // (v238, the user: no blur)
// the level card, drawn like the driving licence
function kartCardHTML(id, mini, veh = 'kart') {
  const Lv = vehLevel(veh), gold = Lv >= KART_MAX, left = KART_MAX - Lv, VN = veh === 'ship' ? 'STARSHIP' : 'KART';
  return `<div class="klc-card${gold ? ' gold' : ''}${mini ? ' mini' : ''}" id="${id}"><i class="lshine"></i>
    <div class="klc-head"><img class="klc-logo" src="ui/logo.png" alt=""><div class="klc-title"><b>${gold ? `GOLDEN ${VN}` : `${VN} LEVEL`}</b><small>FOXKARTS RACING CLUB</small></div><span class="klc-no"><i>LEVEL</i><b class="klc-num">${Lv}</b><em>/${KART_MAX}</em></span></div>
    <div class="klc-body"><div class="klc-fill"><i class="klc-fi"></i><span class="klc-ticks"></span><b class="klc-gold">★</b></div>
    <small class="klc-sub">${gold ? 'Every part at its best — the golden kart!' : `${left} upgrade${left === 1 ? '' : 's'} to the golden ${VN.toLowerCase()}${mini ? ' · tap to upgrade' : ''}`}</small></div></div>`;
}
// the bar fills from `from` to the kart's level, the number counting up with it
function animKartCard(el, from = 1, onDone, veh = 'kart', levelUp = false) {
  if (!el) return; const Lv = vehLevel(veh), pc = (v) => ((v - 1) / (KART_MAX - 1) * 100).toFixed(2) + '%', fi = el.querySelector('.klc-fi'), num = el.querySelector('.klc-num');
  // (v242, the user: "make the level-up smooth") an upgrade: the bar slides on to the end, the level number pops up,
  // the bar vanishes and fills again from the start to where you are now on the way to the golden kart
  if (levelUp && from < Lv && fi && num) {
    const fade = (v, ms) => { fi.style.transition = `opacity ${ms}ms`; fi.style.opacity = v; };
    num.textContent = from; fi.style.transition = 'none'; fi.style.opacity = 1; fi.style.width = pc(Math.max(1, from)); void fi.offsetWidth;
    requestAnimationFrame(() => { fi.style.transition = 'width 650ms cubic-bezier(.45,0,.3,1)'; fi.style.width = '100%'; });
    setTimeout(() => {
      if (!fi.isConnected) return;
      num.textContent = Lv; num.classList.remove('lvup'); void num.offsetWidth; num.classList.add('lvup'); fade(0, 220);
      setTimeout(() => {
        if (!fi.isConnected) return;
        fi.style.transition = 'none'; fi.style.width = '0%'; fi.style.opacity = 1; void fi.offsetWidth;
        requestAnimationFrame(() => { fi.style.transition = 'width 750ms cubic-bezier(.22,.9,.3,1)'; fi.style.width = pc(Lv); });
        setTimeout(() => onDone && onDone(), 780);
      }, 260);
    }, 700);
    return;
  }
  fi.style.transition = 'none'; fi.style.width = pc(Math.max(1, from)); void fi.offsetWidth;
  const T = 900 + Math.min(700, (Lv - from) * 60);
  requestAnimationFrame(() => { fi.style.transition = `width ${T}ms cubic-bezier(.22,.9,.3,1)`; fi.style.width = pc(Lv); });
  const a = Math.max(1, from), t0 = performance.now();
  const step = () => { const k = Math.min(1, (performance.now() - t0) / T), e = 1 - (1 - k) ** 3; num.textContent = Math.round(a + (Lv - a) * e); if (k < 1) requestAnimationFrame(step); else onDone && onDone(); };
  step();
}
function drawLobbyCard() {
  // (v237, the user) in the lobby just a slim bar on the platform under the kart, with the level beside it
  const h = $('klvLobby'); if (!h) return; const Lv = kartLevel();
  h.innerHTML = `<div class="klb${Lv >= KART_MAX ? ' gold' : ''}" id="klvL"><b>LV <span class="klc-num">${Lv}</span></b><div class="klc-f"><i class="klc-fi"></i></div><small>${Lv >= KART_MAX ? 'GOLDEN' : `/${KART_MAX}`}</small></div>`;
  animKartCard($('klvL'), 1); placeLobbyCard();
}
// on a phone held upright the card stands just above the PLAY button
// (v243, the user) the phone has no name sign over the kart any more, so the platform and kart move up by this much of
// the screen height (a plain shift of the picture), and the level bar on the platform moves up with them
const LOB_UP = .08;
function placeLobbyCard() {
  const h = $('klvLobby'), r = document.querySelector('#menu .ready'); if (!h) return;
  if (!isPortrait() || !r) { h.style.bottom = ''; return; }
  const sr = stage.getBoundingClientRect(), sb = sr.bottom, rt = r.getBoundingClientRect().top; if (rt > 0) h.style.bottom = Math.round(sb - rt + 12 + sr.height * LOB_UP - 22) + 'px';   // (v245: 22 px lower, clear of the wheels)
}
addEventListener('resize', () => setTimeout(placeLobbyCard, 50));
function buildGarage3D() {
  const GAR = BASE.garage; if (!GAR) return false;
  const sc = new THREE.Scene(); sc.environment = ENV; sc.background = new THREE.Color('#1a2140');
  sc.add(new THREE.HemisphereLight(0xe6edff, 0x2a2440, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(-8, 7, 4); sc.add(key);
  const room = new THREE.Group(); sc.add(room);
  for (const { geo, mat } of GAR.parts) room.add(new THREE.Mesh(geo, mat));
  for (const l of GAR.lights) { const pl = new THREE.PointLight(l.color, Math.min(l.intensity, 5), l.distance || 9, 2); pl.position.copy(l.pos); sc.add(pl); }
  const fill = new THREE.PointLight(0xffffff, 7, 9, 2); fill.position.set(1.4, 2.2, .2); sc.add(fill);
  // the lane outside the open door, so the view out isn't a void
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(14, 30), new THREE.MeshStandardMaterial({ color: '#3a4258', roughness: .9 })); lane.rotation.x = -Math.PI / 2; lane.position.set(-7, -.01, 0); sc.add(lane);
  const pivot = new THREE.Group(); pivot.position.set(...G3P.kart); sc.add(pivot);
  // a soft shadow under the kart (the floor itself is blurred behind it)
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.9), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, map: canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 4, 64, 64, 62); r.addColorStop(0, 'rgba(10,8,30,.55)'); r.addColorStop(1, 'rgba(10,8,30,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }) }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = .012; pivot.add(blob);
  // the blur: the room is drawn small into a render target, shrunk twice more, and laid behind the kart as its background
  const qm = new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false, toneMapped: false }), qs = new THREE.Scene(); qs.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), qm));
  const rt = () => new THREE.WebGLRenderTarget(4, 4, { depthBuffer: false });
  Object.assign(G3, { scene: sc, room, lane, blob, pivot, cam: new THREE.PerspectiveCamera(32, 1, .05, 120), camNow: null, rtA: new THREE.WebGLRenderTarget(4, 4), rtB: rt(), rtC: rt(), qm, qs, qc: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) });
  G3.pitLights = sc.children.filter((o) => o.isPointLight && o !== fill);
  loadMenuGarage();
  return true;
}
/* (v242, the user) the menu Garage stands in the two-storey workshop (made 2026-11-04, kept on hold until now): car lifts,
   tool lockers, tyre racks and a bar upstairs. Its own frame has the dais at the origin and the open side towards +z;
   turned a quarter round it opens towards the side camera (-x), with the kart where the dais is. The pit-garage room
   stays until it has loaded (and if it fails). */
const MENU_GARAGE = { url: 'models/menu-garage.glb?v=1', rotY: -Math.PI / 2, at: [7, 0, 3], lightK: .45 };   // (at: the workshop sits 7 m further back and 3 m aside, so the lift, lockers, tyres and bench fill the view behind the kart)
function loadMenuGarage() {
  if (G3.menuGarage !== undefined) return; G3.menuGarage = null;
  new GLTFLoader().loadAsync(MENU_GARAGE.url).then((g) => {
    if (!G3.scene) return;
    const root = g.scene; root.rotation.y = MENU_GARAGE.rotY; root.position.set(G3P.kart[0] + MENU_GARAGE.at[0], G3P.kart[1] + MENU_GARAGE.at[1], G3P.kart[2] + MENU_GARAGE.at[2]); root.updateMatrixWorld(true);
    const lights = []; root.traverse((o) => { if (o.isLight) lights.push(o); if (o.isMesh) { o.castShadow = o.receiveShadow = false; if (o.material && 'envMapIntensity' in o.material) o.material.envMapIntensity = .6; } });
    // the lights go into the scene itself (the room is hidden for the blur pass, the lights must stay)
    for (const l of lights) { G3.scene.attach(l); l.intensity *= MENU_GARAGE.lightK; l.castShadow = false; }
    for (const l of G3.pitLights || []) G3.scene.remove(l);
    G3.room.clear(); G3.room.add(root); G3.lane.visible = false; G3.lane.material.visible = false;
    G3.menuGarage = root;
  }).catch((e) => console.warn('menu garage model did not load; the pit garage stands in', e));
}
function renderGarage(cam, w, h) {
  const S = G3.scene, pr = renderer.getPixelRatio(), d = G3P.blur || 0; showClip();
  if (!(d > 0)) { renderer.render(S, cam); return; }
  const W = Math.max(8, Math.round(w * pr / (1 + d))), H = Math.max(8, Math.round(h * pr / (1 + d)));
  if (G3.rtA.width !== W || G3.rtA.height !== H) { G3.rtA.setSize(W, H); G3.rtB.setSize(Math.max(4, W >> 1), Math.max(4, H >> 1)); G3.rtC.setSize(Math.max(4, W >> 2), Math.max(4, H >> 2)); }
  const bg = S.background;
  SHOW.turn.visible = G3.blob.visible = false; renderer.setRenderTarget(G3.rtA); renderer.render(S, cam);
  G3.qm.map = G3.rtA.texture; renderer.setRenderTarget(G3.rtB); renderer.render(G3.qs, G3.qc);
  G3.qm.map = G3.rtB.texture; renderer.setRenderTarget(G3.rtC); renderer.render(G3.qs, G3.qc);
  renderer.setRenderTarget(null);
  G3.room.visible = G3.lane.visible = false; SHOW.turn.visible = G3.blob.visible = true; S.background = G3.rtC.texture;
  renderer.render(S, cam);
  G3.room.visible = G3.lane.visible = true; S.background = bg;
}
const _g3v = new THREE.Vector3(), _g3b = new THREE.Box3();
// the spots on the kart, in world space: from the kart's box and its near-side wheels
function garageSpots() {
  const R = SHOW.racer; if (!R) return [];
  R.root.updateMatrixWorld(true); _g3b.setFromObject(R.body || R.root);
  const b = _g3b, h = b.max.y - b.min.y, cx = b.min.x + (b.max.x - b.min.x) * .2;   // the near (camera) side is -x
  let fz = 0, az = 0; for (const s of R.spins || []) { s.getWorldPosition(_g3v); az += _g3v.z / R.spins.length; } for (const g of R.fronts || []) { g.getWorldPosition(_g3v); fz += _g3v.z / R.fronts.length; }
  const nz = (R.fronts && R.fronts.length ? fz - az : 1) >= 0 ? 1 : -1;   // the front wheels say which way the nose points
  const zN = nz > 0 ? b.max.z : b.min.z, zR = nz > 0 ? b.min.z : b.max.z, len = b.max.z - b.min.z;
  let wheel = null; for (const s of R.spins || []) { s.getWorldPosition(_g3v); if (_g3v.x < b.min.x + (b.max.x - b.min.x) * .5 && (!wheel || (_g3v.z - wheel.z) * nz > 0)) wheel = _g3v.clone(); }
  if (gVeh() === 'ship') return [
    { id: 'beam', p: new THREE.Vector3(cx, b.min.y + h * .45, zN - nz * len * .06) },
    { id: 'reactor', p: new THREE.Vector3(cx, b.min.y + h * .62, (zN + zR) / 2) },
    { id: 'thrust', p: new THREE.Vector3(cx, b.min.y + h * .22, zR + nz * len * .3) },
    { id: 'burner', p: new THREE.Vector3(cx, b.min.y + h * .45, zR + nz * len * .03) },
    { id: 'tag', p: new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y - .04, (b.min.z + b.max.z) / 2) },
  ];
  return [
    { id: 'nose', p: new THREE.Vector3(cx, b.min.y + h * .28, zN - nz * len * .08) },
    { id: 'wheels', p: wheel || new THREE.Vector3(cx, b.min.y + h * .2, zN - nz * len * .22) },
    { id: 'engine', p: new THREE.Vector3(cx, b.min.y + h * .5, zR + nz * len * .2) },
    { id: 'back', p: new THREE.Vector3(cx, b.min.y + h * .3, zR + nz * len * .02) },
    { id: 'tag', p: new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y - .04, (b.min.z + b.max.z) / 2) },   // under the kart, on the floor
  ];
}
function updateGarage3D(dt) {
  if (!G3.scene && !buildGarage3D()) return false;
  const side = gVeh() === 'ship' ? G3P.sideS : G3P.side;
  if (SHOW.turn.parent !== G3.pivot) { G3.pivot.add(SHOW.turn); SHOW.turn.position.set(0, 0, 0); SHOW.turn.rotation.y = side; }
  const t = performance.now() / 1000, up = true, cam = G3.cam;
  SHOW.spin = Math.max(0, (SHOW.spin || 0) - dt * 1.5); SHOW.pop = Math.max(0, (SHOW.pop || 0) - dt * 2.6);
  SHOW.turn.scale.setScalar(SHOW.pop ? 1 + Math.sin((1 - SHOW.pop) * Math.PI) * .16 - SHOW.pop * .3 : 1);
  if (up) SHOW.turn.rotation.y += wrapA(side - SHOW.turn.rotation.y) * Math.min(1, dt * 5);
  else if (!(rDrag && rDrag.moved > 10)) { SHOW.ph = (SHOW.ph || 0) + dt * (.42 + SHOW.spin * 3); const want = G3P.side + .9 + Math.sin(SHOW.ph) * .9; SHOW.turn.rotation.y += wrapA(want - SHOW.turn.rotation.y) * Math.min(1, dt * 3); }
  if (SHOW.racer) { SHOW.racer.body.position.y = Math.sin(t * 2) * .012 + (SHOW.racer.hover ? .05 : 0); for (const s of SHOW.racer.spins) s.rotation.x += dt * (up ? .2 : .5); }
  // the side view for the kart, a three-quarter view for the starship
  const V = up ? G3P.up : G3P.style, goal = [...V.pos, ...V.look, V.fov];
  if (!G3.camNow) G3.camNow = goal.slice(); for (let i = 0; i < 7; i++) G3.camNow[i] += (goal[i] - G3.camNow[i]) * Math.min(1, dt * 4);
  const c = G3.camNow, sr = stage.getBoundingClientRect(), w = sr.width || 1, h = sr.height || 1;
  // (v230) framed on any screen: the camera looks at the middle of the kart, and its zoom settles so the kart fills
  // the free space (left of the panel on a wide screen, above it on a phone held upright) without being cut off
  if (SHOW.racer) { SHOW.racer.root.updateMatrixWorld(true); _g3b.setFromObject(SHOW.racer.body || SHOW.racer.root); }
  const ctr = _g3b.isEmpty() ? new THREE.Vector3(c[3], c[4], c[5]) : _g3b.getCenter(new THREE.Vector3());
  G3.zoom = G3.zoom || 1; cam.fov = c[6] * G3.zoom; cam.aspect = w / h; cam.position.set(c[0], c[1], c[2]); cam.lookAt(c[3], ctr.y + (c[4] - .62), ctr.z);
  const sh = $('shop').getBoundingClientRect(), port = isPortrait();
  const gv = $('gveh'), top0 = port ? (gv && !gv.hidden ? gv.getBoundingClientRect().bottom - sr.top + 8 : 64) : 0;
  const fw = port ? w : (sh.width ? sh.left - sr.left : w), fh = port ? Math.max(100, sh.top - sr.top - top0 - 34) : h - 90;
  if (port) cam.setViewOffset(w, h, 0, h / 2 - top0 - fh / 2, w, h); else cam.setViewOffset(w, h, (w - fw) / 2, -20, w, h);
  if (!_g3b.isEmpty()) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let i = 0; i < 8; i++) { _g3v.set(i & 1 ? _g3b.max.x : _g3b.min.x, i & 2 ? _g3b.max.y : _g3b.min.y, i & 4 ? _g3b.max.z : _g3b.min.z).project(cam); x0 = Math.min(x0, _g3v.x); x1 = Math.max(x1, _g3v.x); y0 = Math.min(y0, _g3v.y); y1 = Math.max(y1, _g3v.y); }
    const pw = (x1 - x0) / 2 * w, ph = (y1 - y0) / 2 * h, k = Math.max(pw / (fw * (gVeh() === 'ship' ? .68 : .8)), ph / (fh * .7));
    if (isFinite(k) && k > 0) G3.zoom = clamp(G3.zoom * Math.pow(k, Math.min(1, dt * 6)), .35, 3);
  }
  renderGarage(cam, w, h);
  // the spots on the kart
  const box = $('gspots'); box.hidden = !up;
  if (up) {
    for (const s of garageSpots()) {
      const b = box.querySelector(`[data-p="${s.id}"]`); if (!b) continue;
      _g3v.copy(s.p).project(cam); b.style.transform = `translate(${((_g3v.x + 1) / 2 * w).toFixed(1)}px,${((1 - _g3v.y) / 2 * h).toFixed(1)}px)`;
    }
  }
  return true;
}
function drawGarageSpots() {
  const box = $('gspots'), Lv = vehLevel(gVeh());
  // (v266) only the level tag under the kart — there are no parts to point at any more
  box.innerHTML = `<div class="gtag${Lv >= KART_MAX ? ' gold' : ''}" data-p="tag"><b>LV ${Lv}</b><span><i style="width:${((Lv - 1) / (KART_MAX - 1) * 100).toFixed(1)}%"></i></span></div>`;
}
// (v266) the panel: the level card and ONE button — UPGRADE
function drawGarageUp(ups) {
  const veh = gVeh(), lv = vehLv(veh), Lv = vehLevel(veh), VN = veh === 'ship' ? 'STARSHIP' : 'KART', gold = Lv >= KART_MAX;
  ups.innerHTML = kartCardHTML('klv', false, veh) +
    `<div class="gone">${gold ? `<div class="gmax"><b>GOLDEN ${VN}</b><small>Level 25 — nothing left to upgrade</small></div>`
      : `<button class="btn gbuy big" data-k="lv">UPGRADE <i class="coin"></i>${LEVEL_COST(lv)}</button><small class="gwhat">Level ${Lv} → ${Lv + 1} · faster · quicker start · sharper · more grip · longer turbo · bigger magnet</small>`}</div>`;
  for (const b of ups.querySelectorAll('.gbuy')) tap(b, () => buy('lv'));
  // the bar fills every time the card is shown; after an upgrade it fills from the old level, with confetti
  const from = G3.from; G3.from = null;
  animKartCard($('klv'), from ?? 1, from == null ? null : () => { const k = $('klv'); if (!k || screen !== 'garage') return; confettiAt(k, vehLevel(gVeh()) >= KART_MAX ? 70 : 34); k.classList.remove('pop'); void k.offsetWidth; k.classList.add('pop'); sfx.coin && sfx.coin(); }, gVeh(), from != null);
}

/* ---------- face pictures of each racer, for the menu buttons and results ---------- */
const FACES = {};
function renderFaces() {
  // drawn with the main renderer into the canvas's bottom-left corner and copied out at once
  // (a second WebGL context would cost memory, and iPhones allow only a few)
  const S = 160, pr = renderer.getPixelRatio(), vs = S / pr, sc = new THREE.Scene(); sc.environment = ENV;
  sc.add(new THREE.HemisphereLight(0xffffff, 0x8899bb, 1.4)); const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(2, 3, 4); sc.add(d);
  const cam = new THREE.PerspectiveCamera(30, 1, .05, 20); cam.position.set(.55, .98, 1.75); cam.lookAt(0, .7, -.03);
  const out = document.createElement('canvas'); out.width = out.height = S; const x = out.getContext('2d'), H = renderer.domElement.height;
  renderer.setScissorTest(true); renderer.setScissor(0, 0, vs, vs); renderer.setViewport(0, 0, vs, vs);
  for (const ch of CHARACTERS) {
    const g = driverBody(ch).clone(); sc.add(g); sc.background = new THREE.Color(ch.color).lerp(new THREE.Color('#ffffff'), .35);
    // (v106) a page loaded in a hidden tab has a 0 × 0 canvas: skip the snapshot then (the painted portraits cover the racers)
    try { renderer.render(sc, cam); if (renderer.domElement.width > 0 && renderer.domElement.height > 0) { x.clearRect(0, 0, S, S); x.drawImage(renderer.domElement, 0, H - S, S, S, 0, 0, S, S); FACES[ch.id] = out.toDataURL(); } else FACES[ch.id] = ''; } catch (e) { FACES[ch.id] = ''; } sc.remove(g);
  }
  renderer.setScissorTest(false); renderer.setViewport(0, 0, renderer.domElement.width / pr, H / pr);
}
// (v106) the painted portrait for the map (ui/faces), with the old face underneath in case one is missing
const PORTRAIT_IDS = new Set(['foxino', 'stella', 'pix', 'rob', 'gummy']), portraitMap = () => { const id = typeof TDEF !== 'undefined' && TDEF && race ? TDEF.id : save.track || 'alps'; return (TRACK_DEFS[id] && TRACK_DEFS[id].faces) || id; };
const faceStyle = (ch) => `--c:${css(ch.color)};background-image:${PORTRAIT_IDS.has(ch.id) ? `url(ui/faces/${ch.id}-${portraitMap()}.jpg?v=1),` : ''}url(${FACES[ch.id]});background-size:cover`;


// (v141, the user) MULTIPLAYER REMOVED. `party` is never set now; the guards below it are inert.
let party = null;

/* ---------- 6. Screens ---------- */
let screen = 'loading';
function goMenu() {
  tapTip(false);   // (v301)
  hidePodium(); screen = 'menu'; showOnly('menu'); refreshCounters(); Snd.engineOff(); $('tracks').hidden = true;
  { const st = L.stats(), all = L.ITEMS.filter((x) => x.kind === 'word').length || 1, pc = Math.min(100, Math.round((st.learning + st.mastered) / all * 100)); $('eng').innerHTML = `<img class="ico" src="ui/icon-book.png" alt=""><span class="t">English ${L.LEVEL_NAMES[L.level()]}<small>${st.learning + st.mastered} learned${save.cups ? `<span class="cups"> · cups ${save.cups}</span>` : ''}</small><i class="engbar"><b style="width:${pc}%"></b></i></span>`; }
  const sum = save.packs.length && window.FugioPacks ? FugioPacks.summary(PACKS, save.packs) : null;
  $('topicBtn').innerHTML = `<img class="ico" src="ui/icon-gift.png" alt=""><span class="lv">${sum ? sum.level : '★'}</span><b>${sum ? sum.title : 'FoxKarts mix (words + grammar)'}</b>›`;
  if (!SHOW.racer) setShowRacer();
  racerPlate(); drawLobbyCard();
}
// the racer on the stand: its name plate, and changing it (tap the racer, or the arrows beside its name)
function racerPlate() {
  const ch = charById(save.char); $('cName').textContent = ch.name.toUpperCase(); $('cTag').textContent = save.name || ch.tag;
  $('pName').textContent = ch.name.toUpperCase(); $('pUser').textContent = save.name || ch.tag;   // (the phone lobby's top bar)
  if (isDevAcct()) for (const id of ['cTag', 'pUser']) { const b = document.createElement('b'); b.className = 'devb'; b.textContent = 'DEV'; $(id).append(' ', b); }   // (v240) the dev account
  $('pn').style.setProperty('--c', css(ch.color)); $('tapme').hidden = !!save.tapRacer || ONLY_FOXINO;
  $('prevC').hidden = $('nextC').hidden = ONLY_FOXINO;
}
// for now only Foxino can be chosen (the user's request); the others still race as rivals
const ONLY_FOXINO = true;
function nextRacer(dir) {
  if (ONLY_FOXINO) { sfx.click(); toast("More racers soon!\nFoxino drives for now", "#ffe14a", 24); SHOW.spin = .6; return; }
  const i = CHARACTERS.findIndex((c) => c.id === save.char), ch = CHARACTERS[(i + dir + CHARACTERS.length) % CHARACTERS.length];
  sfx.click(); save.char = ch.id; save.tapRacer = 1; store(); setShowRacer(); SHOW.pop = 1; SHOW.spin = .6; racerPlate();
}
tap($('prevC'), () => nextRacer(-1)); tap($('nextC'), () => nextRacer(1));
// tap the racer to change it; drag sideways to turn it round (in the garage too)
const ray = new THREE.Raycaster(); let rDrag = null;
canvas.addEventListener('pointerdown', (e) => { if (screen === 'menu' || screen === 'garage') rDrag = { x: e.clientX, y: e.clientY, moved: 0, rot: SHOW.turn.rotation.y, id: e.pointerId }; });
addEventListener('pointermove', (e) => {
  if (!rDrag || e.pointerId !== rDrag.id) return; const dx = e.clientX - rDrag.x;
  rDrag.moved = Math.max(rDrag.moved, Math.hypot(dx, e.clientY - rDrag.y)); if (rDrag.moved > 10) SHOW.turn.rotation.y = rDrag.rot + dx * .012;
});
addEventListener('pointerup', (e) => {
  if (!rDrag || e.pointerId !== rDrag.id) return; const d = rDrag; rDrag = null;
  if (d.moved <= 10 && screen === 'menu' && onRacer(e.clientX, e.clientY)) { Snd.init(); nextRacer(1); }
});
addEventListener('pointercancel', () => { rDrag = null; });
function onRacer(x, y) {
  const r = canvas.getBoundingClientRect(), n = new THREE.Vector2((x - r.left) / r.width * 2 - 1, 1 - (y - r.top) / r.height * 2);
  ray.setFromCamera(n, SHOW.camera); if (ray.intersectObjects([SHOW.turn, SHOW.base[0]], true).length) return true;
  const c = new THREE.Vector3(0, .8, 0).project(SHOW.camera);   // or close to it (small fingers)
  return Math.hypot(n.x - c.x, (n.y - c.y) * r.height / r.width) < .16;
}
// the tabs, and the way out: back to the fugio.co games (it closes the game when fugio.co opened it in its player)
tap($('tabPlay'), () => { if (screen === 'garage') $('back').click(); });
tap($('leaveBtn'), () => {
  sfx.click(); if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  if (window.parent !== window) window.parent.postMessage({ fugio: 'leave' }, '*'); else location.href = 'https://www.fugio.co/';
});
tap($('play'), () => {
  if (!canRace()) { payRace(); return; }
  sfx.click(); if (!save.seenHelp) { save.seenHelp = 1; store(); showHelp(goTracks); } else goTracks();
  // phones: steer by turning the phone (iPhones ask once) and full screen; the orientation is NOT locked (v141)
  if (TOUCH) {
    if (save.tilt !== false) enableTilt().then((ok) => { if (ok && !save.tilt) { save.tilt = true; store(); } });
    const de = document.documentElement;
    if (de.requestFullscreen && !document.fullscreenElement) de.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  }
});
// how to play: five short steps with pictures (shown before the first race, and from the ❓ button)
function showHelp(then) {
  const Qz = $('quiz'); Qz.hidden = false;
  const steps = [TOUCH ? ['TILT', 'Turn your <b>phone</b> like a steering wheel to drive.'] : ['KEYS', 'Hold <b>W</b> to drive, <b>A</b> and <b>D</b> to steer.'], ...(TOUCH ? [] : [['icon-drift', 'Hold <b>SHIFT</b> in a bend and steer the slide. Sparks = a turbo!']]), ['icon-strong', 'Drive into a <b>? box</b> for a power-up.'], ['icon-jump', 'Every <b>jump</b> asks a question: answer before you land!'], ['coin', 'Collect <b>coins</b> and win the race!']];
  // the first time: how old is the player? (sets the English level to start with; it adapts as they play)
  const ages = !save.ageSet ? `<div class="ages"><b>How old are you?</b><div>${[['6–8', 0], ['9–10', 1], ['11–12', 2]].map(([a, lv]) => `<button class="btn small ${L.level() === lv ? 'on' : ''}" data-lv="${lv}">${a}</button>`).join('')}</div></div>` : '';
  const stepsHTML = `<div class="help">${steps.map(([e, t]) => `<div><span>${/^icon-|^coin$/.test(e) ? ico(e, 'helpimg') : e}</span><p>${t}</p></div>`).join('')}</div>`;
  Qz.innerHTML = then ? `<h2 class="out">HOW TO PLAY</h2>${stepsHTML}${ages}<button class="btn" id="helpGo" style="--c:var(--green);margin-top:14px">LET'S GO!</button>`
    : `<h2 class="out">SETTINGS</h2><label class="uname"><span>USERNAME</span><input id="uname" maxlength="14" autocomplete="off" spellcheck="false" placeholder="Your name" value="${(save.name || '').replace(/"/g, '&quot;')}"></label><div class="setsWrap">${settingsHTML()}</div><button class="btn" id="helpGo" style="--c:var(--green);margin-top:14px">DONE</button>`;
  if (!then) {
    wireSettings();
    const u = $('uname'); u.addEventListener('keydown', (e) => e.stopPropagation()); u.addEventListener('keyup', (e) => e.stopPropagation());
    u.addEventListener('input', () => { save.name = u.value.trim().slice(0, 14); store(); if (devAccount()) { refreshCounters(); toast('DEV ACCOUNT\n<small>5 000 coins · kart back to level 1</small>', '#ffe14a', 34); } racerPlate(); });
  }
  for (const b of Qz.querySelectorAll('.ages [data-lv]')) tap(b, () => { save.learn.lv = +b.dataset.lv; save.learn.hist = []; save.ageSet = 1; store(); sfx.click(); for (const x of Qz.querySelectorAll('.ages .btn')) x.classList.toggle('on', x === b); });
  tap($('helpGo'), () => { Qz.hidden = true; Qz.innerHTML = ''; if (then) then(); });
}
tap($('helpBtn'), () => { sfx.click(); openSettings(); });
// the phone lobby's tiles and leave button do what the tabs and pills do
tap($('tGarage'), () => $('garageBtn').click()); tap($('tSettings'), () => $('helpBtn').click()); tap($('pLeave'), () => $('leaveBtn').click());
// choose a track: three cards (easy, medium, hard), each with its English level and your best place there
// a little outline of a track's shape for its card
function trackSVG(id) {
  const d = TRACK_DEFS[id], keep = { TRACK, TB, BOUNDS, MID, BUSY, RAMP_AT, PAD_AT, GATE_AT, PIT_AT, HALF }, pr = prepTrack(d);
  ({ TRACK, TB, BOUNDS, MID, BUSY, RAMP_AT, PAD_AT, GATE_AT, PIT_AT, HALF } = keep);   // prepTrack sets the current track; put it back
  const pts = pr.TRACK.pts, b = pr.TB, w = b.x1 - b.x0, h = b.z1 - b.z0, k = 52 / Math.max(w, h);
  const path = pts.filter((_, i) => i % 8 === 0).map((p, i) => `${i ? 'L' : 'M'}${(4 + (p.x - b.x0) * k + (52 - w * k) / 2).toFixed(1)} ${(4 + (p.z - b.z0) * k + (52 - h * k) / 2).toFixed(1)}`).join('') + 'Z';
  return `<svg class="map" viewBox="0 0 60 60"><path d="${path}" fill="none" stroke="#1b2a4a" stroke-width="7" stroke-linejoin="round"/><path d="${path}" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/></svg>`;
}
// the Grand Prix: all three tracks in a row (2 energy when energy is on), points for every place, a trophy at the end
let cup = null;
const CUP_PTS = [10, 7, 5, 3, 1], CUP_BONUS = [150, 100, 60, 0, 0];
// the medal on a track card: bronze for 1 win on that track, silver for 2, gold for 3 or more (save.winsBy)
function trackMedal(id) { const st = stampsOf(id).pop(); return st ? `<img class="cmedal" src="ui/stamp-${st.id}.png?v=1" alt="">` : ''; }   // (v185) the top licence stamp
// (v226, the user) a wide (16:9) screen: keep a screen's content clear of the top bar, measured on this screen
function fitUnderBar(v) {
  const lt = $('ltop'); if (!v || !lt || isPortrait()) { if (v) v.style.paddingTop = ''; return; }
  const b = lt.getBoundingClientRect(); if (!b.height) return;
  const z = parseFloat(getComputedStyle(v.closest('section') || v).zoom) || 1;
  v.style.paddingTop = Math.ceil(b.bottom / z + 12) + 'px';
}
addEventListener('resize', () => { const v = document.querySelector('#tracks:not([hidden]) .veil'); if (v) fitUnderBar(v); });
function goTracks() {
  const T = $('tracks'); T.hidden = false; save.best = save.best || {};
  // four plain square picture cards (painted from in-game screenshots): the name inside the frame, only the difficulty tag besides it (the user, v60)
  T.innerHTML = `<div class="veil" style="flex-direction:column;gap:12px;background:rgba(11,20,48,.84)"><h2 class="out" style="margin:0;font-size:38px;color:var(--yellow)">CHOOSE A TRACK</h2>` +
    `<div class="tks" style="--n:${TRACK_ORDER.length + 1}">` + TRACK_ORDER.map((id) => { const d = TRACK_DEFS[id], b = save.best[id], tm = save.times && save.times[id] > TUNE.laps * 10 ? fmtTime(save.times[id]) : ''; const lk = !trackOpen(id); return `<button class="tk${lk ? ' locked' : ''}" data-id="${id}" style="--c:${d.color}">${lk ? `<span class="lockb">${LOCK_SVG}${mapToGo(id)} PTS</span>${mapBarHTML(id)}` : ''}<span class="pic" style="background-image:url(img/track-${id}.jpg?v=2)"></span><span class="tag">${d.tag}</span><span class="nm">${d.name}</span>${trackMedal(id)}</button>`; }).join('') +
    `<button class="tk cupc${openTracks().length < 3 ? ' locked' : ''}" id="cupBtn" style="--c:#ffb000">${openTracks().length < 3 ? `<span class="lockb">${LOCK_SVG}3 MAPS</span>` : ''}<span class="pic cup">${ico('icon-trophy', 'cupimg')}</span><span class="tag">CUP</span><span class="nm">Grand Prix</span></button></div>` +
    `<button class="btn small" id="trkBack" style="--c:#8a94a8">‹ Back</button></div>`;
  fitUnderBar(T.querySelector('.veil'));   // (v226) on a wide screen the title sits under the top bar, the cards in the middle
  for (const b of T.querySelectorAll('.tk[data-id]')) tap(b, () => {
    if (!trackOpen(b.dataset.id)) { const id = b.dataset.id; sfx.wrong(); toast(`${mapToGo(id)} MORE POINTS\n<small>race any map to open ${TRACK_DEFS[id].name} · 1st place = ${MAP_PTS[0]}</small>`, '#ffe14a', 30); return; }
    if (!payRace()) return;
    sfx.power(); L.unlock(); cup = null; T.querySelector('.veil').innerHTML = '<h2 class="out" style="color:var(--yellow);font-size:40px">Loading…</h2>';
    setTimeout(() => startRace(b.dataset.id), 60);
  });
  tap($('cupBtn'), () => {
    if (openTracks().length < 3) { sfx.wrong(); toast(`OPEN 3 MAPS\n<small>to race the Grand Prix</small>`, '#ffe14a', 30); return; }
    if (!payRace(2)) return;
    sfx.fanfare(); L.unlock(); cup = { i: 0, pts: {}, tracks: openTracks().slice(-3) }; T.querySelector('.veil').innerHTML = `<h2 class="out" style="color:var(--yellow);font-size:40px">${ico('icon-trophy', 'tico')} GRAND PRIX!</h2>`;
    setTimeout(() => startRace(cup.tracks[0]), 60);
  });
  tap($('trkBack'), () => { sfx.click(); T.hidden = true; });
}
/* ---------- (v165, the user) THE GAME PASS ----------
   50 levels, paid for in NUTS (the gold token with a hex nut, ui/nut.png) — not XP. Every race gives nuts for your
   place and for every right answer, times the map's multiplier: the further along the map, the more it gives
   (Alpine Peaks ×1, Beach Island ×1.25, Robo City ×1.5, Gold Mines ×1.75, Star Loop ×2; v168: Japan removed).
   Every 10 levels a new map opens, in the menu's order: you start in the Alps and end in space (level 50).
   Every other level gives coins. The Grand Prix opens with your third map and races your three furthest maps. */
// (v168, the user: "levels fast — about 3 races for a level of the map you are on") a race gives about 30 nuts × the
// map's multiplier (place 25/22/20/18/16 + 1 for every right answer, at most 15), and a level costs 100 × the multiplier
// of the map that level belongs to: three ordinary races on your newest map make a level (a win with all right ≈ 2½)
const PASS_MAX = 50, PASS_STEP = 10, PLACE_NUTS = [25, 22, 20, 18, 16];
const passNeed = (n) => Math.round(100 * (1 + Math.floor((n - 1) / PASS_STEP) * .25));   // 100 for levels 1–10 … 200 for 41–50
const mapIdx = (id) => Math.max(0, TRACK_ORDER.indexOf(id));
const mapUnlockLv = (id) => mapIdx(id) * PASS_STEP;
const mapMult = (id) => 1 + mapIdx(id) * .25;
function passOf(n = (save.pass && save.pass.nuts) || 0) {
  let lv = 0, left = n; while (lv < PASS_MAX && left >= passNeed(lv + 1)) { left -= passNeed(lv + 1); lv++; }
  return { lv, into: left, need: lv < PASS_MAX ? passNeed(lv + 1) : 0, total: n };
}
// (v185, the user) a map opens after 2 WINS on the map before it: Alps -> Beach -> City -> Mines -> Space
const WINS_TO_OPEN = 2;
const winsOn = (id) => ((save.winsBy || {})[id] || 0);
const winsToOpen = (id) => { const i = mapIdx(id); return i <= 0 ? 0 : Math.max(0, WINS_TO_OPEN - winsOn(TRACK_ORDER[i - 1])); };
/* (v249, the user) MAP POINTS instead of "win on the map before": every race on ANY map gives points for your place,
   and each map has a bar that fills with them; a full bar opens it. Tuned to the old pace: Robo Beach needs 200
   points = the old 2 wins, and every next map needs a bit more. Maps you had already opened stay open (save.mapsOpen,
   taken from the old rule the first time this runs), and points for races you raced before are counted too. */
const MAP_PTS = [100, 60, 40, 30, 25];            // 1st … 5th place
const MAP_NEED = [0, 200, 450, 750, 1100];        // points to open each map (Alps, Beach, City, Mines, Space)
const mapNeed = (id) => MAP_NEED[mapIdx(id)] ?? (MAP_NEED[MAP_NEED.length - 1] + 400 * (mapIdx(id) - MAP_NEED.length + 1));
function mapPts() {
  if (save.mapPts == null) { const w = save.wins || 0, r = save.races || 0; save.mapPts = w * MAP_PTS[0] + Math.max(0, r - w) * 35; }
  return save.mapPts;
}
function mapsOpen() {
  if (!save.mapsOpen) { save.mapsOpen = []; for (const id of TRACK_ORDER) { const i = mapIdx(id); if (i <= 0 || (winsToOpen(id) === 0 && save.mapsOpen.includes(TRACK_ORDER[i - 1]))) save.mapsOpen.push(id); } }
  return save.mapsOpen;
}
const trackOpen = (id) => DEV() || mapIdx(id) <= 0 || mapsOpen().includes(id) || mapPts() >= mapNeed(id);
const mapToGo = (id) => Math.max(0, mapNeed(id) - mapPts());
// the bar on a locked map: points so far out of what it needs
const mapBarHTML = (id) => { const n = mapNeed(id), v = Math.min(n, mapPts()); return `<span class="tkbar"><i style="width:${(v / n * 100).toFixed(1)}%"></i><b>${v}<small>/${n}</small></b></span>`; };
// (v185) the licence stamps for a map: bronze 1 win, silver 3, gold 5, diamond 10 (they pile up on the card)
const STAMPS = [{ id: 'bronze', n: 1, name: 'BRONZE' }, { id: 'silver', n: 3, name: 'SILVER' }, { id: 'gold', n: 5, name: 'GOLD' }, { id: 'diamond', n: 10, name: 'DIAMOND' }];
const stampsOf = (id) => STAMPS.filter((st) => winsOn(id) >= st.n);
const nextStamp = (id) => STAMPS.find((st) => winsOn(id) < st.n) || null;
const STAMP_COINS = { bronze: 50, silver: 100, gold: 200, diamond: 500 };   // (v186) what a new stamp pays (crates are gone)
const openTracks = () => TRACK_ORDER.filter(trackOpen);
/* ---------- (v166, the user) CRATES, and the pass rewards that give them ----------
   Three crates: PAINT (a body colour — the shop's 25 plus 12 crate-only paints), TYRE (a tyre style — the colours
   of the rubber, rim, spokes, hub and LED ring), KART (different karts — coming soon, not filled yet).
   A crate opens with a shake, a burst and a reveal card in the prize's rarity colour; an item you already own is
   never given twice (a crate with nothing left in it gives 100 coins instead). */
const RARITY = { common: ['COMMON', '#9aa8b8', '#4b5866'], uncommon: ['UNCOMMON', '#86e04a', '#2f7a12'], rare: ['RARE', '#55b4ff', '#1d4fb8'], epic: ['EPIC', '#d06cff', '#6a1fb0'], legendary: ['LEGENDARY', '#ffbe4a', '#c0601a'] };
const RAR_W = { common: 44, uncommon: 26, rare: 18, epic: 9, legendary: 3 };
const CRATE_PAINTS = [
  { name: 'Neon Lime', color: '#9cff1a', rar: 'rare' }, { name: 'Electric Blue', color: '#1f5bff', rar: 'rare' }, { name: 'Hot Pink', color: '#ff1f8f', rar: 'rare' },
  { name: 'Tangerine Glow', color: '#ff9500', rar: 'rare' }, { name: 'Arctic Mint', color: '#8ff5dc', rar: 'uncommon' }, { name: 'Cherry Blossom', color: '#ffb3d1', rar: 'uncommon' },
  { name: 'Lava Red', color: '#c4190b', rar: 'epic' }, { name: 'Midnight Galaxy', color: '#241657', rar: 'epic' }, { name: 'Royal Gold', color: '#d9a520', rar: 'epic' },
  { name: 'Champion Gold', color: '#ffc800', rar: 'legendary' }, { name: 'Diamond White', color: '#f7fbff', rar: 'legendary' }, { name: 'Shadow Black', color: '#141519', rar: 'legendary' },
];

const CRATES = { paint: { name: 'PAINT CRATE', rar: 'rare', what: 'a new body colour' }, tyre: { name: 'TYRE CRATE', rar: 'epic', what: 'a new tyre style' }, kart: { name: 'KART CRATE', rar: 'legendary', what: 'a new kart', soon: true } };
const crates = () => (save.crates = save.crates || { paint: 0, tyre: 0, kart: 0 });
const paintPool = () => [...BODY_COLORS.map((c) => ({ ...c, rar: 'common' })), ...CRATE_PAINTS].map((c) => ({ ...c, kind: 'paint', id: c.color }));
const tyreOwned = () => (save.kart.tyresOwned = save.kart.tyresOwned || ['classic']);
function rollCrate(kind) {
  const K2 = save.kart, pool = kind === 'paint' ? paintPool().filter((c) => !K2.bodiesOwned.includes(c.id)) : TYRE_STYLES.filter((t) => !tyreOwned().includes(t.id)).map((t) => ({ ...t, kind: 'tyre' }));
  if (!pool.length) { save.coins += 100; return { kind: 'coins', name: '100 COINS', rar: 'rare' }; }
  const rars = Object.keys(RAR_W).filter((r) => pool.some((p) => p.rar === r)), tot = rars.reduce((a, r) => a + RAR_W[r], 0);
  let x = Math.random() * tot, rar = rars[0]; for (const r of rars) { if ((x -= RAR_W[r]) < 0) { rar = r; break; } }
  const list = pool.filter((p) => p.rar === rar), prize = list[Math.floor(Math.random() * list.length)];
  if (kind === 'paint') K2.bodiesOwned.push(prize.id); else tyreOwned().push(prize.id);
  return prize;
}
// a little picture of a tyre style (for the garage picker and the crate reveal)
const TYRE_ICON = new Map();
function tyreIconURL(st, sk = DEFAULT_SKIN) {
  if (st.model || st.id === 'classic') return `ui/tyre-${st.model || 'classic'}.png?v=2`;   // (v193) a plain front view of each tyre
  const key = st.id + sk.body + sk.light; if (TYRE_ICON.has(key)) return TYRE_ICON.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), C = 64;
  const ring = (r, col) => { x.beginPath(); x.arc(C, C, r, 0, Math.PI * 2); x.fillStyle = col; x.fill(); };
  ring(60, '#0d0f14'); ring(57, st.rubber || '#23252c');
  x.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 20; k++) { x.save(); x.translate(C, C); x.rotate(k / 20 * Math.PI * 2); x.fillRect(-4, -57, 8, 9); x.restore(); }
  ring(40, st.led || sk.light); ring(35, st.rim || '#8d96a4');
  x.strokeStyle = st.spokes || sk.body; x.lineWidth = 7; x.lineCap = 'round';
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; x.beginPath(); x.moveTo(C + Math.cos(a) * 8, C + Math.sin(a) * 8); x.lineTo(C + Math.cos(a) * 31, C + Math.sin(a) * 31); x.stroke(); }
  ring(10, st.hub || '#dfe4ea'); ring(4, '#2a2e3a');
  x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.ellipse(C - 14, C - 22, 26, 10, -.6, 0, Math.PI * 2); x.fill();
  const u = c.toDataURL(); TYRE_ICON.set(key, u); return u;
}
function equipPrize(p) {
  const K2 = save.kart; K2.skin = { ...DEFAULT_SKIN, ...(K2.skin || {}) };
  if (p.kind === 'paint') K2.skin.body = p.id; else if (p.kind === 'tyre') K2.skin.tyre = p.id;
  store(); setShowRacer(); SHOW.spin = 1;
}
// the opening: the crate shakes, bursts, and the prize comes out on a card in its rarity colour
function openCrate(kind) {
  const C0 = CRATES[kind], N = crates();
  if (C0.soon) { sfx.wrong(); toast('KART CRATES\n<small>coming soon!</small>', '#ffe14a', 30); return; }
  if (!(N[kind] > 0)) { sfx.wrong(); toast('No crates yet\n<small>level up the pass to get one</small>', '#ffe14a', 28); return; }
  N[kind]--; const p = rollCrate(kind); store(); refreshCounters();
  const S = $('crate'), R = RARITY[p.rar]; S.hidden = false; sfx.power();
  S.innerHTML = `<div class="crv" style="--r1:${R[1]};--r2:${R[2]}"><div class="crrays"></div><img class="crbox" src="ui/crate-${kind}.png?v=2" alt=""><div class="crcard" hidden></div></div>`;
  const box = S.querySelector('.crbox'), card = S.querySelector('.crcard'), v = S.querySelector('.crv');
  setTimeout(() => { box.classList.add('shake'); }, 150);
  setTimeout(() => { box.classList.add('burst'); v.classList.add('lit'); sfx.fanfare(); buzz([30, 30, 60]); }, 1500);
  setTimeout(() => {
    const pic = p.kind === 'paint' ? `<i class="crsw" style="--c:${swatchCSS(p.id)}"></i>` : p.kind === 'tyre' ? `<img class="crty" src="${tyreIconURL(p, { ...DEFAULT_SKIN, ...(save.kart.skin || {}) })}" alt="">` : ico('coin', 'crcoin');
    card.innerHTML = `<span class="crrar">${R[0]}</span>${pic}<b class="crname">${p.name}</b><span class="crkind">${p.kind === 'paint' ? 'BODY PAINT' : p.kind === 'tyre' ? 'TYRE STYLE' : 'COINS'}</span>
      <div class="crbtns">${p.kind !== 'coins' ? '<button class="btn gold" id="crEquip">EQUIP</button>' : ''}<button class="btn" id="crOk" style="--c:#8a94a8">OK</button></div>`;
    card.hidden = false; L.say(p.name);
    const done = () => { S.hidden = true; S.innerHTML = ''; if (!$('pass').hidden) goLicence(); refreshCounters(); };
    if ($('crEquip')) tap($('crEquip'), () => { sfx.coin(); equipPrize(p); toast(`${p.name} ON!`, '#ffe14a', 30); done(); });
    tap($('crOk'), () => { sfx.click(); done(); });
  }, 1900);
}
// the pass rewards: a map every 10th level, a TYRE crate every 5th, a PAINT crate every other level, coins between
const passReward = (lv) => (lv === PASS_MAX ? { crate: 'tyre', coins: 100, rar: 'legendary' } : lv % PASS_STEP === 0 ? { map: TRACK_ORDER[lv / PASS_STEP] || null, coins: 50, rar: 'legendary' }
  : lv % 5 === 0 ? { crate: 'tyre', rar: 'epic' } : lv % 2 === 0 ? { crate: 'paint', rar: 'rare' } : { coins: 25, rar: lv % 3 === 0 ? 'uncommon' : 'common' });
const passGive = (r) => { if (r.coins) save.coins += r.coins; if (r.crate) crates()[r.crate]++; };
// (v166) levels reached before crates existed give their crates once
if (save.pass && save.pass.claimed == null) { let lv = 0, left = save.pass.nuts || 0; while (lv < 50 && left >= 50 + 3 * (lv + 1)) { left -= 50 + 3 * (lv + 1); lv++; } save.pass.claimed = lv; store(); }   // (levels already paid under the v165 costs)
if (save.pass && save.pass.v !== 2) { const lv = passOf().lv; crates(); for (let l = 1; l <= lv; l++) { const r = passReward(l); if (r.crate) save.crates[r.crate]++; } save.pass.v = 2; store(); }
// a race's nuts: the place and the right answers, times how far along the map is; level-ups pay their rewards
function passAward(place) {
  save.pass = save.pass || { nuts: 0, v: 2 };
  const right = race.learn.practised.filter((p) => p.ok).length, id = TDEF.id, base = PLACE_NUTS[place - 1] + Math.min(15, right), nuts = Math.round(base * mapMult(id));
  const before = passOf(save.pass.nuts); save.pass.nuts += nuts; const after = passOf(save.pass.nuts), ups = [];
  for (let l = before.lv + 1; l <= after.lv; l++) { const r = passReward(l), paid = l <= (save.pass.claimed || 0); if (!paid) passGive(r); ups.push({ lv: l, ...r, paid }); }   // (never a level's reward twice)
  save.pass.claimed = Math.max(save.pass.claimed || 0, after.lv);
  store(); return { nuts, base, mult: mapMult(id), right, before, after, ups };
}
// (v185) the strip on the results: this map's wins and the next stamp; a new stamp gives a crate, the 2nd win opens the next map
function showLicenceGain(place) {
  const el0 = $('rpass'), id = TDEF.id, w = winsOn(id), got = place === 1 ? STAMPS.find((st) => st.n === w) : null, nx = nextStamp(id), top = stampsOf(id).pop(), nextMap = TRACK_ORDER[mapIdx(id) + 1];
  if (el0) el0.innerHTML = `<div class="rlic">${licenceCardHTML(got ? { map: id } : null)}</div><span class="lgain">${top ? `<img src="ui/stamp-${top.id}.png?v=1" alt="">` : ''}<span><b>${place === 1 ? 'WIN!' : 'LICENCE'}</b> ${TDEF.name}: ${w} win${w === 1 ? '' : 's'}${nx ? ` · ${nx.n - w} more for ${nx.name}` : ' · every stamp!'}</span></span>`;
  if (el0) tiltCard(el0.querySelector('.ltilt'));
  // (v209) a new stamp: the LICENCE tab opens by itself and the stamp lands on the card
  if (got) { const c = STAMP_COINS[got.id]; save.coins += c; store(); setTimeout(() => { if (screen !== 'podium') return; resultsTab('lic'); setTimeout(() => dropStamp(el0.querySelector('.ltilt'), () => { toast(`NEW ${got.name} STAMP!\n<small>${TDEF.name} · +${c} coins</small>`, '#ffe14a', 40); sfx.fanfare(); refreshCounters(); L.say(`New ${got.name.toLowerCase()} stamp!`); }), 500); }, 3400); }
  { const mg = race && race.mapGain, nx2 = TRACK_ORDER.find((m) => !trackOpen(m));
    const rp = document.querySelector('#results .rpage[data-p=race]'); if (rp) rp.querySelectorAll('.rmapg').forEach((x) => x.remove());
    if (mg && rp) { const d = document.createElement('div'); d.className = 'rmapg'; d.innerHTML = `<b>+${mg.g} MAP POINTS</b>${nx2 ? `<span>${TRACK_DEFS[nx2].name}</span>${mapBarHTML(nx2)}` : '<span>every map is open!</span>'}`; rp.prepend(d); }
    if (mg && mg.opened.length) setTimeout(() => { for (const m of mg.opened) toast(`NEW MAP!\n<small>${TRACK_DEFS[m].name} is open</small>`, '#ffe14a', 46); sfx.fanfare(); }, got ? 3600 : 1300); }
}
// the strip on the results: +nuts (with the map's multiplier), the level bar filling up, then the level-ups
function showPassGain(g) {
  const el0 = $('rpass'); if (!el0) return;
  const pct = (p) => (p.need ? p.into / p.need * 100 : 100);
  el0.innerHTML = `<span class="pgain">${ico('nut', 'pnut')}+${g.nuts}${g.mult > 1 ? `<small>×${g.mult} ${TDEF.name}</small>` : ''}</span><span class="plv">LV <b id="rpLv">${g.before.lv}</b></span><span class="pbar2"><i id="rpBar" style="width:${pct(g.before)}%"></i></span>`;
  const bar = $('rpBar'), lvE = $('rpLv'); let step = 0;
  const steps = [...g.ups.map((u) => ({ to: 100, lv: u.lv, u })), { to: pct(g.after), lv: g.after.lv }];
  const next = () => {
    if (step >= steps.length || !bar.isConnected) return; const s = steps[step++];
    bar.style.transition = 'width .7s ease-out'; bar.style.width = `${s.to}%`;
    setTimeout(() => {
      if (!bar.isConnected) return;
      if (s.u) {
        lvE.textContent = s.lv; sfx.power();
        if (s.u.map) { toast(`${ico('nut', 'tico')} NEW MAP!\n<small>${TRACK_DEFS[s.u.map].name} is open</small>`, '#ffe14a', 46); L.say(`New map! ${TRACK_DEFS[s.u.map].name}!`); sfx.fanfare(); }
        else if (s.u.crate) toast(`PASS LEVEL ${s.lv}!\n<small>+1 ${CRATES[s.u.crate].name}</small>`, '#ffe14a', 36);
        else toast(`PASS LEVEL ${s.lv}!\n<small>+${s.u.coins} coins</small>`, '#ffe14a', 36);
        bar.style.transition = 'none'; bar.style.width = '0%'; void bar.offsetWidth;
      }
      next();
    }, s.u ? 850 : 750);
  };
  setTimeout(next, 900);
}
// the PASS screen, the way a battle pass looks: the reward you picked big on the left in its rarity colour,
// pages of ten levels on the right as rarity tiles, and your crates along the bottom
let passPage = null, passSel = null;
const LOCK_SVG = '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="5" y="10" width="14" height="11" rx="2.5" fill="#fff"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#fff" stroke-width="2.6"/></svg>';
const passImg = (r, cls = 'fimg') => (r.map ? `<span class="${cls} map${trackOpen(r.map) ? '' : ' locked'}" style="background-image:url(img/track-${r.map}.jpg?v=2)"></span>` : r.crate ? `<img class="${cls}" src="ui/crate-${r.crate}.png?v=1" alt="">` : ico('coin', `${cls} coin`));
const passName = (r) => (r.map ? TRACK_DEFS[r.map].name : r.crate ? CRATES[r.crate].name : `${r.coins} COINS`);
const passKind = (r) => (r.map ? `NEW MAP · ×${mapMult(r.map)} ${ico('nut', 'pnut')}` : r.crate ? CRATES[r.crate].what : 'coins for the garage');
function goPass(sel) {
  const S = $('pass'); S.hidden = false; const p = passOf(), N = crates();
  if (passPage == null) passPage = Math.min(4, Math.floor(p.lv / 10));
  if (sel) passSel = sel; if (!passSel || Math.ceil(passSel / 10) - 1 !== passPage) passSel = Math.min(passPage * 10 + 10, Math.max(passPage * 10 + 1, p.lv + 1));
  const r0 = passReward(passSel), got0 = passSel <= p.lv, R0 = RARITY[r0.rar];
  const tiles = Array.from({ length: 10 }, (_, k) => {
    const lv = passPage * 10 + k + 1, r = passReward(lv), st = lv <= p.lv ? 'got' : lv === p.lv + 1 ? 'next' : 'lock';
    return `<button class="ft r-${r.rar} ${st}${lv === passSel ? ' sel' : ''}" data-lv="${lv}">${passImg(r)}<b class="flv">${lv}</b>${st === 'got' ? '<i class="fok">✓</i>' : st === 'lock' ? `<i class="flock">${LOCK_SVG}</i>` : ''}</button>`;
  }).join('');
  const pages = Array.from({ length: 5 }, (_, i) => { const m = TRACK_ORDER[Math.min(i + 1, TRACK_ORDER.length - 1)]; return `<button class="fpg${trackOpen(m) ? '' : ' mlock'}${i === passPage ? ' on' : ''}${p.lv >= (i + 1) * 10 ? ' done' : ''}" data-pg="${i}"><i style="background-image:url(img/track-${m}.jpg?v=2)"></i><span>${i * 10 + 1}–${i * 10 + 10}</span></button>`; }).join('');
  const crateCards = ['paint', 'tyre', 'kart'].map((k) => { const c = CRATES[k], n = N[k] || 0;
    return `<div class="fcr r-${c.rar}${c.soon ? ' soon' : ''}"><img src="ui/crate-${k}.png?v=2" alt=""><b>${c.name}</b>${c.soon ? '<span class="fsoon">COMING SOON</span>' : `<span class="fcnt">×${n}</span><button class="fopen${n ? '' : ' off'}" data-k="${k}">OPEN</button>`}</div>`; }).join('');
  S.innerHTML = `<div class="fnp">
    <div class="ftop"><div class="ftitle"><small>SEASON 1</small><b>FOXKARTS PASS</b></div>
      <div class="flvl"><span class="fbadge"><i>LEVEL</i><b>${p.lv}</b></span><div class="fbarw"><div class="fbar"><i style="width:${p.need ? p.into / p.need * 100 : 100}%"></i></div><span>${ico('nut', 'pnut')} ${p.need ? `${p.into} / ${p.need}` : 'MAX LEVEL'}</span></div></div>
      <button class="fclose" id="passBack" aria-label="Close">✕</button></div>
    <div class="fmain">
      <div class="fprev r-${r0.rar}" style="--r1:${R0[1]};--r2:${R0[2]}"><div class="fpimg">${passImg(r0, 'fbig')}</div>
        <div class="fpinfo"><span class="fprar">${R0[0]}</span><b class="fpname">${passName(r0)}</b><span class="fpkind">${passKind(r0)}</span>
        <span class="fpst${got0 ? ' ok' : ''}">${got0 ? '✓ UNLOCKED' : `${LOCK_SVG} LEVEL ${passSel}`}</span></div></div>
      <div class="fright"><div class="fpages">${pages}</div><div class="fgrid">${tiles}</div></div>
    </div>
    <div class="fcrates"><span class="fch">CRATES</span>${crateCards}</div>
  </div>`;
  for (const b of S.querySelectorAll('.ft')) tap(b, () => { sfx.click(); goPass(+b.dataset.lv); });
  for (const b of S.querySelectorAll('.fpg')) tap(b, () => { sfx.click(); passPage = +b.dataset.pg; passSel = null; goPass(); });
  for (const b of S.querySelectorAll('.fopen')) tap(b, () => openCrate(b.dataset.k));
  for (const b of S.querySelectorAll('.fcr.soon')) tap(b, () => openCrate('kart'));
  tap($('passBack'), () => { sfx.click(); S.hidden = true; passPage = null; passSel = null; refreshCounters(); });
}
/* ---------- (v185, the user) THE DRIVING LICENCE (PROFILE) ----------
   Replaces the Game Pass. A licence card with Foxino's photo in his racing helmet, your name, licence number and
   class (your English level), and five stamp boxes, one a map. Each win on a map earns its stamps — bronze (1 win),
   silver (3), gold (5), diamond (10) — and they pile up on top of each other, with the map's best time written under
   them. A map you have not opened shows how many wins on the map before it are still to go. Crates open here too. */
const ST_ANG = [-14, 9, -6, 13], ST_OFF = [[0, 0], [7, -5], [-6, -9], [5, -13]];
function licenceInfo() {
  if (!save.lic) { save.lic = { no: 'FK-' + String(Math.floor(100000 + Math.random() * 899999)), date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() }; store(); }
  return save.lic;
}
// (v209) the card itself, for the PROFILE screen and (smaller) for the results; `fresh` = a stamp just won on this map,
// left off the pile so it can land on it
function licenceCardHTML(fresh) {
  const lic = licenceInfo(), nm = (save.name || 'Foxino').trim() || 'Foxino';
  const nStamps = TRACK_ORDER.reduce((a, id) => a + stampsOf(id).length, 0);
  const slots = TRACK_ORDER.map((id) => {
    const d = TRACK_DEFS[id], open = trackOpen(id), w = winsOn(id), sts = stampsOf(id), nx = nextStamp(id), t = save.times && save.times[id] > TUNE.laps * 10 ? save.times[id] : 0;
    if (!open) { const n = mapToGo(id);
      return `<div class="lslot lock" data-map="${id}"><b class="lmap">${d.name}</b><div class="lring"><span class="lpad">${LOCK_SVG}</span></div><span class="lnote"><b>${n}</b> points to go<small>race any map</small></span></div>`; }
    const isFresh = fresh && fresh.map === id, k0 = sts.length - 1;
    const pile = sts.map((st, k) => `<img class="lstamp${isFresh && k === k0 ? ' lnew' : ''}" src="ui/stamp-${st.id}.png?v=1" alt="${st.name}" style="--r:${ST_ANG[k]}deg;--x:${ST_OFF[k][0]}%;--y:${ST_OFF[k][1]}%;--d:${(.25 + k * .2).toFixed(2)}s">`).join('');
    return `<div class="lslot${sts.length ? ' got' : ''}${isFresh ? ' fresh' : ''}" data-map="${id}"><b class="lmap">${d.name}</b><div class="lring">${pile || '<span class="lempty">WIN<br>A RACE</span>'}</div>` +
      `<span class="lbest">${t ? `BEST ${fmtTime(t)}` : '&nbsp;'}</span><span class="lnote">${nx ? `${nx.n - w} more → ${nx.name.toLowerCase()}` : 'all stamps!'}</span></div>`;
  }).join('');
  return `<div class="ltilt"><div class="lic"><i class="lshine"></i>
      <div class="lhead"><img class="llogo" src="ui/logo.png" alt=""><div class="ltitle"><b>DRIVING LICENCE</b><small>FOXKARTS RACING CLUB</small></div><span class="lclass"><i>CLASS</i><b>${L.LEVEL_NAMES[L.level()]}</b></span></div>
      <div class="lbody">
        <div class="lphoto"><img src="ui/licence-photo.jpg?v=1" alt="Foxino in his racing helmet"><i class="lholo"></i></div>
        <div class="lfields">
          <div class="lf"><i>NAME</i><b>${nm.toUpperCase()}</b></div>
          <div class="lf"><i>LICENCE NO.</i><b>${lic.no}</b></div>
          <div class="lf3"><span><i>RACES</i><b>${save.races || 0}</b></span><span><i>WINS</i><b>${save.wins || 0}</b></span><span><i>STAMPS</i><b>${nStamps}/20</b></span></div>
          <div class="lf"><i>ISSUED</i><b>${lic.date}</b></div>
          <div class="lsign">${nm}</div>
        </div>
      </div>
      <div class="lstamps">${slots}</div>
    </div></div>`;
}
// (v209, the user: "hover the stamp with your finger or the mouse and it pulls up to that side") the card tilts towards
// the finger / the pointer, and the stamp box under it lifts off the card
function tiltCard(wrap) {
  const card = wrap && wrap.querySelector('.lic'); if (!card) return;
  let lifted = null;
  const move = (e) => { const r = wrap.getBoundingClientRect(), dx = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1), dy = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1);
    wrap.style.transform = `perspective(1000px) rotateY(${(dx * 11).toFixed(2)}deg) rotateX(${(-dy * 9).toFixed(2)}deg)`; wrap.style.setProperty('--gx', `${((dx + 1) * 50).toFixed(1)}%`); wrap.style.setProperty('--gy', `${((dy + 1) * 50).toFixed(1)}%`); wrap.classList.add('tilting');
    const sl = document.elementFromPoint(e.clientX, e.clientY)?.closest('.lslot'); if (sl !== lifted) { lifted && lifted.classList.remove('lift'); lifted = sl && wrap.contains(sl) ? sl : null; lifted && lifted.classList.add('lift'); }
    if (lifted) { const b = lifted.getBoundingClientRect(); lifted.style.setProperty('--lx', `${(((e.clientX - b.left) / b.width) * 2 - 1).toFixed(2)}`); lifted.style.setProperty('--ly', `${(((e.clientY - b.top) / b.height) * 2 - 1).toFixed(2)}`); } };
  const leave = () => { wrap.style.transform = ''; wrap.classList.remove('tilting'); lifted && lifted.classList.remove('lift'); lifted = null; };
  wrap.addEventListener('pointermove', move); wrap.addEventListener('pointerdown', move); wrap.addEventListener('pointerleave', leave); wrap.addEventListener('pointercancel', leave); wrap.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') leave(); });
}
// (v209, the user: "show the stamp landing on your licence") a new stamp drops onto its box in 3D: it starts big and high,
// falls, slams down (the card shakes, an ink ring spreads, confetti), and settles at its angle on the pile
function dropStamp(wrap, onLand) {
  const slot = wrap && wrap.querySelector('.lslot.fresh'), st = slot && slot.querySelector('.lstamp.lnew'); if (!st) return;
  st.classList.add('drop'); sfx.click && sfx.click();
  setTimeout(() => { if (!st.isConnected) return; sfx.boom ? sfx.boom() : sfx.bump(); buzz && buzz([30, 20, 50]); wrap.classList.add('thud'); slot.classList.add('inked'); confettiAt(slot, 34, 1.5); setTimeout(() => wrap.classList.remove('thud'), 450); onLand && onLand(); }, 620);
}
function goLicence() {
  const S = $('pass'); S.hidden = false;
  const nStamps = TRACK_ORDER.reduce((a, id) => a + stampsOf(id).length, 0);
  const guide = STAMPS.map((st) => `<span class="lg"><img src="ui/stamp-${st.id}.png?v=1" alt=""><b>${st.name}</b><small>${st.n} win${st.n === 1 ? '' : 's'} · +${STAMP_COINS[st.id]}</small></span>`).join('');
  S.innerHTML = `<div class="licw"><button class="fclose" id="passBack" aria-label="Close">✕</button>
    ${licenceCardHTML()}
    <div class="lguide">${guide}<p>Win races on a map to stamp your licence. Every race gives map points — a full bar opens the next map.</p></div>
  </div>`;
  tiltCard(S.querySelector('.ltilt'));
  for (const b of S.querySelectorAll('.lslot.lock')) tap(b, () => { sfx.wrong(); });
  tap($('passBack'), () => { sfx.click(); S.hidden = true; refreshCounters(); });
  if (nStamps) setTimeout(() => sfx.coin(), 400);
}
tap($('passBtn'), () => { sfx.click(); goLicence(); }); tap($('passPill'), () => { sfx.click(); goLicence(); }); tap($('tPass'), () => { sfx.click(); goLicence(); });

/* ---------- (v172, the user's note) THE FIRST OPEN: the story, the colour, the test drive ----------
   1. A cutscene (made with Higgsfield: video/intro-*.mp4): Foxino opens an old garage and finds a rusty kart with
      parts missing; he fixes it and cleans it. 2. You choose its colour: BLUE, GREEN or RED. 3. Foxino paints it
      (the clip for your colour). 4. The kart in your colour in the 3D lobby, and "Let's go for a test drive!" → GO.
   5. The test drive (startTutorial): you pick how you steer, then drive the Alps alone; at each new thing the race
      slows down, an arrow marks it and Foxino says what it is; at the end you go into the pit, and you are
      congratulated. Settings > Game > TUTORIAL plays it all again.
   (v286, the user: "remove the tutorial level") step 5 is gone: after the reveal you pick how you steer and go to the
   lobby. startTutorial / tutPrep / updateTut / tutDone are left in but nothing starts them (race.tut stays unset). */
const INTRO_COL = { blue: ['BLUE', '#1853a0'], green: ['GREEN', '#2b8e72'], red: ['RED', '#df0707'] };   // (the shop's Metal Blue, Metal Green and Metal Red — brushed metal since v283)
const introV = (n) => `video/intro-${n}.mp4?v=1`;
function introUI() { const S = $('intro'); S.hidden = false; S.className = ''; return S; }
function playClip(S, name, cap) {
  return new Promise((res) => {
    S.innerHTML = `<video id="ivid" playsinline muted autoplay preload="auto" src="${introV(name)}"></video><div class="icap"><span>${cap}</span></div><button class="iskip" id="iskip">SKIP ▸▸</button>`;
    const v = S.querySelector('video'); let done = false; const end = () => { if (done) return; done = true; res(); };
    v.addEventListener('ended', end); v.addEventListener('error', end); tap($('iskip'), () => { sfx.click(); end(); });
    const p = v.play(); if (p && p.catch) p.catch(() => {}); L.say(cap.replace(/<[^>]+>/g, ''));
    setTimeout(() => { if (!done && v.paused && v.currentTime === 0) end(); }, 12000);   // (a video that cannot play never blocks the game)
  });
}
async function runIntro() {
  goMenu(); document.body.classList.add('intro');   // (screen stays 'menu', so the 3D lobby keeps drawing behind)
  for (const n of ['2-fix', '3-paint-blue', '3-paint-green', '3-paint-red']) { const l = document.createElement('link'); l.rel = 'preload'; l.as = 'video'; l.href = introV(n); document.head.appendChild(l); }
  const S = introUI();
  await playClip(S, '1-door', 'Foxino finds an old garage in the mountains…<br>What is inside?');
  await playClip(S, '2-fix', 'An old kart! Foxino fixes it and cleans it.');
  // the colour
  const col = await new Promise((res) => {
    S.innerHTML = `<img class="ibg" src="video/intro-primer.jpg?v=1" alt=""><div class="ichoose"><h2 class="out">What colour?</h2><div class="icols">${Object.entries(INTRO_COL).map(([k, [n, c]]) => `<button class="icol" data-c="${k}" style="--c:${c}"><i></i><b>${n}</b></button>`).join('')}</div></div>`;
    L.say('What colour do you want? Blue, green or red?');
    for (const b of S.querySelectorAll('.icol')) tap(b, () => { sfx.power(); L.say(INTRO_COL[b.dataset.c][0].toLowerCase()); res(b.dataset.c); });
  });
  await playClip(S, '3-paint-' + col, `Foxino paints the kart ${INTRO_COL[col][0].toLowerCase()}!`);
  // the kart in your colour, in 3D
  const K2 = save.kart, c = INTRO_COL[col][1]; K2.skin = { ...DEFAULT_SKIN, ...(K2.skin || {}), body: c }; if (!K2.bodiesOwned.includes(c)) K2.bodiesOwned.push(c); store(); setShowRacer(); SHOW.spin = 1; SHOW.pop = 1;
  S.className = 'reveal'; S.innerHTML = `<div class="irev"><h2 class="out">YOUR KART!</h2></div>`; sfx.fanfare(); L.say('Your new kart!');
  for (let i = 0; i < 50; i++) { const cf = el('div', 'confetti'); cf.style.left = rand(0, 100) + '%'; cf.style.background = pick(['#ffe14a', c, '#ffffff', '#ff8a1e']); cf.style.animationDuration = rand(1.8, 3.4) + 's'; cf.style.animationDelay = rand(0, 1) + 's'; S.appendChild(cf); }
  await wait(2200);
  // (v286, the user: "remove the tutorial level") no test drive any more: you choose how you steer and go to the lobby
  await chooseSteer(); sfx.click(); introEnd();
}
function introEnd() { const S = $('intro'); S.hidden = true; S.innerHTML = ''; S.className = ''; document.body.classList.remove('intro'); save.introDone = true; store(); if (screen !== 'race') goMenu(); }
// the steering picker at the end of the story (the same choices as in Settings > Controls); before v286 it opened the test drive
function chooseSteer() {
  return new Promise((res) => {
    const S = introUI(); S.className = 'reveal';
    if (!TOUCH) {
      S.innerHTML = `<div class="ipop card wide"><div class="tag">CONTROLS</div><p>Drive with the keyboard</p><div class="ikeys"><span><kbd>W</kbd> drive</span><span><kbd>A</kbd> <kbd>D</kbd> steer</span><span><kbd>SHIFT</kbd> drift</span><span><kbd>SPACE</kbd> power-up</span></div><button class="btn gold" id="iOk">OK ▶</button></div>`;
      tap($('iOk'), () => { sfx.click(); res(); }); return;
    }
    const up = isPortrait(), keys = up ? ['joy', 'line', 'follow', 'arrows'] : ['tilt', 'joy', 'line', 'follow', 'arrows'], cur = up ? save.steerP || 'follow' : save.steerL || 'follow';
    S.innerHTML = `<div class="ipop card wide"><div class="tag">CONTROLS</div><p>How do you want to steer?</p><div class="spick">${keys.map((k) => `<button data-v="${k}" class="${k === cur ? 'on' : ''}">${STEER_ART[k]}<span>${STEER_NAME[k]}</span></button>`).join('')}</div><button class="btn gold" id="iOk">OK ▶</button></div>`;
    for (const b of S.querySelectorAll('.spick button')) tap(b, async () => { sfx.click(); const v = b.dataset.v;
      if (v === 'tilt') { const ok = await enableTilt(); if (!ok) { toast('Tilt is not available here', '#ffb0b8', 24); return; } save.tilt = true; }
      if (up) save.steerP = v; else save.steerL = v; store(); for (const c of S.querySelectorAll('.spick button')) c.classList.toggle('on', c === b); });
    tap($('iOk'), () => { sfx.click(); res(); });
  });
}
async function startTutorial() {
  document.body.classList.add('intro'); await chooseSteer();
  const S = $('intro'); S.hidden = true; S.innerHTML = ''; S.className = ''; document.body.classList.remove('intro');
  startRace('alps', { tut: true });
}
// the coach: what is coming, in order round the lap
function tutPrep() {
  const W = WORLD, L0 = TRACK.L, ev = [], P = race.player;
  const f0 = (arr) => arr.find((f) => f * L0 > 40);
  const bf = f0(BOX_AT); if (bf) ev.push({ id: 'box', s: bf * L0, at: at(bf * L0, 0), text: 'A <b>? box</b>! Drive through it to get a <b>power-up</b>.' });
  const pd = PAD_AT.filter((p) => p.f * L0 > 40).sort((a, b) => a.f - b.f)[0]; if (pd) ev.push({ id: 'pad', s: pd.f * L0, at: at(pd.f * L0, pd.lat), text: 'A <b>boost pad</b>! Drive over it to go faster.' });
  const rf = RAMP_AT.filter((f) => f * L0 > 40).sort((a, b) => a - b)[0]; if (rf != null) ev.push({ id: 'ramp', s: rf * L0, at: at(rf * L0, 0), text: 'A <b>jump</b>! Drive up the ramp and fly.' });
  if (W.ice && W.ice[0]) { const ic = W.ice[0], s = ICE_AT.filter((f) => !inRoll(f, .025, .6))[0] * L0; ev.push({ id: 'ice', s, at: { x: ic.x, z: ic.z, y: tp(Math.round(s / STEP)).y }, text: '<b>Ice!</b> Drive around it, or you spin.' }); }
  // (no drift tip: the user, v172)
  // (v172) at least 35 m between two tips, the most useful first; the coin tip goes to a coin away from the others
  { const pri = ['box', 'ramp', 'pad', 'ice'], kept = []; for (const id of pri) { const e = ev.find((x) => x.id === id); if (e && kept.every((k) => Math.abs(k.s - e.s) > 35)) kept.push(e); }
    const cf = COIN_AT.map((f) => f * L0).sort((a, b) => a - b).find((s) => s > 40 && kept.every((k) => Math.abs(k.s - s) > 35)); if (cf) kept.push({ id: 'coin', s: cf, at: at(cf, 0), text: '<b>Coins!</b> Every coin makes your kart a little faster.' });
    ev.length = 0; ev.push(...kept); }
  ev.push({ id: 'pit', s: ((PITS.gateFrom - 45) % L0 + L0) % L0, pit: true, text: 'Now the <b>pit stop</b>! Keep driving: the crew will <b>steer you into your box</b>. After the questions you drive out yourself.' });
  // (v177) two of the formation lap's answer gates, so the gates are known before the first real race
  race.tutGates = [];
  if (W.fgates) { for (const fg of W.fgates) { if (race.tutGates.length >= 2) break; if (ev.every((e) => Math.abs(e.s - fg.s) > 40) && fg.s < ((PITS.gateFrom - 90) % L0 + L0) % L0) { race.tutGates.push(fg); ev.push({ id: 'gate' + race.tutGates.length, s: fg.s - 25, text: race.tutGates.length === 1 ? 'An <b>answer gate</b>! Listen to the word and drive through the <b>right picture</b>.' : 'Another gate! Pick the <b>right picture</b>.' }); } }
    for (const fg of W.fgates) { fg.g.visible = race.tutGates.includes(fg); fg.armed = false; fg.done = false; fg.said = false; } W.gates = race.tutGates; race.fg = { right: 0, n: 0 }; }
  ev.sort((a, b) => a.s - b.s);
  // a glowing arrow over the thing (solid colours, no glow blending)
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: '#ffe14a' }), m2 = new THREE.MeshBasicMaterial({ color: '#ff8a1e' });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(.55, 1.1, 4), m); cone.rotation.x = Math.PI; cone.position.y = 3; const stem = new THREE.Mesh(new THREE.BoxGeometry(.3, 1, .3), m); stem.position.y = 4;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, .12, 6, 28), m2); ring.rotation.x = Math.PI / 2; ring.position.y = .15; g.add(cone, stem, ring); g.visible = false; W.scene.add(g);
  race.tut = { ev, i: 0, cur: null, t: 0, arrow: g, item: false, done: false };
}
function tutSay(html) { const b = $('tutb'); b.innerHTML = `<i class="tface" style="background-image:url(ui/faces/foxino-alps.jpg?v=1)"></i><span>${html}</span>`; b.hidden = false; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); L.say(html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')); }
function tutHide() { $('tutb').hidden = true; $('slot').classList.remove('tutglow'); race.slowTarget = 1; }
function updateTut(dt) {
  const T = race.tut; if (!T || T.done || !race.started) return;
  const P = race.player, L0 = TRACK.L, pAbs = P.lap * L0 + P.sc, A = T.arrow;
  T.t += dt; A.position.y = (A.userData.y || 0) + Math.sin(performance.now() / 260) * .25;
  if (race.learn.pits > 0 && !race.dialog) { T.done = true; T.cur = null; A.visible = false; tutHide(); race.pitDue = false; setTimeout(() => tutDone(), 1500); return; }   // the pit is done: well done!
  if (T.cur) {
    const e = T.cur, eAbs = L0 + e.s;
    if ((e.pit ? false : pAbs > eAbs + (/^gate/.test(e.id) ? 30 : 5)) && T.t > 2.2 || T.t > (/^gate/.test(e.id) ? 9 : 6)) { T.cur = null; A.visible = false; tutHide(); }
  } else if (!race.dialog) {
    if (!T.item && race.item && !race.pitDue) { T.item = true; T.cur = { id: 'item', s: -1e9 }; T.t = 0; race.slowTarget = .3; $('slot').classList.add('tutglow'); tutSay(CTL === 'keys' ? 'You got a <b>power-up</b>! Press <kbd>SPACE</kbd> to use it.' : 'You got a <b>power-up</b>! Tap the round button to use it.'); return; }
    const e = T.ev[T.i]; if (!e) return;
    const eAbs = L0 + e.s;
    if (pAbs > eAbs + 5 && !e.pit) { T.i++; return; }
    if (eAbs - pAbs < (e.pit ? 0 : 30)) {
      T.i++; T.cur = e; T.t = 0; tutSay(e.text);
      if (e.pit) { race.pitDue = true; drawPitHud(); }
      else if (!/^gate/.test(e.id)) { race.slowTarget = .3; if (e.at) { A.position.set(e.at.x, 0, e.at.z); A.userData.y = e.at.y ?? (e.at.p ? e.at.p.y : 0); A.visible = true; } }
    }
  }
}
function tutDone() {
  if (!race || !race.tut) return; tutHide(); race.slowTarget = .35; const S = introUI(); S.className = 'reveal'; document.body.classList.add('intro');
  save.coins += 100; save.introDone = true; store();
  S.innerHTML = `<div class="ipop card"><div class="tag">WELL DONE!</div><h2 class="out">CONGRATULATIONS!</h2><p>You finished the test drive. You are ready to race!</p><ol class="inext"><li><b>Garage</b> · answer to get your kart ready</li><li><b>Formation lap</b> · drive through the right pictures</li><li><b>Grid box</b> · park, then wait for the lights</li><li><b>Race</b> · 5 laps, a pit stop on lap 3</li></ol><div class="igift">${ico('coin', 'tcoin')}+100</div><button class="btn gold" id="iRace">LET'S RACE! ▶</button></div>`;
  sfx.fanfare(); L.say('Congratulations! You are ready to race!');
  for (let i = 0; i < 60; i++) { const cf = el('div', 'confetti'); cf.style.left = rand(0, 100) + '%'; cf.style.background = pick(['#ffe14a', '#ff5db1', '#4fc84a', '#3c8cf0', '#ff8a1e']); cf.style.animationDuration = rand(1.8, 3.4) + 's'; cf.style.animationDelay = rand(0, 1.2) + 's'; S.appendChild(cf); }
  tap($('iRace'), () => { sfx.click(); if (race && race.tut && race.tut.arrow) race.tut.arrow.removeFromParent(); if (WORLD.fgates) { for (const fg of WORLD.fgates) fg.g.visible = false; WORLD.gates = []; } endRace(); $('tutb').hidden = true; introEnd(); goMenu(); });
}

tap($('garageBtn'), () => { if (TUNE.garageOff) return; sfx.click(); goGarage(); });
tap($('back'), () => { sfx.click(); goMenu(); });   // (v219, the user: on the phone the garage could only be left by the small tabs at the top)
// a teacher (or a parent) can choose school topics for the questions
tap($('topicBtn'), async () => {
  if (!window.FugioPacks) return; sfx.click();
  const ids = await FugioPacks.open(PACKS, save.packs, { theme: 'dtm', kicker: 'CHOOSE THE ENGLISH TOPICS' });
  if (ids) { save.packs = ids; L.setPacks(PACKS, ids); store(); goMenu(); }
});
// tap the English level to change it by hand (it also changes by itself as the child answers)
// the Word Book: every picture word by track, with its Czech meaning and stars for how well it is learned (Leitner box);
// the Word Book. The English level can be changed here too (it also changes by itself).
tap($('eng'), () => openWordBook());
tap($('klvLobby'), () => { if (TUNE.garageOff) return; sfx.click(); goGarage(); });   // (v233) the kart's level card in the lobby opens the garage
function openWordBook() {
  sfx.click(); const Qz = $('quiz'), srs = save.learn.srs, words = L.ITEMS.filter((x) => x.kind === 'word'), st = L.stats();
  const groups = [['alps', 'Alpine Peaks'], ['city', 'Robo City'], ['space', 'Star Loop']];
  Qz.hidden = false;
  Qz.innerHTML = `<button class="btn x" id="qx">X</button><h2 class="out">WORD BOOK</h2>
    <div class="qsub">${st.learning + st.mastered} learned · ${st.mastered} mastered</div>
    <div class="lvls">${L.LEVEL_NAMES.map((n, i) => `<button class="btn small ${i === L.level() ? 'on' : ''}" data-lv="${i}">${n}</button>`).join('')}</div>
    <div class="wb">${(() => { const tr = L.tricky(); return tr.length ? `<h4>Tricky ones (for the teacher)</h4><div class="trk-list">${tr.map((x) => `<div><span>${x.text}</span><i>missed ${x.miss}× · ${x.box >= 1 ? 'now ✓' : 'still learning'}</i></div>`).join('')}</div>` : ''; })()}${groups.map(([t, name]) => `<h4>${name}</h4><div class="wgrid">${words.filter((w) => w.track === t).map((w) => { const b = srs[w.id] ? srs[w.id].b : -1; return `<button class="wd ${b < 0 ? 'new' : ''}" data-w="${w.w}"><span class="e">${w.e}</span><b>${w.w}</b><i>${w.cs}</i><span class="st">${b < 0 ? '' : '★'.repeat(Math.max(1, b)) }</span></button>`; }).join('')}</div>`).join('')}</div>`;
  tap($('qx'), () => { Qz.hidden = true; Qz.innerHTML = ''; goMenu(); });
  for (const b of Qz.querySelectorAll('[data-lv]')) tap(b, () => { save.learn.lv = +b.dataset.lv; save.learn.hist = []; store(); toast(`English: ${L.LEVEL_NAMES[+b.dataset.lv]}`, '#ffe14a', 30); openWordBook(); });
}
tap($('back'), () => { sfx.click(); goMenu(); });

// the three picks in the garage show what the kart wears now; tapping one opens a popup with every choice (no scrolling)
function drawPicks(sk) {
  const P = $('picks'); P.hidden = false;
  P.innerHTML = (GARAGE_VEH === 'ship' ? ['body', 'light'] : ['body', 'light', 'logo', 'tyre']).map((kind) => {
    const sw = kind === 'tyre' ? `<i class="st" style="background-image:url(${tyreIconURL(TYRE_BY_ID[sk.tyre] || TYRE_BY_ID.classic, sk)})"></i>` : kind === 'logo' ? `<i class="st" style="background-image:url(${logoIconURL(sk.logo, sk.light)})"></i>`
      : `<i class="sw${kind === 'light' ? ' glow' : ''}" style="--c:${kind === 'body' ? swatchCSS(sk[kind]) : sk[kind]}"></i>`;   // (v283: a metal body shows brushed metal)
    return `<button class="pick" data-kind="${kind}">${sw}<span>${{ body: 'BODY', light: 'LIGHTS', logo: 'LED LOGO', tyre: 'TYRES' }[kind]}</span></button>`;
  }).join('');
  for (const b of P.querySelectorAll('.pick')) tap(b, () => openPicker(b.dataset.kind, sk));
}
function openPicker(kind, sk) {
  if (kind === 'tyre') return openTyrePicker(sk);
  const K2 = save.kart, items = kind === 'body' ? [...BODY_COLORS.map((c) => ({ ...c, cost: c.color === DEFAULT_SKIN.body ? 0 : 100 }))].map((c) => ({ ...c, id: c.color, on: sk.body === c.color, own: K2.bodiesOwned.includes(c.color) }))
    : kind === 'light' ? LIGHT_COLORS.map((c, i) => ({ ...c, cost: i ? 60 : 0, id: c.color, on: sk.light === c.color, own: K2.lightsOwned.includes(c.color) }))
    : LOGOS.map((lg) => lg.id === 'draw' ? { ...lg, cost: 0, on: isInk(sk.logo), own: true, draw: true } : ({ ...lg, cost: lg.id === 'fox' || lg.id === 'none' ? 0 : 60, on: sk.logo === lg.id, own: K2.logosOwned.includes(lg.id) }));
  const D = dialog({ body: 'BODY COLOUR', light: 'LIGHT COLOUR', logo: 'LED LOGO' }[kind], `<div class="${kind === 'logo' ? 'stickers' : 'swatches'} big${kind === 'body' ? ' five' : ''}" id="pickGrid"></div><button class="btn small" id="pickClose" style="--c:#8a94a8;margin:4px auto 0">Close</button>`);
  const grid = D.querySelector('#pickGrid');
  for (const it of items) {
    const b = el('button', (kind === 'logo' ? 'st' : 'sw' + (kind === 'light' ? ' glow' : '')) + (it.on ? ' on' : '') + (it.crate ? ' crt' : ''), it.own ? '' : it.crate ? '<span class="price crate"><img src="ui/crate-paint.png?v=2" alt=""></span>' : `<span class="price"><i class="coin"></i>${it.cost}</span>`);
    if (kind === 'logo') b.style.backgroundImage = `url(${it.draw ? drawTileURL(sk) : logoIconURL(it.id, sk.light)})`; else b.style.setProperty('--c', kind === 'body' ? swatchCSS(it.color) : it.color);   // (v283: metal paints show brushed metal)
    b.title = it.name; tap(b, () => { closeDialog(); if (it.draw) openDrawPad(); else buy(kind, it); }); grid.appendChild(b);
  }
  tap(D.querySelector('#pickClose'), () => { sfx.click(); closeDialog(); });
}
// (v298, the user) DRAW YOUR OWN LED LOGO: draw black on a white pad; the kart shows it glowing in the light colour on black
function drawTileURL(sk) {
  if (save.kart.ink) return logoIconURL(save.kart.ink, sk.light);
  const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d');
  x.fillStyle = '#050508'; x.beginPath(); x.roundRect(4, 4, 88, 88, 18); x.fill();
  x.translate(48, 46); x.rotate(-Math.PI / 4); x.strokeStyle = sk.light; x.lineWidth = 5; x.lineJoin = x.lineCap = 'round'; x.shadowColor = sk.light; x.shadowBlur = 8;
  x.strokeRect(-9, -30, 18, 40); x.beginPath(); x.moveTo(-9, 10); x.lineTo(0, 26); x.lineTo(9, 10); x.moveTo(-9, -20); x.lineTo(9, -20); x.stroke();
  x.setTransform(1, 0, 0, 1, 0, 0); x.beginPath(); x.moveTo(22, 80); x.quadraticCurveTo(36, 70, 48, 80); x.quadraticCurveTo(60, 90, 74, 80); x.stroke();
  return c.toDataURL();
}
function openDrawPad() {
  const sk = { ...DEFAULT_SKIN, ...(save.kart.skin || {}) }, P = 288;
  const D = dialog('DRAW YOUR LOGO', `<div class="dpad"><div class="dcol"><canvas id="dpC" width="${P}" height="${P}"></canvas><small>DRAW IN BLACK</small></div>
    <div class="dside"><div class="dcol"><canvas id="dpL" width="192" height="192"></canvas><small>ON YOUR KART</small></div>
    <div class="dtools"><button class="btn small dt on" data-w="9">Thin</button><button class="btn small dt" data-w="20">Thick</button><button class="btn small dt" data-w="-1">Eraser</button><button class="btn small" id="dpU" style="--c:#8a94a8">Undo</button><button class="btn small" id="dpX" style="--c:#8a94a8">Clear</button></div>
    <div class="dtools"><button class="btn small" id="dpCancel" style="--c:#8a94a8">Cancel</button><button class="btn small" id="dpOk" style="--c:#36c26a">Use it</button></div></div></div>`);
  D.querySelector('.card').classList.add('dwide');
  const C = D.querySelector('#dpC'), x = C.getContext('2d'), L = D.querySelector('#dpL'), lx = L.getContext('2d'), undo = [];
  x.fillStyle = '#fff'; x.fillRect(0, 0, P, P);
  if (save.kart.ink) { const pad = P * .1, t = inkLayer(save.kart.ink, '#000', P, pad); x.drawImage(t, 0, 0); }
  let W = 9, last = null, queued = false;
  const preview = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; const id = inkFromCanvas(C); lx.clearRect(0, 0, 192, 192); lx.drawImage(logoCanvas(id || 'draw', sk.light, sk.body, 192, true), 0, 0); }); };
  const at = (e) => { const r = C.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * P, (e.clientY - r.top) / r.height * P]; };
  const line = (a, b) => { x.strokeStyle = W < 0 ? '#fff' : '#000'; x.lineWidth = W < 0 ? 28 : W; x.lineCap = x.lineJoin = 'round'; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); };
  C.addEventListener('pointerdown', (e) => { e.preventDefault(); C.setPointerCapture(e.pointerId); undo.push(x.getImageData(0, 0, P, P)); if (undo.length > 25) undo.shift(); last = at(e); line(last, last); preview(); });
  C.addEventListener('pointermove', (e) => { if (!last) return; e.preventDefault(); const p = at(e); line(last, p); last = p; preview(); });
  const up = () => { last = null; }; C.addEventListener('pointerup', up); C.addEventListener('pointercancel', up);
  for (const b of D.querySelectorAll('.dt')) tap(b, () => { sfx.click(); W = +b.dataset.w; for (const o of D.querySelectorAll('.dt')) o.classList.toggle('on', o === b); });
  tap(D.querySelector('#dpU'), () => { sfx.click(); if (undo.length) { x.putImageData(undo.pop(), 0, 0); preview(); } });
  tap(D.querySelector('#dpX'), () => { sfx.click(); undo.push(x.getImageData(0, 0, P, P)); x.fillStyle = '#fff'; x.fillRect(0, 0, P, P); preview(); });
  tap(D.querySelector('#dpCancel'), () => { sfx.click(); closeDialog(); });
  tap(D.querySelector('#dpOk'), () => {
    const id = inkFromCanvas(C); if (!id) { sfx.wrong(); const m = D.querySelector('.dcol small'); m.textContent = 'DRAW SOMETHING FIRST!'; m.style.color = '#e8333a'; return; }
    sfx.coin(); closeDialog(); const K2 = save.kart; K2.ink = id; K2.skin = { ...DEFAULT_SKIN, ...(K2.skin || {}) }; K2.skin.logo = id;
    setShowRacer(); SHOW.spin = 1; store(); goGarage();
  });
  preview();
}
function openTyrePicker(sk) {
  const D = dialog('TYRES', '<div class="stickers big" id="pickGrid"></div><div class="tyname" id="tyName"></div><button class="btn small" id="pickClose" style="--c:#8a94a8;margin:4px auto 0">Close</button>');
  const grid = D.querySelector('#pickGrid'), own = tyreOwned();
  for (const t of TYRE_STYLES) {
    const cost = RARITY_COST[t.rar] || 0, has = own.includes(t.id) || !cost, b = el('button', 'st ty r-' + t.rar + (t.model ? ' design' : '') + ((sk.tyre || 'classic') === t.id ? ' on' : ''), has ? '' : `<span class="price"><i class="coin"></i>${cost}</span>`);
    b.style.backgroundImage = `url(${tyreIconURL(t, sk)})`; b.title = t.name;
    tap(b, () => {
      // (v186) no crates: a tyre you don't have yet is bought with coins, then fitted
      if (!has) { if (!DEV() && save.coins < cost) { sfx.wrong(); toast('Not enough coins', '#ff8a8a'); return; } if (!DEV()) save.coins -= cost; own.push(t.id); sfx.coin(); refreshCounters(); } else sfx.click();
      closeDialog(); const K2 = save.kart; K2.skin = { ...DEFAULT_SKIN, ...(K2.skin || {}) }; K2.skin.tyre = t.id; store();
      if (t.model) loadTyreModel(t.model).then(() => { setShowRacer(); SHOW.spin = 1; }); setShowRacer(); SHOW.spin = 1; goGarage();
    });
    const nmL = el('span', 'tyn', t.name); b.appendChild(nmL);
    grid.appendChild(b);
  }
  tap(D.querySelector('#pickClose'), () => { sfx.click(); closeDialog(); });
}
function goGarage() {
  // (v242, the user) the panel keeps its scroll place when it is redrawn (an upgrade, a part), so you can tap UPGRADE again and again
  const keepY = screen === 'garage' ? [$('shop').scrollTop, $('ups').scrollTop] : null;
  if (keepY) requestAnimationFrame(() => { $('shop').scrollTop = keepY[0]; $('ups').scrollTop = keepY[1]; });
  screen = 'garage'; showOnly('garage'); refreshCounters();
  $('gtabs').hidden = true;   // (v233) no tabs: the style picks are on top, the upgrades under them
  const K2 = save.kart, sw = $('swatches'), st = $('stickers'), ups = $('ups'); sw.innerHTML = st.innerHTML = ups.innerHTML = '';
  $('lightRow').innerHTML = $('logos').innerHTML = '';
  for (const id of ['hLights', 'lightRow', 'hLogos', 'logos']) $(id).hidden = !BASE.dk;
  $('hStickers').hidden = st.hidden = !!BASE.dk; $('hColour').textContent = BASE.dk ? 'BODY' : 'COLOUR';
  // (v184) the vehicle switch: your kart, or the starship you fly on Star Loop
  { const vh = $('vehs'); if (vh) vh.hidden = true; }
  // (v241, the user) KART / STARSHIP: a card in the style of the driving licence, on top of the view, each with its level
  { const gv = $('gveh'), on = !!(BASE.dk && BASE.ship); gv.hidden = !on;
    if (on) { gv.innerHTML = `<div class="gvh"><img class="klc-logo" src="ui/logo.png" alt=""><b>MY GARAGE</b></div><div class="gvb">${[['kart', 'KART', 'every track'], ['ship', 'STARSHIP', 'Star Loop']].map(([id, n, sub]) => { const lv = vehLevel(id); return `<button class="gvo${gVeh() === id ? ' on' : ''}${lv >= KART_MAX ? ' gold' : ''}" data-v="${id}"><b>${n}</b><small>${sub}</small><em>LV ${lv}</em></button>`; }).join('')}</div>`;
      for (const b of gv.querySelectorAll('.gvo')) tap(b, () => { if (gVeh() === b.dataset.v) return; sfx.click(); GARAGE_VEH = b.dataset.v; G3.part = null; G3.zoom = 0; setShowRacer(); SHOW.pop = 1; goGarage(); }); } }
  if (BASE.dk) {
    const sk = GARAGE_VEH === 'ship' ? shipSkin() : { ...DEFAULT_SKIN, ...(K2.skin || {}) };
    drawPicks(sk);
    BODY_COLORS.forEach((c) => { const cost = c.color === DEFAULT_SKIN.body ? 0 : 100, own = K2.bodiesOwned.includes(c.color), b = el('button', 'sw' + (sk.body === c.color ? ' on' : ''), own ? '' : `<span class="price"><i class="coin"></i>${cost}</span>`); b.style.setProperty('--c', swatchCSS(c.color)); b.title = c.name; tap(b, () => buy('body', { ...c, cost })); sw.appendChild(b); });
    LIGHT_COLORS.forEach((c, i) => { const cost = i ? 60 : 0, own = K2.lightsOwned.includes(c.color), b = el('button', 'sw glow' + (sk.light === c.color ? ' on' : ''), own ? '' : `<span class="price"><i class="coin"></i>${cost}</span>`); b.style.setProperty('--c', c.color); b.title = c.name; tap(b, () => buy('light', { ...c, cost })); $('lightRow').appendChild(b); });
    LOGOS.forEach((lg) => { if (lg.id === 'draw') { const b = el('button', 'st' + (isInk(sk.logo) ? ' on' : '')); b.style.backgroundImage = `url(${drawTileURL(sk)})`; b.title = lg.name; tap(b, () => openDrawPad()); $('logos').appendChild(b); return; } const cost = lg.id === 'fox' || lg.id === 'none' ? 0 : 60, own = K2.logosOwned.includes(lg.id), b = el('button', 'st' + (sk.logo === lg.id ? ' on' : ''), own ? '' : `<span class="price"><i class="coin"></i>${cost}</span>`); b.style.backgroundImage = `url(${logoIconURL(lg.id, sk.light)})`; b.title = lg.name; tap(b, () => buy('logo', { ...lg, cost })); $('logos').appendChild(b); });
  }
  if (!BASE.dk) for (const c of KART_COLORS) {
    const own = K2.colorsOwned.includes(c.color), b = el('button', 'sw' + (K2.color === c.color ? ' on' : ''), own ? '' : `<span class="price"><i class="coin"></i>${c.cost}</span>`);
    b.style.setProperty('--c', css(c.color)); b.title = c.name; tap(b, () => buy('color', c)); sw.appendChild(b);
  }
  if (!BASE.dk) for (const s of STICKERS) {
    const own = K2.stickersOwned.includes(s.id), b = el('button', 'st' + (K2.sticker === s.id ? ' on' : ''), own ? '' : `<span class="price"><i class="coin"></i>${s.cost}</span>`);
    b.style.backgroundImage = `url(${stickerURL[s.id]})`; b.title = s.name; tap(b, () => buy('sticker', s)); st.appendChild(b);
  }
  drawGarageUp(ups); drawGarageSpots(); ups.hidden = false;
  if (keepY) { $('shop').scrollTop = keepY[0]; $('ups').scrollTop = keepY[1]; }   // at once, so nothing jumps
}
function buy(kind, item) {
  const K2 = save.kart;
  if (kind === 'body' || kind === 'light' || kind === 'logo') {
    const owned = { body: K2.bodiesOwned, light: K2.lightsOwned, logo: K2.logosOwned }[kind], id = kind === 'logo' ? item.id : item.color;
    if (!owned.includes(id)) { if (!DEV() && save.coins < item.cost) { sfx.wrong(); toast('Not enough coins', '#ff8a8a'); return; } if (!DEV()) save.coins -= item.cost; owned.push(id); sfx.coin(); }
    else sfx.click();
    if (GARAGE_VEH === 'ship' && kind !== 'logo') { K2.ship = { ...(K2.ship || {}), [kind]: id }; setShowRacer(); SHOW.spin = 1; store(); goGarage(); return; }   // (v184) the starship's own paint
    K2.skin = { ...DEFAULT_SKIN, ...(K2.skin || {}) }; K2.skin[kind] = id; if (kind === 'light') K2.skin.logoColor = id;
    setShowRacer(); SHOW.spin = 1; store(); goGarage(); return;
  }
  if (kind === 'color' || kind === 'sticker') {
    const owned = kind === 'color' ? K2.colorsOwned : K2.stickersOwned, id = kind === 'color' ? item.color : item.id;
    if (!owned.includes(id)) { if (!DEV() && save.coins < item.cost) { sfx.wrong(); toast('Not enough coins', '#ff8a8a'); return; } if (!DEV()) save.coins -= item.cost; owned.push(id); sfx.coin(); }
    else sfx.click();
    if (kind === 'color') K2.color = id; else K2.sticker = id;
    setShowRacer(); SHOW.spin = 1;
  } else {
    const U = upsOf(gVeh()), lvl = vehLv(gVeh()), L0 = vehLevel(gVeh()); if (lvl >= KART_MAX - 1) return;   // (v266) one upgrade: the level
    const cost = LEVEL_COST(lvl);
    if (!DEV() && save.coins < cost) { sfx.wrong(); toast('Not enough coins', '#ff8a8a'); return; }
    if (!DEV()) save.coins -= cost; U.lv = lvl + 1; sfx.power();
    SHOW.pop = .6; racerPlate(); G3.from = L0;   // (v233) every upgrade is a kart level: the card fills from the old one
    const L1 = vehLevel(gVeh()), VN = gVeh() === 'ship' ? 'STARSHIP' : 'KART'; setTimeout(() => { if (screen !== 'garage') return; if (L1 >= KART_MAX) { sfx.fanfare(); toast(`GOLDEN ${VN}!\n<small>level 25 — every part at its best</small>`, '#ffd23a', 50); SHOW.pop = 1; } else toast(`${VN} LEVEL ${L1}!`, '#ffe14a', 34); }, 700);
  }
  store(); goGarage();
}

/* ---------- a question card: pit stops and flash cards use the same one ----------
   The question is read aloud. Answers unlock after 0.8 s (no button mashing). Right: a green glow and the full sentence
   spoken. Wrong: the chosen answer goes grey, the right one glows, the full sentence is shown and spoken, and a short
   Czech hint explains the mistake; tap OK (or wait 4 s). Nothing is ever taken away for a wrong answer. */
// limit (seconds, pit stops only): a bar runs down while the race goes on in slow motion; when it is empty the question
// counts as missed and the right answer is shown and read
// the speaker on a question card (an SVG, not an emoji)
const SPK = '<img class="spkimg" src="ui/icon-speaker.png?v=1" alt="">';   // (the painted speaker, v65)
function questionCard(host, title, q, done, limit = 0, ctl = null, waitWrong = false) {
  const body = q.fmt === 'pic' ? `<div class="qpic">${q.pic}</div><div class="qask">What is it?</div>`
    : q.fmt === 'word' ? `<div class="qword">${q.it.w}</div><div class="qask">Tap the picture</div>`
    : q.fmt === 'gap' ? `${q.pic ? `<div class="qpic sm">${q.pic}</div>` : ''}<div class="sent" id="qsent">${gapHTML(q.it.s)}</div>`
    : `<div class="qask">Choose the answer</div><div class="sent" id="qsent">${q.it.q}</div>`;
  const long = q.opts.some((o) => o.length > 11);   // short answers sit side by side on a pit-stop card
  host.innerHTML = `<div class="card qcard${limit ? ' pit' : ''}"><div class="qtop"><div class="tag">${title}</div>${limit ? '<div class="qtime"><i></i></div>' : ''}<div class="qL">${body}</div></div><div class="qR"><div class="opts ${q.fmt === 'word' ? 'pics' : long ? '' : q.opts.some((o) => o.length > 7) ? 'row mid' : 'row'} wait"></div><div class="fb" hidden></div></div></div>`;
  const opts = host.querySelector('.opts'), fb = host.querySelector('.fb'); let answered = false, tLeft = 1, waiting = null;
  setTimeout(() => opts.classList.remove('wait'), limit ? 180 : 800);   // (v206: quicker in the pit)
  const answer = (o, bt) => {
    if (answered) return; answered = true;
    const fast = o ? tLeft : 0;   // (v154) nothing for an answer the clock beat you to
    const ok = o === q.answer, change = L.record(q.it, ok, race && race.learn ? race.learn.queue : null);
    if (race && race.learn) { const lr = race.learn; lr.practised.push({ id: q.it.id, label: q.it.kind === 'word' ? `${q.it.e} ${q.it.w}` : q.answer, ok }); if (ok && lr.missed.has(q.it.id)) lr.fixed.add(q.it.id); if (!ok) lr.missed.add(q.it.id); }
    if (bt) bt.classList.add(ok ? 'ok' : 'grey'); for (const x of opts.children) if (x.textContent === q.answer) x.classList.add('ok');
    const sent = host.querySelector('#qsent');
    if (sent && q.fmt === 'gap') { sent.innerHTML = q.it.s.replace('___', `<b class="ans">${q.answer}</b>`); sent.classList.add(ok ? 'ok' : 'no'); }
    // Starter (young children who don't read yet): after a mistake on a word, hear its Czech meaning too
    L.say(!ok && q.it.kind === 'word' && L.level() === 0 ? [q.full, { cs: q.it.cs }] : q.full);
    if (change) setTimeout(() => toast(change > 0 ? `Level up! English ${L.LEVEL_NAMES[L.level()]}` : `Easier questions for a while`, '#ffe14a', 26), 400);
    if (ok) { sfx.right(); fb.hidden = false; fb.innerHTML = `<span class="yes">${q.fmt === 'gap' ? 'Yes!' : q.fmt === 'reply' ? 'Yes!' : `Yes! ${q.it.e} ${q.it.w}`}</span>`; if (bt) confettiAt(bt, waitWrong === 'quick' ? 80 : limit ? 22 : 30, waitWrong === 'quick' ? 1.7 : 1); setTimeout(() => done(true, fast), limit ? 300 : 1100); return; }   // (v206, the user: right answers move on at once, with confetti)
    sfx.wrong();
    if (waitWrong === 'quick') { setTimeout(() => done(false, 0), 700); return; }   // (v280, the user) at the finish a wrong answer only flashes the right one, then the next question
    const hint = o ? (q.why && q.why[o]) || q.cs || '' : '';
    fb.hidden = false; fb.innerHTML = `${o ? '' : '<div class="late">Time is up!</div>'}<div class="full">${q.fmt === 'word' || q.fmt === 'pic' ? `${q.it.e} <b>${q.it.w}</b>` : `<b>${q.full}</b>`}</div>${hint ? `<div class="cz">CZ: ${hint}</div>` : ''}<button class="btn small" id="qok" style="--c:var(--green);margin:10px auto 0">OK ▶</button>`;
    let gone = false; const go = () => { if (gone) return; gone = true; done(false, 0); };
    if (waitWrong === 'oneSec') { fb.querySelector('#qok').remove(); setTimeout(go, 1000); return; }   // (v302) the pit: the right answer shows for 1 s, then the next question
    // (v241, the user) a wrong answer at the finish or in the pit: you wait until this question's clock runs out
    if (o && waitWrong && limit) { fb.querySelector('#qok').outerHTML = '<div class="qwait">Wait for the clock…</div>'; waiting = go; const qt = host.querySelector('.qtime'); if (qt) qt.classList.add('wwait'); return; }
    tap(fb.querySelector('#qok'), go); setTimeout(go, limit ? (hint ? 3200 : 2200) : 4200);
  };
  if (ctl) ctl.expire = () => answer(null, null);   // (the caller can run the clock out, e.g. when the kart lands)
  for (const o of q.opts) { const bt = el('button', 'btn', o); opts.appendChild(bt); tap(bt, () => { if (!opts.classList.contains('wait')) answer(o, bt); }); }
  // (v160) answers side by side shrink together until the longest word fits its button (a phone held upright is narrow)
  if (opts.classList.contains('row')) {
    const bs = [...opts.children], over = () => bs.some((b) => b.scrollWidth > b.clientWidth + 1);
    let fs = parseFloat(getComputedStyle(bs[0]).fontSize), n = 0;
    while (n++ < 14 && fs > 13 && over()) { fs *= .92; for (const b of bs) b.style.fontSize = `${fs.toFixed(1)}px`; }
  }
  if (limit) {
    // the clock only runs while the page is visible; the last three seconds tick
    const bar = host.querySelector('.qtime i'), all = limit * 1000; let left = all, last = performance.now(), beep = 4;
    const run = () => {
      if ((answered && !waiting) || !bar.isConnected) return;
      const now = performance.now(); if (!document.hidden) left -= now - last; last = now;
      tLeft = Math.max(0, left / all);   // (v154) how quickly it was answered — the pit stop scores on it
      bar.style.width = `${Math.max(0, left / all) * 100}%`; bar.classList.toggle('low', left < 3000);
      const sec = Math.ceil(left / 1000); if (sec < beep && sec > 0) { beep = sec; sfx.tick(); }
      if (left <= 0) { if (waiting) waiting(); else answer(null, null); } else setTimeout(run, 50);
    };
    setTimeout(() => { last = performance.now(); run(); }, limit ? 200 : 350);
  }
  // test hook: FK.answer = 'right' | 'wrong' answers by itself ('hold' answers wrong and waits on the hint, 'late' lets the clock run out)
  if (window.FK.answer && window.FK.answer !== 'late') setTimeout(() => { const want = window.FK.answer === 'right' ? q.answer : q.opts.find((o) => o !== q.answer); [...opts.children].find((x) => x.textContent === want).click(); if (window.FK.answer !== 'hold') setTimeout(() => { const k = host.querySelector('#qok'); if (k) k.click(); }, 300); }, 900);
}

// flash-card quizzes (review mode): energy (5 right = +1) or coins (+5 per right answer). Due reviews come first.
tap($('coinsPlus'), () => openCoinGift());   // (v246, the user: "ask me how many coins I want and give me that, for everyone")
// the + by the coins: how many coins do you want? Pick one or type a number, and they are yours
function openCoinGift() {
  sfx.click(); const Qz = $('quiz'), MAX = 1000000; Qz.hidden = false;
  Qz.innerHTML = `<button class="btn x" id="qx">X</button><div class="cgift"><i class="coin cgcoin"></i><h2 class="out">GET COINS</h2><div class="qsub">How many coins do you want?</div>
    <div class="cgpick">${[100, 500, 1000, 5000, 10000].map((n) => `<button class="btn cgp" data-n="${n}">${n.toLocaleString('en')}</button>`).join('')}</div>
    <input id="cgIn" class="cgin" type="number" inputmode="numeric" min="1" max="${MAX}" step="1" placeholder="or type a number">
    <button class="btn cggo" id="cgGo" style="--c:var(--green)">GIVE ME <i class="coin"></i> <span id="cgN">0</span></button></div>`;
  const inp = $('cgIn'), go = $('cgGo'), close = () => { Qz.hidden = true; Qz.innerHTML = ''; refreshCounters(); };
  const val = () => Math.max(0, Math.min(MAX, Math.floor(+inp.value || 0)));
  const show = () => { $('cgN').textContent = val().toLocaleString('en'); go.classList.toggle('dim', !val()); for (const b of Qz.querySelectorAll('.cgp')) b.classList.toggle('on', +b.dataset.n === val()); };
  for (const ev of ['keydown', 'keyup']) inp.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Enter') go.click(); });
  inp.addEventListener('input', show);
  for (const b of Qz.querySelectorAll('.cgp')) tap(b, () => { sfx.click(); inp.value = b.dataset.n; show(); });
  tap($('qx'), close);
  tap(go, () => {
    const n = val(); if (!n) { inp.focus(); return; }
    save.coins = (save.coins || 0) + n; store(); refreshCounters(); sfx.coin(); toast(`${ico('coin')} +${n.toLocaleString('en')} COINS!`, '#ffe14a', 44); close();
  });
  show();
}
tap($('energyPlus'), () => { if (!TUNE.energy) return; if (save.energy >= TUNE.maxEnergy) { toast('Energy is full!', '#ffe14a'); return; } openQuiz('energy'); });
function openQuiz(mode) {
  sfx.click(); const Qz = $('quiz'), energy = mode === 'energy' && TUNE.energy; let right = 0, earned = 0;
  Qz.hidden = false;
  Qz.innerHTML = `<button class="btn x" id="qx">X</button><h2 class="out">${energy ? 'EARN ENERGY' : 'EARN COINS'}</h2><div class="qsub" id="qsub"></div><div class="prog" id="qprog"></div><div id="qhost" style="width:100%;display:flex;justify-content:center"></div>`;
  const close = () => { Qz.hidden = true; Qz.innerHTML = ''; refreshCounters(); };
  tap($('qx'), close);
  const status = () => {
    $('qsub').textContent = energy ? `Get ${TUNE.energyQuizCount} right to win +1 energy` : `+${TUNE.quizCoins} coins for every right answer · earned: ${earned}`;
    $('qprog').innerHTML = energy ? Array.from({ length: TUNE.energyQuizCount }, (_, k) => `<i class="${k < right ? 'on' : ''}">${k < right ? '+' : ''}</i>`).join('') : '';
  };
  const next = () => {
    if (Qz.hidden) return; status();
    questionCard($('qhost'), 'FLASH CARD', L.makeQuestion(L.pickReview(save.track || 'alps')), (ok) => {
      if (Qz.hidden) return;
      if (ok) { right++; if (!energy) { save.coins += TUNE.quizCoins; earned += TUNE.quizCoins; sfx.coin(); } }
      store(); refreshCounters(); status();
      if (energy && right >= TUNE.energyQuizCount) { save.energy = Math.min(TUNE.maxEnergy, save.energy + 1); store(); sfx.fanfare(); toast('+1 ENERGY!', '#ffe14a', 54); setTimeout(close, 1300); return; }
      next();
    });
  };
  next();
}

/* ---------- 7. The race ---------- */
let race = null;
const keys = {};
// speed lines: white streaks round the edge of the screen, drawn once
const speedEl = $('speed'), fireEl = $('fireGlow');
(function drawSpeedLines() {
  const c = speedEl, x = c.getContext('2d'), W = c.width, H = c.height, cx = W / 2, cy = H * .45;
  for (let k = 0; k < 90; k++) {
    const a = Math.random() * Math.PI * 2, r0 = Math.max(W, H) * rand(.42, .6), r1 = r0 + rand(160, 420), w = rand(1.5, 5);
    x.strokeStyle = `rgba(255,255,255,${rand(.35, .8).toFixed(2)})`; x.lineWidth = w; x.lineCap = 'round';
    x.beginPath(); x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); x.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); x.stroke();
  }
})();
// a tap on the screen while flying off a ramp = a trick (and a bigger boost when you land)
// (v292: the tap trick is gone — the jumps have flame rings to fly through instead)
// the keyboard (computers): W A S D or the arrows (by key position, so any keyboard layout works), SPACE = power-up,
// 1 2 3 = answer a question, ESC or P = pause
const KEYS = { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], drift: ['ShiftLeft', 'ShiftRight'] };
const kdown = (k) => KEYS[k].some((c) => keys[c]);
// holding DRIFT: the on-screen button (phones) or SHIFT (keyboard). Drifting never starts on its own any more.
const driftHeld = () => kdown('drift') || GPAD.drift;   // (v110: the DRIFT button is gone — the keyboard and the gamepad drift)
// the joystick (phone mode, phone upright): push it left or right to steer; it springs back when you let go
// one finger per control: a touch that starts on el is followed (by its identifier) until it lifts, whatever the other
// fingers do. (A second finger never makes a "click" on phones, and pointer capture can drop it, so the race controls
// use touch events; the pointer handlers below skip touch pointers and serve the mouse.)
function touchHold(el, down, move, up) {
  let id = null;
  el.addEventListener('touchstart', (e) => { e.preventDefault(); if (id !== null) return; const t = e.changedTouches[0]; id = t.identifier; down(t); }, { passive: false });
  el.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === id) move(t); }, { passive: false });
  const end = (e) => { for (const t of e.changedTouches) if (t.identifier === id) { id = null; up(); } };
  el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
}
// (v143, the user; the aiming reworked in v147) FOLLOW MY FINGER: hold a finger on the race picture and the
// kart drives to it. `x` is where the finger is across the screen, -1 left to +1 right. updateWheel turns
// that into a place across the ROAD and aims at it a little way ahead, the way the AI drivers pick a line,
// so the kart arrives, straightens up and stays there.
const FOLLOW = { x: null, held: null, dir: 0, until: 0, t0: 0 };
{
  const aim = (e) => { const b = stage.getBoundingClientRect(); FOLLOW.x = ((e.clientX - b.left) / Math.max(1, b.width)) * 2 - 1; stage.dataset.side = FOLLOW.x < 0 ? 'L' : 'R'; const d = FOLLOW.x < 0 ? -1 : 1; if (d !== FOLLOW.dir || FOLLOW.held == null) FOLLOW.t0 = performance.now(); FOLLOW.dir = d; FOLLOW.until = performance.now() + 110; };
  // A drag may start anywhere on the race picture, including the see-through HUD layers over it, but never
  // on something you can press and never on a panel. Written as a list of what to IGNORE rather than what to
  // accept, so a new overlay cannot quietly stop the steering working.
  const UI = 'button, input, select, textarea, a, label, .qcard, .opts, #quiz, #dialog, #setp, #tracks, #pad, .pill, .veil';
  const onRace = (e) => CTL === 'follow' && race && race.started && !race.ended && !race.dialog
    && !(e.target instanceof Element && e.target.closest(UI));
  stage.addEventListener('pointerdown', (e) => { if (!onRace(e)) return; FOLLOW.held = null; aim(e); FOLLOW.held = e.pointerId; Snd.init(); }, { passive: true });
  stage.addEventListener('pointermove', (e) => { if (FOLLOW.held === e.pointerId) aim(e); }, { passive: true });
  // the window, not the stage: a panel opening mid-drag must never leave the finger stuck down.
  // Only this finger ends the drag, so steering with one hand and tapping the power-up with the other works.
  const letGo = () => { FOLLOW.held = null; FOLLOW.x = null; delete stage.dataset.side; };
  for (const ev of ['pointerup', 'pointercancel'])
    addEventListener(ev, (e) => { if (FOLLOW.held === e.pointerId) letGo(); }, { passive: true });
  addEventListener('touchend', (e) => { if (!e.touches.length) letGo(); }, { passive: true });
  addEventListener('touchcancel', letGo, { passive: true });
  addEventListener('blur', letGo, { passive: true });
}
/** Let go of every on-screen control. Called whenever a card, a panel or the pause menu takes over. */
function dropTouches() { FOLLOW.held = null; FOLLOW.x = null; ARR.l = ARR.r = false; for (const id of ['arrL', 'arrR']) { const b = $(id); if (b) b.classList.remove('on'); } if (STICK.held != null) { STICK.held = null; STICK.x = 0; $('stick').classList.remove('held'); $('knob').style.transform = 'translate(-50%,-50%)'; } }
const STICK = { x: 0, held: null };
// (v263, the user) ARROWS: two big buttons, ◀ and ▶, to tap or hold — they steer like the keyboard's A and D (the
// kart drives by itself). Each button is its own touch, so one thumb can hold ◀ while the other taps the power-up.
const ARR = { l: false, r: false };
for (const [id, k] of [['arrL', 'l'], ['arrR', 'r']]) {
  const b = $(id); if (!b) continue;
  const on = () => { ARR[k] = true; b.classList.add('on'); Snd.init(); setCtl('arrows'); }, off = () => { ARR[k] = false; b.classList.remove('on'); };
  touchHold(b, on, () => {}, off);
  b.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') return; on(); try { b.setPointerCapture(e.pointerId); } catch (x) {} });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, (e) => { if (e.pointerType !== 'touch') off(); });
  b.addEventListener('contextmenu', (e) => e.preventDefault());
}
function applySide() { document.body.classList.toggle('ctl-right', save.ctlSide === 'right'); }
applySide();
{
  // (v77) a slider: a line across the pad with a dot in the middle; the knob follows the finger left or right only
  const base = $('stick'), knob = $('knob'); let cx = 0, cy = 0, R = 1;
  // (v141, the user) LESS SENSITIVE: the knob still follows the finger, but the steering it asks for is
  // progressive — half a push is about a third of the lock, so small corrections stay small.
  // (v206) a small dead zone in the middle, so a resting thumb drives straight
  // (v251, steering research: a 6 % dead zone, a gentle middle, and the FULL lock at a full push — before, the
  // joystick could only ever reach 73 % of the lock and half a push on the line gave just 12 %) with the wheel's own
  // soft middle (^1.6) a half push is now about a fifth of the lock on the line, a sixth on the joystick
  const move = (e) => { const dx = clamp(e.clientX - cx, -R, R), raw0 = dx / R, raw = Math.sign(raw0) * Math.max(0, Math.abs(raw0) - .06) / .94; STICK.x = Math.sign(raw) * Math.abs(raw) ** sensExp(CTL === 'joy' ? STEER.joyExp : STEER.lineExp);   // (v281: × the joystick sensitivity)
    const dy = CTL === 'joy' ? clamp(e.clientY - cy, -R, R) : 0, k = CTL === 'joy' ? .29 / .42 : 1;   // (the knob stays inside the ring)
    knob.style.transform = `translate(calc(-50% + ${(dx * k).toFixed(1)}px), calc(-50% + ${(dy * k).toFixed(1)}px))`; };
  const radOf = (b) => (steerWant() === 'joy' ? Math.max(40, b.width * .42) : Math.max(40, b.width / 2 - b.height / 2));
  const grab = () => { const b = base.getBoundingClientRect(); cx = b.left + b.width / 2; cy = b.top + b.height / 2; R = radOf(b); base.classList.add('held'); Snd.init(); setCtl(steerWant()); };
  const release = () => { STICK.held = null; STICK.x = 0; base.classList.remove('held', 'float'); base.style.translate = ''; knob.style.transform = 'translate(-50%,-50%)'; };
  touchHold(base, (t) => { grab(); STICK.held = 'touch'; move(t); }, move, release);
  // (v206, the user: "the joystick best for everyone, even newbies") a FLOATING joystick: put your thumb down anywhere
  // in the bottom-left part of the screen and the joystick comes to it, centred under the thumb — you never miss it
  const zone = $('joyzone');
  if (zone) touchHold(zone, (t) => { if (steerWant() !== 'joy') return; const b = base.getBoundingClientRect(), hx = b.left + b.width / 2, hy = b.top + b.height / 2;
    base.style.translate = `${(t.clientX - hx).toFixed(1)}px ${(t.clientY - hy).toFixed(1)}px`; base.classList.add('float');
    cx = t.clientX; cy = t.clientY; R = radOf(b); base.classList.add('held'); Snd.init(); setCtl('joy'); STICK.held = 'touch'; move(t); }, (t) => { if (STICK.held === 'touch') move(t); }, release);
  base.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') return; const b = base.getBoundingClientRect(); cx = b.left + b.width / 2; cy = b.top + b.height / 2; R = radOf(b); STICK.held = e.pointerId; base.classList.add('held'); Snd.init(); setCtl(steerWant()); try { base.setPointerCapture(e.pointerId); } catch (err) {} move(e); });
  base.addEventListener('pointermove', (e) => { if (STICK.held === e.pointerId) move(e); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) base.addEventListener(ev, (e) => { if (STICK.held !== e.pointerId) return; STICK.held = null; STICK.x = 0; base.classList.remove('held'); knob.style.transform = 'translate(-50%,-50%)'; });
}
const TOUCH = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
// (v138) the player picks their steering per orientation in Settings > Controls: turn the device, the round
// joystick, or the line. Tilt is only offered sideways; upright it falls back to the line.
const steerWant = () => { if (!TOUCH) return 'keys';
  const m = isPortrait() ? (save.steerP || 'follow') : (save.steerL || 'follow');
  if (m === 'tilt') return (!isPortrait() && save.tilt && tiltG !== null) ? 'tilt' : 'stick';
  return m === 'joy' ? 'joy' : m === 'follow' ? 'follow' : m === 'arrows' ? 'arrows' : 'stick'; };
let CTL = TOUCH ? 'stick' : 'keys';   // how the player steers: 'wheel' (on screen), 'tilt' (turn the phone) or 'keys'
function setCtl(c) { if (CTL === c) return; CTL = c; stage.dataset.ctl = c; }
stage.dataset.ctl = CTL;
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (Object.values(KEYS).flat().includes(e.code) || e.code === 'Space') { e.preventDefault(); setCtl('keys'); }
  if (e.code === 'Space' && race && !e.repeat) useItem();
  if ((e.code === 'Escape' || e.code === 'KeyP') && screen === 'race' && race && race.started && !race.ended && !race.dialog) pauseMenu();
  const n = '123456'.indexOf(e.key); if (n >= 0) { const o = document.querySelectorAll('#dialog .qcard .opts .btn, #quiz .qcard .opts .btn')[n]; if (o) o.click(); }
  if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !e.repeat) { const ok = document.querySelector('#dialog #qok, #dialog #resume'); if (ok) ok.click(); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
// the steering wheel: drag round it to turn (up to 110° each way); it springs back to the middle when you let go
const wheelEl = $('wheel'), wheelSvg = $('wheelSvg'), WHEEL = { rot: 0, held: null, start: 0, base: 0 };
const wheelAngle = (e) => { const b = wheelEl.getBoundingClientRect(), dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2); return { a: Math.atan2(dx, -dy) * 180 / Math.PI, d: Math.hypot(dx, dy), dx }; };
touchHold(wheelEl, (t) => { Snd.init(); const w = wheelAngle(t); WHEEL.held = 'touch'; WHEEL.start = w.a; WHEEL.base = WHEEL.rot; WHEEL.x0 = t.clientX; $('wheelHint').style.opacity = 0; setCtl('wheel'); },
  (t) => { const w = wheelAngle(t), turn = w.d > 26 ? ((w.a - WHEEL.start + 540) % 360) - 180 : (t.clientX - WHEEL.x0) * 1.4; WHEEL.rot = clamp(WHEEL.base + turn, -110, 110); if (w.d > 26) { WHEEL.start = w.a; WHEEL.base = WHEEL.rot; WHEEL.x0 = t.clientX; } },
  () => { WHEEL.held = null; });
wheelEl.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') return;
  Snd.init(); wheelEl.setPointerCapture(e.pointerId); const w = wheelAngle(e);
  WHEEL.held = e.pointerId; WHEEL.start = w.a; WHEEL.base = WHEEL.rot; WHEEL.x0 = e.clientX; $('wheelHint').style.opacity = 0; setCtl('wheel');
});
wheelEl.addEventListener('pointermove', (e) => {
  if (WHEEL.held !== e.pointerId) return; const w = wheelAngle(e);
  // round the rim it follows your finger; near the middle (where angles jump about) a sideways drag turns it instead
  const turn = w.d > 26 ? ((w.a - WHEEL.start + 540) % 360) - 180 : (e.clientX - WHEEL.x0) * 1.4;
  WHEEL.rot = clamp(WHEEL.base + turn, -110, 110);
  if (w.d > 26) { WHEEL.start = w.a; WHEEL.base = WHEEL.rot; WHEEL.x0 = e.clientX; }
});
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) wheelEl.addEventListener(ev, (e) => { if (WHEEL.held === e.pointerId) WHEEL.held = null; });
// tilt to steer (on by default on phones; switch it off in the pause menu): turn the phone like a steering wheel.
// Held sideways, that raises one end of the phone: its long axis's angle above level is exactly the β angle
// (asin(sin β) keeps it right when the phone leans past upright). Held upright, it is the left/right tilt γ.
let tiltG = null;
addEventListener('deviceorientation', (e) => {
  if (e.beta == null) return;
  const so = window.screen.orientation, o = ((so ? so.angle : window.orientation || 0) % 360 + 360) % 360;
  const lift = Math.asin(Math.sin(e.beta * Math.PI / 180)) * 180 / Math.PI;
  tiltG = o === 90 ? lift : o === 270 ? -lift : e.gamma;
});
async function enableTilt() {
  try { if (window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission) { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') return false; } return !!window.DeviceOrientationEvent; } catch (e) { return false; }
}
// (v301) the TAP SIDES tip: both halves of the race light up with a pulsing arrow (index.html #tapTip)
function tapTip(on) { const t = $('tapTip'); if (t) t.classList.toggle('on', !!on); }
function ctlHint(on) {
  const h = $('ctlHint'); if (!on) { h.style.opacity = 0; return; }
  const k = (t) => `<kbd>${t}</kbd>`; if (TOUCH && !GPAD.on) setCtl(steerWant());
  h.innerHTML = CTL === 'keys' && GPAD.on ? `Hold ${k(padName('gas'))} to drive · ${k('stick')} steer · ${k(padName('drift'))} drift · ${k(padName('item'))} power-up · ${k(padName('pause'))} pause` : CTL === 'keys' ? `Hold ${k('W')} to drive · ${k('A')} ${k('D')} steer · ${k('SHIFT')} drift · ${k('SPACE')} power-up` : CTL === 'arrows' ? 'Tap or hold ◀ ▶ to steer · the kart drives by itself' : CTL === 'tilt' ? 'Turn your phone like a wheel to steer' : CTL === 'stick' ? 'Slide the line to steer' : CTL === 'joy' ? 'Drag the joystick to steer' : CTL === 'follow' ? 'Hold the LEFT or RIGHT side of the screen to steer' : '';
  h.hidden = !h.innerHTML; h.style.opacity = 1;
}
let JOYF = null;
// (v251, the user: "research the steering through every option and adjust it for the best experience") one place
// for the feel of each control. Final steer = (wheel angle / 90°)^1.6, so the middle is soft and the ends are full:
//   line     push^1.25 → half a push ≈ 22 % of the lock, a full push = 100 %   (was ^1.7 × 86°: 12 % … 93 %)
//   joystick push^1.5 × 86° → half ≈ 15 %, full ≈ 93 %                        (was ^2 × 74°: 6 % … 73 %, too weak for hairpins)
//   (v285, the user: "at 30 % it almost doesn't turn and when you go over it, it puts you into the wall") the joystick
//   and the line are now STRAIGHT: push^.72 on the wheel × the ^1.6 soft middle = steering ≈ push^1.15, so
//   30 % of a push ≈ 21 % of the lock, half ≈ 42 %, three quarters ≈ 70 %, full = 100 % (before 3 / 15 / 44 / 93 % on
//   the joystick: nothing, nothing, then all at once), and the wheel follows the thumb quicker (rate 14 / 16, was 8 / 12)
//   gamepad  stick^1.25 → half ≈ 19 %, full 100 %                             (was ^1.5: 13 %)
//   tilt     3° dead zone, the full lock at about 31° of turn                 (was about 40°)
//   keys     90 % of the lock in about 0.3 s, quicker still when you swap sides (was 0.46 s)
//   tap sides stays as the user tuned it (v226)
const STEER = { lineExp: .72, lineMax: 90, lineRate: 16, joyExp: .72, joyMax: 72, joyRate: 14, padExp: 1.25, tiltDead: 3, tiltGain: 3.2, tiltRate: 10, keyRate: 7.5,
  outExp: 1.6, tapMin: 34, tapMax: 50, tapRate: 8 };   // (v269: the wheel → steering "soft middle" curve and TAP SIDES, here so the debug hub can tune them)
// (v281, the user: the option to change the joystick sensitivity) JOYSTICK SENSITIVITY in Settings → CONTROLS, 50–150 %
// (save.joySens 0.5…1.5, 1 = the tuned feel above). It works on the joystick, the line and a controller's stick:
// higher = a small push turns more (a straighter push curve), the full lock a little wider and the wheel follows a little
// quicker; lower = a calmer middle, a slightly smaller full lock, a little slower. 100 % changes nothing.
// (v285) on the line a full push is ALWAYS the full lock; (v288) on the joystick the full push is 55 / 70 / 86 % of the lock
// at 50 / 100 / 150 % sensitivity, and half a push ≈ 19 / 29 / 40 %
const joySens = () => clamp(+save.joySens || 1, .5, 1.5);
const sensExp = (e) => e / joySens() ** .3;   // (v288: .3, was .75 — at 50 % a 30 % push gave 4 %, dead again; the ceiling below does most of the work)
const sensMax = (m) => m * (1 + (joySens() - 1) * .2);
const sensRate = (r) => r * (.7 + .3 * joySens());
// (v288, the user: "make that the joystick at 90 degrees doesn't mean the kart turns 90 degrees") a FULL sideways push on
// the JOYSTICK is a firm turn, not the full lock: joyMax 72° on the wheel = 70 % of the lock (the full lock swung the kart
// round 90° in about half a second at race speed; now about 0.8 s). The sensitivity moves that ceiling: about 55 % at 50 %,
// 70 % at 100 %, 85 % at 150 %. (The line, the keys and a controller still reach the full lock.)
const joyWheel = () => Math.min(90, STEER.joyMax * (1 + (joySens() - 1) * .28));
function updateWheel(dt) {
  { const jf = steerWant() === 'joy'; if (jf !== JOYF) { JOYF = jf; document.body.classList.toggle('joyfloat', jf); } }
  const kb = ((kdown('left') || ARR.l) ? -1 : 0) + ((kdown('right') || ARR.r) ? 1 : 0);   // (v263: the ARROWS steer like the keys)
  // the player can change how they steer in the middle of a race: take it up at once, and let go of
  // whatever finger was on the old control rather than waiting for a touch that may never end
  if (TOUCH) { const w = GPAD.on ? 'keys' : steerWant(); if (CTL !== w) { dropTouches(); setCtl(w); } }
  else if (CTL === 'stick' || CTL === 'joy' || CTL === 'follow' || CTL === 'arrows') setCtl('keys');
  // (v212, the user: "instead of follow the finger: hold the left side to go left, the right side to go right, with no
  // borders") TAP SIDES: a finger on the left half of the screen turns the wheel left, on the right half right — the
  // full lock, easing in, like the keys; no lane, no road-edge limit; let go and it straightens
  // (v219, the user: "less sensitive, and a tap or a hold turns the same way") the turn is about 60 % of the lock and
  // reaches it almost at once, so a tap and a hold start alike; a short tap still steers for at least 0.25 s
  if (CTL === 'follow' && (FOLLOW.x != null || performance.now() < FOLLOW.until) && race && race.started && !race.ended && !kb) {
    // (v226, the user: "still too reactive, too sensitive, and it has a delay") a calmer turn that starts at once:
    // the wheel snaps to a gentle 34° the moment you press (no easing in), a hold past ~0.4 s slowly opens it to 50°
    // for the hairpins, and letting go straightens it straight away (no 0.25 s tail); the steering assist stays out of it
    const dir = FOLLOW.x != null ? (FOLLOW.x < 0 ? -1 : 1) : FOLLOW.dir, hT = (performance.now() - FOLLOW.t0) / 1000;
    const tgt = dir * (STEER.tapMin + (STEER.tapMax - STEER.tapMin) * clamp((hT - .4) / .8, 0, 1));
    WHEEL.rot = WHEEL.rot * dir < STEER.tapMin - 4 ? dir * (STEER.tapMin - 4) : WHEEL.rot + (tgt - WHEEL.rot) * Math.min(1, dt * STEER.tapRate);
  }
  else if (STICK.held != null && !kb) { const joy = CTL === 'joy'; WHEEL.rot += (STICK.x * (joy ? joyWheel() : STEER.lineMax) - WHEEL.rot) * Math.min(1, dt * sensRate(joy ? STEER.joyRate : STEER.lineRate)); }
  else
  // (gentle since v40: a full turn needs the phone tilted about 40°, and the keys turn the wheel in more slowly)
  if (CTL === 'tilt' && WHEEL.held == null && !kb) { const t = Math.abs(tiltG) < STEER.tiltDead ? 0 : tiltG - Math.sign(tiltG) * STEER.tiltDead; WHEEL.rot += (clamp(t * STEER.tiltGain, -110, 110) - WHEEL.rot) * Math.min(1, dt * STEER.tiltRate); }
  // (v64: the stick is progressive — a half push is about a third of the wheel — and turns the wheel a little slower, so small corrections stay small)
  else if (GPAD.on && Math.abs(GPAD.steer) > .02 && !kb) WHEEL.rot += (Math.sign(GPAD.steer) * Math.abs(GPAD.steer) ** sensExp(STEER.padExp) * sensMax(90) - WHEEL.rot) * Math.min(1, dt * sensRate(9));
  else if (kb) WHEEL.rot += (kb * 95 - WHEEL.rot) * Math.min(1, dt * (WHEEL.rot * kb < 0 ? STEER.keyRate * 1.6 : STEER.keyRate));   // (a quicker swing when you switch sides)
  else if (WHEEL.held == null) WHEEL.rot *= Math.exp(-dt * (CTL === 'follow' ? 18 : 9));
  wheelSvg.style.transform = `rotate(${WHEEL.rot.toFixed(1)}deg)`;
  // a soft middle: small turns of the wheel steer only a little, a full turn still steers fully
  const s = clamp(WHEEL.rot / 90, -1, 1); return Math.sign(s) * Math.abs(s) ** STEER.outExp;
}
tap($('slot'), () => useItem());
$('slot').addEventListener('touchstart', (e) => { e.preventDefault(); Snd.init(); useItem(); }, { passive: false });
tap($('pauseB'), () => pauseMenu());

/* ---------- a gamepad (PS5 DualSense, Xbox, any "standard" pad) ----------
   Left stick or D-pad = steer, R2 (or X) = gas, L2 = brake, L1 / R1 (or Circle) = drift, Square = power-up,
   X at the lights = rocket start, Options = pause.
   In the menus and on question cards the D-pad (or the stick) moves a yellow highlight from button to button and
   X presses it; Circle presses Back / OK / Resume. The pad is polled every frame (there are no button events). */
const GPAD = { on: false, steer: 0, gas: false, brake: false, drift: false, prev: [], focus: null, moveT: 0, kind: 'pad', gp: null };
// (v223, the user: "make it work fully on an Xbox controller, like on the PlayStation") which pad it is, for the button names
const padKind = (id) => (/xbox|045e|xinput|microsoft/i.test(id || '') ? 'xbox' : /054c|dualsense|dualshock|playstation|wireless controller/i.test(id || '') ? 'ps' : 'pad');
const PAD_NAMES = {
  xbox: { gas: 'RT', gas2: 'A', brake: 'LT', drift: 'LB / RB', item: 'X', trick: 'Y', pause: 'Menu', ok: 'A', back: 'B' },
  ps: { gas: 'R2', gas2: '✕', brake: 'L2', drift: 'L1 / R1', item: '□', trick: '△', pause: 'Options', ok: '✕', back: '○' },
};
PAD_NAMES.pad = PAD_NAMES.xbox;
const padName = (k) => PAD_NAMES[GPAD.kind][k];
addEventListener('gamepadconnected', (e) => { const k = padKind(e.gamepad.id); toast(`${k === 'xbox' ? 'Xbox controller' : k === 'ps' ? 'PlayStation controller' : (e.gamepad.id || 'Controller').replace(/\(.*$/, '').trim().slice(0, 28) || 'Controller'} connected`, '#7af8ff', 26, 'tip'); });
const padVisible = (el, lax = false) => {
  if (el.disabled || el.hidden || el.closest('[hidden]')) return false;
  const r = el.getBoundingClientRect(); if (r.width < 6 || r.height < 6) return false;
  if (lax) { const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.pointerEvents !== 'none' && +cs.opacity > .05; }   // (scrolled out of view inside its panel: still reachable)
  if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
  const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.pointerEvents === 'none' || +cs.opacity < .05) return false;
  const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2); return hit === el || el.contains(hit);   // (not under a veil or another panel)
};
// the buttons the pad can reach now: a question / pause dialog on top of everything, then the review quiz, then the screen
const scrollBox = (el) => { for (let p = el && el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 4) return p; } return null; };
function padButtons(deep = false) {
  const D = $('dialog'), Q = $('quiz'); const root = !D.hidden && D.firstChild ? D : Q && !Q.hidden ? Q : document, all = [...root.querySelectorAll('button')], vis = all.filter((e) => padVisible(e));
  // a scrolling panel: its buttons below the fold count too (the highlight scrolls to them) — the panel the highlight sits
  // in every frame, and when moving (deep) every scrolling panel on the screen, so the stick can walk into one from outside
  const box = GPAD.focus && scrollBox(GPAD.focus);
  const boxes = box ? [box] : deep ? [...root.querySelectorAll('div, section')].filter((e) => { const o = getComputedStyle(e).overflowY; return (o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 4; }) : [];
  for (const bx of boxes) for (const e of all) if (!vis.includes(e) && bx.contains(e) && padVisible(e, true)) vis.push(e);
  return vis;
}
function setPadFocus(el) { if (GPAD.focus === el) return; if (GPAD.focus) GPAD.focus.classList.remove('padf'); GPAD.focus = el; if (el) { el.classList.add('padf'); try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {} } }
function padMove(dir) {
  const list = padButtons(true); if (!list.length) return;
  const cur = GPAD.focus && list.includes(GPAD.focus) ? GPAD.focus : null; if (!cur) { setPadFocus(list[0]); return; }
  const c = cur.getBoundingClientRect(), cx = (c.left + c.right) / 2, cy = (c.top + c.bottom) / 2; let best = null, bd = 1e9;
  for (const el of list) {
    if (el === cur) continue; const r = el.getBoundingClientRect(), x = (r.left + r.right) / 2 - cx, y = (r.top + r.bottom) / 2 - cy;
    const along = dir === 'left' ? -x : dir === 'right' ? x : dir === 'up' ? -y : y, across = dir === 'left' || dir === 'right' ? Math.abs(y) : Math.abs(x);
    if (along < 4) continue; const d = along + across * (across < along * 1.1 ? 1.5 : 6);   // (buttons inside a cone that way first, the others only if nothing is there)
    if (d < bd) { bd = d; best = el; }
  }
  if (best) { setPadFocus(best); sfx.tick(); }
}
function pollPad(dt) {
  // (v223) the pad in use: of the connected ones, the one pressed last (a phantom or a second pad never takes over), a
  // standard-mapped one first
  let gp = null; try { for (const g of navigator.getGamepads ? navigator.getGamepads() : []) if (g && g.connected && (!gp || (g.mapping === 'standard') > (gp.mapping === 'standard') || ((g.mapping === 'standard') === (gp.mapping === 'standard') && g.timestamp > gp.timestamp))) gp = g; } catch (e) {}
  if (!gp) { if (GPAD.on) { GPAD.on = false; GPAD.steer = 0; GPAD.gas = GPAD.brake = GPAD.drift = false; GPAD.gp = null; setPadFocus(null); } return; }
  GPAD.gp = gp; const kind = padKind(gp.id); if (kind !== GPAD.kind) { GPAD.kind = kind; if (screen === 'race') ctlHint(true); }
  // an Xbox pad a browser does not map as "standard" reports its triggers as axes (−1 up … +1 pressed): read them there
  const std = gp.mapping === 'standard', trig = (i) => !std && gp.axes.length > 5 && (gp.axes[i] || -1) > 0;
  const b = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > .5)) || (i === 6 && trig(2)) || (i === 7 && trig(5)), pressed = (i) => b(i) && !GPAD.prev[i];
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, sx = Math.abs(ax) < .12 ? 0 : (ax - Math.sign(ax) * .12) / .88;
  const dx = sx + (b(14) ? -1 : 0) + (b(15) ? 1 : 0), dy = (Math.abs(ay) < .55 ? 0 : Math.sign(ay)) + (b(12) ? -1 : 0) + (b(13) ? 1 : 0);
  const active = Math.abs(dx) > .05 || dy || gp.buttons.some((x) => x.pressed);
  if (active) { if (!GPAD.on) GPAD.on = true; if (CTL !== 'keys') setCtl('keys'); }   // (the pad shows the keyboard layout: no wheel, no DRIFT button)
  GPAD.steer = clamp(dx, -1, 1); GPAD.gas = b(7) || b(0); GPAD.brake = b(6); GPAD.drift = b(4) || b(5) || b(1);
  const racing = screen === 'race' && race && race.started && !race.ended && !race.dialog;
  if (racing) {
    if (pressed(2)) useItem();
    if (pressed(9) || pressed(8)) pauseMenu();   // (Menu / Options, or View / Share)
    setPadFocus(null);
  } else {
    if (race && !race.started && race.lights && pressed(0)) { startTap = performance.now(); startTaps++; }
    if (GPAD.on) {
      const list = padButtons(); let fresh = false;
      if (list.length && !(GPAD.focus && list.includes(GPAD.focus))) { const first = list.find((x) => x.matches('.opts .btn, .gopt')) || (list.includes($('play')) ? $('play') : list[0]); setPadFocus(first); fresh = true; }   // a new screen or card: the first answer, PLAY in the lobby, else the first button
      GPAD.moveT -= dt; const dir = Math.abs(dx) > .6 ? (dx > 0 ? 'right' : 'left') : dy ? (dy > 0 ? 'down' : 'up') : null;
      if (dir && GPAD.moveT <= 0 && !fresh) { padMove(dir); GPAD.moveT = GPAD.moveT < -1 ? .34 : .22; } else if (!dir) GPAD.moveT = -9;
      if (pressed(0) && GPAD.focus && list.includes(GPAD.focus)) GPAD.focus.click();
      // B / Circle: back, close or OK — whatever this screen's way out is (v223: every panel's close, the garage's BACK)
      if (pressed(1)) { const bk = list.find((x) => x.id === 'qok' || x.id === 'resume' || x.id === 'trkBack') || list.find((x) => x.matches('#sClose, #passBack, .fclose, .fpk-x, #back, [aria-label=Close]')) || list.find((x) => /^(‹\s*)?back$|^ok ▶$|^close$/i.test(x.textContent.trim())); if (bk) bk.click(); else if (screen === 'garage' && $('setp').hidden && $('pass').hidden) { sfx.click(); goMenu(); } }
      if (pressed(9) && race && race.dialog === true) { const rs = $('resume'); if (rs) rs.click(); }
    }
  }
  GPAD.prev = gp.buttons.map((x, i) => x.pressed || x.value > .5 || (i === 6 && trig(2)) || (i === 7 && trig(5)));
}

const FLAME_GEO = new THREE.ConeGeometry(.12, .7, 10).rotateX(-Math.PI / 2), WARM_GEO = new THREE.ConeGeometry(.1, .3, 6), TRAP_GEO = new THREE.CylinderGeometry(1.25, 1.25, .06, 20);
// free what one race made for itself (name tags)
function freeRacers(list) { for (const r of list) { WORLD.scene.remove(r.model.root); if (r.model.wing) { r.model.wing.removeFromParent(); wingDispose(r.model.wing, new Set()); r.model.wing = null; r.model.wingLv = 0; }   /* (v270) */ if (r.model.ups) { r.model.ups.removeFromParent(); r.model.ups = null; } if (r.label) { r.label.material.map.dispose(); r.label.material.dispose(); } } }
// (v266) a race needs the models that load behind the menu: on a slow device a quick start waits for them under a small notice
function startRace(trackId, opts) {
  if (!BASE.later || BASE.laterDone) return startRaceNow(trackId, opts);
  if (BASE.raceWait) return; BASE.raceWait = true;
  const n = document.createElement('div'); n.className = 'mapwait'; n.innerHTML = '<i></i><b>Loading the map\u2026</b>'; document.body.appendChild(n);
  Promise.race([BASE.later, wait(10000)]).then(() => { n.remove(); BASE.raceWait = false; startRaceNow(trackId, opts); });   // (v277: never waits for ever)
}
function startRaceNow(trackId = save.track || 'alps', opts = {}) {
  if (!TRACK_DEFS[trackId]) trackId = 'alps';   // (v168: a save may still name Japan)
  hidePodium();
  if (TDEF && TDEF.id !== trackId) { miniBase = null; }
  loadPitCrew(trackId);   // (v177) this map's crew outfit, while the race sets up
  if (race) { freeRacers(race.racers); for (const p of race.projectiles) WORLD.scene.remove(p.m); for (const t of race.traps) WORLD.scene.remove(t.m); race = null; }
  useTrack(trackId); save.track = trackId; store(); TUNE_NOW = TUNES[TDEF.music];
  Snd.init(); screen = 'race'; showOnly('hud'); $('tracks').hidden = true; $('toasts').innerHTML = ''; WHEEL.rot = 0; WHEEL.held = null; $('wheelHint').style.opacity = 1; ctlHint(true); tapTip(false);
  const me = charById(save.char), others = CHARACTERS.filter((c) => c !== me);
  const inParty = !!(party && party.members.length > 1);
  let order = opts.tut ? [me] : inParty ? party.members.map((m) => (m.me ? me : { remote: m.id, name: m.name, ch: charById(m.char) || me, skin: m.skin })) : [others[0], others[1], me, others[2], others[3]];
  if (!opts.tut && !inParty && window.FK.rivals != null) order = order.filter((c) => c === me || others.indexOf(c) < window.FK.rivals);   // (v269) the debug hub: fewer rivals
  if (race) { for (const r of race.racers) WORLD.scene.remove(r.model.root); for (const p of race.projectiles) WORLD.scene.remove(p.m); }
  Music.stop();
  for (const b of WORLD.boxes) { b.on = true; b.m.visible = true; b.m.scale.setScalar(1); }
  if (WORLD.gridBoxGrp) { WORLD.gridBoxGrp.removeFromParent(); WORLD.gridBoxGrp = null; }
  if (WORLD.garagePaint) for (const d of WORLD.garagePaint.doors || []) d.mesh.position.y = 1.75;   // (v199) every roller door down again   // (v199) a grid box left over from an earlier race on this map
  puddlesShown(true);   // (v188) a race left during its formation lap must not leave the puddles away
  race = { slow: 1, slowTarget: 1, started: false, ended: false, raceTime: 0, item: null, rolling: false, dialog: null, steer: 0, projectiles: [], aiShotT: rand(22, 32), camA: 0, finishT: 0, shake: 0, coinsGot: 0, tips: {},
    learn: { asked: [], askedAt: {}, queue: [], practised: [], fixed: new Set(), missed: new Set(), gates: [], pitTime: 0, pits: 0 }, traps: [] };
  if (TRACK.routes) {   // (v196) Star Loop: one variant per lap, drawn at random, never the same one twice in a race
    const pool = TRACK.routes.map((_, k) => k); for (let k = pool.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [pool[k], pool[j]] = [pool[j], pool[k]]; }
    race.routeSeq = pool.slice(0, Math.min(pool.length, TUNE.laps)); TRACK.pts = TRACK.routes[0]; if (WORLD) WORLD.routeShown = -1;
  }
  stage.classList.remove('blur');
  if (WORLD.fgates) { for (const fg of WORLD.fgates) fg.g.visible = false; WORLD.gates = []; }
  for (const g of WORLD.gates) { g.armed = false; g.done = false; g.asked = false; g.block.visible = false; g.panels.forEach((pn) => setPanel(pn, '?')); } $('gp').hidden = true;
  for (const c of WORLD.coins) { c.on = true; c.m.visible = true; }
  race.party = inParty; if (inParty) party.remote = {};
  race.racers = order.map((slot, i) => {
    const rem = slot.remote ? slot : null, ch = rem ? rem.ch : slot;
    const player = slot === me, { s, lat } = gridSpot(i), p = at(s, lat), pY = p.y;
    const model = makeRacerModel(ch, player ? save.kart.color : ch.color, player ? save.kart.sticker : ch.sticker || 'none', player, rem ? rem.skin : null, !!TDEF.ship); WORLD.scene.add(model.root);
    if (player) setTyre({ model }, 1, false);   // (v274) every race starts on level-1 tyres (the garage's tyre is for the menu)
    const r = { ch, player, model, x: p.x, z: p.z, angle: angleOf(p.p), speed: 0, idx: Math.round(s / STEP) % TRACK.N, s, lap: 0, dist: 0, steerVis: 0,
      spinT: 0, spinA: 0, slideT: 0, boostT: 0, boostMul: 1, shield: 0, shieldT: 0, iceCd: 0, finished: false, finishTime: 0, bounceT: 0,
      bayDs: PITS ? PITS.bays[i] : null, wantPit: false, pitting: false, pitHoldT: 0, pitStood: false, inPit: false, laneSide: 0,   // (v152) the pit lane
      y: pY, vy: 0, air: null, rampY: 0, drift: 0, driftT: 0, driftLvl: 0, driftYaw: 0, coins: 0, trick: false, trickT: 0, squash: 0, lat: 0, sc: s,
      lane: rand(-2.6, 2.6), phase: Math.random() * 6, skill: player ? 1 : TUNE.aiSkill[Math.max(0, others.indexOf(ch))] || 1, remote: rem ? rem.remote : null };
    if (!player) { r.label = nameSprite(rem ? rem.name : ch.name, ch.color); r.label.position.y = 2.15; model.root.add(r.label); }
    r.bubble = makeShield(); r.bubble.position.y = .7; r.bubble.visible = false; model.root.add(r.bubble);
    r.flame = new THREE.Mesh(FLAME_GEO, WORLD.flameMat); r.flame.position.set(-.25, .42, -1.25); r.flame.visible = false; model.body.add(r.flame);
    if (TDEF.magnet) { r.beam = new THREE.Mesh(BEAM_GEO, WORLD.beamMat || (WORLD.beamMat = new THREE.MeshBasicMaterial({ color: '#3a8aff', transparent: true, opacity: .62, depthWrite: false, side: THREE.DoubleSide }))); r.beam.visible = false; model.root.add(r.beam); }
    r.quizT = player || TDEF.pitOnly || !TUNE.finQuiz ? 0 : rand(7.5, 14) / (r.skill || 1);   // (how long this rival takes over the three finish questions; none on a pit-only track)
    if (TDEF.pitStart && PITS && !inParty && !opts.tut) { toBay(r, i); toGarage(r); }   // (v199: the rivals too, each in its own garage)   // (v170) in its own garage bay (v195: yours, inside the garage)
    return r;
  });
  race.player = race.racers.find((r) => r.player); race.camA = race.player.angle;
  if (opts.tut) tutPrep();   // (v172) the test drive's coach
  paintGarages();   // (v159) each pit garage in its racer's colour
  // compile every shader the race can need now (during the fly-round), so nothing compiles mid-race
  { const tmp = new THREE.Group(); tmp.add(WORLD.rocket.clone(), WORLD.snowball.clone(), new THREE.Mesh(WORLD.shieldGeo, WORLD.shieldMat), new THREE.Mesh(WARM_GEO, WORLD.flameMat)); tmp.position.set(race.player.x, race.player.y - 50, race.player.z); WORLD.scene.add(tmp);
    try { renderer.compile(WORLD.scene, WORLD.camera); } catch (e) {} WORLD.scene.remove(tmp); }
  { const R1 = race; preloadTyres().then(() => { if (race === R1 && !race.started) tyreWarm(race.player); }); }   // (v274) the nine tyre levels, ready before the questions
  // teach a few new words during the fly-round (picture + word + Czech + voice); the pit stops then ask them first
  race.newWords = DEV() ? [] : L.newWords(TDEF.words || TDEF.id, 3); race.learn.queue.push(...race.newWords.map((w) => w.id));
  race.introLen = race.newWords.length ? INTRO + 1.8 : INTRO; race.introT = race.introLen; placeAll(0); snapCamera();
  { const nw = $('newW'); if (race.newWords.length) { nw.innerHTML = `<h4>NEW WORDS</h4><div>${race.newWords.map((w) => `<span><i>${w.e}</i><b>${w.w}</b><small>${w.cs}</small></span>`).join('')}</div>`; nw.hidden = false; L.prefetch(race.newWords.map((w) => w.w)); setTimeout(() => L.say(race.newWords.map((w) => `${w.w}.`)), 700); } else nw.hidden = true; }
  drawSlot(); buildMinimap(); lapPill(); drawPitHud();
  countdown();
  window.FK.race = race; if (window.FK.onRace) window.FK.onRace(race);   // (v269) the debug hub
}
// (v170) the grid: two by two behind the line
const gridSpot = (i) => ({ s: TRACK.L - 2.4 - Math.floor(i / 2) * 4.5 - (i % 2) * 1.8, lat: [-2.8, 2.8, 0, -2.8, 2.8, 0][i] || 0 });
function resetRacer(r, x, y, z, angle, s) {
  Object.assign(r, { x, y, z, angle, s, sc: s, idx: Math.round(s / STEP) % TRACK.N, speed: 0, vy: 0, air: null, lap: 0, drift: 0, driftT: 0, driftLvl: 0, driftYaw: 0, spinT: 0, spinA: 0, slideT: 0, boostT: 0, boostMul: 1,
    coins: 0, rampY: 0, trick: false, pitting: false, wantPit: false, pitHoldT: 0, pitStood: false, inPit: false, laneSide: 0, finished: false });
  project(r); r.lap = 0;
}
// a racer standing in its garage bay in the pit lane, facing down the lane
function toBay(r, i) {
  const ds = PITS.bays[i] ?? PITS.bays[PITS.me], q = pitPt(ds, PITS.bayU), s = ((ds % TRACK.L) + TRACK.L) % TRACK.L;
  resetRacer(r, q[0], q[1], q[2], angleOf(tp(pitIdxOf(ds))), s); r.bayDs = ds;
}
/* (v195, the user) the race starts INSIDE your garage, on every map: your kart stands in it, nose to the pit lane, while
   the crew gets it ready (the camera looks in from the lane); then it rolls out, turns and stops on your box, and the
   formation lap starts from there. The kart is frozen in the garage (the race has not started), so the pit-lane walls
   never pull at it. */
const GARAGE_IN = 4.2;
const GARAGE_CAM = { side: 1.5, back: 3.4, h: 1.45 };   // (v241) the close garage camera: metres to the side, back from the kart, high   // metres from the garage's front edge to where the kart stands inside
function garagePose(r) {
  const ds = r.bayDs ?? PITS.bays[PITS.me], e = pitEdges(ds), q = pitPt(ds, e[1] + 1 + GARAGE_IN), t = tp(pitIdxOf(ds)), sd = PITS.side;
  return { x: q[0], y: q[1], z: q[2], a: Math.atan2(-t.nx * sd, t.nz * sd), ds };
}
function toGarage(r) {
  const g = garagePose(r); r.x = g.x; r.y = g.y; r.z = g.z; r.angle = g.a; r.speed = 0; r.inGarage = true;
  if (!r.player) return;   // (v199, the user: everyone starts inside their own garage; the camera is yours)
  // the camera: out in the pit lane, a little to the side, looking in through the open door at the kart
  const e = pitEdges(g.ds), c = pitPt(g.ds - 1.6, e[0] + .4, 2.3);   // (across the lane, at the pit wall, straight in through the door)
  // (v241, the user: "more close up to your kart") the camera stands just inside the door, low, a little to the side;
  // when the kart rolls out it glides back to the pit wall (far)
  const n = pitPt(g.ds - GARAGE_CAM.side, e[1] + 1 + GARAGE_IN - GARAGE_CAM.back, GARAGE_CAM.h);
  race.garageCam = { cx: n[0], cy: n[1], cz: n[2], lx: g.x, ly: g.y + .55, lz: g.z, near: n, far: c };
}
// out of the garage: a smooth curve from inside it, through the lane, onto the box, turning to face down the lane
// (v199) a rival's roller door: up before it rolls out, down again once it has gone
function rollDoor(r, up, ms = 650) {
  const GP = WORLD && WORLD.garagePaint, bi = PITS ? PITS.bays.indexOf(r.bayDs) : -1, d = GP && (GP.doors || []).find((x) => x.bay === bi); if (!d) return;
  const y0 = d.mesh.position.y, y1 = up ? 1.75 + 3.3 : 1.75, t0 = performance.now(), R0 = race;
  const step = () => { if (race !== R0 && up) return; const k = Math.min(1, (performance.now() - t0) / ms), e = k * k * (3 - 2 * k); d.mesh.position.y = y0 + (y1 - y0) * e; if (k < 1) requestAnimationFrame(step); };
  step();
}
function driveOutOfGarage(r, done, cam = true) {
  const g = garagePose(r), ds = g.ds, e = pitEdges(ds), mid = (e[0] + e[1]) / 2, P0 = [g.x, g.z], q1 = pitPt(ds - 3.2, mid + .6), q2 = pitPt(ds, PITS.bayU);
  const a2 = angleOf(tp(pitIdxOf(ds))), R0 = race, T = 2100, t0 = performance.now(); Snd.engineOn && Snd.engineOn();
  const step = () => {
    if (race !== R0) return; const k = Math.min(1, (performance.now() - t0) / T), u = k * k * (3 - 2 * k), v = 1 - u;
    const x = v * v * P0[0] + 2 * v * u * q1[0] + u * u * q2[0], z = v * v * P0[1] + 2 * v * u * q1[2] + u * u * q2[2];
    const dx = 2 * v * (q1[0] - P0[0]) + 2 * u * (q2[0] - q1[0]), dz = 2 * v * (q1[2] - P0[1]) + 2 * u * (q2[2] - q1[2]);
    r.x = x; r.z = z; r.y = g.y + (q2[1] - g.y) * u; if (Math.hypot(dx, dz) > 1e-4) r.angle = k < 1 ? Math.atan2(dx, -dz) : a2;
    if (cam && race.garageCam) { const G = race.garageCam; G.lx = x; G.ly = r.y + .55 + .15 * u; G.lz = z; if (G.near) { const w = Math.min(1, k * 1.6), ww = w * w * (3 - 2 * w); G.cx = G.near[0] + (G.far[0] - G.near[0]) * ww; G.cy = G.near[1] + (G.far[1] - G.near[1]) * ww; G.cz = G.near[2] + (G.far[2] - G.near[2]) * ww; } }
    if (k < 1) { requestAnimationFrame(step); return; }
    r.inGarage = false; if (cam) race.garageCam = null; toBay(r, PITS.bays.indexOf(ds) >= 0 ? PITS.bays.indexOf(ds) : PITS.me); done();
  };
  step();
}
// (v241, the user) the result clock: race time, but while YOU answer the finish questions it runs in real time, so a
// rival who crosses the line meanwhile answers its three questions on the same clock (doneR = when it is through).
// Whoever is through the questions first is ahead; once you are through, nobody can pass you any more.
const resClock = () => race.raceTime + (race.afterT || 0) + (race.resOff || 0);
const doneAt = (r) => (r.player && race.finQuiz ? resClock() : r.doneR);
const total = (r) => (r.finished ? (r.doneR != null ? 2e9 - doneAt(r) : 1e9 - r.finishTime - (r.quizT || 0)) : r.lap * TRACK.L + r.s);   // (finished: lap time + the finish questions)
const ranking = () => race.racers.slice().sort((a, b) => total(b) - total(a));

const INTRO = 2.8;   // seconds of camera fly-round before the lights
// the rocket start: tap the screen just as the lights turn green (within 0.45 s before GO) for a boost off the line
let startTap = 0, startTaps = 0;
stage.addEventListener('pointerdown', () => { if (race && !race.started && race.lights) { startTap = performance.now(); startTaps++; } }, true);
function rocketStart(R0) {
  const P = R0.player, d = performance.now() - startTap;
  if (d < 450 && startTaps <= 2) { giveBoost(P, 1.1, 1.45); sfx.turbo(2); toast('ROCKET START!', '#ff8a1e', 40); }
  else if (startTaps > 2) toast('Too many taps!\nTap once at GO!', '#ffb0b8', 26);   // one well-timed tap, not tapping all the time
  else if (save.races < 4 && !R0.tips.rocket && !R0.tut) { R0.tips.rocket = 1;   // (v284: not in the test drive, where the coach talks — on small phones it covered the kart)
    setTimeout(() => { if (race === R0) toast('Tip: tap the screen\nat GO! for a rocket start', '#fff', 22); }, 3500); }
}
// (v170) the garage stop before the race: the crew comes out and works while you answer four of each
function garageStop(R0, stayIn = false) {
  return new Promise((res) => {
    const P = race.player; race.dialog = 'pitstop'; race.pitHold = true;
    const go = () => {
    toast(`IN THE GARAGE!\n<small>get the kart ready: ${TUNE.garageN} question${TUNE.garageN === 1 ? '' : 's'} in each</small>`, '#ffe14a', 34); L.say('Get your kart ready!');
    crewStart(); drawPitHud();   // (v199: no pit box at the garage start)
    setWing(P, 0, false);   // (v270) the kart starts bare; (v271) each right SPEED answer bolts on the next rear wing
    setTyre(P, 1, false); tyreWarm(P);   // (v274) and level-1 tyres; each right REPLACING TYRES answer fits the next ones
    runQuiz([['fix', TUNE.garageN], ['spd', TUNE.garageN], ['imm', TUNE.garageN]], 'GARAGE', () => {
      if (race !== R0) return res();
      race.dialog = null; race.pitHold = false; race.pitPhase = 'out'; drawPitHud();
      for (const r of race.racers) if (!r.player) for (const k of ['fix', 'spd', 'imm']) pitAward(r, k, rand(55, 88));   // the rivals' crews were busy too
      if (!stayIn) for (const r of race.racers) if (!r.player && r.inGarage) { rollDoor(r, true, 550); driveOutOfGarage(r, () => setTimeout(() => rollDoor(r, false), 400), false); }   // (v199) everyone rolls out together, through their own door
      if (stayIn) return res();   // (v254) the screen goes black and everyone is put on the grid instead of rolling out
      if (P.inGarage) { toast('ROLL OUT!', '#4fc84a', 34); driveOutOfGarage(P, () => res()); } else res();   // (v195) out of the garage onto the box
    }, kitOnAns(P, R0));
    };
    Promise.race([Promise.all([loadPitCrew(TDEF.id), preloadTyres()]), wait(4000)]).then(() => { if (race === R0) go(); else res(); });
  });
}
// (v252, the user) dev mode skips the garage questions, but everyone must still roll out of the garages onto their box
// (before, the formation lap started with you parked inside, the garage camera on, and you were stuck)
function devRollOut(R0) {
  return new Promise((res) => {
    if (race !== R0) return res();
    const P = race.player; race.dialog = null; race.pitHold = false; race.pitPhase = 'out'; drawPitHud();
    for (const r of race.racers) if (!r.player && r.inGarage) { rollDoor(r, true, 550); driveOutOfGarage(r, () => setTimeout(() => rollDoor(r, false), 400), false); }
    if (P.inGarage) driveOutOfGarage(P, () => res()); else res();
  });
}
// (v170) the formation lap: everyone drives out of the pit lane and once round at a steady pace; near the line
// they are put on the grid two by two and the lights come on
// (v175) parking on the grid at the end of the formation lap. Rivals line up on their spot and stop on it; you
// drive into your glowing box (red → yellow as you come in → green when you are parked), the kart rolls to a stop
// on it. Drive past it and you are put back in it.
function gridPark(r, dt) {
  const G = r.grid; if (!G || r.parked) { if (r.parked) { r.speed = 0; } return; }
  const Lt = TRACK.L, dg = G.s - r.sc;
  if (r.lap >= 2) {   // past it (over the line again): back into the box
    const p = at(G.s, G.lat); resetRacer(r, p.x, p.y, p.z, angleOf(p.p), G.s); r.lap = 1; r.parked = true; if (r.player) { race.gridHold = true; gridBoxState('done'); toast('Back to your box!', '#ffe14a', 28); } return;
  }
  if (r.lap < 1 || r.sc < Lt * .6 || dg > 110) return;
  if (r.player) {
    if (race.gridBox && dg < 30) gridBoxState('work');
    if (dg < 16 && Math.abs(r.lat - G.lat) < 2.6) { race.steerTo = G.lat; race.gridBrake = true; }
  } else r.gridAim = G.lat;
  if (dg < .45) { r.parked = true; r.speed = 0; settleInBox(r, G.s, G.lat); if (r.player) { race.gridHold = true; race.gridBrake = false; race.steerTo = null; gridBoxState('done'); sfx.power(); toast('IN YOUR BOX!\n<small>wait for the others…</small>', '#4fc84a', 30); L.say('Good! Wait for the others.'); } }
}
// (v189, the user) whoever stops in a holographic box (the grid box, the pit box) ends in its exact middle, square to the
// road: a short glide from where the kart came to rest
function settleInBox(r, s, lat, done) {
  const L = TRACK.L, q = at(((s % L) + L) % L, lat), a1 = angleOf(q.p), x0 = r.x, z0 = r.z, y0 = r.y, a0 = r.angle, R0 = race, t0 = performance.now(), T = 320;
  const step = () => {
    if (race !== R0) return; const k = Math.min(1, (performance.now() - t0) / T), e = k * k * (3 - 2 * k);
    r.x = x0 + (q.x - x0) * e; r.z = z0 + (q.z - z0) * e; r.y = y0 + (q.y - y0) * e; r.angle = a0 + wrapA(a1 - a0) * e; r.speed = 0; project(r);
    if (k < 1) requestAnimationFrame(step); else if (done) done();
  };
  step();
}
const pitBayAt = () => { const B = WORLD.pitBay; return B && { s: B.s != null ? B.s : B.ds, lat: B.u != null ? B.u * PITS.side : B.lat }; };
function gridBoxState(st) {
  const B = race.gridBox; if (!B || B.st === st) return; B.st = st;
  for (const m of B.mats) m.color.set(PIT_BOX_COL[st === 'done' ? 'done' : st === 'work' ? 'work' : 'wait']);
  if (st === 'done') { const P = race.player; pitConfetti(P.x, P.y + .3, P.z); }
}
// (v254, the user) from the garage straight to the grid: the screen fades to black, every kart is put on its grid spot
// (the crew and the garage camera are put away), and the picture fades back in behind your kart, ready for the lights
async function blackoutToGrid(R0) {
  const P = race.player; let B = $('blackout');
  if (!B) { B = document.createElement('div'); B.id = 'blackout'; stage.appendChild(B); }
  B.classList.add('on'); await wait(520); if (race !== R0) { B.classList.remove('on'); return; }
  closeDialog(); Music.duck(false); Music.stop();
  race.dialog = null; race.pitHold = false; race.pitPhase = null; race.quizK = null; race.garageCam = null; race.formation = false; race.started = false;
  if (WORLD.crew) WORLD.crew.on = false;
  for (const r of race.racers) { r.inGarage = false; r.parked = false; r.gridAim = null; r.grid = null; }
  race.raceTime = 0; race.coinsGot = 0; race.item = null; race.pitDue = false; drawSlot();
  for (const b of WORLD.boxes) { b.on = true; b.m.visible = true; b.m.scale.setScalar(1); }
  puddlesShown(true); formGatesOn(false);
  race.racers.forEach((r, i) => { const { s, lat } = gridSpot(i), p = at(s, lat); resetRacer(r, p.x, p.y, p.z, angleOf(p.p), s); });
  race.camA = P.angle; placeAll(0); snapCamera(); lapPill(); drawPitHud();
  race.gridHold = false; race.gridBrake = false; race.steerTo = null; Snd.engineOn && Snd.engineOn();
  await wait(250); B.classList.remove('on'); await wait(450);
  if (race !== R0) return;
  toast('ON THE GRID!', '#ffe14a', 40); await wait(900);
}
async function formationLap(R0) {
  const P = race.player; race.formation = true; race.started = true; race.slowTarget = 1;
  // (v181, the user) no power-ups and no traps on the formation lap: the ? boxes are put away until the race
  race.item = null; drawSlot(); for (const b of WORLD.boxes) b.m.visible = false; puddlesShown(false);   // (v188, the user) and no puddles
  for (const t of race.traps) WORLD.scene.remove(t.m); race.traps.length = 0; for (const q of race.projectiles) WORLD.scene.remove(q.m); race.projectiles.length = 0;
  for (const r of race.racers) if (!r.player) { r.pitting = true; r.pitStood = true; r.pitHoldT = 0; }   // (they drive out the way they leave a pit stop)
  formGatesOn(true);
  toast('FORMATION LAP\n<small>drive through the right pictures!</small>', '#ffe14a', 34); L.say('Formation lap! Drive through the right pictures!'); Snd.engineOn(); Music.tempo = .9; Music.start();
  // (v175, the user) you drive the whole lap and park in your box on the grid; the rivals park in theirs
  race.racers.forEach((r, i) => { const sp = gridSpot(i); r.grid = { s: sp.s, lat: sp.lat }; r.parked = false; });
  { const sp = P.grid, b = makePitBox(WORLD.scene, sp.s, sp.lat, 0); race.gridBox = b; WORLD.gridBoxGrp = b.grp; for (const m of b.mats) m.color.set(PIT_BOX_COL.wait); }
  const t0 = performance.now();
  while (race === R0 && !race.racers.every((r) => r.parked) && performance.now() - t0 < 240000) await wait(100);
  if (race === R0 && race.gridBox) await wait(700);
  if (R0.gridBox) { R0.gridBox.grp.removeFromParent(); R0.gridBox = null; }   // (v199: also when the race was left on the formation lap)
  if (race !== R0) return;
  const fg = race.fg || { right: 0, n: 0 }; formGatesOn(false); if (fg.n) { toast(`GATES: ${fg.right} OF ${fg.n}\n<small>+${fg.right * 3} coins</small>`, '#4fc84a', 34); refreshCounters(); }
  Music.stop(); race.formation = false; race.started = false; race.raceTime = 0; race.coinsGot = 0; race.item = null; race.pitDue = false; drawSlot();
  for (const b of WORLD.boxes) { b.on = true; b.m.visible = true; b.m.scale.setScalar(1); }   // (v181) the ? boxes come back for the race
  puddlesShown(true);   // (v188) and the puddles
  race.racers.forEach((r, i) => { const { s, lat } = gridSpot(i), p = at(s, lat); resetRacer(r, p.x, p.y, p.z, angleOf(p.p), s); });
  race.camA = P.angle; placeAll(0); snapCamera(); lapPill(); drawPitHud();
  for (const r of race.racers) { r.parked = false; r.gridAim = null; r.grid = null; } race.gridHold = false; race.gridBrake = false; race.steerTo = null;
  toast('ON THE GRID!', '#ffe14a', 40); await wait(900);
}
async function countdown() {
  const c = $('count'), R0 = race, L = $('lights');
  toast(`${TDEF.name.toUpperCase()}\n<small>English ${TDEF.level} · ${TUNE.laps} laps</small>`, '#ffe14a', 40);
  // the countdown follows the game clock, not the wall clock: a pause (or a slow phone) can't start the race mid fly-round
  const raceWait = async (ms) => { let left = ms; while (left > 0 && race === R0) { const t = performance.now(); await wait(Math.min(left, 60)); if (!race.dialog && !document.hidden) left -= performance.now() - t; } };
  while (race === R0 && (race.introT > 0 || race.dialog)) await wait(50);
  if (race !== R0) return; $('newW').hidden = true;
  // (v170) the Alps: a pit stop in your garage before the race (4 + 4 + 4, the crew working), then a formation lap
  if (TDEF.pitStart && PITS && !race.party && !race.tut) {
    // (v254, the user) no formation lap any more: answer the garage questions, the screen goes black, and you are on the grid
    if (!QDEV() && !window.FK.skipGarage) await garageStop(R0, true);   // (v269: the debug hub can skip it)
    else if (QDEV()) { setWing(race.player, 3, false); setTyre(race.player, 4, false); }   // (v271) dev mode = the start's three SPEED answers right: wing 3 (the pit stops add the rest) (v274: and three TYRES answers: tyre level 4)
    if (race !== R0) return;
    await blackoutToGrid(R0);
    if (race !== R0) return;
  }
  // (v151) the warm-up: six swift questions before the lights, three SPEED and three IMMUNITY, same prizes as the pit
  else if (!DEV() && !race.party && !race.tut) {
    race.dialog = 'pitstop'; toast('WARM-UP!\n<small>speed and shields</small>', '#ffe14a', 34);
    await new Promise((res) => runQuiz([['spd', 3], ['imm', 3]], 'WARM-UP', () => { race.dialog = null; res(); }));
    if (race !== R0) return;
  }
  if (race.party && party && party.startAt) { while (race === R0 && Date.now() < party.startAt - 2300) await wait(30); if (race !== R0) return; }
  L.hidden = false; L.className = ''; [...L.children].forEach((x) => (x.className = '')); race.lights = true; startTaps = 0; startTap = 0;
  // three red lights come on one by one, then all turn green: GO!
  for (const s of ['3', '2', '1', 'GO!']) {
    await raceWait(s === '3' ? 700 : 800); if (race !== R0) return;
    if (s === 'GO!') { [...L.children].forEach((x) => (x.className = 'green')); L.className = 'go'; setTimeout(() => (L.hidden = true), 1100); }
    else L.children[3 - +s].className = 'red';
    c.textContent = s; c.className = 'out' + (s === 'GO!' ? ' go' : ''); void c.offsetWidth; c.classList.add('show');
    if (s === 'GO!') { sfx.go(); race.started = true; Snd.engineOn(); rocketStart(R0); Music.tempo = 1; Music.start(); setTimeout(() => { $('wheelHint').style.opacity = 0; ctlHint(false); }, CTL === 'keys' ? 7000 : 4000); if (save.races < 3) setTimeout(() => { if (race === R0) toast('Drive into the ? boxes!', '#fff', 26); }, 1500); } else sfx.beep();
  }
}

function giveBoost(r, t, mul) { r.boostMul = r.boostT > 0 ? Math.max(r.boostMul, mul) : mul; r.boostT = Math.max(r.boostT, t); }
function startDrift(r, dir) {
  r.drift = dir; r.driftT = 0; r.driftLvl = 0; r.driftK = .6; r.air = 'hop'; r.vy = 3.6;
  if (r.player) { sfx.hop(); if (!race.tips.drift) { race.tips.drift = 1; toast('DRIFT! Hold it and steer the slide\nfor sparks', '#7ad8ff', 28); } }
}
function endDrift(r) {
  const lvl = r.driftLvl; r.drift = 0; r.driftT = 0; r.driftLvl = 0;
  if (lvl > 0) { giveBoost(r, TUNE.turboTime[lvl] * (r.player ? 1 + .15 * upLv('turbo') : 1), TUNE.turboMul); if (r.player) { sfx.turbo(lvl); if (lvl > 1) buzz(20); if (lvl === 3) toast('SUPER TURBO!', '#d05aff', 34); } }
}
function land(r) {
  const kind = r.air, vy0 = r.vy; r.air = null; r.vy = 0; r.magOn = false; r.squash = 1;
  if (r.player && kind === 'ramp' && race.act) race.act.dipV -= clamp(-vy0 * .3, 1.5, 4);   // (v293) the camera dips on landing
  if (r.player && race.jumpCtl && race.jumpCtl.expire) race.jumpCtl.expire();   // landed: the jump question's time is up
  if (kind !== 'ramp') { if (kind === 'drop') burst(r.x, r.y + .3, r.z, '#7af8ff', 10); return; }
  giveBoost(r, r.ringHit ? 1.0 : .3, 1.35);   // (v292: through the flame ring = the big boost the trick used to give)
  if (r.ringHit) r.fireT = 1.25;   // (v300, the user: "make the boost more visible, not more powerful") the ring boost LOOKS like fire: see FIRE_LOOK
  if (r.player) { race.shake = r.ringHit ? .6 : .35; sfx.land(); if (r.ringHit) { sfx.turbo(2); burst(r.x, r.y + .5, r.z, '#ff8a1e', 22); burst(r.x, r.y + .5, r.z, '#ffe14a', 14); } }
  burst(r.x, .3, r.z, '#ffffff', 10); r.ring = null; r.ringHit = false;
}
// (v292) flew through a flame ring: it flares, and the boost comes on landing
function ringHit(r, g) {
  r.ringHit = true; g.userData.flare = 1; g.userData.hits = (g.userData.hits || 0) + 1; if (r.player) g.userData.mine = (g.userData.mine || 0) + 1;   // (the counts: a test hook reads them)
  if (r.player) { toast('FLAME RING!\nBOOST!', '#ff9a1e', 40); sfx.trick(); buzz(30); burst(g.position.x, g.position.y, g.position.z, '#ffa21a', 16); burst(g.position.x, g.position.y, g.position.z, '#ffe14a', 8); }
}
// fell off a space road: a rescue drone puts you back on the track, a little way back
function respawn(r) {
  const i = (r.idx - 8 + TRACK.N) % TRACK.N, p = tp(i);
  Object.assign(r, { x: p.x, z: p.z, idx: i, s: i * STEP, sc: i * STEP, lat: 0, y: p.y + 3.5, vy: 0, air: 'drop', speed: 0, angle: angleOf(p), drift: 0, spinT: 0, slideT: 0, spinA: 0, boostT: 0, fireT: 0, ghostT: 1.6, rampY: 0, rescueT: 1.8 });
  if (WORLD.rescue) WORLD.rescueFor = r;
  if (r.player) { toast('Rescue drone!', '#7af8ff', 30); sfx.rescue(); race.camA = r.angle; }
}
// your kart drives itself while a pit-stop or gate question is open, and on to the arch you picked
const QDLG = new Set(['pit', 'pitstop', 'gate', 'jump', 'lap', 'finish', 'aim']), inQ = () => !!race && QDLG.has(race.dialog);
const autoDrive = () => inQ() || race.steerTo != null || !!race.pitAuto || !!race.pitLine;
function drive(r, dt) {
  if (!race.started) return;
  if (r.remote) {
    const st = party && party.remote[r.remote];
    if (st) { const o = st.obj, age = Math.min(.5, (performance.now() - st.at) / 1000), f = fwd(o.a), k = Math.min(1, dt * 9);
      r.x += (o.x + f.x * o.v * age - r.x) * k; r.z += (o.z + f.z * o.v * age - r.z) * k; r.y += (o.y - r.y) * k; r.angle += wrapA(o.a - r.angle) * k;
      r.speed = o.v; r.steerVis = o.s || 0; r.drift = o.d || 0; r.air = o.air || null; if (o.fin && !r.finished) { r.finished = true; r.finishTime = o.t; } }
    project(r); if (st) r.lap = st.obj.lap;   // (the lap comes from the state, not from crossing the line here)
    return;
  }
  project(r); if (!race.formation) gateWalls(r, dt); if (!(r.player && race.pitLine)) pitWalls(r, dt); pitGateWall(r, dt);   // (v175: the formation gates never steer you)
  if (race.formation) gridPark(r, dt);
  // (v152) in the pit lane. It latches on over the stretch where the lane has walls of its own, where
  // there is no doubt, and off again when you are back on the road — so a kart hugging the edge of the
  // track at the two mouths is never mistaken for one in the pit.
  if (!PITS || !WORLD.pitIdx || !WORLD.pitIdx[r.idx]) r.inPit = false;
  else {
    const pe = pitEdges(dsOf(r.sc)), pu = r.lat * PITS.side, pw = HALF + (TDEF.wallOut ?? .95) - KART_HALF_W;
    if (!pe) r.inPit = false;
    else if (pe[0] > pw) r.inPit = pu > pw;                       // the lane has its own walls here
    else r.inPit = r.inPit && pu > Math.max(2, pe[0] + .5);       // at a mouth: only if you were in it already
  }
  const P = race.player;
  let max = TUNE.baseSpeed * (1 + TUNE.coinSpeed * r.coins) * r.ch.spd;
  if (r.player) max *= 1 + TUNE.speedPerLevel * upLv('speed') + TUNE.pitSpeed * (r.spd || 0);   // (v151) + what the SPEED questions bought
  else {
    // AI: slightly faster than you, slower in tight bends, and they don't run away too far ahead (or fall too far behind)
    const p0 = tp(r.idx), p1 = tp(r.idx + 30), bend = Math.abs(wrapA(angleOf(p1) - angleOf(p0))), gap = total(r) - total(P);
    // gentler rivals for the youngest players (Starter level), a little gentler at A1
    // (v197, the user: "adaptable to your driving, not that slow") they get what your kart has (upgrades, SPEED answers,
    // coins) and are pulled smoothly towards you: up to 14 % slower when well ahead, up to 16 % faster when behind
    const yours = (1 + TUNE.speedPerLevel * upLv('speed') + TUNE.pitSpeed * (P.spd || 0)) * (1 + TUNE.coinSpeed * Math.max(0, (P.coins || 0) - (r.coins || 0)));
    // (v197b, a full race: after a pit stop they fell 120 m back and kept losing 65 m a lap, so the pull is stronger and
    // grows with the gap: up to +22 % within 50 m behind, up to +42 % when far behind; ahead, up to 15 % slower)
    const pull = gap > 0 ? 1 - clamp(gap / 80, 0, 1) * .15 : 1 + clamp(-gap / 50, 0, 1) * .22 + clamp((-gap - 50) / 150, 0, 1) * .2;
    max *= r.skill * yours * [.96, .99, 1][L.level()] * (1 - clamp(bend / 2.5, 0, .1)) * pull;
  }
  if (r.finished) max *= .6;
  if (race.formation) max = Math.min(max, r.player ? 25 : 23);
  if (TRACK.sec && TRACK.sec.k && inRouteSec(r)) max *= TRACK.sec.k[r.route || 0];
  r.surf = surfOf(r); if (r.surf === 'snow') max *= SNOW_SLOW;   // (v267, the user) snow: a bit slower — noticeable, not much   // (v199) a longer road variant is driven that much faster: the same time on every one   // (v190, the user: a bit faster again; v181 22 / 20, before 15 / 13)
  if (race.formation && r.parked) { max = 0; r.speed = 0; }
  else if (race.formation && r.grid && r.lap >= 1 && r.sc > TRACK.L * .6) { const dg = r.grid.s - r.sc; if (!r.player || race.gridBrake) { max = Math.min(max, Math.max(0, dg) * (r.player ? 2.6 : 1.3) + (r.player ? 0 : .4)); if (r.speed > max) r.speed = max; } }   // (rivals a touch behind, so the arches are yours to see)   // (v170) the formation lap: a steady pace for everyone
  if (r.player && race.pitDue && !race.pitAuto) max *= TUNE.pitWorn;                                        // (v151) a stop is due: the tyres are off
  // (v256, the user: "drive straight into the middle of the box, not to the side and then shift") on the way in the
  // autopilot lines up with the box early and eases off so the kart rolls to a stop right on its middle
  if (r.player && race.pitAuto && !race.dialog && r.inPit) { const left = bayAhead(r); if (left < 60) max = Math.min(max, Math.sqrt(2 * 16 * Math.max(0, left)), left * 3.4 + .4); }   // (v277: brakes late and hard, then eases onto the middle of the box)
  if (r.player && race.pitHold) { max = 0; r.speed = 0; }                                   // (v151) standing in your box while the crew works
  else if (r.player && race.pitBrake) {
    // (v151) rolling to a stop ON your box: the speed is tied to the metres left, so the kart lands on the
    // paint whether you came in flat out or crawling
    const left = bayAhead(r);
    max = Math.max(0, left > TRACK.L / 2 ? 0 : left) * 3.4;
    if (r.speed > max) r.speed = max;
  }
  if (!r.player && !r.finished && !r.remote) {
    r.aiItemT = (r.aiItemT ?? rand(10, 22)) - dt;
    if (r.aiItemT <= 0) { r.aiItemT = rand(14, 26); const behind = total(r) < total(P); if (behind && Math.random() < .7) giveBoost(r, 1.2, 1.3); else if (!behind && Math.random() < .5) { r.shield = 1; r.shieldT = 8; } }
  }
  if (r.boostT > 0) { r.boostT -= dt; max *= r.boostMul; }
  // (v152) the rivals pit too, so a stop costs nobody anything: on the pit lap they take the lane, stand
  // a few seconds in their own (unmarked) bay and rejoin after the line.
  if (PITS && !r.player && !r.remote && r.wantPit && !r.pitting && !r.finished) {
    const pds = dsOf(r.sc);
    if (pds > PITS.entry - 8 && pds < PITS.entry + 12) { r.pitting = true; r.pitStood = false; r.pitHoldT = 0; }
  }
  if (PITS && r.pitting) {
    const pds = dsOf(r.sc);
    if (r.pitHoldT > 0) { r.pitHoldT -= dt; max = 0; r.speed = Math.max(0, r.speed - 50 * dt); }
    else if (!r.pitStood && Math.abs(pds - r.bayDs) < 2.6 && r.inPit) { r.pitHoldT = rand(11, 14); r.pitStood = true; }   // (the user: as long as a quick human needs for the nine)
    if (pds > PITS.exit - 2 && pds < TRACK.L / 2) { r.pitting = false; r.wantPit = false; }
  }
  const onPath = r.inPit || r.player && ((WORLD.openSide && WORLD.openSide[r.idx] === Math.sign(r.lat) && WORLD.openLim[r.idx] < 50 && r.dist < WORLD.openLim[r.idx]) || (WORLD.secret && WORLD.secret.open && WORLD.secret.inside(r.x, r.z, 1)));   // the beach sand or the secret path count as road
  if (r.dist > HALF && !r.air && !onPath) max *= r.dist > HALF + 4.8 ? .4 : TDEF.tube ? .75 : .6;   // deep snow off the road
  if (r.shieldT > 0) { r.shieldT -= dt; if (r.shieldT <= 0) r.shield = 0; }
  let steer = 0;
  // spinning out (bazooka, snowball or ice)
  if (r.spinT > 0) { r.drift = 0; r.spinT -= dt; r.spinA += 13 * dt; r.speed *= Math.pow(.3, dt); if (r.spinT <= 0) r.spinA = 0; }
  else if (r.slideT > 0) { r.drift = 0; r.slideT -= dt; r.spinA = Math.sin(r.slideT * 14) * .7; r.speed *= Math.pow(.6, dt); if (r.slideT <= 0) r.spinA = 0; }
  else {
    if (r.player && !window.FK.auto && !autoDrive()) {
      steer = race.steer;
      const base = TUNE.turn * r.ch.turn * (1 + TUNE.handlingPerLevel * upLv('handling') + TUNE.pitFix * (r.fix || 0)) * clamp(r.speed / 9, .35, 1);   // (v151) + what the MAINTENANCE questions bought
      // drifting: HOLD the DRIFT button (or SHIFT) while turning and the kart hops into a drift; keep holding and
      // turning to charge the sparks, let go to fire the mini-turbo. Steering hard on its own never starts one.
      if (!r.drift && !r.air && driftHeld() && Math.abs(steer) > .2 && r.speed > 15) startDrift(r, Math.sign(steer));   // (.2 since v64: the progressive stick needs less to start a drift)
      if (r.drift) {
        // v64, FR Legends style: while you hold the drift, the stick sets the ANGLE of the slide — push into the bend
        // for a tight, big-angle drift, counter-steer to straighten it out, and the drift keeps going until you let go
        // (or nearly stop). The angle eases, so a flick of the stick doesn't jerk the kart. The sparks charge all along.
        const k = (clamp(steer * r.drift, -1, 1) + 1) / 2;   // 0 = full counter-steer … 1 = full lock into the bend
        r.driftK = (r.driftK === undefined ? .6 : r.driftK) + (k - r.driftK) * Math.min(1, dt * 6);
        if (!driftHeld() || r.speed < 9) endDrift(r);
        else {
          r.angle += r.drift * base * (.22 + .98 * r.driftK) * dt;
          r.driftT += dt; const lvl = TUNE.driftAfter.filter((t) => r.driftT >= t).length;
          if (lvl > r.driftLvl) { r.driftLvl = lvl; sfx.spark(lvl); }
        }
      } else r.angle += steer * base * (r.air && r.air !== 'hop' ? TUNE.airSteer : 1) * dt;   // (v287: calmer in the air)
      // (v206, the user: "in Settings under Controls, an adjustable steering assist") it lines the kart up with the
      // road and keeps it off the edges — only while you are not steering hard yourself, so it never fights you; and
      // never in a drift, in the air or in the pit lane
      { const A = [0, .35, .65, 1][save.assistLvl ?? 1] || 0;
        if (A && !r.drift && !r.air && !r.inPit && r.speed > 6) {
          const lim = (WORLD.openSide && WORLD.openSide[r.idx] === Math.sign(r.lat) ? Math.min(WORLD.openLim[r.idx], HALF + 7.5) : HALF);
          const want = angleOf(tp(r.idx + 10)) - clamp(r.lat / (lim + 1), -1, 1) * .22, d = wrapA(want - r.angle), free = CTL === 'follow' && (FOLLOW.x != null || performance.now() < FOLLOW.until) ? 0 : 1 - Math.min(1, Math.abs(steer) / .12);   // (v226) never against a tap; (v285) it lets go as soon as you steer (12 %, was 55 %: below that it pulled small turns back to the road, so a 30 % push hardly turned and a bigger one suddenly did)
          r.angle += clamp(d, -.6, .6) * A * 2.1 * free * dt;
          const edge = Math.abs(r.lat) - (lim - 1.5);
          if (edge > 0 && Math.sign(d) === -Math.sign(r.lat)) r.angle += clamp(d, -1, 1) * Math.min(1, edge / 2) * 2.6 * A * dt;
        } }
      if (false) {   // (v174, the user: the old always-on assist was removed; v206 brings it back as a setting, above)
        const edge = Math.abs(r.lat) - ((r.player && WORLD.openSide && WORLD.openSide[r.idx] === Math.sign(r.lat) ? Math.min(WORLD.openLim[r.idx], HALF + 7.5) : HALF) - 1.4);
        if (edge > 0) { const want = angleOf(tp(r.idx + 12)) - Math.sign(r.lat) * .3, d = wrapA(want - r.angle); if (Math.sign(d) !== Math.sign(steer) || Math.abs(steer) < .5) r.angle += clamp(d, -1, 1) * Math.min(1, edge / 2.5) * 2.2 * dt; }
      }
      if (kdown('down')) r.speed -= 24 * dt;
    } else {
      const aim = r.player && race.pitAuto && !race.dialog ? (r.inPit && bayAhead(r) < 60 ? bayLat() : pitLatAt(r.sc + 11)) : r.gridAim != null && race.formation ? r.gridAim : r.pitting ? pitLatAt(r.sc + 11)
        : r.player && autoDrive() ? race.steerTo ?? race.holdLat
        : (r.player ? 0 : r.lane) + Math.sin(race.raceTime * .4 + r.phase) * 1.1;
      const tgt = at(r.idx * STEP + 11, aim), want = Math.atan2(tgt.x - r.x, -(tgt.z - r.z));
      const d = wrapA(want - r.angle), turn = 4 * dt; if (!(r.player && race.pitLine && race.pitLine.a != null)) r.angle += clamp(d, -turn, turn); steer = clamp(d * 3, -1, 1);
      r.aiDrift = Math.abs(d) > .22 && r.speed > 15 ? Math.sign(d) : 0;   // AI karts slide round bends (just for show)
    }
    // on a keyboard you hold W (or ↑) to drive; on a phone the kart drives by itself
    const gas = !(r.player && CTL === 'keys' && !window.FK.auto && !autoDrive()) || kdown('up') || GPAD.gas;
    if (r.player && GPAD.brake && !autoDrive()) r.speed = Math.max(0, r.speed - 24 * dt);   // L2 on a pad: the brake
    else if (!gas) r.speed = Math.max(0, r.speed - 9 * dt);
    else if (r.speed < max) r.speed = Math.min(max, r.speed + TUNE.accel * r.ch.acc * (r.player ? 1 + .1 * upLv('accel') : 1) * dt * (r.speed < 10 ? 1.4 : 1)); else r.speed = Math.max(max, r.speed - 14 * dt);
  }
  r.steerVis += (steer - r.steerVis) * Math.min(1, dt * 10);
  // (v267, the user: "the ice will be a bit slidey") on ice your kart's direction of travel lags behind where it points,
  // so it carries outwards through a turn and you steer a little early; it grips again the moment you leave the ice
  let mv = r.angle;
  if (r.surf === 'ice' && !r.air && !r.inPit) { if (r.vAng == null) r.vAng = r.angle; r.vAng += Math.atan2(Math.sin(r.angle - r.vAng), Math.cos(r.angle - r.vAng)) * Math.min(1, dt * (r.player ? ICE_GRIP : ICE_GRIP * 2)); mv = r.vAng; }
  else if (r.vAng != null) { const d = Math.atan2(Math.sin(r.angle - r.vAng), Math.cos(r.angle - r.vAng)); if (Math.abs(d) < .01) r.vAng = null; else { r.vAng += d * Math.min(1, dt * 9); mv = r.vAng; } }
  if (r.player && r.surf !== race.surfSaid) { race.surfSaid = r.surf; if (r.surf === 'ice') toast('ICE! It is slippery', '#9fdcff', 30); else if (r.surf === 'snow') toast('SNOW! A bit slower', '#ffffff', 30); }
  const f = fwd(mv), PL = r.player && !race.pitHold && !r.air && race.pitLine;
  if (PL && (PL.a != null || dsOf(r.sc) >= PL.from)) followPitLine(r, dt); else { r.x += f.x * r.speed * dt; r.z += f.z * r.speed * dt; }
  r.x = clamp(r.x, BOUNDS.x0, BOUNDS.x1); r.z = clamp(r.z, BOUNDS.z0, BOUNDS.z1);
  // the walls (all round every track): the kart stops with its wheels against the wall face, instead of a quarter of a
  // metre inside it, and the same holds in the air, so no jump, hill or dip can put a kart through a wall
  const WALL_LAT = HALF + (TDEF.wallOut ?? .95) - KART_HALF_W;   // (v110: the Gold Mines tunnel wall stands back from the road)
  // (an opening on this side at this point — the beach stretch, a broken secret wall — moves the limit out, for the player)
  const lim = (sg) => ((r.player || r.pitting) && WORLD.openSide && WORLD.openSide[r.idx] === sg ? WORLD.openLim[r.idx] - KART_HALF_W : WALL_LAT);
  if (r.player && WORLD.secret && !WORLD.secret.open) { const S = WORLD.secret; if (r.idx >= S.i0 && r.idx <= S.i1 && Math.sign(r.lat) === S.side && Math.abs(r.lat) > WALL_LAT - .6 && r.speed > 9) openSecret(S); }   // crash through the cracked wall
  if (WORLD.walls[r.idx] && r.air && Math.abs(r.lat) > lim(Math.sign(r.lat))) { const p = tp(r.idx), sg = Math.sign(r.lat), over = Math.abs(r.lat) - lim(sg); r.x -= p.nx * sg * over; r.z -= p.nz * sg * over; r.lat = sg * lim(sg); }
  if (WORLD.walls[r.idx] && !r.air && Math.abs(r.lat) > lim(Math.sign(r.lat))) {
    const p = tp(r.idx), sg = Math.sign(r.lat), over = Math.abs(r.lat) - lim(sg);
    r.x -= p.nx * sg * over; r.z -= p.nz * sg * over; r.lat = sg * lim(sg);
    const into = wrapA(r.angle - angleOf(p)); r.angle -= into * Math.min(1, dt * 6);
    if (!r.wallT) { r.speed *= .8; if (r.player) { sfx.bump(); buzz(25); race.shake = .2; } const f = fwd(r.angle); burst(r.x + p.nx * sg * .8 + f.x, r.y + .5, r.z + p.nz * sg * .8 + f.z, '#ffe14a', 6); }
    r.wallT = .4;
  }
  if (r.wallT) r.wallT = Math.max(0, r.wallT - dt);
  if (r.gateT) r.gateT = Math.max(0, r.gateT - dt);
  // the ground: the road (plus a ramp's slope); nothing at all off the open edges of a space road
  const offEdge = TDEF.edge === 'void' && !WORLD.walls[r.idx] && Math.abs(r.lat) > HALF + 1.3;
  let h = 0;
  if (!offEdge) for (const rp of WORLD.ramps) { const d = ((r.sc - (rp.sr ? rp.sr[r.route || 0] : rp.s)) % TRACK.L + TRACK.L) % TRACK.L; if (d < RAMP_LEN && Math.abs(r.lat) < HALF + .3) { h = RAMP_H * d / RAMP_LEN; r.rampOn = rp; } }   // (v262: the ramp's distance on this kart's variant)
  const road = offEdge ? trackY(r) : rideY(r, trackY(r)), g = offEdge ? -1e9 : road + h;
  if (r.air) {
    // (in space, past the top of a jump, the magnets in the road pull the kart back down hard)
    const mag = TDEF.magnet && r.air === 'ramp' && r.vy < 0; r.vy -= TDEF.gravity * dt * (mag ? TDEF.magnet : 1); r.y += r.vy * dt;
    if (mag && !r.magOn) { r.magOn = true; if (r.player) { sfx.power(); if (!race.tips.magnet) { race.tips.magnet = 1; toast('MAGNET PULL!', '#5ab0ff', 30); } } }
    // (v292) through the flame ring? judged as the kart passes its plane: near the middle of the road, at its height
    if (r.ring) { const U = r.ring.userData, d = ((r.sc - U.s) % TRACK.L + TRACK.L) % TRACK.L; if (d < 6) { const g0 = r.ring; r.ring = null; if (Math.abs(r.lat - (U.lat || 0)) < RING_R - .45 && Math.abs(r.y + .6 - U.y) < RING_R - .35) ringHit(r, g0); else if (r.player && !race.tips.ring) { race.tips.ring = 1; toast('Line up with the\nFLAME RING before the jump!', '#ffb03a', 28); } } }
    if (r.y <= g && r.vy < 0) { r.y = g; land(r); }
    else if (r.y < road - 9) respawn(r);
  } else if (offEdge) { r.air = 'fall'; r.vy = 0; if (r.drift) r.drift = 0; if (r.player) sfx.fall(); }
  else if (h === 0 && r.rampY > RAMP_H * .6) {
    // off the top of a ramp: fly!
    r.air = 'ramp'; r.vy = 2.5 + r.speed * .22; r.rampY = 0; if (r.drift) endDrift(r);
    { const rp = r.rampOn, ms = rp && (rp.msr ? rp.msr[r.route || 0] : rp.ms); r.ring = ms && ms[2] && ms[2].userData.fl ? ms[2] : null; r.ringHit = false; }   // (v292) this jump's flame ring
    if (r.player) jumpQuestion(r);
  } else { r.y = g; r.rampY = h; }   // the wheels stay on the road over every hill (since v59 only a ramp makes a kart fly)
  // boost pads
  if (!r.air) for (const pd of WORLD.pads) { const d = ((r.sc - (pd.sr ? pd.sr[r.route || 0] : pd.s) + 2) % TRACK.L + TRACK.L) % TRACK.L; if (d < 4 && Math.abs(r.lat - pd.lat) < 1.8) { if (r.boostT < TUNE.padTime * .8 && r.player) sfx.pad(); giveBoost(r, TUNE.padTime, TUNE.padMul); } }
  // coins on the track (only you pick them up)
  if (r.player && !r.finished) for (const c of WORLD.coins) if (c.on && (r.x - c.x) ** 2 + (r.z - c.z) ** 2 < (1.4 + .8 * upLv('magnet')) ** 2 && Math.abs(r.y + .6 - c.y) < 1.6 + .5 * upLv('magnet')) {
    c.on = false; c.m.visible = false; setTimeout(() => { c.on = true; c.m.visible = true; }, 9000);
    race.coinsGot++; r.coins = Math.min(TUNE.maxCoins, r.coins + 1); sfx.coin(); puff(c.x, c.y, c.z, '#ffe14a', .8, .35, 0, 2, 0);
  }
  // ice: a spin or a slide for about a second (a shield blocks it)
  if (r.iceCd > 0) r.iceCd -= dt;
  else if (!r.air && !race.formation && !pitGhost(r) && Math.abs(r.y - trackY(r)) < .4) for (const ice of WORLD.ice) {   // (v188: none on the formation lap; v206: none while the pit autopilot drives you in)
    const dx = r.x - ice.x, dz = r.z - ice.z, c = Math.cos(-ice.rot), s = Math.sin(-ice.rot), lx = dx * c - dz * s, lz = dx * s + dz * c;
    if ((lx / ice.rx) ** 2 + (lz / ice.ry) ** 2 < 1) { r.iceCd = 1.6; hit(r, 'ice'); break; }
  }
  // question boxes (only the player opens them)
  if (r.player && window.FK.auto && race.item && !race.rolling && !race.dialog && Math.random() < dt * .5) useItem();
  if (r.player && !r.finished && !race.formation) for (const b of WORLD.boxes) if (b.on && (r.x - b.x) ** 2 + (r.z - b.z) ** 2 < 1.6 ** 2 && Math.abs(r.y + .6 - b.y) < 1.8) openBox(b);
}
function project(r) {
  const N = TRACK.N, P = TRACK.pts; let best = Infinity, bi = r.idx;
  for (let k = -20; k <= 30; k++) { const j = (r.idx + k + N) % N, d = (P[j].x - r.x) ** 2 + (P[j].z - r.z) ** 2; if (d < best) { best = d; bi = j; } }
  if (best > (HALF * 3) ** 2) for (let j = 0; j < N; j++) { const d = (P[j].x - r.x) ** 2 + (P[j].z - r.z) ** 2; if (d < best) { best = d; bi = j; } }
  const prev = r.s, p = P[bi], dx = r.x - p.x, dz = r.z - p.z; r.idx = bi; r.dist = Math.sqrt(best); r.s = bi * STEP;
  r.lat = dx * p.nx + dz * p.nz; r.sc = r.s + dx * p.tx + dz * p.tz;
  // crossing the start line forwards = a new lap (backwards takes it away again)
  if (prev > TRACK.L * .75 && r.s < TRACK.L * .25) { r.lap++; lapDone(r); }
  else if (prev < TRACK.L * .25 && r.s > TRACK.L * .75) r.lap--;
}
function lapDone(r) {
  if (r.lap > TUNE.laps && !r.finished) {
    r.finished = true; r.finishTime = race.raceTime + (race.ended ? (race.afterT || 0) + 1e-3 : 0);
    if (!race.party) { r.doneR = resClock() + (r.player ? 0 : r.quizT || 0); if (!r.player && race.player.doneR != null && !race.finQuiz) r.doneR = Math.max(r.doneR, race.player.doneR + .1); if (!r.player && race.finQuiz) toast(`${r.ch.name} is answering too!`, '#fff', 24); }   // (once you are through your questions, your place is fixed)
    if (r.player) finishLine(); return;
  }
  if (r.finished || race.ended) return;   // (v108) no lap questions once you are through the finish (the kart drives on behind the podium)
  // (v152) the rivals pit on the same lap. (v291, the user: "make the other bots go in the pit too after the 2nd and 4th")
  // it was keyed on pitStood, which the garage start sets and only a stop clears, so no rival ever pitted: now each
  // rival remembers the lap it was sent in on, so it stops once on lap 2 and once on lap 4
  if (!r.player && !r.remote && PITS && pitDueLap(r.lap) && r.pitLap !== r.lap) { r.wantPit = true; r.pitLap = r.lap; }
  if (r.player) {
    lapPill();
    // (v209, the user: "don't say every lap that the map has changed — just do it") the road changes without a word
    // (v151) every third lap you have to pit: your box lights up and stays lit until you take the stop,
    // and every lap line after that says so again
    if (pitDueLap(r.lap)) race.pitDue = true;
    if (race.pitDue) {
      drawPitHud();
      setTimeout(() => { if (race && race.pitDue && !race.ended) { toast('PIT STOP THIS LAP!\n<small>the crew will bring you in</small>', '#4fc84a', 34); L.say('Pit stop this lap!'); } }, 1700);
    }
  }
  if (r.player && r.lap > 1) {
    toast(`${ico('icon-flag')} ${r.lap === TUNE.laps ? 'FINAL LAP!' : `LAP ${r.lap}`}`, '#ffe14a', 44); sfx.power(); if (r.lap === TUNE.laps) Music.tempo = 1.12;
    const place = ranking().indexOf(r) + 1, word = ['first', 'second', 'third', 'fourth', 'fifth'][place - 1];
    if (race.dialog || DEV() || TDEF.pitOnly) { if (!race.dialog) L.say(`${r.lap === TUNE.laps ? 'Final lap' : `Lap ${r.lap}`}! You are ${word}.`); return; }   // free English: the race itself
    // the lap line asks one question (slow motion): right = 5 coins and a little boost
    race.slowTarget = .2;
    askOne('lap', r.lap === TUNE.laps ? 'FINAL LAP · QUESTION' : `LAP ${r.lap} · QUESTION`, 8 + (L.level() === 0 ? 3 : 0), (ok) => { race.slowTarget = 1; if (ok) { giveBoost(r, .8, 1.3); race.coinsGot += 5; r.coins = Math.min(TUNE.maxCoins, r.coins + 1); sfx.coin(); toast(`${ico('coin')} +5`, '#ffe14a', 34); } });
  }
}
// the falling rocks: the rings pulse; when the player crosses one, the loose boulder above drops onto the spot where
// the kart is heading (swerve or brake to dodge); a kart under it when it lands spins out
// (v143) the warning holograms: they bob and always turn to face the camera
// (v188) the track's puddles (ice, oil, goo, water) and their hologram signs: away on the formation lap, back for the race
function puddlesShown(on) {
  const W = WORLD; if (!W || !W.ice) return;
  for (const ice of W.ice) { for (const m of ice.parts || []) m.visible = on; if (ice.warn) { ice.warn.off = !on; ice.warn.sign.visible = ice.warn.beam.visible = on; } }
}
function updateWarns() {
  const W = WORLD; if (!W || !W.warns || !W.warns.length) return;
  const c = W.camera.position, t = performance.now() / 1000;
  for (const w of W.warns) {
    const s = w.sign; s.position.y = w.y + Math.sin(t * 1.8 + w.t) * .13;
    s.rotation.y = Math.atan2(c.x - s.position.x, c.z - s.position.z);
  }
}
function updateRocks(dt) {
  const W = WORLD; if (!W.rockSpots || !W.rockSpots.length) return; const P = race.player, t = performance.now() / 1000;
  for (const sp of W.rockSpots) {
    sp.ring.material.opacity = .55 + Math.sin(t * 6 + sp.t) * .3; sp.ring.scale.setScalar(1 + Math.sin(t * 6 + sp.t) * .06);
    if (!sp.armed) { sp.rearm -= dt; if (sp.rearm <= 0) { sp.armed = true; sp.loose.visible = true; sp.ring.visible = sp.fill.visible = true; } continue; }
    if (race.started && !race.ended && !P.finished && (P.x - sp.x) ** 2 + (P.z - sp.z) ** 2 < 2.3 ** 2) {
      sp.armed = false; sp.rearm = 7; sp.loose.visible = false; sp.ring.visible = sp.fill.visible = false;
      const lead = Math.min(14, P.speed * .37), p = at(P.sc + lead).p, lat = clamp(P.lat, -HALF + .8, HALF - .8);   // where the kart will be when the rock lands (it falls for about 0.37 s), kept on the road
      const m = new THREE.Mesh(W.rockGeo, W.rockMat); m.scale.setScalar(1.1); m.rotation.set(rand(0, 6), rand(0, 6), 0); W.scene.add(m);
      W.rocks.push({ m, x: p.x + p.nx * lat, z: p.z + p.nz * lat, gy: p.y, y: p.y + 6.6, vy: -9, live: true, t: 0 });
      if (P.player) { sfx.tick(); toast('LOOK OUT!', '#ff6a5a', 30); }
    }
  }
  for (const rk of W.rocks) {
    if (rk.live) {
      rk.vy -= 42 * dt; rk.y += rk.vy * dt; rk.m.position.set(rk.x, rk.y, rk.z); rk.m.rotation.x += dt * 4;
      if (rk.y <= rk.gy + .9) {
        rk.live = false; rk.y = rk.gy + .9; rk.m.position.y = rk.y; burst(rk.x, rk.gy + .6, rk.z, '#a08060', 18); sfx.boom(); race.shake = Math.max(race.shake, .4);
        for (const r of race.racers) if ((r.x - rk.x) ** 2 + (r.z - rk.z) ** 2 < 2.6 ** 2 && !r.air) { hit(r, 'rock'); if (r.player) toast('ROCKFALL!', '#ffb0a0', 36); }
      }
    } else { rk.t += dt; if (rk.t > 2.2) { rk.m.position.y -= dt * 1.2; } if (rk.t > 4) { W.scene.remove(rk.m); rk.gone = true; } }
  }
  W.rocks = W.rocks.filter((rk) => !rk.gone);
}
// (v206, the user: "in the pit we kept bumping into each other — make them ghost cars") a kart on its way into the pit,
// in the pit lane, at its box or in its garage passes through the others, and puddles leave it alone
const pitGhost = (r) => !!(r.inPit || r.pitting || r.inGarage || r.parkedPit || (r.player && race && (race.pitAuto || race.pitLine || race.pitHold || race.dialog === 'pitstop')));
function collide() {
  const rs = race.racers;
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i], b = rs[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (pitGhost(a) || pitGhost(b)) continue;
    if (d > 0 && d < 1.6) {
      const push = 1.6 - d, nx = dx / d, nz = dz / d, wa = b.ch.heavy / (a.ch.heavy + b.ch.heavy), wb = 1 - wa;   // the heavier one moves less
      a.x -= nx * push * wa; a.z -= nz * push * wa; b.x += nx * push * wb; b.z += nz * push * wb; a.speed *= 1 - .04 * wa; b.speed *= 1 - .04 * wb;
      if ((a.player || b.player) && d < 1.3 && !race.bumpCd) { sfx.bump(); race.bumpCd = .4; puff((a.x + b.x) / 2, (a.y + b.y) / 2 + .5, (a.z + b.z) / 2, '#ffffff', .6, .3); }
    }
  }
}
const SPARK = ['#ffffff', '#4fb8ff', '#ff9a1e', '#d05aff'];
const _rq = new THREE.Quaternion(), _rq2 = new THREE.Quaternion(), _rt = new THREE.Vector3(), _ry = new THREE.Vector3(0, 1, 0);
// the blue magnet beam between a jumping kart and the road (space): a cone hanging under the kart, stretched to the road
const BEAM_GEO = new THREE.CylinderGeometry(.5, 1.3, 1, 14, 1, true).translate(0, -.5, 0);
function placeAll(dt) { placeAll0(dt); playerRoute(); }   // (v194) each kart drawn on its own route, then back to yours
function placeAll0(dt) {
  const t = performance.now() / 1000;
  for (const r of race.racers) {
    const m = r.model; if (TRACK.routes) TRACK.pts = TRACK.routes[r.route || 0];   // (v194) drawn on its own route
    // a drifting kart points further into the bend than it is actually going
    const want = r.drift ? r.drift * (.14 + .48 * (r.driftK === undefined ? .6 : r.driftK)) : r.aiDrift && !r.player ? r.aiDrift * .22 : 0; r.driftYaw +=   /* (v278, the user: "it still bugs my car": the autopilot's show-slide stayed on your kart after it handed you the wheel, drawing it sideways) */ (want - r.driftYaw) * Math.min(1, dt * 8);   // (the slide angle follows the stick)
    if (r.trick) r.trickT = Math.min(1, r.trickT + dt * 2.4);
    // in a corkscrew the kart (and everything on it) is drawn in the road's rolled frame; the physics stays flat
    const ro = r.rollNow = rollAt(r.sc), tpi = tp(r.idx);
    if (ro) { const c = Math.cos(ro), sn = Math.sin(ro), ty = trackY(r), h = r.y - ty, w = r.lat * c - h * sn; m.root.position.set(r.x + tpi.nx * (w - r.lat), ty + r.lat * sn + h * c, r.z + tpi.nz * (w - r.lat)); }
    else m.root.position.set(r.x, r.y + (r.player && race.pitLift ? race.pitLift : 0), r.z);   // (v162: the jack lifts your kart in the pit)
    _rq2.setFromAxisAngle(_ry, Math.PI - (r.angle + r.spinA + r.driftYaw));
    if (ro) { _rq.setFromAxisAngle(_rt.set(tpi.tx, 0, tpi.tz), -ro); m.root.quaternion.copy(_rq).multiply(_rq2); } else m.root.quaternion.copy(_rq2);
    if (r.ghostT > 0) { r.ghostT -= dt; m.root.visible = r.ghostT <= 0 || Math.floor(r.ghostT * 12) % 2 === 0; }
    if (r.rescueT > 0 && WORLD.rescue && WORLD.rescueFor === r) {   // the drone holds the kart, then lets go and flies off
      r.rescueT -= dt; const d = WORLD.rescue, up = Math.max(0, .6 - r.rescueT) * 9; d.visible = r.rescueT > 0;
      d.position.set(r.x, (r.air === 'drop' ? r.y : trackY(r)) + 2.4 + up, r.z); d.rotation.y = Math.PI - r.angle;
      if (r.air === 'drop' && r.rescueT > .6) { r.y = Math.max(r.y - dt * 2.5, trackY(r) + .05); r.vy = 0; }
    }
    const wantPitch = r.air ? r.pitch : -Math.atan(r.endSlope !== undefined ? r.endSlope : slopeAt(r.idx) * Math.cos(wrapA(r.angle - angleOf(tp(r.idx)))));
    r.pitch = (r.pitch || 0) + (wantPitch - (r.pitch || 0)) * Math.min(1, dt * 14);
    const rough = r.dist > HALF && !r.air ? .035 : .008;
    m.body.position.y = r.air ? 0 : Math.abs(Math.sin(t * 17 + r.phase)) * rough * clamp(r.speed / 10, 0, 1);
    m.body.rotation.z = -r.steerVis * .05 * clamp(r.speed / 15, 0, 1) - r.drift * .07;
    // (a trick is a spin; in space it is a backflip)
    m.body.rotation.x = r.pitch + (r.air === 'ramp' ? clamp(-r.vy * .03, -.25, .2) : r.rampY ? -.24 : 0) + (r.trick && TDEF.magnet ? -r.trickT * Math.PI * 2 : 0);
    m.body.rotation.y = r.trick && !TDEF.magnet ? r.trickT * Math.PI * 2 : 0;
    // squash and stretch: a squish on landing that springs back
    r.squash = Math.max(0, r.squash - dt * 4); const q = Math.sin(r.squash * Math.PI) * .18 * r.squash;
    m.body.scale.set(1 + q * .6, 1 - q, 1 + q * .6);
    m.driver.rotation.z = -r.steerVis * .14 - r.drift * .1; m.driver.rotation.y = -r.steerVis * .12;
    for (const h of m.fronts) h.rotation.y = -r.steerVis * .38 + r.drift * .25;
    const sv = r.player && window.FK.holdSteer != null ? window.FK.holdSteer : r.steerVis;   // (test hook: hold the wheel at a turn)
    const turn = sv * (m.dmesh ? GRIP_A[3] : .9);   // (v209: with hands on it the wheel turns ±30°, so they can keep hold)
    if (m.steerAxis) m.steer.quaternion.setFromAxisAngle(m.steerAxis, turn); else m.steer.rotation.z = turn;
    if (m.dmesh) gripTurn(m.dmesh, turn);   // (v209) the hands go round with the wheel
    for (const s of m.spins) s.rotation.x += r.speed / (BASE.dk ? .22 : .14) * dt;   // (v5 wheels: radius about .22)
    if (m.hover) m.hover.position.y = SHIP_LIFT + Math.sin(t * 3.1 + r.idx * .01) * .035;   // (v184) the starship floats
    r.bubble.visible = !!r.shield; if (r.shield) { r.bubble.scale.setScalar(SHIELD_K * (1 + Math.sin(t * 8) * .02)); sparkShield(r.bubble, t); }
    r.flame.visible = r.boostT > 0; if (r.boostT > 0) r.flame.scale.set(1 + Math.random() * .4, 1 + Math.random() * .4, .8 + Math.random() * .9);
    // (v300) FIRE_LOOK: after the flame ring, twin exhaust flames three times as long and a fire trail; the speed is the normal ring boost
    if (r.fireT > 0) { r.fireT -= dt; const k = Math.min(1, r.fireT / .4);
      if (!r.flame2) { r.flame2 = new THREE.Mesh(FLAME_GEO, WORLD.flameMat); r.flame2.position.set(.25, .42, -1.25); r.flame.parent.add(r.flame2); }
      for (const fl of [r.flame, r.flame2]) { fl.visible = true; fl.scale.set((1.9 + Math.random() * .6) * (.5 + k * .5), (1.9 + Math.random() * .6) * (.5 + k * .5), (2.6 + Math.random() * 1.6) * (.4 + k * .6)); } }
    else if (r.flame2) r.flame2.visible = false;
    if (r.beam) { const on = !!(TDEF.magnet && r.air === 'ramp' && r.vy < 0); r.beam.visible = on; if (on) { r.beam.scale.set(1 + Math.sin(t * 30) * .08, Math.max(.5, r.y - trackY(r) + .3), 1 + Math.cos(t * 30) * .08); r.beam.position.y = .3; } }
    if (!dt || !race.started || ro) continue;   // (no puffs inside a corkscrew: they live in the flat frame)
    const f = fwd(r.angle), side = { x: -f.z, z: f.x };
    // exhaust, boost flames
    if (Math.random() < dt * (r.fireT > 0 ? 70 : r.boostT > 0 ? 40 : 8)) {
      if (r.boostT > 0) puff(r.x - f.x * 1.25 - side.x * .25, r.y + .45, r.z - f.z * 1.25 - side.z * .25, pick(['#ff8a1e', '#ffd23a', '#ff5a10']), .55, .35);
      if (r.fireT > 0) for (const sx of [-.3, .3]) puff(r.x - f.x * (1.4 + Math.random() * .6) + side.x * sx, r.y + .4 + Math.random() * .25, r.z - f.z * (1.4 + Math.random() * .6) + side.z * sx, pick(['#ff7a12', '#ffd23a', '#ff4a0a', '#fff2a0']), rand(.7, 1.05), .5, rand(-.6, .6), rand(.6, 1.8), rand(-.6, .6));
      else puff(r.x - f.x * 1.1 - side.x * .25, r.y + .5, r.z - f.z * 1.1 - side.z * .25, '#c8ccd8', .3, .5);
    }
    // drift sparks from both back wheels: white, then blue, orange and purple as the turbo charges
    if (r.drift && !r.air && Math.random() < dt * 60) {
      const c = SPARK[r.driftLvl], sx = pick([-.62, .62]);
      puff(r.x - f.x * .7 + side.x * sx, r.y + .15, r.z - f.z * .7 + side.z * sx, c, r.driftLvl ? .32 : .5, .25, rand(-2, 2) - f.x * 3, rand(1.5, 3.5), rand(-2, 2) - f.z * 3);
    }
    if (TDEF.edge === 'snow' && r.dist > HALF && !r.air && r.speed > 5 && Math.random() < dt * 25) puff(r.x - f.x * .9 + rand(-.6, .6), r.y + .2, r.z - f.z * .9 + rand(-.6, .6), '#ffffff', .7, .5, rand(-1, 1), 1.5, rand(-1, 1));
  }
}
// a short buzz on phones that can (Android; iPhones ignore it)
const buzz = (ms) => { try {
  if (save.buzz === false) return;
  if (GPAD.on && GPAD.gp && GPAD.gp.vibrationActuator) { const d = Array.isArray(ms) ? ms.reduce((a, x) => a + x, 0) : ms; GPAD.gp.vibrationActuator.playEffect('dual-rumble', { duration: Math.min(400, d * 1.4), strongMagnitude: .5, weakMagnitude: .8 }).catch(() => {}); return; }   // (v223) the controller rumbles
  if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch (e) {} };
function burst(x, y, z, color, n = 14) { for (let k = 0; k < n; k++) puff(x, y, z, color, rand(.4, .8), rand(.4, .7), rand(-4, 4), rand(1, 4), rand(-4, 4)); }
// something hits a racer: ice, a rocket or a snowball. A shield blocks one hit.
function hit(r, what, strong = true) {
  if (r.player && inQ()) return;
  // (v151) IMMUNITY: a shield from the pit stop takes the puddle for you (one shield, one puddle)
  if (what === 'ice' && r.imm > 0) {
    r.imm--; burst(r.x, r.y + .9, r.z, '#59d8ff', 14);
    if (r.player) { sfx.shield(); toast(`IMMUNE!  ${r.imm} left`, '#59d8ff', 30); drawPitHud(); }
    return;
  }
  if (r.shield) { r.shield = 0; r.shieldT = 0; burst(r.x, r.y + 1, r.z, '#7ad8ff', 16); if (r.player) { sfx.shield(); toast('Shield saved you!', '#7ad8ff'); } return; }
  if (what === 'ice') {
    const k = r.player ? Math.max(.45, 1 - .06 * upLv('handling') - .13 * upLv('grip')) : 1;
    if (Math.random() < .5) r.spinT = 1.0 * k; else r.slideT = 1.0 * k;
    burst(r.x, r.y + .3, r.z, { ice: '#d8f4ff', oil: '#5a3a8a', goo: '#ff5db1', water: '#9ae0ff', mud: '#6a4a24', rocks: '#8a6a4a' }[TDEF.hazard], 8);
    if (r.player && !race.ended) { sfx.spin(); buzz(50); toast({ ice: 'Whoa, ice!', oil: 'Oops, oil!', goo: 'Eww, space goo!', water: 'Splash!', mud: 'Mud!', rocks: 'Rockfall!' }[TDEF.hazard], { ice: '#a8e4ff', oil: '#c8a8ff', goo: '#ff9ae0', water: '#9ae0ff', mud: '#d8b070', rocks: '#ffb0a0' }[TDEF.hazard]); }
  } else { r.spinT = strong ? 2 : 1.2; burst(r.x, r.y + 1, r.z, what === 'snowball' ? '#ffffff' : '#ff8a1e', 22); sfx.boom(); if (r.player) { race.shake = .5; buzz([60, 40, 90]); } }
  if (r.coins) { r.coins = Math.max(0, r.coins - 2); burst(r.x, r.y + 1.2, r.z, '#ffe14a', 6); }
}

/* --- ? boxes are pit stops: the race freezes for everyone and asks 2 questions (only when your item slot is empty) --- */
// which power-up you get depends on your place (the leader mostly gets shields, the back of the pack boosts and bazookas);
// how many answers you got right decides whether it is strong or weak.
// odds of [boost, shield, bazooka, trap] by place: the leader gets shields and traps, the back of the pack boosts and bazookas
const ITEM_ODDS = [[.25, .45, .05, .25], [.35, .25, .2, .2], [.4, .2, .3, .1], [.45, .12, .38, .05], [.5, .1, .4, 0]];
const ITEMS = ['boost', 'shield', 'bazooka', 'trap'];
function itemForPlace(place) { const o = ITEM_ODDS[clamp(place, 1, 5) - 1]; let r = Math.random(); for (let i = 0; i < 4; i++) { if (r < o[i]) return ITEMS[i]; r -= o[i]; } return 'boost'; }
// one question in slow motion (a jump, the lap line, the finish): the kart drives itself along its line meanwhile
function askOne(kind, title, secs, onDone, ctl = null) {
  const P = race.player, lr = race.learn, D = $('dialog'), it = L.pickPit(TDEF.words || TDEF.id, 1, lr)[0]; lr.asked.push(it.id); lr.askedAt[it.id] = lr.asked.length;
  race.dialog = kind; Music.duck(true); if (P.drift) endDrift(P); race.holdLat = clamp(P.lat, -HALF + 1.8, HALF - 1.8);
  D.hidden = false; D.innerHTML = '<div class="veil pit"></div>';
  questionCard(D.firstChild, title, L.makeQuestion(it), (ok) => { closeDialog(); race.dialog = null; Music.duck(false); onDone(ok); }, secs, ctl, kind === 'finish' ? 'quick' : false);
}
// every jump asks a question: the flight runs in slow motion and the clock IS the flight — you have until you land.
// Right: a boost and 3 coins on landing. (The flight time is estimated from the launch speed; in space the magnets
// shorten the way down.)
function jumpQuestion(P) {
  if (race.dialog || race.ended || !race.started || DEV() || TDEF.pitOnly || race.formation) return;
  const g = TDEF.gravity, up = P.vy / g, down = TDEF.magnet ? up / Math.sqrt(TDEF.magnet) : up, flight = (up + down) * .95, slow = .1;
  race.slowTarget = slow; const ctl = {}; race.jumpCtl = ctl; sfx.power();
  askOne('jump', `${ico('icon-jump', 'tico')} JUMP QUESTION!`, flight / slow, (ok) => {
    race.jumpCtl = null; race.slowTarget = 1;
    if (ok) { giveBoost(P, 1.2, 1.4); race.coinsGot += 3; P.coins = Math.min(TUNE.maxCoins, P.coins + 1); sfx.coin(); toast(`${ico('coin')} +3 ${ico('icon-boost')} BOOST!`, '#ffe14a', 34); }
  }, ctl);
}
// the finish line keeps asking until you have THREE right (v280; slow motion, the rivals race on): your place is your lap time PLUS the seconds
// you needed for them, so a rival who crosses the line a second after you can still win by answering faster. The
// rivals' answering times are rolled when the race is set up (quizT).
function finishLine() {
  const P = race.player;
  if (QDEV() || !TUNE.finQuiz) { P.quizT = 0; finish(); return; }   // (v302) no finish questions: the order you cross the line in is the result   // (v183, the user) the 3 finish questions are back on every map, right after the line
  race.slowTarget = .2; race.finQuiz = !race.party; const c0 = resClock(), t0 = performance.now(); let right = 0;
  toast(`${ico('icon-flag')} FINISH!\nGET 3 RIGHT!`, '#ffe14a', 44); sfx.fanfare();
  const next = () => {
    if (right >= TUNE.finN) { if (race.finQuiz) { P.doneR = resClock(); P.quizT = P.doneR - c0; race.finQuiz = false; } else P.quizT = (performance.now() - t0) / 1000; P.quizRight = right; race.slowTarget = 1; finish(); return; }
    askOne('finish', `${ico('icon-flag', 'tico')} FINISH · ${right} OF ${TUNE.finN} RIGHT`, TUNE.finSecs + (L.level() === 0 ? 3 : 0), (ok) => { if (ok) right++; next(); });
  };
  next();
}
// the item roulette: the slot (bottom right) grows, flicks through the power-ups, slows down, lands on one and shines
function rollItem(type, strong) {
  const R0 = race, slot = $('slot'); race.rolling = true; slot.classList.add('full', 'rolling'); slot.classList.remove('reveal');
  let k = 0; const spin = () => {
    if (race !== R0) return;
    if (k < 14) { $('slotIcon').innerHTML = ico(itemIcon(ITEMS[k % 4]), 'slotimg'); sfx.tick(); k++; setTimeout(spin, 50 + k * 9); return; }
    race.rolling = false; race.item = { type, strong }; drawSlot(); slot.classList.remove('rolling'); slot.classList.add('reveal'); setTimeout(() => slot.classList.remove('reveal'), 1600);
    const name = { boost: 'BOOST', shield: 'SHIELD', bazooka: 'BAZOOKA', trap: 'TRAP' }[type];
    toast(`${ico(itemIcon(type))} ${strong ? 'STRONG' : 'WEAK'} ${name}!`, strong ? '#ffe14a' : '#fff', strong ? 44 : 34); sfx.fanfare(); L.say(`${strong ? 'Strong' : 'Weak'} ${name.toLowerCase()}!`);
  };
  spin();
}
function openBox(b) {
  b.on = false; b.m.visible = false; for (let k = 0; k < 8; k++) puff(b.x, b.y, b.z, pick(['#b47cff', '#ffe14a', '#7af8ff']), rand(.18, .32), rand(.3, .5), rand(-3, 3), rand(1, 3), rand(-3, 3));   // a small sparkle, not a cloud
  setTimeout(() => { b.on = true; b.m.visible = true; b.m.scale.setScalar(.1); }, 4500);
  if (race.dialog || race.ended) return;
  const P = race.player;
  // at most ~3 pit stops a lap (research R3): for 10 s after a stop, a box just gives a coin
  if (race.raceTime < (race.nextPitAt || 0)) { race.coinsGot++; P.coins = Math.min(TUNE.maxCoins, P.coins + 1); sfx.coin(); return; }
  // no question at the boxes (dev mode, or TUNE.boxQuestions off): a power-up, strong in dev mode or by luck (or a coin if the slot is full)
  if (DEV() || !TUNE.boxQuestions) {
    if (race.item || race.rolling) { race.coinsGot++; P.coins = Math.min(TUNE.maxCoins, P.coins + 1); sfx.coin(); return; }
    sfx.power(); race.nextPitAt = race.raceTime + 6; rollItem(itemForPlace(ranking().indexOf(P) + 1), DEV() || Math.random() < .45); return;
  }
  // one item at a time: with an item already in the slot, a box asks just ONE quick question (+5 coins if right)
  const quick = !!(race.item || race.rolling);
  // the race goes on in slow motion while you answer: your kart steers itself along its line, nothing can hit it
  sfx.power(); race.slowTarget = .2; race.dialog = 'pit'; race.pitT0 = performance.now(); Music.duck(true);
  if (P.drift) endDrift(P); race.holdLat = clamp(P.lat, -HALF + 1.8, HALF - 1.8);
  const lr = race.learn, items = L.pickPit(TDEF.words || TDEF.id, quick ? 1 : 2, lr); let right = 0, n = 0;
  const D = $('dialog');
  const ask = () => {
    const it = items[n]; lr.asked.push(it.id); lr.askedAt[it.id] = lr.asked.length;
    D.hidden = false; D.innerHTML = '<div class="veil pit"></div>';
    const q = L.makeQuestion(it), secs = ({ pic: 6, word: 6, gap: 9, reply: 10 }[q.fmt] || 8) + (L.level() === 0 ? 3 : 0);
    questionCard(D.firstChild, quick ? 'QUICK QUESTION · +5 COINS' : `PIT STOP · ${n + 1} OF 2`, q, (ok) => { if (ok) right++; n++; if (n < items.length) ask(); else { closeDialog(); reward(); } }, secs, null, true);
  };
  const reward = () => {
    race.dialog = null; store(); lr.pitTime += (performance.now() - race.pitT0) / 1000; lr.pits++; race.nextPitAt = race.raceTime + 10; Music.duck(false);
    if (quick) { race.slowTarget = 1; if (right) { race.coinsGot += 5; P.coins = Math.min(TUNE.maxCoins, P.coins + 1); sfx.coin(); toast(`${ico('coin')} +5`, '#ffe14a', 34); } return; }
    if (right === 0) { toast('No power-up this time.\nYou can do it next time!', '#ffb0b8', 28); race.slowTarget = 1; return; }
    race.slowTarget = 1; rollItem(itemForPlace(ranking().indexOf(P) + 1), right === 2);
  };
  ask();
}
function dialog(title, html) {
  const D = $('dialog'); D.hidden = false; D.innerHTML = `<div class="veil"><div class="card"><div class="tag">${title}</div>${html}</div></div>`; return D;
}
function closeDialog() { const D = $('dialog'); D.hidden = true; D.innerHTML = ''; }

/* --- the power-up slot --- */
const ICON = { boost: 'icon-boost', shield: 'icon-shield', bazooka: 'icon-rocket' };   // (the painted icons, v65)
const itemIcon = (t) => (t === 'trap' ? `icon-trap-${{ water: 'ice', mud: 'oil', rocks: 'oil' }[TDEF.hazard] || TDEF.hazard}` : ICON[t]);
function drawSlot() {
  const it = race && race.item; $('slot').classList.toggle('full', !!it);
  $('slotIcon').innerHTML = it ? ico(itemIcon(it.type), 'slotimg') : ''; $('slotStars').innerHTML = it ? (it.strong ? ico('icon-strong', 'starimg') : '') : ''; $('slotTap').textContent = it ? 'TAP!' : '';
}
function useItem() {
  if (race && race.dialog === 'aim') { closeTargets(); return; }   // (the item button again puts the bazooka away)
  if (!race || !race.item || race.rolling || race.dialog || !race.started || race.ended || race.formation) return;
  const P = race.player, it = race.item;
  if (it.type === 'boost') { giveBoost(P, it.strong ? 2.2 : 1.2, it.strong ? 1.6 : 1.35); sfx.boost(); toast('BOOST!', '#ff8a1e', 44); }
  else if (it.type === 'shield') { P.shield = 1; P.shieldT = it.strong ? 999 : 10; sfx.shield(); toast(it.strong ? 'SHIELD ON!' : 'SHIELD (10 s)', '#7ad8ff', 40); }
  else if (it.type === 'trap') { dropTrap(P, it.strong); }
  else { pickTarget(it.strong); return; }
  race.item = null; drawSlot();
}
// trap: drop the track's hazard (an ice puddle, an oil slick, space goo) behind you; a rival who drives over it spins out
function dropTrap(P, strong) {
  const f = fwd(P.angle), x = P.x - f.x * 2.6, z = P.z - f.z * 2.6, m = new THREE.Mesh(TRAP_GEO, WORLD.trapMat);
  m.position.set(x, trackY(P) + .06, z); m.scale.set(1, 1, 1); WORLD.scene.add(m);
  race.traps.push({ m, x, z, t: strong ? 40 : 15, safe: 1.2 }); sfx.pop(); toast(strong ? 'BIG TRAP!' : 'TRAP!', '#fff', 34);
}
function updateTraps(dt) {
  for (let i = race.traps.length - 1; i >= 0; i--) {
    const tr = race.traps[i]; tr.t -= dt; tr.safe -= dt; tr.m.rotation.y += dt * .5;
    let gone = tr.t <= 0;
    if (!gone) for (const r of race.racers) { if ((r.player && tr.safe > 0) || r.air) continue; if ((r.x - tr.x) ** 2 + (r.z - tr.z) ** 2 < 1.5 ** 2) { hit(r, 'ice'); if (!r.player) toast(`${r.ch.name} hit your trap!`, '#ffe14a', 26); gone = true; break; } }
    if (gone) { WORLD.scene.remove(tr.m); race.traps.splice(i, 1); }
  }
}
// bazooka (v241, the user): everything slows right down and the faces come up in the MIDDLE of the screen, big, with
// their names and places; tap one (or press 1-4) to send the rocket, KEEP IT to save it. Your kart holds its line meanwhile.
function pickTarget(strong) {
  if (race.aimOpen) { closeTargets(); return; }   // the item button again closes it
  const P = race.player, bar = $('targets'), ranked = ranking(), others = ranked.filter((r) => !r.player), R0 = race;
  race.aimOpen = true; race.dialog = 'aim'; race.slowTarget = .1; if (P.drift) endDrift(P); race.holdLat = clamp(P.lat, -HALF + 1.8, HALF - 1.8);
  bar.hidden = false; bar.innerHTML = `<div class="tgthead">${ico('icon-rocket', 'tico')} WHO GETS THE ROCKET?</div><div class="tgtrow"></div>`; sfx.power();
  const row = bar.lastChild;
  others.forEach((r, i) => {
    const b = el('button', 'tgt hit', `<span class="face" style="${faceStyle(r.ch)}"></span><b>${ord(ranked.indexOf(r) + 1)}</b><i>${r.ch.name}</i>${CTL === 'keys' ? `<kbd>${i + 1}</kbd>` : ''}`); row.appendChild(b);
    tap(b, () => { if (!race || !race.item) return; closeTargets(); race.item = null; drawSlot(); fire(r, strong); });
  });
  const keep = el('button', 'btn tgtx hit', 'KEEP IT'); bar.appendChild(keep); tap(keep, closeTargets);
  setTimeout(() => { if (race === R0 && race.aimOpen) closeTargets(); }, 12000);   // (nobody chosen in 12 s: keep it)
  if (window.FK.auto) setTimeout(() => row.children[0] && row.children[0].click(), 300);
}
function closeTargets() {
  const bar = $('targets'); if (bar) { bar.hidden = true; bar.innerHTML = ''; }
  if (race) { if (race.dialog === 'aim') { race.dialog = null; race.slowTarget = 1; } race.aimOpen = false; }
}
addEventListener('keydown', (e) => {
  if (!race || race.dialog !== 'aim') return;
  const n = +e.key; if (n >= 1 && n <= 9) { const b = $('targets').querySelectorAll('.tgt')[n - 1]; if (b) { e.preventDefault(); b.click(); } }
  else if (e.code === 'Escape') { e.preventDefault(); closeTargets(); }
});
function fire(target, strong) {
  const P = race.player, m = WORLD.rocket.clone(); m.position.set(P.x, P.y + 1, P.z); WORLD.scene.add(m);
  race.projectiles.push({ m, x: P.x, z: P.z, y: P.y + 1, target, speed: 57, life: 6, smoke: '#dddddd', onHit: () => { hit(target, 'rocket', strong); toast(`${target.ch.name} is spinning!`, '#ffe14a', 32); } });
  sfx.rocket(); toast(`Rocket to ${target.ch.name}!`, '#fff');
}
function updateProjectiles(dt) {
  for (let i = race.projectiles.length - 1; i >= 0; i--) {
    const p = race.projectiles[i], t = p.target, dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
    p.life -= dt; const step = p.speed * dt;
    if (d < 1.2 || p.life <= 0) { if (d < 1.2) p.onHit(); WORLD.scene.remove(p.m); race.projectiles.splice(i, 1); continue; }
    p.x += dx / d * step; p.z += dz / d * step; p.y += (t.y + (d > 6 ? 1.6 : .7) - p.y) * Math.min(1, dt * 4);
    p.m.position.set(p.x, p.y, p.z); p.m.rotation.y = Math.atan2(dx, dz); if (!p.smoke) p.m.rotation.x += dt * 10;
    if (p.smoke && Math.random() < .6) puff(p.x, p.y, p.z, p.smoke, .4, .5, 0, .3, 0);
  }
}
// now and then an AI racer behind you throws a snowball (your shield blocks it)
function aiAttacks(dt) {
  if (!race.started || race.ended || race.dialog || race.formation) return;   // (v181) no snowballs on the formation lap
  race.aiShotT -= dt; if (race.aiShotT > 0) return;
  race.aiShotT = rand(20, 32);
  const P = race.player, behind = race.racers.filter((r) => !r.player && !r.finished && total(P) - total(r) > 0 && total(P) - total(r) < 54);
  if (!behind.length) return;
  const a = pick(behind), m = WORLD.snowball.clone(); m.position.set(a.x, a.y + 1, a.z); WORLD.scene.add(m);
  race.projectiles.push({ m, x: a.x, z: a.z, y: a.y + 1, target: P, speed: 37, life: 5, onHit: () => { const had = P.shield; hit(P, 'snowball', false); if (!had) toast(`${a.ch.name} hit you with a snowball!`, '#bfe0ff', 26); } });
  toast(`${a.ch.name} threw a snowball!`, '#bfe0ff', 24);
}
function pauseMenu() {
  if (!race || race.dialog || race.ended) return; race.slowTarget = 0; race.slow = 0; race.dialog = true; sfx.click(); Snd.skid(0); dropTouches();
  Music.stop();
  // (v92) the pause screen: where you are, then four big buttons
  const P = race.player, place = ranking().indexOf(P) + 1;
  const D = $('dialog'); D.hidden = false;
  D.innerHTML = `<div class="veil pveil"><div class="ppanel art"><h2 class="out">PAUSED</h2>
    <div class="pstat"><span><i>TRACK</i><b>${TDEF.name}</b></span><span><i>LAP</i><b>${Math.min(P.lap, TUNE.laps)} / ${TUNE.laps}</b></span><span><i>PLACE</i><b>${ord(place)}</b></span><span><i>COINS</i><b>${P.coins}</b></span></div>
    <div class="pbtns"><button class="pb go" id="resume"><svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>RESUME</button>
    ${race.party ? '' : '<button class="pb re" id="restart"><svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>RESTART</button>'}
    <button class="pb se" id="psets"><img src="ui/icon-gear.png?v=1" alt="">SETTINGS</button><button class="pb qu" id="quit"><svg viewBox="0 0 24 24"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 17l-5-5 5-5M5 12h11" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>QUIT RACE</button></div></div></div>`;
  if ($('restart')) tap($('restart'), () => { closeDialog(); const id = TDEF.id; endRace(); startRace(id); });
  tap($('psets'), () => { sfx.click(); openSettings('game'); });
  tap($('resume'), () => { closeDialog(); race.dialog = null; race.slowTarget = 1; if (race.started) Music.start(); });
  tap($('quit'), () => { closeDialog(); cup = null; endRace(); goMenu(); });
}
function endRace() { Music.stop(); if (!race) return; for (const p of race.projectiles) WORLD.scene.remove(p.m); for (const t of race.traps) WORLD.scene.remove(t.m); freeRacers(race.racers); race = null; Snd.engineOff(); }
function finish() {
  Snd.skid(0); race.ended = true; race.slowTarget = .35;
  const place = ranking().indexOf(race.player) + 1;
  toast(place === 1 ? 'YOU WIN!' : `${ord(place)} PLACE!`, '#ffe14a', 70); Music.stop(); L.say(place === 1 ? 'You win! You are first!' : `You are ${['first', 'second', 'third', 'fourth', 'fifth'][place - 1]}!`); sfx.fanfare(); Snd.engineOff(); race.player.drift = 0;
  if (race.party && party) { try { party.P.finish({ time: race.player.finishTime, place }); if (party.P.isHost && party.P.endRace) party.P.endRace(); } catch (e) {} }
  setTimeout(() => showResults(place), 2200);
}
const fmtTime = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const raceTimeOf = (r) => (r.finished ? fmtTime(r.doneR != null ? r.doneR : r.finishTime + (r.quizT || 0)) : '—');
// one row of the leaderboard: medal or place, face, name, time (or cup points); your own row is gold
const leaderRow = (r, i, right) => `<div class="row${r.player ? ' me' : ''}"><b class="pl">${i < 3 ? ico(`icon-medal-${i + 1}`, 'medal') : i + 1}</b><span class="face" style="${faceStyle(r.ch)}"></span><span class="nm">${r.player ? 'You' : r.ch.name}</span><i class="tm">${right}</i></div>`;
// (v209, the user: "make the round end a bit different, with a tab of what you've learned") three tabs: RACE, LEARNED, LICENCE
function resultsTab(t) {
  const R = $('results'); if (!R) return;
  for (const b of R.querySelectorAll('.rtabs button')) b.classList.toggle('on', b.dataset.t === t);
  for (const p of R.querySelectorAll('.rpage')) p.hidden = p.dataset.p !== t;
}
for (const b of document.querySelectorAll('#results .rtabs button')) tap(b, () => { sfx.click(); resultsTab(b.dataset.t); });
function showResults(place) {
  if (!race) return; resultsTab('race');
  showPodium(ranking(), raceTimeOf); setTimeout(() => { if (screen === 'podium') { $('results').hidden = false; $('results').classList.add('up'); } }, 2600);
  screen = 'podium'; $('toasts').innerHTML = ''; const order = ranking(), coins = TUNE.coinsForPlace[place - 1] + race.coinsGot;
  const open0 = TRACK_ORDER.filter(trackOpen); save.coins += coins; save.races++; if (place === 1) { save.wins++; save.winsBy = save.winsBy || {}; save.winsBy[TDEF.id] = (save.winsBy[TDEF.id] || 0) + 1; } save.best = save.best || {}; save.best[TDEF.id] = Math.min(save.best[TDEF.id] || 9, place);
  { const g = MAP_PTS[place - 1] ?? MAP_PTS[MAP_PTS.length - 1]; mapPts(); mapsOpen(); save.mapPts += g; const opened = TRACK_ORDER.filter((id) => trackOpen(id) && !open0.includes(id)); for (const id of opened) if (!save.mapsOpen.includes(id)) save.mapsOpen.push(id); race.mapGain = { g, opened }; }   // (v249) map points
  // personal best time on this track
  const myT = race.player.finishTime || race.raceTime; save.times = save.times || {}; const minT = TUNE.laps * 10; if (save.times[TDEF.id] < minT) delete save.times[TDEF.id];   // no lap is under 10 s: drop impossible times
  const newBest = myT > minT && (!save.times[TDEF.id] || myT < save.times[TDEF.id]); if (newBest) save.times[TDEF.id] = myT; store();
  showOnly('results'); $('results').hidden = true; $('results').classList.remove('up'); $('hud').hidden = true;
  $('rTitle').textContent = place === 1 ? 'YOU WIN!' : `${ord(place)} PLACE`;
  // (v278, the user: "so it fits on one screen… the ones that aren't in the top 3 in the leaderboard, the top 3 times under them in the top image")
  $('order').innerHTML = order.slice(3).map((r, i) => leaderRow(r, i + 3, raceTimeOf(r))).join('');
  $('rsub').innerHTML = `${ico('icon-timer')} ${fmtTime(myT)}${race.player.quizT ? ` + ${race.player.quizT.toFixed(0)} s for 3 questions` : ''}${newBest ? ' · <b style="color:var(--yellow)">NEW BEST!</b>' : save.times[TDEF.id] ? ` · best ${fmtTime(save.times[TDEF.id])}` : ''}<br>${TUNE.coinsForPlace[place - 1]} for ${ord(place)} place + ${race.coinsGot} from the track · Coins: ${save.coins}${TUNE.energy ? ` · Energy: ${save.energy}/${TUNE.maxEnergy}` : ""}`;
  { // the English from this race: every word practised (green = right), and the ones fixed after a mistake
    const lr = race.learn, seen = new Map(); for (const p of lr.practised) seen.set(p.id, { label: p.label, ok: (seen.get(p.id) || { ok: true }).ok && p.ok, fixed: lr.fixed.has(p.id) });
    const words = [...seen.values()], right = lr.practised.filter((p) => p.ok).length, n = lr.practised.length, pc = n ? Math.round(right / n * 100) : 0;
    const card = (w) => { const m = String(w.label).match(/^(\S*[^\sA-Za-z]\S*)\s+(.*)$/), em = m ? m[1] : '', tx = m ? m[2] : w.label, st = w.fixed ? 'fix' : w.ok ? 'ok' : 'no';
      return `<div class="wcard ${st}"><span class="wem">${em || '💬'}</span><b>${tx}</b><i>${st === 'ok' ? '✓' : st === 'fix' ? '↺' : '✗'}</i></div>`; };
    const learnt = words.filter((w) => w.ok && !w.fixed), fixed = words.filter((w) => w.fixed), again = words.filter((w) => !w.ok && !w.fixed);
    const verdict = pc >= 90 ? 'Brilliant!' : pc >= 70 ? 'Great work!' : pc >= 50 ? 'Good try!' : 'Keep practising!';
    $('rwords').innerHTML = n ? `<div class="lsum"><div class="lscore" style="--p:${pc}"><b>${right}<small>/${n}</small></b><i>right</i></div>
        <div class="lsumtx"><b>${verdict}</b><span>English ${L.LEVEL_NAMES[L.level()]} · ${words.length} word${words.length === 1 ? '' : 's'} this race${fixed.length ? ` · ${fixed.length} fixed` : ''}</span></div></div>
      ${learnt.length ? `<div class="wsec"><h4>✓ YOU KNOW THESE</h4><div class="wgrid">${learnt.slice(-12).map(card).join('')}</div></div>` : ''}
      ${fixed.length ? `<div class="wsec"><h4>↺ YOU FIXED THESE</h4><div class="wgrid">${fixed.map(card).join('')}</div></div>` : ''}
      ${again.length ? `<div class="wsec"><h4>✗ PRACTISE THESE NEXT TIME</h4><div class="wgrid">${again.map(card).join('')}</div></div>` : ''}`
      : '<div class="lsum"><div class="lsumtx"><b>No questions this race</b><span>Answer the questions in the pit and at the finish to learn new words.</span></div></div>';
    $('rwords').onclick = null;
  }
  $('again').textContent = TUNE.energy && save.energy > 0 ? 'RACE AGAIN (-1 energy)' : 'RACE AGAIN'; $('again').classList.toggle('dim', !canRace()); $('again').hidden = false;
  let bonus = 0;
  if (cup) {   // Grand Prix: points for this race, the standings, and after the 3rd race the trophy
    order.forEach((r, i) => { cup.pts[r.ch.id] = (cup.pts[r.ch.id] || 0) + CUP_PTS[i]; }); cup.i++;
    const stand = race.racers.slice().sort((a, b) => cup.pts[b.ch.id] - cup.pts[a.ch.id]), cp = stand.indexOf(race.player) + 1;
    $('order').innerHTML = stand.map((r, i) => leaderRow(r, i, `${cup.pts[r.ch.id]} pts`)).join('');
    if (cup.i < 3) { $('rTitle').innerHTML = `${place === 1 ? 'YOU WIN!' : `${ord(place)} PLACE`}<small class="cupsub">Grand Prix · race ${cup.i} of 3</small>`; $('again').textContent = 'NEXT RACE ▶'; $('again').classList.remove('dim'); }
    else {
      bonus = CUP_BONUS[cp - 1]; save.coins += bonus; if (cp === 1) save.cups = (save.cups || 0) + 1; store();
      $('rTitle').innerHTML = cp === 1 ? `${ico('icon-trophy', 'tico')} CUP WINNER!` : `${ord(cp)} IN THE CUP`; $('again').hidden = true; showPodium(stand, (r) => `${cup.pts[r.ch.id]} pts`);
      setTimeout(() => { L.say(cp === 1 ? 'You win the cup!' : `You are ${['first', 'second', 'third', 'fourth', 'fifth'][cp - 1]}!`); }, 600);
      cup = null;
    }
    if (bonus) $('rsub').innerHTML = `${TUNE.coinsForPlace[place - 1]} for ${ord(place)} place + ${race.coinsGot} from the track + ${bonus} cup bonus<br>Coins: ${save.coins}${TUNE.energy ? `  ·  Energy: ${save.energy}/${TUNE.maxEnergy}` : ''}`;
  }
  showLicenceGain(place); refreshCounters();   // (v185, the user) the driving licence replaces the Game Pass
  let k = 0; const cw = $('coinsWon'), tick = setInterval(() => { k = Math.min(coins, k + Math.ceil(coins / 20)); cw.textContent = `+${k}`; if (k >= coins) { clearInterval(tick); sfx.coin(); } }, 45);
  if (place <= 3) for (let i = 0; i < 40; i++) { const c = el('div', 'confetti'); c.style.left = rand(0, 100) + '%'; c.style.background = pick(['#ffe14a', '#ff5db1', '#4fc84a', '#3c8cf0', '#ff8a1e']); c.style.animationDuration = rand(1.8, 3.4) + 's'; c.style.animationDelay = rand(0, 1.2) + 's'; $('results').appendChild(c); setTimeout(() => c.remove(), 5000); }
}
tap($('again'), () => {
  if (cup) { $('results').querySelectorAll('.confetti').forEach((c) => c.remove()); startRace((cup.tracks || TRACK_ORDER)[cup.i]); return; }
  if (!payRace()) return;
   $('results').querySelectorAll('.confetti').forEach((c) => c.remove()); startRace(TDEF.id);
});
tap($('toMenu'), () => { sfx.click(); cup = null; $('results').querySelectorAll('.confetti').forEach((c) => c.remove()); endRace(); goMenu(); });

// the mini-map: the track drawn once, the racers as dots on top
let miniBase = null;
const mini = $('mini'), mctx = mini.getContext('2d');
function miniXY(x, z) { const w = TB.x1 - TB.x0, h = TB.z1 - TB.z0, sc = Math.min((mini.width - 24) / w, (mini.height - 24) / h); return [mini.width / 2 + (x - MID.x) * sc, mini.height / 2 + (z - MID.z) * sc]; }
function buildMinimap() {
  if (miniBase) return; miniBase = document.createElement('canvas'); miniBase.width = mini.width; miniBase.height = mini.height;
  const x = miniBase.getContext('2d'); x.lineJoin = 'round'; x.beginPath(); TRACK.pts.forEach((p, i) => { if (i % 6) return; const [a, b] = miniXY(p.x, p.z); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.closePath();
  x.strokeStyle = '#1b2a4a'; x.lineWidth = 14; x.stroke(); x.strokeStyle = '#fff'; x.lineWidth = 8; x.stroke();
}
function drawMinimap() {
  mctx.clearRect(0, 0, mini.width, mini.height); mctx.drawImage(miniBase, 0, 0);
  for (const r of race.racers.slice().sort((a) => (a.player ? 1 : -1))) { const [a, b] = miniXY(r.x, r.z); mctx.beginPath(); mctx.arc(a, b, r.player ? 9 : 7, 0, 7); mctx.fillStyle = css(r.ch.color); mctx.fill(); mctx.lineWidth = 3; mctx.strokeStyle = r.player ? '#fff' : '#1b2a4a'; mctx.stroke(); }
}

// the chase camera: behind and above the kart, looking ahead; it swings round the kart after the finish
const camTarget = new THREE.Vector3(), camLook = new THREE.Vector3(), camUp = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
// (v273) the quiz cameras: f / s / h = metres ahead / to the right / up from the kart; lf / ls / lh = the point looked at
const QUIZ_CAM = {
  fix: { f: 3.6, s: 1.5, h: 1.55, lf: 0, ls: 0, lh: .55 },          // the whole kart from the front
  spd: { f: -2.3, s: .35, h: 1.6, lf: -.8, ls: 0, lh: .62 },        // close behind and a little above, on the rear wing
  imm: { f: 1.55, s: 1.75, h: .85, lf: .2, ls: .45, lh: .3 },        // low at the front corner, on the wheels
  spdG: { f: -1.35, s: .25, h: 2.35, lf: -.75, ls: 0, lh: .5 },     // (in the garage: from above and behind, over the props at the back)
};
let QUIZ_VIEWY = .12;   // (v275) how far an upright phone's picture slides up while a quiz camera shows the kart (it was .3: the kart sat under the top bar)
function cameraGoal(out, look) {
  const P = race.player; camUp.set(0, 1, 0);
  // (v273, the user) while a quiz asks about a part, the camera shows it: MAINTENANCE the whole kart from the front,
  // SPEED a close-up from behind on the rear wing, REPLACING TYRES a low close-up on the wheels (garage start and pit stops)
  if (race.dialog === 'pitstop' && QUIZ_CAM[race.quizK] && !race.ended) {
    const C = (race.garageCam && QUIZ_CAM[race.quizK + 'G']) || QUIZ_CAM[race.quizK], f = fwd(P.angle), sx = f.z, sz = -f.x, K = WORLD.camera.aspect < 1 ? 1.5 : 1;   // (sx, sz: the kart's side; K: an upright phone stands further back)
    out.set(P.x + f.x * C.f * K + sx * C.s * K, P.y + C.h * (K > 1 ? 1.25 : 1), P.z + f.z * C.f * K + sz * C.s * K);
    look.set(P.x + f.x * C.lf + sx * C.ls, P.y + C.lh, P.z + f.z * C.lf + sz * C.ls); return;
  }
  if (race.garageCam) { const g = race.garageCam; out.set(g.cx, g.cy, g.cz); look.set(g.lx, g.ly, g.lz); return; }   // (v195) looking into your garage
  if (race.introT > 0) {   // the fly-round: from in front of the grid, swinging round to behind your kart
    const k = 1 - race.introT / race.introLen, e = k * k * (3 - 2 * k), a = race.camA + Math.PI * (1 - e) * .62, f = fwd(a), d = 16 - 11.3 * e;   // from high up at the side (above the balloons and the banner) round to behind
    out.set(P.x - f.x * d, P.y + 11 - 8.95 * e, P.z - f.z * d); look.set(P.x, P.y + .9, P.z); return;
  }
  if (race.ended) { race.finishT += 1 / 60; const a = race.camA + Math.PI + race.finishT * .5, f = fwd(a); out.set(P.x - f.x * 5.5, P.y + 2.4, P.z - f.z * 5.5); look.set(P.x, P.y + .8, P.z); return; }
  // (v143) following a finger wants more road in view: the camera lifts and pulls back, looking further down
  const fol = false;   // (v212: TAP SIDES uses the normal chase camera; the raised follow-finger camera is gone)
  const f = fwd(race.camA), boost = P.boostT > 0 ? .7 : 0, d = (fol ? 7.0 : 4.7) + boost, sh = race.shake;   // (v184: follow 6.1 -> 7.0 back)
  const ro = P.rollNow || 0;
  // (v206, the user: "on the phone upright you cannot see much — especially on the formation lap") upright, the tall
  // picture is used for road: the camera sits higher and further back and looks further ahead; on the formation lap
  // even more, so the gates and their words come into view early
  // (v279, the user: "on the space map it bugs between close up and further up shot") the tilted-road camera below uses these too: one shot, tilted or not
  const up = isPortrait() && !fol, fm = up && race.formation, dd = up ? (fm ? 3.1 : 1.9) : 0, hh = up ? (fm ? 1.9 : 1.15) : 0, la = up ? (fm ? 11 : 9) : 6;
  if (ro) {   // in a corkscrew: behind and "above" the kart in the road's rolled frame, so the road stays under you and the stars turn
    const p = tp(P.idx), K = P.model.root.position; camUp.set(-p.nx * Math.sin(ro), Math.cos(ro), -p.nz * Math.sin(ro)); race.camY = P.y;
    const ch = 2.05 + hh, lh = .95 - (up ? .35 : 0); out.set(K.x - f.x * (d + dd) + camUp.x * ch, K.y + camUp.y * ch, K.z - f.z * (d + dd) + camUp.z * ch); look.set(K.x + f.x * la + camUp.x * lh, K.y + camUp.y * lh, K.z + f.z * la + camUp.z * lh); return;
  }
  const cy = race.camY = race.camY === undefined ? P.y : race.camY + (P.y - race.camY) * (race.camK || .15);
  out.set(P.x - f.x * (d + dd) + rand(-sh, sh) * .4, cy + (fol ? 2.9 : 2.05) + hh + rand(-sh, sh) * .3, P.z - f.z * (d + dd)); look.set(P.x + f.x * la, cy + (fol ? .65 : .95) - (up ? .35 : 0), P.z + f.z * la);   // (v184: follow 4.25 -> 2.9 up, looking at .65)
  // (v293, the user: "make the PoV more action-like — when you turn or jump the camera moves a bit") in a turn the
  // camera swings a little to the outside and looks into the bend, leaning with the kart (more in a drift); off a ramp
  // it pulls back and up a touch (and lags in height, see camK), and on landing it dips and bounces once (act.dipY)
  const A = race.act; if (A) {
    const rx = -f.z, rz = f.x, sw = A.side, back = A.air * .7;
    out.x += rx * -sw * .55 - f.x * back; out.z += rz * -sw * .55 - f.z * back; out.y += A.air * .35 + A.dipY;
    look.x += rx * sw * .9; look.z += rz * sw * .9; look.y += A.dipY * .4;
    camUp.set(rx * sw * .07, 1, rz * sw * .07).normalize();
  }
}
function snapCamera() { cameraGoal(camTarget, camLook); WORLD.camera.up.copy(camUp); WORLD.camera.position.copy(camTarget); WORLD.camera.lookAt(camLook); WORLD.look = camLook.clone(); }

function updateRace(dt) {
  race.slow += (race.slowTarget - race.slow) * Math.min(1, dt / .12);
  if (race.introT > 0 && !race.dialog) race.introT = Math.max(0, race.introT - dt);
  const gdt = Math.min(dt, .05) * race.slow * (window.FK.timeScale || 1);
  if (race.started && !race.ended) race.raceTime += gdt; else if (race.ended) race.afterT = (race.afterT || 0) + gdt;
  { const now = performance.now(); if (race.finQuiz) race.resOff = (race.resOff || 0) + Math.min(.25, (now - (race.resLast || now)) / 1000) * (window.FK.timeScale || 1) - gdt; race.resLast = now; }   // (v241) your finish questions run on real (wall-clock) time   // the shown clock stops at your finish; rivals finishing later still get later times
  // a slow phone: after 5 s under 32 fps drop the shadows, and if it is still under 26 fps also draw at a lower resolution
  if (race.started && gfxOf(save) === 'default' && (+save.lowq || 0) < 2 && race.perfT !== -1) { race.perfT = (race.perfT || 0) + dt; race.perfN = (race.perfN || 0) + 1; if (race.perfT > 5) { const fps = race.perfN / race.perfT, q = +save.lowq || 0; if (q === 0 && fps < 32) { setLowQuality(1); race.perfT = race.perfN = 0; } else { if (q === 1 && fps < 26) setLowQuality(2); race.perfT = -1; } } }
  if (race.bumpCd) race.bumpCd = Math.max(0, race.bumpCd - gdt);
  race.steer = updateWheel(dt);
  for (const r of race.racers) { useRoute(r); drive(r, gdt); } playerRoute();   // (v194) each racer on its own route through the section
  updateRouteGates(); updateTrackType(Math.min(dt, .05));
  if (race.party && party && race.started) { const now = performance.now(); if (!race.sentAt || now - race.sentAt > 66) { race.sentAt = now; const P = race.player; try { party.P.sendState({ t: race.raceTime, x: +P.x.toFixed(2), y: +P.y.toFixed(2), z: +P.z.toFixed(2), a: +P.angle.toFixed(3), v: +P.speed.toFixed(1), lap: P.lap, s: +P.steerVis.toFixed(2), d: P.drift, air: P.air, fin: P.finished }); } catch (e) {} } }
  updateGates(); updateFormGates(); updatePit(dt); updateCrew(dt); if (race && race.tut) updateTut(dt);
  if (race.aimOpen && (race.ended || !race.item || race.player.finished)) closeTargets();
  if ((race.standF = (race.standF || 0) + 1) % 12 === 1) drawStandings();
  updateRocks(gdt); updateWarns(); updateLamps();
  collide();
  placeAll(gdt); updateProjectiles(gdt); updateTraps(gdt); aiAttacks(gdt); updatePuffs(gdt);
  const P = race.player;
  // while racing the camera is locked behind your kart (since v40): it turns with the kart almost at once and only a
  // touch of smoothing is left, so bumps and shakes don't jolt the picture; the fly-round and the finish stay smooth
  // (v301, the user: "at the start of each race a quick tip how to steer by clicking the sides") once you can steer in a
  // race (after the garage questions and the fly-round), the TAP LEFT / TAP RIGHT tip shows for about 4 s, or until
  // you tap; a question card coming up hides it
  if (race.tapTipT === undefined) { if (CTL === 'follow' && race.started && !race.ended && !race.dialog && race.introT <= 0 && screen === 'race') { race.tapTipT = performance.now(); tapTip(true); } }
  else if (race.tapTipT > 0) { const age = performance.now() - race.tapTipT; if (age > 4200 || (age > 900 && FOLLOW.held != null) || race.dialog || race.ended) { race.tapTipT = -1; tapTip(false); } }
  const locked = race.introT <= 0 && !race.ended, rate = locked ? 22 : 7;
  race.camA += wrapA(P.angle + P.driftYaw * .35 - race.camA) * (locked ? Math.min(1, dt * 16) : Math.min(1, gdt * 4.5)); race.shake = Math.max(0, race.shake - dt * 1.4);
  { const A = race.act || (race.act = { side: 0, air: 0, dipY: 0, dipV: 0, fov: 0 }), cd = Math.min(dt, .05), sf = clamp(P.speed / 22, 0, 1);   // (v293) the action camera
    const on = locked && race.dialog !== 'pitstop' && !race.garageCam && !P.rollNow;
    A.side += ((on ? clamp(P.steerVis * sf + (P.drift || 0) * .6, -1.4, 1.4) : 0) - A.side) * Math.min(1, cd * 5);
    A.air += ((on && P.air === 'ramp' ? 1 : 0) - A.air) * Math.min(1, cd * 4);
    A.dipV += (-60 * A.dipY - 9 * A.dipV) * cd; A.dipY += A.dipV * cd; if (!on) A.dipY = A.dipV = 0;
    A.fov += ((on ? clamp((P.speed - 22) * .5, 0, 5) + (P.boostT > 0 ? 6 : 0) + A.air * 3 : 0) - A.fov) * Math.min(1, cd * 4); }
  race.camK = 1 - Math.exp(-dt * (P.air === 'ramp' ? 4 : 10)); cameraGoal(camTarget, camLook);   // (v293: in a jump the camera rises slower, so you see the kart fly)
  // the smoothing lags ~speed/rate m behind; lead the goal by that so the kart stays in the same place on screen
  if (locked) { const fv = fwd(P.angle), lead = P.speed * race.slow / rate; camTarget.x += fv.x * lead; camTarget.z += fv.z * lead; }   // (slow motion: it moves less)
  const k = 1 - Math.exp(-dt * rate); WORLD.camera.position.lerp(camTarget, k); WORLD.look.lerp(camLook, k); WORLD.camera.up.lerp(camUp, k).normalize(); WORLD.camera.lookAt(WORLD.look);
  { const CR = WORLD.crew, on = race.dialog === 'pitstop' && QUIZ_CAM[race.quizK] && CR && CR.on;   // (v273)
    if (CR && CR.men) for (const m of [...CR.men, { root: CR.rig }, { root: CR.hose }]) { if (!m.root) continue; let hide = false;
      if (on) { m.root.getWorldPosition(_v); const cx = WORLD.camera.position.x, cz = WORLD.camera.position.z, ax = P.x - cx, az = P.z - cz, L2 = ax * ax + az * az || 1, t = clamp(((_v.x - cx) * ax + (_v.z - cz) * az) / L2, 0, 1), px = cx + ax * t - _v.x, pz = cz + az * t - _v.z; hide = (t < .92 && px * px + pz * pz < .9 * .9) || (_v.x - cx) ** 2 + (_v.z - cz) ** 2 < 1.4 * 1.4; }
      const U = m.root.userData; if (hide && !U.qHid) { U.qHid = true; m.root.visible = false; } else if (!hide && U.qHid) { U.qHid = false; m.root.visible = true; } } }   // (only ever un-hides what it hid)
  if (window.FK.cam) { const c = window.FK.cam(P); if (c) { WORLD.camera.position.set(c[0], c[1], c[2]); WORLD.camera.up.set(0, 1, 0); WORLD.camera.lookAt(c[3], c[4], c[5]); } }   // test hook: a fixed camera
  // the field of view is vertical: sideways screens need less of it (66° on an upright screen, about 50° on a phone turned sideways)
  const cam = WORLD.camera, base = cam.aspect > 1 ? clamp(66 - (cam.aspect - 1) * 15, 46, 66) : (race.formation ? 80 : 74);   // (v206: upright, a wider view — widest on the formation lap)
  if (cam.userData.fov0 === undefined) cam.userData.fov0 = cam.fov; cam.fov = cam.userData.fov0 + (race.act ? race.act.fov : 0);   // (v293) a wider view at speed, in a boost and in the air
  const fov = Math.min(P.fireT > 0 ? 86 : 80, base + clamp((P.speed - 22) * .6, 0, 6) + (P.boostT > 0 ? 8 : 0) + (P.fireT > 0 ? 6 : 0));   // (capped so follow + boost never goes fish-eye) cam.fov += (fov - cam.fov) * Math.min(1, dt * 4);
  // during a pit-stop question the card sits on the left, so the picture slides right to keep your kart in view
  race.viewX = (race.viewX || 0) + ((inQ() && race.dialog !== 'aim' && cam.aspect > 1 ? .2 : 0) - (race.viewX || 0)) * Math.min(1, dt * 6);
  // (sideways, the picture is also lifted a little, so your kart sits well above the bottom edge)
  // (v162) upright, during a pit stop the picture slides up so your kart and the crew sit above the question sheet
  race.viewY = (race.viewY || 0) + ((cam.aspect < 1 && race.dialog === 'pitstop' && WORLD.crew && WORLD.crew.on ? (QUIZ_CAM[race.quizK] ? QUIZ_VIEWY : .3) : 0) - (race.viewY || 0)) * Math.min(1, dt * 5);   // (v275, the user: on a 9:16 phone the quiz shots sit lower, in the middle of the picture between the top bar and the question card)
  const lift = cam.aspect > 1 ? .12 : race.viewY > .002 ? race.viewY : 0;
  if (race.viewX > .002 || lift) { const w = stage.clientWidth, h = stage.clientHeight; cam.setViewOffset(w, h, -w * race.viewX, h * lift, w, h); } else if (cam.view && cam.view.enabled) cam.clearViewOffset(); else cam.updateProjectionMatrix();
  // a racer right under the camera would block the view: hide it until it moves away
  for (const r of race.racers) if (!r.player) r.model.root.visible = (r.x - WORLD.camera.position.x) ** 2 + (r.z - WORLD.camera.position.z) ** 2 > 3.4 ** 2;
  // speed lines at the edges of the screen when you go really fast
  const fire = race.ended ? 0 : clamp((P.fireT || 0) / .4, 0, 1);   // (v300) FIRE_LOOK on screen
  const sl = race.ended ? 0 : Math.max(clamp((P.speed - 25) / 10, 0, .55) + (P.boostT > 0 ? .45 : 0), fire); speedEl.style.opacity = sl.toFixed(2);
  speedEl.classList.toggle('fire', fire > 0); fireEl.style.opacity = (fire * (.75 + Math.random() * .25)).toFixed(2);
  if (sl > 0) speedEl.style.transform = `scale(${1.02 + Math.random() * .05}) rotate(${(Math.random() * 6).toFixed(1)}deg)`;
  for (const c of WORLD.coins) if (c.on) c.m.rotation.y += dt * 4;
  WORLD.padTex.offset.y = (WORLD.padTex.offset.y - dt * 1.6) % 1;
  for (const b of WORLD.balloons) b.position.y = b.userData.y + Math.sin(performance.now() / 700 + b.userData.p) * .25;
  if (WORLD.crowd && (race.frame = (race.frame || 0) + 1) % 3 === 0 && (WORLD.crowdList[0].x - WORLD.camera.position.x) ** 2 + (WORLD.crowdList[0].z - WORLD.camera.position.z) ** 2 < 120 ** 2) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), tt = performance.now() / 1000;
    WORLD.crowdList.forEach((d, i) => { const j = Math.max(0, Math.sin(tt * 9 + i * 1.7)) * .25; q.setFromAxisAngle(_up, d.ry); m.compose(_v.set(d.x, d.y + j, d.z), q, _s.set(d.s, d.s, d.s)); WORLD.crowd.setMatrixAt(i, m); m.compose(_v.set(d.x, d.y + j + .62 * d.s, d.z), q, _s.set(1, 1, 1)); WORLD.heads.setMatrixAt(i, m); });
    WORLD.crowd.instanceMatrix.needsUpdate = WORLD.heads.instanceMatrix.needsUpdate = true;
  }
  // the sun's shadow follows the player
  WORLD.sun.position.set(P.x + 10, P.y + 22, P.z + 8); WORLD.sun.target.position.set(P.x, P.y, P.z);
  for (const sp of WORLD.spin) sp.m.rotation[sp.axis] += sp.v * dt;
  for (const fn of WORLD.anim) fn(dt, performance.now() / 1000);
  // ? boxes spin and bob; snow falls round the camera
  const t = performance.now() / 1000;
  for (const b of WORLD.boxes) if (b.on) { b.m.rotation.y += dt * 1.6; b.m.rotation.x += dt * .6; b.m.position.y = b.y + Math.sin(t * 2.4 + b.t) * .15; if (b.m.scale.x < 1) b.m.scale.setScalar(Math.min(1, b.m.scale.x + dt * 3)); }
  if (WORLD.snow) {
    const sp = WORLD.snow.geometry.attributes.position, cp = WORLD.camera.position, fall = WORLD.snowFall;
    for (let i = 0; i < sp.count; i++) {
      let y = sp.getY(i) - dt * fall; if (y < cp.y - 8) y += 22; else if (y > cp.y + 14) y -= 22; sp.setY(i, y);
      let x = sp.getX(i) + Math.sin(t + i) * dt * .3; if (x < cp.x - 30) x += 60; else if (x > cp.x + 30) x -= 60; sp.setX(i, x);
      let z = sp.getZ(i); if (z < cp.z - 30) z += 60; else if (z > cp.z + 30) z -= 60; sp.setZ(i, z);
    }
    sp.needsUpdate = true;
  }
  // HUD
  const rank = ranking().indexOf(P) + 1;
  if (rank !== race.lastRank) { $('pos').innerHTML = `${rank}<sup>${ord(rank).slice(-2)}</sup>`; if (race.lastRank && race.started) { const e = $('pos'); e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); if (rank < race.lastRank) Snd.tone(1200, .12, 'triangle', .05, 1.3); } race.lastRank = rank; } $('lap').textContent = race.formation ? 'FORMATION' : `LAP ${clamp(P.lap, 1, TUNE.laps)}/${TUNE.laps}`; $('rcoins').textContent = `${P.coins}`;
  drawMinimap();
  if (race.started && !race.ended) { Snd.engineSet(P.speed * race.slow * .75); Snd.skid(P.drift && !P.air && race.slow > .5 ? 1 + P.driftLvl : 0); }
  renderer.render(WORLD.scene, WORLD.camera);
}

// (v108) the finals arena: the winners' stage at night — a synthwave sky over a neon city, a glowing grid floor, a round
// LED stage, glossy pillars with big Luckiest Guy numbers, a truss of moving-head lights with real coloured spotlights,
// sweeping lasers, a big LED screen, LED towers and fireworks. Everything that shines is SOLID (MeshBasic or
// emissive), never see-through, so it draws the same on every phone.
const ARENA = {};
const FONT_NUM = (px) => `${px}px "Luckiest Guy", Fredoka, Arial`;
/* ---------- (v266, the user) THE PODIUM IN THE STYLE OF THE MAP YOU RACED ON ----------
   The finals arena is rebuilt for each map: Alpine Peaks gets a snowy stage with a chalet board, pines and falling
   snow; Beach Island a sunset, sand, palms and tiki torches; Robo City keeps its neon show; Gold Mines a cave with
   crystals, lanterns and timber; Star Loop a hologram platform in deep space with rings and planets — and the
   STARSHIPS stand on the pillars there instead of karts. The numbers, the fireworks and the camera are the same. */
const ARENA_THEMES = {
  city: { fog: '#2a0e5a', hemi: [0xb8a8ff, 0x3a1a7a, 1.15], sun: [0xffffff, 2.9], rims: ['#ff5db1', '#5fe8ff'], sky: 'neon', lid: '#05031c', floor: 'grid', glow: 1, stage: ['#1c1650', '#2a2272'], rings: ['#5fe8ff', '#ff5db1', '#b77aff'], floorRings: ['#ff5db1', '#5fe8ff', '#ffd23a'], pillar: '#1e1c52', numBg: ['#2e2680', '#0c0830'], wall: 'led', metal: '#2a2e48', truss: true, lasers: true, bulbs: 'rainbow', weather: null },
  alps: { fog: '#cfe3ff', hemi: [0xe8f6ff, 0x8fb0d8, 1.25], sun: [0xfff4e0, 2.7], rims: ['#9fd0ff', '#ffe6b0'], sky: 'alps', lid: '#4a8ad8', floor: 'snow', glow: 0, stage: ['#6a4020', '#a87040'], rings: ['#e8403a', '#ffffff', '#ffd23a'], floorRings: ['#e8403a', '#ffffff', '#3a8ad8'], pillar: '#e6f0ff', numBg: ['#3a6ab8', '#1b2a6a'], wall: 'board', metal: '#6a4020', truss: false, lasers: false, bulbs: 'warm', weather: 'snow', props: 'alps' },
  beach: { fog: '#ffd8a8', hemi: [0xfff0d0, 0xc89a60, 1.25], sun: [0xfff0c0, 2.8], rims: ['#ff9a5a', '#5fe8ff'], sky: 'beach', lid: '#2a1a5a', floor: 'sand', glow: 0, stage: ['#8a5a30', '#c08a50'], rings: ['#5fe8ff', '#ff5db1', '#ffe14a'], floorRings: ['#5fe8ff', '#ffffff', '#ff8a1e'], pillar: '#f0d8a8', numBg: ['#ff8a4a', '#8a2a4a'], wall: 'surf', metal: '#8a5a30', truss: false, lasers: false, bulbs: 'warm', weather: 'petals', props: 'beach' },
  mines: { fog: '#1d1038', hemi: [0x8a7060, 0x120a06, 1.1], sun: [0xffc880, 1.9], rims: ['#c84aff', '#7af8ff'], sky: 'cave', lid: '#06030a', floor: 'rock', glow: 0, stage: ['#2a2024', '#b8742a'], rings: ['#ffd23a', '#c84aff', '#7af8ff'], floorRings: ['#ffd23a', '#c84aff', '#7af8ff'], pillar: '#3a2a30', numBg: ['#6a4a10', '#1a0a06'], wall: 'mine', metal: '#5a3a20', truss: true, lasers: false, bulbs: 'gold', weather: 'sparkle', props: 'mines' },
  space: { fog: '#05060f', hemi: [0x9fb4ff, 0x1a1040, 1.2], sun: [0xffffff, 2.4], rims: ['#c84aff', '#7af8ff'], sky: 'space', lid: '#02030a', floor: 'hex', glow: .9, stage: ['#0e1440', '#1b1f5c'], rings: ['#7af8ff', '#c84aff', '#3cff8a'], floorRings: ['#7af8ff', '#c84aff', '#ffffff'], pillar: '#10163a', numBg: ['#1b1f5c', '#05060f'], wall: 'holo', metal: '#1a1e38', truss: false, lasers: true, bulbs: 'cyan', weather: 'stars', props: 'space', ship: true },
};
function arenaSkyTex(T) {
  return canvasTex(2048, 512, (g, W, H) => {
    const grad = (stops) => { const gr = g.createLinearGradient(0, 0, 0, H); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
    const stars = (n, maxY) => { for (let i = 0; i < n; i++) { const y = Math.random() ** 1.6 * maxY, s = Math.random() < .1 ? 2.6 : 1.3; g.fillStyle = `rgba(255,255,255,${.3 + Math.random() * .7})`; g.fillRect(Math.random() * W, y, s, s); } };
    if (T.sky === 'alps') { grad([[0, '#1a3a9a'], [.35, '#3a7ae0'], [.7, '#9fd0ff'], [1, '#eaf5ff']]); stars(300, H * .3);
      for (const [col, hmax, base] of [['#c8dcf5', 260, H], ['#ffffff', 190, H]]) { let x = 0; while (x < W) { const w = 120 + Math.random() * 220, h = 60 + Math.random() * hmax; g.fillStyle = col; g.beginPath(); g.moveTo(x, base); g.lineTo(x + w / 2, base - h); g.lineTo(x + w, base); g.closePath(); g.fill(); x += w * .55; } }
      g.fillStyle = '#1f6a2a'; for (let x = 0; x < W; x += 14 + Math.random() * 20) { const h = 40 + Math.random() * 60; g.beginPath(); g.moveTo(x, H); g.lineTo(x + 12, H - h); g.lineTo(x + 24, H); g.fill(); }
    } else if (T.sky === 'beach') { grad([[0, '#2a1a5a'], [.3, '#8a2a7a'], [.55, '#ff5a6a'], [.75, '#ff9a4a'], [.88, '#ffd27a'], [1, '#3aa0d8']]); stars(200, H * .25);
      g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(W * .3, H * .8, 70, 0, 7); g.fill(); g.fillStyle = '#2a7ab0'; g.fillRect(0, H * .86, W, H * .14);
      g.fillStyle = '#2a1a3a'; for (let x = 40; x < W; x += 180 + Math.random() * 240) { const h = 120 + Math.random() * 80; g.fillRect(x - 6, H * .86 - h, 12, h); for (let k = 0; k < 7; k++) { g.beginPath(); g.ellipse(x, H * .86 - h, 70, 14, k * .9, 0, 7); g.fill(); } }
    } else if (T.sky === 'cave') { grad([[0, '#06030a'], [.5, '#1a1020'], [1, '#2a1a1a']]);
      g.fillStyle = '#0e0810'; for (let x = 0; x < W; x += 30 + Math.random() * 60) { const h = 60 + Math.random() * 200; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 20, h); g.lineTo(x + 40, 0); g.fill(); }
      for (let i = 0; i < 160; i++) { g.fillStyle = pick(['#7af8ff', '#c84aff', '#ffd23a']); g.globalAlpha = .5 + Math.random() * .5; g.fillRect(Math.random() * W, H * .3 + Math.random() * H * .6, 3, 3); } g.globalAlpha = 1;
    } else { grad([[0, '#02030a'], [.5, '#0a0a2a'], [.8, '#1a0a3a'], [1, '#2a1048']]); stars(1400, H);
      for (let i = 0; i < 6; i++) { const r = g.createRadialGradient(Math.random() * W, Math.random() * H * .7, 10, Math.random() * W, Math.random() * H * .7, 260); r.addColorStop(0, pick(['rgba(200,74,255,.35)', 'rgba(122,248,255,.3)', 'rgba(255,61,191,.3)'])); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, W, H); }
      g.fillStyle = '#ff9a5a'; g.beginPath(); g.arc(W * .72, H * .38, 60, 0, 7); g.fill(); g.strokeStyle = '#ffd27a'; g.lineWidth = 6; g.beginPath(); g.ellipse(W * .72, H * .38, 110, 24, -.3, 0, 7); g.stroke();
      g.fillStyle = '#7ab8ff'; g.beginPath(); g.arc(W * .2, H * .25, 32, 0, 7); g.fill(); }
  }, [2, 1]);
}
function arenaFloorTex(T) {
  return canvasTex(256, 256, (g) => {
    const spk = (n, a, b) => { for (let k = 0; k < n; k++) { g.fillStyle = Math.random() < .5 ? a : b; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3); } };
    if (T.floor === 'snow') { g.fillStyle = '#f4f8ff'; g.fillRect(0, 0, 256, 256); spk(500, 'rgba(150,180,230,.25)', 'rgba(255,255,255,.6)'); }
    else if (T.floor === 'sand') { g.fillStyle = '#efd9a8'; g.fillRect(0, 0, 256, 256); spk(700, 'rgba(0,0,0,.08)', 'rgba(255,255,255,.3)'); g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 2; for (let y = 6; y < 256; y += 16) { g.beginPath(); for (let x = 0; x <= 256; x += 8) g.lineTo(x, y + Math.sin(x / 9 + y) * 3); g.stroke(); } }
    else if (T.floor === 'rock') { g.fillStyle = '#3a2a2a'; g.fillRect(0, 0, 256, 256); spk(900, 'rgba(0,0,0,.3)', 'rgba(255,210,58,.35)'); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; for (let k = 0; k < 10; k++) { g.beginPath(); let x = Math.random() * 256, y = Math.random() * 256; g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += rand(-50, 50); y += rand(-50, 50); g.lineTo(x, y); } g.stroke(); } }
    else { g.fillStyle = '#070a24'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(122,248,255,.25)'; g.lineWidth = 6; g.strokeRect(0, 0, 256, 256); g.strokeStyle = '#7af8ff'; g.lineWidth = 2; g.strokeRect(0, 0, 256, 256); g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 256); g.moveTo(0, 128); g.lineTo(256, 128); g.stroke(); }
  }, [T.floor === 'hex' ? 60 : 24, T.floor === 'hex' ? 60 : 24]);
}
function arenaProps(scene, T, neon) {
  // (v266) anything that would stand between the camera (in front, +z) and the podium is moved round to the back
  const ring = (n, r0, r1, f) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + rand(-.15, .15), r = rand(r0, r1); let x = Math.cos(a) * r, z = Math.sin(a) * r; if (z > -4 && Math.abs(x) < 17) { z = -Math.abs(z) - 4; x *= 1.15; } f(x, z, a); } };
  const L = [];
  if (T.props === 'alps') { const pine = M('#2f7a3a'), snow = M('#ffffff'), trunk = M('#5a3a20'); ring(26, 9.5, 20, (x, z) => { const s = rand(.8, 1.5); L.push({ x, z, s, c: null }); }); instanced(scene, new THREE.CylinderGeometry(.22, .3, 1.2, 6).translate(0, .6, 0), trunk, L); instanced(scene, new THREE.ConeGeometry(1.7, 5, 7).translate(0, 3.3, 0), pine, L); instanced(scene, new THREE.ConeGeometry(1.2, 1.4, 7).translate(0, 5.3, 0), snow, L);
    const B = []; ring(18, 7.6, 9.5, (x, z) => B.push({ x, z, s: rand(.6, 1.1), ry: rand(0, 6) })); instanced(scene, new THREE.SphereGeometry(1, 9, 6).scale(2.3, .9, 2.8), snow, B); }
  if (T.props === 'beach') { ring(14, 10, 18, (x, z) => L.push({ x, z, s: rand(.8, 1.2) })); instanced(scene, new THREE.CylinderGeometry(.22, .34, 5.5, 7).translate(0, 2.75, 0), M('#8a5a30'), L); instanced(scene, new THREE.SphereGeometry(1.9, 8, 6).scale(1, .45, 1).translate(0, 5.6, 0), M('#3aa84a'), L);
    const Tq = []; ring(10, 6.8, 7.4, (x, z) => Tq.push({ x, z, s: 1 })); instanced(scene, new THREE.CylinderGeometry(.08, .12, 2.2, 6).translate(0, 1.1, 0), M('#5a3a20'), Tq); ARENA.flames = instanced(scene, new THREE.ConeGeometry(.24, .7, 6).translate(0, 2.55, 0), neon('#ffb040'), Tq, false); }
  if (T.props === 'mines') { const cm = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#7af8ff', emissiveIntensity: .7, roughness: .25 }); ring(30, 7.6, 16, (x, z) => L.push({ x, z, s: rand(.6, 1.8), ry: rand(0, 6), c: pick(['#7af8ff', '#c84aff', '#bff4ff']) })); instanced(scene, new THREE.ConeGeometry(.55, 2.6, 5).translate(0, 1.3, 0), cm, L);
    const R = []; ring(16, 11, 20, (x, z) => R.push({ x, z, s: rand(1, 3), ry: rand(0, 6) })); instanced(scene, new THREE.DodecahedronGeometry(1.1, 0), M('#3a2a30', { roughness: .95 }), R);
    const Lp = []; ring(8, 6.6, 6.8, (x, z) => Lp.push({ x, z, s: 1 })); instanced(scene, new THREE.CylinderGeometry(.09, .11, 3.2, 8).translate(0, 1.6, 0), M('#2a2e3a'), Lp); instanced(scene, new THREE.SphereGeometry(.34, 10, 8).translate(0, 3.3, 0), neon('#ffd080'), Lp, false); }
  if (T.props === 'space') { ring(22, 12, 26, (x, z) => L.push({ x, z, y: rand(-3, 8), s: rand(.6, 2.4), ry: rand(0, 6), c: pick(['#6a6478', '#8a8498', '#5a5468']) })); instanced(scene, new THREE.DodecahedronGeometry(1.4, 0), M('#ffffff', { roughness: .95 }), L, false);
    ARENA.srings = []; for (const [r, c, y] of [[9.5, '#7af8ff', 2.5], [11, '#c84aff', 3.5], [13, '#3cff8a', 4.5]]) { const m = new THREE.Mesh(new THREE.TorusGeometry(r, .06, 6, 96).rotateX(Math.PI / 2), neon(c)); m.position.y = y; scene.add(m); ARENA.srings.push(m); }
    const pl = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 16), M('#ff9a5a', { emissive: '#ff6a2a', emissiveIntensity: .25 })); pl.position.set(-26, 14, -40); scene.add(pl); const pr = new THREE.Mesh(new THREE.TorusGeometry(9, .5, 8, 48).rotateX(1.3), M('#ffd27a')); pr.position.copy(pl.position); scene.add(pr); }
}
function arenaWeather(scene, T) {
  if (!T.weather) { ARENA.wx = null; return; }
  const F = TT_FX[T.weather] || TT_FX.snow, n = Math.min(F.n, 500), dot = canvasTex(32, 32, (x) => { const r = x.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = r; x.fillRect(0, 0, 32, 32); });
  const sg = new THREE.BufferGeometry(), sp = new Float32Array(n * 3), cl = new Float32Array(n * 3), cc = new THREE.Color();
  for (let i = 0; i < n; i++) { sp[i * 3] = rand(-22, 22); sp[i * 3 + 1] = rand(0, 16); sp[i * 3 + 2] = rand(-22, 16); cc.set(pick(F.c)); cl[i * 3] = cc.r; cl[i * 3 + 1] = cc.g; cl[i * 3 + 2] = cc.b; }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  const p = new THREE.Points(sg, new THREE.PointsMaterial({ map: dot, size: F.size * 1.3, transparent: true, depthWrite: false, opacity: F.op, vertexColors: true })); p.frustumCulled = false; scene.add(p); ARENA.wx = { p, F };
}
function buildArena(id = 'city') {
  const T = ARENA_THEMES[id] || ARENA_THEMES.city; ARENA.id = id;
  const scene = new THREE.Scene(); ARENA.scene = scene; scene.environment = ENV; scene.fog = new THREE.Fog(T.fog, 45, 170);
  const neon = (c) => new THREE.MeshBasicMaterial({ color: c, fog: false }), metal = M(T.metal, { roughness: .35, metalness: .8 });
  const sun = addLights(scene, 1024, 6, { hemi: T.hemi, sun: T.sun }); sun.position.set(3, 10, 9);
  const rim = new THREE.DirectionalLight(T.rims[0], 2.2); rim.position.set(-4, 5, -7); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(T.rims[1], 1.8); rim2.position.set(5, 4, -6); scene.add(rim2);
  // the sky: deep space into a pink-and-orange glow on the horizon, stars, and a neon city skyline all round
  const skyT = T.sky !== 'neon' ? arenaSkyTex(T) : canvasTex(2048, 512, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#05031c'); gr.addColorStop(.32, '#1d0a5e'); gr.addColorStop(.6, '#6a1aa8'); gr.addColorStop(.8, '#e83a9a'); gr.addColorStop(.93, '#ff9a5a'); gr.addColorStop(1, '#ffd27a');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) { const y = Math.random() ** 1.6 * H * .62, s = Math.random() < .1 ? 2.6 : 1.3; g.fillStyle = `rgba(255,255,255,${.3 + Math.random() * .7})`; g.fillRect(Math.random() * W, y, s, s); }
    for (const [base, col, hmax, win] of [[H, '#43197a', 120, .22], [H, '#180a3c', 190, .45]]) {
      let x = 0; while (x < W) { const w = 26 + Math.random() * 64, h = 30 + Math.random() * hmax; g.fillStyle = col; g.fillRect(x, base - h, w, h);
        const nc = pick(['#5fe8ff', '#ff5db1', '#ffd23a', '#7dff6a', '#b77aff']);
        if (Math.random() < .55) { g.fillStyle = nc; g.fillRect(x, base - h, w, 3); }
        if (Math.random() < .25) { g.fillStyle = col; g.fillRect(x + w / 2 - 1.5, base - h - 26, 3, 26); g.fillStyle = '#ff3a5a'; g.fillRect(x + w / 2 - 2.5, base - h - 29, 5, 5); }
        for (let yy = base - h + 8; yy < base - 6; yy += 10) for (let xx = x + 5; xx < x + w - 5; xx += 8) if (Math.random() < win) { g.fillStyle = pick(['#ffe9a0', '#9ff0ff', '#ffb0e8']); g.fillRect(xx, yy, 3, 4); }
        g.fillStyle = col; x += w + Math.random() * 6; }
    }
  }, [2, 1]);
  const sky = new THREE.Mesh(new THREE.CylinderGeometry(125, 125, 100, 48, 1, true), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false })); sky.position.y = 48; scene.add(sky);
  const lid = new THREE.Mesh(new THREE.CircleGeometry(125, 48).rotateX(Math.PI / 2), neon(T.lid)); lid.position.y = 98; scene.add(lid);
  // the floor: a dark glossy grid, pink lines with cyan ones in between, fading into the purple haze
  const gridT = T.floor !== 'grid' ? arenaFloorTex(T) : canvasTex(256, 256, (g) => { g.fillStyle = '#140932'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#ff3ab0'; g.fillRect(0, 0, 256, 5); g.fillRect(0, 0, 5, 256); g.fillStyle = '#3ad8ff'; g.fillRect(0, 127, 256, 2); g.fillRect(127, 0, 2, 256); }, [110, 110]);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(124, 72).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: gridT, emissive: '#ffffff', emissiveMap: gridT, emissiveIntensity: T.glow, roughness: T.glow ? .5 : .9, metalness: T.glow ? .2 : 0, envMapIntensity: .25 })); floor.receiveShadow = true; scene.add(floor);
  // the round stage: glossy, with neon rings on top and a chase of rainbow bulbs round its edge
  const stage = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.95, .32, 72), M(T.stage[0], { roughness: .22, metalness: .75 })); stage.position.y = .16; stage.receiveShadow = true; scene.add(stage);
  const stTop = new THREE.Mesh(new THREE.CylinderGeometry(5.52, 5.52, .03, 72), M(T.stage[1], { roughness: .3, metalness: .5 })); stTop.position.y = .33; stTop.receiveShadow = true; scene.add(stTop);
  for (const [r, c, w] of [[5.56, T.rings[0], .05], [4.7, T.rings[1], .035], [4.45, T.rings[2], .025]]) { const m = new THREE.Mesh(new THREE.TorusGeometry(r, w, 6, 96).rotateX(Math.PI / 2), neon(c)); m.position.y = .35; scene.add(m); }
  for (const [r, c] of [[6.1, T.floorRings[0]], [6.6, T.floorRings[1]], [7.3, T.floorRings[2]]]) { const m = new THREE.Mesh(new THREE.RingGeometry(r, r + .09, 96).rotateX(-Math.PI / 2), neon(c)); m.position.y = .012; scene.add(m); }
  const N_B = 84, bulbs = []; for (let i = 0; i < N_B; i++) { const a = i / N_B * Math.PI * 2; bulbs.push({ x: Math.cos(a) * 5.8, y: .17, z: Math.sin(a) * 5.8, s: .085, c: '#ffffff' }); }
  ARENA.bulbs = instanced(scene, new THREE.SphereGeometry(1, 8, 6), neon('#ffffff'), bulbs, false);
  // the podium pillars: dark glass-and-metal bodies, a glowing top in the place's colour, neon edges, and the number
  ARENA.podium = new THREE.Group(); scene.add(ARENA.podium); ARENA.blocks = []; ARENA.halos = []; ARENA.numTex = [];
  const PLACES = [[0, 1.3, '#ffd23a', '#fffbe0', '#ff8a1e', '1', 'ST'], [-2.35, .95, '#7fe0ff', '#ffffff', '#4a7ae8', '2', 'ND'], [2.35, .65, '#ff8a4a', '#ffe2c8', '#d83a2a', '3', 'RD']];
  const drawNum = (g, W, H, c, c1, c2, n, suf) => {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, T.numBg[0]); bg.addColorStop(1, T.numBg[1]); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.05)'; for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2);
    g.strokeStyle = c; g.lineWidth = 6; g.strokeRect(16, 12, W - 32, H - 24);
    const fs = H * .8, sf = fs * .34; g.font = FONT_NUM(sf); const sw = g.measureText(suf).width; g.font = FONT_NUM(fs); const nw = g.measureText(n).width;
    const x0 = W / 2 - (nw + sw + 8) / 2, yb = H / 2 + fs * .37, fill = g.createLinearGradient(0, yb - fs * .75, 0, yb);
    fill.addColorStop(0, c1); fill.addColorStop(.5, c); fill.addColorStop(1, c2); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    g.shadowColor = c; g.shadowBlur = H * .14; g.lineWidth = fs * .11; g.strokeStyle = '#0a0620'; g.strokeText(n, x0, yb); g.shadowBlur = 0; g.fillStyle = fill; g.fillText(n, x0, yb);
    g.font = FONT_NUM(sf); g.lineWidth = sf * .2; g.strokeText(suf, x0 + nw + 8, yb - fs * .4); g.fillStyle = '#ffffff'; g.fillText(suf, x0 + nw + 8, yb - fs * .4);
  };
  for (const [x, h, c, c1, c2, n, suf] of PLACES) {
    const W = 512, H = Math.round(512 * h / 2.25), t = canvasTex(W, H, (g) => drawNum(g, W, H, c, c1, c2, n, suf)); ARENA.numTex.push(() => { drawNum(t.image.getContext('2d'), W, H, c, c1, c2, n, suf); t.needsUpdate = true; });
    const side = M(T.pillar, { roughness: .2, metalness: T.glow ? .75 : .2 }), topM = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .35, roughness: .3, metalness: .4 });
    const front = new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: .6, roughness: .35 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.25, h, 2.2), [side, side, topM, side, front, side]); b.position.set(x, h / 2 + .34, 0); b.userData.h = h + .34; b.castShadow = b.receiveShadow = true; ARENA.podium.add(b); ARENA.blocks.push(b);
    const nm = neon(c), y0 = .34;
    for (const z of [1.12, -1.12]) box(ARENA.podium, 2.3, .06, .06, nm, x, y0 + h, z);
    for (const sx of [-1.14, 1.14]) { box(ARENA.podium, .06, .06, 2.3, nm, x + sx, y0 + h, 0); box(ARENA.podium, .06, h, .06, nm, x + sx, y0 + h / 2, 1.12); }
    box(ARENA.podium, 2.3, .05, .05, nm, x, y0 + .03, 1.12);
    // a turning ring of light round each winner
    const halo = new THREE.Group(); halo.position.set(x, y0 + h + .03, 0); for (let k = 0; k < 8; k++) { const a = new THREE.Mesh(new THREE.TorusGeometry(.98, .035, 6, 10, .48).rotateX(Math.PI / 2), nm); a.rotation.y = k * Math.PI / 4; halo.add(a); } ARENA.podium.add(halo); ARENA.halos.push(halo);
  }
  if (document.fonts && document.fonts.load) document.fonts.load(FONT_NUM(100)).then(() => ARENA.numTex.forEach((f) => f())).catch(() => {});
  // the big LED screen behind: WINNERS over a dancing rainbow equaliser, with an LED dot grid
  { const c = document.createElement('canvas'); c.width = 512; c.height = 288; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; ARENA.wall = { g: c.getContext('2d'), t, next: 0 };
    box(scene, 11.5, 6.7, .3, metal, 0, 3.45, -5.85);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(11, 6.2), new THREE.MeshBasicMaterial({ map: t, fog: false })); scr.position.set(0, 3.45, -5.68); scene.add(scr);
    for (const [y, c2] of [[6.82, T.rings[1]], [.08, T.rings[0]]]) box(scene, 11.6, .1, .1, neon(c2), 0, y, -5.66); }
  // the truss: two towers and a beam, moving-head lights hanging from it (three of them real coloured spotlights)
  const TX = 6.9, TZ = -3.4, TH = 7.6; ARENA.cols = null; ARENA.heads = []; ARENA.spots = []; ARENA.lasers = [];
  if (T.truss) {
  const truss = (x0, y0, z0, w, h, d) => { for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(scene, w > .6 ? w : .07, h > .6 ? h : .07, d > .6 ? d : .07, metal, x0 + (w > .6 ? 0 : dx * .22), y0 + (h > .6 ? 0 : dx * .22), z0 + (d > .6 ? 0 : dz * .22)); };
  for (const x of [-TX, TX]) { truss(x, TH / 2, TZ, .5, TH, .5); for (let y = .6; y < TH; y += .7) box(scene, .5, .05, .5, metal, x, y, TZ); }
  truss(0, TH, TZ, TX * 2 + .5, .5, .5);
  // LED columns on the towers' fronts
  const col = []; for (const x of [-TX, TX]) for (let k = 0; k < 18; k++) col.push({ x, y: .4 + k * .4, z: TZ + .32, s: .14, c: '#ffffff' });
  ARENA.cols = instanced(scene, new THREE.BoxGeometry(1.4, 1.4, .6), neon('#ffffff'), col, false);
  const headCols = ['#ff5db1', '#5fe8ff', '#ffd23a', '#7dff6a', '#b77aff', '#ff8a1e'];
  [-5.2, -3.1, -1, 1, 3.1, 5.2].forEach((x, k) => {
    const h = new THREE.Group(); h.position.set(x, TH - .55, TZ + .1); scene.add(h); box(h, .1, .3, .1, metal, 0, .3, 0);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.22, .3, .55, 14).rotateX(Math.PI / 2), M('#1a1c2c', { roughness: .4, metalness: .7 })); h.add(body);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.2, 16), neon(headCols[k])); lens.position.z = .28; h.add(lens);
    ARENA.heads.push({ h, x, k });
  }); }
  for (const [c, x] of [[T.rims[0], -2.35], ['#fff3d0', 0], [T.rims[1], 2.35]]) { const s = new THREE.SpotLight(c, 85, 0, .36, .55, 2); s.position.set(x * 1.4, TH - .55, TZ + .2); s.target.position.set(x, 1.4, 0); scene.add(s, s.target); ARENA.spots.push({ s, x }); }
  // lasers: thin solid beams from the towers and the screen, sweeping across the sky
  if (T.lasers) [[-TX, TH + .3, TZ, '#ff3ab0'], [TX, TH + .3, TZ, '#3ad8ff'], [-TX, TH + .3, TZ, '#7dff6a'], [TX, TH + .3, TZ, '#ffd23a'], [-5.6, 6.9, -5.8, '#b77aff'], [5.6, 6.9, -5.8, '#ff8a1e'], [0, 6.9, -5.8, '#5fe8ff']].forEach(([x, y, z, c], k) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 90, 5).translate(0, 45, 0), neon(c)); m.position.set(x, y, z); scene.add(m); ARENA.lasers.push({ m, k, side: Math.sign(x) || (k % 2 ? 1 : -1) });
  });
  // fireworks: a pool of little solid sparks
  const FW = 420; ARENA.fw = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), neon('#ffffff'), FW); ARENA.fw.frustumCulled = false; scene.add(ARENA.fw);
  ARENA.fwP = []; const m4 = new THREE.Matrix4().makeScale(0, 0, 0), wc = new THREE.Color('#ffffff');
  for (let i = 0; i < FW; i++) { ARENA.fw.setMatrixAt(i, m4); ARENA.fw.setColorAt(i, wc); ARENA.fwP.push({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3() }); }
  ARENA.fwNext = 0;
  arenaProps(scene, T, neon); arenaWeather(scene, T);
}
const _ac = new THREE.Color(), _am = new THREE.Matrix4(), _aq = new THREE.Quaternion(), _as = new THREE.Vector3();
function drawArenaWall(t) {
  const { g } = ARENA.wall, W = 512, H = 288, T = ARENA_THEMES[ARENA.id] || ARENA_THEMES.city, st = T.wall;
  if (st !== 'led') {   // (v266) a chalet board, a surfboard sign, a mine sign or a hologram, with WINNERS! in their own style
    if (st === 'board') { g.fillStyle = '#8a5a30'; g.fillRect(0, 0, W, H); for (let y = 0; y < H; y += 36) { g.fillStyle = `rgba(0,0,0,${.15 + Math.random() * .1})`; g.fillRect(0, y + 33, W, 3); } g.fillStyle = '#e8403a'; g.fillRect(0, 0, W, 14); g.fillRect(0, H - 14, W, 14); }
    else if (st === 'surf') { g.fillStyle = '#2aa8c8'; g.fillRect(0, 0, W, H); g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(W / 2, H / 2, W * .47, H * .44, 0, 0, 7); g.fill(); g.fillStyle = '#ff5db1'; g.fillRect(0, H / 2 - 5, W, 10); }
    else if (st === 'mine') { g.fillStyle = '#2a1a10'; g.fillRect(0, 0, W, H); g.fillStyle = '#5a3a20'; g.fillRect(16, 16, W - 32, H - 32); g.fillStyle = '#ffd23a'; for (let k = 0; k < 40; k++) g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    else { g.fillStyle = '#02050f'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(122,248,255,.08)'; for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2); g.strokeStyle = '#7af8ff'; g.lineWidth = 4; g.strokeRect(8, 8, W - 16, H - 16); }
    const fs = 96 + Math.sin(t * 4) * 3; g.font = FONT_NUM(fs); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const fill = st === 'board' ? '#fff3d0' : st === 'surf' ? '#ff5db1' : st === 'mine' ? '#ffd23a' : '#7af8ff', stroke = st === 'surf' ? '#1b2a4a' : st === 'holo' ? '#0a3a4a' : '#2a1208';
    g.lineWidth = 14; g.strokeStyle = stroke; g.strokeText('WINNERS!', W / 2, H / 2 + (st === 'holo' && Math.random() < .08 ? rand(-6, 6) : 0)); g.fillStyle = fill; g.fillText('WINNERS!', W / 2, H / 2);
    if (st === 'board') for (let k = 0; k < 12; k++) { g.fillStyle = ['#e8403a', '#ffe14a', '#4fc84a', '#2a9fe6'][k % 4]; g.beginPath(); g.moveTo(k * 44 + 10, 18); g.lineTo(k * 44 + 44, 18); g.lineTo(k * 44 + 27, 46); g.fill(); }
    if (st === 'holo') { g.fillStyle = 'rgba(122,248,255,.25)'; g.fillRect(0, ((t * 90) % H), W, 6); }
    ARENA.wall.t.needsUpdate = true; return;
  }
  g.fillStyle = '#0a0626'; g.fillRect(0, 0, W, H);
  const n = 32, bw = W / n; for (let i = 0; i < n; i++) { const v = .25 + .75 * Math.abs(Math.sin(t * 3.1 + i * .55) * Math.cos(t * 1.7 + i * .23)), bh = v * H * .55; g.fillStyle = `hsl(${(i / n * 360 + t * 60) % 360},100%,60%)`; g.fillRect(i * bw + 2, H - bh, bw - 4, bh); }
  const pulse = 1 + Math.sin(t * 4) * .04, fs = 92 * pulse; g.font = FONT_NUM(fs); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const gr = g.createLinearGradient(80, 0, 432, 0); for (let k = 0; k <= 6; k++) gr.addColorStop(k / 6, `hsl(${(k * 60 + t * 90) % 360},100%,65%)`);
  g.lineWidth = 14; g.strokeStyle = '#ffffff'; g.strokeText('WINNERS!', W / 2, 78); g.fillStyle = gr; g.fillText('WINNERS!', W / 2, 78);
  for (let k = 0; k < 14; k++) { const a = t * 1.5 + k * .45; g.fillStyle = k % 2 ? '#ffd23a' : '#ffffff'; g.beginPath(); g.arc(W / 2 + Math.cos(a) * 230, 78 + Math.sin(a * 1.3) * 52, 3.5, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,.45)'; for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1, H); for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  ARENA.wall.t.needsUpdate = true;
}
function updateArena(dt, cam) {
  const t = performance.now() / 1000;
  for (let i = 0; i < 84; i++) { ARENA.bulbs.setColorAt(i, _ac.setHSL((i / 84 * 2 - t * .35 + 4) % 1, 1, .6)); } ARENA.bulbs.instanceColor.needsUpdate = true;
  if (ARENA.cols) { for (let i = 0; i < 36; i++) { const k = i % 18, on = ((k - t * 9) % 18 + 18) % 18 < 6; ARENA.cols.setColorAt(i, on ? _ac.setHSL((t * .2 + k / 18) % 1, 1, .6) : _ac.set('#2a2060')); } ARENA.cols.instanceColor.needsUpdate = true; }
  { const T = ARENA_THEMES[ARENA.id] || ARENA_THEMES.city; if (T.bulbs !== 'rainbow') { const c = T.bulbs === 'gold' ? '#ffd23a' : T.bulbs === 'cyan' ? '#7af8ff' : '#ffe6a0'; for (let i = 0; i < 84; i++) ARENA.bulbs.setColorAt(i, _ac.set(((i - Math.floor(t * 8)) % 4 + 4) % 4 < 2 ? c : '#ffffff')); } }
  if (ARENA.srings) ARENA.srings.forEach((m, i) => { m.rotation.y = t * (.2 + i * .1); m.position.y = (2.5 + i) + Math.sin(t * .8 + i) * .4; });
  if (ARENA.flames) { for (let i = 0; i < ARENA.flames.count; i++) ARENA.flames.setColorAt(i, _ac.set(Math.random() < .5 ? '#ffb040' : '#ff7a1e')); ARENA.flames.instanceColor.needsUpdate = true; }
  if (ARENA.wx) { const { p, F } = ARENA.wx, a = p.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * F.fall; if (y < 0) y += 16; else if (y > 16) y -= 16; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(t + i) * dt * F.sway); } a.needsUpdate = true; }
  ARENA.halos.forEach((h, i) => (h.rotation.y = t * (i ? -1.2 : 1.5)));
  for (const { h, x, k } of ARENA.heads) h.lookAt(x * .45 + Math.sin(t * .9 + k) * 2.2, 1.2 + Math.sin(t * 1.3 + k * 2) * .8, 2 + Math.cos(t * .7 + k) * 1.5);
  for (const { s, x } of ARENA.spots) s.target.position.set(x + Math.sin(t * 1.1 + x) * .6, 1.4, Math.cos(t * .9 + x) * .5);
  for (const { m, k, side } of ARENA.lasers) { m.rotation.set(-.35 + Math.sin(t * .6 + k * 1.3) * .3, 0, side * (.15 + .55 * (.5 + .5 * Math.sin(t * .8 + k)))); }
  if (t > ARENA.wall.next) { ARENA.wall.next = t + 1 / 15; drawArenaWall(t); }
  // fireworks: a new burst every ~0.6 s, somewhere in the visible sky
  if (t > ARENA.fwNext) {
    ARENA.fwNext = t + rand(.45, .8); const z = rand(-48, -32), dist = 12.5 - z, vh = Math.tan(cam.fov * Math.PI / 360) * dist;
    const cx = rand(-.85, .85) * vh * cam.aspect, cy = 3.2 + rand(.35, .8) * vh, c1 = pick(['#ff5db1', '#5fe8ff', '#ffd23a', '#7dff6a', '#b77aff', '#ff8a1e', '#ffffff']), c2 = pick(['#ffffff', '#ffd23a', c1]);
    let n = 0; for (let i = 0; i < ARENA.fwP.length && n < 44; i++) { const P = ARENA.fwP[i]; if (P.life > 0) continue; n++; P.life = P.max = rand(1.3, 1.9); P.p.set(cx, cy, z); P.v.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(6, 8.5)); ARENA.fw.setColorAt(i, _ac.set(n % 3 ? c1 : c2)); }
    ARENA.fw.instanceColor.needsUpdate = true;
  }
  for (let i = 0; i < ARENA.fwP.length; i++) { const P = ARENA.fwP[i]; if (P.life <= 0) continue; P.life -= dt; P.v.y -= 3.2 * dt; P.v.multiplyScalar(1 - 1.1 * dt); P.p.addScaledVector(P.v, dt); const s = P.life > 0 ? .42 * Math.sqrt(P.life / P.max) : 0; _am.compose(P.p, _aq, _as.set(s, s, s)); ARENA.fw.setMatrixAt(i, _am); }
  ARENA.fw.instanceMatrix.needsUpdate = true;
}
// the winners' podium: the top three karts on the pillars 2-1-3 in the finals arena, confetti
function showPodium(order, right) {
  if (!podT) { podT = el('div', 'podtags'); stage.appendChild(podT); }
  ARENA.oy = null;
  podT.hidden = true; podT.innerHTML = order.slice(0, 3).map((r) => `<div class="podtag${r.player ? ' me' : ''}"><b>${r.player ? 'You' : r.ch.name}</b><i>${right ? right(r) : ''}</i></div>`).join('');
  if (!ARENA.scene || ARENA.id !== TDEF.id) buildArena(TDEF.id); const P = ARENA.podium; ARENA.camD = 0;   // (v266) the arena of the map you raced on
  for (const r of SHOW.podRacers || []) P.remove(r.root);
  SHOW.podRacers = order.slice(0, 3).map((r, i) => {
    const m = makeRacerModel(r.ch, r.player ? save.kart.color : r.ch.color, r.player ? save.kart.sticker : r.ch.sticker || 'none', r.player, null, !!TDEF.ship), b = ARENA.blocks[i];   // (v266: the starships on Star Loop)
    m.root.position.set(b.position.x, b.userData.h, 0); m.root.rotation.y = -b.position.x * .12; P.add(m.root); return m;
  });
  for (let i = 0; i < 60; i++) { const c = el('div', 'confetti'); c.style.left = rand(0, 100) + '%'; c.style.background = pick(['#ffe14a', '#ff5db1', '#4fc84a', '#3c8cf0', '#ff8a1e']); c.style.animationDuration = rand(1.8, 3.4) + 's'; c.style.animationDelay = rand(0, 1.5) + 's'; stage.appendChild(c); setTimeout(() => c.remove(), 5200); }
}
function hidePodium() { if (!SHOW.podium) return; SHOW.camera.fov = 36; SHOW.camera.updateProjectionMatrix(); SHOW.podium.visible = false; SHOW.turn.visible = true; SHOW.base.forEach((m) => (m.visible = true)); }
function updatePodium(dt) {
  const t = performance.now() / 1000, cam = SHOW.camera; cam.clearViewOffset(); cam.fov = cam.aspect > 1 ? 30 : 55;   // (sideways: closer in)
  // (v108) on a tall phone screen the camera steps back until all three pillars fit across
  // and sideways, with the results showing, until they fit into the free space left of the results
  const w = stage.clientWidth, h = stage.clientHeight, R = $('results'), tn = Math.tan(cam.fov * Math.PI / 360) * cam.aspect;
  const left = !R.hidden && !isPortrait() ? Math.max(120, R.getBoundingClientRect().left - stage.getBoundingClientRect().left) : w;
  const want = Math.max(12.5, cam.aspect < 1 ? 4.2 / tn : 4.9 * w / (left * tn));
  ARENA.camD = ARENA.camD ? ARENA.camD + (want - ARENA.camD) * Math.min(1, dt * 3) : want; const D = ARENA.camD;
  cam.position.set(Math.sin(t * .25) * 1.2, 3.2 + (D - 12.5) * .15, D); cam.lookAt(0, 1.6, 0);
  // with the results showing, the podium moves into the free space on their left
  if (!R.hidden && isPortrait()) {   // (v278) the podium sits right above the results, with room for the times under it, however tall the panel is
    const top = R.getBoundingClientRect().top - stage.getBoundingClientRect().top; let oy = ARENA.oy ?? h * .15; cam.setViewOffset(w, h, 0, oy, w, h); cam.updateMatrixWorld();
    _hp.set(0, .34, 1.12).project(cam); const want = clamp(oy + (1 - _hp.y) / 2 * h - (top - 58), 0, h * .4); oy = ARENA.oy == null ? want : oy + (want - oy) * Math.min(1, dt * 8); ARENA.oy = oy; cam.setViewOffset(w, h, 0, oy, w, h);
  }
  else if (!R.hidden) { cam.setViewOffset(w, h, w / 2 - left / 2, h * .04, w, h); } else cam.updateProjectionMatrix();
  if (podT) { const on = !R.hidden && screen === 'podium' && !!ARENA.blocks; podT.hidden = !on;
    if (on) { cam.updateMatrixWorld(); [...podT.children].forEach((d, i) => { const b = ARENA.blocks[i]; _hp.set(b.position.x, .34, 1.12).project(cam); d.style.left = (_hp.x + 1) / 2 * w + 'px'; d.style.top = (1 - _hp.y) / 2 * h + 5 + 'px'; }); } }
  (SHOW.podRacers || []).forEach((m, i) => { m.body.position.y = Math.abs(Math.sin(t * 3 + i)) * .12; m.driver.rotation.z = Math.sin(t * 4 + i) * .15; });
  if (ARENA.scene) { updateArena(Math.min(dt, .05), cam); renderer.render(ARENA.scene, cam); } else renderer.render(SHOW.scene, cam);
}
const _hp = new THREE.Vector3();
function updateShowroom(dt) {
  const t = performance.now() / 1000, cam = SHOW.camera, garage = screen === 'garage';
  if (garage && updateGarage3D(dt)) return;   // (v228) the garage is its own room
  if (SHOW.turn.parent !== SHOW.scene) { SHOW.scene.add(SHOW.turn); SHOW.turn.position.set(0, .34, 0); }
  SHOW.spin = Math.max(0, (SHOW.spin || 0) - dt * 1.5); SHOW.pop = Math.max(0, (SHOW.pop || 0) - dt * 2.6);
  // (v90) the racer swings from one side view to the other through the front, never showing its back; a drag still turns it, then it eases back
  if (!(rDrag && rDrag.moved > 10)) { SHOW.ph = (SHOW.ph || 0) + dt * (.42 + SHOW.spin * 3); const want = Math.sin(SHOW.ph) * 1.5; SHOW.turn.rotation.y += wrapA(want - SHOW.turn.rotation.y) * Math.min(1, dt * 3); }
  // a new racer pops onto the stand (small, a bit too big, then just right) and the ring flashes
  SHOW.turn.scale.setScalar(SHOW.pop ? 1 + Math.sin((1 - SHOW.pop) * Math.PI) * .16 - SHOW.pop * .3 : 1);
  SHOW.ringM.emissiveIntensity = .5 + Math.sin(t * 3) * .15 + SHOW.pop * 2;
  // the lobby: the under-glow breathes with the ring, the snow falls
  { const k = .5 + Math.sin(t * 2) * .5 + SHOW.pop; SHOW.glowRings[0].material.color.setHSL(.1, 1, .72 + k * .06); }
  { const a = SHOW.sparks.geometry.attributes.position; for (let i = 0; i < a.count; i++) { const y = a.getY(i) - dt * (.35 + (i % 5) * .1); a.setY(i, y < 0 ? 7 : y); } a.needsUpdate = true; }
  if (SHOW.racer) { SHOW.racer.body.position.y = Math.sin(t * 2) * .02 + (SHOW.racer.hover ? .05 : 0); for (const s of SHOW.racer.spins) s.rotation.x += dt * .5; }
  // camera height, distance, how far the picture is pushed up [2] and sideways [3] (fractions of the screen), and the
  // height it looks at [4]: in the lobby it stands close and almost level with the racer (the sky shows behind it) and
  // keeps the racer about a third of the screen wide in the middle; in the garage the racer stands left of the shop
  const goal = garage ? [1.9, 5.9, .03, 0, .65] : [1, 4.3, -.04, 0, .85], sr = stage.getBoundingClientRect(), w = sr.width || 1, h = sr.height || 1;
  if (garage && isPortrait()) { goal[2] = .2; goal[0] = 2.2; goal[1] = 7; }
  else if (garage) { const sh = $('shop').getBoundingClientRect(); if (sh.width) goal[3] = (w / 2 - (sh.left - sr.left) / 2) / w; }
  else if (isPortrait()) { const c = window.FK.lobCam || [2.3, 10.5, -.05 + LOB_UP, .5]; goal[0] = c[0]; goal[1] = c[1]; goal[2] = c[2]; goal[4] = c[3]; }   // (FK.lobCam: a test hook to tune it)   // (v77, the phone mockup: the kart big in the middle)
  else { const d = clamp(Math.max(4.4, 2.4 / (.42 * (w / h) * .65)), 4, 12); goal[0] = .95 + d * .1; goal[1] = d; goal[4] = .95; }   // looking a little higher: more of the sky and the aurora   // a little above the racer, so the rings on the dais show
  // (v169, the user) on a phone held upright the camera sees only ~7 m either side, so the chalet (11 m to the left)
  // was out of the picture: there it stands smaller and further back on the right, roof and all beside the logo
  { const ch = SHOW.chalet, up = isPortrait(); if (ch && ch.userData.up !== up) { ch.userData.up = up; const [x, z, ry, s] = up ? [4.2, -24, -.45, .6] : [-11, -16, .5, 1]; ch.position.set(x, SHOW.groundAt(x, z) - .15, z); ch.rotation.y = ry; ch.scale.setScalar(s); } }
  if (!SHOW.cam || SHOW.cam.length < 5) SHOW.cam = goal.slice();
  for (let i = 0; i < 5; i++) SHOW.cam[i] += (goal[i] - SHOW.cam[i]) * Math.min(1, dt * 4);
  cam.position.set(0, SHOW.cam[0], SHOW.cam[1]); cam.lookAt(0, SHOW.cam[4], 0);
  cam.setViewOffset(w, h, w * SHOW.cam[3], h * SHOW.cam[2], w, h);
  showClip(); renderer.render(SHOW.scene, cam);
  // the name plate floats over the racer's head, the "tap your racer" hint sits under the stand
  if (screen === 'menu') {
    const z = SHOW.zoom || 1; _hp.set(0, 1.9, 0).project(cam);
    $('plate').style.left = ((_hp.x + 1) / 2 * w / z).toFixed(1) + 'px'; $('plate').style.top = ((1 - _hp.y) / 2 * h / z).toFixed(1) + 'px';
    _hp.set(0, 0, 0).project(cam); $('tapme').style.left = ((_hp.x + 1) / 2 * w / z).toFixed(1) + 'px';
  }
}

function setLowQuality(on) { save.lowq = +on || 0; store(); applyGfx(); }
// put the chosen quality into effect: resolution, the sun's shadows (size and reach), the lantern lights
function applyGfx() {
  const g = gfxOf(save); renderer.setPixelRatio(pixelRatioFor(+save.lowq || 0, g)); resize();
  const shadows = g === 'high' || (g === 'default' && !save.lowq);
  for (const d of Object.values(TRACK_DEFS)) if (d.world) {
    const sun = d.world.sun, size = g === 'high' ? 2048 : 1024, box = g === 'high' ? 24 : 15; sun.castShadow = shadows;
    if (sun.shadow.mapSize.x !== size || sun.shadow.camera.right !== box) { sun.shadow.mapSize.set(size, size); Object.assign(sun.shadow.camera, { left: -box, right: box, top: box, bottom: -box }); sun.shadow.camera.updateProjectionMatrix(); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    if (d.world.lampPool) d.world.lampPool.forEach((l, i) => { l.castShadow = g === 'high' && i < 2; });
    if (d.world.hemi && d.world.hemi0 !== undefined) d.world.hemi.intensity = g === 'low' && d.world.lampPool ? d.world.hemi0 * 1.9 : d.world.hemi0;   // (no lantern lights on LOW: the cave gets more ambient light)
  }
  if (SHOW.scene) { const sh = SHOW.scene.children.find((o) => o.isDirectionalLight && o.castShadow !== undefined); if (sh) sh.castShadow = g !== 'low'; }
}
// the lanterns: the pool of lights moves to the lanterns nearest the player (every few frames)
// the standings column on the HUD: every racer's portrait in race order, yours ringed in gold
function drawStandings() {
  const el2 = $('standings'); if (!el2 || !race) return;
  el2.style.visibility = race.formation ? 'hidden' : '';   // (v184, the user) hidden on the formation lap: the gate questions sit up there
  const order = ranking(), key = order.map((r) => r.ch.id).join(); if (el2.dataset.k === key) return; el2.dataset.k = key;
  el2.innerHTML = order.map((r, i) => `<div class="st${r.player ? ' me' : ''}"><b>${i + 1}</b><span class="face" style="${faceStyle(r.ch)}"></span></div>`).join('');
}
function updateLamps() {
  const W = WORLD; if (!W.lampPool || !race || !race.player) return; if ((race.lampF = (race.lampF || 0) + 1) % 5) return;
  const P = race.player, n = { low: 0, default: 4, high: 6 }[gfxOf(save)];
  if (W.glowPts) { const near = W.glowPts.map((g) => [g, (g.x - P.x) ** 2 + (g.z - P.z) ** 2]).sort((a, b) => a[1] - b[1]);
    W.lampPool.forEach((l, i) => { const g = i < n && near[i] && near[i][0]; if (g) { l.position.set(g.x, g.y, g.z); l.color.set(g.c); l.intensity = g.i; l.distance = g.d; } else l.intensity = 0; }); return; }
  const near = W.lanternPos.map((v) => [v, (v.x - P.x) ** 2 + (v.z - P.z) ** 2]).sort((a, b) => a[1] - b[1]);
  W.lampPool.forEach((l, i) => { if (i < n && near[i]) { l.position.copy(near[i][0]); l.intensity = 42; } else l.intensity = 0; });
}
const PAD = .42;   // phone mode: the bottom 42% of the screen is the control pad
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false);
  // phone mode, upright, racing: the picture is drawn only above the pad (the pad covers the rest)
  const top = h;   // (v117: the phone pad is see-through now, so the game fills the screen)
  if (top !== h) { renderer.setViewport(0, h - top, w, top); renderer.setScissor(0, h - top, w, top); renderer.setScissorTest(true); } else renderer.setScissorTest(false);
  if (WORLD && WORLD.camera) { WORLD.camera.aspect = w / top; WORLD.camera.updateProjectionMatrix(); }
  if (SHOW.camera) { SHOW.camera.aspect = w / h; SHOW.camera.updateProjectionMatrix(); }
  SHOW.zoom = parseFloat(getComputedStyle($('menu')).zoom) || 1;   // big screens draw the menu larger (CSS zoom)
}
addEventListener('resize', () => resize());

let last = performance.now();
function loop(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  window.FK.frames = (window.FK.frames || 0) + 1; window.FK.screen = screen;
  pollPad(dt);
  if (screen === 'race') updateRace(dt);
  else if (screen === 'podium' || screen === 'results') updatePodium(dt);
  else if (screen === 'menu' || screen === 'garage') updateShowroom(dt);
  requestAnimationFrame(loop);
}

/* ---------- start the game ---------- */
window.FK = { auto: false, answer: null, steer: STEER };   // (steer: the v251 steering feel, to tune live)          // test hooks: an autopilot and auto-answers (left off for players)
// test hook: a photo of the showroom racer from any angle
window.FK.renderer = renderer; window.FK.world = () => WORLD; window.FK.start = (id) => startRace(id); window.FK.THREE = THREE;
window.FK.char = (id) => { save.char = id; setShowRacer(); };
window.FK.SHOW = SHOW;
window.FK.quizViewY = (v) => { if (v != null) QUIZ_VIEWY = +v; return QUIZ_VIEWY; };   // (v275) test hook: the quiz picture's slide on upright phones
window.FK.track = () => TRACK; window.FK.half = () => HALF; window.FK.at = (d, l = 0) => at(d, l);   // test hooks: the track and a point on it
window.FK.ask = (secs = 30) => race && !race.dialog && askOne('jump', `${ico('icon-jump', 'tico')} JUMP QUESTION!`, secs, () => {});   // test hook: a race question now
// test hook: nudge how an official character sits (FK.fit('rob', { s: 1.2, helm: { r: .42 } }))
window.FK.fit = (id, patch) => { const f = CHAR_FIT[id]; if (patch.helm) { Object.assign(f.helm, patch.helm); delete patch.helm; } Object.assign(f, patch); driverCache.clear(); kartCache.clear(); setShowRacer(); return f; };
window.FK.CHAR_FIT = CHAR_FIT;
window.FK.foxFit = (patch) => { if (patch) { if (patch.pose) FOX_FIT.pose = { ...FOX_FIT.pose, ...patch.pose }; if (patch.s) FOX_FIT.s = patch.s; if (patch.seat) FOX_FIT.seat = patch.seat; BASE.foxBaked = null; driverCache.clear(); try { setShowRacer(); } catch (e) {} } const r = foxBaked(); return r && { reach: r.reach, S: r.S, seat: FOX_FIT.seat, pose: FOX_FIT.pose }; };   // (test hook: tune the player's Foxino live)
window.FK.racerModel = (id, player = false, ship = false) => { const ch = charById(id); return makeRacerModel(ch, ch.color, ch.sticker || 'none', player, null, ship); };   // (test hook: one racer, for close-ups)
window.FK.ENV = () => ENV;
window.FK.rival = (patch) => { if (patch) { if (patch.pose) RIVAL_FIT.pose = { ...(RIVAL_FIT.pose || {}), ...patch.pose }; if (patch.s) RIVAL_FIT.s = patch.s; if (patch.seat) RIVAL_FIT.seat = patch.seat; BASE.rivalBaked = null; driverCache.clear(); } const r = rivalBaked(); return r && { reach: r.reach, S: r.S, seat: RIVAL_FIT.seat, pose: { ...DRIVER_POSE, ...(RIVAL_FIT.pose || {}) }, wheel: wheelInKart() && { c: wheelInKart().c.toArray(), a: wheelInKart().a.toArray(), Rc: wheelInKart().Rc } }; };   // (test hook: tune the rivals' driver live)
window.FK.goTracks = () => goTracks();
window.FK.podium = (p = 1) => race && showResults(p);   // test hook: jump to the end-of-race podium
window.FK.pass = (nuts) => { if (nuts != null) { save.pass = { nuts }; store(); refreshCounters(); } return passOf(); };   // test hook: set the Game Pass nuts
window.FK.goPass = () => goPass();
window.FK.goLicence = () => goLicence();
window.FK.g3p = G3P; window.FK.g3 = G3; window.FK.goGarage = () => goGarage();   // (v228) the garage camera, to tune
window.FK.routes = (seq) => { if (seq && race) { race.routeSeq = seq; if (WORLD) WORLD.routeShown = -1; } return TRACK && TRACK.routes ? { seq: race && race.routeSeq, mine: race && race.player && race.player.route, now: routeFor(), sec: { i0: TRACK.sec.i0, i1: TRACK.sec.i1, lens: TRACK.sec.lens, names: TRACK.sec.spec.map((x) => x.name), stats: TRACK.sec.stats } } : null; };   // (v194) test hook   // test hooks: the licence, and set the wins on maps
window.FK.wins = (o) => { if (o) { save.winsBy = { ...(save.winsBy || {}), ...o }; store(); } return save.winsBy; };
window.FK.intro = () => runIntro();   // test hook   (v286: the test drive is gone, so no FK.tutorial)
window.FK.crates = (c) => { if (c) { save.crates = { ...crates(), ...c }; store(); } return { crates: crates(), paints: save.kart.bodiesOwned.length, tyres: tyreOwned() }; };   // test hook
window.FK.openCrate = (k) => openCrate(k);
window.FK.equipTyre = (id) => { if (!tyreOwned().includes(id)) tyreOwned().push(id); equipPrize({ kind: "tyre", id }); };   // test hook   // test hook: the track picker
// test hooks for the pit stop and the pit lane
window.FK.pitArm = () => { if (race) { race.pitDue = true; drawPitHud(); } return window.FK.pitInfo(); };
window.FK.crew = () => { const C = WORLD && WORLD.crew; return C && { on: C.on, phase: C.phase, lift: +C.lift.toFixed(2), men: C.men.map((m) => [m.role, +m.pos.x.toFixed(2), +m.pos.z.toFixed(2)]) }; };   // test hook
window.FK.pitNow = () => { if (race && !race.dialog) pitStop(); };
window.FK.tyreLv = (lv, fx = false) => { if (race && lv != null) setTyre(race.player, lv, fx); return race && race.player.model.tyreLv; };   // (v274) test hook
window.FK.tyre = (cells) => { if (cells) { for (const lod of ['hi', 'lo']) Object.assign(TYRE_CELLS[lod], cells[lod] || {}); BASE.tyre = buildTyreLods(BASE.tyreSrc); setShowRacer(); } return BASE.tyre && { hi: BASE.tyre.hiTris, lo: BASE.tyre.loTris, cells: TYRE_CELLS }; };   // test hook
window.FK.garage = () => { const GP = WORLD && WORLD.garagePaint; return GP && { col: GP.col.length, tex: GP.tex.length, bays: race ? race.racers.map((r) => r.ch.id + ':' + (GARAGE_COL[r.ch.id] || '?')) : null }; };   // test hook
window.FK.pitBox = (st = '') => { pitBoxState(st); return WORLD.pitBay && WORLD.pitBay.state; };   // test hook: the box's colour
window.FK.toPit = (back = 8) => {
  const P = race.player, B = WORLD.pitBay; if (!B) return null;
  const s = (B.s != null ? B.s : ((B.ds % TRACK.L) + TRACK.L) % TRACK.L) - back;
  const lat = B.u != null ? B.u * PITS.side : B.lat, q = at(s, lat);
  P.x = q.x; P.z = q.z; P.y = q.y; P.speed = 16; P.angle = angleOf(q.p); P.air = null; P.spinT = P.slideT = 0; project(P);
  return window.FK.pitInfo();
};
// put the kart anywhere along the lane (ds from the finish line, u out from the centre line)
window.FK.toLane = (ds, u, v = 20) => {
  const P = race.player, q = at(((ds % TRACK.L) + TRACK.L) % TRACK.L, u * (PITS ? PITS.side : -1));
  P.x = q.x; P.z = q.z; P.y = q.y; P.speed = v; P.angle = angleOf(q.p); P.air = null; P.spinT = P.slideT = 0; project(P);
  return window.FK.pitInfo();
};
window.FK.pitInfo = () => {
  if (!race) return null; const P = race.player, B = WORLD.pitBay;
  const ds = PITS ? dsOf(P.sc) : null, e = PITS ? pitEdges(ds) : null;
  return { lap: P.lap, laps: TUNE.laps, due: !!race.pitDue, brake: !!race.pitBrake, hold: !!race.pitHold, dialog: race.dialog,
    slow: +race.slow.toFixed(2), speed: +P.speed.toFixed(1), u: +(P.lat * (PITS ? PITS.side : 1)).toFixed(2), ds: ds == null ? null : +ds.toFixed(1),
    inPit: !!P.inPit, lane: e ? [+e[0].toFixed(1), +e[1].toFixed(1)] : null, bayAhead: B ? +bayAhead(P).toFixed(1) : null,
    fix: P.fix || 0, spd: P.spd || 0, imm: P.imm || 0, jumps: jumpCount(),
    rivals: race.racers.filter((r) => !r.player).map((r) => ({ lap: r.lap, p: !!r.pitting, w: !!r.wantPit, u: +(r.lat * (PITS ? PITS.side : 1)).toFixed(1), stood: !!r.pitStood, sent: r.pitLap || 0, hold: +(r.pitHoldT || 0).toFixed(1) })) };
};
// (v292) test hook: for every map, how much the road turns at each jump and in the 70 m after it (the flight + landing)
window.FK.rampCheck = (old) => TRACK_ORDER.map((id) => {
  const d = TRACK_DEFS[id], keep = { TRACK, TB, BOUNDS, MID, BUSY, RAMP_AT, PAD_AT, GATE_AT, PIT_AT, HALF }; d.prep = null; const pr = prepTrack(d);
  const RS = TRACK.routes || [TRACK.pts], b0 = TRACK.pts;
  const res = (old && old[id] || pr.RAMP_AT).map((f) => { const s = f * TRACK.L; return { f: +f.toFixed(3), drift: RS.map((R) => { TRACK.pts = R; const w = +rampDrift(s).toFixed(1); TRACK.pts = b0; return w; }), turn: RS.map((R) => { TRACK.pts = R; const w = +rampTurn(s).toFixed(2); TRACK.pts = b0; return w; }) }; });
  ({ TRACK, TB, BOUNDS, MID, BUSY, RAMP_AT, PAD_AT, GATE_AT, PIT_AT, HALF } = keep); return { id, L: Math.round(pr.TRACK.L), ramps: res };
});
window.FK.bendAt = (s) => bendAt(s);   // (v293) test hook
window.FK.P = () => race && race.player;   // (v293) test hook: your racer (the action camera tests)
window.FK.BASE = BASE;
// test hook: why the steering mode is what it is
// test hook: hold an imaginary finger across the race picture (-1 left … +1 right), null to let go
window.FK.follow = (x) => { FOLLOW.x = x; FOLLOW.held = x == null ? null : 'test'; };
window.FK.ctl = () => ({ CTL, want: steerWant(), TOUCH, gamepad: GPAD.on, stickHeld: STICK.held, followHeld: FOLLOW.held, followX: FOLLOW.x, wheelRot: +WHEEL.rot.toFixed(1), steerL: save.steerL, steerP: save.steerP, portrait: isPortrait() });
applyOrient();
// test hook: run n race frames by hand (works even when the page is hidden and its own frame loop is paused)
window.FK.step = (n = 60, dt = 1 / 30) => { for (let i = 0; i < n && race; i++) updateRace(dt); return race && { t: race.raceTime.toFixed(1), lap: race.player.lap, place: ranking().indexOf(race.player) + 1, items: race.item, traps: race.traps.length, dialog: !!race.dialog }; };
window.FK.endNow = () => { const P = race.player; P.lap = TUNE.laps + 1; P.finished = true; P.finishTime = race.raceTime; if (!race.party) P.doneR = resClock(); finish(); };
// test hook: render the lobby (or, in a race, the track) from any point looking at any point
window.FK.showRoute = (r) => { const W = WORLD; if (!W || !W.routeGroups) return null; W.routeGroups.forEach((g, i) => { g.visible = i === r; }); TRACK.pts = TRACK.routes[r]; const { i0, i1 } = TRACK.sec, P = TRACK.routes[r]; return { i0, i1, N: TRACK.N, pts: P.slice(i0 - 30, i1 + 30).filter((_, k) => k % 6 === 0).map((q) => [+q.x.toFixed(1), +q.y.toFixed(1), +q.z.toFixed(1), +q.tx.toFixed(3), +q.tz.toFixed(3)]) }; };   // (v199) test hook
window.FK.look = (px, py, pz, lx, ly, lz) => { screen = 'shot'; const sc = race && WORLD ? WORLD.scene : SHOW.scene, c = race && WORLD ? WORLD.camera : SHOW.camera; c.clearViewOffset(); c.position.set(px, py, pz); c.up.set(0, 1, 0); c.lookAt(lx, ly, lz); c.updateProjectionMatrix(); renderer.render(sc, c); };
window.FK.shot = (yaw, dist, y, lookY) => {
  screen = 'shot'; SHOW.turn.rotation.y = 0; const c = SHOW.camera; c.clearViewOffset();
  c.position.set(Math.sin(yaw) * dist, y, Math.cos(yaw) * dist); c.lookAt(0, lookY, 0); renderer.render(SHOW.scene, c);
};
// (v269) THE DEBUG HUB: what kart/debug.js may read and call. It is loaded only when the hub is on for this device
// (?debug), or opened from Settings → GAME (shown when it is on, or for the dev account) or with the ` key.
const DBG_API = {
  VER: new URL(import.meta.url).searchParams.get('v') || '?', SAVE_KEY, L, PACKS, TUNE, STEER, LAPS0, PIT_LAPS0, TRACK_DEFS, TRACK_ORDER, ROUTE_VARIANTS, GROUND_VARIANTS,
  STEER_NAME, UPGRADES, KART_MAX, TYRE_STYLES, MAP_NEED, ITEMS, BODY_COLORS, LIGHT_COLORS, LOGOS, DEFAULT_SKIN, WHEEL, STICK, FOLLOW, GPAD, renderer, TOUCH,
  save: () => save, store, race: () => race, screen: () => screen, TDEF: () => TDEF, TRACK: () => TRACK, CTL: () => CTL, steerWant, tilt: () => tiltG,
  DEV, isDevAcct, toast, refreshCounters, applyGfx, applySide, gfxOf, resize, upsOf, vehLv, paintPool, tyreOwned, crates, setShowRacer, passOf, enableTilt,
  goMenu, goGarage, goTracks, goPass, goLicence, runIntro, startRace, openCrate, showResults, pauseMenu, hidePodium, closeDialog,
  pitStop, drawPitHud, drawSlot, lapDone, lapPill, ranking, askOne, ico, at, angleOf, project, placeAll, snapCamera, giveBoost,
  REAR_WINGS, wingLv: () => (race && race.player && race.player.model && race.player.model.wingLv) || 0, setWing: (lv) => (race ? setWing(race.player, lv, false) : false),   // (v270)
  TYRE_LEVELS: TYRE_LEVELS.map((id) => TYRE_BY_ID[id].name), tyreLv: () => (race && race.player && race.player.model && race.player.model.tyreLv) || 0, setTyre: (lv) => (race ? setTyre(race.player, lv, false) : false),   // (v274)
  resume: () => { if (!race) return; closeDialog(); race.dialog = null; race.slowTarget = 1; if (race.started && !race.ended) Music.start(); },
  leaveRace: () => { if (race) { closeDialog(); cup = null; endRace(); } },
};
let dbgMod = null;
const loadDebug = () => (dbgMod = dbgMod || import('./debug.js?v=5').then((m) => { m.init(DBG_API); return m; }).catch((e) => { dbgMod = null; console.error('debug hub', e); throw e; }));
window.FK.debug = (tab) => loadDebug().then((m) => m.open(tab));
if (dbgOn()) loadDebug();
addEventListener('keydown', (e) => { if (e.key === '`' && (dbgOn() || isDevAcct()) && !(e.target && e.target.closest && e.target.closest('input, textarea'))) { e.preventDefault(); loadDebug().then((m) => m.toggle()); } });
addEventListener('pointerdown', () => { Snd.init(); L.setAudio(Snd.ctx); L.unlock(); }, { once: true });
// (v141) turning the phone mid-race no longer pauses: the layout just follows it.
// switching to another app: pause the race and silence everything; sound comes back when the game is visible again
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (screen === 'race' && race && race.started && !race.ended && !race.dialog) pauseMenu();
    if (Snd.ctx && Snd.ctx.state === 'running') Snd.ctx.suspend();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  } else if (Snd.ctx && Snd.ctx.state === 'suspended') Snd.ctx.resume();
});
(async () => {
  const bar = $('loadBar'), lt = $('loadT'), nut = document.querySelector('.ldnut'), pc = $('loadPct'), show = (p) => { p = Math.round(p); window.__ldReal = Date.now(); if (window.__ldShow) return window.__ldShow(p); bar.style.width = p + '%'; { const L0 = document.getElementById('loading'); if (L0) L0.style.setProperty('--p', p); }   /* (v249) the loading circle */ if (nut) nut.style.left = p + '%'; if (pc) pc.textContent = p + '%'; }, step = async (p, msg) => { show(p); lt.textContent = msg; await wait(30); };   // (v171: the nut rides the bar, the percentage beside it)   (v266: show() also feeds the page's stall watchdog)
  LDP.on = (f) => show(10 + f * 34);
  try {
    await step(10, 'Building Foxino…'); await loadFoxino(); buildBase();
    await step(45, 'Painting the karts…'); for (const ch of CHARACTERS) { driverBody(ch); if (!BASE.dk) kartBody(ch.color); } if (!BASE.dk) kartBody(save.kart.color);
    await step(70, 'Building the Alps…'); buildShowroom();
    await step(90, 'Taking photos…'); resize(); renderFaces();
    resize();
    await step(100, 'Ready!');
    if (!save.introDone && !save.races && !DEV() && !/[?&]nointro/.test(location.search)) runIntro(); else { if (!save.introDone) { save.introDone = true; store(); } goMenu(); }   // (v172) the first open: the story first
    $('loading').style.opacity = 0; setTimeout(() => $('loading').remove(), 500);
    window.FK.ready = true; LDP.on = null; requestAnimationFrame(loop); setTimeout(() => upgradeAssets().catch((e) => console.warn('upgrade', e)), 1200);
  } catch (e) { lt.textContent = 'Oops: ' + e.message; console.error(e); if (window.__ldFail) window.__ldFail(e.message); }
})();
