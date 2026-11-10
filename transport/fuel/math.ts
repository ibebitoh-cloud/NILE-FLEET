/**
 * Fuel (diesel) consumption math for the Transport app.
 *
 * Input: the fuel-card transactions export (one row per pump transaction).
 * Output: "fills" (what really went into the tank) and "segments" (distance
 * driven between two good odometer readings and the liters that covered it),
 * with targets, margins and the difference against what the card report says.
 *
 * Method: full-to-full. A truck is filled to full each time, so the liters
 * put in at a fill replace the fuel burned since the previous fill.
 *
 * Corrections made before measuring, because the raw card numbers are often wrong:
 *  1. Reversals: a negative transaction cancels the matching positive one.
 *  2. Split fills: some pumps stop at 9,999 EGP, so one full tank becomes two
 *     transactions minutes apart. Transactions of the same truck within
 *     `splitHours`, or with almost the same km reading, count as one fill.
 *  3. Bad odometer readings (typos, same km, going backwards, impossible
 *     jumps) are skipped. Their liters are carried into the next good reading
 *     so no fuel is lost from the totals.
 *  4. Partial fills: a fill that was not topped to full shows impossible km/L.
 *     It is joined with the next fill, which completes the tank.
 *
 * Pure functions only, so this file runs in the browser and in node tests.
 */

export interface FuelTx {
  id: string;
  /** Local date-time "YYYY-MM-DDTHH:mm" (Cairo, as printed on the report). */
  at: string;
  vehicleId: string;
  plate: string;
  vehicleType: string;
  driverCode: string;
  driver: string;
  station: string;
  fuelType: string;
  /** Pump value in EGP (negative for a reversal). */
  amount: number;
  liters: number;
  pumpReading: number | null;
  /** Variance column from the card report (amount vs pump reading). */
  variance: number;
  /** What the card charged, fees included. */
  totalAmount: number;
  km: number | null;
  cardDistance: number | null;
  cardKmL: number | null;
  cardValidity: string;
  cardReason: string;
  txType: string;
  /** Free note added by an admin. */
  note?: string;
  /** Set when an admin edited the row by hand: when, and the card's original values of the fields changed. */
  edited?: { at: string; orig: Partial<FuelTx> };
}

export interface FuelSettings {
  /** EGP per liter. 0 = take it from the data (amount / liters). */
  price: number;
  /** Two transactions of the same truck this close together are one fill. */
  splitHours: number;
  /** Two transactions with fewer km than this between them are one fill. */
  minKm: number;
  /** Most km a truck can drive on one full tank. Longer jumps are bad readings. */
  maxKmPerFill: number;
  /** ± % around the target km/L that counts as normal for a truck over the period. */
  marginPct: number;
  /** ± % for a single fill. One fill swings more (the tank is never filled to exactly the same level). */
  fillMarginPct: number;
  /** Target km/L per vehicle type. Missing types use the fleet average for that type. */
  typeTargets: Record<string, number>;
  /** Target km/L per truck (plate). Wins over the type target. */
  truckTargets: Record<string, number>;
  /** Tank size in liters; a bigger fill raises an alert. 0 = off. */
  tankLiters: number;
  /** Alert when a truck has no fill for this many days. 0 = off. */
  idleDays: number;
  /** Alert ids an admin marked as checked. */
  checkedAlerts: string[];
}

export const DEFAULT_SETTINGS: FuelSettings = {
  price: 0,
  splitHours: 6,
  minKm: 50,
  maxKmPerFill: 2000,
  marginPct: 10,
  fillMarginPct: 25,
  typeTargets: {},
  truckTargets: {},
  tankLiters: 0,
  idleDays: 5,
  checkedAlerts: [],
};

export type TxFlag = 'reversed' | 'reversal' | 'split' | 'badKm' | 'fixedKm' | 'opening';

export interface Fill {
  key: string;
  plate: string;
  vehicleType: string;
  driver: string;
  station: string;
  at: string;
  txs: FuelTx[];
  liters: number;
  amount: number;
  totalAmount: number;
  /** Good odometer reading for this fill, or null when every reading was bad. */
  km: number | null;
  /** The odometer readings that were rejected, with the reason. */
  badKm: { km: number | null; reason: string }[];
  /** Readings typed with one extra digit (7552921 for 755292), corrected automatically. */
  fixedKm: { from: number; to: number }[];
}

export type SegmentStatus = 'ok' | 'high' | 'low' | 'pending';

export interface Segment {
  key: string;
  plate: string;
  vehicleType: string;
  driver: string;
  /** Last fill of the segment (the one with the closing odometer reading). */
  at: string;
  /** Previous good reading (start of the segment). */
  fromAt: string;
  fromKm: number;
  toKm: number;
  distance: number;
  liters: number;
  cost: number;
  fills: Fill[];
  kmL: number;
  l100: number;
  target: number;
  expectedL: number;
  /** Liters allowed inside the margin. */
  allowedL: number;
  /** liters − expected (positive = used more than target). */
  diffL: number;
  diffEgp: number;
  /** Liters used beyond the margin (never negative). */
  overMarginL: number;
  lossEgp: number;
  /** Difference between our km/L and the target, in %. Negative = worse. */
  vsTargetPct: number;
  status: SegmentStatus;
  notes: SegmentNote[];
  /** What the card report says for the same fills. */
  card: { distance: number; kmL: number | null; validity: string; reason: string };
  /** 'paired' only: km/L of the too-good fill and of the over fill before they were counted together. */
  pair?: [number, number];
}

export type SegmentNote = 'split' | 'partial' | 'paired' | 'badKm' | 'fixedKm' | 'reversal';

export interface TxView {
  tx: FuelTx;
  flags: TxFlag[];
  fillKey: string | null;
  segmentKey: string | null;
  /** Our km for this transaction's fill (when the reading was good). */
  actualDistance: number | null;
  actualKmL: number | null;
}

export interface Summary {
  key: string;
  label: string;
  vehicleType: string;
  plates: string[];
  drivers: string[];
  txCount: number;
  fillCount: number;
  liters: number;
  cost: number;
  card: number;
  trackedKm: number;
  trackedL: number;
  kmL: number;
  l100: number;
  target: number;
  vsTargetPct: number;
  diffL: number;
  diffEgp: number;
  overMarginL: number;
  lossEgp: number;
  /** What the card report itself says: its distance and km/L over the rows it marks valid. */
  cardKm: number;
  cardKmL: number;
  splits: number;
  partials: number;
  badKm: number;
  status: SegmentStatus;
  outside: number;
}

export interface FuelResult {
  price: number;
  targets: Record<string, number>;
  fleetKmL: number;
  fills: Fill[];
  segments: Segment[];
  txViews: TxView[];
}

/* ------------------------------------------------------------------ */

const hoursBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 3_600_000;
const round = (n: number, d = 2) => { const f = 10 ** d; return Math.round(n * f) / f; };
const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + (f(x) || 0), 0);

/** Price per liter from the data (median of amount/liters), used when settings.price is 0. */
export function dataPrice(txs: FuelTx[]): number {
  const v = txs.filter(t => t.amount > 0 && t.liters > 0).map(t => t.amount / t.liters).sort((a, b) => a - b);
  return v.length ? round(v[Math.floor(v.length / 2)], 2) : 0;
}

/** Marks reversals: a negative transaction and the positive one it cancels. */
function findReversals(txs: FuelTx[]): Set<string> {
  const out = new Set<string>();
  const byPlate = groupBy(txs, t => t.plate);
  for (const list of byPlate.values()) {
    for (const neg of list.filter(t => t.amount < 0 || t.liters < 0)) {
      out.add(neg.id);
      const match = list
        .filter(p => p.amount > 0 && !out.has(p.id) && Math.abs(p.amount + neg.amount) < 0.5
          && Math.abs(hoursBetween(p.at, neg.at)) <= 72)
        .sort((a, b) => Math.abs(hoursBetween(a.at, neg.at)) - Math.abs(hoursBetween(b.at, neg.at)))[0];
      if (match) out.add(match.id);
    }
  }
  return out;
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) { const k = key(x); const l = m.get(k); if (l) l.push(x); else m.set(k, [x]); }
  return m;
}

/** Target km/L for a truck: truck override, then type setting, then type average. */
function targetFor(plate: string, type: string, s: FuelSettings, typeAvg: Record<string, number>, fleet: number) {
  return s.truckTargets[plate] || s.typeTargets[type] || typeAvg[type] || fleet || 2.3;
}

export function computeFuel(allTxs: FuelTx[], settings: FuelSettings = DEFAULT_SETTINGS): FuelResult {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const txs = [...allTxs].sort((a, b) => a.plate.localeCompare(b.plate) || a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const price = s.price > 0 ? s.price : dataPrice(txs);
  const reversed = findReversals(txs);
  const flags = new Map<string, TxFlag[]>(txs.map(t => [t.id, []]));
  for (const t of txs) if (reversed.has(t.id)) flags.get(t.id)!.push(t.amount < 0 || t.liters < 0 ? 'reversal' : 'reversed');

  /* ---- 1. fills (split transactions joined) ---- */
  const fills: Fill[] = [];
  for (const [plate, list] of groupBy(txs.filter(t => !reversed.has(t.id)), t => t.plate)) {
    let cur: FuelTx[] = [];
    const flush = () => {
      if (!cur.length) return;
      const last = cur[cur.length - 1];
      fills.push({
        key: `${plate}|${cur[0].id}`, plate, vehicleType: last.vehicleType, driver: last.driver, station: last.station,
        at: last.at, txs: cur, liters: round(sum(cur, t => t.liters)), amount: round(sum(cur, t => t.amount)),
        totalAmount: round(sum(cur, t => t.totalAmount)), km: null, badKm: [], fixedKm: [],
      });
      if (cur.length > 1) cur.forEach(t => flags.get(t.id)!.push('split'));
      cur = [];
    };
    for (const t of list) {
      const prev = cur[cur.length - 1];
      const close = prev && (
        hoursBetween(prev.at, t.at) <= s.splitHours ||
        (prev.km != null && t.km != null && t.km >= prev.km && t.km - prev.km < s.minKm && hoursBetween(prev.at, t.at) <= 48)
      );
      if (prev && !close) flush();
      cur.push(t);
    }
    flush();
  }

  /* ---- 2. odometer check + segments per truck ---- */
  type Raw = Omit<Segment, 'target' | 'expectedL' | 'allowedL' | 'diffL' | 'diffEgp' | 'overMarginL' | 'lossEgp' | 'vsTargetPct' | 'status' | 'kmL' | 'l100' | 'cost'> & { pending?: boolean };
  const rawByPlate = new Map<string, Raw[]>();
  const openingFill = new Set<string>();
  for (const [plate, list] of groupBy(fills, f => f.plate)) {
    let anchor: Fill | null = null;
    let pending: Fill[] = [];
    const raws: Raw[] = [];
    for (const f of list) {
      const readings = f.txs.map(t => t.km).filter((k): k is number => k != null && k > 0);
      if (!anchor) {
        // Start tracking at the first fill with any reading; this fill's liters can't be measured.
        if (readings.length) { f.km = Math.max(...readings); anchor = f; openingFill.add(f.key); }
        else f.badKm.push({ km: null, reason: 'noKm' });
        continue;
      }
      const hops = pending.length + 1;
      const limit = s.maxKmPerFill * hops;
      const fits = (k: number) => k > anchor!.km! && k - anchor!.km! <= limit;
      let good = readings.filter(fits);
      if (!good.length) {
        // Common typo: one extra digit at the end (7552921 typed for 755292).
        for (const k of readings) {
          const fixed = Math.floor(k / 10);
          if (k > anchor.km! * 5 && fits(fixed)) { f.fixedKm.push({ from: k, to: fixed }); good = [fixed]; break; }
        }
      }
      if (good.length) {
        f.km = Math.max(...good);
        for (const k of readings) if (!good.includes(k) && !f.fixedKm.some(x => x.from === k)) f.badKm.push({ km: k, reason: k <= anchor.km! ? (k === anchor.km ? 'sameKm' : 'backwards') : 'tooFar' });
        const group = [...pending, f];
        raws.push(makeRaw(plate, anchor, f, group));
        anchor = f; pending = [];
      } else {
        if (!readings.length) f.badKm.push({ km: null, reason: 'noKm' });
        for (const k of readings) f.badKm.push({ km: k, reason: k <= anchor.km! ? (k === anchor.km ? 'sameKm' : 'backwards') : 'tooFar' });
        pending.push(f);
      }
    }
    // Liters after the last good reading wait for the next upload.
    if (pending.length && anchor) raws.push({ ...makeRaw(plate, anchor, pending[pending.length - 1], pending), distance: 0, toKm: anchor.km!, pending: true });
    rawByPlate.set(plate, raws);
  }
  fills.forEach(f => {
    if (openingFill.has(f.key)) f.txs.forEach(t => flags.get(t.id)!.push('opening'));
    if (f.badKm.length) f.txs.forEach(t => flags.get(t.id)!.push('badKm'));
    for (const x of f.fixedKm) f.txs.filter(t => t.km === x.from).forEach(t => flags.get(t.id)!.push('fixedKm'));
  });

  /* ---- 3. targets from clean segments (fleet / type averages) ---- */
  const clean = [...rawByPlate.values()].flat().filter(r => !r.pending && r.distance > 0 && r.liters > 0);
  const kmlOf = (rs: Raw[]) => { const L = sum(rs, r => r.liters); return L ? sum(rs, r => r.distance) / L : 0; };
  // Average without the impossible ones (partial fills) so they don't pull the target.
  const roughFleet = kmlOf(clean);
  const sane = clean.filter(r => { const k = r.distance / r.liters; return k > roughFleet * 0.5 && k < roughFleet * 1.5; });
  const fleetKmL = round(kmlOf(sane), 2);
  const typeAvg: Record<string, number> = {};
  for (const [type, rs] of groupBy(sane, r => r.vehicleType)) typeAvg[type] = round(kmlOf(rs), 2);

  /* ---- 4. join partial fills, then score ---- */
  const segments: Segment[] = [];
  for (const [plate, raws] of rawByPlate) {
    const type = raws[raws.length - 1]?.vehicleType || '';
    const target = targetFor(plate, type, s, typeAvg, fleetKmL);
    const joined: Raw[] = [];
    let carry: Raw | null = null;
    for (const r of raws) {
      const cur: Raw = carry ? mergeRaw(carry, r) : r;
      carry = null;
      if (r.distance <= 0) { joined.push({ ...cur, pending: true }); continue; }
      const k = cur.liters > 0 ? cur.distance / cur.liters : 0;
      // Impossibly good km/L means the tank wasn't filled to full: join it with the next fill.
      if (k > target * 1.5) {
        carry = cur.notes.includes('partial') ? cur : { ...cur, notes: [...cur.notes, 'partial'] };
        continue;
      }
      joined.push(cur);
    }
    // A partial fill at the end waits for the next upload.
    if (carry) joined.push({ ...carry, pending: true });
    // A "too good" fill straight after by an "over" fill, normal when counted together: the first tank
    // was not filled to full and the next fill topped up the rest. Count them as one fill.
    const m = s.fillMarginPct / 100;
    const kmlOfRaw = (r: Raw) => (r.liters > 0 && r.distance > 0 ? r.distance / r.liters : 0);
    // Up to one normal fill may sit between them (a second small top-up before the big one).
    const paired: Raw[] = [];
    const usable = (r?: Raw) => !!r && !r.pending && r.distance > 0 && r.liters > 0;
    for (let i = 0; i < joined.length; i++) {
      const a = joined[i];
      let done = false;
      if (usable(a) && kmlOfRaw(a) > target * (1 + m)) {
        for (let j = i + 1; j <= i + 2 && j < joined.length && usable(joined[j]); j++) {
          const b = joined[j], kb = kmlOfRaw(b);
          if (kb > target * (1 + m)) break;                 // another too-good fill: not this pattern
          if (kb >= target * (1 - m)) continue;            // normal fill in between
          const run = joined.slice(i, j + 1);
          const kc = sum(run, r => r.distance) / sum(run, r => r.liters);
          if (kc >= target * (1 - m) && kc <= target * (1 + m)) {
            const mr = run.slice(1).reduce((acc, r) => mergeRaw(acc, r), run[0]);
            paired.push({ ...mr, notes: [...new Set([...mr.notes, 'paired' as SegmentNote])], pair: [round(kmlOfRaw(a), 2), round(kb, 2)] });
            i = j; done = true;
          }
          break;
        }
      }
      if (!done) paired.push(a);
    }
    for (const r of paired) segments.push(score(r, target, s.fillMarginPct, price, !!r.pending));
  }
  segments.sort((a, b) => b.at.localeCompare(a.at));

  /* ---- 5. per-transaction view ---- */
  const fillOfTx = new Map<string, Fill>();
  fills.forEach(f => f.txs.forEach(t => fillOfTx.set(t.id, f)));
  const segOfFill = new Map<string, Segment>();
  segments.forEach(sg => sg.fills.forEach(f => segOfFill.set(f.key, sg)));
  const txViews: TxView[] = txs.map(t => {
    const f = fillOfTx.get(t.id);
    const sg = f ? segOfFill.get(f.key) : undefined;
    const closing = sg && f && sg.fills[sg.fills.length - 1].key === f.key && sg.status !== 'pending';
    return {
      tx: t, flags: [...new Set(flags.get(t.id) || [])], fillKey: f?.key || null, segmentKey: sg?.key || null,
      actualDistance: closing ? sg!.distance : null, actualKmL: closing ? sg!.kmL : null,
    };
  }).sort((a, b) => b.tx.at.localeCompare(a.tx.at) || b.tx.id.localeCompare(a.tx.id));

  const targets: Record<string, number> = {};
  for (const [plate, raws] of rawByPlate) targets[plate] = targetFor(plate, raws[raws.length - 1]?.vehicleType || '', s, typeAvg, fleetKmL);
  for (const f of fills) if (!(f.plate in targets)) targets[f.plate] = targetFor(f.plate, f.vehicleType, s, typeAvg, fleetKmL);
  return { price, targets, fleetKmL, fills, segments, txViews };
}

function makeRaw(plate: string, from: Fill, to: Fill, group: Fill[]) {
  const notes: SegmentNote[] = [];
  if (group.some(f => f.txs.length > 1)) notes.push('split');
  if (group.some(f => f.badKm.length)) notes.push('badKm');
  if (group.some(f => f.fixedKm.length)) notes.push('fixedKm');
  const closing = to.txs[to.txs.length - 1];
  return {
    key: `${plate}|${to.key}`, plate, vehicleType: to.vehicleType, driver: to.driver, at: to.at, fromAt: from.at,
    fromKm: from.km!, toKm: to.km ?? from.km!, distance: round((to.km ?? from.km!) - from.km!, 1),
    liters: round(sum(group, f => f.liters)), fills: group, notes,
    card: {
      distance: round(sum(group.flatMap(f => f.txs), t => t.cardDistance || 0), 1),
      kmL: closing.cardKmL, validity: closing.cardValidity, reason: closing.cardReason,
    },
  };
}

function mergeRaw<T extends { distance: number; liters: number; fills: Fill[]; notes: SegmentNote[]; card: Segment['card'] }>(a: T, b: T): T {
  return {
    ...b, fromAt: (a as any).fromAt, fromKm: (a as any).fromKm,
    distance: round(a.distance + b.distance, 1), liters: round(a.liters + b.liters),
    fills: [...a.fills, ...b.fills], notes: [...new Set([...a.notes, ...b.notes])],
    card: { ...b.card, distance: round(a.card.distance + b.card.distance, 1) },
  };
}

function score(r: any, target: number, marginPct: number, price: number, pending: boolean): Segment {
  const m = marginPct / 100;
  const kmL = r.liters > 0 && r.distance > 0 ? round(r.distance / r.liters, 2) : 0;
  const expectedL = r.distance > 0 ? r.distance / target : 0;
  const allowedL = r.distance > 0 ? r.distance / (target * (1 - m)) : 0;
  const diffL = pending ? 0 : r.liters - expectedL;
  const overMarginL = pending ? 0 : Math.max(0, r.liters - allowedL);
  let status: SegmentStatus = 'ok';
  if (pending) status = 'pending';
  else if (r.liters > 0 && r.distance > 0) {
    // Compare the unrounded km/L with a tiny tolerance, so 1.65 vs 2.2 × 0.75 is not called over use.
    const raw = r.distance / r.liters;
    if (raw < target * (1 - m) - 1e-9) status = 'high';
    else if (raw > target * (1 + m) + 1e-9) status = 'low';
  }
  const { pending: _pending, ...rest } = r;
  return {
    ...rest,
    kmL, l100: kmL ? round(100 / kmL, 1) : 0, cost: round(sum(r.fills as Fill[], f => f.amount)),
    target, expectedL: round(expectedL), allowedL: round(allowedL), diffL: round(diffL), diffEgp: round(diffL * price),
    overMarginL: round(overMarginL), lossEgp: round(overMarginL * price),
    vsTargetPct: kmL && !pending ? round((kmL / target - 1) * 100, 1) : 0,
    status,
  };
}

/** Totals for a group of segments + the fills/transactions behind them. */
export function summarize(
  key: string, label: string, segs: Segment[], txs: FuelTx[], fills: Fill[], target: number, marginPct: number, price: number,
): Summary {
  const done = segs.filter(x => x.status !== 'pending');
  const trackedKm = round(sum(done, x => x.distance), 1);
  const trackedL = round(sum(done, x => x.liters));
  const kmL = trackedL ? round(trackedKm / trackedL, 2) : 0;
  const m = marginPct / 100;
  const expectedL = trackedKm / target;
  const allowedL = trackedKm / (target * (1 - m));
  const live = txs.filter(t => t.amount > 0);
  const net = txs;
  let status: SegmentStatus = done.length ? 'ok' : 'pending';
  if (kmL && kmL < target * (1 - m)) status = 'high';
  else if (kmL && kmL > target * (1 + m)) status = 'low';
  return {
    key, label,
    vehicleType: [...new Set(segs.map(x => x.vehicleType).concat(txs.map(t => t.vehicleType)))].filter(Boolean).join(', '),
    plates: [...new Set(txs.map(t => t.plate))],
    drivers: [...new Set(txs.map(t => t.driver).filter(Boolean))],
    txCount: live.length,
    fillCount: fills.length,
    liters: round(sum(net, t => t.liters)),
    // What was actually paid at the pump (stays right if the diesel price changes mid-period).
    cost: round(sum(net, t => t.amount)),
    card: round(sum(net, t => t.totalAmount)),
    trackedKm, trackedL, kmL, l100: kmL ? round(100 / kmL, 1) : 0, target,
    vsTargetPct: kmL ? round((kmL / target - 1) * 100, 1) : 0,
    diffL: round(trackedL - expectedL), diffEgp: round((trackedL - expectedL) * price),
    overMarginL: round(Math.max(0, trackedL - allowedL)), lossEgp: round(Math.max(0, trackedL - allowedL) * price),
    ...cardTotals(txs),
    splits: fills.filter(f => f.txs.length > 1).length,
    partials: done.filter(x => x.notes.includes('partial') || x.notes.includes('paired')).length,
    badKm: fills.filter(f => f.badKm.some(b => b.km != null)).length,
    status,
    outside: done.filter(x => x.status === 'high' || x.status === 'low').length,
  };
}

/** The card report's own numbers: distance and km/L over the rows it does not mark "Wrong". */
export function cardTotals(txs: FuelTx[]): { cardKm: number; cardKmL: number } {
  const ok = txs.filter(t => t.amount > 0 && !/wrong/i.test(t.cardValidity) && (t.cardDistance || 0) > 0);
  const km = sum(ok, t => t.cardDistance || 0), L = sum(ok, t => t.liters);
  return { cardKm: round(km, 1), cardKmL: L ? round(km / L, 2) : 0 };
}
