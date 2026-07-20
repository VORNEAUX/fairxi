import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { SectionLabel } from "@/components/Motifs";
import { toast } from "sonner";
import { getSavedSquad, addMyMatch } from "@/lib/storage";
import { Users, Trash2 } from "lucide-react";

const inputCls =
  "w-full bg-[#050A07] border-b border-white/20 focus:border-[#CCFF00] outline-none px-1 py-3 text-lg text-white placeholder:text-white/25 transition-colors";

const Field = ({ label, children, error, testId }) => (
  <div className="mb-6" data-testid={testId}>
    <label className="block text-[10px] font-bold uppercase tracking-[0.25em] text-[#CCFF00] mb-2">{label}</label>
    {children}
    {error && <div className="text-red-400 text-xs mt-1.5">{error}</div>}
  </div>
);

export default function CreateGroupMatch() {
  const { groupId, adminToken } = useParams();
  const nav = useNavigate();
  const [form, setForm] = React.useState({
    name: "", date_time: "", location: "", total_cost: "", max_players: "10", num_teams: "2",
  });
  const [errors, setErrors] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const [squad, setSquad] = React.useState([]);
  const savedCount = getSavedSquad().length;

  const set = (k, v) => {
    setForm({ ...form, [k]: v });
    if (errors[k]) setErrors({ ...errors, [k]: null });
  };

  const validate = () => {
    const e = {};
    if (!form.date_time) e.date_time = "Pick when the match kicks off.";
    if (!form.location.trim()) e.location = "Where are you playing?";
    const c = parseFloat(form.total_cost);
    if (!form.total_cost || isNaN(c) || c < 0) e.total_cost = "Enter the total pitch cost.";
    return e;
  };

  const loadSquad = () => {
    const s = getSavedSquad();
    if (s.length === 0) return toast.error("No saved squad yet");
    setSquad(s);
    toast.success(`Loaded ${s.length} players`);
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return toast.error("Please check the highlighted fields");
    }
    setLoading(true);
    try {
      const res = await api.post(`/groups/${groupId}/admin/${adminToken}/matches`, {
        name: form.name || null,
        date_time: new Date(form.date_time).toISOString(),
        location: form.location,
        total_cost: parseFloat(form.total_cost),
        max_players: parseInt(form.max_players),
        num_teams: parseInt(form.num_teams),
      });
      addMyMatch({
        match_id: res.data.id,
        admin_token: res.data.admin_token,
        name: form.name || `Match on ${new Date(form.date_time).toLocaleDateString()}`,
        date_time: new Date(form.date_time).toISOString(),
        location: form.location,
      });
      if (squad.length > 0) {
        try {
          await api.post(`/matches/${res.data.id}/admin/${res.data.admin_token}/bulk-add`, { players: squad });
        } catch {}
      }
      toast.success("Match created");
      nav(`/created/${res.data.id}/${res.data.admin_token}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-5 sm:px-6 py-10 sm:py-12">
      <SectionLabel testId="group-match-label">/ Group match</SectionLabel>
      <h1 className="font-display text-[3rem] sm:text-6xl uppercase leading-[0.95]">
        Next <span className="text-[#CCFF00]">fixture.</span>
      </h1>
      <p className="text-white/60 mt-3 mb-8 sm:mb-10 text-sm sm:text-base">This match will feed your group's standings.</p>

      <form onSubmit={submit}>
        <Field label="Match name (optional)"><input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Friday Night 5-a-side" /></Field>
        <Field label="Date & time" error={errors.date_time}><input type="datetime-local" className={inputCls} value={form.date_time} onChange={(e) => set("date_time", e.target.value)} data-testid="gm-datetime" /></Field>
        <Field label="Location" error={errors.location}><input className={inputCls} placeholder="Riverside Astro Pitch" value={form.location} onChange={(e) => set("location", e.target.value)} data-testid="gm-location" /></Field>
        <div className="grid grid-cols-2 gap-6">
          <Field label="Total cost" error={errors.total_cost}>
            <div className="flex items-center"><span className="text-white/40 mr-1">$</span><input type="number" min="0" step="0.01" className={inputCls} placeholder="100" value={form.total_cost} onChange={(e) => set("total_cost", e.target.value)} data-testid="gm-cost" /></div>
          </Field>
          <Field label="Max players"><input type="number" min="2" className={inputCls} value={form.max_players} onChange={(e) => set("max_players", e.target.value)} data-testid="gm-max" /></Field>
        </div>
        <Field label="Number of teams">
          <div className="flex gap-2">
            {[2, 3, 4].map((n) => (
              <button key={n} type="button" onClick={() => set("num_teams", String(n))} data-testid={`gm-teams-${n}`}
                className={`flex-1 py-4 border font-display text-3xl transition-colors ${form.num_teams === String(n) ? "border-[#CCFF00] text-[#CCFF00] bg-[#CCFF00]/5" : "border-white/15 text-white/50 hover:border-white/40"}`}>{n}</button>
            ))}
          </div>
        </Field>

        <div className="mb-6 glass rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <SectionLabel>/ Saved squad ({savedCount})</SectionLabel>
            <button type="button" onClick={loadSquad} className="tap self-start sm:self-auto inline-flex items-center gap-2 border border-white/20 hover:border-[#CCFF00] hover:text-[#CCFF00] text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full transition-colors whitespace-nowrap">
              <Users size={12} /> Load Saved Squad
            </button>
          </div>
          {squad.length === 0 ? (
            <p className="text-white/40 text-xs">Auto-fill the roster from your saved squad.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {squad.map((p) => (
                <li key={p.phone} className="flex items-center justify-between py-2 text-sm">
                  <span><span className="text-white/90">{p.name}</span><span className="ml-2 text-[10px] uppercase tracking-widest text-white/40">{p.position}</span></span>
                  <button type="button" onClick={() => setSquad(squad.filter((x) => x.phone !== p.phone))} className="text-white/40 hover:text-red-400"><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button type="submit" disabled={loading} data-testid="submit-group-match"
          className="tap mt-2 w-full bg-[#CCFF00] text-black font-bold uppercase tracking-[0.2em] px-6 py-5 rounded-full hover:scale-[1.02] transition-transform disabled:opacity-50 accent-glow">
          {loading ? "Creating..." : "Create Match →"}
        </button>
      </form>
    </main>
  );
}
