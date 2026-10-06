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
    <div className="max-w-md mx-auto md:max-w-xl lg:max-w-2xl">
      <nav
        aria-label="Top bar"
        className="h-14 -mx-4 md:-mx-8 px-4 md:px-8 flex items-center justify-between bg-surface"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            aria-label="Back to dashboard"
            className="w-11 h-11 -ml-2.5 rounded-lg flex items-center justify-center text-ink hover:bg-verdant-soft transition-colors duration-150"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              arrow_back
            </span>
          </button>
          <span className="text-xl font-semibold tracking-tight">Bible Track</span>
        </div>
      </nav>

      <div className="pt-3 pb-8 space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Reading plans</h1>
          <p className="mt-0.5 text-base text-ink-muted">Curated paths through Scripture</p>
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
          <section
            aria-labelledby="in-progress-heading"
            className="bg-verdant-soft border border-verdant/15 rounded-lg p-5 space-y-3.5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full bg-verdant animate-pulse inline-block"
                  aria-hidden="true"
                />
                <span
                  id="in-progress-heading"
                  className="text-sm font-semibold uppercase tracking-wider text-verdant"
                >
                  In progress
                </span>
              </span>
              <span className="bg-surface-raised text-verdant text-sm font-medium px-2.5 py-0.5 rounded-full border border-verdant/15 shrink-0">
                Active
              </span>
            </div>

            <div>
              <h2 className="text-xl font-semibold tracking-tight text-ink">{activeName}</h2>
              <p className="text-sm text-ink-muted mt-0.5 tabular-nums">
                Day {progress.currentDay} of {plan.durationDays} · {progress.percent}% complete
              </p>
            </div>

            <div className="h-1.5 bg-surface-raised/80 border border-verdant/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-verdant rounded-full transition-all duration-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>

            <div className="flex items-center gap-2 text-sm text-ink-muted border-t border-verdant/15 pt-3.5 flex-wrap tabular-nums">
              <span className="text-ink font-medium">
                {totalChapters.toLocaleString()} chapters
              </span>
              <span className="text-ink-muted/60" aria-hidden="true">
                ·
              </span>
              <span className="text-ink font-medium">~{estHours} hrs</span>
              <span className="text-ink-muted/60" aria-hidden="true">
                ·
              </span>
              <span className="text-ink font-medium">{plan.durationDays} days</span>
            </div>

            <button
              type="button"
              className="btn btn-primary w-full justify-center"
              onClick={() => router.push("/reader")}
            >
              Resume plan
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                arrow_forward
              </span>
            </button>
          </section>
        )}

        <section aria-labelledby="library-heading">
          <h2
            id="library-heading"
            className="text-sm font-semibold text-ink-muted uppercase tracking-wider px-1 mb-3 select-none"
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
                  className={`w-full text-left bg-surface-raised rounded-lg border border-line p-4 flex items-center justify-between gap-3 hover:bg-surface-sunken transition-all disabled:opacity-60 shadow-sm group ${
                    dimmed ? "pointer-events-none" : ""
                  }`}
                >
                  <span className="flex items-center gap-3.5 min-w-0">
                    <span
                      className="w-11 h-11 rounded-lg bg-sandstone-soft border border-sandstone/20 flex items-center justify-center text-xl font-semibold text-sandstone shrink-0"
                      aria-hidden="true"
                    >
                      {preset.badge}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-ink truncate">
                        {preset.name}
                      </span>
                      <span className="block text-sm text-ink-muted mt-0.5 truncate">
                        {preset.description}
                      </span>
                      <span className="flex flex-wrap gap-2 mt-2">
                        <span className="text-sm font-medium text-accent-ink bg-surface-sunken px-2 py-0.5 rounded-full">
                          {preset.durationDays} days
                        </span>
                        <span className="text-sm font-medium text-ink-muted bg-line px-2 py-0.5 rounded-full">
                          {preset.scope}
                        </span>
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0" aria-hidden="true">
                    {busy ? (
                      <span className="text-sm text-accent-ink font-medium">Switching…</span>
                    ) : (
                      <span className="material-symbols-outlined text-[20px] text-ink-muted group-hover:text-ink transition-colors">
                        chevron_right
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <p className="flex items-center justify-center gap-2 text-sm italic text-ink-muted text-center">
          <span
            className="material-symbols-outlined text-[16px] text-ink-muted shrink-0 not-italic"
            aria-hidden="true"
          >
            menu_book
          </span>
          <span>You can switch plans anytime — your history is preserved.</span>
        </p>
      </div>
    </div>
  );
}
