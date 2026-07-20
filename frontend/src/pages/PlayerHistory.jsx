import React, { useState } from "react";
import { api, fmtDate } from "@/lib/api";
import { SectionLabel } from "@/components/Motifs";
import { EmptyState } from "@/components/StateViews";
import { toast } from "sonner";
import { Trophy, Star } from "lucide-react";

const RatingSparkline = ({ points }) => {
  if (!points || points.length === 0) return null;
  const W = 320;
  const H = 60;
  const min = Math.min(...points, 1);
  const max = Math.max(...points, 5);
  const range = Math.max(0.5, max - min);
  const step = W / Math.max(1, points.length - 1);
  const coords = points.map((v, i) => [i * step, H - ((v - min) / range) * H]);
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" aria-hidden>
      <path d={path} fill="none" stroke="#CCFF00" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="#CCFF00" />
    </svg>
  );
};

export default function PlayerHistory() {
  const [phone, setPhone] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async (e) => {
    e.preventDefault();
    const p = phone.trim();
    if (!p) return toast.error("Enter a phone number to look up");
    setLoading(true);
    setSearched(true);
    try {
      const [hist, trend] = await Promise.all([
        api.get(`/history/${encodeURIComponent(p)}`),
        api.get(`/players/${encodeURIComponent(p)}/rating-history`).catch(() => ({ data: null })),
      ]);
      setData({ ...hist.data, dynamic: trend.data });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Lookup failed. Try again in a moment.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const noResults = searched && !loading && data && data.matches_played === 0;

  return (
    <main className="max-w-3xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
      <SectionLabel testId="history-label">/ Player history</SectionLabel>
      <h1 className="font-display text-[3rem] sm:text-6xl uppercase leading-[0.95]">
        Your <span className="text-[#CCFF00]">stat line.</span>
      </h1>
      <p className="text-white/60 mt-3 text-sm sm:text-base">Enter a phone number to pull the record across every FairXI match.</p>

      <form onSubmit={search} className="mt-7 sm:mt-8 flex gap-3" data-testid="history-form">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          data-testid="history-phone"
          className="flex-1 min-w-0 bg-[#050A07] border-b border-white/20 focus:border-[#CCFF00] outline-none px-1 py-3 text-lg text-white placeholder:text-white/25 transition-colors"
        />
        <button
          type="submit"
          disabled={loading}
          data-testid="history-search"
          className="tap bg-[#CCFF00] text-black font-bold uppercase tracking-[0.2em] px-6 py-3 rounded-full hover:scale-[1.02] transition-transform"
        >
          {loading ? "..." : "Search"}
        </button>
      </form>

      {noResults && (
        <div className="mt-8 sm:mt-10">
          <EmptyState
            testId="history-empty"
            title="No match record yet"
            hint="This phone number hasn't played a FairXI match. Join one, then come back to see your stats."
          />
        </div>
      )}

      {data && data.matches_played > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-8 sm:mt-10">
            <div className="glass rounded-xl p-4 sm:p-5" data-testid="stat-matches">
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Matches</div>
              <div className="font-display text-4xl sm:text-5xl mt-1 text-[#CCFF00] leading-none">{data.matches_played}</div>
            </div>
            <div className="glass rounded-xl p-4 sm:p-5" data-testid="stat-avg">
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">
                {data.dynamic?.current_rating != null ? "Rating" : "Avg rating"}
              </div>
              <div className="font-display text-4xl sm:text-5xl mt-1 text-[#CCFF00] leading-none">
                {data.dynamic?.current_rating != null
                  ? Number(data.dynamic.current_rating).toFixed(2)
                  : data.average_rating}
              </div>
            </div>
            <div className="glass rounded-xl p-4 sm:p-5" data-testid="stat-mvp">
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">MVPs</div>
              <div className="font-display text-4xl sm:text-5xl mt-1 text-[#CCFF00] leading-none">{data.mvp_count}</div>
            </div>
          </div>

          {data.dynamic?.history?.length > 1 && (
            <div className="glass rounded-xl p-5 sm:p-6 mt-4 sm:mt-5" data-testid="rating-trend">
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>/ Rating trend</SectionLabel>
                <span className="text-[10px] uppercase tracking-widest text-white/40">last {data.dynamic.history.length}</span>
              </div>
              <RatingSparkline points={data.dynamic.history.map((h) => h.new_rating)} />
            </div>
          )}

          {data.name && (
            <div className="mt-6 text-white/60 text-sm">
              Records for <span className="text-white font-semibold">{data.name}</span>
            </div>
          )}

          <ul className="mt-6 space-y-2" data-testid="history-matches">
            {data.matches.map((m) => (
              <li key={m.match_id} className="glass rounded-lg px-4 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-white/90 truncate">{m.match_name}</div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40 mt-0.5">{fmtDate(m.date_time)}</div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 text-xs shrink-0">
                  <span className="flex items-center gap-1 text-white/70"><Star size={12} className="text-[#CCFF00]" /> {m.rating}</span>
                  {m.was_mvp && (
                    <span className="flex items-center gap-1 text-[#CCFF00] uppercase tracking-widest font-bold"><Trophy size={12} /> MVP</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
