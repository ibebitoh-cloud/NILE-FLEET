
import React, { useState, useMemo, useContext, useEffect, useRef } from 'react';
import { db } from '../services/supabaseDb';
import { Operation, Location, GensetStatus, UserRole, User, CustomerPrice, Invoice, hasReadOnlyAccess } from '../types';
import { LanguageContext, ThemeContext } from '../App';
import { translations, translateEntity } from '../translations';
import { PORT_STYLING } from '../constants';
import InvoiceView from '../components/InvoiceView';

type SortConfig = {
  key: keyof Operation;
  direction: 'asc' | 'desc';
} | null;

interface StagingRow extends Partial<Operation> {
  quantity: number;
}

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  checkbox: 36,
  bookingNumber: 125,
  customerName: 140,
  trucker: 110,
  shipper: 110,
  clipOnPort: 85,
  clipOffPort: 85,
  destination: 150,
  containerNumber: 120,
  gensetNumber: 90,
  gas: 88,
  rate: 80,
  status: 110,
  operationDate: 100,
  clipOnDate: 100,
  commodity: 120,
  clipperName: 125,
  notes: 140,
  invoice: 130
};

const allPorts: string[] = ['DAM', 'ALEX', 'GOUDA', 'SOKHNA', 'SCCT', 'PSD'];
const STATUS_CYCLE: string[] = ['UNDER OPERATE', 'IN PROGRESS', 'DONE', 'HOLD', 'CANCEL'];

const getContrastColor = (bgClass: string, isDarkTerminal: boolean) => {
  if (isDarkTerminal) {
    if (bgClass.includes('slate-900') || bgClass.includes('slate-950') || bgClass.includes('blue-900')) return 'text-white';
    if (bgClass.includes('emerald-900')) return 'text-emerald-400';
    if (bgClass.includes('bg-[#001F3F]')) return 'text-[#C2A378]';
    return 'text-slate-100';
  }
  const lightColors = ['bg-white', 'bg-slate-50', 'bg-blue-50', 'bg-[#98FFD9]', 'bg-[#FFEB3B]', 'bg-amber-50', 'bg-emerald-50'];
  const isLight = lightColors.some(c => bgClass.includes(c));
  return isLight ? 'text-slate-900' : 'text-white';
};

const getDarkPortStyle = (loc: Location) => {
  const styles: Record<string, { backgroundColor: string; color: string; borderColor: string; boxShadow: string }> = {
    [Location.DAM]: { backgroundColor:'rgba(16,185,129,.22)',color:'#6EE7B7',borderColor:'#34D399',boxShadow:'0 0 10px rgba(52,211,153,.18)' },
    [Location.ALEX]: { backgroundColor:'rgba(234,179,8,.22)',color:'#FDE047',borderColor:'#FACC15',boxShadow:'0 0 10px rgba(250,204,21,.18)' },
    [Location.GOUDA]: { backgroundColor:'rgba(37,99,235,.24)',color:'#93C5FD',borderColor:'#60A5FA',boxShadow:'0 0 10px rgba(96,165,250,.18)' },
    [Location.SOKHNA]: { backgroundColor:'rgba(249,115,22,.24)',color:'#FDBA74',borderColor:'#FB923C',boxShadow:'0 0 10px rgba(251,146,60,.18)' },
    [Location.SCCT]: { backgroundColor:'rgba(14,165,233,.22)',color:'#7DD3FC',borderColor:'#38BDF8',boxShadow:'0 0 10px rgba(56,189,248,.18)' },
    [Location.PSD]: { backgroundColor:'rgba(124,58,237,.25)',color:'#C4B5FD',borderColor:'#A78BFA',boxShadow:'0 0 10px rgba(167,139,250,.18)' },
    [Location.MAL]: { backgroundColor:'rgba(34,197,94,.22)',color:'#86EFAC',borderColor:'#4ADE80',boxShadow:'0 0 10px rgba(74,222,128,.18)' },
    [Location.WORKSHOP]: { backgroundColor:'rgba(100,116,139,.28)',color:'#CBD5E1',borderColor:'#94A3B8',boxShadow:'0 0 10px rgba(148,163,184,.16)' }
  };
  return styles[loc] || { backgroundColor:'rgba(71,85,105,.28)',color:'#E2E8F0',borderColor:'#64748B',boxShadow:'none' };
};

interface EditableCellProps {
  value: string;
  onSave: (val: string) => void;
  type?: string;
  suggestions?: string[];
  options?: string[]; 
  placeholder?: string;
  className?: string;
  isError?: boolean;
  disabled?: boolean;
  strict?: boolean;
  isDark: boolean;
  renderValue?: (val: string) => React.ReactNode; 
}

const EditableCell: React.FC<EditableCellProps> = ({ value, onSave, type, suggestions, options, placeholder, className, isError, disabled, strict, isDark, renderValue }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const listId = useMemo(() => `list-${Math.random().toString(36).substr(2, 9)}`, []);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (strict && suggestions && currentValue && !suggestions.includes(currentValue)) {
      setCurrentValue(value);
      return;
    }
    if (currentValue !== value) onSave(currentValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBlur();
    else if (e.key === 'Escape') { setCurrentValue(value); setIsEditing(false); }
  };

  if (isEditing && !disabled) {
    if (options) {
      return (
        <select
          ref={inputRef as any}
          className={`w-full px-1 py-0.5 text-[10px] font-black uppercase rounded border-2 border-blue-500 outline-none shadow-sm ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-black'}`}
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown as any}
        >
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    }
    return (
      <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef as any}
          type={type || 'text'}
          list={listId}
          className={`w-full px-2 py-1 text-[10px] font-bold border-2 border-blue-500 rounded outline-none shadow-sm ${isDark ? 'bg-slate-950 text-white border-blue-400' : 'bg-white text-black'} ${className}`}
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        {suggestions && (
          <datalist id={listId}>
            {suggestions.map((s, idx) => <option key={idx} value={s} />)}
          </datalist>
        )}
      </div>
    );
  }

  return (
    <div 
      onClick={(e) => { if(!disabled) { e.stopPropagation(); setIsEditing(true); } }}
      className={`group min-h-[1.2rem] flex items-center px-1 rounded transition-colors ${!disabled ? 'cursor-pointer' : 'cursor-default'} ${isDark ? 'hover:bg-white/5 border-transparent' : 'hover:bg-black/5 border-transparent'} ${isError ? 'bg-red-600 text-white animate-pulse' : ''} ${className}`}
    >
      <div className="flex-1 whitespace-nowrap overflow-visible">
        {renderValue ? renderValue(value) : (value || <span className={`${isDark ? 'text-slate-600' : 'text-slate-300'} italic text-[9px]`}>{placeholder || '---'}</span>)}
      </div>
      {!disabled && <span className={`ml-1 opacity-0 group-hover:opacity-40 text-[7px] ${isDark ? 'text-white' : 'text-black'}`}>✎</span>}
    </div>
  );
};

interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  isDark: boolean;
}

export interface DateFilterConfig {
  startDate: string;
  endDate: string;
  field: 'operationDate' | 'clipOnDate' | 'any';
  preset: string;
}

const DateFilterDropdown = ({ 
  filter, 
  onChange, 
  isDark, 
  totalFilteredCount 
}: { 
  filter: DateFilterConfig; 
  onChange: (f: DateFilterConfig) => void; 
  isDark: boolean; 
  totalFilteredCount: number; 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { lang } = useContext(LanguageContext);
  const isAr = lang === 'ar';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const applyPreset = (presetKey: string) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let startDate = '';
    let endDate = '';

    if (presetKey === 'today') {
      startDate = formatYMD(now);
      endDate = formatYMD(now);
    } else if (presetKey === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      startDate = formatYMD(y);
      endDate = formatYMD(y);
    } else if (presetKey === 'last7days') {
      const st = new Date();
      st.setDate(st.getDate() - 6);
      startDate = formatYMD(st);
      endDate = formatYMD(now);
    } else if (presetKey === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      startDate = formatYMD(firstDay);
      endDate = formatYMD(lastDay);
    } else if (presetKey === 'lastMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      startDate = formatYMD(firstDay);
      endDate = formatYMD(lastDay);
    } else if (presetKey === 'thisYear') {
      startDate = `${now.getFullYear()}-01-01`;
      endDate = `${now.getFullYear()}-12-31`;
    } else if (presetKey === 'all') {
      startDate = '';
      endDate = '';
    }

    onChange({
      ...filter,
      preset: presetKey,
      startDate,
      endDate
    });
  };

  const handleCustomDateChange = (type: 'start' | 'end', val: string) => {
    onChange({
      ...filter,
      preset: 'custom',
      startDate: type === 'start' ? val : filter.startDate,
      endDate: type === 'end' ? val : filter.endDate
    });
  };

  const handleFieldChange = (field: 'operationDate' | 'clipOnDate' | 'any') => {
    onChange({
      ...filter,
      field
    });
  };

  const clearFilter = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange({
      startDate: '',
      endDate: '',
      field: 'operationDate',
      preset: 'all'
    });
  };

  const isActive = Boolean((filter.preset && filter.preset !== 'all') || filter.startDate || filter.endDate);

  const getButtonLabel = () => {
    if (!isActive) return isAr ? 'فلترة بالتاريخ' : 'Filter by Date';
    if (filter.preset === 'today') return isAr ? 'اليوم' : 'Today';
    if (filter.preset === 'yesterday') return isAr ? 'أمس' : 'Yesterday';
    if (filter.preset === 'last7days') return isAr ? 'آخر 7 أيام' : 'Last 7 Days';
    if (filter.preset === 'thisMonth') return isAr ? 'هذا الشهر' : 'This Month';
    if (filter.preset === 'lastMonth') return isAr ? 'الشهر الماضي' : 'Last Month';
    if (filter.preset === 'thisYear') return isAr ? 'هذا العام' : 'This Year';
    if (filter.startDate && filter.endDate) {
      return filter.startDate === filter.endDate ? filter.startDate : `${filter.startDate} ~ ${filter.endDate}`;
    }
    if (filter.startDate) return `≥ ${filter.startDate}`;
    if (filter.endDate) return `≤ ${filter.endDate}`;
    return isAr ? 'تاريخ محدد' : 'Custom Date';
  };

  const presets = [
    { key: 'all', labelAr: 'الكل (الكل)', labelEn: 'All Time' },
    { key: 'today', labelAr: 'اليوم', labelEn: 'Today' },
    { key: 'yesterday', labelAr: 'أمس', labelEn: 'Yesterday' },
    { key: 'last7days', labelAr: 'آخر 7 أيام', labelEn: 'Last 7 Days' },
    { key: 'thisMonth', labelAr: 'هذا الشهر', labelEn: 'This Month' },
    { key: 'lastMonth', labelAr: 'الشهر الماضي', labelEn: 'Last Month' },
    { key: 'thisYear', labelAr: 'هذا العام', labelEn: 'This Year' },
  ];

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-sm ${
            isActive
              ? (isDark ? 'bg-blue-950/80 border-blue-500 text-blue-300 ring-2 ring-blue-500/40' : 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/30')
              : (isDark ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-blue-400' : 'bg-white border-slate-200 text-slate-800 hover:border-blue-400')
          }`}
          title={isAr ? "فلترة العمليات حسب التاريخ" : "Filter manifest operations by date range"}
        >
          <span className="text-xs">📅</span>
          <span className="truncate max-w-[130px] font-bold">{getButtonLabel()}</span>
          {isActive && (
            <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[8px] font-mono">
              {totalFilteredCount}
            </span>
          )}
          <svg className={`w-3 h-3 transition-transform text-slate-400 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isActive && (
          <button
            type="button"
            onClick={clearFilter}
            className={`p-1.5 ml-1 rounded-lg border text-[10px] font-bold transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-red-900/50 hover:text-red-300 hover:border-red-500' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-300'}`}
            title={isAr ? "مسح فلتر التاريخ" : "Clear date filter"}
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (
        <div 
          className={`absolute top-full ${isAr ? 'right-0' : 'left-0'} mt-2 w-80 shadow-2xl rounded-2xl z-[70] p-3.5 border animate-in fade-in zoom-in-95 duration-150 ${
            isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-slate-200'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">📅</span>
              <span className="font-black text-[11px] uppercase tracking-wider">
                {isAr ? 'فلترة سجل العمليات بالتاريخ' : 'Date Range Filter'}
              </span>
            </div>
            {isActive && (
              <button
                type="button"
                onClick={() => clearFilter()}
                className="text-[9px] text-red-400 hover:text-red-300 font-bold underline"
              >
                {isAr ? 'إلغاء الفلتر' : 'Clear'}
              </button>
            )}
          </div>

          {/* Target Date Field */}
          <div className="mb-3">
            <div className="text-[9px] font-black uppercase text-slate-400 mb-1.5">
              {isAr ? 'تطبيق الفلترة على حقل:' : 'Apply filter to field:'}
            </div>
            <div className="grid grid-cols-3 gap-1 bg-black/10 dark:bg-white/5 p-1 rounded-xl border border-white/5 text-[9px] font-bold">
              <button
                type="button"
                onClick={() => handleFieldChange('operationDate')}
                className={`py-1 px-1.5 rounded-lg text-center transition-all truncate ${filter.field === 'operationDate' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                title={isAr ? "تاريخ التشغيل" : "Operation Date"}
              >
                {isAr ? 'تاريخ التشغيل' : 'Op Date'}
              </button>
              <button
                type="button"
                onClick={() => handleFieldChange('clipOnDate')}
                className={`py-1 px-1.5 rounded-lg text-center transition-all truncate ${filter.field === 'clipOnDate' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                title={isAr ? "تاريخ التركيب" : "Clip On Date"}
              >
                {isAr ? 'تاريخ التركيب' : 'Clip On'}
              </button>
              <button
                type="button"
                onClick={() => handleFieldChange('any')}
                className={`py-1 px-1.5 rounded-lg text-center transition-all truncate ${filter.field === 'any' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                title={isAr ? "أي من التاريخين" : "Either Date"}
              >
                {isAr ? 'أي منهما' : 'Any Date'}
              </button>
            </div>
          </div>

          {/* Presets */}
          <div className="mb-3">
            <div className="text-[9px] font-black uppercase text-slate-400 mb-1.5">
              {isAr ? 'فترات سريعة جاهزة:' : 'Quick Presets:'}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {presets.map(p => {
                const isSelected = filter.preset === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPreset(p.key)}
                    className={`py-1.5 px-2 rounded-xl text-[9px] font-bold transition-all border text-center ${
                      isSelected
                        ? 'bg-blue-600 border-blue-500 text-white shadow-md font-black'
                        : isDark
                        ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {isAr ? p.labelAr : p.labelEn}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Date Inputs */}
          <div className="pt-2 border-t border-white/10">
            <div className="text-[9px] font-black uppercase text-slate-400 mb-1.5">
              {isAr ? 'أو حدد نطاق التاريخ يدوياً:' : 'Or custom date range:'}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[8px] font-bold text-slate-400 mb-1">
                  {isAr ? 'من تاريخ:' : 'From:'}
                </label>
                <input
                  type="date"
                  value={filter.startDate}
                  onChange={(e) => handleCustomDateChange('start', e.target.value)}
                  className={`w-full px-2 py-1.5 rounded-xl border text-[10px] font-bold outline-none focus:border-blue-500 ${
                    isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[8px] font-bold text-slate-400 mb-1">
                  {isAr ? 'إلى تاريخ:' : 'To:'}
                </label>
                <input
                  type="date"
                  value={filter.endDate}
                  onChange={(e) => handleCustomDateChange('end', e.target.value)}
                  className={`w-full px-2 py-1.5 rounded-xl border text-[10px] font-bold outline-none focus:border-blue-500 ${
                    isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Footer status & done */}
          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[9px]">
            <div className="text-slate-400 font-bold">
              {isAr ? `العمليات المطابقة: ` : `Matching records: `}
              <span className="text-blue-400 font-mono font-black">{totalFilteredCount}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-[9px] shadow"
            >
              {isAr ? 'تم' : 'Done'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const MultiSelectDropdown = ({ label, options, selected, onChange, isDark }: MultiSelectDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { lang } = useContext(LanguageContext);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (opt: string) => {
    if (selected.includes(opt)) onChange(selected.filter(s => s !== opt));
    else onChange([...selected, opt]);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${isDark ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-blue-400' : 'bg-white border-slate-200 text-black hover:border-blue-400'} ${selected.length > 0 ? `ring-1 ring-blue-500/30` : ''}`}
      >
        <span>{label}</span>
        {selected.length > 0 && <span className={`bg-blue-600 text-white px-1.5 rounded-full text-[8px]`}>{selected.length}</span>}
        <svg className={`w-3 h-3 transition-transform text-slate-500 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {isOpen && (
        <div className={`absolute top-full ${lang === 'ar' ? 'right-0' : 'left-0'} mt-1 w-48 shadow-2xl rounded-xl z-[60] py-2 animate-in fade-in zoom-in-95 duration-100 ${isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200'}`}>
          <div className="max-h-60 overflow-y-auto px-1">
            {options.map(opt => (
              <label key={opt} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer group ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={selected.includes(opt)} onChange={() => toggleOption(opt)} />
                <span className={`text-[10px] font-bold uppercase tracking-tight ${selected.includes(opt) ? (isDark ? 'text-blue-400' : 'text-blue-700') : (isDark ? 'text-slate-400' : 'text-black')}`}>{translateEntity(opt, lang)}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const MasterView: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const { theme, isDark } = useContext(ThemeContext);
  const t = translations[lang];
  const isAr = lang === 'ar';

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}') as User, []);
  const isReadOnly = hasReadOnlyAccess(currentUser);
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const canExport = currentUser.permissions?.canExport !== false;

  const [operations, setOperations] = useState<Operation[]>(db.getOperations());
  const [searchTerm, setSearchTerm] = useState('');
  const [columnSearches, setColumnSearches] = useState<Record<string, string>>({});
  const [selectedPorts, setSelectedPorts] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilterConfig>({
    startDate: '',
    endDate: '',
    field: 'operationDate',
    preset: 'all'
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [collapsedStatusGroups, setCollapsedStatusGroups] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    const closeStagingOnNavigation = () => {
      const destination = window.location.hash.slice(1).split('?')[0];
      if (destination && destination !== 'master-view') setShowAddModal(false);
    };
    window.addEventListener('hashchange', closeStagingOnNavigation);
    return () => window.removeEventListener('hashchange', closeStagingOnNavigation);
  }, []);

  // Invoice state handlers
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDate, setEditDate] = useState<string>('');
  const [editDueDate, setEditDueDate] = useState<string>('');
  const [editStatus, setEditStatus] = useState<'PAID' | 'UNPAID'>('UNPAID');
  const [editEtaStatus, setEditEtaStatus] = useState<'DRAFT' | 'SUBMITTED' | 'VALID' | 'INVALID'>('DRAFT');

  const handleOpenEditInvoice = (inv: Invoice) => {
    setEditingInvoice(inv);
    setEditAmount(inv.amount);
    setEditDate(inv.date);
    setEditDueDate(inv.dueDate || '');
    setEditStatus(inv.status);
    setEditEtaStatus(inv.etaStatus || 'DRAFT');
  };

  const handleSaveEditInvoice = () => {
    if (!editingInvoice) return;
    db.updateInvoice(editingInvoice.id, {
      amount: editAmount,
      date: editDate,
      dueDate: editDueDate || undefined,
      status: editStatus,
      etaStatus: editEtaStatus
    });
    setEditingInvoice(null);
    refresh();
  };

  const handleQuickGenerateInvoice = async (bookingNumber: string, customerName: string) => {
    const freshInvoice = await db.generateInvoiceFromBooking(bookingNumber, customerName);
    if (freshInvoice) {
      alert(isAr 
        ? `تم إنشاء الفاتورة بنجاح رقم ${freshInvoice.id} بمبلغ ${freshInvoice.amount.toLocaleString()} ج.م.`
        : `Invoice ${freshInvoice.id} generated successfully for EGP ${freshInvoice.amount.toLocaleString()}`
      );
      refresh();
    } else {
      alert(isAr
        ? 'حدث خطأ: تأكد من وجود عمليات مكتملة وغير مفوترة لهذا الحجز.'
        : 'Error: Make sure there are completed operations (status DONE) that have not been invoiced yet.'
      );
    }
  };
  
  const nowForDate = new Date();
  const todayDate = new Date(nowForDate.getTime() - nowForDate.getTimezoneOffset() * 60_000)
    .toISOString().slice(0, 10);

  const [stagedOps, setStagedOps] = useState<any[]>([
    { customerName: '', bookingNumber: '', operationDate: todayDate, clipOnDate: todayDate, status: 'UNDER OPERATE', rate: '0', vat: '0', clipOnPort: Location.ALEX, clipOffPort: Location.ALEX, destination: '', trucker: '', beneficiaryName: '', quantity: 1 }
  ]);
  const [rawPasteBuffer, setRawPasteBuffer] = useState('');
  const [stagingColWidths, setStagingColWidths] = useState<Record<string, number>>({});

  const [viewPrefs, setViewPrefs] = useState<{
    density: number;
    scale: number;
  }>(() => {
    try {
      const saved = localStorage.getItem(`master_prefs_v5_${currentUser.id}`);
      return saved ? { density: 4, scale: 100, ...JSON.parse(saved) } : { density: 4, scale: 100 };
    } catch {
      localStorage.removeItem(`master_prefs_v5_${currentUser.id}`);
      return { density: 4, scale: 100 };
    }
  });

  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(`master_col_widths_${currentUser.id}`);
      const parsed = saved ? JSON.parse(saved) : {};
      const safe: Record<string, number> = {};
      Object.keys(DEFAULT_COLUMN_WIDTHS).forEach(key => {
        const value = Number(parsed?.[key] ?? DEFAULT_COLUMN_WIDTHS[key]);
        safe[key] = Number.isFinite(value) ? Math.max(35, Math.min(1600, value)) : DEFAULT_COLUMN_WIDTHS[key];
      });
      return safe;
    } catch {
      localStorage.removeItem(`master_col_widths_${currentUser.id}`);
      return { ...DEFAULT_COLUMN_WIDTHS };
    }
  });

  useEffect(() => {
    localStorage.setItem(`master_col_widths_${currentUser.id}`, JSON.stringify(colWidths));
  }, [colWidths, currentUser.id]);

  const duplicateContainerNumbers = useMemo(() => {
    const counts: Record<string, number> = {};
    operations.forEach(op => {
      const cnt = op.containerNumber?.trim().toUpperCase();
      if (cnt && cnt !== '---' && cnt !== 'N/A' && cnt !== 'NONE') {
        counts[cnt] = (counts[cnt] || 0) + 1;
      }
    });
    const set = new Set<string>();
    Object.entries(counts).forEach(([cnt, count]) => {
      if (count > 1) set.add(cnt);
    });
    return set;
  }, [operations]);

  const duplicateActiveGensets = useMemo(() => {
    const counts: Record<string, number> = {};
    operations.forEach(op => {
      const isInProgress = op.status === 'IN PROGRESS';
      const gen = op.gensetNumber?.trim().toUpperCase();
      if (gen && gen !== '---' && gen !== 'N/A' && gen !== 'NONE' && isInProgress) {
        counts[gen] = (counts[gen] || 0) + 1;
      }
    });
    const set = new Set<string>();
    Object.entries(counts).forEach(([gen, count]) => {
      if (count > 1) set.add(gen);
    });
    return set;
  }, [operations]);

  const resizingRef = useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const resizeFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      resizingRef.current = null;
    };
  }, []);

  const handleMouseDownResize = (e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Always terminate a previous drag before starting another one.
    resizeCleanupRef.current?.();
    resizeCleanupRef.current = null;

    const startX = e.clientX;
    const startWidth = Number(colWidths[colKey] ?? DEFAULT_COLUMN_WIDTHS[colKey] ?? 100);
    const safeStartWidth = Number.isFinite(startWidth) ? Math.max(35, Math.min(1600, startWidth)) : 100;
    const resizeColumnKey = colKey;
    const resizeStartX = startX;
    const resizeStartWidth = safeStartWidth;

    resizingRef.current = { colKey: resizeColumnKey, startX: resizeStartX, startWidth: resizeStartWidth };

    let lastWidth = resizeStartWidth;
    const finishResize = () => {
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', handleWindowBlur);
      resizeCleanupRef.current = null;
      resizingRef.current = null;
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      const deltaX = moveEvent.clientX - resizeStartX;
      const actualDelta = isAr ? -deltaX : deltaX;
      lastWidth = Math.max(35, Math.min(1600, resizeStartWidth + actualDelta));

      // Throttle React state updates to one per animation frame. This prevents
      // a rapid mousemove stream from overwhelming the Master View render cycle.
      if (resizeFrameRef.current === null) {
        resizeFrameRef.current = requestAnimationFrame(() => {
          resizeFrameRef.current = null;
          if (resizingRef.current) {
            setColWidths(prev => ({ ...prev, [resizeColumnKey]: lastWidth }));
          }
        });
      }
    };

    const handleMouseUp = () => {
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      setColWidths(prev => ({ ...prev, [resizeColumnKey]: lastWidth }));
      finishResize();
    };

    const handleWindowBlur = () => finishResize();

    resizeCleanupRef.current = finishResize;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('blur', handleWindowBlur);
  };

  const shrinkColumn = (colKey: string, delta = 15) => {
    setColWidths(prev => ({
      ...prev,
      [colKey]: Math.max(35, (prev[colKey] || DEFAULT_COLUMN_WIDTHS[colKey] || 100) - delta)
    }));
  };

  const expandColumn = (colKey: string, delta = 15) => {
    setColWidths(prev => ({
      ...prev,
      [colKey]: Math.min(1600, (prev[colKey] || DEFAULT_COLUMN_WIDTHS[colKey] || 100) + delta)
    }));
  };

  const shrinkAllColumns = () => {
    setColWidths(prev => {
      const updated: Record<string, number> = {};
      Object.keys(prev).forEach(k => {
        updated[k] = Math.max(35, Math.round(prev[k] * 0.8));
      });
      return updated;
    });
  };

  const expandAllColumns = () => {
    setColWidths(prev => {
      const updated: Record<string, number> = {};
      Object.keys(prev).forEach(k => {
        updated[k] = Math.min(1600, Math.round(prev[k] * 1.25));
      });
      return updated;
    });
  };

  const resetColumnWidths = () => {
    setColWidths(DEFAULT_COLUMN_WIDTHS);
  };

  const getColStyle = (key: string) => {
    const w = colWidths[key] || DEFAULT_COLUMN_WIDTHS[key] || 100;
    return {
      width: `${w}px`,
      minWidth: `${w}px`,
      maxWidth: `${w}px`,
      boxSizing: 'border-box' as const,
      overflow: 'hidden' as const
    };
  };

  const [invoices, setInvoices] = useState<Invoice[]>(() => db.getInvoices());

  const refresh = () => {
    setOperations([...db.getOperations()]);
    setInvoices([...db.getInvoices()]);
  };

  useEffect(() => {
    const sync = () => refresh();
    window.addEventListener('db-undo-success', sync);
    window.addEventListener('db-change', sync);
    return () => {
      window.removeEventListener('db-undo-success', sync);
      window.removeEventListener('db-change', sync);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(`master_prefs_v5_${currentUser.id}`, JSON.stringify(viewPrefs));
  }, [viewPrefs, currentUser.id]);

  const handleBulkStatusChange = async (newStatus: 'IN PROGRESS' | 'UNDER OPERATE' | 'DONE' | 'HOLD' | 'CANCEL') => {
    if (isReadOnly) return;
    const ids = Array.from(selectedRowIds) as string[];
    const jobs = ids.map(id => {
      const op = operations.find(o => o.id === id);
      return op ? db.updateOperation({ ...op, status: newStatus }) : Promise.resolve(true);
    });
    const results = await Promise.all(jobs);
    const failed = results.filter(saved => saved === false).length;
    if (failed) {
      alert(isAr ? `فشل تحديث ${failed} عملية. ${db.getLastDbError() || ''}` : `Failed to update ${failed} operations. ${db.getLastDbError() || ''}`);
      return;
    }
    setSelectedRowIds(new Set());
    refresh();
    alert(isAr ? `تم تحديث حالة ${ids.length} عملية` : `Updated status for ${ids.length} operations.`);
  };

  const handleBulkDelete = async () => {
    if (!isAdmin) return;
    const ids = Array.from(selectedRowIds) as string[];
    if (confirm(isAr ? `هل أنت متأكد من حذف ${ids.length} عملية؟` : `Are you sure you want to delete ${ids.length} operations?`)) {
      await db.deleteOperationsBulk(ids);
      setSelectedRowIds(new Set());
      refresh();
    }
  };

  const handleCloneSelectedOperations = async () => {
    if (isReadOnly) return;
    const ids = Array.from(selectedRowIds) as string[];
    const sourceOps = ids.map(id => operations.find(o => o.id === id)).filter(Boolean) as Operation[];
    if (!sourceOps.length) return;

    const confirmed = confirm(
      isAr
        ? `هل تريد إضافة ${sourceOps.length} عملية جديدة مطابقة للسجلات المحددة؟ سيتم الاحتفاظ بالسجلات الأصلية كما هي.`
        : `Add ${sourceOps.length} new operation(s) matching the selected entries? The original records will remain unchanged.`
    );
    if (!confirmed) return;

    const now = Date.now();
    const clones: Operation[] = sourceOps.map((op, index) => ({
      ...op,
      id: `op-clone-${now}-${index}-${Math.random().toString(36).slice(2)}`,
      internalSerial: '',
      gensetNumber: '',
      status: 'UNDER OPERATE',
      invoiced: false,
      reviewedByManager: false
    }));

    const saved = await db.addOperationsBulk(clones);
    if (!saved) {
      alert(
        isAr
          ? `❌ فشل إضافة العمليات المنسوخة.\\n${db.getLastDbError() || 'خطأ غير معروف'}`
          : `❌ FAILED TO CLONE OPERATIONS.\\n${db.getLastDbError() || 'Unknown database error'}`
      );
      return;
    }

    const reloaded = await db.reloadOperations();
    if (!reloaded) {
      alert(
        isAr
          ? `⚠️ تم إنشاء العمليات لكن تعذر إعادة تحميلها.\\n${db.getLastDbError() || ''}`
          : `⚠️ CLONED OPERATIONS WERE CREATED, BUT THE DATABASE RELOAD FAILED.\\n${db.getLastDbError() || ''}`
      );
      return;
    }

    setSelectedRowIds(new Set());
    refresh();
    alert(
      isAr
        ? `تمت إضافة ${clones.length} عملية جديدة بنجاح.`
        : `Successfully added ${clones.length} cloned operation(s).`
    );
  };



  const fallbackParse = (buffer: string) => {
    const lines = buffer.split('\n').filter(l => l.trim().length > 0);
    const newStaged: StagingRow[] = lines.map(line => {
      const parts = line.split(/[\t,]/).map(p => p.trim());
      return {
        customerName: parts[0] || '',
        bookingNumber: parts[1] || '',
        containerNumber: parts[2] || '',
        rate: parts[4] || '0',
        beneficiaryName: parts[5] || '',
        trucker: parts[6] || '',
        operationDate: parts[7] || todayDate,
        clipOnDate: parts[8] || todayDate,
        status: 'UNDER OPERATE',
        clipOnPort: Location.ALEX,
        clipOffPort: Location.ALEX,
        destination: '',
        quantity: 1,
        vat: '0'
      };
    });
    if (newStaged.length > 0) setStagedOps(newStaged);
  };

  const startStagingColumnResize = (event: React.MouseEvent, columnKey: string) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const initialWidth = stagingColWidths[columnKey] ?? stagingColumnDefaults[columnKey] ?? 140;
    const move = (moveEvent: MouseEvent) => {
      const delta = isAr ? startX - moveEvent.clientX : moveEvent.clientX - startX;
      setStagingColWidths(previous => ({ ...previous, [columnKey]: Math.max(70, Math.min(1600, initialWidth + delta)) }));
    };
    const stop = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
  };

  const stagingColumnDefaults: Record<string, number> = {
    row: 48, quantity: 74, customer: 190, booking: 170, operationDate: 145, clipOnDate: 145,
    inPort: 145, outPort: 145, destination: 190, rate: 120,
    shipper: 170, trucker: 170, commodity: 160, actions: 128
  };
  const stagingColumnHeaders = [
    { key: 'row', label: '#' },
    { key: 'quantity', label: isAr ? 'الكمية' : 'Qty' },
    { key: 'customer', label: t.client },
    { key: 'booking', label: t.bookingNum },
    { key: 'operationDate', label: isAr ? 'تاريخ العملية' : 'Operation Date' },
    { key: 'clipOnDate', label: isAr ? 'تاريخ التركيب' : 'Clip On Date' },
    { key: 'inPort', label: isAr ? 'ميناء الدخول' : 'In Hub' },
    { key: 'outPort', label: isAr ? 'ميناء الخروج' : 'Out Hub' },
    { key: 'destination', label: isAr ? 'الوجهة' : 'Destination' },
    { key: 'rate', label: t.rate },
    { key: 'shipper', label: t.shipper },
    { key: 'trucker', label: t.trucker },
    { key: 'commodity', label: isAr ? 'البضاعة' : 'Commodity' },
    { key: 'actions', label: t.actions }
  ];
  const stagingFieldClass = `w-full p-2 rounded-xl border-2 font-black text-[10px] outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-950 text-slate-100 border-slate-600 placeholder:text-slate-400' : 'bg-white text-slate-900 border-slate-300 placeholder:text-slate-500'}`;

  const updateStagedRow = (idx: number, field: keyof StagingRow, val: any) => {
    const copy = [...stagedOps];
    copy[idx] = { ...copy[idx], [field]: val };
    
    if ((field === 'customerName' || field === 'clipOnPort' || field === 'clipOffPort') && copy[idx].rate === '0' && copy[idx].customerName) {
        const foundPrice = db.getCustomerPrices().find(p => 
            p.customerName === copy[idx].customerName && 
            p.portIn === copy[idx].clipOnPort && 
            p.portOut === copy[idx].clipOffPort
        );
        if (foundPrice) {
            copy[idx].rate = foundPrice.price.toFixed(2);
            copy[idx].vat = foundPrice.includeVat ? (foundPrice.price * 0.14).toFixed(2) : '0.00';
        }
    }
    
    setStagedOps(copy);
  };

  const duplicateRow = (idx: number) => {
    const copy = [...stagedOps];
    const newRow = { ...copy[idx], quantity: 1 };
    copy.splice(idx + 1, 0, newRow);
    setStagedOps(copy);
  };

  const handleFinalInject = async () => {
    const toInject: Operation[] = [];
    stagedOps.forEach(s => {
      if (!s.customerName || !s.bookingNumber) return;
      for(let i = 0; i < (s.quantity || 1); i++) {
        toInject.push({
          id: `op-bulk-${Date.now()}-${i}-${Math.random()}`,
          internalSerial: '',
          customerName: s.customerName!,
          bookingNumber: s.bookingNumber!,
          containerNumber: s.containerNumber || '',
          gensetNumber: '',
          commodity: s.commodity || '',
          clipperName: '',
          operationDate: s.operationDate || todayDate,
          dateReceived: s.operationDate || todayDate,
          clipOnDate: s.clipOnDate || todayDate,
          clipOffDate: '',
          clipOnPort: (s.clipOnPort as Location) || Location.ALEX,
          clipOffPort: (s.clipOffPort as Location) || Location.ALEX,
          destination: s.destination || '',
          status: (s.status as any) || 'UNDER OPERATE',
          rate: s.rate || '0.00',
          vat: s.vat || '0.00',
          trucker: s.trucker || '',
          beneficiaryName: s.beneficiaryName || '',
          shipperAddress: '',
          invoiced: false,
          reviewedByManager: false
        });
      }
    });
    
    if (toInject.length > 0) {
      const saved = await db.addOperationsBulk(toInject);
      if (!saved) {
        alert(isAr
          ? `❌ فشل حفظ ${toInject.length} عملية في قاعدة البيانات.\n${db.getLastDbError() || 'خطأ غير معروف'}`
          : `❌ DATABASE SAVE FAILED for ${toInject.length} operations.\n${db.getLastDbError() || 'Unknown database error'}`
        );
        return;
      }
      const reloaded = await db.reloadOperations();
      if (!reloaded) {
        alert(isAr
          ? `⚠️ تم الحفظ لكن تعذر إعادة قراءة العمليات من قاعدة البيانات.\n${db.getLastDbError() || ''}`
          : `⚠️ SAVED, BUT OPERATIONS COULD NOT BE RELOADED FROM DATABASE.\n${db.getLastDbError() || ''}`
        );
        return;
      }
      const freshOps = db.getOperations();
      const missingBookings = Array.from(new Set(
        toInject.map(o => o.bookingNumber).filter(bk =>
          !freshOps.some(o => o.bookingNumber === bk)
        )
      ));
      if (missingBookings.length > 0) {
        alert(isAr
          ? `❌ تم الإدخال لكن السجلات غير ظاهرة بعد إعادة القراءة. الحجوزات المفقودة: ${missingBookings.join(', ')}\\nالسبب: ${db.getLastDbError() || 'مشكلة في صلاحيات أو قراءة قاعدة البيانات.'}`
          : `❌ INSERT COMPLETED BUT RECORDS ARE NOT VISIBLE AFTER DATABASE RELOAD. Missing bookings: ${missingBookings.join(', ')}\\nReason: ${db.getLastDbError() || 'Database permissions/RLS or read-path issue.'}`
        );
        return;
      }
      setOperations([...freshOps]);
      setShowAddModal(false);
      setStagedOps([{ customerName: '', bookingNumber: '', operationDate: todayDate, clipOnDate: todayDate, status: 'UNDER OPERATE', rate: '0', vat: '0', clipOnPort: Location.ALEX, clipOffPort: Location.ALEX, destination: '', trucker: '', beneficiaryName: '', quantity: 1 }]);
      setRawPasteBuffer('');
      refresh();
      alert(isAr ? `تمت إضافة ${toInject.length} عملية بنجاح` : `Successfully injected ${toInject.length} operations.`);
    }
  };

  const systemSuggestions = useMemo(() => {
    const customerNames = Array.from(new Set(
      db.getUsers().filter(u => u.role === UserRole.CUSTOMER).map(u => (u.companyName || u.name || '').trim()).filter(Boolean)
    )) as string[];
    const suggestions: Record<string, string[]> = {
      customers: customerNames,
      shippers: Array.from(new Set(operations.map(o => o.beneficiaryName).filter((v): v is string => !!v))) as string[],
      truckers: Array.from(new Set(operations.map(o => o.trucker).filter((v): v is string => !!v))) as string[],
      gensets: Array.from(new Set(db.getStock().map(s => s.unitNumber))) as string[],
      containers: Array.from(new Set(operations.map(o => o.containerNumber).filter((v): v is string => !!v))) as string[],
      commodities: Array.from(new Set([...operations.map(o => o.commodity).filter((v): v is string => !!v), 'CITRUS', 'ORANGES', 'GRAPES', 'POTATOES', 'STRAWBERRIES', 'POMEGRANATE', 'FROZEN FISH', 'ONIONS', 'FROZEN VEGETABLES'])),
      clippers: Array.from(new Set([...operations.map(o => o.clipperName).filter((v): v is string => !!v), 'Mohamed Fawzy', 'Ahmed Ali', 'Mahmoud Hassan', 'Eslam Logistics', 'Ibrahim Said', 'Sherif Hegazy']))
    };
    return suggestions;
  }, [operations]);

  // Keep this outside the suggestions useMemo so the customer validation
  // set is available to the table renderer on every render.
  const customerNameKeys = useMemo(
    () => new Set(systemSuggestions.customers.map(name => name.trim().toLowerCase())),
    [systemSuggestions]
  );

  const getColumnSearchValue = (op: Operation, key: string): string => {
    switch (key) {
      case 'bookingNumber': return op.bookingNumber || '';
      case 'customerName': return `${op.customerName || ''} ${translateEntity(op.customerName || '', lang)}`;
      case 'trucker': return `${op.trucker || ''} ${translateEntity(op.trucker || '', lang)}`;
      case 'shipper': return `${op.beneficiaryName || ''} ${translateEntity(op.beneficiaryName || '', lang)}`;
      case 'clipOnPort': return `${op.clipOnPort || ''} ${translateEntity(op.clipOnPort || '', lang)}`;
      case 'clipOffPort': return `${op.clipOffPort || ''} ${translateEntity(op.clipOffPort || '', lang)}`;
      case 'destination': return op.destination || '';
      case 'containerNumber': return op.containerNumber || '';
      case 'gensetNumber': return op.gensetNumber || '';
      case 'rate': return op.rate || '';
      case 'status': return `${op.status || ''} ${translateEntity(op.status || '', lang)}`;
      case 'operationDate': return op.operationDate || '';
      case 'clipOnDate': return op.clipOnDate || '';
      case 'commodity': return op.commodity || '';
      case 'clipperName': return `${op.clipperName || ''} ${translateEntity(op.clipperName || '', lang)}`;
      case 'notes': return op.notes || '';
      case 'gas': {
        const unit = op.gensetNumber
          ? db.getStock().find(g => g.unitNumber.trim().toUpperCase() === op.gensetNumber.trim().toUpperCase())
          : undefined;
        return unit ? String(unit.gasLiters ?? '') : '';
      }
      case 'invoice': {
        const invoice = invoices.find(inv => inv.bookingNumber === op.bookingNumber);
        return invoice ? `${invoice.id} ${invoice.status} ${invoice.etaStatus || ''} ${invoice.amount ?? ''}` : '';
      }
      default: return '';
    }
  };

  const filteredAndSortedOps = useMemo(() => {
    let result = [...operations].filter(op => {
      const searchStr = searchTerm.toLowerCase();
      const matchesSearch = (op.bookingNumber || '').toLowerCase().includes(searchStr) || 
                            (op.customerName || '').toLowerCase().includes(searchStr) || 
                            (op.containerNumber || '').toLowerCase().includes(searchStr) ||
                            (op.commodity && op.commodity.toLowerCase().includes(searchStr)) ||
                            (op.clipperName && op.clipperName.toLowerCase().includes(searchStr)) ||
                            (op.trucker && op.trucker.toLowerCase().includes(searchStr)) ||
                            (op.beneficiaryName && op.beneficiaryName.toLowerCase().includes(searchStr));
      const matchesColumnSearches = Object.entries(columnSearches).every(([key, query]) => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return true;
        return getColumnSearchValue(op, key).toLowerCase().includes(normalizedQuery);
      });
      const matchesPorts = selectedPorts.length === 0 || selectedPorts.includes(op.clipOnPort as string);
      const matchesStatuses = selectedStatuses.length === 0 || selectedStatuses.includes(op.status as string);
      
      const matchesDate = (() => {
        if (!dateFilter.startDate && !dateFilter.endDate) return true;
        
        const targetDates: string[] = [];
        if (dateFilter.field === 'clipOnDate') {
          if (op.clipOnDate) targetDates.push(op.clipOnDate);
        } else if (dateFilter.field === 'any') {
          if (op.operationDate) targetDates.push(op.operationDate);
          if (op.clipOnDate) targetDates.push(op.clipOnDate);
        } else {
          // default operationDate
          if (op.operationDate) targetDates.push(op.operationDate);
        }

        if (targetDates.length === 0) return false;

        return targetDates.some(d => {
          if (dateFilter.startDate && d < dateFilter.startDate) return false;
          if (dateFilter.endDate && d > dateFilter.endDate) return false;
          return true;
        });
      })();

      return matchesSearch && matchesColumnSearches && matchesPorts && matchesStatuses && matchesDate;
    });

    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = (a[sortConfig.key] || '').toString(); const bVal = (b[sortConfig.key] || '').toString();
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      const statusOrder: Record<string, number> = { 'UNDER OPERATE': 1, 'IN PROGRESS': 2, 'DONE': 3, 'HOLD': 4, 'CANCEL': 5 };
      result.sort((a, b) => {
        if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
        return b.operationDate.localeCompare(a.operationDate);
      });
    }
    return result;
  }, [operations, searchTerm, columnSearches, selectedPorts, selectedStatuses, dateFilter, sortConfig, invoices, lang]);

  const handleUpdateCell = (op: Operation, field: keyof Operation, val: any) => {
    if (isReadOnly) return;
    db.updateOperation({ ...op, [field]: val });
    refresh();
  };

  const handleUpdateGensetGas = (unitNumber: string, value: string) => {
    if (isReadOnly) return;
    const liters = Number(value);
    if (!Number.isFinite(liters) || liters < 0) return;
    const genset = db.getStock().find(item => item.unitNumber.trim().toUpperCase() === unitNumber.trim().toUpperCase());
    if (!genset) return;
    void db.updateGenset({ ...genset, gasLiters: liters }).then(saved => {
      if (!saved) {
        const detail = db.getLastDbError();
        window.alert(isAr
          ? `تعذر حفظ كمية الوقود. ${detail || 'تحقق من تطبيق تحديث قاعدة البيانات.'}`
          : `Could not save gas amount. ${detail || 'Make sure the database update has been applied.'}`);
        return;
      }
      refresh();
    });
  };

  const requestSort = (key: keyof Operation) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleExportData = async () => {
    const XLSX = await import('xlsx-js-style');
    const headers = [
      '#', t.bookingNum, t.client, t.trucker, t.shipper,
      isAr ? 'دخول' : 'IN', isAr ? 'خروج' : 'OUT',
      isAr ? 'الوجهة' : 'DESTINATION', t.container,
      isAr ? 'المولد' : 'GENSET', t.rate, t.status,
      isAr ? 'تاريخ التشغيل' : 'OP DATE', isAr ? 'تاريخ التركيب' : 'CLIP ON',
      isAr ? 'البضاعة' : 'COMMODITY', isAr ? 'فني التركيب' : 'CLIPPER ON',
      t.notes, isAr ? 'الوقود (لتر)' : 'GAS (L)', isAr ? 'فاتورة الحجز' : 'BOOKING INVOICE'
    ];
    const invoiceByBooking = new Map<string, Invoice>(invoices.map(invoice => [invoice.bookingNumber, invoice]));
    const exportRows = filteredAndSortedOps.map((op, index) => {
      const invoice = invoiceByBooking.get(op.bookingNumber);
      return [
        index + 1,
        op.bookingNumber || '',
        translateEntity(op.customerName || '', lang),
        translateEntity(op.trucker || '', lang),
        translateEntity(op.beneficiaryName || '', lang),
        translateEntity(op.clipOnPort || '', lang),
        translateEntity(op.clipOffPort || '', lang),
        op.destination || '',
        op.containerNumber || '',
        op.gensetNumber || '',
        Number(String(op.rate || '0').replace(/,/g, '')) || 0,
        translateEntity(op.status || '', lang),
        op.operationDate || '',
        op.clipOnDate || '',
        op.commodity || '',
        translateEntity(op.clipperName || '', lang),
        op.notes || '',
        op.gensetNumber ? (db.getStock().find(g => g.unitNumber.trim().toUpperCase() === op.gensetNumber.trim().toUpperCase())?.gasLiters ?? 50) : '',
        invoice ? `${invoice.id} | ${translateEntity(invoice.status, lang)} | ${Number(invoice.amount || 0).toLocaleString()} EGP` : (isAr ? 'غير مفوترة' : 'Not invoiced')
      ];
    });

    const exportedAt = new Date().toLocaleString(isAr ? 'ar-EG' : 'en-GB');
    const sheet = XLSX.utils.aoa_to_sheet([
      ['NILE FLEET COMMAND'],
      [`${isAr ? 'السجل الرئيسي' : 'MASTER VIEW'}  •  ${isAr ? 'تاريخ التصدير' : 'EXPORTED'}: ${exportedAt}`],
      [`${isAr ? 'عدد السجلات' : 'RECORDS'}: ${exportRows.length}`],
      headers,
      ...exportRows
    ]);
    const lastRow = exportRows.length + 4;
    const lastColumn = headers.length - 1;
    const lastColumnLetter = XLSX.utils.encode_col(lastColumn);
    const navy = isDark ? '001224' : '001F3F';
    const gold = 'C2A378';
    const border = { style: 'thin', color: { rgb: isDark ? '334155' : 'D8E0E9' } };
    const baseStyle = {
      font: { name: 'Arial', sz: 10, color: { rgb: isDark ? 'E2E8F0' : '1E293B' } },
      alignment: { horizontal: isAr ? 'right' : 'left', vertical: 'center', wrapText: true },
      border: { top: border, bottom: border, left: border, right: border },
    };

    sheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastColumn } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: lastColumn } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: lastColumn } },
    ];
    sheet['!autofilter'] = { ref: `A4:${lastColumnLetter}${lastRow}` };
    sheet['!cols'] = [
      { wch: 6 }, { wch: 18 }, { wch: 24 }, { wch: 18 }, { wch: 18 },
      { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 16 },
      { wch: 14 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 18 },
      { wch: 18 }, { wch: 34 }, { wch: 12 }, { wch: 38 }
    ];
    sheet['!rows'] = [{ hpt: 28 }, { hpt: 24 }, { hpt: 20 }, { hpt: 26 }];

    for (let c = 0; c <= lastColumn; c++) {
      const titleCell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
      if (titleCell) titleCell.s = {
        fill: { patternType: 'solid', fgColor: { rgb: navy } },
        font: { name: 'Arial', sz: 16, bold: true, color: { rgb: gold } },
        alignment: { horizontal: isAr ? 'right' : 'left', vertical: 'center' }
      };
      const metaCell = sheet[XLSX.utils.encode_cell({ r: 1, c })];
      if (metaCell) metaCell.s = {
        fill: { patternType: 'solid', fgColor: { rgb: navy } },
        font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: isAr ? 'right' : 'left', vertical: 'center' }
      };
      const countCell = sheet[XLSX.utils.encode_cell({ r: 2, c })];
      if (countCell) countCell.s = {
        fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
        font: { name: 'Arial', sz: 9, bold: true, color: { rgb: navy } },
        alignment: { horizontal: isAr ? 'right' : 'left', vertical: 'center' }
      };
      const headerCell = sheet[XLSX.utils.encode_cell({ r: 3, c })];
      if (headerCell) headerCell.s = {
        fill: { patternType: 'solid', fgColor: { rgb: navy } },
        font: { name: 'Arial', sz: 9, bold: true, color: { rgb: gold } },
        alignment: { horizontal: isAr ? 'right' : 'left', vertical: 'center', wrapText: true },
        border: { bottom: { style: 'medium', color: { rgb: gold } } }
      };
    }

    const portColumnColors: Record<string, { fill: string; text: string }> = isDark ? {
      DAM: { fill: '123426', text: '6EE7B7' }, ALEX: { fill: '3A3412', text: 'FDE047' },
      GOUDA: { fill: '172E4F', text: '93C5FD' }, SOKHNA: { fill: '3F2A1C', text: 'FDBA74' },
      SCCT: { fill: '123044', text: '7DD3FC' }, PSD: { fill: '30204F', text: 'C4B5FD' },
      MAL: { fill: '183822', text: '86EFAC' }, WORKSHOP: { fill: '253341', text: 'CBD5E1' }
    } : {
      DAM: { fill: '98FFD9', text: '004D33' }, ALEX: { fill: 'FFEB3B', text: '5D4037' },
      GOUDA: { fill: '2196F3', text: 'FFFFFF' }, SOKHNA: { fill: 'FF9800', text: 'FFFFFF' },
      SCCT: { fill: '87CEEB', text: '003366' }, PSD: { fill: '7E57C2', text: 'FFFFFF' },
      MAL: { fill: '4CAF50', text: 'FFFFFF' }, WORKSHOP: { fill: '90A4AE', text: 'FFFFFF' }
    };
    const statusColors: Record<string, { fill: string; text: string }> = {
      DONE: { fill: 'D1FAE5', text: '065F46' },
      'IN PROGRESS': { fill: 'DBEAFE', text: '1E40AF' },
      'UNDER OPERATE': { fill: 'FEF3C7', text: '92400E' },
      HOLD: { fill: 'F1F5F9', text: '475569' },
      CANCEL: { fill: 'FEE2E2', text: '991B1B' }
    };
    exportRows.forEach((row, rowIndex) => {
      const excelRow = rowIndex + 4;
      for (let c = 0; c <= lastColumn; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r: excelRow, c })];
        if (!cell) continue;
        cell.s = {
          ...baseStyle,
          fill: { patternType: 'solid', fgColor: { rgb: rowIndex % 2 === 0 ? (isDark ? '0F172A' : 'FFFFFF') : (isDark ? '111C2E' : 'F8FAFC') } }
        };
        if (c === 5 || c === 6) {
          const sourcePort = c === 5 ? filteredAndSortedOps[rowIndex]?.clipOnPort : filteredAndSortedOps[rowIndex]?.clipOffPort;
          const port = portColumnColors[String(sourcePort || '').toUpperCase()];
          if (port) cell.s = { ...cell.s, fill: { patternType: 'solid', fgColor: { rgb: port.fill } }, font: { ...baseStyle.font, bold: true, color: { rgb: port.text } }, alignment: { ...baseStyle.alignment, horizontal: 'center' } };
        } else if (c === 11) {
          const status = statusColors[String(filteredAndSortedOps[rowIndex]?.status || '').toUpperCase()];
          if (status) cell.s = { ...cell.s, fill: { patternType: 'solid', fgColor: { rgb: status.fill } }, font: { ...baseStyle.font, bold: true, color: { rgb: status.text } }, alignment: { ...baseStyle.alignment, horizontal: 'center' } };
        } else if (c === 10) {
          cell.z = '#,##0.00';
          cell.s = { ...cell.s, font: { ...baseStyle.font, bold: true, color: { rgb: isDark ? '93C5FD' : '1E40AF' } }, alignment: { ...baseStyle.alignment, horizontal: 'right' } };
        }
      }
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, isAr ? 'السجل الرئيسي' : 'Master View');
    XLSX.writeFile(workbook, `Nile_Fleet_Master_View_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const dynamicCellStyle = { paddingTop: `${viewPrefs.density}px`, paddingBottom: `${viewPrefs.density}px` };
  const globalScaleStyle = { fontSize: `${(viewPrefs.scale / 100) * 10}px` };

  return (
    <div className={`w-full space-y-4 animate-in fade-in duration-500 pb-24 text-start ${isAr ? 'rtl font-cairo' : 'ltr'}`} style={globalScaleStyle}>
      <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} p-3 rounded-2xl shadow-sm border flex flex-col xl:flex-row gap-3 items-center`}>
        <div className="flex-1 relative w-full">
          <input 
            type="text" 
            placeholder={isAr ? 'بحث في السجل التشغيلي...' : 'Operational manifest lookup...'} 
            className={`w-full ${isAr ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'} py-2 border-2 rounded-xl font-bold outline-none focus:border-blue-400 shadow-inner transition-all ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-transparent text-black'}`} 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
          <svg className={`absolute ${isAr ? 'right-3' : 'left-3'} top-2.5 h-4 w-4 text-slate-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex items-center gap-1 bg-black/10 dark:bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={shrinkAllColumns}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[9px] font-black uppercase flex items-center gap-1 transition-all shadow"
              title={isAr ? "تقليص عرض جميع الأعمدة لليسار" : "Shrink all columns left"}
            >
              <span>◄</span> {isAr ? 'تقليص الأعمدة' : 'Shrink All'}
            </button>
            <button
              type="button"
              onClick={expandAllColumns}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[9px] font-black uppercase flex items-center gap-1 transition-all shadow"
              title={isAr ? "توسيع عرض جميع الأعمدة لليمين" : "Expand all columns right"}
            >
              {isAr ? 'توسيع الأعمدة' : 'Expand All'} <span>►</span>
            </button>
            <button
              type="button"
              onClick={resetColumnWidths}
              className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[9px] font-black uppercase transition-all"
              title={isAr ? "إعادة ضبط عرض الأعمدة الافتراضي" : "Reset column widths to default"}
            >
              ↺ {isAr ? 'إعادة ضبط' : 'Reset'}
            </button>
          </div>


          {!isReadOnly && (
            <button onClick={() => setShowAddModal(true)} className="bg-[#001F3F] text-[#C2A378] px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:scale-105 transition-all whitespace-nowrap">
              + {isAr ? 'إدخال جديد' : 'New Entry'}
            </button>
          )}
          {canExport && (
            <button type="button" onClick={handleExportData} className="bg-emerald-700 text-white px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-emerald-600 hover:scale-105 transition-all whitespace-nowrap flex items-center gap-2" title={isAr ? 'تصدير السجلات المعروضة إلى إكسل' : 'Export the current Master View rows to Excel'}>
              <span aria-hidden="true">⇩</span> {isAr ? 'تصدير البيانات' : 'Export Data'}
            </button>
          )}
          <DateFilterDropdown 
            filter={dateFilter} 
            onChange={setDateFilter} 
            isDark={isDark} 
            totalFilteredCount={filteredAndSortedOps.length} 
          />
          <MultiSelectDropdown label={t.port} options={allPorts} selected={selectedPorts} onChange={(vals: string[]) => setSelectedPorts(vals)} isDark={isDark} />
          <MultiSelectDropdown label={t.status} options={STATUS_CYCLE} selected={selectedStatuses} onChange={(vals: string[]) => setSelectedStatuses(vals)} isDark={isDark} />
        </div>
      </div>

      <div className={`rounded-3xl shadow-xl border overflow-hidden w-full ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="overflow-x-auto overflow-y-visible">
          <table className={`w-full ${isAr ? 'text-right' : 'text-left'} whitespace-nowrap border-collapse`}>
            <thead className={`text-white font-black uppercase tracking-widest sticky top-0 z-40 text-[9px] ${isDark ? 'bg-[#001224]' : 'bg-[#001F3F]'}`}>
              <tr>
                <th style={getColStyle('checkbox')} className="p-2 text-center border-r border-white/5 relative">
                  <input type="checkbox" className="rounded bg-transparent border-slate-500" checked={selectedRowIds.size === filteredAndSortedOps.length && filteredAndSortedOps.length > 0} onChange={() => {
                    if (selectedRowIds.size === filteredAndSortedOps.length) setSelectedRowIds(new Set());
                    else setSelectedRowIds(new Set(filteredAndSortedOps.map(op => op.id)));
                  }} disabled={isReadOnly} />
                </th>

                {[
                  { key: 'bookingNumber', label: t.bookingNum, sortable: true },
                  { key: 'customerName', label: t.client, sortable: true },
                  { key: 'trucker', label: t.trucker },
                  { key: 'shipper', label: t.shipper },
                  { key: 'clipOnPort', label: isAr ? 'دخول' : 'IN', extraClass: isDark ? 'bg-[#C2A378]/20' : 'bg-amber-100/50' },
                  { key: 'clipOffPort', label: isAr ? 'خروج' : 'OUT', extraClass: isDark ? 'bg-[#C2A378]/20' : 'bg-amber-100/50' },
                  { key: 'destination', label: isAr ? 'الوجهة' : 'DESTINATION', sortable: true },
                  { key: 'containerNumber', label: t.container },
                  { key: 'gensetNumber', label: isAr ? 'المولد' : 'Genset' },
                  { key: 'rate', label: t.rate, align: 'text-right' },
                  { key: 'status', label: t.status, align: 'text-center' },
                  { key: 'operationDate', label: isAr ? 'تاريخ التشغيل' : 'Op Date', align: 'text-center' },
                  { key: 'clipOnDate', label: isAr ? 'تاريخ التركيب' : 'Clip On', align: 'text-center', extraClass: isDark ? 'bg-emerald-950/20 text-emerald-400' : 'bg-emerald-600/10' },
                  { key: 'commodity', label: isAr ? 'البضاعة' : 'COMMODITY', sortable: true },
                  { key: 'clipperName', label: isAr ? 'فني التركيب' : 'CLIPPER ON', sortable: true },
                  { key: 'notes', label: t.notes },
                  { key: 'gas', label: isAr ? 'الوقود (لتر)' : 'Gas (L)' },
                  { key: 'invoice', label: isAr ? 'فاتورة الحجز' : 'BOOKING INVOICE', align: 'text-center' }
                ].map(col => (
                  <th
                    key={col.key}
                    style={getColStyle(col.key)}
                    className={`p-2 border-r border-white/10 relative group/col select-none ${col.align || ''} ${col.extraClass || ''} ${col.sortable ? 'cursor-pointer hover:bg-white/10' : ''}`}
                    onClick={col.sortable ? () => requestSort(col.key as keyof Operation) : undefined}
                  >
                    <div className="flex items-center justify-between gap-1 w-full overflow-hidden">
                      <span className="truncate">{col.label}</span>
                      <div className="hidden group-hover/col:flex items-center gap-0.5 shrink-0 opacity-90 hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); shrinkColumn(col.key); }}
                          className="px-1 bg-black/40 hover:bg-blue-600 rounded text-[8px] font-black leading-tight text-white"
                          title={isAr ? "تقليص العرض" : "Shrink width"}
                        >
                          ◄
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); expandColumn(col.key); }}
                          className="px-1 bg-black/40 hover:bg-blue-600 rounded text-[8px] font-black leading-tight text-white"
                          title={isAr ? "توسيع العرض" : "Expand width"}
                        >
                          ►
                        </button>
                      </div>
                    </div>
                    <div
                      onMouseDown={(e) => handleMouseDownResize(e, col.key)}
                      className="absolute top-0 right-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/80 z-20"
                      title={isAr ? "اسحب لتغيير الحجم" : "Drag to resize"}
                    />
                  </th>
                ))}
              </tr>
              <tr className={isDark ? 'bg-[#001224]' : 'bg-[#001F3F]'}>
                <th className="p-1 border-r border-white/10" />
                {['bookingNumber','customerName','trucker','shipper','clipOnPort','clipOffPort','destination','containerNumber','gensetNumber','rate','status','operationDate','clipOnDate','commodity','clipperName','notes','gas','invoice'].map(key => {
                  const value = columnSearches[key] || '';
                  return (
                    <th key={key} className="p-1 border-r border-white/10">
                      <div className="relative">
                        <input
                          type="search"
                          value={value}
                          onChange={e => setColumnSearches(prev => ({ ...prev, [key]: e.target.value }))}
                          onClick={e => e.stopPropagation()}
                          onKeyDown={e => e.stopPropagation()}
                          placeholder={isAr ? 'بحث...' : 'Search...'}
                          aria-label={isAr ? 'بحث في العمود' : 'Search column'}
                          className={`w-full min-w-0 px-2 py-1 rounded-md border text-[8px] font-bold outline-none ${isDark ? 'bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-400' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500'}`}
                        />
                        {value && (
                          <button
                            type="button"
                            onClick={() => setColumnSearches(prev => ({ ...prev, [key]: '' }))}
                            className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400 hover:text-red-500"
                            title={isAr ? 'مسح البحث' : 'Clear search'}
                          >✕</button>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {STATUS_CYCLE.map(status => {
                const group = filteredAndSortedOps.filter(o => o.status === status);
                if (group.length === 0) return null;
                return (
                  <React.Fragment key={status}>
                    <tr className={`sticky z-30 shadow-sm ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`} style={{ top: '35px' }}>
                      <td colSpan={18} className={`px-4 py-1.5 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                        <button type="button" onClick={() => setCollapsedStatusGroups(prev => { const next = new Set(prev); if (next.has(status)) next.delete(status); else next.add(status); return next; })} className="w-full flex items-center gap-3 text-start hover:bg-white/5 rounded-lg px-2 py-1 transition-all" aria-expanded={!collapsedStatusGroups.has(status)}>
                           <div className={`w-1.5 h-1.5 rounded-full ${status === 'DONE' ? 'bg-emerald-500' : status === 'IN PROGRESS' ? 'bg-blue-500' : status === 'UNDER OPERATE' ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
                           <span className={`font-black uppercase tracking-[0.2em] text-[9px] ${isDark ? 'text-[#C2A378]' : 'text-[#001F3F]'}`}>{translateEntity(status, lang)}</span>
                           <span className={`px-1.5 py-0.5 rounded text-[7px] font-black ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-[#001F3F] text-white'}`}>{group.length} {isAr ? 'وحدة' : 'UNITS'}</span>
                        <span className={`ml-auto text-[8px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{collapsedStatusGroups.has(status) ? (isAr ? 'فتح' : 'Expand') : (isAr ? 'طي' : 'Collapse')}</span>
                        </button>
                      </td>
                    </tr>
                    {!collapsedStatusGroups.has(status) && group.map((op) => {
                      const isSelected = selectedRowIds.has(op.id);
                      const isContainerDup = Boolean(op.containerNumber?.trim() && duplicateContainerNumbers.has(op.containerNumber.trim().toUpperCase()));
                      const isGensetDup = Boolean(
                        op.status === 'IN PROGRESS' &&
                        op.gensetNumber?.trim() &&
                        duplicateActiveGensets.has(op.gensetNumber.trim().toUpperCase())
                      );

                      const portBadgeStyle = (loc: Location) => {
                         const style = PORT_STYLING[loc];
                         if (!style) return { className: isDark ? 'bg-slate-900 text-white border-slate-700' : 'bg-white text-slate-900 border-slate-200', style: undefined };
                         if (isDark) return { className: 'border font-black text-[8px] px-2 py-0.5 rounded-md backdrop-blur-sm', style: getDarkPortStyle(loc) };
                         return { className: `${style.bg} ${getContrastColor(style.bg, false)} ${style.border} border px-2 py-0.5 rounded-md font-black text-[8px]`, style: undefined };
                      };
                      return (
                        <tr key={op.id} className={`transition-all duration-200 group ${isSelected ? 'selected-row ' + (isDark ? 'bg-blue-900/40 text-white' : 'bg-blue-600 text-white') : (isDark ? 'hover:bg-white/5' : 'hover:bg-blue-50/50')}`}>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('checkbox') }} className={`text-center border-r ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                            <input type="checkbox" className="rounded bg-transparent border-slate-500" checked={isSelected} onChange={() => {
                                const newSet = new Set(selectedRowIds);
                                if (newSet.has(op.id)) newSet.delete(op.id);
                                else newSet.add(op.id);
                                setSelectedRowIds(newSet);
                              }} disabled={isReadOnly} />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('bookingNumber') }} className={`px-2 border-r ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                            <EditableCell value={op.bookingNumber} onSave={(val) => handleUpdateCell(op, 'bookingNumber', val)} disabled={isReadOnly} isDark={isDark} className={`font-black ${isSelected ? 'text-white' : op.reviewedByManager ? 'text-emerald-500' : (isDark ? 'text-blue-400' : 'text-blue-600')}`} />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('customerName') }} className={`px-2 border-r ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                            <EditableCell value={translateEntity(op.customerName, lang)} onSave={(val) => handleUpdateCell(op, 'customerName', val)} disabled={isReadOnly} suggestions={systemSuggestions.customers} isDark={isDark} className={`${isSelected ? 'text-white' : ((op.customerName || '').trim() && !customerNameKeys.has((op.customerName || '').trim().toLowerCase()) ? 'text-red-500 font-black' : (isDark ? 'text-slate-300' : 'text-slate-800'))} font-bold uppercase`} />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('trucker') }} className={`px-2 border-r ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                            <EditableCell value={translateEntity(op.trucker, lang)} onSave={(val) => handleUpdateCell(op, 'trucker', val)} disabled={isReadOnly} isDark={isDark} className={`${isSelected ? 'text-white' : 'text-slate-500'} font-bold uppercase text-[9px]`} placeholder={t.trucker} />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('shipper') }} className={`px-2 border-r ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                            <EditableCell value={translateEntity(op.beneficiaryName, lang)} onSave={(val) => handleUpdateCell(op, 'beneficiaryName', val)} disabled={isReadOnly} isDark={isDark} className={`${isSelected ? 'text-white' : 'text-slate-500'} font-bold uppercase text-[9px]`} placeholder={t.shipper} />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('clipOnPort') }} className={`text-center border-r ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                             <EditableCell 
                                value={op.clipOnPort} 
                                options={allPorts}
                                onSave={(val) => handleUpdateCell(op, 'clipOnPort', val)} 
                                disabled={isReadOnly} 
                                isDark={isDark} 
                                renderValue={(v) => <span className={`${portBadgeStyle(v as Location).className} inline-block`} style={portBadgeStyle(v as Location).style}>{translateEntity(v, lang)}</span>}
                             />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('clipOffPort') }} className={`text-center border-r ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                             <EditableCell 
                                value={op.clipOffPort} 
                                options={allPorts}
                                onSave={(val) => handleUpdateCell(op, 'clipOffPort', val)} 
                                disabled={isReadOnly} 
                                isDark={isDark} 
                                renderValue={(v) => <span className={`${portBadgeStyle(v as Location).className} inline-block`} style={portBadgeStyle(v as Location).style}>{translateEntity(v, lang)}</span>}
                             />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('destination') }} className={`px-2 border-r ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                            <EditableCell value={op.destination || ''} onSave={(val) => handleUpdateCell(op, 'destination', val)} disabled={isReadOnly} isDark={isDark} className={`${isSelected ? 'text-white' : (isDark ? 'text-slate-300' : 'text-slate-800')} font-bold uppercase text-[9px]`} placeholder={isAr ? 'الوجهة' : 'DESTINATION'} />
                          </td>
                          <td 
                            style={{ ...dynamicCellStyle, ...getColStyle('containerNumber') }} 
                            className={`px-2 border-r transition-all duration-300 ${isContainerDup ? 'bg-red-500 !text-black font-black shadow-md border-2 border-red-700' : isDark ? 'border-slate-800' : 'border-slate-50'}`}
                            title={isContainerDup ? (isAr ? 'تنبيه: رقم الحاوية مكرر في السجل!' : 'WARNING: Duplicate Container Number in manifest!') : undefined}
                          >
                            <div className="flex items-center gap-1">
                              {isContainerDup && <span className="text-[10px] shrink-0">⚠️</span>}
                              <EditableCell value={op.containerNumber} onSave={(val) => handleUpdateCell(op, 'containerNumber', val)} disabled={isReadOnly} isDark={isDark} className={`font-mono font-black ${isContainerDup ? '!text-black font-extrabold' : isSelected ? 'text-white' : (isDark ? 'text-slate-200' : 'text-slate-900')}`} placeholder="CONT#" />
                            </div>
                          </td>
                          <td 
                            style={{ ...dynamicCellStyle, ...getColStyle('gensetNumber') }} 
                            className={`px-2 border-r text-center transition-all duration-300 ${isGensetDup ? 'bg-red-600 !text-white font-black shadow-md' : isDark ? 'border-slate-800' : 'border-slate-50'}`}
                            title={isGensetDup ? (isAr ? 'تنبيه: المولد مستخدم في أكثر من عملية IN PROGRESS!' : 'WARNING: Genset unit assigned to multiple IN PROGRESS operations!') : undefined}
                          >
                            <div className="flex items-center justify-center gap-1">
                              {isGensetDup && <span className="text-[10px] shrink-0">⚡</span>}
                              <EditableCell value={op.gensetNumber} suggestions={systemSuggestions.gensets} onSave={(val) => handleUpdateCell(op, 'gensetNumber', val)} disabled={isReadOnly} className={`font-black ${isGensetDup ? '!text-black font-extrabold' : isSelected ? 'text-blue-100' : 'text-[#C2A378]'}`} placeholder="UNIT" isDark={isDark} />
                            </div>
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('rate') }} className={`border-r text-right px-2 font-bold ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                             <EditableCell 
                                value={op.rate} 
                                type="number"
                                onSave={(val) => handleUpdateCell(op, 'rate', val)} 
                                disabled={isReadOnly} 
                                isDark={isDark} 
                                className={`${isSelected ? 'text-white' : (isDark ? 'text-blue-300' : 'text-blue-800')}`} 
                             />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('status') }} className={`border-r text-center ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                            <select disabled={isReadOnly} className={`px-1.5 py-0.5 rounded font-black text-[7px] shadow-sm outline-none transition-all ${isDark ? 'bg-slate-800 text-[#C2A378] border-slate-700' : 'bg-white text-slate-900 border-slate-200'}`} value={op.status} onChange={(e) => handleUpdateCell(op, 'status', e.target.value as any)}>
                              {STATUS_CYCLE.map(s => <option key={s} value={s} className="bg-slate-900 text-white">{translateEntity(s, lang)}</option>)}
                            </select>
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('operationDate') }} className={`border-r text-center font-bold px-2 ${isDark ? 'border-slate-800' : 'border-slate-50'} ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                            <EditableCell 
                              value={op.operationDate} 
                              type="date"
                              onSave={(val) => handleUpdateCell(op, 'operationDate', val)} 
                              disabled={isReadOnly} 
                              isDark={isDark} 
                              className="font-bold text-center justify-center"
                            />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('clipOnDate') }} className={`border-r text-center font-bold px-2 ${isDark ? 'border-slate-800' : 'border-slate-50'} ${isSelected ? 'bg-blue-900/50' : (isDark ? 'bg-emerald-950/20 text-emerald-400' : 'bg-emerald-600/10')}`}>
                            <EditableCell 
                              value={op.clipOnDate || ''} 
                              type="date"
                              onSave={(val) => handleUpdateCell(op, 'clipOnDate', val)} 
                              disabled={isReadOnly} 
                              isDark={isDark} 
                              className="font-bold text-center justify-center"
                              placeholder="---"
                            />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('commodity') }} className={`px-2 border-r ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                            <EditableCell 
                              value={op.commodity || ''} 
                              suggestions={systemSuggestions.commodities} 
                              onSave={(val) => handleUpdateCell(op, 'commodity', val.toUpperCase())} 
                              disabled={isReadOnly} 
                              isDark={isDark} 
                              className={`${isSelected ? 'text-white' : (isDark ? 'text-amber-300' : 'text-amber-800')} font-bold uppercase text-[9px]`} 
                              placeholder={isAr ? 'البضاعة' : 'COMMODITY'} 
                            />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('clipperName') }} className={`px-2 border-r ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                            <EditableCell 
                              value={op.clipperName || ''} 
                              suggestions={systemSuggestions.clippers} 
                              onSave={(val) => handleUpdateCell(op, 'clipperName', val)} 
                              disabled={isReadOnly} 
                              isDark={isDark} 
                              className={`${isSelected ? 'text-white' : (isDark ? 'text-emerald-400' : 'text-emerald-700')} font-bold uppercase text-[9px]`} 
                              placeholder={isAr ? 'فني التركيب' : 'CLIPPER'} 
                            />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('notes') }} className={`px-2 border-r ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                            <EditableCell value={op.notes || ''} onSave={(val) => handleUpdateCell(op, 'notes', val)} disabled={isReadOnly} isDark={isDark} className={`${isSelected ? 'text-white/60' : 'text-slate-400'} italic`} />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('gas') }} className={`px-2 border-r text-center ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                            {(() => {
                              const genset = db.getStock().find(item => item.unitNumber.trim().toUpperCase() === (op.gensetNumber || '').trim().toUpperCase());
                              return genset ? (
                                <EditableCell
                                  value={String(genset.gasLiters ?? 50)}
                                  type="number"
                                  onSave={value => handleUpdateGensetGas(genset.unitNumber, value)}
                                  disabled={isReadOnly}
                                  isDark={isDark}
                                  className={`font-black ${isSelected ? 'text-white' : 'text-cyan-600 dark:text-cyan-300'}`}
                                  placeholder="50"
                                />
                              ) : <span className="text-slate-400" title={isAr ? 'المولد غير مسجل في مخزون المولدات' : 'Genset is not registered in Genset Stock'}>—</span>;
                            })()}
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('invoice') }} className={`px-2 border-r text-center ${isDark ? 'border-slate-800 border-white/5' : 'border-slate-100'} text-xs font-bold`}>
                            {(() => {
                              const bookingInv = invoices.find(inv => inv.bookingNumber === op.bookingNumber);
                              if (bookingInv) {
                                return (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button 
                                      onClick={() => setSelectedInvoice(bookingInv)} 
                                      title={isAr ? "عرض الفاتورة" : "Show Invoice"}
                                      className="p-1 px-1.5 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 text-[9px] transition-all"
                                    >
                                      👁️ {isAr ? "عرض" : "Show"}
                                    </button>
                                    <button 
                                      onClick={() => handleOpenEditInvoice(bookingInv)} 
                                      title={isAr ? "تعديل الفاتورة" : "Edit Invoice Details"}
                                      className="p-1 px-1.5 rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-[9px] transition-all"
                                    >
                                      ✏️ {isAr ? "تعديل" : "Edit"}
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setSelectedInvoice(bookingInv);
                                        setTimeout(() => {
                                          window.print();
                                        }, 300);
                                      }} 
                                      title={isAr ? "طباعة / تحميل PDF" : "Print / PDF"}
                                      className="p-1 px-1.5 rounded bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-[9px] transition-all"
                                    >
                                      📥 {isAr ? "ملف" : "PDF"}
                                    </button>
                                  </div>
                                );
                              } else {
                                return (
                                  <button 
                                    onClick={() => handleQuickGenerateInvoice(op.bookingNumber, op.customerName)} 
                                    className="px-2 py-1 text-[8px] font-black uppercase tracking-wider rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all"
                                  >
                                    + {isAr ? 'إصدار فاتورة' : 'Issue Invoice'}
                                  </button>
                                );
                              }
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRowIds.size > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10 duration-500">
           <div className="bg-[#001F3F] text-white px-8 py-4 rounded-[2.5rem] shadow-2xl border-2 border-[#C2A378] flex items-center gap-10 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                 <span className="w-10 h-10 bg-[#C2A378] text-[#001F3F] rounded-full flex items-center justify-center font-black text-sm">{selectedRowIds.size}</span>
                 <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#C2A378]">{isAr ? 'وضع الإجراء المجمع' : 'Bulk Action Mode'}</p>
                    <p className="text-[9px] font-bold text-slate-400">{isAr ? 'عمليات مختارة' : 'Selected Entries'}</p>
                 </div>
              </div>
              <div className="h-10 w-px bg-white/10"></div>
              {!isReadOnly && (
                <button
                  onClick={handleCloneSelectedOperations}
                  className="bg-[#C2A378] text-[#001F3F] px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#d8bd91] transition-all shadow-lg"
                  title={isAr ? 'إضافة نسخة جديدة من العمليات المحددة' : 'Add a new copy of the selected operations'}
                >
                  + {isAr ? 'نسخ السطر' : 'Clone Line'}
                </button>
              )}
              <div className="flex items-center gap-4">
                 <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">{isAr ? 'تغيير الحالة لـ:' : 'Target Status:'}</p>
                 <select className="bg-white/10 text-white border border-white/20 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none focus:border-[#C2A378] transition-all" onChange={(e) => handleBulkStatusChange(e.target.value as any)} defaultValue="">
                    <option value="" disabled>-- {isAr ? 'اختر الحالة' : 'Select Status'} --</option>
                    {STATUS_CYCLE.map(s => <option key={s} value={s} className="bg-slate-900">{translateEntity(s, lang)}</option>)}
                 </select>
              </div>
              {isAdmin && <button onClick={handleBulkDelete} className="bg-rose-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg">{isAr ? 'حذف إجباري' : 'Force Delete'}</button>}
              <button onClick={() => setSelectedRowIds(new Set())} className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">{isAr ? 'إلغاء' : 'Clear'}</button>
           </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-[#001F3F]/95 backdrop-blur-2xl z-[500] flex items-center justify-center p-4">
          <div className={`rounded-[3.5rem] shadow-2xl max-w-[98vw] w-full h-[85vh] overflow-hidden border-[10px] border-slate-900 flex flex-col animate-in zoom-in-95 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-900'}`}>
             <div className={`p-8 flex justify-between items-center shrink-0 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-900 text-white'}`}>
                <div className="text-start">
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter text-[#C2A378]">{isAr ? 'حقن بيانات السجل المجمع' : 'Bulk Manifest Staging'}</h3>
                  <p className="text-[9px] font-bold tracking-wide text-slate-300">{isAr ? 'أدخل البيانات يدوياً أو الصق صفوفاً مفصولة بعلامات تبويب. أضف تاريخ العملية ثم تاريخ التركيب كآخر عمودين اختياريين.' : 'Enter rows manually or paste tab-separated data. Optionally append Operation Date, then Clip On Date.'}</p>
                </div>
                <div className="flex gap-4">
                   <textarea 
                     className="w-48 h-10 p-2 bg-slate-800 border border-slate-500 rounded-xl text-[10px] font-bold text-white placeholder:text-slate-300 outline-none focus:w-80 focus:h-20 focus:ring-2 focus:ring-[#C2A378] transition-all"
                     placeholder={isAr ? 'الصق البيانات هنا...' : 'Paste tab-separated rows...'}
                     value={rawPasteBuffer} 
                     onChange={(e) => setRawPasteBuffer(e.target.value)}
                   />
                   <button type="button" onClick={() => fallbackParse(rawPasteBuffer)} className="px-4 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white text-[9px] font-black uppercase tracking-wider">{isAr ? 'تحميل الصفوف' : 'Load Rows'}</button>
                   <button onClick={() => setShowAddModal(false)} className="text-white hover:text-rose-500 p-2">✕</button>
                </div>
             </div>
             <div className="flex-1 overflow-auto p-4 relative" style={{ backgroundColor: isDark ? '#0b1220' : '#f1f5f9' }}>
                <table className="manifest-staging-table w-max min-w-full text-start whitespace-nowrap border-collapse" style={{ tableLayout: 'fixed' }}>
                   <colgroup>{stagingColumnHeaders.map(column => <col key={column.key} style={{ width: stagingColWidths[column.key] ?? stagingColumnDefaults[column.key] }} />)}</colgroup>
                   <thead className="bg-[#001F3F] text-white text-[9px] font-black uppercase tracking-widest sticky top-0 z-10">
                      <tr>{stagingColumnHeaders.map(column => <th key={column.key} className="p-3 relative text-start" style={{ width: stagingColWidths[column.key] ?? stagingColumnDefaults[column.key], minWidth: stagingColWidths[column.key] ?? stagingColumnDefaults[column.key] }}>
                        <span>{column.label}</span>
                        {column.key !== 'row' && <span onMouseDown={event => startStagingColumnResize(event, column.key)} className="absolute top-0 right-0 h-full w-2 cursor-col-resize hover:bg-[#C2A378]" title={isAr ? 'اسحب لتغيير العرض بحرية' : 'Drag to resize this column'} />}
                      </th>)}</tr>
                   </thead>
                   <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                      {stagedOps.map((o, idx) => (
                        <tr key={idx} className={`${isDark ? 'hover:bg-white/5' : 'hover:bg-blue-50/50'}`}>
                           <td className={`p-4 font-black text-[9px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{idx + 1}</td>
                           <td className="p-2"><input type="number" className={`${stagingFieldClass} text-center`} value={o.quantity} onChange={e => updateStagedRow(idx, 'quantity', parseInt(e.target.value) || 1)} /></td>
                           <td className="p-2">
                             <input list="partners" className={`${stagingFieldClass} uppercase`} value={o.customerName} onChange={e => updateStagedRow(idx, 'customerName', e.target.value.toUpperCase())} />
                             {isAr && <p className={`text-[8px] font-bold mt-1 ${isDark ? 'text-sky-300' : 'text-blue-700'}`}>{translateEntity(o.customerName, 'ar')}</p>}
                           </td>
                           <td className="p-2"><input className={`${stagingFieldClass} uppercase`} value={o.bookingNumber} onChange={e => updateStagedRow(idx, 'bookingNumber', e.target.value.toUpperCase())} /></td>
                           <td className="p-2"><input type="date" className={stagingFieldClass} style={{ colorScheme: isDark ? 'dark' : 'light' }} value={o.operationDate || todayDate} onChange={e => updateStagedRow(idx, 'operationDate', e.target.value)} /></td>
                           <td className="p-2"><input type="date" className={stagingFieldClass} style={{ colorScheme: isDark ? 'dark' : 'light' }} value={o.clipOnDate} onChange={e => updateStagedRow(idx, 'clipOnDate', e.target.value)} /></td>
                           <td className="p-2">
                              <select className={stagingFieldClass} value={o.clipOnPort} onChange={e => updateStagedRow(idx, 'clipOnPort', e.target.value as any)}>
                                {allPorts.map(p => <option key={p} value={p}>{translateEntity(p, lang)}</option>)}
                              </select>
                           </td>
                           <td className="p-2">
                              <select className={stagingFieldClass} value={o.clipOffPort} onChange={e => updateStagedRow(idx, 'clipOffPort', e.target.value as any)}>
                                {allPorts.map(p => <option key={p} value={p}>{translateEntity(p, lang)}</option>)}
                              </select>
                           </td>
                           <td className="p-2">
                             <input className={`${stagingFieldClass} uppercase`} placeholder={isAr ? 'الوجهة النهائية' : 'Final destination'} value={o.destination || ''} onChange={e => updateStagedRow(idx, 'destination', e.target.value)} />
                           </td>
                           <td className="p-2"><input type="number" className={`${stagingFieldClass} text-right`} value={o.rate} onChange={e => updateStagedRow(idx, 'rate', e.target.value)} /></td>
                           <td className="p-2">
                             <input list="shippers" className={`${stagingFieldClass} uppercase`} value={o.beneficiaryName} onChange={e => updateStagedRow(idx, 'beneficiaryName', e.target.value.toUpperCase())} />
                             {isAr && <p className={`text-[8px] font-bold mt-1 ${isDark ? 'text-sky-300' : 'text-blue-700'}`}>{translateEntity(o.beneficiaryName, 'ar')}</p>}
                           </td>
                           <td className="p-2">
                             <input list="truckers" className={`${stagingFieldClass} uppercase`} value={o.trucker} onChange={e => updateStagedRow(idx, 'trucker', e.target.value.toUpperCase())} />
                             {isAr && <p className={`text-[8px] font-bold mt-1 ${isDark ? 'text-sky-300' : 'text-blue-700'}`}>{translateEntity(o.trucker, 'ar')}</p>}
                           </td>
                           <td className="p-2"><input className={`${stagingFieldClass} uppercase`} placeholder="e.g. CITRUS" value={o.commodity || ''} onChange={e => updateStagedRow(idx, 'commodity', e.target.value.toUpperCase())} /></td>
                           <td className="p-2 text-center"><div className="flex items-center justify-center gap-2">
                              <button onClick={() => duplicateRow(idx)} className={`hover:scale-125 transition-transform p-2 rounded-lg shadow-sm ${isDark ? 'text-sky-200 bg-sky-950 hover:bg-sky-900' : 'text-blue-700 bg-blue-50 hover:bg-blue-100'}`} title={isAr ? 'تكرار الصف' : 'Duplicate Row'}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                              </button>
                              <button onClick={() => setStagedOps(stagedOps.filter((_, i) => i !== idx))} className={`hover:scale-125 transition-transform p-2 rounded-lg shadow-sm ${isDark ? 'text-rose-200 bg-rose-950 hover:bg-rose-900' : 'text-rose-700 bg-rose-50 hover:bg-rose-100'}`} title={isAr ? 'حذف الصف' : 'Remove row'}>✕</button>
                           </div></td>
                        </tr>
                      ))}
                   </tbody>
                </table>
                <button onClick={() => setStagedOps([...stagedOps, { customerName: '', bookingNumber: '', commodity: '', operationDate: todayDate, clipOnDate: todayDate, status: 'UNDER OPERATE', rate: '0', vat: '0', clipOnPort: Location.ALEX, clipOffPort: Location.ALEX, trucker: '', beneficiaryName: '', quantity: 1 }])} className={`mt-4 w-full py-4 border-2 border-dashed rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${isDark ? 'border-slate-600 text-slate-200 hover:bg-white/5' : 'border-slate-300 text-slate-700 hover:bg-white'}`}>{isAr ? '+ إضافة سطر فارغ' : '+ Add Empty Row'}</button>
             </div>
             <div className={`p-8 shrink-0 flex gap-4 border-t ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <button type="button" onClick={() => setShowAddModal(false)} className="px-10 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest hover:text-rose-500 transition-colors">{t.cancel}</button>
                <button onClick={handleFinalInject} className="flex-1 bg-[#C2A378] text-[#001F3F] py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.4em] shadow-2xl active:scale-95 transition-all">
                  {isAr ? 'اعتماد حقن البيانات' : 'AUTHORIZE BATCH INJECTION'} ({stagedOps.reduce((sum, o) => sum + (o.bookingNumber && o.customerName ? (o.quantity || 1) : 0), 0)} {isAr ? 'وحدة' : 'UNITS'})
                </button>
             </div>
          </div>
        </div>
      )}

       {/* Show Invoice Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 overflow-y-auto no-print">
          <div className={`relative w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden p-6 ${isDark ? 'bg-slate-950 border-2 border-slate-800 text-white' : 'bg-white text-slate-900 border border-slate-200'}`}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-dashed border-slate-200 dark:border-white/10">
              <span className="text-sm font-black text-[#C2A378] tracking-widest uppercase">{isAr ? 'عرض تفاصيل الفاتورة' : 'INVOICE PREVIEW'}</span>
              <button 
                onClick={() => setSelectedInvoice(null)} 
                className="p-1 px-3 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 font-black text-xs transition-all"
              >
                ✕ {isAr ? 'إغلاق' : 'CLOSE'}
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto">
              <InvoiceView 
                invoice={selectedInvoice} 
                onClose={() => setSelectedInvoice(null)} 
                settings={db.getUsers().find(u => u.role === UserRole.ADMIN)?.invoiceSettings} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {editingInvoice && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-[110] p-4 no-print text-slate-900 dark:text-white">
          <div className="w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
              <h3 className="font-sans font-black uppercase text-xs tracking-widest text-slate-800 dark:text-white">
                {isAr ? 'تعديل بيانات الفاتورة' : 'EDIT INVOICE DETAILS'}
              </h3>
              <button onClick={() => setEditingInvoice(null)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                ✕
              </button>
            </div>

            <div className="space-y-5 text-left font-sans p-6">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
                  {isAr ? 'رقم مرجع الفاتورة' : 'Invoice Reference'}
                </label>
                <input 
                  type="text" 
                  disabled
                  value={editingInvoice.id} 
                  className="w-full px-4 py-3 rounded-xl border-2 text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed border-slate-200 dark:border-white/5"
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
                  {isAr ? 'الحالة المالية' : 'Financial Status'}
                </label>
                <select 
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className={`w-full px-4 py-3 rounded-xl border-2 text-xs font-bold focus:outline-none focus:border-[#C2A378] ${
                    isDark ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="UNPAID">{isAr ? 'غير مدفوعة (مستحقة سريعة)' : 'UNPAID (Pending/Receivable)'}</option>
                  <option value="PAID">{isAr ? 'تم السداد وتسوية الحساب' : 'PAID (Fully Settled)'}</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
                  {isAr ? 'مستند مصلحة الضرائب الفاتورة الإلكترونية الموحدة' : 'ETA E-Invoice Compliance Status'}
                </label>
                <select 
                  value={editEtaStatus}
                  onChange={(e) => setEditEtaStatus(e.target.value as any)}
                  className={`w-full px-4 py-3 rounded-xl border-2 text-xs font-bold focus:outline-none focus:border-[#C2A378] ${
                    isDark ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="DRAFT">{isAr ? 'مسودة (لم تقدم بعد)' : 'DRAFT (Not Submitted)'}</option>
                  <option value="SUBMITTED">{isAr ? 'مستلم من مصلحة الضرائب (جارِ المعالجة)' : 'SUBMITTED (Pending validation)'}</option>
                  <option value="VALID">{isAr ? 'مقبول ونشط في المنصة الموحدة' : 'VALID (Fully Compliant)'}</option>
                  <option value="INVALID">{isAr ? 'مرفوض ويحتاج إعادة الفحص' : 'INVALID (Needs resolution)'}</option>
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-950 flex gap-3">
              <button 
                onClick={() => setEditingInvoice(null)} 
                className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-[#94A3B8] hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {t.cancel}
              </button>
              <button 
                onClick={handleSaveEditInvoice} 
                className="flex-1 bg-[#001F3F] text-white dark:bg-[#C2A378] dark:text-[#001F3F] py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:opacity-95 active:scale-95 transition-all"
              >
                {isAr ? 'حفظ التعديلات' : 'SAVE CHANGES'}
              </button>
            </div>
          </div>
        </div>
      )}

      <datalist id="partners">{systemSuggestions.customers.map(c => <option key={c} value={c} />)}</datalist>
      <datalist id="shippers">{systemSuggestions.shippers.map(c => <option key={c} value={c} />)}</datalist>
      <datalist id="truckers">{systemSuggestions.truckers.map(c => <option key={c} value={c} />)}</datalist>
      <datalist id="gensets">{systemSuggestions.gensets.map(g => <option key={g} value={g} />)}</datalist>
      <datalist id="containers">{systemSuggestions.containers.map(c => <option key={c} value={c} />)}</datalist>
    </div>
  );
};

export default MasterView;
