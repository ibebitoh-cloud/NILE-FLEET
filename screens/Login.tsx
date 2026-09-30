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
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(true);
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
    const styles = [0, 1, 2, 3, 4, 5, 6, 7];
    const previous = Number(sessionStorage.getItem('nilefleet_welcome_style') || '-1');
    const available = styles.filter(s => s !== previous);
    const next = available[Math.floor(Math.random() * available.length)];
    sessionStorage.setItem('nilefleet_welcome_style', String(next));
    setWelcomeStyle(next);
    setStage('form');
    requestAnimationFrame(() => setStage('welcome'));
  };

  const requestFullscreen = async () => {
    try {
      const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
      if (document.fullscreenElement) {
        setShowFullscreenPrompt(false);
        return;
      }
      if (root.requestFullscreen) await root.requestFullscreen();
      else if (root.webkitRequestFullscreen) await root.webkitRequestFullscreen();
      setShowFullscreenPrompt(false);
    } catch {
      setShowFullscreenPrompt(false);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => setShowFullscreenPrompt(!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

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

        /* BEBITO signature: one hand-drawn stick man, with a different story on each login session. */
        @keyframes stickWalk { 0% { transform:translateX(-92px); opacity:0; } 12% { opacity:1; } 48% { transform:translateX(0); } 82% { transform:translateX(82px); opacity:1; } 100% { transform:translateX(105px); opacity:0; } }
        @keyframes stickWalkBack { 0% { transform:translateX(105px); opacity:0; } 12% { opacity:1; } 48% { transform:translateX(0); } 82% { transform:translateX(-82px); opacity:1; } 100% { transform:translateX(-105px); opacity:0; } }
        @keyframes stickThink { 0%,18% { transform:translate(0,18px); opacity:0; } 30% { opacity:1; } 42% { transform:translate(0,0); } 58% { transform:translate(-2px,-2px); } 72% { transform:translate(2px,0); } 100% { transform:translate(0,18px); opacity:0; } }
        @keyframes stickArmThink { 0%,25% { transform:rotate(25deg); } 45% { transform:rotate(-18deg); } 58% { transform:rotate(-30deg); } 72% { transform:rotate(-12deg); } 100% { transform:rotate(25deg); } }
        @keyframes stickBuild { 0% { transform:translateX(-75px); opacity:0; } 18% { opacity:1; } 40% { transform:translateX(0); } 55% { transform:translateX(5px); } 70% { transform:translateX(-2px); } 88% { transform:translateX(65px); opacity:1; } 100% { transform:translateX(85px); opacity:0; } }
        @keyframes stickHammer { 0%,35% { transform:rotate(-18deg); } 48% { transform:rotate(32deg); } 60% { transform:rotate(-25deg); } 72% { transform:rotate(30deg); } 100% { transform:rotate(-18deg); } }
        @keyframes stickDraw { 0% { transform:translateX(-70px); opacity:0; } 15% { opacity:1; } 35% { transform:translateX(0); } 55% { transform:translateX(20px); } 78% { transform:translateX(62px); } 100% { transform:translateX(90px); opacity:0; } }
        @keyframes penDraw { 0%,30% { transform:rotate(-35deg); } 45% { transform:rotate(10deg); } 60% { transform:rotate(-20deg); } 75% { transform:rotate(8deg); } 100% { transform:rotate(-35deg); } }
        @keyframes stickPull { 0% { transform:translateX(-70px); opacity:0; } 15% { opacity:1; } 35% { transform:translateX(0); } 55% { transform:translateX(12px); } 78% { transform:translateX(55px); } 100% { transform:translateX(78px); opacity:0; } }
        @keyframes ropePull { 0%,32% { transform:scaleX(.55); transform-origin:left center; } 52% { transform:scaleX(1); } 72% { transform:scaleX(.7); } 100% { transform:scaleX(.55); } }
        @keyframes boxSlide { 0% { transform:translateX(65px); } 45% { transform:translateX(0); } 100% { transform:translateX(-28px); } }
        @keyframes stickPush { 0% { transform:translateX(-58px); opacity:0; } 15% { opacity:1; } 42% { transform:translateX(0); } 68% { transform:translateX(34px); } 100% { transform:translateX(72px); opacity:0; } }
        @keyframes wheelSpin { to { transform:rotate(360deg); } }
        @keyframes stickWave { 0%,20% { transform:rotate(12deg); } 35% { transform:rotate(-28deg); } 50% { transform:rotate(18deg); } 65% { transform:rotate(-25deg); } 80%,100% { transform:rotate(12deg); } }
        @keyframes sigLetterThink { 0%,100% { transform:translateY(0) rotate(0); text-shadow:none; } 45% { transform:translateY(-5px) rotate(-5deg); text-shadow:0 0 16px rgba(194,163,120,.65); } 65% { transform:translateY(0) rotate(2deg); } }
        @keyframes sigLetterBuild { 0%,100% { transform:translateY(0) scale(1); text-shadow:none; } 35% { transform:translateY(-3px) scale(1.06); } 48% { transform:translateY(2px) scale(.97); text-shadow:0 0 18px rgba(194,163,120,.55); } 60% { transform:translateY(-2px) scale(1.03); } }
        @keyframes sigLetterDraw { 0%,100% { transform:translateX(0); opacity:.75; } 45% { transform:translateX(3px); opacity:1; text-shadow:0 0 16px rgba(194,163,120,.7); } 70% { transform:translateX(0); opacity:1; } }
        @keyframes sigLetterPull { 0%,100% { transform:translateX(0) rotate(0); } 45% { transform:translateX(6px) rotate(2deg); text-shadow:0 0 20px rgba(194,163,120,.8); } 65% { transform:translateX(-1px); } }
        @keyframes sigLetterPush { 0%,100% { transform:translateX(0) scale(1); } 45% { transform:translateX(-5px) scale(.98); } 65% { transform:translateX(2px) scale(1.03); text-shadow:0 0 18px rgba(194,163,120,.7); } }
        @keyframes sigLetterWave { 0%,100% { transform:translateY(0) rotate(0); } 25% { transform:translateY(-2px) rotate(-3deg); } 50% { transform:translateY(0) rotate(3deg); } 75% { transform:translateY(-2px) rotate(-2deg); } }
        .signature-scene { position:absolute; left:50%; bottom:0; width:290px; height:76px; transform:translateX(-50%); pointer-events:none; overflow:visible; z-index:1; }
        .signature-scene svg { width:100%; height:100%; overflow:visible; }
        .signature-word { position:relative; z-index:3; display:inline-flex; align-items:baseline; justify-content:center; gap:.08em; }
        .signature-letter { display:inline-block; transform-origin:center bottom; will-change:transform,opacity,text-shadow; }
        .signature-letter-space { width:.28em; }

        /* Physical BEBITO interaction stories — letters are the objects the stickman manipulates. */
        .signature-stage { position:relative; min-height:82px; width:100%; overflow:visible; }
        .signature-word { position:relative; z-index:6; gap:.05em; }
        .signature-letter { position:relative; display:inline-block; min-width:.62em; text-align:center; transform-origin:center 80%; will-change:transform,opacity,filter; }
        .signature-stage::after { content:""; position:absolute; left:50%; bottom:5px; width:72%; height:8px; transform:translateX(-50%); border-bottom:1px solid rgba(194,163,120,.18); border-radius:50%; pointer-events:none; }
        @keyframes physShuffleB { 0%,12%{transform:translate(0,0) rotate(0)} 24%{transform:translate(-12px,-10px) rotate(-12deg)} 38%{transform:translate(28px,7px) rotate(15deg)} 52%{transform:translate(8px,-7px) rotate(-7deg)} 68%,100%{transform:translate(0,0) rotate(0)} }
        @keyframes physShuffleE { 0%,18%{transform:translate(0,0)} 32%{transform:translate(18px,9px) rotate(10deg)} 46%{transform:translate(-22px,-6px) rotate(-12deg)} 64%,100%{transform:translate(0,0)} }
        @keyframes physBuild { 0%{transform:translate(var(--sx),-18px) scale(.72);opacity:.15} 28%{opacity:1} 58%,100%{transform:translate(0,0) scale(1);opacity:1} }
        @keyframes physThrow { 0%,22%{transform:translate(0,0) rotate(0) scale(1)} 42%{transform:translate(58px,-28px) rotate(120deg) scale(1.06)} 60%{transform:translate(0,0) rotate(360deg) scale(1)} 72%,100%{transform:translate(0,0) rotate(360deg)} }
        @keyframes physPull { 0%,25%{transform:translate(0,0) rotate(0)} 45%{transform:translate(24px,0) rotate(4deg)} 62%{transform:translate(9px,0) rotate(-2deg)} 78%,100%{transform:translate(0,0)} }
        @keyframes physCrane { 0%,18%{transform:translateY(-25px) rotate(-8deg);opacity:.25} 40%{opacity:1} 58%{transform:translateY(2px) rotate(3deg)} 72%{transform:translateY(0) rotate(0)} 100%{transform:translateY(0) rotate(0)} }
        @keyframes physConveyor { 0%,15%{transform:translateX(-34px);opacity:.25} 38%{opacity:1} 58%{transform:translateX(8px) rotate(4deg)} 76%,100%{transform:translateX(0) rotate(0);opacity:1} }
        @keyframes physInspect { 0%,28%{transform:translate(0,0) rotate(0)} 44%{transform:translateY(-6px) rotate(-4deg)} 56%{transform:translateY(2px) rotate(3deg)} 70%,100%{transform:translate(0,0) rotate(0)} }
        @keyframes physAssemble { 0%{transform:translateY(22px) scale(.82);opacity:.15} 18%{opacity:1} 48%{transform:translateY(-3px) scale(1.05)} 62%,100%{transform:translateY(0) scale(1);opacity:1} }
        @keyframes stickInteraction { 0%,100%{transform:translateX(0)} 45%{transform:translateX(7px)} 60%{transform:translateX(2px)} }
        @keyframes stickInteractionBack { 0%,100%{transform:translateX(0)} 45%{transform:translateX(-7px)} 60%{transform:translateX(-2px)} }
        .welcome-anim-0 .signature-letter:nth-child(5){animation:physShuffleB 4.8s ease-in-out infinite;}
        .welcome-anim-0 .signature-letter:nth-child(6){animation:physShuffleE 4.8s ease-in-out infinite .12s;}
        .welcome-anim-0 .signature-letter:nth-child(7){animation:physShuffleB 4.8s ease-in-out infinite .24s;}
        .welcome-anim-1 .signature-letter:nth-child(5){--sx:-54px;animation:physBuild 5.4s cubic-bezier(.2,.8,.2,1) infinite;}
        .welcome-anim-1 .signature-letter:nth-child(6){--sx:36px;animation:physBuild 5.4s cubic-bezier(.2,.8,.2,1) infinite .55s;}
        .welcome-anim-1 .signature-letter:nth-child(7){--sx:-28px;animation:physBuild 5.4s cubic-bezier(.2,.8,.2,1) infinite 1.1s;}
        .welcome-anim-2 .signature-letter:nth-child(10){animation:physThrow 5s cubic-bezier(.2,.75,.2,1) infinite;}
        .welcome-anim-2 .signature-letter:nth-child(8){animation:physThrow 5s cubic-bezier(.2,.75,.2,1) infinite 1s;}
        .welcome-anim-2 .signature-letter:nth-child(6){animation:physThrow 5s cubic-bezier(.2,.75,.2,1) infinite 2s;}
        .welcome-anim-3 .signature-letter:nth-child(7){animation:physPull 4.8s ease-in-out infinite;}
        .welcome-anim-3 .signature-letter:nth-child(8){animation:physPull 4.8s ease-in-out infinite .35s;}
        .welcome-anim-4 .signature-letter:nth-child(5){animation:physCrane 5.2s ease-in-out infinite;}
        .welcome-anim-4 .signature-letter:nth-child(9){animation:physCrane 5.2s ease-in-out infinite .9s;}
        .welcome-anim-5 .signature-letter:nth-child(6){animation:physConveyor 4.9s cubic-bezier(.25,.7,.25,1) infinite;}
        .welcome-anim-5 .signature-letter:nth-child(8){animation:physConveyor 4.9s cubic-bezier(.25,.7,.25,1) infinite .8s;}
        .welcome-anim-6 .signature-letter:nth-child(5){animation:physInspect 4.7s ease-in-out infinite;}
        .welcome-anim-6 .signature-letter:nth-child(10){animation:physInspect 4.7s ease-in-out infinite .8s;}
        .welcome-anim-7 .signature-letter{animation:physAssemble 4.6s cubic-bezier(.2,.8,.2,1) infinite;}
        .welcome-anim-7 .signature-letter:nth-child(6){animation-delay:.12s}
        .welcome-anim-7 .signature-letter:nth-child(7){animation-delay:.24s}
        .welcome-anim-7 .signature-letter:nth-child(8){animation-delay:.36s}
        .welcome-anim-7 .signature-letter:nth-child(9){animation-delay:.48s}
        .welcome-anim-7 .signature-letter:nth-child(10){animation-delay:.60s}
        .welcome-anim-0 .stick-think,.welcome-anim-1 .stick-build,.welcome-anim-2 .stick-draw,.welcome-anim-3 .stick-pull,.welcome-anim-4 .stick-push,.welcome-anim-5 .stick-wave{animation-duration:5.4s;animation-timing-function:ease-in-out;}
        .welcome-anim-0 .stick-think,.welcome-anim-6 .stick-think{animation:stickInteraction 4.8s ease-in-out infinite;}
        .welcome-anim-1 .stick-build,.welcome-anim-7 .stick-build{animation:stickInteraction 5.2s ease-in-out infinite;}
        .welcome-anim-2 .stick-draw{animation:stickInteraction 5s ease-in-out infinite;}
        .welcome-anim-3 .stick-pull{animation:stickInteractionBack 4.8s ease-in-out infinite;}
        .welcome-anim-4 .stick-push{animation:stickInteraction 5.2s ease-in-out infinite;}
        .welcome-anim-5 .stick-wave{animation:stickInteraction 4.9s ease-in-out infinite;}
        .welcome-anim-6 .stick-think .stick-arm-think{animation:stickArmThink 4.7s ease-in-out infinite;}
        .welcome-anim-7 .stick-build .stick-hammer{animation:stickHammer 4.8s ease-in-out infinite;}
        @media (prefers-reduced-motion: reduce) {
          .signature-letter,.stick-scene,.signature-scene *{animation:none!important;transition:none!important;}
        }

        .welcome-anim-0 .signature-letter:nth-child(1) { animation:sigLetterThink 2.4s ease-in-out infinite; }
        .welcome-anim-1 .signature-letter:nth-child(3) { animation:sigLetterBuild 2.1s ease-in-out infinite .12s; }
        .welcome-anim-1 .signature-letter:nth-child(5) { animation:sigLetterBuild 2.1s ease-in-out infinite .3s; }
        .welcome-anim-2 .signature-letter:nth-child(1),
        .welcome-anim-2 .signature-letter:nth-child(2),
        .welcome-anim-2 .signature-letter:nth-child(3),
        .welcome-anim-2 .signature-letter:nth-child(4),
        .welcome-anim-2 .signature-letter:nth-child(5),
        .welcome-anim-2 .signature-letter:nth-child(6) { animation:sigLetterDraw 2.8s ease-in-out infinite; }
        .welcome-anim-2 .signature-letter:nth-child(2) { animation-delay:.15s; }
        .welcome-anim-2 .signature-letter:nth-child(3) { animation-delay:.3s; }
        .welcome-anim-2 .signature-letter:nth-child(4) { animation-delay:.45s; }
        .welcome-anim-2 .signature-letter:nth-child(5) { animation-delay:.6s; }
        .welcome-anim-2 .signature-letter:nth-child(6) { animation-delay:.75s; }
        .welcome-anim-3 .signature-letter:nth-child(1) { animation:sigLetterPull 2.5s ease-in-out infinite; }
        .welcome-anim-4 .signature-letter:nth-child(6) { animation:sigLetterPush 2.2s ease-in-out infinite; }
        .welcome-anim-5 .signature-letter { animation:sigLetterWave 2.6s ease-in-out infinite; }
        .welcome-anim-5 .signature-letter:nth-child(2) { animation-delay:.1s; }
        .welcome-anim-5 .signature-letter:nth-child(3) { animation-delay:.2s; }
        .welcome-anim-5 .signature-letter:nth-child(4) { animation-delay:.3s; }
        .welcome-anim-5 .signature-letter:nth-child(5) { animation-delay:.4s; }
        .welcome-anim-5 .signature-letter:nth-child(6) { animation-delay:.5s; }
        .stick-line { fill:none; stroke:#C2A378; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; }
        .stick-white { fill:none; stroke:rgba(255,255,255,.7); stroke-width:1.25; stroke-linecap:round; stroke-linejoin:round; }
        .stick-fill { fill:#C2A378; opacity:.95; }
        .stick-scene { display:none; transform-box:fill-box; transform-origin:center; }
        .welcome-anim-0 .stick-think { display:block; animation:stickThink 6.5s ease-in-out infinite alternate; }
        .welcome-anim-1 .stick-build { display:block; animation:stickBuild 8s ease-in-out infinite alternate; }
        .welcome-anim-2 .stick-draw { display:block; animation:stickDraw 7.5s ease-in-out infinite alternate; }
        .welcome-anim-3 .stick-pull { display:block; animation:stickPull 9s ease-in-out infinite alternate; }
        .welcome-anim-4 .stick-push { display:block; animation:stickPush 6.8s ease-in-out infinite alternate; }
        .welcome-anim-5 .stick-wave { display:block; animation:stickWalk 8.5s ease-in-out infinite alternate; }
        .stick-arm-think { transform-box:fill-box; transform-origin:bottom left; animation:stickArmThink 4.5s ease-in-out infinite alternate; }
        .stick-hammer { transform-box:fill-box; transform-origin:bottom left; animation:stickHammer 1.15s ease-in-out infinite; }
        .stick-pen { transform-box:fill-box; transform-origin:bottom left; animation:penDraw 2.2s ease-in-out infinite; }
        .stick-rope { transform-box:fill-box; transform-origin:left center; animation:ropePull 2.4s ease-in-out infinite alternate; }
        .stick-box { animation:boxSlide 2.8s ease-in-out infinite alternate; }
        .stick-wheel { transform-box:fill-box; transform-origin:center; animation:wheelSpin 1.8s linear infinite; }
        .stick-hand-wave { transform-box:fill-box; transform-origin:bottom left; animation:stickWave 1.4s ease-in-out infinite; }
        .signature-scene .signature-guide { stroke-dasharray:5 5; opacity:.28; }
        .signature-stage { position:relative; display:inline-flex; flex-direction:column; align-items:center; justify-content:flex-end; min-width:290px; min-height:92px; padding-bottom:2px; }

        .welcome-rise { animation: welcomeRise .75s cubic-bezier(.2,.8,.2,1) both; }
        .welcome-glow { animation: welcomeGlow 2.8s ease-in-out infinite; }
        @keyframes signatureShimmer { 0%,100% { opacity:.62; letter-spacing:.34em; transform:scale(.98); } 50% { opacity:1; letter-spacing:.46em; transform:scale(1.02); } }
        .signature-shimmer { animation: signatureShimmer 2.8s ease-in-out infinite; }
      `}</style>

      {showFullscreenPrompt && !document.fullscreenElement && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#00101f]/80 backdrop-blur-md p-5">
          <div className="w-full max-w-xs rounded-3xl border border-[#C2A378]/30 bg-[#061827]/95 p-6 text-center shadow-[0_20px_80px_rgba(0,0,0,.55)]">
            <div className="mx-auto mb-4 h-12 w-12 rounded-2xl border border-[#C2A378]/40 flex items-center justify-center text-[#C2A378] text-xl font-black">N</div>
            <p className="text-[#C2A378] text-[9px] font-black uppercase tracking-[0.35em]">NILE FLEET</p>
            <h2 className="mt-2 text-white text-xl font-black uppercase italic tracking-tight">{isAr ? 'افتح العرض الكامل' : 'OPEN FULL VIEW'}</h2>
            <p className="mt-2 text-slate-400 text-[9px] leading-relaxed">{isAr ? 'لأفضل تجربة، افتح النظام بملء الشاشة.' : 'For the best experience, open the system in full screen.'}</p>
            <button type="button" onClick={requestFullscreen} className="mt-5 w-full rounded-xl bg-[#C2A378] text-[#001F3F] py-3 text-[9px] font-black uppercase tracking-[0.28em] shadow-[0_0_30px_rgba(194,163,120,.2)] active:scale-[.98]">{isAr ? 'فتح ملء الشاشة' : 'OPEN FULL VIEW'}</button>
            <button type="button" onClick={() => setShowFullscreenPrompt(false)} className="mt-3 text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-slate-300">{isAr ? 'ليس الآن' : 'NOT NOW'}</button>
          </div>
        </div>
      )}

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
                          <span className="text-[#C2A378]">B</span><span>E</span><span className="text-[#C2A378]">B</span><span>I</span><span className="text-[#C2A378]">T</span><span>O</span>
                        </div>
                        <p className="relative z-10 max-w-xs mx-auto mt-4 text-slate-300 text-[10px] sm:text-xs font-bold leading-relaxed tracking-wide">{welcomeQuote}</p>
                      </div>
                      <button type="button" onClick={enterApp} className="mt-5 px-9 py-3 bg-[#001F3F] hover:bg-[#002b57] border border-[#C2A378]/40 text-white font-black rounded-full uppercase tracking-[0.3em] text-[9px] transition-all active:scale-[0.97] shadow-[0_0_30px_rgba(194,163,120,.12)]">{isAr ? 'دخول إلى النظام' : 'ENTER SYSTEM'}</button>
                      <div className={`mt-3 relative signature-stage welcome-anim-${welcomeStyle}`}>
                        <div className="relative z-10 signature-word text-[9px] sm:text-[10px] font-black uppercase tracking-[0.22em] text-[#C2A378] whitespace-nowrap" aria-label="Powered by Bebito">
                          <span>POWERED</span><span className="signature-letter-space" aria-hidden="true"></span><span className="text-white">BY</span><span className="signature-letter-space" aria-hidden="true"></span>
                          <span className="signature-letter text-[#C2A378]">B</span><span className="signature-letter text-white">E</span><span className="signature-letter text-[#C2A378]">B</span><span className="signature-letter text-white">I</span><span className="signature-letter text-[#C2A378]">T</span><span className="signature-letter text-white">O</span>
                        </div>
                        <div className="signature-scene" aria-hidden="true">
                          <svg viewBox="0 0 290 88" role="presentation">
                            <path className="stick-white signature-guide" d="M12 72 H278" />
                            <g className="stick-scene stick-think">
                              <circle className="stick-line" cx="82" cy="25" r="7" />
                              <path className="stick-line" d="M82 32 L82 53 M82 38 L70 45 M82 39 L91 29 M82 53 L73 68 M82 53 L91 68" />
                              <g className="stick-arm-think"><path className="stick-line" d="M91 29 L86 18" /><circle className="stick-fill" cx="86" cy="17" r="1.7" /></g>
                              <path className="stick-line" d="M101 16 q8 -8 16 0 q-8 7 -16 0 M105 16 h8" />
                              <path className="stick-white" d="M65 68 H101 M70 72 H95" />
                            </g>
                            <g className="stick-scene stick-build">
                              <circle className="stick-line" cx="66" cy="27" r="7" />
                              <path className="stick-line" d="M66 34 L66 55 M66 39 L55 48 M66 40 L78 48 M66 55 L57 70 M66 55 L75 70" />
                              <g className="stick-hammer"><path className="stick-line" d="M78 48 L91 35" /><path className="stick-line" d="M88 31 L96 39" /></g>
                              <path className="stick-line" d="M105 69 h38 v-28 h-38z M105 55 h38 M124 41 v28" />
                              <path className="stick-white" d="M151 69 l10 -8 v8 l-10 8z M151 41 l10 -8 v28" />
                            </g>
                            <g className="stick-scene stick-draw">
                              <circle className="stick-line" cx="68" cy="28" r="7" />
                              <path className="stick-line" d="M68 35 L68 55 M68 40 L58 50 M68 41 L80 47 M68 55 L59 70 M68 55 L78 69" />
                              <g className="stick-pen"><path className="stick-line" d="M80 47 L94 57" /><path className="stick-line" d="M92 55 l5 3 l-4 5" /></g>
                              <path className="stick-line" d="M105 67 q20 -25 42 0 q20 -24 42 0" />
                              <path className="stick-white" d="M105 73 H190 M112 61 l8 6 M142 61 l8 6 M172 61 l8 6" />
                            </g>
                            <g className="stick-scene stick-pull">
                              <circle className="stick-line" cx="48" cy="28" r="7" />
                              <path className="stick-line" d="M48 35 L48 56 M48 40 L36 51 M48 41 L63 50 M48 56 L38 70 M48 56 L58 70" />
                              <path className="stick-line stick-rope" d="M63 50 H104" />
                              <g className="stick-box"><path className="stick-line" d="M104 36 h42 v34 h-42z M104 36 l13 -9 h42 l-13 9 M159 27 v34" /><path className="stick-white" d="M117 43 h29 M117 50 h29 M117 57 h29" /></g>
                            </g>
                            <g className="stick-scene stick-push">
                              <g className="stick-box"><path className="stick-line" d="M125 39 h45 v31 h-45z M125 39 l12 -8 h45 l-12 8 M182 31 v31" /><path className="stick-white" d="M138 47 h31 M138 55 h31 M138 63 h31" /></g>
                              <circle className="stick-line" cx="72" cy="28" r="7" />
                              <path className="stick-line" d="M72 35 L72 56 M72 41 L61 49 M72 41 L88 44 M72 56 L62 70 M72 56 L82 70 M88 44 L125 47" />
                              <circle className="stick-white stick-wheel" cx="140" cy="72" r="5" /><circle className="stick-white stick-wheel" cx="169" cy="72" r="5" />
                            </g>
                            <g className="stick-scene stick-wave">
                              <circle className="stick-line" cx="72" cy="28" r="7" />
                              <path className="stick-line" d="M72 35 L72 56 M72 41 L61 50 M72 42 L83 48 M72 56 L63 70 M72 56 L82 70" />
                              <g className="stick-hand-wave"><path className="stick-line" d="M83 48 L92 36" /><path className="stick-line" d="M92 36 l5 -5 M92 36 l7 0 M92 36 l2 6" /></g>
                              <path className="stick-line" d="M112 68 h46 v-29 h22 l13 13 v16 h8 M122 68 a5 5 0 1 0 10 0 M177 68 a5 5 0 1 0 10 0" />
                            </g>
                          </svg>
                        </div>
                      </div>
                        
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
