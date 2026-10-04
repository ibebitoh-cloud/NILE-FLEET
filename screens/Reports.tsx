import React, { useState, useContext, useMemo, useEffect } from 'react';
import { db } from '../services/supabaseDb';
import { LanguageContext } from '../App';
import { translations, translateEntity } from '../translations';
import { runThinkingAudit } from '../services/aiService';
import { UserRole } from '../types';

const localDateISO = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const Reports: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const t = translations[lang];
  
  const [dateFrom, setDateFrom] = useState(() => { const now = new Date(); return localDateISO(new Date(now.getFullYear(), now.getMonth(), 1)); });
  const [dateTo, setDateTo] = useState(() => localDateISO());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('ALL');
  const [isThinking, setIsThinking] = useState(false);
  const [auditAdvice, setAuditAdvice] = useState<string>('');
  const [dataVersion, setDataVersion] = useState(0);
  useEffect(() => {
    const refresh = () => setDataVersion(v => v + 1);
    window.addEventListener('db-change', refresh);
    window.addEventListener('db-undo-success', refresh);
    return () => {
      window.removeEventListener('db-change', refresh);
      window.removeEventListener('db-undo-success', refresh);
    };
  }, []);

  const ops = db.getOperations();
  const customers = useMemo(() => 
    db.getUsers().filter(u => u.role === UserRole.CUSTOMER).map(u => u.companyName || u.name), 
  []);

  const filteredData = useMemo(() => {
    const from = dateFrom;
    const to = dateTo;
    const search = searchTerm.toLowerCase().trim();
    
    return ops.filter(o => {
      const operationDate = String(o.operationDate || '').slice(0, 10);
      const matchesDate = operationDate >= from && operationDate <= to;
      const normalizeCustomer = (value?: string) => String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
      const matchesCustomer = selectedCustomer === 'ALL' || normalizeCustomer(o.customerName) === normalizeCustomer(selectedCustomer);
      const matchesSearch = !search || 
        (o.bookingNumber || '').toLowerCase().includes(search) ||
        (o.containerNumber || '').toLowerCase().includes(search) ||
        (o.customerName || '').toLowerCase().includes(search) ||
        (o.gensetNumber && o.gensetNumber.toLowerCase().includes(search));
      
      return matchesDate && matchesCustomer && matchesSearch;
    }).sort((a, b) => b.operationDate.localeCompare(a.operationDate));
  }, [dateFrom, dateTo, ops, searchTerm, selectedCustomer]);

  const summary = useMemo(() => {
    const totalRevenue = filteredData.reduce((a, b) => a + (parseFloat(String(b.rate || '').replace(/,/g, '')) || 0), 0);
    const totalVat = filteredData.reduce((a, b) => a + (parseFloat(String(b.vat || '').replace(/,/g, '')) || 0), 0);
    return {
      count: filteredData.length,
      revenue: totalRevenue,
      vat: totalVat,
      grandTotal: totalRevenue + totalVat
    };
  }, [filteredData]);

  // Daily Genset Dispatch Plan: one operational row per booking/port/date.
  // Container-level operations are grouped so the port team sees the number
  // of gensets to prepare, plus the customer, shipper and commodity context.
  const dailyGensetPlan = useMemo(() => {
    const groups = new Map<string, {
      clipOnDate: string;
      port: string;
      bookingNumber: string;
      customerName: string;
      shipper: string;
      commodity: string;
      trucker: string;
      videoUrl: string;
      containers: Set<string>;
      gensets: Set<string>;
    }>();

    ops.forEach(o => {
      const clipOnDate = String(o.clipOnDate || o.operationDate || '').slice(0, 10);
      if (!clipOnDate || clipOnDate < dateFrom || clipOnDate > dateTo) return;
      if (o.status === 'CANCEL' || o.status === 'DONE') return;

      const key = [clipOnDate, o.clipOnPort, o.bookingNumber].join('|');
      const current = groups.get(key) || {
        clipOnDate,
        port: String(o.clipOnPort || ''),
        bookingNumber: o.bookingNumber || '---',
        customerName: o.customerName || '---',
        shipper: o.beneficiaryName || '---',
        commodity: o.commodity || '---',
        trucker: o.trucker || '---',
        videoUrl: String((o as any).videoUrl || (o as any).video || ''),
        containers: new Set<string>(),
        gensets: new Set<string>()
      };

      if (o.containerNumber) current.containers.add(o.containerNumber);
      if (o.gensetNumber) current.gensets.add(o.gensetNumber);
      if (!current.customerName || current.customerName === '---') current.customerName = o.customerName || '---';
      if (!current.shipper || current.shipper === '---') current.shipper = o.beneficiaryName || '---';
      if (!current.commodity || current.commodity === '---') current.commodity = o.commodity || '---';
      if (!current.trucker || current.trucker === '---') current.trucker = o.trucker || '---';
      if (!current.videoUrl) current.videoUrl = String((o as any).videoUrl || (o as any).video || '');
      groups.set(key, current);
    });

    return Array.from(groups.values())
      .map(g => ({ ...g, containerCount: g.containers.size, gensetCount: g.containers.size }))
      .sort((a, b) => a.clipOnDate.localeCompare(b.clipOnDate) || a.port.localeCompare(b.port) || a.bookingNumber.localeCompare(b.bookingNumber));
  }, [ops, dateFrom, dateTo, dataVersion]);

  const dailyGensetTotals = useMemo(() => ({
    bookings: dailyGensetPlan.length,
    gensets: dailyGensetPlan.reduce((sum, row) => sum + row.gensetCount, 0),
    containers: dailyGensetPlan.reduce((sum, row) => sum + row.containerCount, 0)
  }), [dailyGensetPlan]);

  const runDaliAuditor = async () => {
    setIsThinking(true);
    setAuditAdvice('');
    try {
      const prompt = `
        You are an elite Auditor for Nile Fleet.
        REVENUE REPORT DATA (${dateFrom} to ${dateTo}) ${selectedCustomer !== 'ALL' ? `for Customer: ${selectedCustomer}` : ''}:
        - Total Bookings: ${summary.count}
        - Base Revenue: EGP ${summary.revenue.toLocaleString()}
        - Collected VAT: EGP ${summary.vat.toLocaleString()}
        - Total Inflow: EGP ${summary.grandTotal.toLocaleString()}
        
        Analyze the financial efficiency and VAT compliance based only on these numbers. 
        Provide 3 key takeaways using your deep reasoning capability.
        Respond in ${lang === 'en' ? 'English' : 'Arabic'}.
      `;

      const text = await runThinkingAudit(prompt, 4000);

      setAuditAdvice(text || 'Analysis unavailable.');
    } catch (err) {
      setAuditAdvice('DALI 1.0 connection error.');
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-start pb-20 max-w-7xl mx-auto">
      {/* Header & Filters */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col xl:flex-row justify-between items-center gap-6">
        <div>
           <h2 className="text-2xl font-black text-[#3a3833] dark:text-white uppercase tracking-tight">{lang === 'ar' ? 'التقارير المالية والتدقيق' : 'Financial Audit Reports'}</h2>
           <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Audit by date range, partner, or asset ID</p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
           {/* Customer Filter */}
           <div className="relative w-full md:w-56">
             <select 
               className="w-full pl-4 pr-10 py-3 border-2 border-slate-50 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900 text-xs font-black uppercase tracking-tight outline-none focus:border-blue-400 transition-all appearance-none cursor-pointer text-slate-900 dark:text-white"
               value={selectedCustomer}
               onChange={e => setSelectedCustomer(e.target.value)}
             >
               <option value="ALL">{lang === 'ar' ? 'جميع العملاء' : 'All Partners'}</option>
               {customers.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
             <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
             </div>
           </div>

           <div className="relative w-full md:w-64">
             <input 
                type="text" 
                placeholder={lang === 'ar' ? 'بحث شامل...' : 'Global Search...'} 
                className="w-full pl-10 pr-4 py-3 border-2 border-slate-50 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none focus:border-blue-400 transition-all text-slate-900 dark:text-white"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
             />
             <svg className="absolute left-3.5 top-3 w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
           </div>
           
           <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 p-2 rounded-2xl border border-slate-100 dark:border-slate-700 w-full md:w-auto">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-transparent text-xs font-black text-blue-900 dark:text-blue-400 outline-none p-2 flex-1" />
              <span className="text-slate-300 font-black">→</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-transparent text-xs font-black text-blue-900 dark:text-blue-400 outline-none p-2 flex-1" />
           </div>
        </div>
      </div>

      {/* Daily Genset Dispatch Plan */}
      <section className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-6 md:p-7 border-b border-slate-100 dark:border-slate-700 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <h3 className="text-xl font-black text-[#3a3833] dark:text-white uppercase tracking-tight">
              {lang === 'ar' ? 'خطة المولدات اليومية' : 'Daily Genset Dispatch Plan'}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              {lang === 'ar' ? 'بيانات التشغيل من نفس سجل العمليات' : 'Live operational plan from the same Operations ledger'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-widest">
            <span className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">{lang === 'ar' ? 'حجوزات' : 'Bookings'}: {dailyGensetTotals.bookings}</span>
            <span className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300">{lang === 'ar' ? 'مولدات' : 'Gensets'}: {dailyGensetTotals.gensets}</span>
            <span className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300">{lang === 'ar' ? 'حاويات' : 'Containers'}: {dailyGensetTotals.containers}</span>
            <button onClick={() => window.print()} className="px-3 py-2 rounded-xl bg-[#3a3833] text-white hover:opacity-90">{lang === 'ar' ? 'طباعة الخطة' : 'Print Plan'}</button>
          </div>
        </div>

        <div className="mx-6 mt-5 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-[9px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-200">
          {lang === 'ar' ? 'تعليمات الميناء: تصوير فيديو لكل مولد أثناء التشغيل بعد التركيب + تسجيل اسم العميل وتاريخ التركيب.' : 'PORT INSTRUCTION: Capture a video of each genset while working after clip-on + record customer name and clip-on date.'}
        </div>

        <div className="overflow-x-auto mt-4 border-t-4 border-slate-900 dark:border-slate-600">
          <table className="w-full text-left text-[10px] min-w-[1100px]">
            <thead className="bg-slate-900 text-white font-black uppercase tracking-widest">
              <tr>
                <th className="px-4 py-3">{lang === 'ar' ? 'التاريخ' : 'Clip-On Date'}</th>
                <th className="px-4 py-3">{lang === 'ar' ? 'الميناء' : 'Port'}</th>
                <th className="px-4 py-3">{lang === 'ar' ? 'رقم الحجز' : 'Booking No.'}</th>
                <th className="px-4 py-3">{lang === 'ar' ? 'اسم العميل' : 'Customer Name'}</th>
                <th className="px-4 py-3">{lang === 'ar' ? 'الشاحن' : 'Shipper'}</th>
                <th className="px-4 py-3">{lang === 'ar' ? 'البضاعة' : 'Commodity'}</th>
                <th className="px-4 py-3">{lang === 'ar' ? 'شركة النقل' : 'Trucker'}</th>
                <th className="px-4 py-3 text-center">{lang === 'ar' ? 'الحاويات' : 'Containers'}</th>
                <th className="px-4 py-3 text-center">{lang === 'ar' ? 'المولدات المطلوبة' : 'Gensets Required'}</th>
                <th className="px-4 py-3">{lang === 'ar' ? 'الفيديو' : 'Video'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {dailyGensetPlan.map(row => {
                const portKey = String(row.port || '').trim().toUpperCase();
                const portTone =
                  portKey.includes('SOKHNA') || portKey.includes('السخنة') ? 'border-l-4 border-l-blue-500 bg-blue-50/40 dark:bg-blue-950/20' :
                  portKey.includes('ALEX') || portKey.includes('الإسكندرية') ? 'border-l-4 border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20' :
                  portKey.includes('DAM') || portKey.includes('دمياط') ? 'border-l-4 border-l-violet-500 bg-violet-50/40 dark:bg-violet-950/20' :
                  portKey.includes('PORT SAID') || portKey.includes('بورسعيد') ? 'border-l-4 border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/20' :
                  portKey.includes('DEK') || portKey.includes('الدخيلة') ? 'border-l-4 border-l-rose-500 bg-rose-50/40 dark:bg-rose-950/20' :
                  'border-l-4 border-l-slate-400 bg-slate-50/40 dark:bg-slate-900/30';
                const videoLabel = row.videoUrl ? (lang === 'ar' ? 'فتح الفيديو' : 'OPEN VIDEO') : (lang === 'ar' ? 'لا يوجد فيديو' : 'NO VIDEO');
                return (
                <tr key={row.clipOnDate + row.port + row.bookingNumber} className={`border-b border-slate-100 dark:border-slate-700 ${portTone} hover:brightness-[0.98]`}>
                  <td className="px-4 py-3 font-black text-blue-600 dark:text-blue-400 whitespace-nowrap">{row.clipOnDate || '-'}</td>
                  <td className="px-4 py-3 font-black">{row.port ? translateEntity(row.port, lang) : '-'}</td>
                  <td className="px-4 py-3 font-black text-blue-600 dark:text-blue-400 font-mono">{row.bookingNumber || '-'}</td>
                  <td className="px-4 py-3 font-bold">{row.customerName && row.customerName !== '---' ? translateEntity(row.customerName, lang) : '-'}</td>
                  <td className="px-4 py-3 font-bold">{row.shipper && row.shipper !== '---' ? translateEntity(row.shipper, lang) : '-'}</td>
                  <td className="px-4 py-3 font-bold">{row.commodity && row.commodity !== '---' ? translateEntity(row.commodity, lang) : '-'}</td>
                  <td className="px-4 py-3 font-bold">{row.trucker && row.trucker !== '---' ? translateEntity(row.trucker, lang) : '-'}</td>
                  <td className="px-4 py-3 text-center font-black">{row.containerCount}</td>
                  <td className="px-4 py-3 text-center font-black text-emerald-600 dark:text-emerald-400">{row.gensetCount}</td>
                  <td className="px-4 py-3 font-black">
                    {row.videoUrl ? (
                      <button type="button" onClick={() => window.open(row.videoUrl, '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[9px] text-white hover:bg-blue-700">
                        ▶ {videoLabel}
                      </button>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                </tr>
                );
              })}
              {dailyGensetPlan.length === 0 && (
                <tr><td colSpan={10} className="py-14 text-center text-slate-400 font-black uppercase tracking-widest">{lang === 'ar' ? 'لا توجد مولدات مطلوبة في الفترة المحددة' : 'No genset requirements in the selected period'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'ar' ? 'الحجوزات' : 'Bookings'}</p>
          <p className="text-xl md:text-2xl font-black text-[#3a3833] dark:text-white">{summary.count}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'ar' ? 'الإيراد الأساسي' : 'Base Rate'}</p>
          <p className="text-xl md:text-2xl font-black text-blue-600 dark:text-blue-400">EGP {summary.revenue.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'ar' ? 'الضريبة' : 'VAT'}</p>
          <p className="text-xl md:text-2xl font-black text-[#C2A378]">EGP {summary.vat.toLocaleString()}</p>
        </div>
        <div className="bg-[#3a3833] p-6 rounded-3xl shadow-xl col-span-2 md:col-span-1">
          <p className="text-[10px] font-black text-[#C2A378] uppercase tracking-widest">{lang === 'ar' ? 'الإجمالي' : 'Total'}</p>
          <p className="text-xl md:text-2xl font-black text-white italic">EGP {summary.grandTotal.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Audit Table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center">
            <h4 className="font-black text-xs uppercase tracking-widest text-slate-500">{lang === 'ar' ? 'سجل العمليات' : 'Audit Ledger'}</h4>
            <button 
              onClick={() => {
                const headers = ['Date', 'Booking #', 'Container #', 'Customer', 'Rate', 'VAT', 'Total'];
                const csv = [headers.join(','), ...filteredData.map(o => [
                  o.operationDate, o.bookingNumber, o.containerNumber, o.customerName, 
                  o.rate, o.vat, ((parseFloat(String(o.rate || '').replace(/,/g,'')) || 0) + (parseFloat(String(o.vat || '').replace(/,/g,'')) || 0))
                ].join(','))].join('\n');
                const blob = new Blob(["\uFEFF"+csv], {type:'text/csv'});
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url; link.download = `Fleet_Audit_${dateFrom}_${selectedCustomer}.csv`; link.click();
              }}
              className="text-[10px] font-black text-blue-600 uppercase hover:underline"
            >
              Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-900 text-white font-black uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Booking #</th>
                  <th className="px-6 py-4">Container #</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4 text-right">Rate</th>
                  <th className="px-6 py-4 text-right">VAT</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {filteredData.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                    <td className="px-6 py-4 font-black text-blue-600 dark:text-blue-400 font-mono">{o.bookingNumber}</td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-700 dark:text-slate-300">{o.containerNumber || '---'}</td>
                    <td className="px-6 py-4 font-bold uppercase text-slate-500">{translateEntity(o.customerName, lang)}</td>
                    <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white">EGP {o.rate}</td>
                    <td className="px-6 py-4 text-right font-bold text-[#C2A378]">EGP {o.vat}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${o.status === 'DONE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-20 text-center opacity-30 italic font-black uppercase tracking-widest">
                      {lang === 'ar' ? 'لا توجد نتائج للبحث' : 'No matches found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* DALI 1.0 Auditor Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-2xl border-4 border-slate-50 dark:border-slate-700 flex flex-col h-full">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-[#3a3833] text-[#C2A378] rounded-2xl flex items-center justify-center text-xl shadow-lg">🛡️</div>
              <div>
                <h3 className="text-lg font-black text-[#3a3833] dark:text-white uppercase italic leading-none">DALI 1.0</h3>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Financial Integrity AI</p>
              </div>
            </div>

            <div className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-700 overflow-y-auto max-h-[400px] mb-6 custom-scrollbar">
               {isThinking ? (
                 <div className="space-y-4 animate-pulse">
                   <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                   <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                   <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                   <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest text-center">Thinking...</p>
                 </div>
               ) : auditAdvice ? (
                 <div className="text-xs font-bold leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                    {auditAdvice}
                 </div>
               ) : (
                 <p className="text-[10px] text-slate-400 text-center py-20 italic">
                   {selectedCustomer !== 'ALL' 
                     ? `Run analysis to verify financials for ${selectedCustomer}.`
                     : 'Run analysis to verify period financials across all partners.'}
                 </p>
               )}
            </div>

            <button 
              onClick={runDaliAuditor}
              disabled={isThinking}
              className="w-full bg-[#3a3833] text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-[#002b57] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isThinking ? 'Analyzing Ledger...' : 'Verify Dataset Accuracy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;