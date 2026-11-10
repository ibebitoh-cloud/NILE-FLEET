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
  | 'kmFixed'      // a km reading typed with an extra digit was corrected
  | 'maintenance'  // recent km/L well below target and getting worse: check the truck
  | 'dropping';    // recent km/L slipping below target or below the truck's own normal

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
  /** Older ids of the same alert: a check made under any of them still counts. */
  alsoIds?: string[];
}

/**
 * Ids are made so that a new upload does not bring back an alert someone already checked:
 * a stretch is named by where it starts (that never moves), and a truck-health alert by the
 * truck, not by the sliding last-1,500-km window.
 */
export const alertIds = (a: FuelAlert) => [a.id, ...(a.alsoIds || [])];
const isHealth = (a: FuelAlert) => a.kind === 'maintenance' || a.kind === 'dropping';
/** How much worse (km/L) a checked truck must get before its health alert shows again. */
export const RECHECK_KML = 0.05;

/**
 * What to store when someone marks an alert checked. A health check also keeps the km/L it was
 * checked at ("dropping|PLATE@2.04"), so the alert comes back only if the truck gets worse than that.
 */
export const checkIds = (a: FuelAlert) => (isHealth(a) ? [`${a.id}@${a.info.recentKmL}`] : [a.id]);

export function isChecked(a: FuelAlert, checked: Set<string>): boolean {
  if (alertIds(a).some(id => checked.has(id))) return true;
  if (!isHealth(a)) return false;
  const now = Number(a.info.recentKmL) || 0;
  for (const id of checked) {
    if (id.startsWith(`${a.id}@`)) { if (now >= Number(id.slice(a.id.length + 1)) - RECHECK_KML) return true; }
    // Health checks made before ids were stable carried the window start: "maintenance|PLATE|date".
    else if (id.startsWith(`${a.id}|`)) return true;
  }
  return false;
}

/** Every stored id that belongs to this alert (for undo). */
export const storedIds = (a: FuelAlert, checked: Iterable<string>) =>
  [...checked].filter(id => alertIds(a).includes(id) || (isHealth(a) && (id.startsWith(`${a.id}@`) || id.startsWith(`${a.id}|`))));

/**
 * Health checks to forget: the truck is back at or above its target, so the next time it slips it
 * is a new problem and must show again. A truck that only wobbles around the line keeps its check.
 * Everything else stays checked for good.
 */
export function staleChecked(health: TruckHealth[], checked: string[]): string[] {
  const recovered = new Set(health.filter(h => h.status === 'good' && h.recentKmL >= h.target).map(h => h.plate));
  return checked.filter(id => { const m = /^(?:maintenance|dropping)\|([^@|]+)/.exec(id); return !!m && recovered.has(m[1]); });
}

export const LEVEL_ORDER: Record<AlertLevel, number> = { high: 0, medium: 1, low: 2 };
export const ALERT_LEVEL: Record<AlertKind, AlertLevel> = {
  overUse: 'high', weekDrop: 'high', overTank: 'high', tooFewLiters: 'medium', pumpVar: 'medium',
  badKm: 'medium', idle: 'medium', noKm: 'low', reversal: 'low',
  maintenance: 'high', dropping: 'medium',
  partialJoined: 'medium', kmFixed: 'medium', splitJoined: 'low',
};

/** Alerts below this many liters are noise. */
const MIN_LITERS = 10;
/** An open (not yet closed) run is only worth an alert once it is this long. */
const OPEN_KM = 1000;
const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + (f(x) || 0), 0);
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
      // A transaction reversed inside this stretch is the usual explanation: the fuel went into the
      // truck but the card charge was cancelled (paid another way). Say so instead of leaving it a mystery.
      const rev = txs.filter(t => t.plate === s.plate && t.amount < 0 && t.at > s.fromAt && t.at <= s.at);
      const revL = round(sum(rev, t => Math.abs(t.liters)), 0);
      if (missing >= MIN_LITERS) add({ id: `tooFewLiters|${s.plate}|from|${s.fromAt}`, alsoIds: [`tooFewLiters|${s.key}`], kind: 'tooFewLiters', plate: s.plate, driver: s.driver, at: s.at, liters: missing,
        egp: round(missing * price, 0), segmentKey: s.key,
        info: { km: s.distance, liters: s.liters, kmL: round(s.distance / s.liters), target: s.target, fromAt: s.fromAt.slice(0, 10), open: open ? 1 : 0,
          revL, revAt: rev[0]?.at.slice(0, 10) || '', revIds: rev.map(t => t.id).join(', ') } });
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
    if (!s.notes.includes('partial') && !s.notes.includes('paired')) continue;
    // One open fill waiting for the next is not a join yet ("1 fills joined" read wrong); tooFewLiters covers it.
    if (s.fills.length < 2) continue;
    add({ id: `partialJoined|${s.plate}|from|${s.fromAt}`, alsoIds: [`partialJoined|${s.key}`], kind: 'partialJoined', plate: s.plate, driver: s.driver, at: s.at, liters: s.liters, egp: 0, segmentKey: s.key,
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
    // Validate the raw pump reading against the amount independently of the
    // imported variance column. Some source rows incorrectly contain variance=0.
    const rawPumpMismatch = t.pumpReading != null && t.pumpReading > 0 && t.amount > 0
      && Math.abs(t.pumpReading - t.amount) > Math.max(5, t.amount * 0.02);
    if ((Math.abs(t.variance) > 1 || rawPumpMismatch) && t.amount > 0) {
      // A wildly different pump reading is a source-data issue, not proof of missing money.
      const misread = rawPumpMismatch || (t.pumpReading != null && Math.abs(t.variance) > t.amount * 0.5) ? 1 : 0;
      add({ id: `pumpVar|${t.id}`, kind: 'pumpVar', plate: t.plate, driver: t.driver, at: t.at,
        liters: t.liters, egp: misread ? 0 : round(Math.abs(t.variance)), info: { id: t.id, variance: t.variance, pump: t.pumpReading ?? 0, paid: t.amount, misread, rawMismatch: rawPumpMismatch ? 1 : 0 } });
    }
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

  for (const h of truckHealth(result, settings)) {
    if (h.status !== 'service' && h.status !== 'watch') continue;
    add({ id: `${h.status === 'service' ? 'maintenance' : 'dropping'}|${h.plate}`, alsoIds: [`${h.status === 'service' ? 'maintenance' : 'dropping'}|${h.plate}|${h.recentFrom}`], kind: h.status === 'service' ? 'maintenance' : 'dropping',
      plate: h.plate, driver: h.driver, at: last || h.recentFrom, liters: 0, egp: 0,
      info: { recentKmL: h.recentKmL, baseKmL: h.baseKmL, trendPct: h.trendPct, target: h.target, vsTargetPct: h.vsTargetPct, recentKm: h.recentKm, recentFrom: h.recentFrom } });
  }

  return out.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || b.at.localeCompare(a.at));
}

/* ------------------------------ truck health ------------------------------ */

export type HealthStatus = 'good' | 'watch' | 'service' | 'noData';

export interface TruckHealth {
  plate: string;
  vehicleType: string;
  driver: string;
  target: number;
  /** km/L over the latest stretch of driving (at least HEALTH_KM). */
  recentKmL: number;
  recentKm: number;
  recentFrom: string;
  /** km/L over everything before that: the truck's own normal. */
  baseKmL: number;
  baseKm: number;
  /** Recent vs the truck's own normal, %. Negative = burning more than it used to. */
  trendPct: number;
  /** Recent vs target, %. */
  vsTargetPct: number;
  status: HealthStatus;
}

/** km needed to judge a truck: a few fills, so one odd fill can't decide. */
export const HEALTH_KM = 1500;

/**
 * Is the truck still doing its normal km/L, or is it getting worse (worth a maintenance check)?
 * Uses only closed full-to-full fills. A truck is "service" when its recent km/L is below target
 * by more than the margin AND worse than its own past, or far below target (twice the margin).
 */
export function truckHealth(result: FuelResult, settings: FuelSettings): TruckHealth[] {
  const m = settings.marginPct / 100;
  const byPlate = new Map<string, Segment[]>();
  for (const s of result.segments) if (s.status !== 'pending' && s.distance > 0) (byPlate.get(s.plate) || byPlate.set(s.plate, []).get(s.plate)!).push(s);
  const out: TruckHealth[] = [];
  for (const [plate, list] of byPlate) {
    const segs = [...list].sort((a, b) => a.at.localeCompare(b.at));
    const target = result.targets[plate] || result.fleetKmL;
    const recent: Segment[] = [];
    let km = 0;
    for (let i = segs.length - 1; i >= 0 && km < HEALTH_KM; i--) { recent.unshift(segs[i]); km += segs[i].distance; }
    const base = segs.slice(0, segs.length - recent.length);
    const kmL = (xs: Segment[]) => { const L = xs.reduce((a, s) => a + s.liters, 0); return L ? xs.reduce((a, s) => a + s.distance, 0) / L : 0; };
    const recentKmL = round(kmL(recent)), baseKmL = round(kmL(base));
    const baseKm = round(base.reduce((a, s) => a + s.distance, 0), 0);
    const trendPct = baseKmL && baseKm >= HEALTH_KM ? round((recentKmL / baseKmL - 1) * 100, 1) : 0;
    const vsTargetPct = recentKmL ? round((recentKmL / target - 1) * 100, 1) : 0;
    let status: HealthStatus = 'good';
    if (km < HEALTH_KM) status = 'noData';
    else if (recentKmL < target * (1 - 2 * m) || (recentKmL < target * (1 - m) && trendPct <= -settings.marginPct)) status = 'service';
    else if (recentKmL < target * (1 - m) || trendPct <= -settings.marginPct) status = 'watch';
    const last = segs[segs.length - 1];
    out.push({ plate, vehicleType: last.vehicleType, driver: last.driver, target, recentKmL, recentKm: round(km, 0), recentFrom: recent[0]?.fromAt.slice(0, 10) || '',
      baseKmL, baseKm, trendPct, vsTargetPct, status });
  }
  const order: Record<HealthStatus, number> = { service: 0, watch: 1, good: 2, noData: 3 };
  return out.sort((a, b) => order[a.status] - order[b.status] || a.vsTargetPct - b.vsTargetPct);
}
