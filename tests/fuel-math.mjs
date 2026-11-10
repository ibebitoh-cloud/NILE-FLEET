// Fuel km/L math: split fills, partial fills, reversals and bad odometer readings.
// Run: npm run test:fuel
import assert from 'node:assert/strict';
import { computeFuel, summarize, DEFAULT_SETTINGS } from '../transport/fuel/math.ts';
import { fuelAlerts } from '../transport/fuel/alerts.ts';
import { parseDate, parseTime, rowsToTxs, splitUpload } from '../transport/fuel/parse.ts';

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

console.log('fuel math: all checks passed');
