// Backup tab (spec §19.4): channels share one encrypted envelope. Step 2 = local file + restore + reminder.
window.BackupView = (function () {
  const B = window.Backup, Net = window.Net;
  let S, t, fmt, fd;
  const bind = (s, tr, f, d) => { S = s; t = tr; fmt = f; fd = d; };
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const icon = n => `<span class="material-symbols-rounded">${n}</span>`;
  const DAYS = 7;
  const V = { code: '', shown: '', plain: false, msg: '', busy: false, pending: null, pcode: '', url: store.get('gp.web.url') || 'demo:', token: store.get('gp.web.token') || 'demo-token', wmsg: '', jmsg: '', audit: null, smsg: '', mailto: store.get('gp.share.to') || '' };
  const receipts = () => { try { return JSON.parse(store.get('gp.backup.receipts')) || []; } catch (e) { return []; } };
  const R = () => window.Relay;
  const last = () => { try { return JSON.parse(store.get('gp.backup.last')); } catch (e) { return null; } };
  const nowSnap = () => { Net.persist(); return B.snapshot(store, { withKeys: !V.plain }); };
  const stale = () => { const l = last(), ev = B.events(B.snapshot(store)); if (!ev) return null; if (!l) return { why: 'never', ev }; const d = (Date.now() - l.ts) / 86400000; return { why: d >= DAYS ? 'days' : ev > l.events ? 'events' : null, d: Math.floor(d), ev: ev - l.events }; };

  function view() {
    const l = last(), st = stale(), snap = B.snapshot(store), ev = B.events(snap), p = V.pending;
    return `<div class="card"><div class="panel"><h2>${t('navBackup')}</h2><div class="sub">${t('bkSub')}</div>
      ${st && st.why ? `<div class="note slipwarn warn">${icon('warning')} ${t(st.why === 'never' ? 'bkNever' : st.why === 'days' ? 'bkStaleDays' : 'bkStaleEvents')}${st.d != null ? ' (' + st.d + ' ' + t('days') + ')' : ''}</div>` : ''}
      <div class="chips"><div class="kchip" style="--c:--s1">${icon('database')}<b>${ev}</b><span>${t('bkEvents')}</span></div>
        <div class="kchip" style="--c:${l ? '--s6' : '--s8'}">${icon('history')}<b>${l ? new Date(l.ts).toISOString().slice(0, 10) : '–'}</b><span>${t('bkLast')}${l ? ' · ' + t('bkch_' + l.channel) : ''}</span></div></div>
      ${ev ? '' : `<div class="note">${t('bkEmpty')}</div>`}
      <div class="sec-title">${t('bkCodeHead')}</div>
      <div class="note">${t('bkCodeNote')}</div>
      <div class="actions" style="justify-content:flex-start"><button class="btn small" data-bk="gen">${t('bkGen')}</button></div>
      ${V.shown ? `<div class="reccode">${V.shown}</div><div class="note slipwarn err">${icon('error')} ${t('bkCodeOnce')}</div>` : ''}
      <div class="fields"><label class="f">${t('bkCodeIn')}<input data-bk-in="code" type="text" autocomplete="off" value="${V.code}" placeholder="XXXX-XXXX-XXXX-XXXX"></label></div>
      <div class="sec-title">${icon('save')} ${t('bkLocal')}</div>
      <label class="chk"><input type="checkbox" data-bk-in="plain" ${V.plain ? 'checked' : ''}> ${t('bkPlain')}</label>
      ${V.plain ? `<div class="note slipwarn err">${icon('warning')} ${t('bkPlainWarn')}</div>` : ''}
      <div class="actions" style="justify-content:flex-start"><button class="btn" data-bk="save" ${V.busy ? 'disabled' : ''}>${t('bkSave')}</button></div>
      <div class="sec-title">${icon('cloud_upload')} ${t('bkWeb')}</div>
      <div class="note">${t('bkWebNote')}</div>
      <div class="fields"><label class="f">${t('bkWebUrl')}<input data-bk-in="url" type="text" value="${V.url}" placeholder="https://… or demo:"></label>
        <label class="f">${t('bkWebToken')}<input data-bk-in="token" type="text" value="${V.token}"></label></div>
      <div class="actions" style="justify-content:flex-start"><button class="btn" data-bk="send" ${V.busy ? 'disabled' : ''}>${t('bkSend')}</button><button class="btn small ghost" data-bk="fetch" ${V.busy ? 'disabled' : ''}>${t('bkFetch')}</button></div>
      ${V.wmsg ? `<div class="note">${V.wmsg}</div>` : ''}
      ${receipts().length ? `<div class="tablewrap"><table><tr><th>${t('date')}</th><th>${t('bkRcptId')}</th><th class="n">B</th><th>SHA-256</th></tr>${receipts().slice(0, 5).map(r => `<tr><td>${new Date(r.ts).toISOString().replace('T', ' ').slice(0, 16)}</td><td>${r.id}</td><td class="n">${r.bytes}</td><td><small>${r.sha256.slice(0, 16)}…</small></td></tr>`).join('')}</table></div>` : ''}
      ${V.url === 'demo:' ? demoPanel() : ''}
      <div class="sec-title">${icon('ios_share')} ${t('bkShare')}</div>
      <div class="note">${t('bkShareNote')}</div>
      <div class="fields"><label class="f">${t('bkMailTo')}<input data-bk-in="mailto" type="text" value="${V.mailto}" placeholder="name@example.com"></label></div>
      <div class="actions" style="justify-content:flex-start"><button class="btn" data-bk="share">${t('bkShareBtn')}</button></div>
      ${V.smsg ? `<div class="note">${V.smsg}</div>` : ''}
      <div class="sec-title">${icon('inventory')} ${t('bkJournal')}</div>
      <div class="note">${t('bkJournalNote')}</div>
      <label class="chk"><input type="checkbox" data-bk-in="jon" ${jon() ? 'checked' : ''}> ${t('bkJOn')}</label>
      ${jon() && B.norm(V.code).length !== 16 ? `<div class="note slipwarn warn">${icon('key')} ${t('bkJNeedCode')}</div>` : ''}
      ${journalChips()}
      <div class="actions" style="justify-content:flex-start"><button class="btn small" data-bk="jsend" ${V.busy ? 'disabled' : ''}>${t('bkJSend')}</button><button class="btn small ghost" data-bk="jaudit">${t('bkJAudit')}</button><button class="btn small ghost" data-bk="jrestore">${t('bkJRestore')}</button></div>
      ${V.jmsg ? `<div class="note">${V.jmsg}</div>` : ''}${V.audit ? auditView(V.audit) : ''}
      <div class="note">${t('bkJLimits')}</div>
      <div class="sec-title">${icon('restore')} ${t('bkRestore')}</div>
      <div class="note">${t('bkRestoreNote')}</div>
      <div class="fields"><label class="f">${t('bkCodeIn')}<input data-bk-in="pcode" type="text" autocomplete="off" value="${V.pcode}" placeholder="XXXX-XXXX-XXXX-XXXX"></label>
        <label class="f">${t('bkPick')}<input type="file" data-bk-file="1" accept=".gpb,.json,application/json"></label></div>
      ${p ? pendingView(p) : ''}
      ${V.msg ? `<div class="note">${V.msg}</div>` : ''}
      <div class="note">${t('bkLimits')}</div></div></div>`;
  }
  const jon = () => store.get('gp.journal.on') === '1';
  const jopts = () => ({ code: V.code, url: V.url, token: V.token, batch: 25 });
  function journalChips() {
    const J = window.Journal, tot = J.allEvents(store).length, pend = J.pending(store).length, fl = (() => { try { return JSON.parse(store.get('gp.journal.flush')); } catch (e) { return null; } })();
    return `<div class="chips"><div class="kchip" style="--c:--s6">${icon('cloud_done')}<b>${tot - pend}</b><span>${t('bkJSynced')}</span></div>
      <div class="kchip" style="--c:${pend ? '--s4' : '--s6'}">${icon('schedule_send')}<b>${pend}</b><span>${t('bkJPending')}</span></div>
      <div class="kchip" style="--c:--s1">${icon('history')}<b>${fl ? new Date(fl.ts).toISOString().slice(11, 16) : '–'}</b><span>${t('bkJLastTry')}${fl && fl.failed ? ' · ' + t('bkFail') : ''}</span></div></div>`;
  }
  function auditView(a) {
    if (!a.ok) return `<div class="note slipwarn err">${icon('error')} ${t('bkFail')} (${a.status || t('bkNet')})</div>`;
    const bad = !a.chain || a.missing || a.altered;
    return `<div class="tablewrap"><table><tr><td>${t('bkAChain')}</td><td style="color:var(${a.chain ? '--s6' : '--s8'})">${a.chain ? '✔' : '✖ #' + a.brokenAt}</td></tr><tr><td>${t('bkJSynced')}</td><td>${a.synced} / ${a.total}</td></tr><tr><td>${t('bkJPending')}</td><td>${a.notSent}</td></tr>
      <tr><td>${t('bkAMissing')}</td><td style="color:var(${a.missing ? '--s8' : '--s6'})">${a.missing}</td></tr><tr><td>${t('bkAAltered')}</td><td style="color:var(${a.altered ? '--s8' : '--s6'})">${a.altered}</td></tr><tr><td>${t('bkAServer')}</td><td>${a.serverRecords}</td></tr></table></div>
      ${bad ? `<div class="note slipwarn err">${icon('error')} ${t('bkABad')}</div>` : `<div class="note slipwarn" style="color:var(--s6)">${icon('verified')} ${t('bkAGood')}</div>`}`;
  }
  let timer = null;
  function kick() {                                  // lazy: after the shop stops changing things for a moment, send what is pending; never blocks the UI
    if (!jon() || B.norm(V.code).length !== 16 || !window.Journal.pending(store).length) return;
    clearTimeout(timer); timer = setTimeout(async () => { Net.persist(); await window.Journal.flush(store, jopts()); window.dispatchEvent(new Event('gp-render')); }, 2500);
  }
  function demoPanel() {
    const st = R().state;
    return `<div class="demo"><b>${icon('dns')} ${t('bkDemoHead')}</b><div class="note">${t('bkDemoNote')}</div>
      <label class="chk"><input type="checkbox" data-bk-in="down" ${st.down ? 'checked' : ''}> ${t('bkDemoDown')}</label>
      <div class="note">${t('bkJServer')}: <b>${st.journal.length}</b> · ${Math.round(JSON.stringify(st.journal).length / 1024)} kB</div>
      ${st.backups.length ? `<div class="tablewrap"><table><tr><th>${t('bkRcptId')}</th><th class="n">B</th><th>${t('bkDemoSees')}</th></tr>${st.backups.slice(-3).reverse().map(r => `<tr><td>${r.id}</td><td class="n">${r.bytes}</td><td><small style="word-break:break-all">${(JSON.parse(r.text).ct || '').slice(0, 44)}…</small></td></tr>`).join('')}</table></div>` : ''}</div>`;
  }
  const stName = s => t('bkst_' + s);
  function pendingView(p) {
    const bad = p.ver.filter(x => !x.ok).length;
    return `<div class="sec-title">${t('bkSummary')} · ${p.bundle.created.slice(0, 10)} · ${B.events(p.bundle)} ${t('bkEvents')}</div>
      <div class="tablewrap"><table><tr><th>${t('bkKind')}</th><th>${t('ticketNo')}</th><th class="n">${t('bkEvents')}</th><th>${t('bkVerify')}</th><th>${t('bkVsLocal')}</th></tr>
      ${p.bundle.ledgers.map((l, i) => `<tr><td>${t('bkk_' + l.kind)}</td><td>${l.tk}</td><td class="n">${p.ver[i].events}</td><td style="color:var(${p.ver[i].ok ? '--s6' : '--s8'})">${p.ver[i].ok ? '✔' : '✖ ' + (p.ver[i].bad[0] || '')}</td><td>${stName(p.cmp[i].state)}</td></tr>`).join('')}</table></div>
      ${bad ? `<div class="note slipwarn err">${icon('error')} ${bad} ${t('bkBadChains')}</div>` : ''}
      <div class="actions" style="justify-content:flex-start"><button class="btn" data-bk="apply">${t('bkApply')}</button><button class="btn small ghost" data-bk="cancel">${t('bkCancel')}</button></div>`;
  }
  const download = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };

  async function click(el) {
    const n = el.closest('[data-bk]'); if (!n) return false; const a = n.dataset.bk;
    if (a === 'gen') { V.shown = B.recoveryCode(); V.code = V.shown; V.msg = ''; return true; }
    if (a === 'save') {
      V.msg = '';
      if (!V.plain && B.norm(V.code).length !== 16) { V.msg = '⚠ ' + t('bkNeedCode'); return true; }
      const bundle = nowSnap(), text = V.plain ? JSON.stringify(bundle) : JSON.stringify(await B.seal(bundle, V.code)), name = 'gp-backup-' + new Date().toISOString().slice(0, 10) + (V.plain ? '.json' : '.gpb');
      download(name, text); store.set('gp.backup.last', JSON.stringify({ ts: Date.now(), events: B.events(bundle), channel: 'file', sha: await B.sha256(text), bytes: text.length }));
      V.msg = '✔ ' + name + ' · ' + text.length + ' B · SHA-256 ' + (await B.sha256(text)).slice(0, 12); return true;
    }
    if (a === 'apply' && V.pending) {
      const p = V.pending, r = await B.apply(p.bundle, store, { verified: p.ver }); V.pending = null;
      V.msg = '✔ ' + t('bkApplied') + ': ' + r.applied + (r.skipped.length ? ' · ' + t('bkSkipped') + ': ' + r.skipped.length : '') + ' — ' + t('bkReload');
      setTimeout(() => location.reload(), 1800); return true;
    }
    if (a === 'cancel') { V.pending = null; return true; }
    if (a === 'send') {
      V.wmsg = '';
      if (B.norm(V.code).length !== 16) { V.wmsg = '⚠ ' + t('bkNeedCode'); return true; }
      V.busy = true; window.dispatchEvent(new Event('gp-render'));
      const bundle = nowSnap(), text = JSON.stringify(await B.seal(bundle, V.code)), r = await R().call(V.url, 'POST', '/backup', text, V.token); V.busy = false;
      store.set('gp.web.url', V.url); store.set('gp.web.token', V.token);
      if (r.status === 200 && r.json.ok) {
        const ok = r.json.sha256 === await B.sha256(text);
        const list = receipts(); list.unshift({ ts: r.json.ts, id: r.json.id, bytes: r.json.bytes, sha256: r.json.sha256 }); store.set('gp.backup.receipts', JSON.stringify(list.slice(0, 10)));
        if (ok) store.set('gp.backup.last', JSON.stringify({ ts: Date.now(), events: B.events(bundle), channel: 'web', sha: r.json.sha256, bytes: text.length }));
        V.wmsg = ok ? '✔ ' + t('bkSent') + ' · ' + r.json.id + ' · ' + r.json.bytes + ' B' : '⚠ ' + t('bkShaMismatch');
      } else V.wmsg = '⚠ ' + t('bkFail') + ' (' + (r.status || t('bkNet')) + (r.json && r.json.why ? ' ' + r.json.why : '') + '). ' + t('bkNotBacked');
      return true;
    }
    if (a === 'share') {
      V.smsg = ''; if (B.norm(V.code).length !== 16) { V.smsg = '⚠ ' + t('bkNeedCode'); return true; }
      const bundle = nowSnap(), text = JSON.stringify(await B.seal(bundle, V.code)), name = 'gp-backup-' + new Date().toISOString().slice(0, 10) + '.gpb', sha = await B.sha256(text);
      store.set('gp.share.to', V.mailto); const file = new File([text], name, { type: 'application/json' });
      const rec = () => store.set('gp.backup.last', JSON.stringify({ ts: Date.now(), events: B.events(bundle), channel: 'share', sha, bytes: text.length }));
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: name, text: 'SHA-256 ' + sha }); rec(); V.smsg = '✔ ' + t('bkShared') + ' · SHA-256 ' + sha.slice(0, 12); }
        catch (e) { V.smsg = e && e.name === 'AbortError' ? t('bkShareCancelled') : '⚠ ' + t('bkFail'); }
        return true;
      }
      const m = B.mailto(V.mailto, name, B.events(bundle), sha, bundle.created); download(name, text); rec();
      V.smsg = '✔ ' + t('bkMailPrepared') + ' · ' + name + ' · SHA-256 ' + sha.slice(0, 12); (window.__openMail || (u => { location.href = u; }))(m.url); return true;
    }
    if (a === 'jsend' || a === 'jaudit' || a === 'jrestore') {
      V.jmsg = ''; if (B.norm(a === 'jrestore' ? (V.pcode || V.code) : V.code).length !== 16) { V.jmsg = '⚠ ' + t('bkNeedCode'); return true; }
      V.busy = true; window.dispatchEvent(new Event('gp-render')); Net.persist();
      if (a === 'jsend') { const r = await window.Journal.flush(store, jopts()); V.jmsg = r.failed ? '⚠ ' + t('bkFail') + ' (' + (r.status || t('bkNet')) + '). ' + t('bkJKept') : '✔ ' + t('bkSent') + ' · ' + r.sent; }
      else if (a === 'jaudit') V.audit = await window.Journal.audit(store, jopts());
      else { const r = await window.Journal.restore({ ...jopts(), code: V.pcode || V.code }); if (!r.ok) V.jmsg = '⚠ ' + (r.status ? t('bkFail') + ' (' + r.status + ')' : t('bkCannotOpen')); else { const ver = await B.verify(r.bundle); V.pending = { bundle: r.bundle, ver, cmp: B.compare(r.bundle, store) }; V.jmsg = '✔ ' + r.records + ' ' + t('bkEvents'); } }
      V.busy = false; return true;
    }
    if (a === 'fetch') {
      V.wmsg = ''; V.busy = true; const r = await R().call(V.url, 'GET', '/backup/latest', null, V.token); V.busy = false;
      if (!(r.status === 200 && r.json.ok)) { V.wmsg = '⚠ ' + t('bkFail') + ' (' + (r.status || t('bkNet')) + (r.json && r.json.why ? ' ' + r.json.why : '') + ')'; return true; }
      V.wmsg = '✔ ' + r.json.id; return openText(r.json.text);
    }
    return false;
  }
  async function openText(text) {
    let j; try { j = JSON.parse(text); } catch (e) { V.msg = '⚠ ' + t('bkUnreadable'); return true; }
    let bundle = j.kind === 'gp-backup' ? j : null;
    if (!bundle) { const r = await B.open(j, V.pcode || V.code); if (!r.ok) { V.msg = '⚠ ' + t(r.why === 'cannot-open' ? 'bkCannotOpen' : 'bkUnreadable'); return true; } bundle = r.bundle; }
    const ver = await B.verify(bundle); V.pending = { bundle, ver, cmp: B.compare(bundle, store) }; return true;
  }
  async function file(el) {
    V.msg = ''; V.pending = null; const f = el.files && el.files[0]; if (!f) return true;
    return openText(await f.text());
  }
  function input(el) { const k = el.dataset.bkIn; if (k === 'plain') V.plain = el.checked; else if (k === 'jon') { store.set('gp.journal.on', el.checked ? '1' : '0'); kick(); } else if (k === 'mailto') V.mailto = el.value; else if (k === 'down') R().state.down = el.checked; else V[k] = el.value; return k === 'plain' || k === 'down' || k === 'jon' ? 'change' : 'type'; }
  return { kick, bind, view, click, file, input, state: V, stale, last };
})();
