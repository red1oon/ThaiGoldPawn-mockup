// Multi-counter (spec §20.8): several counters share one shop ledger by exchanging the encrypted journal (§19.5). A pull merges per ledger with the
// §19.3 rule (longer chain per author wins; both-ahead is merged and re-verified); a ledger whose chains DIVERGE (two counters wrote different events at the
// same position) is never merged silently: it is kept as the local version and listed as a conflict with the other side's head.
window.Counter = (function () {
  const Net = window.Net, B = () => window.Backup, J = () => window.Journal;
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const id = () => store.get('gp.counter.id') || 'C1', prefix = () => store.get('gp.counter.prefix') || 'A';
  function set(cid, pfx) { store.set('gp.counter.id', String(cid || 'C1').trim().toUpperCase().slice(0, 4) || 'C1'); store.set('gp.counter.prefix', (String(pfx || 'A').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2)) || 'A'); Net.prefix = prefix(); Net.seqSync(); }
  const conflicts = () => { try { return JSON.parse(store.get('gp.conflicts')) || []; } catch (e) { return []; } };
  const heads = ch => ({ shop: ch.shop.length, phone: ch.phone.length, h: (ch.shop[ch.shop.length - 1] || {}).hash || '' });
  // merge a bundle (from another counter) into a store; returns what happened (used by the page and by the node witness)
  async function mergeBundle(bundle, st) {
    const ver = await B().verify(bundle), cmp = B().compare(bundle, st), res = { added: 0, extended: 0, merged: 0, same: 0, kept: 0, conflicts: [], invalid: [] };
    cmp.forEach((c, i) => { if (!ver[i].ok) res.invalid.push(c.tk); else if (c.state === 'new') res.added++; else if (c.state === 'newer-backup') res.extended++; else if (c.state === 'both-ahead') res.merged++; else if (c.state === 'same') res.same++; else if (c.state === 'newer-local') res.kept++; else if (c.state === 'diverged') {
      const mine = (JSON.parse(st.get(c.kind === 'crm' ? 'gp.crm' : 'gp.shop.live') || '[]').find(x => x.tk === bundle.ledgers[i].tk) || {}).chain, theirs = bundle.ledgers[i].chain;
      res.conflicts.push({ tk: c.tk, kind: c.kind, mine: mine ? heads(mine) : null, theirs: heads(theirs), at: Date.now() });
    } });
    const ap = await B().apply(bundle, st, { verified: ver }); res.applied = ap.applied; res.skipped = ap.skipped; return res;
  }
  async function sync(o) {
    if (window.Auth && !window.Auth.check('counter').ok) return { ok: false, why: 'role' };
    Net.persist(); const fl = await J().flush(store, { code: o.code, url: o.url, token: o.token, batch: 25 });            // first publish what this counter has, so the others can see it
    if (fl.failed) return { ok: false, why: 'send', status: fl.status };
    const r = await J().restore({ code: o.code, url: o.url, token: o.token }); if (!r.ok) return { ok: false, why: r.status ? 'server' : 'code', status: r.status };
    const res = await mergeBundle(r.bundle, store); store.set('gp.conflicts', JSON.stringify(res.conflicts)); Net.reloadFromStore(); return { ok: true, ...res, records: r.records };
  }
  return { id, prefix, set, conflicts, sync, mergeBundle };
})();
