// Stub journal endpoints (spec §19.5), plugged into Relay.handle. Append-only: there is NO update or delete route. The server sees tk/by/n/hash
// (needed to detect gaps) and ciphertext; each record is chained: srvHash = SHA-256(prevSrv | hash | SHA-256(ct)).
(function (root) {
  const sha = (...a) => root.Relay.sha(a.join('|'));
  async function handle(S, method, path, body, save) {
    const J = S.journal;
    if (method === 'POST' && path === '/journal/append') {
      const recs = (body && body.records) || [], rc = [];
      for (const r of recs) {
        if (!r || !r.tk || !r.by || !r.n || !r.hash || !r.ct) return { status: 400, json: { ok: false, why: 'bad-record' } };
        const have = J.find(x => x.tk === r.tk && x.by === r.by && x.n === r.n);
        if (have) { rc.push(have.hash === r.hash ? { tk: r.tk, by: r.by, n: r.n, seq: have.seq, srvHash: have.srvHash, dup: true } : { tk: r.tk, by: r.by, n: r.n, conflict: true }); continue; }
        const prev = J.length ? J[J.length - 1].srvHash : '', ctHash = await root.Relay.sha(r.ct), seq = J.length + 1;
        const rec = { seq, ts: Date.now(), tk: r.tk, by: r.by, n: r.n, hash: r.hash, iv: r.iv, ct: r.ct, ctHash, prev, srvHash: await sha(prev, r.hash, ctHash) };
        J.push(rec); rc.push({ tk: r.tk, by: r.by, n: r.n, seq, srvHash: rec.srvHash });
      }
      save(); return { status: 200, json: { ok: true, receipts: rc } };
    }
    if (method === 'GET' && path === '/journal/head') { const l = J[J.length - 1]; return { status: 200, json: { ok: true, seq: l ? l.seq : 0, srvHash: l ? l.srvHash : '' } }; }
    if (method === 'GET' && path.startsWith('/journal')) { const from = +(/from=(\d+)/.exec(path) || [0, 1])[1]; return { status: 200, json: { ok: true, records: J.filter(r => r.seq >= from) } }; }
    return null;
  }
  root.RelayJournal = { handle };
})(typeof window !== 'undefined' ? window : globalThis);
