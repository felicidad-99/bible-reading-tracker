"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formatChapterRange,
  type ChapterRange,
} from "@/lib/plan/generator";

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

const SESSION_NAMES = ["Morning", "Afternoon", "Evening"];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [plan, setPlan] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catchUpMsg, setCatchUpMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function load() {
    try {
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setStats(data.stats);
      setPlan(data.plan);
      setError(data.plan ? null : "no-plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

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

  async function pausePlan() {
    setBusy(true);
    await fetch("/api/plans/current", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pause" }),
    });
    setBusy(false);
    await load();
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-8 w-48 bg-surface-sunken rounded animate-pulse" />
        <div className="h-40 card" />
        <div className="h-32 card" />
        <span className="sr-only">Loading dashboard</span>
      </div>
    );
  }

  if (error === "no-plan" || !plan) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h1 className="text-xl font-semibold">No reading plan yet</h1>
        <p className="mt-3 text-ink-muted">
          You don&apos;t have an active reading plan yet.
        </p>
        <Link href="/onboarding" className="btn btn-primary mt-6">
          Create My Plan
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

  return (
    <div className="space-y-8">
      <header className="fade-up">
        <p className="eyebrow">Dashboard</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">
          Day {stats.currentDay} of {stats.totalDays}
        </h1>
      </header>

      {hasMissed && (
        <div className="card p-5 border-danger/40 fade-up" role="status">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-danger">Missed reading</p>
              <p className="text-sm text-ink-muted mt-0.5">
                {stats.missedCount} past day{stats.missedCount === 1 ? "" : "s"} with unfinished sessions. Your history is preserved.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/calendar" className="btn btn-secondary text-sm">
                Continue Reading
              </Link>
              <button
                type="button"
                className="btn btn-primary text-sm"
                onClick={runCatchUp}
                disabled={busy}
              >
                {busy ? "Working…" : "Catch Up"}
              </button>
            </div>
          </div>
          {catchUpMsg && (
            <p className="mt-3 text-sm text-accent-ink" role="status">
              {catchUpMsg}
            </p>
          )}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 fade-up fade-up-delay-1">
        <StatCard
          label="Progress"
          value={`${stats.completedChapters.toLocaleString()} / ${stats.totalChapters.toLocaleString()}`}
          sub={`${stats.percent}% complete`}
          bar={stats.percent}
        />
        <StatCard
          label="Current streak"
          value={`${stats.currentStreak} days`}
          sub={`Longest: ${stats.longestStreak} days`}
        />
        <StatCard
          label="Remaining"
          value={`${stats.remainingChapters.toLocaleString()} chapters`}
          sub={`${stats.daysRemaining} days left`}
        />
        <StatCard
          label="Finish date"
          value={formatDate(stats.finishDate)}
          sub="On schedule for your plan"
        />
      </section>

      <section className="fade-up fade-up-delay-2" aria-labelledby="today-heading">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="today-heading" className="text-lg font-semibold tracking-tight">
            Today&apos;s reading
          </h2>
          {stats.todayDay && (
            <span className="text-sm text-ink-muted">
              Day {stats.todayDay.dayNumber}
            </span>
          )}
        </div>

        {todaySessions.length === 0 ? (
          <div className="card p-6 mt-4 text-center">
            <p className="text-ink-muted">
              No reading scheduled today. Check the calendar for your next session.
            </p>
            <Link href="/calendar" className="btn btn-secondary mt-4">
              Open calendar
            </Link>
          </div>
        ) : allTodayDone ? (
          <div className="card p-6 mt-4 text-center">
            <p className="font-medium">You&apos;re all caught up.</p>
            <p className="text-sm text-ink-muted mt-1">
              Your next reading is scheduled for tomorrow.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {todaySessions.map((session) => (
              <li key={session.id}>
                <SessionCard session={session} onComplete={load} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-wrap gap-3 fade-up fade-up-delay-3">
        <Link href="/calendar" className="btn btn-secondary">
          View calendar
        </Link>
        <Link href="/reader" className="btn btn-secondary">
          Open reader
        </Link>
        <Link href="/stats" className="btn btn-secondary">
          Statistics
        </Link>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={pausePlan}
          disabled={busy}
        >
          Pause plan
        </button>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  bar,
}: {
  label: string;
  value: string;
  sub?: string;
  bar?: number;
}) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-ink-subtle">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {typeof bar === "number" && (
        <div className="mt-3 progress-track" aria-hidden>
          <div className="progress-fill" style={{ width: `${bar}%` }} />
        </div>
      )}
      {sub && <p className="mt-2 text-sm text-ink-muted">{sub}</p>}
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

  async function markComplete() {
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
    if (res.ok) onComplete();
  }

  return (
    <div className="card p-5 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-xs text-ink-subtle tabular-nums">
            {session.scheduledTime}
          </span>
          <span className={`status-pill status-${done ? "completed" : session.status === "missed" ? "missed" : session.status === "in_progress" ? "in-progress" : "not-started"}`}>
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
            Start Reading
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
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
