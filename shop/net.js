// Shop + phone parties, the "wire" (any channel), auto-notify, SlipOK processing (spec §15). POC: both parties live in this page;
// a real phone opens the link (#/t/<token>) and is the phone party alone.
(function (root) {
  const T = root.Token, P = root.Pay, C = root.Calc;
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const S = root.Seal || (typeof require === 'function' ? require('./seal.js') : null);
  // device key store: CryptoKey objects live in IndexedDB (structured clone keeps them NON-extractable); memory fallback where IndexedDB is missing (node, private windows)
  const KS = (() => {
    const mem = new Map(); let db = null;
    const open = () => new Promise((ok, no) => { if (typeof indexedDB === 'undefined') return no(new Error('no-idb')); const r = indexedDB.open('gp-keys', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
    return {
      async get(k) { try { db = db || await open(); return await new Promise((ok, no) => { const q = db.transaction('k').objectStore('k').get(k); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); }); } catch (e) { return mem.get(k); } },
      async put(k, v) { mem.set(k, v); try { db = db || await open(); await new Promise((ok, no) => { const tx = db.transaction('k', 'readwrite'); tx.objectStore('k').put(v, k); tx.oncomplete = ok; tx.onerror = () => no(tx.error); }); return true; } catch (e) { return false; } }
    };
  })();
  const CHANNELS = ['web', 'qr', 'link', 'email', 'whatsapp', 'line', 'sms', 'nfc'];
  const Net = {
    sealed: store.get('gp.sealed') !== '0', phoneCode: null, ecdh: {}, kids: {}, today: '2025-09-25', shopAcct: 'xxx-x-x5678-x', shopPhone: '0800000000', solo: null,
    keys: {}, shopL: {}, sample: {}, slipok: { refs: {}, attempts: {} }, slipokPackage: 'ok', crm: {}, price: 100000, nplDays: 90, phoneL: null, wire: [], online: { shop: true, phone: true }, seq: 0, tick: 0, nextNo: 161, claimSeq: 0, listeners: [],
    clientId: Math.random().toString(36).slice(2),
    all() { return { ...this.sample, ...this.shopL }; },
    on(fn) { this.listeners.push(fn); }, emit() { this.listeners.forEach(f => f()); },
    ts() { return Date.parse(this.today + 'T09:00:00Z') + (++this.tick) * 1000; },

    async init() {
      for (const who of ['shop', 'phone']) {
        let k; try { k = JSON.parse(store.get('gp.key.' + who)); } catch (e) {}
        if (who === 'phone' && this.sealed && !k) {                // the phone's keys are DEVICE-BOUND: non-extractable, kept in IndexedDB (spec §20.7)
          k = await KS.get('phone.sign'); if (!k) { k = await T.newKey({ bound: true }); k.stored = await KS.put('phone.sign', k); }
        } else if (!k) { k = await T.newKey(); store.set('gp.key.' + who, JSON.stringify(k)); }
        this.keys[who] = k;
      }
      // sealing keys: the shop's ECDH key is exportable on purpose (it is backed up, §19, so a restored shop can still open what phones sealed to it); the phone's is device-bound
      let es; try { es = JSON.parse(store.get('gp.ecdh.shop')); } catch (e) {} if (!es) { es = await S.genEcdh(false); store.set('gp.ecdh.shop', JSON.stringify(es)); } this.ecdh.shop = es;
      let ep = await KS.get('phone.ecdh'); if (!ep) { ep = await S.genEcdh(true); ep.stored = await KS.put('phone.ecdh', ep); } this.ecdh.phone = ep;
      try { const pj = JSON.parse(store.get('gp.phone.ledger')); if (pj) this.phoneL = this.hydrate(pj, 'phone'); } catch (e) {}
      try { const sj = JSON.parse(store.get('gp.shop.live') || '[]'); sj.forEach(j => { this.shopL[j.tk] = this.hydrate(j, 'shop'); }); } catch (e) {}
      try { JSON.parse(store.get('gp.crm') || '[]').forEach(j => { const l = this.hydrate(j, 'shop'); l.live = true; this.crm[j.tk.slice(4)] = l; }); } catch (e) {}
      try { this.bc = new BroadcastChannel('gp-web'); this.bc.onmessage = ev => this.onWeb(ev.data); } catch (e) { this.bc = null; }
    },
    // ---- CRM follow-up history (spec §15.7): shop-internal signed chain, never put in a token ----
    crmL(tk) { if (!this.crm[tk]) { const l = new T.Ledger('crm:' + tk, 'shop', this.keys.shop); l.live = !!this.shopL[tk]; this.crm[tk] = l; } return this.crm[tk]; },
    async logFollowup(tk, f, ts) {
      const l = this.crmL(tk), body = { ...f }; if (!l.chain.shop.length) body.pub = T.pubOf(this.keys.shop.pub);
      const e = await l.append('followup', body, ts || this.ts()); if (this.shopL[tk]) l.live = true; this.persist(); this.emit(); return e;
    },
    async logKyc(tk, k) {                                 // customer identification (spec §16.2): shop-internal signed chain, never in a token
      const l = this.crmL(tk), b = { ...k }; if (!l.chain.shop.length) b.pub = T.pubOf(this.keys.shop.pub); l.live = true;
      const e = await l.append('kyc', b, this.ts()); this.persist(); this.emit(); return e;
    },
    async logInternal(chain, type, body) {                 // generic shop-internal signed event (never in a token)
      const l = this.crmL(chain), b = { ...body }; l.live = true; if (!l.chain.shop.length) b.pub = T.pubOf(this.keys.shop.pub);
      const e = await l.append(type, b, this.ts()); this.persist(); this.emit(); return e;
    },
    // contact imports and broadcasts: signed, shop-internal chain (never put in a token)
    async logContact(type, body, ts) {
      const l = this.crmL('_contacts'), b = { ...body }; l.live = true; if (!l.chain.shop.length) b.pub = T.pubOf(this.keys.shop.pub);
      const e = await l.append(type, b, ts || this.ts()); this.persist(); this.emit(); return e;
    },
    followups(tk) { const l = this.crm[tk]; return l ? l.chain.shop.map(e => ({ ...e.body, ts: e.ts, n: e.n })) : []; },
    hydrate(j, me) { const l = new T.Ledger(j.tk, me, this.keys[me]); l.chain = j.chain; return l; },
    persist() {
      if (this.phoneL) store.set('gp.phone.ledger', JSON.stringify({ tk: this.phoneL.tk, chain: this.phoneL.chain }));
      store.set('gp.crm', JSON.stringify(Object.values(this.crm).filter(l => l.live).map(l => ({ tk: l.tk, chain: l.chain }))));
      store.set('gp.shop.live', JSON.stringify(Object.values(this.shopL).filter(l => l.live).map(l => ({ tk: l.tk, chain: l.chain }))));
    },

    // ---- shop: issue (spec §15.2.1) ----
    async issueOffer(o) {
      const tk = 'A' + (this.nextNo++), l = new T.Ledger(tk, 'shop', this.keys.shop); l.live = true;
      const code = String(100000 + Math.floor(Math.random() * 899999));
      await l.append('offer', { ...o, pub: T.pubOf(this.keys.shop.pub), ecdh: this.ecdh.shop.pub, code, shopAcct: this.shopAcct, shopPhone: this.shopPhone }, this.ts());
      this.shopL[tk] = l; this.persist(); this.emit(); return tk;
    },
    // ---- carrying a token over a channel ----
    // ---- sealing (spec §20.7): the token is signed, then encrypted to the recipient; carriers see {tk, kid_to, ct} only ----
    phoneEcdhOf(l) { const ev = [...l.chain.phone].reverse().find(e => e.body && e.body.ecdh); return ev ? ev.body.ecdh : null; },
    offerTokenFor(l) {                                       // the QR / link payload: the signed offer, sealed with the one-time code (computed once, cached)
      if (!this.sealed) return l.offerToken(); this.offerSealed = this.offerSealed || {}; this.offerPending = this.offerPending || {};
      if (this.offerSealed[l.tk]) return this.offerSealed[l.tk];
      if (!this.offerPending[l.tk]) { this.offerPending[l.tk] = true; S.sealCode(T.unb64u(l.offerToken()), l.chain.shop[0].body.code, l.tk).then(env => { this.offerSealed[l.tk] = S.wrap(env); this.emit(); }); }
      return '';
    },
    async sealToken(token, from, l) {
      if (!this.sealed) return { token, sealed: false };
      const raw = T.unb64u(token);                                  // seal the raw JSON (not its base64) so the wire string stays short enough for a QR
      if (from === 'phone') { const pub = l.chain.shop[0] && l.chain.shop[0].body.ecdh; return pub ? { token: S.wrap(await S.seal(raw, pub, l.tk)), sealed: true } : { token, sealed: false }; }
      const pp = this.phoneEcdhOf(l); if (pp) return { token: S.wrap(await S.seal(raw, pp, l.tk)), sealed: true };
      const code = l.chain.shop[0] && l.chain.shop[0].body.code; return code ? { token: S.wrap(await S.sealCode(raw, code, l.tk)), sealed: true, byCode: true } : { token, sealed: false };
    },
    async send(from, channel, tk) {
      const l = from === 'shop' ? this.shopL[tk] : this.phoneL; if (!l) return null;
      const sd = await this.sealToken(l.makeToken(), from, l), token = sd.token, id = ++this.seq, to = from === 'shop' ? 'phone' : 'shop';
      const w = { id, from, to, channel, tk, token, sealed: sd.sealed, byCode: !!sd.byCode, state: 'inflight', n: l.head(from).n, size: token.length };
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
      let tok = w.token;
      if (S.isSealed(tok)) {                                         // open the envelope at the recipient: by the one-time code (first offer) or by the recipient's own key
        const u = await this.unsealFor(w.to, tok);
        if (!u.ok) { w.state = u.why === 'need-code' || u.why === 'code' ? 'sealed' : 'refused'; w.result = { ok: false, why: u.why }; this.emit(); return w; }
        tok = u.plain.startsWith('{') && !u.plain.includes('"peer"') ? T.b64u(u.plain) : u.plain; w.sealed = true;
        if (w.to === 'phone' && tok.includes('"peer"')) return this.phoneReenrolFrom(tok, w);     // a re-enrolment package for a new device
      }
      let l = w.to === 'shop' ? this.shopL[w.tk] : this.phoneL;
      if (!l && w.to === 'phone') { l = this.phoneL = new T.Ledger(w.tk, 'phone', this.keys.phone); }
      if (!l) { w.state = 'lost'; w.result = { ok: false, why: 'no-ledger' }; this.emit(); return w; }
      w.result = await l.receive(tok, w.channel); w.state = w.result.ok ? 'delivered' : 'refused';
      this.persist();
      if (w.to === 'shop' && w.result.ok) await this.shopProcess(w.tk);
      this.emit(); return w;
    },
    lose(id) { const w = this.wire.find(x => x.id === id); if (w && w.state === 'inflight') { w.state = 'lost'; this.emit(); } },
    dup(id) { const w = this.wire.find(x => x.id === id); if (w) { this.wire.push({ ...w, id: ++this.seq, state: 'inflight', result: null, dupOf: id }); this.emit(); } },
    // any pasted token / opened link / NFC tap / cross-tab message
    async unsealFor(side, tok) {
      const env = S.unwrapEnv(tok); if (!env) return { ok: false, why: 'unreadable' };
      if (env.kdf) {                                               // sealed with the one-time code: only the phone can open it, and only after the code is entered
        if (side !== 'phone') return { ok: false, why: 'not-for-me' }; if (!this.phoneCode) return { ok: false, why: 'need-code' };
        const r = await S.unsealCode(env, this.phoneCode); if (!r.ok) { this.phoneCode = null; return { ok: false, why: 'code' }; } return r;
      }
      const k = this.ecdh[side]; return k ? S.unseal(env, k.priv, k.kid) : { ok: false, why: 'no-key' };
    },
    async receiveRaw(token, side, via) {
      if (S.isSealed(token)) {
        const env = S.unwrapEnv(token); if (!env) return { ok: false, why: 'unreadable' };
        const w = { id: ++this.seq, from: side === 'phone' ? 'shop' : 'phone', to: side, channel: via, tk: env.tk, token, sealed: true, state: 'inflight', n: 0, size: token.length };
        this.wire.push(w); return this.deliver(w.id);
      }
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
    openOffer(tk) {                                          // "scan the QR": take the latest shop token for tk from the wire (if sealed it waits for the code)
      const w = [...this.wire].reverse().find(x => x.tk === tk && x.from === 'shop'); if (!w) return null;
      return this.deliver(w.id);
    },
    // the phone types the one-time code: it opens the sealed offer (a wrong code opens nothing and is forgotten)
    async phoneOpen(code) {
      this.phoneCode = String(code == null ? '' : code).trim(); const ws = this.wire.filter(x => x.to === 'phone' && x.state === 'sealed');
      if (!ws.length) return { ok: false, why: 'nothing-waiting' };
      let last = null; for (const w of ws.reverse()) { last = await this.deliver(w.id); if (last.state === 'delivered') break; }
      this.emit(); return last && last.state === 'delivered' ? { ok: true } : { ok: false, why: last && last.result ? last.result.why : 'code' };
    },
    async phoneAck(code, via) {
      const l = this.phoneL; const off = l.chain.shop[0].body;
      const given = code != null && code !== '' ? String(code) : (this.phoneCode || '');
      if (given !== String(off.code)) return { ok: false, why: 'code' };
      await l.append('ack', { pub: T.pubOf(this.keys.phone.pub), ecdh: this.ecdh.phone.pub, phone: off.phone }, this.ts());
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
    // ---- lost phone (spec §20.7): the shop revokes the phone's key and hands out a NEW one-time code; the new device enrols with proof of that code ----
    async shopRevoke(tk, reason) {
      const l = this.shopL[tk]; if (!l || !l.chain.phone.length) return { ok: false, why: 'no-phone' };
      const code2 = String(100000 + Math.floor(Math.random() * 899999)); await l.revokePhone(reason, code2, this.ts());
      const token = S.wrap(await S.sealCode(l.reenrolPlain(), code2, tk)); this.persist(); this.emit(); return { ok: true, code: code2, token, link: this.share('link', token).link };
    },
    async phoneReenrolFrom(plain, w) {                       // the new device: fresh DEVICE-BOUND keys, take the history, enrol (the old key is already revoked by the shop)
      const code = this.phoneCode; this.keys.phone = await T.newKey({ bound: true }); this.keys.phone.stored = await KS.put('phone.sign', this.keys.phone);
      this.ecdh.phone = await S.genEcdh(true); this.ecdh.phone.stored = await KS.put('phone.ecdh', this.ecdh.phone);
      const l = this.phoneL = await T.Ledger.fromReenrol(plain, this.keys.phone); await l.enrol(code, this.ts(), { ecdh: this.ecdh.phone.pub });
      w.state = 'delivered'; w.result = { ok: true, reenrol: true }; this.persist(); await this.phoneSend('web'); this.emit(); return w;
    },
    async kidOf(pub) { const k = pub.x; if (!this.kids[k]) this.kids[k] = await S.kidOf(pub); return this.kids[k]; },
    kidText(pub) { if (!pub) return ''; const c = this.kids[pub.x]; if (c) return c.slice(0, 12); this.kidOf(pub).then(() => this.emit()); return '…'; },
    // ---- shop: pick up claims, call SlipOK (mock, real response shape), book, attach the response, notify ----
    async shopProcess(tk, opt) {
      const l = this.shopL[tk]; if (!l || !this.online.shop) return;
      const retry = !!(opt && opt.retry), set = this.set || { taxPoint: 'interest' };
      let did = false;
      const todo = P.fold(l, this.today).claims.filter(x => x.status === 'pending' || (retry && x.status === 'waiting'));
      for (const c of todo) {
        const cur = P.fold(l, this.today);
        // money paid is what the slip proves: if the quote moved since the claim (an earlier payment landed first), allocate the
        // slip amount interest-first as 'other' instead of refusing paid money
        let q = P.quote(cur, c.mode, c.ask, this.today, set), re = false;
        if (q.error || Math.abs(q.total - c.amount) > 0.005) { q = P.quote(cur, 'other', c.amount, this.today, set); re = true; }
        if (q.error) { await l.append('payment_rejected', { claimNo: c.claimNo, reason: 'BAD_AMOUNT', message: 'amount cannot be applied' }, this.ts()); did = true; continue; }
        const req = { amount: c.amount, log: true }; if (c.slip.qrData) req.data = c.slip.qrData; else req.files = 'slip-image';
        const res = P.SlipOK.call(c.slip, req, this.slipok, { shopAcct: this.shopAcct, package: this.slipokPackage });
        if (res.success) {
          const json = { success: true, data: res.data };
          const attachment = { AD_Table: 'PAWN_Payment', title: 'slipok_' + res.data.transRef + '.json', contentType: 'application/json', sha256: await T.sha(T.canon(json)), json };
          await l.append('payment_verified', { claimNo: c.claimNo, mode: c.mode, realloc: re, amt: q.total, int: q.int, vat: q.vat, principalPart: q.principalPart,
            coverTo: q.coverTo, credit: q.credit, untaxed: q.untaxed, reissue: q.reissue ? { no: 'A' + (this.nextNo++), ref: tk, first: tk } : null,
            tender: 'transfer', slip: { transRef: res.data.transRef }, attachment }, this.ts());
        } else if (P.SlipOK.WAIT_CODES.includes(res.code)) {                    // not the borrower's fault: wait and re-check (spec §15.3)
          await l.append('payment_wait', { claimNo: c.claimNo, code: res.code, message: res.message, delay: res.data && res.data.delay || null, shopAlert: res.code === '1003' || res.code === '1004' }, this.ts());
        } else {
          const att = res.data ? { AD_Table: 'PAWN_Payment', title: 'slipok_' + (res.data.transRef || c.slip.transRef) + '_' + res.code + '.json', contentType: 'application/json', sha256: await T.sha(T.canon(res)), json: res } : null;
          await l.append('payment_rejected', { claimNo: c.claimNo, reason: res.code, message: res.message, ...(att ? { attachment: att } : {}) }, this.ts());
        }
        did = true;
      }
      if (did) { this.persist(); await this.send('shop', 'web', tk); }       // notify the borrower automatically
    },
    async shopRetry(tk) { await this.shopProcess(tk, { retry: true }); this.emit(); },
    share(channel, token) {
      const base = (typeof location !== 'undefined' ? location.href.split('#')[0] : 'https://red1oon.github.io/ThaiGoldPawn-mockup/shop/');
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
