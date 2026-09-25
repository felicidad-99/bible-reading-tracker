"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { format, addDays, parseISO } from "date-fns";

interface Cell {
  date: string;
  dayNumber: number | null;
  status: string;
}

interface MatrixMember {
  userId: string;
  name: string;
  image: string | null;
  role: string;
  planId: string | null;
  currentStreak: number;
  longestStreak: number;
  cells: Cell[];
}

interface MatrixData {
  group: {
    id: string;
    name: string;
    startDate: string;
    durationDays: number;
    frequency: number;
    scheduledTimes: unknown;
    translation: string;
  };
  start: string;
  dates: string[];
  meUserId: string;
  nudgedToday: string[];
  members: MatrixMember[];
}

interface GroupDetail {
  group: {
    id: string;
    name: string;
    inviteCode: string;
    startDate: string;
    durationDays: number;
    frequency: number;
    scheduledTimes: unknown;
    translation: string;
  };
  members: Array<{
    userId: string;
    role: string;
    user: { id: string; name: string | null; email: string; image: string | null };
  }>;
}

const STATUS_LABEL: Record<string, string> = {
  completed: "Done",
  in_progress: "Reading",
  missed: "Missed",
  not_started: "Not read",
  no_plan: "No plan",
  no_day: "—",
};

function defaultAnchor(): string {
  return format(addDays(new Date(), -6), "yyyy-MM-dd");
}

export default function GroupDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const groupId = params.id;

  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [matrix, setMatrix] = useState<MatrixData | null>(null);
  const [anchor, setAnchor] = useState<string>(defaultAnchor);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nudged, setNudged] = useState<Set<string>>(new Set());
  const [nudgeBusy, setNudgeBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [dRes, mRes] = await Promise.all([
          fetch(`/api/groups/${groupId}`),
          fetch(`/api/groups/${groupId}/matrix?start=${anchor}`),
        ]);
        const dData = await dRes.json();
        const mData = await mRes.json();
        if (cancelled) return;
        if (!dRes.ok) throw new Error(dData.error || "Failed to load group");
        if (!mRes.ok) throw new Error(mData.error || "Failed to load matrix");
        setDetail(dData);
        setMatrix(mData);
        setNudged(new Set(mData.nudgedToday ?? []));
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load group");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [groupId, anchor]);

  async function copyInvite() {
    if (!detail) return;
    const url = `${window.location.origin}/groups/join?code=${detail.group.inviteCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy invite link");
    }
  }

  async function sendNudge(toUserId: string) {
    setNudgeBusy(toUserId);
    try {
      const res = await fetch(`/api/groups/${groupId}/nudge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setNudged((prev) => new Set(prev).add(toUserId));
        } else {
          throw new Error(data.error || "Failed to send nudge");
        }
        return;
      }
      setNudged((prev) => new Set(prev).add(toUserId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send nudge");
    } finally {
      setNudgeBusy(null);
    }
  }

  async function leaveGroup() {
    if (!window.confirm("Leave this group? Your current reading plan stays active as your personal plan.")) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/membership`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to leave group");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave group");
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-8 w-56 bg-surface-sunken rounded animate-pulse" />
        <div className="h-24 card animate-pulse" />
        <div className="h-64 card animate-pulse" />
        <span className="sr-only">Loading group</span>
      </div>
    );
  }

  if (!detail || !matrix) {
    return (
      <div className="max-w-md mx-auto text-center py-16" role="alert">
        <h1 className="text-xl font-semibold">Group not found</h1>
        <p className="mt-3 text-ink-muted">{error ?? "This group is unavailable."}</p>
        <button type="button" className="btn btn-secondary mt-6" onClick={() => router.push("/dashboard")}>
          Back to dashboard
        </button>
      </div>
    );
  }

  const times = Array.isArray(matrix.group.scheduledTimes)
    ? matrix.group.scheduledTimes.filter((t): t is string => typeof t === "string")
    : [];
  const today = format(new Date(), "yyyy-MM-dd");
  const windowEnd = matrix.dates[matrix.dates.length - 1];
  const canGoNext = windowEnd < today;
  const isDefaultAnchor = anchor === defaultAnchor();

  const nudgeable = (m: MatrixMember, cell: Cell) =>
    m.userId !== matrix.meUserId &&
    cell.date <= today &&
    !["completed", "no_plan", "no_day"].includes(cell.status);

  return (
    <div className="space-y-6">
      <header className="fade-up">
        <p className="eyebrow">Group</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              {matrix.group.name}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {matrix.group.startDate} · {matrix.group.durationDays} days ·{" "}
              {matrix.group.frequency}× daily ({times.join(", ")}) ·{" "}
              {matrix.group.translation} · {detail.members.length} of 7 members
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary text-sm" onClick={copyInvite}>
              {copied ? "Copied!" : "Copy invite link"}
            </button>
            <button
              type="button"
              className="btn btn-ghost text-sm"
              onClick={leaveGroup}
              disabled={busy}
            >
              {busy ? "Leaving…" : "Leave group"}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <section aria-labelledby="matrix-heading" className="fade-up fade-up-delay-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="matrix-heading" className="text-lg font-semibold tracking-tight">
            Who&apos;s read
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary text-sm"
              onClick={() => setAnchor(format(addDays(parseISO(anchor), -7), "yyyy-MM-dd"))}
            >
              ← Previous
            </button>
            {!isDefaultAnchor && (
              <button
                type="button"
                className="btn btn-ghost text-sm"
                onClick={() => setAnchor(defaultAnchor())}
              >
                This week
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary text-sm"
              onClick={() => setAnchor(format(addDays(parseISO(anchor), 7), "yyyy-MM-dd"))}
              disabled={!canGoNext}
            >
              Next →
            </button>
          </div>
        </div>

        <div className="card mt-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[680px]">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-surface-raised text-left px-3 py-2.5 font-medium text-ink-subtle border-b border-line min-w-[160px]"
                >
                  Member
                </th>
                {matrix.dates.map((date) => (
                  <th
                    key={date}
                    scope="col"
                    className={`px-1.5 py-2.5 font-medium text-center border-b border-line ${
                      date === today ? "text-accent" : "text-ink-subtle"
                    }`}
                  >
                    <span className="block text-sm">
                      {format(parseISO(date), "EEE")}
                    </span>
                    <span className="block text-sm tabular-nums">
                      {format(parseISO(date), "d MMM")}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.members.map((m) => (
                <tr key={m.userId}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-surface-raised text-left px-3 py-2.5 border-b border-line font-normal"
                  >
                    <span className="block font-medium truncate max-w-[140px]">
                      {m.name}
                    </span>
                    <span className="block text-sm text-ink-muted">
                      {m.role === "owner" ? "Owner · " : ""}
                      {m.currentStreak} day streak
                    </span>
                  </th>
                  {m.cells.map((cell) => (
                    <td key={cell.date} className="px-1.5 py-2 text-center border-b border-line">
                      <span
                        className={`status-pill ${
                          cell.status === "completed"
                            ? "status-completed"
                            : cell.status === "missed"
                              ? "status-missed"
                              : cell.status === "in_progress"
                                ? "status-in-progress"
                                : cell.status === "no_plan" || cell.status === "no_day"
                                  ? ""
                                  : "status-not-started"
                        }`}
                        title={`${cell.date}: ${STATUS_LABEL[cell.status] ?? cell.status}`}
                      >
                        {STATUS_LABEL[cell.status] ?? cell.status}
                      </span>
                      {nudgeable(m, cell) && (
                        <button
                          type="button"
                          className="btn btn-ghost text-sm w-full mt-1"
                          onClick={() => sendNudge(m.userId)}
                          disabled={nudged.has(m.userId) || nudgeBusy === m.userId}
                        >
                          {nudged.has(m.userId)
                            ? "Nudged"
                            : nudgeBusy === m.userId
                              ? "…"
                              : "Nudge"}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-sm text-ink-muted">
          Statuses derive each member&apos;s own plan for the same calendar dates.
        </p>
      </section>
    </div>
  );
}
