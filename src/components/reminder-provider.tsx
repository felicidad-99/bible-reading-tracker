"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface DashboardPayload {
  plan: unknown;
  stats: {
    completedChapters: number;
    totalChapters: number;
    percent: number;
    currentDay: number;
    totalDays: number;
    daysRemaining: number;
    currentStreak: number;
    longestStreak: number;
    sessionsCompleted: number;
    sessionsTotal: number;
    sessionsMissed: number;
    remainingChapters: number;
    finishDate: string;
    todayDay: {
      date: string;
      dayNumber: number;
      sessions: Array<{
        id: string;
        sessionNumber: number;
        scheduledTime: string;
        status: string;
        chapters: unknown;
        chapterCount: number;
      }>;
    } | null;
    missedCount: number;
    nextReading: {
      sessionId: string;
      sessionNumber: number;
      scheduledTime: string;
      date: string;
      dayNumber: number;
      chapters: unknown;
      chapterCount: number;
      status: string;
    } | null;
  } | null;
}

export function ReminderProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const notified = useRef(new Set<string>());
  const [prefs, setPrefs] = useState<{
    enabled: boolean;
    beforeMinutes: number;
    missedReminderEnabled: boolean;
    missedAfterMinutes: number;
  } | null>(null);

  const showToast = useCallback((title: string, body: string) => {
    setToast({ title, body });
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(title, { body, tag: "bible-reminder" });
      } catch {
        // notification blocked at OS level
      }
    }
  }, []);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const prefs = data?.user?.notificationPrefs;
        if (prefs) setPrefs(prefs);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      try {
        const res = await fetch("/api/dashboard");
        if (!res.ok) return;
        const data = (await res.json()) as DashboardPayload;
        if (!data.stats) return;

        const stats = data.stats;
        const sessions = [
          ...(stats.todayDay?.sessions ?? []),
          ...(stats.nextReading
            ? [
                {
                  ...stats.nextReading,
                  id: stats.nextReading.sessionId,
                },
              ]
            : []),
        ].map((s) => ({
          id: "id" in s ? (s as { id: string }).id : (s as { sessionId: string }).sessionId,
          sessionNumber: s.sessionNumber,
          scheduledTime: s.scheduledTime,
          status: s.status,
          chapters: s.chapters,
          date:
            "date" in s && typeof (s as { date?: string }).date === "string"
              ? (s as { date: string }).date
              : stats.todayDay?.date ?? new Date().toISOString().slice(0, 10),
        }));

        const now = new Date();

        for (const s of sessions) {
          if (s.status === "completed") continue;

          const [h, m] = s.scheduledTime.split(":").map(Number);
          const scheduled = new Date(s.date + "T00:00:00");
          scheduled.setHours(h, m, 0, 0);

          const beforeKey = `before:${s.id}`;
          const beforeMs = (prefs?.beforeMinutes ?? 15) * 60 * 1000;
          const delta = scheduled.getTime() - now.getTime();

          if (
            (prefs?.enabled ?? false) &&
            delta > 0 &&
            delta <= beforeMs &&
            !notified.current.has(beforeKey)
          ) {
            notified.current.add(beforeKey);
            const reading = formatChapters(s.chapters);
            showToast(
              "Reading coming up",
              `Your Bible reading is scheduled in ${Math.max(
                1,
                Math.round(delta / 60000)
              )} minutes. Today's reading: ${reading}.`
            );
          }

          const missedKey = `missed:${s.id}`;
          const missedAfter =
            (prefs?.missedAfterMinutes ?? 45) * 60 * 1000;
          if (
            (prefs?.missedReminderEnabled ?? true) &&
            now.getTime() - scheduled.getTime() > missedAfter &&
            !notified.current.has(missedKey)
          ) {
            notified.current.add(missedKey);
            const reading = formatChapters(s.chapters);
            showToast(
              "Missed reading",
              `You missed your ${sessionLabel(s.sessionNumber)} Bible reading. You still have ${reading} remaining today.`
            );
          }
        }
      } catch {
        // offline or API down - in-app reminders resume when reachable
      }
    }

    tick();
    const interval = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [prefs, showToast]);

  return (
    <>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed z-50 bottom-24 md:bottom-6 right-4 left-4 md:left-auto md:w-80 card p-4 shadow-lg fade-up"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{toast.title}</p>
              <p className="text-xs text-ink-muted mt-1">{toast.body}</p>
              <button
                type="button"
                className="btn btn-primary text-xs mt-3 px-4 py-2"
                onClick={() => {
                  setToast(null);
                  router.push("/dashboard");
                }}
              >
                Continue Reading
              </button>
            </div>
            <button
              type="button"
              className="btn btn-ghost text-xs px-2 py-1"
              onClick={() => setToast(null)}
              aria-label="Dismiss reminder"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function sessionLabel(n: number): string {
  return n === 1 ? "morning" : n === 2 ? "afternoon" : "evening";
}

function formatChapters(chapters: unknown): string {
  if (!Array.isArray(chapters) || chapters.length === 0) return "your reading";
  return chapters
    .map((c) => {
      const r = c as { bookName: string; start: number; end: number };
      return r.start === r.end
        ? `${r.bookName} ${r.start}`
        : `${r.bookName} ${r.start}-${r.end}`;
    })
    .join(", ");
}
