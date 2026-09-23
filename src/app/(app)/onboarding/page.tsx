"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Translation {
  id: string;
  englishName: string;
  name: string;
}

const DURATIONS = [
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
  { label: "60 days", days: 60 },
  { label: "90 days", days: 90 },
  { label: "6 months", days: 183 },
  { label: "1 year", days: 365 },
];

const DEFAULT_TIMES: Record<number, string[]> = {
  1: ["07:00"],
  2: ["07:00", "20:00"],
  3: ["07:00", "13:00", "20:00"],
};

const STEPS = [
  "How long do you want to take?",
  "When do you want to start?",
  "How often do you want to read?",
  "What times work for you?",
  "Choose a Bible translation",
  "Review your plan",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [durationDays, setDurationDays] = useState(90);
  const [customDays, setCustomDays] = useState("");
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [frequency, setFrequency] = useState<1 | 2 | 3>(1);
  const [times, setTimes] = useState<string[]>(DEFAULT_TIMES[1]);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [translation, setTranslation] = useState("BSB");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/bible/translations")
      .then((r) => r.json())
      .then((data) => {
        if (data.translations) {
          setTranslations(data.translations);
          if (
            data.translations.length > 0 &&
            !data.translations.some((t: Translation) => t.id === "BSB")
          ) {
            setTranslation(data.translations[0].id);
          }
        }
      })
      .catch(() => {
        setTranslations([{ id: "BSB", englishName: "Berean Standard Bible", name: "BSB" }]);
      });
  }, []);

  function pickFrequency(f: 1 | 2 | 3) {
    setFrequency(f);
    setTimes(DEFAULT_TIMES[f]);
  }

  function setSessionTime(index: number, value: string) {
    setTimes((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  const effectiveDuration = customDays
    ? Math.max(1, Math.min(3650, Number(customDays) || durationDays))
    : durationDays;

  const endDate = (() => {
    const d = new Date(startDate + "T00:00:00");
    if (Number.isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + effectiveDuration - 1);
    return d.toISOString().slice(0, 10);
  })();

  const chaptersPerDay = Math.floor(1189 / effectiveDuration);
  const remainder = 1189 % effectiveDuration;
  const chosenName =
    translations.find((t) => t.id === translation)?.englishName ??
    translations.find((t) => t.id === translation)?.name ??
    translation;

  async function createPlan() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          durationDays: effectiveDuration,
          frequency,
          translation,
          sessionTimes: times,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create plan");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create plan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <p className="eyebrow">
        Step {step + 1} of {STEPS.length}
      </p>
      <div className="mt-3 progress-track" aria-hidden>
        <div
          className="progress-fill"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <h1 className="mt-8 text-2xl md:text-3xl font-semibold tracking-tight">
        {STEPS[step]}
      </h1>

      <div className="mt-8">
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.days}
                  type="button"
                  className={`btn ${
                    !customDays && durationDays === d.days
                      ? "btn-primary"
                      : "btn-secondary"
                  } justify-center`}
                  onClick={() => {
                    setDurationDays(d.days);
                    setCustomDays("");
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div>
              <label className="label" htmlFor="custom-days">
                Custom duration (days)
              </label>
              <input
                id="custom-days"
                type="number"
                min={1}
                max={3650}
                className="input"
                placeholder="e.g. 45"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
              />
            </div>
            <p className="text-sm text-ink-muted">
              That&apos;s about {chaptersPerDay}
              {remainder > 0 ? `- ${chaptersPerDay + 1}` : ""} chapters per day
              across 1,189 total chapters.
            </p>
          </div>
        )}

        {step === 1 && (
          <div>
            <label className="label" htmlFor="start-date">
              Start date
            </label>
            <input
              id="start-date"
              type="date"
              className="input"
              value={startDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <p className="mt-3 text-sm text-ink-muted">
              Finish date will be <strong>{endDate}</strong>.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {[
              { f: 1 as const, title: "Once daily", desc: "One session per day" },
              { f: 2 as const, title: "Twice daily", desc: "Morning and evening" },
              { f: 3 as const, title: "Thrice daily", desc: "Morning, afternoon, evening" },
            ].map((opt) => (
              <button
                key={opt.f}
                type="button"
                className={`w-full text-left card p-4 transition-all duration-200 ${
                  frequency === opt.f
                    ? "border-accent ring-1 ring-accent"
                    : "hover:border-ink-subtle"
                }`}
                onClick={() => pickFrequency(opt.f)}
                aria-pressed={frequency === opt.f}
              >
                <span className="font-medium">{opt.title}</span>
                <span className="block text-sm text-ink-muted mt-0.5">
                  {opt.desc}
                </span>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {times.map((t, i) => (
              <div key={i}>
                <label className="label" htmlFor={`time-${i}`}>
                  Session {i + 1} time
                </label>
                <input
                  id={`time-${i}`}
                  type="time"
                  className="input"
                  value={t}
                  onChange={(e) => setSessionTime(i, e.target.value)}
                />
              </div>
            ))}
            <p className="text-sm text-ink-muted">
              Times use your local timezone and can be changed later in settings.
            </p>
          </div>
        )}

        {step === 4 && (
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
              {translations.length === 0 && (
                <option value="BSB">Berean Standard Bible (BSB)</option>
              )}
              {translations.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.englishName || t.name} ({t.id})
                </option>
              ))}
            </select>
            <p className="mt-3 text-sm text-ink-muted">
              Only free / public-domain-friendly complete translations are listed.
            </p>
          </div>
        )}

        {step === 5 && (
          <dl className="card divide-y divide-line">
            {[
              ["Duration", `${effectiveDuration} days`],
              ["Start date", startDate],
              ["Finish date", endDate],
              [
                "Frequency",
                frequency === 1
                  ? "Once daily"
                  : frequency === 2
                    ? "Twice daily"
                    : "Thrice daily",
              ],
              ["Reading times", times.join(", ")],
              ["Translation", chosenName],
              ["Chapters per day", `~${chaptersPerDay}${remainder > 0 ? `-${chaptersPerDay + 1}` : ""}`],
              ["Total chapters", "1,189"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-5 py-3.5">
                <dt className="text-sm text-ink-muted">{k}</dt>
                <dd className="text-sm font-medium text-right">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-8 flex justify-between gap-3">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setStep((s) => s + 1)}
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={createPlan}
            disabled={loading}
          >
            {loading ? "Creating…" : "Create my plan"}
          </button>
        )}
      </div>
    </div>
  );
}
