import React, { useState, useContext, useMemo } from 'react';
import { db } from '../services/supabaseDb';
import { LanguageContext, ThemeContext } from '../App';
import { Location, Operation, Reservation, Invoice, UserRole } from '../types';
import InvoiceView from '../components/InvoiceView';

const BookingInvoices: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'black';
  const isAr = lang === 'ar';

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unbilled' | 'invoiced'>('all');
  const [submenuFilter, setSubmenuFilter] = useState<'ALL' | 'NEED_ISSUE' | 'PAST_DUE'>(() => (sessionStorage.getItem('invoicesTab') as any) || 'ALL');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  React.useEffect(() => {
    const handleSubmenuTab = (e: Event) => {
      const customEvent = e as CustomEvent<'ALL' | 'NEED_ISSUE' | 'PAST_DUE'>;
      if (customEvent.detail) {
        setSubmenuFilter(customEvent.detail);
        if (customEvent.detail === 'NEED_ISSUE') {
          setFilterStatus('unbilled');
        } else if (customEvent.detail === 'PAST_DUE') {
          // Keep filterStatus as all/invoiced so it shows existing bills
          setFilterStatus('all');
        } else {
          setFilterStatus('all');
        }
      }
    };
    window.addEventListener('invoices-tab-change', handleSubmenuTab);
    return () => {
      window.removeEventListener('invoices-tab-change', handleSubmenuTab);
    };
  }, []);

  // Edit Invoice States
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDate, setEditDate] = useState<string>('');
  const [editDueDate, setEditDueDate] = useState<string>('');
  const [editStatus, setEditStatus] = useState<'PAID' | 'UNPAID'>('UNPAID');
  const [editEtaStatus, setEditEtaStatus] = useState<'DRAFT' | 'SUBMITTED' | 'VALID' | 'INVALID'>('DRAFT');

  // Submit Submission loading states
  const [submittingInvoiceId, setSubmittingInvoiceId] = useState<string | null>(null);

  // Retrieve current data from DB
  const [allOps, setAllOps] = useState<Operation[]>(() => db.getOperations());
  const [allReservations, setAllReservations] = useState<Reservation[]>(() => db.getReservations());
  const [allInvoices, setAllInvoices] = useState<Invoice[]>(() => db.getInvoices());

  const refreshData = () => {
    setAllOps(db.getOperations());
    setAllReservations(db.getReservations());
    setAllInvoices(db.getInvoices());
  };

  const handleOpenEdit = (inv: Invoice) => {
    setEditingInvoice(inv);
    setEditAmount(inv.amount);
    setEditDate(inv.date);
    setEditDueDate(inv.dueDate || '');
    setEditStatus(inv.status);
    setEditEtaStatus(inv.etaStatus || 'DRAFT');
  };

  const handleSaveEdit = async () => {
    if (!editingInvoice) return;
    const saved = await db.updateInvoice(editingInvoice.id, {
      amount: editAmount,
      date: editDate,
      dueDate: editDueDate || undefined,
      status: editStatus,
      etaStatus: editEtaStatus
    });
    if (!saved) {
      alert(isAr ? `فشل حفظ الفاتورة: ${db.getLastDbError() || ''}` : `Invoice save failed: ${db.getLastDbError() || ''}`);
      return;
    }
    setEditingInvoice(null);
    refreshData();
  };

  const handleSubmitInvoice = async (invId: string) => {
    setSubmittingInvoiceId(invId);
    try {
      // Do not fabricate an ETA VALID response. Until the real ETA endpoint is connected,
      // the invoice can only be marked as submitted locally.
      const saved = await db.updateInvoice(invId, { etaStatus: 'SUBMITTED' });
      if (!saved) {
        alert(isAr ? `فشل إرسال الفاتورة: ${db.getLastDbError() || ''}` : `Invoice submission failed: ${db.getLastDbError() || ''}`);
        return;
      }
      refreshData();
    } finally {
      setSubmittingInvoiceId(null);
    }
  };

  // Group bookings by Booking Number
  const bookingsData = useMemo(() => {
    // Collect all booking numbers
    const bookingNumbersSet = new Set<string>();
    allOps.forEach(op => {
      if (op.bookingNumber) bookingNumbersSet.add(op.bookingNumber);
    });
    allReservations.forEach(res => {
      if (res.bookingNumber) bookingNumbersSet.add(res.bookingNumber);
    });

    return Array.from(bookingNumbersSet).map(bookingNumber => {
      const reservation = allReservations.find(r => r.bookingNumber === bookingNumber);
      const operations = allOps.filter(o => o.bookingNumber === bookingNumber);
      const invoices = allInvoices.filter(i => i.bookingNumber === bookingNumber);

      // Determine customer name
      const customerName = reservation?.customerName || operations[0]?.customerName || 'Nile Client';
      const portIn = reservation?.portIn || operations[0]?.clipOnPort || Location.DAM;
      const portOut = reservation?.portOut || operations[0]?.clipOffPort || Location.DAM;

      // Unbilled done operations count
      const unbilledDoneOps = operations.filter(o => o.status === 'DONE' && !o.invoiced);
      const isPendingBilling = unbilledDoneOps.length > 0;

      return {
        bookingNumber,
        customerName,
        portIn,
        portOut,
        reservation,
        operations,
        invoices,
        isPendingBilling,
        unbilledCount: unbilledDoneOps.length
      };
    });
  }, [allOps, allReservations, allInvoices]);

  // Filter and search bookings
  const filteredBookings = useMemo(() => {
    return bookingsData.filter(b => {
      const matchesSearch = (b.bookingNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.customerName || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      // Handle submenu shortcut filters first
      if (submenuFilter === 'NEED_ISSUE') {
        return b.isPendingBilling;
      }
      if (submenuFilter === 'PAST_DUE') {
        const today = new Date().toISOString().split('T')[0];
        return b.invoices.some(inv => inv.status === 'UNPAID' && inv.dueDate && inv.dueDate < today);
      }

      // Default status filters when ALL is clicked
      if (filterStatus === 'unbilled') {
        return b.isPendingBilling;
      }
      if (filterStatus === 'invoiced') {
        return b.invoices.length > 0;
      }
      return true;
    });
  }, [bookingsData, searchTerm, filterStatus, submenuFilter]);

  // Key stats
  const stats = useMemo(() => {
    const total = bookingsData.length;
    const pendingBillingCount = bookingsData.filter(b => b.isPendingBilling).length;
    const invoicedCount = bookingsData.filter(b => b.invoices.length > 0).length;
    const totalInvoicedVal = allInvoices.reduce((sum, inv) => sum + inv.amount, 0);

    return { total, pendingBillingCount, invoicedCount, totalInvoicedVal };
  }, [bookingsData, allInvoices]);

  const handleGenerateInvoice = async (bookingNumber: string, customerName: string) => {
    const freshInvoice = await db.generateInvoiceFromBooking(bookingNumber, customerName);
    if (freshInvoice) {
      alert(isAr 
        ? `تم إنشاء الفاتورة بنجاح رقم ${freshInvoice.id} بمبلغ ${freshInvoice.amount.toLocaleString()} ج.م.`
        : `Invoice ${freshInvoice.id} generated successfully for EGP ${freshInvoice.amount.toLocaleString()}`
      );
      refreshData();
    } else {
      alert(isAr
        ? 'حدث خطأ: تأكد من وجود عمليات مكتملة وغير مفوترة لهذا الحجز.'
        : 'Error: Make sure there are completed operations that have not been invoiced yet.'
      );
    }
  };

  // Get current branding settings for InvoiceView
  const currentUser = db.getUsers().find(u => u.role === UserRole.ADMIN) || db.getUsers()[0];
  const invoiceSettings = currentUser?.invoiceSettings;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#001F3F] text-white p-8 rounded-3xl relative overflow-hidden shadow-xl border border-[#C2A37833]">
        <div className="absolute right-0 top-0 opacity-10 font-black text-8xl pointer-events-none uppercase tracking-widest font-mono">
          BILLING
        </div>
        <div className="relative z-10 space-y-2">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-[#C2A378] text-[#001F3F] px-3 py-1 rounded-full">
            {isAr ? 'فوترة الحجوزات والشحنات' : 'BOOKINGS BILLING MANAGEMENT'}
          </span>
          <h2 className="text-3xl font-black tracking-tight">
            {isAr ? 'فواتير الحجوزات التشغيلية' : 'Invoices for Bookings'}
          </h2>
          <p className="text-xs text-slate-300 font-mono max-w-xl">
            {isAr 
              ? 'تتبع عمليات الحجوزات والشاحنات، واستعرض الفواتير الصادرة لكل شحنة بموجب رقم الحجز، وقم بإنشاء وتنزيل الفواتير بصيغة PDF.'
              : 'Directly track Booking numbers, map their operational cycles, generate official invoices for completed booking legs, and export professional PDF invoices.'
            }
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-6 rounded-2xl border-l-4 border-[#C2A378] flex items-center justify-between shadow-sm ${isDark ? 'bg-slate-900 border-white/5 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
          <div>
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
              {isAr ? 'إجمالي الحجوزات النشطة' : 'TOTAL BOOKINGS'}
            </p>
            <p className="text-2xl font-black mt-1 font-mono">{stats.total}</p>
          </div>
          <span className="text-3xl">📦</span>
        </div>

        <div className={`p-6 rounded-2xl border-l-4 border-amber-500 flex items-center justify-between shadow-sm ${isDark ? 'bg-slate-900 border-white/5 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
          <div>
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
              {isAr ? 'حجوزات بانتظار الفوترة' : 'PENDING BILLING'}
            </p>
            <p className="text-2xl font-black mt-1 font-mono text-amber-500">{stats.pendingBillingCount}</p>
          </div>
          <span className="text-3xl">⚡</span>
        </div>

        <div className={`p-6 rounded-2xl border-l-4 border-emerald-500 flex items-center justify-between shadow-sm ${isDark ? 'bg-slate-900 border-white/5 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
          <div>
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
              {isAr ? 'حجوزات مفوترة جزئياً أو كلياً' : 'INVOICED BOOKINGS'}
            </p>
            <p className="text-2xl font-black mt-1 font-mono text-emerald-500">{stats.invoicedCount}</p>
          </div>
          <span className="text-3xl">🧾</span>
        </div>

        <div className={`p-6 rounded-2xl border-l-4 border-blue-500 flex items-center justify-between shadow-sm ${isDark ? 'bg-slate-900 border-white/5 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
          <div>
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
              {isAr ? 'إجمالي المبالغ المفوترة' : 'TOTAL REVENUE INVOICED'}
            </p>
            <p className="text-2xl font-black mt-1 font-mono text-blue-500">
               EGP {stats.totalInvoicedVal.toLocaleString()}
            </p>
          </div>
          <span className="text-3xl">💰</span>
        </div>
      </div>

      {/* Control Filters */}
      <div className={`p-5 rounded-2xl shadow-sm border flex flex-col sm:flex-row gap-4 justify-between items-center ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100'}`}>
        <div className="relative w-full sm:max-w-md">
          <input
            type="text"
            className={`w-full px-4 py-2 text-sm rounded-xl font-medium border focus:outline-none transition-all ${isDark ? 'bg-slate-800 border-white/10 text-white focus:border-[#C2A378]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#001F3F]'}`}
            placeholder={isAr ? 'بحث برقم الحجز أو العميل...' : 'Search booking # or customer name...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto justify-end">
          {[
            { id: 'all' as const, label: isAr ? 'كل الحجوزات' : 'All Bookings' },
            { id: 'unbilled' as const, label: isAr ? 'بانتظار الفوترة' : 'Needs Invoicing' },
            { id: 'invoiced' as const, label: isAr ? 'المفوترة فقط' : 'Invoiced Only' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setFilterStatus(tab.id);
                setSubmenuFilter('ALL');
                sessionStorage.setItem('invoicesTab', 'ALL');
                window.dispatchEvent(new CustomEvent('invoices-tab-change', { detail: 'ALL' }));
              }}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                filterStatus === tab.id && submenuFilter === 'ALL'
                  ? 'bg-[#001F3F] text-white' 
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:opacity-80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {submenuFilter !== 'ALL' && (
        <div className={`p-4 rounded-xl border-2 flex items-center justify-between text-xs font-bold leading-none select-none ${
          submenuFilter === 'NEED_ISSUE' 
            ? 'border-amber-500 bg-amber-500/10 text-amber-500' 
            : 'border-rose-500 bg-rose-500/10 text-rose-500'
        }`}>
          <div className="flex items-center gap-2">
            <span>ℹ️</span>
            <span>
              {submenuFilter === 'NEED_ISSUE'
                ? (isAr ? 'تصفية نشطة: عرض الحجوزات التي تحتاج إصدار فواتيرها فقط' : 'Active Shortcut Filter: Showing Bookings needing invoices ONLY')
                : (isAr ? 'تصفية نشطة: عرض الفواتير التي تجاوزت تاريخ الاستحقاق ولم تسدد بعد' : 'Active Shortcut Filter: Showing Overdue & Unpaid Invoices ONLY')
              }
            </span>
          </div>
          <button 
            onClick={() => {
              setSubmenuFilter('ALL');
              setFilterStatus('all');
              sessionStorage.setItem('invoicesTab', 'ALL');
              window.dispatchEvent(new CustomEvent('invoices-tab-change', { detail: 'ALL' }));
            }} 
            className="px-2 py-1 rounded bg-black/10 hover:bg-black/20 text-[9px] font-black uppercase tracking-widest"
          >
            {isAr ? 'إعادة تعيين' : 'Reset Filter'}
          </button>
        </div>
      )}

      {/* Table & Cards of Bookings with Invoices */}
      <div className="space-y-4">
        {filteredBookings.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">
            <span className="text-5xl block mb-4">🔍</span>
            <p className="font-black uppercase tracking-widest text-slate-400 text-xs">
              {isAr ? 'لا توجد سجلات مطابقة للحجوزات' : 'No matching Booking records found'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {isAr ? 'حاول تغيير معايير البحث أو تصفية الحالة.' : 'Try adjusting your search terms or filter constraints.'}
            </p>
          </div>
        ) : (
          filteredBookings.map((booking) => (
            <div 
              key={booking.bookingNumber} 
              className={`p-6 rounded-2xl border transition-all ${isDark ? 'bg-slate-900 border-white/5 text-white' : 'bg-white border-slate-100 text-slate-900 hover:shadow-md'}`}
            >
              {/* Card Title & General Info */}
              <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black font-mono bg-[#001F3F] text-[#C2A378] px-3 py-1 rounded-lg">
                      {booking.bookingNumber}
                    </span>
                    {booking.isPendingBilling && (
                      <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider animate-pulse flex items-center gap-1">
                        <span>⚡</span> {isAr ? 'بحاجة لفوترة' : 'Needs Invoicing'}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                    <span className="font-bold text-[#001F3F] dark:text-[#C2A378]">{booking.customerName}</span>
                    <span className="opacity-40">•</span>
                    <span className="font-mono">{booking.portIn} ➡️ {booking.portOut}</span>
                    {booking.reservation && (
                      <>
                        <span className="opacity-40">•</span>
                        <span>{isAr ? 'تاريخ الحجز:' : 'Date:'} {booking.reservation.reservationDate}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Bulk actions / Invoice trigger for the booking */}
                <div className="flex items-center gap-2">
                  {booking.isPendingBilling ? (
                    <button
                      onClick={() => handleGenerateInvoice(booking.bookingNumber, booking.customerName)}
                      className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                    >
                      ⚡ {isAr ? 'إصدار الفاتورة الآن' : 'GENERATE INVOICE NOW'}
                    </button>
                  ) : (
                    <span className="text-[10px] font-black uppercase text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 rounded-xl border border-emerald-500/10 flex items-center gap-1.5">
                      ✓ {isAr ? 'جميع العمليات مفوترة' : 'FULLY BILL-INVOICED'}
                    </span>
                  )}
                </div>
              </div>

              {/* Sub-section grid: Operations & Invoices */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                {/* Operations column */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-[#C2A378]">
                    {isAr ? 'العمليات التشغيلية الصادرة' : 'Leg Operations'} ({booking.operations.length})
                  </h4>
                  {booking.operations.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">
                      {isAr ? 'لا توجد شحنات/عمليات مسجلة لهذا الحجز' : 'No operational legs recorded yet for this booking.'}
                    </p>
                  ) : (
                    <div className="overflow-hidden border border-slate-100 dark:border-white/5 rounded-xl text-xs font-mono font-black">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/40 text-[9px] font-black text-slate-400 uppercase">
                          <tr>
                            <th className="p-2">{isAr ? 'الحاوية/المولد' : 'UNIT / CONTAINER'}</th>
                            <th className="p-2">{isAr ? 'المسار' : 'ROUTE'}</th>
                            <th className="p-2 text-right">{isAr ? 'المبلغ' : 'RATE'}</th>
                            <th className="p-2 text-center">{isAr ? 'الفوترة' : 'INVOICED'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                          {booking.operations.map(op => (
                            <tr key={op.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                              <td className="p-2">
                                <span className="font-bold text-slate-700 dark:text-slate-300">{op.containerNumber || 'N/A'}</span>
                                <span className="block text-[9px] text-slate-400">{op.gensetNumber || 'No Genset'}</span>
                              </td>
                              <td className="p-2 text-slate-500 text-[10px]">
                                {op.clipOnPort} ➔ {op.clipOffPort}
                              </td>
                              <td className="p-2 text-right">
                                <span className="font-bold text-slate-900 dark:text-white">EGP {op.rate}</span>
                                <span className="block text-[9px] text-[#C2A378]">+VAT {op.vat}</span>
                              </td>
                              <td className="p-2 text-center">
                                {op.invoiced ? (
                                  <span className="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-full" title="Invoiced" />
                                ) : (
                                  <span className="inline-block w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" title="Needs Invoice" />
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Invoices column */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-[#C2A378]">
                    {isAr ? 'الفواتير الضريبية المصدرة' : 'Issued Billing Invoices'} ({booking.invoices.length})
                  </h4>
                  {booking.invoices.length === 0 ? (
                    <div className="text-center py-6 bg-slate-50/40 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-white/5 flex flex-col items-center justify-center">
                      <span className="text-xl">📭</span>
                      <p className="text-[9px] font-black uppercase text-slate-400 mt-1">
                        {isAr ? 'لا توجد فواتير مصدرة حالياً' : 'No invoices generated yet'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {booking.invoices.map(inv => (
                        <div 
                          key={inv.id} 
                          className={`p-4 rounded-xl border flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between text-xs font-mono transition-all hover:border-[#C2A378] ${isDark ? 'bg-slate-800/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}
                        >
                          <div className="space-y-1">
                            <span className="font-black text-blue-600 dark:text-blue-400 text-[10px] hover:underline cursor-pointer flex items-center gap-1.5" onClick={() => setSelectedInvoice(inv)}>
                              <span>🧾</span> #{inv.id.split('-').pop()}
                            </span>
                            <span className="block text-[9px] text-slate-400">📅 {inv.date}</span>
                            {inv.etaInternalId && (
                              <span className="block text-[8px] text-emerald-500 font-bold">Ref: {inv.etaInternalId}</span>
                            )}
                          </div>

                          <div className="text-left sm:text-center">
                            <span className="font-black text-slate-900 dark:text-white block text-sm">
                              EGP {inv.amount.toLocaleString()}
                            </span>
                            <span className={`inline-block text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/20 dark:text-rose-400'}`}>
                              {inv.status === 'PAID' ? (isAr ? 'مدفوعة' : 'PAID') : (isAr ? 'غير مدفوعة' : 'UNPAID')}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                            {inv.etaStatus && (
                              <span className={`text-[8px] px-1.5 py-1 rounded font-black uppercase tracking-wider leading-none ${
                                inv.etaStatus === 'VALID' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                                inv.etaStatus === 'SUBMITTED' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                                'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              }`} title="ETA Official Status">
                                {inv.etaStatus}
                              </span>
                            )}
                            
                            <button
                              onClick={() => setSelectedInvoice(inv)}
                              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-[9px] uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm active:scale-95"
                              title={isAr ? 'عرض وتنزيل كـ PDF' : 'View and export as PDF'}
                            >
                              <span>👁️</span> {isAr ? 'عرض / PDF' : 'View / PDF'}
                            </button>

                            <button
                              onClick={() => handleOpenEdit(inv)}
                              className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-[9px] uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm active:scale-95"
                              title={isAr ? 'تعديل الفاتورة' : 'Edit invoice details'}
                            >
                              <span>✏️</span> {isAr ? 'تعديل' : 'Edit'}
                            </button>

                            {(!inv.etaStatus || inv.etaStatus === 'DRAFT' || inv.etaStatus === 'INVALID') ? (
                              <button
                                onClick={() => handleSubmitInvoice(inv.id)}
                                disabled={submittingInvoiceId === inv.id}
                                className={`px-2.5 py-1.5 rounded-lg font-bold text-[9px] uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm active:scale-95 ${
                                  submittingInvoiceId === inv.id 
                                    ? 'bg-slate-300 text-slate-100 cursor-not-allowed dark:bg-slate-800' 
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                }`}
                                title={isAr ? 'تقديم الفاتورة للبوابة الضريبية' : 'Submit invoice to electronic portal'}
                              >
                                {submittingInvoiceId === inv.id ? (
                                  <span className="flex items-center gap-1 animate-pulse">
                                    <span>⌛</span> {isAr ? 'جاري تقديم...' : 'Submitting...'}
                                  </span>
                                ) : (
                                  <>
                                    <span>🚀</span> {isAr ? 'تقديم' : 'Submit'}
                                  </>
                                )}
                              </button>
                            ) : (
                              <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded border border-emerald-500/20 flex items-center gap-1">
                                <span>🚀</span> {isAr ? 'تم الإرسال' : 'SUBMITTED'}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Viewing details / Printable layout of selected invoice */}
      {selectedInvoice && (
        <InvoiceView 
          invoice={selectedInvoice} 
          onClose={() => setSelectedInvoice(null)} 
          settings={invoiceSettings} 
        />
      )}

      {/* Editing Invoice Modal */}
      {editingInvoice && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[900] flex items-center justify-center p-4 overflow-y-auto">
          <div className={`rounded-3xl shadow-2xl max-w-md w-full p-8 border border-white/10 animate-in zoom-in-95 ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
            <div className="flex justify-between items-center mb-6">
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#C2A378]">
                  {isAr ? 'منظومة إدارة الفواتير' : 'INVOICE EDIT SYSTEM'}
                </span>
                <h3 className="text-xl font-black italic uppercase tracking-tighter">
                  {isAr ? 'تعديل الفاتورة الضريبية' : 'Edit Tax Invoice'}
                </h3>
              </div>
              <button 
                onClick={() => setEditingInvoice(null)} 
                className="text-slate-400 hover:text-rose-500 text-xl font-black p-1 transition-colors"
                title={isAr ? 'إغلاق' : 'Close'}
              >
                ✕
              </button>
            </div>

            <div className="space-y-5 text-left font-sans">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
                  {isAr ? 'رقم مرجع الفاتورة' : 'Invoice Reference'}
                </label>
                <input 
                  type="text" 
                  disabled
                  value={editingInvoice.id} 
                  className={`w-full px-4 py-3 rounded-xl border-2 text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed`}
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
                  {isAr ? 'تاريخ الإصدار' : 'Issue Date'}
                </label>
                <input 
                  type="date" 
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border-2 text-xs font-bold focus:outline-none focus:border-[#C2A378] ${
                    isDark ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
                  {isAr ? 'تاريخ الاستحقاق' : 'Due Date'}
                </label>
                <input 
                  type="date" 
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border-2 text-xs font-bold focus:outline-none focus:border-[#C2A378] ${
                    isDark ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
                  {isAr ? 'إجمالي مبلغ الفاتورة (EGP)' : 'Invoice Grand Total (EGP)'}
                </label>
                <input 
                  type="number" 
                  value={editAmount}
                  onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                  className={`w-full px-4 py-3 rounded-xl border-2 text-xs font-mono font-bold focus:outline-none focus:border-[#C2A378] ${
                    isDark ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
                  {isAr ? 'حالة الدفع والتحصيل' : 'Settlement Status'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => setEditStatus('PAID')}
                    className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 ${
                      editStatus === 'PAID' 
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' 
                        : (isDark ? 'border-white/5 bg-slate-800 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-500')
                    }`}
                  >
                    🟢 {isAr ? 'مدفوعة' : 'PAID'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setEditStatus('UNPAID')}
                    className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 ${
                      editStatus === 'UNPAID' 
                        ? 'border-rose-500 bg-rose-500/10 text-rose-500' 
                        : (isDark ? 'border-white/5 bg-slate-800 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-500')
                    }`}
                  >
                    🔴 {isAr ? 'غير مدفوعة' : 'UNPAID'}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
                  {isAr ? 'حالة البوابة الإلكترونية (ETA Status)' : 'Portal Status (ETA Sync)'}
                </label>
                <select 
                  value={editEtaStatus}
                  onChange={(e) => setEditEtaStatus(e.target.value as any)}
                  className={`w-full px-4 py-3 rounded-xl border-2 text-xs font-black uppercase focus:outline-none focus:border-[#C2A378] ${
                    isDark ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="SUBMITTED">SUBMITTED</option>
                  <option value="VALID">VALID</option>
                  <option value="INVALID">INVALID</option>
                </select>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-150 dark:border-white/5">
                <button 
                  onClick={() => setEditingInvoice(null)}
                  className="flex-1 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-colors"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button 
                  onClick={handleSaveEdit}
                  className="flex-[2] bg-[#001F3F] text-white hover:bg-slate-850 dark:bg-[#C2A378] dark:text-[#001F3F] py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  💾 {isAr ? 'تحويل وحفظ' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingInvoices;
