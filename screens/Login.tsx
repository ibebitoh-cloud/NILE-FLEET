
import React, { useState, useContext, useRef, useEffect } from 'react';
import { ThemeContext, LanguageContext } from '../App';
import { translations } from '../translations';

// onLogin resolves to a function that enters the app on success, or null on failure.
interface LoginProps { onLogin: (email: string, pass: string) => Promise<(() => void) | null>; }

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { theme, isDark } = useContext(ThemeContext);
  const { lang, setLang } = useContext(LanguageContext);
  const t = translations[lang];
  const isAr = lang === 'ar';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stage, setStage] = useState<'form' | 'verifying' | 'granted'>('form');
  const [progress, setProgress] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const musicTimersRef = useRef<number[]>([]);
  const enterRef = useRef<(() => void) | null>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Cinematic login soundtrack: a lightweight Web Audio score matched to the industrial visuals.
  // It starts after the user's first interaction because browsers block unmuted autoplay.
  const startLoginMusic = useRef<() => void>(() => {});
  useEffect(() => {
    startLoginMusic.current = () => {
      if (soundEnabled) return;
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = audioContextRef.current || new AudioCtx();
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      if (musicGainRef.current) {
        setSoundEnabled(true);
        return;
      }

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.055, ctx.currentTime + 1.8);
      master.connect(ctx.destination);
      musicGainRef.current = master;

      const now = ctx.currentTime;
      const notes = [55, 65.41, 73.42, 82.41, 98, 110, 130.81, 146.83];
      const makeVoice = (frequency: number, type: OscillatorType, volume: number, detune = 0) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, now);
        osc.detune.value = detune;
        gain.gain.value = volume;
        osc.connect(gain).connect(master);
        osc.start(now);
        return { osc, gain };
      };

      // Deep engine-like drone + restrained metallic harmonic layer.
      const bass = makeVoice(55, 'sine', 0.42);
      const sub = makeVoice(82.41, 'triangle', 0.13, -5);
      const shimmer = makeVoice(220, 'sine', 0.035, 7);
      shimmer.gain.gain.setValueAtTime(0.0001, now);
      shimmer.gain.gain.exponentialRampToValueAtTime(0.035, now + 2.5);

      const sequence = [0, 2, 4, 1, 3, 5, 2, 6, 4, 1, 5, 7];
      sequence.forEach((index, i) => {
        const delay = 0.6 + i * 1.35;
        const timer = window.setTimeout(() => {
          if (!musicGainRef.current) return;
          const t = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(notes[index], t);
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(0.045, t + 0.18);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);
          osc.connect(gain).connect(master);
          osc.start(t);
          osc.stop(t + 1.1);
        }, delay * 1000);
        musicTimersRef.current.push(timer);
      });

      // Keep the score evolving without adding an external audio asset.
      const pulse = window.setInterval(() => {
        if (!musicGainRef.current) return;
        const t = ctx.currentTime;
        const target = 0.045 + Math.random() * 0.018;
        master.gain.cancelScheduledValues(t);
        master.gain.setTargetAtTime(target, t, 0.35);
      }, 3200);
      musicTimersRef.current.push(pulse);
      setSoundEnabled(true);

      void bass; void sub;
    };

    const unlock = () => startLoginMusic.current();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      musicTimersRef.current.forEach(timer => {
        window.clearTimeout(timer);
        window.clearInterval(timer);
      });
      musicTimersRef.current = [];
      musicGainRef.current?.gain.setTargetAtTime(0.0001, audioContextRef.current?.currentTime || 0, 0.25);
      window.setTimeout(() => {
        audioContextRef.current?.close().catch(() => {});
        audioContextRef.current = null;
        musicGainRef.current = null;
      }, 400);
    };
  }, [soundEnabled]);

  const toggleLoginMusic = () => {
    if (!soundEnabled) {
      startLoginMusic.current();
      return;
    }
    const gain = musicGainRef.current;
    const ctx = audioContextRef.current;
    if (!gain || !ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const current = gain.gain.value;
    gain.gain.setTargetAtTime(current > 0.001 ? 0.0001 : 0.055, ctx.currentTime, 0.12);
  };

  // Cursor-following light + subtle 3D tilt on the login card (mouse/pen only).
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const bg = bgRef.current;
      if (bg) {
        const r = bg.getBoundingClientRect();
        bg.style.setProperty('--lx', `${e.clientX - r.left}px`);
        bg.style.setProperty('--ly', `${e.clientY - r.top}px`);
      }
      const card = cardRef.current;
      if (card) {
        const c = card.getBoundingClientRect();
        const px = (e.clientX - c.left) / c.width;
        const py = (e.clientY - c.top) / c.height;
        const near = px > -0.5 && px < 1.5 && py > -0.5 && py < 1.5;
        const clamp = (v: number) => Math.max(0, Math.min(1, v));
        card.style.setProperty('--rx', near ? `${(0.5 - clamp(py)) * 10}deg` : '0deg');
        card.style.setProperty('--ry', near ? `${(clamp(px) - 0.5) * 10}deg` : '0deg');
        card.style.setProperty('--cx', `${clamp(px) * 100}%`);
        card.style.setProperty('--cy', `${clamp(py) * 100}%`);
      }
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stage !== 'form') return;
    setProgress(4);
    setStage('verifying');
    let enter: (() => void) | null = null;
    try {
      enter = await onLogin(email, password);
    } catch (err) {
      console.error('Login failed:', err);
    }
    if (!enter) {
      setStage('form'); // App already showed the error message
      return;
    }
    enterRef.current = enter;
    setProgress(100);
    await new Promise(r => setTimeout(r, 450));
    setStage('granted');
  };

  const enterApp = () => {
    const go = enterRef.current;
    enterRef.current = null; // make sure it only runs once
    if (go) go();
  };

  // Progress ring: eases toward 92% while the real sign-in runs, jumps to 100% when it finishes.
  useEffect(() => {
    if (stage !== 'verifying') return;
    const id = window.setInterval(() => {
      setProgress(p => (p < 92 ? p + (92 - p) * 0.07 + 0.3 : p));
    }, 60);
    return () => window.clearInterval(id);
  }, [stage]);

  // "Access Granted" screen continues on its own after a moment (button skips the wait).
  useEffect(() => {
    if (stage !== 'granted') return;
    const id = window.setTimeout(enterApp, 1600);
    return () => window.clearTimeout(id);
  }, [stage]);

  const AnimatedText = ({ text, colorClass = "text-white", baseDelay = 0 }: { text: string, colorClass?: string, baseDelay?: number }) => {
    return (
      <span className="inline-block">
        {text.split('').map((char, i) => (
          <span 
            key={i} 
            className={`inline-block letter-anim ${colorClass} ${char === ' ' ? 'mr-3' : ''}`}
            style={{ animationDelay: `${baseDelay + (i * 0.1)}s` }}
          >
            {char}
          </span>
        ))}
      </span>
    );
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-0 m-0 relative overflow-hidden font-sans transition-colors duration-1000 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} ${isAr ? 'rtl font-cairo' : 'ltr'}`}>
      <style>{`
        @keyframes gearShuffle {
          0% { opacity: 0; transform: translateY(20px) rotateX(-120deg) scale(0.8); filter: blur(10px); }
          10%, 15% { opacity: 1; transform: translateY(0) rotateX(0deg) scale(1); filter: blur(0); }
          20% { transform: rotateY(15deg) translateX(2px); }
          25% { transform: rotateY(-15deg) translateX(-2px); }
          30% { transform: rotateX(10deg) translateY(-1px); }
          35% { transform: rotateX(0deg) translateY(0); }
          85% { opacity: 1; transform: scale(1); }
          95% { opacity: 0.5; transform: scale(0.95) rotateX(45deg); }
          100% { opacity: 0; transform: translateY(-20px) rotateX(90deg) scale(0.8); }
        }
        .letter-anim { opacity: 0; animation: gearShuffle 6s cubic-bezier(0.4, 0, 0.2, 1) infinite; backface-visibility: hidden; perspective: 1000px; display: inline-block; transform-origin: center center; }
        @keyframes filmScan { 0%, 100% { transform: translateY(-120%); opacity: 0; } 12%, 78% { opacity: .34; } 58% { transform: translateY(120vh); opacity: 0; } }
        @keyframes filmFlicker { 0%, 96%, 98%, 100% { opacity: 0; } 96.5%, 97.5% { opacity: .22; } }
        @keyframes signalGlitch { 0%, 92%, 94%, 100% { transform: translateX(0); clip-path: inset(45% 0 48%); } 92.5% { transform: translateX(8px); clip-path: inset(22% 0 70%); } 93% { transform: translateX(-5px); clip-path: inset(73% 0 15%); } }
        .film-scanline { animation: filmScan 8s ease-in-out infinite; }
        .film-flicker { animation: filmFlicker 9s steps(1) infinite; }
        .signal-glitch { animation: signalGlitch 7s steps(1) infinite; }
        @keyframes confettiBurst { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) scale(0.5); opacity: 0; } }
        @keyframes popIn { 0% { transform: scale(0.4); opacity: 0; } 70% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); } }
      `}</style>

      <div className="login-screen-shell w-full min-h-screen lg:h-screen grid grid-cols-1 lg:grid-cols-12 overflow-hidden relative z-10">
        <div ref={bgRef} className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
          <video
            className="h-full w-full object-cover"
            src="/genmark-clip-on-gc5-genset.mp4"
            poster="/login-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#001F3F]/65 via-[#001F3F]/45 to-[#071521]/55"></div>
          <div className="absolute inset-0 opacity-[0.12] bg-[repeating-linear-gradient(0deg,transparent_0px,transparent_3px,rgba(220,230,240,0.22)_4px)]"></div>
          <div className="film-scanline absolute -inset-x-8 top-0 h-24 bg-gradient-to-b from-transparent via-[#C2A378]/30 to-transparent"></div>
          <div className="film-flicker absolute inset-0 bg-[#C2A378]/20 mix-blend-screen"></div>
          <div className="absolute inset-0 shadow-[inset_0_0_160px_rgba(0,0,0,0.7)]"></div>
          {/* Cursor-following light */}
          <div className="pointer-events-none absolute inset-0 mix-blend-screen" style={{ background: 'radial-gradient(420px circle at var(--lx, 50%) var(--ly, 40%), rgba(194,163,120,0.28), transparent 65%)' }}></div>
          {/* Film-grain noise */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.09] mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")" }}></div>
        </div>
        
        {/* LEFT PANEL */}
        <div className="absolute inset-0 z-0 lg:relative lg:inset-auto lg:col-span-7 flex flex-col justify-center p-8 lg:p-20 overflow-hidden">
          <div className="relative z-10 hidden lg:block">
            <div className="mb-16">
              <p className="text-[#C2A378] text-[10px] font-black uppercase tracking-[0.6em] mb-6 animate-pulse">{t.secureTerminal} <span className="ml-3 inline-flex items-center gap-2 tracking-[0.25em]"><span className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_10px_#fb7185]"></span>REC&nbsp; 00:08:24</span></p>
              <div className="flex items-center gap-5"><img src="/nile-fleet-logo.png" className="h-20 w-20 object-contain" alt="Nile Fleet" /><h1 className="text-7xl font-black text-white tracking-tighter uppercase italic leading-none">NILE <span className="text-[#C2A378]">FLEET</span></h1></div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#C2A378] italic mt-3">
                SHERIF HEGAZY
              </p>
            </div>
            <div className="space-y-6">
              <div className="relative">
                <h2 className="text-5xl font-black leading-tight uppercase tracking-tighter italic">
                  {isAr ? <span className="text-white">قوة المولدات.</span> : <><AnimatedText text="GENSET" baseDelay={0.2} /> <br/><AnimatedText text="POWER." colorClass="text-[#C2A378]" baseDelay={0.6} /></>}
                </h2>
              </div>
              <p className="text-slate-300 text-[10px] font-bold uppercase tracking-[0.4em] max-w-sm leading-relaxed border-l-2 border-[#C2A378]/30 pl-6">{t.coldChain}</p>
              <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-3 max-w-sm text-[8px] font-black uppercase tracking-[0.2em]">
                <span className="text-slate-300"><span className="text-[#C2A378]">●</span> SYSTEM ONLINE</span>
                <span className="text-slate-300"><span className="text-[#C2A378]">05</span> PORTS CONNECTED</span>
                <span className="text-slate-300"><span className="text-[#C2A378]">500+</span> GENSET UNITS</span>
                <span className="text-slate-300"><span className="text-[#C2A378]">●</span> OPS NETWORK ACTIVE</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="col-span-full lg:col-span-5 min-h-screen flex items-center justify-center px-5 py-20 sm:px-8 sm:py-16 lg:px-12 lg:py-0 relative z-10">
          {/* Top Bar for Language Switcher */}
          <div className="absolute top-6 left-6 lg:top-8 lg:left-8 z-20">
            <button
              type="button"
              onClick={toggleLoginMusic}
              aria-label={soundEnabled ? 'Toggle login soundtrack' : 'Enable login soundtrack'}
              title={soundEnabled ? 'Toggle login soundtrack' : 'Enable cinematic soundtrack'}
              className="px-3 py-2 rounded-xl border border-[#C2A378]/40 bg-[#001F3F]/65 text-[#C2A378] backdrop-blur-sm text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-[#001F3F]/85 transition-all"
            >
              {soundEnabled ? '♫ SOUND ON' : '♫ SOUND'}
            </button>
          </div>

          <div className="absolute top-6 right-6 lg:top-8 lg:right-8 z-20 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-1.5 ${
                isDark 
                  ? 'border-[#C2A378]/40 bg-slate-800/80 text-[#C2A378] hover:bg-slate-700' 
                  : 'border-slate-300 bg-slate-50 text-[#001F3F] hover:bg-slate-100'
              }`}
            >
              <span>🌐</span>
              <span>{lang === 'en' ? 'العربية' : 'ENGLISH'}</span>
            </button>
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[30rem] lg:text-[40rem] font-black text-slate-500/5 pointer-events-none select-none italic tracking-tighter">N</div>
          <div ref={cardRef} style={{ transform: 'perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))', transition: 'transform 120ms ease-out' }} className={`max-w-sm w-full mx-auto space-y-5 sm:space-y-6 lg:space-y-7 relative z-10 rounded-3xl px-6 py-7 sm:px-8 sm:py-8 backdrop-blur-md border shadow-2xl ${isDark ? 'bg-slate-900/35 border-white/10' : 'bg-white/35 border-white/30'}`}>
            <div className="pointer-events-none absolute inset-0 rounded-3xl" style={{ background: 'radial-gradient(260px circle at var(--cx, 50%) var(--cy, 0%), rgba(194,163,120,0.22), transparent 60%)' }}></div>
            {stage !== 'form' ? (
              <div className="flex flex-col items-center justify-center text-center min-h-[340px] space-y-4" role="status" aria-live="polite">
                {stage === 'verifying' ? (
                  <>
                    <h3 className={`text-2xl font-black uppercase italic tracking-tighter ${isDark ? 'text-white' : 'text-[#001F3F]'}`}>{isAr ? 'جارٍ التحقق...' : 'VERIFYING...'}</h3>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{isAr ? 'نفحص بياناتك بأمان' : 'Securely checking your credentials'}</p>
                    <div className="relative h-24 w-24 mt-3">
                      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                        <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(194,163,120,0.2)" strokeWidth="6" />
                        <circle cx="50" cy="50" r="44" fill="none" stroke="#C2A378" strokeWidth="6" strokeLinecap="round" strokeDasharray="276.46" strokeDashoffset={276.46 * (1 - progress / 100)} style={{ transition: 'stroke-dashoffset 120ms linear' }} />
                      </svg>
                      <span className={`absolute inset-0 flex items-center justify-center text-lg font-black ${isDark ? 'text-white' : 'text-[#001F3F]'}`}>{Math.round(progress)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className={`text-2xl font-black uppercase italic tracking-tighter ${isDark ? 'text-white' : 'text-[#001F3F]'}`}>{isAr ? 'تم منح الوصول' : 'ACCESS GRANTED'}</h3>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{isAr ? 'مرحباً بعودتك' : 'Welcome back'}</p>
                    <div className="relative h-24 w-24 mt-3 flex items-center justify-center">
                      {Array.from({ length: 14 }).map((_, k) => {
                        const a = (k / 14) * Math.PI * 2;
                        const r = 62 + (k % 3) * 12;
                        const colors = ['#C2A378', '#10b981', '#38bdf8', '#f472b6', '#facc15'];
                        return <span key={k} className="absolute h-2 w-2 rounded-full" style={{ background: colors[k % colors.length], ['--dx' as any]: `${Math.cos(a) * r}px`, ['--dy' as any]: `${Math.sin(a) * r}px`, animation: 'confettiBurst 900ms ease-out forwards' }} />;
                      })}
                      <div className="h-16 w-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40" style={{ animation: 'popIn 450ms ease-out' }}>
                        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                      </div>
                    </div>
                    <button type="button" onClick={enterApp} className="mt-3 px-8 min-h-10 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-full uppercase tracking-[0.3em] text-[9px] transition-all active:scale-[0.97]">{isAr ? 'دخول' : 'ENTER'}</button>
                  </>
                )}
              </div>
            ) : (
              <>
            <div className="space-y-3 text-center lg:text-start relative">
              <h3 className={`text-2xl sm:text-3xl lg:text-4xl font-black uppercase italic tracking-tighter leading-[0.95] ${isDark ? 'text-white' : 'text-[#001F3F]'}`}>
                <>{isAr ? 'مرحباً بكم في' : 'WELCOME TO'} <br/> <span className="text-[#C2A378]">{isAr ? 'أسطول النيل' : 'NILE FLEET'}</span></>
              </h3>
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#C2A378] italic">
                SHERIF HEGAZY
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 text-start">
              <div className="group">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.16em] sm:tracking-widest block mb-2 px-1 group-focus-within:text-[#C2A378] transition-colors">{t.networkIdentity}</label>
                <input type="email" required className="w-full h-11 sm:h-12 px-4 sm:px-5 rounded-xl border outline-none transition-all text-sm font-bold bg-[var(--input-bg)] border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--accent)]" placeholder="EMAIL" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="group">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.16em] sm:tracking-widest block mb-2 px-1 group-focus-within:text-[#C2A378] transition-colors">{t.strategicPasskey}</label>
                <input type="password" required className="w-full h-12 sm:h-14 px-4 sm:px-6 rounded-xl border outline-none transition-all text-sm font-bold bg-[var(--input-bg)] border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--accent)]" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>

              <button type="submit" className="w-full min-h-11 sm:min-h-12 bg-[#001F3F] hover:bg-[#002b57] text-white font-black py-3 sm:py-4 rounded-xl transition-all uppercase tracking-[0.28em] sm:tracking-[0.4em] text-[9px] sm:text-[10px] shadow-2xl active:scale-[0.98] mt-3 relative overflow-hidden group/btn border border-white/5">
                <span className="relative z-10">{t.initializeCommand}</span>
                <div className="absolute inset-0 bg-[#C2A378] translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500 opacity-20"></div>
              </button>
            </form>

            <div className="flex flex-col gap-4 items-center">
               <p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.12em] sm:tracking-[0.2em] text-center leading-relaxed">{isAr ? 'لطلب حساب، تواصل مع مسؤول النظام.' : 'Contact your administrator to request an account.'}</p>
            </div>
            
            <div className="relative pt-4 sm:pt-5 border-t border-slate-100 dark:border-white/5">
               <div className="flex flex-col items-center gap-1 select-none transition-all mx-auto w-fit text-center font-sans">
                  <div className="bg-slate-50/85 dark:bg-slate-800/50 px-5 sm:px-8 py-2.5 rounded-full border border-slate-100 dark:border-white/10 shadow-sm">
                     <p className="text-[8px] font-black uppercase tracking-[0.35em] sm:tracking-[0.6em] text-slate-400 py-1 leading-none">
                       POWERED BY BEBITO
                     </p>
                  </div>
               </div>
            </div>
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default Login;
