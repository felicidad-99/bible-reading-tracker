"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

interface GroupPreview {
  id: string;
  name: string;
  startDate: string;
  durationDays: number;
  frequency: number;
  scheduledTimes: unknown;
  translation: string;
}

interface PreviewResponse {
  group: GroupPreview;
  memberCount: number;
  isMember: boolean;
  canJoin: boolean;
  reason: string | null;
}

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code")?.trim() ?? "";

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!code) {
        setError("Missing invite code");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/groups/join?code=${encodeURIComponent(code)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Group not found");
        setPreview(data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Group not found");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [code, retryKey]);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join group");
      router.push(`/groups/${data.groupId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join group");
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-8 w-48 bg-surface-sunken rounded animate-pulse" />
        <div className="h-48 card animate-pulse" />
        <span className="sr-only">Loading group invitation</span>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="max-w-md mx-auto text-center py-16" role="alert">
        <h1 className="text-xl font-semibold">Invitation not found</h1>
        <p className="mt-3 text-ink-muted">{error ?? "This invite code is invalid."}</p>
        <button
          type="button"
          className="btn btn-secondary mt-6"
          onClick={() => {
            setLoading(true);
            setRetryKey((k) => k + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  const times = Array.isArray(preview.group.scheduledTimes)
    ? preview.group.scheduledTimes.filter((t): t is string => typeof t === "string")
    : [];

  return (
    <div className="max-w-md mx-auto">
      <p className="eyebrow">You&apos;re invited</p>
      <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">
        Join {preview.group.name}
      </h1>

      <div className="card p-5 mt-6 space-y-3">
        <Row label="Plan" value={`${preview.group.startDate} · ${preview.group.durationDays} days`} />
        <Row label="Sessions" value={`${preview.group.frequency}× daily (${times.join(", ")})`} />
        <Row label="Translation" value={preview.group.translation} />
        <Row label="Members" value={`${preview.memberCount} of 7`} />
        <p className="text-sm text-ink-muted pt-1">
          Your current plan will be archived (history kept) and replaced by this
          group plan, starting on the group&apos;s start date.
        </p>
      </div>

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2">
        {preview.isMember ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => router.push(`/groups/${preview.group.id}`)}
          >
            Open my group
          </button>
        ) : preview.canJoin ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={join}
            disabled={busy}
          >
            {busy ? "Joining…" : "Join group"}
          </button>
        ) : (
          <p className="text-sm text-danger" role="alert">
            {preview.reason ?? "This group cannot be joined right now."}
          </p>
        )}
        <button type="button" className="btn btn-ghost" onClick={() => router.push("/dashboard")}>
          Back to dashboard
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-ink-subtle">{label}</span>
      <span className="font-medium text-right tabular-nums">{value}</span>
    </div>
  );
}

export default function JoinGroupPage() {
  return (
    <Suspense fallback={<div className="h-48 card animate-pulse" />}>
      <JoinContent />
    </Suspense>
  );
}
