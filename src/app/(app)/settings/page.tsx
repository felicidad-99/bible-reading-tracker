"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PushToggle } from "@/components/push-toggle";
import { PlansModal } from "@/components/plans-modal";
import { derivePlanName } from "@/lib/plan/presets";
import { progressOf, todayReadingText } from "@/lib/plan/plan-display";

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

interface ActivePlan {
  name: string | null;
  startDate: string;
  durationDays: number;
  frequency: number;
  days: Array<{
    date: string;
    dayNumber: number;
    status: string;
    sessions: Array<{
      chapters: Array<{ bookId: string; bookName: string; start: number; end: number }>;
    }>;
  }>;
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="w-11 h-11 flex items-center justify-center rounded-full shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
    >
      <span
        className={`w-11 h-6 rounded-full relative p-0.5 transition-colors duration-200 ${
          checked ? "bg-ember" : "bg-line-strong"
        }`}
      >
        <span
          className={`block w-5 h-5 bg-surface-raised rounded-full shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

function SectionCard({
  title,
  children,
  className = "",
  id,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={className} id={id}>
      <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wider px-1 mb-2 select-none">
        {title}
      </h2>
      <div className="bg-surface-raised rounded-lg border border-line shadow-sm overflow-hidden divide-y divide-line">
        {children}
      </div>
    </section>
  );
}

function RowChevron({ open }: { open?: boolean }) {
  return (
    <span
      className={`material-symbols-outlined text-[18px] text-ink-subtle transition-transform ${
        open ? "rotate-90" : ""
      }`}
      aria-hidden="true"
    >
      chevron_right
    </span>
  );
}

function DisclosureRow({
  icon,
  label,
  value,
  open,
  onToggle,
  children,
}: {
  icon: string;
  label: string;
  value?: string;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full h-14 px-4 flex items-center justify-between gap-3 hover:bg-verdant-soft/60 transition-colors text-left"
      >
        <span className="flex items-center gap-3 min-w-0">
          <span
            className="material-symbols-outlined text-[20px] text-sandstone shrink-0"
            aria-hidden="true"
          >
            {icon}
          </span>
          <span className="text-base text-ink truncate">{label}</span>
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          {value && (
            <span className="text-sm text-ink-muted max-w-[9rem] truncate">
              {value}
            </span>
          )}
          <RowChevron open={open} />
        </span>
      </button>
      {open && children && (
        <div className="px-4 py-4 space-y-3 border-t border-line bg-surface-sunken/40">
          {children}
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  checked,
  onChange,
  expandOpen,
  onToggleExpand,
  children,
}: {
  icon: string;
  label: string;
  value?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  expandOpen: boolean;
  onToggleExpand: () => void;
  children?: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expandOpen}
          className="flex-1 h-14 px-4 flex items-center justify-between gap-3 hover:bg-verdant-soft/60 transition-colors text-left min-w-0"
        >
          <span className="flex items-center gap-3 min-w-0">
            <span
              className="material-symbols-outlined text-[20px] text-sandstone shrink-0"
              aria-hidden="true"
            >
              {icon}
            </span>
            <span className="text-base text-ink truncate">{label}</span>
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            {value && (
              <span className="text-sm text-ink-muted max-w-[8rem] truncate">
                {value}
              </span>
            )}
            <RowChevron open={expandOpen} />
          </span>
        </button>
        <div className="flex items-center pr-2">
          <Switch checked={checked} onChange={onChange} label={label} />
        </div>
      </div>
      {expandOpen && children && (
        <div className="px-4 py-4 space-y-3 border-t border-line bg-surface-sunken/40">
          {children}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [data, setData] = useState<SettingsData["user"]>(null);
  const [activePlan, setActivePlan] = useState<ActivePlan | null>(null);
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/bible/translations").then((r) => r.json()),
      fetch("/api/plans").then((r) => r.json()).catch(() => ({ plan: null })),
    ])
      .then(([s, t, p]) => {
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
        setActivePlan(p?.plan ?? null);
      })
      .catch(() => setMessage({ type: "err", text: "Failed to load settings" }))
      .finally(() => setLoading(false));
  }, []);

  function toggle(section: string) {
    setExpanded((prev) => (prev === section ? null : section));
  }

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

  const planName = activePlan
    ? activePlan.name ?? derivePlanName(activePlan.durationDays, activePlan.frequency)
    : null;
  const progress = activePlan ? progressOf(activePlan) : null;
  const todayText = activePlan ? todayReadingText(activePlan.days) : null;
  const displayName = name.trim() || data?.name || "";
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") ||
    data?.email?.[0]?.toUpperCase() ||
    "R";
  const translationLabel =
    translations.find((t) => t.id === translation)?.englishName ?? translation;
  const themeLabel =
    theme.charAt(0).toUpperCase() + theme.slice(1);

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <p className="eyebrow">Settings</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">
          Profile
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

      <section
        aria-label="User profile"
        className="bg-surface-raised rounded-lg border border-line p-4 flex items-center justify-between gap-3 shadow-sm hover:border-sandstone/40 transition-colors duration-150"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-full bg-sandstone-soft border border-sandstone/30 flex items-center justify-center shrink-0">
            <span className="text-lg font-semibold text-tertiary">{initials}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl font-medium text-ink leading-tight truncate">
                {displayName || "Reader"}
              </span>
              <span className="bg-surface-sunken text-ink-muted text-sm px-2 py-0.5 rounded-full border border-line shrink-0">
                Free plan
              </span>
            </div>
            <span className="text-sm text-ink-muted mt-0.5 block truncate">
              {data?.email}
            </span>
          </div>
        </div>
      </section>

      <section
        aria-label="Active reading plan"
        className="bg-gradient-to-br from-surface-sunken via-surface-raised to-sandstone-soft/40 rounded-xl border border-sandstone/30 p-4 shadow-sm relative overflow-hidden"
      >
        <div className="flex items-start justify-between mb-3 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-ember/10 border border-ember/20 flex items-center justify-center text-ember shrink-0">
              <span
                className="material-symbols-outlined text-[20px]"
                aria-hidden="true"
              >
                auto_stories
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-sm uppercase tracking-wider text-accent-ink font-semibold block">
                Active Reading Plan
              </span>
              <h3 className="text-[17px] font-semibold text-ink leading-snug truncate">
                {planName ?? "No active plan yet"}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPlansOpen(true)}
            className="text-sm font-medium text-accent-ink bg-surface-raised border border-sandstone/40 px-4 min-h-11 rounded-full shadow-sm hover:border-ember transition-colors flex items-center gap-1.5 shrink-0"
          >
            {planName ? "Change" : "Choose"}
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              tune
            </span>
          </button>
        </div>
        {activePlan && progress && (
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between text-sm gap-3">
              <span className="text-ink font-medium">
                Day {progress.currentDay}{" "}
                <span className="text-ink-muted font-normal">
                  of {activePlan.durationDays}
                </span>
              </span>
              <span className="text-accent-ink font-semibold">
                {progress.percent}% complete
              </span>
            </div>
            <div className="w-full h-2 bg-line rounded-full overflow-hidden p-0.5 border border-line">
              <div
                className="h-full bg-ember rounded-full transition-all duration-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <div className="flex items-center justify-between pt-1 gap-3">
              <span className="text-sm text-ink-muted flex items-center gap-1 min-w-0">
                <span
                  className="material-symbols-outlined text-[15px] text-sandstone shrink-0"
                  aria-hidden="true"
                >
                  schedule
                </span>
                <span className="truncate">
                  {todayText ? `Today: ${todayText}` : "No reading scheduled today"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => router.push("/plans")}
                className="text-sm font-medium text-accent-ink hover:underline flex items-center gap-0.5 shrink-0 min-h-11"
              >
                View all plans
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        )}
      </section>

      <SectionCard title="Reading">
        <DisclosureRow
          icon="menu_book"
          label="Translation"
          value={translationLabel}
          open={expanded === "translation"}
          onToggle={() => toggle("translation")}
        >
          <div>
            <label className="label" htmlFor="translation">
              Translation
            </label>
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
          <button
            type="button"
            className="btn btn-primary"
            onClick={savePlan}
            disabled={busy}
          >
            Save reading settings
          </button>
        </DisclosureRow>

        <DisclosureRow
          icon="schedule"
          label="Reading times"
          value={sessionTimes.join(" · ")}
          open={expanded === "times"}
          onToggle={() => toggle("times")}
        >
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
        </DisclosureRow>

        <ToggleRow
          icon="alarm"
          label="Daily reminder"
          value={notifEnabled ? `${beforeMinutes} min before` : "Off"}
          checked={notifEnabled}
          onChange={setNotifEnabled}
          expandOpen={expanded === "reminder"}
          onToggleExpand={() => toggle("reminder")}
        >
          <div>
            <label className="label" htmlFor="before">
              Remind me before reading
            </label>
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
          <p className="text-sm text-ink-muted">
            Browser notifications are requested when you enable reminders. They
            work while the app is open; install the app for the best experience.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={savePlan}
            disabled={busy}
          >
            Save reminder settings
          </button>
        </ToggleRow>

        <DisclosureRow
          icon="public"
          label="Time zone"
          value={timezone}
          open={expanded === "tz"}
          onToggle={() => toggle("tz")}
        >
          <div>
            <label className="label" htmlFor="tz">
              Timezone
            </label>
            <input
              id="tz"
              className="input"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="e.g. America/Chicago"
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveProfile}
            disabled={busy}
          >
            Save time zone
          </button>
        </DisclosureRow>
      </SectionCard>

      <SectionCard title="Notifications">
        <ToggleRow
          icon="history"
          label="Missed-day catch-up"
          value={missedEnabled ? `${missedAfter} min after` : "Off"}
          checked={missedEnabled}
          onChange={setMissedEnabled}
          expandOpen={expanded === "missed"}
          onToggleExpand={() => toggle("missed")}
        >
          <div>
            <label className="label" htmlFor="missed-after">
              Missed reminder after
            </label>
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
          <button
            type="button"
            className="btn btn-primary"
            onClick={savePlan}
            disabled={busy}
          >
            Save reminder settings
          </button>
        </ToggleRow>

        <DisclosureRow
          icon="notifications"
          label="Push notifications"
          open={expanded === "push"}
          onToggle={() => toggle("push")}
        >
          <PushToggle />
        </DisclosureRow>
      </SectionCard>

      <SectionCard title="Appearance">
        <DisclosureRow
          icon="light_mode"
          label="Theme"
          value={themeLabel}
          open={expanded === "theme"}
          onToggle={() => toggle("theme")}
        >
          <div>
            <label className="label" htmlFor="theme">
              Theme
            </label>
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
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveProfile}
            disabled={busy}
          >
            Save appearance
          </button>
        </DisclosureRow>
      </SectionCard>

      <SectionCard title="Account">
        <DisclosureRow
          icon="manage_accounts"
          label="Manage account"
          value={data?.email}
          open={expanded === "account"}
          onToggle={() => toggle("account")}
        >
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="input"
              value={data?.email ?? ""}
              disabled
              readOnly
            />
          </div>
          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveProfile}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save profile"}
          </button>
        </DisclosureRow>

        <button
          type="button"
          onClick={signOut}
          className="w-full h-14 px-4 flex items-center gap-3 text-left hover:bg-verdant-soft/60 transition-colors"
        >
          <span
            className="material-symbols-outlined text-[20px] text-sandstone"
            aria-hidden="true"
          >
            logout
          </span>
          <span className="text-base text-ink">Sign out</span>
        </button>
      </SectionCard>

      <SectionCard title="Plan tools" id="plan-tools">
        <div className="p-4 space-y-3">
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
            <button
              type="button"
              className="btn btn-secondary text-sm"
              onClick={() => adjustPlan("pause")}
              disabled={busy}
            >
              Pause plan
            </button>
          </div>
          <p className="text-sm text-ink-muted">
            Completed reading history is never modified when you regenerate or
            catch up.
          </p>
        </div>
      </SectionCard>

      <footer className="pt-2 pb-4 text-center space-y-1">
        <p className="text-sm text-ink-muted flex items-center justify-center gap-1.5">
          <span
            className="material-symbols-outlined text-[16px] text-verdant"
            aria-hidden="true"
          >
            local_florist
          </span>
          Bible Track · v1.0.0
        </p>
        <p className="text-sm text-ink-subtle">
          Dedicated to patient contemplation
        </p>
      </footer>

      <PlansModal
        key={plansOpen ? "plans-open" : "plans-closed"}
        open={plansOpen}
        onClose={() => setPlansOpen(false)}
      />
    </div>
  );
}
