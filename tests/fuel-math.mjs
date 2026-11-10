// Fuel km/L math: split fills, partial fills, reversals and bad odometer readings.
// Run: npm run test:fuel
import assert from 'node:assert/strict';
import { computeFuel, summarize, DEFAULT_SETTINGS } from '../transport/fuel/math.ts';
import { fuelAlerts, truckHealth } from '../transport/fuel/alerts.ts';
import { explainSegment, explainHealth } from '../transport/fuel/explain.ts';
import { parseDate, parseTime, rowsToTxs, splitUpload, emptyProblems } from '../transport/fuel/parse.ts';
import { cardIssueKind, summarizeCardIssues } from '../transport/fuel/cardnote.ts';

let n = 0;
const tx = (plate, at, liters, km, extra = {}) => ({
  id: String(++n), at, vehicleId: '', plate, vehicleType: 'Trailer', driverCode: '', driver: 'Driver ' + plate,
  station: 'S1', fuelType: 'diesel', amount: liters * 20.5, liters, pumpReading: null, variance: 0,
  totalAmount: liters * 20.5 * 1.0145, km, cardDistance: null, cardKmL: null, cardValidity: 'Correct', cardReason: '', txType: 'Normal', ...extra,
});

// Truck A: steady 2.3 km/L, with a split fill (pump stopped at 9,999 EGP) on day 4.
const A = [
  tx('A', '2026-10-01T08:00', 300, 100000),
  tx('A', '2026-10-02T08:00', 300, 100690),               // 690 km / 300 L = 2.3
  tx('A', '2026-10-03T08:00', 487.32, 101800),            // first part of a split fill
  tx('A', '2026-10-03T08:20', 5.8, 101800),               // second part, same km
  tx('A', '2026-10-04T08:00', 300, 102490),
];
// Truck B: partial fill (only 100 L after 690 km) completed by the next fill.
const B = [
  tx('B', '2026-10-01T08:00', 300, 200000),
  tx('B', '2026-10-02T08:00', 100, 200690),               // 6.9 km/L: impossible, tank not full
  tx('B', '2026-10-03T08:00', 500, 201380),               // 1.38 km/L alone; joined = 1380 / 600 = 2.3
  tx('B', '2026-10-04T08:00', 300, 202070),
];
// Truck C: odometer typo with an extra digit, a reading going backwards, and a reversal.
const C = [
  tx('C', '2026-10-01T08:00', 300, 300000),
  tx('C', '2026-10-02T08:00', 300, 3006901),              // typed 3006901 for 300690
  tx('C', '2026-10-03T08:00', 300, 1000),                 // nonsense reading, skipped
  tx('C', '2026-10-04T08:00', 300, 302070),               // 1380 km / 600 L since the last good one
  tx('C', '2026-10-05T08:00', 300, 302760),
  tx('C', '2026-10-05T09:00', -300, null, { amount: -6150 }), // reversal of the fill above
];

const r = computeFuel([...A, ...B, ...C], DEFAULT_SETTINGS);
const segs = p => r.segments.filter(s => s.plate === p).sort((a, b) => a.at.localeCompare(b.at));

assert.equal(r.price, 20.5, 'price per liter from the data');

// Split fill joined into one fill of 493.12 L over 1,110 km.
const a = segs('A');
assert.equal(a.length, 3);
assert.equal(a[1].liters, 493.12);
assert.equal(a[1].distance, 1110);
assert.ok(a[1].notes.includes('split'));
assert.equal(r.fills.filter(f => f.plate === 'A').length, 4);

// Partial fill joined with the next one: 1,380 km / 600 L = 2.3.
const b = segs('B');
assert.equal(b.length, 2);
assert.equal(b[0].distance, 1380);
assert.equal(b[0].liters, 600);
assert.equal(b[0].kmL, 2.3);
assert.ok(b[0].notes.includes('partial'));

// Extra-digit typo fixed, bad reading skipped (its liters carried forward), reversal cancels its fill.
const c = segs('C');
assert.deepEqual(c.map(s => [s.distance, s.liters]), [[690, 300], [1380, 600]]);
assert.ok(c[0].notes.includes('fixedKm'));
assert.ok(c[1].notes.includes('badKm'));
const rev = r.txViews.filter(v => v.tx.plate === 'C' && (v.flags.includes('reversal') || v.flags.includes('reversed')));
assert.equal(rev.length, 2, 'reversal and the fill it cancels');

// Truck summary + margins: 2,490 km / 1,093 L = 2.28 km/L, inside the margin.
const sa = summarize('A', 'A', segs('A'), A, r.fills.filter(f => f.plate === 'A'), r.targets.A, 10, r.price);
assert.equal(sa.kmL, 2.28);
assert.equal(sa.overMarginL, 0);
assert.equal(sa.status, 'ok');

// A thirsty truck: 1.6 km/L against a 2.3 target with ±10% → over the margin, loss in EGP.
const D = [tx('D', '2026-10-01T08:00', 300, 1000), tx('D', '2026-10-03T08:00', 400, 1640), tx('D', '2026-10-05T08:00', 400, 2280)];
const r2 = computeFuel(D, { ...DEFAULT_SETTINGS, truckTargets: { D: 2.3 } });
const sd = summarize('D', 'D', r2.segments, D, r2.fills, 2.3, 10, r2.price);
assert.equal(sd.kmL, 1.6);
assert.equal(sd.status, 'high');
assert.ok(sd.overMarginL > 180 && sd.overMarginL < 185, `over margin ${sd.overMarginL}`);
assert.ok(Math.abs(sd.lossEgp - sd.overMarginL * 20.5) < 0.5, 'loss = liters over margin × price');

// Parsing the card export's Arabic dates and times.
assert.equal(parseDate('08 نوفمبر 2026'), '2026-11-08');
assert.equal(parseDate('02 سبتمبر 2026'), '2026-09-02');
assert.equal(parseTime('3:55 م'), '15:55');
assert.equal(parseTime('12:52 م'), '12:52');
assert.equal(parseTime('12:10 ص'), '00:10');
const parsed = rowsToTxs([
  ['#', 'Date', 'Time', 'Plate Number', 'Driver name', 'Liters', 'Amount', 'Pump reading', 'KM reading', 'Distance', 'Fuel consumption (KM/L)', 'Distance validity'],
  [17224266, '08 نوفمبر 2026', '3:55 م', '4363 ر ا ق', 'X', '189.82', '3891.31', 'Processing', '-', '4,867', '10,000.00', 'Wrong'],
]);
assert.equal(parsed.length, 1);
assert.equal(parsed[0].at, '2026-11-08T15:55');
assert.equal(parsed[0].km, null);
assert.equal(parsed[0].pumpReading, null);
assert.equal(parsed[0].cardDistance, 4867);
assert.equal(parsed[0].cardKmL, 10000);

// Fuel cost uses what was paid, so a price change mid-period stays right.
const P = [tx('P', '2026-10-01T08:00', 100, 1000), tx('P', '2026-10-02T08:00', 100, 1230, { amount: 2200 })];
const rp = computeFuel(P, DEFAULT_SETTINGS);
const sp = summarize('P', 'P', rp.segments, P, rp.fills, 2.3, 10, rp.price);
assert.equal(sp.cost, 2050 + 2200);

// Alerts.
{
  const S = { ...DEFAULT_SETTINGS, truckTargets: { H: 2.3, L: 2.3, Q: 2.3 }, tankLiters: 400, idleDays: 5 };
  const H = [ // one bad fill: 460 km on 300 L = 1.53 km/L
    tx('H', '2026-11-01T08:00', 300, 10000), tx('H', '2026-11-02T08:00', 300, 10690), tx('H', '2026-11-03T08:00', 300, 11150),
    tx('H', '2026-11-04T08:00', 450, 12185), // 1035 km / 450 L = 2.3, but 450 L > 400 L tank
  ];
  const L = [ // not filled to full, then the next one makes up for it: no alert
    tx('L', '2026-11-01T08:00', 300, 20000), tx('L', '2026-11-02T08:00', 220, 20690), tx('L', '2026-11-03T08:00', 380, 21380),
  ];
  const Q = [tx('Q', '2026-10-20T08:00', 300, 30000), tx('Q', '2026-10-21T08:00', 300, 30690)]; // stopped fuelling 2 weeks ago
  const all = [...H, ...L, ...Q];
  const ra = computeFuel(all, S);
  const al = fuelAlerts(ra, all, S);
  const of = (kind, plate) => al.filter(a => a.kind === kind && a.plate === plate);
  assert.equal(of('overUse', 'H').length, 1, 'bad fill raises overUse');
  assert.ok(of('overUse', 'H')[0].liters > 30, 'overUse liters');
  assert.equal(of('overTank', 'H').length, 1, 'fill bigger than tank');
  assert.equal(al.filter(a => a.plate === 'L' && (a.kind === 'overUse' || a.kind === 'tooFewLiters')).length, 0, 'not-full fill paired with next: no alert');
  assert.equal(of('idle', 'Q').length, 1, 'idle truck');
  assert.equal(al[0].level, 'high', 'urgent first');
}
// Every merge / correction raises an alert (truck A has a split fill, B a partial fill, C a km typo).
{
  const all = [...A, ...B, ...C];
  const al = fuelAlerts(computeFuel(all, DEFAULT_SETTINGS), all, DEFAULT_SETTINGS);
  assert.ok(al.some(a => a.kind === 'splitJoined' && a.plate === 'A' && a.info.count === 2), 'split fill alerted');
  assert.ok(al.some(a => a.kind === 'partialJoined' && a.plate === 'B' && a.info.fills === 2), 'partial fill alerted');
  assert.ok(al.some(a => a.kind === 'kmFixed' && a.plate === 'C' && a.info.to === 300690), 'km typo alerted');
}

// Truck health: steady 2.3 km/L for 2,760 km, then 1.8 km/L for the last 1,620 km → check maintenance.
{
  const M = [tx('M', '2026-10-01T08:00', 300, 50000)];
  let km = 50000, d = 2;
  for (let i = 0; i < 4; i++) { km += 690; M.push(tx('M', `2026-10-0${d++}T08:00`, 300, km)); }       // 2.3
  for (let i = 0; i < 3; i++) { km += 540; M.push(tx('M', `2026-10-${10 + i}T08:00`, 300, km)); }      // 1.8
  const S = { ...DEFAULT_SETTINGS, truckTargets: { M: 2.3 } };
  const rm = computeFuel(M, S);
  const h = truckHealth(rm, S).find(x => x.plate === 'M');
  assert.equal(h.status, 'service', `health ${JSON.stringify(h)}`);
  assert.ok(h.trendPct < -10);
  assert.ok(fuelAlerts(rm, M, S).some(a => a.kind === 'maintenance' && a.plate === 'M'));
}

// Upload: only new rows are added.
{
  const saved = [tx('U', '2026-11-01T08:00', 300, 1000), tx('U', '2026-11-02T08:00', 300, 1690)];
  const file = [
    { ...saved[0] },                                          // same # → already saved
    { ...saved[1], id: 'other-number' },                      // same truck/time/liters/amount, new # → already saved
    tx('U', '2026-11-03T08:00', 300, 2380),                   // new
  ];
  file.push({ ...file[2] });                                  // the new one twice in the file
  const up = splitUpload(file, saved);
  assert.equal(up.fresh.length, 1);
  assert.equal(up.inSystem, 2);
  assert.equal(up.repeated, 1);
}

// Explanation: a split fill is explained step by step and the numbers match the segment.
{
  const strip = x => x.replace(/[\u2066-\u2069]/g, '');
  const r = computeFuel([
    tx('E1', '2026-10-01T08:00:00Z', 400, 100000),
    tx('E1', '2026-10-03T08:00:00Z', 487, 101000),            // pump stopped at 9,999 EGP
    tx('E1', '2026-10-03T08:20:00Z', 13, 101000),
  ], { ...DEFAULT_SETTINGS, truckTargets: { E1: 3 } });
  const seg = r.segments.find(x => x.plate === 'E1' && x.status !== 'pending');
  for (const lang of ['en', 'ar']) {
    const ex = explainSegment(seg, { ...DEFAULT_SETTINGS, truckTargets: { E1: 3 } }, r.price, lang);
    const all = strip(ex.steps.join(' ') + ' ' + ex.verdict);
    assert.ok(all.includes('1,000'), lang + ' distance');
    assert.ok(all.includes('500'), lang + ' liters');
    assert.ok(all.includes('2.00'), lang + ' km/L');
    assert.ok(all.includes('3.00'), lang + ' target');
    assert.ok(strip(ex.short).includes('2.00'), lang + ' short');
    assert.equal(seg.status, 'high');
  }
  assert.ok(strip(explainSegment(seg, DEFAULT_SETTINGS, r.price, 'en').steps.join(' ')).includes('joined into one fill'));
  const h = { plate: 'X', vehicleType: 'T', driver: '', target: 2.3, recentKmL: 1.8, recentKm: 1600, recentFrom: '', baseKmL: 2.3, baseKm: 3000, trendPct: -21.7, vsTargetPct: -21.7, status: 'service' };
  assert.ok(explainHealth(h, 'en', 1500).includes('maintenance'));
}

// Not-full tank caught by the pair rule (like 4323 on 26–27 Sep): 3.03 then 1.27 km/L, 1.92 together, target 2.2.
{
  const P = [
    tx('P', '2026-09-21T08:00', 400, 498529),
    tx('P', '2026-09-26T19:18', 234.15, 499239),   // 710 km → 3.03 (too good, below the 1.5× partial rule)
    tx('P', '2026-09-27T21:15', 400, 499747),      // 508 km → 1.27 (over)
    tx('P', '2026-10-01T08:00', 400, 500627),      // 880 km → 2.2 (normal)
  ];
  const r = computeFuel(P, { ...DEFAULT_SETTINGS, truckTargets: { P: 2.2 } });
  const segs = r.segments.filter(x => x.plate === 'P' && x.status !== 'pending');
  assert.equal(segs.length, 2, 'too-good + over joined into one fill');
  const joined = segs.find(x => x.notes.includes('paired'));
  assert.ok(joined, 'paired note');
  assert.equal(joined.distance, 1218);
  assert.equal(joined.kmL, 1.92);
  assert.equal(joined.status, 'ok');
  assert.deepEqual(joined.pair, [3.03, 1.27]);
  assert.ok(explainSegment(joined, DEFAULT_SETTINGS, r.price, 'en').steps.join(' ').includes('not filled to full'));
  // A real over-use after a too-good fill (together still over the margin) is NOT hidden.
  const Q = [
    tx('Q', '2026-09-21T08:00', 400, 1000),
    tx('Q', '2026-09-26T08:00', 250, 1750),       // 3.0
    tx('Q', '2026-09-27T08:00', 500, 2050),       // 0.6
    tx('Q', '2026-10-01T08:00', 400, 2930),
  ];
  const q = computeFuel(Q, { ...DEFAULT_SETTINGS, truckTargets: { Q: 2.2 } }).segments.filter(x => x.plate === 'Q');
  assert.ok(!q.some(x => x.notes.includes('paired')), 'over-use stays visible');
  // Too good, a small normal top-up, then a big over fill (like 2521 on 3–25 Oct): counted together.
  const R = [
    tx('R', '2026-10-01T08:00', 300, 10000),
    tx('R', '2026-10-05T15:00', 140.35, 10443),   // 3.16
    tx('R', '2026-10-07T15:57', 90.3, 10634),     // 2.12
    tx('R', '2026-10-25T03:15', 360.44, 11170.6), // 1.49
  ];
  const rr = computeFuel(R, { ...DEFAULT_SETTINGS, truckTargets: { R: 2.28 } }).segments.filter(x => x.plate === 'R' && x.status !== 'pending');
  assert.equal(rr.length, 1);
  assert.ok(rr[0].notes.includes('paired'));
  assert.equal(rr[0].status, 'ok');
  // Exactly on the margin edge (1.65 vs 2.2 × 0.75) is not over use.
  const E = [tx('E', '2026-10-01T08:00', 300, 1000), tx('E', '2026-10-05T08:00', 400, 1660)];
  assert.equal(computeFuel(E, { ...DEFAULT_SETTINGS, truckTargets: { E: 2.2 } }).segments.find(x => x.plate === 'E').status, 'ok');
}

// The Arabic export (CSV) of the same report.
{
  const rows = [
    ['#', 'التاريخ', 'الوقت', 'الرقم التعريفي للمركبة', 'رقم اللوحة', 'نوع المركبة', 'إسم السائق', 'المحطة', 'المبلغ', 'الكمية', 'المبلغ الكلي', 'عداد الكيلومترات', 'المسافه', 'معدل الإستهلاك', 'صلاحية المسافه', 'سبب عدم صلاحية المسافه', 'نوع المعاملة'],
    ['17288386', '10 نوفمبر 2026', '4:15 م', '117352', '4363 ر ا ق', 'Default', 'محمد صلاح', 'موبيل-  27 صحراوى', '6080.1', '296.59', '6167.88', '757106.6', '798.6', '2.69', 'غير صحيحة', 'بداية محاسبه جديدة', 'عادي'],
    ['17124639', '04 نوفمبر 2026', '8:08 م', '227655', 'ر أ ق 3893', 'Default', 'عبد القادر محمد', 'اويل', '-7120', '-347.32', '-7220.32', '-', '0', '0', 'صحيحة', '-', 'عادي'],
  ];
  const ar = rowsToTxs(rows);
  assert.equal(ar.length, 2);
  assert.equal(ar[0].at, '2026-11-10T16:15');
  assert.equal(ar[0].liters, 296.59);
  assert.equal(ar[0].km, 757106.6);
  assert.equal(ar[0].driver, 'محمد صلاح');
  assert.equal(ar[0].cardValidity, 'Wrong');
  assert.equal(ar[0].txType, 'Normal');
  assert.equal(ar[1].liters, -347.32);
  assert.equal(ar[1].km, null);
}

// Card complaints are explained, not repeated.
{
  assert.equal(cardIssueKind({ cardValidity: 'Wrong', cardReason: 'بداية محاسبه جديدة' }), 'newStart');
  assert.equal(cardIssueKind({ cardValidity: 'Wrong', cardReason: 'نفس المسافه' }), 'sameKm');
  assert.equal(cardIssueKind({ cardValidity: 'Wrong', cardReason: 'المسافة أقل من  الحد الأدنى' }), 'belowMin');
  assert.equal(cardIssueKind({ cardValidity: 'Correct', cardReason: '' }), null);
  const sum = summarizeCardIssues([{ cardValidity: 'Wrong', cardReason: 'نفس المسافه' }, { cardValidity: 'Wrong', cardReason: 'نفس المسافه' }, { cardValidity: 'Correct', cardReason: '' }], 'en');
  assert.equal(sum.items[0].count, 2);
  assert.ok(sum.items[0].meaning.includes('second part of one fill'));
  // A file that is not the card report says why.
  const p = emptyProblems();
  assert.equal(rowsToTxs([['Name', 'Phone'], ['Ali', '0100']], p).length, 0);
  assert.deepEqual(p.noHeader, ['Name', 'Phone', 'Ali', '0100']);
  const q = emptyProblems();
  rowsToTxs([['Date', 'Plate Number', 'Liters'], ['31/31/2026', 'A', '10'], ['Total', '', '']], q);
  assert.equal(q.skipped.date, 2);
  assert.equal(q.skipped.dateExample, '31/31/2026');
}

console.log('fuel math: all checks passed');

// Alternating fills (one tank filled higher than the next): 2.5 / 1.5 / 2.5 must not report a fuel loss.
{
  let k = 0;
  const t2 = (at, liters, km) => ({ id: 'alt' + (++k), at, vehicleId: '', plate: 'ALT', vehicleType: 'Trailer', driverCode: '', driver: 'D', station: 'S', fuelType: 'diesel',
    amount: liters * 20.5, liters, pumpReading: null, variance: 0, totalAmount: liters * 20.5, km, cardDistance: null, cardKmL: null, cardValidity: 'Correct', cardReason: '', txType: 'Normal' });
  const alt = [t2('2026-10-01T08:00', 300, 10000), t2('2026-10-03T08:00', 300, 10690), t2('2026-10-05T08:00', 300, 11380),
    t2('2026-10-07T08:00', 300, 12130), t2('2026-10-09T08:00', 300, 12580), t2('2026-10-11T08:00', 300, 13330), t2('2026-10-13T08:00', 300, 14020)];
  const ra = computeFuel(alt, { ...DEFAULT_SETTINGS, truckTargets: { ALT: 2.3 } });
  const alerts = fuelAlerts(ra, alt, { ...DEFAULT_SETTINGS, truckTargets: { ALT: 2.3 } });
  assert.equal(alerts.filter(a => a.kind === 'overUse').length, 0, 'alternating fills are not a fuel loss');
  assert.ok(ra.segments.some(s => s.notes.includes('paired')), 'the over fill is paired with its neighbour');
}
console.log('fuel math: alternating fills check passed');

// A new upload must not bring back alerts that were already checked (ids stay the same),
// a checked truck comes back only if it gets worse, and the check is let go once it is fixed.
{
  const { isChecked, checkIds, staleChecked } = await import('../transport/fuel/alerts.ts');
  let k = 0, km = 50000, day = 1;
  const fill = (kmL) => { km += 690; const at = `2026-10-${String(day++).padStart(2, '0')}T08:00`;
    return { id: 'h' + (++k), at, vehicleId: '', plate: 'H', vehicleType: 'Trailer', driverCode: '', driver: 'D', station: 'S', fuelType: 'diesel',
      amount: 690 / kmL * 20.5, liters: Math.round(690 / kmL * 100) / 100, pumpReading: null, variance: 0, totalAmount: 0, km, cardDistance: null, cardKmL: null,
      cardValidity: 'Correct', cardReason: '', txType: 'Normal' }; };
  const st = { ...DEFAULT_SETTINGS, truckTargets: { H: 2.3 } };
  const run = xs => fuelAlerts(computeFuel(xs, st), xs, st);
  const first = [fill(2.3), ...Array.from({ length: 5 }, () => fill(2.3)), ...Array.from({ length: 3 }, () => fill(1.8))];
  const a1 = run(first);
  assert.ok(a1.some(a => a.kind === 'maintenance'), 'the truck needs a check');
  const checked = new Set(a1.flatMap(checkIds));
  const second = [...first, fill(1.8)]; // next upload: same problem, the 1,500 km window has moved
  const back = run(second).filter(a => a.at <= first[first.length - 1].at || a.kind === 'maintenance').filter(a => !isChecked(a, checked));
  assert.deepEqual(back.map(a => a.id), [], 'nothing already checked comes back after an upload');
  // Old-style ids (made before this change) still count as checked.
  assert.ok(isChecked(run(second).find(a => a.kind === 'maintenance'), new Set(['maintenance|H|2026-10-01'])));
  const fixed = [...second, ...Array.from({ length: 4 }, () => fill(2.35))]; // back at target
  assert.ok(!run(fixed).some(a => a.kind === 'maintenance' || a.kind === 'dropping'));
  assert.deepEqual(staleChecked(truckHealth(computeFuel(fixed, st), st), [...checked]).filter(id => id.startsWith('maintenance')).length, 1,
    'the old health check is dropped so a new drop shows again');
  km = second[second.length - 1].km; day = 11;
  const worse = [...second, fill(1.5), fill(1.5)];
  assert.ok(run(worse).some(a => a.kind === 'maintenance' && !isChecked(a, checked)), 'worse than when it was checked: shows again');
}
console.log('fuel math: checked alerts survive new uploads')
