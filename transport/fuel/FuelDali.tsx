import React, { useEffect, useRef, useState } from 'react';
import type { Lang } from '../i18n';
import type { TransportUser } from '../types';
import * as dali from './dali';

const DALI_MARK = '/dali/dali-mark.png';

// Staff talk to DALI in Arabic, so the chat stays Arabic whatever the app language (same as the Customer Rates DALI).
const TX = {
  title: 'دالي', sub: 'مساعد السولار',
  placeholder: 'اسأل عن السولار: عربية، سواق، أسبوع، تنبيه…', send: 'إرسال', newChat: 'محادثة جديدة',
  hello: (n: string) => `أهلاً ${n}. أنا دالي بتاع قسم السولار. أعرف كل تفويلات الكارت، كم/لتر لكل عربية وسواق، التنبيهات، حالة العربيات والأسابيع. اسألني مثلاً أنهي عربية محتاجة صيانة، أو استهلاك عربية معينة الأسبوع ده.`,
  thinking: 'دالي بيفكر…', failed: 'حصلت مشكلة', loading: 'بحمّل بيانات السولار…',
  tries: ['أنهي عربيات محتاجة فحص صيانة؟', 'استهلاك الأسطول الأسبوع ده مقارنة بالأسبوع اللي فات؟', 'إيه أهم التنبيهات المفتوحة؟', 'مين أكتر سواق استهلك سولار؟'],
};

type Msg = { id: number; role: 'user' | 'assistant'; content: string; error?: boolean };

const FuelDali: React.FC<{ lang: Lang; user: TransportUser }> = ({ lang, user }) => {
  void lang;
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [earlier, setEarlier] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const data = useRef<dali.FuelData | null>(null);
  const session = useRef(dali.sessionId());
  const seq = useRef(0);
  const loaded = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    dali.loadMemory(session.current).then(m => {
      setEarlier(m.earlier);
      setMsgs(prev => [...m.turns.map(tn => ({ id: ++seq.current, role: tn.role, content: tn.content })), ...prev]);
    });
  }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy, open]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  // Fresh numbers: reload the fuel data when it is older than a minute (someone may have uploaded a new report).
  const fuelData = async () => {
    if (!data.current || Date.now() - data.current.loadedAt > 60_000) data.current = await dali.loadFuelData();
    return data.current;
  };

  const push = (m: Omit<Msg, 'id'>) => setMsgs(list => [...list, { ...m, id: ++seq.current }]);
  const send = async (raw?: string) => {
    const q = (raw ?? input).trim();
    if (!q || busy) return;
    setInput('');
    const history: dali.ChatTurn[] = msgs.filter(m => m.content && !m.error).map(m => ({ role: m.role, content: m.content })).slice(-20);
    push({ role: 'user', content: q });
    dali.remember(session.current, 'user', q);
    setBusy(true);
    try {
      const d = await fuelData();
      const text = await dali.askFuel(d, user, q, history, earlier);
      push({ role: 'assistant', content: text });
      dali.remember(session.current, 'assistant', text);
    } catch (e: any) {
      push({ role: 'assistant', content: `${TX.failed}: ${e.message || e}`, error: true });
    } finally { setBusy(false); }
  };
  const newChat = () => { session.current = dali.sessionId(true); setMsgs([]); };

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label={`${TX.title} · ${TX.sub}`}
          className="fixed bottom-[var(--nf-fab-bottom,1.25rem)] right-4 z-40 flex items-center gap-2 rounded-full bg-[#07111f] p-2 text-white shadow-[0_10px_30px_rgba(7,17,31,.35)] ring-1 ring-[#c2a378]/50 transition hover:-translate-y-0.5 sm:right-5 sm:pe-4">
          <span className="relative grid h-9 w-9 place-items-center rounded-full bg-[#c2a378]/15">
            <img src={DALI_MARK} alt="" className="h-6 w-6 object-contain" />
            <span className="absolute -bottom-0.5 -end-0.5 text-[11px]">⛽</span>
          </span>
          <span className="hidden text-start leading-none sm:inline"><span className="block text-sm font-black tracking-wider">DALI</span><span className="text-[10px] font-bold text-[#c2a378]">{TX.sub}</span></span>
        </button>
      )}
      {open && (
        <div role="dialog" dir="rtl" lang="ar" aria-label={`${TX.title} · ${TX.sub}`} className="fixed inset-x-2 bottom-2 top-16 z-50 flex flex-col overflow-hidden rounded-2xl border border-[#c2a378]/40 bg-[#f8f4ec] shadow-[0_20px_60px_rgba(7,17,31,.35)] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:top-auto sm:h-[640px] sm:max-h-[calc(100vh-110px)] sm:w-[440px]">
          <div className="flex items-center gap-3 bg-[#07111f] px-4 py-3 text-white">
            <img src={DALI_MARK} alt="" className="h-8 w-8 object-contain" />
            <div className="me-auto leading-tight"><div className="font-black tracking-wider">{TX.title} ⛽</div><div className="text-[10px] font-bold text-[#c2a378]">{TX.sub}</div></div>
            <button onClick={newChat} style={{ minHeight: 0 }} className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-black text-white/80 hover:border-[#c2a378]">{TX.newChat}</button>
            <button onClick={() => setOpen(false)} style={{ minHeight: 0 }} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-lg text-white/70 hover:bg-white/10">×</button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
            <div className="max-w-[88%] rounded-2xl rounded-ss-sm bg-white px-3.5 py-2.5 text-[13px] leading-6 shadow-sm">{TX.hello(user.name.split(' ')[0] || user.name)}</div>
            {!msgs.length && (
              <div className="flex flex-wrap gap-2">
                {TX.tries.map(s => <button key={s} onClick={() => send(s)} style={{ minHeight: 0 }} className="rounded-full border border-[#c2a378]/60 bg-white px-3 py-1.5 text-[11px] font-bold text-[#6f5a3a] hover:bg-[#fbf3e4]">{s}</button>)}
              </div>
            )}
            {msgs.map(m => m.role === 'user' ? (
              <div key={m.id} className="ms-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-se-sm bg-[#07111f] px-3.5 py-2.5 text-[13px] leading-6 text-white">{m.content}</div>
            ) : (
              <div key={m.id} className={`max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-ss-sm px-3.5 py-2.5 text-[13px] leading-6 shadow-sm ${m.error ? 'bg-red-50 text-red-800' : 'bg-white'}`}>{m.content}</div>
            ))}
            {busy && <div className="flex items-center gap-2 px-1 text-[11px] font-bold text-slate-500"><img src={DALI_MARK} alt="" className="h-4 w-4 animate-spin object-contain" style={{ animationDuration: '.6s' }} />{data.current ? TX.thinking : TX.loading}</div>}
            <div ref={endRef} />
          </div>

          <form onSubmit={e => { e.preventDefault(); send(); }} className="flex items-end gap-2 border-t border-[#e3dccf] bg-white p-2.5">
            <textarea ref={inputRef} rows={1} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={TX.placeholder} style={{ minHeight: 0 }}
              className="max-h-32 flex-1 resize-none rounded-xl border border-[#d9d0c0] px-3 py-2 text-[13px] outline-none focus:border-[#c2a378]" />
            <button type="submit" disabled={!input.trim() || busy} style={{ minHeight: 0 }} className="rounded-xl bg-[#c2a378] px-4 py-2 text-xs font-black text-[#07111f] disabled:opacity-40">{TX.send}</button>
          </form>
        </div>
      )}
    </>
  );
};

export default FuelDali;
