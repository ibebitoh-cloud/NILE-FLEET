
import React, { useState, useContext, useEffect } from 'react';
import { db } from '../services/supabaseDb';
import { LanguageContext } from '../App';
import { translations } from '../translations';
import { AuditEntry, User, hasReadOnlyAccess } from '../types';

const HistoryLog: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const t = translations[lang];
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}') as User;
  const isReadOnly = hasReadOnlyAccess(currentUser);
  const [logs, setLogs] = useState<AuditEntry[]>(db.getAuditLogs());

  const refresh = () => setLogs([...db.getAuditLogs()]);

  const handleFinalize = async () => {
    if (isReadOnly) return;
    if (confirm(lang === 'ar' ? 'هل تريد حذف سجل النشاط نهائياً؟ لن يتم حذف بيانات التشغيل.' : 'Permanently clear the activity log? Operational records will not be deleted.')) {
      const cleared = await db.restartHistory();
      if (cleared) refresh();
      else alert(lang === 'ar' ? `تعذر حذف سجل النشاط. ${db.getLastDbError()}` : `Could not clear activity log. ${db.getLastDbError()}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-start pb-20">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
           <h3 className="text-2xl font-black text-[#001F3F] uppercase tracking-tight">System Action Recorder</h3>
           <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{lang === 'ar' ? 'راجع سجل النشاط. التراجع عن التغييرات غير متاح.' : 'Review activity. Undo is unavailable.'}</p>
        </div>
        <div className="flex gap-4">
          <button 
            type="button"
            disabled
            title={lang === 'ar' ? 'التراجع غير متاح للسجلات المحفوظة في قاعدة البيانات.' : 'Undo is unavailable for database-backed records.'}
            className="bg-slate-100 text-slate-400 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
            {t.undo}
          </button>
          {!isReadOnly && <button
            onClick={handleFinalize}
            className="bg-[#001F3F] text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-[#002b57] transition-all shadow-xl shadow-blue-900/20"
          >
            {t.finalize}
          </button>}
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b">
            <tr>
              <th className="px-8 py-5">Time</th>
              <th className="px-8 py-5">User</th>
              <th className="px-8 py-5">Action Type</th>
              <th className="px-8 py-5">Operational Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-[11px]">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-8 py-4 font-mono text-blue-600 font-bold">{log.timestamp}</td>
                <td className="px-8 py-4 font-black text-slate-700 uppercase italic">{log.user}</td>
                <td className="px-8 py-4">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                    log.action === 'REVERT' ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                    log.action.includes('INIT') ? 'bg-blue-50 text-blue-600 border-blue-100' :
                    'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-8 py-4 text-slate-500 font-medium">
                  {log.details}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-8 py-20 text-center text-slate-400 italic font-black uppercase tracking-widest opacity-20">
                  History Log is Empty
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-8 bg-blue-50/50 border-2 border-dashed border-blue-100 rounded-[2.5rem] flex items-center gap-6">
         <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-xl">💡</div>
         <div>
            <h4 className="text-sm font-black text-blue-900 uppercase">Operational Tip</h4>
            <p className="text-xs text-blue-700 font-medium mt-1 leading-relaxed">The history system records the last 50 state changes. Once you verify your "Master View" or "Expense Hub" for the shift, use the <span className="font-black">Finalize</span> button to archive the record and start fresh. This ensures the database remains fast and accurate.</p>
         </div>
      </div>
    </div>
  );
};

export default HistoryLog;
