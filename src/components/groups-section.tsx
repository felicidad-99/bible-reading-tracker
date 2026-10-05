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

export function GroupsSection({
  variant = "preview",
}: {
  variant?: "preview" | "full";
}) {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [week, setWeek] = useState<WeekInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
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
      {isFull && (
        <div className="card p-5 md:p-6">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold bg-ember-soft text-accent-ink px-3 py-1 rounded-full">
            <span
              className="material-symbols-outlined text-[16px] fill-icon"
              aria-hidden="true"
            >
              groups
            </span>
            Shared reading
          </span>
          <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight">
            Together in Scripture
          </h1>
          <p className="mt-2 text-ink-muted">
            Walk through the Word alongside friends, small groups, and church
            companions with synchronized pacing.
          </p>
        </div>
      )}

      <div className={isFull ? "mt-6 flex items-baseline justify-between gap-3" : "flex items-baseline justify-between gap-3"}>
        <h2 id="groups-heading" className="text-lg font-semibold tracking-tight">
          {isFull ? "My groups" : "Community reading"}
        </h2>
        {isFull ? (
          <Link href="/groups/new" className="btn btn-primary text-sm">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              add
            </span>
            New
          </Link>
        ) : (
          <Link href="/groups" className="btn btn-ghost text-sm">
            Explore groups
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              chevron_right
            </span>
          </Link>
        )}
      </div>

      {loading ? (
        <div className="mt-4 space-y-3" aria-busy="true">
          <div className="h-24 card animate-pulse" />
          <span className="sr-only">Loading groups</span>
        </div>
      ) : groups.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {groups.map((group) => (
            <li key={group.id} className="card p-4">
              <div className="flex gap-3">
                <div className="flex shrink-0 -space-x-2 pt-1" aria-hidden="true">
                  {group.members.slice(0, 3).map((m, i) => (
                    <span
                      key={i}
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium ring-2 ring-surface-raised ${AVATAR_TINTS[i % AVATAR_TINTS.length]}`}
                    >
                      {initialsOf(m.user.name, m.user.email)}
                    </span>
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/groups/${group.id}`}
                        className="font-medium hover:text-accent-ink transition-colors"
                      >
                        {group.name}
                      </Link>
                      <p className="text-sm text-ink-muted mt-0.5">
                        {group._count.members} members · Est.{" "}
                        {new Date(group.createdAt).getFullYear()}
                      </p>
                    </div>
                    <Link
                      href={`/groups/${group.id}`}
                      className="btn btn-ghost text-sm px-2 shrink-0"
                      aria-label={`Open ${group.name}`}
                    >
                      Open
                      <span
                        className="material-symbols-outlined text-[18px]"
                        aria-hidden="true"
                      >
                        chevron_right
                      </span>
                    </Link>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <span
                        className="material-symbols-outlined text-[16px] text-ember fill-icon"
                        aria-hidden="true"
                      >
                        local_fire_department
                      </span>
                      {group.myStreak}-day streak
                    </span>
                    <span className="text-ink-muted">
                      {group.todayReading
                        ? `Reading ${group.todayReading} today`
                        : "No reading scheduled today"}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="text-ink-muted tabular-nums">
                      {group.readyToday} of {group._count.members} ready
                    </span>
                    {group.iCompletedToday && (
                      <span className="inline-flex items-center gap-1 text-verdant">
                        <span
                          className="material-symbols-outlined text-[16px] fill-icon"
                          aria-hidden="true"
                        >
                          check_circle
                        </span>
                        You completed reading
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
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
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card p-6 mt-4 text-center">
          <p className="text-ink-muted">
            Reading together keeps you accountable. Create a group, or join one
            with an invite code below.
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
          className="mt-6 card p-5"
          aria-labelledby="week-together-heading"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2
              id="week-together-heading"
              className="font-semibold tracking-tight"
            >
              This week&apos;s together progress
            </h2>
            <span className="text-sm font-semibold text-accent-ink tabular-nums">
              {week.percent}% completed
            </span>
          </div>
          <div
            className="mt-3 progress-track h-3"
            role="progressbar"
            aria-valuenow={week.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Group reading progress this week"
          >
            <div className="progress-fill" style={{ width: `${week.percent}%` }} />
          </div>
          <p className="mt-3 text-sm text-ink-muted tabular-nums">
            {week.completed} of {week.expected} chapters · Target: Sunday
          </p>
          <p className="mt-1.5 text-sm text-ink-muted flex items-center gap-1.5">
            <span
              className="material-symbols-outlined text-[16px] text-verdant"
              aria-hidden="true"
            >
              eco
            </span>
            {week.finishedToday} member{week.finishedToday === 1 ? "" : "s"}{" "}
            finished today&apos;s reading so far.
          </p>
        </section>
      )}

      {isFull && (
        <section className="mt-6 card p-5 flex gap-3.5" aria-labelledby="invite-heading">
          <span className="w-11 h-11 rounded-xl bg-sandstone-soft flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-[22px] text-sandstone"
              aria-hidden="true"
            >
              key
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p id="invite-heading" className="font-medium">
              Have an invite code?
            </p>
            <p className="text-sm text-ink-muted mt-0.5">
              Join a private study group with your church or friends.
            </p>
            <form onSubmit={joinByCode} className="mt-3 flex flex-wrap gap-2">
              <label htmlFor="invite-code" className="sr-only">
                Invite code
              </label>
              <input
                id="invite-code"
                type="text"
                className="input flex-1 min-w-40"
                placeholder="Paste invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                autoComplete="off"
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={joining}
              >
                {joining ? "Joining…" : "Join group"}
              </button>
            </form>
            <p className="mt-3 text-sm text-ink-muted flex items-center gap-1.5">
              <span
                className="material-symbols-outlined text-[16px]"
                aria-hidden="true"
              >
                lock
              </span>
              Private circles require member passcode verification.
            </p>
          </div>
        </section>
      )}
    </section>
  );
}
