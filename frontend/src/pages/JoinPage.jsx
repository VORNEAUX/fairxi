import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, fmtDate, teamColors } from "@/lib/api";
import { SectionLabel } from "@/components/Motifs";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";

const POSITIONS = ["Goalkeeper", "Defender", "Midfielder", "Forward"];
const inputCls =
  "w-full bg-[#050A07] border-b border-white/20 focus:border-[#CCFF00] outline-none px-1 py-3 text-lg text-white placeholder:text-white/25 transition-colors";

export default function JoinPage() {
  const { matchId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", position: "Midfielder", rating: 3 });

  const load = async () => {
    try {
      const res = await api.get(`/matches/${matchId}`);
      setData(res.data);
    } catch (e) {
      toast.error("Match not found");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [matchId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) return toast.error("Fill in your name and phone");
    setSubmitting(true);
    try {
      await api.post(`/matches/${matchId}/join`, form);
      toast.success("You're in!");
      setForm({ name: "", phone: "", position: "Midfielder", rating: 3 });
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not join");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-10 text-white/60">Loading...</div>;
  if (!data) return <div className="p-10 text-white/60">Match not found.</div>;

  const { match, players, is_full, share_per_player } = data;
  const teamsShown = match.status !== "open" && players.some((p) => p.team_number);

  const grouped = {};
  for (const p of players) {
    const t = p.team_number || 0;
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(p);
  }

  return (
    <main className="max-w-4xl mx-auto px-5 py-10">
      <SectionLabel testId="join-label">/ Match</SectionLabel>
      <h1 className="font-display text-5xl sm:text-6xl uppercase leading-none" data-testid="match-name">
        {match.name}
      </h1>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-white/60 text-sm">
        <span data-testid="match-datetime">{fmtDate(match.date_time)}</span>
        <span data-testid="match-location">{match.location}</span>
        <span data-testid="match-cost">Cost: ${match.total_cost}</span>
        <span data-testid="match-share">Your share: ${share_per_player}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mt-10">
        <div>
          <SectionLabel testId="squad-label">/ The Squad · {players.length}/{match.max_players}</SectionLabel>
          {teamsShown ? (
            <div className="space-y-4" data-testid="teams-container">
              {Object.keys(grouped).sort().map((t) => (
                <div key={t} className="team-card-accent rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full font-display text-sm ${teamColors[t - 1].chip}`}>{t}</span>
                    <span className="font-display text-lg uppercase tracking-widest">Team {t}</span>
                  </div>
                  <ul className="space-y-1">
                    {grouped[t].map((p) => (
                      <li key={p.id} className="flex items-center justify-between text-sm border-t border-white/5 pt-1.5">
                        <span>{p.name}</span>
                        <span className="text-[10px] text-white/50 uppercase tracking-widest">{p.position}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : players.length === 0 ? (
            <div className="text-white/40 italic">No one joined yet. Be the first.</div>
          ) : (
            <ul className="space-y-2" data-testid="players-list">
              {players.map((p) => (
                <li key={p.id} className="glass rounded-lg px-4 py-3 flex items-center justify-between">
                  <span className="text-white/90">{p.name}</span>
                  <span className="text-[10px] uppercase tracking-widest text-white/50">{p.position}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <SectionLabel testId="join-form-label">/ Join</SectionLabel>
          {is_full ? (
            <div className="glass rounded-xl p-6 border border-[#CCFF00]/40" data-testid="waitlist-message">
              <div className="font-display text-3xl text-[#CCFF00]">Match is full.</div>
              <p className="text-white/60 mt-2">Ask the organizer to add you to the waitlist. If someone drops out, you're in.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="glass rounded-xl p-6" data-testid="join-form">
              <div className="mb-5">
                <label className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#CCFF00]">Name</label>
                <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="join-name" />
              </div>
              <div className="mb-5">
                <label className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#CCFF00]">Phone number</label>
                <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="join-phone" />
              </div>
              <div className="mb-5">
                <label className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#CCFF00]">Preferred position</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {POSITIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setForm({ ...form, position: p })}
                      data-testid={`pos-${p}`}
                      className={`py-3 border text-sm uppercase tracking-widest font-semibold transition-colors ${
                        form.position === p ? "border-[#CCFF00] text-[#CCFF00] bg-[#CCFF00]/5" : "border-white/15 text-white/60 hover:border-white/40"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-6">
                <label className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#CCFF00]">
                  Self-rating <span className="text-[#CCFF00] font-display text-2xl align-middle ml-2" data-testid="rating-value">{form.rating}</span>
                </label>
                <div className="mt-3 px-1">
                  <Slider
                    value={[form.rating]}
                    onValueChange={(v) => setForm({ ...form, rating: v[0] })}
                    min={1}
                    max={5}
                    step={1}
                    data-testid="rating-slider"
                  />
                  <div className="flex justify-between text-[10px] text-white/40 uppercase tracking-widest mt-2">
                    <span>Sunday league</span>
                    <span>Prime</span>
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                data-testid="submit-join"
                className="w-full bg-[#CCFF00] text-black font-bold uppercase tracking-[0.2em] px-6 py-4 rounded-full hover:scale-[1.02] transition-transform disabled:opacity-50"
              >
                {submitting ? "Joining..." : "Confirm Join →"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
