import React, { useMemo } from 'react';
import { Invoice, InvoiceTheme, CompanyInfo } from '../types';
import DaliSignature from '../../components/DaliSignature';

interface Props {
  invoice: Invoice;
  theme: InvoiceTheme;
  company: CompanyInfo;
}

const InvoiceRenderer: React.FC<Props> = ({ invoice, theme, company }) => {
  const totalUnitLines = invoice.items.length;
  const groupedCount = useMemo(() => {
    const groupedMap = new Map<string, any>();
    invoice.items.forEach(item => {
      const key = `${item.Date}-${item.PortGo}-${item.PortGi}-${item.Shipper}-${item.Trucker}-${item.Rate}`;
      if (groupedMap.has(key)) {
        const existing = groupedMap.get(key);
        existing.count += 1;
      } else {
        groupedMap.set(key, { count: 1 });
      }
    });
    return groupedMap.size;
  }, [invoice.items]);

  const isCompact = totalUnitLines > 4 || groupedCount > 3;
  const isVeryCompact = totalUnitLines > 8 || groupedCount > 6;
  const isUltraCompact = totalUnitLines > 12 || groupedCount > 10;
  const isExtremeCompact = totalUnitLines > 18 || groupedCount > 15;

  const getThemeBaseStyles = () => {
    const padding = isExtremeCompact ? 'p-2' : (isUltraCompact ? 'p-4' : (isVeryCompact ? 'p-6' : (isCompact ? 'p-8' : 'p-12')));
    switch (theme) {
      case 'dark': return `bg-[#0f172a] text-slate-100 font-sans ${padding}`;
      case 'elegant': return `bg-[#fffcf9] text-[#2d241e] font-serif ${padding}`;
      case 'modern-serif': return `bg-white text-slate-900 font-serif ${padding}`;
      case 'ledger-pro': return `bg-white text-slate-900 font-sans ${padding}`;
      case 'industrial': return `bg-[#f0f0f0] text-black font-mono uppercase ${padding} tracking-tighter`;
      case 'bold': return `bg-white text-black font-sans ${padding}`;
      case 'grid': return `bg-white text-slate-800 font-mono ${padding}`;
      case 'soft': return `bg-[#fafbff] text-slate-700 font-sans ${padding} rounded-[2rem]`;
      case 'compact': return "bg-white text-slate-900 font-sans p-6 text-[11px]";
      case 'corporate': return `bg-white text-slate-800 font-sans ${padding} border-t-[10px] border-blue-800`;
      case 'classic': return `bg-white text-black font-serif ${padding} border border-slate-200`;
      case 'blueprint': return `bg-[#002b5c] text-[#a5c9ff] font-mono ${padding}`;
      case 'retro': return `bg-[#f4ecd8] text-[#433422] font-['Special_Elite'] ${padding}`;
      case 'minimalist-bold': return `bg-white text-black font-sans ${padding}`;
      case 'minimalist-dark': return `bg-black text-white font-sans ${padding}`;
      case 'minimalist-blue': return `bg-white text-slate-900 font-sans ${padding}`;
      case 'minimalist-emerald': return `bg-white text-slate-900 font-sans ${padding}`;
      case 'minimalist-modern': return `bg-white text-slate-900 font-sans ${padding}`;
      case 'executive': return `bg-[#fcfcfc] text-[#1a1a1a] font-['Outfit'] ${padding}`;
      case 'brutalist': return `bg-white text-black font-sans ${padding} border-[12px] border-black`;
      case 'luxury': return `bg-[#0a0a0a] text-[#c5a059] font-serif ${padding} border-t-[20px] border-[#c5a059]`;
      case 'luxury-white': return `bg-white text-slate-900 font-serif ${padding} border-t-[20px] border-[#c5a059]`;
      case 'tech': return `bg-[#050505] text-[#00ff41] font-mono ${padding} border-2 border-[#00ff41]/30`;
      case 'editorial': return `bg-white text-slate-900 font-serif ${padding}`;
      case 'organic': return `bg-[#fdfbf7] text-[#2d3a30] font-sans ${padding} rounded-[3rem]`;
      case 'atmospheric': return `bg-slate-900 text-white font-sans ${padding}`;
      case 'clean-utility': return `bg-[#f8f9fa] text-slate-800 font-sans ${padding} border border-slate-200`;
      case 'oversized': return `bg-white text-slate-900 font-sans ${padding}`;
      case 'bold-color': return `bg-[#ff4e00] text-white font-serif ${padding}`;
      case 'split-layout': return "bg-white text-slate-900 font-sans p-0";
      default: return `bg-white text-slate-900 font-sans ${padding}`;
    }
  };

  const isDark = theme === 'dark' || theme === 'minimalist-dark';
  const titleText = invoice.isStatement ? 'STATEMENT OF ACCOUNT' : 'INVOICE';
  const periodLabel = invoice.isStatement ? 'Statement Period' : 'Booking Ref';
  const periodValue = invoice.isStatement ? invoice.period : invoice.bookingNo;

  const renderStatementSummary = () => {
    if (!invoice.isStatement) return null;

    // Calculate smart insights
    const routesMap = new Map<string, number>();
    const truckersMap = new Map<string, number>();
    invoice.items.forEach(item => {
      const route = `${item.PortGo} → ${item.PortGi}`;
      routesMap.set(route, (routesMap.get(route) || 0) + 1);
      truckersMap.set(item.Trucker, (truckersMap.get(item.Trucker) || 0) + 1);
    });
    
    let topRoute = "N/A";
    let maxRouteCount = 0;
    routesMap.forEach((count, route) => {
      if (count > maxRouteCount) {
        maxRouteCount = count;
        topRoute = route;
      }
    });

    const routesArray = Array.from(routesMap.entries()).sort((a, b) => b[1] - a[1]);
    const avgValue = invoice.items.length > 0 ? invoice.total / invoice.items.length : 0;
    
    return (
      <div className="mb-8">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <div className="h-px bg-slate-200 flex-1"></div>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            Statement Intelligence
          </span>
          <div className="h-px bg-slate-200 flex-1"></div>
        </div>
        
        <div className="grid grid-cols-4 gap-4 mb-4 break-inside-avoid">
          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Total Bookings</div>
            <div className="text-2xl font-black text-slate-900">{invoice.items.length}</div>
            <div className="h-0.5 w-full bg-slate-200 mt-3 rounded-full overflow-hidden">
               <div className="h-full bg-slate-900" style={{ width: '100%' }}></div>
            </div>
          </div>
          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Statement Value</div>
            <div className="text-2xl font-black text-blue-600">{invoice.total.toLocaleString()}</div>
            <div className="h-0.5 w-full bg-blue-100 mt-3 rounded-full overflow-hidden">
               <div className="h-full bg-blue-600" style={{ width: '85%' }}></div>
            </div>
          </div>
          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Average Spend</div>
            <div className="text-2xl font-black text-slate-900">{avgValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className="h-0.5 w-full bg-slate-200 mt-3 rounded-full overflow-hidden">
               <div className="h-full bg-slate-400" style={{ width: '60%' }}></div>
            </div>
          </div>
          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm'} border-l-4 border-l-blue-600`}>
            <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1.5">Remittance Ready</div>
            <div className="text-2xl font-black text-slate-900">100%</div>
            <div className="h-0.5 w-full bg-blue-100 mt-3 rounded-full overflow-hidden">
               <div className="h-full bg-blue-600" style={{ width: '100%' }}></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 break-inside-avoid">
          <div className={`p-5 rounded-2xl border ${isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-white shadow-sm'}`}>
             <div className="flex justify-between items-center mb-4">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Route Distribution</div>
                <div className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">Corridor Analysis</div>
             </div>
             <div className="space-y-3">
                {routesArray.slice(0, 3).map(([route, count], idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-[11px] font-black text-slate-700 mb-1 uppercase tracking-tight">
                      <span className="truncate mr-4">{route.toLowerCase()}</span>
                      <span className="shrink-0">{count} Units</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${idx === 0 ? 'bg-blue-600' : idx === 1 ? 'bg-blue-400' : 'bg-blue-200'} rounded-full`} 
                        style={{ width: `${(count / invoice.items.length) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
             </div>
          </div>
          
          <div className={`p-5 rounded-2xl border ${isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-white shadow-sm'} flex flex-col justify-between`}>
             <div className="flex justify-between items-center">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Efficiency Insight</div>
                <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-[10px]">AI</div>
             </div>
             <div className="mt-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
                <p className="text-[11px] leading-relaxed font-bold text-blue-900/70 italic">
                  "Peak activity detected on the <span className="text-blue-600 uppercase underline decoration-2">{topRoute}</span> corridor. {invoice.items.length > 20 ? 'High' : 'Optimal'} volume throughput maintained throughout the statement period."
                </p>
             </div>
             <div className="mt-4 flex gap-2">
                <div className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[8px] font-black uppercase">Verified</div>
                <div className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[8px] font-black uppercase">Smart-Audited</div>
                <div className="px-2 py-1 bg-blue-600 text-white rounded text-[8px] font-black uppercase ml-auto">Active SoA</div>
             </div>
          </div>
        </div>
      </div>
    );
  };

  // Updated Settlement Instructions with "final after a week" clause
  const settlementText = `Official payment is required before ${invoice.dueDate}. Direct transfers to Nile Fleet are mandatory. Document reference ${invoice.serialNumber} must be quoted in all remittance details for successful verification. After receiving the booking within a week, the invoice is final if no edits are required from your side.`;

  const renderHeader = () => {
    switch (theme) {
      case 'minimal':
        return (
          <div className={`flex justify-between items-start ${isVeryCompact ? 'mb-3' : (isCompact ? 'mb-6' : 'mb-12')}`}>
            <div>
              {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-6' : (isCompact ? 'h-8' : 'h-10')} w-auto ${isVeryCompact ? 'mb-1' : (isCompact ? 'mb-2' : 'mb-4')} grayscale`} />}
              <div className={`${isVeryCompact ? 'text-lg' : (isCompact ? 'text-xl' : 'text-2xl')} font-bold tracking-tight text-slate-900`}>{company.name}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-widest">{company.subName}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Invoice</div>
              <div className={`${isVeryCompact ? 'text-base' : (isCompact ? 'text-lg' : 'text-xl')} font-medium text-slate-900`}>{invoice.serialNumber}</div>
              <div className="text-xs text-slate-400 mt-1">{invoice.date}</div>
            </div>
          </div>
        );
      case 'corporate':
        return (
          <div className={`flex justify-between items-start ${isVeryCompact ? 'mb-3' : (isCompact ? 'mb-6' : 'mb-12')}`}>
            <div className="flex items-start gap-6">
              {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-8' : (isCompact ? 'h-10' : 'h-12')} w-auto`} />}
              <div>
                <div className={`${isVeryCompact ? 'text-xl' : (isCompact ? 'text-2xl' : 'text-3xl')} font-bold text-blue-900 tracking-tight uppercase`}>{company.name}</div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">{company.subName}</div>
              </div>
            </div>
            <div className={`text-right border-l-2 border-blue-800 ${isVeryCompact ? 'pl-2' : (isCompact ? 'pl-4' : 'pl-8')}`}>
              <div className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-1">{titleText}</div>
              <div className={`${isVeryCompact ? 'text-lg' : (isCompact ? 'text-xl' : 'text-2xl')} font-bold text-slate-900`}>{invoice.serialNumber}</div>
              <div className="text-xs text-slate-400 mt-1">{invoice.date}</div>
            </div>
          </div>
        );
      case 'elegant':
        return (
          <div className={`flex flex-col items-center ${isVeryCompact ? 'mb-4 pb-3' : (isCompact ? 'mb-8 pb-6' : 'mb-16 pb-12')} border-b border-[#2d241e]/10 text-center`}>
            {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-8' : (isCompact ? 'h-10' : 'h-14')} w-auto ${isVeryCompact ? 'mb-2' : (isCompact ? 'mb-3' : 'mb-6')} opacity-80`} />}
            <div className={`${isVeryCompact ? 'text-xl' : (isCompact ? 'text-2xl' : 'text-4xl')} font-light tracking-[0.15em] uppercase text-[#2d241e] mb-2`}>{company.name}</div>
            <div className={`text-[10px] font-medium tracking-[0.4em] uppercase text-[#2d241e]/50 ${isVeryCompact ? 'mb-3' : (isCompact ? 'mb-6' : 'mb-10')}`}>{company.subName}</div>
            <div className="w-full flex justify-between items-end text-left">
              <div className="text-xs italic text-[#2d241e]/60">Ref: {invoice.serialNumber}</div>
              <div className={`${isVeryCompact ? 'text-lg' : (isCompact ? 'text-xl' : 'text-3xl')} font-light italic tracking-widest uppercase text-center flex-1`}>{titleText}</div>
              <div className="text-xs italic text-[#2d241e]/60 text-right">Date: {invoice.date}</div>
            </div>
          </div>
        );
      case 'bold':
        return (
          <div className={`flex justify-between items-end ${isVeryCompact ? 'mb-3 pb-1.5' : (isCompact ? 'mb-6 pb-3' : 'mb-12 pb-6')} border-b-4 border-black`}>
            <div>
              {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-8' : (isCompact ? 'h-10' : 'h-14')} w-auto ${isVeryCompact ? 'mb-1' : (isCompact ? 'mb-2' : 'mb-4')} grayscale`} />}
              <div className={`${isVeryCompact ? 'text-2xl' : (isCompact ? 'text-3xl' : 'text-5xl')} font-black tracking-tighter uppercase leading-none`}>{company.name}</div>
              <div className="text-xs font-black uppercase tracking-[0.3em] mt-2">{company.subName}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-black uppercase tracking-widest mb-1">Invoice No.</div>
              <div className={`${isVeryCompact ? 'text-xl' : (isCompact ? 'text-2xl' : 'text-4xl')} font-black tracking-tighter`}>{invoice.serialNumber}</div>
              <div className="text-xs font-black mt-1">{invoice.date}</div>
            </div>
          </div>
        );
      case 'dark':
        return (
          <div className={`flex justify-between items-start ${isVeryCompact ? 'mb-3 pb-3' : (isCompact ? 'mb-6 pb-6' : 'mb-12 pb-10')} border-b border-slate-700`}>
            <div className="flex items-start gap-6">
              {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-8' : (isCompact ? 'h-10' : 'h-12')} w-auto brightness-200`} />}
              <div>
                <div className={`${isVeryCompact ? 'text-xl' : (isCompact ? 'text-2xl' : 'text-3xl')} font-black tracking-tight text-white uppercase`}>{company.name}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">{company.subName}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{titleText}</div>
              <div className={`${isVeryCompact ? 'text-lg' : (isCompact ? 'text-xl' : 'text-2xl')} font-bold text-white tracking-tighter`}>{invoice.serialNumber}</div>
              <div className="text-xs text-slate-500 mt-2">{invoice.date}</div>
            </div>
          </div>
        );
      case 'grid':
        return (
          <div className={`grid grid-cols-2 border-2 border-slate-200 ${isVeryCompact ? 'mb-3' : (isCompact ? 'mb-6' : 'mb-12')}`}>
            <div className={`${isVeryCompact ? 'p-2' : (isCompact ? 'p-4' : 'p-8')} border-r-2 border-slate-200 flex flex-col justify-center`}>
              {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-6' : (isCompact ? 'h-8' : 'h-10')} w-auto mb-2 grayscale`} />}
              <div className={`${isVeryCompact ? 'text-lg' : (isCompact ? 'text-xl' : 'text-2xl')} font-bold tracking-tight uppercase text-slate-900`}>{company.name}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{company.subName}</div>
            </div>
            <div className={`${isVeryCompact ? 'p-2' : (isCompact ? 'p-4' : 'p-8')} flex flex-col justify-center items-end bg-slate-50`}>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Document Ref</div>
              <div className={`${isVeryCompact ? 'text-xl' : (isCompact ? 'text-2xl' : 'text-3xl')} font-bold tracking-tighter text-slate-900`}>{invoice.serialNumber}</div>
              <div className="text-xs text-slate-400 mt-2 font-bold">{invoice.date}</div>
            </div>
          </div>
        );
      case 'classic':
        return (
          <div className={`flex flex-col items-center ${isVeryCompact ? 'mb-3 pb-3' : (isCompact ? 'mb-6 pb-6' : 'mb-12 pb-10')} border-b-2 border-slate-200 text-center`}>
            {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-8' : (isCompact ? 'h-12' : 'h-16')} w-auto ${isVeryCompact ? 'mb-1.5' : (isCompact ? 'mb-3' : 'mb-6')} grayscale`} />}
            <div className={`${isVeryCompact ? 'text-xl' : (isCompact ? 'text-2xl' : 'text-4xl')} font-serif font-bold uppercase mb-2 tracking-tight text-slate-900`}>{company.name}</div>
            <div className={`text-xs font-serif italic text-slate-600 ${isVeryCompact ? 'mb-2' : (isCompact ? 'mb-4' : 'mb-8')}`}>{company.subName}</div>
            <div className="w-full flex justify-between items-baseline px-4">
              <div className="text-sm font-serif text-slate-700 text-left">Invoice No: <span className="font-bold text-slate-900">{invoice.serialNumber}</span></div>
              <h1 className={`${isVeryCompact ? 'text-lg' : (isCompact ? 'text-xl' : 'text-2xl')} font-serif font-bold uppercase tracking-widest text-slate-900 text-center flex-1`}>{titleText}</h1>
              <div className="text-sm font-serif text-slate-700 text-right">Date: <span className="font-bold text-slate-900">{invoice.date}</span></div>
            </div>
          </div>
        );
      case 'compact':
        return (
          <div className={`flex justify-between items-center ${isVeryCompact ? 'mb-4 pb-3' : 'mb-8 pb-6'} border-b border-slate-100`}>
            <div className="flex items-center gap-4">
              {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-6' : 'h-8'} w-auto grayscale`} />}
              <div>
                <div className={`${isVeryCompact ? 'text-base' : 'text-lg'} font-bold tracking-tight text-slate-900`}>{company.name}</div>
                <div className="text-[8px] text-slate-400 uppercase tracking-widest">{company.subName}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[8px] font-bold uppercase text-slate-400 mb-0.5">Ref: {invoice.serialNumber}</div>
              <div className="text-xs font-bold text-slate-900">{invoice.date}</div>
            </div>
          </div>
        );
      case 'modern-serif':
        return (
          <div className={`flex justify-between items-start ${isVeryCompact ? 'mb-5 pb-4' : 'mb-10 pb-8'} border-b border-slate-200`}>
            <div className={`${isVeryCompact ? 'space-y-1.5' : 'space-y-3'}`}>
              {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-8' : 'h-12'} w-auto grayscale`} />}
              <h1 className={`${isVeryCompact ? 'text-2xl' : 'text-4xl'} font-black italic tracking-tighter leading-none`}>{company.name}</h1>
              <p className="text-[9px] font-bold tracking-[0.4em] text-blue-600 uppercase">{company.subName || 'Logistics & Power'}</p>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Document Registry</div>
              <div className={`${isVeryCompact ? 'text-lg' : 'text-2xl'} font-light italic text-slate-900`}>{invoice.serialNumber}</div>
              <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{invoice.date}</div>
            </div>
          </div>
        );
      case 'industrial':
        return (
          <div className={`grid grid-cols-2 border-b-[8px] border-black ${isVeryCompact ? 'mb-5 pb-2' : 'mb-10 pb-4'}`}>
            <div className="flex flex-col justify-end">
              {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-6' : 'h-10'} w-auto mb-3 grayscale`} />}
              <div className={`${isVeryCompact ? 'text-2xl' : 'text-4xl'} font-black leading-none mb-1`}>{company.name}</div>
              <div className="text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block w-fit uppercase">{company.subName || 'CORE // GENSET // INFRA'}</div>
            </div>
            <div className="text-right flex flex-col justify-end items-end relative min-h-[60px]">
              <div className="text-[10px] font-black mb-1 relative z-10">REF_CODE: {invoice.serialNumber}</div>
              <div className="text-[10px] font-black relative z-10">STAMPED_ON: {invoice.date}</div>
              <div className={`${isVeryCompact ? 'text-3xl' : 'text-5xl'} font-black opacity-10 absolute right-0 -top-2 select-none pointer-events-none z-0`}>{titleText}</div>
            </div>
          </div>
        );
      case 'ledger-pro':
        return (
          <div className={`flex justify-between items-stretch ${isVeryCompact ? 'mb-5 min-h-[6rem]' : 'mb-10 min-h-[8rem]'} bg-slate-900 text-white -mx-8 -mt-8 p-8`}>
            <div className="flex items-center gap-6 border-l-4 border-blue-500 pl-6">
              {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-8' : 'h-12'} w-auto brightness-200`} />}
              <div className="flex flex-col justify-between h-full">
                <div className={`${isVeryCompact ? 'text-xl' : 'text-3xl'} font-black tracking-tighter uppercase`}>{company.name}</div>
                <div className="text-[9px] font-bold tracking-[0.2em] opacity-40 uppercase">{company.subName || 'Executive Operations Division'}</div>
              </div>
            </div>
            <div className="text-right flex flex-col justify-between">
              <h1 className="text-[10px] font-black tracking-[0.3em] opacity-30 uppercase">{titleText}</h1>
              <div className={`${isVeryCompact ? 'text-xl' : 'text-3xl'} font-mono tracking-tighter text-blue-400`}>{invoice.serialNumber}</div>
            </div>
          </div>
        );
      case 'soft':
        return (
          <div className={`flex justify-between items-center ${isVeryCompact ? 'mb-5 p-4' : 'mb-10 p-8'} bg-white rounded-[1.5rem] shadow-sm border border-slate-50`}>
            <div className="flex items-center gap-6">
              {company.logo && <div className={`${isVeryCompact ? 'p-1' : 'p-2'} bg-indigo-50 rounded-xl`}><img src={company.logo} className={`${isVeryCompact ? 'h-6' : 'h-8'} w-auto`} /></div>}
              <div>
                <h1 className={`${isVeryCompact ? 'text-xl' : 'text-2xl'} font-black text-slate-800 tracking-tight`}>{company.name}</h1>
                <div className="bg-indigo-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full inline-block uppercase tracking-widest mt-1">{company.subName || 'Verified Document'}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Serial Tracking</div>
              <div className={`${isVeryCompact ? 'text-xl' : 'text-2xl'} font-black text-indigo-600 tracking-tighter`}>{invoice.serialNumber}</div>
            </div>
          </div>
        );
      case 'blueprint':
        return (
          <div className={`flex justify-between items-start ${isVeryCompact ? 'mb-5 pb-4' : 'mb-10 pb-8'} border-b-2 border-[#a5c9ff]`}>
            <div className={`${isVeryCompact ? 'space-y-2' : 'space-y-4'}`}>
              {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-6' : 'h-10'} w-auto brightness-200 opacity-80`} />}
              <div className={`${isVeryCompact ? 'space-y-1' : 'space-y-2'}`}>
                <div className={`${isVeryCompact ? 'text-2xl' : 'text-4xl'} font-bold tracking-tighter uppercase`}>{company.name}</div>
                <div className="text-[10px] font-bold tracking-[0.3em] opacity-60">{company.subName}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold opacity-40 mb-1 uppercase tracking-[0.2em]">DWG_REF_NO</div>
              <div className={`${isVeryCompact ? 'text-xl' : 'text-3xl'} font-bold tracking-tighter`}>{invoice.serialNumber}</div>
            </div>
          </div>
        );
      case 'retro':
        return (
          <div className={`flex flex-col items-center ${isVeryCompact ? 'mb-6 pb-4' : 'mb-12 pb-8'} border-b-2 border-[#433422]/20 text-center`}>
            {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-8' : 'h-12'} w-auto ${isVeryCompact ? 'mb-3' : 'mb-6'} grayscale opacity-80`} />}
            <div className={`${isVeryCompact ? 'text-2xl' : 'text-4xl'} font-bold uppercase mb-2 tracking-widest`}>{company.name}</div>
            <div className="text-xs font-bold opacity-60 mb-6">{company.subName}</div>
            <div className="flex justify-between w-full text-left">
              <div>
                <div className="text-[10px] font-bold uppercase mb-1">Document #</div>
                <div className={`${isVeryCompact ? 'text-base' : 'text-xl'} font-bold`}>{invoice.serialNumber}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase mb-1">Date Issued</div>
                <div className={`${isVeryCompact ? 'text-base' : 'text-xl'} font-bold`}>{invoice.date}</div>
              </div>
            </div>
          </div>
        );
      case 'minimalist-bold':
      case 'minimalist-dark':
      case 'minimalist-blue':
      case 'minimalist-emerald':
      case 'minimalist-modern':
        const accentColor = theme === 'minimalist-blue' ? 'text-blue-600' : 
                           theme === 'minimalist-emerald' ? 'text-emerald-600' : 
                           theme === 'minimalist-dark' ? 'text-white' : 'text-black';
        const subColor = theme === 'minimalist-dark' ? 'text-slate-500' : 'text-slate-400';
        
        return (
          <div className={`flex justify-between items-end ${isExtremeCompact ? 'mb-4' : (isVeryCompact ? 'mb-8' : 'mb-16')} no-break`}>
            <div>
              {company.logo && <img src={company.logo} className={`${isExtremeCompact ? 'h-6 mb-2' : (isVeryCompact ? 'h-8 mb-4' : 'h-16 mb-8')} w-auto grayscale ${theme === 'minimalist-dark' ? 'invert brightness-200' : ''}`} />}
              <div className={`${isExtremeCompact ? 'text-2xl' : (isVeryCompact ? 'text-3xl' : 'text-6xl')} font-black leading-none tracking-tighter mb-2 ${accentColor} break-words max-w-2xl`}>{company.name}</div>
              <div className={`text-xs font-black uppercase tracking-[0.5em] ${subColor} break-words`}>{company.subName}</div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-xs font-black uppercase tracking-widest mb-1 ${subColor}`}>Invoice</div>
              <div className={`${isExtremeCompact ? 'text-xl' : (isVeryCompact ? 'text-2xl' : 'text-4xl')} font-black tracking-tighter ${accentColor}`}>{invoice.serialNumber}</div>
            </div>
          </div>
        );
      case 'executive':
        return (
          <div className={`flex justify-between items-center ${isVeryCompact ? 'mb-6 -mx-8 -mt-8 p-6' : 'mb-12 -mx-12 -mt-12 p-12'} bg-[#1a1a1a] text-white`}>
            <div className="flex items-center gap-8">
              {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-8' : 'h-12'} w-auto brightness-200`} />}
              <div>
                <div className={`${isVeryCompact ? 'text-2xl' : 'text-4xl'} font-black tracking-tight mb-1 uppercase`}>{company.name}</div>
                <div className="text-[10px] font-bold tracking-[0.4em] text-amber-400 uppercase">{company.subName}</div>
              </div>
            </div>
            <div className={`text-right border-l border-white/10 ${isVeryCompact ? 'pl-6' : 'pl-12'}`}>
              <div className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3em] mb-2">Registry ID</div>
              <div className={`${isVeryCompact ? 'text-xl' : 'text-3xl'} font-light tracking-tighter text-amber-400`}>{invoice.serialNumber}</div>
            </div>
          </div>
        );
      case 'brutalist':
        return (
          <div className={`flex flex-col ${isVeryCompact ? 'mb-6' : 'mb-12'}`}>
            <div className="flex items-start justify-between mb-4">
              <div className={`${isVeryCompact ? 'text-5xl' : 'text-8xl'} font-black leading-none tracking-tighter uppercase`}>{company.name}</div>
              {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-12' : 'h-20'} w-auto grayscale border-4 border-black`} />}
            </div>
            <div className={`bg-black text-white p-2 text-xs font-black uppercase tracking-[0.3em] w-fit ${isVeryCompact ? 'mb-4' : 'mb-8'}`}>{company.subName}</div>
            <div className={`flex justify-between items-end border-b-[8px] border-black ${isVeryCompact ? 'pb-2' : 'pb-4'}`}>
              <div className={`${isVeryCompact ? 'text-2xl' : 'text-4xl'} font-black italic tracking-tighter`}>{titleText}</div>
              <div className={`${isVeryCompact ? 'text-xl' : 'text-2xl'} font-black tracking-tighter`}>#{invoice.serialNumber}</div>
            </div>
          </div>
        );
      case 'luxury':
        return (
          <div className={`flex flex-col items-center ${isVeryCompact ? 'mb-8' : 'mb-16'} text-center`}>
            {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-10 mb-4' : 'h-16 mb-6'} w-auto brightness-150`} />}
            <h1 className={`${isVeryCompact ? 'text-3xl' : 'text-5xl'} font-light tracking-[0.2em] uppercase mb-2 text-[#c5a059]`}>{company.name}</h1>
            <div className={`text-[10px] font-bold tracking-[0.5em] uppercase text-[#c5a059]/60 ${isVeryCompact ? 'mb-6' : 'mb-12'}`}>{company.subName}</div>
            <div className={`w-full flex justify-between items-center border-y border-[#c5a059]/30 ${isVeryCompact ? 'py-3' : 'py-6'}`}>
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#c5a059]/40">Ref: {invoice.serialNumber}</div>
              <div className={`${isVeryCompact ? 'text-lg' : 'text-2xl'} font-light italic tracking-widest uppercase`}>{titleText}</div>
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#c5a059]/40">Date: {invoice.date}</div>
            </div>
          </div>
        );
      case 'luxury-white':
        return (
          <div className={`flex flex-col items-center ${isVeryCompact ? 'mb-8' : 'mb-16'} text-center`}>
            {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-10 mb-4' : 'h-16 mb-6'} w-auto`} />}
            <h1 className={`${isVeryCompact ? 'text-3xl' : 'text-5xl'} font-light tracking-[0.2em] uppercase mb-2 text-[#c5a059]`}>{company.name}</h1>
            <div className={`text-[10px] font-bold tracking-[0.5em] uppercase text-[#c5a059]/60 ${isVeryCompact ? 'mb-6' : 'mb-12'}`}>{company.subName}</div>
            <div className={`w-full flex justify-between items-center border-y border-[#c5a059]/30 ${isVeryCompact ? 'py-3' : 'py-6'}`}>
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#c5a059]/40">Ref: {invoice.serialNumber}</div>
              <div className={`${isVeryCompact ? 'text-lg' : 'text-2xl'} font-light italic tracking-widest uppercase text-slate-900`}>{titleText}</div>
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#c5a059]/40">Date: {invoice.date}</div>
            </div>
          </div>
        );
      case 'tech':
        return (
          <div className={`${isVeryCompact ? 'mb-6 pb-4' : 'mb-12 pb-8'} border-b border-[#00ff41]/20`}>
            <div className={`flex justify-between items-start ${isVeryCompact ? 'mb-4' : 'mb-8'}`}>
              <div className="flex items-start gap-6">
                {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-6' : 'h-10'} w-auto brightness-150 grayscale`} />}
                <div>
                  <div className={`${isVeryCompact ? 'text-xl' : 'text-3xl'} font-bold tracking-tighter mb-1`}>[ {company.name} ]</div>
                  <div className="text-[10px] opacity-60 uppercase tracking-widest">{company.subName}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] opacity-40 uppercase mb-1">SYSTEM_STATUS: OK</div>
                <div className="text-[10px] opacity-40 uppercase">TERMINAL: {invoice.serialNumber}</div>
              </div>
            </div>
            <div className={`bg-[#00ff41]/5 ${isVeryCompact ? 'p-2' : 'p-4'} border-l-4 border-[#00ff41]`}>
              <div className={`${isVeryCompact ? 'text-base' : 'text-xl'} font-bold tracking-widest uppercase`}>{titleText} // {invoice.date}</div>
            </div>
          </div>
        );
      case 'editorial':
        return (
          <div className={`flex flex-col ${isVeryCompact ? 'mb-8' : 'mb-16'}`}>
            <div className={`flex justify-between items-baseline border-b-2 border-slate-900 ${isVeryCompact ? 'pb-2 mb-2' : 'pb-4 mb-4'}`}>
              <div className="flex items-baseline gap-6">
                {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-6' : 'h-10'} w-auto grayscale`} />}
                <h1 className={`${isVeryCompact ? 'text-4xl' : 'text-7xl'} font-black tracking-tighter leading-none`}>{company.name}</h1>
              </div>
              <div className="text-sm font-bold uppercase tracking-widest italic">{company.subName}</div>
            </div>
            <div className="flex justify-between items-end">
              <div className="text-xs font-bold uppercase tracking-[0.4em] text-slate-400">Issue No. {invoice.serialNumber}</div>
              <div className={`${isVeryCompact ? 'text-2xl' : 'text-4xl'} font-light italic tracking-tighter`}>{invoice.date}</div>
            </div>
          </div>
        );
      case 'organic':
        return (
          <div className={`flex justify-between items-center ${isVeryCompact ? 'mb-6 p-5' : 'mb-12 p-10'} bg-white rounded-[2.5rem] shadow-sm border border-[#e8ece9]`}>
            <div className="flex items-center gap-8">
              {company.logo && <div className={`${isVeryCompact ? 'p-2' : 'p-4'} bg-[#f4f7f5] rounded-full`}><img src={company.logo} className={`${isVeryCompact ? 'h-6' : 'h-10'} w-auto`} /></div>}
              <div>
                <h1 className={`${isVeryCompact ? 'text-xl' : 'text-3xl'} font-bold text-[#2d3a30] tracking-tight`}>{company.name}</h1>
                <div className="text-xs font-medium text-[#7a8c7e] mt-1">{company.subName}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-[#b0bcaf] uppercase tracking-widest mb-1">Document ID</div>
              <div className={`${isVeryCompact ? 'text-xl' : 'text-3xl'} font-bold text-[#4a5d4e] tracking-tighter`}>{invoice.serialNumber}</div>
            </div>
          </div>
        );
      case 'atmospheric':
        return (
          <div className={`relative ${isVeryCompact ? 'mb-6 p-6' : 'mb-12 p-12'} overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-700`}>
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="relative z-10 flex justify-between items-center">
              <div className="flex items-center gap-6">
                {company.logo && <div className={`${isVeryCompact ? 'p-1' : 'p-2'} bg-white/10 rounded-xl backdrop-blur-md`}><img src={company.logo} className={`${isVeryCompact ? 'h-6' : 'h-10'} w-auto brightness-200`} /></div>}
                <div>
                  <h1 className={`${isVeryCompact ? 'text-2xl' : 'text-4xl'} font-black tracking-tight text-white mb-2`}>{company.name}</h1>
                  <div className="text-xs font-bold text-white/60 uppercase tracking-[0.3em]">{company.subName}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Invoice Ref</div>
                <div className={`${isVeryCompact ? 'text-xl' : 'text-3xl'} font-black text-white tracking-tighter`}>{invoice.serialNumber}</div>
              </div>
            </div>
          </div>
        );
      case 'clean-utility':
        return (
          <div className={`flex justify-between items-start ${isVeryCompact ? 'mb-6 pb-5' : 'mb-12 pb-10'} border-b border-slate-200`}>
            <div className="flex items-start gap-6">
              {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-6' : 'h-10'} w-auto grayscale`} />}
              <div className={`${isVeryCompact ? 'space-y-2' : 'space-y-4'}`}>
                <div className={`${isVeryCompact ? 'text-xl' : 'text-2xl'} font-bold text-slate-900 tracking-tight`}>{company.name}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded inline-block">{company.subName}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Invoice Number</div>
              <div className={`${isVeryCompact ? 'text-xl' : 'text-2xl'} font-mono font-bold text-slate-900`}>{invoice.serialNumber}</div>
              <div className="text-xs text-slate-400 mt-2">{invoice.date}</div>
            </div>
          </div>
        );
      case 'oversized':
        return (
          <div className={`relative ${isVeryCompact ? 'mb-10' : 'mb-20'}`}>
            <div className={`absolute ${isVeryCompact ? '-top-5 -left-5 text-[100px]' : '-top-10 -left-10 text-[180px]'} font-black text-slate-50 leading-none select-none z-0 pointer-events-none`}>
              {invoice.serialNumber.slice(-2)}
            </div>
            <div className="relative z-10 flex justify-between items-end">
              <div className="flex items-end gap-8">
                {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-10' : 'h-16'} w-auto grayscale mb-1`} />}
                <div>
                  <h1 className={`${isVeryCompact ? 'text-3xl' : 'text-6xl'} font-black tracking-tighter leading-none mb-4`}>{company.name}</h1>
                  <div className="text-xs font-black uppercase tracking-[0.6em] text-blue-600">{company.subName}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-black uppercase tracking-widest mb-1">Invoice</div>
                <div className={`${isVeryCompact ? 'text-2xl' : 'text-4xl'} font-black tracking-tighter`}>{invoice.serialNumber}</div>
              </div>
            </div>
          </div>
        );
      case 'bold-color':
        return (
          <div className={`flex justify-between items-center ${isVeryCompact ? 'mb-6 -mx-8 -mt-8 p-6' : 'mb-12 bg-black text-white -mx-10 -mt-10 p-12'} bg-black text-white`}>
            <div className="flex items-center gap-8">
              {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-10' : 'h-14'} w-auto brightness-200`} />}
              <div>
                <h1 className={`${isVeryCompact ? 'text-3xl' : 'text-5xl'} font-black tracking-tighter leading-none mb-2 italic`}>{company.name}</h1>
                <div className="text-xs font-bold uppercase tracking-[0.4em] opacity-60">{company.subName}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold uppercase tracking-widest mb-1 opacity-40">Document</div>
              <div className={`${isVeryCompact ? 'text-2xl' : 'text-4xl'} font-black tracking-tighter`}>{invoice.serialNumber}</div>
            </div>
          </div>
        );
      case 'split-layout':
        return (
          <div className={`flex ${isVeryCompact ? 'min-h-[8rem] mb-6' : 'min-h-[12rem] mb-12'} bg-slate-900 text-white`}>
            <div className={`w-1/2 ${isVeryCompact ? 'p-6' : 'p-12'} flex items-center gap-8 border-r border-white/10`}>
              {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-10' : 'h-16'} w-auto brightness-200`} />}
              <div>
                <h1 className={`${isVeryCompact ? 'text-2xl' : 'text-4xl'} font-black tracking-tighter uppercase`}>{company.name}</h1>
                <div className="text-[10px] font-bold tracking-[0.4em] text-blue-400 uppercase mt-2">{company.subName}</div>
              </div>
            </div>
            <div className={`w-1/2 ${isVeryCompact ? 'p-6' : 'p-12'} flex flex-col justify-center items-end bg-blue-600`}>
              <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-2">Invoice Reference</div>
              <div className={`${isVeryCompact ? 'text-3xl' : 'text-5xl'} font-black tracking-tighter`}>{invoice.serialNumber}</div>
            </div>
          </div>
        );
      default:
        return (
          <div className={`flex justify-between items-start ${isVeryCompact ? 'mb-5 pl-4' : 'mb-10 pl-8'} border-l-8 border-slate-900 py-2`}>
            <div className={`${isVeryCompact ? 'space-y-1.5' : 'space-y-3'}`}>
              {company.logo && <img src={company.logo} className={`${isVeryCompact ? 'h-10' : 'h-14'} w-auto ${isDark ? 'brightness-200' : ''}`} />}
              <div>
                <div className={`${isVeryCompact ? 'text-xl' : 'text-3xl'} font-black tracking-tighter uppercase text-slate-900`}>{company.name}</div>
                <div className="text-[9px] font-bold text-blue-600 uppercase tracking-[0.2em]">{company.subName}</div>
              </div>
            </div>
            <div className="text-right relative">
              <h1 className={`${isVeryCompact ? 'text-2xl' : 'text-4xl'} font-black opacity-[0.05] leading-none uppercase absolute right-0 top-0 select-none pointer-events-none z-0`}>{titleText}</h1>
              <div className={`${isVeryCompact ? 'text-xl' : 'text-2xl'} font-bold mt-2 text-slate-900 tracking-tight relative z-10`}>{invoice.serialNumber}</div>
              <div className="mt-2 text-[9px] font-black text-slate-400 uppercase tracking-widest relative z-10">Dated: {invoice.date}</div>
            </div>
          </div>
        );
    }
  };

  const renderBillTo = () => {
    switch (theme) {
      case 'minimal':
        return (
          <div className={`flex justify-between items-end ${isVeryCompact ? 'mb-4' : isCompact ? 'mb-6' : 'mb-12'}`}>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Bill To</div>
              <div className={`${isVeryCompact ? 'text-lg' : isCompact ? 'text-xl' : 'text-3xl'} font-bold text-slate-900 tracking-tight`}>{invoice.customer}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Due Date</div>
              <div className={`${isVeryCompact ? 'text-sm' : isCompact ? 'text-base' : 'text-lg'} font-bold text-slate-900`}>{invoice.dueDate}</div>
            </div>
          </div>
        );
      case 'corporate':
        return (
          <div className={`grid grid-cols-2 gap-12 ${isVeryCompact ? 'mb-4 p-3' : isCompact ? 'mb-6 p-4' : 'mb-12 p-8'} rounded-lg border border-slate-200 bg-slate-50`}>
            <div>
              <div className={`text-[10px] font-bold text-blue-800 uppercase tracking-widest ${isVeryCompact ? 'mb-2' : 'mb-4'}`}>Client Information</div>
              <div className={`${isVeryCompact ? 'text-lg' : isCompact ? 'text-xl' : 'text-3xl'} font-bold text-slate-900 tracking-tight uppercase`}>{invoice.customer}</div>
            </div>
            <div className="text-center flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Reference</div>
                <div className={`${isVeryCompact ? 'text-sm' : isCompact ? 'text-base' : 'text-xl'} font-bold text-slate-900`}>{periodValue}</div>
              </div>
              <div className={`${isVeryCompact ? 'mt-2' : 'mt-4'}`}>
                <div className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-1">Payment Due</div>
                <div className={`${isVeryCompact ? 'text-sm' : isCompact ? 'text-base' : 'text-xl'} font-bold text-red-600`}>{invoice.dueDate}</div>
              </div>
            </div>
          </div>
        );
      case 'elegant':
        return (
          <div className={`grid grid-cols-3 gap-12 ${isVeryCompact ? 'mb-5' : isCompact ? 'mb-8' : 'mb-16'} items-start`}>
            <div className="col-span-2">
              <div className={`text-[10px] font-medium text-[#2d241e]/40 uppercase tracking-[0.4em] ${isVeryCompact ? 'mb-2' : isCompact ? 'mb-3' : 'mb-6'}`}>Recipient</div>
              <div className={`${isVeryCompact ? 'text-2xl' : isCompact ? 'text-3xl' : 'text-5xl'} font-light italic text-[#2d241e] tracking-tight leading-none`}>{invoice.customer}</div>
            </div>
            <div className={`text-center ${isVeryCompact ? 'space-y-4' : 'space-y-8'}`}>
              <div>
                <div className="text-[10px] font-medium text-[#2d241e]/40 uppercase tracking-[0.3em] mb-2">Manifest</div>
                <div className={`${isVeryCompact ? 'text-sm' : isCompact ? 'text-base' : 'text-xl'} font-light italic text-[#2d241e]`}>{periodValue}</div>
              </div>
              <div>
                <div className="text-[10px] font-medium text-[#2d241e]/40 uppercase tracking-[0.3em] mb-2">Due Date</div>
                <div className={`${isVeryCompact ? 'text-sm' : isCompact ? 'text-base' : 'text-xl'} font-light text-[#2d241e]`}>{invoice.dueDate}</div>
              </div>
            </div>
          </div>
        );
      case 'bold':
        return (
          <div className={`flex justify-between items-center ${isVeryCompact ? 'mb-4 p-4' : isCompact ? 'mb-6 p-6' : 'mb-12 p-10'} bg-black text-white`}>
            <div>
              <div className={`text-xs font-black uppercase tracking-widest ${isVeryCompact ? 'mb-2' : 'mb-4'} opacity-40`}>Bill To:</div>
              <div className={`${isVeryCompact ? 'text-2xl' : isCompact ? 'text-3xl' : 'text-5xl'} font-black tracking-tighter uppercase leading-none`}>{invoice.customer}</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-black uppercase tracking-widest mb-2 opacity-40">Due Date</div>
              <div className={`${isVeryCompact ? 'text-lg' : isCompact ? 'text-xl' : 'text-3xl'} font-black tracking-tighter`}>{invoice.dueDate}</div>
            </div>
          </div>
        );
      case 'dark':
        return (
          <div className={`grid grid-cols-2 gap-8 ${isVeryCompact ? 'mb-4 p-4' : isCompact ? 'mb-6 p-6' : 'mb-12 p-8'} bg-slate-800/50 rounded-2xl border border-slate-700`}>
            <div>
              <div className={`text-[10px] font-bold text-slate-500 uppercase tracking-widest ${isVeryCompact ? 'mb-2' : 'mb-4'}`}>Recipient</div>
              <div className={`${isVeryCompact ? 'text-lg' : isCompact ? 'text-xl' : 'text-3xl'} font-black text-white tracking-tight uppercase`}>{invoice.customer}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Reference</div>
              <div className={`${isVeryCompact ? 'text-sm' : isCompact ? 'text-base' : 'text-xl'} font-bold text-white ${isVeryCompact ? 'mb-2' : 'mb-4'}`}>{periodValue}</div>
              <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full inline-block">Due {invoice.dueDate}</div>
            </div>
          </div>
        );
      case 'grid':
        return (
          <div className={`grid grid-cols-2 border-x-2 border-b-2 border-slate-200 ${isVeryCompact ? 'mb-4' : isCompact ? 'mb-6' : 'mb-12'}`}>
            <div className={`${isVeryCompact ? 'p-3' : isCompact ? 'p-4' : 'p-8'} border-r-2 border-slate-200`}>
              <div className={`text-[10px] font-bold text-slate-400 uppercase tracking-widest ${isVeryCompact ? 'mb-2' : 'mb-4'}`}>Recipient_Entity</div>
              <div className={`${isVeryCompact ? 'text-lg' : isCompact ? 'text-xl' : 'text-3xl'} font-bold tracking-tighter uppercase text-slate-900`}>{invoice.customer}</div>
            </div>
            <div className={`${isVeryCompact ? 'p-3' : isCompact ? 'p-4' : 'p-8'} flex flex-col justify-between text-center`}>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Data_Ref</div>
                <div className={`${isVeryCompact ? 'text-sm' : isCompact ? 'text-base' : 'text-xl'} font-bold text-slate-900`}>{periodValue}</div>
              </div>
              <div className={`${isVeryCompact ? 'pt-2' : 'pt-4'} border-t border-slate-100`}>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Due_Date</div>
                <div className={`${isVeryCompact ? 'text-sm' : isCompact ? 'text-base' : 'text-xl'} font-bold text-red-600`}>{invoice.dueDate}</div>
              </div>
            </div>
          </div>
        );
      case 'classic':
        return (
          <div className={`${isVeryCompact ? 'mb-6 p-6' : 'mb-12 p-10'} border border-slate-200 bg-slate-50/50`}>
            <div className="text-xs font-serif italic text-slate-500 mb-4">Bill To:</div>
            <div className={`${isVeryCompact ? 'text-2xl' : 'text-4xl'} font-serif font-bold text-slate-900 mb-6`}>{invoice.customer}</div>
            <div className={`flex justify-between border-t border-slate-200 ${isVeryCompact ? 'pt-4' : 'pt-6'}`}>
              <div>
                <div className="text-[10px] font-serif uppercase text-slate-400 mb-1">Reference</div>
                <div className="font-serif font-bold text-slate-900">{periodValue}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-serif uppercase text-slate-400 mb-1">Payment Due</div>
                <div className="font-serif font-bold text-slate-900">{invoice.dueDate}</div>
              </div>
            </div>
          </div>
        );
      case 'compact':
        return (
          <div className={`flex justify-between items-end ${isVeryCompact ? 'mb-4' : 'mb-8'} px-2`}>
            <div>
              <div className="text-[8px] font-bold text-slate-400 uppercase mb-1">Bill To</div>
              <div className={`${isVeryCompact ? 'text-lg' : 'text-xl'} font-bold text-slate-900 tracking-tight`}>{invoice.customer}</div>
            </div>
            <div className="text-center">
              <div className="text-[8px] font-bold text-slate-400 uppercase mb-1">Due Date</div>
              <div className={`${isVeryCompact ? 'text-xs' : 'text-sm'} font-bold text-slate-900`}>{invoice.dueDate}</div>
            </div>
          </div>
        );
      case 'modern-serif':
        return (
          <div className={`grid grid-cols-2 gap-12 ${isVeryCompact ? 'mb-6' : 'mb-10'} items-start`}>
            <div className={`${isVeryCompact ? 'space-y-1.5' : 'space-y-3'}`}>
              <h3 className="text-[9px] font-bold text-blue-600 uppercase tracking-[0.4em]">Recipient Profile</h3>
              <div className={`${isVeryCompact ? 'text-2xl' : 'text-4xl'} font-light italic leading-tight text-slate-800`}>{invoice.customer}</div>
              <div className="h-0.5 w-full bg-slate-900/5 mt-3"></div>
            </div>
            <div className={`${isVeryCompact ? 'space-y-2 p-4' : 'space-y-4 p-6'} bg-slate-50 rounded-[1.5rem] border border-slate-100`}>
               <div className="flex justify-between gap-6">
                  <div className="flex-1">
                    <div className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest">Manifest Ref</div>
                    <div className="font-bold text-slate-900 text-xs">{periodValue}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[8px] font-black text-red-400 uppercase mb-1 tracking-widest">Payment Deadline</div>
                    <div className="font-black text-red-600 text-xs">{invoice.dueDate}</div>
                  </div>
               </div>
            </div>
          </div>
        );
      case 'industrial':
        return (
          <div className={`grid grid-cols-12 gap-0 ${isVeryCompact ? 'mb-4' : 'mb-8'} border-4 border-black`}>
            <div className="col-span-7 p-4 border-r-4 border-black">
              <div className="text-[9px] font-black underline mb-2">DESTINATION_ENTITY</div>
              <div className={`${isVeryCompact ? 'text-xl' : 'text-3xl'} font-black leading-none`}>{invoice.customer}</div>
            </div>
            <div className="col-span-5 p-4 bg-yellow-400 flex flex-col justify-between text-center">
              <div>
                <div className="text-[9px] font-black mb-0.5 opacity-60">LOG_REF_ID</div>
                <div className="text-[10px] font-black">{periodValue}</div>
              </div>
              <div className="pt-2 border-t border-black/10">
                <div className="text-[9px] font-black opacity-60">DUE_THRESHOLD</div>
                <div className={`${isVeryCompact ? 'text-base' : 'text-lg'} font-black`}>{invoice.dueDate}</div>
              </div>
            </div>
          </div>
        );
      case 'ledger-pro':
        return (
          <div className={`flex justify-between items-end ${isVeryCompact ? 'mb-4 pb-4' : 'mb-8 pb-8'} border-b border-slate-200`}>
            <div className="max-w-md">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Account Consignee</div>
              <div className={`${isVeryCompact ? 'text-2xl' : 'text-4xl'} font-black text-slate-900 tracking-tighter leading-none uppercase`}>{invoice.customer}</div>
            </div>
            <div className={`text-center ${isVeryCompact ? 'space-y-1.5' : 'space-y-3'}`}>
               <div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{periodLabel}</div>
                  <div className={`${isVeryCompact ? 'text-lg' : 'text-xl'} font-black text-slate-900`}>{periodValue}</div>
               </div>
               <div className={`bg-red-600 text-white ${isVeryCompact ? 'px-2 py-1' : 'px-3 py-1.5'} text-[9px] font-black uppercase tracking-widest w-fit mx-auto`}>
                 Payable by {invoice.dueDate}
               </div>
            </div>
          </div>
        );
      case 'soft':
        return (
          <div className={`flex justify-between items-center ${isVeryCompact ? 'mb-4 p-4' : isCompact ? 'mb-6 p-6' : 'mb-10 p-8'} bg-white rounded-[2rem] border border-slate-50 shadow-sm`}>
            <div>
              <div className={`text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] ${isVeryCompact ? 'mb-1' : 'mb-2'}`}>Recipient</div>
              <div className={`${isVeryCompact ? 'text-xl' : isCompact ? 'text-2xl' : 'text-3xl'} font-black text-slate-800 tracking-tight`}>{invoice.customer}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Due Date</div>
              <div className={`${isVeryCompact ? 'text-base' : isCompact ? 'text-lg' : 'text-xl'} font-black text-indigo-600`}>{invoice.dueDate}</div>
              <div className={`text-[9px] font-bold text-slate-400 ${isVeryCompact ? 'mt-1' : 'mt-2'} uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full inline-block`}>Ref: {periodValue}</div>
            </div>
          </div>
        );
      case 'blueprint':
        return (
          <div className={`grid grid-cols-2 gap-8 ${isVeryCompact ? 'mb-5 p-4' : 'mb-10 p-6'} border-2 border-[#a5c9ff]`}>
            <div>
              <div className="text-[10px] font-bold opacity-40 uppercase mb-2">CONTRACTOR_CLIENT</div>
              <div className={`${isVeryCompact ? 'text-xl' : 'text-2xl'} font-bold tracking-tight`}>{invoice.customer}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-bold opacity-40 uppercase mb-2">PROJECT_REF</div>
              <div className={`${isVeryCompact ? 'text-lg' : 'text-xl'} font-bold`}>{periodValue}</div>
              <div className="text-[10px] font-bold text-[#ff6b6b] mt-2 uppercase">DUE: {invoice.dueDate}</div>
            </div>
          </div>
        );
      case 'retro':
        return (
          <div className={`${isVeryCompact ? 'mb-6 p-6' : 'mb-10 p-8'} border-2 border-[#433422] bg-[#433422]/5`}>
            <div className="text-xs font-bold uppercase mb-4 opacity-40">Bill To:</div>
            <div className={`${isVeryCompact ? 'text-2xl' : 'text-3xl'} font-bold mb-4`}>{invoice.customer}</div>
            <div className={`flex justify-between border-t border-[#433422]/20 ${isVeryCompact ? 'pt-3' : 'pt-4'}`}>
              <div>
                <div className="text-[10px] font-bold uppercase opacity-40">Reference</div>
                <div className="font-bold">{periodValue}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase opacity-40">Due Date</div>
                <div className="font-bold">{invoice.dueDate}</div>
              </div>
            </div>
          </div>
        );
      case 'minimalist-bold':
      case 'minimalist-dark':
      case 'minimalist-blue':
      case 'minimalist-emerald':
      case 'minimalist-modern':
        const borderColor = theme === 'minimalist-blue' ? 'border-blue-600' : 
                           theme === 'minimalist-emerald' ? 'text-emerald-600' : 
                           theme === 'minimalist-dark' ? 'border-white' : 'border-black';
        const labelColor = theme === 'minimalist-dark' ? 'text-slate-500' : 'text-slate-400';
        const badgeBg = theme === 'minimalist-blue' ? 'bg-blue-600' :
                        theme === 'minimalist-emerald' ? 'bg-emerald-600' :
                        theme === 'minimalist-dark' ? 'bg-white text-black' : 'bg-black text-white';
        const textColor = theme === 'minimalist-dark' ? 'text-white' : 'text-black';
        const borderTop = theme === 'minimalist-modern' ? 'border-t-2' : 'border-t-8';

        return (
          <div className={`${isExtremeCompact ? 'mb-4 pt-2' : (isVeryCompact ? 'mb-6 pt-4' : 'mb-12 pt-8')} ${borderTop} ${borderColor} flex justify-between items-start no-break`}>
            <div>
              <div className={`text-xs font-black uppercase tracking-widest mb-4 ${labelColor}`}>Client</div>
              <div className={`${isExtremeCompact ? 'text-xl' : (isVeryCompact ? 'text-2xl' : 'text-4xl')} font-black tracking-tighter ${textColor} break-words max-w-md`}>{invoice.customer}</div>
            </div>
            <div className="text-center">
              <div className={`text-xs font-black uppercase tracking-widest mb-2 ${labelColor}`}>Reference</div>
              <div className={`${isExtremeCompact ? 'text-base' : (isVeryCompact ? 'text-lg' : 'text-xl')} font-black tracking-tighter ${textColor}`}>{periodValue}</div>
              <div className={`mt-4 text-xs font-black ${badgeBg} ${isExtremeCompact ? 'px-1 py-0' : (isVeryCompact ? 'px-2 py-0.5' : 'px-3 py-1')} uppercase tracking-widest`}>Due {invoice.dueDate}</div>
            </div>
          </div>
        );
      case 'executive':
        return (
          <div className={`flex justify-between items-center ${isVeryCompact ? 'mb-6 pb-6' : 'mb-12 pb-12'} border-b border-slate-200`}>
            <div>
              <div className="text-[10px] font-bold text-amber-600 uppercase tracking-[0.3em] mb-4">Account Holder</div>
              <div className={`${isVeryCompact ? 'text-2xl' : 'text-4xl'} font-black tracking-tight text-slate-900 uppercase`}>{invoice.customer}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-2">{periodLabel}</div>
              <div className={`${isVeryCompact ? 'text-lg' : 'text-xl'} font-bold text-slate-800 mb-4`}>{periodValue}</div>
              <div className={`text-[10px] font-bold text-white bg-slate-900 ${isVeryCompact ? 'px-3 py-1' : 'px-4 py-2'} uppercase tracking-[0.2em]`}>Payable by {invoice.dueDate}</div>
            </div>
          </div>
        );
      case 'brutalist':
        return (
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-0 ${isVeryCompact ? 'mb-6' : 'mb-12'} border-[6px] border-black`}>
            <div className={`${isVeryCompact ? 'p-4' : 'p-8'} border-r-[6px] border-black`}>
              <div className="text-xs font-black uppercase tracking-widest mb-4">Bill To:</div>
              <div className={`${isVeryCompact ? 'text-3xl' : 'text-5xl'} font-black tracking-tighter uppercase leading-none`}>{invoice.customer}</div>
            </div>
            <div className={`${isVeryCompact ? 'p-4' : 'p-8'} bg-yellow-400 flex flex-col justify-between text-center`}>
              <div>
                <div className="text-xs font-black uppercase tracking-widest mb-2">Reference</div>
                <div className={`${isVeryCompact ? 'text-xl' : 'text-2xl'} font-black tracking-tighter`}>{periodValue}</div>
              </div>
              <div className="pt-4 border-t-2 border-black/10">
                <div className="text-xs font-black uppercase tracking-widest mb-1">Due Date</div>
                <div className={`${isVeryCompact ? 'text-2xl' : 'text-3xl'} font-black tracking-tighter`}>{invoice.dueDate}</div>
              </div>
            </div>
          </div>
        );
      case 'luxury':
        return (
          <div className={`grid grid-cols-3 gap-12 ${isVeryCompact ? 'mb-8 pb-6' : 'mb-16 pb-12'} items-start border-b border-[#c5a059]/20`}>
            <div className="col-span-2">
              <div className={`text-[10px] font-bold text-[#c5a059] uppercase tracking-[0.4em] ${isVeryCompact ? 'mb-3' : 'mb-6'}`}>Client Registry</div>
              <div className={`${isVeryCompact ? 'text-3xl' : 'text-5xl'} font-light italic text-white tracking-tight leading-none`}>{invoice.customer}</div>
            </div>
            <div className={`text-center ${isVeryCompact ? 'space-y-4' : 'space-y-6'}`}>
              <div>
                <div className="text-[10px] font-bold text-[#c5a059]/40 uppercase tracking-[0.3em] mb-2">Manifest</div>
                <div className={`${isVeryCompact ? 'text-lg' : 'text-xl'} font-light text-white`}>{periodValue}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-[#c5a059]/40 uppercase tracking-[0.3em] mb-2">Payment Due</div>
                <div className={`${isVeryCompact ? 'text-lg' : 'text-xl'} font-light text-[#c5a059]`}>{invoice.dueDate}</div>
              </div>
            </div>
          </div>
        );
      case 'luxury-white':
        return (
          <div className={`grid grid-cols-3 gap-12 ${isVeryCompact ? 'mb-8 pb-6' : 'mb-16 pb-12'} items-start border-b border-[#c5a059]/20`}>
            <div className="col-span-2">
              <div className={`text-[10px] font-bold text-[#c5a059] uppercase tracking-[0.4em] ${isVeryCompact ? 'mb-3' : 'mb-6'}`}>Client Registry</div>
              <div className={`${isVeryCompact ? 'text-3xl' : 'text-5xl'} font-light italic text-slate-900 tracking-tight leading-none`}>{invoice.customer}</div>
            </div>
            <div className={`text-center ${isVeryCompact ? 'space-y-4' : 'space-y-6'}`}>
              <div>
                <div className="text-[10px] font-bold text-[#c5a059]/40 uppercase tracking-[0.3em] mb-2">Manifest</div>
                <div className={`${isVeryCompact ? 'text-lg' : 'text-xl'} font-light text-slate-800`}>{periodValue}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-[#c5a059]/40 uppercase tracking-[0.3em] mb-2">Payment Due</div>
                <div className={`${isVeryCompact ? 'text-lg' : 'text-xl'} font-light text-[#c5a059]`}>{invoice.dueDate}</div>
              </div>
            </div>
          </div>
        );
      case 'tech':
        return (
          <div className={`grid grid-cols-2 gap-8 ${isVeryCompact ? 'mb-6 p-4' : 'mb-12 p-8'} border border-[#00ff41]/30 bg-[#00ff41]/5`}>
            <div>
              <div className={`text-[10px] opacity-40 uppercase tracking-widest ${isVeryCompact ? 'mb-2' : 'mb-4'}`}>{'>'} TARGET_ENTITY</div>
              <div className={`${isVeryCompact ? 'text-2xl' : 'text-3xl'} font-bold tracking-tighter uppercase`}>{invoice.customer}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] opacity-40 uppercase mb-4 tracking-widest">{'>'} DATA_REF</div>
              <div className={`${isVeryCompact ? 'text-lg' : 'text-xl'} font-bold tracking-tighter`}>{periodValue}</div>
              <div className={`mt-4 text-[10px] font-bold bg-[#00ff41] text-black ${isVeryCompact ? 'px-1.5 py-0.5' : 'px-2 py-1'} inline-block`}>DUE_DATE: {invoice.dueDate}</div>
            </div>
          </div>
        );
      case 'editorial':
        return (
          <div className={`grid grid-cols-12 gap-12 ${isVeryCompact ? 'mb-8' : 'mb-16'}`}>
            <div className={`col-span-8 border-r-2 border-slate-900 ${isVeryCompact ? 'pr-6' : 'pr-12'}`}>
              <div className={`text-xs font-bold uppercase tracking-[0.4em] text-slate-400 ${isVeryCompact ? 'mb-3' : 'mb-6'}`}>Recipient</div>
              <div className={`${isVeryCompact ? 'text-4xl' : 'text-6xl'} font-black tracking-tighter leading-none uppercase`}>{invoice.customer}</div>
            </div>
            <div className={`col-span-4 flex flex-col justify-between ${isVeryCompact ? 'space-y-4' : ''} text-center`}>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-2">Ref.</div>
                <div className={`${isVeryCompact ? 'text-lg' : 'text-xl'} font-bold italic`}>{periodValue}</div>
              </div>
              <div className={`${isVeryCompact ? 'pt-3' : 'pt-6'} border-t border-slate-200`}>
                <div className="text-xs font-bold uppercase tracking-widest mb-1 text-red-600">Deadline</div>
                <div className={`${isVeryCompact ? 'text-xl' : 'text-2xl'} font-black tracking-tighter`}>{invoice.dueDate}</div>
              </div>
            </div>
          </div>
        );
      case 'organic':
        return (
          <div className={`flex justify-between items-end ${isVeryCompact ? 'mb-6 px-6' : 'mb-12 px-10'}`}>
            <div>
              <div className={`text-[10px] font-bold text-[#b0bcaf] uppercase tracking-[0.3em] ${isVeryCompact ? 'mb-2' : 'mb-4'}`}>Billing To</div>
              <div className={`${isVeryCompact ? 'text-2xl' : 'text-4xl'} font-bold text-[#2d3a30] tracking-tight leading-none`}>{invoice.customer}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-bold text-[#b0bcaf] uppercase tracking-[0.3em] mb-2">Due Date</div>
              <div className={`${isVeryCompact ? 'text-lg' : 'text-xl'} font-bold text-[#4a5d4e] ${isVeryCompact ? 'mb-2' : 'mb-4'}`}>{invoice.dueDate}</div>
              <div className={`text-[10px] font-bold text-white bg-[#4a5d4e] ${isVeryCompact ? 'px-3 py-1' : 'px-4 py-2'} rounded-full uppercase tracking-widest`}>Ref: {periodValue}</div>
            </div>
          </div>
        );
      case 'atmospheric':
        return (
          <div className={`flex justify-between items-center ${isVeryCompact ? 'mb-6 p-6' : 'mb-12 p-10'} bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem]`}>
            <div>
              <div className={`text-[10px] font-bold text-white/40 uppercase tracking-[0.4em] ${isVeryCompact ? 'mb-2' : 'mb-4'}`}>Recipient</div>
              <div className={`${isVeryCompact ? 'text-2xl' : 'text-4xl'} font-black text-white tracking-tight leading-none`}>{invoice.customer}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-bold text-white/40 uppercase tracking-[0.4em] mb-2">Manifest</div>
              <div className={`${isVeryCompact ? 'text-lg' : 'text-xl'} font-bold text-white ${isVeryCompact ? 'mb-2' : 'mb-4'}`}>{periodValue}</div>
              <div className={`text-[10px] font-bold text-white bg-blue-600 ${isVeryCompact ? 'px-3 py-1' : 'px-4 py-2'} rounded-full uppercase tracking-widest shadow-lg shadow-blue-600/40`}>Due {invoice.dueDate}</div>
            </div>
          </div>
        );
      case 'clean-utility':
        return (
          <div className={`grid grid-cols-2 gap-8 ${isVeryCompact ? 'mb-6 p-4' : 'mb-12 p-8'} bg-white rounded-xl border border-slate-200 shadow-sm`}>
            <div>
              <div className={`text-[10px] font-bold text-slate-400 uppercase tracking-widest ${isVeryCompact ? 'mb-2' : 'mb-4'}`}>Bill To</div>
              <div className={`${isVeryCompact ? 'text-2xl' : 'text-3xl'} font-bold text-slate-900 tracking-tight leading-none`}>{invoice.customer}</div>
            </div>
            <div className={`text-center border-l border-slate-100 ${isVeryCompact ? 'pl-4' : 'pl-8'}`}>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Ref ID</div>
                  <div className={`${isVeryCompact ? 'text-xs' : 'text-sm'} font-bold`}>{periodValue}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Due Date</div>
                  <div className={`${isVeryCompact ? 'text-xs' : 'text-sm'} font-bold text-red-600`}>{invoice.dueDate}</div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'oversized':
        return (
          <div className={`${isVeryCompact ? 'mb-10' : 'mb-20'} flex justify-between items-start`}>
            <div className="max-w-xl">
              <div className={`text-[10px] font-black text-blue-600 uppercase tracking-[0.5em] ${isVeryCompact ? 'mb-3' : 'mb-6'}`}>Billing Recipient</div>
              <div className={`${isVeryCompact ? 'text-5xl' : 'text-7xl'} font-black tracking-tighter leading-none uppercase`}>{invoice.customer}</div>
            </div>
            <div className="text-center pt-2">
              <div className="text-xs font-black uppercase tracking-widest mb-2 text-slate-300">Reference</div>
              <div className={`${isVeryCompact ? 'text-xl' : 'text-2xl'} font-black tracking-tighter ${isVeryCompact ? 'mb-3' : 'mb-6'}`}>{periodValue}</div>
              <div className={`text-xs font-black bg-slate-900 text-white ${isVeryCompact ? 'px-3 py-1' : 'px-4 py-2'} uppercase tracking-widest`}>Pay by {invoice.dueDate}</div>
            </div>
          </div>
        );
      case 'bold-color':
        return (
          <div className={`${isVeryCompact ? 'mb-6 pb-6' : 'mb-12 pb-12'} border-b-4 border-white`}>
            <div className={`text-xs font-bold uppercase tracking-[0.5em] ${isVeryCompact ? 'mb-3' : 'mb-6'} opacity-60`}>Recipient Account</div>
            <div className={`${isVeryCompact ? 'text-5xl' : 'text-7xl'} font-black tracking-tighter leading-none ${isVeryCompact ? 'mb-4' : 'mb-8'}`}>{invoice.customer}</div>
            <div className="flex justify-between items-end">
              <div className={`${isVeryCompact ? 'text-xl' : 'text-2xl'} font-bold italic opacity-80`}>{periodValue}</div>
              <div className={`${isVeryCompact ? 'text-xl' : 'text-2xl'} font-black uppercase tracking-widest`}>Due {invoice.dueDate}</div>
            </div>
          </div>
        );
      case 'split-layout':
        return (
          <div className={`flex justify-between items-center ${isVeryCompact ? 'mb-6 px-6' : 'mb-12 px-12'}`}>
            <div>
              <div className={`text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em] ${isVeryCompact ? 'mb-2' : 'mb-4'}`}>Bill To</div>
              <div className={`${isVeryCompact ? 'text-2xl' : 'text-4xl'} font-black text-slate-900 tracking-tight uppercase leading-none`}>{invoice.customer}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em] mb-2">Manifest Ref</div>
              <div className={`${isVeryCompact ? 'text-lg' : 'text-xl'} font-bold text-slate-800 ${isVeryCompact ? 'mb-2' : 'mb-4'}`}>{periodValue}</div>
              <div className={`text-[10px] font-bold text-white bg-slate-900 ${isVeryCompact ? 'px-3 py-1' : 'px-4 py-2'} uppercase tracking-widest`}>Due {invoice.dueDate}</div>
            </div>
          </div>
        );
      default:
        return (
          <div className={`flex justify-between ${isVeryCompact ? 'mb-4 p-4' : isCompact ? 'mb-6 p-6' : 'mb-8 p-6'} items-center bg-slate-50 border border-slate-100 rounded-xl`}>
            <div>
              <div className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">Bill To Account</div>
              <div className={`${isVeryCompact ? 'text-xl' : 'text-3xl'} font-black text-slate-900 tracking-tight`}>{invoice.customer}</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] font-black text-blue-600 uppercase mb-1 tracking-widest">{periodLabel}</div>
              <div className={`${isVeryCompact ? 'text-base' : 'text-lg'} font-bold text-slate-900`}>{periodValue}</div>
              <div className={`text-[9px] font-black text-red-500 mt-1 uppercase bg-red-50 ${isVeryCompact ? 'px-1.5 py-0.25' : 'px-2 py-0.5'} rounded inline-block`}>Due: {invoice.dueDate}</div>
            </div>
          </div>
        );
    }
  };

  const renderTable = () => {
    const groupedMap = new Map<string, any>();
    invoice.items.forEach(item => {
      const key = `${item.Date || ''}-${item.PortGo || ''}-${item.PortGi || ''}-${item.Shipper || ''}-${item.Trucker || ''}-${item.Rate || 0}-${item.InvoiceNo || ''}-${item.BookingNo || ''}`;
      if (groupedMap.has(key)) {
        const existing = groupedMap.get(key);
        if (item.UnitNumber) existing.UnitNumbers.push(item.UnitNumber);
        existing.TotalRate += (Number(item.Rate) || 0);
        existing.Count += 1;
      } else {
        groupedMap.set(key, {
          ...item,
          UnitNumbers: item.UnitNumber ? [item.UnitNumber] : [],
          TotalRate: Number(item.Rate) || 0,
          Count: 1
        });
      }
    });
    const sortedItems = Array.from(groupedMap.values()).map(item => ({
      ...item,
      UnitNumbers: [...(item.UnitNumbers || [])].filter(Boolean).sort((a, b) => (a || '').localeCompare(b || ''))
    })).sort((a, b) => {
      // Sort by date ascending
      const dateA = a.Date ? new Date(a.Date).getTime() : 0;
      const dateB = b.Date ? new Date(b.Date).getTime() : 0;
      if (dateA !== dateB) return dateA - dateB;
      // Then by first unit number
      const uA = (a.UnitNumbers && a.UnitNumbers[0]) ? a.UnitNumbers[0] : '';
      const uB = (b.UnitNumbers && b.UnitNumbers[0]) ? b.UnitNumbers[0] : '';
      return uA.localeCompare(uB);
    });

    const dateGroups: { date: string, items: any[], subtotal: number }[] = [];
    sortedItems.forEach(item => {
      let group = dateGroups.find(g => g.date === item.Date);
      if (!group) {
        group = { date: item.Date, items: [], subtotal: 0 };
        dateGroups.push(group);
      }
      group.items.push(item);
      group.subtotal += item.TotalRate;
    });

    let theadClass = "bg-slate-50 border-y border-slate-200";
    let thClass = "px-2 py-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-500";
    let tdClass = "px-2 py-3 border-b border-slate-100 text-[11px]";
    
    if (theme === 'minimal') {
      theadClass = "border-b border-slate-100";
      thClass = `px-2 ${isCompact ? 'py-2' : 'py-4'} text-left text-[10px] font-bold uppercase tracking-widest text-slate-400`;
      tdClass = `px-2 ${isVeryCompact ? 'py-1' : (isCompact ? 'py-2' : 'py-4')} border-b border-slate-50 ${isVeryCompact ? 'text-[10px]' : 'text-xs'} text-slate-600`;
    } else if (theme === 'corporate') {
      theadClass = "bg-slate-100 px-4";
      thClass = `px-4 ${isCompact ? 'py-2' : 'py-4'} text-left text-[10px] font-bold uppercase tracking-widest text-blue-800`;
      tdClass = `px-4 ${isVeryCompact ? 'py-2' : (isCompact ? 'py-4' : 'py-6')} border-b border-slate-100 ${isVeryCompact ? 'text-xs' : 'text-sm'} text-slate-700`;
    } else if (theme === 'elegant') {
      theadClass = "border-b border-[#2d241e]/10";
      thClass = `px-4 ${isCompact ? 'py-2' : 'py-6'} text-left text-[10px] font-medium uppercase tracking-[0.3em] text-[#2d241e]/40`;
      tdClass = `px-4 ${isVeryCompact ? 'py-3' : (isCompact ? 'py-6' : 'py-10')} border-b border-[#2d241e]/5 ${isVeryCompact ? 'text-xs' : 'text-sm'} font-light italic text-[#2d241e]`;
    } else if (theme === 'bold') {
      theadClass = "bg-black text-white px-4";
      thClass = `px-4 ${isCompact ? 'py-2' : 'py-4'} text-left text-xs font-black uppercase tracking-widest`;
      tdClass = `px-4 ${isVeryCompact ? 'py-3' : (isCompact ? 'py-5' : 'py-8')} border-b-4 border-black ${isVeryCompact ? 'text-sm' : 'text-lg'} font-black uppercase tracking-tighter`;
    } else if (theme === 'dark') {
      theadClass = "border-b border-slate-700";
      thClass = `px-2 ${isCompact ? 'py-2' : 'py-4'} text-left text-[10px] font-bold uppercase tracking-widest text-slate-500`;
      tdClass = `px-2 ${isVeryCompact ? 'py-2' : (isCompact ? 'py-4' : 'py-6')} border-b border-slate-800 ${isVeryCompact ? 'text-xs' : 'text-sm'} text-slate-300`;
    } else if (theme === 'grid') {
      theadClass = "border-y-2 border-slate-200 px-4";
      thClass = `px-4 ${isCompact ? 'py-2' : 'py-4'} text-left text-[10px] font-bold uppercase tracking-widest text-slate-400`;
      tdClass = `px-4 ${isVeryCompact ? 'py-2' : (isCompact ? 'py-4' : 'py-6')} border-b-2 border-slate-200 ${isVeryCompact ? 'text-[10px]' : 'text-xs'} font-mono text-slate-600`;
    } else if (theme === 'classic') {
      theadClass = "border-y-2 border-slate-900";
      thClass = `px-4 ${isCompact ? 'py-2' : 'py-4'} text-left text-xs font-serif font-bold uppercase tracking-widest text-slate-900`;
      tdClass = `px-4 ${isVeryCompact ? 'py-3' : (isCompact ? 'py-5' : 'py-8')} border-b border-slate-200 ${isVeryCompact ? 'text-xs' : 'text-sm'} font-serif text-slate-700`;
    } else if (theme === 'compact') {
      theadClass = "border-b border-slate-100";
      thClass = "px-2 py-1 text-left text-[8px] font-bold uppercase tracking-widest text-slate-400";
      tdClass = "px-2 py-1 border-b border-slate-50 text-[9px] text-slate-600";
    } else if (theme === 'ledger-pro') {
      theadClass = "bg-slate-900 text-white";
      thClass = `px-2 ${isCompact ? 'py-1.5' : 'py-3'} text-left font-black text-[10px] uppercase tracking-widest`;
      tdClass = `px-2 ${isVeryCompact ? 'py-2' : (isCompact ? 'py-4' : 'py-6')} border-b border-slate-100 ${isVeryCompact ? 'text-[10px]' : 'text-[12px]'} font-bold text-slate-800`;
    } else if (theme === 'industrial') {
      theadClass = "bg-black text-white";
      thClass = "px-2 py-1.5 text-left font-black text-[10px] tracking-tight";
      tdClass = `px-2 ${isVeryCompact ? 'py-2' : 'py-4'} border-2 border-black ${isVeryCompact ? 'text-xs' : 'text-sm'} font-black`;
    } else if (theme === 'soft') {
      theadClass = "bg-indigo-50/50";
      thClass = `px-3 ${isCompact ? 'py-1.5' : 'py-3'} text-left font-black text-[9px] text-indigo-400 tracking-[0.2em]`;
      tdClass = `px-3 ${isVeryCompact ? 'py-2' : (isCompact ? 'py-4' : 'py-6')} border-b border-indigo-50/50 ${isVeryCompact ? 'text-[10px]' : 'text-[12px]'} font-medium text-slate-600`;
    } else if (theme === 'blueprint') {
      theadClass = "border-y-2 border-[#a5c9ff]";
      thClass = `px-2 ${isCompact ? 'py-1' : 'py-2'} text-left font-bold text-[10px] uppercase tracking-widest`;
      tdClass = `px-2 ${isVeryCompact ? 'py-1' : (isCompact ? 'py-2' : 'py-5')} border-b border-[#a5c9ff]/20 ${isVeryCompact ? 'text-[9px]' : 'text-[11px]'} font-bold`;
    } else if (theme === 'retro') {
      theadClass = "border-y border-[#433422]";
      thClass = `px-2 ${isCompact ? 'py-1' : 'py-2'} text-left font-bold text-[11px] uppercase`;
      tdClass = `px-2 ${isVeryCompact ? 'py-1' : (isCompact ? 'py-2' : 'py-5')} border-b border-[#433422]/10 ${isVeryCompact ? 'text-[11px]' : 'text-[13px]'}`;
    } else if (theme === 'minimalist-bold' || theme === 'minimalist-dark' || theme === 'minimalist-blue' || theme === 'minimalist-emerald' || theme === 'minimalist-modern') {
      const headerBg = theme === 'minimalist-blue' ? 'bg-blue-600' :
                       theme === 'minimalist-emerald' ? 'bg-emerald-600' :
                       theme === 'minimalist-dark' ? 'bg-white text-black' : 
                       theme === 'minimalist-modern' ? 'bg-slate-50 text-black border-y-2 border-black' : 'bg-black text-white';
      const borderCol = theme === 'minimalist-dark' ? 'border-slate-800' : 'border-slate-100';
      const textCol = theme === 'minimalist-dark' ? 'text-white' : 'text-slate-900';
      
      theadClass = headerBg;
      thClass = `px-4 ${isExtremeCompact ? 'py-0.5' : (isUltraCompact ? 'py-1' : (isCompact ? 'py-2' : 'py-4'))} text-left font-black text-[10px] uppercase tracking-widest`;
      tdClass = `px-4 ${isExtremeCompact ? 'py-1' : (isUltraCompact ? 'py-1.5' : (isVeryCompact ? 'py-2' : (isCompact ? 'py-4' : 'py-6')))} border-b-2 ${borderCol} ${isExtremeCompact ? 'text-[8px]' : (isUltraCompact ? 'text-[9px]' : (isVeryCompact ? 'text-[11px]' : 'text-[13px]'))} font-black ${textCol} break-words`;
    } else if (theme === 'executive') {
      theadClass = "bg-slate-50";
      thClass = `px-4 ${isCompact ? 'py-2' : 'py-4'} text-left font-bold text-[10px] uppercase tracking-[0.2em] text-slate-400`;
      tdClass = `px-4 ${isVeryCompact ? 'py-2' : (isCompact ? 'py-4' : 'py-8')} border-b border-slate-100 ${isVeryCompact ? 'text-[11px]' : 'text-[13px]'} font-bold text-slate-700`;
    } else if (theme === 'brutalist') {
      theadClass = "bg-black text-white";
      thClass = `px-4 ${isCompact ? 'py-2' : 'py-4'} text-left font-black text-[10px] uppercase tracking-widest`;
      tdClass = `px-4 ${isVeryCompact ? 'py-2' : (isCompact ? 'py-4' : 'py-6')} border-b-[4px] border-black ${isVeryCompact ? 'text-[12px]' : 'text-[14px]'} font-black uppercase`;
    } else if (theme === 'luxury') {
      theadClass = "border-y border-[#c5a059]/30";
      thClass = `px-4 ${isCompact ? 'py-2' : 'py-4'} text-left font-bold text-[10px] uppercase tracking-[0.3em] text-[#c5a059]`;
      tdClass = `px-4 ${isVeryCompact ? 'py-2' : (isCompact ? 'py-4' : 'py-8')} border-b border-[#c5a059]/10 ${isVeryCompact ? 'text-[11px]' : 'text-[13px]'} font-light text-white tracking-wide`;
    } else if (theme === 'luxury-white') {
      theadClass = "border-y border-[#c5a059]/30";
      thClass = `px-4 ${isCompact ? 'py-2' : 'py-4'} text-left font-bold text-[10px] uppercase tracking-[0.3em] text-[#c5a059]`;
      tdClass = `px-4 ${isVeryCompact ? 'py-2' : (isCompact ? 'py-4' : 'py-8')} border-b border-[#c5a059]/10 ${isVeryCompact ? 'text-[11px]' : 'text-[13px]'} font-light text-slate-700 tracking-wide`;
    } else if (theme === 'tech') {
      theadClass = "bg-[#00ff41]/10 border-y border-[#00ff41]/30";
      thClass = `px-4 ${isCompact ? 'py-1.5' : 'py-3'} text-left font-bold text-[10px] uppercase tracking-widest text-[#00ff41]`;
      tdClass = `px-4 ${isVeryCompact ? 'py-1.5' : (isCompact ? 'py-3' : 'py-5')} border-b border-[#00ff41]/10 ${isVeryCompact ? 'text-[10px]' : 'text-[12px]'} font-bold text-[#00ff41]/80`;
    } else if (theme === 'editorial') {
      theadClass = "border-y-2 border-slate-900";
      thClass = `px-2 ${isCompact ? 'py-2' : 'py-4'} text-left font-black text-[11px] uppercase tracking-widest`;
      tdClass = `px-2 ${isVeryCompact ? 'py-2' : (isCompact ? 'py-4' : 'py-8')} border-b border-slate-100 ${isVeryCompact ? 'text-[12px]' : 'text-[14px]'} font-bold italic`;
    } else if (theme === 'organic') {
      theadClass = "bg-[#f4f7f5]";
      thClass = `px-6 ${isCompact ? 'py-2' : 'py-4'} text-left font-bold text-[10px] uppercase tracking-widest text-[#7a8c7e]`;
      tdClass = `px-6 ${isVeryCompact ? 'py-2' : (isCompact ? 'py-4' : (isUltraCompact ? 'py-6' : 'py-8'))} border-b border-[#f4f7f5] ${isVeryCompact ? 'text-[11px]' : 'text-[13px]'} font-medium text-[#4a5d4e]`;
    } else if (theme === 'atmospheric') {
      theadClass = "bg-white/5 border-y border-white/10";
      thClass = `px-6 ${isCompact ? 'py-2' : 'py-4'} text-left font-bold text-[10px] uppercase tracking-widest text-white/60`;
      tdClass = `px-6 ${isVeryCompact ? 'py-2' : (isCompact ? 'py-4' : 'py-8')} border-b border-white/5 ${isVeryCompact ? 'text-[11px]' : 'text-[13px]'} font-medium text-white/90`;
    } else if (theme === 'clean-utility') {
      theadClass = "bg-slate-100";
      thClass = `px-4 ${isCompact ? 'py-1.5' : 'py-3'} text-left font-bold text-[10px] uppercase tracking-widest text-slate-500`;
      tdClass = `px-4 ${isVeryCompact ? 'py-2' : (isCompact ? 'py-4' : 'py-6')} border-b border-slate-100 ${isVeryCompact ? 'text-[10px]' : 'text-[12px]'} font-medium text-slate-700`;
    } else if (theme === 'oversized') {
      theadClass = "border-y-4 border-slate-900";
      thClass = `px-2 ${isCompact ? 'py-2' : 'py-4'} text-left font-black text-[11px] uppercase tracking-widest`;
      tdClass = `px-2 ${isVeryCompact ? 'py-3' : (isCompact ? 'py-6' : 'py-10')} border-b border-slate-100 ${isVeryCompact ? 'text-[12px]' : 'text-[15px]'} font-black tracking-tighter`;
    } else if (theme === 'bold-color') {
      theadClass = "border-y-2 border-white";
      thClass = `px-4 ${isCompact ? 'py-2' : 'py-4'} text-left font-bold text-[12px] uppercase tracking-widest text-white`;
      tdClass = `px-4 ${isVeryCompact ? 'py-2' : (isCompact ? 'py-4' : 'py-8')} border-b border-white/20 ${isVeryCompact ? 'text-[12px]' : 'text-[14px]'} font-bold italic text-white`;
    } else if (theme === 'split-layout') {
      theadClass = "bg-slate-50";
      thClass = `px-6 ${isCompact ? 'py-2' : 'py-4'} text-left font-bold text-[10px] uppercase tracking-widest text-slate-400`;
      tdClass = `px-6 ${isVeryCompact ? 'py-1' : (isCompact ? 'py-2' : 'py-5')} border-b border-slate-100 ${isVeryCompact ? 'text-[11px]' : 'text-[13px]'} font-bold text-slate-700`;
    }

    if (invoice.isStatement) {
      tdClass = tdClass.split(' ').filter(c => !c.startsWith('text-')).length > 0 
        ? tdClass.split(' ').filter(c => !c.startsWith('text-')).join(' ') + ' text-[11px] border-x border-slate-100' 
        : 'text-[11px] border-x border-slate-100 px-2 py-2';
      thClass = thClass.split(' ').filter(c => !c.startsWith('text-')).length > 0
        ? thClass.split(' ').filter(c => !c.startsWith('text-')).join(' ') + ' text-[10px] border-x border-slate-200 px-4 py-2'
        : 'text-[10px] border-x border-slate-200 px-4 py-2';
    }

    return (
      <div className={`${isVeryCompact ? 'mb-2' : (isCompact ? 'mb-4' : 'mb-8')} min-h-0 print:block print:overflow-visible`}>
        <table className="w-full border-collapse print:table">
          <thead className={theadClass}>
            <tr>
              <th className={`${thClass} w-[8%] min-w-[60px]`}>Date</th>
              {invoice.isStatement && <th className={`${thClass} w-[10%] min-w-[80px]`}>Inv No</th>}
              {invoice.isStatement && <th className={`${thClass} w-[12%] min-w-[90px]`}>Booking</th>}
              <th className={`${thClass} ${invoice.isStatement ? 'w-[18%]' : 'w-[30%]'} min-w-[120px]`}>Unit</th>
              <th className={`${thClass} w-[12%] min-w-[100px]`}>Route</th>
              <th className={`${thClass} w-[11%] min-w-[80px]`}>Shipper</th>
              <th className={`${thClass} w-[11%] min-w-[80px]`}>Trucker</th>
              <th className={`${thClass} text-right w-[18%] min-w-[80px]`}>Rate</th>
            </tr>
          </thead>
          <tbody>
            {invoice.isStatement ? (
              dateGroups.map((group, gIdx) => (
                <React.Fragment key={gIdx}>
                  <tr className="bg-slate-50/50 no-break">
                    <td 
                      colSpan={8} 
                      className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-y border-slate-100"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                        Transactions for {group.date}
                        <span className="ml-auto opacity-40 font-bold">{group.items.length} Bookings</span>
                      </div>
                    </td>
                  </tr>
                  {group.items.map((item, iIdx) => (
                    <tr key={`${gIdx}-${iIdx}`} className={`${theme === 'soft' ? 'hover:bg-indigo-50/30' : 'hover:bg-slate-50'} transition-colors no-break`}>
                      <td className={tdClass}>
                         <div className="font-bold opacity-60">{item.Date}</div>
                      </td>
                      <td className={tdClass}>
                        <div className="font-black text-blue-600">{item.InvoiceNo || '-'}</div>
                      </td>
                      <td className={tdClass}>
                        <div className="font-black text-slate-700">{item.BookingNo || '-'}</div>
                      </td>
                      <td className={tdClass}>
                        <div className={`font-black text-slate-900 leading-tight print:block print:w-full ${
                          item.UnitNumbers.length > 12 ? 'grid grid-cols-3 gap-x-1' :
                          item.UnitNumbers.length > 8 ? 'grid grid-cols-2 gap-x-2' : 
                          item.UnitNumbers.length > 4 ? 'grid grid-cols-1' : 
                          'flex flex-col'
                        }`}>
                          {item.UnitNumbers.map((unit, idx) => (
                            <div key={idx} className="whitespace-nowrap print:inline-block print:mr-2">{unit}</div>
                          ))}
                        </div>
                      </td>
                      <td className={tdClass}>
                         <div className="flex items-center gap-1 min-w-0 flex-wrap print:block">
                            <span className="font-bold opacity-50">{item.PortGo}</span>
                            <span className="text-blue-500 font-black shrink-0 print:hidden mx-1">→</span>
                            <span className="font-bold text-slate-900">{item.PortGi}</span>
                         </div>
                      </td>
                      <td className={tdClass}>
                        <div className="uppercase font-bold text-slate-500 break-words">{item.Shipper || '-'}</div>
                      </td>
                      <td className={tdClass}>
                        <div className="uppercase font-bold text-slate-700 break-words">{item.Trucker || '-'}</div>
                      </td>
                      <td className={`${tdClass} text-right font-black text-slate-900`}>
                        {item.Count > 1 ? (
                          <div className="flex flex-col items-end">
                            <div className="opacity-40 font-bold">{item.Count} x {item.Rate.toLocaleString()}</div>
                            <div>{item.TotalRate.toLocaleString()} <span className="font-bold opacity-30">EGP</span></div>
                          </div>
                        ) : (
                          <div>{item.Rate.toLocaleString()} <span className="font-bold opacity-30">EGP</span></div>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50/20 no-break">
                    <td colSpan={7} className="px-4 py-2 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest border-y border-slate-100">
                       Daily {group.date} Consolidated
                    </td>
                    <td className="px-4 py-2 text-right text-[11px] font-black text-blue-600 border-y border-slate-100">
                       {group.subtotal.toLocaleString()} <span className="text-[9px] opacity-50">EGP</span>
                    </td>
                  </tr>
                </React.Fragment>
              ))
            ) : (
              sortedItems.map((item, i) => (
                <tr key={i} className={`${theme === 'soft' ? 'hover:bg-indigo-50/30' : 'hover:bg-slate-50'} transition-colors no-break`}>
                  <td className={tdClass}>
                     <div className="font-bold opacity-60">{item.Date}</div>
                  </td>
                  <td className={tdClass}>
                    <div className={`font-black text-slate-900 leading-tight print:block print:w-full ${
                        item.UnitNumbers.length > 12 ? 'grid grid-cols-4 gap-x-1 text-[8px]' :
                        item.UnitNumbers.length > 8 ? 'grid grid-cols-3 gap-x-2 text-[9px]' : 
                        item.UnitNumbers.length > 4 ? 'grid grid-cols-2 gap-x-4 text-[11px]' : 
                        'flex flex-col'
                    }`}>
                      {item.UnitNumbers.map((unit, idx) => (
                        <div key={idx} className="whitespace-nowrap print:inline-block print:mr-2">{unit}</div>
                      ))}
                    </div>
                  </td>
                  <td className={tdClass}>
                     <div className="flex items-center gap-1 min-w-0 flex-wrap print:block">
                        <span className="font-bold opacity-50">{item.PortGo}</span>
                        <span className="text-blue-500 font-black shrink-0 text-[9px] print:hidden mx-1">→</span>
                        <span className="font-bold text-slate-900">{item.PortGi}</span>
                     </div>
                  </td>
                  <td className={tdClass}>
                    <div className="uppercase font-bold text-slate-500 break-words">{item.Shipper || '-'}</div>
                  </td>
                  <td className={tdClass}>
                    <div className="uppercase font-bold text-slate-700 break-words">{item.Trucker || '-'}</div>
                  </td>
                  <td className={`${tdClass} text-right font-black text-slate-900`}>
                    {item.Count > 1 ? (
                      <div className="flex flex-col items-end">
                        <div className="text-[9px] opacity-40 font-bold">{item.Count} x {item.Rate.toLocaleString()}</div>
                        <div>{item.TotalRate.toLocaleString()} <span className="text-[9px] font-bold opacity-30">EGP</span></div>
                      </div>
                    ) : (
                      <div>{item.Rate.toLocaleString()} <span className="text-[9px] font-bold opacity-30">EGP</span></div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderFooter = () => {
    const signatureStyle = {
      transform: `translate(${company.signatureXOffset}px, ${company.signatureYOffset}px) scale(${isVeryCompact ? company.signatureScale * 0.5 : (isCompact ? company.signatureScale * 0.7 : company.signatureScale)})`,
      transformOrigin: 'bottom center'
    };

    const authAndSignature = (
      <div className={`flex items-end ${isVeryCompact ? 'gap-2' : (isCompact ? 'gap-4' : 'gap-10')} no-break`}>
        <div className={`flex flex-col justify-end border-l-4 ${isVeryCompact ? 'pl-2' : (isCompact ? 'pl-3' : 'pl-5')} ${
          theme === 'minimalist-blue' ? 'border-blue-600' :
          theme === 'minimalist-emerald' ? 'border-emerald-600' :
          isDark ? 'border-blue-500' : 'border-slate-900'
        }`}>
          <h5 className={`text-[9px] font-black uppercase tracking-widest mb-2 ${
            theme === 'minimalist-blue' ? 'text-blue-600' :
            theme === 'minimalist-emerald' ? 'text-emerald-600' :
            'text-blue-600'
          }`}>Authorized Signatory</h5>
          <div className={`${isVeryCompact ? 'text-sm' : (isCompact ? 'text-lg' : 'text-2xl')} font-black tracking-tight leading-none uppercase mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{company.authName}</div>
          <div className={`${invoice.isStatement ? 'text-[10px]' : (isExtremeCompact ? 'text-[7px]' : (isVeryCompact ? 'text-[8px]' : 'text-[10px]'))} font-black ${
            theme === 'minimalist-blue' ? 'text-blue-600' :
            theme === 'minimalist-emerald' ? 'text-emerald-600' :
            'text-blue-600'
          } uppercase tracking-widest ${isExtremeCompact ? 'mb-1' : (isVeryCompact ? 'mb-2' : 'mb-4')}`}>{company.authJobTitle}</div>
          
          <div className={`space-y-1 ${invoice.isStatement ? 'text-[8px]' : (isExtremeCompact ? 'text-[6px]' : (isVeryCompact ? 'text-[7px]' : 'text-[8px]'))} font-bold text-slate-400 uppercase leading-none`}>
            <div className="flex items-center gap-2">
              <span className={`${isVeryCompact ? 'min-w-[24px]' : 'min-w-[32px]'} opacity-40`}>LOC:</span>
              <span className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{company.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`${isVeryCompact ? 'min-w-[24px]' : 'min-w-[32px]'} opacity-40`}>MAIL:</span>
              <span className={`${isDark ? 'text-slate-400' : 'text-slate-600'} lowercase`}>{company.authEmail || company.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`${isVeryCompact ? 'min-w-[24px]' : 'min-w-[32px]'} opacity-40`}>MOB:</span>
              <span className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{company.authPhone || company.phone}</span>
            </div>
          </div>
        </div>

        <div className={`flex items-end pb-1 ${isVeryCompact ? 'translate-y-0.5' : (isCompact ? 'translate-y-1' : 'translate-y-2')}`}>
          {company.signature && (
            <div className="relative" style={signatureStyle}>
              <img 
                src={company.signature} 
                className={`${isExtremeCompact ? 'h-6 md:h-8' : (isVeryCompact ? 'h-8 md:h-12' : (isCompact ? 'h-12 md:h-16' : 'h-20 md:h-24'))} w-auto mix-blend-multiply opacity-90 object-contain grayscale brightness-50 ${isDark ? 'invert' : ''}`} 
                alt="Authorized Signature" 
              />
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3/4 h-0.5 bg-slate-900/10 rounded-full" />
            </div>
          )}
        </div>
      </div>
    );

    const settlementSection = (
      <div className={`${isExtremeCompact ? 'p-2' : 'p-4'} rounded-xl border no-break ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'
      }`}>
         <h5 className={`text-[9px] font-black uppercase tracking-widest mb-2 ${
           theme === 'minimalist-blue' ? 'text-blue-600' :
           theme === 'minimalist-emerald' ? 'text-emerald-600' :
           'text-blue-600'
         }`}>Settlement Mandate</h5>
         <p className={`${invoice.isStatement ? 'text-[11px]' : (isExtremeCompact ? 'text-[9px]' : 'text-[10.5px]')} leading-relaxed font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {settlementText}
         </p>
      </div>
    );

  const totalLabel = invoice.isStatement ? 'Statement Closing Balance' : 'Total Payable Balance';
  const totalAmountLabel = invoice.isStatement ? 'Statement Balance Due' : 'Total Amount Due';

  const totalSection = (
      <div className={`bg-slate-900 text-white ${isVeryCompact ? 'p-2' : (isCompact ? 'p-4' : 'p-6')} rounded-[1.5rem] flex justify-between items-center w-full shadow-xl shadow-slate-900/10`}>
         <div>
            <div className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40 mb-0.5">{totalLabel}</div>
            <div className="text-[10px] font-bold italic opacity-60">Egyptian Pounds (EGP)</div>
         </div>
         <div className={`${isVeryCompact ? 'text-2xl' : (isCompact ? 'text-3xl' : 'text-5xl')} font-black tabular-nums tracking-tighter`}>
            {invoice.total.toLocaleString()}
         </div>
      </div>
    );

    const blueprintTotal = (
      <div className={`border-4 border-[#a5c9ff] ${isVeryCompact ? 'p-2' : (isCompact ? 'p-3' : 'p-6')} flex justify-between items-center w-full`}>
        <div className={`${isVeryCompact ? 'text-xs' : (isCompact ? 'text-sm' : 'text-xl')} font-bold uppercase tracking-[0.2em]`}>{invoice.isStatement ? 'STATEMENT_BALANCE_EGP' : 'TOTAL_PAYABLE_EGP'}</div>
        <div className={`${isVeryCompact ? 'text-2xl' : (isCompact ? 'text-4xl' : 'text-6xl')} font-bold tracking-tighter`}>{invoice.total.toLocaleString()}</div>
      </div>
    );

    const retroTotal = (
      <div className={`border-2 border-[#433422] ${isExtremeCompact ? 'p-1' : (isVeryCompact ? 'p-2' : (isCompact ? 'p-3' : 'p-6'))} flex justify-between items-center w-full bg-[#433422]/5`}>
        <div className={`${isExtremeCompact ? 'text-[10px]' : (isVeryCompact ? 'text-xs' : (isCompact ? 'text-sm' : 'text-xl'))} font-bold uppercase underline`}>{totalAmountLabel}:</div>
        <div className={`${isExtremeCompact ? 'text-xl' : (isVeryCompact ? 'text-2xl' : (isCompact ? 'text-3xl' : 'text-5xl'))} font-bold`}>{invoice.total.toLocaleString()} EGP</div>
      </div>
    );

    const minimalistTotal = (
      <div className={`${theme === 'minimalist-modern' ? 'border-y-2' : 'border-y-8'} ${
        theme === 'minimalist-blue' ? 'border-blue-600' :
        theme === 'minimalist-emerald' ? 'border-emerald-600' :
        theme === 'minimalist-dark' ? 'border-white' : 'border-black'
      } ${isExtremeCompact ? 'py-1' : (isVeryCompact ? 'py-2' : (isCompact ? 'py-4' : 'py-8'))} flex justify-between items-center w-full no-break`}>
        <div className={`${isExtremeCompact ? 'text-sm' : (isVeryCompact ? 'text-base' : (isCompact ? 'text-lg' : 'text-2xl'))} font-black uppercase tracking-widest ${theme === 'minimalist-dark' ? 'text-white' : 'text-black'}`}>Total</div>
        <div className={`${isExtremeCompact ? 'text-2xl' : (isVeryCompact ? 'text-3xl' : (isCompact ? 'text-5xl' : 'text-7xl'))} font-black tracking-tighter ${
          theme === 'minimalist-blue' ? 'text-blue-600' :
          theme === 'minimalist-emerald' ? 'text-emerald-600' :
          theme === 'minimalist-dark' ? 'text-white' : 'text-black'
        }`}>{invoice.total.toLocaleString()}</div>
      </div>
    );

    const executiveTotal = (
      <div className={`bg-[#1a1a1a] text-white ${isVeryCompact ? 'p-4' : (isCompact ? 'p-6' : 'p-10')} flex justify-between items-center w-full`}>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-amber-400 mb-2">{invoice.isStatement ? 'Final Statement Balance' : 'Final Settlement Amount'}</div>
          <div className="text-sm font-medium text-white/40 italic text-center">All values in Egyptian Pounds</div>
        </div>
        <div className={`${isVeryCompact ? 'text-2xl' : (isCompact ? 'text-4xl' : 'text-6xl')} font-black tracking-tighter text-amber-400`}>
          {invoice.total.toLocaleString()}
        </div>
      </div>
    );

    const brutalistTotal = (
      <div className={`border-[10px] border-black ${isVeryCompact ? 'p-2' : (isCompact ? 'p-4' : 'p-8')} flex justify-between items-center w-full bg-white`}>
        <div className={`${isVeryCompact ? 'text-xl' : (isCompact ? 'text-2xl' : 'text-4xl')} font-black uppercase tracking-tighter`}>Total_Payable</div>
        <div className={`${isVeryCompact ? 'text-4xl' : (isCompact ? 'text-6xl' : 'text-8xl')} font-black tracking-tighter`}>{invoice.total.toLocaleString()}</div>
      </div>
    );

    const luxuryTotal = (
      <div className={`border border-[#c5a059] ${isVeryCompact ? 'p-4' : (isCompact ? 'p-6' : 'p-10')} flex justify-between items-center w-full bg-[#c5a059]/5`}>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.5em] text-[#c5a059] mb-2">{totalAmountLabel}</div>
          <div className="text-sm font-light italic text-white/40 text-center">Egyptian Pounds (EGP)</div>
        </div>
        <div className={`${isVeryCompact ? 'text-3xl' : (isCompact ? 'text-5xl' : 'text-7xl')} font-light tracking-tighter text-[#c5a059]`}>
          {invoice.total.toLocaleString()}
        </div>
      </div>
    );

    const luxuryWhiteTotal = (
      <div className={`border border-[#c5a059] ${isVeryCompact ? 'p-4' : (isCompact ? 'p-6' : 'p-10')} flex justify-between items-center w-full bg-[#c5a059]/5`}>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.5em] text-[#c5a059] mb-2">Total Amount Due</div>
          <div className="text-sm font-light italic text-slate-400">Egyptian Pounds (EGP)</div>
        </div>
        <div className={`${isVeryCompact ? 'text-3xl' : (isCompact ? 'text-5xl' : 'text-7xl')} font-light tracking-tighter text-[#c5a059]`}>
          {invoice.total.toLocaleString()}
        </div>
      </div>
    );

    const techTotal = (
      <div className={`border-2 border-[#00ff41] ${isVeryCompact ? 'p-2' : (isCompact ? 'p-4' : 'p-8')} flex justify-between items-center w-full bg-[#00ff41]/10`}>
        <div className={`${isVeryCompact ? 'text-xs' : (isCompact ? 'text-sm' : 'text-xl')} font-bold tracking-[0.3em] uppercase`}>TOTAL_PAYABLE_EGP</div>
        <div className={`${isVeryCompact ? 'text-2xl' : (isCompact ? 'text-4xl' : 'text-6xl')} font-bold tracking-tighter`}>{invoice.total.toLocaleString()}</div>
      </div>
    );

    const editorialTotal = (
      <div className={`border-y-4 border-slate-900 ${isVeryCompact ? 'py-3' : (isCompact ? 'py-6' : 'py-10')} flex justify-between items-center w-full`}>
        <div className={`${isVeryCompact ? 'text-xl' : (isCompact ? 'text-2xl' : 'text-4xl')} font-black tracking-tighter uppercase italic`}>Total</div>
        <div className={`${isVeryCompact ? 'text-4xl' : (isCompact ? 'text-6xl' : 'text-8xl')} font-black tracking-tighter`}>{invoice.total.toLocaleString()}</div>
      </div>
    );

    const organicTotal = (
      <div className={`bg-[#4a5d4e] text-white ${isVeryCompact ? 'p-3' : (isCompact ? 'p-6' : 'p-10')} rounded-[2.5rem] flex justify-between items-center w-full shadow-xl shadow-[#4a5d4e]/20`}>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-60 mb-1">Total Balance</div>
          <div className="text-xs font-medium opacity-40 italic">Egyptian Pounds</div>
        </div>
        <div className={`${isVeryCompact ? 'text-2xl' : (isCompact ? 'text-4xl' : 'text-6xl')} font-bold tracking-tighter`}>
          {invoice.total.toLocaleString()}
        </div>
      </div>
    );

    const atmosphericTotal = (
      <div className={`bg-white/10 backdrop-blur-2xl border border-white/20 ${isVeryCompact ? 'p-3' : (isCompact ? 'p-6' : 'p-10')} rounded-[2rem] flex justify-between items-center w-full`}>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/60 mb-2">Total Due</div>
          <div className="text-sm font-medium text-white/40 italic">EGP Currency</div>
        </div>
        <div className={`${isVeryCompact ? 'text-3xl' : (isCompact ? 'text-5xl' : 'text-7xl')} font-black tracking-tighter text-white`}>
          {invoice.total.toLocaleString()}
        </div>
      </div>
    );

    const utilityTotal = (
      <div className={`bg-slate-900 text-white ${isVeryCompact ? 'p-2' : (isCompact ? 'p-4' : 'p-8')} rounded-xl flex justify-between items-center w-full`}>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Total Amount</div>
          <div className="text-xs font-medium opacity-30 italic">All values in EGP</div>
        </div>
        <div className={`${isVeryCompact ? 'text-2xl' : (isCompact ? 'text-3xl' : 'text-5xl')} font-bold tracking-tight`}>
          {invoice.total.toLocaleString()}
        </div>
      </div>
    );

    const oversizedTotal = (
      <div className={`border-y-[12px] border-slate-900 ${isVeryCompact ? 'py-3' : (isCompact ? 'py-6' : 'py-12')} flex justify-between items-center w-full`}>
        <div className={`${isVeryCompact ? 'text-xl' : (isCompact ? 'text-2xl' : 'text-4xl')} font-black uppercase tracking-widest`}>Total</div>
        <div className={`${isVeryCompact ? 'text-4xl' : (isCompact ? 'text-7xl' : 'text-9xl')} font-black tracking-tighter leading-none`}>{invoice.total.toLocaleString()}</div>
      </div>
    );

    const boldColorTotal = (
      <div className={`border-4 border-white ${isVeryCompact ? 'p-3' : (isCompact ? 'p-6' : 'p-10')} flex justify-between items-center w-full bg-black/20`}>
        <div className={`${isVeryCompact ? 'text-lg' : (isCompact ? 'text-xl' : 'text-3xl')} font-black uppercase tracking-widest italic`}>Total</div>
        <div className={`${isVeryCompact ? 'text-4xl' : (isCompact ? 'text-6xl' : 'text-8xl')} font-black tracking-tighter`}>{invoice.total.toLocaleString()}</div>
      </div>
    );

    const splitTotal = (
      <div className={`bg-blue-600 text-white ${isVeryCompact ? 'p-3' : (isCompact ? 'p-6' : 'p-12')} flex justify-between items-center w-full`}>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/60 mb-2">Total Payable</div>
          <div className="text-sm font-medium text-white/40 italic">Egyptian Pounds</div>
        </div>
        <div className={`${isVeryCompact ? 'text-3xl' : (isCompact ? 'text-5xl' : 'text-7xl')} font-black tracking-tighter`}>
          {invoice.total.toLocaleString()}
        </div>
      </div>
    );

    const taglineSection = (
      <div className={`${isVeryCompact ? 'mt-4' : 'mt-8'} pt-4 border-t border-slate-100 shrink-0 no-break`}>
        <DaliSignature tone={isDark ? 'dark' : 'light'} variant="paper" />
      </div>
    );

    switch (theme) {
      case 'minimal':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-2' : (isCompact ? 'pt-4' : 'pt-8')} border-t border-slate-100 flex flex-col`}>
            <div className={`flex justify-between items-center ${isVeryCompact ? 'mb-2' : (isCompact ? 'mb-4' : 'mb-8')}`}>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Due</div>
                <div className={`${isVeryCompact ? 'text-lg' : (isCompact ? 'text-xl' : 'text-3xl')} font-bold text-slate-900`}>{invoice.total.toLocaleString()} EGP</div>
              </div>
              <div className="max-w-xs text-right">
                {settlementSection}
              </div>
            </div>
            {authAndSignature}
            {taglineSection}
          </div>
        );
      case 'corporate':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-2' : (isCompact ? 'pt-4' : 'pt-8')} flex flex-col`}>
            <div className={`bg-blue-900 text-white ${isVeryCompact ? 'p-2 mb-2' : (isCompact ? 'p-4 mb-4' : 'p-8 mb-8')} flex justify-between items-center rounded-lg`}>
              <div className={`${isVeryCompact ? 'text-xs' : (isCompact ? 'text-sm' : 'text-xl')} font-bold uppercase tracking-widest`}>Total Amount Payable</div>
              <div className={`${isVeryCompact ? 'text-xl' : (isCompact ? 'text-2xl' : 'text-5xl')} font-bold`}>{invoice.total.toLocaleString()} <span className={`${isVeryCompact ? 'text-[10px]' : (isCompact ? 'text-xs' : 'text-lg')} opacity-50`}>EGP</span></div>
            </div>
            <div className={`grid grid-cols-2 ${isVeryCompact ? 'gap-4' : (isCompact ? 'gap-6' : 'gap-12')} items-end`}>
              {settlementSection}
              {authAndSignature}
            </div>
            {taglineSection}
          </div>
        );
      case 'elegant':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-3' : (isCompact ? 'pt-6' : 'pt-12')} flex flex-col`}>
            <div className={`flex justify-between items-center ${isVeryCompact ? 'mb-3 py-2' : (isCompact ? 'mb-6 py-4' : 'mb-12 py-8')} border-y border-[#2d241e]/10`}>
              <div className={`${isVeryCompact ? 'text-xs' : (isCompact ? 'text-sm' : 'text-xl')} font-light tracking-widest uppercase text-[#2d241e]`}>Total Balance Due</div>
              <div className={`${isVeryCompact ? 'text-2xl' : (isCompact ? 'text-3xl' : 'text-6xl')} font-light text-[#2d241e] tracking-tighter`}>{invoice.total.toLocaleString()}</div>
            </div>
            <div className={`grid grid-cols-2 ${isVeryCompact ? 'gap-4' : (isCompact ? 'gap-6' : 'gap-12')} items-end`}>
              <div className={`${isVeryCompact ? 'space-y-2' : (isCompact ? 'space-y-4' : 'space-y-8')}`}>
                {settlementSection}
                <div className="text-[10px] font-medium text-[#2d241e]/30 uppercase tracking-[0.4em]">Prestige Logistics Division</div>
              </div>
              {authAndSignature}
            </div>
            {taglineSection}
          </div>
        );
      case 'bold':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-3' : (isCompact ? 'pt-6' : 'pt-12')} flex flex-col`}>
            <div className={`bg-black text-white ${isVeryCompact ? 'p-3 mb-3' : (isCompact ? 'p-6 mb-6' : 'p-10 mb-10')} flex justify-between items-center`}>
              <div className={`${isVeryCompact ? 'text-lg' : (isCompact ? 'text-xl' : 'text-3xl')} font-black uppercase tracking-tighter`}>Total_Payable</div>
              <div className={`${isVeryCompact ? 'text-3xl' : (isCompact ? 'text-4xl' : 'text-7xl')} font-black tracking-tighter`}>{invoice.total.toLocaleString()}</div>
            </div>
            <div className={`grid grid-cols-2 ${isVeryCompact ? 'gap-4' : (isCompact ? 'gap-6' : 'gap-12')} items-end`}>
              <div className={`${isVeryCompact ? 'space-y-2' : (isCompact ? 'space-y-4' : 'space-y-8')}`}>
                <div className={`${isVeryCompact ? 'p-2' : (isCompact ? 'p-3' : 'p-6')} border-4 border-black font-black text-xs uppercase leading-relaxed`}>
                  {settlementText}
                </div>
                {authAndSignature}
              </div>
              <div className="text-right opacity-10">
                <div className={`${isVeryCompact ? 'text-xl' : (isCompact ? 'text-2xl' : 'text-5xl')} font-black uppercase tracking-tighter rotate-90 origin-right`}>Original</div>
              </div>
            </div>
            {taglineSection}
          </div>
        );
      case 'dark':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-4' : 'pt-10'} flex flex-col`}>
            <div className={`bg-slate-800 ${isVeryCompact ? 'p-2 mb-2' : (isCompact ? 'p-4 mb-4' : 'p-8 mb-8')} rounded-2xl flex justify-between items-center border border-slate-700 shadow-2xl`}>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Due</div>
                <div className="text-sm text-slate-400 italic">Egyptian Pounds</div>
              </div>
              <div className={`${isVeryCompact ? 'text-2xl' : (isCompact ? 'text-3xl' : 'text-5xl')} font-black text-white tracking-tighter`}>{invoice.total.toLocaleString()}</div>
            </div>
            <div className={`grid grid-cols-2 ${isVeryCompact ? 'gap-4' : (isCompact ? 'gap-6' : 'gap-12')} items-end`}>
              <div className={`${isVeryCompact ? 'space-y-2' : (isCompact ? 'space-y-4' : 'space-y-8')}`}>
                {settlementSection}
                {authAndSignature}
              </div>
              <div className="text-right opacity-20">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.5em]">Secure Dark Mode Auth</div>
              </div>
            </div>
            {taglineSection}
          </div>
        );
      case 'soft':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-4' : 'pt-8'} flex flex-col`}>
            <div className={isVeryCompact ? 'mb-2' : (isCompact ? 'mb-4' : 'mb-8')}>
               <div className={`bg-indigo-600 text-white ${isVeryCompact ? 'p-2' : (isCompact ? 'p-4' : 'p-8')} rounded-[2rem] flex justify-between items-center w-full shadow-xl shadow-indigo-600/20`}>
                  <div>
                     <div className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40 mb-0.5">Total Balance</div>
                     <div className="text-[10px] font-bold italic opacity-60">Egyptian Pounds</div>
                  </div>
                  <div className={`${isVeryCompact ? 'text-2xl' : (isCompact ? 'text-3xl' : 'text-5xl')} font-black tabular-nums tracking-tighter`}>
                     {invoice.total.toLocaleString()}
                  </div>
               </div>
            </div>
            <div className={`grid grid-cols-1 md:grid-cols-2 ${isVeryCompact ? 'gap-2' : (isCompact ? 'gap-4' : 'gap-8')} items-end`}>
               <div className={`${isVeryCompact ? 'space-y-2' : (isCompact ? 'space-y-4' : 'space-y-6')}`}>
                  <div className={`${isVeryCompact ? 'p-2' : (isCompact ? 'p-4' : 'p-6')} bg-white border border-indigo-50 rounded-[2rem] text-[10.5px] leading-relaxed text-slate-500 font-medium`}>
                     {settlementText}
                  </div>
                  {authAndSignature}
               </div>
               <div className="text-right opacity-20">
                  <div className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.5em]">Soft UI Verified</div>
               </div>
            </div>
            {taglineSection}
          </div>
        );
      case 'grid':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-2' : (isCompact ? 'pt-4' : 'pt-8')} flex flex-col`}>
            <div className={`border-2 border-slate-200 ${isVeryCompact ? 'p-2 mb-2' : (isCompact ? 'p-4 mb-4' : 'p-8 mb-8')} flex justify-between items-center bg-slate-50`}>
              <div className={`${isVeryCompact ? 'text-xs' : (isCompact ? 'text-sm' : 'text-xl')} font-bold uppercase tracking-widest`}>Total_Due_EGP</div>
              <div className={`${isVeryCompact ? 'text-2xl' : (isCompact ? 'text-3xl' : 'text-6xl')} font-bold tracking-tighter`}>{invoice.total.toLocaleString()}</div>
            </div>
            <div className={`grid grid-cols-2 ${isVeryCompact ? 'gap-2' : (isCompact ? 'gap-4' : 'gap-8')} items-end`}>
              <div className={`${isVeryCompact ? 'space-y-2' : (isCompact ? 'space-y-3' : 'space-y-6')}`}>
                <div className={`${isVeryCompact ? 'p-2' : (isCompact ? 'p-3' : 'p-6')} border-2 border-slate-200 font-mono text-[10px] leading-relaxed`}>
                  {settlementText}
                </div>
                {authAndSignature}
              </div>
              <div className="text-right opacity-10">
                <div className={`${isVeryCompact ? 'text-lg' : (isCompact ? 'text-xl' : 'text-4xl')} font-bold uppercase tracking-widest`}>Verified_Data</div>
              </div>
            </div>
            {taglineSection}
          </div>
        );
      case 'classic':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-3' : (isCompact ? 'pt-6' : 'pt-12')} flex flex-col`}>
            <div className={`border-y-2 border-slate-200 ${isVeryCompact ? 'py-2 mb-3' : (isCompact ? 'py-4 mb-6' : 'py-8 mb-10')} flex justify-between items-center`}>
              <div className={`${isVeryCompact ? 'text-base' : (isCompact ? 'text-lg' : 'text-2xl')} font-serif font-bold uppercase tracking-tight`}>Total Amount Due:</div>
              <div className={`${isVeryCompact ? 'text-2xl' : (isCompact ? 'text-3xl' : 'text-6xl')} font-serif font-bold text-slate-900 tracking-tighter`}>{invoice.total.toLocaleString()} EGP</div>
            </div>
            <div className={`grid grid-cols-2 ${isVeryCompact ? 'gap-4' : (isCompact ? 'gap-6' : 'gap-12')} items-end`}>
              <div className={`${isVeryCompact ? 'space-y-2' : (isCompact ? 'space-y-4' : 'space-y-8')}`}>
                {settlementSection}
                {authAndSignature}
              </div>
              <div className="text-right opacity-20">
                <div className="text-[10px] font-serif font-bold uppercase tracking-widest">Official Nile Fleet Document</div>
              </div>
            </div>
            {taglineSection}
          </div>
        );
      case 'compact':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-2' : 'pt-6'} flex flex-col border-t border-slate-100`}>
            <div className={`flex justify-between items-center ${isVeryCompact ? 'mb-2' : 'mb-6'} px-2`}>
              <div className="text-sm font-bold uppercase tracking-widest text-slate-400">Total Due</div>
              <div className={`${isVeryCompact ? 'text-xl' : 'text-3xl'} font-bold text-slate-900`}>{invoice.total.toLocaleString()} EGP</div>
            </div>
            <div className={`grid grid-cols-2 ${isVeryCompact ? 'gap-4' : 'gap-6'} items-end`}>
              <div className="text-[9px] leading-relaxed text-slate-400 italic">
                {settlementText}
              </div>
              <div className={`${isVeryCompact ? 'scale-50' : 'scale-75'} origin-bottom-right`}>
                {authAndSignature}
              </div>
            </div>
            {taglineSection}
          </div>
        );
      case 'modern-serif':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-2' : (isCompact ? 'pt-4' : 'pt-8')} border-t border-slate-100 flex flex-col`}>
             <div className={isVeryCompact ? 'mb-2' : (isCompact ? 'mb-4' : 'mb-8')}>
                {totalSection}
             </div>
             <div className={`grid grid-cols-1 md:grid-cols-2 ${isVeryCompact ? 'gap-2' : (isCompact ? 'gap-4' : 'gap-8')} items-end`}>
                <div className={`${isVeryCompact ? 'space-y-2' : (isCompact ? 'space-y-3' : 'space-y-6')}`}>
                   {settlementSection}
                   {authAndSignature}
                </div>
                <div className="text-right pb-2">
                   <div className="text-[9px] font-black opacity-30 uppercase tracking-[0.5em] rotate-180 [writing-mode:vertical-lr]">System Verified</div>
                </div>
             </div>
             {taglineSection}
          </div>
        );
      case 'industrial':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-2' : (isCompact ? 'pt-3' : 'pt-6')} flex flex-col`}>
             <div className={`bg-black text-white ${isVeryCompact ? 'p-1 mb-2' : (isCompact ? 'p-2 mb-3' : 'p-4 mb-6')} flex justify-between items-end border-b-[15px] border-yellow-400`}>
                <div className={`${isVeryCompact ? 'text-base' : (isCompact ? 'text-lg' : 'text-2xl')} font-black leading-none uppercase`}>Total_Due_Payable</div>
                <div className={`${isVeryCompact ? 'text-3xl' : (isCompact ? 'text-4xl' : 'text-6xl')} font-black tracking-tighter leading-none`}>{invoice.total.toLocaleString()}</div>
             </div>
             <div className={`grid grid-cols-1 md:grid-cols-2 ${isVeryCompact ? 'gap-2' : (isCompact ? 'gap-3' : 'gap-6')} items-end`}>
                <div className={`${isVeryCompact ? 'space-y-1' : (isCompact ? 'space-y-2' : 'space-y-3')}`}>
                   <div className={`${isVeryCompact ? 'p-1' : (isCompact ? 'p-2' : 'p-3')} border-4 border-black font-black text-[9px]`}>
                     {settlementText}
                   </div>
                   {authAndSignature}
                </div>
                <div className={`flex justify-end opacity-20 rotate-12 ${isVeryCompact ? '-translate-y-2 scale-50' : (isCompact ? '-translate-y-3 scale-75' : '-translate-y-6')}`}>
                   <div className={`${isVeryCompact ? 'border-[3px] p-1 text-base' : (isCompact ? 'border-[4px] p-1.5 text-lg' : 'border-[8px] border-black p-3 text-2xl')} font-black text-center uppercase leading-none`}>
                     Original<br/>Auth<br/>Nile Fleet
                   </div>
                </div>
             </div>
             {taglineSection}
          </div>
        );
      case 'ledger-pro':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-2' : (isCompact ? 'pt-3' : 'pt-6')} flex flex-col`}>
             <div className={`grid grid-cols-1 md:grid-cols-2 ${isVeryCompact ? 'gap-2 mb-2' : (isCompact ? 'gap-4 mb-4' : 'gap-8 mb-8')} items-stretch`}>
                <div className="flex flex-col justify-center">
                   {settlementSection}
                </div>
                <div className={`bg-slate-900 text-white ${isVeryCompact ? 'p-2' : (isCompact ? 'p-4' : 'p-8')} flex flex-col justify-center`}>
                   <div className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400 mb-1">Net Clearing Amount</div>
                   <div className={`${isVeryCompact ? 'text-2xl' : (isCompact ? 'text-3xl' : 'text-5xl')} font-black tracking-tighter`}>{invoice.total.toLocaleString()} <span className="text-xs font-bold opacity-30">EGP</span></div>
                </div>
             </div>
             <div className={`flex justify-between items-end border-t border-slate-100 ${isVeryCompact ? 'pt-2' : (isCompact ? 'pt-4' : 'pt-8')}`}>
                {authAndSignature}
                <div className="text-right text-[8px] font-black opacity-20 uppercase tracking-[1em] mb-1">Registry #NF9928</div>
             </div>
             {taglineSection}
          </div>
        );
      case 'blueprint':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-2' : (isCompact ? 'pt-4' : 'pt-8')} flex flex-col`}>
            <div className={isVeryCompact ? 'mb-2' : (isCompact ? 'mb-4' : 'mb-8')}>{blueprintTotal}</div>
            <div className={`grid grid-cols-2 ${isVeryCompact ? 'gap-2' : (isCompact ? 'gap-4' : 'gap-8')}`}>
              {settlementSection}
              {authAndSignature}
            </div>
            {taglineSection}
          </div>
        );
      case 'retro':
        return (
          <div className={`mt-auto ${isExtremeCompact ? 'pt-1' : (isVeryCompact ? 'pt-2' : (isCompact ? 'pt-4' : 'pt-8'))} flex flex-col`}>
            <div className={isExtremeCompact ? 'mb-1' : (isVeryCompact ? 'mb-2' : (isCompact ? 'mb-4' : 'mb-8'))}>{retroTotal}</div>
            <div className={`grid grid-cols-2 ${isExtremeCompact ? 'gap-1.5' : (isVeryCompact ? 'gap-3' : (isCompact ? 'gap-6' : 'gap-12'))} items-end`}>
              <div className={`${isExtremeCompact ? 'space-y-1' : (isVeryCompact ? 'space-y-2' : (isCompact ? 'space-y-3' : 'space-y-6'))}`}>
                {settlementSection}
                <div className="text-[10px] font-bold uppercase opacity-30">Certified Document // Nile Fleet</div>
              </div>
              {authAndSignature}
            </div>
            {taglineSection}
          </div>
        );
      case 'minimalist-bold':
      case 'minimalist-dark':
      case 'minimalist-blue':
      case 'minimalist-emerald':
      case 'minimalist-modern':
        return (
          <div className={`mt-auto ${isExtremeCompact ? 'pt-1' : (isVeryCompact ? 'pt-3' : (isCompact ? 'pt-6' : 'pt-12'))} flex flex-col`}>
            <div className={isExtremeCompact ? 'mb-1' : (isVeryCompact ? 'mb-3' : (isCompact ? 'mb-6' : 'mb-12'))}>{minimalistTotal}</div>
            <div className={`grid grid-cols-1 md:grid-cols-2 ${isExtremeCompact ? 'gap-1' : (isVeryCompact ? 'gap-3' : (isCompact ? 'gap-6' : 'gap-12'))} items-end`}>
              {settlementSection}
              {authAndSignature}
            </div>
            {taglineSection}
          </div>
        );
      case 'executive':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-3' : (isCompact ? 'pt-6' : 'pt-12')} flex flex-col`}>
            <div className={isVeryCompact ? 'mb-3' : (isCompact ? 'mb-6' : 'mb-12')}>{executiveTotal}</div>
            <div className={`grid grid-cols-1 md:grid-cols-2 ${isVeryCompact ? 'gap-3' : (isCompact ? 'gap-6' : 'gap-12')} items-end`}>
              <div className={`${isVeryCompact ? 'space-y-2' : (isCompact ? 'space-y-4' : 'space-y-8')}`}>
                {settlementSection}
                <div className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.5em]">Verified Executive Document</div>
              </div>
              {authAndSignature}
            </div>
            {taglineSection}
          </div>
        );
      case 'brutalist':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-3' : (isCompact ? 'pt-6' : 'pt-12')} flex flex-col`}>
            <div className={isVeryCompact ? 'mb-3' : (isCompact ? 'mb-6' : 'mb-12')}>{brutalistTotal}</div>
            <div className={`grid grid-cols-1 md:grid-cols-2 ${isVeryCompact ? 'gap-3' : (isCompact ? 'gap-6' : 'gap-12')} items-end`}>
              <div className={`${isVeryCompact ? 'space-y-2' : (isCompact ? 'space-y-4' : 'space-y-8')}`}>
                <div className={`${isVeryCompact ? 'p-2' : (isCompact ? 'p-3' : 'p-6')} border-[4px] border-black font-black text-xs uppercase leading-relaxed`}>
                  {settlementText}
                </div>
                {authAndSignature}
              </div>
              <div className={`flex justify-end opacity-10 rotate-12 ${isVeryCompact ? 'scale-50' : (isCompact ? 'scale-75' : '')}`}>
                <div className="border-[12px] border-black p-6 text-4xl font-black text-center uppercase leading-none">
                  Verified
                </div>
              </div>
            </div>
            {taglineSection}
          </div>
        );
      case 'luxury':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-4' : (isCompact ? 'pt-8' : 'pt-16')} flex flex-col`}>
            <div className={isVeryCompact ? 'mb-3' : (isCompact ? 'mb-6' : 'mb-12')}>{luxuryTotal}</div>
            <div className={`grid grid-cols-2 ${isVeryCompact ? 'gap-4' : (isCompact ? 'gap-8' : 'gap-16')} items-end`}>
              <div className={`${isVeryCompact ? 'space-y-2' : (isCompact ? 'space-y-4' : 'space-y-8')}`}>
                <div className={`text-[11px] leading-relaxed text-white/40 font-light italic border-l border-[#c5a059]/30 ${isVeryCompact ? 'pl-2' : (isCompact ? 'pl-3' : 'pl-6')}`}>
                  {settlementText}
                </div>
                {authAndSignature}
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-[#c5a059] uppercase tracking-[0.5em] mb-2 opacity-30">Nile Fleet Prestige</div>
              </div>
            </div>
            {taglineSection}
          </div>
        );
      case 'luxury-white':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-4' : (isCompact ? 'pt-8' : 'pt-16')} flex flex-col`}>
            <div className={isVeryCompact ? 'mb-3' : (isCompact ? 'mb-6' : 'mb-12')}>{luxuryWhiteTotal}</div>
            <div className={`grid grid-cols-2 ${isVeryCompact ? 'gap-4' : (isCompact ? 'gap-8' : 'gap-16')} items-end`}>
              <div className={`${isVeryCompact ? 'space-y-2' : (isCompact ? 'space-y-4' : 'space-y-8')}`}>
                <div className={`text-[11px] leading-relaxed text-slate-400 font-light italic border-l border-[#c5a059]/30 ${isVeryCompact ? 'pl-2' : (isCompact ? 'pl-3' : 'pl-6')}`}>
                  {settlementText}
                </div>
                {authAndSignature}
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-[#c5a059] uppercase tracking-[0.5em] mb-2 opacity-30">Nile Fleet</div>
              </div>
            </div>
            {taglineSection}
          </div>
        );
      case 'tech':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-3' : (isCompact ? 'pt-6' : 'pt-12')} flex flex-col`}>
            <div className={isVeryCompact ? 'mb-3' : (isCompact ? 'mb-6' : 'mb-12')}>{techTotal}</div>
            <div className={`grid grid-cols-2 ${isVeryCompact ? 'gap-2' : (isCompact ? 'gap-4' : 'gap-8')} items-end`}>
              <div className={`${isVeryCompact ? 'space-y-2' : (isCompact ? 'space-y-3' : 'space-y-6')}`}>
                <div className={`${isVeryCompact ? 'p-1' : (isCompact ? 'p-2' : 'p-4')} bg-[#00ff41]/5 border border-[#00ff41]/20 font-mono text-[10px] leading-relaxed`}>
                  {'>'} {settlementText}
                </div>
                {authAndSignature}
              </div>
              <div className="text-right opacity-20">
                <div className="text-[10px] font-bold uppercase tracking-widest">SYSTEM_VERSION: 4.2.0</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#00ff41]">ENCRYPTED_AUTH</div>
              </div>
            </div>
            {taglineSection}
          </div>
        );
      case 'editorial':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-4' : (isCompact ? 'pt-8' : 'pt-16')} flex flex-col`}>
            <div className={isVeryCompact ? 'mb-4' : (isCompact ? 'mb-8' : 'mb-16')}>{editorialTotal}</div>
            <div className={`grid grid-cols-12 ${isVeryCompact ? 'gap-4' : (isCompact ? 'gap-6' : 'gap-12')} items-end`}>
              <div className="col-span-7 space-y-10">
                <div className={`text-sm leading-relaxed text-slate-500 font-medium border-t-2 border-slate-100 ${isVeryCompact ? 'pt-2' : (isCompact ? 'pt-4' : 'pt-8')}`}>
                  {settlementText}
                </div>
                {authAndSignature}
              </div>
              <div className="col-span-5 text-right">
                <div className="text-[10px] font-black uppercase tracking-[0.8em] text-slate-200 rotate-90 origin-right translate-y-[-100%]">Official Document</div>
              </div>
            </div>
            {taglineSection}
          </div>
        );
      case 'organic':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-3' : (isCompact ? 'pt-6' : 'pt-12')} flex flex-col ${isVeryCompact ? 'px-2' : (isCompact ? 'px-4' : 'px-10')}`}>
            <div className={isVeryCompact ? 'mb-3' : (isCompact ? 'mb-6' : 'mb-12')}>{organicTotal}</div>
            <div className={`grid grid-cols-1 md:grid-cols-2 ${isVeryCompact ? 'gap-3' : (isCompact ? 'gap-6' : 'gap-12')} items-end`}>
              <div className={`${isVeryCompact ? 'space-y-2' : (isCompact ? 'space-y-4' : 'space-y-8')}`}>
                <div className={`${isVeryCompact ? 'p-2' : (isCompact ? 'p-4' : 'p-8')} bg-[#f4f7f5] rounded-[2rem] text-[11px] leading-relaxed text-[#7a8c7e] font-medium`}>
                  {settlementText}
                </div>
                {authAndSignature}
              </div>
              <div className="text-right opacity-20">
                <div className="text-[10px] font-bold text-[#b0bcaf] uppercase tracking-[0.5em]">Natural Logistics</div>
              </div>
            </div>
            {taglineSection}
          </div>
        );
      case 'atmospheric':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-3' : (isCompact ? 'pt-6' : 'pt-12')} flex flex-col`}>
            <div className={isVeryCompact ? 'mb-3' : (isCompact ? 'mb-6' : 'mb-12')}>{atmosphericTotal}</div>
            <div className={`grid grid-cols-1 md:grid-cols-2 ${isVeryCompact ? 'gap-3' : (isCompact ? 'gap-6' : 'gap-12')} items-end`}>
              <div className={`${isVeryCompact ? 'space-y-2' : (isCompact ? 'space-y-4' : 'space-y-8')}`}>
                <div className={`${isVeryCompact ? 'p-2' : (isCompact ? 'p-4' : 'p-8')} bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] text-[11px] leading-relaxed text-white/60 font-medium`}>
                  {settlementText}
                </div>
                {authAndSignature}
              </div>
              <div className="text-right opacity-20">
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-[0.5em]">Cloud Verified</div>
              </div>
            </div>
            {taglineSection}
          </div>
        );
      case 'clean-utility':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-3' : (isCompact ? 'pt-6' : 'pt-12')} flex flex-col`}>
            <div className={isVeryCompact ? 'mb-3' : (isCompact ? 'mb-6' : 'mb-12')}>{utilityTotal}</div>
            <div className={`grid grid-cols-1 md:grid-cols-2 ${isVeryCompact ? 'gap-3' : (isCompact ? 'gap-6' : 'gap-12')} items-end`}>
              <div className={`${isVeryCompact ? 'space-y-2' : (isCompact ? 'space-y-3' : 'space-y-6')}`}>
                <div className={`${isVeryCompact ? 'p-2' : (isCompact ? 'p-3' : 'p-6')} bg-white border border-slate-200 rounded-xl text-[11px] leading-relaxed text-slate-500`}>
                  {settlementText}
                </div>
                {authAndSignature}
              </div>
              <div className="text-right opacity-20">
                <div className="text-[10px] font-bold uppercase tracking-widest">Standard Utility Document</div>
              </div>
            </div>
            {taglineSection}
          </div>
        );
      case 'oversized':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-5' : (isCompact ? 'pt-10' : 'pt-20')} flex flex-col`}>
            <div className={isVeryCompact ? 'mb-5' : (isCompact ? 'mb-10' : 'mb-20')}>{oversizedTotal}</div>
            <div className={`grid grid-cols-1 md:grid-cols-2 ${isVeryCompact ? 'gap-5' : (isCompact ? 'gap-10' : 'gap-20')} items-end`}>
              <div className={`${isVeryCompact ? 'space-y-3' : (isCompact ? 'space-y-6' : 'space-y-12')}`}>
                <div className={`text-sm leading-relaxed text-slate-400 font-black uppercase tracking-widest border-l-8 border-blue-600 ${isVeryCompact ? 'pl-2' : (isCompact ? 'pl-4' : 'pl-8')}`}>
                  {settlementText}
                </div>
                {authAndSignature}
              </div>
              <div className="text-right opacity-10">
                <div className={`${isVeryCompact ? 'text-xl' : (isCompact ? 'text-2xl' : 'text-4xl')} font-black uppercase tracking-tighter`}>Verified</div>
              </div>
            </div>
            {taglineSection}
          </div>
        );
      case 'bold-color':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-3' : (isCompact ? 'pt-6' : 'pt-12')} flex flex-col`}>
            <div className={isVeryCompact ? 'mb-3' : (isCompact ? 'mb-6' : 'mb-12')}>{boldColorTotal}</div>
            <div className={`grid grid-cols-1 md:grid-cols-2 ${isVeryCompact ? 'gap-3' : (isCompact ? 'gap-6' : 'gap-12')} items-end`}>
              <div className={`${isVeryCompact ? 'space-y-2' : (isCompact ? 'space-y-4' : 'space-y-8')}`}>
                <div className={`${isVeryCompact ? 'p-2' : (isCompact ? 'p-4' : 'p-8')} border-4 border-white text-sm leading-relaxed text-white font-bold italic`}>
                  {settlementText}
                </div>
                {authAndSignature}
              </div>
              <div className="text-right opacity-30">
                <div className="text-[10px] font-bold text-white uppercase tracking-[0.8em] rotate-90 origin-right">Nile Fleet Bold</div>
              </div>
            </div>
            {taglineSection}
          </div>
        );
      case 'split-layout':
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-3' : (isCompact ? 'pt-6' : 'pt-12')} flex flex-col`}>
            <div className={isVeryCompact ? 'mb-3' : (isCompact ? 'mb-6' : 'mb-12')}>{splitTotal}</div>
            <div className={`grid grid-cols-1 md:grid-cols-2 ${isVeryCompact ? 'gap-3 px-3 pb-3' : (isCompact ? 'gap-6 px-6 pb-6' : 'gap-12 px-12 pb-12')} items-end`}>
              <div className={`${isVeryCompact ? 'space-y-2' : (isCompact ? 'space-y-4' : 'space-y-8')}`}>
                <div className={`${isVeryCompact ? 'p-2' : (isCompact ? 'p-4' : 'p-8')} bg-slate-50 border border-slate-100 rounded-2xl text-[11px] leading-relaxed text-slate-500`}>
                  {settlementText}
                </div>
                {authAndSignature}
              </div>
              <div className="text-right opacity-20">
                <div className="text-[10px] font-bold uppercase tracking-widest">Split Division Document</div>
              </div>
            </div>
            {taglineSection}
          </div>
        );
      default:
        return (
          <div className={`mt-auto ${isVeryCompact ? 'pt-2' : (isCompact ? 'pt-4' : 'pt-8')} border-t-2 border-slate-100 flex flex-col`}>
             <div className={`flex flex-col ${isVeryCompact ? 'gap-2' : (isCompact ? 'gap-4' : 'gap-8')}`}>
                <div className={`flex justify-between items-center w-full bg-slate-50 ${isVeryCompact ? 'p-2' : (isCompact ? 'p-3' : 'p-6')} rounded-2xl border border-slate-100`}>
                   <div>
                     <div className="text-[9px] font-black uppercase text-slate-400 mb-0.5">Total Due Amount</div>
                     <div className={`${isVeryCompact ? 'text-xl' : (isCompact ? 'text-2xl' : 'text-4xl')} font-black text-slate-900 tracking-tighter`}>{invoice.total.toLocaleString()} EGP</div>
                   </div>
                   <div className="max-w-xs text-right">
                      {settlementSection}
                   </div>
                </div>
                <div className="flex justify-between items-end">
                   {authAndSignature}
                </div>
             </div>
             {taglineSection}
          </div>
        );
    }
  };

  return (
    <div 
      className={`invoice-container relative shadow-2xl print:shadow-none print:mb-0 print:py-12 transition-all duration-700 ${getThemeBaseStyles()}`}
    >
      {/* Background Watermark */}
      {company.watermark && (
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"
          style={{ 
            opacity: company.watermarkOpacity ?? 0.03,
            transform: `translate(-50%, -50%) rotate(${company.watermarkRotation ?? 12}deg) scale(${company.watermarkScale ?? 1.2})`
          }}
        >
          <img src={company.watermark} className={`w-[140mm] h-auto grayscale ${isDark ? 'invert' : ''}`} />
        </div>
      )}

      <div className="render-header">{renderHeader()}</div>
      <div className="render-bill-to">{renderBillTo()}</div>
      <div className="render-statement-summary">{renderStatementSummary()}</div>
      <div className="min-h-0 print:block">
        {renderTable()}
      </div>
      <div className="mt-auto shrink-0 print:mt-12 print:block">
        {renderFooter()}
      </div>

      {/* Decorative Overlays */}
      {theme === 'grid' && (
        <div className="absolute inset-0 pointer-events-none opacity-[0.05]" 
             style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      )}
      
      {/* Authority Stamp */}
      {(theme === 'industrial' || theme === 'ledger-pro') && (
        <div className="absolute bottom-20 right-8 opacity-5 pointer-events-none rotate-[15deg]">
           <div className="border-[8px] border-black p-4 text-xl font-black text-center uppercase leading-none">
              System<br/>Verified<br/>Logistics
           </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceRenderer;