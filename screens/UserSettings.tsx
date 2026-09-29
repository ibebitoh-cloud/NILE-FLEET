
import React, { useState, useContext, useRef, useEffect } from 'react';
import { User, UserRole, InvoiceSettings, Location } from '../types';
import { db } from '../services/supabaseDb';
import { LanguageContext, ThemeContext, ThemeMode } from '../App';
import { translations, translateEntity, discoveryQueue, dynamicTranslations, registerDynamicTranslation, deleteDynamicTranslation, scanForUntranslated } from '../translations';
import { AVATARS } from '../constants';
import SignaturePad from '../components/SignaturePad';

interface UserSettingsProps {
  user: User;
  onUpdate: (updates: Partial<User>) => void;
}

const UserSettings: React.FC<UserSettingsProps> = ({ user, onUpdate }) => {
  const { lang } = useContext(LanguageContext);
  const { theme, setTheme, scale, setScale, isDark, updateCustomTheme } = useContext(ThemeContext);
  const t = translations[lang];
  const isAr = lang === 'ar';
  
  const isSuperOwner = user.email === 'bebito@nilefleet.com';
  const isAdmin = user.role === UserRole.ADMIN;

  const [customBg, setCustomBg] = useState(() => localStorage.getItem('custom_bg_primary') || '#ffffff');
  const [customText, setCustomText] = useState(() => localStorage.getItem('custom_text_primary') || '#0f172a');
  const [customSec, setCustomSec] = useState(() => localStorage.getItem('custom_text_secondary') || '#475569');
  const [customCard, setCustomCard] = useState(() => localStorage.getItem('custom_card_bg') || '#ffffff');
  const [customAccent, setCustomAccent] = useState(() => localStorage.getItem('custom_accent') || '#3b82f6');
  const [customBorder, setCustomBorder] = useState(() => localStorage.getItem('custom_border_primary') || '#e2e8f0');
  const [customInput, setCustomInput] = useState(() => localStorage.getItem('custom_input_bg') || '#f8fafc');
  const [customIsDark, setCustomIsDark] = useState(() => localStorage.getItem('custom_is_dark') === 'true');
  const [customRowBg, setCustomRowBg] = useState(() => localStorage.getItem('custom_row_bg') || '#ffffff');
  const [customRailBg, setCustomRailBg] = useState(() => localStorage.getItem('custom_rail_bg') || '#ffffff');

  const handleCustomThemeChange = (updates: {
    bg?: string;
    text?: string;
    textSec?: string;
    card?: string;
    accent?: string;
    border?: string;
    input?: string;
    isDark?: boolean;
    rowBg?: string;
    railBg?: string;
  }) => {
    const updatedBg = updates.bg !== undefined ? updates.bg : customBg;
    const updatedText = updates.text !== undefined ? updates.text : customText;
    const updatedTextSec = updates.textSec !== undefined ? updates.textSec : customSec;
    const updatedCard = updates.card !== undefined ? updates.card : customCard;
    const updatedAccent = updates.accent !== undefined ? updates.accent : customAccent;
    const updatedBorder = updates.border !== undefined ? updates.border : customBorder;
    const updatedInput = updates.input !== undefined ? updates.input : customInput;
    const updatedIsDark = updates.isDark !== undefined ? updates.isDark : customIsDark;
    const updatedRowBg = updates.rowBg !== undefined ? updates.rowBg : customRowBg;
    const updatedRailBg = updates.railBg !== undefined ? updates.railBg : customRailBg;

    if (updates.bg !== undefined) setCustomBg(updates.bg);
    if (updates.text !== undefined) setCustomText(updates.text);
    if (updates.textSec !== undefined) setCustomSec(updates.textSec);
    if (updates.card !== undefined) setCustomCard(updates.card);
    if (updates.accent !== undefined) setCustomAccent(updates.accent);
    if (updates.border !== undefined) setCustomBorder(updates.border);
    if (updates.input !== undefined) setCustomInput(updates.input);
    if (updates.isDark !== undefined) setCustomIsDark(updates.isDark);
    if (updates.rowBg !== undefined) setCustomRowBg(updates.rowBg);
    if (updates.railBg !== undefined) setCustomRailBg(updates.railBg);

    updateCustomTheme({
      bg: updatedBg,
      text: updatedText,
      textSec: updatedTextSec,
      card: updatedCard,
      accent: updatedAccent,
      border: updatedBorder,
      input: updatedInput,
      isDark: updatedIsDark,
      rowBg: updatedRowBg,
      railBg: updatedRailBg
    });
  };

  const [activeTab, setActiveTab] = useState<'IDENTITY' | 'CONTACT' | 'DISPLAY' | 'BUSINESS' | 'LINGUISTICS' | 'COMMAND'>('IDENTITY');
  
  const [profileData, setProfileData] = useState<Partial<User>>({
    ...user,
    invoiceSettings: user.invoiceSettings || {
      primaryColor: '#001F3F',
      accentColor: '#C2A378',
      headerAlignment: 'left',
      layoutStyle: 'MODERN',
      footerText: 'Official Nile Fleet Document',
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
      customItemName: 'Genset Clip-On Rental',
      documentTitle: 'FISCAL INVOICE',
      vatPercentage: 14,
      companyHeaderAddress: 'Cairo Logistics Terminal',
      companyVatNumber: '---',
      companyContactEmail: 'ops@nilefleet.com',
      companyContactPhone: '+20 114 647 5759',
      bankName: 'NBE',
      bankIban: '---',
      bankSwift: '---',
      customHeaderNote: ''
    }
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showAvatarStudio, setShowAvatarStudio] = useState(false);
  const [shieldActive, setShieldActive] = useState(false);
  const [purgeAuthPassword, setPurgeAuthPassword] = useState('');
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const [customWipePassword, setCustomWipePassword] = useState(user.wipePassword || 'WIPE123');
  const [holdTimer, setHoldTimer] = useState(0);
  const holdIntervalRef = useRef<any>(null);

  // Linguistics State
  const [manualEn, setManualEn] = useState('');
  const [manualAr, setManualAr] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ found: number; scanned: number } | null>(null);

  // Manual system-wide sweep for terms that still have no Arabic equivalent
  const handleScanSystem = () => {
    setIsScanning(true);
    setScanResult(null);
    try {
      const values: (string | undefined | null)[] = [];

      db.getOperations().forEach(o => {
        values.push(o.customerName, o.trucker, o.beneficiaryName, o.commodity,
                    o.clipperName, o.driverName, o.status, o.shipperAddress);
      });
      db.getReservations().forEach(r => {
        values.push(r.customerName, r.shipper, r.trucker, r.beneficiaryName, r.shipperAddress);
      });
      db.getUsers().forEach(u => {
        values.push(u.companyName, u.name, u.jobTitle, u.department, u.governorate);
      });
      db.getStock().forEach(s => values.push(s.location, s.status));
      db.getInvoices().forEach(i => values.push(i.customerName, i.status));
      db.getPayments().forEach(p => values.push(p.customerName, p.type));
      db.getMaintenanceLogs().forEach(l => {
        values.push(l.serviceType, l.technician, l.status, l.description, l.partsReplaced);
      });
      db.getEmployees().forEach(e => values.push(e.name, e.position));
      db.getProcurements().forEach(p => values.push(p.personName, p.itemDescription, p.status));
      db.getCustomerPrices().forEach(p => values.push(p.customerName));

      const found = scanForUntranslated(values);
      setScanResult({ found: found.length, scanned: values.filter(Boolean).length });
      setLangUpdateTrigger(v => v + 1);
    } finally {
      setIsScanning(false);
    }
  };
  const [langUpdateTrigger, setLangUpdateTrigger] = useState(0);

  const NUCLEAR_PHRASE = 'WIPE';
  const logoInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);

  const handleProfileUpdate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    let updatedData = { ...profileData };
    if (user.role === UserRole.GATE_OPERATOR) {
      delete updatedData.jobTitle;
      delete updatedData.department;
      delete updatedData.assignedPorts;
      delete updatedData.companyName;
      delete updatedData.phoneNumber;
      delete updatedData.joinedDate;
    }
    setTimeout(() => {
      db.updateUser(user.id, updatedData);
      onUpdate(updatedData);
      setIsSaving(false);
      addNotification(isAr ? 'تم حفظ التغييرات بنجاح' : 'Changes saved to secure node.');
    }, 600);
  };

  const [notifications, setNotifications] = useState<{id: number, msg: string}[]>([]);
  const addNotification = (msg: string) => {
    const id = Date.now();
    setNotifications(prev => [{id, msg}, ...prev]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 3000);
  };

  const updateInvoiceSetting = (key: keyof InvoiceSettings, value: any) => {
    setProfileData(prev => ({
      ...prev,
      invoiceSettings: { ...(prev.invoiceSettings as InvoiceSettings), [key]: value }
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileData(prev => ({
          ...prev,
          invoiceSettings: {
            ...(prev.invoiceSettings as InvoiceSettings),
            logoUrl: reader.result as string,
            showLogo: true
          }
        }));
        addNotification(isAr ? 'تم تحميل الشعار وتفعيله بنجاح' : 'Company Logo uploaded and forced to appear!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileData(prev => ({
          ...prev,
          invoiceSettings: {
            ...(prev.invoiceSettings as InvoiceSettings),
            stampUrl: reader.result as string,
            showStamp: true
          }
        }));
        addNotification(isAr ? 'تم تحميل الختم وتفعيله بنجاح' : 'Corporate Stamp uploaded and forced to appear!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setProfileData(prev => ({
      ...prev,
      invoiceSettings: {
        ...(prev.invoiceSettings as InvoiceSettings),
        logoUrl: undefined
      }
    }));
    addNotification(isAr ? 'تم إزالة الشعار' : 'Company Logo removed.');
  };

  const handleRemoveStamp = () => {
    setProfileData(prev => ({
      ...prev,
      invoiceSettings: {
        ...(prev.invoiceSettings as InvoiceSettings),
        stampUrl: undefined
      }
    }));
    addNotification(isAr ? 'تم إزالة الختم' : 'Corporate Stamp removed.');
  };

  const handleManualLearn = () => {
    if (!manualEn || !manualAr) return;
    registerDynamicTranslation(manualEn, manualAr);
    setManualEn('');
    setManualAr('');
    setLangUpdateTrigger(p => p + 1);
    addNotification(isAr ? 'تم تحديث القاموس بنجاح' : 'Linguistic entry verified.');
  };

  const handleDeleteWord = (en: string) => {
    deleteDynamicTranslation(en);
    setLangUpdateTrigger(p => p + 1);
  };

  const handleUpdateWipePassword = () => {
    if (!customWipePassword.trim()) {
      addNotification(isAr ? 'لا يمكن ترك رمز المرور فارغاً' : 'Wipe passcode cannot be empty');
      return;
    }
    const updatedData = { ...profileData, wipePassword: customWipePassword };
    setProfileData(updatedData);
    db.updateUser(user.id, updatedData);
    onUpdate(updatedData);
    addNotification(isAr ? 'تم تحديث رمز مرور التصفير المخصص' : 'Custom wipe passcode updated successfully');
  };

  const startPurgeHold = () => {
    const requiredPasscode = user.wipePassword || 'WIPE123';
    if (purgeConfirmText !== NUCLEAR_PHRASE || purgeAuthPassword !== requiredPasscode) {
      addNotification(isAr ? 'فشل التحقق من الهوية' : 'Identity Verification Failed');
      return;
    }
    holdIntervalRef.current = setInterval(() => {
      setHoldTimer(prev => {
        if (prev >= 100) {
          executeNuclearPurge();
          clearInterval(holdIntervalRef.current);
          return 100;
        }
        return prev + 20;
      });
    }, 100);
  };

  const stopPurgeHold = () => {
    clearInterval(holdIntervalRef.current);
    if (holdTimer < 100) setHoldTimer(0);
  };

  const executeNuclearPurge = () => {
    db.totalSystemWipe();
    addNotification(isAr ? 'تم تدمير كافة البيانات وتصفير النظام' : 'TOTAL SYSTEM TERMINATION COMPLETE');
    setShieldActive(false);
    setHoldTimer(0);
    setPurgeConfirmText('');
    setPurgeAuthPassword('');
  };

  const labelClass = "text-[9px] font-black uppercase text-slate-400 block mb-2 tracking-[0.15em] px-1";
  const inputClass = "w-full px-5 py-3 rounded-2xl border-2 outline-none text-xs font-bold transition-all border-slate-100 focus:border-rose-500 text-slate-900 bg-slate-50 dark:border-white/5 dark:focus:border-rose-400 dark:text-white dark:bg-white/5";
  const toggleClass = (checked: boolean) => `relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-rose-500' : 'bg-slate-200 dark:bg-slate-700'}`;
  const toggleThumbClass = (checked: boolean) => `pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`;

  const brandingSettings = profileData.invoiceSettings as InvoiceSettings;

  return (
    <div className="max-w-[1500px] mx-auto space-y-6 animate-in fade-in duration-500 pb-32 text-start">
      {/* Redesigned Settings Command Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#001F3F] via-[#062b52] to-[#07111f] p-6 lg:p-8 text-white shadow-2xl border border-white/10">
        <div className="absolute -top-32 -right-20 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl"></div>
        <div className="absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-[#C2A378]/10 blur-3xl"></div>
        <div className="relative z-10 flex flex-col xl:flex-row gap-7 items-stretch xl:items-center">
          <div className="flex items-center gap-5 min-w-0 xl:min-w-[330px]">
            <div className="relative group cursor-pointer shrink-0" onClick={() => setShowAvatarStudio(true)}>
              <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-[1.75rem] overflow-hidden ring-4 ring-white/10 shadow-2xl">
                <img src={profileData.avatarUrl} alt="User" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all rounded-[1.75rem]">
                  <span className="text-white text-[8px] font-black uppercase">{isAr ? 'تغيير الصورة' : 'Change'}</span>
                </div>
              </div>
              <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white w-7 h-7 rounded-xl flex items-center justify-center text-sm shadow-xl ring-4 ring-[#062b52]">✓</div>
            </div>
            <div className="min-w-0">
              <p className="text-[8px] font-black tracking-[0.35em] uppercase text-[#C2A378] mb-2">{isAr ? 'إعدادات الحساب' : 'ACCOUNT SETTINGS'}</p>
              <h1 className="text-2xl lg:text-3xl font-black tracking-tight truncate">{profileData.name}</h1>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-blue-300 mt-2 truncate">{user.role} • {isAr ? 'مستوى الصلاحية' : 'ACCESS LEVEL'}</p>
            </div>
          </div>
          <div className="hidden xl:block h-20 w-px bg-white/10"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4"><p className="text-[7px] font-black uppercase tracking-widest text-slate-400">{isAr ? 'الحالة' : 'STATUS'}</p><p className="mt-2 text-sm font-black text-emerald-400">● {isAr ? 'نشط' : 'ACTIVE'}</p></div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4"><p className="text-[7px] font-black uppercase tracking-widest text-slate-400">{isAr ? 'البريد' : 'EMAIL'}</p><p className="mt-2 text-[9px] font-bold truncate">{profileData.email}</p></div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4"><p className="text-[7px] font-black uppercase tracking-widest text-slate-400">{isAr ? 'الوصول' : 'ACCESS'}</p><p className="mt-2 text-[9px] font-black uppercase text-blue-300">{isAdmin || isSuperOwner ? (isAr ? 'إداري' : 'ADMIN') : (isAr ? 'مستخدم' : 'USER')}</p></div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4"><p className="text-[7px] font-black uppercase tracking-widest text-slate-400">{isAr ? 'اللغة' : 'LANGUAGE'}</p><p className="mt-2 text-sm font-black">{isAr ? 'العربية' : 'ENGLISH'}</p></div>
          </div>
        </div>
      </div>
      
      {/* Settings Navigation */}
      <div className="flex flex-col lg:flex-row items-center gap-6 bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-lg border border-slate-100 dark:border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative group cursor-pointer" onClick={() => setShowAvatarStudio(true)}>
          <div className="w-24 h-24 rounded-2xl border-4 border-rose-100 dark:border-rose-900/30 overflow-hidden relative shadow-lg">
            <img src={profileData.avatarUrl} alt="User" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all text-center">
              <span className="text-white text-[8px] font-black uppercase">Change Identity</span>
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white w-7 h-7 rounded-lg flex items-center justify-center text-sm shadow-xl ring-2 ring-white dark:ring-slate-900">✓</div>
        </div>
        <div className="flex-1 w-full space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.3em] text-blue-600">{isAr ? 'مركز التحكم' : 'SETTINGS CONTROL CENTER'}</p>
              <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white mt-1">{isAr ? 'تخصيص حسابك وبيئة العمل' : 'Configure your account and workspace'}</h2>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 text-[8px] font-black uppercase"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{isAr ? 'النظام يعمل' : 'SYSTEM ONLINE'}</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
            {[
              { id: 'IDENTITY', label: isAr ? 'الهوية' : 'Identity', icon: '👤' },
              { id: 'CONTACT', label: isAr ? 'بيانات العمل' : 'Logistics', icon: '📍' },
              { id: 'DISPLAY', label: isAr ? 'المظهر' : 'Interface', icon: '🎨' },
              { id: 'BUSINESS', label: isAr ? 'الفواتير والشركة' : 'Branding', icon: '🏢' },
              { id: 'LINGUISTICS', label: isAr ? 'اللغة والذكاء' : 'Linguistics', icon: '🗣️' },
              isSuperOwner ? { id: 'COMMAND', label: isAr ? 'التحكم الحرج' : 'Command', icon: '☢️' } : null,
            ].filter((tab): tab is { id: string; label: string; icon: string } => {
              if (!tab) return false;
              if (user.role === UserRole.GATE_OPERATOR) {
                return ['IDENTITY', 'DISPLAY', 'LINGUISTICS'].includes(tab.id);
              }
              return true;
            }).map((tab) => (
              <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-[8px] font-black uppercase transition-all border ${activeTab === tab.id ? 'bg-[#001F3F] text-white border-[#001F3F] shadow-lg shadow-blue-900/20' : 'bg-slate-50 dark:bg-slate-800/70 text-slate-400 border-slate-100 dark:border-white/5 hover:border-blue-200 hover:text-blue-600'}`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-2xl overflow-hidden min-h-[500px]">
        {activeTab === 'IDENTITY' && (
          <form onSubmit={handleProfileUpdate} className="p-8 lg:p-12 space-y-8 animate-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 text-start">
               <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div><label className={labelClass}>Operational Name</label><input required className={inputClass} value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} /></div>
                     <div><label className={labelClass}>System ID (Email)</label><input disabled className={`${inputClass} opacity-50 cursor-not-allowed`} value={profileData.email} /></div>
                  </div>
                  <div><label className={labelClass}>Bio</label><textarea className={`${inputClass} h-24 pt-3`} value={profileData.bio} onChange={e => setProfileData({...profileData, bio: e.target.value})} /></div>
               </div>
               <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 italic px-2">Signature Asset</h4>
                  <SignaturePad initialValue={profileData.signatureUrl} onSave={(url) => setProfileData(prev => ({ ...prev, signatureUrl: url }))} isAr={isAr} />
               </div>
            </div>
            <button type="submit" className="w-full py-5 rounded-2xl bg-rose-600 text-white font-black uppercase text-[10px] tracking-widest">Commit Changes</button>
          </form>
        )}

        {/* ... (Previous tabs kept identical for brevity) */}

        {activeTab === 'LINGUISTICS' && (
          <div className="p-8 lg:p-12 space-y-12 animate-in slide-in-from-bottom-4 text-start">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-5 space-y-8">
                   <div>
                      <h3 className="text-xl font-black uppercase italic tracking-tighter text-[#001F3F] dark:text-white leading-none">Manual Training Node</h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">Force-teach the system new logistics terms</p>
                   </div>

                   <div className="bg-slate-50 dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 space-y-6">
                      <div>
                        <label className={labelClass}>English Phrase</label>
                        <input className={inputClass} placeholder="e.g. CUSTOMER_HUB" value={manualEn} onChange={e => setManualEn(e.target.value.toUpperCase())} />
                      </div>
                      <div>
                        <label className={labelClass}>Arabic Equivalent</label>
                        <input className={`${inputClass} font-cairo`} placeholder="مثال: مركز العملاء" value={manualAr} onChange={e => setManualAr(e.target.value)} />
                      </div>
                      <button 
                        onClick={handleManualLearn}
                        disabled={!manualEn || !manualAr}
                        className="w-full py-5 bg-[#001F3F] text-[#C2A378] rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 disabled:opacity-30 transition-all"
                      >
                        Authorize & Teach System
                      </button>
                   </div>

                   <div className="p-8 border-2 border-dashed border-slate-100 dark:border-white/5 rounded-[2.5rem] space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Discovery Queue</h4>
                        <span className="text-[9px] font-black text-slate-400">{discoveryQueue.size}</span>
                      </div>

                      <button
                        onClick={handleScanSystem}
                        disabled={isScanning}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                      >
                        <span>{isScanning ? '⏳' : '🔍'}</span>
                        <span>{isScanning
                          ? (isAr ? 'جاري الفحص...' : 'Scanning System...')
                          : (isAr ? 'فحص يدوي للنظام عن كلمات تحتاج ترجمة' : 'Manual Scan for Untranslated Words')}</span>
                      </button>

                      {scanResult && (
                        <div className={`p-4 rounded-2xl text-[9px] font-black uppercase tracking-wider ${scanResult.found > 0 ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'}`}>
                          {scanResult.found > 0
                            ? (isAr
                                ? `تم فحص ${scanResult.scanned} قيمة — ${scanResult.found} كلمة جديدة تحتاج ترجمة`
                                : `Scanned ${scanResult.scanned} values — ${scanResult.found} new term(s) need translation`)
                            : (isAr
                                ? `تم فحص ${scanResult.scanned} قيمة — لا توجد كلمات جديدة`
                                : `Scanned ${scanResult.scanned} values — everything is translated`)}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                         {Array.from(discoveryQueue).map(word => (
                           <button 
                            key={word} 
                            onClick={() => setManualEn(word.toUpperCase())}
                            className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl text-[9px] font-black uppercase border border-blue-100 dark:border-blue-800 hover:bg-blue-100 transition-all"
                           >
                             {word}
                           </button>
                         ))}
                         {discoveryQueue.size === 0 && <p className="text-[9px] font-bold text-slate-300 uppercase italic">No new terms detected by observer.</p>}
                      </div>
                   </div>
                </div>

                <div className="lg:col-span-7 space-y-6">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 italic px-2">Learned Intelligence Registry</h4>
                   <div className={`rounded-[2.5rem] border-2 overflow-hidden ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100'}`}>
                      <table className="w-full text-left border-collapse">
                         <thead className="bg-[#001F3F] text-white text-[9px] font-black uppercase">
                            <tr>
                               <th className="p-5">English Entity</th>
                               <th className="p-5">Arabic Logic</th>
                               <th className="p-5 text-right w-16"></th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {Object.entries(dynamicTranslations).map(([en, ar]) => (
                              <tr key={en} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                 <td className="p-5 font-black text-[10px] text-[#001F3F] dark:text-blue-400 uppercase tracking-tighter">{en}</td>
                                 <td className="p-5 font-bold font-cairo text-sm text-slate-600 dark:text-slate-300">{ar}</td>
                                 <td className="p-5 text-right">
                                    <button 
                                      onClick={() => handleDeleteWord(en)}
                                      className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                       ✕
                                    </button>
                                 </td>
                              </tr>
                            ))}
                            {Object.keys(dynamicTranslations).length === 0 && (
                              <tr>
                                 <td colSpan={3} className="py-20 text-center opacity-30 italic font-black uppercase text-[10px] tracking-[0.4em]">Intelligence Matrix is Empty</td>
                              </tr>
                            )}
                         </tbody>
                      </table>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* ... (Previous tabs kept identical for brevity) */}
        {activeTab === 'CONTACT' && (
          <form onSubmit={handleProfileUpdate} className="p-8 lg:p-12 space-y-8 animate-in slide-in-from-bottom-4 text-start">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div><label className={labelClass}>Phone Number</label><input className={inputClass} value={profileData.phoneNumber || ''} onChange={e => setProfileData({...profileData, phoneNumber: e.target.value})} /></div>
               <div><label className={labelClass}>Job Title</label><input className={inputClass} value={profileData.jobTitle || ''} onChange={e => setProfileData({...profileData, jobTitle: e.target.value})} /></div>
               <div><label className={labelClass}>Department</label><input className={inputClass} value={profileData.department || ''} onChange={e => setProfileData({...profileData, department: e.target.value})} /></div>
               <div><label className={labelClass}>Joined Date</label><input type="date" className={inputClass} value={profileData.joinedDate || ''} onChange={e => setProfileData({...profileData, joinedDate: e.target.value})} /></div>
            </div>
            <button type="submit" className="w-full py-5 rounded-2xl bg-[#001F3F] text-white font-black uppercase text-[10px] tracking-widest">Update Logistics Info</button>
          </form>
        )}

        {activeTab === 'DISPLAY' && (
          <div className="p-8 lg:p-12 space-y-12 animate-in slide-in-from-bottom-4">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
               <div className="space-y-8">
                  <h3 className="text-lg font-black uppercase italic tracking-tighter text-[#001F3F] dark:text-white">Interface Personalization</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { id: 'rose', label: isAr ? 'كلاسيكي' : 'Classic', bg: 'bg-rose-500' },
                      { id: 'nile', label: isAr ? 'النيل' : 'Nile Command', bg: 'bg-emerald-800' },
                      { id: 'corporate', label: isAr ? 'مؤسسي' : 'Corporate', bg: 'bg-sky-600' },
                      { id: 'carbon', label: isAr ? 'كربون' : 'Carbon', bg: 'bg-zinc-900' },
                      { id: 'royal', label: isAr ? 'ملكي' : 'Royal', bg: 'bg-violet-700' },
                      { id: 'sandstorm', label: isAr ? 'رملي' : 'Sandstorm', bg: 'bg-amber-600' },
                      { id: 'crimson', label: isAr ? 'قرمزي' : 'Crimson', bg: 'bg-rose-700' },
                      { id: 'black', label: isAr ? 'طرفية' : 'Terminal', bg: 'bg-black' },
                      { id: 'navy', label: isAr ? 'كحلي' : 'Navy', bg: 'bg-blue-900' },
                      { id: 'forest', label: isAr ? 'غابة' : 'Forest', bg: 'bg-emerald-900' },
                      { id: 'lava', label: isAr ? 'حمم' : 'Magma', bg: 'bg-red-900' },
                      { id: 'arctic', label: isAr ? 'جليدي' : 'Arctic', bg: 'bg-sky-100' },
                      { id: 'emerald-vibrant', label: isAr ? 'زمردي' : 'Emerald', bg: 'bg-emerald-500' },
                      { id: 'phantom', label: isAr ? 'شبح' : 'Phantom', bg: 'bg-zinc-800' },
                      { id: 'custom', label: isAr ? 'مخصص' : 'Custom', bg: 'bg-gradient-to-tr from-rose-500 via-green-500 to-blue-500' }                    ].map(t => (
                      <button 
                        key={t.id}
                        onClick={() => setTheme(t.id as any)}
                        className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 min-h-[82px] ${theme === t.id ? 'border-[var(--accent)] scale-[1.03] shadow-xl' : 'border-slate-100 dark:border-white/5 hover:border-[var(--accent)]/50'}`}
                      >
                        <div className={`w-8 h-8 rounded-full ${t.bg} shadow-inner`}></div>
                        <span className="text-[8px] font-black uppercase" style={{ color: "var(--text-secondary)" }}>{t.label}</span>
                      </button>
                    ))}
                  </div>

                  {theme === 'custom' && (
                    <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-dashed border-rose-500/50 space-y-6 animate-in slide-in-from-top-4 duration-300">
                      <div>
                        <h4 className="text-xs font-black text-rose-500 uppercase tracking-widest mb-1">
                          {isAr ? 'لوحة الألوان المخصصة' : 'Custom Palette Builder'}
                        </h4>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                          {isAr ? 'صمم نظام الألوان الخاص بك لتسهيل القراءة التامة.' : 'Design your own custom high-contrast environment.'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{isAr ? 'الخلفية الأساسية' : 'Primary BG'}</label>
                          <div className="flex gap-2 items-center">
                            <input type="color" className="w-8 h-8 rounded border-0 cursor-pointer" value={customBg} onChange={e => handleCustomThemeChange({ bg: e.target.value })} />
                            <span className="text-[10px] font-mono font-bold uppercase">{customBg}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{isAr ? 'لون البطاقات' : 'Card BG'}</label>
                          <div className="flex gap-2 items-center">
                            <input type="color" className="w-8 h-8 rounded border-0 cursor-pointer" value={customCard} onChange={e => handleCustomThemeChange({ card: e.target.value })} />
                            <span className="text-[10px] font-mono font-bold uppercase">{customCard}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{isAr ? 'النص الرئيسي' : 'Primary Text'}</label>
                          <div className="flex gap-2 items-center">
                            <input type="color" className="w-8 h-8 rounded border-0 cursor-pointer" value={customText} onChange={e => handleCustomThemeChange({ text: e.target.value })} />
                            <span className="text-[10px] font-mono font-bold uppercase">{customText}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{isAr ? 'النص الثانوي' : 'Secondary Text'}</label>
                          <div className="flex gap-2 items-center">
                            <input type="color" className="w-8 h-8 rounded border-0 cursor-pointer" value={customSec} onChange={e => handleCustomThemeChange({ textSec: e.target.value })} />
                            <span className="text-[10px] font-mono font-bold uppercase">{customSec}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{isAr ? 'العنصر المميز' : 'Accent Color'}</label>
                          <div className="flex gap-2 items-center">
                            <input type="color" className="w-8 h-8 rounded border-0 cursor-pointer" value={customAccent} onChange={e => handleCustomThemeChange({ accent: e.target.value })} />
                            <span className="text-[10px] font-mono font-bold uppercase">{customAccent}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{isAr ? 'خلفية الإدخال' : 'Input BG'}</label>
                          <div className="flex gap-2 items-center">
                            <input type="color" className="w-8 h-8 rounded border-0 cursor-pointer" value={customInput} onChange={e => handleCustomThemeChange({ input: e.target.value })} />
                            <span className="text-[10px] font-mono font-bold uppercase">{customInput}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{isAr ? 'لون الحدود' : 'Border'}</label>
                          <div className="flex gap-2 items-center">
                            <input type="color" className="w-8 h-8 rounded border-0 cursor-pointer" value={customBorder} onChange={e => handleCustomThemeChange({ border: e.target.value })} />
                            <span className="text-[10px] font-mono font-bold uppercase">{customBorder}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{isAr ? 'خلفية صفوف الجداول' : 'Main Table Rows BG'}</label>
                          <div className="flex gap-2 items-center">
                            <input type="color" className="w-8 h-8 rounded border-0 cursor-pointer" value={customRowBg} onChange={e => handleCustomThemeChange({ rowBg: e.target.value })} />
                            <span className="text-[10px] font-mono font-bold uppercase">{customRowBg}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{isAr ? 'خلفية القائمة الجانبية' : 'Sidebar Rail BG'}</label>
                          <div className="flex gap-2 items-center">
                            <input type="color" className="w-8 h-8 rounded border-0 cursor-pointer" value={customRailBg} onChange={e => handleCustomThemeChange({ railBg: e.target.value })} />
                            <span className="text-[10px] font-mono font-bold uppercase">{customRailBg}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{isAr ? 'نمط التباين' : 'Dark Mode Base'}</label>
                          <div className="flex items-center h-8 gap-2">
                            <input type="checkbox" id="custom-is-dark" checked={customIsDark} onChange={e => handleCustomThemeChange({ isDark: e.target.checked })} className="rounded cursor-pointer border-slate-300" />
                            <label htmlFor="custom-is-dark" className="text-[9px] font-black uppercase text-slate-500 select-none cursor-pointer">
                              {isAr ? 'تفعيل الوضع الداكن' : 'Enable Dark Mode'}
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end">
                        <button 
                          onClick={() => {
                            handleCustomThemeChange({
                              bg: '#ffffff',
                              text: '#0f172a',
                              textSec: '#475569',
                              card: '#ffffff',
                              accent: '#3b82f6',
                              border: '#e2e8f0',
                              input: '#f8fafc',
                              isDark: false,
                              rowBg: '#ffffff',
                              railBg: '#ffffff'
                            });
                          }} 
                          type="button"
                          className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/25 text-rose-500 text-[8px] font-black uppercase tracking-wider rounded-lg transition-all"
                        >
                          {isAr ? 'إعادة ضبط للنظام الفاتح' : 'Reset to Light Theme'}
                        </button>
                        <button 
                          onClick={() => {
                            handleCustomThemeChange({
                              bg: '#121212',
                              text: '#f8fafc',
                              textSec: '#94a3b8',
                              card: '#1e293b',
                              accent: '#38bdf8',
                              border: '#334155',
                              input: '#0f172a',
                              isDark: true,
                              rowBg: '#1e293b',
                              railBg: '#0f172a'
                            });
                          }} 
                          type="button"
                          className="px-3 py-1 bg-slate-500/10 hover:bg-slate-500/25 text-slate-400 text-[8px] font-black uppercase tracking-wider rounded-lg transition-all"
                        >
                          {isAr ? 'إعادة ضبط للنظام الداكن' : 'Reset to Dark Theme'}
                        </button>
                      </div>
                    </div>
                  )}
               </div>

               <div className="space-y-8">
                  <h3 className="text-lg font-black uppercase italic tracking-tighter text-[#001F3F] dark:text-white">UI Density & Scaling</h3>
                  <div className="bg-slate-50 dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-100 dark:border-white/5 space-y-8">
                     <div className="space-y-4">
                        <div className="flex justify-between items-center">
                           <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Global Zoom</label>
                           <span className="text-xs font-black text-blue-600">{(scale * 100).toFixed(0)}%</span>
                        </div>
                        <input 
                           type="range" 
                           min="0.7" 
                           max="1.2" 
                           step="0.05" 
                           value={scale} 
                           onChange={(e) => setScale(parseFloat(e.target.value))} 
                           className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase">
                           <span>Tiny</span>
                           <span>Default</span>
                           <span>Large</span>
                        </div>
                     </div>

                     <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                        <p className="text-[10px] font-bold text-slate-500 leading-relaxed italic">
                           "Adjusting the scale changes the root font size, making icons, text, and spacing smaller or larger across the entire system instantly."
                        </p>
                     </div>

                     <button 
                        onClick={() => setScale(0.85)}
                        className="w-full py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-[9px] font-black uppercase text-slate-400 hover:text-[#001F3F] transition-all"
                     >
                        Reset to Optimal Density
                     </button>
                  </div>
               </div>
             </div>
          </div>
        )}

        {activeTab === 'BUSINESS' && (
          <form onSubmit={handleProfileUpdate} className="p-8 lg:p-12 space-y-10 animate-in slide-in-from-bottom-4 text-start">
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="space-y-6 lg:col-span-2">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 italic">Document Branding Details</h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className={labelClass}>Document Title</label><input className={inputClass} value={brandingSettings.documentTitle} onChange={e => updateInvoiceSetting('documentTitle', e.target.value)} /></div>
                        <div><label className={labelClass}>Currency</label><input className={inputClass} value={brandingSettings.currency} onChange={e => updateInvoiceSetting('currency', e.target.value)} /></div>
                        <div><label className={labelClass}>VAT Percentage (%)</label><input type="number" className={inputClass} value={brandingSettings.vatPercentage} onChange={e => updateInvoiceSetting('vatPercentage', parseFloat(e.target.value) || 0)} /></div>
                        <div><label className={labelClass}>Item Default Name</label><input className={inputClass} value={brandingSettings.customItemName} onChange={e => updateInvoiceSetting('customItemName', e.target.value)} /></div>
                   </div>
                   
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 italic mt-4">Corporate Ledger Nodes</h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className={labelClass}>Legal Address</label><input className={inputClass} value={brandingSettings.companyHeaderAddress} onChange={e => updateInvoiceSetting('companyHeaderAddress', e.target.value)} /></div>
                        <div><label className={labelClass}>VAT Registry ID</label><input className={inputClass} value={brandingSettings.companyVatNumber} onChange={e => updateInvoiceSetting('companyVatNumber', e.target.value)} /></div>
                        <div><label className={labelClass}>Contact Email</label><input className={inputClass} value={brandingSettings.companyContactEmail} onChange={e => updateInvoiceSetting('companyContactEmail', e.target.value)} /></div>
                        <div><label className={labelClass}>Contact Phone</label><input className={inputClass} value={brandingSettings.companyContactPhone} onChange={e => updateInvoiceSetting('companyContactPhone', e.target.value)} /></div>
                   </div>

                   <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 italic mt-4">Settlement Banking</h4>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div><label className={labelClass}>Bank Name</label><input className={inputClass} value={brandingSettings.bankName} onChange={e => updateInvoiceSetting('bankName', e.target.value)} /></div>
                        <div className="md:col-span-2"><label className={labelClass}>IBAN / Acc #</label><input className={inputClass} value={brandingSettings.bankIban} onChange={e => updateInvoiceSetting('bankIban', e.target.value)} /></div>
                    </div>

                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 italic mt-6">Brand Identity Assets (Logo & Stamp)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Logo Asset */}
                      <div className="p-6 bg-slate-50 dark:bg-slate-800/40 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 relative">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Company Logo</span>
                        {brandingSettings.logoUrl ? (
                          <div className="relative group">
                            <img src={brandingSettings.logoUrl} className="h-16 object-contain max-w-full bg-white p-2 rounded-xl shadow-md animate-in zoom-in duration-200" alt="Logo preview" />
                            <button
                              type="button"
                              onClick={handleRemoveLogo}
                              className="absolute -top-2 -right-2 bg-rose-600 hover:bg-rose-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-lg transition-transform active:scale-95 z-10 font-bold"
                              title={isAr ? 'حذف الشعار' : 'Remove Logo'}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div 
                            onClick={() => logoInputRef.current?.click()}
                            className="flex flex-col items-center justify-center py-4 px-2 w-full h-full cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all"
                          >
                            <img src="/nile-fleet-logo.png" className="h-16 w-16 object-contain mb-2" alt="Nile Fleet default company logo" />
                            <span className="text-[10px] font-bold text-blue-600 tracking-tight dark:text-blue-400">{isAr ? 'الشعار الافتراضي نشط — اضغط لاستبداله' : 'Default company logo active — click to replace'}</span>
                            <span className="text-[8px] text-slate-400 mt-0.5">JPEG / PNG / WebP</span>
                          </div>
                        )}
                        <input
                          type="file"
                          ref={logoInputRef}
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoUpload}
                        />
                        {brandingSettings.logoUrl && (
                          <div className="text-[8px] font-black uppercase text-emerald-500 tracking-wider animate-pulse">
                            ✓ Online & Active on Invoices
                          </div>
                        )}
                      </div>

                      {/* Stamp Asset */}
                      <div className="p-6 bg-slate-50 dark:bg-slate-800/40 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 relative">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Corporate Stamp</span>
                        {brandingSettings.stampUrl ? (
                          <div className="relative group">
                            <img src={brandingSettings.stampUrl} className="h-16 object-contain max-w-full bg-white p-2 rounded-xl shadow-md animate-in zoom-in duration-200" alt="Stamp preview" />
                            <button
                              type="button"
                              onClick={handleRemoveStamp}
                              className="absolute -top-2 -right-2 bg-rose-600 hover:bg-rose-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-lg transition-transform active:scale-95 z-10 font-bold"
                              title={isAr ? 'حذف الختم' : 'Remove Stamp'}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div 
                            onClick={() => stampInputRef.current?.click()}
                            className="flex flex-col items-center justify-center py-4 px-2 w-full h-full cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all"
                          >
                            <span className="text-3xl mb-1">💮</span>
                            <span className="text-[10px] font-bold text-blue-600 tracking-tight dark:text-blue-400">{isAr ? 'اضغط لرفع الختم' : 'Click to Upload Stamp'}</span>
                            <span className="text-[8px] text-slate-400 mt-0.5">Transparent PNG recommended</span>
                          </div>
                        )}
                        <input
                          type="file"
                          ref={stampInputRef}
                          accept="image/*"
                          className="hidden"
                          onChange={handleStampUpload}
                        />
                        {brandingSettings.stampUrl && (
                          <div className="text-[8px] font-black uppercase text-emerald-500 tracking-wider animate-pulse">
                            ✓ Stamp is online & forced to display
                          </div>
                        )}
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-[#C2A378] italic">Design Overrides</h4>
                   <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-100 dark:border-white/5 space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                        {[
                            { key: 'showLogo', label: 'Company Logo' },
                            { key: 'showStamp', label: 'Corporate Stamp' },
                            { key: 'showSignature', label: 'Authorized Sign' },
                            { key: 'showCompanyInfo', label: 'Company Profile' },
                            { key: 'showBankDetails', label: 'Bank Nodes' },
                            { key: 'showInvoiceId', label: 'Serial ID' },
                            { key: 'showIssueDate', label: 'Issued Date' },
                            { key: 'showCustomerDetails', label: 'Client Details' },
                            { key: 'showBookingRef', label: 'Booking Refs' },
                            { key: 'showContainer', label: 'Container IDs' },
                            { key: 'showGenset', label: 'Genset Serials' },
                            { key: 'showRouteInfo', label: 'Terminal Routing' },
                            { key: 'showUnitRate', label: 'Base Rates' },
                            { key: 'showVatColumn', label: 'Inline VAT' },
                            { key: 'showShipperName', label: 'Shipper Identity' },
                            { key: 'showTruckerName', label: 'Trucker Identity' },
                            { key: 'showSubtotalRow', label: 'Subtotal Row' },
                            { key: 'showVatRow', label: 'VAT Summary' },
                            { key: 'showGrandTotal', label: 'Grand Total' }
                        ].map(item => (
                            <div key={item.key} className="flex items-center justify-between">
                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">{item.label}</span>
                                <button type="button" onClick={() => updateInvoiceSetting(item.key as any, !((brandingSettings as any)[item.key]))} className={toggleClass((brandingSettings as any)[item.key])}><span className={toggleThumbClass((brandingSettings as any)[item.key])} /></button>
                            </div>
                        ))}
                   </div>
                </div>
             </div>
             <div><label className={labelClass}>Footer Legal Text</label><textarea className={`${inputClass} h-16 pt-3`} value={brandingSettings.footerText} onChange={e => updateInvoiceSetting('footerText', e.target.value)} /></div>
             <button type="submit" className="w-full py-5 rounded-2xl bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest shadow-xl">Deploy Branding Matrix</button>
          </form>
        )}

        {activeTab === 'COMMAND' && isSuperOwner && (
          <div className="p-8 lg:p-12 space-y-10 animate-in slide-in-from-bottom-4 text-start overflow-hidden">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Visual Hazard Header */}
                <div className="lg:col-span-12 flex flex-col md:flex-row items-center justify-between p-8 bg-black border-4 border-rose-600 rounded-[2.5rem] shadow-[0_0_50px_rgba(225,29,72,0.2)] animate-pulse">
                   <div className="flex items-center gap-6">
                      <div className="text-6xl text-rose-600">☢️</div>
                      <div>
                         <h2 className="text-3xl font-black text-rose-600 uppercase italic tracking-tighter">Strategic Wipe Protocol</h2>
                         <p className="text-[10px] font-bold text-rose-800 uppercase tracking-[0.5em] mt-1">Classification: High Stakes Core Deletion</p>
                      </div>
                   </div>
                   <div className="flex bg-rose-600/10 p-4 rounded-2xl border border-rose-600/30 mt-6 md:mt-0">
                      <div className="text-center px-4 border-r border-rose-600/20"><p className="text-[8px] font-black text-rose-400 uppercase">Alert Level</p><p className="text-rose-600 font-black text-lg">DEFCON 1</p></div>
                      <div className="text-center px-4"><p className="text-[8px] font-black text-rose-400 uppercase">System Integrity</p><p className="text-emerald-500 font-black text-lg">CRITICAL</p></div>
                   </div>
                </div>

                {/* Industrial Form Control */}
                <div className="lg:col-span-7 bg-slate-900 p-10 rounded-[3rem] border border-white/5 shadow-2xl space-y-10 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-5"><span className="text-9xl font-black italic">PURGE</span></div>
                   
                   <div className="relative z-10 space-y-8">
                      {/* Set Wipe Passcode Section */}
                      <div className="p-6 bg-black/40 rounded-2xl border-2 border-rose-950/20 space-y-4">
                         <div>
                            <h4 className="text-xs font-black text-[#C2A378] uppercase tracking-wider mb-1 font-sans">
                               {isAr ? 'رمز تصفير النظام المخصص' : 'Dedicated Wipe Passcode'}
                            </h4>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide leading-normal">
                               {isAr 
                                 ? 'حدد رمز مرور خاصاً لهذا الإجراء فقط كبديل لكلمة مرور حسابك الرئيسية.' 
                                 : 'Configure a dedicated single-purpose code for this protocol instead of your main account password.'}
                            </p>
                         </div>
                         <div className="flex flex-col sm:flex-row gap-3">
                            <input 
                               type="text" 
                               className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-xs font-bold outline-none focus:border-[#C2A378] transition-all"
                               value={customWipePassword}
                               onChange={(e) => setCustomWipePassword(e.target.value)}
                               placeholder={isAr ? "رمز التصفير (مثال: WIPE123)" : "Wipe Passcode (e.g. WIPE123)"}
                            />
                            <button
                               type="button"
                               onClick={handleUpdateWipePassword}
                               className="px-6 py-3 bg-[#C2A378] hover:bg-[#C2A378]/90 text-[#001F3F] font-black uppercase text-[9px] tracking-widest rounded-xl transition-all active:scale-95 shrink-0"
                            >
                               {isAr ? 'حفظ الرمز' : 'Save Passcode'}
                            </button>
                         </div>
                      </div>

                      <div className="p-6 bg-black/40 rounded-2xl border-2 border-rose-900/30 flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <button onClick={() => setShieldActive(!shieldActive)} className={toggleClass(shieldActive)}><span className={toggleThumbClass(shieldActive)} /></button>
                            <p className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Master Safety Shield</p>
                         </div>
                         <span className={`text-[8px] font-black px-2 py-0.5 rounded ${shieldActive ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                            {shieldActive ? 'ARMED' : 'LOCKED'}
                         </span>
                      </div>

                      {shieldActive ? (
                        <div className="space-y-8 animate-in slide-in-from-top-6 duration-500">
                           <div className="grid grid-cols-1 gap-6">
                              <div>
                                 <div className="flex justify-between items-center mb-2">
                                    <label className="text-[9px] font-black uppercase text-rose-700 block tracking-widest font-sans">Root Auth Key</label>
                                    <span className="text-[8px] font-black text-slate-500 tracking-wider font-mono">
                                       {isAr ? `الرمز المطلوب: ${user.wipePassword || 'WIPE123'}` : `Required Code: ${user.wipePassword || 'WIPE123'}`}
                                    </span>
                                 </div>
                                 <input 
                                    type="password" 
                                    className="w-full p-5 rounded-2xl bg-black border-2 border-rose-900/50 text-rose-500 font-mono text-lg tracking-[0.5em] outline-none focus:border-rose-500 focus:shadow-[0_0_20px_rgba(225,29,72,0.1)] transition-all" 
                                    value={purgeAuthPassword} 
                                    onChange={e => setPurgeAuthPassword(e.target.value)} 
                                    placeholder="••••••••" 
                                 />
                              </div>
                              <div>
                                 <label className="text-[9px] font-black uppercase text-rose-700 block mb-2 tracking-widest font-sans">Confirm Terminal String</label>
                                 <input 
                                    className="w-full p-5 rounded-2xl bg-black border-2 border-rose-900/50 text-rose-500 font-black text-xs uppercase tracking-widest outline-none focus:border-rose-500 focus:shadow-[0_0_20px_rgba(225,29,72,0.1)] transition-all" 
                                    value={purgeConfirmText} 
                                    onChange={e => setPurgeConfirmText(e.target.value)} 
                                    placeholder={`TYPE: ${NUCLEAR_PHRASE}`} 
                                 />
                              </div>
                           </div>

                           <div className="space-y-4">
                              <button 
                                onMouseDown={startPurgeHold} 
                                onMouseUp={stopPurgeHold} 
                                onMouseLeave={stopPurgeHold} 
                                onTouchStart={startPurgeHold}
                                onTouchEnd={stopPurgeHold}
                                disabled={purgeConfirmText !== NUCLEAR_PHRASE || purgeAuthPassword !== (user.wipePassword || 'WIPE123')} 
                                className="w-full py-10 rounded-[2.5rem] bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:opacity-20 text-white font-black uppercase text-sm tracking-[0.5em] shadow-[0_20px_50px_rgba(225,29,72,0.4)] transition-all relative overflow-hidden group/burn"
                              >
                                <span className="relative z-10">{holdTimer > 0 ? 'PURGING DATA CORE...' : 'HOLD TO EXECUTE TERMINATION'}</span>
                                {holdTimer > 0 && <div className="absolute inset-0 bg-white/20" style={{ transform: `scaleX(${holdTimer/100})`, transformOrigin: 'left' }}></div>}
                              </button>
                              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                 <div className="h-full bg-rose-600 transition-all duration-100" style={{ width: `${holdTimer}%` }}></div>
                              </div>
                           </div>
                        </div>
                      ) : (
                        <div className="py-20 text-center opacity-20 grayscale select-none">
                           <p className="text-6xl mb-6">🔒</p>
                           <p className="text-xs font-black uppercase tracking-[0.5em]">Command Inputs Locked</p>
                        </div>
                      )}
                   </div>
                </div>

                {/* Industrial Warning Legend */}
                <div className="lg:col-span-5 space-y-6">
                   <div className="p-8 bg-rose-950/20 border-2 border-rose-900/30 rounded-[3rem] space-y-6">
                      <h5 className="text-xs font-black text-rose-500 uppercase tracking-widest flex items-center gap-3">
                         <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                         Terminal Warning Log
                      </h5>
                      <div className="space-y-4 text-[10px] font-bold text-rose-800 uppercase leading-relaxed">
                         <div className="flex gap-4 p-4 bg-black/40 rounded-2xl border border-rose-900/20"><span className="text-rose-600">01</span><p>Executing this command will destroy all operations, invoices, and audit logs across the fleet.</p></div>
                         <div className="flex gap-4 p-4 bg-black/40 rounded-2xl border border-rose-900/20"><span className="text-rose-600">02</span><p>All stock statuses will be reset to "IN_STOCK" and moved to default hubs.</p></div>
                         <div className="flex gap-4 p-4 bg-black/40 rounded-2xl border border-rose-900/20"><span className="text-rose-600">03</span><p>This protocol is intended for end-of-year system resets only.</p></div>
                         <div className="flex gap-4 p-4 bg-black/40 rounded-2xl border border-rose-900/20"><span className="text-rose-600">04</span><p>Recovery is impossible once the hold reaches 100% saturation.</p></div>
                      </div>
                   </div>

                   <div className="p-8 bg-[#C2A378] rounded-[3rem] shadow-xl text-[#001F3F] space-y-4">
                      <h5 className="text-xs font-black uppercase tracking-widest italic">Root Access Authenticated</h5>
                      <p className="text-[10px] font-bold leading-relaxed opacity-80 uppercase">Strategic Ownership verification complete. Bebito Command Node has full administrative reach over the Nile Fleet data lifecycle.</p>
                      <div className="h-1 w-20 bg-[#001F3F] opacity-20"></div>
                   </div>
                </div>

             </div>
          </div>
        )}
      </div>

      {/* Floating Action Notifications */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[1000] space-y-2 pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className="bg-slate-900 text-white px-10 py-5 rounded-[2.5rem] shadow-2xl border-2 border-[#C2A378] font-black uppercase text-[10px] tracking-[0.4em] animate-in slide-in-from-bottom-8">
            {n.msg}
          </div>
        ))}
      </div>

      {/* Avatar Studio Modal */}
      {showAvatarStudio && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl z-[500] flex items-center justify-center p-6" onClick={() => setShowAvatarStudio(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] max-w-4xl w-full h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
             <div className="p-8 bg-[#001F3F] text-white flex justify-between items-center text-start">
                <h3 className="text-xl font-black italic uppercase tracking-widest text-[#C2A378]">Identity Hub</h3>
                <button onClick={() => setShowAvatarStudio(false)} className="text-white hover:text-rose-500">✕</button>
             </div>
             <div className="flex-1 overflow-y-auto p-10 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
                {AVATARS.map((url, idx) => (
                   <div 
                      key={idx} 
                      onClick={() => { setProfileData(prev => ({ ...prev, avatarUrl: url })); setShowAvatarStudio(false); }}
                      className={`aspect-square rounded-xl overflow-hidden border-4 cursor-pointer hover:scale-110 transition-all ${profileData?.avatarUrl === url ? 'border-[#C2A378] shadow-lg' : 'border-slate-100 dark:border-slate-800'}`}
                   >
                      <img src={url} className="w-full h-full object-cover" alt="stock avatar" />
                   </div>
                ))}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSettings;
