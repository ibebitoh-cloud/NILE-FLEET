import React, { useEffect, useMemo, useRef, useState } from 'react';
import DaliLoader from '../../components/DaliLoader';
import SideNav from '../SideNav';
import * as api from '../api';
import type { Lang } from '../i18n';
import { FUEL_STRINGS, FuelStrings } from './i18n';
import { cardTotals, computeFuel, DEFAULT_SETTINGS, DEFAULT_VEHICLES, plateNo, vehicleOf, VehicleInfo, Fill, FuelResult, FuelSettings, FuelTx, Segment, SegmentStatus, Summary, summarize, TxView } from './math';
import { emptyProblems, FileProblems, parseFuelWorkbook, splitUpload } from './parse';
import { CardIssue, explainCardIssue, summarizeCardIssues } from './cardnote';
import { exportFuelExcel, printFuelReport, Sheet } from './exports';
import { explainHealth, explainSegment, healthSimple, methodText } from './explain';
import { AlertKind, AlertLevel, checkIds, FuelAlert, fuelAlerts, HEALTH_KM, isChecked, staleChecked, storedIds, HealthStatus, TruckHealth, truckHealth, weekEnd, weekOf } from './alerts';

/* ------------------------------ helpers ------------------------------ */

const nf = (d: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const N0 = nf(0), N1 = nf(1), N2 = nf(2);
const n0 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : N0.format(v));
const n1 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : N1.format(v));
const n2 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) || v === 0 ? '—' : N2.format(v));
/** Keeps signs, % and dates the right way round inside Arabic (right-to-left) text. */
const ltr = (x: string) => `\u2066${x}\u2069`;
const pct = (v: number) => (v ? ltr(`${v > 0 ? '+' : ''}${N1.format(v)}%`) : '—');
const signed = (v: number, f = n0) => { const out = f(Math.abs(v)); return !v || /^[0.]+$/.test(out) ? '—' : ltr(`${v > 0 ? '+' : '−'}${out}`); };
const day = (at: string) => at.slice(0, 10);
const round1 = (v: number) => Math.round(v * 10) / 10;
const vehicleLine = (v: VehicleInfo) => [v.model, v.year, v.branch, v.driver && `👤 ${v.driver}`].filter(Boolean).join(' · ');
const when = (at: string) => `${at.slice(0, 10)} ${at.slice(11, 16)}`;
function sum<T>(xs: readonly T[], f: (x: T) => number): number { return xs.reduce((s, x) => s + (f(x) || 0), 0); }
const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));

const inputCls = 'rounded-xl border border-[#d9d0c0] bg-white px-3 py-2 text-sm outline-none focus:border-[#c2a378]';
const btn = 'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition disabled:opacity-40';
const btnGold = `${btn} bg-[#c2a378] text-[#07111f] hover:brightness-105`;
const btnNavy = `${btn} bg-[#07111f] text-white hover:bg-[#13263d]`;
const btnGhost = `${btn} border border-[#d9d0c0] bg-white text-[#07111f] hover:border-[#c2a378]`;

const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`rounded-2xl border border-[#e3dccf] bg-white p-4 shadow-[0_1px_0_rgba(7,17,31,.04)] sm:p-5 ${className}`}>{children}</div>
);

type StatusFilter = '' | SegmentStatus | 'badKm' | 'split' | 'partial' | 'reversed';
interface Filters { q: string; from: string; to: string; plate: string; driver: string; station: string; type: string; status: StatusFilter }
const NO_FILTERS: Filters = { q: '', from: '', to: '', plate: '', driver: '', station: '', type: '', status: '' };
type View = 'home' | 'summary' | 'truck' | 'alerts' | 'trucks' | 'drivers' | 'fills' | 'tx' | 'weeks' | 'months' | 'stations' | 'settings';

const VIEW_ICON: Record<string, string> = { home: '⌂', summary: '📊', truck: '🚛', alerts: '🔔', trucks: '🚛', drivers: '🧑‍✈️', fills: '⛽', tx: '🧾', weeks: '🗓', months: '📅', stations: '📍', settings: '⚙' };

type WeekRow = Summary & { prevLiters: number | null; prevKmL: number | null };

const HEALTH_CLS: Record<HealthStatus, string> = { service: 'border-red-300 bg-red-50/60', watch: 'border-amber-300 bg-amber-50/60', good: 'border-[#eee7da] bg-white', noData: 'border-[#eee7da] bg-[#faf8f4] opacity-70' };
const HEALTH_PILL: Record<HealthStatus, string> = { service: 'bg-red-600 text-white', watch: 'bg-amber-100 text-amber-900', good: 'bg-emerald-100 text-emerald-800', noData: 'bg-slate-100 text-slate-500' };
const STATUS_CLS: Record<SegmentStatus, string> = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  high: 'bg-red-50 text-red-700 border-red-200',
  low: 'bg-amber-50 text-amber-800 border-amber-200',
  pending: 'bg-slate-50 text-slate-600 border-slate-200',
};
const statusLabel = (t: FuelStrings, s: SegmentStatus) => t[`st_${s}` as const];
const Badge: React.FC<{ t: FuelStrings; s: SegmentStatus }> = ({ t, s }) => (
  <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-black ${STATUS_CLS[s]}`}>{statusLabel(t, s)}</span>
);
const Chip: React.FC<{ children: React.ReactNode; tone?: 'amber' | 'slate' | 'red' | 'blue' }> = ({ children, tone = 'slate' }) => {
  const c = { amber: 'bg-amber-50 text-amber-800', slate: 'bg-slate-100 text-slate-600', red: 'bg-red-50 text-red-700', blue: 'bg-sky-50 text-sky-700' }[tone];
  return <span className={`inline-block whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-bold ${c}`}>{children}</span>;
};

/* ------------------------------ sortable table ------------------------------ */

interface Col<T> {
  key: string; label: string; get: (r: T) => string | number | null;
  render?: (r: T) => React.ReactNode; num?: boolean; className?: string;
}

/** Phone layout (iPhone Pro Max is 430 px wide): cards instead of wide tables, bottom tab bar. */
const MOBILE_QUERY = '(max-width: 767px)';
function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

/** Which columns a phone card shows: a title line, a small line under it, a badge, a grid of numbers and a footer. */
interface MobileCard { title: string; sub?: string; badge?: string; stats: string[]; foot?: string }

function DataTable<T>({ rows, cols, rowKey, initial, onRow, empty, pageSize = 150, highlight, mobile, sortLabel }: {
  rows: T[]; cols: Col<T>[]; rowKey: (r: T) => string; initial?: { key: string; dir: 1 | -1 };
  onRow?: (r: T) => void; empty: string; pageSize?: number; highlight?: (r: T) => string;
  mobile?: MobileCard; sortLabel?: string;
}) {
  const isMobile = useIsMobile();
  const [sort, setSort] = useState(initial || { key: cols[0].key, dir: 1 as 1 | -1 });
  const [limit, setLimit] = useState(pageSize);
  useEffect(() => setLimit(pageSize), [rows, pageSize]);
  const sorted = useMemo(() => {
    const col = cols.find(c => c.key === sort.key) || cols[0];
    return [...rows].sort((a, b) => {
      const av = col.get(a), bv = col.get(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'ar');
      return c * sort.dir;
    });
  }, [rows, cols, sort]);
  if (!rows.length) return <div className="rounded-xl border border-dashed border-[#d9d0c0] p-8 text-center text-sm font-bold text-slate-500">{empty}</div>;
  if (isMobile && mobile) {
    const col = (k?: string) => (k ? cols.find(c => c.key === k) : undefined);
    const show = (c: Col<T> | undefined, r: T) => (c ? (c.render ? c.render(r) : (c.get(r) ?? '—')) : null);
    const title = col(mobile.title), sub = col(mobile.sub), badge = col(mobile.badge), foot = col(mobile.foot);
    const stats = mobile.stats.map(k => col(k)).filter(Boolean) as Col<T>[];
    return (
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <select aria-label={sortLabel} className={`${inputCls} min-w-0 flex-1 !py-2.5 text-xs`} value={sort.key} onChange={e => setSort({ key: e.target.value, dir: cols.find(c => c.key === e.target.value)?.num ? -1 : 1 })}>
            {cols.filter(c => c.label && c.key !== 'print').map(c => <option key={c.key} value={c.key}>{sortLabel ? `${sortLabel}: ` : ''}{c.label}</option>)}
          </select>
          <button className={`${btnGhost} !px-3 !py-2.5`} onClick={() => setSort(s => ({ ...s, dir: s.dir === 1 ? -1 : 1 }))} aria-label="sort direction">{sort.dir === 1 ? '▲' : '▼'}</button>
        </div>
        {sorted.slice(0, limit).map(r => (
          <div key={rowKey(r)} role={onRow ? 'button' : undefined} onClick={onRow ? () => onRow(r) : undefined}
            className={`rounded-2xl border border-[#e3dccf] bg-white p-3.5 shadow-[0_1px_0_rgba(7,17,31,.04)] ${onRow ? 'active:scale-[.99] active:bg-[#fbf8f2]' : ''} ${highlight?.(r) || ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-sm">
                <div className="truncate font-black text-[#07111f]">{show(title, r)}</div>
                {sub && <div className="mt-0.5 truncate text-[11px] text-slate-500">{show(sub, r)}</div>}
              </div>
              {badge && <div className="shrink-0">{show(badge, r)}</div>}
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-x-2 gap-y-2">
              {stats.map(c => (
                <div key={c.key} className="min-w-0">
                  <div className="truncate text-[9px] font-bold uppercase tracking-wide text-slate-400">{c.label}</div>
                  <div className="truncate text-[13px] font-bold tabular-nums text-[#07111f]">{show(c, r)}</div>
                </div>
              ))}
            </div>
            {foot && <div className="mt-2.5 border-t border-[#f1ebe0] pt-2 text-[11px] text-slate-600">{show(foot, r)}</div>}
          </div>
        ))}
        {sorted.length > limit && (
          <button className={`${btnGhost} w-full justify-center !py-3`} onClick={() => setLimit(l => l + pageSize)}>+ {Math.min(pageSize, sorted.length - limit)} ({limit} / {sorted.length})</button>
        )}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-[#eee7da]">
      <table className="w-full whitespace-nowrap text-xs">
        <thead className="sticky top-0 bg-[#07111f] text-white">
          <tr>
            {cols.map(c => (
              <th key={c.key} className={`px-2.5 py-2.5 text-[10px] font-black uppercase tracking-wider ${c.num ? 'text-end' : 'text-start'}`}>
                <button className="inline-flex items-center gap-1 hover:text-[#c2a378]" onClick={() => setSort(s => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : (c.num ? -1 : 1) }))}>
                  {c.label}<span className="text-[#c2a378]">{sort.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : ''}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, limit).map(r => (
            <tr key={rowKey(r)} onClick={onRow ? () => onRow(r) : undefined}
              className={`border-t border-[#f1ebe0] ${onRow ? 'cursor-pointer hover:bg-[#fbf8f2]' : ''} ${highlight?.(r) || ''}`}>
              {cols.map(c => (
                <td key={c.key} className={`px-2.5 py-2 ${c.num ? 'text-end tabular-nums' : ''} ${c.className || ''}`}>{c.render ? c.render(r) : (c.get(r) ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length > limit && (
        <div className="border-t border-[#eee7da] p-2 text-center">
          <button className={btnGhost} onClick={() => setLimit(l => l + pageSize)}>+ {Math.min(pageSize, sorted.length - limit)} ({limit} / {sorted.length})</button>
        </div>
      )}
    </div>
  );
}

const pick2 = <T,>(cols: Col<T>[], keys: string[]) => keys.map(k => cols.find(c => c.key === k)!).filter(Boolean);
const toSheet = <T,>(name: string, cols: Col<T>[], rows: T[]): Sheet => ({
  name, head: cols.map(c => c.label), rows: rows.map(r => cols.map(c => c.get(r))),
});

/* ------------------------------ screen ------------------------------ */

const FuelScreen: React.FC<{ lang: Lang; isAdmin: boolean; setToast: (s: string) => void }> = ({ lang, isAdmin, setToast }) => {
  const t = FUEL_STRINGS[lang];
  const [txs, setTxs] = useState<FuelTx[] | null>(null);
  const [local, setLocal] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<FuelSettings>(DEFAULT_SETTINGS);
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const isMobile = useIsMobile();
  const [view, setView] = useState<View>(() => {
    const phone = typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;
    void phone;
    try { const v = localStorage.getItem('nf_transport_fuel_view') as View | null; if (v) return v; } catch { /* ignore */ }
    return 'home';
  });
  const [sheet, setSheet] = useState<'' | 'more' | 'filters'>('');
  /** The truck open in the truck page (all its data). */
  const [truckPlate, setTruckPlate] = useState<string>(() => { try { return localStorage.getItem('nf_transport_fuel_truck') || ''; } catch { return ''; } });
  const [truckTab, setTruckTab] = useState<'fills' | 'tx' | 'weeks' | 'months' | 'alerts'>('fills');
  const openTruck = (plate: string) => { setTruckPlate(plate); setTruckTab('fills'); setView('truck'); try { localStorage.setItem('nf_transport_fuel_truck', plate); } catch { /* ignore */ } };
  /** The fill (segment key) or truck (health) whose calculation is open in the explain dialog. */
  const [explain, setExplain] = useState<{ seg?: string; plate?: string } | null>(null);
  const [fullRead, setFullRead] = useState(false);
  /** The card transaction open in the preview / edit popup. */
  const [txOpen, setTxOpen] = useState<string | null>(null);
  const txOverExplain = useRef(false);
  useEffect(() => setFullRead(false), [explain]);
  const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState<{ total: number; fresh: FuelTx[]; inSystem: number; repeated: number; from: string; to: string; rows: FuelTx[]; problems: FileProblems } | null>(null);
  /** Plain-language reasons a file could not be read (shown instead of a bare error). */
  const [uploadFail, setUploadFail] = useState<string[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (p: Partial<Filters>) => setF(x => ({ ...x, ...p }));

  useEffect(() => { try { localStorage.setItem('nf_transport_fuel_view', view); } catch { /* ignore */ } }, [view]);
  // 'home' is the dashboard (truck health, key numbers, card vs actual) on phone and desktop alike.
  // Back button / swipe-back: every tab change and every open popup is a step in the browser history,
  // so the phone's swipe from the edge (or the back button) goes to the previous tab or closes the popup.
  const viewRef = useRef(view);
  viewRef.current = view;
  const overlayOpen = !!explain || !!sheet;
  useEffect(() => {
    try { if (!history.state?.fuelView) history.replaceState({ ...(history.state || {}), fuelView: view }, ''); } catch { /* ignore */ }
    const onPop = (e: PopStateEvent) => {
      const st = e.state || {};
      if (st.fuelOverlay === 'tx') return;
      if (st.fuelOverlay) { setTxOpen(null); return; }
      setTxOpen(null); setExplain(null); setSheet('');
      if (st.fuelView && st.fuelView !== viewRef.current) setView(st.fuelView as View);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    try {
      const st = history.state || {};
      if (st.fuelView === view) return;
      // Leaving a popup by picking a tab: reuse the popup's history step.
      if (st.fuelOverlay) history.replaceState({ fuelView: view }, '');
      else history.pushState({ fuelView: view }, '');
    } catch { /* ignore */ }
  }, [view]);
  // The transaction popup is its own history step, so swipe-back closes only it (and leaves a fill popup under it open).
  useEffect(() => {
    try {
      const st = history.state || {};
      if (txOpen && st.fuelOverlay !== 'tx') { txOverExplain.current = !!explain || !!sheet; history.pushState({ fuelView: viewRef.current, fuelOverlay: 'tx' }, ''); }
      if (!txOpen && st.fuelOverlay === 'tx') {
        // Opened on its own and now a fill popup takes its place: reuse the step instead of going back.
        if (!txOverExplain.current && (explain || sheet)) history.replaceState({ fuelView: viewRef.current, fuelOverlay: true }, '');
        else history.back();
      }
    } catch { /* ignore */ }
  }, [txOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    try {
      const st = history.state || {};
      if (overlayOpen && !st.fuelOverlay) history.pushState({ fuelView: viewRef.current, fuelOverlay: true }, '');
      if (!overlayOpen && st.fuelOverlay) history.back();
    } catch { /* ignore */ }
  }, [overlayOpen]);
  // Phone: make room for the bottom tab bar, and lift DALI's button and the toast above it.
  useEffect(() => {
    if (!isMobile) return;
    const root = document.documentElement, body = document.body;
    root.style.setProperty('--nf-fab-bottom', 'calc(5.25rem + env(safe-area-inset-bottom))');
    const pad = body.style.paddingBottom;
    body.style.paddingBottom = 'calc(4.5rem + env(safe-area-inset-bottom))';
    return () => { root.style.removeProperty('--nf-fab-bottom'); body.style.paddingBottom = pad; };
  }, [isMobile]);
  // Phone: a new tab starts at the top of the page.
  useEffect(() => { if (isMobile) window.scrollTo({ top: 0 }); }, [view, isMobile]);
  useEffect(() => {
    api.loadFuel().then(r => { setTxs(r.txs); setLocal(r.local); }).catch(e => { setError(String(e.message || e)); setTxs([]); });
    api.loadFuelSettings().then(s => setSettings({ ...DEFAULT_SETTINGS, ...s })).catch(() => {});
  }, []);

  const result: FuelResult = useMemo(() => computeFuel(txs || [], settings), [txs, settings]);
  /** Segment by key, and the start fill of each segment (the full tank it is measured from). */
  const segByKey: Map<string, Segment> = useMemo(() => new Map(result.segments.map(x => [x.key, x])), [result]);
  const fillByAtPlate: Map<string, Fill> = useMemo(() => new Map(result.fills.map(x => [`${x.plate}|${x.at}`, x])), [result]);
  const segTxIds = (sg: Segment) => sg.fills.flatMap(f => f.txs.map(x => x.id));
  const alerts: FuelAlert[] = useMemo(() => fuelAlerts(result, txs || [], settings), [result, txs, settings]);
  const health: TruckHealth[] = useMemo(() => truckHealth(result, settings), [result, settings]);
  const checked: Set<string> = useMemo(() => new Set(settings.checkedAlerts || []), [settings]);
  const [af, setAf] = useState<{ kind: '' | AlertKind; level: '' | AlertLevel; showChecked: boolean }>({ kind: '', level: '', showChecked: false });

  const options: { plates: string[]; drivers: string[]; stations: string[]; types: string[] } = useMemo(() => {
    const list = txs || [];
    return { plates: uniq(list.map(x => x.plate)), drivers: uniq(list.map(x => x.driver)), stations: uniq(list.map(x => x.station)), types: uniq(list.map(x => x.vehicleType)) };
  }, [txs]);

  /* ---- filtering (math always runs on everything; filters only choose what to show) ---- */
  const inRange = (at: string) => (!f.from || day(at) >= f.from) && (!f.to || day(at) <= f.to);
  const q = f.q.trim().toLowerCase();
  const filtered: { segs: Segment[]; views: TxView[]; txs: FuelTx[]; fills: Fill[] } = useMemo(() => {
    const segOk = (s: Segment) => {
      if (!inRange(s.at)) return false;
      if (f.plate && s.plate !== f.plate) return false;
      if (f.driver && s.driver !== f.driver) return false;
      if (f.type && s.vehicleType !== f.type) return false;
      if (f.station && !s.fills.some(x => x.station === f.station)) return false;
      if (f.status) {
        if (f.status === 'badKm' || f.status === 'split' || f.status === 'partial') { if (!s.notes.includes(f.status) && !(f.status === 'partial' && s.notes.includes('paired'))) return false; }
        else if (f.status === 'reversed') return false;
        else if (s.status !== f.status) return false;
      }
      if (q && !`${s.plate} ${s.driver} ${s.fills.map(x => `${x.station} ${x.txs.map(y => y.id).join(' ')}`).join(' ')}`.toLowerCase().includes(q)) return false;
      return true;
    };
    const txOk = (v: TxView) => {
      const x = v.tx;
      if (!inRange(x.at)) return false;
      if (f.plate && x.plate !== f.plate) return false;
      if (f.driver && x.driver !== f.driver) return false;
      if (f.type && x.vehicleType !== f.type) return false;
      if (f.station && x.station !== f.station) return false;
      if (f.status) {
        const sg = v.segmentKey ? segByKey.get(v.segmentKey) : undefined;
        if (f.status === 'reversed') { if (!v.flags.includes('reversed') && !v.flags.includes('reversal')) return false; }
        else if (f.status === 'badKm' || f.status === 'split') { if (!v.flags.includes(f.status)) return false; }
        else if (f.status === 'partial') { if (!sg?.notes.includes('partial') && !sg?.notes.includes('paired')) return false; }
        else if (sg?.status !== f.status) return false;
      }
      if (q && !`${x.id} ${x.plate} ${x.driver} ${x.station}`.toLowerCase().includes(q)) return false;
      return true;
    };
    const fillOk = (x: Fill) => inRange(x.at) && (!f.plate || x.plate === f.plate) && (!f.driver || x.driver === f.driver)
      && (!f.type || x.vehicleType === f.type) && (!f.station || x.station === f.station);
    const segs = result.segments.filter(segOk);
    const views = result.txViews.filter(txOk);
    return { segs, views, txs: views.map(v => v.tx), fills: result.fills.filter(fillOk) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, segByKey, f]);

  const alertOk = (a: FuelAlert) => inRange(a.at) && (!f.plate || a.plate === f.plate) && (!f.driver || a.driver === f.driver)
    && (!q || `${a.plate} ${a.driver} ${t.kind[a.kind]}`.toLowerCase().includes(q));
  const openAlerts: FuelAlert[] = useMemo(() => alerts.filter(a => !isChecked(a, checked) && alertOk(a)), [alerts, checked, f]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownAlerts: FuelAlert[] = useMemo(() => alerts.filter(a => alertOk(a) && (af.showChecked || !isChecked(a, checked))
    && (!af.kind || a.kind === af.kind) && (!af.level || a.level === af.level)), [alerts, checked, f, af]); // eslint-disable-line react-hooks/exhaustive-deps
  const urgent = openAlerts.filter(a => a.level !== 'low').length;

  /* ---- summaries ---- */
  const weightedTarget = (segs: Segment[]) => {
    const done = segs.filter(s => s.status !== 'pending' && s.distance > 0);
    const exp = sum(done, s => s.distance / s.target);
    return exp ? Math.round((sum(done, s => s.distance) / exp) * 100) / 100 : result.fleetKmL || 2.3;
  };
  type Data = { segs: Segment[]; txs: FuelTx[]; fills: Fill[] };
  const group = (key: (x: { plate: string; driver: string; at: string; station?: string }) => string, label: (k: string) => string, useTruckTarget: boolean, data: Data = filtered): Summary[] => {
    const keys = uniq([...data.segs.map(key), ...data.txs.map(key)]);
    return keys.map(k => {
      const segs = data.segs.filter(s => key(s) === k);
      const tx = data.txs.filter(x => key(x) === k);
      const fills = data.fills.filter(x => key(x) === k);
      const target = useTruckTarget ? (result.targets[k] || weightedTarget(segs)) : weightedTarget(segs);
      return summarize(k, label(k), segs, tx, fills, target, settings.marginPct, result.price);
    });
  };
  const trucks: Summary[] = useMemo(() => group(x => x.plate, k => k, true), [filtered, result, settings]); // eslint-disable-line react-hooks/exhaustive-deps
  const drivers: Summary[] = useMemo(() => group(x => x.driver || '—', k => k, false), [filtered, result, settings]); // eslint-disable-line react-hooks/exhaustive-deps
  const months: Summary[] = useMemo(() => group(x => x.at.slice(0, 7), k => k, false), [filtered, result, settings]); // eslint-disable-line react-hooks/exhaustive-deps
  const weeks: WeekRow[] = useMemo(() => {
    const list: Summary[] = group(x => weekOf(x.at), k => `${k} → ${weekEnd(k)}`, false).sort((a: Summary, b: Summary) => a.key.localeCompare(b.key));
    const last = (txs || []).reduce((m, x) => (x.at > m ? x.at : m), '').slice(0, 10);
    return list.map((w, i) => ({ ...w, label: weekEnd(w.key) > last ? `${w.label} · ${t.soFar}` : w.label, prevLiters: i ? list[i - 1].liters : null, prevKmL: i ? list[i - 1].kmL || null : null }));
  }, [filtered, result, settings]); // eslint-disable-line react-hooks/exhaustive-deps
  /* ---- summary screen: each truck overall, this week (of the last upload) and its last fill ---- */
  const lastAt = (txs || []).reduce((m, x) => (x.at > m ? x.at : m), '');
  const thisWeek = lastAt ? weekOf(lastAt) : '';
  const prevWeek = thisWeek ? weekOf(new Date(Date.parse(`${thisWeek}T00:00:00Z`) - 86_400_000).toISOString()) : '';
  const allData: Data = useMemo(() => ({ segs: result.segments, txs: txs || [], fills: result.fills }), [result, txs]);
  const only = (d: Data, ok: (x: { at: string; plate: string }) => boolean): Data => ({ segs: d.segs.filter(ok), txs: d.txs.filter(ok), fills: d.fills.filter(ok) });
  type TruckCardRow = { plate: string; all: Summary; week?: Summary; prev?: Summary; last?: FuelTx; first?: FuelTx; days: number; health?: TruckHealth; open: number };
  const truckCards: TruckCardRow[] = useMemo(() => {
    const byPlate = (d: Data) => new Map(group(x => x.plate, k => k, true, d).map(x => [x.key, x]));
    const wk = byPlate(only(allData, x => weekOf(x.at) === thisWeek)), pw = byPlate(only(allData, x => weekOf(x.at) === prevWeek));
    const q2 = q;
    return group(x => x.plate, k => k, true, allData)
      .filter(r => (!f.plate || r.key === f.plate) && (!f.type || r.vehicleType.includes(f.type)) && (!q2 || `${r.key} ${r.drivers.join(' ')} ${Object.values(vehicleOf(settings, r.key) || {}).join(' ')}`.toLowerCase().includes(q2)))
      .map(r => {
        const mine = (txs || []).filter(x => x.plate === r.key && x.amount > 0).sort((a, b) => a.at.localeCompare(b.at));
        const last = mine[mine.length - 1];
        return { plate: r.key, all: r, week: wk.get(r.key), prev: pw.get(r.key), last, first: mine[0], health: health.find(h => h.plate === r.key),
          days: last && lastAt ? Math.round((Date.parse(`${lastAt.slice(0, 10)}T00:00:00Z`) - Date.parse(`${last.at.slice(0, 10)}T00:00:00Z`)) / 86_400_000) : 0,
          open: openAlerts.filter(a => a.plate === r.key).length };
      })
      .sort((a, b) => (a.all.vsTargetPct || 0) - (b.all.vsTargetPct || 0));
  }, [allData, health, openAlerts, f, thisWeek, prevWeek]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- truck page: everything about one truck ---- */
  const truck = useMemo(() => {
    if (!truckPlate) return null;
    const d = only(allData, x => x.plate === truckPlate);
    if (!d.txs.length) return null;
    const wl = group(x => weekOf(x.at), k => `${k} → ${weekEnd(k)}`, true, d).map(w => ({ ...w, label: w.label })).sort((a, b) => a.key.localeCompare(b.key));
    const weeksT: WeekRow[] = wl.map((w, i) => ({ ...w, label: weekEnd(w.key) > lastAt.slice(0, 10) ? `${w.label} · ${t.soFar}` : w.label, prevLiters: i ? wl[i - 1].liters : null, prevKmL: i ? wl[i - 1].kmL || null : null }));
    // group() picks the target by key; for one truck every row must use the truck's own target.
    const tg = result.targets[truckPlate] || weightedTarget(d.segs);
    const fix = (r: Summary) => summarize(r.key, r.label, d.segs.filter(s => weekOf(s.at) === r.key || s.at.slice(0, 7) === r.key), d.txs.filter(x => weekOf(x.at) === r.key || x.at.slice(0, 7) === r.key), d.fills.filter(x => weekOf(x.at) === r.key || x.at.slice(0, 7) === r.key), tg, settings.marginPct, result.price);
    return {
      plate: truckPlate, data: d,
      card: truckCards.find(c => c.plate === truckPlate),
      all: summarize(truckPlate, truckPlate, d.segs, d.txs, d.fills, tg, settings.marginPct, result.price),
      weeks: weeksT.map(w => ({ ...w, ...fix(w), label: w.label, prevLiters: w.prevLiters, prevKmL: w.prevKmL })),
      months: group(x => x.at.slice(0, 7), k => k, true, d).map(fix),
      views: result.txViews.filter(v => v.tx.plate === truckPlate),
      alerts: alerts.filter(a => a.plate === truckPlate).sort((a, b) => Number(isChecked(a, checked)) - Number(isChecked(b, checked)) || b.at.localeCompare(a.at)),
    };
  }, [truckPlate, allData, truckCards, alerts, checked, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  type StationRow = { station: string; count: number; liters: number; cost: number; charged: number; share: number; trucks: number };
  const stations: StationRow[] = useMemo(() => {
    const total = sum(filtered.txs, x => x.liters) || 1;
    return uniq(filtered.txs.map(x => x.station || '—')).map(st => {
      const l = filtered.txs.filter(x => (x.station || '—') === st);
      const liters = sum(l, x => x.liters);
      return { station: st, count: l.filter(x => x.amount > 0).length, liters, cost: sum(l, x => x.amount), charged: sum(l, x => x.totalAmount), share: (liters / total) * 100, trucks: uniq(l.map(x => x.plate)).length };
    });
  }, [filtered, result]);

  const kpi = useMemo(() => {
    const done = filtered.segs.filter(s => s.status !== 'pending');
    const liters = sum(filtered.txs, x => x.liters);
    const trackedKm = sum(done, s => s.distance), trackedL = sum(done, s => s.liters);
    const card = cardTotals(filtered.txs);
    return {
      liters, cost: sum(filtered.txs, x => x.amount), charged: sum(filtered.txs, x => x.totalAmount), fees: sum(filtered.txs, x => x.totalAmount - x.amount),
      trackedKm, trackedL, kmL: trackedL ? trackedKm / trackedL : 0, target: weightedTarget(filtered.segs),
      overL: sum(trucks, s => s.overMarginL), loss: sum(trucks, s => s.lossEgp),
      outside: done.filter(s => s.status === 'high' || s.status === 'low').length,
      bad: filtered.fills.filter(x => x.badKm.some(b => b.km != null)).length,
      cardKm: card.cardKm, cardKmL: card.cardKmL,
      cardWrong: filtered.txs.filter(x => /wrong/i.test(x.cardValidity)).length,
      from: filtered.txs.length ? filtered.txs.reduce((m, x) => (x.at < m ? x.at : m), filtered.txs[0].at) : '',
      to: filtered.txs.length ? filtered.txs.reduce((m, x) => (x.at > m ? x.at : m), filtered.txs[0].at) : '',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, trucks, result]);

  /* ---- columns ---- */
  const summaryCols = (first: Col<Summary>): Col<Summary>[] => [
    first,
    { key: 'fills', label: t.count, num: true, get: r => r.fillCount },
    { key: 'liters', label: t.liters, num: true, get: r => Math.round(r.liters), render: r => n0(r.liters) },
    { key: 'cost', label: `${t.cost} (${t.egp})`, num: true, get: r => Math.round(r.cost), render: r => n0(r.cost) },
    { key: 'km', label: t.trackedKm, num: true, get: r => Math.round(r.trackedKm), render: r => n0(r.trackedKm) },
    { key: 'kml', label: t.kmL, num: true, get: r => r.kmL, render: r => <b>{n2(r.kmL)}</b> },
    { key: 'l100', label: t.l100, num: true, get: r => r.l100, render: r => n1(r.l100) },
    { key: 'target', label: t.target, num: true, get: r => r.target, render: r => n2(r.target) },
    { key: 'vs', label: t.vsTarget, num: true, get: r => r.vsTargetPct, render: r => <span className={r.vsTargetPct < -settings.marginPct ? 'font-black text-red-600' : r.vsTargetPct > settings.marginPct ? 'font-black text-amber-700' : ''}>{pct(r.vsTargetPct)}</span> },
    { key: 'diffL', label: t.diffL, num: true, get: r => Math.round(r.diffL), render: r => <span className={r.diffL > 0 ? 'text-red-600' : 'text-emerald-700'}>{signed(r.diffL)}</span> },
    { key: 'diffE', label: t.diffEgp, num: true, get: r => Math.round(r.diffEgp), render: r => <span className={r.diffEgp > 0 ? 'text-red-600' : 'text-emerald-700'}>{signed(r.diffEgp)}</span> },
    { key: 'over', label: t.overL, num: true, get: r => Math.round(r.overMarginL), render: r => r.overMarginL ? <b className="text-red-600">{n0(r.overMarginL)}</b> : '—' },
    { key: 'loss', label: t.loss, num: true, get: r => Math.round(r.lossEgp), render: r => r.lossEgp ? <b className="text-red-600">{n0(r.lossEgp)}</b> : '—' },
    { key: 'cardKm', label: t.cardKm, num: true, get: r => Math.round(r.cardKm), render: r => n0(r.cardKm) },
    { key: 'kmDiff', label: t.kmDiff, num: true, get: r => Math.round(r.cardKm - r.trackedKm), render: r => <span className={Math.abs(r.cardKm - r.trackedKm) > 50 ? 'font-black text-amber-700' : ''}>{signed(r.cardKm - r.trackedKm)}</span> },
    { key: 'cardKml', label: t.cardKmL, num: true, get: r => r.cardKmL, render: r => n2(r.cardKmL) },
    { key: 'kmlDiff', label: `Δ ${t.kmL}`, num: true, get: r => (r.cardKmL && r.kmL ? Math.round((r.cardKmL - r.kmL) * 100) / 100 : null), render: r => r.cardKmL && r.kmL && Math.abs(r.cardKmL - r.kmL) > 0.02 ? <span className="font-black text-amber-700">{signed(r.cardKmL - r.kmL, n2)}</span> : <span className="text-slate-400">—</span> },
    { key: 'split', label: t.splits, num: true, get: r => r.splits, render: r => r.splits || '—' },
    { key: 'partial', label: t.partials, num: true, get: r => r.partials, render: r => r.partials || '—' },
    { key: 'bad', label: t.bad, num: true, get: r => r.badKm, render: r => r.badKm ? <b className="text-amber-700">{r.badKm}</b> : '—' },
    { key: 'status', label: t.status, get: r => r.status, render: r => <Badge t={t} s={r.status} /> },
  ];
  const truckCols = summaryCols({ key: 'truck', label: t.truck, get: r => r.label, render: r => <div><b className="text-[#07111f]">{r.label}</b><div className="text-[10px] text-slate-500">{r.vehicleType} · {r.drivers.join('، ')}</div></div> });
  const driverCols = summaryCols({ key: 'driver', label: t.driver, get: r => r.label, render: r => <div><b>{r.label}</b><div className="text-[10px] text-slate-500">{r.plates.join(' · ')}</div></div> });
  const monthCols = summaryCols({ key: 'month', label: t.month, get: r => r.label, render: r => <b dir="ltr">{r.label}</b> }).filter(c => c.key !== 'status');

  const change = (now: number, prev: number | null) => (prev ? ((now - prev) / prev) * 100 : null);
  const weekCols: Col<WeekRow>[] = [
    { key: 'week', label: t.week, get: r => r.label, render: r => <b dir="ltr">{r.label}</b> },
    ...(summaryCols({ key: 'x', label: '', get: () => null }).slice(1, 4) as unknown as Col<WeekRow>[]),
    { key: 'dL', label: t.vsLastWeek, num: true, get: r => change(r.liters, r.prevLiters), render: r => { const c = change(r.liters, r.prevLiters); return c == null ? '—' : <span className={c > 0 ? 'text-red-600' : 'text-emerald-700'}>{pct(c)}</span>; } },
    ...(summaryCols({ key: 'x', label: '', get: () => null }).slice(4, 6) as unknown as Col<WeekRow>[]),
    { key: 'dKml', label: `${t.kmL} ${t.vsLastWeek}`, num: true, get: r => (r.kmL && r.prevKmL ? Math.round((r.kmL - r.prevKmL) * 100) / 100 : null), render: r => r.kmL && r.prevKmL ? <span className={r.kmL < r.prevKmL ? 'text-red-600' : 'text-emerald-700'}>{signed(r.kmL - r.prevKmL, n2)}</span> : '—' },
    ...(summaryCols({ key: 'x', label: '', get: () => null }).slice(6).filter(c => !['split', 'partial', 'bad'].includes(c.key)) as unknown as Col<WeekRow>[]),
  ];
  const noteText = (s: Segment) => s.notes.map(n => t[`n_${n}` as const]).join(' · ');
  const fillCols: Col<Segment>[] = [
    { key: 'at', label: t.date, get: r => when(r.at), render: r => <span dir="ltr">{when(r.at)}</span> },
    { key: 'truck', label: t.truck, get: r => r.plate, render: r => <b>{r.plate}</b> },
    { key: 'driver', label: t.driver, get: r => r.driver },
    { key: 'fromKm', label: t.fromKm, num: true, get: r => r.fromKm, render: r => n0(r.fromKm) },
    { key: 'toKm', label: t.toKm, num: true, get: r => r.toKm, render: r => n0(r.toKm) },
    { key: 'dist', label: t.actualKm, num: true, get: r => (r.status === 'pending' ? null : r.distance), render: r => r.status === 'pending' ? <span className="text-slate-400">—</span> : <b>{n0(r.distance)}</b> },
    { key: 'cardDist', label: t.cardDistance, num: true, get: r => r.card.distance, render: r => n0(r.card.distance) },
    { key: 'dDist', label: t.kmDiff, num: true, get: r => (r.status === 'pending' ? null : Math.round(r.card.distance - r.distance)), render: r => r.status === 'pending' ? <span className="text-slate-400">—</span> : <span className={Math.abs(r.card.distance - r.distance) > 5 ? 'font-black text-amber-700' : 'text-slate-400'}>{signed(r.card.distance - r.distance)}</span> },
    { key: 'liters', label: t.liters, num: true, get: r => r.liters, render: r => n1(r.liters) },
    { key: 'kml', label: t.actualKmL, num: true, get: r => r.kmL, render: r => <b>{n2(r.kmL)}</b> },
    { key: 'cardKml', label: t.cardKmL, num: true, get: r => r.card.kmL, render: r => n2(r.card.kmL) },
    { key: 'dKml', label: `Δ ${t.kmL}`, num: true, get: r => (r.card.kmL != null && r.kmL ? Math.round((r.card.kmL - r.kmL) * 100) / 100 : null), render: r => r.card.kmL != null && r.kmL && Math.abs(r.card.kmL - r.kmL) > 0.05 ? <span className="font-black text-amber-700">{signed(r.card.kmL - r.kmL, n2)}</span> : <span className="text-slate-400">—</span> },
    { key: 'l100', label: t.l100, num: true, get: r => r.l100, render: r => n1(r.l100) },
    { key: 'target', label: t.target, num: true, get: r => r.target, render: r => n2(r.target) },
    { key: 'exp', label: t.expected, num: true, get: r => r.expectedL, render: r => r.status === 'pending' ? '—' : n0(r.expectedL) },
    { key: 'diffL', label: t.diffL, num: true, get: r => r.diffL, render: r => <span className={r.diffL > 0 ? 'text-red-600' : 'text-emerald-700'}>{signed(r.diffL)}</span> },
    { key: 'diffE', label: t.diffEgp, num: true, get: r => r.diffEgp, render: r => <span className={r.diffEgp > 0 ? 'text-red-600' : 'text-emerald-700'}>{signed(r.diffEgp)}</span> },
    { key: 'loss', label: t.loss, num: true, get: r => r.lossEgp, render: r => r.lossEgp ? <b className="text-red-600">{n0(r.lossEgp)}</b> : '—' },
    { key: 'status', label: t.status, get: r => statusLabel(t, r.status), render: r => <Badge t={t} s={r.status} /> },
    { key: 'notes', label: t.notes, get: r => noteText(r), render: r => (
      <div className="flex flex-wrap gap-1">
        {r.notes.map(n => <Chip key={n} tone={n === 'badKm' ? 'amber' : n === 'fixedKm' ? 'slate' : 'blue'}>{t[`n_${n}` as const]}</Chip>)}
        {r.fills.length > 1 && <Chip>{r.fills.length} {t.count.toLowerCase()} · {r.fills.reduce((a, x) => a + x.txs.length, 0)} {t.txs.toLowerCase()}</Chip>}
      </div>
    ) },
  ];

  const flagTone = (fl: string) => (fl === 'badKm' ? 'amber' : fl === 'reversal' || fl === 'reversed' ? 'red' : fl === 'split' ? 'blue' : 'slate');
  const txCols: Col<TxView>[] = [
    { key: 'at', label: t.date, get: r => r.tx.at, render: r => <span dir="ltr">{when(r.tx.at)}</span> },
    { key: 'id', label: '#', get: r => r.tx.id, render: r => <span dir="ltr" className="text-slate-500">{r.tx.id}</span> },
    { key: 'truck', label: t.truck, get: r => r.tx.plate, render: r => <b>{r.tx.plate}</b> },
    { key: 'driver', label: t.driver, get: r => r.tx.driver },
    { key: 'station', label: t.station, get: r => r.tx.station, className: 'max-w-[180px] truncate' },
    { key: 'liters', label: t.liters, num: true, get: r => r.tx.liters, render: r => n1(r.tx.liters) },
    { key: 'amount', label: t.amount, num: true, get: r => r.tx.amount, render: r => n2(r.tx.amount) },
    { key: 'total', label: t.total, num: true, get: r => r.tx.totalAmount, render: r => n2(r.tx.totalAmount) },
    { key: 'fee', label: t.fee, num: true, get: r => Math.round((r.tx.totalAmount - r.tx.amount) * 100) / 100, render: r => n2(r.tx.totalAmount - r.tx.amount) },
    { key: 'pumpVar', label: t.pumpVar, num: true, get: r => r.tx.variance, render: r => Math.abs(r.tx.variance) > 1 ? <b className="text-red-600">{n2(r.tx.variance)}</b> : <span className="text-slate-400">—</span> },
    { key: 'odo', label: t.odometer, num: true, get: r => r.tx.km, render: r => n0(r.tx.km) },
    { key: 'cardKm', label: `${t.cardSays} ${t.km}`, num: true, get: r => r.tx.cardDistance, render: r => n0(r.tx.cardDistance) },
    { key: 'ourKm', label: t.ourKm, num: true, get: r => r.actualDistance, render: r => r.actualDistance == null ? <span className="text-slate-400">—</span> : <b>{n0(r.actualDistance)}</b> },
    { key: 'cardKml', label: `${t.cardSays} ${t.kmL}`, num: true, get: r => r.tx.cardKmL, render: r => n2(r.tx.cardKmL) },
    { key: 'ourKml', label: t.actualKmL, num: true, get: r => r.actualKmL, render: r => r.actualKmL == null ? <span className="text-slate-400">—</span> : <b>{n2(r.actualKmL)}</b> },
    { key: 'valid', label: t.cardSays, get: r => explainCardIssue(r, r.segmentKey ? segByKey.get(r.segmentKey) : undefined, lang)?.title || '', render: r => {
      const ci = explainCardIssue(r, r.segmentKey ? segByKey.get(r.segmentKey) : undefined, lang);
      return ci ? <span className="font-bold text-amber-800" title={`${ci.meaning} ${ci.did}`}>{ci.title} <span className="text-emerald-700">✓</span></span> : <span className="text-slate-400">—</span>; } },
    { key: 'merged', label: t.mergedWith, get: r => { const sg = r.segmentKey ? segByKey.get(r.segmentKey) : undefined; const ids = sg ? segTxIds(sg).filter(x => x !== r.tx.id) : []; return ids.length ? ids.map(x => `#${x}`).join(' ') : null; },
      render: r => { const sg = r.segmentKey ? segByKey.get(r.segmentKey) : undefined; const ids = sg ? segTxIds(sg).filter(x => x !== r.tx.id) : []; return ids.length ? <span dir="ltr" className="text-[11px] font-bold text-sky-800">🔗 {ids.map(x => `#${x}`).join(' ')}</span> : <span className="text-slate-400">—</span>; } },
    { key: 'flags', label: t.flags, get: r => r.flags.join(', '), render: r => <div className="flex flex-wrap gap-1">{r.flags.map(fl => <Chip key={fl} tone={flagTone(fl)}>{t[`f_${fl}` as const]}</Chip>)}</div> },
  ];
  const stationCols: Col<StationRow>[] = [
    { key: 'station', label: t.station, get: r => r.station, render: r => <b>{r.station}</b> },
    { key: 'count', label: t.txs, num: true, get: r => r.count },
    { key: 'trucks', label: t.trucks, num: true, get: r => r.trucks },
    { key: 'liters', label: t.liters, num: true, get: r => Math.round(r.liters), render: r => n0(r.liters) },
    { key: 'cost', label: `${t.cost} (${t.egp})`, num: true, get: r => Math.round(r.cost), render: r => n0(r.cost) },
    { key: 'charged', label: `${t.charged} (${t.egp})`, num: true, get: r => Math.round(r.charged), render: r => n0(r.charged) },
    { key: 'share', label: t.share, num: true, get: r => Math.round(r.share * 10) / 10, render: r => (
      <div className="flex items-center justify-end gap-2"><div className="h-1.5 w-20 rounded-full bg-[#f1ebe0]"><div className="h-1.5 rounded-full bg-[#c2a378]" style={{ width: `${r.share}%` }} /></div>{n1(r.share)}%</div>
    ) },
  ];

  const LEVEL_CLS: Record<AlertLevel, string> = { high: 'bg-red-600 text-white', medium: 'bg-amber-100 text-amber-900', low: 'bg-slate-100 text-slate-600' };
  const alertCols: Col<FuelAlert>[] = [
    { key: 'level', label: t.level, get: r => t.lvl[r.level] },
    { key: 'at', label: t.date, get: r => when(r.at) },
    { key: 'truck', label: t.truck, get: r => r.plate },
    { key: 'driver', label: t.driver, get: r => r.driver },
    { key: 'kind', label: t.alert, get: r => t.kind[r.kind] },
    { key: 'liters', label: t.liters, num: true, get: r => (r.liters ? Math.round(r.liters) : null) },
    { key: 'egp', label: t.egp, num: true, get: r => (r.egp ? Math.round(r.egp) : null) },
    { key: 'text', label: t.details, get: r => t.alertText(r) },
  ];
  const toggleChecked = async (ids: string[], on: boolean) => {
    const next = new Set(checked);
    ids.forEach(id => (on ? next.add(id) : next.delete(id)));
    const s = { ...settings, checkedAlerts: [...next] };
    try { await api.saveFuelSettings(s); setSettings(s); } catch (e: any) { setToast(String(e?.message || e)); }
  };
  const openAlert = (a: FuelAlert) => {
    const sg = a.segmentKey ? segByKey.get(a.segmentKey) : undefined;
    set({ plate: a.plate, from: (sg?.fromAt || a.at).slice(0, 10), to: a.at.slice(0, 10), status: '' });
    setView(a.kind === 'reversal' || a.kind === 'pumpVar' ? 'tx' : 'fills');
  };

  /** One Sat→Fri week for the whole fleet, compared with the week before. Ignores the screen filters. */
  const weeklyReport = (wk: string) => {
    const prevWk = weekOf(new Date(Date.parse(`${wk}T00:00:00Z`) - 86_400_000).toISOString());
    const pick = (w: string): Data => ({
      segs: result.segments.filter(s => weekOf(s.at) === w), txs: (txs || []).filter(x => weekOf(x.at) === w), fills: result.fills.filter(x => weekOf(x.at) === w),
    });
    const now = pick(wk), prev = pick(prevWk);
    const rowsNow = group(x => x.plate, k => k, true, now), rowsPrev = new Map(group(x => x.plate, k => k, true, prev).map(r => [r.key, r]));
    const total = (d: Data) => { const done = d.segs.filter(s => s.status !== 'pending'); const km = sum(done, s => s.distance), L = sum(done, s => s.liters); return { liters: sum(d.txs, x => x.liters), cost: sum(d.txs, x => x.amount), km, kmL: L ? km / L : 0 }; };
    const a = total(now), b = total(prev);
    const wkAlerts = alerts.filter(x => !isChecked(x, checked) && (weekOf(x.at) === wk || x.kind === 'idle'));
    const ch = (x: number, y: number) => (y ? `${ltr(`${x >= y ? '+' : ''}${N1.format(((x - y) / y) * 100)}%`)} ${t.vsLastWeek}` : '');
    type WRow = Summary & { prevKmL: number | null; alerts: number };
    const wrows: WRow[] = rowsNow.map(r => ({ ...r, prevKmL: rowsPrev.get(r.key)?.kmL || null, alerts: wkAlerts.filter(x => x.plate === r.key).length }))
      .sort((x, y) => x.vsTargetPct - y.vsTargetPct);
    const wcols: Col<WRow>[] = [
      { key: 'truck', label: t.truck, get: r => `${r.label} (${r.vehicleType})` },
      { key: 'driver', label: t.driver, get: r => r.drivers.join('، ') },
      { key: 'liters', label: t.liters, num: true, get: r => Math.round(r.liters) },
      { key: 'cost', label: `${t.cost} (${t.egp})`, num: true, get: r => Math.round(r.cost) },
      { key: 'km', label: t.trackedKm, num: true, get: r => Math.round(r.trackedKm) },
      { key: 'kml', label: `${t.kmL} · ${t.thisWeek}`, num: true, get: r => r.kmL || null },
      { key: 'prev', label: `${t.kmL} · ${t.lastWeek}`, num: true, get: r => r.prevKmL },
      { key: 'target', label: t.target, num: true, get: r => r.target },
      { key: 'vs', label: t.vsTarget, get: r => pct(r.vsTargetPct) },
      { key: 'over', label: t.overL, num: true, get: r => (r.overMarginL ? Math.round(r.overMarginL) : null) },
      { key: 'loss', label: t.loss, num: true, get: r => (r.lossEgp ? Math.round(r.lossEgp) : null) },
      { key: 'alerts', label: t.alerts, num: true, get: r => r.alerts || null },
    ];
    printFuelReport({
      lang, t: { ...t, reportTitle: t.weeklyTitle }, method: methodText(lang), period: ltr(`${wk} → ${weekEnd(wk)}`), filters: weekEnd(wk) > lastDay ? t.soFar : '',
      kpis: [
        { label: t.liters, value: n0(a.liters), sub: ch(a.liters, b.liters) },
        { label: t.cost, value: `${n0(a.cost)} ${t.egp}`, sub: ch(a.cost, b.cost) },
        { label: t.trackedKm, value: n0(a.km), sub: ch(a.km, b.km) },
        { label: t.fleetKmL, value: n2(a.kmL), sub: `${t.lastWeek} ${n2(b.kmL)}` },
        { label: t.overMargin, value: `${n0(sum(rowsNow, r => r.overMarginL))} ${t.L}`, sub: `${n0(sum(rowsNow, r => r.lossEgp))} ${t.egp}` },
        { label: t.alerts, value: String(wkAlerts.length), sub: `${wkAlerts.filter(x => x.level === 'high').length} ${t.lvl.high}` },
      ],
      tables: [
        toSheet(t.health, healthCols, health),
        toSheet(t.trucks, wcols, wrows),
        toSheet(t.alerts, alertCols, wkAlerts),
        toSheet(t.flagged, [...pick2(fillCols, ['at', 'truck', 'driver', 'dist', 'liters', 'kml', 'target', 'diffL', 'diffE', 'status']), idsCol, whyCol],
          now.segs.filter(s => s.status === 'high' || s.status === 'low')),
      ],
    });
  };
  // The weekly report button gives the last full week (Sat → Fri) in the data; a week still going is in the Weekly tab.
  const lastDay = ((txs || []).reduce((m, x) => (x.at > m ? x.at : m), '') || new Date().toISOString()).slice(0, 10);
  const latestWeek = weekEnd(weekOf(lastDay)) > lastDay && (txs || []).some(x => x.at < weekOf(lastDay))
    ? weekOf(new Date(Date.parse(`${weekOf(lastDay)}T00:00:00Z`) - 86_400_000).toISOString()) : weekOf(lastDay);

  /* ---- actions ---- */
  const onFile = async (file: File) => {
    setBusy(t.uploading);
    try {
      const problems = emptyProblems();
      const rows = await parseFuelWorkbook(file, problems);
      if (!rows.length) {
        const why = problemLines(problems);
        setUploadFail(why.length ? why : [t.foundNone]);
        return;
      }
      const ats = rows.map(x => x.at).sort();
      setPreview({ total: rows.length, ...splitUpload(rows, txs || []), from: day(ats[0]), to: day(ats[ats.length - 1]), rows, problems });
    } catch (e: any) { setToast(String(e?.message || e)); }
    finally { setBusy(''); if (fileRef.current) fileRef.current.value = ''; }
  };
  const problemLines = (p: FileProblems) => [
    ...(p.noHeader ? [t.upNoHeader(p.noHeader.map(c => `«${c}»`).join(lang === 'ar' ? '، ' : ', '))] : []),
    ...(p.skipped.date ? [t.upBadDate(p.skipped.date, p.skipped.dateExample || '')] : []),
    ...(p.skipped.liters ? [t.upBadLiters(p.skipped.liters, p.skipped.litersExample || '')] : []),
    ...(p.skipped.plate ? [t.upNoPlate(p.skipped.plate)] : []),
  ];
  const saveUpload = async () => {
    if (!preview) return;
    setBusy(t.uploading);
    try {
      // Only the new rows: nothing already saved is written again.
      if (preview.fresh.length) await api.saveFuel(preview.fresh, local);
      const all = [...(txs || []), ...preview.fresh];
      setTxs(all);
      // What was checked stays checked. Only a truck-health check is forgotten once the truck is back
      // at its target, so a new drop later shows again instead of hiding behind the old check.
      const stale = staleChecked(truckHealth(computeFuel(all, settings), settings), settings.checkedAlerts || []);
      if (stale.length) {
        const s = { ...settings, checkedAlerts: (settings.checkedAlerts || []).filter(id => !stale.includes(id)) };
        try { await api.saveFuelSettings(s); setSettings(s); } catch { /* the check list is kept as it was */ }
      }
      setToast(t.saved(preview.fresh.length));
      setPreview(null);
    } catch (e: any) { setToast(String(e?.message || e)); }
    finally { setBusy(''); }
  };
  const clearAll = async () => {
    if (window.prompt(t.clearConfirm) !== 'DELETE') return;
    setBusy('…');
    try { await api.deleteFuel((txs || []).map(x => x.id), local); setTxs([]); }
    catch (e: any) { setToast(String(e?.message || e)); }
    finally { setBusy(''); }
  };

  /** Saves one hand-edited transaction (or removes it) and recalculates everything. */
  const saveTx = async (next: FuelTx) => {
    setBusy('…');
    try {
      await api.saveFuel([next], local);
      setTxs((txs || []).map(x => (x.id === next.id ? next : x)));
      setToast(t.txSaved);
      return true;
    } catch (e: any) { setToast(String(e?.message || e)); return false; }
    finally { setBusy(''); }
  };
  const removeTx = async (id: string) => {
    if (!window.confirm(t.deleteTxConfirm)) return;
    setBusy('…');
    try { await api.deleteFuel([id], local); setTxs((txs || []).filter(x => x.id !== id)); setTxOpen(null); setToast(t.txDeleted); }
    catch (e: any) { setToast(String(e?.message || e)); }
    finally { setBusy(''); }
  };

  const filterText = [f.plate, f.driver, f.station, f.type, f.status && (f.status in STATUS_CLS ? statusLabel(t, f.status as SegmentStatus) : t[`st_${f.status}` as const]), f.q].filter(Boolean).join(' · ');
  const period = kpi.from ? ltr(`${day(kpi.from)} → ${day(kpi.to)}`) : '—';
  const idsCol: Col<Segment> = { key: 'ids', label: t.txIds, get: r => segTxIds(r).map(x => `#${x}`).join(' ') };
  const whyCol: Col<Segment> = { key: 'why', label: t.why, get: r => explainSegment(r, settings, result.price, lang).simple.join(' ') };
  const healthCols: Col<TruckHealth>[] = [
    { key: 'truck', label: t.truck, get: r => `${r.plate} (${r.vehicleType})` },
    { key: 'health', label: t.status, get: r => t[`h_${r.status}` as const] },
    { key: 'recent', label: `${t.recent} ${t.kmL}`, num: true, get: r => r.recentKmL || null },
    { key: 'recentKm', label: `${t.recent} ${t.km}`, num: true, get: r => r.recentKm },
    { key: 'target', label: t.target, num: true, get: r => r.target },
    { key: 'vs', label: t.vsTarget, get: r => pct(r.vsTargetPct) },
    { key: 'normal', label: `${t.normal} ${t.kmL}`, num: true, get: r => r.baseKmL || null },
    { key: 'trend', label: t.trend, get: r => pct(r.trendPct) },
    { key: 'why', label: t.whyHealth, get: r => healthSimple(r, lang).join(' ') },
  ];
  const doExcel = () => exportFuelExcel([
    toSheet(t.health, healthCols, health),
    toSheet(t.alerts, alertCols, openAlerts),
    toSheet(t.trucks, truckCols, trucks), toSheet(t.drivers, driverCols, drivers), toSheet(t.fills, [...fillCols, idsCol, whyCol], filtered.segs),
    toSheet(t.transactions, txCols, filtered.views), toSheet(t.weeks, weekCols, weeks), toSheet(t.months, monthCols, months), toSheet(t.stations, stationCols, stations),
  ], lang, t.reportTitle);
  const doPrint = () => printFuelReport({
    lang, t, period, filters: filterText, method: methodText(lang),
    kpis: [
      { label: t.liters, value: n0(kpi.liters) },
      { label: t.cost, value: `${n0(kpi.cost)} ${t.egp}`, sub: `${n2(result.price)} ${t.perLiter}` },
      { label: t.trackedKm, value: n0(kpi.trackedKm) },
      { label: t.fleetKmL, value: n2(kpi.kmL), sub: `${t.target} ${n2(kpi.target)} · ${n1(kpi.kmL ? 100 / kpi.kmL : 0)} ${t.l100}` },
      { label: t.overMargin, value: `${n0(kpi.overL)} ${t.L}`, sub: `${n0(kpi.loss)} ${t.egp}` },
      { label: t.checks, value: String(kpi.outside + kpi.bad), sub: `${kpi.outside} ${t.fillsOutside} · ${kpi.bad} ${t.badReadings}` },
    ],
    tables: [
      toSheet(t.health, healthCols, health),
      toSheet(t.trucks, pick2(truckCols, ['truck', 'fills', 'liters', 'cost', 'km', 'kml', 'l100', 'target', 'vs', 'diffL', 'over', 'loss', 'cardKm', 'kmDiff', 'cardKml', 'bad']).map(c => c.key === 'truck' ? { ...c, get: (r: Summary) => `${r.label} (${r.vehicleType})` } : c), trucks),
      toSheet(t.drivers, pick2(driverCols, ['driver', 'fills', 'liters', 'km', 'kml', 'target', 'vs', 'diffL', 'loss']), drivers),
      toSheet(t.weeks, pick2(weekCols, ['week', 'fills', 'liters', 'cost', 'dL', 'km', 'kml', 'dKml', 'l100', 'vs', 'loss']), [...weeks].reverse()),
      toSheet(t.flagged, [...pick2(fillCols, ['at', 'truck', 'driver', 'dist', 'cardDist', 'liters', 'kml', 'cardKml', 'target', 'diffL', 'diffE', 'status']), idsCol, whyCol],
        filtered.segs.filter(s => s.status === 'high' || s.status === 'low' || s.notes.length)),
      toSheet(t.alerts, alertCols, openAlerts),
    ],
  });

  /* ---- render ---- */
  if (txs === null) return <DaliLoader fullScreen label={<span className="text-xs font-bold text-slate-500">{t.title}</span>} />;
  const hasData = txs.length > 0;
  const views: [View, string, number | null][] = [
    ['home', t.home, null], ['summary', t.summary, truckCards.length], ['alerts', `🔔 ${t.alerts}`, openAlerts.length], ['trucks', t.trucks, trucks.length], ['drivers', t.drivers, drivers.length], ['fills', t.fills, filtered.segs.length],
    ['tx', t.transactions, filtered.views.length], ['weeks', t.weeks, weeks.length], ['months', t.months, months.length], ['stations', t.stations, stations.length], ['settings', t.settings, null],
  ];
  const statusOptions: [StatusFilter, string][] = [
    ['ok', t.st_ok], ['high', t.st_high], ['low', t.st_low], ['pending', t.st_pending],
    ['badKm', t.st_badKm], ['split', t.st_split], ['partial', t.st_partial], ['reversed', t.st_reversed],
  ];
  const anyFilter = JSON.stringify(f) !== JSON.stringify(NO_FILTERS);
  const activeFilters = (Object.keys(NO_FILTERS) as (keyof Filters)[]).filter(k => k !== 'q' && f[k] !== NO_FILTERS[k]).length;
  const filterFields = (
    <>
              <label className="flex items-center gap-1 text-[10px] font-black text-slate-500">{t.from}<input type="date" className={`${inputCls} w-full min-w-0`} value={f.from} onChange={e => set({ from: e.target.value })} /></label>
              <label className="flex items-center gap-1 text-[10px] font-black text-slate-500">{t.to}<input type="date" className={`${inputCls} w-full min-w-0`} value={f.to} onChange={e => set({ to: e.target.value })} /></label>
              <select className={inputCls} value={f.plate} onChange={e => set({ plate: e.target.value })}><option value="">{t.allTrucks}</option>{options.plates.map(x => <option key={x}>{x}</option>)}</select>
              <select className={inputCls} value={f.driver} onChange={e => set({ driver: e.target.value })}><option value="">{t.allDrivers}</option>{options.drivers.map(x => <option key={x}>{x}</option>)}</select>
              <select className={inputCls} value={f.station} onChange={e => set({ station: e.target.value })}><option value="">{t.allStations}</option>{options.stations.map(x => <option key={x}>{x}</option>)}</select>
              <select className={inputCls} value={f.type} onChange={e => set({ type: e.target.value })}><option value="">{t.allTypes}</option>{options.types.map(x => <option key={x}>{x}</option>)}</select>
              <select className={inputCls} value={f.status} onChange={e => set({ status: e.target.value as StatusFilter })}><option value="">{t.anyStatus}</option>{statusOptions.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
    </>
  );
  const moreViews: View[] = ['trucks', 'drivers', 'fills', 'tx', 'months', 'stations', 'settings'];
  const tabs: [View | 'more', string, string, number | null][] = [
    ['home', '⌂', t.home, null], ['alerts', '🔔', t.alerts, urgent || null], ['summary', '📊', t.summary, null], ['weeks', '🗓', t.weeks, null], ['more', '☰', t.more, null],
  ];
  const renderAlert = (a: FuelAlert) => {
                const done = isChecked(a, checked);
                return (
                  <Card key={a.id} className={`!p-3.5 ${done ? 'opacity-50' : ''}`}>
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${LEVEL_CLS[a.level]}`}>{t.lvl[a.level]}</span>
                          <b className="text-sm text-[#07111f]">{t.kind[a.kind]}</b>
                          <span className="text-xs font-bold text-[#07111f]">{a.plate}</span>
                          <span className="text-[11px] text-slate-500">{a.driver}</span>
                          <span dir="ltr" className="text-[11px] text-slate-400">{when(a.at)}</span>
                          {done && <Chip>✓ {t.checkedBy}</Chip>}
                        </div>
                        <p className="mt-1.5 text-xs leading-5 text-slate-600">{t.alertText(a)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 border-t border-[#f1ebe0] pt-2.5 sm:border-0 sm:pt-0">
                        {a.egp > 0 && <span className="me-auto text-sm font-black tabular-nums text-red-600 sm:me-0">{n0(a.egp)} <span className="text-[10px] text-slate-400">{t.egp}</span></span>}
                        {a.kind !== 'idle' && <button className={btnGhost} onClick={() => openAlert(a)}>↗</button>}
                        {isAdmin && <button className={btnGhost} onClick={() => toggleChecked(done ? storedIds(a, checked) : checkIds(a), !done)}>{done ? t.undoChecked : `✓ ${t.markChecked}`}</button>}
                      </div>
                    </div>
                  </Card>
                );
  };
  const viewLabel = (views.find(v => v[0] === view) || [view, view === 'truck' ? truckPlate : t.home, null]) as [View, string, number | null];

  return (
    <div className="md:flex md:items-start md:gap-7">
      {/* Desktop: fixed side menu with an edge arrow to hide/show it. Phones use the bottom tab bar. */}
      {hasData && (
        <SideNav mobile={isMobile} title={t.tab} icon="⛽" dir={lang === 'ar' ? 'rtl' : 'ltr'} active={view} onSelect={k => setView(k as View)}
          hideLabel={lang === 'ar' ? 'إخفاء القائمة' : 'Hide menu'} showLabel={lang === 'ar' ? 'إظهار القائمة' : 'Show menu'}
          items={views.map(([k, label, count]) => ({ key: k, label: label.replace(/^🔔 /, ''), badge: count, icon: VIEW_ICON[k] }))} />
      )}
    <div className="min-w-0 flex-1 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black uppercase italic tracking-tight text-[#07111f] sm:text-2xl">{t.title}</h1>
          <p className="mt-1 hidden max-w-2xl text-xs text-slate-500 sm:block">{t.sub}</p>
          {local && <div role="alert" className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
            {lang === 'ar'
              ? 'وضع محلي: جدول الوقود غير متاح على قاعدة البيانات. البيانات المعروضة محفوظة في هذا المتصفح فقط وقد لا تظهر على الأجهزة الأخرى.'
              : 'LOCAL MODE: the Fuel database table is unavailable. Fuel records are stored in this browser only and may not appear on other devices.'}
          </div>}
        </div>
        <div className={`flex-wrap gap-2 ${hasData ? 'hidden md:flex' : 'flex'}`}>
          {isAdmin && <button className={btnGold} disabled={!!busy} onClick={() => fileRef.current?.click()}>⬆ {t.upload}</button>}
          {hasData && <button className={btnGhost} onClick={doExcel}>⬇ {t.exportXls}</button>}
          {hasData && <button className={btnNavy} onClick={doPrint}>🖨 {t.print}</button>}
          {hasData && <button className={btnNavy} onClick={() => weeklyReport(latestWeek)} title={`${latestWeek} → ${weekEnd(latestWeek)}`}>🗓 {t.weeklyReport}</button>}
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) onFile(file); }} />
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</div>}
      {local && isAdmin && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-900">{t.localNote}</div>}
      {busy && <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><DaliLoader size={18} />{busy}</div>}

      {!hasData ? (
        <Card className="py-14 text-center">
          <div className="text-4xl">⛽</div>
          <p className="mx-auto mt-3 max-w-md text-sm font-bold text-slate-600">{isAdmin ? t.empty : t.emptyViewer}</p>
          {isAdmin && <button className={`${btnGold} mt-5`} onClick={() => fileRef.current?.click()}>⬆ {t.upload}</button>}
        </Card>
      ) : (
        <>
          {/* Filters */}
          {isMobile ? (
            <div className="flex items-center gap-2">
              <input className={`${inputCls} min-w-0 flex-1 !py-2.5`} type="search" placeholder={t.search} value={f.q} onChange={e => set({ q: e.target.value })} />
              <button className={`${activeFilters ? btnNavy : btnGhost} !px-3 !py-2.5 whitespace-nowrap`} onClick={() => setSheet('filters')} data-tab="filters">⚙ {t.filters}{activeFilters ? ` (${activeFilters})` : ''}</button>
            </div>
          ) : (
          <Card className="!p-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-9">
              <input className={`${inputCls} col-span-2`} placeholder={t.search} value={f.q} onChange={e => set({ q: e.target.value })} />
              {filterFields}
              {anyFilter && <button className={`${btnGhost} justify-center`} onClick={() => setF(NO_FILTERS)}>✕ {t.clear}</button>}
            </div>
          </Card>
          )}

          {urgent > 0 && view !== 'alerts' && (
            <button onClick={() => setView('alerts')} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-start">
              <span className="flex items-center gap-2 text-sm font-black text-red-700">🔔 {t.alertsBanner(urgent)}
                <span className="hidden text-xs font-bold text-red-600/80 sm:inline">· {[...new Set(openAlerts.filter(a => a.level !== 'low').map(a => t.kind[a.kind]))].slice(0, 3).join(' · ')}</span></span>
              <span className="whitespace-nowrap text-xs font-black text-red-700">{t.openAlerts} <span className="inline-block rtl:rotate-180">→</span></span>
            </button>
          )}

          {view === 'home' && <>
          {/* Truck health: the main question, is each truck still doing its normal km/L? */}
          <Card>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-xs font-black uppercase tracking-[.2em] text-[#07111f]">{t.health}</div>
              <div className="text-[11px] text-slate-500">{t.healthHint(HEALTH_KM)}</div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-5">
              {health.filter(h => (!f.plate || h.plate === f.plate) && (!f.type || h.vehicleType === f.type)).map(h => (
                <button key={h.plate} onClick={() => openTruck(h.plate)}
                  className={`rounded-xl border p-3 text-start transition hover:border-[#c2a378] ${HEALTH_CLS[h.status]}`}>
                  <div className="flex items-center justify-between gap-2">
                    <b className="truncate text-sm text-[#07111f]">{h.plate}</b>
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-black ${HEALTH_PILL[h.status]}`}>{t[`h_${h.status}` as const]}</span>
                  </div>
                  <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-2">
                    <div><div className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-slate-500">{t.recent}
                      <span role="button" tabIndex={0} aria-label={t.whyHealth} title={t.whyHealth} onClick={e => { e.stopPropagation(); setExplain({ plate: h.plate }); }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setExplain({ plate: h.plate }); } }}
                        style={{ minHeight: 0 }} className="grid h-5 w-5 place-items-center rounded-full bg-white text-[11px] font-black normal-case text-[#07111f] ring-1 ring-[#d9d0c0]">?</span></div><div className="text-xl font-black tabular-nums text-[#07111f]">{n2(h.recentKmL)}</div></div>
                    <div className="text-[10px] leading-4 text-slate-500 sm:text-end">
                      <div>{t.target} {n2(h.target)} <b className={h.vsTargetPct < -settings.marginPct ? 'text-red-600' : ''}>{pct(h.vsTargetPct)}</b></div>
                      <div>{t.normal} {n2(h.baseKmL)} <b className={h.trendPct <= -settings.marginPct ? 'text-red-600' : h.trendPct < 0 ? 'text-amber-700' : 'text-emerald-700'}>{h.trendPct < 0 ? '▼' : h.trendPct > 0 ? '▲' : ''} {pct(h.trendPct)}</b></div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label={t.liters} value={n0(kpi.liters)} sub={<span dir="ltr">{period}</span>} />
            <Kpi label={t.cost} value={`${n0(kpi.cost)}`} unit={t.egp} sub={`${n2(result.price)} ${t.perLiter}${settings.price ? '' : ` (${t.auto})`}`} />
            <Kpi label={t.charged} value={n0(kpi.charged)} unit={t.egp} sub={`${ltr(`+${n0(kpi.fees)}`)} ${t.fees}`} />
            <Kpi label={t.fleetKmL} value={n2(kpi.kmL)} tone={kpi.kmL && kpi.kmL < kpi.target * (1 - settings.marginPct / 100) ? 'red' : 'navy'}
              sub={`${t.target} ${n2(kpi.target)} ${ltr(`± ${settings.marginPct}%`)} · ${n1(kpi.kmL ? 100 / kpi.kmL : 0)} ${t.l100}`} />
            <Kpi label={t.overMargin} value={n0(kpi.overL)} unit={t.L} tone={kpi.overL ? 'red' : 'navy'} sub={`${n0(kpi.loss)} ${t.egp}`} />
            <Kpi label={t.checks} value={String(kpi.outside + kpi.bad)} tone={kpi.outside + kpi.bad ? 'amber' : 'navy'} sub={`${kpi.outside} ${t.fillsOutside} · ${kpi.bad} ${t.badReadings}`} />
          </div>

          {/* Card vs actual */}
          <Card>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-xs font-black uppercase tracking-[.2em] text-[#07111f]">{t.cardVsActual}</div>
              <div className="text-[11px] text-slate-500">{t.cardVsActualHint}</div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
              <Compare label={t.km} card={n0(kpi.cardKm)} actual={n0(kpi.trackedKm)} diff={signed(kpi.cardKm - kpi.trackedKm)} bad={Math.abs(kpi.cardKm - kpi.trackedKm) > 100} t={t} />
              <Compare label={t.kmL} card={n2(kpi.cardKmL)} actual={n2(kpi.kmL)} diff={signed(kpi.cardKmL - kpi.kmL, n2)} bad={Math.abs(kpi.cardKmL - kpi.kmL) > 0.1} t={t} />
              <Compare label={t.l100} card={n1(kpi.cardKmL ? 100 / kpi.cardKmL : 0)} actual={n1(kpi.kmL ? 100 / kpi.kmL : 0)} diff={signed((kpi.cardKmL ? 100 / kpi.cardKmL : 0) - (kpi.kmL ? 100 / kpi.kmL : 0), n1)} bad={false} t={t} />
              <div className="rounded-xl bg-[#f8f5ef] p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-[#8a7350]">{t.cardWrong}</div>
                <div className="mt-1 text-2xl font-black tabular-nums text-[#07111f]">{kpi.cardWrong}</div>
                <div className="text-[10px] text-slate-500">{filtered.fills.filter(x => x.txs.length > 1).length} {t.st_split.toLowerCase()} · {filtered.segs.filter(s => s.notes.includes('partial') || s.notes.includes('paired')).length} {t.st_partial.toLowerCase()}</div>
              </div>
            </div>
          </Card>

          </>}

          {/* Views */}
          {view !== 'home' && view !== 'truck' && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <h2 className="text-base font-black uppercase tracking-wide text-[#07111f] md:text-lg">{!isMobile && VIEW_ICON[view] ? `${VIEW_ICON[view]} ` : ''}{viewLabel[1].replace(/^🔔 /, '')}</h2>
              {viewLabel[2] != null && <span className="rounded-full bg-[#07111f] px-2.5 py-0.5 text-[11px] font-black text-white">{viewLabel[2]}</span>}
            </div>
          )}

          {view === 'alerts' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
                <select className={inputCls} value={af.level} onChange={e => setAf({ ...af, level: e.target.value as '' | AlertLevel })}>
                  <option value="">{t.allLevels}</option>{(['high', 'medium', 'low'] as AlertLevel[]).map(l => <option key={l} value={l}>{t.lvl[l]}</option>)}
                </select>
                <select className={inputCls} value={af.kind} onChange={e => setAf({ ...af, kind: e.target.value as '' | AlertKind })}>
                  <option value="">{t.allKinds}</option>{(Object.keys(t.kind) as AlertKind[]).map(k => <option key={k} value={k}>{t.kind[k]} ({alerts.filter(a => a.kind === k && alertOk(a) && (af.showChecked || !isChecked(a, checked))).length})</option>)}
                </select>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={af.showChecked} onChange={e => setAf({ ...af, showChecked: e.target.checked })} />{t.showChecked}</label>
              </div>
              {!shownAlerts.length ? (
                <div className="rounded-xl border border-dashed border-[#d9d0c0] p-8 text-center text-sm font-bold text-slate-500">✓ {t.noAlerts}</div>
              ) : shownAlerts.slice(0, 300).map(renderAlert)}
            </div>
          )}
          {view === 'summary' && <>
            <p className="text-[11px] font-bold leading-5 text-slate-500">ⓘ {t.summarySub(thisWeek ? `${thisWeek} → ${weekEnd(thisWeek)}` : '—', lastAt ? when(lastAt) : '—')}</p>
            {!truckCards.length && <div className="rounded-xl border border-dashed border-[#d9d0c0] p-8 text-center text-sm font-bold text-slate-500">{t.noMatch}</div>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {truckCards.map(c => {
                const hs = c.health?.status || 'noData';
                const wkKmL = c.week?.kmL || 0, pvKmL = c.prev?.kmL || 0;
                return (
                  <button key={c.plate} onClick={() => openTruck(c.plate)} data-truck={c.plate}
                    className={`rounded-2xl border p-4 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-[#c2a378] hover:shadow-md ${HEALTH_CLS[hs]}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><b className="block truncate text-base text-[#07111f]">{c.plate}</b>
                        <div className="truncate text-[10px] text-slate-500">{c.all.vehicleType} · {c.all.drivers.slice(-2).join('، ')}</div>
                        {vehicleOf(settings, c.plate) && <div className="text-[10px] font-bold leading-4 text-[#8a7350]">{vehicleLine(vehicleOf(settings, c.plate)!)}</div>}</div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-black ${HEALTH_PILL[hs]}`}>{t[`h_${hs}` as const]}</span>
                        {c.open > 0 && <span className="whitespace-nowrap rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-700 ring-1 ring-red-200">🔔 {t.openAlertsN(c.open)}</span>}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-white/80 p-2.5 ring-1 ring-[#eee7da]">
                        <div className="text-[9px] font-black uppercase tracking-widest text-[#8a7350]">{t.overall}</div>
                        <div className="text-2xl font-black tabular-nums text-[#07111f]">{n2(c.all.kmL)}</div>
                        <div className="text-[10px] text-slate-500">{t.target} {n2(c.all.target)} <b className={c.all.status === 'high' ? 'text-red-600' : c.all.vsTargetPct < 0 ? 'text-amber-700' : 'text-emerald-700'}>{pct(c.all.vsTargetPct)}</b></div>
                        <div className="text-[10px] text-slate-400">{n0(c.all.trackedKm)} {t.km} · {n0(c.all.liters)} {t.L}</div>
                      </div>
                      <div className="rounded-xl bg-white/80 p-2.5 ring-1 ring-[#eee7da]">
                        <div className="text-[9px] font-black uppercase tracking-widest text-[#8a7350]">{t.thisWeek}</div>
                        {wkKmL ? <>
                          <div className="text-2xl font-black tabular-nums text-[#07111f]">{n2(wkKmL)}</div>
                          <div className="text-[10px] text-slate-500">{t.lastWeek} {n2(pvKmL)} {pvKmL ? <b className={wkKmL < pvKmL ? 'text-red-600' : 'text-emerald-700'}>{wkKmL < pvKmL ? '▼' : '▲'} {pct(round1((wkKmL / pvKmL - 1) * 100))}</b> : null}</div>
                          <div className="text-[10px] text-slate-400">{n0(c.week?.trackedKm)} {t.km} · {n0(c.week?.liters)} {t.L}</div>
                        </> : <div className="mt-1 text-[11px] font-bold leading-4 text-slate-400">{t.noFillWeek}{c.week?.liters ? ` · ${n0(c.week.liters)} ${t.L}` : ''}</div>}
                      </div>
                    </div>
                    {c.last && <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 border-t border-[#eee7da] pt-2 text-[10px] text-slate-500">
                      <span><b className="text-[#07111f]">{t.lastFill}</b> <span dir="ltr">{when(c.last.at)}</span> · {n0(c.last.liters)} {t.L}</span>
                      <span className={c.days >= (settings.idleDays || 99) ? 'font-black text-red-600' : ''}>{t.daysAgo(c.days)}</span>
                    </div>}
                  </button>
                );
              })}
            </div>
          </>}

          {view === 'truck' && (truck ? <>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <button className={`${btnGhost} !px-3`} onClick={() => setView('summary')}><span className="inline-block rtl:rotate-180">←</span> {t.allTrucks2}</button>
                <h2 className="text-lg font-black text-[#07111f]">🚛 {truck.plate}</h2>
              </div>
              <span className="text-[11px] text-slate-500">{truck.all.vehicleType} · {truck.all.drivers.join('، ')}</span>
            </div>
            {vehicleOf(settings, truck.plate) && <div className="flex flex-wrap gap-2">
              {([[t.assignedDriver, vehicleOf(settings, truck.plate)!.driver], [t.branch, vehicleOf(settings, truck.plate)!.branch], [t.model, vehicleOf(settings, truck.plate)!.model], [t.year, vehicleOf(settings, truck.plate)!.year]] as const).filter(([, v]) => v).map(([k, v]) => (
                <span key={k} className="rounded-full bg-white px-3 py-1 text-[11px] text-slate-500 ring-1 ring-[#eee7da]">{k}: <b dir="auto" className="text-[#07111f]">{v}</b></span>
              ))}
            </div>}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Kpi label={t.overall} value={n2(truck.all.kmL)} unit={t.kmL} tone={truck.all.status === 'high' ? 'red' : 'navy'} sub={<>{t.target} {n2(truck.all.target)} {pct(truck.all.vsTargetPct)}</>} />
              <Kpi label={t.thisWeek} value={n2(truck.card?.week?.kmL || 0)} unit={t.kmL} sub={<>{t.lastWeek} {n2(truck.card?.prev?.kmL || 0)}</>} />
              <Kpi label={t.recent} value={n2(truck.card?.health?.recentKmL || 0)} unit={t.kmL} tone={truck.card?.health?.status === 'service' ? 'red' : truck.card?.health?.status === 'watch' ? 'amber' : 'navy'}
                sub={truck.card?.health ? t[`h_${truck.card.health.status}` as const] : ''} />
              <Kpi label={t.kmTotal} value={n0(truck.all.trackedKm)} unit={t.km} sub={`${truck.all.fillCount} ${t.fillsDone}`} />
              <Kpi label={t.liters} value={n0(truck.all.liters)} unit={t.L} sub={`${n0(truck.all.cost)} ${t.egp}`} />
              <Kpi label={t.lastFill} value={truck.card?.last ? truck.card.last.at.slice(5, 10) : '—'} sub={<>{truck.card?.first ? <span dir="ltr">{t.firstFill} {truck.card.first.at.slice(0, 10)}</span> : null}</>} />
            </div>
            <p className="text-[10px] text-slate-400">ⓘ {t.overallHint}</p>
            <div role="tablist" className="flex gap-1 overflow-x-auto rounded-2xl bg-[#f1ebe0] p-1">
              {([['fills', t.fills, truck.data.segs.length], ['tx', t.transactions, truck.views.length], ['weeks', t.weeks, truck.weeks.length], ['months', t.months, truck.months.length], ['alerts', t.alerts, truck.alerts.filter(a => !isChecked(a, checked)).length]] as const).map(([k, label, count]) => (
                <button key={k} role="tab" aria-selected={truckTab === k} onClick={() => setTruckTab(k)}
                  className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-black transition ${truckTab === k ? 'bg-[#07111f] text-white shadow' : 'text-[#07111f]/70 hover:bg-white/60'}`}>
                  {label}<span className={`rounded-full px-1.5 text-[10px] ${truckTab === k ? 'bg-[#c2a378] text-[#07111f]' : 'bg-white'}`}>{count}</span>
                </button>
              ))}
            </div>
            {(truckTab === 'fills' || truckTab === 'tx') && <p className="text-[11px] font-bold text-slate-500">ⓘ {t.tapHint}</p>}
            {truckTab === 'fills' && <DataTable onRow={r => setExplain({ seg: r.key })} sortLabel={t.sort} mobile={{ title: 'at', badge: 'status', stats: ['dist', 'liters', 'kml', 'target', 'diffL', 'cardKml'], foot: 'notes' }} rows={truck.data.segs} cols={fillCols} rowKey={r => r.key} initial={{ key: 'at', dir: -1 }} empty={t.noMatch}
              highlight={r => r.status === 'high' ? 'bg-red-50/40' : r.status === 'low' ? 'bg-amber-50/40' : ''} />}
            {truckTab === 'tx' && <DataTable onRow={r => setTxOpen(r.tx.id)} sortLabel={t.sort} mobile={{ title: 'at', stats: ['liters', 'amount', 'odo', 'ourKm', 'ourKml', 'station'], foot: 'flags' }} rows={truck.views} cols={txCols} rowKey={r => r.tx.id} initial={{ key: 'at', dir: -1 }} empty={t.noMatch} />}
            {truckTab === 'weeks' && <DataTable sortLabel={t.sort} mobile={{ title: 'week', badge: 'status', stats: ['liters', 'dL', 'km', 'kml', 'dKml', 'loss'] }} rows={truck.weeks} cols={weekCols} rowKey={r => r.key} initial={{ key: 'week', dir: -1 }} empty={t.noMatch}
              highlight={r => r.status === 'high' ? 'bg-red-50/40' : ''} />}
            {truckTab === 'months' && <DataTable sortLabel={t.sort} mobile={{ title: 'month', stats: ['liters', 'cost', 'km', 'kml', 'vs', 'loss'] }} rows={truck.months} cols={monthCols} rowKey={r => r.key} initial={{ key: 'month', dir: -1 }} empty={t.noMatch} />}
            {truckTab === 'alerts' && <div className="space-y-2">{truck.alerts.length ? truck.alerts.slice(0, 200).map(renderAlert)
              : <div className="rounded-xl border border-dashed border-[#d9d0c0] p-8 text-center text-sm font-bold text-slate-500">✓ {t.noAlerts}</div>}</div>}
          </> : <div className="rounded-xl border border-dashed border-[#d9d0c0] p-8 text-center text-sm font-bold text-slate-500">
            {t.noMatch} <button className={`${btnGhost} ms-2`} onClick={() => setView('summary')}>{t.allTrucks2}</button></div>)}

          {view === 'trucks' && <DataTable sortLabel={t.sort} mobile={{ title: 'truck', badge: 'status', stats: ['kml', 'target', 'vs', 'liters', 'cost', 'loss'] }} rows={trucks} cols={truckCols} rowKey={r => r.key} initial={{ key: 'vs', dir: 1 }} empty={t.noMatch}
            onRow={r => openTruck(r.key)} highlight={r => r.status === 'high' ? 'bg-red-50/40' : ''} />}
          {view === 'drivers' && <DataTable sortLabel={t.sort} mobile={{ title: 'driver', badge: 'status', stats: ['kml', 'target', 'vs', 'liters', 'km', 'loss'] }} rows={drivers} cols={driverCols} rowKey={r => r.key} initial={{ key: 'vs', dir: 1 }} empty={t.noMatch}
            onRow={r => { set({ driver: r.key === '—' ? '' : r.key }); setView('fills'); }} />}
          {(view === 'fills' || view === 'tx') && <p className="text-[11px] font-bold text-slate-500">ⓘ {t.tapHint}</p>}
          {view === 'fills' && <DataTable onRow={r => setExplain({ seg: r.key })} sortLabel={t.sort} mobile={{ title: 'truck', sub: 'at', badge: 'status', stats: ['dist', 'liters', 'kml', 'target', 'diffL'], foot: 'notes' }} rows={filtered.segs} cols={fillCols} rowKey={r => r.key} initial={{ key: 'at', dir: -1 }} empty={t.noMatch}
            highlight={r => r.status === 'high' ? 'bg-red-50/40' : r.status === 'low' ? 'bg-amber-50/40' : ''} />}
          {view === 'tx' && <DataTable onRow={r => setTxOpen(r.tx.id)} sortLabel={t.sort} mobile={{ title: 'truck', sub: 'at', stats: ['liters', 'amount', 'odo', 'ourKm', 'ourKml', 'station'], foot: 'flags' }} rows={filtered.views} cols={txCols} rowKey={r => r.tx.id} initial={{ key: 'at', dir: -1 }} empty={t.noMatch}
            highlight={r => r.flags.includes('reversal') || r.flags.includes('reversed') ? 'opacity-60 line-through decoration-red-300' : ''} />}
          {view === 'weeks' && <DataTable sortLabel={t.sort} mobile={{ title: 'week', badge: 'status', stats: ['liters', 'dL', 'km', 'kml', 'dKml', 'loss'], foot: 'print' }} rows={weeks} cols={[...weekCols, { key: 'print', label: '🖨', get: () => null, render: r => <button className="rounded-lg px-2 py-1 hover:bg-[#f1ebe0]" title={t.weeklyReport} onClick={e => { e.stopPropagation(); weeklyReport(r.key); }}>🖨{isMobile ? ` ${t.weeklyReport}` : ''}</button> }]} rowKey={r => r.key} initial={{ key: 'week', dir: -1 }} empty={t.noMatch}
            onRow={r => { set({ from: r.key, to: weekEnd(r.key) }); setView('fills'); }} highlight={r => r.status === 'high' ? 'bg-red-50/40' : ''} />}
          {view === 'months' && <DataTable sortLabel={t.sort} mobile={{ title: 'month', stats: ['liters', 'cost', 'km', 'kml', 'vs', 'loss'] }} rows={months} cols={monthCols} rowKey={r => r.key} initial={{ key: 'month', dir: -1 }} empty={t.noMatch} />}
          {view === 'stations' && <DataTable sortLabel={t.sort} mobile={{ title: 'station', stats: ['count', 'trucks', 'liters', 'cost', 'share'] }} rows={stations} cols={stationCols} rowKey={r => r.station} initial={{ key: 'liters', dir: -1 }} empty={t.noMatch}
            onRow={r => { set({ station: r.station === '—' ? '' : r.station }); setView('tx'); }} />}
          {view === 'settings' && <SettingsPanel t={t} lang={lang} isAdmin={isAdmin} settings={settings} result={result} plates={options.plates} types={options.types}
            onSave={async s => { try { await api.saveFuelSettings(s); setSettings(s); setToast('✓'); } catch (e: any) { setToast(String(e?.message || e)); } }} />}

          {isAdmin && !isMobile && <div className="pt-2 text-end"><button className="text-[11px] font-bold text-red-600 hover:underline" onClick={clearAll}>{t.clearAll}</button></div>}
        </>
      )}

      {isMobile && hasData && (
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 bg-[#07111f]/95 px-1 pt-1.5 text-white backdrop-blur-xl pb-[calc(0.4rem+env(safe-area-inset-bottom))]">
          {tabs.map(([k, icon, label, badge]) => {
            const on = k === 'more' ? (sheet === 'more' || moreViews.includes(view)) : view === k && sheet !== 'more';
            return (
              <button key={k} data-tab={k} onClick={() => { if (k === 'more') setSheet(sheet === 'more' ? '' : 'more'); else { setSheet(''); setView(k); } }}
                className={`relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-black transition ${on ? 'text-[#c2a378]' : 'text-white/60'}`}>
                <span className="text-lg leading-none">{icon}</span>
                <span className="max-w-full truncate px-0.5">{label}</span>
                {badge != null && <span className="absolute end-[18%] top-0.5 min-w-[18px] rounded-full bg-red-500 px-1 text-[10px] leading-[18px] text-white">{badge}</span>}
                {on && <span className="absolute -top-1.5 h-0.5 w-8 rounded-full bg-[#c2a378]" />}
              </button>
            );
          })}
        </nav>
      )}

      {isMobile && sheet && (
        <div className="fixed inset-0 z-[45] flex items-end bg-[#07111f]/50" onClick={() => setSheet('')}>
          <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}
            className="max-h-[80vh] w-full overflow-y-auto rounded-t-3xl bg-white px-4 pt-2 shadow-2xl pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[#e3dccf]" />
            {sheet === 'more' ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {views.filter(v => moreViews.includes(v[0])).map(([k, label, count]) => (
                    <button key={k} data-tab={k} onClick={() => { setView(k); setSheet(''); }}
                      className={`flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border p-2 text-center text-[11px] font-black ${view === k ? 'border-[#07111f] bg-[#07111f] text-white' : 'border-[#e3dccf] bg-[#fbf8f2] text-[#07111f]'}`}>
                      <span className="leading-tight">{label}</span>
                      {count != null && <span className={`rounded-full px-2 text-[10px] ${view === k ? 'bg-[#c2a378] text-[#07111f]' : 'bg-white'}`}>{count}</span>}
                    </button>
                  ))}
                </div>
                <div className="mt-5 text-[10px] font-black uppercase tracking-[.2em] text-slate-400">{t.actions}</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {isAdmin && <button className={`${btnGold} justify-center !py-3`} disabled={!!busy} onClick={() => { setSheet(''); fileRef.current?.click(); }}>⬆ {t.upload}</button>}
                  <button className={`${btnNavy} justify-center !py-3`} onClick={() => { setSheet(''); weeklyReport(latestWeek); }}>🗓 {t.weeklyReport}</button>
                  <button className={`${btnNavy} justify-center !py-3`} onClick={() => { setSheet(''); doPrint(); }}>🖨 {t.print}</button>
                  <button className={`${btnGhost} justify-center !py-3`} onClick={() => { setSheet(''); doExcel(); }}>⬇ {t.exportXls}</button>
                </div>
                {isAdmin && <div className="mt-4 text-center"><button className="text-[11px] font-bold text-red-600" onClick={() => { setSheet(''); clearAll(); }}>{t.clearAll}</button></div>}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-base font-black text-[#07111f]">⚙ {t.filters}</div>
                  {anyFilter && <button className="text-xs font-black text-red-600" onClick={() => setF(NO_FILTERS)}>✕ {t.clear}</button>}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2.5 [&_input]:!py-2.5 [&_select]:!py-2.5">{filterFields}</div>
                <button className={`${btnNavy} mt-4 w-full justify-center !py-3`} onClick={() => setSheet('')}>{t.done}</button>
              </>
            )}
          </div>
        </div>
      )}

      {explain && (() => {
        const seg = explain.seg ? result.segments.find(x => x.key === explain.seg) : undefined;
        const h = explain.plate ? health.find(x => x.plate === explain.plate) : undefined;
        if (!seg && !h) return null;
        const ex = seg ? explainSegment(seg, settings, result.price, lang) : null;
        const tone = seg ? (seg.status === 'high' ? 'border-red-200 bg-red-50 text-red-800' : seg.status === 'low' ? 'border-amber-200 bg-amber-50 text-amber-900' : seg.status === 'pending' ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-emerald-200 bg-emerald-50 text-emerald-900')
          : h!.status === 'service' ? 'border-red-200 bg-red-50 text-red-800' : h!.status === 'watch' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900';
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#07111f]/60 sm:items-center sm:p-4" onClick={() => setExplain(null)}>
            <div role="dialog" aria-modal="true" aria-label={t.howCalc} onClick={e => e.stopPropagation()}
              className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[.2em] text-[#8a7350]">{seg ? t.howCalc : t.whyHealth}</div>
                  <div className="mt-1 text-lg font-black text-[#07111f]">{seg ? seg.plate : h!.plate} <span className="text-xs font-bold text-slate-500">{seg ? seg.driver : h!.vehicleType}</span></div>
                  {seg && <div className="text-[11px] text-slate-500" dir="ltr">{when(seg.fromAt)} → {when(seg.at)}</div>}
                </div>
                <div className="flex items-center gap-2">
                  {seg ? <Badge t={t} s={seg.status} /> : <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-black ${HEALTH_PILL[h!.status]}`}>{t[`h_${h!.status}` as const]}</span>}
                  <button className={`${btnGhost} !px-3`} onClick={() => setExplain(null)} aria-label={t.close}>✕</button>
                </div>
              </div>
              {/* Simple version first: a few short lines anyone can read. */}
              <div className={`mt-4 space-y-1.5 rounded-2xl border p-4 text-[15px] font-bold leading-7 ${tone}`}>
                {(ex ? ex.simple : healthSimple(h!, lang)).map((line, i) => <p key={i}>{line}</p>)}
              </div>
              {seg && (() => {
                const start = fillByAtPlate.get(`${seg.plate}|${seg.fromAt}`);
                const rows = seg.fills.flatMap((fl, fi) => fl.txs.map((x, xi) => {
                  const fixed = fl.fixedKm.find(k => k.from === x.km);
                  const bad = fl.badKm.some(k => k.km === x.km);
                  const roles = [
                    ...(fl.txs.length > 1 && xi > 0 ? [t.roleSplit] : []),
                    ...((seg.notes.includes('partial') || seg.notes.includes('paired')) && fi < seg.fills.length - 1 && xi === fl.txs.length - 1 ? [t.rolePartial] : []),
                    ...(fixed ? [t.roleFixed] : []), ...(bad ? [t.roleBad] : []),
                    ...(fi === seg.fills.length - 1 && xi === fl.txs.length - 1 ? [t.roleClose] : []),
                  ];
                  return { x, fixed, bad, roles };
                }));
                const merged = rows.length > 1;
                return (
                  <details className={`mt-3 overflow-hidden rounded-2xl border ${merged ? 'border-sky-200' : 'border-[#e3dccf]'}`}>
                    <summary className={`flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-[11px] font-black ${merged ? 'bg-sky-50 text-sky-900' : 'bg-[#fbf8f2] text-[#07111f]'}`}>
                      <span>🔗 {t.mergedRef}<span className="ms-1 font-bold text-slate-500">· {t.tapTxHint}</span></span>{merged && <span className="shrink-0 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] text-white">{t.mergedHint(rows.length)}</span>}
                    </summary>
                    <div className="divide-y divide-[#f1ebe0] text-[12px]">
                      <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 text-slate-600">
                        <div><b className="text-[#07111f]">{t.startRow}</b>{start && <span dir="ltr" className="ms-2 text-[11px]">#{start.txs.map(x => x.id).join(' #')}</span>}<div dir="ltr" className="text-[11px] text-start">{when(seg.fromAt)}</div></div>
                        <div className="text-end"><div className="text-[9px] font-bold uppercase text-slate-400">{t.odometer}</div><b dir="ltr" className="tabular-nums text-[#07111f]">{n0(seg.fromKm)}</b></div>
                      </div>
                      {rows.map(({ x, fixed, bad, roles }) => (
                        <div key={x.id} role="button" tabIndex={0} onClick={() => setTxOpen(x.id)} onKeyDown={e => { if (e.key === 'Enter') setTxOpen(x.id); }}
                          className="cursor-pointer px-3 py-2 hover:bg-[#fbf8f2] active:bg-[#f6f1e7]" style={{ minHeight: 0 }}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0"><b dir="ltr" className="text-[#07111f] underline decoration-dotted underline-offset-2">#{x.id}</b> <span dir="ltr" className="text-[11px] text-slate-500">{when(x.at)}</span>{x.edited && <span className="ms-1"><Chip tone="amber">✎ {t.editedTag}</Chip></span>}</div>
                            <div className="flex flex-wrap justify-end gap-1">{roles.map(r => <Chip key={r} tone={r === t.roleClose ? 'slate' : r === t.roleBad ? 'red' : r === t.roleFixed ? 'amber' : 'blue'}>{r}</Chip>)}</div>
                          </div>
                          <div className="mt-1 grid grid-cols-4 gap-2 tabular-nums">
                            <div><div className="text-[9px] font-bold uppercase text-slate-400">{t.liters}</div><b>{n1(x.liters)}</b></div>
                            <div><div className="text-[9px] font-bold uppercase text-slate-400">{t.amount}</div><b>{n0(x.amount)}</b></div>
                            <div className="col-span-2"><div className="text-[9px] font-bold uppercase text-slate-400">{t.odometer}</div>
                              <b dir="ltr" className={bad ? 'text-slate-400 line-through' : ''}>{x.km == null ? '—' : fixed ? <>{n0(fixed.from)} <span className="text-emerald-700">→ {n0(fixed.to)}</span></> : n0(x.km)}</b></div>
                          </div>
                          <div className="mt-0.5 truncate text-[10px] text-slate-500">{x.station}{x.cardKmL != null ? ` · ${t.cardSays} ${n2(x.cardKmL)} ${t.kmL}` : ''}</div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-2 bg-[#fbf8f2] px-3 py-2 font-black text-[#07111f]">
                        <span>= {n0(seg.distance)} {t.km} ÷ {n1(seg.liters)} {t.L}</span><span>{n2(seg.kmL)} {t.kmL}</span>
                      </div>
                    </div>
                  </details>
                );
              })()}
              <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#07111f] px-4 py-3 text-sm font-black text-white" onClick={() => setFullRead(v => !v)} aria-expanded={fullRead}>
                📖 {fullRead ? t.hideFull : t.readFull} <span className={`transition ${fullRead ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {fullRead && (
                <div className="mt-3">
                  {ex && (
                    <ol className="space-y-2">
                      {ex.steps.map((st, i) => (
                        <li key={i} className="flex gap-2.5 text-[13px] leading-6 text-slate-700">
                          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#07111f] text-[10px] font-black text-white">{i + 1}</span>
                          <span>{st}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  <div className="mt-3 rounded-xl border border-[#e3dccf] bg-[#fbf8f2] p-3 text-[13px] leading-6 text-slate-700">
                    <div className="text-[10px] font-black uppercase tracking-[.2em] text-[#8a7350]">{t.result}</div>
                    {ex ? ex.verdict : explainHealth(h!, lang, HEALTH_KM)}
                  </div>
                </div>
              )}
              {seg && (
                <button className={`${btnGhost} mt-3 w-full justify-center`} onClick={() => { set({ plate: seg.plate }); setView('fills'); setExplain(null); }}>↗ {t.fills} · {seg.plate}</button>
              )}
            </div>
          </div>
        );
      })()}

      {txOpen && (() => {
        const v = result.txViews.find(x => x.tx.id === txOpen);
        if (!v) return null;
        const sg = v.segmentKey ? segByKey.get(v.segmentKey) : undefined;
        return <TxDialog t={t} lang={lang} v={v} seg={sg} cardIssue={explainCardIssue(v, sg, lang)} simple={sg ? explainSegment(sg, settings, result.price, lang).simple : []}
          isAdmin={isAdmin} busy={!!busy} onClose={() => setTxOpen(null)} onSave={saveTx} onDelete={() => removeTx(v.tx.id)}
          onOpenFill={sg ? () => { if (explain?.seg === sg.key) setTxOpen(null); else { setExplain({ seg: sg.key }); setTxOpen(null); } } : undefined} />;
      })()}

      {uploadFail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07111f]/60 p-4" role="dialog" aria-modal="true" onClick={() => setUploadFail(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-lg font-black text-red-700">⚠ {t.upFail}</div>
            {uploadFail.map((l, i) => <p key={i} className="mt-3 text-sm font-bold leading-6 text-slate-700">{l}</p>)}
            <div className="mt-5 flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setUploadFail(null)}>{t.close}</button>
              {isAdmin && <button className={btnGold} onClick={() => { setUploadFail(null); fileRef.current?.click(); }}>⬆ {t.upload}</button>}
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07111f]/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="text-lg font-black text-[#07111f]">⛽ {t.upload}</div>
            <p className="mt-3 text-sm text-slate-600">{t.found(preview.total, ltr(preview.from), ltr(preview.to))}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-emerald-50 p-3"><div className="text-2xl font-black text-emerald-700">{preview.fresh.length}</div><div className="text-[10px] font-bold text-emerald-800">{t.upNew}</div></div>
              <div className="rounded-xl bg-[#f8f5ef] p-3"><div className="text-2xl font-black text-slate-600">{preview.inSystem}</div><div className="text-[10px] font-bold text-slate-500">{t.upInSystem}</div></div>
              <div className="rounded-xl bg-[#f8f5ef] p-3"><div className="text-2xl font-black text-slate-600">{preview.repeated}</div><div className="text-[10px] font-bold text-slate-500">{t.upRepeated}</div></div>
            </div>
            <p className="mt-3 text-xs text-slate-500">{preview.fresh.length ? t.upOnlyNew : t.upNothing}</p>
            {(() => {
              const skipped = problemLines({ ...preview.problems, noHeader: undefined });
              return skipped.length ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] font-bold leading-5 text-amber-900">
                  <div className="text-[10px] font-black uppercase tracking-widest">{t.upSkipped}</div>
                  {skipped.map((l, i) => <p key={i} className="mt-1">{l}</p>)}
                </div>
              ) : null;
            })()}
            {(() => {
              const ci = summarizeCardIssues(preview.rows, lang);
              return ci ? (
                <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-sky-200 bg-sky-50 p-3 text-[12px] leading-5 text-sky-950">
                  <div className="font-black">{ci.head}</div>
                  {ci.items.map(it => <p key={it.title} className="mt-1.5"><b><span dir="ltr">{it.count}</span> × {it.title}:</b> {it.meaning}</p>)}
                  <p className="mt-2 font-black text-emerald-800">✓ {ci.handled}</p>
                </div>
              ) : null;
            })()}
            <div className="mt-6 flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setPreview(null)}>✕</button>
              <button className={btnGold} disabled={!!busy || !preview.fresh.length} onClick={saveUpload}>{busy ? <DaliLoader size={16} /> : '✓'} {t.saveUpload} ({preview.fresh.length})</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default FuelScreen;

/* ------------------------------ small parts ------------------------------ */

/** Fields an admin can correct by hand. */
const EDIT_FIELDS = ['at', 'km', 'liters', 'amount', 'totalAmount', 'driver', 'station', 'note'] as const;
type EditField = typeof EDIT_FIELDS[number];

const TxDialog: React.FC<{
  t: FuelStrings; lang: Lang; v: TxView; seg?: Segment; simple: string[]; isAdmin: boolean; busy: boolean; cardIssue: CardIssue | null;
  onClose: () => void; onSave: (x: FuelTx) => Promise<boolean>; onDelete: () => void; onOpenFill?: () => void;
}> = ({ t, v, seg, simple, isAdmin, busy, cardIssue, onClose, onSave, onDelete, onOpenFill }) => {
  const x = v.tx;
  const [edit, setEdit] = useState(false);
  const blank = () => ({ at: x.at, km: x.km == null ? '' : String(x.km), liters: String(x.liters), amount: String(x.amount), totalAmount: String(x.totalAmount), driver: x.driver, station: x.station, note: x.note || '' });
  const [d, setD] = useState<Record<EditField, string>>(blank);
  useEffect(() => { setD(blank()); setEdit(false); }, [x]); // eslint-disable-line react-hooks/exhaustive-deps
  const orig = x.edited?.orig || {};
  const num = (s: string) => { const n = Number(String(s).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };

  const save = async () => {
    const next: FuelTx = {
      ...x, at: d.at.slice(0, 16) || x.at, km: d.km.trim() === '' ? null : num(d.km), liters: num(d.liters), amount: num(d.amount),
      totalAmount: num(d.totalAmount), driver: d.driver.trim(), station: d.station.trim(), note: d.note.trim() || undefined,
    };
    // Keep the card's first value of every field that changed, so it can always be restored.
    const o: Partial<FuelTx> = { ...orig };
    let changed = false;
    for (const k of EDIT_FIELDS) {
      const a = (x as any)[k] ?? undefined, b = (next as any)[k] ?? undefined;
      if (a === b) continue;
      changed = true;
      if (k !== 'note' && !(k in o)) (o as any)[k] = a ?? null;
    }
    if (!changed) { setEdit(false); return; }
    // A field typed back to the card's value is not an edit any more.
    for (const k of Object.keys(o)) if ((o as any)[k] === ((next as any)[k] ?? null)) delete (o as any)[k];
    if (Object.keys(o).length) { const n = new Date(), z = (v: number) => String(v).padStart(2, '0'); next.edited = { at: `${n.getFullYear()}-${z(n.getMonth() + 1)}-${z(n.getDate())} ${z(n.getHours())}:${z(n.getMinutes())}`, orig: o }; }
    else delete next.edited;
    if (await onSave(next)) setEdit(false);
  };
  const restore = async () => {
    const next: FuelTx = { ...x, ...(orig as Partial<FuelTx>) };
    delete next.edited;
    if (await onSave(next)) setEdit(false);
  };

  const was = (k: keyof FuelTx, fmt: (v: any) => string) => (k in orig ? <div className="text-[10px] font-bold text-amber-700">{t.origWas}: <span dir="ltr">{fmt((orig as any)[k])}</span></div> : null);
  const F: React.FC<{ label: string; children: React.ReactNode; k?: keyof FuelTx; fmt?: (v: any) => string; wide?: boolean }> = ({ label, children, k, fmt = String, wide }) => (
    <div className={`rounded-xl bg-[#f8f5ef] px-3 py-2 ${wide ? 'col-span-2' : ''}`}>
      <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-black tabular-nums text-[#07111f]">{children}</div>
      {k && was(k, fmt)}
    </div>
  );
  const I = (k: EditField, label: string, type: 'number' | 'text' | 'datetime-local' = 'number', wide = false) => (
    <label className={`block ${wide ? 'col-span-2' : ''}`}>
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <input type={type} inputMode={type === 'number' ? 'decimal' : undefined} step="any" dir={type === 'text' ? undefined : 'ltr'}
        className={`${inputCls} mt-1 w-full`} value={d[k]} onChange={e => setD(p => ({ ...p, [k]: e.target.value }))} />
    </label>
  );
  const perL = x.liters > 0 ? x.amount / x.liters : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#07111f]/60 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t.txPreview} onClick={e => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[.2em] text-[#8a7350]">{t.txPreview} {x.edited && <Chip tone="amber">✎ {t.editedTag}</Chip>}</div>
            <div className="mt-1 text-lg font-black text-[#07111f]"><span dir="ltr">#{x.id}</span> · {x.plate}</div>
            <div className="text-[11px] text-slate-500" dir="ltr">{when(x.at)}</div>
          </div>
          <button className={`${btnGhost} !px-3`} onClick={onClose} aria-label={t.close}>✕</button>
        </div>

        {!edit ? (
          <>
            {/* MAIN: what the app calculated for the fill this transaction belongs to. */}
            {seg ? (
              <div className={`mt-4 rounded-2xl border p-4 ${seg.status === 'high' ? 'border-red-200 bg-red-50' : seg.status === 'low' ? 'border-amber-200 bg-amber-50' : seg.status === 'pending' ? 'border-slate-200 bg-slate-50' : 'border-emerald-200 bg-emerald-50'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-black uppercase tracking-[.2em] text-[#8a7350]">{t.appResult}</div>
                  <Badge t={t} s={seg.status} />
                </div>
                {seg.status !== 'pending' && (
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div><div className="text-3xl font-black tabular-nums text-[#07111f]">{n2(seg.kmL)}</div><div className="text-[10px] font-bold text-slate-500">{t.kmL} · {t.target} {n2(seg.target)}</div></div>
                    <div><div className="text-xl font-black tabular-nums text-[#07111f]">{n0(seg.distance)}</div><div className="text-[10px] font-bold text-slate-500">{t.km}</div></div>
                    <div><div className="text-xl font-black tabular-nums text-[#07111f]">{n1(seg.liters)}</div><div className="text-[10px] font-bold text-slate-500">{t.L}</div></div>
                  </div>
                )}
                <div className="mt-2 space-y-1 text-[14px] font-bold leading-6 text-slate-800">{simple.map((l, i) => <p key={i}>{l}</p>)}</div>
                {onOpenFill && <button className={`${btnGhost} mt-3 w-full justify-center`} onClick={onOpenFill}>🔗 {t.openFill}</button>}
              </div>
            ) : null}

            {/* This transaction, in short. */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <F label={t.liters} k="liters" fmt={n1}>{n1(x.liters)} <span className="text-[10px] text-slate-400">{t.L}</span></F>
              <F label={t.amount} k="amount" fmt={n2}>{n2(x.amount)} <span className="text-[10px] text-slate-400">EGP</span></F>
              <F label={t.odometer} k="km" fmt={n0}><span dir="ltr">{n0(x.km)}</span></F>
              <F label={t.driver} k="driver">{x.driver || '—'}</F>
              {!!v.flags.filter(fl => fl !== 'opening').length && <F label={t.flags} wide><div className="flex flex-wrap gap-1">{v.flags.filter(fl => fl !== 'opening').map(fl => <Chip key={fl}>{t[`f_${fl}` as const]}</Chip>)}</div></F>}
              {x.note && <F label={t.note} wide><span className="font-bold">{x.note}</span></F>}
            </div>
            {x.edited && <p className="mt-2 text-[11px] font-bold text-amber-800">{t.editedOn(x.edited.at)}</p>}

            {/* The card's complaint about this row, explained (not repeated). */}
            {cardIssue && (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[13px] leading-6 text-amber-950">
                <div className="font-black">⚠ {cardIssue.title}</div>
                <p className="mt-0.5">{cardIssue.meaning}</p>
                <p className="mt-1 font-bold text-emerald-800">✓ {cardIssue.did}</p>
              </div>
            )}

            {/* SUB: the card company's own report, for reference only. */}
            <details className="mt-3 rounded-2xl border border-[#e3dccf] bg-white">
              <summary className="cursor-pointer list-none px-3 py-2.5 text-[12px] font-black text-slate-600">📄 {t.cardRef} <span className="font-bold text-slate-400">· {t.cardRefHint}</span></summary>
              <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                <F label={t.date} k="at" fmt={when}><span dir="ltr">{when(x.at)}</span></F>
                <F label={t.station} k="station">{x.station || '—'}</F>
                <F label={t.total} k="totalAmount" fmt={n2}>{n2(x.totalAmount)} <span className="text-[10px] text-slate-400">{t.fee} {n2(x.totalAmount - x.amount)}</span></F>
                <F label={t.pricePerL}>{n2(perL)}</F>
                <F label={`${t.cardSays} ${t.km}`}>{n0(x.cardDistance)}</F>
                <F label={`${t.cardSays} ${t.kmL}`}>{n2(x.cardKmL)}</F>
                <F label={t.vehicleType}>{x.vehicleType || '—'}</F>
                <F label={t.pumpVar}>{Math.abs(x.variance) > 1 ? n2(x.variance) : '—'}</F>
                {(x.cardValidity || x.cardReason) && <F label={t.cardSays} wide><span className={/wrong/i.test(x.cardValidity) ? 'text-red-600' : ''}>{x.cardValidity}{x.cardReason ? ` · ${x.cardReason}` : ''}</span></F>}
              </div>
            </details>

            {isAdmin && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button className={`${btnGold} justify-center !py-3`} onClick={() => setEdit(true)}>✎ {t.editTx}</button>
                {x.edited && Object.keys(orig).length ? <button className={`${btnGhost} justify-center !py-3`} disabled={busy} onClick={restore}>↺ {t.restoreTx}</button>
                  : <button className={`${btnGhost} justify-center !py-3 !text-red-600`} disabled={busy} onClick={onDelete}>🗑 {t.deleteTx}</button>}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {I('at', t.date, 'datetime-local', true)}
              {I('liters', t.liters)}
              {I('km', t.odometer)}
              {I('amount', t.amount)}
              {I('totalAmount', t.total)}
              {I('driver', t.driver, 'text')}
              {I('station', t.station, 'text')}
              {I('note', t.note, 'text', true)}
            </div>
            <p className="mt-3 text-[11px] leading-5 text-slate-500">{t.editHint}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className={`${btnGhost} justify-center !py-3`} onClick={() => { setD(blank()); setEdit(false); }}>{t.cancel}</button>
              <button className={`${btnGold} justify-center !py-3`} disabled={busy} onClick={save}>{busy ? <DaliLoader size={16} /> : '✓'} {t.saveTx}</button>
            </div>
            {x.edited && Object.keys(orig).length > 0 && <button className="mt-3 w-full text-center text-[11px] font-bold text-slate-600 hover:underline" onClick={restore}>↺ {t.restoreTx}</button>}
            <button className="mt-3 w-full text-center text-[11px] font-bold text-red-600 hover:underline" onClick={onDelete}>🗑 {t.deleteTx}</button>
          </>
        )}
      </div>
    </div>
  );
};

const Kpi: React.FC<{ label: string; value: string; unit?: string; sub?: React.ReactNode; tone?: 'navy' | 'red' | 'amber' }> = ({ label, value, unit, sub, tone = 'navy' }) => (
  <Card className="!p-4">
    <div className="text-[10px] font-black uppercase tracking-[.2em] text-slate-500">{label}</div>
    <div className={`mt-1.5 text-2xl font-black tabular-nums ${tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-700' : 'text-[#07111f]'}`}>
      {value}{unit && <span className="ms-1 text-xs font-bold text-slate-400">{unit}</span>}
    </div>
    {sub && <div className="mt-1 text-[10px] leading-4 text-slate-500">{sub}</div>}
  </Card>
);

const Compare: React.FC<{ label: string; card: string; actual: string; diff: string; bad: boolean; t: FuelStrings }> = ({ label, card, actual, diff, bad, t }) => (
  <div className="rounded-xl bg-[#f8f5ef] p-3">
    <div className="text-[10px] font-black uppercase tracking-widest text-[#8a7350]">{label}</div>
    <div className="mt-1 grid grid-cols-3 gap-1 text-center">
      <div><div className="text-[9px] font-bold text-slate-500">{t.cardSays}</div><div className="text-sm font-black tabular-nums">{card}</div></div>
      <div><div className="text-[9px] font-bold text-slate-500">{t.actual}</div><div className="text-sm font-black tabular-nums text-[#07111f]">{actual}</div></div>
      <div><div className="text-[9px] font-bold text-slate-500">{t.diff}</div><div className={`text-sm font-black tabular-nums ${bad ? 'text-amber-700' : 'text-slate-500'}`}>{diff}</div></div>
    </div>
  </div>
);

const uniqNos = (plates: string[], vehicles: Record<string, VehicleInfo> | undefined) =>
  [...new Set([...plates.map(plateNo), ...Object.keys(vehicles || {})])].filter(Boolean).sort();

const SettingsPanel: React.FC<{
  t: FuelStrings; lang: Lang; isAdmin: boolean; settings: FuelSettings; result: FuelResult; plates: string[]; types: string[];
  onSave: (s: FuelSettings) => void;
}> = ({ t, lang, isAdmin, settings, result, plates, types, onSave }) => {
  const [d, setD] = useState({ ...settings, vehicles: settings.vehicles || DEFAULT_VEHICLES });
  useEffect(() => setD({ ...settings, vehicles: settings.vehicles || DEFAULT_VEHICLES }), [settings]);
  const num = (v: string) => (v === '' ? 0 : Number(v));
  const typeAvg = (type: string) => {
    const segs: Segment[] = result.segments.filter((s: Segment) => s.vehicleType === type && s.status !== 'pending' && !s.notes.includes('partial') && !s.notes.includes('paired'));
    const L = sum(segs, s => s.liters);
    return L ? sum(segs, s => s.distance) / L : 0;
  };
  const typeTruckCount = (type: string) => new Set(result.fills.filter(f => f.vehicleType === type).map(f => f.plate)).size;
  const profileMissing = uniqNos(plates, d.vehicles).filter(no => {
    const v = (d.vehicles || {})[no];
    return !v || !v.driver || !v.branch || !v.model || !v.year;
  }).length;
  const field = (label: string, key: 'price' | 'marginPct' | 'fillMarginPct' | 'splitHours' | 'minKm' | 'maxKmPerFill' | 'tankLiters' | 'idleDays', hint?: string, step = '1') => (
    <label className="block text-xs font-bold text-slate-700">{label}
      <input type="number" step={step} min="0" disabled={!isAdmin} className={`${inputCls} mt-1 w-full`} value={d[key] || ''} placeholder={key === 'price' ? `${result.price}` : '0'}
        onChange={e => setD({ ...d, [key]: num(e.target.value) })} />
      {hint && <span className="mt-1 block text-[10px] font-normal text-slate-500">{hint}</span>}
    </label>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <Card>
        <p className="text-xs text-slate-500">{t.setHint}</p>
        {!isAdmin && <p className="mt-2 text-xs font-bold text-amber-700">{t.readOnly}</p>}
        <div className="mt-4 grid grid-cols-2 gap-4">
          {field(t.price, 'price', t.priceHint, '0.01')}
          {field(t.truckMargin, 'marginPct', t.truckMarginHint)}
          {field(t.fillMargin, 'fillMarginPct', t.fillMarginHint)}
          {field(t.splitHours, 'splitHours', t.splitHoursHint, '0.5')}
          {field(t.minKm, 'minKm')}
          {field(t.maxKm, 'maxKmPerFill', t.maxKmHint)}
          {field(t.tank, 'tankLiters', t.tankHint)}
          {field(t.idleDays, 'idleDays', t.idleHint)}
        </div>
        <div className="mt-5 text-xs font-black uppercase tracking-[.2em] text-[#07111f]">{t.typeTargets}</div>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {types.map(type => (
            <label key={type} className="block text-xs font-bold text-slate-700">{type}
              <input type="number" step="0.01" min="0" disabled={!isAdmin} className={`${inputCls} mt-1 w-full`} placeholder={`${t.fleetAvg} ${n2(typeAvg(type))}`}
                value={d.typeTargets[type] || ''} onChange={e => setD({ ...d, typeTargets: { ...d.typeTargets, [type]: num(e.target.value) } })} />
              {typeTruckCount(type) <= 1 && <span className="mt-1 block text-[10px] font-bold text-amber-700">
                {lang === 'ar' ? 'مؤقت: نوع به سيارة واحدة فقط؛ المتوسط لا يمثل معيارًا مستقلًا.' : 'Provisional: only one truck in this type; its average is not an independent benchmark.'}
              </span>}
            </label>
          ))}
        </div>
        {isAdmin && (
          <div className="mt-5 flex gap-2">
            <button className={btnGold} onClick={() => onSave(d)}>✓ {t.saveSettings}</button>
            <button className={btnGhost} onClick={() => setD({ ...DEFAULT_SETTINGS, checkedAlerts: settings.checkedAlerts })}>{t.reset}</button>
          </div>
        )}
      </Card>
      <div className="space-y-4">
        <Card>
          <div className="text-xs font-black uppercase tracking-[.2em] text-[#07111f]">{t.truckTargets}</div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {plates.map(p => (
              <label key={p} className="block text-xs font-bold text-slate-700">{p}
                <input type="number" step="0.01" min="0" disabled={!isAdmin} className={`${inputCls} mt-1 w-full`} placeholder={n2(result.targets[p])}
                  value={d.truckTargets[p] || ''} onChange={e => setD({ ...d, truckTargets: { ...d.truckTargets, [p]: num(e.target.value) } })} />
              </label>
            ))}
          </div>
        </Card>
        <Card>
          <div className="text-xs font-black uppercase tracking-[.2em] text-[#07111f]">{t.truckDetails}</div>
          <p className="mt-1 text-[10px] text-slate-500">{t.truckDetailsHint}</p>
          {profileMissing > 0 && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">
            {lang === 'ar' ? `بيانات ناقصة في ${profileMissing} سيارات. أكمل السائق والفرع والموديل وسنة الصنع.` : `${profileMissing} truck profiles are incomplete. Complete driver, branch, model and year.`}
          </p>}
          <div className="mt-3 space-y-2">
            {uniqNos(plates, d.vehicles).map(no => {
              const v: VehicleInfo = (d.vehicles || {})[no] || { driver: '', branch: '', model: '', year: '' };
              const put = (k: keyof VehicleInfo, val: string) => setD({ ...d, vehicles: { ...(d.vehicles || {}), [no]: { ...v, [k]: val } } });
              return <div key={no} className="grid grid-cols-[3.5rem_1fr_1fr] items-center gap-1.5 sm:grid-cols-[3.5rem_1.4fr_1fr_1fr_4.5rem]">
                <b className="text-xs tabular-nums text-[#07111f]">{no}</b>
                <input aria-label={t.assignedDriver} placeholder={t.assignedDriver} disabled={!isAdmin} className={`${inputCls} !py-1.5 text-xs`} value={v.driver} onChange={e => put('driver', e.target.value)} />
                <input aria-label={t.branch} placeholder={t.branch} disabled={!isAdmin} className={`${inputCls} !py-1.5 text-xs`} value={v.branch} onChange={e => put('branch', e.target.value)} />
                <input aria-label={t.model} placeholder={t.model} disabled={!isAdmin} className={`${inputCls} col-start-2 !py-1.5 text-xs sm:col-start-auto`} value={v.model} onChange={e => put('model', e.target.value)} />
                <input aria-label={t.year} placeholder={t.year} disabled={!isAdmin} inputMode="numeric" className={`${inputCls} !py-1.5 text-xs`} value={v.year} onChange={e => put('year', e.target.value)} />
              </div>;
            })}
          </div>
          {isAdmin && <button className={`${btnGold} mt-4`} onClick={() => onSave(d)}>✓ {t.saveSettings}</button>}
        </Card>
        <Card>
          <div className="text-xs font-black uppercase tracking-[.2em] text-[#07111f]">{t.how}</div>
          <ol className="mt-3 list-decimal space-y-2 ps-5 text-xs leading-5 text-slate-600">{t.howLines.map(l => <li key={l}>{l}</li>)}</ol>
        </Card>
      </div>
    </div>
  );
};
