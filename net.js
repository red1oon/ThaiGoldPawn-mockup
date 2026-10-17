// Shop + phone parties, the "wire" (any channel), auto-notify, SlipOK processing (spec §15). POC: both parties live in this page;
// a real phone opens the link (#/t/<token>) and is the phone party alone.
(function (root) {
  const T = root.Token, P = root.Pay, C = root.Calc;
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const CHANNELS = ['web', 'qr', 'link', 'email', 'whatsapp', 'line', 'sms', 'nfc'];
  const Net = {
    today: '2025-09-25', shopAcct: 'xxx-x-x5678-x', shopPhone: '0800000000', solo: null,
    keys: {}, shopL: {}, sample: {}, phoneL: null, wire: [], online: { shop: true, phone: true }, seq: 0, tick: 0, nextNo: 161, claimSeq: 0, listeners: [],
    clientId: Math.random().toString(36).slice(2),
    all() { return { ...this.sample, ...this.shopL }; },
    on(fn) { this.listeners.push(fn); }, emit() { this.listeners.forEach(f => f()); },
    ts() { return Date.parse(this.today + 'T09:00:00Z') + (++this.tick) * 1000; },

    async init() {
      for (const who of ['shop', 'phone']) {
        let k; try { k = JSON.parse(store.get('gp.key.' + who)); } catch (e) {}
        if (!k) { k = await T.newKey(); store.set('gp.key.' + who, JSON.stringify(k)); }
        this.keys[who] = k;
      }
      try { const pj = JSON.parse(store.get('gp.phone.ledger')); if (pj) this.phoneL = this.hydrate(pj, 'phone'); } catch (e) {}
      try { const sj = JSON.parse(store.get('gp.shop.live') || '[]'); sj.forEach(j => { this.shopL[j.tk] = this.hydrate(j, 'shop'); }); } catch (e) {}
      try { this.bc = new BroadcastChannel('gp-web'); this.bc.onmessage = ev => this.onWeb(ev.data); } catch (e) { this.bc = null; }
    },
    hydrate(j, me) { const l = new T.Ledger(j.tk, me, this.keys[me]); l.chain = j.chain; return l; },
    persist() {
      if (this.phoneL) store.set('gp.phone.ledger', JSON.stringify({ tk: this.phoneL.tk, chain: this.phoneL.chain }));
      store.set('gp.shop.live', JSON.stringify(Object.values(this.shopL).filter(l => l.live).map(l => ({ tk: l.tk, chain: l.chain }))));
    },

    // ---- shop: issue (spec §15.2.1) ----
    async issueOffer(o) {
      const tk = 'A' + (this.nextNo++), l = new T.Ledger(tk, 'shop', this.keys.shop); l.live = true;
      const code = String(100000 + Math.floor(Math.random() * 899999));
      await l.append('offer', { ...o, pub: T.pubOf(this.keys.shop.pub), code, shopAcct: this.shopAcct, shopPhone: this.shopPhone }, this.ts());
      this.shopL[tk] = l; this.persist(); this.emit(); return tk;
    },
    // ---- carrying a token over a channel ----
    send(from, channel, tk) {
      const l = from === 'shop' ? this.shopL[tk] : this.phoneL; if (!l) return null;
      const token = l.makeToken(), id = ++this.seq, to = from === 'shop' ? 'phone' : 'shop';
      const w = { id, from, to, channel, tk, token, state: 'inflight', n: l.head(from).n, size: token.length };
      this.wire.push(w);
      if (channel === 'web') {                               // "web server": delivered whenever the receiver is online
        if (this.bc) this.bc.postMessage({ client: this.clientId, w: { tk, from, token } });
        if (!this.solo && this.online[to]) return this.deliver(id).then(() => w);
      }
      this.emit(); return Promise.resolve(w);
    },
    async deliver(id) {
      const w = this.wire.find(x => x.id === id); if (!w || w.state === 'delivered') return null;
      if (!this.online[w.to] && w.channel === 'web') { this.emit(); return w; }       // web server: waits until online
      let l = w.to === 'shop' ? this.shopL[w.tk] : this.phoneL;
      if (!l && w.to === 'phone') { l = this.phoneL = new T.Ledger(w.tk, 'phone', this.keys.phone); }
      if (!l) { w.state = 'lost'; w.result = { ok: false, why: 'no-ledger' }; this.emit(); return w; }
      w.result = await l.receive(w.token, w.channel); w.state = w.result.ok ? 'delivered' : 'refused';
      this.persist();
      if (w.to === 'shop' && w.result.ok) await this.shopProcess(w.tk);
      this.emit(); return w;
    },
    lose(id) { const w = this.wire.find(x => x.id === id); if (w && w.state === 'inflight') { w.state = 'lost'; this.emit(); } },
    dup(id) { const w = this.wire.find(x => x.id === id); if (w) { this.wire.push({ ...w, id: ++this.seq, state: 'inflight', result: null, dupOf: id }); this.emit(); } },
    // any pasted token / opened link / NFC tap / cross-tab message
    async receiveRaw(token, side, via) {
      let t; try { t = JSON.parse(T.unb64u(token)); } catch (e) { return { ok: false, why: 'unreadable' }; }
      const w = { id: ++this.seq, from: t.from, to: side, channel: via, tk: t.tk, token, state: 'inflight', n: t.head.n, size: token.length };
      this.wire.push(w); return this.deliver(w.id);
    },
    onWeb(m) {
      if (m.client === this.clientId) return;
      const side = this.solo || 'shop'; if (m.w.from === side) return;
      this.receiveRaw(m.w.token, side, 'web');
    },
    setOnline(side, on) {
      this.online[side] = on; this.emit();
      if (on) this.flush(side);
    },
    // auto-notify: queued web tokens + unsent own events go out when the side comes online
    async flush(side) {
      for (const w of this.wire.filter(x => x.to === side && x.channel === 'web' && x.state === 'inflight')) await this.deliver(w.id);
      const l = side === 'phone' ? this.phoneL : null;
      if (l && l.outbox) { l.outbox = false; await this.send('phone', 'web', l.tk); }
      this.emit();
    },

    // ---- phone actions ----
    openOffer(tk) {                                          // "scan the QR": take the latest shop token for tk from the wire
      const w = [...this.wire].reverse().find(x => x.tk === tk && x.from === 'shop'); if (!w) return null;
      return this.deliver(w.id);
    },
    async phoneAck(code, via) {
      const l = this.phoneL; const off = l.chain.shop[0].body;
      if (String(code) !== String(off.code)) return { ok: false, why: 'code' };
      await l.append('ack', { pub: T.pubOf(this.keys.phone.pub), phone: off.phone }, this.ts());
      this.persist(); await this.phoneSend(via || 'web'); return { ok: true };
    },
    async phoneSend(via) {
      if (via === 'web' && !this.online.phone) { this.phoneL.outbox = true; this.emit(); return null; }   // offline: queued, goes when online
      return this.send('phone', via, this.phoneL.tk);
    },
    async phoneClaim(mode, amount, slipKind, via) {
      const l = this.phoneL, st = P.fold(l, this.today), set = this.set || { taxPoint: 'interest' };
      const q = P.quote(st, mode, amount, this.today, set); if (q.error) return q;
      const claimNo = st.claims.length + 1;
      const slip = P.SlipOK.makeSlip(q.total, slipKind || 'ok', st.shopAcct, 1000 + this.seq + st.claims.length);
      await l.append('payment_claim', { claimNo, mode, amount: q.total, ask: amount || 0, slip }, this.ts());
      this.persist(); await this.phoneSend(via || 'web'); return { ok: true, q, slip };
    },
    // ---- shop: pick up claims, verify slip (mock SlipOK), book, notify ----
    async shopProcess(tk) {
      const l = this.shopL[tk]; if (!l || !this.online.shop) return;
      const st = P.fold(l, this.today), set = this.set || { taxPoint: 'interest' };
      let seen = [...st.seenRefs], did = false;
      for (const c of st.claims.filter(x => x.status === 'pending')) {
        const cur = P.fold(l, this.today);
        // money paid is what the slip proves: if the quote moved since the claim (an earlier payment landed first), allocate the
        // slip amount interest-first as 'other' instead of refusing paid money
        let q = P.quote(cur, c.mode, c.ask, this.today, set), re = false;
        if (q.error || Math.abs(q.total - c.amount) > 0.005) { q = P.quote(cur, 'other', c.amount, this.today, set); re = true; }
        const res = q.error ? { success: false, code: 'BAD_AMOUNT' } : P.SlipOK.verify(c.slip, { amount: c.amount, receiver: this.shopAcct }, seen);
        if (res.success) {
          await l.append('payment_verified', { claimNo: c.claimNo, mode: c.mode, realloc: re, amt: q.total, int: q.int, vat: q.vat, principalPart: q.principalPart,
            coverTo: q.coverTo, credit: q.credit, untaxed: q.untaxed, reissue: q.reissue ? { no: 'A' + (this.nextNo++), ref: tk, first: tk } : null,
            slip: { transRef: c.slip.transRef } }, this.ts());
          seen.push(c.slip.transRef);
        } else await l.append('payment_rejected', { claimNo: c.claimNo, reason: res.code }, this.ts());
        did = true;
      }
      if (did) { this.persist(); await this.send('shop', 'web', tk); }       // notify the borrower automatically
    },
    share(channel, token) {
      const base = (typeof location !== 'undefined' ? location.href.split('#')[0] : 'https://red1oon.github.io/ThaiGoldPawn-mockup/');
      const link = base + '#/t/' + token, q = encodeURIComponent;
      return { link, href: { email: 'mailto:?subject=' + q('Gold pawn') + '&body=' + q(link), whatsapp: 'https://wa.me/?text=' + q(link),
        line: 'https://line.me/R/msg/text/?' + q(link), sms: 'sms:?&body=' + q(link) }[channel] || link };
    },
    async nfcWrite(link) {
      if (!('NDEFReader' in root)) return { ok: false, why: 'unsupported' };
      try { await new root.NDEFReader().write({ records: [{ recordType: 'url', data: link }] }); return { ok: true }; } catch (e) { return { ok: false, why: String(e.message || e) }; }
    },
    // dashboard demo: change a verified amount in the shop's local copy; verifyAll will show it
    tamper(tk) {
      const l = this.all()[tk]; const e = l && l.chain.shop.find(x => x.type === 'payment_verified'); if (!e) return false;
      l.tamper = { e, old: e.body.amt }; e.body.amt = e.body.amt - 100; this.emit(); return true;
    },
    repair(tk) { const l = this.all()[tk]; if (l && l.tamper) { l.tamper.e.body.amt = l.tamper.old; l.tamper = null; this.emit(); } }
  };
  root.Net = Net;
})(window);
