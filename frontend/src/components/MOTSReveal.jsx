import React from "react";
import { Trophy, X, Download } from "lucide-react";
import { toast } from "sonner";
import { downloadGroupRecap, shareGroupRecap } from "@/lib/recap";

const SEEN_KEY = "fairxi_mots_reveals_seen";
const DEFAULT_THRESHOLDS = [5, 10, 25, 50];

const getSeen = () => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}");
  } catch {
    return {};
  }
};
const markSeen = (groupId, threshold) => {
  const s = getSeen();
  s[`${groupId}:${threshold}`] = new Date().toISOString();
  localStorage.setItem(SEEN_KEY, JSON.stringify(s));
};

/**
 * Decides whether to reveal MOTS for this group right now.
 * Returns the matched threshold number, or null.
 */
export function computeRevealThreshold(playedCount, groupId, thresholds = DEFAULT_THRESHOLDS) {
  if (!groupId) return null;
  const seen = getSeen();
  // Find the largest threshold <= playedCount that hasn't been shown yet.
  const eligible = thresholds
    .filter((t) => playedCount >= t)
    .sort((a, b) => b - a);
  for (const t of eligible) {
    if (!seen[`${groupId}:${t}`]) return t;
  }
  return null;
}

/**
 * Fullscreen slow-reveal splash for the current Man of the Season.
 * Dismissable, non-blocking (renders in a portal-like overlay).
 */
export default function MOTSRevealOverlay({ open, threshold, leader, groupName, groupId, matches, standings, mvp_leaderboard, top_gainers, onClose }) {
  const [stage, setStage] = React.useState(0);

  React.useEffect(() => {
    if (!open) return;
    setStage(0);
    const timers = [
      setTimeout(() => setStage(1), 120),   // logo pop
      setTimeout(() => setStage(2), 700),   // "MOTS" label
      setTimeout(() => setStage(3), 1300),  // trophy
      setTimeout(() => setStage(4), 2000),  // name
      setTimeout(() => setStage(5), 2800),  // stats + actions
    ];
    return () => timers.forEach(clearTimeout);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const dismiss = () => {
    if (groupId && threshold) markSeen(groupId, threshold);
    onClose();
  };

  const downloadShareable = async () => {
    try {
      await downloadGroupRecap({
        group: { name: groupName },
        matches: matches || [],
        standings: standings || [],
        mvp_leaderboard: mvp_leaderboard || [],
        top_gainers: top_gainers || [],
      });
      toast.success("Season snapshot saved");
    } catch { toast.error("Could not generate snapshot"); }
  };
  const shareShareable = async () => {
    try {
      const res = await shareGroupRecap({
        group: { name: groupName },
        matches: matches || [],
        standings: standings || [],
        mvp_leaderboard: mvp_leaderboard || [],
        top_gainers: top_gainers || [],
      });
      toast.success(res === "shared" ? "Shared!" : "Snapshot saved");
    } catch { toast.error("Could not share"); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-5 py-8"
      data-testid="mots-reveal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mots-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        style={{ animation: "motsFadeIn 400ms ease-out both" }}
        onClick={dismiss}
      />

      {/* Rotating pitch circles */}
      <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute rounded-full border border-[#CCFF00]/20"
          style={{
            width: "min(120vmin, 900px)",
            height: "min(120vmin, 900px)",
            left: "50%", top: "50%",
            transform: "translate(-50%, -50%)",
            animation: "motsSpin 30s linear infinite",
          }}
        />
        <div
          className="absolute rounded-full border border-[#CCFF00]/10"
          style={{
            width: "min(60vmin, 500px)",
            height: "min(60vmin, 500px)",
            left: "50%", top: "50%",
            transform: "translate(-50%, -50%)",
            animation: "motsSpin 18s linear infinite reverse",
          }}
        />
      </div>

      {/* Close */}
      <button
        onClick={dismiss}
        data-testid="mots-close"
        aria-label="Dismiss"
        className="tap absolute top-4 right-4 w-11 h-11 inline-flex items-center justify-center rounded-full border border-white/15 text-white/80 hover:text-[#CCFF00] hover:border-[#CCFF00] transition-colors z-10"
      >
        <X size={18} />
      </button>

      {/* Content */}
      <div className="relative max-w-md w-full text-center">
        <div
          className="mb-3 text-[10px] uppercase tracking-[0.35em] text-[#CCFF00]"
          style={{ opacity: stage >= 1 ? 1 : 0, transition: "opacity 400ms" }}
          data-testid="mots-tagline"
        >
          / {threshold} matches played · {groupName}
        </div>

        <div
          style={{
            transform: stage >= 3 ? "scale(1)" : "scale(0.3)",
            opacity: stage >= 3 ? 1 : 0,
            transition: "transform 700ms cubic-bezier(0.2, 1.4, 0.5, 1), opacity 500ms",
          }}
          className="flex justify-center mb-4"
          data-testid="mots-trophy"
        >
          <div className="relative">
            <div className="absolute inset-0 blur-2xl bg-[#CCFF00]/40 rounded-full" />
            <div className="relative w-24 h-24 rounded-full border-2 border-[#CCFF00] bg-[#050A07] flex items-center justify-center">
              <Trophy size={44} className="text-[#CCFF00]" />
            </div>
          </div>
        </div>

        <div
          className="font-display text-lg uppercase tracking-[0.3em] text-white/80 mb-2"
          style={{
            opacity: stage >= 2 ? 1 : 0,
            transform: stage >= 2 ? "translateY(0)" : "translateY(8px)",
            transition: "all 500ms",
          }}
        >
          Man of the Season
        </div>

        {leader ? (
          <>
            <h2
              id="mots-title"
              data-testid="mots-name"
              className="font-display text-6xl sm:text-7xl uppercase text-[#CCFF00] leading-[0.9] mb-3"
              style={{
                opacity: stage >= 4 ? 1 : 0,
                transform: stage >= 4 ? "scale(1)" : "scale(0.92)",
                transition: "all 600ms cubic-bezier(0.2, 1.2, 0.4, 1)",
              }}
            >
              {leader.name}
            </h2>
            <div
              className="text-white/70 text-sm sm:text-base mb-8"
              style={{
                opacity: stage >= 5 ? 1 : 0,
                transform: stage >= 5 ? "translateY(0)" : "translateY(6px)",
                transition: "all 500ms",
              }}
            >
              {leader.mvp_count} MVP awards · {leader.current_rating != null ? `rating ${Number(leader.current_rating).toFixed(2)}` : "top of the pack"}
            </div>
          </>
        ) : (
          <div className="font-display text-4xl uppercase text-white/60 mb-8" data-testid="mots-tbd">
            The trophy is still up for grabs
          </div>
        )}

        <div
          className="flex flex-col sm:flex-row gap-2 justify-center"
          style={{
            opacity: stage >= 5 ? 1 : 0,
            transform: stage >= 5 ? "translateY(0)" : "translateY(10px)",
            transition: "all 500ms 150ms",
          }}
        >
          <button
            onClick={shareShareable}
            data-testid="mots-share"
            className="tap bg-[#CCFF00] text-black font-bold uppercase tracking-widest text-xs px-6 h-12 rounded-full"
          >
            Share Season Snapshot
          </button>
          <button
            onClick={downloadShareable}
            data-testid="mots-download"
            className="tap inline-flex items-center justify-center gap-2 border border-white/25 hover:border-[#CCFF00] hover:text-[#CCFF00] text-xs font-bold uppercase tracking-widest px-4 h-12 rounded-full transition-colors"
          >
            <Download size={12} /> PNG
          </button>
        </div>
      </div>

      <style>{`
        @keyframes motsFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes motsSpin { from { transform: translate(-50%,-50%) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(360deg); } }
      `}</style>
    </div>
  );
}
