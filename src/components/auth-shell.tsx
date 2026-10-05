import Link from "next/link";
import type { ReactNode } from "react";

const VALUE_PROPS = [
  "Daily reading plans that fit your rhythm",
  "Gentle reminders — never noise",
  "Streaks and groups that keep you accountable",
];

export function AuthShell({
  subtitle,
  valueProps = false,
  children,
}: {
  subtitle?: ReactNode;
  valueProps?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[26rem] flex flex-col items-center">
        <Link href="/" aria-label="Bible Track home" className="mb-5">
          <span className="w-14 h-14 rounded-2xl bg-sandstone-soft border border-line flex items-center justify-center shadow-sm">
            <span
              className="material-symbols-outlined text-ember text-[30px] fill-icon"
              aria-hidden="true"
            >
              local_fire_department
            </span>
          </span>
        </Link>

        <div className="text-center mb-6">
          <h1 className="text-4xl font-semibold tracking-tight">Bible Track</h1>
          <p className="mt-1.5 text-base text-ink-muted font-light">
            A quieter way to keep the Word
          </p>
        </div>

        {valueProps && (
          <ul className="w-full bg-surface-raised/70 border border-line rounded-xl p-3.5 mb-6 space-y-2.5">
            {VALUE_PROPS.map((text) => (
              <li key={text} className="flex items-center gap-2.5">
                <span
                  className="w-4 h-4 rounded-full bg-verdant-soft flex items-center justify-center shrink-0"
                  aria-hidden="true"
                >
                  <span className="material-symbols-outlined text-verdant text-[11px]">
                    check
                  </span>
                </span>
                <span className="text-sm text-ink-muted">{text}</span>
              </li>
            ))}
          </ul>
        )}

        {subtitle && (
          <p className="text-base text-ink-muted text-center w-full mb-5">
            {subtitle}
          </p>
        )}

        <div className="w-full">{children}</div>
      </div>
    </main>
  );
}
