import type { FuelResult, FuelSettings, FuelTx, Segment } from './math';

/**
 * Alerts: things in the fuel data a person should look at.
 * Pure function of the computed result, so it is easy to test and the same in the screen, print and Excel.
 */

export type AlertKind =
  | 'overUse'      // one fill used more than the margin allows
  | 'weekDrop'     // a truck's km/L this week is below target by more than the truck margin
  | 'tooFewLiters' // km driven needs more fuel than the card shows (fuel bought outside the card, or wrong km)
  | 'overTank'     // a fill is bigger than the tank
  | 'badKm'        // odometer reading skipped (typo, same km, backwards)
  | 'noKm'         // no odometer reading on a fill
  | 'pumpVar'      // amount charged differs from the pump reading
  | 'idle'         // no fill for many days
  | 'reversal'     // a transaction was reversed
  | 'splitJoined'  // two or more transactions joined into one fill (pump stopped at 9,999 EGP)
  | 'partialJoined'// a fill that wasn't to full joined with the next one for km/L
  | 'kmFixed';     // a km reading typed with an extra digit was corrected

export type AlertLevel = 'high' | 'medium' | 'low';

export interface FuelAlert {
  id: string;
  kind: AlertKind;
  level: AlertLevel;
  plate: string;
  driver: string;
  at: string;
  /** Liters involved (over margin, missing, over tank…). */
  liters: number;
  /** Money involved, EGP. */
  egp: number;
  /** Extra numbers for the message. */
  info: Record<string, number | string>;
  segmentKey?: string;
}

export const LEVEL_ORDER: Record<AlertLevel, number> = { high: 0, medium: 1, low: 2 };
export const ALERT_LEVEL: Record<AlertKind, AlertLevel> = {
  overUse: 'high', weekDrop: 'high', overTank: 'high', tooFewLiters: 'medium', pumpVar: 'medium',
  badKm: 'medium', idle: 'medium', noKm: 'low', reversal: 'low',
  partialJoined: 'medium', kmFixed: 'medium', splitJoined: 'low',
};

/** Alerts below this many liters are noise. */
const MIN_LITERS = 10;
/** An open (not yet closed) run is only worth an alert once it is this long. */
const OPEN_KM = 1000;
const round = (n: number, d = 2) => { const f = 10 ** d; return Math.round(n * f) / f; };

/** Week key = the Saturday the work week starts on ("YYYY-MM-DD"). */
export const weekOf = (at: string) => {
  const d = new Date(`${at.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 1) % 7));
  return d.toISOString().slice(0, 10);
};
export const weekEnd = (start: string) => { const d = new Date(`${start}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => (Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / 86_400_000;

export function fuelAlerts(result: FuelResult, txs: FuelTx[], settings: FuelSettings): FuelAlert[] {
  const out: FuelAlert[] = [];
  const price = result.price;
  const m = settings.marginPct / 100;
  const add = (a: Omit<FuelAlert, 'level'>) => out.push({ ...a, level: ALERT_LEVEL[a.kind] });

  /* per fill segment */
  // A fill that wasn't topped up to full looks "too good" and the next one "too bad" (or the other way round).
  // When the two together are within the fill margin, it's just how the tank was filled: no alert for either.
  const fm = settings.fillMarginPct / 100;
  const paired = new Set<string>();
  const byPlate = new Map<string, Segment[]>();
  for (const s of result.segments) (byPlate.get(s.plate) || byPlate.set(s.plate, []).get(s.plate)!).push(s);
  for (const list of byPlate.values()) {
    const done = list.filter(s => s.status !== 'pending').sort((a, b) => a.at.localeCompare(b.at));
    for (let i = 0; i + 1 < done.length; i++) {
      const a = done[i], b = done[i + 1];
      if (paired.has(a.key) || (a.status !== 'low' && b.status !== 'low') || a.status === b.status) continue;
      const k = (a.distance + b.distance) / (a.liters + b.liters);
      if (k >= a.target * (1 - fm) && k <= a.target * (1 + fm)) { paired.add(a.key); paired.add(b.key); }
    }
  }
  for (const s of result.segments) {
    if (paired.has(s.key)) continue;
    if (s.status === 'high' && s.overMarginL >= MIN_LITERS) {
      add({ id: `overUse|${s.key}`, kind: 'overUse', plate: s.plate, driver: s.driver, at: s.at, liters: s.overMarginL, egp: s.lossEgp,
        segmentKey: s.key, info: { km: s.distance, kmL: s.kmL, target: s.target, fromAt: s.fromAt.slice(0, 10) } });
    }
    // Too few liters for the km: either a closed fill that is still too good, or the open one at the end
    // (already joined with partial fills) that has gone far past what the tank can hold.
    const open = s.status === 'pending' && s.notes.includes('partial') && s.distance >= OPEN_KM;
    if ((s.status === 'low' && !s.notes.includes('partial')) || open) {
      const missing = round(s.distance / s.target - s.liters, 0);
      if (missing >= MIN_LITERS) add({ id: `tooFewLiters|${s.key}`, kind: 'tooFewLiters', plate: s.plate, driver: s.driver, at: s.at, liters: missing,
        egp: round(missing * price, 0), segmentKey: s.key,
        info: { km: s.distance, liters: s.liters, kmL: round(s.distance / s.liters), target: s.target, fromAt: s.fromAt.slice(0, 10), open: open ? 1 : 0 } });
    }
  }

  /* every merge or correction the math makes, so nothing changes the km/L silently */
  const ids = (txs: FuelTx[]) => txs.map(t => t.id).join(', ');
  for (const f of result.fills) {
    if (f.txs.length > 1) add({ id: `splitJoined|${f.key}`, kind: 'splitJoined', plate: f.plate, driver: f.driver, at: f.at, liters: f.liters, egp: 0,
      info: { ids: ids(f.txs), count: f.txs.length } });
    for (const x of f.fixedKm) add({ id: `kmFixed|${f.key}|${x.from}`, kind: 'kmFixed', plate: f.plate, driver: f.driver, at: f.at, liters: f.liters, egp: 0,
      info: { from: x.from, to: x.to, ids: ids(f.txs.filter(t => t.km === x.from)) } });
  }
  for (const s of result.segments) {
    if (!s.notes.includes('partial')) continue;
    add({ id: `partialJoined|${s.key}`, kind: 'partialJoined', plate: s.plate, driver: s.driver, at: s.at, liters: s.liters, egp: 0, segmentKey: s.key,
      info: { ids: ids(s.fills.flatMap(f => f.txs)), fills: s.fills.length, fromAt: s.fromAt.slice(0, 10), km: s.distance, kmL: s.kmL, open: s.status === 'pending' ? 1 : 0 } });
  }

  /* per fill */
  for (const f of result.fills) {
    if (settings.tankLiters > 0 && f.liters > settings.tankLiters * 1.03) {
      const extra = round(f.liters - settings.tankLiters, 0);
      add({ id: `overTank|${f.key}`, kind: 'overTank', plate: f.plate, driver: f.driver, at: f.at, liters: extra, egp: round(extra * price, 0),
        info: { liters: f.liters, tank: settings.tankLiters } });
    }
    const bad = f.badKm.filter(b => b.km != null);
    if (bad.length) add({ id: `badKm|${f.key}`, kind: 'badKm', plate: f.plate, driver: f.driver, at: f.at, liters: f.liters, egp: 0,
      info: { km: bad[0].km!, reason: bad[0].reason } });
    else if (f.badKm.some(b => b.km == null)) add({ id: `noKm|${f.key}`, kind: 'noKm', plate: f.plate, driver: f.driver, at: f.at, liters: f.liters, egp: 0, info: {} });
  }

  /* per transaction */
  for (const v of result.txViews) {
    const t = v.tx;
    if (v.flags.includes('reversal')) add({ id: `reversal|${t.id}`, kind: 'reversal', plate: t.plate, driver: t.driver, at: t.at,
      liters: Math.abs(t.liters), egp: Math.abs(t.amount), info: { id: t.id } });
    if (Math.abs(t.variance) > 1 && t.amount > 0) add({ id: `pumpVar|${t.id}`, kind: 'pumpVar', plate: t.plate, driver: t.driver, at: t.at,
      liters: t.liters, egp: round(Math.abs(t.variance)), info: { id: t.id, variance: t.variance, pump: t.pumpReading ?? 0 } });
  }

  /* per truck: this week vs target, and idle trucks */
  const last = txs.reduce((mx, x) => (x.at > mx ? x.at : mx), '');
  if (last) {
    const week = weekOf(last);
    const thisWeek = new Map<string, Segment[]>();
    for (const s of result.segments) if (s.status !== 'pending' && weekOf(s.at) === week) (thisWeek.get(s.plate) || thisWeek.set(s.plate, []).get(s.plate)!).push(s);
    for (const [plate, segs] of thisWeek) {
      const km = segs.reduce((a, s) => a + s.distance, 0), L = segs.reduce((a, s) => a + s.liters, 0);
      const target = result.targets[plate] || result.fleetKmL;
      if (!L || km < 300) continue; // too little driving this week to judge
      const kmL = km / L;
      if (kmL < target * (1 - m)) {
        const allowed = km / (target * (1 - m));
        add({ id: `weekDrop|${plate}|${week}`, kind: 'weekDrop', plate, driver: segs[0].driver, at: segs[0].at, liters: round(L - allowed, 0),
          egp: round((L - allowed) * price, 0), info: { week, kmL: round(kmL), target, km: round(km, 0) } });
      }
    }
    const lastByPlate = new Map<string, FuelTx>();
    for (const t of txs) if (t.amount > 0 && (!lastByPlate.has(t.plate) || t.at > lastByPlate.get(t.plate)!.at)) lastByPlate.set(t.plate, t);
    for (const [plate, t] of lastByPlate) {
      const days = daysBetween(t.at, last);
      if (settings.idleDays > 0 && days >= settings.idleDays) add({ id: `idle|${plate}|${t.id}`, kind: 'idle', plate, driver: t.driver, at: t.at,
        liters: 0, egp: 0, info: { days: Math.round(days), lastData: last.slice(0, 10) } });
    }
  }

  return out.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || b.at.localeCompare(a.at));
}
