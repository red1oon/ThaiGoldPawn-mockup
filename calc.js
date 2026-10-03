// Pawn calculations — every rule cites PAWN_FINTECH_SPEC.md (spec §) / client xlsx cell.
window.Calc = (function () {
  const GRAM_PER_BAHT = 15.16;                       // xlsx L29, util.dart:1725
  const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;

  // Masters (xlsx; editable in Settings)
  const goldTypes = [                                // §2.4, xlsx I26-J28
    { th: 'ทองร้าน มีใบรับประกัน', en: 'Own shop, with certificate', pct: 87 },
    { th: 'ทองร้าน ไม่มีใบรับประกัน', en: 'Own shop, no certificate', pct: 84 },
    { th: 'ทองร้านอื่น', en: 'Other shop', pct: 82 }
  ];
  const rates = [                                    // §2.3, xlsx L15-R21 (%/month)
    { grp: 'standard', from: 1, to: 99999, rate: 1.25 },
    { grp: 'standard', from: 100000, to: 999999, rate: 1.24 },
    { grp: 'vip', from: 1, to: 99999, rate: 1.15 },
    { grp: 'vip', from: 100000, to: 9999999, rate: 1 },
    { grp: 'supervip', from: 10000000, to: 100000000, rate: 0.9 },
    { grp: 'relative', from: 1, to: 10000000, rate: 0.85 }
  ];
  const ratioTerm = [                                // §2.6, xlsx P26-R28
    { from: 1, to: 80, months: 3 }, { from: 81, to: 90, months: 2 }, { from: 91, to: 100, months: 1 }
  ];
  const profiles = {                                 // §5b, user decision 2026-10-03
    c1: { taxPoint: 'interest',  // RD gold-shop manual §3.7.2 (2017): VAT on any consideration received before redemption; 'close'/'final' selectable
          basis: 'month', rounding: 'half' },
    c2: { taxPoint: 'interest', basis: 'day', rounding: 'day' }
  };

  function rateFor(grp, amount) {
    const row = rates.find(r => r.grp === grp && amount >= r.from && amount <= r.to)
      || rates.find(r => r.grp === grp);
    return row ? row.rate : 0;
  }
  function termByRatio(ratioPct) {
    const p = Math.ceil(ratioPct);
    const row = ratioTerm.find(r => p >= r.from && p <= r.to);
    return row ? row.months : null;
  }
  // §3: value = gram/15.16 × price; P mode limit = value × % ; A mode = (price − deduct) × baht  [Q3 to confirm]
  function appraise(weight, pricePerBaht, pct, mode, deductPerBaht) {
    const baht = weight / GRAM_PER_BAHT;
    const value = r2(baht * pricePerBaht);
    const limit = mode === 'A' ? r2(baht * (pricePerBaht - deductPerBaht)) : r2(value * pct / 100);
    return { baht, value, limit };
  }

  // dates (ISO yyyy-mm-dd, local)
  const D = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const iso = dt => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  function edate(s, n) {                             // Excel EDATE
    const d = D(s), day = d.getDate();
    const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(day, last)); return iso(t);
  }
  const daysBetween = (a, b) => Math.round((D(b) - D(a)) / 86400000);
  function fullMonths(a, b) {
    let m = 0; while (D(edate(a, m + 1)) <= D(b)) m++; return m;
  }

  // §4.1 + client answer 2: interest owed from `last` to `today`, by the branch rounding rule
  function owed(loan, agreedMonthly, ratePct, last, today, rounding) {
    if (D(today) <= D(last)) return { periods: 0, amount: 0, days: 0 };
    const days = daysBetween(last, today);
    if (rounding === 'day') {                        // xlsx AC51: loan × rate × 12 / 365 per day
      const perDay = loan * ratePct / 100 * 12 / 365;
      return { periods: days, unit: 'day', amount: r2(perDay * days), days };
    }
    const m = fullMonths(last, today);
    const left = daysBetween(edate(last, m), today);
    let part = 0;
    if (left > 0) {
      if (rounding === 'month') part = 1;
      else if (rounding === 'half') part = left <= 15 ? 0.5 : 1;   // xlsx X90-X91
      else if (rounding === 'week') part = Math.ceil(left / 7) * 12 / 52; // [to confirm]
    }
    const periods = m + part;
    return { periods, unit: 'month', amount: r2(agreedMonthly * periods), days };
  }

  return { GRAM_PER_BAHT, r2, goldTypes, rates, ratioTerm, profiles, rateFor, termByRatio, appraise, edate, daysBetween, owed, D };
})();
