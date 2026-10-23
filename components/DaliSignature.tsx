import React from 'react';

/**
 * Creator signature: "NILE FLEET" with the Dali Studio logo under it.
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

const DaliSignature: React.FC<Props> = ({ tone = 'dark', variant = 'page', className = '', brand = true }) => {
  const ink = tone === 'dark' ? 'text-white/70' : 'text-[#26231f]/70';

  if (variant === 'popup') {
    return (
      <div className={`dali-signature dali-popup print:hidden pointer-events-none absolute inset-x-0 bottom-2 z-[1] flex items-center justify-center gap-2 opacity-70 ${className}`} dir="ltr" aria-hidden="true">
        <span className="text-[7px] font-black uppercase tracking-[.35em] text-white/70">NILE FLEET</span>
        <span className="h-3 w-px bg-white/25" />
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
      <img
        src={DALI_LOGO[tone]}
        alt="Dali Studio"
        className={paper ? 'h-16 w-auto' : 'h-20 w-auto'}
        loading="lazy"
      />
    </div>
  );
};

export default DaliSignature;
