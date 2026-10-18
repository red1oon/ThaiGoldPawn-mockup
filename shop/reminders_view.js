window.RemindView = (function () {
  const R = window.Reminders, Net = window.Net; const Dash = { rows: () => window.Dash.rows() }, CV = { get state() { return window.ContactsView.state; }, addConsented: x => window.ContactsView.addConsented(x) };
  let S, t, fmt, fd;
  const bind = (s, tr, f, d) => { S = s; t = tr; fmt = f; fd = d; };
  const icon = n => `<span class="material-symbols-rounded">${n}</span>`;
  const V = { days: 7, channel: 'whatsapp', msg: '', open: null };
  const shop = () => t('rcShopName');
  function view() {
    const items = R.list(Dash.rows(), Net.today, +V.days), contacts = CV.state.list, prep = R.prepare(items, V.channel, S.lang, contacts, shop(), Net.set);
    const okSet = new Set(prep.msgs.map(m => m.x.r.tk)), ncSet = new Set(prep.noConsent.map(x => x.r.tk));
    return `<div class="card"><div class="panel"><h2>${t('navRemind')}</h2><div class="sub">${t('rmSub')}</div>
      <div class="fields"><label class="f">${t('rmDays')}<input data-rm="days" type="text" inputmode="numeric" value="${V.days}"></label>
        <label class="f">${t('ctChannel')}<select data-rm="channel">${['whatsapp', 'sms', 'line', 'email'].map(c => `<option value="${c}" ${V.channel === c ? 'selected' : ''}>${t('ch_' + c)}</option>`).join('')}</select></label></div>
      <div class="chips"><div class="kchip" style="--c:--s4">${icon('notifications_active')}<b>${items.length}</b><span>${t('rmDue')}</span></div><div class="kchip" style="--c:--s6">${icon('mark_chat_read')}<b>${prep.msgs.length}</b><span>${t('rmReady')}</span></div>
        <div class="kchip" style="--c:--s8">${icon('block')}<b>${prep.noConsent.length}</b><span>${t('rmNoConsent')}</span></div></div>
      ${V.msg ? `<div class="note">${V.msg}</div>` : ''}
      <div class="tablewrap"><table><tr><th>${t('ticketNo')}</th><th>${t('name')}</th><th>${t('due')}</th><th class="n">${t('rmDueIn')}</th><th></th></tr>
        ${items.map(x => `<tr><td>${x.r.tk}</td><td>${dn(x.r.st.name)}</td><td>${fd(x.r.st.due)}</td><td class="n" style="color:var(${x.dueIn < 0 ? '--s8' : '--s4'})">${x.dueIn < 0 ? x.dueIn : '+' + x.dueIn}</td>
          <td>${okSet.has(x.r.tk) ? `<button class="btn small" data-rm-act="prep|${x.r.tk}">${t('rmPrepare')}</button>` : ncSet.has(x.r.tk) ? `<button class="btn small ghost" data-rm-act="consent|${x.r.tk}">${t('rmConsent')}</button>` : `<small>${t('rmNoWay')}</small>`}</td></tr>`).join('') || `<tr><td colspan="5">${t('none')}</td></tr>`}</table></div>
      ${V.open ? `<div class="demo"><b>${V.open.tk}</b><div class="note" style="white-space:pre-wrap">${V.open.text}</div><div class="actions" style="justify-content:flex-start"><a class="btn small" href="${V.open.href}" target="_blank" rel="noopener">${t('open')} ↗</a></div></div>` : ''}
      <div class="note">${t('rmLimits')}</div></div></div>`;
  }
  async function click(el) {
    const n = el.closest('[data-rm-act]'); if (!n) return false; const [a, tk] = n.dataset.rmAct.split('|');
    const items = R.list(Dash.rows(), Net.today, +V.days), x = items.find(i => i.r.tk === tk); if (!x) return true;
    if (a === 'consent') { const ok = CV.addConsented({ name: x.r.st.name, phone: x.r.st.phone }); V.msg = ok ? '✔ ' + t('rmConsentSaved') : '⚠ ' + t('rmNoPhone'); return true; }
    if (a === 'prep') { const p = R.prepare([x], V.channel, S.lang, CV.state.list, shop(), Net.set).msgs[0]; if (!p) return true; await R.log(tk, V.channel, 'reminder prepared (' + V.channel + ')'); V.open = { tk, text: p.text, href: p.href }; V.msg = '✔ ' + t('rmLogged'); return true; }
    return false;
  }
  const input = el => { V[el.dataset.rm] = el.dataset.rm === 'days' ? (el.value.replace(/[^0-9]/g, '') || '0') : el.value; };
  return { bind, view, click, input, state: V };
})();
