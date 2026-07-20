// Native-safe external URL opener.
//
// Web browsers: use window.open(url, '_blank') as usual.
// Capacitor (iOS/Android): use window.open(url, '_system') — Capacitor intercepts
// this and hands the URL to the OS's default browser (Chrome / Safari), instead
// of loading it inside the app's WebView. Payment providers like PayPal.me,
// Revolut and Satispay rely on session cookies / third-party scripts that fail
// silently inside embedded WebViews (blank page, no amount, no confirm button).
export function openExternal(url) {
  if (!url) return;
  try {
    const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    if (isNative) {
      window.open(url, "_system");
      return;
    }
  } catch { /* fallthrough */ }
  const win = window.open(url, "_blank", "noopener,noreferrer");
  // Some in-app browsers (Instagram, TikTok, Facebook WebView) block window.open
  // and return null — fall back to a top-level navigation so the OS's link handler
  // picks it up and hands the URL to the default browser.
  if (!win) {
    try { window.location.href = url; } catch { /* no-op */ }
  }
}
