"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/theme-provider";

const NAV = [
  { href: "/dashboard", label: "Dashboard", short: "Home", icon: "⌂" },
  { href: "/calendar", label: "Calendar", short: "Calendar", icon: "▦" },
  { href: "/reader", label: "Read", short: "Read", icon: "▤" },
  { href: "/stats", label: "Stats", short: "Stats", icon: "◫" },
  { href: "/groups", label: "Groups", short: "Groups", icon: "◈" },
  { href: "/settings", label: "Settings", short: "Settings", icon: "⚙" },
];

const MOBILE_NAV = NAV.filter((item) =>
  ["/dashboard", "/calendar", "/reader", "/settings"].includes(item.href)
);

const emptySubscribe = () => () => {};

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { setTheme, resolved } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/") ||
    (href === "/reader" && pathname.startsWith("/reader"));

  return (
    <div className="min-h-dvh flex flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:bg-accent focus:text-black focus:px-4 focus:py-2 focus:rounded-full"
      >
        Skip to content
      </a>

      <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-line md:bg-surface-raised md:sticky md:top-0 md:h-dvh">
        <div className="p-5 border-b border-line">
          <Link href="/dashboard" className="font-semibold tracking-tight text-lg xl:text-xl">
            Bible Tracker
          </Link>
          <p className="text-sm text-ink-subtle mt-0.5">Read. Track. Finish.</p>
        </div>
        <nav className="flex-1 p-3 space-y-1" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive(item.href)
                  ? "bg-accent text-[#042f2e]"
                  : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
              }`}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-line space-y-2">
          <button
            type="button"
            className="btn btn-ghost w-full justify-start text-sm"
            onClick={() =>
              setTheme(
                resolved === "dark" ? "light" : "dark"
              )
            }
            aria-label={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`}
          >
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
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        <header className="md:hidden sticky top-0 z-40 bg-surface-raised/90 backdrop-blur border-b border-line">
          <div className="flex items-center justify-between px-4 h-14">
            <Link href="/dashboard" className="font-semibold text-lg">
              Bible Tracker
            </Link>
            <button
              type="button"
              className="btn btn-ghost text-sm px-3 py-1.5"
              onClick={() =>
                setTheme(resolved === "dark" ? "light" : "dark")
              }
              aria-label="Toggle theme"
            >
              {mounted ? (resolved === "dark" ? "Light" : "Dark") : "Theme"}
            </button>
          </div>
        </header>

        <main id="main" className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-10">
          {children}
        </main>
      </div>

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-raised/95 backdrop-blur border-t border-line"
        aria-label="Primary"
      >
        <ul className="flex justify-around">
          {MOBILE_NAV.map((item) => (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "text-accent"
                    : "text-ink-subtle hover:text-ink"
                }`}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                <span aria-hidden className="text-base leading-none">
                  {item.icon}
                </span>
                {item.short}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
