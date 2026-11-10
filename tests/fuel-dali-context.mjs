// Fuel DALI context: built only from fuel data, names the asked truck, and never carries rate fields.
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from '../transport/fuel/math.ts';
import { buildFuelContext, makeFuelData, mentioned } from '../transport/fuel/daliContext.ts';

let n = 0;
const tx = (plate, at, liters, km, driver) => ({
  id: String(++n), at, vehicleId: '', plate, vehicleType: 'Trailer', driverCode: '', driver,
  station: 'S1', fuelType: 'diesel', amount: liters * 20.5, liters, pumpReading: null, variance: 0,
  totalAmount: liters * 20.5 * 1.0145, km, cardDistance: null, cardKmL: null, cardValidity: 'Correct', cardReason: '', txType: 'Normal',
});
const txs = [];
for (const [plate, driver, kmL, start] of [['ن ص ط 3893', 'محمد علي حسن', 1.7, 100000], ['ر ع ب 2521', 'أحمد سمير', 2.4, 200000]]) {
  for (let i = 0; i < 12; i++) txs.push(tx(plate, `2026-10-${String(i + 1).padStart(2, '0')}T08:00`, 300, start + Math.round(i * 300 * kmL), driver));
}
const d = makeFuelData(txs, DEFAULT_SETTINGS);
const user = { id: 'u', email: 'x@y', name: 'Tester', role: 'FUEL' };

assert.deepEqual(mentioned(d, 'عربية ٣٨٩٣ عاملة إيه؟').plates, ['ن ص ط 3893'], 'Arabic digits find the plate');
assert.deepEqual(mentioned(d, 'استهلاك احمد سمير').drivers, ['أحمد سمير'], 'driver name (alef forms) found');

const ctx = buildFuelContext(d, user, 'how is 3893 doing?', [], []);
assert.match(ctx, /SECTION: Fuel/);
assert.match(ctx, /TRUCK HEALTH/);
assert.match(ctx, /ASKED ABOUT: ن ص ط 3893/);
assert.match(ctx, /THEIR LATEST FULL-TO-FULL FILLS/);
assert.doesNotMatch(ctx, /1\*20|40 RF|40 DC|PRICE LIST|QUOTATION|price_/i, 'no customer-rate data in the fuel context');

// Follow-up with no plate uses the previous question.
const follow = buildFuelContext(d, user, 'and last week?', [{ role: 'user', content: 'how is 3893 doing?' }], []);
assert.match(follow, /ASKED ABOUT: ن ص ط 3893/);

const empty = buildFuelContext(makeFuelData([], DEFAULT_SETTINGS), user, 'hi', [], []);
assert.match(empty, /none uploaded yet/);
console.log('fuel dali context: all checks passed');
