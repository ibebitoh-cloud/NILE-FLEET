
import React, { useState, useMemo, useContext, useEffect } from 'react';
import { db } from '../services/supabaseDb';
import { UserRole, User, Operation, Invoice, CustomerPrice, Location, hasReadOnlyAccess } from '../types';
import { LanguageContext, ThemeContext } from '../App';
import { translations, translateEntity } from '../translations';
import { PORT_STYLING } from '../constants';

const CustomerDossier: React.FC<{ 
  customer: User; 
  onClose: () => void; 
  onRefresh: () => void;
  isReadOnly: boolean;
}> = ({ customer, onClose, onRefresh, isReadOnly }) => {
  const { lang } = useContext(LanguageContext);
  const { theme } = useContext(ThemeContext);
  // Fix: Derive isDark by checking for 'black' theme mode
  const isDark = theme === 'black';
  const t = translations[lang];

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'OPS' | 'LEDGER' | 'MATRIX'>('OVERVIEW');
  const [profile, setProfile] = useState<Partial<User>>({ ...customer });
  
  // Data Fetches
  const customerOps = useMemo(() => 
    db.getOperations().filter(o => o.customerName === (customer.companyName || customer.name))
  , [customer]);

  const customerInvoices = useMemo(() => 
    db.getInvoices().filter(i => i.customerName === (customer.companyName || customer.name))
  , [customer]);

  const customerPayments = useMemo(() => 
    db.getPayments().filter(p => p.customerId === customer.id)
  , [customer]);

  const customerPrices = useMemo(() => 
    db.getCustomerPrices().filter(p => p.customerName === (customer.companyName || customer.name))
  , [customer]);

  const stats = useMemo(() => {
    const unbilled = customerOps.filter(o => !o.invoiced && o.status === 'DONE').reduce((s, o) => s + parseFloat(o.rate) + parseFloat(o.vat), 0);
    const unpaidInv = customerInvoices.filter(i => i.status === 'UNPAID').reduce((s, i) => s + i.amount, 0);
    const exposure = (customer.pastOutstandingAmount || 0) + unpaidInv + unbilled;
    const active = customerOps.filter(o => o.status === 'IN PROGRESS').length;
    return { exposure, unbilled, unpaidInv, active };
  }, [customer, customerOps, customerInvoices]);

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    db.updateUser(customer.id, profile);
    onRefresh();
    alert(lang === 'ar' ? 'تم تحديث الملف الشخصي' : 'Profile Synchronized');
  };

  const handleExportAllDataAndFinance = () => {
    const csvLines = [];
    csvLines.push("=== NILE FLEET PORTFOLIO COMMAND CLIENT DOSSIER ===");
    csvLines.push(`Client Entity Name,${customer.companyName || customer.name}`);
    csvLines.push(`System UID,${customer.id}`);
    csvLines.push(`Primary Email,${customer.email || ''}`);
    csvLines.push(`Taxpayer ID,${customer.taxpayerId || 'N/A'}`);
    csvLines.push(`Exported Time,${new Date().toLocaleString()}`);
    csvLines.push("");
    
    csvLines.push("=== ACCOUNT BALANCE MATRIX ===");
    csvLines.push(`Historical Debts Forward,EGP ${(customer.pastOutstandingAmount || 0).toFixed(2)}`);
    csvLines.push(`Live Unbilled Operations,EGP ${stats.unbilled.toFixed(2)}`);
    csvLines.push(`Outstanding Invoiced Amount,EGP ${stats.unpaidInv.toFixed(2)}`);
    csvLines.push(`Total Financial Exposure,EGP ${stats.exposure.toFixed(2)}`);
    csvLines.push("");

    csvLines.push("=== COMMERCIAL RATES (PORT-TO-PORT TARIFF MATRIX) ===");
    csvLines.push("Port In,Port Out,Price (EGP),Includes VAT");
    if (customerPrices.length === 0) {
      csvLines.push("No custom rates defined (Standard Tariff applies)");
    } else {
      customerPrices.forEach(p => {
        csvLines.push(`${p.portIn},${p.portOut},${p.price.toFixed(2)},${p.includeVat ? 'YES' : 'NO'}`);
      });
    }
    csvLines.push("");

    csvLines.push("=== BOOKING & RESERVATION REGISTRY ===");
    csvLines.push("Reservation ID,Booking Number,Gensets Needed,Port In,Port Out,Date,Status");
    const myReservations = db.getReservations().filter(r => r.customerId === customer.id);
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
    if (customerOps.length === 0) {
      csvLines.push("No operational records");
    } else {
      customerOps.forEach(op => {
        csvLines.push(`${op.id},${op.bookingNumber},${op.containerNumber || 'N/A'},${op.gensetNumber || 'N/A'},${op.operationDate},${op.clipOnPort}->${op.clipOffPort},${op.rate},${op.vat},${op.status},${op.invoiced ? 'YES' : 'NO'}`);
      });
    }
    csvLines.push("");

    csvLines.push("=== ISSUED BILLING INVOICES ===");
    csvLines.push("Invoice ID,Booking #,Date,Total Amount (EGP),Status");
    if (customerInvoices.length === 0) {
      csvLines.push("No billing invoices found");
    } else {
      customerInvoices.forEach(inv => {
        csvLines.push(`${inv.id.split('-').pop()},${inv.bookingNumber},${inv.date},${inv.amount.toFixed(2)},${inv.status}`);
      });
    }
    csvLines.push("");

    csvLines.push("=== TRANSACTION & SETTLEMENT PAYMENTS ===");
    csvLines.push("Payment ID,Date,Reference,Amount (EGP),Type");
    if (customerPayments.length === 0) {
      csvLines.push("No payments received");
    } else {
      customerPayments.forEach(pay => {
        csvLines.push(`PAY-${pay.id.split('-').pop()},${pay.date},${pay.reference},${pay.amount.toFixed(2)},${pay.type}`);
      });
    }

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `ADMIN_COMMERCIAL_EXPORT_${(customer.companyName || customer.name).replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePriceChange = (portIn: Location, portOut: Location, price: string) => {
    if (isReadOnly) return;
    const numericPrice = parseFloat(price) || 0;
    const existing = customerPrices.find(p => p.portIn === portIn && p.portOut === portOut);
    
    db.setCustomerPrice({
      id: existing?.id || `price-${customer.id}-${portIn}-${portOut}`,
      customerId: customer.id,
      customerName: customer.companyName || customer.name,
      portIn,
      portOut,
      price: numericPrice,
      includeVat: existing?.includeVat ?? false
    });
    onRefresh();
  };

  const ports = Object.values(Location).filter(l => l !== Location.MAL);

  return (
    <div className="fixed inset-0 bg-[#001F3F]/95 backdrop-blur-2xl z-[500] flex items-center justify-center p-4 lg:p-10 animate-in fade-in">
      <div className={`w-full max-w-7xl h-full rounded-[4rem] border-[10px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 ${isDark ? 'bg-slate-900 border-slate-950' : 'bg-white border-slate-900'}`}>
        
        {/* Header Block */}
        <div className={`p-10 flex flex-col lg:flex-row justify-between items-center gap-8 shrink-0 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-900 text-white'}`}>
           <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-[#C2A378] text-[#001F3F] rounded-[2rem] flex items-center justify-center text-4xl font-black shadow-xl">
                {(customer.companyName || customer.name)[0]}
              </div>
              <div>
                 <h2 className="text-4xl font-black italic uppercase tracking-tighter text-[#C2A378]">{customer.companyName || customer.name}</h2>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-1">Global Partner Dossier • UID: {customer.id.split('-').pop()}</p>
              </div>
           </div>

           <div className="flex gap-4">
              <div className="text-center px-6 border-x border-white/10">
                 <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Live Load</p>
                 <p className="text-2xl font-black text-blue-400">{stats.active} <span className="text-[10px]">Units</span></p>
              </div>
              <div className="text-center px-6">
                 <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Exposure</p>
                 <p className="text-2xl font-black text-rose-500">EGP {stats.exposure.toLocaleString()}</p>
              </div>
              <button onClick={onClose} className="ml-6 w-14 h-14 rounded-full bg-white/5 hover:bg-rose-600 text-white transition-all flex items-center justify-center text-2xl">✕</button>
           </div>
        </div>

        {/* Tab Navigation */}
        <div className={`px-10 py-4 flex gap-8 border-b shrink-0 ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
           {[
             { id: 'OVERVIEW', label: 'Identity & Info', icon: '👤' },
             { id: 'OPS', label: 'Live Operations', icon: '🚚' },
             { id: 'LEDGER', label: 'Financial Statements', icon: '🏦' },
             { id: 'MATRIX', label: 'Commercial Rates', icon: '💰' },
           ].map(tab => (
             <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3 py-3 px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === tab.id ? 'bg-[#001F3F] text-white shadow-xl' : 'text-slate-400 hover:text-blue-500'}`}
             >
               <span className="text-base">{tab.icon}</span>
               {tab.label}
             </button>
           ))}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          
          {/* TAB: OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 animate-in slide-in-from-bottom-4">
              <div className="lg:col-span-8 space-y-8">
                 <form onSubmit={handleUpdateProfile} className={`p-10 rounded-[3rem] border-2 ${isDark ? 'bg-slate-800/40 border-white/5' : 'bg-white border-slate-100'}`}>
                    <h3 className="text-xl font-black uppercase italic tracking-tighter mb-10">Partner Identity Node</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Registered Entity Name</label>
                          <input className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent font-bold text-sm" value={profile.companyName} onChange={e => setProfile({...profile, companyName: e.target.value.toUpperCase()})} />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Primary Email Alias</label>
                          <input className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent font-bold text-sm" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Commercial Tax ID</label>
                          <input className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent font-bold text-sm" value={profile.taxpayerId} onChange={e => setProfile({...profile, taxpayerId: e.target.value})} />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest px-2 italic">Historical Opening Debt</label>
                          <input type="number" className="w-full p-4 rounded-2xl bg-rose-50/5 dark:bg-rose-900/10 border-2 border-rose-100/10 font-black text-sm text-rose-600" value={profile.pastOutstandingAmount} onChange={e => setProfile({...profile, pastOutstandingAmount: parseFloat(e.target.value) || 0})} />
                       </div>
                    </div>
                    {!isReadOnly && (
                      <button type="submit" className="mt-10 w-full py-5 bg-[#001F3F] text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.4em] shadow-2xl transition-all active:scale-95">Commit Information Matrix</button>
                    )}
                 </form>
              </div>
              <div className="lg:col-span-4 space-y-8">
                 <div className="bg-[#001F3F] p-8 rounded-[3rem] text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#C2A378]/10 rounded-full blur-2xl -mr-16 -mt-16"></div>
                    <h4 className="text-lg font-black uppercase italic text-[#C2A378] mb-6">Financial Summary</h4>
                    <div className="space-y-4">
                       <div className="flex justify-between border-b border-white/5 pb-4"><span className="text-[10px] uppercase text-slate-400">Total Billed</span><span className="font-black">EGP {customerInvoices.reduce((a,b)=>a+b.amount,0).toLocaleString()}</span></div>
                       <div className="flex justify-between border-b border-white/5 pb-4"><span className="text-[10px] uppercase text-slate-400">Total Realized</span><span className="font-black text-emerald-400">EGP {customerPayments.reduce((a,b)=>a+b.amount,0).toLocaleString()}</span></div>
                       <div className="flex justify-between pt-2"><span className="text-[10px] uppercase text-[#C2A378]">Net Balance Due</span><span className="text-2xl font-black text-rose-500">EGP {stats.exposure.toLocaleString()}</span></div>
                    </div>
                 </div>

                 <div className={`p-8 rounded-[3rem] border-2 border-dashed text-center space-y-4 ${isDark ? 'bg-slate-800/40 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#C2A378]">Commercial Dossier Export</p>
                    <button
                       onClick={handleExportAllDataAndFinance}
                       className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95"
                    >
                       📥 Export Data & Finance (CSV)
                    </button>
                 </div>
              </div>
            </div>
          )}

          {/* TAB: OPERATIONS */}
          {activeTab === 'OPS' && (
            <div className="animate-in slide-in-from-bottom-4">
               <div className={`rounded-[3rem] border-2 overflow-hidden ${isDark ? 'bg-slate-800/40 border-white/5' : 'bg-white border-slate-100'}`}>
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#001F3F] text-white text-[9px] font-black uppercase tracking-widest">
                       <tr>
                          <th className="p-6">Booking #</th>
                          <th className="p-6">Container ID</th>
                          <th className="p-6">Genset Unit</th>
                          <th className="p-6">Timeline</th>
                          <th className="p-6">Route</th>
                          <th className="p-6 text-center">Status</th>
                       </tr>
                    </thead>
                    <tbody className={`divide-y text-[10px] font-bold ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                       {customerOps.map(op => (
                         <tr key={op.id} className="hover:bg-blue-50/50 transition-colors">
                            <td className="p-6 text-blue-600 font-mono text-sm tracking-tighter">#{op.bookingNumber}</td>
                            <td className="p-6 font-mono text-slate-700 dark:text-slate-200">{op.containerNumber || '---'}</td>
                            <td className="p-6 text-[#C2A378] italic uppercase">{op.gensetNumber || 'UNASSIGNED'}</td>
                            <td className="p-6 text-slate-400">{op.operationDate}</td>
                            <td className="p-6 uppercase text-slate-500">{op.clipOnPort} → {op.clipOffPort}</td>
                            <td className="p-6 text-center">
                               <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase border ${op.status === 'DONE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{op.status}</span>
                            </td>
                         </tr>
                       ))}
                       {customerOps.length === 0 && <tr><td colSpan={6} className="py-20 text-center opacity-20 font-black uppercase italic tracking-widest">No Operational History</td></tr>}
                    </tbody>
                  </table>
               </div>
            </div>
          )}

          {/* TAB: LEDGER */}
          {activeTab === 'LEDGER' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4">
               <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-4">Billing Registry (Invoices)</h4>
                  <div className={`rounded-[3rem] border-2 overflow-hidden ${isDark ? 'bg-slate-800/40 border-white/5' : 'bg-white border-slate-100'}`}>
                    <table className="w-full text-left">
                       <thead className="bg-slate-900 text-white text-[8px] font-black uppercase">
                          <tr><th className="p-4">Ref</th><th className="p-4">Date</th><th className="p-4 text-right">Amount</th><th className="p-4 text-center">Status</th></tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-[10px]">
                          {customerInvoices.map(inv => (
                            <tr key={inv.id}>
                               <td className="p-4 font-black">#{inv.id.split('-').pop()}</td>
                               <td className="p-4 text-slate-400">{inv.date}</td>
                               <td className="p-4 text-right font-black">EGP {inv.amount.toLocaleString()}</td>
                               <td className="p-4 text-center"><span className={`px-2 py-0.5 rounded font-black uppercase text-[7px] ${inv.status === 'PAID' ? 'text-emerald-500' : 'text-rose-500'}`}>{inv.status}</span></td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                  </div>
               </div>

               <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-4">Transaction History (Payments)</h4>
                  <div className={`rounded-[3rem] border-2 overflow-hidden ${isDark ? 'bg-slate-800/40 border-white/5' : 'bg-white border-slate-100'}`}>
                    <table className="w-full text-left">
                       <thead className="bg-emerald-900 text-white text-[8px] font-black uppercase">
                          <tr><th className="p-4">Ref</th><th className="p-4">Date</th><th className="p-4 text-right">Amount</th><th className="p-4">Method</th></tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-[10px]">
                          {customerPayments.map(pay => (
                            <tr key={pay.id}>
                               <td className="p-4 font-black">PAY-{pay.id.split('-').pop()}</td>
                               <td className="p-4 text-slate-400">{pay.date}</td>
                               <td className="p-4 text-right font-black text-emerald-600">-EGP {pay.amount.toLocaleString()}</td>
                               <td className="p-4 font-bold uppercase">{pay.type}</td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                  </div>
               </div>
            </div>
          )}

          {/* TAB: MATRIX */}
          {activeTab === 'MATRIX' && (
            <div className="animate-in slide-in-from-bottom-4">
               <div className={`p-10 rounded-[4rem] border-2 overflow-hidden ${isDark ? 'bg-slate-800/40 border-white/5' : 'bg-white border-slate-100'}`}>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter mb-8">Exclusive Rate Matrix</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                         <tr>
                           <th className="p-6 border-r border-white/5">Route (In ↓ Out →)</th>
                           {ports.map(p => <th key={p} className="p-6 text-center">{p}</th>)}
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-[10px]">
                         {ports.map(pIn => (
                           <tr key={pIn}>
                             <td className="p-6 font-black text-blue-900 dark:text-blue-400 bg-slate-50 dark:bg-slate-900 border-r dark:border-white/5">{pIn}</td>
                             {ports.map(pOut => {
                               const pr = customerPrices.find(cp => cp.portIn === pIn && cp.portOut === pOut);
                               return (
                                 <td key={pOut} className="p-4 text-center">
                                    <div className="flex flex-col items-center gap-1 group/input">
                                       <span className="text-[7px] font-black text-slate-300">EGP</span>
                                       <input 
                                         type="number"
                                         disabled={isReadOnly}
                                         className={`w-24 bg-transparent text-center font-black text-slate-800 dark:text-slate-200 outline-none focus:text-blue-600 transition-all border-2 py-1.5 rounded-xl ${pr?.price ? 'border-transparent' : 'border-dashed border-slate-100 dark:border-white/5'}`}
                                         defaultValue={pr?.price || ''}
                                         onBlur={(e) => handlePriceChange(pIn as Location, pOut as Location, e.target.value)}
                                       />
                                    </div>
                                 </td>
                               );
                             })}
                           </tr>
                         ))}
                      </tbody>
                    </table>
                  </div>
               </div>
            </div>
          )}

          {/* Dossier Branding Footer */}
          <div className="mt-20 mb-4 flex flex-col items-center gap-3 opacity-20 pointer-events-none text-center">
             <div className="w-16 h-px bg-slate-300"></div>
             <p className={`text-[8px] font-black uppercase tracking-[0.6em] ${isDark ? 'text-white' : 'text-[#001F3F]'}`}>POWERED BY BEBITO</p>
             <p className={`text-[7px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase italic mt-1 leading-none`}>Mohamed A-Alawy | +20 114 647 5759</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Customers: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'black';
  const t = translations[lang];

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}') as User, []);
  const isReadOnly = hasReadOnlyAccess(currentUser);

  const [users, setUsers] = useState<User[]>(db.getUsers());
  const [selectedCust, setSelectedCust] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const refresh = () => setUsers([...db.getUsers()]);

  const filteredCustomers = useMemo(() => {
    return users.filter(u => u.role === UserRole.CUSTOMER && 
      (u.companyName || u.name).toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-start pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
           <h2 className="text-3xl font-black text-[#001F3F] dark:text-white uppercase tracking-tighter italic">{t.customers}</h2>
           <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Portfolio & Ledger Command</p>
        </div>
        <div className="relative w-full md:w-96">
          <input 
            type="text" 
            placeholder="Search Partner Identity..." 
            className={`w-full pl-12 pr-6 py-4 border-2 rounded-[2rem] text-sm font-bold outline-none focus:border-[#C2A378] transition-all shadow-sm ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-blue-900'}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg className="absolute left-5 top-4.5 w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredCustomers.map(cust => (
          <div 
            key={cust.id} 
            onClick={() => setSelectedCust(cust)}
            className={`p-8 rounded-[3rem] border-2 transition-all cursor-pointer group hover:scale-[1.02] hover:shadow-2xl ${isDark ? 'bg-slate-800 border-white/5 hover:border-[#C2A378]' : 'bg-white border-slate-100 hover:border-[#C2A378]'}`}
          >
             <div className="flex items-center gap-5 mb-6">
                <div className="w-16 h-16 bg-[#001F3F] text-[#C2A378] rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg">
                   {(cust.companyName || cust.name)[0]}
                </div>
                <div>
                   <h4 className={`text-xl font-black uppercase tracking-tight group-hover:text-blue-600 transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>{cust.companyName || cust.name}</h4>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Commercial Partner</p>
                </div>
             </div>
             <div className={`p-4 rounded-2xl ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                   <span>Ledger ID</span>
                   <span className="text-blue-600">#{cust.id.split('-').pop()}</span>
                </div>
             </div>
          </div>
        ))}
      </div>

      {selectedCust && (
        <CustomerDossier 
          customer={selectedCust} 
          onClose={() => setSelectedCust(null)} 
          onRefresh={refresh} 
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
};

export default Customers;
