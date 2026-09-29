
import React, { useContext, useState, useMemo, useEffect } from 'react';
import { LanguageContext, ThemeContext } from '../App';
import { translateEntity } from '../translations';
import { db } from '../services/supabaseDb';
import { SupportContact, FAQItem, PortInfo, Location, UserRole, User, hasReadOnlyAccess } from '../types';

const CustomerService: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const { theme, isDark } = useContext(ThemeContext);
  const isAr = lang === 'ar';
  
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}') as User, []);
  const isReadOnly = hasReadOnlyAccess(currentUser);
  const isAdmin = currentUser.role === UserRole.ADMIN && !isReadOnly;

  const [activeTab, setActiveTab] = useState<'CONTACTS' | 'FAQ' | 'PORTS'>('CONTACTS');
  const [contacts, setContacts] = useState<SupportContact[]>(db.getSupportContacts());
  const [faqs, setFaqs] = useState<FAQItem[]>(db.getFAQs());
  const [ports, setPorts] = useState<PortInfo[]>(db.getPortsInfo());

  const [showModal, setShowModal] = useState<'NONE' | 'CONTACT' | 'FAQ' | 'PORT'>('NONE');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [formSaving, setFormSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  const maintenanceContacts = contacts.filter(contact =>
    /\badel\b|\bsaid\b|maintenance/i.test(`${contact.name} ${contact.role}`)
  );

  const whatsappNumber = (value?: string) => {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = `20${digits.slice(1)}`;
    else if (digits.length === 10 && digits.startsWith('1')) digits = `20${digits}`;
    return digits.length >= 8 && digits.length <= 15 ? digits : '';
  };

  const googleMapsUrl = (port: PortInfo) => {
    const savedUrl = String(port.mapsUrl || '').trim();
    if (/^https:\/\/(?:maps\.app\.goo\.gl\/|goo\.gl\/maps\/|maps\.google\.[^/]+\/|(?:www\.)?google\.[^/]+\/maps\/)/i.test(savedUrl)) return savedUrl;
    const query = isAr ? (port.addressAr || `${translateEntity(port.location, lang)} yard`) : (port.address || `${port.location} yard`);
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  };

  const refresh = () => {
    setContacts([...db.getSupportContacts()]);
    setFaqs([...db.getFAQs()]);
    setPorts([...db.getPortsInfo()]);
  };

  useEffect(() => {
    const sync = () => refresh();
    window.addEventListener('db-undo-success', sync);
    return () => window.removeEventListener('db-undo-success', sync);
  }, []);

  const openAdd = (type: typeof showModal) => {
    if (isReadOnly || !isAdmin) return;
    setEditingId(null);
    setFormData({});
    setActionError('');
    setShowModal(type);
  };

  const startMaintenanceContact = (name: 'Adel' | 'Said') => {
    if (!isAdmin) return;
    const isAdel = name === 'Adel';
    setEditingId(null);
    setFormData({
      name,
      nameAr: isAdel ? 'عادل' : 'سعيد',
      role: 'Maintenance Follow-up',
      roleAr: 'متابعة الصيانة',
      avatar: '🛠️',
      status: 'ONLINE',
      whatsapp: ''
    });
    setShowModal('CONTACT');
  };

  const openEdit = (type: typeof showModal, item: any) => {
    if (isReadOnly || !isAdmin) return;
    setEditingId(item.id);
    setFormData({ ...item });
    setActionError('');
    setShowModal(type);
  };

  const handleDelete = async (type: string, id: string) => {
    if (isReadOnly || !isAdmin) return;
    if (!confirm(isAr ? 'حذف هذا العنصر نهائياً؟' : 'Purge this item permanently?')) return;
    setActionError('');
    const saved = type === 'CONTACT' ? await db.deleteSupportContact(id)
      : type === 'FAQ' ? await db.deleteFAQ(id)
      : type === 'PORT' ? await db.deletePortInfo(id) : false;
    if (!saved) { setActionError(db.getLastDbError() || (isAr ? 'تعذر الحذف. حاول مرة أخرى.' : 'Could not delete this item. Please try again.')); return; }
    refresh();
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !isAdmin || formSaving) return;
    setActionError('');
    setFormSaving(true);

    if (showModal === 'CONTACT') {
      const data: SupportContact = {
        id: editingId || `c-${Date.now()}`,
        name: formData.name || 'Staff',
        nameAr: formData.nameAr || 'موظف',
        role: formData.role || 'Operator',
        roleAr: formData.roleAr || 'مشغل',
        avatar: formData.avatar || '👤',
        status: formData.status || 'ONLINE',
        whatsapp: formData.whatsapp || ''
      };
      const saved = editingId ? await db.updateSupportContact(data) : await db.addSupportContact(data);
      if (!saved) { setActionError(db.getLastDbError() || (isAr ? 'تعذر حفظ جهة الاتصال.' : 'Could not save this contact.')); setFormSaving(false); return; }
    } else if (showModal === 'FAQ') {
      const data: FAQItem = {
        id: editingId || `f-${Date.now()}`,
        question: formData.question || '',
        questionAr: formData.questionAr || '',
        answer: formData.answer || '',
        answerAr: formData.answerAr || ''
      };
      const saved = editingId ? await db.updateFAQ(data) : await db.addFAQ(data);
      if (!saved) { setActionError(db.getLastDbError() || (isAr ? 'تعذر حفظ الإرشاد.' : 'Could not save this guide.')); setFormSaving(false); return; }
    } else if (showModal === 'PORT') {
      const data: PortInfo = {
        id: editingId || `p-${Date.now()}`,
        location: formData.location || Location.ALEX,
        address: formData.address || '',
        addressAr: formData.addressAr || '',
        mapsUrl: formData.mapsUrl || '',
        contactName: formData.contactName || '',
        contactPhone: formData.contactPhone || ''
      };
      const saved = editingId ? await db.updatePortInfo(data) : await db.addPortInfo(data);
      if (!saved) { setActionError(db.getLastDbError() || (isAr ? 'تعذر حفظ موقع الساحة. تأكد من تطبيق تحديث قاعدة البيانات.' : 'Could not save the yard location. Confirm the database migration has been applied.')); setFormSaving(false); return; }
    }

    refresh();
    setShowModal('NONE');
    setFormSaving(false);
  };

  const labelClass = "text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest text-start px-1";
  const inputClass = "w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold outline-none focus:border-[#C2A378] text-black dark:text-white";

  return (
    <div className={`max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-32 text-start ${isAr ? 'rtl font-cairo' : 'ltr'}`}>
      
      {/* HUB NAVIGATION */}
      <div className="bg-[#001F3F] p-8 rounded-[3rem] shadow-2xl flex flex-col lg:flex-row justify-between items-center gap-8 border border-white/10 relative overflow-hidden">
         <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
         <div className="flex items-center gap-6 relative z-10">
            <div className="w-16 h-16 bg-[#C2A378] text-[#001F3F] rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg">🎧</div>
            <div>
               <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-none">{isAr ? 'مركز المساعدة' : 'Support Hub'}</h2>
               <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.4em] mt-2">{isAr ? 'تواصل مباشر ومعلومات الساحات' : 'Direct support and yard locations'}</p>
            </div>
         </div>
         <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/10 relative z-10 overflow-hidden flex-wrap">
            <button onClick={() => setActiveTab('CONTACTS')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'CONTACTS' ? 'bg-[#C2A378] text-[#001F3F]' : 'text-slate-400 hover:text-white'}`}>{isAr ? 'الطاقم' : 'PERSONNEL'}</button>
            <button onClick={() => setActiveTab('PORTS')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'PORTS' ? 'bg-[#C2A378] text-[#001F3F]' : 'text-slate-400 hover:text-white'}`}>{isAr ? 'المواقع' : 'PORTS'}</button>
            <button onClick={() => setActiveTab('FAQ')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'FAQ' ? 'bg-[#C2A378] text-[#001F3F]' : 'text-slate-400 hover:text-white'}`}>{isAr ? 'الإرشادات' : 'GUIDELINES'}</button>
         </div>
         {isAdmin && !isReadOnly && (
           <button onClick={() => openAdd(activeTab === 'CONTACTS' ? 'CONTACT' : activeTab === 'PORTS' ? 'PORT' : 'FAQ')} className="relative z-10 bg-white/10 hover:bg-white/20 text-[#C2A378] border border-[#C2A378]/30 px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all">
             + {isAr ? 'إضافة' : 'Add New'}
           </button>
         )}
      </div>

      {actionError && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{actionError}</div>}

      <div className="grid grid-cols-1 gap-8 items-start">
        
        {activeTab === 'CONTACTS' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4">
             <div className="rounded-[2.5rem] border border-amber-200 bg-amber-50/80 p-6 dark:border-amber-900/50 dark:bg-amber-950/20 sm:p-8">
               <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                 <div>
                   <h3 className="text-lg font-black uppercase tracking-tight text-amber-900 dark:text-amber-200">🛠️ {isAr ? 'متابعة الصيانة' : 'Maintenance Follow-up'}</h3>
                   <p className="mt-1 text-xs font-semibold text-amber-800/80 dark:text-amber-200/70">{isAr ? 'تواصل سريع مع عادل وسعيد بشأن أعطال المولدات والصيانة في الساحات.' : 'Quick contact with Adel and Said for genset maintenance and yard issues.'}</p>
                 </div>
                 {isAdmin && <div className="flex flex-wrap gap-2">{!maintenanceContacts.some(contact => /\badel\b/i.test(contact.name)) && <button onClick={() => startMaintenanceContact('Adel')} className="rounded-xl bg-amber-800 px-4 py-3 text-[10px] font-black uppercase text-white hover:bg-amber-900">+ {isAr ? 'إضافة عادل' : 'Set up Adel'}</button>}{!maintenanceContacts.some(contact => /\bsaid\b/i.test(contact.name)) && <button onClick={() => startMaintenanceContact('Said')} className="rounded-xl bg-amber-800 px-4 py-3 text-[10px] font-black uppercase text-white hover:bg-amber-900">+ {isAr ? 'إضافة سعيد' : 'Set up Said'}</button>}</div>}
               </div>
               {maintenanceContacts.length > 0 ? <div className="mt-5 flex flex-wrap gap-3">{maintenanceContacts.map(contact => <div key={contact.id} className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 dark:border-amber-900 dark:bg-slate-900"><span className="text-xl">{contact.avatar || '🛠️'}</span><div><p className="text-sm font-black">{isAr ? contact.nameAr : contact.name}</p><p className="text-[10px] font-semibold text-slate-500">{contact.whatsapp || (isAr ? 'رقم واتساب غير مضاف' : 'WhatsApp number not added')}</p></div>{whatsappNumber(contact.whatsapp) && <a href={`https://wa.me/${whatsappNumber(contact.whatsapp)}`} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-emerald-600 px-4 py-2 text-[9px] font-black text-white">{isAr ? 'واتساب' : 'WhatsApp'}</a>}</div>)}</div> : <p className="mt-4 rounded-xl bg-white/70 p-3 text-xs font-bold text-amber-900 dark:bg-slate-900/60 dark:text-amber-200">{isAr ? 'أضف رقم واتساب لكلٍ من عادل وسعيد لتفعيل التواصل المباشر.' : 'Add WhatsApp numbers for Adel and Said to enable direct contact.'}</p>}
             </div>
             <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
             {contacts.map(c => (
               <div key={c.id} className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-white/5 shadow-xl group hover:scale-[1.02] transition-all relative">
                  {isAdmin && (
                    <div className="absolute top-4 right-4 flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {!isReadOnly && isAdmin && <><button aria-label={isAr ? 'تعديل جهة الاتصال' : 'Edit contact'} onClick={() => openEdit('CONTACT', c)} className="p-2 bg-blue-50 dark:bg-slate-800 text-blue-600 rounded-lg">✎</button>
                      <button aria-label={isAr ? 'حذف جهة الاتصال' : 'Delete contact'} onClick={() => handleDelete('CONTACT', c.id)} className="p-2 bg-rose-50 dark:bg-slate-800 text-rose-600 rounded-lg">✕</button></>}
                    </div>
                  )}
                  <div className="flex items-center gap-6 mb-8">
                     <div className="relative">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">{c.avatar}</div>
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 ${isDark ? 'border-slate-900' : 'border-white'} ${c.status === 'ONLINE' ? 'bg-emerald-500' : c.status === 'BUSY' ? 'bg-amber-500' : 'bg-slate-300'}`}></div>
                     </div>
                     <div>
                        <h4 className="text-xl font-black uppercase italic tracking-tighter text-[#001F3F] dark:text-white">{isAr ? c.nameAr : c.name}</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isAr ? c.roleAr : c.role}</p>
                        {maintenanceContacts.some(contact => contact.id === c.id) && <span className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-[8px] font-black uppercase tracking-wider text-amber-700">{isAr ? 'متابعة الصيانة' : 'Maintenance Follow-up'}</span>}
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                     {whatsappNumber(c.whatsapp) ? <a href={`https://wa.me/${whatsappNumber(c.whatsapp)}`} target="_blank" rel="noopener noreferrer" className="bg-emerald-500 text-white py-4 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-emerald-600 transition-all shadow-lg">
                        <span className="text-xl">💬</span>
                        <span className="text-[8px] font-black uppercase">{isAr ? 'واتساب' : 'WhatsApp'}</span>
                     </a> : <div className="bg-slate-100 dark:bg-slate-800 text-slate-400 py-4 rounded-2xl flex flex-col items-center justify-center gap-1 text-center"><span className="text-xl">💬</span><span className="text-[8px] font-black">{isAr ? 'أضف رقم واتساب' : 'Add WhatsApp number'}</span></div>}
                     {c.whatsapp && <a href={`tel:${c.whatsapp}`} className="bg-blue-600 text-white py-4 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-blue-700 transition-all shadow-lg">
                        <span className="text-xl">📞</span>
                        <span className="text-[8px] font-black uppercase">{isAr ? 'اتصال هاتفي' : 'Call'}</span>
                     </a>}
                  </div>
               </div>
             ))}
             </div>
          </div>
        )}

        {activeTab === 'PORTS' && (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4">
              {ports.map(p => (
                <div key={p.id} className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-white/5 shadow-xl group hover:shadow-2xl transition-all relative">
                   {isAdmin && (
                    <div className="absolute top-6 right-6 flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {!isReadOnly && isAdmin && <><button aria-label={isAr ? 'تعديل بيانات الموقع' : 'Edit yard'} onClick={() => openEdit('PORT', p)} className="p-2 bg-blue-50 dark:bg-slate-800 text-blue-600 rounded-lg">✎</button>
                      <button aria-label={isAr ? 'حذف بيانات الموقع' : 'Delete yard'} onClick={() => handleDelete('PORT', p.id)} className="p-2 bg-rose-50 dark:bg-slate-800 text-rose-600 rounded-lg">✕</button></>}
                    </div>
                  )}
                   <div className="flex justify-between items-start mb-8">
                      <div className="bg-slate-900 text-[#C2A378] px-4 py-1.5 rounded-xl font-black uppercase text-[10px] tracking-widest">
                         {translateEntity(p.location, lang)} {isAr ? 'ساحة' : 'YARD'}
                      </div>
                   </div>
                   <div className="space-y-6">
                      <div className="flex gap-4">
                         <span className="text-2xl">📍</span>
                         <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{isAr ? 'عنوان الساحة' : 'Yard Address'}</p>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{isAr ? (p.addressAr || p.address || translateEntity(p.location, lang)) : (p.address || translateEntity(p.location, lang))}</p>
                         </div>
                      </div>
                      <div className="flex gap-4">
                         <span className="text-2xl">👤</span>
                         <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{isAr ? 'مسؤول الموقع' : 'Yard Contact'}</p>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{p.contactName || '—'}</p>
                            {p.contactPhone && <p className="text-blue-600 font-black tracking-widest text-xs mt-1">{p.contactPhone}</p>}
                         </div>
                      </div>
                      <div className="flex flex-wrap gap-3 pt-2">
                        <a href={googleMapsUrl(p)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-[10px] font-black uppercase tracking-wider text-white shadow-lg hover:bg-blue-700">📍 {isAr ? 'افتح الموقع في خرائط Google' : 'Open in Google Maps'}</a>
                        {whatsappNumber(p.contactPhone) && <a href={`https://wa.me/${whatsappNumber(p.contactPhone)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-[10px] font-black uppercase tracking-wider text-white shadow-lg hover:bg-emerald-700">💬 {isAr ? 'تواصل مع مسؤول الساحة' : 'WhatsApp yard contact'}</a>}
                      </div>
                   </div>
                </div>
              ))}
              {ports.length === 0 && <div className="col-span-2 py-20 text-center opacity-50 italic font-black uppercase">{isAr ? 'لا توجد مواقع ساحات مسجلة. أضف موقعاً ثم ألصق رابط خرائط Google.' : 'No yard locations yet. Add a yard and paste its Google Maps link.'}</div>}
           </div>
        )}

        {activeTab === 'FAQ' && (
          <div className="animate-in slide-in-from-bottom-4 space-y-4">
             {faqs.map((f) => (
               <div key={f.id} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 group relative">
                  {isAdmin && (
                    <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!isReadOnly && isAdmin && <><button onClick={() => openEdit('FAQ', f)} className="p-2 bg-blue-50 dark:bg-slate-800 text-blue-600 rounded-lg">✎</button>
                      <button onClick={() => handleDelete('FAQ', f.id)} className="p-2 bg-rose-50 dark:bg-slate-800 text-rose-600 rounded-lg">✕</button></>}
                    </div>
                  )}
                  <h4 className="font-black text-blue-600 uppercase text-sm mb-2">{isAr ? 'س:' : 'Q:'} {isAr ? (f.questionAr || f.question) : f.question}</h4>
                  <p className="text-slate-500 dark:text-slate-400 font-bold text-xs">{isAr ? 'ج:' : 'A:'} {isAr ? (f.answerAr || f.answer) : f.answer}</p>
               </div>
             ))}
          </div>
        )}
      </div>

      {/* MODAL FOR ADD/EDIT */}
      {showModal !== 'NONE' && (
        <div className="fixed inset-0 bg-[#001F3F]/95 backdrop-blur-xl z-[600] flex items-center justify-center p-6">
           <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-2xl max-w-2xl w-full overflow-hidden border-[10px] border-[#001F3F] animate-in zoom-in-95">
              <div className="p-8 bg-[#001F3F] text-white flex justify-between items-center text-start">
                 <h3 className="text-xl font-black uppercase italic tracking-widest">{editingId ? (isAr ? 'تعديل البيانات' : 'Edit Item') : (isAr ? 'إضافة بيانات' : 'Create Entry')}</h3>
                 <button onClick={() => setShowModal('NONE')} className="text-white hover:text-rose-500 font-bold text-2xl transition-colors">✕</button>
              </div>
              <form onSubmit={handleFormSubmit} className="p-10 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar text-start text-black dark:text-white">
                 
                 {showModal === 'CONTACT' && (
                   <>
                     <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>{isAr ? 'الاسم (إنجليزي)' : 'Name (EN)'}</label><input className={inputClass} required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                        <div><label className={labelClass}>{isAr ? 'الاسم (عربي)' : 'Name (AR)'}</label><input className={inputClass} required value={formData.nameAr || ''} onChange={e => setFormData({...formData, nameAr: e.target.value})} /></div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>{isAr ? 'المسمى الوظيفي (إنجليزي)' : 'Role (EN)'}</label><input className={inputClass} required value={formData.role || ''} onChange={e => setFormData({...formData, role: e.target.value})} /></div>
                        <div><label className={labelClass}>{isAr ? 'المسمى الوظيفي (عربي)' : 'Role (AR)'}</label><input className={inputClass} required value={formData.roleAr || ''} onChange={e => setFormData({...formData, roleAr: e.target.value})} /></div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>{isAr ? 'الحالة' : 'Status'}</label>
                          <select className={inputClass} value={formData.status || 'ONLINE'} onChange={e => setFormData({...formData, status: e.target.value})}>
                            <option value="ONLINE">{isAr ? 'متاح' : 'ONLINE'}</option>
                            <option value="BUSY">{isAr ? 'مشغول' : 'BUSY'}</option>
                            <option value="OFFLINE">{isAr ? 'غير متصل' : 'OFFLINE'}</option>
                          </select>
                        </div>
                        <div><label className={labelClass}>{isAr ? 'رقم واتساب مع مفتاح الدولة' : 'WhatsApp number with country code'}</label><input type="tel" className={inputClass} placeholder="+20 10..." value={formData.whatsapp || ''} onChange={e => setFormData({...formData, whatsapp: e.target.value})} /></div>
                     </div>
                     <div><label className={labelClass}>{isAr ? 'الصورة التعبيرية' : 'Emoji Avatar'}</label><input className={inputClass} value={formData.avatar || '👤'} onChange={e => setFormData({...formData, avatar: e.target.value})} /></div>
                   </>
                 )}

                 {showModal === 'FAQ' && (
                   <>
                     <div><label className={labelClass}>{isAr ? 'السؤال (إنجليزي)' : 'Question (EN)'}</label><input className={inputClass} required value={formData.question || ''} onChange={e => setFormData({...formData, question: e.target.value})} /></div>
                     <div><label className={labelClass}>{isAr ? 'السؤال (عربي)' : 'Question (AR)'}</label><input className={inputClass} required value={formData.questionAr || ''} onChange={e => setFormData({...formData, questionAr: e.target.value})} /></div>
                     <div><label className={labelClass}>{isAr ? 'الإجابة (إنجليزي)' : 'Answer (EN)'}</label><textarea className={`${inputClass} h-24`} required value={formData.answer || ''} onChange={e => setFormData({...formData, answer: e.target.value})} /></div>
                     <div><label className={labelClass}>{isAr ? 'الإجابة (عربي)' : 'Answer (AR)'}</label><textarea className={`${inputClass} h-24`} required value={formData.answerAr || ''} onChange={e => setFormData({...formData, answerAr: e.target.value})} /></div>
                   </>
                 )}

                 {showModal === 'PORT' && (
                   <>
                     <div>
                        <label className={labelClass}>{isAr ? 'الميناء أو الساحة' : 'Port / Yard'}</label>
                        <select className={inputClass} value={formData.location || Location.ALEX} onChange={e => setFormData({...formData, location: e.target.value as any})}>
                           {Object.values(Location).map(l => <option key={l} value={l}>{translateEntity(l, lang)}</option>)}
                        </select>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>{isAr ? 'العنوان (إنجليزي)' : 'Address (EN)'}</label><input className={inputClass} value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
                        <div><label className={labelClass}>{isAr ? 'العنوان (عربي)' : 'Address (AR)'}</label><input className={inputClass} value={formData.addressAr || ''} onChange={e => setFormData({...formData, addressAr: e.target.value})} /></div>
                     </div>
                     <div><label className={labelClass}>{isAr ? 'رابط موقع Google Maps' : 'Google Maps pin / directions link'}</label><input type="url" className={inputClass} placeholder="https://maps.app.goo.gl/..." value={formData.mapsUrl || ''} onChange={e => setFormData({...formData, mapsUrl: e.target.value})} /><p className="mt-2 px-1 text-[10px] font-semibold text-slate-400">{isAr ? 'الصق رابط المشاركة من خرائط Google. إذا تركته فارغاً سنفتح بحثاً عن عنوان الساحة.' : 'Paste the Google Maps share link. If left blank, the yard address opens as a Maps search.'}</p></div>
                     <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>{isAr ? 'اسم مسؤول الموقع' : 'Yard Contact Name'}</label><input className={inputClass} value={formData.contactName || ''} onChange={e => setFormData({...formData, contactName: e.target.value})} /></div>
                        <div><label className={labelClass}>{isAr ? 'رقم الهاتف / واتساب' : 'Phone / WhatsApp Number'}</label><input type="tel" className={inputClass} value={formData.contactPhone || ''} onChange={e => setFormData({...formData, contactPhone: e.target.value})} /></div>
                     </div>
                   </>
                 )}

                 {actionError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{actionError}</p>}
                 <button type="submit" disabled={formSaving} className="w-full bg-[#001F3F] text-white py-6 rounded-[2.5rem] font-black uppercase text-xs tracking-[0.4em] shadow-2xl active:scale-95 transition-all disabled:cursor-wait disabled:opacity-60">
                    {formSaving ? (isAr ? 'جارٍ الحفظ...' : 'SAVING...') : (isAr ? 'اعتماد التغييرات' : 'AUTHORIZE PROTOCOL UPDATE')}
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default CustomerService;
