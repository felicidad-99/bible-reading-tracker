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
  const [showControls, setShowControls] = useState(false);
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

  const remaining = totalAssigned - readCount;
  const momentumVerseNum =
    chapter && chapter.verses.length >= 6
      ? Math.max(2, Math.floor(chapter.verses.length * 0.45))
      : -1;
  const memoryVerseNum =
    chapter && chapter.verses.length >= 8
      ? Math.ceil(chapter.verses.length * 0.85)
      : -1;

  return (
    <div className="max-w-[420px] mx-auto">
      <header className="sticky top-0 z-40 -mx-4 md:-mx-8 bg-surface/95 backdrop-blur-md border-b border-line">
        <div className="relative flex items-center justify-between px-4 md:px-8 h-14">
          <Link
            href="/dashboard"
            className="btn btn-ghost w-11 h-11 p-0 shrink-0 justify-center -ml-2"
            aria-label="Back to Today"
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
              arrow_back
            </span>
          </Link>
          <h1 className="absolute left-1/2 -translate-x-1/2 max-w-[55%] text-xl font-semibold tracking-tight truncate">
            {chapter
              ? `${chapter.bookName} ${chapter.chapter}`
              : session
                ? session.chapters[0]?.bookName ?? "Reading"
                : "Reading"}
          </h1>
          <div className="flex items-center gap-1.5 shrink-0 -mr-2">
            <span className="text-sm bg-surface-raised border border-line px-2 py-0.5 rounded-full text-ink-muted select-none">
              {chapter?.translationId ?? translation}
            </span>
            <button
              type="button"
              className="btn btn-ghost w-11 h-11 p-0 justify-center"
              onClick={() => setShowControls((v) => !v)}
              aria-expanded={showControls}
              aria-controls="reader-controls"
              aria-label="Reading display options"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                format_size
              </span>
            </button>
          </div>
        </div>
      </header>

      {showControls && (
        <div
          id="reader-controls"
          className="-mx-4 md:-mx-8 px-4 md:px-8 py-2.5 border-b border-line bg-surface-sunken/60 flex flex-wrap items-center justify-between gap-x-3 gap-y-2"
        >
          <div className="flex items-center gap-2.5 text-sm text-ink-muted">
            <span className="tabular-nums whitespace-nowrap">
              {readCount} of {totalAssigned} read
            </span>
            <div className="progress-track w-24" aria-hidden>
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
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn btn-ghost text-sm px-2.5 py-1 min-h-9 min-w-9"
              onClick={() => setFontSize(Math.max(14, fontSize - 2))}
              aria-label="Decrease font size"
            >
              A−
            </button>
            <button
              type="button"
              className="btn btn-ghost text-sm px-2.5 py-1 min-h-9 min-w-9"
              onClick={() => setFontSize(Math.min(28, fontSize + 2))}
              aria-label="Increase font size"
            >
              A+
            </button>
            <button
              type="button"
              className="btn btn-ghost text-sm px-2.5 py-1 min-h-9"
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

      <main className="pt-7 pb-64 px-2">
        <div className="text-center mb-7">
          <span className="block text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">
            {chapter ? `Chapter ${chapter.chapter}` : "Chapter"}
          </span>
          <div className="w-12 h-px bg-line mx-auto mt-2.5" aria-hidden="true" />
        </div>

        <article
          className="font-scripture text-ink"
          style={{ fontSize: `${fontSize}px`, lineHeight: 1.65 }}
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
            <>
              <div className="space-y-4">
                {chapter.verses.map((v) => {
                  const sup = showVerses ? (
                    <sup className="text-sandstone font-medium text-[0.7em] pr-1.5 align-super font-sans tabular-nums select-none">
                      {v.number}
                    </sup>
                  ) : null;
                  const highlight =
                    activeVerse === v.number
                      ? "text-ink rounded-md bg-accent-soft px-1 -mx-1"
                      : "text-ink";

                  return (
                    <div key={v.number}>
                      {v.number === memoryVerseNum ? (
                        <div className="my-6 bg-surface-sunken border-l-[3px] border-ember rounded-r-lg p-4 shadow-sm">
                          <div className="flex items-center gap-1.5 mb-1.5 text-accent-ink font-sans">
                            <span
                              className="material-symbols-outlined text-[16px] fill-icon"
                              aria-hidden="true"
                            >
                              bookmark
                            </span>
                            <span className="text-sm font-semibold uppercase tracking-wider">
                              Saved to Memory Verse
                            </span>
                          </div>
                          <p className="text-ink" style={{ lineHeight: 1.65 }}>
                            {sup}
                            {v.text}
                          </p>
                        </div>
                      ) : (
                        <p className={`relative ${highlight}`}>
                          {sup}
                          {v.text}
                        </p>
                      )}

                      {v.number === momentumVerseNum && totalAssigned > 0 && (
                        <aside className="my-7 bg-verdant-soft border border-line rounded-xl p-4 font-sans">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full bg-verdant shrink-0"
                                aria-hidden="true"
                              />
                              <span className="text-sm font-semibold text-verdant uppercase tracking-wider">
                                Habit Momentum
                              </span>
                            </div>
                            <span className="text-sm text-ink-muted whitespace-nowrap tabular-nums">
                              {remaining > 0 ? `${remaining * 3}m left` : "Done"}
                            </span>
                          </div>
                          <h2 className="text-[18px] font-semibold text-ink font-sans mt-2 mb-1">
                            {remaining > 0
                              ? `You are ${remaining} chapter${remaining === 1 ? "" : "s"} from finishing this session`
                              : "You've finished every chapter in this session"}
                          </h2>
                          <p className="text-sm text-ink-muted mb-3">
                            {session
                              ? `Session goal: ${totalAssigned} chapters · ${
                                  SESSION_NAMES[session.sessionNumber - 1] ?? "Daily"
                                } session`
                              : `Daily goal: ${totalAssigned} chapters`}
                          </p>
                          <div
                            className="w-full h-1 bg-line rounded-full overflow-hidden"
                            aria-hidden="true"
                          >
                            <div
                              className="bg-verdant h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${
                                  totalAssigned
                                    ? Math.round((readCount / totalAssigned) * 100)
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                        </aside>
                      )}
                    </div>
                  );
                })}
                {chapter.verses.length === 0 && (
                  <p className="text-ink-muted text-sm">
                    No text returned for this chapter. Try another translation or retry.
                  </p>
                )}
              </div>
              {chapter.copyright && (
                <p className="mt-8 pt-4 border-t border-line text-sm font-sans text-ink-muted">
                  {chapter.copyright}
                </p>
              )}
            </>
          )}
        </article>

        {error && chapter && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}

        <nav className="mt-6 flex justify-between" aria-label="Chapter navigation">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!canPrev || !current}
            onClick={() => {
              if (!current) return;
              const p = prevChapterRef(current.bookId, current.chapter);
              if (p) setCurrent(p);
            }}
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              chevron_left
            </span>
            Previous
          </button>

          <button
            type="button"
            className="btn btn-ghost"
            disabled={!canNext || !current}
            onClick={() => {
              if (!current) return;
              const n = nextChapterRef(current.bookId, current.chapter);
              if (n) setCurrent(n);
            }}
          >
            Next
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              chevron_right
            </span>
          </button>
        </nav>

        <div className="mt-4 text-center">
          <button
            type="button"
            className="btn btn-ghost text-sm"
            onClick={() => setCurrent({ bookId: "GEN", chapter: 1 })}
          >
            Jump to Genesis 1
          </button>
        </div>
      </main>

      <div className="fixed bottom-20 left-0 right-0 max-w-[420px] mx-auto z-40 bg-surface-raised/95 backdrop-blur-md border-t border-b border-line rounded-2xl shadow-[0_-4px_20px_rgba(77,72,69,0.06)] px-5 pt-3.5 pb-4">
        <div className="w-8 h-1 bg-line rounded-full mx-auto mb-3" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3 mb-3 px-0.5">
          <div className="min-w-0">
            <span className="block text-sm font-semibold uppercase tracking-widest text-ink-muted truncate">
              {session
                ? `Session ${session.sessionNumber}${
                    SESSION_NAMES[session.sessionNumber - 1]
                      ? ` · ${SESSION_NAMES[session.sessionNumber - 1]}`
                      : ""
                  }`
                : "Session"}
            </span>
            <span className="block text-sm font-semibold text-ink truncate tabular-nums">
              {session
                ? `${session.chapters
                    .map((c) =>
                      c.start === c.end
                        ? `${c.bookName} ${c.start}`
                        : `${c.bookName} ${c.start}-${c.end}`
                    )
                    .join(", ")} of ${totalAssigned}`
                : `${readCount} of ${totalAssigned} chapters`}
            </span>
          </div>
          {status === "completed" ? (
            <span className="status-pill status-completed shrink-0">
              <span className="material-symbols-outlined text-[15px] fill-icon" aria-hidden="true">
                check_circle
              </span>
              Complete
            </span>
          ) : readCount > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-verdant bg-verdant-soft px-2 py-0.5 rounded-full text-sm font-medium">
              <span className="material-symbols-outlined text-[15px] fill-icon" aria-hidden="true">
                check_circle
              </span>
              On track
            </span>
          ) : (
            <span className="status-pill status-not-started shrink-0">Not started</span>
          )}
        </div>

        {status === "completed" ? (
          <div className="text-center py-2 text-sm font-medium text-verdant">
            Session complete — well done.
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary w-full"
            onClick={completeSession}
          >
            Mark session complete
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              check
            </span>
          </button>
        )}

        <div className="mt-2 flex items-center justify-center gap-5">
          {status === "not_started" && (
            <button
              type="button"
              className="text-sm text-ink-muted hover:text-ink transition-colors py-1"
              onClick={startSession}
            >
              Mark as started
            </button>
          )}
          <Link
            href="/dashboard"
            className="text-sm text-ink-muted hover:text-ink transition-colors py-1"
          >
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
