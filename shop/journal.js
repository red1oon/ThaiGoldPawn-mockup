// Black-box journal client (spec §19.5): lazy outbox, events encrypted under a key from the recovery code, receipts, audit, disaster restore.
// The outbox is DERIVED (local events minus receipts), so nothing queued can be lost or double-sent.
(function (root) {
  const nodeCrypto = typeof require === 'function' && typeof module !== 'undefined' ? require('crypto') : null;
  const webcrypto = root.crypto && root.crypto.subtle ? root.crypto : nodeCrypto.webcrypto, subtle = webcrypto.subtle, enc = new TextEncoder(), dec = new TextDecoder();
  const B = () => root.Backup, R = () => root.Relay;
  const J = (store, k, d) => { try { return JSON.parse(store.get(k)) || d; } catch (e) { return d; } };
  const keyOf = e => e.tk + '|' + e.by + '|' + e.n;
  async function jkey(code) {
    const base = await subtle.importKey('raw', enc.encode(B().norm(code)), 'HKDF', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('gp-journal-v1'), info: enc.encode('journal') }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  const aad = r => enc.encode(r.tk + '|' + r.by + '|' + r.n + '|' + r.hash);
  const allEvents = store => { const b = B().snapshot(store), o = []; b.ledgers.filter(l => l.kind !== 'phone').forEach(l => ['shop', 'phone'].forEach(by => l.chain[by].forEach(e => o.push(e)))); return o; };
  const receipts = store => J(store, 'gp.journal.rcpt', {});
  const pending = store => { const r = receipts(store); return allEvents(store).filter(e => !r[keyOf(e)]); };
  async function pack(e, key) {
    const iv = webcrypto.getRandomValues(new Uint8Array(12)), rec = { tk: e.tk, by: e.by, n: e.n, hash: e.hash };
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(rec) }, key, enc.encode(JSON.stringify(e)));
    return { ...rec, iv: B().b64(iv), ct: B().b64(new Uint8Array(ct)) };
  }
  // send the pending events in batches; failure leaves them pending (retry later), never drops them
  async function flush(store, o) {
    const key = await jkey(o.code), todo = pending(store).slice(0, o.max || 1e9), rc = receipts(store), st = { sent: 0, dup: 0, failed: 0, conflict: 0, status: 200 };
    for (let i = 0; i < todo.length; i += (o.batch || 25)) {
      const recs = []; for (const e of todo.slice(i, i + (o.batch || 25))) recs.push(await pack(e, key));
      const r = await R().call(o.url, 'POST', '/journal/append', { records: recs }, o.token); st.status = r.status;
      if (!(r.status === 200 && r.json.ok)) { st.failed += recs.length; break; }
      r.json.receipts.forEach(x => { if (x.conflict) st.conflict++; else { rc[x.tk + '|' + x.by + '|' + x.n] = { seq: x.seq, srvHash: x.srvHash }; if (x.dup) st.dup++; else st.sent++; } });
    }
    store.set('gp.journal.rcpt', JSON.stringify(rc)); store.set('gp.journal.flush', JSON.stringify({ ts: Date.now(), ...st }));
    return st;
  }
  const chainOk = async recs => { let prev = ''; for (const r of recs) { if (r.prev !== prev || r.srvHash !== await R().sha([prev, r.hash, r.ctHash].join('|')) || r.ctHash !== await R().sha(r.ct)) return { ok: false, at: r.seq }; prev = r.srvHash; } return { ok: true }; };
  async function audit(store, o) {
    const g = await R().call(o.url, 'GET', '/journal?from=1', null, o.token); if (!(g.status === 200 && g.json.ok)) return { ok: false, status: g.status };
    const recs = g.json.records, ch = await chainOk(recs), rc = receipts(store), by = {}; recs.forEach(r => by[r.tk + '|' + r.by + '|' + r.n] = r);
    const ev = allEvents(store); let synced = 0, notSent = 0, missing = 0, altered = 0;
    for (const e of ev) { const k = keyOf(e), r = rc[k], s = by[k]; if (!r) { notSent++; continue; } if (!s) { missing++; continue; } if (s.hash !== e.hash || s.srvHash !== r.srvHash) altered++; else synced++; }
    return { ok: true, total: ev.length, synced, notSent, missing, altered, chain: ch.ok, brokenAt: ch.at || null, serverRecords: recs.length };
  }
  // rebuild the shop's chains from the journal alone (new device + recovery code), then the normal verify/apply path takes over
  async function restore(o) {
    const g = await R().call(o.url, 'GET', '/journal?from=1', null, o.token); if (!(g.status === 200 && g.json.ok)) return { ok: false, status: g.status };
    const key = await jkey(o.code), ledgers = {}, bad = [];
    for (const r of g.json.records) {
      try { const e = JSON.parse(dec.decode(await subtle.decrypt({ name: 'AES-GCM', iv: B().unb64(r.iv), additionalData: aad(r) }, key, B().unb64(r.ct))));
        const L = ledgers[e.tk] = ledgers[e.tk] || { kind: e.tk.startsWith('crm:') ? 'crm' : 'shop', tk: e.tk, chain: { shop: [], phone: [] } }; L.chain[e.by].push(e); }
      catch (x) { bad.push(r.seq); }
    }
    Object.values(ledgers).forEach(L => ['shop', 'phone'].forEach(by => L.chain[by].sort((a, c) => a.n - c.n)));
    const bundle = { v: 1, kind: 'gp-backup', created: new Date().toISOString(), shop: { pub: null }, ledgers: Object.values(ledgers), contacts: [], settings: {} };
    return { ok: bad.length === 0, bad, bundle, records: g.json.records.length };
  }
  root.Journal = { flush, audit, restore, pending, receipts, allEvents, jkey, keyOf };
})(typeof window !== 'undefined' ? window : globalThis);
