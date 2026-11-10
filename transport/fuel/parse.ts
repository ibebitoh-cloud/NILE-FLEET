import type { FuelTx } from './math';

/** Reads the fuel-card "Fuel Transactions" export (.xlsx / .xls / .csv). */

const HEADERS: Record<string, keyof FuelTx | 'date' | 'time'> = {
  '#': 'id', 'id': 'id', 'transaction id': 'id',
  'date': 'date', 'التاريخ': 'date', 'time': 'time', 'الوقت': 'time',
  'vehicle id': 'vehicleId', 'plate number': 'plate', 'plate': 'plate', 'رقم اللوحة': 'plate',
  'vehicle type': 'vehicleType', 'driver code': 'driverCode', 'driver name': 'driver', 'driver': 'driver', 'السائق': 'driver',
  'station': 'station', 'المحطة': 'station', 'fuel type': 'fuelType',
  'amount': 'amount', 'liters': 'liters', 'litres': 'liters', 'لتر': 'liters',
  'pump reading': 'pumpReading', 'variance': 'variance', 'total amount': 'totalAmount',
  'km reading': 'km', 'odometer': 'km', 'distance': 'cardDistance',
  'fuel consumption (km/l)': 'cardKmL', 'distance validity': 'cardValidity',
  'distance validaty reason': 'cardReason', 'distance validity reason': 'cardReason', 'transaction type': 'txType',
  // Arabic export of the same report.
  'الرقم التعريفي للمركبة': 'vehicleId', 'نوع المركبة': 'vehicleType', 'كود السائق': 'driverCode', 'اسم السائق': 'driver',
  'نوع الوقود': 'fuelType', 'المبلغ': 'amount', 'الكمية': 'liters', 'قراءة صورة المضخة': 'pumpReading', 'الفرق': 'variance',
  'المبلغ الكلي': 'totalAmount', 'عداد الكيلومترات': 'km', 'المسافه': 'cardDistance', 'معدل الاستهلاك': 'cardKmL',
  'صلاحية المسافه': 'cardValidity', 'سبب عدم صلاحية المسافه': 'cardReason', 'نوع المعامله': 'txType',
};
/** Header spelling varies (أ/إ/ا, ة/ه, extra spaces): compare a normalized form. */
const normHead = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
const HEAD = new Map(Object.entries(HEADERS).map(([k, v]) => [normHead(k), v]));
const headOf = (v: unknown) => HEAD.get(normHead(v));
/** The Arabic export says صحيحة / غير صحيحة and عادي; store the English words the rest of the app checks. */
const VALIDITY: Record<string, string> = { 'صحيحة': 'Correct', 'صحيحه': 'Correct', 'غير صحيحة': 'Wrong', 'غير صحيحه': 'Wrong' };
const TX_TYPE: Record<string, string> = { 'عادي': 'Normal', 'عادى': 'Normal' };

const MONTHS: Record<string, number> = {
  'يناير': 1, 'فبراير': 2, 'مارس': 3, 'أبريل': 4, 'ابريل': 4, 'إبريل': 4, 'مايو': 5, 'يونيو': 6, 'يونيه': 6,
  'يوليو': 7, 'يوليه': 7, 'أغسطس': 8, 'اغسطس': 8, 'سبتمبر': 9, 'أكتوبر': 10, 'اكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12,
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const AR_DIGITS = /[٠-٩]/g;
const toLatin = (s: string) => s.replace(AR_DIGITS, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const pad = (n: number) => String(n).padStart(2, '0');

/** Number from a cell; "-", "Processing" and blanks give null. */
export const numOrNull = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = toLatin(String(v ?? '')).replace(/[,\s٬]/g, '').replace('٫', '.');
  if (!s || s === '-' || !/^-?\d*\.?\d+$/.test(s)) return null;
  return Number(s);
};

/** "08 نوفمبر 2026" or a real date / Excel serial → "YYYY-MM-DD". */
export function parseDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(+v)) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = toLatin(String(v ?? '')).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  m = s.match(/^(\d{1,2})\s+([^\s\d]+)\s+(\d{4})/);
  if (m) {
    const mon = MONTHS[m[2]] || MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon) return `${m[3]}-${pad(mon)}-${pad(+m[1])}`;
  }
  return null;
}

/** "3:55 م" / "9:07 ص" / "15:55" / Excel fraction → "HH:mm". */
export function parseTime(v: unknown): string {
  if (typeof v === 'number' && v >= 0 && v < 1) { const mins = Math.round(v * 1440); return `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`; }
  const s = toLatin(String(v ?? '')).trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return '00:00';
  let h = +m[1];
  const pm = /م|pm/i.test(s), am = /ص|am/i.test(s);
  if (pm && h < 12) h += 12;
  if (am && h === 12) h = 0;
  return `${pad(h)}:${m[2]}`;
}

const clean = (v: unknown) => { const s = String(v ?? '').replace(/\s+/g, ' ').trim(); return s === '-' ? '' : s; };

export function rowsToTxs(rows: unknown[][]): FuelTx[] {
  const headerIndex = rows.findIndex(r => {
    const keys = r.map(headOf);
    return keys.includes('liters') && keys.includes('plate');
  });
  if (headerIndex < 0) return [];
  const map = rows[headerIndex].map(headOf);
  const out: FuelTx[] = [];
  for (const r of rows.slice(headerIndex + 1)) {
    const raw: Record<string, unknown> = {};
    map.forEach((k, i) => { if (k && raw[k] === undefined) raw[k] = r[i]; });
    const date = parseDate(raw.date);
    const liters = numOrNull(raw.liters);
    const plate = clean(raw.plate);
    if (!date || liters == null || !plate) continue;
    const at = `${date}T${parseTime(raw.time)}`;
    const amount = numOrNull(raw.amount) ?? 0;
    out.push({
      id: clean(raw.id) || `${plate}|${at}|${amount}`,
      at,
      vehicleId: clean(raw.vehicleId),
      plate,
      vehicleType: clean(raw.vehicleType) || 'Default',
      driverCode: clean(raw.driverCode),
      driver: clean(raw.driver),
      station: clean(raw.station),
      fuelType: clean(raw.fuelType),
      amount,
      liters,
      pumpReading: numOrNull(raw.pumpReading),
      variance: numOrNull(raw.variance) ?? 0,
      totalAmount: numOrNull(raw.totalAmount) ?? amount,
      km: numOrNull(raw.km),
      cardDistance: numOrNull(raw.cardDistance),
      cardKmL: numOrNull(raw.cardKmL),
      cardValidity: VALIDITY[clean(raw.cardValidity)] || clean(raw.cardValidity),
      cardReason: clean(raw.cardReason),
      txType: TX_TYPE[clean(raw.txType)] || clean(raw.txType),
    });
  }
  return out;
}

export async function parseFuelWorkbook(file: File): Promise<FuelTx[]> {
  const XLSX = await import('xlsx-js-style');
  // CSV exports are UTF-8 text (Arabic headers): decode them as text so the Arabic is read right.
  const wb = /\.csv$/i.test(file.name)
    ? XLSX.read(new TextDecoder('utf-8').decode(await file.arrayBuffer()).replace(/^\uFEFF/, ''), { type: 'string', cellDates: true })
    : XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const out: FuelTx[] = [];
  for (const name of wb.SheetNames) {
    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true });
    out.push(...rowsToTxs(rows));
  }
  return out;
}

/** Same pump transaction even if the export gave it another "#": truck, time, liters, amount. */
const sameTx = (t: FuelTx) => `${t.plate}|${t.at}|${t.liters.toFixed(2)}|${t.amount.toFixed(2)}`;

/**
 * Splits an uploaded file into what is new and what the system already has.
 * A row is "in system" if its # or its truck + time + liters + amount is already saved,
 * and "repeated" if it appears twice in the same file. Only `fresh` gets saved.
 */
export function splitUpload(rows: FuelTx[], existing: FuelTx[]): { fresh: FuelTx[]; inSystem: number; repeated: number } {
  const ids = new Set(existing.map(t => t.id));
  const keys = new Set(existing.map(sameTx));
  const seenIds = new Set<string>(), seenKeys = new Set<string>();
  const fresh: FuelTx[] = [];
  let inSystem = 0, repeated = 0;
  for (const t of rows) {
    const k = sameTx(t);
    if (ids.has(t.id) || keys.has(k)) { inSystem++; continue; }
    if (seenIds.has(t.id) || seenKeys.has(k)) { repeated++; continue; }
    seenIds.add(t.id); seenKeys.add(k); fresh.push(t);
  }
  return { fresh, inSystem, repeated };
}
