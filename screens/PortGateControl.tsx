
import React, { useState, useMemo, useContext, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../services/supabaseDb';
import { Operation, Location, GensetStatus, UserRole, User } from '../types';
import { LanguageContext, ThemeContext } from '../App';
import { translations, translateEntity } from '../translations';
import { scanImageForContainer, getSafeApiKey } from '../services/aiService';

const PortGateControl: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'black';
  const t = translations[lang];
  const isAr = lang === 'ar';
  
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}') as User, []);
  const isOperator = currentUser.role === UserRole.GATE_OPERATOR;
  
  const availablePorts = useMemo(() => {
    if (isOperator && currentUser.assignedPorts && currentUser.assignedPorts.length > 0) {
      return currentUser.assignedPorts;
    }
    return Object.values(Location).filter(l => l !== Location.MAL);
  }, [isOperator, currentUser]);

  const [selectedPort, setSelectedPort] = useState<Location>(availablePorts[0] || Location.ALEX);
  const [targetPort, setTargetPort] = useState<Location | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedContainer, setScannedContainer] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [selectedGensets, setSelectedGensets] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [evidenceImage, setEvidenceImage] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');
  const [operations, setOperations] = useState<Operation[]>(db.getOperations());
  const [stock, setStock] = useState(db.getStock());
  
  const [isManualBooking, setIsManualBooking] = useState(false);
  const [manualBooking, setManualBooking] = useState({ 
    number: '', 
    customer: '', 
    shipper: '', 
    trucker: '',
    driverName: '',
    driverPhone: ''
  });

  const [viewTab, setViewTab] = useState<'GATE' | 'TRANSIT' | 'UPCOMING'>(() => (sessionStorage.getItem('portGateTab') as any) || 'GATE');
  const [mode, setMode] = useState<'DISPATCH' | 'PORT_MOVE'>('DISPATCH'); 
  const [manualGaz, setManualGaz] = useState('40');
  const [showDoubleConfirm, setShowDoubleConfirm] = useState(false);
  
  const [containerMatchedViaScan, setContainerMatchedViaScan] = useState(false);
  const [clipOffCandidate, setClipOffCandidate] = useState<Operation | null>(null);
  const [notifications, setNotifications] = useState<{id: number, msg: string}[]>([]);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const evidenceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<'GATE' | 'TRANSIT' | 'UPCOMING'>;
      if (customEvent.detail) {
        setViewTab(customEvent.detail);
      }
    };
    window.addEventListener('port-gate-tab-change', handleTabChange);
    return () => {
      window.removeEventListener('port-gate-tab-change', handleTabChange);
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      setOperations([...db.getOperations()]);
      setStock([...db.getStock()]);
    };
    window.addEventListener('db-undo-success', sync);
    return () => window.removeEventListener('db-undo-success', sync);
  }, []);

  const suggestions = useMemo(() => {
    const allCustomers = db.getUsers().filter(u => u.role === UserRole.CUSTOMER).map(u => u.companyName || u.name);
    return {
      customers: Array.from(new Set(allCustomers)),
      truckers: Array.from(new Set(operations.map(o => o.trucker).filter(Boolean))),
      shippers: Array.from(new Set(operations.map(o => o.beneficiaryName).filter(Boolean))),
      drivers: Array.from(new Set(operations.map(o => o.driverName).filter(Boolean))),
      phones: Array.from(new Set(operations.map(o => o.driverPhone).filter(Boolean))),
    };
  }, [operations]);

  const openBookings = useMemo(() => {
    return operations.filter(op => op.clipOnPort === selectedPort && op.status === 'UNDER OPERATE');
  }, [selectedPort, operations]);

  const terminalOps = useMemo(() => {
    const departing = operations.filter(op => op.clipOnPort === selectedPort && op.status === 'IN PROGRESS');
    const arriving = operations.filter(op => op.clipOffPort === selectedPort && op.status === 'IN PROGRESS' && op.clipOnPort !== selectedPort);
    const upcoming = operations.filter(op => op.clipOnPort === selectedPort && op.status === 'UNDER OPERATE');
    return { departing, arriving, upcoming };
  }, [selectedPort, operations]);

  const availableGensets = useMemo(() => {
    return stock.filter(s => s.location === selectedPort && s.status === GensetStatus.IN_STOCK);
  }, [selectedPort, stock]);

  const toggleGensetSelection = (unitNumber: string) => {
    if (mode === 'DISPATCH') setSelectedGensets([unitNumber]);
    else setSelectedGensets(prev => prev.includes(unitNumber) ? prev.filter(u => u !== unitNumber) : [...prev, unitNumber]);
  };

  const addNotification = (msg: string) => {
    const id = Date.now();
    setNotifications(prev => [{id, msg}, ...prev]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  };

  const extractPhoto = (notes?: string) => {
    if (!notes) return null;
    const match = notes.match(/\[IMAGE_DATA:(.*?)\]/);
    return match ? match[1] : null;
  };

  const handleEvidenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setEvidenceImage(reader.result as string);
      addNotification(isAr ? 'تم إرفاق صورة الإثبات' : 'Evidence photo attached');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!getSafeApiKey()) {
      addNotification(isAr ? 'خطأ: مفتاح AI غير موجود' : 'Error: AI Key Missing');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result as string;
      setPreviewImage(base64Data);
      setIsScanning(true);
      setAnalysisStatus(isAr ? 'جاري تحليل الصورة...' : 'ANALYZING IMAGE...');
      try {
        const result = await scanImageForContainer(base64Data);
        if (result && result !== 'NOT_FOUND') {
          const cleanId = result.replace(/[^A-Z0-9]/g, '').toUpperCase();
          setScannedContainer(cleanId);
          const match = openBookings.find(b => (b.containerNumber && b.containerNumber.toUpperCase() === cleanId));
          if (match) {
            setSelectedBookingId(match.id);
            setContainerMatchedViaScan(true);
            addNotification(isAr ? `تطابق ناجح: ${cleanId}` : `MATCH FOUND: ${cleanId}`);
          } else {
            setContainerMatchedViaScan(false);
            addNotification(isAr ? `تم التعرف: ${cleanId}` : `DETECTED: ${cleanId}`);
          }
        } else {
          addNotification(isAr ? 'فشل استخراج رقم الحاوية' : 'COULD NOT READ BIC');
        }
      } catch (err) {
        addNotification(isAr ? 'خطأ في معالجة الصور' : 'IMAGE PROCESSING ERROR');
      } finally {
        setIsScanning(false);
        setAnalysisStatus('');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleProcessAction = async () => {
    const timestamp = new Date().toISOString().split('T')[0];

    if (mode === 'PORT_MOVE') {
      if (!targetPort) return;
      await Promise.all(selectedGensets.map(async unitNum => {
        const unit = stock.find(s => s.unitNumber === unitNum);
        if (unit) await db.updateGenset({ ...unit, location: targetPort });
      }));
      addNotification(isAr ? `تم النقل إلى ${translateEntity(targetPort, lang)}` : `TRANSFERRED TO ${targetPort}`);
    } else {
      // Duplicates are intentionally allowed. Warn only when the selected unit
      // is already assigned to another IN PROGRESS operation.
      const conflicts = selectedGensets.flatMap(unitNum =>
        db.getActiveGensetConflicts(unitNum, isManualBooking ? undefined : selectedBookingId)
          .map(op => ({ unitNum, bookingNumber: op.bookingNumber }))
      );
      if (conflicts.length) {
        const details = conflicts.map(c => `${c.unitNum} / ${c.bookingNumber}`).join(', ');
        addNotification(isAr
          ? `🔴 تنبيه: المولد مستخدم بالفعل في تشغيل نشط — ${details}. تم السماح بالحفظ.`
          : `🔴 ALERT: unit already has IN PROGRESS assignment — ${details}. SAVE IS ALLOWED.`);
      }

      const jobs = selectedGensets.map(async unitNum => {
        const imageTag = evidenceImage ? `[IMAGE_DATA:${evidenceImage}]` : '';
        if (isManualBooking) {
          const saved = await db.addOperation({
            id: `op-man-${Date.now()}-${unitNum}`,
            internalSerial: '',
            customerName: manualBooking.customer || 'WALK-IN',
            bookingNumber: manualBooking.number.toUpperCase(),
            containerNumber: scannedContainer.toUpperCase(),
            gensetNumber: unitNum,
            beneficiaryName: manualBooking.shipper,
            trucker: manualBooking.trucker,
            driverName: manualBooking.driverName,
            driverPhone: manualBooking.driverPhone,
            status: 'IN PROGRESS',
            clipOnPort: selectedPort,
            clipOffPort: selectedPort,
            operationDate: timestamp,
            dateReceived: timestamp,
            clipOnDate: timestamp,
            clipOffDate: '',
            gaz: manualGaz,
            rate: '0.00',
            vat: '0.00',
            shipperAddress: '',
            notes: imageTag
          });
          return { saved, unitNum };
        }

        const op = operations.find(o => o.id === selectedBookingId);
        if (!op) return;
        const saved = await db.updateOperation({
          ...op,
          containerNumber: scannedContainer.toUpperCase(),
          gensetNumber: unitNum,
          driverName: manualBooking.driverName,
          driverPhone: manualBooking.driverPhone,
          status: 'IN PROGRESS',
          clipOnDate: timestamp,
          gaz: manualGaz,
          notes: (op.notes || '').includes('[IMAGE_DATA:') ? op.notes : (op.notes || '') + imageTag
        });
        return { saved, unitNum };
      });

      const results = await Promise.all(jobs);
      const failedUnits = results
        .filter((r: any) => r && r.saved === false)
        .map((r: any) => r.unitNum);

      if (failedUnits.length > 0) {
        const dbError = db.getLastDbError();
        addNotification(isAr
          ? `❌ فشل حفظ العملية للمولد: ${failedUnits.join(', ')}. السبب: ${dbError || 'خطأ غير محدد'}`
          : `❌ DATABASE SAVE FAILED for genset: ${failedUnits.join(', ')}. Reason: ${dbError || 'Unknown database error'}`);
        setShowDoubleConfirm(false);
        return;
      }

      // Re-read operations from Supabase so the UI is proving the saved record exists,
      // rather than relying only on the local cache.
      await db.reloadOperations();
      addNotification(isAr ? 'تم التصريح بالخروج بعد تأكيد الحفظ' : 'GATE AUTHORIZED — SAVED');
    }

    resetForm();
    setShowDoubleConfirm(false);
  };

  const finalizeClipOff = () => {
    if (!clipOffCandidate) return;
    db.updateOperation({ 
      ...clipOffCandidate, 
      status: 'DONE', 
      clipOffDate: new Date().toISOString().split('T')[0], 
      clipOffPort: selectedPort 
    });
    addNotification(isAr ? `تم الاستلام: ${clipOffCandidate.gensetNumber}` : `RELEASED: ${clipOffCandidate.gensetNumber}`);
    setClipOffCandidate(null);
  };

  const resetForm = () => {
    setScannedContainer('');
    setSelectedBookingId('');
    setSelectedGensets([]);
    setPreviewImage(null);
    setEvidenceImage(null);
    setManualGaz('40');
    setContainerMatchedViaScan(false);
    setTargetPort(null);
    setIsManualBooking(false);
    setManualBooking({ number: '', customer: '', shipper: '', trucker: '', driverName: '', driverPhone: '' });
  };

  const handleExportExcel = () => {
    let dataset: Operation[] = [];
    let sheetName = 'Port Gate Operations';
    
    if (viewTab === 'UPCOMING') {
      dataset = terminalOps.upcoming;
      sheetName = 'Upcoming Next Ops';
    } else if (viewTab === 'TRANSIT') {
      dataset = [...terminalOps.arriving, ...terminalOps.departing];
      sheetName = 'Active Transit Ops';
    } else {
      dataset = operations.filter(op => op.clipOnPort === selectedPort || op.clipOffPort === selectedPort);
      sheetName = 'Port Gate Operations';
    }

    const exportRows = dataset.map((op, idx) => ({
      '#': idx + 1,
      [isAr ? 'رقم الحجز' : 'Booking #']: op.bookingNumber || '',
      [isAr ? 'العميل' : 'Customer Name']: op.customerName || '',
      [isAr ? 'رقم الحاوية' : 'Container #']: op.containerNumber || '',
      [isAr ? 'رقم المولد' : 'Genset #']: op.gensetNumber || '',
      [isAr ? 'المشحن' : 'Shipper']: op.beneficiaryName || '',
      [isAr ? 'الناقل' : 'Trucker']: op.trucker || '',
      [isAr ? 'السائق' : 'Driver Name']: op.driverName || '',
      [isAr ? 'هاتف السائق' : 'Driver Phone']: op.driverPhone || '',
      [isAr ? 'محطة الربط' : 'Clip-On Port']: op.clipOnPort || '',
      [isAr ? 'محطة الفك' : 'Clip-Off Port']: op.clipOffPort || '',
      [isAr ? 'تاريخ العملية' : 'Operation Date']: op.operationDate || '',
      [isAr ? 'الحالة' : 'Status']: op.status || '',
      [isAr ? 'الوقود (لتر)' : 'Fuel (L)']: op.gaz || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const fileName = `Port_Gate_${selectedPort}_${viewTab}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    addNotification(isAr ? `تم تصدير ملف إكسيل (${exportRows.length} سجل)` : `Excel spreadsheet exported (${exportRows.length} records)`);
  };

  const StepCircle = ({num, active}: {num: number, active: boolean}) => (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black transition-all text-xs ${active ? 'bg-blue-600 text-white shadow-lg ring-4 ring-blue-100' : 'bg-slate-200 text-slate-500'}`}>{num}</div>
  );

  return (
    <div className="h-full flex flex-col gap-2 text-start animate-in fade-in duration-300 overflow-hidden -mt-4 lg:mt-0">
      
      <div className="bg-[#001F3F] p-4 pb-6 rounded-b-[2.5rem] shadow-2xl relative overflow-hidden shrink-0 mx-[-1rem]">
        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#C2A378] rounded-xl flex items-center justify-center text-slate-900 font-black text-xs shadow-lg">
                {isAr ? 'مركز' : 'HUB'}
              </div>
              <div>
                <h1 className="text-lg font-black text-white italic tracking-tighter uppercase leading-none">{t.portGate}</h1>
                <p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mt-1">
                  {isAr ? 'مزامنة مباشرة للمحطة' : 'Live Terminal Sync'}
                </p>
              </div>
            </div>
            <div className="flex bg-white/10 p-1 rounded-xl">
              <button onClick={() => setViewTab('GATE')} className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${viewTab === 'GATE' ? 'bg-[#C2A378] text-[#001F3F]' : 'text-slate-400'}`}>
                {isAr ? 'البوابة' : 'GATE'}
              </button>
              <button onClick={() => setViewTab('TRANSIT')} className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${viewTab === 'TRANSIT' ? 'bg-[#C2A378] text-[#001F3F]' : 'text-slate-400'}`}>
                {isAr ? 'الرحلات' : 'ACTIVE'}
              </button>
              <button onClick={() => setViewTab('UPCOMING')} className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${viewTab === 'UPCOMING' ? 'bg-[#C2A378] text-[#001F3F]' : 'text-slate-400'}`}>
                {isAr ? 'القادمة' : 'NEXT'}
              </button>
            </div>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5 flex items-center justify-between flex-wrap gap-2">
             <span className="text-[8px] font-black text-[#C2A378] uppercase">{isAr ? 'المحطة النشطة' : 'Active Hub'}</span>
             <div className="flex items-center gap-2">
               <button 
                 type="button"
                 onClick={handleExportExcel}
                 className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider shadow flex items-center gap-1.5 transition-all"
                 title="Export current tab data to Excel"
               >
                 <span>📊</span> {isAr ? 'تصدير إكسيل' : 'Export Excel'}
               </button>
               <select className="bg-white text-black text-sm font-black outline-none cursor-pointer px-4 py-1 rounded-lg font-cairo" value={selectedPort} onChange={(e) => { setSelectedPort(e.target.value as Location); setTargetPort(null); setSelectedGensets([]); }}>
                {availablePorts.map(l => <option key={l} value={l}>{translateEntity(l, lang)}</option>)}
               </select>
             </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-32 px-1 space-y-4 pt-2 font-cairo text-start">
        {viewTab === 'GATE' && (
          <div className="flex flex-col gap-4 animate-in slide-in-from-bottom-4">
            
            {mode === 'DISPATCH' && (
              <div className={`p-5 rounded-[2.5rem] shadow-sm border border-slate-100 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <StepCircle num={1} active={!!selectedBookingId || (isManualBooking && !!manualBooking.number)} />
                    <h2 className={`text-xs font-black uppercase ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {isAr ? 'تفاصيل الحجز' : 'BOOKING'}
                    </h2>
                  </div>
                  <button onClick={() => { setIsManualBooking(!isManualBooking); setSelectedBookingId(''); }} className="text-[9px] font-black uppercase text-blue-500 underline decoration-dotted">
                    {isManualBooking ? (isAr ? 'اختيار من الموجود' : 'Choose Existing') : (isAr ? '+ إدخل يدوي' : '+ Manual Override')}
                  </button>
                </div>

                {!isManualBooking ? (
                  <select 
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-xs font-black uppercase outline-none focus:border-blue-400 transition-all text-black dark:text-white"
                    value={selectedBookingId}
                    onChange={(e) => setSelectedBookingId(e.target.value)}
                  >
                    <option value="">{isAr ? '-- اختر حجز القادمين --' : '-- Choose Arrival Booking --'}</option>
                    {openBookings.map(op => (
                      <option key={op.id} value={op.id}>{op.bookingNumber} | {translateEntity(op.customerName, lang)}</option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-3">
                    <input 
                      placeholder={isAr ? 'رقم الحجز' : "BOOKING NUMBER"}
                      className="w-full p-4 bg-blue-50/30 border-2 border-blue-100 rounded-2xl text-sm font-black uppercase text-blue-700 outline-none focus:border-blue-500"
                      value={manualBooking.number}
                      onChange={e => setManualBooking({...manualBooking, number: e.target.value})}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                       <input list="customers" placeholder={isAr ? 'العميل' : "CUSTOMER"} className="p-3 bg-slate-50 border rounded-xl text-xs font-bold" value={manualBooking.customer} onChange={e => setManualBooking({...manualBooking, customer: e.target.value})} />
                       <input list="shippers" placeholder={isAr ? 'المشحن' : "SHIPPER"} className="p-3 bg-slate-50 border rounded-xl text-xs font-bold" value={manualBooking.shipper} onChange={e => setManualBooking({...manualBooking, shipper: e.target.value})} />
                       <input list="truckers" placeholder={isAr ? 'الناقل' : "TRUCKER"} className="p-3 bg-slate-50 border rounded-xl text-xs font-bold" value={manualBooking.trucker} onChange={e => setManualBooking({...manualBooking, trucker: e.target.value})} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className={`p-5 rounded-[2.5rem] shadow-sm border border-slate-100 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <StepCircle num={mode === 'DISPATCH' ? 2 : 1} active={selectedGensets.length > 0} />
                    <h2 className={`text-xs font-black uppercase ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {mode === 'DISPATCH' ? (isAr ? 'المعدة' : 'ASSET') : (isAr ? 'اختيار الوحدات' : 'SELECT UNITS')}
                    </h2>
                  </div>
                  <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                     <button onClick={() => { setMode('DISPATCH'); setSelectedGensets([]); }} className={`px-3 py-1.5 rounded-md text-[8px] font-black uppercase ${mode === 'DISPATCH' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400'}`}>
                       {isAr ? 'خروج' : 'DISPATCH'}
                     </button>
                     <button onClick={() => { setMode('PORT_MOVE'); setSelectedGensets([]); }} className={`px-3 py-1.5 rounded-md text-[8px] font-black uppercase ${mode === 'PORT_MOVE' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400'}`}>
                       {isAr ? 'نقل' : 'MOVE'}
                     </button>
                  </div>
               </div>

               {mode === 'DISPATCH' && (
                 <div className="grid grid-cols-2 gap-3 mb-6 text-start">
                    <input list="drivers" placeholder={isAr ? 'اسم السائق' : "DRIVER NAME"} className="p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black text-blue-900" value={manualBooking.driverName} onChange={e => setManualBooking({...manualBooking, driverName: e.target.value})} />
                    <input list="phones" placeholder={isAr ? 'رقم هاتف السائق' : "DRIVER PHONE"} className="p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black text-blue-900" value={manualBooking.driverPhone} onChange={e => setManualBooking({...manualBooking, driverPhone: e.target.value})} />
                 </div>
               )}

               <div className="grid grid-cols-2 xs:grid-cols-3 gap-3">
                 {availableGensets.map(unit => (
                   <button key={unit.id} onClick={() => toggleGensetSelection(unit.unitNumber)} className={`py-6 rounded-2xl border-2 font-black transition-all ${selectedGensets.includes(unit.unitNumber) ? 'bg-[#001F3F] border-[#C2A378] text-white shadow-xl scale-[1.02]' : (isDark ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-100 text-slate-700')}`}>
                     <span className="text-xs">{unit.unitNumber.split('-').pop()}</span>
                   </button>
                 ))}
                 {availableGensets.length === 0 && (
                   <div className="col-span-3 py-10 text-center text-slate-300 italic text-[10px] font-black uppercase">
                     {isAr ? 'المخزون فارغ حالياً' : 'Hub Inventory Empty'}
                   </div>
                 )}
               </div>
            </div>

            <div className={`p-5 rounded-[2.5rem] shadow-sm border border-slate-100 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
               <div className="flex items-center gap-3 mb-4">
                  <StepCircle num={mode === 'DISPATCH' ? 3 : 2} active={mode === 'PORT_MOVE' ? !!targetPort : !!scannedContainer} />
                  <h2 className={`text-xs font-black uppercase ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {mode === 'PORT_MOVE' ? (isAr ? 'الوجهة' : 'DESTINATION') : (isAr ? 'التعريف واللوجستيات' : 'ID & LOGISTICS')}
                  </h2>
               </div>

               {mode === 'PORT_MOVE' ? (
                 <div className="grid grid-cols-2 gap-3">
                   {Object.values(Location).filter(loc => loc !== selectedPort && loc !== Location.MAL).map(loc => (
                     <button key={loc} onClick={() => setTargetPort(loc)} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 ${targetPort === loc ? 'bg-[#001F3F] border-[#C2A378] text-white shadow-lg' : (isDark ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-700')}`}>
                        <span className="text-[10px] font-black uppercase tracking-widest">{translateEntity(loc, lang)}</span>
                     </button>
                   ))}
                 </div>
               ) : (
                 <div className="space-y-6">
                   <div className="grid grid-cols-2 gap-3">
                      <div className="text-start">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">{isAr ? 'الوقود (لتر)' : 'FUEL (L)'}</p>
                        <input 
                          type="number" 
                          className="w-full px-4 py-4 border-2 border-slate-100 dark:bg-slate-700 rounded-2xl text-xl font-black text-center bg-white text-blue-600 focus:border-[#C2A378] outline-none shadow-inner"
                          value={manualGaz}
                          onChange={(e) => setManualGaz(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => cameraInputRef.current?.click()} className="w-full h-full border-2 border-dashed border-blue-400 rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all bg-blue-50/50">
                           <span className="text-[14px]">🤖</span>
                           <span className="text-[8px] font-black text-blue-600 tracking-tighter uppercase">
                             {isScanning ? (isAr ? 'جاري...' : 'SCAN') : (isAr ? 'مسح' : 'SCAN')}
                           </span>
                        </button>
                        <button onClick={() => evidenceInputRef.current?.click()} className={`w-full h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all ${evidenceImage ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 bg-slate-50'}`}>
                           <span className="text-[14px]">{evidenceImage ? '✅' : '📸'}</span>
                           <span className={`text-[8px] font-black tracking-tighter uppercase ${evidenceImage ? 'text-emerald-600' : 'text-slate-400'}`}>
                             {evidenceImage ? (isAr ? 'تم' : 'DONE') : (isAr ? 'صورة' : 'PHOTO')}
                           </span>
                        </button>
                      </div>
                   </div>

                   <div className="space-y-2 text-start">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-4">{isAr ? 'رقم كود الحاوية BIC' : 'Container BIC Code'}</p>
                      <input 
                        className={`w-full px-6 py-5 border-2 rounded-2xl text-2xl font-black font-mono text-center uppercase focus:border-blue-400 bg-white text-black transition-all ${containerMatchedViaScan ? 'border-emerald-500 shadow-lg shadow-emerald-500/10' : 'border-slate-100 shadow-inner'}`} 
                        placeholder="AAAA0000000" 
                        value={scannedContainer} 
                        onChange={(e) => setScannedContainer(e.target.value.toUpperCase())} 
                      />
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {previewImage && (
                       <div className="w-full aspect-video relative rounded-[2rem] overflow-hidden border-4 border-slate-100 shadow-lg animate-in zoom-in-95">
                          <img src={previewImage} alt="OCR Preview" className="w-full h-full object-cover" />
                          {isScanning && (
                            <div className="absolute inset-0 bg-[#001F3F]/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                              <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin mb-2"></div>
                              <p className="text-[8px] font-black uppercase tracking-widest">{analysisStatus}</p>
                            </div>
                          )}
                          <button onClick={() => setPreviewImage(null)} className="absolute top-2 right-2 bg-black/60 text-white w-8 h-8 rounded-full font-black text-sm shadow-xl flex items-center justify-center backdrop-blur-md">×</button>
                          <div className="absolute bottom-2 left-2 bg-blue-600 text-white px-2 py-0.5 rounded text-[7px] font-black uppercase">AI SCAN</div>
                       </div>
                     )}

                     {evidenceImage && (
                       <div className="w-full aspect-video relative rounded-[2rem] overflow-hidden border-4 border-emerald-100 shadow-lg animate-in zoom-in-95">
                          <img src={evidenceImage} alt="Evidence Preview" className="w-full h-full object-cover" />
                          <button onClick={() => setEvidenceImage(null)} className="absolute top-2 right-2 bg-black/60 text-white w-8 h-8 rounded-full font-black text-sm shadow-xl flex items-center justify-center backdrop-blur-md">×</button>
                          <div className="absolute bottom-2 left-2 bg-emerald-600 text-white px-2 py-0.5 rounded text-[7px] font-black uppercase">EVIDENCE PHOTO</div>
                       </div>
                     )}
                   </div>
                 </div>
               )}
            </div>
          </div>
        )}

        {viewTab === 'TRANSIT' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-500">
             <div className="space-y-4">
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 flex items-center gap-2 px-2">
                 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                 {isAr ? 'وحدات قادمة للاستلام' : 'UNITS RETURNING / ARRIVING'}
               </h3>
               {terminalOps.arriving.map(op => {
                 const photo = extractPhoto(op.notes);
                 return (
                  <div key={op.id} className={`p-5 rounded-[2.5rem] border-2 transition-all hover:shadow-xl ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-emerald-100'}`}>
                    <div className="flex gap-5">
                      {photo ? (
                        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-100 shadow-sm shrink-0 cursor-pointer" onClick={() => setViewingPhoto(photo)}>
                           <img src={photo} className="w-full h-full object-cover" alt="Thumb" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-300 italic text-[7px] shrink-0 border border-slate-100">No Photo</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-black text-blue-600 text-xs tracking-tighter">#{op.bookingNumber}</span>
                          <span className="text-[8px] font-black text-slate-400 bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded uppercase">{op.clipOnDate}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-start">
                          <div className="flex flex-col"><p className="text-[7px] font-black text-slate-400 uppercase">Container</p><p className="text-[10px] font-mono font-black uppercase">{op.containerNumber || '---'}</p></div>
                          <div className="flex flex-col"><p className="text-[7px] font-black text-slate-400 uppercase">Genset</p><p className="text-[10px] font-black text-amber-600 italic">{op.gensetNumber}</p></div>
                          <div className="flex flex-col"><p className="text-[7px] font-black text-slate-400 uppercase">From</p><p className="text-[10px] font-bold uppercase truncate">{translateEntity(op.clipOnPort, lang)}</p></div>
                          <div className="flex flex-col"><p className="text-[7px] font-black text-slate-400 uppercase">Driver</p><p className="text-[10px] font-bold text-blue-600 truncate">{op.driverName || '---'}</p></div>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setClipOffCandidate(op)} className="mt-4 w-full py-3 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-md active:scale-95 transition-all">
                      {isAr ? 'تأكيد الوصول والاستلام' : 'CONFIRM ARRIVAL & RELEASE'}
                    </button>
                  </div>
                 );
               })}
               {terminalOps.arriving.length === 0 && (
                 <div className="py-6 text-center opacity-30 italic text-[9px] font-black uppercase border-2 border-dashed rounded-3xl">
                   {isAr ? 'لا توجد وحدات متجهة إلينا حالياً' : 'No incoming units tracked'}
                 </div>
               )}
             </div>

             <div className="space-y-4">
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 px-2">
                 <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                 {isAr ? 'وحدات غادرت المحطة' : 'UNITS DEPARTED / EN ROUTE'}
               </h3>
               {terminalOps.departing.map(op => {
                 const photo = extractPhoto(op.notes);
                 return (
                  <div key={op.id} className={`p-5 rounded-[2.5rem] border-2 transition-all hover:shadow-xl ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-blue-100'}`}>
                    <div className="flex gap-5">
                      {photo ? (
                        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-100 shadow-sm shrink-0 cursor-pointer" onClick={() => setViewingPhoto(photo)}>
                           <img src={photo} className="w-full h-full object-cover" alt="Thumb" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-300 italic text-[7px] shrink-0 border border-slate-100">No Photo</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-black text-blue-600 text-xs tracking-tighter">#{op.bookingNumber}</span>
                          <span className="text-[8px] font-black text-blue-500 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded uppercase">On Trip</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-start">
                          <div className="flex flex-col"><p className="text-[7px] font-black text-slate-400 uppercase">Container</p><p className="text-[10px] font-mono font-black uppercase">{op.containerNumber || '---'}</p></div>
                          <div className="flex flex-col"><p className="text-[7px] font-black text-slate-400 uppercase">Genset</p><p className="text-[10px] font-black text-amber-600 italic">{op.gensetNumber}</p></div>
                          <div className="flex flex-col"><p className="text-[7px] font-black text-slate-400 uppercase">Dest</p><p className="text-[10px] font-bold uppercase truncate">{translateEntity(op.clipOffPort, lang)}</p></div>
                          <div className="flex flex-col"><p className="text-[7px] font-black text-slate-400 uppercase">Driver</p><p className="text-[10px] font-bold text-blue-600 truncate">{op.driverName || '---'}</p></div>
                        </div>
                      </div>
                    </div>
                  </div>
                 );
               })}
               {terminalOps.departing.length === 0 && (
                 <div className="py-6 text-center opacity-30 italic text-[9px] font-black uppercase border-2 border-dashed rounded-3xl">
                   {isAr ? 'لا توجد وحدات نشطة خارجة' : 'No outgoing active units'}
                 </div>
               )}
             </div>
          </div>
        )}

        {viewTab === 'UPCOMING' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-500">
             <div className="flex justify-between items-center px-2 mb-2 flex-wrap gap-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C2A378] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#C2A378] animate-pulse"></span>
                  {isAr ? 'عمليات مجدولة قادمة' : 'UPCOMING SCHEDULED OPS'}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-black bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500">{terminalOps.upcoming.length} {isAr ? 'سجل' : 'LOADED'}</span>
                  <button 
                    type="button"
                    onClick={handleExportExcel}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider shadow flex items-center gap-1.5 transition-all"
                  >
                    <span>📊</span> {isAr ? 'تصدير جدولة القادمين إكسيل' : 'EXPORT NEXT SCHEDULE EXCEL'}
                  </button>
                </div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {terminalOps.upcoming.map(op => (
                 <div key={op.id} className={`p-6 rounded-[2.5rem] border-2 shadow-sm relative overflow-hidden group ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                    <div className="flex justify-between items-center mb-6">
                       <span className="font-black text-blue-600 text-sm tracking-tighter">#{op.bookingNumber}</span>
                       <div className="flex gap-2">
                          <span className="bg-slate-50 dark:bg-slate-950 text-slate-400 px-3 py-1 rounded-xl text-[8px] font-black uppercase tracking-widest">{op.operationDate}</span>
                          <span className="bg-amber-100 text-amber-600 px-3 py-1 rounded-xl text-[8px] font-black uppercase">Pending Gate</span>
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-[10px] mb-6 text-start">
                       <div className="flex flex-col"><p className="text-[7px] font-black text-slate-400 uppercase">Commercial Partner</p><p className="font-black text-xs uppercase truncate text-slate-900 dark:text-slate-200">{translateEntity(op.customerName, lang)}</p></div>
                       <div className="flex flex-col"><p className="text-[7px] font-black text-slate-400 uppercase">Operational Route</p><p className="font-bold text-xs text-slate-600">{translateEntity(op.clipOnPort, lang)} → {translateEntity(op.clipOffPort, lang)}</p></div>
                       <div className="flex flex-col"><p className="text-[7px] font-black text-slate-400 uppercase">{t.shipper}</p><p className="font-bold text-xs text-blue-600 truncate">{translateEntity(op.beneficiaryName, lang) || '---'}</p></div>
                       <div className="flex flex-col"><p className="text-[7px] font-black text-slate-400 uppercase">{t.trucker}</p><p className="font-bold text-xs text-slate-600 truncate">{translateEntity(op.trucker, lang) || '---'}</p></div>
                    </div>
                    <button 
                      onClick={() => { 
                        setViewTab('GATE'); 
                        setSelectedBookingId(op.id); 
                        setMode('DISPATCH'); 
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        addNotification(isAr ? 'تم تحميل بيانات الحجز في البوابة' : 'Booking loaded into Gate terminal');
                      }} 
                      className="w-full py-4 bg-[#001F3F] text-white rounded-2xl text-[9px] font-black uppercase tracking-[0.3em] shadow-xl hover:bg-blue-600 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                      {isAr ? 'بدء معالجة الخروج' : 'PROCESS DISPATCH NOW'}
                    </button>
                    {/* Background ID decoration */}
                    <div className="absolute top-[-20px] right-[-20px] text-5xl font-black italic opacity-[0.03] rotate-12 select-none group-hover:opacity-[0.05] transition-opacity">#{op.bookingNumber.split('-').pop()}</div>
                 </div>
               ))}
             </div>
             {terminalOps.upcoming.length === 0 && (
               <div className="py-32 text-center opacity-30 italic text-[9px] font-black uppercase border-2 border-dashed rounded-[3rem]">
                 No upcoming scheduled units for {translateEntity(selectedPort, lang)}
               </div>
             )}
          </div>
        )}
      </div>

      {viewTab === 'GATE' && (
        <div className="fixed bottom-24 left-4 right-4 z-[100] lg:relative lg:bottom-auto lg:left-auto lg:right-auto no-print">
           <button 
             disabled={selectedGensets.length === 0 || (mode === 'DISPATCH' && (!scannedContainer || (!selectedBookingId && !manualBooking.number))) || (mode === 'PORT_MOVE' && !targetPort)} 
             onClick={() => setShowDoubleConfirm(true)} 
             className="w-full py-6 rounded-[2.5rem] text-sm font-black uppercase tracking-[0.4em] shadow-[0_30px_60px_rgba(0,0,0,0.4)] transition-all active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 bg-blue-600 text-white animate-in slide-in-from-bottom-8 font-cairo"
           >
             {isAr ? 'اعتماد المزامنة والتشغيل' : 'AUTHORIZE SYNC'}
           </button>
        </div>
      )}

      {/* FULL PHOTO VIEWER MODAL */}
      {viewingPhoto && (
        <div className="fixed inset-0 bg-black/95 z-[1000] flex items-center justify-center p-4" onClick={() => setViewingPhoto(null)}>
           <div className="relative max-w-5xl w-full">
              <img src={viewingPhoto} className="w-full h-auto rounded-[2rem] shadow-2xl" alt="Large Evidence" />
              <button className="absolute -top-12 right-0 text-white text-sm font-black uppercase tracking-widest">✕ Close Evidence</button>
           </div>
        </div>
      )}

      <datalist id="customers">{suggestions.customers.map(s => <option key={s} value={s} />)}</datalist>
      <datalist id="shippers">{suggestions.shippers.map(s => <option key={s} value={s} />)}</datalist>
      <datalist id="truckers">{suggestions.truckers.map(s => <option key={s} value={s} />)}</datalist>
      <datalist id="drivers">{suggestions.drivers.map(s => <option key={s} value={s} />)}</datalist>
      <datalist id="phones">{suggestions.phones.map(s => <option key={s} value={s} />)}</datalist>

      <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
      <input type="file" ref={evidenceInputRef} className="hidden" accept="image/*" onChange={handleEvidenceUpload} />

      {clipOffCandidate && (
        <div className="fixed inset-0 bg-[#001F3F]/95 backdrop-blur-2xl z-[200] flex items-center justify-center p-6 font-cairo no-print">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-10 text-center space-y-6 animate-in zoom-in-95">
             <h3 className="text-2xl font-black text-[#001F3F] uppercase italic tracking-tighter text-start">
               {isAr ? 'تأكيد الاستلام' : 'COMMIT RETURN'}
             </h3>
             <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-100 text-start space-y-4">
                <div><p className="text-[10px] font-black text-slate-400 uppercase">{isAr ? 'سيريال الوحدة' : 'ASSET SERIAL'}</p><p className="font-black text-slate-900 text-xl italic">{clipOffCandidate.gensetNumber}</p></div>
                <div><p className="text-[10px] font-black text-slate-400 uppercase">{isAr ? 'السائق' : 'DRIVER'}</p><p className="font-bold text-blue-600">{clipOffCandidate.driverName || (isAr ? 'غير مسجل' : 'NOT LOGGED')}</p></div>
             </div>
             <button onClick={finalizeClipOff} className="w-full bg-rose-600 text-white py-6 rounded-2xl font-black uppercase text-xs tracking-[0.3em] shadow-xl">
               {isAr ? 'تصفير الرحلة وإتاحة المولد' : 'RELEASE TO STOCK'}
             </button>
             <button onClick={() => setClipOffCandidate(null)} className="w-full py-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">
               {isAr ? 'تجاهل' : 'ABORT'}
             </button>
          </div>
        </div>
      )}

      {showDoubleConfirm && (
        <div className="fixed inset-0 bg-[#001F3F]/95 backdrop-blur-2xl z-[200] flex items-center justify-center p-6 font-cairo no-print">
          <div className="bg-white rounded-3xl shadow-2xl max-sm w-full p-10 text-center space-y-8 animate-in zoom-in-95">
             <h3 className="text-2xl font-black text-[#001F3F] uppercase italic tracking-tighter text-start">
               {isAr ? 'مراجعة البيانات' : 'VERIFY SYNC'}
             </h3>
             <div className="bg-slate-50 p-8 rounded-2xl border-2 border-slate-100 space-y-5 text-start">
                <div className="flex justify-between items-center text-[10px]">
                   <span className="font-black text-slate-400 uppercase">{isAr ? 'رقم المرجع' : 'REF ID'}</span>
                   <span className="font-black text-blue-600 uppercase italic">{isManualBooking ? manualBooking.number : (isAr ? 'حجز موجود' : 'EXISTING BK')}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                   <span className="font-black text-slate-400 uppercase">{isAr ? 'رقم الحاوية' : 'CONT ID'}</span>
                   <span className="font-black text-slate-900 uppercase font-mono">{scannedContainer}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                   <span className="font-black text-slate-400 uppercase">{isAr ? 'وحدة المولد' : 'POWER UNIT'}</span>
                   <span className="font-black text-amber-600 uppercase italic">{selectedGensets[0]}</span>
                </div>
                <div className="p-4 bg-[#001F3F] text-white rounded-xl mt-4">
                   <p className="text-[10px] font-black uppercase tracking-widest text-[#C2A378]">Warning</p>
                   <p className="text-[9px] font-bold">This unit will be removed from stock and assigned to this container immediately.</p>
                </div>
             </div>
             <button onClick={handleProcessAction} className="w-full bg-[#001F3F] text-white py-7 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">
               {isAr ? 'اعتماد نهائي للنظام' : 'SYSTEM COMMIT'}
             </button>
             <button onClick={() => setShowDoubleConfirm(false)} className="w-full py-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">
               {isAr ? 'إلغاء' : 'CANCEL'}
             </button>
          </div>
        </div>
      )}

      <div className="fixed top-20 left-4 right-4 z-[300] pointer-events-none space-y-2 font-cairo no-print">
        {notifications.map(n => (
          <div key={n.id} className="bg-slate-900 text-white px-8 py-5 rounded-[2rem] shadow-2xl text-center text-[11px] font-black border border-white/10 animate-in slide-in-from-top-4 backdrop-blur-xl">
            {n.msg}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PortGateControl;
