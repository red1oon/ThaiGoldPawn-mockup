// Backup core (spec §19.1-19.3): bundle of the signed chains + settings, sealed with a recovery code, verified before restore.
// Pure functions over an injected key/value store, so the same code runs in the page and in the node witness.
(function (root) {
  const nodeCrypto = typeof require === 'function' && typeof module !== 'undefined' ? require('crypto') : null;
  const webcrypto = root.crypto && root.crypto.subtle ? root.crypto : nodeCrypto.webcrypto, subtle = webcrypto.subtle;
  const T = root.Token, enc = new TextEncoder(), dec = new TextDecoder();
  const KDF_ITER = 210000, AAD = enc.encode('gp-backup-v1');
  const b64 = u8 => { let r = ''; u8.forEach(c => r += String.fromCharCode(c)); return btoa(r); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const SETTINGS = { dash: 'gp.dash3', theme: 'gp.theme', lang: 'gp.lang', slipPlan: 'gp.slip.plan', slipOver: 'gp.slip.over' };
  const J = (store, k) => { try { return JSON.parse(store.get(k)); } catch (e) { return null; } };

  // ---- 19.1 bundle: only what the shop owns in this store (generated sample data never lives there) ----
  function snapshot(store, opt) {
    opt = opt || {};
    const ledgers = [], shop = J(store, 'gp.shop.live') || [], crm = J(store, 'gp.crm') || [], phone = J(store, 'gp.phone.ledger');
    shop.forEach(l => ledgers.push({ kind: 'shop', tk: l.tk, chain: l.chain }));
    crm.forEach(l => ledgers.push({ kind: 'crm', tk: l.tk, chain: l.chain }));
    if (phone) ledgers.push({ kind: 'phone', tk: phone.tk, chain: phone.chain });
    const settings = {}; Object.keys(SETTINGS).forEach(k => { const v = store.get(SETTINGS[k]); if (v != null) settings[k] = v; });
    const sk = J(store, 'gp.key.shop');
    const b = { v: 1, kind: 'gp-backup', created: new Date().toISOString(), shop: { pub: sk && sk.pub ? sk.pub : null }, ledgers, contacts: J(store, 'gp.contacts') || [], settings };
    if (opt.withKeys) b.keys = { shop: sk, phone: J(store, 'gp.key.phone') };
    return b;
  }
  const events = b => b.ledgers.reduce((a, l) => a + l.chain.shop.length + l.chain.phone.length, 0);
  const heads = b => b.ledgers.map(l => ({ kind: l.kind, tk: l.tk, shop: l.chain.shop.length, phone: l.chain.phone.length, h: (l.chain.shop[l.chain.shop.length - 1] || {}).hash || '' }));

  // ---- 19.2 envelope: PBKDF2(recovery code) -> AES-256-GCM, AAD "gp-backup-v1" ----
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function recoveryCode() { const r = new Uint8Array(16); webcrypto.getRandomValues(r); const c = [...r].map(x => ALPHA[x % 32]).join(''); return c.match(/.{4}/g).join('-'); }
  const norm = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  async function keyFrom(code, salt, iter) {
    const base = await subtle.importKey('raw', enc.encode(norm(code)), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(bundle, code, iter) {
    iter = iter || KDF_ITER; const salt = webcrypto.getRandomValues(new Uint8Array(16)), iv = webcrypto.getRandomValues(new Uint8Array(12));
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, await keyFrom(code, salt, iter), enc.encode(JSON.stringify(bundle)));
    return { v: 1, kdf: 'PBKDF2-SHA256', iter, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) };
  }
  async function open(env, code) {
    try {
      if (!env || env.v !== 1 || env.kdf !== 'PBKDF2-SHA256') return { ok: false, why: 'format' };
      const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv), additionalData: AAD }, await keyFrom(code, unb64(env.salt), env.iter), unb64(env.ct));
      const b = JSON.parse(dec.decode(pt)); return b && b.kind === 'gp-backup' ? { ok: true, bundle: b } : { ok: false, why: 'format' };
    } catch (e) { return { ok: false, why: 'cannot-open' }; }          // wrong code or altered ciphertext: GCM refuses, nothing partial is returned
  }
  const sha256 = async s => { const d = await subtle.digest('SHA-256', typeof s === 'string' ? enc.encode(s) : s); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); };

  // ---- 19.3 verify every chain (hash, signature, prev + seen links) before anything is applied ----
  async function verify(bundle) {
    const out = [];
    for (const l of bundle.ledgers) {
      const lg = new T.Ledger(l.tk, l.kind === 'phone' ? 'phone' : 'shop', null); lg.chain = l.chain;
      let v = []; try { v = await lg.verifyAll(); } catch (e) { v = [{ ok: false, why: 'unreadable' }]; }
      const bad = v.filter(x => !x.ok);
      out.push({ kind: l.kind, tk: l.tk, ok: bad.length === 0, events: v.length, bad: bad.slice(0, 3).map(x => `${x.by || ''}#${x.n || ''} ${x.why || ''}`) });
    }
    return out;
  }
  // compare with what is on the device: per ledger, per author, keep the longer chain; same length different hash = diverged
  function compare(bundle, store) {
    const have = {}; (J(store, 'gp.shop.live') || []).forEach(l => have['shop:' + l.tk] = l.chain); (J(store, 'gp.crm') || []).forEach(l => have['crm:' + l.tk] = l.chain);
    const ph = J(store, 'gp.phone.ledger'); if (ph) have['phone:' + ph.tk] = ph.chain;
    return bundle.ledgers.map(l => {
      const loc = have[l.kind + ':' + l.tk]; if (!loc) return { kind: l.kind, tk: l.tk, state: 'new' };
      let newer = false, older = false, div = false;
      ['shop', 'phone'].forEach(by => {
        const a = loc[by] || [], b = l.chain[by] || [], n = Math.min(a.length, b.length);
        for (let i = 0; i < n; i++) if (a[i].hash !== b[i].hash) { div = true; break; }
        if (a.length > b.length) newer = true; else if (a.length < b.length) older = true;
      });
      return { kind: l.kind, tk: l.tk, state: div ? 'diverged' : newer ? 'newer-local' : older ? 'newer-backup' : 'same' };
    });
  }
  // apply: valid chains only, longer chain wins; diverged and newer-local are never overwritten
  async function apply(bundle, store, opt) {
    opt = opt || {}; const ver = opt.verified || await verify(bundle), cmp = compare(bundle, store), put = { shop: [], crm: [], phone: null }, skipped = []; let applied = 0;
    const cur = { shop: J(store, 'gp.shop.live') || [], crm: J(store, 'gp.crm') || [], phone: J(store, 'gp.phone.ledger') };
    const keep = (arr, tk) => arr.find(x => x.tk === tk);
    bundle.ledgers.forEach((l, i) => {
      const v = ver[i], c = cmp[i];
      if (!v.ok) { skipped.push({ tk: l.tk, why: 'verify' }); return; }
      if (c.state === 'diverged' || c.state === 'newer-local' || c.state === 'same') { if (c.state !== 'same') skipped.push({ tk: l.tk, why: c.state }); return; }
      applied++; if (l.kind === 'phone') put.phone = { tk: l.tk, chain: l.chain }; else put[l.kind].push({ tk: l.tk, chain: l.chain });
    });
    const merge = (old, add) => { const m = {}; old.forEach(x => m[x.tk] = x); add.forEach(x => m[x.tk] = x); return Object.values(m); };
    store.set('gp.shop.live', JSON.stringify(merge(cur.shop, put.shop)));
    store.set('gp.crm', JSON.stringify(merge(cur.crm, put.crm)));
    if (put.phone) store.set('gp.phone.ledger', JSON.stringify(put.phone));
    if (bundle.contacts && bundle.contacts.length && !(J(store, 'gp.contacts') || []).length) store.set('gp.contacts', JSON.stringify(bundle.contacts));
    Object.keys(bundle.settings || {}).forEach(k => { if (store.get(SETTINGS[k]) == null) store.set(SETTINGS[k], bundle.settings[k]); });
    if (bundle.keys) { if (bundle.keys.shop && store.get('gp.key.shop') == null) store.set('gp.key.shop', JSON.stringify(bundle.keys.shop)); if (bundle.keys.phone && store.get('gp.key.phone') == null) store.set('gp.key.phone', JSON.stringify(bundle.keys.phone)); }
    return { applied, skipped };
  }
  root.Backup = { snapshot, seal, open, verify, compare, apply, recoveryCode, norm, sha256, events, heads, SETTINGS, KDF_ITER, b64, unb64 };
})(typeof window !== 'undefined' ? window : globalThis);
