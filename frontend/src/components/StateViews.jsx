import React from "react";

/** Consistent glass card placeholder for loading states. Uses tailwind's animate-pulse. */
export const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse bg-white/5 rounded-lg ${className}`} />
);

export const PageLoader = () => (
  <main className="max-w-4xl mx-auto px-5 sm:px-6 py-10 sm:py-12" data-testid="page-loader">
    <Skeleton className="h-4 w-24 mb-3" />
    <Skeleton className="h-14 w-72 mb-4" />
    <Skeleton className="h-4 w-56 mb-8" />
    <div className="space-y-3">
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  </main>
);

export const EmptyState = ({ title, hint, action, testId }) => (
  <div className="glass rounded-xl p-7 sm:p-10 text-center relative overflow-hidden" data-testid={testId || "empty-state"}>
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none opacity-30"
      style={{
        background:
          "radial-gradient(circle at 50% 50%, transparent 60%, rgba(204,255,0,0.06) 60%, transparent 62%)",
      }}
    />
    <div className="relative">
      <div className="font-display text-2xl sm:text-3xl uppercase text-[#CCFF00] leading-tight">{title}</div>
      {hint && <p className="text-white/60 mt-2 text-sm sm:text-base max-w-sm mx-auto">{hint}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  </div>
);
