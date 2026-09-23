"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SettingsData {
  user: {
    id: string;
    email: string;
    name: string | null;
    timezone: string;
    theme: string;
    notificationPrefs: {
      enabled: boolean;
      beforeMinutes: number;
      missedReminderEnabled: boolean;
      missedAfterMinutes: number;
    } | null;
    readingPlans: Array<{
      translation: string;
      sessionTimes: string[];
      frequency: number;
    }>;
  } | null;
}

interface Translation {
  id: string;
  englishName: string;
  name: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [data, setData] = useState<SettingsData["user"]>(null);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [theme, setTheme] = useState("system");
  const [translation, setTranslation] = useState("BSB");
  const [sessionTimes, setSessionTimes] = useState<string[]>(["07:00"]);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [beforeMinutes, setBeforeMinutes] = useState(15);
  const [missedEnabled, setMissedEnabled] = useState(true);
  const [missedAfter, setMissedAfter] = useState(45);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/bible/translations").then((r) => r.json()),
    ])
      .then(([s, t]) => {
        const u = s.user;
        if (u) {
          setData(u);
          setName(u.name ?? "");
          setTimezone(u.timezone || "UTC");
          setTheme(u.theme || "system");
          const prefs = u.notificationPrefs;
          if (prefs) {
            setNotifEnabled(prefs.enabled);
            setBeforeMinutes(prefs.beforeMinutes);
            setMissedEnabled(prefs.missedReminderEnabled);
            setMissedAfter(prefs.missedAfterMinutes);
          }
          const plan = u.readingPlans?.[0];
          if (plan) {
            setTranslation(plan.translation);
            setSessionTimes(
              plan.sessionTimes?.length ? plan.sessionTimes : ["07:00"]
            );
          }
        }
        if (t.translations) setTranslations(t.translations);
      })
      .catch(() => setMessage({ type: "err", text: "Failed to load settings" }))
      .finally(() => setLoading(false));
  }, []);

  function updateTime(index: number, value: string) {
    setSessionTimes((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function saveProfile() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, timezone, theme }),
      });
      if (!res.ok) throw new Error("Failed to save profile");
      localStorage.setItem("theme", theme);
      setMessage({ type: "ok", text: "Profile saved." });
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setBusy(false);
    }
  }

  async function savePlan() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ translation, notification: {
          enabled: notifEnabled,
          beforeMinutes,
          missedReminderEnabled: missedEnabled,
          missedAfterMinutes: missedAfter,
        }}),
      });
      if (!res.ok) throw new Error("Failed to save");

      if (notifEnabled && typeof Notification !== "undefined" && Notification.permission === "default") {
        await Notification.requestPermission();
      }

      setMessage({ type: "ok", text: "Reading and notification settings saved." });
      router.refresh();
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setBusy(false);
    }
  }

  async function saveTimes() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/plans/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "regenerate",
          sessionTimes,
        }),
      });
      if (!res.ok) throw new Error("Failed to update times");
      setMessage({ type: "ok", text: "Reading times updated." });
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Update failed" });
    } finally {
      setBusy(false);
    }
  }

  async function adjustPlan(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/plans/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setMessage({
        type: "ok",
        text:
          action === "pause"
            ? "Plan paused. Resume anytime."
            : action === "resume"
              ? "Plan resumed."
              : action === "catch_up"
                ? data.message ||
                  (data.addedChapters
                    ? `${data.addedChapters} chapters redistributed.`
                    : "Already up to date.")
                : "Plan updated.",
      });
      router.refresh();
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Action failed" });
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/signin");
    router.refresh();
  }

  if (loading) {
    return <div className="text-sm text-ink-muted">Loading settings…</div>;
  }

  return (
    <div className="max-w-2xl space-y-8">
      <header>
        <p className="eyebrow">Settings</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">
          Account & preferences
        </h1>
      </header>

      {message && (
        <p
          role="status"
          className={`text-sm ${message.type === "ok" ? "text-success" : "text-danger"}`}
        >
          {message.text}
        </p>
      )}

      <section className="card p-5 space-y-4">
        <h2 className="font-semibold">Profile</h2>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" value={data?.email ?? ""} disabled readOnly />
        </div>
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input
            id="name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </div>
        <div>
          <label className="label" htmlFor="tz">Timezone</label>
          <input
            id="tz"
            className="input"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="e.g. America/Chicago"
          />
        </div>
        <div>
          <label className="label" htmlFor="theme">Theme</label>
          <select
            id="theme"
            className="input"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={saveProfile} disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
        </button>
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="font-semibold">Reading</h2>
        <div>
          <label className="label" htmlFor="translation">Translation</label>
          <select
            id="translation"
            className="input"
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
          >
            {translations.length === 0 && <option value="BSB">BSB</option>}
            {translations.map((t) => (
              <option key={t.id} value={t.id}>
                {t.englishName || t.name} ({t.id})
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="label">Reading times</legend>
          <div className="space-y-2">
            {sessionTimes.map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm text-ink-muted w-24">
                  {i === 0 ? "Session 1" : i === 1 ? "Session 2" : "Session 3"}
                </span>
                <input
                  type="time"
                  className="input max-w-[10rem]"
                  value={t}
                  onChange={(e) => updateTime(i, e.target.value)}
                  aria-label={`Session ${i + 1} time`}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-secondary text-sm mt-3"
            onClick={saveTimes}
            disabled={busy}
          >
            Update reading times
          </button>
        </fieldset>

        <button type="button" className="btn btn-primary" onClick={savePlan} disabled={busy}>
          Save reading settings
        </button>
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="font-semibold">Reminders</h2>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={notifEnabled}
            onChange={(e) => setNotifEnabled(e.target.checked)}
            className="size-4 accent-[var(--color-accent)]"
          />
          Enable reading reminders
        </label>

        <div>
          <label className="label" htmlFor="before">Remind me before reading</label>
          <div className="flex items-center gap-2">
            <input
              id="before"
              type="number"
              min={1}
              max={120}
              className="input max-w-[7rem]"
              value={beforeMinutes}
              onChange={(e) => setBeforeMinutes(Number(e.target.value))}
            />
            <span className="text-sm text-ink-muted">minutes</span>
          </div>
        </div>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={missedEnabled}
            onChange={(e) => setMissedEnabled(e.target.checked)}
            className="size-4 accent-[var(--color-accent)]"
          />
          Remind me if I miss a reading
        </label>

        <div>
          <label className="label" htmlFor="missed-after">Missed reminder after</label>
          <div className="flex items-center gap-2">
            <input
              id="missed-after"
              type="number"
              min={5}
              max={240}
              className="input max-w-[7rem]"
              value={missedAfter}
              onChange={(e) => setMissedAfter(Number(e.target.value))}
            />
            <span className="text-sm text-ink-muted">minutes</span>
          </div>
        </div>

        <p className="text-xs text-ink-subtle">
          Browser notifications are requested when you enable reminders. They work
          while the app is open; install the app for the best experience.
        </p>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-semibold">Plan</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={() => adjustPlan("resume")}
            disabled={busy}
          >
            Resume plan
          </button>
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={() => adjustPlan("regenerate")}
            disabled={busy}
          >
            Regenerate remaining schedule
          </button>
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={() => adjustPlan("catch_up")}
            disabled={busy}
          >
            Catch up missed readings
          </button>
        </div>
        <p className="text-xs text-ink-subtle">
          Completed reading history is never modified when you regenerate or catch up.
        </p>
      </section>

      <section className="card p-5">
        <button type="button" className="btn btn-ghost" onClick={signOut}>
          Sign out
        </button>
      </section>
    </div>
  );
}
