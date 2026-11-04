/**
 * DALI regression test built from real questions staff asked (DALI chat logs,
 * Sep 30 – Nov 1 2026) that used to get a wrong answer. Unlike
 * dali-question-benchmark.mjs, this runs the real engine on a small fixture.
 * Run with: npm run test:dali-real
 */
import { answerDali, resetDaliContext } from '../daliEngine.ts';

const g = (unitNumber, location, status) => ({ unitNumber, location, status });
const data = {
  gensets: [
    g('100540-108-422', 'ALEX', 'IN_STOCK'), g('121422-119', 'WORKSHOP', 'RETIRED'),
    g('HRSG594764-513', 'WORKSHOP', 'MAINTENANCE'), g('206004 - 504', 'GOUDA', 'CLIPPED_ON'),
    g('HL9999 - 454', 'GOUDA', 'CLIPPED_ON'), g('SZLG221227', 'GOUDA', 'IN_STOCK'),
    g('5152-159 - 438', 'DAM', 'CLIPPED_ON'), g('100321-109-403', 'DAM', 'IN_STOCK'),
  ],
  operations: [
    { bookingNumber: '279100617', containerNumber: '', gensetNumber: '206004 - 504', customerName: 'SEAGATE', status: 'UNDER OPERATE', clipOnPort: 'GOUDA', clipOffPort: 'SCCT', operationDate: '2026-10-07', rate: '2000', vat: '0' },
    { bookingNumber: 'CFA0967823', containerNumber: 'CGMU5308046', gensetNumber: '5152-159 - 438', customerName: 'NUTIC', status: 'DONE', clipOnPort: 'DAM', clipOffPort: 'DAM', operationDate: '2026-10-05', rate: '500', vat: '0' },
  ],
  reservations: [],
  invoices: [
    { customerName: 'NUTIC', amount: 500, status: 'UNPAID', date: '2026-10-05', dueDate: '2026-10-20' },
  ],
  payments: [],
  maintenance: [],
  customers: [
    { id: '1', name: 'ELHANDASIA' }, { id: '2', name: 'SEAGATE' }, { id: '3', name: 'NUTIC' }, { id: '4', name: 'MASAR' }, { id: '5', name: 'ASHOUR' },
  ],
  aliases: [{ alias: 'نوتك', customer: 'NUTIC' }, { alias: 'سي جيت', customer: 'SEAGATE' }],
  prices: [
    { customerName: 'ELHANDASIA', portIn: 'DAM', portOut: 'DAM', price: 1500, includeVat: false },
    { customerName: 'ELHANDASIA', portIn: 'ALEX', portOut: 'ALEX', price: 1500, includeVat: false },
    { customerName: 'ELHANDASIA', portIn: 'GOUDA', portOut: 'PSD', price: 2200, includeVat: false },
    { customerName: 'MASAR', portIn: 'DAM', portOut: 'DAM', price: 1800, includeVat: true },
  ],
  now: new Date('2026-11-01T12:00:00Z'),
};

// [question, text that must appear, text that must NOT appear]
const cases = [
  ['سعر مولد الهندسية دمياط', '1,500', 'مخزون'],
  ['سعر مولد مسار دمياط', '1,800', 'مخزون'],
  ['price for ELHANDASIA at alex', 'ALEX→ALEX', 'in stock'],
  ['سعر مولد دمياط', 'لأنهي عميل', 'مخزون'],
  ['Genset 422', '100540-108-422', "couldn't find"],
  ['فين مولد 422', '100540-108-422', 'مفيش مولد'],
  ['Where is 4764', 'HRSG594764-513', 'Fleet total'],
  ['soa nutic', 'invoice', 'recorded operation'],
  ['كشف حساب نوتك', 'فاتورة', 'عملية مسجلة'],
  ['كسف حساب نوتك', 'فاتورة', 'عملية مسجلة'],
  ['genset for seagate', 'SEAGATE', 'Fleet total'],
  ['How many gensets are operating today?', 'CLIPPED_ON: 3', 'Fleet total'],
  ['كم مولد يعمل اليوم؟', 'CLIPPED_ON: 3', 'إجمالي المولدات'],
  ['How many working genset in gouda', 'CLIPPED_ON gensets at Gouda: 2', 'in stock'],
  ['Show today’s bookings', 'today', null],
  ['ANY GENSET IN PROGRESS AT DAM MASTER VIEW BUT NOT IN SAME STOCK', 'Data audit', 'genset(s) – in stock'],
  ['مين دالي', 'Dali Studio', 'بيبيتو'],
  ['Who is DALI?', 'Dali Studio', 'Bebito'],
  ['prices ashour', 'No price is saved for ASHOUR', 'in stock'],
];

let failed = 0;
for (const [q, must, mustNot] of cases) {
  resetDaliContext('t');
  const a = answerDali(q, data, 't') ?? '<null>';
  const ok = a.includes(must) && (!mustNot || !a.includes(mustNot));
  if (!ok) { failed++; console.error(`FAIL: ${q}\n  expected "${must}"${mustNot ? ` and not "${mustNot}"` : ''}\n  got: ${a.split('\n').slice(0, 3).join(' | ')}`); }
}
if (failed) { console.error(`\n${failed}/${cases.length} DALI real-question cases failed`); process.exit(1); }
console.log(`DALI REAL QUESTIONS PASSED (${cases.length} cases)`);
