/* FoxKarts DEBUG HUB (v269) — for developers and testers.
   game.js loads this file only on a device where the hub is on (?debug turns it on and remembers it, ?debug=0 turns it
   off), or when it is opened by hand (Settings → GAME → DEBUG HUB, shown when the hub is on or for the dev account, or
   the ` key). Players who never use ?debug never load it.
   Everything set here is remembered on this device (localStorage 'foxkarts-debug': { on, ov, tab }) and put back at
   start-up. ov holds only the values that differ from the game's defaults; while it is not empty the bug button shows a
   red DEBUG tag, so a tester always knows the game is not standard. Game settings that already live in the save (dev
   mode, steering mode, assist, quality, English level, packages, coins, kart level…) are changed in the save itself.
   It never imports three: everything goes through the API object game.js hands to init() (DBG_API). */
const KEY = 'foxkarts-debug', HUB_V = 2;
let G = null, FK = null, root = null, bug = null, ovl = null, pausedBy = null, confirmAsk = null, note = '', tDbg = null, tSave = '';   // (the two text boxes keep what was typed or pasted across redraws)
let st = { on: true, ov: {}, tab: 'jump', jmap: 'alps', jroute: -1 };
const once = { skip: false, noSkip: false, route: null };
const D = {};   // the game's own values, read before any override is put on
const TABS = [['jump', 'JUMP TO'], ['questions', 'QUESTIONS'], ['race', 'RACE'], ['steering', 'STEERING'], ['kart', 'KART'], ['graphics', 'GRAPHICS'], ['save', 'SAVE / SHARE']];
const OTHER = { answer: 'off', auto: false, timeScale: 1, skipGarage: false, laps: 0, pitLaps: null, rivals: 4, aiMul: 1, route: -1, pr: 0, overlay: false, oldQ: false, driftMul: 1, turboLen: 1 };
const clone = (v) => (v == null || typeof v !== 'object' ? v : JSON.parse(JSON.stringify(v)));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await wait(100); } return null; };
const show = (k, v, unit = '') => (k === 'laps' && !v ? 'MAP' : fmt(v) + unit);
const fmt = (v) => (typeof v === 'number' ? (Math.abs(v) >= 100 || Number.isInteger(v) ? String(Math.round(v * 100) / 100) : String(+v.toFixed(3))) : String(v));

/* ---------- the stored overrides ---------- */
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
const defOf = (k) => (k.startsWith('TUNE.') ? D.TUNE[k.slice(5)] : k.startsWith('STEER.') ? D.STEER[k.slice(6)] : OTHER[k]);
const get = (k) => (k in st.ov ? st.ov[k] : clone(defOf(k)));
function set(k, v) {
  if (same(v, defOf(k))) delete st.ov[k]; else st.ov[k] = clone(v);
  persist(); apply(k); badge();
}
// the map's own laps and pit laps (what useTrack set before the hub changes them)
const mapLaps = () => { const T = G.TDEF(); return (T && T.laps) || G.LAPS0; };
const mapPits = () => { const T = G.TDEF(); return T ? T.pitLaps || (T.pitEvery ? null : G.PIT_LAPS0) : G.PIT_LAPS0; };
function applyLaps() {
  G.TUNE.laps = get('laps') || mapLaps();
  const pl = get('pitLaps'); G.TUNE.pitLaps = pl == null ? clone(mapPits()) : pl.slice();
  if (G.race()) G.lapPill();
}
function apply(k) {
  const v = get(k), R = G.race();
  if (k.startsWith('TUNE.')) { G.TUNE[k.slice(5)] = clone(v); return; }
  if (k.startsWith('STEER.')) { G.STEER[k.slice(6)] = v; return; }
  switch (k) {
    case 'answer': FK.answer = v === 'off' ? null : v; break;
    case 'auto': FK.auto = !!v; break;
    case 'timeScale': FK.timeScale = v; break;
    case 'laps': case 'pitLaps': applyLaps(); break;
    case 'rivals': FK.rivals = v >= 4 ? null : v; break;
    case 'aiMul': G.TUNE.aiSkill = D.ai.map((x) => x * v); if (R) for (const r of R.racers) if (!r.player && r.dbgSk0) r.skill = r.dbgSk0 * v; break;
    case 'route': if (R && R.routeSeq && v >= 0) FK.routes(R.routeSeq.map(() => v)); break;
    case 'pr': if ((FK.pr || 0) !== (v || 0)) { FK.pr = v || 0; G.applyGfx(); } break;
    case 'overlay': overlay(!!v); break;
    case 'oldQ': for (const id of G.TRACK_ORDER) G.TRACK_DEFS[id].pitOnly = v ? false : D.pitOnly[id]; break;
    case 'driftMul': G.TUNE.driftAfter = D.TUNE.driftAfter.map((x) => x * v); break;
    case 'turboLen': G.TUNE.turboTime = D.TUNE.turboTime.map((x) => x * v); break;
  }
}
// every value the hub can change, put back to its override or the game default (the TUNE / STEER ones first: OTHER fixes laps, rivals' speed, drift)
const applyAll = () => { for (const k of [...Object.keys(D.TUNE).filter((x) => !['laps', 'pitLaps', 'pitEvery'].includes(x)).map((x) => 'TUNE.' + x), ...Object.keys(D.STEER).map((x) => 'STEER.' + x), ...Object.keys(OTHER)]) apply(k); };

/* ---------- the game's settings kept in its save ---------- */
const SV = {
  'save.dev': [() => !!G.save().dev, (v) => { G.save().dev = v; G.refreshCounters(); }],
  'save.assistLvl': [() => G.save().assistLvl ?? 1, (v) => { G.save().assistLvl = v; }],
  'save.steerL': [() => G.save().steerL || 'line', async (v) => { if (v === 'tilt' && !(await G.enableTilt())) { G.toast('Tilt is not available here', '#ffb0b8', 24); return; } if (v === 'tilt') G.save().tilt = true; G.save().steerL = v; }],
  'save.steerP': [() => G.save().steerP || 'line', (v) => { G.save().steerP = v; }],
  'save.ctlSide': [() => (G.save().ctlSide === 'right' ? 'right' : 'left'), (v) => { G.save().ctlSide = v; G.applySide(); }],
  'save.gfx': [() => G.gfxOf(G.save()), (v) => { G.save().gfx = v; G.save().lowq = 0; G.applyGfx(); }],
  'learn.lv': [() => G.L.level(), (v) => { const s = G.save(); s.learn.lv = v; s.learn.hist = []; }],
};
const val = (k) => (SV[k] ? SV[k][0]() : get(k));
async function setVal(k, v) { if (SV[k]) { await SV[k][1](v); G.store(); badge(); } else set(k, v); }

/* ---------- hooks game.js calls ---------- */
function onTrack() { applyLaps(); }
function onRace(R) {
  FK.skipGarage = once.noSkip ? false : !!get('skipGarage') || once.skip;
  const rv = once.route != null ? once.route : get('route');
  if (rv >= 0 && R.routeSeq && G.TRACK().routes && rv < G.TRACK().routes.length) R.routeSeq = R.routeSeq.map(() => rv);
  for (const r of R.racers) if (!r.player) r.dbgSk0 = r.skill / (get('aiMul') || 1);
  if (FK.skipGarage) R.introT = Math.min(R.introT, .6);
  once.skip = false; once.noSkip = false; once.route = null;
}

/* ---------- jumps ---------- */
function forceQ(ms = 90000) {   // one set of questions even in dev mode; off again when the questions are over
  FK.forceQ = true; const t0 = Date.now(); let seen = false;
  const tick = () => { const R = G.race(), d = R && R.dialog && R.dialog !== true; if (d) seen = true; if ((seen && !d) || Date.now() - t0 > ms || (!R && seen)) { FK.forceQ = false; return; } setTimeout(tick, 200); };
  setTimeout(tick, 200);
}
function leaveAll() {
  for (const id of ['setp', 'quiz', 'pass', 'crate', 'tracks']) { const e = document.getElementById(id); if (e && !e.hidden) { e.hidden = true; if (id !== 'crate') e.innerHTML = ''; } }   // (a crate keeps its reveal: its timers still fill it in)
  const I = document.getElementById('intro'); if (I) { I.hidden = true; I.innerHTML = ''; I.className = ''; } document.body.classList.remove('intro');
  const B = document.getElementById('blackout'); if (B) B.classList.remove('on');
  G.leaveRace(); G.closeDialog(); G.hidePodium();
}
async function startOn(map, { skip = false, noSkip = false, route = null } = {}) {
  close(); leaveAll(); once.skip = skip; once.noSkip = noSkip; once.route = route;
  G.startRace(map || st.jmap);
  return until(() => G.race());
}
// a race that is running (lights out, nothing on screen): this one, or a new one on the jump map (garage start skipped)
async function running() {
  let R = G.race();
  if (R && R.started && !R.ended && (!R.dialog || R.dialog === true) && G.screen() === 'race') { close(); if (R.dialog === true) G.resume(); return R; }
  await startOn(st.jmap, { skip: true, route: st.jroute >= 0 ? st.jroute : null });
  R = await until(() => { const r = G.race(); return r && r.started && !r.dialog ? r : null; }, 90000);
  if (!R) G.toast('DEBUG: the race did not start', '#ff8a8a', 26);
  return R;
}
async function pitNow() {
  const R = await running(); if (!R) return;
  forceQ(); if (FK.toPit) FK.toPit(8); FK.pitArm(); FK.pitNow();
}
async function finalLap() {
  const R = await running(); if (!R) return;
  for (const r of R.racers) r.lap = Math.max(r.lap, G.TUNE.laps); R.pitDue = false; G.lapPill(); G.drawPitHud();
  G.toast('FINAL LAP (debug)', '#ffe14a', 34);
}
async function finishQs() {
  const R = await running(); if (!R) return;
  for (const r of R.racers) if (!r.player) r.lap = Math.max(r.lap, G.TUNE.laps);
  const P = R.player; forceQ(); P.lap = G.TUNE.laps + 1; G.lapDone(P);
}
async function podium(p) {
  const R = await running(); if (!R) return;
  const me = R.player, order = R.racers.filter((r) => !r.player); p = Math.max(1, Math.min(R.racers.length, p)); order.splice(p - 1, 0, me);
  const t = R.raceTime; R.finQuiz = false;
  order.forEach((r, i) => { r.finished = true; r.lap = G.TUNE.laps + 1; r.finishTime = t + i; r.doneR = t + i * 1.5; r.quizT = 0; });
  R.ended = true; R.dialog = null; G.closeDialog(); G.showResults(p);
}
async function lobbyThen(fn) { close(); leaveAll(); G.goMenu(); if (fn) { await wait(30); fn(); } }
const JUMPS = {
  lobby: () => lobbyThen(),
  garage: () => lobbyThen(() => G.goGarage()),
  tracks: () => lobbyThen(() => G.goTracks()),
  pass: () => lobbyThen(() => G.goPass()),
  licence: () => lobbyThen(() => G.goLicence()),
  intro: () => { close(); leaveAll(); G.runIntro(); },
  tutorial: () => lobbyThen(() => G.startTutorial()),
  crate: async (k) => { await until(() => !document.querySelector('#crate .crcard[hidden]'), 3000); return lobbyThen(() => { const N = G.crates(); if (!(N[k] > 0)) { N[k] = 1; G.store(); } G.openCrate(k); }); },   // (after an earlier crate's reveal is through: its timers look its buttons up by id)
  garageStart: () => { forceQ(); return startOn(st.jmap, { noSkip: true, route: st.jroute >= 0 ? st.jroute : null }); },
  race: () => startOn(st.jmap, { route: st.jroute >= 0 ? st.jroute : null }),
  raceSkip: () => startOn(st.jmap, { skip: true, route: st.jroute >= 0 ? st.jroute : null }),
  pit: pitNow, finalLap, finishQs, podium: (p) => podium(+p),
};

/* ---------- in-race actions ---------- */
const inRace = () => { const R = G.race(); return R && G.screen() === 'race' && !R.ended ? R : null; };
const ACT = {
  ask: async () => { const R = await running(); if (R) FK.ask(30); },
  giveItem: (t) => { const R = inRace(); if (!R) return needRace(); R.rolling = false; R.item = { type: t, strong: true }; G.drawSlot(); G.toast(`DEBUG: ${t.toUpperCase()}`, '#ffe14a', 26); },
  imm: () => { const R = inRace(); if (!R) return needRace(); R.player.imm = G.TUNE.maxImmune; G.drawPitHud(); G.toast(`DEBUG: ${G.TUNE.maxImmune} puddle shields`, '#59d8ff', 26); },
  coinsRace: () => { const R = inRace(); if (!R) return needRace(); R.player.coins = G.TUNE.maxCoins; G.toast(`DEBUG: ${G.TUNE.maxCoins} race coins`, '#ffe14a', 26); },
  pitBonus: () => { const R = inRace(); if (!R) return needRace(); const P = R.player; P.spd = (P.spd || 0) + 3; P.fix = (P.fix || 0) + 3; G.drawPitHud(); G.toast('DEBUG: +3 speed +3 grip', '#ffe14a', 26); },
  boost: () => { const R = inRace(); if (!R) return needRace(); close(); G.giveBoost(R.player, 2, 1.5); },
  endNow: () => { const R = inRace(); if (!R || !R.started) return needRace(); close(); G.resume(); FK.endNow(); },
  restart: () => { const R = G.race(), id = G.TDEF() && G.TDEF().id; if (!R) return needRace(); startOn(id); },
  quit: () => JUMPS.lobby(),
  packs: async () => {
    if (!window.FugioPacks) return;
    root.hidden = true;
    const ids = await window.FugioPacks.open(G.PACKS, G.save().packs, { theme: 'dtm', kicker: 'CHOOSE THE ENGLISH TOPICS' });
    if (ids) { G.save().packs = ids; G.L.setPacks(G.PACKS, ids); G.store(); }
    root.hidden = false; render();
  },
  packsClear: () => { G.save().packs = []; G.L.setPacks(G.PACKS, []); G.store(); render(); },
  coins: (n) => { const s = G.save(); s.coins = n === '0' ? 0 : (s.coins || 0) + +n; G.store(); G.refreshCounters(); render(); },
  paints: () => { const K = G.save().kart; for (const c of [...G.paintPool().map((p) => p.id), ...G.BODY_COLORS.map((c) => c.color)]) if (!K.bodiesOwned.includes(c)) K.bodiesOwned.push(c);
    K.lightsOwned = K.lightsOwned || []; for (const c of G.LIGHT_COLORS) if (!K.lightsOwned.includes(c.color)) K.lightsOwned.push(c.color);
    K.logosOwned = K.logosOwned || []; for (const l of G.LOGOS) if (!K.logosOwned.includes(l.id)) K.logosOwned.push(l.id);
    G.store(); G.toast('DEBUG: every paint, light and logo', '#ffe14a', 26); render(); },
  tyres: () => { const own = G.tyreOwned(); for (const t of G.TYRE_STYLES) if (!own.includes(t.id)) own.push(t.id); G.store(); G.toast('DEBUG: every tyre', '#ffe14a', 26); render(); },
  crates3: () => { const N = G.crates(); N.paint = (N.paint || 0) + 3; N.tyre = (N.tyre || 0) + 3; G.store(); G.refreshCounters(); render(); },
  nuts: (n) => { FK.pass(n === '0' ? 0 : ((G.save().pass && G.save().pass.nuts) || 0) + +n); render(); },
  maps: (on) => { const s = G.save(); if (on === '1') s.mapPts = Math.max(s.mapPts || 0, G.MAP_NEED[G.MAP_NEED.length - 1]); else { s.mapPts = 0; s.mapsOpen = []; } G.store(); render(); },
  resetKart: () => {
    const s = G.save(), K = s.kart; K.skin = { ...G.DEFAULT_SKIN }; for (const veh of ['kart', 'ship']) { const U = G.upsOf(veh); for (const [k] of G.UPGRADES) U[k] = 0; U.lv = 0; }
    if (K.ship) K.ship = {}; G.store(); G.setShowRacer(); G.refreshCounters(); if (G.screen() === 'garage') G.goGarage(); G.toast('DEBUG: kart reset (level 1, default look)', '#ffe14a', 26); render();
  },
  steerReset: () => { for (const k of Object.keys(st.ov)) if (k.startsWith('STEER.') || k === 'TUNE.turn' || k === 'TUNE.handlingPerLevel') { delete st.ov[k]; apply(k); } persist(); badge(); render(); },
  tuneReset: () => { for (const k of KART_SL.map((x) => x[0])) if (k in st.ov) { delete st.ov[k]; apply(k); } persist(); badge(); render(); },
  lowq: () => { G.save().lowq = 0; G.store(); G.applyGfx(); render(); },
  copy: () => copyText(document.getElementById('dbgTxt').value),
  paste: () => { const t = document.getElementById('dbgTxt').value; try { pasteSettings(t); tDbg = null; note = 'Pasted settings applied.'; } catch (e) { note = 'Could not read that text: ' + e.message; } render(); },
  exportSave: () => { tSave = localStorage.getItem(G.SAVE_KEY) || '{}'; copyText(tSave); },
  ask2: (what) => { confirmAsk = what; render(); },
  no: () => { confirmAsk = null; render(); },
  yes: () => {
    const w = confirmAsk; confirmAsk = null;
    if (w === 'resetDbg') { for (const k of Object.keys(st.ov)) delete st.ov[k]; persist(); applyAll(); badge(); tDbg = null; note = 'Every debug setting is back to the game default.'; }
    if (w === 'resetSave') { try { localStorage.removeItem(G.SAVE_KEY); } catch (e) {} location.reload(); return; }
    if (w === 'importSave') { const t = tSave; try { const o = JSON.parse(t); if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('not a save'); localStorage.setItem(G.SAVE_KEY, JSON.stringify(o)); location.reload(); return; } catch (e) { note = 'Import failed: ' + e.message; } }
    if (w === 'hubOff') { st.on = false; persist(); close(); badge(); G.toast('Debug hub off on this device\n<small>overrides are kept but not used; ?debug turns it on</small>', '#ffe14a', 26); return; }
    render();
  },
};
function needRace() { G.toast('DEBUG: start a race first', '#ff8a8a', 24); }
function copyText(t) {
  const done = () => { note = 'Copied.'; render(); };
  try { if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(t).then(done, () => fallback()); return; } } catch (e) {}
  fallback();
  function fallback() { const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(a); a.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} a.remove(); note = ok ? 'Copied.' : 'Select the text and copy it by hand.'; render(); }
}

/* ---------- copy / paste the settings ---------- */
const SAVE_KEYS = ['save.dev', 'save.assistLvl', 'save.steerL', 'save.steerP', 'save.ctlSide', 'save.gfx', 'learn.lv'];
function settingsText() {
  const s = G.save(), o = { ov: st.ov, save: Object.fromEntries(SAVE_KEYS.map((k) => [k, val(k)])), packs: s.packs || [], kartLv: G.vehLv('kart') + 1, shipLv: G.vehLv('ship') + 1 };
  return `FoxKarts debug settings · game.js v${G.VER} · debug.js v${HUB_V} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}\n`
    + `device: ${innerWidth}×${innerHeight} @${devicePixelRatio} · ${G.TOUCH ? 'touch' : 'mouse'} · ${navigator.userAgent}\n`
    + JSON.stringify(o);
}
function pasteSettings(t) {
  const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b < a) throw new Error('no settings found');
  const o = JSON.parse(t.slice(a, b + 1)), ov = o.ov && typeof o.ov === 'object' ? o.ov : o;
  for (const k of Object.keys(st.ov)) delete st.ov[k];
  for (const [k, v] of Object.entries(ov)) if (k in OTHER || (k.startsWith('TUNE.') && k.slice(5) in D.TUNE) || (k.startsWith('STEER.') && k.slice(6) in D.STEER)) st.ov[k] = v;
  persist(); applyAll();
  if (o.save) for (const k of SAVE_KEYS) if (k in o.save && k !== 'save.steerL') SV[k][1](o.save[k]);
  if (o.save && o.save['save.steerL'] && o.save['save.steerL'] !== 'tilt') G.save().steerL = o.save['save.steerL'];
  if (Array.isArray(o.packs)) { const ids = o.packs.filter((id) => G.PACKS.some((p) => p.id === id)); G.save().packs = ids; G.L.setPacks(G.PACKS, ids); }
  G.store(); badge();
}

/* ---------- the panel ---------- */
const row = (title, help, ctl, col = false) => `<div class="srow${col ? ' col' : ''}"><div class="sl"><b>${title}</b>${help ? `<small>${help}</small>` : ''}</div>${ctl}</div>`;
const tog = (k) => `<button class="tog${val(k) ? ' on' : ''}" data-tk="${k}" aria-label="${k}"><i></i></button>`;
const seg = (k, opts, type = 'num', cols) => `<div class="seg dseg" data-k="${k}" data-type="${type}" style="grid-template-columns:repeat(${cols || opts.length},1fr)">${opts.map(([v, n]) => `<button data-v="${esc(JSON.stringify(v))}" class="${same(val(k), v) ? 'on' : ''}">${n}</button>`).join('')}</div>`;
const btn = (act, label, arg = '', cls = '') => `<button class="sbtn ${cls}" data-act="${act}" data-arg="${esc(arg)}">${label}</button>`;
const btns = (list) => `<div class="dbtns">${list.join('')}</div>`;
function slider([k, title, unit, min, max, step, help]) {
  const v = get(k), d = defOf(k), mod = k in st.ov;
  return `<div class="srow col dsl${mod ? ' mod' : ''}" data-k="${k}"><div class="dslh"><b>${title}</b><span><output>${show(k, v, unit)}</output><small>default ${show(k, d, unit)}</small>${mod ? `<button class="dre" data-act="unset" data-arg="${k}" aria-label="Reset">↺</button>` : ''}</span></div>${help ? `<small class="dhelp">${help}</small>` : ''}<input type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-unit="${unit}"></div>`;
}
const STEER_SL = [
  ['STEER.outExp', 'ALL · soft middle', '', .5, 3, .05, 'Wheel → steering curve: 1 = straight, higher = small turns of the wheel steer less (full lock still steers fully)'],
  ['STEER.lineMax', 'LINE · wheel at full push', '°', 30, 120, 1], ['STEER.lineExp', 'LINE · push curve', '', .5, 3, .05, 'Higher = a calmer middle'], ['STEER.lineRate', 'LINE · follow speed', '', 2, 30, .5],
  ['STEER.joyMax', 'JOYSTICK · wheel at full push', '°', 30, 120, 1], ['STEER.joyExp', 'JOYSTICK · push curve', '', .5, 3, .05], ['STEER.joyRate', 'JOYSTICK · follow speed', '', 2, 30, .5],
  ['STEER.tapMin', 'TAP SIDES · wheel on a tap', '°', 10, 90, 1], ['STEER.tapMax', 'TAP SIDES · wheel on a long hold', '°', 10, 110, 1], ['STEER.tapRate', 'TAP SIDES · follow speed', '', 1, 30, .5],
  ['STEER.keyRate', 'KEYS / ARROWS · turn-in speed', '', 1, 30, .5],
  ['STEER.tiltDead', 'TURN DEVICE · dead zone', '°', 0, 15, .5], ['STEER.tiltGain', 'TURN DEVICE · gain', '×', .5, 8, .1], ['STEER.tiltRate', 'TURN DEVICE · follow speed', '', 1, 30, .5],
  ['STEER.padExp', 'GAMEPAD · stick curve', '', .5, 3, .05],
  ['TUNE.turn', 'HANDLING · turn rate', '', 1, 6, .05, 'How fast the kart turns at full lock (× the driver and the kart level)'], ['TUNE.handlingPerLevel', 'HANDLING · per upgrade step', '', 0, .5, .01],
];
const KART_SL = [
  ['TUNE.baseSpeed', 'Top speed (no upgrades)', ' m/s', 10, 50, .5, 'm/s × 3.6 = km/h'], ['TUNE.accel', 'Acceleration', '', 5, 60, 1], ['TUNE.speedPerLevel', 'Top speed per upgrade step', '', 0, .1, .005],
  ['driftMul', 'Drift · spark charge time', '×', .25, 3, .05, 'Blue → orange → purple sparks: lower = quicker'], ['turboLen', 'Drift · turbo length', '×', .25, 3, .05], ['TUNE.turboMul', 'Drift · turbo power', '×', 1, 2.5, .05],
  ['TUNE.padMul', 'Boost pad power', '×', 1, 2.5, .05], ['TUNE.padTime', 'Boost pad length', ' s', .2, 3, .05],
  ['TUNE.coinSpeed', 'Speed per race coin', '', 0, .05, .001], ['TUNE.maxCoins', 'Race coins that count', '', 0, 30, 1],
  ['TUNE.pitSpeed', 'Pit SPEED answer bonus', '', 0, .1, .005], ['TUNE.pitFix', 'Pit MAINTENANCE answer bonus', '', 0, .3, .01], ['TUNE.pitWorn', 'Worn tyres (pit due) speed', '×', .5, 1, .01], ['TUNE.maxImmune', 'Puddle shields a racer can hold', '', 0, 10, 1],
];
const Q_SL = [
  ['TUNE.garageN', 'Garage start · questions per set', '', 1, 8, 1, 'Three sets (maintenance, speed, tyres) before the race'],
  ['TUNE.pitN', 'Pit stop · questions per set', '', 1, 6, 1, 'Three sets on each pit stop'],
  ['TUNE.pitSecs', 'Garage + pit · seconds per question', ' s', 1, 30, .5, 'A Starter gets 2 s more'],
  ['TUNE.finN', 'Finish line · questions', '', 0, 6, 1, '0 = none'],
  ['TUNE.finSecs', 'Finish line · seconds per question', ' s', 2, 30, .5, 'A Starter gets 3 s more'],
];
function page(t) {
  const s = G.save(), R = G.race(), maps = G.TRACK_ORDER, T = G.TRACK_DEFS;
  if (t === 'jump') {
    const vs = (T[st.jmap].routes && T[st.jmap].routes.set === 'ground' ? G.GROUND_VARIANTS : G.ROUTE_VARIANTS).map((x, i) => [i, x.name]);
    return row('Screens', 'Each one works from anywhere (a race is left first)', btns([btn('j', 'LOBBY', 'lobby'), btn('j', 'GARAGE', 'garage'), btn('j', 'TRACK PICKER', 'tracks'), btn('j', 'GAME PASS', 'pass'), btn('j', 'LICENCE', 'licence'), btn('j', 'PAINT CRATE', 'crate:paint'), btn('j', 'TYRE CRATE', 'crate:tyre'), btn('j', 'INTRO STORY', 'intro'), btn('j', 'TUTORIAL', 'tutorial')]), true)
      + row('Map for the race jumps', '', `<div class="seg dpick" data-pk="jmap" style="grid-template-columns:repeat(${maps.length},1fr)">${maps.map((id) => `<button data-v="${id}" class="${st.jmap === id ? 'on' : ''}">${T[id].name.split(' ')[0].toUpperCase()}</button>`).join('')}</div>`, true)
      + row('Road variant', 'Changes every lap normally; pick one to race it on every lap', `<div class="seg dpick dsmall" data-pk="jroute" style="grid-template-columns:repeat(4,1fr)">${[[-1, 'RANDOM'], ...vs].map(([i, n]) => `<button data-v="${i}" class="${st.jroute === i ? 'on' : ''}">${esc(n)}</button>`).join('')}</div>`, true)
      + row('Race', 'On the map above', btns([btn('j', 'GARAGE START (SET-UP QUESTIONS)', 'garageStart', 'gold'), btn('j', 'RACE (NORMAL START)', 'race'), btn('j', 'RACE, SKIP THE GARAGE', 'raceSkip')]), true)
      + row('Inside a race', 'Uses the race you are in, or starts one on the map above (garage skipped)', btns([btn('j', 'PIT STOP NOW', 'pit', 'gold'), btn('j', 'FINAL LAP', 'finalLap'), btn('j', 'FINISH QUESTIONS', 'finishQs', 'gold')]), true)
      + row('Podium', 'Ends the race in this place (counts as a real result: coins, map points)', btns([1, 2, 3, 4, 5].map((p) => btn('j', `${p}${['st', 'nd', 'rd', 'th', 'th'][p - 1].toUpperCase()}`, 'podium:' + p))), true)
      + (G.DEV() ? `<div class="dnote">Dev mode is on: the jumps above still show the questions once (the hub forces them).</div>` : '');
  }
  if (t === 'questions') {
    const ids = s.packs || [], names = G.PACKS.filter((p) => ids.includes(p.id)).map((p) => p.title);
    return row('Questions', 'Off = DEV MODE: no questions anywhere and unlimited coins', `<button class="tog${!G.DEV() ? ' on' : ''}" data-act="devq" aria-label="Questions"><i></i></button>`)
      + row('Auto-answer', 'Answers every question by itself (LATE lets the clock run out)', seg('answer', [['off', 'OFF'], ['right', 'RIGHT'], ['wrong', 'WRONG'], ['late', 'LATE']], 'str'), true)
      + row('English level', 'Also changes by itself as the child answers', seg('learn.lv', G.L.LEVEL_NAMES.map((n, i) => [i, n.toUpperCase()])), true)
      + row('Packages', ids.length ? `${ids.length} chosen: ${esc(names.slice(0, 4).join(' · '))}${names.length > 4 ? ' …' : ''}` : "None: the game's own mix", btns([btn('act', 'CHOOSE', 'packs'), ids.length ? btn('act', 'CLEAR', 'packsClear') : '']))
      + Q_SL.map(slider).join('')
      + row('Old jump + lap questions', 'Every map is pit-only since v170 (no jump or lap questions). On = bring them back to test them (a question on each of the 4 jumps a lap and at each lap line)', tog('oldQ'))
      + row('Now', 'In the race you are in (or a new one)', btns([btn('act', 'ASK A QUESTION NOW', 'ask'), btn('j', 'PIT STOP QUIZ NOW', 'pit'), btn('j', 'FINISH QUESTIONS NOW', 'finishQs')]), true);
  }
  if (t === 'race') {
    const lapsN = get('laps') || mapLaps(), pl = get('pitLaps'), cur = pl == null ? (mapPits() || []) : pl;
    const T0 = G.TDEF(), vs = T0 && T0.routes ? (T0.routes.set === 'ground' ? G.GROUND_VARIANTS : G.ROUTE_VARIANTS) : G.GROUND_VARIANTS;
    return slider(['laps', 'Laps', '', 0, 12, 1, `0 = the map's own (${mapLaps()})`])
      + row('Pit stop laps', pl == null ? `The map's own: ${(mapPits() || []).join(', ') || 'every ' + G.TUNE.pitEvery + ' laps'}` : (pl.length ? `Laps ${pl.join(', ')}` : 'No pit stops'), `<div class="dlaps">${Array.from({ length: lapsN }, (_, i) => `<button data-act="pitlap" data-arg="${i + 1}" class="${cur.includes(i + 1) ? 'on' : ''}">${i + 1}</button>`).join('')}${btn('act', 'NONE', 'pitNone')}${pl != null ? btn('unset', 'MAP DEFAULT', 'pitLaps') : ''}</div>`, true)
      + row('Rivals', 'How many race against you (next race)', seg('rivals', [[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4']]), true)
      + slider(['aiMul', 'Rival speed', '×', .5, 1.5, .01, `The rivals' top speed: ${D.ai.map((x) => x.toFixed(2)).join(' / ')} × this (they also follow your pace)`])
      + row('Road variant · every race', 'RANDOM = a new one every lap (the game). Also switches the race you are in.', seg('route', [[-1, 'RANDOM'], ...vs.map((x, i) => [i, esc(x.name)])], 'num', 4), true)
      + row('Skip the garage start', 'Races start on the grid (no set-up questions, no garage)', tog('skipGarage'))
      + row('Autopilot', 'The kart drives itself (and uses its power-ups)', tog('auto'))
      + row('Time scale', 'Slow motion or fast forward for the race', seg('timeScale', [[.1, '0.1×'], [.25, '¼×'], [.5, '½×'], [1, '1×'], [2, '2×'], [3, '3×'], [5, '5×']]), true)
      + row('Give', R ? 'In this race' : 'Start a race first', btns([btn('act', 'BOOST', 'giveItem:boost'), btn('act', 'SHIELD', 'giveItem:shield'), btn('act', 'BAZOOKA', 'giveItem:bazooka'), btn('act', 'TRAP', 'giveItem:trap'), btn('act', 'PUDDLE SHIELDS', 'imm'), btn('act', 'MAX RACE COINS', 'coinsRace'), btn('act', '+3 SPEED +3 GRIP', 'pitBonus'), btn('act', 'TURBO NOW', 'boost')]), true)
      + row('Race', '', btns([btn('act', 'FINISH NOW (NO QUESTIONS)', 'endNow'), btn('j', 'FINISH WITH QUESTIONS', 'finishQs'), btn('act', 'RESTART', 'restart'), btn('act', 'QUIT TO LOBBY', 'quit')]), true);
  }
  if (t === 'steering') {
    return `<div class="srow col"><div class="dslh"><b>Live: wheel input → steering</b><span><small id="dbgMode"></small></span></div><canvas id="dbgCurve"></canvas><small class="dhelp" id="dbgLive">—</small></div>`
      + row('Steering · sideways', '', seg('save.steerL', ['tilt', 'joy', 'line', 'follow', 'arrows'].map((k) => [k, G.STEER_NAME[k]]), 'str'), true)
      + row('Steering · upright', '', seg('save.steerP', ['joy', 'line', 'follow', 'arrows'].map((k) => [k, G.STEER_NAME[k]]), 'str'), true)
      + row('Steering assist', '', seg('save.assistLvl', [[0, 'OFF'], [1, 'LOW'], [2, 'MEDIUM'], [3, 'HIGH']]), true)
      + row('Controls side', '', seg('save.ctlSide', [['left', 'LEFT'], ['right', 'RIGHT']], 'str'), true)
      + STEER_SL.map(slider).join('')
      + row('Reset steering', 'Every steering value back to the game default', btn('act', 'RESET STEERING', 'steerReset'));
  }
  if (t === 'kart') {
    const lvK = G.vehLv('kart') + 1, lvS = G.vehLv('ship') + 1, N = G.crates(), mp = s.mapPts || 0;
    return `<div class="srow col dsl" data-lv="kart"><div class="dslh"><b>Kart level</b><span><output>${lvK}</output><small>of ${G.KART_MAX}</small></span></div><input type="range" min="1" max="${G.KART_MAX}" step="1" value="${lvK}"></div>`
      + `<div class="srow col dsl" data-lv="ship"><div class="dslh"><b>Starship level</b><span><output>${lvS}</output><small>of ${G.KART_MAX}</small></span></div><input type="range" min="1" max="${G.KART_MAX}" step="1" value="${lvS}"></div>`
      + (G.REAR_WINGS ? `<div class="srow col dsl" data-wing="1"><div class="dslh"><b>Rear wing (this race)</b><span><output>${G.wingLv() ? G.REAR_WINGS[G.wingLv() - 1].name : 'NONE'}</output><small>0–${G.REAR_WINGS.length} · your go-kart only</small></span></div><input type="range" min="0" max="${G.REAR_WINGS.length}" step="1" value="${G.wingLv()}"></div>` : '')   // (v270)
      + row('Coins', `${G.DEV() ? '∞ (dev mode) · ' : ''}${s.coins} in the save`, btns([btn('act', '+1 000', 'coins:1000'), btn('act', '+10 000', 'coins:10000'), btn('act', '0', 'coins:0')]))
      + row('Unlock', `${s.kart.bodiesOwned.length} paints · ${G.tyreOwned().length} of ${G.TYRE_STYLES.length} tyres · crates ${N.paint || 0} paint, ${N.tyre || 0} tyre`, btns([btn('act', 'ALL PAINTS', 'paints'), btn('act', 'ALL TYRES', 'tyres'), btn('act', '+3 CRATES', 'crates3')]), true)
      + row('Game Pass', `Level ${G.passOf().lv} · ${(s.pass && s.pass.nuts) || 0} nuts`, btns([btn('act', '+100 NUTS', 'nuts:100'), btn('act', '+1 000', 'nuts:1000'), btn('act', 'RESET', 'nuts:0')]))
      + row('Maps', `${mp} map points (all open at ${G.MAP_NEED[G.MAP_NEED.length - 1]})`, btns([btn('act', 'OPEN ALL', 'maps:1'), btn('act', 'LOCK AGAIN', 'maps:0')]))
      + row('Reset the kart', 'Kart and starship level 1, the default look', btn('act', 'RESET KART', 'resetKart'))
      + `<div class="dsec">Physics</div>` + KART_SL.map(slider).join('')
      + row('Reset physics', 'Every value above back to the game default', btn('act', 'RESET', 'tuneReset'));
  }
  if (t === 'graphics') {
    let gpu = '?'; try { const gl = G.renderer.getContext(), x = gl.getExtension('WEBGL_debug_renderer_info'); gpu = x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch (e) {}
    return row('Performance overlay', 'FPS, frame time, draw calls, triangles, memory — stays on screen', tog('overlay'))
      + row('Quality', 'LOW / DEFAULT / HIGH (the player setting)', seg('save.gfx', [['low', 'LOW'], ['default', 'DEFAULT'], ['high', 'HIGH']], 'str'), true)
      + row('Pixel ratio', `AUTO = what the quality picks (now ${G.renderer.getPixelRatio().toFixed(2)}; this device ${devicePixelRatio})`, seg('pr', [[0, 'AUTO'], [.5, '0.5'], [.75, '0.75'], [1, '1'], [1.5, '1.5'], [2, '2'], [3, '3']]), true)
      + row('Slow-phone fallback', `DEFAULT lowers itself on a slow device: level ${+s.lowq || 0} (0 = full, 1 = no shadows, 2 = lower resolution)`, btn('act', 'RESET', 'lowq'))
      + `<div class="srow col"><div class="sl"><b>This device</b><small>${esc(gpu)}<br>screen ${screen.width}×${screen.height} · window ${innerWidth}×${innerHeight} · @${devicePixelRatio} · ${G.TOUCH ? 'touch' : 'mouse'}<br>${esc(navigator.userAgent)}</small></div></div>`;
  }
  if (t === 'save') {
    const c = (what, q) => (confirmAsk === what ? `<div class="dconf"><b>${q}</b>${btn('act', 'YES', 'yes', 'red')}${btn('act', 'CANCEL', 'no')}</div>` : '');
    let sz = 0; try { sz = (localStorage.getItem(G.SAVE_KEY) || '').length; } catch (e) {}
    return row('Version', `game.js v${G.VER} · debug.js v${HUB_V} · ${Object.keys(st.ov).length} debug override${Object.keys(st.ov).length === 1 ? '' : 's'} on`, '')
      + `<div class="srow col"><div class="sl"><b>Debug settings</b><small>Copy them and send them to a developer; paste someone's text here and APPLY</small></div><textarea id="dbgTxt" spellcheck="false">${esc(tDbg != null ? tDbg : settingsText())}</textarea>${btns([btn('act', 'COPY', 'copy', 'gold'), btn('act', 'APPLY PASTED', 'paste'), btn('act', 'RESET ALL DEBUG SETTINGS', 'ask2:resetDbg', 'red')])}${c('resetDbg', 'Reset every debug setting to the game default?')}</div>`
      + `<div class="srow col"><div class="sl"><b>Game save</b><small>${(sz / 1024).toFixed(1)} kB · EXPORT copies it; paste a save and IMPORT (the game reloads)</small></div><textarea id="dbgSave" spellcheck="false" placeholder="EXPORT puts the save here">${esc(tSave)}</textarea>${btns([btn('act', 'EXPORT', 'exportSave', 'gold'), btn('act', 'IMPORT', 'ask2:importSave'), btn('act', 'RESET SAVE', 'ask2:resetSave', 'red')])}${c('importSave', 'Replace this device\'s save with the pasted one?')}${c('resetSave', 'Delete this device\'s save (coins, levels, everything)? This cannot be undone.')}</div>`
      + row('Debug hub on this device', 'Off hides the bug button and stops the overrides (like ?debug=0)', btn('act', 'TURN OFF', 'ask2:hubOff')) + c('hubOff', 'Turn the debug hub off on this device?')
      + (note ? `<div class="dnote">${esc(note)}</div>` : '');
  }
  return '';
}
function render() {
  if (!root || root.hidden) return;
  const pg = root.querySelector('.spage'), y = pg ? pg.scrollTop : 0;
  root.innerHTML = `<div class="sveil"><div class="spanel art"><div class="shead"><h2 class="out">DEBUG HUB <small>v${G.VER}</small></h2><button class="sx" data-act="close" aria-label="Close"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 5l14 14M19 5L5 19" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/></svg></button></div>
    <div class="sbody"><nav class="stabs">${TABS.map(([k, n]) => `<button data-tab="${k}" class="${k === st.tab ? 'on' : ''}">${n}</button>`).join('')}</nav><div class="spage">${page(st.tab)}</div></div></div></div>`;
  root.querySelector('.spage').scrollTop = y; loopOn();
}
async function onClick(e) {
  const b = e.target.closest('button'); if (!b || !root.contains(b)) { if (e.target.classList && e.target.classList.contains('sveil')) close(); return; }
  const tab = b.dataset.tab; if (tab) { st.tab = tab; note = ''; confirmAsk = null; persist(); root.querySelector('.spage').scrollTop = 0; render(); root.querySelector('.spage').scrollTop = 0; return; }
  const sg = b.closest('.dseg'); if (sg) { await setVal(sg.dataset.k, JSON.parse(b.dataset.v)); render(); return; }
  const pk = b.closest('.dpick'); if (pk) { const k = pk.dataset.pk; st[k] = k === 'jroute' ? +b.dataset.v : b.dataset.v; if (k === 'jmap') st.jroute = -1; persist(); render(); return; }
  if (b.dataset.tk) { set(b.dataset.tk, !get(b.dataset.tk)); render(); return; }
  const act = b.dataset.act; if (!act) return;
  const [a, arg] = (b.dataset.arg || '').split(':');
  if (act === 'close') return close();
  if (act === 'j') return JUMPS[a](arg);
  if (act === 'unset') { delete st.ov[a]; persist(); apply(a); badge(); render(); return; }
  if (act === 'devq') { await setVal('save.dev', !G.DEV()); render(); return; }
  if (act === 'pitlap') { const n = +a, pl = (get('pitLaps') || mapPits() || []).slice(), i = pl.indexOf(n); if (i >= 0) pl.splice(i, 1); else pl.push(n); set('pitLaps', pl.sort((x, y) => x - y)); render(); return; }
  if (act === 'act') { if (a === 'pitNone') { set('pitLaps', []); render(); return; } if (ACT[a]) return ACT[a](arg); }
}
function onInput(e) {
  const r = e.target; if (r.id === 'dbgTxt') tDbg = r.value; if (r.id === 'dbgSave') tSave = r.value; if (r.type !== 'range') return;
  const w = r.closest('.dsl'), v = +r.value, out = w.querySelector('output');
  if (w.dataset.wing) { if (!G.race()) { needRace(); r.value = 0; return; } G.setWing(v); out.textContent = v ? G.REAR_WINGS[v - 1].name : 'NONE'; return; }   // (v270)
  if (w.dataset.lv) { const U = G.upsOf(w.dataset.lv); U.lv = v - 1; G.store(); out.textContent = v; G.setShowRacer(); G.refreshCounters(); return; }
  set(w.dataset.k, v); out.textContent = show(w.dataset.k, v, r.dataset.unit || '');
  if (!w.classList.contains('mod') && w.dataset.k in st.ov) { w.classList.add('mod'); }
}
function onChange(e) { if (e.target.type === 'range') { const w = e.target.closest('.dsl'); if (w && w.dataset.lv && G.screen() === 'garage') G.goGarage(); render(); } }

/* ---------- open / close ---------- */
function build() {
  root = document.createElement('section'); root.id = 'dbg'; root.hidden = true; document.body.appendChild(root);
  root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onChange);
  for (const k of ['keydown', 'keyup']) root.addEventListener(k, (e) => { if (e.target.closest('textarea, input')) e.stopPropagation(); });
  for (const k of ['pointerdown', 'touchstart']) root.addEventListener(k, (e) => e.stopPropagation(), { passive: true });
}
export function open(tab) {
  if (!root) build();
  if (!st.on) { st.on = true; persist(); applyAll(); }
  if (tab) st.tab = tab;
  const R = G.race();
  if (R && G.screen() === 'race' && R.started && !R.ended && !R.dialog) { G.pauseMenu(); pausedBy = R; }
  root.hidden = false; note = ''; confirmAsk = null; render(); badge(); loopOn();
}
export function close() {
  if (!root || root.hidden) return;
  root.hidden = true; root.innerHTML = ''; confirmAsk = null;
  const R = G.race(); if (pausedBy && R === pausedBy && R.dialog === true) G.resume(); pausedBy = null; badge();
}
export function toggle(tab) { if (root && !root.hidden) close(); else open(tab); }

/* ---------- the bug button, the DEBUG tag, the overlay ---------- */
const BUG = '<svg viewBox="0 0 32 32" width="26" height="26"><g fill="none" stroke="#1b1f4a" stroke-width="2.2" stroke-linecap="round"><path d="M9 12l-4-3M23 12l4-3M8 18H3M24 18h5M9 24l-4 3M23 24l4 3M12 7l-2-3M20 7l2-3"/></g><ellipse cx="16" cy="19" rx="8" ry="10" fill="#4fc84a" stroke="#1b1f4a" stroke-width="2.2"/><path d="M16 10v19" stroke="#1b1f4a" stroke-width="2"/><circle cx="16" cy="9.5" r="4.6" fill="#2a2f66" stroke="#1b1f4a" stroke-width="2"/><circle cx="12.5" cy="17" r="1.7" fill="#1b1f4a"/><circle cx="19.5" cy="21" r="1.7" fill="#1b1f4a"/><circle cx="12.5" cy="24" r="1.4" fill="#1b1f4a"/><circle cx="19.5" cy="15" r="1.4" fill="#1b1f4a"/></svg>';
function badge() {
  if (!bug) { bug = document.createElement('button'); bug.id = 'dbgBug'; bug.setAttribute('aria-label', 'Debug hub'); bug.addEventListener('click', (e) => { e.stopPropagation(); toggle(); }); for (const k of ['pointerdown', 'touchstart']) bug.addEventListener(k, (e) => e.stopPropagation(), { passive: true }); document.body.appendChild(bug); }
  const n = Object.keys(st.ov).length;
  bug.hidden = !st.on || !!(root && !root.hidden);
  bug.innerHTML = BUG + (n ? `<b>DEBUG<i>${n}</i></b>` : '');
  bug.classList.toggle('mod', !!n);
  bug.title = n ? `Debug hub · ${n} override${n === 1 ? '' : 's'}: ${Object.keys(st.ov).join(', ')}` : 'Debug hub';
}
let raf = 0, fr = [], lastT = 0, info = { calls: 0, tris: 0 }, infoT = 0;
function loopOn() { if (!raf) raf = requestAnimationFrame(frame); }
function frame(now) {
  raf = 0;
  const showO = st.on && get('overlay'), showS = root && !root.hidden && st.tab === 'steering';
  if (!showO && !showS) { G.renderer.info.autoReset = true; return; }
  if (lastT) fr.push(now - lastT); lastT = now; if (fr.length > 120) fr.shift();
  if (showO) {
    const I = G.renderer.info; I.autoReset = false;
    if (now - infoT > 250) {
      infoT = now; const sum = fr.reduce((a, b) => a + b, 0), avg = fr.length ? sum / fr.length : 0, mx = fr.length ? Math.max(...fr) : 0;
      const cv = G.renderer.domElement, M = performance.memory, s = G.save();
      ovl.textContent = `${avg ? (1000 / avg).toFixed(0) : '—'} FPS · ${avg.toFixed(1)} ms (max ${mx.toFixed(0)})\n${I.render.calls} draws · ${(I.render.triangles / 1000).toFixed(0)}k tris\n${I.memory.geometries} geo · ${I.memory.textures} tex${M ? ` · ${(M.usedJSHeapSize / 1048576).toFixed(0)} MB` : ''}\nPR ${G.renderer.getPixelRatio().toFixed(2)} · ${cv.width}×${cv.height}\n${G.gfxOf(s).toUpperCase()} · auto-low ${+s.lowq || 0} · ${G.screen()}`;
    }
    I.reset();
  }
  if (showS) steerLive();
  loopOn();
}
function overlay(on) {
  if (on && !ovl) { ovl = document.createElement('pre'); ovl.id = 'dbgOvl'; document.body.appendChild(ovl); }
  if (ovl) ovl.hidden = !on; fr = []; lastT = 0; if (on) loopOn(); else G.renderer.info.autoReset = true;
}
// the steering readout: the curve of the control in use (input 0…1 → steering 0…1) and where you are on it now
function steerLive() {
  const c = document.getElementById('dbgCurve'); if (!c) return;
  if (c.width !== c.clientWidth || c.height !== c.clientHeight) { c.width = c.clientWidth; c.height = c.clientHeight; }
  const S = G.STEER, ctl = G.CTL(), pad = G.GPAD.on, R = G.race(), x = c.getContext('2d'), W = c.width, H = c.height;
  const mode = pad ? 'pad' : ctl === 'stick' ? 'line' : ctl;
  const wheelOf = (u) => mode === 'line' ? u ** S.lineExp * S.lineMax : mode === 'joy' ? u ** S.joyExp * S.joyMax : mode === 'pad' ? u ** S.padExp * 90 : mode === 'tilt' ? Math.min(110, Math.max(0, u * 40 - S.tiltDead) * S.tiltGain) : mode === 'follow' ? (u > 0 ? S.tapMin + (S.tapMax - S.tapMin) * u : 0) : (u > 0 ? 95 : 0);
  const outOf = (w) => Math.min(1, w / 90) ** S.outExp;
  let inp = 0;
  if (mode === 'line' || mode === 'joy') inp = G.STICK.x || 0; else if (mode === 'pad') inp = G.GPAD.steer || 0; else if (mode === 'tilt') inp = (G.tilt() || 0) / 40; else if (mode === 'follow') inp = G.FOLLOW.x == null ? 0 : Math.sign(G.FOLLOW.x); else inp = G.WHEEL.rot / 95;
  const rot = G.WHEEL.rot, out = R ? R.steer || 0 : Math.sign(rot) * outOf(Math.abs(rot));
  x.clearRect(0, 0, W, H); x.fillStyle = 'rgba(10,14,46,.8)'; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 1; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(i * W / 4, 0); x.lineTo(i * W / 4, H); x.moveTo(0, i * H / 4); x.lineTo(W, i * H / 4); x.stroke(); }
  x.strokeStyle = 'rgba(255,255,255,.3)'; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(0, H); x.lineTo(W, 0); x.stroke(); x.setLineDash([]);
  x.strokeStyle = '#59d8ff'; x.lineWidth = 3; x.beginPath(); for (let i = 0; i <= 60; i++) { const u = i / 60, y = mode === 'arrows' || mode === 'keys' ? outOf(u * 95) : outOf(wheelOf(u)); i ? x.lineTo(u * W, H - y * H) : x.moveTo(0, H - y * H); } x.stroke();
  const au = Math.min(1, Math.abs(inp)), ao = Math.min(1, Math.abs(out)); x.fillStyle = '#ffe14a'; x.beginPath(); x.arc(au * W, H - ao * H, 8, 0, 7); x.fill();
  x.fillStyle = '#b8c6ec'; x.font = '600 12px sans-serif'; x.fillText('input →', W - 52, H - 6); x.fillText('↑ steering', 6, 15);
  const m = document.getElementById('dbgMode'); if (m) m.textContent = `${{ line: 'LINE', joy: 'JOYSTICK', pad: 'GAMEPAD', tilt: 'TURN DEVICE', follow: 'TAP SIDES', arrows: 'ARROWS', keys: 'KEYS' }[mode] || mode}${R ? '' : ' · no race'}`;
  const l = document.getElementById('dbgLive'); if (l) l.textContent = `input ${inp.toFixed(2)} → wheel ${rot.toFixed(0)}° → steering ${out.toFixed(2)}${R && R.player ? ` · ${(R.player.speed * 3.6).toFixed(0)} km/h` : ''} · assist ${['OFF', 'LOW', 'MEDIUM', 'HIGH'][G.save().assistLvl ?? 1]}`;
}

const CSS = `
#dbg{position:fixed;inset:0;z-index:9000;pointer-events:auto;font-family:var(--f);touch-action:none}
#dbg .sveil{background:rgba(8,12,36,.62)}
#dbg .spanel{width:min(900px,100%);height:min(640px,100%)}
#dbg .shead h2{font-size:28px}#dbg .shead h2 small{font-size:14px;color:#b8c6ec;letter-spacing:.04em}
#dbg .stabs{width:150px}#dbg .stabs button{font-size:14px;padding:10px 12px}
#dbg .spage{overscroll-behavior:contain}
#dbg .srow{gap:10px}
#dbg .seg{margin-top:4px}#dbg .seg button{font-size:14px;padding:9px 4px;letter-spacing:.04em}
#dbg .dsmall button{font-size:11px;padding:8px 2px;letter-spacing:0}
#dbg .dbtns{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
#dbg .srow:not(.col) .dbtns{margin-top:0;justify-content:flex-end}
#dbg .sbtn{font-size:13px;padding:8px 12px;color:#fff}
#dbg .sbtn.gold{color:#3a2600;background:linear-gradient(180deg,#ffe07a,var(--gold) 55%,var(--gold2));border-color:#b36b00;box-shadow:0 3px 0 #b36b00}
#dbg .sbtn.red{background:linear-gradient(180deg,#ff6a5e,#c8231c);box-shadow:0 3px 0 #6a1010}
#dbg .dsl{gap:4px}#dbg .dslh{display:flex;justify-content:space-between;align-items:center;gap:10px}#dbg .dslh b{font-size:15px}
#dbg .dslh span{display:flex;align-items:baseline;gap:8px;flex:none}#dbg .dslh output{font-size:17px;color:#ffe14a;min-width:40px;text-align:right}#dbg .dslh small{font-size:12px;color:#8f9cc8;font-weight:500}
#dbg .dsl.mod{border-color:#ff9d1b;background:rgba(80,40,10,.45)}
#dbg .dre{width:30px;height:30px;border-radius:10px;background:#3a3fa8;font-size:18px;line-height:1;align-self:center}
#dbg .dhelp{font-size:12px;color:#b8c6ec;font-weight:500}
#dbg input[type=range]{width:100%;height:30px;accent-color:#ffc324;touch-action:pan-y;margin:0}
#dbg .dlaps{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}#dbg .dlaps>button:not(.sbtn){width:40px;height:36px;border-radius:10px;background:#2a2f60;border:2px solid rgba(255,255,255,.2);font-size:15px}
#dbg .dlaps>button.on{color:#3a2600;background:linear-gradient(180deg,#ffe07a,var(--gold) 55%,var(--gold2));border-color:#b36b00}
#dbg textarea{width:100%;box-sizing:border-box;min-height:90px;font:12px/1.35 ui-monospace,Menlo,monospace;border-radius:10px;border:2px solid #3a3fa8;background:#0b0f30;color:#dfe6ff;padding:8px;resize:vertical;touch-action:pan-y}
#dbg .dconf{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:6px;padding:8px 10px;border-radius:12px;background:rgba(200,35,28,.25);border:2px solid #ff6a5e}#dbg .dconf b{flex:1 1 200px;font-size:14px}
#dbg .dnote{padding:8px 12px;border-radius:12px;background:rgba(79,200,74,.18);border:2px solid #4fc84a;font-size:13px}
#dbg .dsec{margin:6px 2px 0;font-size:13px;letter-spacing:.12em;color:#ffe14a}
#dbg canvas{width:100%;height:150px;border-radius:10px;margin-top:4px;display:block}
#dbg .tog{cursor:pointer}
body.portrait #dbg .sbody{flex-direction:column}
body.portrait #dbg .stabs{display:grid;grid-template-columns:repeat(4,1fr);width:auto;overflow:visible;gap:5px}body.portrait #dbg .stabs button{font-size:11px;padding:8px 2px;text-align:center}
@media (max-height:500px){#dbg .shead h2{font-size:20px}#dbg .stabs{width:118px;gap:4px}#dbg .stabs button{padding:6px 8px;font-size:12px}#dbg .spanel{height:100%}}
#dbgBug{position:fixed;z-index:8990;right:calc(6px + env(safe-area-inset-right));top:44%;height:42px;min-width:42px;padding:0 8px 0 7px;border-radius:21px;display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.88);border:2.5px solid #1b1f4a;box-shadow:0 3px 0 #1b1f4a;color:#1b1f4a;font-family:var(--f)}
#dbgBug.mod{background:#ffd9d6;border-color:#c8231c;box-shadow:0 3px 0 #c8231c}
#dbgBug b{font-size:12px;letter-spacing:.08em;color:#c8231c;display:flex;align-items:center;gap:4px}#dbgBug b i{font-style:normal;background:#c8231c;color:#fff;border-radius:9px;padding:0 6px;font-size:11px}
body.intro #dbgBug{display:none}
body:has(#setp:not([hidden])) #dbgOvl,body:has(#pass:not([hidden])) #dbgOvl,body:has(#quiz:not([hidden])) #dbgOvl,body:has(#tracks:not([hidden])) #dbgOvl,body:has(#dbg:not([hidden])) #dbgOvl{display:none}
body.portrait #dbg .spanel{height:100%}
@media (max-height:500px){#dbgBug,#dbgOvl{top:52%}#dbgOvl{font-size:10px}}
#dbgOvl{position:fixed;z-index:8991;right:calc(140px + env(safe-area-inset-right));top:44%;margin:0;padding:6px 8px;border-radius:10px;background:rgba(5,8,28,.72);color:#9dffa0;font:11px/1.35 ui-monospace,Menlo,monospace;pointer-events:none;white-space:pre}
`;

/* ---------- start ---------- */
export function init(api) {
  G = api; FK = window.FK;
  try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}') || {}); } catch (e) {}
  st.ov = st.ov && typeof st.ov === 'object' ? st.ov : {};
  if (!G.TRACK_DEFS[st.jmap]) st.jmap = 'alps';
  D.TUNE = clone(G.TUNE); D.STEER = clone(G.STEER); D.ai = G.TUNE.aiSkill.slice();
  D.pitOnly = Object.fromEntries(G.TRACK_ORDER.map((id) => [id, G.TRACK_DEFS[id].pitOnly]));
  const style = document.createElement('style'); style.id = 'dbgCss'; style.textContent = CSS; document.head.appendChild(style);
  FK.onTrack = onTrack; FK.onRace = onRace; FK.hub = { get st() { return st; }, set, get, open, close, jump: (k, a) => JUMPS[k](a), act: (k, a) => ACT[k](a), settingsText, pasteSettings };
  if (st.on) applyAll();
  badge(); if (st.on && get('overlay')) overlay(true);
  addEventListener('keydown', (e) => { if (root && !root.hidden && e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); close(); } }, true);
}
