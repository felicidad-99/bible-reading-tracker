"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface GroupSummary {
  id: string;
  name: string;
  inviteCode: string;
  startDate: string;
  durationDays: number;
  frequency: number;
  translation: string;
  createdAt: string;
  scheduledTimes: unknown;
  _count: { members: number };
  members: Array<{ user: { name: string | null; email: string } }>;
  myStreak: number;
  readyToday: number;
  iCompletedToday: boolean;
  todayReading: string | null;
}

interface WeekInfo {
  completed: number;
  expected: number;
  percent: number;
  finishedToday: number;
}

function initialsOf(name: string | null | undefined, email: string): string {
  const source = (name ?? email.split("@")[0]).trim();
  const parts = source.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || "?";
}

const AVATAR_TINTS = [
  "bg-sandstone-soft text-sandstone",
  "bg-verdant-soft text-verdant",
  "bg-ember-soft text-accent-ink",
];

export function JoinGroupCard() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function joinByCode(e: React.FormEvent) {
    e.preventDefault();
    const code = inviteCode.trim();
    if (!code) {
      setError("Paste an invite code from a group member.");
      return;
    }
    setJoining(true);
    setError(null);
    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join group");
      setInviteCode("");
      router.push(`/groups/${data.groupId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join group");
      setJoining(false);
    }
  }

  return (
    <section className="card p-4" aria-labelledby="invite-heading">
      <div className="flex items-start gap-3 mb-3">
        <span className="p-2 rounded-lg bg-ember-soft text-accent-ink shrink-0" aria-hidden="true">
          <span className="material-symbols-outlined text-[20px]">key</span>
        </span>
        <div className="min-w-0">
          <h3 id="invite-heading" className="text-[15px] font-semibold text-ink">
            Have an invite code?
          </h3>
          <p className="text-sm text-ink-muted leading-snug mt-0.5">
            Join a private study group with your church or friends.
          </p>
        </div>
      </div>
      <form onSubmit={joinByCode} className="space-y-3">
        <div className="relative">
          <label htmlFor="invite-code" className="sr-only">
            Invite code
          </label>
          <input
            id="invite-code"
            type="text"
            className="input w-full pr-28 font-mono uppercase tracking-wider"
            placeholder="e.g. GRACE-2024"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={joining}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-11 px-3.5 rounded-lg bg-surface-sunken hover:bg-line text-sm font-medium text-ink transition-colors active:scale-95"
          >
            {joining ? "Joining…" : "Join group"}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <p className="text-sm text-ink-muted flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
            lock
          </span>
          Private circles require member passcode verification.
        </p>
      </form>
    </section>
  );
}

export function GroupsSection({
  variant = "preview",
}: {
  variant?: "preview" | "full";
}) {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [week, setWeek] = useState<WeekInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/groups");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Failed to load groups");
        setGroups(data.groups);
        setWeek(data.week ?? null);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load groups");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function copyInvite(group: GroupSummary) {
    const url = `${window.location.origin}/groups/join?code=${group.inviteCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(group.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError("Could not copy invite link");
    }
  }

  const isFull = variant === "full";

  return (
    <section aria-label="Your groups" className="fade-up">
      {!isFull && (
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="groups-heading" className="text-lg font-semibold tracking-tight">
            Community reading
          </h2>
          <Link href="/groups" className="btn btn-ghost text-sm">
            Explore groups
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              chevron_right
            </span>
          </Link>
        </div>
      )}

      {loading ? (
        <div className={isFull ? "space-y-3" : "mt-4 space-y-3"} aria-busy="true">
          <div className="h-24 card animate-pulse" />
          <span className="sr-only">Loading groups</span>
        </div>
      ) : groups.length > 0 ? (
        <ul
          className={
            isFull ? "grid gap-3 lg:grid-cols-2 lg:items-start" : "mt-4 space-y-3"
          }
        >
          {groups.map((group) => {
            const readyPercent =
              group._count.members > 0
                ? Math.min(100, Math.round((group.readyToday / group._count.members) * 100))
                : 0;
            return (
              <li key={group.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {group.members.length > 1 ? (
                      <div className="flex shrink-0 -space-x-2 pt-0.5" aria-hidden="true">
                        {group.members.slice(0, 3).map((m, i) => (
                          <span
                            key={i}
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium ring-2 ring-surface-raised ${AVATAR_TINTS[i % AVATAR_TINTS.length]}`}
                          >
                            {initialsOf(m.user.name, m.user.email)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span
                        className="w-9 h-9 rounded-lg bg-surface-sunken flex items-center justify-center text-ink-muted shrink-0"
                        aria-hidden="true"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          auto_stories
                        </span>
                      </span>
                    )}
                    <div className="min-w-0">
                      <Link
                        href={`/groups/${group.id}`}
                        className="text-lg font-semibold tracking-tight hover:text-accent-ink transition-colors"
                      >
                        {group.name}
                      </Link>
                      <p className="text-sm text-ink-muted mt-0.5">
                        {group._count.members} members · Est.{" "}
                        {new Date(group.createdAt).getFullYear()}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium shrink-0 ${
                      group.iCompletedToday
                        ? "bg-verdant-soft text-verdant"
                        : "bg-line text-ink-muted"
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[14px] ${
                        group.iCompletedToday ? "fill-icon" : ""
                      }`}
                      aria-hidden="true"
                    >
                      {group.iCompletedToday ? "local_fire_department" : "timer"}
                    </span>
                    <span className="tabular-nums">{group.myStreak}-day streak</span>
                  </span>
                </div>

                <div className="h-px bg-line my-3.5" aria-hidden="true" />

                <div className="space-y-2">
                  <div className="flex justify-between items-baseline gap-2 text-sm">
                    <span className="font-medium min-w-0 truncate">
                      {group.todayReading
                        ? `Reading ${group.todayReading} today`
                        : "No reading scheduled today"}
                    </span>
                    <span className="text-verdant font-medium shrink-0 tabular-nums">
                      {group.readyToday} of {group._count.members} ready
                    </span>
                  </div>
                  <div
                    className="h-1.5 w-full bg-line rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={readyPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${group.name} readiness today`}
                  >
                    <div
                      className="h-full bg-verdant rounded-full transition-all duration-500"
                      style={{ width: `${readyPercent}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-1 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    {group.iCompletedToday && (
                      <span className="flex items-center gap-1.5 text-sm text-ink-muted">
                        <span
                          className="material-symbols-outlined text-[18px] text-verdant"
                          aria-hidden="true"
                        >
                          check_circle
                        </span>
                        You completed reading
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      className="btn btn-ghost text-sm"
                      onClick={() => copyInvite(group)}
                    >
                      <span
                        className="material-symbols-outlined text-[18px]"
                        aria-hidden="true"
                      >
                        {copiedId === group.id ? "check" : "content_copy"}
                      </span>
                      {copiedId === group.id ? "Copied!" : "Copy invite"}
                    </button>
                    <Link
                      href={`/groups/${group.id}`}
                      className="min-h-11 px-3.5 rounded-lg bg-surface-sunken hover:bg-line text-sm font-medium text-ink transition-colors flex items-center gap-1 shrink-0"
                      aria-label={`Open ${group.name}`}
                    >
                      Open
                      <span
                        className="material-symbols-outlined text-[16px]"
                        aria-hidden="true"
                      >
                        chevron_right
                      </span>
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className={`card p-6 text-center ${isFull ? "" : "mt-4"}`}>
          <p className="text-ink-muted">
            Reading together keeps you accountable. Create a group, or open the
            Discover tab to join one with an invite code.
          </p>
          <Link href="/groups/new" className="btn btn-primary mt-4">
            Create a group
          </Link>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {isFull && week && week.expected > 0 && (
        <section
          className="mt-6 bg-verdant-soft rounded-lg border border-verdant/15 p-4"
          aria-labelledby="week-together-heading"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <h2
              id="week-together-heading"
              className="text-sm font-semibold uppercase tracking-wider text-verdant"
            >
              This week&apos;s together progress
            </h2>
            <span className="text-sm font-semibold text-verdant bg-surface-raised px-2 py-0.5 rounded-full shrink-0 tabular-nums">
              {week.percent}% completed
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <div className="flex items-baseline gap-1.5 tabular-nums min-w-0">
              <span className="text-2xl font-semibold text-ink">{week.completed}</span>
              <span className="text-base text-ink-muted">
                of {week.expected} chapters
              </span>
            </div>
            <span className="text-sm text-ink-muted shrink-0">Target: Sunday</span>
          </div>
          <div
            className="h-1.5 w-full bg-surface-raised rounded-full overflow-hidden mb-2.5"
            role="progressbar"
            aria-valuenow={week.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Group reading progress this week"
          >
            <div
              className="h-full bg-verdant rounded-full transition-all duration-500"
              style={{ width: `${week.percent}%` }}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <span
              className="material-symbols-outlined text-[16px] text-verdant shrink-0"
              aria-hidden="true"
            >
              eco
            </span>
            <p>
              {week.finishedToday} member{week.finishedToday === 1 ? "" : "s"}{" "}
              finished today&apos;s reading so far.
            </p>
          </div>
        </section>
      )}
    </section>
  );
}
