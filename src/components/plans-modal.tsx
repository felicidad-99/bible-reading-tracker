"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PLAN_PRESETS,
  derivePlanName,
  type PlanPreset,
} from "@/lib/plan/presets";
import { progressOf } from "@/lib/plan/plan-display";
import { selectPlanPreset } from "@/lib/plan/select-plan";

interface ActivePlan {
  id: string;
  name: string | null;
  startDate: string;
  durationDays: number;
  frequency: number;
  translation: string;
  sessionTimes: string[];
  days: Array<{ date: string; dayNumber: number; status: string }>;
}

const TONE = {
  ember: {
    icon: "text-ember",
    link: "text-accent-ink",
    hover: "hover:bg-surface-sunken",
  },
  verdant: {
    icon: "text-verdant",
    link: "text-verdant",
    hover: "hover:bg-verdant-soft",
  },
  tertiary: {
    icon: "text-tertiary",
    link: "text-tertiary",
    hover: "hover:bg-sandstone-soft",
  },
  gold: {
    icon: "text-sandstone",
    link: "text-gold-ink",
    hover: "hover:bg-sandstone-soft",
  },
} as const;

export function PlansModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
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
      setError("Could not load your plans. Try again.");
    } finally {
      setLoading(false);
    }
  }, [loadPlanData]);

  useEffect(() => {
    if (!open) return;
    loadPlanData()
      .then((next) => {
        setPlan(next);
        setError(null);
      })
      .catch(() => setError("Could not load your plans. Try again."))
      .finally(() => setLoading(false));
  }, [open, loadPlanData]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  async function selectPlan(preset: PlanPreset) {
    setBusyId(preset.id);
    setStatus(null);
    setError(null);
    try {
      await selectPlanPreset(preset, {
        translation: plan?.translation,
        sessionTimes: plan?.sessionTimes,
      });
      setStatus(`Now reading ${preset.name}.`);
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

  function resume() {
    onClose();
    router.push("/reader");
  }

  if (!open) return null;

  const activeName = plan
    ? plan.name ?? derivePlanName(plan.durationDays, plan.frequency)
    : null;
  const activePreset = activeName
    ? PLAN_PRESETS.find((p) => p.name === activeName)
    : undefined;
  const candidates = PLAN_PRESETS.filter((p) => p.id !== activePreset?.id);
  const progress = plan ? progressOf(plan) : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex flex-col justify-end max-w-md mx-auto"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plans-modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-raised rounded-t-2xl border-t border-line shadow-2xl flex flex-col max-h-[85vh] outline-none animate-[fadeUp_280ms_ease-out]"
      >
        <div className="pt-3 pb-1 flex justify-center" aria-hidden="true">
          <div className="w-10 h-1 bg-line-strong rounded-full" />
        </div>

        <div className="px-5 pt-2 pb-3 border-b border-line flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-sandstone-soft text-tertiary flex items-center justify-center shrink-0">
              <span
                className="material-symbols-outlined text-[18px]"
                aria-hidden="true"
              >
                menu_book
              </span>
            </div>
            <div className="min-w-0">
              <h2
                id="plans-modal-title"
                className="text-lg font-semibold text-ink truncate"
              >
                Reading Plans
              </h2>
              <p className="text-sm text-ink-muted truncate">
                Curated journeys through Scripture
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close plans"
            className="w-11 h-11 rounded-full bg-surface-sunken flex items-center justify-center text-ink-muted hover:text-ink hover:bg-line transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-3 flex-1">
          {loading && (
            <p className="text-sm text-ink-muted py-6 text-center">
              Loading plans…
            </p>
          )}

          {!loading && error && (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-danger">{error}</p>
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={() => void refresh()}
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
              {status && (
                <p role="status" className="text-sm text-success px-1">
                  {status}
                </p>
              )}

              {plan && progress && activeName && (
                <div className="p-3.5 rounded-xl border-2 border-ember bg-surface-sunken/60 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span
                        className="material-symbols-outlined text-[20px] text-ember shrink-0"
                        aria-hidden="true"
                      >
                        check_circle
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-[15px] font-semibold text-ink">
                          {activeName}
                        </h4>
                        {activePreset && (
                          <p className="text-sm text-ink-muted mt-0.5">
                            {activePreset.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-sm bg-ember-soft text-accent-ink font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0">
                      Active
                    </span>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-sandstone/30 flex items-center justify-between gap-3">
                    <span className="text-sm text-ink font-medium">
                      Day {progress.currentDay} of {plan.durationDays} (
                      {progress.percent}%)
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary text-sm px-4"
                      onClick={resume}
                    >
                      Resume plan
                    </button>
                  </div>
                </div>
              )}

              {candidates.map((preset) => {
                const tone = TONE[preset.tone];
                const avg = preset.meta.split("·")[1]?.trim();
                const busy = busyId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => void selectPlan(preset)}
                    disabled={busyId !== null}
                    className={`w-full text-left p-3.5 rounded-xl border border-line bg-surface-raised transition-all ${tone.hover} hover:border-sandstone/40 disabled:opacity-60`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`material-symbols-outlined text-[20px] ${tone.icon}`}
                            aria-hidden="true"
                          >
                            {preset.icon}
                          </span>
                          <h4 className="text-[15px] font-semibold text-ink">
                            {preset.name}
                          </h4>
                        </div>
                        <p className="text-sm text-ink-muted mt-1">
                          {preset.description}
                        </p>
                      </div>
                      <span className="text-sm text-ink-muted font-medium bg-surface-sunken border border-line px-2 py-0.5 rounded-full shrink-0">
                        {preset.durationDays} days
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <span className="text-sm text-ink-muted">
                        {avg ?? preset.meta}
                      </span>
                      <span
                        className={`text-sm font-semibold flex items-center gap-0.5 ${tone.link}`}
                      >
                        {busy ? "Selecting…" : "Select plan"}
                        <span
                          className="material-symbols-outlined text-[16px]"
                          aria-hidden="true"
                        >
                          arrow_forward
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>

        <div className="p-4 border-t border-line bg-surface-sunken flex items-center justify-between">
          <button
            type="button"
            className="btn btn-primary w-full"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
