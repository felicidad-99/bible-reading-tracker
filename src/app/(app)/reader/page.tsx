"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  BIBLE_BOOKS,
  getBookById,
} from "@/lib/plan/bible-books";
import type { ChapterRange } from "@/lib/plan/generator";
import { AudioBar } from "@/components/reader/AudioBar";
import type { AudioChapterMeta, VerseTiming } from "@/lib/bible/audioTypes";

interface SessionDetail {
  id: string;
  sessionNumber: number;
  scheduledTime: string;
  status: string;
  chapterCount: number;
  chapters: ChapterRange[];
  readingDay: {
    date: string;
    dayNumber: number;
    planId: string;
  };
}

interface ChapterPayload {
  bookId: string;
  bookName: string;
  chapter: number;
  translationId: string;
  translationName: string;
  verses: Array<{ number: number; text: string }>;
  copyright?: string;
  source?: "youversion" | "helloao";
}

const SESSION_NAMES = ["Morning", "Afternoon", "Evening"];

function flattenAssigned(session: SessionDetail | null) {
  if (!session) return [] as Array<{ bookId: string; bookName: string; chapter: number }>;
  const list: Array<{ bookId: string; bookName: string; chapter: number }> = [];
  for (const range of session.chapters) {
    for (let ch = range.start; ch <= range.end; ch++) {
      list.push({ bookId: range.bookId, bookName: range.bookName, chapter: ch });
    }
  }
  return list;
}

function nextChapterRef(
  bookId: string,
  chapter: number
): { bookId: string; chapter: number } | null {
  const book = getBookById(bookId);
  if (!book) return null;
  if (chapter < book.chapters) return { bookId, chapter: chapter + 1 };
  const idx = BIBLE_BOOKS.findIndex((b) => b.id === bookId);
  if (idx >= 0 && idx < BIBLE_BOOKS.length - 1) {
    return { bookId: BIBLE_BOOKS[idx + 1].id, chapter: 1 };
  }
  return null;
}

function prevChapterRef(
  bookId: string,
  chapter: number
): { bookId: string; chapter: number } | null {
  const book = getBookById(bookId);
  if (!book) return null;
  if (chapter > 1) return { bookId, chapter: chapter - 1 };
  const idx = BIBLE_BOOKS.findIndex((b) => b.id === bookId);
  if (idx > 0) {
    const prev = BIBLE_BOOKS[idx - 1];
    return { bookId: prev.id, chapter: prev.chapters };
  }
  return null;
}

export default function ReaderPage() {
  return (
    <Suspense
      fallback={<div className="text-sm text-ink-muted">Loading reader…</div>}
    >
      <ReaderInner />
    </Suspense>
  );
}

function ReaderInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [translation, setTranslation] = useState("BSB");
  const [current, setCurrent] = useState<{ bookId: string; chapter: number } | null>(
    null
  );
  const [chapter, setChapter] = useState<ChapterPayload | null>(null);
  const [loadingSession, setLoadingSession] = useState(!!sessionId);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("not_started");
  const [showControls, setShowControls] = useState(true);
  const [readSet, setReadSet] = useState<Set<string>>(new Set());
  const [latestSessionId, setLatestSessionId] = useState<string | null>(null);
  const [audioInfo, setAudioInfo] = useState<{
    key: string;
    meta: AudioChapterMeta | null;
    time: number;
    ended: boolean;
  } | null>(null);

  const planSession = sessionId ?? latestSessionId;
  const loadingChapter =
    current !== null &&
    (!chapter || chapter.bookId !== current.bookId || chapter.chapter !== current.chapter);

  const fontSize = useSyncExternalStore(
    () => () => {},
    () => Number(localStorage.getItem("reader-font-size")) || 18,
    () => 18
  );
  const showVerses = useSyncExternalStore(
    () => () => {},
    () => localStorage.getItem("reader-show-verses") !== "0",
    () => true
  );

  const assigned = useMemo(() => flattenAssigned(session), [session]);
  const assignedKeys = useMemo(
    () => new Set(assigned.map((a) => `${a.bookId}:${a.chapter}`)),
    [assigned]
  );

  const setFontSize = useCallback((size: number) => {
    localStorage.setItem("reader-font-size", String(size));
    window.dispatchEvent(new Event("storage"));
  }, []);

  const readQueue = useRef(
    new Map<string, { sessionId: string; bookId: string; chapter: number }>()
  );
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushReadQueue = useCallback(() => {
    if (readTimer.current) {
      clearTimeout(readTimer.current);
      readTimer.current = null;
    }
    const queued = Array.from(readQueue.current.values());
    readQueue.current.clear();
    for (const item of queued) {
      fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: item.sessionId,
          bookId: item.bookId,
          chapter: item.chapter,
          read: true,
        }),
        keepalive: true,
      }).catch(() => {});
    }
  }, []);

  useEffect(() => flushReadQueue, [flushReadQueue]);

  const markRead = useCallback(
    (bookId: string, ch: number) => {
      setReadSet((prev) => {
        const next = new Set(prev);
        next.add(`${bookId}:${ch}`);
        return next;
      });
      if (planSession) {
        const key = `${planSession}:${bookId}:${ch}`;
        if (!readQueue.current.has(key)) {
          readQueue.current.set(key, {
            sessionId: planSession,
            bookId,
            chapter: ch,
          });
        }
        if (readTimer.current) clearTimeout(readTimer.current);
        readTimer.current = setTimeout(flushReadQueue, 600);
      }
    },
    [planSession, flushReadQueue]
  );

  const handleAudioMeta = useCallback(
    (meta: AudioChapterMeta | null) => {
      if (!current) return;
      setAudioInfo({
        key: `${current.bookId}:${current.chapter}`,
        meta,
        time: 0,
        ended: false,
      });
    },
    [current]
  );

  const handleAudioTime = useCallback((time: number) => {
    setAudioInfo((prev) => (prev ? { ...prev, time } : prev));
  }, []);

  const handleAudioEnded = useCallback(() => {
    if (!current) return;
    const key = `${current.bookId}:${current.chapter}`;
    markRead(current.bookId, current.chapter);
    setAudioInfo((prev) =>
      prev && prev.key === key ? { ...prev, ended: true } : prev
    );
  }, [current, markRead]);

  const chapterKey = current ? `${current.bookId}:${current.chapter}` : "";
  const liveAudio =
    audioInfo && audioInfo.key === chapterKey ? audioInfo : null;
  const activeVerse = useMemo(() => {
    const timings = liveAudio?.meta?.verseTimings;
    if (!timings || timings.length === 0) return null;
    const t0 = liveAudio?.time ?? 0;
    let hit: VerseTiming | null = null;
    for (const t of timings) {
      if (t0 < t.start) break;
      if (t.end === undefined || t0 < t.end) hit = t;
    }
    return hit?.verse ?? null;
  }, [liveAudio]);

  const toggleVerses = useCallback(() => {
    const next = localStorage.getItem("reader-show-verses") === "0";
    localStorage.setItem("reader-show-verses", next ? "1" : "0");
    window.dispatchEvent(new Event("storage"));
  }, []);

  const loadSession = useCallback(async (id: string) => {
    setLoadingSession(true);
    try {
      const res = await fetch(`/api/sessions/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load session");

      const found = data.session as SessionDetail;
      setSession(found);
      setStatus(found.status);
      setTranslation(
        data.translation ||
          localStorage.getItem("reader-translation") ||
          "BSB"
      );

      const reads = new Set<string>(
        ((data.reads ?? []) as Array<{ bookId: string; chapter: number }>).map(
          (r) => `${r.bookId}:${r.chapter}`
        )
      );
      setReadSet(reads);

      const flat = flattenAssigned(found);
      if (flat.length > 0) {
        const unread = flat.find((c) => !reads.has(`${c.bookId}:${c.chapter}`));
        setCurrent(unread ?? flat[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setLoadingSession(false);
    }
  }, []);

  const loadLatestSession = useCallback(async () => {
    setLoadingSession(true);
    try {
      const res = await fetch("/api/dashboard?scope=reminders");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      const next = data.stats?.nextReading;
      if (next?.sessionId) {
        setLatestSessionId(next.sessionId);
        await loadSession(next.sessionId);
      } else if (data.stats?.todayDay?.sessions?.length) {
        const open = data.stats.todayDay.sessions.find(
          (s: { status: string }) => s.status !== "completed"
        );
        const s = open ?? data.stats.todayDay.sessions[0];
        setLatestSessionId(s.id);
        await loadSession(s.id);
      } else {
        setError("no-session");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoadingSession(false);
    }
  }, [loadSession]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (sessionId) {
        loadSession(sessionId);
      } else {
        loadLatestSession();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [sessionId, loadSession, loadLatestSession]);

  useEffect(() => {
    if (!current) return;
    let cancelled = false;

    fetch(`/api/bible/${translation}/${current.bookId}/${current.chapter}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load Scripture");
        if (!cancelled) {
          setChapter(data);
          setError(null);
          markRead(current.bookId, current.chapter);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Bible text is temporarily unavailable."
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [current, translation, markRead]);

  async function completeSession() {
    if (!session || !planSession) return;
    setError(null);
    flushReadQueue();
    try {
      const res = await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: planSession,
          bookId: session.chapters[0]?.bookId ?? "GEN",
          chapter: session.chapters[0]?.start ?? 1,
          complete: true,
        }),
      });
      if (!res.ok) throw new Error("Could not mark complete");
      setStatus("completed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark complete");
    }
  }

  async function startSession() {
    if (!planSession) return;
    await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: planSession }),
    });
    setStatus("in_progress");
  }

  const readCount = assigned.filter((a) =>
    readSet.has(`${a.bookId}:${a.chapter}`)
  ).length;
  const totalAssigned = assigned.length;

  const canPrev = current
    ? prevChapterRef(current.bookId, current.chapter) !== null &&
      (assigned.length === 0 ||
        isAssigned(
          assignedKeys,
          prevChapterRef(current.bookId, current.chapter)!
        ))
    : false;
  const canNext = current
    ? (() => {
        const n = nextChapterRef(current.bookId, current.chapter);
        return n !== null && (assigned.length === 0 || isAssigned(assignedKeys, n));
      })()
    : false;

  if (loadingSession) {
    return <div className="text-sm text-ink-muted">Loading reading session…</div>;
  }

  if (error === "no-session" || (!session && !loadingSession)) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h1 className="text-xl font-semibold">No reading today</h1>
        <p className="mt-3 text-ink-muted">
          You&apos;re all caught up. Your next reading is scheduled for tomorrow.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/dashboard" className="btn btn-secondary">
            Dashboard
          </Link>
          <Link href="/calendar" className="btn btn-primary">
            View calendar
          </Link>
        </div>
      </div>
    );
  }

  if (error && !chapter && session) {
    return (
      <div className="max-w-md mx-auto text-center py-16" role="alert">
        <h1 className="text-xl font-semibold">Couldn&apos;t load Scripture</h1>
        <p className="mt-3 text-ink-muted">{error}</p>
        <button
          type="button"
          className="btn btn-secondary mt-6"
          onClick={() => current && setCurrent({ ...current })}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <header className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/dashboard"
          className="btn btn-ghost w-11 h-11 p-0 shrink-0 justify-center"
          aria-label="Back to Today"
        >
          <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
            arrow_back
          </span>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-muted truncate">
            {session
              ? `Session ${session.sessionNumber} · Day ${session.readingDay.dayNumber}`
              : "Reader"}
          </p>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate">
            {chapter
              ? `${chapter.bookName} ${chapter.chapter}`
              : session
                ? session.chapters[0]?.bookName ?? "Reading"
                : "Reading"}
          </h1>
        </div>
        <span className="shrink-0 text-sm font-medium bg-surface-sunken px-2.5 py-1 rounded-full">
          {chapter?.translationId ?? translation}
        </span>
        <button
          type="button"
          className="btn btn-ghost w-11 h-11 p-0 shrink-0 justify-center"
          onClick={() => setShowControls((v) => !v)}
          aria-expanded={showControls}
          aria-controls="reader-controls"
          aria-label="Reading display options"
        >
          <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
            format_size
          </span>
        </button>
      </header>

      {showControls && (
        <div
          id="reader-controls"
          className="mt-3 flex flex-wrap items-center justify-between gap-3 card px-4 py-3"
        >
          <div className="flex items-center gap-3 text-sm text-ink-muted">
            <span className="tabular-nums">
              {readCount} of {totalAssigned} chapters read
            </span>
            <div className="progress-track w-28" aria-hidden>
              <div
                className="progress-fill"
                style={{
                  width: totalAssigned
                    ? `${Math.round((readCount / totalAssigned) * 100)}%`
                    : "0%",
                }}
              />
            </div>
          </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost text-sm px-3 py-1.5"
            onClick={() => setFontSize(Math.max(14, fontSize - 2))}
            aria-label="Decrease font size"
          >
            A−
          </button>
          <button
            type="button"
            className="btn btn-ghost text-sm px-3 py-1.5"
            onClick={() => setFontSize(Math.min(28, fontSize + 2))}
            aria-label="Increase font size"
          >
            A+
          </button>
          <button
            type="button"
            className="btn btn-ghost text-sm px-3 py-1.5"
            onClick={toggleVerses}
            aria-pressed={showVerses}
          >
            {showVerses ? "Verses on" : "Verses off"}
          </button>
        </div>
        </div>
      )}

      {current && (
        <AudioBar
          key={`${current.bookId}:${current.chapter}:${translation}`}
          bookId={current.bookId}
          chapter={current.chapter}
          translationId={translation}
          onMeta={handleAudioMeta}
          onTimeUpdate={handleAudioTime}
          onEnded={handleAudioEnded}
        />
      )}

      {liveAudio?.ended && (
        <p className="mt-2 text-sm text-success" role="status">
          Marked read when audio finished.
        </p>
      )}

      <article
        className="mt-6 card p-6 md:p-10"
        style={{ fontSize: `${fontSize}px`, lineHeight: 1.75 }}
      >
        {loadingChapter && (
          <div aria-busy="true" className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-4 bg-surface-sunken rounded animate-pulse"
                style={{ width: `${90 - (i % 3) * 15}%` }}
              />
            ))}
            <span className="sr-only">Loading chapter</span>
          </div>
        )}

        {!loadingChapter && chapter && (
          <div className="font-scripture">
            <p className="text-sm font-sans text-ink-muted mb-6 tracking-[0.2em] uppercase">
              Chapter {chapter.chapter}
            </p>
            <div className="space-y-4">
              {chapter.verses.map((v) => (
                <p
                  key={v.number}
                  className={
                    activeVerse === v.number
                      ? "text-ink rounded-md bg-accent-soft px-1 -mx-1"
                      : "text-ink"
                  }
                >
                  {showVerses && (
                    <sup className="text-accent-ink font-sans text-[0.7em] mr-1 tabular-nums">
                      {v.number}
                    </sup>
                  )}
                  {v.text}
                </p>
              ))}
              {chapter.verses.length === 0 && (
                <p className="text-ink-muted font-sans text-sm">
                  No text returned for this chapter. Try another translation or retry.
                </p>
              )}
            </div>
            {chapter.copyright && (
              <p className="mt-8 pt-4 border-t border-line text-sm font-sans text-ink-muted">
                {chapter.copyright}
              </p>
            )}
          </div>
        )}
      </article>

      <nav
        className="mt-6 flex gap-3"
        aria-label="Chapter navigation"
      >
        <button
          type="button"
          className="btn btn-secondary flex-1"
          disabled={!canPrev || !current}
          onClick={() => {
            if (!current) return;
            const p = prevChapterRef(current.bookId, current.chapter);
            if (p) setCurrent(p);
          }}
        >
          Previous
        </button>

        <button
          type="button"
          className="btn btn-secondary flex-1"
          disabled={!canNext || !current}
          onClick={() => {
            if (!current) return;
            const n = nextChapterRef(current.bookId, current.chapter);
            if (n) setCurrent(n);
          }}
        >
          Next
        </button>
      </nav>

      {error && chapter && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-6 text-center">
        <button
          type="button"
          className="btn btn-ghost text-sm"
          onClick={() => setCurrent({ bookId: "GEN", chapter: 1 })}
        >
          Jump to Genesis 1
        </button>
      </div>

      <div className="sticky bottom-24 md:bottom-6 z-10 mt-4 card p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wide">
            Session {session?.sessionNumber ?? "—"}
            {session ? ` — ${SESSION_NAMES[session.sessionNumber - 1] ?? ""}` : ""}
          </p>
          <p className="text-sm text-ink-muted tabular-nums mt-0.5">
            {session
              ? session.chapters
                  .map((c) =>
                    c.start === c.end
                      ? `${c.bookName} ${c.start}`
                      : `${c.bookName} ${c.start}-${c.end}`
                  )
                  .join(", ")
              : ""}
            {session ? ` · ${readCount} of ${totalAssigned} chapters read` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status === "completed" ? (
            <span className="status-pill status-completed">Session complete</span>
          ) : (
            <>
              {status === "not_started" && (
                <button
                  type="button"
                  className="btn btn-ghost text-sm"
                  onClick={startSession}
                >
                  Mark as started
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary text-sm flex-1 sm:flex-none"
                onClick={completeSession}
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  aria-hidden="true"
                >
                  check_circle
                </span>
                Mark session complete
              </button>
            </>
          )}
          <Link href="/dashboard" className="btn btn-secondary text-sm">
            Skip for now
          </Link>
        </div>
      </div>
    </div>
  );
}

function isAssigned(
  keys: Set<string>,
  ref: { bookId: string; chapter: number }
): boolean {
  return keys.has(`${ref.bookId}:${ref.chapter}`);
}
