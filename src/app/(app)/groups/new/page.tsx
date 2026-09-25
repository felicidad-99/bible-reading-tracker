"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Translation {
  id: string;
  name: string;
  englishName?: string;
}

const DEFAULT_TIMES = ["07:00", "13:00", "20:00"];
const DURATION_OPTIONS = [30, 60, 90, 120, 180, 365];

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function NewGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [durationDays, setDurationDays] = useState(90);
  const [frequency, setFrequency] = useState<1 | 2 | 3>(2);
  const [times, setTimes] = useState<string[]>(DEFAULT_TIMES.slice(0, 2));
  const [translation, setTranslation] = useState("BSB");
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/bible/translations")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.translations)) {
          setTranslations(data.translations);
          if (
            data.translations.length > 0 &&
            !data.translations.some((t: Translation) => t.id === "BSB")
          ) {
            setTranslation(data.translations[0].id);
          }
        }
      })
      .catch(() => undefined);
  }, []);

  function setFrequencyValue(f: 1 | 2 | 3) {
    setFrequency(f);
    const next = times.slice(0, f);
    while (next.length < f) next.push(DEFAULT_TIMES[next.length]);
    setTimes(next);
  }

  function setTime(i: number, value: string) {
    setTimes((prev) => prev.map((t, idx) => (idx === i ? value : t)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Group name is required");
      return;
    }
    if (times.some((t) => !/^\d{2}:\d{2}$/.test(t))) {
      setError("Please set a time for every session");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          startDate,
          durationDays,
          frequency,
          scheduledTimes: times,
          translation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create group");
      router.push(`/groups/${data.group.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <p className="eyebrow">Groups</p>
      <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">
        Create a group
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Everyone reads the same plan on their own — up to 7 members. You start
        as the owner. Your current solo plan will be archived (history kept)
        and restored to solo when you leave.
      </p>

      <form onSubmit={submit} className="card p-5 mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="group-name">
            Group name
          </label>
          <input
            id="group-name"
            type="text"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sunrise Readers"
            maxLength={60}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="group-start">
              Start date
            </label>
            <input
              id="group-start"
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="group-duration">
              Duration
            </label>
            <select
              id="group-duration"
              className="input"
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <span className="label">Sessions per day</span>
          <div className="flex gap-2 mt-1" role="group" aria-label="Sessions per day">
            {([1, 2, 3] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`btn ${frequency === f ? "btn-primary" : "btn-secondary"}`}
                aria-pressed={frequency === f}
                onClick={() => setFrequencyValue(f)}
              >
                {f}× daily
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {times.map((t, i) => (
            <div key={i}>
              <label className="label" htmlFor={`group-time-${i}`}>
                Session {i + 1} time
              </label>
              <input
                id={`group-time-${i}`}
                type="time"
                className="input"
                value={t}
                onChange={(e) => setTime(i, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div>
          <label className="label" htmlFor="group-translation">
            Translation
          </label>
          <select
            id="group-translation"
            className="input"
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
          >
            {translations.length === 0 && <option value="BSB">BSB</option>}
            {translations.map((t) => (
              <option key={t.id} value={t.id}>
                {t.englishName ?? t.name ?? t.id}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Creating…" : "Create group"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => router.back()}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
