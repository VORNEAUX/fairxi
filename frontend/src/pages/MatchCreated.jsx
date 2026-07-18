import React from "react";
import { Link, useParams } from "react-router-dom";
import { SectionLabel } from "@/components/Motifs";
import { toast } from "sonner";
import { Copy, ExternalLink } from "lucide-react";

export default function MatchCreated() {
  const { matchId, adminToken } = useParams();
  const origin = window.location.origin;
  const publicLink = `${origin}/m/${matchId}`;
  const adminLink = `${origin}/admin/${matchId}/${adminToken}`;
  const voteLink = `${origin}/vote/${matchId}`;

  const copy = (t, label) => {
    navigator.clipboard.writeText(t);
    toast.success(`${label} link copied`);
  };

  const whatsapp = () => {
    const msg = encodeURIComponent(`Join our match on FairXI: ${publicLink}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const Row = ({ label, href, testId, primary }) => (
    <div className="glass rounded-xl p-5" data-testid={testId}>
      <div className="text-[10px] uppercase tracking-[0.25em] text-white/40 mb-2">{label}</div>
      <div className="flex items-center gap-3 mb-3">
        <code className={`text-sm break-all ${primary ? "text-[#CCFF00]" : "text-white/80"}`}>{href}</code>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => copy(href, label)}
          data-testid={`${testId}-copy`}
          className="inline-flex items-center gap-2 border border-white/20 hover:border-[#CCFF00] hover:text-[#CCFF00] text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full transition-colors"
        >
          <Copy size={12} /> Copy
        </button>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          data-testid={`${testId}-open`}
          className="inline-flex items-center gap-2 border border-white/20 hover:border-[#CCFF00] hover:text-[#CCFF00] text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full transition-colors"
        >
          <ExternalLink size={12} /> Open
        </a>
      </div>
    </div>
  );

  return (
    <main className="max-w-2xl mx-auto px-5 py-12">
      <SectionLabel testId="created-label">/ Match created</SectionLabel>
      <h1 className="font-display text-5xl sm:text-6xl uppercase leading-none mb-2">
        You're on. <span className="text-[#CCFF00]">Share the link.</span>
      </h1>
      <p className="text-white/60 mb-8">Save the admin link — only you should have it.</p>

      <div className="space-y-4">
        <Row label="Public Join Link (share with players)" href={publicLink} testId="public-link" primary />
        <button
          onClick={whatsapp}
          data-testid="share-whatsapp"
          className="w-full bg-[#25D366] text-black font-bold uppercase tracking-[0.2em] px-6 py-4 rounded-full hover:scale-[1.02] transition-transform"
        >
          Share on WhatsApp
        </button>
        <Row label="Admin Link (keep private)" href={adminLink} testId="admin-link" />
        <Row label="MVP Voting Link (share after match)" href={voteLink} testId="vote-link" />
      </div>

      <div className="mt-10 flex gap-3">
        <Link
          to={`/admin/${matchId}/${adminToken}`}
          data-testid="go-admin"
          className="inline-flex items-center gap-2 bg-[#CCFF00] text-black font-bold uppercase tracking-[0.2em] px-6 py-4 rounded-full"
        >
          Go to Admin →
        </Link>
      </div>
    </main>
  );
}
