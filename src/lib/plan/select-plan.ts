import type { PlanPreset } from "./presets";
import { localToday } from "./plan-display";

/** POST /api/plans with a preset; carries over translation and session times. */
export async function selectPlanPreset(
  preset: PlanPreset,
  active: {
    translation?: string;
    sessionTimes?: string[];
  } | null
): Promise<void> {
  const res = await fetch("/api/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      presetId: preset.id,
      startDate: localToday(),
      translation: active?.translation ?? "BSB",
      sessionTimes:
        active?.sessionTimes?.length ? active.sessionTimes : ["07:00"],
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not switch plans");
  }
}
