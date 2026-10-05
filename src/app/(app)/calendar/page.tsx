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

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
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
    for (let i = 0; i < startDow; i++) out.push({ iso: null, day: null, inMonth: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
      out.push({ iso, day: dayByIso.get(iso) ?? null, inMonth: true });
    }
    while (out.length % 7 !== 0) {
      out.push({ iso: null, day: null, inMonth: false });
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
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 fade-up">
        <div>
          <p className="eyebrow">Reading log</p>
          <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">
            {viewMonth ? `${MONTHS[viewMonth.m]} ${viewMonth.y}` : "Calendar"}
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" className="btn btn-secondary text-sm" onClick={goToday}>
            Today
          </button>
          <button
            type="button"
            className="btn btn-ghost w-11 h-11 p-0 justify-center"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
              chevron_left
            </span>
          </button>
          <button
            type="button"
            className="btn btn-ghost w-11 h-11 p-0 justify-center"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
              chevron_right
            </span>
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 card px-4 py-3 fade-up">
        <span className="text-sm font-medium tabular-nums">
          {monthSummary.completed} of {monthSummary.total} days completed
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium bg-ember-soft text-accent-ink px-3 py-1 rounded-full tabular-nums">
          <span
            className="material-symbols-outlined text-[16px] fill-icon"
            aria-hidden="true"
          >
            local_fire_department
          </span>
          {currentStreak} day streak
        </span>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <section className="card p-3 sm:p-5" aria-label="Month grid">
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1">
              {WEEKDAY_LABELS.map((d) => (
                <span
                  key={d}
                  className="text-sm text-ink-muted text-center font-medium py-1"
                  aria-hidden="true"
                >
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {cells.map((cell, i) => {
                if (!cell.iso || !cell.inMonth) {
                  return <span key={`blank-${i}`} className="aspect-square" aria-hidden="true" />;
                }
                const dayNum = Number(cell.iso.slice(8, 10));
                const day = cell.day;
                const isSelected = selected?.date === cell.iso;
                const isToday = day?.isToday ?? false;
                const cls = day
                  ? [
                      "aspect-square rounded-lg flex items-center justify-center text-sm tabular-nums transition-colors",
                      day.status === "completed"
                        ? "bg-ember-soft text-accent-ink font-medium"
                        : day.status === "missed"
                          ? "bg-sandstone-soft text-sandstone"
                          : "text-ink hover:bg-surface-sunken",
                      isToday ? "ring-2 ring-accent-ink font-semibold" : "",
                      isSelected && !isToday ? "ring-2 ring-ink font-semibold" : "",
                      isSelected && isToday ? "ring-2 ring-ink" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")
                  : "aspect-square rounded-lg flex items-center justify-center text-sm tabular-nums text-ink-subtle";
                const label = day
                  ? `${cell.iso}: ${day.status === "completed" ? "completed" : day.status === "missed" ? "missed" : "scheduled"}${isToday ? ", today" : ""}${isSelected ? ", selected" : ""}`
                  : `${cell.iso}: not scheduled`;
                return day ? (
                  <button
                    key={cell.iso}
                    type="button"
                    className={cls}
                    onClick={() => selectDay(day)}
                    aria-label={label}
                    aria-pressed={isSelected}
                  >
                    {dayNum}
                  </button>
                ) : (
                  <span key={cell.iso} className={cls} aria-label={label}>
                    {dayNum}
                  </span>
                );
              })}
            </div>
            <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-muted">
              <li className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-ember-soft ring-1 ring-ember/40" aria-hidden="true" />
                Completed
              </li>
              <li className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-sandstone-soft" aria-hidden="true" />
                Missed
              </li>
              <li className="flex items-center gap-2">
                <span className="w-4 h-4 rounded ring-2 ring-accent-ink" aria-hidden="true" />
                Today
              </li>
            </ul>
          </section>
        </div>

        <aside
          className="order-first lg:order-none lg:col-span-2 scroll-mt-20"
          ref={detailRef}
        >
          {selected ? (
            <div className="card p-5 lg:sticky lg:top-6">
              <p className="eyebrow">
                Day {selected.dayNumber} · {formatDayDetail(selected.date)}
              </p>

              <p className="mt-4 text-sm text-ink-muted">Daily passage</p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold tracking-tight">{planLabel}</h2>
                <span className="text-sm font-semibold text-accent-ink tabular-nums">
                  {planPercent}% of plan complete
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 text-sm text-ink-muted tabular-nums">
                <span>
                  {selected.completedChapters} of {selected.totalChapters} chapters
                </span>
                <span className={`status-pill status-${statusKey(selected.status)}`}>
                  {statusLabel(selected.status)}
                </span>
              </div>
              <div className="mt-2 progress-track" aria-hidden>
                <div
                  className="progress-fill"
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

              <ul className="mt-4 space-y-2">
                {selected.sessions.map((s, idx) => {
                  const done = s.status === "completed";
                  const isNext = nextOpen && nextOpen.id === s.id;
                  return (
                    <li
                      key={s.id}
                      className="flex items-start gap-3 rounded-xl border border-line p-3"
                    >
                      <span
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          done
                            ? "bg-verdant-soft text-verdant"
                            : "bg-surface-sunken text-ink-muted"
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-[18px]"
                          aria-hidden="true"
                        >
                          {done ? "check" : "schedule"}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        {isNext && !done && (
                          <p className="text-sm font-semibold uppercase tracking-wide text-accent-ink">
                            Next
                          </p>
                        )}
                        <p className="text-sm font-medium">
                          {s.sessionNumber === 1
                            ? "Morning"
                            : s.sessionNumber === 2
                              ? "Afternoon"
                              : "Evening"}
                          {" · "}
                          <span className="font-normal text-ink-muted tabular-nums">
                            {s.scheduledTime}
                          </span>
                        </p>
                        <p className="text-sm text-ink-muted mt-0.5">
                          {s.chapters.map(formatChapterRange).join(", ")}
                          {" · "}
                          {s.chapterCount} chapter{s.chapterCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      {!done && (
                        <Link
                          href={`/reader?session=${s.id}`}
                          className="btn btn-ghost text-sm px-2 shrink-0"
                          aria-label={`Open session ${idx + 1} in reader`}
                        >
                          <span
                            className="material-symbols-outlined text-[18px]"
                            aria-hidden="true"
                          >
                            menu_book
                          </span>
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>

              {nextOpen && (
                <Link
                  href={`/reader?session=${nextOpen.id}`}
                  className="btn btn-primary w-full mt-4 justify-center"
                >
                  {selected.isToday ? "Read today's chapters" : "Open reading"}
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    arrow_forward
                  </span>
                </Link>
              )}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function statusKey(status: string): string {
  return status === "in_progress"
    ? "in-progress"
    : status === "not_started"
      ? "not-started"
      : status;
}

function statusLabel(status: string): string {
  if (status === "completed") return "Completed";
  if (status === "missed") return "Missed";
  if (status === "in_progress") return "In progress";
  return "Not started";
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
