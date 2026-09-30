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
        return;
      }
      if (root.requestFullscreen) await root.requestFullscreen();
      else if (root.webkitRequestFullscreen) await root.webkitRequestFullscreen();
    } catch {
    }
  };

  useEffect(() => {
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

        /* BEBITO signature — fluid hand-drawn character motion. The character is built from separate joints so the body, arms, head and legs move naturally rather than sliding as one object. */
        @keyframes sigCharacterFloat { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(1px,-2px,0)} }
        @keyframes sigWalk { 0%{transform:translateX(-118px)} 12%{transform:translateX(-82px)} 28%{transform:translateX(-40px)} 44%{transform:translateX(4px)} 60%{transform:translateX(46px)} 78%{transform:translateX(82px)} 100%{transform:translateX(118px)} }
        @keyframes sigWalkBody { 0%,100%{transform:rotate(0)} 18%{transform:rotate(-2deg)} 42%{transform:rotate(2deg)} 66%{transform:rotate(-2deg)} 84%{transform:rotate(1deg)} }
        @keyframes sigHeadLook { 0%,100%{transform:rotate(0)} 28%{transform:rotate(-7deg)} 48%{transform:rotate(4deg)} 72%{transform:rotate(7deg)} 88%{transform:rotate(0)} }
        @keyframes sigArmA { 0%,100%{transform:rotate(24deg)} 22%{transform:rotate(-8deg)} 46%{transform:rotate(34deg)} 70%{transform:rotate(-2deg)} 88%{transform:rotate(20deg)} }
        @keyframes sigArmB { 0%,100%{transform:rotate(-22deg)} 22%{transform:rotate(8deg)} 46%{transform:rotate(-34deg)} 70%{transform:rotate(2deg)} 88%{transform:rotate(-18deg)} }
        @keyframes sigLegA { 0%,100%{transform:rotate(18deg)} 25%{transform:rotate(-22deg)} 50%{transform:rotate(28deg)} 75%{transform:rotate(-12deg)} }
        @keyframes sigLegB { 0%,100%{transform:rotate(-18deg)} 25%{transform:rotate(24deg)} 50%{transform:rotate(-26deg)} 75%{transform:rotate(14deg)} }
        @keyframes sigReach { 0%,18%{transform:translate(0,0) rotate(12deg)} 34%{transform:translate(8px,-5px) rotate(-20deg)} 48%{transform:translate(18px,-2px) rotate(-42deg)} 62%{transform:translate(6px,1px) rotate(-18deg)} 78%,100%{transform:translate(0,0) rotate(12deg)} }
        @keyframes sigTap { 0%,34%{transform:translate(0,0)} 43%{transform:translate(14px,-2px)} 49%{transform:translate(20px,-2px)} 56%{transform:translate(8px,0)} 70%,100%{transform:translate(0,0)} }
        @keyframes sigKick { 0%,30%{transform:rotate(0)} 44%{transform:rotate(-22deg)} 54%{transform:rotate(26deg)} 64%{transform:rotate(-8deg)} 78%,100%{transform:rotate(0)} }
        @keyframes sigHeadNod { 0%,30%{transform:rotate(0)} 42%{transform:rotate(12deg)} 50%{transform:rotate(19deg)} 58%{transform:rotate(7deg)} 72%,100%{transform:rotate(0)} }
        @keyframes sigPull { 0%,25%{transform:translateX(0)} 42%{transform:translateX(-7px)} 56%{transform:translateX(5px)} 72%{transform:translateX(-2px)} 100%{transform:translateX(0)} }
        @keyframes sigLetterReact { 0%,38%,100%{transform:translateY(0) rotate(0) scale(1)} 47%{transform:translateY(-3px) rotate(-3deg) scale(1.04)} 57%{transform:translateY(1px) rotate(2deg) scale(.99)} 68%{transform:translateY(0) rotate(0) scale(1)} }
        .signature-stage { position:relative; min-height:82px; width:100%; overflow:visible; }
        .signature-word { position:relative; z-index:6; display:inline-flex; align-items:baseline; justify-content:center; gap:.05em; }
        .signature-letter { position:relative; display:inline-block; min-width:.62em; text-align:center; transform-origin:center 80%; will-change:transform,opacity,filter; }
        .signature-stage::after { content:""; position:absolute; left:50%; bottom:5px; width:72%; height:8px; transform:translateX(-50%); border-bottom:1px solid rgba(194,163,120,.18); border-radius:50%; pointer-events:none; }
        .signature-character { position:absolute; left:50%; bottom:7px; width:62px; height:72px; transform:translateX(-50%); z-index:7; pointer-events:none; }
        .signature-character .sig-body { transform-origin:31px 34px; animation:sigWalkBody 2.9s ease-in-out infinite; }
        .signature-character .sig-head { transform-origin:31px 20px; animation:sigHeadLook 2.9s ease-in-out infinite; }
        .signature-character .sig-arm-a { transform-origin:31px 35px; animation:sigArmA 1.45s ease-in-out infinite; }
        .signature-character .sig-arm-b { transform-origin:31px 35px; animation:sigArmB 1.45s ease-in-out infinite; }
        .signature-character .sig-leg-a { transform-origin:31px 51px; animation:sigLegA 1.45s ease-in-out infinite; }
        .signature-character .sig-leg-b { transform-origin:31px 51px; animation:sigLegB 1.45s ease-in-out infinite; }
        .signature-character .sig-hand { transform-origin:53px 38px; animation:sigTap 2.9s ease-in-out infinite; }
        .signature-character .sig-foot { transform-origin:48px 62px; animation:sigKick 2.9s ease-in-out infinite; }
        .signature-character .sig-head-action { animation:sigHeadNod 2.9s ease-in-out infinite; transform-origin:31px 20px; }
        .signature-character .sig-pull { animation:sigPull 2.9s ease-in-out infinite; }
        .signature-character .sig-line { fill:none; stroke:rgba(255,255,255,.92); stroke-width:2.4; stroke-linecap:round; stroke-linejoin:round; vector-effect:non-scaling-stroke; }
        .signature-character .sig-accent { fill:none; stroke:#C2A378; stroke-width:1.5; stroke-linecap:round; vector-effect:non-scaling-stroke; }
        .signature-character .sig-dot { fill:#C2A378; }
        .signature-character.sig-scene-0 { animation:sigWalk 2.9s cubic-bezier(.42,0,.58,1) infinite; }
        .signature-character.sig-scene-1 { animation:sigWalk 3.2s cubic-bezier(.42,0,.58,1) infinite; }
        .signature-character.sig-scene-2 { animation:sigWalk 3.1s cubic-bezier(.42,0,.58,1) infinite; }
        .signature-character.sig-scene-3 { animation:sigWalk 3s cubic-bezier(.42,0,.58,1) infinite; }
        .signature-character.sig-scene-4 { animation:sigWalk 3.3s cubic-bezier(.42,0,.58,1) infinite; }
        .signature-character.sig-scene-5 { animation:sigWalk 3s cubic-bezier(.42,0,.58,1) infinite; }
        .signature-character.sig-scene-6 { animation:sigWalk 3.2s cubic-bezier(.42,0,.58,1) infinite; }
        .signature-character.sig-scene-7 { animation:sigWalk 3.1s cubic-bezier(.42,0,.58,1) infinite; }
        .signature-character.sig-scene-0 .sig-action-arm { animation:sigReach 2.9s ease-in-out infinite; transform-origin:31px 35px; }
        .signature-character.sig-scene-0 .sig-action-hand { animation:sigTap 2.9s ease-in-out infinite; }
        .signature-character.sig-scene-1 .sig-action-arm { animation:sigReach 3.2s ease-in-out infinite; transform-origin:31px 35px; }
        .signature-character.sig-scene-2 .sig-action-head { animation:sigHeadNod 3.1s ease-in-out infinite; }
        .signature-character.sig-scene-3 .sig-action-leg { animation:sigKick 3s ease-in-out infinite; transform-origin:31px 51px; }
        .signature-character.sig-scene-4 .sig-action-pull { animation:sigPull 3.3s ease-in-out infinite; }
        .signature-character.sig-scene-5 .sig-action-arm { animation:sigReach 3s ease-in-out infinite; transform-origin:31px 35px; }
        .signature-character.sig-scene-6 .sig-action-head { animation:sigHeadNod 3.2s ease-in-out infinite; }
        .signature-character.sig-scene-7 .sig-action-arm { animation:sigReach 3.1s ease-in-out infinite; transform-origin:31px 35px; }
        .signature-stage.welcome-anim-0 .signature-letter:nth-of-type(1),
        .signature-stage.welcome-anim-0 .signature-letter:nth-of-type(2),
        .signature-stage.welcome-anim-0 .signature-letter:nth-of-type(3),
        .signature-stage.welcome-anim-0 .signature-letter:nth-of-type(4),
        .signature-stage.welcome-anim-0 .signature-letter:nth-of-type(5),
        .signature-stage.welcome-anim-0 .signature-letter:nth-of-type(6) { animation:sigLetterReact 2.9s ease-in-out infinite; }
        @keyframes sigContactHand { 0%,18%{transform:rotate(24deg) translate(0,0)} 32%{transform:rotate(-8deg) translate(3px,-1px)} 42%{transform:rotate(-35deg) translate(12px,-4px)} 48%{transform:rotate(-48deg) translate(20px,-3px)} 54%{transform:rotate(-25deg) translate(10px,0)} 70%,100%{transform:rotate(24deg) translate(0,0)} }
        @keyframes sigContactHead { 0%,28%{transform:translate(0,0) rotate(0)} 40%{transform:translate(7px,2px) rotate(9deg)} 48%{transform:translate(14px,3px) rotate(14deg)} 56%{transform:translate(6px,1px) rotate(6deg)} 72%,100%{transform:translate(0,0) rotate(0)} }
        @keyframes sigContactFoot { 0%,30%{transform:rotate(18deg)} 42%{transform:rotate(-8deg)} 52%{transform:rotate(-30deg)} 60%{transform:rotate(-5deg)} 76%,100%{transform:rotate(18deg)} }
        @keyframes sigLetterTouch { 0%,38%,100%{transform:translate(0,0) rotate(0)} 44%{transform:translate(2px,-1px) rotate(-2deg)} 49%{transform:translate(6px,0) rotate(4deg)} 54%{transform:translate(2px,1px) rotate(-2deg)} 64%{transform:translate(0,0) rotate(0)} }
        @keyframes sigContactPulse { 0%,42%,100%{opacity:0;transform:scale(.4)} 47%{opacity:1;transform:scale(1.15)} 55%{opacity:0;transform:scale(1.6)} }
        .signature-character .sig-contact-hand { transform-origin:31px 35px; animation:sigContactHand 3s ease-in-out infinite; }
        .signature-character .sig-contact-head { transform-origin:31px 20px; animation:sigContactHead 3s ease-in-out infinite; }
        .signature-character .sig-contact-foot { transform-origin:31px 51px; animation:sigContactFoot 3s ease-in-out infinite; }
        .signature-character .sig-contact-pulse { transform-origin:center; animation:sigContactPulse 3s ease-out infinite; }
        .signature-stage.welcome-anim-0 .signature-letter,
        .signature-stage.welcome-anim-1 .signature-letter,
        .signature-stage.welcome-anim-2 .signature-letter,
        .signature-stage.welcome-anim-3 .signature-letter,
        .signature-stage.welcome-anim-4 .signature-letter,
        .signature-stage.welcome-anim-5 .signature-letter,
        .signature-stage.welcome-anim-6 .signature-letter,
        .signature-stage.welcome-anim-7 .signature-letter { animation:sigLetterTouch 3s ease-in-out infinite; }
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
        .signature-scene .signature-guide { stroke-dasharray:5 5; opacity:.22; }
        /* Rebuilt stickman: the character physically reaches the BEBITO letters with hand, head and foot. */
        @keyframes manHandReach { 0%,18%{transform:translateX(-8px)} 35%{transform:translateX(20px)} 47%{transform:translateX(44px)} 58%{transform:translateX(30px)} 78%,100%{transform:translateX(-8px)} }
        @keyframes manHandHit { 0%,28%{transform:translate(0,0) rotate(0)} 42%{transform:translate(24px,-4px) rotate(-8deg)} 48%{transform:translate(38px,0) rotate(10deg)} 54%{transform:translate(24px,2px) rotate(-5deg)} 72%,100%{transform:translate(0,0) rotate(0)} }
        @keyframes manHeadbutt { 0%,30%{transform:translateX(0)} 45%{transform:translateX(24px)} 52%{transform:translateX(39px)} 59%{transform:translateX(25px)} 78%,100%{transform:translateX(0)} }
        @keyframes manKick { 0%,30%{transform:rotate(0) translateX(0)} 44%{transform:rotate(-8deg) translateX(3px)} 52%{transform:rotate(12deg) translateX(17px)} 62%{transform:rotate(-4deg) translateX(4px)} 80%,100%{transform:rotate(0) translateX(0)} }
        @keyframes manJumpKick { 0%,28%{transform:translate(0,0) rotate(0)} 43%{transform:translate(15px,-16px) rotate(-8deg)} 55%{transform:translate(43px,-12px) rotate(12deg)} 68%{transform:translate(20px,0) rotate(-4deg)} 82%,100%{transform:translate(0,0) rotate(0)} }
        @keyframes manPullHands { 0%,25%{transform:translateX(0)} 48%{transform:translateX(30px)} 62%{transform:translateX(17px)} 80%,100%{transform:translateX(0)} }
        @keyframes manCarryHead { 0%,25%{transform:translateX(-8px)} 45%{transform:translateX(8px)} 58%{transform:translateX(24px)} 75%,100%{transform:translateX(-8px)} }
        @keyframes impactPop { 0%,46%{opacity:0;transform:scale(.2)} 50%{opacity:1;transform:scale(1.25)} 66%{opacity:0;transform:scale(1.8)} 100%{opacity:0} }
        @keyframes letterJolt { 0%,100%{transform:translate(0,0) rotate(0)} 48%{transform:translate(5px,-3px) rotate(5deg)} 56%{transform:translate(-3px,2px) rotate(-4deg)} 65%{transform:translate(0,0) rotate(0)} }
        .stick-action { transform-box:fill-box; transform-origin:center; }
        .stick-action-hand { animation:manHandHit 4.8s cubic-bezier(.2,.8,.2,1) infinite; }
        .stick-action-head { animation:manHeadbutt 4.8s cubic-bezier(.2,.8,.2,1) infinite; }
        .stick-action-foot { animation:manKick 4.8s cubic-bezier(.2,.8,.2,1) infinite; }
        .stick-action-jump { animation:manJumpKick 5s cubic-bezier(.2,.8,.2,1) infinite; }
        .stick-action-pull { animation:manPullHands 4.8s ease-in-out infinite; }
        .stick-action-carry { animation:manCarryHead 5s ease-in-out infinite; }
        .stick-impact { transform-box:fill-box; transform-origin:center; animation:impactPop 4.8s ease-out infinite; }
        .welcome-anim-0 .stick-hand-scene { display:block; }
        .welcome-anim-1 .stick-hand-scene { display:block; }
        .welcome-anim-2 .stick-head-scene { display:block; }
        .welcome-anim-3 .stick-foot-scene { display:block; }
        .welcome-anim-4 .stick-jump-scene { display:block; }
        .welcome-anim-5 .stick-pull-scene { display:block; }
        .welcome-anim-6 .stick-carry-scene { display:block; }
        .welcome-anim-7 .stick-hand-scene { display:block; }
        .welcome-anim-0 .signature-letter:nth-child(5), .welcome-anim-7 .signature-letter:nth-child(9){animation:letterJolt 4.8s ease-in-out infinite;}
        .welcome-anim-1 .signature-letter:nth-child(6){animation:letterJolt 4.8s ease-in-out infinite .18s;}
        .welcome-anim-2 .signature-letter:nth-child(7){animation:letterJolt 4.8s ease-in-out infinite .35s;}
        .welcome-anim-3 .signature-letter:nth-child(8){animation:letterJolt 4.8s ease-in-out infinite .5s;}
        .welcome-anim-4 .signature-letter:nth-child(10){animation:letterJolt 5s ease-in-out infinite .65s;}
        .welcome-anim-5 .signature-letter:nth-child(7){animation:letterJolt 4.8s ease-in-out infinite .3s;}
        .welcome-anim-6 .signature-letter:nth-child(9){animation:letterJolt 5s ease-in-out infinite .45s;}

        .signature-stage { position:relative; display:inline-flex; flex-direction:column; align-items:center; justify-content:flex-end; min-width:290px; min-height:92px; padding-bottom:2px; }

        .welcome-rise { animation: welcomeRise .75s cubic-bezier(.2,.8,.2,1) both; }
        .welcome-glow { animation: welcomeGlow 2.8s ease-in-out infinite; }
        @keyframes signatureShimmer { 0%,100% { opacity:.62; letter-spacing:.34em; transform:scale(.98); } 50% { opacity:1; letter-spacing:.46em; transform:scale(1.02); } }
        .signature-shimmer { animation: signatureShimmer 2.8s ease-in-out infinite; }
      `}</style>

        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#00101f]/80 backdrop-blur-md p-5">
          <div className="w-full max-w-xs rounded-3xl border border-[#C2A378]/30 bg-[#061827]/95 p-6 text-center shadow-[0_20px_80px_rgba(0,0,0,.55)]">
            <div className="mx-auto mb-4 h-12 w-12 rounded-2xl border border-[#C2A378]/40 flex items-center justify-center text-[#C2A378] text-xl font-black">N</div>
            <p className="text-[#C2A378] text-[9px] font-black uppercase tracking-[0.35em]">NILE FLEET</p>
            <h2 className="mt-2 text-white text-xl font-black uppercase italic tracking-tight">{isAr ? 'افتح العرض الكامل' : 'OPEN FULL VIEW'}</h2>
            <button type="button" onClick={requestFullscreen} className="mt-5 w-full rounded-xl bg-[#C2A378] text-[#001F3F] py-3 text-[9px] font-black uppercase tracking-[0.28em] shadow-[0_0_30px_rgba(194,163,120,.2)] active:scale-[.98]">{isAr ? 'فتح ملء الشاشة' : 'OPEN FULL VIEW'}</button>
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
                          <span>B</span><span>E</span><span>B</span><span>I</span><span>T</span><span>O</span>
                        </div>
                        <p className="relative z-10 max-w-xs mx-auto mt-4 text-slate-300 text-[10px] sm:text-xs font-bold leading-relaxed tracking-wide">{welcomeQuote}</p>
                      </div>
                      <button type="button" onClick={enterApp} className="mt-5 px-9 py-3 bg-[#001F3F] hover:bg-[#002b57] border border-[#C2A378]/40 text-white font-black rounded-full uppercase tracking-[0.3em] text-[9px] transition-all active:scale-[0.97] shadow-[0_0_30px_rgba(194,163,120,.12)]">{isAr ? 'دخول إلى النظام' : 'ENTER SYSTEM'}</button>
                      <div className={`mt-3 relative signature-stage welcome-anim-${welcomeStyle}`}>
                        <div className="relative z-10 signature-word text-[9px] sm:text-[10px] font-black uppercase tracking-[0.22em] text-[#C2A378] whitespace-nowrap" aria-label="Powered by Bebito">
                          <span>POWERED</span><span className="signature-letter-space" aria-hidden="true"></span><span className="text-white">BY</span><span className="signature-letter-space" aria-hidden="true"></span>
                          <span className="signature-letter text-[#C2A378]">B</span><span className="signature-letter text-white">E</span><span className="signature-letter text-[#C2A378]">B</span><span className="signature-letter text-white">I</span><span className="signature-letter text-[#C2A378]">T</span><span className="signature-letter text-white">O</span>
                        </div>
                        <div className={`signature-character sig-scene-${welcomeStyle}`} aria-hidden="true">
                          <svg viewBox="0 0 62 72" role="presentation">
                            <g className="sig-body">
                              <g className="sig-contact-head"><circle className="sig-line" cx="31" cy="20" r="7"/><circle className="sig-dot" cx="33.5" cy="19" r="1.2"/></g>
                              <path className="sig-line" d="M31 27 L31 51"/>
                              <g className="sig-contact-hand"><path className="sig-line" d="M31 35 L17 43 L8 35 L3 27"/></g>
                              <path className="sig-line" d="M31 35 L45 40 L54 32"/>
                              <g className="sig-contact-foot"><path className="sig-line" d="M31 51 L20 64 L12 69"/></g>
                              <path className="sig-line" d="M31 51 L42 63 L51 68"/>
                              <circle className="sig-dot" cx="3" cy="27" r="1.8"/>
                              <circle className="sig-contact-pulse" cx="3" cy="27" r="4" fill="none" stroke="#C2A378" stroke-width="1.5"/>
                            </g>
                            <path className="sig-accent" d="M3 69 H59"/>
                            <circle className="sig-dot" cx="57" cy="69" r="1.3"/>
                          </svg>
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
