import React from "react";
import { Link, useParams } from "react-router-dom";
import { api, fmtDate } from "@/lib/api";
import { SectionLabel } from "@/components/Motifs";
import { EmptyState } from "@/components/StateViews";
import MOTSRevealOverlay, { computeRevealThreshold } from "@/components/MOTSReveal";
import { toast } from "sonner";
import { ArrowRight, Trophy, Plus, Download } from "lucide-react";
import { downloadGroupRecap, shareGroupRecap } from "@/lib/recap";

const RatingChip = ({ value }) => (
  <span className="font-display text-lg text-[#CCFF00] leading-none">
    {value != null ? Number(value).toFixed(2) : "—"}
  </span>
);

const GainChip = ({ value }) => {
  const v = Number(value || 0);
  const positive = v > 0;
  const zero = v === 0;
  return (
    <span
      className={`font-display text-lg leading-none ${
        zero ? "text-white/50" : positive ? "text-[#CCFF00]" : "text-red-400"
      }`}
    >
      {positive ? "+" : ""}{v.toFixed(2)}
    </span>
  );
};

export default function GroupDashboard() {
  const { groupId, adminToken } = useParams();
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [motsReveal, setMotsReveal] = React.useState({ open: false, threshold: null });

  const load = async () => {
    try {
      const res = await api.get(`/groups/${groupId}/admin/${adminToken}`);
      setData(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Access denied");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { load(); }, [groupId, adminToken]);

  // MOTS trophy reveal trigger — once per group per threshold crossing.
  React.useEffect(() => {
    if (!data) return;
    const playedCount = data.matches.filter(
      (m) => m.status === "played" || m.status === "completed" || m.status === "mvp_voting_open",
    ).length;
    const threshold = computeRevealThreshold(playedCount, groupId);
    if (threshold != null) {
      // Slight delay so the dashboard renders first, feels like an event.
      const t = setTimeout(() => setMotsReveal({ open: true, threshold }), 600);
      return () => clearTimeout(t);
    }
  }, [data, groupId]);

  if (loading) return <div className="p-10 text-white/60">Loading...</div>;
  if (!data) return <div className="p-10 text-white/60">Group not found.</div>;

  const { group, matches, standings, mvp_leaderboard, top_gainers } = data;
  const playedMatches = matches.filter((m) => m.status === "played" || m.status === "completed" || m.status === "mvp_voting_open");

  const doDownloadRecap = async () => {
    try {
      await downloadGroupRecap({ group, matches, standings, mvp_leaderboard, top_gainers });
      toast.success("Season recap downloaded");
    } catch { toast.error("Could not generate recap"); }
  };
  const doShareRecap = async () => {
    try {
      const res = await shareGroupRecap({ group, matches, standings, mvp_leaderboard, top_gainers });
      toast.success(res === "shared" ? "Shared!" : "Recap saved");
    } catch { toast.error("Could not share"); }
  };

  return (
    <main className="max-w-6xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
      <SectionLabel testId="group-label">/ Group</SectionLabel>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[3rem] sm:text-6xl uppercase leading-[0.95]" data-testid="group-name">{group.name}</h1>
        <div className="flex gap-2">
          <Link
            to={`/group/${groupId}/${adminToken}/new-match`}
            data-testid="new-group-match"
            className="tap inline-flex items-center gap-2 bg-[#CCFF00] text-black font-bold uppercase tracking-widest text-xs px-4 h-11 rounded-full"
          >
            <Plus size={12} /> New Match
          </Link>
        </div>
      </div>
      <p className="text-white/60 mt-3 text-sm">
        {playedMatches.length} played · {matches.length} total · {standings.length} players tracked
      </p>

      <div className="grid md:grid-cols-3 gap-5 sm:gap-6 mt-8 sm:mt-10">
        {/* STANDINGS */}
        <section className="md:col-span-2 glass rounded-xl p-5 sm:p-6" data-testid="standings-panel">
          <SectionLabel>/ Standings</SectionLabel>
          {standings.length === 0 ? (
            <EmptyState
              testId="group-standings-empty"
              title="No matches played yet"
              hint="Create a match, mark it played, and standings will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-white/50">
                    <th className="text-left py-2 w-6">#</th>
                    <th className="text-left py-2">Player</th>
                    <th className="text-right py-2 px-1">M</th>
                    <th className="text-right py-2 px-1">W</th>
                    <th className="text-right py-2 px-1">D</th>
                    <th className="text-right py-2 px-1">L</th>
                    <th className="text-right py-2 pl-2">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => (
                    <tr key={s.phone} className="border-t border-white/5" data-testid={`standing-row-${s.phone}`}>
                      <td className="py-2.5 text-white/40 font-display">{i + 1}</td>
                      <td className="py-2.5 text-white/90 truncate max-w-[8rem]">{s.name}</td>
                      <td className="py-2.5 text-right text-white/70">{s.matches}</td>
                      <td className="py-2.5 text-right text-[#CCFF00]">{s.wins}</td>
                      <td className="py-2.5 text-right text-white/60">{s.draws}</td>
                      <td className="py-2.5 text-right text-white/40">{s.losses}</td>
                      <td className="py-2.5 text-right"><RatingChip value={s.current_rating} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* SIDE */}
        <div className="space-y-5 sm:space-y-6">
          <section className="glass rounded-xl p-5 sm:p-6" data-testid="mvp-leaderboard-panel">
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={14} className="text-[#CCFF00]" />
              <SectionLabel>/ MOTS Leaderboard</SectionLabel>
            </div>
            {mvp_leaderboard.filter((r) => r.mvp_count > 0).length === 0 ? (
              <p className="text-white/40 text-sm italic">No MVPs crowned yet.</p>
            ) : (
              <ol className="space-y-1.5">
                {mvp_leaderboard.filter((r) => r.mvp_count > 0).map((r, i) => (
                  <li key={r.phone} className="flex items-center justify-between text-sm" data-testid={`mvp-row-${r.phone}`}>
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="font-display text-white/40 w-4">{i + 1}</span>
                      <span className="truncate">{r.name}</span>
                    </span>
                    <span className="font-display text-lg text-[#CCFF00]">{r.mvp_count}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="glass rounded-xl p-5 sm:p-6" data-testid="top-gainers-panel">
            <SectionLabel>/ Top rating gainers</SectionLabel>
            {top_gainers.length === 0 ? (
              <p className="text-white/40 text-sm italic">Rating history will appear after matches are played.</p>
            ) : (
              <ul className="space-y-1.5">
                {top_gainers.map((g) => (
                  <li key={g.phone} className="flex items-center justify-between text-sm">
                    <span className="truncate">{g.name}</span>
                    <GainChip value={g.gain} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="glass rounded-xl p-5 sm:p-6" data-testid="season-recap-panel">
            <SectionLabel>/ Season recap card</SectionLabel>
            <p className="text-white/50 text-xs mb-3">Share a portrait PNG summarising this group's season.</p>
            <button
              onClick={doShareRecap}
              data-testid="share-season-recap"
              className="tap w-full mb-2 bg-[#CCFF00] text-black text-xs font-bold uppercase tracking-widest py-3 rounded-full hover:scale-[1.02] transition-transform"
            >
              Share Season Recap
            </button>
            <button
              onClick={doDownloadRecap}
              data-testid="download-season-recap"
              className="tap w-full inline-flex items-center justify-center gap-2 border border-white/20 hover:border-[#CCFF00] hover:text-[#CCFF00] text-xs font-bold uppercase tracking-widest py-3 rounded-full transition-colors"
            >
              <Download size={12} /> Download PNG
            </button>
          </section>
        </div>
      </div>

      {/* MATCHES */}
      <section className="mt-8 sm:mt-10">
        <SectionLabel>/ Matches ({matches.length})</SectionLabel>
        {matches.length === 0 ? (
          <EmptyState
            testId="group-matches-empty"
            title="First fixture up next"
            hint="Set up a match with the button above — it'll live in this group and feed the standings."
          />
        ) : (
          <ul className="space-y-2" data-testid="group-matches-list">
            {matches.map((m) => (
              <li key={m.id} className="glass rounded-lg p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-display text-xl uppercase truncate">{m.name}</div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40 mt-1">
                    {fmtDate(m.date_time)} · {m.location} · <span className="text-[#CCFF00]">{m.status.replace("_", " ")}</span>
                    {m.winning_team != null && <span> · Team {m.winning_team} won</span>}
                    {m.winning_team == null && (m.status === "played" || m.status === "completed") && <span> · Draw</span>}
                  </div>
                </div>
                <Link
                  to={`/admin/${m.id}/${m.admin_token}`}
                  className="tap inline-flex items-center gap-2 border border-[#CCFF00] text-[#CCFF00] font-bold uppercase tracking-widest text-xs px-4 h-10 rounded-full hover:bg-[#CCFF00] hover:text-black transition-colors whitespace-nowrap"
                >
                  Admin <ArrowRight size={12} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <MOTSRevealOverlay
        open={motsReveal.open}
        threshold={motsReveal.threshold}
        leader={(mvp_leaderboard || []).find((r) => r.mvp_count > 0)}
        groupName={group.name}
        groupId={groupId}
        matches={matches}
        standings={standings}
        mvp_leaderboard={mvp_leaderboard}
        top_gainers={top_gainers}
        onClose={() => setMotsReveal({ open: false, threshold: null })}
      />
    </main>
  );
}
