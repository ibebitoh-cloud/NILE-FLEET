import React, { useEffect, useRef, useState } from 'react';
import TubesCursor from '@/components/ui/tubes-cursor';
import DrawText from '@/components/ui/draw-text';

/**
 * Full-screen welcome shown when the public site opens: a gold lamp switches on and
 * opens slowly, the NF mark and NILE FLEET appear in its light, then the light tubes,
 * tagline and buttons. First visit plays the full intro; later visits play a short one.
 */
const SEEN_KEY = 'nf_intro_seen';

/** Always shown in English, also on the Arabic site (brand screen). */
const WelcomeIntro: React.FC = () => {
  const [open, setOpen] = useState(true);
  const [phase, setPhase] = useState<'' | 'on' | 'open' | 'text' | 'go'>('');
  const [leaving, setLeaving] = useState(false);
  const fast = useRef(false);

  useEffect(() => {
    try { fast.current = localStorage.getItem(SEEN_KEY) === '1'; } catch { /* storage blocked */ }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const steps: Array<[number, typeof phase]> = reduce
      ? [[0, 'go']]
      : fast.current
        ? [[80, 'on'], [160, 'open'], [900, 'text'], [1900, 'go']]
        : [[300, 'on'], [520, ''], [700, 'on'], [1200, 'open'], [5600, 'text'], [8600, 'go']];
    const timers = steps.map(([ms, p]) => window.setTimeout(() => setPhase(p), ms));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => {
      timers.forEach(clearTimeout);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = (then?: () => void) => {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage blocked */ }
    setLeaving(true);
    window.setTimeout(() => {
      document.body.style.overflow = '';
      setOpen(false);
      then?.();
    }, 900);
  };

  if (!open) return null;

  const t = { enter: 'Enter site', quote: 'Request a quote', skip: 'Skip', by: 'Designed & built by' };
  const stage = ['nfw', phase === 'on' && 'nfw-on', ['open', 'text', 'go'].includes(phase) && 'nfw-open', ['text', 'go'].includes(phase) && 'nfw-text', phase === 'go' && 'nfw-go', leaving && 'nfw-leave'].filter(Boolean).join(' ');

  return (
    <div className={stage} style={{ ['--lamp' as string]: fast.current ? '1.2s' : '4.6s' } as React.CSSProperties} role="dialog" aria-modal="true" aria-label="Nile Fleet" dir="ltr">
      <TubesCursor className="nfw-tubes" style={{ position: 'absolute', inset: 0, background: 'transparent' }} />
      <div className="nfw-lamp" aria-hidden="true">
        <div className="nfw-beam nfw-l" /><div className="nfw-beam nfw-r" /><div className="nfw-glow" /><div className="nfw-slab" /><div className="nfw-core" /><div className="nfw-bar" />
      </div>
      <div className="nfw-vignette" aria-hidden="true" />
      <div className="nfw-grain" aria-hidden="true" />

      <button type="button" className="nfw-skip" onClick={() => close()}>{t.skip}</button>

      <div className="nfw-content">
        <div className="nfw-markwrap"><img className="nfw-mark" src="/nf-mark-white.png" alt="Nile Fleet" /><span className="nfw-shine" aria-hidden="true" /></div>
        <h1 className="nfw-word" dir="ltr" aria-label="Nile Fleet">
          <DrawText text="NILE" color="#ffffff" delay={0.5} />
          <DrawText text="FLEET" color="#c2a378" delay={1.42} />
        </h1>
        <p className="nfw-tag" dir="ltr"><span>Transport and logistics</span><span className="nfw-tag-gold">Egypt - UAE</span></p>
      </div>
      <div className="nfw-foot">
        <div className="nfw-actions">
          <button type="button" className="nfw-btn nfw-primary" onClick={() => close()}>
            {t.enter} <span className="nfw-arrow" aria-hidden="true">→</span>
          </button>
          <button type="button" className="nfw-btn nfw-ghost" onClick={() => close(() => document.getElementById('quote')?.scrollIntoView({ behavior: 'smooth' }))}>
            {t.quote} <span className="nfw-arrow" aria-hidden="true">↗</span>
          </button>
        </div>
        <div className="nfw-sig">
          <span>{t.by}</span>
          <img src="/dali/dali-studio-on-dark.png" alt="Dali Studio" />
        </div>
      </div>
    </div>
  );
};

export default WelcomeIntro;
