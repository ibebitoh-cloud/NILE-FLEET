
import React, { useState, useContext, useMemo, useRef, useEffect } from 'react';
import { db } from '../services/supabaseDb';
import { Location, UserRole, CustomerPrice } from '../types';
import { LanguageContext } from '../App';
import { translations } from '../translations';

const PRIORITY_ROUTES = [
  { in: Location.ALEX, out: Location.ALEX },
  { in: Location.DAM, out: Location.DAM },
  { in: Location.GOUDA, out: Location.GOUDA },
  // Fix: Changed Location.PSE to Location.PSD as PSE is not defined in the Location enum
  { in: Location.GOUDA, out: Location.PSD },
  { in: Location.SOKHNA, out: Location.SOKHNA },
];

const CustomerPrices: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const t = translations[lang];
  
  const customers = useMemo(() => 
    db.getUsers().filter(u => u.role === UserRole.CUSTOMER || u.role === UserRole.ADMIN), 
  []);
  
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [prices, setPrices] = useState<CustomerPrice[]>(db.getCustomerPrices());
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for quick-editing priority routes on the card
  const [quickEditKey, setQuickEditKey] = useState<string | null>(null);
  const quickInputRef = useRef<HTMLInputElement>(null);

  const ports = Object.values(Location).filter(l => l !== Location.MAL);

  useEffect(() => {
    if (quickEditKey && quickInputRef.current) {
      quickInputRef.current.focus();
      quickInputRef.current.select();
    }
  }, [quickEditKey]);

  const handlePriceChange = (cust: any, portIn: Location, portOut: Location, price: string, currentVat?: boolean) => {
    const numericPrice = parseFloat(price) || 0;
    const existing = prices.find(p => p.customerName === (cust.companyName || cust.name) && p.portIn === portIn && p.portOut === portOut);
    
    const newPriceObj: CustomerPrice = {
      id: existing?.id || `price-${cust.id}-${portIn}-${portOut}`,
      customerId: cust.id,
      customerName: cust.companyName || cust.name,
      portIn,
      portOut,
      price: numericPrice,
      includeVat: currentVat !== undefined ? currentVat : (existing?.includeVat ?? false)
    };
    db.setCustomerPrice(newPriceObj);
    setPrices([...db.getCustomerPrices()]);
  };

  const toggleVat = (cust: any, portIn: Location, portOut: Location) => {
    const existing = prices.find(p => p.customerName === (cust.companyName || cust.name) && p.portIn === portIn && p.portOut === portOut);
    const newPriceObj: CustomerPrice = {
      id: existing?.id || `price-${cust.id}-${portIn}-${portOut}`,
      customerId: cust.id,
      customerName: cust.companyName || cust.name,
      portIn,
      portOut,
      price: existing?.price || 0,
      includeVat: !existing?.includeVat
    };
    db.setCustomerPrice(newPriceObj);
    setPrices([...db.getCustomerPrices()]);
  };

  const getPriceObj = (cust: any, portIn: Location, portOut: Location) => {
    const custName = cust.companyName || cust.name;
    return prices.find(pr => 
      pr.customerName === custName && 
      pr.portIn === portIn && 
      pr.portOut === portOut
    );
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      (c.companyName || c.name).toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [customers, searchTerm]);

  // View 1: Customer Command Grid
  if (!selectedCustomer) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 text-start pb-24">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
             <h3 className="text-3xl font-black text-[#001F3F] uppercase tracking-tighter italic">Rate Master Console</h3>
             <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Strategic Pricing Management per Partner</p>
          </div>
          <div className="relative w-full md:w-96">
            <input 
              type="text" 
              placeholder="Search Partner Identity..." 
              className="w-full pl-12 pr-6 py-4 bg-white border-2 border-slate-100 rounded-[2rem] text-sm font-bold text-blue-900 outline-none focus:border-[#C2A378] transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <svg className="absolute left-5 top-4.5 w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredCustomers.map(cust => (
            <div 
              key={cust.id}
              onClick={() => setSelectedCustomer(cust)}
              className="group bg-white rounded-[3rem] border-2 border-slate-100 p-8 shadow-sm hover:shadow-2xl hover:border-[#C2A378] transition-all duration-500 cursor-pointer relative overflow-hidden"
            >
              {/* Background Decoration */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 group-hover:bg-amber-50 rounded-full -mr-16 -mt-16 transition-colors duration-500"></div>
              
              <div className="flex items-center gap-4 mb-8 relative z-10">
                <div className="w-14 h-14 bg-[#001F3F] text-[#C2A378] rounded-2xl flex items-center justify-center text-xl font-black shadow-lg">
                  {(cust.companyName?.[0] || cust.name[0])}
                </div>
                <div>
                  <h4 className="text-xl font-black text-[#001F3F] uppercase tracking-tight group-hover:text-[#C2A378] transition-colors">{cust.companyName || cust.name}</h4>
                  <span className="px-3 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[8px] font-black uppercase tracking-widest">Active Partner</span>
                </div>
              </div>

              {/* Priority Routes Panel */}
              <div className="space-y-4 relative z-10">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 border-b border-slate-50 pb-2">Priority Route Snapshots</p>
                <div className="grid grid-cols-1 gap-2">
                  {PRIORITY_ROUTES.map((route, idx) => {
                    const priceObj = getPriceObj(cust, route.in, route.out);
                    const price = priceObj?.price || 0;
                    const hasVat = priceObj?.includeVat ?? false;
                    const editKey = `${cust.id}-${route.in}-${route.out}`;
                    const isEditing = quickEditKey === editKey;

                    return (
                      <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 group-hover:bg-white border border-transparent group-hover:border-slate-100 rounded-2xl transition-all">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-slate-800 uppercase bg-slate-200 group-hover:bg-slate-100 px-2 py-0.5 rounded">{route.in}</span>
                          <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                          <span className="text-[9px] font-black text-slate-800 uppercase bg-slate-200 group-hover:bg-slate-100 px-2 py-0.5 rounded">{route.out}</span>
                          {hasVat && <span className="ml-1 text-[7px] font-black text-emerald-600 bg-emerald-50 px-1 rounded border border-emerald-100">VAT</span>}
                        </div>
                        
                        <div 
                          className="relative" 
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent opening the detail view
                            setQuickEditKey(editKey);
                          }}
                        >
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                               <span className="text-[7px] font-black text-blue-600">EGP</span>
                               <input 
                                ref={quickInputRef}
                                type="number"
                                className="w-20 bg-white border border-blue-400 rounded px-1.5 py-0.5 text-[10px] font-black text-blue-700 outline-none"
                                defaultValue={price || ''}
                                onBlur={(e) => {
                                  handlePriceChange(cust, route.in, route.out, e.target.value);
                                  setQuickEditKey(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handlePriceChange(cust, route.in, route.out, (e.target as HTMLInputElement).value);
                                    setQuickEditKey(null);
                                  } else if (e.key === 'Escape') {
                                    setQuickEditKey(null);
                                  }
                                }}
                               />
                            </div>
                          ) : (
                            <span className={`text-[11px] font-black cursor-pointer hover:underline decoration-dotted transition-all ${price > 0 ? 'text-blue-700' : 'text-slate-300 italic underline decoration-slate-200'}`}>
                              {price > 0 ? `EGP ${price.toLocaleString()}` : 'Not Set'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-center relative z-10">
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Global Matrix Status</span>
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-[#C2A378] uppercase group-hover:translate-x-1 transition-transform">Edit Full Matrix</span>
                    <svg className="w-4 h-4 text-[#C2A378]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // View 2: Detailed Matrix Editor
  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 text-start pb-24">
      {/* Detail Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 gap-8">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setSelectedCustomer(null)}
            className="p-4 bg-slate-50 text-slate-400 rounded-full hover:bg-[#001F3F] hover:text-white transition-all shadow-sm"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <span className="text-[10px] font-black text-[#C2A378] uppercase tracking-[0.3em] mb-1 block">Full Matrix Editor</span>
            <h3 className="text-3xl font-black text-[#001F3F] uppercase tracking-tighter italic">{selectedCustomer.companyName || selectedCustomer.name}</h3>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-slate-900 px-8 py-4 rounded-[2rem] text-white">
           <div className="w-10 h-10 bg-[#C2A378] rounded-xl flex items-center justify-center text-lg shadow-lg">🏷️</div>
           <div>
              <p className="text-[9px] font-black uppercase text-slate-500">Database Entry</p>
              <p className="text-sm font-bold">{prices.filter(p => p.customerName === (selectedCustomer.companyName || selectedCustomer.name)).length} Rates Defined</p>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] shadow-2xl border-2 border-slate-200 overflow-hidden relative group">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap border-collapse">
            <thead className="bg-[#001F3F] text-white font-black uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-6 border-r border-white/5 bg-slate-900 sticky left-0 z-20">Route (In ↓ Out →)</th>
                {ports.map(p => (
                  <th key={p} className="p-6 border-r border-white/5 text-center min-w-[140px]">{p}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {ports.map(pIn => (
                <tr key={pIn} className="hover:bg-blue-50/40 transition-colors">
                  <td className="p-6 font-black text-blue-900 bg-slate-50 border-r border-slate-200 sticky left-0 z-10 uppercase text-xs italic">{pIn}</td>
                  {ports.map(pOut => {
                    const priceObj = getPriceObj(selectedCustomer, pIn, pOut);
                    const val = priceObj?.price || 0;
                    const hasVat = priceObj?.includeVat ?? false;
                    const isPriority = PRIORITY_ROUTES.some(pr => pr.in === pIn && pr.out === pOut);
                    
                    return (
                      <td key={pOut} className={`p-4 border-r border-slate-100 text-center ${isPriority ? 'bg-amber-50/30' : ''}`}>
                        <div className="flex flex-col items-center gap-1">
                           <div className="flex items-center gap-1 group/input">
                              <span className="text-slate-300 font-black text-[9px] tracking-widest">EGP</span>
                              <input 
                                type="number" 
                                placeholder="0.00"
                                className={`w-28 bg-transparent text-center font-black text-slate-800 outline-none focus:text-blue-600 focus:scale-110 transition-all py-2 rounded-lg border-2 ${val > 0 ? 'border-transparent' : 'border-dashed border-slate-100 focus:border-blue-400'}`}
                                value={val || ''}
                                onChange={(e) => handlePriceChange(selectedCustomer, pIn, pOut, e.target.value)}
                              />
                           </div>
                           <div className="flex items-center gap-2 mt-1">
                              <button 
                                onClick={() => toggleVat(selectedCustomer, pIn, pOut)}
                                className={`px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all ${hasVat ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                              >
                                {hasVat ? 'VAT ON' : 'VAT OFF'}
                              </button>
                              {isPriority && <span className="text-[7px] font-black text-[#C2A378] uppercase tracking-tighter opacity-50">Priority</span>}
                           </div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 no-print">
        <div className="p-10 bg-[#001F3F] rounded-[3rem] text-white space-y-6 shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
           <h4 className="text-lg font-black uppercase italic text-[#C2A378]">VAT Logic Control</h4>
           <p className="text-xs text-slate-300 font-medium leading-relaxed">You can now enable 14% VAT individually per customer and per route. By default, all operations have 0 VAT. Use the "VAT ON" toggle in the grid above to activate tax calculations for specific contracts.</p>
           <div className="flex gap-4">
              <div className="flex-1 p-4 bg-white/5 border border-white/10 rounded-2xl">
                 <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Standard Rate</p>
                 <p className="text-sm font-bold">Automatic Mapping</p>
              </div>
              <div className="flex-1 p-4 bg-white/5 border border-white/10 rounded-2xl">
                 <p className="text-[9px] font-black text-slate-500 uppercase mb-1">VAT Config</p>
                 <p className="text-sm font-bold">Manual Toggle</p>
              </div>
           </div>
        </div>

        <div className="p-10 bg-white border-2 border-dashed border-slate-200 rounded-[3rem] flex items-center gap-8 shadow-sm">
           <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-[1.5rem] flex items-center justify-center text-3xl shadow-sm">💡</div>
           <div>
              <h4 className="text-lg font-black text-[#001F3F] uppercase tracking-tight">Financial Accuracy Tip</h4>
              <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">Updating a rate here **will not** retroactively change already issued invoices or in-progress bookings. Changes only apply to newly created operations.</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerPrices;
