// Engine — game state + simulation. Framework-free. The UI registers listeners and
// re-renders on 'change'. Time advances via tick(realDt); the harness (main.js) owns
// the timer so the engine stays easy to test headlessly.
//
// Core idea (fog-of-war): the attacker's plan is ground truth, but the player only
// sees evidence that a *deployed sensor* is watching for, at the moment it happens.
// XDR correlates >=2 visible clue types into a CONFIRMED incident; MDR adds analyst
// recommendations and one assisted containment.

import { PRODUCTS } from '../data/products.js';

let uid = 0;
const nid = () => ++uid;

export class Game {
  constructor(level) {
    this.level = level;
    this.time = 0;
    this.running = false;
    this.speed = 1;
    this.ended = null;                 // null | 'win' | 'lose-breach' | 'lose-uptime'

    this.budget = level.startBudget;
    this._incomeAcc = 0;

    this.uptime = 100;
    this.data = 100;

    this.rooms = new Map(level.rooms.map(r => [r.id, { ...r, locked: false, lockedAt: 0 }]));

    // deployment bookkeeping
    this.deployed = [];                // { product, slot }
    this.bySlot = new Map();           // slotId -> product id (perimeter/gateway/network/command/roster)
    this.edrRooms = new Set();
    this.astorRooms = new Set();

    this.planIndex = 0;
    this.attacker = { node: 'outside', contained: false, failed: false, delay: 0, revealed: false };

    this.evidence = [];                // all ground-truth evidence (for replay)
    this.clues = [];                   // visible to player
    this.cluesTypesSeen = new Set();
    this.incidentConfirmed = false;
    this.firstDetectionTime = null;
    this._mdrAssisted = false;

    this.log = [];                     // replay log (attacker + player + outcomes)
    this._sophiaFired = new Set();

    this.listeners = { change: [], sophia: [], toast: [], end: [] };
  }

  // --- events ---
  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); return this; }
  _emit(evt, payload) { (this.listeners[evt] || []).forEach(fn => fn(payload, this)); }
  _changed() { this._emit('change'); }

  // --- helpers ---
  has(slotId) { return this.bySlot.has(slotId); }
  get hasAF()  { return this.bySlot.get('perimeter') === 'AF'; }
  get hasIAG() { return this.bySlot.get('gateway') === 'IAG'; }
  get hasNDR() { return this.bySlot.get('network') === 'NDR'; }
  get hasXDR() { return this.bySlot.get('command') === 'XDR'; }
  get hasMDR() { return this.bySlot.get('roster') === 'MDR'; }

  // Which product can go in which slot/room (for highlighting during placement).
  canPlace(productId, targetId) {
    const p = PRODUCTS[productId];
    if (!p) return false;
    if (p.slotType === 'room')  return this.rooms.has(targetId) && !this.edrRooms.has(targetId);
    if (p.slotType === 'vault') return this.rooms.has(targetId) && !this.astorRooms.has(targetId);
    // single fixed slots
    return targetId === this._slotFor(productId) && !this.bySlot.has(targetId);
  }

  _slotFor(productId) {
    return { AF: 'perimeter', IAG: 'gateway', NDR: 'network', XDR: 'command', MDR: 'roster' }[productId];
  }

  eligibleTargets(productId) {
    const p = PRODUCTS[productId];
    if (!p) return [];
    if (p.slotType === 'room')  return this.level.rooms.filter(r => !this.edrRooms.has(r.id)).map(r => r.id);
    if (p.slotType === 'vault') return this.level.rooms.filter(r => !this.astorRooms.has(r.id)).map(r => r.id);
    const s = this._slotFor(productId);
    return this.bySlot.has(s) ? [] : [s];
  }

  // --- actions ---
  deploy(productId, targetId) {
    const p = PRODUCTS[productId];
    if (!p || this.ended) return { ok: false };
    if (this.budget < p.cost) { this._emit('toast', { kind: 'warn', key: 'panel.cantAfford' }); return { ok: false }; }
    if (!this.canPlace(productId, targetId)) return { ok: false };

    this.budget -= p.cost;
    this.deployed.push({ product: productId, slot: targetId });
    if (p.slotType === 'room') this.edrRooms.add(targetId);
    else if (p.slotType === 'vault') this.astorRooms.add(targetId);
    else this.bySlot.set(targetId, productId);

    this.log.push({ t: this.time, kind: 'deploy', product: productId, target: targetId });

    // Deploying XDR may immediately confirm if enough clue types are already visible.
    this._checkCorrelation();
    this._checkSophia();
    this._changed();
    return { ok: true };
  }

  // Isolate a room (EDR response). Contains the attacker only if they're actually there.
  isolate(roomId) {
    if (this.ended || !this.edrRooms.has(roomId)) return { ok: false, reason: 'needEdr' };
    if (this.attacker.node === roomId && !this.attacker.contained) {
      this.attacker.contained = true;
      this._resolveClues();
      this.log.push({ t: this.time, kind: 'respond', action: 'isolate', room: roomId, result: 'contained' });
      this._emit('toast', { kind: 'good', key: 'resp.contained' });
      this._changed();
      return { ok: true, contained: true };
    }
    // Isolating the wrong room disrupts that part of the business.
    this.uptime = Math.max(0, this.uptime - 12);
    this.log.push({ t: this.time, kind: 'respond', action: 'isolate', room: roomId, result: 'wrong' });
    this._emit('toast', { kind: 'bad', key: 'resp.wrongRoom' });
    this._changed();
    return { ok: true, contained: false };
  }

  // Recover a locked room (aStor). Restores it and claws back uptime.
  recover(roomId) {
    const r = this.rooms.get(roomId);
    if (this.ended || !r || !r.locked) return { ok: false };
    if (!this.astorRooms.has(roomId) && this.astorRooms.size === 0) { this._emit('toast', { kind: 'warn', key: 'resp.needAstor' }); return { ok: false }; }
    r.locked = false;
    this.uptime = Math.min(100, this.uptime + 14);
    this.log.push({ t: this.time, kind: 'respond', action: 'recover', room: roomId });
    this._emit('toast', { kind: 'good', key: 'panel.deployed' });
    this._changed();
    return { ok: true };
  }

  // --- simulation ---
  start() { this.running = true; this._fireSophia('intro'); this._changed(); }
  pause() { this.running = false; this._changed(); }
  resume() { if (!this.ended) { this.running = true; this._changed(); } }
  setSpeed(s) { this.speed = s; this._changed(); }

  tick(realDt) {
    if (!this.running || this.ended) return;
    const dt = realDt * this.speed;
    this.time += dt;

    // business income
    this._incomeAcc += dt;
    while (this._incomeAcc >= this.level.incomeEvery) { this._incomeAcc -= this.level.incomeEvery; this.budget += 1; }

    // locked rooms drain uptime over time
    let lockedCount = 0;
    for (const r of this.rooms.values()) if (r.locked) lockedCount++;
    if (lockedCount) this.uptime = Math.max(0, this.uptime - this.level.uptimeLossPerLockedRoom * 0.1 * dt * lockedCount);

    this._advancePlan();
    this._checkCorrelation();
    this._mdrAssist();
    this._checkSophia();
    this._checkEnd();
    this._changed();
  }

  _advancePlan() {
    const plan = this.level.plan;
    while (this.planIndex < plan.length) {
      const step = plan[this.planIndex];
      if (this.attacker.contained || this.attacker.failed) break;
      if (this.time < step.t + this.attacker.delay) break;
      this.planIndex++;
      this._execStep(step);
    }
  }

  _execStep(step) {
    // Perimeter intrusion: AF blocks it (loud early warning) but buys time, not victory.
    if (step.act === 'intrude') {
      const blocked = this.hasAF;
      this._evidence(step, { blocked });
      if (blocked) { this.attacker.delay += 8; this._fireSophia('exploitBlocked'); }
      return;
    }
    if (step.act === 'foothold') { this.attacker.node = step.node; this._evidence(step); return; }
    if (step.act === 'move')     { this.attacker.node = step.node; this._evidence(step); return; }
    if (step.act === 'recon' || step.act === 'cred' || step.act === 'collect') { this._evidence(step); return; }

    if (step.act === 'ransom') {
      const prevented = this.edrRooms.has(step.node);   // EDR honeypot stops it in seconds
      this._evidence(step, { prevented });
      if (prevented) {
        this._emit('toast', { kind: 'good', key: 'resp.contained' });
      } else {
        const r = this.rooms.get(step.locks);
        if (r) { r.locked = true; r.lockedAt = this.time; }
        this._fireSophia('ransomLock');
      }
      return;
    }

    if (step.act === 'exfil') {
      const blocked = this.hasIAG;
      this._evidence(step, { blocked });
      if (blocked) {
        this.attacker.failed = true;                    // DLP stopped the objective
        this._emit('toast', { kind: 'good', key: 'resp.contained' });
      } else {
        this.data = 8;                                  // crown jewels gone
        this.attacker.failed = true;
        this._end('lose-breach');
      }
      return;
    }
  }

  // Record ground-truth evidence and decide if the player can SEE it right now.
  _evidence(step, extra = {}) {
    const ev = { id: nid(), t: this.time, type: step.ev, node: step.node, act: step.act, truth: step.truth, ...extra };
    this.evidence.push(ev);

    const visible = this._isVisible(ev);
    this.log.push({ t: this.time, kind: 'attack', act: step.act, node: step.node, ev: step.ev, blocked: !!extra.blocked, prevented: !!extra.prevented, visible });
    if (!visible) return;

    if (this.firstDetectionTime == null) this.firstDetectionTime = this.time;
    this.cluesTypesSeen.add(ev.type);
    this.clues.push({
      id: ev.id, type: ev.type, node: ev.node, t: this.time,
      confidence: this.incidentConfirmed ? 'confirmed' : 'weak',
      blocked: !!extra.blocked, prevented: !!extra.prevented, resolved: false,
    });
    if (this.clues.length === 1) this._fireSophia('firstClueWeak');
    this._emit('toast', { kind: 'info', clue: ev.type });
  }

  _isVisible(ev) {
    switch (ev.type) {
      case 'exploit':  return this.hasAF;
      case 'endpoint': return this.edrRooms.has(ev.node);
      case 'network':  return this.hasNDR;
      case 'exfil':    return this.hasIAG;
      default:         return false;
    }
  }

  _checkCorrelation() {
    if (!this.incidentConfirmed && this.hasXDR && this.cluesTypesSeen.size >= 2) {
      this.incidentConfirmed = true;
      this.attacker.revealed = true;
      for (const c of this.clues) if (!c.resolved) c.confidence = 'confirmed';
      this._fireSophia('confirmed');
      this._emit('toast', { kind: 'good', key: 'clue.confirmed' });
    }
    // XDR reveals the live attacker location once confirmed.
    if (this.incidentConfirmed) this.attacker.revealed = true;
  }

  _mdrAssist() {
    if (!this.hasMDR || this._mdrAssisted || this.attacker.contained || this.attacker.failed) return;
    // If the attacker is about to hit the Vault and the player hasn't acted, MDR assists
    // once — but only if an EDR exists in the attacker's current room to execute on.
    if (this.attacker.node === 'r_vault' && this.edrRooms.has('r_vault')) {
      this.attacker.contained = true;
      this._mdrAssisted = true;
      this._resolveClues();
      this.log.push({ t: this.time, kind: 'mdr', action: 'assist-contain', room: 'r_vault' });
      this._emit('toast', { kind: 'good', key: 'resp.contained' });
    }
  }

  _resolveClues() { for (const c of this.clues) c.resolved = true; }

  _checkEnd() {
    if (this.ended) return;
    if (this.uptime <= this.level.loseUptimeBelow) { this._end('lose-uptime'); return; }
    if (this.time >= this.level.duration) { this._end('win'); return; }
  }

  _end(result) {
    if (this.ended) return;
    this.ended = result;
    this.running = false;
    this.log.push({ t: this.time, kind: 'end', result });
    this.score = this._score(result);
    this._emit('end', { result, score: this.score });
  }

  _score(result) {
    if (result !== 'win') return Math.max(0, Math.round(this.uptime * 2 + this.data));
    const detectBonus = this.firstDetectionTime == null ? 0 : Math.max(0, 120 - this.firstDetectionTime * 2);
    const contained = this.attacker.contained ? 150 : (this.attacker.failed ? 60 : 0);
    return Math.round(this.uptime * 3 + this.data * 2 + this.budget * 5 + detectBonus + contained);
  }

  // --- Sophia hint triggers (each fires at most once) ---
  _checkSophia() {
    if (this.time > 10 && this.clues.length === 0 && this.deployed.filter(d => PRODUCTS[d.product].sees.length).length === 0)
      this._fireSophia('noSensors');
    if (!this.hasXDR && this.cluesTypesSeen.size >= 2) this._fireSophia('needCorrelate');
    if (this.attacker.node === 'r_vault' && !this.hasIAG && !this.attacker.contained && !this.attacker.failed)
      this._fireSophia('exfilImminent');
  }

  _fireSophia(id) { if (this._sophiaFired.has(id)) return; this._sophiaFired.add(id); this._emit('sophia', { id }); }

  // --- view for the UI ---
  getView() {
    const roomView = {};
    for (const r of this.rooms.values()) {
      const recent = this.clues.filter(c => !c.resolved && c.node === r.id && (this.time - c.t) < 9);
      roomView[r.id] = {
        locked: r.locked,
        hasEdr: this.edrRooms.has(r.id),
        hasAstor: this.astorRooms.has(r.id),
        suspected: recent.length > 0,
        confirmedHere: this.incidentConfirmed && this.attacker.node === r.id && !this.attacker.contained && !this.attacker.failed,
      };
    }
    return { roomView, attackerVisible: this.attacker.revealed ? this.attacker.node : null };
  }
}
