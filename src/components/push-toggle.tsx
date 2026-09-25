"use client";

import { useEffect, useState } from "react";

type Status =
  | "loading"
  | "unsupported"
  | "unconfigured"
  | "denied"
  | "on"
  | "off";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function b64url(bytes: ArrayBuffer | null): string {
  if (!bytes) return "";
  const bytesArr = new Uint8Array(bytes);
  let raw = "";
  for (const b of bytesArr) raw += String.fromCharCode(b);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function PushToggle() {
  const [status, setStatus] = useState<Status>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        typeof Notification === "undefined"
      ) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      try {
        const res = await fetch("/api/push/subscribe");
        const data = await res.json();
        if (cancelled) return;
        if (!data.configured || !data.publicKey) {
          setStatus("unconfigured");
          return;
        }
        setPublicKey(data.publicKey);

        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
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
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        setNote("Permission not granted.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: {
            p256dh: b64url(sub.getKey("p256dh")),
            auth: b64url(sub.getKey("auth")),
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save subscription");
      }
      setStatus("on");
      setNote("Push notifications enabled.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Failed to enable push");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setNote(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
      setNote("Push notifications disabled.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Failed to disable push");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return <p className="text-sm text-ink-muted">Checking push support…</p>;
  }
  if (status === "unsupported") {
    return (
      <p className="text-sm text-ink-subtle">
        This browser doesn&apos;t support web push notifications.
      </p>
    );
  }
  if (status === "unconfigured") {
    return (
      <p className="text-sm text-ink-subtle">
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
      <p className="text-sm text-ink-subtle">
        Get nudges from group members when you miss a reading — even when the
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
