"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  completedChapters: number;
  totalChapters: number;
  percent: number;
  currentStreak: number;
  longestStreak: number;
  sessionsCompleted: number;
  sessionsTotal: number;
  sessionsMissed: number;
  currentDay: number;
  totalDays: number;
  daysRemaining: number;
  estimatedCompletion: string;
  finishDate: string;
  translation: string;
  frequency: number;
  startDate: string;
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Failed to load");
        setStats(data.stats);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div aria-busy="true" className="space-y-4">
        <div className="h-8 w-40 bg-surface-sunken rounded animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-center py-16" role="alert">
        <p className="text-danger">{error || "No stats yet"}</p>
        <Link href="/onboarding" className="btn btn-primary mt-5">
          Create a plan
        </Link>
      </div>
    );
  }

  const items = [
    {
      group: "Overall",
      rows: [
        ["Chapters completed", `${stats.completedChapters.toLocaleString()} / ${stats.totalChapters.toLocaleString()}`],
        ["Percentage complete", `${stats.percent}%`],
        ["Chapters remaining", (stats.totalChapters - stats.completedChapters).toLocaleString()],
      ],
    },
    {
      group: "Reading",
      rows: [
        ["Current streak", `${stats.currentStreak} days`],
        ["Longest streak", `${stats.longestStreak} days`],
        ["Sessions completed", `${stats.sessionsCompleted} / ${stats.sessionsTotal}`],
        ["Sessions missed", String(stats.sessionsMissed)],
      ],
    },
    {
      group: "Plan",
      rows: [
        ["Day", `${stats.currentDay} / ${stats.totalDays}`],
        ["Days remaining", String(stats.daysRemaining)],
        ["Start date", formatDate(stats.startDate)],
        ["Planned finish", formatDate(stats.finishDate)],
        ["Estimated completion", formatDate(stats.estimatedCompletion)],
        ["Translation", stats.translation],
        [
          "Frequency",
          stats.frequency === 1
            ? "Once daily"
            : stats.frequency === 2
              ? "Twice daily"
              : "Thrice daily",
        ],
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Statistics</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">
          Your reading at a glance
        </h1>
        <p className="mt-2 text-sm text-ink-muted max-w-lg">
          Useful numbers to stay oriented. No leaderboards, no points.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        {items.map((section) => (
          <section key={section.group} className="card p-5">
            <h2 className="text-sm font-semibold text-ink-subtle tracking-wide uppercase">
              {section.group}
            </h2>
            <dl className="mt-4 space-y-3">
              {section.rows.map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-baseline justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0"
                >
                  <dt className="text-sm text-ink-muted">{k}</dt>
                  <dd className="text-sm font-medium tabular-nums text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <div className="card p-6">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink-muted">Overall progress</span>
          <span className="text-sm font-semibold tabular-nums">{stats.percent}%</span>
        </div>
        <div
          className="mt-3 progress-track h-3"
          role="progressbar"
          aria-valuenow={stats.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Bible reading progress"
        >
          <div className="progress-fill" style={{ width: `${stats.percent}%` }} />
        </div>
        <p className="mt-3 text-sm text-ink-muted tabular-nums">
          {stats.completedChapters.toLocaleString()} of{" "}
          {stats.totalChapters.toLocaleString()} chapters
        </p>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
