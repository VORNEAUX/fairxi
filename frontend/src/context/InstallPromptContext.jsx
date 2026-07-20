import React from "react";

/**
 * InstallPromptContext keeps the `beforeinstallprompt` event alive for the
 * lifetime of the app, regardless of which UI (desktop nav, mobile drawer, etc.)
 * happens to be mounted at the moment. The browser only fires this event once
 * per session, so the listener MUST be attached to a component that never
 * unmounts. Any component that needs the state calls `useInstallPrompt()`.
 */
const InstallPromptContext = React.createContext({ available: false, trigger: () => {} });

export const InstallPromptProvider = ({ children }) => {
  const [prompt, setPrompt] = React.useState(null);

  React.useEffect(() => {
    const onBip = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const trigger = React.useCallback(async () => {
    if (!prompt) return "unavailable";
    try {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") setPrompt(null);
      return outcome;
    } catch {
      setPrompt(null);
      return "error";
    }
  }, [prompt]);

  const value = React.useMemo(
    () => ({ available: !!prompt, trigger }),
    [prompt, trigger],
  );

  return (
    <InstallPromptContext.Provider value={value}>
      {children}
    </InstallPromptContext.Provider>
  );
};

export const useInstallPrompt = () => React.useContext(InstallPromptContext);
