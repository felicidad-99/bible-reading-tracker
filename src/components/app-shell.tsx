"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/theme-provider";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/calendar", label: "Calendar", icon: "calendar_month" },
  { href: "/reader", label: "Read", icon: "auto_stories" },
  { href: "/stats", label: "Rhythm", icon: "insights" },
  { href: "/groups", label: "Groups", icon: "group" },
  { href: "/plans", label: "Plans", icon: "menu_book" },
  { href: "/settings", label: "Profile", icon: "person" },
];

const MOBILE_NAV = [
  { href: "/dashboard", short: "Home", icon: "home" },
  { href: "/reader", short: "Read", icon: "auto_stories" },
  { href: "/stats", short: "Rhythm", icon: "insights" },
  { href: "/settings", short: "Profile", icon: "person" },
];

const emptySubscribe = () => () => {};

export function AppShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  const { setTheme, resolved } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const isActive = (href: string) =>
    pathname === href ||
    pathname.startsWith(href + "/") ||
    (href === "/reader" && pathname.startsWith("/reader"));

  return (
    <div className="min-h-dvh flex flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:bg-accent focus:text-ink focus:px-4 focus:py-2 focus:rounded-full"
      >
        Skip to content
      </a>

      <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-line md:bg-surface-raised md:sticky md:top-0 md:h-dvh">
        <div className="p-5 border-b border-line">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight text-lg xl:text-xl">
            <span className="w-7 h-7 rounded-lg bg-sandstone-soft flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-ember text-[18px] fill-icon" aria-hidden="true">local_fire_department</span>
            </span>
            Bible Track
          </Link>
          <p className="text-sm text-ink-muted mt-0.5">Read. Track. Finish.</p>
        </div>
        <nav className="flex-1 p-3 space-y-1" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive(item.href)
                  ? "bg-ember-soft text-accent-ink"
                  : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
              }`}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              <span
                aria-hidden
                className={`material-symbols-outlined text-[20px] ${
                  isActive(item.href) ? "fill-icon" : ""
                }`}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-line space-y-2">
          <button
            type="button"
            className="btn btn-ghost w-full justify-start text-sm"
            onClick={() =>
              setTheme(resolved === "dark" ? "light" : "dark")
            }
            aria-label={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`}
          >
            <span aria-hidden className="material-symbols-outlined text-[20px]">
              {mounted && resolved === "dark" ? "light_mode" : "dark_mode"}
            </span>
            {mounted
              ? resolved === "dark"
                ? "Light mode"
                : "Dark mode"
              : "Theme"}
          </button>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="btn btn-ghost w-full justify-start text-sm"
            >
              <span aria-hidden className="material-symbols-outlined text-[20px]">
                logout
              </span>
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 pb-28 md:pb-0">
        <header className="md:hidden sticky top-0 z-40 bg-surface-raised/90 backdrop-blur border-b border-line">
          <div className="flex items-center justify-between px-4 h-14">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-lg">
              <span className="w-7 h-7 rounded-lg bg-sandstone-soft flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-ember text-[18px] fill-icon" aria-hidden="true">local_fire_department</span>
              </span>
              Bible Track
            </Link>
            <button
              type="button"
              className="btn btn-ghost text-sm px-3 py-1.5"
              onClick={() =>
                setTheme(resolved === "dark" ? "light" : "dark")
              }
              aria-label={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`}
            >
              <span aria-hidden className="material-symbols-outlined text-[22px]">
                {mounted && resolved === "dark" ? "light_mode" : "dark_mode"}
              </span>
              {mounted ? (resolved === "dark" ? "Light" : "Dark") : "Theme"}
            </button>
          </div>
        </header>

        <main id="main" className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-10">
          {children}
        </main>
      </div>

      <nav
        className="md:hidden fixed bottom-4 inset-x-0 mx-auto max-w-xs z-40 rounded-full px-3 py-2 bg-surface-raised/95 backdrop-blur-md border border-line shadow-md flex justify-around items-center"
        aria-label="Primary"
      >
        {MOBILE_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center min-h-11 px-2 py-0.5 rounded-full text-sm font-medium transition-colors duration-150 active:scale-95 relative ${
              isActive(item.href)
                ? "text-accent-ink"
                : "text-ink-muted hover:text-ink"
            }`}
            aria-current={isActive(item.href) ? "page" : undefined}
          >
            <span
              aria-hidden
              className={`material-symbols-outlined text-[20px] ${
                isActive(item.href) ? "fill-icon" : ""
              }`}
            >
              {item.icon}
            </span>
            {item.short}
            {isActive(item.href) && (
              <span
                aria-hidden
                className="w-1 h-1 rounded-full bg-ember"
              />
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}
