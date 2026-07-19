import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, teamColors } from "@/lib/api";
import { SectionLabel } from "@/components/Motifs";
import { toast } from "sonner";
import { Trophy, Download } from "lucide-react";
import { downloadRecap, shareRecap } from "@/lib/recap";

export default function MVPVoting() {
  const { matchId } = useParams();
  const [phone, setPhone] = useState("");
  const [voter, setVoter] = useState(null);
  const [match, setMatch] = useState(null);
  const [players, setPlayers] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voted, setVoted] = useState(false);

  const loadMatch = async () => {
    try {
      const res = await api.get(`/matches/${matchId}`);
      setMatch(res.data.match);
      setPlayers(res.data.players);
      const r = await api.get(`/matches/${matchId}/mvp/results`);
      setResults(r.data);
    } catch (e) {
      toast.error("Match not found");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMatch(); }, [matchId]);
  useEffect(() => {
    const i = setInterval(async () => {
      try {
        const r = await api.get(`/matches/${matchId}/mvp/results`);
        setResults(r.data);
      } catch {}
    }, 5000);
    return () => clearInterval(i);
  }, [matchId]);

  const verify = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/matches/${matchId}/mvp/verify`, { phone: phone.trim() });
      setVoter({ ...res.data, phone: phone.trim() });
    } catch (err) {
      toast.error(err.response?.data?.detail || "This phone didn't play in this match");
    }
  };

  const castVote = async (targetId) => {
    try {
      await api.post(`/matches/${matchId}/mvp/vote`, {
        voter_phone: voter.phone,
        vote_for_player_id: targetId,
      });
      toast.success("Vote counted!");
      setVoted(true);
      const r = await api.get(`/matches/${matchId}/mvp/results`);
      setResults(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Vote failed");
    }
  };

  if (loading) return <div className="p-10 text-white/60">Loading...</div>;
  if (!match) return <div className="p-10 text-white/60">Match not found.</div>;

  const votingClosed = results?.voting_closed;
  const votingOpen = match.status === "mvp_voting_open" && !votingClosed;

  const teammates = voter
    ? players.filter((p) => p.team_number === voter.team_number && p.id !== voter.id)
    : [];

  const maxVotes = Math.max(1, ...(results?.results || []).map((r) => r.votes));

  return (
    <main className="max-w-4xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
      <SectionLabel testId="vote-label">/ MVP Vote</SectionLabel>
      <h1 className="font-display text-[3rem] sm:text-6xl uppercase leading-[0.95]">
        Who ran <span className="text-[#CCFF00]">the show?</span>
      </h1>
      <p className="text-white/60 mt-3 text-sm sm:text-base">Vote for one teammate. One vote per player. Auto-closes 24h after opening.</p>

      {!votingOpen && (
        <div className="glass rounded-xl p-5 mt-6 border border-[#CCFF00]/30" data-testid="voting-status">
          <div className="text-[10px] uppercase tracking-[0.25em] text-white/50">Voting</div>
          <div className="font-display text-3xl mt-1 text-[#CCFF00]">
            {match.status === "mvp_voting_open" ? "Closed (24h elapsed)" : "Not yet opened by organizer"}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 sm:gap-8 mt-8 sm:mt-10">
        {/* LEFT: Vote form */}
        <div>
          {votingOpen && !voter && (
            <form onSubmit={verify} className="glass rounded-xl p-6" data-testid="verify-form">
              <SectionLabel>/ Verify you played</SectionLabel>
              <label className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#CCFF00]">Your phone number</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="voter-phone"
                className="w-full bg-[#050A07] border-b border-white/20 focus:border-[#CCFF00] outline-none px-1 py-3 text-lg text-white placeholder:text-white/25 transition-colors"
              />
              <button
                type="submit"
                data-testid="verify-btn"
                className="tap mt-6 w-full bg-[#CCFF00] text-black font-bold uppercase tracking-[0.2em] px-6 py-4 rounded-full hover:scale-[1.02] transition-transform"
              >
                Continue →
              </button>
            </form>
          )}

          {votingOpen && voter && !voted && (
            <div className="glass rounded-xl p-6" data-testid="teammate-picker">
              <SectionLabel>/ Pick your MVP (from Team {voter.team_number})</SectionLabel>
              <ul className="space-y-2">
                {teammates.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => castVote(t.id)}
                      data-testid={`vote-${t.id}`}
                      className="tap w-full flex items-center justify-between px-4 py-4 border border-white/15 rounded-lg hover:border-[#CCFF00] hover:text-[#CCFF00] transition-colors"
                    >
                      <span>{t.name}</span>
                      <span className="text-[10px] uppercase tracking-widest text-white/40">{t.position}</span>
                    </button>
                  </li>
                ))}
                {teammates.length === 0 && (
                  <li className="text-white/40 italic">No teammates to vote for.</li>
                )}
              </ul>
            </div>
          )}

          {voted && (
            <div className="glass rounded-xl p-6 text-center" data-testid="voted-message">
              <div className="checkmark-pop inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#CCFF00] text-black mb-3">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="font-display text-3xl text-[#CCFF00]">Vote in.</div>
              <p className="text-white/60 mt-2">Results update in real time on the right.</p>
            </div>
          )}
        </div>

        {/* RIGHT: Results */}
        <div>
          <SectionLabel testId="results-label">/ Live Results</SectionLabel>
          {results?.mvp && (
            <div className="glass rounded-xl p-5 border border-[#CCFF00]/40 mb-4" data-testid="mvp-card">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-white/50">
                <Trophy size={12} className="text-[#CCFF00]" /> Current MVP
              </div>
              <div className="font-display text-4xl mt-1 text-[#CCFF00]">{results.mvp.name}</div>
              <div className="text-white/50 text-xs uppercase tracking-widest">{results.mvp.votes} votes · Team {results.mvp.team_number}</div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      const res = await shareRecap({ match, players, mvp: results.mvp });
                      toast.success(res === "shared" ? "Shared!" : "Recap saved");
                    } catch { toast.error("Failed"); }
                  }}
                  data-testid="share-recap-mvp"
                  className="flex-1 bg-[#CCFF00] text-black text-[10px] font-bold uppercase tracking-widest py-2 rounded-full hover:scale-[1.02] transition-transform"
                >
                  Share Recap
                </button>
                <button
                  onClick={async () => {
                    try {
                      await downloadRecap({ match, players, mvp: results.mvp });
                      toast.success("Downloaded");
                    } catch { toast.error("Failed"); }
                  }}
                  data-testid="download-recap-mvp"
                  className="inline-flex items-center gap-1 border border-white/20 hover:border-[#CCFF00] hover:text-[#CCFF00] text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-full transition-colors"
                >
                  <Download size={10} /> PNG
                </button>
              </div>
            </div>
          )}
          <ul className="space-y-2" data-testid="results-list">
            {(results?.results || []).map((r) => {
              const pct = (r.votes / maxVotes) * 100;
              const c = r.team_number ? teamColors[r.team_number - 1] : teamColors[0];
              return (
                <li key={r.player_id} className="relative overflow-hidden glass rounded-lg px-4 py-3">
                  <div
                    className="absolute inset-y-0 left-0 bg-[#CCFF00]/10"
                    style={{ width: `${pct}%` }}
                  />
                  <div className="relative flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex w-5 h-5 items-center justify-center rounded-full font-display text-[10px] ${c.chip}`}>{r.team_number || "-"}</span>
                      <span>{r.name}</span>
                    </div>
                    <span className="font-display text-xl text-[#CCFF00]">{r.votes}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </main>
  );
}
