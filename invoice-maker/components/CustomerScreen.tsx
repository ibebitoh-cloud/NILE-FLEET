
import React, { useState } from 'react';
import { 
  Settings, 
  Hash, 
  CalendarClock, 
  Type, 
  Search, 
  User, 
  ChevronRight,
  Info,
  ShieldCheck
} from 'lucide-react';
import { CustomerSettings } from '../types';

interface Props {
  settings: Record<string, CustomerSettings>;
  onUpdate: (name: string, settings: CustomerSettings) => void;
  globalSerialStart: string;
  globalSerialPrefix: string;
  isGlobalMode: boolean;
  onApplyGlobalSerial: (start: string, prefix: string) => void;
  onToggleGlobalMode: () => void;
}

const CustomerScreen: React.FC<Props> = ({ settings, onUpdate, globalSerialStart, globalSerialPrefix, isGlobalMode, onApplyGlobalSerial, onToggleGlobalMode }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [localGlobalSerial, setLocalGlobalSerial] = useState(globalSerialStart);
  const [localGlobalPrefix, setLocalGlobalPrefix] = useState(globalSerialPrefix);
  const customerList: CustomerSettings[] = Object.values(settings);
  
  const filteredCustomers = customerList.filter((c: CustomerSettings) => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-slate-200 pb-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-[0.3em]">
            <ShieldCheck className="w-4 h-4" />
            <span>Billing Control Layer</span>
          </div>
          <h2 className="text-5xl font-black tracking-tighter text-slate-900 uppercase">Customer Profiles</h2>
          <p className="text-slate-400 font-medium text-sm max-w-md">
            Defining unique invoice numbering and payment terms for the logistics network nodes.
          </p>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
          <input 
            type="text" 
            placeholder="FILTER NODES..." 
            className="pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl w-full md:w-80 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none shadow-sm transition-all text-[10px] font-black tracking-widest uppercase"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
        <div className="bg-white p-8 border border-slate-200 hover:bg-slate-900 hover:text-white transition-all duration-300 group">
          <div className="flex items-center justify-between mb-8">
            <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-white/10 transition-colors">
              <User className="w-6 h-6 text-slate-900 group-hover:text-white" />
            </div>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Clients</p>
          <h3 className="text-3xl font-black tracking-tighter font-mono">{customerList.length} <span className="text-sm opacity-40">Nodes</span></h3>
        </div>

        <div className="bg-white p-8 border border-slate-200 hover:bg-slate-900 hover:text-white transition-all duration-300 group">
          <div className="flex items-center justify-between mb-8">
            <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-white/10 transition-colors">
              <Hash className="w-6 h-6 text-slate-900 group-hover:text-white" />
            </div>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Unique Prefixes</p>
          <h3 className="text-3xl font-black tracking-tighter font-mono">
            {new Set(customerList.map((c: CustomerSettings) => c.serialPrefix)).size} <span className="text-sm opacity-40">Keys</span>
          </h3>
        </div>

        <div className="bg-white p-8 border border-slate-200 hover:bg-slate-900 hover:text-white transition-all duration-300 group">
          <div className="flex items-center justify-between mb-8">
            <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-white/10 transition-colors">
              <CalendarClock className="w-6 h-6 text-slate-900 group-hover:text-white" />
            </div>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Avg. Due Days</p>
          <h3 className="text-3xl font-black tracking-tighter font-mono">
            {Math.round(customerList.reduce((acc: number, c: CustomerSettings) => acc + c.dueDateDays, 0) / (customerList.length || 1))} <span className="text-sm opacity-40">Cycle</span>
          </h3>
        </div>
      </div>


      {/* Global Serial Numbering Section */}
      <div className={`p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden transition-all duration-700 group ${isGlobalMode ? 'bg-indigo-600 text-white shadow-indigo-600/20' : 'bg-slate-900 text-white shadow-slate-900/20'}`}>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="space-y-6 max-w-xl">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] ${isGlobalMode ? 'bg-white/20 text-white' : 'bg-indigo-500/20 text-indigo-400'}`}>
              <Hash className="w-4 h-4" />
              <span>{isGlobalMode ? 'Global Protocol Active' : 'Global Sequencing'}</span>
            </div>
            <h3 className="text-4xl font-black tracking-tighter uppercase">Global Invoice Numbering</h3>
            <p className={`${isGlobalMode ? 'text-indigo-50' : 'text-slate-400'} font-medium text-lg leading-relaxed`}>
              {isGlobalMode 
                ? "The system is currently using a single sequential numbering sequence for all network nodes. New bookings will automatically follow this master order."
                : "Override all individual customer prefixes and starting numbers. This will assign a continuous sequential number to every booking in the system."}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch gap-6 w-full lg:w-auto">
            <div className="relative">
              <input 
                type="text" 
                value={localGlobalPrefix}
                onChange={(e) => setLocalGlobalPrefix(e.target.value)}
                className={`w-full sm:w-36 px-8 py-5 border rounded-2xl outline-none font-black text-2xl transition-all placeholder:text-white/20 ${isGlobalMode ? 'bg-white/20 border-white/30 text-white focus:ring-white/20' : 'bg-white/10 border-white/20 text-white focus:ring-indigo-500/20 focus:border-indigo-500'}`}
                placeholder="INV-"
              />
              <div className={`absolute -top-3 left-6 px-2 text-[9px] font-black uppercase tracking-[0.2em] ${isGlobalMode ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-indigo-400'}`}>Prefix</div>
            </div>
            <div className="relative">
              <input 
                type="number" 
                value={localGlobalSerial}
                onChange={(e) => setLocalGlobalSerial(e.target.value)}
                className={`w-full sm:w-44 px-8 py-5 border rounded-2xl outline-none font-black text-2xl transition-all placeholder:text-white/20 ${isGlobalMode ? 'bg-white/20 border-white/30 text-white focus:ring-white/20' : 'bg-white/10 border-white/20 text-white focus:ring-indigo-500/20 focus:border-indigo-500'}`}
                placeholder="1001"
              />
              <div className={`absolute -top-3 left-6 px-2 text-[9px] font-black uppercase tracking-[0.2em] ${isGlobalMode ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-indigo-400'}`}>Start From</div>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => onApplyGlobalSerial(localGlobalSerial, localGlobalPrefix)}
                className={`px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${isGlobalMode ? 'bg-white text-indigo-600 hover:bg-indigo-50' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'}`}
              >
                <ShieldCheck className="w-5 h-5" />
                {isGlobalMode ? 'Update Sequence' : 'Apply Global Serial'}
              </button>
              {isGlobalMode && (
                <button 
                  onClick={onToggleGlobalMode}
                  className="text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-colors text-center"
                >
                  Switch back to Customer Prefixes
                </button>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* Customer List */}
      <div className="grid grid-cols-1 gap-1">
        {filteredCustomers.map((customer: CustomerSettings) => (
          <div 
            key={customer.name} 
            className="group bg-white border border-slate-200 hover:bg-slate-50 transition-all duration-300 overflow-hidden"
          >
            <div className="flex flex-col lg:flex-row">
              {/* Left Side: Identity */}
              <div className="p-10 lg:w-1/3 border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col justify-between bg-slate-50/30">
                <div className="flex items-start justify-between">
                  <div className="space-y-6">
                    <div className="w-20 h-20 bg-white border border-slate-200 rounded-3xl shadow-sm flex items-center justify-center text-3xl font-black text-indigo-600 group-hover:scale-110 transition-transform duration-500">
                      {customer.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-2">{customer.name}</h3>
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Active Node
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-10 p-6 bg-white rounded-2xl border border-slate-100 space-y-3">
                   <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">
                      <Info className="w-3 h-3" />
                      <span>Sequence Preview</span>
                   </div>
                   <div className="text-xs font-medium text-slate-500 leading-relaxed">
                      Invoices for this client will follow the pattern: <span className="font-black text-slate-900 font-mono tracking-tighter">{customer.serialPrefix}{customer.startingSerial}</span>
                   </div>
                </div>
              </div>

              {/* Right Side: Inputs */}
              <div className="p-10 flex-1 grid grid-cols-1 md:grid-cols-3 gap-10">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                    <Type className="w-3 h-3" />
                    <span>Serial Prefix</span>
                  </div>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={customer.serialPrefix}
                      onChange={(e) => onUpdate(customer.name, { ...customer, serialPrefix: e.target.value })}
                      className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none font-black text-slate-900 transition-all font-mono text-lg uppercase tracking-tighter"
                      placeholder="e.g. INV-2026-"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Appears before the number</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                    <Hash className="w-3 h-3" />
                    <span>Starting Number</span>
                  </div>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={customer.startingSerial}
                      onChange={(e) => onUpdate(customer.name, { ...customer, startingSerial: parseInt(e.target.value) || 1 })}
                      className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none font-black text-slate-900 transition-all font-mono text-lg tracking-tighter"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">First invoice serial</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                    <CalendarClock className="w-3 h-3" />
                    <span>Payment Terms</span>
                  </div>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={customer.dueDateDays}
                      onChange={(e) => onUpdate(customer.name, { ...customer, dueDateDays: parseInt(e.target.value) || 0 })}
                      className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none font-black text-slate-900 transition-all font-mono text-lg tracking-tighter"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Days</div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Days until due</p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredCustomers.length === 0 && (
          <div className="py-32 text-center space-y-6 bg-white border border-dashed border-slate-300 rounded-[2.5rem]">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
              <Search className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">No nodes found</h3>
              <p className="text-slate-400 font-medium">Try adjusting your search protocol filter</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default CustomerScreen;
