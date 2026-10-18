// Roles (spec §20.8): owner / cashier / viewer. Enforced at the ACTION layer: a refused action writes nothing. The acting role is stamped into every
// shop-authored event (inside the signed body) via Token.Ledger.actorFn. Staff are signed events on the internal chain `crm:_staff`.
// ⚠ In a static page the PIN check is a usability gate, not security (anyone with the files can change the code); real enforcement needs a server or per-staff keys.
window.Auth = (function () {
  const Net = window.Net, T = window.Token;
  const store = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} } };
  const ACTIONS = ['issue', 'pay', 'redeem', 'locate', 'count', 'price', 'dayend', 'remind', 'followup', 'forfeit', 'sale', 'openingImport', 'settings', 'backup', 'restore', 'revoke', 'staff', 'counter'];
  const ROLES = { owner: ACTIONS.slice(), cashier: ['issue', 'pay', 'redeem', 'locate', 'count', 'price', 'dayend', 'remind', 'followup'], viewer: [] };
  const A = { id: 'owner', name: 'Owner', role: 'owner', system: false, last: null, enabled: false };
  const sha = s => window.Token.sha(s);
  const events = () => { const l = Net.crm && Net.crm._staff; return l ? l.chain.shop.filter(e => e.type === 'staff') : []; };
  function staff() { const m = {}; events().forEach(e => { m[e.body.id] = { ...e.body, ts: e.ts }; }); return Object.values(m).filter(s => !s.removed); }
  const enabled = () => staff().length > 0;
  // single-user mode (no staff defined) = owner; once staff exist the acting person is whoever signed in this tab (default owner until someone else signs in)
  function can(action, role) { role = role || A.role; return (ROLES[role] || []).includes(action); }
  function check(action) {
    if (A.system) return { ok: true };
    if (can(action)) return { ok: true };
    A.last = { action, role: A.role, ts: Date.now() }; return { ok: false, why: 'role', action, role: A.role };
  }
  const stamp = () => (A.system ? { id: 'system', role: 'system' } : { id: A.id, role: A.role });
  async function withSystem(fn) { const prev = A.system; A.system = true; try { return await fn(); } finally { A.system = prev; } }
  async function addStaff(name, role, pin, ownerPin) {
    const g = check('staff'); if (!g.ok) return g;
    if (!['owner', 'cashier', 'viewer'].includes(role) || !String(name || '').trim() || !/^\d{4,8}$/.test(String(pin || ''))) return { ok: false, why: 'invalid' };
    const id = 's' + (staff().length + 1) + '-' + String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 8);
    if (!enabled()) { if (!/^\d{4,8}$/.test(String(ownerPin || ''))) return { ok: false, why: 'owner-pin' }; await Net.logInternal('_staff', 'staff', { id: 'owner', name: 'Owner', role: 'owner', pinHash: await sha('owner|' + ownerPin) }); }
    const e = await Net.logInternal('_staff', 'staff', { id, name: String(name).trim(), role, pinHash: await sha(id + '|' + pin) }); return { ok: true, id, event: e };
  }
  async function removeStaff(id) { const g = check('staff'); if (!g.ok) return g; if (id === 'owner') return { ok: false, why: 'owner' }; const e = await Net.logInternal('_staff', 'staff', { id, removed: true }); return { ok: true, event: e }; }
  async function signIn(id, pin) {
    const s = staff().find(x => x.id === id); if (!s) return { ok: false, why: 'unknown' };
    if (s.pinHash !== await sha(id + '|' + pin)) return { ok: false, why: 'pin' };
    A.id = s.id; A.name = s.name; A.role = s.role; store.set('gp.actor', s.id); return { ok: true, role: s.role };
  }
  function signOutToOwner() { A.id = 'owner'; A.name = 'Owner'; A.role = 'owner'; store.set('gp.actor', ''); }
  function restore() { const id = store.get('gp.actor'); const s = id && staff().find(x => x.id === id); if (s) { A.id = s.id; A.name = s.name; A.role = s.role; } }
  const arm = () => { window.Token.Ledger.actorFn = () => stamp(); };            // armed after the sample portfolio is built, so generated data is not stamped
  return { arm, ACTIONS, ROLES, state: A, staff, enabled, can, check, stamp, withSystem, addStaff, removeStaff, signIn, signOutToOwner, restore, sha };
})();
