
import React, { useState, useContext } from 'react';
import { db } from '../services/supabaseDb';
import { Reservation, ReservationStatus } from '../types';
import { LanguageContext } from '../App';
import { translations, translateEntity } from '../translations';

const Reservations: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const t = translations[lang];
  const [reservations, setReservations] = useState<Reservation[]>(db.getReservations());

  const handleStatusChange = async (id: string, status: ReservationStatus) => {
    await db.updateReservationStatus(id, status);
    setReservations([...db.getReservations()]);
  };

  const approveAndRelease = async (res: Reservation) => {
    const saved = await db.createOperationFromReservation(res);
    setReservations([...db.getReservations()]);
    if (!saved) {
      alert(lang === 'ar' ? `فشل اعتماد الحجز: ${db.getLastDbError() || 'تعذر حفظ بيانات التشغيل.'}` : `Approval failed: ${db.getLastDbError() || 'The operation could not be saved.'}`);
      return;
    }
    alert(lang === 'ar' ? 'تمت الموافقة! الحجز الآن متاح لبوابة الميناء.' : 'Approved! Reservation is now visible in Port Gate queue.');
  };

  const cancelReservation = async (res: Reservation) => {
    if (!window.confirm(lang === 'ar' ? `إلغاء الحجز ${res.bookingNumber}؟` : `Cancel booking ${res.bookingNumber}?`)) return;
    await handleStatusChange(res.id, ReservationStatus.CANCELLED);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-start pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h3 className="text-3xl font-black text-[#001F3F] uppercase tracking-tighter italic">{t.reservations}</h3>
           <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Review and dispatch customer rental requests</p>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
          <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Incoming Requests Queue</h4>
          <span className="bg-[#001F3F] text-[#C2A378] px-4 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest">{reservations.length} {t.records}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-[#001F3F] text-white font-black uppercase tracking-widest">
              <tr>
                <th className="px-8 py-5">Booking #</th>
                <th className="px-8 py-5">Partner</th>
                <th className="px-8 py-5 text-center">Units Required</th>
                <th className="px-8 py-5">Route Terminal</th>
                <th className="px-8 py-5">Target Date</th>
                <th className="px-8 py-5">Workflow Status</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reservations.map(res => (
                <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-6 font-mono font-black text-blue-600 text-sm">{res.bookingNumber}</td>
                  <td className="px-8 py-6">
                     <p className="font-black text-slate-800 uppercase leading-none">{translateEntity(res.customerName, lang)}</p>
                     <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Portal User ID: {res.customerId.split('-').pop()}</p>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-2xl font-black text-xs border border-blue-100">
                      {res.gensetsNeeded} Units
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 font-black text-[10px] text-slate-500">
                       <span className="px-2 py-0.5 bg-slate-100 rounded uppercase">{res.portIn}</span>
                       <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                       <span className="px-2 py-0.5 bg-slate-100 rounded uppercase">{res.portOut}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 font-bold text-slate-600 italic">{res.reservationDate}</td>
                  <td className="px-8 py-6">
                    <span className={`px-4 py-1.5 text-[9px] font-black rounded-xl uppercase tracking-widest border shadow-sm ${
                      res.status === ReservationStatus.PENDING ? 'bg-amber-50 text-amber-600 border-amber-100' :
                      res.status === ReservationStatus.APPROVED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      res.status === ReservationStatus.COMPLETED ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'
                    }`}>
                      {res.status}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right space-x-2">
                    {res.status === ReservationStatus.PENDING && (
                      <button 
                        onClick={() => approveAndRelease(res)}
                        className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 shadow-lg active:scale-95 transition-all"
                      >
                        {lang === 'ar' ? 'اعتماد ونشر' : 'Approve & Release'}
                      </button>
                    )}
                    {res.status === ReservationStatus.APPROVED && (
                      <span className="text-[9px] font-black text-slate-400 uppercase italic">In Gate Queue</span>
                    )}
                    <button onClick={() => cancelReservation(res)} title={lang === 'ar' ? 'إلغاء الحجز' : 'Cancel reservation'} className="p-2 text-slate-300 hover:text-rose-600 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
              {reservations.length === 0 && (
                <tr>
                   <td colSpan={7} className="py-20 text-center italic opacity-30 font-black uppercase tracking-[0.5em] text-xs">No Pending Requests</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="p-10 bg-[#001F3F] rounded-[3rem] text-white flex flex-col md:flex-row items-center gap-10 relative overflow-hidden shadow-2xl">
         <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
         <div className="w-20 h-20 bg-[#C2A378] rounded-[2rem] flex items-center justify-center text-4xl shadow-xl shrink-0">🛡️</div>
         <div className="flex-1 text-center md:text-left">
            <h4 className="text-xl font-black uppercase tracking-tighter italic text-[#C2A378]">Operational Protocol</h4>
            <p className="text-xs text-slate-300 font-medium leading-relaxed mt-2 max-w-2xl">When a reservation is approved, the system generates a shell work order in the **Under Operate** state. This allows your Gate Operators to physically scan the container and pick a genset when the truck arrives, ensuring maximum accuracy on the ground.</p>
         </div>
      </div>
    </div>
  );
};

export default Reservations;
