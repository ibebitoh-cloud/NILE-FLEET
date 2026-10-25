import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DaliLoader from '../components/DaliLoader';
import DaliSignature from '../components/DaliSignature';
import * as api from './api';
import { STRINGS, Lang, Strings } from './i18n';
import { PRICE_KEYS, PRICE_LABELS, PriceKey, Rate, RateDraft, TransportUser, emptyDraft } from './types';
import { buildPdfHtml, DEFAULT_SIGNER, exportCsv, exportExcelBranded, exportExcelData, ExportOptions, PdfStyle, whatsappText } from './exports';
import { parseRateWorkbook } from './importExcel';

const fmt = (n: number) => (n ? n.toLocaleString('en-US') : '—');
const goHome = () => { window.location.hash = ''; };

type Tab = 'overview' | 'rates' | 'customers';
type SortKey = 'customer' | 'load_port' | 'destination' | 'transit_port' | PriceKey | 'updated_at';

interface Filters {
  q: string; customer: string; loadPort: string; destination: string;
  container: '' | PriceKey; min: string; max: string; onlyPriced: boolean;
}
const NO_FILTERS: Filters = { q: '', customer: '', loadPort: '', destination: '', container: '', min: '', max: '', onlyPriced: false };

const readLang = (): Lang => { try { return localStorage.getItem('nf_transport_lang') === 'ar' ? 'ar' : 'en'; } catch { return 'en'; } };

/* =============================== Root =============================== */

const TransportApp: React.FC = () => {
  const [lang, setLangState] = useState<Lang>(readLang);
  const [user, setUser] = useState<TransportUser | null>(null);
  const [checking, setChecking] = useState(true);
  const t = STRINGS[lang];
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem('nf_transport_lang', l); } catch {} };

  useEffect(() => { api.currentUser().then(u => { setUser(u); setChecking(false); }); }, []);
  useEffect(() => { document.title = `NILE FLEET · ${t.system}`; }, [t.system]);

  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  if (checking) return <div dir={dir} className="flex min-h-screen items-center justify-center bg-[#07111f]"><DaliLoader size={64} /></div>;
  return (
    <div dir={dir} lang={lang} className="nf-transport min-h-screen bg-[#f4f1ea] text-[#14202e]">
      {/* Dense table rows: skip the global 44px touch-target minimum inside cells. */}
      <style>{'.nf-transport td button,.nf-transport td input,.nf-transport th button,.nf-transport th input{min-height:0}'}</style>
      {user
        ? <Shell t={t} lang={lang} setLang={setLang} user={user} onLogout={async () => { await api.signOut(); setUser(null); }} />
        : <LoginView t={t} lang={lang} setLang={setLang} onSignedIn={setUser} />}
    </div>
  );
};

export default TransportApp;

/* =============================== Login =============================== */

const LangToggle: React.FC<{ lang: Lang; setLang: (l: Lang) => void; dark?: boolean }> = ({ lang, setLang, dark }) => (
  <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className={`rounded-full border px-3 py-1.5 text-[11px] font-black tracking-widest ${dark ? 'border-white/20 text-white/80 hover:border-[#c2a378]' : 'border-[#07111f]/15 text-[#07111f] hover:border-[#c2a378]'}`}>
    {lang === 'ar' ? 'EN' : 'عربي'}
  </button>
);

const LoginView: React.FC<{ t: Strings; lang: Lang; setLang: (l: Lang) => void; onSignedIn: (u: TransportUser) => void }> = ({ t, lang, setLang, onSignedIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await api.signIn(email, password);
    setBusy(false);
    if (res.user) onSignedIn(res.user);
    else setError(res.error === 'NO_ACCESS' ? t.noAccess : /invalid/i.test(res.error || '') ? t.badLogin : res.error || t.badLogin);
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#07111f] text-white">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#c2a378]/10 blur-3xl" />
      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-10">
        <button onClick={goHome} className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[.25em] text-white/70 hover:text-[#c2a378]">
          <span className="text-base">{lang === 'ar' ? '→' : '←'}</span>{t.backHome}
        </button>
        <LangToggle lang={lang} setLang={setLang} dark />
      </header>
      <main className="relative z-10 mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-5 pb-10 sm:px-10 lg:grid-cols-2">
        <div>
          <div className="flex items-center gap-4">
            <img src="/nile-fleet-logo.png" alt="Nile Fleet" className="h-16 w-16 object-contain" />
            <div className="text-4xl font-black italic tracking-tight">NILE <span className="text-[#c2a378]">FLEET</span></div>
          </div>
          <div className="mt-8 text-[11px] font-black uppercase tracking-[.35em] text-[#c2a378]">{t.system}</div>
          <h1 className="mt-3 text-4xl font-black uppercase italic leading-none sm:text-5xl">{t.loginTitle}</h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-white/65">{t.loginSub}</p>
        </div>
        <form onSubmit={submit} className="rounded-[1.75rem] border border-white/10 bg-white/[.04] p-6 shadow-2xl backdrop-blur sm:p-8">
          <div className="text-[11px] font-black uppercase tracking-[.3em] text-white/60">{t.signIn}</div>
          <label className="mt-6 block text-xs font-bold text-white/70">{t.email}
            <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} dir="ltr"
              className="mt-2 w-full rounded-xl border border-white/15 bg-[#0b1a2c] px-4 py-3 text-sm text-white outline-none focus:border-[#c2a378]" />
          </label>
          <label className="mt-4 block text-xs font-bold text-white/70">{t.password}
            <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} dir="ltr"
              className="mt-2 w-full rounded-xl border border-white/15 bg-[#0b1a2c] px-4 py-3 text-sm text-white outline-none focus:border-[#c2a378]" />
          </label>
          {error && <div role="alert" className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-200">{error}</div>}
          <button disabled={busy} className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-[#c2a378] px-4 py-3.5 text-xs font-black uppercase tracking-[.25em] text-[#07111f] transition hover:brightness-110 disabled:opacity-60">
            {busy ? <><DaliLoader size={18} />{t.signingIn}</> : <>{t.signIn} <span>{lang === 'ar' ? '←' : '→'}</span></>}
          </button>
        </form>
      </main>
      <DaliSignature tone="dark" className="relative z-10 pb-8" />
    </div>
  );
};

/* =============================== Shell =============================== */

const Shell: React.FC<{ t: Strings; lang: Lang; setLang: (l: Lang) => void; user: TransportUser; onLogout: () => void }> = ({ t, lang, setLang, user, onLogout }) => {
  const [tab, setTab] = useState<Tab>(() => {
    try { const v = localStorage.getItem('nf_transport_tab'); return (v === 'overview' || v === 'customers') ? v : 'rates'; } catch { return 'rates'; }
  });
  const [rates, setRates] = useState<Rate[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [toast, setToast] = useState('');
  const [exportFor, setExportFor] = useState<{ rows: Rate[]; customer?: string; style?: Fmt } | null>(null);
  const isAdmin = user.role === 'ADMIN';

  useEffect(() => { try { localStorage.setItem('nf_transport_tab', tab); } catch {} }, [tab]);
  const reload = useCallback(() => {
    setLoadError('');
    api.loadRates().then(setRates).catch(e => { setLoadError(String(e.message || e)); setRates([]); });
  }, []);
  useEffect(reload, [reload]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 3500); return () => clearTimeout(id); }, [toast]);

  const openCustomer = (customer: string) => { setFilters({ ...NO_FILTERS, customer }); setTab('rates'); };
  const quoteCustomer = (customer: string) => setExportFor({ rows: (rates || []).filter(r => r.customer === customer), customer, style: 'quote' });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07111f] text-white">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <button onClick={goHome} className="flex items-center gap-3" title={t.backHome}>
            <img src="/nile-fleet-logo.png" alt="Nile Fleet" className="h-9 w-9 object-contain" />
            <div className="text-start leading-none">
              <div className="text-lg font-black italic tracking-tight">NILE <span className="text-[#c2a378]">FLEET</span></div>
              <div className="mt-1 text-[9px] font-black uppercase tracking-[.3em] text-white/50">{t.system}</div>
            </div>
          </button>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {(['overview', 'rates', 'customers'] as Tab[]).map(k => (
              <button key={k} onClick={() => setTab(k)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[.18em] transition ${tab === k ? 'bg-[#c2a378] text-[#07111f]' : 'text-white/70 hover:bg-white/10'}`}>
                {t[k]}
              </button>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden text-end sm:block">
              <div className="text-xs font-bold">{user.name}</div>
              <div className="text-[10px] text-white/50" dir="ltr">{user.email}</div>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[.2em] ${isAdmin ? 'bg-[#c2a378] text-[#07111f]' : 'border border-white/25 text-white/80'}`}>
              {isAdmin ? t.admin : `${t.viewer} · ${t.readOnly}`}
            </span>
            <LangToggle lang={lang} setLang={setLang} dark />
            <button onClick={onLogout} className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-black text-white/80 hover:border-red-300 hover:text-red-200">{t.logout}</button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-6 sm:px-6">
        {loadError && <div role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-800">{t.failed}: {loadError}</div>}
        {rates === null ? <DaliLoader fullScreen label={<span className="text-xs font-bold text-slate-500">{t.loading}</span>} />
          : tab === 'overview' ? <Overview t={t} rates={rates} onCustomer={openCustomer} />
          : tab === 'customers' ? <Customers t={t} rates={rates} isAdmin={isAdmin} onView={openCustomer} onQuote={quoteCustomer} setRates={setRates} setToast={setToast} />
          : <RatesScreen t={t} lang={lang} rates={rates} setRates={setRates} isAdmin={isAdmin} filters={filters} setFilters={setFilters} setToast={setToast}
              onExport={(rows, customer) => setExportFor({ rows, customer })} />}
      </main>

      <DaliSignature tone="light" className="pb-8 pt-4" />
      {exportFor && <ExportDialog t={t} lang={lang} rows={exportFor.rows} customer={exportFor.customer} initial={exportFor.style} onClose={() => setExportFor(null)} setToast={setToast} />}
      {toast && <div role="status" className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-[#07111f] px-5 py-3 text-xs font-bold text-white shadow-xl">{toast}</div>}
    </div>
  );
};

/* ============================== Overview ============================== */

const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`rounded-2xl border border-[#e3dccf] bg-white p-5 shadow-[0_1px_0_rgba(7,17,31,.04)] ${className}`}>{children}</div>
);

const Overview: React.FC<{ t: Strings; rates: Rate[]; onCustomer: (c: string) => void }> = ({ t, rates, onCustomer }) => {
  const stats = useMemo(() => {
    const byCustomer = new Map<string, number>();
    rates.forEach(r => byCustomer.set(r.customer, (byCustomer.get(r.customer) || 0) + 1));
    const avg = (k: PriceKey) => { const v = rates.map(r => r[k]).filter(Boolean); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0; };
    return {
      customers: byCustomer.size,
      destinations: new Set(rates.map(r => r.destination)).size,
      ports: new Set(rates.map(r => r.load_port).filter(Boolean)).size,
      top: [...byCustomer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
      avgs: PRICE_KEYS.map(k => [k, avg(k), rates.filter(r => r[k]).length] as const),
      recent: [...rates].filter(r => r.updated_at).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, 6),
    };
  }, [rates]);
  const max = stats.top[0]?.[1] || 1;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[[t.customers, stats.customers], [t.routes, rates.length], [t.destinations, stats.destinations], [t.loadPorts, stats.ports]].map(([label, v]) => (
          <Card key={String(label)}>
            <div className="text-[10px] font-black uppercase tracking-[.25em] text-slate-500">{label}</div>
            <div className="mt-2 text-3xl font-black text-[#07111f]">{Number(v).toLocaleString('en-US')}</div>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <Card>
          <div className="mb-4 text-xs font-black uppercase tracking-[.2em] text-[#07111f]">{t.topCustomers}</div>
          <div className="space-y-2.5">
            {stats.top.map(([name, n]) => (
              <button key={name} onClick={() => onCustomer(name)} className="group block w-full text-start">
                <div className="flex justify-between text-xs font-bold"><span className="group-hover:text-[#8a7350]">{name}</span><span className="tabular-nums text-slate-500">{n}</span></div>
                <div className="mt-1 h-2 rounded-full bg-[#f1ebe0]"><div className="h-2 rounded-full bg-[#c2a378]" style={{ width: `${(n / max) * 100}%` }} /></div>
              </button>
            ))}
          </div>
        </Card>
        <div className="space-y-5">
          <Card>
            <div className="mb-3 text-xs font-black uppercase tracking-[.2em] text-[#07111f]">{t.avg} (EGP)</div>
            <div className="grid grid-cols-2 gap-3">
              {stats.avgs.map(([k, v, n]) => (
                <div key={k} className="rounded-xl bg-[#f8f5ef] p-3">
                  <div className="text-[10px] font-black tracking-widest text-[#8a7350]"><span dir="ltr">{PRICE_LABELS[k]}</span></div>
                  <div className="mt-1 text-xl font-black tabular-nums">{fmt(v)}</div>
                  <div className="text-[10px] text-slate-500">{n} {t.routes.toLowerCase()}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="mb-3 text-xs font-black uppercase tracking-[.2em] text-[#07111f]">{t.recent}</div>
            <ul className="space-y-2 text-xs">
              {stats.recent.map(r => (
                <li key={r.id} className="flex justify-between gap-3"><span className="truncate"><b>{r.customer}</b> · {r.destination}</span><span className="shrink-0 text-slate-500" dir="ltr">{String(r.updated_at).slice(0, 10)}</span></li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
};

/* ============================== Price list ============================== */

const inputCls = 'rounded-xl border border-[#d9d0c0] bg-white px-3 py-2 text-sm outline-none focus:border-[#c2a378]';
const btn = 'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition disabled:opacity-40';
const btnGold = `${btn} bg-[#c2a378] text-[#07111f] hover:brightness-105`;
const btnNavy = `${btn} bg-[#07111f] text-white hover:bg-[#13263d]`;
const btnGhost = `${btn} border border-[#d9d0c0] bg-white text-[#07111f] hover:border-[#c2a378]`;

interface RatesProps {
  t: Strings; lang: Lang; rates: Rate[]; setRates: React.Dispatch<React.SetStateAction<Rate[] | null>>; isAdmin: boolean;
  filters: Filters; setFilters: (f: Filters) => void; setToast: (s: string) => void; onExport: (rows: Rate[], customer?: string) => void;
}

const RatesScreen: React.FC<RatesProps> = ({ t, rates, setRates, isAdmin, filters: f, setFilters, setToast, onExport }) => {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'customer', dir: 1 });
  const [pageSize, setPageSize] = useState(100);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<RateDraft | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [busy, setBusy] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<Filters>) => { setFilters({ ...f, ...patch }); setPage(0); };

  const options = useMemo(() => {
    const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));
    return { customers: uniq(rates.map(r => r.customer)), ports: uniq(rates.map(r => r.load_port)), dests: uniq(rates.map(r => r.destination)) };
  }, [rates]);

  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const min = f.min === '' ? null : Number(f.min);
    const max = f.max === '' ? null : Number(f.max);
    const list = rates.filter(r => {
      if (f.customer && r.customer !== f.customer) return false;
      if (f.loadPort && r.load_port !== f.loadPort) return false;
      if (f.destination && r.destination !== f.destination) return false;
      if (f.onlyPriced && !PRICE_KEYS.some(k => r[k])) return false;
      const keys = f.container ? [f.container] : PRICE_KEYS;
      if (f.container && !r[f.container]) return false;
      if (min !== null || max !== null) {
        const ok = keys.some(k => r[k] && (min === null || r[k] >= min) && (max === null || r[k] <= max));
        if (!ok) return false;
      }
      if (q && !`${r.customer} ${r.load_port} ${r.destination} ${r.transit_port} ${r.notes}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const { key, dir } = sort;
    return list.sort((a, b) => {
      const av = a[key] ?? '', bv = b[key] ?? '';
      const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'ar');
      return c * dir || a.id - b.id;
    });
  }, [rates, f, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * pageSize, current * pageSize + pageSize);
  const selectedRows = filtered.filter(r => selected.has(r.id));
  const scopeRows = selectedRows.length ? selectedRows : filtered;
  const allVisibleSelected = visible.length > 0 && visible.every(r => selected.has(r.id));
  const activeFilters = JSON.stringify(f) !== JSON.stringify(NO_FILTERS);

  const toggleSort = (key: SortKey) => setSort(s => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }));
  const toggle = (id: number) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleVisible = () => setSelected(s => { const n = new Set(s); visible.forEach(r => allVisibleSelected ? n.delete(r.id) : n.add(r.id)); return n; });

  const save = async (d: RateDraft) => {
    if (!d.customer.trim() || !d.destination.trim()) { setToast(t.required); return; }
    setBusy('save');
    try {
      const saved = await api.saveRate(d);
      setRates(list => {
        const l = list || [];
        return d.id ? l.map(r => r.id === saved.id ? saved : r) : [...l, saved];
      });
      setEditing(null); setToast(t.saved);
    } catch (e: any) { setToast(`${t.failed}: ${e.message}`); }
    setBusy('');
  };

  const remove = async (ids: number[]) => {
    if (!ids.length || !window.confirm(t.confirmDelete(ids.length))) return;
    setBusy('delete');
    try {
      await api.deleteRates(ids);
      const gone = new Set(ids);
      setRates(list => (list || []).filter(r => !gone.has(r.id)));
      setSelected(new Set()); setToast(t.saved);
    } catch (e: any) { setToast(`${t.failed}: ${e.message}`); }
    setBusy('');
  };

  const importFile = async (file: File) => {
    setBusy('import');
    try {
      // Skip routes that are already in the list with the same prices, so
      // importing the same sheet twice does not create duplicates.
      const sig = (r: RateDraft | Rate) => [r.customer, r.load_port, r.destination, r.transit_port, ...PRICE_KEYS.map(k => Number(r[k]) || 0)].join('|');
      const existing = new Set(rates.map(sig));
      const rows = (await parseRateWorkbook(file, f.customer)).filter(r => !existing.has(sig(r)));
      if (!rows.length) { setToast(t.importNone); setBusy(''); return; }
      if (!window.confirm(t.importFound(rows.length))) { setBusy(''); return; }
      const added = await api.insertRates(rows, done => setBusy(`import ${done}/${rows.length}`));
      setRates(list => [...(list || []), ...added]);
      setToast(t.importDone(added.length));
    } catch (e: any) { setToast(`${t.failed}: ${e.message}`); }
    setBusy('');
  };

  const SortTh: React.FC<{ k: SortKey; children: React.ReactNode; className?: string }> = ({ k, children, className = '' }) => (
    <th className={`px-3 py-3 font-black ${className}`} aria-sort={sort.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 whitespace-nowrap uppercase tracking-wider hover:text-[#c2a378]">
        {children}<span className={sort.key === k ? 'text-[#c2a378]' : 'opacity-30'}>{sort.key === k ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="!p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1.3fr_1.2fr_1.3fr]">
          <input value={f.q} onChange={e => set({ q: e.target.value })} placeholder={t.search} className={`${inputCls} w-full min-w-0`} aria-label={t.search} />
          <select value={f.customer} onChange={e => set({ customer: e.target.value })} className={`${inputCls} w-full min-w-0`} aria-label={t.customer}>
            <option value="">{t.allCustomers}</option>{options.customers.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={f.loadPort} onChange={e => set({ loadPort: e.target.value })} className={`${inputCls} w-full min-w-0`} aria-label={t.loadPort}>
            <option value="">{t.allPorts}</option>{options.ports.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={f.destination} onChange={e => set({ destination: e.target.value })} className={`${inputCls} w-full min-w-0`} aria-label={t.destination}>
            <option value="">{t.allDest}</option>{options.dests.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select value={f.container} onChange={e => set({ container: e.target.value as Filters['container'] })} className={inputCls}>
            <option value="">{t.anyContainer}</option>{PRICE_KEYS.map(k => <option key={k} value={k}>{PRICE_LABELS[k]} {t.hasPrice}</option>)}
          </select>
          <input value={f.min} onChange={e => set({ min: e.target.value.replace(/[^\d]/g, '') })} placeholder={`${t.min} EGP`} inputMode="numeric" className={`${inputCls} w-28`} />
          <input value={f.max} onChange={e => set({ max: e.target.value.replace(/[^\d]/g, '') })} placeholder={`${t.max} EGP`} inputMode="numeric" className={`${inputCls} w-28`} />
          <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={f.onlyPriced} onChange={e => set({ onlyPriced: e.target.checked })} className="accent-[#c2a378]" />{t.onlyPriced}</label>
          {activeFilters && <button onClick={() => { setFilters(NO_FILTERS); setPage(0); }} className="text-xs font-black text-[#8a7350] underline">{t.clear}</button>}
        </div>
      </Card>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="me-auto text-sm font-bold">
          <span className="text-2xl font-black text-[#07111f]">{filtered.length.toLocaleString('en-US')}</span> <span className="text-slate-500">{t.of} {rates.length.toLocaleString('en-US')} {t.rows}</span>
          {selected.size > 0 && <span className="ms-3 rounded-full bg-[#07111f] px-2.5 py-1 text-[10px] font-black text-[#c2a378]">{selected.size} {t.selected}</span>}
        </div>
        {busy && <DaliLoader size={20} />}
        {isAdmin && <>
          <button className={btnGold} onClick={() => setEditing({ ...emptyDraft(), customer: f.customer, load_port: f.loadPort, transit_port: f.loadPort })}>＋ {t.add}</button>
          <button className={btnGhost} onClick={() => fileRef.current?.click()} disabled={!!busy}>⇪ {t.importExcel}</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) importFile(file); }} />
          <button className={btnGhost} onClick={() => setAdjusting(true)} disabled={!scopeRows.length}>± {t.adjust}</button>
          {selected.size > 0 && <button className={`${btn} border border-red-200 bg-red-50 text-red-700`} onClick={() => remove([...selected])}>🗑 {t.del} ({selected.size})</button>}
        </>}
        <button className={btnNavy} onClick={() => onExport(scopeRows, f.customer || (new Set(scopeRows.map(r => r.customer)).size === 1 ? scopeRows[0]?.customer : undefined))} disabled={!scopeRows.length}>⤓ {t.export}</button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#e3dccf] bg-white">
        <div className="max-h-[68vh] overflow-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="sticky top-0 z-10 bg-[#07111f] text-start text-[10px] text-white">
              <tr>
                <th className="w-10 px-3 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} className="accent-[#c2a378]" aria-label="Select page" /></th>
                <SortTh k="customer" className="text-start">{t.customer}</SortTh>
                <SortTh k="load_port" className="text-start">{t.loadPort}</SortTh>
                <SortTh k="destination" className="text-start">{t.destination}</SortTh>
                <SortTh k="transit_port" className="text-start">{t.transitPort}</SortTh>
                {PRICE_KEYS.map(k => <SortTh key={k} k={k} className="bg-[#1a2a3d] text-center"><span dir="ltr">{PRICE_LABELS[k]}</span></SortTh>)}
                <th className="px-3 py-3 text-start font-black uppercase tracking-wider">{t.notes}</th>
                {isAdmin && <th className="w-24 px-3 py-3" />}
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => (
                <tr key={r.id} className={`border-t border-[#efe9de] align-top ${selected.has(r.id) ? 'bg-[#fbf3e4]' : i % 2 ? 'bg-[#fcfbf8]' : ''} hover:bg-[#f7efe1]`}>
                  <td className="px-3 py-2.5"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="accent-[#c2a378]" aria-label="Select row" /></td>
                  <td className="px-3 py-2.5 font-bold">{r.customer}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.load_port || '—'}</td>
                  <td className="px-3 py-2.5 font-bold text-[#07111f]">{r.destination}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.transit_port || '—'}</td>
                  {PRICE_KEYS.map(k => <td key={k} className={`px-3 py-2.5 text-center font-black tabular-nums ${r[k] ? 'text-[#07111f]' : 'text-slate-300'}`}>{fmt(r[k])}</td>)}
                  <td className="max-w-[320px] px-3 py-2.5 text-xs leading-5 text-slate-500"><div className="line-clamp-2" title={r.notes}>{r.notes}</div></td>
                  {isAdmin && (
                    <td className="whitespace-nowrap px-3 py-2.5 text-end">
                      <button onClick={() => setEditing({ ...r })} className="rounded-lg px-2 py-1 text-xs font-black text-[#8a7350] hover:bg-[#f1ebe0]" title={t.edit}>✎</button>
                      <button onClick={() => { const { id, updated_at, ...copy } = r; setEditing(copy); }} className="rounded-lg px-2 py-1 text-xs font-black text-slate-500 hover:bg-[#f1ebe0]" title={t.duplicate}>⧉</button>
                      <button onClick={() => remove([r.id])} className="rounded-lg px-2 py-1 text-xs font-black text-red-500 hover:bg-red-50" title={t.del}>🗑</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && <div className="p-12 text-center text-sm font-bold text-slate-500">{rates.length ? t.empty : t.noData}</div>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#efe9de] px-4 py-3 text-xs font-bold text-slate-600">
          <label className="flex items-center gap-2">
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }} className="rounded-lg border border-[#d9d0c0] px-2 py-1">
              {[50, 100, 250, 500].map(n => <option key={n}>{n}</option>)}
            </select>{t.perPage}
          </label>
          <div className="flex items-center gap-2">
            <button className={btnGhost} disabled={current === 0} onClick={() => setPage(current - 1)}>‹</button>
            <span>{t.page} {current + 1} / {pages}</span>
            <button className={btnGhost} disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>›</button>
          </div>
        </div>
      </div>

      {editing && <RateEditor t={t} draft={editing} options={options} busy={busy === 'save'} onCancel={() => setEditing(null)} onSave={save} />}
      {adjusting && <AdjustDialog t={t} rows={scopeRows} onClose={() => setAdjusting(false)} onDone={(updated) => {
        const m = new Map(updated.map(r => [r.id, r]));
        setRates(list => (list || []).map(r => m.get(r.id) || r));
        setAdjusting(false); setToast(t.saved);
      }} />}
    </div>
  );
};

/* ============================== Dialogs ============================== */

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#07111f]/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`relative max-h-[94vh] w-full overflow-auto rounded-t-3xl bg-white pb-10 shadow-2xl sm:rounded-3xl ${wide ? 'max-w-6xl' : 'max-w-2xl'}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#efe9de] bg-white px-6 py-4">
          <h2 className="text-sm font-black uppercase tracking-[.2em] text-[#07111f]">{title}</h2>
          <button onClick={onClose} className="rounded-full px-2 text-xl text-slate-400 hover:text-[#07111f]" aria-label="Close">×</button>
        </div>
        <div className="p-6">{children}</div>
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex items-center justify-center gap-2 opacity-70" dir="ltr" aria-hidden="true">
          <span className="text-[7px] font-black uppercase tracking-[.35em] text-[#07111f]/60">NILE FLEET</span>
          <span className="h-3 w-px bg-[#07111f]/20" /><img src="/dali/dali-mark.png" alt="" className="h-3.5 w-auto" />
          <span className="text-[7px] font-black uppercase tracking-[.35em] text-[#8a7350]">DALI STUDIO</span>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
  <label className={`block text-[11px] font-black uppercase tracking-wider text-slate-500 ${className}`}>{label}<div className="mt-1.5 normal-case tracking-normal">{children}</div></label>
);

const RateEditor: React.FC<{ t: Strings; draft: RateDraft; options: { customers: string[]; ports: string[]; dests: string[] }; busy: boolean; onCancel: () => void; onSave: (d: RateDraft) => void }> = ({ t, draft, options, busy, onCancel, onSave }) => {
  const [d, setD] = useState<RateDraft>(draft);
  const up = (patch: Partial<RateDraft>) => setD(x => ({ ...x, ...patch }));
  return (
    <Modal title={d.id ? t.editRate : t.newRate} onClose={onCancel}>
      <datalist id="nf-customers">{options.customers.map(c => <option key={c} value={c} />)}</datalist>
      <datalist id="nf-ports">{options.ports.map(c => <option key={c} value={c} />)}</datalist>
      <datalist id="nf-dests">{options.dests.map(c => <option key={c} value={c} />)}</datalist>
      <form onSubmit={e => { e.preventDefault(); onSave(d); }} className="grid gap-4 sm:grid-cols-2">
        <Field label={`${t.customer} *`} className="sm:col-span-2"><input required list="nf-customers" value={d.customer} onChange={e => up({ customer: e.target.value })} className={`${inputCls} w-full`} /></Field>
        <Field label={t.loadPort}><input list="nf-ports" value={d.load_port} onChange={e => up({ load_port: e.target.value, transit_port: d.transit_port === d.load_port ? e.target.value : d.transit_port })} className={`${inputCls} w-full`} /></Field>
        <Field label={t.transitPort}><input list="nf-ports" value={d.transit_port} onChange={e => up({ transit_port: e.target.value })} className={`${inputCls} w-full`} /></Field>
        <Field label={`${t.destination} *`} className="sm:col-span-2"><input required list="nf-dests" value={d.destination} onChange={e => up({ destination: e.target.value })} className={`${inputCls} w-full`} /></Field>
        <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-4">
          {PRICE_KEYS.map(k => (
            <Field key={k} label={`${PRICE_LABELS[k]} (EGP)`}>
              <input inputMode="numeric" value={d[k] || ''} placeholder="0" onChange={e => up({ [k]: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 } as Partial<RateDraft>)} className={`${inputCls} w-full text-center font-black tabular-nums`} dir="ltr" />
            </Field>
          ))}
        </div>
        <Field label={t.notes} className="sm:col-span-2"><textarea rows={3} value={d.notes} onChange={e => up({ notes: e.target.value })} className={`${inputCls} w-full`} /></Field>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onCancel} className={btnGhost}>{t.cancel}</button>
          <button disabled={busy} className={btnGold}>{busy ? <DaliLoader size={16} /> : '✓'} {t.save}</button>
        </div>
      </form>
    </Modal>
  );
};

const AdjustDialog: React.FC<{ t: Strings; rows: Rate[]; onClose: () => void; onDone: (r: Rate[]) => void }> = ({ t, rows, onClose, onDone }) => {
  const [mode, setMode] = useState<'pct' | 'amt'>('pct');
  const [value, setValue] = useState('5');
  const [keys, setKeys] = useState<PriceKey[]>([...PRICE_KEYS]);
  const [round, setRound] = useState(50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const v = Number(value) || 0;
  const apply = (p: number) => {
    if (!p) return 0;
    const n = mode === 'pct' ? p * (1 + v / 100) : p + v;
    return Math.max(0, round ? Math.round(n / round) * round : Math.round(n));
  };
  const sample = rows.find(r => keys.some(k => r[k]));
  const run = async () => {
    setBusy(true); setErr('');
    try {
      const changed = rows.map(r => { const c = { ...r }; keys.forEach(k => { c[k] = apply(r[k]); }); return c; });
      onDone(await api.updateRates(changed));
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };
  return (
    <Modal title={t.adjustTitle} onClose={onClose}>
      <p className="text-sm text-slate-600">{t.adjustScope(rows.length)}</p>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <Field label={t.adjustBy}><input value={value} onChange={e => setValue(e.target.value.replace(/[^\d.-]/g, ''))} className={`${inputCls} w-28 text-center font-black`} dir="ltr" /></Field>
        <div className="flex overflow-hidden rounded-xl border border-[#d9d0c0]">
          {(['pct', 'amt'] as const).map(m => <button key={m} onClick={() => setMode(m)} className={`px-4 py-2 text-xs font-black ${mode === m ? 'bg-[#07111f] text-white' : 'bg-white'}`}>{m === 'pct' ? t.percent : t.amount}</button>)}
        </div>
        <Field label={t.roundTo}><select value={round} onChange={e => setRound(Number(e.target.value))} className={inputCls}>{[0, 10, 50, 100, 500].map(n => <option key={n} value={n}>{n || '1'}</option>)}</select></Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {PRICE_KEYS.map(k => (
          <label key={k} className="flex items-center gap-2 rounded-xl border border-[#e3dccf] px-3 py-2 text-xs font-black">
            <input type="checkbox" className="accent-[#c2a378]" checked={keys.includes(k)} onChange={e => setKeys(ks => e.target.checked ? [...ks, k] : ks.filter(x => x !== k))} /><span dir="ltr">{PRICE_LABELS[k]}</span>
          </label>
        ))}
      </div>
      {sample && (
        <div className="mt-5 rounded-xl bg-[#f8f5ef] p-4 text-xs">
          <div className="font-bold">{sample.customer} · {sample.destination}</div>
          <div className="mt-2 flex flex-wrap gap-4 tabular-nums">{keys.filter(k => sample[k]).map(k => <span key={k}><span dir="ltr">{PRICE_LABELS[k]}</span>: {fmt(sample[k])} → <b className="text-[#07111f]">{fmt(apply(sample[k]))}</b></span>)}</div>
        </div>
      )}
      {err && <div className="mt-4 text-xs font-bold text-red-600">{t.failed}: {err}</div>}
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className={btnGhost}>{t.cancel}</button>
        <button onClick={run} disabled={busy || !keys.length || !v} className={btnGold}>{busy && <DaliLoader size={16} />}{t.apply}</button>
      </div>
    </Modal>
  );
};

/* ============================== Customers ============================== */

const Customers: React.FC<{ t: Strings; rates: Rate[]; isAdmin: boolean; onView: (c: string) => void; onQuote: (c: string) => void; setRates: React.Dispatch<React.SetStateAction<Rate[] | null>>; setToast: (s: string) => void }> = ({ t, rates, isAdmin, onView, onQuote, setRates, setToast }) => {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'name' | 'routes' | 'updated'>('routes');
  const list = useMemo(() => {
    const m = new Map<string, { name: string; routes: number; dests: Set<string>; ports: Set<string>; min: number; max: number; updated: string }>();
    rates.forEach(r => {
      const e = m.get(r.customer) || { name: r.customer, routes: 0, dests: new Set<string>(), ports: new Set<string>(), min: Infinity, max: 0, updated: '' };
      e.routes++; e.dests.add(r.destination); if (r.load_port) e.ports.add(r.load_port);
      PRICE_KEYS.forEach(k => { if (r[k] > 0) { e.min = Math.min(e.min, r[k]); e.max = Math.max(e.max, r[k]); } });
      if ((r.updated_at || '') > e.updated) e.updated = r.updated_at || '';
      m.set(r.customer, e);
    });
    const needle = q.trim().toLowerCase();
    return [...m.values()].filter(c => !needle || c.name.toLowerCase().includes(needle)).sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name, 'ar') : sort === 'routes' ? b.routes - a.routes : b.updated.localeCompare(a.updated));
  }, [rates, q, sort]);

  const rename = async (from: string) => {
    const to = window.prompt(t.renamePrompt, from)?.trim();
    if (!to || to === from) return;
    try {
      const updated = await api.updateRates(rates.filter(r => r.customer === from).map(r => ({ ...r, customer: to })));
      const m = new Map(updated.map(r => [r.id, r]));
      setRates(l => (l || []).map(r => m.get(r.id) || r));
      setToast(t.saved);
    } catch (e: any) { setToast(`${t.failed}: ${e.message}`); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} className={`${inputCls} min-w-[240px] flex-1`} />
        <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className={inputCls}>
          <option value="routes">{t.routes} ▼</option><option value="name">{t.customer} A–Z</option><option value="updated">{t.updated} ▼</option>
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map(c => (
          <Card key={c.name} className="flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="text-base font-black text-[#07111f]">{c.name}</div>
              <span className="shrink-0 rounded-full bg-[#f1ebe0] px-2.5 py-1 text-[10px] font-black text-[#8a7350]">{c.routes} {t.routes.toLowerCase()}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-slate-500">
              <div className="rounded-lg bg-[#f8f5ef] p-2"><div className="text-sm font-black text-[#07111f]">{c.dests.size}</div>{t.destinations}</div>
              <div className="rounded-lg bg-[#f8f5ef] p-2"><div className="text-sm font-black text-[#07111f]">{c.ports.size}</div>{t.loadPorts}</div>
              <div className="rounded-lg bg-[#f8f5ef] p-2"><div className="text-sm font-black tabular-nums text-[#07111f]">{c.max ? `${fmt(c.min)}–${fmt(c.max)}` : '—'}</div>EGP</div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 pt-1">
              <button onClick={() => onView(c.name)} className={btnGhost}>{t.viewRates}</button>
              <button onClick={() => onQuote(c.name)} className={btnNavy}>⤓ {t.quote}</button>
              {isAdmin && <button onClick={() => rename(c.name)} className={`${btn} text-[#8a7350] hover:underline`}>{t.rename}</button>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

/* ============================== Export ============================== */

type Fmt = PdfStyle | 'xlsBranded' | 'xlsData' | 'csv' | 'wa';

const ExportDialog: React.FC<{ t: Strings; lang: Lang; rows: Rate[]; customer?: string; initial?: Fmt; onClose: () => void; setToast: (s: string) => void }> = ({ t, lang, rows, customer, initial, onClose, setToast }) => {
  const single = new Set(rows.map(r => r.customer)).size === 1;
  const [style, setStyle] = useState<Fmt>(initial || (single ? 'quote' : 'list'));
  const [docLang, setDocLang] = useState<'ar' | 'en'>('ar');
  const usedKeys = PRICE_KEYS.filter(k => rows.some(r => r[k]));
  const [keys, setKeys] = useState<PriceKey[]>(usedKeys.length ? usedKeys : [...PRICE_KEYS]);
  const [notes, setNotes] = useState(false);
  const [signer, setSigner] = useState(() => { try { return localStorage.getItem('nf_transport_signer') || DEFAULT_SIGNER; } catch { return DEFAULT_SIGNER; } });
  const [validDays, setValidDays] = useState(30);
  const [preview, setPreview] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const quoteCustomer = customer || (single ? rows[0]?.customer : undefined);

  const opts: ExportOptions = { lang: docLang, priceKeys: PRICE_KEYS.filter(k => keys.includes(k)), showNotes: notes, signer, customer: quoteCustomer, validDays };
  const isPdf = style === 'quote' || style === 'list' || style === 'grouped';
  const blocked = style === 'quote' && !single;
  const html = useMemo(() => isPdf && !blocked ? buildPdfHtml(rows, style as PdfStyle, opts) : '', [isPdf, blocked, rows, style, docLang, keys, notes, signer, validDays, quoteCustomer]);

  const go = async () => {
    try { localStorage.setItem('nf_transport_signer', signer); } catch {}
    if (isPdf) {
      if (!preview) { setPreview(true); return; }
      frameRef.current?.contentWindow?.focus();
      frameRef.current?.contentWindow?.print();
      return;
    }
    if (style === 'csv') exportCsv(rows, opts);
    else if (style === 'xlsBranded') await exportExcelBranded(rows, opts);
    else if (style === 'xlsData') await exportExcelData(rows, opts);
    else if (style === 'wa') {
      const text = whatsappText(rows, opts);
      try { await navigator.clipboard.writeText(text); setToast(t.copied); } catch { window.prompt('', text); }
    }
    onClose();
  };

  const formats: [Fmt, string, string, string][] = [
    ['quote', '📄', t.pdfQuote, t.pdfQuoteSub], ['list', '📋', t.pdfList, t.pdfListSub], ['grouped', '🗂', t.pdfGrouped, t.pdfGroupedSub],
    ['xlsBranded', '📊', t.xlsBranded, t.xlsBrandedSub], ['xlsData', '🧮', t.xlsData, t.xlsDataSub], ['csv', '🔤', t.csv, t.csvSub], ['wa', '💬', t.wa, t.waSub],
  ];

  return (
    <Modal title={`${t.exportTitle} · ${rows.length} ${t.rows}${quoteCustomer ? ` · ${quoteCustomer}` : ''}`} onClose={onClose} wide={preview}>
      {preview ? (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button onClick={() => setPreview(false)} className={btnGhost}>{lang === 'ar' ? '→' : '←'} {t.format}</button>
            <button onClick={go} className={`${btnGold} ms-auto`}>⤓ {t.print}</button>
          </div>
          <iframe ref={frameRef} title={t.preview} srcDoc={html} className="h-[70vh] w-full rounded-xl border border-[#e3dccf] bg-white" />
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">{t.format}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {formats.map(([k, icon, title, sub]) => (
                <button key={k} onClick={() => setStyle(k)} className={`flex items-start gap-3 rounded-2xl border p-3 text-start transition ${style === k ? 'border-[#c2a378] bg-[#fbf3e4] ring-2 ring-[#c2a378]/40' : 'border-[#e3dccf] hover:border-[#c2a378]'}`}>
                  <span className="text-xl">{icon}</span><span><span className="block text-sm font-black text-[#07111f]">{title}</span><span className="block text-[11px] text-slate-500">{sub}</span></span>
                </button>
              ))}
            </div>
            {blocked && <div className="mt-2 text-xs font-bold text-amber-700">{t.pickCustomer}</div>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.language}>
              <div className="flex overflow-hidden rounded-xl border border-[#d9d0c0]">
                {(['ar', 'en'] as const).map(l => <button key={l} onClick={() => setDocLang(l)} className={`flex-1 px-4 py-2 text-xs font-black ${docLang === l ? 'bg-[#07111f] text-white' : 'bg-white'}`}>{l === 'ar' ? 'العربية' : 'English'}</button>)}
              </div>
            </Field>
            {style === 'quote' && <Field label={t.validity}><input type="number" min={0} value={validDays} onChange={e => setValidDays(Number(e.target.value) || 0)} className={`${inputCls} w-full`} /></Field>}
            <Field label={t.signer}><input value={signer} onChange={e => setSigner(e.target.value)} className={`${inputCls} w-full`} /></Field>
          </div>
          {style !== 'xlsData' && (
            <div>
              <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">{t.columns}</div>
              <div className="flex flex-wrap gap-2">
                {PRICE_KEYS.map(k => (
                  <label key={k} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${keys.includes(k) ? 'border-[#c2a378] bg-[#fbf3e4]' : 'border-[#e3dccf]'}`}>
                    <input type="checkbox" className="accent-[#c2a378]" checked={keys.includes(k)} onChange={e => setKeys(ks => e.target.checked ? [...ks, k] : ks.filter(x => x !== k))} /><span dir="ltr">{PRICE_LABELS[k]}</span>
                  </label>
                ))}
                <label className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${notes ? 'border-amber-400 bg-amber-50' : 'border-[#e3dccf]'}`}>
                  <input type="checkbox" className="accent-amber-500" checked={notes} onChange={e => setNotes(e.target.checked)} />{t.includeNotes}
                </label>
              </div>
              {notes && <div className="mt-2 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">⚠ {t.notesWarn}</div>}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className={btnGhost}>{t.cancel}</button>
            <button onClick={go} disabled={blocked || (!keys.length && style !== 'xlsData')} className={btnGold}>{isPdf ? `👁 ${t.preview}` : `⤓ ${t.download}`}</button>
          </div>
        </div>
      )}
    </Modal>
  );
};

