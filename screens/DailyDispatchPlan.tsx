import React, { useContext, useMemo, useState } from 'react';
import { db } from '../services/supabaseDb';
import { Location, Operation } from '../types';
import { LanguageContext, ThemeContext } from '../App';
import { translateEntity } from '../translations';

const PORTS: Location[] = [
  Location.GOUDA,
  Location.SCCT,
  Location.PSD,
  Location.DAM,
  Location.ALEX,
  Location.SOKHNA,
  Location.WORKSHOP,
];

const PORT_NAME_AR: Record<string, string> = {
  [Location.GOUDA]: 'بورسعيد غرب جودة',
  [Location.SCCT]: 'بورسعيد شرق',
  [Location.PSD]: 'بورسعيد',
  [Location.DAM]: 'دمياط',
  [Location.ALEX]: 'الإسكندرية',
  [Location.SOKHNA]: 'السخنة',
  [Location.WORKSHOP]: 'الورشة',
};

const localDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());

const uniqueJoin = (values: string[]) =>
  Array.from(new Set(values.map(v => String(v || '').trim()).filter(Boolean))).join(' / ') || '—';

const dateForOperation = (op: Operation) => op.operationDate || op.dateReceived || '';

const statusClass = (status: Operation['status']) => {
  if (status === 'IN PROGRESS') return 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900';
  if (status === 'UNDER OPERATE') return 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900';
  if (status === 'DONE') return 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900';
  return 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700';
};

interface DispatchGroup {
  booking: string;
  customer: string;
  shipper: string;
  trucker: string;
  containers: string[];
  gensets: string[];
  statuses: Operation['status'][];
  items: Operation[];
}

const DailyDispatchPlan: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const { theme } = useContext(ThemeContext);
  const isAr = lang === 'ar';
  const isDark = theme !== 'day' && theme !== 'light';
  const [selectedDate, setSelectedDate] = useState(localDate);
  const [activeOnly, setActiveOnly] = useState(true);
  const [search, setSearch] = useState('');

  const operations = db.getOperations();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return operations.filter(op => {
      if (dateForOperation(op) !== selectedDate) return false;
      if (op.status === 'CANCEL') return false;
      if (activeOnly && op.status !== 'UNDER OPERATE' && op.status !== 'IN PROGRESS') return false;
      if (!q) return true;
      return [
        op.bookingNumber,
        op.customerName,
        op.beneficiaryName,
        op.trucker,
        op.containerNumber,
        op.gensetNumber,
      ].some(value => String(value || '').toLowerCase().includes(q));
    });
  }, [operations, selectedDate, activeOnly, search]);

  const byPort = useMemo(() => {
    const result = new Map<Location, DispatchGroup[]>();

    PORTS.forEach(port => {
      const portOps = filtered.filter(op => op.clipOnPort === port);
      const groups = new Map<string, DispatchGroup>();

      portOps.forEach(op => {
        const key = op.bookingNumber || op.id;
        const existing = groups.get(key);
        if (existing) {
          existing.items.push(op);
          if (op.containerNumber) existing.containers.push(op.containerNumber);
          if (op.gensetNumber) existing.gensets.push(op.gensetNumber);
          existing.statuses.push(op.status);
        } else {
          groups.set(key, {
            booking: op.bookingNumber || '—',
            customer: op.customerName || '—',
            shipper: op.beneficiaryName || '—',
            trucker: op.trucker || '—',
            containers: op.containerNumber ? [op.containerNumber] : [],
            gensets: op.gensetNumber ? [op.gensetNumber] : [],
            statuses: [op.status],
            items: [op],
          });
        }
      });

      result.set(port, Array.from(groups.values()));
    });

    return result;
  }, [filtered]);

  const totals = useMemo(() => ({
    bookings: new Set(filtered.map(o => o.bookingNumber || o.id)).size,
    containers: filtered.filter(o => o.containerNumber).length,
    gensets: filtered.filter(o => o.gensetNumber).length,
  }), [filtered]);

  const portCount = PORTS.filter(port => (byPort.get(port) || []).length > 0).length;

  const portLabel = (port: Location) =>
    isAr ? PORT_NAME_AR[port] : translateEntity(port, 'en');

  const groupStatus = (group: DispatchGroup) => {
    if (group.statuses.includes('IN PROGRESS')) return 'IN PROGRESS';
    if (group.statuses.includes('UNDER OPERATE')) return 'UNDER OPERATE';
    if (group.statuses.every(s => s === 'DONE')) return 'DONE';
    return group.statuses[0];
  };

  return (
    <div className={`dispatch-screen space-y-4 pb-12 ${isAr ? 'rtl' : 'ltr'}`}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .dispatch-screen, .dispatch-screen * { visibility: visible !important; }
          .dispatch-screen { position: absolute; left: 0; top: 0; width: 100%; background: white !important; color: black !important; padding: 8px !important; }
          .no-print { display: none !important; }
          .dispatch-port { break-inside: avoid; page-break-inside: avoid; margin-bottom: 12px !important; }
          .dispatch-table { font-size: 8px !important; }
          .dispatch-table th, .dispatch-table td { padding: 4px 5px !important; }
        }
        .dispatch-table { table-layout: fixed; }
      `}</style>

      <div className="no-print bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <h1 className="text-lg md:text-xl font-black tracking-tight text-slate-900 dark:text-white">
                {isAr ? 'خطة توزيع المولدات اليومية' : 'DAILY GENSET DISPATCH PLAN'}
              </h1>
            </div>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
              NILE FLEET • {isAr ? 'التوزيع حسب الميناء' : 'PORT-BY-PORT DISPATCH CONTROL'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 text-[11px] font-black text-slate-700 dark:text-white outline-none"
            />
            <button onClick={() => setSelectedDate(localDate())} className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[9px] font-black uppercase">
              {isAr ? 'اليوم' : 'TODAY'}
            </button>
            <button onClick={() => setActiveOnly(v => !v)} className={`h-9 px-3 rounded-lg border text-[9px] font-black uppercase ${activeOnly ? 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' : 'border-slate-200 bg-white text-slate-500 dark:bg-slate-900 dark:border-slate-700'}`}>
              {activeOnly ? (isAr ? 'العمل الحالي' : 'ACTIVE WORK') : (isAr ? 'كل الحالات' : 'ALL STATUS')}
            </button>
            <button onClick={() => window.print()} className="h-9 px-3 rounded-lg bg-[#3a3833] text-[#C2A378] text-[9px] font-black uppercase">
              {isAr ? 'طباعة / PDF' : 'PRINT / PDF'}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-col md:flex-row gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث بالحجز أو العميل أو الشاحن أو المولد أو الحاوية...' : 'Search booking, customer, shipper, trucker, genset or container...'}
            className="h-9 flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 text-[10px] font-bold text-slate-700 dark:text-white outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 md:grid-cols-6 no-print">
        {[
          [isAr ? 'الحجوزات' : 'BOOKINGS', totals.bookings],
          [isAr ? 'الحاويات' : 'CONTAINERS', totals.containers],
          [isAr ? 'المولدات' : 'GENSETS', totals.gensets],
          [isAr ? 'الموانئ' : 'PORTS', portCount],
          [isAr ? 'التاريخ' : 'DATE', selectedDate],
          [isAr ? 'الحالة' : 'MODE', activeOnly ? (isAr ? 'نشط' : 'ACTIVE') : (isAr ? 'الكل' : 'ALL')],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
            <div className="text-[7px] font-black uppercase tracking-widest text-slate-400">{label}</div>
            <div className="mt-0.5 truncate text-sm font-black text-slate-900 dark:text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {PORTS.map(port => {
          const groups = byPort.get(port) || [];
          return (
            <section key={port} className="dispatch-port overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  <h2 className="truncate text-[11px] font-black uppercase tracking-wide text-slate-900 dark:text-white">
                    {portLabel(port)}
                  </h2>
                  <span className="rounded-md bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 text-[8px] font-black text-slate-600 dark:text-slate-200">
                    {groups.length}
                  </span>
                </div>
                <div className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                  {isAr ? 'الحجوزات' : 'BOOKINGS'}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="dispatch-table w-full min-w-[980px] border-collapse text-left">
                  <colgroup>
                    <col style={{ width: '34px' }} />
                    <col style={{ width: '105px' }} />
                    <col style={{ width: '145px' }} />
                    <col style={{ width: '145px' }} />
                    <col style={{ width: '125px' }} />
                    <col style={{ width: '210px' }} />
                    <col style={{ width: '125px' }} />
                    <col style={{ width: '100px' }} />
                  </colgroup>
                  <thead className="bg-[#3a3833] text-[8px] font-black uppercase tracking-wider text-white">
                    <tr>
                      <th className="px-2 py-2 text-center">#</th>
                      <th className="px-2 py-2">{isAr ? 'الحجز' : 'BOOKING'}</th>
                      <th className="px-2 py-2">{isAr ? 'العميل' : 'CUSTOMER'}</th>
                      <th className="px-2 py-2">{isAr ? 'الشاحن' : 'SHIPPER'}</th>
                      <th className="px-2 py-2">{isAr ? 'الناقل' : 'TRUCKER'}</th>
                      <th className="px-2 py-2">{isAr ? 'الحاويات' : 'CONTAINER(S)'}</th>
                      <th className="px-2 py-2">{isAr ? 'المولدات' : 'GENSET(S)'}</th>
                      <th className="px-2 py-2 text-center">{isAr ? 'الحالة' : 'STATUS'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70">
                    {groups.map((group, index) => {
                      const status = groupStatus(group);
                      return (
                        <tr key={group.booking + index} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                          <td className="px-2 py-1.5 text-center text-[9px] font-black text-slate-400">{index + 1}</td>
                          <td className="px-2 py-1.5 font-mono text-[10px] font-black text-blue-600 dark:text-blue-300">{group.booking}</td>
                          <td className="px-2 py-1.5 truncate text-[9px] font-bold text-slate-700 dark:text-slate-200" title={group.customer}>{translateEntity(group.customer, lang)}</td>
                          <td className="px-2 py-1.5 truncate text-[9px] font-bold text-slate-700 dark:text-slate-200" title={group.shipper}>{translateEntity(group.shipper, lang)}</td>
                          <td className="px-2 py-1.5 truncate text-[9px] font-bold text-slate-700 dark:text-slate-200" title={group.trucker}>{translateEntity(group.trucker, lang)}</td>
                          <td className="px-2 py-1.5 font-mono text-[8px] font-bold text-slate-600 dark:text-slate-300" title={group.containers.join(', ')}>{uniqueJoin(group.containers)}</td>
                          <td className="px-2 py-1.5 font-mono text-[8px] font-black text-blue-600 dark:text-blue-300" title={group.gensets.join(', ')}>{uniqueJoin(group.gensets)}</td>
                          <td className="px-2 py-1.5 text-center">
                            <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[7px] font-black uppercase whitespace-nowrap ${statusClass(status)}`}>
                              {status === 'UNDER OPERATE' && isAr ? 'تحت التشغيل' :
                               status === 'IN PROGRESS' && isAr ? 'قيد التنفيذ' :
                               status === 'DONE' && isAr ? 'تم' : status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {!groups.length && (
                      <tr>
                        <td colSpan={8} className="px-3 py-4 text-center text-[8px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600">
                          {isAr ? 'لا توجد حجوزات لهذا التاريخ' : 'NO DISPATCHES FOR THIS DATE'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>

      <div className="no-print flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-[8px] font-bold text-slate-400">
        <span>{isAr ? 'خطة التوزيع مقسمة حسب الميناء — الشاحن والناقل ظاهرين دائماً.' : 'Dispatch is separated by port — Shipper and Trucker are always visible.'}</span>
        <span className="font-black">{isDark ? 'NILE FLEET • CONTROL' : 'NILE FLEET • DISPATCH'}</span>
      </div>
    </div>
  );
};

export default DailyDispatchPlan;
