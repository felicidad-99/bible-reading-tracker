"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  BIBLE_BOOKS,
  getBookById,
} from "@/lib/plan/bible-books";
import type { ChapterRange } from "@/lib/plan/generator";

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
  const [readSet, setReadSet] = useState<Set<string>>(new Set());
  const [latestSessionId, setLatestSessionId] = useState<string | null>(null);

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

  const toggleVerses = useCallback(() => {
    const next = localStorage.getItem("reader-show-verses") === "0";
    localStorage.setItem("reader-show-verses", next ? "1" : "0");
    window.dispatchEvent(new Event("storage"));
  }, []);

  const markRead = useCallback(
    (bookId: string, ch: number) => {
      setReadSet((prev) => {
        const next = new Set(prev);
        next.add(`${bookId}:${ch}`);
        return next;
      });
      if (planSession) {
        fetch("/api/sessions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: planSession,
            bookId,
            chapter: ch,
            read: true,
          }),
        }).catch(() => {});
      }
    },
    [planSession]
  );

  const loadSession = useCallback(async (id: string) => {
    setLoadingSession(true);
    try {
      const res = await fetch("/api/calendar");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load plan");

      let found: (SessionDetail & {
        readingDay: { date: string; dayNumber: number; planId: string };
      }) | null = null;
      for (const day of data.days as Array<{
        id: string;
        date: string;
        dayNumber: number;
        sessions: SessionDetail[];
      }>) {
        const hit = day.sessions.find((s) => s.id === id);
        if (hit) {
          found = {
            ...hit,
            readingDay: {
              date: day.date,
              dayNumber: day.dayNumber,
              planId: data.planId ?? "",
            },
          };
          break;
        }
      }

      if (!found) {
        setError("Session not found");
        return;
      }

      setSession(found);
      setStatus(found.status);
      setTranslation(
        (data.translation as string) ||
          localStorage.getItem("reader-translation") ||
          "BSB"
      );

      const reads = new Set<string>();
      setReadSet(reads);

      const flat = flattenAssigned(found);
      if (flat.length > 0) {
        const unread = flat.find((c) => !reads.has(`${c.bookId}:${c.chapter}`));
        setCurrent(unread ?? flat[0]);
      }

      const planRes = await fetch("/api/plans");
      const planData = await planRes.json();
      if (planData?.plan?.translation) {
        setTranslation(planData.plan.translation);
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
      const res = await fetch("/api/dashboard");
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
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            {session
              ? `${SESSION_NAMES[session.sessionNumber - 1] ?? "Session"} · Day ${session.readingDay.dayNumber}`
              : "Reader"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {chapter
              ? `${chapter.bookName} ${chapter.chapter}`
              : session
                ? session.chapters[0]?.bookName ?? "Reading"
                : "Reading"}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {chapter?.translationName ?? translation}
            {session && (
              <>
                {" · "}
                {session.chapters
                  .map((c) =>
                    c.start === c.end
                      ? `${c.bookName} ${c.start}`
                      : `${c.bookName} ${c.start}-${c.end}`
                  )
                  .join(", ")}
              </>
            )}
          </p>
          {chapter?.copyright && (
            <p className="mt-1 text-xs text-ink-subtle">{chapter.copyright}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`status-pill status-${status === "completed" ? "completed" : status === "in_progress" || status === "in-progress" ? "in-progress" : status === "missed" ? "missed" : "not-started"}`}>
            {status === "completed"
              ? "Completed"
              : status === "in_progress" || status === "in-progress"
                ? "In progress"
                : "Not started"}
          </span>
        </div>
      </header>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 card px-4 py-3">
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
            className="btn btn-ghost text-xs px-3 py-1.5"
            onClick={() => setFontSize(Math.max(14, fontSize - 2))}
            aria-label="Decrease font size"
          >
            A−
          </button>
          <button
            type="button"
            className="btn btn-ghost text-xs px-3 py-1.5"
            onClick={() => setFontSize(Math.min(28, fontSize + 2))}
            aria-label="Increase font size"
          >
            A+
          </button>
          <button
            type="button"
            className="btn btn-ghost text-xs px-3 py-1.5"
            onClick={toggleVerses}
            aria-pressed={showVerses}
          >
            {showVerses ? "Verses on" : "Verses off"}
          </button>
        </div>
      </div>

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
          <div className="font-serif">
            <p className="text-sm font-sans text-ink-subtle mb-6 tracking-wide uppercase">
              {chapter.bookName} {chapter.chapter} · {chapter.translationName}
            </p>
            <div className="space-y-4">
              {chapter.verses.map((v) => (
                <p key={v.number} className="text-ink">
                  {showVerses && (
                    <sup className="text-accent font-sans text-[0.7em] mr-1 tabular-nums">
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
              <p className="mt-8 pt-4 border-t border-line text-xs font-sans text-ink-subtle">
                {chapter.copyright}
              </p>
            )}
          </div>
        )}
      </article>

      <nav
        className="mt-6 flex items-center justify-between gap-3"
        aria-label="Chapter navigation"
      >
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!canPrev || !current}
          onClick={() => {
            if (!current) return;
            const p = prevChapterRef(current.bookId, current.chapter);
            if (p) setCurrent(p);
          }}
        >
          Previous
        </button>

        {status === "not_started" && (
          <button type="button" className="btn btn-primary" onClick={startSession}>
            Mark as started
          </button>
        )}
        {status !== "completed" && (
          <button type="button" className="btn btn-primary" onClick={completeSession}>
            Mark as Completed
          </button>
        )}
        {status === "completed" && (
          <span className="status-pill status-completed">Session complete</span>
        )}

        <button
          type="button"
          className="btn btn-secondary"
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
    </div>
  );
}

function isAssigned(
  keys: Set<string>,
  ref: { bookId: string; chapter: number }
): boolean {
  return keys.has(`${ref.bookId}:${ref.chapter}`);
}
