"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

type Theme = "light" | "dark" | "system";
type Resolved = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolved: Resolved;
}>({
  theme: "system",
  setTheme: () => {},
  resolved: "light",
});

const THEME_EVENT = "bible-theme-change";

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(THEME_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(THEME_EVENT, listener);
  };
}

function getStoredTheme(): Theme | null {
  const value = localStorage.getItem("theme");
  return value === "light" || value === "dark" || value === "system"
    ? value
    : null;
}

function getServerTheme(): Theme | null {
  return null;
}

function subscribeMedia(listener: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", listener);
  return () => mq.removeEventListener("change", listener);
}

function getMediaDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getServerMediaDark(): boolean {
  return false;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const stored = useSyncExternalStore(subscribe, getStoredTheme, getServerTheme);
  const theme: Theme = stored ?? "system";
  const prefersDark = useSyncExternalStore(
    subscribeMedia,
    getMediaDark,
    getServerMediaDark
  );
  const resolved: Resolved =
    theme === "dark" || (theme === "system" && prefersDark) ? "dark" : "light";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem("theme", t);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
