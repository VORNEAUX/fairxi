import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, teamColors, fmtDate } from "@/lib/api";
import { Logo, PitchCircle, SectionLabel } from "@/components/Motifs";
import { ArrowRight, Trophy, Circle } from "lucide-react";

const StatPill = ({ label, value, testId }) => (
  <div className="glass rounded-2xl px-5 py-4" data-testid={testId}>
    <div className="text-[10px] uppercase tracking-[0.25em] text-white/50">{label}</div>
    <div className="font-display text-3xl mt-1 text-[#CCFF00]">{value}</div>
  </div>
);

const TeamPanel = ({ teamIdx, players }) => {
  const c = teamColors[teamIdx];
  return (
    <div className="team-card-accent rounded-xl p-5" data-testid={`demo-team-${teamIdx + 1}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${c.chip} font-display text-sm`}>{teamIdx + 1}</span>
          <div className="font-display text-xl tracking-widest">{c.name}</div>
        </div>
        <div className="text-xs uppercase tracking-widest text-white/40">{players.length} players</div>
      </div>
      <ul className="space-y-2">
        {players.map((p, i) => (
          <li key={p.id} className="flex items-center justify-between text-sm border-t border-white/5 pt-2" data-testid={`demo-player-${p.id}`}>
            <div className="flex items-center gap-3">
              <span className="text-white/40 font-display text-base w-4">{i + 1}</span>
              <span className="text-white/90">{p.name}</span>
              <span className="text-[10px] text-white/50 uppercase tracking-widest">{p.position?.slice(0, 3)}</span>
            </div>
            <span className="font-display text-lg text-[#CCFF00]">{p.rating}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default function Home() {
  const nav = useNavigate();
  const [demo, setDemo] = useState(null);
  const [mvp, setMvp] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get("/demo");
        const m = await api.get(`/matches/${d.data.match_id}`);
        setDemo({ ...m.data, id: d.data.match_id });
        const r = await api.get(`/matches/${d.data.match_id}/mvp/results`);
        setMvp(r.data);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const groupedTeams = React.useMemo(() => {
    if (!demo) return {};
    const g = {};
    for (const p of demo.players) {
      const t = p.team_number || 0;
      if (!g[t]) g[t] = [];
      g[t].push(p);
    }
    return g;
  }, [demo]);

  return (
    <main className="relative">
      {/* HERO */}
      <section className="relative overflow-hidden stadium-hero pitch-grain">
        <PitchCircle className="w-[520px] h-[520px] -top-40 -right-40 spin-slow" />
        <PitchCircle className="w-[260px] h-[260px] bottom-10 -left-20 spin-slow" />
        <div className="max-w-6xl mx-auto px-5 pt-16 pb-24 relative">
          <SectionLabel testId="hero-tagline">/ For casual football groups</SectionLabel>
          <h1 className="font-display text-6xl sm:text-7xl md:text-8xl leading-[0.9] uppercase max-w-3xl">
            Balanced teams.<br />
            <span className="text-[#CCFF00]">Split the pitch.</span><br />
            Zero drama.
          </h1>
          <p className="mt-6 max-w-xl text-white/70 text-base sm:text-lg font-body">
            Create a match link, let mates join, then auto-generate fair teams and split the pitch cost. Vote for the MVP after the whistle.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => nav("/create")}
              data-testid="hero-create-btn"
              className="inline-flex items-center gap-2 bg-[#CCFF00] text-black font-bold uppercase tracking-widest text-sm px-6 py-4 rounded-full hover:scale-[1.03] transition-transform accent-glow"
            >
              Create a Match <ArrowRight size={16} />
            </button>
            <Link
              to="/history"
              data-testid="hero-history-btn"
              className="inline-flex items-center gap-2 border border-white/25 text-white font-bold uppercase tracking-widest text-sm px-6 py-4 rounded-full hover:border-[#CCFF00] hover:text-[#CCFF00] transition-colors"
            >
              Check Your Stats
            </Link>
          </div>
        </div>
      </section>

      {/* LIVE DEMO */}
      <section className="relative py-16 pitch-lines">
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <SectionLabel testId="demo-label">/ Live Demo</SectionLabel>
              <h2 className="font-display text-4xl sm:text-5xl uppercase">See it in action</h2>
              <p className="text-white/60 max-w-md mt-2">A real match already built. Click through — no signup, no forms.</p>
            </div>
            {demo && (
              <Link
                to={`/m/${demo.id}`}
                data-testid="demo-open-btn"
                className="inline-flex items-center gap-2 border border-[#CCFF00] text-[#CCFF00] font-bold uppercase tracking-widest text-xs px-5 py-3 rounded-full hover:bg-[#CCFF00] hover:text-black transition-colors"
              >
                Open Match Page <ArrowRight size={14} />
              </Link>
            )}
          </div>

          {demo && (
            <div className="grid md:grid-cols-3 gap-5" data-testid="demo-container">
              <div className="glass rounded-xl p-6 md:col-span-1">
                <div className="text-[10px] uppercase tracking-[0.25em] text-white/40 mb-2">{fmtDate(demo.match.date_time)}</div>
                <h3 className="font-display text-3xl uppercase">{demo.match.name}</h3>
                <div className="text-white/60 text-sm mt-1">{demo.match.location}</div>
                <div className="grid grid-cols-3 gap-2 mt-6">
                  <StatPill label="Players" value={demo.players.length} testId="stat-players" />
                  <StatPill label="Cost" value={`$${demo.match.total_cost}`} testId="stat-cost" />
                  <StatPill label="Each" value={`$${demo.share_per_player}`} testId="stat-share" />
                </div>
                {mvp?.mvp && (
                  <div className="mt-6 border-t border-white/10 pt-5">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-white/40">
                      <Trophy size={12} className="text-[#CCFF00]" /> Match MVP
                    </div>
                    <div className="font-display text-4xl mt-2 text-[#CCFF00]">{mvp.mvp.name}</div>
                    <div className="text-white/50 text-xs uppercase tracking-widest mt-1">{mvp.mvp.votes} votes · Team {mvp.mvp.team_number}</div>
                  </div>
                )}
              </div>
              <div className="md:col-span-2 grid sm:grid-cols-2 gap-4">
                {Object.keys(groupedTeams)
                  .sort()
                  .map((t) => (
                    <TeamPanel key={t} teamIdx={parseInt(t) - 1} players={groupedTeams[t]} />
                  ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-16 relative overflow-hidden">
        <PitchCircle className="w-[400px] h-[400px] -bottom-40 left-1/2 -translate-x-1/2 spin-slow" />
        <div className="max-w-6xl mx-auto px-5">
          <SectionLabel testId="how-label">/ Three steps</SectionLabel>
          <h2 className="font-display text-4xl sm:text-5xl uppercase mb-10">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { n: "01", t: "Create the match", d: "Set date, pitch, cost, and how many teams. Get a share link." },
              { n: "02", t: "Mates join", d: "Everyone drops their name, position and self-rating (1–5)." },
              { n: "03", t: "Snake-draft teams", d: "One tap generates balanced sides. Nudge with dropdowns if needed." },
            ].map((s) => (
              <div key={s.n} className="glass rounded-xl p-6" data-testid={`step-${s.n}`}>
                <div className="font-display text-5xl text-[#CCFF00]">{s.n}</div>
                <div className="font-display text-2xl uppercase mt-2">{s.t}</div>
                <p className="text-white/60 mt-2 text-sm">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-5 flex items-center justify-between text-white/40 text-xs uppercase tracking-widest">
          <Logo />
          <span>Built for the beautiful weeknight game</span>
        </div>
      </footer>
    </main>
  );
}
