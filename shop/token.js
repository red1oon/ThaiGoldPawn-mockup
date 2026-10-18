// Tamper-proof async exchange (spec §15.1). A message is a self-verifying TOKEN: signed, hash-chained.
// The carrying channel (QR, link, email, WhatsApp, SMS, NFC, web server) is untrusted and irrelevant.
(function (root) {
  const nodeCrypto = typeof require === 'function' && typeof module !== 'undefined' ? require('crypto') : null;
  const webcrypto = root.crypto && root.crypto.subtle ? root.crypto : nodeCrypto.webcrypto;
  const subtle = webcrypto.subtle, enc = new TextEncoder(), dec = new TextDecoder();

  // canonical JSON: sorted keys, so hash is independent of property order
  const canon = v => v === null || typeof v !== 'object' ? JSON.stringify(v)
    : Array.isArray(v) ? '[' + v.map(canon).join(',') + ']'
    : '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
  const sha = async s => hex(await subtle.digest('SHA-256', enc.encode(s)));
  const b64u = s => { const b = enc.encode(s); let r = ''; b.forEach(c => r += String.fromCharCode(c)); return btoa(r).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = t => { const r = atob(t.replace(/-/g, '+').replace(/_/g, '/')); return dec.decode(Uint8Array.from(r, c => c.charCodeAt(0))); };

  const ALG = { name: 'ECDSA', namedCurve: 'P-256' }, SIG = { name: 'ECDSA', hash: 'SHA-256' };
  async function newKey() {
    const k = await subtle.generateKey(ALG, true, ['sign', 'verify']);
    return { priv: await subtle.exportKey('jwk', k.privateKey), pub: await subtle.exportKey('jwk', k.publicKey) };
  }
  const pubOf = jwk => ({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y });
  const sign = async (privJwk, h) => hex(await subtle.sign(SIG, await subtle.importKey('jwk', privJwk, ALG, false, ['sign']), enc.encode(h)));
  const verifySig = async (pubJwk, h, sig) => {
    try { return await subtle.verify(SIG, await subtle.importKey('jwk', pubOf(pubJwk), ALG, false, ['verify']), unhex(sig), enc.encode(h)); }
    catch (e) { return false; }
  };

  const core = e => ({ tk: e.tk, by: e.by, n: e.n, prev: e.prev, seen: e.seen, type: e.type, body: e.body, ts: e.ts });
  const hashOf = e => sha(canon(core(e)));

  // One ledger per ticket, held by each party. Two linear chains (one per author) → no forks.
  class Ledger {
    constructor(tk, me, key) {                 // me: 'shop' | 'phone'; key: {priv,pub}
      this.tk = tk; this.me = me; this.key = key;
      this.chain = { shop: [], phone: [] }; this.pending = []; this.log = [];   // log: receive audit
    }
    get peer() { return this.me === 'shop' ? 'phone' : 'shop'; }
    head(by) { const c = this.chain[by]; const e = c[c.length - 1]; return e ? { n: e.n, h: e.hash } : { n: 0, h: '' }; }
    async append(type, body, ts) {
      const mine = this.chain[this.me], seen = this.head(this.peer);
      const e = { tk: this.tk, by: this.me, n: mine.length + 1, prev: this.head(this.me).h, seen, type, body, ts };
      e.hash = await hashOf(e); e.sig = await sign(this.key.priv, e.hash);
      mine.push(e); return e;
    }
    pubKey(by) { const f = this.chain[by][0]; return f && f.body.pub; }     // each author's first event carries its key
    // Verify one event against the chain as held (does not mutate)
    async checkEvent(e, pub) {
      if (await hashOf(e) !== e.hash) return 'hash';
      if (!pub || !(await verifySig(pub, e.hash, e.sig))) return 'sig';
      return null;
    }
    // Verify everything held. Returns [{by,n,ok,why}] — tamper shows as ok:false and poisons later links.
    async verifyAll() {
      const out = [];
      for (const by of ['shop', 'phone']) {
        let prev = '';
        for (const e of this.chain[by]) {
          let why = await this.checkEvent(e, this.pubKey(by));
          if (!why && e.prev !== prev) why = 'link';
          if (!why && e.seen.n > 0) {              // `seen` must point at a real event of the other chain
            const o = this.chain[by === 'shop' ? 'phone' : 'shop'][e.seen.n - 1];
            if (o && o.hash !== e.seen.h) why = 'seen';
          }
          out.push({ by, n: e.n, type: e.type, ok: !why, why }); prev = e.hash;
        }
      }
      return out;
    }
    // Token = own events the peer has not yet `seen` (so a lost token is healed by the next one) + heads
    makeToken(forceAll) {
      const peerChain = this.chain[this.peer], ack = peerChain.length ? peerChain[peerChain.length - 1].seen.n : 0;
      const events = this.chain[this.me].filter(e => forceAll || e.n > ack);
      return b64u(JSON.stringify({ v: 1, tk: this.tk, from: this.me, events, head: this.head(this.me), seen: this.head(this.peer) }));
    }
    // QR payload: the signed offer alone (small enough for a QR; later events travel by the other channels)
    offerToken() { return b64u(JSON.stringify({ v: 1, tk: this.tk, from: this.me, events: this.chain[this.me].slice(0, 1), head: this.head(this.me), seen: { n: 0, h: '' } })); }
    // Receive a token from any channel. Idempotent; tolerant of order/duplicates; detects gaps.
    async receive(token, via) {
      let t; try { t = JSON.parse(unb64u(token)); } catch (e) { return { ok: false, why: 'unreadable' }; }
      if (t.tk !== this.tk || t.from === this.me) return { ok: false, why: t.tk !== this.tk ? 'other-ticket' : 'own-token' };
      const by = t.from, res = { ok: true, accepted: 0, dup: 0, bad: [], gap: false, via };
      const pool = [...this.pending, ...t.events].sort((a, b) => a.n - b.n);
      this.pending = [];
      for (const e of pool) {
        const c = this.chain[by];
        if (e.n <= c.length) { if (c[e.n - 1].hash === e.hash) res.dup++; else res.bad.push({ n: e.n, why: 'fork' }); continue; }
        if (e.n > c.length + 1) { this.pending.push(e); continue; }               // gap: hold until filled
        const pub = e.n === 1 ? e.body.pub : this.pubKey(by);
        let why = await this.checkEvent(e, pub);
        if (!why && e.prev !== this.head(by).h) why = 'link';
        if (why) { res.bad.push({ n: e.n, why }); continue; }
        c.push(e); res.accepted++;
      }
      res.gap = this.pending.length > 0;
      res.behind = res.gap ? { by, have: this.chain[by].length, next: this.pending[0].n } : null;
      res.peerHead = t.head;
      this.log.push({ via, from: by, accepted: res.accepted, dup: res.dup, bad: res.bad.length, gap: res.gap });
      return res;
    }
    // Compact status token (spec §15.1.5): heads only, signed — fits NFC / QR / SMS
    async statusToken() {
      const sh = x => ({ n: x.n, h: x.h.slice(0, 16) });          // 64-bit prefix is enough to compare; sig covers it
      const s = { tk: this.tk, by: this.me, s: sh(this.head('shop')), p: sh(this.head('phone')) };
      return b64u(JSON.stringify({ ...s, sig: await sign(this.key.priv, await sha(canon(s))) }));
    }
    compare(statusTok) {
      const t = JSON.parse(unb64u(statusTok)), mine = { s: this.head('shop'), p: this.head('phone') };
      const ds = t.s.n - mine.s.n, dp = t.p.n - mine.p.n;
      if (!ds && !dp) return (mine.s.h.startsWith(t.s.h) && mine.p.h.startsWith(t.p.h)) ? 'in-sync' : 'diverged';
      if (ds >= 0 && dp >= 0) return 'peer-ahead';
      if (ds <= 0 && dp <= 0) return 'we-ahead';
      return 'both-ahead';
    }
    // wire tamper test helper (never used by the app): clone with one field changed
    static clone(l) { return JSON.parse(JSON.stringify({ chain: l.chain })); }
  }

  root.Token = { canon, sha, b64u, unb64u, newKey, pubOf, Ledger, hashOf };
  if (typeof module !== 'undefined') module.exports = root.Token;
})(typeof window !== 'undefined' ? window : globalThis);
