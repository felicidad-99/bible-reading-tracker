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
      <div className="space-y-4" aria-busy="true">
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
  const firstName = userName?.trim().split(/\s+/)[0] ?? null;
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

  return (
    <div className="space-y-6">
      <header className="fade-up">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          {firstName ? `${greeting}, ${firstName}` : greeting}
        </h1>
        <p className="mt-1 text-ink-muted">{dateLine}</p>
      </header>

      <section
        className="card p-5 md:p-6 fade-up"
        aria-labelledby="today-heading"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold bg-ember-soft text-accent-ink px-3 py-1 rounded-full tabular-nums">
            Day {stats.currentDay} of {stats.totalDays}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium bg-surface-sunken px-3 py-1 rounded-full tabular-nums">
            <span
              className="material-symbols-outlined text-[16px] text-ember fill-icon"
              aria-hidden="true"
            >
              local_fire_department
            </span>
            {stats.currentStreak} day streak
          </span>
        </div>

        <div className="mt-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-ink-muted" id="today-heading">
              {planLabel}
            </p>
            {readingLabel ? (
              <p className="mt-1 text-xl md:text-2xl font-semibold tracking-tight">
                {readingLabel}
              </p>
            ) : (
              <p className="mt-1 text-xl md:text-2xl font-semibold tracking-tight">
                Plan complete
              </p>
            )}
            <p className="mt-1 text-sm text-ink-muted tabular-nums">
              {allTodayDone && todaySessions.length > 0
                ? "All caught up today · next reading tomorrow"
                : readingLabel
                  ? `${readingCount} chapters · ~${readingCount * 3} min`
                  : "Every scheduled reading is finished."}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-3xl md:text-4xl font-semibold tracking-tight tabular-nums">
              {Math.round(stats.percent)}
            </span>
            <span className="ml-1 text-sm font-semibold text-accent-ink">
              % Done
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {ctaHref ? (
            <Link href={ctaHref} className="btn btn-primary">
              Continue reading
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                arrow_forward
              </span>
            </Link>
          ) : (
            <Link href="/calendar" className="btn btn-secondary">
              Open calendar
            </Link>
          )}
        </div>
      </section>

      {todaySessions.length > 0 && (
        <section className="fade-up" aria-labelledby="sessions-heading">
          <h2 id="sessions-heading" className="text-lg font-semibold tracking-tight">
            Today&apos;s reading
          </h2>
          <ul className="mt-3 space-y-3">
            {todaySessions.map((session) => (
              <li key={session.id}>
                <SessionCard session={session} onComplete={load} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 fade-up fade-up-delay-1">
        <div className="card p-5 flex items-center gap-4">
          <span className="w-11 h-11 rounded-xl bg-ember-soft flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-[22px] text-accent-ink"
              aria-hidden="true"
            >
              history
            </span>
          </span>
          <div className="min-w-0">
            <p className="text-sm text-ink-muted">Current</p>
            <p className="text-xl font-semibold tracking-tight tabular-nums">
              {stats.currentStreak} day streak
            </p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <span className="w-11 h-11 rounded-xl bg-verdant-soft flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-[22px] text-verdant"
              aria-hidden="true"
            >
              auto_stories
            </span>
          </span>
          <div className="min-w-0">
            <p className="text-sm text-ink-muted">Total</p>
            <p className="text-xl font-semibold tracking-tight tabular-nums">
              {stats.completedChapters.toLocaleString()} chapters read
            </p>
          </div>
        </div>
      </section>

      <section
        className="card p-5 fade-up fade-up-delay-2"
        aria-labelledby="week-heading"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="week-heading" className="font-semibold tracking-tight">
            This week&apos;s rhythm
          </h2>
          <span className="text-sm text-ink-muted tabular-nums">
            {stats.weekDone} of {stats.weekTarget} target
          </span>
        </div>
        <ol className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2">
          {stats.week.map((day, i) => {
            const dayNum = day.date.slice(8, 10).replace(/^0/, "");
            const circle =
              day.status === "completed"
                ? "bg-ember-soft text-accent-ink ring-1 ring-ember/40"
                : day.date === stats.todayDay?.date
                  ? "bg-surface-raised text-accent-ink ring-2 ring-accent-ink font-semibold"
                  : day.status === "missed"
                    ? "bg-sandstone-soft text-sandstone"
                    : "bg-surface-sunken text-ink-muted";
            return (
              <li
                key={day.date}
                className="flex flex-col items-center gap-1.5"
                aria-label={`${day.date}: ${day.status}`}
              >
                <span className="text-sm text-ink-muted" aria-hidden="true">
                  {WEEK_LABELS[i]}
                </span>
                <span
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${circle}`}
                  aria-hidden="true"
                >
                  {day.status === "completed" ? (
                    <span className="material-symbols-outlined text-[18px] fill-icon">
                      check
                    </span>
                  ) : day.status === "missed" ? (
                    <span className="material-symbols-outlined text-[18px]">
                      history_toggle_off
                    </span>
                  ) : (
                    <span className="text-sm tabular-nums">{dayNum}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {hasMissed && (
        <div className="card p-5 fade-up fade-up-delay-3" role="status">
          <div className="flex gap-3">
            <span className="w-10 h-10 rounded-xl bg-surface-sunken flex items-center justify-center shrink-0">
              <span
                className="material-symbols-outlined text-[20px] text-ink-muted"
                aria-hidden="true"
              >
                history_toggle_off
              </span>
            </span>
            <div className="min-w-0">
              <p className="font-medium">Missed a day?</p>
              <p className="text-sm text-ink-muted mt-0.5">
                Your history is preserved. Read at your own peaceful pace
                without penalty.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/calendar" className="btn btn-secondary text-sm">
              View calendar
            </Link>
            <button
              type="button"
              className="btn btn-primary text-sm"
              onClick={runCatchUp}
              disabled={busy}
            >
              {busy ? "Working…" : "Catch up"}
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                chevron_right
              </span>
            </button>
          </div>
          {catchUpMsg && (
            <p className="mt-3 text-sm text-accent-ink" role="status">
              {catchUpMsg}
            </p>
          )}
        </div>
      )}

      <PushPromptCard />

      <GroupsSection variant="preview" />
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
    <div className="card p-5 flex flex-wrap items-center justify-between gap-4">
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
