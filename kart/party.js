// FoxKarts parties: race your friends live. Peer-to-peer (WebRTC data channels through PeerJS and its free public
// signalling server), so there is no game server and nothing is stored: the party leader's browser is the hub and
// passes every message on. The party code (6 letters/digits, no 0/O/1/I) is the leader's peer id.
//
//   import { createParty, joinParty } from './party.js';
//   const P = await createParty({ name, char, skin });          // P.code, P.isHost (true), P.me (my id)
//   const P = await joinParty('K7Q4PX', { name, char, skin });  // rejects with an Error: .code = 'no such party' |
//                                                               //   'full' | 'already racing' | 'network' | 'bad code'
//   P.onMembers((list) => …)       [{ id, name, char, skin, ready, host, me }], the leader first, at most 6
//   P.setReady(true)  P.setLook({ name, char, skin })            everyone gets onMembers
//   P.startRace({ track, seed })   leader only → everyone (the leader too) gets onStart({ track, seed, startAt })
//                                  startAt is a host Date.now(): your local start = startAt + P.offset()
//   P.offset()                     my clock − the host's clock (ms), from the pings (0 for the leader)
//   P.sendState(obj)               ~15 times a second; obj is passed on untouched
//   P.onState((id, obj, hostTime) => …)   hostTime: the host's Date.now() when it passed the state on
//   P.finish({ time, place })  P.onFinish((id, info) => …)
//   P.sendEvent({ type, … })   P.onEvent((id, ev) => …)         (for later: items, hits)
//   P.onLeave((id) => …)       P.onHostLeft(() => …)             the party is over
//   P.onError((message) => …)  P.leaveParty()                    also done on pagehide
//   P.ping                         round-trip time to the leader (ms)

const PEERJS = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const PREFIX = 'fugio-kart-party-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_MEMBERS = 6;

let peerLib = null;
function loadPeer() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (!peerLib) peerLib = new Promise((ok, fail) => {
    const s = document.createElement('script'); s.src = PEERJS; s.async = true;
    s.onload = () => (window.Peer ? ok(window.Peer) : fail(oops('network')));
    s.onerror = () => { peerLib = null; s.remove(); fail(oops('network')); };
    document.head.appendChild(s);
  });
  return peerLib;
}
const MESSAGES = {
  'no such party': 'No party with that code', full: 'That party is full', 'already racing': 'That party is racing right now. Try again after the race.',
  network: 'No connection to the party server. Check the internet connection.', 'bad code': 'A party code has 6 letters and numbers',
  'not host': 'Only the party leader can start the race', unsupported: 'This browser cannot join parties',
};
function oops(code) { const e = new Error(MESSAGES[code] || code); e.code = code; return e; }
const fromPeerError = (e) => oops(e && e.type === 'peer-unavailable' ? 'no such party' : e && e.type === 'browser-incompatible' ? 'unsupported' : 'network');
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPHABET[b % ALPHABET.length]).join('');
// what a player types: lower case, spaces and dashes still work
export const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
const clip = (s) => String(s || '').trim().slice(0, 16) || 'Racer';
const look = (l = {}) => { const o = {}; if ('name' in l) o.name = clip(l.name); if ('char' in l) o.char = l.char || 'foxino'; if ('skin' in l) o.skin = l.skin || null; return o; };

class Party {
  constructor(isHost, me) {
    this.isHost = isHost; this.code = ''; this.ping = 0; this.off = 0; this.offN = 0; this.closed = false; this.racing = false;
    this.mine = { name: 'Racer', char: 'foxino', skin: null, ready: false, ...look(me) };
    this.members = [];          // the list everyone sees (the leader keeps the real one)
    this.conns = new Map();     // leader: peer id → DataConnection
    this.host = null;           // guest: the connection to the leader
    this.h = {};
    this.bye = () => this.leaveParty();
    addEventListener('pagehide', this.bye);
  }
  get me() { return this.peer ? this.peer.id : null; }
  offset() { return this.off; }
  // ---- events ----
  emit(ev, ...a) { for (const f of this.h[ev] || []) try { f(...a); } catch (e) { console.error('party', ev, e); } }
  add(ev, fn) { (this.h[ev] ||= []).push(fn); return () => { this.h[ev] = this.h[ev].filter((f) => f !== fn); }; }
  onMembers(fn) { const off = this.add('members', fn); if (this.members.length) fn(this.list()); return off; }
  onStart(fn) { return this.add('start', fn); }
  onState(fn) { return this.add('state', fn); }
  onFinish(fn) { return this.add('finish', fn); }
  onEvent(fn) { return this.add('event', fn); }
  onLeave(fn) { return this.add('leave', fn); }
  onHostLeft(fn) { return this.add('hostLeft', fn); }
  onError(fn) { return this.add('error', fn); }
  list() { return this.members.map((x) => ({ ...x, me: x.id === this.me })); }

  // ---- the leader ----
  async openAsHost() {
    const Peer = await loadPeer();
    for (let tries = 0; tries < 5 && !this.code; tries++) {
      const code = newCode();
      try { this.peer = await openPeer(Peer, PREFIX + code); this.code = code; }
      catch (e) { if (!(e && e.type === 'unavailable-id')) throw fromPeerError(e); }
    }
    if (!this.code) throw oops('network');
    this.peer.on('connection', (c) => this.accept(c));
    this.peer.on('disconnected', () => { if (!this.closed) try { this.peer.reconnect(); } catch (e) { /* tried */ } });   // only the signalling link; parties keep going
    this.peer.on('error', (e) => { if (e && e.type !== 'peer-unavailable') this.emit('error', fromPeerError(e).message); });
    this.members = [{ id: this.me, ...this.mine, host: true }];
    return this;
  }
  accept(c) {
    c.on('data', (m) => {
      if (!m || typeof m !== 'object') return;
      if (m.type === 'hello') {
        const refuse = (why) => { c.send({ type: 'refuse', why }); setTimeout(() => c.close(), 400); };
        if (this.racing) return refuse('already racing');
        if (this.members.length >= MAX_MEMBERS && !this.conns.has(c.peer)) return refuse('full');
        this.conns.set(c.peer, c);
        this.members = this.members.filter((x) => x.id !== c.peer).concat({ id: c.peer, name: 'Racer', char: 'foxino', skin: null, ...look(m.me), ready: !!(m.me && m.me.ready), host: false });
        c.send({ type: 'welcome', code: this.code });
        this.shareMembers();
      } else if (!this.conns.has(c.peer)) return;
      else if (m.type === 'look') { const x = this.members.find((y) => y.id === c.peer); if (x) { Object.assign(x, look(m.look)); if ('ready' in m.look) x.ready = !!m.look.ready; this.shareMembers(); } }
      else if (m.type === 'ping') c.send({ type: 'pong', t0: m.t0, th: Date.now() });
      else if (m.type === 'state') { const th = Date.now(); this.emit('state', c.peer, m.s, th); this.pass(c.peer, { type: 'state', from: c.peer, s: m.s, th }); }
      else if (m.type === 'finish') { this.emit('finish', c.peer, m.info); this.pass(c.peer, { type: 'finish', from: c.peer, info: m.info }); }
      else if (m.type === 'event') { this.emit('event', c.peer, m.ev); this.pass(c.peer, { type: 'event', from: c.peer, ev: m.ev }); }
    });
    const gone = () => {
      if (!this.conns.has(c.peer) || this.closed) return;   // (no 'leave' events once you have left yourself)
      this.conns.delete(c.peer); this.members = this.members.filter((x) => x.id !== c.peer);
      this.emit('leave', c.peer); this.pass(c.peer, { type: 'leave', from: c.peer }); this.shareMembers();
    };
    c.on('close', gone); c.on('error', gone);
  }
  pass(from, msg) { for (const [id, c] of this.conns) if (id !== from && c.open) c.send(msg); }
  shareMembers() { const list = this.members.map((x) => ({ ...x })); for (const c of this.conns.values()) if (c.open) c.send({ type: 'members', list }); this.emit('members', this.list()); }
  startRace({ track, seed = Math.floor(Math.random() * 1e9) } = {}) {
    if (!this.isHost) throw oops('not host');
    const startAt = Date.now() + 4500;   // time for every phone to build the track before the countdown
    this.racing = true;
    const msg = { type: 'start', track, seed, startAt };
    for (const c of this.conns.values()) if (c.open) c.send(msg);
    this.emit('start', { track, seed, startAt });
  }
  endRace() { this.racing = false; if (this.isHost) for (const c of this.conns.values()) if (c.open) c.send({ type: 'end' }); }

  // ---- a guest ----
  async openAsGuest(code) {
    const Peer = await loadPeer();
    try { this.peer = await openPeer(Peer); } catch (e) { throw fromPeerError(e); }
    this.code = code;
    try {
      await new Promise((ok, fail) => {
        const c = this.peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        const t = setTimeout(() => fail(oops('no such party')), 12000);
        const err = (e) => { clearTimeout(t); fail(fromPeerError(e)); };
        this.peer.once('error', err);
        c.on('open', () => c.send({ type: 'hello', me: this.mine }));
        c.on('data', (m) => {
          if (!m || typeof m !== 'object' || this.host) return;
          if (m.type === 'welcome') { clearTimeout(t); this.peer.off('error', err); this.host = c; this.listen(c); this.startPings(); ok(); }
          else if (m.type === 'refuse') { clearTimeout(t); fail(oops(m.why)); }
        });
      });
    } catch (e) { this.cleanup(); throw e; }
    this.peer.on('error', (e) => this.emit('error', fromPeerError(e).message));
    return this;
  }
  listen(c) {
    c.on('data', (m) => {
      if (!m || typeof m !== 'object') return;
      if (m.type === 'members') { this.members = m.list; this.emit('members', this.list()); }
      else if (m.type === 'start') { this.racing = true; this.emit('start', { track: m.track, seed: m.seed, startAt: m.startAt }); }
      else if (m.type === 'end') this.racing = false;
      else if (m.type === 'state') this.emit('state', m.from, m.s, m.th);
      else if (m.type === 'finish') this.emit('finish', m.from, m.info);
      else if (m.type === 'event') this.emit('event', m.from, m.ev);
      else if (m.type === 'leave') this.emit('leave', m.from);
      else if (m.type === 'pong') {
        // round trip and clock offset (my clock − the host's), smoothed; the first few pings settle it
        const now = Date.now(), rtt = now - m.t0, off = (m.t0 + rtt / 2) - m.th;
        this.ping = this.ping ? this.ping * .7 + rtt * .3 : rtt;
        this.off = this.offN ? this.off * (this.offN < 4 ? .5 : .8) + off * (this.offN < 4 ? .5 : .2) : off; this.offN++;
      }
    });
    const lost = () => { if (this.closed) return; this.closed = true; this.emit('hostLeft'); this.cleanup(); };
    c.on('close', lost); c.on('error', lost);
  }
  startPings() { const p = () => { if (this.host && this.host.open) this.host.send({ type: 'ping', t0: Date.now() }); }; p(); setTimeout(p, 300); setTimeout(p, 700); this.pingTimer = setInterval(p, 2000); }

  // ---- both ----
  setLook(l) { this.change(look(l)); }
  setReady(r) { this.change({ ready: !!r }); }
  change(c) {
    Object.assign(this.mine, c);
    if (this.isHost) { const x = this.members.find((y) => y.id === this.me); if (x) Object.assign(x, c); this.shareMembers(); }
    else if (this.host && this.host.open) this.host.send({ type: 'look', look: c });
  }
  send(type, key, val) {
    if (this.closed) return;
    if (this.isHost) { const msg = { type, from: this.me, [key]: val, th: Date.now() }; for (const c of this.conns.values()) if (c.open) c.send(msg); }
    else if (this.host && this.host.open) this.host.send({ type, [key]: val });
  }
  sendState(s) { this.send('state', 's', s); }
  finish(info) { this.send('finish', 'info', info); }
  sendEvent(ev) { this.send('event', 'ev', ev); }
  leaveParty() {
    if (this.closed) return; this.closed = true;
    if (this.isHost) for (const c of this.conns.values()) try { c.close(); } catch (e) { /* already gone */ }
    else if (this.host) try { this.host.close(); } catch (e) { /* already gone */ }
    this.cleanup();
  }
  cleanup() { clearInterval(this.pingTimer); removeEventListener('pagehide', this.bye); setTimeout(() => { try { this.peer && this.peer.destroy(); } catch (e) { /* already gone */ } }, 300); }
}
function openPeer(Peer, id) {
  return new Promise((ok, fail) => {
    const p = id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 });
    const t = setTimeout(() => { p.destroy(); fail({ type: 'network' }); }, 12000);
    p.once('open', () => { clearTimeout(t); ok(p); });
    p.once('error', (e) => { clearTimeout(t); p.destroy(); fail(e); });
  });
}

export async function createParty(me = {}) { return new Party(true, me).openAsHost(); }
export async function joinParty(code, me = {}) {
  const c = cleanCode(code);
  if (c.length !== 6) throw oops('bad code');
  return new Party(false, me).openAsGuest(c);
}
