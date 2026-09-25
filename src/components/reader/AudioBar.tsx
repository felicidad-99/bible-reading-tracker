"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioChapterMeta } from "@/lib/bible/audioTypes";

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface AudioBarProps {
  bookId: string;
  chapter: number;
  translationId: string;
  onEnded?: () => void;
  onTimeUpdate?: (time: number) => void;
  onMeta?: (meta: AudioChapterMeta | null) => void;
}

export function AudioBar({
  bookId,
  chapter,
  translationId,
  onEnded,
  onTimeUpdate,
  onMeta,
}: AudioBarProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [meta, setMeta] = useState<AudioChapterMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    onEnded?.();
  }, [onEnded]);

  const handleTime = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    setCurrent(el.currentTime);
    onTimeUpdate?.(el.currentTime);
  }, [onTimeUpdate]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/bible/audio/meta/${encodeURIComponent(translationId)}/${encodeURIComponent(bookId)}/${chapter}`
        );
        const data = (await res.json()) as AudioChapterMeta & {
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.available) {
          setError(
            data.reason ||
              data.error ||
              (res.ok ? "Audio is not available for this chapter." : "Audio is temporarily unavailable.")
          );
          onMeta?.(null);
          return;
        }
        setMeta(data);
        setError(null);
        onMeta?.(data);
      } catch {
        if (cancelled) return;
        setError("Audio is temporarily unavailable.");
        onMeta?.(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [translationId, bookId, chapter, onMeta]);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.playbackRate = speed;
  }, [speed, meta?.streamUrl]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el || !meta?.streamUrl) return;
    if (el.paused) {
      void el.play().then(
        () => setPlaying(true),
        () => setPlaying(false)
      );
    } else {
      el.pause();
      setPlaying(false);
    }
  }, [meta?.streamUrl]);

  const seek = useCallback((value: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = value;
    setCurrent(value);
    onTimeUpdate?.(value);
  }, [onTimeUpdate]);

  if (loading) {
    return (
      <div
        className="card px-4 py-3 mt-4 text-sm text-ink-muted"
        aria-busy="true"
      >
        Loading audio…
      </div>
    );
  }

  if (error || !meta?.available || !meta.streamUrl) {
    return null;
  }

  const label =
    meta.translationName && meta.translationId
      ? `${meta.translationName} audio`
      : "Chapter audio";

  return (
    <section
      className="card px-4 py-3 mt-4"
      aria-label="Audio player"
    >
      <audio
        ref={audioRef}
        src={meta.streamUrl}
        preload="metadata"
        onTimeUpdate={handleTime}
        onLoadedMetadata={() => {
          const el = audioRef.current;
          if (el && Number.isFinite(el.duration)) setDuration(el.duration);
        }}
        onEnded={handleEnded}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary text-sm px-4 py-2"
          onClick={toggle}
          aria-label={playing ? "Pause audio" : "Play audio"}
        >
          {playing ? "Pause" : "Play"}
        </button>

        <span className="text-sm text-ink-muted tabular-nums min-w-16">
          {formatTime(current)} / {formatTime(duration)}
        </span>

        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <span className="sr-only">Playback speed</span>
          <select
            className="input !w-auto !py-1 text-sm"
            value={String(speed)}
            onChange={(e) => setSpeed(Number(e.target.value))}
            aria-label="Playback speed"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={String(s)}>
                {s}×
              </option>
            ))}
          </select>
        </label>

        <span className="text-sm text-ink-subtle ml-auto">{label}</span>
      </div>

      <label className="block mt-3">
        <span className="sr-only">Seek audio</span>
        <input
          type="range"
          className="w-full accent-[var(--color-accent)]"
          min={0}
          max={duration > 0 ? duration : 0}
          step={0.1}
          value={Math.min(current, duration || 0)}
          onChange={(e) => seek(Number(e.target.value))}
          disabled={!duration}
        />
      </label>

      {meta.copyright && (
        <p className="mt-2 text-sm text-ink-subtle">{meta.copyright}</p>
      )}
    </section>
  );
}
