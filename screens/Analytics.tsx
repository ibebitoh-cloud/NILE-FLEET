
import React, { useMemo, useContext } from 'react';
import { db } from '../services/supabaseDb';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { Location } from '../types';
import { LanguageContext } from '../App';
import { translations } from '../translations';

const localDateISO = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(date);

const Analytics: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const t = translations[lang];
  const stock = db.getStock();
  const operations = db.getOperations();
  const invoices = db.getInvoices();
  const maintenanceLogs = db.getMaintenanceLogs();

  const COLORS = ['#001F3F', '#C2A378', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'];

  const metrics = useMemo(() => {
    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const activeGensets = new Set(
      operations.filter(o => o.status === 'IN PROGRESS' && o.gensetNumber?.trim())
        .map(o => o.gensetNumber.trim().toUpperCase())
    );
    const fleetUnits = stock.filter(g => g.status !== 'RETIRED').length;
    const utilizationRate = fleetUnits > 0 ? Math.min(100, (activeGensets.size / fleetUnits) * 100) : 0;
    const avgInvoiceValue = invoices.length > 0 ? totalRevenue / invoices.length : 0;
    return { totalRevenue, utilizationRate, activeUnits: activeGensets.size, avgInvoiceValue };
  }, [stock, operations, invoices]);

  const unitPerformanceData = useMemo(() => {
    return stock.map(unit => {
      const stockUnit = unit.unitNumber.trim().toUpperCase();
      const unitOps = operations.filter(o => (o.gensetNumber || '').trim().toUpperCase() === stockUnit);
      const rev = unitOps.reduce((sum, op) => sum + (parseFloat(String(op.rate).replace(/,/g, '')) || 0), 0);
      const trips = unitOps.length;
      const totalFuel = unitOps.reduce((sum, op) => sum + (parseFloat(String(op.gaz || '0').replace(/,/g, '')) || 0), 0);
      const unitMaintenance = maintenanceLogs.filter(l => (l.gensetNumber || '').trim().toUpperCase() === stockUnit);
      const latestMaintenance = unitMaintenance.reduce((latest, log) => !latest || log.serviceDate > latest ? log.serviceDate : latest, '');
      return {
        unit: unit.unitNumber,
        revenue: rev,
        trips,
        lastPort: unit.location,
        fuel: trips > 0 ? (totalFuel / trips).toFixed(1) : '0.0',
        maintenanceCount: unitMaintenance.length,
        lastMaintenance: latestMaintenance || '—'
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [stock, operations, maintenanceLogs]);

  const topPerformer = unitPerformanceData[0];
  const rentalTrends = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    return days.map(d => {
      const key = localDateISO(d);
      const dayOps = operations.filter(o => o.operationDate === key);
      const revenue = dayOps.reduce((sum, o) => sum + (parseFloat(String(o.rate).replace(/,/g, '')) || 0) + (parseFloat(String(o.vat).replace(/,/g, '')) || 0), 0);
      return { day: d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short' }), revenue, volume: dayOps.length };
    });
  }, [operations, lang]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 text-start transition-colors duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-[#001F3F] uppercase tracking-tighter">
            {lang === 'ar' ? 'ذكاء الأسطول التشغيلي' : 'Fleet Intelligence Dashboard'}
          </h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">
            {lang === 'ar' ? 'تحليل الأداء التقني والمالي المعمق' : 'Deep-dive technical & financial performance analytics'}
          </p>
        </div>
        <div className="flex gap-2">
           <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                {lang === 'ar' ? 'مصدر البيانات: لقطة مباشرة من قاعدة البيانات' : 'Data Source: Live database snapshot'}
              </span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-50 group-hover:bg-blue-100 rounded-full transition-colors duration-500"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">{lang === 'ar' ? 'استخدام الأسطول' : 'Utilization'}</p>
          <h4 className="text-3xl font-black text-blue-600 relative z-10">{metrics.utilizationRate.toFixed(1)}%</h4>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden relative z-10">
            <div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${metrics.utilizationRate}%` }}></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-slate-50 group-hover:bg-slate-100 rounded-full transition-colors duration-500"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">{t.revenue}</p>
          <h4 className="text-3xl font-black text-[#001F3F] relative z-10">EGP {metrics.totalRevenue.toLocaleString()}</h4>
          <p className="text-[8px] font-bold text-slate-400 mt-2">{lang === 'ar' ? 'حسب الفواتير المسجلة' : 'Based on recorded invoices'}</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-50 group-hover:bg-emerald-100 rounded-full transition-colors duration-500"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">{lang === 'ar' ? 'التأجيرات النشطة' : 'Active Units'}</p>
          <h4 className="text-3xl font-black text-emerald-600 relative z-10">{metrics.activeUnits}</h4>
          <p className="text-[8px] font-bold text-slate-400 mt-2">Currently on-trip</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-50 group-hover:bg-amber-100 rounded-full transition-colors duration-500"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">{lang === 'ar' ? 'متوسط قيمة الفاتورة' : 'Average Invoice Value'}</p>
          <h4 className="text-3xl font-black text-[#C2A378] relative z-10">EGP {metrics.avgInvoiceValue.toFixed(0)}</h4>
          <p className="text-[8px] font-bold text-slate-400 mt-2">Per recorded invoice</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black text-[#001F3F] uppercase tracking-tight text-xl flex items-center gap-3">
              <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">📊</span>
              {lang === 'ar' ? 'تحليل أداء الوحدات' : 'Detailed Unit Performance'}
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right whitespace-nowrap">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                  <th className="pb-4 px-2">{t.unit}</th>
                  <th className="pb-4 px-2 text-center">{lang === 'ar' ? 'الموقع' : 'Hub'}</th>
                  <th className="pb-4 px-2 text-center">{lang === 'ar' ? 'الرحلات' : 'Trips'}</th>
                  <th className="pb-4 px-2 text-center">{lang === 'ar' ? 'وقود/عملية مسجلة' : 'Fuel / Recorded Op.'}</th>
                  <th className="pb-4 px-2 text-center">{lang === 'ar' ? 'آخر صيانة' : 'Last Service'}</th>
                  <th className="pb-4 px-2 text-center">{lang === 'ar' ? 'سجلات الصيانة' : 'Service Logs'}</th>
                  <th className="pb-4 px-2 text-right">{t.revenue}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {unitPerformanceData.slice(0, 10).map((data, idx) => (
                  <tr key={idx} className="group hover:bg-slate-50/50 transition-all duration-200">
                    <td className="py-4 px-2">
                      <div className="flex flex-col">
                        <span className="font-black text-[#001F3F] text-xs">{data.unit}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">SN: {data.unit.split('-').pop()}</span>
                      </div>
                    </td>
                    <td className="py-4 px-2 text-center">
                       <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">{data.lastPort}</span>
                    </td>
                    <td className="py-4 px-2 text-center font-bold text-slate-700 text-xs">{data.trips}</td>
                    <td className="py-4 px-2 text-center">
                       <span className={`text-[10px] font-bold ${parseFloat(data.fuel) > 2.6 ? 'text-amber-600' : 'text-emerald-600'}`}>{data.fuel}</span>
                    </td>
                    <td className="py-4 px-2 text-center text-[9px] font-black text-slate-500">{data.lastMaintenance}</td>
                    <td className="py-4 px-2 text-center text-[9px] font-black text-slate-500">{data.maintenanceCount}</td>
                    <td className="py-4 px-2 text-right font-black text-slate-900 text-xs">EGP {data.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <div className="bg-[#001F3F] p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden flex flex-col justify-between h-full">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
            <div>
              <div className="flex items-center gap-2 mb-8">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5-10-5-10 5z"/></svg>
                </div>
                <h3 className="font-black uppercase tracking-widest text-xs">{lang === 'ar' ? 'تحليلات الوحدة النخبة' : 'Top Asset Spotlight'}</h3>
              </div>
              {topPerformer && (
                <div className="space-y-6">
                  <div className="flex justify-between items-end border-b border-blue-800/50 pb-4">
                    <div>
                      <h4 className="text-3xl font-black italic tracking-tighter text-[#C2A378]">{topPerformer.unit}</h4>
                      <p className="text-[9px] font-bold text-blue-300 uppercase tracking-widest mt-1">{lang === 'ar' ? 'أعلى أصل حسب الإيراد المسجل' : 'Top asset by recorded revenue'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-900/30 p-4 rounded-2xl border border-blue-800/50">
                       <p className="text-[8px] font-black text-blue-300 uppercase mb-1">{lang === 'ar' ? 'إجمالي الرحلات' : 'Recorded Trips'}</p>
                       <p className="text-lg font-black">{topPerformer.trips}</p>
                    </div>
                    <div className="bg-blue-900/30 p-4 rounded-2xl border border-blue-800/50">
                       <p className="text-[8px] font-black text-blue-300 uppercase mb-1">{lang === 'ar' ? 'وقود/عملية مسجلة' : 'Fuel / Recorded Op.'}</p>
                       <p className="text-lg font-black">{topPerformer.fuel}L</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => window.print()} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all mt-6 shadow-lg shadow-blue-900/20">
               Generate Full Fleet PDF
            </button>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex-1">
             <h3 className="font-black text-[#001F3F] uppercase tracking-tight mb-4 text-xs">{lang === 'ar' ? 'توزيع الأسطول حسب الميناء' : 'Fleet Distribution by Port'}</h3>
             <div className="h-48">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie
                      data={Object.values(Location).map((loc, i) => ({ 
                        name: loc, 
                        value: stock.filter(s => s.location === loc).length 
                      }))}
                      innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value"
                    >
                      {Object.values(Location).map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '10px', backgroundColor: '#fff', border: 'none', color: '#000' }} />
                 </PieChart>
               </ResponsiveContainer>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="font-black text-[#001F3F] uppercase tracking-tight mb-8">{lang === 'ar' ? 'تحليل تدفق الإيرادات' : 'Revenue Stream Analysis'}</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rentalTrends}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: '#fff', color: '#000' }} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
           <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-[#001F3F] uppercase tracking-tight">{lang === 'ar' ? 'اتجاهات الطلب' : 'Deployment Volume Trends'}</h3>
           </div>
           <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
               <BarChart data={rentalTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: '#fff', color: '#000' }} />
                  <Bar dataKey="volume" fill="#001F3F" radius={[4, 4, 0, 0]} barSize={24} />
               </BarChart>
            </ResponsiveContainer>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
