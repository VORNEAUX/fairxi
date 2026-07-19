import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { Download, Menu, X, Plus } from "lucide-react";
import { Logo } from "@/components/Motifs";

import Home from "@/pages/Home";
import CreateMatch from "@/pages/CreateMatch";
import MatchCreated from "@/pages/MatchCreated";
import JoinPage from "@/pages/JoinPage";
import AdminPanel from "@/pages/AdminPanel";
import MVPVoting from "@/pages/MVPVoting";
import PlayerHistory from "@/pages/PlayerHistory";
import MyMatches from "@/pages/MyMatches";

const useInstallPrompt = () => {
  const [prompt, setPrompt] = React.useState(null);
  React.useEffect(() => {
    const onBip = (e) => { e.preventDefault(); setPrompt(e); };
    const onInstalled = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  const trigger = React.useCallback(async () => {
    if (!prompt) return;
    try {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") setPrompt(null);
    } catch { setPrompt(null); }
  }, [prompt]);
  return { available: !!prompt, trigger };
};

const InstallButton = ({ variant = "desktop", onDone }) => {
  const { available, trigger } = useInstallPrompt();
  if (!available) return null;
  const handle = async () => { await trigger(); onDone && onDone(); };
  if (variant === "mobile") {
    return (
      <button
        onClick={handle}
        data-testid="install-app-btn-mobile"
        className="tap h-12 flex items-center gap-2 px-2 rounded-lg text-white/80 active:bg-white/5"
        aria-label="Install FairXI app"
      >
        <Download size={14} /> <span>Install App</span>
      </button>
    );
  }
  return (
    <button
      onClick={handle}
      data-testid="install-app-btn"
      className="tap inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-white/70 hover:text-[#CCFF00] transition-colors"
      aria-label="Install FairXI app"
    >
      <Download size={12} />
      <span>Install</span>
    </button>
  );
};

const NAV_LINKS = [
  { to: "/my-matches", label: "My Matches", testId: "nav-my-matches" },
  { to: "/history", label: "Player History", testId: "nav-history" },
];

const Nav = () => {
  const loc = useLocation();
  const [open, setOpen] = React.useState(false);
  const on = (p) => loc.pathname === p;

  React.useEffect(() => { setOpen(false); }, [loc.pathname]);

  return (
    <header className="sticky top-0 z-40 glass border-b border-white/10">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-5 sm:px-6 h-16 sm:h-[68px]">
        <Link to="/" data-testid="nav-home" className="tap inline-flex items-center py-2 -my-2">
          <Logo />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 text-xs font-bold uppercase tracking-wider">
          <InstallButton />
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              data-testid={l.testId}
              className={`tap px-3 py-2 rounded-full transition-colors ${on(l.to) ? "text-[#CCFF00]" : "text-white/70 hover:text-white"}`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/create"
            data-testid="nav-create"
            className="tap ml-2 px-4 py-2 rounded-full bg-[#CCFF00] text-black hover:scale-[1.03] transition-transform"
          >
            Create Match
          </Link>
        </nav>

        {/* Mobile nav — compact bar */}
        <div className="flex md:hidden items-center gap-2">
          <Link
            to="/create"
            data-testid="nav-create-mobile"
            className="tap inline-flex items-center gap-1.5 h-11 px-4 rounded-full bg-[#CCFF00] text-black text-[11px] font-bold uppercase tracking-[0.15em]"
          >
            <Plus size={12} /> Create
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            data-testid="nav-menu-toggle"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="tap w-11 h-11 inline-flex items-center justify-center rounded-full border border-white/15 text-white/85"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {open && (
        <div className="md:hidden border-t border-white/10 bg-[#050A07]/95 backdrop-blur-md" data-testid="nav-menu">
          <div className="max-w-6xl mx-auto px-5 py-2 flex flex-col text-xs font-bold uppercase tracking-widest">
            <InstallButton variant="mobile" onDone={() => setOpen(false)} />
            {NAV_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                data-testid={`${l.testId}-mobile`}
                onClick={() => setOpen(false)}
                className={`tap h-12 flex items-center px-2 rounded-lg transition-colors ${
                  on(l.to) ? "text-[#CCFF00]" : "text-white/75 active:bg-white/5"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Nav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreateMatch />} />
          <Route path="/created/:matchId/:adminToken" element={<MatchCreated />} />
          <Route path="/m/:matchId" element={<JoinPage />} />
          <Route path="/admin/:matchId/:adminToken" element={<AdminPanel />} />
          <Route path="/vote/:matchId" element={<MVPVoting />} />
          <Route path="/history" element={<PlayerHistory />} />
          <Route path="/my-matches" element={<MyMatches />} />
        </Routes>
        <Toaster theme="dark" position="top-center" richColors />
      </BrowserRouter>
    </div>
  );
}

export default App;
