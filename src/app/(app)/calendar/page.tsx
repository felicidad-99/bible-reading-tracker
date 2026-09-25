"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatChapterRange, type ChapterRange } from "@/lib/plan/generator";

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

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In Progress",
  completed: "Completed",
  missed: "Missed",
};

const STATUS_CLASS: Record<string, string> = {
  not_started: "status-not-started",
  in_progress: "status-in-progress",
  completed: "status-completed",
  missed: "status-missed",
};

export default function CalendarPage() {
  const [days, setDays] = useState<CalDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalDay | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/calendar")
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok) throw new Error(data.error || "Failed to load");
        setDays(data.days);
        const current = data.days.find((d: CalDay) => d.isToday);
        setSelected(current ?? data.days[0] ?? null);
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

  if (loading) {
    return (
      <div aria-busy="true">
        <p className="sr-only">Loading calendar</p>
        <div className="h-8 w-40 bg-surface-sunken rounded animate-pulse" />
        <div className="mt-6 grid grid-cols-7 gap-2">
          {Array.from({ length: 28 }).map((_, i) => (
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
          Create My Plan
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Calendar</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">
          Your reading plan
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {days.length} days · select a day for session details
        </p>
      </header>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="list">
            {days.map((day) => (
              <li key={day.id}>
                <button
                  type="button"
                  className={`w-full text-left card p-4 transition-all duration-200 ${
                    selected?.id === day.id
                      ? "border-accent ring-1 ring-accent"
                      : "hover:border-ink-subtle"
                  } ${day.isToday ? "shadow-sm" : ""}`}
                  onClick={() => setSelected(day)}
                  aria-pressed={selected?.id === day.id}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-ink-subtle tabular-nums">
                        {formatShortDate(day.date)}
                      </p>
                      <p className="font-medium text-sm mt-0.5">
                        Day {day.dayNumber}
                        {day.isToday && (
                          <span className="ml-2 text-accent text-sm font-semibold">
                            Today
                          </span>
                        )}
                      </p>
                    </div>
                    <span className={`status-pill ${STATUS_CLASS[day.status] ?? ""}`}>
                      {STATUS_LABEL[day.status] ?? day.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-ink-muted tabular-nums">
                    {day.totalChapters} chapters ·{" "}
                    {day.sessions.length} session
                    {day.sessions.length === 1 ? "" : "s"}
                  </p>
                  <div className="mt-2 progress-track" aria-hidden>
                    <div
                      className="progress-fill"
                      style={{
                        width: `${
                          day.totalChapters
                            ? Math.round(
                                (day.completedChapters / day.totalChapters) * 100
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <aside className="lg:col-span-2">
          {selected ? (
            <div className="card p-5 lg:sticky lg:top-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-ink-subtle tabular-nums">
                    {formatLongDate(selected.date)}
                  </p>
                  <h2 className="mt-1 font-semibold">Day {selected.dayNumber}</h2>
                </div>
                <span className={`status-pill ${STATUS_CLASS[selected.status] ?? ""}`}>
                  {STATUS_LABEL[selected.status]}
                </span>
              </div>

              <p className="mt-3 text-sm text-ink-muted tabular-nums">
                {selected.completedChapters}/{selected.totalChapters} chapters completed
              </p>

              <ul className="mt-4 space-y-3">
                {selected.sessions.map((s) => (
                  <li key={s.id} className="border-t border-line pt-3 first:border-0 first:pt-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {s.sessionNumber === 1
                          ? "Morning"
                          : s.sessionNumber === 2
                            ? "Afternoon"
                            : "Evening"}
                      </span>
                      <span className={`status-pill ${STATUS_CLASS[s.status] ?? ""}`}>
                        {STATUS_LABEL[s.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      {s.chapters.map(formatChapterRange).join(", ")}
                    </p>
                    <p className="text-sm text-ink-subtle tabular-nums mt-0.5">
                      Scheduled {s.scheduledTime} · {s.chapterCount} chapters
                    </p>
                    {s.status !== "completed" && (
                      <Link
                        href={`/reader?session=${s.id}`}
                        className="btn btn-secondary text-sm mt-2"
                      >
                        Open reading
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatLongDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
