"use client";

import { useEffect, useState } from "react";
import {
  disablePush,
  enablePush,
  getActiveSubscription,
  getPushConfig,
  pushSupported,
} from "@/lib/push/subscribe-client";

type Status =
  | "loading"
  | "unsupported"
  | "unconfigured"
  | "denied"
  | "on"
  | "off";

export function PushToggle() {
  const [status, setStatus] = useState<Status>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!pushSupported()) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      try {
        const config = await getPushConfig();
        if (cancelled) return;
        if (!config.configured || !config.publicKey) {
          setStatus("unconfigured");
          return;
        }
        setPublicKey(config.publicKey);

        const sub = await getActiveSubscription();
        if (cancelled) return;
        if (sub) {
          setStatus("on");
        } else if (Notification.permission === "denied") {
          setStatus("denied");
        } else {
          setStatus("off");
        }
      } catch {
        if (!cancelled) setStatus("unsupported");
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await enablePush(publicKey);
      if (result.ok) {
        setStatus("on");
        setNote(result.note);
      } else if (result.note === "denied") {
        setStatus("denied");
        setNote("Permission not granted.");
      } else {
        setNote(result.note);
      }
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setNote(null);
    try {
      const result = await disablePush();
      setStatus("off");
      setNote(result.note);
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return <p className="text-sm text-ink-muted">Checking push support…</p>;
  }
  if (status === "unsupported") {
    return (
      <p className="text-sm text-ink-muted">
        This browser doesn&apos;t support web push notifications.
      </p>
    );
  }
  if (status === "unconfigured") {
    return (
      <p className="text-sm text-ink-muted">
        Push notifications are not configured on this server yet.
      </p>
    );
  }
  if (status === "denied") {
    return (
      <p className="text-sm text-danger">
        Notifications are blocked for this site. Allow them in your browser
        settings, then reload.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={status === "on"}
          onChange={() => (status === "on" ? disable() : enable())}
          disabled={busy}
          className="size-4 accent-[var(--color-accent)]"
        />
        {busy
          ? "Updating…"
          : status === "on"
            ? "Push notifications on"
            : "Enable push notifications"}
      </label>
      <p className="text-sm text-ink-muted">
        Get reading reminders and group nudges on your device — even when the
        app is closed. iPhone/iPad: add the app to your Home Screen first; push
        requires the installed version.
      </p>
      {note && (
        <p role="status" className="text-sm text-ink-muted">
          {note}
        </p>
      )}
    </div>
  );
}
