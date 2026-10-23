import React, { useEffect, useRef, useState } from 'react';

/**
 * DALI chat popup on the public homepage. Visitors get a few free messages,
 * then DALI asks them to log in to keep chatting. The count is kept in the
 * browser, and /dali-public enforces the same limit per visitor on the server.
 */
const FREE_MESSAGES = 5;
const USED_KEY = 'dali_public_used';
const CHAT_KEY = 'dali_public_chat';

type Msg = { role: 'user' | 'assistant'; content: string };

const readNumber = (key: string) => { try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; } };
const readChat = (): Msg[] => { try { return JSON.parse(sessionStorage.getItem(CHAT_KEY) || '[]'); } catch { return []; } };

interface Props { ar: boolean; isDark: boolean; onLogin: () => void; }

const DaliPublicChat: React.FC<Props> = ({ ar, isDark, onLogin }) => {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(readChat);
  const [used, setUsed] = useState(() => Math.min(readNumber(USED_KEY), FREE_MESSAGES));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const left = FREE_MESSAGES - used;
  const locked = left <= 0;

  useEffect(() => { try { sessionStorage.setItem(CHAT_KEY, JSON.stringify(msgs.slice(-20))); } catch { /* storage blocked */ } }, [msgs]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [msgs, busy, open, locked]);
  useEffect(() => { if (open && !locked) inputRef.current?.focus(); }, [open, locked]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const markUsed = (n: number) => {
    setUsed(n);
    try { localStorage.setItem(USED_KEY, String(n)); } catch { /* storage blocked */ }
  };

  const send = async (e?: React.FormEvent, preset?: string) => {
    e?.preventDefault();
    const text = (preset ?? input).trim().slice(0, 600);
    if (!text || busy || locked) return;
    const next: Msg[] = [...msgs, { role: 'user', content: text }];
    setMsgs(next);
    setInput('');
    setError('');
    setBusy(true);
    markUsed(used + 1);
    try {
      const res = await fetch('/dali-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.slice(-10) }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 429 || data?.limit) { markUsed(FREE_MESSAGES); return; }
      if (!res.ok || !data?.text) throw new Error(data?.error || 'failed');
      setMsgs([...next, { role: 'assistant', content: data.text }]);
    } catch {
      setError(ar ? 'تعذر الوصول إلى دالي الآن. حاول مرة أخرى.' : "DALI couldn't answer right now. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const t = ar ? {
    title: 'دالي', sub: 'مساعد أسطول النيل الذكي', hello: 'أهلاً! أنا دالي، مساعد أسطول النيل. اسألني عن خدماتنا أو الموانئ أو النقل بين مصر والإمارات.',
    ph: 'اكتب سؤالك…', send: 'إرسال', left: (n: number) => `${n} من ${FREE_MESSAGES} رسائل مجانية متبقية`,
    lockT: 'انتهت الرسائل المجانية', lockB: 'سجّل الدخول لتكمل المحادثة مع دالي.', login: 'تسجيل الدخول', open: 'اسأل دالي', close: 'إغلاق',
    chips: ['ما هي خدماتكم؟', 'هل تنقلون من مصر إلى الإمارات؟', 'ماذا يستطيع دالي أن يفعل؟'],
  } : {
    title: 'DALI', sub: 'Nile Fleet AI assistant', hello: "Hi! I'm DALI, Nile Fleet's assistant. Ask me about our services, ports, or trucking between Egypt and the UAE.",
    ph: 'Ask DALI…', send: 'Send', left: (n: number) => `${n} of ${FREE_MESSAGES} free messages left`,
    lockT: "You've used your free messages", lockB: 'Log in to keep chatting with DALI.', login: 'Log in', open: 'Ask DALI', close: 'Close',
    chips: ['What services do you offer?', 'Do you truck from Egypt to the UAE?', 'What can DALI do?'],
  };

  const panel = isDark ? 'border-white/10 bg-[#070b12]/95 text-white' : 'border-[#0b2a4a]/10 bg-white/95 text-[#0b2a4a]';
  const muted = isDark ? 'text-white/55' : 'text-[#0b2a4a]/55';
  const bubbleBot = isDark ? 'bg-white/[.06] text-white/90' : 'bg-[#0b2a4a]/[.05] text-[#0b2a4a]';
  const field = isDark ? 'border-white/10 bg-white/[.04] text-white placeholder:text-white/35' : 'border-[#0b2a4a]/15 bg-white text-[#0b2a4a] placeholder:text-[#0b2a4a]/35';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? t.close : t.open}
        aria-expanded={open}
        className="nf-dali-launch fixed bottom-4 right-4 z-40 flex h-14 items-center gap-2 rounded-full border border-[#c2a378]/50 bg-[#05070a] pl-2 pr-4 text-white shadow-[0_12px_34px_rgba(194,163,120,.35)] transition hover:-translate-y-1 sm:bottom-[6.5rem]"
      >
        <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#2a2116] to-[#0b0d12]">
          <img src="/dali/dali-mark.png" alt="" className="h-6 w-auto" />
        </span>
        <span dir="ltr" className="text-[10px] font-black uppercase tracking-[.22em]">{open ? '✕' : 'DALI'}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t.title}
          dir={ar ? 'rtl' : 'ltr'}
          className={`nf-dali-panel fixed bottom-[5.25rem] right-3 z-40 flex h-[min(560px,calc(100dvh-7rem))] w-[min(380px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[1.6rem] border shadow-[0_24px_70px_rgba(0,0,0,.45)] backdrop-blur-xl sm:bottom-[10.5rem] sm:right-4 ${panel}`}
        >
          <div className="flex items-center gap-3 border-b border-[#c2a378]/20 px-4 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#05070a] ring-1 ring-[#c2a378]/40">
              <img src="/dali/dali-mark.png" alt="" className="h-6 w-auto" />
            </span>
            <div className="min-w-0 flex-1">
              <div dir="ltr" className={`text-sm font-black tracking-[.2em] ${ar ? 'text-right' : ''}`}>DALI</div>
              <div className={`truncate text-[11px] ${muted}`}>{t.sub}</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={t.close} className={`grid h-8 w-8 place-items-center rounded-full text-lg ${muted} hover:text-[#c2a378]`}>×</button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-[13px] leading-6">
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${bubbleBot}`}>{t.hello}</div>
            {msgs.length === 0 && !locked && (
              <div className="flex flex-wrap gap-2">
                {t.chips.map(c => (
                  <button key={c} type="button" onClick={() => send(undefined, c)} className="rounded-full border border-[#c2a378]/40 px-3 py-1.5 text-[11px] text-[#c2a378] transition hover:bg-[#c2a378]/10">{c}</button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 ${m.role === 'user' ? 'bg-gradient-to-br from-[#d8bd8f] to-[#a9875a] text-[#130f08]' : bubbleBot}`}>{m.content}</div>
              </div>
            ))}
            {busy && (
              <div className={`inline-flex items-center gap-2 rounded-2xl px-3.5 py-2.5 ${bubbleBot}`}>
                <img src="/dali/dali-mark.png" alt="" className="dali-spin h-4 w-auto" />
                <span className={muted}>…</span>
              </div>
            )}
            {error && <div className="text-[12px] text-red-400">{error}</div>}
            {locked && !busy && (
              <div className="rounded-2xl border border-[#c2a378]/40 bg-[#c2a378]/10 p-4 text-center">
                <div className="text-[13px] font-bold">{t.lockT}</div>
                <div className={`mt-1 text-[12px] ${muted}`}>{t.lockB}</div>
                <button type="button" onClick={() => { setOpen(false); onLogin(); }} className="mt-3 rounded-full bg-gradient-to-br from-[#e6cc9c] to-[#a9875a] px-6 py-2.5 text-[10px] font-black uppercase tracking-[.2em] text-[#130f08] transition hover:-translate-y-0.5">{t.login}</button>
              </div>
            )}
          </div>

          {!locked && (
            <form onSubmit={send} className="border-t border-[#c2a378]/20 px-3 pb-3 pt-2">
              <div className={`mb-1.5 px-1 text-[10px] ${muted}`}>{t.left(left)}</div>
              <div className="flex gap-2">
                <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} maxLength={600} placeholder={t.ph} disabled={busy} className={`min-w-0 flex-1 rounded-full border px-4 py-2.5 text-[13px] outline-none focus:border-[#c2a378] ${field}`} />
                <button type="submit" disabled={busy || !input.trim()} className="rounded-full bg-gradient-to-br from-[#e6cc9c] to-[#a9875a] px-4 text-[10px] font-black uppercase tracking-[.16em] text-[#130f08] transition disabled:opacity-40">{t.send}</button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
};

export default DaliPublicChat;
