import React, { useContext, useMemo, useEffect, useState } from 'react';
import { db } from '../services/supabaseDb';
import { UserRole, User, hasReadOnlyAccess } from '../types';
import { LanguageContext, ThemeContext } from '../App';
import { translations, translateEntity } from '../translations';

interface DashboardProps {
  onNavigate: (screen: string, id?: string) => void;
}

const money = (value: number) => `${Math.round(value || 0).toLocaleString()} EGP`;

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { lang } = useContext(LanguageContext);
  const { isDark } = useContext(ThemeContext);
  const t = translations[lang];
  const isAr = lang === 'ar';
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}') as User, []);
  const isReadOnly = hasReadOnlyAccess(currentUser);
  const [, setDataVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setDataVersion(v => v + 1);
    window.addEventListener('db-change', refresh);
    window.addEventListener('db-undo-success', refresh);
    return () => {
      window.removeEventListener('db-change', refresh);
      window.removeEventListener('db-undo-success', refresh);
    };
  }, []);

  const stock = db.getStock();
  const ops = db.getOperations();
  const invoices = db.getInvoices();
  const reservations = db.getReservations();
  const customers = db.getUsers().filter(u => u.role === UserRole.CUSTOMER);
  const maintenanceLogs = db.getMaintenanceLogs();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());

  const portData = useMemo(() => {
    const locations = ['DAM', 'ALEX', 'GOUDA', 'SOKHNA', 'SCCT', 'PSD', 'WORKSHOP'] as const;
    const activeOperationUnits = new Set(
      ops
        .filter(o => o.status === 'IN PROGRESS' && o.gensetNumber?.trim())
        .map(o => o.gensetNumber.trim().toUpperCase())
    );

    const byPort: Record<string, {
      available: number;
      rented: number;
      demand: number;
      maintenanceCount: number;
      active: number;
      surplusDeficit: number;
    }> = {};

    locations.forEach(port => {
      byPort[port] = {
        available: 0,
        rented: 0,
        demand: 0,
        maintenanceCount: 0,
        active: 0,
        surplusDeficit: 0,
      };
    });

    // Physical fleet position is the source of truth for stock:
    // IN_STOCK = available; CLIPPED_ON + active operation = rented.
    stock.forEach(g => {
      const port = String(g.location || '');
      if (!byPort[port]) return;

      if (g.status === 'MAINTENANCE') {
        byPort[port].maintenanceCount++;
        return;
      }

      if (g.status === 'IN_STOCK') {
        byPort[port].available++;
      } else if (g.status === 'CLIPPED_ON') {
        const unit = g.unitNumber.trim().toUpperCase();
        if (activeOperationUnits.has(unit)) {
          byPort[port].rented++;
        } else {
          // Preserve the existing orphaned CLIPPED_ON handling.
          byPort[port].available++;
        }
      }
    });

    ops.forEach(o => {
      const port = String(o.clipOnPort || '');
      if (!byPort[port]) return;
      if (o.status === 'UNDER OPERATE') byPort[port].demand++;
      if (o.status === 'IN PROGRESS') byPort[port].active++;
    });

    locations.forEach(port => {
      const totalStock = byPort[port].available + byPort[port].rented;
      byPort[port].surplusDeficit = totalStock - byPort[port].demand;
    });

    return locations.map(port => ({
      port,
      ...byPort[port],
      totalStock: byPort[port].available + byPort[port].rented,
    }));
  }, [stock, ops]);

  // Customer financials are intentionally calculated from the same rules used by
  // Financials/الشؤون المالية: historical opening balance + unpaid invoices +
  // unbilled operations. This keeps the dashboard from showing a separate,
  // invoice-only version of the customer's balance.
  const customerFinancials = useMemo(() => {
    const normalizeCustomer = (value?: string) => String(value || '').trim().toLocaleLowerCase().replace(/\\s+/g, ' ');
    const rows = customers.map(cust => {
      const name = cust.companyName || cust.name;
      const customerOperations = ops.filter(o =>
        o.customerId === cust.id ||
        (!o.customerId && [cust.companyName, cust.name].some(n => normalizeCustomer(n) === normalizeCustomer(o.customerName)))
      );
      const unbilledTotal = customerOperations
        .filter(o => !o.invoiced)
        .reduce((sum, o) => sum + (Number(String(o.rate || 0).replace(/,/g, '')) || 0) + (Number(String(o.vat || 0).replace(/,/g, '')) || 0), 0);

      const userInvoices = invoices.filter(i => {
        if (i.customerId) return i.customerId === cust.id;
        const invoiceName = normalizeCustomer(i.customerName);
        return Boolean(invoiceName && [cust.companyName, cust.name].some(n => normalizeCustomer(n) === invoiceName));
      });
      const billed = userInvoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
      const paid = userInvoices.reduce((sum, i) => {
        const amount = Number(i.amount) || 0;
        return sum + Math.min(amount, Math.max(0, db.getInvoicePaidAmount(i.id)));
      }, 0);
      const unpaidInvoicesTotal = userInvoices
        .filter(i => i.status === 'UNPAID')
        .reduce((sum, i) => sum + Math.max(0, (Number(i.amount) || 0) - db.getInvoicePaidAmount(i.id)), 0);
      const historicalOpeningBalance = Number(cust.pastOutstandingAmount || 0);
      const outstanding = historicalOpeningBalance + unpaidInvoicesTotal + unbilledTotal;
      const operationCount = customerOperations.length;

      return {
        id: cust.id,
        name,
        billed,
        paid,
        historicalOpeningBalance,
        unbilled: unbilledTotal,
        unpaidInvoices: unpaidInvoicesTotal,
        outstanding,
        operations: operationCount,
      };
    });

    return rows.sort((a, b) => b.outstanding - a.outstanding);
  }, [customers, invoices, ops]);

  const financialTotals = useMemo(() => ({
    billed: customerFinancials.reduce((s, c) => s + c.billed, 0),
    paid: customerFinancials.reduce((s, c) => s + c.paid, 0),
    historical: customerFinancials.reduce((s, c) => s + c.historicalOpeningBalance, 0),
    unbilled: customerFinancials.reduce((s, c) => s + c.unbilled, 0),
    outstanding: customerFinancials.reduce((s, c) => s + Math.max(c.outstanding, 0), 0),
  }), [customerFinancials]);

  const maintenanceStats = useMemo(() => {
    const completed = maintenanceLogs.filter(l => l.status === 'COMPLETED').length;
    const inProgress = maintenanceLogs.filter(l => l.status === 'IN_PROGRESS').length;
    const scheduled = maintenanceLogs.filter(l => l.status === 'SCHEDULED').length;
    const total = maintenanceLogs.length;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    const dueSoon = stock.filter(g => g.nextMaintenanceDue && g.nextMaintenanceDue <= todayStr).length;
    return { completed, inProgress, scheduled, total, completionRate, dueSoon };
  }, [maintenanceLogs, stock, todayStr]);

  const smartAlerts = useMemo(() => {
    const alerts: { level: 'HIGH' | 'MEDIUM' | 'INFO'; text: string; action?: () => void }[] = [];
    portData.forEach(p => {
      if (p.deficit > 0) {
        alerts.push({
          level: 'HIGH',
          text: `${translateEntity(p.port, lang)}: ${p.deficit} genset deficit — ${p.preorderCount} demand / ${p.stockCount} available`,
          action: () => onNavigate('operations', p.port)
        });
      }
    });
    if (maintenanceStats.dueSoon > 0) {
      alerts.push({ level: 'MEDIUM', text: `${maintenanceStats.dueSoon} genset(s) due for maintenance`, action: () => onNavigate('maintenance') });
    }
    if (financialTotals.outstanding > 0) {
      alerts.push({ level: 'INFO', text: `${money(financialTotals.outstanding)} customer outstanding balance`, action: () => onNavigate('financials') });
    }
    if (!alerts.length) alerts.push({ level: 'INFO', text: 'Fleet is balanced — no critical dashboard exceptions detected.' });
    return alerts.slice(0, 5);
  }, [portData, maintenanceStats, financialTotals, lang, onNavigate]);

  const operationStats = useMemo(() => {
    const total = ops.length;
    const active = ops.filter(o => o.status === 'IN PROGRESS').length;
    const underOperate = ops.filter(o => o.status === 'UNDER OPERATE').length;
    const linkedActive = ops.filter(o => o.status === 'IN PROGRESS' && o.gensetNumber?.trim()).length;
    const unlinkedActive = active - linkedActive;
    return { total, active, underOperate, linkedActive, unlinkedActive };
  }, [ops]);

  const daliSummary = useMemo(() => {
    const totalUnits = stock.filter(g => g.status !== 'RETIRED').length;
    const active = new Set(ops.filter(o => o.status === 'IN PROGRESS' && o.gensetNumber?.trim()).map(o => o.gensetNumber.trim().toUpperCase())).size;
    const preorder = ops.filter(o => o.status === 'UNDER OPERATE').length;
    const maintenance = stock.filter(g => g.status === 'MAINTENANCE').length;
    return { totalUnits, active, preorder, maintenance };
  }, [stock, ops]);

  return (
    <div className="space-y-5 lg:space-y-6 animate-in fade-in duration-500 pb-28 lg:pb-12 text-start">
      {/* PORT CONTROL */}
      <section>
        <div className="flex items-end justify-between mb-3 px-1">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-[#3a3833] dark:text-white uppercase italic tracking-tight">
              {translateEntity('Port Control', lang)}
            </h2>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.25em]">
              {isAr ? 'إجمالي المخزون • مؤجر • متاح • الطلب • زيادة / عجز' : 'Total Stock • Rented • Available • Demand • Surplus / Deficit'}
            </p>
          </div>
          <button onClick={() => onNavigate('stock')} className="text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
            Fleet
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {portData.map(port => {
            const isDeficit = port.surplusDeficit < 0;
            return (
              <button
                key={port.port}
                onClick={() => onNavigate('operations', port.port)}
                className="w-full text-start bg-white dark:bg-slate-800 rounded-[1.6rem] p-4 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="bg-[#3a3833] dark:bg-slate-700 text-[#C2A378] px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
                    {translateEntity(port.port, lang)}
                  </span>
                  <span className={`text-[8px] font-black uppercase ${isDeficit ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {isDeficit ? (isAr ? 'عجز' : 'DEFICIT') : (isAr ? 'زيادة' : 'SURPLUS')}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-2">
                    <span className="block text-[7px] text-slate-400 font-black uppercase">{isAr ? 'إجمالي المخزون' : 'Total Stock'}</span>
                    <b className="text-xl text-blue-600 dark:text-blue-400">{port.totalStock}</b>
                  </div>
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-2">
                    <span className="block text-[7px] text-slate-400 font-black uppercase">{isAr ? 'مؤجر' : 'Rented'}</span>
                    <b className="text-xl text-amber-500">{port.rented}</b>
                  </div>
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-2">
                    <span className="block text-[7px] text-slate-400 font-black uppercase">{isAr ? 'متاح' : 'Available'}</span>
                    <b className="text-xl text-emerald-500">{port.available}</b>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 p-2">
                    <span className="block text-[7px] text-slate-400 font-black uppercase">{isAr ? 'الطلب' : 'Demand'}</span>
                    <b className="text-xl text-slate-700 dark:text-slate-200">{port.demand}</b>
                  </div>
                  <div className={`rounded-xl p-2 ${isDeficit ? 'bg-rose-50 dark:bg-rose-900/20' : 'bg-cyan-50 dark:bg-cyan-900/20'}`}>
                    <span className="block text-[7px] text-slate-400 font-black uppercase">{isAr ? 'زيادة / عجز' : 'Surplus / Deficit'}</span>
                    <b className={`text-xl ${isDeficit ? 'text-rose-500' : 'text-cyan-500'}`}>
                      {port.surplusDeficit > 0 ? '+' : ''}{port.surplusDeficit}
                    </b>
                  </div>
                </div>

                <div className="mt-2 flex justify-between text-[8px] font-black uppercase">
                  <span className="text-slate-400">{isAr ? 'تشغيل نشط' : 'Live Operations'}</span>
                  <span className="text-emerald-500">{port.active}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 bg-[#3a3833] dark:bg-slate-900 rounded-[1.6rem] p-4 border border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#C2A378] text-[9px] font-black uppercase tracking-widest">
              {isAr ? 'الإجمالي' : 'TOTAL'}
            </span>
            <span className="text-[8px] text-slate-400 font-black uppercase">
              {isAr ? 'كل الموانئ' : 'ALL PORTS'}
            </span>
          </div>
          {(() => {
            const totals = portData.reduce((sum, port) => ({
              totalStock: sum.totalStock + port.totalStock,
              rented: sum.rented + port.rented,
              available: sum.available + port.available,
              demand: sum.demand + port.demand,
              surplusDeficit: sum.surplusDeficit + port.surplusDeficit,
            }), { totalStock: 0, rented: 0, available: 0, demand: 0, surplusDeficit: 0 });

            return (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { label: isAr ? 'إجمالي المخزون' : 'Total Stock', value: totals.totalStock, cls: 'text-blue-400' },
                  { label: isAr ? 'مؤجر' : 'Rented', value: totals.rented, cls: 'text-amber-400' },
                  { label: isAr ? 'متاح' : 'Available', value: totals.available, cls: 'text-emerald-400' },
                  { label: isAr ? 'الطلب' : 'Demand', value: totals.demand, cls: 'text-white' },
                  { label: isAr ? 'زيادة / عجز' : 'Surplus / Deficit', value: totals.surplusDeficit, cls: totals.surplusDeficit < 0 ? 'text-rose-400' : 'text-cyan-400' },
                ].map(item => (
                  <div key={item.label} className="rounded-xl bg-white/5 p-2">
                    <span className="block text-[7px] text-slate-400 font-black uppercase">{item.label}</span>
                    <b className={`text-xl ${item.cls}`}>
                      {item.value > 0 && item.label === (isAr ? 'زيادة / عجز' : 'Surplus / Deficit') ? '+' : ''}{item.value}
                    </b>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </section>

      {/* LIVE OPERATIONS */}
      <section className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="font-black text-[#3a3833] dark:text-white uppercase italic">Live Operations</h2>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Real operation records from the system</p>
          </div>
          <button onClick={() => onNavigate('operations')} className="text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Operations</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-4">
          <div><span className="block text-[8px] text-slate-400 uppercase font-black">Total Operations</span><b className="text-2xl text-[#3a3833] dark:text-white">{operationStats.total}</b></div>
          <div><span className="block text-[8px] text-slate-400 uppercase font-black">In Progress</span><b className="text-2xl text-emerald-500">{operationStats.active}</b></div>
          <div><span className="block text-[8px] text-slate-400 uppercase font-black">Under Operate</span><b className="text-2xl text-amber-500">{operationStats.underOperate}</b></div>
          <div><span className="block text-[8px] text-slate-400 uppercase font-black">Genset Linked</span><b className="text-2xl text-blue-500">{operationStats.linkedActive}</b></div>
        </div>
        {operationStats.unlinkedActive > 0 && <div className="px-5 py-3 border-t border-amber-100 bg-amber-50 dark:bg-amber-900/20 text-[9px] font-black uppercase text-amber-700 dark:text-amber-300">{operationStats.unlinkedActive} active operation(s) have no genset linked</div>}
      </section>

      {/* SMART WIDGET */}
      <section className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="font-black text-[#3a3833] dark:text-white uppercase italic">{translateEntity('Smart Operations Watch', lang)}</h2>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{translateEntity('Automatic exception detection', lang)}</p>
          </div>
          <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-full bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400">{smartAlerts.length} Signals</span>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
          {smartAlerts.map((alert, index) => (
            <button key={index} onClick={alert.action} className="text-start rounded-xl p-3 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${alert.level === 'HIGH' ? 'bg-rose-500' : alert.level === 'MEDIUM' ? 'bg-amber-500' : 'bg-blue-500'}`}></span>
                <span className="text-[8px] font-black uppercase text-slate-400">{alert.level}</span>
              </div>
              <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200 leading-relaxed">{alert.text}</p>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* CUSTOMER FINANCIAL REPORT */}
        <section className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-[#3a3833] dark:text-white uppercase italic">{translateEntity('Customer Financial Reports', lang)}</h2>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Billed • Paid • Outstanding</p>
            </div>
            <button onClick={() => onNavigate('financials')} className="text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">{isReadOnly ? 'Ledger' : 'Financials'}</button>
          </div>
          <div className="grid grid-cols-3 gap-2 p-4 border-b border-slate-100 dark:border-slate-700">
            <div><span className="block text-[8px] text-slate-400 uppercase font-black">{translateEntity('Billed', lang)}</span><b className="text-sm text-slate-700 dark:text-slate-200">{money(financialTotals.billed)}</b></div>
            <div><span className="block text-[8px] text-slate-400 uppercase font-black">{translateEntity('Paid', lang)}</span><b className="text-sm text-emerald-500">{money(financialTotals.paid)}</b></div>
            <div><span className="block text-[8px] text-slate-400 uppercase font-black">{translateEntity('Outstanding', lang)}</span><b className="text-sm text-rose-500">{money(financialTotals.outstanding)}</b></div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {customerFinancials.slice(0, 5).map(c => (
              <button key={c.id} onClick={() => onNavigate('customers')} className="w-full px-5 py-3 flex items-center justify-between gap-3 text-start hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                <div className="min-w-0"><p className="font-black text-xs text-[#3a3833] dark:text-slate-200 uppercase truncate">{c.name}</p><span className="text-[8px] text-slate-400 font-bold">{c.operations} operations</span></div>
                <div className="text-right shrink-0"><span className="block text-[8px] text-slate-400 uppercase">{translateEntity('Outstanding', lang)}</span><b className={`text-xs ${c.outstanding > 0 ? 'text-rose-500' : 'text-slate-400'}`}>{money(Math.max(c.outstanding, 0))}</b></div>
              </button>
            ))}
            {!customerFinancials.length && <div className="p-8 text-center text-[10px] font-black text-slate-400 uppercase">{translateEntity('No customer financial data', lang)}</div>}
          </div>
        </section>

        {/* MAINTENANCE PERFORMANCE + LOG */}
        <section className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-[#3a3833] dark:text-white uppercase italic">{translateEntity('Maintenance Performance & Log', lang)}</h2>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{translateEntity('Service execution and latest records', lang)}</p>
            </div>
            <button onClick={() => onNavigate('maintenance')} className="text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Maintenance</button>
          </div>
          <div className="grid grid-cols-4 gap-2 p-4 border-b border-slate-100 dark:border-slate-700">
            <div><span className="block text-[8px] text-slate-400 uppercase font-black">{translateEntity('Rate', lang)}</span><b className="text-xl text-emerald-500">{maintenanceStats.completionRate}%</b></div>
            <div><span className="block text-[8px] text-slate-400 uppercase font-black">{translateEntity('Done', lang)}</span><b className="text-xl text-blue-500">{maintenanceStats.completed}</b></div>
            <div><span className="block text-[8px] text-slate-400 uppercase font-black">{translateEntity('Active', lang)}</span><b className="text-xl text-amber-500">{maintenanceStats.inProgress}</b></div>
            <div><span className="block text-[8px] text-slate-400 uppercase font-black">{translateEntity('Due', lang)}</span><b className="text-xl text-rose-500">{maintenanceStats.dueSoon}</b></div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {maintenanceLogs.slice(0, 5).map(log => (
              <button key={log.id} onClick={() => onNavigate('maintenance', log.gensetNumber)} className="w-full px-5 py-3 flex items-center justify-between gap-3 text-start hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                <div className="min-w-0"><p className="font-black text-xs text-[#3a3833] dark:text-slate-200 uppercase">GENSET {log.gensetNumber}</p><span className="text-[8px] text-slate-400 font-bold">{log.serviceDate} • {log.serviceType.replace(/_/g, ' ')}</span></div>
                <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg ${log.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : log.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>{log.status.replace(/_/g, ' ')}</span>
              </button>
            ))}
            {!maintenanceLogs.length && <div className="p-8 text-center text-[10px] font-black text-slate-400 uppercase">{translateEntity('No maintenance logs recorded', lang)}</div>}
          </div>
        </section>
      </div>

      {/* COMPACT SYSTEM TOTALS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Gensets', value: stock.length, action: 'stock' },
          { label: 'In Operation', value: operationStats.active, action: 'operations' },
          { label: 'Under Operate', value: operationStats.underOperate, action: 'operations' },
          { label: 'Maintenance', value: stock.filter(g => g.status === 'MAINTENANCE').length, action: 'maintenance' },
        ].map(item => (
          <button key={item.label} onClick={() => onNavigate(item.action)} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm text-start hover:shadow-lg transition-all">
            <span className="block text-[8px] text-slate-400 font-black uppercase tracking-widest">{item.label}</span>
            <b className="text-2xl text-[#3a3833] dark:text-white">{item.value}</b>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
