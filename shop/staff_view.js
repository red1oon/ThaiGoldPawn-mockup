// Staff, roles and counters tab (spec §20.8).
window.StaffView = (function () {
  const Auth = window.Auth, Net = window.Net;
  let S, t, fmt, fd;
  const bind = (s, tr, f, d) => { S = s; t = tr; fmt = f; fd = d; };
  const icon = n => `<span class="material-symbols-rounded">${n}</span>`;
  const V = { name: '', role: 'cashier', pin: '', ownerPin: '', signId: 'owner', signPin: '', msg: '', cid: '', cpfx: '', smsg: '' };
  const WHAT = { issue: 'rl_issue', pay: 'rl_pay', redeem: 'rl_redeem', locate: 'rl_locate', count: 'rl_count', price: 'rl_price', dayend: 'rl_dayend', remind: 'rl_remind', followup: 'rl_followup', forfeit: 'rl_forfeit', sale: 'rl_sale', openingImport: 'rl_open', settings: 'rl_settings', backup: 'rl_backup', restore: 'rl_restore', revoke: 'rl_revoke', staff: 'rl_staff', counter: 'rl_counter' };
  function view() {
    const st = Auth.staff(), a = Auth.state, C = window.Counter, cs = C.conflicts();
    if (!V.cid) { V.cid = C.id(); V.cpfx = C.prefix(); }
    const sOpts = [{ id: 'owner', name: 'Owner', role: 'owner' }, ...st.filter(s => s.id !== 'owner')];
    const bk = window.BackupView.state;
    return `<div class="card"><div class="panel"><h2>${t('navStaff')}</h2><div class="sub">${t('stSub')}</div>
      <div class="chips"><div class="kchip" style="--c:--s1">${icon('badge')}<b>${a.name}</b><span>${t('stActing')} · ${t('role_' + a.role)}</span></div><div class="kchip" style="--c:--s6">${icon('storefront')}<b>${C.id()} / ${C.prefix()}</b><span>${t('stCounter')}</span></div></div>
      ${V.msg ? `<div class="note">${V.msg}</div>` : ''}
      <div class="sec-title">${t('stSignIn')}</div>
      <div class="fields"><label class="f">${t('stWho')}<select data-st="signId">${sOpts.map(s => `<option value="${s.id}" ${V.signId === s.id ? 'selected' : ''}>${s.name} · ${t('role_' + s.role)}</option>`).join('')}</select></label><label class="f">PIN<input data-st="signPin" type="password" inputmode="numeric" value="${V.signPin}"></label></div>
      <div class="actions" style="justify-content:flex-start"><button class="btn" data-st-act="signin">${t('stSignInBtn')}</button></div>
      <div class="note">${t('stPinNote')}</div>
      <div class="sec-title">${t('stStaff')}</div>
      ${st.length ? `<div class="tablewrap"><table><tr><th>${t('name')}</th><th>${t('stRole')}</th><th></th></tr>${st.map(s => `<tr><td>${s.name}</td><td>${t('role_' + s.role)}</td><td>${s.id === 'owner' ? '' : `<button class="btn small ghost" data-st-act="remove|${s.id}">${t('hide')}</button>`}</td></tr>`).join('')}</table></div>` : `<div class="note">${t('stNone')}</div>`}
      <div class="fields"><label class="f">${t('name')}<input data-st="name" type="text" value="${V.name}"></label><label class="f">${t('stRole')}<select data-st="role">${['cashier', 'viewer', 'owner'].map(r => `<option value="${r}" ${V.role === r ? 'selected' : ''}>${t('role_' + r)}</option>`).join('')}</select></label>
        <label class="f">PIN (4-8)<input data-st="pin" type="password" inputmode="numeric" value="${V.pin}"></label>${st.length ? '' : `<label class="f">${t('stOwnerPin')}<input data-st="ownerPin" type="password" inputmode="numeric" value="${V.ownerPin}"></label>`}</div>
      <div class="actions" style="justify-content:flex-start"><button class="btn" data-st-act="add">${t('stAdd')}</button></div>
      <div class="sec-title">${t('stMatrix')}</div>
      <div class="tablewrap"><table><tr><th></th>${['owner', 'cashier', 'viewer'].map(r => `<th>${t('role_' + r)}</th>`).join('')}</tr>${Auth.ACTIONS.map(x => `<tr><td>${t(WHAT[x])}</td>${['owner', 'cashier', 'viewer'].map(r => `<td style="text-align:center">${Auth.can(x, r) ? '✔' : '–'}</td>`).join('')}</tr>`).join('')}</table></div>
      <div class="sec-title">${icon('hub')} ${t('stCounters')}</div><div class="note">${t('stCountersNote')}</div>
      <div class="fields"><label class="f">${t('stCounterId')}<input data-st="cid" type="text" value="${V.cid}"></label><label class="f">${t('stPrefix')}<input data-st="cpfx" type="text" value="${V.cpfx}"></label></div>
      <div class="actions" style="justify-content:flex-start"><button class="btn small" data-st-act="counter">${t('stSetCounter')}</button><button class="btn" data-st-act="sync">${icon('sync')} ${t('stSync')}</button></div>
      <div class="note">${t('stSyncUses')}: ${bk.url || 'demo:'} ${bk.code ? '' : '— ' + t('bkNeedCode')}</div>
      ${V.smsg ? `<div class="note">${V.smsg}</div>` : ''}
      ${cs.length ? `<div class="sec-title" style="color:var(--s8)">${t('stConflicts')} (${cs.length})</div><div class="tablewrap"><table><tr><th>${t('ticketNo')}</th><th>${t('stMine')}</th><th>${t('stTheirs')}</th></tr>${cs.map(c => `<tr><td>${c.tk}</td><td>${c.mine ? c.mine.shop + '/' + c.mine.phone + ' · ' + c.mine.h.slice(0, 8) : '–'}</td><td>${c.theirs.shop + '/' + c.theirs.phone + ' · ' + c.theirs.h.slice(0, 8)}</td></tr>`).join('')}</table></div><div class="note slipwarn err">${icon('error')} ${t('stConflictNote')}</div>` : ''}
      </div></div>`;
  }
  async function click(el) {
    const n = el.closest('[data-st-act]'); if (!n) return false; const [a, arg] = n.dataset.stAct.split('|'); V.msg = ''; V.smsg = '';
    if (a === 'signin') { const r = await Auth.signIn(V.signId, V.signPin); V.signPin = ''; if (V.signId === 'owner' && !Auth.enabled()) { Auth.signOutToOwner(); V.msg = '✔ ' + t('stSigned'); return true; } V.msg = r.ok ? '✔ ' + t('stSigned') + ': ' + Auth.state.name : '⚠ ' + t('stBadPin'); return true; }
    if (a === 'add') { const r = await Auth.addStaff(V.name, V.role, V.pin, V.ownerPin); V.msg = r.ok ? '✔ ' + t('stAdded') : '⚠ ' + t(r.why === 'role' ? 'roleDenied' : 'stInvalid'); if (r.ok) { V.name = ''; V.pin = ''; V.ownerPin = ''; } return true; }
    if (a === 'remove') { const r = await Auth.removeStaff(arg); V.msg = r.ok ? '✔' : '⚠ ' + t('roleDenied'); return true; }
    if (a === 'counter') { if (!Auth.check('counter').ok) { V.msg = '⚠ ' + t('roleDenied'); return true; } window.Counter.set(V.cid, V.cpfx); V.msg = '✔ ' + window.Counter.id() + ' / ' + window.Counter.prefix(); return true; }
    if (a === 'sync') {
      const bk = window.BackupView.state; if (window.Backup.norm(bk.code).length !== 16) { V.smsg = '⚠ ' + t('bkNeedCode'); return true; }
      const r = await window.Counter.sync({ code: bk.code, url: bk.url || 'demo:', token: bk.token }); V.smsg = r.ok ? `✔ ${t('stSynced')}: +${r.added} ${t('stNew')} · ${r.extended + r.merged} ${t('stUpdated')} · ${r.conflicts.length} ${t('stConflictsN')}` : '⚠ ' + t(r.why === 'role' ? 'roleDenied' : 'bkFail') + (r.status ? ' (' + r.status + ')' : ''); return true;
    }
    return false;
  }
  const input = el => { V[el.dataset.st] = el.value; };
  return { bind, view, click, input, state: V };
})();
