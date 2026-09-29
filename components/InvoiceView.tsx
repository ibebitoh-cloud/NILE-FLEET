
import React, { useContext, useMemo, useState } from 'react';
import { Invoice, Operation, User, UserRole, InvoiceSettings } from '../types';
import { db } from '../services/supabaseDb';
import { LanguageContext, ThemeContext } from '../App';
import { translations, translateEntity } from '../translations';

interface InvoiceViewProps {
  invoice: Invoice;
  onClose: () => void;
  settings?: InvoiceSettings;
}

const InvoiceView: React.FC<InvoiceViewProps> = ({ invoice, onClose, settings }) => {
  const { lang } = useContext(LanguageContext);
  const t = translations[lang];
  const isAr = lang === 'ar';

  const layoutOptions: InvoiceSettings['layoutStyle'][] = [
    'TRADITIONAL', 'MINIMAL', 'INDUSTRIAL', 'MODERN', 'FUTURISTIC', 'ELEGANT', 'COMPACT'
  ];
  const [localLayoutStyle, setLocalLayoutStyle] = useState<InvoiceSettings['layoutStyle']>(settings?.layoutStyle || 'TRADITIONAL');

  const cycleLayout = () => {
    const currentIndex = layoutOptions.indexOf(localLayoutStyle);
    const nextIndex = (currentIndex + 1) % layoutOptions.length;
    setLocalLayoutStyle(layoutOptions[nextIndex]);
  };

  const operations = useMemo(() => {
    const allOps = db.getOperations();
    return allOps.filter(o => invoice.operationIds.includes(o.id));
  }, [invoice]);

  const partner = useMemo(() => {
    return db.getUsers().find(u => u.id === invoice.customerId) as User;
  }, [invoice]);

  const issuer = useMemo(() => {
     return db.getUsers().find(u => u.role === UserRole.ADMIN) as User;
  }, []);

  const s = {
    primaryColor: '#001F3F',
    accentColor: '#C2A378',
    headerAlignment: 'left',
    footerText: isAr ? 'شكراً لتعاملكم معنا.' : 'Thank you for your business.',
    fontStyle: 'sans',
    showLogo: true,
    showStamp: true,
    showSignature: true,
    showCompanyInfo: true,
    showBankDetails: true,
    showInvoiceId: true,
    showIssueDate: true,
    showCustomerDetails: true,
    showBookingRef: true,
    showContainer: true,
    showGenset: true,
    showRouteInfo: true,
    showUnitRate: true,
    showVatColumn: false,
    showShipperName: false,
    showTruckerName: false,
    showSubtotalRow: true,
    showVatRow: true,
    showGrandTotal: true,
    currency: 'EGP',
    customItemName: isAr ? 'إيجار مولد كهربائي' : 'Genset Clip-On Rental',
    documentTitle: isAr ? 'فاتورة' : 'INVOICE',
    vatPercentage: 14,
    companyHeaderAddress: 'Cairo, Egypt',
    companyVatNumber: '---',
    companyContactEmail: 'ops@nilefleet.com',
    companyContactPhone: '+20 114 647 5759',
    bankName: 'NBE',
    bankIban: '---',
    bankSwift: '---',
    customHeaderNote: '',
    ...settings,
    layoutStyle: localLayoutStyle
  } as InvoiceSettings;

  const isIndustrial = s.layoutStyle === 'INDUSTRIAL';
  const isMinimal = s.layoutStyle === 'MINIMAL';
  const isModern = s.layoutStyle === 'MODERN';
  const isFuturistic = s.layoutStyle === 'FUTURISTIC';
  const isElegant = s.layoutStyle === 'ELEGANT';
  const isCompact = s.layoutStyle === 'COMPACT';

  const fontClass = s.fontStyle === 'mono' ? 'invoice-mono' : s.fontStyle === 'serif' ? 'invoice-serif' : 'invoice-sans';

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[800] flex items-center justify-center p-0 lg:p-4 overflow-hidden">
      <style>{`
        @media print {
          @page { margin: 0; size: A4; }
          body { visibility: hidden; background: white !important; }
          #root { overflow: visible !important; height: auto !important; }
          .printable-invoice-sheet { 
            visibility: visible !important; 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 210mm !important; 
            height: auto !important; 
            margin: 0 !important;
            padding: 1.5cm !important;
            background: white !important;
            z-index: 9999 !important;
            display: flex !important;
            flex-direction: column !important;
          }
          .no-print { display: none !important; }
          .printable-invoice-sheet * { color: black !important; visibility: visible !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        .invoice-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; }
        .invoice-serif { font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif !important; }
        .invoice-sans { font-family: 'Inter', sans-serif !important; }
      `}</style>

      <div className="bg-white rounded-[3rem] shadow-2xl max-w-5xl w-full h-full overflow-hidden flex flex-col border-[8px] border-slate-900 animate-in zoom-in-95">
        <div className="p-6 bg-slate-900 text-white flex justify-between items-center no-print shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={cycleLayout}
              className="group flex items-center gap-2 bg-[#C2A378] hover:bg-white text-slate-900 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all active:scale-95"
            >
              <span className="opacity-60 group-hover:opacity-100">🔄</span>
              <span>{s.layoutStyle} LAYOUT</span>
            </button>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest hidden sm:block">Tap to cycle design</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all">Export PDF / Print</button>
            <button onClick={onClose} className="bg-rose-600 hover:bg-rose-500 text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all">Exit</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-100 p-8 custom-scrollbar">
          <div className={`printable-invoice-sheet max-w-[21cm] mx-auto bg-white shadow-2xl min-h-[29.7cm] text-slate-900 flex flex-col relative ${isAr ? 'rtl' : 'ltr'} ${fontClass} p-12 lg:p-16`}>
            
            {/* Header Area */}
            {isFuturistic ? (
              <div className="bg-slate-900 text-white p-10 rounded-[3rem] mb-12 flex justify-between items-center border-b-8 border-[#C2A378]">
                <div>
                   {s.showLogo && (s.logoUrl ? <img src={s.logoUrl} className="h-16 object-contain mb-4" alt="Company logo" /> : <img src="/nile-fleet-logo.png" className="h-16 object-contain mb-4" alt="Nile Fleet" />)}
                   <h1 className="text-5xl font-black italic tracking-tighter uppercase text-[#C2A378]">{s.documentTitle}</h1>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Protocol Reference</p>
                   <p className="text-2xl font-black font-mono">#{invoice.id.split('-').pop()}</p>
                </div>
              </div>
            ) : isElegant ? (
              <div className="text-center mb-16 border-b border-slate-100 pb-16">
                 {s.showLogo && (s.logoUrl ? <img src={s.logoUrl} className="h-20 object-contain mx-auto mb-8" alt="Company logo" /> : <img src="/nile-fleet-logo.png" className="h-20 object-contain mx-auto mb-8" alt="Nile Fleet" />)}
                 <h1 className="text-5xl font-serif italic mb-4" style={{ color: s.primaryColor }}>{s.documentTitle}</h1>
                 <div className="w-16 h-px bg-[#C2A378] mx-auto mb-4"></div>
                 <p className="text-[10px] uppercase tracking-[0.5em] text-slate-400">Issued for: {partner.companyName}</p>
              </div>
            ) : isCompact ? (
              <div className="flex justify-between items-end mb-6 pb-4 border-b-2 border-slate-900">
                <div className="flex items-center gap-4">
                  {s.showLogo && (s.logoUrl ? <img src={s.logoUrl} className="h-10 object-contain" alt="Company logo" /> : <img src="/nile-fleet-logo.png" className="h-10 object-contain" alt="Nile Fleet" />)}
                  <h1 className="text-2xl font-black uppercase tracking-tighter">{s.documentTitle}</h1>
                </div>
                <p className="text-xs font-black">SERIAL: {invoice.id.split('-').pop()}</p>
              </div>
            ) : (
              <div className={`flex ${isMinimal ? 'flex-col items-center text-center' : 'justify-between items-start'} mb-12`}>
                <div className={isMinimal ? 'mb-8' : ''}>
                  {s.showLogo && (
                    s.logoUrl ? <img src={s.logoUrl} className="h-24 object-contain mb-6" alt="Company logo" /> : <img src="/nile-fleet-logo.png" className="h-24 object-contain mb-6" alt="Nile Fleet" />
                  )}
                  <h1 className={`${isModern ? 'text-6xl' : 'text-4xl'} font-black uppercase tracking-tighter`} style={{ color: s.primaryColor }}>{s.documentTitle}</h1>
                  {s.showCompanyInfo && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em] mt-2">Nile Fleet Operations Hub</p>}
                </div>
                
                <div className={`${isMinimal ? 'grid grid-cols-2 gap-20' : 'text-right'} space-y-1`}>
                  {s.showInvoiceId && (
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Serial Reference</p>
                      <p className={`text-xl font-black ${isIndustrial ? 'bg-slate-900 text-white px-4 py-1' : ''}`}>#{invoice.id.split('-').pop()}</p>
                    </div>
                  )}
                  {s.showIssueDate && (
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-4">Issued Date</p>
                      <p className="text-sm font-bold">{invoice.date}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Address Grid */}
            {!isCompact && (
              <div className={`grid grid-cols-2 gap-20 mb-12 ${isIndustrial ? 'border-y-4 border-slate-900 py-8' : isElegant ? 'border-b border-slate-50 pb-12' : ''}`}>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 pb-2 border-b border-slate-100">Bill From</h4>
                  {s.showCompanyInfo && (
                    <div className="space-y-1">
                      <p className="font-black text-sm uppercase">Nile Fleet for Genset Rental</p>
                      <p className="text-[11px] font-medium text-slate-500">{s.companyHeaderAddress}</p>
                      <p className="text-[11px] font-medium text-slate-500">{s.companyContactEmail}</p>
                      <p className="text-[11px] font-bold">{s.companyContactPhone}</p>
                      <p className="text-[11px] text-slate-400">VAT Reg: {s.companyVatNumber}</p>
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 pb-2 border-b border-slate-100">Bill To</h4>
                  {s.showCustomerDetails && (
                    <div className="space-y-1">
                      <p className="font-black text-sm uppercase text-blue-600">{invoice.customerName}</p>
                      <p className="text-[11px] font-medium text-slate-500">{partner?.email || 'Registered Business Account'}</p>
                      <p className="text-[11px] font-medium text-slate-500">{partner?.addressLine || 'Egypt Base Hub'}</p>
                      <p className="text-[11px] font-bold text-slate-400">TAX ID: {partner?.taxpayerId || '---'}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Compact Header Override */}
            {isCompact && (
              <div className="flex justify-between text-[10px] mb-6">
                <div>
                  <p className="font-black uppercase">{s.companyHeaderAddress}</p>
                  <p>EMAIL: {s.companyContactEmail} | TEL: {s.companyContactPhone}</p>
                </div>
                <div className="text-right">
                  <p className="font-black uppercase">PARTNER: {invoice.customerName}</p>
                  <p>DATE: {invoice.date}</p>
                </div>
              </div>
            )}

            {/* Main Service Table */}
            <div className={`flex-1 ${isModern || isFuturistic ? 'rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-100' : ''}`}>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`${isIndustrial || isCompact ? 'bg-slate-900 text-white' : isFuturistic ? 'bg-[#001F3F] text-[#C2A378]' : 'bg-slate-50 text-slate-500'} text-[10px] font-black uppercase tracking-widest`}>
                    {s.showBookingRef && <th className="px-6 py-4 border-y border-slate-100">Reference</th>}
                    <th className="px-6 py-4 border-y border-slate-100">Service Particulars</th>
                    {s.showRouteInfo && <th className="px-6 py-4 border-y border-slate-100 text-center">Route</th>}
                    {s.showUnitRate && <th className="px-6 py-4 border-y border-slate-100 text-right">Base</th>}
                    {s.showVatColumn && <th className="px-6 py-4 border-y border-slate-100 text-right">Tax</th>}
                    <th className="px-6 py-4 border-y border-slate-100 text-right">Total ({s.currency})</th>
                  </tr>
                </thead>
                <tbody className="text-[11px]">
                  {operations.map(op => (
                    <tr key={op.id} className={`${isIndustrial || isCompact ? 'border-b-2 border-slate-900' : 'border-b border-slate-50'} ${isElegant ? 'font-serif italic' : ''}`}>
                      {s.showBookingRef && <td className="px-6 py-5 font-mono font-bold text-blue-600">#{op.bookingNumber}</td>}
                      <td className="px-6 py-5">
                        <p className={`font-black uppercase ${isElegant ? 'font-serif normal-case italic text-lg' : ''}`}>{s.customItemName}</p>
                        <div className="flex flex-wrap gap-x-3 text-[9px] text-slate-400 font-bold uppercase mt-1">
                          {s.showContainer && <span>CONT: {op.containerNumber}</span>}
                          {s.showGenset && <span>UNIT: {op.gensetNumber}</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-3 text-[8px] text-slate-300 font-bold uppercase">
                          {s.showShipperName && <span>SHIPPER: {op.beneficiaryName}</span>}
                          {s.showTruckerName && <span>TRUCKER: {op.trucker}</span>}
                        </div>
                      </td>
                      {s.showRouteInfo && (
                        <td className="px-6 py-5 text-center">
                          <div className="flex items-center justify-center gap-2 font-black text-[9px] text-slate-500">
                             <span>{op.clipOnPort}</span>
                             <span className="opacity-30">→</span>
                             <span>{op.clipOffPort}</span>
                          </div>
                        </td>
                      )}
                      {s.showUnitRate && (
                        <td className="px-6 py-5 text-right font-bold text-slate-500">
                          {parseFloat(op.rate).toLocaleString()}
                        </td>
                      )}
                      {s.showVatColumn && (
                        <td className="px-6 py-5 text-right font-bold text-slate-400">
                          {parseFloat(op.vat).toLocaleString()}
                        </td>
                      )}
                      <td className="px-6 py-5 text-right font-black">
                        {(parseFloat(op.rate) + parseFloat(op.vat)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Totals */}
            <div className={`mt-12 flex justify-end ${isCompact ? 'mt-6' : ''}`}>
              <div className="w-80 space-y-3">
                {s.showSubtotalRow && (
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Subtotal</span>
                    <span>{s.currency} {operations.reduce((acc, o) => acc + parseFloat(o.rate), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {s.showVatRow && (
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Tax ({s.vatPercentage}%)</span>
                    <span>{s.currency} {operations.reduce((acc, o) => acc + parseFloat(o.vat), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {s.showGrandTotal && (
                  <>
                    <div className="h-px bg-slate-100 my-2"></div>
                    <div className={`flex justify-between items-end ${isModern ? 'bg-slate-900 text-white p-6 rounded-3xl' : isFuturistic ? 'bg-[#001F3F] text-[#C2A378] p-8 rounded-[3rem] border-b-8 border-emerald-500 shadow-xl' : isElegant ? 'border-y border-slate-900 py-6' : isCompact ? 'bg-slate-100 p-4' : ''}`}>
                      <span className={`text-sm font-black uppercase italic ${isElegant ? 'font-serif normal-case' : ''}`} style={{ color: isModern ? 'white' : (isFuturistic ? '#C2A378' : s.primaryColor) }}>Grand Total</span>
                      <span className={`text-3xl font-black italic tracking-tighter ${isElegant ? 'font-serif' : ''}`} style={{ color: isModern ? 'white' : (isFuturistic ? 'white' : s.primaryColor) }}>{s.currency} {invoice.amount.toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Secondary Content */}
            <div className={`mt-16 grid grid-cols-2 gap-10 ${isCompact ? 'mt-8 gap-4' : ''}`}>
               <div>
                 {s.showBankDetails && (
                   <div className={`${isIndustrial || isCompact ? 'border-2 border-slate-900 p-6' : isElegant ? 'border-l-4 border-[#C2A378] pl-6' : 'p-6 bg-slate-50 rounded-3xl border border-slate-100'}`}>
                      <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Settlement Details</h5>
                      <div className="space-y-1 text-[9px] font-bold text-slate-600">
                         <p>BANK: {s.bankName}</p>
                         <p>IBAN: {s.bankIban}</p>
                         <p>SWIFT: {s.bankSwift}</p>
                      </div>
                   </div>
                 )}
                 <p className="text-[10px] font-medium text-slate-400 mt-6 italic leading-relaxed">{s.footerText}</p>
               </div>
               
               <div className="flex flex-col items-center justify-end">
                  {s.showSignature && (
                    <div className="text-center relative">
                       {(issuer?.signatureUrl || issuer?.signatureUrl === '') && (
                         <div className="mb-[-20px] relative z-20">
                            {issuer.signatureUrl ? (
                               <img src={issuer.signatureUrl} className="h-20 object-contain mx-auto" alt="Handwritten Signature" />
                            ) : (
                               <div className="h-20"></div>
                            )}
                         </div>
                       )}
                       {s.showStamp && s.stampUrl && (
                         <img src={s.stampUrl} className="absolute inset-0 w-32 h-32 -mt-16 left-1/2 -translate-x-1/2 opacity-80 mix-blend-multiply rotate-[-12deg]" alt="Stamp" />
                       )}
                       <div className="w-48 h-px bg-slate-900 mb-3 relative z-10 mx-auto"></div>
                       <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 relative z-10 italic">Authorized Signature</p>
                    </div>
                  )}
               </div>
            </div>

            <div className="mt-auto pt-8 border-t border-slate-50 flex flex-col items-center opacity-30 no-print text-center">
               <span className="text-[8px] font-black uppercase tracking-[0.5em]">POWERED BY BEBITO</span>
               <p className="text-[7px] font-bold text-slate-500 uppercase mt-1 italic leading-none">Mohamed A-Alawy | +20 114 647 5759</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceView;
