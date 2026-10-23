import React from 'react';
import { DALI_MARK } from './DaliSignature';

/** Loading indicator: the Dali Studio "D" mark spinning fast. */
type Props = {
  size?: number;
  label?: React.ReactNode;
  className?: string;
  fullScreen?: boolean;
};

const DaliLoader: React.FC<Props> = ({ size = 56, label, className = '', fullScreen = false }) => {
  const body = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`} role="status" aria-live="polite">
      <img
        src={DALI_MARK}
        alt=""
        width={size}
        height={size}
        className="dali-spin select-none object-contain drop-shadow-[0_0_18px_rgba(194,163,120,.35)]"
        style={{ width: size, height: size }}
        draggable={false}
      />
      {label ? <div className="text-center">{label}</div> : <span className="sr-only">Loading</span>}
    </div>
  );
  return fullScreen ? <div className="flex min-h-[50vh] w-full items-center justify-center">{body}</div> : body;
};

export default DaliLoader;
