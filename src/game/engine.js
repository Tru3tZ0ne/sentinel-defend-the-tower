// Engine (Milestone 2) — phase-based, spatial. Logic only; it emits events that main.js
// turns into world effects (props, clues, trails, containment) and UI updates.
//
// Phases: 'prep' (no clock — learn, inspect, deploy) → 'incident' (clock runs, the story
// unfolds) → 'review'. Fog-of-war: a beat's evidence becomes a visible clue only where a
// matching sensor is deployed. XDR correlates; MDR advises & assists. Containment and
// recovery are honest about what each product actually does.

import { PRODUCTS } from '../data/products.js';

let uid = 0; const nid = () => ++uid;

export class Engine {
  constructor(scenario) {
    this.sc = scenario;                  // { LAYOUT, EMPLOYEES, INCIDENT }
    this.inc = scenario.INCIDENT;
    this.phase = 'prep';
    this.time = 0;
    this.ended = null;                   // 'win' | 'lose-breach' | 'lose-uptime'
    this.result = null;

    this.budget = 15;
    this._incomeAcc = 0;
    this.uptime = 100;
    this.data = 100;

    this.deployed = [];                  // { product, target }
    this.bySlot = new Map();             // AF/IAG/XDR/NDR/MDR/ASTOR -> true
    this.edrDesks = new Set();           // deskId
    this.astorReady = false;             // aStor snapshots prepared BEFORE attack?

    this.beatIndex = 0;
    this.delay = 0;
    this.intruder = { room: 'entrance', desk: null, contained: false, failed: false, revealed: false };

    this.evidence = [];
    this.clues = [];
    this.typesSeen = new Set();
    this.confirmed = false;
    this.firstDetection = null;
    this._mdrAssisted = false;

    this.lockedRooms = new Set();
    this.log = [];
    this._sophia = new Set();
    this.listeners = {};
  }

  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); return this; }
  emit(evt, p) { (this.listeners[evt] || []).forEach(fn => fn(p, this)); }
  changed() { this.emit('change'); }
  sophia(id) { if (this._sophia.has(id)) return; this._sophia.add(id); this.emit('sophia', { id }); }

  // ---- queries ----
  has(id) { return this.bySlot.has(id); }
  get hasAF() { return this.has('AF'); }
  get hasIAG() { return this.has('IAG'); }
  get hasNDR() { return this.has('NDR'); }
  get hasXDR() { return this.has('XDR'); }
  get hasMDR() { return this.has('MDR'); }

  eligible(productId) {
    const p = PRODUCTS[productId];
    if (!p) return { kind: 'none' };
    if (productId === 'EDR') return { kind: 'desk' };          // click any workstation/endpoint
    const slot = this.sc.LAYOUT.slots[productId];
    return { kind: slot?.kind || 'slot', room: slot?.room };
  }

  canAfford(productId) { return this.budget >= PRODUCTS[productId].cost; }

  // ---- deploy ----
  deploy(productId, target) {
    const p = PRODUCTS[productId];
    if (!p || this.ended) return { ok: false };
    if (this.budget < p.cost) { this.emit('toast', { kind: 'warn', key: 'panel.cantAfford' }); return { ok: false }; }

    if (productId === 'EDR') {
      if (!target || this.edrDesks.has(target)) return { ok: false };
      this.edrDesks.add(target);
    } else {
      if (this.bySlot.has(productId)) return { ok: false };
      this.bySlot.set(productId, true);
      if (productId === 'ASTOR' && this.phase === 'prep') this.astorReady = true; // prepared before the attack
    }
    this.budget -= p.cost;
    this.deployed.push({ product: productId, target });
    this.log.push({ t: this.time, phase: this.phase, kind: 'deploy', product: productId, target });
    this.emit('deploy', { product: productId, target });
    this.emit('toast', { kind: 'good', key: 'toast.deployed', product: productId });
    this._correlate();
    this.changed();
    return { ok: true };
  }

  // ---- phases ----
  beginDay() {
    if (this.phase !== 'prep') return;
    this.phase = 'incident';
    this.log.push({ t: 0, kind: 'begin' });
    this.emit('phase', { phase: 'incident' });
    this.sophia('incidentStart');
    this.changed();
  }

  tick(dt) {
    if (this.phase !== 'incident' || this.ended) return;
    this.time += dt;
    this._incomeAcc += dt;
    while (this._incomeAcc >= 12) { this._incomeAcc -= 12; this.budget = Math.min(99, this.budget + 1); }

    if (this.lockedRooms.size) this.uptime = Math.max(0, this.uptime - 2.2 * dt * this.lockedRooms.size);

    this._advance();
    this._correlate();
    this._mdrAssist();
    this._sophiaChecks();
    this._endChecks();
    this.changed();
  }

  _advance() {
    const beats = this.inc.beats;
    while (this.beatIndex < beats.length) {
      if (this.intruder.contained || this.intruder.failed) break;
      const b = beats[this.beatIndex];
      if (this.time < b.t + this.delay) break;
      this.beatIndex++;
      this._beat(b);
    }
  }

  _beat(b) {
    // perimeter: AF blocks the obvious entry but a determined actor finds another way in.
    if (b.act === 'enter') {
      const blocked = this.hasAF;
      this._evidence(b, { blocked });
      if (blocked) { this.delay += 9; this.sophia('afBlocked'); }
      else { this.intruder.room = b.room; this.emit('intruder-goto', { room: b.room }); }
      return;
    }
    // movement / foothold / recon / collect: intruder goes somewhere and acts
    const prevRoom = this.intruder.room;
    this.intruder.room = b.room;
    this.intruder.desk = b.desk || null;
    this.emit('intruder-goto', { room: b.room, desk: b.desk });

    if (b.act === 'move') { this._evidence(b, { fromRoom: prevRoom }); return; }
    if (b.act === 'foothold' || b.act === 'recon' || b.act === 'collect') { this._evidence(b); return; }

    if (b.act === 'ransom') {
      const prevented = b.desk ? this.edrDesks.has(b.desk) : this.edrDesks.has('server#core');
      this._evidence(b, { prevented });
      if (prevented) { this.emit('toast', { kind: 'good', key: 'toast.ransomStopped' }); }
      else { this.lockedRooms.add(b.locks); this.emit('lock', { room: b.locks, locked: true }); this.sophia('ransomLock'); }
      return;
    }

    if (b.act === 'exfil') {
      const blocked = this.hasIAG;
      this._evidence(b, { blocked });
      if (blocked) { this.intruder.failed = true; this.emit('toast', { kind: 'good', key: 'toast.exfilBlocked' }); }
      else { this.data = 10; this.intruder.failed = true; this._end('lose-breach'); }
    }
  }

  _evidence(b, extra = {}) {
    const ev = { id: nid(), t: this.time, type: b.ev, room: b.room, desk: b.desk, act: b.act, truth: b.truth, ...extra };
    this.evidence.push(ev);
    const visible = this._visible(ev);
    this.log.push({ t: this.time, kind: 'attack', act: b.act, room: b.room, desk: b.desk, ev: b.ev, blocked: !!extra.blocked, prevented: !!extra.prevented, visible });
    if (!visible) return;
    if (this.firstDetection == null) this.firstDetection = this.time;
    this.typesSeen.add(ev.type);
    const clue = { id: ev.id, type: ev.type, room: ev.room, desk: ev.desk, t: this.time,
      confidence: this.confirmed ? 'confirmed' : 'weak', blocked: !!extra.blocked, prevented: !!extra.prevented, resolved: false };
    this.clues.push(clue);
    this.emit('clue', clue);
    if (this.clues.length === 1) this.sophia('firstClue');
    this.emit('toast', { kind: 'info', clue: ev.type });
  }

  _visible(ev) {
    switch (ev.type) {
      case 'perimeter': return this.hasAF;
      case 'endpoint':  return ev.desk ? this.edrDesks.has(ev.desk) : false;
      case 'network':   return this.hasNDR;
      case 'exfil':     return this.hasIAG;
      default:          return false;
    }
  }

  _correlate() {
    if (!this.confirmed && this.hasXDR && this.typesSeen.size >= 2) {
      this.confirmed = true;
      this.intruder.revealed = true;
      this.clues.forEach(c => { if (!c.resolved) c.confidence = 'confirmed'; });
      this.emit('confirm', {});
      this.sophia('confirmed');
      this.emit('toast', { kind: 'good', key: 'toast.confirmed' });
    }
    if (this.confirmed) this.intruder.revealed = true;
  }

  _mdrAssist() {
    if (!this.hasMDR || this._mdrAssisted || this.intruder.contained || this.intruder.failed) return;
    if (this.intruder.room === 'vault' && this.edrDesks.has('vault#core')) {
      this._mdrAssisted = true;
      this._contain('mdr', 'vault#core');
      this.emit('toast', { kind: 'good', key: 'toast.mdrAssist' });
    }
  }

  // ---- responses ----
  isolateDevice(deskId) {
    if (this.ended || !this.edrDesks.has(deskId)) { this.emit('toast', { kind: 'warn', key: 'resp.needEdr' }); return { ok: false }; }
    const here = this.intruder.desk === deskId || (this.sc.LAYOUT.rooms.find(r => r.id === this.intruder.room) &&
                 this._deskRoom(deskId) === this.intruder.room);
    if (here && !this.intruder.contained) { this._contain('isolate', deskId); return { ok: true, contained: true }; }
    this.log.push({ t: this.time, kind: 'respond', action: 'isolate', desk: deskId, result: 'nothing' });
    this.emit('toast', { kind: 'bad', key: 'resp.nothingHere' });
    this.changed();
    return { ok: true, contained: false };
  }

  lockdownRoom(roomId) {
    if (this.ended) return { ok: false };
    this.emit('cage-room', { room: roomId });
    if (this.intruder.room === roomId && !this.intruder.contained && !this.intruder.failed) {
      this.uptime = Math.max(0, this.uptime - 6);   // access control disrupts that area's work
      this._contain('lockdown', null, roomId);
      return { ok: true, contained: true };
    }
    this.uptime = Math.max(0, this.uptime - 10);     // blunt lockdown of the wrong area hurts more
    this.log.push({ t: this.time, kind: 'respond', action: 'lockdown', room: roomId, result: 'wrong' });
    this.emit('toast', { kind: 'bad', key: 'resp.wrongArea' });
    this.changed();
    return { ok: true, contained: false };
  }

  recover(roomId) {
    if (this.ended || !this.lockedRooms.has(roomId)) return { ok: false };
    if (!this.astorReady) { this.emit('toast', { kind: 'warn', key: 'resp.needPrepared' }); return { ok: false }; }
    this.lockedRooms.delete(roomId);
    this.emit('lock', { room: roomId, locked: false });
    this.uptime = Math.min(100, this.uptime + 12);   // restore from protected snapshots (partial, takes effort)
    this.log.push({ t: this.time, kind: 'respond', action: 'recover', room: roomId });
    this.emit('toast', { kind: 'good', key: 'toast.recovered' });
    this.changed();
    return { ok: true };
  }

  _contain(via, deskId, roomId) {
    this.intruder.contained = true;
    this.clues.forEach(c => c.resolved = true);
    this.emit('contained', { via, desk: deskId, room: roomId || this.intruder.room });
    this.log.push({ t: this.time, kind: 'respond', action: via, desk: deskId, room: roomId || this.intruder.room, result: 'contained' });
    this.emit('toast', { kind: 'good', key: 'resp.contained' });
    this._end('win', true);
  }

  _deskRoom(deskId) { return deskId.split('#')[0]; }

  _sophiaChecks() {
    if (!this.hasXDR && this.typesSeen.size >= 2) this.sophia('needCorrelate');
    if (this.intruder.room === 'vault' && !this.hasIAG && !this.intruder.contained && !this.intruder.failed) this.sophia('exfilSoon');
  }

  _endChecks() {
    if (this.ended) return;
    if (this.uptime <= this.inc.loseUptimeBelow) { this._end('lose-uptime'); return; }
    if (this.time >= this.inc.duration) { this._end('win'); }
  }

  _end(result, contained = false) {
    if (this.ended) return;
    this.ended = result; this.result = result; this.phase = 'review';
    this.log.push({ t: this.time, kind: 'end', result, contained });
    this.score = this._score(result, contained);
    this.emit('end', { result, contained, score: this.score });
  }

  _score(result, contained) {
    if (result !== 'win') return Math.max(0, Math.round(this.uptime * 2 + this.data));
    const detect = this.firstDetection == null ? 0 : Math.max(0, 120 - this.firstDetection * 1.5);
    return Math.round(this.uptime * 3 + this.data * 2 + this.budget * 4 + detect + (contained ? 160 : 60));
  }

  // view helper for rendering attacker visibility
  knownIntruderRoom() { return this.intruder.revealed ? this.intruder.room : null; }
}
