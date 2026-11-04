import React from 'react';

/**
 * Creator signature: "NILE FLEET", then "Powered by / D DALI STUDIO / Ideas into digital / Mohamed Alaa · phone".
 * tone = the background it sits on ('dark' uses the white-text logo, 'light' the dark-text one).
 * variant: 'page' (end of every screen), 'paper' (printed documents), 'popup' (compact, bottom of a modal overlay).
 */
type Props = {
  tone?: 'dark' | 'light';
  variant?: 'page' | 'paper' | 'popup';
  className?: string;
  /** Show the "NILE FLEET" line above the logo (off when the page already ends on the Nile Fleet wordmark). */
  brand?: boolean;
};

export const DALI_LOGO = { dark: '/dali/dali-studio-on-dark.png', light: '/dali/dali-studio-on-light.png' };
export const DALI_MARK = '/dali/dali-mark.png';
export const DALI_CREATOR = { name: 'Mohamed Alaa', phone: '+20 114 647 5759' };

const DaliSignature: React.FC<Props> = ({ tone = 'dark', variant = 'page', className = '', brand = true }) => {
  const ink = tone === 'dark' ? 'text-white/70' : 'text-[#26231f]/70';
  const muted = tone === 'dark' ? 'text-white/55' : 'text-[#6f6a63]';
  const studio = tone === 'dark' ? 'text-white' : 'text-[#111111]';

  if (variant === 'popup') {
    return (
      <div className={`dali-signature dali-popup print:hidden pointer-events-none absolute inset-x-0 bottom-2 z-[1] flex items-center justify-center gap-2 opacity-70 ${className}`} dir="ltr" aria-hidden="true">
        <span className="text-[7px] font-black uppercase tracking-[.35em] text-white/70">NILE FLEET</span>
        <span className="h-3 w-px bg-white/25" />
        <span className="text-[6px] font-bold uppercase tracking-[.3em] text-white/45">Powered by</span>
        <img src={DALI_MARK} alt="" className="h-3.5 w-auto" />
        <span className="text-[7px] font-black uppercase tracking-[.35em] text-[#C2A378]">DALI STUDIO</span>
      </div>
    );
  }

  const paper = variant === 'paper';
  return (
    <div className={`dali-signature flex flex-col items-center text-center ${paper ? 'gap-1.5' : 'gap-2'} ${className}`} dir="ltr">
      <div className="h-px w-14 bg-gradient-to-r from-transparent via-[#C2A378] to-transparent" />
      {brand && <p className={`text-[9px] font-black uppercase tracking-[.5em] ${ink}`}>NILE FLEET</p>}
      <div className={`flex flex-col items-center ${paper ? 'gap-1' : 'gap-1.5'}`} aria-label="Powered by Dali Studio. Ideas into digital. Mohamed Alaa, +20 114 647 5759">
        <span className={`text-[8px] font-bold uppercase tracking-[.38em] ${muted}`}>Powered by</span>
        <span className={`flex items-center gap-2 font-black uppercase tracking-[.22em] ${paper ? 'text-[13px]' : 'text-[15px]'}`}>
          <img src={DALI_MARK} alt="" className={paper ? 'h-4 w-auto' : 'h-[18px] w-auto'} loading="lazy" />
          <span className="text-[#C2A378]">Dali</span>
          <span className={studio}>Studio</span>
        </span>
        <span className={`text-[8px] font-semibold uppercase tracking-[.32em] ${muted}`}>Ideas into digital</span>
        <span className={`text-[8px] font-bold uppercase tracking-[.24em] ${muted}`}>{DALI_CREATOR.name} · {DALI_CREATOR.phone}</span>
      </div>
    </div>
  );
};

export default DaliSignature;
