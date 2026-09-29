
import React, { useContext, useState, useMemo, useEffect } from 'react';
import { LanguageContext, ThemeContext } from '../App';
import { translateEntity } from '../translations';
import { UserRole, User, SystemNotification, hasReadOnlyAccess } from '../types';
import { db } from '../services/supabaseDb';

const Notifications: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const { theme, isMuted, setIsMuted } = useContext(ThemeContext);
  const isDark = theme === 'black' || theme === 'midnight';
  const isAr = lang === 'ar';
  
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}') as User, []);
  const isReadOnly = hasReadOnlyAccess(currentUser);
  const isAdmin = currentUser.role === UserRole.ADMIN && !isReadOnly;

  const [activeTab, setActiveTab] = useState<'INBOX' | 'COMMAND'>('INBOX');
  const [notifications, setNotifications] = useState<SystemNotification[]>(db.getNotifications(currentUser));
  
  // COMMAND HUB STATE
  const [targetType, setTargetType] = useState<'GLOBAL' | 'USER' | 'ORG'>('GLOBAL');
  const [targetValue, setTargetValue] = useState('ALL');
  const [forceMsgEn, setForceMsgEn] = useState('');
  const [forceMsgAr, setForceMsgAr] = useState('');
  const [forceType, setForceType] = useState<SystemNotification['type']>('WARNING');
  const [isBanner, setIsBanner] = useState(true);

  const refreshNotifs = () => setNotifications([...db.getNotifications(currentUser)]);

  useEffect(() => {
    refreshNotifs();
    const handleDbChange = () => refreshNotifs();
    window.addEventListener('db-undo-success', handleDbChange);
    window.addEventListener('db-change', handleDbChange);
    return () => {
      window.removeEventListener('db-undo-success', handleDbChange);
      window.removeEventListener('db-change', handleDbChange);
    };
  }, [currentUser.id]);

  const handleBroadcast = async () => {
    if (isReadOnly || !isAdmin) return;
    if (!forceMsgEn.trim() || !forceMsgAr.trim()) {
        alert(isAr ? 'يرجى إدخال الرسالة باللغتين' : 'Please enter message in both languages');
        return;
    }
    const saved = await db.addNotification({
      type: forceType,
      message: forceMsgEn.trim(),
      messageAr: forceMsgAr.trim(),
      forceBanner: isBanner,
      targetUserId: targetType === 'USER' ? targetValue : undefined,
      targetOrgName: targetType === 'ORG' ? targetValue : undefined
    });
    if (!saved) {
      alert(isAr ? `تعذر إرسال التنبيه: ${db.getLastDbError() || 'خطأ في قاعدة البيانات'}` : `Notification failed: ${db.getLastDbError() || 'database error'}`);
      return;
    }
    setForceMsgEn('');
    setForceMsgAr('');
    alert(isAr ? 'تم إرسال التنبيه بنجاح' : 'NOTIFICATION SENT SUCCESSFULLY');
    refreshNotifs();
  };

  const handleClearHistory = async () => {
    if (isReadOnly) return;
    if (confirm(isAr ? 'هل أنت متأكد من كتم جميع التنبيهات النشطة؟' : 'Dismiss all active notifications?')) {
      const saved = await db.clearAllNotifications();
      if (!saved) {
        alert(isAr ? `تعذر تحديث التنبيهات: ${db.getLastDbError() || 'خطأ في قاعدة البيانات'}` : `Could not update notifications: ${db.getLastDbError() || 'database error'}`);
        return;
      }
      refreshNotifs();
    }
  };

  const allUsers = db.getUsers();
  const organizations = Array.from(new Set(allUsers.map(u => u.companyName || u.name)));

  const labelClass = "text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest text-start px-1";
  const inputClass = "w-full p-4 bg-[var(--input-bg)] border-2 border-[var(--border-primary)] rounded-2xl text-sm font-bold outline-none focus:border-[var(--accent)] text-[var(--text-primary)] transition-all";

  return (
    <div className={`max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-32 text-start ${isAr ? 'rtl font-cairo' : 'ltr'}`}>
      
      {/* HUB NAVIGATION */}
      <div className="bg-[#001F3F] p-8 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8 border border-white/10 relative overflow-hidden">
         <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
         <div className="flex items-center gap-6 relative z-10">
            <div className="w-16 h-16 bg-[#C2A378] text-[#001F3F] rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg">🔔</div>
            <div>
               <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-none">{isAr ? 'مركز التنبيهات' : 'Notification Hub'}</h2>
               <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.4em] mt-2">Unified Communications Matrix</p>
            </div>
         </div>
         <div className="flex flex-wrap items-center gap-4 relative z-10">
            <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/10 overflow-hidden">
               <button onClick={() => setActiveTab('INBOX')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'INBOX' ? 'bg-[#C2A378] text-[#001F3F]' : 'text-slate-400 hover:text-white'}`}>{isAr ? 'صندوق الوارد' : 'INBOX'}</button>
               {isAdmin && <button onClick={() => setActiveTab('COMMAND')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'COMMAND' ? 'bg-rose-600 text-white' : 'text-rose-400 hover:text-rose-200'}`}>{isAr ? 'غرفة العمليات' : 'COMMAND HUB'}</button>}
            </div>
            
            <button 
              onClick={() => setIsMuted(!isMuted)} 
              className={`flex items-center gap-3 px-6 py-3 rounded-2xl border-2 transition-all font-black uppercase text-[10px] ${isMuted ? 'bg-rose-600 border-rose-500 text-white' : 'bg-white/10 border-white/20 text-[#C2A378]'}`}
            >
              <span>{isMuted ? '🔇' : '🔊'}</span>
              {isMuted ? (isAr ? 'التنبيهات مكتومة' : 'NOTIFICATIONS MUTED') : (isAr ? 'كتم التنبيهات' : 'MUTE NOTIFICATIONS')}
            </button>
         </div>
      </div>

      {activeTab === 'INBOX' ? (
        <div className="animate-in slide-in-from-bottom-4 space-y-6">
           <div className="flex justify-between items-center px-4">
              <h3 className="text-xl font-black uppercase italic tracking-tighter text-[#001F3F] dark:text-white">{isAr ? 'أحدث التنبيهات' : 'Inbox Activity'}</h3>
              {isAdmin && (
                <button onClick={handleClearHistory} className="text-[10px] font-black uppercase text-rose-500 hover:text-rose-700 underline decoration-dotted transition-colors">
                  {isAr ? 'مسح الأرشيف' : 'Wipe Archive'}
                </button>
              )}
           </div>

           <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-white/5 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-start border-collapse">
                   <thead className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                      <tr>
                        <th className="p-6 w-40">{isAr ? 'التاريخ' : 'Time'}</th>
                        <th className="p-6 w-32">{isAr ? 'النوع' : 'Class'}</th>
                        <th className="p-6">{isAr ? 'الرسالة' : 'Payload'}</th>
                        <th className="p-6 w-32 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px] font-bold">
                      {notifications.map(n => (
                        <tr key={n.id} className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${!n.active ? 'opacity-50' : ''}`}>
                           <td className="p-6 text-slate-400 font-mono text-[10px]">{new Date(n.timestamp).toLocaleString()}</td>
                           <td className="p-6">
                              <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase border ${
                                n.type === 'CRITICAL' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                n.type === 'WARNING' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                n.type === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                'bg-blue-50 text-blue-600 border-blue-100'
                              }`}>{n.type}</span>
                           </td>
                           <td className="p-6">
                              <p className="text-slate-800 dark:text-slate-200">{isAr ? n.messageAr : n.message}</p>
                              {n.targetUserId && (
                                <p className="text-[8px] font-black text-blue-500 uppercase mt-1 tracking-widest">PRIVATE: {n.targetUserId}</p>
                              )}
                              {n.targetOrgName && (
                                <p className="text-[8px] font-black text-[#C2A378] uppercase mt-1 tracking-widest">ORGANIZATION: {n.targetOrgName}</p>
                              )}
                           </td>
                           <td className="p-6 text-center">
                              {n.active ? (
                                !isReadOnly ? <button onClick={async () => {
                                const saved = await db.dismissNotification(n.id);
                                if (!saved) alert(isAr ? 'تعذر تحديث حالة التنبيه.' : 'Could not update notification status.');
                              }} className="text-blue-500 hover:text-blue-700 font-black uppercase text-[9px] underline decoration-dotted">Dismiss</button> : <span className="text-slate-300 uppercase italic">Active</span>
                              ) : (
                                <span className="text-slate-300 uppercase italic">Seen</span>
                              )}
                           </td>
                        </tr>
                      ))}
                      {notifications.length === 0 && (
                        <tr>
                           <td colSpan={4} className="py-32 text-center opacity-20 font-black uppercase italic tracking-[0.5em]">No activity in inbox</td>
                        </tr>
                      )}
                   </tbody>
                </table>
              </div>
           </div>
        </div>
      ) : (
        <div className="animate-in slide-in-from-bottom-4">
           <div className="bg-white dark:bg-slate-900 p-12 rounded-[4rem] border border-slate-100 dark:border-white/5 shadow-2xl">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 text-start">
                 <div className="space-y-8">
                    <div>
                       <h3 className="text-3xl font-black italic uppercase tracking-tighter text-[#001F3F] dark:text-white">Command Broadcast</h3>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em] mt-2">Targeted Signal Injection</p>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                       <div>
                          <label className={labelClass}>Target Selection</label>
                          <select className={inputClass} value={targetType} onChange={e => { setTargetType(e.target.value as any); setTargetValue('ALL'); }}>
                             <option value="GLOBAL">ALL TERMINALS</option>
                             <option value="USER">SPECIFIC IDENTITY</option>
                             <option value="ORG">ORGANIZATION HUB</option>
                          </select>
                       </div>
                       <div>
                          <label className={labelClass}>Recipient</label>
                          <select className={inputClass} value={targetValue} onChange={e => setTargetValue(e.target.value)}>
                             {targetType === 'GLOBAL' && <option value="ALL">BROADCAST TO ALL</option>}
                             {targetType === 'USER' && allUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                             {targetType === 'ORG' && organizations.map(org => <option key={org} value={org}>{org}</option>)}
                          </select>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                       <div>
                          <label className={labelClass}>Alert Class</label>
                          <select className={inputClass} value={forceType} onChange={e => setForceType(e.target.value as any)}>
                             <option value="WARNING">WARNING (YELLOW)</option>
                             <option value="CRITICAL">CRITICAL (RED)</option>
                             <option value="INFO">INFORMATION (BLUE)</option>
                             <option value="SUCCESS">SUCCESS (GREEN)</option>
                          </select>
                       </div>
                       <div className="flex items-center gap-6 p-4 border-2 border-slate-100 dark:border-slate-800 rounded-2xl mt-6">
                          <input type="checkbox" checked={isBanner} onChange={e => setIsBanner(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-rose-600 focus:ring-rose-500" />
                          <label className="text-[10px] font-black uppercase text-slate-500">Enable Header Banner</label>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <div>
                       <label className={labelClass}>Payload Message (EN)</label>
                       <textarea className={`${inputClass} h-32 pt-4`} value={forceMsgEn} onChange={e => setForceMsgEn(e.target.value)} placeholder="System maintenance scheduled for..." />
                    </div>
                    <div>
                       <label className={labelClass}>Payload Message (AR)</label>
                       <textarea className={`${inputClass} h-32 pt-4`} value={forceMsgAr} onChange={e => setForceMsgAr(e.target.value)} placeholder="من المقرر صيانة النظام..." />
                    </div>
                    <button onClick={handleBroadcast} className="w-full bg-rose-600 hover:bg-rose-700 text-white py-8 rounded-[2.5rem] font-black uppercase text-sm tracking-[0.4em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4">
                       <span className="text-2xl">☢️</span> AUTHORIZE PUSH
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default Notifications;
