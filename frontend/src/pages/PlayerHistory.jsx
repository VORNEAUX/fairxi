import React, { useState } from "react";
import { api, fmtDate } from "@/lib/api";
import { SectionLabel } from "@/components/Motifs";
import { toast } from "sonner";
import { Trophy, Star } from "lucide-react";

export default function PlayerHistory() {
  const [phone, setPhone] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async (e) => {
    e.preventDefault();
    if (!phone) return;
    setLoading(true);
    try {
      const res = await api.get(`/history/${encodeURIComponent(phone.trim())}`);
      setData(res.data);
      if (res.data.matches_played === 0) toast("No matches on record for this number");
    } catch (e) {
      toast.error("Lookup failed");
    } finally {
      setLoading(false);
    }
  };

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

      {data && (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-8 sm:mt-10">
            <div className="glass rounded-xl p-4 sm:p-5" data-testid="stat-matches">
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Matches</div>
              <div className="font-display text-4xl sm:text-5xl mt-1 text-[#CCFF00] leading-none">{data.matches_played}</div>
            </div>
            <div className="glass rounded-xl p-4 sm:p-5" data-testid="stat-avg">
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Avg rating</div>
              <div className="font-display text-4xl sm:text-5xl mt-1 text-[#CCFF00] leading-none">{data.average_rating}</div>
            </div>
            <div className="glass rounded-xl p-4 sm:p-5" data-testid="stat-mvp">
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">MVPs</div>
              <div className="font-display text-4xl sm:text-5xl mt-1 text-[#CCFF00] leading-none">{data.mvp_count}</div>
            </div>
          </div>

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
