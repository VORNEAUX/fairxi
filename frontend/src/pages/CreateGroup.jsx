import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { SectionLabel } from "@/components/Motifs";
import { toast } from "sonner";
import { getMyGroups, addMyGroup } from "@/lib/storage";
import { ArrowRight, Users } from "lucide-react";

export default function CreateGroup() {
  const nav = useNavigate();
  const [name, setName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const nameRef = React.useRef(null);
  const groups = getMyGroups();

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      nameRef.current?.focus?.();
      return toast.error("Give your group a name");
    }
    setLoading(true);
    try {
      const res = await api.post("/groups", { name: name.trim() });
      addMyGroup({ id: res.data.id, admin_token: res.data.admin_token, name: res.data.name });
      toast.success("Group created");
      nav(`/group/${res.data.id}/${res.data.admin_token}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not create group");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-5 sm:px-6 py-10 sm:py-12">
      <SectionLabel testId="create-group-label">/ New Group</SectionLabel>
      <h1 className="font-display text-[3rem] sm:text-6xl uppercase leading-[0.95]">
        Build your <span className="text-[#CCFF00]">side.</span>
      </h1>
      <p className="text-white/60 mt-3 mb-8 sm:mb-10 text-sm sm:text-base">
        A Group keeps your regular crew together: reuse the roster, track cumulative standings, and see rating trends across every match.
      </p>

      <form onSubmit={submit} data-testid="create-group-form">
        <label className="block text-[10px] font-bold uppercase tracking-[0.25em] text-[#CCFF00] mb-2">Group name</label>
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sunday Sunset FC"
          data-testid="input-group-name"
          className="w-full bg-[#050A07] border-b border-white/20 focus:border-[#CCFF00] outline-none px-1 py-3 text-lg text-white placeholder:text-white/25 transition-colors"
        />
        <button
          type="submit"
          disabled={loading}
          data-testid="submit-create-group"
          className="tap mt-8 w-full bg-[#CCFF00] text-black font-bold uppercase tracking-[0.2em] px-6 py-5 rounded-full hover:scale-[1.02] transition-transform disabled:opacity-50 accent-glow"
        >
          {loading ? "Creating..." : "Create Group →"}
        </button>
      </form>

      {groups.length > 0 && (
        <div className="mt-10">
          <SectionLabel>/ Your groups</SectionLabel>
          <ul className="space-y-2" data-testid="my-groups-list">
            {groups.map((g) => (
              <li key={g.id}>
                <Link
                  to={`/group/${g.id}/${g.admin_token}`}
                  className="tap glass rounded-lg px-5 py-4 flex items-center justify-between hover:border-[#CCFF00]/40 border border-transparent"
                  data-testid={`my-group-${g.id}`}
                >
                  <div className="flex items-center gap-3">
                    <Users size={16} className="text-[#CCFF00]" />
                    <span className="font-display text-xl uppercase">{g.name}</span>
                  </div>
                  <ArrowRight size={14} className="text-white/40" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
