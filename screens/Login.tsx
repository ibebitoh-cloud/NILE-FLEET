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
  const [stage, setStage] = useState<'form' | 'verifying' | 'granted' | 'welcome'>('form');
  const [welcomeStyle, setWelcomeStyle] = useState(0);
  const [progress, setProgress] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const musicTimersRef = useRef<number[]>([]);
  const enterRef = useRef<(() => void) | null>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const startLoginMusic = useRef<() => void>(() => {});
  useEffect(() => {
    const timers: number[] = [];
    startLoginMusic.current = () => {
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = audioContextRef.current || new AudioCtx();
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      if (musicGainRef.current) {
        setSoundEnabled(ctx.state !== 'closed');
        return;
      }
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.8);
      master.connect(ctx.destination);
      musicGainRef.current = master;
      const bass = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bass.type = 'sine'; bass.frequency.value = 55; bassGain.gain.value = 0.48;
      bass.connect(bassGain).connect(master); bass.start();
      const pad = ctx.createOscillator();
      const padGain = ctx.createGain();
      pad.type = 'triangle'; pad.frequency.value = 110; pad.detune.value = -4; padGain.gain.value = 0.14;
      pad.connect(padGain).connect(master); pad.start();
      const melody = [110, 130.81, 146.83, 174.61, 146.83, 130.81, 98, 110, 110, 146.83, 174.61, 196, 174.61, 146.83, 130.81, 98];
      let step = 0;
      const playStep = () => {
        if (!musicGainRef.current) return;
        const time = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(melody[step % melody.length], time);
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(0.16, time + 0.035);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.42);
        osc.connect(gain).connect(master);
        osc.start(time); osc.stop(time + 0.45);
        step++;
      };
      playStep();
      const interval = window.setInterval(playStep, 420);
      timers.push(interval);
      musicTimersRef.current = timers;
      setSoundEnabled(true);
    };
    startLoginMusic.current();
    const unlock = () => startLoginMusic.current();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
      musicTimersRef.current.forEach(timer => window.clearInterval(timer));
      musicTimersRef.current = [];
      const ctx = audioContextRef.current;
      const gain = musicGainRef.current;
      if (ctx && gain) gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.18);
      window.setTimeout(() => {
        audioContextRef.current?.close().catch(() => {});
        audioContextRef.current = null;
        musicGainRef.current = null;
      }, 300);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    const play = () => { void video.play().catch(() => {}); };
    video.addEventListener('loadedmetadata', play);
    video.addEventListener('canplay', play);
    play();
    return () => {
      video.removeEventListener('loadedmetadata', play);
      video.removeEventListener('canplay', play);
    };
  }, []);

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
      setStage('form');
      return;
    }
    enterRef.current = enter;
    setProgress(100);
    await new Promise(r => setTimeout(r, 450));
    enterWelcome();
  };

  const enterWelcome = () => {
    const previous = Number(sessionStorage.getItem('nilefleet_welcome_style') || '-1');
    const next = Number.isFinite(previous) && previous >= 0 ? (previous + 1) % 6 : 0;
    sessionStorage.setItem('nilefleet_welcome_style', String(next));
    setWelcomeStyle(next);
    setStage('form');
    requestAnimationFrame(() => setStage('welcome'));
  };


  const enterApp = () => {
    const go = enterRef.current;
    enterRef.current = null;
    if (go) go();
  };

  useEffect(() => {
    if (stage !== 'verifying') return;
    const id = window.setInterval(() => {
      setProgress(p => (p < 92 ? p + (92 - p) * 0.07 + 0.3 : p));
    }, 60);
    return () => window.clearInterval(id);
  }, [stage]);

  useEffect(() => {
    if (stage !== 'granted') return;
    const id = window.setTimeout(enterWelcome, 900);
    return () => window.clearTimeout(id);
  }, [stage]);

  const AnimatedText = ({ text, colorClass = "text-white", baseDelay = 0 }: { text: string, colorClass?: string, baseDelay?: number }) => {
    return (
      <span className="inline-block">
        {text.split('').map((char, i) => (
          <span key={i} className={`inline-block letter-anim ${colorClass} ${char === ' ' ? 'mr-3' : ''}`} style={{ animationDelay: `${baseDelay + (i * 0.1)}s` }}>
            {char}
          </span>
        ))}
      </span>
    );
  };

  const welcomeQuote = 'Sharp details keep every operation moving in the right direction.';
  const welcomeAnimationClass = `welcome-anim-${welcomeStyle}`;

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
        @keyframes welcomeRise { 0% { opacity: 0; transform: translateY(22px); filter: blur(8px); } 100% { opacity: 1; transform: translateY(0); filter: blur(0); } }
        @keyframes welcomeGlow { 0%,100% { opacity: .35; transform: scale(.96); } 50% { opacity: .9; transform: scale(1.04); } }
        @keyframes welcomeLetter3d { 0%,100% { transform:translateY(0) rotateX(0) rotateY(0); text-shadow:0 0 0 transparent; } 50% { transform:translateY(-4px) rotateX(18deg) rotateY(-12deg); text-shadow:5px 7px 0 rgba(0,31,63,.7), 0 0 18px rgba(194,163,120,.45); } }
        .welcome-letter-3d { animation: welcomeLetter3d 2.8s ease-in-out infinite; transform-style:preserve-3d; }

        /* BEBITO signature — one SVG coordinate system: exact letter targets + physical worker interaction. */
        .signature-stage{position:relative;width:min(100%,430px);height:92px;margin:0 auto;overflow:visible}
        .signature-svg{display:block;width:100%;height:92px;overflow:visible}
        .signature-svg text{font-family:Arial,Helvetica,sans-serif;font-weight:900;letter-spacing:1px}
        .signature-letter{transform-box:fill-box;transform-origin:50% 88%;will-change:transform}
        .sig-worker{transform-box:fill-box;transform-origin:0 0;will-change:transform}
        .sig-worker *{vector-effect:non-scaling-stroke}
        .sig-line{fill:none;stroke:rgba(255,255,255,.96);stroke-width:2.15;stroke-linecap:round;stroke-linejoin:round}
        .sig-gold{fill:none;stroke:#C2A378;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
        .sig-dot{fill:#C2A378}
        .sig-ground{fill:none;stroke:rgba(194,163,120,.2);stroke-width:1}
        @keyframes sigWalkExact{
          0%{transform:translate(var(--sx),8px)}
          8%{transform:translate(calc(var(--sx) + 14px),2px)}
          16%{transform:translate(calc(var(--sx) + 28px),8px)}
          24%{transform:translate(var(--tx),0)}
          38%,43%{transform:translate(var(--tx),0)}
          48%{transform:translate(calc(var(--tx) + 2px),1px)}
          54%,61%{transform:translate(var(--tx),0)}
          70%{transform:translate(calc(var(--tx) + 42px),0)}
          82%{transform:translate(calc(var(--tx) + 76px),2px)}
          100%{transform:translate(var(--sx),8px)}
        }
        @keyframes sigArmReachExact{
          0%,36%{transform:rotate(0deg)}
          43%{transform:rotate(-9deg)}
          49%{transform:rotate(-18deg)}
          54%{transform:rotate(-23deg)}
          62%,100%{transform:rotate(0deg)}
        }
        @keyframes sigLegWalkA{
          0%,8%,16%,24%,62%,70%,82%,100%{transform:rotate(0deg)}
          4%{transform:rotate(18deg)} 12%{transform:rotate(-18deg)}
          68%{transform:rotate(18deg)} 76%{transform:rotate(-18deg)}
        }
        @keyframes sigLegWalkB{
          0%,8%,16%,24%,62%,70%,82%,100%{transform:rotate(0deg)}
          4%{transform:rotate(-18deg)} 12%{transform:rotate(18deg)}
          68%{transform:rotate(-18deg)} 76%{transform:rotate(18deg)}
        }
        @keyframes sigPush{
          0%,43%{transform:translate(0,0) rotate(0) scale(1)}
          49%{transform:translate(3px,-2px) rotate(-7deg) scale(1.08)}
          54%{transform:translate(-2px,1px) rotate(5deg) scale(1.03)}
          62%,100%{transform:translate(0,0) rotate(0) scale(1)}
        }
        @keyframes sigImpact{
          0%,46%{opacity:0;transform:scale(.2)}
          50%{opacity:1;transform:scale(1)}
          60%{opacity:0;transform:scale(2.4)}
          100%{opacity:0}
        }
        .sig-worker{animation:sigWalkExact 5.6s cubic-bezier(.22,.78,.22,1) infinite}
        .sig-worker .sig-action-arm{transform-box:fill-box;transform-origin:31px 31px;animation:sigArmReachExact 5.6s ease-in-out infinite}
        .sig-worker .sig-step-a{transform-box:fill-box;transform-origin:31px 49px;animation:sigLegWalkA 5.6s ease-in-out infinite}
        .sig-worker .sig-step-b{transform-box:fill-box;transform-origin:31px 49px;animation:sigLegWalkB 5.6s ease-in-out infinite}
        .signature-stage .sig-target-letter{animation:none}
        .signature-stage .sig-impact{transform-box:fill-box;transform-origin:center;animation:sigImpact 5.6s ease-out infinite}
        /* Exact SVG target: worker's hand is aligned to each letter's left edge. */
        .signature-stage.welcome-anim-0{--tx:86px;--sx:-52px}
        .signature-stage.welcome-anim-1{--tx:134px;--sx:-42px}
        .signature-stage.welcome-anim-2{--tx:182px;--sx:-32px}
        .signature-stage.welcome-anim-3{--tx:230px;--sx:-22px}
        .signature-stage.welcome-anim-4{--tx:266px;--sx:-10px}
        .signature-stage.welcome-anim-5{--tx:310px;--sx:0px}
        .signature-stage.welcome-anim-0 .sig-target-letter:nth-of-type(1),
        .signature-stage.welcome-anim-1 .sig-target-letter:nth-of-type(2),
        .signature-stage.welcome-anim-2 .sig-target-letter:nth-of-type(3),
        .signature-stage.welcome-anim-3 .sig-target-letter:nth-of-type(4),
        .signature-stage.welcome-anim-4 .sig-target-letter:nth-of-type(5),
        .signature-stage.welcome-anim-5 .sig-target-letter:nth-of-type(6){animation:sigPush 5.6s ease-in-out infinite}
        .signature-stage.welcome-anim-0 .sig-impact-0,
        .signature-stage.welcome-anim-1 .sig-impact-1,
        .signature-stage.welcome-anim-2 .sig-impact-2,
        .signature-stage.welcome-anim-3 .sig-impact-3,
        .signature-stage.welcome-anim-4 .sig-impact-4,
        .signature-stage.welcome-anim-5 .sig-impact-5{animation:sigImpact 5.6s ease-out infinite}
        @media (prefers-reduced-motion:reduce){.sig-worker,.signature-stage .sig-target-letter,.sig-worker *,.signature-stage .sig-impact{animation:none!important}}
        .welcome-rise { animation: welcomeRise .75s cubic-bezier(.2,.8,.2,1) both; }
        .welcome-glow { animation: welcomeGlow 2.8s ease-in-out infinite; }
        @keyframes signatureShimmer { 0%,100% { opacity:.62; letter-spacing:.34em; transform:scale(.98); } 50% { opacity:1; letter-spacing:.46em; transform:scale(1.02); } }
        .signature-shimmer { animation: signatureShimmer 2.8s ease-in-out infinite; }
      `}</style>


      <div className="login-screen-shell w-full min-h-screen lg:h-screen grid grid-cols-1 lg:grid-cols-12 overflow-hidden relative z-10">
        <div ref={bgRef} className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
          <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover object-center lg:object-cover" src="/genmark-clip-on-gc5-genset.mp4" poster="/login-poster.jpg" autoPlay muted loop playsInline preload="auto" disablePictureInPicture controls={false} aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-b lg:bg-gradient-to-r from-[#001F3F]/70 via-[#001F3F]/42 to-[#071521]/80 lg:from-[#001F3F]/65 lg:via-[#001F3F]/45 lg:to-[#071521]/55"></div>
          <div className="absolute inset-0 opacity-[0.12] bg-[repeating-linear-gradient(0deg,transparent_0px,transparent_3px,rgba(220,230,240,0.22)_4px)]"></div>
          <div className="film-scanline absolute -inset-x-8 top-0 h-24 bg-gradient-to-b from-transparent via-[#C2A378]/30 to-transparent"></div>
          <div className="film-flicker absolute inset-0 bg-[#C2A378]/20 mix-blend-screen"></div>
          <div className="absolute inset-0 shadow-[inset_0_0_160px_rgba(0,0,0,0.7)]"></div>
          <div className="pointer-events-none absolute inset-0 mix-blend-screen" style={{ background: 'radial-gradient(420px circle at var(--lx, 50%) var(--ly, 40%), rgba(194,163,120,0.28), transparent 65%)' }}></div>
          <div className="pointer-events-none absolute inset-0 opacity-[0.09] mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")" }}></div>
        </div>

        <div className="absolute inset-0 z-0 lg:relative lg:inset-auto lg:col-span-7 flex flex-col justify-center p-8 lg:p-20 overflow-hidden">
          <div className="relative z-10 hidden lg:block">
            <div className="mb-16">
              <p className="text-[#C2A378] text-[10px] font-black uppercase tracking-[0.6em] mb-6 animate-pulse">{t.secureTerminal} <span className="ml-3 inline-flex items-center gap-2 tracking-[0.25em]"><span className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_10px_#fb7185]"></span>REC&nbsp; 00:08:24</span></p>
              <div className="flex items-center gap-5"><img src="/nile-fleet-logo.png" className="h-20 w-20 object-contain" alt="Nile Fleet" /><h1 className="text-7xl font-black text-white tracking-tighter uppercase italic leading-none">NILE <span className="text-[#C2A378]">FLEET</span></h1></div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#C2A378] italic mt-3">SHERIF HEGAZY</p>
            </div>
            <div className="space-y-6">
              <div className="relative"><h2 className="text-5xl font-black leading-tight uppercase tracking-tighter italic">{isAr ? <span className="text-white">قوة المولدات.</span> : <><AnimatedText text="GENSET" baseDelay={0.2} /> <br/><AnimatedText text="POWER." colorClass="text-[#C2A378]" baseDelay={0.6} /></>}</h2></div>
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

        <div className="col-span-full lg:col-span-5 min-h-screen lg:h-screen flex items-center lg:items-center justify-center px-4 py-7 sm:px-8 sm:py-10 lg:px-12 lg:py-0 relative z-10">
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 lg:top-8 lg:right-8 z-20 flex items-center gap-2">
            <button type="button" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-1.5 ${isDark ? 'border-[#C2A378]/40 bg-slate-800/80 text-[#C2A378] hover:bg-slate-700' : 'border-slate-300 bg-slate-50 text-[#001F3F] hover:bg-slate-100'}`}>
              <span>🌐</span><span>{lang === 'en' ? 'العربية' : 'ENGLISH'}</span>
            </button>
          </div>

          <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-[16rem] sm:text-[24rem] lg:text-[40rem] font-black text-slate-500/5 pointer-events-none select-none italic tracking-tighter">N</div>
          <div ref={cardRef} style={{ transform: 'perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))', transition: 'transform 120ms ease-out' }} className={`max-w-sm sm:max-w-md lg:max-w-sm w-full mx-auto space-y-5 sm:space-y-6 lg:space-y-7 relative z-10 rounded-3xl px-5 py-6 sm:px-8 sm:py-8 backdrop-blur-md border shadow-2xl ${stage !== 'form' ? 'flex flex-col items-center justify-center text-center min-h-[440px]' : ''} ${isDark ? 'bg-slate-900/35 border-white/10' : 'bg-white/35 border-white/30'}`}>
            <div className="pointer-events-none absolute inset-0 rounded-3xl" style={{ background: 'radial-gradient(260px circle at var(--cx, 50%) var(--cy, 0%), rgba(194,163,120,0.22), transparent 60%)' }}></div>
            {stage !== 'form' ? (
              <div className="flex flex-1 w-full min-h-[390px] items-center justify-center text-center" role="status" aria-live="polite">
                {stage === 'verifying' ? (
                  <div className="w-full flex flex-col items-center justify-center space-y-4 text-center">
                    <h3 className={`text-2xl font-black uppercase italic tracking-tighter ${isDark ? 'text-white' : 'text-[#001F3F]'}`}>{isAr ? 'جارٍ التحقق...' : 'VERIFYING...'}</h3>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{isAr ? 'نفحص بياناتك بأمان' : 'Securely checking your credentials'}</p>
                    <div className="relative h-24 w-24 mt-3 mx-auto shrink-0">
                      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90"><circle cx="50" cy="50" r="44" fill="none" stroke="rgba(194,163,120,0.2)" strokeWidth="6" /><circle cx="50" cy="50" r="44" fill="none" stroke="#C2A378" strokeWidth="6" strokeLinecap="round" strokeDasharray="276.46" strokeDashoffset={276.46 * (1 - progress / 100)} style={{ transition: 'stroke-dashoffset 120ms linear' }} /></svg>
                      <span className={`absolute inset-0 flex items-center justify-center text-lg font-black ${isDark ? 'text-white' : 'text-[#001F3F]'}`}>{Math.round(progress)}</span>
                    </div>
                  </div>
                ) : stage === 'granted' ? (
                  <div className="w-full flex flex-col items-center justify-center space-y-4 text-center">
                    <h3 className={`text-2xl font-black uppercase italic tracking-tighter ${isDark ? 'text-white' : 'text-[#001F3F]'}`}>{isAr ? 'تم منح الوصول' : 'ACCESS GRANTED'}</h3>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{isAr ? 'مرحباً بعودتك' : 'Welcome back'}</p>
                    <div className="relative h-24 w-24 mt-3 flex items-center justify-center">
                      {Array.from({ length: 14 }).map((_, k) => { const a = (k / 14) * Math.PI * 2; const r = 62 + (k % 3) * 12; const colors = ['#C2A378', '#10b981', '#38bdf8', '#f472b6', '#facc15']; return <span key={k} className="absolute h-2 w-2 rounded-full" style={{ background: colors[k % colors.length], ['--dx' as any]: `${Math.cos(a) * r}px`, ['--dy' as any]: `${Math.sin(a) * r}px`, animation: 'confettiBurst 900ms ease-out forwards' }} />; })}
                      <div className="h-16 w-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40" style={{ animation: 'popIn 450ms ease-out' }}><svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></div>
                    </div>
                    <button type="button" onClick={enterWelcome} className="mt-3 px-8 min-h-10 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-full uppercase tracking-[0.3em] text-[9px] transition-all active:scale-[0.97]">{isAr ? 'متابعة' : 'CONTINUE'}</button>
                  </div>
                ) : (
                  <div className="w-full flex-1 min-h-[390px] flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <div className={`relative z-10 w-full max-w-sm ${welcomeAnimationClass}`}>
                      <div className="relative">
                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-20 [perspective:900px] pointer-events-none">
                          <div className="absolute left-1/2 top-1/2 h-14 w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-[#C2A378]/25 [transform:rotateX(62deg)] core-spin"></div>
                          <div className="absolute left-1/2 top-1/2 h-8 w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-[#C2A378]/45 [transform:rotateX(62deg)] core-spin-reverse"></div>
                        </div>
                        <p className="relative z-10 text-[#C2A378] text-[9px] sm:text-[10px] font-black uppercase tracking-[0.5em] leading-none">NILE FLEET</p>
                        <h3 className="relative z-10 mt-3 text-white text-[2rem] sm:text-4xl font-black uppercase italic tracking-[-0.045em] leading-none">WELCOME <span className="inline-block text-[#C2A378]">BACK</span></h3>
                        <div className="relative z-10 mt-3 inline-flex items-center gap-2 text-xl sm:text-2xl font-black uppercase tracking-[0.18em] text-white">
                          <span>B</span><span>E</span><span>B</span><span>I</span><span>T</span><span>O</span>
                        </div>
                        <p className="relative z-10 max-w-xs mx-auto mt-4 text-slate-300 text-[10px] sm:text-xs font-bold leading-relaxed tracking-wide">{welcomeQuote}</p>
                      </div>
                      <button type="button" onClick={enterApp} className="mt-5 px-9 py-3 bg-[#001F3F] hover:bg-[#002b57] border border-[#C2A378]/40 text-white font-black rounded-full uppercase tracking-[0.3em] text-[9px] transition-all active:scale-[0.97] shadow-[0_0_30px_rgba(194,163,120,.12)]">{isAr ? 'دخول إلى النظام' : 'ENTER SYSTEM'}</button>
                      <div className={`mt-3 signature-stage welcome-anim-${welcomeStyle}`} aria-label="Powered by Bebito">
                        <svg className="signature-svg" viewBox="0 0 520 122" role="img" aria-labelledby="bebito-signature-title">
                          <title id="bebito-signature-title">Powered by Bebito</title>
                          <text x="42" y="22" fontSize="8.5" fill="#C2A378">POWERED</text>
                          <text x="112" y="22" fontSize="8.5" fill="#FFFFFF">BY</text>
                          <g aria-hidden="true">
                            <text className="sig-target-letter" x="150" y="67" fontSize="34" fill="#C2A378">B</text>
                            <text className="sig-target-letter" x="198" y="67" fontSize="34" fill="#FFFFFF">E</text>
                            <text className="sig-target-letter" x="246" y="67" fontSize="34" fill="#C2A378">B</text>
                            <text className="sig-target-letter" x="294" y="67" fontSize="34" fill="#FFFFFF">I</text>
                            <text className="sig-target-letter" x="330" y="67" fontSize="34" fill="#C2A378">T</text>
                            <text className="sig-target-letter" x="374" y="67" fontSize="34" fill="#FFFFFF">O</text>
                          </g>
                          <path className="sig-ground" d="M138 78 H405"/>
                          <g className="sig-worker" aria-hidden="true">
                            <circle className="sig-line" cx="31" cy="18" r="7"/>
                            <circle className="sig-dot" cx="34" cy="17" r="1.2"/>
                            <path className="sig-line" d="M31 25 L31 49"/>
                            <path className="sig-line" d="M31 31 L18 40 L10 31"/>
                            <g className="sig-action-arm">
                              <path className="sig-line" d="M31 31 L44 28 L58 27"/>
                              <circle className="sig-dot" cx="58" cy="27" r="2.2"/>
                            </g>
                            <g className="sig-step-a"><path className="sig-line" d="M31 49 L25 61 L20 72"/></g>
                            <g className="sig-step-b"><path className="sig-line" d="M31 49 L37 61 L42 72"/></g>
                          </g>
                          <g className="sig-impact sig-impact-0" aria-hidden="true">
                            <circle className="sig-gold" cx="150" cy="47" r="6"/>
                          </g>
                          <g className="sig-impact sig-impact-1" aria-hidden="true">
                            <circle className="sig-gold" cx="198" cy="47" r="6"/>
                          </g>
                          <g className="sig-impact sig-impact-2" aria-hidden="true">
                            <circle className="sig-gold" cx="246" cy="47" r="6"/>
                          </g>
                          <g className="sig-impact sig-impact-3" aria-hidden="true">
                            <circle className="sig-gold" cx="294" cy="47" r="6"/>
                          </g>
                          <g className="sig-impact sig-impact-4" aria-hidden="true">
                            <circle className="sig-gold" cx="330" cy="47" r="6"/>
                          </g>
                          <g className="sig-impact sig-impact-5" aria-hidden="true">
                            <circle className="sig-gold" cx="374" cy="47" r="6"/>
                          </g>
                        </svg>
                      </div>
                        
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2.5 sm:space-y-3 text-center lg:text-start relative">
                  <h3 className={`text-[1.65rem] sm:text-3xl lg:text-4xl font-black uppercase italic tracking-tighter leading-[0.95] ${isDark ? 'text-white' : 'text-[#001F3F]'}`}>{isAr ? 'مرحباً بكم في' : 'WELCOME TO'} <br/> <span className="text-[#C2A378]">{isAr ? 'أسطول النيل' : 'NILE FLEET'}</span></h3>
                  <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#C2A378] italic">SHERIF HEGAZY</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-5 text-start">
                  <div className="group"><label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.16em] sm:tracking-widest block mb-2 px-1 group-focus-within:text-[#C2A378] transition-colors">{t.networkIdentity}</label><input type="email" required className="w-full h-12 sm:h-12 px-4 sm:px-5 rounded-xl border outline-none transition-all text-sm font-bold bg-[var(--input-bg)] border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--accent)]" placeholder="EMAIL" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <div className="group"><label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.16em] sm:tracking-widest block mb-2 px-1 group-focus-within:text-[#C2A378] transition-colors">{t.strategicPasskey}</label><input type="password" required className="w-full h-12 sm:h-14 px-4 sm:px-6 rounded-xl border outline-none transition-all text-sm font-bold bg-[var(--input-bg)] border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--accent)]" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                  <button type="submit" className="w-full min-h-12 sm:min-h-12 bg-[#001F3F] hover:bg-[#002b57] text-white font-black py-3 sm:py-4 rounded-xl transition-all uppercase tracking-[0.28em] sm:tracking-[0.4em] text-[9px] sm:text-[10px] shadow-2xl active:scale-[0.98] mt-3 relative overflow-hidden group/btn border border-white/5"><span className="relative z-10">{isAr ? 'دخول إلى النظام' : 'ENTER SYSTEM'}</span><div className="absolute inset-0 bg-[#C2A378] translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500 opacity-20"></div></button>
                </form>
                <div className="flex flex-col gap-4 items-center"><p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.12em] sm:tracking-[0.2em] text-center leading-relaxed">{isAr ? 'لطلب حساب، تواصل مع مسؤول النظام.' : 'Contact your administrator to request an account.'}</p></div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
