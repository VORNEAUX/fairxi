import React from "react";

export const PitchCircle = ({ className = "" }) => (
  <div
    aria-hidden
    className={`pointer-events-none absolute rounded-full border border-white/10 ${className}`}
  />
);

export const Logo = ({ className = "" }) => (
  <div className={`inline-flex items-center gap-2 ${className}`} data-testid="fairxi-logo">
    <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
      <rect x="1" y="1" width="38" height="38" rx="2" stroke="#CCFF00" strokeWidth="1.5" />
      <line x1="20" y1="1" x2="20" y2="39" stroke="#CCFF00" strokeWidth="1" />
      <circle cx="20" cy="20" r="6" stroke="#CCFF00" strokeWidth="1.2" />
      <circle cx="20" cy="20" r="1.5" fill="#CCFF00" />
    </svg>
    <span className="font-display text-2xl tracking-widest">FAIR<span className="text-[#CCFF00]">XI</span></span>
  </div>
);

export const SectionLabel = ({ children, testId }) => (
  <div
    className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#CCFF00] mb-3"
    data-testid={testId}
  >
    <span className="inline-block w-6 h-px bg-[#CCFF00] align-middle mr-2" />
    {children}
  </div>
);
