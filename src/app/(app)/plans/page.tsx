"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PLAN_PRESETS,
  derivePlanName,
  type PlanPreset,
} from "@/lib/plan/presets";
import { progressOf } from "@/lib/plan/plan-display";
import { selectPlanPreset } from "@/lib/plan/select-plan";

interface ActivePlan {
  name: string | null;
  startDate: string;
  durationDays: number;
  frequency: number;
  translation: string;
  sessionTimes: string[];
  days: Array<{
    date: string;
    dayNumber: number;
    status: string;
    totalChapters: number;
  }>;
}

const BADGE_CLASS: Record<PlanPreset["tone"], string> = {
  ember: "bg-ember-soft text-accent-ink",
  verdant: "bg-verdant-soft text-verdant",
  tertiary: "bg-sandstone-soft text-tertiary",
  gold: "bg-sandstone-soft text-gold-ink",
};

export default function PlansPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const loadPlanData = useCallback(async (): Promise<ActivePlan | null> => {
    const res = await fetch("/api/plans");
    if (!res.ok) throw new Error("Failed to load plan");
    const data = await res.json();
    return data.plan ?? null;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadPlanData();
      setPlan(next);
      setError(null);
    } catch {
      setError("Could not load your plans.");
    } finally {
      setLoading(false);
    }
  }, [loadPlanData]);

  useEffect(() => {
    loadPlanData()
      .then((next) => {
        setPlan(next);
        setError(null);
      })
      .catch(() => setError("Could not load your plans."))
      .finally(() => setLoading(false));
  }, [loadPlanData]);

  async function select(preset: PlanPreset) {
    setBusyId(preset.id);
    setStatus(null);
    setError(null);
    try {
      await selectPlanPreset(preset, {
        translation: plan?.translation,
        sessionTimes: plan?.sessionTimes,
      });
      setStatus(`Now reading ${preset.name}. Your history is preserved.`);
      const next = await loadPlanData();
      setPlan(next);
      setError(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch plans");
    } finally {
      setBusyId(null);
    }
  }

  const activeName = plan
    ? plan.name ?? derivePlanName(plan.durationDays, plan.frequency)
    : null;
  const activePreset = activeName
    ? PLAN_PRESETS.find((p) => p.name === activeName)
    : undefined;
  const library = PLAN_PRESETS.filter((p) => p.id !== activePreset?.id);
  const progress = plan ? progressOf(plan) : null;
  const totalChapters = plan
    ? plan.days.reduce((sum, d) => sum + d.totalChapters, 0)
    : 0;
  const estHours = Math.max(1, Math.round((totalChapters * 4) / 60));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          aria-label="Back to dashboard"
          className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center text-ink-muted hover:text-ink hover:bg-line transition-colors"
        >
          <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
            arrow_back
          </span>
        </button>
      </div>

      <header>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Reading plans
        </h1>
        <p className="mt-1 text-ink-muted">Curated paths through Scripture</p>
      </header>

      {error && (
        <div className="space-y-2" role="alert">
          <p className="text-sm text-danger">{error}</p>
          {!loading && (
            <button
              type="button"
              className="btn btn-secondary text-sm"
              onClick={() => void refresh()}
            >
              Try again
            </button>
          )}
        </div>
      )}

      {status && (
        <p role="status" className="text-sm text-success">
          {status}
        </p>
      )}

      {loading && <p className="text-sm text-ink-muted">Loading plans…</p>}

      {!loading && plan && progress && (
        <section aria-labelledby="in-progress-heading">
          <h2
            id="in-progress-heading"
            className="text-sm font-semibold text-ink-muted uppercase tracking-wider px-1 mb-2 select-none"
          >
            In progress
          </h2>
          <div className="bg-surface-raised rounded-lg border border-line shadow-sm p-4 md:p-5 space-y-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-ember-soft text-accent-ink flex items-center justify-center shrink-0">
                <span
                  className="material-symbols-outlined text-[20px]"
                  aria-hidden="true"
                >
                  {activePreset?.icon ?? "auto_stories"}
                </span>
              </div>
              <div className="min-w-0">
                <span className="inline-block text-sm bg-ember-soft text-accent-ink font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Active
                </span>
                <h3 className="text-lg font-semibold text-ink mt-1 truncate">
                  {activeName}
                </h3>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between text-sm gap-3">
                <span className="text-ink font-medium">
                  Day {progress.currentDay}{" "}
                  <span className="text-ink-muted font-normal">
                    of {plan.durationDays}
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
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink-muted">
              <span className="flex items-center gap-1.5">
                <span
                  className="material-symbols-outlined text-[16px] text-sandstone"
                  aria-hidden="true"
                >
                  menu_book
                </span>
                {totalChapters.toLocaleString()} chapters
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="material-symbols-outlined text-[16px] text-sandstone"
                  aria-hidden="true"
                >
                  schedule
                </span>
                ~{estHours} hrs
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="material-symbols-outlined text-[16px] text-sandstone"
                  aria-hidden="true"
                >
                  calendar_month
                </span>
                {plan.durationDays} days
              </span>
            </div>

            <button
              type="button"
              className="btn btn-primary w-full md:w-auto"
              onClick={() => router.push("/reader")}
            >
              Resume plan
              <span
                className="material-symbols-outlined text-[18px]"
                aria-hidden="true"
              >
                arrow_forward
              </span>
            </button>
          </div>
        </section>
      )}

      <section aria-labelledby="library-heading">
        <h2
          id="library-heading"
          className="text-sm font-semibold text-ink-muted uppercase tracking-wider px-1 mb-2 select-none"
        >
          Start something new
        </h2>
        <div className="space-y-3">
          {library.map((preset) => {
            const busy = busyId === preset.id;
            const dimmed = busyId !== null && !busy;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => void select(preset)}
                disabled={busyId !== null}
                className={`w-full text-left bg-surface-raised rounded-lg border border-line shadow-sm p-4 flex items-center gap-4 hover:border-sandstone/50 hover:bg-verdant-soft/40 transition-all disabled:opacity-60 ${
                  dimmed ? "pointer-events-none" : ""
                }`}
              >
                <span
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${BADGE_CLASS[preset.tone]}`}
                  aria-hidden="true"
                >
                  {preset.badge}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-ink truncate">
                    {preset.name}
                  </span>
                  <span className="block text-sm text-ink-muted mt-0.5">
                    {preset.description}
                  </span>
                  <span className="flex flex-wrap gap-2 mt-2">
                    <span className="text-sm text-ink-muted bg-surface-sunken border border-line px-2 py-0.5 rounded-full">
                      {preset.durationDays} days
                    </span>
                    <span className="text-sm text-ink-muted bg-surface-sunken border border-line px-2 py-0.5 rounded-full">
                      {preset.scope}
                    </span>
                  </span>
                </span>
                <span className="shrink-0" aria-hidden="true">
                  {busy ? (
                    <span className="text-sm text-accent-ink font-medium">
                      Switching…
                    </span>
                  ) : (
                    <span className="material-symbols-outlined text-[20px] text-ink-subtle">
                      chevron_right
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <p className="flex items-start gap-2 text-sm text-ink-muted px-1">
        <span
          className="material-symbols-outlined text-[18px] text-sandstone shrink-0"
          aria-hidden="true"
        >
          menu_book
        </span>
        <span>You can switch plans anytime — your history is preserved.</span>
      </p>
    </div>
  );
}
