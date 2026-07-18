import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { SectionLabel } from "@/components/Motifs";
import { toast } from "sonner";

const Field = ({ label, children, testId }) => (
  <div className="mb-6" data-testid={testId}>
    <label className="block text-[10px] font-bold uppercase tracking-[0.25em] text-[#CCFF00] mb-2">
      {label}
    </label>
    {children}
  </div>
);

const inputCls =
  "w-full bg-[#050A07] border-b border-white/20 focus:border-[#CCFF00] outline-none px-1 py-3 text-lg text-white placeholder:text-white/25 transition-colors";

export default function CreateMatch() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: "",
    date_time: "",
    location: "",
    total_cost: "",
    max_players: "10",
    num_teams: "2",
  });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm({ ...form, [k]: v });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.date_time || !form.location || !form.total_cost) {
      toast.error("Please fill date, location, and cost");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/matches", {
        name: form.name || null,
        date_time: new Date(form.date_time).toISOString(),
        location: form.location,
        total_cost: parseFloat(form.total_cost),
        max_players: parseInt(form.max_players),
        num_teams: parseInt(form.num_teams),
      });
      toast.success("Match created");
      nav(`/created/${res.data.id}/${res.data.admin_token}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create match");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative max-w-2xl mx-auto px-5 py-12">
      <SectionLabel testId="create-label">/ New Match</SectionLabel>
      <h1 className="font-display text-5xl sm:text-6xl uppercase leading-none">
        Set the <span className="text-[#CCFF00]">fixture.</span>
      </h1>
      <p className="text-white/60 mt-3 mb-10">Only takes a minute. You'll get a share link at the end.</p>

      <form onSubmit={submit} data-testid="create-match-form">
        <Field label="Match name (optional)" testId="field-name">
          <input
            className={inputCls}
            placeholder="Friday Night 5-a-Side"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            data-testid="input-name"
          />
        </Field>
        <Field label="Date & time" testId="field-datetime">
          <input
            type="datetime-local"
            className={inputCls}
            value={form.date_time}
            onChange={(e) => set("date_time", e.target.value)}
            data-testid="input-datetime"
          />
        </Field>
        <Field label="Location" testId="field-location">
          <input
            className={inputCls}
            placeholder="Riverside Astro Pitch"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            data-testid="input-location"
          />
        </Field>
        <div className="grid grid-cols-2 gap-6">
          <Field label="Total pitch cost" testId="field-cost">
            <div className="flex items-center">
              <span className="text-white/40 mr-1">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                placeholder="100"
                value={form.total_cost}
                onChange={(e) => set("total_cost", e.target.value)}
                data-testid="input-cost"
              />
            </div>
          </Field>
          <Field label="Max players" testId="field-max">
            <input
              type="number"
              min="2"
              className={inputCls}
              value={form.max_players}
              onChange={(e) => set("max_players", e.target.value)}
              data-testid="input-max"
            />
          </Field>
        </div>
        <Field label="Number of teams" testId="field-teams">
          <div className="flex gap-2">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => set("num_teams", String(n))}
                data-testid={`teams-${n}`}
                className={`flex-1 py-4 border rounded-none font-display text-3xl transition-colors ${
                  form.num_teams === String(n)
                    ? "border-[#CCFF00] text-[#CCFF00] bg-[#CCFF00]/5"
                    : "border-white/15 text-white/50 hover:border-white/40"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </Field>

        <button
          type="submit"
          disabled={loading}
          data-testid="submit-create"
          className="mt-8 w-full bg-[#CCFF00] text-black font-bold uppercase tracking-[0.2em] px-6 py-5 rounded-full hover:scale-[1.02] transition-transform disabled:opacity-50 accent-glow"
        >
          {loading ? "Creating..." : "Create Match →"}
        </button>
      </form>
    </main>
  );
}
