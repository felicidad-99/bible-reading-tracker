"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatChapters, sessionLabel } from "@/lib/reminder-window";

interface DashboardPayload {
  plan?: unknown;
  pendingNudges?: Array<{
    id: string;
    groupId: string;
    groupName: string;
    fromName: string;
    date: string;
  }>;
  sentReminders?: Record<string, string[]>;
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
  const [toast, setToast] = useState<{
    title: string;
    body: string;
    href: string;
    action: string;
  } | null>(null);
  const notified = useRef(new Set<string>());
  const subscribed = useRef<boolean | null>(null);
  const [prefs, setPrefs] = useState<{
    enabled: boolean;
    beforeMinutes: number;
    missedReminderEnabled: boolean;
    missedAfterMinutes: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      subscribed.current = false;
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => (reg ? reg.pushManager.getSubscription() : null))
      .then((sub) => {
        if (!cancelled) subscribed.current = Boolean(sub);
      })
      .catch(() => {
        if (!cancelled) subscribed.current = false;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showToast = useCallback(
    (
      title: string,
      body: string,
      href = "/dashboard",
      action = "Continue reading",
      tag = "bible-reminder"
    ) => {
      setToast({ title, body, href, action });
      if (
        subscribed.current !== true &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(title, { body, tag });
        } catch {
          // notification blocked at OS level
        }
      }
    },
    []
  );

  const claimReminder = useCallback(
    (sessionId: string, kind: "before" | "missed") => {
      // Record the in-app delivery so the cron sweep does not push the
      // same reminder again, and vice versa (server-sent kinds skip the toast).
      fetch("/api/reminders/sent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, kind }),
      }).catch(() => undefined);
    },
    []
  );

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const prefs = data?.user?.notificationPrefs;
        if (prefs) setPrefs(prefs);
        // Keep the server in sync with the browser timezone so pushed
        // reminders evaluate schedules in the user's local time.
        const serverTz = data?.user?.timezone as string | undefined;
        let browserTz = "";
        try {
          browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        } catch {
          browserTz = "";
        }
        if (browserTz && serverTz !== browserTz) {
          fetch("/api/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timezone: browserTz }),
          }).catch(() => undefined);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/dashboard?scope=reminders");
        if (!res.ok) return;
        const data = (await res.json()) as DashboardPayload;

        for (const n of data.pendingNudges ?? []) {
          const nudgeKey = `nudge:${n.id}`;
          if (notified.current.has(nudgeKey)) continue;
          notified.current.add(nudgeKey);
          // Push subscriptions get the nudge as a real notification (sent
          // synchronously by the nudge API) — skip the duplicate in-app toast.
          if (subscribed.current !== true) {
            showToast(
              "Group nudge",
              `${n.fromName} nudged you to read in ${n.groupName}.`,
              `/groups/${n.groupId}`,
              "Open group",
              "bible-nudge"
            );
          }
          fetch(`/api/nudges/${n.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ seenAt: true }),
          }).catch(() => undefined);
        }

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

        const sentReminders = data.sentReminders ?? {};
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
            if (!(sentReminders[s.id] ?? []).includes("before")) {
              claimReminder(s.id, "before");
              const reading = formatChapters(s.chapters);
              showToast(
                "Reading coming up",
                `Your Bible reading is scheduled in ${Math.max(
                  1,
                  Math.round(delta / 60000)
                )} minutes. Today's reading: ${reading}.`
              );
            }
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
            if (!(sentReminders[s.id] ?? []).includes("missed")) {
              claimReminder(s.id, "missed");
              const reading = formatChapters(s.chapters);
              showToast(
                "Missed reading",
                `You missed your ${sessionLabel(s.sessionNumber)} Bible reading. You still have ${reading} remaining today.`
              );
            }
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
  }, [prefs, showToast, claimReminder]);

  return (
    <>
      {children}
      <div role="status" aria-live="polite" className="sr-only">
        {toast ? `${toast.title}. ${toast.body}` : ""}
      </div>
      {toast && (
        <div
          className="fixed z-50 bottom-24 md:bottom-6 right-4 left-4 md:left-auto md:w-80 card p-4 shadow-lg fade-up"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{toast.title}</p>
              <p className="text-sm text-ink-muted mt-1">{toast.body}</p>
              <button
                type="button"
                className="btn btn-primary text-sm mt-3 px-4 py-2"
                onClick={() => {
                  setToast(null);
                  router.push(toast.href);
                }}
              >
                {toast.action}
              </button>
            </div>
            <button
              type="button"
              className="btn btn-ghost text-sm px-2 py-1"
              onClick={() => setToast(null)}
              aria-label="Dismiss reminder"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                close
              </span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
