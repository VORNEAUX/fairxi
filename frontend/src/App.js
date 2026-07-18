import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { Logo } from "@/components/Motifs";

import Home from "@/pages/Home";
import CreateMatch from "@/pages/CreateMatch";
import MatchCreated from "@/pages/MatchCreated";
import JoinPage from "@/pages/JoinPage";
import AdminPanel from "@/pages/AdminPanel";
import MVPVoting from "@/pages/MVPVoting";
import PlayerHistory from "@/pages/PlayerHistory";

const Nav = () => {
  const loc = useLocation();
  const on = (p) => loc.pathname === p;
  return (
    <header className="sticky top-0 z-40 glass border-b border-white/10">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-5 py-4">
        <Link to="/" data-testid="nav-home"><Logo /></Link>
        <nav className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider">
          <Link
            to="/history"
            data-testid="nav-history"
            className={`px-3 py-2 rounded-full transition-colors ${on("/history") ? "text-[#CCFF00]" : "text-white/70 hover:text-white"}`}
          >
            Player History
          </Link>
          <Link
            to="/create"
            data-testid="nav-create"
            className="ml-2 px-4 py-2 rounded-full bg-[#CCFF00] text-black hover:scale-[1.03] transition-transform"
          >
            Create Match
          </Link>
        </nav>
      </div>
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
        </Routes>
        <Toaster theme="dark" position="top-center" richColors />
      </BrowserRouter>
    </div>
  );
}

export default App;
