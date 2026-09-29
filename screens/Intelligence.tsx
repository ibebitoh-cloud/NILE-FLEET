
import React, { useState, useContext, useMemo, useEffect } from 'react';
import { db } from '../services/supabaseDb';
import { LanguageContext, ThemeContext } from '../App';
import { translations } from '../translations';
import { Operation } from '../types';
import { runThinkingAudit, getSafeApiKey } from '../services/aiService';

const Intelligence: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const { theme } = useContext(ThemeContext);
  const isDark = ['black', 'midnight', 'nile', 'carbon', 'royal', 'crimson'].includes(theme);
  const t = translations[lang];
  const isAr = lang === 'ar';
  
  const [activeView, setActiveView] = useState<'PORT' | 'UNIT' | 'SUPPLIER' | 'COSTS'>('PORT');
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingPhase, setThinkingPhase] = useState(0);
  const [advice, setAdvice] = useState<string>('');
  const [linkError, setLinkError] = useState(false);
  const apiKeySet = true; // DALI 1.0 uses the server-side Cloudflare AI binding; no browser key is required.

  const phases = isAr 
    ? ["مسح قياسات الميناء...", "عزل إشارات التكلفة...", "تحليل سجلات الأسطول...", "توليد الرؤى الاستراتيجية..."]
    : ["SCANNING HUB TELEMETRY...", "ISOLATING COST SIGNALS...", "ANALYZING FLEET LOGS...", "GENERATING STRATEGIC INSIGHTS..."];

  const gasByPort = db.getGasByPort();
  const gasByUnit = db.getGasByGenset();
  const oktan = db.getOktanEstimate();
  const ops = db.getOperations();

  const analytics = useMemo(() => {
    const today = new Date();
    const activeOps = ops.filter(o => o.status === 'IN PROGRESS');
    const completedOps = ops.filter(o => o.status === 'DONE');
    const underOperate = ops.filter(o => o.status === 'UNDER OPERATE');
    const holdOps = ops.filter(o => o.status === 'HOLD');
    const cancelledOps = ops.filter(o => o.status === 'CANCEL');
    const totalRevenue = completedOps.reduce((s, o) => s + (parseFloat(String(o.rate).replace(/,/g, '')) || 0) + (parseFloat(String(o.vat).replace(/,/g, '')) || 0), 0);
    const activeRevenue = activeOps.reduce((s, o) => s + (parseFloat(String(o.rate).replace(/,/g, '')) || 0) + (parseFloat(String(o.vat).replace(/,/g, '')) || 0), 0);
    const invoiced = db.getInvoices();
    const unpaidInvoices = invoiced.filter(i => i.status === 'UNPAID');
    const overdueInvoices = unpaidInvoices.filter(i => i.dueDate && new Date(i.dueDate) < today);
    const outstanding = unpaidInvoices.reduce((s, i) => s + (Number(i.amount) || 0), 0);

    const duplicateMap: Record<string, Operation[]> = {};
    activeOps.forEach(o => {
      const key = o.gensetNumber?.trim().toUpperCase();
      if (key) (duplicateMap[key] ||= []).push(o);
    });
    const duplicateUnits = Object.entries(duplicateMap).filter(([, rows]) => rows.length > 1);

    const missingData = {
      container: ops.filter(o => !o.containerNumber?.trim()).length,
      genset: ops.filter(o => !o.gensetNumber?.trim()).length,
      rate: ops.filter(o => !String(o.rate || '').trim()).length,
      trucker: ops.filter(o => !o.trucker?.trim()).length,
      clipOff: ops.filter(o => o.status === 'DONE' && !o.clipOffDate).length
    };

    const portStats = Object.entries(gasByPort).map(([port, fuel]) => {
      const portActive = activeOps.filter(o => o.clipOnPort === port).length;
      const portDone = completedOps.filter(o => o.clipOnPort === port).length;
      const portStock = db.getStock().filter(g => g.location === port && g.status === 'IN_STOCK').length;
      return { port, fuel, active: portActive, done: portDone, stock: portStock };
    }).sort((a, b) => b.active - a.active);

    const customerMap: Record<string, { customer: string; ops: number; done: number; revenue: number; outstanding: number }> = {};
    ops.forEach(o => {
      const key = o.customerName || 'UNKNOWN';
      const row = customerMap[key] ||= { customer: key, ops: 0, done: 0, revenue: 0, outstanding: 0 };
      row.ops++;
      if (o.status === 'DONE') {
        row.done++;
        row.revenue += (parseFloat(String(o.rate).replace(/,/g, '')) || 0) + (parseFloat(String(o.vat).replace(/,/g, '')) || 0);
      }
    });
    unpaidInvoices.forEach(i => {
      const row = customerMap[i.customerName] ||= { customer: i.customerName, ops: 0, done: 0, revenue: 0, outstanding: 0 };
      row.outstanding += Number(i.amount) || 0;
    });

    const maintenance = db.getMaintenanceLogs();
    const dueMaintenance = db.getStock().filter(g => g.nextMaintenanceDue && new Date(g.nextMaintenanceDue) <= today && g.status !== 'RETIRED').length;
    const maintenanceInProgress = maintenance.filter(m => m.status === 'IN_PROGRESS').length;
    const pendingReservations = db.getReservations().filter(r => r.status === 'PENDING' || r.status === 'APPROVED').length;
    const fleet = db.getStock();
    const fleetTotal = fleet.length;
    const fleetInStock = fleet.filter(g => g.status === 'IN_STOCK').length;
    const fleetActive = fleet.filter(g => g.status === 'CLIPPED_ON').length;
    const fleetMaintenance = fleet.filter(g => g.status === 'MAINTENANCE').length;
    const fleetRetired = fleet.filter(g => g.status === 'RETIRED').length;

    return {
      activeOps, completedOps, underOperate, holdOps, cancelledOps,
      totalRevenue, activeRevenue, unpaidInvoices, overdueInvoices, outstanding,
      duplicateUnits, missingData, portStats,
      topCustomers: Object.values(customerMap).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
      dueMaintenance, maintenanceInProgress, pendingReservations,
      fleetTotal, fleetInStock, fleetActive, fleetMaintenance, fleetRetired,
      completionRate: ops.length ? (completedOps.length / ops.length) * 100 : 0,
      cancellationRate: ops.length ? (cancelledOps.length / ops.length) * 100 : 0,
      averageRevenuePerDone: completedOps.length ? totalRevenue / completedOps.length : 0
    };
  }, [ops, gasByPort, gasByUnit]);

  const expenseTotals = useMemo(() => ({
    procurement: db.getProcurements().reduce((s, p) => s + p.amount, 0),
    food: db.getFoodExpenses().reduce((s, f) => s + f.amount, 0),
    transport: db.getTransportExpenses().reduce((s, t) => s + t.amount, 0),
    rent: db.getPortRents().reduce((s, r) => s + r.amount, 0),
    fuel: oktan.balance
  }), [oktan.balance]);

  const runStrategicAdvisor = async () => {
    setIsThinking(true);
    setLinkError(false);
    setAdvice('');

    const phaseInterval = setInterval(() => {
      setThinkingPhase(prev => (prev + 1) % phases.length);
    }, 1200);

    const viewConfig = {
      PORT: {
        en: 'PORTS',
        ar: 'الموانئ',
        instruction: 'Analyze ONLY port operations: active/completed operations by port, genset stock by port, fuel consumption by port, and port-specific operational issues.'
      },
      UNIT: {
        en: 'FLEET ASSETS',
        ar: 'أصول الأسطول',
        instruction: 'Analyze ONLY genset/fleet assets: total fleet, stock, clipped-on, maintenance, retired, duplicate active assignments, utilization, and individual-unit signals.'
      },
      SUPPLIER: {
        en: 'FUEL LEDGER',
        ar: 'سجل الوقود',
        instruction: 'Analyze ONLY fuel: gas by port, gas by genset, gas balance, fuel concentration, and estimated coverage.'
      },
      COSTS: {
        en: 'OPERATIONS',
        ar: 'العمليات',
        instruction: 'Analyze ONLY operations: total, active, completed, under-operate, hold, cancelled, completion/cancellation rates, operation values, and data-quality issues affecting operations.'
      }
    }[activeView];

    try {
      const viewData = activeView === 'PORT'
        ? { portStats: analytics.portStats, gasByPort }
        : activeView === 'UNIT'
        ? { fleet: { total: analytics.fleetTotal, inStock: analytics.fleetInStock, clippedOn: analytics.fleetActive, maintenance: analytics.fleetMaintenance, retired: analytics.fleetRetired, duplicateActiveGensets: analytics.duplicateUnits }, gasByGenset: gasByUnit }
        : activeView === 'SUPPLIER'
        ? { gasByPort, gasByGenset: gasByUnit, gasBalance: db.getGasBalance(), oktan }
        : { operations: ops, summary: { total: ops.length, active: analytics.activeOps.length, completed: analytics.completedOps.length, underOperate: analytics.underOperate.length, hold: analytics.holdOps.length, cancelled: analytics.cancelledOps.length, completionRate: analytics.completionRate, cancellationRate: analytics.cancellationRate, completedRevenue: analytics.totalRevenue, activeExposure: analytics.activeRevenue, missingData: analytics.missingData } };

      const prompt = `You are DALI 1.0, NILE FLEET Command Intelligence.

CURRENT VIEW: ${viewConfig.en}
SCOPE: ${viewConfig.instruction}

CRITICAL: Answer ONLY for the current view. NEVER produce a complete company report. NEVER discuss unrelated categories.
LANGUAGE: ${isAr ? 'Arabic only, professional Arabic.' : 'English only, professional English.'}
Use ONLY supplied live data. Never invent or estimate.
Give the answer FIRST. Normally use 3-7 concise bullets.
If there is no important issue, give only the key numbers for this view.
Preserve booking/container/genset IDs, dates and numbers exactly.
Do not output Python code.

LIVE DATA:
${JSON.stringify(viewData)}`;

      const result = await runThinkingAudit(prompt, 900);
      setAdvice(result || (isAr ? 'لا توجد نتائج إضافية مهمة لهذا القسم.' : 'No additional important findings for this section.'));
    } catch (err) {
      setLinkError(true);
      setAdvice(isAr ? 'تعذر الاتصال بـ DALI 1.0. أعد المحاولة.' : 'DALI 1.0 connection failed. Please retry.');
    } finally {
      clearInterval(phaseInterval);
      setIsThinking(false);
    }
  };

  const NavButton = ({ id, label }: { id: typeof activeView, label: string }) => (
    <button 
      onClick={() => setActiveView(id)}
      className={`relative px-6 py-4 transition-all duration-300 group ${activeView === id ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
    >
      <span className="relative z-10 font-black text-[10px] tracking-widest uppercase">{label}</span>
      {activeView === id && (
        <div className="absolute inset-0 bg-blue-600/20 border-b-2 border-[#C2A378] animate-in fade-in duration-300"></div>
      )}
    </button>
  );

  const activeConfig = {
    PORT: {
      icon: '⚓',
      en: 'PORT CONTROL',
      ar: 'تحكم الموانئ',
      subtitleEn: 'Live activity, stock position and fuel by port',
      subtitleAr: 'التشغيل والمخزون والوقود حسب كل ميناء'
    },
    UNIT: {
      icon: '⚙️',
      en: 'FLEET ASSETS',
      ar: 'أصول الأسطول',
      subtitleEn: 'Genset availability, utilization and conflicts',
      subtitleAr: 'توافر المولدات والتشغيل والتعارضات'
    },
    SUPPLIER: {
      icon: '⛽',
      en: 'FUEL LEDGER',
      ar: 'سجل الوقود',
      subtitleEn: 'Fuel consumption, balance and coverage',
      subtitleAr: 'الاستهلاك والرصيد والتغطية'
    },
    COSTS: {
      icon: '📋',
      en: 'OPERATIONS',
      ar: 'العمليات',
      subtitleEn: 'Status, throughput, values and data quality',
      subtitleAr: 'الحالات والحجم والقيم وجودة البيانات'
    }
  }[activeView];

  const money = (n: number) => `EGP ${Math.round(Number(n) || 0).toLocaleString()}`;
  const pct = (n: number) => `${Math.round(Number(n) || 0)}%`;
  const safeFuel = (n: any) => Number(n) || 0;

  const kpis = activeView === 'PORT'
    ? [
        { label: isAr ? 'الموانئ النشطة' : 'ACTIVE PORTS', value: analytics.portStats.filter(p => p.active > 0).length, icon: '⚓' },
        { label: isAr ? 'تشغيل نشط' : 'ACTIVE OPS', value: analytics.activeOps.length, icon: '⚡' },
        { label: isAr ? 'مكتمل' : 'COMPLETED', value: analytics.completedOps.length, icon: '✓' },
        { label: isAr ? 'وقود مسجل' : 'FUEL LOGGED', value: `${Object.values(gasByPort).reduce<number>((s, v) => s + safeFuel(v), 0).toLocaleString()} L`, icon: '⛽' }
      ]
    : activeView === 'UNIT'
    ? [
        { label: isAr ? 'إجمالي المولدات' : 'TOTAL GENSET', value: analytics.fleetTotal, icon: '⚙️' },
        { label: isAr ? 'في المخزون' : 'IN STOCK', value: analytics.fleetInStock, icon: '📦' },
        { label: isAr ? 'على التشغيل' : 'CLIPPED ON', value: analytics.fleetActive, icon: '🔌' },
        { label: isAr ? 'تعارضات نشطة' : 'ACTIVE CONFLICTS', value: analytics.duplicateUnits.length, icon: '🚨' }
      ]
    : activeView === 'SUPPLIER'
    ? [
        { label: isAr ? 'رصيد الوقود' : 'FUEL BALANCE', value: money(oktan.balance), icon: '⛽' },
        { label: isAr ? 'التغطية' : 'COVERAGE', value: `${oktan.daysRemaining || 0} ${isAr ? 'يوم' : 'days'}`, icon: '📅' },
        { label: isAr ? 'استهلاك مسجل' : 'LOGGED CONSUMPTION', value: `${Object.values(gasByPort).reduce<number>((s, v) => s + safeFuel(v), 0).toLocaleString()} L`, icon: '🔥' },
        { label: isAr ? 'المولدات المسجلة' : 'UNITS WITH FUEL', value: gasByUnit.length, icon: '⚙️' }
      ]
    : [
        { label: isAr ? 'إجمالي العمليات' : 'TOTAL OPS', value: ops.length, icon: '📋' },
        { label: isAr ? 'نشط الآن' : 'ACTIVE NOW', value: analytics.activeOps.length, icon: '⚡' },
        { label: isAr ? 'نسبة الإنجاز' : 'COMPLETION', value: pct(analytics.completionRate), icon: '✓' },
        { label: isAr ? 'بيانات ناقصة' : 'MISSING DATA', value: Object.values(analytics.missingData).reduce<number>((s, v) => s + Number(v || 0), 0), icon: '🧹' }
      ];

  const portRows = analytics.portStats;
  const unitRows = [...gasByUnit].sort((a, b) => safeFuel(b.gas) - safeFuel(a.gas)).slice(0, 20);
  const fuelRows = [...gasByUnit].sort((a, b) => safeFuel(b.gas) - safeFuel(a.gas)).slice(0, 12);

  const navLabel = (id: typeof activeView) => {
    const labels = {
      PORT: isAr ? 'الموانئ' : 'PORTS',
      UNIT: isAr ? 'أصول الأسطول' : 'FLEET ASSETS',
      SUPPLIER: isAr ? 'سجل الوقود' : 'FUEL LEDGER',
      COSTS: isAr ? 'العمليات' : 'OPERATIONS'
    };
    return labels[id];
  };

  const cardClass = isDark
    ? 'bg-slate-900/80 border-white/10'
    : 'bg-white border-slate-200';
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-500';
  const primaryClass = isDark ? 'text-white' : 'text-[#001F3F]';

  return (
    <div className={`min-h-screen pb-32 text-start ${isAr ? 'rtl font-cairo' : 'ltr'}`}>
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#001F3F] shadow-2xl">
        <div className="absolute -top-28 -right-28 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl"></div>
        <div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-[#C2A378]/10 blur-3xl"></div>
        <div className="relative z-10 p-6 md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-2xl">
                🛰️
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-black italic tracking-tight text-white uppercase">
                    {isAr ? 'ذكاء الأسطول' : 'FLEET INTELLIGENCE'}
                  </h1>
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-emerald-300">
                    DALI 1.0
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.25em] text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                  {isAr ? 'بيانات مباشرة • جاهز للتحليل' : 'LIVE DATA • READY FOR ANALYSIS'}
                </div>
                <p className="mt-3 max-w-2xl text-[10px] font-bold leading-relaxed text-slate-300">
                  {isAr ? activeConfig.subtitleAr : activeConfig.subtitleEn}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 rounded-2xl border border-white/10 bg-black/20 p-1">
              {(['PORT', 'UNIT', 'SUPPLIER', 'COSTS'] as const).map(id => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setActiveView(id); setAdvice(''); setLinkError(false); }}
                  className={`min-w-[90px] rounded-xl px-3 py-3 transition-all ${activeView === id ? 'bg-[#C2A378] text-[#001F3F] shadow-lg' : 'text-slate-300 hover:bg-white/10'}`}
                >
                  <div className="text-sm">{id === activeView ? activeConfig.icon : ({PORT:'⚓',UNIT:'⚙️',SUPPLIER:'⛽',COSTS:'📋'} as any)[id]}</div>
                  <div className="mt-1 text-[8px] font-black uppercase tracking-widest">{navLabel(id)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(k => (
          <div key={k.label} className={`rounded-2xl border p-4 shadow-sm ${cardClass}`}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-xl">{k.icon}</span>
              <span className={`text-[8px] font-black uppercase tracking-widest text-end ${mutedClass}`}>{k.label}</span>
            </div>
            <div className={`mt-3 text-xl md:text-2xl font-black ${primaryClass}`}>{k.value}</div>
          </div>
        ))}
      </section>

      <section className="mt-5 grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 space-y-5">
          {activeView === 'PORT' && (
            <>
              <div className={`rounded-[2rem] border p-5 md:p-6 shadow-sm ${cardClass}`}>
                <div className="mb-5 flex items-end justify-between gap-3">
                  <div>
                    <h2 className={`text-lg font-black uppercase tracking-tight ${primaryClass}`}>{isAr ? 'خريطة الموانئ الحية' : 'LIVE PORT MATRIX'}</h2>
                    <p className={`mt-1 text-[9px] font-bold uppercase tracking-widest ${mutedClass}`}>{isAr ? 'تشغيل • مكتمل • مخزون • وقود' : 'ACTIVE • COMPLETED • STOCK • FUEL'}</p>
                  </div>
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-[9px] font-black text-blue-500">{portRows.length} {isAr ? 'موانئ' : 'PORTS'}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-[10px]">
                    <thead className={`border-b ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                      <tr>
                        <th className="px-3 py-3 text-start font-black uppercase">{isAr ? 'الميناء' : 'PORT'}</th>
                        <th className="px-3 py-3 text-end font-black uppercase">{isAr ? 'نشط' : 'ACTIVE'}</th>
                        <th className="px-3 py-3 text-end font-black uppercase">{isAr ? 'مكتمل' : 'DONE'}</th>
                        <th className="px-3 py-3 text-end font-black uppercase">{isAr ? 'المخزون' : 'STOCK'}</th>
                        <th className="px-3 py-3 text-end font-black uppercase">{isAr ? 'الوقود' : 'FUEL'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portRows.map(row => (
                        <tr key={row.port} className={`border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                          <td className={`px-3 py-3 font-black ${primaryClass}`}>{row.port}</td>
                          <td className="px-3 py-3 text-end font-black text-blue-500">{row.active}</td>
                          <td className="px-3 py-3 text-end font-black text-emerald-500">{row.done}</td>
                          <td className="px-3 py-3 text-end font-black text-amber-500">{row.stock}</td>
                          <td className="px-3 py-3 text-end font-black text-[#C2A378]">{safeFuel(row.fuel).toLocaleString()} L</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className={`rounded-[2rem] border p-5 shadow-sm ${cardClass}`}>
                <h3 className={`mb-4 text-sm font-black uppercase ${primaryClass}`}>{isAr ? 'تنبيهات الميناء' : 'PORT SIGNALS'}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {portRows.map(row => (
                    <div key={row.port} className={`rounded-xl border p-3 ${isDark ? 'border-white/5 bg-black/20' : 'border-slate-100 bg-slate-50'}`}>
                      <div className="flex justify-between gap-3">
                        <span className={`font-black ${primaryClass}`}>{row.port}</span>
                        <span className="text-[9px] font-black text-blue-500">{row.active} {isAr ? 'نشط' : 'ACTIVE'}</span>
                      </div>
                      <div className={`mt-2 text-[9px] font-bold ${mutedClass}`}>
                        {row.stock === 0 ? (isAr ? 'لا يوجد مخزون متاح حالياً' : 'No genset stock currently available') :
                         row.active === 0 ? (isAr ? 'لا توجد عمليات نشطة حالياً' : 'No active operations currently') :
                         (isAr ? 'تشغيل نشط متاح للميناء' : 'Active operation load is present')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeView === 'UNIT' && (
            <>
              <div className={`rounded-[2rem] border p-5 md:p-6 shadow-sm ${cardClass}`}>
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div>
                    <h2 className={`text-lg font-black uppercase ${primaryClass}`}>{isAr ? 'تشغيل أصول الأسطول' : 'FLEET ASSET CONTROL'}</h2>
                    <p className={`mt-1 text-[9px] font-bold uppercase tracking-widest ${mutedClass}`}>{isAr ? 'حسب استهلاك الوقود المسجل' : 'SORTED BY LOGGED FUEL USAGE'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    ['IN STOCK', analytics.fleetInStock, '📦'],
                    ['CLIPPED ON', analytics.fleetActive, '🔌'],
                    ['MAINTENANCE', analytics.fleetMaintenance, '🛠️'],
                    ['RETIRED', analytics.fleetRetired, '⛔']
                  ].map(([label, value, icon]) => (
                    <div key={String(label)} className={`rounded-xl p-3 ${isDark ? 'bg-black/20' : 'bg-slate-50'}`}>
                      <div className="text-sm">{icon}</div>
                      <div className={`mt-2 text-xl font-black ${primaryClass}`}>{value}</div>
                      <div className={`text-[8px] font-black uppercase tracking-widest ${mutedClass}`}>{isAr ? ({'IN STOCK':'في المخزون','CLIPPED ON':'على التشغيل','MAINTENANCE':'صيانة','RETIRED':'متقاعد'} as any)[label] : label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`rounded-[2rem] border p-5 shadow-sm ${cardClass}`}>
                <h3 className={`mb-4 text-sm font-black uppercase ${primaryClass}`}>{isAr ? 'أعلى استهلاك حسب المولد' : 'TOP GENSET FUEL USAGE'}</h3>
                <div className="space-y-2">
                  {unitRows.length === 0 && <p className={`text-[10px] font-bold ${mutedClass}`}>{isAr ? 'لا توجد بيانات وقود مسجلة.' : 'No fuel data recorded.'}</p>}
                  {unitRows.map((u, i) => (
                    <div key={u.unit || i} className={`flex items-center gap-3 rounded-xl border p-3 ${isDark ? 'border-white/5 bg-black/20' : 'border-slate-100 bg-slate-50'}`}>
                      <span className="w-7 text-[9px] font-black text-slate-400">#{i + 1}</span>
                      <span className={`flex-1 font-black ${primaryClass}`}>{u.unit}</span>
                      <span className="font-black text-[#C2A378]">{safeFuel(u.gas).toLocaleString()} L</span>
                    </div>
                  ))}
                </div>
              </div>
              {analytics.duplicateUnits.length > 0 && (
                <div className="rounded-[2rem] border border-rose-500/30 bg-rose-500/5 p-5">
                  <h3 className="text-sm font-black uppercase text-rose-500">{isAr ? 'تعارضات التعيين النشطة' : 'ACTIVE ASSIGNMENT CONFLICTS'}</h3>
                  <div className="mt-3 space-y-2">
                    {analytics.duplicateUnits.map(([unit, rows]) => (
                      <div key={unit} className="rounded-xl border border-rose-500/20 p-3 text-[9px]">
                        <div className="font-black text-rose-500">{unit} • {rows.length} {isAr ? 'عمليات نشطة' : 'ACTIVE OPS'}</div>
                        <div className={`mt-1 font-bold ${mutedClass}`}>{rows.map(r => r.bookingNumber).filter(Boolean).join(' • ')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeView === 'SUPPLIER' && (
            <>
              <div className={`rounded-[2rem] border p-5 md:p-6 shadow-sm ${cardClass}`}>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className={`text-lg font-black uppercase ${primaryClass}`}>{isAr ? 'مراقبة الوقود' : 'FUEL CONTROL BOARD'}</h2>
                    <p className={`mt-1 text-[9px] font-bold uppercase tracking-widest ${mutedClass}`}>{isAr ? 'الاستهلاك الفعلي المسجل من السجلات' : 'ACTUAL LOGGED CONSUMPTION'}</p>
                  </div>
                  <span className="text-2xl">⛽</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(gasByPort).map(([port, fuel]) => {
                    const total = Math.max(...Object.values(gasByPort).map(safeFuel), 1);
                    const width = Math.min(100, (safeFuel(fuel) / total) * 100);
                    return (
                      <div key={port} className={`rounded-2xl border p-4 ${isDark ? 'border-white/5 bg-black/20' : 'border-slate-100 bg-slate-50'}`}>
                        <div className="flex justify-between gap-3 text-[9px] font-black uppercase">
                          <span className={primaryClass}>{port}</span>
                          <span className="text-[#C2A378]">{safeFuel(fuel).toLocaleString()} L</span>
                        </div>
                        <div className={`mt-3 h-2 overflow-hidden rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${width}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className={`rounded-[2rem] border p-5 shadow-sm ${cardClass}`}>
                <h3 className={`text-sm font-black uppercase ${primaryClass}`}>{isAr ? 'أعلى استهلاك للمولدات' : 'TOP UNIT CONSUMPTION'}</h3>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {fuelRows.map(u => (
                    <div key={u.unit} className={`flex justify-between rounded-xl p-3 ${isDark ? 'bg-black/20' : 'bg-slate-50'}`}>
                      <span className={`font-black text-[10px] ${primaryClass}`}>{u.unit}</span>
                      <span className="font-black text-[10px] text-[#C2A378]">{safeFuel(u.gas).toLocaleString()} L</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeView === 'COSTS' && (
            <>
              <div className={`rounded-[2rem] border p-5 md:p-6 shadow-sm ${cardClass}`}>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className={`text-lg font-black uppercase ${primaryClass}`}>{isAr ? 'لوحة العمليات' : 'OPERATIONS CONTROL BOARD'}</h2>
                    <p className={`mt-1 text-[9px] font-bold uppercase tracking-widest ${mutedClass}`}>{isAr ? 'الحجم والحالات والقيمة وجودة البيانات' : 'VOLUME • STATUS • VALUE • DATA QUALITY'}</p>
                  </div>
                  <span className="text-2xl">📋</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    [isAr ? 'تحت التشغيل' : 'UNDER OPERATE', analytics.underOperate.length],
                    [isAr ? 'قيد التنفيذ' : 'IN PROGRESS', analytics.activeOps.length],
                    [isAr ? 'مكتمل' : 'DONE', analytics.completedOps.length],
                    [isAr ? 'ملغى' : 'CANCEL', analytics.cancelledOps.length]
                  ].map(([label, value]) => (
                    <div key={String(label)} className={`rounded-xl p-4 text-center ${isDark ? 'bg-black/20' : 'bg-slate-50'}`}>
                      <div className={`text-2xl font-black ${primaryClass}`}>{value}</div>
                      <div className={`mt-1 text-[8px] font-black uppercase ${mutedClass}`}>{label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className={`rounded-xl border p-4 ${isDark ? 'border-white/5' : 'border-slate-100'}`}><span className={`text-[8px] font-black uppercase ${mutedClass}`}>{isAr ? 'إيراد مكتمل' : 'COMPLETED REVENUE'}</span><div className={`mt-2 text-lg font-black ${primaryClass}`}>{money(analytics.totalRevenue)}</div></div>
                  <div className={`rounded-xl border p-4 ${isDark ? 'border-white/5' : 'border-slate-100'}`}><span className={`text-[8px] font-black uppercase ${mutedClass}`}>{isAr ? 'قيمة نشطة' : 'ACTIVE EXPOSURE'}</span><div className={`mt-2 text-lg font-black ${primaryClass}`}>{money(analytics.activeRevenue)}</div></div>
                  <div className={`rounded-xl border p-4 ${isDark ? 'border-white/5' : 'border-slate-100'}`}><span className={`text-[8px] font-black uppercase ${mutedClass}`}>{isAr ? 'المستحق بالفواتير' : 'INVOICE OUTSTANDING'}</span><div className="mt-2 text-lg font-black text-amber-500">{money(analytics.outstanding)}</div></div>
                </div>
              </div>
              <div className={`rounded-[2rem] border p-5 shadow-sm ${cardClass}`}>
                <h3 className={`mb-4 text-sm font-black uppercase ${primaryClass}`}>{isAr ? 'جودة بيانات العمليات' : 'OPERATION DATA QUALITY'}</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {[
                    [isAr ? 'حاوية' : 'CONTAINER', analytics.missingData.container],
                    [isAr ? 'مولد' : 'GENSET', analytics.missingData.genset],
                    [isAr ? 'سعر' : 'RATE', analytics.missingData.rate],
                    [isAr ? 'سائق/ناقل' : 'TRUCKER', analytics.missingData.trucker],
                    [isAr ? 'خروج' : 'CLIP-OFF', analytics.missingData.clipOff]
                  ].map(([label, value]) => (
                    <div key={String(label)} className={`rounded-xl p-3 text-center ${Number(value) ? 'bg-rose-500/10' : isDark ? 'bg-black/20' : 'bg-emerald-50'}`}>
                      <div className={`text-xl font-black ${Number(value) ? 'text-rose-500' : 'text-emerald-500'}`}>{value}</div>
                      <div className={`mt-1 text-[8px] font-black uppercase ${mutedClass}`}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <aside className="xl:col-span-4">
          <div className="sticky top-5 rounded-[2rem] bg-[#001F3F] p-5 md:p-6 shadow-2xl border border-white/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🧠</span>
                  <h2 className="text-sm font-black uppercase tracking-widest text-white">{isAr ? 'DALI 1.0' : 'DALI 1.0'}</h2>
                </div>
                <p className="mt-1 text-[8px] font-black uppercase tracking-[0.2em] text-blue-300">{isAr ? activeConfig.ar : activeConfig.en}</p>
              </div>
              <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[7px] font-black uppercase text-emerald-300">READY</span>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 min-h-[420px] max-h-[560px] overflow-y-auto">
              {isThinking ? (
                <div className="flex min-h-[380px] items-center justify-center text-center">
                  <div>
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-400/20 border-t-blue-400"></div>
                    <p className="mt-4 text-[9px] font-black uppercase tracking-widest text-blue-300">{phases[thinkingPhase]}</p>
                    <p className="mt-2 text-[8px] font-bold text-slate-500">{isAr ? 'جاري تحليل هذا القسم فقط...' : 'Analyzing this section only...'}</p>
                  </div>
                </div>
              ) : linkError ? (
                <div className="flex min-h-[380px] flex-col items-center justify-center text-center">
                  <span className="text-4xl">📡</span>
                  <p className="mt-3 text-[10px] font-black uppercase text-rose-400">{isAr ? 'فشل اتصال DALI 1.0' : 'DALI 1.0 CONNECTION FAILED'}</p>
                  <p className="mt-2 max-w-xs text-[9px] font-bold leading-relaxed text-slate-400">{advice}</p>
                  <button type="button" onClick={runStrategicAdvisor} className="mt-5 rounded-xl bg-white/10 px-5 py-2.5 text-[8px] font-black uppercase tracking-widest text-white hover:bg-white/15">
                    {isAr ? 'إعادة المحاولة' : 'RETRY'}
                  </button>
                </div>
              ) : advice ? (
                <div className="whitespace-pre-wrap text-[11px] font-bold leading-7 text-slate-200">{advice}</div>
              ) : (
                <div className="flex min-h-[380px] flex-col items-center justify-center text-center">
                  <span className="text-5xl opacity-30">{activeConfig.icon}</span>
                  <p className="mt-4 text-[10px] font-black uppercase tracking-[0.25em] text-slate-300">{isAr ? activeConfig.ar : activeConfig.en}</p>
                  <p className="mt-2 max-w-xs text-[8px] font-bold leading-relaxed text-slate-500">{isAr ? 'اضغط تحليل القسم للحصول على قراءة مركزة لهذا القسم فقط.' : 'Run analysis to get a focused reading of this section only.'}</p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={runStrategicAdvisor}
              disabled={isThinking}
              className="mt-4 w-full rounded-2xl bg-[#C2A378] py-4 text-[9px] font-black uppercase tracking-[0.3em] text-[#001F3F] shadow-lg transition-all hover:brightness-105 disabled:opacity-40"
            >
              {isThinking ? (isAr ? 'جاري التحليل...' : 'ANALYZING...') : (isAr ? `حلل ${activeConfig.ar}` : `ANALYZE ${activeConfig.en}`)}
            </button>

            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-[7px] font-black uppercase tracking-widest text-slate-500">{isAr ? 'مصدر البيانات' : 'DATA SOURCE'}</span>
              <span className="text-[8px] font-black text-emerald-300">NILE FLEET • LIVE</span>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
};

export default Intelligence;
