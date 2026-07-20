import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);

// Register PWA service worker with update-available notification.
// Skip on native (Capacitor) — the native shell handles updates and a stray SW
// can double-register / conflict with capacitor:// asset serving.
const isNative = () => {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch { return false; }
};

if ("serviceWorker" in navigator && window.location.protocol === "https:" && !isNative()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => {
        // Notify user when a new SW has been installed and is waiting
        const notifyUpdate = (worker) => {
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              window.dispatchEvent(
                new CustomEvent("fairxi:update-available", { detail: { worker } }),
              );
            }
          });
        };
        if (reg.waiting) notifyUpdate(reg.waiting);
        reg.addEventListener("updatefound", () => notifyUpdate(reg.installing));
      })
      .catch(() => {});

    // If user accepts the reload prompt, activate the new SW before reloading.
    window.addEventListener("fairxi:update-available", (e) => {
      const worker = e.detail?.worker;
      const onReload = () => {
        try {
          worker?.postMessage?.({ type: "SKIP_WAITING" });
        } catch {}
      };
      // Attach one-time to reload event bubbling via user action (handled in App toast)
      window.__fairxiAcceptUpdate = onReload;
    });

    // When controller changes (new SW activated), reload to pick up new assets
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
