"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBookById } from "@/lib/plan/bible-books";

interface WeekDay {
  date: string;
  chapters: number;
  completed: boolean;
  isToday: boolean;
}

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
  week: WeekDay[];
  weekChapters: number;
  weekDone: number;
  favourite: { label: string; time: string | null } | null;
  avgSessionChapters: number;
  topBook: { id: string; chapters: number } | null;
}

const WEEK_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

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
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 card animate-pulse" />
          ))}
        </div>
        <div className="h-56 card animate-pulse" />
        <span className="sr-only">Loading statistics</span>
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

  const estHours = Math.max(Math.round((stats.completedChapters * 3) / 60), 0);
  const maxWeekChapters = Math.max(...stats.week.map((d) => d.chapters), 1);
  const topBookName = stats.topBook ? getBookById(stats.topBook.id)?.name : null;

  const cards = [
    {
      icon: "local_fire_department",
      iconClass: "bg-ember-soft text-accent-ink",
      title: "Current streak",
      value: stats.currentStreak,
      sub: "Days in word",
    },
    {
      icon: "military_tech",
      iconClass: "bg-sandstone-soft text-sandstone",
      title: "Longest streak",
      value: stats.longestStreak,
      sub: "Personal record",
    },
    {
      icon: "auto_stories",
      iconClass: "bg-verdant-soft text-verdant",
      title: "Chapters",
      value: stats.completedChapters.toLocaleString(),
      sub: "chapters read",
    },
    {
      icon: "schedule",
      iconClass: "bg-surface-sunken text-ink-muted",
      title: "Hours read",
      value: `~${estHours}`,
      sub: "estimated",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="fade-up">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Your rhythm
        </h1>
        <p className="mt-1 text-ink-muted">A quiet record of faithfulness</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 fade-up" aria-label="Streaks and totals">
        {cards.map((c) => (
          <div key={c.title} className="card p-5">
            <p className="text-sm text-ink-muted">{c.title}</p>
            <div className="mt-3 flex items-center gap-3.5">
              <span
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${c.iconClass}`}
              >
                <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                  {c.icon}
                </span>
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-semibold tracking-tight tabular-nums leading-tight">
                  {c.value}
                </p>
                <p className="text-sm text-ink-muted">{c.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="card p-5 fade-up fade-up-delay-1" aria-labelledby="plan-done-heading">
        <div className="flex items-baseline justify-between gap-3">
          <span id="plan-done-heading" className="font-semibold tracking-tight">
            Plan done
          </span>
          <span className="text-sm font-semibold text-accent-ink tabular-nums">
            {stats.percent}%
          </span>
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
          {stats.totalChapters.toLocaleString()} chapters · Day {stats.currentDay} of{" "}
          {stats.totalDays} · {stats.daysRemaining} days left · planned finish{" "}
          {formatDate(stats.finishDate)}
        </p>
      </section>

      <section
        className="card p-5 fade-up fade-up-delay-2"
        aria-labelledby="weekly-heading"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="weekly-heading" className="font-semibold tracking-tight">
            Weekly rhythm
          </h2>
          <span className="text-sm text-ink-muted tabular-nums">
            {stats.weekDone} of 7 days completed · {stats.weekChapters} chapters
          </span>
        </div>
        <ol className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2" aria-label="Chapters read each day this week">
          {stats.week.map((day, i) => {
            const h = Math.round((day.chapters / maxWeekChapters) * 44);
            return (
              <li key={day.date} className="flex flex-col items-center gap-1.5">
                <span className="text-sm text-ink-muted tabular-nums" aria-hidden="true">
                  {day.chapters > 0 ? day.chapters : "·"}
                </span>
                <div className="w-full h-12 flex items-end justify-center" aria-hidden="true">
                  <span
                    className={`w-4 sm:w-5 rounded-full ${
                      day.completed
                        ? "bg-ember"
                        : day.chapters > 0
                          ? "bg-ember-soft"
                          : "bg-surface-sunken"
                    } ${day.isToday ? "ring-2 ring-ink ring-offset-1 ring-offset-surface-raised" : ""}`}
                    style={{ height: `${Math.max(h, 4)}px` }}
                  />
                </div>
                <span
                  className={`text-sm ${day.isToday ? "font-semibold text-accent-ink" : "text-ink-muted"}`}
                  aria-hidden="true"
                >
                  {WEEK_LABELS[i]}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 flex items-center gap-3">
          <div
            className="h-2 flex-1 rounded-full"
            style={{
              background:
                "linear-gradient(to right, var(--color-sandstone-soft), var(--color-ember))",
            }}
            aria-hidden="true"
          />
          <span className="text-sm text-ink-muted">Less reading</span>
          <span className="text-sm text-ink-muted">More depth</span>
        </div>
      </section>

      <section
        className="card p-5 fade-up fade-up-delay-3"
        aria-labelledby="patterns-heading"
      >
        <h2 id="patterns-heading" className="font-semibold tracking-tight">
          Reading patterns
        </h2>
        <ul className="mt-4 space-y-1">
          <li className="flex items-center gap-3.5 py-2 border-b border-line">
            <span className="material-symbols-outlined text-[22px] text-tertiary" aria-hidden="true">
              wb_sunny
            </span>
            <span className="text-sm text-ink-muted flex-1">Favourite time</span>
            <span className="text-sm font-medium text-right">
              {stats.favourite
                ? `${stats.favourite.label}${stats.favourite.time ? ` (${stats.favourite.time})` : ""}`
                : "Not enough data yet"}
            </span>
          </li>
          <li className="flex items-center gap-3.5 py-2 border-b border-line">
            <span className="material-symbols-outlined text-[22px] text-tertiary" aria-hidden="true">
              schedule
            </span>
            <span className="text-sm text-ink-muted flex-1">Average session</span>
            <span className="text-sm font-medium text-right tabular-nums">
              {stats.avgSessionChapters > 0
                ? `${stats.avgSessionChapters} chapters · ~${Math.round(stats.avgSessionChapters * 3)} min`
                : "Not enough data yet"}
            </span>
          </li>
          <li className="flex items-center gap-3.5 py-2">
            <span className="material-symbols-outlined text-[22px] text-tertiary" aria-hidden="true">
              menu_book
            </span>
            <span className="text-sm text-ink-muted flex-1">Most read</span>
            <span className="text-sm font-medium text-right">
              {stats.topBook && topBookName
                ? `${topBookName} (${stats.topBook.chapters})`
                : "Not enough data yet"}
            </span>
          </li>
        </ul>
      </section>
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
