import React from "react";
import { Link } from "react-router-dom";
import { SectionLabel, PitchCircle } from "@/components/Motifs";

const Section = ({ label, title, children }) => (
  <section className="mb-10">
    <SectionLabel>{label}</SectionLabel>
    <h2 className="font-display text-2xl sm:text-3xl uppercase mb-3">{title}</h2>
    <div className="text-white/70 text-sm sm:text-base leading-relaxed space-y-3">{children}</div>
  </section>
);

export default function Privacy() {
  const lastUpdated = "February 2026";
  return (
    <main className="relative overflow-hidden">
      <PitchCircle className="w-[420px] h-[420px] -top-40 -right-40 spin-slow" />
      <div className="relative max-w-3xl mx-auto px-5 sm:px-6 py-10 sm:py-14">
        <SectionLabel testId="privacy-label">/ Privacy</SectionLabel>
        <h1 className="font-display text-[3rem] sm:text-6xl uppercase leading-[0.95]">
          Straight talk on <span className="text-[#CCFF00]">your data.</span>
        </h1>
        <p className="text-white/50 text-xs uppercase tracking-widest mt-3 mb-8">
          Last updated: {lastUpdated}
        </p>

        <Section label="/ What we collect" title="Only what the match needs">
          <p>
            FairXI is a lightweight tool for organising casual football matches. To do that, we store:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-white/70">
            <li><strong className="text-white/90">Phone numbers</strong> — used to identify a player across matches (uniqueness key). We never SMS or call you.</li>
            <li><strong className="text-white/90">Player name and preferred position</strong> — what you type when you join.</li>
            <li><strong className="text-white/90">Self-declared and dynamic ratings</strong> — the 1–5 you enter, plus the Elo-style rating we compute after each match.</li>
            <li><strong className="text-white/90">Match and group participation</strong> — which matches you joined, which team you were on, the match result.</li>
            <li><strong className="text-white/90">MVP votes</strong> — one vote per player per match, linked to the voter's player id so we can enforce "one vote".</li>
            <li><strong className="text-white/90">Payment toggle status</strong> — a simple paid/unpaid flag flipped by the organizer. No money moves through FairXI.</li>
          </ul>
        </Section>

        <Section label="/ What we don't do" title="No selling. No sharing.">
          <p>
            We <strong className="text-[#CCFF00]">do not sell</strong> your data. We <strong className="text-[#CCFF00]">do not share</strong> it with advertisers, brokers, or third-party analytics for marketing.
          </p>
          <p>
            We don't use behavioural tracking cookies, we don't build shadow profiles from your data, and we don't cross-link your FairXI activity to any other service.
          </p>
        </Section>

        <Section label="/ Payments" title="Links only, never processing">
          <p>
            When the organizer generates a payment link (PayPal.me / Revolut / Satispay), that link is built <strong className="text-white/90">entirely in your browser</strong>. The organizer's payment handle is stored in your browser's local storage — never on FairXI's servers.
          </p>
          <p>
            <strong className="text-white/90">No money passes through FairXI.</strong> Every payment happens directly between you and the chosen provider, under their terms and their privacy policy.
          </p>
        </Section>

        <Section label="/ Where your data lives" title="On our infrastructure only">
          <p>
            All match, group, rating, and MVP data lives in our own MongoDB database. We use standard commercial hosting (HTTPS, encrypted at rest by the provider). Match and admin links are protected by 192-bit random tokens embedded in the URL — treat them like a password.
          </p>
        </Section>

        <Section label="/ Your rights" title="Get in touch">
          <p>
            You can ask us to delete a specific match, a group, or all data associated with your phone number. Because FairXI has no account system, we identify your data by phone number. Send the phone number to the contact address on the deploy — we will remove all records within a reasonable time.
          </p>
        </Section>

        <Section label="/ Changes" title="If this document changes">
          <p>
            If we make a meaningful change to what we collect or how we use it, we'll update the "Last updated" date above and, when it matters, surface a notice inside the app.
          </p>
        </Section>

        <div className="mt-12 border-t border-white/10 pt-6 flex items-center justify-between">
          <Link
            to="/"
            data-testid="privacy-home-link"
            className="tap inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-[#CCFF00] transition-colors"
          >
            ← Back to FairXI
          </Link>
          <span className="text-[10px] uppercase tracking-widest text-white/30">Zero drama, zero data games.</span>
        </div>
      </div>
    </main>
  );
}
