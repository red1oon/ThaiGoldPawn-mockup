// Stub relay (spec §19.4-19.5): an HTTP-shaped server that runs inside the page ("demo:" address) so the backup and journal flows can be
// tried without a host. Same request/response shapes as a real endpoint; a real URL is called with fetch. The stub is BLIND: it stores
// ciphertext and the few plain fields the protocol needs, nothing else. State persists in this browser only (labelled as a stand-in).
(function (root) {
  const nodeCrypto = typeof require === 'function' && typeof module !== 'undefined' ? require('crypto') : null;
  const webcrypto = root.crypto && root.crypto.subtle ? root.crypto : nodeCrypto.webcrypto, subtle = webcrypto.subtle, enc = new TextEncoder();
  const store = { get(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { root.localStorage.setItem(k, v); } catch (e) {} } };
  const sha = async s => [...new Uint8Array(await subtle.digest('SHA-256', enc.encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
  const TOKEN = 'demo-token';
  const S = { backups: [], journal: [], down: false, persist: true };
  const load = () => { try { const j = JSON.parse(store.get('gp.relay.stub')); if (j) { S.backups = j.backups || []; S.journal = j.journal || []; } } catch (e) {} };
  const save = () => { if (S.persist) store.set('gp.relay.stub', JSON.stringify({ backups: S.backups, journal: S.journal })); };
  load();
  // ---- the server: handle(method, path, body, token) -> { status, json } ----
  async function handle(method, path, body, token) {
    if (S.down) return { status: 503, json: { ok: false, why: 'unavailable' } };
    if (token !== TOKEN) return { status: 401, json: { ok: false, why: 'bad-token' } };
    if (method === 'POST' && path === '/backup') {
      const text = typeof body === 'string' ? body : JSON.stringify(body), id = 'B' + String(S.backups.length + 1).padStart(4, '0'), r = { id, ts: Date.now(), bytes: text.length, sha256: await sha(text), text };
      S.backups.push(r); if (S.backups.length > 10) S.backups.shift(); save(); return { status: 200, json: { ok: true, id, bytes: r.bytes, sha256: r.sha256, ts: r.ts } };
    }
    if (method === 'GET' && path === '/backup/latest') { const r = S.backups[S.backups.length - 1]; return r ? { status: 200, json: { ok: true, id: r.id, ts: r.ts, sha256: r.sha256, text: r.text } } : { status: 404, json: { ok: false, why: 'none' } }; }
    if (method === 'GET' && path === '/backup/list') return { status: 200, json: { ok: true, items: S.backups.map(r => ({ id: r.id, ts: r.ts, bytes: r.bytes, sha256: r.sha256 })) } };
    if (root.RelayJournal) { const r = await root.RelayJournal.handle(S, method, path, body, save); if (r) return r; }
    return { status: 404, json: { ok: false, why: 'no-route' } };
  }
  // ---- the client: demo: -> stub (with a little latency), anything else -> fetch ----
  async function call(base, method, path, body, token) {
    if (!base || base === 'demo:') { await new Promise(r => setTimeout(r, root.__noLatency ? 0 : 120 + Math.random() * 200)); return handle(method, path, body, token); }
    try {
      const res = await fetch(base.replace(/\/$/, '') + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: body == null ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
      let json = null; try { json = await res.json(); } catch (e) {} return { status: res.status, json: json || { ok: res.ok } };
    } catch (e) { return { status: 0, json: { ok: false, why: 'network' } }; }
  }
  root.Relay = { handle, call, state: S, TOKEN, sha, reset() { S.backups = []; S.journal = []; save(); } };
})(typeof window !== 'undefined' ? window : globalThis);
