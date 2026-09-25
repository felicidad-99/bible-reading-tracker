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
  _count: { members: number };
}

export function GroupsSection({ hideHeading = false }: { hideHeading?: boolean }) {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
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
    if (!code) return;
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

  return (
    <section aria-label="Your groups" className="fade-up">
      {hideHeading ? (
        <div className="flex justify-end">
          <Link href="/groups/new" className="btn btn-secondary text-sm">
            New group
          </Link>
        </div>
      ) : (
        <div className="flex items-baseline justify-between gap-3">
          <h2
            id="groups-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Groups
          </h2>
          <Link href="/groups/new" className="btn btn-secondary text-sm">
            New group
          </Link>
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-3" aria-busy="true">
          <div className="h-16 card animate-pulse" />
          <span className="sr-only">Loading groups</span>
        </div>
      ) : groups.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {groups.map((group) => (
            <li
              key={group.id}
              className="card p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <Link
                  href={`/groups/${group.id}`}
                  className="font-medium hover:text-accent transition-colors"
                >
                  {group.name}
                </Link>
                <p className="text-sm text-ink-muted mt-0.5">
                  {group._count.members} of 7 members · starts{" "}
                  {group.startDate} · {group.frequency}× daily
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost text-sm"
                onClick={() => copyInvite(group)}
              >
                {copiedId === group.id ? "Copied!" : "Copy invite link"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card p-6 mt-4 text-center">
          <p className="text-ink-muted">
            Reading together keeps you accountable. Create a group of up to 7,
            or join one with an invite code.
          </p>
          <Link href="/groups/new" className="btn btn-primary mt-4">
            Create a group
          </Link>
        </div>
      )}

      <form onSubmit={joinByCode} className="mt-4 flex flex-wrap gap-2">
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
          className="btn btn-secondary"
          disabled={joining || !inviteCode.trim()}
        >
          {joining ? "Joining…" : "Join"}
        </button>
      </form>

      {error && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
