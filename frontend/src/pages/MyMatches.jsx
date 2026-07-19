import React from "react";
import { Link } from "react-router-dom";
import { getMyMatches, removeMyMatch } from "@/lib/storage";
import { SectionLabel } from "@/components/Motifs";
import { fmtDate } from "@/lib/api";
import { ArrowRight, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export default function MyMatches() {
  const [matches, setMatches] = React.useState(getMyMatches());

  const remove = (id) => {
    removeMyMatch(id);
    setMatches(getMyMatches());
    toast.success("Removed from your list");
  };

  return (
    <main className="max-w-3xl mx-auto px-5 py-12">
      <SectionLabel testId="mymatches-label">/ Organizer</SectionLabel>
      <h1 className="font-display text-5xl sm:text-6xl uppercase leading-none">
        My <span className="text-[#CCFF00]">matches.</span>
      </h1>
      <p className="text-white/60 mt-3 mb-8">Every match you've created from this browser. Tap to open its admin panel.</p>

      {matches.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center" data-testid="empty-state">
          <p className="text-white/60 mb-6">You haven't created any matches yet on this device.</p>
          <Link
            to="/create"
            className="inline-flex items-center gap-2 bg-[#CCFF00] text-black font-bold uppercase tracking-[0.2em] px-6 py-4 rounded-full hover:scale-[1.03] transition-transform"
            data-testid="empty-cta"
          >
            <Plus size={14} /> Create Your First Match
          </Link>
        </div>
      ) : (
        <ul className="space-y-3" data-testid="my-matches-list">
          {matches.map((m) => (
            <li key={m.match_id} className="glass rounded-xl p-5 flex items-center justify-between gap-3" data-testid={`match-row-${m.match_id}`}>
              <div className="min-w-0 flex-1">
                <div className="font-display text-2xl uppercase truncate">{m.name}</div>
                <div className="text-white/50 text-xs uppercase tracking-widest mt-1">
                  {fmtDate(m.date_time)} · {m.location}
                </div>
              </div>
              <Link
                to={`/admin/${m.match_id}/${m.admin_token}`}
                data-testid={`open-admin-${m.match_id}`}
                className="inline-flex items-center gap-2 border border-[#CCFF00] text-[#CCFF00] font-bold uppercase tracking-widest text-xs px-4 py-2 rounded-full hover:bg-[#CCFF00] hover:text-black transition-colors whitespace-nowrap"
              >
                Admin <ArrowRight size={12} />
              </Link>
              <button
                onClick={() => remove(m.match_id)}
                data-testid={`remove-${m.match_id}`}
                className="text-white/40 hover:text-red-400 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
