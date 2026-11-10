import type { TransportUser } from '../types';
import type { ChatTurn } from '../daliCore';
// .ts extensions so node can run this file in tests (vite and tsc accept them too).
import { computeFuel, summarize } from './math.ts';
import type { FuelResult, FuelSettings, FuelTx, Segment, Summary } from './math.ts';
import { fuelAlerts, isChecked, LEVEL_ORDER, truckHealth, weekEnd, weekOf } from './alerts.ts';
import type { FuelAlert, TruckHealth } from './alerts.ts';
import { FUEL_STRINGS } from './i18n.ts';
import { methodText } from './explain.ts';

/** What the Fuel DALI reads from. Pure (no network) so it runs in node tests too. */
export interface FuelData { txs: FuelTx[]; settings: FuelSettings; result: FuelResult; alerts: FuelAlert[]; health: TruckHealth[]; loadedAt: number }

export function makeFuelData(txs: FuelTx[], settings: FuelSettings): FuelData {
  const result = computeFuel(txs, settings);
  return { txs, settings, result, alerts: fuelAlerts(result, txs, settings), health: truckHealth(result, settings), loadedAt: Date.now() };
}

/* ------------------------------ summaries ------------------------------ */

const sum = <T,>(xs: readonly T[], f: (x: T) => number) => xs.reduce((a, x) => a + (f(x) || 0), 0);
const r0 = (n: number) => Math.round(n || 0).toLocaleString('en-US');
const r2 = (n: number) => (n ? n.toFixed(2) : '-');
const pc = (n: number) => (n ? `${n > 0 ? '+' : ''}${n.toFixed(1)}%` : '0%');

function weightedTarget(segs: Segment[], fallback: number) {
  const done = segs.filter(s => s.status !== 'pending' && s.distance > 0);
  const exp = sum(done, s => s.distance / s.target);
  return exp ? Math.round((sum(done, s => s.distance) / exp) * 100) / 100 : fallback || 2.3;
}

function group(d: FuelData, key: (x: { plate: string; driver: string; at: string }) => string, truckTarget: boolean, txs = d.txs, segs = d.result.segments, fills = d.result.fills): Summary[] {
  const keys = [...new Set([...segs.map(key), ...txs.map(key)])].filter(Boolean);
  return keys.map(k => {
    const s = segs.filter(x => key(x) === k);
    const target = truckTarget ? (d.result.targets[k] || weightedTarget(s, d.result.fleetKmL)) : weightedTarget(s, d.result.fleetKmL);
    return summarize(k, k, s, txs.filter(x => key(x) === k), fills.filter(x => key(x) === k), target, d.settings.marginPct, d.result.price);
  });
}

const sumLine = (s: Summary, withLabel = true) => `${withLabel ? `${s.label} | ` : ''}type ${s.vehicleType || '-'} | fills ${s.fillCount} (tx ${s.txCount}) | ${r0(s.liters)} L | paid ${r0(s.cost)} EGP | tracked ${r0(s.trackedKm)} km on ${r0(s.trackedL)} L = ${r2(s.kmL)} km/L | target ${r2(s.target)} (${pc(s.vsTargetPct)}) | over margin ${r0(s.overMarginL)} L ≈ ${r0(s.lossEgp)} EGP | card says ${r2(s.cardKmL)} km/L | status ${s.status}`;
const segLine = (s: Segment) => `${s.fromAt.slice(0, 16)} → ${s.at.slice(0, 16)} | ${s.driver || '-'} | km ${r0(s.fromKm)}→${r0(s.toKm)} = ${r0(s.distance)} km | ${r0(s.liters)} L | ${r2(s.kmL)} km/L vs target ${r2(s.target)} | ${s.status}${s.notes.length ? ` | notes: ${s.notes.join(',')}` : ''}${s.lossEgp ? ` | loss ≈ ${r0(s.lossEgp)} EGP` : ''}`;
const healthLine = (h: TruckHealth) => `${h.plate} (${h.vehicleType || '-'}, ${h.driver || '-'}): ${h.status.toUpperCase()} | last ${r0(h.recentKm)} km since ${h.recentFrom || '-'}: ${r2(h.recentKmL)} km/L | target ${r2(h.target)} (${pc(h.vsTargetPct)}) | its own normal ${r2(h.baseKmL)} (${pc(h.trendPct)})`;

const digits = (s: string) => String(s || '').replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/\D/g, '');
const normAr = (s: string) => String(s || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();

/** Trucks or drivers the question names (plate digits like 3893, or a driver's name). */
export function mentioned(d: FuelData, question: string): { plates: string[]; drivers: string[] } {
  const qDigits = (String(question).replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).match(/\d{3,}/g) || []);
  const plates = [...new Set(d.txs.map(t => t.plate))].filter(p => { const pd = digits(p); return pd && qDigits.some(n => pd.includes(n) || n.includes(pd)); });
  const q = normAr(question);
  const drivers = [...new Set(d.txs.map(t => t.driver).filter(Boolean))].filter(name => {
    const parts = normAr(name).split(' ').filter(w => w.length >= 3);
    return parts.length > 0 && parts.slice(0, 2).every(w => q.includes(w));
  });
  return { plates, drivers };
}

export function buildFuelContext(d: FuelData, user: TransportUser, question: string, history: ChatTurn[], earlier: string[]): string {
  const recentQs = history.filter(h => h.role === 'user').slice(-2).map(h => h.content).join(' ');
  let { plates, drivers } = mentioned(d, question);
  if (!plates.length && !drivers.length) ({ plates, drivers } = mentioned(d, recentQs));
  const tx = d.txs;
  if (!tx.length) {
    return ['SECTION: Fuel', `USER: ${user.name}, Transport role ${user.role}`, 'FUEL DATA: none uploaded yet. The fuel card "Fuel Transactions" report is uploaded in the Fuel section.'].join('\n\n');
  }
  const first = tx.reduce((m, x) => (x.at < m ? x.at : m), tx[0].at).slice(0, 10);
  const last = tx.reduce((m, x) => (x.at > m ? x.at : m), tx[0].at).slice(0, 10);
  const done = d.result.segments.filter(s => s.status !== 'pending');
  const trucks = group(d, x => x.plate, true).sort((a, b) => a.vsTargetPct - b.vsTargetPct);
  const drv = group(d, x => x.driver || '-', false).sort((a, b) => b.liters - a.liters);
  const weeks = group(d, x => weekOf(x.at), false).sort((a, b) => a.key.localeCompare(b.key)).slice(-6);
  const months = group(d, x => x.at.slice(0, 7), false).sort((a, b) => a.key.localeCompare(b.key));
  const checked = new Set(d.settings.checkedAlerts || []);
  const open = d.alerts.filter(a => !isChecked(a, checked)).sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || b.at.localeCompare(a.at));
  const T = FUEL_STRINGS.en;
  const alertLine = (a: FuelAlert) => `[${a.level}] ${a.at.slice(0, 10)} ${a.plate}${a.driver ? ` (${a.driver})` : ''}: ${T.kind[a.kind]}. ${T.alertText(a).replace(/[⁦-⁩]/g, '')}`;
  const byStation = new Map<string, number>();
  tx.forEach(x => byStation.set(x.station || '-', (byStation.get(x.station || '-') || 0) + x.liters));

  // Detail for the trucks/drivers the question names.
  const focusSegs = d.result.segments.filter(s => plates.includes(s.plate) || drivers.includes(s.driver)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 25);
  const focusAlerts = open.filter(a => plates.includes(a.plate) || drivers.includes(a.driver)).slice(0, 20);
  const focusWeeks = plates.flatMap(p => {
    const ts = tx.filter(x => x.plate === p), ss = d.result.segments.filter(s => s.plate === p), fs = d.result.fills.filter(f => f.plate === p);
    return group(d, x => weekOf(x.at), false, ts, ss, fs).sort((a, b) => a.key.localeCompare(b.key)).slice(-4).map(w => `${p} week ${w.key} → ${weekEnd(w.key)}: ${sumLine(w, false)}`);
  });

  const parts = [
    `TODAY: ${new Date().toISOString().slice(0, 10)}`,
    'SECTION: Fuel (diesel km/L tracking from fuel-card transactions). Customer prices and the rate list are a separate section and are NOT in this context.',
    `USER: ${user.name}, Transport role ${user.role}${user.role === 'VIEWER' ? ' (read only)' : ''}`,
    `DATA: ${tx.filter(x => x.amount > 0).length} card transactions from ${first} to ${last}; ${d.result.fills.length} fills; ${trucks.length} trucks; ${drv.length} drivers. Diesel price used ${r2(d.result.price)} EGP/L. Total ${r0(sum(tx, x => x.liters))} L, paid ${r0(sum(tx, x => x.amount))} EGP (card charged ${r0(sum(tx, x => x.totalAmount))} with fees).`,
    `FLEET: ${r0(sum(done, s => s.distance))} km tracked on ${r0(sum(done, s => s.liters))} L = ${r2(d.result.fleetKmL)} km/L. Margins: truck ±${d.settings.marginPct}%, single fill ±${d.settings.fillMarginPct}%.${d.settings.tankLiters ? ` Tank ${d.settings.tankLiters} L.` : ''}`,
    `HOW WE CALCULATE:\n${methodText('en').join('\n')}`,
    `TRUCK HEALTH (last ${'1,500'} km vs target and vs own normal; SERVICE = check maintenance):\n${d.health.map(healthLine).join('\n')}`,
    `TRUCKS (whole period, worst vs target first):\n${trucks.map(x => sumLine(x)).join('\n')}`,
    `TRUCK DETAILS (assigned driver as recorded by the company, branch, model and year; fuel-card driver names remain separate):\\n${Object.entries(d.settings.vehicles || {}).map(([no, v]) => `${no} | assigned ${v.driver || '-'} | ${v.branch || '-'} | ${v.model || '-'} ${v.year || ''}`).join('\\n') || 'none'},
    `WEEKS (Saturday to Friday, fleet):\n${weeks.map(w => `${w.key} → ${weekEnd(w.key)}${weekEnd(w.key) > last ? ' (so far)' : ''}: ${sumLine(w, false)}`).join('\n')}`,
    `MONTHS (fleet):\n${months.map(x => sumLine(x)).join('\n')}`,
    `DRIVERS:\n${drv.slice(0, 40).map(x => sumLine(x)).join('\n')}`,
    `STATIONS (liters): ${[...byStation].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([s, l]) => `${s} ${r0(l)}`).join(', ')}`,
    `OPEN ALERTS (${open.length}, not marked checked${open.length > 40 ? ', first 40' : ''}):\n${open.slice(0, 40).map(alertLine).join('\n') || 'none'}`,
    earlier.length ? `EARLIER FUEL CHATS WITH THIS USER (memory):\n${earlier.join('\n')}` : '',
    plates.length || drivers.length ? `ASKED ABOUT: ${[...plates, ...drivers].join(', ')}` : '',
    focusWeeks.length ? `THEIR LAST WEEKS:\n${focusWeeks.join('\n')}` : '',
    focusSegs.length ? `THEIR LATEST FULL-TO-FULL FILLS (newest first):\n${focusSegs.map(s => `${s.plate} | ${segLine(s)}`).join('\n')}` : '',
    focusAlerts.length ? `THEIR OPEN ALERTS:\n${focusAlerts.map(alertLine).join('\n')}` : '',
  ];
  return parts.filter(Boolean).join('\n\n');
}

