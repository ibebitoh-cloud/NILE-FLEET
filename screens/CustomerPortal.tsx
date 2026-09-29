
import React, { useState, useMemo, useContext } from 'react';
import { User, Reservation, Invoice, Location, ReservationStatus } from '../types';
import { db } from '../services/supabaseDb';
import InvoiceView from '../components/InvoiceView';
import { ProLedger } from './Financials';
import { LanguageContext } from '../App';
import { translateEntity } from '../translations';

interface CustomerPortalProps {
  user: User;
  type: 'reservations' | 'invoices';
}

const CustomerPortal: React.FC<CustomerPortalProps> = ({ user, type }) => {
  const { lang } = useContext(LanguageContext);
  const isAr = lang === 'ar';
  const [isBooking, setIsBooking] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [showSoa, setShowSoa] = useState(false);
  const [formData, setFormData] = useState({
    bookingNumber: '',
    gensetsNeeded: 1,
    portIn: Location.DAM,
    portOut: Location.ALEX,
    date: new Date().toISOString().split('T')[0],
    shipper: '',
    trucker: ''
  });

  const handleExportAllDataAndFinance = () => {
    const custOps = db.getCustomerOperations(user.id, user.companyName || user.name);
    const custInvoices = db.getInvoices().filter(i => i.customerId === user.id);
    const custPayments = db.getPayments().filter(p => p.customerId === user.id);
    const custPrices = db.getCustomerPrices().filter(p => p.customerName === (user.companyName || user.name));
    
    const unbilled = custOps.filter(o => !o.invoiced && o.status === 'DONE').reduce((s, o) => s + parseFloat(o.rate) + parseFloat(o.vat), 0);
    const unpaidInv = custInvoices.filter(i => i.status === 'UNPAID').reduce((s, i) => s + i.amount, 0);
    const exposure = (user.pastOutstandingAmount || 0) + unpaidInv + unbilled;

    const csvLines = [];
    csvLines.push("=== NILE FLEET COMMERCIAL PORTAL CLIENT DOSSIER ===");
    csvLines.push(`Client Entity Name,${user.companyName || user.name}`);
    csvLines.push(`System UID,${user.id}`);
    csvLines.push(`Primary Email,${user.email || ''}`);
    csvLines.push(`Taxpayer ID,${user.taxpayerId || 'N/A'}`);
    csvLines.push(`Exported Time,${new Date().toLocaleString()}`);
    csvLines.push("");
    
    csvLines.push("=== ACCOUNT BALANCE MATRIX ===");
    csvLines.push(`Historical Debts Forward,EGP ${(user.pastOutstandingAmount || 0).toFixed(2)}`);
    csvLines.push(`Live Unbilled Operations,EGP ${unbilled.toFixed(2)}`);
    csvLines.push(`Outstanding Invoiced Amount,EGP ${unpaidInv.toFixed(2)}`);
    csvLines.push(`Total Financial Exposure,EGP ${exposure.toFixed(2)}`);
    csvLines.push("");

    csvLines.push("=== COMMERCIAL RATES (PORT-TO-PORT TARIFF MATRIX) ===");
    csvLines.push("Port In,Port Out,Price (EGP),Includes VAT");
    if (custPrices.length === 0) {
      csvLines.push("No custom rates defined (Standard Tariff applies)");
    } else {
      custPrices.forEach(p => {
        csvLines.push(`${p.portIn},${p.portOut},${p.price.toFixed(2)},${p.includeVat ? 'YES' : 'NO'}`);
      });
    }
    csvLines.push("");

    csvLines.push("=== BOOKING & RESERVATION REGISTRY ===");
    csvLines.push("Reservation ID,Booking Number,Gensets Needed,Port In,Port Out,Date,Status");
    const myReservations = db.getReservations().filter(r => r.customerId === user.id);
    if (myReservations.length === 0) {
      csvLines.push("No reservations found");
    } else {
      myReservations.forEach(r => {
        csvLines.push(`${r.id},${r.bookingNumber},${r.gensetsNeeded},${r.portIn},${r.portOut},${r.reservationDate},${r.status}`);
      });
    }
    csvLines.push("");

    csvLines.push("=== HISTORICAL CONTAINER OPERATIONS ===");
    csvLines.push("ID,Booking #,Container ID,Genset ID,Date,Route,Rate (EGP),VAT (EGP),Status,Invoiced");
    if (custOps.length === 0) {
      csvLines.push("No operational records");
    } else {
      custOps.forEach(op => {
        csvLines.push(`${op.id},${op.bookingNumber},${op.containerNumber || 'N/A'},${op.gensetNumber || 'N/A'},${op.operationDate},${op.clipOnPort}->${op.clipOffPort},${op.rate},${op.vat},${op.status},${op.invoiced ? 'YES' : 'NO'}`);
      });
    }
    csvLines.push("");

    csvLines.push("=== ISSUED BILLING INVOICES ===");
    csvLines.push("Invoice ID,Booking #,Date,Total Amount (EGP),Status");
    if (custInvoices.length === 0) {
      csvLines.push("No billing invoices found");
    } else {
      custInvoices.forEach(inv => {
        csvLines.push(`${inv.id.split('-').pop()},${inv.bookingNumber},${inv.date},${inv.amount.toFixed(2)},${inv.status}`);
      });
    }
    csvLines.push("");

    csvLines.push("=== TRANSACTION & SETTLEMENT PAYMENTS ===");
    csvLines.push("Payment ID,Date,Reference,Amount (EGP),Type");
    if (custPayments.length === 0) {
      csvLines.push("No payments received");
    } else {
      custPayments.forEach(pay => {
        csvLines.push(`PAY-${pay.id.split('-').pop()},${pay.date},${pay.reference},${pay.amount.toFixed(2)},${pay.type}`);
      });
    }

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `PORT_PORTAL_COMMERCIAL_EXPORT_${(user.companyName || user.name).replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter out MAL for commercial portal selection
  const commercialPorts = Object.values(Location).filter(l => l !== Location.MAL);

  const myReservations = db.getReservations().filter(r => r.customerId === user.id);
  const myInvoices = db.getInvoices().filter(i => i.customerId === user.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.bookingNumber.trim() || !Number.isFinite(formData.gensetsNeeded) || formData.gensetsNeeded < 1 || formData.gensetsNeeded > 100) {
      alert(isAr ? 'أدخل رقم حجز صحيحاً وعدداً من ١ إلى ١٠٠ مولد.' : 'Please enter a valid booking number and 1–100 gensets.');
      return;
    }
    const newRes: Reservation = {
      id: `res-${Date.now()}`,
      customerId: user.id,
      customerName: user.companyName || user.name,
      bookingNumber: formData.bookingNumber,
      gensetsNeeded: Number(formData.gensetsNeeded),
      portIn: formData.portIn,
      portOut: formData.portOut,
      reservationDate: formData.date,
      status: ReservationStatus.PENDING,
      shipper: formData.shipper,
      trucker: formData.trucker
    };
    const before = db.getReservations().length;
    await db.addReservation(newRes);
    const saved = db.getReservations().length > before;
    if (!saved) {
      alert(isAr ? 'تعذر حفظ الحجز. حاول مرة أخرى.' : 'Reservation could not be saved. Please try again.');
      return;
    }
    setIsBooking(false);
    alert(isAr ? 'تم إرسال طلب الحجز بنجاح. سيراجعه فريقنا ويعتمده قريباً.' : 'Reservation requested successfully! Our team will review and approve it shortly.');
  };

  if (type === 'reservations') {
    return (
      <div className={`space-y-6 text-start ${isAr ? 'rtl font-cairo' : 'ltr'}`}>
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">{isAr ? 'حجوزاتك' : 'Your Bookings'}</h3>
          <button 
            onClick={() => setIsBooking(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
          >
            + {isAr ? 'إنشاء حجز جديد' : 'Create New Reservation'}
          </button>
        </div>

        {isBooking && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden">
              <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
                <h4 className="text-lg font-bold">{isAr ? 'حجز جديد عبر الإنترنت' : 'New Online Reservation'}</h4>
                <button onClick={() => setIsBooking(false)} className="text-white hover:text-blue-100">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{isAr ? 'رقم الحجز' : 'Booking Number'}</label>
                  <input required className="w-full px-4 py-2 border rounded-lg" placeholder={isAr ? 'مثال: MAEU123456' : 'EX: MAEU123456'} onChange={e => setFormData({...formData, bookingNumber: e.target.value})} />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{isAr ? 'عدد المولدات المطلوبة' : 'Gensets Needed'}</label>
                  <input type="number" min="1" max="100" required className="w-full px-4 py-2 border rounded-lg" value={formData.gensetsNeeded} onChange={e => setFormData({...formData, gensetsNeeded: parseInt(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{isAr ? 'ميناء الوصول' : 'Port In'}</label>
                  <select className="w-full px-4 py-2 border rounded-lg" onChange={e => setFormData({...formData, portIn: e.target.value as any})}>
                    {commercialPorts.map(l => <option key={l} value={l}>{translateEntity(l, lang)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{isAr ? 'ميناء المغادرة' : 'Port Out'}</label>
                  <select className="w-full px-4 py-2 border rounded-lg" onChange={e => setFormData({...formData, portOut: e.target.value as any})}>
                    {commercialPorts.map(l => <option key={l} value={l}>{translateEntity(l, lang)}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{isAr ? 'تاريخ الحجز' : 'Reservation Date'}</label>
                  <input type="date" required className="w-full px-4 py-2 border rounded-lg" onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <button type="submit" className="col-span-2 bg-blue-600 text-white py-3 rounded-xl font-bold mt-4 hover:bg-blue-700 shadow-lg">{isAr ? 'تأكيد الحجز' : 'Confirm Reservation'}</button>
              </form>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {myReservations.map(res => (
            <div key={res.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 transition-all">
              <div className="flex justify-between items-start mb-4">
                <span className="text-sm font-mono font-bold text-blue-600">{res.bookingNumber}</span>
                <span className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase ${
                  res.status === ReservationStatus.PENDING ? 'bg-amber-50 text-amber-500' :
                  res.status === ReservationStatus.APPROVED ? 'bg-green-50 text-green-500' : 'bg-slate-50 text-slate-400'
                }`}>
                  {translateEntity(res.status, lang)}
                </span>
              </div>
              <div className="flex items-center space-x-4 mb-3">
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 uppercase">{isAr ? 'الوحدات' : 'UNITS'}</p>
                  <p className="font-bold text-lg">{res.gensetsNeeded}</p>
                </div>
                <div className="flex-1 px-4 border-l">
                  <p className="text-[10px] text-slate-400 uppercase">{isAr ? 'المسار' : 'ROUTE'}</p>
                  <p className="font-bold text-slate-700">{translateEntity(res.portIn, lang)} → {translateEntity(res.portOut, lang)}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">{isAr ? 'محجوز بتاريخ:' : 'Reserved for:'} <span className="font-medium">{res.reservationDate}</span></p>
            </div>
          ))}
          {myReservations.length === 0 && (
            <div className="col-span-2 py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
              <p>{isAr ? 'لا توجد حجوزات نشطة.' : 'No active reservations.'}</p>
              <button onClick={() => setIsBooking(true)} className="text-blue-500 font-bold hover:underline mt-2">{isAr ? 'ابدأ أول حجز لك ←' : 'Start your first booking →'}</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 text-start ${isAr ? 'rtl font-cairo' : 'ltr'}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-xl font-bold text-slate-800">{isAr ? 'كشوفك المالية' : 'Your Financial Statements'}</h3>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setShowSoa(true)}
            className="flex items-center gap-1.5 bg-[#001F3F] hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
          >
            📋 {isAr ? 'كشف الحساب' : 'Statement of Account (SOA)'}
          </button>
          <button 
            onClick={handleExportAllDataAndFinance}
            className="flex items-center gap-1.5 bg-[#C2A378] hover:bg-[#b09268] text-[#001F3F] px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
          >
            📥 {isAr ? 'تصدير البيانات والمالية (CSV)' : 'Export Data & Finance (CSV)'}
          </button>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-4">{isAr ? 'رقم الفاتورة' : 'Invoice #'}</th>
              <th className="px-6 py-4">{isAr ? 'رقم الحجز' : 'Booking #'}</th>
              <th className="px-6 py-4">{isAr ? 'التاريخ' : 'Date'}</th>
              <th className="px-6 py-4">{isAr ? 'المبلغ' : 'Amount'}</th>
              <th className="px-6 py-4">{isAr ? 'الحالة' : 'Status'}</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {myInvoices.map(inv => (
              <tr key={inv.id}>
                <td className="px-6 py-4 font-bold">{inv.id.split('-').pop()}</td>
                <td className="px-6 py-4 font-mono text-sm">{inv.bookingNumber}</td>
                <td className="px-6 py-4 text-sm">{inv.date}</td>
                <td className="px-6 py-4 font-bold text-slate-900">EGP {inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                    inv.status === 'PAID' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {translateEntity(inv.status, lang)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => setViewingInvoice(inv)}
                    className="text-blue-600 text-xs font-black uppercase hover:underline"
                  >
                    {isAr ? 'عرض وطباعة' : 'View & Print'}
                  </button>
                </td>
              </tr>
            ))}
            {myInvoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">{isAr ? 'لم تصدر فواتير لحسابك حتى الآن.' : 'No invoices issued to your account yet.'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {viewingInvoice && (
        <InvoiceView 
          invoice={viewingInvoice} 
          onClose={() => setViewingInvoice(null)} 
          settings={user.invoiceSettings}
        />
      )}

      {showSoa && (
        <ProLedger 
          partner={user} 
          onClose={() => setShowSoa(false)} 
          branding={user.invoiceSettings} 
        />
      )}
    </div>
  );
};

export default CustomerPortal;
