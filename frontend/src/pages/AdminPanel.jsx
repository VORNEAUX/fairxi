import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, fmtDate, teamColors } from "@/lib/api";
import { SectionLabel } from "@/components/Motifs";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Save, Users, Download, Send, Wallet } from "lucide-react";
import { getSavedSquad, saveSquad } from "@/lib/storage";
import { downloadRecap, shareRecap } from "@/lib/recap";
import { buildBroadcastMessage, openWhatsAppBroadcast, PAY_PROVIDERS, getPayPrefs, setPayPrefs } from "@/lib/broadcast";
import { openExternal } from "@/lib/openLink";

const PaymentDeepLink = ({ share, matchName }) => {
  const [prefs, setPrefsState] = React.useState(() => getPayPrefs());
  const [provider, setProvider] = React.useState(prefs.provider || "");
  const [handle, setHandle] = React.useState(prefs.handle || "");
  const [open, setOpen] = React.useState(!!(prefs.provider && prefs.handle));

  const save = () => {
    const next = { provider, handle };
    setPayPrefs(next);
    setPrefsState(next);
    toast.success("Payment handle saved");
  };

  const link = provider && handle && PAY_PROVIDERS[provider]
    ? PAY_PROVIDERS[provider].build(handle, Number(share || 0).toFixed(2), matchName)
    : null;

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Payment link copied");
    } catch {
      toast.error("Copy failed — long-press the link instead");
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        data-testid="enable-pay-link"
        className="tap w-full mb-3 border border-white/15 hover:border-[#CCFF00] hover:text-[#CCFF00] text-[10px] font-bold uppercase tracking-widest py-2.5 rounded-full transition-colors"
      >
        + Add payment link
      </button>
    );
  }

  return (
    <div className="mb-4 border border-white/10 rounded-lg p-3" data-testid="pay-link-panel">
      <div className="text-[10px] uppercase tracking-widest text-white/50 mb-2">Payment deep-link</div>
      <div className="flex gap-2 mb-2">
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger className="flex-1 bg-[#050A07] border-white/20 text-xs" data-testid="pay-provider-select">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent className="bg-[#0C1812] border-white/10">
            {Object.values(PAY_PROVIDERS).map((p) => (
              <SelectItem key={p.id} value={p.id} data-testid={`pay-provider-${p.id}`}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <input
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        placeholder={provider ? PAY_PROVIDERS[provider]?.hint : "Enter your handle"}
        data-testid="pay-handle-input"
        className="w-full bg-[#050A07] border-b border-white/20 focus:border-[#CCFF00] outline-none px-1 py-2 text-sm text-white placeholder:text-white/25 mb-2"
      />
      <div className="flex gap-2">
        <button onClick={save} data-testid="pay-save-btn"
          className="tap flex-1 border border-white/20 hover:border-[#CCFF00] hover:text-[#CCFF00] text-[10px] font-bold uppercase tracking-widest py-2 rounded-full">Save</button>
        <button onClick={copy} disabled={!link} data-testid="pay-copy-btn"
          className="tap flex-1 bg-[#CCFF00] text-black text-[10px] font-bold uppercase tracking-widest py-2 rounded-full disabled:opacity-40">Copy Link</button>
      </div>
      {link && (
        <a
          href={link}
          onClick={(e) => { e.preventDefault(); openExternal(link); }}
          data-testid="pay-open-btn"
          className="mt-2 block text-[10px] break-all text-[#CCFF00] hover:underline"
        >
          {link}
        </a>
      )}
    </div>
  );
};

export default function AdminPanel() {
  const { matchId, adminToken } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [justGenerated, setJustGenerated] = useState(false);

  const load = async () => {
    try {
      const res = await api.get(`/matches/${matchId}/admin/${adminToken}`);
      setData(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Access denied");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [matchId, adminToken]);

  if (loading) return <div className="p-10 text-white/60">Loading...</div>;
  if (!data) return <div className="p-10 text-white/60">Match not found or invalid admin link.</div>;

  const { match, players, share_per_player } = data;

  const remove = async (pid) => {
    try {
      await api.delete(`/matches/${matchId}/admin/${adminToken}/players/${pid}`);
      toast.success("Player removed");
      load();
    } catch (e) { toast.error("Failed"); }
  };

  const generate = async () => {
    try {
      await api.post(`/matches/${matchId}/admin/${adminToken}/generate-teams`);
      setJustGenerated(true);
      setTimeout(() => setJustGenerated(false), 2000);
      toast.success("Teams generated");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const setTeam = async (pid, team) => {
    try {
      await api.patch(`/matches/${matchId}/admin/${adminToken}/players/${pid}/team`, { team_number: parseInt(team) });
      load();
    } catch (e) { toast.error("Failed"); }
  };

  const setPaid = async (pid, paid) => {
    try {
      await api.patch(`/matches/${matchId}/admin/${adminToken}/players/${pid}/payment`, { paid });
      if (paid) toast.success("Marked as paid ✓");
      load();
    } catch (e) { toast.error("Failed"); }
  };

  const setRating = async (pid, rating) => {
    try {
      await api.patch(`/matches/${matchId}/admin/${adminToken}/players/${pid}/rating`, { rating: parseInt(rating) });
      load();
    } catch (e) { toast.error("Failed"); }
  };

  const markPlayed = async (winning_team) => {
    try {
      const res = await api.post(`/matches/${matchId}/admin/${adminToken}/mark-played`, { winning_team });
      const changes = res.data?.rating_changes || {};
      const gainers = Object.entries(changes).filter(([, v]) => v.delta > 0).length;
      toast.success(`Marked as played · ${gainers} players climbed`);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const openMVP = async () => {
    try {
      await api.post(`/matches/${matchId}/admin/${adminToken}/open-mvp`);
      toast.success("MVP voting open");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const doSaveSquad = () => {
    if (players.length === 0) return toast.error("Nothing to save yet");
    saveSquad(players);
    toast.success(`Saved squad (${players.length} players) for next time`);
  };

  const loadSavedSquad = async () => {
    const squad = getSavedSquad();
    if (squad.length === 0) return toast.error("No saved squad yet");
    try {
      const r = await api.post(`/matches/${matchId}/admin/${adminToken}/bulk-add`, { players: squad });
      toast.success(`Added ${r.data.added} players${r.data.skipped ? `, skipped ${r.data.skipped}` : ""}`);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const doDownloadRecap = async () => {
    try {
      const r = await api.get(`/matches/${matchId}/mvp/results`);
      await downloadRecap({ match, players, mvp: r.data.mvp });
      toast.success("Recap downloaded");
    } catch (e) { toast.error("Could not generate recap"); }
  };

  const doShareRecap = async () => {
    try {
      const r = await api.get(`/matches/${matchId}/mvp/results`);
      const result = await shareRecap({ match, players, mvp: r.data.mvp });
      if (result === "shared") toast.success("Shared!");
      else toast.success("Recap saved to your device");
    } catch (e) { toast.error("Could not share recap"); }
  };

  const grouped = {};
  for (const p of players) {
    const t = p.team_number || 0;
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(p);
  }
  const teamsExist = players.some((p) => p.team_number);
  const paidCount = players.filter((p) => p.paid).length;
  const votingClosedOrDone = match.status === "completed" || match.status === "mvp_voting_open";

  return (
    <main className="max-w-6xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
      <SectionLabel testId="admin-label">/ Admin control</SectionLabel>
      <h1 className="font-display text-[3rem] sm:text-6xl uppercase leading-[0.95] break-words" data-testid="admin-match-name">{match.name}</h1>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-white/60 text-sm">
        <span>{fmtDate(match.date_time)}</span>
        <span>{match.location}</span>
        <span>Status: <span className="text-[#CCFF00] uppercase" data-testid="match-status">{match.status.replace("_", " ")}</span></span>
      </div>

      <div className="grid md:grid-cols-3 gap-5 sm:gap-6 mt-8 sm:mt-10">
        {/* PLAYERS */}
        <div className="md:col-span-2 glass rounded-xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <SectionLabel testId="players-label">/ Roster · {players.length}/{match.max_players}</SectionLabel>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={loadSavedSquad}
                data-testid="admin-load-squad"
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest border border-white/20 hover:border-[#CCFF00] hover:text-[#CCFF00] transition-colors px-3 py-2 rounded-full"
              >
                <Users size={12} /> Load Squad
              </button>
              <button
                onClick={doSaveSquad}
                data-testid="admin-save-squad"
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest border border-white/20 hover:border-[#CCFF00] hover:text-[#CCFF00] transition-colors px-3 py-2 rounded-full"
              >
                <Save size={12} /> Save Squad
              </button>
              <button
                onClick={generate}
                disabled={players.length < 4}
                data-testid="generate-teams-btn"
                className="text-xs font-bold uppercase tracking-widest border border-[#CCFF00] text-[#CCFF00] hover:bg-[#CCFF00] hover:text-black transition-colors px-4 py-2 rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {teamsExist ? "Regenerate" : "Generate Teams"}
              </button>
            </div>
          </div>

          {!teamsExist ? (
            <ul className="divide-y divide-white/5" data-testid="admin-players-list">
              {players.map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between py-3 gap-3 stagger-in"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-white/90 truncate">{p.name}</div>
                    <div className="text-[10px] uppercase tracking-widest text-white/40">{p.position}</div>
                  </div>
                  <Select value={String(p.rating)} onValueChange={(v) => setRating(p.id, v)}>
                    <SelectTrigger className="w-20 bg-[#050A07] border-white/20 text-xs uppercase tracking-widest" data-testid={`rating-select-${p.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0C1812] border-white/10">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)} data-testid={`rating-option-${p.id}-${n}`}>R {n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => remove(p.id)}
                    data-testid={`remove-${p.id}`}
                    aria-label={`Remove ${p.name}`}
                    className="tap w-11 h-11 inline-flex items-center justify-center text-white/40 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
              {players.length === 0 && (
                <li className="py-8" data-testid="admin-roster-empty">
                  <div className="text-center">
                    <div className="font-display text-2xl uppercase text-[#CCFF00]">The dressing room is empty</div>
                    <p className="text-white/50 text-sm mt-2">Share the public link with your mates. They'll show up here as soon as they join.</p>
                  </div>
                </li>
              )}
            </ul>
          ) : (
            <div className="space-y-5" data-testid="admin-teams-container">
              {Object.keys(grouped).sort().map((t, tIdx) => (
                <div key={t}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full font-display text-sm ${teamColors[t - 1].chip}`}>{t}</span>
                    <span className="font-display text-xl uppercase tracking-widest">Team {t}</span>
                  </div>
                  <ul className="divide-y divide-white/5">
                    {grouped[t].map((p, i) => (
                      <li
                        key={p.id}
                        className={`flex items-center justify-between py-2.5 gap-3 ${justGenerated ? "stagger-in" : ""}`}
                        style={justGenerated ? { animationDelay: `${(tIdx * 80) + i * 90}ms` } : {}}
                      >
                        <div className="min-w-0">
                          <div className="text-white/90 truncate">{p.name}</div>
                          <div className="text-[10px] uppercase tracking-widest text-white/40">{p.position} · R{p.rating}</div>
                        </div>
                        <Select value={String(p.team_number)} onValueChange={(v) => setTeam(p.id, v)}>
                          <SelectTrigger className="w-28 bg-[#050A07] border-white/20 text-xs uppercase tracking-widest" data-testid={`team-select-${p.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0C1812] border-white/10">
                            {Array.from({ length: match.num_teams }, (_, i) => i + 1).map((n) => (
                              <SelectItem key={n} value={String(n)} data-testid={`team-option-${p.id}-${n}`}>Team {n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <button onClick={() => remove(p.id)} data-testid={`remove-${p.id}`} className="text-white/40 hover:text-red-400 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SIDE */}
        <div className="space-y-6">
          {/* Payments */}
          <div className="glass rounded-xl p-5 sm:p-6" data-testid="payments-panel">
            <SectionLabel>/ Payments · ${share_per_player}/each</SectionLabel>
            <div className="text-white/50 text-xs uppercase tracking-widest mb-3">{paidCount}/{players.length} paid</div>
            <PaymentDeepLink share={share_per_player} matchName={match.name} />
            <ul className="divide-y divide-white/5">
              {players.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <span className="text-sm">{p.name}</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={p.paid}
                      onCheckedChange={(v) => setPaid(p.id, !!v)}
                      data-testid={`pay-${p.id}`}
                      className={`border-white/30 data-[state=checked]:bg-[#CCFF00] data-[state=checked]:text-black data-[state=checked]:border-[#CCFF00] ${p.paid ? "pulse-accent" : ""}`}
                    />
                    <span className={`text-[10px] uppercase tracking-widest ${p.paid ? "text-[#CCFF00]" : "text-white/40"}`}>{p.paid ? "Paid" : "Unpaid"}</span>
                  </label>
                </li>
              ))}
              {players.length === 0 && <li className="py-4 text-white/40 italic text-sm">Nobody joined yet.</li>}
            </ul>
          </div>

          {/* Actions */}
          <div className="glass rounded-xl p-5 sm:p-6" data-testid="actions-panel">
            <SectionLabel>/ Match flow</SectionLabel>

            {/* Winner selector — only shown when teams exist and match not yet played */}
            {teamsExist && (match.status === "teams_generated" || match.status === "open") && (
              <div className="mb-3" data-testid="winner-picker">
                <div className="text-[10px] uppercase tracking-widest text-white/50 mb-2">Result</div>
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: match.num_teams }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => markPlayed(n)}
                      data-testid={`mark-winner-${n}`}
                      className="tap py-3 border border-white/15 hover:border-[#CCFF00] hover:text-[#CCFF00] text-xs font-bold uppercase tracking-widest transition-colors"
                    >
                      Team {n} won
                    </button>
                  ))}
                  <button
                    onClick={() => markPlayed(null)}
                    data-testid="mark-draw"
                    className="tap col-span-2 py-3 border border-white/15 hover:border-white/40 text-white/70 text-xs font-bold uppercase tracking-widest transition-colors"
                  >
                    Draw
                  </button>
                </div>
              </div>
            )}

            {match.status === "played" || match.status === "mvp_voting_open" || match.status === "completed" ? (
              <div className="mb-3 text-xs text-white/60">
                Result recorded: <span className="text-[#CCFF00] uppercase font-bold">
                  {match.winning_team ? `Team ${match.winning_team} won` : "Draw"}
                </span>
              </div>
            ) : null}

            <button
              onClick={openMVP}
              disabled={match.status !== "played" && match.status !== "mvp_voting_open"}
              data-testid="open-mvp-btn"
              className="tap w-full bg-[#CCFF00] text-black text-xs font-bold uppercase tracking-widest py-3 rounded-full hover:scale-[1.02] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {match.status === "mvp_voting_open" ? "MVP Voting Open ✓" : "Open MVP Voting"}
            </button>
            {match.status === "mvp_voting_open" && (
              <div className="mt-4 text-xs text-white/50">
                Share this link: <code className="text-[#CCFF00] break-all">{window.location.origin}/vote/{matchId}</code>
              </div>
            )}
          </div>

          {/* WhatsApp broadcast — only when teams exist */}
          {teamsExist && (
            <div className="glass rounded-xl p-5 sm:p-6" data-testid="broadcast-panel">
              <div className="flex items-center gap-2 mb-2">
                <Send size={14} className="text-[#CCFF00]" />
                <SectionLabel>/ WhatsApp broadcast</SectionLabel>
              </div>
              <p className="text-white/50 text-xs mb-3">One tap sends the teams + share link to everyone.</p>
              <button
                onClick={() => {
                  const msg = buildBroadcastMessage(match, players, share_per_player, window.location.origin);
                  openWhatsAppBroadcast(msg);
                }}
                data-testid="broadcast-whatsapp-btn"
                className="tap w-full bg-[#25D366] text-black font-bold uppercase tracking-[0.2em] text-xs py-3 rounded-full"
              >
                Broadcast on WhatsApp
              </button>
            </div>
          )}

          {/* Recap */}
          {teamsExist && votingClosedOrDone && (
            <div className="glass rounded-xl p-5 sm:p-6" data-testid="recap-panel">
              <SectionLabel>/ Recap card</SectionLabel>
              <p className="text-white/50 text-xs mb-3">Save or share a visual summary of this match.</p>
              <button
                onClick={doShareRecap}
                data-testid="share-recap-btn"
                className="w-full mb-2 bg-[#CCFF00] text-black text-xs font-bold uppercase tracking-widest py-3 rounded-full hover:scale-[1.02] transition-transform"
              >
                Share Recap
              </button>
              <button
                onClick={doDownloadRecap}
                data-testid="download-recap-btn"
                className="w-full inline-flex items-center justify-center gap-2 border border-white/20 hover:border-[#CCFF00] hover:text-[#CCFF00] text-xs font-bold uppercase tracking-widest py-3 rounded-full transition-colors"
              >
                <Download size={12} /> Download
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
