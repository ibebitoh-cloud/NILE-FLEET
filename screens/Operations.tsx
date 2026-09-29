
import React, { useState, useMemo, useContext, useRef, useEffect } from 'react';
import { db } from '../services/supabaseDb';
import { Operation, Location, User, UserRole } from '../types';
import { LanguageContext, ThemeContext } from '../App';
import { translations, translateEntity } from '../translations';
import { PORT_STYLING } from '../constants';

type QuickFilter = 'ALL' | 'DONE' | 'PROGRESS' | 'OPERATE' | 'REVIEW';

// Mini Editable Cell for Operations Hub
const InlineEdit: React.FC<{
  value: string;
  options?: string[];
  type?: string;
  onSave: (val: string) => void;
  disabled?: boolean;
  className?: string;
  renderValue?: (v: string) => React.ReactNode;
}> = ({ value, options, type, onSave, disabled, className, renderValue }) => {
  const [isEdit, setIsEdit] = useState(false);
  const [val, setVal] = useState(value);
  const inputRef = useRef<any>(null);

  useEffect(() => { if (isEdit) inputRef.current?.focus(); }, [isEdit]);

  const commit = () => {
    setIsEdit(false);
    if (val !== value) onSave(val);
  };

  if (isEdit && !disabled) {
    if (options) {
      return (
        <select 
          ref={inputRef}
          className="bg-white dark:bg-slate-900 border border-blue-500 rounded text-[9px] font-black uppercase px-1 outline-none"
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          autoFocus
        >
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return (
      <input 
        ref={inputRef}
        type={type || 'text'}
        className="bg-white dark:bg-slate-900 border border-blue-500 rounded text-[9px] font-black px-1 outline-none w-20"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && commit()}
        autoFocus
      />
    );
  }

  return (
    <div 
      onClick={() => !disabled && setIsEdit(true)}
      className={`cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 px-1 rounded transition-colors ${className}`}
    >
      {renderValue ? renderValue(value) : value}
    </div>
  );
};

const EditOperationModal: React.FC<{ 
  op: Operation; 
  onClose: () => void; 
  onSave: (op: Operation) => void;
  lang: string;
}> = ({ op, onClose, onSave, lang }) => {
  const isAr = lang === 'ar';
  const [formData, setFormData] = useState<Operation>({ ...op });

  const inputClass = "w-full p-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-bold outline-none focus:border-blue-400 text-black dark:text-white";
  const labelClass = "text-[10px] font-black uppercase text-slate-400 block mb-2 px-1 tracking-widest";

  return (
    <div className="fixed inset-0 bg-[#001F3F]/95 backdrop-blur-xl z-[600] flex items-center justify-center p-4">
      <div className={`bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-2xl max-w-5xl w-full overflow-hidden border-[10px] border-[#001F3F] animate-in zoom-in-95 ${isAr ? 'rtl font-cairo' : 'ltr'}`}>
        <div className="p-8 bg-[#001F3F] text-white flex justify-between items-center text-start">
          <div>
            <h3 className="text-xl font-black uppercase italic tracking-widest">{isAr ? 'تعديل بيانات العملية' : 'Absolute Manifest Override'}</h3>
            <p className="text-[9px] text-[#C2A378] font-black uppercase tracking-widest mt-1">Global Admin Clearance Active</p>
          </div>
          <button onClick={onClose} className="text-white hover:text-rose-500 font-bold transition-colors">✕</button>
        </div>
        <div className="p-10 space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar text-start">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="col-span-1 md:col-span-2 lg:col-span-1"><label className={labelClass}>Booking Ref</label><input className={inputClass} value={formData.bookingNumber} onChange={e => setFormData({...formData, bookingNumber: e.target.value.toUpperCase()})} /></div>
            <div className="col-span-1 md:col-span-2 lg:col-span-2"><label className={labelClass}>Customer Entity</label><input className={inputClass} value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value.toUpperCase()})} /></div>
            <div><label className={labelClass}>Internal Serial</label><input className={`${inputClass} opacity-50`} disabled value={formData.internalSerial} /></div>
            
            <div><label className={labelClass}>Container BIC</label><input className={inputClass} value={formData.containerNumber} onChange={e => setFormData({...formData, containerNumber: e.target.value.toUpperCase()})} /></div>
            <div><label className={labelClass}>Genset Unit</label><input className={inputClass} value={formData.gensetNumber} onChange={e => setFormData({...formData, gensetNumber: e.target.value.toUpperCase()})} /></div>
            <div><label className={labelClass}>Trucking Co</label><input className={inputClass} value={formData.trucker} onChange={e => setFormData({...formData, trucker: e.target.value.toUpperCase()})} /></div>
            <div><label className={labelClass}>Shipper Name</label><input className={inputClass} value={formData.beneficiaryName} onChange={e => setFormData({...formData, beneficiaryName: e.target.value.toUpperCase()})} /></div>
            <div><label className={labelClass}>Destination</label><input className={inputClass} value={formData.destination || ''} onChange={e => setFormData({...formData, destination: e.target.value.toUpperCase()})} /></div>
            <div><label className={labelClass}>Shipper Address</label><input className={inputClass} value={formData.shipperAddress || ''} onChange={e => setFormData({...formData, shipperAddress: e.target.value})} /></div>
            <div><label className={labelClass}>Manual Invoice #</label><input className={inputClass} value={formData.manualInvoiceNumber || ''} onChange={e => setFormData({...formData, manualInvoiceNumber: e.target.value.toUpperCase()})} /></div>
            <div><label className={labelClass}>Commodity</label><input className={inputClass} placeholder="e.g. CITRUS, ORANGES..." value={formData.commodity || ''} onChange={e => setFormData({...formData, commodity: e.target.value.toUpperCase()})} /></div>
            <div><label className={labelClass}>Clipper On Person</label><input className={inputClass} placeholder="Technician / Operator" value={formData.clipperName || ''} onChange={e => setFormData({...formData, clipperName: e.target.value})} /></div>

            <div><label className={labelClass}>Driver Name</label><input className={inputClass} value={formData.driverName || ''} onChange={e => setFormData({...formData, driverName: e.target.value})} /></div>
            <div><label className={labelClass}>Driver Mobile</label><input className={inputClass} value={formData.driverPhone || ''} onChange={e => setFormData({...formData, driverPhone: e.target.value})} /></div>
            <div><label className={labelClass}>Rate (EGP)</label><input type="number" className={inputClass} value={formData.rate} onChange={e => setFormData({...formData, rate: e.target.value})} /></div>
            <div><label className={labelClass}>VAT (EGP)</label><input type="number" className={inputClass} value={formData.vat} onChange={e => setFormData({...formData, vat: e.target.value})} /></div>

            <div><label className={labelClass}>Fuel Load (L)</label><input type="number" className={inputClass} value={formData.gaz || ''} onChange={e => setFormData({...formData, gaz: e.target.value})} /></div>
            <div><label className={labelClass}>Protocol Status</label>
              <select className={inputClass} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                <option value="UNDER OPERATE">UNDER OPERATE</option>
                <option value="IN PROGRESS">IN PROGRESS</option>
                <option value="DONE">DONE</option>
                <option value="HOLD">HOLD</option>
                <option value="CANCEL">CANCEL</option>
              </select>
            </div>
            <div><label className={labelClass}>Clip On Hub</label>
              <select className={inputClass} value={formData.clipOnPort} onChange={e => setFormData({...formData, clipOnPort: e.target.value as Location})}>
                {Object.values(Location).map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>Clip Off Hub</label>
              <select className={inputClass} value={formData.clipOffPort} onChange={e => setFormData({...formData, clipOffPort: e.target.value as Location})}>
                {Object.values(Location).map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div><label className={labelClass}>Received Date</label><input type="date" className={inputClass} value={formData.dateReceived} onChange={e => setFormData({...formData, dateReceived: e.target.value})} /></div>
            <div><label className={labelClass}>Op Entry Date</label><input type="date" className={inputClass} value={formData.operationDate} onChange={e => setFormData({...formData, operationDate: e.target.value})} /></div>
            <div><label className={labelClass}>Clip On Date</label><input type="date" className={inputClass} value={formData.clipOnDate} onChange={e => setFormData({...formData, clipOnDate: e.target.value})} /></div>
            <div><label className={labelClass}>Clip Off Date</label><input type="date" className={inputClass} value={formData.clipOffDate} onChange={e => setFormData({...formData, clipOffDate: e.target.value})} /></div>
          </div>
          <div><label className={labelClass}>Manifest Intelligence / Notes</label><textarea className={`${inputClass} h-24 pt-4`} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} /></div>
          
          <div className="flex gap-4">
             <button onClick={onClose} className="px-10 py-6 text-[11px] font-black uppercase text-slate-400 tracking-widest hover:text-rose-600 transition-colors">Discard Changes</button>
             <button 
              onClick={() => onSave(formData)} 
              className="flex-1 bg-[#C2A378] text-[#001F3F] py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.4em] shadow-2xl active:scale-95 transition-all"
             >
              {isAr ? 'حفظ التعديلات النهائية' : 'AUTHORIZE MANIFEST UPDATE'}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Operations: React.FC<{ highlightId?: string | null; clearHighlight?: () => void }> = ({ highlightId, clearHighlight }) => {
  const { lang } = useContext(LanguageContext);
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'black';
  const t = translations[lang];
  const isAr = lang === 'ar';

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}') as User, []);
  const isAdmin = currentUser.role === UserRole.ADMIN;

  const [operations, setOperations] = useState<Operation[]>(db.getOperations());
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(searchTerm), 150); return () => clearTimeout(timer); }, [searchTerm]);
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
  const [activeQuickFilter, setActiveQuickFilter] = useState<QuickFilter>('ALL');
  const [editingOp, setEditingOp] = useState<Operation | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  const selectedPort = highlightId && Object.values(Location).includes(highlightId as Location)
    ? highlightId as Location
    : null;

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());

  const refresh = () => setOperations([...db.getOperations()]);

  const filteredOps = useMemo(() => {
    return operations.filter(op => {
      const search = debouncedSearch.toLowerCase().trim();
      const matchesSearch = (op.bookingNumber || '').toLowerCase().includes(search) || 
                            (op.customerName || '').toLowerCase().includes(search) || 
                            (op.containerNumber || '').toLowerCase().includes(search);
      
      let matchesFilter = true;
      if (activeQuickFilter === 'DONE') matchesFilter = op.status === 'DONE';
      if (activeQuickFilter === 'PROGRESS') matchesFilter = op.status === 'IN PROGRESS';
      if (activeQuickFilter === 'OPERATE') matchesFilter = op.status === 'UNDER OPERATE';
      if (activeQuickFilter === 'REVIEW') matchesFilter = !op.reviewedByManager;
      
      const matchesPort = !selectedPort || op.clipOnPort === selectedPort || op.clipOffPort === selectedPort;
      return matchesSearch && matchesFilter && matchesPort;
    });
  }, [operations, debouncedSearch, activeQuickFilter, selectedPort]);

  const grouped = useMemo(() => {
    const groups: Record<string, Operation[]> = {};
    filteredOps.forEach(op => {
      if (!groups[op.bookingNumber]) groups[op.bookingNumber] = [];
      groups[op.bookingNumber].push(op);
    });
    return Object.entries(groups).map(([bk, items]) => ({
      bk,
      items,
      rep: items[0],
      total: items.reduce((s, i) => s + (Number.parseFloat(i.rate || '0') || 0) + (Number.parseFloat(i.vat || '0') || 0), 0),
      needsReview: items.some(i => !i.reviewedByManager)
    })).sort((a,b) => b.rep.operationDate.localeCompare(a.rep.operationDate));
  }, [filteredOps]);

  const dailyPortActivity = useMemo(() => {
    const activity: Record<string, { on: number, off: number, added: number }> = {};
    Object.values(Location).forEach(loc => {
      if (loc !== Location.MAL) activity[loc] = { on: 0, off: 0, added: 0 };
    });

    operations.forEach(op => {
      // Deployed today
      if (op.clipOnDate === todayStr) {
        if (activity[op.clipOnPort]) activity[op.clipOnPort].on++;
      }
      // Released today
      if (op.clipOffDate === todayStr) {
        if (activity[op.clipOffPort]) activity[op.clipOffPort].off++;
      }
      // New Booking entry today
      if (op.dateReceived === todayStr) {
        if (activity[op.clipOnPort]) activity[op.clipOnPort].added++;
      }
    });

    return Object.entries(activity).filter(([_, counts]) => counts.on > 0 || counts.off > 0 || counts.added > 0);
  }, [operations, todayStr]);

  const extractPhoto = (notes?: string) => {
    if (!notes) return null;
    const match = notes.match(/\[IMAGE_DATA:(.*?)\]/);
    return match ? match[1] : null;
  };

  const handleUpdateCell = async (op: Operation, field: keyof Operation, val: any) => {
    if (!isAdmin) return;
    const saved = await db.updateOperation({ ...op, [field]: val });
    if (saved) refresh();
    else alert(isAr ? `فشل حفظ التعديل. ${db.getLastDbError() || ''}` : `Failed to save change. ${db.getLastDbError() || ''}`);
  };

  const handleConfirmRecord = async (opId: string) => {
    if (!isAdmin) return;
    if (confirm(isAr ? 'تأكيد صحة بيانات هذه العملية؟' : 'Authorize and verify this manifest entry?')) {
      await db.confirmOperation(opId);
      refresh();
    }
  };

  const handleForceVerifyAll = async () => {
    if (!isAdmin) return;
    const pendingIds = filteredOps.filter(o => !o.reviewedByManager).map(o => o.id);
    if (pendingIds.length === 0) {
      alert(isAr ? 'لا توجد عمليات بانتظار المراجعة في القائمة الحالية' : 'No pending records in current view.');
      return;
    }
    if (confirm(isAr ? `تأكيد اعتماد جميع العمليات الـ ${pendingIds.length} المعروضة؟` : `FORCE VERIFY: Authenticate all ${pendingIds.length} visible pending records?`)) {
      await db.confirmOperationsBulk(pendingIds);
      refresh();
    }
  };

  const handleSaveForceEdit = async (updatedOp: Operation) => {
    const saved = await db.updateOperation(updatedOp);
    if (!saved) {
      alert(isAr ? `فشل حفظ التعديل. ${db.getLastDbError() || ''}` : `Failed to save change. ${db.getLastDbError() || ''}`);
      return;
    }
    setEditingOp(null);
    refresh();
    alert(isAr ? 'تم تحديث البيانات بنجاح' : 'Manifest entry successfully updated.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-start pb-20">
      
      {/* Search & Stats HUD */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-10">
           <div>
              <h3 className="text-2xl font-black text-[#001F3F] dark:text-white uppercase italic tracking-tighter">Fleet Manifest</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Operational Registry • {todayStr}</p>
           </div>
           <div className="flex flex-wrap gap-3">
              {[
                { id: 'ALL', label: 'Global View', count: operations.length },
                { id: 'REVIEW', label: 'Needs Boss Review', count: operations.filter(o => !o.reviewedByManager).length, color: 'text-amber-600', glow: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]' },
                { id: 'PROGRESS', label: 'On Trip', count: operations.filter(o => o.status === 'IN PROGRESS').length },
                { id: 'DONE', label: 'Released', count: operations.filter(o => o.status === 'DONE').length },
              ].map(q => (
                <button 
                  key={q.id}
                  onClick={() => setActiveQuickFilter(q.id as any)}
                  className={`px-5 py-2.5 rounded-xl border-2 transition-all flex items-center gap-4 ${activeQuickFilter === q.id ? 'bg-[#001F3F] border-[#001F3F] text-white shadow-xl ' + (q.glow || '') : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500'}`}
                >
                   <span className={`text-[10px] font-black uppercase tracking-wider ${activeQuickFilter !== q.id ? q.color || '' : ''}`}>{q.label}</span>
                   <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${activeQuickFilter === q.id ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'}`}>{q.count}</span>
                </button>
              ))}
              {isAdmin && activeQuickFilter === 'REVIEW' && (
                <button 
                  onClick={handleForceVerifyAll}
                  className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-emerald-700 transition-all flex items-center gap-2 border-2 border-emerald-500 animate-pulse"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  {isAr ? 'اعتماد الجميع' : 'Verify All Visible'}
                </button>
              )}
           </div>
        </div>

        {/* DAILY PORT ACTIVITY SUMMARY */}
        <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-[2.5rem] border border-slate-100 dark:border-white/5">
           <div className="flex items-center justify-between mb-4 px-2">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#C2A378] italic">Today's Terminal Throughput</h4>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Real-time Node Monitoring</span>
           </div>
           <div className="flex flex-wrap gap-4">
              {dailyPortActivity.map(([port, counts]) => {
                const style = PORT_STYLING[port as Location];
                return (
                  <div key={port} className="flex items-center bg-white dark:bg-slate-800 rounded-3xl p-1.5 pr-6 border border-slate-100 dark:border-white/5 shadow-sm transition-all hover:shadow-md hover:scale-[1.02]">
                     <span className={`px-3 py-2.5 rounded-2xl font-black text-[10px] uppercase ${style?.bg || 'bg-slate-900'} ${style?.text || 'text-white'} border ${style?.border || 'border-transparent'} mr-6`}>
                        {translateEntity(port, lang)}
                     </span>
                     <div className="flex items-center gap-8">
                        <div className="text-center">
                           <p className="text-[8px] font-black text-blue-500 uppercase leading-none mb-1">Booked</p>
                           <p className="text-sm font-black text-slate-900 dark:text-white leading-none">{counts.added}</p>
                        </div>
                        <div className="w-px h-6 bg-slate-100 dark:bg-slate-700"></div>
                        <div className="text-center">
                           <p className="text-[8px] font-black text-emerald-500 uppercase leading-none mb-1">Clip On</p>
                           <p className="text-sm font-black text-slate-900 dark:text-white leading-none">{counts.on}</p>
                        </div>
                        <div className="w-px h-6 bg-slate-100 dark:bg-slate-700"></div>
                        <div className="text-center">
                           <p className="text-[8px] font-black text-amber-500 uppercase leading-none mb-1">Clip Off</p>
                           <p className="text-sm font-black text-slate-900 dark:text-white leading-none">{counts.off}</p>
                        </div>
                     </div>
                  </div>
                );
              })}
              {dailyPortActivity.length === 0 && (
                <div className="w-full text-center py-2">
                   <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic">No logistics events recorded today for {todayStr}</p>
                </div>
              )}
           </div>
         </div>

        {/* DAILY COMMAND BOARD — YESTERDAY / TODAY */}
        <div className="space-y-3 mb-4">
          <div className="flex flex-col 2xl:flex-row gap-2">
            {(() => {
              const dayKey = (offset: number) => {
                const d = new Date();
                d.setDate(d.getDate() + offset);
                return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
              };
              const makeStats = (date: string) => {
                const dayOps = operations.filter(o => o.operationDate === date);
                return {
                  ops: dayOps.length,
                  clipOn: operations.filter(o => o.clipOnDate === date).length,
                  clipOff: operations.filter(o => o.clipOffDate === date).length,
                  inProgress: dayOps.filter(o => o.status === 'IN PROGRESS').length,
                  underOperate: dayOps.filter(o => o.status === 'UNDER OPERATE').length
                };
              };
              const yesterdayKey = dayKey(-1);
              const todayKey = dayKey(0);
              const yesterday = makeStats(yesterdayKey);
              const today = makeStats(todayKey);
              const statDefs = [
                ['ops', isAr ? 'إجمالي OPS' : 'TOTAL OPS'],
                ['clipOn', isAr ? 'إجمالي CLIP ON' : 'TOTAL CLIP ON'],
                ['clipOff', isAr ? 'إجمالي CLIP OFF' : 'TOTAL CLIP OFF'],
                ['inProgress', isAr ? 'قيد التنفيذ' : 'TOTAL IN PROGRESS'],
                ['underOperate', isAr ? 'تحت التشغيل' : 'TOTAL UNDER OPERATE']
              ] as const;
              const renderDay = (title: string, date: string, stats: ReturnType<typeof makeStats>) => (
                <div className={`flex-1 min-w-[360px] rounded-2xl border p-3 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-widest text-[#C2A378]">{title}</span>
                    <span className="text-[9px] font-mono text-slate-400">{date}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {statDefs.map(([key, label]) => (
                      <div key={key} className={`rounded-xl border p-2 text-center ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <div className={`text-lg font-black leading-none ${isDark ? 'text-white' : 'text-[#001F3F]'}`}>{stats[key]}</div>
                        <div className="mt-1 text-[7px] font-black uppercase leading-tight text-slate-500">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
              return (
                <>
                  {renderDay(isAr ? 'أمس — DAILY MANIFEST' : 'YESTERDAY — DAILY MANIFEST', yesterdayKey, yesterday)}
                  {renderDay(isAr ? 'اليوم — LIVE MANIFEST' : 'TODAY — LIVE MANIFEST', todayKey, today)}
                </>
              );
            })()}
          </div>

          {/* LIVE GENSET STOCK BY PORT */}
          <div className={`rounded-2xl border p-3 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-widest text-[#C2A378]">{isAr ? 'رصيد المولدات حسب الميناء' : 'GENSET STOCK BY PORT'}</span>
              <span className="text-[8px] text-slate-400">LIVE DATABASE</span>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {Object.values(Location).map(port => {
                const count = db.getStock().filter(g => String(g.location) === port).length;
                return (
                  <div key={port} className={`rounded-xl border p-2 text-center ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-[9px] font-black text-slate-400">{translateEntity(port, lang)}</div>
                    <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-[#001F3F]'}`}>{count}</div>
                    <div className="text-[7px] font-bold text-slate-500">UNITS</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="relative">
           <input 
             type="text" 
             placeholder="Lookup by BK#, Partner, or Container ID..." 
             className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-900 border-2 border-transparent rounded-2xl text-sm font-bold text-blue-900 dark:text-white outline-none focus:border-blue-400 shadow-inner transition-all"
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
           />
           <svg className="absolute left-4.5 top-4.5 w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>

      {/* Manifest Master Sheet */}
      <div className="bg-white dark:bg-slate-800 rounded-[3.5rem] shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap border-collapse">
            <thead className="bg-[#001F3F] dark:bg-slate-950 text-white text-[9px] font-black uppercase tracking-widest sticky top-0 z-20">
              <tr>
                <th className="p-5 w-10 text-center"></th>
                <th className="p-5">Booking Ref</th>
                <th className="p-5">Commercial Partner</th>
                <th className="p-5 text-center">Verification</th>
                <th className="p-5 text-center">Timeline</th>
                <th className="p-5 text-right">Revenue (EGP)</th>
                <th className="p-5 text-center">Protocol Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px] font-bold">
              {grouped.map(group => {
                const isEx = expandedBooking === group.bk;
                return (
                  <React.Fragment key={group.bk}>
                    <tr onClick={() => setExpandedBooking(isEx ? null : group.bk)} className={`group cursor-pointer transition-all ${isEx ? 'bg-blue-50/50 dark:bg-blue-900/10 shadow-inner' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                      <td className="p-5 text-center text-slate-300 group-hover:text-blue-600 transition-colors">
                        <span className={`inline-block transition-transform ${isEx ? 'rotate-90' : ''}`}>▶</span>
                      </td>
                      <td className={`p-5 font-black font-mono text-sm tracking-tighter ${group.needsReview ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>#{group.bk}</td>
                      <td className="p-5 uppercase text-slate-700 dark:text-slate-200">{translateEntity(group.rep.customerName, lang)}</td>
                      <td className="p-5 text-center">
                        {group.needsReview ? (
                          <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-xl text-[8px] font-black uppercase tracking-widest animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.2)] border border-amber-100">
                             {t.pendingReview}
                          </span>
                        ) : (
                          <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-xl text-[8px] font-black uppercase tracking-widest border border-emerald-100 flex items-center justify-center gap-1 mx-auto w-fit">
                             <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                             {t.verifiedByBoss}
                          </span>
                        )}
                      </td>
                      <td className="p-5 text-center text-slate-400 italic font-medium">{group.rep.operationDate}</td>
                      <td className="p-5 text-right font-black text-emerald-600">EGP {group.total.toLocaleString()}</td>
                      <td className="p-5 text-center">
                        <span className={`px-4 py-1.5 rounded-xl text-[8px] font-black uppercase border tracking-widest ${
                          group.rep.status === 'DONE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          group.rep.status === 'IN PROGRESS' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                          'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                          {translateEntity(group.rep.status, lang)}
                        </span>
                      </td>
                    </tr>
                    {isEx && (
                      <tr className="bg-slate-50 dark:bg-slate-900/50">
                        <td colSpan={7} className="p-8">
                           <div className="grid grid-cols-1 gap-6 max-w-6xl mx-auto">
                              {group.items.map((item, idx) => {
                                const photo = extractPhoto(item.notes);
                                return (
                                <div key={item.id} className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] border border-slate-100 dark:border-white/5 shadow-xl relative overflow-hidden group/item">
                                   <div className="absolute top-0 right-0 p-6 opacity-5 font-black italic text-5xl">MANIFEST #{idx+1}</div>
                                   <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-start relative z-10">
                                      {/* Asset ID Card */}
                                      <div className="space-y-4">
                                         <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-700 pb-3">
                                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Core</h5>
                                            {!item.reviewedByManager ? (
                                              <span className="text-[7px] font-black text-amber-600 uppercase italic">Unverified</span>
                                            ) : (
                                              <span className="text-[7px] font-black text-emerald-600 uppercase italic">Command Authenticated</span>
                                            )}
                                         </div>
                                         <div className="flex gap-4">
                                            <div className="flex-1">
                                               <div>
                                                  <p className="text-[7px] font-black text-slate-300 uppercase">Container ID</p>
                                                  <p className="font-mono font-black text-xl text-slate-900 dark:text-white uppercase">{item.containerNumber || '---'}</p>
                                               </div>
                                               <div className="mt-2">
                                                  <p className="text-[7px] font-black text-slate-300 uppercase">Genset Serial</p>
                                                  <p className="font-black text-blue-600 italic tracking-tighter uppercase">{item.gensetNumber || 'UNASSIGNED'}</p>
                                               </div>
                                            </div>
                                            {photo && (
                                              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-sm cursor-zoom-in" onClick={() => setViewingPhoto(photo)}>
                                                 <img src={photo} className="w-full h-full object-cover" alt="Dispatch Evidence" />
                                              </div>
                                            )}
                                         </div>
                                      </div>

                                      {/* Terminal Timeline */}
                                      <div className="space-y-4">
                                         <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-700 pb-3">Logistics Nodes</h5>
                                         <div className="flex items-center gap-6">
                                            <div className="text-center">
                                               <InlineEdit 
                                                  value={item.clipOnPort} 
                                                  options={Object.values(Location)} 
                                                  disabled={!isAdmin}
                                                  onSave={(v) => handleUpdateCell(item, 'clipOnPort', v)}
                                                  renderValue={(v) => <p className="text-[8px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase mb-1">{v}</p>}
                                               />
                                               <p className="text-[10px] font-bold">{item.clipOnDate}</p>
                                               <p className="text-[7px] font-black text-slate-300 uppercase">Clip On</p>
                                            </div>
                                            <div className="flex-1 h-px bg-slate-100 relative">
                                               <div className="absolute inset-0 bg-blue-500 animate-pulse origin-left scale-x-50"></div>
                                            </div>
                                            <div className="text-center">
                                               <InlineEdit 
                                                  value={item.clipOffPort} 
                                                  options={Object.values(Location)} 
                                                  disabled={!isAdmin}
                                                  onSave={(v) => handleUpdateCell(item, 'clipOffPort', v)}
                                                  renderValue={(v) => <p className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase mb-1">{v}</p>}
                                               />
                                               <p className="text-[10px] font-bold">{item.clipOffDate || '---'}</p>
                                               <p className="text-[7px] font-black text-slate-300 uppercase">Release</p>
                                            </div>
                                         </div>
                                         <div className="pt-4 flex justify-between items-center text-[9px] font-bold text-slate-400 border-t border-slate-50 dark:border-slate-700 mt-4">
                                            <span>{t.trucker.toUpperCase()}: {translateEntity(item.trucker, lang)}</span>
                                            <span className="text-blue-600 font-black">FUEL: {item.gaz}L</span>
                                         </div>
                                         <div className="text-[9px] font-bold text-slate-400">
                                            <span>{t.shipper.toUpperCase()}: {translateEntity(item.beneficiaryName, lang)}</span>
                                         </div>
                                      </div>

                                      {/* Actions / Financials */}
                                      <div className="space-y-4 flex flex-col h-full justify-between">
                                         <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-700 pb-3">
                                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorization</h5>
                                            {isAdmin && (
                                              <button 
                                                onClick={() => setEditingOp(item)}
                                                className="text-[8px] font-black uppercase text-blue-600 hover:underline underline-offset-4"
                                              >
                                                {isAr ? 'تعديل إجباري' : 'Force Edit'}
                                              </button>
                                            )}
                                         </div>
                                         <div className="space-y-3">
                                            <div className="flex justify-between items-end">
                                               <span className="text-[8px] font-black text-slate-300 uppercase">Account Rate</span>
                                               <InlineEdit 
                                                  value={item.rate}
                                                  type="number"
                                                  disabled={!isAdmin}
                                                  onSave={(v) => handleUpdateCell(item, 'rate', v)}
                                                  className="font-black text-slate-900 dark:text-white"
                                                  renderValue={(v) => <span>EGP {parseFloat(v).toLocaleString()}</span>}
                                               />
                                            </div>
                                            <div className="flex justify-between items-end">
                                               <span className="text-[8px] font-black text-slate-300 uppercase">VAT (14%)</span>
                                               <span className="font-black text-slate-400">EGP {parseFloat(item.vat).toLocaleString()}</span>
                                            </div>
                                         </div>
                                         {isAdmin && !item.reviewedByManager ? (
                                           <div className="flex gap-2 mt-4">
                                              <button 
                                                onClick={() => handleConfirmRecord(item.id)}
                                                className="flex-1 py-4 bg-[#001F3F] text-[#C2A378] hover:bg-emerald-600 hover:text-white rounded-2xl border-2 border-[#C2A378] transition-all font-black uppercase text-[9px] tracking-widest shadow-xl flex items-center justify-center gap-2"
                                              >
                                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                                  {t.authorizeRecord}
                                              </button>
                                           </div>
                                         ) : item.reviewedByManager ? (
                                           <div className="w-full py-4 bg-slate-50 dark:bg-slate-900/50 text-slate-400 rounded-2xl border border-slate-100 dark:border-slate-700 text-center font-black uppercase text-[8px] tracking-[0.2em] italic mt-4">
                                              Registry Verified
                                           </div>
                                         ) : (
                                           <div className="w-full py-4 bg-amber-50 dark:bg-amber-900/10 text-amber-600 rounded-2xl border border-amber-100 dark:border-amber-900/30 text-center font-black uppercase text-[8px] tracking-widest italic animate-pulse mt-4">
                                              Awaiting Verification
                                           </div>
                                         )}
                                      </div>
                                   </div>
                                </div>
                              );})}
                           </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {grouped.length === 0 && (
                <tr>
                   <td colSpan={7} className="py-24 text-center italic text-slate-300 font-black uppercase tracking-[0.5em]">No operational data matched</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingOp && (
        <EditOperationModal 
          op={editingOp} 
          lang={lang}
          onClose={() => setEditingOp(null)} 
          onSave={handleSaveForceEdit} 
        />
      )}

      {/* FULL PHOTO VIEWER MODAL */}
      {viewingPhoto && (
        <div className="fixed inset-0 bg-black/95 z-[1000] flex items-center justify-center p-4" onClick={() => setViewingPhoto(null)}>
           <div className="relative max-w-5xl w-full">
              <img src={viewingPhoto} className="w-full h-auto rounded-[2rem] shadow-2xl" alt="Large Evidence" />
              <button className="absolute -top-12 right-0 text-white text-2xl font-black">✕ CLOSE</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default Operations;
