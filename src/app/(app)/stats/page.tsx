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
      <div aria-busy="true" className="pt-5 space-y-3.5">
        <div className="h-9 w-44 bg-surface-sunken rounded animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-32 bg-surface-sunken rounded-lg animate-pulse" />
          <div className="h-32 card animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 card animate-pulse" />
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

  return (
    <div className="max-w-md mx-auto md:max-w-2xl">
      <header className="pt-5 pb-3 fade-up">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-medium text-ink-muted tracking-tight">
              Your rhythm
            </h1>
            <p className="text-sm text-ink-subtle mt-0.5">
              A quiet record of faithfulness
            </p>
          </div>
          <Link
            href="/calendar"
            className="w-11 h-11 -mr-1.5 rounded-lg bg-surface-raised border border-line flex items-center justify-center text-ink-muted hover:text-ink transition-colors duration-150 shrink-0"
            aria-label="Open calendar"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              calendar_today
            </span>
          </Link>
        </div>
      </header>

      <div className="space-y-3.5">
        <section className="grid grid-cols-2 gap-3 fade-up" aria-label="Streaks">
          <article className="bg-surface-sunken border border-ember/20 rounded-lg p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold uppercase tracking-widest text-accent-ink">
                Current streak
              </span>
              <span
                className="material-symbols-outlined text-[18px] text-ember fill-icon shrink-0"
                aria-hidden="true"
              >
                local_fire_department
              </span>
            </div>
            <div className="my-2">
              <span className="text-4xl font-semibold text-accent-ink leading-none tracking-tight tabular-nums">
                {stats.currentStreak}
              </span>
            </div>
            <p className="text-sm text-ink-muted">Days in word</p>
          </article>

          <article className="card p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold uppercase tracking-widest text-ink-muted">
                Longest streak
              </span>
              <span
                className="material-symbols-outlined text-[18px] text-ink-muted shrink-0"
                aria-hidden="true"
              >
                military_tech
              </span>
            </div>
            <div className="my-2">
              <span className="text-4xl font-semibold text-ink leading-none tracking-tight tabular-nums">
                {stats.longestStreak}
              </span>
            </div>
            <p className="text-sm text-ink-muted">Personal record</p>
          </article>
        </section>

        <section className="grid grid-cols-3 gap-2.5 fade-up" aria-label="Totals">
          <div className="card p-3 text-center flex flex-col justify-center">
            <span className="text-xl font-semibold leading-tight tabular-nums">
              {stats.completedChapters.toLocaleString()}
            </span>
            <span className="text-sm font-semibold uppercase tracking-wider text-ink-muted mt-1">
              Chapters
            </span>
          </div>
          <div className="card p-3 text-center flex flex-col justify-center">
            <span className="text-xl font-semibold leading-tight tabular-nums">
              ~{estHours}
            </span>
            <span className="text-sm font-semibold uppercase tracking-wider text-ink-muted mt-1">
              Hours read
            </span>
          </div>
          <div className="card p-3 text-center flex flex-col justify-center">
            <span className="flex items-center justify-center gap-1.5">
              <span className="text-xl font-semibold leading-tight tabular-nums">
                {stats.percent}%
              </span>
              <span
                className="w-1.5 h-1.5 rounded-full bg-verdant shrink-0"
                aria-hidden="true"
              />
            </span>
            <span className="text-sm font-semibold uppercase tracking-wider text-ink-muted mt-1">
              Plan done
            </span>
          </div>
        </section>

        <section
          className="card p-4 fade-up fade-up-delay-1"
          aria-labelledby="weekly-heading"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 id="weekly-heading" className="text-[13px] font-medium text-ink leading-none">
                Weekly rhythm
              </h2>
              <p className="text-sm text-ink-muted mt-1 tabular-nums">
                {stats.weekDone} of 7 days completed · {stats.weekChapters} chapters
              </p>
            </div>
            <span className="bg-verdant-soft text-verdant px-2 py-0.5 rounded-full text-sm font-semibold">
              Active
            </span>
          </div>
          <ol
            className="grid grid-cols-7 gap-2 pt-2 items-end h-32 px-1"
            aria-label="Chapters read each day this week"
          >
            {stats.week.map((day, i) => {
              const height =
                day.chapters > 0
                  ? Math.max(8, Math.round((day.chapters / maxWeekChapters) * 96))
                  : 0;
              return (
                <li key={day.date} className="flex flex-col items-center h-full justify-end group">
                  <span
                    className={`text-sm mb-1 tabular-nums ${
                      day.isToday
                        ? "text-accent-ink font-semibold opacity-100"
                        : "text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity"
                    }`}
                    aria-hidden="true"
                  >
                    {day.isToday
                      ? "Today"
                      : day.chapters > 0
                        ? `${day.chapters} ch`
                        : "—"}
                  </span>
                  <div
                    className="w-full bg-line rounded-t-sm h-24 flex flex-col justify-end overflow-hidden"
                    aria-hidden="true"
                  >
                    <div
                      className={`w-full rounded-t-sm transition-all duration-500 ${
                        day.isToday ? "bg-ember" : "bg-verdant"
                      }`}
                      style={{ height: `${height}px` }}
                    />
                  </div>
                  <span
                    className={`text-sm mt-2 ${
                      day.isToday ? "font-semibold text-accent-ink" : "text-ink-muted"
                    }`}
                    aria-hidden="true"
                  >
                    {WEEK_LABELS[i]}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section
          className="card p-4 fade-up fade-up-delay-2"
          aria-labelledby="patterns-heading"
        >
          <h2 id="patterns-heading" className="text-[13px] font-medium text-ink mb-1">
            Reading patterns
          </h2>
          <ul className="divide-y divide-line">
            <li className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-sandstone" aria-hidden="true">
                  wb_sunny
                </span>
                <span className="text-sm text-ink-muted">Favourite time</span>
              </div>
              <span className="text-sm font-medium text-ink text-right">
                {stats.favourite
                  ? `${stats.favourite.label}${stats.favourite.time ? ` (${stats.favourite.time})` : ""}`
                  : "Not enough data yet"}
              </span>
            </li>
            <li className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-sandstone" aria-hidden="true">
                  schedule
                </span>
                <span className="text-sm text-ink-muted">Average session</span>
              </div>
              <span className="text-sm font-medium text-ink text-right tabular-nums">
                {stats.avgSessionChapters > 0
                  ? `${stats.avgSessionChapters} chapters · ~${Math.round(stats.avgSessionChapters * 3)} min`
                  : "Not enough data yet"}
              </span>
            </li>
            <li className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-sandstone" aria-hidden="true">
                  menu_book
                </span>
                <span className="text-sm text-ink-muted">Most read</span>
              </div>
              <span className="text-sm font-medium text-ink text-right">
                {stats.topBook && topBookName
                  ? `${topBookName} (${stats.topBook.chapters})`
                  : "Not enough data yet"}
              </span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
