// Film chapters (spec §15.6): chapter card, then scripted steps through the real app. Same API drives the witness (pace 0).
window.Story = (function () {
  const Net = window.Net, P = window.Pay, Flow = window.Flow, Dash = window.Dash;
  let X;                                           // ctx from app.js: { S, render, setTab, theme }
  const st = { playing: false, idx: -1, stop: false, card: null, caption: null, cardSecs: 3, pace: 1.5 };
  const sleep = s => new Promise(r => setTimeout(r, s * 1000));
  const cap = async k => { st.caption = k; X.render(); await sleep(st.pace); };
  const act = async s => { await Flow.act(s); X.render(); };
  const live = () => Object.keys(Net.shopL).pop();
  const wait = async () => { await sleep(0.05); X.render(); };

  const chapters = [
    async () => {                                  // 1 issue
      X.setTab('counter'); X.S.action = 'a1'; Object.assign(X.S.issue, { loan: 80000, weight: 15.16, phone: '0800000001', name: 'สมชาย ตัวอย่าง' }); await cap('cap1');
      X.setTab('journey'); await act('issue'); await cap('cap1b');
    },
    async () => {                                  // 2 scan + ack
      X.setTab('journey'); const tk = live(); X.S.j.tk = tk;
      await act(`send|shop|qr|${tk}`); await act('openOffer'); await cap('cap2');
      X.S.j.code = Net.shopL[tk].chain.shop[0].body.code; X.render(); await cap('cap2b');
      X.S.j.via = 'web'; await act('ack'); await wait(); await cap('cap2c');
    },
    async () => {                                  // 3 pay
      X.setTab('journey'); X.S.j.mode = 'installment'; X.S.j.slip = 'ok'; await cap('cap3');
      await act('pay'); await wait(); await cap('cap3b');
      X.S.j.mode = 'other'; X.S.j.amt = 5000; X.render(); await cap('cap3c'); await act('pay'); await wait();
      X.S.j.mode = 'installment'; X.S.j.slip = 'duplicate'; await act('pay'); await wait(); await act('pay'); await wait(); await cap('cap3d');
      X.S.j.slip = 'ok'; X.S.j.mode = 'full'; X.render(); await cap('cap3e');
    },
    async () => {                                  // 4 offline + channels
      X.setTab('journey'); X.S.j.mode = 'installment'; X.S.j.slip = 'ok';
      Net.setOnline('phone', false); X.S.j.via = 'whatsapp'; await act('pay'); await cap('cap4');
      const w1 = Net.wire[Net.wire.length - 1]; Net.lose(w1.id); X.render(); await cap('cap4b');
      X.S.j.slip = 'ok'; X.S.j.via = 'email'; await act('pay'); const w2 = Net.wire[Net.wire.length - 1]; await cap('cap4c');
      await act(`deliver|${w2.id}`); await wait(); await cap('cap4d');
      Net.setOnline('phone', true); await sleep(0.3); await wait(); await cap('cap4e');
    },
    async () => {                                  // 5 tamper
      X.setTab('dash'); const tk = live(); Dash.state.drill = ['w_status', 'status', 'active']; await Dash.showHist(tk); X.render(); await cap('cap5');
      Net.tamper(tk); await Dash.showHist(tk); X.render(); await cap('cap5b'); await cap('cap5c');
      Net.repair(tk); await Dash.showHist(tk); X.render(); await sleep(st.pace);
    },
    async () => {                                  // 6 dashboard drill
      X.setTab('dash'); Dash.state.hist = null; Dash.state.drill = null; X.render(); await cap('cap6');
      Dash.state.drill = ['w_cat', 'cat', 'ornament']; X.render(); await cap('cap6b');
      await Dash.showHist(live()); X.render(); await sleep(st.pace);
    },
    async () => {                                  // 7 NPL, green list, CRM
      X.setTab('dash'); Dash.state.hist = null; const rs = Dash.rows().filter(r => r.risk === 'npl').sort((a, b) => b.overdueDays - a.overdueDays);
      Dash.state.drill = ['k_npl', 'none', 'all']; X.render(); await cap('cap7');
      const tk = rs[0] && rs[0].tk; if (tk) { await Dash.showHist(tk); X.render(); await cap('cap7b');
        await Net.logFollowup(tk, { DateContact: Net.today, Channel: 'call', Outcome: 'promised', Note: 'Sample note', DateNext: Net.today }); await Dash.showHist(tk); X.render(); await cap('cap7c'); }
      Dash.state.hist = null; Dash.state.drill = ['k_green', 'none', 'all']; X.render(); await cap('cap7d');
    },
    async () => { X.setTab('books'); await cap('cap8'); await cap('cap8b'); },                 // 8 books
    async () => { X.setTab('ad'); await cap('cap9'); },                                         // 9 AD data model
    async () => {                                  // 10 theme
      X.setTab('theme'); await cap('capTheme');
      for (const p of ['gold', 'night', 'quickgold']) { X.preset(p); X.render(); await sleep(st.pace); }
    },
    async () => {                                  // 8 customise dashboard
      X.setTab('dash'); Dash.state.hist = null; Dash.state.drill = null; Dash.state.edit = true; X.render(); await cap('capDash1');
      Dash.moveTo('w_age', 'k_open'); Dash.state.layout.find(w => w.id === 'w_month').size = 'l'; X.render(); await sleep(st.pace);
      Dash.state.layout.push({ ...Dash.CATALOG.find(w => w.id === 'x_grp') }); X.render(); await cap('capDash2');
      Dash.state.layout.push({ id: 'u_demo', title: 'Silver and other, principal', metric: 'principal', scope: 'open', groupBy: 'cat', chart: 'columns', size: 'm' }); X.render(); await cap('capDash3');
      Dash.state.edit = false; X.render();
    },
    async () => { X.setTab('thai'); await sleep(st.pace); },
    async () => { X.setTab('local'); await sleep(st.pace); }
  ];
  const sub = i => ({ t: 'ch' + (i + 1) + 't', s: 'ch' + (i + 1) + 's' });

  async function run(i) {
    st.idx = i; st.card = { n: i + 1, ...sub(i) }; X.render();
    if (st.cardSecs) await sleep(st.cardSecs);
    st.card = null; X.render();
    await chapters[i](); st.caption = null; X.render();
  }
  async function play(from, to) {
    st.playing = true; st.stop = false;
    for (let i = from; i <= to && !st.stop; i++) await run(i);
    st.playing = false; st.idx = -1; X.render();
  }
  return { init(ctx) { X = ctx; }, st, chapters, run, play, stop() { st.stop = true; }, count: chapters.length };
})();
