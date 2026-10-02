import React, { useEffect, useMemo, useState } from 'react';

type Message = { role: 'user' | 'dali'; text: string };

interface DaliOrbProps {
  isAr: boolean;
  chatInput: string;
  setChatInput: (value: string) => void;
  chatMessages: Message[];
  chatLoading: boolean;
  chatPhase: number;
  chatPhases: string[];
  correctionInput: string;
  setCorrectionInput: (value: string) => void;
  saveExplicitCorrection: () => void;
  askFleetDali: () => void;
  clearFleetChat: () => void;
  isThinking: boolean;
  runStrategicAdvisor: () => void;
}

const DaliOrb: React.FC<DaliOrbProps> = ({
  isAr, chatInput, setChatInput, chatMessages, chatLoading, chatPhase, chatPhases,
  correctionInput, setCorrectionInput, saveExplicitCorrection, askFleetDali,
  clearFleetChat, isThinking, runStrategicAdvisor
}) => {
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const userName = useMemo(() => {
    try {
      const raw = localStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : null;
      return user?.name || user?.fullName || user?.username || user?.email?.split('@')[0] || 'Bebito';
    } catch {
      return 'Bebito';
    }
  }, []);

  const period = time.getHours() < 12 ? (isAr ? 'صباح الخير' : 'GOOD MORNING')
    : time.getHours() < 18 ? (isAr ? 'مساء الخير' : 'GOOD AFTERNOON')
    : (isAr ? 'مساء الخير' : 'GOOD EVENING');

  const busy = chatLoading || isThinking;
  const suggestions = isAr
    ? ['كم مولد في المخزون؟', 'أين المولدات الموجودة في بورسعيد؟', 'ما العمليات المفتوحة الآن؟', 'ماذا تعرف عن الأسطول؟']
    : ['How many gensets are in stock?', 'Where are the Port Said gensets?', 'What operations are open now?', 'What does DALI know?'];

  return (
    <>
      <style>{`
        @keyframes daliOrbFloat { 0%,100% { transform: translateY(0) scale(1) } 50% { transform: translateY(-7px) scale(1.018) } }
        @keyframes daliOrbPulse { 0%,100% { transform: scale(.96); opacity:.38 } 50% { transform: scale(1.08); opacity:.8 } }
        @keyframes daliOrbSpin { to { transform: rotate(360deg) } }
        @keyframes daliOrbSpinReverse { to { transform: rotate(-360deg) } }
        @keyframes daliOrbShimmer { 0% { transform: translateX(-120%) rotate(18deg) } 100% { transform: translateX(220%) rotate(18deg) } }
        @keyframes daliOrbWave { 0%,100% { transform: scaleY(.45); opacity:.45 } 50% { transform: scaleY(1.25); opacity:1 } }
        @keyframes daliOrbScan { 0% { left:-35% } 100% { left:110% } }
        @keyframes daliOrbIn { from { opacity:0; transform: translateY(12px) scale(.96) } to { opacity:1; transform:none } }
        .dali-orb-shell { animation: daliOrbFloat 5s ease-in-out infinite; }
        .dali-orb-ring { animation: daliOrbSpin 11s linear infinite; }
        .dali-orb-ring-r { animation: daliOrbSpinReverse 15s linear infinite; }
        .dali-orb-core { animation: daliOrbPulse 2.8s ease-in-out infinite; }
        .dali-orb-shimmer { animation: daliOrbShimmer 3.8s ease-in-out infinite; }
        .dali-orb-wave { animation: daliOrbWave .85s ease-in-out infinite; }
        .dali-orb-in { animation: daliOrbIn .35s cubic-bezier(.2,.8,.2,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .dali-orb-shell,.dali-orb-ring,.dali-orb-ring-r,.dali-orb-core,.dali-orb-shimmer,.dali-orb-wave { animation:none !important; }
        }
      `}</style>

      {!open && (
        <button
          type="button"
          aria-label="Open DALI"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[80] h-28 w-28 sm:h-36 sm:w-36 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#C2A378]"
        >
          <span className="dali-orb-shell relative block h-full w-full">
            <span className="absolute -inset-3 rounded-full bg-[#C2A378]/10 blur-2xl" />
            <span className="absolute inset-0 rounded-full border border-white/20 bg-white/[0.07] shadow-[0_20px_70px_rgba(0,0,0,.55)] backdrop-blur-2xl" />
            <span className="dali-orb-ring absolute inset-2 rounded-full border border-[#C2A378]/35 border-t-transparent" />
            <span className="dali-orb-ring-r absolute inset-4 rounded-full border border-white/20 border-b-transparent" />
            <span className="absolute inset-5 overflow-hidden rounded-full bg-gradient-to-br from-white/25 via-[#C2A378]/10 to-transparent">
              <span className="dali-orb-shimmer absolute -inset-y-10 left-0 w-1/3 bg-white/20 blur-xl" />
            </span>
            <span className="dali-orb-core absolute inset-[30%] rounded-full border border-[#C2A378]/45 bg-[#C2A378]/15 shadow-[0_0_35px_rgba(194,163,120,.3)] backdrop-blur-md" />
            <span className="absolute inset-0 flex flex-col items-center justify-center text-white">
              <span className="text-[9px] font-black uppercase tracking-[.35em] text-[#C2A378]">DALI</span>
              <span className="mt-1 text-[7px] font-black uppercase tracking-[.18em] text-white/60">{busy ? (isAr ? 'يعمل' : 'WORKING') : 'AI'}</span>
            </span>
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[7px] font-black uppercase tracking-[.2em] text-white/70 backdrop-blur-xl">
              {period} · {userName}
            </span>
          </span>
        </button>
      )}

      {open && (
        <div className="dali-orb-in fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-3 backdrop-blur-md sm:p-6" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <section className="relative flex h-[min(88vh,760px)] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-[#071522]/90 shadow-[0_35px_120px_rgba(0,0,0,.7)] backdrop-blur-3xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(194,163,120,.12),transparent_42%)]" />

            <header className="relative flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 shrink-0">
                  <span className={`absolute inset-0 rounded-full border border-[#C2A378]/35 ${busy ? 'dali-orb-ring' : ''}`} />
                  <span className={`dali-orb-core absolute inset-2 rounded-full border border-[#C2A378]/40 bg-[#C2A378]/15 ${busy ? 'shadow-[0_0_28px_rgba(194,163,120,.45)]' : ''}`} />
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black tracking-[.2em] text-[#C2A378]">D</span>
                </div>
                <div>
                  <div className="text-[8px] font-black uppercase tracking-[.3em] text-[#C2A378]">DALI AI</div>
                  <div className="mt-1 text-sm font-black uppercase tracking-[.16em] text-white">{period} · {userName}</div>
                  <div className="mt-1 flex items-center gap-2 text-[7px] font-black uppercase tracking-widest text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />
                    {busy ? (isAr ? 'دالي يعمل الآن' : 'DALI IS WORKING') : (isAr ? 'جاهز' : 'READY')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {chatMessages.length > 0 && <button type="button" onClick={clearFleetChat} disabled={busy} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[7px] font-black uppercase tracking-widest text-white/60 hover:bg-white/10 disabled:opacity-30">CLEAR</button>}
                <button type="button" onClick={() => setOpen(false)} aria-label="Close DALI" className="h-9 w-9 rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10">×</button>
              </div>
            </header>

            <div className="relative flex-1 overflow-y-auto px-4 py-5 sm:px-8">
              {chatMessages.length === 0 ? (
                <div className="flex min-h-full items-center justify-center">
                  <div className="w-full max-w-2xl text-center">
                    <div className="dali-orb-shell relative mx-auto h-40 w-40 sm:h-52 sm:w-52">
                      <span className="absolute -inset-6 rounded-full bg-[#C2A378]/10 blur-3xl" />
                      <span className="absolute inset-0 rounded-full border border-white/15 bg-white/[0.06] shadow-[0_25px_80px_rgba(0,0,0,.45)] backdrop-blur-3xl" />
                      <span className="dali-orb-ring absolute inset-3 rounded-full border border-[#C2A378]/30 border-t-transparent" />
                      <span className="dali-orb-ring-r absolute inset-7 rounded-full border border-white/20 border-b-transparent" />
                      <span className="dali-orb-core absolute inset-[25%] rounded-full border border-[#C2A378]/45 bg-[#C2A378]/10 shadow-[0_0_55px_rgba(194,163,120,.28)]" />
                      <span className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-black tracking-[.35em] text-[#C2A378]">DALI</span>
                        <span className="mt-2 text-[7px] font-black uppercase tracking-[.35em] text-white/45">{isAr ? 'مساعد الأسطول' : 'FLEET INTELLIGENCE'}</span>
                      </span>
                    </div>
                    <h2 className="mt-7 text-xl font-black uppercase tracking-[.12em] text-white sm:text-2xl">{period}, {userName}</h2>
                    <p className="mx-auto mt-3 max-w-xl text-xs font-semibold leading-6 text-white/45">{isAr ? 'أنا جاهز للبحث في بيانات الأسطول والعمليات والمولدات والمعرفة المحفوظة.' : 'I am ready to search fleet data, operations, gensets, and saved knowledge.'}</p>
                    <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {suggestions.map(q => <button key={q} type="button" onClick={() => setChatInput(q)} className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-left text-[9px] font-bold text-white/70 transition hover:-translate-y-0.5 hover:border-[#C2A378]/35 hover:bg-[#C2A378]/10">{q}</button>)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-3xl space-y-4">
                  {chatMessages.map((m, i) => (
                    <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                      <div className={`max-w-[90%] rounded-3xl border px-4 py-3 text-[10px] font-bold leading-6 whitespace-pre-wrap ${m.role === 'user' ? 'border-[#C2A378]/25 bg-[#C2A378]/10 text-white' : 'border-white/10 bg-white/[.045] text-white/75'}`}>
                        <div className="mb-1 text-[7px] font-black uppercase tracking-[.25em] text-white/30">{m.role === 'user' ? (isAr ? 'أنت' : 'YOU') : 'DALI'}</div>
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {busy && (
                    <div className="rounded-3xl border border-[#C2A378]/20 bg-[#C2A378]/[.06] p-4">
                      <div className="flex items-center gap-4">
                        <div className="relative h-12 w-12 shrink-0">
                          <span className="absolute inset-0 dali-orb-ring rounded-full border border-[#C2A378]/40 border-t-transparent" />
                          <span className="absolute inset-2 dali-orb-core rounded-full bg-[#C2A378]/15" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between text-[7px] font-black uppercase tracking-[.25em] text-[#C2A378]">
                            <span>{isThinking ? (isAr ? 'تحليل' : 'ANALYZING') : (isAr ? 'دالي يعمل' : 'DALI IS WORKING')}</span>
                            {!isThinking && <span>{chatPhase + 1}/{chatPhases.length}</span>}
                          </div>
                          <div className="mt-2 text-[9px] font-bold text-white/65">{isThinking ? (isAr ? 'تحليل القسم الحالي...' : 'Analyzing current view...') : chatPhases[chatPhase]}</div>
                          <div className="relative mt-3 h-1 overflow-hidden rounded-full bg-white/10"><span className="absolute inset-y-0 w-1/3 dali-orb-shimmer bg-[#C2A378]" /></div>
                          <div className="mt-3 flex h-6 items-center gap-1">{Array.from({length:16},(_,i)=><span key={i} className="dali-orb-wave h-full flex-1 rounded-full bg-[#C2A378]/35" style={{animationDelay: `${i*45}ms`}} />)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <footer className="relative border-t border-white/10 bg-black/15 p-3 sm:p-4">
              <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[.04] p-1.5 focus-within:border-[#C2A378]/45">
                <textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askFleetDali(); } }}
                  placeholder={isAr ? 'اكتب سؤالك لدالي...' : 'Ask DALI anything...'}
                  className="min-h-[48px] max-h-28 flex-1 resize-none rounded-xl border-0 bg-transparent px-3 py-2 text-[16px] leading-5 text-white outline-none placeholder:text-white/25 sm:text-xs"
                />
                <button type="button" onClick={askFleetDali} disabled={busy || !chatInput.trim()} className="h-11 w-11 shrink-0 rounded-xl bg-[#C2A378] text-[#071522] shadow-lg transition hover:scale-105 disabled:opacity-25">➤</button>
              </div>
              {chatMessages.some(m => m.role === 'dali') && (
                <div className="mt-2 flex gap-2">
                  <input value={correctionInput} onChange={e => setCorrectionInput(e.target.value)} placeholder={isAr ? 'صحح فهم دالي...' : 'Correct DALI...'} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-[9px] text-white outline-none" />
                  <button type="button" onClick={saveExplicitCorrection} disabled={!correctionInput.trim()} className="rounded-xl border border-emerald-400/20 px-3 text-[7px] font-black text-emerald-300 disabled:opacity-30">{isAr ? 'تعلم' : 'LEARN'}</button>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between text-[6px] font-black uppercase tracking-widest text-white/25">
                <span>＋ Teach</span><span>📎 Attach</span><span>⌕ Search</span><span>{busy ? (isAr ? '● معالجة' : '● PROCESSING') : '● READY'}</span>
              </div>
              <button type="button" onClick={runStrategicAdvisor} disabled={busy} className="mt-3 w-full rounded-xl border border-[#C2A378]/25 bg-white/[.03] py-2.5 text-[7px] font-black uppercase tracking-[.2em] text-[#C2A378] hover:bg-white/[.07] disabled:opacity-35">{isThinking ? (isAr ? 'جاري التحليل...' : 'ANALYZING...') : (isAr ? 'تحليل القسم الحالي' : 'ANALYZE CURRENT VIEW')}</button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
};

export default DaliOrb;
