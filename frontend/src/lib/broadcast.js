// FairXI broadcast + payment deep-link helpers (link-generation only, no processing)
import { openExternal } from "./openLink";

/** Build a pre-filled WhatsApp broadcast text for the whole squad. */
export function buildBroadcastMessage(match, players, share, origin) {
  const link = `${origin}/m/${match.id}`;
  const grouped = {};
  for (const p of players) {
    const t = p.team_number || 0;
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(p.name);
  }
  const lines = [`⚽ FairXI — ${match.name}`];
  lines.push(`${match.location}`);
  if (match.date_time) lines.push(new Date(match.date_time).toLocaleString());
  lines.push("");
  Object.keys(grouped).sort().forEach((t) => {
    if (t === "0") return;
    lines.push(`Team ${t}: ${grouped[t].join(", ")}`);
  });
  lines.push("");
  if (share) lines.push(`Share of pitch cost: ${share} each`);
  lines.push(`Details: ${link}`);
  return lines.join("\n");
}

export function openWhatsAppBroadcast(message) {
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  // Native-safe: opens the OS's default browser under Capacitor, not the in-app WebView.
  openExternal(url);
}

/** Payment providers with deep-link builders. Each returns a URL string. */
export const PAY_PROVIDERS = {
  paypalme: {
    id: "paypalme",
    label: "PayPal.me",
    hint: "your PayPal.me username",
    build: (handle, amount, note) => {
      if (!handle) return null;
      const amt = Number(amount);
      if (!isFinite(amt) || amt < 0) return null;
      const h = handle.replace(/^@/, "").trim();
      return `https://www.paypal.com/paypalme/${encodeURIComponent(h)}/${amt.toFixed(2)}`;
    },
  },
  revolut: {
    id: "revolut",
    label: "Revolut",
    hint: "your Revolut @tag",
    build: (handle, amount, note) => {
      if (!handle) return null;
      const amt = Number(amount);
      if (!isFinite(amt) || amt < 0) return null;
      const h = handle.replace(/^@/, "").trim();
      return `https://revolut.me/${encodeURIComponent(h)}?amount=${amt.toFixed(2)}`;
    },
  },
  satispay: {
    id: "satispay",
    label: "Satispay",
    hint: "your Satispay profile username",
    build: (handle, amount, note) => {
      if (!handle) return null;
      const amt = Number(amount);
      if (!isFinite(amt) || amt < 0) return null;
      const h = handle.replace(/^@/, "").trim();
      return `https://www.satispay.com/app/match/link/user/${encodeURIComponent(h)}?amount=${amt.toFixed(2)}`;
    },
  },
};

const PAY_LS_KEY = "fairxi_pay_prefs";

export function getPayPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PAY_LS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function setPayPrefs(prefs) {
  localStorage.setItem(PAY_LS_KEY, JSON.stringify(prefs));
}
