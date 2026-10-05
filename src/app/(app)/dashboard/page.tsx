"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formatChapterRange,
  type ChapterRange,
} from "@/lib/plan/generator";
import { derivePlanName } from "@/lib/plan/presets";
import { GroupsSection } from "@/components/groups-section";
import { PushPromptCard } from "@/components/push-prompt-card";

interface SessionInfo {
  id: string;
  sessionNumber: number;
  scheduledTime: string;
  status: string;
  chapters: ChapterRange[];
  chapterCount: number;
}

interface DayInfo {
  date: string;
  dayNumber: number;
  sessions: SessionInfo[];
}

interface WeekDay {
  date: string;
  status: string;
}

interface Stats {
  completedChapters: number;
  totalChapters: number;
  percent: number;
  currentDay: number;
  totalDays: number;
  daysRemaining: number;
  currentStreak: number;
  longestStreak: number;
  remainingChapters: number;
  finishDate: string;
  todayDay: DayInfo | null;
  missedCount: number;
  week: WeekDay[];
  weekTarget: number;
  weekDone: number;
  nextReading: {
    sessionId: string;
    sessionNumber: number;
    scheduledTime: string;
    date: string;
    dayNumber: number;
    chapters: ChapterRange[];
    chapterCount: number;
    status: string;
  } | null;
}

interface PlanInfo {
  id: string;
  status: string;
  name: string | null;
  durationDays: number;
  frequency: number;
}

const SESSION_NAMES = ["Morning", "Afternoon", "Evening"];
const WEEK_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const RING_CIRCUMFERENCE = 427.25;

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catchUpMsg, setCatchUpMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setStats(data.stats);
      setPlan(data.plan);
      setUserName(data.user?.name ?? null);
      setError(data.plan ? null : "no-plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const res = await fetch("/api/dashboard");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Failed to load");
        setStats(data.stats);
        setPlan(data.plan);
        setUserName(data.user?.name ?? null);
        setError(data.plan ? null : "no-plan");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  async function runCatchUp() {
    setBusy(true);
    try {
      const res = await fetch("/api/plans/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "catch_up" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Catch up failed");
      setCatchUpMsg(
        data.addedChapters > 0
          ? `${data.addedChapters} chapters redistributed across upcoming days.`
          : data.message || "Already up to date."
      );
      await load();
    } catch (err) {
      setCatchUpMsg(err instanceof Error ? err.message : "Catch up failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="pt-5 space-y-4" aria-busy="true">
        <div className="h-8 w-48 bg-surface-sunken rounded animate-pulse" />
        <div className="h-44 card" />
        <div className="h-32 card" />
        <span className="sr-only">Loading dashboard</span>
      </div>
    );
  }

  if (error === "no-plan" || !plan) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <span className="mx-auto w-14 h-14 rounded-xl bg-sandstone-soft flex items-center justify-center">
          <span
            className="material-symbols-outlined text-ember text-[28px] fill-icon"
            aria-hidden="true"
          >
            auto_stories
          </span>
        </span>
        <h1 className="mt-5 text-xl font-semibold">No reading plan yet</h1>
        <p className="mt-3 text-ink-muted">
          You don&apos;t have an active reading plan yet.
        </p>
        <Link href="/onboarding" className="btn btn-primary mt-6">
          Create my plan
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-16" role="alert">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-3 text-ink-muted">{error}</p>
        <button type="button" className="btn btn-secondary mt-6" onClick={load}>
          Try again
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const todaySessions = stats.todayDay?.sessions ?? [];
  const allTodayDone =
    todaySessions.length > 0 && todaySessions.every((s) => s.status === "completed");
  const hasMissed = stats.missedCount > 0;
  const nameParts = userName?.trim().split(/\s+/) ?? [];
  const initials =
    nameParts.length >= 2
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : nameParts[0]?.[0]?.toUpperCase() ?? null;
  const firstName = nameParts[0] ?? null;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateLine = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const planLabel = plan.name ?? derivePlanName(plan.durationDays, plan.frequency);

  const firstOpen = todaySessions.find((s) => s.status !== "completed");
  const ctaSession = firstOpen ?? stats.nextReading;
  const ctaHref = ctaSession
    ? "id" in ctaSession
      ? `/reader?session=${ctaSession.id}`
      : `/reader?session=${ctaSession.sessionId}`
    : null;
  const readingChapters =
    todaySessions.length > 0
      ? todaySessions.flatMap((s) => s.chapters)
      : (stats.nextReading?.chapters ?? []);
  const readingCount =
    todaySessions.length > 0
      ? todaySessions.reduce((n, s) => n + s.chapterCount, 0)
      : (stats.nextReading?.chapterCount ?? 0);
  const readingLabel =
    readingChapters.length > 0
      ? readingChapters.map(formatChapterRange).join(" & ")
      : null;
  const percent = Math.min(100, Math.max(0, Math.round(stats.percent)));
  const ringOffset = RING_CIRCUMFERENCE * (1 - percent / 100);

  return (
    <div className="mx-auto w-full max-w-2xl lg:max-w-3xl">
      <header className="pt-5 pb-4 flex items-center justify-between fade-up">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">
            {firstName ? `${greeting}, ${firstName}` : greeting}
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">{dateLine}</p>
        </div>
        <Link
          href="/settings"
          className="w-10 h-10 rounded-full bg-surface-raised border border-line flex items-center justify-center text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors duration-150 active:scale-95 shadow-sm shrink-0"
          aria-label={initials ? `Profile of ${userName}` : "Open profile"}
        >
          {initials ? (
            <span className="text-sm font-semibold tracking-wide">{initials}</span>
          ) : (
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              person
            </span>
          )}
        </Link>
      </header>

      <div className="space-y-4">
        <section
          className="card p-5 flex flex-col items-center text-center fade-up"
          aria-labelledby="today-heading"
        >
          <div className="w-full flex items-center justify-between pb-2.5">
            <span className="eyebrow text-sandstone">
              Day {stats.currentDay} of {stats.totalDays}
            </span>
            <span className="inline-flex items-center text-ink-muted text-sm font-medium">
              <span
                className="material-symbols-outlined text-[16px] mr-1 text-sandstone fill-icon"
                aria-hidden="true"
              >
                local_fire_department
              </span>
              Day Streak {stats.currentStreak}
            </span>
          </div>

          <h2 id="today-heading" className="w-full text-left text-xl font-medium mb-3">
            {planLabel}
          </h2>

          <div className="w-full flex items-center gap-2">
            <div
              className="relative w-28 h-28 shrink-0 flex items-center justify-center"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Plan progress"
            >
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 160 160" aria-hidden="true">
                <circle
                  cx="80"
                  cy="80"
                  r="68"
                  fill="transparent"
                  strokeWidth="10"
                  className="stroke-surface-sunken"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="68"
                  fill="transparent"
                  strokeWidth="10"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  className="stroke-ember transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-1">
                <span className="text-2xl font-semibold tracking-tight leading-none tabular-nums">
                  {percent}
                  <span className="text-sm font-normal text-ink-muted ml-0.5">%</span>
                </span>
                <span className="text-sm font-semibold text-ink-muted uppercase tracking-wider mt-0.5">
                  Done
                </span>
              </div>
            </div>

            <div className="flex-1 min-w-0 flex flex-col items-start justify-center text-left pl-1">
              <div className="text-[18px] font-semibold tracking-tight leading-snug">
                {readingLabel ?? "Plan complete"}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-ink-muted text-sm">
                {readingLabel ? (
                  <>
                    <span className="tabular-nums">
                      {allTodayDone && todaySessions.length > 0
                        ? "All done today"
                        : `${readingCount} chapters`}
                    </span>
                    {!allTodayDone && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-line inline-block" aria-hidden="true" />
                        <span className="tabular-nums">~{readingCount * 3} min</span>
                      </>
                    )}
                  </>
                ) : (
                  <span>Every scheduled reading is finished.</span>
                )}
              </div>
              <div className="w-full mt-3">
                {ctaHref ? (
                  <Link href={ctaHref} className="btn btn-primary w-full">
                    Continue reading
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                      arrow_forward
                    </span>
                  </Link>
                ) : (
                  <Link href="/calendar" className="btn btn-secondary w-full">
                    Open calendar
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {todaySessions.length > 1 && (
          <section className="fade-up" aria-labelledby="sessions-heading">
            <h2 id="sessions-heading" className="eyebrow">
              Today&apos;s reading
            </h2>
            <ul className="mt-3 space-y-2">
              {todaySessions.map((session) => (
                <li key={session.id}>
                  <SessionCard session={session} onComplete={load} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-2 md:flex-row md:items-start fade-up fade-up-delay-1">
          <div className="grid grid-cols-2 gap-2 md:flex-1">
            <div className="card p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span
                  className="material-symbols-outlined text-[20px] text-ember fill-icon"
                  aria-hidden="true"
                >
                  local_fire_department
                </span>
                <span className="px-2 py-0.5 rounded-full bg-surface-sunken text-accent-ink text-sm font-semibold uppercase tracking-wide">
                  Current
                </span>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-semibold leading-tight tabular-nums">
                  {stats.currentStreak}
                </div>
                <div className="text-sm text-ink-muted mt-0.5">day streak</div>
              </div>
            </div>
            <div className="card p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span
                  className="material-symbols-outlined text-[20px] text-verdant"
                  aria-hidden="true"
                >
                  auto_stories
                </span>
                <span className="px-2 py-0.5 rounded-full bg-verdant-soft text-verdant text-sm font-semibold uppercase tracking-wide">
                  Total
                </span>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-semibold leading-tight tabular-nums">
                  {stats.completedChapters.toLocaleString()}
                </div>
                <div className="text-sm text-ink-muted mt-0.5">chapters read</div>
              </div>
            </div>
          </div>

          <section className="card px-4 py-3 md:flex-1" aria-labelledby="week-heading">
            <div className="flex items-center justify-between mb-2.5">
              <h2 id="week-heading" className="text-sm font-medium text-ink-muted">
                This week&apos;s rhythm
              </h2>
              <span className="text-sm font-medium text-verdant tabular-nums">
                {stats.weekDone} of {stats.weekTarget} target
              </span>
            </div>
            <ol className="flex items-center justify-between pt-1">
              {stats.week.map((day, i) => {
                const isToday = day.date === stats.todayDay?.date;
                const stateLabel =
                  day.status === "completed"
                    ? "completed"
                    : day.status === "missed"
                      ? "missed"
                      : isToday
                        ? "today"
                        : "upcoming";
                return (
                  <li
                    key={day.date}
                    className="flex flex-col items-center gap-1.5"
                    aria-label={`${day.date}: ${stateLabel}`}
                  >
                    <span
                      className={`text-sm font-medium ${
                        isToday && day.status !== "completed"
                          ? "text-accent-ink font-semibold"
                          : "text-ink-muted"
                      }`}
                      aria-hidden="true"
                    >
                      {WEEK_LABELS[i]}
                    </span>
                    <span aria-hidden="true">
                      {day.status === "completed" ? (
                        <span className="w-7 h-7 rounded-full bg-verdant text-surface flex items-center justify-center shadow-sm">
                          <span className="material-symbols-outlined text-[15px]">check</span>
                        </span>
                      ) : day.status === "missed" ? (
                        <span className="w-7 h-7 rounded-full bg-sandstone-soft flex items-center justify-center">
                          <span className="material-symbols-outlined text-[14px] text-sandstone">
                            history_toggle_off
                          </span>
                        </span>
                      ) : isToday ? (
                        <span className="w-7 h-7 rounded-full border-2 border-ember bg-surface-sunken flex items-center justify-center">
                          <span className="w-2.5 h-2.5 rounded-full bg-ember animate-pulse" />
                        </span>
                      ) : (
                        <span className="w-7 h-7 rounded-full border border-line bg-surface-raised flex items-center justify-center" />
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        </section>

        {hasMissed && (
          <section
            className="bg-surface-sunken rounded-lg border border-line p-3.5 flex flex-wrap items-center justify-between fade-up fade-up-delay-2"
            role="status"
          >
            <div className="flex items-start gap-2.5 pr-2">
              <span
                className="material-symbols-outlined text-[20px] text-sandstone mt-0.5"
                aria-hidden="true"
              >
                history_toggle_off
              </span>
              <div>
                <p className="text-sm font-medium leading-snug text-ink">
                  Missed a day? Your history is preserved.
                </p>
                <p className="text-sm text-ink-muted mt-0.5">
                  Read at your own peaceful pace without penalty.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline py-1 pl-2"
              onClick={runCatchUp}
              disabled={busy}
            >
              {busy ? "Working…" : "Catch up"}
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                chevron_right
              </span>
            </button>
            {catchUpMsg && (
              <p className="w-full mt-2 text-sm text-accent-ink" role="status">
                {catchUpMsg}
              </p>
            )}
          </section>
        )}

        <div className="fade-up fade-up-delay-3">
          <GroupsSection variant="preview" />
        </div>

        <PushPromptCard />
      </div>
    </div>
  );
}

function SessionCard({
  session,
  onComplete,
}: {
  session: SessionInfo;
  onComplete: () => void;
}) {
  const label =
    SESSION_NAMES[session.sessionNumber - 1] ?? `Session ${session.sessionNumber}`;
  const reading = session.chapters.map(formatChapterRange).join(", ");
  const done = session.status === "completed";
  const [markError, setMarkError] = useState<string | null>(null);

  async function markComplete() {
    setMarkError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          bookId: session.chapters[0]?.bookId ?? "GEN",
          chapter: session.chapters[0]?.start ?? 1,
          complete: true,
        }),
      });
      if (!res.ok) throw new Error();
      onComplete();
    } catch {
      setMarkError("Unable to mark as complete. Check your connection and try again.");
    }
  }

  return (
    <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-sm text-ink-muted tabular-nums">
            {session.scheduledTime}
          </span>
          <span
            className={`status-pill status-${
              done
                ? "completed"
                : session.status === "missed"
                  ? "missed"
                  : session.status === "in_progress"
                    ? "in-progress"
                    : "not-started"
            }`}
          >
            {done
              ? "Completed"
              : session.status === "missed"
                ? "Missed"
                : session.status === "in_progress"
                  ? "In progress"
                  : "Not started"}
          </span>
        </div>
        <p className="mt-1.5 text-sm text-ink-muted">
          {reading} ({session.chapterCount} chapters)
        </p>
      </div>
      <div className="flex gap-2">
        {!done && (
          <Link
            href={`/reader?session=${session.id}`}
            className="btn btn-primary text-sm"
          >
            Start reading
          </Link>
        )}
        {!done && (
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={markComplete}
          >
            Mark complete
          </button>
        )}
        {done && (
          <Link href={`/reader?session=${session.id}`} className="btn btn-ghost text-sm">
            Review
          </Link>
        )}
      </div>
      {markError && (
        <p role="alert" className="w-full text-sm text-danger">
          {markError}
        </p>
      )}
    </div>
  );
}
