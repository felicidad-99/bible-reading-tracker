"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatChapterRange, type ChapterRange } from "@/lib/plan/generator";
import { derivePlanName } from "@/lib/plan/presets";

interface CalSession {
  id: string;
  sessionNumber: number;
  scheduledTime: string;
  status: string;
  chapterCount: number;
  chapters: ChapterRange[];
}

interface CalDay {
  id: string;
  date: string;
  dayNumber: number;
  status: string;
  totalChapters: number;
  completedChapters: number;
  isToday: boolean;
  sessions: CalSession[];
}

interface MonthCell {
  iso: string | null;
  day: CalDay | null;
  inMonth: boolean;
}

const SESSION_NAMES = ["Morning", "Afternoon", "Evening"];
const WEEKDAY_LABELS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function CalendarPage() {
  const [days, setDays] = useState<CalDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalDay | null>(null);
  const [viewMonth, setViewMonth] = useState<{ y: number; m: number } | null>(
    null
  );
  const [currentStreak, setCurrentStreak] = useState(0);
  const [planPercent, setPlanPercent] = useState(0);
  const [planName, setPlanName] = useState<string | null>(null);
  const [planDuration, setPlanDuration] = useState(0);
  const [planFrequency, setPlanFrequency] = useState(1);
  const detailRef = useRef<HTMLElement | null>(null);

  const selectDay = (day: CalDay) => {
    setSelected(day);
    if (
      typeof window !== "undefined" &&
      !window.matchMedia("(min-width: 1024px)").matches
    ) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/calendar")
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok) throw new Error(data.error || "Failed to load");
        setDays(data.days);
        setCurrentStreak(data.currentStreak ?? 0);
        setPlanPercent(data.percent ?? 0);
        setPlanName(data.plan?.name ?? null);
        setPlanDuration(data.plan?.durationDays ?? 0);
        setPlanFrequency(data.plan?.frequency ?? 1);
        const current: CalDay | undefined = data.days.find(
          (d: CalDay) => d.isToday
        );
        setSelected(current ?? data.days[0] ?? null);
        const anchor = current ?? data.days[0];
        if (anchor) {
          setViewMonth({
            y: Number(anchor.date.slice(0, 4)),
            m: Number(anchor.date.slice(5, 7)) - 1,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dayByIso = useMemo(() => {
    const map = new Map<string, CalDay>();
    for (const d of days) map.set(d.date, d);
    return map;
  }, [days]);

  const cells: MonthCell[] = useMemo(() => {
    if (!viewMonth) return [];
    const { y, m } = viewMonth;
    const first = new Date(Date.UTC(y, m, 1));
    const startDow = (first.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const out: MonthCell[] = [];
    for (let i = startDow; i > 0; i--) {
      const d = new Date(Date.UTC(y, m, 1 - i));
      out.push({ iso: d.toISOString().slice(0, 10), day: null, inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
      out.push({ iso, day: dayByIso.get(iso) ?? null, inMonth: true });
    }
    let trail = 1;
    while (out.length % 7 !== 0) {
      const d = new Date(Date.UTC(y, m + 1, trail++));
      out.push({ iso: d.toISOString().slice(0, 10), day: null, inMonth: false });
    }
    return out;
  }, [viewMonth, dayByIso]);

  const monthSummary = useMemo(() => {
    if (!viewMonth) return { completed: 0, total: 0 };
    const prefix = `${viewMonth.y}-${pad(viewMonth.m + 1)}`;
    const inMonth = days.filter((d) => d.date.startsWith(prefix));
    return {
      completed: inMonth.filter((d) => d.status === "completed").length,
      total: inMonth.length,
    };
  }, [days, viewMonth]);

  if (loading) {
    return (
      <div aria-busy="true">
        <p className="sr-only">Loading calendar</p>
        <div className="h-8 w-40 bg-surface-sunken rounded animate-pulse" />
        <div className="mt-6 grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="aspect-square card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="text-center py-16">
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="text-center py-16">
        <h1 className="text-xl font-semibold">No plan yet</h1>
        <p className="mt-2 text-ink-muted">Create a reading plan to see your calendar.</p>
        <Link href="/onboarding" className="btn btn-primary mt-5">
          Create my plan
        </Link>
      </div>
    );
  }

  function shiftMonth(delta: number) {
    setViewMonth((cur) => {
      if (!cur) return cur;
      const d = new Date(Date.UTC(cur.y, cur.m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  }

  function goToday() {
    const now = new Date();
    setViewMonth({ y: now.getFullYear(), m: now.getMonth() });
    const today = days.find((d) => d.isToday);
    if (today) setSelected(today);
  }

  const planLabel =
    planName ?? (planDuration > 0 ? derivePlanName(planDuration, planFrequency) : "Your reading plan");
  const nextOpen = selected?.sessions.find((s) => s.status !== "completed") ?? null;

  return (
    <div className="max-w-md mx-auto lg:max-w-4xl">
      <div className="-mx-4 md:-mx-8 border-b border-line">
        <div className="flex justify-between items-center px-4 md:px-8 py-2">
          <div className="flex items-center gap-3">
            <span
              className="w-8 h-8 rounded-full bg-surface-sunken border border-line flex items-center justify-center text-ink-muted overflow-hidden"
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-[20px]">account_circle</span>
            </span>
            <span className="text-xl font-medium tracking-tight">Bible Track</span>
          </div>
          <Link
            href="/settings"
            className="w-11 h-11 -mr-1.5 rounded-full flex items-center justify-center text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors duration-150"
            aria-label="Notification settings"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              notifications
            </span>
          </Link>
        </div>
      </div>

      <div className="pt-4 space-y-4">
        <section className="space-y-2 fade-up">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="eyebrow">Reading log</p>
              <h1 className="text-2xl font-medium tracking-tight truncate">
                {viewMonth ? `${MONTHS[viewMonth.m]} ${viewMonth.y}` : "Calendar"}
              </h1>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                className="min-h-11 px-3 rounded-lg text-sm font-medium text-accent-ink hover:bg-surface-sunken transition-colors duration-150"
                onClick={goToday}
              >
                Today
              </button>
              <button
                type="button"
                className="btn btn-ghost w-11 h-11 p-0 justify-center"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  chevron_left
                </span>
              </button>
              <button
                type="button"
                className="btn btn-ghost w-11 h-11 p-0 justify-center"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  chevron_right
                </span>
              </button>
            </div>
          </div>

          <div className="card px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-verdant shrink-0" aria-hidden="true" />
              <span className="font-medium text-ink tabular-nums whitespace-nowrap">
                {monthSummary.completed} of {monthSummary.total} days
              </span>
              <span className="text-ink-muted">completed</span>
            </div>
            <div className="h-3 w-px bg-line shrink-0" aria-hidden="true" />
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className="material-symbols-outlined text-[16px] text-ember fill-icon"
                aria-hidden="true"
              >
                local_fire_department
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {currentStreak} day streak
              </span>
            </div>
          </div>
        </section>

        <div className="lg:grid lg:grid-cols-5 lg:gap-6">
          <aside
            className="order-first lg:order-none lg:col-span-2 scroll-mt-20"
            ref={detailRef}
          >
            {selected ? (
              <div className="card p-4 lg:sticky lg:top-6 space-y-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="eyebrow">
                      Day {selected.dayNumber} · {formatDayDetail(selected.date)}
                    </p>
                    <h2 className="text-lg font-semibold">Daily Passage</h2>
                  </div>
                  <span className="bg-sandstone-soft text-sandstone border border-line px-2.5 py-1 rounded-full text-sm font-medium max-w-[45%] truncate">
                    {planLabel}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-ink-muted tabular-nums">
                      {planPercent}% of plan complete
                    </span>
                    <span className="text-verdant font-semibold tabular-nums">
                      {selected.completedChapters} of {selected.totalChapters} chapters
                    </span>
                  </div>
                  <div
                    className="h-1.5 w-full bg-line rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={planPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Plan progress"
                  >
                    <div
                      className="h-full bg-verdant rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          selected.totalChapters
                            ? Math.round(
                                (selected.completedChapters / selected.totalChapters) * 100
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <ul className="divide-y divide-line">
                  {selected.sessions.map((s) => {
                    const done = s.status === "completed";
                    const isNext = nextOpen && nextOpen.id === s.id;
                    const name = SESSION_NAMES[s.sessionNumber - 1] ?? `Session ${s.sessionNumber}`;
                    return (
                      <li key={s.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                              done
                                ? "bg-verdant text-surface"
                                : "border border-line bg-surface-raised hover:border-sandstone transition-colors"
                            }`}
                            aria-hidden="true"
                          >
                            {done && (
                              <span className="material-symbols-outlined text-[14px]">check</span>
                            )}
                          </span>
                          <div className="min-w-0">
                            <p
                              className={`text-lg font-semibold truncate ${
                                done ? "line-through opacity-70" : ""
                              }`}
                            >
                              {s.chapters.map(formatChapterRange).join(", ")}
                            </p>
                            <p className="text-sm text-ink-muted mt-0.5 truncate">
                              {name} · {s.scheduledTime} · {s.chapterCount} chapter
                              {s.chapterCount === 1 ? "" : "s"} · ~{s.chapterCount * 3} min
                            </p>
                          </div>
                        </div>
                        {isNext ? (
                          <Link
                            href={`/reader?session=${s.id}`}
                            className="text-sm font-semibold uppercase tracking-wider text-sandstone bg-sandstone-soft px-2 py-0.5 rounded shrink-0"
                            aria-label={`Open ${name} session in reader`}
                          >
                            Next
                          </Link>
                        ) : (
                          <Link
                            href={`/reader?session=${s.id}`}
                            className="p-1 text-ink-muted hover:text-ink transition-colors shrink-0"
                            aria-label={`Open ${name} session in reader`}
                          >
                            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                              menu_book
                            </span>
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {nextOpen ? (
                  <Link
                    href={`/reader?session=${nextOpen.id}`}
                    className="btn btn-primary w-full justify-center"
                  >
                    {selected.isToday ? "Read today's chapters" : "Open reading"}
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                      arrow_forward
                    </span>
                  </Link>
                ) : (
                  <p className="text-sm text-verdant text-center font-medium">
                    All readings completed for this day.
                  </p>
                )}
              </div>
            ) : null}
          </aside>

          <section className="card p-4 shadow-sm" aria-label="Month grid">
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {WEEKDAY_LABELS.map((d) => (
                <span
                  key={d}
                  className="text-sm font-semibold uppercase tracking-wider text-ink-muted"
                  aria-hidden="true"
                >
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 select-none">
              {cells.map((cell, i) => {
                if (!cell.iso) return null;
                const dayNum = Number(cell.iso.slice(8, 10));
                if (!cell.inMonth) {
                  return (
                    <span
                      key={`adj-${i}`}
                      className="h-11 rounded-lg flex items-center justify-center text-sm text-ink-subtle tabular-nums"
                      aria-hidden="true"
                    >
                      {dayNum}
                    </span>
                  );
                }
                const day = cell.day;
                const isSelected = selected?.date === cell.iso;
                const isToday = day?.isToday ?? false;
                const cls = day
                  ? [
                      "h-11 rounded-lg flex flex-col items-center justify-center text-sm tabular-nums transition-colors",
                      day.status === "completed"
                        ? "bg-verdant-soft text-verdant font-medium"
                        : day.status === "missed"
                          ? "bg-sandstone-soft text-sandstone"
                          : "text-ink hover:bg-surface-sunken",
                      isToday ? "bg-ember text-ink font-semibold shadow-sm" : "",
                      isSelected && !isToday ? "ring-2 ring-ink font-semibold" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")
                  : "h-11 rounded-lg flex items-center justify-center text-sm tabular-nums text-ink-subtle";
                const label = day
                  ? `${cell.iso}: ${day.status === "completed" ? "completed" : day.status === "missed" ? "missed" : "scheduled"}${isToday ? ", today" : ""}${isSelected ? ", selected" : ""}`
                  : `${cell.iso}: not scheduled`;
                if (!day) {
                  return (
                    <span key={cell.iso} className={cls} aria-label={label}>
                      {dayNum}
                    </span>
                  );
                }
                const showDot = day.status === "completed" || isToday || day.status === "missed";
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    className={cls}
                    onClick={() => selectDay(day)}
                    aria-label={label}
                    aria-pressed={isSelected}
                  >
                    <span>{dayNum}</span>
                    {showDot && (
                      <span
                        className={`w-1 h-1 rounded-full mt-0.5 ${
                          day.status === "completed"
                            ? "bg-verdant"
                            : day.status === "missed"
                              ? "bg-sandstone"
                              : isToday
                                ? "bg-ink"
                                : ""
                        }`}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <ul className="mt-4 pt-3 border-t border-line flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium uppercase tracking-wide text-ink-muted">
              <li className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-verdant" aria-hidden="true" />
                Completed
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sandstone-soft ring-1 ring-line" aria-hidden="true" />
                Missed
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full border border-line bg-surface-raised" aria-hidden="true" />
                Unread
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-ember" aria-hidden="true" />
                Today
              </li>
            </ul>
          </section>
        </div>

        <div className="text-center py-2">
          <p className="text-sm italic text-ink-muted">
            &ldquo;Thy word is a lamp unto my feet, and a light unto my path.&rdquo;
          </p>
          <p className="text-sm font-semibold uppercase tracking-widest text-ink-subtle mt-1">
            Psalm 119:105
          </p>
        </div>
      </div>
    </div>
  );
}

function formatDayDetail(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
