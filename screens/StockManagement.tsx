import React, { useState, useMemo, useContext, useEffect } from 'react';
import { db } from '../services/supabaseDb';
import { Location, GensetStatus, Genset, User, UserRole, GensetMaintenanceLog, MaintenanceServiceType, hasReadOnlyAccess } from '../types';
import { LanguageContext, ThemeContext } from '../App';
import { translations, translateEntity } from '../translations';
import { PORT_STYLING } from '../constants';

const SERVICE_TYPE_CONFIG: Record<MaintenanceServiceType, { labelEn: string; labelAr: string; color: string; icon: string }> = {
  OIL_CHANGE: { labelEn: 'Oil Change', labelAr: 'تغيير زيت وفلتر', color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400', icon: '🛢️' },
  FILTER_REPLACEMENT: { labelEn: 'Filter Replacement', labelAr: 'تغيير فلاتر', color: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400', icon: '⛽' },
  ENGINE_OVERHAUL: { labelEn: 'Engine Overhaul', labelAr: 'عمرة محرك', color: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/30 dark:text-rose-400', icon: '⚙️' },
  ELECTRICAL_CHECK: { labelEn: 'Electrical Check', labelAr: 'فحص كهربائي', color: 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-400', icon: '⚡' },
  ROUTINE_INSPECTION: { labelEn: 'Routine Inspection', labelAr: 'فحص دوري', color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400', icon: '🔍' },
  EMERGENCY_REPAIR: { labelEn: 'Emergency Repair', labelAr: 'إصلاح طارئ', color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400', icon: '🚨' },
  GENERAL_SERVICE: { labelEn: 'General Service', labelAr: 'صيانة عامة', color: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400', icon: '🔧' }
};

const MAINT_STATUS_CONFIG: Record<'COMPLETED' | 'IN_PROGRESS' | 'SCHEDULED', { labelEn: string; labelAr: string; color: string; badge: string }> = {
  COMPLETED: { labelEn: 'Completed', labelAr: 'مكتمل', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-300', badge: 'bg-emerald-500' },
  IN_PROGRESS: { labelEn: 'In Progress', labelAr: 'قيد التنفيذ', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300', badge: 'bg-amber-500 animate-pulse' },
  SCHEDULED: { labelEn: 'Scheduled', labelAr: 'مجدول', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300', badge: 'bg-blue-500' }
};

const StockManagement: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'black';
  const t = translations[lang];
  const isAr = lang === 'ar';

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}') as User, []);
  const isReadOnly = hasReadOnlyAccess(currentUser);
  const isAdmin = currentUser.role === UserRole.ADMIN;

  const [activeTab, setActiveTab] = useState<'visual' | 'inventory' | 'maintenance'>('visual');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStat, setFilterStat] = useState<string>('ALL');
  const [filterLoc, setFilterLoc] = useState<string>('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Maintenance Tab Specific Filters
  const [maintSearch, setMaintSearch] = useState('');
  const [maintFilterType, setMaintFilterType] = useState<string>('ALL');
  const [maintFilterStat, setMaintFilterStat] = useState<string>('ALL');
  const [maintFilterLoc, setMaintFilterLoc] = useState<string>('ALL');
  const [maintFilterUnit, setMaintFilterUnit] = useState<string>('ALL');

  // Genset CRUD Modals
  const [editingGenset, setEditingGenset] = useState<Genset | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newGenset, setNewGenset] = useState({
    unitNumber: '',
    location: Location.ALEX,
    status: GensetStatus.IN_STOCK
  });

  // Maintenance Log Modals
  const [selectedUnitForMaint, setSelectedUnitForMaint] = useState<Genset | null>(null);
  const [maintModalState, setMaintModalState] = useState<{
    isOpen: boolean;
    mode: 'add' | 'edit';
    log: Partial<GensetMaintenanceLog>;
  }>({
    isOpen: false,
    mode: 'add',
    log: {}
  });

  const [dbVersion, setDbVersion] = useState(0);

  useEffect(() => {
    const handleDbChange = () => setDbVersion(v => v + 1);
    window.addEventListener('db-undo-success', handleDbChange);
    return () => window.removeEventListener('db-undo-success', handleDbChange);
  }, []);

  const stock = useMemo(() => db.getStock(), [dbVersion]);
  const ops = useMemo(() => db.getOperations(), [dbVersion]);
  const maintenanceLogs = useMemo(() => db.getMaintenanceLogs(), [dbVersion]);

  // Filtered Stock
  const filteredStock = useMemo(() => {
    return stock.filter(s => {
      const matchesSearch = (s.unitNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStat = filterStat === 'ALL' || s.status === filterStat;
      const matchesLoc = filterLoc === 'ALL' || s.location === filterLoc;
      return matchesSearch && matchesStat && matchesLoc;
    }).sort((a, b) => a.unitNumber.localeCompare(b.unitNumber));
  }, [stock, searchTerm, filterStat, filterLoc]);

  // Filtered Maintenance Logs
  const filteredMaintLogs = useMemo(() => {
    return maintenanceLogs.filter(log => {
      const matchesSearch = 
        (log.gensetNumber || '').toLowerCase().includes(maintSearch.toLowerCase()) ||
        (log.technician || '').toLowerCase().includes(maintSearch.toLowerCase()) ||
        (log.description || '').toLowerCase().includes(maintSearch.toLowerCase()) ||
        (log.partsReplaced && log.partsReplaced.toLowerCase().includes(maintSearch.toLowerCase()));
      const matchesType = maintFilterType === 'ALL' || log.serviceType === maintFilterType;
      const matchesStat = maintFilterStat === 'ALL' || log.status === maintFilterStat;
      const matchesLoc = maintFilterLoc === 'ALL' || log.location === maintFilterLoc;
      const matchesUnit = maintFilterUnit === 'ALL' || log.gensetNumber.toUpperCase() === maintFilterUnit.toUpperCase();
      return matchesSearch && matchesType && matchesStat && matchesLoc && matchesUnit;
    });
  }, [maintenanceLogs, maintSearch, maintFilterType, maintFilterStat, maintFilterLoc, maintFilterUnit]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const inStock = stock.filter(s => s.status === GensetStatus.IN_STOCK).length;
    const clippedOn = stock.filter(s => s.status === GensetStatus.CLIPPED_ON).length;
    const inMaint = stock.filter(s => s.status === GensetStatus.MAINTENANCE).length;
    const activeMaintLogs = maintenanceLogs.filter(m => m.status === 'IN_PROGRESS').length;
    const scheduledMaintLogs = maintenanceLogs.filter(m => m.status === 'SCHEDULED').length;
    return {
      total: stock.length,
      inStock,
      clippedOn,
      inMaint,
      totalLogs: maintenanceLogs.length,
      activeMaintLogs,
      scheduledMaintLogs
    };
  }, [stock, maintenanceLogs]);

  // Genset Handlers
  const handleUpdateGenset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !editingGenset) return;

    const original = stock.find(s => s.id === editingGenset.id);
    const oldNumber = original?.unitNumber?.trim() || '';
    const newNumber = editingGenset.unitNumber.trim();

    if (!newNumber) return;

    // Renaming: make sure the new number isn't already taken by another unit
    if (oldNumber && oldNumber !== newNumber) {
      const clash = stock.find(s => s.id !== editingGenset.id && s.unitNumber.trim().toUpperCase() === newNumber.toUpperCase());
      if (clash) {
        alert(isAr
          ? `رقم المولد "${newNumber}" مستخدم بالفعل في ${clash.location}. اختر رقماً آخر.`
          : `Genset number "${newNumber}" already exists at ${clash.location}. Choose a different number.`);
        return;
      }

      const linkedOps = db.getOperations().filter(o => o.gensetNumber?.trim().toUpperCase() === oldNumber.toUpperCase());
      const linkedLogs = db.getMaintenanceLogs().filter(l => l.gensetNumber?.trim().toUpperCase() === oldNumber.toUpperCase());

      const confirmed = window.confirm(isAr
        ? `إعادة تسمية "${oldNumber}" إلى "${newNumber}".\n\nسيتم تحديث ${linkedOps.length} عملية و ${linkedLogs.length} سجل صيانة مرتبط. هل تريد المتابعة؟`
        : `Rename "${oldNumber}" to "${newNumber}".\n\nThis will also update ${linkedOps.length} linked operation(s) and ${linkedLogs.length} maintenance record(s). Continue?`);
      if (!confirmed) return;

      await db.updateGenset({ ...editingGenset, unitNumber: newNumber });

      // Cascade the rename so history stays linked to the unit
      for (const op of linkedOps) {
        await db.updateOperation({ ...op, gensetNumber: newNumber });
      }
      for (const log of linkedLogs) {
        await db.updateMaintenanceLog({ ...log, gensetNumber: newNumber });
      }
    } else {
      await db.updateGenset({ ...editingGenset, unitNumber: newNumber });
    }

    setEditingGenset(null);
    setDbVersion(v => v + 1);
  };

  const handleAddGenset = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !newGenset.unitNumber) return;
    
    db.addGenset({
      id: `G-${newGenset.unitNumber}-${newGenset.location}-${Date.now()}`,
      unitNumber: newGenset.unitNumber.toUpperCase().trim(),
      location: newGenset.location,
      status: newGenset.status
    });
    
    setShowAddModal(false);
    setNewGenset({ unitNumber: '', location: Location.ALEX, status: GensetStatus.IN_STOCK });
  };

  const handleDeleteGenset = (id: string) => {
    if (!isAdmin) return;
    if (confirm(isAr ? 'هل أنت متأكد من حذف هذه الوحدة؟' : 'Are you sure you want to delete this asset?')) {
      db.deleteGenset(id);
    }
  };

  const handleBulkTransfer = (targetLoc: Location) => {
    if (isReadOnly) return;
    const ids = Array.from(selectedIds);
    ids.forEach(id => {
      const unit = stock.find(s => s.id === id);
      if (unit) db.updateGenset({ ...unit, location: targetLoc });
    });
    setSelectedIds(new Set());
    alert(lang === 'ar' ? `تم نقل ${ids.length} وحدة بنجاح` : `Successfully transferred ${ids.length} units.`);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredStock.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredStock.map(s => s.id)));
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const getStatusBadge = (status: GensetStatus) => {
    switch (status) {
      case GensetStatus.IN_STOCK:
        return <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">Available</span>;
      case GensetStatus.CLIPPED_ON:
        return <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">On Trip</span>;
      case GensetStatus.MAINTENANCE:
        return <span className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 px-2 py-0.5 rounded text-[8px] font-black uppercase animate-pulse">🛠️ In Maint</span>;
      default:
        return <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">Service</span>;
    }
  };

  // Maintenance Handlers
  const openNewMaintenanceModal = (preselectedUnit?: Genset) => {
    const defaultUnit = preselectedUnit ? preselectedUnit.unitNumber : (stock[0]?.unitNumber || '');
    const foundUnit = stock.find(s => s.unitNumber === defaultUnit);
    setMaintModalState({
      isOpen: true,
      mode: 'add',
      log: {
        id: `maint-${Date.now()}`,
        gensetNumber: defaultUnit,
        serviceDate: new Date().toISOString().slice(0, 10),
        serviceType: 'ROUTINE_INSPECTION',
        technician: currentUser.name || 'Mechanic Lead',
        location: foundUnit?.location || Location.ALEX,
        runningHours: foundUnit?.runningHours || 1200,
        completedDate: new Date().toISOString().slice(0, 10),
        status: 'COMPLETED',
        description: '',
        partsReplaced: '',
        nextServiceDue: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)
      }
    });
  };

  const openEditMaintenanceModal = (log: GensetMaintenanceLog) => {
    setMaintModalState({
      isOpen: true,
      mode: 'edit',
      log: { ...log }
    });
  };

  const handleSaveMaintenanceLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    const { log, mode } = maintModalState;
    if (!log.gensetNumber || !log.serviceDate || !log.serviceType) return;

    const fullLog: GensetMaintenanceLog = {
      id: log.id || `maint-${Date.now()}`,
      gensetNumber: log.gensetNumber.toUpperCase().trim(),
      serviceDate: log.serviceDate,
      serviceType: log.serviceType as MaintenanceServiceType,
      technician: log.technician || 'Technician',
      location: log.location || Location.ALEX,
      runningHours: Number(log.runningHours) || 0,
      cost: 0,
      completedDate: log.completedDate || ((log.status as any) === 'COMPLETED' ? log.serviceDate : ''),
      status: (log.status as any) || 'COMPLETED',
      description: log.description || '',
      partsReplaced: log.partsReplaced || '',
      nextServiceDue: log.nextServiceDue || '',
      createdAt: log.createdAt || new Date().toISOString()
    };

    if (mode === 'add') {
      db.addMaintenanceLog(fullLog);
    } else {
      db.updateMaintenanceLog(fullLog);
    }

    setMaintModalState({ isOpen: false, mode: 'add', log: {} });
  };

  const handleDeleteMaintenanceLog = (id: string) => {
    if (!isAdmin) return;
    if (confirm(isAr ? 'هل أنت متأكد من حذف هذا السجل للصيانة؟' : 'Are you sure you want to delete this maintenance record?')) {
      db.deleteMaintenanceLog(id);
    }
  };

  const handleExportMaintenanceCsv = () => {
    const headers = ['Record ID', 'Genset Unit', 'Start Date', 'Completed Date', 'Duration (Days)', 'Service Type', 'Status', 'Technician', 'Hub Location', 'Running Hours', 'Parts Replaced', 'Next Service Due', 'Description'];
    const rows = filteredMaintLogs.map(l => [
      l.id,
      l.gensetNumber,
      l.serviceDate,
      l.completedDate || '',
      l.completedDate && l.serviceDate ? Math.max(0, Math.ceil((new Date(l.completedDate).getTime() - new Date(l.serviceDate).getTime()) / 86400000)) : '',
      l.serviceType,
      l.status,
      `"${l.technician}"`,
      l.location,
      l.runningHours || 0,
      `"${(l.partsReplaced || '').replace(/"/g, '""')}"`,
      l.nextServiceDue || '',
      `"${(l.description || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `genset_maintenance_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500 text-start pb-24 text-[10px]">
      
      {/* Top Header & View Tabs */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tight text-[#001F3F] dark:text-white flex items-center gap-2">
            <span>⚡</span>
            <span>{isAr ? 'إدارة أسطول المولدات والصيانة' : 'Genset Fleet & Maintenance Command'}</span>
          </h1>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
            {isAr ? 'مراقبة المخزون، سجلات الصيانة الوقائية والإصلاحات' : 'Inventory Tracking, Preventative Overhaul & Maintenance Logs'}
          </p>
        </div>

        {/* View Mode Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl flex border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('visual')}
              className={`px-4 py-2 rounded-xl font-black uppercase text-[9px] tracking-wider transition-all flex items-center gap-1.5 ${activeTab === 'visual' ? 'bg-[#001F3F] text-white shadow-md' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
            >
              <span>🛰️</span>
              <span>{isAr ? 'خريطة الأسطول' : 'Fleet View'}</span>
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-4 py-2 rounded-xl font-black uppercase text-[9px] tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'inventory'
                  ? 'bg-[#001F3F] text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <span>⚡</span>
              <span>{isAr ? 'المخزون والأسطول' : 'Fleet Inventory'}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${activeTab === 'inventory' ? 'bg-[#C2A378] text-[#001F3F]' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                {stock.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('maintenance')}
              className={`px-4 py-2 rounded-xl font-black uppercase text-[9px] tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'maintenance'
                  ? 'bg-[#001F3F] text-[#C2A378] shadow-md border border-[#C2A378]/30'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <span>🛠️</span>
              <span>{isAr ? 'سجلات الصيانة' : 'Maintenance Logs'}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${activeTab === 'maintenance' ? 'bg-[#C2A378] text-[#001F3F]' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                {maintenanceLogs.length}
              </span>
            </button>
          </div>

          {!isReadOnly && (
            <button
              onClick={() => openNewMaintenanceModal()}
              className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white px-4 py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-md flex items-center gap-1.5 transition-all"
            >
              <span>🛠️</span>
              <span>{isAr ? 'تسجيل صيانة' : 'Log Maintenance'}</span>
            </button>
          )}

          {!isReadOnly && activeTab === 'inventory' && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-[#001F3F] hover:bg-slate-900 text-[#C2A378] border border-[#C2A378]/40 px-4 py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-md whitespace-nowrap transition-all"
            >
              + {isAr ? 'تسجيل مولد جديد' : 'Register Asset'}
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">{isAr ? 'إجمالي الأسطول' : 'Total Fleet'}</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-[#001F3F] dark:text-white font-mono">{metrics.total}</span>
            <span className="text-[8px] font-bold text-slate-400 uppercase">Units</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-[8px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{isAr ? 'جاهز ومتاح' : 'Available Stock'}</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{metrics.inStock}</span>
            <span className="text-[8px] font-bold text-emerald-500 uppercase">{Math.round((metrics.inStock / (metrics.total || 1)) * 100)}%</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-[8px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">{isAr ? 'قيد الرحلة' : 'Clipped On'}</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">{metrics.clippedOn}</span>
            <span className="text-[8px] font-bold text-blue-400 uppercase">Active</span>
          </div>
        </div>

        <div className={`bg-white dark:bg-slate-800 p-3.5 rounded-2xl border shadow-sm ${metrics.inMaint > 0 ? 'border-rose-300 dark:border-rose-800/60 bg-rose-50/20' : 'border-slate-200 dark:border-slate-700'}`}>
          <p className="text-[8px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center justify-between">
            <span>{isAr ? 'في ورشة الصيانة' : 'In Maintenance'}</span>
            {metrics.inMaint > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>}
          </p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono">{metrics.inMaint}</span>
            <span className="text-[8px] font-bold text-rose-500 uppercase">Gensets</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-[8px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">{isAr ? 'عمليات صيانة جارية' : 'Active Servicing'}</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">{metrics.activeMaintLogs}</span>
            <span className="text-[8px] font-bold text-slate-400 uppercase">Jobs</span>
          </div>
        </div>


      </div>

      {/* ================= TAB 2: FLEET INVENTORY ================= */}
      {/* ================= VISUAL FLEET BOARD ================= */}
      {activeTab === 'visual' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="bg-[#001F3F] text-white rounded-3xl p-5 shadow-xl border border-[#C2A378]/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⚡</span>
                  <h2 className="text-xl font-black uppercase tracking-tight">{isAr ? 'خريطة أسطول المولدات' : 'GENSET FLEET BOARD'}</h2>
                </div>
                <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest mt-1">
                  {isAr ? 'كل رقم مولد ظاهر حسب الميناء والحالة التشغيلية' : 'Every genset number grouped by port and live operating status'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[8px] font-black uppercase">
                <span className="px-3 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">● {isAr ? 'متاح' : 'IN STOCK'} {metrics.inStock}</span>
                <span className="px-3 py-2 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30">● {isAr ? 'مؤجر / على رحلة' : 'RENTED / CLIPPED'} {metrics.clippedOn}</span>
                <span className="px-3 py-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-400/30">● {isAr ? 'صيانة' : 'MAINTENANCE'} {metrics.inMaint}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
            {Object.values(Location).map(port => {
              const units = stock.filter(s => s.location === port).sort((a,b) => a.unitNumber.localeCompare(b.unitNumber));
              if (!units.length) return null;
              const available = units.filter(u => u.status === GensetStatus.IN_STOCK).length;
              const rented = units.filter(u => u.status === GensetStatus.CLIPPED_ON).length;
              const maintenance = units.filter(u => u.status === GensetStatus.MAINTENANCE).length;
              return (
                <div key={port} className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-sm text-[#001F3F] dark:text-white uppercase">{port}</h3>
                      <p className="text-[8px] text-slate-400 font-bold uppercase">{units.length} {isAr ? 'مولد' : 'GENSETS'}</p>
                    </div>
                    <div className="flex gap-1 text-[7px] font-black">
                      <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">S {available}</span>
                      <span className="px-2 py-1 rounded-lg bg-blue-100 text-blue-700">R {rented}</span>
                      <span className="px-2 py-1 rounded-lg bg-rose-100 text-rose-700">M {maintenance}</span>
                    </div>
                  </div>
                  <div className="p-3 grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {units.map(unit => {
                      const statusClass =
                        unit.status === GensetStatus.IN_STOCK
                          ? 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-200'
                          : unit.status === GensetStatus.CLIPPED_ON
                            ? 'bg-blue-600 text-white border-blue-700 shadow-blue-200'
                            : unit.status === GensetStatus.MAINTENANCE
                              ? 'bg-rose-500 text-white border-rose-600 shadow-rose-200'
                              : 'bg-amber-500 text-white border-amber-600 shadow-amber-200';
                      const activeOp = ops.find(o => o.gensetNumber?.trim().toUpperCase() === unit.unitNumber?.trim().toUpperCase() && o.status === 'IN PROGRESS');
                      return (
                        <button
                          key={unit.id}
                          title={activeOp ? `#${activeOp.bookingNumber}` : unit.status}
                          onClick={() => setEditingGenset({...unit})}
                          className={`min-h-[58px] rounded-xl border-2 ${statusClass} shadow-md hover:scale-105 transition-transform px-1.5 py-2 flex flex-col items-center justify-center`}
                        >
                          <span className="text-[10px] sm:text-[11px] font-black font-mono tracking-tight">{unit.unitNumber}</span>
                          <span className="text-[6px] font-black uppercase opacity-80 mt-1">
                            {unit.status === GensetStatus.IN_STOCK ? (isAr ? 'متاح' : 'STOCK') : unit.status === GensetStatus.CLIPPED_ON ? (isAr ? 'مؤجر' : 'RENTED') : unit.status === GensetStatus.MAINTENANCE ? (isAr ? 'صيانة' : 'MAINT') : unit.status}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {stock.length === 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-700">
              <div className="text-4xl mb-3">⚡</div>
              <p className="font-black uppercase text-slate-500">{isAr ? 'لا توجد مولدات مسجلة' : 'NO GENSETS REGISTERED'}</p>
            </div>
          )}
        </div>
      )}


      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col xl:flex-row gap-3 items-center">
            <div className="flex-1 relative w-full">
              <input 
                type="text" 
                placeholder={isAr ? "بحث برقم المولد السريال..." : "Global Asset Search by Unit Serial..."}
                className="w-full pl-9 pr-3 py-2.5 border-2 border-slate-50 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-black dark:text-white font-bold outline-none focus:border-blue-400 shadow-sm" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
              <svg className="absolute left-3 top-3.5 h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <div className="flex flex-wrap gap-2 w-full xl:w-auto">
              <select className="bg-white dark:bg-slate-900 text-black dark:text-white border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2 font-black uppercase text-[9px] outline-none focus:border-blue-400" value={filterLoc} onChange={e => setFilterLoc(e.target.value)}>
                <option value="ALL">{isAr ? 'جميع الموانئ' : 'All Hubs'}</option>
                {Object.values(Location).map(l => <option key={l} value={l}>{l} HUB</option>)}
              </select>
              <select className="bg-white dark:bg-slate-900 text-black dark:text-white border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2 font-black uppercase text-[9px] outline-none focus:border-blue-400" value={filterStat} onChange={e => setFilterStat(e.target.value)}>
                <option value="ALL">{isAr ? 'جميع الحالات' : 'All Status'}</option>
                {Object.values(GensetStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>

          {/* Stock Table */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap border-collapse">
                <thead className="bg-[#001F3F] text-white font-black uppercase text-[9px]">
                  <tr>
                    <th className="p-4 w-10 text-center border-r border-white/5">
                      <input type="checkbox" className="rounded" checked={selectedIds.size === filteredStock.length && filteredStock.length > 0} onChange={toggleSelectAll} />
                    </th>
                    <th className="p-4 w-10 text-center">#</th>
                    <th className="p-4">{isAr ? 'رقم الوحدة' : 'Unit Serial'}</th>
                    <th className="p-4">{isAr ? 'الميناء الحالي' : 'Current Hub'}</th>
                    <th className="p-4">{isAr ? 'الحالة التشغيلية' : 'Status'}</th>
                    <th className="p-4">{isAr ? 'التشغيل النشط' : 'Active Deployment'}</th>
                    <th className="p-4">{isAr ? 'تاريخ التركيب' : 'Trip Date'}</th>
                    <th className="p-4">{isAr ? 'سجل الصيانة وساعات التشغيل' : 'Maintenance Log & Hours'}</th>
                    <th className="p-4 text-center">{isAr ? 'مؤشر الحالة' : 'Health'}</th>
                    <th className="p-4 text-right">{isAr ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredStock.map((unit, idx) => {
                    const activeOp = ops.find(o => o.gensetNumber === unit.unitNumber && o.status === 'IN PROGRESS');
                    const portStyle = PORT_STYLING[unit.location] || PORT_STYLING[Location.ALEX];
                    const isSelected = selectedIds.has(unit.id);
                    const unitLogs = maintenanceLogs.filter(l => (l.gensetNumber || '').toUpperCase() === (unit.unitNumber || '').toUpperCase());
                    const latestLog = unitLogs[0];
                    const hasActiveMaint = unitLogs.some(l => l.status === 'IN_PROGRESS');

                    return (
                      <tr key={unit.id} className={`transition-colors group ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}>
                        <td className="p-4 text-center border-r dark:border-slate-700">
                          <input type="checkbox" className="rounded" checked={isSelected} onChange={() => toggleSelect(unit.id)} />
                        </td>
                        <td className="p-4 text-center text-slate-300">{idx + 1}</td>
                        <td className="p-4 font-black text-blue-600 dark:text-blue-400 italic uppercase tracking-tighter text-xs flex items-center gap-1.5">
                          <span>{unit.unitNumber}</span>
                          {hasActiveMaint && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" title="Work in Progress"></span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`${portStyle.bg} ${portStyle.text} border ${portStyle.border} px-2 py-0.5 rounded font-black text-[8px]`}>{unit.location} HUB</span>
                        </td>
                        <td className="p-4">{getStatusBadge(unit.status)}</td>
                        <td className="p-4 font-bold text-slate-700 dark:text-slate-300">
                          {activeOp ? <span className="font-mono text-blue-600">#{activeOp.bookingNumber}</span> : <span className="text-slate-200">---</span>}
                        </td>
                        <td className="p-4 text-slate-400 font-medium">{activeOp?.clipOnDate || 'N/A'}</td>
                        
                        {/* Maintenance Log Cell */}
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {latestLog ? (
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-bold text-slate-800 dark:text-slate-200">
                                    {latestLog.serviceDate}
                                  </span>
                                  <span className={`px-1.5 py-0.2 text-[8px] font-black rounded border ${SERVICE_TYPE_CONFIG[latestLog.serviceType]?.color || 'bg-slate-100'}`}>
                                    {SERVICE_TYPE_CONFIG[latestLog.serviceType]?.icon} {isAr ? SERVICE_TYPE_CONFIG[latestLog.serviceType]?.labelAr : SERVICE_TYPE_CONFIG[latestLog.serviceType]?.labelEn}
                                  </span>
                                </div>
                                <div className="text-[8px] text-slate-400 font-medium mt-0.5">
                                  {latestLog.runningHours ? `${latestLog.runningHours.toLocaleString()} hrs` : 'No hours logged'} • By {latestLog.technician}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600 italic">No logs recorded</span>
                            )}

                            <button
                              onClick={() => setSelectedUnitForMaint(unit)}
                              className="ml-auto px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-lg text-[8px] font-black uppercase flex items-center gap-1 transition-all"
                              title="View Maintenance Log History"
                            >
                              <span>🛠️</span>
                              <span>Log ({unitLogs.length})</span>
                            </button>
                          </div>
                        </td>

                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <div className="w-1.5 h-3 rounded-full bg-emerald-500"></div>
                            <div className="w-1.5 h-3 rounded-full bg-emerald-500"></div>
                            <div className={`w-1.5 h-3 rounded-full ${unit.status === GensetStatus.MAINTENANCE ? 'bg-amber-400' : 'bg-emerald-500'}`}></div>
                            <div className="w-1.5 h-3 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                          </div>
                        </td>

                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Maintenance button */}
                            <button 
                              onClick={() => setSelectedUnitForMaint(unit)} 
                              title="Open Maintenance Log"
                              className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white dark:bg-amber-950/50 dark:text-amber-400 rounded-lg transition-all"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </button>

                            {!isReadOnly && (
                              <button onClick={() => setEditingGenset({...unit})} title="Modify Asset" className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-blue-600 hover:text-white transition-all">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                            )}
                            {isAdmin && (
                              <button onClick={() => handleDeleteGenset(unit.id)} title="Delete Asset" className="p-1.5 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-600 hover:text-white transition-all">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: FLEET MAINTENANCE LOGS ================= */}
      {activeTab === 'maintenance' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          
          {/* Maintenance Search & Filter Toolbar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col gap-3">
            <div className="flex flex-col md:flex-row gap-3 items-center">
              <div className="flex-1 relative w-full">
                <input 
                  type="text" 
                  placeholder={isAr ? "بحث في سجلات الصيانة (رقم الوحدة، الفني، قطع الغيار، الملاحظات)..." : "Search maintenance logs (Unit #, Technician, Parts, Notes)..."}
                  className="w-full pl-9 pr-3 py-2.5 border-2 border-slate-100 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-black dark:text-white font-bold outline-none focus:border-amber-400 shadow-sm"
                  value={maintSearch}
                  onChange={(e) => setMaintSearch(e.target.value)}
                />
                <svg className="absolute left-3 top-3.5 h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  onClick={handleExportMaintenanceCsv}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-xl font-black uppercase text-[9px] tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap"
                  title="Export Maintenance History to CSV"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <span>{isAr ? 'تصدير CSV' : 'Export CSV'}</span>
                </button>

                {!isReadOnly && (
                  <button
                    onClick={() => openNewMaintenanceModal()}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-black uppercase text-[9px] tracking-wider shadow-md flex items-center gap-1.5 transition-all whitespace-nowrap"
                  >
                    <span>+</span>
                    <span>{isAr ? 'تسجيل صيانة جديدة' : 'New Maintenance Log'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Dropdowns */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <div>
                <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">{isAr ? 'تصفية بالوحدة' : 'Genset Unit'}</label>
                <select 
                  className="w-full bg-slate-50 dark:bg-slate-900 text-black dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-bold uppercase text-[9px] outline-none focus:border-amber-400"
                  value={maintFilterUnit}
                  onChange={e => setMaintFilterUnit(e.target.value)}
                >
                  <option value="ALL">{isAr ? 'كل المولدات' : 'All Gensets'}</option>
                  {stock.map(s => <option key={s.id} value={s.unitNumber}>{s.unitNumber} ({s.location})</option>)}
                </select>
              </div>

              <div>
                <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">{isAr ? 'نوع الصيانة' : 'Service Type'}</label>
                <select 
                  className="w-full bg-slate-50 dark:bg-slate-900 text-black dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-bold uppercase text-[9px] outline-none focus:border-amber-400"
                  value={maintFilterType}
                  onChange={e => setMaintFilterType(e.target.value)}
                >
                  <option value="ALL">{isAr ? 'جميع أنواع الصيانة' : 'All Service Types'}</option>
                  {Object.entries(SERVICE_TYPE_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.icon} {isAr ? cfg.labelAr : cfg.labelEn}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">{isAr ? 'حالة الصيانة' : 'Service Status'}</label>
                <select 
                  className="w-full bg-slate-50 dark:bg-slate-900 text-black dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-bold uppercase text-[9px] outline-none focus:border-amber-400"
                  value={maintFilterStat}
                  onChange={e => setMaintFilterStat(e.target.value)}
                >
                  <option value="ALL">{isAr ? 'جميع الحالات' : 'All Statuses'}</option>
                  <option value="COMPLETED">{isAr ? 'مكتمل' : 'Completed'}</option>
                  <option value="IN_PROGRESS">{isAr ? 'قيد التنفيذ' : 'In Progress'}</option>
                  <option value="SCHEDULED">{isAr ? 'مجدول' : 'Scheduled'}</option>
                </select>
              </div>

              <div>
                <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">{isAr ? 'الميناء / المحطة' : 'Hub Location'}</label>
                <select 
                  className="w-full bg-slate-50 dark:bg-slate-900 text-black dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-bold uppercase text-[9px] outline-none focus:border-amber-400"
                  value={maintFilterLoc}
                  onChange={e => setMaintFilterLoc(e.target.value)}
                >
                  <option value="ALL">{isAr ? 'كل الموانئ' : 'All Hubs'}</option>
                  {Object.values(Location).map(l => <option key={l} value={l}>{l} HUB</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Maintenance Logs Table */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap border-collapse">
                <thead className="bg-[#001F3F] text-white font-black uppercase text-[9px]">
                  <tr>
                    <th className="p-4 w-10 text-center">#</th>
                    <th className="p-4">{isAr ? 'بدء الصيانة' : 'Start Date'}</th>
                    <th className="p-4">{isAr ? 'تاريخ الانتهاء' : 'Completed Date'}</th>
                    <th className="p-4">{isAr ? 'المدة' : 'Duration'}</th>
                    <th className="p-4">{isAr ? 'رقم الوحدة' : 'Genset SN'}</th>
                    <th className="p-4">{isAr ? 'المحطة' : 'Hub'}</th>
                    <th className="p-4">{isAr ? 'نوع الصيانة' : 'Service Type'}</th>
                    <th className="p-4">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="p-4">{isAr ? 'الفني المسؤول' : 'Technician'}</th>
                    <th className="p-4">{isAr ? 'ساعات التشغيل' : 'Running Hours'}</th>
                    <th className="p-4">{isAr ? 'قطع الغيار المستبدلة' : 'Parts Replaced'}</th>
                    <th className="p-4">{isAr ? 'الصيانة القادمة' : 'Next Due'}</th>
                    <th className="p-4 max-w-xs">{isAr ? 'الملاحظات وتفاصيل الفحص' : 'Work Details'}</th>
                    <th className="p-4 text-right">{isAr ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredMaintLogs.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="p-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="text-3xl">🛠️</span>
                          <p className="font-black uppercase tracking-wider text-xs">{isAr ? 'لا توجد سجلات صيانة مطابقة' : 'No maintenance logs found'}</p>
                          <p className="text-[9px] text-slate-400">{isAr ? 'جرب تعديل خيارات البحث أو قم بتسجيل صيانة جديدة' : 'Try adjusting filters or record a new maintenance service'}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredMaintLogs.map((log, idx) => {
                      const typeCfg = SERVICE_TYPE_CONFIG[log.serviceType] || SERVICE_TYPE_CONFIG.ROUTINE_INSPECTION;
                      const statCfg = MAINT_STATUS_CONFIG[log.status] || MAINT_STATUS_CONFIG.COMPLETED;
                      const portStyle = PORT_STYLING[log.location] || PORT_STYLING[Location.ALEX];

                      return (
                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="p-4 text-center text-slate-300 font-mono">{idx + 1}</td>
                          <td className="p-4 font-bold text-slate-700 dark:text-slate-200">{log.serviceDate}</td>
                          <td className="p-4 font-mono text-slate-500">{log.completedDate || '—'}</td>
                          <td className="p-4 font-black text-amber-600">{log.completedDate && log.serviceDate ? `${Math.max(0, Math.ceil((new Date(log.completedDate).getTime() - new Date(log.serviceDate).getTime()) / 86400000))} ${isAr ? 'يوم' : 'days'}` : (log.status === 'IN_PROGRESS' ? `${Math.max(1, Math.ceil((Date.now() - new Date(log.serviceDate).getTime()) / 86400000))} ${isAr ? 'يوم حتى الآن' : 'days so far'}` : '—')}</td>
                          <td className="p-4 font-black text-blue-600 dark:text-blue-400 italic uppercase">
                            <button
                              onClick={() => {
                                const found = stock.find(s => s.unitNumber === log.gensetNumber);
                                if (found) setSelectedUnitForMaint(found);
                              }}
                              className="hover:underline flex items-center gap-1"
                              title="Click to view all history for this genset"
                            >
                              <span>{log.gensetNumber}</span>
                              <span className="text-[8px] text-slate-400">↗</span>
                            </button>
                          </td>
                          <td className="p-4">
                            <span className={`${portStyle.bg} ${portStyle.text} border ${portStyle.border} px-2 py-0.5 rounded font-black text-[8px]`}>
                              {log.location}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase border ${typeCfg.color} flex items-center gap-1 w-fit`}>
                              <span>{typeCfg.icon}</span>
                              <span>{isAr ? typeCfg.labelAr : typeCfg.labelEn}</span>
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${statCfg.color} flex items-center gap-1 w-fit`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statCfg.badge}`}></span>
                              <span>{isAr ? statCfg.labelAr : statCfg.labelEn}</span>
                            </span>
                          </td>
                          <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{log.technician}</td>
                          <td className="p-4 font-mono font-bold text-slate-600 dark:text-slate-300">
                            {log.runningHours ? `${log.runningHours.toLocaleString()} h` : '—'}
                          </td>
                          <td className="p-4 max-w-xs truncate text-slate-600 dark:text-slate-300 font-medium" title={log.partsReplaced}>
                            {log.partsReplaced || '—'}
                          </td>
                          <td className="p-4 font-mono text-slate-500">{log.nextServiceDue || '—'}</td>
                          <td className="p-4 max-w-sm truncate text-slate-600 dark:text-slate-300 font-medium" title={log.description}>
                            {log.description}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isReadOnly && (
                                <button
                                  onClick={() => openEditMaintenanceModal(log)}
                                  className="p-1.5 bg-slate-100 hover:bg-amber-500 hover:text-white dark:bg-slate-700 rounded-lg transition-all"
                                  title="Edit Maintenance Entry"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteMaintenanceLog(log.id)}
                                  className="p-1.5 bg-rose-50 text-rose-500 hover:bg-rose-600 hover:text-white rounded-lg transition-all"
                                  title="Delete Maintenance Entry"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= BULK RELOCATION BAR ================= */}
      {selectedIds.size > 0 && activeTab === 'inventory' && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10">
          <div className="bg-[#001F3F] text-white px-8 py-5 rounded-[2.5rem] shadow-2xl border-2 border-[#C2A378] flex items-center gap-10 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 bg-[#C2A378] text-[#001F3F] rounded-full flex items-center justify-center font-black text-sm">{selectedIds.size}</span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#C2A378]">{isAr ? 'إعادة توجيه مجمعة' : 'Bulk Relocation'}</p>
                <p className="text-[9px] font-bold text-slate-400">{selectedIds.size} {isAr ? 'مولدات محددة' : 'Assets Selected'}</p>
              </div>
            </div>
            <div className="h-10 w-px bg-white/10"></div>
            <div className="flex items-center gap-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">{isAr ? 'الميناء المستهدف:' : 'Target Hub:'}</p>
              <div className="flex gap-2">
                {Object.values(Location).map(loc => (
                  <button 
                    key={loc}
                    onClick={() => handleBulkTransfer(loc)}
                    className="bg-white/10 hover:bg-[#C2A378] hover:text-[#001F3F] border border-white/20 rounded-xl px-4 py-2 text-[9px] font-black uppercase transition-all"
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setSelectedIds(new Set())} className="text-[9px] font-black uppercase tracking-widest text-rose-400 hover:text-rose-500">
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL: UNIT MAINTENANCE HISTORY TIMELINE ================= */}
      {selectedUnitForMaint && (
        <div className="fixed inset-0 bg-[#001F3F]/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col animate-in zoom-in-95">
            {/* Header */}
            <div className="p-6 bg-[#001F3F] text-white flex justify-between items-center border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-2xl">
                  🛠️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black italic uppercase tracking-wider text-[#C2A378]">
                      {selectedUnitForMaint.unitNumber}
                    </h2>
                    {getStatusBadge(selectedUnitForMaint.status)}
                    <span className="bg-white/10 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase">
                      {selectedUnitForMaint.location} HUB
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-300 uppercase tracking-widest mt-0.5">
                    {isAr ? 'سجل وتاريخ الصيانة والفحوصات الدورية' : 'Preventative & Corrective Maintenance History'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!isReadOnly && (
                  <button
                    onClick={() => {
                      openNewMaintenanceModal(selectedUnitForMaint);
                    }}
                    className="bg-[#C2A378] text-[#001F3F] hover:bg-amber-400 px-4 py-2 rounded-xl font-black uppercase text-[9px] tracking-wider transition-all flex items-center gap-1"
                  >
                    <span>+</span>
                    <span>{isAr ? 'إضافة سجل صيانة' : 'Add Record'}</span>
                  </button>
                )}
                <button 
                  onClick={() => setSelectedUnitForMaint(null)} 
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-rose-600 hover:text-white flex items-center justify-center text-sm font-black transition-all"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Quick Unit Summary Info */}
            <div className="grid grid-cols-4 gap-2 p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[9px]">
              <div>
                <span className="text-slate-400 uppercase font-black block text-[8px]">{isAr ? 'آخر صيانة' : 'Last Service'}</span>
                <span className="font-bold text-slate-800 dark:text-white font-mono">
                  {selectedUnitForMaint.lastMaintenanceDate || 'None recorded'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-black block text-[8px]">{isAr ? 'الصيانة القادمة' : 'Next Service Due'}</span>
                <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                  {selectedUnitForMaint.nextMaintenanceDue || 'Scheduled as needed'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-black block text-[8px]">{isAr ? 'ساعات التشغيل التراكمية' : 'Running Hours'}</span>
                <span className="font-bold text-slate-800 dark:text-white font-mono">
                  {selectedUnitForMaint.runningHours ? `${selectedUnitForMaint.runningHours.toLocaleString()} hrs` : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-black block text-[8px]">{isAr ? 'إجمالي السجلات' : 'Total Logs'}</span>
                <span className="font-bold text-slate-800 dark:text-white font-mono">
                  {maintenanceLogs.filter(l => (l.gensetNumber || '').toUpperCase() === (selectedUnitForMaint.unitNumber || '').toUpperCase()).length} records
                </span>
              </div>
            </div>

            {/* Logs List / Timeline */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {(() => {
                const logs = maintenanceLogs.filter(l => (l.gensetNumber || '').toUpperCase() === (selectedUnitForMaint.unitNumber || '').toUpperCase());
                if (logs.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-400 space-y-3">
                      <span className="text-4xl block">🔧</span>
                      <p className="font-black uppercase text-xs">{isAr ? 'لا توجد سجلات صيانة مسجلة لهذا المولد بعد' : 'No service records registered for this unit yet'}</p>
                      <p className="text-[9px] max-w-sm mx-auto">
                        {isAr ? 'قم بتسجيل أول صيانة لتتبع الفلاتر، الزيوت، وساعات التشغيل الدقيقة للمولد.' : 'Record the first preventative or corrective maintenance job to begin tracking unit health and servicing history.'}
                      </p>
                      {!isReadOnly && (
                        <button
                          onClick={() => openNewMaintenanceModal(selectedUnitForMaint)}
                          className="bg-amber-600 text-white px-5 py-2 rounded-xl font-black uppercase text-[9px] tracking-wider shadow-md hover:bg-amber-500 transition-all"
                        >
                          + {isAr ? 'تسجيل الصيانة الأولى' : 'Record First Service'}
                        </button>
                      )}
                    </div>
                  );
                }

                return logs.map((log) => {
                  const typeCfg = SERVICE_TYPE_CONFIG[log.serviceType] || SERVICE_TYPE_CONFIG.ROUTINE_INSPECTION;
                  const statCfg = MAINT_STATUS_CONFIG[log.status] || MAINT_STATUS_CONFIG.COMPLETED;

                  return (
                    <div key={log.id} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-2.5">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{typeCfg.icon}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black uppercase text-xs text-slate-800 dark:text-white">
                                {isAr ? typeCfg.labelAr : typeCfg.labelEn}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${statCfg.color}`}>
                                {isAr ? statCfg.labelAr : statCfg.labelEn}
                              </span>
                            </div>
                            <span className="text-[8px] text-slate-400 font-mono">
                              {log.serviceDate} • Hub: {log.location}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-black font-mono text-[#001F3F] dark:text-[#C2A378]">
                            
                          </span>
                          {log.runningHours && (
                            <span className="block text-[8px] font-mono text-slate-400">
                              {log.runningHours.toLocaleString()} hrs
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Work description */}
                      <p className="text-[9px] text-slate-700 dark:text-slate-300 font-medium bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        {log.description}
                      </p>

                      {/* Parts and technician metadata */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-700 text-[8px]">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">
                            <strong className="text-slate-700 dark:text-slate-300">{isAr ? 'الفني:' : 'Technician:'}</strong> {log.technician}
                          </span>
                          {log.partsReplaced && (
                            <span className="text-slate-500">
                              <strong className="text-slate-700 dark:text-slate-300">{isAr ? 'القطع المستبدلة:' : 'Parts:'}</strong> {log.partsReplaced}
                            </span>
                          )}
                          {log.nextServiceDue && (
                            <span className="text-amber-600 dark:text-amber-400 font-bold">
                              {isAr ? 'القادمة:' : 'Next Due:'} {log.nextServiceDue}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 ml-auto">
                          {!isReadOnly && (
                            <button
                              onClick={() => openEditMaintenanceModal(log)}
                              className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-amber-500 hover:text-white text-slate-600 dark:text-slate-300 font-black uppercase text-[8px] transition-all"
                            >
                              {isAr ? 'تعديل' : 'Edit'}
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteMaintenanceLog(log.id)}
                              className="px-2 py-1 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-600 hover:text-white font-black uppercase text-[8px] transition-all"
                            >
                              {isAr ? 'حذف' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: LOG / EDIT MAINTENANCE RECORD ================= */}
      {maintModalState.isOpen && (
        <div className="fixed inset-0 bg-[#001F3F]/85 backdrop-blur-md z-[250] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="p-6 bg-[#001F3F] text-white flex justify-between items-center border-b border-white/10">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🛠️</span>
                <div>
                  <h3 className="text-lg font-black italic uppercase tracking-wider text-[#C2A378]">
                    {maintModalState.mode === 'add' 
                      ? (isAr ? 'تسجيل صيانة جديدة للمولد' : 'Log Genset Maintenance')
                      : (isAr ? 'تعديل سجل الصيانة' : 'Modify Maintenance Record')}
                  </h3>
                  <p className="text-[8px] text-slate-300 uppercase tracking-widest">
                    {isAr ? 'تحديث وتوثيق أعمال الصيانة، مدة العمل، قطع الغيار وساعات التشغيل' : 'Service record documentation, duration & equipment health tracking'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setMaintModalState({ isOpen: false, mode: 'add', log: {} })}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-rose-600 hover:text-white flex items-center justify-center text-sm font-black transition-all"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveMaintenanceLog} className="p-6 overflow-y-auto space-y-4 flex-1 text-[9px]">
              
              <div className="grid grid-cols-2 gap-3">
                {/* Genset Unit Selection */}
                <div>
                  <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                    {isAr ? 'رقم الوحدة (Genset SN) *' : 'Genset Unit SN *'}
                  </label>
                  <select
                    required
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-black text-xs text-blue-600 dark:text-blue-400 outline-none focus:border-amber-400"
                    value={maintModalState.log.gensetNumber || ''}
                    onChange={e => {
                      const selUnit = stock.find(s => s.unitNumber === e.target.value);
                      setMaintModalState({
                        ...maintModalState,
                        log: {
                          ...maintModalState.log,
                          gensetNumber: e.target.value,
                          location: selUnit ? selUnit.location : (maintModalState.log.location || Location.ALEX),
                          runningHours: selUnit?.runningHours || maintModalState.log.runningHours
                        }
                      });
                    }}
                  >
                    <option value="" disabled>{isAr ? 'اختر المولد...' : 'Select Genset...'}</option>
                    {stock.map(s => (
                      <option key={s.id} value={s.unitNumber}>
                        {s.unitNumber} ({s.location} HUB - {s.status})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Service Date */}
                <div>
                  <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                    {isAr ? 'تاريخ الخدمة *' : 'Service Date *'}
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-black text-xs text-black dark:text-white outline-none focus:border-amber-400"
                    value={maintModalState.log.serviceDate || ''}
                    onChange={e => setMaintModalState({
                      ...maintModalState,
                      log: { ...maintModalState.log, serviceDate: e.target.value }
                    })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Completed Date */}
                <div>
                  <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                    {isAr ? 'تاريخ انتهاء الصيانة' : 'Completed Date'}
                  </label>
                  <input
                    type="date"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-black text-xs text-black dark:text-white outline-none focus:border-amber-400"
                    value={maintModalState.log.completedDate || ''}
                    onChange={e => setMaintModalState({ ...maintModalState, log: { ...maintModalState.log, completedDate: e.target.value } })}
                  />
                </div>

                {/* Service Type */}
                <div>
                  <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                    {isAr ? 'نوع الصيانة *' : 'Service Type *'}
                  </label>
                  <select
                    required
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-black text-xs text-black dark:text-white outline-none focus:border-amber-400"
                    value={maintModalState.log.serviceType || 'ROUTINE_INSPECTION'}
                    onChange={e => setMaintModalState({
                      ...maintModalState,
                      log: { ...maintModalState.log, serviceType: e.target.value as any }
                    })}
                  >
                    {Object.entries(SERVICE_TYPE_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>
                        {cfg.icon} {isAr ? cfg.labelAr : cfg.labelEn}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                    {isAr ? 'حالة الصيانة *' : 'Job Status *'}
                  </label>
                  <select
                    required
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-black text-xs text-black dark:text-white outline-none focus:border-amber-400"
                    value={maintModalState.log.status || 'COMPLETED'}
                    onChange={e => {
                      const nextStatus = e.target.value as any;
                      setMaintModalState({
                        ...maintModalState,
                        log: {
                          ...maintModalState.log,
                          status: nextStatus,
                          completedDate: nextStatus === 'COMPLETED'
                            ? (maintModalState.log.completedDate || new Date().toISOString().slice(0, 10))
                            : ''
                        }
                      });
                    }}
                  >
                    <option value="COMPLETED">{isAr ? 'مكتمل (Completed)' : 'Completed'}</option>
                    <option value="IN_PROGRESS">{isAr ? 'قيد التنفيذ (In Progress)' : 'In Progress'}</option>
                    <option value="SCHEDULED">{isAr ? 'مجدول (Scheduled)' : 'Scheduled'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Technician */}
                <div>
                  <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                    {isAr ? 'الفني / الميكانيكي المسؤول' : 'Technician / Lead Mechanic'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mohamed Fawzy, Sherif Hegazy"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-bold text-xs text-black dark:text-white outline-none focus:border-amber-400"
                    value={maintModalState.log.technician || ''}
                    onChange={e => setMaintModalState({
                      ...maintModalState,
                      log: { ...maintModalState.log, technician: e.target.value }
                    })}
                  />
                </div>

                {/* Hub Location */}
                <div>
                  <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                    {isAr ? 'الموقع / المحطة' : 'Hub Location'}
                  </label>
                  <select
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-bold text-xs text-black dark:text-white outline-none focus:border-amber-400"
                    value={maintModalState.log.location || Location.ALEX}
                    onChange={e => setMaintModalState({
                      ...maintModalState,
                      log: { ...maintModalState.log, location: e.target.value as any }
                    })}
                  >
                    {Object.values(Location).map(l => (
                      <option key={l} value={l}>{l} HUB</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Running Hours */}
                <div>
                  <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                    {isAr ? 'ساعات التشغيل (Hours)' : 'Running Hours (Hrs)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 1450"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-mono font-bold text-xs text-black dark:text-white outline-none focus:border-amber-400"
                    value={maintModalState.log.runningHours ?? ''}
                    onChange={e => setMaintModalState({
                      ...maintModalState,
                      log: { ...maintModalState.log, runningHours: Number(e.target.value) }
                    })}
                  />
                </div>

                {/* Next Service Due */}
                <div>
                  <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                    {isAr ? 'تاريخ الصيانة القادمة' : 'Next Service Due'}
                  </label>
                  <input
                    type="date"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-bold text-xs text-black dark:text-white outline-none focus:border-amber-400"
                    value={maintModalState.log.nextServiceDue || ''}
                    onChange={e => setMaintModalState({
                      ...maintModalState,
                      log: { ...maintModalState.log, nextServiceDue: e.target.value }
                    })}
                  />
                </div>
              </div>

              {/* Parts Replaced */}
              <div>
                <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                  {isAr ? 'قطع الغيار المستبدلة والزيوت' : 'Parts & Consumables Replaced'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. LF16015 Oil Filter, 15W40 Oil (18L), Fan Belt, Fuel Water Separator"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-medium text-xs text-black dark:text-white outline-none focus:border-amber-400"
                  value={maintModalState.log.partsReplaced || ''}
                  onChange={e => setMaintModalState({
                    ...maintModalState,
                    log: { ...maintModalState.log, partsReplaced: e.target.value }
                  })}
                />
              </div>

              {/* Detailed Description / Checklist */}
              <div>
                <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                  {isAr ? 'تفاصيل أعمال الصيانة وتقرير الفحص *' : 'Work Details & Inspection Checklist *'}
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Conducted 250h service, drained crankcase oil, replaced oil and fuel filters, checked alternator belt tension and battery load."
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-medium text-xs text-black dark:text-white outline-none focus:border-amber-400 resize-none"
                  value={maintModalState.log.description || ''}
                  onChange={e => setMaintModalState({
                    ...maintModalState,
                    log: { ...maintModalState.log, description: e.target.value }
                  })}
                />
              </div>

              {/* Status helper note */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center gap-2 text-amber-800 dark:text-amber-300 text-[8px] font-bold">
                <span>ℹ️</span>
                <span>
                  {maintModalState.log.status === 'IN_PROGRESS' 
                    ? (isAr ? 'سيتم تلقائياً تحديث حالة المولد إلى MAINTENANCE (في الصيانة) لحين اكتمال العمل.' : 'The genset status will automatically be set to MAINTENANCE while this job is in progress.')
                    : (isAr ? 'عند إتمام الصيانة، ستتم استعادة جاهزية المولد تلقائياً في المخزون.' : 'Completed service automatically updates the unit last maintenance date and keeps inventory ready.')}
                </span>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMaintModalState({ isOpen: false, mode: 'add', log: {} })}
                  className="w-1/3 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-black uppercase text-xs tracking-wider"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl transition-all"
                >
                  {maintModalState.mode === 'add' 
                    ? (isAr ? 'حفظ سجل الصيانة' : 'Save Maintenance Record') 
                    : (isAr ? 'تحديث السجل' : 'Update Record')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: REGISTER NEW ASSET ================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#001F3F]/90 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl max-w-md w-full overflow-hidden border-[10px] border-slate-900 animate-in zoom-in-95">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-xl font-black italic uppercase">{isAr ? 'تسجيل مولد جديد' : 'New Asset Identity'}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-white hover:text-rose-500">✕</button>
            </div>
            <form onSubmit={handleAddGenset} className="p-8 space-y-6">
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Unit Serial / ID</label>
                <input required placeholder="e.g. SZLG221-500" className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-black text-sm outline-none focus:border-blue-400" value={newGenset.unitNumber} onChange={e => setNewGenset({...newGenset, unitNumber: e.target.value})} />
              </div>
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Station Assignment</label>
                <select className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-black text-xs outline-none" value={newGenset.location} onChange={e => setNewGenset({...newGenset, location: e.target.value as any})}>
                  {Object.values(Location).map(l => <option key={l} value={l}>{translateEntity(l, lang)} HUB</option>)}
                </select>
              </div>
              <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Deploy Asset to Stock</button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: MODIFY ASSET ================= */}
      {editingGenset && (
        <div className="fixed inset-0 bg-[#001F3F]/90 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl max-w-md w-full overflow-hidden border-[10px] border-slate-900 animate-in zoom-in-95">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black italic uppercase">{isAr ? 'تعديل بيانات المولد' : 'Modify Asset'}</h3>
                <p className="text-[9px] text-[#C2A378] font-bold">{editingGenset.unitNumber}</p>
              </div>
              <button onClick={() => setEditingGenset(null)} className="text-white hover:text-rose-500">✕</button>
            </div>
            <form onSubmit={handleUpdateGenset} className="p-8 space-y-6">
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">{isAr ? 'رقم المولد' : 'Genset / Unit Number'}</label>
                <input
                  required
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-black text-sm text-black dark:text-white outline-none focus:border-blue-400"
                  value={editingGenset.unitNumber}
                  onChange={e => setEditingGenset({ ...editingGenset, unitNumber: e.target.value })}
                />
                <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mt-2">
                  {isAr ? 'تحذير: تغيير الرقم يؤثر على العمليات وسجلات الصيانة المرتبطة' : 'Warning: renaming affects linked operations & maintenance records'}
                </p>
              </div>
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Location Assignment</label>
                <select className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-black text-xs text-black dark:text-white outline-none focus:border-blue-400" value={editingGenset.location} onChange={e => setEditingGenset({...editingGenset, location: e.target.value as any})}>
                  {Object.values(Location).map(l => <option key={l} value={l}>{translateEntity(l, lang)} HUB</option>)}
                </select>
              </div>
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Service Status</label>
                <select className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-black text-xs text-black dark:text-white outline-none focus:border-blue-400" value={editingGenset.status} onChange={e => setEditingGenset({...editingGenset, status: e.target.value as any})}>
                  {Object.values(GensetStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>

              {/* Quick link to maintenance log */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const target = { ...editingGenset };
                    setEditingGenset(null);
                    setSelectedUnitForMaint(target);
                  }}
                  className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-400 rounded-xl font-black uppercase text-[9px] tracking-wider border border-amber-200 dark:border-amber-800 flex items-center justify-center gap-1.5 transition-all"
                >
                  <span>🛠️</span>
                  <span>{isAr ? 'عرض سجل الصيانة لهذا المولد' : 'View Maintenance History for this Unit'}</span>
                </button>
              </div>

              <button type="submit" className="w-full py-4 bg-[#001F3F] text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Apply Changes</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockManagement;
